"use client";

import Image from "next/image";
import Link from "next/link";
import { ChevronDown, Menu, X } from "lucide-react";
import { useEffect, useState } from "react";
import { enabledMarkets } from "@/config/markets";
import type { Market } from "@/types";
import type { SiteCopy } from "@/i18n/content";
import { localizedHref } from "@/lib/site";
import { Button, Container } from "@/components/ui/core";
import { MarketSwitcher } from "./market-switcher";

const groups = [
  { title: "Build", links: [["Websites", "services/web-development"], ["Web platforms", "services/web-development"], ["Mobile apps", "services/mobile-app-development"], ["Desktop apps", "services/desktop-applications"], ["E-commerce", "services/ecommerce"], ["Custom software", "services/custom-software"]] },
  { title: "Automate", links: [["AI assistants", "services/ai-solutions"], ["Workflow automation", "services/scripts-automation"], ["Scripts & bots", "services/scripts-automation"], ["API integrations", "services/custom-software"], ["Data processing", "services/scripts-automation"]] },
  { title: "Grow", links: [["Payment integration", "services/payment-integration"], ["Video production", "services/video-production"], ["Product design", "solutions"], ["SEO & performance", "services/web-development"], ["Maintenance & support", "services"]] },
] as const;

export function Navbar({ market, copy }: { market: Market; copy: SiteCopy }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const home = localizedHref(market.countryCode, market.locale);
  const link = (path: string) => localizedHref(market.countryCode, market.locale, path);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  useEffect(() => {
    document.body.style.overflow = mobileOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [mobileOpen]);

  return (
    <header className={`sticky top-0 z-50 border-b transition ${scrolled ? "border-slate-200/80 bg-white/90 shadow-sm backdrop-blur-xl" : "border-transparent bg-white/75 backdrop-blur-md"}`}>
      <Container className="flex h-20 items-center gap-6">
        <Link href={home} aria-label="MIRAAJ.TECH home" className="shrink-0">
          <Image src="/brand/logo-horizontal.svg" alt="MIRAAJ.TECH" width={210} height={40} priority className="h-9 w-auto" />
        </Link>
        <nav className="ms-auto hidden items-center gap-1 lg:flex" aria-label="Primary navigation">
          <details className="group relative">
            <summary className="flex min-h-11 cursor-pointer list-none items-center gap-1 rounded-full px-4 text-sm font-semibold text-[var(--navy)] hover:bg-blue-50">
              {copy.nav.services}<ChevronDown className="size-4 transition group-open:rotate-180" />
            </summary>
            <div className="absolute top-full start-1/2 mt-3 w-[680px] -translate-x-1/2 rounded-3xl border border-[var(--border)] bg-white p-6 shadow-2xl">
              <div className="grid grid-cols-3 gap-6">
                {groups.map((group) => (
                  <div key={group.title}>
                    <p className="mb-3 text-xs font-black uppercase tracking-[0.15em] text-blue-600">{group.title}</p>
                    <div className="grid gap-1">
                      {group.links.map(([label, path]) => <Link key={label} href={link(path)} className="rounded-xl px-3 py-2 text-sm font-medium text-slate-700 hover:bg-blue-50 hover:text-blue-700">{label}</Link>)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </details>
          <Link href={link("solutions")} className="rounded-full px-4 py-3 text-sm font-semibold text-[var(--navy)] hover:bg-blue-50">{copy.nav.solutions}</Link>
          <Link href={link("work")} className="rounded-full px-4 py-3 text-sm font-semibold text-[var(--navy)] hover:bg-blue-50">{copy.nav.work}</Link>
          <Link href={link("about")} className="rounded-full px-4 py-3 text-sm font-semibold text-[var(--navy)] hover:bg-blue-50">{copy.nav.about}</Link>
          <Link href={link("insights")} className="rounded-full px-4 py-3 text-sm font-semibold text-[var(--navy)] hover:bg-blue-50">{copy.nav.insights}</Link>
        </nav>
        <div className="hidden items-center gap-3 lg:flex">
          <MarketSwitcher markets={enabledMarkets} current={market} />
          <Button href={link("quote")} size="sm">{copy.nav.start}</Button>
        </div>
        <button onClick={() => setMobileOpen(true)} className="ms-auto grid size-11 place-items-center rounded-full border border-[var(--border)] lg:hidden" aria-label={copy.common.menu}><Menu className="size-5" /></button>
      </Container>
      {mobileOpen && (
        <div className="fixed inset-0 z-[80] min-h-dvh overflow-auto bg-white lg:hidden">
          <Container className="py-5">
            <div className="flex items-center justify-between">
              <Image src="/brand/logo-horizontal.svg" alt="MIRAAJ.TECH" width={190} height={40} className="h-9 w-auto" />
              <button onClick={() => setMobileOpen(false)} className="grid size-11 place-items-center rounded-full border border-[var(--border)]" aria-label={copy.common.close}><X /></button>
            </div>
            <nav className="mt-8 grid gap-2" onClick={() => setMobileOpen(false)}>
              <details className="rounded-2xl border border-[var(--border)] p-4" onClick={(event) => event.stopPropagation()}>
                <summary className="flex cursor-pointer list-none items-center justify-between text-lg font-bold">{copy.nav.services}<ChevronDown className="size-5" /></summary>
                <div className="mt-4 grid gap-5">
                  {groups.map((group) => <div key={group.title}><p className="mb-2 text-xs font-black uppercase text-blue-600">{group.title}</p>{group.links.map(([label, path]) => <Link onClick={() => setMobileOpen(false)} key={label} href={link(path)} className="block py-2 text-sm font-medium text-slate-700">{label}</Link>)}</div>)}
                </div>
              </details>
              {[["solutions", copy.nav.solutions], ["work", copy.nav.work], ["about", copy.nav.about], ["insights", copy.nav.insights]].map(([path, label]) => <Link key={path} href={link(path)} className="rounded-2xl border border-[var(--border)] p-4 text-lg font-bold">{label}</Link>)}
            </nav>
            <div className="mt-6 grid gap-3">
              <MarketSwitcher markets={enabledMarkets} current={market} />
              <Button href={link("quote")} size="lg" className="w-full">{copy.nav.start}</Button>
            </div>
          </Container>
        </div>
      )}
    </header>
  );
}
