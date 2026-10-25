# Sentinel — Volatility Research Site

A static website for Sentinel's airline-volatility research. It reads one data file
(`sentinel_data.json`, produced by your Colab notebook) and renders six sections:
**Overview, Lab, Stocks, Globe, Portfolio, Glossary.**

It is a real, live site — not a demo. Everything is plain HTML/CSS/JavaScript with no
build step and no server code, so it runs anywhere that serves static files, including
GitHub Pages for free.

---

## Files in this folder

| File | What it is | Do you edit it? |
|---|---|---|
| `index.html` | Page shell, nav bar, footer | Rarely |
| `styles.css` | All styling / theme | To restyle |
| `app.js` | The whole app: router + all six tabs | To change behavior |
| `chart.umd.js` | Chart.js 4.4.1 (bundled so the site needs no internet) | No |
| `sentinel_data.json` | **Your data** — prices, forecasts, regimes, PCA | **Replace this to update the site** |
| `.nojekyll` | Tells GitHub Pages to serve files as-is | No |
| `README.md` | This file | — |

---

## 1. Preview it on your own computer first

You can't just double-click `index.html` — browsers block a page from reading a local
`.json` file for security. Run a tiny local server instead:

```bash
cd sentinel
python -m http.server 8000
```

Then open **http://localhost:8000** in your browser. (Any static server works; this one
ships with Python.)

---

## 2. Put it on GitHub and go live (GitHub Pages)

### Option A — the web interface (no command line)

1. Go to <https://github.com/new> and create a repository, e.g. **`sentinel-site`**.
   Make it **Public** (Pages is free for public repos). Don't add a README (you have one).
2. On the new repo's page click **“uploading an existing file.”**
3. Drag in **all the files in this folder** — `index.html`, `styles.css`, `app.js`,
   `chart.umd.js`, `sentinel_data.json`, `.nojekyll`, `README.md`.
   *(If the `.nojekyll` file is hard to drag because it starts with a dot, you can skip it —
   it only matters if a filename ever starts with an underscore.)*
4. Click **Commit changes**.
5. Go to **Settings → Pages** (left sidebar).
6. Under **Build and deployment → Source**, choose **Deploy from a branch**.
   Set **Branch** to `main` and folder to `/ (root)`. Click **Save**.
7. Wait ~1 minute. The page will show your live URL, like:
   **`https://<your-username>.github.io/sentinel-site/`**

That's it. Share that link.

### Option B — with git (command line)

```bash
cd sentinel
git init
git add .
git commit -m "Sentinel research site"
git branch -M main
git remote add origin https://github.com/<your-username>/sentinel-site.git
git push -u origin main
```

Then do steps 5–7 above (Settings → Pages) to turn Pages on.

---

## 3. Update the data later (this is the whole point)

Whenever you re-run the Colab notebook:

1. It downloads a fresh **`sentinel_data.json`**.
2. Replace the old `sentinel_data.json` in your repo with the new one
   (on GitHub: open the file → trash icon or **Upload files** → commit;
   or `git add sentinel_data.json && git commit -m "update data" && git push`).
3. The live site updates automatically within a minute. **You never touch the HTML/JS.**

### Getting the news / delays / fuel numbers in

The Stocks pages show a “fuel / news / operations” read and a BULLISH–BEARISH signal.
Right now the site is using your **Sept-20 example** values as a placeholder (it says so
on the page). To show live numbers:

1. Run your `combine.py` so it writes `composite_<date>.csv`.
2. In Colab, drag that CSV into the **Files** panel on the left (or put it in an `output/`
   folder) **before** running the final export cell.
3. The notebook picks it up automatically and bakes it into `sentinel_data.json`.
   Re-upload that JSON and the placeholder note disappears.

---

## What's intentionally a placeholder

These match where your backend is today — nothing here is broken:

- **Globe tab** — empty on purpose; the geospatial backend isn't built yet.
- **Portfolio → “Enter your own holdings”** — the form is visible but disabled
  (“Add · soon”), since custom-portfolio analysis isn't wired up. The **Model Airlines
  Portfolio** with equal/random weights, the PCA, correlation heatmap and regime chart
  are all live off your real data.
- **Lab → “Open model”** buttons — disabled (“soon”). The six study models
  (LR, ARIMA, LSTM, Transformer, Random Forest, XGBoost) are described; the interactive
  runner isn't built. The four production models (EGARCH, TimesFM, HMM, PCA) are real and
  power the Stocks/Portfolio pages.
- **Forecasts & charts** — fixed snapshots from the last notebook run, as you asked.
  They refresh only when you drop in a new `sentinel_data.json`.

---

## Customizing

- **Colors / fonts:** all theme variables are at the top of `styles.css` (`:root { … }`).
- **Glossary terms:** edit the `GLOSSARY` array near the bottom of `app.js`.
- **Lab model descriptions:** edit the `groups` array in `renderLab()` in `app.js`.
- **The company blurbs / narrative wording:** `buildNarrative()` in `app.js`.

No rebuild needed — save the file, refresh the page.

---

*Not financial advice. Sentinel is an investment-research and education project.*
