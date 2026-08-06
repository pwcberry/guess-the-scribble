// Cross-platform test runner: brings up the PostgreSQL container, runs the
// vitest suite against it, and always tears the container down — no matter how
// the tests exit. Works on Windows / macOS / Linux via Node's `spawn`.
//
// Requires Docker (with the `docker compose` v2 CLI) on PATH. The compose file
// has a Postgres healthcheck; `docker compose up -d --wait` blocks until it
// reports healthy so vitest never sees a connection-refused start-up race.

import { spawn } from "node:child_process";
import process from "node:process";

const isWindows = process.platform === "win32";

function run(command, args, { allowFailure = false } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: "inherit",
      // `shell: true` on Windows lets us find `docker` / `npx` shims (`.cmd`)
      // on PATH without hard-coding an extension.
      shell: isWindows,
    });
    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0 || allowFailure) {
        resolve(code ?? 0);
      }
      else {
        reject(new Error(`${command} ${args.join(" ")} exited with code ${code}`));
      }
    });
  });
}

async function main() {
  let exitCode;
  try {
    // Ensure `@gts/shared` is compiled — vitest resolves it via its emitted
    // `dist/` (see shared/package.json `exports`). Cheap no-op if already built.
    await run("npm", ["run", "build", "-w", "@gts/shared"]);
    // `--wait` blocks until the healthcheck passes.
    await run("docker", ["compose", "up", "-d", "--wait"]);
    exitCode = await run("npx", ["vitest", "run"], { allowFailure: true });
  }
  finally {
    // Always tear the container down, even if `up` or vitest threw.
    try {
      await run("docker", ["compose", "down"], { allowFailure: true });
    }
    catch (err) {
      console.error("[gts] docker compose down failed:", err);
    }
  }
  process.exit(exitCode ?? 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
