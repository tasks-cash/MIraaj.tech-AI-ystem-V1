"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ChevronDown, X } from "lucide-react";
import { useEffect, useId, useState, type ReactNode } from "react";
import { cn } from "./core";

export function Accordion({ items }: { items: Array<{ question: string; answer: string }> }) {
  const [open, setOpen] = useState<number | null>(0);
  const baseId = useId();
  return (
    <div className="divide-y divide-[var(--border)] border-y border-[var(--border)]">
      {items.map((item, index) => {
        const expanded = open === index;
        const panelId = `${baseId}-${index}`;
        return (
          <div key={item.question}>
            <button className="flex w-full items-center justify-between gap-5 py-5 text-start font-bold text-[var(--navy)] outline-none focus-visible:ring-4 focus-visible:ring-blue-500/20" aria-expanded={expanded} aria-controls={panelId} onClick={() => setOpen(expanded ? null : index)}>
              {item.question}
              <ChevronDown className={cn("size-5 shrink-0 transition", expanded && "rotate-180")} aria-hidden />
            </button>
            <div id={panelId} hidden={!expanded} className="pb-5 pe-10 leading-7 text-[var(--muted)]">{item.answer}</div>
          </div>
        );
      })}
    </div>
  );
}

export function Tabs({ items }: { items: Array<{ label: string; content: ReactNode }> }) {
  const [active, setActive] = useState(0);
  const reduced = useReducedMotion();
  return (
    <div>
      <div className="flex gap-2 overflow-x-auto pb-2" role="tablist" aria-label="Solution types">
        {items.map((item, index) => (
          <button key={item.label} role="tab" aria-selected={active === index} className={cn("min-h-11 shrink-0 rounded-full border px-4 text-sm font-semibold transition", active === index ? "border-blue-600 bg-blue-600 text-white" : "border-[var(--border)] bg-white text-[var(--navy)] hover:border-blue-300")} onClick={() => setActive(index)}>
            {item.label}
          </button>
        ))}
      </div>
      <motion.div key={active} initial={reduced ? false : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="mt-6">{items[active]?.content}</motion.div>
    </div>
  );
}

export function Modal({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: ReactNode }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);
  return (
    <AnimatePresence>
      {open && (
        <motion.div className="fixed inset-0 z-[100] grid place-items-end bg-slate-950/40 p-0 backdrop-blur-sm sm:place-items-center sm:p-5" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onMouseDown={onClose}>
          <motion.div role="dialog" aria-modal="true" aria-labelledby="modal-title" className="max-h-[90dvh] w-full overflow-auto rounded-t-3xl bg-white p-5 shadow-2xl sm:max-w-3xl sm:rounded-3xl sm:p-7" initial={{ y: 30 }} animate={{ y: 0 }} exit={{ y: 30 }} onMouseDown={(event) => event.stopPropagation()}>
            <div className="mb-5 flex items-center justify-between gap-4">
              <h2 id="modal-title" className="text-xl font-bold text-[var(--navy)]">{title}</h2>
              <button onClick={onClose} className="grid size-11 place-items-center rounded-full border border-[var(--border)] hover:bg-slate-50" aria-label="Close"><X className="size-5" /></button>
            </div>
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
