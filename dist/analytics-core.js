// Closed-result analytics only; currencies must be filtered before aggregation.
const AnalyticsCore = (() => {
  const dayNumber = d => Date.parse(d + 'T00:00:00Z') / 86400000;
  const iso = n => new Date(n * 86400000).toISOString().slice(0,10);
  function range(mode, anchor) {
    const n = dayNumber(anchor);
    if (mode === 'week') { const dow = new Date(n*86400000).getUTCDay(); const start = n - (dow+6)%7; return [iso(start),iso(start+6)]; }
    if (mode === 'month') return [anchor.slice(0,7)+'-01',new Date(Date.UTC(+anchor.slice(0,4),+anchor.slice(5,7),0)).toISOString().slice(0,10)];
    if (mode === '7D') return [iso(n-6),anchor];
    if (mode === '30D') return [iso(n-29),anchor];
    if (mode === '90D') return [iso(n-89),anchor];
    if (mode === 'YTD') return [anchor.slice(0,4)+'-01',anchor];
    return ['0001-01-01',anchor];
  }
  function labels(text) {
    if (typeof text !== 'string') throw Error('ป้ายกำกับต้องเป็นข้อความ');
    const list=[...new Set(text.split(/[,\n，]/).map(s=>s.trim().replace(/^#+/,'')).filter(Boolean))];
    if(list.length>20||list.some(s=>s.length>40))throw Error('ป้ายแต่ละประเภทไม่เกิน 20 ป้าย และป้ายละ 40 ตัวอักษร');
    return list;
  }
  function metadata(r) {
    return (r.setup==null||typeof r.setup==='string'&&r.setup.length<=80) && (r.timeframe==null||typeof r.timeframe==='string'&&r.timeframe.length<=20) && ['tags','mistakeTags'].every(k=>r[k]==null||Array.isArray(r[k])&&r[k].length<=20&&new Set(r[k]).size===r[k].length&&r[k].every(s=>typeof s==='string'&&s.trim()===s&&s.length>0&&s.length<=40)) && (r.initialRisk==null||Number.isFinite(r.initialRisk)&&r.initialRisk>0);
  }
  function fields(f) {
    const r={setup:(f.setup||'').trim(),timeframe:(f.timeframe||'').trim(),tags:labels(f.tags||''),mistakeTags:labels(f.mistakeTags||'')};
    if(Object.hasOwn(f,'initialRisk'))r.initialRisk=f.initialRisk===''?null:Number(f.initialRisk);
    if(!metadata(r))throw Error('ตรวจ Setup, Timeframe และวงเงินเสี่ยงเริ่มต้น (ต้องมากกว่าศูนย์ หรือเว้นว่าง)');
    return r;
  }
  function stopRisk(t,stop) {
    if(![t.entry,t.quantity,t.multiplier,stop].every(v=>Number.isFinite(v)&&v>0)||!['Long','Short'].includes(t.side)||t.side==='Long'&&stop>=t.entry||t.side==='Short'&&stop<=t.entry)throw Error('กรอกข้อมูลเปิดจริงและ SL ให้ถูกทิศทางก่อน');
    const risk=Math.abs(t.asset==='BTCUSD'?1/t.entry-1/stop:t.entry-stop)*t.quantity*t.multiplier;
    if(!Number.isFinite(risk)||risk<=0)throw Error('คำนวณวงเงินเสี่ยงไม่ได้');return risk;
  }
  function records(d) {
    const original=new Map(d.trades.map(t=>[t.id,t]));
    return LittleCore.realized(d).map(r=>{
      const t=r.source==='Futures'?original.get(r.id):null;
      const multiple=t&&Number.isFinite(t.initialRisk)&&t.initialRisk>0?r.profit/t.initialRisk:null;
      return {...r,setup:r.setup||'ยังไม่ระบุ',timeframe:r.timeframe||'ยังไม่ระบุ',tags:r.tags||[],mistakeTags:r.mistakeTags||[],rMultiple:Number.isFinite(multiple)?multiple:null,holdingDays:t?dayNumber(r.date)-dayNumber(t.date):null};
    }).sort((a,b)=>a.date.localeCompare(b.date)||String(a.time||'').localeCompare(String(b.time||''))||a.id.localeCompare(b.id));
  }
  function summarize(rows) {
    if(new Set(rows.map(r=>r.currency).filter(Boolean)).size>1)throw Error('เลือกสกุลเงินเดียวก่อนรวมสถิติ');
    const wins=rows.filter(r=>r.profit>0),losses=rows.filter(r=>r.profit<0),rs=rows.filter(r=>Number.isFinite(r.rMultiple)),holds=rows.filter(r=>Number.isFinite(r.holdingDays));
    const sum=(list,key)=>list.reduce((s,r)=>s+r[key],0),net=sum(rows,'profit'),grossWin=sum(wins,'profit'),grossLoss=-sum(losses,'profit');
    // Drawdown and streaks use end-of-day results: no fabricated intraday order.
    const daily=new Map();for(const r of rows)daily.set(r.date,(daily.get(r.date)||0)+r.profit);
    let cumulative=0,peak=0,maxDrawdown=0,winStreak=0,lossStreak=0,bestWinStreak=0,bestLossStreak=0;
    const curve=[...daily].sort(([a],[b])=>a.localeCompare(b)).map(([date,profit])=>{
      cumulative+=profit;peak=Math.max(peak,cumulative);const drawdown=peak-cumulative;maxDrawdown=Math.max(maxDrawdown,drawdown);
      winStreak=profit>0?winStreak+1:0;lossStreak=profit<0?lossStreak+1:0;bestWinStreak=Math.max(bestWinStreak,winStreak);bestLossStreak=Math.max(bestLossStreak,lossStreak);
      return {date,profit,cumulative,drawdown};
    });
    const averageWin=wins.length?grossWin/wins.length:null,averageLoss=losses.length?grossLoss/losses.length:null;
    return {count:rows.length,wins:wins.length,losses:losses.length,breakeven:rows.length-wins.length-losses.length,net,winRate:rows.length?wins.length/rows.length*100:null,profitFactor:grossLoss?grossWin/grossLoss:grossWin?Infinity:null,expectancy:rows.length?net/rows.length:null,averageWin,averageLoss,payoff:averageLoss&&averageWin!==null?averageWin/averageLoss:null,totalR:rs.length?sum(rs,'rMultiple'):null,averageR:rs.length?sum(rs,'rMultiple')/rs.length:null,rCount:rs.length,maxDrawdown,curve,bestWinStreak,bestLossStreak,best:rows.length?Math.max(...rows.map(r=>r.profit)):null,worst:rows.length?Math.min(...rows.map(r=>r.profit)):null,holdingDays:holds.length?sum(holds,'holdingDays')/holds.length:null,holdingCount:holds.length};
  }
  function groups(rows,key,multi=false) {
    const map=new Map();for(const r of rows){const names=multi?r[key]:[typeof key==='function'?key(r):r[key]||'ยังไม่ระบุ'];for(const label of new Set(names)){if(!map.has(label))map.set(label,[]);map.get(label).push(r)}}
    return [...map].map(([name,items])=>({name,...summarize(items)})).sort((a,b)=>b.net-a.net||a.name.localeCompare(b.name));
  }
  return {range,labels,metadata,fields,stopRisk,records,summarize,groups};
})();
if(typeof module!=='undefined')module.exports=AnalyticsCore;
