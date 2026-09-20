const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const KEY='littleapp-v1', currencies=['USD','USDT','THB','BTC'];
let data={trades:[],holdings:[]},view='overview',currency='USD',editing=null;
const BROKERS=['Exness','SCBX','Bualuang','Deribit','Phemex','อื่น ๆ'];
const defaultAccounts=()=>BROKERS.slice(0,5).map((broker,i)=>({id:'broker-'+i,broker,name:'พอร์ตหลัก'}));
const accounts=()=>data.accounts||defaultAccounts();
const accountName=id=>{const a=accounts().find(a=>a.id===id);return a?a.broker+' · '+a.name:'ยังไม่ระบุพอร์ต'};
const accountMatches=r=>$('#account-filter').value==='all'||(r.accountId||'unassigned')===$('#account-filter').value;
function validAccounts(x){const list=x.accounts||defaultAccounts();return Array.isArray(list)&&list.length<=100&&list.every((a,i)=>a&&typeof a.id==='string'&&a.id.length>0&&a.id.length<=100&&a.id!=='all'&&a.id!=='unassigned'&&list.findIndex(b=>b.id===a.id)===i&&BROKERS.includes(a.broker)&&typeof a.name==='string'&&a.name.trim().length>0&&a.name.length<=60)&&[...x.trades,...x.holdings].every(r=>r.accountId==null||r.accountId==='unassigned'||list.some(a=>a.id===r.accountId))}
function renderAccounts(){const filter=$('#account-filter'),previous=filter.value||'all';filter.innerHTML='<option value="all">ทุกพอร์ต</option><option value="unassigned">ยังไม่ระบุพอร์ต</option>'+accounts().map(a=>'<option value="'+esc(a.id)+'">'+esc(a.broker+' · '+a.name)+'</option>').join('');filter.value=previous==='all'||previous==='unassigned'||accounts().some(a=>a.id===previous)?previous:'all'}
function accountField(value){return '<label>โบรกเกอร์ / พอร์ต<select name="accountId"><option value="unassigned">ยังไม่ระบุพอร์ต</option>'+accounts().map(a=>'<option value="'+esc(a.id)+'" '+(a.id===value?'selected':'')+'>'+esc(a.broker+' · '+a.name)+'</option>').join('')+'</select></label>'}
const money=(n,unit=currency)=>Number(n).toLocaleString('en-US',{minimumFractionDigits:unit==='BTC'?8:2,maximumFractionDigits:unit==='BTC'?8:2});
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const date=()=>{const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`};
const pnl=t=>t.exit==null?null:(t.asset==='BTCUSD'?(1/t.entry-1/t.exit):(t.exit-t.entry))*t.quantity*t.multiplier*(t.side==='Short'?-1:1)-t.fee;
const strategyMatches=r=>$('#strategy-filter').value==='all'||(r.strategy||'ทั่วไป')===$('#strategy-filter').value;
const tradeMatches=t=>strategyMatches(t)&&($('#direction-filter').value==='all'||t.side===$('#direction-filter').value)&&($('#contract-filter').value==='all'||(t.asset==='BTCUSD'?'Inverse':'Linear')===$('#contract-filter').value);

function toast(s){$('#toast').textContent=s;$('#toast').style.display='block';clearTimeout(toast.timer);toast.timer=setTimeout(()=>$('#toast').style.display='none',3500)}
function validBase(x){return x&&Array.isArray(x.trades)&&Array.isArray(x.holdings)&&x.trades.length+x.holdings.length<=10000&&validAccounts(x)&&[...x.trades,...x.holdings].every(r=>r.strategy==null||['ทั่วไป','Grid','Rebalance'].includes(r.strategy))&&[...x.trades,...x.holdings].every((r,i,a)=>r&&typeof r.id==='string'&&a.findIndex(v=>v.id===r.id)===i&&typeof r.note==='string'&&r.note.length<=3000&&currencies.includes(r.currency)&&/^\d{4}-\d{2}-\d{2}$/.test(r.date)&&Number.isFinite(r.quantity)&&r.quantity>0&&Number.isFinite(r.fee)&&r.fee>=0)&&x.trades.every(r=>['XAUUSD','BTCUSDT','BTCUSD'].includes(r.asset)&&r.currency===(r.asset==='XAUUSD'?'USD':r.asset==='BTCUSD'?'BTC':'USDT')&&['Long','Short'].includes(r.side)&&Number.isFinite(r.entry)&&r.entry>0&&Number.isFinite(r.multiplier)&&r.multiplier>0&&(r.exit===null||Number.isFinite(r.exit)&&r.exit>0)&&(r.exit===null||/^\d{4}-\d{2}-\d{2}$/.test(r.closeDate)&&r.closeDate>=r.date)&&Number.isFinite(pnl(r)??0))&&x.holdings.every(r=>['หุ้นไทย','ทองคำแท่ง','บิทคอยน์'].includes(r.asset)&&typeof r.symbol==='string'&&r.symbol.length<=30&&Number.isFinite(r.cost)&&r.cost>0&&Number.isFinite(r.current)&&r.current>=0&&Number.isFinite(r.current*r.quantity)&&Number.isFinite(r.cost*r.quantity+r.fee))}
function valid(x){try{return validBase(x)&&LittleCore.validExtra(x)}catch{return false}}
let cloud=null,cloudUser=null,cloudRevision=0,cloudReady=false,cloudBusy=false,cloudGeneration=0;
function cloudStatus(message){$('#cloud-status').textContent=message}
function resetCloudUser(user){
  cloudGeneration++;cloudUser=user;cloudRevision=0;cloudReady=false;
  data={trades:[],holdings:[]};$('#editor').close();$('#account-dialog').close();$('#feature-dialog').close();$('#journal-dialog').close();render();
  $('#app-shell').hidden=!user;$('#auth-screen').hidden=!!user;
  $('#account-email').textContent=user?.email||'';
}
async function loadCloud(){
  if(!cloudUser||cloudBusy)return;
  const userId=cloudUser.id,generation=cloudGeneration;cloudReady=false;cloudBusy=true;
  $('#sync').disabled=true;cloudStatus('กำลังโหลดข้อมูล…');
  try{
    const {data:row,error}=await cloud.from('littleapp_journals').select('payload,revision').eq('user_id',userId).maybeSingle();
    if(generation!==cloudGeneration)return;
    if(error)throw error;
    const next=row?.payload||{trades:[],holdings:[]};
    if(!valid(next))throw Error('INVALID_DATA');
    data=next;cloudRevision=row?.revision||0;cloudReady=true;render();
    cloudStatus('โหลดข้อมูลแล้ว · '+new Date().toLocaleTimeString('th-TH'));
  }catch{
    if(generation===cloudGeneration){cloudStatus('โหลดไม่สำเร็จ · ตรวจอินเทอร์เน็ตและการสร้างตาราง แล้วกดโหลดข้อมูลล่าสุด');toast('ยังโหลดข้อมูลไม่สำเร็จ จึงยังแก้ไขไม่ได้')}
  }finally{cloudBusy=false;$('#sync').disabled=false;}
}
async function save(next){
  next={...next,accounts:next.accounts||defaultAccounts()};
  if(!cloudUser||!cloudReady||cloudBusy){toast('กรุณาโหลดข้อมูลให้สำเร็จก่อนบันทึก');return false}
  if(!valid(next)){toast('ข้อมูลไม่ถูกต้อง หรือมีรายการขายเกินจำนวนที่ถือ');return false}
  if(new TextEncoder().encode(JSON.stringify(next)).length>8000000){toast('ข้อมูลเกิน 8 MB กรุณาสำรองข้อมูลแล้วลดภาพแนบ');return false}
  const generation=cloudGeneration;cloudBusy=true;
  $('#entry-form').inert=true;$('#app-shell').inert=true;cloudStatus('กำลังบันทึก…');
  try{
    const {data:revision,error}=await cloud.rpc('littleapp_save',{p_payload:next,p_revision:cloudRevision});
    if(generation!==cloudGeneration)return false;
    if(error)throw error;
    if(!Number.isInteger(revision))throw Error('INVALID_REVISION');
    cloudRevision=revision;data=next;render();cloudStatus('บันทึกออนไลน์แล้ว · '+new Date().toLocaleTimeString('th-TH'));return true;
  }catch(error){
    if(generation===cloudGeneration){
      // A failed response can still mean a committed write. Require a fresh read before retrying.
      cloudReady=false;
      const conflict=String(error.message).includes('REVISION_CONFLICT');
      const message=conflict?'มีการแก้ไขจากอุปกรณ์อื่น กรุณาคัดลอกข้อความที่ยังไม่บันทึก แล้วปิดฟอร์มและโหลดข้อมูลล่าสุด':'ยืนยันการบันทึกไม่ได้ กรุณาคัดลอกข้อความที่ยังไม่บันทึก แล้วปิดฟอร์มและโหลดข้อมูลล่าสุดเพื่อตรวจสอบ';
      $('#form-error').textContent=message;cloudStatus(message);toast('ยังไม่ยืนยันว่าบันทึกสำเร็จ');
    }
    return false;
  }finally{cloudBusy=false;$('#entry-form').inert=false;$('#app-shell').inert=false;}
}
async function initCloud(){
  const config=window.LITTLEAPP_CONFIG||{};
  if(!/^https:\/\/[^/]+\.supabase\.co\/?$/.test(config.supabaseUrl||'')||!config.supabasePublishableKey){
    $('#auth-message').textContent='ยังไม่ได้ตั้งค่าการเชื่อมต่อ กรุณาใส่ Project URL และ Publishable key ใน config.js แล้ว deploy ใหม่';
    $('#auth-form').querySelectorAll('button').forEach(b=>b.disabled=true);return;
  }
  if(!window.supabase){$('#auth-message').textContent='โหลดระบบเชื่อมต่อไม่ได้ กรุณาตรวจอินเทอร์เน็ตแล้วรีเฟรชหน้า';return}
  cloud=window.supabase.createClient(config.supabaseUrl,config.supabasePublishableKey);
  let authSequence=0;
  cloud.auth.onAuthStateChange((event,session)=>{
    // Do not call other Supabase APIs inside the auth callback lock.
    const sequence=++authSequence;
    setTimeout(async()=>{
      if(sequence!==authSequence)return;
      const user=session?.user||null;
      if(user?.id===cloudUser?.id)return;
      resetCloudUser(user);if(user)await loadCloud();
    },0);
  });
  const {data:sessionData,error}=await cloud.auth.getSession();
  if(error){$('#auth-message').textContent='อ่านสถานะเข้าสู่ระบบไม่สำเร็จ กรุณารีเฟรชหน้า';return}
  if(sessionData.session?.user&&!cloudUser){resetCloudUser(sessionData.session.user);await loadCloud()}
  async function authenticate(signup){
    if(!$('#auth-form').reportValidity())return;
    const email=$('#auth-email').value.trim(),password=$('#auth-password').value;
    $('#auth-form').querySelectorAll('button').forEach(b=>b.disabled=true);
    $('#auth-message').textContent=signup?'กำลังสมัครบัญชี…':'กำลังเข้าสู่ระบบ…';
    try{
      const result=signup?await cloud.auth.signUp({email,password}):await cloud.auth.signInWithPassword({email,password});
      if(result.error)throw result.error;
      $('#auth-password').value='';
      $('#auth-message').textContent=signup?'หากสมัครได้ ระบบจะส่งอีเมลให้ยืนยัน จากนั้นกลับมาเข้าสู่ระบบ หากไม่พบอีเมลให้ตรวจโฟลเดอร์สแปม หรือใช้บัญชีที่สร้างไว้แล้ว':'เข้าสู่ระบบแล้ว';
    }catch(error){
      const code=error.code||'';
      $('#auth-message').textContent=code==='email_not_confirmed'?'กรุณายืนยันอีเมลก่อนเข้าสู่ระบบ':code==='over_email_send_rate_limit'?'ส่งอีเมลเกินโควตาชั่วคราว กรุณารอแล้วลองใหม่':signup?'สมัครไม่สำเร็จ ตรวจการเปิดสมัครบัญชีและนโยบายรหัสผ่านใน Supabase':'เข้าสู่ระบบไม่สำเร็จ ตรวจอีเมล รหัสผ่าน และการเชื่อมต่อ';
    }finally{$('#auth-form').querySelectorAll('button').forEach(b=>b.disabled=false)}
  }
  $('#auth-form').onsubmit=e=>{e.preventDefault();authenticate(false)};
  $('#signup').onclick=()=>authenticate(true);
  $('#signout').onclick=async()=>{
    if(cloudBusy)return;$('#signout').disabled=true;
    try{const {error}=await cloud.auth.signOut({scope:'local'});if(error)throw error;resetCloudUser(null);$('#auth-message').textContent='ออกจากระบบแล้ว'}
    catch{toast('ออกจากระบบไม่สำเร็จ กรุณาลองอีกครั้ง')}
    finally{$('#signout').disabled=false}
  };
  $('#sync').onclick=()=>loadCloud();
}

function stat(label,value,unit,sub,icon){return `<article class="stat"><div class="stat-label">${label}<span>${icon}</span></div><strong>${value}<em>${unit}</em></strong><small>${sub}</small></article>`}
function render(){renderAccounts();const ts=data.trades.filter(t=>t.currency===currency&&accountMatches(t)&&tradeMatches(t)),closed=ts.filter(t=>t.exit!==null),hs=LittleCore.ledger(data).positions.filter(p=>p.quantity>0).filter(h=>h.currency===currency&&accountMatches(h)&&strategyMatches(h));const total=closed.reduce((n,t)=>n+pnl(t),0),wins=closed.filter(t=>pnl(t)>0).length,cost=hs.reduce((n,h)=>n+h.quantity*h.cost+h.fee,0),value=hs.reduce((n,h)=>n+h.quantity*h.current,0);
 $('#stats').innerHTML=view==='portfolio'?stat('มูลค่าพอร์ต',money(value),currency,'ตามราคาล่าสุดที่คุณกรอก','◈')+stat('ต้นทุนรวม',money(cost),currency,'รวมค่าธรรมเนียมซื้อ','▤')+stat('กำไร / ขาดทุนที่ยังไม่ขาย',money(value-cost),currency,'ไม่รวมค่าธรรมเนียมขาย','↗')+stat('รายการสะสม',hs.length,'รายการ','สินทรัพย์ที่ถือครอง','◎'):stat('กำไร / ขาดทุนสุทธิ',money(total),currency,'รายการปิดแล้ว · หักค่าธรรมเนียม','↗')+stat('อัตราชนะ',closed.length?money(wins/closed.length*100,'USD'):'—','%',`${wins} ชนะ จาก ${closed.length} รายการที่ปิดแล้ว`,'◎')+stat('การเทรดทั้งหมด',ts.length,'รายการ',`${ts.length-closed.length} เปิดอยู่ · ${closed.length} ปิดแล้ว`,'⇄')+stat('มูลค่าพอร์ตสะสม',money(value),currency,`${hs.length} รายการ · ตามราคาที่กรอก`,'◈');
 $('#overview').hidden=view!=='overview';$('#direction-label').hidden=view==='portfolio';$('#contract-label').hidden=view==='portfolio';$('#filter').hidden=view==='portfolio';$('#table-title').textContent=view==='portfolio'?'สินทรัพย์ที่ถือครอง':view==='journal'?'สมุดบันทึกการเทรด':'บันทึกการเทรดล่าสุด';$('#table-subtitle').textContent=view==='portfolio'?'บันทึกแต่ละรายการซื้อ และอัปเดตราคาประเมินได้ด้วยปุ่มแก้ไข':'ทบทวนทุกการตัดสินใจ เพื่อการเทรดครั้งต่อไป';
 renderChart(closed);const groups={};hs.forEach(h=>groups[h.asset]=(groups[h.asset]||0)+h.quantity*h.cost+h.fee);$('#allocation').innerHTML=cost?Object.entries(groups).map(([k,n])=>`<div class="allocation-row"><div><span>${esc(k)}</span><b>${money(n/cost*100,'USD')}%</b></div><div class="track"><i style="width:${n/cost*100}%"></i></div></div>`).join(''):`<div class="empty-portfolio"><div class="empty-symbol">◈</div><h2>เริ่มสะสมอนาคตของคุณ</h2><p>ยังไม่มีสินทรัพย์ในสกุล ${currency}</p></div>`;
 let rows=view==='portfolio'?hs:ts.filter(t=>$('#filter').value==='all'||t.asset===$('#filter').value);rows=[...rows].sort((a,b)=>b.date.localeCompare(a.date));if(view==='overview')rows=rows.slice(0,5);
 if(!rows.length){$('#records').innerHTML=`<div class="empty">${view==='portfolio'?'ยังไม่มีรายการสะสม':'ยังไม่มีบันทึกการเทรด'}ในสกุล ${currency}<p>เริ่มจากรายการแรก แล้วกลับมาทบทวนได้ทุกเมื่อ</p><button class="primary" id="empty-add">＋ ${view==='portfolio'?'เพิ่มสินทรัพย์':'บันทึกการเทรด'}</button></div>`;$('#empty-add').onclick=()=>openEditor();return}
 const portfolio=view==='portfolio';$('#records').innerHTML=`<div class="table-wrap"><table><thead><tr><th>สินทรัพย์ / วันที่</th>${portfolio?'<th>จำนวน</th><th>ต้นทุน / หน่วย</th><th>ราคาประเมิน / หน่วย</th><th>มูลค่า / กำไรขาดทุน</th>':'<th>ทิศทาง</th><th>ราคาเข้า → ออก</th><th>จำนวน × ตัวคูณ</th><th>กำไร / ขาดทุนสุทธิ</th>'}<th></th></tr></thead><tbody>${rows.map(r=>{const profit=portfolio?r.quantity*(r.current-r.cost)-r.fee:pnl(r);return `<tr><td><div class="asset-cell"><span class="coin ${r.asset.includes('BTC')||r.asset==='บิทคอยน์'?'btc':''}">${r.asset.includes('BTC')||r.asset==='บิทคอยน์'?'₿':r.asset==='หุ้นไทย'?'S':'Au'}</span><div><b>${esc(portfolio?r.symbol:r.asset)}</b><br><small class="muted">${esc(accountName(r.accountId))}<br>${esc(r.strategy||'ทั่วไป')}${!portfolio?' · '+(r.asset==='BTCUSD'?'Inverse':'Linear'):''}<br>${esc(r.date)}${portfolio?' · '+esc(r.asset):''}</small></div></div></td>${portfolio?`<td>${r.quantity.toLocaleString('en-US',{maximumFractionDigits:8})}</td><td>${money(r.cost)}</td><td>${money(r.current)}</td><td>${money(r.current*r.quantity)}<br><small class="${profit>=0?'positive':'negative'}">${profit>=0?'+':''}${money(profit)}</small></td>`:`<td><span class="badge ${r.side==='Short'?'short':''}">${r.side}</span></td><td>${money(r.entry,r.asset==='BTCUSD'?'USD':r.currency)} <span class="muted">→</span> ${r.exit===null?'—':money(r.exit,r.asset==='BTCUSD'?'USD':r.currency)}</td><td>${r.quantity} × ${r.multiplier}</td><td class="${profit===null?'muted':profit>=0?'positive':'negative'}">${profit===null?'เปิดอยู่':(profit>=0?'+':'')+money(profit)}</td>`}<td><button class="row-action" data-edit="${esc(r.id)}">แก้ไข</button><button class="row-action" data-delete="${esc(r.id)}">ลบ</button></td></tr>${r.note?`<tr class="note-row"><td colspan="6">↳ ${esc(r.note)}</td></tr>`:''}`}).join('')}</tbody></table></div>${portfolio?'<p class="portfolio-note">จำนวน: หุ้นไทยเป็นหุ้น · ทองคำแท่งเป็นบาททองคำ · บิทคอยน์เป็น BTC</p>':''}`;
 $$('[data-edit]').forEach(b=>b.onclick=()=>openEditor(b.dataset.edit));$$('[data-delete]').forEach(b=>b.onclick=async()=>{if(confirm('ลบรายการนี้พร้อมแผนที่เชื่อม (ถ้ามี) หรือไม่?')){const k=portfolio?'holdings':'trades';if(await save({...data,[k]:data[k].filter(r=>r.id!==b.dataset.delete),plans:portfolio?(data.plans||[]):(data.plans||[]).filter(p=>p.id!==data.trades.find(t=>t.id===b.dataset.delete)?.planId)}))toast('ลบรายการแล้ว')}});
}
function renderChart(closed){if(!closed.length){$('#chart').innerHTML='<div class="chart-empty"><strong>การเดินทางเริ่มที่การจดบันทึก</strong><p>ปิดการเทรดรายการแรก เพื่อเริ่มดูผลสะสม</p></div>';return}let sum=0;const vals=[0,...[...closed].sort((a,b)=>a.closeDate.localeCompare(b.closeDate)).map(t=>sum+=pnl(t))],min=Math.min(...vals),max=Math.max(...vals),range=max-min||1;const pts=vals.map((v,i)=>[70+i/(vals.length-1)*500,185-(v-min)/range*150]);$('#chart').innerHTML=`<svg viewBox="0 0 590 220" role="img" aria-label="กำไรสะสม ${money(sum)} ${currency}">${[0,.5,1].map(f=>`<line x1="70" x2="570" y1="${185-f*150}" y2="${185-f*150}" stroke="#edf0e9"/><text x="62" y="${190-f*150}" text-anchor="end" fill="#929d8b" font-size="11">${money(min+f*range)}</text>`).join('')}<path d="M${pts.map(p=>p.join(',')).join(' L')} L570,185 L70,185Z" fill="#edf5e5"/><polyline points="${pts.map(p=>p.join(',')).join(' ')}" fill="none" stroke="#84a666" stroke-width="2.5"/><text x="70" y="213" fill="#929d8b" font-size="11">เริ่มต้น</text><text x="570" y="213" text-anchor="end" fill="#929d8b" font-size="11">${closed.length} รายการปิดแล้ว</text></svg>`}
function switchView(v){view=v;$$('nav button').forEach(b=>b.classList.toggle('active',b.dataset.view===v));$('#breadcrumb').textContent=v==='portfolio'?'พอร์ตสะสม':v==='journal'?'บันทึกการเทรด':'ภาพรวม';$('#page-title').textContent=v==='portfolio'?'สะสมวันนี้ เพื่อวันข้างหน้า.':v==='journal'?'ทุกการตัดสินใจ ควรได้ทบทวน.':'ทุกการเทรด มีเรื่องให้เรียนรู้.';$('#page-subtitle').textContent=v==='portfolio'?'หุ้นไทย ทองคำแท่ง และบิทคอยน์ ในพื้นที่เดียวกัน':'จดบันทึก ทบทวน และเติบโตไปกับพอร์ตของคุณ';$('#add').textContent=v==='portfolio'?'＋ เพิ่มสินทรัพย์':'＋ บันทึกการเทรด';render()}
function field(label,name,type,value,extra=''){return `<label>${label}<input name="${name}" type="${type}" value="${esc(value)}" ${extra}></label>`}
function select(label,name,options,value){return `<label>${label}<select name="${name}">${options.map(o=>`<option ${o===value?'selected':''}>${o}</option>`).join('')}</select></label>`}
function openEditor(id){if(!cloudUser||!cloudReady||cloudBusy){toast('กรุณารอโหลดข้อมูลให้สำเร็จก่อน');return}editing=id||null;const portfolio=view==='portfolio',r=(portfolio?data.holdings:data.trades).find(r=>r.id===id)||{};$('#form-title').textContent=(id?'แก้ไข':'บันทึก')+(portfolio?'สินทรัพย์สะสม':'การเทรด');$('#fields').innerHTML=accountField(r.accountId||($('#account-filter').value==='all'?'unassigned':$('#account-filter').value))+select('กลยุทธ์','strategy',['ทั่วไป','Grid','Rebalance'],r.strategy||($('#strategy-filter').value==='all'?'ทั่วไป':$('#strategy-filter').value))+select('สินทรัพย์','asset',portfolio?['หุ้นไทย','ทองคำแท่ง','บิทคอยน์']:['XAUUSD','BTCUSDT','BTCUSD'],r.asset||(currency==='BTC'?'BTCUSD':currency==='USDT'?'BTCUSDT':'XAUUSD'))+field(portfolio?'วันที่ซื้อ':'วันที่เปิด','date','date',r.date||date(),'required')+(portfolio?field('ชื่อหุ้น / สินทรัพย์','symbol','text',r.symbol||'','required maxlength="30" placeholder="เช่น PTT, ทองคำ 96.5%, BTC"')+select('สกุลเงิน','currency',currencies,r.currency||'THB')+field('จำนวน (หุ้น / บาททองคำ / BTC)','quantity','number',r.quantity??'','required min="0.00000001" step="any"')+field('ราคาซื้อ / หน่วย','cost','number',r.cost??'','required min="0.00000001" step="any"')+field('ราคาประเมินล่าสุด / หน่วย','current','number',r.current??'','required min="0" step="any"'):select('ทิศทาง','side',['Long','Short'],r.side||($('#direction-filter').value==='Short'?'Short':'Long'))+field('จำนวน Lot / สัญญา','quantity','number',r.quantity??'','required min="0.00000001" step="any"')+field('ตัวคูณ: หน่วยต่อ Lot / สัญญา','multiplier','number',r.multiplier??1,'required min="0.00000001" step="any"')+field('ราคาเข้า','entry','number',r.entry??'','required min="0.00000001" step="any"')+field('ราคาออก (เว้นว่างถ้ายังเปิด)','exit','number',r.exit??'','min="0.00000001" step="any"')+field('วันที่ปิด','closeDate','date',r.closeDate||date()))+field('ค่าธรรมเนียมรวม (สกุลเดียวกับราคา)','fee','number',r.fee??0,'required min="0" step="any"');$('#entry-form').elements.note.value=r.note||'';$('#form-error').textContent='';$('#form-help').textContent=portfolio?'ราคาซื้อและราคาประเมินต้องใช้หน่วยและสกุลเงินเดียวกัน ข้อมูลนี้เป็นรายการสินทรัพย์ที่ยังถืออยู่':'กำไร = (ราคาออก − ราคาเข้า) × จำนวน × ตัวคูณ × ทิศทาง − ค่าธรรมเนียม · ตั้งตัวคูณให้ตรงกับสัญญาของโบรกเกอร์ เช่น 100 หาก 1 Lot เท่ากับ 100 ออนซ์ · XAUUSD ใช้ USD, BTCUSDT ใช้ USDT';updateContractHelp(portfolio);$('#entry-form').elements.asset.onchange=()=>updateContractHelp(portfolio);$('#editor').showModal()}
function updateContractHelp(portfolio){
  if(portfolio)return;
  const f=$('#entry-form'),inverse=f.elements.asset.value==='BTCUSD';
  const rename=(name,text)=>{const label=f.elements[name].parentElement;label.firstChild.textContent=text};
  rename('quantity',inverse?'จำนวนสัญญา':'จำนวน Lot / หน่วย');
  rename('multiplier',inverse?'มูลค่า USD ต่อสัญญา':'ตัวคูณ: หน่วยต่อ Lot');
  rename('fee',inverse?'ค่าธรรมเนียมรวม (BTC)':'ค่าธรรมเนียมรวม ('+(f.elements.asset.value==='XAUUSD'?'USD':'USDT')+')');
  $('#form-help').textContent=inverse?'BTCUSD เป็น Inverse Futures: กำไร BTC = จำนวน × USD ต่อสัญญา × (1/ราคาเข้า − 1/ราคาออก) × ทิศทาง − ค่าธรรมเนียม BTC; Long = +1, Short = −1 ราคากรอกเป็น USD/BTC ตั้งมูลค่าสัญญาให้ตรงกับโบรกเกอร์ รวม funding ในค่าธรรมเนียมเอง':'Linear: กำไร = (ราคาออก − ราคาเข้า) × จำนวน × ตัวคูณ × ทิศทาง − ค่าธรรมเนียม ตั้งตัวคูณตามโบรกเกอร์; XAUUSD ชำระ USD, BTCUSDT ชำระ USDT กลยุทธ์ Grid/Rebalance ใช้จัดกลุ่มรายการที่กรอกเอง';
}
$('#entry-form').onsubmit=async e=>{e.preventDefault();const f=new FormData(e.target),r=Object.fromEntries(f),portfolio=view==='portfolio';r.id=editing||crypto.randomUUID();['quantity','fee',...(portfolio?['cost','current']:['entry','multiplier'])].forEach(k=>r[k]=Number(r[k]));if(!portfolio){r.exit=r.exit===''?null:Number(r.exit);r.currency=r.asset==='XAUUSD'?'USD':r.asset==='BTCUSD'?'BTC':'USDT';if(r.exit!==null&&r.closeDate<r.date){$('#form-error').textContent='วันที่ปิดต้องไม่ก่อนวันที่เปิด';return}}const k=portfolio?'holdings':'trades',next={...data,[k]:editing?data[k].map(t=>t.id===editing?r:t):[...data[k],r]};if(!valid(next)){$('#form-error').textContent='กรุณาตรวจสอบข้อมูลและขนาดตัวเลขให้ถูกต้อง';return}if(await save(next)){currency=r.currency;$$('[data-currency]').forEach(b=>b.classList.toggle('selected',b.dataset.currency===currency));$('#filter').value='all';render();$('#editor').close();toast('บันทึกเรียบร้อยแล้ว')}};
$$('[data-view]').forEach(b=>b.onclick=()=>switchView(b.dataset.view));$$('[data-currency]').forEach(b=>b.onclick=()=>{currency=b.dataset.currency;$$('[data-currency]').forEach(x=>x.classList.toggle('selected',x===b));render()});$('#add').onclick=()=>openEditor();$('#filter').onchange=render;$('#close').onclick=$('#cancel').onclick=()=>$('#editor').close();$('#backup').onclick=()=>{const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`LittleApp-backup-${date()}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);toast('ส่งออกไฟล์สำรองแล้ว')};$('#restore').onchange=async e=>{try{const file=e.target.files[0];if(!file)return;if(file.size>10000000)throw Error();const next=JSON.parse(await file.text());if(!valid(next))throw Error();if(confirm(`นำเข้า ${next.trades.length} การเทรด และ ${next.holdings.length} รายการสะสม? ข้อมูลปัจจุบันจะถูกแทนที่`)&&await save(next)){$('#add').disabled=false;toast('นำเข้าข้อมูลเรียบร้อย')}}catch{toast('ไฟล์ไม่ถูกต้อง กรุณาใช้ไฟล์สำรองจาก LittleApp')}finally{e.target.value=''}};$('#today').textContent=new Intl.DateTimeFormat('th-TH',{day:'numeric',month:'long',year:'numeric'}).format(new Date());render();


$('#account-filter').onchange=render;$('#strategy-filter').onchange=render;$('#direction-filter').onchange=render;$('#contract-filter').onchange=render;
$('#manage-accounts').onclick=()=>{
  if(!cloudReady||cloudBusy){toast('กรุณาโหลดข้อมูลก่อนจัดการพอร์ต');return}
  $('#account-picker').innerHTML='<option value="new">สร้างพอร์ตใหม่</option>'+accounts().map(a=>'<option value="'+esc(a.id)+'">'+esc(a.broker+' · '+a.name)+'</option>').join('');
  $('#account-name').value='';$('#account-broker').value='Exness';$('#account-error').textContent='';$('#account-dialog').showModal();
};
$('#account-picker').onchange=()=>{const a=accounts().find(a=>a.id===$('#account-picker').value);$('#account-name').value=a?.name||'';$('#account-broker').value=a?.broker||'Exness'};
$('#account-close').onclick=()=>$('#account-dialog').close();
$('#account-form').onsubmit=async e=>{
  e.preventDefault();const list=accounts(),id=$('#account-picker').value,name=$('#account-name').value.trim(),broker=$('#account-broker').value;
  if(!name){$('#account-error').textContent='กรุณาระบุชื่อพอร์ต';return}
  if(list.some(a=>a.id!==id&&a.name.toLowerCase()===name.toLowerCase()&&a.broker===broker)){$('#account-error').textContent='มีชื่อพอร์ตนี้ในโบรกเกอร์เดียวกันแล้ว';return}
  const item={id:id==='new'?crypto.randomUUID():id,broker,name};
  $('#account-form').inert=true;
  try{if(await save({...data,accounts:id==='new'?[...list,item]:list.map(a=>a.id===id?item:a)})){$('#account-dialog').close();toast('บันทึกพอร์ตแล้ว')}else{$('#account-error').textContent='ยังบันทึกไม่ได้ ปิดหน้าต่างแล้วโหลดข้อมูลล่าสุดก่อนลองใหม่'}}finally{$('#account-form').inert=false}
};
initCloud();

