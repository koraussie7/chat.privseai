import { defineConfig } from "vite";
import tailwindcss from "tailwindcss";
import autoprefixer from "autoprefixer";
import svgr from "vite-plugin-svgr";
import { resolve } from "node:path";

export default defineConfig({
  base: "/",
  appType: "spa",
  esbuild: {
    jsx: "automatic",
    jsxImportSource: "react",
  },
  plugins: [svgr()],
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
});
