
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api, pendingSecurityRoute, setCsrfToken, type AuthUser } from "@/lib/api";

export default function ChangePasswordPage() {
  const router = useRouter();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (newPassword !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }
    setLoading(true);
    try {
      const data = await api<{ user: AuthUser; csrfToken?: string }>("/api/v1/auth/change-password", {
        method: "POST",
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      if (data.csrfToken) setCsrfToken(data.csrfToken);
      router.push(pendingSecurityRoute(data.user) ?? "/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to change password");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main style={pageStyle}>
      <form onSubmit={onSubmit} style={cardStyle}>
        <div style={{ color: "#d4a017", letterSpacing: "0.16em", fontSize: 12 }}>SECURITY</div>
        <h1 style={{ margin: "0.4rem 0 0", fontFamily: "var(--font-serif), Georgia, serif" }}>
          Change your password
        </h1>
        <p style={{ color: "#9aabc4", marginTop: 0 }}>
          For security, you must set a new strong password before accessing the dashboard. The
          bootstrap password cannot be reused.
        </p>
        <label style={labelStyle}>
          Current password
          <input
            type="password"
            autoComplete="current-password"
            required
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            style={inputStyle}
          />
        </label>
        <label style={labelStyle}>
          New password
          <input
            type="password"
            autoComplete="new-password"
            required
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            style={inputStyle}
          />
        </label>
        <label style={labelStyle}>
          Confirm new password
          <input
            type="password"
            autoComplete="new-password"
            required
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            style={inputStyle}
          />
        </label>
        <p style={{ color: "#9aabc4", fontSize: 13, margin: 0 }}>
          At least 12 characters with uppercase, lowercase, a digit, and a symbol.
        </p>
        {error ? <p style={{ color: "#e35d6a", margin: 0 }}>{error}</p> : null}
        <button type="submit" disabled={loading} style={buttonStyle}>
          {loading ? "Updating…" : "Update password"}
        </button>
      </form>
    </main>
  );
}

const pageStyle: React.CSSProperties = {
  minHeight: "100vh",
  display: "grid",
  placeItems: "center",
  background: "radial-gradient(800px 400px at 20% 0%, #243353, transparent), #0f141c",
  padding: 24,
};
const cardStyle: React.CSSProperties = {
  width: "min(480px, 100%)",
  background: "#171e2a",
  border: "1px solid #2a3548",
  padding: "2rem",
  display: "grid",
  gap: 12,
};
const labelStyle: React.CSSProperties = { display: "grid", gap: 6 };
const inputStyle: React.CSSProperties = {
  background: "#0f141c",
  border: "1px solid #2a3548",
  color: "#fff",
  padding: "0.7rem 0.8rem",
};
const buttonStyle: React.CSSProperties = {
  background: "#d4a017",
  color: "#111",
  border: 0,
  padding: "0.8rem",
  fontWeight: 700,
  cursor: "pointer",
};
