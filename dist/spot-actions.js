// Summary quantities are derived from transactions: edit their source, never overwrite totals.
function spotSources(key){return LittleCore.ledger(data).events.filter(r=>LittleCore.key(r)===key)}
function editSpotPosition(key){
 if(!featureAllowed())return;const rows=spotSources(key);if(!rows.length){toast('ไม่พบรายการต้นทาง');return}
 if(rows.length===1){if(rows[0].opening)legacyOpen(rows[0].id);else openFeature('spot',rows[0].id);return}
 wfShow('แก้ไขจำนวนและต้นทุนจากรายการต้นทาง',`<p>${esc(rows[0].symbol)} · ${esc(accountName(rows[0].accountId))}</p><p>ยอดคงเหลือและต้นทุนเฉลี่ยคำนวณจากรายการด้านล่าง เลือกแก้จำนวน ราคา หรือค่าธรรมเนียมของรายการที่ผิด ระบบจะคำนวณยอดรวมและกำไรขายใหม่</p>${gridTable(['วันที่','ประเภท','จำนวน','ราคา / หน่วย',''],rows.map(r=>`<tr><td>${esc(r.time.replace('T',' '))}</td><td>${r.opening?'ยอดยกมา':r.type==='Buy'?'ซื้อ':'ขาย'}</td><td>${qty(r.quantity)}</td><td>${money(r.price,r.currency)}</td><td><button type="button" data-spot-source="${esc(r.id)}" data-source-opening="${r.opening?'1':'0'}">แก้ไข</button></td></tr>`))}`);
 $$('[data-spot-source]').forEach(b=>b.onclick=()=>{$('#workflow-dialog').close();if(b.dataset.sourceOpening==='1')legacyOpen(b.dataset.spotSource);else openFeature('spot',b.dataset.spotSource)});
}
async function removeSpotPosition(key){
 if(!featureAllowed())return;const rows=spotSources(key);if(!rows.length)return;
 const openings=rows.filter(r=>r.opening).length,transactions=rows.length-openings;
 if(!confirm(`ลบ ${rows[0].symbol} ใน ${accountName(rows[0].accountId)} (${rows[0].currency} · ${rows[0].strategy||'ทั่วไป'}) ทั้งชุดหรือไม่?\nจะลบยอดยกมา ${openings} และประวัติซื้อ–ขาย ${transactions} รายการ รวมราคาประเมินของสินทรัพย์ชุดนี้ ผลกำไรในรายงานจะคำนวณใหม่ บททบทวนจะเก็บไว้และแสดงว่าต้นทางถูกลบ\nย้อนคืนได้จากประวัติแก้ไขภายใต้ขีดจำกัดประวัติเดิม`))return;
 const next={...data,holdings:data.holdings.filter(r=>LittleCore.key(r)!==key),spotTransactions:listOf('spotTransactions').filter(r=>LittleCore.key(r)!==key),spotQuotes:listOf('spotQuotes').filter(r=>r.key!==key)};
 try{LittleCore.ledger(next);if(await save(next))toast('ลบสินทรัพย์และประวัติชุดนี้แล้ว · กู้คืนได้จากประวัติแก้ไข')}catch(e){toast('ลบไม่ได้: '+e.message)}
}
async function removeSpotOpening(id){
 if(!featureAllowed())return;const row=data.holdings.find(r=>r.id===id);if(!row)return;
 if(!confirm(`ลบยอดยกมา ${row.symbol} จำนวน ${qty(row.quantity)} หรือไม่? ระบบจะคำนวณยอดคงเหลือและต้นทุนใหม่ และไม่ให้ลบหากทำให้ขายเกินจำนวนที่ถือ`))return;
 const next={...data,holdings:data.holdings.filter(r=>r.id!==id)};
 try{LittleCore.ledger(next);if(await save(next))toast('ลบยอดยกมาแล้ว')}catch(e){toast('ลบไม่ได้: '+e.message)}
}
const spotActionsRender=renderPortfolio;
renderPortfolio=function(){
 spotActionsRender();const positions=LittleCore.ledger(data).positions.filter(shown);
 $$('[data-price]').forEach(b=>{const p=positions[Number(b.dataset.price)];if(!p)return;const cell=b.closest('tr').lastElementChild;cell.insertAdjacentHTML('beforeend',`<button class="row-action" data-position-edit="${esc(encodeURIComponent(p.key))}">แก้ไข</button><button class="row-action" data-position-delete="${esc(encodeURIComponent(p.key))}">ลบ</button>`)});
 $$('[data-opening]').forEach(b=>{b.textContent='แก้ไขยอดยกมา';b.insertAdjacentHTML('afterend',`<button class="row-action" data-opening-delete="${esc(b.dataset.opening)}">ลบ</button>`)});
 $$('[data-position-edit]').forEach(b=>b.onclick=()=>editSpotPosition(decodeURIComponent(b.dataset.positionEdit)));
 $$('[data-position-delete]').forEach(b=>b.onclick=()=>removeSpotPosition(decodeURIComponent(b.dataset.positionDelete)));
 $$('[data-opening-delete]').forEach(b=>b.onclick=()=>removeSpotOpening(b.dataset.openingDelete));
 $('#feature-page article:first-child > p').insertAdjacentHTML('afterend','<p>แก้ไข: เลือกรายการต้นทางเพื่อคำนวณจำนวนและต้นทุนใหม่ · ลบ: ลบสินทรัพย์ชุดนี้พร้อมประวัติซื้อ–ขายทั้งหมดในพอร์ต/สกุลเงิน/กลยุทธ์เดียวกัน หากต้องการลบเฉพาะรายการ ให้ใช้ปุ่มลบในประวัติด้านล่าง</p>');
};
render();
