import axios from "axios";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? "http://127.0.0.1:8000",
});

export interface PredictionResult {
  disease: string;
  model: string;
  prediction: number;
  probability: number;
  risk: "High" | "Low";
}

export async function predict(
  endpoint: string,
  payload: Record<string, number>
): Promise<PredictionResult> {
  const { data } = await api.post<PredictionResult>(endpoint, payload);
  return data;
}