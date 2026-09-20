const JournalCore=(()=>{
  const unit=asset=>asset==='BTCUSD'?'BTC':asset==='XAUUSD'?'USD':'USDT';
  const fixedMultiplier=(d,accountId,asset)=>asset==='XAUUSD'&&(d.accounts?d.accounts.find(a=>a.id===accountId)?.broker==='Exness':accountId==='broker-0')?100:null;
  function items(d){const linked=new Set(d.trades.map(t=>t.planId).filter(Boolean));return [
    ...d.trades.map(t=>({kind:'trade',id:t.id,record:t,plan:(d.plans||[]).find(p=>p.id===t.planId),status:t.exit===null?'เปิดอยู่':'ปิดแล้ว'})),
    ...(d.plans||[]).filter(p=>!linked.has(p.id)).map(p=>({kind:'plan',id:p.id,record:{...p,currency:unit(p.asset)},plan:p,status:p.status==='ยกเลิก'?'ยกเลิก':'รอเข้า'}))
  ].sort((a,b)=>b.record.date.localeCompare(a.record.date))}
  function validLinks(d){const seen=new Set();return d.trades.every(t=>{if(t.planId==null)return true;const p=(d.plans||[]).find(p=>p.id===t.planId);if(!p||seen.has(t.planId)||p.status!=='เข้าแล้ว'||p.asset!==t.asset||p.side!==t.side||(p.accountId||'unassigned')!==(t.accountId||'unassigned'))return false;seen.add(t.planId);return true})}
  function build(d,f,context,makeId){
    const fixed=fixedMultiplier(d,f.accountId,f.asset);
    if(fixed!==null)f={...f,planMultiplier:fixed,multiplier:fixed};
    const actual=['เปิดอยู่','ปิดแล้ว'].includes(f.state),old=d.trades.find(t=>t.id===context.tradeId);
    if(!['รอเข้า','เปิดอยู่','ปิดแล้ว','ยกเลิก'].includes(f.state))throw Error('สถานะไม่ถูกต้อง');
    if(context.tradeId&&!old)throw Error('ไม่พบรายการเดิม กรุณาโหลดข้อมูลล่าสุด');
    if(old&&!actual)throw Error('รายการที่เปิดจริงแล้ว เปลี่ยนได้เฉพาะเปิดอยู่หรือปิดแล้ว');
    const linkId=old?.planId||context.planId||f.linkId||null;
    const existing=(d.plans||[]).find(p=>p.id===linkId);
    if(linkId&&!existing)throw Error('ไม่พบแผนเดิม');
    if(linkId&&d.trades.some(t=>t.planId===linkId&&t.id!==old?.id))throw Error('แผนนี้เชื่อมกับการเทรดอื่นแล้ว');
    if(existing&&!context.planId&&!old?.planId&&(existing.asset!==f.asset||existing.side!==f.side||(existing.accountId||'unassigned')!==f.accountId))throw Error('แผนที่เลือกต้องมีพอร์ต สัญญา และทิศทางตรงกับรายการจริง');
    const quoteFeed=f.quoteFeed??old?.quoteFeed??existing?.quoteFeed;
    if(quoteFeed!=null&&!['none',f.asset==='XAUUSD'?'gold':f.asset==='BTCUSDT'?'futures':'inverse'].includes(quoteFeed))throw Error('แหล่งราคาไม่ตรงกับสัญญา');
    const common={accountId:f.accountId,strategy:f.strategy,asset:f.asset,side:f.side,...(quoteFeed!=null?{quoteFeed}:{})};
    const planning=!!existing||f.planning||!actual;
    let plan=existing;
    if(planning){
      plan={...existing,...common,id:existing?.id||makeId(),date:f.planDate,entry:Number(f.planEntry),stop:Number(f.stop),target:Number(f.target),multiplier:Number(f.planMultiplier),risk:Number(f.risk),feeReserve:Number(f.feeReserve),step:Number(f.step),note:f.planNote||'',status:actual?'เข้าแล้ว':f.state==='ยกเลิก'?'ยกเลิก':'รอเข้า'};
      LittleCore.sizing(plan);
      if(!LittleCore.day(plan.date))throw Error('วันที่วางแผนไม่ถูกต้อง');
    }
    let trades=[...d.trades];
    if(actual){
      const trade={...old,...common,id:old?.id||makeId(),date:f.date,entry:Number(f.entry),quantity:Number(f.quantity),multiplier:Number(f.multiplier),fee:Number(f.fee),funding:Number(f.funding??old?.funding??0),currency:unit(f.asset),exit:f.state==='ปิดแล้ว'?Number(f.exit):null,closeDate:f.state==='ปิดแล้ว'?f.closeDate:(old?.closeDate||f.date),note:f.note||''};
      if(!LittleCore.day(trade.date)||trade.exit!==null&&(!LittleCore.day(trade.closeDate)||trade.closeDate<trade.date))throw Error('ตรวจวันที่เปิดและปิดรายการ');
      if(![trade.entry,trade.quantity,trade.multiplier].every(n=>Number.isFinite(n)&&n>0)||!Number.isFinite(trade.funding)||!Number.isFinite(trade.fee)||trade.fee<0||trade.exit!==null&&(!Number.isFinite(trade.exit)||trade.exit<=0))throw Error('กรอกราคา จำนวน ตัวคูณ และค่าธรรมเนียมจริงให้ถูกต้อง');
      if(plan)trade.planId=plan.id;
      trades=old?trades.map(t=>t.id===old.id?trade:t):[...trades,trade];
    }
    const plans=plan?(existing?(d.plans||[]).map(p=>p.id===plan.id?plan:p):[...(d.plans||[]),plan]):(d.plans||[]);
    const result={...d,trades,plans};if(!validLinks(result))throw Error('ข้อมูลแผนกับรายการจริงไม่สอดคล้องกัน');return result;
  }
  return {unit,items,validLinks,build,fixedMultiplier};
})();
if(typeof module!=='undefined')module.exports=JournalCore;
