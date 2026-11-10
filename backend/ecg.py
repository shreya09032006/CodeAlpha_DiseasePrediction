"""ECG image endpoint: POST /predict/ecg  (informational only, not a diagnosis)."""
import io
import json
from pathlib import Path

from fastapi import APIRouter, File, HTTPException, UploadFile

router = APIRouter()
MODEL_DIR = Path("models")
MAX_BYTES = 10 * 1024 * 1024
MIN_CONFIDENCE = 0.60
_state = {}

LABELS = {
    "normal": "Normal ECG pattern",
    "abnormal_heartbeat": "Abnormal heartbeat pattern",
    "mi": "Pattern suggesting a heart attack (MI)",
    "history_mi": "Pattern suggesting a past heart attack",
}


def _load():
    # torch is imported here, so the rest of the API still starts without it
    if "model" not in _state:
        import torch
        import torch.nn as nn
        from torchvision import models

        meta = json.load(open(MODEL_DIR / "ecg_meta.json"))
        m = models.efficientnet_b0(weights=None)
        m.classifier = nn.Sequential(nn.Dropout(0.3), nn.Linear(m.classifier[1].in_features, len(meta["classes"])))
        m.load_state_dict(torch.load(MODEL_DIR / "ecg_model.pt", map_location="cpu"))
        m.eval()
        _state["model"], _state["meta"] = m, meta
    return _state["model"], _state["meta"]


@router.post("/predict/ecg")
def predict_ecg(file: UploadFile = File(...)):
    if file.content_type not in ("image/jpeg", "image/png", "image/webp"):
        raise HTTPException(status_code=400, detail="Please upload a JPG, PNG or WebP photo or scan of the ECG.")
    data = file.file.read(MAX_BYTES + 1)
    if len(data) > MAX_BYTES:
        raise HTTPException(status_code=413, detail="That image is larger than 10 MB.")
    try:
        import numpy as np
        import torch
        from PIL import Image

        img = Image.open(io.BytesIO(data)).convert("RGB")
    except Exception:
        raise HTTPException(status_code=400, detail="That file couldn't be read as an image.")
    try:
        model, meta = _load()
    except Exception as e:
        print("ecg model load error:", type(e).__name__, str(e)[:200])
        raise HTTPException(status_code=503, detail="The ECG model isn't available on the server right now.")

    h, w = meta["size"]
    arr = np.asarray(img.resize((w, h), Image.BILINEAR), dtype=np.float32) / 255.0
    arr = (arr - np.array(meta["mean"], dtype=np.float32)) / np.array(meta["std"], dtype=np.float32)
    x = torch.from_numpy(arr).permute(2, 0, 1).unsqueeze(0)
    with torch.no_grad():
        probs = torch.softmax(model(x), dim=1)[0].tolist()
    ranked = sorted(zip(meta["classes"], probs), key=lambda t: -t[1])
    top, conf = ranked[0]
    return {
        "prediction": top,
        "label": LABELS.get(top, top),
        "confidence": round(conf, 4),
        "confident": conf >= MIN_CONFIDENCE,
        "probabilities": [{"class": c, "label": LABELS.get(c, c), "probability": round(p, 4)} for c, p in ranked],
        "model": "EfficientNet-B0 (transfer learning on ECG images)",
        "test_accuracy": meta.get("test_accuracy"),
    }
