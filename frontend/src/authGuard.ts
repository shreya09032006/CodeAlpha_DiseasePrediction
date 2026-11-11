import axios from "axios";
import type { AxiosInstance, InternalAxiosRequestConfig } from "axios";

const KEY = "curasense_token";

function addToken(config: InternalAxiosRequestConfig) {
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
  if (axios.isAxiosError(error) && error.response?.status === 401) {
    const url = error.config?.url ?? "";
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
