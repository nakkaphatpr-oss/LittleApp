// Market prices are a separate read-only layer: never rewrite execution records.
const QuoteCore = (() => {
  const feeds = {
    gold: { asset: 'XAUUSD', currency: 'USD', label: 'Gold API · XAU/USD อ้างอิง', type: 'ราคาอ้างอิง' },
    futures: { asset: 'BTCUSDT', currency: 'USDT', label: 'Phemex · BTCUSDT Perpetual', type: 'Mark Price' },
    inverse: { asset: 'BTCUSD', currency: 'USD', label: 'Deribit · BTC-PERPETUAL', type: 'Mark Price' },
    spotUSDT: { currency: 'USDT', label: 'Phemex · BTC/USDT Spot', type: 'ซื้อขายล่าสุด' },
    spotUSD: { currency: 'USD', label: 'Coinbase · BTC/USD Spot', type: 'ซื้อขายล่าสุด' }
  };
  const defaultFeed = asset => asset === 'XAUUSD' ? 'gold' : asset === 'BTCUSDT' ? 'futures' : 'none';
  const feed = r => { const id = r.quoteFeed ?? defaultFeed(r.asset); return feeds[id]?.asset === r.asset ? id : 'none'; };
  const spotFeed = p => p.asset === 'บิทคอยน์' && ['BTC','BTCUSD','BTCUSDT','BTC/USD','BTC/USDT'].includes(p.symbol.trim().toUpperCase()) ? p.currency === 'USD' ? 'spotUSD' : p.currency === 'USDT' ? 'spotUSDT' : 'none' : 'none';
  const valid = (q, now = Date.now()) => !!q && !!feeds[q.id] && q.currency === feeds[q.id].currency && Number.isFinite(q.price) && q.price > 0 && Number.isFinite(q.timestamp) && q.timestamp > 0 && q.timestamp <= now + 60000 && Number.isFinite(q.fetchedAt) && q.fetchedAt > 0 && q.fetchedAt <= now + 60000;
  const stale = (q, now = Date.now()) => !valid(q, now) || !!q.error || now - q.timestamp > 180000 || now - q.fetchedAt > 180000;
  function unrealized(t, q) {
    if (t.exit !== null || !valid(q) || feed(t) !== q.id) return null;
    const result = (t.asset === 'BTCUSD' ? 1 / t.entry - 1 / q.price : q.price - t.entry) * t.quantity * t.multiplier * (t.side === 'Short' ? -1 : 1) - t.fee;
    return Number.isFinite(result) ? result : null;
  }
  function position(p, quotes, enabled) {
    const q = enabled ? quotes[spotFeed(p)] : null;
    if (!valid(q)) return { ...p, quote: null };
    const market = q.price * p.quantity;
    if (!Number.isFinite(market)) return { ...p, quote: null };
    return { ...p, current: q.price, market, unrealized: market - p.basis, quote: q };
  }
  return { feeds, defaultFeed, feed, spotFeed, valid, stale, unrealized, position };
})();
if (typeof module !== 'undefined') module.exports = QuoteCore;
