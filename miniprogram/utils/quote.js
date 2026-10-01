/* 每日名言：每天 10 条、两个池交替、按时段自动轮换、点击切换、点满 10 次回到起点
   正式接入云端时，这 10 条由云函数按当天日期下发；这里用本地词库按日期确定性生成，
   保证「同一天打开多次看到的顺序一致」，且每天自动换一批 */
const QUOTES = require('../mock/quotes.js');

/* 本地词库的中西方分开：按索引奇偶近似分池（云端有严格的两池，各自 72 / 90 条） */
const POOL_A = QUOTES.filter(function (_, i) { return i % 2 === 0; });
const POOL_B = QUOTES.filter(function (_, i) { return i % 2 === 1; });

function dateSeed(d) {
  return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
}

function pickFrom(pool, n, offset, seed) {
  const out = [];
  for (let i = 0; i < n; i++) out.push(pool[(seed * 7 + offset + i * 13) % pool.length]);
  return out;
}

/* 当天 10 条：两池各 5 条交替排列 */
function dayQuotes(date) {
  const now = date || new Date();
  const seed = dateSeed(now);
  const a = pickFrom(POOL_A, 5, 0, seed);
  const b = pickFrom(POOL_B, 5, 3, seed);
  const out = [];
  for (let i = 0; i < 5; i++) {
    out.push(a[i]);
    out.push(b[i]);
  }
  return out;
}

/* 每 2.4 小时一个时段，一天 10 段，对应当天 10 条 */
function slotIndex(date) {
  const now = date || new Date();
  const mins = now.getHours() * 60 + now.getMinutes();
  return Math.min(9, Math.floor(mins / 144));
}

module.exports = { dayQuotes: dayQuotes, slotIndex: slotIndex };
