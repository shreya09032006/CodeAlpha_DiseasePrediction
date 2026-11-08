import { useState } from "react";
import type { ChangeEvent } from "react";
import axios from "axios";
import ReactMarkdown from "react-markdown";
import { API_URL } from "../config";

type Assessment = { summary: string; sources: string[]; note: string };

export default function Reports() {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState("");
  const [values, setValues] = useState<Record<string, string | number> | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [assessment, setAssessment] = useState<Assessment | null>(null);
  const [assessing, setAssessing] = useState(false);

  const assess = async (vals: Record<string, string | number>) => {
    setAssessing(true);
    setAssessment(null);
    try {
      const clean = Object.fromEntries(Object.entries(vals).map(([k, v]) => [k, String(v)]));
      const res = await axios.post(`${API_URL}/assess-report`, { values: clean });
      setAssessment(res.data);
    } catch {
      setAssessment({ summary: "", sources: [], note: "Couldn't get an assessment right now. The extracted values above are still correct to review." });
    } finally {
      setAssessing(false);
    }
  };

  const onChange = (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0] ?? null;
    setFile(f);
    setValues(null);
    setAssessment(null);
    setError("");
    setPreview(f && f.type.startsWith("image/") ? URL.createObjectURL(f) : "");
  };

  const upload = async () => {
    if (!file) return;
    setLoading(true);
    setError("");
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await axios.post(`${API_URL}/extract-report`, form);
      setValues(res.data.values);
      assess(res.data.values);
    } catch (err) {
      const detail = axios.isAxiosError(err) ? err.response?.data?.detail : undefined;
      setError(typeof detail === "string" ? detail : "Couldn't reach the report reader. Is the backend running?");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container">
      <div className="header-badge">
        <span className="material-symbols-outlined" style={{ fontSize: "17px" }}>
          document_scanner
        </span>
        <span>Clinical OCR Pipeline</span>
      </div>
      <h1 className="page-title">Report Reader</h1>
      <p className="muted" style={{ maxWidth: "680px", marginBottom: "28px" }}>
        Upload a lab report, insulin report or ECG report (image or PDF). Values like glucose,
        cholesterol and heart rate are extracted for you to review.
      </p>

      <section className="card">
        <div className="card-ambient-glow" aria-hidden="true" />

        <div className="reports-layout">
          <label className="dropzone">
            <input type="file" accept="image/*,application/pdf" onChange={onChange} hidden />
            <div className="dropzone-icon-wrap">
              <span className="material-symbols-outlined" style={{ fontSize: "28px" }}>
                cloud_upload
              </span>
            </div>
            <p className="dropzone-title">{file ? file.name : "Click to choose a file"}</p>
            <p className="dropzone-sub">Supports PDF, JPG, PNG or DICOM up to 25MB</p>
            <div className="security-badge">
              <span className="material-symbols-outlined" style={{ fontSize: "14px" }}>
                lock
              </span>
              <span>256-Bit Encrypted Diagnostic Parser</span>
            </div>
          </label>

          <div className="preview-panel">
            <div className="preview-panel-header">
              <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                <span className="material-symbols-outlined" style={{ color: "var(--accent-2)", fontSize: "18px" }}>
                  receipt_long
                </span>
                <span style={{ fontSize: "13px", fontWeight: "600" }}>Document Snapshot Preview</span>
              </div>
              <span className="preview-badge-status">
                {file ? "DOCUMENT LOADED" : "READY FOR PARSE"}
              </span>
            </div>

            <div className="preview-img-wrap">
              {preview ? (
                <img src={preview} alt="Report preview" />
              ) : (
                <div
                  style={{
                    height: "100%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "var(--muted)",
                    fontSize: "13px",
                  }}
                >
                  No document uploaded yet
                </div>
              )}
            </div>

            <div className="preview-source-info">
              <span style={{ maxWidth: "200px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {file ? file.name : "METABOLIC_PANEL_REF.PDF"}
              </span>
              <span>OCR Ready</span>
            </div>
          </div>
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: "16px",
            marginTop: "16px",
          }}
        >
          <button className="btn primary" onClick={upload} disabled={!file || loading} type="button">
            <span className="material-symbols-outlined" style={{ fontSize: "19px" }}>
              instant_mix
            </span>
            <span>{loading ? "Extracting…" : "Extract values"}</span>
          </button>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "12px", color: "var(--muted)" }}>
            <span className="pulse-dot" />
            <span>Neural Engine Active</span>
          </div>
        </div>

        {error && (
          <div className="error" style={{ marginTop: "20px" }}>
            <span className="material-symbols-outlined" style={{ fontSize: "18px" }}>
              info
            </span>
            <span>{error}</span>
          </div>
        )}

        {values && (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Measurement</th>
                  <th>Value</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(values).map(([k, v]) => (
                  <tr key={k}>
                    <td style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <span className="pulse-dot crimson" style={{ width: "6px", height: "6px" }} />
                      {k}
                    </td>
                    <td>{String(v)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {(assessing || assessment) && (
          <div className="assess">
            <h3 className="assess-title">
              <span className="material-symbols-outlined" style={{ fontSize: "22px" }}>
                monitoring
              </span>
              AI assessment of your report
            </h3>
            {assessing && <p className="muted">Reading your values…</p>}
            {assessment?.summary && (
              <div className="markdown">
                <ReactMarkdown>{assessment.summary}</ReactMarkdown>
              </div>
            )}
            {assessment && !assessment.summary && assessment.note && <p className="muted">{assessment.note}</p>}
            {assessment && assessment.sources.length > 0 && (
              <div className="diet-sources">
                Based on: {assessment.sources.map((x) => x.replace(/^Source:\s*/i, "")).join(" · ")}
              </div>
            )}
            <p className="muted" style={{ marginTop: "12px", fontSize: "12px" }}>
              AI-generated from only the values in your report. It can be wrong and is not a diagnosis.
            </p>
          </div>
        )}

        <small className="muted" style={{ display: "flex", alignItems: "center", gap: "6px", marginTop: "16px" }}>
          <span className="material-symbols-outlined" style={{ fontSize: "16px" }}>
            info
          </span>
          Extracted values can be wrong. Always check them against your report.
        </small>
      </section>
    </div>
  );
}