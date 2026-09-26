const AccountsCore=(()=>{
 const collections=['trades','holdings','plans','reviews','spotTransactions','cashFlows','equitySnapshots'];
 const normalize=s=>String(s).trim().replace(/\s+/g,' ');
 function usage(d,id){return collections.map(key=>({key,count:(d[key]||[]).filter(r=>r.accountId===id).length})).filter(r=>r.count)}
 function edit(d,id,name,broker,makeId,layer){
  name=normalize(name);broker=normalize(broker);const known=['Exness','SCBX','Bualuang','Deribit','Phemex','อื่น ๆ'];broker=known.find(b=>b.toLowerCase()===broker.toLowerCase())||broker;
  const list=d.accounts||[];if(!name||name.length>60||!broker||broker.length>60)throw Error('กรอกชื่อพอร์ตและ Broker อย่างละไม่เกิน 60 ตัวอักษร');
  if(id!=='new'&&!list.some(a=>a.id===id))throw Error('ไม่พบพอร์ตเดิม');
  if(list.some(a=>a.id!==id&&a.name.toLowerCase()===name.toLowerCase()&&a.broker.toLowerCase()===broker.toLowerCase()))throw Error('มีชื่อพอร์ตนี้ใน Broker เดียวกันแล้ว');
  const item={...(list.find(a=>a.id===id)||{}),...(layer!==undefined?{layer}:{}),id:id==='new'?makeId():id,name,broker};
  // A broker correction must not silently reinterpret historical contract sizes.
  if(broker==='Exness'&&[...(d.trades||[]),...(d.plans||[]),...(d.portfolioDefaults||[])].some(r=>r.accountId===id&&r.asset==='XAUUSD'&&r.multiplier!==100))throw Error('พอร์ตมี XAUUSD ที่ตัวคูณไม่ใช่ 100 กรุณาตรวจแก้ข้อมูลก่อนเปลี่ยนเป็น Exness');
  return {...d,accounts:id==='new'?[...list,item]:list.map(a=>a.id===id?item:a)};
 }
 function remove(d,id,target){
  if(!(d.accounts||[]).some(a=>a.id===id))throw Error('ไม่พบพอร์ต');
  const used=usage(d,id).reduce((s,r)=>s+r.count,0);if(used&&!target)throw Error('พอร์ตมีข้อมูล เลือกพอร์ตปลายทางเพื่อย้ายก่อนลบ');
  if(target&&(target===id||!d.accounts.some(a=>a.id===target)))throw Error('เลือกพอร์ตปลายทางอื่นที่มีอยู่จริง');
  if(target){
   if(d.accounts.find(a=>a.id===target).broker==='Exness'&&[...(d.trades||[]),...(d.plans||[])].some(r=>r.accountId===id&&r.asset==='XAUUSD'&&r.multiplier!==100))throw Error('XAUUSD ต้นทางมีตัวคูณไม่ใช่ 100 ไม่สามารถย้ายเข้า Exness');
   const positionKey=r=>LittleCore.key({...r,accountId:target}),spot=[...(d.holdings||[]),...(d.spotTransactions||[])],destination=new Set(spot.filter(r=>r.accountId===target).map(positionKey));
   if(spot.some(r=>r.accountId===id&&destination.has(positionKey(r))))throw Error('มีสินทรัพย์สะสมซ้ำกับปลายทาง การรวมจะเปลี่ยนต้นทุนเฉลี่ย กรุณาเลือกพอร์ตว่าง');
   if((d.equitySnapshots||[]).some(a=>a.accountId===id&&(d.equitySnapshots||[]).some(b=>b.accountId===target&&b.currency===a.currency)))throw Error('ปลายทางมีประวัติ Equity สกุลเดียวกันแล้ว เลือกพอร์ตว่างเพื่อไม่ผสมยอดคนละบัญชี');
   const transferIds=new Set((d.cashFlows||[]).filter(r=>r.accountId===id&&r.transferId).map(r=>r.transferId));if((d.cashFlows||[]).some(r=>r.accountId===target&&transferIds.has(r.transferId)))throw Error('มีประวัติโอนระหว่างสองพอร์ตนี้ ย้ายรวมไม่ได้เพราะคู่โอนจะกลายเป็นพอร์ตเดียวกัน');
   if((d.portfolioDefaults||[]).some(a=>a.accountId===id&&(d.portfolioDefaults||[]).some(b=>b.accountId===target&&b.asset===a.asset)))throw Error('ค่าประจำสัญญาซ้ำกับปลายทาง เลือกพอร์ตที่ยังไม่มีค่าประจำสัญญานี้');
  }
  const next={...d,accounts:d.accounts.filter(a=>a.id!==id)};
  for(const key of collections)if(d[key])next[key]=d[key].map(r=>r.accountId===id?{...r,accountId:target}:r);
  next.portfolioDefaults=(d.portfolioDefaults||[]).flatMap(r=>r.accountId!==id?[r]:target?[{...r,accountId:target,id:target+'|'+r.asset}]:[]);
  next.spotQuotes=(d.spotQuotes||[]).flatMap(q=>{let parts;try{parts=JSON.parse(q.key)}catch{return [q]}if(!Array.isArray(parts)||parts[0]!==id)return [q];if(!target)return [];parts[0]=target;return [{...q,key:JSON.stringify(parts)}]});
  if(new Set(next.spotQuotes.map(r=>r.key)).size!==next.spotQuotes.length)throw Error('ราคาประเมินซ้ำกับปลายทาง กรุณาเลือกพอร์ตว่าง');
  return next;
 }
 return {edit,remove,usage};
})();
