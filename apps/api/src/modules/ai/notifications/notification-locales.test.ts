import { describe, expect, it } from "vitest";
import { allNotificationKeys, localizeNotification } from "./notification-locales.js";

describe("notification localization", () => {
  it("renders English, Arabic and French titles and messages", () => {
    const parameters = { taskId: "task-1", assignmentId: "assignment-1" };
    const en = localizeNotification("notifications.assignment_ready", parameters, "en");
    expect(en.title).toBe("Assignment ready");
    expect(en.message).toContain("assignment-1");
    const ar = localizeNotification("notifications.assignment_ready", parameters, "ar");
    expect(ar.title).toBe("المهمة جاهزة");
    const fr = localizeNotification("notifications.assignment_ready", parameters, "fr");
    expect(fr.title).toBe("Tâche prête");
  });

  it("falls back to key when language or key is unknown", () => {
    const result = localizeNotification("notifications.unknown_key", {}, "de");
    expect(result.title).toBe("notifications.unknown_key");
  });

  it("covers all required notification keys", () => {
    const keys = allNotificationKeys();
    expect(keys).toContain("notifications.private_task_invitation");
    expect(keys).toContain("notifications.recurring_occurrence_available");
    expect(keys).toContain("notifications.operational_action_required");
    expect(keys.length).toBeGreaterThanOrEqual(19);
  });
});
