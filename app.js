/* ============================================================
   Sentinel — single-page research site
   Loads sentinel_data.json (produced by the Colab notebook)
   and renders Overview / Stocks / Portfolio / Globe / Lab / Glossary.
   ============================================================ */

'use strict';

/* ---------- global data ---------- */
let DATA = null;
let WORLD = null;          // world-110m.json, loaded on first Globe visit

/* Company one-liners (used where Yahoo's summary is missing). */
const AIRLINE_NAMES = {
  DAL: 'Delta Air Lines', AAL: 'American Airlines', UAL: 'United Airlines',
  LUV: 'Southwest Airlines', ALK: 'Alaska Air Group', JBLU: 'JetBlue Airways',
  ULCC: 'Frontier Group', ALGT: 'Allegiant Travel',
};

/* ---------- small helpers ---------- */
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
const el = (tag, attrs = {}, html = '') => {
  const n = document.createElement(tag);
  for (const k in attrs) {
    if (k === 'class') n.className = attrs[k];
    else n.setAttribute(k, attrs[k]);
  }
  if (html) n.innerHTML = html;
  return n;
};
const isNum = (x) => typeof x === 'number' && Number.isFinite(x);
const fmt = (x, d = 2) => !isNum(x) ? '—' : Number(x).toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
const fmtInt = (x) => !isNum(x) ? '—' : Math.round(x).toLocaleString('en-US');
const money = (x) => !isNum(x) ? '—' : '$' + fmt(x, 2);
const pct = (x, d = 1) => !isNum(x) ? '—' : fmt(x, d) + '%';
const signed = (x, d = 1) => !isNum(x) ? '—' : (x > 0 ? '+' : x < 0 ? '−' : '') + fmt(Math.abs(x), d);
const bigMoney = (x) => {
  if (!isNum(x)) return '—';
  const a = Math.abs(x);
  if (a >= 1e12) return '$' + fmt(x / 1e12, 2) + 'T';
  if (a >= 1e9) return '$' + fmt(x / 1e9, 2) + 'B';
  if (a >= 1e6) return '$' + fmt(x / 1e6, 2) + 'M';
  return money(x);
};
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const slug = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const shortDate = (d) => { if (!d) return ''; const [y, m, dd] = d.split('-'); return `${MONTHS[+m - 1]} ${+dd}`; };
const longDate = (d) => { if (!d) return '—'; const [y, m, dd] = d.split('-'); return `${MONTHS[+m - 1]} ${+dd}, ${y}`; };
const ordinal = (n) => n + (['th', 'st', 'nd', 'rd'][(n % 100 - 20) % 10] || ['th', 'st', 'nd', 'rd'][n % 100] || 'th');
const median = (a) => { const s = a.filter(isNum).sort((x, y) => x - y); if (!s.length) return null; const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
const css = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
const ICON_ARROW = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>';
const ICON_BACK = '<svg class="flip" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>';
const ICON_DOT = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 12h8"/></svg>';

/* ---------- composite (fuel / news / operations) ----------
   Only shown when the notebook exported a live composite block.
   Directional labels are never shown from example data. */
function composite(sym) {
  const row = DATA && DATA.composite && DATA.composite[sym];
  return (row && Object.keys(row).length) ? row : null;
}
const compositeLive = () => !!(DATA && DATA.composite && Object.keys(DATA.composite).length);
/* Describe flow as tailwind / headwind so no label reads as a trade call. */
function flowLabel(sig) {
  const s = String(sig || '').toUpperCase();
  if (s.includes('LEAN') && s.includes('BULL')) return 'Slight tailwind';
  if (s.includes('LEAN') && s.includes('BEAR')) return 'Slight headwind';
  if (s.includes('BULL')) return 'Tailwind';
  if (s.includes('BEAR')) return 'Headwind';
  return 'Neutral';
}

/* ---------- per-stock statistics ---------- */
function stockStats(t) {
  const s = DATA.stocks[t] || {};
  const fa = s.forecast_avg || {};
  const rv = (s.realized_vol && s.realized_vol.values || []).filter(isNum);
  const close = (s.price && s.price.close || []).filter(isNum);
  const models = [fa.egarch, fa.timesfm_alone, fa.timesfm_together].filter(isNum);
  const avg = models.length ? models.reduce((a, b) => a + b, 0) / models.length : null;
  const share = DATA.portfolio && DATA.portfolio.sector_share_latest ? DATA.portfolio.sector_share_latest[t] : null;
  return {
    t,
    name: (s.info && s.info.shortName) || AIRLINE_NAMES[t] || t,
    short: AIRLINE_NAMES[t] || t,
    recent: rv.length ? rv[rv.length - 1] : null,
    eg: fa.egarch, tf: fa.timesfm_alone, tfT: fa.timesfm_together,
    avg,
    lo: models.length ? Math.min(...models) : null,
    hi: models.length ? Math.max(...models) : null,
    change: (isNum(avg) && rv.length) ? avg - rv[rv.length - 1] : null,
    chg1y: close.length > 1 ? (close[close.length - 1] / close[0] - 1) * 100 : null,
    share: isNum(share) ? share * 100 : null,
  };
}
let STATS = [];      // all eight, sorted by model average (highest first)
let SCALE = { lo: 0, hi: 100 };
let SECTOR_MED = null;
function computeStats() {
  STATS = DATA.tickers.map(stockStats).sort((a, b) => (b.avg ?? -1) - (a.avg ?? -1));
  STATS.forEach((s, i) => { s.rank = i + 1; });
  const vals = STATS.flatMap(s => [s.lo, s.hi, s.recent]).filter(isNum);
  SCALE = { lo: Math.floor(Math.min(...vals) / 10) * 10, hi: Math.ceil(Math.max(...vals) / 10) * 10 };
  SECTOR_MED = median(STATS.map(s => s.avg));
}
const statOf = (t) => STATS.find(s => s.t === t);
const xPct = (v) => ((v - SCALE.lo) / (SCALE.hi - SCALE.lo) * 100).toFixed(2) + '%';
/* Typical size of a one-standard-deviation move over the horizon. */
const horizonMove = (annVol) => isNum(annVol) ? annVol * Math.sqrt((DATA.horizon_days || 42) / 252) : null;

/* ---------- regimes ---------- */
const REGIMES = ['Calm', 'Stressed', 'Crisis'];
const regimeColor = (k) => css({ Calm: '--calm', Stressed: '--stress', Crisis: '--crisis' }[k] || '--ink-3');
function currentRegime() {
  const r = DATA.regimes && DATA.regimes.current;
  if (!r) return null;
  const [name, p] = Object.entries(r).sort((a, b) => b[1] - a[1])[0];
  return { name, p, all: r };
}
let REGIME_BY_DATE = null;
function regimeByDate() {
  if (REGIME_BY_DATE) return REGIME_BY_DATE;
  REGIME_BY_DATE = {};
  const r = DATA.regimes;
  if (r && r.dates) r.dates.forEach((d, i) => {
    let best = null, bp = -1;
    REGIMES.forEach(k => { const v = r[k] && r[k][i]; if (isNum(v) && v > bp) { bp = v; best = k; } });
    REGIME_BY_DATE[d] = best;
  });
  return REGIME_BY_DATE;
}
const REGIME_WORDS = {
  Calm: 'Airline stocks are moving quietly; swings tend to stay small.',
  Stressed: 'Swings across the airline sector are larger than usual, so forecasts lean higher.',
  Crisis: 'The sector is in a high-volatility shock; expect large daily moves.',
};

/* ============================================================
   TOOLTIP (shared by ladder rows, heatmap, map, glossary terms)
   ============================================================ */
const tip = {
  node: null,
  show(html, x, y) {
    const n = this.node; n.innerHTML = html; n.hidden = false;
    const r = n.getBoundingClientRect();
    let left = x + 14, top = y + 16;
    if (left + r.width > innerWidth - 8) left = x - r.width - 14;
    if (top + r.height > innerHeight - 8) top = y - r.height - 12;
    n.style.left = Math.max(8, left) + 'px'; n.style.top = Math.max(8, top) + 'px';
  },
  hide() { if (this.node) this.node.hidden = true; },
};
/* Attach a tooltip to every element matching sel inside root. */
function bindTip(root, sel, htmlFn) {
  const at = (e, t) => {
    if (e.type === 'focusin') { const r = t.getBoundingClientRect(); return [r.left + r.width / 2, r.bottom]; }
    return [e.clientX, e.clientY];
  };
  const onIn = (e) => { const t = e.target.closest(sel); if (!t || !root.contains(t)) return; const h = htmlFn(t); if (h) tip.show(h, ...at(e, t)); };
  root.addEventListener('mousemove', onIn);
  root.addEventListener('focusin', onIn);
  root.addEventListener('mouseleave', () => tip.hide());
  root.addEventListener('focusout', () => tip.hide());
  root.addEventListener('mouseover', (e) => { if (!e.target.closest(sel)) tip.hide(); });
}
const tipRows = (rows) => rows.map(([k, v]) => `<span class="t-r"><span>${k}</span><span>${v}</span></span>`).join('');

/* ============================================================
   THEME
   ============================================================ */
function setTheme(theme, rerender) {
  document.documentElement.dataset.theme = theme;
  $('#themeSwitch').setAttribute('aria-checked', theme === 'dark' ? 'true' : 'false');
  try { localStorage.setItem('sentinel-theme', theme); } catch (e) {}
  if (rerender && DATA) { const y = scrollY; router(true); scrollTo(0, y); }
}

/* ============================================================
   ROUTER
   ============================================================ */
const ROUTES = {
  overview: { fn: renderOverview, title: 'Overview' },
  stocks: { fn: renderStocks, title: 'Stocks' },
  portfolio: { fn: renderPortfolio, title: 'Portfolio' },
  globe: { fn: renderGlobe, title: 'Globe' },
  lab: { fn: renderLab, title: 'Lab' },
  glossary: { fn: renderGlossary, title: 'Glossary' },
};
let activeCharts = [];
let routeCleanup = [];
function destroyCharts() { activeCharts.forEach(c => { try { c.destroy(); } catch (e) {} }); activeCharts = []; }

function setCrumbs(parts) {
  $('#crumbs').innerHTML = parts.map((p, i) => i === parts.length - 1
    ? `<b>${esc(p[0])}</b>` : `<a href="${p[1]}">${esc(p[0])}</a>`).join('<span class="sep" aria-hidden="true">/</span>');
}

function router(keepFocus) {
  destroyCharts(); tip.hide();
  routeCleanup.forEach(f => f()); routeCleanup = [];
  const hash = location.hash.replace(/^#\/?/, '') || 'overview';
  const [tab, arg] = hash.split('/');
  const route = ROUTES[tab] || ROUTES.overview;
  const key = ROUTES[tab] ? tab : 'overview';
  const view = $('#view');
  view.innerHTML = '';
  $$('#tabs a').forEach(a => { if (a.dataset.tab === key) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); });
  closeMenu();
  setCrumbs([['Research', '#/overview'], [route.title, '#/' + key]]);
  document.title = `${route.title} — Sentinel`;
  try {
    route.fn(view, arg && decodeURIComponent(arg));
  } catch (e) {
    console.error(e);
    view.innerHTML = `<div class="errorbox"><h2>This page couldn't be drawn</h2>
      <p>Something in the data file didn't match what this page expects. Try reloading; if it keeps happening,
      re-export <code>sentinel_data.json</code> from the notebook.</p><p><a href="#/overview">Back to the overview</a></p></div>`;
  }
  if (!keepFocus) { view.focus({ preventScroll: true }); if (!(tab === 'glossary' && arg)) scrollTo(0, 0); }
}

function closeMenu() {
  $('#sideNav').classList.remove('open');
  $('#menuToggle').setAttribute('aria-expanded', 'false');
  $('#menuToggle').setAttribute('aria-label', 'Open menu');
}

/* ============================================================
   RISK LADDER — the eight carriers on one volatility scale
   ============================================================ */
function ladderTip(s) {
  return `<span class="t-h">${esc(s.short)} (${s.t})</span>${tipRows([
    ['Model average', pct(s.avg)],
    ['EGARCH', pct(s.eg)],
    ['TimesFM', pct(s.tf)],
    ['TimesFM + sector', pct(s.tfT)],
    ['Recent (20-day)', pct(s.recent)],
  ])}<span class="t-n">${ordinal(s.rank)} most volatile of ${STATS.length}. Typical move over ~2 months: ±${pct(horizonMove(s.avg), 0)}.</span>`;
}
function ladderTrack(s, showMedian = true) {
  return `<span class="ltrack" aria-hidden="true">
    ${showMedian && isNum(SECTOR_MED) ? `<i class="med" style="left:${xPct(SECTOR_MED)}"></i>` : ''}
    ${isNum(s.lo) ? `<i class="rng" style="left:${xPct(s.lo)};width:calc(${xPct(s.hi)} - ${xPct(s.lo)})"></i>` : ''}
    ${isNum(s.recent) ? `<i class="now" style="left:${xPct(s.recent)}"></i>` : ''}
    ${isNum(s.avg) ? `<i class="avg" style="left:${xPct(s.avg)}"></i>` : ''}
  </span>`;
}
function buildLadder(current) {
  const wrap = el('div');
  const ul = el('ul', { class: 'ladder' });
  STATS.forEach((s, idx) => {
    const li = el('li', { style: `--i:${idx}` });
    const label = `${s.short}: model average ${pct(s.avg)}, range ${pct(s.lo)} to ${pct(s.hi)}, recent ${pct(s.recent)}`;
    li.innerHTML = `<a class="lrow${s.t === current ? ' is-current' : ''}" href="#/stocks/${s.t}" data-t="${s.t}" aria-label="${esc(label)}"${s.t === current ? ' aria-current="true"' : ''}>
      <span class="who"><b>${s.t}</b><span>${esc(s.short)}</span></span>
      ${ladderTrack(s)}
      <span class="val">${pct(s.avg, 0)}<small>${pct(s.lo, 0)}–${pct(s.hi, 0)}</small></span></a>`;
    ul.appendChild(li);
  });
  wrap.appendChild(ul);
  const ticks = [];
  for (let v = SCALE.lo; v <= SCALE.hi; v += 10) ticks.push(`<span style="left:${xPct(v)}">${v}%</span>`);
  wrap.appendChild(el('div', { class: 'lscale', 'aria-hidden': 'true' }, `<span></span><span class="ticks">${ticks.join('')}</span><span></span>`));
  bindTip(wrap, '.lrow', (n) => ladderTip(statOf(n.dataset.t)));
  return wrap;
}
const ladderKey = () => `<p class="ladder-key">
  <span><i class="k-avg"></i> Model average</span>
  <span><i class="k-range"></i> Range across 3 models</span>
  <span><i class="k-ring"></i> Recent (20-day)</span>
  <span><i class="k-med"></i> Sector median</span></p>`;

/* ============================================================
   OVERVIEW
   ============================================================ */
function renderOverview(view) {
  const reg = currentRegime();
  const top = el('div', { class: 'ov-top' });

  const feat = el('section', { class: 'feature ov-feature', 'aria-labelledby': 'ovTitle' });
  feat.innerHTML = `
    <h1 id="ovTitle">How big, <em>not which way.</em></h1>
    <p class="lead">Sentinel forecasts how much the eight major U.S. airline stocks are likely to swing over the
    ${esc(DATA.horizon_label || 'next ~2 months')}, using ${termLink('EGARCH')}, Google's ${termLink('TimesFM')},
    a market-${termLink('regime', 'Regime')} model and ${termLink('PCA')}. It never says which way a price will go.</p>
    <div class="ov-actions">
      <a class="btn primary" href="#/stocks">Compare the eight carriers ${ICON_ARROW}</a>
      <a class="btn ghost-deep" href="#/lab">How the models work</a>
    </div>
    ${reg ? `<div class="ov-regime">
      <div class="reads"><span class="big">${esc(reg.name)}</span><span class="pr">${pct(reg.p * 100, 0)} likely</span></div>
      <p>Market regime today. ${esc(REGIME_WORDS[reg.name] || '')} The strip shows the past 12 months.</p>
      <p class="ov-date">Data as of ${esc(longDate((DATA.generated || '').split(' ')[0]))} · refreshed each time the research notebook runs</p>
      <div class="canvas-box" role="img" aria-label="${esc(regimeSummary())}"><canvas id="cOvRegime"></canvas></div>
    </div>` : ''}`;
  top.appendChild(feat);

  const lad = el('section', { class: 'card ladder-card', 'aria-labelledby': 'ladTitle' });
  lad.innerHTML = `<div class="ladder-head"><div><h2 id="ladTitle">Forecast volatility, all eight</h2>
    <p class="sub">${termLink('Annualized volatility', 'Annualized volatility')} expected over the ${esc(DATA.horizon_label || 'next ~2 months')}, highest first.</p></div></div>`;
  const ladder = buildLadder();
  if (!renderOverview.drawn) { $('.ladder', ladder).classList.add('draw'); renderOverview.drawn = true; }
  lad.appendChild(ladder);
  lad.appendChild(el('div', { style: 'margin-top:.8rem' }, ladderKey()));
  top.appendChild(lad);
  view.appendChild(top);

  // how to read it
  const read = el('section', { class: 'section', 'aria-labelledby': 'readTitle' });
  read.innerHTML = `<h2 id="readTitle">How to read Sentinel</h2>
    <p class="sub">Three ideas carry every page.</p>
    <div class="readlist">
      <div><h3>Size, not direction</h3><p>Returns are close to unpredictable. Volatility is not: calm and wild
        periods bunch together. Every number here is about how far a stock may move, never which way.</p></div>
      <div><h3>Sector versus company</h3><p>Airlines move together. ${termLink('PCA')} splits each stock's risk
        into the part the whole sector shares and the part that belongs to one company.</p></div>
      <div><h3>Models disagree, on purpose</h3><p>We show three forecasts side by side. When they agree, the range
        is narrow; when they don't, treat the outlook as uncertain.</p></div>
    </div>`;
  view.appendChild(read);

  // models
  const models = el('section', { class: 'section', 'aria-labelledby': 'modTitle' });
  models.innerHTML = `<h2 id="modTitle">The four models behind the numbers</h2>
    <p class="sub">All four run in one notebook; its output is the data file this site reads.</p>
    <table class="modeltable"><thead><tr><th scope="col">Model</th><th scope="col">What it does</th><th scope="col">Where you see it</th></tr></thead><tbody>
      <tr><td><b>EGARCH</b><span>Econometric</span></td><td>Forecasts volatility from recent swings, with bad news raising risk more than good news.</td><td><a href="#/stocks">Stocks</a></td></tr>
      <tr><td><b>TimesFM</b><span>Foundation model</span></td><td>Google's pre-trained time-series model, run ${termLink('zero-shot', 'Zero-shot')} on each stock, alone and with the sector.</td><td><a href="#/stocks">Stocks</a></td></tr>
      <tr><td><b>HMM</b><span>Regime detection</span></td><td>Sorts the market into Calm, Stressed or Crisis and gives today's probability of each.</td><td><a href="#/portfolio">Portfolio</a>, sidebar</td></tr>
      <tr><td><b>PCA</b><span>Risk decomposition</span></td><td>Separates sector-wide risk from company-specific risk.</td><td><a href="#/portfolio">Portfolio</a></td></tr>
    </tbody></table>`;
  view.appendChild(models);

  // data sources
  const data = el('section', { class: 'section', 'aria-labelledby': 'dataTitle' });
  data.innerHTML = `<h2 id="dataTitle">Where the data comes from</h2>
    <p class="sub">Market data is live in every export. Fuel, news and operations ${compositeLive()
      ? 'are included in this export.' : 'are collected by the pipeline but <b>not in this export yet</b>, so the site hides them.'}</p>
    <table class="srctable"><thead><tr><th scope="col">Signal</th><th scope="col">Source</th><th scope="col">How we collect it</th><th scope="col">Status</th></tr></thead><tbody>
      ${[
        ['Prices &amp; returns', 'yfinance', 'Daily prices for all 8 tickers back to 2018, including the COVID shock.', true],
        ['Volatility regime', 'HMM', 'A 3-state hidden Markov model over the sector\'s daily returns.', true],
        ['Fuel pressure', 'WTI crude (CL=F)', 'Crude momentum and range, scaled by each airline\'s own fuel beta.', compositeLive()],
        ['News sentiment', 'Yahoo / Google News', 'Headlines scored with a finance-tuned VADER lexicon, recency-weighted.', compositeLive()],
        ['Operations', 'FlightAware', 'Delay and cancellation rates, with regional subsidiaries folded into the parent.', compositeLive()],
      ].map(([a, b, c, live]) => `<tr><td data-label="Signal"><b>${a}</b></td><td class="src" data-label="Source">${b}</td><td data-label="Method">${c}</td>
        <td data-label="Status">${live ? '<span class="tag live">Live</span>' : '<span class="tag soon">Not live yet</span>'}</td></tr>`).join('')}
    </tbody></table>`;
  view.appendChild(data);

  drawRegimeChart('cOvRegime', { compact: true });
}

function regimeSummary() {
  const reg = currentRegime(); if (!reg) return '';
  return `Market regime over the past year; today ${reg.name} at ${pct(reg.p * 100, 0)} probability.`;
}

/* ============================================================
   STOCKS — sortable comparison table
   ============================================================ */
function renderStocks(view, arg) {
  if (arg && DATA.stocks[arg]) return renderStockDetail(view, arg);

  view.appendChild(el('header', { class: 'pagehead' }, `
    <h1>Eight carriers, one scale.</h1>
    <p>Every airline's two-month volatility forecast side by side. Sort any column; open a carrier for its full
    risk read and charts.</p>`));

  const live = compositeLive();
  const cols = [
    { k: 't', label: 'Carrier', num: false },
    { k: 'avg', label: 'Forecast', title: 'Average of the three model forecasts' },
    { k: 'range', label: 'Model range', sortKey: 'spread', title: 'Lowest to highest of the three forecasts' },
    { k: 'recent', label: 'Recent', title: '20-day realized volatility' },
    { k: 'change', label: 'Change', title: 'Forecast minus recent' },
    { k: 'share', label: 'Sector share', title: 'Share of risk explained by the shared airline factor (PCA)' },
    { k: 'chg1y', label: '1-yr price' },
  ];
  if (live) cols.push({ k: 'flow', label: 'Alt-data flow', num: false });

  const state = { key: 'avg', dir: -1 };
  const wrap = el('div', { class: 'tablewrap' });
  const tbl = el('table', { class: 'cmp' });
  tbl.innerHTML = `<caption class="sr-only" style="position:absolute;left:-9999px">Volatility forecasts for the eight airlines, sortable</caption>`;
  const thead = el('thead');
  const tbody = el('tbody');
  tbl.appendChild(thead); tbl.appendChild(tbody); wrap.appendChild(tbl);
  view.appendChild(wrap);

  const rows = STATS.map(s => ({ ...s, spread: isNum(s.hi) ? s.hi - s.lo : null, flow: live && composite(s.t) ? flowLabel(composite(s.t).signal) : '' }));
  function drawHead() {
    thead.innerHTML = '<tr>' + cols.map(c => {
      const sk = c.sortKey || c.k;
      const on = state.key === sk;
      const aria = on ? ` aria-sort="${state.dir < 0 ? 'descending' : 'ascending'}"` : '';
      return `<th scope="col"${aria}${c.title ? ` title="${esc(c.title)}"` : ''}><button type="button" data-k="${sk}">${c.label}<span class="arrow" aria-hidden="true">${on ? (state.dir < 0 ? '↓' : '↑') : ''}</span></button></th>`;
    }).join('') + '</tr>';
  }
  function drawBody() {
    const sorted = rows.slice().sort((a, b) => {
      const x = a[state.key], y = b[state.key];
      if (typeof x === 'string' || typeof y === 'string') return String(x).localeCompare(String(y)) * state.dir;
      return ((x ?? -Infinity) - (y ?? -Infinity)) * state.dir;
    });
    tbody.innerHTML = sorted.map(s => `<tr data-t="${s.t}">
      <td class="co"><a href="#/stocks/${s.t}">${s.t}</a><span>${esc(s.short)}</span></td>
      <td class="lead-num">${pct(s.avg)}</td>
      <td class="mini">${ladderTrack(s, false)}<span class="delta">${pct(s.lo, 0)}–${pct(s.hi, 0)}</span></td>
      <td>${pct(s.recent)}</td>
      <td>${signed(s.change)}<span class="delta"> pts</span></td>
      <td>${pct(s.share, 0)}</td>
      <td>${isNum(s.chg1y) ? signed(s.chg1y) + '%' : '—'}</td>
      ${live ? `<td>${esc(s.flow)}</td>` : ''}</tr>`).join('');
  }
  thead.addEventListener('click', (e) => {
    const b = e.target.closest('button[data-k]'); if (!b) return;
    const k = b.dataset.k;
    if (state.key === k) state.dir *= -1; else { state.key = k; state.dir = k === 't' ? 1 : -1; }
    drawHead(); drawBody();
    const nb = thead.querySelector(`button[data-k="${k}"]`); if (nb) nb.focus();
  });
  tbody.addEventListener('click', (e) => { if (e.target.closest('a')) return; const tr = e.target.closest('tr[data-t]'); if (tr) location.hash = '#/stocks/' + tr.dataset.t; });
  bindTip(tbody, 'tr[data-t] td.mini', (n) => ladderTip(statOf(n.parentElement.dataset.t)));
  drawHead(); drawBody();

  view.appendChild(el('p', { class: 'note', style: 'margin-top:1rem' },
    `Forecasts are ${termLink('annualized volatility', 'Annualized volatility')} averaged over the next ~2 months, the mean of EGARCH, TimesFM and TimesFM with the sector. Hover a model range for each model's number. “Change” compares the forecast with the last 20 trading days.` +
    (live ? ' Alt-data flow describes fuel, news and operations context, not a price call.' : ' Fuel, news and operations signals will appear here once the notebook exports live data.')));
}

/* ---------- stock detail ---------- */
function renderStockDetail(view, sym) {
  const s = DATA.stocks[sym];
  const st = statOf(sym);
  const info = s.info || {};
  const name = info.longName || info.shortName || AIRLINE_NAMES[sym] || sym;
  const price = info.currentPrice ?? info.regularMarketPrice;
  const reg = currentRegime();
  setCrumbs([['Research', '#/overview'], ['Stocks', '#/stocks'], [sym, '#/stocks/' + sym]]);
  document.title = `${sym} — Sentinel`;

  // prev / next in forecast order
  const order = STATS.map(x => x.t);
  const i = order.indexOf(sym);
  const prev = order[(i - 1 + order.length) % order.length], next = order[(i + 1) % order.length];
  view.appendChild(el('nav', { class: 'stocknav', 'aria-label': 'Other carriers' }, `
    <a href="#/stocks">All carriers</a>
    <a href="#/stocks/${prev}" rel="prev">${ICON_BACK} ${prev}</a><a href="#/stocks/${next}" rel="next">${next} ${ICON_ARROW}</a>
    <span class="hint">Use <kbd>←</kbd> <kbd>→</kbd> to step through carriers</span>`));
  const onKey = (e) => {
    if (e.target.closest('input, select, textarea') || e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.key === 'ArrowLeft') location.hash = '#/stocks/' + prev;
    if (e.key === 'ArrowRight') location.hash = '#/stocks/' + next;
  };
  document.addEventListener('keydown', onKey);
  routeCleanup.push(() => document.removeEventListener('keydown', onKey));

  view.appendChild(el('header', { class: 'stockhead' }, `
    <div class="id"><span class="tk">${sym}</span><h1>${esc(name)}</h1></div>
    <div class="px"><div class="big">${money(price)}</div>
      <p class="sub">${isNum(st.chg1y) ? `${signed(st.chg1y)}% over 12 months` : ''}${isNum(info.bid) ? ` · bid ${fmt(info.bid)} / ask ${fmt(info.ask)}` : ''}</p></div>`));

  // risk read
  const nar = buildNarrative(sym);
  const move = horizonMove(st.avg);
  const dirWord = !isNum(st.change) ? '' : st.change > 1 ? 'up from' : st.change < -1 ? 'down from' : 'close to';
  const rr = el('section', { class: 'feature riskread', 'aria-labelledby': 'rrTitle' });
  rr.innerHTML = `
    <div class="figure">
      <p class="lbl">Forecast volatility, ${esc(DATA.horizon_label || 'next ~2 months')}</p>
      <div class="num">${pct(st.avg, 0)}<small>annualized</small></div>
      <p class="rng">Models range ${pct(st.lo, 0)} to ${pct(st.hi, 0)}</p>
      <ul class="facts">
        <li>${ICON_DOT}<span>${dirWord ? `${dirWord[0].toUpperCase() + dirWord.slice(1)} <b>${pct(st.recent)}</b> over the last 20 trading days` : ''}</span></li>
        <li>${ICON_DOT}<span>A typical move over the period is about <b>±${pct(move, 0)}</b> of the share price</span></li>
        <li>${ICON_DOT}<span><b>${ordinal(st.rank)}</b> most volatile of the ${STATS.length} carriers</span></li>
        ${reg ? `<li>${ICON_DOT}<span>Market regime: <span class="regime-pill"><i style="background:${regimeColor(reg.name)}"></i>${esc(reg.name)} ${pct(reg.p * 100, 0)}</span></span></li>` : ''}
      </ul>
    </div>
    <div class="words">
      <h2 id="rrTitle">${esc(nar.title)}</h2>
      ${nar.paras.map(p => `<p>${p}</p>`).join('')}
      <p class="asof">Written automatically from model output · data as of ${esc(longDate((DATA.generated || '').split(' ')[0]))} · not financial advice</p>
    </div>`;
  view.appendChild(rr);

  // volatility chart (realized + 3 forecasts + range band)
  const vc = el('section', { class: 'card chartcard', 'aria-labelledby': 'vcTitle' });
  vc.innerHTML = `<div class="cc-head"><div><h3 id="vcTitle">Volatility: recent and forecast</h3>
      <p>Realized volatility over the last 6 months, then each model's path for the next ~2 months. Move across the chart to read any day.</p></div></div>
    <div class="readout" id="roVol"></div>
    <div class="canvas-box" role="img" aria-label="${esc(`${sym} realized volatility ${pct(st.recent)}; forecasts EGARCH ${pct(st.eg)}, TimesFM ${pct(st.tf)}, TimesFM with sector ${pct(st.tfT)}.`)}"><canvas id="cVolF"></canvas></div>
    <div class="keyrow">
      <span><i class="sw" style="border-color:var(--s-real)"></i> Realized (20-day)</span>
      <span><i class="sw dash" style="border-color:var(--s-eg)"></i> EGARCH ${pct(st.eg)}</span>
      <span><i class="sw dash" style="border-color:var(--s-tf)"></i> TimesFM ${pct(st.tf)}</span>
      <span><i class="sw dot" style="border-color:var(--s-tf2)"></i> TimesFM + sector ${pct(st.tfT)}</span>
      <span><i class="sw box" style="background:var(--s-band)"></i> Model range</span>
    </div>`;
  view.appendChild(vc);

  // price chart with regime shading + big moves
  const moves = bigMoves(s.price, 6);
  const pc = el('section', { class: 'card chartcard', 'aria-labelledby': 'pcTitle' });
  pc.innerHTML = `<div class="cc-head"><div><h3 id="pcTitle">Price, last 12 months</h3>
      <p>Closing price with 50- and 200-day ${termLink('moving averages', 'Moving average')}. Shading shows the market regime each day; marked points are the largest one-day moves.</p></div></div>
    <div class="readout" id="roPrice"></div>
    <div class="canvas-box" role="img" aria-label="${esc(`${sym} closing price over 12 months, now ${money(price)}. Largest one-day moves: ${moves.map(m => `${signed(m.r)}% on ${longDate(m.date)}`).join('; ')}.`)}"><canvas id="cPrice"></canvas></div>
    <div class="canvas-box short" style="margin-top:.3rem" role="img" aria-label="Daily trading volume"><canvas id="cVolume"></canvas></div>
    <div class="keyrow">
      <span><i class="sw" style="border-color:var(--s-tf)"></i> Close</span>
      <span><i class="sw" style="border-color:var(--s-ma50)"></i> 50-day average</span>
      <span><i class="sw dash" style="border-color:var(--s-ma200)"></i> 200-day average</span>
      <span><i class="sw pt" style="border-color:var(--ink)"></i> Large one-day move</span>
      ${REGIMES.map(k => `<span><i class="sw box" style="background:${regimeColor(k)};opacity:.35"></i> ${k}</span>`).join('')}
    </div>
    <p class="note" style="margin:.7rem 0 0">Sentinel doesn't link news stories to these moves yet; the dates are a starting point for your own reading.</p>`;
  view.appendChild(pc);

  // where it sits among the eight
  const among = el('section', { class: 'card chartcard', 'aria-labelledby': 'amTitle' });
  among.innerHTML = `<div class="cc-head"><div><h3 id="amTitle">Where ${sym} sits among the eight</h3>
    <p>Same scale as the overview; ${sym} is outlined.</p></div>${ladderKey()}</div>`;
  among.appendChild(buildLadder(sym));
  view.appendChild(among);

  // alternative data: live only
  const c = composite(sym);
  if (c) {
    const alt = el('section', { class: 'card chartcard', 'aria-labelledby': 'altTitle' });
    alt.innerHTML = `<div class="cc-head"><div><h3 id="altTitle">Fuel, news and operations</h3>
      <p>Context from alternative data, compared across the eight airlines. It describes conditions, not a price call.</p></div><span class="tag live">Live</span></div>
      <div class="altgrid">
        <div><div class="k">Fuel</div><div class="v">${zWord(c.fuel_z, 'tailwind', 'headwind')}</div><div class="d">${termLink('Fuel beta', 'Fuel beta')} ${fmt(c.fuel_beta)}; ${fmt(c.fuel_z)} ${termLink('z', 'z-score')} vs peers</div></div>
        <div><div class="k">News</div><div class="v">${zWord(c.news_z, 'positive', 'negative')}</div><div class="d">${fmtInt(c.news_n)} headlines, ${pct((c.news_neg_share || 0) * 100, 0)} negative</div></div>
        <div><div class="k">Operations</div><div class="v">${zWord(c.operations_z, 'cleaner than peers', 'more disrupted')}</div><div class="d">Delay rank ${fmtInt(c.delay_rank)} of 8</div></div>
      </div>`;
    view.appendChild(alt);
  } else {
    view.appendChild(el('section', { class: 'notlive chartcard' }, `<h3>Fuel, news and operations <span class="tag soon">Not live yet</span></h3>
      <p>These signals are collected by the pipeline but weren't in this data export, so Sentinel hides them rather than
      show old example values. They'll appear here after the notebook exports a live composite file.</p>`));
  }

  // valuation facts (collapsed: context, not the product's answer)
  const peg = info.pegRatio ?? info.trailingPegRatio;
  const facts = el('details', { class: 'facts-panel' });
  facts.innerHTML = `<summary>Company and valuation facts <span>Market cap, P/E, beta, 52-week range</span></summary>
    ${info.longBusinessSummary ? `<p class="factnote">${esc(info.longBusinessSummary.split('. ').slice(0, 2).join('. ') + '.')}</p>` : ''}
    <dl class="factgrid">${[
      ['Market cap', bigMoney(info.marketCap)],
      [termLink('P/E', 'P/E ratio') + ' (trailing)', fmt(info.trailingPE)],
      [termLink('P/E', 'Forward P/E') + ' (forward)', fmt(info.forwardPE)],
      [termLink('PEG ratio', 'PEG ratio'), isNum(peg) ? fmt(peg) : 'N/A'],
      [termLink('Beta', 'Beta'), fmt(info.beta)],
      ['52-week high', money(info.fiftyTwoWeekHigh)],
      ['52-week low', money(info.fiftyTwoWeekLow)],
      ['Average volume', fmtInt(info.averageVolume)],
    ].map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join('')}</dl>
    <p class="factnote note">From Yahoo Finance at export time. PEG uses analysts' growth estimates, which swing widely for airlines; read it with care.</p>`;
  view.appendChild(facts);

  drawStockCharts(sym, moves);
  $('#roVol').innerHTML = volReadoutDefault(st);
  if (s.price) $('#roPrice').innerHTML = priceReadoutDefault(s.price, info);
}
const zWord = (z, pos, neg) => !isNum(z) ? '—' : Math.abs(z) < 0.15 ? 'Neutral' : (z > 0 ? pos : neg).replace(/^./, m => m.toUpperCase());

/* ---- narrative generator (one template, numbers swapped) ---- */
function buildNarrative(sym) {
  const st = statOf(sym);
  const reg = currentRegime();
  const eg = st.eg, tf = st.tf, tfT = st.tfT, recent = st.recent;
  const dir = (isNum(eg) && isNum(recent))
    ? (eg > recent * 1.08 ? 'higher than' : eg < recent * 0.92 ? 'lower than' : 'in line with')
    : 'compared with';
  const spread = isNum(st.hi) ? st.hi - st.lo : null;
  const agree = spread == null ? '' : spread < 3 ? 'The models broadly agree, so the outlook is fairly settled.'
    : spread < 8 ? 'The models differ moderately.' : 'The models disagree sharply, so treat the range as wide.';
  const vsMed = isNum(SECTOR_MED) && isNum(st.avg) ? (st.avg > SECTOR_MED * 1.05 ? 'above' : st.avg < SECTOR_MED * 0.95 ? 'below' : 'close to') : null;

  const paras = [
    `Over the ${esc(DATA.horizon_label || 'next ~2 months')}, ${termLink('EGARCH')} expects annualized volatility of about <b>${pct(eg)}</b>,
    ${dir} the recent level of <b>${pct(recent)}</b>. ${termLink('TimesFM')} puts it near <b>${pct(tf)}</b> on its own and
    <b>${pct(tfT)}</b> when it also sees the sector. ${agree}`,
  ];
  let p2 = '';
  if (vsMed) p2 += `That leaves ${esc(st.short)} ${vsMed} the sector median of ${pct(SECTOR_MED)}.`;
  if (isNum(st.share)) p2 += ` About ${pct(st.share, 0)} of its recent risk comes from the airline sector moving together; the rest is specific to the company.`;
  if (reg) p2 += ` The market-wide regime model reads <b>${esc(reg.name)}</b> (${pct(reg.p * 100, 0)} probability), the backdrop for every airline.`;
  if (p2) paras.push(p2.trim());
  const c = composite(sym);
  if (c) {
    const parts = [];
    if (isNum(c.fuel_z)) parts.push(`fuel is ${c.fuel_z >= 0 ? 'a tailwind' : 'a headwind'}`);
    if (isNum(c.news_z)) parts.push(`news flow is ${c.news_z >= 0.15 ? 'positive' : c.news_z <= -0.15 ? 'negative' : 'neutral'}`);
    if (isNum(c.operations_z)) parts.push(`operations are ${c.operations_z >= 0 ? 'cleaner than peers' : 'more disrupted than peers'}`);
    if (parts.length) paras.push(`On the alternative data, ${parts.join(', ')}. This is context, not a forecast of direction.`);
  }
  const title = spread != null && spread >= 8 ? `Models disagree on ${st.short}` : `What the models say about ${st.short}`;
  return { title, paras };
}

/* ---- largest one-day moves in the price series ---- */
function bigMoves(P, n) {
  if (!P || !P.close) return [];
  const out = [];
  for (let i = 1; i < P.close.length; i++) {
    const a = P.close[i - 1], b = P.close[i];
    if (isNum(a) && isNum(b) && a > 0) out.push({ i, date: P.dates[i], r: (b / a - 1) * 100 });
  }
  return out.sort((x, y) => Math.abs(y.r) - Math.abs(x.r)).slice(0, n).sort((x, y) => x.i - y.i);
}

/* ============================================================
   CHARTS
   ============================================================ */
function chartTheme() {
  Chart.defaults.font.family = "'Public Sans', -apple-system, sans-serif";
  Chart.defaults.font.size = 12;
  Chart.defaults.color = css('--ink-3');
  Chart.defaults.borderColor = css('--line');
  // Draw charts in their final state immediately (no entrance animation): a chart must never
  // depend on animation frames to appear. Mutate the existing defaults rather than replacing them.
  Chart.defaults.animation.duration = 0;
}
function tooltipStyle(extra = {}) {
  return {
    enabled: true, mode: 'index', intersect: false,
    backgroundColor: css('--ink'), titleColor: css('--bg'), bodyColor: css('--bg'), footerColor: css('--bg'),
    padding: 10, cornerRadius: 6, boxPadding: 4, usePointStyle: true,
    titleFont: { weight: '600' }, footerFont: { weight: '400', size: 11 },
    filter: (item) => !item.dataset.tipHide && item.raw != null,
    ...extra,
  };
}
function dateAxis(labels, extra = {}) {
  return {
    grid: { display: false }, border: { color: css('--line') },
    ticks: { maxTicksLimit: 7, maxRotation: 0, autoSkipPadding: 18, callback(v) { return shortDate(labels[v]); } },
    ...extra,
  };
}
const valueAxis = (cb, extra = {}) => ({ grid: { color: css('--line') }, border: { display: false }, ticks: { callback: cb, maxTicksLimit: 6 }, ...extra });

/* Background bands for the dominant market regime on each date. */
const regimeBandsPlugin = {
  id: 'regimeBands',
  beforeDatasetsDraw(chart, args, opts) {
    if (!opts || !opts.labels) return;
    const { ctx, chartArea: a, scales: { x } } = chart;
    const map = regimeByDate();
    const lab = opts.labels;
    ctx.save();
    let start = 0;
    for (let i = 1; i <= lab.length; i++) {
      if (i === lab.length || map[lab[i]] !== map[lab[start]]) {
        const k = map[lab[start]];
        if (k) {
          const x0 = start === 0 ? a.left : (x.getPixelForValue(start - 1) + x.getPixelForValue(start)) / 2;
          const x1 = i === lab.length ? a.right : (x.getPixelForValue(i - 1) + x.getPixelForValue(i)) / 2;
          ctx.globalAlpha = opts.alpha || 0.12;
          ctx.fillStyle = regimeColor(k);
          ctx.fillRect(x0, a.top, x1 - x0, a.bottom - a.top);
        }
        start = i;
      }
    }
    ctx.restore();
  },
};
/* Vertical "today" divider between history and forecast. */
const todayLinePlugin = {
  id: 'todayLine',
  afterDatasetsDraw(chart, args, opts) {
    if (!opts || opts.index == null) return;
    const { ctx, chartArea: a, scales: { x } } = chart;
    const px = x.getPixelForValue(opts.index);
    ctx.save();
    ctx.strokeStyle = css('--ink-3'); ctx.setLineDash([3, 3]); ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(px, a.top); ctx.lineTo(px, a.bottom); ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = css('--ink-2'); ctx.font = "600 11px 'Public Sans', sans-serif";
    ctx.textAlign = 'left'; ctx.fillText('Forecast →', px + 6, a.top + 12);
    ctx.textAlign = 'right'; ctx.fillText('← History', px - 6, a.top + 12);
    ctx.restore();
  },
};
/* Text labels beside big-move points. */
const moveLabelsPlugin = {
  id: 'moveLabels',
  afterDatasetsDraw(chart) {
    const { ctx } = chart;
    chart.data.datasets.forEach((ds, di) => {
      if (!ds.moveLabels) return;
      const meta = chart.getDatasetMeta(di);
      if (meta.hidden) return;
      ctx.save();
      ctx.font = "600 11px 'Public Sans', sans-serif"; ctx.textAlign = 'center';
      meta.data.forEach((pt, i) => {
        const lab = ds.moveLabels[i]; if (!lab) return;
        const up = lab.r >= 0;
        const y = pt.y + (up ? -12 : 18);
        ctx.lineWidth = 3; ctx.strokeStyle = css('--card'); ctx.strokeText(lab.text, pt.x, y);
        ctx.fillStyle = css('--ink'); ctx.fillText(lab.text, pt.x, y);
      });
      ctx.restore();
    });
  },
};
/* Onset markers on the regime chart. */
const regimeOnsetPlugin = {
  id: 'regimeOnsets',
  afterDatasetsDraw(chart, args, opts) {
    if (!opts || !opts.onsets) return;
    const { ctx, chartArea: a, scales: { x } } = chart;
    ctx.save();
    let lastLabel = -Infinity;
    opts.onsets.forEach(o => {
      const px = x.getPixelForValue(o.i);
      ctx.strokeStyle = opts.ink || css('--ink'); ctx.globalAlpha = .55; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(px, a.top); ctx.lineTo(px, a.bottom); ctx.stroke();
      if (!opts.compact && px - lastLabel > 70) {
        lastLabel = px;
        ctx.globalAlpha = 1; ctx.font = "600 11px 'Public Sans', sans-serif"; ctx.textAlign = 'left';
        const tx = Math.min(px + 4, a.right - 56);
        ctx.lineWidth = 3; ctx.strokeStyle = css('--card'); ctx.strokeText(o.k, tx, a.top + 12);
        ctx.fillStyle = opts.ink || css('--ink'); ctx.fillText(o.k, tx, a.top + 12);
      }
    });
    ctx.restore();
  },
};
/* Trading-style crosshair: a vertical line snapped to the hovered day, a dashed horizontal
   line at the cursor with its value tagged on the axis, and an onMove callback that drives
   the live readout above the chart. `linked` charts (volume) mirror the vertical line. */
const crosshairPlugin = {
  id: 'crosshair',
  // Config lives on chart.$crossCfg, not in options: Chart.js would call functions placed in options.
  afterEvent(chart, args) {
    const opts = chart.$crossCfg;
    if (!opts) return;
    const e = args.event, a = chart.chartArea, n = chart.data.labels.length;
    const outside = e.type === 'mouseout' || e.x < a.left || e.x > a.right || e.y < a.top || e.y > a.bottom;
    if (outside) {
      if (chart.$cross) { chart.$cross = null; (opts.linked || []).forEach(l => { l.$cross = null; l.draw(); }); if (opts.onMove) opts.onMove(null); chart.draw(); }
      return;
    }
    const idx = Math.max(0, Math.min(n - 1, Math.round(chart.scales.x.getValueForPixel(e.x))));
    chart.$cross = { idx, y: e.y };
    (opts.linked || []).forEach(l => { l.$cross = { idx, y: null }; l.draw(); });
    if (opts.onMove) opts.onMove(idx);
    // draw now rather than flagging a re-render, which would wait on an animation frame
    chart.draw();
  },
  afterDatasetsDraw(chart) {
    const opts = chart.$crossCfg, c = chart.$cross;
    if (!opts || !c) return;
    const { ctx, chartArea: a, scales: { x, y } } = chart;
    const px = x.getPixelForValue(c.idx);
    ctx.save();
    ctx.strokeStyle = css('--ink-2'); ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(px, a.top); ctx.lineTo(px, a.bottom); ctx.stroke();
    // marker dots on the tracked series at the hovered day
    (opts.dots || []).forEach(di => {
      const meta = chart.getDatasetMeta(di); const pt = meta && meta.data[c.idx];
      if (!pt || chart.data.datasets[di].data[c.idx] == null) return;
      ctx.beginPath(); ctx.arc(pt.x, pt.y, 4.5, 0, Math.PI * 2);
      ctx.fillStyle = css('--card'); ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = chart.data.datasets[di].borderColor; ctx.stroke();
    });
    if (c.y != null && opts.fmt) {
      ctx.setLineDash([4, 4]); ctx.strokeStyle = css('--ink-3');
      ctx.beginPath(); ctx.moveTo(a.left, c.y); ctx.lineTo(a.right, c.y); ctx.stroke(); ctx.setLineDash([]);
      const label = opts.fmt(y.getValueForPixel(c.y));
      ctx.font = "600 11px 'Public Sans', sans-serif";
      const w = ctx.measureText(label).width + 12, h = 20;
      const lx = a.right - w, ly = Math.max(a.top, Math.min(a.bottom - h, c.y - h / 2));
      ctx.fillStyle = css('--ink'); ctx.beginPath(); ctx.roundRect(lx, ly, w, h, 4); ctx.fill();
      ctx.fillStyle = css('--bg'); ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(label, lx + w / 2, ly + h / 2 + .5);
    }
    ctx.restore();
  },
};
Chart.register(regimeBandsPlugin, todayLinePlugin, moveLabelsPlugin, regimeOnsetPlugin, crosshairPlugin);

function drawStockCharts(sym, moves) {
  chartTheme();
  const s = DATA.stocks[sym];
  const P = s.price;
  const st = statOf(sym);

  // --- volatility: realized + forecasts + model band
  const cv = $('#cVolF');
  if (cv && s.realized_vol) {
    const n = 126;
    const rd = s.realized_vol.dates.slice(-n), rvv = s.realized_vol.values.slice(-n);
    const fd = DATA.forecast_dates || [];
    const labels = rd.concat(fd);
    const pad = new Array(rd.length).fill(null);
    const last = rd.length - 1;
    const fut = (arr) => { const a = pad.slice(); a[last] = rvv[last]; return a.concat(arr || []); };
    const paths = [s.egarch_path, s.timesfm_alone_path, s.timesfm_together_path].map(p => p || []);
    const hiP = fd.map((_, i) => Math.max(...paths.map(p => p[i]).filter(isNum)));
    const loP = fd.map((_, i) => Math.min(...paths.map(p => p[i]).filter(isNum)));
    const volF = new Chart(cv, {
      type: 'line',
      data: {
        labels,
        datasets: [
          { label: 'Range high', data: fut(hiP), borderWidth: 0, pointRadius: 0, fill: '+1', backgroundColor: css('--s-band'), tipHide: true },
          { label: 'Range low', data: fut(loP), borderWidth: 0, pointRadius: 0, fill: false, tipHide: true },
          { label: 'Realized', data: rvv.concat(new Array(fd.length).fill(null)), borderColor: css('--s-real'), borderWidth: 1.8, pointRadius: 0, pointHoverRadius: 4, tension: .2 },
          { label: 'EGARCH', data: fut(s.egarch_path), borderColor: css('--s-eg'), borderDash: [6, 4], borderWidth: 2, pointRadius: 0, pointHoverRadius: 4, tension: .2 },
          { label: 'TimesFM', data: fut(s.timesfm_alone_path), borderColor: css('--s-tf'), borderDash: [6, 4], borderWidth: 2, pointRadius: 0, pointHoverRadius: 4, tension: .2 },
          { label: 'TimesFM + sector', data: fut(s.timesfm_together_path), borderColor: css('--s-tf2'), borderDash: [2, 3], borderWidth: 2.2, pointRadius: 0, pointHoverRadius: 4, tension: .2 },
        ],
      },
      options: {
        responsive: true, maintainAspectRatio: false, interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: { display: false },
          todayLine: { index: last },
          tooltip: { enabled: false },
        },
        scales: { x: dateAxis(labels), y: valueAxis(v => v + '%', { title: { display: true, text: 'Annualized volatility' } }) },
      },
    });
    activeCharts.push(volF);
    volF.$crossCfg = {
            dots: [2, 3, 4, 5], fmt: (v) => pct(v),
            onMove: (idx) => {
              const ro = $('#roVol'); if (!ro) return;
              if (idx == null) { ro.innerHTML = volReadoutDefault(st); return; }
              const d = labels[idx];
              if (idx <= last) {
                ro.innerHTML = `<b>${longDate(d)}${idx === last ? ' · today' : ''}</b>
                  <span>Realized <b>${pct(rvv[idx])}</b></span>
                  <span class="muted">20-day, annualized · typical 2-month move ±${pct(horizonMove(rvv[idx]), 0)}</span>`;
              } else {
                const i = idx - rd.length;
                ro.innerHTML = `<b>${longDate(d)} · forecast</b>
                  <span><i class="sw dash" style="border-color:var(--s-eg)"></i>EGARCH <b>${pct(paths[0][i])}</b></span>
                  <span><i class="sw dash" style="border-color:var(--s-tf)"></i>TimesFM <b>${pct(paths[1][i])}</b></span>
                  <span><i class="sw dot" style="border-color:var(--s-tf2)"></i>+ sector <b>${pct(paths[2][i])}</b></span>
                  <span class="muted">range ${pct(loP[i])}–${pct(hiP[i])} · day ${i + 1} of ${fd.length}</span>`;
              }
            },
    };
  }

  // --- price with regime bands and big moves
  const cp = $('#cPrice');
  if (cp && P) {
    const moveIdx = Object.fromEntries(moves.map(m => [m.i, m]));
    const movePts = P.close.map((v, i) => moveIdx[i] ? v : null);
    const moveLabels = P.close.map((_, i) => moveIdx[i] ? { text: signed(moveIdx[i].r) + '%', r: moveIdx[i].r } : null);
    const volChart = new Chart($('#cVolume'), {
      type: 'bar',
      data: { labels: P.dates, datasets: [{ label: 'Volume', data: P.volume, backgroundColor: P.close.map((_, i) => moveIdx[i] ? css('--ink-3') : css('--s-vol')), borderWidth: 0, barPercentage: 1, categoryPercentage: .9 }] },
      options: {
        responsive: true, maintainAspectRatio: false, events: [],
        plugins: { legend: { display: false }, tooltip: { enabled: false } },
        scales: { x: { display: false }, y: valueAxis(v => (v / 1e6).toFixed(0) + 'M', { ticks: { maxTicksLimit: 3, callback: v => (v / 1e6).toFixed(0) + 'M' } }) },
      },
    });
    activeCharts.push(volChart);
    volChart.$crossCfg = {};
    const info = s.info || {};
    const priceChart = new Chart(cp, {
      type: 'line',
      data: {
        labels: P.dates,
        datasets: [
          { label: 'Close', data: P.close, borderColor: css('--s-tf'), borderWidth: 2, pointRadius: 0, pointHoverRadius: 4, tension: .15 },
          { label: '50-day average', data: P.ma50, borderColor: css('--s-ma50'), borderWidth: 1.5, pointRadius: 0, pointHoverRadius: 3, tension: .15 },
          { label: '200-day average', data: P.ma200, borderColor: css('--s-ma200'), borderDash: [5, 4], borderWidth: 1.5, pointRadius: 0, pointHoverRadius: 3, tension: .15 },
          { label: 'Large move', data: movePts, moveLabels, showLine: false, pointRadius: 5, pointHoverRadius: 7, pointBorderWidth: 2, pointBackgroundColor: css('--card'), pointBorderColor: css('--ink'), tipHide: true },
        ],
      },
      options: {
        responsive: true, maintainAspectRatio: false, interaction: { mode: 'index', intersect: false },
        layout: { padding: { top: 14 } },
        plugins: {
          legend: { display: false },
          regimeBands: { labels: P.dates, alpha: 0.13 },
          tooltip: { enabled: false },
        },
        scales: { x: dateAxis(P.dates), y: valueAxis(v => '$' + v) },
      },
    });
    activeCharts.push(priceChart);
    priceChart.$crossCfg = {
            dots: [0, 1, 2], linked: [volChart], fmt: (v) => money(v),
            onMove: (i) => {
              const ro = $('#roPrice'); if (!ro) return;
              if (i == null) { ro.innerHTML = priceReadoutDefault(P, info); return; }
              const prev = i > 0 ? P.close[i - 1] : null;
              const chg = isNum(prev) && isNum(P.close[i]) ? (P.close[i] / prev - 1) * 100 : null;
              const k = regimeByDate()[P.dates[i]];
              ro.innerHTML = `<b>${longDate(P.dates[i])}</b>
                <span>Close <b>${money(P.close[i])}</b></span>
                ${isNum(chg) ? `<span class="${chg >= 0 ? 'pos' : 'neg'}">${signed(chg)}% on the day${moveIdx[i] ? ' · one of the year’s largest moves' : ''}</span>` : ''}
                <span><i class="sw" style="border-color:var(--s-ma50)"></i>50-day ${money(P.ma50 && P.ma50[i])}</span>
                <span><i class="sw dash" style="border-color:var(--s-ma200)"></i>200-day ${money(P.ma200 && P.ma200[i])}</span>
                <span>Volume ${isNum(P.volume && P.volume[i]) ? fmt(P.volume[i] / 1e6, 1) + 'M' : '—'}</span>
                ${k ? `<span><i class="dot" style="background:${regimeColor(k)}"></i>${k}</span>` : ''}`;
            },
    };
  }
}

/* Readout text when the cursor is off the chart: the latest values. Bid / ask exist only
   for the moment the data was exported, so they are shown here and labelled as such. */
function priceReadoutDefault(P, info) {
  const n = P.close.length - 1;
  return `<b>Latest · ${longDate(P.dates[n])}</b>
    <span>Close <b>${money(P.close[n])}</b></span>
    ${isNum(info.bid) ? `<span>Bid <b>${money(info.bid)}</b> · Ask <b>${money(info.ask)}</b></span><span class="muted">bid/ask as of the data export</span>` : ''}
    <span class="muted">Move across the chart for any day</span>`;
}
function volReadoutDefault(st) {
  return `<b>Forecast, next ~2 months</b>
    <span>EGARCH <b>${pct(st.eg)}</b></span><span>TimesFM <b>${pct(st.tf)}</b></span><span>+ sector <b>${pct(st.tfT)}</b></span>
    <span class="muted">Recent ${pct(st.recent)} · move across the chart for any day</span>`;
}

/* Stacked regime probabilities for the past year with onset markers. */
function drawRegimeChart(id, { compact = false } = {}) {
  const r = DATA.regimes; const cv = $('#' + id);
  if (!r || !cv) return;
  chartTheme();
  const labels = r.dates;
  const map = regimeByDate();
  const onsets = [];
  let runStart = 0;
  for (let i = 1; i <= labels.length; i++) {
    if (i === labels.length || map[labels[i]] !== map[labels[runStart]]) {
      if (runStart > 0 && i - runStart >= 5) onsets.push({ i: runStart, k: map[labels[runStart]] });
      runStart = i;
    }
  }
  const ds = (k, i) => ({ label: k, data: r[k].map(v => isNum(v) ? v * 100 : null), borderColor: regimeColor(k), backgroundColor: regimeColor(k) + (compact ? '4d' : '33'), fill: i === 0 ? 'origin' : '-1', borderWidth: compact ? 1.2 : 1.5, pointRadius: 0, pointHoverRadius: 0, stack: 'r', tension: .25 });
  activeCharts.push(new Chart(cv, {
    type: 'line',
    data: { labels, datasets: REGIMES.map(ds) },
    options: {
      responsive: true, maintainAspectRatio: false, interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { display: false },
        regimeOnsets: compact ? false : { onsets: onsets.slice(-10), compact, ink: css('--ink') },
        tooltip: tooltipStyle({
          callbacks: {
            title: (it) => longDate(labels[it[0].dataIndex]),
            label: (c) => ` ${c.dataset.label}: ${pct(c.raw, 0)}`,
            footer: (it) => { const o = onsets.find(o => o.i === it[0].dataIndex); return o ? `Shift into ${o.k} begins` : ''; },
          },
        }),
      },
      scales: compact
        ? { x: { display: false, stacked: true }, y: { display: false, stacked: true, min: 0, max: 100 } }
        : { x: { ...dateAxis(labels), stacked: true }, y: valueAxis(v => v + '%', { stacked: true, min: 0, max: 100 }) },
    },
  }));
}

/* ============================================================
   PORTFOLIO
   ============================================================ */
function renderPortfolio(view) {
  const pf = DATA.portfolio;
  const tickers = DATA.tickers;
  const reg = currentRegime();

  view.appendChild(el('header', { class: 'pagehead' }, `
    <h1>How the eight move together.</h1>
    <p>The market regime, how much of each airline's risk is shared with the sector, and what that means for a
    portfolio holding all eight.</p>`));

  if (reg) {
    const sec = el('section', { class: 'card', 'aria-labelledby': 'regTitle' });
    sec.innerHTML = `<div class="cc-head" style="display:flex;justify-content:space-between;gap:1rem;flex-wrap:wrap;margin-bottom:.6rem">
      <div><h3 id="regTitle" style="margin:0 0 .15rem;font-size:1.1rem">Market ${termLink('regime', 'Regime')}, past 12 months</h3>
      <p class="sub" style="margin:0">Daily probability of each state from the ${termLink('HMM')}. Lines mark when the most likely state changed.</p></div></div>
      <div class="chips">${REGIMES.map(k => `<span class="chip"><i class="dot" style="background:${regimeColor(k)}"></i>${k} <b>${pct((reg.all[k] || 0) * 100, 0)}</b> today</span>`).join('')}</div>
      <div class="canvas-box" style="height:220px" role="img" aria-label="${esc(regimeSummary())}"><canvas id="cRegime"></canvas></div>`;
    view.appendChild(sec);
  }

  // model portfolio
  const sec2 = el('section', { class: 'section', 'aria-labelledby': 'pfTitle' });
  sec2.innerHTML = `<h2 id="pfTitle">A portfolio of all eight</h2>
    <p class="sub">Estimated volatility of a portfolio holding every carrier, using each stock's forecast and the
    last ${pf.returns_dates ? pf.returns_dates.length : 120} days of correlations.</p>`;
  const seg = el('div', { class: 'seg', role: 'group', 'aria-label': 'Weighting' });
  seg.innerHTML = `<button type="button" data-w="equal" aria-pressed="true">Equal weights</button><button type="button" data-w="inv" aria-pressed="false">Less weight on volatile stocks</button>`;
  sec2.appendChild(seg);
  const grid = el('div', { class: 'twocol', style: 'margin-top:1rem' });
  const wcard = el('div', { class: 'card' });
  wcard.innerHTML = `<div class="pfstat" id="pfStat"></div><div id="wtable"></div>
    <p class="note" style="margin:.8rem 0 0">“Sector share” is the part of each stock's risk explained by the shared airline factor (${termLink('PCA')}). An estimate for study, not a recommendation.</p>`;
  const pcard = el('div', { class: 'card' });
  const pc1 = (pf.pca_explained && pf.pca_explained[0]) || 0;
  pcard.innerHTML = `<h3>How concentrated the risk is</h3>
    <p class="sub">Share of all eight stocks' movement explained by each ${termLink('principal component', 'PCA')}.</p>
    <div class="canvas-box" style="height:230px" role="img" aria-label="PC1 explains ${pct(pc1 * 100, 0)} of variance"><canvas id="cPca"></canvas></div>
    <p class="note" style="margin:.7rem 0 0">The first component, the shared “airline factor”, explains <b>${pct(pc1 * 100, 0)}</b>. The carriers largely move as one, so spreading money across them only goes so far.</p>`;
  grid.appendChild(wcard); grid.appendChild(pcard);
  sec2.appendChild(grid);
  view.appendChild(sec2);

  // correlation heatmap
  const sec3 = el('section', { class: 'section', 'aria-labelledby': 'hmTitle' });
  sec3.innerHTML = `<h2 id="hmTitle">Which carriers move together</h2>
    <p class="sub">${termLink('Correlation', 'Correlation')} of daily returns over the last ${pf.returns_dates ? pf.returns_dates.length : 120} days. Stronger colour means they move more closely together. Hover a cell for the pair.</p>`;
  const hcard = el('div', { class: 'card' });
  hcard.innerHTML = `<div class="heatwrap" id="heatmap"></div><div class="heat-legend" id="heatLegend"></div>`;
  sec3.appendChild(hcard);
  view.appendChild(sec3);

  // manual entry (not built yet)
  const sec4 = el('section', { class: 'section', 'aria-labelledby': 'meTitle' });
  sec4.innerHTML = `<h2 id="meTitle">Your own holdings <span class="tag soon" style="vertical-align:middle">Not built yet</span></h2>
    <p class="sub">Analysis of custom portfolios is in development. The form below shows what it will ask for; nothing you type is saved or analysed.</p>`;
  const form = el('div', { class: 'entryform notlive' });
  form.innerHTML = `
    <div><label for="peTicker">Ticker</label><select id="peTicker" disabled>${tickers.map(t => `<option value="${t}">${t}</option>`).join('')}</select></div>
    <div><label for="peAmt">Shares or dollar amount</label><input id="peAmt" type="number" placeholder="e.g. 100" disabled /></div>
    <div><button class="btn" type="button" disabled>Add holding</button></div>`;
  sec4.appendChild(form);
  view.appendChild(sec4);

  // weights + portfolio volatility
  const vol = Object.fromEntries(STATS.map(s => [s.t, s.avg]));
  function weights(kind) {
    const w = {};
    if (kind === 'inv') { const inv = tickers.map(t => 1 / (vol[t] || 1)); const sum = inv.reduce((a, b) => a + b, 0); tickers.forEach((t, i) => w[t] = inv[i] / sum); }
    else tickers.forEach(t => w[t] = 1 / tickers.length);
    return w;
  }
  function portVol(w) {
    let v = 0;
    tickers.forEach((a, i) => tickers.forEach((b, j) => {
      const rho = (pf.correlation[a] || [])[j]; if (!isNum(rho)) return;
      v += w[a] * w[b] * rho * (vol[a] || 0) * (vol[b] || 0);
    }));
    return Math.sqrt(Math.max(v, 0));
  }
  function drawWeights(kind) {
    const w = weights(kind);
    const pv = portVol(w);
    const avgSingle = tickers.reduce((a, t) => a + w[t] * (vol[t] || 0), 0);
    $('#pfStat').innerHTML = `<div><span class="n">${pct(pv)}</span><span class="l">Estimated portfolio volatility</span></div>
      <div><span class="n">${pct(avgSingle)}</span><span class="l">Weighted average of single stocks</span></div>
      <div><span class="n">${pct((1 - pv / avgSingle) * 100, 0)}</span><span class="l">Risk removed by combining</span></div>`;
    const maxW = Math.max(...tickers.map(t => w[t]));
    const rows = STATS.map(s => `<tr><td><b>${s.t}</b></td><td><span class="bar" style="width:${(w[s.t] / maxW * 56).toFixed(0)}px"></span>${pct(w[s.t] * 100, 1)}</td><td>${pct(s.avg)}</td><td>${pct(s.share, 0)}</td></tr>`).join('');
    $('#wtable').innerHTML = `<table class="wtable"><thead><tr><th scope="col">Stock</th><th scope="col">Weight</th><th scope="col">Forecast</th><th scope="col">Sector share</th></tr></thead><tbody>${rows}</tbody></table>`;
  }
  seg.addEventListener('click', (e) => {
    const b = e.target.closest('button[data-w]'); if (!b) return;
    $$('button', seg).forEach(x => x.setAttribute('aria-pressed', x === b ? 'true' : 'false'));
    drawWeights(b.dataset.w);
  });
  drawWeights('equal');

  drawRegimeChart('cRegime'); drawPcaChart(); drawHeatmap();
}

function drawPcaChart() {
  const pf = DATA.portfolio; const cv = $('#cPca'); if (!cv || !pf.pca_explained) return;
  chartTheme();
  const labels = pf.pca_explained.map((_, i) => i === 0 ? 'PC1 · sector' : 'PC' + (i + 1));
  activeCharts.push(new Chart(cv, {
    type: 'bar',
    data: { labels, datasets: [{ data: pf.pca_explained.map(v => v * 100), backgroundColor: pf.pca_explained.map((_, i) => i === 0 ? css('--s-tf') : css('--s-vol')), borderRadius: 4, borderWidth: 0 }] },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false }, tooltip: tooltipStyle({ mode: 'nearest', intersect: true, callbacks: { label: c => ` ${c.parsed.y.toFixed(1)}% of all movement` } }) },
      scales: { x: { grid: { display: false }, border: { color: css('--line') } }, y: valueAxis(v => v + '%') },
    },
  }));
}

function drawHeatmap() {
  const pf = DATA.portfolio; const t = DATA.tickers; const box = $('#heatmap'); if (!box) return;
  const vals = [];
  t.forEach((a, i) => t.forEach((b, j) => { const v = (pf.correlation[a] || [])[j]; if (i < j && isNum(v)) vals.push({ a, b, v }); }));
  const lo = Math.floor(Math.min(...vals.map(x => x.v)) * 20) / 20, hi = Math.ceil(Math.max(...vals.map(x => x.v)) * 20) / 20;
  const ranked = vals.slice().sort((x, y) => y.v - x.v);
  const c0 = hexRgb(css('--ramp-0')), c1 = hexRgb(css('--ramp-1'));
  const colorOf = (v) => { const f = Math.max(0, Math.min(1, (v - lo) / (hi - lo || 1))); return mix(c0, c1, f); };
  const inkOn = (v) => { const f = (v - lo) / (hi - lo || 1); const dark = document.documentElement.dataset.theme === 'dark'; return (dark ? f < .55 : f > .5) ? '#f4f5f2' : '#17262b'; };
  const words = (v) => v >= .85 ? 'move together very closely' : v >= .7 ? 'move together closely' : v >= .5 ? 'move together moderately' : 'move together loosely';
  let html = `<table class="heat"><caption style="position:absolute;left:-9999px">Return correlation matrix</caption><thead><tr><td></td>${t.map(x => `<th scope="col">${x}</th>`).join('')}</tr></thead><tbody>`;
  t.forEach((a, i) => {
    html += `<tr><th scope="row">${a}</th>`;
    t.forEach((b, j) => {
      const v = (pf.correlation[a] || [])[j];
      if (i === j) html += `<td class="diag" data-i="${i}" data-j="${j}">1.00</td>`;
      else html += `<td tabindex="0" data-i="${i}" data-j="${j}" data-v="${v}" style="background:${colorOf(v)};color:${inkOn(v)}" aria-label="${a} and ${b}: ${fmt(v)}">${fmt(v)}</td>`;
    });
    html += '</tr>';
  });
  html += '</tbody></table>';
  box.innerHTML = html;
  $('#heatLegend').innerHTML = `<span>${fmt(lo)}</span><span class="heat-bar"></span><span>${fmt(hi)}</span><span>· scale fitted to this matrix; the diagonal is each stock with itself</span>`;

  const table = $('.heat', box);
  const highlight = (td) => {
    $$('.hl', table).forEach(n => n.classList.remove('hl'));
    if (!td || td.classList.contains('diag')) { table.classList.remove('hovering'); return; }
    table.classList.add('hovering');
    const i = +td.dataset.i, j = +td.dataset.j;
    td.classList.add('hl');
    const sym = $(`td[data-i="${j}"][data-j="${i}"]`, table); if (sym) sym.classList.add('hl');
    $$('thead th', table)[j].classList.add('hl'); $$('tbody th', table)[i].classList.add('hl');
  };
  table.addEventListener('mouseover', (e) => highlight(e.target.closest('td[data-v]')));
  table.addEventListener('focusin', (e) => highlight(e.target.closest('td[data-v]')));
  table.addEventListener('mouseleave', () => highlight(null));
  table.addEventListener('focusout', () => highlight(null));
  bindTip(table, 'td[data-v]', (td) => {
    const a = t[+td.dataset.i], b = t[+td.dataset.j], v = +td.dataset.v;
    const rank = ranked.findIndex(x => (x.a === a && x.b === b) || (x.a === b && x.b === a)) + 1;
    return `<span class="t-h">${a} &amp; ${b}: ${fmt(v)}</span>These two ${words(v)}.<span class="t-n">${ordinal(rank)} most correlated of ${ranked.length} pairs.</span>`;
  });
}
function hexRgb(h) { h = h.replace('#', ''); if (h.length === 3) h = h.split('').map(c => c + c).join(''); const n = parseInt(h, 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; }
function mix(a, b, f) { const c = a.map((x, k) => Math.round(x + (b[k] - x) * f)); return `rgb(${c[0]},${c[1]},${c[2]})`; }

/* ============================================================
   GLOBE — carriers' hubs on a world map
   ============================================================ */
/* Hub locations: DAL and AAL from the company descriptions in the data file;
   the others from public network information. Approximate, not model output. */
const HUBS = {
  ATL: ['Atlanta', 33.64, -84.43], DTW: ['Detroit', 42.21, -83.35], MSP: ['Minneapolis–St. Paul', 44.88, -93.22],
  SLC: ['Salt Lake City', 40.79, -111.98], BOS: ['Boston', 42.36, -71.01], LAX: ['Los Angeles', 33.94, -118.41],
  LGA: ['New York–LaGuardia', 40.78, -73.87], JFK: ['New York–JFK', 40.64, -73.78], SEA: ['Seattle', 47.45, -122.31],
  AMS: ['Amsterdam', 52.31, 4.77], BOG: ['Bogotá', 4.70, -74.15], LIM: ['Lima', -12.02, -77.11], MEX: ['Mexico City', 19.44, -99.07],
  LHR: ['London–Heathrow', 51.47, -0.45], CDG: ['Paris–CDG', 49.01, 2.55], SCL: ['Santiago', -33.39, -70.79],
  GRU: ['São Paulo', -23.43, -46.47], ICN: ['Seoul–Incheon', 37.46, 126.44], HND: ['Tokyo', 35.55, 139.78],
  CLT: ['Charlotte', 35.21, -80.94], ORD: ['Chicago–O’Hare', 41.98, -87.90], DFW: ['Dallas/Fort Worth', 32.90, -97.04],
  MIA: ['Miami', 25.79, -80.29], PHL: ['Philadelphia', 39.87, -75.24], PHX: ['Phoenix', 33.43, -112.01],
  DCA: ['Washington–National', 38.85, -77.04], DOH: ['Doha', 25.27, 51.61], MAD: ['Madrid', 40.49, -3.57], SYD: ['Sydney', -33.94, 151.18],
  DEN: ['Denver', 39.86, -104.67], IAH: ['Houston–Intercontinental', 29.99, -95.34], EWR: ['Newark', 40.69, -74.17],
  SFO: ['San Francisco', 37.62, -122.38], IAD: ['Washington–Dulles', 38.95, -77.46], MDW: ['Chicago–Midway', 41.79, -87.75],
  LAS: ['Las Vegas', 36.08, -115.15], BWI: ['Baltimore', 39.18, -76.67], DLF: ['Dallas Love Field', 32.85, -96.85],
  HOU: ['Houston–Hobby', 29.65, -95.28], OAK: ['Oakland', 37.72, -122.22], PDX: ['Portland', 45.59, -122.60],
  ANC: ['Anchorage', 61.17, -150.00], HNL: ['Honolulu', 21.32, -157.92], FLL: ['Fort Lauderdale', 26.07, -80.15],
  MCO: ['Orlando', 28.43, -81.31], SJU: ['San Juan', 18.44, -66.00], SFB: ['Orlando–Sanford', 28.78, -81.24],
  PIE: ['St. Pete–Clearwater', 27.91, -82.69], AZA: ['Phoenix–Mesa', 33.31, -111.66],
};
const CARRIER_HUBS = {
  DAL: { hubs: ['ATL', 'DTW', 'MSP', 'SLC', 'BOS', 'LAX', 'LGA', 'JFK', 'SEA'], intl: ['AMS', 'LHR', 'CDG', 'MEX', 'BOG', 'LIM', 'SCL', 'GRU', 'ICN', 'HND'], kind: 'Hubs' },
  AAL: { hubs: ['DFW', 'CLT', 'ORD', 'LAX', 'MIA', 'JFK', 'PHL', 'PHX', 'DCA'], intl: ['LHR', 'MAD', 'DOH', 'SYD', 'HND'], kind: 'Hubs' },
  UAL: { hubs: ['ORD', 'DEN', 'IAH', 'EWR', 'SFO', 'IAD', 'LAX'], intl: [], kind: 'Hubs' },
  LUV: { hubs: ['DLF', 'MDW', 'DEN', 'LAS', 'BWI', 'PHX', 'HOU', 'OAK'], intl: [], kind: 'Largest stations' },
  ALK: { hubs: ['SEA', 'PDX', 'ANC', 'SFO', 'LAX', 'HNL'], intl: [], kind: 'Hubs' },
  JBLU: { hubs: ['JFK', 'BOS', 'FLL', 'MCO', 'SJU'], intl: [], kind: 'Focus cities' },
  ULCC: { hubs: ['DEN', 'MCO', 'LAS'], intl: [], kind: 'Bases' },
  ALGT: { hubs: ['LAS', 'SFB', 'PIE', 'AZA'], intl: [], kind: 'Bases' },
};
const MAP_W = 1000;
const mapS = MAP_W / (2 * Math.PI);
/* Miller cylindrical projection. */
const proj = (lon, lat) => {
  const phi = lat * Math.PI / 180;
  return [MAP_W / 2 + mapS * lon * Math.PI / 180, MAP_W / 4 - mapS * 1.25 * Math.log(Math.tan(Math.PI / 4 + 0.4 * phi))];
};
const MAP_VIEWS = {
  world: { lon: [-168, 158], lat: [-47, 71], label: 'World' },
  na: { lon: [-161, -60], lat: [15, 63], label: 'North America' },
};
function viewBoxOf(v) {
  const [x0, y0] = proj(v.lon[0], v.lat[1]); const [x1, y1] = proj(v.lon[1], v.lat[0]);
  return [x0, y0, x1 - x0, y1 - y0];
}
function ringToPath(ring) {
  let d = '', prev = null;
  ring.forEach(([lon, lat], i) => {
    if (prev != null) { while (lon - prev > 180) lon -= 360; while (lon - prev < -180) lon += 360; }
    prev = lon;
    const [x, y] = proj(lon, Math.max(-85, Math.min(85, lat)));
    d += (i ? 'L' : 'M') + x.toFixed(1) + ',' + y.toFixed(1);
  });
  return d;
}
let MAP_PATHS = null;
function mapPaths() {
  if (MAP_PATHS || !WORLD || !window.topojson) return MAP_PATHS;
  const land = topojson.feature(WORLD, WORLD.objects.land);
  const geoms = land.features ? land.features.map(f => f.geometry) : [land.geometry];
  let landD = '';
  geoms.forEach(g => {
    const polys = g.type === 'Polygon' ? [g.coordinates] : g.coordinates;
    polys.forEach(poly => poly.forEach(ring => { if (Math.max(...ring.map(p => p[1])) < -58) return; landD += ringToPath(ring) + 'Z'; }));
  });
  const mesh = topojson.mesh(WORLD, WORLD.objects.countries, (a, b) => a !== b);
  let borderD = '';
  (mesh.type === 'MultiLineString' ? mesh.coordinates : [mesh.coordinates]).forEach(line => { borderD += ringToPath(line); });
  let gratD = '';
  for (let lat = -30; lat <= 60; lat += 30) gratD += ringToPath([[-180, lat], [180, lat]]);
  for (let lon = -150; lon <= 180; lon += 30) gratD += ringToPath(Array.from({ length: 31 }, (_, i) => [lon, -60 + i * 5]));
  MAP_PATHS = { landD, borderD, gratD };
  return MAP_PATHS;
}
/* Volatility -> colour along teal (lower) -> brass -> brick (higher). */
function volColor(v) {
  if (!isNum(v)) return css('--ink-3');
  const f = Math.max(0, Math.min(1, (v - SCALE.lo) / (SCALE.hi - SCALE.lo)));
  const a = hexRgb(css('--s-tf')), b = hexRgb(css('--brass')), c = hexRgb(css('--crisis'));
  return f < .5 ? mix(a, b, f * 2) : mix(b, c, (f - .5) * 2);
}

function renderGlobe(view) {
  view.appendChild(el('header', { class: 'pagehead' }, `
    <h1>Where each airline's risk lands.</h1>
    <p>Every carrier's hubs on one map, coloured by its two-month volatility forecast. Pick a carrier to see its
    network and risk read; hover a city for everyone based there.</p>`));

  const state = { sel: null, view: 'world' };
  const wrap = el('div', { class: 'globe' });
  const list = el('ul', { class: 'carrierlist card', 'aria-label': 'Carriers' });
  list.innerHTML = `<li><button type="button" data-t="" aria-pressed="true"><b>All</b><span class="nm">Every carrier</span><span class="v"></span></button></li>` +
    STATS.map(s => `<li><button type="button" data-t="${s.t}" aria-pressed="false"><b>${s.t}</b><span class="nm">${esc(s.short)}</span>
      <span class="v"><i class="dot" style="background:${volColor(s.avg)}"></i>${pct(s.avg, 0)}</span></button></li>`).join('');
  const mapcol = el('div');
  const card = el('section', { class: 'card mapcard', 'aria-labelledby': 'mapTitle' });
  card.innerHTML = `<div class="maptools"><h3 id="mapTitle">Hubs and forecast volatility</h3>
      <div class="seg" role="group" aria-label="Map view">${Object.entries(MAP_VIEWS).map(([k, v]) => `<button type="button" data-v="${k}" aria-pressed="${k === 'world'}">${v.label}</button>`).join('')}</div></div>
    <div class="mapbox" id="mapbox"><p class="loading">Loading map…</p></div>
    <div class="maplegend">
      <span class="ramp">Lower <i style="background:linear-gradient(90deg, ${volColor(SCALE.lo)}, ${volColor((SCALE.lo + SCALE.hi) / 2)}, ${volColor(SCALE.hi)})"></i> Higher forecast volatility</span>
      <span>Larger dot: hub shared by several carriers</span>
      <span class="note">Hub locations from company descriptions and public network data; not model output.</span>
    </div>`;
  mapcol.appendChild(card);
  const detail = el('section', { class: 'card detailcard', 'aria-live': 'polite' });
  mapcol.appendChild(detail);
  wrap.appendChild(list); wrap.appendChild(mapcol);
  view.appendChild(wrap);

  // which carriers use each hub
  const hubCarriers = {};
  Object.entries(CARRIER_HUBS).forEach(([t, c]) => c.hubs.concat(c.intl).forEach(h => (hubCarriers[h] = hubCarriers[h] || []).push(t)));

  function drawDetail() {
    if (!state.sel) {
      const reg = currentRegime();
      detail.innerHTML = `<h3>All eight carriers</h3>
        <p class="sub" style="margin:0">${Object.keys(hubCarriers).length} hub cities shown. The sector median forecast is <b>${pct(SECTOR_MED)}</b>${reg ? `, with the market in a <b>${esc(reg.name)}</b> regime (${pct(reg.p * 100, 0)})` : ''}. Select a carrier for its network.</p>`;
      return;
    }
    const s = statOf(state.sel), ch = CARRIER_HUBS[state.sel], c = composite(state.sel);
    detail.innerHTML = `<div style="display:flex;justify-content:space-between;gap:1rem;flex-wrap:wrap;align-items:baseline">
        <h3 style="margin:0">${esc(s.short)} (${s.t})</h3><a class="inline-arrow" href="#/stocks/${s.t}">Full risk read ${ICON_ARROW}</a></div>
      <div class="detail-ladder"><span class="lrow is-current"><span class="who"><b>${s.t}</b><span>${esc(s.short)}</span></span>${ladderTrack(s)}<span class="val">${pct(s.avg, 0)}<small>${pct(s.lo, 0)}–${pct(s.hi, 0)}</small></span></span></div>
      <div class="row">
        <div><span class="n">${signed(s.change)}</span><span class="l">Points vs recent ${pct(s.recent, 0)}</span></div>
        <div><span class="n">${ordinal(s.rank)}</span><span class="l">Most volatile of ${STATS.length}</span></div>
        <div><span class="n">${pct(s.share, 0)}</span><span class="l">Risk shared with sector</span></div>
        <div><span class="n">${ch.hubs.length + ch.intl.length}</span><span class="l">${ch.kind.toLowerCase()}${ch.intl.length ? ' and gateways' : ''}</span></div>
      </div>
      ${c ? `<p style="margin:.9rem 0 0">Alternative data: fuel ${zWord(c.fuel_z, 'tailwind', 'headwind').toLowerCase()}, news ${zWord(c.news_z, 'positive', 'negative').toLowerCase()}, operations ${zWord(c.operations_z, 'cleaner than peers', 'more disrupted').toLowerCase()}.</p>`
        : `<p class="note" style="margin:.9rem 0 0">Fuel, news and operations signals will show here once the notebook exports live data.</p>`}`;
  }

  function drawMap() {
    const box = $('#mapbox', card);
    const P = mapPaths();
    if (!P) return;
    const vb = viewBoxOf(MAP_VIEWS[state.view]);
    const r = vb[2] / 210;
    const sel = state.sel;
    const shown = Object.keys(hubCarriers);
    let arcs = '';
    if (sel) {
      const ch = CARRIER_HUBS[sel];
      const all = ch.hubs.concat(ch.intl);
      const [ox, oy] = proj(HUBS[all[0]][2], HUBS[all[0]][1]);
      all.slice(1).forEach(h => {
        const [x, y] = proj(HUBS[h][2], HUBS[h][1]);
        const mx = (ox + x) / 2, my = (oy + y) / 2, dx = x - ox, dy = y - oy;
        const len = Math.hypot(dx, dy) || 1, k = Math.min(len * .22, vb[2] * .08);
        arcs += `<path class="map-arc" d="M${ox.toFixed(1)},${oy.toFixed(1)} Q${(mx - dy / len * k).toFixed(1)},${(my + dx / len * k).toFixed(1)} ${x.toFixed(1)},${y.toFixed(1)}" stroke="${volColor(statOf(sel).avg)}" stroke-width="${(r * .35).toFixed(2)}"/>`;
      });
    }
    // label hubs greedily, busiest first; a label goes right or left of its dot and must clear
    // every placed label and every visible hub marker
    const labeled = new Map();
    if (sel || state.view === 'na') {
      const boxes = [];
      const visible = shown.filter(h => !sel || hubCarriers[h].includes(sel));
      const pts = Object.fromEntries(visible.map(h => [h, proj(HUBS[h][2], HUBS[h][1])]));
      const hit = (a, b) => a[0] < b[2] && a[2] > b[0] && a[1] < b[3] && a[3] > b[1];
      visible.slice().sort((a, b) => hubCarriers[b].length - hubCarriers[a].length).forEach(h => {
        const [x, y] = pts[h];
        const w = r * 2.3 * .62 * h.length + r, ht = r * 2.6, gap = r * 2;
        for (const side of ['right', 'left']) {
          const box = side === 'right' ? [x + gap, y - ht / 2, x + gap + w, y + ht / 2] : [x - gap - w, y - ht / 2, x - gap, y + ht / 2];
          if (box[0] < vb[0] || box[2] > vb[0] + vb[2]) continue;
          const clear = boxes.every(b => !hit(box, b)) &&
            visible.every(o => o === h || !hit(box, [pts[o][0] - r * 1.6, pts[o][1] - r * 1.6, pts[o][0] + r * 1.6, pts[o][1] + r * 1.6]));
          if (clear) { boxes.push(box); labeled.set(h, side); break; }
        }
      });
    }
    const hubs = shown.map(h => {
      const [name, lat, lon] = HUBS[h];
      const [x, y] = proj(lon, lat);
      const carriers = hubCarriers[h];
      const on = !sel || carriers.includes(sel);
      const v = sel ? statOf(sel).avg : median(carriers.map(t => statOf(t).avg));
      const rr = r * (1 + Math.min(carriers.length - 1, 3) * .28);
      const label = `${name} (${h}): ${carriers.join(', ')}`;
      const showText = on && labeled.has(h);
      return `<g class="hub${on ? '' : ' dim'}" data-h="${h}" tabindex="${on ? 0 : -1}" role="img" aria-label="${esc(label)}">
        <circle class="ring" cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${rr.toFixed(2)}" stroke="${volColor(v)}" stroke-width="${(r * .45).toFixed(2)}"/>
        <circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${(rr * .45).toFixed(2)}" fill="${volColor(v)}"/>
        ${showText ? (() => { const left = labeled.get(h) === 'left'; return `<text x="${(left ? x - r * 2 : x + r * 2).toFixed(1)}" y="${(y + r * .8).toFixed(1)}" text-anchor="${left ? 'end' : 'start'}" style="font-size:${(r * 2.3).toFixed(1)}px;stroke-width:${(r * .7).toFixed(1)}px">${h}</text>`; })() : ''}</g>`;
    }).join('');
    box.innerHTML = `<svg viewBox="${vb.map(n => n.toFixed(1)).join(' ')}" role="group" aria-label="World map of airline hubs">
      <path class="map-grat" d="${P.gratD}" style="stroke-width:${(r * .12).toFixed(2)}"/>
      <path class="map-land" d="${P.landD}"/>
      <path class="map-border" d="${P.borderD}" style="stroke-width:${(r * .18).toFixed(2)}"/>
      ${arcs}${hubs}</svg>`;
  }
  bindTip(card, '.hub', (g) => {
    const h = g.dataset.h, [name] = HUBS[h];
    const carriers = hubCarriers[h].map(statOf).sort((a, b) => b.avg - a.avg);
    return `<span class="t-h">${esc(name)} · ${h}</span>${carriers.map(s => `<span class="t-lad"><b>${s.t}</b>${ladderTrack(s, false)}<span>${pct(s.avg, 0)}</span></span>`).join('')}<span class="t-n">Forecast volatility, next ~2 months: tick = model average, bar = range, ring = recent.</span>`;
  });
  card.addEventListener('click', (e) => {
    const b = e.target.closest('button[data-v]');
    if (b) { state.view = b.dataset.v; $$('button[data-v]', card).forEach(x => x.setAttribute('aria-pressed', x === b ? 'true' : 'false')); drawMap(); return; }
    const g = e.target.closest('.hub');
    if (g) { const cs = hubCarriers[g.dataset.h]; if (cs.length === 1) select(cs[0]); }
  });
  function select(t) {
    state.sel = t || null;
    $$('button', list).forEach(b => b.setAttribute('aria-pressed', (b.dataset.t || null) === state.sel ? 'true' : 'false'));
    drawMap(); drawDetail();
  }
  list.addEventListener('click', (e) => { const b = e.target.closest('button[data-t]'); if (b) select(b.dataset.t); });
  drawDetail();

  if (WORLD) drawMap();
  else fetch('world-110m.json').then(r => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
    .then(j => { WORLD = j; if ($('#mapbox')) drawMap(); })
    .catch(() => { const b = $('#mapbox'); if (b) b.innerHTML = `<div class="errorbox"><p>The map outline (<code>world-110m.json</code>) couldn't be loaded. Check that the file sits next to <code>index.html</code>.</p></div>`; });
}

/* ============================================================
   LAB
   ============================================================ */
function renderLab(view) {
  view.appendChild(el('header', { class: 'pagehead' }, `
    <h1>Forecasting methods, from regression to transformers.</h1>
    <p>The four models running in Sentinel today, then the wider set we document for study. Interactive versions
    of the study models are not built yet.</p>`));

  const prod = el('section', { 'aria-labelledby': 'prodTitle' });
  prod.innerHTML = `<h2 id="prodTitle">Running in Sentinel</h2><p class="sub">These power the Stocks, Portfolio and Globe pages.</p>`;
  const pl = el('ul', { class: 'lablist' });
  [
    ['EGARCH', 'Exponential GARCH', 'Our primary volatility forecaster. Captures volatility clustering and the leverage effect: negative returns raise future volatility more than positive ones of the same size.', '#/stocks', 'Compare carriers'],
    ['TimesFM', 'Time-series foundation model', "Google Research's pre-trained transformer, applied zero-shot to each airline's rolling-volatility series, alone and with the sector as a covariate.", '#/stocks/' + (STATS[0] ? STATS[0].t : 'DAL'), 'See it on ' + (STATS[0] ? STATS[0].t : 'a stock')],
    ['HMM', 'Hidden Markov model', "Classifies the market into Calm, Stressed or Crisis regimes from the sector's returns, with today's probability of each.", '#/portfolio', 'See the regime chart'],
    ['PCA', 'Principal component analysis', 'Splits the eight stocks’ movement into a shared sector factor and company-specific parts, on a rolling window.', '#/portfolio', 'See the risk split'],
  ].forEach(([ab, name, desc, href, cta]) => pl.appendChild(el('li', {}, `
    <div class="nm"><b>${ab}</b><span>${name}</span></div><p>${desc}</p>
    <div class="act"><span class="tag live">Live</span><a class="btn" href="${href}">${cta} ${ICON_ARROW}</a></div>`)));
  prod.appendChild(pl);
  view.appendChild(prod);

  const groups = [
    ['Classical statistical models', [
      ['LR', 'Linear regression', 'The simplest baseline: a straight-line relationship between a target and its predictors. Fast, fully interpretable, and the yardstick any fancier model must beat.'],
      ['ARIMA', 'Autoregressive integrated moving average', 'Models a series from its own past values and past errors after removing trend. The workhorse of classical forecasting.'],
    ]],
    ['Deep learning', [
      ['LSTM', 'Long short-term memory', 'A recurrent network with gated memory that learns long-range patterns, suited to volatility that depends on events weeks earlier.'],
      ['Transformer', 'Attention-based sequence model', 'Weighs every past point when forecasting the next. The architecture behind TimesFM.'],
    ]],
    ['Ensemble methods', [
      ['RF', 'Random forest', 'Averages hundreds of decision trees trained on random subsets. Robust to noise, and it ranks which features matter most.'],
      ['XGBoost', 'Gradient-boosted trees', 'Builds trees one after another, each correcting the last. A strong non-linear benchmark on tabular data.'],
    ]],
  ];
  groups.forEach(([head, models]) => {
    const sec = el('section', { class: 'section', 'aria-label': head });
    sec.innerHTML = `<h2>${head}</h2>`;
    const ul = el('ul', { class: 'lablist' });
    models.forEach(([ab, name, desc]) => ul.appendChild(el('li', {}, `
      <div class="nm"><b>${ab}</b><span>${name}</span></div><p>${desc}</p>
      <div class="act"><span class="tag soon">Study module</span><button class="btn" type="button" disabled>Interactive version not built yet</button></div>`)));
    sec.appendChild(ul);
    view.appendChild(sec);
  });
}

/* ============================================================
   GLOSSARY
   ============================================================ */
const GLOSSARY = [
  ['Models', [
    ['EGARCH', 'Exponential GARCH: a model of how volatile a stock is. It captures volatility clustering (calm and wild periods bunch together) and the leverage effect, where bad news raises future volatility more than good news of the same size.'],
    ['GARCH', 'Generalized autoregressive conditional heteroskedasticity. The family of models that forecast variance from recent variance and recent shocks. EGARCH is one variant.'],
    ['TimesFM', 'A time-series “foundation model” from Google Research, pre-trained on huge amounts of data. Used zero-shot (no retraining) to forecast each stock’s volatility series.'],
    ['HMM', 'Hidden Markov model: assumes the market is secretly in one of a few states (here Calm, Stressed, Crisis) and estimates the probability of each from observed returns.'],
    ['PCA', 'Principal component analysis: finds the few underlying patterns that explain most of how a group of stocks move. The first pattern here is the shared “airline sector” factor.'],
    ['ARIMA', 'A classical forecasting model that predicts a series from its own recent values and recent errors. A standard baseline.'],
    ['Zero-shot', 'Using a pre-trained model as-is on a new problem, without any extra training on your data.'],
  ]],
  ['Risk & volatility', [
    ['Volatility', 'How much a price swings, usually the standard deviation of returns. Higher volatility means bigger, less predictable moves, in either direction.'],
    ['Annualized volatility', 'Daily volatility scaled to a yearly figure (multiply by √252) so numbers are comparable. 40% means a typical yearly move of about ±40%; over two months that is roughly ±16%.'],
    ['Realized volatility', 'Volatility measured from what actually happened over a trailing window (here, 20 trading days).'],
    ['Regime', 'A market “mood”: calm, stressed or crisis. Volatility behaves very differently in each.'],
    ['Beta', 'A stock’s sensitivity to the overall market. A beta of 1.3 means it tends to move 1.3% when the market moves 1%.'],
    ['Sector vs. stock-specific risk', 'Part of a stock’s risk comes from its whole industry moving (sector); part is unique to the company (stock-specific).'],
    ['Correlation', 'How closely two stocks move together, from −1 (opposite) to +1 (identical). Airlines are highly correlated.'],
  ]],
  ['Trading & valuation', [
    ['Bid / Ask', 'The highest price a buyer will pay (bid) and the lowest a seller will accept (ask). The gap is the spread.'],
    ['Market cap', 'Share price × shares outstanding: the total value of a company’s equity.'],
    ['P/E ratio', 'Price-to-earnings: share price divided by earnings per share. A rough gauge of how expensive a stock is relative to profits.'],
    ['Forward P/E', 'Like P/E but using forecast future earnings instead of past earnings.'],
    ['PEG ratio', 'P/E divided by the expected earnings growth rate. Below 1 can suggest a stock is cheap relative to growth, but growth estimates for airlines swing widely.'],
    ['Moving average', 'The average price over a trailing window (50 or 200 days), used to smooth out noise and show trend.'],
    ['Volume', 'How many shares traded in a period. Spikes often accompany big news or moves.'],
    ['52-week high / low', 'The highest and lowest price over the past year.'],
  ]],
  ['Signals & data', [
    ['Sentiment', 'A score of how positive or negative text (news, posts) is. We use VADER with a finance-specific word list.'],
    ['VADER', 'A rule-based sentiment scorer for short text like headlines. We extended it so words like “grounded” or “downgrade” read as negative.'],
    ['z-score', 'How many standard deviations a value is from the group average. Used to compare the eight airlines on the same scale each day.'],
    ['Fuel beta', 'How much an airline’s stock moves with crude-oil prices. More negative means more hurt when oil rises.'],
    ['Composite signal', 'Our blend of fuel, news and operations data, shown as tailwind or headwind. It describes conditions, not a price target, and is only shown when the data export includes it.'],
    ['Idiosyncratic', 'Specific to one company rather than the whole sector.'],
  ]],
];
const GLOSS_INDEX = {};
GLOSSARY.forEach(([, terms]) => terms.forEach(([t, d]) => { GLOSS_INDEX[slug(t)] = [t, d]; }));
/* Inline link to a glossary term; hovering shows the definition. */
function termLink(label, term) {
  const key = slug(term || label);
  if (!GLOSS_INDEX[key]) return esc(label);
  return `<a class="term-link" href="#/glossary/${key}" data-def="${key}">${esc(label)}</a>`;
}

function renderGlossary(view, arg) {
  view.appendChild(el('header', { class: 'pagehead' }, `
    <h1>Plain-English definitions.</h1>
    <p>Every model, metric and term used across Sentinel, defined for a general reader. Dotted-underlined words
    elsewhere on the site link here.</p>`));
  const bar = el('div', { class: 'glossbar' });
  bar.innerHTML = `<input id="glossSearch" type="search" placeholder="Search terms" aria-label="Search glossary" />
    <nav class="glossjump" aria-label="Glossary sections">${GLOSSARY.map(([c]) => `<a href="#gl-${slug(c)}">${c}</a>`).join('')}</nav>`;
  view.appendChild(bar);
  const container = el('div', { 'aria-live': 'polite' });
  view.appendChild(container);
  $$('.glossjump a', bar).forEach(a => a.addEventListener('click', (e) => { e.preventDefault(); const t = $(a.getAttribute('href')); if (t) t.scrollIntoView({ behavior: 'smooth' }); }));

  function draw(filter) {
    container.innerHTML = '';
    const f = (filter || '').toLowerCase().trim();
    GLOSSARY.forEach(([cat, terms]) => {
      const matched = terms.filter(([t, d]) => !f || t.toLowerCase().includes(f) || d.toLowerCase().includes(f));
      if (!matched.length) return;
      const sec = el('section', { class: 'glosscat', id: 'gl-' + slug(cat) });
      sec.appendChild(el('h2', {}, esc(cat)));
      const dl = el('dl');
      matched.forEach(([t, d]) => dl.appendChild(el('div', { class: 'term', id: 'term-' + slug(t) }, `<dt>${esc(t)}</dt><dd>${esc(d)}</dd>`)));
      sec.appendChild(dl);
      container.appendChild(sec);
    });
    if (!container.children.length) container.innerHTML = `<p class="note">No terms match “${esc(filter)}”. Try a shorter word, or <a href="#/glossary">clear the search</a>.</p>`;
  }
  draw('');
  $('#glossSearch').addEventListener('input', e => draw(e.target.value));
  if (arg) {
    const t = $('#term-' + slug(arg));
    if (t) requestAnimationFrame(() => { t.scrollIntoView({ block: 'center' }); t.classList.add('flash'); });
  }
}

/* ============================================================
   SIDEBAR REGIME + BOOT
   ============================================================ */
function drawSidebar() {
  const reg = currentRegime();
  const box = $('#sideRegime');
  if (reg) {
    box.hidden = false;
    box.innerHTML = `<p class="lbl">Market regime today</p>
      <p class="now">${esc(reg.name)} <span>${pct(reg.p * 100, 0)}</span></p>
      <div class="bar" role="img" aria-label="${REGIMES.map(k => `${k} ${pct((reg.all[k] || 0) * 100, 0)}`).join(', ')}">${REGIMES.map(k => `<i style="width:${((reg.all[k] || 0) * 100).toFixed(1)}%;background:${regimeColor(k)}"></i>`).join('')}</div>
      <a href="#/glossary/regime">What's a regime?</a>`;
  }
  const d = (DATA.generated || '').split(' ')[0];
  $('#asofChip').innerHTML = `<i aria-hidden="true"></i>Data as of ${esc(longDate(d))}`;
  $('#sideMeta').textContent = `Snapshot from the research notebook, ${longDate(d)}.`;
  $('#navCount').textContent = DATA.tickers.length;
}

async function boot() {
  tip.node = $('#tip');
  $('#footYear').textContent = new Date().getFullYear();
  $('#themeSwitch').setAttribute('aria-checked', document.documentElement.dataset.theme === 'dark' ? 'true' : 'false');
  $('#themeSwitch').addEventListener('click', () => setTheme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark', true));
  $('#menuToggle').addEventListener('click', () => {
    const open = !$('#sideNav').classList.contains('open');
    $('#sideNav').classList.toggle('open', open);
    $('#menuToggle').setAttribute('aria-expanded', String(open));
    $('#menuToggle').setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
  });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') { tip.hide(); closeMenu(); } });
  // glossary definitions on hover / focus anywhere
  bindTip(document.body, '[data-def]', (n) => { const g = GLOSS_INDEX[n.dataset.def]; return g ? `<span class="t-h">${esc(g[0])}</span>${esc(g[1])}<span class="t-n">Click for the glossary</span>` : ''; });
  window.addEventListener('hashchange', () => router());
  try {
    const res = await fetch('sentinel_data.json', { cache: 'no-store' });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    DATA = await res.json();
  } catch (e) {
    $('#view').innerHTML = `<div class="errorbox"><h2>Couldn't load the research data</h2>
      <p>The site expects <code>sentinel_data.json</code> next to <code>index.html</code>. If you opened the file
      straight from disk, browsers block that: run a small local server (<code>python -m http.server</code>) or view it on GitHub Pages.</p>
      <p class="note">Details: ${esc(e.message)}</p></div>`;
    return;
  }
  computeStats();
  drawSidebar();
  if (DATA.generated) $('#footGenerated').textContent = 'Data generated ' + DATA.generated;
  router();
}
boot();
