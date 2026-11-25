// Shared calculations and rendering for the Flacar mockups
(function () {
  const D = window.FLACAR_DATA;
  const last = new Date(D.lastDate);
  const LAST_YEAR = last.getFullYear();
  const LAST_MONTH = last.getMonth() + 1;
  const MONTHS = ['ינו׳', 'פבר׳', 'מרץ', 'אפר׳', 'מאי', 'יוני', 'יולי', 'אוג׳', 'ספט׳', 'אוק׳', 'נוב׳', 'דצמ׳'];

  // A partial year is compared with the same months of the previous year
  function maxMonth(y) { return y === LAST_YEAR ? LAST_MONTH : 12; }
  function isPartial(y) { return maxMonth(y) < 12; }
  function periodLabel(y) {
    return isPartial(y) ? `ינו׳–${MONTHS[maxMonth(y) - 1]} ${y}` : `${y}`;
  }

  function totals(y, mm) {
    const rows = D.monthly[y];
    if (!rows) return null;
    let rev = 0, orders = 0;
    for (let m = 0; m < mm; m++) { rev += rows[m][0]; orders += rows[m][1]; }
    let custs = 0;
    for (const c of Object.values(D.customers)) {
      const yd = c.d[y];
      if (!yd) continue;
      for (const m in yd) if (+m <= mm) { custs++; break; }
    }
    return { rev, orders, custs, avg: orders ? rev / orders : 0 };
  }

  function kpis(y) {
    const mm = maxMonth(y);
    return { cur: totals(y, mm), prev: totals(y - 1, mm) };
  }

  function custSum(c, y, mm) {
    const yd = c.d[y];
    let o = 0, r = 0;
    if (yd) for (const m in yd) if (+m <= mm) { o += yd[m][0]; r += yd[m][1]; }
    return [o, r];
  }

  // metric: 0 = order count, 1 = revenue. Returns the 7 largest increases and 7 largest decreases
  function customerDelta(y, metric = 0, n = 7) {
    if (!D.monthly[y - 1]) return null;
    const mm = maxMonth(y);
    const rows = [];
    for (const [id, c] of Object.entries(D.customers)) {
      const cur = custSum(c, y, mm)[metric];
      const prev = custSum(c, y - 1, mm)[metric];
      if (cur || prev) rows.push({ id, name: c.n, city: c.c, cur, prev, diff: cur - prev });
    }
    const up = rows.filter(r => r.diff > 0).sort((a, b) => b.diff - a.diff).slice(0, n);
    const down = rows.filter(r => r.diff < 0).sort((a, b) => a.diff - b.diff).slice(0, n);
    return { up, down };
  }

  function topCustomers(y, n = 10) {
    const mm = maxMonth(y);
    const all = Object.entries(D.customers).map(([id, c]) => {
      const [o, r] = custSum(c, y, mm);
      const [po, pr] = custSum(c, y - 1, mm);
      return { id, name: c.n, city: c.c, orders: o, rev: r, prevRev: pr, prevOrders: po };
    }).filter(r => r.orders).sort((a, b) => b.rev - a.rev);
    const total = all.reduce((s, r) => s + r.rev, 0);
    return { rows: all.slice(0, n), total, count: all.length };
  }

  function customerMonthly(id, y) {
    const c = D.customers[id];
    return Array.from({ length: 12 }, (_, i) => {
      const v = c.d[y] && c.d[y][i + 1];
      return v ? v : [0, 0];
    });
  }

  const fmt = {
    money(v) {
      const a = Math.abs(v);
      if (a >= 1e6) return `₪${(v / 1e6).toFixed(2)}M`;
      if (a >= 1e3) return `₪${(v / 1e3).toFixed(0)}K`;
      return `₪${Math.round(v)}`;
    },
    num(v) { return Math.round(v).toLocaleString('he-IL'); },
    signed(v, f = fmt.num) { return (v > 0 ? '+' : v < 0 ? '−' : '') + f(Math.abs(v)); },
    pct(cur, prev) {
      // Net figures can be negative after credit notes; a percent needs a positive base
      if (!prev || prev < 0) return null;
      return (cur - prev) / prev * 100;
    },
  };

  // Like the reference image: label | zero axis | green to the right, red to the left
  function renderDiverging(el, delta, opts = {}) {
    const f = opts.format || fmt.num;
    if (!delta) { el.innerHTML = '<div class="empty">אין שנה קודמת להשוואה</div>'; return; }
    // Callers pick the rows by absolute difference; bars and order use the percent change.
    // Without a positive base (prev <= 0, possible after credit notes) a rise reads "new" and a fall has no percent
    const pct = r => r.prev > 0 ? r.diff / r.prev * 100 : r.diff >= 0 ? Infinity : -Infinity;
    const up = delta.up.slice().sort((a, b) => pct(b) - pct(a));
    const down = delta.down.slice().sort((a, b) => pct(a) - pct(b));
    const rows = [...up, ...down.reverse()];
    const UP_CAP = 300;
    const finiteUp = up.map(pct).filter(isFinite);
    const maxUp = up.length ? Math.min(UP_CAP, Math.max(1, ...finiteUp, finiteUp.length ? 0 : 100)) : 0;
    const maxDown = down.length ? 100 : 0;
    // Space split proportional to the two percent scales, with a minimum for each side
    let negShare = maxDown / (maxUp + maxDown || 1);
    negShare = opts.negShare ?? Math.min(0.6, Math.max(0.22, negShare));
    const pctTxt = p => {
      const a = Math.abs(p);
      return (p > 0 ? '+' : p < 0 ? '−' : '') + (a < 10 ? a.toFixed(1).replace(/\.0$/, '') : Math.round(a).toLocaleString('he-IL')) + '%';
    };
    el.innerHTML = rows.map(r => {
      const pos = r.diff > 0, p = pct(r);
      const w = pos ? Math.min(p / maxUp, 1) * (1 - negShare) * 100 : Math.min(-p / maxDown, 1) * negShare * 100;
      const left = pos ? negShare * 100 : negShare * 100 - w;
      const main = isFinite(p) ? pctTxt(p) : p > 0 ? 'חדש' : '—';
      const tip = `${r.name}${r.city ? ' · ' + r.city : ''}\nקודם: ${f(r.prev)} · נוכחי: ${f(r.cur)} · ${isFinite(p) ? 'שינוי: ' + main : p > 0 ? 'חדש (אין נתונים בתקופה הקודמת)' : 'אין בסיס חיובי לחישוב אחוז'}`;
      return `<div class="dv-row" data-id="${r.id}" title="${tip.replace(/"/g, '&quot;')}">
        <div class="dv-label">${r.name}</div>
        <div class="dv-track">
          <div class="dv-zero" style="left:${negShare * 100}%"></div>
          <div class="dv-bar ${pos ? 'up' : 'down'}" style="left:${left}%;width:${Math.max(w, 0.6)}%"></div>
          <div class="dv-val ${pos ? 'up' : 'down'}" dir="ltr" style="${pos ? `left:calc(${left + w}% + 6px)` : `right:calc(${100 - left}% + 6px)`}">${main} <span class="dv-abs" dir="ltr">(${fmt.signed(r.diff, f)})</span></div>
        </div>
      </div>`;
    }).join('');
    if (opts.onClick) el.querySelectorAll('.dv-row').forEach(n => n.addEventListener('click', () => opts.onClick(n.dataset.id)));
  }

  function yearOptions(sel) {
    sel.innerHTML = D.years.slice().reverse().map(y => `<option value="${y}">${y}${isPartial(y) ? ' (YTD)' : ''}</option>`).join('');
  }

  // CSS for the diverging chart — shared by all three mockups (colors come from page tokens)
  const css = `
  .dv-row{display:grid;grid-template-columns:minmax(110px,32%) 1fr;align-items:center;gap:10px;height:28px;cursor:default;direction:ltr;border-radius:6px}
  .dv-row:hover{background:var(--hover)}
  .dv-label{font-size:13px;color:var(--ink-2);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;text-align:right;direction:rtl}
  .dv-track{position:relative;height:100%;margin-inline:116px}
  .dv-zero{position:absolute;top:2px;bottom:2px;width:1px;background:var(--axis)}
  .dv-bar{position:absolute;top:6px;bottom:6px}
  .dv-bar.up{background:var(--up);border-radius:0 4px 4px 0}
  .dv-bar.down{background:var(--down);border-radius:4px 0 0 4px}
  .dv-val{position:absolute;top:50%;transform:translateY(-50%);font-size:12px;font-weight:700;white-space:nowrap;color:var(--ink-1);font-variant-numeric:tabular-nums}
  .dv-abs{font-size:.85em;font-weight:400;color:var(--ink-3)}
  .dv-sep{height:1px;background:var(--grid);margin:4px 0}
  .empty{padding:40px;text-align:center;color:var(--ink-3)}`;
  const style = document.createElement('style');
  style.textContent = css;
  document.head.appendChild(style);

  window.FC = { D, MONTHS, LAST_YEAR, LAST_MONTH, maxMonth, isPartial, periodLabel, totals, kpis, customerDelta, topCustomers, customerMonthly, fmt, renderDiverging, yearOptions };
})();
