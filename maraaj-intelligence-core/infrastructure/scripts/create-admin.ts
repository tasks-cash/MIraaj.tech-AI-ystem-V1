#!/usr/bin/env node
/**
 * Infrastructure entry for Super Admin bootstrap.
 * Delegates to the API package so there is exactly one implementation.
 *
 *   pnpm admin:create
 *   pnpm admin:create --reset-password
 */
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";

const repoRoot = resolve(__dirname, "..", "..");
const args = process.argv.slice(2).filter((arg) => arg === "--reset-password");

const result = spawnSync("pnpm", ["--filter", "@maraaj/api", "admin:create", ...args], {
  cwd: repoRoot,
  stdio: "inherit",
  env: process.env,
});

process.exit(result.status ?? 1);
