import json
import joblib
import numpy as np
import pandas as pd
from pathlib import Path
from sklearn.datasets import load_breast_cancer
from sklearn.model_selection import train_test_split, GridSearchCV, StratifiedKFold
from sklearn.pipeline import Pipeline
from sklearn.impute import SimpleImputer
from sklearn.preprocessing import StandardScaler
from sklearn.linear_model import LogisticRegression
from sklearn.svm import SVC
from sklearn.ensemble import RandomForestClassifier
from xgboost import XGBClassifier
from sklearn.metrics import (accuracy_score, precision_score, recall_score,
                             f1_score, roc_auc_score)

DATA = Path("data")
MODELS = Path("models")
MODELS.mkdir(exist_ok=True)


def load_breast():
    d = load_breast_cancer(as_frame=True)
    X = d.data[[c for c in d.data.columns if c.startswith("mean ")]].copy()
    X.columns = [c.replace(" ", "_") for c in X.columns]
    y = 1 - d.target  # sklearn: 0 = malignant, so flip: 1 = malignant
    return X, y


def load_heart():
    df = pd.read_csv(DATA / "heart.csv")
    return df.drop(columns="target"), df["target"]


def load_diabetes():
    df = pd.read_csv(DATA / "diabetes.csv")
    # zeros in these columns actually mean "missing"
    cols = ["Glucose", "BloodPressure", "SkinThickness", "Insulin", "BMI"]
    df[cols] = df[cols].replace(0, np.nan)
    return df.drop(columns="Outcome"), df["Outcome"]


def candidates():
    return {
        "LogisticRegression": (LogisticRegression(max_iter=3000),
                               {"model__C": [0.1, 1, 10]}),
        "SVM": (SVC(probability=True),
                {"model__C": [0.1, 1, 10], "model__kernel": ["rbf", "linear"]}),
        "RandomForest": (RandomForestClassifier(random_state=42),
                         {"model__n_estimators": [100, 300],
                          "model__max_depth": [None, 5, 10]}),
        "XGBoost": (XGBClassifier(eval_metric="logloss", random_state=42),
                    {"model__n_estimators": [100, 300],
                     "model__max_depth": [3, 5],
                     "model__learning_rate": [0.05, 0.1]}),
    }


def run(name, X, y):
    print(f"\n===== {name.upper()} =====")
    X_tr, X_te, y_tr, y_te = train_test_split(
        X, y, test_size=0.2, stratify=y, random_state=42)
    cv = StratifiedKFold(5, shuffle=True, random_state=42)

    rows, best = [], None
    for model_name, (est, grid) in candidates().items():
        pipe = Pipeline([
            ("imputer", SimpleImputer(strategy="median")),
            ("scaler", StandardScaler()),
            ("model", est),
        ])
        gs = GridSearchCV(pipe, grid, cv=cv, scoring="roc_auc", n_jobs=-1)
        gs.fit(X_tr, y_tr)

        pred = gs.predict(X_te)
        proba = gs.predict_proba(X_te)[:, 1]
        row = {
            "model": model_name,
            "accuracy": accuracy_score(y_te, pred),
            "precision": precision_score(y_te, pred),
            "recall": recall_score(y_te, pred),
            "f1": f1_score(y_te, pred),
            "roc_auc": roc_auc_score(y_te, proba),
        }
        rows.append(row)
        if best is None or row["roc_auc"] > best[0]:
            best = (row["roc_auc"], model_name, gs.best_estimator_)

    table = pd.DataFrame(rows).round(4)
    print(table.to_string(index=False))
    print(f"Best model: {best[1]}")

    joblib.dump(best[2], MODELS / f"{name}.joblib")
    with open(MODELS / f"{name}_meta.json", "w") as f:
        json.dump({"features": list(X.columns), "model": best[1]}, f)
    table.to_csv(MODELS / f"{name}_results.csv", index=False)


if __name__ == "__main__":
    run("breast_cancer", *load_breast())
    run("heart", *load_heart())
    run("diabetes", *load_diabetes())