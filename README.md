# Sentinel — Airline Volatility Research

A static website (GitHub Pages) that forecasts how volatile the eight big U.S. airline stocks will be over the
next ~2 months, shows the airline sector on a live 3D globe, and keeps an honest **track record** of how good
its forecasts have been. A GitHub Action updates everything automatically after every trading day.

Sections: **Overview, Stocks, Portfolio, Globe, Lab, Glossary.**

*Not financial advice. Sentinel is an investment-research and education project.*

---

## What's in the repository

```
index.html  app.js  globe.js  styles.css     the website (served by GitHub Pages from the top level)
README.md  DESIGN.md  PRODUCT.md             docs: this file, the design system, the product brief

data/                                        everything the site reads
  sentinel_data.json     prices, forecasts, regimes, PCA, track record      (written daily)
  forecast_log.csv       every forecast ever made, append-only               (written daily)
  globe_data.json        flights, delays, weather, hazards, fuel             (written daily)
  airports.csv           each airline's hubs and airports with coordinates   (edit by hand)
  world-110m.json        world outline for the globe

pipeline/                                    the code the daily Action runs
  sentinel_model.py      the models: EGARCH, TimesFM-3, HMM regimes, PCA
  update_model.py        prices -> forecasts -> data/sentinel_data.json, logging and scoring
  update_globe_data.py   flights, FAA, weather, hazards, fuel -> data/globe_data.json
  requirements.txt

notebooks/
  Airline_Volatility_Model_Sentinel.ipynb    Colab notebook; imports pipeline/sentinel_model.py

vendor/                                      third-party libraries, bundled so the site needs no CDN
  chart.umd.js  maplibre-gl.js  maplibre-gl.css  topojson-client.min.js

.github/workflows/daily-update.yml           the daily schedule
```

## How it updates (nothing to do by hand)

The **Daily update** Action runs every day at **12:17 UTC** (7:17 AM New York in winter, before the market opens):

1. **Globe layers** → `data/globe_data.json`: OpenSky flights, FlightAware delay board, FAA airport programs,
   airport weather (aviationweather.gov), National Weather Service alerts, USGS earthquakes, NASA EONET
   (wildfires, storms, volcanoes, floods), NOAA hurricanes, and WTI crude (fuel exposure).
2. **Models** → `data/sentinel_data.json`: downloads fresh prices, re-fits EGARCH, runs TimesFM-3 (alone and
   with the sector), the HMM regimes and PCA, and writes the forecasts the Stocks, Portfolio and Overview
   pages show. On weekends and market holidays there's no new close, so this step skips itself.
3. **Track record**: today's forecasts are appended to `data/forecast_log.csv`, and every past forecast whose
   outcome is now known is scored.
4. The Action commits the data files; GitHub Pages republishes the site a minute later.

**Run it now:** repository → **Actions** → **Daily update** → **Run workflow**. Tick *Re-run the models* to
recompute even if today's close is already logged.
**Change the time or frequency:** edit the `cron` line in `.github/workflows/daily-update.yml`.

If one source fails (a website is down, an API changes), the others still update, the previous values are kept,
and the Globe's "Where this data comes from" list says which source failed and when it last worked.

### Settings the Action needs (already done)
- **Settings → Actions → General → Workflow permissions → Read and write**, so it can commit data.
- Repository secrets `OPENSKY_CLIENT_ID` and `OPENSKY_CLIENT_SECRET` for flights. Every other source is keyless.

## The track record

Every forecast is written to `data/forecast_log.csv` **before** its outcome exists and is never edited afterwards.
Each stock page then scores the three models at three horizons:

| Horizon | Question | What "good" looks like |
|---|---|---|
| Next day | Did the next day's move land inside the forecast's 95% range? | About 95 in 100 inside. Far fewer = underestimating risk; nearly all = overestimating. |
| 1 week | Forecast volatility vs actual volatility over the next 5 trading days | Small average miss, bias near zero |
| 2 months | Forecast volatility vs actual over the next 42 trading days (the model's real target) | Small average miss, bias near zero |

The record starts with about six months **reconstructed walk-forward** (each day re-run using only prices
available that day), followed by **live** forecasts logged by the daily run. The site labels which is which, and
reports both the full history and the results since **Oct 26, 2026**.

## Preview locally

Browsers block a page from reading local data files, so run a small server:

```bash
python -m http.server 8000      # then open http://localhost:8000
```

To run the pipeline yourself: `pip install torch --index-url https://download.pytorch.org/whl/cpu`,
`pip install -r pipeline/requirements.txt`, then `python pipeline/update_model.py` and
`python pipeline/update_globe_data.py` (flights need the two OpenSky variables set).

## Customizing

- **An airline's network:** edit `data/airports.csv` in Excel or Google Sheets (carrier, IATA and ICAO codes,
  role, name, city, country, lat, lon). The Action re-runs on save.
- **Model settings** (horizon, simulations, windows): the constants at the top of `pipeline/sentinel_model.py`.
- **Colours / fonts:** the tokens at the top of `styles.css`; rules in `DESIGN.md`.
- **Glossary terms:** the `GLOSSARY` array in `app.js`.

## Placeholders (labelled on the site)

- Globe: Banks, Energy, Shipping and Semiconductors sectors are shown as **Offline**.
- Portfolio: "Your own holdings" entry is visible but not built yet.
- Lab: interactive versions of the six study models aren't built yet.
- Fuel / news / operations scores on stock pages appear only when a live composite file is exported.

## Notes

- Flight positions are a **daily snapshot**, not a continuous live feed.
- TimesFM-3 weights are licensed for research and non-commercial use.
- SkyWest and Republic fly for several airlines at once, so their flights aren't attributed to a carrier.
