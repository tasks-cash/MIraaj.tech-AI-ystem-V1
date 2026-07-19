
"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { api, pendingSecurityRoute, type AuthUser } from "@/lib/api";

const NAV = [
  ["Overview", "/dashboard"],
  ["Projects", "/projects"],
  ["Posts", "/posts"],
  ["Review", "/review"],
  ["Categories", "/categories"],
  ["Groups", "/groups"],
  ["Assets", "/assets"],
  ["Social Media", "/social-cards"],
  ["QR Codes", "/qr"],
  ["Analytics", "/analytics"],
  ["AI Providers", "/providers"],
  ["Models", "/models"],
  ["Training", "/training-feedback"],
  ["Integrations", "/integrations"],
  ["API Clients", "/api-clients"],
  ["Webhooks", "/webhooks"],
  ["Users", "/users"],
  ["Roles", "/roles"],
  ["Security", "/security"],
  ["Audit Logs", "/audit"],
  ["Settings", "/settings"],
  ["System Health", "/system-health"],
] as const;

const BARE_ROUTES = ["/login", "/security/change-password", "/security/setup-2fa"];

export function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const bare = BARE_ROUTES.some((route) => pathname === route || pathname.startsWith(route + "/"));

  useEffect(() => {
    if (bare) return;
    api<{ user: AuthUser }>("/api/v1/auth/me")
      .then((data) => {
        const next = pendingSecurityRoute(data.user);
        if (next) router.replace(next);
      })
      .catch(() => {
        router.replace("/login");
      });
  }, [bare, pathname, router]);

  if (bare) return <>{children}</>;

  return (
    <div style={{ display: "grid", gridTemplateColumns: "260px 1fr", minHeight: "100vh" }}>
      <aside
        style={{
          background: "#121925",
          borderRight: "1px solid #2a3548",
          padding: "1.25rem 1rem",
          position: open ? "fixed" : "sticky",
          top: 0,
          height: "100vh",
          overflow: "auto",
          zIndex: 20,
          width: 260,
        }}
      >
        <div style={{ marginBottom: 24 }}>
          <div style={{ color: "#d4a017", letterSpacing: "0.16em", fontSize: 12 }}>MARAAJ.TECH</div>
          <div style={{ fontWeight: 700, marginTop: 4 }}>Intelligence Core</div>
        </div>
        <nav style={{ display: "grid", gap: 4 }}>
          {NAV.map(([label, href]) => {
            const active = pathname === href || pathname.startsWith(href + "/");
            return (
              <Link
                key={href}
                href={href}
                onClick={() => setOpen(false)}
                style={{
                  padding: "0.55rem 0.75rem",
                  background: active ? "#1d283a" : "transparent",
                  borderLeft: active ? "3px solid #d4a017" : "3px solid transparent",
                  color: active ? "#fff" : "#9aabc4",
                }}
              >
                {label}
              </Link>
            );
          })}
        </nav>
      </aside>
      <div>
        <header
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "0.9rem 1.25rem",
            borderBottom: "1px solid #2a3548",
            position: "sticky",
            top: 0,
            background: "rgba(15,20,28,0.92)",
            backdropFilter: "blur(8px)",
            zIndex: 10,
          }}
        >
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            style={{ display: "none", background: "transparent", color: "#fff", border: 0 }}
            className="mobile-nav"
          >
            Menu
          </button>
          <input
            placeholder="Search…"
            style={{
              background: "#171e2a",
              border: "1px solid #2a3548",
              color: "#fff",
              padding: "0.55rem 0.8rem",
              width: "min(420px, 60vw)",
            }}
          />
          <div style={{ color: "#9aabc4", fontSize: 14 }}>Console</div>
        </header>
        <main style={{ padding: "1.25rem" }}>{children}</main>
      </div>
      <style>{`
        @media (max-width: 900px) {
          div[style*="grid-template-columns: 260px"] { grid-template-columns: 1fr !important; }
          aside { transform: ${open ? "translateX(0)" : "translateX(-110%)"}; transition: transform .2s ease; }
          .mobile-nav { display: inline-block !important; }
        }
      `}</style>
    </div>
  );
}
