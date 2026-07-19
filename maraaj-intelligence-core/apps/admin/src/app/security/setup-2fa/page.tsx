
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api, setCsrfToken, type AuthUser } from "@/lib/api";

export default function SetupTwoFactorPage() {
  const router = useRouter();
  const [otpauth, setOtpauth] = useState("");
  const [secret, setSecret] = useState("");
  const [code, setCode] = useState("");
  const [recoveryCodes, setRecoveryCodes] = useState<string[] | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api<{ otpauth: string; secret: string }>("/api/v1/auth/2fa/setup", { method: "POST" })
      .then((data) => {
        setOtpauth(data.otpauth);
        setSecret(data.secret);
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : "Unable to start 2FA setup");
      });
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const data = await api<{ user: AuthUser; csrfToken?: string; recoveryCodes: string[] }>(
        "/api/v1/auth/2fa/confirm",
        { method: "POST", body: JSON.stringify({ totp: code }) },
      );
      if (data.csrfToken) setCsrfToken(data.csrfToken);
      setRecoveryCodes(data.recoveryCodes);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to verify the code");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main style={pageStyle}>
      <div style={cardStyle}>
        <div style={{ color: "#d4a017", letterSpacing: "0.16em", fontSize: 12 }}>SECURITY</div>
        <h1 style={{ margin: "0.4rem 0 0", fontFamily: "var(--font-serif), Georgia, serif" }}>
          {recoveryCodes ? "Save your recovery codes" : "Set up two-factor authentication"}
        </h1>

        {recoveryCodes ? (
          <>
            <p style={{ color: "#9aabc4" }}>
              These codes are shown only once. Store them somewhere safe — each can be used once if
              you lose access to your authenticator app.
            </p>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 8,
                fontFamily: "ui-monospace, monospace",
                background: "#0f141c",
                border: "1px solid #2a3548",
                padding: 16,
              }}
            >
              {recoveryCodes.map((c) => (
                <span key={c}>{c}</span>
              ))}
            </div>
            <button type="button" style={buttonStyle} onClick={() => router.push("/dashboard")}>
              I saved my codes — go to dashboard
            </button>
          </>
        ) : (
          <form onSubmit={onSubmit} style={{ display: "grid", gap: 12 }}>
            <p style={{ color: "#9aabc4", marginTop: 0 }}>
              Two-factor authentication is required before accessing the dashboard. Add this account
              to your authenticator app, then enter a verification code.
            </p>
            {otpauth ? (
              <div style={{ display: "grid", gap: 8, justifyItems: "center" }}>
                {/* Local QR via chart API is avoided; show otpauth + secret for manual entry. */}
                <code
                  style={{
                    wordBreak: "break-all",
                    fontSize: 12,
                    background: "#0f141c",
                    padding: 12,
                    border: "1px solid #2a3548",
                    width: "100%",
                  }}
                >
                  {otpauth}
                </code>
                <p style={{ color: "#9aabc4", fontSize: 13, margin: 0 }}>
                  Manual entry key: <strong style={{ color: "#fff" }}>{secret}</strong>
                </p>
              </div>
            ) : (
              <p style={{ color: "#9aabc4" }}>Preparing authenticator setup…</p>
            )}
            <label style={{ display: "grid", gap: 6 }}>
              Verification code
              <input
                value={code}
                onChange={(e) => setCode(e.target.value)}
                inputMode="numeric"
                autoComplete="one-time-code"
                required
                minLength={6}
                maxLength={6}
                style={inputStyle}
              />
            </label>
            {error ? <p style={{ color: "#e35d6a", margin: 0 }}>{error}</p> : null}
            <button type="submit" disabled={loading || !secret} style={buttonStyle}>
              {loading ? "Verifying…" : "Enable two-factor authentication"}
            </button>
          </form>
        )}
      </div>
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
  width: "min(520px, 100%)",
  background: "#171e2a",
  border: "1px solid #2a3548",
  padding: "2rem",
  display: "grid",
  gap: 12,
};
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
