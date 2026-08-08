/**
 * @file Assemble the top-level `.release/` folder — the single deployable unit
 * that Heroku (and `npm start` locally) executes. Layout:
 * ```
 * .release/
 * ├─ server/          ← compiled server (server/dist)
 * ├─ client/          ← Vite bundle (client/dist)
 * ├─ shared/
 * │  ├─ list/         ← compiled protocol (shared/dist)
 * │  └─ package.json  ← copied so `@gts/shared` resolves via `file:` link
 * ├─ package.json     ← runtime manifest (production deps only)
 * └─ node_modules/    ← populated by `npm install --omit=dev` below
 * ```
 * Run this after `npm run build -w @gts/{shared,client,server}` has produced
 * each workspace's deployable artifacts.
 */

import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const releaseDirectory = resolve(root, ".release");

/**
 * Reads and parses a JSON file.
 * @param {string} path - Absolute path to the JSON file.
 * @returns {Promise<any>} The parsed JSON contents.
 */
async function readJson(path) {
  return JSON.parse(await readFile(path, "utf8"));
}

/**
 * Copies a workspace's build output into the release directory, failing
 * fast if the source hasn't been built yet.
 * @param {string} from - Path to the built `dist/` directory to copy.
 * @param {string} to - Destination path inside `.release`.
 * @returns {Promise<void>}
 */
async function copyDist(from, to) {
  if (!existsSync(from)) {
    throw new Error(`missing build output: ${from} — run \`npm run build\` first`);
  }
  await cp(from, to, { recursive: true });
}

/**
 * Assembles the `.release` deploy folder: copies each workspace's compiled
 * output, writes a trimmed runtime `package.json`, and installs production
 * dependencies.
 * @returns {Promise<void>}
 */
async function main() {
  await rm(releaseDirectory, { recursive: true, force: true });
  await mkdir(releaseDirectory, { recursive: true });

  await copyDist(resolve(root, "server/dist"), resolve(releaseDirectory, "server"));
  await copyDist(resolve(root, "client/dist"), resolve(releaseDirectory, "client"));

  await mkdir(resolve(releaseDirectory, "shared"), { recursive: true });
  await copyDist(resolve(root, "shared/lib"), resolve(releaseDirectory, "shared/lib"));
  await cp(
    resolve(root, "shared/package.json"),
    resolve(releaseDirectory, "shared/package.json"),
  );

  const rootPkg = await readJson(resolve(root, "package.json"));
  const serverPkg = await readJson(resolve(root, "server/package.json"));

  const dependencies = { ...serverPkg.dependencies };
  // Replace the workspace protocol with a local file dep so a plain
  // `npm install` inside `.release/` resolves it.
  dependencies["@gts/shared"] = "file:./shared";

  const deployPkg = {
    name: "guess-the-scribble",
    private: true,
    version: rootPkg.version ?? "0.0.0",
    type: "module",
    main: "server/index.js",
    scripts: { start: "node server/index.js" },
    dependencies,
    engines: rootPkg.engines ?? { node: ">=22" },
  };
  await writeFile(
    resolve(releaseDirectory, "package.json"),
    `${JSON.stringify(deployPkg, null, 2)}\n`,
  );

  const result = spawnSync(
    "npm",
    ["install", "--omit=dev", "--no-audit", "--no-fund"],
    { cwd: releaseDirectory, stdio: "inherit", shell: process.platform === "win32" },
  );
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }

  console.log(`\n[gts] .release/ ready — boot with: node .release/server/index.js`);
}

await main();
