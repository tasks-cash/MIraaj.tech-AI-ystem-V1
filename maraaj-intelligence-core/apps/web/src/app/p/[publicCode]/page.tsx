
import type { Metadata } from "next";
import { loadPublicPage } from "@/lib/page";
import { notFound } from "next/navigation";

type Props = { params: Promise<{ publicCode: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { publicCode } = await params;
  const data = await loadPublicPage(publicCode);
  if (!data) return { title: "Not found" };
  return {
    title: data.seo.title,
    description: data.seo.description,
    alternates: { canonical: data.seo.canonical },
    openGraph: {
      title: data.seo.title,
      description: data.seo.description,
      url: data.seo.canonical,
      type: "website",
      images: data.seo.ogImage ? [{ url: data.seo.ogImage }] : [],
    },
    twitter: {
      card: "summary_large_image",
      title: data.seo.title,
      description: data.seo.description,
      images: data.seo.ogImage ? [data.seo.ogImage] : [],
    },
  };
}

export default async function PublicPostPage({ params }: Props) {
  const { publicCode } = await params;
  const data = await loadPublicPage(publicCode);
  if (!data) notFound();
  const dir = /^ar/.test(data.post.locale) ? "rtl" : "ltr";

  return (
    <main dir={dir} style={{ minHeight: "100vh" }}>
      <section style={{ position: "relative", minHeight: "72vh", display: "grid", alignItems: "end" }}>
        {data.media.header?.url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={data.media.header.url}
            alt=""
            style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }}
          />
        ) : null}
        <div
          style={{
            position: "relative",
            padding: "clamp(2rem, 6vw, 5rem)",
            background: "linear-gradient(transparent, rgba(8,12,20,0.92))",
          }}
        >
          <p style={{ color: "#c9a227", letterSpacing: "0.18em", textTransform: "uppercase", margin: 0 }}>
            {data.project.name}
          </p>
          <h1
            style={{
              fontFamily: "var(--font-display), Georgia, serif",
              fontSize: "clamp(2.4rem, 7vw, 4.5rem)",
              margin: "0.4rem 0 0.8rem",
              maxWidth: 900,
            }}
          >
            {data.post.title}
          </h1>
          <p style={{ color: "#d5dbe8", maxWidth: 680, fontSize: "1.15rem" }}>{data.post.description}</p>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 24 }}>
            {data.post.destinationUrl ? (
              <a
                href={data.post.destinationUrl}
                rel="noopener noreferrer"
                style={{
                  background: "#c9a227",
                  color: "#111",
                  padding: "0.9rem 1.4rem",
                  textDecoration: "none",
                  fontWeight: 700,
                }}
              >
                Continue to {data.post.destinationDomain ?? "destination"}
              </a>
            ) : null}
            <a href={`/report?code=${data.post.publicCode}`} style={{ padding: "0.9rem 1.2rem", color: "#b8c0d0" }}>
              Report
            </a>
          </div>
        </div>
      </section>
      <section style={{ padding: "2rem clamp(1.25rem, 5vw, 4rem)", display: "grid", gap: 8 }}>
        {data.category ? <p>Category: {data.category.name}</p> : null}
        {data.group ? <p>Group: {data.group.name}</p> : null}
        {data.qr ? (
          <p>
            QR: <a href={data.qr.url}>{data.qr.publicCode}</a>
          </p>
        ) : null}
        <p style={{ color: "#9aa6bc" }}>
          <a href={data.legal.privacyUrl}>Privacy</a> · <a href={data.legal.termsUrl}>Terms</a>
        </p>
      </section>
    </main>
  );
}
