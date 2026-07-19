
"use client";

import { useQuery } from "@tanstack/react-query";

export default function Page() {
  const q = useQuery({
    queryKey: ["health"],
    queryFn: async () => {
      const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
      const res = await fetch(`${API}/health/ready`);
      return res.json();
    },
  });
  return (
    <div>
      <h1 style={{ fontFamily: "var(--font-serif), Georgia, serif", marginTop: 0 }}>System health</h1>
      <pre style={{ background: "#171e2a", border: "1px solid #2a3548", padding: "1rem" }}>
        {JSON.stringify(q.data ?? null, null, 2)}
      </pre>
    </div>
  );
}
