// LittleApp v3: transactions, monthly reporting, plans and reviews.
let featureMode='',featureId=null,featureImage='',featureSession=0,imageBusy=false;
let reportMonth=date().slice(0,7),reportDay='';
const legacyRender=render,legacySwitch=switchView,legacyOpen=openEditor;
const extraViews=['portfolio','reports','plans','reviews'];
const listOf=k=>data[k]||[];
const selectedAccount=()=>$('#account-filter').value==='all'?'unassigned':$('#account-filter').value;
const selectedStrategy=()=>$('#strategy-filter').value==='all'?'ทั่วไป':$('#strategy-filter').value;
const shown=r=>r.currency===currency&&accountMatches(r)&&strategyMatches(r);
const meta=r=>esc(accountName(r.accountId))+' · '+esc(r.strategy||'ทั่วไป');
const qty=n=>Number(n).toLocaleString('en-US',{maximumFractionDigits:8});
const signed=n=>`<span class="${n>=0?'positive':'negative'}">${n>=0?'+':''}${money(n)}</span>`;
const numeric=(label,name,v=0,min=0)=>field(label,name,'number',v,`required min="${min}" step="any"`);
const options=(label,name,items,value)=>`<label>${label}<select name="${name}">${items.map(i=>{const [v,t]=Array.isArray(i)?i:[i,i];return `<option value="${esc(v)}" ${v===value?'selected':''}>${esc(t)}</option>`}).join('')}</select></label>`;
const textarea=(label,name,value='')=>`<label class="note-label">${label}<textarea name="${name}" maxlength="3000" rows="3">${esc(value)}</textarea></label>`;
const commonFields=r=>accountField(r.accountId||selectedAccount())+options('กลยุทธ์','strategy',['ทั่วไป','Grid','Rebalance'],r.strategy||selectedStrategy());
function gridTable(headers,rows){return `<div class="table-wrap"><table><thead><tr>${headers.map(h=>`<th>${h}</th>`).join('')}</tr></thead><tbody>${rows.join('')}</tbody></table></div>`}
function actionButtons(kind,id){return `<button class="row-action" data-feature-edit="${kind}" data-id="${esc(id)}">แก้ไข</button><button class="row-action" data-feature-delete="${kind}" data-id="${esc(id)}">ลบ</button>`}
function featureAllowed(){if(!cloudReady||cloudBusy){toast('กรุณาโหลดข้อมูลให้สำเร็จก่อน');return false}return true}
function renderPortfolio(){
  const result=LittleCore.ledger(data),ps=result.positions.filter(shown),open=ps.filter(p=>p.quantity>0),sales=result.sales.filter(shown);
  $('#stats').innerHTML=stat('มูลค่าคงเหลือ',money(open.reduce((s,p)=>s+p.market,0)),currency,'ตามราคาประเมินที่กรอก','◈')+stat('ต้นทุนคงเหลือ',money(open.reduce((s,p)=>s+p.basis,0)),currency,'รวมค่าธรรมเนียมซื้อ','▤')+stat('กำไรที่ยังไม่ขาย',money(open.reduce((s,p)=>s+p.unrealized,0)),currency,'ไม่รวมค่าขายในอนาคต','↗')+stat('กำไรที่ขายแล้ว',money(sales.reduce((s,p)=>s+p.profit,0)),currency,'ทุกช่วงเวลา · หักค่าธรรมเนียม','✓');
  const rows=ps.map((p,i)=>`<tr><td><b>${esc(p.symbol)}</b><br><small>${meta(p)}</small></td><td>${qty(p.quantity)}</td><td>${money(p.cost)}</td><td>${money(p.current)} <button class="row-action" data-price="${i}">อัปเดต</button></td><td>${signed(p.unrealized)}</td><td>${signed(p.realized)}</td><td>${p.quantity>0?`<button class="row-action" data-sell="${i}">ขาย</button>`:''}</td></tr>`);
  const events=result.events.filter(shown).reverse().map(r=>{const sale=sales.find(s=>s.id===r.id&&!r.opening);return `<tr><td>${esc(r.time.replace('T',' '))}</td><td>${r.opening?'ยอดยกมา':r.type==='Buy'?'ซื้อ':'ขาย'}</td><td>${esc(r.symbol)}<br><small>${meta(r)}</small></td><td>${qty(r.quantity)}</td><td>${money(r.price)}</td><td>${money(r.fee)}</td><td>${sale?signed(sale.profit):'—'}</td><td>${r.opening?`<button class="row-action" data-opening="${esc(r.id)}">แก้ไขยอดยกมา</button>`:actionButtons('spot',r.id)}</td></tr>`});
  $('#feature-page').innerHTML=`<article class="panel"><h2>จำนวนคงเหลือและต้นทุนเฉลี่ย</h2><p>แยกต้นทุนตามพอร์ต สินทรัพย์ สกุลเงิน และกลยุทธ์ · ราคาประเมินเริ่มจากรายการล่าสุดจนกว่าคุณจะอัปเดต</p>${rows.length?gridTable(['สินทรัพย์ / พอร์ต','คงเหลือ','ต้นทุนเฉลี่ย / หน่วย','ราคาประเมิน / หน่วย','ยังไม่ขาย','ขายแล้ว',''],rows):'<p class="empty">ยังไม่มีรายการในตัวกรองนี้</p>'}</article><article class="panel"><h2>ประวัติซื้อ–ขาย</h2><p>รายการเดิมเป็นยอดยกมา ไม่ได้สร้างประวัติขายย้อนหลัง · ถ้าเวลาเท่ากัน ระบบใช้ลำดับที่บันทึก</p>${gridTable(['วันที่ / เวลา','รายการ','สินทรัพย์','จำนวน','ราคา / หน่วย','ค่าธรรมเนียม','กำไรขาย',''],events)}</article>`;
  $$('[data-price]').forEach(b=>b.onclick=()=>openFeature('price',null,ps[+b.dataset.price]));
  $$('[data-sell]').forEach(b=>b.onclick=()=>openFeature('spot',null,{...ps[+b.dataset.sell],type:'Sell',price:ps[+b.dataset.sell].current,fee:0,note:''}));
  $$('[data-opening]').forEach(b=>b.onclick=()=>legacyOpen(b.dataset.opening));
}
function monthlyRows(){return LittleCore.realized(data).filter(r=>shown(r)&&r.date.slice(0,7)===reportMonth)}
function reportGroups(rows,group){const totals=new Map();for(const r of rows){const label=group(r),v=totals.get(label)||{sum:0,count:0};v.sum+=r.profit;v.count++;totals.set(label,v)}return gridTable(['กลุ่ม','รายการปิด / ขาย','กำไรสุทธิ'],[...totals].map(([name,v])=>`<tr><td>${esc(name)}</td><td>${v.count}</td><td>${signed(v.sum)}</td></tr>`))}
function renderReports(){
  const rows=monthlyRows(),sum=rows.reduce((s,r)=>s+r.profit,0),wins=rows.filter(r=>r.profit>0).length;
  $('#stats').innerHTML=stat('กำไรสุทธิเดือนนี้',money(sum),currency,'วันที่ปิด Futures / วันที่ขาย Spot','▥')+stat('รายการปิด / ขาย',rows.length,'รายการ','ไม่รวมรายการเปิดและกำไรที่ยังไม่ขาย','✓')+stat('อัตราชนะ',rows.length?money(wins/rows.length*100,'USD'):'—','%',`${wins} รายการมีกำไร`,'◎')+stat('วันที่มีผลลัพธ์',new Set(rows.map(r=>r.date)).size,'วัน','เฉพาะข้อมูลที่บันทึกไว้','▦');
  const [year,month]=reportMonth.split('-').map(Number),days=new Date(year,month,0).getDate(),offset=(new Date(year,month-1,1).getDay()+6)%7;
  const byDay=new Map();rows.forEach(r=>{const old=byDay.get(r.date)||{profit:0,count:0};old.profit+=r.profit;old.count++;byDay.set(r.date,old)});
  $('#feature-page').innerHTML=`<article class="panel"><div class="panel-title"><h2>ปฏิทินกำไรขาดทุน</h2><label>เดือน <input id="report-month" type="month" value="${reportMonth}" min="1900-01" max="9999-12"></label></div><p>แยกตามสกุลเงินที่เลือก · ไม่มีการแปลงค่าเงิน · เลือกวันเพื่อดูรายละเอียด</p><div class="pnl-calendar">${['จ','อ','พ','พฤ','ศ','ส','อา'].map(v=>`<b>${v}</b>`).join('')}${'<div></div>'.repeat(offset)}${Array.from({length:days},(_,i)=>{const d=reportMonth+'-'+String(i+1).padStart(2,'0'),v=byDay.get(d);return `<button data-day="${d}" class="calendar-day ${v?v.profit>=0?'profit-day':'loss-day':''}"><b>${i+1}</b><span>${v?money(v.profit):'—'}</span><small>${v?v.count+' รายการ':''}</small></button>`}).join('')}</div><div id="day-detail"></div></article><article class="panel"><h2>เปรียบเทียบพอร์ต</h2>${reportGroups(rows,r=>accountName(r.accountId))}</article><article class="panel"><h2>เปรียบเทียบโบรกเกอร์</h2>${reportGroups(rows,r=>accounts().find(a=>a.id===r.accountId)?.broker||'ยังไม่ระบุ')}</article><article class="panel"><h2>เปรียบเทียบกลยุทธ์</h2>${reportGroups(rows,r=>r.strategy||'ทั่วไป')}</article>`;
  $('#report-month').onchange=e=>{if(/^\d{4}-\d{2}$/.test(e.target.value)&&+e.target.value.slice(5)>=1&&+e.target.value.slice(5)<=12){reportMonth=e.target.value;reportDay='';render()}};
  $$('[data-day]').forEach(b=>b.onclick=()=>{reportDay=b.dataset.day;showDay()});showDay();
}
function showDay(){const rows=monthlyRows().filter(r=>r.date===reportDay);$('#day-detail').innerHTML=reportDay?`<h3>${esc(reportDay)}</h3>${rows.length?gridTable(['สินทรัพย์','พอร์ต / กลยุทธ์','ประเภท','กำไร'],rows.map(r=>`<tr><td>${esc(r.symbol||r.asset)}</td><td>${meta(r)}</td><td>${r.source}</td><td>${signed(r.profit)}</td></tr>`)):'<p>ไม่มีรายการปิดหรือขายวันนี้</p>'}`:''}
function renderPlans(){
  const rows=listOf('plans').filter(p=>shown({...p,currency:LittleCore.sizing(p).currency}));
  $('#feature-page').innerHTML=`<article class="panel"><h2>แผนก่อนเข้าเทรด</h2><p>ขนาดสถานะปัดลงตามขั้นจำนวนที่คุณกำหนด · ไม่ใช่คำสั่งซื้อขายจริง และราคา Stop Loss ไม่รับประกันราคาปิด</p>${rows.length?gridTable(['วันที่ / พอร์ต','สัญญา / ทิศทาง','เข้า / SL / TP','จำนวนที่คำนวณ','ขาดทุนประมาณ / เป้ากำไร','สถานะ',''],rows.map(p=>{const s=LittleCore.sizing(p);return `<tr><td>${esc(p.date)}<br><small>${meta(p)}</small></td><td>${p.asset} · ${p.side}</td><td>${money(p.entry,'USD')} / ${money(p.stop,'USD')} / ${money(p.target,'USD')}</td><td>${qty(s.quantity)}<br><small>R:R ${money(s.rr,'USD')}</small></td><td>${money(s.riskUsed,s.currency)} / ${money(s.expected,s.currency)} ${s.currency}</td><td>${esc(p.status)}</td><td>${actionButtons('plan',p.id)}</td></tr>`})): '<p class="empty">เพิ่มแผนเพื่อคำนวณขนาดสถานะก่อนเข้าเทรด</p>'}</article>`;
}
function renderReviews(){
  const rows=listOf('reviews').filter(r=>accountMatches(r)&&strategyMatches(r)).sort((a,b)=>b.date.localeCompare(a.date));
  $('#feature-page').innerHTML=`<p>สมุดทบทวนแสดงทุกสกุลเงิน โดยกรองตามพอร์ตและกลยุทธ์</p><div class="review-grid">${rows.map(r=>{const linked=[...data.trades,...listOf('spotTransactions')].find(t=>t.id===r.tradeId);return `<article class="panel review-card"><div class="panel-title"><h2>${esc(r.title)}</h2><span class="tag">${esc(r.emotion)}</span></div><p>${esc(r.date)} · ${meta(r)}</p><p>${r.tradeId?'อ้างอิง: '+esc(linked?linked.symbol||linked.asset:'รายการเดิมถูกลบ'):'บันทึกอิสระ'}</p>${r.image?`<a href="${r.image}" download="LittleApp-chart.jpg"><img src="${r.image}" alt="ภาพกราฟประกอบบันทึก ${esc(r.title)}" loading="lazy"></a>`:''}${[['เหตุผลเข้า',r.entryReason],['เหตุผลออก',r.exitReason],['ข้อผิดพลาด',r.mistakes],['บทเรียน',r.lesson],['บันทึกเพิ่มเติม',r.note]].filter(v=>v[1]).map(([title,text])=>`<h3>${title}</h3><p class="preserve-lines">${esc(text)}</p>`).join('')}<div>${actionButtons('review',r.id)}</div></article>`}).join('')||'<article class="panel empty">ยังไม่มีบันทึกทบทวนในพอร์ตนี้</article>'}</div>`;
}
render=function(){
  if(!extraViews.includes(view)){$('#feature-page').hidden=true;$('#stats').hidden=false;$('.records-panel').hidden=false;legacyRender();return}
  renderAccounts();$('#feature-page').hidden=false;$('#overview').hidden=true;$('.records-panel').hidden=true;
  $('#direction-label').hidden=true;$('#contract-label').hidden=true;$('#stats').hidden=['plans','reviews'].includes(view);
  if(view==='portfolio')renderPortfolio();if(view==='reports')renderReports();if(view==='plans')renderPlans();if(view==='reviews')renderReviews();
  $$('[data-feature-edit]').forEach(b=>b.onclick=()=>openFeature(b.dataset.featureEdit,b.dataset.id));
  $$('[data-feature-delete]').forEach(b=>b.onclick=async()=>{
    if(!featureAllowed()||!confirm('ลบรายการนี้หรือไม่?'))return;
    const collection={spot:'spotTransactions',plan:'plans',review:'reviews'}[b.dataset.featureDelete],next={...data,[collection]:listOf(collection).filter(r=>r.id!==b.dataset.id)};
    try{LittleCore.ledger(next)}catch(e){toast('ลบไม่ได้: '+e.message);return}
    if(await save(next))toast('ลบรายการแล้ว');
  });
};
switchView=function(v){legacySwitch(v);const names={portfolio:['พอร์ตสะสม','ประวัติซื้อ–ขาย และต้นทุนของคุณ','＋ ซื้อ / ขาย'],reports:['รายงานรายเดือน','มองเห็นผลลัพธ์ ในทุกเดือน',''],plans:['แผนก่อนเทรด','กำหนดแผน ก่อนตัดสินใจ','＋ เพิ่มแผน'],reviews:['สมุดทบทวน','เรียนรู้จากการตัดสินใจของคุณ','＋ เขียนทบทวน']};$('#add').hidden=v==='reports';if(names[v]){$('#breadcrumb').textContent=names[v][0];$('#page-title').textContent=names[v][1];$('#page-subtitle').textContent='ข้อมูลแยกตามพอร์ตและกลยุทธ์ของคุณ';$('#add').textContent=names[v][2]}};
openEditor=function(id){if(view==='portfolio')openFeature('spot',id);else if(view==='plans')openFeature('plan',id);else if(view==='reviews')openFeature('review',id);else legacyOpen(id)};
function openFeature(mode,id,seed={}){
  if(!featureAllowed())return;featureSession++;imageBusy=false;featureMode=mode;featureId=id||null;
  const collection={spot:'spotTransactions',plan:'plans',review:'reviews'}[mode],r=id?listOf(collection).find(r=>r.id===id):seed;if(!r)return;
  featureImage=r.image||'';$('#feature-error').textContent='';$('#feature-extra').innerHTML='';
  $('#feature-title').textContent={spot:'บันทึกซื้อ–ขายสินทรัพย์',price:'อัปเดตราคาประเมิน',plan:'แผนก่อนเข้าเทรด',review:'สมุดทบทวน'}[mode];
  let fields='';
  if(mode==='price'){
    featureId=r.key;fields=`<p>${esc(r.symbol)} · ${meta(r)}</p>`+numeric('ราคาประเมิน / หน่วย ('+r.currency+')','price',r.current);
  }else if(mode==='spot'){
    fields=commonFields(r)+options('ซื้อ / ขาย','type',['Buy','Sell'],r.type||'Buy')+field('วันที่และเวลา (เวลาไทยตามที่กรอก)','time','datetime-local',id?r.time:date()+'T12:00','required')+options('สินทรัพย์','asset',['หุ้นไทย','ทองคำแท่ง','บิทคอยน์'],r.asset||'หุ้นไทย')+field('ชื่อหุ้น / สินทรัพย์','symbol','text',r.symbol||'','required maxlength="30" placeholder="เช่น PTT, GOLD96.5, BTC"')+options('สกุลเงิน','currency',currencies,r.currency||currency)+numeric('จำนวน (หุ้น / บาททองคำ / BTC)','quantity',r.quantity||'',1e-10)+numeric('ราคา / หน่วย','price',r.price||'',1e-10)+numeric('ค่าธรรมเนียม ('+(r.currency||currency)+')','fee',r.fee||0);
    $('#feature-extra').innerHTML='<p>ใช้ชื่อสินทรัพย์ พอร์ต และกลยุทธ์เดียวกันสำหรับรายการซื้อและขาย ระบบคิดต้นทุนเฉลี่ยแยกแต่ละกลุ่ม</p>'+textarea('บันทึก','note',r.note||'');
  }else if(mode==='plan'){
    fields=commonFields(r)+field('วันที่','date','date',r.date||date(),'required')+options('สถานะ','status',['รอเข้า','เข้าแล้ว','ยกเลิก'],r.status||'รอเข้า')+options('สัญญา','asset',['XAUUSD','BTCUSDT','BTCUSD'],r.asset||'XAUUSD')+options('ทิศทาง','side',['Long','Short'],r.side||'Long')+numeric('ราคาเข้า','entry',r.entry||'',1e-10)+numeric('Stop Loss','stop',r.stop||'',1e-10)+numeric('Take Profit','target',r.target||'',1e-10)+numeric('ตัวคูณ (Inverse ใช้ USD / สัญญา)','multiplier',r.multiplier||1,1e-10)+numeric('วงเงินขาดทุนสูงสุด รวมค่าเผื่อ','risk',r.risk||'',1e-10)+numeric('เผื่อค่าธรรมเนียมและ Slippage รวม','feeReserve',r.feeReserve||0)+numeric('ขั้นจำนวนขั้นต่ำ เช่น 0.01 หรือ 1','step',r.step||.01,1e-10);
    $('#feature-extra').innerHTML='<p id="plan-unit"></p><div id="plan-result" class="plan-result" role="status"></div>'+textarea('เหตุผลและแผนรับมือ','note',r.note||'');
  }else{
    const choices=[['','ไม่ผูกกับรายการ'],...data.trades.map(t=>[t.id,t.date+' · '+t.asset+' · '+accountName(t.accountId)]),...listOf('spotTransactions').map(t=>[t.id,t.date+' · '+t.symbol+' · '+t.type])];
    if(r.tradeId&&!choices.some(c=>c[0]===r.tradeId))choices.push([r.tradeId,'รายการเดิมถูกลบ']);
    fields=commonFields(r)+field('วันที่ทบทวน','date','date',r.date||date(),'required')+field('หัวข้อ','title','text',r.title||'','required maxlength="100"')+options('อารมณ์','emotion',['นิ่ง','มั่นใจ','กลัว','โลภ','เสียดาย','เครียด'],r.emotion||'นิ่ง')+options('ผูกกับการเทรด / ซื้อขาย','tradeId',choices,r.tradeId||'');
    $('#feature-extra').innerHTML=textarea('เหตุผลเข้า','entryReason',r.entryReason||'')+textarea('เหตุผลออก','exitReason',r.exitReason||'')+textarea('ข้อผิดพลาด','mistakes',r.mistakes||'')+textarea('บทเรียนครั้งต่อไป','lesson',r.lesson||'')+textarea('บันทึกเพิ่มเติม','note',r.note||'')+'<label class="note-label">ภาพกราฟ (JPEG / PNG / WebP ไม่เกิน 5 MB)<input type="file" id="review-image" accept="image/jpeg,image/png,image/webp"></label><p>เก็บภาพบีบอัดหนึ่งภาพต่อบันทึก สูงสุดประมาณ 250 KB ใช้พื้นที่ฐานข้อมูลร่วมกับสมุดบันทึก</p><div id="image-preview"></div><button type="button" id="remove-image" class="text-button">นำภาพออก</button>';
  }
  $('#feature-fields').innerHTML=fields;
  $('#feature-form').oninput=()=>{if(featureMode==='plan')previewPlan()};
  if(mode==='plan')previewPlan();if(mode==='review'){previewImage();$('#review-image').onchange=readImage;$('#remove-image').onclick=()=>{featureSession++;featureImage='';imageBusy=false;$('#review-image').value='';previewImage()}}
  $('#feature-dialog').showModal();
}
function planFromForm(){const p=Object.fromEntries(new FormData($('#feature-form')));for(const k of ['entry','stop','target','multiplier','risk','feeReserve','step'])p[k]=Number(p[k]);return p}
function previewPlan(){const p=planFromForm(),unit=p.asset==='BTCUSD'?'BTC':p.asset==='XAUUSD'?'USD':'USDT';$('#plan-unit').textContent='วงเงินขาดทุนและค่าเผื่อใช้ '+unit+' · ราคาเข้า / SL / TP ใช้ '+(p.asset==='BTCUSDT'?'USDT':'USD')+' · ไม่ได้คำนวณเงินมาร์จินหรือ Liquidation';try{const s=LittleCore.sizing(p);$('#plan-result').textContent=`จำนวน ${qty(s.quantity)} · ขาดทุนประมาณ ${money(s.riskUsed,s.currency)} ${s.currency} · เป้ากำไรสุทธิ ${money(s.expected,s.currency)} ${s.currency} · R:R ${money(s.rr,'USD')}${s.quantity===0?' · วงเงินไม่พอสำหรับขั้นจำนวนนี้':''}`}catch(e){$('#plan-result').textContent=e.message}}
function previewImage(){$('#image-preview').innerHTML=featureImage?`<img src="${featureImage}" alt="ภาพแนบที่เลือก">`:''}
async function readImage(e){
  const file=e.target.files[0];if(!file)return;const session=++featureSession;
  if(!['image/jpeg','image/png','image/webp'].includes(file.type)||file.size>5*1024*1024){$('#feature-error').textContent='ใช้ JPEG, PNG หรือ WebP ขนาดไม่เกิน 5 MB';return}
  imageBusy=true;$('#feature-error').textContent='กำลังเตรียมภาพ…';
  const url=URL.createObjectURL(file);
  try{
    const img=new Image();await new Promise((resolve,reject)=>{img.onload=resolve;img.onerror=reject;img.src=url});
    let scale=Math.min(1,1400/Math.max(img.width,img.height)),encoded='';
    const canvas=document.createElement('canvas');
    for(let i=0;i<6;i++){canvas.width=Math.max(1,Math.round(img.width*scale));canvas.height=Math.max(1,Math.round(img.height*scale));const c=canvas.getContext('2d');c.fillStyle='#fff';c.fillRect(0,0,canvas.width,canvas.height);c.drawImage(img,0,0,canvas.width,canvas.height);encoded=canvas.toDataURL('image/jpeg',.8);if(encoded.length<=330000)break;scale*=.75}
    if(encoded.length>330000)throw Error('ภาพใหญ่เกินไป');
    if(session===featureSession){featureImage=encoded;previewImage();$('#feature-error').textContent='ภาพพร้อมบันทึก'}
  }catch{if(session===featureSession)$('#feature-error').textContent='อ่านภาพไม่สำเร็จ กรุณาเลือกไฟล์ใหม่'}finally{URL.revokeObjectURL(url);if(session===featureSession)imageBusy=false}
}
$('#feature-close').onclick=()=>{featureSession++;imageBusy=false;$('#feature-dialog').close()};
$('#feature-dialog').addEventListener('cancel',()=>{featureSession++;imageBusy=false});
$('#feature-form').onsubmit=async e=>{
  e.preventDefault();if(!featureAllowed())return;if(imageBusy){$('#feature-error').textContent='รอเตรียมภาพให้เสร็จก่อน';return}
  let r=Object.fromEntries(new FormData(e.target)),next;
  if(featureMode==='price'){next={...data,spotQuotes:[...listOf('spotQuotes').filter(q=>q.key!==featureId),{key:featureId,price:Number(r.price)}]}}
  else{
    const collection={spot:'spotTransactions',plan:'plans',review:'reviews'}[featureMode];
    r.id=featureId||crypto.randomUUID();
    if(featureMode==='spot'){r.quantity=Number(r.quantity);r.price=Number(r.price);r.fee=Number(r.fee);r.date=r.time.slice(0,10);r.symbol=r.symbol.trim().toUpperCase()}
    if(featureMode==='plan'){r={...planFromForm(),id:r.id};try{LittleCore.sizing(r)}catch(error){$('#feature-error').textContent=error.message;return}}
    if(featureMode==='review')r.image=featureImage;
    next={...data,[collection]:featureId?listOf(collection).map(v=>v.id===featureId?r:v):[...listOf(collection),r]};
  }
  try{LittleCore.ledger(next)}catch(error){$('#feature-error').textContent=error.message;return}
  if(!valid(next)){$('#feature-error').textContent='ข้อมูลไม่ถูกต้อง ตรวจวันที่ ชื่อสินทรัพย์ และขนาดตัวเลข';return}
  const dialogSession=featureSession;$('#feature-form').inert=true;
  try{if(await save(next)){if(dialogSession===featureSession)$('#feature-dialog').close();toast('บันทึกออนไลน์แล้ว')}else{$('#feature-error').textContent='ยังบันทึกไม่สำเร็จ ตรวจสถานะการเชื่อมต่อและขนาดข้อมูล'}}finally{$('#feature-form').inert=false}
};
render();
