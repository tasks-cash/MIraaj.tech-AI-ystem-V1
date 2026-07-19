
export default function HomePage() {
  return (
    <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 24 }}>
      <div style={{ textAlign: "center", maxWidth: 640 }}>
        <p style={{ letterSpacing: "0.2em", textTransform: "uppercase", color: "#c9a227", marginBottom: 12 }}>
          Maraaj.tech
        </p>
        <h1 style={{ fontFamily: "var(--font-display), Georgia, serif", fontSize: "clamp(2.5rem, 6vw, 4rem)", margin: 0 }}>
          Intelligence Core
        </h1>
        <p style={{ color: "#b8c0d0", marginTop: 16, fontSize: "1.125rem" }}>
          Private invitation and tracking pages are served from this surface.
        </p>
      </div>
    </main>
  );
}
