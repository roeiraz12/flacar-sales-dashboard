
const { D, fmt, MONTHS } = FC;

// Spellings as they appear in the files -> one city name
const ALIAS = {
  'ת"א': 'תל אביב', 'תל אביב - יפו': 'תל אביב', 'פ"ת': 'פתח תקווה', 'פתח תקוה': 'פתח תקווה',
  'ראשל"צ': 'ראשון לציון', 'רשל"צ': 'ראשון לציון', 'ראשון  לציון': 'ראשון לציון', 'ב"ש': 'באר שבע',
  'כ"ס': 'כפר סבא', 'רמה"ש': 'רמת השרון', 'בני-ברק': 'בני ברק', 'בת-ים': 'בת ים', 'ראש-העין': 'ראש העין',
  'עמק-חפר': 'עמק חפר', 'פארק תעשיה עמק חפר': 'עמק חפר', 'פארק תעשיות ע.חפר': 'עמק חפר',
  "בקעה-ג'ת": "באקה-ג'ת", "בקעה ג'ת": "באקה-ג'ת", 'בקעה אל גרביה': "באקה-ג'ת", 'בקעה אל גרבייה': "באקה-ג'ת",
  'בינימינה': 'בנימינה', 'קריית גת': 'קרית גת', 'קרית-מלאכי': 'קרית מלאכי', 'נצרת עילית': 'נוף הגליל',
  'א.ת כפר כנא': 'כפר כנא', 'דואר:כפר משהד': 'כפר משהד', 'מושב צופית (כ"ס)': 'צופית', 'בין עכו לקריות': 'עכו',
  'קיבוץ דורות': 'דורות', 'קיבוץ העוגן': 'העוגן', 'קיבוץ זיקים': 'זיקים', 'קיבוץ יד מרדכי': 'יד מרדכי',
  'קיבוץ יקום': 'יקום', 'קיבוץ מגן': 'מגן', 'קיבוץ ניר עוז': 'ניר עוז', 'קיבוץ נירים': 'נירים', 'קיבוץ עלומים': 'עלומים',
  'מושב אחיעזר': 'אחיעזר', 'מושב בית עובד': 'בית עובד', 'מושב ברכיה': 'ברכיה', 'נתב"ג': 'נמל תעופה בן גוריון',
};
const REGION_CITIES = {
  north: ['כפר כנא', 'איכסל', 'בית שאן', 'גדיידה מכר', 'חורפיש', 'חצור הגלילית', 'טבריה', 'טורען', 'כרמיאל', "מג'אר", 'מעלות', 'מסעדה', 'נהריה', 'נוף הגליל', 'נצרת', 'עכו', 'עפולה', 'צפת', 'קרית שמונה', 'שכניה', "ג'וליס", 'כפר משהד'],
  haifa: ['חיפה', 'טירת הכרמל', 'קריית ים', 'קרית אתא', 'עוספיה', 'עתלית', 'מעיין צבי', 'כפר פורהדיס', 'זכרון יעקב'],
  sharon: ['נתניה', 'חדרה', 'קיסריה', 'בנימינה', 'פרדס חנה', 'עמק חפר', 'העוגן', "באקה-ג'ת", 'ערערה', 'מוסמוס', 'כפר קרע', 'כפר סבא', 'רעננה', 'הוד השרון', 'הרצליה', 'רמת השרון', 'קדימה', 'צורן', 'כפר יונה', 'אבן יהודה', 'טייבה', 'קלנסוואה', 'כוכב יאיר', 'צופית', 'גאולים', 'יקום', 'אור עקיבא', 'גלילות'],
  center: ['תל אביב', 'רמת גן', 'גבעתיים', 'בני ברק', 'חולון', 'בת ים', 'פתח תקווה', 'ראש העין', 'אלעד', 'כפר קאסם', 'ראשון לציון', 'אזור', 'אור יהודה', 'יהוד', 'קרית אונו', 'גבעת שמואל', 'שוהם', 'נמל תעופה בן גוריון', 'גינתון', 'בני עטרות', 'משמר השבעה', 'אריאל'],
  shfela: ['רחובות', 'נס ציונה', 'רמלה', 'לוד', 'יבנה', 'גן יבנה', 'גדרה', 'באר יעקב', 'מודיעין', 'קרית עקרון', 'גן שורק', 'כנות', 'מישר', 'אחיעזר', 'בית עובד'],
  jerusalem: ['ירושלים', 'בית שמש', 'מעלה אדומים', 'גבע בנימין'],
  south: ['אשדוד', 'אשקלון', 'באר שבע', 'אופקים', 'נתיבות', 'שדרות', 'ערד', 'אילת', 'רהט', 'קרית גת', 'קרית מלאכי', 'דורות', 'זיקים', 'יד מרדכי', 'ניר עוז', 'נירים', 'עלומים', 'ברכיה', 'מגן', 'שדה עוזיהו'],
};
// Stylized silhouette, drawn by hand: west is left, north is up. Not to scale
const REGIONS = [
  { id: 'north', name: 'צפון', path: 'M80,14 L150,6 L172,30 L166,70 L150,104 L110,112 L98,84 L80,60 Z', lx: 132, ly: 58 },
  { id: 'haifa', name: 'חיפה והכרמל', short: 'חיפה', path: 'M80,60 L98,84 L110,112 L98,142 L64,140 L70,98 Z', lx: 86, ly: 110 },
  { id: 'sharon', name: 'שרון', path: 'M64,140 L98,142 L110,112 L130,118 L120,206 L56,210 Z', lx: 92, ly: 176 },
  { id: 'center', name: 'מרכז', path: 'M56,210 L120,206 L114,256 L46,258 Z', lx: 83, ly: 236 },
  { id: 'jerusalem', name: 'ירושלים', path: 'M120,206 L162,222 L160,286 L112,290 L114,256 Z', lx: 138, ly: 252 },
  { id: 'shfela', name: 'שפלה', path: 'M46,258 L114,256 L112,290 L104,312 L36,306 Z', lx: 76, ly: 284 },
  { id: 'south', name: 'דרום', path: 'M36,306 L104,312 L112,290 L160,286 L172,340 L150,430 L124,548 L84,420 L22,334 Z', lx: 112, ly: 382 },
];
const REGION_NAME = Object.fromEntries(REGIONS.map(r => [r.id, r.name]));
const CITY_REGION = {};
for (const [r, cs] of Object.entries(REGION_CITIES)) for (const c of cs) CITY_REGION[c] = r;
const cityOf = raw => { const t = (raw || '').trim(); return ALIAS[t] || t; };

const state = { metric: 'rev', mode: 'value', region: null, item: null };  // item: index in D.items, or null for all
const sel = document.getElementById('year');
FC.yearOptions(sel);

// Aggregate customers into cities for a period: {city: {rev, orders, custs:Set}}
// With a product chosen, revenue is its line totals and "orders" becomes units sold
function byCity(y, mm) {
  const out = {};
  if (!D.monthly[y]) return null;
  const add = (id, c, o, r) => {
    if (!o && !r) return;
    const city = cityOf(c.c) || 'ללא עיר';
    const a = out[city] ||= { rev: 0, orders: 0, custs: [] };
    a.rev += r; a.orders += o; a.custs.push({ id, n: c.n, rev: r, orders: o });
  };
  if (state.item != null) {
    for (const [id, months] of Object.entries(D.items[state.item][5][y] || {})) {
      const c = D.customers[id];
      if (!c) continue;
      let q = 0, r = 0;
      for (const m in months) if (+m <= mm) { r += months[m][0]; q += months[m][1]; }
      add(id, c, q, r);
    }
    return out;
  }
  for (const [id, c] of Object.entries(D.customers)) {
    const yd = c.d[y];
    if (!yd) continue;
    let o = 0, r = 0;
    for (const m in yd) if (+m <= mm) { o += yd[m][0]; r += yd[m][1]; }
    add(id, c, o, r);
  }
  return out;
}
function byRegion(cities) {
  const out = Object.fromEntries(REGIONS.map(r => [r.id, { rev: 0, orders: 0, custs: 0, cities: [] }]));
  out.none = { rev: 0, orders: 0, custs: 0, cities: [] };
  for (const [city, a] of Object.entries(cities || {})) {
    const r = out[CITY_REGION[city] || 'none'];
    r.rev += a.rev; r.orders += a.orders; r.custs += a.custs.length; r.cities.push(city);
  }
  return out;
}
const val = (a, k) => a ? (k === 'custs' ? (Array.isArray(a.custs) ? a.custs.length : a.custs) : a[k]) : 0;
const fmtM = k => k === 'rev' ? fmt.money : fmt.num;
const METRIC_ALL = { rev: 'הכנסות', orders: 'הזמנות', custs: 'לקוחות פעילים' };
const METRIC = new Proxy(METRIC_ALL, { get: (o, k) => k === 'orders' && state.item != null ? 'כמות' : k === 'custs' && state.item != null ? 'לקוחות שקנו' : o[k] });

// Color: one blue ramp for values; red–gray–green for change
const mix = (a, b, t) => '#' + [0, 2, 4].map(i => Math.round(parseInt(a.substr(i + 1, 2), 16) * (1 - t) + parseInt(b.substr(i + 1, 2), 16) * t).toString(16).padStart(2, '0')).join('');
const seqColor = t => mix('#e3ebfb', '#1d47b3', Math.max(0, Math.min(1, t)));
function divColor(p) {
  if (p == null) return '#e6e9ef';
  const t = Math.max(-1, Math.min(1, p / 30));
  return t >= 0 ? mix('#e6e9ef', '#16a35a', t) : mix('#e6e9ef', '#e04848', -t);
}
const inkOn = hex => { const n = parseInt(hex.slice(1), 16); const l = (0.299 * (n >> 16) + 0.587 * (n >> 8 & 255) + 0.114 * (n & 255)) / 255; return l < 0.58 ? '#ffffff' : '#18212f'; };
const pctHtml = p => p == null || !isFinite(p) ? '<span class="d">—</span>' : `<span dir="ltr" class="${p >= 0 ? 'up' : 'down'}">${p >= 0 ? '▲' : '▼'} ${Math.abs(p).toFixed(1)}%</span>`;

function render() {
  const y = +sel.value, mm = FC.maxMonth(y), k = state.metric, f = fmtM(k);
  const cur = byCity(y, mm), prev = byCity(y - 1, mm);
  const R = byRegion(cur), P = prev ? byRegion(prev) : null;
  const total = REGIONS.reduce((s, r) => s + val(R[r.id], k), 0) + val(R.none, k);
  const max = Math.max(...REGIONS.map(r => val(R[r.id], k))) || 1;
  const change = id => P ? fmt.pct(val(R[id], k), val(P[id], k)) : null;
  const colorOf = id => state.mode === 'change' ? divColor(change(id)) : seqColor(0.12 + 0.88 * val(R[id], k) / max);

  document.getElementById('mapTitle').textContent = `${METRIC[k]} לפי אזור`;
  document.getElementById('mapSub').textContent = `${state.item != null ? 'מוצר: ' + D.items[state.item][0] + ' · ' : ''}${FC.periodLabel(y)}${state.mode === 'change' ? (P ? ` מול אותה תקופה ב-${y - 1}` : ' · אין שנה קודמת') : ''} · מפה סכמטית, לא בקנה מידה · לחיצה על אזור לפירוט`;

  // Map
  const svg = document.getElementById('map');
  svg.innerHTML = REGIONS.map(r => {
    const c = colorOf(r.id), ink = inkOn(c), v = val(R[r.id], k);
    const second = state.mode === 'change' ? (P ? (p => p == null ? '—' : `${p >= 0 ? '+' : '−'}${Math.abs(p).toFixed(0)}%`)(change(r.id)) : '—') : f(v);
    return `<path class="rg${state.region === r.id ? ' sel' : ''}" data-r="${r.id}" d="${r.path}" fill="${c}" tabindex="0" role="button" aria-label="${r.name}: ${second}"><title>${r.name} · ${METRIC[k]} ${f(v)}${P ? ` · שינוי ${change(r.id) == null ? '—' : change(r.id).toFixed(1) + '%'}` : ''}</title></path>
      <text class="lbl" x="${r.lx}" y="${r.ly}" fill="${ink}"><tspan class="n" x="${r.lx}">${r.short || r.name}</tspan><tspan class="v" x="${r.lx}" dy="13" direction="ltr" unicode-bidi="embed">${second}</tspan></text>`;
  }).join('') + `<text x="28" y="220" fill="#9fb4d4" font-size="11" letter-spacing="2" text-anchor="middle" transform="rotate(-90 28 220)">הים התיכון</text>`;
  svg.querySelectorAll('.rg').forEach(p => {
    p.onclick = () => { state.region = state.region === p.dataset.r ? null : p.dataset.r; render(); };
    p.onkeydown = e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); p.onclick(); } };
  });
  document.getElementById('scale').innerHTML = state.mode === 'change'
    ? `<span>−30%</span><div class="bar" style="background:linear-gradient(to left,#e04848,#e6e9ef,#16a35a)"></div><span>+30%</span>`
    : `<span>${f(0)}</span><div class="bar" style="background:linear-gradient(to left,${seqColor(.12)},${seqColor(1)})"></div><span>${f(max)}</span>`;

  // Region cards
  document.getElementById('regions').innerHTML = REGIONS.map(r => `<button type="button" class="rcard${state.region === r.id ? ' sel' : ''}" data-r="${r.id}">
      <div class="t"><i style="background:${colorOf(r.id)}"></i>${r.name}</div>
      <div class="v">${f(val(R[r.id], k))}</div>
      <div class="d">${total ? (val(R[r.id], k) / total * 100).toFixed(0) + '% · ' : ''}${pctHtml(change(r.id))}</div></button>`).join('');
  document.querySelectorAll('.rcard').forEach(b => b.onclick = () => { state.region = state.region === b.dataset.r ? null : b.dataset.r; render(); });

  // Detail: the selected region, or the whole country
  const rid = state.region;
  const cityList = Object.entries(cur || {}).filter(([c]) => !rid || CITY_REGION[c] === rid)
    .map(([c, a]) => ({ c, v: val(a, k), a, p: prev?.[c] ? fmt.pct(val(a, k), val(prev[c], k)) : null })).sort((a, b) => b.v - a.v);
  const scope = rid ? R[rid] : { rev: REGIONS.reduce((s, r) => s + R[r.id].rev, 0) + R.none.rev, orders: REGIONS.reduce((s, r) => s + R[r.id].orders, 0) + R.none.orders, custs: cityList.reduce((s, x) => s + x.a.custs.length, 0) };
  const scopeP = rid ? P?.[rid] : null;
  const cmx = cityList[0]?.v || 1;
  document.getElementById('detail').innerHTML = `
    <div class="ch"><h3>${rid ? REGION_NAME[rid] : 'כל הארץ'}</h3>${rid ? '<button type="button" class="seg" id="clr" style="border:0;cursor:pointer;font:inherit;font-size:12px;padding:5px 10px">✕ כל הארץ</button>' : ''}</div>
    <div class="kpis">
      <div>${state.item != null ? 'הכנסות מהמוצר' : 'הכנסות'}<b>${fmt.money(scope.rev)}</b>${rid && scopeP ? pctHtml(fmt.pct(scope.rev, scopeP.rev)) : ''}</div>
      <div>${METRIC.orders}<b>${fmt.num(scope.orders)}</b>${rid && scopeP ? pctHtml(fmt.pct(scope.orders, scopeP.orders)) : ''}</div>
      <div>${METRIC.custs}<b>${fmt.num(scope.custs)}</b>${rid && scopeP ? pctHtml(fmt.pct(scope.custs, scopeP.custs)) : ''}</div>
      <div>חלק מההכנסות<b>${total && k === 'rev' || rid ? ((scope.rev / (REGIONS.reduce((s, r) => s + R[r.id].rev, 0) + R.none.rev || 1)) * 100).toFixed(1) + '%' : '100%'}</b></div>
    </div>
    <div class="sub">${METRIC[k]} לפי שנה · קו לכל אזור · ${FC.LAST_YEAR} עד ${MONTHS[FC.LAST_MONTH - 1]} (מקווקו)</div>
    <div class="lg" id="lg"></div>
    <div class="trend"><canvas id="trend"></canvas></div>`;
  document.getElementById('clr')?.addEventListener('click', () => { state.region = null; render(); });
  drawTrend(k, f, rid);

  document.getElementById('topTitle').textContent = 'ערים מובילות';
  document.getElementById('topSub').textContent = `${rid ? REGION_NAME[rid] + ' · ' : ''}לפי ${METRIC[k]} · ${FC.periodLabel(y)}`;
  document.getElementById('topCities').innerHTML = cityList.slice(0, 10).map((x, i) =>
    `<li><span class="n">${i + 1}</span><div><div class="nm">${x.c}${!rid && CITY_REGION[x.c] ? `<small>${REGION_NAME[CITY_REGION[x.c]]}</small>` : ''}</div><div class="b" style="width:${x.v / cmx * 100}%"></div></div><span class="num">${f(x.v)}<small>${pctHtml(x.p)}</small></span></li>`).join('')
    || '<li><span></span><span class="note">אין נתונים</span></li>';

  // Cities: 10 biggest gains and 10 biggest drops, same layout as the change chart on the main page
  const unknown = Object.keys(cur || {}).filter(c => !CITY_REGION[c]);
  document.getElementById('cityTitle').textContent = `שינוי ב${METRIC[k]} לפי עיר`;
  document.getElementById('citySub').textContent = P
    ? `${rid ? REGION_NAME[rid] + ' · ' : ''}${FC.periodLabel(y)} מול אותה תקופה ב-${y - 1} · 10 העליות ו-10 הירידות הגדולות · שינוי באחוזים (בסוגריים: ההפרש ב${METRIC[k]})` : '';
  document.getElementById('cityNote').textContent = unknown.length ? `לא משויך לאזור: ${unknown.join(', ')}` : '';
  let delta = null;
  if (P) {
    const names = new Set([...Object.keys(cur || {}), ...Object.keys(prev || {})].filter(c => !rid || CITY_REGION[c] === rid));
    const rows = [...names].map(c => ({ id: c, name: c, city: REGION_NAME[CITY_REGION[c]] || '', cur: val(cur?.[c], k), prev: val(prev?.[c], k) }))
      .map(r => ({ ...r, diff: r.cur - r.prev }));
    delta = {
      up: rows.filter(r => r.diff > 0).sort((a, b) => b.diff - a.diff).slice(0, 10),
      down: rows.filter(r => r.diff < 0).sort((a, b) => a.diff - b.diff).slice(0, 10),
    };
  }
  FC.renderDiverging(document.getElementById('cityDiv'), delta, { format: f });
}

// One line per region across all years; the selected region stands out
const REGION_COLOR = { north: '#2a5bd7', haifa: '#f39200', sharon: '#0f9d8a', center: '#6b4fc8', jerusalem: '#c2338a', shfela: '#9a7a1c', south: '#4aa3df' };
let trend;
function drawTrend(k, f, rid) {
  const yrs = D.years, pi = yrs.findIndex(FC.isPartial);
  const byYear = yrs.map(yr => byRegion(byCity(yr, 12)));
  const fade = id => rid && id !== rid;
  document.getElementById('lg').innerHTML = REGIONS.map(r =>
    `<button type="button" data-r="${r.id}" class="${fade(r.id) ? 'off' : ''}"><i style="background:${REGION_COLOR[r.id]}"></i>${r.name}</button>`).join('');
  document.querySelectorAll('#lg button').forEach(b => b.onclick = () => { state.region = state.region === b.dataset.r ? null : b.dataset.r; render(); });
  if (trend) trend.destroy();
  trend = new Chart(document.getElementById('trend'), {
    type: 'line',
    data: { labels: yrs.map(String), datasets: REGIONS.map(r => ({
      label: r.name, data: byYear.map(R => val(R[r.id], k)),
      borderColor: REGION_COLOR[r.id] + (fade(r.id) ? '33' : ''), backgroundColor: REGION_COLOR[r.id],
      borderWidth: rid === r.id ? 3 : 2, pointRadius: rid === r.id ? 3 : 0, pointHoverRadius: 4, tension: .2,
      order: rid === r.id ? 0 : 1,
      segment: { borderDash: c => c.p1DataIndex === pi ? [5, 4] : undefined },
    })) },
    options: {
      maintainAspectRatio: false, animation: { duration: 250 },
      interaction: { mode: 'index', intersect: false },
      plugins: { legend: { display: false }, tooltip: { rtl: true, itemSort: (a, b) => b.parsed.y - a.parsed.y,
        callbacks: { label: c => ` ${c.dataset.label}: ${f(c.parsed.y)}` } } },
      scales: { y: { beginAtZero: true, grid: { color: '#edf0f4' }, border: { display: false }, ticks: { callback: f, font: { size: 10 } } },
        x: { grid: { display: false }, ticks: { font: { size: 10 } } } },
    },
  });
}

function seg(id, key) {
  const el = document.getElementById(id);
  el.addEventListener('click', e => {
    if (!e.target.dataset.v) return;
    state[key] = e.target.dataset.v;
    el.querySelectorAll('button').forEach(b => b.classList.toggle('on', b === e.target));
    render();
  });
}
// ---------- product filter ----------
const prodQ = document.getElementById('prodQ'), prodSugg = document.getElementById('prodSugg'), prodClr = document.getElementById('prodClr');
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
let opts = [], act = 0;
function syncProd() {
  const on = state.item != null;
  prodQ.value = on ? D.items[state.item][0] : '';
  prodQ.title = prodQ.value;
  prodQ.classList.toggle('set', on);
  prodClr.hidden = !on;
  document.querySelector('#metric button[data-v="orders"]').textContent = METRIC.orders;
}
function showProd() {
  const q = (prodQ.value === (state.item != null ? D.items[state.item][0] : '') ? '' : prodQ.value).trim().toLowerCase();
  opts = [{ i: null, n: 'כל המוצרים' }];
  for (let i = 0; i < D.items.length && opts.length < 31; i++) {
    const it = D.items[i];
    if (!q || it[0].toLowerCase().includes(q) || it[1].toLowerCase().includes(q)) opts.push({ i, n: it[0], s: it[1] && 'מק״ט ' + it[1] });
  }
  act = 0;
  prodSugg.innerHTML = opts.map((o, k) => `<button type="button" data-k="${k}" class="${k === act ? 'act' : ''}" role="option"><span class="nm">${esc(o.n)}</span><small>${esc(o.s || '')}</small></button>`).join('')
    + (opts.length === 1 && q ? '<div class="none">לא נמצא מוצר</div>' : '');
  prodSugg.classList.add('on');
}
function pickProd(k) {
  const o = opts[k];
  if (!o) return;
  state.item = o.i;
  prodSugg.classList.remove('on');
  prodQ.blur();
  syncProd();
  render();
}
prodQ.addEventListener('focus', () => { prodQ.select(); showProd(); });
prodQ.addEventListener('input', showProd);
prodQ.addEventListener('keydown', e => {
  if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
    e.preventDefault(); act = (act + (e.key === 'ArrowDown' ? 1 : opts.length - 1)) % opts.length;
    prodSugg.querySelectorAll('button').forEach((b, k) => b.classList.toggle('act', k === act));
  } else if (e.key === 'Enter') { e.preventDefault(); pickProd(act); }
  else if (e.key === 'Escape') { syncProd(); prodSugg.classList.remove('on'); prodQ.blur(); }
});
prodSugg.addEventListener('mousedown', e => { const b = e.target.closest('button'); if (b) { e.preventDefault(); pickProd(+b.dataset.k); } });
prodQ.addEventListener('blur', () => { prodSugg.classList.remove('on'); syncProd(); });
prodClr.addEventListener('click', () => { state.item = null; syncProd(); render(); });

seg('metric', 'metric');
seg('mode', 'mode');
sel.addEventListener('change', render);
render();
