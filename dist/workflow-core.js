const WorkflowCore=(()=>{
 const keys=['accounts','trades','holdings','plans','reviews','spotTransactions','spotQuotes','cashFlows','equitySnapshots'];
 const identity=(key,r)=>key==='spotQuotes'?r.key:r.id;
 const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
 function audit(before,after,id,time){
  const changes=[];
  for(const key of keys){const a=new Map((before[key]||[]).map(r=>[identity(key,r),r])),b=new Map((after[key]||[]).map(r=>[identity(key,r),r]));for(const rid of new Set([...a.keys(),...b.keys()])){const prev=a.get(rid)||null,next=b.get(rid)||null;if(!same(prev,next))changes.push({key,id:rid,before:prev,after:next})}}
  const history=[...(before.history||[])];if(changes.length)history.push({id,time,changes});
  // Bounded undo log, independently included in the existing payload size cap.
  while(history.length>30||new TextEncoder().encode(JSON.stringify(history)).length>2000000)history.shift();
  return {...after,history};
 }
 function restore(d,id){
  const batch=(d.history||[]).find(r=>r.id===id);if(!batch)throw Error('ประวัตินี้หมดอายุแล้ว');
  const next={...d};for(const c of batch.changes){const rows=next[c.key]||[],current=rows.find(r=>identity(c.key,r)===c.id)||null;if(!same(current,c.after))throw Error('รายการนี้มีการแก้ไขภายหลัง ต้องย้อนรายการล่าสุดก่อน');next[c.key]=c.before?[...rows.filter(r=>identity(c.key,r)!==c.id),c.before]:rows.filter(r=>identity(c.key,r)!==c.id)}return next;
 }
 function validHistory(d){return d.history==null||Array.isArray(d.history)&&d.history.length<=30&&d.history.every(h=>h&&typeof h.id==='string'&&typeof h.time==='string'&&Array.isArray(h.changes)&&h.changes.length<=10000&&h.changes.every(c=>c&&keys.includes(c.key)&&typeof c.id==='string'&&[c.before,c.after].every(r=>r===null||r&&typeof r==='object'&&!Array.isArray(r)&&identity(c.key,r)===c.id)))}
 function transfer(d,f,id){
  if(f.from===f.to)throw Error('เลือกพอร์ตต้นทางและปลายทางต่างกัน');
  const common={time:f.time,currency:f.currency,amount:Number(f.amount),note:f.note||'',transferId:id};
  const next={...d,cashFlows:[...(d.cashFlows||[]),{...common,id:id+'-out',accountId:f.from,type:'withdrawal'},{...common,id:id+'-in',accountId:f.to,type:'deposit'}]};
  if(!CapitalCore.validate(next))throw Error('ตรวจพอร์ต สกุลเงิน จำนวน และเวลา');return next;
 }
 function validTransfers(d){const map=new Map();for(const r of d.cashFlows||[]){if(r.transferId==null)continue;if(typeof r.transferId!=='string'||!r.transferId)return false;const rows=map.get(r.transferId)||[];rows.push(r);map.set(r.transferId,rows)}return [...map.values()].every(rows=>rows.length===2&&rows[0].type!==rows[1].type&&rows[0].accountId!==rows[1].accountId&&rows[0].amount===rows[1].amount&&rows[0].currency===rows[1].currency&&rows[0].time===rows[1].time)}
 function reconcile(d,accountId,currency){
  const points=(d.equitySnapshots||[]).filter(r=>r.accountId===accountId&&r.currency===currency&&r.balance!==null&&r.time.endsWith('T23:59:59')).sort((a,b)=>a.time.localeCompare(b.time));
  if(points.length<2)return null;const [a,b]=points.slice(-2),start=a.time.slice(0,10),end=b.time.slice(0,10);
  const flow=(d.cashFlows||[]).filter(r=>r.accountId===accountId&&r.currency===currency&&r.time>a.time&&r.time<=b.time).reduce((s,r)=>s+(r.type==='deposit'?r.amount:-r.amount),0);
  const matches=r=>r.accountId===accountId&&r.currency===currency;
  if((d.spotTransactions||[]).some(r=>matches(r)&&r.date>start&&r.date<=end))throw Error('ช่วงนี้มีซื้อขาย Spot การตรวจ Balance รุ่นนี้รองรับบัญชี Futures เท่านั้น');
  const profit=d.trades.filter(matches).flatMap(FuturesCore.events).filter(r=>r.date>start&&r.date<=end).reduce((s,r)=>s+r.profit,0);
  return {start,end,opening:a.balance,actual:b.balance,flow,profit,expected:a.balance+flow+profit,difference:b.balance-a.balance-flow-profit};
 }
 function csv(text){
  if(text.length>1000000)throw Error('CSV ต้องไม่เกิน 1 MB');
  text=text.replace(/^\uFEFF/,'');const rows=[];let row=[],value='',quoted=false,ended=false;
  for(let i=0;i<text.length;i++){const c=text[i];if(quoted){if(c==='"'){if(text[i+1]==='"'){value+='"';i++}else{quoted=false;ended=true}}else value+=c}
   else if(c===','||c==='\n'||c==='\r'){row.push(value);value='';ended=false;if(c!==','){if(c==='\r'&&text[i+1]==='\n')i++;if(row.some(v=>v!==''))rows.push(row);row=[]}}
   else if(c==='"'){if(value||ended)throw Error('รูปแบบเครื่องหมายคำพูด CSV ไม่ถูกต้อง');quoted=true}
   else {if(ended)throw Error('มีข้อความหลังปิดเครื่องหมายคำพูด');value+=c}
  }
  if(quoted)throw Error('CSV มีเครื่องหมายคำพูดไม่ครบ');row.push(value);if(row.some(v=>v!==''))rows.push(row);
  if(rows.length<2||rows.length>501)throw Error('ไฟล์ต้องมีหัวตารางและข้อมูล 1–500 แถว');const headers=rows.shift().map(s=>s.trim());if(headers.some(s=>!s)||new Set(headers).size!==headers.length)throw Error('หัวตารางว่างหรือซ้ำ');
  return rows.map((r,i)=>{if(r.length!==headers.length)throw Error('จำนวนคอลัมน์ไม่ตรงที่แถว '+(i+2));return Object.fromEntries(headers.map((h,j)=>[h,r[j]]))});
 }
 const fingerprint=r=>JSON.stringify([r.accountId,r.asset,r.side,r.date,r.entry,r.exit,r.closeDate,r.quantity,r.multiplier,r.fee,r.funding||0]);
 function importTrades(d,text,accountId,id){
  const source=csv(text),rows=[],issues=[],seen=new Set(d.trades.map(fingerprint)),external=new Set(d.trades.filter(r=>r.accountId===accountId&&r.importRef).map(r=>r.importRef));let duplicates=0;
  for(const [i,f] of source.entries()){
   try{
    for(const k of ['asset','side','date','entry','quantity'])if(!f[k]?.trim())throw Error('ขาด '+k);
    for(const k of Object.keys(f))if(!['reference','asset','side','date','entry','quantity','multiplier','exit','closeDate','fee','funding','note'].includes(k))throw Error('ไม่รองรับคอลัมน์ '+k);
    const r={id:id(),accountId,asset:f.asset.trim(),side:f.side.trim(),date:f.date.trim(),entry:Number(f.entry),quantity:Number(f.quantity),multiplier:Number(f.multiplier||1),exit:f.exit?.trim()?Number(f.exit):null,closeDate:f.closeDate?.trim()||f.date.trim(),fee:Number(f.fee||0),funding:Number(f.funding||0),note:f.note||'',strategy:'ทั่วไป',currency:JournalCore.unit(f.asset.trim())};
    const fixed=JournalCore.fixedMultiplier(d,accountId,r.asset);if(fixed!==null){if(f.multiplier?.trim()&&Number(f.multiplier)!==fixed)throw Error('XAUUSD ของ Exness ต้องใช้ตัวคูณ 100');r.multiplier=fixed}
    if(!['XAUUSD','BTCUSDT','BTCUSD'].includes(r.asset)||!['Long','Short'].includes(r.side)||!LittleCore.day(r.date)||!LittleCore.day(r.closeDate)||r.exit!==null&&r.closeDate<r.date||![r.entry,r.quantity,r.multiplier].every(n=>Number.isFinite(n)&&n>0)||!Number.isFinite(r.fee)||r.fee<0||!Number.isFinite(r.funding)||r.exit!==null&&(!Number.isFinite(r.exit)||r.exit<=0)||r.note.length>3000||!Number.isFinite(FuturesCore.realized(r)??0))throw Error('ตรวจวันที่ สัญญา ราคา จำนวน และค่าธรรมเนียม');
    r.importRef=f.reference?.trim()||'';if(r.importRef.length>100)throw Error('reference ยาวเกิน 100 ตัวอักษร');
    const key=fingerprint(r);if(r.importRef?external.has(r.importRef):seen.has(key)){duplicates++;continue}
    seen.add(key);if(r.importRef)external.add(r.importRef);rows.push(r);
   }catch(e){issues.push('แถว '+(i+2)+': '+e.message)}
  }
  return {rows,issues,duplicates,next:{...d,trades:[...d.trades,...rows]}};
 }
 return {audit,restore,validHistory,transfer,validTransfers,reconcile,csv,importTrades};
})();
