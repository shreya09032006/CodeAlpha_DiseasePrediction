import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import { useSearchParams } from "react-router-dom";
import axios from "axios";
import ReactMarkdown from "react-markdown";
import { API_URL } from "../config";

const CONDITIONS: Record<string, string> = {
  diabetes: "diabetes",
  heart: "heart disease",
  breast: "breast cancer",
};

export default function DietPlan() {
  const [params] = useSearchParams();
  const fromResult = params.get("condition");
  const prefilled = fromResult ? CONDITIONS[fromResult] : undefined;

  const [form, setForm] = useState({
    condition: prefilled ?? "diabetes",
    age: params.get("age") ?? "",
    weight_kg: "",
    diet: "vegetarian",
    allergies: "",
  });
  const [plan, setPlan] = useState("");
  const [sources, setSources] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const cardRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (prefilled) {
      cardRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [prefilled]);

  const set = (key: string, value: string) =>
    setForm((f) => ({ ...f, [key]: value }));

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setPlan("");
    try {
      const res = await axios.post(`${API_URL}/diet-plan`, {
        condition: form.condition,
        age: Number(form.age),
        weight_kg: Number(form.weight_kg),
        diet: form.diet,
        allergies: form.allergies.trim() || "none",
      });
      setPlan(res.data.plan);
      setSources(res.data.sources ?? []);
    } catch {
      setError("Couldn't build a plan. Please check that the backend is running and try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <section ref={cardRef} className="card" style={{ maxWidth: "860px", margin: "28px auto 0" }}>
      <div className="card-ambient-glow" aria-hidden="true" />

      <div className="card-header-block">
        <div className="card-header-icon">
          <span className="material-symbols-outlined" style={{ fontSize: "24px" }}>
            restaurant
          </span>
        </div>
        <div>
          <h2>Personalized Diet Plan</h2>
          <p className="muted">
            A sample meal and exercise outline built from guideline notes. It is general
            guidance, not a prescription.
          </p>
          {prefilled && (
            <p className="muted" style={{ marginTop: "6px" }}>
              Pre-filled from your result ({prefilled}). Add your diet type, weight and allergies.
            </p>
          )}
        </div>
      </div>

      <form onSubmit={submit}>
        <div className="grid">
          <label>
            <span>Condition</span>
            <select value={form.condition} onChange={(e) => set("condition", e.target.value)}>
              <option value="diabetes">Diabetes</option>
              <option value="heart disease">Heart disease</option>
              <option value="breast cancer">Breast cancer</option>
            </select>
          </label>

          <label>
            <span>Diet type</span>
            <select value={form.diet} onChange={(e) => set("diet", e.target.value)}>
              <option value="vegetarian">Vegetarian</option>
              <option value="non-vegetarian">Non-vegetarian</option>
              <option value="vegan">Vegan</option>
            </select>
          </label>

          <label>
            <span>Age</span>
            <input
              required
              type="number"
              min={1}
              max={120}
              value={form.age}
              onChange={(e) => set("age", e.target.value)}
            />
          </label>

          <label>
            <span>Weight (kg)</span>
            <input
              required
              type="number"
              min={10}
              max={300}
              step="any"
              value={form.weight_kg}
              onChange={(e) => set("weight_kg", e.target.value)}
            />
          </label>

          <label>
            <span>Allergies</span>
            <input
              value={form.allergies}
              onChange={(e) => set("allergies", e.target.value)}
              placeholder="e.g. peanuts, lactose (optional)"
            />
          </label>
        </div>

        <div className="actions">
          <button className="btn primary" type="submit" disabled={loading}>
            <span className="material-symbols-outlined" style={{ fontSize: "18px" }}>
              auto_awesome
            </span>
            <span>{loading ? "Building your plan…" : "Generate plan"}</span>
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

      {plan && (
        <div className="markdown" style={{ marginTop: "28px" }}>
          <ReactMarkdown>{plan}</ReactMarkdown>
          {sources.length > 0 && (
            <div className="diet-sources">
              Based on: {sources.map((s) => s.replace(/^Source:\s*/i, "")).join(" · ")}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
