
const { D, fmt, MONTHS } = FC;
// items: [name, code, {year:{month:[rev,qty]}}, {year:{cust:[rev,qty]}}, {cust:[rev,qty]} for Jan..LAST_MONTH of the previous year]
const I = D.items;
Chart.defaults.font.family = 'Rubik';
Chart.defaults.font.size = 11;
Chart.defaults.color = '#465166';
const sel = document.getElementById('year');
FC.yearOptions(sel);
document.getElementById('upd').textContent = 'עודכן ' + D.lastDate.split('-').reverse().join('.');
const state = { lineMode: 'year', metric: 0, view: null, itemsBy: 'rev' };  // view: {t:'c'|'i', id}
let line, extraChart;

// Which items each customer has bought, built once
const custItems = {};
I.forEach((it, i) => { for (const y in it[3]) for (const c in it[3][y]) (custItems[c] ||= new Set()).add(i); });

const sumM = (obj, mm, k) => { let s = 0; if (obj) for (const m in obj) if (+m <= mm) s += obj[m][k]; return s; };
// Customer split of an item for a period; a partial year is compared with the matching months
const itemCusts = (it, y, mm) => (mm < 12 && y === FC.LAST_YEAR - 1 ? it[4] : it[3][y]) || {};
const fmtDate = n => `${String(n % 100).padStart(2, '0')}.${String(Math.floor(n / 100) % 100).padStart(2, '0')}.${Math.floor(n / 10000)}`;
const toDate = n => new Date(Math.floor(n / 10000), Math.floor(n / 100) % 100 - 1, n % 100);
const inPeriod = (n, y, mm) => Math.floor(n / 10000) === y && Math.floor(n / 100) % 100 <= mm;
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const pctOf = (a, b) => b ? fmt.pct(a, b) : null;

// ---------- navigation ----------
function readHash() {
  const m = decodeURIComponent(location.hash).match(/^#([ci])=(.+)$/);
  state.view = location.hash === '#compare' ? { t: 'compare' } : null;
  if (m && m[1] === 'c' && D.customers[m[2]]) state.view = { t: 'c', id: m[2] };
  if (m && m[1] === 'i' && I[+m[2]]) state.view = { t: 'i', id: +m[2] };
}
function go(v) {
  const h = !v ? '' : v.t === 'compare' ? '#compare' : `#${v.t}=${v.id}`;
  if ((location.hash || '') === h || (!h && location.hash === '#')) render();
  else location.hash = h;
  window.scrollTo({ top: 0, behavior: 'smooth' });
}
window.addEventListener('hashchange', () => { readHash(); render(); });
document.getElementById('home').onclick = () => go(null);
document.addEventListener('click', e => {
  const t = e.target.closest('[data-go]');
  if (t) { e.preventDefault(); const [k, id] = t.dataset.go.split(':'); go(k === 'home' ? null : k === 'compare' ? { t: 'compare' } : { t: k, id: k === 'i' ? +id : id }); }
});

// ---------- customer filter: picks the customer view for the overview ----------
const custQ = document.getElementById('custQ'), custSugg = document.getElementById('custSugg'), custClr = document.getElementById('custClr');
let custOpts = [], custAct = 0;
const custNow = () => state.view?.t === 'c' ? state.view.id : null;
function syncCust() {
  const id = custNow();
  custQ.value = id ? D.customers[id].n : '';
  custQ.title = custQ.value;
  custQ.classList.toggle('set', !!id);
  custClr.hidden = !id;
}
function showCust() {
  const id = custNow();
  const q = (custQ.value === (id ? D.customers[id].n : '') ? '' : custQ.value).trim().toLowerCase();
  // Busiest customers first, so the list is useful before typing
  custOpts = [{ id: null, n: 'כל הלקוחות' }, ...Object.entries(D.customers)
    .filter(([, c]) => !q || c.n.toLowerCase().includes(q))
    .sort((a, b) => b[1].o.length - a[1].o.length).slice(0, 30)
    .map(([cid, c]) => ({ id: cid, n: c.n, s: c.c }))];
  custAct = 0;
  custSugg.innerHTML = custOpts.map((o, k) => `<button type="button" data-k="${k}" class="${k === custAct ? 'act' : ''}" role="option">
      <span class="tag c">${o.id ? 'לקוח' : 'הכל'}</span><span class="nm">${esc(o.n)}</span><small>${esc(o.s || '')}</small></button>`).join('')
    + (custOpts.length === 1 && q ? '<div class="none">לא נמצא לקוח</div>' : '');
  custSugg.classList.add('on');
}
function pickCust(k) {
  const o = custOpts[k];
  if (!o) return;
  custSugg.classList.remove('on');
  custQ.blur();
  go(o.id ? { t: 'c', id: o.id } : null);
}
custQ.addEventListener('focus', () => { custQ.select(); showCust(); });
custQ.addEventListener('input', showCust);
custQ.addEventListener('keydown', e => {
  if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
    e.preventDefault(); custAct = (custAct + (e.key === 'ArrowDown' ? 1 : custOpts.length - 1)) % custOpts.length;
    custSugg.querySelectorAll('button').forEach((b, k) => b.classList.toggle('act', k === custAct));
  } else if (e.key === 'Enter') { e.preventDefault(); pickCust(custAct); }
  else if (e.key === 'Escape') { syncCust(); custSugg.classList.remove('on'); custQ.blur(); }
});
custSugg.addEventListener('mousedown', e => { const b = e.target.closest('button'); if (b) { e.preventDefault(); pickCust(+b.dataset.k); } });
custQ.addEventListener('blur', () => { custSugg.classList.remove('on'); syncCust(); });
custClr.addEventListener('click', () => go(null));

// ---------- search ----------
const q = document.getElementById('q'), sugg = document.getElementById('sugg');
let hits = [], act = 0;
function search() {
  const s = q.value.trim().toLowerCase();
  if (!s) { sugg.classList.remove('on'); return; }
  const cs = Object.entries(D.customers).filter(([, c]) => c.n.toLowerCase().includes(s))
    .map(([id, c]) => ({ t: 'c', id, n: c.n, sub: c.c, w: c.o.length })).sort((a, b) => b.w - a.w).slice(0, 6);
  const is = [];
  for (let i = 0; i < I.length && is.length < 8; i++)
    if (I[i][0].toLowerCase().includes(s) || I[i][1].toLowerCase().includes(s)) is.push({ t: 'i', id: i, n: I[i][0], sub: I[i][1] && 'מק״ט ' + I[i][1] });
  hits = [...cs, ...is]; act = 0;
  sugg.innerHTML = hits.length ? hits.map((h, k) => `<button data-k="${k}" class="${k === act ? 'act' : ''}" role="option">
      <span class="tag ${h.t}">${h.t === 'c' ? 'לקוח' : 'פריט'}</span><span class="nm">${esc(h.n)}</span><small>${esc(h.sub || '')}</small></button>`).join('')
    : '<div class="none">לא נמצאו תוצאות</div>';
  sugg.classList.add('on');
}
function pick(k) { const h = hits[k]; if (!h) return; q.value = ''; sugg.classList.remove('on'); go({ t: h.t, id: h.id }); }
q.addEventListener('input', search);
q.addEventListener('focus', search);
q.addEventListener('keydown', e => {
  if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
    e.preventDefault(); act = (act + (e.key === 'ArrowDown' ? 1 : hits.length - 1)) % Math.max(hits.length, 1);
    sugg.querySelectorAll('button').forEach((b, k) => b.classList.toggle('act', k === act));
  } else if (e.key === 'Enter') pick(act);
  else if (e.key === 'Escape') { sugg.classList.remove('on'); q.blur(); }
});
sugg.addEventListener('mousedown', e => { const b = e.target.closest('button'); if (b) { e.preventDefault(); pick(+b.dataset.k); } });
q.addEventListener('blur', () => sugg.classList.remove('on'));

// ---------- controls ----------
function seg(id, key, cast = v => v) {
  const el = document.getElementById(id);
  el.addEventListener('click', e => {
    if (!e.target.dataset.v) return;
    state[key] = cast(e.target.dataset.v);
    el.querySelectorAll('button').forEach(b => b.classList.toggle('on', b === e.target));
    render();
  });
}
seg('lineMode', 'lineMode');
seg('metric', 'metric', Number);
sel.addEventListener('change', render);

const opts = (fmtY, onClick) => ({
  maintainAspectRatio: false, animation: { duration: 300 },
  interaction: { mode: 'index', intersect: false },
  plugins: { legend: { display: false }, tooltip: { rtl: true, callbacks: { label: c => ` ${c.dataset.label ? c.dataset.label + ': ' : ''}${fmtY(c.parsed.y)}` } } },
  scales: { y: { beginAtZero: true, grid: { color: '#edf0f4' }, border: { display: false }, ticks: { callback: fmtY } }, x: { grid: { display: false } } },
  onClick,
});

// ---------- revenue line, for whichever entity is in view ----------
function monthRev(y, m) {
  const v = state.view;
  if (!v) return D.monthly[y]?.[m - 1]?.[0] || 0;
  if (v.t === 'c') return D.customers[v.id].d[y]?.[m]?.[1] || 0;
  return I[v.id][2][y]?.[m]?.[0] || 0;
}
function drawLine(y) {
  let data, sub;
  if (state.lineMode === 'year') {
    const pi = D.years.findIndex(FC.isPartial);
    const vals = D.years.map(yr => { let s = 0; for (let m = 1; m <= 12; m++) s += monthRev(yr, m); return s; });
    data = { labels: D.years.map(String), datasets: [{
      data: vals, borderColor: '#2a5bd7', borderWidth: 2, tension: .2,
      pointRadius: D.years.map(yr => yr === y ? 6 : 3), pointBackgroundColor: D.years.map(yr => yr === y ? '#f39200' : '#2a5bd7'),
      segment: { borderDash: c => c.p1DataIndex === pi ? [6, 5] : undefined } }] };
    sub = `לפי שנה · ${FC.LAST_YEAR} עד ${MONTHS[FC.LAST_MONTH - 1]} (מקווקו) · לחיצה על נקודה בוחרת שנה`;
  } else {
    const labels = [], vals = [];
    for (const yr of D.years) for (let m = 1; m <= FC.maxMonth(yr); m++) { labels.push(`${MONTHS[m - 1]} ${String(yr).slice(2)}`); vals.push(monthRev(yr, m)); }
    const rolling = vals.map((_, i) => i < 2 ? null : vals.slice(i - 2, i + 1).reduce((a, b) => a + b, 0) / 3);
    data = { labels, datasets: [
      { label: 'חודשי', data: vals, borderColor: '#c3cad6', borderWidth: 1, pointRadius: 0, tension: .2 },
      { label: 'ממוצע נע 3 ח׳', data: rolling, borderColor: '#2a5bd7', borderWidth: 2, pointRadius: 0, tension: .2 },
    ] };
    sub = 'הכנסה חודשית (אפור) וממוצע נע של 3 חודשים (כחול)';
  }
  document.getElementById('lineSub').textContent = sub + (state.view?.t === 'i' ? ' · לפי סכום שורות' : '');
  if (line) line.destroy();
  line = new Chart(document.getElementById('line'), { type: 'line', data, options: opts(fmt.money,
    (e, els) => { if (state.lineMode === 'year' && els.length) { sel.value = D.years[els[0].index]; render(); } }) });
  if (state.lineMode === 'month') { line.options.scales.x.ticks = { maxTicksLimit: 12, autoSkip: true }; line.update(); }
}

// ---------- shared pieces ----------
function stat(t, v, p, note) {
  const d = p == null ? `<div class="d">${note || '—'}</div>`
    : `<div class="d ${p >= 0 ? 'up' : 'down'}"><span dir="ltr">${p >= 0 ? '▲' : '▼'} ${Math.abs(p).toFixed(1)}%</span></div>`;
  return `<div class="stat"><div class="t">${t}</div><div class="v" title="${esc(String(v).replace(/<[^>]+>/g, ''))}">${v}</div>${d}</div>`;
}
function topDelta(rows) {
  rows.forEach(r => r.diff = r.cur - r.prev);
  return {
    up: rows.filter(r => r.diff > 0).sort((a, b) => b.diff - a.diff).slice(0, 7),
    down: rows.filter(r => r.diff < 0).sort((a, b) => a.diff - b.diff).slice(0, 7),
  };
}
function card(id, title, sub, body, tools = '') {
  const c = document.getElementById(id);
  c.querySelector('h2').textContent = title;
  c.querySelector('.tools').innerHTML = tools;
  c.querySelector('.sub').textContent = sub;
  c.querySelector('.body').innerHTML = body;
  return c.querySelector('.body');
}
function listHtml(rows, val, go) {
  if (!rows.length) return '<div class="empty-s">אין נתונים בתקופה</div>';
  const mx = Math.max(...rows.map(r => r.v)) || 1;
  return `<ul class="list">${rows.map((r, i) => `<li${go ? ` data-go="${go}:${r.id}" title="פתיחה"` : ''}><span class="n">${i + 1}</span>
    <div><div class="nm">${esc(r.n)}${r.s ? `<small>${esc(r.s)}</small>` : ''}</div><div class="b" style="width:${r.v / mx * 100}%;${r.color ? 'background:' + r.color : ''}"></div></div>
    <span class="num">${val(r)}</span></li>`).join('')}</ul>`;
}
function itemsInPeriod(y, mm) {
  return I.map((it, i) => ({ id: i, n: it[0], s: it[1], v: sumM(it[2][y], mm, 0), q: sumM(it[2][y], mm, 1) }))
    .filter(r => r.v > 0 || r.q > 0).sort((a, b) => b.v - a.v);
}
function setContext(html) {
  const el = document.getElementById('ctx');
  el.innerHTML = html || '';
  el.classList.toggle('on', !!html);
}
function setMetricLabels(first) {
  document.querySelector('#metric button[data-v="0"]').textContent = first;
}

// ---------- view: whole company ----------
function renderAll(y, mm) {
  setContext('');
  const { cur, prev } = FC.kpis(y);
  const top = FC.topCustomers(y, 10);
  const newCusts = Object.values(D.customers).filter(c => c.d[y] && !Object.keys(c.d).some(k => +k < y)).length;
  document.getElementById('strip').innerHTML =
    stat('הכנסות', fmt.money(cur.rev), prev && fmt.pct(cur.rev, prev.rev)) +
    stat('הזמנות', fmt.num(cur.orders), prev && fmt.pct(cur.orders, prev.orders)) +
    stat('לקוחות פעילים', fmt.num(cur.custs), prev && fmt.pct(cur.custs, prev.custs)) +
    stat('הזמנה ממוצעת', '₪' + fmt.num(cur.avg), prev && fmt.pct(cur.avg, prev.avg)) +
    stat('הזמנות ללקוח', (cur.orders / cur.custs).toFixed(1), prev && fmt.pct(cur.orders / cur.custs, prev.orders / prev.custs)) +
    stat('לקוחות חדשים', y === D.years[0] ? '—' : fmt.num(newCusts), null, `הזמנה ראשונה מאז ${D.years[0]}`);

  document.getElementById('lineTitle').textContent = 'הכנסות · כל החברה';
  document.getElementById('divTitle').textContent = 'שינוי לפי לקוח';
  setMetricLabels('מס׳ הזמנות');
  const delta = FC.customerDelta(y, state.metric);
  document.getElementById('divSub').textContent = delta
    ? `${FC.periodLabel(y)} מול ${y - 1} · שינוי באחוזים (בסוגריים: ${state.metric ? 'ההפרש בהכנסות' : 'ההפרש במספר הזמנות'}) · לחיצה על לקוח פותחת את הדף שלו` : '';
  FC.renderDiverging(document.getElementById('div'), delta, { format: state.metric ? fmt.money : fmt.num, onClick: id => go({ t: 'c', id }) });

  const top10 = top.rows.reduce((s, r) => s + r.rev, 0);
  const share = top.total ? top10 / top.total * 100 : 0;
  card('c1', 'ריכוזיות לקוחות', 'החלק של 10 הלקוחות המובילים מסך ההכנסות', top.rows.length ? `
    <div class="big">${share.toFixed(0)}%</div>
    <div class="conc">${top.rows.map((r, i) => `<div data-go="c:${r.id}" title="${esc(r.name)} · ${fmt.money(r.rev)}" style="cursor:pointer;width:${r.rev / top.total * 100}%;background:${i === 0 ? '#1d47b3' : '#2a5bd7'};opacity:${1 - i * 0.06}"></div>`).join('')}<div title="שאר הלקוחות" style="flex:1;background:#dfe4ec"></div></div>
    <div class="conc-l"><span>10 מובילים · ${fmt.money(top10)}</span><span>${top.count - 10} אחרים · ${fmt.money(top.total - top10)}</span></div>
    <div class="sub" style="margin-top:14px">הלקוח הגדול ביותר (${esc(top.rows[0].name)}) = ${(top.rows[0].rev / top.total * 100).toFixed(1)}% מההכנסות</div>` : '<div class="empty-s">אין נתונים</div>');
  card('c2', 'לקוחות מובילים', `לפי הכנסות · ${FC.periodLabel(y)} · לחיצה לפתיחה`,
    listHtml(top.rows.map(r => ({ id: r.id, n: r.name, v: r.rev })), r => fmt.money(r.v), 'c'));
  const byQty = state.itemsBy === 'qty';
  const topItems = itemsInPeriod(y, mm).sort((a, b) => byQty ? b.q - a.q : b.v - a.v).slice(0, 10)
    .map(r => ({ ...r, rev: r.v, v: byQty ? r.q : r.v, color: 'var(--accent)' }));
  card('c3', 'פריטים מובילים', `לפי ${byQty ? 'כמות שנמכרה' : 'סכום שורות'} · ${FC.periodLabel(y)} · לחיצה לפתיחה`,
    listHtml(topItems, r => byQty ? `${fmt.num(r.q)} יח׳<small>${fmt.money(r.rev)}</small>` : `${fmt.money(r.rev)}<small>${fmt.num(r.q)} יח׳</small>`, 'i'),
    `<div class="seg" id="itemsBy"><button data-v="rev" class="${byQty ? '' : 'on'}">הכנסות</button><button data-v="qty" class="${byQty ? 'on' : ''}">כמות</button></div>`);
  document.getElementById('itemsBy').onclick = e => { if (e.target.dataset.v) { state.itemsBy = e.target.dataset.v; renderAll(y, mm); } };
}

// ---------- view: customer page ----------
function renderCustomer(y, mm, id) {
  const c = D.customers[id];
  const sumC = (yr, k) => sumM(c.d[yr], mm, k);
  const rev = sumC(y, 1), orders = sumC(y, 0);
  const hasPrev = !!D.monthly[y - 1];
  const pRev = sumC(y - 1, 1), pOrd = sumC(y - 1, 0);
  const ids = [...(custItems[id] || [])];
  const itemRows = ids.map(i => { const v = itemCusts(I[i], y, mm)[id]; return v ? { id: i, n: I[i][0], s: I[i][1], v: v[0], q: v[1] } : null; })
    .filter(Boolean).sort((a, b) => b.v - a.v);
  const pItems = ids.filter(i => itemCusts(I[i], y - 1, mm)[id]).length;
  const allOrders = c.o;
  const lastO = allOrders[allOrders.length - 1];
  const daysAgo = lastO ? Math.round((new Date(D.lastDate) - toDate(lastO[0])) / 864e5) : null;
  const years = Object.keys(c.d).map(Number).sort();

  setContext(`<a href="#" data-go="home:">כל החברה</a><span class="crumb">›</span><span class="tag c">לקוח</span>
    <h2>${esc(c.n)}</h2><span class="info">${esc(c.c || '')}${c.c ? ' · ' : ''}מס׳ לקוח ${esc(id)}</span>
    <button class="x" data-go="home:">✕ ניקוי סינון</button>`);

  document.getElementById('strip').innerHTML =
    stat('הכנסות', fmt.money(rev), hasPrev ? pctOf(rev, pRev) : null, hasPrev && !pRev ? 'לא הזמין אשתקד' : '') +
    stat('הזמנות', fmt.num(orders), hasPrev ? pctOf(orders, pOrd) : null) +
    stat('הזמנה ממוצעת', orders ? '₪' + fmt.num(rev / orders) : '—', hasPrev && orders && pOrd ? pctOf(rev / orders, pRev / pOrd) : null) +
    stat('פריטים שונים', fmt.num(itemRows.length), hasPrev ? pctOf(itemRows.length, pItems) : null) +
    stat('הזמנה אחרונה', lastO ? fmtDate(lastO[0]) : '—', null, daysAgo == null ? '' : daysAgo === 0 ? 'היום' : `לפני ${fmt.num(daysAgo)} ימים`) +
    // The data starts in D.years[0], so a customer seen from then on may be older than that
    stat('לקוח מאז', years[0] || '—', null, +years[0] === D.years[0] ? `מתחילת הנתונים (${D.years[0]}) ולפני` : `${years.length} שנים עם הזמנות`);

  document.getElementById('lineTitle').textContent = 'הכנסות · ' + c.n;
  document.getElementById('divTitle').textContent = 'שינוי לפי פריט';
  setMetricLabels('כמות');
  const k = state.metric ? 0 : 1;
  const delta = hasPrev ? topDelta(ids.map(i => {
    const cu = itemCusts(I[i], y, mm)[id], pr = itemCusts(I[i], y - 1, mm)[id];
    return (cu || pr) && { id: i, name: I[i][0], city: I[i][1] && 'מק״ט ' + I[i][1], cur: cu ? cu[k] : 0, prev: pr ? pr[k] : 0 };
  }).filter(Boolean)) : null;
  document.getElementById('divSub').textContent = delta
    ? `מה הלקוח קנה יותר / פחות · ${FC.periodLabel(y)} מול ${y - 1} · שינוי באחוזים (בסוגריים: ${state.metric ? 'ההפרש בהכנסות' : 'ההפרש בכמות'}) · לחיצה פותחת פריט` : '';
  const divEl = document.getElementById('div');
  FC.renderDiverging(divEl, delta, { format: state.metric ? fmt.money : fmt.num, onClick: i => go({ t: 'i', id: +i }) });
  if (delta && !delta.up.length && !delta.down.length) divEl.innerHTML = '<div class="empty">אין שינוי בתקופה</div>';

  // Profile: position relative to the company
  const all = FC.topCustomers(y, 99999);
  const rank = all.rows.findIndex(r => r.id === id) + 1;
  const pOrders = allOrders.filter(o => inPeriod(o[0], y, mm));
  const gaps = pOrders.slice(1).map((o, i) => (toDate(o[0]) - toDate(pOrders[i][0])) / 864e5);
  const lifetime = Object.values(c.d).reduce((s, yd) => s + Object.values(yd).reduce((a, v) => a + v[1], 0), 0);
  card('c1', 'פרופיל לקוח', FC.periodLabel(y), `<dl class="kv">
    <dt>דירוג לפי הכנסות</dt><dd>${rank ? `${rank} מתוך ${all.count}` : '—'}</dd>
    <dt>חלק מהכנסות החברה</dt><dd>${all.total ? (rev / all.total * 100).toFixed(1) + '%' : '—'}</dd>
    <dt>הזמנות בחודש (ממוצע)</dt><dd>${(orders / mm).toFixed(1)}</dd>
    <dt>ימים בין הזמנות (ממוצע)</dt><dd>${gaps.length ? (g => g < 10 ? g.toFixed(1) : fmt.num(g))(gaps.reduce((a, b) => a + b, 0) / gaps.length) : '—'}</dd>
    <dt>שורות להזמנה (ממוצע)</dt><dd>${pOrders.length ? (pOrders.reduce((s, o) => s + o[2], 0) / pOrders.length).toFixed(1) : '—'}</dd>
    <dt>הכנסות מצטברות <span dir="ltr">${years[0] || ''}–${FC.LAST_YEAR}</span></dt><dd>${fmt.money(lifetime)}</dd></dl>`);
  card('c2', 'מה הלקוח קונה', `10 הפריטים המובילים לפי סכום · ${FC.periodLabel(y)} · לחיצה פותחת פריט`,
    listHtml(itemRows.slice(0, 10).map(r => ({ ...r, color: 'var(--accent)' })), r => `${fmt.money(r.v)}<small>${fmt.num(r.q)} יח׳</small>`, 'i'));
  const recent = pOrders.slice(-12).reverse();
  card('c3', 'הזמנות אחרונות', `${pOrders.length} הזמנות ב${FC.periodLabel(y)} · 12 האחרונות`, recent.length
    ? `<table><tr><th>תאריך</th><th>שורות</th><th class="l">סכום</th></tr>${recent.map(o => `<tr><td>${fmtDate(o[0])}</td><td>${o[2]}</td><td class="l">₪${fmt.num(o[1])}</td></tr>`).join('')}</table>`
    : '<div class="empty-s">אין הזמנות בתקופה</div>');
}

// ---------- "good to know": seasonality, bought together, lapsed buyers ----------
// Average units per calendar month across the years the item was on sale
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
  const res = { avg, active, enough: units >= 20 && active >= 4 && tot > 0 };
  if (!res.enough) return res;
  // Strongest run of three consecutive months, wrapping December into January
  let best = -1;
  for (let k = 0; k < 12; k++) {
    const w = avg[k] + avg[(k + 1) % 12] + avg[(k + 2) % 12];
    if (w > best) { best = w; res.start = k; }
  }
  res.share = best / tot;
  res.peak = avg.indexOf(Math.max(...avg));
  res.low = avg.indexOf(Math.min(...avg));
  res.years = y1 - y0 + 1;
  return res;
}
function goodToKnow(it, y, mm, cur, prv, hasPrev) {
  const blocks = [];
  const M = k => MONTHS[(k + 12) % 12];

  const se = itemSeason(it);
  const mx = Math.max(...se.avg) || 1;
  const inWin = k => se.enough && se.share >= .35 && [0, 1, 2].some(d => (se.start + d) % 12 === k);
  const bars = `<div class="season">${se.avg.map((v, k) => `<div title="${MONTHS[k]} · ממוצע ${fmt.num(v)} יח׳"><i class="${inWin(k) ? 'on' : ''}" style="height:${Math.max(v / mx * 100, 3)}%"></i><span>${MONTHS[k]}</span></div>`).join('')}</div>`;
  if (!se.enough) {
    blocks.push(`<section class="tip-b"><div class="tip-k">עונתיות</div>
      <p>אין עדיין מספיק היסטוריה כדי לזהות עונתיות (${se.active === 1 ? 'חודש אחד' : se.active + ' חודשים'} עם מכירות).</p></section>`);
  } else if (se.share >= .35) {
    blocks.push(`<section class="tip-b"><div class="tip-k">מתי נמכר הכי טוב</div>
      <p><b>${M(se.start)}–${M(se.start + 2)}</b> הם שיא העונה: ${Math.round(se.share * 100)}% מהכמות השנתית נמכרת בשלושת החודשים האלה (בפיזור אחיד היה 25%). החודש החלש ביותר הוא ${M(se.low)}.</p>
      ${bars}
      <p class="rec"><b>המלצה:</b> להגדיל מלאי ולתזמן מבצעים עד סוף ${M(se.start - 1)}, לפני שהעונה מתחילה.</p></section>`);
  } else {
    blocks.push(`<section class="tip-b"><div class="tip-k">מתי נמכר הכי טוב</div>
      <p>המכירות יציבות לאורך השנה ואין עונה בולטת. החודש החזק יחסית הוא <b>${M(se.peak)}</b>, והחלש הוא ${M(se.low)}.</p>
      ${bars}
      <p class="rec"><b>המלצה:</b> מלאי קבוע לאורך השנה מספיק; אין צורך להיערך לעונה.</p></section>`);
  }

  const parts = it[7] || [];
  if (parts.length) {
    const top = parts.slice(0, 3);
    blocks.push(`<section class="tip-b"><div class="tip-k">נקנה בדרך כלל יחד עם</div>
      <ul class="pairs">${top.map(p => `<li data-go="i:${p[0]}" title="פתיחת הפריט"><span class="nm">${esc(I[p[0]][0])}</span><b>${p[2]}%</b></li>`).join('')}</ul>
      <p class="note">אחוז ההזמנות של הפריט (מתוך ${fmt.num(it[6])}) שכללו גם את המוצר</p>
      <p class="rec"><b>המלצה:</b> להציע את <b>${esc(I[top[0][0]][0])}</b> לכל לקוח שמזמין את הפריט, או לבנות מהשניים חבילה.</p></section>`);
  } else {
    blocks.push(`<section class="tip-b"><div class="tip-k">נקנה בדרך כלל יחד עם</div>
      <p>לא נמצא מוצר שנקנה איתו באותה הזמנה באופן קבוע (${(it[6] || 0) === 1 ? 'נבדקה הזמנה אחת' : `נבדקו ${fmt.num(it[6] || 0)} הזמנות`}).</p></section>`);
  }

  if (hasPrev) {
    const lost = Object.entries(prv).filter(([cid]) => !cur[cid]).sort((a, b) => b[1][0] - a[1][0]);
    if (lost.length) {
      const sumLost = lost.reduce((a, [, v]) => a + v[0], 0);
      blocks.push(`<section class="tip-b"><div class="tip-k">לקוחות שלא חזרו</div>
        <p>${fmt.num(lost.length)} לקוחות קנו את הפריט ב-${mm < 12 ? `${MONTHS[0]}–${MONTHS[mm - 1]} ${y - 1}` : y - 1} ולא ב-${FC.periodLabel(y)}:</p>
        <ul class="pairs">${lost.slice(0, 3).map(([cid, v]) => `<li data-go="c:${cid}" title="פתיחת הלקוח"><span class="nm">${esc(D.customers[cid]?.n || cid)}</span><b>${fmt.money(v[0])}</b></li>`).join('')}</ul>
        <p class="rec"><b>המלצה:</b> לפנות אליהם. יחד הם קנו את הפריט ב-${fmt.money(sumLost)} בתקופה המקבילה.</p></section>`);
    }
  }
  return `<div class="tips">${blocks.join('')}</div>`;
}

// ---------- view: item ----------
function renderItem(y, mm, idx) {
  const it = I[idx];
  const hasPrev = !!D.monthly[y - 1];
  const rev = sumM(it[2][y], mm, 0), qty = sumM(it[2][y], mm, 1);
  const pRev = sumM(it[2][y - 1], mm, 0), pQty = sumM(it[2][y - 1], mm, 1);
  const cur = itemCusts(it, y, mm), prv = itemCusts(it, y - 1, mm);
  const nC = Object.keys(cur).length, pC = Object.keys(prv).length;
  const company = FC.totals(y, mm).rev;
  const yearsSold = Object.keys(it[2]).map(Number).sort();

  setContext(`<a href="#" data-go="home:">כל החברה</a><span class="crumb">›</span><span class="tag i">פריט</span>
    <h2>${esc(it[0])}</h2><span class="info">${it[1] ? 'מק״ט ' + esc(it[1]) : ''}</span>
    <button class="x" data-go="home:">✕ ניקוי סינון</button>`);

  document.getElementById('strip').innerHTML =
    stat('הכנסות (סכום שורות)', fmt.money(rev), hasPrev ? pctOf(rev, pRev) : null, hasPrev && !pRev ? 'לא נמכר אשתקד' : '') +
    stat('כמות שנמכרה', fmt.num(qty), hasPrev ? pctOf(qty, pQty) : null) +
    stat('לקוחות שקנו', fmt.num(nC), hasPrev ? pctOf(nC, pC) : null) +
    stat('מחיר ממוצע ליח׳', qty ? '₪' + (rev / qty).toFixed(rev / qty < 100 ? 1 : 0) : '—', hasPrev && qty && pQty ? pctOf(rev / qty, pRev / pQty) : null) +
    stat('חלק מהכנסות החברה', company ? (rev / company * 100).toFixed(2) + '%' : '—', null) +
    stat('נמכר בשנים', yearsSold.length ? `<span dir="ltr">${yearsSold[0]}–${yearsSold[yearsSold.length - 1]}</span>` : '—', null, `${yearsSold.length} שנים`);

  document.getElementById('lineTitle').textContent = 'הכנסות · ' + it[0];
  document.getElementById('divTitle').textContent = 'שינוי לפי לקוח';
  setMetricLabels('כמות');
  const k = state.metric ? 0 : 1;
  const delta = hasPrev ? topDelta([...new Set([...Object.keys(cur), ...Object.keys(prv)])].map(cid => ({
    id: cid, name: D.customers[cid]?.n || cid, city: D.customers[cid]?.c, cur: cur[cid]?.[k] || 0, prev: prv[cid]?.[k] || 0,
  }))) : null;
  document.getElementById('divSub').textContent = delta
    ? `מי קנה יותר / פחות מהפריט · ${FC.periodLabel(y)} מול ${y - 1} · שינוי באחוזים (בסוגריים: ${state.metric ? 'ההפרש בהכנסות' : 'ההפרש בכמות'}) · לחיצה פותחת לקוח` : '';
  const divEl = document.getElementById('div');
  FC.renderDiverging(divEl, delta, { format: state.metric ? fmt.money : fmt.num, onClick: id => go({ t: 'c', id }) });
  if (delta && !delta.up.length && !delta.down.length) divEl.innerHTML = '<div class="empty">אין שינוי בתקופה</div>';

  document.getElementById('c1').classList.add('tip');
  card('c1', 'טוב לדעת', 'תובנות מכל היסטוריית המכירות של הפריט', goodToKnow(it, y, mm, cur, prv, hasPrev));
  // Units first: bar length (v) follows quantity, revenue shown small
  const custRows = Object.entries(cur).map(([cid, v]) => ({ id: cid, n: D.customers[cid]?.n || cid, s: D.customers[cid]?.c, v: v[1], q: v[1], rev: v[0] }))
    .sort((a, b) => b.q - a.q || b.rev - a.rev);
  card('c2', y === FC.LAST_YEAR ? 'מי קונה את הפריט השנה' : `מי קונה את הפריט ב-${y}`,
    `${custRows.length} לקוחות · לפי כמות · ${FC.periodLabel(y)} · לחיצה פותחת לקוח`,
    listHtml(custRows.slice(0, 10), r => `${fmt.num(r.q)} יח׳<small>${fmt.money(r.rev)}</small>`, 'c'));
  const sw = (c, t) => `<span style="display:inline-flex;align-items:center;gap:5px;margin-inline-end:14px;font-size:12px;color:var(--ink-2)"><i style="width:10px;height:10px;border-radius:2px;background:${c}"></i>${t}</span>`;
  const body = card('c3', 'כמות חודשית', 'יחידות שנמכרו בכל חודש', `<div>${sw('#f39200', y)}${sw('#c3cad6', y - 1)}</div><div class="box sm"><canvas></canvas></div>`);
  if (extraChart) extraChart.destroy();
  extraChart = new Chart(body.querySelector('canvas'), { type: 'bar', data: { labels: MONTHS, datasets: [
    { label: String(y - 1), data: MONTHS.map((_, m) => it[2][y - 1]?.[m + 1]?.[1] || 0), backgroundColor: '#c3cad6', borderRadius: 3 },
    { label: String(y), data: MONTHS.map((_, m) => m < mm ? it[2][y]?.[m + 1]?.[1] || 0 : null), backgroundColor: '#f39200', borderRadius: 3 },
  ] }, options: { ...opts(fmt.num), plugins: { legend: { display: false }, tooltip: { rtl: true } } } });
}

// ---------- comparisons page ----------
// Fixed order, checked for color-blind separation; each line keeps its color when others are removed
const PALETTE = ['#2a5bd7', '#f39200', '#0f9d8a', '#6b4fc8', '#c2338a'];
const MAX_SERIES = 5;
const ym = ([y, m]) => y * 12 + m - 1;
const FIRST_YM = ym([D.years[0], 1]), LAST_YM = ym([FC.LAST_YEAR, FC.LAST_MONTH]);
const METRIC_NAME = { rev: 'הכנסות', qty: 'כמות', orders: 'מספר הזמנות' };
const cmp = {
  metric: 'rev', mode: 'month',
  series: [
    { c: null, i: null, from: [FC.LAST_YEAR - 1, 1], to: [FC.LAST_YEAR - 1, 12], color: PALETTE[0] },
    { c: null, i: null, from: [FC.LAST_YEAR, 1], to: [FC.LAST_YEAR, FC.LAST_MONTH], color: PALETTE[1] },
  ],
};
let cmpChart, companyQtyCache;

function companyQty(y, m) {
  if (!companyQtyCache) {
    companyQtyCache = {};
    for (const it of I) for (const yy in it[2]) for (const mm in it[2][yy]) {
      const k = yy * 100 + +mm;
      companyQtyCache[k] = (companyQtyCache[k] || 0) + it[2][yy][mm][1];
    }
  }
  return companyQtyCache[y * 100 + m] || 0;
}
// Value of one line in one month. Order counts exist per document, so not for a line with an item
function seriesValue(s, y, m) {
  const metric = cmp.metric;
  if (s.i != null) {
    if (metric === 'orders') return null;
    const it = I[s.i], k = metric === 'rev' ? 0 : 1;
    return (s.c != null ? it[5][y]?.[s.c]?.[m]?.[k] : it[2][y]?.[m]?.[k]) || 0;
  }
  if (s.c != null) {
    const c = D.customers[s.c];
    if (metric === 'rev') return c.d[y]?.[m]?.[1] || 0;
    if (metric === 'orders') return c.d[y]?.[m]?.[0] || 0;
    let q = 0;
    for (const i of custItems[s.c] || []) q += I[i][5][y]?.[s.c]?.[m]?.[1] || 0;
    return q;
  }
  if (metric === 'rev') return D.monthly[y]?.[m - 1]?.[0] || 0;
  if (metric === 'orders') return D.monthly[y]?.[m - 1]?.[1] || 0;
  return companyQty(y, m);
}
function seriesMonths(s) {
  let a = ym(s.from), b = ym(s.to);
  if (a > b) [a, b] = [b, a];
  a = Math.max(a, FIRST_YM); b = Math.min(b, LAST_YM);
  const out = [];
  for (let k = a; k <= b; k++) out.push([Math.floor(k / 12), k % 12 + 1]);
  return out;
}
const monthLabel = ([y, m]) => `${MONTHS[m - 1]} ${String(y).slice(2)}`;
function periodText(months) {
  if (!months.length) return 'אין נתונים בטווח';
  const a = months[0], b = months[months.length - 1];
  if (a[0] === b[0] && a[1] === 1 && b[1] === 12) return String(a[0]);
  if (a[0] === b[0]) return a[1] === b[1] ? `${MONTHS[a[1] - 1]} ${a[0]}` : `${MONTHS[a[1] - 1]}–${MONTHS[b[1] - 1]} ${a[0]}`;
  return `${monthLabel(a)} – ${monthLabel(b)}`;
}
function seriesName(s) {
  const parts = [];
  if (s.c != null) parts.push(D.customers[s.c].n);
  if (s.i != null) parts.push(I[s.i][0]);
  return parts.length ? parts.join(' · ') : 'כל החברה';
}

// Search box limited to one kind (customer or item); an empty choice means "all"
function picker(kind, s) {
  const wrap = document.createElement('div');
  wrap.className = 'pick';
  const input = document.createElement('input');
  input.placeholder = kind === 'c' ? 'כל הלקוחות' : 'כל המוצרים';
  input.setAttribute('aria-label', kind === 'c' ? 'לקוח' : 'מוצר');
  input.autocomplete = 'off';
  const list = document.createElement('div');
  list.className = 'sugg';
  wrap.append(input, list);
  let opts = [], act = 0;
  const current = () => s[kind] == null ? '' : kind === 'c' ? D.customers[s[kind]].n : I[s[kind]][0];
  const sync = () => { input.value = current(); input.title = input.value; input.classList.toggle('set', s[kind] != null); };
  function candidates(q) {
    q = q.trim().toLowerCase();
    let pool = [];
    // Rank by activity in this line's own period first, then by all years
    const inYears = new Set(seriesMonths(s).map(([y]) => y));
    if (kind === 'c') {
      // With an item chosen, offer only customers who bought it, biggest buyers first
      let weight = null;
      if (s.i != null) {
        weight = {};
        for (const [y, o] of Object.entries(I[s.i][3])) for (const id in o) {
          const w = weight[id] ||= [0, 0];
          w[0] += inYears.has(+y) ? o[id][0] : 0; w[1] += o[id][0];
        }
      }
      pool = Object.entries(D.customers).filter(([id, c]) => (!weight || id in weight) && (!q || c.n.toLowerCase().includes(q)))
        .sort((a, b) => weight ? weight[b[0]][0] - weight[a[0]][0] || weight[b[0]][1] - weight[a[0]][1] : b[1].o.length - a[1].o.length)
        .slice(0, 30).map(([id, c]) => ({ id, n: c.n, sub: c.c }));
    } else if (s.c != null) {
      // With a customer chosen, offer only items they bought, by what they spent on each
      const match = i => !q || I[i][0].toLowerCase().includes(q) || I[i][1].toLowerCase().includes(q);
      pool = [...(custItems[s.c] || [])].filter(match)
        .map(i => {
          let p = 0, all = 0;
          for (const [y, o] of Object.entries(I[i][3])) { const v = o[s.c]?.[0] || 0; all += v; if (inYears.has(+y)) p += v; }
          return { i, p, all };
        })
        .sort((a, b) => b.p - a.p || b.all - a.all).slice(0, 30)
        .map(({ i }) => ({ id: i, n: I[i][0], sub: I[i][1] && 'מק״ט ' + I[i][1] }));
    } else {
      for (let i = 0; i < I.length && pool.length < 30; i++) {
        if (q && !I[i][0].toLowerCase().includes(q) && !I[i][1].toLowerCase().includes(q)) continue;
        pool.push({ id: i, n: I[i][0], sub: I[i][1] && 'מק״ט ' + I[i][1] });
      }
    }
    return [{ id: null, n: kind === 'c' ? 'כל הלקוחות' : 'כל המוצרים' }, ...pool];
  }
  function show() {
    opts = candidates(input.value === current() ? '' : input.value);
    act = 0;
    list.innerHTML = opts.map((o, k) => `<button type="button" data-k="${k}" class="${k === act ? 'act' : ''}">
        <span class="tag ${kind}">${o.id == null ? 'הכל' : kind === 'c' ? 'לקוח' : 'מוצר'}</span><span class="nm">${esc(o.n)}</span><small>${esc(o.sub || '')}</small></button>`).join('')
      + (opts.length === 1 && input.value ? '<div class="none">לא נמצאו תוצאות</div>' : '');
    list.classList.add('on');
  }
  function choose(k) {
    const o = opts[k];
    if (!o) return;
    s[kind] = o.id;
    sync(); list.classList.remove('on'); input.blur();
    drawCompare();
  }
  input.addEventListener('focus', () => { input.select(); show(); });
  input.addEventListener('input', show);
  input.addEventListener('keydown', e => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault(); act = (act + (e.key === 'ArrowDown' ? 1 : opts.length - 1)) % opts.length;
      list.querySelectorAll('button').forEach((b, k) => b.classList.toggle('act', k === act));
    } else if (e.key === 'Enter') { e.preventDefault(); choose(act); }
    else if (e.key === 'Escape') { sync(); list.classList.remove('on'); input.blur(); }
  });
  list.addEventListener('mousedown', e => { const b = e.target.closest('button'); if (b) { e.preventDefault(); choose(+b.dataset.k); } });
  input.addEventListener('blur', () => { list.classList.remove('on'); sync(); });
  sync();
  return wrap;
}
function periodSel(s, key, label) {
  const wrap = document.createElement('div');
  wrap.className = 'per';
  const mSel = document.createElement('select'), ySel = document.createElement('select');
  mSel.innerHTML = MONTHS.map((n, i) => `<option value="${i + 1}">${n}</option>`).join('');
  ySel.innerHTML = D.years.map(y => `<option value="${y}">${y}</option>`).join('');
  mSel.value = s[key][1]; ySel.value = s[key][0];
  mSel.setAttribute('aria-label', `${label} – חודש`); ySel.setAttribute('aria-label', `${label} – שנה`);
  mSel.onchange = ySel.onchange = () => { s[key] = [+ySel.value, +mSel.value]; drawCompare(); };
  wrap.append(label, mSel, ySel);
  return wrap;
}
function renderSeriesRows() {
  const el = document.getElementById('series');
  el.innerHTML = '';
  cmp.series.forEach((s, k) => {
    const row = document.createElement('div');
    row.className = 's-row';
    const sw = document.createElement('span');
    sw.className = 'sw'; sw.style.background = s.color;
    const rm = document.createElement('button');
    rm.type = 'button'; rm.className = 'rm'; rm.textContent = '✕'; rm.title = 'הסרת הקו'; rm.setAttribute('aria-label', 'הסרת הקו');
    rm.disabled = cmp.series.length === 1;
    rm.onclick = () => { cmp.series.splice(k, 1); renderSeriesRows(); drawCompare(); };
    row.append(sw, picker('c', s), picker('i', s), periodSel(s, 'from', 'מ־'), periodSel(s, 'to', 'עד'), rm);
    el.append(row);
  });
  const add = document.getElementById('addSeries');
  add.disabled = cmp.series.length >= MAX_SERIES;
  add.textContent = add.disabled ? 'אפשר להשוות עד 5 קווים' : '+ הוסף השוואה';
}
document.getElementById('addSeries').onclick = () => {
  const last = cmp.series[cmp.series.length - 1];
  const color = PALETTE.find(c => !cmp.series.some(s => s.color === c));
  cmp.series.push({ c: last.c, i: last.i, from: [...last.from], to: [...last.to], color });
  renderSeriesRows();
  drawCompare();
  document.querySelector('#series .s-row:last-child .pick input')?.focus();
};
function segCmp(id, key) {
  const el = document.getElementById(id);
  el.addEventListener('click', e => {
    if (!e.target.dataset.v) return;
    cmp[key] = e.target.dataset.v;
    el.querySelectorAll('button').forEach(b => b.classList.toggle('on', b === e.target));
    drawCompare();
  });
}
segCmp('cmpMetric', 'metric');
segCmp('cmpMode', 'mode');

function drawCompare() {
  const f = cmp.metric === 'rev' ? fmt.money : fmt.num;
  const rows = cmp.series.map(s => {
    const months = seriesMonths(s);
    const raw = months.map(([y, m]) => seriesValue(s, y, m));
    return { s, months, raw, na: raw.some(v => v === null) };
  });
  const timeline = cmp.mode === 'year';
  let labels, n;
  if (timeline) {
    // One continuous axis across every line's months; a month name repeats once per year
    const all = rows.flatMap(r => r.months.map(ym));
    const a = all.length ? Math.min(...all) : LAST_YM, b = all.length ? Math.max(...all) : LAST_YM;
    n = b - a + 1;
    labels = Array.from({ length: n }, (_, k) => monthLabel([Math.floor((a + k) / 12), (a + k) % 12 + 1]));
    rows.forEach(r => {
      r.data = Array(n).fill(null);
      if (!r.na) r.months.forEach((m, j) => { r.data[ym(m) - a] = r.raw[j]; });
    });
  } else {
    // January to December once; a line that spans several years shows the average of each month
    n = 12;
    labels = MONTHS;
    rows.forEach(r => {
      const sum = Array(12).fill(0), cnt = Array(12).fill(0);
      if (!r.na) r.months.forEach(([, m], j) => { sum[m - 1] += r.raw[j]; cnt[m - 1]++; });
      r.cnt = cnt;
      r.data = sum.map((v, k) => cnt[k] ? v / cnt[k] : null);
    });
  }
  const multiYear = rows.some(r => r.cnt?.some(c => c > 1));
  const axisNote = timeline ? 'ציר זמן רציף: כל חודש מופיע לפי השנה שלו'
    : 'כל חודש מופיע פעם אחת, הקווים זה על זה' + (multiYear ? ' · קו שמכסה יותר משנה מוצג כממוצע לחודש' : '');

  document.getElementById('cmpTitle').textContent = `${METRIC_NAME[cmp.metric]} · ${timeline ? 'תצוגה שנתית' : 'תצוגה חודשית'}`;
  document.getElementById('cmpSub').textContent = axisNote
    + (cmp.metric === 'rev' ? ' · הכנסות לקו עם מוצר = סכום שורות; בלי מוצר = סך ההזמנות לפני מע״מ' : '')
    + (rows.some(r => r.na) ? ' · מספר הזמנות לא זמין לקו עם מוצר' : '');
  document.getElementById('cmpLegend').innerHTML = rows.map(r =>
    `<span><i style="background:${r.s.color}"></i>${esc(seriesName(r.s))} · ${periodText(r.months)}${r.na ? ' (לא זמין)' : ''}</span>`).join('');

  if (cmpChart) cmpChart.destroy();
  cmpChart = new Chart(document.getElementById('cmpChart'), {
    type: 'line',
    data: { labels, datasets: rows.map(r => ({
      label: seriesName(r.s), data: r.data,
      borderColor: r.s.color, backgroundColor: r.s.color, borderWidth: 2, tension: .2,
      pointRadius: n > 36 ? 0 : 3, pointHoverRadius: 5, pointBorderColor: '#fff', pointBorderWidth: 1.5,
    })) },
    options: {
      ...opts(f),
      plugins: { legend: { display: false }, tooltip: { rtl: true, callbacks: {
        title: items => items.length ? labels[items[0].dataIndex] : '',
        label: c => {
          const r = rows[c.datasetIndex], k = r.cnt?.[c.dataIndex];
          return ` ${seriesName(r.s)}: ${f(c.parsed.y)}${k > 1 ? ` (ממוצע ${k} שנים)` : ''}`;
        },
      } } },
    },
  });
  if (timeline && n > 24) { cmpChart.options.scales.x.ticks = { maxTicksLimit: 14, autoSkip: true, maxRotation: 0 }; cmpChart.update(); }

  // Summary uses the monthly values, also when the chart shows a running total
  const base = rows[0];
  const avgOf = r => r.months.length ? r.raw.reduce((a, b) => a + b, 0) / r.months.length : 0;
  const pctCell = p => p == null || !isFinite(p) ? '<span style="color:var(--ink-3)">—</span>'
    : `<span dir="ltr" class="${p >= 0 ? 'up' : 'down'}" style="color:${p >= 0 ? '#0f7a42' : '#b42828'};font-weight:600">${p >= 0 ? '▲' : '▼'} ${Math.abs(p).toFixed(1)}%</span>`;
  document.getElementById('sumSub').textContent = `${METRIC_NAME[cmp.metric]} · לפי ערכים חודשיים`;
  document.getElementById('cmpTable').innerHTML = `<tr><th></th><th title="מה נבדק בקו: לקוח, מוצר, או כל החברה">קו</th>
      <th title="טווח החודשים שנבדק בקו">תקופה</th><th title="כמה חודשים יש בתקופה">מס׳ חודשים</th>
      <th class="l" title="סכום כל החודשים בתקופה">סה״כ בתקופה</th><th class="l" title="הסה״כ חלקי מספר החודשים">ממוצע לחודש</th>
      <th title="החודש עם הערך הגבוה ביותר בתקופה, וכמה היה בו">החודש החזק</th><th title="החודש עם הערך הנמוך ביותר בתקופה, וכמה היה בו">החודש החלש</th>
      <th title="השינוי בסה״כ לעומת אותם חודשים בשנה הקודמת">שינוי מול אשתקד</th><th title="בכמה אחוזים הממוצע החודשי של הקו גבוה או נמוך מזה של קו 1">הפרש מקו 1</th></tr>` +
    rows.map((r, k) => {
      if (r.na || !r.months.length) return `<tr><td><span class="sw" style="background:${r.s.color}"></span></td><td class="desc">${esc(seriesName(r.s))}</td>
        <td>${periodText(r.months)}</td><td colspan="7" style="color:var(--ink-3)">${r.na ? 'מספר הזמנות לא זמין לקו עם מוצר' : 'אין נתונים בטווח'}</td></tr>`;
      const total = r.raw.reduce((a, b) => a + b, 0), avg = avgOf(r);
      const hi = r.raw.indexOf(Math.max(...r.raw)), lo = r.raw.indexOf(Math.min(...r.raw));
      // Same months one year earlier, when the data covers them
      const prev = r.months.every(([y, m]) => ym([y - 1, m]) >= FIRST_YM) ? r.months.reduce((a, [y, m]) => a + seriesValue(r.s, y - 1, m), 0) : null;
      const vsBase = k === 0 || base.na || !base.months.length ? null : fmt.pct(avg, avgOf(base));
      return `<tr><td><span class="sw" style="background:${r.s.color}"></span></td><td class="desc">${esc(seriesName(r.s))}</td>
        <td>${periodText(r.months)}</td><td>${r.months.length}</td><td class="l"><b>${f(total)}</b></td><td class="l">${f(avg)}</td>
        <td><bdi>${monthLabel(r.months[hi])}</bdi> · <bdi>${f(r.raw[hi])}</bdi></td><td><bdi>${monthLabel(r.months[lo])}</bdi> · <bdi>${f(r.raw[lo])}</bdi></td>
        <td>${pctCell(prev ? fmt.pct(total, prev) : null)}</td><td>${k === 0 ? '<span style="color:var(--ink-3)">קו הבסיס</span>' : pctCell(vsBase)}</td></tr>`;
    }).join('');
}

function render() {
  const isCmp = state.view?.t === 'compare';
  document.getElementById('c1').classList.remove('tip');
  document.getElementById('overview').hidden = isCmp;
  document.getElementById('comparePage').hidden = !isCmp;
  document.getElementById('yearWrap').hidden = isCmp;
  document.getElementById('custPick').hidden = isCmp;
  syncCust();
  document.getElementById('tabCompare').classList.toggle('on', isCmp);
  document.getElementById('tabOverview').classList.toggle('on', !isCmp);
  if (isCmp) {
    if (!document.querySelector('#series .s-row')) renderSeriesRows();
    drawCompare();
    return;
  }
  const y = +sel.value, mm = FC.maxMonth(y);
  if (extraChart && state.view?.t !== 'i') { extraChart.destroy(); extraChart = null; }
  if (!state.view) renderAll(y, mm);
  else if (state.view.t === 'c') renderCustomer(y, mm, state.view.id);
  else renderItem(y, mm, state.view.id);
  drawLine(y);
}
readHash();
render();
