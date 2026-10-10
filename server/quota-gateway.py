#!/usr/bin/env python3
"""Per-user quota gateway in front of freellmpool.

    browser --(X-Quota-Key: qp_...)--> quota-gateway :4005 --> freellmpool :8080

freellmpool pools free LLM tiers behind one OpenAI-compatible endpoint, but it
has no notion of end users — its built-in QuotaStore counts (provider, model,
day) globally and its proxy_key is a single shared token. This gateway adds the
missing per-user layer:

  * Per-user API keys (`qp_<random>`), stored in users.json
  * Daily request + token quotas per user (UTC-day buckets, advisory)
  * OpenAI-style 429 with X-Quota-Remaining / X-Quota-Reset headers
  * SSE passthrough; token usage best-effort scanned from stream tail
  * Admin endpoint to mint per-user keys (POST /v1/keys, ADMIN_TOKEN)

Run (stdlib only, no pip installs):

    ADMIN_TOKEN=... python3 server/quota-gateway.py

Env: LISTEN_HOST, LISTEN_PORT (4005), FREELLMPOOL_URL, FREELLMPOOL_KEY,
QUOTA_USERS_FILE, QUOTA_STATE_FILE, QUOTA_DEFAULT_REQUESTS (100),
QUOTA_DEFAULT_TOKENS (200000), ADMIN_TOKEN, ALLOWED_ORIGINS.
"""
from __future__ import annotations

import hashlib
import json
import os
import re
import secrets
import threading
import urllib.error
import urllib.request
from datetime import UTC, datetime, timedelta
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

MAX_BODY = 6 * 1024 * 1024  # mirrors prompt-proxy.py
_UPSTREAM_TIMEOUT = 120.0
_USAGE_SCAN_TAIL = 8192  # bytes of stream tail scanned for a usage chunk


def _env(name: str, default: str) -> str:
    return os.environ.get(name, default).strip()


def _env_int(name: str, default: int) -> int:
    try:
        return int(_env(name, str(default)))
    except ValueError:
        return default


CONFIG = {
    "host": _env("LISTEN_HOST", "0.0.0.0"),
    "port": _env_int("LISTEN_PORT", 4005),
    "upstream": _env("FREELLMPOOL_URL", "http://127.0.0.1:8080").rstrip("/"),
    "upstream_key": _env("FREELLMPOOL_KEY", ""),
    "users_file": _env("QUOTA_USERS_FILE", "/opt/privseai/quota-gateway/users.json"),
    "state_file": _env("QUOTA_STATE_FILE", "/opt/privseai/quota-gateway/quota.json"),
    "default_requests": _env_int("QUOTA_DEFAULT_REQUESTS", 100),
    "default_tokens": _env_int("QUOTA_DEFAULT_TOKENS", 200000),
    "admin_token": _env("ADMIN_TOKEN", ""),
    "origins": [
        o.strip()
        for o in _env("ALLOWED_ORIGINS", "https://privseai.com").split(",")
        if o.strip()
    ],
}

_USAGE_RE = re.compile(rb'"total_tokens"\s*:\s*(\d+)')
_STREAM_FLAG_RE = re.compile(rb'"stream"\s*:\s*true')


def utc_day(now: datetime | None = None) -> str:
    return (now or datetime.now(UTC)).strftime("%Y-%m-%d")


def next_utc_midnight_iso() -> str:
    tomorrow = datetime.now(UTC).replace(hour=0, minute=0, second=0, microsecond=0) + timedelta(days=1)
    return tomorrow.isoformat().replace("+00:00", "Z")


class JsonFileStore:
    """Tiny thread-safe read-modify-write JSON file store."""

    def __init__(self, path: str):
        self.path = path
        self._lock = threading.Lock()

    def _load(self) -> dict:
        try:
            with open(self.path, "r", encoding="utf-8") as fh:
                data = json.load(fh)
            return data if isinstance(data, dict) else {}
        except (FileNotFoundError, json.JSONDecodeError, OSError):
            return {}

    def _save(self, data: dict) -> None:
        os.makedirs(os.path.dirname(self.path) or ".", exist_ok=True)
        tmp = f"{self.path}.tmp"
        with open(tmp, "w", encoding="utf-8") as fh:
            json.dump(data, fh, indent=2, sort_keys=True)
        os.replace(tmp, self.path)

    def update(self, mutate):
        """Load, run `mutate(data)` (may return a value), save, return it."""
        with self._lock:
            data = self._load()
            result = mutate(data)
            self._save(data)
            return result

    def read(self) -> dict:
        return self._load()


class QuotaManager:
    """Per-user daily request/token counters keyed by UTC day."""

    def __init__(self, users_file: str, state_file: str, default_requests: int, default_tokens: int):
        self.users = JsonFileStore(users_file)
        self.state = JsonFileStore(state_file)
        self.default_requests = default_requests
        self.default_tokens = default_tokens

    def resolve_user(self, key: str) -> tuple[str, int, int]:
        """Return (user_id, daily_request_limit, daily_token_limit)."""
        if not key:
            raise PermissionError("missing quota key")
        users = self.users.read().get("users", {})
        if not isinstance(users, dict):
            users = {}
        for user_id, entry in users.items():
            if isinstance(entry, dict) and entry.get("key") == key:
                return (
                    str(user_id),
                    int(entry.get("daily_requests", self.default_requests)),
                    int(entry.get("daily_tokens", self.default_tokens)),
                )
        # Unregistered key: stable anonymous identity derived from the key.
        anon = "anon:" + hashlib.sha256(key.encode("utf-8")).hexdigest()[:24]
        return anon, self.default_requests, self.default_tokens

    def mint_key(self, user_id: str, daily_requests: int | None, daily_tokens: int | None) -> str:
        key = "qp_" + secrets.token_hex(16)

        def mutate(data: dict) -> None:
            bucket = data.setdefault("users", {})
            bucket[user_id] = {
                "key": key,
                "daily_requests": daily_requests if daily_requests is not None else self.default_requests,
                "daily_tokens": daily_tokens if daily_tokens is not None else self.default_tokens,
            }

        self.users.update(mutate)
        return key

    def status(self, user_id: str, limit_requests: int, limit_tokens: int) -> dict:
        day = utc_day()
        entry = self.state.read().get("days", {}).get(day, {}).get(user_id, {})
        used_requests = int(entry.get("requests", 0))
        used_tokens = int(entry.get("tokens", 0))
        return {
            "day": day,
            "used_requests": used_requests,
            "used_tokens": used_tokens,
            "limit_requests": limit_requests,
            "limit_tokens": limit_tokens,
            "remaining_requests": (
                max(0, limit_requests - used_requests) if limit_requests > 0 else -1
            ),
            "remaining_tokens": (
                max(0, limit_tokens - used_tokens) if limit_tokens > 0 else -1
            ),
            "reset": next_utc_midnight_iso(),
        }

    def over_quota(self, status: dict) -> bool:
        if status["limit_requests"] > 0 and status["used_requests"] >= status["limit_requests"]:
            return True
        if status["limit_tokens"] > 0 and status["used_tokens"] >= status["limit_tokens"]:
            return True
        return False

    def record(self, user_id: str, tokens: int) -> None:
        day = utc_day()

        def mutate(data: dict) -> None:
            bucket = data.setdefault("days", {}).setdefault(day, {})
            entry = bucket.setdefault(user_id, {"requests": 0, "tokens": 0})
            entry["requests"] = int(entry.get("requests", 0)) + 1
            entry["tokens"] = int(entry.get("tokens", 0)) + max(0, tokens)

        self.state.update(mutate)


QUOTA = QuotaManager(
    CONFIG["users_file"],
    CONFIG["state_file"],
    CONFIG["default_requests"],
    CONFIG["default_tokens"],
)


class Handler(BaseHTTPRequestHandler):
    protocol_version = "HTTP/1.1"

    # --- plumbing ----------------------------------------------------------
    def log_message(self, fmt, *args):  # quiet like prompt-proxy.py
        pass

    def _cors(self):
        origin = self.headers.get("Origin", "")
        default = CONFIG["origins"][0] if CONFIG["origins"] else "*"
        allow = origin if origin in CONFIG["origins"] else default
        self.send_header("Access-Control-Allow-Origin", allow)
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Quota-Key")
        self.send_header(
            "Access-Control-Expose-Headers",
            "X-Quota-Remaining, X-Quota-Reset, X-Quota-Limit",
        )
        self.send_header("Access-Control-Max-Age", "86400")

    def _json(self, code: int, payload: dict, extra_headers: dict | None = None):
        body = json.dumps(payload).encode("utf-8")
        self.send_response(code)
        self._cors()
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        for k, v in (extra_headers or {}).items():
            self.send_header(k, v)
        self.end_headers()
        self.wfile.write(body)

    def _err(
        self,
        code: int,
        message: str,
        err_type: str = "invalid_request_error",
        headers: dict | None = None,
    ):
        self._json(code, {"error": {"message": message, "type": err_type, "code": code}}, headers)

    def _client_key(self) -> str:
        auth = self.headers.get("Authorization", "")
        if auth.lower().startswith("bearer "):
            return auth[7:].strip()
        return (self.headers.get("X-Quota-Key") or "").strip()

    def _quota_headers(self, status: dict) -> dict:
        limit = status["limit_requests"] if status["limit_requests"] > 0 else "unlimited"
        return {
            "X-Quota-Limit": str(limit),
            "X-Quota-Remaining": str(status["remaining_requests"]),
            "X-Quota-Reset": status["reset"],
        }

    # --- HTTP verbs --------------------------------------------------------
    def do_OPTIONS(self):
        self.send_response(204)
        self._cors()
        self.send_header("Content-Length", "0")
        self.end_headers()

    def do_GET(self):
        if self.path in ("/healthz", "/livez", "/v1/health"):
            self._json(200, {"ok": True, "service": "quota-gateway"})
            return
        if self.path == "/v1/quota":
            self._handle_quota_status()
            return
        self._err(404, f"unknown path: {self.path}", "not_found")

    def do_POST(self):
        if self.path == "/v1/chat/completions":
            self._handle_chat()
            return
        if self.path == "/v1/keys":
            self._handle_mint_key()
            return
        self._err(404, f"unknown path: {self.path}", "not_found")

    # --- handlers ----------------------------------------------------------
    def _authed_user(self) -> tuple[str, int, int] | None:
        try:
            return QUOTA.resolve_user(self._client_key())
        except PermissionError:
            self._err(
                401,
                "missing quota key — send Authorization: Bearer qp_... or X-Quota-Key",
                "authentication_error",
            )
            return None

    def _handle_quota_status(self):
        authed = self._authed_user()
        if authed is None:
            return
        user_id, req_limit, tok_limit = authed
        status = QUOTA.status(user_id, req_limit, tok_limit)
        self._json(200, {"user": user_id, "quota": status}, self._quota_headers(status))

    def _handle_mint_key(self):
        if not CONFIG["admin_token"]:
            self._err(403, "ADMIN_TOKEN not configured on the gateway", "permission_error")
            return
        auth = self.headers.get("Authorization", "")
        if auth[7:].strip() != CONFIG["admin_token"]:
            self._err(401, "invalid admin token", "authentication_error")
            return
        try:
            n = int(self.headers.get("Content-Length", 0))
            if n > MAX_BODY:
                raise ValueError("body too large")
            body = json.loads(self.rfile.read(n) or b"{}")
        except (ValueError, json.JSONDecodeError):
            self._err(400, "malformed JSON body")
            return
        user_id = str(body.get("user_id", "")).strip()
        if not user_id:
            self._err(400, "user_id is required")
            return
        daily_requests = body.get("daily_requests")
        daily_tokens = body.get("daily_tokens")
        key = QUOTA.mint_key(
            user_id,
            int(daily_requests) if daily_requests is not None else None,
            int(daily_tokens) if daily_tokens is not None else None,
        )
        self._json(201, {"user_id": user_id, "key": key})

    def _handle_chat(self):
        authed = self._authed_user()
        if authed is None:
            return
        user_id, req_limit, tok_limit = authed
        status = QUOTA.status(user_id, req_limit, tok_limit)
        if QUOTA.over_quota(status):
            self._err(
                429,
                f"Daily quota exceeded ({status['used_requests']}/{status['limit_requests']} requests). "
                f"Resets at {status['reset']}.",
                "user_quota_exceeded",
                self._quota_headers(status),
            )
            return

        try:
            n = int(self.headers.get("Content-Length", 0))
            if n <= 0 or n > MAX_BODY:
                raise ValueError("bad content length")
            raw = self.rfile.read(n)
        except ValueError:
            self._err(400, "request body required")
            return

        stream = bool(_STREAM_FLAG_RE.search(raw))

        upstream_req = urllib.request.Request(
            CONFIG["upstream"] + "/v1/chat/completions",
            data=raw,
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        if CONFIG["upstream_key"]:
            upstream_req.add_header("Authorization", "Bearer " + CONFIG["upstream_key"])

        try:
            upstream = urllib.request.urlopen(upstream_req, timeout=_UPSTREAM_TIMEOUT)
        except urllib.error.HTTPError as exc:
            detail = exc.read().decode("utf-8", "replace")[:2000]
            self._err(exc.code, f"freellmpool upstream: {detail}", "upstream_error")
            return
        except Exception:
            self._err(502, "freellmpool upstream unreachable", "upstream_error")
            return

        with upstream:
            if stream:
                self._stream_chat(upstream, user_id)
            else:
                self._one_shot_chat(upstream, user_id)

    def _one_shot_chat(self, upstream, user_id: str):
        payload = upstream.read()
        tokens = 0
        try:
            data = json.loads(payload)
            usage = data.get("usage") or {}
            tokens = int(usage.get("total_tokens", 0) or 0)
        except (json.JSONDecodeError, AttributeError, TypeError, ValueError):
            pass
        QUOTA.record(user_id, tokens)
        status = QUOTA.status(user_id, QUOTA.default_requests, QUOTA.default_tokens)
        self.send_response(200)
        self._cors()
        self.send_header("Content-Type", upstream.headers.get("Content-Type", "application/json"))
        self.send_header("Content-Length", str(len(payload)))
        for k, v in self._quota_headers(status).items():
            self.send_header(k, v)
        self.end_headers()
        self.wfile.write(payload)

    def _stream_chat(self, upstream, user_id: str):
        """SSE passthrough; best-effort token scan from the stream tail."""
        self.send_response(200)
        self._cors()
        self.send_header("Content-Type", "text/event-stream; charset=utf-8")
        self.send_header("Cache-Control", "no-cache")
        self.send_header("X-Accel-Buffering", "no")
        self.send_header("Connection", "close")
        self.end_headers()

        tail = b""
        try:
            while True:
                chunk = upstream.read(4096)
                if not chunk:
                    break
                self.wfile.write(chunk)
                self.wfile.flush()
                tail = (tail + chunk)[-_USAGE_SCAN_TAIL:]
        except (BrokenPipeError, ConnectionResetError):
            return  # client went away; still bill the request

        tokens = 0
        match = _USAGE_RE.search(tail)
        if match:
            try:
                tokens = int(match.group(1))
            except ValueError:
                tokens = 0
        QUOTA.record(user_id, tokens)


def main():
    server = ThreadingHTTPServer((CONFIG["host"], CONFIG["port"]), Handler)
    server.daemon_threads = True
    print(
        f"quota-gateway on {CONFIG['host']}:{CONFIG['port']} -> {CONFIG['upstream']} "
        f"(default quota: {CONFIG['default_requests']} req / "
        f"{CONFIG['default_tokens']} tokens per user per UTC day)"
    )
    server.serve_forever()


if __name__ == "__main__":
    main()

