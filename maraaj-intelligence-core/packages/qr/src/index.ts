
import QRCode from "qrcode";
import { randomBytes } from "node:crypto";

export function generatePublicCode(length = 10): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
  const bytes = randomBytes(length);
  let out = "";
  for (let i = 0; i < length; i++) {
    out += alphabet[bytes[i]! % alphabet.length];
  }
  return out;
}

export function buildGoUrl(baseUrl: string, publicCode: string, kind: "q" | "p" | "invite" = "q") {
  return `${baseUrl.replace(/\/$/, "")}/${kind}/${publicCode}`;
}

export async function generateQrPng(url: string, size = 512): Promise<Buffer> {
  return QRCode.toBuffer(url, {
    type: "png",
    width: size,
    margin: 2,
    errorCorrectionLevel: "M",
  });
}

export async function generateQrSvg(url: string): Promise<string> {
  return QRCode.toString(url, { type: "svg", margin: 2, errorCorrectionLevel: "M" });
}
