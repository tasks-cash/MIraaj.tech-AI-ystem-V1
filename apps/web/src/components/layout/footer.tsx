import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { company } from "@/config/company";
import { enabledMarkets } from "@/config/markets";
import type { Market } from "@/types";
import { localizedHref } from "@/lib/site";
import { Container } from "@/components/ui/core";
import { MarketSwitcher } from "./market-switcher";

export function Footer({ market }: { market: Market }) {
  const href = (path: string) => localizedHref(market.countryCode, market.locale, path);
  const columns = [
    ["Services", ["services", "ai", "payments", "video"]],
    ["Solutions", ["solutions", "industries", "work", "process"]],
    ["Company", ["about", "pricing", "careers", "contact"]],
    ["Resources", ["insights", "faq", "quote", "accessibility"]],
    ["Legal", ["privacy", "terms", "cookies"]],
  ];
  return (
    <footer className="border-t border-slate-200 bg-[var(--navy)] text-white">
      <Container className="py-16 lg:py-20">
        <div className="grid gap-12 lg:grid-cols-[1.4fr_2.6fr]">
          <div>
            <Image src="/brand/logo-horizontal.svg" alt="MIRAAJ.TECH" width={220} height={45} className="h-10 w-auto rounded bg-white px-2" />
            <p className="mt-5 max-w-sm leading-7 text-slate-300">{company.description}</p>
            <p className="mt-3 text-sm font-semibold text-sky-300">{company.slogan}</p>
          </div>
          <div className="grid grid-cols-2 gap-8 sm:grid-cols-3 lg:grid-cols-5">
            {columns.map(([title, paths]) => (
              <div key={title as string}>
                <h2 className="mb-4 text-sm font-bold">{title}</h2>
                <div className="grid gap-3">
                  {(paths as string[]).map((path) => <Link key={path} href={href(path)} className="inline-flex items-center gap-1 text-sm capitalize text-slate-400 hover:text-white">{path.replace("-", " ")}<ArrowUpRight className="size-3" aria-hidden /></Link>)}
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="mt-12 flex flex-col gap-5 border-t border-white/10 pt-7 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-slate-400">© {new Date().getFullYear()} {company.companyName}. All rights reserved.</p>
          <MarketSwitcher markets={enabledMarkets} current={market} label="Choose market and language" />
        </div>
      </Container>
    </footer>
  );
}
