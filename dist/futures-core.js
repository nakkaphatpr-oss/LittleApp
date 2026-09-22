const FuturesCore=(()=>{
 const finite=(n,min=0)=>Number.isFinite(n)&&n>=min;
 const day=s=>typeof s==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(s)&&Number.isFinite(Date.parse(s))&&new Date(s+'T00:00:00Z').toISOString().slice(0,10)===s;
 const tolerance=t=>Number.EPSILON*Math.max(t.quantity,1e-12)*16;
 const closedQuantity=t=>(t.closes||[]).reduce((s,c)=>s+c.quantity,0);
 function remaining(t){if(!t.closes?.length)return t.exit===null?t.quantity:0;const n=t.quantity-closedQuantity(t);return Math.abs(n)<=tolerance(t)?0:n}
 const gross=(t,price,quantity)=>(t.asset==='BTCUSD'?1/t.entry-1/price:price-t.entry)*quantity*t.multiplier*(t.side==='Short'?-1:1);
 function timeline(t){return [...(t.entries||[]).map(r=>({...r,kind:'entry'})),...(t.closes||[]).map((r,i)=>({...r,kind:'close',order:r.order??i+1}))].sort((a,b)=>a.date.localeCompare(b.date)||a.order-b.order)}
 function replay(t){
  let quantity=t.baseOpen.quantity,entry=t.baseOpen.entry,cost=t.fee+(t.funding||0);const rows=[];
  for(const r of timeline(t)){
   if(r.kind==='entry'){
    if(quantity<=tolerance(t))throw Error('ดีลปิดหมดแล้ว ต้องเปิดเป็นรายการใหม่');
    entry=t.asset==='BTCUSD'?(quantity+r.quantity)/(quantity/entry+r.quantity/r.price):(quantity*entry+r.quantity*r.price)/(quantity+r.quantity);
    quantity+=r.quantity;cost+=r.fee+r.funding;
   }else{
    if(r.quantity>quantity+tolerance(t))throw Error('ปิดเกินจำนวนที่ถือ ณ วันนั้น');
    const allocated=cost*r.quantity/quantity,profit=gross({...t,entry},r.price,r.quantity)-allocated-r.fee-r.funding;
    rows.push({...t,eventId:r.id,date:r.date,closeDate:r.date,exit:r.price,closedQuantity:r.quantity,profit,source:'Futures'});
    quantity-=r.quantity;cost-=allocated;if(Math.abs(quantity)<=tolerance(t)){quantity=0;cost=0}
   }
  }
  return {quantity,entry,cost,rows};
 }
 function events(t){
  if(t.baseOpen)return replay(t).rows;
  if(!t.closes?.length)return t.exit===null?[]:[{...t,date:t.closeDate,profit:gross(t,t.exit,t.quantity)-t.fee-(t.funding||0),source:'Futures'}];
  return [...t.closes].sort((a,b)=>a.date.localeCompare(b.date)||a.id.localeCompare(b.id)).map(c=>({...t,id:t.id,eventId:c.id,date:c.date,closeDate:c.date,exit:c.price,closedQuantity:c.quantity,profit:gross(t,c.price,c.quantity)-(t.fee+(t.funding||0))*c.quantity/t.quantity-c.fee-c.funding,source:'Futures'}));
 }
 function realized(t){const rows=events(t);return rows.length?rows.reduce((s,r)=>s+r.profit,0):null}
 function unrealized(t,price){const left=remaining(t);if(left<=0)return null;const s=t.baseOpen?replay(t):null;const result=s?gross({...t,entry:s.entry},price,s.quantity)-s.cost:gross(t,price,left)-(t.fee+(t.funding||0))*left/t.quantity;return Number.isFinite(result)?result:null}
 function sync(t){
  const left=remaining({...t,exit:null});
  if(!t.closes?.length||left>0)return {...t,exit:null};
  const total=closedQuantity(t),exit=t.asset==='BTCUSD'?total/t.closes.reduce((s,c)=>s+c.quantity/c.price,0):t.closes.reduce((s,c)=>s+c.quantity*c.price,0)/total;
  return {...t,exit,closeDate:t.closes.map(c=>c.date).sort().at(-1)};
 }
 function valid(t){
  try{
  if(t.baseOpen!=null||t.entries!=null){
   if(!t.baseOpen||!finite(t.baseOpen.quantity,Number.MIN_VALUE)||!finite(t.baseOpen.entry,Number.MIN_VALUE)||!Array.isArray(t.entries)||t.entries.length>1000||!Array.isArray(t.closes)||!t.closes.length&&t.exit!==null)return false;
   const ids=new Set(),orders=new Set();for(const r of [...t.entries,...(t.closes||[])]){if(!r||typeof r.id!=='string'||!r.id||r.id.length>100||ids.has(r.id)||!Number.isSafeInteger(r.order)||r.order<1||orders.has(r.order)||!day(r.date)||r.date<t.date||!finite(r.quantity,Number.MIN_VALUE)||!finite(r.price,Number.MIN_VALUE)||!finite(r.fee)||!Number.isFinite(r.funding)||typeof r.note!=='string'||r.note.length>3000)return false;ids.add(r.id);orders.add(r.order)}
   const total=t.baseOpen.quantity+t.entries.reduce((s,r)=>s+r.quantity,0),average=t.asset==='BTCUSD'?total/(t.baseOpen.quantity/t.baseOpen.entry+t.entries.reduce((s,r)=>s+r.quantity/r.price,0)):(t.baseOpen.quantity*t.baseOpen.entry+t.entries.reduce((s,r)=>s+r.quantity*r.price,0))/total;
   if(!Number.isFinite(total)||Math.abs(total-t.quantity)>tolerance(t)||Math.abs(average-t.entry)>Math.max(average,1)*1e-10)return false;
   const state=replay(t);if(![state.entry,state.cost,state.quantity,...state.rows.map(r=>r.profit)].every(Number.isFinite))return false;
  }
  if(t.closes==null)return true;
  if(!Array.isArray(t.closes)||t.closes.length>1000)return false;
  const ids=new Set();
  for(const c of t.closes){if(!c||typeof c.id!=='string'||!c.id||c.id.length>100||ids.has(c.id)||!day(c.date)||c.date<t.date||!finite(c.quantity,Number.MIN_VALUE)||!finite(c.price,Number.MIN_VALUE)||!finite(c.fee)||!Number.isFinite(c.funding)||typeof c.note!=='string'||c.note.length>3000)return false;ids.add(c.id)}
  if(closedQuantity(t)>t.quantity+tolerance(t))return false;
  if(!events(t).every(r=>Number.isFinite(r.profit)))return false;
  if(t.closes.length){const expected=sync(t);if((expected.exit===null)!==(t.exit===null))return false;if(expected.exit!==null&&(Math.abs(expected.exit-t.exit)>Math.max(1,expected.exit)*1e-10||expected.closeDate!==t.closeDate))return false}
  return true;
  }catch{return false}
 }
 function change(t,record,removeId){
  if(!t.closes?.length&&t.exit!==null)throw Error('รายการนี้ปิดแบบเดิมแล้ว ไม่สามารถเพิ่มไม้ปิดซ้ำ');
  const old=t.closes||[];if(removeId&&!old.some(c=>c.id===removeId))throw Error('ไม่พบไม้ปิด');
  if(record&&t.baseOpen)record={...record,order:old.find(c=>c.id===record.id)?.order??Math.max(0,...timeline(t).map(r=>r.order))+1};
  const closes=removeId?old.filter(c=>c.id===removeId?false:true):old.some(c=>c.id===record.id)?old.map(c=>c.id===record.id?record:c):[...old,record];
  const next=sync({...t,closes});if(!valid(next))throw Error('ตรวจวันที่ ราคา ค่าธรรมเนียม และจำนวนปิด (ต้องไม่เกินจำนวนที่ถือ)');return next;
 }
 function addEntry(t,record,removeId){
  if(!removeId&&!t.entries?.some(r=>r.id===record?.id)&&remaining(t)<=0)throw Error('ดีลปิดหมดแล้ว ต้องเปิดรายการใหม่');
  const baseOpen=t.baseOpen||{entry:t.entry,quantity:t.quantity},closes=(t.closes||[]).map((r,i)=>({...r,order:r.order??i+1})),old=t.entries||[];
  if(removeId&&!old.some(r=>r.id===removeId))throw Error('ไม่พบไม้เข้า');
  const order=old.find(r=>r.id===record?.id)?.order??Math.max(0,...closes.map(r=>r.order),...old.map(r=>r.order))+1;
  if(record&&!old.some(r=>r.id===record.id)&&record.date<[t.date,...timeline(t).map(r=>r.date)].sort().at(-1))throw Error('ไม้เพิ่มใหม่ต้องไม่ย้อนหลังเหตุการณ์ล่าสุด');
  const entries=removeId?old.filter(r=>r.id!==removeId):old.some(r=>r.id===record.id)?old.map(r=>r.id===record.id?{...record,order}:r):[...old,{...record,order}];
  const quantity=baseOpen.quantity+entries.reduce((s,r)=>s+r.quantity,0),entry=t.asset==='BTCUSD'?quantity/(baseOpen.quantity/baseOpen.entry+entries.reduce((s,r)=>s+r.quantity/r.price,0)):(baseOpen.quantity*baseOpen.entry+entries.reduce((s,r)=>s+r.quantity*r.price,0))/quantity;
  const next=sync({...t,baseOpen,entries,closes,quantity,entry});if(!valid(next))throw Error('ตรวจวันที่ จำนวน ราคา และลำดับไม้เข้า/ปิด');return next;
 }
 return {remaining,events,realized,unrealized,valid,change,sync,closedQuantity,addEntry,replay};
})();
if(typeof module!=='undefined')module.exports=FuturesCore;
