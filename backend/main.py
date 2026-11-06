import json
import joblib
import pandas as pd
from pathlib import Path
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from schemas import BreastCancerInput, HeartInput, DiabetesInput

MODEL_DIR = Path("models")
NAMES = ["breast_cancer", "heart", "diabetes"]

MODELS = {n: joblib.load(MODEL_DIR / f"{n}.joblib") for n in NAMES}
META = {n: json.load(open(MODEL_DIR / f"{n}_meta.json")) for n in NAMES}

app = FastAPI(title="Disease Prediction API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # tighten to your frontend URL after deploying
    allow_methods=["*"],
    allow_headers=["*"],
)


def predict(name: str, payload):
    features = META[name]["features"]
    df = pd.DataFrame([payload.model_dump()])[features]
    prob = float(MODELS[name].predict_proba(df)[0][1])
    return {
        "disease": name,
        "model": META[name]["model"],
        "prediction": int(prob >= 0.5),
        "probability": round(prob, 4),
        "risk": "High" if prob >= 0.5 else "Low",
    }


@app.get("/")
def home():
    return {"status": "ok", "diseases": NAMES}


@app.post("/predict/breast-cancer")
def breast_cancer(data: BreastCancerInput):
    return predict("breast_cancer", data)


@app.post("/predict/heart")
def heart(data: HeartInput):
    return predict("heart", data)


@app.post("/predict/diabetes")
def diabetes(data: DiabetesInput):
    return predict("diabetes", data)