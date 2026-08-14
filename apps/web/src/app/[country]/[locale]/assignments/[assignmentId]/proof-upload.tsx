"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { PROOF_UPLOAD_TYPES as TYPES, participantProofState, validateProofFiles } from "./proof-upload-state";

type UploadFile = { file: File; id: string; progress: number; status: "ready" | "uploading" | "uploaded" | "failed"; error?: string };
type ProofStatus = { proofSubmissionId: string; status: string; evidenceRevision: number; revisionHistory: Array<{ revision: number; createdAt: string }>; additionalEvidenceRequest?: string; additionalEvidenceDeadline?: string; updatedAt: string };
type UploadSession = { proofSubmissionId: string; evidenceRevision?: number; evidence: Array<{ uploadUrl: string; evidenceId: string; contentType: string }> };
const copy = {
  ar: { title: "إرسال إثبات النشر", drop: "اسحب لقطات الشاشة هنا أو اختر الملفات", submit: "رفع وإرسال الإثبات", retry: "إعادة المحاولة", cancel: "إلغاء الرفع", refresh: "تحديث الحالة", group: "المجموعة المنشور فيها", url: "رابط المنشور (اختياري)", time: "وقت النشر", note: "ملاحظة (اختيارية)", empty: "اختر لقطة شاشة واحدة على الأقل.", invalid: "يُسمح بصور PNG وJPEG وWebP فقط، بحد أقصى 20 ميغابايت.", success: "تم إرسال الإثبات بأمان.", more: "إرسال أدلة إضافية" },
  en: { title: "Submit publication proof", drop: "Drag screenshots here or choose files", submit: "Upload and submit proof", retry: "Retry", cancel: "Cancel upload", refresh: "Refresh status", group: "Claimed group", url: "Post URL (optional)", time: "Publication time", note: "Note (optional)", empty: "Choose at least one screenshot.", invalid: "PNG, JPEG, and WebP images up to 20 MB are allowed.", success: "Proof submitted securely.", more: "Submit additional evidence" },
  fr: { title: "Envoyer la preuve de publication", drop: "Glissez les captures ici ou choisissez des fichiers", submit: "Téléverser et envoyer", retry: "Réessayer", cancel: "Annuler", refresh: "Actualiser le statut", group: "Groupe déclaré", url: "URL de la publication (facultatif)", time: "Heure de publication", note: "Note (facultative)", empty: "Choisissez au moins une capture.", invalid: "Images PNG, JPEG et WebP de 20 Mo maximum.", success: "Preuve envoyée en toute sécurité.", more: "Envoyer une preuve supplémentaire" },
} as const;

export function ProofUpload({ assignmentId, contextToken, locale, proofDeadline }: { assignmentId: string; contextToken: string; locale: string; proofDeadline: string }) {
  const language = (locale.startsWith("ar") ? "ar" : locale.startsWith("fr") ? "fr" : "en") as keyof typeof copy;
  const text = copy[language];
  const [files, setFiles] = useState<UploadFile[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [proof, setProof] = useState<ProofStatus | null>(null);
  const [form, setForm] = useState({ claimedGroupName: "", postUrl: "", claimedPublicationAt: "", userNote: "" });
  const requests = useRef<Map<string, XMLHttpRequest>>(new Map());
  const headers = useCallback((idempotency?: string) => ({ "content-type": "application/json", authorization: `Bearer ${contextToken}`, ...(idempotency ? { "idempotency-key": idempotency } : {}) }), [contextToken]);
  const addFiles = (incoming: FileList | File[]) => {
    setError("");
    const accepted = Array.from(incoming);
    if (validateProofFiles(accepted, files.length) !== "ok") { setError(text.invalid); return; }
    setFiles((current) => [...current, ...accepted.map((file) => ({ file, id: crypto.randomUUID(), progress: 0, status: "ready" as const }))]);
  };
  const request = useCallback(async <T,>(path: string, method = "GET", body?: unknown, idempotency?: string): Promise<T> => {
    const response = await fetch(`/api/campaign-task/${path}`, { method, cache: "no-store", headers: headers(idempotency), ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
    const value = await response.json() as T & { code?: string; message?: string };
    if (!response.ok) throw new Error(value.code ?? value.message ?? "REQUEST_FAILED");
    return value;
  }, [headers]);
  const upload = (item: UploadFile, target: string) => new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    requests.current.set(item.id, xhr);
    xhr.open("PUT", target); xhr.setRequestHeader("content-type", item.file.type);
    xhr.upload.onprogress = (event) => setFiles((current) => current.map((value) => value.id === item.id ? { ...value, status: "uploading", progress: event.lengthComputable ? Math.round(event.loaded / event.total * 100) : value.progress } : value));
    xhr.onload = () => { requests.current.delete(item.id); if (xhr.status >= 200 && xhr.status < 300) { setFiles((current) => current.map((value) => value.id === item.id ? { ...value, status: "uploaded", progress: 100 } : value)); resolve(); } else reject(new Error("UPLOAD_FAILED")); };
    xhr.onerror = () => reject(new Error("UPLOAD_NETWORK_ERROR"));
    xhr.onabort = () => reject(new Error("UPLOAD_CANCELLED"));
    xhr.send(item.file);
  });
  const submit = async () => {
    if (!files.length) { setError(text.empty); return; }
    if (Date.now() >= new Date(proofDeadline).getTime()) { setError("PROOF_DEADLINE_REACHED"); return; }
    setBusy(true); setError("");
    try {
      const body = { externalAssignmentId: assignmentId, screenshotCount: files.length, files: files.map(({ file }) => ({ fileName: file.name, contentType: file.type, contentLength: file.size })), ...form };
      const session = proof?.status === "more_evidence_required"
        ? await request<UploadSession>(`proofs/${proof.proofSubmissionId}/additional-evidence`, "POST", body)
        : await request<UploadSession>("proofs/upload-session", "POST", body, `browser-proof:${assignmentId}:${crypto.randomUUID()}`);
      await Promise.all(files.map((item, index) => upload(item, session.evidence[index]!.uploadUrl).catch((cause) => { setFiles((current) => current.map((value) => value.id === item.id ? { ...value, status: "failed", error: cause instanceof Error ? cause.message : "UPLOAD_FAILED" } : value)); throw cause; })));
      await request(`proofs/${session.proofSubmissionId}/complete`, "POST", {});
      setProof(await request<ProofStatus>(`proofs/${session.proofSubmissionId}/status`)); setFiles([]);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "UPLOAD_FAILED"); } finally { setBusy(false); }
  };
  const refresh = useCallback(async () => { if (proof) setProof(await request<ProofStatus>(`proofs/${proof.proofSubmissionId}/status`)); }, [proof, request]);
  useEffect(() => {
    if (!proof || ["verified", "rejected", "duplicate", "fraudulent", "cancelled"].includes(proof.status)) return;
    const timer = window.setInterval(() => void refresh(), 5_000); return () => window.clearInterval(timer);
  }, [proof, refresh]);
  return (
    <div dir={language === "ar" ? "rtl" : "ltr"} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="text-lg font-black">{text.title}</h2>
      {proof && <div className="mt-4 rounded-xl bg-blue-50 p-4"><p className="font-bold">{participantProofState(proof.status).replaceAll("_", " ")}</p><p className="text-sm text-slate-600">Revision {proof.evidenceRevision} · {new Date(proof.updatedAt).toLocaleString(locale)}</p>{proof.additionalEvidenceRequest && <p className="mt-2 text-sm">{proof.additionalEvidenceRequest}</p>}<ol className="mt-2 text-xs text-slate-500">{proof.revisionHistory.map((revision) => <li key={revision.revision}>Revision {revision.revision} · {new Date(revision.createdAt).toLocaleString(locale)}</li>)}</ol></div>}
      {(!proof || proof.status === "more_evidence_required") && <>
        <label onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); addFiles(event.dataTransfer.files); }} className="mt-4 block cursor-pointer rounded-xl border-2 border-dashed border-blue-200 p-6 text-center font-semibold text-blue-700">{text.drop}<input multiple accept={TYPES.join(",")} type="file" className="sr-only" onChange={(event) => event.target.files && addFiles(event.target.files)} /></label>
        <ul className="mt-3 space-y-2">{files.map((item) => <li key={item.id} className="rounded-lg bg-slate-50 p-3 text-sm"><div className="flex justify-between gap-2"><span className="truncate">{item.file.name}</span><button type="button" disabled={item.status === "uploading"} onClick={() => setFiles((current) => current.filter((value) => value.id !== item.id))}>×</button></div><div className="mt-2 h-2 overflow-hidden rounded bg-slate-200"><div className="h-full bg-blue-600" style={{ width: `${item.progress}%` }} /></div>{item.status === "failed" && <span className="text-red-700">{item.error}</span>}</li>)}</ul>
        <div className="mt-4 grid gap-3"><input className="rounded-lg border p-3" required placeholder={text.group} value={form.claimedGroupName} onChange={(event) => setForm({ ...form, claimedGroupName: event.target.value })} /><input className="rounded-lg border p-3" type="url" placeholder={text.url} value={form.postUrl} onChange={(event) => setForm({ ...form, postUrl: event.target.value })} /><input className="rounded-lg border p-3" type="datetime-local" aria-label={text.time} value={form.claimedPublicationAt} onChange={(event) => setForm({ ...form, claimedPublicationAt: event.target.value })} /><textarea className="rounded-lg border p-3" maxLength={1000} placeholder={text.note} value={form.userNote} onChange={(event) => setForm({ ...form, userNote: event.target.value })} /></div>
        <div className="mt-4 flex flex-wrap gap-2"><button disabled={busy} onClick={() => void submit()} className="rounded-lg bg-blue-700 px-4 py-3 font-bold text-white disabled:opacity-50">{proof ? text.more : text.submit}</button>{busy && <button onClick={() => { requests.current.forEach((xhr) => xhr.abort()); setBusy(false); }} className="rounded-lg border px-4 py-3">{text.cancel}</button>}</div>
      </>}
      {proof && <button onClick={() => void refresh()} className="mt-3 text-sm font-bold text-blue-700 underline">{text.refresh}</button>}
      {error && <p role="alert" className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-800">{error}</p>}
    </div>
  );
}
