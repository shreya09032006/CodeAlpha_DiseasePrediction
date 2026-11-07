import { useState } from "react";
import { useNavigate } from "react-router-dom";
import type { FormEvent } from "react";
import { predict } from "../api";
import type { PredictionResult } from "../api";
import type { Disease } from "../diseases";
import { usePersistentState } from "../usePersistentState";

export default function PredictionForm({ disease }: { disease: Disease }) {
  const [values, setValues] = usePersistentState<Record<string, string>>(`form-${disease.id}`, {});
  const [result, setResult] = usePersistentState<PredictionResult | null>(`result-${disease.id}`, null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const goToPlan = () => {
    const age = values.age ?? values.Age ?? "";
    navigate(`/assistant?condition=${disease.id}${age ? `&age=${age}` : ""}`);
  };
  const goToDoctors = () => navigate(`/doctors?disease=${disease.id}`);

  const handleChange = (name: string, value: string) =>
    setValues((v) => ({ ...v, [name]: value }));

  const fillSample = () => {
    const s: Record<string, string> = {};
    for (const [k, v] of Object.entries(disease.sample)) s[k] = String(v);
    setValues(s);
    setResult(null);
    setError("");
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setResult(null);
    try {
      const payload: Record<string, number> = {};
      for (const f of disease.fields) payload[f.name] = Number(values[f.name]);
      setResult(await predict(disease.endpoint, payload));
    } catch {
      setError("Could not get a prediction. Is the backend running?");
    } finally {
      setLoading(false);
    }
  };

  const getIconForDisease = (id: string) => {
    switch (id) {
      case "heart": return "cardiology";
      case "diabetes": return "bloodtype";
      case "breast": return "vital_signs";
      default: return "health_and_safety";
    }
  };

  return (
    <section className="card">
      <div className="card-ambient-glow" aria-hidden="true" />

      <div className="card-header-block">
        <div className="card-header-icon">
          <span className="material-symbols-outlined" style={{ fontSize: "24px" }}>
            {getIconForDisease(disease.id)}
          </span>
        </div>
        <div>
          <h2>{disease.title}</h2>
          <p className="muted">{disease.description}</p>
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="grid">
          {disease.fields.map((f) => (
            <label key={f.name}>
              <span>{f.label}</span>
              {f.type === "select" ? (
                <select
                  required
                  value={values[f.name] ?? ""}
                  onChange={(e) => handleChange(f.name, e.target.value)}
                >
                  <option value="" disabled>Select…</option>
                  {f.options?.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              ) : (
                <input
                  required
                  type="number"
                  min={f.min}
                  max={f.max}
                  step={f.step ?? "any"}
                  value={values[f.name] ?? ""}
                  onChange={(e) => handleChange(f.name, e.target.value)}
                />
              )}
              {f.hint && <small>{f.hint}</small>}
            </label>
          ))}
        </div>

        <div className="actions">
          <button className="btn primary" type="submit" disabled={loading}>
            <span className="material-symbols-outlined" style={{ fontSize: "18px" }}>
              neurology
            </span>
            <span>{loading ? "Calculating…" : "Predict"}</span>
          </button>
          <button className="btn ghost" type="button" onClick={fillSample}>
            <span className="material-symbols-outlined" style={{ fontSize: "18px", color: "var(--accent-2)" }}>
              restart_alt
            </span>
            <span>Fill sample data</span>
          </button>
        </div>
      </form>

      {error && (
        <div className="error">
          <span className="material-symbols-outlined" style={{ fontSize: "18px" }}>
            error_outline
          </span>
          <span>{error}</span>
        </div>
      )}

      {result && (
        <div className="result-card-wrap">
          <div className={`result ${result.risk.toLowerCase()}`}>
            <div className="result-header">
              <div>
                <span className="result-badge">
                  <span className={`pulse-dot ${result.risk === "High" ? "crimson" : result.risk === "Moderate" ? "amber" : ""}`} />
                  {result.risk === "High" ? "Elevated Probability" : result.risk === "Moderate" ? "Moderate Probability" : "Optimal Range"}
                </span>
                <h3>{result.risk} risk</h3>
              </div>
              <span className="material-symbols-outlined result-icon">
                {result.risk === "High" ? "warning" : result.risk === "Moderate" ? "info" : "verified_user"}
              </span>
            </div>

            <div>
              <div className="result-metric-row">
                <span className="result-percentage">
                  {Math.round(result.probability * 100)}%
                </span>
                <span className="result-metric-label">Probability</span>
              </div>
              <div className="result-progress-track">
                <div
                  className="result-progress-bar"
                  style={{ width: `${Math.round(result.probability * 100)}%` }}
                />
              </div>
            </div>

            <div className="result-footer">
              <span>Model used: {result.model}</span>
              <span>Risk level: {result.risk}</span>
            </div>
          </div>

          {result.risk !== "Low" && (
            <div className="next-steps">
              <button type="button" className="btn primary" onClick={goToPlan}>
                <span className="material-symbols-outlined" style={{ fontSize: "18px" }}>
                  restaurant
                </span>
                <span>Get my diet &amp; exercise plan</span>
              </button>
              <button type="button" className="btn ghost" onClick={goToDoctors}>
                <span className="material-symbols-outlined" style={{ fontSize: "18px" }}>
                  location_on
                </span>
                <span>Find nearby doctors</span>
              </button>
            </div>
          )}
        </div>
      )}
    </section>
  );
}