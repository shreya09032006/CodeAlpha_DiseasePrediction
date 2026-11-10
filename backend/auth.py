"""Sign up, log in and 'who am I' endpoints (email + password, token based)."""
import hashlib
import hmac
import os
import re
import secrets
import sqlite3
import time
from contextlib import closing
from pathlib import Path
from typing import Optional

import jwt
from fastapi import APIRouter, Header, HTTPException
from pydantic import BaseModel

router = APIRouter(prefix="/auth", tags=["auth"])

DB_PATH = Path(os.getenv("USERS_DB", str(Path(__file__).parent / "users.db")))
TOKEN_DAYS = 7
ITERATIONS = 240_000
EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")

_secret = os.getenv("JWT_SECRET")
if not _secret:
    _secret = secrets.token_hex(32)
    print("WARNING: JWT_SECRET is not set, so logins stop working whenever the server restarts.")

_fails = {}  # email -> [failed attempts, locked until]


def _db():
    con = sqlite3.connect(DB_PATH)
    con.row_factory = sqlite3.Row
    con.execute(
        "CREATE TABLE IF NOT EXISTS users ("
        "id INTEGER PRIMARY KEY AUTOINCREMENT, email TEXT UNIQUE NOT NULL, "
        "name TEXT NOT NULL, pw_hash TEXT NOT NULL, created_at INTEGER NOT NULL)"
    )
    return con


def _hash(password: str) -> str:
    salt = secrets.token_bytes(16)
    dk = hashlib.pbkdf2_hmac("sha256", password.encode(), salt, ITERATIONS)
    return f"pbkdf2_sha256${ITERATIONS}${salt.hex()}${dk.hex()}"


def _verify(password: str, stored: str) -> bool:
    try:
        _, iters, salt, dk = stored.split("$")
        test = hashlib.pbkdf2_hmac("sha256", password.encode(), bytes.fromhex(salt), int(iters))
        return hmac.compare_digest(test.hex(), dk)
    except Exception:
        return False


_DUMMY = _hash("not-a-real-password")


def _token(user_id: int) -> str:
    t = jwt.encode({"sub": str(user_id), "exp": int(time.time()) + TOKEN_DAYS * 86400}, _secret, algorithm="HS256")
    return t.decode() if isinstance(t, bytes) else t


def _public(row) -> dict:
    return {"id": row["id"], "name": row["name"], "email": row["email"]}


class RegisterIn(BaseModel):
    name: str
    email: str
    password: str


class LoginIn(BaseModel):
    email: str
    password: str


@router.post("/register")
def register(body: RegisterIn):
    name = body.name.strip()
    email = body.email.strip().lower()
    if not 1 <= len(name) <= 60:
        raise HTTPException(status_code=400, detail="Please enter your name (up to 60 characters).")
    if len(email) > 254 or not EMAIL_RE.match(email):
        raise HTTPException(status_code=400, detail="Please enter a valid email address.")
    if not 8 <= len(body.password) <= 128:
        raise HTTPException(status_code=400, detail="Your password must be 8 to 128 characters long.")
    with closing(_db()) as con:
        try:
            cur = con.execute(
                "INSERT INTO users (email, name, pw_hash, created_at) VALUES (?, ?, ?, ?)",
                (email, name, _hash(body.password), int(time.time())),
            )
            con.commit()
        except sqlite3.IntegrityError:
            raise HTTPException(status_code=409, detail="An account with this email already exists. Try logging in.")
        row = con.execute("SELECT * FROM users WHERE id = ?", (cur.lastrowid,)).fetchone()
    return {"token": _token(row["id"]), "user": _public(row)}


@router.post("/login")
def login(body: LoginIn):
    email = body.email.strip().lower()
    state = _fails.get(email, [0, 0.0])
    if state[1] > time.time():
        raise HTTPException(status_code=429, detail="Too many attempts. Please wait a minute and try again.")
    with closing(_db()) as con:
        row = con.execute("SELECT * FROM users WHERE email = ?", (email,)).fetchone()
    ok = _verify(body.password, row["pw_hash"] if row else _DUMMY) and row is not None
    if not ok:
        state[0] += 1
        if state[0] >= 5:
            state = [0, time.time() + 60]
        _fails[email] = state
        raise HTTPException(status_code=401, detail="Wrong email or password.")
    _fails.pop(email, None)
    return {"token": _token(row["id"]), "user": _public(row)}


def current_user(authorization: Optional[str] = Header(None)) -> dict:
    """Use as a dependency (Depends(current_user)) on routes that need a signed-in user."""
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(status_code=401, detail="Please log in.")
    try:
        data = jwt.decode(authorization[7:].strip(), _secret, algorithms=["HS256"])
        uid = int(data["sub"])
    except Exception:
        raise HTTPException(status_code=401, detail="Your session has expired. Please log in again.")
    with closing(_db()) as con:
        row = con.execute("SELECT * FROM users WHERE id = ?", (uid,)).fetchone()
    if row is None:
        raise HTTPException(status_code=401, detail="Please log in again.")
    return _public(row)


@router.get("/me")
def me(authorization: Optional[str] = Header(None)):
    return {"user": current_user(authorization)}
