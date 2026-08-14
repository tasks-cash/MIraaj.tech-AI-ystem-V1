import { createHmac, randomUUID } from "node:crypto";

export interface EmailMessage { to: string; subject: string; text: string; }
export interface EmailAdapter { send(message: EmailMessage): Promise<{ deliveryId: string }>; }
export class DisabledEmailAdapter implements EmailAdapter { send(message: EmailMessage): Promise<never> { void message; return Promise.reject(new Error("NOTIFICATION_EMAIL_DISABLED")); } }
export class FakeEmailAdapter implements EmailAdapter {
  readonly deliveries: EmailMessage[] = [];
  send(message: EmailMessage) {
    if (/[\r\n]/.test(message.to)) return Promise.reject(new Error("NOTIFICATION_EMAIL_RECIPIENT_INVALID"));
    this.deliveries.push(message); return Promise.resolve({ deliveryId: `fake_email_${this.deliveries.length}` });
  }
}
export const signNotificationWebhook = (secret: string, timestamp: string, eventId: string, body: string) =>
  createHmac("sha256", secret).update(`${timestamp}.${eventId}.${body}`).digest("hex");
export const webhookEnvelope = (payload: Record<string, unknown>) => ({ eventId: randomUUID(), timestamp: new Date().toISOString(), payload });
