import { defineConfig, transformWithEsbuild, type Plugin } from "vite";

/**
 * The client uses standard (TC39) decorators, which no browser yet parses
 * natively (`@customElement`, `@state() accessor`, …). esbuild compiles them
 * away only when given a concrete `target`, but Vite ignores `esbuild.target`
 * for its dev-time source transform (it applies only to `build`), so in dev the
 * raw decorator syntax reaches the browser and it throws a SyntaxError.
 *
 * This plugin runs the esbuild transform ourselves with `target: "es2022"` on
 * our own `.ts` sources — in both dev and build — so decorators are always
 * lowered. It runs `pre`, ahead of Vite's built-in esbuild pass (which then
 * has nothing left to do with the decorators).
 */
function lowerStandardDecorators(): Plugin {
  return {
    name: "gts:lower-standard-decorators",
    enforce: "pre",
    async transform(code, id) {
      const [file] = id.split("?", 1);
      if (!file.endsWith(".ts") || file.includes("/node_modules/")) {
        return null;
      }
      // Cheap skip for files without decorators.
      if (!code.includes("@") && !code.includes("accessor")) {
        return null;
      }
      const result = await transformWithEsbuild(code, id, {
        target: "es2022",
        loader: "ts",
      });
      return { code: result.code, map: result.map };
    },
  };
}

// The client dev server proxies API + WebSocket traffic to the Fastify server
// so the browser can use same-origin "/ws" and "/api" URLs in development. In
// production the built client is served by the server itself (see @gts/server).
export default defineConfig({
  plugins: [lowerStandardDecorators()],
  server: {
    port: 3100,
    proxy: {
      "/ws": { target: "ws://localhost:3000", ws: true },
      "/api": { target: "http://localhost:3000" },
    },
  },
  build: {
    target: "es2022",
    outDir: "dist",
    emptyOutDir: true,
  },
});
