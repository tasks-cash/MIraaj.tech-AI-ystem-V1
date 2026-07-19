import { describe, expect, it } from "vitest";
import { syncSuperAdminPermissions, SUPER_ADMIN_ROLE_SLUG } from "@maraaj/config";
import { PERMISSIONS } from "@maraaj/types";
import { hashPassword, verifyPassword, validatePasswordPolicy } from "@maraaj/auth";

describe("Super Admin permission sync", () => {
  it("includes every catalog permission and module wildcards", () => {
    const synced = syncSuperAdminPermissions();
    for (const permission of PERMISSIONS) {
      expect(synced).toContain(permission);
    }
    expect(synced).toContain("encryption.*");
    expect(synced).toContain("apiClients.*");
    expect(synced).toContain("sessions.*");
    expect(synced).toContain("*");
    expect(SUPER_ADMIN_ROLE_SLUG).toBe("super-admin");
  });

  it("is additive and picks up future permissions", () => {
    const withLegacy = syncSuperAdminPermissions(["legacy.custom"]);
    expect(withLegacy).toContain("legacy.custom");
    expect(withLegacy.length).toBeGreaterThan(PERMISSIONS.length);
  });
});

describe("Password hashing", () => {
  it("hashes with Argon2id and never stores plaintext", async () => {
    const plain = "Bootstrap-Test-Password-1!";
    const hash = await hashPassword(plain);
    expect(hash.startsWith("$argon2id$")).toBe(true);
    expect(hash).not.toContain(plain);
    expect(await verifyPassword(hash, plain)).toBe(true);
    expect(await verifyPassword(hash, "wrong")).toBe(false);
  });

  it("enforces strong password policy for changes", () => {
    expect(validatePasswordPolicy("Short1!").length).toBeGreaterThan(0);
    expect(validatePasswordPolicy("Fresh-Strong-Password-9$")).toEqual([]);
  });
});
