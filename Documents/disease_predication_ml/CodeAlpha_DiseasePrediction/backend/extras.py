"""Extra endpoints: report reading with Gemini vision."""
import json, os
from pathlib import Path

from dotenv import load_dotenv
from fastapi import APIRouter, File, HTTPException, UploadFile

load_dotenv(Path(__file__).parent / ".env")
router = APIRouter()

MAX_BYTES = 10 * 1024 * 1024
ALLOWED = {"image/jpeg", "image/png", "image/webp", "application/pdf"}

PROMPT = """You are reading a medical lab or ECG report (image or PDF).
Extract ONLY values that are clearly printed in the document. Never guess, calculate or infer.
Return one JSON object using only these keys, and leave out any key not present in the document:
"Patient age", "Sex", "Fasting glucose", "Random glucose", "HbA1c", "Insulin",
"Total cholesterol", "HDL cholesterol", "LDL cholesterol", "Triglycerides",
"Systolic BP", "Diastolic BP", "Heart rate", "BMI", "ECG findings".
Each value is a short string that includes its unit as printed (e.g. "126 mg/dL").
"ECG findings" is the report's own printed conclusion in a few words, copied not interpreted.
If the document is not a medical report, return {}."""


_CLIENT = None


def _client():
    global _CLIENT
    from google import genai
    key = os.getenv("GEMINI_API_KEY")
    if not key:
        raise HTTPException(500, "GEMINI_API_KEY is not set on the server.")
    if _CLIENT is None:
        _CLIENT = genai.Client(api_key=key)
    return _CLIENT


@router.post("/extract-report")
async def extract_report(file: UploadFile = File(...)):
    mime = file.content_type or ""
    if mime not in ALLOWED:
        raise HTTPException(400, "Please upload a JPG, PNG, WEBP or PDF file.")
    data = await file.read()
    if len(data) > MAX_BYTES:
        raise HTTPException(413, "File is larger than 10 MB.")
    from google.genai import types
    try:
        resp = _client().models.generate_content(
            model=os.getenv("GEMINI_MODEL", "gemini-3.5-flash"),
            contents=[types.Part.from_bytes(data=data, mime_type=mime), PROMPT],
            config=types.GenerateContentConfig(response_mime_type="application/json", temperature=0),
        )
        values = json.loads(resp.text)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(502, f"Could not read the report: {type(e).__name__}: {str(e)[:200]}")
    if not isinstance(values, dict):
        values = {}
    values = {str(k): str(v) for k, v in values.items() if v not in (None, "", "null")}
    return {"values": values}
