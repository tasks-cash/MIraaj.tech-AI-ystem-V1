import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { BrandProfileModel } from "../models/campaign-policy.schema.js";

export interface CreateBrandProfileVersionInput {
  brandName?: string;
  toneAttributes?: string[];
  toneRestrictions?: string[];
  approvedValuePropositions?: string[];
  approvedCapabilities?: string[];
  prohibitedClaims?: string[];
  protectedTerms?: string[];
  createdBy: string;
}

/** Admin-facing CRUD for the versioned Miraaj.tech brand voice profile. */
@Injectable()
export class BrandProfileService {
  async listVersions() {
    const items = await BrandProfileModel.find().sort({ version: -1 }).lean();
    return { items };
  }

  async getActive() {
    const profile = await BrandProfileModel.findOne({ status: "active" }).lean();
    if (!profile) {
      throw new NotFoundException({
        code: "BRAND_PROFILE_NOT_FOUND",
        message: "No active brand profile is configured.",
      });
    }
    return profile;
  }

  async getVersion(version: number) {
    const profile = await BrandProfileModel.findOne({ version }).lean();
    if (!profile) {
      throw new NotFoundException({
        code: "BRAND_PROFILE_NOT_FOUND",
        message: "Brand profile version was not found.",
      });
    }
    return profile;
  }

  async createVersion(input: CreateBrandProfileVersionInput) {
    const latest = await BrandProfileModel.findOne().sort({ version: -1 }).lean();
    const nextVersion = (latest?.version ?? 0) + 1;
    const profile = await BrandProfileModel.create({
      brandProfileId: randomUUID(),
      version: nextVersion,
      status: "draft",
      brandName: input.brandName ?? latest?.brandName ?? "Miraaj.tech",
      toneAttributes: input.toneAttributes ?? latest?.toneAttributes ?? [],
      toneRestrictions: input.toneRestrictions ?? latest?.toneRestrictions ?? [],
      approvedValuePropositions:
        input.approvedValuePropositions ?? latest?.approvedValuePropositions ?? [],
      approvedCapabilities: input.approvedCapabilities ?? latest?.approvedCapabilities ?? [],
      prohibitedClaims: input.prohibitedClaims ?? latest?.prohibitedClaims ?? [],
      protectedTerms: input.protectedTerms ?? latest?.protectedTerms ?? [
        "Miraaj.tech",
        "Tasks.cash",
      ],
      createdBy: input.createdBy,
    });
    return profile.toObject();
  }

  async publishVersion(version: number, approvedBy?: string) {
    const profile = await BrandProfileModel.findOne({ version });
    if (!profile) {
      throw new NotFoundException({
        code: "BRAND_PROFILE_NOT_FOUND",
        message: "Brand profile version was not found.",
      });
    }
    if (profile.status === "active") {
      return profile.toObject();
    }
    await BrandProfileModel.updateMany(
      { status: "active" },
      { status: "deprecated", deprecatedAt: new Date() },
    );
    profile.status = "active";
    profile.publishedAt = new Date();
    if (approvedBy) {
      profile.approvedBy = approvedBy;
    }
    await profile.save();
    return profile.toObject();
  }

  async deprecateVersion(version: number) {
    const profile = await BrandProfileModel.findOne({ version });
    if (!profile) {
      throw new NotFoundException({
        code: "BRAND_PROFILE_NOT_FOUND",
        message: "Brand profile version was not found.",
      });
    }
    if (profile.status !== "active") {
      throw new BadRequestException({
        code: "BRAND_PROFILE_INACTIVE",
        message: "Only the active brand profile version can be deprecated.",
      });
    }
    profile.status = "deprecated";
    profile.deprecatedAt = new Date();
    await profile.save();
    return profile.toObject();
  }
}
