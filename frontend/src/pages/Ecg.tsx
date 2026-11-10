import { useEffect, useRef, useState } from "react";
import type { ChangeEvent, DragEvent } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { API_URL } from "../config";
import EcgResult from "../components/EcgResult";
import type { EcgAI } from "../components/EcgResult";

export default function Ecg() {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState("");
  const [result, setResult] = useState<EcgAI | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [drag, setDrag] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

  const pick = (f: File | undefined | null) => {
    if (!f) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(f.type)) {
      setError("Please choose a JPG, PNG or WebP image of the ECG.");
      return;
    }
    if (f.size > 10 * 1024 * 1024) {
      setError("That image is larger than 10 MB.");
      return;
    }
    setFile(f);
    setPreview(URL.createObjectURL(f));
    setResult(null);
    setError("");
  };

  const analyze = async () => {
    if (!file) return;
    setLoading(true);
    setError("");
    setResult(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await axios.post<EcgAI>(`${API_URL}/analyze-ecg`, fd);
      setResult(res.data);
    } catch (err) {
      const d = (err as { response?: { data?: { detail?: unknown } } })?.response?.data?.detail;
      setError(typeof d === "string" ? d : "Could not analyze the image. Is the backend running?");
    } finally {
      setLoading(false);
    }
  };

  const clearAll = () => {
    setFile(null);
    setPreview("");
    setResult(null);
    setError("");
    if (inputRef.current) inputRef.current.value = "";
  };

  return (
    <div className="container">
      <div style={{ marginBottom: "24px" }}>
        <h1 className="page-title">ECG Reader</h1>
        <p className="muted" style={{ maxWidth: "680px" }}>
          Upload a photo or scan of an ECG and an AI will describe what it can see in plain language.
          This is an educational tool, not a diagnosis.
        </p>
      </div>

      <section className="card">
        <div
          className={drag ? "ecg-drop drag" : "ecg-drop"}
          onClick={() => inputRef.current?.click()}
          onDragOver={(e: DragEvent) => { e.preventDefault(); setDrag(true); }}
          onDragLeave={() => setDrag(false)}
          onDrop={(e: DragEvent) => { e.preventDefault(); setDrag(false); pick(e.dataTransfer.files?.[0]); }}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => { if (e.key === "Enter") inputRef.current?.click(); }}
        >
          <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            hidden
            onChange={(e: ChangeEvent<HTMLInputElement>) => pick(e.target.files?.[0])}
          />
          {preview ? (
            <img className="ecg-preview" src={preview} alt="Selected ECG" />
          ) : (
            <>
              <span className="material-symbols-outlined ecg-drop-icon">ecg_heart</span>
              <strong>Drop your ECG image here, or click to choose</strong>
              <small className="muted">JPG, PNG or WebP, up to 10 MB</small>
            </>
          )}
        </div>

        <div className="actions">
          <button className="btn primary" type="button" onClick={analyze} disabled={!file || loading}>
            <span className="material-symbols-outlined" style={{ fontSize: "18px" }}>auto_awesome</span>
            <span>{loading ? "Reading…" : "Read my ECG"}</span>
          </button>
          <button className="btn ghost" type="button" onClick={clearAll} disabled={!file && !result && !error}>
            <span className="material-symbols-outlined" style={{ fontSize: "18px" }}>delete_sweep</span>
            <span>Clear</span>
          </button>
        </div>

        <p className="muted ecg-tip">
          For best results: the whole ECG sheet in frame, held flat, evenly lit, no shadows or glare.
        </p>

        {error && (
          <div className="error">
            <span className="material-symbols-outlined" style={{ fontSize: "18px" }}>error_outline</span>
            <span>{error}</span>
          </div>
        )}

        {result && <EcgResult result={result} onDoctors={() => navigate("/doctors?disease=heart")} />}
      </section>
    </div>
  );
}
