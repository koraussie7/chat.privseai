import { defineConfig, loadEnv } from "vite";
import tailwindcss from "tailwindcss";
import autoprefixer from "autoprefixer";
import svgr from "vite-plugin-svgr";
import { resolve } from "node:path";

export default defineConfig(({ mode }) => {
  // Load both VITE_* and non-VITE (server-side) vars from .env files.
  const env = loadEnv(mode, process.cwd(), "");
  const openaiKey = env.OPENAI_API_KEY?.trim();
  const openaiModel = env.OPENAI_MODEL?.trim() || "gpt-4o-mini";

  // Upstream bases for user BYOK passthrough (server never stores user keys).
  const BYOK_UPSTREAMS: Record<string, string> = {
    openai: "https://api.openai.com",
    anthropic: "https://api.anthropic.com",
    gemini: "https://generativelanguage.googleapis.com",
    openrouter: "https://openrouter.ai",
  };

  /**
   * Dev-only proxy: same-origin `/api/openai/*` -> `https://api.openai.com/*`.
   * - Injects the API key server-side (from `.env` OPENAI_API_KEY) so the key
   *   is never shipped to the browser bundle.
   * - Rewrites the JSON body so only OpenAI-compatible fields are forwarded:
   *   forces `model`, strips custom fields the backend adds (`colibri`,
   *   `byok`), and disables streaming (client consumes a one-shot JSON reply).
   * - Sidesteps CORS because the browser calls its own origin.
   */
  const openaiProxy = (req, res, next) => {
    if (!req.url || (!req.url.startsWith("/api/openai") && !req.url.startsWith("/api/byok") && !req.url.startsWith("/freellm"))) return next();

    // --- freellmpool quota-gateway passthrough: /freellm/* -> localhost:4005 ---
    // Local dev only; production routes through Caddy (see Caddyfile.production).
    if (req.url.startsWith("/freellm")) {
      const target = process.env.QUOTA_GATEWAY_URL || "http://127.0.0.1:4005";
      const upstreamPath = req.url.slice("/freellm".length) || "/";
      const chunks = [];
      req.on("data", (chunk) => chunks.push(chunk));
      req.on("end", async () => {
        try {
          const isBodyless = req.method === "GET" || req.method === "HEAD";
          const headers = {};
          for (const [k, v] of Object.entries(req.headers)) {
            const lk = k.toLowerCase();
            if (["host", "connection", "content-length", "origin"].includes(lk)) continue;
            headers[k] = v;
          }
          const upstreamRes = await fetch(`${target}${upstreamPath}`, {
            method: req.method,
            headers,
            body: isBodyless ? undefined : Buffer.concat(chunks),
          });
          res.statusCode = upstreamRes.status;
          for (const h of ["content-type", "x-quota-limit", "x-quota-remaining", "x-quota-reset"]) {
            const v = upstreamRes.headers.get(h);
            if (v) res.setHeader(h, v);
          }
          res.end(Buffer.from(await upstreamRes.arrayBuffer()));
        } catch (err) {
          res.statusCode = 502;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ error: { message: `quota-gateway unreachable: ${String(err)}` } }));
        }
      });
      return;
    }

    // --- BYOK passthrough: /api/byok/<provider>/* -> provider upstream ---
    // The user's own key arrives in the Authorization header from the browser
    // and is forwarded untouched. The dev server never injects or stores it.
    const byokMatch = req.url.match(/^\/api\/byok\/([a-z]+)(\/.*)?$/);
    if (byokMatch) {
      const provider = byokMatch[1];
      const upstreamBase = BYOK_UPSTREAMS[provider];
      if (!upstreamBase) {
        res.statusCode = 400;
        res.setHeader("Content-Type", "application/json");
        res.end(JSON.stringify({ error: { message: `unknown BYOK provider: ${provider}` } }));
        return;
      }
      const upstreamPath = byokMatch[2] || "/";
      const isBodyless = req.method === "GET" || req.method === "HEAD";
      const chunks = [];
      req.on("data", (chunk) => chunks.push(chunk));
      req.on("end", async () => {
        try {
          const raw = isBodyless ? undefined : Buffer.concat(chunks).toString("utf8");
          const headers = {};
          // Forward auth + content headers only; strip browser framing headers.
          for (const [k, v] of Object.entries(req.headers)) {
            const lk = k.toLowerCase();
            if (["host", "connection", "content-length"].includes(lk)) continue;
            headers[k] = v;
          }
          if (provider === "anthropic" && !headers["anthropic-version"]) {
            headers["anthropic-version"] = "2023-06-01";
          }
          const upstreamRes = await fetch(`${upstreamBase}${upstreamPath}`, {
            method: req.method,
            headers,
            body: isBodyless ? undefined : raw,
          });
          const text = await upstreamRes.text();
          res.statusCode = upstreamRes.status;
          res.setHeader(
            "Content-Type",
            upstreamRes.headers.get("content-type") || "application/json",
          );
          res.end(text);
        } catch (err) {
          res.statusCode = 500;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ error: { message: `byok proxy error: ${String(err)}` } }));
        }
      });
      return;
    }

    const upstream = req.url.replace(/^\/api\/openai/, "");
    const isBodyless = req.method === "GET" || req.method === "HEAD";
    const chunks = [];

    req.on("data", (chunk) => chunks.push(chunk));
    req.on("end", async () => {
      try {
        const contentType = req.headers["content-type"] || "application/json";
        let forwardBody;

        if (!isBodyless) {
          const raw = Buffer.concat(chunks).toString("utf8");
          if (raw && contentType.includes("json")) {
            try {
              const parsed = JSON.parse(raw);
              parsed.model = openaiModel; // force a valid OpenAI model id
              delete parsed.colibri; // custom field OpenAI rejects
              delete parsed.byok; // app-specific field
              if ("stream" in parsed) parsed.stream = false;
              forwardBody = JSON.stringify(parsed);
            } catch {
              forwardBody = raw; // not JSON — forward untouched
            }
          } else {
            forwardBody = raw;
          }
        }

        const upstreamRes = await fetch(`https://api.openai.com${upstream}`, {
          method: req.method,
          headers: {
            "Content-Type": contentType,
            ...(openaiKey ? { Authorization: `Bearer ${openaiKey}` } : {}),
          },
          body: isBodyless ? undefined : forwardBody,
        });

        const text = await upstreamRes.text();
        res.statusCode = upstreamRes.status;
        res.setHeader(
          "Content-Type",
          upstreamRes.headers.get("content-type") || "application/json",
        );
        res.end(text);
      } catch (err) {
        res.statusCode = 500;
        res.setHeader("Content-Type", "application/json");
        res.end(
          JSON.stringify({
            error: { message: `dev proxy error: ${String(err)}` },
          }),
        );
      }
    });
  };

  return {
    base: "/",
    appType: "spa",
    esbuild: {
      jsx: "automatic",
      jsxImportSource: "react",
    },
    plugins: [
      svgr(),
      {
        // Dev-only middleware registered as a proper Vite plugin hook.
        // (configureServer must live on a plugin, NOT under `server`.)
        name: "openai-dev-proxy",
        configureServer(server) {
          server.middlewares.use(openaiProxy);
        },
      },
    ],
    css: {
      postcss: {
        plugins: [tailwindcss(), autoprefixer()],
      },
    },
    resolve: {
      alias: {
        "@": resolve(import.meta.dirname, "src"),
        "@/types": resolve(import.meta.dirname, "src/types"),
        "@/lib": resolve(import.meta.dirname, "src/lib"),
        "@/hooks": resolve(import.meta.dirname, "src/hooks"),
        "@/components": resolve(import.meta.dirname, "src/components"),
        "@/pages": resolve(import.meta.dirname, "src/pages"),
      },
    },
    server: {
      port: 3000,
      cors: true,
    },
    preview: {
      port: 3000,
    },
    test: {
      globals: true,
      environment: "node",
      include: ["src/**/*.test.{ts,tsx}"],
      mockReset: true,
      resolve: {
        alias: {
          "@": resolve(import.meta.dirname, "src"),
          "@/types": resolve(import.meta.dirname, "src/types"),
          "@/lib": resolve(import.meta.dirname, "src/lib"),
          "@/hooks": resolve(import.meta.dirname, "src/hooks"),
          "@/components": resolve(import.meta.dirname, "src/components"),
          "@/pages": resolve(import.meta.dirname, "src/pages"),
        },
      },
    },
    build: {
      rollupOptions: {
        external: ["@xenova/transformers"],
      },
    },
  };
});
