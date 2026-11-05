# Sentinel — project handoff (as of Nov 5, 2026)

Use this to pick up the Sentinel work in a new chat. Everything real lives in this repository; this is the map.
(A copy also lives in the "FinTech" Claude project as `Sentinel-handoff.md`.)

## What Sentinel is
An investment-research and education site (ASCEND fintech project) that forecasts how **volatile** the eight big
U.S. airline stocks will be over the **next ~2 months** (42 trading days), shows the sector on a **3D globe**, and
**publicly grades its own forecasts**. Risk size, never direction; "Not financial advice" on every page.

- **Live site:** https://crunchyboba.github.io/sentinel-live/
- **Repository:** https://github.com/CrunchyBoba/sentinel-live (public; pushes to `main` go live in ~1 minute)
- **Tickers:** DAL, AAL, UAL, LUV, ALK, JBLU, ULCC, ALGT
- **Docs here:** `README.md` (how it works), `PRODUCT.md` (product rules), `DESIGN.md` (visual system),
  `CLAUDE.md` (working notes for Claude sessions; read automatically when the repo is opened in Claude Code)

## What's built and live
- **Pages:** Overview, Stocks (8 stock pages), Portfolio, Globe, Lab, Glossary. Current look: blue-grey dark
  default with a light theme, one signature green, amber/coral only for risk, Switzer + DM Mono, top navigation
  (redesign of Nov 2–3, inspired by oxide.computer's structure).
- **Models (re-run daily):** EGARCH (with robust fallbacks for jumpy histories like ULCC), TimesFM-3 alone and
  with the sector (zero-shot, Google weights, non-commercial licence), HMM regimes (Calm/Stressed/Crisis), PCA
  (sector vs stock-specific risk).
- **Track record on each stock page:** every forecast is logged before its outcome exists and scored at three
  horizons: next day (did the move land inside the 95% range?), 1 week, and 2 months. About 6 months were
  rebuilt walk-forward ("Reconstructed"); live logging started Oct 30; results are also reported since Oct 26.
- **Globe:** MapLibre 3D globe; sector panel (Airlines live, others "Offline"); pick one/several/all carriers;
  layers for flights (OpenSky), hubs & airports, FAA delays, airport weather + NWS alerts (on by default),
  earthquakes, storms/hurricanes, wildfires, other hazards and day/night (off by default); full-screen console.
- **Daily update (GitHub Action "Daily update"):** globe layers → `data/globe_data.json`; prices + models +
  scoring → `data/sentinel_data.json` and append-only `data/forecast_log.csv`; commits; Pages republishes.
  Run manually: repo → Actions → Daily update → Run workflow.

## Early results (all 8 airlines, ~6 months rebuilt + first live days)
- EGARCH: ~95% of next-day moves inside its range (well calibrated), but its 2-month forecasts run about
  10 points too high (flagged "overestimating").
- TimesFM: ~94% inside; 2-month average miss about 8–9 points.

## Decisions made along the way
- Horizon 42 trading days ("next ~2 months"); no regime-switching EGARCH on the site.
- Regime probabilities live on Portfolio; sector-vs-stock split is a Portfolio topic.
- Nothing fake: placeholders are labelled; the fuel/news/operations composite only shows once it's in the daily data.
- Push straight to `main` (the site is for the team, not the public).
- The Nov 2 "terminal" redesign concept was **not** adopted; the site was redesigned separately instead.

## Accounts and settings (already set up)
- Repo secrets `OPENSKY_CLIENT_ID` / `OPENSKY_CLIENT_SECRET` (free OpenSky API client, 4,000 credits/day).
  Rotating the secret in OpenSky and updating the GitHub secret is recommended.
- Actions → Workflow permissions set to Read and write (needed for the bot to commit data).
- Claude has push access to the repo through the Claude GitHub App.

## Open issues and next steps
1. **Schedule drift:** the job is set for 12:17 UTC but GitHub has been starting it around 19:30–19:50 UTC,
   while the market is open, so forecasts can use an intraday price. Fix: ignore today's bar until the close
   and/or schedule after the close (~22:30 UTC).
2. FAA "closures" include partial restrictions (e.g. LAX general-aviation NOTAM), so the globe's FAA ring over-flags.
3. `PRODUCT.md` "Product Purpose" still describes the old notebook workflow.
4. Not built yet: Portfolio "your own holdings", interactive Lab models, other Globe sectors, the live
   fuel/news/operations composite (backend scripts `combine.py`, `news.py`, `delays.py`, `fuel.py` live in the
   team's other repo).
5. Idea discussed: a site chatbot. It needs a tiny server (e.g. a free Cloudflare Worker) to hold an AI API key;
   Claude Pro doesn't include API access (separate pay-as-you-go account). Roughly one session of work.

## Starting a new chat
Open a new chat in the FinTech Claude project and say something like:
"Continue the Sentinel project. Attach the repo CrunchyBoba/sentinel-live, then read its HANDOFF.md and
CLAUDE.md before changing anything."
