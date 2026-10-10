# INTEGRATION: freellmpool + per-user quota gateway

**Status**: integrated (server + client + tests), 2026-10-10
**Source**: [0xzr/freellmpool](https://github.com/0xzr/freellmpool) — MIT, Python

---

## What this is

freellmpool pools **22+ free LLM providers** (178 enabled chat routes) behind
one OpenAI-compatible endpoint with automatic failover and per-day provider
load spreading. It has **no end-user concept**: one shared `proxy_key`, and
its built-in `QuotaStore` counts `(provider, model, day)` globally — not per
user.

privseai needs **per-user daily quotas**, so the integration adds a thin
quota layer in front:

```
browser ──(Bearer qp_<key>)──▶ Caddy /freellm/* ──▶ quota-gateway :4005 ──▶ freellmpool :8080 ──▶ free providers
```

## Components

| File | Role |
|---|---|
| `server/quota-gateway.py` | Stdlib-only Python gateway: per-user keys, daily request/token quotas, OpenAI-style 429, SSE passthrough |
| `docker-compose.inference.yml` | `freellmpool` (ghcr.io/0xzr/freellmpool, localhost:8080) + `quota-gateway` (python:3.12-alpine, localhost:4005) services |
| `Caddyfile.production` | `/freellm/*` → `127.0.0.1:4005` reverse proxy |
| `vite.config.ts` | Dev-only `/freellm/*` → `127.0.0.1:4005` middleware proxy |
| `src/lib/freellmpool-client.ts` | Client module: quota-key management, `quotaChat()`, `fetchQuotaStatus()`, `tryQuotaChat()`, `QuotaExceededError` |
| `src/lib/multi-model-client.ts` | `freellmpool` endpoint (priority 2) in the chat fallback chain; injects the quota key as Bearer |
| `src/lib/config.ts` | `QUOTA_GATEWAY_URL` / `quotaGatewayUrl()` (default same-origin `/freellm`) |
| `src/tests/freellmpool-client.test.ts` | 11 vitest cases (key mgmt, transport, 429, fallback hook) |

## Per-user quota model

* **Identity** = the `qp_…` key. The browser auto-generates one on first use
  (`localStorage["privsei.quota.key"]`). Unregistered keys are billed under a
  stable `anon:<sha256-prefix>` identity with the default quota.
* **Registered users**: `POST /v1/keys` on the gateway with `ADMIN_TOKEN`
  mints a key with per-user limits:

  ```bash
  curl -X POST http://127.0.0.1:4005/v1/keys \
    -H "Authorization: Bearer $ADMIN_TOKEN" \
    -H "Content-Type: application/json" \
    -d '{"user_id": "alice", "daily_requests": 200, "daily_tokens": 500000}'
  ```

  Users can paste this key in settings (future UI) via `setQuotaKey()`.
* **Buckets**: UTC-day `request` count + `total_tokens` sum per user
  (`quota.json`). Default limits: `QUOTA_DEFAULT_REQUESTS=100`,
  `QUOTA_DEFAULT_TOKENS=200000` per user per day. `0` = unlimited.
* **Enforcement**: checked *before* forwarding; token totals recorded after
  (from `usage.total_tokens` in the one-shot response, or best-effort scanned
  from the SSE stream tail). Response headers:
  `X-Quota-Limit`, `X-Quota-Remaining`, `X-Quota-Reset`.
* **429 shape** (OpenAI-style, parsed by `QuotaExceededError`):

  ```json
  {"error": {"message": "Daily quota exceeded (100/100 requests). Resets at …",
             "type": "user_quota_exceeded", "code": 429}}
  ```

## Deployment (110 server)

```bash
# .env next to docker-compose.inference.yml
FREELLMPOOL_PROXY_KEY=<random>        # gateway → freellmpool shared token
QUOTA_ADMIN_TOKEN=<random>            # key minting
# Optional provider keys unlock more capacity; keyless routes work with none.
GROQ_API_KEY=...

docker compose -f docker-compose.inference.yml up -d freellmpool quota-gateway

# Caddy: copy the /freellm block from Caddyfile.production, then
sudo caddy validate --config /etc/caddy/Caddyfile && sudo systemctl reload caddy

# Verify
curl -sS https://privseai.com/freellm/healthz
curl -sS https://privseai.com/freellm/v1/quota -H "Authorization: Bearer qp_test"
```

Local dev: `docker compose -f docker-compose.inference.yml up -d freellmpool
quota-gateway` then `npm run dev` — the Vite middleware proxies `/freellm/*`
to `127.0.0.1:4005` (override with `QUOTA_GATEWAY_URL` env on the Vite
process, or `VITE_QUOTA_GATEWAY_URL` for the browser target).

## Caveats (read before operating)

1. **Quotas are advisory**, like freellmpool's own counters — they stop
   *our* users from over-consuming *our* pooled access; they cannot guarantee
   a provider's real server-side free tier. Failover absorbs provider 429s.
2. **Shared provider keys** — one user exhausting a provider shifts load to
   others via failover. Keep user quotas conservative (100 req/day default).
3. **ToS posture** — free tiers are provider-operated and personal-use
   oriented; multi-tenant redistribution is a gray area (see freellmpool
   FAQ "bans"). Provider keys are optional; keyless routes (Pollinations,
   OVHcloud, Kilo) minimize exposure.
4. **Stream token counting is best-effort** (tail scan) — request counting is
   the primary quota. If a provider omits usage from streams, tokens
   under-count; the request bucket still caps abuse.
5. **Key reset** — clearing localStorage mints a new anonymous identity
   (quota bypass). Acceptable for a free tier; registered `qp_…` keys via
   `/v1/keys` are stable identities for power users.

## Tests

```bash
npx vitest run src/tests/freellmpool-client.test.ts   # 11/11
python3 -m py_compile server/quota-gateway.py          # stdlib only
```

Live smoke test (mock upstream) verified: 401 without key, key minting,
per-user 429 after limit, user isolation (alice blocked / bob unaffected),
SSE passthrough + token scan (42 tokens), quota status endpoint.
