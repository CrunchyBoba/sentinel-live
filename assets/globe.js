/* ============================================================
   GLOBE — 3D sector map (MapLibre GL, globe projection)
   Airports come from data/airports.csv (reference geography).
   Live layers come from data/globe_data.json, refreshed by the
   "Daily update" GitHub Action (pipeline/update_globe_data.py).
   Loaded before app.js; uses its helpers at call time.
   ============================================================ */
'use strict';

const SECTORS = [
  { id: 'airlines', name: 'Airlines', live: true, sub: '8 U.S. carriers' },
  { id: 'banks', name: 'Banks', live: false },
  { id: 'energy', name: 'Energy', live: false },
  { id: 'shipping', name: 'Shipping & logistics', live: false },
  { id: 'semis', name: 'Semiconductors', live: false },
];

const LAYERS = [
  { id: 'flights', group: 'Airline operations', name: 'Flights at snapshot', on: true, src: 'opensky' },
  { id: 'airports', group: 'Airline operations', name: 'Hubs & airports', on: true, src: null },
  { id: 'delays', group: 'Airline operations', name: 'Delays & cancellations', on: true, src: 'faa' },
  { id: 'weather', group: 'Airline operations', name: 'Weather at airports', on: true, src: 'metar' },
  { id: 'quakes', group: 'Natural hazards', name: 'Earthquakes', on: false, src: 'quakes' },
  { id: 'storms', group: 'Natural hazards', name: 'Hurricanes & storms', on: false, src: 'eonet' },
  { id: 'fires', group: 'Natural hazards', name: 'Wildfires', on: false, src: 'eonet' },
  { id: 'otherhaz', group: 'Natural hazards', name: 'Volcanoes, floods & other', on: false, src: 'eonet' },
  { id: 'night', group: 'Map', name: 'Day and night', on: false, src: null },
];

const SOURCE_NAMES = {
  opensky: 'Flights · OpenSky Network', flightaware: 'Carrier delays · FlightAware board',
  faa: 'Airport programs · FAA NAS Status', metar: 'Airport weather · aviationweather.gov',
  alerts: 'Weather alerts · National Weather Service', quakes: 'Earthquakes · USGS',
  eonet: 'Wildfires, storms, other · NASA EONET', nhc: 'Hurricanes · NOAA NHC', fuel: 'Fuel · WTI crude via Yahoo',
};

/* Persist choices for the session so leaving and returning keeps the view. */
const GSTATE = {
  sector: 'airlines',
  sel: null,                                   // Set of tickers; filled with the first carrier on first visit
  layers: Object.fromEntries(LAYERS.map(l => [l.id, l.on])),
};
let GLOBE_AIRPORTS = null;   // parsed data/airports.csv
let GLOBE_LIVE = undefined;  // globe_data.json (null when not generated yet)

const ROLE_LABEL = { hub: 'Hub', focus: 'Focus city / base', gateway: 'International gateway' };
const WX_LABEL = { VFR: 'Good (VFR)', MVFR: 'Marginal (MVFR)', IFR: 'Poor (IFR)', LIFR: 'Very poor (LIFR)' };

/* ---------- small helpers ---------- */
function parseCSV(text) {
  const rows = []; let row = [], cell = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; } else if (c === '"') q = false; else cell += c; continue; }
    if (c === '"') q = true; else if (c === ',') { row.push(cell); cell = ''; }
    else if (c === '\n' || c === '\r') { if (c === '\r' && text[i + 1] === '\n') i++; row.push(cell); rows.push(row); row = []; cell = ''; }
    else cell += c;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  const head = rows.shift();
  return rows.filter(r => r.length === head.length).map(r => Object.fromEntries(head.map((h, i) => [h, r[i]])));
}
function airportsFromCSV(text) {
  const by = {};
  parseCSV(text).forEach(r => {
    const a = by[r.iata] || (by[r.iata] = { iata: r.iata, icao: r.icao, name: r.airport_name, city: r.city, country: r.country, lat: +r.lat, lon: +r.lon, carriers: [] });
    a.carriers.push({ t: r.carrier, role: r.role });
  });
  return Object.values(by);
}
/* Colour tokens are read from the globe container, so the full-screen console can use its own palette. */
let tok = (n) => css(n);
function volColor(v) {
  if (!isNum(v)) return tok('--ink-3');
  const f = Math.max(0, Math.min(1, (v - SCALE.lo) / (SCALE.hi - SCALE.lo)));
  const a = hexRgb(tok('--s-tf')), b = hexRgb(tok('--brass')), c = hexRgb(tok('--crisis'));
  return f < .5 ? mix(a, b, f * 2) : mix(b, c, (f - .5) * 2);
}
const mixHex = (a, b, f) => mix(hexRgb(a), hexRgb(b), f);
const ago = (iso) => {
  if (!iso) return '';
  const m = Math.round((Date.now() - Date.parse(iso)) / 60000);
  if (!isFinite(m)) return '';
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60); if (h < 48) return `${h} h ago`;
  return `${Math.round(h / 24)} days ago`;
};
const utcStamp = (iso) => {
  if (!iso) return '—';
  const d = new Date(iso); if (isNaN(d)) return esc(iso);
  return `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}, ${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')} UTC`;
};
const live = () => GLOBE_LIVE || {};
const srcOk = (k) => !!(live().sources && live().sources[k] && (live().sources[k].ok || live().sources[k].last_ok));
const fc = (features) => ({ type: 'FeatureCollection', features });
const pt = (lon, lat, props) => ({ type: 'Feature', geometry: { type: 'Point', coordinates: [lon, lat] }, properties: props });

/* Great-circle points between two [lon, lat] pairs, so routes curve with the globe. */
function greatCircle(a, b, n = 48) {
  const r = Math.PI / 180, toV = ([lo, la]) => [Math.cos(la * r) * Math.cos(lo * r), Math.cos(la * r) * Math.sin(lo * r), Math.sin(la * r)];
  const A = toV(a), B = toV(b), d = Math.acos(Math.max(-1, Math.min(1, A[0] * B[0] + A[1] * B[1] + A[2] * B[2])));
  if (d < 1e-6) return [a, b];
  const out = [];
  for (let i = 0; i <= n; i++) {
    const f = i / n, s1 = Math.sin((1 - f) * d) / Math.sin(d), s2 = Math.sin(f * d) / Math.sin(d);
    const v = [s1 * A[0] + s2 * B[0], s1 * A[1] + s2 * B[1], s1 * A[2] + s2 * B[2]];
    out.push([Math.atan2(v[1], v[0]) / r, Math.atan2(v[2], Math.hypot(v[0], v[1])) / r]);
  }
  for (let i = 1; i < out.length; i++) { while (out[i][0] - out[i - 1][0] > 180) out[i][0] -= 360; while (out[i][0] - out[i - 1][0] < -180) out[i][0] += 360; }
  return out;
}

/* The night side of the earth right now, from the sun's position. */
function nightPolygon(date = new Date()) {
  const rad = Math.PI / 180, d = (date.getTime() - Date.UTC(2000, 0, 1, 12)) / 864e5;
  const g = (357.529 + 0.98560028 * d) * rad, q = 280.459 + 0.98564736 * d;
  const L = (q + 1.915 * Math.sin(g) + 0.020 * Math.sin(2 * g)) * rad, e = (23.439 - 0.00000036 * d) * rad;
  const dec = Math.asin(Math.sin(e) * Math.sin(L));
  const ra = Math.atan2(Math.cos(e) * Math.sin(L), Math.cos(L)) / rad;
  const gmst = ((18.697374558 + 24.06570982441908 * d) % 24 + 24) % 24;
  const sunLon = ((ra - gmst * 15) % 360 + 540) % 360 - 180;
  const line = [];
  for (let lon = -180; lon <= 180; lon += 2) {
    const lat = Math.atan(-Math.cos((lon - sunLon) * rad) / Math.tan(dec)) / rad;
    line.push([lon, lat]);
  }
  const pole = dec > 0 ? -89.9 : 89.9;
  return { type: 'Feature', geometry: { type: 'Polygon', coordinates: [[...line, [180, pole], [-180, pole], line[0]]] }, properties: {} };
}

/* Latitude / longitude grid every 15 degrees (shown in the console view). */
function graticule() {
  const lines = [];
  for (let lat = -75; lat <= 75; lat += 15) lines.push(Array.from({ length: 73 }, (_, i) => [-180 + i * 5, lat]));
  for (let lon = -180; lon < 180; lon += 15) lines.push(Array.from({ length: 35 }, (_, i) => [lon, -85 + i * 5]));
  return { type: 'Feature', geometry: { type: 'MultiLineString', coordinates: lines }, properties: {} };
}
const fmtLat = (v) => `${Math.abs(v).toFixed(3)}°${v >= 0 ? 'N' : 'S'}`;
const fmtLon = (v) => { v = ((v + 540) % 360) - 180; return `${Math.abs(v).toFixed(3)}°${v >= 0 ? 'E' : 'W'}`; };

/* Airplane silhouette as an SDF image so each flight can be tinted. */
function planeImage() {
  const s = 48, cv = document.createElement('canvas'); cv.width = cv.height = s;
  const g = cv.getContext('2d'); g.fillStyle = '#fff'; g.translate(s / 2, s / 2); g.scale(s / 48, s / 48);
  g.beginPath();
  g.moveTo(0, -20); g.bezierCurveTo(2.5, -20, 3, -16, 3, -12); g.lineTo(3, -4); g.lineTo(19, 5); g.lineTo(19, 9); g.lineTo(3, 4);
  g.lineTo(3, 13); g.lineTo(8, 17); g.lineTo(8, 20); g.lineTo(0, 17.5); g.lineTo(-8, 20); g.lineTo(-8, 17); g.lineTo(-3, 13);
  g.lineTo(-3, 4); g.lineTo(-19, 9); g.lineTo(-19, 5); g.lineTo(-3, -4); g.lineTo(-3, -12); g.bezierCurveTo(-3, -16, -2.5, -20, 0, -20);
  g.closePath(); g.fill();
  return g.getImageData(0, 0, s, s);
}

/* ---------- data loading ---------- */
async function loadGlobeData() {
  const jobs = [];
  if (!GLOBE_AIRPORTS) jobs.push(fetch('data/airports.csv', { cache: 'no-store' }).then(r => { if (!r.ok) throw new Error('airports.csv HTTP ' + r.status); return r.text(); }).then(t => { GLOBE_AIRPORTS = airportsFromCSV(t); }));
  if (GLOBE_LIVE === undefined) jobs.push(fetch('data/globe_data.json', { cache: 'no-store' }).then(r => r.ok ? r.json() : null).catch(() => null).then(j => { GLOBE_LIVE = j; }));
  if (!WORLD) jobs.push(fetch('data/world-110m.json').then(r => { if (!r.ok) throw new Error('world-110m.json HTTP ' + r.status); return r.json(); }).then(j => { WORLD = j; }));
  await Promise.all(jobs);
}

/* ============================================================ */
function renderGlobe(view) {
  view.appendChild(el('header', { class: 'pagehead' }, `
    <h1>Where each airline's <span>risk lands.</span></h1>
    <p>A daily snapshot of the airline sector: each carrier's flights in the air, its hubs and airports, delays and
    weather at those airports, and natural hazards nearby. Hubs and flights are coloured by the carrier's two-month
    volatility forecast.</p>`));
  view.appendChild(el('h2', { class: 'sr' }, 'Sector map and data layers'));

  if (!GSTATE.sel) GSTATE.sel = new Set([DATA.tickers[0]]);

  const wrap = el('div', { class: 'g3' });
  wrap.innerHTML = `
    <aside class="card gpanel g3-left" aria-label="Sector and carriers">
      <h3>Sector</h3>
      <ul class="sectorlist">${SECTORS.map(s => `<li><button type="button" data-sector="${s.id}" ${s.live ? `aria-pressed="${GSTATE.sector === s.id}"` : 'disabled'}>
        <span class="nm"><b>${esc(s.name)}</b>${s.sub ? `<span>${esc(s.sub)}</span>` : ''}</span>
        ${s.live ? '<span class="tag live">Live</span>' : '<span class="tag soon">Offline</span>'}</button></li>`).join('')}</ul>
      <div class="gpanel-head"><h3>Carriers</h3>
        <span class="gbtns"><button type="button" class="linkbtn" data-all>Entire sector</button><button type="button" class="linkbtn" data-none>Clear</button></span></div>
      <ul class="pickcarriers" id="pickCarriers"></ul>
      <p class="note gfoot">Pick one carrier, several, or the entire sector.</p>
    </aside>
    <section class="card mapcard g3-map" aria-labelledby="gTitle">
      <div class="maptools"><h3 id="gTitle">Airlines sector</h3>
        <span class="gmeta" id="gMeta"></span>
        <button type="button" class="btn small" data-console aria-label="Open the globe full screen">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/></svg>Full screen</button></div>
      <div class="glmap-wrap"><div class="glmap" id="glmap"><p class="loading">Loading the globe…</p></div>
        <button type="button" class="btn small gReset" id="gReset">Reset view</button>
        <div class="hud hud-top" aria-hidden="true">
          <span class="hud-brand">SENTINEL<i>//</i>GLOBAL OPS</span><span class="hud-k">SECTOR</span><span id="hudSector">AIRLINES</span>
          <span class="hud-k">TRACKING</span><span id="hudSel">—</span>
          <span class="hud-sp"></span>
          <span class="hud-k">SNAPSHOT</span><span id="hudSnap">—</span>
          <span class="hud-clock" id="hudClock">--:--:-- UTC</span>
        </div>
        <div class="hud-actions">
          <button type="button" class="hudbtn" data-reset>Reset view</button>
          <button type="button" class="hudbtn" data-panels>Hide panels</button>
          <span class="hud-nfa">Not financial advice</span>
          <button type="button" class="hudbtn" data-exit>Exit <kbd>Esc</kbd></button>
        </div>
        <div class="hud hud-bottom" aria-hidden="true"><div id="hudPos"></div><span class="hud-sp"></span><div id="hudCounts"></div></div>
        <i class="hud-corner tl" aria-hidden="true"></i><i class="hud-corner tr" aria-hidden="true"></i><i class="hud-corner bl" aria-hidden="true"></i><i class="hud-corner br" aria-hidden="true"></i>
      </div>
      <div class="maplegend" id="gLegend"></div>
    </section>
    <aside class="card gpanel g3-right" aria-label="Data layers">
      <h3>Data layers</h3>
      <div id="layerList"></div>
      <p class="note gfoot">Layers start with the essentials on. Turn on hazards and shading when you need them; fewer layers draw faster.</p>
    </aside>`;
  view.appendChild(wrap);
  tok = (n) => getComputedStyle(wrap).getPropertyValue(n).trim() || css(n);
  routeCleanup.push(() => { tok = (n) => css(n); exitConsole(true); });
  const isDark = () => wrap.classList.contains('console') || document.documentElement.dataset.theme === 'dark';

  const below = el('div', { class: 'gbelow' });
  below.innerHTML = `<section class="section"><h2>Selected carriers</h2><div id="gTable"></div></section>
    <section class="section"><h2>Where this data comes from</h2><div id="gSources"></div></section>`;
  view.appendChild(below);

  loadGlobeData().then(() => {
    if (!document.body.contains(wrap)) return;
    drawPanels(); drawTable(); drawSources(); startMap();
  }).catch(err => {
    $('#glmap').innerHTML = `<div class="errorbox"><p>The globe's files couldn't be loaded (${esc(err.message)}). Check that <code>data/airports.csv</code> and <code>data/world-110m.json</code> are in the repository.</p></div>`;
  });

  let map = null;
  let hoverT = null;
  let nightTick = null, clockTick = null;

  /* ---------- side panels ---------- */
  function carrierCounts(t) {
    const c = live().flight_counts && live().flight_counts[t];
    return c ? c.airborne : null;
  }
  function drawPanels() {
    $('#pickCarriers').innerHTML = STATS.slice().sort((a, b) => DATA.tickers.indexOf(a.t) - DATA.tickers.indexOf(b.t)).map(s => {
      const n = carrierCounts(s.t);
      return `<li><button type="button" data-t="${s.t}" aria-pressed="${GSTATE.sel.has(s.t)}">
        <i class="check" aria-hidden="true"></i><span class="who"><b>${s.t}</b><span class="nm">${esc(s.short)}</span></span>
        <span class="v"><i class="dot" style="background:${volColor(s.avg)}"></i>${isNum(n) ? fmtInt(n) + ' aloft' : pct(s.avg, 0)}</span></button></li>`;
    }).join('');
    const groups = [...new Set(LAYERS.map(l => l.group))];
    $('#layerList').innerHTML = groups.map(g => `<p class="lgroup">${g}</p><ul class="layerlist">${LAYERS.filter(l => l.group === g).map(l => {
      const ready = !l.src || srcOk(l.src);
      return `<li><button type="button" role="switch" data-layer="${l.id}" aria-checked="${!!GSTATE.layers[l.id]}">
        <span class="nm">${esc(l.name)}<span>${esc(layerNote(l))}</span>${ready ? '' : '<span class="tag soon">Not live yet</span>'}</span>
        <i class="switch-track" aria-hidden="true"><i class="switch-thumb"></i></i></button></li>`;
    }).join('')}</ul>`).join('');
  }
  function layerNote(l) {
    const L = live();
    switch (l.id) {
      case 'flights': return L.flights ? `${fmtInt(L.flights.filter(f => GSTATE.sel.has(f[1])).length)} in the air` : 'Awaiting first update';
      case 'airports': return `${GLOBE_AIRPORTS ? GLOBE_AIRPORTS.filter(airportOn).length : 0} for selection`;
      case 'delays': return L.faa ? `${Object.keys(L.faa).length} airports with FAA programs` : 'Awaiting first update';
      case 'weather': return L.metar ? 'Conditions and alerts' : 'Awaiting first update';
      case 'quakes': return L.earthquakes ? `${L.earthquakes.length} in 7 days, M2.5+` : 'Awaiting first update';
      case 'storms': return (L.storms || L.nhc) ? `${(L.storms || []).length + (L.nhc || []).length} active` : 'Awaiting first update';
      case 'fires': return L.wildfires ? `${L.wildfires.length} open` : 'Awaiting first update';
      case 'otherhaz': return L.hazards_other ? `${L.hazards_other.length} open` : 'Awaiting first update';
      case 'night': return 'From your device clock';
      default: return '';
    }
  }

  wrap.addEventListener('click', (e) => {
    const c = e.target.closest('#pickCarriers button[data-t]');
    if (c) { const t = c.dataset.t; GSTATE.sel.has(t) ? GSTATE.sel.delete(t) : GSTATE.sel.add(t); refresh(); return; }
    if (e.target.closest('[data-all]')) { GSTATE.sel = new Set(DATA.tickers); refresh(); return; }
    if (e.target.closest('[data-none]')) { GSTATE.sel = new Set(); refresh(); return; }
    const L = e.target.closest('button[data-layer]');
    if (L) { GSTATE.layers[L.dataset.layer] = !GSTATE.layers[L.dataset.layer]; L.setAttribute('aria-checked', GSTATE.layers[L.dataset.layer]); applyLayers(); drawLegend(); hudCounts(); return; }
    if (e.target.closest('#gReset, [data-reset]') && map) map.easeTo({ center: [-96, 36], zoom: 1.7, bearing: 0, pitch: 0, duration: 900 });
    if (e.target.closest('[data-console]')) { enterConsole(); return; }
    if (e.target.closest('[data-exit]')) { exitConsole(); return; }
    const hp = e.target.closest('[data-panels]');
    if (hp) { const off = wrap.classList.toggle('panels-off'); hp.textContent = off ? 'Show panels' : 'Hide panels'; }
  });

  /* ---------- full-screen console ---------- */
  let consoleOpener = null;
  function enterConsole() {
    if (wrap.classList.contains('console')) return;
    wrap.classList.add('console');
    document.documentElement.classList.add('console-open');
    if (wrap.requestFullscreen) wrap.requestFullscreen().catch(() => {});
    drawPanels(); drawLegend(); restartMap();
    clockTick = setInterval(hudClock, 1000); hudClock(); hudCounts();
    consoleOpener = document.activeElement; const ex = $('[data-exit]', wrap); if (ex) ex.focus();
  }
  function exitConsole(silent) {
    if (!wrap.classList.contains('console')) return;
    wrap.classList.remove('console', 'panels-off');
    const hp = $('[data-panels]', wrap); if (hp) hp.textContent = 'Hide panels';
    document.documentElement.classList.remove('console-open');
    clearInterval(clockTick); clockTick = null;
    if (document.fullscreenElement && document.exitFullscreen) document.exitFullscreen().catch(() => {});
    if (!silent) { drawPanels(); drawLegend(); restartMap(); if (consoleOpener && consoleOpener.isConnected) consoleOpener.focus(); }
  }
  const onFs = () => { if (!document.fullscreenElement && wrap.classList.contains('console')) exitConsole(); };
  const onEsc = (e) => { if (e.key === 'Escape' && wrap.classList.contains('console') && !document.fullscreenElement) exitConsole(); };
  document.addEventListener('fullscreenchange', onFs);
  document.addEventListener('keydown', onEsc);
  routeCleanup.push(() => { document.removeEventListener('fullscreenchange', onFs); document.removeEventListener('keydown', onEsc); });
  function hudClock() {
    const d = new Date(), z = (n) => String(n).padStart(2, '0');
    const c = $('#hudClock'); if (c) c.textContent = `${z(d.getUTCHours())}:${z(d.getUTCMinutes())}:${z(d.getUTCSeconds())} UTC`;
  }
  function hudCounts() {
    const L = live(), box = $('#hudCounts'); if (!box) return;
    const n = (x) => isNum(x) ? fmtInt(x) : '—';
    const mine = GLOBE_AIRPORTS ? GLOBE_AIRPORTS.filter(airportOn) : [];
    const rows = [
      ['FLIGHTS', GSTATE.layers.flights ? n((L.flights || []).filter(f => GSTATE.sel.has(f[1])).length) : 'OFF'],
      ['AIRPORTS', GSTATE.layers.airports ? n(mine.length) : 'OFF'],
      ['FAA PROGRAMS', GSTATE.layers.delays ? n(L.faa ? mine.filter(a => L.faa[a.iata] || L.faa[a.icao.replace(/^K/, '')]).length : null) : 'OFF'],
      ['POOR WX', GSTATE.layers.weather ? n(L.metar ? mine.filter(a => { const m = L.metar[a.icao]; return m && /IFR/.test(m.cat || '') && m.cat !== 'MVFR'; }).length : null) : 'OFF'],
      ['QUAKES 7D', GSTATE.layers.quakes ? n((L.earthquakes || []).length) : 'OFF'],
      ['STORMS', GSTATE.layers.storms ? n((L.storms || []).length + (L.nhc || []).length) : 'OFF'],
      ['FIRES', GSTATE.layers.fires ? n((L.wildfires || []).length) : 'OFF'],
    ];
    box.innerHTML = rows.map(([k, v]) => `<span><b>${k}</b>${v}</span>`).join('');
    const sel = $('#hudSel'); if (sel) sel.textContent = GSTATE.sel.size === DATA.tickers.length ? 'ALL 8 CARRIERS' : GSTATE.sel.size ? [...GSTATE.sel].join(' · ') : 'NONE';
    const snap = $('#hudSnap'); if (snap) snap.textContent = GLOBE_LIVE ? `${utcStamp(L.flights_time || L.generated).toUpperCase()} · ${ago(L.flights_time || L.generated).toUpperCase()}` : 'NOT GENERATED';
  }
  function hudPos(lngLat) {
    const box = $('#hudPos'); if (!box || !map) return;
    const c = lngLat || map.getCenter();
    box.innerHTML = `<span><b>${lngLat ? 'CURSOR' : 'CENTER'}</b>${fmtLat(c.lat)} ${fmtLon(c.lng)}</span><span><b>ZOOM</b>${map.getZoom().toFixed(2)}</span><span><b>BEARING</b>${Math.round((map.getBearing() + 360) % 360)}°</span>`;
  }
  function restartMap() {
    if (!map) return;
    const cam = { center: map.getCenter(), zoom: map.getZoom(), bearing: map.getBearing() };
    clearInterval(nightTick);
    try { map.remove(); } catch (err) {}
    map = null;
    requestAnimationFrame(() => startMap(cam));
  }
  // hovering a carrier highlights its flights and airports
  wrap.addEventListener('mouseover', (e) => {
    const c = e.target.closest('#pickCarriers button[data-t]');
    const t = c && GSTATE.sel.has(c.dataset.t) ? c.dataset.t : null;
    if (t !== hoverT) { hoverT = t; emphasise(); }
  });
  wrap.addEventListener('mouseleave', () => { if (hoverT) { hoverT = null; emphasise(); } });

  function refresh() {
    drawPanels(); drawTable(); updateSources(); drawLegend(); hudCounts();
    $('#gTitle').textContent = GSTATE.sel.size === DATA.tickers.length ? 'Airlines sector · all carriers'
      : GSTATE.sel.size ? `Airlines sector · ${[...GSTATE.sel].join(', ')}` : 'Airlines sector · no carrier selected';
  }

  /* ---------- map ---------- */
  function airportOn(a) { return a.carriers.some(c => GSTATE.sel.has(c.t)); }
  function airportFeatures() {
    const L = live();
    return GLOBE_AIRPORTS.map(a => {
      const sel = a.carriers.filter(c => GSTATE.sel.has(c.t));
      const pool = sel.length ? sel : a.carriers;
      const v = median(pool.map(c => statOf(c.t) && statOf(c.t).avg));
      const role = pool.some(c => c.role === 'hub') ? 'hub' : pool.some(c => c.role === 'focus') ? 'focus' : 'gateway';
      const met = L.metar && L.metar[a.icao];
      const faa = L.faa && (L.faa[a.iata] || L.faa[a.icao.replace(/^K/, '')]);
      const alerts = L.alerts && L.alerts[a.iata];
      return pt(a.lon, a.lat, {
        iata: a.iata, on: sel.length ? 1 : 0, role, c: volColor(v),
        r: role === 'hub' ? 6.5 : role === 'focus' ? 5 : 4,
        faa: faa ? 1 : 0, wx: met && met.cat ? met.cat : '', alert: alerts ? 1 : 0,
        ts: [...GSTATE.sel].filter(t => a.carriers.some(c => c.t === t)).join(' '),
      });
    });
  }
  function routeFeatures() {
    if (GSTATE.sel.size !== 1) return [];
    const t = [...GSTATE.sel][0];
    const mine = GLOBE_AIRPORTS.filter(a => a.carriers.some(c => c.t === t));
    const home = mine.find(a => a.carriers.some(c => c.t === t && c.role === 'hub')) || mine[0];
    if (!home) return [];
    const col = volColor(statOf(t) && statOf(t).avg);
    return mine.filter(a => a !== home).map(a => ({ type: 'Feature', geometry: { type: 'LineString', coordinates: greatCircle([home.lon, home.lat], [a.lon, a.lat]) }, properties: { c: col } }));
  }
  function flightFeatures() {
    const F = live().flights || [];
    return F.filter(f => GSTATE.sel.has(f[1])).map(f => pt(f[2], f[3], { cs: f[0], t: f[1], alt: f[4], spd: f[5], hdg: f[6] || 0, reg: f[7], c: volColor(statOf(f[1]) && statOf(f[1]).avg) }));
  }
  function hazardData() {
    const L = live();
    const storms = (L.storms || []).map(s => pt(s.lon, s.lat, { title: s.title, wind: s.wind_kt, date: s.date, kind: 'storm' }))
      .concat((L.nhc || []).filter(n => !(L.storms || []).some(s => s.title && n.name && s.title.toLowerCase().includes(String(n.name).toLowerCase())))
        .map(n => pt(n.lon, n.lat, { title: `${n.class || ''} ${n.name || ''}`.trim(), wind: n.wind_kt, date: n.updated, kind: 'storm', nhc: 1 })));
    return {
      quakes: fc((L.earthquakes || []).map(q => pt(q.lon, q.lat, { mag: q.mag, place: q.place, time: q.time }))),
      stormTracks: fc((L.storms || []).filter(s => s.track && s.track.length > 1).map(s => ({ type: 'Feature', geometry: { type: 'LineString', coordinates: s.track }, properties: { title: s.title } }))),
      storms: fc(storms),
      fires: fc((L.wildfires || []).map(f => pt(f.lon, f.lat, { title: f.title, date: f.date }))),
      otherhaz: fc((L.hazards_other || []).map(h => pt(h.lon, h.lat, { title: h.title, date: h.date, kind: h.kind }))),
    };
  }

  function buildStyle() {
    const land = topojson.feature(WORLD, WORLD.objects.land);
    const borders = topojson.mesh(WORLD, WORLD.objects.countries, (a, b) => a !== b);
    const dark = isDark(), con = wrap.classList.contains('console');
    const ocean = con ? mixHex(tok('--bg'), tok('--s-tf'), .1) : mixHex(tok('--card'), tok('--s-tf'), dark ? .16 : .1);
    const landC = con ? mixHex(tok('--bg'), tok('--ink'), .14) : mixHex(tok('--card'), tok('--ink'), dark ? .2 : .16);
    return {
      version: 8,
      projection: { type: 'globe' },
      sources: { land: { type: 'geojson', data: land }, borders: { type: 'geojson', data: borders }, grat: { type: 'geojson', data: graticule() } },
      layers: [
        { id: 'ocean', type: 'background', paint: { 'background-color': ocean } },
        { id: 'grat', type: 'line', source: 'grat', layout: { visibility: con ? 'visible' : 'none' }, paint: { 'line-color': tok('--link'), 'line-width': .5, 'line-opacity': .22 } },
        { id: 'land', type: 'fill', source: 'land', paint: { 'fill-color': landC, 'fill-antialias': true } },
        { id: 'borders', type: 'line', source: 'borders', paint: { 'line-color': con ? tok('--line-strong') : tok('--card'), 'line-width': .6, 'line-opacity': .9 } },
      ],
    };
  }

  function startMap(cam) {
    const box = $('#glmap');
    if (!window.maplibregl) { box.innerHTML = `<div class="errorbox"><p>The map library (<code>maplibre-gl.js</code>) didn't load.</p></div>`; return; }
    box.innerHTML = '';
    try {
      map = new maplibregl.Map({
        container: box, style: buildStyle(), center: cam ? cam.center : [-96, 36], zoom: cam ? cam.zoom : 1.7, bearing: cam ? cam.bearing : 0, minZoom: 0.6, maxZoom: 9,
        attributionControl: false, dragRotate: true, renderWorldCopies: false, fadeDuration: 0,
      });
    } catch (err) {
      box.innerHTML = `<div class="errorbox"><p>Your browser couldn't start the 3D map (it needs WebGL). Try a recent Chrome, Edge, Firefox or Safari.</p></div>`;
      return;
    }
    if (!startMap.cleaned) { startMap.cleaned = true; routeCleanup.push(() => { clearInterval(nightTick); try { map && map.remove(); } catch (e) {} map = null; startMap.cleaned = false; }); }
    map.addControl(new maplibregl.NavigationControl({ showCompass: true, visualizePitch: false }), 'top-right');
    map.addControl(new maplibregl.AttributionControl({ compact: true, customAttribution: 'Natural Earth · OpenSky · FAA · NOAA · USGS · NASA' }), 'bottom-right');
    map.on('load', () => {
      map.addImage('plane', planeImage(), { sdf: true, pixelRatio: 2 });
      const H = hazardData();
      const A = (id, data) => map.addSource(id, { type: 'geojson', data });
      A('night', fc([nightPolygon()]));
      A('routes', fc(routeFeatures()));
      A('quakes', H.quakes); A('storm-tracks', H.stormTracks); A('storms', H.storms); A('fires', H.fires); A('otherhaz', H.otherhaz);
      A('airports', fc(airportFeatures()));
      A('flights', fc(flightFeatures()));
      // every layer starts with the visibility its toggle says
      const add = (def) => { const key = Object.keys(VIS).find(k => VIS[k].includes(def.id)); def.layout = Object.assign({}, def.layout, { visibility: key && !GSTATE.layers[key] ? 'none' : 'visible' }); map.addLayer(def); };
      const ink = tok('--ink'), card = tok('--card'), crisis = tok('--crisis'), stress = tok('--stress'), calm = tok('--calm');
      const dark = isDark();
      add({ id: 'night', type: 'fill', source: 'night', paint: { 'fill-color': dark ? '#000' : ink, 'fill-opacity': dark ? .38 : .16 } });
      add({ id: 'otherhaz', type: 'circle', source: 'otherhaz', paint: { 'circle-radius': 4.5, 'circle-color': tok('--ink-3'), 'circle-stroke-color': card, 'circle-stroke-width': 1.2 } });
      add({ id: 'fires', type: 'circle', source: 'fires', paint: { 'circle-radius': ['interpolate', ['linear'], ['zoom'], 1, 2.6, 6, 5], 'circle-color': crisis, 'circle-opacity': .85, 'circle-stroke-color': card, 'circle-stroke-width': .6 } });
      add({ id: 'quakes', type: 'circle', source: 'quakes', paint: {
        'circle-radius': ['interpolate', ['linear'], ['get', 'mag'], 2.5, 2.5, 5, 7, 7.5, 16],
        'circle-color': 'rgba(0,0,0,0)', 'circle-stroke-color': tok('--ink-2'), 'circle-stroke-width': 1.3, 'circle-stroke-opacity': .85 } });
      add({ id: 'storm-tracks', type: 'line', source: 'storm-tracks', paint: { 'line-color': stress, 'line-width': 2, 'line-dasharray': [2, 1.5] } });
      add({ id: 'storms', type: 'circle', source: 'storms', paint: { 'circle-radius': 7, 'circle-color': stress, 'circle-opacity': .9, 'circle-stroke-color': card, 'circle-stroke-width': 2 } });
      add({ id: 'routes', type: 'line', source: 'routes', layout: { 'line-cap': 'round' }, paint: { 'line-color': ['get', 'c'], 'line-width': 1.4, 'line-opacity': .5 } });
      add({ id: 'flights', type: 'symbol', source: 'flights', layout: {
        'icon-image': 'plane', 'icon-size': ['interpolate', ['linear'], ['zoom'], 1, .42, 5, .7, 8, .95],
        'icon-rotate': ['get', 'hdg'], 'icon-rotation-alignment': 'map', 'icon-pitch-alignment': 'map',
        'icon-allow-overlap': true, 'icon-ignore-placement': true },
        paint: { 'icon-color': ['get', 'c'], 'icon-opacity': .9 } });
      add({ id: 'airport-delay', type: 'circle', source: 'airports', filter: ['all', ['==', ['get', 'on'], 1], ['==', ['get', 'faa'], 1]],
        paint: { 'circle-radius': ['+', ['get', 'r'], 5], 'circle-color': 'rgba(0,0,0,0)', 'circle-stroke-color': crisis, 'circle-stroke-width': 2.2 } });
      add({ id: 'airports', type: 'circle', source: 'airports', paint: {
        'circle-radius': ['get', 'r'], 'circle-color': card, 'circle-stroke-color': ['get', 'c'], 'circle-stroke-width': ['case', ['==', ['get', 'role'], 'hub'], 3, 2.2],
        'circle-opacity': ['case', ['==', ['get', 'on'], 1], 1, .18], 'circle-stroke-opacity': ['case', ['==', ['get', 'on'], 1], 1, .18] } });
      add({ id: 'airport-wx', type: 'circle', source: 'airports', filter: ['all', ['==', ['get', 'on'], 1], ['!=', ['get', 'wx'], '']],
        paint: { 'circle-radius': 3.4, 'circle-translate': [7, -7], 'circle-translate-anchor': 'viewport',
          'circle-color': ['match', ['get', 'wx'], 'VFR', calm, 'MVFR', stress, 'IFR', crisis, 'LIFR', crisis, tok('--ink-3')],
          'circle-stroke-color': ['case', ['==', ['get', 'alert'], 1], ink, card], 'circle-stroke-width': ['case', ['==', ['get', 'alert'], 1], 1.6, 1] } });
      applyLayers(); emphasise(); drawLegend(); bindMapTips();
      // keep the day/night line current while the page is open
      nightTick = setInterval(() => { if (map && map.getSource('night')) map.getSource('night').setData(fc([nightPolygon()])); }, 60000);
      $('#gMeta').innerHTML = metaText();
      hudPos(); hudCounts();
      map.on('mousemove', (e) => hudPos(e.lngLat));
      map.on('mouseout', () => hudPos());
      map.on('moveend', () => hudPos());
    });
  }

  function metaText() {
    const L = live();
    if (!GLOBE_LIVE) return '<span class="tag soon">Live layers not generated yet</span>';
    const t = L.flights_time || L.generated;
    return `<span class="tag live">Snapshot</span> ${esc(utcStamp(t))} · updates daily`;
  }

  const VIS = {
    flights: ['flights'], airports: ['airports', 'routes'], delays: ['airport-delay'], weather: ['airport-wx'],
    quakes: ['quakes'], storms: ['storms', 'storm-tracks'], fires: ['fires'], otherhaz: ['otherhaz'], night: ['night'],
  };
  function applyLayers() {
    if (!map) return;
    Object.entries(VIS).forEach(([k, ids]) => ids.forEach(id => { if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', GSTATE.layers[k] ? 'visible' : 'none'); }));
    // delay rings and weather dots sit on airports; hide them if airports are off
    ['airport-delay', 'airport-wx'].forEach(id => { if (map.getLayer(id) && !GSTATE.layers.airports) map.setLayoutProperty(id, 'visibility', 'none'); });
  }
  function emphasise() {
    if (!map || !map.getLayer('flights')) return;
    map.setPaintProperty('flights', 'icon-opacity', hoverT ? ['case', ['==', ['get', 't'], hoverT], 1, .12] : .9);
    const on = ['==', ['get', 'on'], 1];
    const air = hoverT ? ['case', ['all', on, ['in', hoverT, ['get', 'ts']]], 1, .14] : ['case', on, 1, .18];
    map.setPaintProperty('airports', 'circle-opacity', air);
    map.setPaintProperty('airports', 'circle-stroke-opacity', air);
  }
  function updateSources() {
    if (!map || !map.getSource('airports')) return;
    map.getSource('airports').setData(fc(airportFeatures()));
    map.getSource('flights').setData(fc(flightFeatures()));
    map.getSource('routes').setData(fc(routeFeatures()));
    emphasise();
  }

  /* ---------- tooltips ---------- */
  function bindMapTips() {
    const layers = ['flights', 'airports', 'storms', 'quakes', 'fires', 'otherhaz'];
    map.on('mousemove', (e) => {
      const hits = map.queryRenderedFeatures(e.point, { layers: layers.filter(id => map.getLayer(id) && map.getLayoutProperty(id, 'visibility') !== 'none') });
      const f = hits.find(h => h.layer.id !== 'airports' || h.properties.on === 1) || null;
      map.getCanvas().style.cursor = f ? 'pointer' : '';
      if (!f) { tip.hide(); return; }
      const html = tipFor(f);
      if (html) tip.show(html, e.originalEvent.clientX, e.originalEvent.clientY); else tip.hide();
    });
    map.on('mouseout', () => tip.hide());
    map.on('movestart', () => tip.hide());
    map.on('click', 'airports', (e) => {
      const f = e.features && e.features[0]; if (!f || f.properties.on !== 1) return;
      map.easeTo({ center: f.geometry.coordinates, zoom: Math.max(map.getZoom(), 4), duration: 800 });
    });
  }
  function tipFor(f) {
    const p = f.properties, L = live();
    switch (f.layer.id) {
      case 'flights': {
        const s = statOf(p.t);
        return `<span class="t-h">${esc(p.cs)} · ${esc(s ? s.short : p.t)}${p.reg ? ' (regional partner)' : ''}</span>${tipRows([
          ['Altitude', isNum(p.alt) ? fmtInt(p.alt * 3.281) + ' ft' : '—'], ['Speed', isNum(p.spd) ? fmtInt(p.spd * 1.944) + ' kt' : '—'],
          ['Heading', isNum(p.hdg) ? fmtInt(p.hdg) + '°' : '—'], ['Carrier forecast vol', pct(s && s.avg, 0)]])}
          <span class="t-n">Position at the snapshot time (${esc(utcStamp(L.flights_time))}).</span>`;
      }
      case 'airports': {
        const a = GLOBE_AIRPORTS.find(x => x.iata === p.iata); if (!a) return '';
        const met = L.metar && L.metar[a.icao], faa = L.faa && (L.faa[a.iata] || L.faa[a.icao.replace(/^K/, '')]), al = L.alerts && L.alerts[a.iata];
        const rows = a.carriers.filter(c => GSTATE.sel.has(c.t)).map(c => {
          const s = statOf(c.t), d = L.carrier_delays && L.carrier_delays[c.t] && L.carrier_delays[c.t].today, fu = L.fuel && L.fuel.carriers && L.fuel.carriers[c.t];
          return `<span class="t-r"><span><b>${c.t}</b> ${esc(ROLE_LABEL[c.role] || c.role)}</span><span>${pct(s && s.avg, 0)} vol</span></span>` +
            (d || fu ? `<span class="t-r t-sub"><span>${d ? `Delayed ${pct(d.delayed_pct, 0)} · cancelled ${pct(d.cancelled_pct, 1)} today` : ''}</span><span>${fu ? `fuel β ${fmt(fu.fuel_beta)}` : ''}</span></span>` : '');
        }).join('');
        const faaTxt = faa ? faa.map(x => `<span class="t-r"><span>FAA: ${esc(x.kind || 'Program')}</span><span>${esc(x.reason || '')}</span></span>`).join('') : '';
        const wxTxt = met ? `<span class="t-r"><span>Weather: ${esc(WX_LABEL[met.cat] || met.cat || '—')}</span><span>${isNum(met.temp_c) ? met.temp_c + '°C' : ''}${isNum(met.wind_kt) ? ` · wind ${met.wind_kt} kt` : ''}${met.wx ? ' · ' + esc(met.wx) : ''}</span></span>` : '';
        const alTxt = al ? al.map(x => `<span class="t-r"><span>NWS: ${esc(x.event)}</span><span>${esc(x.severity || '')}</span></span>`).join('') : '';
        return `<span class="t-h">${esc(a.city)} · ${a.iata}</span>${rows}${faaTxt}${wxTxt}${alTxt}<span class="t-n">${esc(a.name)}. Click to zoom in.</span>`;
      }
      case 'storms': return `<span class="t-h">${esc(p.title)}</span>${tipRows([['Wind', isNum(p.wind) ? fmtInt(p.wind) + ' kt' : '—'], ['Last update', esc(utcStamp(p.date))]])}<span class="t-n">${p.nhc ? 'NOAA National Hurricane Center' : 'NASA EONET'}; dashed line is the track so far.</span>`;
      case 'quakes': return `<span class="t-h">Magnitude ${fmt(p.mag, 1)} earthquake</span>${tipRows([['Where', esc(p.place || '—')], ['When', esc(utcStamp(p.time))]])}<span class="t-n">USGS, past 7 days.</span>`;
      case 'fires': return `<span class="t-h">${esc(p.title)}</span>${tipRows([['Reported', esc(utcStamp(p.date))]])}<span class="t-n">NASA EONET open wildfire.</span>`;
      case 'otherhaz': return `<span class="t-h">${esc(p.title)}</span>${tipRows([['Type', esc(p.kind || '')], ['Reported', esc(utcStamp(p.date))]])}<span class="t-n">NASA EONET open event.</span>`;
      default: return '';
    }
  }

  /* ---------- legend, table, sources ---------- */
  function drawLegend() {
    const parts = [];
    parts.push(`<span class="ramp">Lower <i style="background:linear-gradient(90deg, ${volColor(SCALE.lo)}, ${volColor((SCALE.lo + SCALE.hi) / 2)}, ${volColor(SCALE.hi)})"></i> Higher forecast volatility</span>`);
    if (GSTATE.layers.airports) parts.push('<span><i class="lg ring"></i>Hub <i class="lg ring sm"></i>Other airport</span>');
    if (GSTATE.layers.delays) parts.push('<span><i class="lg ring delay"></i>FAA delay, ground stop or closure</span>');
    if (GSTATE.layers.weather) parts.push(`<span><i class="lg dot" style="background:var(--calm)"></i>Good <i class="lg dot" style="background:var(--stress)"></i>Marginal <i class="lg dot" style="background:var(--crisis)"></i>Poor flying weather</span>`);
    if (GSTATE.layers.quakes) parts.push('<span><i class="lg ring quake"></i>Earthquake (size = magnitude)</span>');
    if (GSTATE.layers.storms) parts.push('<span><i class="lg dot" style="background:var(--stress)"></i>Storm, dashed track</span>');
    if (GSTATE.layers.fires) parts.push('<span><i class="lg dot sm" style="background:var(--crisis)"></i>Wildfire</span>');
    $('#gLegend').innerHTML = parts.join('');
  }

  function drawTable() {
    const L = live(), box = $('#gTable');
    const rows = STATS.filter(s => GSTATE.sel.has(s.t));
    if (!rows.length) { box.innerHTML = '<p class="note">Select a carrier on the left to see its operating picture.</p>'; return; }
    const fuelCtx = L.fuel && L.fuel.context;
    const body = rows.map(s => {
      const mine = GLOBE_AIRPORTS.filter(a => a.carriers.some(c => c.t === s.t));
      const faaN = L.faa ? mine.filter(a => L.faa[a.iata] || L.faa[a.icao.replace(/^K/, '')]).length : null;
      const wxN = L.metar ? mine.filter(a => { const m = L.metar[a.icao]; return m && (m.cat === 'IFR' || m.cat === 'LIFR'); }).length : null;
      const alN = L.alerts ? mine.filter(a => L.alerts[a.iata]).length : null;
      const d = L.carrier_delays && L.carrier_delays[s.t] && L.carrier_delays[s.t].today;
      const fu = L.fuel && L.fuel.carriers && L.fuel.carriers[s.t];
      const air = carrierCounts(s.t);
      return `<tr><th scope="row"><a href="#/stocks/${s.t}"><b>${s.t}</b> <span class="nm">${esc(s.short)}</span></a></th>
        <td>${pct(s.avg, 0)}</td><td>${isNum(air) ? fmtInt(air) : '—'}</td>
        <td>${d ? pct(d.delayed_pct, 0) : '—'}</td><td>${d ? pct(d.cancelled_pct, 1) : '—'}</td>
        <td>${mine.length}</td><td>${isNum(faaN) ? faaN : '—'}</td><td>${isNum(wxN) ? wxN : '—'}${isNum(alN) && alN ? ` <span class="note">(${alN} alert${alN > 1 ? 's' : ''})</span>` : ''}</td>
        <td>${fu ? `${fmt(fu.fuel_beta)} <span class="note">· ${fmt(fu.exposure)}×</span>` : '—'}</td></tr>`;
    }).join('');
    box.innerHTML = `<div class="tablewrap"><table class="cmp gtbl"><thead><tr>
        <th scope="col">Carrier</th><th scope="col">2-mo forecast vol</th><th scope="col">Flights aloft</th>
        <th scope="col">Delayed today</th><th scope="col">Cancelled today</th><th scope="col">Airports</th>
        <th scope="col">FAA programs</th><th scope="col">Poor weather</th><th scope="col">Fuel beta · exposure</th></tr></thead>
      <tbody>${body}</tbody></table></div>
      <p class="note" style="margin-top:.7rem">Flights aloft and airport conditions are from the latest snapshot${L.flights_time ? ` (${esc(utcStamp(L.flights_time))})` : ''}.
      Delayed and cancelled are shares of each carrier's flights today, from FlightAware's public board.
      Fuel beta is how much the stock moves with crude oil over a year (more negative = more exposed)${fuelCtx ? `; WTI was $${fmt(fuelCtx.wti)} on ${esc(longDate(fuelCtx.as_of))}` : ''}.
      None of this is a trading signal.</p>`;
  }

  function drawSources() {
    const S = live().sources || {};
    const keys = Object.keys(SOURCE_NAMES);
    $('#gSources').innerHTML = `<ul class="srclist">${keys.map(k => {
      const s = S[k];
      let state;
      if (!s) state = '<span class="tag soon">Not run yet</span>';
      else if (s.ok) state = `<span class="tag live">Updated ${esc(ago(s.at))}</span>`;
      else state = `<span class="tag soon">Last update failed${s.last_ok ? `; showing data from ${esc(ago(s.last_ok))}` : ''}</span>`;
      return `<li><span class="nm">${esc(SOURCE_NAMES[k])}</span><span class="d">${s && s.ok ? esc(s.note || '') : s && s.error ? esc(s.error.slice(0, 140)) : ''}</span>${state}</li>`;
    }).join('')}
      <li><span class="nm">Hubs and airports · data/airports.csv</span><span class="d">Reference list from company descriptions and public network data; coordinates from public airport records. Edit the file to change a network.</span><span class="tag">Reference</span></li></ul>
      <p class="note" style="margin-top:.7rem">${GLOBE_LIVE ? `Live layers were last generated ${esc(utcStamp(live().generated))}.` : 'The live layers file (data/globe_data.json) hasn\'t been generated yet.'}
      A GitHub Action refreshes them once a day; you can also run it any time from the repository's Actions tab ("Daily update" → "Run workflow").</p>`;
  }
}
