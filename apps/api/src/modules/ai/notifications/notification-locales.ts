export type SupportedLanguage = "ar" | "en" | "fr";

const defaultLanguage: SupportedLanguage = "en";

const dictionaries: Record<SupportedLanguage, Record<string, { title: string; message: string }>> = {
  ar: {
    "notifications.private_task_invitation": { title: "دعوة مهمة خاصة", message: "لديك دعوة للمهمة {{taskId}}." },
    "notifications.invitation_expiring": { title: "الدعوة تنتهي قريباً", message: "دعوتك للمهمة {{taskId}} تنتهي قريباً." },
    "notifications.invitation_cancelled": { title: "تم إلغاء الدعوة", message: "تم إلغاء دعوتك للمهمة {{taskId}}." },
    "notifications.assignment_ready": { title: "المهمة جاهزة", message: "تم تخصيص المهمة {{assignmentId}} لك." },
    "notifications.assignment_cancelled": { title: "تم إلغاء المهمة", message: "تم إلغاء المهمة {{assignmentId}}." },
    "notifications.assignment_expiring": { title: "المهمة تنتهي قريباً", message: "المهمة {{assignmentId}} تنتهي قريباً." },
    "notifications.proof_deadline_approaching": { title: "موعد تقديم الإثبات قريب", message: "موعد تقديم إثبات المهمة {{assignmentId}} قريب." },
    "notifications.proof_received": { title: "تم استلام الإثبات", message: "تم استلام إثبات المهمة {{assignmentId}}." },
    "notifications.verification_started": { title: "بدء التحقق", message: "جارٍ التحقق من إثبات المهمة {{assignmentId}}." },
    "notifications.more_evidence_requested": { title: "مطلوب مزيد من الأدلة", message: "يُطلب مزيد من الأدلة للمهمة {{assignmentId}}." },
    "notifications.additional_evidence_received": { title: "استلام دليل إضافي", message: "تم استلام دليل إضافي للمهمة {{assignmentId}}." },
    "notifications.proof_verified": { title: "تم التحقق من الإثبات", message: "تم التحقق من إثبات المهمة {{assignmentId}}." },
    "notifications.proof_rejected": { title: "تم رفض الإثبات", message: "تم رفض إثبات المهمة {{assignmentId}}." },
    "notifications.proof_duplicate": { title: "إثبات مكرر", message: "إثبات المهمة {{assignmentId}} مكرر." },
    "notifications.proof_suspicious": { title: "إثبات مشبوه", message: "إثبات المهمة {{assignmentId}} مشبوه." },
    "notifications.assignment_expired": { title: "انتهت المهمة", message: "المهمة {{assignmentId}} انتهت." },
    "notifications.recurring_occurrence_available": { title: "حلقة متكررة متاحة", message: "حلقة جديدة متاحة للمهمة {{taskId}}." },
    "notifications.recurring_occurrence_cancelled": { title: "تم إلغاء الحلقة", message: "تم إلغاء حلقة المهمة {{taskId}}." },
    "notifications.operational_action_required": { title: "تنبيه تشغيلي", message: "يتطلب الأمر اهتمامك للمهمة {{taskId}}." },
  },
  en: {
    "notifications.private_task_invitation": { title: "Private task invitation", message: "You have a private invitation for task {{taskId}}." },
    "notifications.invitation_expiring": { title: "Invitation expiring", message: "Your invitation for task {{taskId}} is expiring soon." },
    "notifications.invitation_cancelled": { title: "Invitation cancelled", message: "Your invitation for task {{taskId}} was cancelled." },
    "notifications.assignment_ready": { title: "Assignment ready", message: "Assignment {{assignmentId}} is ready for you." },
    "notifications.assignment_cancelled": { title: "Assignment cancelled", message: "Assignment {{assignmentId}} was cancelled." },
    "notifications.assignment_expiring": { title: "Assignment expiring", message: "Assignment {{assignmentId}} is expiring soon." },
    "notifications.proof_deadline_approaching": { title: "Proof deadline approaching", message: "Proof deadline for assignment {{assignmentId}} is approaching." },
    "notifications.proof_received": { title: "Proof received", message: "Proof for assignment {{assignmentId}} was received." },
    "notifications.verification_started": { title: "Verification started", message: "Verification started for assignment {{assignmentId}}." },
    "notifications.more_evidence_requested": { title: "More evidence requested", message: "More evidence was requested for assignment {{assignmentId}}." },
    "notifications.additional_evidence_received": { title: "Additional evidence received", message: "Additional evidence was received for assignment {{assignmentId}}." },
    "notifications.proof_verified": { title: "Proof verified", message: "Proof for assignment {{assignmentId}} was verified." },
    "notifications.proof_rejected": { title: "Proof rejected", message: "Proof for assignment {{assignmentId}} was rejected." },
    "notifications.proof_duplicate": { title: "Duplicate proof", message: "Proof for assignment {{assignmentId}} is a duplicate." },
    "notifications.proof_suspicious": { title: "Suspicious proof", message: "Proof for assignment {{assignmentId}} is suspicious." },
    "notifications.assignment_expired": { title: "Assignment expired", message: "Assignment {{assignmentId}} has expired." },
    "notifications.recurring_occurrence_available": { title: "Recurring occurrence available", message: "A new occurrence is available for task {{taskId}}." },
    "notifications.recurring_occurrence_cancelled": { title: "Recurring occurrence cancelled", message: "An occurrence for task {{taskId}} was cancelled." },
    "notifications.operational_action_required": { title: "Operational action required", message: "Operational attention is required for task {{taskId}}." },
  },
  fr: {
    "notifications.private_task_invitation": { title: "Invitation privée", message: "Vous avez une invitation privée pour la tâche {{taskId}}." },
    "notifications.invitation_expiring": { title: "Invitation expirante", message: "Votre invitation pour la tâche {{taskId}} expire bientôt." },
    "notifications.invitation_cancelled": { title: "Invitation annulée", message: "Votre invitation pour la tâche {{taskId}} a été annulée." },
    "notifications.assignment_ready": { title: "Tâche prête", message: "La tâche {{assignmentId}} est prête pour vous." },
    "notifications.assignment_cancelled": { title: "Tâche annulée", message: "La tâche {{assignmentId}} a été annulée." },
    "notifications.assignment_expiring": { title: "Tâche expirante", message: "La tâche {{assignmentId}} expire bientôt." },
    "notifications.proof_deadline_approaching": { title: "Échéance de preuve proche", message: "L'échéance de preuve pour la tâche {{assignmentId}} approche." },
    "notifications.proof_received": { title: "Preuve reçue", message: "La preuve pour la tâche {{assignmentId}} a été reçue." },
    "notifications.verification_started": { title: "Vérification commencée", message: "La vérification de la tâche {{assignmentId}} a commencé." },
    "notifications.more_evidence_requested": { title: "Plus de preuves demandées", message: "Plus de preuves ont été demandées pour la tâche {{assignmentId}}." },
    "notifications.additional_evidence_received": { title: "Preuve additionnelle reçue", message: "Une preuve additionnelle pour la tâche {{assignmentId}} a été reçue." },
    "notifications.proof_verified": { title: "Preuve vérifiée", message: "La preuve pour la tâche {{assignmentId}} a été vérifiée." },
    "notifications.proof_rejected": { title: "Preuve rejetée", message: "La preuve pour la tâche {{assignmentId}} a été rejetée." },
    "notifications.proof_duplicate": { title: "Preuve dupliquée", message: "La preuve pour la tâche {{assignmentId}} est un doublon." },
    "notifications.proof_suspicious": { title: "Preuve suspecte", message: "La preuve pour la tâche {{assignmentId}} est suspecte." },
    "notifications.assignment_expired": { title: "Tâche expirée", message: "La tâche {{assignmentId}} a expiré." },
    "notifications.recurring_occurrence_available": { title: "Occurrence récurrente disponible", message: "Une nouvelle occurrence est disponible pour la tâche {{taskId}}." },
    "notifications.recurring_occurrence_cancelled": { title: "Occurrence récurrente annulée", message: "Une occurrence pour la tâche {{taskId}} a été annulée." },
    "notifications.operational_action_required": { title: "Action opérationnelle requise", message: "Une attention opérationnelle est requise pour la tâche {{taskId}}." },
  },
};

export function localizeNotification(
  key: string,
  parameters: Record<string, string | number | boolean>,
  language: string,
): { title: string; message: string } {
  const lang: SupportedLanguage = (language as SupportedLanguage) ?? defaultLanguage;
  const dictionary = dictionaries[lang] ?? dictionaries[defaultLanguage];
  const fallback = { title: key, message: key };
  const entry = dictionary[key] ?? fallback;
  const render = (text: string) => text.replace(/\{\{(\w+)\}\}/g, (_, variable: string) => String(parameters[variable] ?? ""));
  return { title: render(entry.title), message: render(entry.message) };
}

export function allNotificationKeys(): readonly string[] {
  return ["notifications.private_task_invitation", "notifications.invitation_expiring", "notifications.invitation_cancelled", "notifications.assignment_ready", "notifications.assignment_cancelled", "notifications.assignment_expiring", "notifications.proof_deadline_approaching", "notifications.proof_received", "notifications.verification_started", "notifications.more_evidence_requested", "notifications.additional_evidence_received", "notifications.proof_verified", "notifications.proof_rejected", "notifications.proof_duplicate", "notifications.proof_suspicious", "notifications.assignment_expired", "notifications.recurring_occurrence_available", "notifications.recurring_occurrence_cancelled", "notifications.operational_action_required"];
}