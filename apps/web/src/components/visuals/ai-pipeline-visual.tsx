"use client";

import { motion, useReducedMotion } from "framer-motion";
import type { HomeCopy } from "@/i18n/home-copy";

const nodes = [
  "OCR",
  "Image",
  "Language",
  "Audience",
  "Profile",
  "Needs",
  "Match",
  "Review",
] as const;

const stages = [
  "Media & Business Data",
  "AI Analysis",
  "Business Intelligence",
  "Service Matching",
  "Recommended Solutions",
] as const;

export function AiPipelineVisual({
  copy,
}: {
  copy?: Pick<HomeCopy["overview"], "steps">;
}) {
  const reduced = useReducedMotion();
  const animate = reduced === false;
  const stageLabels = copy?.steps.map((step) => step.title) ?? stages;

  return (
    <div
      className="relative mx-auto w-full max-w-[560px]"
      aria-hidden="true"
      role="presentation"
    >
      <div className="absolute inset-0 rounded-[2rem] bg-[radial-gradient(circle_at_30%_20%,rgba(23,107,255,0.16),transparent_45%),radial-gradient(circle_at_80%_70%,rgba(14,165,233,0.12),transparent_40%)]" />
      <div className="relative overflow-hidden rounded-[2rem] border border-blue-200/80 bg-white/90 p-5 shadow-[0_28px_70px_rgba(15,35,80,0.12)] backdrop-blur sm:p-6">
        <p className="text-xs font-bold uppercase tracking-[0.14em] text-blue-700">
          Miraaj.tech AI flow
        </p>
        <ol className="mt-4 grid gap-2">
          {stageLabels.slice(0, 5).map((label, index) => (
            <motion.li
              key={label}
              className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50/80 px-3 py-2.5 text-sm font-semibold text-slate-800"
              initial={animate ? { opacity: 0, x: 12 } : false}
              animate={animate ? { opacity: 1, x: 0 } : undefined}
              transition={{
                delay: animate ? 0.15 + index * 0.08 : 0,
                duration: 0.4,
                ease: [0.22, 1, 0.36, 1],
              }}
            >
              <span className="grid size-7 place-items-center rounded-full bg-[var(--navy)] text-[11px] font-black text-white">
                {index + 1}
              </span>
              <span className="flex-1">{label}</span>
              {index < stageLabels.length - 1 && (
                <motion.span
                  className="hidden h-1 w-8 rounded-full bg-gradient-to-r from-blue-500 to-cyan-400 sm:block rtl:bg-gradient-to-l"
                  animate={
                    animate
                      ? { opacity: [0.35, 1, 0.35], scaleX: [0.85, 1, 0.85] }
                      : undefined
                  }
                  transition={{
                    duration: 2.8,
                    repeat: Number.POSITIVE_INFINITY,
                    delay: index * 0.25,
                  }}
                />
              )}
            </motion.li>
          ))}
        </ol>

        <div className="mt-5 grid grid-cols-4 gap-2">
          {nodes.map((node, index) => (
            <motion.div
              key={node}
              className="rounded-xl border border-blue-100 bg-blue-50/70 px-2 py-3 text-center text-[10px] font-bold uppercase tracking-wide text-blue-900 sm:text-[11px]"
              animate={
                animate
                  ? { y: [0, index % 2 === 0 ? -4 : 4, 0] }
                  : undefined
              }
              transition={{
                duration: 4.5 + index * 0.2,
                repeat: Number.POSITIVE_INFINITY,
                ease: "easeInOut",
              }}
            >
              {node}
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}
