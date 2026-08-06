// Assemble the top-level `deploy/` folder — the single deployable unit that
// Heroku (and `npm start` locally) executes. Layout:
//
//   deploy/
//   ├─ server/          ← compiled server (server/dist)
//   ├─ client/          ← Vite bundle (client/dist)
//   ├─ shared/
//   │  ├─ dist/         ← compiled protocol (shared/dist)
//   │  └─ package.json  ← copied so `@gts/shared` resolves via `file:` link
//   ├─ package.json     ← runtime manifest (production deps only)
//   └─ node_modules/    ← populated by `npm install --omit=dev` below
//
// Run this after `npm run build -w @gts/{shared,client,server}` has produced
// each workspace's `dist/`.

import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const deploy = resolve(root, "deploy");

async function readJson(path) {
  return JSON.parse(await readFile(path, "utf8"));
}

async function copyDist(from, to) {
  if (!existsSync(from)) {
    throw new Error(`missing build output: ${from} — run \`npm run build\` first`);
  }
  await cp(from, to, { recursive: true });
}

async function main() {
  await rm(deploy, { recursive: true, force: true });
  await mkdir(deploy, { recursive: true });

  await copyDist(resolve(root, "server/dist"), resolve(deploy, "server"));
  await copyDist(resolve(root, "client/dist"), resolve(deploy, "client"));

  await mkdir(resolve(deploy, "shared"), { recursive: true });
  await copyDist(resolve(root, "shared/dist"), resolve(deploy, "shared/dist"));
  await cp(
    resolve(root, "shared/package.json"),
    resolve(deploy, "shared/package.json"),
  );

  const rootPkg = await readJson(resolve(root, "package.json"));
  const serverPkg = await readJson(resolve(root, "server/package.json"));

  const dependencies = { ...serverPkg.dependencies };
  // Replace the workspace protocol with a local file dep so a plain
  // `npm install` inside `deploy/` resolves it.
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
    resolve(deploy, "package.json"),
    `${JSON.stringify(deployPkg, null, 2)}\n`,
  );

  const result = spawnSync(
    "npm",
    ["install", "--omit=dev", "--no-audit", "--no-fund"],
    { cwd: deploy, stdio: "inherit", shell: process.platform === "win32" },
  );
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }

  console.log(`\n[gts] deploy/ ready — boot with: node deploy/server/index.js`);
}

await main();
