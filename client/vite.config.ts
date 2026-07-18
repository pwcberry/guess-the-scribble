import { defineConfig } from "vite";

// The client dev server proxies API + WebSocket traffic to the Fastify server
// so the browser can use same-origin "/ws" and "/api" URLs in development. In
// production the built client is served by the server itself (see @gts/server).
export default defineConfig({
  server: {
    port: 5173,
    proxy: {
      "/ws": { target: "ws://localhost:3000", ws: true },
      "/api": { target: "http://localhost:3000" },
    },
  },
  build: {
    outDir: "dist",
    emptyOutDir: true,
  },
});
