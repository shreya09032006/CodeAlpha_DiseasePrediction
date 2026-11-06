import { useState } from "react";

export default function Heart() {
  const [loadError, setLoadError] = useState(false);

  return (
    <div className="realistic-heart-container" aria-label="3D Anatomical Heart Telemetry">
      {/* Telemetry Radar Rings */}
      <div className="cardiac-orbit orbit-1" aria-hidden="true" />
      <div className="cardiac-orbit orbit-2" aria-hidden="true" />

      {/* Pulsing Anatomical 3D Heart */}
      <div className="realistic-heart-core heart-pump">
        {!loadError ? (
          <img
            src="/heart-realistic.png"
            alt="Realistic 3D Anatomical Heart with glowing coronary conduction vessels"
            className="realistic-heart-img"
            onError={() => setLoadError(true)}
          />
        ) : (
          <svg className="heart-svg" viewBox="0 0 400 400" aria-hidden="true">
            <defs>
              <linearGradient id="hg" x1="0.1" y1="0" x2="0.9" y2="1">
                <stop offset="0%" stopColor="#ff5d73" />
                <stop offset="35%" stopColor="#e11d48" />
                <stop offset="75%" stopColor="#880e28" />
                <stop offset="100%" stopColor="#450a1c" />
              </linearGradient>
            </defs>
            <path
              d="M200 352 C60 255 38 130 118 90 C165 66 200 100 200 128 C200 100 235 66 282 90 C362 130 340 255 200 352 Z"
              fill="url(#hg)"
            />
          </svg>
        )}
      </div>

      {/* Dynamic ECG Wave Overlay */}
      <svg className="heart-ecg-overlay" viewBox="0 0 400 200" aria-hidden="true">
        <path
          className="heart-ecg"
          pathLength={100}
          d="M 20 100 H 120 L 140 100 L 155 55 L 180 148 L 200 35 L 215 118 L 228 100 H 380"
        />
      </svg>
    </div>
  );
}