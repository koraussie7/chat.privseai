import { defineConfig } from "vitest/config";
import { resolve } from "node:path";

export default defineConfig({
  resolve: {
    alias: {
      "@": resolve(import.meta.dirname, "src"),
      "@/types": resolve(import.meta.dirname, "src/types"),
      "@/lib": resolve(import.meta.dirname, "src/lib"),
      "@/hooks": resolve(import.meta.dirname, "src/hooks"),
      "@/components": resolve(import.meta.dirname, "src/components"),
      "@/pages": resolve(import.meta.dirname, "src/pages"),
      trystero: resolve(import.meta.dirname, "src/mocks/trystero-mock.ts"),
    },
  },
  test: {
    globals: true,
    environment: "node",
    include: ["src/**/*.test.{ts,tsx}"],
  },
});
