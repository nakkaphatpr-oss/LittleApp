const FinanceCore=(()=>{
 const units=['THB','USD','USDT','BTC'],layers=['wealth','investment','speculate','gambling'];
 const match=(r,a,c)=>r.accountId===a&&r.currency===c;
 function validate(d){
  const configs=d.financeAccounts||[],adjustments=d.financeAdjustments||[],settings=d.financeSettings||[];
  if(![configs,adjustments,settings].every(Array.isArray)||configs.length>400||adjustments.length>10000||settings.length>1)return false;
  const ids=new Set(),pairs=new Set(),accounts=d.accounts||[];
  const common=r=>r&&typeof r.id==='string'&&!ids.has(r.id)&&(ids.add(r.id),true)&&accounts.some(a=>a.id===r.accountId)&&units.includes(r.currency);
  for(const r of configs){const k=r.accountId+'|'+r.currency;if(!common(r)||pairs.has(k)||!['cash','equity'].includes(r.mode)||!LittleCore.day(r.date)||!Number.isFinite(r.balance))return false;pairs.add(k)}
  for(const r of adjustments)if(!common(r)||!LittleCore.day(r.date)||!Number.isFinite(r.amount)||typeof r.note!=='string'||!r.note.trim()||r.note.length>3000)return false;
  for(const s of settings){if(s.id!=='global'||!CapitalCore.time(s.time)||typeof s.source!=='string'||!s.source.trim()||s.source.length>300||!units.every(c=>Number.isFinite(s.rates?.[c])&&s.rates[c]>0)||s.rates.THB!==1||!layers.every(k=>Number.isFinite(s.targets?.[k])&&s.targets[k]>=0)||Math.abs(layers.reduce((n,k)=>n+s.targets[k],0)-100)>1e-8)return false}
  return true;
 }
 function rows(d,today){
  const positions=LittleCore.ledger({...d,holdings:(d.holdings||[]).filter(r=>r.date<=today),spotTransactions:(d.spotTransactions||[]).filter(r=>r.date<=today)}).positions,settings=d.financeSettings?.[0];
  const result=[];
  for(const a of d.accounts||[]){const currencies=new Set([...(d.financeAccounts||[]),...(d.financeAdjustments||[]),...(d.cashFlows||[]),...(d.equitySnapshots||[]),...(d.trades||[]),...(d.holdings||[]),...(d.spotTransactions||[])].filter(r=>r.accountId===a.id).map(r=>r.currency));if(!currencies.size)currencies.add('THB');
   for(const c of currencies){const config=(d.financeAccounts||[]).find(r=>match(r,a.id,c)),r={accountId:a.id,currency:c,layer:a.layer||'unclassified',value:null,cash:null,asof:'',issue:''};
    if(!config)r.issue='ยังไม่ตั้งวิธีนับมูลค่า';
    else if(config.mode==='equity'){
     const s=(d.equitySnapshots||[]).filter(s=>match(s,a.id,c)&&s.time.slice(0,10)<=today).sort((a,b)=>a.time.localeCompare(b.time)).at(-1);
     if(!s)r.issue='ยังไม่มี Equity';else {r.value=s.equity;r.asof=s.time;r.issue='ใช้ Equity ทั้งพอร์ต ไม่บวกเงินสดหรือสินทรัพย์ซ้ำ';}
    }else if((d.trades||[]).some(t=>match(t,a.id,c)))r.issue='มี Futures: กรุณาใช้ Equity ทั้งพอร์ต';
    else if(config.date>today)r.issue='วันตั้งต้นอยู่ในอนาคต';
    else{
     const after=r=>r.date>config.date&&r.date<=today;let cash=config.balance;
     for(const f of d.cashFlows||[])if(match(f,a.id,c)&&after({date:f.time.slice(0,10)}))cash+=f.type==='deposit'?f.amount:-f.amount;
     for(const t of d.spotTransactions||[])if(match(t,a.id,c)&&after(t))cash+=(t.type==='Buy'?-1:1)*t.quantity*t.price-t.fee;
     for(const x of d.financeAdjustments||[])if(match(x,a.id,c)&&after(x))cash+=x.amount;
     r.cash=cash;r.value=cash+positions.filter(p=>match(p,a.id,c)).reduce((n,p)=>n+p.market,0);r.asof=today;r.issue='เงินสดจากยอดสิ้นวัน '+config.date+' + รายการหลังวันนั้น; ราคาสินทรัพย์ใช้ราคาประเมินที่บันทึก';
    }
    const rate=c==='THB'?1:settings?.rates[c];r.thb=r.value!==null&&rate?r.value*rate:null;if(r.value!==null&&!rate)r.issue+=' · ขาดอัตราแลกเปลี่ยน';if(!Number.isFinite(r.thb))r.thb=null;result.push(r);
   }
  }
  if([...(d.holdings||[]),...(d.trades||[]),...(d.spotTransactions||[])].some(r=>r.accountId==='unassigned'))result.push({accountId:'unassigned',currency:'—',layer:'unclassified',value:null,cash:null,thb:null,asof:'',issue:'มีรายการยังไม่ระบุพอร์ต'});
  return result;
 }
 function allocation(rows,targets,addition=0){const total=rows.reduce((n,r)=>n+(r.thb??0),0),complete=rows.length>0&&rows.every(r=>r.thb!==null&&r.thb>=0&&layers.includes(r.layer));const values=layers.map(k=>({layer:k,value:rows.filter(r=>r.layer===k).reduce((n,r)=>n+(r.thb??0),0),target:targets?.[k]??null}));const deficits=values.map(r=>Math.max(0,(total+addition)*(r.target||0)/100-r.value)),sum=deficits.reduce((a,b)=>a+b,0);return {total,complete,values:values.map((r,i)=>({...r,percent:total>0?r.value/total*100:null,difference:r.target===null?null:total*r.target/100-r.value,add:sum?addition*deficits[i]/sum:0}))};}
 return {validate,rows,allocation,units,layers};
})();
if(typeof module!=='undefined')module.exports=FinanceCore;
