import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import axios from "axios";
import { API_URL } from "./config";

export type User = { id: number; name: string; email: string };

type AuthState = {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  logout: () => void;
};

const KEY = "curasense_token";
const AuthContext = createContext<AuthState | null>(null);

function applyToken(token: string | null) {
  try {
    if (token) localStorage.setItem(KEY, token);
    else localStorage.removeItem(KEY);
  } catch {
    /* storage can be unavailable */
  }
  if (token) axios.defaults.headers.common.Authorization = `Bearer ${token}`;
  else delete axios.defaults.headers.common.Authorization;
}

export function errorMessage(err: unknown): string {
  const d = (err as { response?: { data?: { detail?: unknown } } })?.response?.data?.detail;
  if (typeof d === "string") return d;
  if (Array.isArray(d)) return "Please check the details you entered.";
  return "Could not reach the server. Is the backend running?";
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let stored: string | null = null;
    try {
      stored = localStorage.getItem(KEY);
    } catch {
      stored = null;
    }
    if (!stored) {
      setLoading(false);
      return;
    }
    applyToken(stored);
    axios
      .get(`${API_URL}/auth/me`)
      .then((res) => setUser(res.data.user))
      .catch(() => applyToken(null))
      .finally(() => setLoading(false));
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const res = await axios.post(`${API_URL}/auth/login`, { email, password });
    applyToken(res.data.token);
    setUser(res.data.user);
  }, []);

  const register = useCallback(async (name: string, email: string, password: string) => {
    const res = await axios.post(`${API_URL}/auth/register`, { name, email, password });
    applyToken(res.data.token);
    setUser(res.data.user);
  }, []);

  const logout = useCallback(() => {
    applyToken(null);
    setUser(null);
    try {
      sessionStorage.clear(); // forms and results are private to the person who entered them
    } catch {
      /* ignore */
    }
  }, []);

  const value = useMemo(() => ({ user, loading, login, register, logout }), [user, loading, login, register, logout]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
