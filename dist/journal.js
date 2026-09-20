// One workspace and form for the whole trade lifecycle.
let journalContext={tradeId:null,planId:null};
const beforeJournalRender=render,beforeJournalSwitch=switchView,beforeJournalOpen=openEditor,beforeJournalValid=valid;
valid=function(d){return beforeJournalValid(d)&&JournalCore.validLinks(d)};
function journalRows(){return JournalCore.items(data).filter(i=>shown(i.record)&&tradeMatches(i.record)&&($('#filter').value==='all'||i.record.asset===$('#filter').value))}
function renderJournal(){
  const rows=journalRows(),closed=rows.filter(i=>i.status==='ปิดแล้ว'),profit=closed.reduce((s,i)=>s+pnl(i.record),0);
  $('#stats').innerHTML=stat('รอเข้า',rows.filter(i=>i.status==='รอเข้า').length,'รายการ','ยังไม่นับเป็นการเทรดจริง','◎')+stat('เปิดอยู่',rows.filter(i=>i.status==='เปิดอยู่').length,'รายการ','ยืนยันการเปิดสถานะแล้ว','⇄')+stat('ปิดแล้ว',closed.length,'รายการ','บันทึกราคาออกแล้ว','✓')+stat('กำไรสุทธิ',money(profit),currency,'เฉพาะรายการปิดจริง','↗');
  if(typeof QuoteUI!=='undefined')$('#stats').innerHTML+=QuoteUI.summary(rows);
  const wanted=$('#journal-status').value;
  const visible=rows.filter(i=>wanted==='ทั้งหมด'||i.status===wanted);
  $('#records').innerHTML=visible.length?gridTable(['สถานะ / สินทรัพย์','พอร์ต / กลยุทธ์','แผนเข้า / SL / TP','เข้า → ออกจริง','จำนวนจริง / ตามแผน','ราคาปัจจุบันอ้างอิง','กำไร/ขาดทุนค้างอยู่','กำไรปิดแล้ว','ผลเป็น R',''],visible.map(i=>{
    const r=i.record,p=i.plan,size=p?LittleCore.sizing(p):null,priceUnit=r.asset==='BTCUSDT'?'USDT':'USD';
    return `<tr><td><span class="tag">${i.status}</span><br><b>${esc(r.asset)} · ${esc(r.side)}</b><br><small>${esc(r.date)}</small>${i.kind==='plan'&&r.status==='เข้าแล้ว'?'<br><small>แผนเดิมระบุเข้าแล้ว · ยังไม่เชื่อมผลจริง</small>':''}</td><td>${meta(r)}</td><td>${p?`${money(p.entry,priceUnit)} / ${money(p.stop,priceUnit)} / ${money(p.target,priceUnit)}`:'ยังไม่มีแผน'}</td><td>${i.kind==='trade'?`${money(r.entry,priceUnit)} → ${r.exit===null?'—':money(r.exit,priceUnit)}`:'ยังไม่เปิดจริง'}</td><td>${i.kind==='trade'?qty(r.quantity):'—'} / ${size?qty(size.quantity):'—'}<br><small>${i.kind==='trade'?'ตัวคูณจริง '+qty(r.multiplier):''}</small></td><td>${typeof QuoteUI!=='undefined'&&['รอเข้า','เปิดอยู่'].includes(i.status)?QuoteUI.cell(r):'—'}</td><td>${typeof QuoteUI!=='undefined'&&i.status==='เปิดอยู่'?QuoteUI.pnlCell(r):'—'}</td><td>${i.status==='ปิดแล้ว'?signed(pnl(r)):'—'}</td><td>${i.status==='ปิดแล้ว'&&Number.isFinite(r.initialRisk)&&r.initialRisk>0?money(pnl(r)/r.initialRisk,'USD')+' R':'—'}</td><td><button class="row-action" data-journal-kind="${i.kind}" data-journal-id="${esc(i.id)}">${i.status==='รอเข้า'?'ดูแผน / เปิดจริง':i.status==='เปิดอยู่'?'แก้ไข / ปิดรายการ':'ดู / แก้ไข'}</button><button class="row-action" data-journal-delete="${i.kind}" data-id="${esc(i.id)}">ลบ</button></td></tr>`;
  })):'<div class="empty">ยังไม่มีรายการในสถานะและตัวกรองนี้</div>';
  $$('[data-journal-kind]').forEach(b=>b.onclick=()=>openJournal(b.dataset.journalKind,b.dataset.journalId));
  $$('[data-journal-delete]').forEach(b=>b.onclick=async()=>{
    if(!featureAllowed())return;
    const actual=b.dataset.journalDelete==='trade',r=(actual?data.trades:listOf('plans')).find(r=>r.id===b.dataset.id);
    if(!r||!confirm(actual&&r.planId?'ลบรายการจริงพร้อมแผนที่เชื่อมด้วยหรือไม่?':'ลบรายการนี้หรือไม่?'))return;
    const next=actual?{...data,trades:data.trades.filter(t=>t.id!==r.id),plans:listOf('plans').filter(p=>p.id!==r.planId)}:{...data,plans:listOf('plans').filter(p=>p.id!==r.id)};
    if(await save(next))toast('ลบรายการแล้ว');
  });
}
render=function(){
  beforeJournalRender();
  $('#journal-status-label').hidden=view!=='journal';
  if(view==='journal'){
    $('#table-title').textContent='วางแผน เปิดสถานะ และบันทึกผล';
    $('#table-subtitle').textContent='กำไรปิดแล้วแยกจากกำไรค้างอยู่ · เลื่อนตารางแนวนอนเพื่อดูราคาปัจจุบันและผล';renderJournal();
  }
};
switchView=function(v){beforeJournalSwitch(v==='plans'?'journal':v);if(view==='journal'){$('#page-title').textContent='แผนและผลเทรด อยู่ในรายการเดียว';$('#page-subtitle').textContent='วางแผน → เปิดจริง → ปิดรายการ';$('#add').textContent='＋ เพิ่มรายการ'}};
openEditor=function(id){if(['overview','journal','plans'].includes(view))openJournal('trade',id);else beforeJournalOpen(id)};
function planInputs(p={}){
  return field('วันที่วางแผน','planDate','date',p.date||date(),'required')+numeric('ราคาเข้าตามแผน','planEntry',p.entry||'',1e-10)+numeric('Stop Loss','stop',p.stop||'',1e-10)+numeric('Take Profit','target',p.target||'',1e-10)+numeric('ตัวคูณตามแผน (Inverse: USD/สัญญา)','planMultiplier',p.multiplier||1,1e-10)+numeric('วงเงินขาดทุนสูงสุด รวมค่าเผื่อ','risk',p.risk||'',1e-10)+numeric('ค่าเผื่อค่าธรรมเนียม / Slippage','feeReserve',p.feeReserve||0)+numeric('ขั้นจำนวน เช่น 0.01 หรือ 1','step',p.step||.01,1e-10);
}
function fillLinkedPlan(p){
  const f=$('#journal-form');
  for(const [k,v] of Object.entries({planDate:p.date,planEntry:p.entry,stop:p.stop,target:p.target,planMultiplier:p.multiplier,risk:p.risk,feeReserve:p.feeReserve,step:p.step,planNote:p.note}))f.elements[k].value=v;
  $('#journal-planning').checked=true;updateJournalForm();
}
function openJournal(kind,id){
  if(!featureAllowed())return;
  const t=kind==='trade'&&id?data.trades.find(t=>t.id===id):null;
  const p=kind==='plan'&&id?listOf('plans').find(p=>p.id===id):listOf('plans').find(p=>p.id===t?.planId);
  if(id&&!t&&!p)return;
  journalContext={tradeId:t?.id||null,planId:p?.id||null};
  const r=t||p||{},state=t?(t.exit===null?'เปิดอยู่':'ปิดแล้ว'):p?.status==='ยกเลิก'?'ยกเลิก':'รอเข้า';
  const available=listOf('plans').filter(p=>!data.trades.some(t=>t.planId===p.id));
  $('#journal-fields').innerHTML=commonFields(r)+options('สถานะ','state',t?['เปิดอยู่','ปิดแล้ว']:['รอเข้า','เปิดอยู่','ปิดแล้ว','ยกเลิก'],state)+options('สัญญา','asset',['XAUUSD','BTCUSDT','BTCUSD'],r.asset||(currency==='BTC'?'BTCUSD':currency==='USDT'?'BTCUSDT':'XAUUSD'))+options('ทิศทาง','side',['Long','Short'],r.side||'Long');
  if(typeof QuoteCore!=='undefined')$('#journal-fields').innerHTML+=options('แหล่งราคาประเมิน (ต้องตรงประเภทสัญญา)','quoteFeed',[['none','ไม่ใช้ราคาออนไลน์'],...Object.entries(QuoteCore.feeds).filter(([id,f])=>f.asset).map(([id,f])=>[id,f.label])],r.quoteFeed??QuoteCore.defaultFeed(r.asset||(currency==='BTC'?'BTCUSD':currency==='USDT'?'BTCUSDT':'XAUUSD')));
  $('#journal-link').innerHTML=t&&!p?options('เชื่อมแผนเดิมที่เคยกรอกแยกไว้ (ถ้ามี)','linkId',[['','ไม่เชื่อมแผนเดิม'],...available.map(p=>[p.id,p.date+' · '+p.asset+' '+p.side+' · '+accountName(p.accountId)])],''):'';
  $('#journal-planning').checked=!!p||!t;
  $('#journal-plan-fields').innerHTML=planInputs(p||{asset:r.asset,entry:t?.entry,multiplier:t?.multiplier});
  $('#journal-plan-note').innerHTML=textarea('เหตุผลและแผนรับมือ','planNote',p?.note||'');
  $('#journal-actual-fields').innerHTML=field('วันที่เปิดจริง','date','date',t?.date||date(),'required')+numeric('ราคาเข้าจริง','entry',t?.entry||p?.entry||'',1e-10)+numeric('จำนวนที่เปิดจริง','quantity',t?.quantity||'',1e-10)+numeric('ตัวคูณจริง (ไม่ใช่ Leverage)','multiplier',t?.multiplier||p?.multiplier||1,1e-10)+numeric('ค่าธรรมเนียมจริงรวม','fee',t?.fee||0);
  $('#journal-close-fields').innerHTML=numeric('ราคาออกจริง','exit',t?.exit||'',1e-10)+field('วันที่ปิดจริง','closeDate','date',t?.closeDate||date(),'required');
  $('#journal-note').innerHTML=textarea('บันทึกผลจริง','note',t?.note||'');
  $('#journal-error').textContent='';
  if($('#journal-form').elements.linkId)$('#journal-form').elements.linkId.onchange=e=>{const p=listOf('plans').find(p=>p.id===e.target.value);if(p)fillLinkedPlan(p);else updateJournalForm()};
  updateJournalForm();$('#journal-dialog').showModal();
}
function journalValues(){const f=Object.fromEntries(new FormData($('#journal-form')));f.planning=$('#journal-planning').checked;return f}
function journalSizing(f){return LittleCore.sizing({asset:f.asset,side:f.side,entry:Number(f.planEntry),stop:Number(f.stop),target:Number(f.target),multiplier:Number(f.planMultiplier),risk:Number(f.risk),feeReserve:Number(f.feeReserve),step:Number(f.step)})}
function updateJournalForm(){
  const form=$('#journal-form'),state=form.elements.state.value,actual=['เปิดอยู่','ปิดแล้ว'].includes(state),linked=journalContext.planId||form.elements.linkId?.value;
  if(typeof QuoteCore!=='undefined'){
    const asset=form.elements.asset.value,select=form.elements.quoteFeed;
    if(select&&select.dataset.asset!==asset){
      const current=select.dataset.asset?QuoteCore.defaultFeed(asset):select.value;
      const id=asset==='XAUUSD'?'gold':asset==='BTCUSDT'?'futures':'inverse';
      select.innerHTML=`<option value="none">ไม่ใช้ราคาออนไลน์</option><option value="${id}">${esc(QuoteCore.feeds[id].label)}${asset==='BTCUSD'?' · ยืนยันว่าถือสัญญานี้':''}</option>`;
      select.value=['none',id].includes(current)?current:QuoteCore.defaultFeed(asset);select.dataset.asset=asset;
    }
  }
  if(!actual||linked)$('#journal-planning').checked=true;
  $('#journal-planning').disabled=!actual||!!linked;
  $('#journal-plan').disabled=!$('#journal-planning').checked;$('#journal-plan').hidden=!$('#journal-planning').checked;
  $('#journal-actual').disabled=!actual;$('#journal-actual').hidden=!actual;
  $('#journal-closed').disabled=state!=='ปิดแล้ว';$('#journal-closed').hidden=state!=='ปิดแล้ว';
  $('#apply-size').hidden=!actual;
  const unit=JournalCore.unit(form.elements.asset.value);
  $('#journal-units').textContent='วงเงินขาดทุน ค่าเผื่อ และค่าธรรมเนียมจริงใช้ '+unit+' · ราคาใช้ '+(form.elements.asset.value==='BTCUSDT'?'USDT':'USD')+' · ตัวคูณต้องตรงกับสัญญาของโบรกเกอร์';
  try{const s=journalSizing(journalValues());$('#journal-estimate').textContent=`ตามแผน: จำนวน ${qty(s.quantity)} · ขาดทุนประมาณ ${money(s.riskUsed,s.currency)} ${s.currency} · เป้ากำไร ${money(s.expected,s.currency)} ${s.currency} · R:R ${money(s.rr,'USD')}`;$('#apply-size').disabled=s.quantity<=0}catch(e){$('#journal-estimate').textContent=e.message;$('#apply-size').disabled=true}
}
$('#journal-form').oninput=updateJournalForm;
$('#journal-form').onchange=updateJournalForm;
$('#apply-size').onclick=()=>{try{const s=journalSizing(journalValues());$('#journal-form').elements.quantity.value=String(Number(s.quantity.toFixed(12)));toast('ใส่จำนวนตามแผนแล้ว ตรวจให้ตรงกับจำนวนที่เปิดจริง')}catch{}};
$('#journal-close').onclick=()=>$('#journal-dialog').close();
$('#journal-status').onchange=render;
$('#journal-form').onsubmit=async e=>{
  e.preventDefault();if(!featureAllowed())return;
  try{
    const next=JournalCore.build(data,journalValues(),journalContext,()=>crypto.randomUUID());
    if(!valid(next))throw Error('ตรวจพอร์ต วันที่ และข้อมูลตัวเลขให้ครบ');
    $('#journal-form').inert=true;
    if(await save(next)){$('#journal-dialog').close();toast('บันทึกรายการแล้ว')}else $('#journal-error').textContent='ยังยืนยันการบันทึกไม่ได้ ตรวจสถานะการเชื่อมต่อด้านบน';
  }catch(error){$('#journal-error').textContent=error.message}finally{$('#journal-form').inert=false}
};
render();
