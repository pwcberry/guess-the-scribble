import { defineConfig } from "vitest/config";

export default defineConfig({
  // Server code uses nodenext-style ".js" specifiers that point at ".ts"
  // sources; teach Vite's resolver to fall back to the TypeScript file so the
  // same modules load under both Node and vitest.
  resolve: {
    extensionAlias: {
      ".js": [".ts", ".js"],
    },
  },
  test: {
    include: ["{shared,server,client}/test/**/*.test.ts"],
    environment: "node",
  },
});
