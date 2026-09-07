import { defineConfig } from "vite";

export default defineConfig({
  build: {
    target: "esnext",
  },
  resolve: {
    alias: {
      "@gts/client": "../client/src",
    },
  },
});
