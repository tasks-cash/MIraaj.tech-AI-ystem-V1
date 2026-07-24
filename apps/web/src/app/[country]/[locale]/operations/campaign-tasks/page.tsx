import Link from "next/link";
import { notFound } from "next/navigation";
import { campaignTaskApi, type CampaignTaskView } from "@/lib/campaign-task-api";
import { createCampaignTask } from "./actions";

const labels = {
  ar: { eyebrow: "عمليات التوزيع", title: "مهام الحملات", intro: "إدارة مهام النشر، الاستهداف، السعة، والإثبات بدون أي عمليات مالية.", create: "إنشاء مهمة", empty: "لا توجد مهام لهذا المستأجر.", mode: "الوضع", capacity: "السعة" },
  fr: { eyebrow: "Opérations de distribution", title: "Tâches de campagne", intro: "Gérez la publication, le ciblage, la capacité et les preuves sans opérations financières.", create: "Créer la tâche", empty: "Aucune tâche pour ce locataire.", mode: "Mode", capacity: "Capacité" },
  en: { eyebrow: "Distribution operations", title: "Campaign tasks", intro: "Manage publishing, targeting, capacity and proof without financial operations.", create: "Create task", empty: "No tasks exist for this tenant.", mode: "Mode", capacity: "Capacity" },
};

export default async function CampaignTasksPage({
  params,
  searchParams,
}: {
  params: Promise<{ country: string; locale: string }>;
  searchParams: Promise<{ tenant?: string }>;
}) {
  if (process.env.CAMPAIGN_TASK_ADMIN_UI_ENABLED === "false") notFound();
  const { country, locale } = await params;
  const { tenant = "internal-pilot" } = await searchParams;
  const copy = labels[locale as keyof typeof labels] ?? labels.en;
  let tasks: CampaignTaskView[] = [];
  let error = "";
  try { tasks = await campaignTaskApi("/api/admin/ai/campaign-tasks", { tenantId: tenant }); }
  catch (caught) { error = caught instanceof Error ? caught.message : "Campaign task API unavailable."; }
  return (
    <section className="min-h-screen bg-slate-50 px-5 py-16">
      <div className="mx-auto max-w-7xl">
        <p className="text-sm font-bold uppercase tracking-[.18em] text-blue-600">{copy.eyebrow}</p>
        <h1 className="mt-3 text-4xl font-black text-slate-950">{copy.title}</h1>
        <p className="mt-4 max-w-3xl text-lg leading-8 text-slate-600">{copy.intro}</p>
        {error ? <p role="alert" className="mt-6 rounded-xl border border-amber-300 bg-amber-50 p-4 text-amber-950">{error}</p> : null}
        <div className="mt-10 grid gap-5 lg:grid-cols-3">
          {tasks.map((task) => (
            <Link key={task.publicId} href={`/${country}/${locale}/operations/campaign-tasks/${task.publicId}?tenant=${encodeURIComponent(tenant)}`} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-lg">
              <div className="flex items-center justify-between gap-4"><span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-blue-700">{task.status}</span><span className="text-xs text-slate-500">{task.platform}</span></div>
              <h2 className="mt-5 text-xl font-extrabold text-slate-950">{task.publicTitle}</h2>
              <p className="mt-2 line-clamp-3 text-sm leading-6 text-slate-600">{task.description}</p>
              <dl className="mt-5 grid grid-cols-2 gap-3 text-sm"><div><dt className="text-slate-500">{copy.mode}</dt><dd className="font-semibold">{task.taskMode}</dd></div><div><dt className="text-slate-500">{copy.capacity}</dt><dd className="font-semibold">{task.activeAssignmentCount}/{task.totalCapacity}</dd></div></dl>
            </Link>
          ))}
          {!tasks.length && !error ? <p className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-slate-600">{copy.empty}</p> : null}
        </div>
        <details className="mt-12 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <summary className="text-xl font-extrabold text-slate-950">{copy.create}</summary>
          <form action={createCampaignTask} className="mt-6 grid gap-4 md:grid-cols-2">
            <input type="hidden" name="country" value={country} /><input type="hidden" name="locale" value={locale} /><input type="hidden" name="tenantId" value={tenant} />
            {[
              ["internalName", "Internal name"], ["publicTitle", "Public title"], ["campaignId", "Approved campaign ID"],
              ["templateId", "Active template ID"], ["approvedCopyVariantIds", "Approved copy IDs (comma separated)"], ["targetUrl", "HTTPS target URL"],
              ["platform", "Platform"], ["publicationType", "Publication type"], ["countryAllowlist", "Countries"],
              ["languageAllowlist", "Languages"], ["locales", "Locales"], ["professionAllowlist", "Professions"],
              ["industryAllowlist", "Industries"], ["audienceSegments", "Audience segments"], ["communityType", "Community type"],
              ["communityRules", "Community rules"], ["requiredDisclosure", "Required disclosure"],
            ].map(([name, placeholder]) => <label key={name} className="grid gap-1 text-sm font-semibold text-slate-700"><span>{placeholder}</span><input required={["internalName", "publicTitle", "campaignId", "templateId", "approvedCopyVariantIds", "targetUrl", "platform", "publicationType", "communityType"].includes(name)} name={name} className="rounded-lg border border-slate-300 px-3 py-2" /></label>)}
            <label className="grid gap-1 text-sm font-semibold"><span>Mode</span><select name="taskMode" className="rounded-lg border border-slate-300 px-3 py-2">{["general", "targeted", "private", "invite_only", "pilot", "manual_assignment", "limited_capacity", "recurring"].map((mode) => <option key={mode}>{mode}</option>)}</select></label>
            <label className="grid gap-1 text-sm font-semibold"><span>Review policy</span><select name="humanReviewPolicy" className="rounded-lg border border-slate-300 px-3 py-2"><option>always</option><option>risk_based</option><option>never</option></select></label>
            {[["campaignRevision", 1], ["templateRevision", 1], ["assignmentDurationMinutes", 1440], ["proofDeadlineMinutes", 1440], ["totalCapacity", 10], ["perParticipantLimit", 1], ["dailyParticipantLimit", 1]].map(([name, value]) => <label key={String(name)} className="grid gap-1 text-sm font-semibold"><span>{name}</span><input name={String(name)} type="number" min="1" defaultValue={value} className="rounded-lg border border-slate-300 px-3 py-2" /></label>)}
            <label className="grid gap-1 md:col-span-2 text-sm font-semibold"><span>Description</span><textarea required name="description" rows={3} className="rounded-lg border border-slate-300 px-3 py-2" /></label>
            <label className="grid gap-1 md:col-span-2 text-sm font-semibold"><span>Instructions</span><textarea required name="instructions" rows={4} className="rounded-lg border border-slate-300 px-3 py-2" /></label>
            <button className="rounded-xl bg-blue-600 px-5 py-3 font-bold text-white shadow-lg shadow-blue-200 hover:bg-blue-700">{copy.create}</button>
          </form>
        </details>
      </div>
    </section>
  );
}
