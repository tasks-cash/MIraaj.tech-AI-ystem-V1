
"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";

export default function Page() {
  const q = useQuery({
    queryKey: ["integrations"],
    queryFn: () => api<unknown>("/api/v1/api-clients"),
  });

  return (
    <div>
      <h1 style={{ fontFamily: "var(--font-serif), Georgia, serif", marginTop: 0 }}>Integrations</h1>
      <p style={{ color: "#9aabc4" }}>External project integrations</p>
      {q.isLoading ? <p>Loading…</p> : null}
      {q.error ? <p style={{ color: "#e35d6a" }}>{(q.error as Error).message}</p> : null}
      <pre
        style={{
          background: "#171e2a",
          border: "1px solid #2a3548",
          padding: "1rem",
          overflow: "auto",
          maxHeight: "70vh",
        }}
      >
        {JSON.stringify(q.data ?? null, null, 2)}
      </pre>
    </div>
  );
}
