import { loadEnv } from "vite";
import { defineConfig } from "vitest/config";

// Read credentials from .env / .env.test (gitignored) at config time so
// Vitest workers have PGUSER and PGPASSWORD without them being committed.
import path from "node:path";
import { fileURLToPath } from "node:url";
import { storybookTest } from "@storybook/addon-vitest/vitest-plugin";
import { playwright } from "@vitest/browser-playwright";
const dirname = typeof __dirname !== "undefined" ? __dirname : path.dirname(fileURLToPath(import.meta.url));

// More info at: https://storybook.js.org/docs/next/writing-tests/integrations/vitest-addon
const env = loadEnv("test", process.cwd(), "");
export default defineConfig({
  test: {
    projects: [{
      extends: true,
      test: {
        include: ["{server,client}/test/**/*.test.ts"],
        environment: "node",
        // DB tests all share one PostgreSQL database; run files sequentially so
        // beforeEach truncations don't race between workers.
        fileParallelism: false,
        env: {
          // Credentials come from .env (via loadEnv above) or the shell env.
          // Never hard-coded here.
          PGUSER: env.PGUSER ?? process.env.PGUSER ?? "",
          PGPASSWORD: env.PGPASSWORD ?? process.env.PGPASSWORD ?? "",
          // Test database URL — credentials-free; PGUSER/PGPASSWORD fill them in.
          // Use DATABASE_URL from the SHELL environment to override (not from
          // .env, so the dev database is never accidentally used for tests).
          DATABASE_URL: process.env.DATABASE_URL ?? "postgresql://localhost:5432/gts_test",
        },
      },
    }, {
      extends: true,
      plugins: [
      // The plugin will run tests for the stories defined in your Storybook config
      // See options at: https://storybook.js.org/docs/next/writing-tests/integrations/vitest-addon#storybooktest
        storybookTest({
          configDir: path.join(dirname, "storybook/.storybook"),
        })],
      test: {
        name: "storybook",
        browser: {
          enabled: true,
          headless: true,
          provider: playwright({}),
          instances: [{
            browser: "chromium",
          }],
        },
      },
    }],
  },
});
