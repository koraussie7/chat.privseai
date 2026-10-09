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
    if (!req.url || !req.url.startsWith("/api/openai")) return next();

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
        external: ["@mlc-ai/web-llm", "@xenova/transformers"],
      },
    },
  };
});
