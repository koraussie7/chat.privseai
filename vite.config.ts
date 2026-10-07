import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import svgr from "vite-plugin-svgr";
import { resolve } from "node:path";

export default defineConfig({
  plugins: [react(), svgr()],
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
