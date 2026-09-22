const CapitalCore=(()=>{
 const time=s=>typeof s==='string'&&/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/.test(s)&&LittleCore.day(s.slice(0,10))&&+s.slice(11,13)<24&&+s.slice(14,16)<60&&(!s.slice(17)||+s.slice(17)<60);
 const stamp=s=>s.length===16?s+':00':s;
 function validate(d){
  const flows=d.cashFlows||[],snapshots=d.equitySnapshots||[];if(!Array.isArray(flows)||!Array.isArray(snapshots)||flows.length+snapshots.length>10000)return false;
  const accounts=d.accounts||['Exness','SCBX','Bualuang','Deribit','Phemex'].map((broker,i)=>({id:'broker-'+i,broker})),ids=new Set(),keys=new Set();
  const common=r=>r&&typeof r.id==='string'&&r.id.length>0&&r.id.length<=100&&!ids.has(r.id)&&(ids.add(r.id),true)&&accounts.some(a=>a.id===r.accountId)&&['USD','USDT','THB','BTC'].includes(r.currency)&&time(r.time)&&typeof r.note==='string'&&r.note.length<=3000;
  for(const r of flows)if(!common(r)||!['deposit','withdrawal'].includes(r.type)||!Number.isFinite(r.amount)||r.amount<=0)return false;
  for(const r of snapshots){if(!common(r)||!Number.isFinite(r.equity)||r.balance!==null&&!Number.isFinite(r.balance))return false;const key=r.accountId+'|'+r.currency+'|'+stamp(r.time);if(keys.has(key))return false;keys.add(key)}
  return true;
 }
 function series(d,accountId,currency){
  const snapshots=(d.equitySnapshots||[]).filter(r=>r.accountId===accountId&&r.currency===currency).sort((a,b)=>stamp(a.time).localeCompare(stamp(b.time)));
  const flows=(d.cashFlows||[]).filter(r=>r.accountId===accountId&&r.currency===currency).sort((a,b)=>stamp(a.time).localeCompare(stamp(b.time)));
  let cumulativeFlow=0,cursor=0;
  return snapshots.map((r,i)=>{
    const prev=snapshots[i-1];
    const between=[];
    while(cursor<flows.length&&stamp(flows[cursor].time)<=stamp(r.time)){const flow=flows[cursor++];if(prev)between.push(flow)}
    const netFlow=between.reduce((s,f)=>s+(f.type==='deposit'?f.amount:-f.amount),0);cumulativeFlow+=netFlow;
    return {...r,netFlow:i?netFlow:null,change:i?r.equity-prev.equity-netFlow:null,adjusted:r.equity-cumulativeFlow,flowCount:between.length};
  });
 }
 return {time,stamp,validate,series};
})();
if(typeof module!=='undefined')module.exports=CapitalCore;
