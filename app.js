/* ============================================================
   Sentinel — single-page research site
   Loads sentinel_data.json (produced by the Colab notebook)
   and renders Overview / Lab / Stocks / Globe / Portfolio / Glossary.
   ============================================================ */

'use strict';

/* ---------- global data ---------- */
let DATA = null;

/* Company one-liners (used where Yahoo's summary is missing). */
const AIRLINE_NAMES = {
  DAL: 'Delta Air Lines', AAL: 'American Airlines', UAL: 'United Airlines',
  LUV: 'Southwest Airlines', ALK: 'Alaska Air Group', JBLU: 'JetBlue Airways',
  ULCC: 'Frontier (Frontier Group)', ALGT: 'Allegiant Travel',
};

/* Fallback composite (news / delays / fuel) — your combine.py example
   output, used only when sentinel_data.json has no composite block.
   Replace it by dragging a composite_<date>.csv into Colab before export. */
const COMPOSITE_FALLBACK = {
  _file: 'composite_2026-09-20.csv (example — not live)',
  DAL:  { signal:'BULLISH',      total_score:0.504,  rank:1, vol_regime:'CALM',   regime:'Quiet strength (calm vol + positive flow)', operations_z:0.255, news_z:-0.235, fuel_z:1.770, disruption_2d:25.33, delay_rank:5, news_n:133, news_vader:0.087, news_neg_share:0.203, fuel_beta:-0.316, fuel_impact:-0.018 },
  ALGT: { signal:'LEAN BULLISH', total_score:0.267,  rank:2, vol_regime:'STABLE', regime:'Quiet strength (calm vol + positive flow)', operations_z:0.804, news_z:2.041,  fuel_z:-1.365, disruption_2d:17.60, delay_rank:7, news_n:20,  news_vader:0.431, news_neg_share:0.050, fuel_beta:-0.534, fuel_impact:-0.116 },
  ALK:  { signal:'NEUTRAL',      total_score:0.099,  rank:3, vol_regime:'STABLE', regime:'Quiet strength (calm vol + positive flow)', operations_z:0.905, news_z:0.130,  fuel_z:-0.670, disruption_2d:18.12, delay_rank:6, news_n:101, news_vader:0.142, news_neg_share:0.139, fuel_beta:-0.493, fuel_impact:-0.095 },
  UAL:  { signal:'NEUTRAL',      total_score:0.013,  rank:4, vol_regime:'STABLE', regime:'Complacent / no edge', operations_z:-0.663, news_z:0.868,  fuel_z:0.198, disruption_2d:35.39, delay_rank:1, news_n:104, news_vader:0.254, news_neg_share:0.173, fuel_beta:-0.442, fuel_impact:-0.067 },
  LUV:  { signal:'NEUTRAL',      total_score:-0.005, rank:5, vol_regime:'STABLE', regime:'Complacent / no edge', operations_z:-0.572, news_z:-0.144, fuel_z:1.041, disruption_2d:30.49, delay_rank:3, news_n:103, news_vader:0.101, news_neg_share:0.204, fuel_beta:-0.392, fuel_impact:-0.041 },
  ULCC: { signal:'BEARISH',      total_score:-0.697, rank:6, vol_regime:'STABLE', regime:'Not yet repriced (calm vol + negative flow)', operations_z:-0.662, news_z:-1.201, fuel_z:-0.007, disruption_2d:29.93, delay_rank:4, news_n:60,  news_vader:-0.059, news_neg_share:0.400, fuel_beta:-0.454, fuel_impact:-0.074 },
  AAL:  { signal:'BEARISH',      total_score:-0.713, rank:7, vol_regime:'STABLE', regime:'Not yet repriced (calm vol + negative flow)', operations_z:-0.871, news_z:-1.220, fuel_z:0.211, disruption_2d:33.20, delay_rank:2, news_n:109, news_vader:-0.062, news_neg_share:0.349, fuel_beta:-0.441, fuel_impact:-0.067 },
  JBLU: { signal:'BEARISH',      total_score:-0.780, rank:8, vol_regime:'STABLE', regime:'Not yet repriced (calm vol + negative flow)', operations_z:0.804, news_z:-0.239, fuel_z:-1.178, disruption_2d:17.60, delay_rank:7, news_n:39,  news_vader:0.086, news_neg_share:0.231, fuel_beta:-0.523, fuel_impact:-0.110 },
};

/* ---------- small helpers ---------- */
const $ = (sel, root = document) => root.querySelector(sel);
const el = (tag, attrs = {}, html = '') => {
  const n = document.createElement(tag);
  for (const k in attrs) {
    if (k === 'class') n.className = attrs[k];
    else if (k === 'html') n.innerHTML = attrs[k];
    else n.setAttribute(k, attrs[k]);
  }
  if (html) n.innerHTML = html;
  return n;
};
const fmt = (x, d = 2) => (x === null || x === undefined || Number.isNaN(x)) ? '—' : Number(x).toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
const fmtInt = (x) => (x === null || x === undefined) ? '—' : Math.round(x).toLocaleString('en-US');
const money = (x) => (x === null || x === undefined) ? '—' : '$' + fmt(x, 2);
const pct = (x, d = 1) => (x === null || x === undefined) ? '—' : fmt(x, d) + '%';
const bigMoney = (x) => {
  if (x === null || x === undefined) return '—';
  const a = Math.abs(x);
  if (a >= 1e12) return '$' + fmt(x / 1e12, 2) + 'T';
  if (a >= 1e9) return '$' + fmt(x / 1e9, 2) + 'B';
  if (a >= 1e6) return '$' + fmt(x / 1e6, 2) + 'M';
  return money(x);
};
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

function composite(sym) {
  const live = DATA && DATA.composite && DATA.composite[sym];
  if (live && Object.keys(live).length) return { row: live, live: true, file: DATA.composite_file };
  return { row: COMPOSITE_FALLBACK[sym] || null, live: false, file: COMPOSITE_FALLBACK._file };
}
function signalClass(sig) {
  if (!sig) return 'sig-neutral';
  const s = sig.toUpperCase();
  if (s.includes('BULL')) return 'sig-bull';
  if (s.includes('BEAR')) return 'sig-bear';
  return 'sig-neutral';
}

/* ============================================================
   ROUTER
   ============================================================ */
const ROUTES = {
  overview: renderOverview,
  lab: renderLab,
  stocks: renderStocks,
  globe: renderGlobe,
  portfolio: renderPortfolio,
  glossary: renderGlossary,
};
let activeCharts = [];
function destroyCharts() { activeCharts.forEach(c => { try { c.destroy(); } catch (e) {} }); activeCharts = []; }

function router() {
  destroyCharts();
  const hash = location.hash.replace(/^#\/?/, '') || 'overview';
  const [tab, arg] = hash.split('/');
  const fn = ROUTES[tab] || renderOverview;
  const view = $('#view');
  view.innerHTML = '';
  // highlight tab
  document.querySelectorAll('#tabs a').forEach(a => a.classList.toggle('active', a.dataset.tab === tab));
  $('#tabs').classList.remove('open');
  try {
    fn(view, arg);
  } catch (e) {
    view.innerHTML = '<div class="placeholder"><h2>Something went wrong</h2><p class="mono">' + esc(e.message) + '</p></div>';
    console.error(e);
  }
  view.focus();
  window.scrollTo(0, 0);
}

/* ============================================================
   OVERVIEW
   ============================================================ */
function renderOverview(view) {
  const g = DATA.generated || '';
  view.appendChild(el('section', { class: 'hero' }, `
    <div class="eyebrow">Investment research · Economics · Statistics · Data</div>
    <h1>Reading the risk the market hasn't priced yet.</h1>
    <p class="lead">Sentinel is a research and education studio that models <b>how volatile stocks will be</b> —
    not which way they'll go. We combine classical econometrics with modern machine-learning forecasters,
    then layer on the real-world signals that move a sector: fuel costs, operations and the news.
    Our first coverage universe is the eight major U.S. airlines.</p>
    <div class="pillrow">
      <span class="pill"><b>8</b> airlines covered</span>
      <span class="pill"><b>4</b> forecasting models</span>
      <span class="pill">horizon <b>${esc(DATA.horizon_label || '~2 months')}</b></span>
      <span class="pill">data as of <b>${esc(g.split(' ')[0] || '—')}</b></span>
    </div>
  `));

  // What we do
  view.appendChild(el('section', { class: 'section' }, `
    <div class="eyebrow">What we do</div>
    <h2>Volatility, decomposed</h2>
    <div class="grid cols-3" style="margin-top:1.2rem">
      <div class="card"><div class="kicker">Forecast</div><h3>How big, not which way</h3>
        <p>Returns are nearly impossible to predict. <em>Volatility</em> is not: it clusters and mean-reverts.
        We forecast the size of the next ~2 months of movement for each stock.</p></div>
      <div class="card"><div class="kicker">Decompose</div><h3>Sector vs. stock-specific</h3>
        <p>Airlines move together. PCA splits each stock's risk into the part driven by the whole sector
        and the part that is unique to the company.</p></div>
      <div class="card"><div class="kicker">Contextualize</div><h3>Why the risk is pointed where it is</h3>
        <p>EGARCH says how large the swings will be; alternative data — fuel, operations, news —
        suggests the direction that energy is leaning.</p></div>
    </div>
  `));

  // Models
  const models = el('section', { class: 'section' });
  models.innerHTML = `<div class="eyebrow">The models we use</div>
    <h2>A four-model stack</h2>
    <p class="lead">Each stock is run through four forecasters, plus two analytical layers. Explore them in the
    <a href="#/lab">Lab</a>.</p>`;
  const strip = el('div', { class: 'prodstrip', style: 'margin-top:1.3rem' });
  [
    ['EGARCH', 'Econometric', 'Models volatility clustering and the asymmetry where bad news raises risk more than good news.'],
    ['TimesFM-3', 'Foundation model', "Google's pre-trained time-series transformer, used zero-shot on each stock's volatility series."],
    ['HMM', 'Regime detection', 'A hidden Markov model sorts the market into Calm / Stressed / Crisis states.'],
    ['PCA', 'Risk decomposition', 'Principal component analysis separates sector-wide risk from stock-specific risk.'],
  ].forEach(([ab, tag, desc]) => {
    strip.appendChild(el('div', { class: 'card' }, `<div class="kicker">${tag}</div><div class="abbr">${ab}</div><p style="margin-top:.5rem">${desc}</p>`));
  });
  models.appendChild(strip);
  view.appendChild(models);

  // Data + how we get it
  const data = el('section', { class: 'section' });
  data.innerHTML = `<div class="eyebrow">The data &amp; how we get it</div>
    <h2>Market data, plus three alternative signals</h2>`;
  const tbl = el('table', { class: 'srctable', style: 'margin-top:1rem' });
  tbl.innerHTML = `
    <thead><tr><th>Signal</th><th>Source</th><th>How we collect it</th><th>Cadence</th></tr></thead>
    <tbody>
      <tr><td>Prices &amp; returns</td><td class="src">yfinance</td><td>Daily OHLCV for all 8 tickers back to 2018, including the COVID shock.</td><td>Daily</td></tr>
      <tr><td>Volatility regime</td><td class="src">HMM</td><td>A 3-state hidden Markov model over the sector's daily returns.</td><td>Daily</td></tr>
      <tr><td>Fuel pressure</td><td class="src">WTI crude (CL=F)</td><td>Crude momentum &amp; range, scaled by each airline's own fuel beta.</td><td>Daily</td></tr>
      <tr><td>News sentiment</td><td class="src">Yahoo / Google News</td><td>Headlines scored with a finance-tuned VADER lexicon, recency-weighted.</td><td>Daily</td></tr>
      <tr><td>Operations</td><td class="src">FlightAware</td><td>Delay &amp; cancellation rates, with regional subsidiaries folded into the parent.</td><td>Daily</td></tr>
      <tr><td>Social (optional)</td><td class="src">Reddit</td><td>Subreddit &amp; finance-forum posts, weighted by engagement.</td><td>Daily</td></tr>
    </tbody>`;
  data.appendChild(tbl);
  view.appendChild(data);

  // Sandbox pointer
  view.appendChild(el('section', { class: 'section' }, `
    <div class="eyebrow">The sandbox</div>
    <h2>A lab for trying models</h2>
    <p class="lead">The <a href="#/lab">Lab</a> is where we document the forecasting methods — from linear
    regression to transformers — and, in time, let you run them yourself on the airline universe.
    The interactive experiments are in development; the methods are described there now.</p>
    <a class="btn primary" href="#/lab" style="margin-top:.6rem">Open the Lab →</a>
  `));

  // Math note
  view.appendChild(el('section', { class: 'section' }, `
    <div class="eyebrow">Grounded in math</div>
    <h2>Everything here is reproducible</h2>
    <p class="lead">No black boxes we can't explain. Each forecast traces back to a published method —
    EGARCH, hidden Markov models, PCA, and an open foundation model — run in a single notebook whose
    output powers this entire site. See a term you don't know? The <a href="#/glossary">Glossary</a> defines them.</p>
  `));
}

/* ============================================================
   LAB
   ============================================================ */
function renderLab(view) {
  view.appendChild(el('section', { class: 'hero' }, `
    <div class="eyebrow">The Lab</div>
    <h1>Forecasting methods, from regression to transformers.</h1>
    <p class="lead">A catalogue of the models the field uses to forecast financial time series. The four in our
    production stack are marked <b>In production</b>; the rest are study modules. Interactive runs are coming soon.</p>
  `));

  const groups = [
    {
      head: 'Classical statistical models', sub: 'Baseline trend & stationary time-series assumptions',
      models: [
        ['LR', 'Linear Regression', 'The simplest baseline: fit a straight-line relationship between a target and its predictors. Fast, fully interpretable, and a useful yardstick that any fancier model must beat.'],
        ['ARIMA', 'AutoRegressive Integrated Moving Average', 'Models a series from its own past values and past errors after differencing to remove trend. The workhorse of classical forecasting for stationary data.'],
      ],
    },
    {
      head: 'Deep learning & neural networks', sub: 'Sequential and non-linear patterns',
      models: [
        ['LSTM', 'Long Short-Term Memory', 'A recurrent network with gated memory that learns long-range dependencies in sequences — well suited to volatility that depends on events weeks earlier.'],
        ['Transformer', 'Attention-based sequence model', 'Uses self-attention to weigh every past point when forecasting the next. The architecture behind foundation models like TimesFM, which we run in production.'],
      ],
    },
    {
      head: 'Ensemble & machine-learning methods', sub: 'Many weak learners combined',
      models: [
        ['RF', 'Random Forest', 'Averages hundreds of decision trees trained on random data subsets. Robust to noise and overfitting, and it ranks which features matter most.'],
        ['XGBoost', 'Gradient-Boosted Trees', 'Builds trees sequentially, each correcting the last. A perennial winner on tabular forecasting problems and a strong non-linear benchmark.'],
      ],
    },
  ];

  groups.forEach(gr => {
    const sec = el('section', { class: 'labgroup' });
    sec.appendChild(el('div', { class: 'grouphead' }, `<h3>${gr.head}</h3><span>${gr.sub}</span>`));
    const grid = el('div', { class: 'grid cols-2' });
    gr.models.forEach(([ab, name, desc]) => {
      const c = el('div', { class: 'card modelcard' });
      c.innerHTML = `<span class="tag">Study module</span>
        <h4>${name} <span class="abbr">${ab}</span></h4>
        <p>${desc}</p>
        <button class="btn disabled" disabled>Open model <span class="badge-soon">· soon</span></button>`;
      grid.appendChild(c);
    });
    sec.appendChild(grid);
    view.appendChild(sec);
  });

  // production models
  const prod = el('section', { class: 'labgroup' });
  prod.appendChild(el('div', { class: 'grouphead' }, `<h3>In production at Sentinel</h3><span>Powering the Stocks &amp; Portfolio pages today</span>`));
  const grid = el('div', { class: 'grid cols-2' });
  [
    ['EGARCH', 'Exponential GARCH', 'Our primary volatility forecaster. Captures volatility clustering and the leverage effect — negative returns raise future volatility more than positive ones of the same size.'],
    ['TimesFM-3', 'Time-series foundation model', "Google Research's pre-trained transformer, applied zero-shot to each airline's rolling-volatility series — alone, and jointly with the sector as a covariate."],
    ['HMM', 'Hidden Markov Model', 'Classifies the market into Calm / Stressed / Crisis regimes from the sector return, giving today\'s probability of each state.'],
    ['PCA', 'Principal Component Analysis', 'Decomposes the 8-stock covariance into a shared sector factor and stock-specific residuals, on a rolling window.'],
  ].forEach(([ab, name, desc]) => {
    const c = el('div', { class: 'card modelcard' });
    c.innerHTML = `<span class="tag" style="color:var(--accent-2);border-color:var(--accent-2)">In production</span>
      <h4>${name} <span class="abbr" style="color:var(--accent-2)">${ab}</span></h4>
      <p>${desc}</p>
      <a class="btn" href="#/stocks">See it on a stock →</a>`;
    grid.appendChild(c);
  });
  prod.appendChild(grid);
  view.appendChild(prod);
}

/* ============================================================
   STOCKS
   ============================================================ */
function renderStocks(view, arg) {
  if (arg && DATA.stocks[arg]) return renderStockDetail(view, arg);

  view.appendChild(el('section', { class: 'hero' }, `
    <div class="eyebrow">Stocks · U.S. airlines</div>
    <h1>Eight carriers, one lens.</h1>
    <p class="lead">Pick a stock for its full volatility analysis: price &amp; trend, a 2-month EGARCH and
    TimesFM forecast, the alternative-data read, and an auto-generated narrative.</p>
  `));

  const bar = el('div', { class: 'stockbar' });
  bar.innerHTML = `<label for="stockSelect">Jump to</label>`;
  const sel = el('select', { id: 'stockSelect' });
  sel.appendChild(el('option', { value: '' }, 'Select an airline…'));
  DATA.tickers.forEach(t => sel.appendChild(el('option', { value: t }, `${t} — ${AIRLINE_NAMES[t] || t}`)));
  sel.addEventListener('change', () => { if (sel.value) location.hash = '#/stocks/' + sel.value; });
  bar.appendChild(sel);
  view.appendChild(bar);

  const grid = el('div', { class: 'tickergrid' });
  DATA.tickers.forEach(t => {
    const s = DATA.stocks[t];
    const fa = s.forecast_avg || {};
    const comp = composite(t).row;
    const sig = comp ? comp.signal : null;
    const card = el('a', { class: 'tickercard', href: '#/stocks/' + t });
    card.innerHTML = `
      <div class="sym">${t}</div>
      <div class="nm">${esc((s.info && (s.info.shortName)) || AIRLINE_NAMES[t] || '')}</div>
      <div class="fc">2-mo vol · EGARCH ${pct(fa.egarch)} · TimesFM ${pct(fa.timesfm_alone)}</div>
      ${sig ? `<span class="sig ${signalClass(sig)}">${esc(sig)}</span>` : ''}`;
    grid.appendChild(card);
  });
  view.appendChild(grid);

  view.appendChild(el('p', { class: 'note', style: 'margin-top:1.4rem' },
    'Forecasts are annualized volatility averaged over the next ~2 months. Signals come from the alternative-data composite and describe flow, not a price target.'));
}

function renderStockDetail(view, sym) {
  const s = DATA.stocks[sym];
  const info = s.info || {};
  const fa = s.forecast_avg || {};
  const name = info.longName || info.shortName || AIRLINE_NAMES[sym] || sym;
  const price = info.currentPrice ?? info.regularMarketPrice;

  view.appendChild(el('a', { class: 'backlink', href: '#/stocks' }, '← All stocks'));

  const head = el('div', { class: 'stock-head' });
  head.innerHTML = `
    <div><div class="sym">${sym}</div></div>
    <div class="nm">${esc(name)}</div>
    <div class="px">
      <div class="big">${money(price)}</div>
      <div class="sub">bid ${fmt(info.bid)} · ask ${fmt(info.ask)}</div>
    </div>`;
  view.appendChild(head);

  if (info.longBusinessSummary) {
    const sumShort = info.longBusinessSummary.split('. ').slice(0, 2).join('. ') + '.';
    view.appendChild(el('p', { class: 'lead', style: 'margin-bottom:1.4rem' }, esc(sumShort)));
  }

  // metrics
  const metrics = el('div', { class: 'metrics' });
  const peg = info.pegRatio ?? info.trailingPegRatio;
  [
    ['Market cap', bigMoney(info.marketCap)],
    ['P/E (trailing)', fmt(info.trailingPE)],
    ['P/E (forward)', fmt(info.forwardPE)],
    ['PEG ratio', peg == null ? 'N/A' : fmt(peg)],
    ['Beta', fmt(info.beta)],
    ['52-wk high', money(info.fiftyTwoWeekHigh)],
    ['52-wk low', money(info.fiftyTwoWeekLow)],
    ['Avg volume', fmtInt(info.averageVolume)],
  ].forEach(([k, v]) => metrics.appendChild(el('div', { class: 'metric' }, `<div class="k">${k}</div><div class="v">${v}</div>`)));
  view.appendChild(metrics);

  // price chart
  view.appendChild(sectionTitle('Price &amp; trend', 'Last 12 months of closing price with 50- and 200-day moving averages, and daily volume.'));
  const priceWrap = el('div', { class: 'chartwrap' });
  priceWrap.innerHTML = `<div class="canvas-box"><canvas id="cPrice"></canvas></div>
    <div class="canvas-box short" style="margin-top:.4rem"><canvas id="cVol"></canvas></div>
    <div class="keyrow">
      <span><i class="swatch" style="background:var(--accent)"></i> Close</span>
      <span><i class="swatch" style="background:var(--accent-2)"></i> 50-day MA</span>
      <span><i class="swatch" style="background:#8aa0c8"></i> 200-day MA</span>
      <span><i class="swatch" style="background:#39506f"></i> Volume</span>
    </div>`;
  view.appendChild(priceWrap);

  // forecast charts
  view.appendChild(sectionTitle('Volatility forecast — EGARCH', 'Recent realized volatility (20-day, annualized) and the EGARCH forecast for the next ~2 months.'));
  const egWrap = el('div', { class: 'chartwrap' });
  egWrap.innerHTML = `<div class="canvas-box"><canvas id="cEg"></canvas></div>
    <div class="keyrow">
      <span><i class="swatch" style="background:#8aa0c8"></i> Realized volatility</span>
      <span><i class="swatch dash" style="border-color:var(--accent)"></i> EGARCH forecast</span>
      <span>avg forecast: <b>${pct(fa.egarch)}</b></span>
    </div>`;
  view.appendChild(egWrap);

  view.appendChild(sectionTitle('Volatility forecast — TimesFM-3', 'The foundation model run two ways: each stock alone, and jointly with the sector as a covariate.'));
  const tfWrap = el('div', { class: 'chartwrap' });
  tfWrap.innerHTML = `<div class="canvas-box"><canvas id="cTf"></canvas></div>
    <div class="keyrow">
      <span><i class="swatch" style="background:#8aa0c8"></i> Realized volatility</span>
      <span><i class="swatch dash" style="border-color:var(--bull)"></i> TimesFM (alone)</span>
      <span><i class="swatch dash" style="border-color:var(--accent-2)"></i> TimesFM (together)</span>
      <span>avg: <b>${pct(fa.timesfm_alone)}</b> / <b>${pct(fa.timesfm_together)}</b></span>
    </div>`;
  view.appendChild(tfWrap);

  // alternative data
  const cdat = composite(sym);
  if (cdat.row) {
    const c = cdat.row;
    view.appendChild(sectionTitle('Alternative-data read', 'Fuel, news and operations — standardized across the 8 airlines (positive = bullish flow).'));
    const alt = el('div', { class: 'altgrid' });
    [
      ['Fuel (WTI)', fmt(c.fuel_z), `beta ${fmt(c.fuel_beta)} · impact ${fmt(c.fuel_impact)}`],
      ['News', fmt(c.news_z), `${fmtInt(c.news_n)} headlines · ${pct((c.news_neg_share || 0) * 100, 0)} negative`],
      ['Operations', fmt(c.operations_z), `disruption ${fmt(c.disruption_2d)} · delay rank #${fmtInt(c.delay_rank)}`],
    ].forEach(([k, v, d]) => alt.appendChild(el('div', { class: 'altbox' }, `<div class="k">${k} (z)</div><div class="v">${v}</div><div class="d">${d}</div>`)));
    view.appendChild(alt);
    if (!cdat.live) view.appendChild(el('p', { class: 'note' }, `Alternative-data shown from ${esc(cdat.file)}. Include a live composite_&lt;date&gt;.csv in the notebook export to replace it.`));
  }

  // narrative
  view.appendChild(el('div', { class: 'narrative' }, buildNarrative(sym)));

  // draw after DOM in place
  requestAnimationFrame(() => drawStockCharts(sym));
}

function sectionTitle(h, cap) {
  return el('div', { style: 'margin:2rem 0 .8rem' }, `<h3 style="margin-bottom:.2rem">${h}</h3><p class="note" style="font-style:normal;margin:0">${cap}</p>`);
}

/* ---- narrative generator (one template, numbers swapped) ---- */
function buildNarrative(sym) {
  const s = DATA.stocks[sym];
  const fa = s.forecast_avg || {};
  const name = (s.info && s.info.shortName) || AIRLINE_NAMES[sym] || sym;
  const rv = s.realized_vol && s.realized_vol.values ? s.realized_vol.values.filter(v => v != null) : [];
  const recent = rv.length ? rv[rv.length - 1] : null;
  const eg = fa.egarch, tf = fa.timesfm_alone, tfT = fa.timesfm_together;
  const reg = DATA.regimes && DATA.regimes.current ? DATA.regimes.current : null;
  const cdat = composite(sym); const c = cdat.row;

  const dir = (eg != null && recent != null)
    ? (eg > recent * 1.08 ? 'higher than' : eg < recent * 0.92 ? 'lower than' : 'in line with')
    : 'compared with';
  const spread = (eg != null && tf != null) ? Math.abs(eg - tf) : null;
  const agree = spread == null ? '' : (spread < 3 ? 'The two models broadly agree.' : spread < 8 ? 'The models differ moderately.' : 'The models disagree sharply, so treat the range as wide.');

  let regimeLine = '';
  if (reg) {
    const top = Object.entries(reg).sort((a, b) => b[1] - a[1])[0];
    regimeLine = ` The market-wide regime model currently reads <b>${top[0]}</b> (${pct(top[1] * 100, 0)} probability), which is the backdrop for every airline.`;
  }

  let altLine = '';
  if (c) {
    const parts = [];
    if (c.fuel_z != null) parts.push(`fuel ${c.fuel_z >= 0 ? 'a tailwind' : 'a headwind'}`);
    if (c.news_z != null) parts.push(`news flow ${c.news_z >= 0.15 ? 'positive' : c.news_z <= -0.15 ? 'negative' : 'neutral'}`);
    if (c.operations_z != null) parts.push(`operations ${c.operations_z >= 0 ? 'cleaner than peers' : 'more disrupted than peers'}`);
    altLine = ` On the alternative data, the composite tags ${sym} <b class="${signalClass(c.signal)}" style="padding:.05rem .35rem;border-radius:5px">${esc(c.signal)}</b> — ${parts.join(', ')}. In words: ${esc((c.regime || '').toLowerCase())}.`;
  }

  return `<h3>What the models say about ${esc(name)}</h3>
    <p>Over the next <b>~2 months</b>, EGARCH forecasts annualized volatility of about <b>${pct(eg)}</b>,
    ${dir} the recent realized level of <b>${pct(recent)}</b>. TimesFM-3 puts it near <b>${pct(tf)}</b> on its own
    and <b>${pct(tfT)}</b> when it also sees the sector. ${agree}${regimeLine}</p>
    <p>${altLine}</p>
    <p class="asof">Auto-generated from model output · data as of ${esc((DATA.generated || '').split(' ')[0])} · not financial advice.</p>`;
}

/* ---- charts ---- */
const CHART_FONT = { family: "'JetBrains Mono', monospace", size: 10 };
function baseScales(yTitle) {
  return {
    x: { grid: { color: 'rgba(255,255,255,.04)' }, ticks: { color: '#74809a', font: CHART_FONT, maxTicksLimit: 8, maxRotation: 0 } },
    y: { grid: { color: 'rgba(255,255,255,.05)' }, ticks: { color: '#74809a', font: CHART_FONT }, title: { display: !!yTitle, text: yTitle, color: '#74809a', font: CHART_FONT } },
  };
}
const noLegend = { legend: { display: false }, tooltip: { enabled: true, mode: 'index', intersect: false, backgroundColor: '#0f1420', borderColor: '#243049', borderWidth: 1, titleColor: '#e8edf7', bodyColor: '#aeb9cf', titleFont: CHART_FONT, bodyFont: CHART_FONT } };

function drawStockCharts(sym) {
  const s = DATA.stocks[sym];
  const P = s.price;
  // price
  activeCharts.push(new Chart($('#cPrice'), {
    type: 'line',
    data: {
      labels: P.dates,
      datasets: [
        { label: 'Close', data: P.close, borderColor: '#5fd4c4', backgroundColor: 'rgba(95,212,196,.08)', fill: true, borderWidth: 1.6, pointRadius: 0, tension: .15 },
        { label: '50-day MA', data: P.ma50, borderColor: '#e9b45f', borderWidth: 1.2, pointRadius: 0, tension: .15 },
        { label: '200-day MA', data: P.ma200, borderColor: '#8aa0c8', borderWidth: 1.2, pointRadius: 0, tension: .15 },
      ],
    },
    options: { responsive: true, maintainAspectRatio: false, interaction: { mode: 'index', intersect: false }, plugins: noLegend, scales: baseScales('Price ($)') },
  }));
  // volume
  activeCharts.push(new Chart($('#cVol'), {
    type: 'bar',
    data: { labels: P.dates, datasets: [{ label: 'Volume', data: P.volume, backgroundColor: 'rgba(57,80,111,.7)', borderWidth: 0 }] },
    options: { responsive: true, maintainAspectRatio: false, plugins: noLegend, scales: { x: { display: false }, y: { grid: { color: 'rgba(255,255,255,.04)' }, ticks: { color: '#74809a', font: CHART_FONT, maxTicksLimit: 3, callback: v => (v / 1e6).toFixed(0) + 'M' } } } },
  }));

  // forecast series share x axis = recent realized + future forecast dates
  const rv = s.realized_vol;
  const recentDates = rv.dates.slice(-90);
  const recentVals = rv.values.slice(-90);
  const fDates = DATA.forecast_dates;
  const labels = recentDates.concat(fDates);
  const pad = new Array(recentDates.length).fill(null);
  const realizedSeries = recentVals.concat(new Array(fDates.length).fill(null));
  // connect: start forecast at last realized point
  const connectIdx = recentVals.length - 1;

  const mkFuture = (arr) => { const a = pad.slice(); a[connectIdx] = recentVals[connectIdx]; return a.concat(arr); };

  activeCharts.push(new Chart($('#cEg'), {
    type: 'line',
    data: {
      labels,
      datasets: [
        { label: 'Realized', data: realizedSeries, borderColor: '#8aa0c8', borderWidth: 1.4, pointRadius: 0, tension: .15 },
        { label: 'EGARCH', data: mkFuture(s.egarch_path), borderColor: '#5fd4c4', borderDash: [5, 4], borderWidth: 1.8, pointRadius: 0, tension: .15 },
      ],
    },
    options: { responsive: true, maintainAspectRatio: false, interaction: { mode: 'index', intersect: false }, plugins: noLegend, scales: baseScales('Ann. vol (%)') },
  }));

  activeCharts.push(new Chart($('#cTf'), {
    type: 'line',
    data: {
      labels,
      datasets: [
        { label: 'Realized', data: realizedSeries, borderColor: '#8aa0c8', borderWidth: 1.4, pointRadius: 0, tension: .15 },
        { label: 'TimesFM alone', data: mkFuture(s.timesfm_alone_path), borderColor: '#4bbf7b', borderDash: [5, 4], borderWidth: 1.8, pointRadius: 0, tension: .15 },
        { label: 'TimesFM together', data: mkFuture(s.timesfm_together_path), borderColor: '#e9b45f', borderDash: [2, 3], borderWidth: 1.8, pointRadius: 0, tension: .15 },
      ],
    },
    options: { responsive: true, maintainAspectRatio: false, interaction: { mode: 'index', intersect: false }, plugins: noLegend, scales: baseScales('Ann. vol (%)') },
  }));
}

/* ============================================================
   GLOBE (placeholder)
   ============================================================ */
function renderGlobe(view) {
  view.appendChild(el('section', { class: 'hero' }, `
    <div class="eyebrow">Globe · Geospatial</div>
    <h1>The map is coming.</h1>
  `));
  view.appendChild(el('div', { class: 'placeholder' }, `
    <div class="ico">🌐</div>
    <h2>Geospatial view in development</h2>
    <p>This tab will plot each airline's indicators on a map — hubs, route stress, regional delays and
    where the risk is concentrated. Select a stock and its signals will light up across its network.
    The backend for this layer isn't built yet, so the globe is intentionally empty for now.</p>
  `));
}

/* ============================================================
   PORTFOLIO
   ============================================================ */
function renderPortfolio(view) {
  const pf = DATA.portfolio;
  const tickers = DATA.tickers;

  view.appendChild(el('section', { class: 'hero' }, `
    <div class="eyebrow">Portfolio · Risk analytics</div>
    <h1>How the eight move together.</h1>
    <p class="lead">Correlation, principal-component structure and the market regime for the airline universe.
    Build a model portfolio below, or preview manual entry (coming soon).</p>
  `));

  // regime
  if (DATA.regimes && DATA.regimes.current) {
    const reg = DATA.regimes.current;
    const colorOf = { Calm: 'var(--calm)', Stressed: 'var(--stress)', Crisis: 'var(--crisis)' };
    const chips = Object.entries(reg).map(([k, v]) =>
      `<span class="regimechip"><i class="dot" style="background:${colorOf[k]}"></i>${k} <b>${pct(v * 100, 0)}</b></span>`).join('&nbsp;&nbsp;&nbsp;');
    const sec = el('section', { class: 'section' });
    sec.innerHTML = `<div class="eyebrow">Current market regime (HMM)</div>
      <div class="card"><p style="margin-bottom:.8rem">${chips}</p>
      <div class="canvas-box short" style="height:180px"><canvas id="cRegime"></canvas></div></div>`;
    view.appendChild(sec);
  }

  // model portfolio controls
  const sec2 = el('section', { class: 'section' });
  sec2.innerHTML = `<div class="eyebrow">Model airlines portfolio</div>
    <h2>Eight-stock sector book</h2>`;
  const controls = el('div', { class: 'controls' });
  const bEq = el('button', { class: 'btn primary' }, 'Equal weights');
  const bRand = el('button', { class: 'btn' }, 'Random weights');
  controls.appendChild(bEq); controls.appendChild(bRand);
  sec2.appendChild(controls);

  const wWrap = el('div', { class: 'grid cols-2', style: 'align-items:start' });
  const wTableWrap = el('div', { class: 'card' });
  wTableWrap.innerHTML = `<h3>Weights &amp; sector exposure</h3><div id="wtable"></div>
    <p class="note" style="margin-top:.8rem">Sector share = portion of each stock's variance explained by the shared airline factor (PCA). The rest is stock-specific.</p>`;
  const pcaWrap = el('div', { class: 'card' });
  pcaWrap.innerHTML = `<h3>Concentration (PCA)</h3>
    <div class="canvas-box" style="height:260px"><canvas id="cPca"></canvas></div>
    <p class="note" style="margin-top:.6rem">PC1 explains <b>${pct((pf.pca_explained[0] || 0) * 100, 0)}</b> of all variance — the airlines largely move as one. Diversifying within the sector only goes so far.</p>`;
  wWrap.appendChild(wTableWrap); wWrap.appendChild(pcaWrap);
  sec2.appendChild(wWrap);
  view.appendChild(sec2);

  // correlation heatmap
  const sec3 = el('section', { class: 'section' });
  sec3.innerHTML = `<div class="eyebrow">Correlation matrix</div>
    <h2>Return correlation (last ${pf.returns && pf.returns[tickers[0]] ? '120 days' : ''})</h2>
    <div class="card"><div id="heatmap" class="heatmap"></div>
      <div class="heat-legend"><span>0.4</span><span class="heat-bar"></span><span>1.0</span><span style="margin-left:1rem">higher = moves together</span></div>
    </div>`;
  view.appendChild(sec3);

  // manual entry
  const sec4 = el('section', { class: 'section' });
  sec4.innerHTML = `<div class="eyebrow">Your portfolio</div>
    <h2>Enter your own holdings</h2>
    <p class="lead">Add tickers with a share count or dollar amount. Full analysis of custom portfolios is in
    development — for now, entry is limited to the eight covered airlines and does not yet compute.</p>`;
  const form = el('div', { class: 'entryform' });
  const optHtml = tickers.map(t => `<option value="${t}">${t}</option>`).join('');
  form.innerHTML = `
    <div><label>Ticker</label><select id="peTicker">${optHtml}</select></div>
    <div><label>Shares or $ amount</label><input id="peAmt" type="number" placeholder="e.g. 100" /></div>
    <div><button class="btn disabled" id="peAdd" disabled>Add <span class="badge-soon">· soon</span></button></div>`;
  sec4.appendChild(form);
  sec4.appendChild(el('p', { class: 'note', style: 'margin-top:.8rem' }, 'Limited to covered airlines while the backend is built. Entries are not saved or analyzed yet.'));
  view.appendChild(sec4);

  // wire up
  const state = { weights: equalWeights(tickers) };
  function renderWeights() {
    const rows = tickers.map(t => {
      const w = state.weights[t];
      const share = pf.sector_share_latest[t];
      return `<tr><td>${t}</td><td>${pct(w * 100, 1)}</td><td>${pct((share || 0) * 100, 0)}</td><td>${pct((1 - (share || 0)) * 100, 0)}</td></tr>`;
    }).join('');
    $('#wtable').innerHTML = `<table class="wtable"><thead><tr><th>Stock</th><th>Weight</th><th>Sector</th><th>Specific</th></tr></thead><tbody>${rows}</tbody></table>`;
  }
  bEq.addEventListener('click', () => { state.weights = equalWeights(tickers); bEq.classList.add('primary'); bRand.classList.remove('primary'); renderWeights(); });
  bRand.addEventListener('click', () => { state.weights = randomWeights(tickers); bRand.classList.add('primary'); bEq.classList.remove('primary'); renderWeights(); });
  renderWeights();

  requestAnimationFrame(() => {
    drawRegimeChart();
    drawPcaChart();
    drawHeatmap();
  });
}
function equalWeights(t) { const w = {}; t.forEach(x => w[x] = 1 / t.length); return w; }
function randomWeights(t) { const r = t.map(() => Math.random()); const s = r.reduce((a, b) => a + b, 0); const w = {}; t.forEach((x, i) => w[x] = r[i] / s); return w; }

function drawRegimeChart() {
  const r = DATA.regimes; if (!r || !$('#cRegime')) return;
  const n = 120;
  const labels = r.dates.slice(-n);
  const ds = (k, col) => ({ label: k, data: r[k].slice(-n), borderColor: col, backgroundColor: col + '55', fill: true, borderWidth: 0, pointRadius: 0, stack: 'r' });
  activeCharts.push(new Chart($('#cRegime'), {
    type: 'line',
    data: { labels, datasets: [ds('Calm', '#4bbf7b'), ds('Stressed', '#e9b45f'), ds('Crisis', '#e06a6a')] },
    options: { responsive: true, maintainAspectRatio: false, interaction: { mode: 'index', intersect: false }, plugins: { legend: { labels: { color: '#aeb9cf', font: CHART_FONT, boxWidth: 10 } }, tooltip: noLegend.tooltip }, scales: { x: { stacked: true, grid: { display: false }, ticks: { color: '#74809a', font: CHART_FONT, maxTicksLimit: 6, maxRotation: 0 } }, y: { stacked: true, min: 0, max: 1, grid: { color: 'rgba(255,255,255,.05)' }, ticks: { color: '#74809a', font: CHART_FONT } } } },
  }));
}
function drawPcaChart() {
  const pf = DATA.portfolio; if (!$('#cPca')) return;
  const labels = pf.pca_explained.map((_, i) => 'PC' + (i + 1));
  activeCharts.push(new Chart($('#cPca'), {
    type: 'bar',
    data: { labels, datasets: [{ data: pf.pca_explained.map(v => v * 100), backgroundColor: ['#5fd4c4', '#e9b45f', '#8aa0c8'], borderWidth: 0 }] },
    options: { responsive: true, maintainAspectRatio: false, plugins: { ...noLegend, tooltip: { ...noLegend.tooltip, callbacks: { label: c => c.parsed.y.toFixed(1) + '% of variance' } } }, scales: { x: { grid: { display: false }, ticks: { color: '#74809a', font: CHART_FONT } }, y: { grid: { color: 'rgba(255,255,255,.05)' }, ticks: { color: '#74809a', font: CHART_FONT, callback: v => v + '%' } } } },
  }));
}
function drawHeatmap() {
  const pf = DATA.portfolio; const t = DATA.tickers; const box = $('#heatmap'); if (!box) return;
  const n = t.length;
  box.style.gridTemplateColumns = `44px repeat(${n}, minmax(0, 1fr))`;
  const frag = document.createDocumentFragment();
  frag.appendChild(el('div', { class: 'heatlabel col' }, ''));
  t.forEach(c => frag.appendChild(el('div', { class: 'heatlabel col' }, c)));
  t.forEach((rowT, i) => {
    frag.appendChild(el('div', { class: 'heatlabel' }, rowT));
    t.forEach((colT, j) => {
      const v = pf.correlation[rowT][j];
      frag.appendChild(el('div', { class: 'heatcell', title: `${rowT}–${colT}: ${fmt(v)}`, style: `background:${heatColor(v)}` }, v != null ? v.toFixed(2) : ''));
    });
  });
  box.innerHTML = ''; box.appendChild(frag);
}
function heatColor(v) {
  if (v == null) return '#161d2d';
  // map 0.4..1.0 -> green..amber..red
  const t = Math.max(0, Math.min(1, (v - 0.4) / 0.6));
  const stops = [[43, 58, 47], [75, 191, 123], [233, 180, 95], [224, 106, 106]];
  const seg = t * (stops.length - 1); const i = Math.floor(seg); const f = seg - i;
  const a = stops[i]; const b = stops[Math.min(i + 1, stops.length - 1)];
  const c = a.map((x, k) => Math.round(x + (b[k] - x) * f));
  return `rgb(${c[0]},${c[1]},${c[2]})`;
}

/* ============================================================
   GLOSSARY
   ============================================================ */
const GLOSSARY = [
  ['Models', [
    ['EGARCH', 'Exponential GARCH — a model of how volatile a stock is. It captures volatility clustering (calm and wild periods bunch together) and the leverage effect, where bad news raises future volatility more than good news of the same size.'],
    ['GARCH', 'Generalized AutoRegressive Conditional Heteroskedasticity. The family of models that forecast variance from recent variance and recent shocks. EGARCH is one variant.'],
    ['TimesFM', "A time-series \"foundation model\" from Google Research, pre-trained on huge amounts of data. Used zero-shot (no retraining) to forecast each stock's volatility series."],
    ['HMM', 'Hidden Markov Model — assumes the market is secretly in one of a few states (here Calm, Stressed, Crisis) and estimates the probability of each from observed returns.'],
    ['PCA', 'Principal Component Analysis — finds the few underlying patterns that explain most of how a group of stocks move. The first pattern here is the shared "airline sector" factor.'],
    ['ARIMA', 'A classical forecasting model that predicts a series from its own recent values and recent errors. A standard baseline.'],
    ['Zero-shot', 'Using a pre-trained model as-is on a new problem, without any additional training on your data.'],
  ]],
  ['Risk & volatility', [
    ['Volatility', 'How much a price swings. Usually the standard deviation of returns. Higher volatility = bigger, less predictable moves.'],
    ['Annualized volatility', 'Daily volatility scaled up to a yearly figure (multiply by √252) so numbers are comparable. "30%" means roughly a 30% standard deviation of return over a year.'],
    ['Realized volatility', 'Volatility measured from what actually happened, usually over a trailing window (here, 20 days).'],
    ['Regime', 'A market "mood" — calm, stressed or crisis. Volatility behaves very differently in each.'],
    ['Beta', "A stock's sensitivity to the overall market. Beta of 1.3 means it tends to move 1.3% when the market moves 1%."],
    ['Sector vs. stock-specific risk', 'Part of a stock\'s risk comes from its whole industry moving (sector); part is unique to the company (idiosyncratic / stock-specific).'],
    ['Correlation', 'How closely two stocks move together, from −1 (opposite) to +1 (identical). Airlines are highly correlated.'],
  ]],
  ['Trading & valuation', [
    ['Bid / Ask', 'The highest price a buyer will pay (bid) and lowest a seller will accept (ask). The gap is the spread.'],
    ['Market cap', 'Share price × shares outstanding — the total value of a company\'s equity.'],
    ['P/E ratio', 'Price-to-Earnings: share price divided by earnings per share. A rough gauge of how expensive a stock is relative to profits.'],
    ['Forward P/E', 'Same as P/E but using forecast future earnings instead of past earnings.'],
    ['PEG ratio', 'P/E divided by the earnings growth rate. Below 1 can suggest a stock is cheap relative to its growth. Often N/A for airlines with volatile or negative earnings.'],
    ['Moving average', 'The average price over a trailing window (50 or 200 days), used to smooth out noise and show trend.'],
    ['Volume', 'How many shares traded in a period. Spikes often accompany big news or moves.'],
    ['52-week high / low', 'The highest and lowest price over the past year.'],
  ]],
  ['Signals & data', [
    ['Sentiment', 'A score of how positive or negative text (news, posts) is. We use VADER with a finance-specific word list.'],
    ['VADER', 'A rule-based sentiment scorer good for short text like headlines. We extended it so words like "grounded" or "downgrade" read as negative.'],
    ['z-score', 'How many standard deviations a value is from the group average. Used here to compare the 8 airlines on the same scale each day.'],
    ['Fuel beta', 'How much an airline\'s stock moves with crude-oil prices. More negative = more hurt when oil rises.'],
    ['Composite signal', 'Our blended score from fuel, news and operations, labeled from BEARISH to BULLISH. It describes flow and context, not a price target.'],
    ['Idiosyncratic', 'Specific to one company rather than the whole sector.'],
  ]],
];

function renderGlossary(view) {
  view.appendChild(el('section', { class: 'hero' }, `
    <div class="eyebrow">Glossary</div>
    <h1>Plain-English definitions.</h1>
    <p class="lead">Every model, metric and term used across Sentinel, defined for a general reader.</p>
  `));
  const ctr = el('div', { class: 'glosscontrols' });
  ctr.innerHTML = `<input id="glossSearch" type="search" placeholder="Search terms…" aria-label="Search glossary" />`;
  view.appendChild(ctr);
  const container = el('div', { id: 'glossList' });
  view.appendChild(container);

  function draw(filter) {
    container.innerHTML = '';
    const f = (filter || '').toLowerCase().trim();
    GLOSSARY.forEach(([cat, terms]) => {
      const matched = terms.filter(([t, d]) => !f || t.toLowerCase().includes(f) || d.toLowerCase().includes(f));
      if (!matched.length) return;
      const sec = el('div', { class: 'glosscat' });
      sec.appendChild(el('h3', {}, cat));
      const dl = el('dl');
      matched.forEach(([t, d]) => {
        const term = el('div', { class: 'term' });
        term.innerHTML = `<dt>${esc(t)}</dt><dd>${esc(d)}</dd>`;
        dl.appendChild(term);
      });
      sec.appendChild(dl);
      container.appendChild(sec);
    });
    if (!container.children.length) container.innerHTML = '<p class="note">No terms match that search.</p>';
  }
  draw('');
  $('#glossSearch').addEventListener('input', e => draw(e.target.value));
}

/* ============================================================
   BOOT
   ============================================================ */
async function boot() {
  $('#footYear').textContent = new Date().getFullYear();
  $('#menuToggle').addEventListener('click', () => $('#tabs').classList.toggle('open'));
  window.addEventListener('hashchange', router);
  try {
    const res = await fetch('sentinel_data.json', { cache: 'no-store' });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    DATA = await res.json();
  } catch (e) {
    $('#view').innerHTML = `<div class="placeholder"><div class="ico">📊</div>
      <h2>Couldn't load research data</h2>
      <p>The site expects <code class="mono">sentinel_data.json</code> next to it. If you opened the file
      directly from disk, browsers block that — run a tiny local server instead
      (<code class="mono">python -m http.server</code>) or view it on GitHub Pages.</p>
      <p class="mono" style="color:var(--ink-3)">${esc(e.message)}</p></div>`;
    return;
  }
  if (DATA.generated) $('#footGenerated').textContent = 'Data generated ' + DATA.generated;
  router();
}
boot();
