"""Extra endpoints: report reading with Gemini vision."""
import json, os, time
from pathlib import Path

from dotenv import load_dotenv
from fastapi import APIRouter, File, HTTPException, UploadFile

load_dotenv(Path(__file__).parent / ".env")
router = APIRouter()

MAX_BYTES = 10 * 1024 * 1024
ALLOWED = {"image/jpeg", "image/png", "image/webp", "application/pdf"}

PROMPT = """You are reading a medical lab or ECG report (image or PDF).
Extract ONLY values that are clearly printed in the document. Never guess, calculate or infer.
Return one JSON object. Use these exact keys when the value is present, and leave out any that are not:
"Patient age", "Sex", "Fasting glucose", "Random glucose", "HbA1c", "Insulin",
"Total cholesterol", "HDL cholesterol", "LDL cholesterol", "Triglycerides",
"Systolic BP", "Diastolic BP", "Heart rate", "BMI", "ECG findings".
Each value is a short string that includes its unit as printed (e.g. "126 mg/dL").
"ECG findings" is the report's own printed conclusion in a few words, copied not interpreted.
Also include any other measured result or impression printed in the report (for example tumor markers,
blood counts, imaging impressions such as a BI-RADS category), as extra keys named as printed,
with the value as printed. At most 12 extra keys.
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


# ---- LLM calls: Gemini first (with retry on traffic spikes), Groq as fallback ----
import base64

import httpx


def _with_retry(call, tries=3):
    for attempt in range(tries):
        try:
            return call()
        except Exception as e:
            busy = getattr(e, "code", None) in (429, 500, 503, 504)
            if not busy or attempt == tries - 1:
                raise
            time.sleep(1.5 * (attempt + 1))


def _groq(prompt, data=None, mime=None):
    import re
    key = os.getenv("GROQ_API_KEY")
    if not key or not os.getenv("GROQ_MODEL"):
        raise RuntimeError("Groq fallback is not configured")
    if data is not None and mime == "application/pdf":
        import fitz  # PyMuPDF
        doc = fitz.open(stream=data, filetype="pdf")
        text = "\n".join(doc[i].get_text() for i in range(min(3, len(doc)))).strip()
        if len(text) >= 40:  # normal PDF with real text: send the text
            prompt, data, mime = f"{prompt}\n\nThe report text:\n{text[:8000]}", None, None
        else:  # scanned PDF: send page 1 as an image
            data, mime = doc[0].get_pixmap(dpi=150).tobytes("png"), "image/png"
    model = (os.getenv("GROQ_VISION_MODEL") or os.getenv("GROQ_MODEL")) if data is not None else os.getenv("GROQ_MODEL")
    if data is not None:
        b64 = base64.b64encode(data).decode()
        content = [{"type": "text", "text": prompt},
                   {"type": "image_url", "image_url": {"url": f"data:{mime};base64,{b64}"}}]
    else:
        content = prompt
    r = httpx.post("https://api.groq.com/openai/v1/chat/completions",
                   headers={"Authorization": f"Bearer {key}"},
                   json={"model": model, "temperature": 0.2, "messages": [{"role": "user", "content": content}]},
                   timeout=60)
    r.raise_for_status()
    text = r.json()["choices"][0]["message"]["content"] or ""
    return re.sub(r"<think>.*?</think>", "", text, flags=re.S).strip()


def _gemini_models():
    """Primary model first, then the fallbacks from GEMINI_FALLBACK_MODELS (comma separated)."""
    extra = os.getenv("GEMINI_FALLBACK_MODELS", "gemini-3.5-flash-lite,gemini-3.6-flash")
    out = []
    for m in [os.getenv("GEMINI_MODEL", "gemini-3.5-flash")] + [x.strip() for x in extra.split(",")]:
        if m and m not in out:
            out.append(m)
    return out


def _generate(prompt, data=None, mime=None, json_mode=False):
    from google.genai import types
    contents = [types.Part.from_bytes(data=data, mime_type=mime), prompt] if data is not None else prompt
    cfg = types.GenerateContentConfig(temperature=0 if json_mode else 0.2,
                                      **({"response_mime_type": "application/json"} if json_mode else {}))
    first_error = None
    for i, model in enumerate(_gemini_models()):
        try:
            text = _with_retry(lambda m=model: _client().models.generate_content(
                model=m, contents=contents, config=cfg), tries=2 if i == 0 else 1).text
            print("Answered by Gemini model:", model)
            return text
        except Exception as e:
            first_error = first_error or e
            print(f"Gemini model {model} failed:", type(e).__name__)
    try:
        print("All Gemini models failed, trying Groq")
        return _groq(prompt, data, mime)
    except Exception as g:
        print("Groq fallback failed:", type(g).__name__, str(g)[:300])
        raise RuntimeError(f"Groq fallback failed ({type(g).__name__}: {str(g)[:150]}). Gemini error: {first_error}")


def _parse_json(text):
    text = (text or "").strip()
    a, b = text.find("{"), text.rfind("}")
    return json.loads(text[a:b + 1]) if a != -1 and b != -1 else {}


@router.post("/extract-report")
async def extract_report(file: UploadFile = File(...)):
    mime = file.content_type or ""
    if mime not in ALLOWED:
        raise HTTPException(400, "Please upload a JPG, PNG, WEBP or PDF file.")
    data = await file.read()
    if len(data) > MAX_BYTES:
        raise HTTPException(413, "File is larger than 10 MB.")
    try:
        values = _parse_json(_generate(PROMPT, data=data, mime=mime, json_mode=True))
    except Exception as e:
        raise HTTPException(502, f"Could not read the report: {type(e).__name__}: {str(e)[:450]}")
    if not isinstance(values, dict):
        values = {}
    values = {str(k): str(v) for k, v in values.items() if v not in (None, "", "null")}
    return {"values": values}


# ---- report assessment: the extracted values go to the LLM, which explains them ----
from typing import Dict

from pydantic import BaseModel


class AssessIn(BaseModel):
    values: Dict[str, str]


@router.post("/assess-report")
def assess_report(body: AssessIn):
    listed = "\n".join(f"- {k}: {v}" for k, v in body.values.items())
    if not listed:
        return {"summary": "", "sources": [], "note": "No values were found in the report to assess."}

    notes = []
    try:
        from rag import retrieve
        notes = retrieve(" ".join(body.values.keys()) + " diet and lifestyle", k=6)
    except Exception:
        notes = []
    context = "\n".join(f"- {c['text']}" for c in notes if isinstance(c, dict) and c.get("text"))
    sources = sorted({c["source"] for c in notes if isinstance(c, dict) and c.get("source")})

    prompt = (
        "A patient uploaded a medical report. These are the only values read from it:\n"
        f"{listed}\n\n"
        f"Guideline notes you may use for lifestyle pointers:\n{context or '(none available)'}\n\n"
        "Reply in plain, calm language with this structure:\n"
        "1. First line exactly: **Overall concern: Low**, **Moderate** or **High** (pick one, based only on these values).\n"
        "2. Short bullets: which values look within the usual adult range and which need attention "
        "(use the reference range printed on the report if given).\n"
        "3. One sentence saying only these few values were available, so the picture is partial.\n"
        "4. Two or three practical lifestyle pointers, only if the guideline notes support them.\n"
        "5. One closing sentence: share the report with a doctor; this is not a diagnosis.\n"
        "How to judge: be conservative and fair. Call a value out of range only if it is clearly outside "
        "the usual adult range or outside the reference range printed on the report. If the report does not "
        "say whether a test was fasting, after a meal or after a glucose load (for example insulin or "
        "glucose), do not call it abnormal; say it cannot be judged without that context. Ignore items that "
        "are not standard clinical results (for example pregnancy count, skin thickness or a pedigree "
        "score). Choose Low when nothing is clearly out of range, Moderate only for borderline or clearly "
        "elevated values, and High only for markedly abnormal values.\n"
        "Rules: use only the values above, never invent numbers, never mention medicines or doses, "
        "never say 'you have' a disease, stay under 200 words."
    )
    try:
        return {"summary": _generate(prompt), "sources": sources, "note": ""}
    except Exception:
        return {"summary": "", "sources": [], "note": "The AI services are busy right now. Please try again in a minute."}
