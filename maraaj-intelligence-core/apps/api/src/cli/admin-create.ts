/**
 * CLI entry for Super Admin bootstrap.
 * Implementation lives in ../commands/create-admin.command.ts
 */
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { runAdminBootstrap } from "../commands/create-admin.command";
import { getServices } from "../services/app-services";

/** Load monorepo-root .env into process.env without overriding already-set vars. */
function loadRootEnv() {
  const candidates = [
    resolve(process.cwd(), ".env"),
    resolve(process.cwd(), "../../.env"),
    resolve(__dirname, "../../../../.env"),
  ];
  for (const file of candidates) {
    if (!existsSync(file)) continue;
    for (const line of readFileSync(file, "utf8").split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq <= 0) continue;
      const key = trimmed.slice(0, eq);
      let value = trimmed.slice(eq + 1);
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      if (process.env[key] === undefined) process.env[key] = value;
    }
    break;
  }
}

async function shutdownServices() {
  try {
    const svc = getServices();
    await Promise.all(Object.values(svc.queues).map((q) => q.close().catch(() => undefined)));
    svc.redis.disconnect();
  } catch {
    // Services may not have been initialized on early validation failures.
  }
}

async function main() {
  loadRootEnv();
  const resetPassword = process.argv.includes("--reset-password");
  const report = await runAdminBootstrap({ resetPassword });
  console.log("Admin bootstrap completed.");
  console.log(JSON.stringify(report, null, 2));
  await shutdownServices();
  process.exit(0);
}

main().catch(async (error: unknown) => {
  console.error(
    `Admin bootstrap failed: ${error instanceof Error ? error.message : "unknown error"}`,
  );
  await shutdownServices();
  process.exit(1);
});