
const { D, fmt, MONTHS } = FC;
const I = D.items;
const MONTHS_FULL = ['ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני', 'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר'];
const DAYS = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];
const DAY = 864e5;
const WINDOW = 30;          // days either side of the week, about a two-month range
const LOOKBACK = 5;         // past years used for patterns
const CALLS = 6;            // calls per week
const COOLDOWN = 6;         // weeks before the same customer is suggested again
const SLOTS = [0, 0, 1, 2, 3, 4];  // which weekday (Sun..Thu) each call lands on
const DATA_END = new Date(D.lastDate + 'T00:00:00');
// Links to the overview page follow whatever the tab points at (the site build renames it)
const OVERVIEW = document.getElementById('tabOverview').getAttribute('href');
document.getElementById('upd').textContent = 'נתונים עד ' + D.lastDate.split('-').reverse().join('.');

const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const toDate = n => new Date(Math.floor(n / 1e4), Math.floor(n / 100) % 100 - 1, n % 100);
const dayOnly = d => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const startOfWeek = d => addDays(dayOnly(d), -d.getDay());
const doy = d => Math.round((Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) - Date.UTC(d.getFullYear(), 0, 1)) / DAY);
const fmtD = d => `${d.getDate()}.${d.getMonth() + 1}.${d.getFullYear()}`;
const weekNo = ws => { const w = addDays(ws, 3); return Math.ceil((doy(w) + 1 + new Date(w.getFullYear(), 0, 1).getDay()) / 7); };
const store = {
  get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
  set(k, v) { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch (e) {} },
};

// ---------- prepared once ----------
const CUST = Object.entries(D.customers).map(([id, c]) => ({
  id, n: c.n, city: c.c,
  o: c.o.map(o => { const d = toDate(o[0]); return { y: d.getFullYear(), doy: doy(d), t: d.getTime(), rev: o[1] }; }),
}));
const custItems = {};
I.forEach((it, i) => { for (const y in it[3]) for (const c in it[3][y]) (custItems[c] ||= new Set()).add(i); });

// Average units per calendar month over the years the item was on sale
function itemSeason(it) {
  const yrs = Object.keys(it[2]).map(Number);
  const y0 = Math.min(...yrs), y1 = Math.max(...yrs);
  const sum = Array(12).fill(0), cnt = Array(12).fill(0);
  let units = 0, active = 0;
  for (let y = y0; y <= y1; y++) for (let m = 1; m <= 12; m++) {
    if (y === FC.LAST_YEAR && m > FC.LAST_MONTH) continue;
    const q = it[2][y]?.[m]?.[1] || 0;
    sum[m - 1] += q; cnt[m - 1]++; units += q; if (q > 0) active++;
  }
  const avg = sum.map((v, k) => cnt[k] ? v / cnt[k] : 0);
  const tot = avg.reduce((a, b) => a + b, 0);
  if (units < 30 || active < 6 || !tot) return null;
  let best = -1, start = 0;
  for (let k = 0; k < 12; k++) {
    const w = avg[k] + avg[(k + 1) % 12] + avg[(k + 2) % 12];
    if (w > best) { best = w; start = k; }
  }
  return { share: best / tot, start, yearly: tot, y0, y1 };
}
// Seasonal items among the 800 best sellers
const SEASONAL = I.slice(0, 800).map((it, i) => ({ i, s: itemSeason(it) })).filter(x => x.s && x.s.share >= .4);

// Recent risers: last three months of data against the same months a year earlier
const TREND = (() => {
  const ms = [0, 1, 2].map(k => FC.LAST_MONTH - k).filter(m => m >= 1);
  const out = [];
  for (let i = 0; i < Math.min(I.length, 2500); i++) {
    const it = I[i];
    const cur = ms.reduce((a, m) => a + (it[2][FC.LAST_YEAR]?.[m]?.[1] || 0), 0);
    const prev = ms.reduce((a, m) => a + (it[2][FC.LAST_YEAR - 1]?.[m]?.[1] || 0), 0);
    if (cur >= 30 && cur - prev >= 20 && cur >= prev * 1.5) out.push({ i, cur, prev });
  }
  return { ms, list: out.sort((a, b) => (b.cur - b.prev) - (a.cur - a.prev)).slice(0, 6) };
})();

// Regular customers who have gone quiet, measured at the end of the data
const LAPSED = (() => {
  const end = DATA_END.getTime(), out = [];
  for (const cu of CUST) {
    const recent = cu.o.filter(o => end - o.t <= 730 * DAY);
    if (recent.length < 8) continue;
    const gaps = recent.slice(1).map((o, k) => (o.t - recent[k].t) / DAY).sort((a, b) => a - b);
    const med = gaps[Math.floor(gaps.length / 2)];
    const since = (end - recent[recent.length - 1].t) / DAY;
    if (since > Math.max(60, med * 3) && since < 365)
      out.push({ cu, since: Math.round(since), rev: recent.reduce((a, o) => a + o.rev, 0) });
  }
  return out.sort((a, b) => b.rev - a.rev);
})();

// Company revenue per calendar month, averaged over full years, to find quiet months
const FULL_YEARS = D.years.filter(y => !FC.isPartial(y)).slice(-LOOKBACK);
const MONTH_AVG = Array.from({ length: 12 }, (_, m) => FULL_YEARS.reduce((a, y) => a + D.monthly[y][m][0], 0) / FULL_YEARS.length);
const MEAN_MONTH = MONTH_AVG.reduce((a, b) => a + b, 0) / 12;
const QUIET = MONTH_AVG.map((v, m) => [m, v]).sort((a, b) => a[1] - b[1]).slice(0, 3).map(x => x[0]);
const AVG_YEAR = FULL_YEARS.at(-1);
const AVG_ORDER = (() => { const t = FC.totals(AVG_YEAR, 12); return t.rev / t.orders; })();

// ---------- who to call ----------
function custScore(cu, center) {
  const Y = center.getFullYear(), cd = doy(center);
  let total = 0, win = 0, rev = 0;
  const hit = new Set();
  for (const o of cu.o) {
    if (o.y < Y - LOOKBACK || o.y >= Y) continue;
    total++;
    let dd = Math.abs(o.doy - cd); dd = Math.min(dd, 365 - dd);
    if (dd <= WINDOW) { win++; rev += o.rev; hit.add(o.y); }
  }
  if (hit.size < 2 || total < 4) return null;
  const lift = win / (total * (2 * WINDOW + 1) / 365);
  if (lift < 1.3) return null;
  const years = new Set(cu.o.filter(o => o.y >= Y - LOOKBACK && o.y < Y).map(o => o.y)).size;
  return { cu, hits: hit.size, years, lift, win, total, avgRev: rev / hit.size, score: lift * hit.size * Math.sqrt(rev / hit.size + 1) };
}
// Plans a whole year at once, so a customer is not repeated within COOLDOWN weeks
const plans = {};
function planYear(Y) {
  if (plans[Y]) return plans[Y];
  const plan = {}, last = {};
  let ws = startOfWeek(new Date(Y, 0, 1));
  if (addDays(ws, 3).getFullYear() < Y) ws = addDays(ws, 7);
  for (let wi = 0; addDays(ws, 3).getFullYear() === Y; wi++, ws = addDays(ws, 7)) {
    const center = addDays(ws, 3);
    const picks = CUST.map(cu => custScore(cu, center)).filter(Boolean)
      .filter(s => !(s.cu.id in last) || wi - last[s.cu.id] >= COOLDOWN)
      .sort((a, b) => b.score - a.score).slice(0, CALLS);
    picks.forEach(s => { last[s.cu.id] = wi; });
    plan[ws.getTime()] = picks;
  }
  return (plans[Y] = plan);
}
const weekPlan = ws => planYear(addDays(ws, 3).getFullYear())[ws.getTime()] || [];

// What the customer bought around this time in past years, plus one item to add on
function custLikes(id, center) {
  const Y = center.getFullYear(), m0 = center.getMonth() + 1;
  const months = [m0 - 1, m0, m0 + 1].map(m => (m + 11) % 12 + 1);
  const res = [];
  for (const i of custItems[id] || []) {
    let v = 0;
    for (let y = Y - LOOKBACK; y < Y; y++) for (const m of months) v += I[i][5][y]?.[id]?.[m]?.[0] || 0;
    if (v > 0) res.push([i, v]);
  }
  res.sort((a, b) => b[1] - a[1]);
  const likes = res.slice(0, 3).map(r => r[0]);
  let extra = null, extraFrom = null, extraPct = 0;
  for (const i of likes) {
    const p = (I[i][7] || []).find(p => !(custItems[id] || new Set()).has(p[0]));
    if (p) { extra = p[0]; extraFrom = i; extraPct = p[2]; break; }
  }
  return { likes, extra, extraFrom, extraPct, months };
}
function lastOrderBefore(cu, t) {
  let best = null;
  for (const o of cu.o) if (o.t < t && (!best || o.t > best.t)) best = o;
  return best;
}

// ---------- products and ideas for a week ----------
function weekProducts(ws) {
  const center = addDays(ws, 3), mi = center.getMonth();
  const out = [];
  for (const { i, s } of SEASONAL) {
    // Days until the season's first month begins (this year or next)
    let start = new Date(center.getFullYear(), s.start, 1);
    if (start < addDays(center, -60)) start = new Date(center.getFullYear() + 1, s.start, 1);
    const days = Math.round((start - center) / DAY);
    const inPeak = [0, 1, 2].some(d => (s.start + d) % 12 === mi);
    if (days > 0 && days <= 45) out.push({ kind: 'season', i, s, days, w: s.share * s.yearly * 2 });
    else if (inPeak) out.push({ kind: 'peak', i, s, w: s.share * s.yearly });
  }
  out.sort((a, b) => (a.kind === 'season' ? 0 : 1) - (b.kind === 'season' ? 0 : 1) || b.w - a.w);
  const picks = out.slice(0, 4);
  const near = Math.abs(ws - DATA_END) < 75 * DAY;
  if (near) TREND.list.slice(0, 2).forEach(t => picks.push({ kind: 'trend', ...t }));
  return picks;
}
function seasonRange(s) { return `${MONTHS[s.start]}–${MONTHS[(s.start + 2) % 12]}`; }
function itemLink(i) { return `<a href="${OVERVIEW}#i=${i}">${esc(I[i][0])}</a>`; }
const yearSpan = (a, b) => a === b ? `${a}` : `<bdi style="white-space:nowrap">${a}–${b}</bdi>`;
const seasonBasis = s => `מבוסס על: ממוצע היחידות שנמכרו בכל חודש בשנים ${yearSpan(s.y0, s.y1)}; ${Math.round(s.share * 100)}% מהכמות השנתית נופלת ב${seasonRange(s)}.`;
const trendMonths = () => `${MONTHS[TREND.ms.at(-1) - 1]}–${MONTHS[TREND.ms[0] - 1]}`;
function productHtml(p) {
  const name = itemLink(p.i);
  if (p.kind === 'season') return `<li class="prod"><span class="tag season">נכנס לעונה</span><div><div class="nm">${name}</div>
    <p>העונה (${seasonRange(p.s)}) מתחילה בעוד כ-${Math.max(1, Math.round(p.days / 7))} שבועות; ${Math.round(p.s.share * 100)}% מהכמות השנתית נמכרת בה. כדאי לוודא מלאי עכשיו.</p>
    <div class="basis">${seasonBasis(p.s)}</div></div></li>`;
  if (p.kind === 'peak') return `<li class="prod"><span class="tag peak">בשיא העונה</span><div><div class="nm">${name}</div>
    <p>${seasonRange(p.s)} הם שיא המכירות של הפריט (${Math.round(p.s.share * 100)}% מהשנה). להציע אותו בכל שיחה רלוונטית.</p>
    <div class="basis">${seasonBasis(p.s)}</div></div></li>`;
  const g = p.prev ? `×${(p.cur / p.prev).toFixed(1)}` : 'חדש';
  return `<li class="prod"><span class="tag trend">טרנד</span><div><div class="nm">${name}</div>
    <p>${fmt.num(p.cur)} יח׳ ב${trendMonths()} ${FC.LAST_YEAR}, מול ${fmt.num(p.prev)} באותם חודשים אשתקד (${g}).</p>
    <div class="basis">מבוסס על: היחידות שנמכרו לכל הלקוחות ב${trendMonths()} ${FC.LAST_YEAR} מול ${trendMonths()} ${FC.LAST_YEAR - 1}, רק פריטים עם 30 יח׳ ומעלה.</div></div></li>`;
}
function weekIdeas(ws, prods) {
  const center = addDays(ws, 3), mi = center.getMonth(), wn = weekNo(ws);
  const ideas = [];
  const season = prods.find(p => p.kind === 'season');
  if (season) {
    const it = I[season.i], partner = (it[7] || [])[0];
    ideas.push({ k: 'מבצע הקדמת עונה', t: `השיא של <b>${esc(it[0])}</b> מתחיל ב${MONTHS_FULL[season.s.start]}. הצעת "הזמנה מוקדמת" עכשיו (למשל 5% הנחה עד ${fmtD(addDays(ws, 21))}) מקדימה הזמנות ומבטיחה מלאי לעונה.`
      + (partner ? ` אפשר לצרף את <b>${esc(I[partner[0]][0])}</b>, שנקנה יחד איתו ב-${partner[2]}% מההזמנות.` : ''),
      b: seasonBasis(season.s).replace(/\.$/, '') + (partner ? `; המוצר המצורף לפי ${fmt.num(it[6])} הזמנות של הפריט, ${partner[2]}% מהן כללו גם אותו` : '') + '.' });
  }
  if (QUIET.includes(mi)) {
    const gap = Math.round((1 - MONTH_AVG[mi] / MEAN_MONTH) * 100);
    const threshold = Math.ceil(AVG_ORDER * 1.4 / 100) * 100;
    ideas.push({ k: 'חודש שקט', t: `${MONTHS_FULL[mi]} חלש היסטורית (${gap > 0 ? gap + '% מתחת' : 'קרוב'} לממוצע החודשי). רעיון: משלוח חינם או מתנה קטנה בהזמנה מעל ₪${fmt.num(threshold)}, בערך פי 1.4 מהזמנה ממוצעת, כדי להגדיל סל.`,
      b: `מבוסס על: הכנסת החברה הממוצעת ב${MONTHS_FULL[mi]} בשנים ${yearSpan(FULL_YEARS[0], FULL_YEARS.at(-1))} מול ממוצע כל החודשים; ${MONTHS_FULL[mi]} בין 3 החודשים החלשים. ההזמנה הממוצעת (₪${fmt.num(AVG_ORDER)}) מ-${AVG_YEAR}.` });
  }
  if (ws >= addDays(DATA_END, -7) && LAPSED.length) {
    const off = (wn * 3) % LAPSED.length, few = [0, 1, 2].map(k => LAPSED[(off + k) % LAPSED.length]).filter((v, k, a) => a.indexOf(v) === k);
    ideas.push({ k: 'החזרת לקוחות', t: `${LAPSED.length} לקוחות קבועים לא הזמינו הרבה יותר זמן מהרגיל שלהם, למשל ${few.map(l => `<a href="${OVERVIEW}#c=${l.cu.id}">${esc(l.cu.n)}</a> (${fmt.num(l.since)} ימים)`).join(', ')}. שיחה אישית עם הנחת חזרה חד-פעמית.`,
      b: `מבוסס על: לקוחות עם 8 הזמנות ומעלה בשנתיים שלפני ${fmtD(DATA_END)}, שעבר מאז ההזמנה האחרונה שלהם יותר מפי 3 מהמרווח הרגיל בין ההזמנות שלהם (ולפחות 60 יום), ממוינים לפי סך הקניות.` });
  }
  // Trends describe the latest data, so they only belong in weeks near it
  const trend = Math.abs(ws - DATA_END) < 75 * DAY ? TREND.list[wn % Math.max(TREND.list.length, 1)] : null;
  if (trend) {
    const partner = (I[trend.i][7] || [])[0];
    ideas.push({ k: 'לרכוב על טרנד', t: `<b>${esc(I[trend.i][0])}</b> נמכר לאחרונה הרבה יותר מאשתקד.` + (partner
      ? ` לשלוח הודעה ללקוחות שקונים <b>${esc(I[partner[0]][0])}</b> (נקנים יחד ב-${partner[2]}% מההזמנות) ועדיין לא ניסו אותו.`
      : ' להציב אותו בראש קטלוג ההודעות של השבוע.'),
      b: `מבוסס על: ${fmt.num(trend.cur)} יח׳ ב${trendMonths()} ${FC.LAST_YEAR} מול ${fmt.num(trend.prev)} ב-${FC.LAST_YEAR - 1}` + (partner ? `; המוצר המשלים לפי ${fmt.num(I[trend.i][6])} הזמנות של הפריט` : '') + '.' });
  }
  // A volume item for this time of year: the best-selling units in this calendar month
  let best = null;
  for (let i = 0; i < Math.min(300, I.length); i++) {
    const it = I[i];
    let q = 0, n = 0;
    for (let y = center.getFullYear() - LOOKBACK; y < center.getFullYear(); y++) { const v = it[2][y]?.[mi + 1]?.[1]; if (v) { q += v; n++; } }
    if (n >= 3 && it[6] >= 20 && (!best || q > best.q)) best = { i, q };
  }
  if (best) {
    const it = I[best.i], units = Object.values(it[2]).reduce((a, mm) => a + Object.values(mm).reduce((b, v) => b + v[1], 0), 0);
    const perOrder = Math.max(1, Math.round(units / it[6]));
    ideas.push({ k: 'מדרגות כמות', t: `<b>${esc(it[0])}</b> הוא הפריט שנמכר הכי הרבה יחידות ב${MONTHS_FULL[mi]}. לקוח מזמין ממנו בממוצע ${fmt.num(perOrder)} יח׳; מחיר מוזל מ-${fmt.num(perOrder * 2)} יח׳ יכול להגדיל את ההזמנה.`,
      b: `מבוסס על: סך היחידות שנמכרו ב${MONTHS_FULL[mi]} בשנים ${yearSpan(center.getFullYear() - LOOKBACK, center.getFullYear() - 1)} (מתוך 300 הפריטים המובילים), וממוצע היחידות להזמנה מ-${fmt.num(it[6])} הזמנות של הפריט.` });
  }
  // Up to three, rotating so neighbouring weeks read differently
  const rot = wn % ideas.length;
  return ideas.length <= 3 ? ideas : [...ideas.slice(rot), ...ideas.slice(0, rot)].slice(0, 3);
}

// ---------- rendering ----------
const state = { view: store.get('flacar-cal-view') === 'month' ? 'month' : 'week', cursor: startOfWeek(new Date()), selDay: null };
const doneKey = (ws, id) => `flacar-cal:${ws.getTime()}:${id}`;
const isDone = (ws, id) => store.get(doneKey(ws, id)) === '1';

function title() {
  const el = document.getElementById('title');
  if (state.view === 'month') { el.textContent = `${MONTHS_FULL[state.cursor.getMonth()]} ${state.cursor.getFullYear()}`; return; }
  const a = state.cursor, b = addDays(a, 6);
  const range = a.getMonth() === b.getMonth()
    ? `${a.getDate()}–${b.getDate()} ב${MONTHS_FULL[a.getMonth()]} ${b.getFullYear()}`
    : `${a.getDate()} ב${MONTHS_FULL[a.getMonth()]} – ${b.getDate()} ב${MONTHS_FULL[b.getMonth()]} ${b.getFullYear()}`;
  el.innerHTML = `${range}<span class="wk">שבוע ${weekNo(a)}</span>`;
}
function renderWeek() {
  const ws = state.cursor, center = addDays(ws, 3), today = dayOnly(new Date()).getTime();
  const picks = weekPlan(ws);
  const prods = weekProducts(ws);
  const ideas = weekIdeas(ws, prods);
  const tasks = [...picks.map(p => 'c' + p.cu.id), ...ideas.map((_, k) => 'idea' + k)];
  const done = tasks.filter(t => isDone(ws, t)).length;

  document.getElementById('prog').innerHTML = `בוצעו ${done} מתוך ${tasks.length} משימות השבוע<span class="prog"><i style="width:${tasks.length ? done / tasks.length * 100 : 0}%"></i></span>`;

  const byDay = Array.from({ length: 7 }, () => []);
  picks.forEach((p, k) => byDay[SLOTS[k]].push(p));
  if (state.selDay != null && !byDay[state.selDay].length) state.selDay = null;
  document.getElementById('days').innerHTML = byDay.map((list, d) => {
    const date = addDays(ws, d), isToday = date.getTime() === today, work = d < 5;
    const cls = ['rect', isToday ? 'now' : '', work ? '' : 'off', state.selDay === d ? 'sel' : ''].filter(Boolean).join(' ');
    const open = list.length ? ` role="button" tabindex="0" data-day="${d}" aria-expanded="${state.selDay === d}" title="פרטים על השיחות של היום"` : '';
    const names = !work ? '<span class="free">סוף שבוע</span>'
      : list.length ? list.map(p => `<span class="nm${isDone(ws, 'c' + p.cu.id) ? ' done' : ''}">${esc(p.cu.n)}</span>`).join('')
      : '<span class="free">אין שיחות</span>';
    return `<div class="${cls}"${open}><div class="hd"><span class="num">${date.getDate()}</span>
      <span class="dw">${DAYS[d]}<br>${MONTHS[date.getMonth()]}${isToday ? '<br><span class="td">היום</span>' : ''}</span></div>
      <div class="names">${names}</div></div>`;
  }).join('');

  const det = document.getElementById('detail');
  if (state.selDay != null) {
    const d = state.selDay, date = addDays(ws, d), list = byDay[d];
    det.hidden = false;
    det.innerHTML = `<div class="detail-h"><h4>יום ${DAYS[d]} ${date.getDate()}.${date.getMonth() + 1} · ${list.length === 1 ? 'שיחה אחת' : list.length + ' שיחות'}</h4>
      <button type="button" id="closeDetail">סגירה ✕</button></div>
      <div class="detail-list">${list.map(p => taskHtml(p, ws, center)).join('')}</div>`;
  } else { det.hidden = true; det.innerHTML = ''; }

  document.getElementById('prodSub').textContent = 'פריטים שנכנסים לעונה או בשיאה בתקופה הזו' + (prods.some(p => p.kind === 'trend') ? ', ופריטים שעולים לאחרונה' : '');
  document.getElementById('prods').innerHTML = prods.length ? prods.map(productHtml).join('') : '<li class="empty-d">אין פריט עונתי בולט בשבוע הזה</li>';
  document.getElementById('ideas').innerHTML = ideas.map((x, k) => {
    const d = isDone(ws, 'idea' + k);
    return `<li class="idea${d ? ' done' : ''}"><input type="checkbox" data-task="idea${k}" ${d ? 'checked' : ''} aria-label="בוצע"><div><div class="k">${x.k}</div><p>${x.t}</p>${x.b ? `<div class="basis">${x.b}</div>` : ''}</div></li>`;
  }).join('');
}
function taskHtml(p, ws, center) {
  const cu = p.cu, d = isDone(ws, 'c' + cu.id);
  const { likes, extra, extraFrom, extraPct, months } = custLikes(cu.id, center);
  const phone = D.customers[cu.id].p, Y = center.getFullYear();
  const from = addDays(center, -WINDOW), to = addDays(center, WINDOW);
  const last = lastOrderBefore(cu, ws.getTime());
  const since = last ? Math.round((ws.getTime() - last.t) / DAY) : null;
  return `<div class="task${d ? ' done' : ''}"><div class="top"><input type="checkbox" data-task="c${cu.id}" ${d ? 'checked' : ''} aria-label="בוצע">
      <div class="who"><a href="${OVERVIEW}#c=${cu.id}">${esc(cu.n)}</a><small>${esc(cu.city || '')}${cu.city && phone ? ' · ' : ''}${phone ? `<a class="tel" href="tel:${phone.replace(/-/g, '')}" dir="ltr">${phone}</a>` : ''}</small></div></div>
    <div class="why">הזמין בתקופה הזו ב-<b>${p.hits} מתוך ${p.years}</b> השנים האחרונות, בממוצע <b>${fmt.money(p.avgRev)}</b>.${last ? ` הזמנה אחרונה: ${fmtD(new Date(last.t))}${since != null && since <= 400 ? ` (לפני ${fmt.num(since)} ימים)` : ''}.` : ''}</div>
    ${likes.length ? `<div class="likes">${likes.map(i => `<span class="chip" title="${esc(I[i][0])}">${esc(I[i][0])}</span>`).join('')}${extra != null ? `<span class="chip x" title="נקנה הרבה יחד עם מה שהוא קונה, והוא עוד לא קנה: ${esc(I[extra][0])}">+ ${esc(I[extra][0])}</span>` : ''}</div>` : ''}
    <div class="basis">מבוסס על: ${p.win} מתוך ${p.total} ההזמנות שלו ב-${yearSpan(Y - LOOKBACK, Y - 1)} נפלו בין ${from.getDate()}.${from.getMonth() + 1} ל-${to.getDate()}.${to.getMonth() + 1}, פי ${p.lift.toFixed(1)} מהקצב הרגיל שלו.${likes.length ? ` המוצרים: מה שקנה ב${MONTHS[months[0] - 1]}–${MONTHS[months[2] - 1]} באותן שנים.` : ''}${extra != null ? ` בכתום: נקנה יחד עם ${esc(I[extraFrom][0])} ב-${extraPct}% מההזמנות שלו, והלקוח עוד לא קנה אותו.` : ''}</div>
  </div>`;
}
function renderMonth() {
  const c = state.cursor, first = new Date(c.getFullYear(), c.getMonth(), 1);
  const start = startOfWeek(first), today = dayOnly(new Date()).getTime();
  let html = DAYS.map(d => `<div class="dh">${d}</div>`).join('');
  for (let w = 0; w < 6; w++) {
    const ws = addDays(start, w * 7);
    if (w > 3 && ws.getMonth() !== c.getMonth()) break;
    const picks = weekPlan(ws);
    for (let d = 0; d < 7; d++) {
      const date = addDays(ws, d), calls = picks.filter((_, k) => SLOTS[k] === d);
      html += `<div class="cell${date.getMonth() !== c.getMonth() ? ' out' : ''}${date.getTime() === today ? ' now' : ''}" data-week="${ws.getTime()}" data-d="${d}" title="פתיחת היום">
        <span class="dn">${date.getDate()}</span>
        ${calls.slice(0, 2).map(p => `<span class="c${isDone(ws, 'c' + p.cu.id) ? ' done' : ''}">${esc(p.cu.n)}</span>`).join('')}
        ${calls.length > 2 ? `<span class="more">+${calls.length - 2}</span>` : ''}</div>`;
    }
  }
  document.getElementById('month').innerHTML = html;
}
function render() {
  const isWeek = state.view === 'week';
  document.getElementById('weekView').hidden = !isWeek;
  document.getElementById('monthView').hidden = isWeek;
  document.querySelectorAll('#view button').forEach(b => b.classList.toggle('on', b.dataset.v === state.view));
  title();
  const note = document.getElementById('note');
  const end = isWeek ? addDays(state.cursor, 6) : new Date(state.cursor.getFullYear(), state.cursor.getMonth() + 1, 0);
  note.hidden = end <= DATA_END;
  note.textContent = `ההמלצות נשענות על הנתונים עד ${D.lastDate.split('-').reverse().join('.')} ועל ${LOOKBACK} השנים שלפני התקופה. אחרי עדכון נתונים הן יתעדכנו.`;
  isWeek ? renderWeek() : renderMonth();
}

document.getElementById('prev').onclick = () => {
  state.selDay = null;
  state.cursor = state.view === 'week' ? addDays(state.cursor, -7) : new Date(state.cursor.getFullYear(), state.cursor.getMonth() - 1, 1);
  render();
};
document.getElementById('next').onclick = () => {
  state.selDay = null;
  state.cursor = state.view === 'week' ? addDays(state.cursor, 7) : new Date(state.cursor.getFullYear(), state.cursor.getMonth() + 1, 1);
  render();
};
document.getElementById('today').onclick = () => {
  state.selDay = null;
  state.cursor = state.view === 'week' ? startOfWeek(new Date()) : new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  render();
};
document.getElementById('view').addEventListener('click', e => {
  const v = e.target.dataset.v;
  if (!v || v === state.view) return;
  state.view = v;
  store.set('flacar-cal-view', v);
  state.cursor = v === 'week' ? startOfWeek(addDays(state.cursor, 3)) : new Date(addDays(state.cursor, 3).getFullYear(), addDays(state.cursor, 3).getMonth(), 1);
  render();
});
document.getElementById('month').addEventListener('click', e => {
  const cell = e.target.closest('[data-week]');
  if (!cell) return;
  state.view = 'week';
  store.set('flacar-cal-view', 'week');
  state.cursor = new Date(+cell.dataset.week);
  state.selDay = +cell.dataset.d;
  render();
});
function toggleDay(el) {
  const d = +el.dataset.day;
  state.selDay = state.selDay === d ? null : d;
  render();
  if (state.selDay != null) document.getElementById('detail').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}
document.getElementById('days').addEventListener('click', e => { const el = e.target.closest('[data-day]'); if (el) toggleDay(el); });
document.getElementById('days').addEventListener('keydown', e => {
  const el = e.target.closest('[data-day]');
  if (el && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); toggleDay(el); }
});
document.getElementById('detail').addEventListener('click', e => { if (e.target.id === 'closeDetail') { state.selDay = null; render(); } });
// Ticking a task marks it done on this device
document.getElementById('weekView').addEventListener('change', e => {
  const t = e.target.dataset.task;
  if (!t) return;
  store.set(doneKey(state.cursor, t), e.target.checked ? '1' : null);
  render();
});
if (state.view === 'month') state.cursor = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
render();
