"use client";

import { useState } from "react";
import { ArrowRight, Check, ShieldCheck, Sparkles } from "lucide-react";
import type { Market } from "@/types";
import type { HomeCopy } from "@/i18n/home-copy";
import { localizedHref, interpolate } from "@/lib/site";
import {
  Badge,
  Button,
  Card,
  Container,
  SectionHeading,
  cn,
} from "@/components/ui/core";
import {
  FadeIn,
  HoverLift,
  MotionReveal,
  ScaleReveal,
  StaggerContainer,
  StaggerItem,
  TextLineReveal,
} from "@/components/motion/homepage-motion";
import { AiPipelineVisual } from "@/components/visuals/ai-pipeline-visual";
import { SolutionExplorer } from "@/components/sections/home/solution-explorer";
import { Tabs } from "@/components/ui/interactive";

function hrefFor(market: Market, path: string) {
  return localizedHref(market.countryCode, market.locale, path);
}

export function HomeHero({ market, copy }: { market: Market; copy: HomeCopy }) {
  return (
    <section className="relative overflow-hidden border-b border-[var(--border)] bg-[radial-gradient(circle_at_78%_18%,#DDF4FF_0,transparent_40%),linear-gradient(#fff,#F7FAFD)]">
      <div
        className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,#176bff0a_1px,transparent_1px),linear-gradient(to_bottom,#176bff0a_1px,transparent_1px)] bg-[size:48px_48px] [mask-image:linear-gradient(to_bottom,black,transparent_85%)]"
        aria-hidden
      />
      <Container className="relative grid items-center gap-12 py-16 lg:min-h-[720px] lg:grid-cols-[1.05fr_.95fr] lg:py-20">
        <div>
          <FadeIn>
            <Badge>{copy.hero.eyebrow}</Badge>
          </FadeIn>
          <TextLineReveal
            text={copy.hero.title}
            className="mt-6 max-w-3xl text-balance text-4xl font-extrabold leading-[1.08] tracking-[-0.055em] text-[var(--navy)] sm:text-5xl lg:text-6xl"
          />
          <MotionReveal delay={0.15}>
            <p className="mt-6 max-w-2xl text-pretty text-lg leading-8 text-[var(--muted)] sm:text-xl">
              {copy.hero.description}
            </p>
          </MotionReveal>
          <MotionReveal delay={0.22}>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Button href={hrefFor(market, "ai")} size="lg">
                {copy.hero.primary}
                <ArrowRight className="size-4 rtl:rotate-180" aria-hidden />
              </Button>
              <Button href={hrefFor(market, "process")} variant="secondary" size="lg">
                {copy.hero.secondary}
              </Button>
            </div>
          </MotionReveal>
          <StaggerContainer className="mt-7 flex flex-wrap gap-x-5 gap-y-2 text-sm font-medium text-slate-600">
            {copy.hero.assurances.map((item) => (
              <StaggerItem key={item}>
                <span className="flex items-center gap-2">
                  <Check className="size-4 text-emerald-600" aria-hidden />
                  {item}
                </span>
              </StaggerItem>
            ))}
          </StaggerContainer>
        </div>
        <ScaleReveal delay={0.2}>
          <AiPipelineVisual copy={copy.overview} />
        </ScaleReveal>
      </Container>
    </section>
  );
}

export function TrustStrip({ copy }: { copy: HomeCopy }) {
  return (
    <section className="border-b border-[var(--border)] bg-white py-10">
      <Container>
        <MotionReveal>
          <p className="text-sm font-bold uppercase tracking-[0.14em] text-[var(--blue)]">
            {copy.trust.eyebrow}
          </p>
          <h2 className="mt-2 text-xl font-bold text-[var(--navy)] sm:text-2xl">
            {copy.trust.title}
          </h2>
        </MotionReveal>
        <StaggerContainer className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {copy.trust.items.map((item) => (
            <StaggerItem key={item}>
              <div className="rounded-2xl border border-[var(--border)] bg-[var(--soft)] px-4 py-3 text-sm font-semibold text-slate-700">
                {item}
              </div>
            </StaggerItem>
          ))}
        </StaggerContainer>
      </Container>
    </section>
  );
}

export function MarketLineBanner({
  market,
  copy,
}: {
  market: Market;
  copy: HomeCopy;
}) {
  return (
    <div className="border-b border-blue-100 bg-blue-50/70 py-3 text-center text-sm font-semibold text-blue-950">
      <Container>
        {interpolate(copy.marketLine, { country: market.countryName })} ·{" "}
        {market.currencyCode}
      </Container>
    </div>
  );
}

export function AiSystemOverview({ copy }: { copy: HomeCopy }) {
  return (
    <section className="section-space bg-[var(--soft)]" id="how-it-works">
      <Container>
        <MotionReveal>
          <SectionHeading
            eyebrow={copy.overview.eyebrow}
            title={copy.overview.title}
            description={copy.overview.description}
          />
        </MotionReveal>
        <ol className="mt-12 grid gap-4 lg:grid-cols-5">
          {copy.overview.steps.map((step, index) => (
            <li key={step.title}>
              <MotionReveal delay={index * 0.06}>
                <article className="relative h-full rounded-2xl border border-[var(--border)] bg-white p-5">
                  <span className="mb-4 grid size-9 place-items-center rounded-full bg-[var(--navy)] text-sm font-black text-white">
                    {index + 1}
                  </span>
                  <h3 className="font-bold text-[var(--navy)]">{step.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-[var(--muted)]">{step.body}</p>
                  {index < copy.overview.steps.length - 1 && (
                    <span
                      className="pointer-events-none absolute -end-2 top-1/2 hidden h-px w-4 bg-blue-300 lg:block"
                      aria-hidden
                    />
                  )}
                </article>
              </MotionReveal>
            </li>
          ))}
        </ol>
        <p className="mt-6 text-sm font-medium text-slate-600">{copy.overview.note}</p>
      </Container>
    </section>
  );
}

export function CoreAiSolutions({
  market,
  copy,
}: {
  market: Market;
  copy: HomeCopy;
}) {
  return (
    <section className="section-space bg-white" id="ai-solutions">
      <Container>
        <MotionReveal>
          <SectionHeading
            eyebrow={copy.coreSolutions.eyebrow}
            title={copy.coreSolutions.title}
            description={copy.coreSolutions.description}
          />
        </MotionReveal>
        <div className="mt-12 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {copy.coreSolutions.items.map((item, index) => (
            <HoverLift key={item.title}>
              <MotionReveal delay={(index % 3) * 0.05}>
                <Card className="flex h-full min-h-[220px] flex-col p-6">
                  <div className="flex items-start justify-between gap-3">
                    <span className="grid size-11 place-items-center rounded-2xl bg-blue-50 text-blue-700">
                      <Sparkles className="size-5" aria-hidden />
                    </span>
                    <span
                      className={cn(
                        "rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide",
                        item.status === "available"
                          ? "bg-emerald-50 text-emerald-800"
                          : "bg-slate-100 text-slate-600",
                      )}
                    >
                      {item.status === "available"
                        ? copy.coreSolutions.statusAvailable
                        : copy.coreSolutions.statusCapability}
                    </span>
                  </div>
                  <h3 className="mt-5 text-xl font-bold text-[var(--navy)]">
                    {item.title}
                  </h3>
                  <p className="mt-3 flex-1 leading-7 text-[var(--muted)]">{item.body}</p>
                </Card>
              </MotionReveal>
            </HoverLift>
          ))}
        </div>
        <div className="mt-8">
          <Button href={hrefFor(market, "ai")} variant="secondary">
            {copy.hero.primary}
          </Button>
        </div>
      </Container>
    </section>
  );
}

export function AnalysisCapabilities({ copy }: { copy: HomeCopy }) {
  return (
    <section className="section-space bg-[var(--navy)] text-white">
      <Container className="grid gap-10 lg:grid-cols-[0.9fr_1.1fr]">
        <MotionReveal>
          <Badge className="border-sky-400/20 bg-sky-400/10 text-sky-300">
            {copy.analysis.eyebrow}
          </Badge>
          <h2 className="mt-5 text-balance text-3xl font-bold tracking-[-0.04em] sm:text-4xl">
            {copy.analysis.title}
          </h2>
          <p className="mt-5 max-w-xl text-lg leading-8 text-slate-300">
            {copy.analysis.description}
          </p>
        </MotionReveal>
        <StaggerContainer className="grid gap-3 sm:grid-cols-2">
          {copy.analysis.items.map((item) => (
            <StaggerItem key={item}>
              <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-100">
                {item}
              </div>
            </StaggerItem>
          ))}
        </StaggerContainer>
      </Container>
    </section>
  );
}

export function BusinessIntelligenceSection({ copy }: { copy: HomeCopy }) {
  return (
    <section className="section-space bg-white">
      <Container className="grid gap-10 lg:grid-cols-[1.05fr_.95fr]">
        <MotionReveal>
          <SectionHeading
            eyebrow={copy.intelligence.eyebrow}
            title={copy.intelligence.title}
            description={copy.intelligence.description}
          />
          <ul className="mt-8 grid gap-2 sm:grid-cols-2">
            {copy.intelligence.signals.map((signal) => (
              <li
                key={signal}
                className="flex items-start gap-2 text-sm font-medium text-slate-700"
              >
                <Check className="mt-0.5 size-4 shrink-0 text-emerald-600" aria-hidden />
                {signal}
              </li>
            ))}
          </ul>
        </MotionReveal>
        <ScaleReveal>
          <Card className="p-6 sm:p-7">
            <Badge>{copy.intelligence.exampleLabel}</Badge>
            <dl className="mt-6 grid gap-3">
              {copy.intelligence.fields.map((field) => (
                <div
                  key={field.label}
                  className="grid gap-1 rounded-xl bg-[var(--soft)] px-4 py-3 sm:grid-cols-[0.9fr_1.1fr] sm:items-center"
                >
                  <dt className="text-xs font-bold uppercase tracking-wide text-slate-500">
                    {field.label}
                  </dt>
                  <dd className="font-semibold text-[var(--navy)]">{field.value}</dd>
                </div>
              ))}
            </dl>
          </Card>
        </ScaleReveal>
      </Container>
    </section>
  );
}

export function ServiceRecommendationSection({ copy }: { copy: HomeCopy }) {
  const [expanded, setExpanded] = useState(false);
  const visible = expanded
    ? copy.matching.categories
    : copy.matching.categories.slice(0, 6);

  return (
    <section className="section-space bg-[var(--soft)]">
      <Container>
        <MotionReveal>
          <SectionHeading
            eyebrow={copy.matching.eyebrow}
            title={copy.matching.title}
            description={copy.matching.description}
          />
        </MotionReveal>
        <div className="mt-10 grid gap-8 lg:grid-cols-[0.95fr_1.05fr]">
          <StaggerContainer className="grid gap-2 sm:grid-cols-2">
            {copy.matching.basis.map((item) => (
              <StaggerItem key={item}>
                <div className="rounded-xl border border-[var(--border)] bg-white px-4 py-3 text-sm font-semibold text-slate-700">
                  {item}
                </div>
              </StaggerItem>
            ))}
          </StaggerContainer>
          <Card className="p-6">
            <ul className="grid gap-2 sm:grid-cols-2">
              {visible.map((category) => (
                <li
                  key={category}
                  className="rounded-xl bg-blue-50 px-4 py-3 text-sm font-bold text-blue-950"
                >
                  {category}
                </li>
              ))}
            </ul>
            <Button
              type="button"
              variant="secondary"
              className="mt-5"
              onClick={() => setExpanded((value) => !value)}
              aria-expanded={expanded}
            >
              {expanded ? copy.matching.viewLess : copy.matching.viewMore}
            </Button>
          </Card>
        </div>
      </Container>
    </section>
  );
}

export function AutomationSection({ copy }: { copy: HomeCopy }) {
  return (
    <section className="section-space bg-white">
      <Container>
        <MotionReveal>
          <SectionHeading
            eyebrow={copy.automation.eyebrow}
            title={copy.automation.title}
            description={copy.automation.description}
          />
        </MotionReveal>
        <div className="mt-8 grid gap-4 md:grid-cols-3">
          {copy.automation.distinctions.map((item) => (
            <MotionReveal key={item.title}>
              <Card className="h-full p-6">
                <h3 className="text-lg font-bold text-[var(--navy)]">{item.title}</h3>
                <p className="mt-3 leading-7 text-[var(--muted)]">{item.body}</p>
              </Card>
            </MotionReveal>
          ))}
        </div>
        <StaggerContainer className="mt-8 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {copy.automation.items.map((item) => (
            <StaggerItem key={item}>
              <div className="rounded-xl border border-[var(--border)] bg-[var(--soft)] px-4 py-3 text-sm font-semibold text-slate-700">
                {item}
              </div>
            </StaggerItem>
          ))}
        </StaggerContainer>
      </Container>
    </section>
  );
}

export function IndustrySolutions({ copy }: { copy: HomeCopy }) {
  return (
    <section className="section-space bg-[var(--soft)]">
      <Container>
        <MotionReveal>
          <SectionHeading
            eyebrow={copy.industries.eyebrow}
            title={copy.industries.title}
            description={copy.industries.description}
          />
        </MotionReveal>
        <div className="mt-10">
          <Tabs
            items={copy.industries.items.map((industry) => ({
              label: industry.title,
              content: (
                <Card className="grid gap-6 p-7 md:grid-cols-2">
                  <div>
                    <h3 className="text-2xl font-bold text-[var(--navy)]">
                      {industry.title}
                    </h3>
                    <p className="mt-3 leading-7 text-[var(--muted)]">
                      {copy.industries.description}
                    </p>
                  </div>
                  <div className="grid gap-2">
                    {industry.solutions.map((solution) => (
                      <div
                        key={solution}
                        className="flex items-center gap-3 rounded-xl bg-blue-50 p-3 text-sm font-semibold text-blue-950"
                      >
                        <Check className="size-4 text-blue-600" aria-hidden />
                        {solution}
                      </div>
                    ))}
                  </div>
                </Card>
              ),
            }))}
          />
        </div>
      </Container>
    </section>
  );
}

export function MultilingualSection({ copy }: { copy: HomeCopy }) {
  const [active, setActive] = useState(0);
  const sample = copy.multilingual.demoSamples[active] ?? copy.multilingual.demoSamples[0]!;

  return (
    <section className="section-space bg-white">
      <Container className="grid gap-10 lg:grid-cols-2">
        <MotionReveal>
          <SectionHeading
            eyebrow={copy.multilingual.eyebrow}
            title={copy.multilingual.title}
            description={copy.multilingual.description}
          />
          <ul className="mt-8 grid gap-2">
            {copy.multilingual.points.map((point) => (
              <li
                key={point}
                className="flex items-start gap-2 text-sm font-medium text-slate-700"
              >
                <Check className="mt-0.5 size-4 shrink-0 text-emerald-600" aria-hidden />
                {point}
              </li>
            ))}
          </ul>
        </MotionReveal>
        <ScaleReveal>
          <Card className="p-6 sm:p-7">
            <p className="text-sm font-bold text-[var(--navy)]">
              {copy.multilingual.demoLabel}
            </p>
            <p className="mt-2 text-sm text-[var(--muted)]">
              {copy.multilingual.demoNote}
            </p>
            <div className="mt-5 flex flex-wrap gap-2" role="tablist" aria-label={copy.multilingual.demoLabel}>
              {copy.multilingual.demoSamples.map((item, index) => (
                <button
                  key={item.locale}
                  type="button"
                  role="tab"
                  aria-selected={active === index}
                  className={cn(
                    "min-h-11 rounded-full border px-4 text-sm font-semibold",
                    active === index
                      ? "border-blue-600 bg-blue-600 text-white"
                      : "border-[var(--border)] bg-white text-[var(--navy)]",
                  )}
                  onClick={() => setActive(index)}
                >
                  {item.label}
                </button>
              ))}
            </div>
            <p
              className="mt-6 rounded-2xl bg-[var(--soft)] p-5 text-lg font-semibold leading-8 text-[var(--navy)]"
              lang={sample.locale}
              dir={sample.locale === "ar" ? "rtl" : "ltr"}
            >
              {sample.sample}
            </p>
          </Card>
        </ScaleReveal>
      </Container>
    </section>
  );
}

export function SecuritySection({ copy }: { copy: HomeCopy }) {
  return (
    <section className="section-space bg-[var(--soft)]">
      <Container>
        <MotionReveal>
          <SectionHeading
            eyebrow={copy.security.eyebrow}
            title={copy.security.title}
            description={copy.security.description}
          />
        </MotionReveal>
        <StaggerContainer className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {copy.security.items.map((item) => (
            <StaggerItem key={item}>
              <div className="flex min-h-[88px] items-start gap-3 rounded-2xl border border-[var(--border)] bg-white p-4">
                <ShieldCheck className="mt-0.5 size-5 shrink-0 text-blue-700" aria-hidden />
                <span className="text-sm font-semibold text-slate-800">{item}</span>
              </div>
            </StaggerItem>
          ))}
        </StaggerContainer>
      </Container>
    </section>
  );
}

export function ExplorerSection({
  market,
  copy,
}: {
  market: Market;
  copy: HomeCopy;
}) {
  return (
    <section className="section-space bg-white">
      <Container>
        <SolutionExplorer market={market} copy={copy} />
      </Container>
    </section>
  );
}

export function WhyMiraajSection({ copy }: { copy: HomeCopy }) {
  return (
    <section className="section-space bg-[var(--soft)]">
      <Container>
        <MotionReveal>
          <SectionHeading
            eyebrow={copy.why.eyebrow}
            title={copy.why.title}
            description={copy.why.description}
          />
        </MotionReveal>
        <div className="mt-12 grid gap-4 md:grid-cols-2">
          {copy.why.items.map((item, index) => (
            <MotionReveal key={item.title} delay={(index % 2) * 0.05}>
              <Card className="h-full p-6">
                <h3 className="text-lg font-bold text-[var(--navy)]">{item.title}</h3>
                <p className="mt-3 leading-7 text-[var(--muted)]">{item.body}</p>
              </Card>
            </MotionReveal>
          ))}
        </div>
      </Container>
    </section>
  );
}

export function ImplementationSection({ copy }: { copy: HomeCopy }) {
  return (
    <section className="section-space bg-white" id="implementation">
      <Container>
        <MotionReveal>
          <SectionHeading
            eyebrow={copy.implementation.eyebrow}
            title={copy.implementation.title}
            description={copy.implementation.description}
          />
        </MotionReveal>
        <ol className="mt-12 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {copy.implementation.steps.map((step, index) => (
            <li key={step.title}>
              <MotionReveal delay={index * 0.05}>
                <article className="h-full rounded-2xl border border-[var(--border)] bg-[var(--soft)] p-6">
                  <span className="mb-5 grid size-9 place-items-center rounded-full bg-[var(--navy)] text-sm font-black text-white">
                    {index + 1}
                  </span>
                  <h3 className="font-bold text-[var(--navy)]">{step.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-[var(--muted)]">{step.body}</p>
                </article>
              </MotionReveal>
            </li>
          ))}
        </ol>
      </Container>
    </section>
  );
}

export function FinalCtaSection({
  market,
  copy,
}: {
  market: Market;
  copy: HomeCopy;
}) {
  return (
    <section className="section-space bg-[var(--soft)]">
      <Container>
        <MotionReveal>
          <div className="overflow-hidden rounded-[2rem] bg-gradient-to-br from-[var(--navy)] to-blue-800 p-7 text-white sm:p-12 lg:p-16">
            <h2 className="max-w-3xl text-balance text-3xl font-bold tracking-tight sm:text-5xl">
              {copy.finalCta.title}
            </h2>
            <p className="mt-5 max-w-2xl text-lg leading-8 text-blue-100">
              {copy.finalCta.description}
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button href={hrefFor(market, "quote")}>{copy.finalCta.primary}</Button>
              <Button href={hrefFor(market, "services")} variant="secondary">
                {copy.finalCta.secondary}
              </Button>
            </div>
          </div>
        </MotionReveal>
      </Container>
    </section>
  );
}
