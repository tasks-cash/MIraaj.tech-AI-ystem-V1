import Link from "next/link";
import { notFound } from "next/navigation";
import { campaignTaskApi, type CampaignTaskView } from "@/lib/campaign-task-api";
import { reviewCampaignProof, transitionCampaignTask } from "../actions";

interface Statistics {
  capacity: { total: number; used: number; remaining: number; byCountry: Record<string, number> };
  reservations: Record<string, number>;
  invitations: Record<string, number>;
  assignments: Record<string, number>;
}
interface Assignment { externalAssignmentId: string; externalUserId: string; status: string; country: string; language: string; proofDeadlineAt: string }
interface Proof { proofSubmissionId: string; externalUserId: string; status: string; evidenceRevision: number; submittedAt?: string; latestAttempt?: { decision: string; reasonCodes: string[]; scores: Record<string, number> } }

export default async function CampaignTaskDetail({
  params,
  searchParams,
}: {
  params: Promise<{ country: string; locale: string; taskId: string }>;
  searchParams: Promise<{ tenant?: string }>;
}) {
  if (process.env.CAMPAIGN_TASK_ADMIN_UI_ENABLED === "false") notFound();
  const { country, locale, taskId } = await params;
  const { tenant = "internal-pilot" } = await searchParams;
  const [task, statistics, assignments, proofs] = await Promise.all([
    campaignTaskApi<CampaignTaskView>(`/api/admin/ai/campaign-tasks/${taskId}`, { tenantId: tenant }),
    campaignTaskApi<Statistics>(`/api/admin/ai/campaign-tasks/${taskId}/statistics`, { tenantId: tenant }),
    campaignTaskApi<Assignment[]>(`/api/admin/ai/campaign-tasks/${taskId}/assignments`, { tenantId: tenant }),
    campaignTaskApi<Proof[]>(`/api/admin/ai/campaign-tasks/${taskId}/proofs`, { tenantId: tenant }),
  ]);
  const transitions = task.status === "draft" ? ["submit-review", "cancel"] : task.status === "awaiting_review" ? ["approve", "cancel"] : task.status === "approved" ? ["schedule", "activate", "cancel", "archive"] : task.status === "active" ? ["pause", "complete", "cancel"] : task.status === "paused" ? ["resume", "complete", "cancel"] : ["archive"];
  return (
    <section className="min-h-screen bg-slate-50 px-5 py-16">
      <div className="mx-auto max-w-7xl">
        <Link href={`/${country}/${locale}/operations/campaign-tasks?tenant=${encodeURIComponent(tenant)}`} className="font-bold text-blue-700">← Campaign tasks</Link>
        <div className="mt-6 rounded-3xl bg-slate-950 p-8 text-white shadow-xl">
          <div className="flex flex-wrap items-center gap-3"><span className="rounded-full bg-blue-500/20 px-3 py-1 text-sm font-bold text-blue-200">{task.status}</span><span className="text-slate-400">{task.taskMode} · {task.platform}</span></div>
          <h1 className="mt-5 text-4xl font-black">{task.publicTitle}</h1>
          <p className="mt-4 max-w-3xl text-lg leading-8 text-slate-300">{task.description}</p>
          <div className="mt-8 grid gap-4 sm:grid-cols-3">
            {[["Used", statistics.capacity.used], ["Remaining", statistics.capacity.remaining], ["Total", statistics.capacity.total]].map(([label, value]) => <div key={label} className="rounded-2xl bg-white/10 p-4"><p className="text-sm text-slate-300">{label}</p><p className="mt-1 text-3xl font-black">{value}</p></div>)}
          </div>
        </div>
        <div className="mt-8 grid gap-8 lg:grid-cols-[2fr_1fr]">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-2xl font-black">Assignments</h2>
            <div className="mt-5 overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr className="border-b text-slate-500"><th className="py-3">Participant</th><th>Status</th><th>Market</th><th>Deadline</th><th /></tr></thead><tbody>{assignments.map((assignment) => <tr key={assignment.externalAssignmentId} className="border-b border-slate-100"><td className="py-4 font-mono text-xs">{assignment.externalUserId}</td><td>{assignment.status}</td><td>{assignment.country} / {assignment.language}</td><td>{new Date(assignment.proofDeadlineAt).toLocaleString(locale)}</td><td><Link className="font-bold text-blue-700" href={`/${country}/${locale}/assignments/${assignment.externalAssignmentId}?tenant=${encodeURIComponent(tenant)}&participant=${encodeURIComponent(assignment.externalUserId)}`}>Open</Link></td></tr>)}</tbody></table></div>
            {!assignments.length ? <p className="mt-5 text-slate-500">No assignments have been created.</p> : null}
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-2xl font-black">Proof review queue</h2>
            <div className="mt-5 space-y-4">{proofs.map((proof) => <article key={proof.proofSubmissionId} className="rounded-xl border border-slate-200 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3"><div><p className="font-mono text-xs text-slate-500">{proof.proofSubmissionId}</p><p className="mt-1 font-bold">{proof.externalUserId} · revision {proof.evidenceRevision}</p></div><span className="rounded-full bg-amber-50 px-3 py-1 text-sm font-bold text-amber-800">{proof.status}</span></div>
              {proof.latestAttempt ? <pre className="mt-3 overflow-auto rounded-lg bg-slate-100 p-3 text-xs">{JSON.stringify({ decision: proof.latestAttempt.decision, reasons: proof.latestAttempt.reasonCodes, scores: proof.latestAttempt.scores }, null, 2)}</pre> : null}
              {proof.status === "needs_review" ? <form action={reviewCampaignProof} className="mt-4 grid gap-3 sm:grid-cols-[1fr_2fr_auto]">
                <input type="hidden" name="country" value={country} /><input type="hidden" name="locale" value={locale} /><input type="hidden" name="tenantId" value={tenant} /><input type="hidden" name="taskId" value={taskId} /><input type="hidden" name="proofId" value={proof.proofSubmissionId} /><input type="hidden" name="evidenceRevision" value={proof.evidenceRevision} /><input type="hidden" name="idempotencyKey" value={`review:${proof.proofSubmissionId}:${proof.evidenceRevision}`} />
                <select name="decision" className="rounded-lg border border-slate-300 px-3 py-2"><option>verified</option><option>rejected</option><option>request_more_evidence</option><option>duplicate</option><option>fraudulent</option></select>
                <input required name="reason" placeholder="Mandatory review reason" className="rounded-lg border border-slate-300 px-3 py-2" />
                <button className="rounded-lg bg-slate-950 px-4 py-2 font-bold text-white">Review</button>
              </form> : null}
            </article>)}</div>
            {!proofs.length ? <p className="mt-5 text-slate-500">No proof submissions are linked to this task.</p> : null}
          </div>
          <aside className="space-y-6">
            <form action={transitionCampaignTask} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="text-xl font-black">Lifecycle control</h2>
              <input type="hidden" name="country" value={country} /><input type="hidden" name="locale" value={locale} /><input type="hidden" name="tenantId" value={tenant} /><input type="hidden" name="taskId" value={taskId} /><input type="hidden" name="revision" value={task.currentRevision} />
              <label className="mt-4 grid gap-1 text-sm font-semibold"><span>Action</span><select name="transition" className="rounded-lg border border-slate-300 px-3 py-2">{transitions.map((value) => <option key={value}>{value}</option>)}</select></label>
              <label className="mt-4 grid gap-1 text-sm font-semibold"><span>Mandatory reason</span><textarea required name="reason" rows={3} className="rounded-lg border border-slate-300 px-3 py-2" /></label>
              <button className="mt-4 w-full rounded-xl bg-blue-600 px-4 py-3 font-bold text-white">Apply transition</button>
            </form>
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"><h2 className="text-xl font-black">Operational counts</h2>{[["Reservations", statistics.reservations], ["Invitations", statistics.invitations], ["Assignments", statistics.assignments]].map(([label, values]) => <div key={label as string} className="mt-4"><h3 className="font-bold">{label as string}</h3><pre className="mt-2 overflow-auto rounded-lg bg-slate-100 p-3 text-xs">{JSON.stringify(values, null, 2)}</pre></div>)}</div>
          </aside>
        </div>
      </div>
    </section>
  );
}
