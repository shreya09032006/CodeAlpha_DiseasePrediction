# Run once from backend/: python make_defaults.py
# Saves typical values (median, or most common value for choice fields) used to fill empty inputs.
import json
from pathlib import Path

import numpy as np
import pandas as pd
from sklearn.datasets import load_breast_cancer

M = Path("models")
out = {}


def feats(n):
    return json.load(open(M / f"{n}_meta.json"))["features"]


d = pd.read_csv("data/diabetes.csv")
for c in ["Glucose", "BloodPressure", "SkinThickness", "Insulin", "BMI"]:
    d[c] = d[c].replace(0, np.nan)
out["diabetes"] = {c: round(float(d[c].median()), 4) for c in feats("diabetes")}

cols = ["age", "sex", "cp", "trestbps", "chol", "fbs", "restecg", "thalach", "exang", "oldpeak", "slope", "ca", "thal", "target"]
h = pd.read_csv("data/heart_cleveland.data", header=None, names=cols, na_values="?")
cat = {"sex", "cp", "fbs", "restecg", "exang", "slope", "ca", "thal"}
out["heart"] = {c: (int(h[c].mode().iloc[0]) if c in cat else round(float(h[c].median()), 4)) for c in feats("heart")}

b = load_breast_cancer(as_frame=True).data
b.columns = [x.replace(" ", "_") for x in b.columns]
out["breast_cancer"] = {c: round(float(b[c].median()), 6) for c in feats("breast_cancer")}

json.dump(out, open(M / "defaults.json", "w"), indent=2)
print("Saved models/defaults.json")
for k, v in out.items():
    print(k, v)
