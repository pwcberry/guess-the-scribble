import { defineConfig, transformWithEsbuild, type Plugin } from "vite";

/**
 * Same plugin as client/vite.config.ts: standard (TC39) decorators
 * (`@customElement`, `@property() accessor`, …) are not parsed by any browser
 * yet, and Vite's dev-time transform leaves them in place, so the preview
 * iframe throws a SyntaxError. Lower them with esbuild (target es2022) in both
 * dev and build, for storybook's own sources and the @gts/client sources they
 * import.
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

export default defineConfig({
  plugins: [lowerStandardDecorators()],
  build: {
    target: "es2022",
  },
});
