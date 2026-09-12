import { defineConfig } from "vite";

export default defineConfig({
  base: "/math-busters/",
  build: {
    chunkSizeWarningLimit: 600,
  },
  server: {
    host: "0.0.0.0",
    port: 43127,
    strictPort: true,
  },
  preview: {
    host: "0.0.0.0",
    port: 43127,
    strictPort: true,
  },
});
