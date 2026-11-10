export type EcgAI = {
  is_ecg: boolean;
  quality: string;
  heart_rate: number | null;
  rhythm: string;
  concern: string;
  summary: string;
  looks_normal?: string[];
  worth_checking?: string[];
  findings?: string[];
};

type Level = "low" | "moderate" | "high" | "unsure";
const NEEDLE: Record<Exclude<Level, "unsure">, number> = { low: 30, moderate: 90, high: 150 };
const SEGMENTS = [
  { k: "low", a: 4, b: 56, c: "#22c55e" },
  { k: "moderate", a: 64, b: 116, c: "#f59e0b" },
  { k: "high", a: 124, b: 176, c: "#ef4444" },
] as const;

const pt = (deg: number) => {
  const r = (deg * Math.PI) / 180;
  return `${(100 - 80 * Math.cos(r)).toFixed(1)} ${(100 - 80 * Math.sin(r)).toFixed(1)}`;
};
const arc = (a: number, b: number) => `M ${pt(a)} A 80 80 0 0 1 ${pt(b)}`;
const cap = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

function Gauge({ level }: { level: Level }) {
  return (
    <svg viewBox="0 0 200 116" className="ecg2-gauge" role="img" aria-label={`Concern level: ${level}`}>
      {SEGMENTS.map((s) => (
        <path
          key={s.k}
          d={arc(s.a, s.b)}
          fill="none"
          stroke={level === "unsure" ? "#94a3b8" : s.c}
          strokeOpacity={level === s.k ? 1 : 0.28}
          strokeWidth="15"
          strokeLinecap="round"
        />
      ))}
      {level !== "unsure" && (
        <g transform={`rotate(${NEEDLE[level] - 90} 100 100)`}>
          <line x1="100" y1="100" x2="100" y2="42" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" />
        </g>
      )}
      <circle cx="100" cy="100" r="8" fill="currentColor" />
    </svg>
  );
}

export default function EcgResult({ result, onDoctors }: { result: EcgAI; onDoctors: () => void }) {
  if (!result.is_ecg) {
    return (
      <div className="ecg2 tone-unsure">
        <div className="ecg2-hero single">
          <span className="ecg2-big-ic material-symbols-outlined">image_search</span>
          <div>
            <p className="ecg2-headline">This doesn't look like an ECG</p>
            <p className="ecg2-sub">{result.summary || "Please upload a clear picture of an ECG tracing."}</p>
          </div>
        </div>
      </div>
    );
  }

  const raw = result.concern.toLowerCase();
  const level: Level = raw === "low" || raw === "moderate" || raw === "high" ? raw : "unsure";
  const good = result.looks_normal ?? [];
  const check = result.worth_checking ?? [];
  const legacy = good.length === 0 && check.length === 0 ? result.findings ?? [] : [];

  return (
    <div className={`ecg2 tone-${level}`}>
      <div className="ecg2-hero">
        <div className="ecg2-gauge-wrap">
          <Gauge level={level} />
          <div className="ecg2-level">{level === "unsure" ? "Unclear" : `${cap(level)} concern`}</div>
        </div>
        <div>
          <p className="ecg2-headline">{result.summary || "Here is what the AI could see in your ECG."}</p>
          <p className="ecg2-sub">AI-generated and can be wrong. Not a diagnosis.</p>
        </div>
      </div>

      <div className="ecg2-stats">
        <div className="ecg2-stat">
          <span className="ecg2-stat-ic material-symbols-outlined">monitor_heart</span>
          <div>
            <div className="ecg2-stat-val">
              {result.heart_rate != null ? <>{result.heart_rate} <small>bpm</small></> : "Not clear"}
            </div>
            <div className="ecg2-stat-lab">Heart rate</div>
          </div>
        </div>
        <div className="ecg2-stat">
          <span className="ecg2-stat-ic material-symbols-outlined">show_chart</span>
          <div>
            <div className="ecg2-stat-val">{cap(result.rhythm)}</div>
            <div className="ecg2-stat-lab">Rhythm</div>
          </div>
        </div>
        <div className="ecg2-stat">
          <span className="ecg2-stat-ic material-symbols-outlined">image</span>
          <div>
            <div className="ecg2-stat-val">{cap(result.quality)}</div>
            <div className="ecg2-stat-lab">Image quality</div>
          </div>
        </div>
      </div>

      {(good.length > 0 || check.length > 0 || legacy.length > 0) && (
        <div className="ecg2-cols">
          {good.length > 0 && (
            <div className="ecg2-col good">
              <h4><span className="material-symbols-outlined">check_circle</span> Looks fine</h4>
              {good.map((t, i) => (
                <div key={i} className="ecg2-item"><span className="material-symbols-outlined">check</span><span>{t}</span></div>
              ))}
            </div>
          )}
          {check.length > 0 && (
            <div className="ecg2-col check">
              <h4><span className="material-symbols-outlined">help</span> Worth asking a doctor about</h4>
              {check.map((t, i) => (
                <div key={i} className="ecg2-item"><span className="material-symbols-outlined">arrow_right_alt</span><span>{t}</span></div>
              ))}
            </div>
          )}
          {legacy.length > 0 && (
            <div className="ecg2-col check wide">
              <h4><span className="material-symbols-outlined">visibility</span> What the AI noticed</h4>
              {legacy.map((t, i) => (
                <div key={i} className="ecg2-item"><span className="material-symbols-outlined">arrow_right_alt</span><span>{t}</span></div>
              ))}
            </div>
          )}
        </div>
      )}

      {(level === "moderate" || level === "high") && (
        <div className="ecg2-cta">
          <button type="button" className="btn primary" onClick={onDoctors}>
            <span className="material-symbols-outlined" style={{ fontSize: "18px" }}>location_on</span>
            <span>Find nearby heart doctors</span>
          </button>
        </div>
      )}

      <div className="ecg2-foot">
        <span className="material-symbols-outlined" style={{ fontSize: "16px" }}>info</span>
        <span>Informational only. Only a doctor can read an ECG. If you have chest pain, trouble breathing or feel faint, call your local emergency number now.</span>
      </div>
    </div>
  );
}
