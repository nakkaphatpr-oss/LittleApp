// Three primary workspaces, with contextual links into the existing editors.
let insightTab='summary',reviewTradeFilter='';
const leanRender=render,leanSwitch=switchView,leanAnalytics=renderAnalytics,leanReviews=renderReviews,leanJournal=openJournal;
function sourceRecord(id){return data.trades.find(r=>r.id===id)||listOf('spotTransactions').find(r=>r.id===id)}
function reviewButton(id){const count=listOf('reviews').filter(r=>r.tradeId===id).length;return `<button class="row-action" data-linked-review="${esc(id)}">ทบทวน${count?' ('+count+')':''}</button>`}
function openRecord(id){
  const r=sourceRecord(id);if(!r){toast('รายการต้นทางถูกลบแล้ว');return}
  if($('#feature-dialog').open&&$('#feature-dialog').dataset.dirty==='1'&&!confirm('มีข้อมูลที่ยังไม่บันทึก ต้องการเปิดรายการต้นทางหรือไม่?'))return;
  if($('#feature-dialog').open)$('#feature-dialog').close();
  if(data.trades.some(t=>t.id===id))openJournal('trade',id);else openFeature('spot',id);
}
function linkedReviews(id){
  if(!featureAllowed())return;const r=sourceRecord(id);if(!r)return;
  const rows=listOf('reviews').filter(v=>v.tradeId===id).sort((a,b)=>b.date.localeCompare(a.date));
  $('#linked-review-content').innerHTML=`<h2>ทบทวน ${esc(r.symbol||r.asset)}</h2><p>${esc(accountName(r.accountId))} · ${esc(r.date)}</p>${rows.length?rows.map(v=>`<p><button class="text-button" data-open-review="${esc(v.id)}">${esc(v.date)} · ${esc(v.title)}</button></p>`).join(''):'<p>ยังไม่มีบททบทวนสำหรับรายการนี้</p>'}<button class="primary" data-new-linked-review="${esc(id)}">＋ เขียนทบทวนรายการนี้</button>`;
  $('#linked-review-dialog').showModal();
}
document.addEventListener('click',e=>{
  const b=e.target.closest('button');if(!b)return;
  if(b.dataset.linkedReview)linkedReviews(b.dataset.linkedReview);
  if(b.dataset.openRecord)openRecord(b.dataset.openRecord);
  if(b.dataset.openReview){$('#linked-review-dialog').close();openFeature('review',b.dataset.openReview)}
  if(b.dataset.newLinkedReview){
    const r=sourceRecord(b.dataset.newLinkedReview);if(!r)return;$('#linked-review-dialog').close();
    openFeature('review',null,{tradeId:r.id,accountId:r.accountId,strategy:r.strategy||'ทั่วไป',title:'ทบทวน '+(r.symbol||r.asset),date:date(),note:'',entryReason:'',exitReason:'',mistakes:'',lesson:''});
  }
});
$('#linked-review-close').onclick=()=>$('#linked-review-dialog').close();
openJournal=function(kind,id){
  leanJournal(kind,id);if(!$('#journal-dialog').open)return;
  const t=data.trades.find(t=>t.id===id);
  $('#journal-related').innerHTML=t?`<p>ภาพกราฟ เหตุผลเข้าออก และบทเรียนอยู่กับรายการนี้</p>${reviewButton(t.id)}`:'<p>บันทึกรายการเปิดจริงก่อน แล้วจึงแนบภาพและเขียนทบทวนได้</p>';
};
function calendarPanel(rows){
  const month=analyticsAnchor.slice(0,7),year=+month.slice(0,4),m=+month.slice(5),days=new Date(Date.UTC(year,m,0)).getUTCDate(),offset=(new Date(month+'-01T00:00:00Z').getUTCDay()+6)%7;
  const daily=new Map();rows.forEach(r=>{const old=daily.get(r.date)||{profit:0,count:0};old.profit+=r.profit;old.count++;daily.set(r.date,old)});
  const max=Math.max(1,...[...daily.values()].map(r=>Math.abs(r.profit)));
  return `<article class="panel"><h2>ปฏิทิน ${esc(month)}</h2><p>ใช้ผลและตัวกรองชุดเดียวกับสถิติ · คลิกวันเพื่อเปิดรายการหรือเขียนทบทวน</p><div class="pnl-calendar">${['จ','อ','พ','พฤ','ศ','ส','อา'].map(s=>'<b>'+s+'</b>').join('')}${'<div></div>'.repeat(offset)}${Array.from({length:days},(_,i)=>{const day=month+'-'+String(i+1).padStart(2,'0'),r=daily.get(day);return `<button data-lean-day="${day}" class="calendar-day ${r&&r.profit===0?'flat-day':''}" style="${r&&r.profit?'background:rgba('+(r.profit>0?'103,158,82,':'193,104,83,')+(.08+.24*Math.abs(r.profit)/max)+')':''}"><b>${i+1}</b><span>${r?money(r.profit):'—'}</span><small>${r?r.count+' รายการ':''}</small></button>`}).join('')}</div><div id="lean-day-detail"></div></article>`;
}
function dayDetail(day){
  const rows=analyticsRows().filter(r=>r.date===day);
  $('#lean-day-detail').innerHTML=`<h3>${esc(day)}</h3>${rows.length?gridTable(['รายการ','พอร์ต','กำไรสุทธิ',''],rows.map(r=>`<tr><td>${esc(r.symbol||r.asset)} · ${r.source}</td><td>${meta(r)}</td><td>${signed(r.profit)}</td><td><button class="row-action" data-open-record="${esc(r.id)}">เปิดรายการ</button>${reviewButton(r.id)}</td></tr>`)):'<p>ไม่มีรายการปิดในวันนี้ตามตัวกรองที่เลือก</p>'}`;
}
renderAnalytics=function(){
  if(insightTab==='calendar')analyticsPeriod='month';
  leanAnalytics();
  const page=$('#feature-page'),panels=[...page.children];
  if(insightTab==='calendar'){
    panels.slice(1).forEach(el=>el.remove());page.insertAdjacentHTML('beforeend',calendarPanel(analyticsRows()));
    $('[name="analytics-period"]').disabled=true;
    $$('[data-lean-day]').forEach(b=>b.onclick=()=>dayDetail(b.dataset.leanDay));
    return;
  }
  // Keep the summary short; detailed breakdowns remain one click away.
  for(const panel of panels.slice(2,7)){
    const title=panel.querySelector('h2');if(!title)continue;
    const details=document.createElement('details'),summary=document.createElement('summary');summary.textContent=title.textContent;title.remove();details.className='lean-breakdown';details.append(summary);while(panel.firstChild)details.append(panel.firstChild);panel.append(details);
  }
  const last=panels.at(-1),rows=analyticsRows();
  last?.querySelectorAll('tbody tr').forEach((tr,i)=>{const r=rows[i];if(!r)return;const td=document.createElement('td');td.innerHTML=`<button class="row-action" data-open-record="${esc(r.id)}">เปิดรายการ</button>${reviewButton(r.id)}`;tr.append(td)});
  if(rows.length)last?.querySelector('thead tr')?.insertAdjacentHTML('beforeend','<th>ทำต่อ</th>');
};
renderReviews=function(){
  leanReviews();
  $('#feature-page').insertAdjacentHTML('afterbegin',`<div class="lean-review-filter"><label>ค้นหาบททบทวน <input id="lean-review-search" type="search" placeholder="หัวข้อ เหตุผล หรือบทเรียน"></label><span>ใช้ตัวกรองพอร์ต/กลยุทธ์ · บททบทวนแสดงทุกสกุลเงิน</span></div>`);
  const rows=listOf('reviews').filter(r=>accountMatches(r)&&strategyMatches(r)).sort((a,b)=>b.date.localeCompare(a.date));
  $$('.review-card').forEach((card,i)=>{const r=rows[i];if(r?.tradeId&&sourceRecord(r.tradeId))card.insertAdjacentHTML('beforeend',`<button class="text-button" data-open-record="${esc(r.tradeId)}">เปิดรายการต้นทาง</button>`)});
  $('#lean-review-search').oninput=e=>{const q=e.target.value.trim().toLocaleLowerCase();$$('.review-card').forEach(card=>card.hidden=!card.textContent.toLocaleLowerCase().includes(q))};
};
switchView=function(v){
  if(v==='overview'||v==='plans')v='journal';
  if(v==='reports'){insightTab='calendar';v='analytics'}else if(v==='analytics')insightTab='summary';
  leanSwitch(v);leanNavigation();
};
function leanNavigation(){
  const summary=['analytics','reviews'].includes(view);
  $$('nav [data-view]').forEach(b=>b.classList.toggle('active',b.dataset.view===(summary?'analytics':view)));
  $('#insight-tabs').hidden=!summary;
  $$('[data-insight]').forEach(b=>{const active=b.dataset.insight===(view==='reviews'?'notes':insightTab);b.classList.toggle('selected',active);b.setAttribute('aria-pressed',String(active))});
  if(summary){$('#breadcrumb').textContent='สรุปและทบทวน';$('#page-title').textContent=view==='reviews'?'บทเรียนจากรายการของคุณ':insightTab==='calendar'?'ผลเทรดในแต่ละวัน':'สรุปผลและสิ่งที่ได้เรียนรู้';$('#page-subtitle').textContent='เลือกดูสถิติ ปฏิทิน หรือบททบทวนจากข้อมูลชุดเดียวกัน'}
  if(view==='journal'){$('#breadcrumb').textContent='เทรด';$('#page-title').textContent='วางแผน เทรด และทบทวน';$('#page-subtitle').textContent='รายการเดียว ตั้งแต่รอเข้าจนปิดจริง';}
  if(view==='portfolio')$('#breadcrumb').textContent='สะสม';
  $('.toolbar .segmented').hidden=view==='reviews';
  $('#lean-table-toggle').hidden=view!=='journal';
}
$$('[data-insight]').forEach(b=>b.onclick=()=>{const tab=b.dataset.insight;if(tab==='notes')switchView('reviews');else if(tab==='calendar')switchView('reports');else switchView('analytics')});
render=function(){
  if(view==='overview')view='journal';
  leanRender();leanNavigation();
  if(view==='journal')$$('[data-journal-kind="trade"]').forEach(b=>b.insertAdjacentHTML('afterend',reviewButton(b.dataset.journalId)));
  if(view==='portfolio')$$('[data-feature-edit="spot"]').forEach(b=>b.insertAdjacentHTML('afterend',reviewButton(b.dataset.id)));
  $('#records').classList.toggle('lean-compact',!$('#lean-show-details').checked);
  if(view==='journal'){
    const headings=$$('#records th').map(th=>th.textContent);
    $$('#records tbody tr').forEach(tr=>[...tr.children].forEach((td,i)=>td.dataset.label=headings[i]||''));
  }
};
$('#lean-show-details').onchange=()=>render();
$('#lean-clear-filters').onclick=()=>{
  for(const id of ['account-filter','strategy-filter','direction-filter','contract-filter','filter'])$('#'+id).value='all';
  $('#journal-status').value='ทั้งหมด';analyticsSetup='all';analyticsQuery='';analyticsType='all';render();toast('ล้างตัวกรองแล้ว · คงสกุลเงินและช่วงวันที่เดิม');
};
const leanReset=resetCloudUser;
resetCloudUser=function(user){$('#linked-review-dialog').close();insightTab='summary';reviewTradeFilter='';leanReset(user)};
// Warn only when a user actually changed an editor; successful saves close normally.
for(const id of ['journal-dialog','feature-dialog']){
  const dialog=$('#'+id);dialog.addEventListener('input',()=>dialog.dataset.dirty='1');dialog.addEventListener('change',()=>dialog.dataset.dirty='1');
  dialog.addEventListener('cancel',e=>{if(dialog.dataset.dirty==='1'&&!confirm('มีข้อมูลที่ยังไม่บันทึก ต้องการปิดหรือไม่?')){e.preventDefault();e.stopImmediatePropagation()}},true);
  dialog.addEventListener('close',()=>dialog.dataset.dirty='');
}
for(const [button,id] of [['journal-close','journal-dialog'],['feature-close','feature-dialog']]){
  const old=$('#'+button).onclick;$('#'+button).onclick=e=>{if($('#'+id).dataset.dirty!=='1'||confirm('มีข้อมูลที่ยังไม่บันทึก ต้องการปิดหรือไม่?'))old(e)};
}
switchView('journal');
