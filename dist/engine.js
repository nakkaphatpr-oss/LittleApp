/* Pure calculations shared by the interface and regression checks. */
const LittleCore = (() => {
  const strategies=['ทั่วไป','Grid','Rebalance'];
  const key=r=>JSON.stringify([r.accountId||'unassigned',r.asset,r.symbol.trim().toUpperCase(),r.currency,r.strategy||'ทั่วไป']);
  const finite=(v,min=0)=>Number.isFinite(v)&&v>=min;
  const day=v=>typeof v==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(v)&&!isNaN(Date.parse(v))&&new Date(v+'T00:00:00Z').toISOString().slice(0,10)===v;
  function ledger(d){
    const positions=new Map(),sales=[];
    const opening=(d.holdings||[]).map(h=>({...h,time:h.date+'T00:00',type:'Buy',price:h.cost,opening:true}));
    const events=[...opening,...(d.spotTransactions||[])].map((r,i)=>({...r,index:i})).sort((a,b)=>a.time.localeCompare(b.time)||a.index-b.index);
    for(const r of events){
      const k=key(r);let p=positions.get(k);
      if(!p){p={...r,key:k,quantity:0,basis:0,realized:0,current:r.current??r.price,fee:0};positions.set(k,p)}
      if(r.type==='Buy'){p.quantity+=r.quantity;p.basis+=r.quantity*r.price+r.fee}
      else{
        const tolerance=Number.EPSILON*Math.max(1,p.quantity)*8;
        if(r.quantity>p.quantity+tolerance||p.quantity<=0)throw Error('ขายเกินจำนวนที่ถือ ณ '+r.time+' · '+r.symbol);
        const sold=Math.min(r.quantity,p.quantity),basis=p.basis*(sold/p.quantity),profit=r.quantity*r.price-r.fee-basis;
        p.quantity-=sold;p.basis-=basis;p.realized+=profit;
        if(p.quantity<tolerance){p.quantity=0;p.basis=0}
        sales.push({...r,profit,costBasis:basis,date:r.time.slice(0,10)});
      }
      p.cost=p.quantity?p.basis/p.quantity:0;
      if(!r.opening)p.current=r.price;
      if(![p.quantity,p.basis,p.realized,p.cost].every(Number.isFinite))throw Error('ขนาดตัวเลขมากเกินไป');
    }
    for(const p of positions.values()){
      const q=(d.spotQuotes||[]).find(q=>q.key===p.key);if(q)p.current=q.price;
      p.market=p.current*p.quantity;p.unrealized=p.market-p.basis;
      if(!Number.isFinite(p.market))throw Error('มูลค่ามากเกินไป');
    }
    return {positions:[...positions.values()],sales,events};
  }
  function sizing(p){
    for(const k of ['entry','stop','target','multiplier','risk','step'])if(!finite(p[k],Number.MIN_VALUE))throw Error('กรอกตัวเลขมากกว่าศูนย์ให้ครบ');
    if(!finite(p.feeReserve)||p.feeReserve>=p.risk)throw Error('เงินเผื่อค่าธรรมเนียมต้องน้อยกว่าวงเงินขาดทุน');
    if(!['Long','Short'].includes(p.side)||!['XAUUSD','BTCUSDT','BTCUSD'].includes(p.asset))throw Error('สัญญาไม่ถูกต้อง');
    if(p.side==='Long'&&!(p.stop<p.entry&&p.target>p.entry)||p.side==='Short'&&!(p.stop>p.entry&&p.target<p.entry))throw Error('Long: SL < เข้า < TP; Short: TP < เข้า < SL');
    const inv=p.asset==='BTCUSD';
    const loss=p.multiplier*Math.abs(inv?1/p.entry-1/p.stop:p.entry-p.stop);
    const reward=p.multiplier*Math.abs(inv?1/p.entry-1/p.target:p.target-p.entry);
    const raw=(p.risk-p.feeReserve)/loss;
    let quantity=Math.floor(raw/p.step)*p.step;
    // Never round a recommended quantity above the risk budget.
    if(quantity*loss+p.feeReserve>p.risk)quantity=Math.max(0,quantity-p.step);
    const riskUsed=quantity*loss+p.feeReserve,expected=quantity*reward-p.feeReserve;
    if(![quantity,riskUsed,expected].every(Number.isFinite))throw Error('ขนาดตัวเลขมากเกินไป');
    return {quantity,riskUsed,expected,rr:riskUsed?expected/riskUsed:0,currency:inv?'BTC':p.asset==='XAUUSD'?'USD':'USDT'};
  }
  function validExtra(d){
    const tx=d.spotTransactions||[],plans=d.plans||[],reviews=d.reviews||[],quotes=d.spotQuotes||[];
    if(![tx,plans,reviews,quotes].every(Array.isArray)||tx.length+plans.length+reviews.length+d.trades.length+d.holdings.length>10000||quotes.length>10000)return false;
    const ids=new Set(),accountIds=new Set((d.accounts||[]).map(a=>a.id));
    const common=r=>r&&typeof r.id==='string'&&r.id.length<=100&&!ids.has(r.id)&&(ids.add(r.id),true)&&day(r.date)&&typeof r.note==='string'&&r.note.length<=3000&&strategies.includes(r.strategy)&&typeof r.accountId==='string'&&(r.accountId==='unassigned'||accountIds.has(r.accountId)||!d.accounts&&/^broker-[0-4]$/.test(r.accountId));
    for(const r of tx){if(!common(r)||!['Buy','Sell'].includes(r.type)||!['หุ้นไทย','ทองคำแท่ง','บิทคอยน์'].includes(r.asset)||typeof r.symbol!=='string'||!r.symbol.trim()||r.symbol.length>30||!['USD','USDT','THB','BTC'].includes(r.currency)||!finite(r.quantity,1e-10)||!finite(r.price,1e-10)||!finite(r.fee)||!Number.isFinite(r.quantity*r.price)||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(r.time)||r.time.slice(0,10)!==r.date||+r.time.slice(11,13)>23||+r.time.slice(14,16)>59)return false}
    for(const p of plans){if(!common(p)||!['รอเข้า','เข้าแล้ว','ยกเลิก'].includes(p.status))return false;try{sizing(p)}catch{return false}}
    for(const r of reviews){if(!common(r)||typeof r.title!=='string'||!r.title.trim()||r.title.length>100||!['นิ่ง','มั่นใจ','กลัว','โลภ','เสียดาย','เครียด'].includes(r.emotion)||!['entryReason','exitReason','mistakes','lesson','tradeId'].every(k=>typeof r[k]==='string'&&r[k].length<=3000)||typeof r.image!=='string'||r.image.length>350000||r.image&&!/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(r.image))return false}
    const seen=new Set();for(const q of quotes){if(!q||typeof q.key!=='string'||q.key.length>500||seen.has(q.key)||!finite(q.price))return false;seen.add(q.key)}
    try{ledger(d)}catch{return false}return true;
  }
  function realized(d){
    return [...d.trades.filter(t=>t.exit!==null).map(t=>({...t,date:t.closeDate,profit:(t.asset==='BTCUSD'?1/t.entry-1/t.exit:t.exit-t.entry)*t.quantity*t.multiplier*(t.side==='Short'?-1:1)-t.fee,source:'Futures'})),...ledger(d).sales.map(t=>({...t,source:'Spot'}))];
  }
  return {key,ledger,sizing,validExtra,realized,day};
})();
if(typeof module!=='undefined')module.exports=LittleCore;
