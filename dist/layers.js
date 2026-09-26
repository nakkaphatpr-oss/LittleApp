$('.portfolio-toolbar').insertAdjacentHTML('afterbegin',`<label>Layer <select id="layer-filter"><option value="all">ทุก Layer</option>${Object.entries(LayerCore.labels).map(([id,label])=>`<option value="${id}">${label}</option>`).join('')}</select></label>`);
$('#account-form .form-grid').insertAdjacentHTML('beforeend',options('Layer ของพอร์ต','layer',Object.entries(LayerCore.labels),'unclassified').replace('<select name="layer">','<select name="layer" id="account-layer">'));
$('#account-layer').closest('label').insertAdjacentHTML('afterend','<p>หนึ่งพอร์ตย่อยมีหนึ่ง Layer แบ่งตามวัตถุประสงค์ เปลี่ยน Layer แล้วประวัติทั้งหมดของพอร์ตจะจัดตาม Layer ใหม่ ชื่อ Layer ไม่ได้เปลี่ยนความเสี่ยงของสินทรัพย์</p>');
const layerRefresh=accountRefresh;accountRefresh=function(){layerRefresh();$('#account-layer').value=LayerCore.of(accounts().find(a=>a.id===$('#account-picker').value));if($('#account-picker').value==='new'&&$('#layer-filter').value!=='all')$('#account-layer').value=$('#layer-filter').value};
$('#account-layer').onchange=()=>$('#account-dialog').dataset.dirty='1';
const layerAccounts=renderAccounts;renderAccounts=function(){
 const selected=$('#account-filter').value;layerAccounts();const layer=$('#layer-filter').value;
 $('#account-filter').options[0].textContent=layer==='all'?'ทุกพอร์ต':'ทุกพอร์ตใน Layer นี้';
 for(const option of [...$('#account-filter').options]){if(option.value==='all')continue;if(option.value==='unassigned'){if(!['all','unclassified'].includes(layer))option.remove();continue}const a=accounts().find(a=>a.id===option.value);if(layer!=='all'&&LayerCore.of(a)!==layer)option.remove();else option.textContent=accountName(option.value)+' · '+LayerCore.labels[LayerCore.of(a)]}
 $('#account-filter').value=[...$('#account-filter').options].some(o=>o.value===selected)?selected:'all';
};
$('#layer-filter').onchange=()=>{$('#account-filter').value='all';render()};
const layerClear=$('#lean-clear-filters').onclick;$('#lean-clear-filters').onclick=()=>{$('#layer-filter').value='all';layerClear()};
const layerReset=resetCloudUser;resetCloudUser=function(user){$('#layer-filter').value='all';layerReset(user)};
const layerReview=reviewText;reviewText=function(rows,start,end){return 'Layer: '+($('#layer-filter').value==='all'?'ทุก Layer':LayerCore.labels[$('#layer-filter').value])+'\n'+layerReview(rows,start,end)};
function renderLayerSummary(){
 const rows=LayerCore.summary({...data,accounts:accounts()},currency,$('#layer-filter').value,$('#account-filter').value);
 return `<article class="panel" id="layer-summary"><h2>ภาพรวมตาม Layer · ${currency}</h2><p>ตาม Layer และพอร์ตที่เลือก · ผลรับรู้จาก Futures / ขายสินทรัพย์สะสม / Funding รายวัน ทุกช่วงเวลาและทุกกลยุทธ์ ไม่ใช้ช่วงวันที่ของสถิติด้านล่าง · ฝากถอนรวมการโอนระหว่างพอร์ต</p>${gridTable(['Layer','พอร์ต','สถานะเปิด','ฝาก','ถอน','ผลรับรู้'],rows.map(r=>`<tr><td>${r.label}</td><td>${r.ports}</td><td>${r.open}</td><td>${money(r.deposits)}</td><td>${money(r.withdrawals)}</td><td>${signed(r.profit)}</td></tr>`))}<details><summary>Equity ล่าสุดแยกพอร์ต</summary><p>แสดงยอดและเวลาที่บันทึกแต่ละพอร์ต ไม่บวก Equity ต่างเวลากัน หากแบ่งบัญชี Broker เดียวเป็นพอร์ตย่อย ให้กรอกเฉพาะส่วนของแต่ละพอร์ต เพื่อไม่บันทึกยอดทั้งบัญชีซ้ำ</p>${gridTable(['Layer / พอร์ต','เวลาไทย','Equity'],rows.flatMap(r=>r.snapshots.map(p=>`<tr><td>${r.label}<br>${esc(accountName(p.account.id))}</td><td>${p.snapshot?esc(p.snapshot.time.replace('T',' ')):'ยังไม่บันทึก'}</td><td>${p.snapshot?money(p.snapshot.equity):'—'}</td></tr>`)))}</details><p>พอร์ตเดิมและรายการที่ยังไม่ระบุพอร์ตอยู่ใน “ยังไม่จัดหมวด” · เปลี่ยน Layer ได้ที่จัดการพอร์ต · แยกสกุลเงิน ไม่มีการแปลงค่าเงินหรือจัดสัดส่วนทุนอัตโนมัติ</p></article>`;
}
const layerRender=render;render=function(){layerRender();$('#layer-summary')?.remove();if(view==='analytics'&&insightTab==='summary')$('#feature-page').insertAdjacentHTML('afterbegin',renderLayerSummary())};
// Moving a portfolio's records also adopts the destination's classification.
const layerMove=$('#account-move-target').onchange;$('#account-move-target').onchange=()=>{layerMove();const a=accounts().find(a=>a.id===$('#account-move-target').value);if(a)$('#account-delete-preview').textContent+=' · รายการที่ย้ายจะใช้ Layer '+LayerCore.labels[LayerCore.of(a)]};
render();
