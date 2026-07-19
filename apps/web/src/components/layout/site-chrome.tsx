"use client";

import Link from "next/link";
import { WifiOff, X } from "lucide-react";
import { useEffect, useState } from "react";
import { Button, Container } from "@/components/ui/core";

export function AnnouncementBar({ message, href, linkLabel }: { message: string; href: string; linkLabel: string }) {
  const [visible, setVisible] = useState(true);
  if (!visible) return null;
  return (
    <div className="bg-blue-600 text-white">
      <Container className="flex min-h-10 items-center justify-center gap-3 py-2 text-center text-xs font-semibold sm:text-sm">
        <span>{message}</span>
        <Link href={href} className="shrink-0 underline underline-offset-4">{linkLabel}</Link>
        <button onClick={() => setVisible(false)} className="ms-auto grid size-7 shrink-0 place-items-center rounded-full hover:bg-white/15" aria-label="Dismiss announcement"><X className="size-4" /></button>
      </Container>
    </div>
  );
}

export function CookieBanner({ privacyHref, cookiesHref }: { privacyHref: string; cookiesHref: string }) {
  const [visible, setVisible] = useState(false);
  const [customizing, setCustomizing] = useState(false);
  useEffect(() => {
    const timer = window.setTimeout(() => {
      setVisible(!localStorage.getItem("miraaj_consent"));
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);
  function save(value: "necessary" | "all") {
    localStorage.setItem("miraaj_consent", value);
    document.cookie = `miraaj_consent=${value}; Path=/; Max-Age=31536000; SameSite=Lax`;
    setVisible(false);
  }
  if (!visible) return null;
  return (
    <div className="fixed inset-x-4 bottom-4 z-[70] mx-auto max-w-3xl rounded-3xl border border-[var(--border)] bg-white p-5 shadow-2xl sm:p-6" role="dialog" aria-label="Cookie preferences">
      <h2 className="text-lg font-bold text-[var(--navy)]">Your privacy choices</h2>
      <p className="mt-2 text-sm leading-6 text-[var(--muted)]">We use necessary storage for market and consent preferences. Optional analytics are disabled for now. Read our <Link className="text-blue-700 underline" href={privacyHref}>privacy policy</Link> and <Link className="text-blue-700 underline" href={cookiesHref}>cookie policy</Link>.</p>
      {customizing && <div className="mt-4 rounded-xl bg-slate-50 p-3 text-sm"><strong>Necessary storage</strong><span className="float-end text-emerald-700">Always active</span></div>}
      <div className="mt-5 flex flex-wrap gap-2">
        <Button onClick={() => save("necessary")} variant="secondary" size="sm">Accept necessary</Button>
        <Button onClick={() => save("all")} size="sm">Accept all</Button>
        <Button onClick={() => setCustomizing((value) => !value)} variant="ghost" size="sm">Customize</Button>
      </div>
    </div>
  );
}

export function OfflineNotice() {
  const [offline, setOffline] = useState(false);
  useEffect(() => {
    const update = () => setOffline(!navigator.onLine);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);
  if (!offline) return null;
  return <div role="status" className="fixed bottom-4 start-1/2 z-[90] flex -translate-x-1/2 items-center gap-2 rounded-full bg-slate-950 px-4 py-2 text-sm font-semibold text-white shadow-xl"><WifiOff className="size-4" />You are offline</div>;
}
