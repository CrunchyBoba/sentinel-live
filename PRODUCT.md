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

- Six sections: Overview, Lab, Stocks, Globe, Portfolio, Glossary (hash routes in `app.js`).
- Data refresh ritual: re-run the notebook, replace `sentinel_data.json`, push; the site updates without touching HTML/JS.
- Forecast horizon comes from the data file (currently 42 trading days, "next ~2 months").
- Coverage: DAL, AAL, UAL, LUV, ALK, JBLU, ULCC, ALGT.

## Capabilities and Constraints

- Static HTML/CSS/JS, no build step, served from GitHub Pages. Vendored so the site needs no CDN: Chart.js 4.4.1 (`chart.umd.js`), topojson-client 3.1.0 (`topojson-client.min.js`) and the Natural Earth 110m world outline (`world-110m.json`).
- All model output is rendered from `sentinel_data.json`; charts and forecasts are snapshots from the last notebook run.
- One exception to data-only-from-JSON: the Globe's hub locations (`HUBS` / `CARRIER_HUBS` in `app.js`) are reference geography, not model output. DAL and AAL hubs come from the company descriptions in the data file; the others from public network information. The page labels them as such. Changing a carrier's network means editing `app.js`.
- Fuel / news / operations (the composite) are shown only when the export contains a live `composite` block. With none, every directional label is hidden and the UI says "Not live yet"; no example values are shown.
- Intentional placeholders (must stay labelled as such): Portfolio "Your own holdings" form (disabled, "Not built yet"), and interactive versions of the six Lab study models (disabled, "Interactive version not built yet").

## Brand Commitments

- Name: Sentinel.
- The "Not financial advice" disclaimer must remain prominent on every page. Nothing in the UI may read as a buy/sell/hold recommendation.

## Evidence on Hand

- Real data: `sentinel_data.json` (prices, forecasts, regimes, PCA, company info for 8 tickers).
- Source notebook: `Airline_Volatility_Model_Sentinel.ipynb`.
- No testimonials, users, track record or performance claims exist; future work must not invent them.

## Product Principles

1. Show the model's real output, and say plainly where it is a snapshot or a placeholder.
2. Risk information, never advice: signals describe volatility and regimes, not trades.
3. Readable by a non-specialist investor; jargon is explained or linked to the Glossary.
4. Updating the data must never require editing code.
