import axios from "axios";
import type { AxiosInstance, InternalAxiosRequestConfig } from "axios";
import { API_URL } from "./config";

const KEY = "curasense_token";

// True only for requests that go to our own backend, so the login token is never
// sent to third-party sites (maps, geocoding and so on).
function isOurApi(config: { url?: string; baseURL?: string }) {
  const url = config.url ?? "";
  const absolute = /^https?:\/\//i.test(url);
  const full = absolute ? url : `${config.baseURL ?? ""}${url}`;
  if (!/^https?:\/\//i.test(full)) return true; // relative, same site
  return full.startsWith(API_URL.replace(/\/+$/, ""));
}

function addToken(config: InternalAxiosRequestConfig) {
  if (!isOurApi(config)) {
    config.headers.delete("Authorization");
    return config;
  }
  let token: string | null = null;
  try {
    token = localStorage.getItem(KEY);
  } catch {
    /* storage blocked */
  }
  if (token && !config.headers.has("Authorization")) {
    config.headers.set("Authorization", `Bearer ${token}`);
  }
  return config;
}

function onUnauthorized(error: unknown) {
  if (axios.isAxiosError(error) && error.response?.status === 401 && error.config && isOurApi(error.config)) {
    const url = error.config.url ?? "";
    const isAuthForm = url.includes("/auth/login") || url.includes("/auth/register");
    if (!isAuthForm && window.location.pathname !== "/login") {
      try {
        localStorage.removeItem(KEY);
      } catch {
        /* ignore */
      }
      delete axios.defaults.headers.common.Authorization;
      window.location.assign("/login");
    }
  }
  return Promise.reject(error);
}

function wire(instance: AxiosInstance) {
  instance.interceptors.request.use(addToken);
  instance.interceptors.response.use((r) => r, onUnauthorized);
  return instance;
}

wire(axios);

// Instances made with axios.create() get the same behaviour.
const originalCreate = axios.create.bind(axios);
axios.create = ((config?: Parameters<typeof originalCreate>[0]) =>
  wire(originalCreate(config))) as typeof axios.create;
