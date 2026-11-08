import json
import os
from pathlib import Path

import numpy as np
from dotenv import load_dotenv
from google import genai
from google.genai import types

BASE = Path(__file__).parent
load_dotenv(BASE / ".env")

KB_DIR = BASE / "knowledge"
INDEX_DIR = BASE / "knowledge_index"
EMBED_MODEL = "gemini-embedding-001"
CHAT_MODEL = os.getenv("GEMINI_MODEL", "gemini-3.5-flash")

SYSTEM = (
    "You are VitalSense's health education assistant. Answer ONLY using the guideline "
    "notes provided. If the notes do not cover the question, say you do not have guidance "
    "on it and suggest asking a doctor or dietitian. Be practical and concise. Never "
    "diagnose, never advise changing medicines, and remind the user to consult a doctor "
    "for personal medical decisions. For emergencies such as chest pain, fainting or severe "
    "breathlessness, tell them to seek emergency care immediately."
)

_client = None
_vectors = None
_chunks = None


def client():
    global _client
    if _client is None:
        _client = genai.Client(api_key=os.environ["GEMINI_API_KEY"])
    return _client


def _embed_call(batch, tries=3):
    import time
    for attempt in range(tries):
        try:
            return client().models.embed_content(model=EMBED_MODEL, contents=batch)
        except Exception as e:
            busy = getattr(e, "code", None) in (429, 500, 503, 504)
            if not busy or attempt == tries - 1:
                raise
            time.sleep(1.5 * (attempt + 1))


def embed(texts):
    vectors = []
    for i in range(0, len(texts), 50):
        res = _embed_call(texts[i:i + 50])
        vectors += [e.values for e in res.embeddings]
    arr = np.array(vectors, dtype="float32")
    arr /= np.linalg.norm(arr, axis=1, keepdims=True)
    return arr


def build_index():
    chunks = []
    for path in sorted(KB_DIR.glob("*.md")) + sorted(KB_DIR.glob("*.txt")):
        lines = [l.strip() for l in path.read_text(encoding="utf-8").splitlines()]
        title = next((l.lstrip("# ").strip() for l in lines if l.startswith("#")), path.stem)
        source = next((l for l in lines if l.lower().startswith("source")), "")
        for l in lines:
            if not l or l.startswith("#") or l.lower().startswith("source"):
                continue
            chunks.append({"text": f"{title}: {l.lstrip('- ').strip()}",
                           "file": path.name, "source": source})
    vectors = embed([c["text"] for c in chunks])
    INDEX_DIR.mkdir(exist_ok=True)
    np.save(INDEX_DIR / "vectors.npy", vectors)
    (INDEX_DIR / "chunks.json").write_text(json.dumps(chunks, ensure_ascii=False), encoding="utf-8")
    return len(chunks)


def _load():
    global _vectors, _chunks
    if _vectors is None:
        _vectors = np.load(INDEX_DIR / "vectors.npy")
        _chunks = json.loads((INDEX_DIR / "chunks.json").read_text(encoding="utf-8"))


def retrieve(query, k=6):
    _load()
    q = embed([query])[0]
    top = np.argsort(-np.einsum("ij,j->i", _vectors, q))[:k]
    return [_chunks[i] for i in top]


def _gemini_models():
    """Primary model first, then GEMINI_FALLBACK_MODELS (comma separated)."""
    extra = os.getenv("GEMINI_FALLBACK_MODELS", "gemini-3.5-flash-lite,gemini-3.6-flash")
    out = []
    for m in [CHAT_MODEL] + [x.strip() for x in extra.split(",")]:
        if m and m not in out:
            out.append(m)
    return out


def _groq_text(prompt):
    import re

    import httpx
    key, model = os.getenv("GROQ_API_KEY"), os.getenv("GROQ_MODEL")
    if not key or not model:
        raise RuntimeError("Groq fallback is not configured")
    r = httpx.post("https://api.groq.com/openai/v1/chat/completions",
                   headers={"Authorization": f"Bearer {key}"},
                   json={"model": model, "temperature": 0.2,
                         "messages": [{"role": "system", "content": SYSTEM},
                                      {"role": "user", "content": prompt}]},
                   timeout=60)
    r.raise_for_status()
    text = r.json()["choices"][0]["message"]["content"] or ""
    return re.sub(r"<think>.*?</think>", "", text, flags=re.S).strip()


def _ask(prompt, notes):
    import time
    text, first_error = None, None
    for i, model in enumerate(_gemini_models()):
        tries = 2 if i == 0 else 1
        for attempt in range(tries):
            try:
                res = client().models.generate_content(
                    model=model,
                    contents=prompt,
                    config=types.GenerateContentConfig(system_instruction=SYSTEM),
                )
                text = res.text
                print("Answered by Gemini model:", model)
                break
            except Exception as e:
                first_error = first_error or e
                print(f"Gemini model {model} failed:", type(e).__name__)
                if getattr(e, "code", None) not in (429, 500, 503, 504) or attempt == tries - 1:
                    break
                time.sleep(1.5)
        if text is not None:
            break
    if text is None:
        try:
            print("All Gemini models failed, trying Groq")
            text = _groq_text(prompt)
        except Exception as g:
            print("Groq fallback failed:", type(g).__name__, str(g)[:300])
            raise RuntimeError(f"Groq fallback failed ({type(g).__name__}: {str(g)[:150]}). Gemini error: {first_error}")
    sources = sorted({c["source"] for c in notes if c["source"]})
    return text, sources


def answer(message):
    notes = retrieve(message)
    context = "\n".join(f"- {c['text']}" for c in notes)
    return _ask(f"Guideline notes:\n{context}\n\nQuestion: {message}", notes)


def diet_plan(profile):
    notes = retrieve(f"{profile['condition']} diet and exercise", k=10)
    context = "\n".join(f"- {c['text']}" for c in notes)
    prompt = (
        f"Guideline notes:\n{context}\n\nPerson: condition {profile['condition']}, "
        f"age {profile['age']}, weight {profile['weight_kg']} kg, diet type {profile['diet']}, "
        f"allergies: {profile['allergies']}.\n\n"
        "Write a 7-day sample plan, Monday to Sunday, that follows the notes and respects the "
        "diet type and allergies. Use EXACTLY this format and nothing before the first day:\n\n"
        "## Monday\n"
        "- **Breakfast:** one short line\n"
        "- **Lunch:** one short line\n"
        "- **Snack:** one short line\n"
        "- **Dinner:** one short line\n"
        "- **Exercise:** one short line\n\n"
        "Repeat that block for Tuesday, Wednesday, Thursday, Friday, Saturday and Sunday "
        "(include a rest or light-activity day for exercise). Vary the meals across days. "
        "Do not give calorie targets, medicine advice or anything the notes do not support. "
        "After Sunday add a final section '## Reminder' with one or two sentences telling the "
        "person to check with a doctor or dietitian."
    )
    return _ask(prompt, notes)