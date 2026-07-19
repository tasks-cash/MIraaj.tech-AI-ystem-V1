"use client";

import { Check, Globe2, Search } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import type { Market } from "@/types";
import { preservePageForMarket } from "@/lib/site";
import { Modal } from "@/components/ui/interactive";
import { inputClass } from "@/components/ui/core";

export function MarketSwitcher({ markets, current, label = "Market & language" }: { markets: Market[]; current: Market; label?: string }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const router = useRouter();
  const pathname = usePathname();
  const filtered = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase();
    return markets.filter((market) =>
      `${market.countryName} ${market.nativeLanguageName} ${market.currencyCode}`
        .toLocaleLowerCase()
        .includes(normalized),
    );
  }, [markets, query]);

  function choose(market: Market) {
    // The user's explicit selection must override future automatic detection.
    // eslint-disable-next-line react-hooks/immutability
    document.cookie = `miraaj_market=${market.id}; Path=/; Max-Age=31536000; SameSite=Lax`;
    setOpen(false);
    router.push(preservePageForMarket(pathname, market.countryCode, market.locale));
  }

  return (
    <>
      <button onClick={() => setOpen(true)} className="inline-flex min-h-11 items-center gap-2 rounded-full border border-[var(--border)] bg-white px-4 text-sm font-semibold text-[var(--navy)] hover:border-blue-300" aria-haspopup="dialog">
        <Globe2 className="size-4 text-blue-600" aria-hidden />
        <span className="max-w-28 truncate">{current.countryName}</span>
        <span className="text-[var(--muted)]">{current.locale.toUpperCase()}</span>
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title={label}>
        <label className="relative block">
          <span className="sr-only">Search countries and languages</span>
          <Search className="pointer-events-none absolute top-1/2 start-4 size-5 -translate-y-1/2 text-slate-400" />
          <input autoFocus value={query} onChange={(event) => setQuery(event.target.value)} className={`${inputClass} ps-12`} placeholder="Search country, language or currency" />
        </label>
        <div className="mt-5 grid max-h-[56dvh] gap-2 overflow-auto sm:grid-cols-2">
          {filtered.map((market) => (
            <button key={market.id} onClick={() => choose(market)} className="flex min-h-16 items-center gap-3 rounded-2xl border border-[var(--border)] p-3 text-start hover:border-blue-300 hover:bg-blue-50">
              <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-slate-100 text-xs font-black uppercase text-slate-600">{market.countryCode.slice(0, 2)}</span>
              <span className="min-w-0 flex-1">
                <strong className="block truncate text-sm text-[var(--navy)]">{market.countryName}</strong>
                <span className="block truncate text-xs text-[var(--muted)]">{market.nativeLanguageName} · {market.currencyCode}</span>
              </span>
              {market.id === current.id && <Check className="size-5 text-blue-600" aria-label="Selected" />}
            </button>
          ))}
          {filtered.length === 0 && <p className="col-span-full py-10 text-center text-[var(--muted)]">No markets found.</p>}
        </div>
      </Modal>
    </>
  );
}
