import json
import joblib
import pandas as pd
from pathlib import Path
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi import HTTPException
from pydantic import BaseModel
import rag
from schemas import BreastCancerInput, HeartInput, DiabetesInput

MODEL_DIR = Path("models")
NAMES = ["breast_cancer", "heart", "diabetes"]

MODELS = {n: joblib.load(MODEL_DIR / f"{n}.joblib") for n in NAMES}
META = {n: json.load(open(MODEL_DIR / f"{n}_meta.json")) for n in NAMES}

from fastapi import Depends
from auth import current_user
import os as _os
# Comma-separated list of allowed sites, e.g. https://your-app.vercel.app (default: any, for local use)
_CORS_ORIGINS = [o.strip().rstrip("/") for o in _os.getenv("CORS_ORIGINS", "*").split(",") if o.strip()]

app = FastAPI(title="Disease Prediction API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=_CORS_ORIGINS,  # tighten to your frontend URL after deploying
    allow_methods=["*"],
    allow_headers=["*"],
)


def risk_level(p: float) -> str:
    # Display levels only: Low below 35%, Moderate 35-65%, High from 65%
    if p >= 0.65:
        return "High"
    if p >= 0.35:
        return "Moderate"
    return "Low"


MAX_MISSING = 3
_dp = MODEL_DIR / "defaults.json"
DEFAULTS = json.load(open(_dp)) if _dp.exists() else {}


def predict(name: str, payload):
    features = META[name]["features"]
    data = payload.model_dump()
    missing = [f for f in features if data.get(f) is None]
    if missing:
        if len(missing) > MAX_MISSING:
            raise HTTPException(
                status_code=422,
                detail=f"Too many values are missing ({len(missing)}). Please fill in at least "
                       f"{len(features) - MAX_MISSING} of {len(features)} fields.",
            )
        defaults = DEFAULTS.get(name)
        if not defaults:
            raise HTTPException(status_code=422, detail="Missing values can't be filled in right now. Please fill every field.")
        for f in missing:
            data[f] = defaults[f]
    df = pd.DataFrame([data])[features]
    prob = float(MODELS[name].predict_proba(df)[0][1])
    return {
        "disease": name,
        "model": META[name]["model"],
        "prediction": int(prob >= 0.5),
        "probability": round(prob, 4),
        "risk": risk_level(prob),
        "assumed": missing,
    }


@app.get("/")
def home():
    return {"status": "ok", "diseases": NAMES}


@app.post("/predict/breast-cancer", dependencies=[Depends(current_user)])
def breast_cancer(data: BreastCancerInput):
    return predict("breast_cancer", data)


@app.post("/predict/heart", dependencies=[Depends(current_user)])
def heart(data: HeartInput):
    return predict("heart", data)


@app.post("/predict/diabetes", dependencies=[Depends(current_user)])
def diabetes(data: DiabetesInput):
    return predict("diabetes", data)

class ChatRequest(BaseModel):
    message: str


class DietPlanRequest(BaseModel):
    condition: str
    age: int
    weight_kg: float
    diet: str = "vegetarian"
    allergies: str = "none"


@app.post("/chat", dependencies=[Depends(current_user)])
def chat(req: ChatRequest):
    try:
        reply, sources = rag.answer(req.message)
    except Exception as e:
        print("chat error:", repr(e))
        raise HTTPException(status_code=503, detail="Assistant unavailable")
    return {"reply": reply, "sources": sources}


@app.post("/diet-plan", dependencies=[Depends(current_user)])
def diet_plan(req: DietPlanRequest):
    try:
        plan, sources = rag.diet_plan(req.model_dump())
    except Exception as e:
        print("diet-plan error:", repr(e))
        raise HTTPException(status_code=503, detail="Assistant unavailable")
    return {"plan": plan, "sources": sources}
from extras import router as extras_router
app.include_router(extras_router, dependencies=[Depends(current_user)])
from places import router as places_router
app.include_router(places_router, dependencies=[Depends(current_user)])
from auth import router as auth_router
app.include_router(auth_router)
