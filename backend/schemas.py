from typing import Optional

from pydantic import BaseModel


class BreastCancerInput(BaseModel):
    mean_radius: Optional[float] = None
    mean_texture: Optional[float] = None
    mean_perimeter: Optional[float] = None
    mean_area: Optional[float] = None
    mean_smoothness: Optional[float] = None
    mean_compactness: Optional[float] = None
    mean_concavity: Optional[float] = None
    mean_concave_points: Optional[float] = None
    mean_symmetry: Optional[float] = None
    mean_fractal_dimension: Optional[float] = None


class HeartInput(BaseModel):
    age: Optional[float] = None
    sex: Optional[int] = None
    cp: Optional[int] = None
    trestbps: Optional[float] = None
    chol: Optional[float] = None
    fbs: Optional[int] = None
    restecg: Optional[int] = None
    thalach: Optional[float] = None
    exang: Optional[int] = None
    oldpeak: Optional[float] = None
    slope: Optional[int] = None
    ca: Optional[int] = None
    thal: Optional[int] = None


class DiabetesInput(BaseModel):
    Pregnancies: Optional[float] = None
    Glucose: Optional[float] = None
    BloodPressure: Optional[float] = None
    SkinThickness: Optional[float] = None
    Insulin: Optional[float] = None
    BMI: Optional[float] = None
    DiabetesPedigreeFunction: Optional[float] = None
    Age: Optional[float] = None
