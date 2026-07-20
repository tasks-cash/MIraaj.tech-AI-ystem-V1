import { Injectable } from "@nestjs/common";
import type { BusinessType } from "@miraaj/shared-types";
import type { ServiceMatchResult } from "./matching-types.js";

export interface BundleDefinitionInput {
  code: string;
  memberSlugs: string[];
  applicableBusinessTypes: BusinessType[];
}

export interface BundleEvaluationResult {
  bundleCode: string;
  memberSlugs: string[];
  recommendedMemberSlugs: string[];
  coverageRatio: number;
}

const RECOMMENDED_STATES = new Set([
  "recommended",
  "recommended_with_prerequisites",
]);

/**
 * Evaluates each bundle by inspecting the already-scored individual member
 * results — bundles never receive their own independent score. A bundle is
 * only surfaced when the profile's business type is applicable.
 */
@Injectable()
export class BundleBuilderService {
  evaluateBundles(
    businessType: BusinessType,
    results: readonly ServiceMatchResult[],
    bundles: readonly BundleDefinitionInput[],
  ): BundleEvaluationResult[] {
    const resultBySlug = new Map(results.map((result) => [result.itemSlug, result]));
    return bundles
      .filter((bundle) => bundle.applicableBusinessTypes.includes(businessType))
      .map((bundle) => {
        const recommendedMemberSlugs = bundle.memberSlugs.filter((slug) => {
          const result = resultBySlug.get(slug);
          return result ? RECOMMENDED_STATES.has(result.state) : false;
        });
        const coverageRatio =
          bundle.memberSlugs.length === 0
            ? 0
            : recommendedMemberSlugs.length / bundle.memberSlugs.length;
        return {
          bundleCode: bundle.code,
          memberSlugs: [...bundle.memberSlugs],
          recommendedMemberSlugs,
          coverageRatio,
        };
      })
      .sort((a, b) => b.coverageRatio - a.coverageRatio);
  }
}
