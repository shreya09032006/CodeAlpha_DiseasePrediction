import { useEffect, useRef, useState } from "react";
import axios from "axios";
import type { Disease } from "../diseases";
import { API_URL } from "../config";

type Res = { isFinal: boolean; [i: number]: { transcript: string } };
type SpeechRec = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((e: { results: ArrayLike<Res> }) => void) | null;
  onend: (() => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  start: () => void;
  stop: () => void;
};
type SRCtor = new () => SpeechRec;

export default function VoiceFill({ disease, onFill, onClear }: { disease: Disease; onFill: (v: Record<string, string>) => void; onClear: () => void }) {
  const [text, setText] = useState("");
  const [listening, setListening] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const recRef = useRef<SpeechRec | null>(null);

  useEffect(() => () => recRef.current?.stop(), []);

  const w = window as unknown as { SpeechRecognition?: SRCtor; webkitSpeechRecognition?: SRCtor };
  const SR = w.SpeechRecognition || w.webkitSpeechRecognition;

  const toggleMic = () => {
    if (listening) {
      recRef.current?.stop();
      return;
    }
    if (!SR) {
      setMsg("This browser has no speech input (use Chrome or Safari). You can type below instead.");
      return;
    }
    const rec = new SR();
    rec.lang = "en-IN";
    rec.continuous = true;
    rec.interimResults = true;
    const base = text.trim() ? text.trim() + " " : "";
    rec.onresult = (e) => {
      let spoken = "";
      for (let i = 0; i < e.results.length; i++) spoken += e.results[i][0].transcript;
      setText(base + spoken);
    };
    rec.onerror = (e) => {
      setMsg(e.error === "not-allowed" ? "Microphone access was blocked. Allow it in the browser address bar, or type below." : `Couldn't hear that (${e.error}). Try again or type below.`);
    };
    rec.onend = () => setListening(false);
    recRef.current = rec;
    setMsg("");
    setListening(true);
    rec.start();
  };

  const fill = async () => {
    recRef.current?.stop();
    if (!text.trim()) {
      setMsg("Say or type your values first.");
      return;
    }
    setBusy(true);
    setMsg("");
    try {
      const res = await axios.post(`${API_URL}/parse-voice`, {
        text,
        fields: disease.fields.map((f) => ({
          name: f.name,
          label: f.label,
          hint: f.hint ?? "",
          options: (f.options ?? []).map((o) => ({ value: String(o.value), label: o.label })),
        })),
      });
      const values: Record<string, string> = res.data.values ?? {};
      const names = disease.fields.filter((f) => f.name in values).map((f) => f.label);
      if (names.length === 0) {
        setMsg("I couldn't find any values in that. Try mentioning numbers, like 'age 45, glucose 130'.");
      } else {
        onFill(values);
        setMsg(`Filled ${names.length} field${names.length > 1 ? "s" : ""}: ${names.join(", ")}. Please check them, then press Predict.`);
      }
    } catch (err) {
      const d = (err as { response?: { data?: { detail?: unknown } } })?.response?.data?.detail;
      setMsg(typeof d === "string" ? d : "Could not reach the server. Is the backend running?");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="voice-fill">
      <div className="voice-head">
        <span className="material-symbols-outlined" style={{ fontSize: "20px" }}>graphic_eq</span>
        <strong>Speak or type your details</strong>
        <small className="muted">Optional. Up to 3 fields can stay empty.</small>
      </div>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={2}
        placeholder="e.g. I am 45 years old, my blood sugar is 130 and my blood pressure is 140 over 90"
      />
      <div className="voice-actions">
        <button type="button" className={listening ? "btn primary voice-live" : "btn ghost"} onClick={toggleMic}>
          <span className="material-symbols-outlined" style={{ fontSize: "18px" }}>{listening ? "stop_circle" : "mic"}</span>
          <span>{listening ? "Stop" : "Speak"}</span>
        </button>
        <button type="button" className="btn primary" onClick={fill} disabled={busy}>
          <span className="material-symbols-outlined" style={{ fontSize: "18px" }}>auto_fix_high</span>
          <span>{busy ? "Reading…" : "Fill the form"}</span>
        </button>
        <button type="button" className="btn ghost" onClick={onClear}>
          <span className="material-symbols-outlined" style={{ fontSize: "18px" }}>delete_sweep</span>
          <span>Clear all</span>
        </button>
      </div>
      {msg && <p className="voice-msg">{msg}</p>}
    </div>
  );
}
