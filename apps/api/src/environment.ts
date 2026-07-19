import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { loadEnvFile } from "node:process";
import { fileURLToPath } from "node:url";
import { apiEnvironmentSchema, parseEnvironment } from "@miraaj/shared-config";

export type ApiEnvironment = ReturnType<typeof loadEnvironment>;

let cachedEnvironment: ReturnType<
  typeof apiEnvironmentSchema.parse
> | null = null;
let envFilesLoaded = false;

function loadLocalEnvFiles(): void {
  if (envFilesLoaded) {
    return;
  }
  envFilesLoaded = true;

  const moduleDir = dirname(fileURLToPath(import.meta.url));
  const candidates = [
    resolve(moduleDir, "../../../.env"),
    resolve(process.cwd(), ".env"),
    resolve(process.cwd(), "../../.env"),
    resolve(moduleDir, "../.env"),
  ];

  const seen = new Set<string>();
  for (const candidate of candidates) {
    if (seen.has(candidate) || !existsSync(candidate)) {
      continue;
    }
    seen.add(candidate);
    loadEnvFile(candidate);
  }
}

export function loadEnvironment() {
  loadLocalEnvFiles();
  cachedEnvironment ??= parseEnvironment(apiEnvironmentSchema, process.env);
  return cachedEnvironment;
}

export function resetEnvironmentCache(): void {
  cachedEnvironment = null;
}
