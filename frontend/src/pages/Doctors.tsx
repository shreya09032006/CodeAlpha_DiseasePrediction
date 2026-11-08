import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import * as L from "leaflet";
import "leaflet/dist/leaflet.css";

const SPECIALTIES = [
  { id: "diabetes", label: "Diabetes (Endocrinologist)", regex: "endocrinology|diabetology|diabetes", nameRe: /endocrin|diabet|thyroid|sugar/i },
  { id: "heart", label: "Heart (Cardiologist)", regex: "cardiology|cardiac", nameRe: /cardi|heart/i },
  { id: "breast", label: "Breast cancer (Oncologist)", regex: "oncology|breast|surgery", nameRe: /oncolog|cancer|breast|mammo/i },
];

// Places we never want to show for these conditions
const EXCLUDE =
  /matern|gyn|obstet|ivf|fertil|\beyes?\b|netralay|vision|ophthal|optic|dental|dentist|child|paediatr|pediatr|\bent\b|skin|derma|cosmetic|hair|physio|veterin|animal|ayurved|homeo|homoeo|psychiat|de-?addict|\blab\b|pathology|diagnostic|imaging|x-?ray|blood bank|pharmacy|chemist/i;

// Well-known / large hospitals, matched by name
const BIG =
  /apollo|fortis|lilavati|hinduja|kokilaben|jaslok|wockhardt|manipal|narayana|medanta|\bmax\b|aiims|civil|district|government|govt|general hospital|multi.?speciality|super.?speciality|medical college|medical cent(re|er)|d\.? ?y\.? ?patil|\bmgm\b|tata|rural hospital|sub.?district|city hospital|sassoon|nanavati|breach candy|bhatia|saifee|columbia asia|sahyadri|jupiter|ruby hall|\bkem\b/i;

const ENDPOINTS = ["https://overpass-api.de/api/interpreter", "https://overpass.kumi.systems/api/interpreter"];

type Tier = "specialist" | "surgeon" | "major";

interface OverpassEl {
  type: string;
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
}

interface Place {
  id: string;
  name: string;
  lat: number;
  lon: number;
  tier: Tier;
  km: number;
  phone: string;
}

const TIER_LABEL: Record<Tier, string> = {
  specialist: "Specialist match",
  surgeon: "Surgeon",
  major: "Major hospital",
};

function classify(tags: Record<string, string>, specId: string): Tier | null {
  const name = tags.name ?? "";
  if (!name) return null;
  const speciality = tags["healthcare:speciality"] ?? "";
  const text = `${name} ${speciality}`;
  if (EXCLUDE.test(text)) return null;
  const spec = SPECIALTIES.find((s) => s.id === specId)!;
  if (new RegExp(spec.regex, "i").test(speciality) || spec.nameRe.test(name)) return "specialist";
  if (/surg/i.test(text)) return "surgeon";
  const isHospital = tags.amenity === "hospital" || tags.healthcare === "hospital";
  if (isHospital && (BIG.test(name) || tags.emergency === "yes" || tags["operator:type"] === "government")) return "major";
  return null;
}

async function overpass(query: string) {
  let lastErr: unknown = new Error("overpass");
  for (const url of ENDPOINTS) {
    try {
      const res = await fetch(url, { method: "POST", body: "data=" + encodeURIComponent(query) });
      if (res.ok) return await res.json();
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr;
}

export default function Doctors() {
  const mapEl = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const layer = useRef<L.LayerGroup | null>(null);
  const markers = useRef<Record<string, L.CircleMarker>>({});

  const [params] = useSearchParams();
  const initialSpec =
    SPECIALTIES.find((s) => s.id === params.get("disease"))?.id ?? SPECIALTIES[0].id;
  const [specId, setSpecId] = useState(initialSpec);
  const [radius, setRadius] = useState(10000);
  const [placeText, setPlaceText] = useState("");
  const [areaLabel, setAreaLabel] = useState("");
  const [note, setNote] = useState("");
  const [places, setPlaces] = useState<Place[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!mapEl.current || map.current) return;
    map.current = L.map(mapEl.current).setView([20.5937, 78.9629], 5);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "© OpenStreetMap contributors",
      maxZoom: 19,
    }).addTo(map.current);
    layer.current = L.layerGroup().addTo(map.current);
    return () => {
      map.current?.remove();
      map.current = null;
    };
  }, []);

  const runSearch = async (lat: number, lon: number, label: string) => {
    const m = map.current;
    const lg = layer.current;
    if (!m || !lg) return;
    const spec = SPECIALTIES.find((s) => s.id === specId)!;
    const role = spec.label.match(/\((.+)\)/)?.[1] ?? "specialist";
    const here = L.latLng(lat, lon);

    let chosen: Place[] = [];
    let message = "";
    const radii = Array.from(new Set([radius, 25000, 50000])).filter((r) => r >= radius);
    for (const r of radii) {
      const query = `[out:json][timeout:25];(
        nwr["amenity"~"^(hospital|clinic|doctors)$"](around:${r},${lat},${lon});
        nwr["healthcare"~"^(hospital|clinic|doctor)$"](around:${r},${lat},${lon});
      );out center 250;`;
      const json = await overpass(query);
      const seen = new Set<string>();
      const all: Place[] = [];
      for (const el of json.elements as OverpassEl[]) {
        const id = `${el.type}${el.id}`;
        const tier = el.tags ? classify(el.tags, specId) : null;
        const plat = el.lat ?? el.center?.lat ?? 0;
        const plon = el.lon ?? el.center?.lon ?? 0;
        if (!tier || !plat || !plon || seen.has(id)) continue;
        seen.add(id);
        all.push({
          id,
          name: el.tags!.name,
          lat: plat,
          lon: plon,
          tier,
          km: here.distanceTo(L.latLng(plat, plon)) / 1000,
          phone: el.tags!.phone ?? el.tags!["contact:phone"] ?? "",
        });
      }
      all.sort((a, b) => a.km - b.km);
      const specialists = all.filter((p) => p.tier === "specialist");
      const others = all.filter((p) => p.tier !== "specialist");
      const wider = r > radius ? ` (searched up to ${r / 1000} km)` : "";
      if (specialists.length) {
        chosen = specialists;
        message = r > radius ? `No ${role.toLowerCase()} within ${radius / 1000} km. Nearest matches${wider}.` : "";
        break;
      }
      if (others.length) {
        chosen = others;
        message = `No ${role.toLowerCase()} found within ${r / 1000} km. Showing surgeons and major hospitals instead${wider}.`;
        break;
      }
    }

    chosen = chosen.slice(0, 20);
    lg.clearLayers();
    markers.current = {};
    L.circleMarker([lat, lon], { radius: 9, color: "#fff", weight: 2, fillColor: "#10b981", fillOpacity: 1 })
      .bindPopup(`Searching around: ${label}`)
      .addTo(lg);
    chosen.forEach((p) => {
      const mk = L.circleMarker([p.lat, p.lon], { radius: 7, color: "#fff", weight: 2, fillColor: "#e11d48", fillOpacity: 1 })
        .bindPopup(p.name)
        .addTo(lg);
      markers.current[p.id] = mk;
    });
    const points: [number, number][] = [[lat, lon], ...chosen.map((p) => [p.lat, p.lon] as [number, number])];
    m.fitBounds(L.latLngBounds(points).pad(0.2));
    setPlaces(chosen);
    setAreaLabel(label);
    setNote(message);
    if (chosen.length === 0) {
      setError("No suitable doctors or hospitals found even within 50 km. Map data for this area may be limited.");
    }
  };

  const guard = async (job: () => Promise<void>) => {
    setLoading(true);
    setError("");
    setNote("");
    setPlaces([]);
    try {
      await job();
    } catch (e) {
      if (e instanceof GeolocationPositionError) {
        setError("Couldn't get your location. Allow location access and try again.");
      } else if (e instanceof Error && e.message === "place") {
        setError("Couldn't find that place. Try a city or area name, e.g. Panvel.");
      } else {
        setError("Search failed. Please try again in a moment.");
      }
    } finally {
      setLoading(false);
    }
  };

  const useMyLocation = () =>
    guard(async () => {
      const pos = await new Promise<GeolocationPosition>((resolve, reject) =>
        navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 10000 })
      );
      await runSearch(pos.coords.latitude, pos.coords.longitude, "your current location");
    });

  const searchPlace = () =>
    guard(async () => {
      const q = placeText.trim();
      if (!q) throw new Error("place");
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&countrycodes=in&q=${encodeURIComponent(q)}`
      );
      if (!res.ok) throw new Error("geocode");
      const hits = (await res.json()) as { lat: string; lon: string; display_name: string }[];
      if (!hits.length) throw new Error("place");
      const label = hits[0].display_name.split(",").slice(0, 2).join(",").trim();
      await runSearch(parseFloat(hits[0].lat), parseFloat(hits[0].lon), label);
    });

  const focusPlace = (p: Place) => {
    map.current?.flyTo([p.lat, p.lon], 16);
    markers.current[p.id]?.openPopup();
  };

  return (
    <div className="container">
      <div className="header-badge">
        <span className="pulse-dot crimson" />
        Clinical Telemetry & Geo-Locator
      </div>
      <h1 className="page-title">Nearby Care</h1>
      <p className="muted" style={{ maxWidth: "680px", marginBottom: "20px" }}>
        Find specialists near you, or near any area you type. If no matching specialist is close, we show
        surgeons and major hospitals instead. Map data comes from OpenStreetMap, so coverage varies by area.
      </p>

      <div className="toolbar">
        <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", flex: 1 }}>
          <select value={specId} onChange={(e) => setSpecId(e.target.value)}>
            {SPECIALTIES.map((s) => (
              <option key={s.id} value={s.id}>{s.label}</option>
            ))}
          </select>
          <select value={radius} onChange={(e) => setRadius(Number(e.target.value))}>
            <option value={5000}>5 km</option>
            <option value={10000}>10 km</option>
            <option value={20000}>20 km</option>
          </select>
          <form
            style={{ display: "flex", gap: "8px" }}
            onSubmit={(e) => {
              e.preventDefault();
              searchPlace();
            }}
          >
            <input
              className="place-input"
              value={placeText}
              onChange={(e) => setPlaceText(e.target.value)}
              placeholder="Or type an area, e.g. Panvel"
              aria-label="Area to search"
            />
            <button className="btn" type="submit" disabled={loading}>
              <span className="material-symbols-outlined" style={{ fontSize: "19px" }}>
                search
              </span>
              <span>Search area</span>
            </button>
          </form>
        </div>
        <button className="btn primary" onClick={useMyLocation} disabled={loading} type="button">
          <span className="material-symbols-outlined" style={{ fontSize: "19px" }}>
            my_location
          </span>
          <span>{loading ? "Searching…" : "Use my location"}</span>
        </button>
      </div>

      {areaLabel && !error && (
        <p className="muted" style={{ marginBottom: "12px" }}>
          Showing results near <strong>{areaLabel}</strong>.
          {note && <> {note}</>}
        </p>
      )}

      {error && (
        <div className="error" style={{ marginBottom: "20px" }}>
          <span className="material-symbols-outlined" style={{ fontSize: "18px" }}>
            warning
          </span>
          <span>{error}</span>
        </div>
      )}

      <div className="map-layout">
        <div ref={mapEl} className="map" />
        <ul className="place-list">
          {places.map((p) => (
            <li key={p.id} className="place-item" style={{ cursor: "pointer" }} onClick={() => focusPlace(p)}>
              <div className="place-top-row">
                <div>
                  <strong>{p.name}</strong>
                  <div style={{ fontSize: "13px", color: "var(--muted)", marginTop: "2px" }}>
                    {TIER_LABEL[p.tier]} · {p.km.toFixed(1)} km
                  </div>
                  {p.phone && (
                    <div style={{ fontSize: "12px", color: "var(--muted)", marginTop: "2px" }}>{p.phone}</div>
                  )}
                </div>
                <div className="place-icon-badge">
                  <span className="material-symbols-outlined" style={{ fontSize: "18px" }}>
                    {p.tier === "major" ? "local_hospital" : "medical_services"}
                  </span>
                </div>
              </div>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  marginTop: "8px",
                  paddingTop: "8px",
                  borderTop: "1px solid var(--border-subtle)",
                }}
              >
                <span style={{ fontSize: "12px", color: "var(--muted)" }}>Tap to show on map</span>
                <a
                  className="place-link"
                  href={`https://www.google.com/maps/dir/?api=1&destination=${p.lat},${p.lon}`}
                  target="_blank"
                  rel="noreferrer"
                  onClick={(e) => e.stopPropagation()}
                >
                  <span>Directions</span>
                  <span className="material-symbols-outlined" style={{ fontSize: "16px" }}>
                    arrow_forward
                  </span>
                </a>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
