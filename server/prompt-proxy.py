#!/usr/bin/env python3
"""Minimal prompt/analyze proxy: browser -> here -> LiteLLM (server-side key)."""
import json
import urllib.request
from http.server import BaseHTTPRequestHandler, HTTPServer

OPENROUTER_KEY = None
with open("/opt/privseai/prompt-proxy/.openrouterkey") as f:
    for line in f:
        if line.strip():
            value = line.strip()
            OPENROUTER_KEY = value.split("=", 1)[1] if "=" in value else value
ALLOWED_ORIGIN = "https://privseai.com"
UPSTREAM = "https://openrouter.ai/api/v1/chat/completions"
TEXT_MODEL = "groq-gpt-oss-20b"  # unused; vision model handles both via OpenRouter
VISION_MODEL = "google/gemini-2.5-flash"
MAX_BYTES = 6 * 1024 * 1024


class H(BaseHTTPRequestHandler):
    def _cors(self):
        self.send_header("Access-Control-Allow-Origin", ALLOWED_ORIGIN)
        self.send_header("Access-Control-Allow-Methods", "POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.send_header("Access-Control-Max-Age", "86400")

    def do_OPTIONS(self):
        self.send_response(204)
        self._cors()
        self.end_headers()

    def do_POST(self):
        if self.path != "/v1/prompt/analyze":
            self.send_response(404)
            self._cors()
            self.end_headers()
            return
        n = int(self.headers.get("Content-Length", 0))
        if n > MAX_BYTES:
            self.send_response(413)
            self._cors()
            self.end_headers()
            return
        try:
            body = json.loads(self.rfile.read(n))
        except Exception:
            self.send_response(400)
            self._cors()
            self.end_headers()
            return
        mode = body.get("mode", "enhance-image")
        prompt = str(body.get("prompt", "")).strip()[:8000]
        image = body.get("image")
        if mode == "enhance-image" and not prompt:
            return self._err(400, "missing prompt")
        if mode == "image":
            if not isinstance(image, dict):
                return self._err(400, "image analysis requires an image payload")
            mime = str(image.get("mime_type", ""))
            b64 = str(image.get("data", ""))
            if mime not in ("image/jpeg", "image/png", "image/webp") or not b64:
                return self._err(400, "image must be base64 JPEG/PNG/WebP")
            if len(b64) > 5_600_000:
                return self._err(413, "image too large after base64 encoding")
            content = [
                {"type": "text", "text": (
                    "Analyze the provided image and write one detailed, reusable "
                    "image-generation prompt that could create a visually similar image. "
                    "Describe only visible content: subject, scene, composition, style, "
                    "lighting, palette, mood, texture, perspective. Do not identify real "
                    "people or infer sensitive personal attributes. Return only the final prompt."
                )},
                {"type": "image_url", "image_url": {"url": f"data:{mime};base64,{b64}"}},
            ]
            model = VISION_MODEL
        else:
            instruction = (
                "Expand the user's idea into one concise, detailed image-generation prompt. "
                "Specify subject, scene, composition, style, lighting, palette, mood, texture, perspective. "
                "Return only the final prompt.\n\nUser idea: " + prompt
            )
            content = instruction
            model = VISION_MODEL
        payload = json.dumps({
            "model": model,
            "messages": [{"role": "user", "content": content}],
            "max_tokens": 600,
        }).encode()
        req = urllib.request.Request(UPSTREAM, data=payload, headers={
            "Content-Type": "application/json",
            "Authorization": "Bearer " + OPENROUTER_KEY,
        })
        try:
            with urllib.request.urlopen(req, timeout=90) as r:
                data = json.load(r)
        except Exception:
            return self._err(502, "upstream error")
        text = (data.get("choices") or [{}])[0].get("message", {}).get("content", "")
        out = json.dumps({"prompt": text.strip()}).encode()
        self.send_response(200)
        self._cors()
        self.send_header("Content-Type", "application/json")
        self.end_headers()
        self.wfile.write(out)

    def _err(self, code, msg):
        out = json.dumps({"error": msg}).encode()
        self.send_response(code)
        self._cors()
        self.send_header("Content-Type", "application/json")
        self.end_headers()
        self.wfile.write(out)

    def log_message(self, fmt, *a):
        pass


HTTPServer(("127.0.0.1", 4004), H).serve_forever()
