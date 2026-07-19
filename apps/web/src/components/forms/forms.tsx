"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Check, ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { z } from "zod";
import { Button, Card, Field, inputClass } from "@/components/ui/core";
import { submitQuote } from "@/services/quote-service";

const quoteSchema = z.object({
  projectType: z.string().min(1, "Choose a project type"),
  projectState: z.string().min(1, "Choose the current project state"),
  goal: z.string().min(20, "Please describe the goal in at least 20 characters").max(2000),
  features: z.string().max(2000),
  targetMarket: z.string().min(2, "Add a target market"),
  languages: z.string().min(2, "Add at least one language"),
  timeline: z.string().min(1, "Choose a preferred timeline"),
  budget: z.string(),
  name: z.string().min(2).max(100),
  company: z.string().max(120),
  email: z.string().email(),
  phone: z.string().max(40),
  contactMethod: z.string().min(1),
  consent: z.literal(true, { error: "Consent is required" }),
});
type QuoteValues = z.infer<typeof quoteSchema>;
const defaultQuote: QuoteValues = { projectType: "", projectState: "", goal: "", features: "", targetMarket: "", languages: "", timeline: "", budget: "", name: "", company: "", email: "", phone: "", contactMethod: "email", consent: false as unknown as true };

const choiceClass = "flex min-h-12 cursor-pointer items-center gap-3 rounded-xl border border-[var(--border)] bg-white p-3 text-sm font-semibold has-[:checked]:border-blue-600 has-[:checked]:bg-blue-50";

export function QuoteForm() {
  const [step, setStep] = useState(0);
  const [feedback, setFeedback] = useState<{ ok: boolean; message: string } | null>(null);
  const { register, handleSubmit, control, reset, trigger, formState: { errors, isSubmitting } } = useForm<QuoteValues>({ resolver: zodResolver(quoteSchema), defaultValues: defaultQuote, mode: "onBlur" });
  const values = useWatch({ control });
  useEffect(() => {
    const saved = sessionStorage.getItem("miraaj_quote");
    if (saved) {
      try { reset(JSON.parse(saved) as QuoteValues); } catch { sessionStorage.removeItem("miraaj_quote"); }
    }
  }, [reset]);
  useEffect(() => {
    sessionStorage.setItem("miraaj_quote", JSON.stringify(values));
  }, [values]);
  async function next() {
    const fields: Array<Array<keyof QuoteValues>> = [["projectType"], ["projectState"], ["goal", "targetMarket", "languages", "timeline"], ["name", "email", "contactMethod", "consent"]];
    if (await trigger(fields[step] ?? [])) setStep((current) => Math.min(4, current + 1));
  }
  const onSubmit = handleSubmit(async (payload) => {
    const result = await submitQuote(payload);
    setFeedback(result);
    if (result.ok) sessionStorage.removeItem("miraaj_quote");
  });
  return (
    <Card className="p-5 sm:p-8">
      <div className="mb-8">
        <div className="flex justify-between text-xs font-bold text-slate-500"><span>Step {step + 1} of 5</span><span>{Math.round(((step + 1) / 5) * 100)}%</span></div>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-blue-600 transition-all" style={{ width: `${((step + 1) / 5) * 100}%` }} /></div>
      </div>
      <form onSubmit={onSubmit} noValidate>
        {step === 0 && <FormStep title="What would you like to build?"><ChoiceGrid name="projectType" options={["Website", "Web platform", "Mobile app", "Desktop application", "E-commerce", "AI solution", "Automation", "Payment integration", "Video", "Other"]} register={register} error={errors.projectType?.message} /></FormStep>}
        {step === 1 && <FormStep title="Where is the project today?"><ChoiceGrid name="projectState" options={["New project", "Existing project", "Redesign", "Fix or improve", "Unsure"]} register={register} error={errors.projectState?.message} /></FormStep>}
        {step === 2 && <FormStep title="Tell us about the project"><div className="grid gap-5"><Field label="Main goal" error={errors.goal?.message}><textarea {...register("goal")} rows={5} className={`${inputClass} py-3`} placeholder="What should this product help your business or users achieve?" /></Field><Field label="Important capabilities (optional)"><textarea {...register("features")} rows={3} className={`${inputClass} py-3`} /></Field><div className="grid gap-5 sm:grid-cols-2"><Field label="Target market" error={errors.targetMarket?.message}><input {...register("targetMarket")} className={inputClass} /></Field><Field label="Required languages" error={errors.languages?.message}><input {...register("languages")} className={inputClass} /></Field><Field label="Preferred timeline" error={errors.timeline?.message}><select {...register("timeline")} className={inputClass}><option value="">Choose</option><option>Flexible</option><option>1–3 months</option><option>3–6 months</option><option>6+ months</option></select></Field><Field label="Optional budget range"><select {...register("budget")} className={inputClass}><option value="">Prefer not to say</option><option>Exploring scope</option><option>Focused starter scope</option><option>Custom product investment</option><option>Continuous partnership</option></select></Field></div><Field label="Reference file (frontend preview only)"><input type="file" className={`${inputClass} py-2`} accept=".pdf,.doc,.docx,.png,.jpg,.jpeg" /><span className="text-xs font-normal text-slate-500">Files are not uploaded until a secure API is connected.</span></Field></div></FormStep>}
        {step === 3 && <FormStep title="How can we contact you?"><div className="grid gap-5 sm:grid-cols-2"><Field label="Name" error={errors.name?.message}><input {...register("name")} autoComplete="name" className={inputClass} /></Field><Field label="Company (optional)"><input {...register("company")} autoComplete="organization" className={inputClass} /></Field><Field label="Email" error={errors.email?.message}><input {...register("email")} type="email" autoComplete="email" className={inputClass} /></Field><Field label="Phone with country code"><input {...register("phone")} type="tel" autoComplete="tel" className={inputClass} /></Field><Field label="Preferred contact method"><select {...register("contactMethod")} className={inputClass}><option value="email">Email</option><option value="phone">Phone</option></select></Field><label className={`${choiceClass} sm:col-span-2`}><input type="checkbox" {...register("consent")} />I agree to the Privacy Policy for this inquiry.</label>{errors.consent && <p className="text-sm text-red-600 sm:col-span-2">{errors.consent.message}</p>}</div></FormStep>}
        {step === 4 && <FormStep title="Review your request"><div className="grid gap-3">{Object.entries(values).filter(([key]) => key !== "consent").map(([key, value]) => <div key={key} className="grid gap-1 rounded-xl bg-slate-50 p-4 sm:grid-cols-[160px_1fr]"><strong className="capitalize text-slate-600">{key.replace(/([A-Z])/g, " $1")}</strong><span className="break-words text-slate-800">{String(value || "Not provided")}</span></div>)}</div></FormStep>}
        {feedback && <p className={`mt-5 rounded-xl p-4 text-sm font-semibold ${feedback.ok ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-800"}`} role="status">{feedback.message}</p>}
        <div className="mt-8 flex justify-between gap-3">
          <Button type="button" variant="secondary" disabled={step === 0 || isSubmitting} onClick={() => setStep((current) => current - 1)}><ChevronLeft className="size-4 rtl:rotate-180" />Previous</Button>
          {step < 4 ? <Button type="button" onClick={next}>Next<ChevronRight className="size-4 rtl:rotate-180" /></Button> : <Button type="submit" disabled={isSubmitting}>{isSubmitting ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}Submit request</Button>}
        </div>
      </form>
    </Card>
  );
}

function FormStep({ title, children }: { title: string; children: React.ReactNode }) {
  return <fieldset><legend className="mb-6 text-2xl font-bold text-[var(--navy)]">{title}</legend>{children}</fieldset>;
}

function ChoiceGrid({ name, options, register, error }: { name: "projectType" | "projectState"; options: string[]; register: ReturnType<typeof useForm<QuoteValues>>["register"]; error?: string }) {
  return <><div className="grid gap-3 sm:grid-cols-2">{options.map((option) => <label key={option} className={choiceClass}><input type="radio" value={option} {...register(name)} />{option}</label>)}</div>{error && <p className="mt-3 text-sm font-medium text-red-600" role="alert">{error}</p>}</>;
}

const contactSchema = z.object({ name: z.string().min(2).max(100), email: z.string().email(), phone: z.string().max(40), country: z.string().min(2), company: z.string().max(120), subject: z.string().min(2), message: z.string().min(20).max(2000), method: z.string(), consent: z.literal(true, { error: "Consent is required" }) });
type ContactValues = z.infer<typeof contactSchema>;

export function ContactForm() {
  const [feedback, setFeedback] = useState<string | null>(null);
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<ContactValues>({ resolver: zodResolver(contactSchema), defaultValues: { method: "email", consent: false as unknown as true } });
  const submit = handleSubmit(async (payload) => {
    const result = await submitQuote({ type: "contact", ...payload });
    setFeedback(result.message);
  });
  return <Card className="p-5 sm:p-8"><form onSubmit={submit} className="grid gap-5 sm:grid-cols-2" noValidate><Field label="Name" error={errors.name?.message}><input {...register("name")} className={inputClass} /></Field><Field label="Email" error={errors.email?.message}><input {...register("email")} type="email" className={inputClass} /></Field><Field label="Phone"><input {...register("phone")} type="tel" className={inputClass} /></Field><Field label="Country" error={errors.country?.message}><input {...register("country")} className={inputClass} /></Field><Field label="Company"><input {...register("company")} className={inputClass} /></Field><Field label="Inquiry type"><select {...register("subject")} className={inputClass}><option value="">Choose</option><option>Business inquiry</option><option>Support inquiry</option><option>Partnership inquiry</option></select></Field><Field label="Message" error={errors.message?.message}><textarea {...register("message")} rows={6} className={`${inputClass} py-3 sm:col-span-2`} /></Field><Field label="Preferred contact method"><select {...register("method")} className={inputClass}><option value="email">Email</option><option value="phone">Phone</option></select></Field><label className={`${choiceClass} sm:col-span-2`}><input type="checkbox" {...register("consent")} />I agree to the Privacy Policy for this inquiry.</label>{errors.consent && <p className="text-sm text-red-600 sm:col-span-2">{errors.consent.message}</p>}{feedback && <p className="rounded-xl bg-blue-50 p-4 text-sm text-blue-900 sm:col-span-2" role="status">{feedback}</p>}<Button type="submit" disabled={isSubmitting} className="sm:col-span-2">{isSubmitting && <Loader2 className="size-4 animate-spin" />}Send inquiry</Button></form></Card>;
}

export function NewsletterForm() {
  return <form className="flex gap-2" onSubmit={(event) => event.preventDefault()}><label className="sr-only" htmlFor="newsletter-email">Email address</label><input id="newsletter-email" type="email" required placeholder="Email address" className={inputClass} /><Button type="submit">Subscribe</Button></form>;
}
