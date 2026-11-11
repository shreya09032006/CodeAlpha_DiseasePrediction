"""Map lookups done on the server.

Browsers get blocked when the free public map servers are busy (they answer errors
without CORS headers). Asking from the server avoids that, lets us try several
sources, and lets us remember recent answers.

Source 1: Overpass mirrors (detailed OpenStreetMap queries).
Source 2: Nominatim place search (the same OpenStreetMap data), used when the
          Overpass servers cannot be reached from this host.
"""
import math
import time
from typing import Any, Dict, List, Tuple

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
PER_SERVER_SECONDS = 8
MAX_OVERPASS_SECONDS = 26
OVERPASS_REST_SECONDS = 300  # after a full failure, skip Overpass for a while
SEARCH_TERMS = [
    "hospital", "clinic", "cardiologist", "heart", "diabetes",
    "endocrinologist", "oncologist", "cancer", "breast", "surgeon",
]

# Names or specialities that matter for the three conditions (heart, diabetes, breast cancer).
KEYWORDS = "cardi|heart|diabet|endocrin|thyroid|sugar|oncolog|cancer|breast|mammo|surg"

_cache: Dict[str, Tuple[float, Any]] = {}
_client = None
_overpass_rest_until = 0.0


def _http() -> httpx.Client:
    """One shared client that only uses IPv4 (some hosts cannot reach IPv6 routes)."""
    global _client
    if _client is None:
        _client = httpx.Client(
            transport=httpx.HTTPTransport(local_address="0.0.0.0", retries=1),
            follow_redirects=True,
        )
    return _client


def _get(key: str):
    hit = _cache.get(key)
    if hit and hit[0] > time.time():
        return hit[1]
    return None


def _put(key: str, value: Any):
    if len(_cache) > 500:  # keep memory small on the free plan
        _cache.clear()
    _cache[key] = (time.time() + CACHE_SECONDS, value)


def build_query(lat: float, lon: float, radius: int) -> str:
    """A light query: exact tag matches first, text matching only on small candidate sets."""
    a = f"(around:{radius},{lat},{lon})"
    parts = [
        f'nwr["amenity"="hospital"]["name"]{a};',
        f'nwr["healthcare"="hospital"]["name"]{a};',
        f'nwr["amenity"="clinic"]["healthcare:speciality"]{a};',
        f'nwr["amenity"="doctors"]["healthcare:speciality"]{a};',
        f'nwr["amenity"="clinic"]["name"~"{KEYWORDS}",i]{a};',
        f'nwr["amenity"="doctors"]["name"~"{KEYWORDS}",i]{a};',
        f'nwr["healthcare"="clinic"]["name"~"{KEYWORDS}",i]{a};',
        f'nwr["healthcare"="doctor"]["name"~"{KEYWORDS}",i]{a};',
    ]
    return "[out:json][timeout:20];(" + "".join(parts) + ");out center 250;"


def _from_overpass(lat: float, lon: float, radius: int):
    """Returns a list of elements, or None if every mirror failed."""
    global _overpass_rest_until
    if time.time() < _overpass_rest_until:
        return None
    query = build_query(lat, lon, radius)
    started = time.time()
    for url in OVERPASS_MIRRORS:
        if time.time() - started > MAX_OVERPASS_SECONDS:
            break
        try:
            r = _http().post(
                url,
                data={"data": query},
                headers={"User-Agent": USER_AGENT},
                timeout=PER_SERVER_SECONDS,
            )
            if r.status_code != 200:
                print("Overpass", url, "status", r.status_code, r.text[:150].replace("\n", " "))
                continue
            data = r.json()
            if "elements" not in data or (not data["elements"] and data.get("remark")):
                print("Overpass", url, "returned an error remark:", str(data.get("remark"))[:120])
                continue
            print("Overpass", url, "OK,", len(data["elements"]), "places in", round(time.time() - started, 1), "s")
            return data["elements"]
        except Exception as e:
            print("Overpass", url, "failed:", type(e).__name__, str(e)[:120])
    _overpass_rest_until = time.time() + OVERPASS_REST_SECONDS
    print("Overpass unreachable, using Nominatim for the next", OVERPASS_REST_SECONDS // 60, "minutes")
    return None


def _from_nominatim(lat: float, lon: float, radius: int):
    """Same OpenStreetMap data through the place-search service. Returns (elements, errors)."""
    dlat = radius / 111320.0
    dlon = radius / (111320.0 * max(math.cos(math.radians(lat)), 0.2))
    box = f"{lon - dlon},{lat + dlat},{lon + dlon},{lat - dlat}"  # left, top, right, bottom
    found: Dict[Tuple[str, int], dict] = {}
    errors = 0
    for i, term in enumerate(SEARCH_TERMS):
        if i:
            time.sleep(1.05)  # Nominatim asks for at most one request per second
        try:
            r = _http().get(
                NOMINATIM,
                params={
                    "format": "jsonv2", "q": term, "viewbox": box, "bounded": 1,
                    "limit": 40, "extratags": 1, "countrycodes": "in",
                },
                headers={"User-Agent": USER_AGENT},
                timeout=15,
            )
            r.raise_for_status()
            rows: List[dict] = r.json()
        except Exception as e:
            errors += 1
            print("Nominatim", repr(term), "failed:", type(e).__name__, str(e)[:120])
            continue
        for h in rows:
            name = h.get("name") or ""
            if not name or "osm_id" not in h:
                continue
            tags = dict(h.get("extratags") or {})
            tags["name"] = name
            if h.get("category") in ("amenity", "healthcare") and h.get("type"):
                tags[h["category"]] = h["type"]
            found[(h.get("osm_type", "node"), int(h["osm_id"]))] = {
                "type": h.get("osm_type", "node"),
                "id": int(h["osm_id"]),
                "lat": float(h["lat"]),
                "lon": float(h["lon"]),
                "tags": tags,
            }
    print("Nominatim found", len(found), "places,", errors, "failed searches")
    return list(found.values()), errors


@router.get("/geocode")
def geocode(q: str = Query(..., min_length=2, max_length=120)):
    """Turn an area name into coordinates. Returns the same list shape Nominatim uses."""
    key = "g:" + q.strip().lower()
    cached = _get(key)
    if cached is not None:
        return cached
    try:
        r = _http().get(
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
    """Hospitals, clinics and doctors around a point, as Overpass-style elements."""
    key = f"n:{round(lat, 3)}:{round(lon, 3)}:{radius}"
    cached = _get(key)
    if cached is not None:
        return cached

    elements = _from_overpass(lat, lon, radius)
    source = "overpass"
    if elements is None:
        elements, errors = _from_nominatim(lat, lon, radius)
        source = "nominatim"
        if not elements and errors:
            raise HTTPException(status_code=502, detail="The map data service is busy. Please try again in a minute.")
    result = {"elements": elements, "source": source}
    _put(key, result)
    return result
