/**
 * Marker module documenting CLI command entry points.
 * NestJS HTTP server uses AppModule; CLI commands bootstrap their own
 * service context via initServices() + connectMongo().
 *
 * Commands:
 *   - create-admin.command.ts  →  pnpm admin:create [--reset-password]
 */
export const COMMAND_ENTRIES = {
  "admin:create": "src/cli/admin-create.ts",
} as const;
