/**
 * @file Deletes local git branches other than `main` and the branch currently
 * checked out. Uses `git branch -d` (safe delete) so branches with unmerged
 * commits are skipped instead of destroyed.
 */

import process from "node:process";
import { execFileSync } from "node:child_process";

/**
 * Runs a git command and returns its trimmed stdout.
 * @param {string[]} args - Arguments to pass to the `git` CLI.
 * @returns {string} The command's trimmed stdout.
 */
function git(args) {
  return execFileSync("git", args, { encoding: "utf8" }).trim();
}

/**
 * Deletes every local branch except `main`, the currently checked-out
 * branch, and any additionally excluded branch names.
 * @param {string[]} exclude - Branch names to keep in addition to `main` and the current branch.
 * @returns {void}
 */
function main(exclude) {
  const currentBranch = git(["rev-parse", "--abbrev-ref", "HEAD"]);
  const branches = git(["branch", "--format=%(refname:short)"])
    .split("\n")
    .map(branch => branch.trim())
    .filter(branch => branch.length > 0);

  const keep = new Set(["main", currentBranch, ...exclude]);
  const toDelete = branches.filter(branch => !keep.has(branch));

  if (toDelete.length === 0) {
    console.log("[gts] No local branches to remove.");
    return;
  }

  for (const branch of toDelete) {
    try {
      git(["branch", "-d", branch]);
      console.log(`[gts] Deleted branch: ${branch}`);
    }
    catch (err) {
      console.error(`[gts] Failed to delete branch: ${branch}`);
      console.error(err.message);
    }
  }
}

main(process.argv.slice(2));
