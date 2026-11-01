"""Sentinel's volatility models, in one place.

Used by the daily GitHub Action (pipeline/update_model.py) and by the Colab
notebook (notebooks/Airline_Volatility_Model_Sentinel.ipynb), so the website
and the notebook always run the same maths.

Models
  EGARCH(1,1,1)   volatility clustering + asymmetry (bad news raises risk more)
  TimesFM-3       Google's pre-trained forecaster, run zero-shot on each
                  airline's 20-day rolling volatility, alone and with the sector
  HMM (3 states)  Calm / Stressed / Crisis regimes from the sector return
  PCA             share of each airline's risk explained by the sector factor

Units: returns are daily log returns x100 (percent). Volatility is annualized %.
"""

from __future__ import annotations

import warnings

import numpy as np
import pandas as pd

warnings.filterwarnings("ignore")

TICKERS = ["DAL", "AAL", "UAL", "LUV", "ALK", "JBLU", "ULCC", "ALGT"]
START = "2018-01-01"          # includes COVID so the models see a real crisis
HORIZON = 42                  # trading days ahead, about 2 months
N_SIMS = 300                  # simulations for multi-day EGARCH forecasts
PCA_WINDOW = 120              # trading days per PCA window
TRADING_DAYS = 252
VOL_WINDOW = 20               # TimesFM forecasts this rolling-volatility series
CONTEXT = 512                 # days of history TimesFM sees
REGIMES = ["Calm", "Stressed", "Crisis"]
TIMESFM_CHECKPOINT = "google/timesfm-3.0-pytorch"


# --------------------------------------------------------------------------- data
def download_prices(start: str = START):
    """Daily close and volume for the eight airlines (yfinance)."""
    import yfinance as yf

    raw = yf.download(TICKERS, start=start, progress=False, auto_adjust=False)
    prices = raw["Close"][TICKERS]
    volume = raw["Volume"][TICKERS]
    prices = prices.dropna(how="all")
    return prices, volume.reindex(prices.index)


def make_returns(prices: pd.DataFrame):
    """Log returns in %, the sector average, and 20-day rolling volatility series."""
    returns = (np.log(prices / prices.shift(1)) * 100).iloc[1:].dropna(how="all")
    sector = returns.mean(axis=1)
    vol_df = returns.rolling(VOL_WINDOW).std() * np.sqrt(TRADING_DAYS)
    sector_vol = sector.rolling(VOL_WINDOW).std() * np.sqrt(TRADING_DAYS)
    return returns, sector, vol_df, sector_vol


# --------------------------------------------------------------------------- HMM
def fit_hmm(sector_returns: pd.Series):
    """3-state Gaussian HMM; returns the model and the state order calm -> crisis."""
    from hmmlearn.hmm import GaussianHMM

    X = sector_returns.values.reshape(-1, 1)
    hmm = GaussianHMM(n_components=3, covariance_type="full", n_iter=200, random_state=0).fit(X)
    order = np.argsort(hmm.covars_.flatten())
    return hmm, order


def get_regimes(hmm, order, sector_returns: pd.Series):
    """Daily regime probabilities (Calm, Stressed, Crisis), labels and transition table."""
    X = sector_returns.values.reshape(-1, 1)
    probs = hmm.predict_proba(X)[:, order]
    return probs, probs.argmax(axis=1), hmm.transmat_[np.ix_(order, order)]


# --------------------------------------------------------------------------- EGARCH
def _egarch(r: pd.Series, dist: str = "normal"):
    from arch import arch_model

    return arch_model(r, vol="EGARCH", p=1, o=1, q=1, dist=dist)


def _arch_path(fitted, horizon: int) -> np.ndarray:
    f = fitted.forecast(horizon=horizon, method="simulation", simulations=N_SIMS,
                        reindex=False, random_state=np.random.RandomState(0))
    return f.variance.values[-1]


def _own_path(fitted, horizon: int) -> np.ndarray:
    """Direct simulation of the fitted EGARCH equation (normal shocks)."""
    p = fitted.params
    omega, alpha, gamma, beta = p["omega"], p["alpha[1]"], p["gamma[1]"], p["beta[1]"]
    rng = np.random.default_rng(0)
    log_var = np.full(N_SIMS, np.log(fitted.conditional_volatility.iloc[-1] ** 2))
    z = np.full(N_SIMS, fitted.std_resid.iloc[-1])
    out = []
    with np.errstate(over="ignore", invalid="ignore"):
        for _ in range(horizon):
            log_var = omega + alpha * (np.abs(z) - np.sqrt(2 / np.pi)) + gamma * z + beta * log_var
            out.append(np.exp(log_var).mean())
            z = rng.standard_normal(N_SIMS)
    return np.array(out)


def _plausible(path, r: pd.Series) -> bool:
    """A daily-variance path is plausible if it stays within a wide band around the stock's own history."""
    path = np.asarray(path, dtype=float)
    if path.size == 0 or not np.isfinite(path).all() or (path <= 0).any():
        return False
    sd = np.sqrt(path)
    long_sd, recent_sd = float(r.std()), float(r.tail(60).std())
    return sd.max() < 4 * max(long_sd, recent_sd) and sd.min() > min(long_sd, recent_sd) / 5


def _fit_ok(fitted) -> bool:
    p = fitted.params
    return bool(np.isfinite(p.values).all()) and abs(float(p["beta[1]"])) < 0.999 and np.isfinite(fitted.conditional_volatility.iloc[-1])


# Tried in order until one gives a stable fit and a plausible forecast. The first is the model;
# the others exist because short, jumpy histories (ULCC trades at a few dollars) can make the
# normal-shock fit diverge on some days.
EGARCH_VARIANTS = [("egarch", "normal", None), ("egarch-t", "t", None), ("egarch-3y", "normal", 756), ("egarch-t-3y", "t", 756)]


def egarch_variance_path(r: pd.Series, horizon: int = HORIZON):
    """Daily variance forecast (%^2) for the next `horizon` days, and the variant used.

    The variant is "egarch" normally; anything else means the standard fit was unstable on this
    history and a more robust EGARCH was used ("realized" = every fit failed, so the forecast is
    simply recent realized variance, held flat).
    """
    r = r.dropna()
    for name, dist, last_n in EGARCH_VARIANTS:
        rr = r.tail(last_n) if last_n else r
        try:
            fitted = _egarch(rr, dist).fit(disp="off", options={"maxiter": 500})
        except Exception:
            continue
        if not _fit_ok(fitted):
            continue
        try:
            path = _arch_path(fitted, horizon)
        except Exception:
            path = None
        if dist == "normal":
            own = _own_path(fitted, horizon)
            if path is None or not _plausible(path, r) or not (0.8 < path[0] / own[0] < 1.25):
                path = own
        if path is not None and _plausible(path, r):
            return np.asarray(path, dtype=float), name
    var = float(r.tail(VOL_WINDOW).var())
    return np.full(horizon, var), "realized"


def ann_vol(var_path) -> np.ndarray:
    """Daily variance path (%^2) -> annualized volatility path (%)."""
    return np.sqrt(np.asarray(var_path)) * np.sqrt(TRADING_DAYS)


# --------------------------------------------------------------------------- TimesFM
class TimesFM:
    """Lazy wrapper so the model is downloaded and loaded only when used."""

    def __init__(self):
        self._m = None

    def _load(self):
        if self._m is None:
            import torch
            from timesfm3 import ModelConfig, TimesFM3Evaluator

            self._m = TimesFM3Evaluator(ModelConfig(
                checkpoint_path=TIMESFM_CHECKPOINT, per_core_batch_size=16,
                device="cuda" if torch.cuda.is_available() else "cpu"))
        return self._m

    def paths(self, vol_df: pd.DataFrame, sector_vol: pd.Series, horizon: int = HORIZON):
        """Annualized volatility paths (8 x horizon): each airline alone, and jointly with the sector.

        Uses every row of vol_df given, so pass history only up to the forecast date.
        """
        m = self._load()
        hist = vol_df[TICKERS].dropna().iloc[-CONTEXT:]
        target = hist.values.T.astype(np.float32)
        cov = sector_vol.reindex(hist.index).values[None, :].astype(np.float32)
        alone = list(m.predict_batch([target], horizon=horizon, univariate=True,
                                     return_quantiles=True, use_symmetric_averaging=False))[0]
        together = list(m.predict_batch([target], horizon=horizon, past_only_covariates=[cov],
                                        return_quantiles=True, use_symmetric_averaging=False))[0]
        return np.asarray(alone.forecast), np.asarray(together.forecast)


# --------------------------------------------------------------------------- PCA
def sector_share(window: pd.DataFrame) -> pd.Series:
    """Share of each airline's variance explained by the first principal component (0 to 1)."""
    from sklearn.decomposition import PCA

    z = (window - window.mean()) / window.std()
    pca = PCA(n_components=1).fit(z)
    return pd.Series(pca.components_[0] ** 2 * pca.explained_variance_[0], index=window.columns)


def pca_history(aligned: pd.DataFrame, step: int = 5) -> pd.DataFrame:
    rows = {}
    for end in range(PCA_WINDOW, len(aligned) + 1, step):
        rows[aligned.index[end - 1]] = sector_share(aligned.iloc[end - PCA_WINDOW:end])
    return pd.DataFrame(rows).T


# --------------------------------------------------------------------------- forecasts for one date
MODELS = {"egarch": "EGARCH", "timesfm_alone": "TimesFM", "timesfm_together": "TimesFM + sector"}


def forecast_all(returns: pd.DataFrame, vol_df: pd.DataFrame, sector_vol: pd.Series,
                 tfm: TimesFM | None, horizon: int = HORIZON):
    """Every model's annualized-vol path for every airline, using all rows passed in.

    Returns {model: {ticker: np.ndarray(horizon)}} and {ticker: variant} where a robust EGARCH variant was needed.
    """
    out = {k: {} for k in MODELS}
    backups = {}
    for t in TICKERS:
        var, variant = egarch_variance_path(returns[t], horizon)
        out["egarch"][t] = ann_vol(var)
        if variant != "egarch":
            backups[t] = variant
    if tfm is not None:
        alone, together = tfm.paths(vol_df, sector_vol, horizon)
        for j, t in enumerate(TICKERS):
            out["timesfm_alone"][t] = alone[j]
            out["timesfm_together"][t] = together[j]
    return out, backups
