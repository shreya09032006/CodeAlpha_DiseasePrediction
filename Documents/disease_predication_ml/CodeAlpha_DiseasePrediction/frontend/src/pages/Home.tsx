import { Link } from "react-router-dom";
import Heart from "../components/Heart";

const features = [
  {
    to: "/predict",
    icon: "🫀",
    title: "Risk Prediction",
    text: "Heart disease, diabetes and breast cancer models trained and compared on public medical datasets.",
    action: "Explore telemetry",
  },
  {
    to: "/reports",
    icon: "📄",
    title: "Report Reader",
    text: "Upload a lab or ECG report and pull out the key values automatically.",
    action: "Scan document",
  },
  {
    to: "/assistant",
    icon: "🎙️",
    title: "Voice Assistant",
    text: "Ask about diet and exercise by voice or text and get guideline-based answers.",
    action: "Start consultation",
  },
  {
    to: "/doctors",
    icon: "📍",
    title: "Nearby Care",
    text: "Find hospitals and specialists near you on a map.",
    action: "Locate facilities",
  },
];

export default function Home() {
  return (
    <>
      <section className="hero">
        <div className="header-badge">
          <span className="pulse-dot" />
          Precision Telemetry & Clinical Intelligence
        </div>

        <div className="hero-centerpiece">
          <h1 className="hero-title">
            <span className="l1">Smarter</span>{" "}
            <span className="l2">Health</span>{" "}
            <span className="l3">Prediction</span>
          </h1>

          <div className="hero-heart-stage">
            <div className="hero-heart-wrap">
              <div className="heart-luminous-flare" aria-hidden="true" />
              <Heart />
            </div>
          </div>
        </div>

        <div className="hero-cta">
          <Link to="/predict" className="btn primary">
            <span>Check my risk</span>
            <span className="material-symbols-outlined" style={{ fontSize: "18px" }}>
              arrow_forward
            </span>
          </Link>
          <Link to="/reports" className="btn ghost">
            <span className="material-symbols-outlined" style={{ fontSize: "18px", color: "var(--accent-2)" }}>
              upload_file
            </span>
            <span>Upload a report</span>
          </Link>
        </div>
      </section>

      <section className="container">
        <div className="stats-card">
          <div className="stat-item">
            <div className="stat-val crimson">3</div>
            <div className="stat-label">conditions</div>
            <div className="stat-sub">Targeted predictive assessments</div>
          </div>
          <div className="stat-item">
            <div className="stat-val emerald">4</div>
            <div className="stat-label">algorithms compared</div>
            <div className="stat-sub">Ensemble classifier benchmarking</div>
          </div>
          <div className="stat-item">
            <div className="stat-val rose">5-fold</div>
            <div className="stat-label">cross-validation</div>
            <div className="stat-sub">Rigorous clinical dataset auditing</div>
          </div>
        </div>

        <div className="features-grid">
          {features.map((f) => (
            <Link key={f.to} to={f.to} className="feature-card">
              <div>
                <div className="feature-icon-badge">{f.icon}</div>
                <h3 className="feature-title">{f.title}</h3>
                <p className="feature-desc">{f.text}</p>
              </div>
              <div className="feature-action">
                <span>{f.action}</span>
                <span className="material-symbols-outlined">arrow_forward</span>
              </div>
            </Link>
          ))}
        </div>
      </section>
    </>
  );
}