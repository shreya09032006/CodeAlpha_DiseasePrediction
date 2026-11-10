import { NavLink } from "react-router-dom";
import type { Theme } from "../theme";

const links = [
  { to: "/", label: "Home" },
  { to: "/predict", label: "Predict" },
  { to: "/ecg", label: "ECG" },
  { to: "/reports", label: "Reports" },
  { to: "/assistant", label: "Assistant" },
  { to: "/doctors", label: "Doctors" },
];

export default function Navbar({
  theme,
  onToggle,
}: {
  theme: Theme;
  onToggle: () => void;
}) {
  return (
    <header className="navbar">
      <NavLink to="/" className="brand">
        <div className="brand-icon-wrap">
          <span className="material-symbols-outlined" style={{ fontSize: "20px", color: "var(--accent-2)" }}>
            favorite
          </span>
        </div>
        <span>CuraSense AI</span>
      </NavLink>

      <nav className="nav-links">
        {links.map((l) => (
          <NavLink
            key={l.to}
            to={l.to}
            end={l.to === "/"}
            className={({ isActive }) => (isActive ? "nav-link active" : "nav-link")}
          >
            {l.label}
          </NavLink>
        ))}
      </nav>

      <div className="nav-actions">
        <button
          className="theme-btn"
          onClick={onToggle}
          aria-label="Toggle theme"
          type="button"
        >
          <span className="material-symbols-outlined" style={{ fontSize: "19px" }}>
            {theme === "dark" ? "light_mode" : "dark_mode"}
          </span>
        </button>
        <div className="avatar-badge" aria-hidden="true">
          <span className="material-symbols-outlined" style={{ fontSize: "18px" }}>
            person
          </span>
        </div>
      </div>
    </header>
  );
}