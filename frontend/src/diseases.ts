export interface Field {
  name: string;
  label: string;
  type?: "number" | "select";
  min?: number;
  max?: number;
  step?: number;
  options?: { value: number; label: string }[];
  hint?: string;
}

export interface Disease {
  id: string;
  title: string;
  endpoint: string;
  description: string;
  fields: Field[];
  sample: Record<string, number>;
}

const yesNo = [
  { value: 1, label: "Yes" },
  { value: 0, label: "No" },
];

export const DISEASES: Disease[] = [
  {
    id: "heart",
    title: "Heart Disease",
    endpoint: "/predict/heart",
    description: "Estimates heart disease risk from clinical measurements.",
    fields: [
      { name: "age", label: "Age", min: 1, max: 120, step: 1 },
      {
        name: "sex",
        label: "Sex",
        type: "select",
        options: [
          { value: 1, label: "Male" },
          { value: 0, label: "Female" },
        ],
      },
      { name: "cp", label: "Chest pain type", min: 0, max: 3, step: 1, hint: "0–3, as coded in the dataset" },
      { name: "trestbps", label: "Resting blood pressure (mm Hg)", min: 50, max: 250, step: 1 },
      { name: "chol", label: "Cholesterol (mg/dl)", min: 100, max: 600, step: 1 },
      { name: "fbs", label: "Fasting blood sugar > 120 mg/dl", type: "select", options: yesNo },
      { name: "restecg", label: "Resting ECG result", min: 0, max: 2, step: 1, hint: "0–2" },
      { name: "thalach", label: "Max heart rate achieved", min: 60, max: 220, step: 1 },
      { name: "exang", label: "Exercise-induced angina", type: "select", options: yesNo },
      { name: "oldpeak", label: "ST depression (oldpeak)", min: 0, max: 10, step: 0.1 },
      { name: "slope", label: "Slope of peak exercise ST", min: 0, max: 2, step: 1, hint: "0–2" },
      { name: "ca", label: "Major vessels colored (ca)", min: 0, max: 4, step: 1, hint: "0–4" },
      { name: "thal", label: "Thalassemia (thal)", min: 0, max: 3, step: 1, hint: "0–3" },
    ],
    sample: { age: 63, sex: 1, cp: 3, trestbps: 145, chol: 233, fbs: 1, restecg: 0, thalach: 150, exang: 0, oldpeak: 2.3, slope: 0, ca: 0, thal: 1 },
  },
  {
    id: "diabetes",
    title: "Diabetes",
    endpoint: "/predict/diabetes",
    description: "Estimates diabetes risk from basic health measurements.",
    fields: [
      { name: "Pregnancies", label: "Pregnancies", min: 0, max: 20, step: 1 },
      { name: "Glucose", label: "Glucose (mg/dl)", min: 40, max: 300, step: 1 },
      { name: "BloodPressure", label: "Blood pressure (mm Hg)", min: 30, max: 200, step: 1 },
      { name: "SkinThickness", label: "Skin thickness (mm)", min: 5, max: 100, step: 1 },
      { name: "Insulin", label: "Insulin (mu U/ml)", min: 10, max: 900, step: 1 },
      { name: "BMI", label: "BMI", min: 10, max: 70, step: 0.1 },
      { name: "DiabetesPedigreeFunction", label: "Diabetes pedigree function", min: 0, max: 3, step: 0.001 },
      { name: "Age", label: "Age", min: 1, max: 120, step: 1 },
    ],
    sample: { Pregnancies: 6, Glucose: 148, BloodPressure: 72, SkinThickness: 35, Insulin: 125, BMI: 33.6, DiabetesPedigreeFunction: 0.627, Age: 50 },
  },
  {
    id: "breast",
    title: "Breast Cancer",
    endpoint: "/predict/breast-cancer",
    description: "Classifies a tumour as likely benign or malignant from cell measurements.",
    fields: [
      { name: "mean_radius", label: "Mean radius", step: 0.01 },
      { name: "mean_texture", label: "Mean texture", step: 0.01 },
      { name: "mean_perimeter", label: "Mean perimeter", step: 0.01 },
      { name: "mean_area", label: "Mean area", step: 0.1 },
      { name: "mean_smoothness", label: "Mean smoothness", step: 0.00001 },
      { name: "mean_compactness", label: "Mean compactness", step: 0.00001 },
      { name: "mean_concavity", label: "Mean concavity", step: 0.00001 },
      { name: "mean_concave_points", label: "Mean concave points", step: 0.00001 },
      { name: "mean_symmetry", label: "Mean symmetry", step: 0.00001 },
      { name: "mean_fractal_dimension", label: "Mean fractal dimension", step: 0.00001 },
    ],
    sample: { mean_radius: 17.99, mean_texture: 10.38, mean_perimeter: 122.8, mean_area: 1001, mean_smoothness: 0.1184, mean_compactness: 0.2776, mean_concavity: 0.3001, mean_concave_points: 0.1471, mean_symmetry: 0.2419, mean_fractal_dimension: 0.07871 },
  },
];