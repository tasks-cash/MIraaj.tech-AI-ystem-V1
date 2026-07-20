"use client";

import { useMemo, useState } from "react";
import { ArrowRight, Check } from "lucide-react";
import type { Market } from "@/types";
import type { HomeCopy } from "@/i18n/home-copy";
import { localizedHref } from "@/lib/site";
import { Button, Card, cn } from "@/components/ui/core";
import { MotionReveal, StaggerContainer, StaggerItem } from "@/components/motion/homepage-motion";

function mapCategories(copy: HomeCopy, businessIndex: number, needIndex: number, maturityIndex: number) {
  const base = [...copy.explorer.categories];
  // Lightweight deterministic mapping for demo only — not Prompt 3 matching.
  if (businessIndex <= 2) base.unshift(copy.matching.categories[1] ?? base[0]!);
  if (needIndex === 3 || needIndex === 4) base.unshift(copy.matching.categories[2] ?? base[0]!);
  if (needIndex === 2) base.unshift(copy.matching.categories[3] ?? base[0]!);
  if (needIndex === 8) base.unshift(copy.matching.categories[4] ?? base[0]!);
  if (needIndex === 7) base.unshift(copy.matching.categories[5] ?? base[0]!);
  if (maturityIndex >= 3) base.push(copy.matching.categories[6] ?? base[0]!);
  return Array.from(new Set(base)).slice(0, 6);
}

export function SolutionExplorer({ market, copy }: { market: Market; copy: HomeCopy }) {
  const [step, setStep] = useState(0);
  const [business, setBusiness] = useState<number | null>(null);
  const [need, setNeed] = useState<number | null>(null);
  const [maturity, setMaturity] = useState<number | null>(null);

  const categories = useMemo(() => {
    if (business === null || need === null || maturity === null) return [];
    return mapCategories(copy, business, need, maturity);
  }, [business, need, maturity, copy]);

  const href = (path: string) => localizedHref(market.countryCode, market.locale, path);

  const options =
    step === 0
      ? copy.explorer.businessTypes
      : step === 1
        ? copy.explorer.needs
        : step === 2
          ? copy.explorer.maturity
          : [];

  const selected =
    step === 0 ? business : step === 1 ? need : step === 2 ? maturity : null;

  const setSelected = (index: number) => {
    if (step === 0) setBusiness(index);
    if (step === 1) setNeed(index);
    if (step === 2) setMaturity(index);
  };

  const stepLabel =
    step === 0
      ? copy.explorer.stepBusiness
      : step === 1
        ? copy.explorer.stepNeed
        : step === 2
          ? copy.explorer.stepMaturity
          : copy.explorer.stepResult;

  return (
    <MotionReveal>
      <Card className="overflow-hidden p-0">
        <div className="border-b border-[var(--border)] bg-[var(--soft)] px-6 py-5 sm:px-8">
          <p className="text-sm font-bold uppercase tracking-[0.14em] text-[var(--blue)]">
            {copy.explorer.eyebrow}
          </p>
          <h2 className="mt-2 text-2xl font-bold tracking-tight text-[var(--navy)] sm:text-3xl">
            {copy.explorer.title}
          </h2>
          <p className="mt-3 max-w-3xl leading-7 text-[var(--muted)]">
            {copy.explorer.description}
          </p>
          <p className="mt-3 text-sm font-semibold text-amber-800">
            {copy.explorer.disclaimer}
          </p>
        </div>

        <div className="p-6 sm:p-8">
          <div className="mb-6 flex flex-wrap gap-2" aria-hidden="true">
            {[0, 1, 2, 3].map((index) => (
              <span
                key={index}
                className={cn(
                  "h-1.5 w-12 rounded-full",
                  index <= step ? "bg-blue-600" : "bg-slate-200",
                )}
              />
            ))}
          </div>
          <p className="mb-4 text-sm font-bold text-[var(--navy)]">{stepLabel}</p>

          {step < 3 ? (
            <div
              className="grid gap-2 sm:grid-cols-2"
              role="listbox"
              aria-label={stepLabel}
            >
              {options.map((option, index) => {
                const active = selected === index;
                return (
                  <button
                    key={option}
                    type="button"
                    role="option"
                    aria-selected={active}
                    className={cn(
                      "min-h-12 rounded-xl border px-4 py-3 text-start text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-500/25",
                      active
                        ? "border-blue-600 bg-blue-50 text-blue-950"
                        : "border-[var(--border)] bg-white text-[var(--navy)] hover:border-blue-300",
                    )}
                    onClick={() => setSelected(index)}
                  >
                    {option}
                  </button>
                );
              })}
            </div>
          ) : (
            <StaggerContainer className="grid gap-4">
              <p className="leading-7 text-[var(--muted)]">{copy.explorer.resultBody}</p>
              <StaggerItem>
                <ul className="grid gap-2 sm:grid-cols-2">
                  {categories.map((category) => (
                    <li
                      key={category}
                      className="flex items-center gap-2 rounded-xl bg-blue-50 px-4 py-3 text-sm font-semibold text-blue-950"
                    >
                      <Check className="size-4 text-blue-600" aria-hidden />
                      {category}
                    </li>
                  ))}
                </ul>
              </StaggerItem>
              <div className="mt-2 flex flex-wrap gap-3">
                <Button href={href("quote")}>
                  {copy.explorer.ctaPrimary}
                  <ArrowRight className="size-4 rtl:rotate-180" aria-hidden />
                </Button>
                <Button href={href("services")} variant="secondary">
                  {copy.explorer.ctaSecondary}
                </Button>
              </div>
            </StaggerContainer>
          )}

          <div className="mt-6 flex flex-wrap gap-3">
            {step > 0 && (
              <Button
                type="button"
                variant="ghost"
                onClick={() => setStep((value) => Math.max(0, value - 1))}
              >
                {copy.explorer.back}
              </Button>
            )}
            {step < 3 && (
              <Button
                type="button"
                disabled={selected === null}
                onClick={() => setStep((value) => value + 1)}
              >
                {copy.explorer.next}
              </Button>
            )}
            {step === 3 && (
              <Button
                type="button"
                variant="secondary"
                onClick={() => {
                  setStep(0);
                  setBusiness(null);
                  setNeed(null);
                  setMaturity(null);
                }}
              >
                {copy.explorer.restart}
              </Button>
            )}
          </div>
        </div>
      </Card>
    </MotionReveal>
  );
}
