
import { cache } from "react";

export type PublicPagePayload = {
  project: { id: string; name: string; slug: string };
  post: {
    id: string;
    title: string;
    description?: string;
    publicCode: string;
    tags?: string[];
    destinationUrl?: string;
    destinationDomain?: string;
    publishedAt?: string;
    expiresAt?: string;
    locale: string;
  };
  category: { id: string; name: string; slug: string } | null;
  group: { id: string; name: string; slug: string } | null;
  media: {
    header: { url: string; width?: number; height?: number } | null;
    mobileHeader: { url: string; width?: number; height?: number } | null;
    socialCards: Array<{ format: string; url: string }>;
    gallery: Array<{ id: string; url: string }>;
    ogImage: string | null;
  };
  qr: { publicCode: string; url: string; active: boolean } | null;
  seo: { title: string; description?: string; canonical: string; ogImage: string | null };
  tracking: { publicCode: string; privacyMode: string };
  relatedPosts: Array<{ title: string; publicCode: string; description?: string }>;
  legal: { privacyUrl: string; termsUrl: string };
  consent: { required: boolean; modes: string[] };
};

export const loadPublicPage = cache(async (publicCode: string, locale = "en") => {
  const api = process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
  const res = await fetch(`${api}/api/v1/public/page/${encodeURIComponent(publicCode)}?locale=${locale}`, {
    next: { revalidate: 60 },
  });
  if (!res.ok) return null;
  const json = (await res.json()) as { success: boolean; data: PublicPagePayload };
  if (!json.success) return null;
  return json.data;
});
