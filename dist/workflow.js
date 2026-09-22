// Contextual tools share the existing journal, capital page and backup menu.
const wfSave=save,wfValid=valid,wfRender=render,wfOpen=openJournal,wfCapital=renderCapital,wfReset=resetCloudUser;
valid=function(d){try{return wfValid(d)&&WorkflowCore.validHistory(d)&&WorkflowCore.validTransfers(d)}catch{return false}};
save=async function(next){
 if(!valid(next)){toast('ข้อมูลไม่ถูกต้อง กรุณาตรวจรายการที่เชื่อมกัน');return false}
 const before={...data,accounts:accounts()},after={...next,accounts:next.accounts||defaultAccounts()};
 return wfSave(WorkflowCore.audit(before,after,crypto.randomUUID(),new Date().toISOString()));
};
document.body.insertAdjacentHTML('beforeend','<dialog id="workflow-dialog"><div class="dialog-head"><h2 id="workflow-title"></h2><button id="workflow-close" type="button" aria-label="ปิด">✕</button></div><div id="workflow-content"></div><p id="workflow-error" role="alert"></p></dialog>');
$('#lean-data-tools').insertAdjacentHTML('beforeend','<button class="text-button" id="workflow-history">ประวัติแก้ไข / กู้คืน</button><button class="text-button" id="workflow-import">นำเข้า Futures CSV</button>');
function wfDiscard(dialog){return dialog.dataset.dirty!=='1'||confirm('มีข้อมูลที่ยังบันทึกไม่ครบ ต้องการยกเลิกการแก้ไขหรือไม่?')}
for(const id of ['workflow-dialog','closures-dialog','capital-dialog']){
 const dialog=$('#'+id);dialog.addEventListener('input',()=>dialog.dataset.dirty='1');dialog.addEventListener('change',()=>dialog.dataset.dirty='1');dialog.addEventListener('close',()=>dialog.dataset.dirty='');
 dialog.addEventListener('cancel',e=>{if(cloudBusy||!wfDiscard(dialog))e.preventDefault()});
 const button=$('#'+(id==='workflow-dialog'?'workflow-close':id==='closures-dialog'?'closures-close':'capital-close'));
 button.onclick=()=>{if(!cloudBusy&&wfDiscard(dialog))dialog.close()};
}
const wfClosures=renderClosures;renderClosures=function(){wfClosures();$('#closures-dialog').dataset.dirty='';$$('[data-edit-close]').forEach(b=>{const edit=b.onclick;b.onclick=()=>{if(wfDiscard($('#closures-dialog')))edit()}})};
$('#closures-cancel-edit').onclick=()=>{if(wfDiscard($('#closures-dialog'))){closeEditId=null;renderClosures()}};
function wfShow(title,html){
 const dialog=$('#workflow-dialog');if(dialog.open&&!wfDiscard(dialog))return false;
 $('#workflow-title').textContent=title;$('#workflow-content').innerHTML=html;$('#workflow-error').textContent='';dialog.dataset.dirty='';if(!dialog.open)dialog.showModal();return true;
}
async function wfCommit(make,done){
 if(!featureAllowed())return;const dialog=$('#workflow-dialog');dialog.inert=true;
 try{const next=make();if(!valid(next))throw Error('ข้อมูลไม่สอดคล้องกัน กรุณาตรวจรายการที่เกี่ยวข้อง');if(await save(next)){dialog.dataset.dirty='';done?.();toast('บันทึกแล้ว')}}catch(e){$('#workflow-error').textContent=e.message}finally{dialog.inert=false}
}
function openEntries(id,editId){
 if(!featureAllowed())return;const t=data.trades.find(t=>t.id===id);if(!t)return;
 if($('#journal-dialog').open){if(!wfDiscard($('#journal-dialog')))return;$('#journal-dialog').close()}
 const current=(t.entries||[]).find(r=>r.id===editId),state=t.baseOpen?FuturesCore.replay(t):{entry:t.entry},history=t.entries||[];
 if(!wfShow('เพิ่มไม้ / ประวัติราคาเข้า',`<p>${esc(t.asset)} ${esc(t.side)} · ${esc(accountName(t.accountId))}</p><p>เหลือ ${qty(FuturesCore.remaining(t))} · ต้นทุนเฉลี่ยส่วนที่เหลือ ${money(state.entry,t.asset==='BTCUSDT'?'USDT':'USD')} · จำนวนเข้ารวม ${qty(t.quantity)}</p><p>คิดต้นทุนเฉลี่ยตามลำดับเหตุการณ์ ไม้เพิ่มใหม่ไม่เปลี่ยนกำไรที่ปิดก่อนหน้า หากวันเดียวกันใช้ลำดับที่บันทึก การแก้ประวัติเดิมจะคำนวณรายการหลังจากนั้นใหม่</p>${history.length?gridTable(['วันที่','จำนวน','ราคา',''],history.map(r=>`<tr><td>${esc(r.date)}</td><td>${qty(r.quantity)}</td><td>${money(r.price)}</td><td><button data-entry-edit="${esc(r.id)}">แก้ไข</button><button data-entry-delete="${esc(r.id)}">ลบ</button></td></tr>`)):'<p>ยังไม่มีไม้เพิ่ม</p>'}${FuturesCore.remaining(t)>0||current?`<form id="scale-form"><div class="form-grid">${field('วันที่เพิ่มไม้','date','date',current?.date||date(),'required min="'+t.date+'"')}${field('จำนวน Lot / สัญญา','quantity','number',current?.quantity||'','required min="0.000000000001" step="any"')}${field('ราคาเข้า','price','number',current?.price||'','required min="0.000000000001" step="any"')}${field('ค่าธรรมเนียมไม้เข้า ('+t.currency+')','fee','number',current?.fee||0,'required min="0" step="any"')}${field('Funding จ่าย + / รับ − ('+t.currency+')','funding','number',current?.funding||0,'required step="any"')}${textarea('หมายเหตุ','note',current?.note||'')}</div><p>ต้นทุนของไม้เพิ่มกรอกเฉพาะที่นี่ ไม่ซ้ำกับค่าธรรมเนียมรายการหลัก · 1R เดิมไม่เปลี่ยนอัตโนมัติ ทบทวนวงเงินเสี่ยงรวมของดีลเมื่อเพิ่มไม้</p><button class="primary" type="submit">${current?'บันทึกการแก้ไข':'เพิ่มไม้'}</button>${current?'<button type="button" id="entry-new">ยกเลิกแก้ไข / เพิ่มใหม่</button>':''}</form>`:'<p>ดีลนี้ปิดครบแล้ว เปิดรายการใหม่เมื่อต้องการเข้าใหม่</p>'}`))return;
 $('#scale-form')?.addEventListener('submit',e=>{e.preventDefault();const f=Object.fromEntries(new FormData(e.target)),r={...f,id:current?.id||crypto.randomUUID()};for(const k of ['quantity','price','fee','funding'])r[k]=Number(r[k]);wfCommit(()=>({...data,trades:data.trades.map(v=>v.id===id?FuturesCore.addEntry(v,r):v)}),()=>openEntries(id))});
 $$('[data-entry-edit]').forEach(b=>b.onclick=()=>openEntries(id,b.dataset.entryEdit));
 $$('[data-entry-delete]').forEach(b=>b.onclick=()=>{if(confirm('ลบไม้เข้านี้และคำนวณต้นทุน/ผลหลังจากนั้นใหม่?'))wfCommit(()=>({...data,trades:data.trades.map(v=>v.id===id?FuturesCore.addEntry(v,null,b.dataset.entryDelete):v)}),()=>openEntries(id))});
 $('#entry-new')?.addEventListener('click',()=>openEntries(id));
}
openJournal=function(kind,id){wfOpen(kind,id);const t=data.trades.find(r=>r.id===id);if(t&&(t.exit===null||t.entries?.length))$('#journal-related').insertAdjacentHTML('afterbegin',`<button type="button" class="text-button" data-scale="${esc(id)}">เพิ่มไม้ / ประวัติราคาเข้า</button>`)};
document.addEventListener('click',e=>{const b=e.target.closest('[data-scale]');if(b)openEntries(b.dataset.scale)});
function openTransfer(transferId){
 if(!featureAllowed())return;const pair=(data.cashFlows||[]).filter(r=>r.transferId===transferId),out=pair.find(r=>r.type==='withdrawal'),into=pair.find(r=>r.type==='deposit'),items=[['','เลือกพอร์ต'],...accounts().map(a=>[a.id,accountName(a.id)])];
 if(!wfShow('โอนเงินระหว่างพอร์ต',`<form id="transfer-form"><div class="form-grid">${options('จากพอร์ต','from',items,out?.accountId||'')}${options('เข้าพอร์ต','to',items,into?.accountId||'')}${options('สกุลเงินเดียวกันทั้งสองฝั่ง','currency',currencies,out?.currency||currency)}${field('จำนวนเงิน','amount','number',out?.amount||'','required min="0.000000000001" step="any"')}${field('เวลาไทย','time','datetime-local',out?.time||date()+'T12:00:00','required step="1"')}${textarea('หมายเหตุ','note',out?.note||'')}</div><p>บันทึกถอนและฝากที่เชื่อมกันในครั้งเดียว ไม่ใช่กำไรขาดทุน รุ่นนี้รองรับการโอนสกุลเดียวและยอดเท่ากัน หากมีการแลกเงินหรือค่าธรรมเนียม ให้ใช้รายการฝากถอนแยกตามยอดจริง</p><button class="primary" type="submit">บันทึกการโอน</button></form>`))return;
 $('#transfer-form').onsubmit=e=>{e.preventDefault();const f=Object.fromEntries(new FormData(e.target));wfCommit(()=>WorkflowCore.transfer({...data,cashFlows:(data.cashFlows||[]).filter(r=>!transferId||r.transferId!==transferId)},f,transferId||crypto.randomUUID()),()=>$('#workflow-dialog').close())};
}
function reconcilePanel(){
 let result;try{result=WorkflowCore.reconcile(data,$('#account-filter').value,currency)}catch(e){return `<p>${esc(e.message)}</p>`}
 if(!result)return '<p>เลือกพอร์ตเดียว แล้วบันทึก Balance สิ้นวันอย่างน้อย 2 วัน โดยใช้เวลา 23:59:59 เพื่อให้ตรงกับรายการเทรดที่เก็บเป็นวันที่</p>';
 const r=result;return `<p>${esc(r.start)} ถึง ${esc(r.end)} · ${currency}</p><p>Balance ตั้งต้น ${money(r.opening)} + ฝากสุทธิ ${money(r.flow)} + ผล Futures ที่ปิด ${money(r.profit)} = ยอดตามบันทึก <b>${money(r.expected)}</b></p><p>Balance ที่กรอกจริง ${money(r.actual)} · ส่วนต่าง <b>${money(r.difference)}</b></p><p>ส่วนต่างใช้ช่วยตรวจรายการตกหล่น ไม่ใช่การยืนยันยอดจากโบรกเกอร์ ค่าธรรมเนียม/Funding ที่หักก่อนปิด โบนัส และรายการปรับยอด อาจทำให้ต่างกัน รุ่นนี้ยังไม่ใช่สมุดเงินสดครบถ้วน</p>`;
}
renderCapital=function(){
 wfCapital();$('#add-equity').insertAdjacentHTML('afterend','<button id="capital-transfer">โอนระหว่างพอร์ต</button>');$('#capital-transfer').onclick=()=>openTransfer();
 $('#feature-page').insertAdjacentHTML('beforeend',`<article class="panel"><details><summary>ตรวจ Balance กับบันทึก Futures</summary>${reconcilePanel()}</details></article>`);
 $$('[data-capital-edit="cash"]').forEach(b=>{const r=(data.cashFlows||[]).find(r=>r.id===b.dataset.id);if(r?.transferId){b.textContent='แก้ไขคู่โอน';b.onclick=()=>openTransfer(r.transferId)}});
 $$('[data-capital-delete="cash"]').forEach(b=>{const r=(data.cashFlows||[]).find(r=>r.id===b.dataset.id);if(r?.transferId){b.textContent='ลบคู่โอน';b.onclick=async()=>{if(featureAllowed()&&confirm('ลบรายการถอนและฝากของการโอนนี้ทั้งคู่?'))await save({...data,cashFlows:data.cashFlows.filter(v=>v.transferId!==r.transferId)})}}});
};
function openHistory(){
 if(!featureAllowed())return;const labels={trades:'เทรด',plans:'แผน',reviews:'ทบทวน',cashFlows:'เงินเข้าออก',equitySnapshots:'Equity',accounts:'พอร์ต',holdings:'สินทรัพย์',spotTransactions:'ซื้อขายสะสม',spotQuotes:'ราคาประเมิน'};
 wfShow('ประวัติแก้ไข / กู้คืน',`<p>ย้อนการบันทึกได้ทั้งชุด รวมรายการที่เชื่อมกัน เก็บล่าสุดไม่เกิน 30 ครั้ง ภายใน 2 MB ประวัติเริ่มจากรุ่นนี้ ควรสำรอง JSON เป็นระยะ</p>${[...(data.history||[])].reverse().map(h=>`<details><summary>${esc(new Date(h.time).toLocaleString('th-TH'))} · ${h.changes.length} รายการ</summary><p>${h.changes.map(c=>esc(labels[c.key]||c.key)+' '+(c.before===null?'เพิ่ม':c.after===null?'ลบ':'แก้ไข')).join(' · ')}</p><details><summary>ข้อมูลก่อนและหลัง</summary><pre class="review-summary">${esc(JSON.stringify(h.changes,null,2))}</pre></details><button data-undo="${esc(h.id)}">ย้อนการบันทึกชุดนี้</button></details>`).join('')||'<p>ยังไม่มีประวัติการเปลี่ยนแปลง</p>'}`);
 $$('[data-undo]').forEach(b=>b.onclick=()=>{if(confirm('ย้อนการบันทึกชุดนี้? จะตรวจความสอดคล้องก่อนบันทึก'))wfCommit(()=>WorkflowCore.restore(data,b.dataset.undo),openHistory)});
}
$('#workflow-history').onclick=openHistory;
function downloadText(text,name,type){const url=URL.createObjectURL(new Blob([text],{type})),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)}
function openCsv(){
 if(!featureAllowed())return;let preview=null,previewRevision=null,readVersion=0;
 if(!wfShow('นำเข้า Futures CSV',`<p>ใช้รูปแบบ LittleApp สำหรับรายการ Futures เปิด/ปิดทั้งดีล ไฟล์จากโบรกเกอร์ต้องจัดคอลัมน์ก่อน ไม่ใช้ไฟล์นี้นำเข้าไม้เพิ่มหรือปิดบางส่วน</p><button id="csv-template">ดาวน์โหลดตัวอย่าง CSV</button><form id="csv-form"><div class="form-grid">${options('พอร์ตปลายทาง','accountId',[['','เลือกพอร์ต'],...accounts().map(a=>[a.id,accountName(a.id)])],accounts().some(a=>a.id===selectedAccount())?selectedAccount():'')}<label>ไฟล์ CSV (ไม่เกิน 1 MB / 500 แถว)<input name="file" type="file" accept=".csv,text/csv" required></label></div><p>reference คือรหัสรายการต้นทาง ควรกรอกให้คงเดิมเพื่อป้องกันนำเข้าซ้ำ หากเว้นว่างจะตรวจซ้ำจากตัวเลขหลัก รายการจริงที่เหมือนกันทุกช่องควรใช้ reference ต่างกัน</p><button type="submit">ตรวจและดูตัวอย่าง</button></form><div id="csv-preview"></div><button id="csv-confirm" class="primary" disabled>ยืนยันนำเข้า</button>`))return;
 $('#csv-template').onclick=()=>downloadText('reference,asset,side,date,entry,quantity,multiplier,exit,closeDate,fee,funding,note\nexample-001,XAUUSD,Long,2026-09-20,4250,0.01,100,4300,2026-09-21,0,0,ตัวอย่างให้ลบก่อนนำเข้าจริง\n','LittleApp-futures-template.csv','text/csv;charset=utf-8');
 $('#csv-form').onchange=()=>{readVersion++;preview=null;$('#csv-confirm').disabled=true;$('#csv-preview').textContent='เลือกข้อมูลแล้ว กรุณาตรวจตัวอย่างอีกครั้ง'};
 $('#csv-form').onsubmit=async e=>{e.preventDefault();const version=++readVersion;preview=null;$('#csv-confirm').disabled=true;$('#workflow-error').textContent='';try{
  const form=e.target,file=form.elements.file.files[0],account=form.elements.accountId.value;if(!accounts().some(a=>a.id===account))throw Error('เลือกพอร์ตปลายทาง');if(!file||file.size>1000000)throw Error('ไฟล์ต้องไม่เกิน 1 MB');const text=await file.text();if(!form.isConnected||version!==readVersion||!$('#workflow-dialog').open)return;
  preview=WorkflowCore.importTrades(data,text,account,()=>crypto.randomUUID());previewRevision=cloudRevision;
  if(!valid(preview.next))preview.issues.push('ข้อมูลรวมไม่ผ่านการตรวจสอบหรือเกินจำนวนที่รองรับ');
  $('#csv-preview').innerHTML=`<p>พร้อมเพิ่ม ${preview.rows.length} · ข้ามซ้ำ ${preview.duplicates} · ผิดพลาด ${preview.issues.length}</p><p>${preview.issues.map(esc).join('<br>')}</p>${gridTable(['วันที่','สินทรัพย์','ทิศทาง','จำนวน','เข้า → ออก'],preview.rows.slice(0,30).map(r=>`<tr><td>${esc(r.date)}</td><td>${esc(r.asset)}</td><td>${esc(r.side)}</td><td>${qty(r.quantity)}</td><td>${money(r.entry)} → ${r.exit===null?'เปิดอยู่':money(r.exit)}</td></tr>`))}<p>แสดงตัวอย่างสูงสุด 30 แถว ต้องไม่มีข้อผิดพลาดจึงนำเข้าได้ ไม่มีการเขียนทับรายการเดิม</p>`;
  $('#csv-confirm').disabled=!!preview.issues.length||!preview.rows.length;
 }catch(error){$('#workflow-error').textContent=error.message}};
 $('#csv-confirm').onclick=()=>{if(!preview||preview.issues.length)return;if(cloudRevision!==previewRevision){$('#workflow-error').textContent='ข้อมูลเปลี่ยนแล้ว กรุณาตรวจตัวอย่างอีกครั้ง';return}wfCommit(()=>preview.next,()=>$('#workflow-dialog').close())};
}
$('#workflow-import').onclick=openCsv;
render=function(){wfRender();if(view==='journal')$$('[data-journal-kind="trade"]').forEach(b=>{const t=data.trades.find(r=>r.id===b.dataset.journalId);if(t&&(t.exit===null||t.entries?.length))b.insertAdjacentHTML('afterend',`<button class="row-action" data-scale="${esc(t.id)}">เพิ่มไม้ / ราคาเข้า</button>`)});if(view==='analytics'&&insightTab==='calendar')$('[name="analytics-basis"]').disabled=true};
resetCloudUser=function(user){$('#workflow-dialog').close();analyticsBasis='deal';wfReset(user)};
render();
