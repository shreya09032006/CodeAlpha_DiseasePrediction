import { NavLink } from "react-router-dom";
import type { Theme } from "../theme";
import { useAuth } from "../auth";

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
  const { user, logout } = useAuth();
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
        {user ? (
          <>
            <span className="nav-user">{user.name.split(" ")[0]}</span>
            <div className="avatar-badge" title={user.email}>
              {user.name.charAt(0).toUpperCase()}
            </div>
            <button className="theme-btn" onClick={logout} aria-label="Log out" title="Log out" type="button">
              <span className="material-symbols-outlined" style={{ fontSize: "19px" }}>
                logout
              </span>
            </button>
          </>
        ) : (
          <NavLink to="/login" className="btn primary nav-login">
            Log in
          </NavLink>
        )}
      </div>
    </header>
  );
}