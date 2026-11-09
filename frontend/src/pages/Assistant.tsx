/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useRef, useState } from "react";
import axios from "axios";
import { API_URL } from "../config";
import ReactMarkdown from "react-markdown";
import DietPlan from "../components/DietPlan";

interface Msg {
  role: "user" | "assistant";
  text: string;
}

const SUGGESTIONS = [
  "Suggest a diet plan for diabetes",
  "What exercises are good for heart health?",
  "Foods to avoid with high cholesterol",
];

export default function Assistant() {
  const [msgs, setMsgs] = useState<Msg[]>([
    { role: "assistant", text: "Hi! Ask me about diet and exercise. You can type or use the mic." },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [listening, setListening] = useState(false);
  const [speakOn, setSpeakOn] = useState(true);
  const [notice, setNotice] = useState("");
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [msgs]);

  const speak = (text: string) => {
    if (!speakOn || !("speechSynthesis" in window)) return;
    const u = new SpeechSynthesisUtterance(text.replace(/[*#_`]/g, ""));
    u.lang = "en-IN";
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(u);
  };

  const send = async (text: string) => {
    const t = text.trim();
    if (!t) return;
    setMsgs((m) => [...m, { role: "user", text: t }]);
    setInput("");
    setLoading(true);
    try {
      const res = await axios.post(`${API_URL}/chat`, { message: t });
      const reply: string = res.data.reply;
      setMsgs((m) => [...m, { role: "assistant", text: reply }]);
      speak(reply);
    } catch {
      setMsgs((m) => [
        ...m,
        {
          role: "assistant",
          text: "Couldn't get a response. Please check that the backend is running and try again.",
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const startListening = () => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) {
      setNotice("Voice input isn't supported in this browser. Try Chrome.");
      return;
    }
    setNotice("");
    const rec = new SR();
    rec.lang = "en-IN";
    rec.interimResults = false;
    rec.onstart = () => setListening(true);
    rec.onend = () => setListening(false);
    rec.onerror = () => {
      setListening(false);
      setNotice("Couldn't hear you. Check microphone permission and try again.");
    };
    rec.onresult = (e: any) => send(e.results[0][0].transcript);
    rec.start();
  };

  const getIconForSuggestion = (text: string) => {
    if (text.toLowerCase().includes("diet")) return "nutrition";
    if (text.toLowerCase().includes("exercise")) return "cardiology";
    return "no_meals";
  };

  return (
    <div className="container">
      <div style={{ textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", marginBottom: "28px" }}>
        <div className="header-badge">
          <span className="material-symbols-outlined" style={{ fontSize: "16px", color: "var(--tertiary-fixed)" }}>
            graphic_eq
          </span>
          <span>Neural Telemetry Voice AI</span>
        </div>
        <h1 className="page-title">Voice Assistant</h1>
        <p className="muted" style={{ maxWidth: "520px" }}>
          Ask about diet plans, foods to avoid and exercise for your condition.
        </p>
      </div>

      <div className="chat-console" style={{ maxWidth: "860px", margin: "0 auto" }}>
        <div className="chips-row">
          {SUGGESTIONS.map((s) => (
            <button key={s} className="chip" onClick={() => send(s)} type="button">
              <span className="material-symbols-outlined">
                {getIconForSuggestion(s)}
              </span>
              <span>{s}</span>
            </button>
          ))}
        </div>

        <DietPlan />

        <div className="messages">
          {msgs.map((m, i) => (
            <div key={i} className={`msg-row ${m.role}`}>
              <div className="msg-avatar">
                <span className="material-symbols-outlined" style={{ fontSize: "18px" }}>
                  {m.role === "assistant" ? "vital_signs" : "person"}
                </span>
              </div>
              <div className="msg-body">
                <div className={`bubble ${m.role}`}>
                  {m.role === "assistant" ? (
                    <div className="markdown">
                    <ReactMarkdown>{m.text}</ReactMarkdown>
                    </div>
                   ) : (
                    m.text
                     )}
                  </div>
                <span className="msg-stamp">
                  {m.role === "assistant" ? "CuraSense AI Clinical AI" : "Delivered"}
                </span>
              </div>
            </div>
          ))}

          {loading && (
            <div className="msg-row assistant">
              <div className="msg-avatar">
                <span className="material-symbols-outlined" style={{ fontSize: "18px" }}>
                  vital_signs
                </span>
              </div>
              <div className="msg-body">
                <div className="bubble assistant">Thinking…</div>
              </div>
            </div>
          )}

          {listening && (
            <div className="listening-panel">
              <div className="acoustic-rings">
                <div className="acoustic-ping" />
                <div className="acoustic-mic-circle">
                  <span className="material-symbols-outlined" style={{ fontSize: "22px" }}>
                    mic
                  </span>
                </div>
              </div>
              <div className="listening-text">
                <span className="pulse-dot crimson" />
                <span>Listening…</span>
              </div>
              <div className="waveform-bars">
                <span className="waveform-bar" />
                <span className="waveform-bar" />
                <span className="waveform-bar" />
                <span className="waveform-bar" />
                <span className="waveform-bar" />
              </div>
            </div>
          )}
          <div ref={endRef} />
        </div>

        <div className="chat-input-bar">
          {notice && (
            <div className="error" style={{ marginBottom: "8px", marginTop: 0 }}>
              <span className="material-symbols-outlined" style={{ fontSize: "18px" }}>
                warning
              </span>
              <span>{notice}</span>
            </div>
          )}

          <form
            className="chat-input-form"
            onSubmit={(e) => {
              e.preventDefault();
              send(input);
            }}
          >
            <button
              type="button"
              className={`round-tool-btn ${listening ? "active" : ""}`}
              onClick={startListening}
              aria-label="Speak"
            >
              <span className="material-symbols-outlined" style={{ fontSize: "22px" }}>
                {listening ? "mic" : "mic_none"}
              </span>
            </button>
            <input
              className="chat-text-input"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Type or speak your question…"
            />
            <button
              type="button"
              className="round-tool-btn"
              onClick={() => setSpeakOn((s) => !s)}
              aria-label="Toggle speaker"
            >
              <span className="material-symbols-outlined" style={{ fontSize: "20px" }}>
                {speakOn ? "volume_up" : "volume_off"}
              </span>
            </button>
            <button type="submit" className="btn primary" disabled={loading}>
              <span>Send</span>
              <span className="material-symbols-outlined" style={{ fontSize: "16px" }}>
                arrow_upward
              </span>
            </button>
          </form>

          <div className="chat-status-sub">
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <span className="pulse-dot" style={{ width: "6px", height: "6px" }} />
              <span>Voice Engine Active · Low Latency</span>
            </div>
            <span>Press Mic to record or type query</span>
          </div>
        </div>
      </div>
    </div>
  );
}