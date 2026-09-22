let closeTradeId=null,closeEditId=null,capitalMode='cash',capitalEditId=null;
const pcValid=valid,pcBuild=JournalCore.build,pcOpen=openJournal,pcRender=render,pcSwitch=switchView,pcEditor=openEditor,pcUpdate=updateJournalForm;
valid=function(d){return pcValid(d)&&d.trades.every(FuturesCore.valid)&&CapitalCore.validate(d)&&['trades','holdings','plans','reviews','spotTransactions','cashFlows','equitySnapshots'].reduce((n,k)=>n+(d[k]||[]).length,0)+d.trades.reduce((n,t)=>n+(t.closes||[]).length+(t.entries||[]).length,0)<=10000};
JournalCore.build=function(d,f,ctx,id){
 const old=d.trades.find(t=>t.id===ctx.tradeId);
 if((old?.closes?.length||old?.baseOpen)){
  for(const k of ['asset','side','accountId','entry','quantity','multiplier','date'])if(String(f[k])!==String(old[k]))throw Error('มีไม้ปิดแล้ว ต้องแก้หรือลบไม้ปิดก่อนเปลี่ยนข้อมูลเปิดหรือพอร์ต');
  const state=FuturesCore.remaining(old)>0?'เปิดอยู่':'ปิดแล้ว';if(f.state!==state)throw Error('สถานะคำนวณจากไม้ปิด กรุณาจัดการในประวัติการปิด');
 }
 const next=pcBuild(d,f,ctx,id);
 if((old?.closes?.length||old?.baseOpen)){const t=next.trades.find(t=>t.id===old.id);Object.assign(t,FuturesCore.sync(t));}
 return next;
};
function lockPartialEditor(){
 const t=data.trades.find(t=>t.id===journalContext.tradeId);if(!t?.closes?.length&&!t?.baseOpen)return;
 const f=$('#journal-form');$('#apply-size').disabled=true;
 for(const k of ['asset','side','accountId','entry','quantity','multiplier','date','state','exit','closeDate']){const el=f.elements[k];if(el)el.closest('label').inert=true}
 $('#journal-units').textContent+=' · มีประวัติปิดบางส่วนแล้ว ข้อมูลเปิดและสถานะล็อกไว้ จัดการราคาออกในประวัติการปิด';
}
updateJournalForm=function(){pcUpdate();lockPartialEditor()};
$('#journal-form').oninput=()=>updateJournalForm();$('#journal-form').onchange=()=>updateJournalForm();
openJournal=function(kind,id){pcOpen(kind,id);if(!$('#journal-dialog').open)return;lockPartialEditor();const t=data.trades.find(t=>t.id===id);if(t&&(t.exit===null||t.closes?.length))$('#journal-related').insertAdjacentHTML('afterbegin',`<button type="button" class="text-button" data-close-trade="${esc(t.id)}">ปิดบางส่วน / ประวัติการปิด · เหลือ ${qty(FuturesCore.remaining(t))}</button>`)};
function openClosures(id){
 if(!featureAllowed())return;const t=data.trades.find(t=>t.id===id);if(!t)return;
 if($('#journal-dialog').open){if($('#journal-dialog').dataset.dirty==='1'&&!confirm('มีการแก้ไขที่ยังไม่บันทึก ต้องการยกเลิกการแก้ไขแล้วเปิดประวัติการปิดหรือไม่?'))return;$('#journal-dialog').close()}
 closeTradeId=id;closeEditId=null;renderClosures();$('#closures-dialog').showModal();
}
function renderClosures(){
 const t=data.trades.find(t=>t.id===closeTradeId);if(!t){$('#closures-dialog').close();return}
 const c=(t.closes||[]).find(c=>c.id===closeEditId),left=FuturesCore.remaining(t),available=left+(c?.quantity||0);
 $('#closures-title').textContent=`${t.asset} ${t.side} · ${accountName(t.accountId)}`;
 $('#closures-info').textContent=`เปิด ${qty(t.quantity)} · ปิด ${qty(FuturesCore.closedQuantity(t))} · คงเหลือ ${qty(left)} · กำไรรับรู้ ${money(FuturesCore.realized(t)||0,t.currency)} ${t.currency}`;
 $('#closures-fields').innerHTML=field('วันที่ปิด','date','date',c?.date||date(),'required min="'+t.date+'"')+field('จำนวนที่ปิด (Lot / สัญญา)','quantity','number',c?.quantity||available,'required min="0.000000000001" step="any" max="'+available+'"')+field('ราคาปิด ('+(t.asset==='BTCUSDT'?'USDT':'USD')+')','price','number',c?.price||'','required min="0.000000000001" step="any"')+field('ค่าธรรมเนียมเฉพาะไม้ปิด ('+t.currency+')','fee','number',c?.fee||0,'required min="0" step="any"')+field('Funding เฉพาะไม้ปิด: จ่าย + / รับ − ('+t.currency+')','funding','number',c?.funding||0,'required step="any"')+textarea('หมายเหตุไม้ปิด','note',c?.note||'');
 $('#closures-submit').textContent=c?'บันทึกการแก้ไขไม้ปิด':'บันทึกไม้ปิด';$('#closures-inputs').hidden=!c&&left===0;$('#closures-error').textContent='';
 $('#closures-history').innerHTML=t.closes?.length?gridTable(['วันปิด','จำนวน','ราคาออก','กำไรสุทธิ',''],FuturesCore.events(t).map(e=>`<tr><td>${esc(e.date)}</td><td>${qty(e.closedQuantity)}</td><td>${money(e.exit,t.asset==='BTCUSDT'?'USDT':'USD')}</td><td>${money(e.profit,t.currency)} ${t.currency}</td><td><button type="button" data-edit-close="${esc(e.eventId)}">แก้ไข</button> <button type="button" data-delete-close="${esc(e.eventId)}">ลบ</button></td></tr>`)):'<p>ยังไม่มีไม้ปิด</p>';
 $$('[data-edit-close]').forEach(b=>b.onclick=()=>{closeEditId=b.dataset.editClose;renderClosures()});
 $$('[data-delete-close]').forEach(b=>b.onclick=async()=>{if(!featureAllowed()||!confirm('ลบไม้ปิดนี้? จำนวนคงเหลือและกำไรรับรู้จะคำนวณใหม่'))return;try{const original=data.trades.find(t=>t.id===closeTradeId),nextTrade=FuturesCore.change(original,null,b.dataset.deleteClose);if(await save({...data,trades:data.trades.map(t=>t.id===original.id?nextTrade:t)})){closeEditId=null;renderClosures()}}catch(e){$('#closures-error').textContent=e.message}});
}
$('#closures-form').onsubmit=async e=>{
 e.preventDefault();if(!featureAllowed())return;const f=Object.fromEntries(new FormData(e.target));
 try{const t=data.trades.find(t=>t.id===closeTradeId);if(!t)throw Error('ไม่พบรายการ');const c={id:closeEditId||crypto.randomUUID(),date:f.date,quantity:Number(f.quantity),price:Number(f.price),fee:Number(f.fee),funding:Number(f.funding),note:f.note||''};const nextTrade=FuturesCore.change(t,c);const next={...data,trades:data.trades.map(r=>r.id===t.id?nextTrade:r)};if(!valid(next))throw Error('ข้อมูลไม่ถูกต้องหรือเกินขนาดที่รองรับ');$('#closures-form').inert=true;if(await save(next)){closeEditId=null;renderClosures();toast('บันทึกไม้ปิดแล้ว')}}catch(error){$('#closures-error').textContent=error.message}finally{$('#closures-form').inert=false}
};
$('#closures-cancel-edit').onclick=()=>{closeEditId=null;renderClosures()};$('#closures-close').onclick=()=>$('#closures-dialog').close();
document.addEventListener('click',e=>{const b=e.target.closest('[data-close-trade]');if(b)openClosures(b.dataset.closeTrade)});
function capitalRows(key){return (data[key]||[]).filter(r=>r.currency===currency&&accountMatches(r)).sort((a,b)=>CapitalCore.stamp(b.time).localeCompare(CapitalCore.stamp(a.time)))}
function capitalChart(points){
 if(!points.length)return '<p>ยังไม่มี Equity ที่บันทึก</p>';
 const min=Math.min(...points.map(p=>p.equity)),max=Math.max(...points.map(p=>p.equity)),span=max-min||1,coords=points.map((p,i)=>`${65+i/Math.max(1,points.length-1)*600},${205-(p.equity-min)/span*155}`).join(' ');
 return `<svg viewBox="0 0 720 260" class="analytics-chart" role="img" aria-label="ประวัติ Equity ที่บันทึกจริง"><polyline points="${coords}" fill="none" stroke="#285545" stroke-width="3"/>${points.map((p,i)=>`<circle cx="${65+i/Math.max(1,points.length-1)*600}" cy="${205-(p.equity-min)/span*155}" r="3" fill="#285545"/>`).join('')}<text x="5" y="30">${money(max)}</text><text x="5" y="225">${money(min)}</text><text x="65" y="250">${esc(points[0].time.replace('T',' '))}</text><text x="680" y="250" text-anchor="end">${esc(points.at(-1).time.replace('T',' '))}</text></svg>`;
}
function renderCapital(){
 const flows=capitalRows('cashFlows'),snapshots=capitalRows('equitySnapshots'),selected=$('#account-filter').value,points=selected==='all'||selected==='unassigned'?[]:CapitalCore.series(data,selected,currency),latest=points.at(-1),first=points[0];
 const deposits=flows.filter(r=>r.type==='deposit').reduce((s,r)=>s+r.amount,0),withdrawals=flows.filter(r=>r.type==='withdrawal').reduce((s,r)=>s+r.amount,0),performance=points.length>1?points.at(-1).adjusted-first.equity:null;
 $('#stats').innerHTML=stat('ฝากสะสม',money(deposits),currency,'ตามพอร์ต/สกุลเงินที่เลือก · ทุกช่วงเวลา','↓')+stat('ถอนสะสม',money(withdrawals),currency,'ไม่ใช่ผลขาดทุนจากการเทรด','↑')+stat('Equity ล่าสุด',latest?money(latest.equity):'—',currency,latest?latest.time.replace('T',' ')+' · ยอดที่กรอกจริง':'เลือกพอร์ตเดียวเพื่อดูยอดล่าสุด','◈')+stat('การเปลี่ยนแปลงหลังหักฝากถอน',performance===null?'—':money(performance),currency,'ระหว่าง Equity แรก–ล่าสุด · ไม่ใช่ % ผลตอบแทน','≈');
 const actions=(kind,id)=>`<button class="row-action" data-capital-edit="${kind}" data-id="${esc(id)}">แก้ไข</button><button class="row-action" data-capital-delete="${kind}" data-id="${esc(id)}">ลบ</button>`;
 $('#feature-page').innerHTML=`<article class="panel"><div class="panel-title"><h2>เงินทุนและ Equity</h2><button class="primary" id="add-equity">＋ บันทึก Equity</button></div><p>บันทึกยอดจริงจากโบรกเกอร์ แยกตามพอร์ตและสกุลเงิน · ไม่บวกกำไรหรือมูลค่าสินทรัพย์ซ้ำเข้า Equity · ไม่ใช้ตัวกรองกลยุทธ์</p><p>เริ่มจากบันทึก Equity/Balance ตั้งต้น แล้วจดฝากถอนและ Equity ตามเวลาจริง (เวลาไทย) ยอดตั้งต้นไม่ต้องสร้างเป็นเงินฝากซ้ำ</p>${selected==='all'||selected==='unassigned'?'<p>เลือกพอร์ตเดียวด้านบนเพื่อดูกราฟและการเปลี่ยนแปลง Equity ไม่รวมยอดต่างเวลาจากหลายพอร์ตเข้าด้วยกัน</p>':capitalChart(points)}<p>กราฟเชื่อมเฉพาะจุดที่คุณบันทึก ไม่ใช่ข้อมูลโบรกเกอร์แบบสดหรือประวัติรายวันที่ระบบสร้างย้อนหลัง</p></article><article class="panel"><h2>ประวัติ Equity / Balance</h2>${snapshots.length?gridTable(['เวลาไทย','พอร์ต','Balance','Equity','เปลี่ยนแปลงหลังหักฝากถอน',''],snapshots.map(r=>{const point=points.find(p=>p.id===r.id);return `<tr><td>${esc(r.time.replace('T',' '))}</td><td>${esc(accountName(r.accountId))}</td><td>${r.balance===null?'—':money(r.balance)}</td><td>${money(r.equity)}</td><td>${point?.change==null?'—':money(point.change)}</td><td>${actions('equity',r.id)}</td></tr>`})): '<p>ยังไม่มีประวัติ Equity ในพอร์ตและสกุลเงินนี้</p>'}<p>การเปลี่ยนแปลง = Equity จุดใหม่ − จุดก่อน − ฝากสุทธิระหว่างจุด ต้องบันทึกฝากถอนครบและใช้ขอบเขตบัญชีเดิมจึงตีความได้ เงินเคลื่อนย้ายที่เวลาเดียวกับจุดตั้งต้นถือว่ารวมในยอดตั้งต้นแล้ว</p></article><article class="panel"><h2>ฝาก / ถอน</h2>${flows.length?gridTable(['เวลาไทย','พอร์ต','ประเภท','จำนวน','หมายเหตุ',''],flows.map(r=>`<tr><td>${esc(r.time.replace('T',' '))}</td><td>${esc(accountName(r.accountId))}</td><td>${r.type==='deposit'?'ฝาก':'ถอน'}</td><td>${money(r.amount)} ${r.currency}</td><td>${esc(r.note)}</td><td>${actions('cash',r.id)}</td></tr>`)):'<p>ยังไม่มีรายการฝากถอน</p>'}<p>ฝากถอนแยกจาก PnL และ R โดยสมบูรณ์ หากโอนระหว่างพอร์ต ให้จดถอนต้นทางและฝากปลายทางด้วยยอด/สกุลเงินจริง ไม่มีการแปลงค่าเงินอัตโนมัติ</p></article>`;
 $('#add-equity').onclick=()=>openCapital('equity');
 $$('[data-capital-edit]').forEach(b=>b.onclick=()=>openCapital(b.dataset.capitalEdit,b.dataset.id));
 $$('[data-capital-delete]').forEach(b=>b.onclick=async()=>{if(!featureAllowed()||!confirm('ลบรายการนี้? ประวัติและผลเปรียบเทียบจะคำนวณใหม่'))return;const key=b.dataset.capitalDelete==='cash'?'cashFlows':'equitySnapshots';await save({...data,[key]:(data[key]||[]).filter(r=>r.id!==b.dataset.id)})});
}
function openCapital(mode,id){
 if(!featureAllowed())return;capitalMode=mode;capitalEditId=id||null;const key=mode==='cash'?'cashFlows':'equitySnapshots',r=(data[key]||[]).find(r=>r.id===id)||{},selected=$('#account-filter').value;
 $('#capital-title').textContent=mode==='cash'?'บันทึกฝาก / ถอน':'บันทึก Equity จริงจากโบรกเกอร์';
 const now=new Date(),local=date()+'T'+String(now.getHours()).padStart(2,'0')+':'+String(now.getMinutes()).padStart(2,'0')+':'+String(now.getSeconds()).padStart(2,'0');
 $('#capital-fields').innerHTML=options('พอร์ต','accountId',[['','เลือกพอร์ต'],...accounts().map(a=>[a.id,accountName(a.id)])],r.accountId||(accounts().some(a=>a.id===selected)?selected:''))+options('สกุลเงิน','currency',currencies,r.currency||currency)+field('วันเวลา (ไทย)','time','datetime-local',r.time||local,'required step="1"')+(mode==='cash'?options('ประเภท','type',[['deposit','ฝาก'],['withdrawal','ถอน']],r.type||'deposit')+field('จำนวนเงิน (กรอกบวก)','amount','number',r.amount||'','required min="0.000000000001" step="any"'):field('Equity รวมของบัญชี','equity','number',r.equity??'','required step="any"')+field('Balance จากโบรกเกอร์ (เว้นว่างได้)','balance','number',r.balance??'','step="any"'))+textarea('หมายเหตุ','note',r.note||'');
 $('#capital-error').textContent='';$('#capital-dialog').showModal();
}
$('#capital-form').onsubmit=async e=>{e.preventDefault();if(!featureAllowed())return;const r=Object.fromEntries(new FormData(e.target));r.id=capitalEditId||crypto.randomUUID();const key=capitalMode==='cash'?'cashFlows':'equitySnapshots';if(capitalMode==='cash')r.amount=Number(r.amount);else {r.equity=Number(r.equity);r.balance=r.balance===''?null:Number(r.balance)}const next={...data,[key]:capitalEditId?(data[key]||[]).map(v=>v.id===capitalEditId?r:v):[...(data[key]||[]),r]};if(!valid(next)){$('#capital-error').textContent='เลือกพอร์ต ตรวจตัวเลขและเวลา Equity ของพอร์ต/สกุลเดียวกันต้องไม่ซ้ำเวลาเดิม';return}$('#capital-form').inert=true;try{if(await save(next)){$('#capital-dialog').close();toast('บันทึกแล้ว')}}finally{$('#capital-form').inert=false}};
$('#capital-close').onclick=()=>$('#capital-dialog').close();
openEditor=function(id){if(view==='capital')openCapital('cash',id);else pcEditor(id)};
switchView=function(v){if(v==='capital'){view='capital';render();return}pcSwitch(v)};
$('#capital-tab').onclick=()=>switchView('capital');
render=function(){
 pcRender();$('.lean-extra-filters').hidden=view==='capital';
 if(view==='capital'){
  $('#feature-page').hidden=false;$('#stats').hidden=false;$('#overview').hidden=true;$('.records-panel').hidden=true;$('#quote-bar').hidden=true;$('#insight-tabs').hidden=false;$('#lean-table-toggle').hidden=true;
  $$('nav [data-view]').forEach(b=>b.classList.toggle('active',b.dataset.view==='analytics'));$$('[data-insight]').forEach(b=>{b.classList.toggle('selected',b.id==='capital-tab');b.setAttribute('aria-pressed',String(b.id==='capital-tab'))});
  $('#breadcrumb').textContent='เงินทุนและ Equity';$('#page-title').textContent='ติดตามเงินทุนของแต่ละพอร์ต';$('#page-subtitle').textContent='ฝาก ถอน และประวัติยอดจริงจากโบรกเกอร์';$('#add').hidden=false;$('#add').textContent='＋ ฝาก / ถอน';renderCapital();
 }
 if(view==='journal')$$('[data-journal-kind="trade"]').forEach(b=>{const t=data.trades.find(t=>t.id===b.dataset.journalId);if(t&&(t.exit===null||t.closes?.length))b.insertAdjacentHTML('afterend',`<button class="row-action" data-close-trade="${esc(t.id)}">${t.exit===null?'ปิดบางส่วน':'ประวัติการปิด'}</button>`)});
};
const pcReset=resetCloudUser;resetCloudUser=function(user){$('#closures-dialog').close();$('#capital-dialog').close();pcReset(user)};
render();
