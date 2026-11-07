import { DISEASES } from "../diseases";
import PredictionForm from "../components/PredictionForm";
import { usePersistentState } from "../usePersistentState";

export default function Predict() {
  const [activeId, setActiveId] = usePersistentState("predict-tab", DISEASES[0].id);
  const active = DISEASES.find((d) => d.id === activeId)!;

  return (
    <div className="container">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: "16px", marginBottom: "28px" }}>
        <div>
          <h1 className="page-title">Risk Prediction</h1>
          <p className="muted">Choose a condition, enter the values, and get a risk estimate.</p>
        </div>

        <nav className="tabs" style={{ marginBottom: 0 }}>
          {DISEASES.map((d) => (
            <button
              key={d.id}
              className={d.id === activeId ? "tab active" : "tab"}
              onClick={() => setActiveId(d.id)}
              type="button"
            >
              {d.title}
            </button>
          ))}
        </nav>
      </div>

      <PredictionForm key={active.id} disease={active} />
    </div>
  );
}