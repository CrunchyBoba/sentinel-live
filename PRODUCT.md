# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Primary: retail investors — individuals checking the risk picture of US airline stocks (volatility forecasts, market regimes, sector co-movement) before forming their own view. They are not professionals with terminal access; they need the numbers to be readable without a quant background, with the Glossary to hand when a term is unfamiliar.

## Product Purpose

Sentinel is an investment-research and education project that forecasts airline-sector volatility. It publishes the output of a Colab notebook (`Airline_Volatility_Model_Sentinel.ipynb`) as a static site: per-stock forecasts and signals, a model-portfolio view, and explanations of the models. Success means a visitor understands how risky each carrier looks over the forecast horizon, and why, without being told what to buy.

## Positioning

Real models, honestly shown. The production models (EGARCH, TimesFM, HMM regimes, PCA) run on real market data and drive the Stocks and Portfolio pages. Anything not yet built is labelled as a placeholder rather than faked. Design work must keep that line between live and placeholder visible.

## Operating Context

- Six sections: Overview, Lab, Stocks, Globe, Portfolio, Glossary (hash routes in `assets/app.js`).
- Data refresh is automatic: the **Daily update** GitHub Action (`.github/workflows/daily-update.yml`) re-runs the models after every trading day (`pipeline/update_model.py`, using `pipeline/sentinel_model.py`) and the Globe layers (`pipeline/update_globe_data.py`), then commits `data/`. The Colab notebook (`notebooks/`) imports the same model module for exploration.
- Forecast horizon comes from the data file (currently 42 trading days, "next ~2 months").
- Coverage: DAL, AAL, UAL, LUV, ALK, JBLU, ULCC, ALGT.

## Capabilities and Constraints

- Static HTML/CSS/JS, no build step, served from GitHub Pages at the repository root. The site's own code is in `assets/`. Vendored in `vendor/`: Chart.js 4.4.1, topojson-client 3.1.0, MapLibre GL 5.24.0. Fonts load from Fontshare (Switzer) and Google Fonts (DM Mono). Data in `data/`, including the Natural Earth 110m world outline.
- All model output is rendered from `data/sentinel_data.json`, rewritten after every trading day.
- The Globe is the one page with its own data. Hub and airport locations are reference geography in `data/airports.csv` (one row per carrier and airport, with coordinates), not model output; the page labels them as such. Live layers (flights, delays, airport weather, alerts, hazards, fuel) come from `globe_data.json`, which the daily Action refreshes from free public sources. Only OpenSky uses a key, stored as repository secrets. Every source records whether its last update worked, and the page shows that; a failed source keeps its previous data and says so.
- The 3D globe needs no tile server: land comes from `data/world-110m.json`. It has a full-screen console view.
- Track record: every forecast is appended to `data/forecast_log.csv` before its outcome exists and never edited. Stock pages score each model at three horizons (next-day 95% range, 1 week, 2 months). About six months before the first live run are reconstructed walk-forward and labelled "Reconstructed"; later rows are "Live". Misses are shown as plainly as hits.
- Fuel / news / operations (the composite) are shown only when the daily data contains a live `composite` block. With none, every directional label is hidden and the UI says "Not live yet"; no example values are shown.
- Intentional placeholders (must stay labelled as such): the Globe's other sectors (Banks, Energy, Shipping, Semiconductors, marked Offline), Portfolio "Your own holdings" form (disabled, "Not built yet"), and interactive versions of the six Lab study models (disabled, "Interactive version not built yet").

## Brand Commitments

- Name: Sentinel.
- The "Not financial advice" disclaimer must remain prominent on every page. Nothing in the UI may read as a buy/sell/hold recommendation.

## Evidence on Hand

- Real data: `data/sentinel_data.json` (prices, forecasts, regimes, PCA, company info, track record for 8 tickers) and `data/forecast_log.csv`.
- Model code: `pipeline/sentinel_model.py`; notebook: `notebooks/Airline_Volatility_Model_Sentinel.ipynb`.
- No testimonials, users, track record or performance claims exist; future work must not invent them.

## Product Principles

1. Show the model's real output, and say plainly where it is a snapshot or a placeholder.
2. Risk information, never advice: signals describe volatility and regimes, not trades.
3. Readable by a non-specialist investor; jargon is explained or linked to the Glossary.
4. Updating the data must never require editing code.
5. Report the model's own accuracy honestly: a run of misses must be as visible as a run of hits.
