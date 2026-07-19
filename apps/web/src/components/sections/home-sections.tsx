import Link from "next/link";
import { ArrowRight, Bot, Check, Clapperboard, Code2, CreditCard, Globe2, Layers3, LockKeyhole, Smartphone, Sparkles } from "lucide-react";
import type { Market } from "@/types";
import type { SiteCopy } from "@/i18n/content";
import { faqs, industries, paymentProviders, processSteps, projects, services } from "@/data/site";
import { localizedHref } from "@/lib/site";
import { Accordion, Tabs } from "@/components/ui/interactive";
import { Badge, Button, Card, Container, SectionHeading } from "@/components/ui/core";
import { ProductEcosystem } from "@/components/visuals/product-ecosystem";

const iconMap = { Globe2, Smartphone, Layers3, Sparkles, CreditCard, Clapperboard };
const primaryServices = [services[0], services[1], services[4], services[6], services[7], services[8]];

export function HomeHero({ market, copy }: { market: Market; copy: SiteCopy }) {
  const href = (path: string) => localizedHref(market.countryCode, market.locale, path);
  return (
    <section className="relative overflow-hidden border-b border-[var(--border)] bg-[radial-gradient(circle_at_75%_20%,#DDF4FF_0,transparent_38%),linear-gradient(#fff,#F8FAFD)]">
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,#176bff0a_1px,transparent_1px),linear-gradient(to_bottom,#176bff0a_1px,transparent_1px)] bg-[size:48px_48px] [mask-image:linear-gradient(to_bottom,black,transparent_85%)]" />
      <Container className="relative grid min-h-[720px] items-center gap-10 py-16 lg:grid-cols-[1.03fr_.97fr] lg:py-20">
        <div>
          <Badge>{copy.hero.eyebrow}</Badge>
          <h1 className="mt-6 max-w-3xl text-balance text-4xl font-extrabold leading-[1.08] tracking-[-0.055em] text-[var(--navy)] sm:text-6xl lg:text-7xl">{copy.hero.title}</h1>
          <p className="mt-6 max-w-2xl text-pretty text-lg leading-8 text-[var(--muted)] sm:text-xl">{copy.hero.description}</p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Button href={href("quote")} size="lg">{copy.hero.primary}<ArrowRight className="size-4 rtl:rotate-180" /></Button>
            <Button href={href("services")} variant="secondary" size="lg">{copy.hero.secondary}</Button>
          </div>
          <div className="mt-7 flex flex-wrap gap-x-5 gap-y-2 text-sm font-medium text-slate-600">
            {copy.hero.assurances.map((item) => <span key={item} className="flex items-center gap-2"><Check className="size-4 text-emerald-600" />{item}</span>)}
          </div>
        </div>
        <ProductEcosystem />
      </Container>
    </section>
  );
}

export function ServiceStrip({ market }: { market: Market }) {
  const labels = [["Web", "web-development"], ["Mobile", "mobile-app-development"], ["Desktop", "desktop-applications"], ["AI", "ai-solutions"], ["Automation", "scripts-automation"], ["Payments", "payment-integration"], ["Video", "video-production"]];
  return <div className="border-b border-[var(--border)] bg-white"><Container className="flex overflow-x-auto py-4">{labels.map(([label, slug]) => <Link key={label} href={localizedHref(market.countryCode, market.locale, `services/${slug}`)} className="flex min-h-10 min-w-max flex-1 items-center justify-center border-e border-[var(--border)] px-5 text-sm font-bold text-slate-600 last:border-0 hover:text-blue-700">{label}</Link>)}</Container></div>;
}

export function ServicesGrid({ market, copy }: { market: Market; copy: SiteCopy }) {
  return (
    <section className="section-space bg-white">
      <Container>
        <SectionHeading eyebrow="Build · Automate · Grow" title={copy.sections.build} description="One connected team for strategy, design, development, intelligent workflows, payments and creative production." />
        <div className="mt-12 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {primaryServices.map((service, index) => {
            if (!service) return null;
            const Icon = Object.values(iconMap)[index] ?? Code2;
            return (
              <Card key={service.slug} className="group flex min-h-[330px] flex-col p-6 transition hover:-translate-y-1 hover:border-blue-200 hover:shadow-xl sm:p-7">
                <span className="grid size-12 place-items-center rounded-2xl bg-blue-50 text-blue-700"><Icon className="size-6" /></span>
                <h3 className="mt-6 text-2xl font-bold tracking-tight text-[var(--navy)]">{service.title}</h3>
                <p className="mt-3 leading-7 text-[var(--muted)]">{service.description}</p>
                <ul className="mt-5 grid gap-2 text-sm font-medium text-slate-600">{service.capabilities.map((item) => <li key={item} className="flex gap-2"><Check className="mt-0.5 size-4 shrink-0 text-emerald-600" />{item}</li>)}</ul>
                <Link href={localizedHref(market.countryCode, market.locale, `services/${service.slug}`)} className="mt-auto inline-flex items-center gap-2 pt-6 text-sm font-bold text-blue-700">{copy.common.learnMore}<ArrowRight className="size-4 rtl:rotate-180" /></Link>
              </Card>
            );
          })}
        </div>
      </Container>
    </section>
  );
}

export function ProcessSection({ copy }: { copy: SiteCopy }) {
  return (
    <section className="section-space bg-[var(--soft)]">
      <Container>
        <SectionHeading eyebrow="A clear path" title={copy.sections.process} description="You bring the goal. We turn it into decisions, visible progress and a product ready to use." />
        <ol className="mt-12 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {processSteps.slice(0, 6).map(([title, description], index) => <li key={title} className="relative rounded-2xl border border-[var(--border)] bg-white p-6"><span className="mb-5 grid size-9 place-items-center rounded-full bg-[var(--navy)] text-sm font-black text-white">{index + 1}</span><h3 className="font-bold text-[var(--navy)]">{title}</h3><p className="mt-2 text-sm leading-6 text-[var(--muted)]">{description}</p></li>)}
        </ol>
      </Container>
    </section>
  );
}

export function AiShowcase({ market, copy }: { market: Market; copy: SiteCopy }) {
  const items = ["Customer assistants", "Internal knowledge", "Document analysis", "Workflow automation", "Recommendations", "Content assistance", "AI search", "Custom integrations"];
  return (
    <section className="section-space overflow-hidden bg-[var(--navy)] text-white">
      <Container className="grid items-center gap-12 lg:grid-cols-2">
        <div>
          <Badge className="border-sky-400/20 bg-sky-400/10 text-sky-300">Practical AI</Badge>
          <h2 className="mt-5 text-balance text-3xl font-bold tracking-[-0.04em] sm:text-5xl">{copy.sections.ai}</h2>
          <p className="mt-5 max-w-xl text-lg leading-8 text-slate-300">We connect useful AI capabilities to approved knowledge, real workflows and clear human review points.</p>
          <div className="mt-7 grid grid-cols-2 gap-3">{items.map((item) => <div key={item} className="flex items-center gap-2 text-sm text-slate-200"><Sparkles className="size-4 shrink-0 text-sky-400" />{item}</div>)}</div>
          <Button href={localizedHref(market.countryCode, market.locale, "ai")} className="mt-8">Explore AI solutions</Button>
        </div>
        <div className="rounded-[2rem] border border-white/10 bg-white/5 p-4 shadow-2xl backdrop-blur sm:p-6">
          <div className="rounded-2xl bg-white p-5 text-slate-800">
            <div className="flex items-center gap-3 border-b border-slate-100 pb-4"><span className="grid size-10 place-items-center rounded-xl bg-violet-100 text-violet-700"><Bot /></span><span><strong className="block">Knowledge assistant</strong><small className="text-slate-500">Uses approved sources</small></span></div>
            <div className="mt-5 max-w-[85%] rounded-2xl rounded-es-sm bg-slate-100 p-4 text-sm">Summarize the latest onboarding process and flag missing steps.</div>
            <div className="mt-3 ms-auto max-w-[90%] rounded-2xl rounded-ee-sm bg-blue-600 p-4 text-sm text-white">I found the approved process. Two ownership fields still need confirmation before publishing.</div>
            <div className="mt-5 flex items-center justify-between rounded-xl border border-slate-200 p-3 text-xs text-slate-500"><span>3 verified sources</span><span className="text-emerald-700">Human review enabled</span></div>
          </div>
        </div>
      </Container>
    </section>
  );
}

export function PaymentShowcase({ market, copy }: { market: Market; copy: SiteCopy }) {
  return (
    <section className="section-space bg-white">
      <Container className="grid items-center gap-10 lg:grid-cols-[1.05fr_.95fr]">
        <div>
          <SectionHeading eyebrow="Payment experiences" title={copy.sections.payments} description="We help you choose and integrate payment providers suitable for your company's country and activity, with a clear and secure checkout experience." />
          <div className="mt-7 flex flex-wrap gap-2">{paymentProviders.map((provider) => <span key={provider.name} className="rounded-full border border-[var(--border)] bg-white px-4 py-2 text-sm font-bold text-slate-700 shadow-sm">{provider.name}</span>)}</div>
          <p className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900"><LockKeyhole className="me-2 inline size-4" />Provider availability and account approval depend on company country, business activity, documentation and the provider&apos;s verification and compliance requirements.</p>
          <Button href={localizedHref(market.countryCode, market.locale, "payments")} variant="secondary" className="mt-6">Payment integration details</Button>
        </div>
        <div className="rounded-[2rem] bg-gradient-to-br from-blue-600 to-cyan-400 p-6 shadow-2xl">
          <div className="rounded-2xl bg-white p-6">
            <p className="text-xs font-bold uppercase tracking-widest text-slate-400">Secure checkout</p>
            <div className="my-5 h-px bg-slate-100" />
            <div className="grid gap-3"><div className="h-12 rounded-xl bg-slate-100" /><div className="grid grid-cols-2 gap-3"><div className="h-12 rounded-xl bg-slate-100" /><div className="h-12 rounded-xl bg-slate-100" /></div><div className="mt-2 flex h-13 items-center justify-center rounded-xl bg-[var(--navy)] font-bold text-white">Complete payment</div></div>
            <p className="mt-4 flex items-center justify-center gap-2 text-xs text-slate-500"><LockKeyhole className="size-3" />Provider requirements respected</p>
          </div>
        </div>
      </Container>
    </section>
  );
}

export function SolutionsWorkAndWhy({ market, copy }: { market: Market; copy: SiteCopy }) {
  return (
    <>
      <section className="section-space bg-[var(--soft)]"><Container><SectionHeading title={copy.sections.solutions} description="Select a business context to see a focused combination of product, technology and support." /><div className="mt-10"><Tabs items={industries.map((industry) => ({ label: industry.title, content: <Card className="grid gap-6 p-7 md:grid-cols-2"><div><h3 className="text-2xl font-bold text-[var(--navy)]">{industry.title}</h3><p className="mt-3 leading-7 text-[var(--muted)]">{industry.description}</p></div><div className="grid gap-2">{industry.solutions.map((solution) => <div key={solution} className="flex items-center gap-3 rounded-xl bg-blue-50 p-3 text-sm font-semibold text-blue-950"><Check className="size-4 text-blue-600" />{solution}</div>)}</div></Card> }))} /></div></Container></section>
      <section className="section-space bg-white"><Container><div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end"><SectionHeading eyebrow="Selected work" title={copy.sections.work} description="Original concept projects used to demonstrate our approach. They are not presented as client work." /><Button href={localizedHref(market.countryCode, market.locale, "work")} variant="secondary">View all concepts</Button></div><div className="mt-10 grid gap-6 md:grid-cols-2">{projects.map((project) => <Card key={project.slug} className="overflow-hidden"><div className={`aspect-[1.8] bg-gradient-to-br ${project.accent} p-7`}><div className="h-full rounded-2xl border border-white/30 bg-white/20 p-4 backdrop-blur"><div className="h-5 w-24 rounded-full bg-white/60" /><div className="mt-5 grid grid-cols-[.7fr_1.3fr] gap-3"><div className="h-28 rounded-xl bg-slate-900/70" /><div className="h-28 rounded-xl bg-white/70" /></div></div></div><div className="p-6"><Badge>{copy.common.concept}</Badge><h3 className="mt-4 text-2xl font-bold text-[var(--navy)]">{project.name}</h3><p className="mt-2 leading-7 text-[var(--muted)]">{project.summary}</p><p className="mt-4 text-sm font-semibold text-blue-700">{project.services.join(" · ")}</p></div></Card>)}</div></Container></section>
      <section className="section-space border-y border-[var(--border)] bg-white"><Container className="grid gap-10 lg:grid-cols-2"><SectionHeading title={copy.sections.why} description="We build the technology around your business instead of forcing your business into a generic template." /><div className="grid gap-3">{["A solution shaped around the real need", "Clear communication without technical noise", "Design, development and testing in one path", "Architecture ready to grow", "Support after launch", "A localized experience for every market"].map((item) => <div key={item} className="flex items-center gap-3 rounded-2xl bg-[var(--soft)] p-4 font-semibold text-[var(--navy)]"><Check className="size-5 text-emerald-600" />{item}</div>)}</div></Container></section>
    </>
  );
}

export function FinalCtaAndFaq({ market, copy }: { market: Market; copy: SiteCopy }) {
  return (
    <>
      <section className="section-space bg-[var(--soft)]"><Container><div className="overflow-hidden rounded-[2rem] bg-gradient-to-br from-[var(--navy)] to-blue-800 p-7 text-white sm:p-12 lg:p-16"><h2 className="max-w-3xl text-balance text-3xl font-bold tracking-tight sm:text-5xl">Have an idea and not sure where to begin?</h2><p className="mt-5 max-w-2xl text-lg leading-8 text-blue-100">Send it as it is. We will help turn it into clear requirements and an actionable delivery plan.</p><div className="mt-8 flex flex-wrap gap-3"><Button href={localizedHref(market.countryCode, market.locale, "contact")}>{copy.common.contact}</Button><Button href={localizedHref(market.countryCode, market.locale, "quote")} variant="secondary">{copy.common.quote}</Button></div></div></Container></section>
      <section className="section-space bg-white"><Container className="grid gap-10 lg:grid-cols-[.8fr_1.2fr]"><SectionHeading title={copy.sections.faq} description="No specification is required to start a useful conversation." /><Accordion items={faqs.slice(0, 6).map(({ question, answer }) => ({ question, answer }))} /></Container></section>
    </>
  );
}
