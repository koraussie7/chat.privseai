#!/usr/bin/env python3
"""PrivseAI auth server (stdlib only — no pip dependencies).

    browser (www.privseai.com) --credentials:include--> api.privseai.com/auth/*

Caddy routes /auth/* here; everything else on api.* still goes to LiteLLM (:4003).
Implements exactly the endpoints the frontend calls:
    src/lib/auth.ts         -> GET /auth/me, POST /auth/logout, GET /auth/{google,github}
    src/pages/LoginPage.tsx -> POST /auth/login, POST /auth/register

    POST /auth/register  {email, password, name?} -> Set-Cookie session, MeResponse
    POST /auth/login     {email, password}        -> Set-Cookie session, MeResponse
    GET  /auth/me                                -> {user, quota} (401 if no session)
    POST /auth/logout                            -> clears session cookie
    GET  /auth/<provider> + /auth/<provider>/callback -> OAuth
    GET  /healthz                                -> {"ok": true}

* Sessions: HMAC-signed token in an HttpOnly cookie. Passwords: PBKDF2-SHA256
  + per-user salt (never plaintext).
* OAuth turns on only when GOOGLE_*/GITHUB_* client id/secret env vars are set;
  otherwise those routes return 501. Email/password works with zero config.
* Cookie flags adapt to caller: https -> `Secure; SameSite=None; Domain=.privseai.com`
  (for the www -> api cross-site credentialed request); http/localhost -> plain cookie.

Run: AUTH_SESSION_SECRET="$(openssl rand -hex 32)" python3 server/auth.py
Env: LISTEN_PORT (4006), AUTH_DATA_DIR, AUTH_SESSION_SECRET, AUTH_SESSION_TTL (7d),
     FREE_DAILY_QUOTA (20), AUTH_PUBLIC_URL, APP_URL, GOOGLE_*/GITHUB_*.
"""
from __future__ import annotations

import base64
import hashlib
import hmac
import json
import os
import re
import secrets
import threading
import time
import urllib.error
import urllib.parse
import urllib.request
from datetime import UTC, datetime
from http.cookies import SimpleCookie
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer


def _env(name: str, default: str) -> str:
    return os.environ.get(name, default).strip()


LISTEN_HOST = _env("LISTEN_HOST", "0.0.0.0")
LISTEN_PORT = int(_env("LISTEN_PORT", "4006"))
DATA_DIR = _env("AUTH_DATA_DIR", "/opt/privseai/auth")
USERS_FILE = os.path.join(DATA_DIR, "users.json")
SESSIONS_FILE = os.path.join(DATA_DIR, "sessions.json")
SECRET_FILE = os.path.join(DATA_DIR, "session_secret")
SESSION_TTL = int(_env("AUTH_SESSION_TTL", "604800"))  # 7 days
FREE_DAILY_QUOTA = int(_env("FREE_DAILY_QUOTA", "20"))
COOKIE_NAME = "privseai_session"
MAX_BODY = 64 * 1024
PBKDF2_ROUNDS = 200_000

AUTH_PUBLIC_URL = _env("AUTH_PUBLIC_URL", "https://api.privseai.com").rstrip("/")
APP_URL = _env("APP_URL", "https://privseai.com")

GOOGLE_CLIENT_ID = _env("GOOGLE_CLIENT_ID", "")
GOOGLE_CLIENT_SECRET = _env("GOOGLE_CLIENT_SECRET", "")
GITHUB_CLIENT_ID = _env("GITHUB_CLIENT_ID", "")
GITHUB_CLIENT_SECRET = _env("GITHUB_CLIENT_SECRET", "")

ALLOWED_ORIGINS = {
    "https://privseai.com",
    "https://www.privseai.com",
    "http://localhost:3001",
    "http://127.0.0.1:3001",
    "http://localhost:5173",
    "http://127.0.0.1:5173",
}

EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


# ── persistent JSON store (users + sessions) ──────────────────────────────
_lock = threading.Lock()


def _load_json(path: str) -> dict:
    try:
        with open(path, encoding="utf-8") as f:
            data = json.load(f)
            return data if isinstance(data, dict) else {}
    except Exception:
        return {}


def _save_json(path: str, data: dict) -> None:
    try:
        os.makedirs(os.path.dirname(path), exist_ok=True)
        tmp = path + ".tmp"
        with open(tmp, "w", encoding="utf-8") as f:
            json.dump(data, f)
        os.replace(tmp, path)
    except Exception:
        pass


def _session_secret() -> bytes:
    env_secret = os.environ.get("AUTH_SESSION_SECRET", "").strip()
    if env_secret:
        return env_secret.encode()
    stored = ""
    try:
        with open(SECRET_FILE, encoding="utf-8") as f:
            stored = f.read().strip()
    except Exception:
        stored = ""
    if not stored:
        stored = secrets.token_hex(32)
        try:
            os.makedirs(DATA_DIR, exist_ok=True)
            with open(SECRET_FILE, "w", encoding="utf-8") as f:
                f.write(stored)
        except Exception:
            pass
    return stored.encode()


_SECRET = _session_secret()
USERS: dict = _load_json(USERS_FILE)
SESSIONS: dict = _load_json(SESSIONS_FILE)


# ── password hashing (PBKDF2-SHA256) ──────────────────────────────────────
def _hash_password(password: str, salt: str) -> str:
    dk = hashlib.pbkdf2_hmac("sha256", password.encode(), bytes.fromhex(salt), PBKDF2_ROUNDS)
    return dk.hex()


def _verify_password(password: str, salt: str, expected: str) -> bool:
    return hmac.compare_digest(_hash_password(password, salt), expected)


# ── session tokens (HMAC-signed, self-verifying) ──────────────────────────
def _sign(payload: str) -> str:
    sig = hmac.new(_SECRET, payload.encode(), hashlib.sha256).digest()
    return base64.urlsafe_b64encode(sig).decode().rstrip("=")


def _mint_session(email: str, uid: str) -> str:
    exp = int(time.time()) + SESSION_TTL
    payload = base64.urlsafe_b64encode(
        json.dumps({"uid": uid, "email": email, "exp": exp}).encode()
    ).decode().rstrip("=")
    token = f"{payload}.{_sign(payload)}"
    with _lock:
        SESSIONS[token] = {"uid": uid, "email": email, "exp": exp}
        _save_json(SESSIONS_FILE, SESSIONS)
    return token


def _session_email(token: str) -> str | None:
    if not token or "." not in token:
        return None
    payload, sig = token.rsplit(".", 1)
    if not hmac.compare_digest(_sign(payload), sig):
        return None
    try:
        raw = base64.urlsafe_b64decode(payload + "=" * (-len(payload) % 4))
        data = json.loads(raw)
    except Exception:
        return None
    if data.get("exp", 0) < int(time.time()):
        return None
    with _lock:
        if token not in SESSIONS:
            return None
    return data.get("email")


def _revoke_session(token: str) -> None:
    with _lock:
        if token in SESSIONS:
            del SESSIONS[token]
            _save_json(SESSIONS_FILE, SESSIONS)


# ── user + quota helpers ──────────────────────────────────────────────────
def _today() -> str:
    return datetime.now(UTC).strftime("%Y-%m-%d")


def _quota_for(user: dict) -> dict:
    usage = user.get("usage", {})
    used = int(usage.get(_today(), 0))
    return {"limit": FREE_DAILY_QUOTA, "used": used, "remaining": max(0, FREE_DAILY_QUOTA - used)}


def _bump_usage(email: str) -> None:
    user = USERS.get(email)
    if not user:
        return
    usage = user.setdefault("usage", {})
    day = _today()
    usage[day] = int(usage.get(day, 0)) + 1
    with _lock:
        _save_json(USERS_FILE, USERS)


def _public_user(user: dict) -> dict:
    return {
        "id": user["id"],
        "email": user["email"],
        "name": user.get("name") or user["email"].split("@")[0],
        "picture": user.get("picture"),
    }



# ── OAuth providers (Google / GitHub) ──────────────────────────────────────
def _oauth_profile(provider: str, code: str) -> dict:
    """Exchange an OAuth code for a normalized {email, name, picture}."""
    if provider == "google":
        tok = urllib.request.urlopen(
            urllib.request.Request(
                "https://oauth2.googleapis.com/token",
                data=urllib.parse.urlencode(
                    {
                        "code": code,
                        "client_id": GOOGLE_CLIENT_ID,
                        "client_secret": GOOGLE_CLIENT_SECRET,
                        "redirect_uri": f"{AUTH_PUBLIC_URL}/auth/google/callback",
                        "grant_type": "authorization_code",
                    }
                ).encode(),
                headers={"Content-Type": "application/x-www-form-urlencoded"},
            ),
            timeout=10,
        )
        access = json.loads(tok.read()).get("access_token", "")
        info = urllib.request.urlopen(
            urllib.request.Request(
                "https://www.googleapis.com/oauth2/v3/userinfo",
                headers={"Authorization": f"Bearer {access}"},
            ),
            timeout=10,
        )
        p = json.loads(info.read())
        return {"email": p.get("email", "").lower(), "name": p.get("name"), "picture": p.get("picture")}

    if provider == "github":
        tok = urllib.request.urlopen(
            urllib.request.Request(
                "https://github.com/login/oauth/access_token",
                data=urllib.parse.urlencode(
                    {
                        "code": code,
                        "client_id": GITHUB_CLIENT_ID,
                        "client_secret": GITHUB_CLIENT_SECRET,
                        "redirect_uri": f"{AUTH_PUBLIC_URL}/auth/github/callback",
                    }
                ).encode(),
                headers={
                    "Content-Type": "application/x-www-form-urlencoded",
                    "Accept": "application/json",
                },
            ),
            timeout=10,
        )
        access = json.loads(tok.read()).get("access_token", "")
        info = urllib.request.urlopen(
            urllib.request.Request(
                "https://api.github.com/user",
                headers={"Authorization": f"Bearer {access}", "Accept": "application/json"},
            ),
            timeout=10,
        )
        p = json.loads(info.read())
        email = (p.get("email") or "").lower()
        if not email:
            emails = urllib.request.urlopen(
                urllib.request.Request(
                    "https://api.github.com/user/emails",
                    headers={"Authorization": f"Bearer {access}", "Accept": "application/json"},
                ),
                timeout=10,
            )
            for e in json.loads(emails.read()):
                if e.get("primary") and e.get("verified"):
                    email = e.get("email", "").lower()
                    break
        return {"email": email, "name": p.get("name") or p.get("login"), "picture": p.get("avatar_url")}

    raise ValueError(f"unknown provider: {provider}")


def _upsert_user(email: str, name: str | None, picture: str | None) -> dict:
    with _lock:
        user = USERS.get(email)
        if not user:
            user = {
                "id": secrets.token_hex(12),
                "email": email,
                "name": name or email.split("@")[0],
                "picture": picture,
                "salt": None,
                "hash": None,
                "created": int(time.time()),
                "usage": {},
            }
            USERS[email] = user
            _save_json(USERS_FILE, USERS)
    return user




# ── HTTP handler ────────────────────────────────────────────────────────────
class Handler(BaseHTTPRequestHandler):
    server_version = "privseai-auth/1.0"
    protocol_version = "HTTP/1.1"

    def log_message(self, fmt, *args):  # keep stdout clean
        pass

    # -- helpers --
    def _cors(self) -> dict:
        origin = self.headers.get("Origin", "")
        if origin in ALLOWED_ORIGINS:
            return {
                "Access-Control-Allow-Origin": origin,
                "Access-Control-Allow-Credentials": "true",
                "Vary": "Origin",
            }
        return {}

    def _cookie_kwargs(self) -> dict:
        # Cross-site www.privseai.com -> api.privseai.com needs Secure; SameSite=None
        # and a shared Domain=.privseai.com. Local/dev stays a plain host cookie.
        secure = (
            self.headers.get("X-Forwarded-Proto", "http") == "https"
            or AUTH_PUBLIC_URL.startswith("https")
        )
        kw = {"path": "/"}
        if secure:
            kw["secure"] = True
            kw["samesite"] = "None"
            kw["domain"] = ".privseai.com"
        return kw

    def _send_json(self, status: int, payload: dict, extra_headers: dict | None = None):
        body = json.dumps(payload).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        for k, v in {**self._cors(), **(extra_headers or {})}.items():
            self.send_header(k, v)
        self.end_headers()
        self.wfile.write(body)

    def _set_session_cookie(self, token: str) -> dict:
        c = SimpleCookie()
        c[COOKIE_NAME] = token
        m = c[COOKIE_NAME]
        for k, v in self._cookie_kwargs().items():
            m[k] = v if isinstance(v, str) else ("true" if v else "")
        return {"Set-Cookie": m.OutputString()}

    def _clear_cookie(self) -> dict:
        c = SimpleCookie()
        c[COOKIE_NAME] = ""
        m = c[COOKIE_NAME]
        for k, v in self._cookie_kwargs().items():
            m[k] = v if isinstance(v, str) else ("true" if v else "")
        m["max-age"] = 0
        m["expires"] = "Thu, 01 Jan 1970 00:00:00 GMT"
        return {"Set-Cookie": m.OutputString()}

    def _read_body(self) -> dict:
        try:
            length = int(self.headers.get("Content-Length", "0"))
        except ValueError:
            length = 0
        if length <= 0 or length > MAX_BODY:
            return {}
        try:
            data = json.loads(self.rfile.read(length))
            return data if isinstance(data, dict) else {}
        except Exception:
            return {}

    def _session_token(self) -> str | None:
        c = SimpleCookie()
        try:
            c.load(self.headers.get("Cookie", ""))
        except Exception:
            return None
        morsel = c.get(COOKIE_NAME)
        return morsel.value if morsel else None

    def _me(self) -> tuple[int, dict]:
        token = self._session_token()
        email = _session_email(token) if token else None
        user = USERS.get(email) if email else None
        if not user:
            return 401, {"error": "unauthenticated"}
        return 200, {"user": _public_user(user), "quota": _quota_for(user)}
