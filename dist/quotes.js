const QuoteUI = (() => {
  const quotes = {};
  const attempts = new Map();
  let busy = false, message = 'กดอัปเดตเพื่อรับราคาอ้างอิงล่าสุด', generation = 0;
  const clockText = n => new Intl.DateTimeFormat('th-TH', { timeZone: 'Asia/Bangkok', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }).format(n);
  const quoteFor = r => quotes[QuoteCore.feed(r)];
  function details(q) {
    const f = QuoteCore.feeds[q.id];
    return `<small class="quote-detail">${esc(f.label)} · ${esc(f.type)}<br>เวลาราคา ${clockText(q.timestamp)}<br>ดึงข้อมูล ${clockText(q.fetchedAt)} (ไทย)${QuoteCore.stale(q) ? '<br><span class="quote-warning">ราคาอาจล้าสมัย / ดึงล่าสุดไม่สำเร็จ</span>' : ''}</small>`;
  }
  function cell(r) {
    const id = QuoteCore.feed(r), q = quoteFor(r);
    if (id === 'none') return '<small>ยังไม่เลือกแหล่งราคา<br>เลือกในหน้าแก้ไขรายการ</small>';
    if (!QuoteCore.valid(q)) return `<small>${esc(QuoteCore.feeds[id].label)}<br>${q?.error ? 'ดึงราคาไม่สำเร็จ ลองอัปเดตใหม่' : 'รออัปเดตราคา'}</small>`;
    return `<b>${money(q.price, q.currency)} ${q.currency}</b>${details(q)}`;
  }
  function pnlCell(r) {
    const q = quoteFor(r), n = QuoteCore.unrealized(r, q);
    return n === null ? '—' : `${signed(n)}${QuoteCore.stale(q) ? '<br><small class="quote-warning">ประมาณการจากราคาเก่า</small>' : ''}`;
  }
  function summary(rows) {
    const open = rows.filter(i => i.kind === 'trade' && i.status === 'เปิดอยู่');
    const values = open.map(i => ({ q: quoteFor(i.record), value: QuoteCore.unrealized(i.record, quoteFor(i.record)) })).filter(v => v.value !== null);
    const old = values.some(v => QuoteCore.stale(v.q));
    return stat('กำไร/ขาดทุนค้างอยู่', values.length ? money(values.reduce((s,v) => s + v.value, 0)) : '—', currency, `${values.length}/${open.length} รายการมีราคา${old ? ' · มีราคาเก่า' : ''} · หักค่าธรรมเนียมที่กรอก`, '≈');
  }
  const positions = ps => ps.map(p => QuoteCore.position(p, quotes, $('#quote-spot').checked));
  function wanted() {
    if (!cloudReady || !['journal','portfolio'].includes(view)) return [];
    const ids = view === 'journal' ? journalRows().filter(i => ['รอเข้า','เปิดอยู่'].includes(i.status)).map(i => QuoteCore.feed(i.record)) : $('#quote-spot').checked ? LittleCore.ledger(data).positions.filter(p => shown(p) && p.quantity > 0).map(QuoteCore.spotFeed) : [];
    return [...new Set(ids)].filter(id => id !== 'none').sort();
  }
  function controls() {
    $('#quote-bar').hidden = !['journal','portfolio'].includes(view);
    $('#quote-spot-label').hidden = view !== 'portfolio';
    $('#quote-refresh').disabled = busy || !cloudReady;
    $('#quote-refresh').textContent = busy ? 'กำลังอัปเดต…' : '↻ อัปเดตราคา';
    $('#quote-status').textContent = message;
  }
  async function refresh() {
    if (busy || document.hidden) return;
    const ids = wanted();
    if (!ids.length) { message = 'ไม่มีสินทรัพย์ที่รองรับในตัวกรองนี้ · BTC สะสมต้องเปิดใช้ราคาออนไลน์'; controls(); return; }
    const signature = ids.join(',');
    if (Date.now() - (attempts.get(signature) || 0) < 15000) { message = 'เพิ่งขอราคาไป กรุณารอ 15 วินาทีก่อนอัปเดตอีกครั้ง'; controls(); return; }
    busy = true; attempts.set(signature, Date.now()); const requestGeneration = generation; controls();
    try {
      const response = await fetch('/api/prices?ids=' + ids.join(','), { signal: AbortSignal.timeout(10000) });
      if (!response.ok) throw Error('Unavailable');
      const body = await response.json();
      if (!Array.isArray(body.quotes)) throw Error('Invalid response');
      if (requestGeneration !== generation) return;
      let success = 0;
      for (const id of ids) {
        const q = body.quotes.find(q => q?.id === id);
        if (QuoteCore.valid(q) && (!quotes[id] || !QuoteCore.valid(quotes[id]) || q.timestamp >= quotes[id].timestamp)) { quotes[id] = q; if (!q.error) success++; }
        else quotes[id] = { ...(quotes[id] || { id }), error: true };
      }
      message = `รับราคา ${success}/${ids.length} แหล่ง · ${clockText(Date.now())}${success < ids.length ? ' · คงราคาเดิมสำหรับแหล่งที่ขัดข้อง' : ''}`;
    } catch {
      if (requestGeneration !== generation) return;
      for (const id of ids) quotes[id] = { ...(quotes[id] || { id }), error: true };
      message = 'เชื่อมต่อราคาไม่สำเร็จ · คงราคาเดิมไว้ · ตรวจว่าอัปโหลดโฟลเดอร์ api ไป Vercel แล้ว';
    } finally {
      busy = false; render();
    }
  }
  function reset() { generation++; attempts.clear(); $('#quote-auto').checked = false; $('#quote-spot').checked = false; message = 'กดอัปเดตเพื่อรับราคาอ้างอิงล่าสุด'; }
  return { quotes, cell, pnlCell, summary, positions, details, refresh, controls, reset };
})();
const beforeQuotesRender = render, beforeQuotesReset = resetCloudUser;
render = function() { beforeQuotesRender(); QuoteUI.controls(); };
resetCloudUser = function(user) { QuoteUI.reset(); beforeQuotesReset(user); };
$('#quote-refresh').onclick = QuoteUI.refresh;
$('#quote-auto').onchange = () => { if ($('#quote-auto').checked) QuoteUI.refresh(); };
$('#quote-spot').onchange = () => { render(); if ($('#quote-spot').checked) QuoteUI.refresh(); };
setInterval(() => {
  if (document.hidden || !cloudReady || !['journal','portfolio'].includes(view)) return;
  // Keep stale badges current even with automatic network requests disabled.
  if (!document.querySelector('dialog[open]')) render();
  if ($('#quote-auto').checked) QuoteUI.refresh();
}, 60000);
render();
