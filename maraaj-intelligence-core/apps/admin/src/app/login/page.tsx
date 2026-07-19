
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api, pendingSecurityRoute, setCsrfToken, type AuthUser } from "@/lib/api";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [totp, setTotp] = useState("");
  const [needsTotp, setNeedsTotp] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const data = await api<{ user: AuthUser; csrfToken?: string }>("/api/v1/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password, totp: totp || undefined }),
      });
      if (data.csrfToken) setCsrfToken(data.csrfToken);
      const next = pendingSecurityRoute(data.user) ?? "/dashboard";
      router.push(next);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Login failed";
      if (message.toLowerCase().includes("two-factor")) {
        setNeedsTotp(true);
      }
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        background:
          "radial-gradient(800px 400px at 20% 0%, #243353, transparent), #0f141c",
        padding: 24,
      }}
    >
      <form
        onSubmit={onSubmit}
        style={{
          width: "min(420px, 100%)",
          background: "#171e2a",
          border: "1px solid #2a3548",
          padding: "2rem",
          display: "grid",
          gap: 12,
        }}
      >
        <div>
          <div style={{ color: "#d4a017", letterSpacing: "0.16em", fontSize: 12 }}>MARAAJ.TECH</div>
          <h1 style={{ margin: "0.4rem 0 0", fontFamily: "var(--font-serif), Georgia, serif" }}>
            Console sign in
          </h1>
        </div>
        <label style={{ display: "grid", gap: 6 }}>
          Email
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            type="email"
            required
            autoComplete="email"
            style={inputStyle}
          />
        </label>
        <label style={{ display: "grid", gap: 6 }}>
          Password
          <input
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            type="password"
            required
            autoComplete="current-password"
            style={inputStyle}
          />
        </label>
        {(needsTotp || totp) && (
          <label style={{ display: "grid", gap: 6 }}>
            Authentication code
            <input
              value={totp}
              onChange={(e) => setTotp(e.target.value)}
              autoComplete="one-time-code"
              placeholder="123456"
              style={inputStyle}
            />
          </label>
        )}
        {error ? <p style={{ color: "#e35d6a", margin: 0 }}>{error}</p> : null}
        <button
          type="submit"
          disabled={loading}
          style={{
            background: "#d4a017",
            color: "#111",
            border: 0,
            padding: "0.8rem",
            fontWeight: 700,
            cursor: loading ? "wait" : "pointer",
          }}
        >
          {loading ? "Signing in…" : "Sign in"}
        </button>
      </form>
    </main>
  );
}

const inputStyle: React.CSSProperties = {
  background: "#0f141c",
  border: "1px solid #2a3548",
  color: "#fff",
  padding: "0.7rem 0.8rem",
};
