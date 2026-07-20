import { Injectable } from "@nestjs/common";
import type { ServiceMatchResult } from "./matching-types.js";

export interface PhaseGroup {
  phase: number;
  label: string;
  itemSlugs: string[];
}

const PHASE_LABELS: Record<number, string> = {
  0: "Phase 0 — Foundation & discovery",
  1: "Phase 1 — Core build",
  2: "Phase 2 — Operations & intelligence",
  3: "Phase 3 — Scale & advanced platform",
  4: "Phase 4 — Growth acceleration",
  5: "Phase 5 — Transformation & standardization",
};

/**
 * Groups already-scored recommendations into a Phase 0–5 roadmap. Only
 * recommended/recommended_with_prerequisites/optional items are placed on
 * the plan — excluded, unavailable, and blocked items are omitted.
 */
@Injectable()
export class PhasePlannerService {
  buildPlan(results: readonly ServiceMatchResult[]): PhaseGroup[] {
    const eligibleStates = new Set([
      "recommended",
      "recommended_with_prerequisites",
      "optional",
      "future_phase",
    ]);
    const byPhase = new Map<number, string[]>();
    for (const result of results) {
      if (!eligibleStates.has(result.state)) {
        continue;
      }
      const slugs = byPhase.get(result.phase) ?? [];
      slugs.push(result.itemSlug);
      byPhase.set(result.phase, slugs);
    }
    return [...byPhase.entries()]
      .sort(([phaseA], [phaseB]) => phaseA - phaseB)
      .map(([phase, itemSlugs]) => ({
        phase,
        label: PHASE_LABELS[phase] ?? `Phase ${phase}`,
        itemSlugs: [...itemSlugs].sort(),
      }));
  }
}
