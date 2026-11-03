/* ============================================================
   Sentinel — single-page research site
   Loads data/sentinel_data.json (written daily by pipeline/update_model.py)
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
const dataDate = () => DATA.data_through || (DATA.generated || '').split(' ')[0];
const shortDate = (d) => { if (!d) return ''; const [y, m, dd] = d.split('-'); return `${MONTHS[+m - 1]} ${+dd}`; };
const longDate = (d) => { if (!d) return '—'; const [y, m, dd] = d.split('-'); return `${MONTHS[+m - 1]} ${+dd}, ${y}`; };
const ordinal = (n) => n + (['th', 'st', 'nd', 'rd'][(n % 100 - 20) % 10] || ['th', 'st', 'nd', 'rd'][n % 100] || 'th');
const median = (a) => { const s = a.filter(isNum).sort((x, y) => x - y); if (!s.length) return null; const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
const css = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
const ICON_ARROW = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>';
const TOUCH = () => matchMedia('(hover: none)').matches;
const ICON_BACK = '<svg class="flip" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>';
const ICON_DOT = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 12h8"/></svg>';

/* ---------- composite (fuel / news / operations) ----------
   Only shown when the daily data contains a live composite block.
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
  document.title = `${route.title} — Sentinel`;
  try {
    route.fn(view, arg && decodeURIComponent(arg));
  } catch (e) {
    console.error(e);
    view.innerHTML = `<div class="errorbox"><h2>This page couldn't be drawn</h2>
      <p>Something went wrong showing this page, possibly during a data update. Reloading usually fixes it.</p>
      <p><button class="btn" type="button" onclick="location.reload()">Reload</button> <a class="btn" href="#/overview">Go to the overview</a></p>
      <details class="note"><summary>Technical details</summary><p>${esc(e.message)}. If it persists, re-run the daily update (Actions, Daily update, Run workflow).</p></details></div>`;
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
      <span class="val">${pct(s.avg, 0)} <small>${pct(s.lo, 0)}–${pct(s.hi, 0)}</small></span></a>`;
    ul.appendChild(li);
  });
  wrap.appendChild(ul);
  const ticks = [];
  for (let v = SCALE.lo; v <= SCALE.hi; v += (SCALE.hi - SCALE.lo > 60 ? 20 : 10)) ticks.push(`<span style="left:${xPct(v)}">${v}%</span>`);
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
  const hi = STATS[0], lo = STATS[STATS.length - 1];
  const T = DATA.track && DATA.track.sector;
  const eg = T && T.egarch;

  const hero = el('section', { class: 'ox-hero', 'aria-labelledby': 'ovTitle' });
  hero.innerHTML = `<h1 id="ovTitle">Risk intelligence.<span>Built on data. Tested against outcomes.</span></h1>
    <div><p class="lead">Volatility forecasts for U.S. equities, beginning with the eight major airlines. Re-run after every trading day and scored against what actually happened.</p>
      <div class="ox-actions"><a class="btn primary" href="#/stocks">Compare the eight ${ICON_ARROW}</a><a class="btn" href="#/lab">How the models work</a></div>
      <p class="nfa"><a href="#disclaimer" data-nfa>Not financial advice.</a> Research and education only.</p></div>`;
  view.appendChild(hero);

  const fig = el('figure', { class: 'ox-fig' });
  fig.innerHTML = `<figcaption class="ox-fighead"><span class="cap"><b>The sector, day by day</b>12 months, then the forecast. Taller and brighter means more volatile. ${TOUCH() ? 'Tap to read any day.' : 'Hover to read any day.'}</span>
      <span class="ctl"><span class="k" id="ridgeKey"></span>
        <span class="seg" role="group" aria-label="Chart view"><button type="button" data-v="field">Characters</button><button type="button" data-v="ridge">Ridges</button></span></span></figcaption>
    <div class="ox-ridge"><canvas id="cRidge" role="img" tabindex="0" aria-label="${esc(`Volatility of the eight airlines over the past twelve months and forecast for the next two. Forecasts: ${STATS.map(s => `${s.t} ${pct(s.avg, 0)}`).join(', ')}. Use arrow keys to read any day, Enter to open a carrier.`)}"></canvas></div><p class="sr" id="ridgeLive" aria-live="polite"></p>`;
  view.appendChild(fig);

  const rail = el('section', { class: 'ox-rail', 'aria-label': 'Sector status' });
  const dh = eg && eg.all && eg.all.day, ds2 = eg && eg.since && eg.since.day;
  rail.innerHTML = `
    ${reg ? `<div><p class="l">Market regime</p><p class="v">${esc(reg.name)} <small>${pct(reg.p * 100, 0)}</small></p><p class="s">${termLink('What is a regime?', 'Regime')}</p></div>` : ''}
    <div><p class="l">Sector median</p><p class="v">${pct(SECTOR_MED, 1)}</p><p class="s">Forecast, annualized</p></div>
    <div><p class="l">Highest forecast</p><p class="v">${hi.t} <small>${pct(hi.avg, 0)}</small></p><p class="s">${esc(hi.short)}</p></div>
    <div><p class="l">Lowest forecast</p><p class="v">${lo.t} <small>${pct(lo.avg, 0)}</small></p><p class="s">${esc(lo.short)}</p></div>
    ${dh ? `<div><p class="l">EGARCH next-day check</p><p class="v">${pct(dh.hit * 100, 0)} <small>target 95%</small></p><p class="s${ds2 && ds2.verdict !== 'ok' ? ' warn' : ''}">${ds2 ? `${ds2.inside} of ${ds2.n} since ${esc(shortDate(DATA.track.start))}` : 'Moves inside the range'}</p></div>` : ''}`;
  view.appendChild(rail);

  view.appendChild(el('p', { class: 'ox-say' }, `Returns are close to unpredictable. Volatility isn't: calm and wild stretches bunch together. <b>Sentinel measures the size of the next move.</b>`));

  // product fragments
  const bento = el('section', { class: 'ox-bento', 'aria-label': 'Sector detail' });
  bento.appendChild(el('h2', { class: 'sr' }, 'Sector detail'));
  const f1 = el('div', { class: 'ox-frag span-7' });
  const p1 = el('div', { class: 'pane' }, `<h3>Forecast, all eight</h3><p class="sub">Expected over the ${esc(DATA.horizon_label || 'next ~2 months')}, highest first, on one shared scale.</p>`);
  p1.appendChild(buildLadder());
  p1.appendChild(el('div', { style: 'margin-top:.7rem' }, ladderKey()));
  f1.appendChild(p1);
  bento.appendChild(f1);
  if (reg) {
    bento.appendChild(el('div', { class: 'ox-frag span-5' }, `<div class="pane" style="display:flex;flex-direction:column"><h3>Market regime</h3>
      <p class="sub">Past 12 months, from the ${termLink('HMM')}.</p>
      <p class="ox-regime-now">${esc(reg.name)} <small>${pct(reg.p * 100, 0)} likely</small></p>
      <div class="canvas-box" style="flex:1;min-height:220px;height:auto" role="img" aria-label="${esc(regimeSummary())}"><canvas id="cOvRegime"></canvas></div>
      <div class="keyrow">${REGIMES.map(k => `<span><i class="dot" style="background:${regimeColor(k)}"></i>${k} ${pct((reg.all[k] || 0) * 100, 0)}</span>`).join('')}</div></div>`));
  }
  if (T) {
    const names = (DATA.track.models) || {};
    const row = (k) => { const m = T[k]; if (!m) return ''; const a2 = m.all || {}, si = m.since || {};
      return `<tr><td>${esc(names[k] || k)}</td><td>${a2.day ? pct(a2.day.hit * 100, 0) : '—'}</td>
        <td class="${si.day && si.day.verdict !== 'ok' ? 'bad' : ''}">${si.day ? `${si.day.inside}/${si.day.n}` : '—'}</td>
        <td>${a2.m2 ? fmt(a2.m2.mae, 1) : '—'}</td></tr>`; };
    bento.appendChild(el('div', { class: 'ox-frag span-4' }, `<div class="pane"><h3>How the models have done</h3>
      <p class="sub">Next-day moves inside the 95% range, and the average two-month miss in points. Most of the full record is reconstructed.</p>
      <table class="ox-score"><thead><tr><th scope="col">Model</th><th scope="col">Full record</th><th scope="col">Since ${esc(shortDate(DATA.track.start))}</th><th scope="col">2-mo miss</th></tr></thead>
      <tbody>${Object.keys(T).map(row).join('')}</tbody></table></div>
      <ul class="ox-caps"><li><b>Logged live</b> from ${esc(shortDate(DATA.track.first_live || DATA.track.start))}; earlier days reconstructed</li><li><b>Misses shown</b> as plainly as hits</li></ul>`));
  }
  const ops = el('div', { class: 'ox-frag span-4' }, `<div class="pane"><h3>Airborne at the last snapshot</h3>
      <p class="sub" id="opsSub">Latest flight snapshot.</p><ul class="ox-bars" id="opsBars"><li><b>…</b><i style="width:0"></i><span></span></li></ul></div>
      <ul class="ox-caps"><li><b>Daily snapshot</b> of flights and airport delays</li><li><a href="#/globe">Open the 3D globe</a></li></ul>`);
  bento.appendChild(ops);
  const pc1 = (DATA.portfolio && DATA.portfolio.pca_explained && DATA.portfolio.pca_explained[0]) || 0;
  bento.appendChild(el('div', { class: 'ox-frag span-4' }, `<div class="pane"><h3>One shared factor</h3>
      <p class="sub">How much of all eight stocks' movement a single factor explains.</p>
      <p class="ox-big">${pct(pc1 * 100, 0)}</p><div class="ox-split" role="img" aria-label="${pct(pc1 * 100, 0)} shared"><i style="width:${(pc1 * 100).toFixed(1)}%"></i></div>
      <p class="sub" style="margin:0">The carriers largely move as one, so combining them removes only part of the risk.</p></div>
      <ul class="ox-caps"><li><b>${termLink('PCA', 'PCA')}</b> risk decomposition</li><li><a href="#/portfolio">See the portfolio view</a></li></ul>`));
  view.appendChild(bento);
  fetch('data/globe_data.json', { cache: 'no-store' }).then(r => r.ok ? r.json() : null).then(g => {
    const box = $('#opsBars'); if (!box || !g || !g.flight_counts) { if (box) box.innerHTML = '<li class="note">Flight data unavailable.</li>'; return; }
    const rows = Object.entries(g.flight_counts).map(([t, c]) => [t, c.airborne || 0]).sort((a2, b2) => b2[1] - a2[1]);
    const max = rows[0][1] || 1;
    box.innerHTML = rows.map(([t, n]) => `<li><b>${t}</b><i style="width:${Math.max(2, n / max * 100).toFixed(0)}%"></i><span>${n}</span></li>`).join('');
    const when = (g.flights_time || '').replace('T', ' ').slice(0, 16);
    $('#opsSub').textContent = `Airborne flights per carrier, snapshot ${when} UTC.`;
  }).catch(() => {});

  // console: one forecast, three ways
  const top = STATS[0], nar = buildNarrative(top.t);
  const how = el('section', { class: 'ox-how', 'aria-labelledby': 'howTitle' });
  const when = DATA.pipeline && DATA.pipeline.models && DATA.pipeline.models.egarch && DATA.pipeline.models.egarch.at;
  const fa = DATA.stocks[top.t].forecast_avg || {};
  const panes = {
    read: nar.paras.map(p => `<p>${p}</p>`).join(''),
    data: `<pre><i>// data/sentinel_data.json, stocks.${top.t}.forecast_avg</i>
{
  "egarch": <b>${fa.egarch}</b>,
  "timesfm_alone": <b>${fa.timesfm_alone}</b>,
  "timesfm_together": <b>${fa.timesfm_together}</b>
}
<i>// recent realized (20-day): ${pct(top.recent)}
// generated ${esc(DATA.generated || '')} UTC${when ? ', EGARCH finished ' + esc(when) : ''}</i></pre>`,
    model: `<pre><i>// EGARCH(1,1,1): volatility from recent shocks; bad news weighs more</i>
ln σ²ₜ = ω + β·ln σ²ₜ₋₁ + α·(|zₜ₋₁| − E|z|) + γ·zₜ₋₁

<i>// annualized from daily volatility</i>
σ_annual = σ_daily × √252

<i>// typical move over the ${DATA.horizon_days || 42}-day horizon</i>
${top.t}: ${pct(top.avg, 0)} × √(${DATA.horizon_days || 42}/252) = <b>±${pct(horizonMove(top.avg), 0)}</b></pre>`,
  };
  how.innerHTML = `<div><h2 id="howTitle">One forecast, three ways to read it.</h2>
      <p>In plain English, as the raw data file, or as the model behind it. Nothing is a black box: it all comes from one open pipeline.</p>
      <p><a href="#/lab">All the models</a> · <a href="#/glossary">Glossary</a> · <a href="data/sentinel_data.json">Raw data</a> · <a href="data/forecast_log.csv">Forecast log</a></p></div>
    <div class="ox-console"><div class="ox-tabs" role="tablist" aria-label="Forecast views">
        <button role="tab" data-p="read" aria-selected="true" type="button">Plain English</button>
        <button role="tab" data-p="data" aria-selected="false" tabindex="-1" type="button">Data</button>
        <button role="tab" data-p="model" aria-selected="false" tabindex="-1" type="button">Model</button>
        <span class="who">${top.t}</span></div>
      <div class="ox-body" id="oxBody" role="tabpanel" tabindex="0" aria-label="Forecast view"></div></div>`;
  view.appendChild(how);
  $('#oxBody').innerHTML = panes.read;
  $('.ox-tabs', how).addEventListener('click', (e) => { const b = e.target.closest('button[data-p]'); if (!b) return;
    $$('button[data-p]', how).forEach(x => { x.setAttribute('aria-selected', x === b ? 'true' : 'false'); x.tabIndex = x === b ? 0 : -1; }); $('#oxBody').innerHTML = panes[b.dataset.p]; });
  $('.ox-tabs', how).addEventListener('keydown', (e) => { if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return; e.preventDefault();
    const tabs = $$('button[data-p]', how), i = tabs.indexOf(document.activeElement), n = tabs[(i + (e.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length]; n.click(); n.focus(); });

  // data sources
  const data = el('section', { class: 'section', 'aria-labelledby': 'dataTitle' });
  data.innerHTML = `<h2 id="dataTitle">Where the data comes from</h2>
    <p class="sub">Market data is refreshed after every trading day. Fuel, news and operations ${compositeLive()
      ? 'are included.' : 'are collected by the pipeline but <b>not in the daily data yet</b>, so the site hides them.'}</p>
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

  drawRegimeChart('cOvRegime');
  drawRidge();
}

/* Signature figure. Eight carriers on one timeline: 12 months of realized volatility, then the
   average forecast path. Two views of the same numbers: rows of characters, whose height, density
   and colour follow volatility, or ridge lines. Hover, click and the time axis are shared. */
let RIDGE_VIEW = 'field';
try { RIDGE_VIEW = localStorage.getItem('sentinel-fig') || 'field'; } catch (e) {}
function drawRidge() {
  const cv = $('#cRidge'); if (!cv) return;
  const fd = DATA.forecast_dates || [], N = 252;
  const rows = STATS.map(st => {
    const S = DATA.stocks[st.t], rv = S.realized_vol, ps = [S.egarch_path, S.timesfm_alone_path, S.timesfm_together_path].filter(Boolean);
    const fut = fd.map((_, i) => { const v = ps.map(p => p[i]).filter(isNum); return v.length ? v.reduce((a2, b2) => a2 + b2, 0) / v.length : null; });
    const past = rv.values.slice(-N);
    return { st, dates: rv.dates.slice(-N).concat(fd), vals: past.concat(fut), split: past.length - 1 };
  });
  const all = rows.flatMap(r => r.vals).filter(isNum).sort((p, q) => p - q);
  const vMin = all[0], vMax = all[all.length - 1];
  const pLo = all[Math.floor(all.length * .02)], pHi = all[Math.floor(all.length * .98)];
  const norm = (v) => Math.max(0, Math.min(1, (v - pLo) / (pHi - pLo)));
  const green = css('--green'), ink = css('--ink'), ink2 = css('--ink-2'), ink3 = css('--ink-3'), card = css('--card'), line = css('--line');
  const G = hexRgb(green), Mut = hexRgb(css('--line-strong')), Hot = hexRgb(css('--brass'));
  const heat = (f) => f < .65 ? mix(Mut, G, f / .65) : mix(G, Hot, (f - .65) / .35);
  const GLYPHS = '.:-=+*#%', L = 56, R = 62, TOP = 8, BOT = 24, CW = 6.2, LH = 8.6;
  let hover = null, g = null, cache = null;
  const setKey = () => {
    const k = $('#ridgeKey'); if (!k) return;
    k.innerHTML = RIDGE_VIEW === 'field' ? `<span>Lower <i class="ramp"></i> Higher</span>` : `<span><i></i>Realized</span><span><i class="d"></i>Forecast</span>`;
    $$('.ox-fighead button[data-v]').forEach(b2 => b2.setAttribute('aria-pressed', b2.dataset.v === RIDGE_VIEW ? 'true' : 'false'));
  };
  /* The character layer is expensive, so it is drawn once per size and reused while hovering. */
  function fieldLayer(w, h, dpr) {
    const key = `${w}x${h}x${dpr}`;
    if (cache && cache.key === key) return cache.canvas;
    const off = document.createElement('canvas'); off.width = Math.round(w * dpr); off.height = Math.round(h * dpr);
    const c = off.getContext('2d'); c.setTransform(dpr, 0, 0, dpr, 0, 0);
    const W = w - L - R, n = rows[0].vals.length, band = (h - TOP - BOT) / rows.length;
    const cols = Math.floor(W / CW), lines = Math.max(2, Math.floor((band - 4) / LH));
    c.font = "400 10px 'DM Mono', monospace"; c.textBaseline = 'alphabetic'; c.textAlign = 'left';
    rows.forEach((r, ri) => {
      const base = TOP + (ri + 1) * band - 4;
      for (let col = 0; col < cols; col++) {
        const idx = Math.min(n - 1, Math.round(col / (cols - 1) * (n - 1))), v = r.vals[idx];
        if (!isNum(v)) continue;
        const f = norm(v), lit = Math.max(1, Math.round(f * lines)), fc = idx > r.split;
        for (let l = 0; l < lines; l++) {
          const on = l < lit;
          c.globalAlpha = on && fc ? .6 : 1;
          c.fillStyle = on ? heat(Math.max(.22, f * (.55 + .45 * (l + 1) / lit))) : line;
          c.fillText(on ? GLYPHS[Math.min(GLYPHS.length - 1, Math.floor((.25 + .75 * f) * (1 - l / lines) * GLYPHS.length))] : '.', L + col * CW, base - l * LH);
        }
      }
    });
    c.globalAlpha = 1;
    cache = { key, canvas: off };
    return off;
  }
  function paint() {
    const box = cv.parentElement.getBoundingClientRect(), dpr = devicePixelRatio || 1;
    if (!box.width) return;
    const w = box.width, h = box.height;
    cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr);
    const c = cv.getContext('2d'); c.setTransform(dpr, 0, 0, dpr, 0, 0); c.clearRect(0, 0, w, h);
    const W = w - L - R, n = rows[0].vals.length, field = RIDGE_VIEW === 'field';
    const band = (h - TOP - BOT) / rows.length, step = (h - TOP - BOT) / (rows.length + 1.1), amp = step * 2.1;
    const X = (i) => L + i / (n - 1) * W, base = (ri) => field ? TOP + (ri + 1) * band - 4 : TOP + amp + ri * step;
    const Y = (ri, v) => base(ri) - (v - vMin) / (vMax - vMin) * amp;
    g = { n, W, band, step, amp, field, X, base };
    const split = rows[0].split, sx = X(split);
    c.fillStyle = `rgba(${G[0]},${G[1]},${G[2]},.05)`; c.fillRect(sx, 0, L + W - sx, h - BOT);
    if (field) {
      c.drawImage(fieldLayer(w, h, dpr), 0, 0, w, h);
    } else {
      rows.forEach((r, ri) => {
        const on = hover && hover.ri === ri, dim = hover && !on;
        const trace = (from, to, close) => { c.beginPath(); let started = false;
          for (let i = from; i <= to; i++) { const v = r.vals[i]; if (!isNum(v)) continue; const x = X(i), y = Y(ri, v); if (!started) { if (close) { c.moveTo(x, base(ri)); c.lineTo(x, y); } else c.moveTo(x, y); started = true; } else c.lineTo(x, y); }
          if (close) { c.lineTo(X(to), base(ri)); c.closePath(); } };
        trace(0, n - 1, true);
        c.fillStyle = card; c.fill();
        const grad = c.createLinearGradient(0, base(ri) - amp, 0, base(ri));
        grad.addColorStop(0, `rgba(${G[0]},${G[1]},${G[2]},${on ? .34 : .2})`); grad.addColorStop(1, `rgba(${G[0]},${G[1]},${G[2]},0)`);
        c.fillStyle = grad; c.fill();
        c.lineJoin = 'round'; c.lineWidth = on ? 2 : 1.3; c.globalAlpha = dim ? .35 : 1; c.strokeStyle = on ? ink : green;
        trace(0, split, false); c.stroke();
        c.setLineDash([4, 3]); trace(split, n - 1, false); c.stroke(); c.setLineDash([]);
        c.globalAlpha = 1;
        c.strokeStyle = line; c.lineWidth = 1; c.beginPath(); c.moveTo(L, base(ri) + .5); c.lineTo(L + W, base(ri) + .5); c.stroke();
      });
    }
    c.font = "400 12px 'DM Mono', monospace"; c.textBaseline = 'alphabetic';
    rows.forEach((r, ri) => {
      const on = hover && hover.ri === ri;
      c.textAlign = 'left'; c.fillStyle = on ? ink : ink2; c.fillText(r.st.t, 0, base(ri) - 1);
      c.textAlign = 'right'; c.fillStyle = on ? ink : ink3; c.fillText(pct(r.st.avg, 0), w, base(ri) - 1);
    });
    c.fillStyle = ink3; c.textAlign = 'right'; c.fillText('Forecast', w, 10);
    c.textAlign = 'center';
    const dates = rows[0].dates;
    const tickStep = Math.max(42, Math.ceil(74 / (W / (n - 1))));
    for (let i = 0; i < split - tickStep / 2; i += tickStep) c.fillText(shortDate(dates[i]), Math.max(L + 20, X(i)), h - 5);
    c.fillStyle = ink; c.fillText('Today', sx, h - 5);
    c.fillStyle = ink3; c.textAlign = 'right'; if (W > 420) c.fillText(shortDate(dates[n - 1]), L + W, h - 5);
    c.strokeStyle = ink3; c.setLineDash([2, 3]); c.lineWidth = 1; c.beginPath(); c.moveTo(sx + .5, 0); c.lineTo(sx + .5, h - BOT); c.stroke(); c.setLineDash([]);
    if (hover) {
      const x = X(hover.i), v = rows[hover.ri].vals[hover.i];
      c.strokeStyle = ink2; c.lineWidth = 1; c.beginPath(); c.moveTo(x + .5, 0); c.lineTo(x + .5, h - BOT); c.stroke();
      if (field) {
        c.strokeStyle = ink3; c.strokeRect(L - 4.5, base(hover.ri) - band + 5.5, W + 8, band - 3);
      } else if (isNum(v)) {
        c.beginPath(); c.arc(x, Y(hover.ri, v), 4, 0, 7); c.fillStyle = card; c.fill(); c.lineWidth = 2; c.strokeStyle = ink; c.stroke();
      }
    }
  }
  const leave = () => { hover = null; tip.hide(); paint(); };
  const describe = (ri, i) => {
    const r = rows[ri], fc = i > r.split, v = r.vals[i];
    return { r, fc, v, html: `<span class="t-h">${esc(r.st.short)} (${r.st.t})</span>${tipRows([[longDate(r.dates[i]), fc ? 'Forecast' : 'Realized'], ['Volatility', pct(v)], ...(fc ? [] : [['Regime', regimeByDate()[r.dates[i]] || '—']]), ['Typical 2-month move', '±' + pct(horizonMove(v), 0)]])}<span class="t-n">${TOUCH() ? `<a href="#/stocks/${r.st.t}">Open ${r.st.t}</a> from the forecast list below` : `Click or press Enter to open ${r.st.t}`}</span>` };
  };
  const point = (e) => {
    if (!g) return;
    const b = cv.getBoundingClientRect(), x = e.clientX - b.left, y = e.clientY - b.top;
    const i = Math.round((x - L) / g.W * (g.n - 1));
    if (i < 0 || i >= g.n) { leave(); return; }
    const raw = g.field ? Math.floor((y - TOP) / g.band) : Math.round((y - TOP - g.amp + g.step * .35) / g.step);
    const ri = Math.max(0, Math.min(rows.length - 1, raw));
    hover = { ri, i }; paint();
    tip.show(describe(ri, i).html, e.clientX, e.clientY);
  };
  let lastPointer = 'mouse';
  cv.addEventListener('pointerdown', (e) => { lastPointer = e.pointerType; if (e.pointerType !== 'mouse') point(e); });
  cv.addEventListener('pointermove', (e) => { if (e.pointerType === 'mouse') point(e); });
  cv.addEventListener('mouseleave', leave);
  cv.addEventListener('click', () => { if (hover && lastPointer === 'mouse') location.hash = '#/stocks/' + rows[hover.ri].st.t; });
  const keyShow = () => {
    paint();
    const d = describe(hover.ri, hover.i), b = cv.getBoundingClientRect();
    tip.show(d.html, b.left + g.X(hover.i), b.top + g.base(hover.ri));
    const live = $('#ridgeLive'); if (live) live.textContent = `${d.r.st.t}, ${longDate(d.r.dates[hover.i])}, ${d.fc ? 'forecast' : 'realized'} volatility ${pct(d.v, 0)}`;
  };
  cv.addEventListener('focus', () => { hover = hover || { ri: 0, i: rows[0].split }; if (cv.matches(':focus-visible')) keyShow(); });
  cv.addEventListener('blur', leave);
  cv.addEventListener('keydown', (e) => {
    if (!hover) hover = { ri: 0, i: rows[0].split };
    const n = rows[0].vals.length, step = e.shiftKey ? 21 : 1;
    if (e.key === 'ArrowLeft') hover.i = Math.max(0, hover.i - step);
    else if (e.key === 'ArrowRight') hover.i = Math.min(n - 1, hover.i + step);
    else if (e.key === 'ArrowUp') hover.ri = Math.max(0, hover.ri - 1);
    else if (e.key === 'ArrowDown') hover.ri = Math.min(rows.length - 1, hover.ri + 1);
    else if (e.key === 'Enter') { location.hash = '#/stocks/' + rows[hover.ri].st.t; return; }
    else return;
    e.preventDefault(); keyShow();
  });
  $('.ox-fighead .seg').addEventListener('click', (e) => {
    const b = e.target.closest('button[data-v]'); if (!b) return;
    RIDGE_VIEW = b.dataset.v; try { localStorage.setItem('sentinel-fig', RIDGE_VIEW); } catch (err) {}
    hover = null; tip.hide(); setKey(); paint();
  });
  setKey(); paint();
  const ro = new ResizeObserver(paint); ro.observe(cv.parentElement);
  routeCleanup.push(() => ro.disconnect());
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { cache = null; if (cv.isConnected) paint(); });
}

function regimeSummary() {
  const reg = currentRegime(); if (!reg) return '';
  return `Market regime over the past year; today ${reg.name} at ${pct(reg.p * 100, 0)} probability.`;
}

/* ============================================================
   STOCKS — sortable comparison table
   ============================================================ */
/* Realized volatility then the mean forecast, every carrier on the same vertical scale. */
function trendSvg(t) {
  const N = 126, W = 240, H = 44, S = DATA.stocks[t], fd = DATA.forecast_dates || [];
  const ps = [S.egarch_path, S.timesfm_alone_path, S.timesfm_together_path].filter(Boolean);
  const fut = fd.map((_, i) => { const v = ps.map(p => p[i]).filter(isNum); return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null; });
  const past = S.realized_vol.values.slice(-N);
  if (!trendSvg.range) {
    const all = DATA.tickers.flatMap(x => DATA.stocks[x].realized_vol.values.slice(-N)).filter(isNum);
    trendSvg.range = [Math.min(...all), Math.max(...all)];
  }
  const [lo, hi] = trendSvg.range, n = past.length + fut.length - 1;
  const X = (i) => (i / n * W).toFixed(1), Y = (v) => (H - 2 - (Math.min(hi, Math.max(lo, v)) - lo) / (hi - lo) * (H - 4)).toFixed(1);
  const line = (a, off) => a.map((v, i) => isNum(v) ? `${X(i + off)},${Y(v)}` : '').filter(Boolean).join(' ');
  const last = past.length - 1;
  const area = `0,${H} ${line(past, 0)} ${X(last)},${H}`;
  return `<svg class="trend" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" aria-hidden="true">
    <polygon points="${area}" fill="var(--s-band)"/>
    <line x1="${X(last)}" x2="${X(last)}" y1="0" y2="${H}" stroke="var(--line-strong)" vector-effect="non-scaling-stroke"/>
    <polyline points="${line(past, 0)}" fill="none" stroke="var(--s-eg)" stroke-width="1.4" vector-effect="non-scaling-stroke"/>
    <polyline points="${X(last)},${Y(past[last])} ${line(fut, past.length)}" fill="none" stroke="var(--s-eg)" stroke-width="1.4" stroke-dasharray="3 3" vector-effect="non-scaling-stroke"/></svg>`;
}

function renderStocks(view, arg) {
  if (arg && DATA.stocks[arg]) return renderStockDetail(view, arg);
  if (arg) view.appendChild(el('p', { class: 'notlive', role: 'status', style: 'margin-bottom:1.2rem' }, `No carrier called “${esc(arg)}”. Sentinel covers the eight below.`));

  view.appendChild(el('header', { class: 'pagehead' }, `
    <h1>Eight carriers, <span>one scale.</span></h1>
    <p>Every airline's two-month volatility forecast side by side. Sort any column; open a carrier for its full
    risk read and charts.</p>`));

  const live = compositeLive();
  const cols = [
    { k: 't', label: 'Carrier', num: false },
    { k: 'avg', label: 'Forecast', sub: 'annualized', title: 'Average of the three model forecasts' },
    { k: 'trend', label: '6 months, then forecast', nosort: true, cls: 'tr', title: 'Realized volatility, then the average forecast, on one shared scale' },
    { k: 'range', label: 'Model range', sortKey: 'spread', sub: 'low to high', title: 'Lowest to highest of the three forecasts' },
    { k: 'recent', label: 'Recent', sub: '20-day', title: '20-day realized volatility' },
    { k: 'change', label: 'Change', sub: 'forecast vs recent', title: 'Forecast minus recent' },
    { k: 'share', label: 'Sector share', sub: 'of its risk', title: 'Share of risk explained by the shared airline factor (PCA)' },
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
      if (c.nosort) return `<th scope="col"${c.title ? ` title="${esc(c.title)}"` : ''} class="${c.cls || ''}">${c.label}</th>`;
      const sk = c.sortKey || c.k;
      const on = state.key === sk;
      const aria = on ? ` aria-sort="${state.dir < 0 ? 'descending' : 'ascending'}"` : '';
      return `<th scope="col"${aria}${c.title ? ` title="${esc(c.title)}"` : ''}><button type="button" data-k="${sk}">${c.label}<span class="arrow" aria-hidden="true">${on ? `<svg viewBox="0 0 10 10"${state.dir < 0 ? '' : ' class="up"'}><path d="M2 3.5l3 3 3-3"/></svg>` : ''}</span></button>${c.sub ? `<small>${c.sub}</small>` : ''}</th>`;
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
      <td class="tr">${trendSvg(s.t)}</td>
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
  bindTip(tbody, 'tr[data-t] td.mini, tr[data-t] td.tr', (n) => ladderTip(statOf(n.parentElement.dataset.t)));
  drawHead(); drawBody();

  view.appendChild(el('p', { class: 'note', style: 'margin-top:1rem' },
    `Forecasts are ${termLink('annualized volatility', 'Annualized volatility')} averaged over the next ~2 months, the mean of EGARCH, TimesFM and TimesFM with the sector. Hover a model range for each model's number. “Change” compares the forecast with the last 20 trading days.` +
    (live ? ' Alt-data flow describes fuel, news and operations context, not a price call.' : ' Fuel, news and operations signals will appear here once they reach the daily data.')));
}

/* ---------- stock detail ---------- */
function renderStockDetail(view, sym) {
  const s = DATA.stocks[sym];
  const st = statOf(sym);
  const info = s.info || {};
  const name = info.longName || info.shortName || AIRLINE_NAMES[sym] || sym;
  const price = info.currentPrice ?? info.regularMarketPrice;
  const reg = currentRegime();
  document.title = `${sym} — Sentinel`;

  // prev / next in forecast order
  const order = STATS.map(x => x.t);
  const i = order.indexOf(sym);
  const prev = order[(i - 1 + order.length) % order.length], next = order[(i + 1) % order.length];
  const onKey = (e) => {
    if ((e.target.closest && e.target.closest('input, select, textarea, button, a, summary, [role=tab], [tabindex="0"], .tablewrap')) || e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.key === 'ArrowLeft') location.hash = '#/stocks/' + prev;
    if (e.key === 'ArrowRight') location.hash = '#/stocks/' + next;
  };
  document.addEventListener('keydown', onKey);
  routeCleanup.push(() => document.removeEventListener('keydown', onKey));

  view.appendChild(el('header', { class: 'sx-head' }, `
    <div><p class="tk">${sym} · <a href="#disclaimer" data-nfa>not financial advice</a></p><h1>${esc(name)}</h1></div>
    <div class="sx-px"><div class="big">${money(price)}</div>
      <p>${isNum(st.chg1y) ? `${signed(st.chg1y)}% over 12 months` : ''}</p></div>`));

  const nar = buildNarrative(sym);
  const move = horizonMove(st.avg);
  const scaleTicks = []; for (let v = SCALE.lo; v <= SCALE.hi; v += 20) scaleTicks.push(`<span style="left:${xPct(v)}">${v}%</span>`);
  const trk = DATA.track && DATA.track.tickers && DATA.track.tickers[sym] && DATA.track.tickers[sym].egarch;
  const dayHit = trk && trk.all && trk.all.day;
  const inst = el('section', { class: 'sx-inst', 'aria-label': 'Forecast summary' });
  inst.innerHTML = `<div class="sx-top">
      <div class="sx-num"><p class="l">Forecast volatility, ${esc(DATA.horizon_label || 'next ~2 months')}</p><div class="n">${pct(st.avg, 0)} <small>annualized</small></div><p class="typ">A typical move is about <b>±${pct(move, 0)}</b> over the period, in either direction.</p></div>
      <div class="sx-track" aria-hidden="true">${ladderTrack(st)}<div class="scale">${scaleTicks.join('')}</div>${ladderKey()}</div>
    </div>
    <div class="sx-cells">
      <div><p class="l">Model range</p><p class="v">${pct(st.lo, 0)}–${pct(st.hi, 0)}</p></div>
      <div><p class="l">Recent (20-day)</p><p class="v">${pct(st.recent, 0)} <small>${signed(st.change, 0)} pts to forecast</small></p></div>
      <div><p class="l">Volatility rank</p><p class="v">${st.rank === 1 ? 'Highest' : ordinal(st.rank) + ' highest'} <small>of ${STATS.length}</small></p></div>
      <div><p class="l">Shared with sector</p><p class="v">${pct(st.share, 0)}</p></div>
      ${dayHit ? `<div><p class="l">Next-day check</p><p class="v">${pct(dayHit.hit * 100, 0)} <small>target 95%</small></p></div>` : (reg ? `<div><p class="l">Market regime</p><p class="v">${esc(reg.name)}</p></div>` : '')}
    </div>`;
  view.appendChild(inst);

  const grid = el('div', { class: 'sx-grid' });
  const mainCol = el('div', { class: 'sx-main' });
  mainCol.appendChild(el('h2', { class: 'sr' }, 'Charts and evidence'));
  const rail = el('aside', { class: 'sx-rail', 'aria-label': 'Reading and other carriers' });
  rail.innerHTML = `<div class="pane"><h2>${esc(nar.title)}</h2>${nar.paras.map(p => `<p>${p}</p>`).join('')}
      <p class="asof">Written automatically from model output · not financial advice</p></div>
    <div class="pane"><h3 style="margin:0">The eight</h3><ul class="sx-pick">${STATS.map(x => `<li><a href="#/stocks/${x.t}"${x.t === sym ? ' aria-current="page"' : ''}><b>${x.t}</b>${ladderTrack(x, false)}<span class="v">${pct(x.avg, 0)}</span></a></li>`).join('')}</ul>
      <p class="asof" style="margin-top:.6rem">Use ← → to step through carriers</p></div>`;
  grid.appendChild(mainCol); grid.appendChild(rail);
  view.appendChild(grid);

  // volatility chart (realized + 3 forecasts + range band)
  const vc = el('section', { class: 'card chartcard', 'aria-labelledby': 'vcTitle' });
  vc.innerHTML = `<div class="cc-head"><div><h3 id="vcTitle">Volatility: recent and forecast</h3>
      <p>Realized volatility over the last 6 months, then each model's path for the next ~2 months. ${TOUCH() ? 'Touch the chart to read any day.' : 'Move across the chart to read any day.'}</p></div></div>
    <div class="readout" id="roVol"></div>
    <div class="canvas-box" role="img" aria-label="${esc(`${sym} realized volatility ${pct(st.recent)}; forecasts EGARCH ${pct(st.eg)}, TimesFM ${pct(st.tf)}, TimesFM with sector ${pct(st.tfT)}.`)}"><canvas id="cVolF"></canvas></div>
    <div class="keyrow">
      <span><i class="sw" style="border-color:var(--s-real)"></i> Realized (20-day)</span>
      <span><i class="sw dash" style="border-color:var(--s-eg)"></i> EGARCH ${pct(st.eg)}</span>
      <span><i class="sw dash" style="border-color:var(--s-tf)"></i> TimesFM ${pct(st.tf)}</span>
      <span><i class="sw dot" style="border-color:var(--s-tf2)"></i> TimesFM + sector ${pct(st.tfT)}</span>
      <span><i class="sw box" style="background:var(--s-band)"></i> Model range</span>
    </div>`;
  const variant = DATA.pipeline && DATA.pipeline.models && DATA.pipeline.models.egarch && (DATA.pipeline.models.egarch.robust_variant || {})[sym];
  if (variant) {
    const why = { 'egarch-t': 'a Student-t EGARCH (heavier tails)', 'egarch-3y': 'EGARCH fitted on the last 3 years', 'egarch-t-3y': 'a Student-t EGARCH on the last 3 years', realized: 'recent realized volatility, held flat, because every EGARCH fit failed' }[variant] || variant;
    vc.appendChild(el('p', { class: 'note', style: 'margin:.7rem 0 0' }, `Today the standard EGARCH fit was unstable on ${sym}'s price history, so the EGARCH line uses ${esc(why)}.`));
  }
  mainCol.appendChild(vc);

  // how good have these forecasts been?
  renderTrackRecord(mainCol, sym);

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
      ${REGIMES.map(k => `<span><i class="sw box" style="background:${regimeColor(k)};opacity:.3"></i> ${k}</span>`).join('')}
    </div>
    <p class="note" style="margin:.7rem 0 0">Sentinel doesn't link news stories to these moves yet; the dates are a starting point for your own reading.</p>`;
  mainCol.appendChild(pc);

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
    mainCol.appendChild(alt);
  } else {
    mainCol.appendChild(el('section', { class: 'notlive chartcard' }, `<h3>Fuel, news and operations <span class="tag soon">Not live yet</span></h3>
      <p>These signals are collected by the pipeline but aren't in the daily data yet, so Sentinel hides them rather than
      show old example values. They'll appear here once they're included.</p>`));
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
    <p class="factnote note">From Yahoo Finance at the latest daily run. PEG uses analysts' growth estimates, which swing widely for airlines; read it with care.</p>`;
  mainCol.appendChild(facts);

  drawStockCharts(sym, moves);
  $('#roVol').innerHTML = volReadoutDefault(st);
  if (s.price) $('#roPrice').innerHTML = priceReadoutDefault(s.price, info);
}
const zWord = (z, pos, neg) => !isNum(z) ? '—' : Math.abs(z) < 0.15 ? 'Neutral' : (z > 0 ? pos : neg).replace(/^./, m => m.toUpperCase());

/* ---- track record: every logged forecast scored against what happened ---- */
const TRACK_MODELS = { egarch: ['EGARCH', '--s-eg'], timesfm_alone: ['TimesFM', '--s-tf'], timesfm_together: ['TimesFM + sector', '--s-tf2'] };
const VERDICT = {
  day: { ok: ['Well calibrated', '--calm'], under: ['Underestimating risk', '--crisis'], over: ['Overestimating risk', '--stress'] },
  bias: { ok: ['Low average bias', '--calm'], under: ['Running low: underestimating', '--crisis'], over: ['Running high: overestimating', '--stress'] },
};
let TRACK_MODEL = 'egarch';
let TRACK_HORIZON = 'm2';

function renderTrackRecord(view, sym) {
  const T = DATA.track && DATA.track.tickers && DATA.track.tickers[sym];
  if (!T || !Object.keys(T).length) {
    view.appendChild(el('section', { class: 'notlive chartcard' }, `<h3>Track record <span class="tag soon">Not live yet</span></h3>
      <p>Every day the pipeline will log each model's forecasts and later score them against what actually happened.
      The record appears here after the first daily run.</p>`));
    return;
  }
  if (!T[TRACK_MODEL]) TRACK_MODEL = Object.keys(T)[0];
  const start = DATA.track.start, firstLive = DATA.track.first_live;
  const sec = el('section', { class: 'card chartcard track', 'aria-labelledby': 'trTitle' });
  sec.innerHTML = `<div class="cc-head"><div><h3 id="trTitle">Track record: how these forecasts have done</h3>
      <p>From ${esc(shortDate(firstLive || start))} every forecast is logged before its outcome exists; earlier days are reconstructed. Each is scored once the days pass, and misses count as much as hits.</p></div>
      <div class="seg" role="group" aria-label="Model">${Object.entries(TRACK_MODELS).filter(([k]) => T[k]).map(([k, [n]]) =>
        `<button type="button" data-m="${k}" aria-pressed="${k === TRACK_MODEL}">${n}</button>`).join('')}</div></div>
    <div class="trgrid" id="trGrid"></div>
    <h4 class="trsub">Next-day check: the forecast's 95% range vs the move that followed</h4>
    <div class="canvas-box" role="img" aria-label="Daily forecast ranges and the actual next-day moves for ${sym}"><canvas id="cTrDay"></canvas></div>
    <div class="keyrow">
      <span><i class="sw box" style="background:var(--s-band)"></i> Forecast range for the next day (95%)</span>
      <span><i class="sw pt" style="border-color:var(--ink-3)"></i> Actual move, inside</span>
      <span><i class="sw pt" style="border-color:var(--crisis);background:var(--crisis)"></i> Actual move, outside</span>
      <span><i class="sw dash" style="border-color:var(--ink-3)"></i> Live log starts</span>
    </div>
    <div class="cc-head" style="margin:1.6rem 0 .6rem"><h4 class="trsub" style="margin:0">Forecast volatility vs what happened</h4>
      <div class="seg" role="group" aria-label="Horizon"><button type="button" data-h="w1" aria-pressed="${TRACK_HORIZON === 'w1'}">1 week</button><button type="button" data-h="m2" aria-pressed="${TRACK_HORIZON === 'm2'}">2 months</button></div></div>
    <div class="canvas-box" role="img" aria-label="Forecast volatility and realized volatility by forecast date for ${sym}"><canvas id="cTrVol"></canvas></div>
    <div class="keyrow" id="trVolKey"></div>
    <h4 class="trsub" style="margin-top:1.6rem">Latest next-day checks</h4>
    <div id="trLatest"></div>
    <p class="note" style="margin:.9rem 0 0">Before ${esc(longDate(firstLive || start))} the record is <b>reconstructed</b>: each day was re-run walk-forward,
      using only prices available on that day. Forecasts made from ${esc(longDate(firstLive || start))} on are <b>logged live</b> by the daily run; each is checked against the next trading day's move, so a table row shows the day of the move. “Since ${esc(shortDate(start))}” counts both kinds.
      A well-calibrated model sees about 95 moves in 100 land inside its range; far fewer means it underestimates risk.
      ${termLink('How this is measured', 'Track record')}.</p>`;
  view.appendChild(sec);

  const draw = () => {
    if (!$('#trGrid')) return;
    const e = T[TRACK_MODEL];
    $('#trGrid').innerHTML = trackCards(e, start);
    $('#trLatest').innerHTML = trackLatest(e.series);
    activeCharts = activeCharts.filter(c => { if (c.canvas && c.canvas.id.startsWith('cTr')) { c.destroy(); return false; } return true; });
    drawTrackCharts(e.series, TRACK_MODEL);
  };
  sec.addEventListener('click', (ev) => {
    const m = ev.target.closest('button[data-m]'), h = ev.target.closest('button[data-h]');
    if (m) { TRACK_MODEL = m.dataset.m; $$('button[data-m]', sec).forEach(b => b.setAttribute('aria-pressed', b === m)); draw(); }
    if (h) { TRACK_HORIZON = h.dataset.h; $$('button[data-h]', sec).forEach(b => b.setAttribute('aria-pressed', b === h)); draw(); }
  });
  draw();
}

function trackCards(e, start) {
  const v = (kind, key) => { const x = VERDICT[kind][key]; return x ? `<span class="verdict"><i style="background:var(${x[1]})"></i>${x[0]}</span>` : ''; };
  const a = e.all || {}, si = e.since || {};
  const day = a.day, sd = si.day;
  const card1 = day ? `<div><p class="lbl">Next day · 95% range</p>
      <p class="fig">${pct(day.hit * 100, 0)} <small>inside</small></p>${v('day', day.verdict)}
      <p class="d">${fmtInt(day.inside)} of ${fmtInt(day.n)} moves landed inside (target about 95%). Actual moves ran
      <b>${fmt(day.calib, 2)}×</b> the forecast size.${sd ? ` Since ${esc(shortDate(start))}: ${sd.inside} of ${sd.n}.` : ''}</p></div>`
    : '<div><p class="lbl">Next day</p><p class="d">No scored days yet.</p></div>';
  const hz = (key, label, wait) => {
    const x = a[key], y = si[key];
    if (!x) return `<div><p class="lbl">${label}</p><p class="fig">—</p><p class="d">${wait}</p></div>`;
    return `<div><p class="lbl">${label}</p><p class="fig">${fmt(x.mae, 1)} <small>pts average miss</small></p>${v('bias', x.verdict)}
      <p class="d">Forecasts ran <b>${signed(x.bias)} pts</b> ${x.bias >= 0 ? 'above' : 'below'} actual volatility (actual averaged ${pct(x.actual_mean, 0)}), over ${fmtInt(x.n)} forecasts.
      ${y && y.n >= 5 ? `Since ${esc(shortDate(start))}: ${fmt(y.mae, 1)} pts across ${y.n}.` : `Too few forecasts since ${esc(shortDate(start))} to score yet.`}</p></div>`;
  };
  return card1 + hz('w1', '1 week ahead', 'Scored 5 trading days after each forecast.') + hz('m2', '2 months ahead · the model\'s target', 'Scored 42 trading days after each forecast.');
}

function trackLatest(S) {
  const rows = [];
  for (let i = S.made_on.length - 1; i >= 0 && rows.length < 7; i--) {
    if (S.next_ret[i] == null) continue;
    const inside = Math.abs(S.next_ret[i]) <= S.band[i];
    rows.push(`<tr><td>${esc(longDate(S.next_date ? S.next_date[i] : S.made_on[i]))}</td><td>±${fmt(S.band[i], 1)}%</td>
      <td>${signed(S.next_ret[i], 1)}%</td><td><span class="verdict"><i style="background:var(${inside ? '--calm' : '--crisis'})"></i>${inside ? 'Inside' : 'Outside'}</span></td>
      <td>${S.source[i] === 'l' ? '<span class="tag live">Live</span>' : '<span class="tag">Reconstructed</span>'}</td></tr>`);
  }
  if (!rows.length) return '<p class="note">No next-day checks yet.</p>';
  return `<div class="tablewrap"><table class="cmp trtbl"><thead><tr><th scope="col">Day of the move</th><th scope="col">Forecast range</th>
    <th scope="col">Actual move</th><th scope="col">Result</th><th scope="col">Logged</th></tr></thead><tbody>${rows.join('')}</tbody></table></div>`;
}

const trackStartPlugin = {
  id: 'trackStart',
  afterDatasetsDraw(chart, args, opts) {
    if (!opts || opts.index == null || opts.index < 0) return;
    const { ctx, chartArea: a, scales: { x } } = chart;
    const px = x.getPixelForValue(opts.index);
    ctx.save(); ctx.strokeStyle = css('--ink-3'); ctx.setLineDash([3, 3]); ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(px, a.top); ctx.lineTo(px, a.bottom); ctx.stroke(); ctx.setLineDash([]);
    ctx.fillStyle = css('--ink-2'); ctx.font = "500 11px 'DM Mono', sans-serif";
    ctx.textAlign = 'right'; ctx.fillText('Reconstructed', px - 6, a.top + 12);
    if (a.right - px > 34) { ctx.textAlign = 'left'; ctx.fillText('Live', px + 6, a.top + 12); }
    ctx.restore();
  },
};
Chart.register(trackStartPlugin);

function drawTrackCharts(S, model) {
  chartTheme();
  const labels = S.made_on.map((d, i) => (S.next_date && S.next_date[i]) || d);
  const liveIdx = S.source.indexOf('l');
  const band = css('--s-band'), crisis = css('--crisis'), muted = css('--ink-3');
  const outside = S.next_ret.map((r, i) => r != null && Math.abs(r) > S.band[i]);
  activeCharts.push(new Chart($('#cTrDay'), {
    type: 'line',
    data: { labels, datasets: [
      { label: 'Range top', data: S.band, borderWidth: 0, pointRadius: 0, fill: '+1', backgroundColor: band, tipHide: true },
      { label: 'Range bottom', data: S.band.map(b => b == null ? null : -b), borderWidth: 0, pointRadius: 0, fill: false, tipHide: true },
      { label: 'Actual move', data: S.next_ret, showLine: false, pointRadius: outside.map(o => o ? 4.5 : 2.4),
        pointBackgroundColor: outside.map(o => o ? crisis : muted), pointBorderColor: outside.map(o => o ? crisis : muted), pointHoverRadius: 6 },
    ] },
    options: { maintainAspectRatio: false, interaction: { mode: 'index', intersect: false },
      plugins: { legend: { display: false }, trackStart: { index: liveIdx },
        tooltip: tooltipStyle({ filter: (it) => it.datasetIndex === 2 && it.raw != null,
          callbacks: { title: (it) => longDate(labels[it[0].dataIndex]),
            label: (it) => ` Move ${signed(it.raw, 2)}% vs range ±${fmt(S.band[it.dataIndex], 2)}%`,
            footer: (it) => outside[it[0].dataIndex] ? 'Outside the range' : 'Inside the range' } }) },
      scales: { x: dateAxis(labels), y: valueAxis(v => v + '%') } },
  }));

  const key = TRACK_HORIZON, col = css(TRACK_MODELS[model][1]);
  const f = S[key + '_vol'], act = S[key + '_actual'];
  activeCharts.push(new Chart($('#cTrVol'), {
    type: 'line',
    data: { labels: S.made_on, datasets: [
      { label: 'Forecast', data: f, borderColor: col, borderWidth: 2, pointRadius: 0, tension: .2 },
      { label: 'What happened', data: act, borderColor: css('--s-real'), borderWidth: 2, pointRadius: 0, tension: .2, spanGaps: false },
    ] },
    options: { maintainAspectRatio: false, interaction: { mode: 'index', intersect: false },
      plugins: { legend: { display: false }, trackStart: { index: liveIdx },
        tooltip: tooltipStyle({ callbacks: { title: (it) => 'Forecast made ' + longDate(S.made_on[it[0].dataIndex]), label: (it) => ` ${it.dataset.label}: ${pct(it.raw, 1)}` } }) },
      scales: { x: dateAxis(S.made_on), y: valueAxis(v => v + '%') } },
  }));
  const pending = act.filter(v => v == null).length;
  $('#trVolKey').innerHTML = `<span><i class="sw" style="border-color:${col}"></i> ${esc(TRACK_MODELS[model][0])} forecast, average over the next ${key === 'w1' ? '5' : '42'} trading days</span>
    <span><i class="sw" style="border-color:var(--s-real)"></i> Volatility that actually happened</span>
    ${pending ? `<span class="note">The last ${pending} forecast${pending > 1 ? 's are' : ' is'} still inside ${pending > 1 ? 'their' : 'its'} window</span>` : ''}`;
}

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
  Chart.defaults.font.family = "'DM Mono', -apple-system, sans-serif";
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
    backgroundColor: css('--tip-bg'), titleColor: css('--tip-ink'), bodyColor: css('--tip-ink'), footerColor: css('--tip-ink'),
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
    ctx.fillStyle = css('--ink-2'); ctx.font = "500 11px 'DM Mono', sans-serif";
    ctx.textAlign = 'left'; ctx.fillText('Forecast', px + 6, a.top + 12);
    ctx.textAlign = 'right'; ctx.fillText('History', px - 6, a.top + 12);
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
      ctx.font = "500 11px 'DM Mono', sans-serif"; ctx.textAlign = 'center';
      const area = chart.chartArea, placed = [];
      meta.data.forEach((pt, i) => {
        const lab = ds.moveLabels[i]; if (!lab) return;
        const half = ctx.measureText(lab.text).width / 2 + 2;
        const x = Math.max(area.left + half, Math.min(area.right - half, pt.x));
        let y = pt.y + (lab.r >= 0 ? -12 : 18);
        // try the other side of the point before giving up on a colliding label
        const clash = (yy) => placed.some(([px, py]) => Math.abs(px - x) < half * 2 && Math.abs(py - yy) < 13);
        if (clash(y)) y = pt.y + (lab.r >= 0 ? 18 : -12);
        if (clash(y)) return;
        placed.push([x, y]);
        ctx.lineWidth = 3; ctx.strokeStyle = css('--card'); ctx.strokeText(lab.text, x, y);
        ctx.fillStyle = css('--ink'); ctx.fillText(lab.text, x, y);
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
        ctx.globalAlpha = 1; ctx.font = "500 11px 'DM Mono', sans-serif"; ctx.textAlign = 'left';
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
      ctx.font = "500 11px 'DM Mono', sans-serif";
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
          { label: 'TimesFM', data: fut(s.timesfm_alone_path), borderColor: css('--s-tf'), borderDash: [3, 3], borderWidth: 2, pointRadius: 0, pointHoverRadius: 4, tension: .2 },
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
          regimeBands: { labels: P.dates, alpha: 0.1 },
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
    ${isNum(info.bid) ? `<span>Bid <b>${money(info.bid)}</b> · Ask <b>${money(info.ask)}</b></span><span class="muted">bid/ask as of the latest daily run</span>` : ''}
    <span class="muted">${TOUCH() ? "Touch" : "Move across"} the chart for any day</span>`;
}
function volReadoutDefault(st) {
  return `<b>Forecast, next ~2 months</b>
    <span>EGARCH <b>${pct(st.eg)}</b></span><span>TimesFM <b>${pct(st.tf)}</b></span><span>+ sector <b>${pct(st.tfT)}</b></span>
    <span class="muted">Recent ${pct(st.recent)} · ${TOUCH() ? "touch" : "move across"} the chart for any day</span>`;
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
  const ds = (k, i) => ({ label: k, data: r[k].map(v => isNum(v) ? v * 100 : null), borderColor: regimeColor(k), backgroundColor: regimeColor(k) + (k === 'Stressed' ? '14' : k === 'Calm' ? '38' : '55'), fill: i === 0 ? 'origin' : '-1', borderWidth: compact ? 1.2 : 1.5, pointRadius: 0, pointHoverRadius: 0, stack: 'r', tension: .25 });
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
    <h1>How the eight <span>move together.</span></h1>
    <p>The market regime, how much of each airline's risk is shared with the sector, and what that means for a
    portfolio holding all eight.</p>`));

  if (reg) {
    const sec = el('section', { class: 'card', 'aria-labelledby': 'regTitle' });
    sec.innerHTML = `<div class="cc-head" style="display:flex;justify-content:space-between;gap:1rem;flex-wrap:wrap;margin-bottom:.6rem">
      <div><h2 id="regTitle" class="asT">Market ${termLink('regime', 'Regime')}, past 12 months</h2>
      <p class="sub" style="margin:0">Stacked daily probability of each state from the ${termLink('HMM')}. Lines mark when the most likely state changed.</p></div></div>
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
  seg.innerHTML = `<button type="button" data-w="equal" aria-pressed="true">Equal weights</button><button type="button" data-w="inv" aria-pressed="false">Weighted by inverse volatility</button>`;
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
    <p class="note" style="margin:.7rem 0 0">The first component, the shared “airline factor”, explains <b>${pct(pc1 * 100, 0)}</b>. The carriers largely move as one, so combining them removes only part of the risk.</p>`;
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
    data: { labels, datasets: [{ data: pf.pca_explained.map(v => v * 100), backgroundColor: pf.pca_explained.map((_, i) => i === 0 ? css('--s-tf2') : css('--s-vol')), borderRadius: 4, borderWidth: 0 }] },
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
  const lum = (rgb) => { const f = (x) => { x /= 255; return x <= .03928 ? x / 12.92 : Math.pow((x + .055) / 1.055, 2.4); }; return .2126 * f(rgb[0]) + .7152 * f(rgb[1]) + .0722 * f(rgb[2]); };
  const inkOn = (v) => lum(colorOf(v).match(/\d+/g).map(Number)) > .179 ? '#000000' : '#ffffff';
  const words = (v) => v >= .85 ? 'move together very closely' : v >= .7 ? 'move together closely' : v >= .5 ? 'move together moderately' : 'move together loosely';
  let html = `<table class="heat"><caption style="position:absolute;left:-9999px">Return correlation matrix</caption><thead><tr><td></td>${t.map(x => `<th scope="col">${x}</th>`).join('')}</tr></thead><tbody>`;
  t.forEach((a, i) => {
    html += `<tr><th scope="row">${a}</th>`;
    t.forEach((b, j) => {
      const v = (pf.correlation[a] || [])[j];
      if (i === j) html += `<td class="diag" data-i="${i}" data-j="${j}">1.00</td>`;
      else html += `<td tabindex="${i === 0 && j === 1 ? 0 : -1}" data-i="${i}" data-j="${j}" data-v="${v}" style="background:${colorOf(v)};color:${inkOn(v)}" aria-label="${a} and ${b}: ${fmt(v)}">${fmt(v)}</td>`;
    });
    html += '</tr>';
  });
  html += '</tbody></table>';
  box.innerHTML = html;
  $('#heatLegend').innerHTML = `<span>${fmt(lo)}</span><span class="heat-bar"></span><span>${fmt(hi)}</span><span>· scale fitted to this matrix; the diagonal is each stock with itself</span>`;

  const table = $('.heat', box);
  table.addEventListener('keydown', (e) => {
    const td = e.target.closest('td[data-v]'); if (!td) return;
    const d = { ArrowLeft: [0, -1], ArrowRight: [0, 1], ArrowUp: [-1, 0], ArrowDown: [1, 0] }[e.key]; if (!d) return;
    e.preventDefault();
    let i = +td.dataset.i + d[0], j = +td.dataset.j + d[1];
    if (i === j) { i += d[0]; j += d[1]; }
    const next = $(`td[data-i="${i}"][data-j="${j}"]`, table); if (!next) return;
    td.tabIndex = -1; next.tabIndex = 0; next.focus();
  });
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
   LAB
   ============================================================ */
function renderLab(view) {
  view.appendChild(el('header', { class: 'pagehead' }, `
    <h1>Forecasting methods, <span>from regression to transformers.</span></h1>
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
      <div class="act"><span class="tag soon">Study module, not interactive yet</span></div>`)));
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
    ['Track record', 'How Sentinel scores its own forecasts. Each day every model’s forecast is logged before the outcome exists. Next day: does the move land inside the forecast’s 95% range (it should about 95% of the time)? One week and two months: how far forecast volatility was from the volatility that actually happened. Earlier days are reconstructed walk-forward, using only prices available on each day.'],
    ['Backtest', 'Testing a model on past data as if it were run at the time, using only information available then. Sentinel’s reconstructed track record is a walk-forward backtest.'],
    ['Calibration', 'Whether a model’s stated uncertainty matches reality. If a 95% range catches far fewer than 95% of outcomes, the model underestimates risk; if it catches nearly all of them, it overestimates.'],
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
    <h1>Plain-English <span>definitions.</span></h1>
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
    box.innerHTML = `<a class="now" href="#/glossary/regime" data-def="regime" aria-label="Market regime today: ${esc(reg.name)}, ${pct(reg.p * 100, 0)} likely">${esc(reg.name)} <span>${pct(reg.p * 100, 0)}</span></a>
      <div class="bar" role="img" aria-label="${REGIMES.map(k => `${k} ${pct((reg.all[k] || 0) * 100, 0)}`).join(', ')}">${REGIMES.map(k => `<i style="width:${((reg.all[k] || 0) * 100).toFixed(1)}%;background:${regimeColor(k)}"></i>`).join('')}</div>`;
  }
  const d = dataDate();
  $('#asofChip').innerHTML = `<i aria-hidden="true"></i>Data as of ${esc(longDate(d))}`;
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
  // the hash drives the router, so the disclaimer link scrolls instead of navigating
  document.addEventListener('click', (e) => { const a = e.target.closest('a[data-nfa]'); if (!a) return; e.preventDefault(); const d = $('#disclaimer'); d.scrollIntoView({ behavior: 'smooth', block: 'center' }); d.focus({ preventScroll: true }); });
  // glossary definitions on hover / focus anywhere
  bindTip(document.body, '[data-def]', (n) => { const g = GLOSS_INDEX[n.dataset.def]; return g ? `<span class="t-h">${esc(g[0])}</span>${esc(g[1])}<span class="t-n">Click for the glossary</span>` : ''; });
  window.addEventListener('hashchange', () => router());
  try {
    const res = await fetch('data/sentinel_data.json', { cache: 'no-store' });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    DATA = await res.json();
  } catch (e) {
    $('#view').innerHTML = `<div class="errorbox"><h2>Couldn't load the research data</h2>
      <p>Check your connection and try again.</p>
      <p><button class="btn primary" type="button" onclick="location.reload()">Try again</button></p>
      <details class="note"><summary>Technical details</summary><p>${esc(e.message)}. The site reads <code>data/sentinel_data.json</code>; opened straight from disk, browsers block that, so run <code>python -m http.server</code>.</p></details></div>`;
    return;
  }
  computeStats();
  drawSidebar();
  if (DATA.generated) $('#footGenerated').textContent = 'Data generated ' + DATA.generated;
  router();
}
boot();
