# CLAUDE.md — working on Sentinel

Sentinel is a static research site (GitHub Pages, repo `CrunchyBoba/sentinel-live`) that forecasts
two-month volatility for eight U.S. airline stocks (DAL, AAL, UAL, LUV, ALK, JBLU, ULCC, ALGT), shows the
sector on a 3D globe, and publicly scores its own forecasts. A GitHub Action re-runs everything daily.

Read before changing anything: `README.md` (how it all works), `PRODUCT.md` (what the product must and
must not do), `DESIGN.md` (the visual system; it is authoritative for look and wording).

## Pushing to `main` is publishing
- GitHub Pages serves `main` at the repo root. Every push to `main` is live within about a minute.
- The owner has asked for direct pushes to `main` (no PR) unless they say otherwise.
- The data bot commits to `main` daily. Always `git pull --rebase origin main` before you commit.
- Never commit secrets. OpenSky credentials live only in the repo secrets
  `OPENSKY_CLIENT_ID` / `OPENSKY_CLIENT_SECRET`.

## Layout
```
index.html            page shell; loads assets/* with a ?v=<date> cache-buster
assets/app.js         router + Overview, Stocks, stock pages, Portfolio, Lab, Glossary
assets/globe.js       Globe tab (MapLibre globe, panels, full-screen console); loaded before app.js
assets/styles.css     all tokens and styles (dark default, light theme)
data/                 everything the site reads (see "Data files")
pipeline/             the daily job: sentinel_model.py, update_model.py, update_globe_data.py
notebooks/            Colab notebook; imports pipeline/sentinel_model.py (no duplicate model code)
vendor/               Chart.js 4.4.1, MapLibre GL 5.24.0, topojson-client — bundled, no CDN
.github/workflows/daily-update.yml   the only workflow
```

## Data files
| File | Written by | Rule |
|---|---|---|
| `data/sentinel_data.json` | `pipeline/update_model.py` | Never hand-edit. Must be valid browser JSON: no `NaN`/`Infinity` (the writer runs `clean()` with `allow_nan=False`). |
| `data/globe_data.json` | `pipeline/update_globe_data.py` | Never hand-edit. Same JSON rule. Each source records ok / error / last_ok under `sources`. |
| `data/forecast_log.csv` | `pipeline/update_model.py` | **Append-only.** A forecast is written before its outcome exists and never changed. Resetting it is a big deal: only for a proven bug, tell the owner, and only re-log "live" rows whose outcome doesn't exist yet. |
| `data/airports.csv` | by hand | One row per carrier × airport, with coordinates. Editing it triggers the Action. |

## Rules that matter (from PRODUCT.md / DESIGN.md)
- Risk information, never advice: no buy/sell/hold wording, no BULLISH/BEARISH-style labels unless live data backs them.
- Anything not built or not live is labelled as such ("Not live yet", "Offline", "Study module") with a dashed border. Never show invented or example values.
- The "Not financial advice" disclaimer stays visible on every page.
- Misses are shown as plainly as hits in the track record.
- After changing anything in `assets/`, bump the `?v=` value on its links in `index.html`.
- Two typefaces only (Switzer, DM Mono); no entrance animation on charts; colours come from tokens in `assets/styles.css`.

## The daily pipeline
- `sentinel_model.py`: EGARCH(1,1,1) with robust fallbacks (Student-t, last 3 years, then flat realized
  variance) when a fit is unstable — ULCC's jumpy low-priced history triggers this; the variant used is
  stored in `pipeline.models.egarch.robust_variant` and shown on the stock page. TimesFM-3 is pinned to
  google-research/timesfm commit `e51928e` (see `pipeline/requirements.txt`). HMM (3 regimes), PCA.
- `update_model.py`: skips when today's close is already logged (weekends/holidays); first run on an empty
  log rebuilds ~126 trading days walk-forward as `reconstructed`. Scores next-day 95% range, 1-week and
  2-month horizons. `TRACK_START = 2026-10-26`.
- `update_globe_data.py`: OpenSky (key), FlightAware board, FAA NAS status, aviationweather.gov METAR, NWS
  alerts, USGS, NASA EONET, NOAA NHC, Yahoo (fuel). A failing source keeps previous data and records why.
- The workflow runs on schedule, on pushes to `pipeline/**`, `data/airports.csv` or the workflow file, and
  on demand (Actions → Daily update → Run workflow; "force_models" re-runs models).

## Testing
- Local preview: `python -m http.server 8000` at the repo root (opening `index.html` directly can't load `data/`).
- Claude's cloud sandbox usually **cannot reach** Yahoo, OpenSky, FAA, NOAA, USGS, NASA or Hugging Face.
  Test pipeline parsing with mocked responses or stubbed `yfinance`/`timesfm3` modules, then verify the
  real run on GitHub: push (or dispatch), wait for the run, pull, and inspect `data/` and the
  `sources` / `pipeline` blocks. Step logs need auth; the committed data is the reliable check.
- Check pages in headless Chromium (Playwright is preinstalled) for console errors; the globe needs
  `--use-gl=angle --use-angle=swiftshader --enable-unsafe-swiftshader`.

## Known issues / open items (keep this list current)
- **Schedule drift:** cron is `17 12 * * *` (12:17 UTC) but GitHub has been starting runs around
  19:30–19:50 UTC, while the U.S. market is open, so the "latest close" can be an intraday price. Fix
  options: drop today's bar if the market hasn't closed, and/or move the cron to after the close
  (e.g. ~22:30 UTC). Not fixed yet.
- FAA "Airport Closures" includes partial NOTAM-style closures (e.g. LAX general-aviation restrictions),
  so the globe's FAA ring can over-flag.
- `PRODUCT.md` "Product Purpose" still describes the old notebook-export workflow.
- `.gitignore` contains a bare `daily-update.yml` line; harmless for the tracked workflow, but it would
  hide a re-created file of that name.
- Placeholders still to build: Portfolio "your own holdings", interactive Lab models, Globe sectors other
  than Airlines, the fuel/news/operations composite in daily data.
- Ideas discussed, not started: a site chatbot (needs a small server, e.g. a Cloudflare Worker, for the
  API key), and an earlier dark redesign concept (not adopted).
