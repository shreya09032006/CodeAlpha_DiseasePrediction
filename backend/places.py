"""Map lookups done on the server.

Browsers get blocked when the free public map servers are busy (they answer errors
without CORS headers). Asking from the server avoids that, lets us try several
mirrors, and lets us remember recent answers.
"""
import time
from typing import Any, Dict, Tuple

import httpx
from fastapi import APIRouter, HTTPException, Query

router = APIRouter(prefix="/places", tags=["places"])

USER_AGENT = "CuraSense-AI/1.0 (student health project; github.com/shreya09032006)"
OVERPASS_MIRRORS = [
    "https://overpass-api.de/api/interpreter",
    "https://overpass.private.coffee/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
    "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
]
NOMINATIM = "https://nominatim.openstreetmap.org/search"
CACHE_SECONDS = 600
MAX_TOTAL_SECONDS = 50

_cache: Dict[str, Tuple[float, Any]] = {}


def _get(key: str):
    hit = _cache.get(key)
    if hit and hit[0] > time.time():
        return hit[1]
    return None


def _put(key: str, value: Any):
    if len(_cache) > 500:  # keep memory small on the free plan
        _cache.clear()
    _cache[key] = (time.time() + CACHE_SECONDS, value)


@router.get("/geocode")
def geocode(q: str = Query(..., min_length=2, max_length=120)):
    """Turn an area name into coordinates. Returns the same list shape Nominatim uses."""
    key = "g:" + q.strip().lower()
    cached = _get(key)
    if cached is not None:
        return cached
    try:
        r = httpx.get(
            NOMINATIM,
            params={"format": "jsonv2", "limit": 1, "countrycodes": "in", "q": q.strip()},
            headers={"User-Agent": USER_AGENT},
            timeout=15,
        )
        r.raise_for_status()
        hits = [
            {"lat": h["lat"], "lon": h["lon"], "display_name": h["display_name"]}
            for h in r.json()
        ]
    except Exception as e:
        print("Geocode failed:", type(e).__name__, str(e)[:200])
        raise HTTPException(status_code=502, detail="The place search is busy. Please try again in a minute.")
    _put(key, hits)
    return hits


@router.get("/nearby")
def nearby(
    lat: float = Query(..., ge=-90, le=90),
    lon: float = Query(..., ge=-180, le=180),
    radius: int = Query(10000, ge=1000, le=50000),
):
    """Hospitals, clinics and doctors around a point, as raw Overpass elements."""
    key = f"n:{round(lat, 3)}:{round(lon, 3)}:{radius}"
    cached = _get(key)
    if cached is not None:
        return cached

    query = (
        "[out:json][timeout:25];("
        f'nwr["amenity"~"^(hospital|clinic|doctors)$"](around:{radius},{lat},{lon});'
        f'nwr["healthcare"~"^(hospital|clinic|doctor)$"](around:{radius},{lat},{lon});'
        ");out center 250;"
    )
    started = time.time()
    for url in OVERPASS_MIRRORS:
        if time.time() - started > MAX_TOTAL_SECONDS:
            break
        try:
            r = httpx.post(url, data={"data": query}, headers={"User-Agent": USER_AGENT}, timeout=25)
            if r.status_code != 200:
                print("Overpass", url, "status", r.status_code)
                continue
            data = r.json()
            if "elements" not in data or (not data["elements"] and data.get("remark")):
                print("Overpass", url, "returned an error remark:", str(data.get("remark"))[:120])
                continue
            _put(key, {"elements": data["elements"]})
            return {"elements": data["elements"]}
        except Exception as e:
            print("Overpass", url, "failed:", type(e).__name__, str(e)[:120])
    raise HTTPException(status_code=502, detail="The map data service is busy. Please try again in a minute.")
