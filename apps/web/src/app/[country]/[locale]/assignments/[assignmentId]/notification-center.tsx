"use client";
import { useCallback, useEffect, useState } from "react";

type NotificationItem = { publicId: string; notificationType: string; titleKey: string; messageKey: string; localizedParameters: Record<string, string | number | boolean>; status: string; safeActionType: string; safeActionTarget: string; createdAt: string };
export function NotificationCenter({ contextToken, locale }: { contextToken: string; locale: string }) {
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [unread, setUnread] = useState(0);
  const headers = { "content-type": "application/json", authorization: `Bearer ${contextToken}` };
  const load = useCallback(async () => {
    const [list, count] = await Promise.all([
      fetch("/api/campaign-task/notifications?limit=20", { headers, cache: "no-store" }).then((value) => value.json()) as Promise<{ items: NotificationItem[] }>,
      fetch("/api/campaign-task/notifications/unread-count", { headers, cache: "no-store" }).then((value) => value.json()) as Promise<{ unread: number }>,
    ]); setItems(list.items ?? []); setUnread(count.unread ?? 0);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantId, participantId]);
  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);
  const read = async (id: string) => { await fetch(`/api/campaign-task/notifications/${id}/read`, { method: "PATCH", headers, body: "{}" }); await load(); };
  return <details className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><summary className="cursor-pointer font-black">Notifications <span className="rounded-full bg-blue-700 px-2 py-1 text-xs text-white">{unread}</span></summary><button className="mt-3 text-sm font-bold text-blue-700" onClick={async () => { await fetch("/api/campaign-task/notifications/mark-all-read", { method: "POST", headers, body: "{}" }); await load(); }}>Mark all read</button><ul className="mt-3 space-y-2">{items.map((item) => <li key={item.publicId} className="rounded-lg bg-slate-50 p-3 text-sm"><button className="w-full text-start" onClick={() => void read(item.publicId)}><strong>{item.notificationType.replaceAll("_", " ")}</strong><span className="block text-slate-500">{new Date(item.createdAt).toLocaleString(locale)}</span></button></li>)}</ul>{items.length === 0 && <p className="mt-3 text-sm text-slate-500">No notifications.</p>}</details>;
}
