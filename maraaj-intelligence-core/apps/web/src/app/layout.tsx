
import type { Metadata } from "next";
import { Libre_Baskerville, Source_Sans_3 } from "next/font/google";
import "./globals.css";

const display = Libre_Baskerville({ subsets: ["latin"], weight: ["400", "700"], variable: "--font-display" });
const body = Source_Sans_3({ subsets: ["latin"], variable: "--font-body" });

export const metadata: Metadata = {
  title: "Maraaj.tech",
  description: "Maraaj Intelligence Core public pages",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${body.variable}`}>
      <body style={{ fontFamily: "var(--font-body), Georgia, serif" }}>{children}</body>
    </html>
  );
}
