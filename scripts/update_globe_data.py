"""Build globe_data.json for the Sentinel Globe tab.

Runs on a schedule in GitHub Actions (.github/workflows/update-globe-data.yml).
Every source is optional: if one fails, the previous values are kept and the
failure is recorded under "sources" so the site can say what is stale.

Sources (all free; only OpenSky uses a key, read from environment secrets):
  flights    OpenSky Network /states/all, filtered to the 8 carriers' callsigns
  delays     FlightAware public cancellation board (same method as delays.py)
  faa        FAA NAS Status: ground stops, ground delays, delays, closures
  metar      aviationweather.gov: current conditions at every airport
  alerts     National Weather Service active alerts at each U.S. airport
  quakes     USGS earthquakes, magnitude 2.5+, past 7 days
  eonet      NASA EONET open events: wildfires, severe storms, volcanoes, floods
  nhc        NOAA National Hurricane Center active storms
  fuel       WTI crude pressure and each carrier's fuel beta (yfinance, as fuel.py)

Run locally:  python scripts/update_globe_data.py
"""

from __future__ import annotations

import csv
import io
import json
import math
import os
import re
import sys
import time
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
from datetime import datetime, timezone

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "globe_data.json")
AIRPORTS_CSV = os.path.join(ROOT, "data", "airports.csv")
UA = "SentinelResearch/1.0 (github.com/CrunchyBoba/sentinel-live)"

CARRIERS = {
    # ticker: (name, mainline ICAO callsign prefix, regional prefixes flying under the brand)
    "DAL": ("Delta Air Lines", "DAL", ["EDV"]),
    "AAL": ("American Airlines", "AAL", ["ENY", "PDT", "JIA"]),
    "UAL": ("United Airlines", "UAL", ["GJS", "ASH"]),
    "LUV": ("Southwest Airlines", "SWA", []),
    "ALK": ("Alaska Air Group", "ASA", ["QXE", "HAL"]),
    "JBLU": ("JetBlue Airways", "JBU", []),
    "ULCC": ("Frontier Group", "FFT", []),
    "ALGT": ("Allegiant Travel", "AAY", []),
}
# SkyWest (SKW) and Republic (RPA) fly for several brands at once, so they are left out.
PREFIX = {}
for _t, (_n, _main, _reg) in CARRIERS.items():
    PREFIX[_main] = (_t, False)
    for _r in _reg:
        PREFIX[_r] = (_t, True)


def now_iso() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def http(url: str, *, data: bytes | None = None, headers: dict | None = None, timeout: int = 45) -> bytes:
    h = {"User-Agent": UA, "Accept": "*/*"}
    h.update(headers or {})
    req = urllib.request.Request(url, data=data, headers=h)
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return r.read()


def http_json(url: str, **kw):
    return json.loads(http(url, **kw))


def rnd(x, d=3):
    try:
        x = float(x)
    except (TypeError, ValueError):
        return None
    return round(x, d) if math.isfinite(x) else None


# --------------------------------------------------------------------------- airports
def load_airports() -> list[dict]:
    by_code: dict[str, dict] = {}
    with open(AIRPORTS_CSV, newline="", encoding="utf-8") as f:
        for row in csv.DictReader(f):
            a = by_code.setdefault(row["iata"], {
                "iata": row["iata"], "icao": row["icao"], "name": row["airport_name"],
                "city": row["city"], "country": row["country"],
                "lat": float(row["lat"]), "lon": float(row["lon"]), "carriers": [],
            })
            a["carriers"].append({"t": row["carrier"], "role": row["role"]})
    return list(by_code.values())


# --------------------------------------------------------------------------- sources
def src_opensky(_airports):
    cid, secret = os.getenv("OPENSKY_CLIENT_ID"), os.getenv("OPENSKY_CLIENT_SECRET")
    headers = {}
    auth = "anonymous"
    if cid and secret:
        tok = http_json(
            "https://auth.opensky-network.org/auth/realms/opensky-network/protocol/openid-connect/token",
            data=urllib.parse.urlencode({"grant_type": "client_credentials", "client_id": cid,
                                         "client_secret": secret}).encode(),
            headers={"Content-Type": "application/x-www-form-urlencoded"})
        headers["Authorization"] = "Bearer " + tok["access_token"]
        auth = "api client"
    d = http_json("https://opensky-network.org/api/states/all", headers=headers, timeout=90)
    states = d.get("states") or []
    t0 = d.get("time") or int(time.time())
    flights, counts = [], {t: {"airborne": 0, "on_ground": 0} for t in CARRIERS}
    for s in states:
        cs = (s[1] or "").strip().upper()
        m = re.match(r"^([A-Z]{3})\d", cs)
        if not m or m.group(1) not in PREFIX:
            continue
        t, regional = PREFIX[m.group(1)]
        lon, lat, on_ground = s[5], s[6], bool(s[8])
        if lon is None or lat is None:
            continue
        if s[4] and t0 - s[4] > 180:   # last contact more than 3 minutes before the snapshot
            continue
        counts[t]["on_ground" if on_ground else "airborne"] += 1
        if on_ground:
            continue
        alt = s[13] if s[13] is not None else s[7]
        flights.append([cs, t, rnd(lon), rnd(lat), rnd(alt, 0), rnd(s[9], 0), rnd(s[10], 0), 1 if regional else 0])
    return {"flights": flights, "flight_counts": counts,
            "flights_time": datetime.fromtimestamp(t0, timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")}, \
        f"{len(flights)} airborne flights ({auth})"


def src_flightaware(_airports):
    """FlightAware's public cancellation board, as in the backend's delays.py."""
    icao_to_t = {}
    for t, (_n, main, reg) in CARRIERS.items():
        icao_to_t[main] = t
        for r in reg:
            icao_to_t.setdefault(r, t)
    out = {}
    for period in ("today", "yesterday"):
        html = http("https://www.flightaware.com/ajax/airport/cancelled_count.rvt?" + urllib.parse.urlencode(
            {"type": "airline", "timePeriod": period, "airportFilter": ""}),
            headers={"Referer": "https://www.flightaware.com/live/cancelled/", "X-Requested-With": "XMLHttpRequest",
                     "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/120 Safari/537.36"}).decode("utf-8", "replace")
        codes = re.findall(r"/live/fleet/([A-Z0-9]+)/cancelled", html)
        rows = re.findall(r"<tr[^>]*>(.*?)</tr>", html, flags=re.S)
        cells = [[re.sub(r"<[^>]+>", "", c).strip() for c in re.findall(r"<td[^>]*>(.*?)</td>", r, flags=re.S)] for r in rows]
        cells = [c for c in cells if len(c) >= 4]
        if not codes or len(codes) != len(cells):
            raise RuntimeError(f"board layout changed ({len(codes)} codes, {len(cells)} rows)")
        agg = {}
        for code, c in zip(codes, cells):
            t = icao_to_t.get(code)
            if not t:
                continue
            num = lambda v: float(re.sub(r"[^0-9.]", "", v) or 0)
            cn, cp, dn, dp = num(c[0]), num(c[1]), num(c[2]), num(c[3])
            flights = dn / (dp / 100) if dp > 0 else (cn / (cp / 100) if cp > 0 else 0)
            a = agg.setdefault(t, [0.0, 0.0, 0.0])
            a[0] += cn; a[1] += dn; a[2] += flights
        for t, (cn, dn, fl) in agg.items():
            o = out.setdefault(t, {})
            o[period] = {"cancelled_n": int(cn), "delayed_n": int(dn),
                         "cancelled_pct": rnd(100 * cn / fl, 2) if fl else None,
                         "delayed_pct": rnd(100 * dn / fl, 2) if fl else None}
    return {"carrier_delays": out}, f"{len(out)} of 8 carriers on the board"


def src_faa(airports):
    raw = http("https://nasstatus.faa.gov/api/airport-status-information")
    root = ET.fromstring(raw)
    wanted = {a["iata"] for a in airports} | {a["icao"][1:] for a in airports if a["icao"].startswith("K")}
    events = {}

    def walk(node, kind):
        name = node.find("Name")
        if name is not None and name.text:
            kind = name.text.strip()
        arpt = node.find("ARPT")
        if arpt is not None and arpt.text:
            code = arpt.text.strip().upper()
            if code in wanted:
                info = {"kind": kind}
                for ch in node:
                    if ch.tag == "ARPT":
                        continue
                    txt = " ".join(t.strip() for t in ch.itertext() if t.strip())
                    if txt:
                        key = ch.tag.lower()
                        if ch.attrib.get("Type"):
                            key += "_" + ch.attrib["Type"].lower()
                        info[key] = txt[:160]
                events.setdefault(code, []).append(info)
            return
        for ch in node:
            walk(ch, kind)

    walk(root, "")
    upd = root.findtext(".//Update_Time")
    return {"faa": events, "faa_updated": upd}, f"{len(events)} covered airports with FAA programs"


def flight_category(ob: dict) -> str | None:
    cat = ob.get("fltCat") or ob.get("flightCategory")
    if cat:
        return str(cat).upper()
    ceil = None
    for c in ob.get("clouds") or []:
        if str(c.get("cover", "")).upper() in ("BKN", "OVC", "OVX") and c.get("base") is not None:
            ceil = c["base"] if ceil is None else min(ceil, c["base"])
    vis = ob.get("visib")
    try:
        vis = float(str(vis).replace("+", "")) if vis is not None else None
    except ValueError:
        vis = None
    if ceil is None and vis is None:
        return None
    c, v = (ceil if ceil is not None else 99999), (vis if vis is not None else 99)
    if c < 500 or v < 1:
        return "LIFR"
    if c < 1000 or v < 3:
        return "IFR"
    if c <= 3000 or v <= 5:
        return "MVFR"
    return "VFR"


def src_metar(airports):
    ids = ",".join(a["icao"] for a in airports)
    obs = http_json("https://aviationweather.gov/api/data/metar?" + urllib.parse.urlencode({"ids": ids, "format": "json"}))
    out = {}
    for ob in obs or []:
        icao = ob.get("icaoId") or ob.get("station_id")
        if not icao or icao in out:
            continue
        out[icao] = {"cat": flight_category(ob), "wx": ob.get("wxString"), "temp_c": rnd(ob.get("temp"), 0),
                     "wind_kt": rnd(ob.get("wspd"), 0), "gust_kt": rnd(ob.get("wgst"), 0),
                     "vis": ob.get("visib"), "raw": (ob.get("rawOb") or "")[:160], "time": ob.get("reportTime") or ob.get("obsTime")}
    return {"metar": out}, f"{len(out)} airports reporting"


def src_alerts(airports):
    out = {}
    us = [a for a in airports if a["country"] in ("US", "PR", "GU")]
    for a in us:
        try:
            d = http_json(f"https://api.weather.gov/alerts/active?point={a['lat']:.4f},{a['lon']:.4f}",
                          headers={"Accept": "application/geo+json"}, timeout=30)
        except Exception:
            continue
        keep = []
        for f in d.get("features") or []:
            p = f.get("properties") or {}
            if p.get("severity") not in ("Moderate", "Severe", "Extreme"):
                continue
            keep.append({"event": p.get("event"), "severity": p.get("severity"), "ends": p.get("ends") or p.get("expires"),
                         "headline": (p.get("headline") or "")[:200]})
        if keep:
            out[a["iata"]] = keep[:4]
        time.sleep(0.25)
    return {"alerts": out}, f"{len(out)} of {len(us)} U.S. airports under an alert"


def src_quakes(_airports):
    d = http_json("https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/2.5_week.geojson")
    q = []
    for f in d.get("features") or []:
        p, g = f.get("properties") or {}, (f.get("geometry") or {}).get("coordinates") or []
        if len(g) < 2 or p.get("mag") is None:
            continue
        q.append({"lon": rnd(g[0]), "lat": rnd(g[1]), "mag": rnd(p["mag"], 1), "place": p.get("place"),
                  "time": datetime.fromtimestamp((p.get("time") or 0) / 1000, timezone.utc).strftime("%Y-%m-%dT%H:%MZ"),
                  "url": p.get("url")})
    q.sort(key=lambda x: -x["mag"])
    return {"earthquakes": q}, f"{len(q)} earthquakes M2.5+ in 7 days"


def _point(geom):
    c, t = geom.get("coordinates"), geom.get("type")
    if t == "Point":
        return c[0], c[1]
    if t == "Polygon" and c and c[0]:
        ring = c[0]
        return sum(p[0] for p in ring) / len(ring), sum(p[1] for p in ring) / len(ring)
    return None


def src_eonet(_airports):
    d = http_json("https://eonet.gsfc.nasa.gov/api/v3/events?status=open&days=30")
    fires, storms, other = [], [], []
    for e in d.get("events") or []:
        cats = [c.get("id") for c in e.get("categories") or []]
        geoms = [g for g in e.get("geometry") or [] if _point(g)]
        if not geoms:
            continue
        last = geoms[-1]
        lon, lat = _point(last)
        base = {"title": e.get("title"), "lon": rnd(lon), "lat": rnd(lat), "date": last.get("date"),
                "url": (e.get("sources") or [{}])[0].get("url")}
        if "wildfires" in cats:
            fires.append(base)
        elif "severeStorms" in cats:
            base["track"] = [[rnd(_point(g)[0]), rnd(_point(g)[1])] for g in geoms]
            base["wind_kt"] = rnd(last.get("magnitudeValue"), 0) if last.get("magnitudeUnit") == "kts" else None
            storms.append(base)
        elif cats and cats[0] in ("volcanoes", "floods", "landslides", "seaLakeIce", "dustHaze", "tempExtremes", "snow", "drought"):
            base["kind"] = cats[0]
            other.append(base)
    return {"wildfires": fires, "storms": storms, "hazards_other": other}, \
        f"{len(fires)} wildfires, {len(storms)} storms, {len(other)} other"


def src_nhc(_airports):
    d = http_json("https://www.nhc.noaa.gov/CurrentStorms.json")
    out = []
    for s in d.get("activeStorms") or []:
        lat, lon = s.get("latitudeNumeric"), s.get("longitudeNumeric")
        if lat is None or lon is None:
            continue
        out.append({"name": s.get("name"), "class": s.get("classification"), "lat": rnd(lat), "lon": rnd(lon),
                    "wind_kt": rnd(s.get("intensity"), 0), "pressure": s.get("pressure"),
                    "movement": f"{s.get('movementDir', '')} at {s.get('movementSpeed', '')} mph".strip(),
                    "updated": s.get("lastUpdate"), "url": "https://www.nhc.noaa.gov/"})
    return {"nhc": out}, f"{len(out)} active Atlantic/Pacific storms"


def src_fuel(_airports):
    """WTI pressure and per-carrier fuel beta, following fuel.py."""
    import numpy as np
    import yfinance as yf

    tick = list(CARRIERS) + ["CL=F"]
    px = yf.download(tick, period="1y", progress=False, auto_adjust=True)["Close"]
    oil = px["CL=F"].dropna()
    rets = np.log(px / px.shift(1))
    mom5 = float(oil.iloc[-1] / oil.iloc[-6] - 1)
    mom20 = float(oil.iloc[-1] / oil.iloc[-21] - 1)
    lo, hi = float(oil.min()), float(oil.max())
    rng = (float(oil.iloc[-1]) - lo) / (hi - lo) if hi > lo else 0.5
    orets = rets["CL=F"]
    v20, v60 = float(orets.tail(20).std()), float(orets.tail(60).std())
    pressure = 2 * mom5 + mom20 + 0.5 * (rng - 0.5) + 0.3 * ((v20 / v60 if v60 else 1) - 1)
    betas = {}
    for t in CARRIERS:
        pair = rets[[t, "CL=F"]].dropna()
        if len(pair) >= 60 and pair["CL=F"].var() > 0:
            betas[t] = float(pair.cov().loc[t, "CL=F"] / pair["CL=F"].var())
    mb = sum(betas.values()) / len(betas)
    sb = (sum((b - mb) ** 2 for b in betas.values()) / len(betas)) ** 0.5 or 1
    out = {}
    for t, b in betas.items():
        expo = min(1.75, max(0.25, 1 - 0.5 * (b - mb) / sb))
        out[t] = {"fuel_beta": rnd(b, 3), "exposure": rnd(expo, 2), "fuel_impact": rnd(-pressure * expo, 3)}
    ctx = {"wti": rnd(oil.iloc[-1], 2), "mom_5d": rnd(mom5, 4), "mom_20d": rnd(mom20, 4), "pct_of_1y_range": rnd(rng, 3),
           "oil_pressure": rnd(pressure, 3), "as_of": str(oil.index[-1].date())}
    return {"fuel": {"context": ctx, "carriers": out}}, f"WTI ${ctx['wti']}, pressure {ctx['oil_pressure']:+.3f}"


SOURCES = [
    ("opensky", src_opensky), ("flightaware", src_flightaware), ("faa", src_faa), ("metar", src_metar),
    ("alerts", src_alerts), ("quakes", src_quakes), ("eonet", src_eonet), ("nhc", src_nhc), ("fuel", src_fuel),
]


def main() -> int:
    airports = load_airports()
    try:
        with open(OUT, encoding="utf-8") as f:
            prev = json.load(f)
    except Exception:
        prev = {}
    out = {k: v for k, v in prev.items() if k not in ("generated", "airports", "carriers", "sources")}
    sources = dict(prev.get("sources") or {})
    ok_count = 0
    for name, fn in SOURCES:
        t0 = time.time()
        try:
            data, note = fn(airports)
            out.update(data)
            sources[name] = {"ok": True, "at": now_iso(), "note": note, "secs": round(time.time() - t0, 1)}
            ok_count += 1
            print(f"[ok]   {name:12s} {note}")
        except Exception as exc:  # keep previous values, record why
            old = sources.get(name) or {}
            sources[name] = {"ok": False, "at": now_iso(), "error": f"{type(exc).__name__}: {str(exc)[:300]}",
                             "last_ok": old.get("at") if old.get("ok") else old.get("last_ok")}
            print(f"[fail] {name:12s} {sources[name]['error']}", file=sys.stderr)
    out["generated"] = now_iso()
    out["airports"] = airports
    out["carriers"] = {t: {"name": n, "callsign": m, "regional": r} for t, (n, m, r) in CARRIERS.items()}
    out["sources"] = sources
    with open(OUT, "w", encoding="utf-8") as f:
        json.dump(out, f, separators=(",", ":"))
    print(f"wrote {OUT} ({os.path.getsize(OUT) / 1024:.0f} KB), {ok_count}/{len(SOURCES)} sources ok")
    return 0


if __name__ == "__main__":
    sys.exit(main())
