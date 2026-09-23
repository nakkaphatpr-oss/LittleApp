const AssistCore=(()=>{
 const units={XAUUSD:'USD',BTCUSDT:'USDT',BTCUSD:'BTC'};
 function valid(d){const rows=d.portfolioDefaults||[];return Array.isArray(rows)&&rows.length<=300&&new Set(rows.map(r=>r.id)).size===rows.length&&rows.every(r=>r&&r.id===r.accountId+'|'+r.asset&&(d.accounts||[]).some(a=>a.id===r.accountId)&&Object.hasOwn(units,r.asset)&&r.currency===units[r.asset]&&['ทั่วไป','Grid','Rebalance'].includes(r.strategy)&&['Long','Short'].includes(r.side)&&[r.multiplier,r.quantity].every(n=>Number.isFinite(n)&&n>0)&&Number.isFinite(r.fee)&&r.fee>=0&&(JournalCore.fixedMultiplier(d,r.accountId,r.asset)===null||r.multiplier===100))}
 function risks(d){return d.trades.filter(t=>t.exit===null).map(t=>{const plan=(d.plans||[]).find(p=>p.id===t.planId),stop=t.currentStop??plan?.stop,left=FuturesCore.remaining(t),entry=t.baseOpen?FuturesCore.replay(t).entry:t.entry;if(!Number.isFinite(stop)||stop<=0)return {...t,risk:null,stop:null,left};const result=(t.asset==='BTCUSD'?1/entry-1/stop:stop-entry)*left*t.multiplier*(t.side==='Short'?-1:1);return {...t,stop,left,risk:Number.isFinite(result)?Math.max(0,-result):null}})}
 function inbox(d,today){const items=[];for(const t of d.trades){
  if(t.accountId==null||t.accountId==='unassigned')items.push({trade:t,kind:'edit',label:'ยังไม่ระบุพอร์ต'});
  if(t.exit===null){const risk=risks({...d,trades:[t]})[0];if(risk.risk===null)items.push({trade:t,kind:'stop',label:'ยังไม่มี SL สำหรับประเมินความเสี่ยง'});if((Date.parse(today)-Date.parse(t.date))/86400000>=7)items.push({trade:t,kind:'edit',label:'เปิดมาอย่างน้อย 7 วัน ตรวจว่ายังถืออยู่หรือไม่'});}
  else if(!(d.reviews||[]).some(r=>r.tradeId===t.id))items.push({trade:t,kind:'review',label:'ปิดแล้ว ยังไม่ได้เขียนทบทวน'});
  if(!Number.isFinite(t.initialRisk)||t.initialRisk<=0)items.push({trade:t,kind:'edit',label:'ยังไม่มีวงเงินเริ่มต้น 1R'});
 }return items}
 function addCharge(t,r,id){const old=t.charges||[],charges=id?old.filter(c=>c.id!==id):old.some(c=>c.id===r.id)?old.map(c=>c.id===r.id?r:c):[...old,r],next={...t,charges};if(!FuturesCore.valid(next))throw Error('ตรวจวันเวลา ยอด และ Funding เดิม ต้องไม่กรอก Funding ซ้ำแบบสะสม/ตามไม้กับแบบรายวัน');return next}
 function brokerTime(value,format,offset){
  let text=value.trim().replace(/\//g,'-').replace(/\./g,'-').replace('T',' '),match;
  if(format==='dmy'){match=text.match(/^(\d{2})-(\d{2})-(\d{4})(.*)$/);if(match)text=match[3]+'-'+match[2]+'-'+match[1]+match[4]}
  match=text.match(/^(\d{4}-\d{2}-\d{2})[ ](\d{2}):(\d{2})(?::(\d{2}))?$/);if(!match||!CapitalCore.time(match[1]+'T'+match[2]+':'+match[3]+':'+(match[4]||'00'))||!Number.isFinite(offset)||offset < -12||offset>14)throw Error('วันเวลาไม่ตรงรูปแบบที่เลือก');
  return new Date(Date.parse(match[1]+'T'+match[2]+':'+match[3]+':'+(match[4]||'00')+'Z')+(7-offset)*3600000).toISOString().slice(0,19);
 }
 function exness(d,rows,map,config,id){
  if(!(d.accounts||[]).some(a=>a.id===config.accountId&&a.broker==='Exness'))throw Error('เลือกพอร์ต Exness');
  for(const k of ['ticket','symbol','side','quantity','entry','exit','opened','closed'])if(!map[k]||!Object.hasOwn(rows[0],map[k]))throw Error('เลือกคอลัมน์ '+k);
  if(new Set(Object.values(map).filter(Boolean)).size!==Object.values(map).filter(Boolean).length)throw Error('คอลัมน์ต้องไม่ซ้ำกัน');
  let skipped=0;const converted=[],issues=[];
  const number=s=>{if(!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(String(s).trim()))throw Error('ตัวเลขไม่ถูกต้อง ห้ามมีตัวคั่นหลักพัน');return Number(s)};
  for(const [i,row] of rows.entries()){
   if(row[map.symbol]!==config.symbol){skipped++;continue}
   try{
    const side=String(row[map.side]).trim().toLowerCase();if(!['buy','sell','long','short'].includes(side))throw Error('รองรับเฉพาะตำแหน่ง Buy/Sell ที่ปิดแล้ว');
    if(!String(row[map.ticket]).trim())throw Error('ต้องมีรหัสตำแหน่ง');
    const opened=brokerTime(row[map.opened],config.format,config.offset),closed=brokerTime(row[map.closed],config.format,config.offset);if(closed<opened)throw Error('เวลาปิดก่อนเปิด');
    const entry=number(row[map.entry]),exit=number(row[map.exit]),quantity=number(row[map.quantity]),commission=map.fee?number(row[map.fee]):0,swap=map.swap?number(row[map.swap]):0,fee=config.sign==='signed'?-commission:commission,funding=config.sign==='signed'?-swap:swap;
    if(fee<0)throw Error('Commission เป็นเงินรับ ไม่รองรับเป็นค่าธรรมเนียมบวก');
    const profit=(exit-entry)*quantity*100*(['sell','short'].includes(side)?-1:1)-fee-funding;
    if(map.net&&Math.abs(profit-number(row[map.net]))>0.02)throw Error('กำไรสุทธิไม่ตรงสูตร XAUUSD × 100 ตรวจหน่วย Lot, ค่าใช้จ่าย และสกุลเงิน');
    converted.push([String(row[map.ticket]).trim(),'XAUUSD',['sell','short'].includes(side)?'Short':'Long',opened.slice(0,10),entry,quantity,100,exit,closed.slice(0,10),fee,funding,'นำเข้าจาก Exness · '+opened+' → '+closed+' เวลาไทย']);
   }catch(e){issues.push('แถว '+(i+2)+': '+e.message)}
  }
  if(!converted.length)return {rows:[],issues,duplicates:0,skipped,next:d};
  const quote=v=>'"'+String(v).replaceAll('"','""')+'"',csv='reference,asset,side,date,entry,quantity,multiplier,exit,closeDate,fee,funding,note\n'+converted.map(r=>r.map(quote).join(',')).join('\n'),result=WorkflowCore.importTrades(d,csv,config.accountId,id);
  return {...result,issues:[...issues,...result.issues],skipped};
 }
 return {valid,risks,inbox,addCharge,exness,brokerTime};
})();
