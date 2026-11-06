# CodeAlpha_DiseasePrediction

Disease prediction from medical data using machine learning. Predicts the risk of
**heart disease**, **diabetes** and **breast cancer**. Built for the CodeAlpha
Machine Learning Internship (Task 4).

## Tech stack
- ML: Python, pandas, scikit-learn, XGBoost
- Backend: FastAPI
- Frontend: React + TypeScript (Vite)

## Models
Logistic Regression, SVM, Random Forest and XGBoost are trained for each disease
with GridSearchCV (5-fold stratified CV). The best model per disease is saved.

## Results
(Paste the comparison tables here.)

## Run the backend
    cd backend
    python3 -m venv venv
    source venv/bin/activate
    pip install -r requirements.txt
    python train.py
    uvicorn main:app --reload

## Disclaimer
Educational project only. Not medical advice.