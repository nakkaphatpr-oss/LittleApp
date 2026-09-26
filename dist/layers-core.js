const LayerCore=(()=>{
 const labels={wealth:'Store of wealth',investment:'Investment',speculate:'Speculate',gambling:'Gambling',unclassified:'ยังไม่จัดหมวด'};
 const of=a=>a?.layer||'unclassified';
 const matches=(r,accounts,layer)=>layer==='all'||of(accounts.find(a=>a.id===r.accountId))===layer;
 function summary(d,currency,scope='all',account='all'){
  const accounts=d.accounts||[],included=r=>r.currency===currency&&(account==='all'||(r.accountId||'unassigned')===account);
  const results=LittleCore.realized(d).filter(included);
  return Object.entries(labels).filter(([layer])=>scope==='all'||layer===scope).map(([layer,label])=>{
   const match=r=>included(r)&&matches(r,accounts,layer),ports=accounts.filter(a=>of(a)===layer&&(account==='all'||a.id===account));
   const flows=(d.cashFlows||[]).filter(match),snapshots=ports.map(a=>{const last=(d.equitySnapshots||[]).filter(r=>r.accountId===a.id&&r.currency===currency).sort((a,b)=>b.time.localeCompare(a.time))[0];return {account:a,snapshot:last||null}});
   return {layer,label,ports:ports.length,open:d.trades.filter(r=>r.exit===null&&match(r)).length,profit:results.filter(r=>matches(r,accounts,layer)).reduce((s,r)=>s+r.profit,0),deposits:flows.filter(r=>r.type==='deposit').reduce((s,r)=>s+r.amount,0),withdrawals:flows.filter(r=>r.type==='withdrawal').reduce((s,r)=>s+r.amount,0),snapshots};
  });
 }
 return {labels,of,matches,summary};
})();
