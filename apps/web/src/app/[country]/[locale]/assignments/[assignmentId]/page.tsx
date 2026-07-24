import Image from "next/image";
import { requireCampaignTaskOperator } from "@/lib/campaign-task-auth";
import { campaignTaskApi, type AssignmentPackageView } from "@/lib/campaign-task-api";

export default async function AssignmentPortal({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; assignmentId: string }>;
  searchParams: Promise<{ tenant?: string; participant?: string }>;
}) {
  await requireCampaignTaskOperator("participant");
  const { locale, assignmentId } = await params;
  const { tenant = "internal-pilot", participant = "" } = await searchParams;
  const assignment = await campaignTaskApi<AssignmentPackageView>(`/api/ai/distribution/assignments/${assignmentId}`, { tenantId: tenant, participantId: participant });
  return (
    <section className="min-h-screen bg-slate-50 px-5 py-16">
      <div className="mx-auto max-w-6xl">
        <p className="text-sm font-bold uppercase tracking-[.18em] text-blue-600">Assignment workspace</p>
        <div className="mt-4 flex flex-wrap items-end justify-between gap-4"><div><h1 className="text-4xl font-black text-slate-950">{assignment.headline}</h1><p className="mt-2 text-slate-500">{assignment.platform} · {assignment.targetAudience} · {assignment.status}</p></div><p className="rounded-xl bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-900">Proof due {new Date(assignment.proofDeadline).toLocaleString(locale)}</p></div>
        <div className="mt-10 grid gap-8 lg:grid-cols-[1.3fr_.7fr]">
          <article className="space-y-6">
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"><h2 className="text-xl font-black">Approved publication content</h2><p dir="auto" className="mt-4 whitespace-pre-wrap text-lg leading-9 text-slate-800">{assignment.approvedPostText}</p><p className="mt-4 font-bold text-blue-700">{assignment.cta}</p><p className="mt-2 text-sm text-slate-600">{assignment.hashtags.join(" ")}</p></div>
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"><h2 className="text-xl font-black">Publication requirements</h2><p className="mt-4 font-semibold">{assignment.requiredDisclosure}</p><p className="mt-3 text-slate-600">{assignment.postingInstructions}</p><ul className="mt-4 list-inside list-disc text-slate-600">{assignment.communityRules.map((rule) => <li key={rule}>{rule}</li>)}</ul><p className="mt-4 rounded-lg bg-slate-100 p-3 font-mono text-sm">{assignment.proofMarker}</p></div>
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"><h2 className="text-xl font-black">Tracked destination</h2><a className="mt-4 block break-all font-bold text-blue-700 underline" href={assignment.uniqueTrackedLink} rel="noreferrer" target="_blank">{assignment.uniqueTrackedLink}</a></div>
          </article>
          <aside className="space-y-6">
            <a href={assignment.qrDownloadUrl} className="block rounded-2xl border border-slate-200 bg-white p-5 text-center shadow-sm"><Image unoptimized width={768} height={768} alt="Unique assignment QR code" src={assignment.qrDownloadUrl} className="mx-auto aspect-square w-full max-w-72 object-contain" /><span className="mt-3 block font-bold text-blue-700">Download QR</span></a>
            <a href={assignment.headerDownloadUrl} className="block rounded-2xl border border-slate-200 bg-white p-5 text-center shadow-sm"><Image unoptimized width={1200} height={630} alt="Approved branded campaign header" src={assignment.headerDownloadUrl} className="h-auto w-full rounded-lg object-contain" /><span className="mt-3 block font-bold text-blue-700">Download header</span></a>
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><h2 className="font-black">Evidence</h2><p className="mt-2 text-sm leading-6 text-slate-600">Use the protected proof upload endpoint. Screenshots remain in private Miraaj storage and download links expire.</p><pre className="mt-3 overflow-auto rounded-lg bg-slate-100 p-3 text-xs">{JSON.stringify(assignment.screenshotRequirements, null, 2)}</pre></div>
          </aside>
        </div>
      </div>
    </section>
  );
}
