import { useState } from "react";
import type { FormEvent } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { errorMessage, useAuth } from "../auth";

type Mode = "login" | "register";
const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export default function Login() {
  const { user, login, register } = useAuth();
  const location = useLocation();
  const from = (location.state as { from?: { pathname: string; search: string } } | null)?.from;
  const dest = from ? from.pathname + from.search : "/predict";

  const [mode, setMode] = useState<Mode>("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  if (user) return <Navigate to={dest} replace />;

  const switchMode = (m: Mode) => {
    setMode(m);
    setError("");
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    if (mode === "register" && !name.trim()) return setError("Please enter your name.");
    if (!EMAIL_RE.test(email.trim())) return setError("Please enter a valid email address.");
    if (mode === "register" && password.length < 8) return setError("Your password must be at least 8 characters.");
    if (!password) return setError("Please enter your password.");
    setBusy(true);
    try {
      if (mode === "login") await login(email.trim(), password);
      else await register(name.trim(), email.trim(), password);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="auth-wrap">
      <div className="auth-card">
        <div className="auth-brand">
          <span className="material-symbols-outlined">favorite</span>
        </div>
        <h1>{mode === "login" ? "Welcome back" : "Create your account"}</h1>
        <p className="muted auth-sub">
          {mode === "login"
            ? "Log in to use risk prediction, the ECG reader, report reader and assistant."
            : "It takes a few seconds. Your details stay private to your account."}
        </p>

        <div className="auth-tabs" role="tablist">
          <button type="button" role="tab" aria-selected={mode === "login"} className={mode === "login" ? "on" : ""} onClick={() => switchMode("login")}>
            Log in
          </button>
          <button type="button" role="tab" aria-selected={mode === "register"} className={mode === "register" ? "on" : ""} onClick={() => switchMode("register")}>
            Sign up
          </button>
        </div>

        <form onSubmit={submit} noValidate>
          {mode === "register" && (
            <label className="auth-field">
              <span>Name</span>
              <input value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" placeholder="Your name" maxLength={60} />
            </label>
          )}
          <label className="auth-field">
            <span>Email</span>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" placeholder="you@example.com" />
          </label>
          <label className="auth-field">
            <span>Password</span>
            <div className="auth-pw">
              <input
                type={show ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete={mode === "login" ? "current-password" : "new-password"}
                placeholder={mode === "login" ? "Your password" : "At least 8 characters"}
              />
              <button type="button" className="auth-eye" onClick={() => setShow((s) => !s)} aria-label={show ? "Hide password" : "Show password"}>
                <span className="material-symbols-outlined">{show ? "visibility_off" : "visibility"}</span>
              </button>
            </div>
          </label>

          {error && (
            <div className="error">
              <span className="material-symbols-outlined" style={{ fontSize: "18px" }}>error_outline</span>
              <span>{error}</span>
            </div>
          )}

          <button className="btn primary auth-submit" type="submit" disabled={busy}>
            <span>{busy ? "Please wait…" : mode === "login" ? "Log in" : "Create account"}</span>
          </button>
        </form>

        <p className="muted auth-switch">
          {mode === "login" ? "New here?" : "Already have an account?"}{" "}
          <button type="button" onClick={() => switchMode(mode === "login" ? "register" : "login")}>
            {mode === "login" ? "Create an account" : "Log in"}
          </button>
        </p>
        <p className="muted auth-note">CuraSense AI is an educational tool and does not give medical advice or diagnoses.</p>
      </div>
    </div>
  );
}
