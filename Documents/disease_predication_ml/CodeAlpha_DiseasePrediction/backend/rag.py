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


def embed(texts):
    vectors = []
    for i in range(0, len(texts), 50):
        res = client().models.embed_content(model=EMBED_MODEL, contents=texts[i:i + 50])
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
    top = np.argsort(-(_vectors @ q))[:k]
    return [_chunks[i] for i in top]


def _ask(prompt, notes):
    res = client().models.generate_content(
        model=CHAT_MODEL,
        contents=prompt,
        config=types.GenerateContentConfig(system_instruction=SYSTEM),
    )
    sources = sorted({c["source"] for c in notes if c["source"]})
    return res.text, sources


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
        "Write a simple 3-day sample meal plan and a weekly exercise outline that follows the "
        "notes and respects the diet type and allergies. Do not give calorie targets, medicine "
        "advice or anything the notes do not support. End with a short reminder to check with a "
        "doctor or dietitian."
    )
    return _ask(prompt, notes)