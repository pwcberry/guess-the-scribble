/**
 * @file Cross-platform test runner: brings up the PostgreSQL container, runs
 * the vitest suite against it, and always tears the container down — no
 * matter how the tests exit. Works on Windows / macOS / Linux via Node's
 * `spawn`.
 *
 * Requires Docker (with the `docker compose` v2 CLI) on PATH. The compose
 * file has a Postgres healthcheck; `docker compose up -d --wait` blocks
 * until it reports healthy so vitest never sees a connection-refused
 * start-up race.
 */

import { spawn } from "node:child_process";
import process from "node:process";
import { existsSync } from "node:fs";

const isWindows = process.platform === "win32";

/**
 * Spawns a command and resolves with its exit code, inheriting stdio.
 * @param {string} command - The executable to run.
 * @param {string[]} args - Arguments to pass to the command.
 * @param {object} [options] - Run options.
 * @param {boolean} [options.allowFailure] - Resolve instead of rejecting on a non-zero exit code.
 * @returns {Promise<number>} The process's exit code.
 */
function run(command, args, { allowFailure = false } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: "inherit",
      // `shell: true` on Windows lets us find `docker` / `npx` shims (`.cmd`) on PATH without hard-coding an extension.
      // However, Node will emit the following warning:
      // (node:31900) [DEP0190] DeprecationWarning: Passing args to a child process with shell option true can lead to
      // security vulnerabilities, as the arguments are not escaped, only concatenated.
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

/**
 * Ensures `.env` and the built shared workspace exist, brings up the
 * PostgreSQL container, runs the vitest suite, and tears the container down
 * regardless of outcome before exiting with the suite's exit code.
 * @returns {Promise<void>}
 */
async function main() {
  let exitCode;
  try {
    if (!(process.env.NODE_ENV === "test" || existsSync(".env"))) {
      throw new Error(".env file not found. Please create one based on .env.example");
    }

    if (!existsSync("/shared/lib")) {
      await run("npm", ["run", "build:shared"]);
    }

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
