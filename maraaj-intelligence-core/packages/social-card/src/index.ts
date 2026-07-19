
import sharp from "sharp";

export const SOCIAL_FORMATS = {
  og: { width: 1200, height: 630, name: "og" },
  twitter: { width: 1200, height: 628, name: "twitter" },
  instagram_portrait: { width: 1080, height: 1350, name: "instagram_portrait" },
  square: { width: 1080, height: 1080, name: "square" },
  story: { width: 1080, height: 1920, name: "story" },
  website_header: { width: 1600, height: 900, name: "website_header" },
  mobile_header: { width: 1080, height: 1350, name: "mobile_header" },
  thumbnail: { width: 640, height: 360, name: "thumbnail" },
} as const;

export type SocialFormatKey = keyof typeof SOCIAL_FORMATS;

export interface CardInput {
  title: string;
  description?: string;
  brand: string;
  category?: string;
  domain?: string;
  locale?: string;
  dir?: "ltr" | "rtl";
  palette: { bg: string; accent: string; text: string; muted: string };
  imageBuffer?: Buffer;
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function buildCardSvg(
  format: (typeof SOCIAL_FORMATS)[SocialFormatKey],
  input: CardInput,
): string {
  const title = escapeXml(input.title.slice(0, 80));
  const desc = escapeXml((input.description ?? "").slice(0, 140));
  const brand = escapeXml(input.brand);
  const category = escapeXml(input.category ?? "");
  const domain = escapeXml(input.domain ?? "");
  const dir = input.dir ?? "ltr";
  const textAnchor = dir === "rtl" ? "end" : "start";
  const x = dir === "rtl" ? format.width - 64 : 64;

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${format.width}" height="${format.height}" viewBox="0 0 ${format.width} ${format.height}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${input.palette.bg}"/>
      <stop offset="100%" stop-color="${input.palette.accent}"/>
    </linearGradient>
  </defs>
  <rect width="100%" height="100%" fill="url(#bg)"/>
  <rect x="48" y="48" width="${format.width - 96}" height="${format.height - 96}" rx="0" fill="rgba(0,0,0,0.25)"/>
  <text x="${x}" y="120" fill="${input.palette.muted}" font-size="28" font-family="Georgia, serif" text-anchor="${textAnchor}" direction="${dir}">${brand}</text>
  ${category ? `<text x="${x}" y="170" fill="${input.palette.accent}" font-size="22" font-family="system-ui" text-anchor="${textAnchor}" direction="${dir}">${category}</text>` : ""}
  <text x="${x}" y="${format.height / 2}" fill="${input.palette.text}" font-size="56" font-family="Georgia, serif" font-weight="700" text-anchor="${textAnchor}" direction="${dir}">${title}</text>
  ${desc ? `<text x="${x}" y="${format.height / 2 + 70}" fill="${input.palette.muted}" font-size="28" font-family="system-ui" text-anchor="${textAnchor}" direction="${dir}">${desc}</text>` : ""}
  ${domain ? `<text x="${x}" y="${format.height - 80}" fill="${input.palette.muted}" font-size="24" font-family="system-ui" text-anchor="${textAnchor}" direction="${dir}">${domain}</text>` : ""}
</svg>`;
}

export async function renderSocialCard(
  formatKey: SocialFormatKey,
  input: CardInput,
): Promise<Buffer> {
  const format = SOCIAL_FORMATS[formatKey];
  const svg = Buffer.from(buildCardSvg(format, input));
  let pipeline = sharp(svg).jpeg({ quality: 88, mozjpeg: true });
  if (input.imageBuffer) {
    const overlay = await sharp(input.imageBuffer)
      .resize(Math.floor(format.width * 0.35), Math.floor(format.height * 0.45), { fit: "cover" })
      .jpeg()
      .toBuffer();
    pipeline = sharp(svg)
      .composite([{ input: overlay, top: 80, left: format.width - Math.floor(format.width * 0.35) - 64 }])
      .jpeg({ quality: 88, mozjpeg: true });
  }
  return pipeline.toBuffer();
}

export function versionedFilename(opts: {
  postId: string;
  locale: string;
  format: string;
  version: number;
}): string {
  return `post-${opts.postId}-${opts.locale}-${opts.format}-v${opts.version}.jpg`;
}

export const TEMPLATE_PALETTES = {
  ai: { bg: "#0B1F3A", accent: "#7C5CFF", text: "#FFFFFF", muted: "#C7D2FE" },
  dentistry: { bg: "#F7FBFA", accent: "#2F8F7B", text: "#12352F", muted: "#4A6B64" },
  entertainment: { bg: "#1A0B2E", accent: "#FF4D6D", text: "#FFFFFF", muted: "#FFD6E0" },
  technology: { bg: "#071824", accent: "#00C2D1", text: "#FFFFFF", muted: "#9ED9E0" },
  general: { bg: "#111827", accent: "#D4A017", text: "#FFFFFF", muted: "#E5E7EB" },
} as const;
