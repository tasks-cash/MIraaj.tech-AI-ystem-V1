import { createHash } from "node:crypto";

export interface RecurrenceConfiguration {
  cadence: "daily" | "weekly";
  interval: number;
  weekdays: number[];
  localTime: string;
  timezone: string;
  startDate?: string;
  endDate?: string;
  maxOccurrences?: number;
}

const localParts = (date: Date, timezone: string) => {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23",
  }).formatToParts(date);
  return Object.fromEntries(parts.map((part) => [part.type, part.value]));
};

export function zonedDate(localDate: string, localTime: string, timezone: string): Date {
  const [year = 0, month = 0, day = 0] = localDate.split("-").map(Number);
  const [hour = 0, minute = 0] = localTime.split(":").map(Number);
  let candidate = Date.UTC(year, month - 1, day, hour, minute);
  for (let index = 0; index < 3; index += 1) {
    const parts = localParts(new Date(candidate), timezone);
    const represented = Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day), Number(parts.hour), Number(parts.minute));
    candidate += Date.UTC(year, month - 1, day, hour, minute) - represented;
  }
  return new Date(candidate);
}

const dateKey = (date: Date) => date.toISOString().slice(0, 10);

export function nextOccurrences(configuration: RecurrenceConfiguration, from: Date, limit = 10): Date[] {
  new Intl.DateTimeFormat("en", { timeZone: configuration.timezone });
  const start = configuration.startDate ? new Date(`${configuration.startDate}T00:00:00Z`) : new Date(from);
  const end = configuration.endDate ? new Date(`${configuration.endDate}T23:59:59.999Z`) : undefined;
  const anchor = new Date(start);
  anchor.setUTCHours(0, 0, 0, 0);
  const cursor = new Date(Math.max(anchor.getTime(), from.getTime() - 86_400_000));
  cursor.setUTCHours(0, 0, 0, 0);
  const result: Date[] = [];
  for (let days = 0; days < 3_660 && result.length < limit; days += 1) {
    const date = new Date(cursor.getTime() + days * 86_400_000);
    if (date < anchor) continue;
    const dayDistance = Math.floor((date.getTime() - anchor.getTime()) / 86_400_000);
    const cadenceMatch = configuration.cadence === "daily"
      ? dayDistance % configuration.interval === 0
      : Math.floor(dayDistance / 7) % configuration.interval === 0 && configuration.weekdays.includes(date.getUTCDay());
    if (!cadenceMatch) continue;
    const occurrence = zonedDate(dateKey(date), configuration.localTime, configuration.timezone);
    if (occurrence < from || (end && occurrence > end)) continue;
    result.push(occurrence);
  }
  return result;
}

export const recurrenceKey = (taskId: string, scheduledFor: Date) =>
  createHash("sha256").update(`${taskId}:${scheduledFor.toISOString()}`).digest("hex").slice(0, 32);
