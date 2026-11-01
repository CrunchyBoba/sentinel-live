"""Daily model run: fresh prices -> forecasts -> data/sentinel_data.json, plus the track record.

Run by .github/workflows/daily-update.yml after each trading day. Steps:
  1. Download prices for the eight airlines (yfinance).
  2. Forecast the next 42 trading days with EGARCH and TimesFM (alone / with sector),
     fit the HMM regimes and the PCA sector split.
  3. Append today's forecasts to data/forecast_log.csv. The log is append-only: a forecast is
     written before its outcome exists and is never edited afterwards.
  4. On the first run (or with --backfill N) rebuild the past N trading days walk-forward,
     using only data available on each day, and log those rows as "reconstructed".
  5. Score every logged forecast whose outcome is now known, at three horizons:
       next day  did the next day's move land inside the 95% range implied by the forecast?
       1 week    forecast vs actual volatility over the next 5 trading days
       2 months  forecast vs actual volatility over the next 42 trading days (the model's target)

Usage:  python pipeline/update_model.py [--backfill 126] [--no-timesfm] [--force]
"""

from __future__ import annotations

import argparse
import csv
import json
import math
import os
import sys
import time
from datetime import datetime, timezone

import numpy as np
import pandas as pd

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import sentinel_model as M  # noqa: E402

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_FILE = os.path.join(ROOT, "data", "sentinel_data.json")
LOG_FILE = os.path.join(ROOT, "data", "forecast_log.csv")
LOG_COLS = ["made_on", "ticker", "model", "d1_vol", "w1_vol", "m2_vol", "source", "logged_at"]
TRACK_START = "2026-10-26"     # the live track record is reported from this trading day
BACKFILL_DAYS = 126            # about six months of trading days
N_HIST = 252
Z95 = 1.959964
WEEK = 5

INFO_KEYS = ["shortName", "longName", "longBusinessSummary", "sector", "industry", "website",
             "fullTimeEmployees", "marketCap", "currentPrice", "regularMarketPrice",
             "bid", "ask", "trailingPE", "forwardPE", "pegRatio", "trailingPegRatio",
             "fiftyTwoWeekHigh", "fiftyTwoWeekLow", "beta", "averageVolume"]


def num(x, d=4):
    try:
        x = float(x)
    except (TypeError, ValueError):
        return None
    return round(x, d) if math.isfinite(x) else None


def nums(seq, d=4):
    return [num(v, d) for v in seq]


def days(idx):
    return [pd.Timestamp(d).strftime("%Y-%m-%d") for d in idx]


def now_iso():
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def rms(a) -> float:
    a = np.asarray(a, dtype=float)
    return float(np.sqrt(np.mean(a ** 2)))


# --------------------------------------------------------------------------- forecast log
def read_log() -> pd.DataFrame:
    if not os.path.exists(LOG_FILE):
        return pd.DataFrame(columns=LOG_COLS)
    return pd.read_csv(LOG_FILE, dtype={"made_on": str, "ticker": str, "model": str, "source": str})


def append_log(rows: list[dict]):
    new = not os.path.exists(LOG_FILE)
    with open(LOG_FILE, "a", newline="") as f:
        w = csv.DictWriter(f, fieldnames=LOG_COLS)
        if new:
            w.writeheader()
        for r in rows:
            w.writerow(r)


def log_rows(made_on: str, paths: dict, source: str) -> list[dict]:
    stamp = now_iso()
    rows = []
    for model, by_t in paths.items():
        for t, p in by_t.items():
            p = np.asarray(p, dtype=float)
            rows.append({"made_on": made_on, "ticker": t, "model": model,
                         "d1_vol": round(float(p[0]), 4), "w1_vol": round(rms(p[:WEEK]), 4),
                         "m2_vol": round(rms(p[:M.HORIZON]), 4), "source": source, "logged_at": stamp})
    return rows


# --------------------------------------------------------------------------- scoring
def verdict_band(hit: float | None, calib: float | None) -> str | None:
    if hit is None or calib is None:
        return None
    if calib > 1.25 or hit < 0.90:
        return "under"
    if calib < 0.80:
        return "over"
    return "ok"


def verdict_bias(bias: float | None, actual_mean: float | None) -> str | None:
    if bias is None or not actual_mean:
        return None
    rel = bias / actual_mean
    if rel > 0.15:
        return "over"
    if rel < -0.15:
        return "under"
    return "ok"


def score(log: pd.DataFrame, returns: pd.DataFrame) -> dict:
    """Join every logged forecast to what happened afterwards and summarise."""
    idx = {d.strftime("%Y-%m-%d"): i for i, d in enumerate(returns.index)}
    n = len(returns)
    recs = []
    for r in log.itertuples(index=False):
        i = idx.get(r.made_on)
        if i is None or r.ticker not in returns:
            continue
        ret = returns[r.ticker].values
        sig_d = float(r.d1_vol) / math.sqrt(M.TRADING_DAYS)       # forecast daily sd, in %
        rec = {"made_on": r.made_on, "ticker": r.ticker, "model": r.model, "source": r.source,
               "sigma_d": sig_d, "w1_vol": float(r.w1_vol), "m2_vol": float(r.m2_vol)}
        if i + 1 < n and np.isfinite(ret[i + 1]):
            rec["next_ret"] = float(ret[i + 1])
            rec["next_date"] = returns.index[i + 1].strftime("%Y-%m-%d")
            rec["inside"] = 1.0 if abs(ret[i + 1]) <= Z95 * sig_d else 0.0
            rec["z"] = ret[i + 1] / sig_d if sig_d else np.nan
        for key, h in (("w1", WEEK), ("m2", M.HORIZON)):
            if i + h < n:
                fut = ret[i + 1:i + 1 + h]
                fut = fut[np.isfinite(fut)]
                if len(fut) == h:
                    rec[key + "_actual"] = rms(fut) * math.sqrt(M.TRADING_DAYS)
        recs.append(rec)
    df = pd.DataFrame(recs)
    if df.empty:
        return {"tickers": {}, "sector": {}}

    def summarise(d: pd.DataFrame) -> dict:
        out = {}
        nd = d.dropna(subset=["next_ret"]) if "next_ret" in d else d.iloc[0:0]
        if len(nd):
            hit = float(nd["inside"].astype(float).mean())
            calib = float(np.sqrt(np.nanmean(nd["z"].astype(float) ** 2)))
            out["day"] = {"n": int(len(nd)), "inside": int(nd["inside"].astype(float).sum()), "hit": round(hit, 4),
                          "calib": round(calib, 3), "verdict": verdict_band(hit, calib)}
        for key in ("w1", "m2"):
            col = key + "_actual"
            if col in d:
                dd = d.dropna(subset=[col])
                if len(dd):
                    err = dd[key + "_vol"] - dd[col]
                    out[key] = {"n": int(len(dd)), "mae": round(float(err.abs().mean()), 2),
                                "bias": round(float(err.mean()), 2), "actual_mean": round(float(dd[col].mean()), 2),
                                "verdict": verdict_bias(float(err.mean()), float(dd[col].mean()))}
        return out

    def windows(d: pd.DataFrame) -> dict:
        return {"all": summarise(d), "since": summarise(d[d["made_on"] >= TRACK_START]),
                "live": summarise(d[d["source"] == "live"])}

    track = {"tickers": {}, "sector": {}}
    for m in M.MODELS:
        dm = df[df["model"] == m]
        if dm.empty:
            continue
        track["sector"][m] = windows(dm)
        for t in M.TICKERS:
            dt = dm[dm["ticker"] == t].sort_values("made_on")
            if dt.empty:
                continue
            tail = dt.tail(BACKFILL_DAYS + 30)
            entry = windows(dt)
            entry["series"] = {
                "made_on": tail["made_on"].tolist(),
                "next_date": [d if isinstance(d, str) else None for d in tail.get("next_date", pd.Series([None] * len(tail)))],
                "source": [s[0] for s in tail["source"]],                      # l = live, r = reconstructed
                "band": nums(Z95 * tail["sigma_d"], 3),                         # 95% range for the next day, in %
                "next_ret": nums(tail.get("next_ret", pd.Series([None] * len(tail))), 3),
                "m2_vol": nums(tail["m2_vol"], 2),
                "m2_actual": nums(tail.get("m2_actual", pd.Series([None] * len(tail))), 2),
                "w1_vol": nums(tail["w1_vol"], 2),
                "w1_actual": nums(tail.get("w1_actual", pd.Series([None] * len(tail))), 2),
            }
            track["tickers"].setdefault(t, {})[m] = entry
    return track


# --------------------------------------------------------------------------- main
def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--backfill", type=int, default=None, help="rebuild this many past trading days")
    ap.add_argument("--no-timesfm", action="store_true")
    ap.add_argument("--force", action="store_true", help="run even if today's close is already logged")
    args = ap.parse_args()
    t0 = time.time()

    prev = {}
    if os.path.exists(DATA_FILE):
        with open(DATA_FILE) as f:
            prev = json.load(f)
    status = dict(prev.get("pipeline", {}).get("models", {}))

    prices, volume = M.download_prices()
    returns, sector, vol_df, sector_vol = M.make_returns(prices)
    last = returns.index[-1].strftime("%Y-%m-%d")
    log = read_log()
    print(f"prices to {last}; {len(log)} rows in the forecast log")

    already = ((log["made_on"] == last) & (log["source"] == "live")).any() if len(log) else False
    if already and not args.force and args.backfill is None:
        print("No new trading day since the last run; nothing to do.")
        return 0

    tfm = None
    if not args.no_timesfm:
        try:
            tfm = M.TimesFM()
            tfm._load()
            status["timesfm"] = {"ok": True, "at": now_iso()}
        except Exception as exc:
            tfm = None
            status["timesfm"] = {"ok": False, "at": now_iso(), "error": f"{type(exc).__name__}: {str(exc)[:300]}",
                                 "last_ok": (prev.get("pipeline", {}).get("models", {}).get("timesfm") or {}).get("at")}
            print("TimesFM unavailable:", status["timesfm"]["error"], file=sys.stderr)

    # ---- walk-forward rebuild of past days (first run, or on request) ----
    n_back = args.backfill
    has_rebuild = bool(len(log)) and bool((log["source"] == "reconstructed").any())
    if n_back is None and not has_rebuild:
        n_back = BACKFILL_DAYS
    if n_back:
        logged = set(zip(log["made_on"], log["model"])) if len(log) else set()
        last_i = len(returns) - 1
        rows = []
        for i in range(max(M.CONTEXT + M.VOL_WINDOW, last_i - n_back), last_i):
            d = returns.index[i].strftime("%Y-%m-%d")
            if all((d, m) in logged for m in M.MODELS):
                continue
            paths, _ = M.forecast_all(returns.iloc[:i + 1], vol_df.iloc[:i + 1], sector_vol.iloc[:i + 1], tfm)
            paths = {m: p for m, p in paths.items() if p and (d, m) not in logged}
            rows += log_rows(d, paths, "reconstructed")
            if (last_i - i) % 10 == 0:
                print(f"  rebuilt to {d} ({time.time() - t0:.0f}s)", flush=True)
        append_log(rows)
        print(f"rebuilt {len(rows)} reconstructed forecasts")

    # ---- today's forecasts ----
    paths, backups = M.forecast_all(returns, vol_df, sector_vol, tfm)
    if not already:
        append_log(log_rows(last, {m: p for m, p in paths.items() if p}, "live"))
    status["egarch"] = {"ok": True, "at": now_iso(), "backup_used": backups}
    log = read_log()

    # ---- regimes and PCA ----
    hmm, order = M.fit_hmm(sector)
    probs, _labels, trans = M.get_regimes(hmm, order, sector)
    aligned = returns.dropna()
    win = aligned.tail(M.PCA_WINDOW)
    from sklearn.decomposition import PCA
    z = (win - win.mean()) / win.std()
    pca3 = PCA(n_components=3).fit(z)
    hist = M.pca_history(aligned)
    latest_share = M.sector_share(win)

    # ---- assemble the site file (same layout the notebook export used) ----
    import yfinance as yf

    future = pd.bdate_range(returns.index[-1] + pd.Timedelta(days=1), periods=M.HORIZON)
    out = {
        "generated": datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M"),
        "data_through": last,
        "horizon_days": M.HORIZON,
        "horizon_label": "next ~2 months",
        "tickers": M.TICKERS,
        "forecast_dates": days(future),
        "stocks": {},
        "composite": prev.get("composite", {}),
    }
    for t in M.TICKERS:
        px = prices[t].dropna()
        tail = px.tail(N_HIST)
        try:
            info = yf.Ticker(t).info or {}
            snap = {k: info.get(k) for k in INFO_KEYS}
        except Exception:
            snap = (prev.get("stocks", {}).get(t) or {}).get("info", {})
        realized = vol_df[t].dropna().tail(N_HIST)
        prev_s = prev.get("stocks", {}).get(t, {})

        def path_or_prev(model, key):
            if paths.get(model, {}).get(t) is not None:
                return nums(paths[model][t], 2)
            return prev_s.get(key)

        eg, ta, tt = path_or_prev("egarch", "egarch_path"), path_or_prev("timesfm_alone", "timesfm_alone_path"), \
            path_or_prev("timesfm_together", "timesfm_together_path")
        avg = lambda p: num(rms([v for v in (p or []) if v is not None]), 2) if p else None
        out["stocks"][t] = {
            "info": snap,
            "price": {"dates": days(tail.index), "close": nums(tail.values, 2),
                      "ma50": nums(px.rolling(50).mean().reindex(tail.index).values, 2),
                      "ma200": nums(px.rolling(200).mean().reindex(tail.index).values, 2),
                      "volume": nums(volume[t].reindex(tail.index).values, 0)},
            "realized_vol": {"dates": days(realized.index), "values": nums(realized.values, 2)},
            "egarch_path": eg, "timesfm_alone_path": ta, "timesfm_together_path": tt,
            "forecast_avg": {"egarch": avg(eg), "timesfm_alone": avg(ta), "timesfm_together": avg(tt)},
        }
    p_tail = pd.DataFrame(probs, index=sector.index, columns=M.REGIMES).tail(N_HIST)
    out["regimes"] = {"dates": days(p_tail.index), **{k: nums(p_tail[k].values, 3) for k in M.REGIMES},
                      "current": {k: num(v, 3) for k, v in zip(M.REGIMES, probs[-1])},
                      "transition": [nums(r, 3) for r in trans]}
    corr = win.corr()
    out["portfolio"] = {
        "returns_dates": days(aligned.tail(N_HIST).index),
        "returns": {t: nums(aligned[t].tail(N_HIST).values, 3) for t in M.TICKERS},
        "correlation": {t: nums(corr[t].values, 3) for t in M.TICKERS},
        "pca_explained": nums(pca3.explained_variance_ratio_, 3),
        "pca_loadings": {t: nums(pca3.components_[:, k], 3) for k, t in enumerate(M.TICKERS)},
        "sector_share_latest": {t: num(latest_share[t], 3) for t in M.TICKERS},
        "sector_share_history": {"dates": days(hist.index), **{t: nums(hist[t].values, 3) for t in M.TICKERS}},
    }
    out["track"] = score(log, returns)
    out["track"].update({"start": TRACK_START, "z95": Z95, "models": M.MODELS,
                         "first_live": log.loc[log["source"] == "live", "made_on"].min() if (log["source"] == "live").any() else None})
    out["pipeline"] = {"models": status, "seconds": round(time.time() - t0)}

    with open(DATA_FILE, "w") as f:
        json.dump(out, f, separators=(",", ":"), default=str)
    print(f"wrote {DATA_FILE} ({os.path.getsize(DATA_FILE) / 1024:.0f} KB) in {time.time() - t0:.0f}s")
    return 0


if __name__ == "__main__":
    sys.exit(main())
