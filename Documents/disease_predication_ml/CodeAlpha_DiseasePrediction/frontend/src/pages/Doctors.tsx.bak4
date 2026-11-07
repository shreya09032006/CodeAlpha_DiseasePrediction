import { useEffect, useRef, useState } from "react";
import * as L from "leaflet";
import "leaflet/dist/leaflet.css";

const SPECIALTIES = [
  { id: "diabetes", label: "Diabetes (Endocrinologist)", regex: "endocrinology|diabetology|diabetes" },
  { id: "heart", label: "Heart (Cardiologist)", regex: "cardiology|cardiac" },
  { id: "breast", label: "Breast cancer (Oncologist)", regex: "oncology|breast|surgery" },
];

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
  kind: string;
  km: number;
}

export default function Doctors() {
  const mapEl = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const layer = useRef<L.LayerGroup | null>(null);

  const [specId, setSpecId] = useState(SPECIALTIES[0].id);
  const [radius, setRadius] = useState(10000);
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

  const search = async () => {
    const m = map.current;
    const lg = layer.current;
    if (!m || !lg) return;
    setLoading(true);
    setError("");
    setPlaces([]);
    try {
      const pos = await new Promise<GeolocationPosition>((resolve, reject) =>
        navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 10000 })
      );
      const { latitude: lat, longitude: lon } = pos.coords;
      const spec = SPECIALTIES.find((s) => s.id === specId)!;

      const query = `[out:json][timeout:25];(
        nwr["amenity"="hospital"](around:${radius},${lat},${lon});
        nwr["amenity"~"doctors|clinic"]["healthcare:speciality"~"${spec.regex}"](around:${radius},${lat},${lon});
      );out center 60;`;

      const res = await fetch("https://overpass-api.de/api/interpreter", {
        method: "POST",
        body: "data=" + encodeURIComponent(query),
      });
      if (!res.ok) throw new Error("overpass");
      const json = await res.json();

      const here = L.latLng(lat, lon);
      const found: Place[] = (json.elements as OverpassEl[])
        .map((el) => {
          const plat = el.lat ?? el.center?.lat ?? 0;
          const plon = el.lon ?? el.center?.lon ?? 0;
          return {
            id: `${el.type}${el.id}`,
            name: el.tags?.name ?? "",
            lat: plat,
            lon: plon,
            kind: el.tags?.amenity ?? "",
            km: here.distanceTo(L.latLng(plat, plon)) / 1000,
          };
        })
        .filter((p) => p.name && p.lat && p.lon)
        .sort((a, b) => a.km - b.km)
        .slice(0, 30);

      lg.clearLayers();
      L.circleMarker([lat, lon], { radius: 9, color: "#fff", weight: 2, fillColor: "#10b981", fillOpacity: 1 })
        .bindPopup("You are here")
        .addTo(lg);
      found.forEach((p) =>
        L.circleMarker([p.lat, p.lon], { radius: 7, color: "#fff", weight: 2, fillColor: "#e11d48", fillOpacity: 1 })
          .bindPopup(p.name)
          .addTo(lg)
      );

      const points: [number, number][] = [[lat, lon], ...found.map((p) => [p.lat, p.lon] as [number, number])];
      m.fitBounds(L.latLngBounds(points).pad(0.2));
      setPlaces(found);
      if (found.length === 0) setError("No places found nearby. Try a larger radius.");
    } catch (e) {
      if (e instanceof GeolocationPositionError) {
        setError("Couldn't get your location. Allow location access and try again.");
      } else {
        setError("Search failed. Please try again in a moment.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container">
      <div className="header-badge">
        <span className="pulse-dot crimson" />
        Clinical Telemetry & Geo-Locator
      </div>
      <h1 className="page-title">Nearby Care</h1>
      <p className="muted" style={{ maxWidth: "680px", marginBottom: "20px" }}>
        Find hospitals and specialists near you. Map data comes from OpenStreetMap, so coverage varies by area.
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
        </div>
        <button className="btn primary" onClick={search} disabled={loading} type="button">
          <span className="material-symbols-outlined" style={{ fontSize: "19px" }}>
            my_location
          </span>
          <span>{loading ? "Searching…" : "Use my location"}</span>
        </button>
      </div>

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
            <li key={p.id} className="place-item">
              <div className="place-top-row">
                <div>
                  <strong>{p.name}</strong>
                  <div style={{ fontSize: "13px", color: "var(--muted)", textTransform: "capitalize", marginTop: "2px" }}>
                    {p.kind} · {p.km.toFixed(1)} km
                  </div>
                </div>
                <div className="place-icon-badge">
                  <span className="material-symbols-outlined" style={{ fontSize: "18px" }}>
                    {p.kind.includes("hospital") ? "local_hospital" : "medical_services"}
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
                <span style={{ fontSize: "12px", color: "var(--muted)" }}>Health Facility</span>
                <a
                  className="place-link"
                  href={`https://www.google.com/maps/dir/?api=1&destination=${p.lat},${p.lon}`}
                  target="_blank"
                  rel="noreferrer"
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