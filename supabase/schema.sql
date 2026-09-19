-- วางทั้งหมดใน Supabase SQL Editor แล้วกด Run
-- เก็บสมุดบันทึก 1 ชุดต่อผู้ใช้ พร้อม revision ป้องกันการเขียนทับจากหลายอุปกรณ์
begin;
create table if not exists public.littleapp_journals (
  user_id uuid primary key references auth.users(id) on delete cascade,
  payload jsonb not null default '{"trades":[],"holdings":[]}'::jsonb,
  revision integer not null default 0 check (revision >= 0),
  updated_at timestamptz not null default now(),
  constraint littleapp_payload_shape check (
    jsonb_typeof(payload) = 'object'
    and payload ? 'trades' and payload ? 'holdings'
    and jsonb_typeof(payload->'trades') = 'array'
    and jsonb_typeof(payload->'holdings') = 'array'
    and octet_length(payload::text) <= 10000000
  )
);
alter table public.littleapp_journals enable row level security;
revoke all on public.littleapp_journals from anon, authenticated;
grant select on public.littleapp_journals to authenticated;
drop policy if exists littleapp_read_own on public.littleapp_journals;
create policy littleapp_read_own on public.littleapp_journals
  for select to authenticated using ((select auth.uid()) = user_id);

-- SECURITY DEFINER จำเป็นสำหรับการเขียน: ไม่รับ user_id จาก client และตรวจ auth.uid() เสมอ
create or replace function public.littleapp_save(p_payload jsonb, p_revision integer)
returns integer
language plpgsql security definer set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_revision integer;
begin
  if v_user is null then raise exception 'AUTH_REQUIRED'; end if;
  if p_revision is null or p_revision < 0 then raise exception 'INVALID_REVISION'; end if;
  if p_payload is null or jsonb_typeof(p_payload) is distinct from 'object'
     or jsonb_typeof(p_payload->'trades') is distinct from 'array'
     or jsonb_typeof(p_payload->'holdings') is distinct from 'array'
     or octet_length(p_payload::text) > 10000000 then
    raise exception 'INVALID_PAYLOAD';
  end if;
  if jsonb_array_length(p_payload->'trades') + jsonb_array_length(p_payload->'holdings') > 10000 then
    raise exception 'TOO_MANY_RECORDS';
  end if;
  insert into public.littleapp_journals(user_id) values (v_user)
    on conflict (user_id) do nothing;
  select revision into v_revision from public.littleapp_journals
    where user_id = v_user for update;
  if v_revision <> p_revision then raise exception 'REVISION_CONFLICT'; end if;
  update public.littleapp_journals set payload = p_payload,
    revision = revision + 1, updated_at = now() where user_id = v_user
    returning revision into v_revision;
  return v_revision;
end;
$$;
revoke all on function public.littleapp_save(jsonb, integer) from public, anon;
grant execute on function public.littleapp_save(jsonb, integer) to authenticated;
commit;
