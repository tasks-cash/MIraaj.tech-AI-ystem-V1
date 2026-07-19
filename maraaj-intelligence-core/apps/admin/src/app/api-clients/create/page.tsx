
"use client";

import { useState } from "react";
import { api } from "@/lib/api";

export default function CreateApiClientPage() {
  const [projectId, setProjectId] = useState("");
  const [name, setName] = useState("");
  const [result, setResult] = useState<unknown>(null);
  const [error, setError] = useState("");

  async function create() {
    setError("");
    try {
      const data = await api("/api/v1/api-clients", {
        method: "POST",
        body: JSON.stringify({
          name,
          projectId,
          environment: "development",
          scopes: ["posts.write", "posts.read", "assets.write", "analysis.run"],
        }),
      });
      setResult(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    }
  }

  return (
    <div style={{ display: "grid", gap: 12, maxWidth: 640 }}>
      <h1 style={{ fontFamily: "var(--font-serif), Georgia, serif", marginTop: 0 }}>Create API client</h1>
      <input placeholder="Project ID" value={projectId} onChange={(e) => setProjectId(e.target.value)} style={field} />
      <input placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} style={field} />
      <button type="button" onClick={create} style={{ background: "#d4a017", border: 0, padding: "0.8rem", fontWeight: 700 }}>
        Generate Ed25519 credentials
      </button>
      {error ? <p style={{ color: "#e35d6a" }}>{error}</p> : null}
      {result ? (
        <pre style={{ background: "#171e2a", border: "1px solid #2a3548", padding: "1rem", whiteSpace: "pre-wrap" }}>
          {JSON.stringify(result, null, 2)}
        </pre>
      ) : null}
      <p style={{ color: "#9aabc4" }}>Private key is shown once. Download and confirm saved before leaving.</p>
    </div>
  );
}

const field: React.CSSProperties = {
  background: "#0f141c",
  border: "1px solid #2a3548",
  color: "#fff",
  padding: "0.7rem 0.8rem",
};
