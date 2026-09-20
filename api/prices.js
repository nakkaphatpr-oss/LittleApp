// Public quotes only. No user journal, credentials, or broker orders are sent here.
const cache = new Map();
const pending = new Map();
const sources = {
  gold: ['https://api.gold-api.com/price/XAU', 'Gold API', 'XAU', 'USD', 'ราคาอ้างอิง'],
  futures: ['https://api.phemex.com/md/v3/ticker/24hr?symbol=BTCUSDT', 'Phemex', 'BTCUSDT Perpetual', 'USDT', 'Mark Price'],
  inverse: ['https://www.deribit.com/api/v2/public/ticker?instrument_name=BTC-PERPETUAL', 'Deribit', 'BTC-PERPETUAL', 'USD', 'Mark Price'],
  spotUSDT: ['https://api.phemex.com/md/spot/ticker/24hr?symbol=sBTCUSDT', 'Phemex', 'BTC/USDT Spot', 'USDT', 'ซื้อขายล่าสุด'],
  spotUSD: ['https://api.exchange.coinbase.com/products/BTC-USD/ticker', 'Coinbase Exchange', 'BTC/USD Spot', 'USD', 'ซื้อขายล่าสุด']
};
function normalize(id, body, now = Date.now()) {
  const source = sources[id];
  if (!source || body.error || body.code && body.code !== 0) throw Error('Invalid response');
  const r = body.result || body;
  if (id === 'gold' && (r.symbol !== 'XAU' || r.currency && r.currency !== 'USD')) throw Error('Wrong instrument');
  if (id === 'futures' && r.symbol !== 'BTCUSDT' || id === 'spotUSDT' && r.symbol !== 'sBTCUSDT' || id === 'inverse' && r.instrument_name !== 'BTC-PERPETUAL') throw Error('Wrong instrument');
  const price = Number(id === 'gold' || id === 'spotUSD' ? r.price : id === 'futures' ? r.markRp : id === 'inverse' ? r.mark_price : r.lastEp / 1e8);
  const timestamp = id === 'gold' ? Date.parse(r.updatedAt) : id === 'spotUSD' ? Date.parse(r.time) : id === 'inverse' ? Number(r.timestamp) : Number(r.timestamp) / 1e6;
  if (!Number.isFinite(price) || price <= 0 || !Number.isFinite(timestamp) || timestamp <= 0 || timestamp > now + 60000) throw Error('Invalid price or time');
  return { id, price, source: source[1], instrument: source[2], currency: source[3], type: source[4], timestamp: Math.floor(timestamp), fetchedAt: now };
}
async function quote(id) {
  const previous = cache.get(id);
  if (previous && Date.now() - previous.at < 60000) return previous.value;
  if (pending.has(id)) return pending.get(id);
  const task = (async () => {
    try {
      const response = await fetch(sources[id][0], { signal: AbortSignal.timeout(6500), headers: { Accept: 'application/json' } });
      if (!response.ok) throw Error('Provider unavailable');
      const value = { ...normalize(id, await response.json()), error: false };
      cache.set(id, { value, at: Date.now() });
      return value;
    } catch {
      const value = { ...(previous?.value || { id }), error: true };
      // Short failure backoff without changing the last successful quote timestamp.
      cache.set(id, { value, at: Date.now() - 45000 });
      return value;
    } finally { pending.delete(id); }
  })();
  pending.set(id, task);
  return task;
}
module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'GET') { res.setHeader('Allow', 'GET'); return res.status(405).json({ error: 'Method not allowed' }); }
  const ids = String(req.query?.ids || '').split(',');
  if (!ids.length || ids.length > 5 || new Set(ids).size !== ids.length || ids.some(id => !Object.hasOwn(sources, id))) return res.status(400).json({ error: 'Unknown price source' });
  const quotes = await Promise.all(ids.map(quote));
  if (quotes.every(q => !q.error)) res.setHeader('Cache-Control', 'public, max-age=0, s-maxage=30');
  return res.status(200).json({ quotes });
};
module.exports.normalize = normalize;
