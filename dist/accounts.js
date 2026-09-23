// Keep portfolio management in the existing dialog, using free-form broker names.
$('#account-broker').outerHTML='<input id="account-broker" list="broker-suggestions" maxlength="60" required placeholder="เลือกหรือพิมพ์ Broker ใหม่"><datalist id="broker-suggestions"></datalist>';
$('#account-name').required=true;
$('#account-dialog .dialog-head h2').textContent='จัดการพอร์ตและ Broker';
$('#account-form .form-grid').insertAdjacentHTML('afterend','<p>พิมพ์ชื่อ Broker ใหม่ได้ เช่น Binance หรือชื่อโบรกเกอร์ที่ใช้ หนึ่ง Broker มีหลายพอร์ตได้</p><div id="account-usage"></div><details id="account-delete-section" hidden><summary>ลบพอร์ต</summary><p>พอร์ตว่างลบได้ทันที พอร์ตมีข้อมูลต้องย้ายทั้งหมดก่อนลบ ประวัติไม้เข้า/ปิด Funding บททบทวน และเงินทุนจะยังอยู่</p><label>ย้ายข้อมูลไปพอร์ต<select id="account-move-target"></select></label><p id="account-delete-preview"></p><button id="account-delete" type="button">ลบพอร์ตที่เลือก</button></details>');
const accountLabels={trades:'เทรด',holdings:'ยอดสะสมตั้งต้น',plans:'แผน',reviews:'บททบทวน',spotTransactions:'ซื้อขายสะสม',cashFlows:'ฝากถอน',equitySnapshots:'Equity'};
function accountRefresh(){
 const id=$('#account-picker').value,a=accounts().find(a=>a.id===id);$('#account-name').value=a?.name||'';$('#account-broker').value=a?.broker||'';$('#account-error').textContent='';$('#account-dialog').dataset.dirty='';
 const used=a?AccountsCore.usage(data,id):[];
 $('#account-usage').textContent=a?(used.length?'ข้อมูลในพอร์ต: '+used.map(r=>r.count+' '+accountLabels[r.key]).join(' · '):'พอร์ตนี้ยังไม่มีรายการ'):'สร้างพอร์ตใหม่ แล้วพิมพ์ชื่อ Broker ที่ต้องการ';
 $('#account-delete-section').hidden=!a;$('#account-delete-section').open=false;
 $('#account-move-target').innerHTML='<option value="">'+(used.length?'เลือกพอร์ตปลายทาง':'ไม่ย้ายข้อมูล (พอร์ตว่าง)')+'</option>'+accounts().filter(r=>r.id!==id).map(r=>`<option value="${esc(r.id)}">${esc(r.broker+' · '+r.name)}</option>`).join('');
 $('#account-delete-preview').textContent='';$('#account-delete').textContent=used.length?'ย้ายข้อมูลแล้วลบพอร์ต':'ลบพอร์ตว่าง';
}
$('#manage-accounts').onclick=()=>{if(!featureAllowed())return;const selected=selectedAccount();$('#account-picker').innerHTML='<option value="new">＋ สร้างพอร์ตใหม่</option>'+accounts().map(a=>`<option value="${esc(a.id)}">${esc(a.broker+' · '+a.name)}</option>`).join('');$('#account-picker').value=accounts().some(a=>a.id===selected)?selected:'new';$('#broker-suggestions').innerHTML=[...new Set([...BROKERS,...accounts().map(a=>a.broker)])].map(b=>`<option value="${esc(b)}"></option>`).join('');accountRefresh();$('#account-dialog').showModal()};
let accountLast='new';
$('#account-picker').onfocus=()=>accountLast=$('#account-picker').value;
$('#account-picker').onchange=()=>{if($('#account-dialog').dataset.dirty==='1'&&!confirm('มีชื่อที่ยังไม่ได้บันทึก ต้องการเปลี่ยนพอร์ตหรือไม่?')){$('#account-picker').value=accountLast;return}accountRefresh();accountLast=$('#account-picker').value};
for(const id of ['account-name','account-broker'])$('#'+id).oninput=()=>$('#account-dialog').dataset.dirty='1';
$('#account-close').onclick=()=>{if(!cloudBusy&&wfDiscard($('#account-dialog')))$('#account-dialog').close()};
$('#account-dialog').addEventListener('cancel',e=>{if(cloudBusy||!wfDiscard($('#account-dialog')))e.preventDefault()});
$('#account-form').onsubmit=async e=>{e.preventDefault();if(!featureAllowed())return;$('#account-form').inert=true;try{const next=AccountsCore.edit({...data,accounts:accounts()},$('#account-picker').value,$('#account-name').value,$('#account-broker').value,()=>crypto.randomUUID());if(!valid(next))throw Error('ข้อมูลพอร์ตไม่ถูกต้องหรือเกินขีดจำกัด 100 พอร์ต');if(await save(next)){$('#account-dialog').dataset.dirty='';$('#account-dialog').close();toast('บันทึกพอร์ตแล้ว')}}catch(err){$('#account-error').textContent=err.message}finally{$('#account-form').inert=false}};
$('#account-move-target').onchange=()=>{$('#account-error').textContent='';$('#account-delete-preview').textContent=$('#account-move-target').value?'รายการทั้งหมดจะย้ายไป '+accountName($('#account-move-target').value)+' โดยไม่เปลี่ยนราคา จำนวน หรือตัวคูณ':''};
$('#account-delete').onclick=async()=>{
 if(!featureAllowed())return;const id=$('#account-picker').value,target=$('#account-move-target').value;
 try{
  if($('#account-dialog').dataset.dirty==='1')throw Error('มีชื่อที่แก้ยังไม่บันทึก กรุณาบันทึกหรือเปิดพอร์ตใหม่ก่อนลบ');
  const next=AccountsCore.remove({...data,accounts:accounts()},id,target||null);if(!valid(next))throw Error('ข้อมูลปลายทางขัดกัน กรุณาเลือกพอร์ตว่างที่มีเงื่อนไขสัญญาตรงกัน');
  if(!confirm((target?'ย้ายข้อมูลทั้งหมดไป '+accountName(target)+' แล้วลบ ':'ลบพอร์ตว่าง ')+accountName(id)+'? ย้อนคืนได้จากประวัติแก้ไข'))return;
  $('#account-form').inert=true;if(await save(next)){$('#account-filter').value=target||'all';render();$('#account-dialog').close();toast('ลบพอร์ตแล้ว · ย้อนคืนได้จากประวัติแก้ไข')}
 }catch(err){$('#account-error').textContent=err.message}finally{$('#account-form').inert=false}
};
