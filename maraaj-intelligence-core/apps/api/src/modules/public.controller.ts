
import { Body, Controller, Get, Param, Post, Query, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";
import {
  Post as PostModel,
  Project,
  Category,
  Group,
  SocialCard,
  QrCode,
  VisitorEvent,
  Report,
  Asset,
} from "@maraaj/database";
import { publicEventSchema } from "@maraaj/validation";
import { randomUUID, createHash } from "node:crypto";
import { getServices } from "../services/app-services";
import { success, failure } from "../common/response";
import { hashIp } from "../security/request-signing";

@Controller("/api/v1/public")
export class PublicController {
  @Get("/page/:publicCode")
  async page(
    @Param("publicCode") publicCode: string,
    @Query("locale") locale = "en",
    @Res() res: Response,
  ) {
    const svc = getServices();
    const post = await PostModel.findOne({
      publicCode,
      publicationStatus: "published",
      deletedAt: null,
    }).lean();
    if (!post) return res.status(404).json(failure("NOT_FOUND", "Post not found"));
    if (post.expiresAt && new Date(post.expiresAt) < new Date()) {
      return res.status(410).json(failure("QR_EXPIRED", "This content has expired"));
    }

    const cacheKey = svc.cache.pageKey(String(post.projectId), publicCode, locale);
    const cached = await svc.cache.getJson<unknown>(cacheKey);
    if (cached) {
      res.setHeader("X-Cache", "HIT");
      return res.json(success(cached));
    }

    const [project, category, group, socialCards, qr, assets] = await Promise.all([
      Project.findById(post.projectId).lean(),
      post.categoryId ? Category.findById(post.categoryId).lean() : null,
      post.groupId ? Group.findById(post.groupId).lean() : null,
      SocialCard.find({ postId: post._id }).lean(),
      QrCode.findOne({ postId: post._id, active: true }).lean(),
      Asset.find({ _id: { $in: post.assetIds ?? [] } }).lean(),
    ]);

    if (!project) return res.status(404).json(failure("NOT_FOUND", "Project not found"));

    const relatedPosts = await PostModel.find({
      projectId: post.projectId,
      publicationStatus: "published",
      _id: { $ne: post._id },
      deletedAt: null,
    })
      .sort({ publishedAt: -1 })
      .limit(6)
      .select("title publicCode description categoryId publishedAt")
      .lean();

    const header = socialCards.find((c) => c.format === "website_header");
    const mobileHeader = socialCards.find((c) => c.format === "mobile_header");
    const og = socialCards.find((c) => c.format === "og");

    const mediaBase = svc.env.MEDIA_BASE_URL;
    const payload = {
      project: {
        id: String(project._id),
        name: project.name,
        slug: project.slug,
      },
      post: {
        id: String(post._id),
        title: post.title,
        description: post.description,
        publicCode: post.publicCode,
        tags: post.tags,
        destinationUrl: post.destinationUrl,
        destinationDomain: post.destinationDomain,
        publishedAt: post.publishedAt,
        expiresAt: post.expiresAt,
        locale,
      },
      category: category
        ? { id: String(category._id), name: category.name, slug: category.slug }
        : null,
      group: group ? { id: String(group._id), name: group.name, slug: group.slug } : null,
      media: {
        header: header
          ? { url: `${mediaBase}/${header.objectKey}`, width: header.width, height: header.height }
          : null,
        mobileHeader: mobileHeader
          ? {
              url: `${mediaBase}/${mobileHeader.objectKey}`,
              width: mobileHeader.width,
              height: mobileHeader.height,
            }
          : null,
        socialCards: socialCards.map((c) => ({
          format: c.format,
          url: `${mediaBase}/${c.objectKey}`,
          width: c.width,
          height: c.height,
        })),
        gallery: assets.map((a) => ({
          id: String(a._id),
          url: `${mediaBase}/${a.objectKey}`,
          mimeType: a.mimeType,
          width: a.width,
          height: a.height,
        })),
        ogImage: og ? `${mediaBase}/${og.objectKey}` : header ? `${mediaBase}/${header.objectKey}` : null,
      },
      qr: qr
        ? {
            publicCode: qr.publicCode,
            url: `${svc.env.PUBLIC_WEB_URL}/q/${qr.publicCode}`,
            active: qr.active,
          }
        : null,
      seo: {
        title: post.seo?.title ?? post.title,
        description: post.seo?.description ?? post.description,
        canonical: `${svc.env.PUBLIC_WEB_URL}/p/${publicCode}`,
        ogImage: og ? `${mediaBase}/${og.objectKey}` : null,
      },
      tracking: {
        publicCode,
        privacyMode: project.privacyMode ?? "balanced",
      },
      relatedPosts: relatedPosts.map((p) => ({
        title: p.title,
        publicCode: p.publicCode,
        description: p.description,
      })),
      legal: {
        privacyUrl: `${svc.env.PUBLIC_WEB_URL}/privacy`,
        termsUrl: `${svc.env.PUBLIC_WEB_URL}/terms`,
      },
      consent: {
        required: true,
        modes: ["necessary", "analytics"],
      },
    };

    await svc.cache.setJson(cacheKey, payload, 300);
    res.setHeader("X-Cache", "MISS");
    return res.json(success(payload));
  }

  @Get("/posts/:publicCode")
  async publicPost(@Param("publicCode") publicCode: string, @Res() res: Response) {
    return this.page(publicCode, "en", res);
  }

  @Get("/qr/:publicCode")
  async publicQr(@Param("publicCode") publicCode: string, @Res() res: Response) {
    const qr = await QrCode.findOne({ publicCode, active: true }).lean();
    if (!qr) return res.status(404).json(failure("NOT_FOUND", "QR not found"));
    if (qr.expiresAt && new Date(qr.expiresAt) < new Date()) {
      return res.status(410).json(failure("QR_EXPIRED", "QR code expired"));
    }
    return res.json(
      success({
        publicCode: qr.publicCode,
        postId: qr.postId,
        active: qr.active,
      }),
    );
  }

  @Post("/events")
  async events(@Body() body: unknown, @Req() req: Request, @Res() res: Response) {
    const parsed = publicEventSchema.safeParse(body);
    if (!parsed.success) {
      return res.status(400).json(failure("VALIDATION_ERROR", "Invalid event", parsed.error.issues));
    }
    const post = await PostModel.findOne({ publicCode: parsed.data.publicCode }).lean();
    if (!post) return res.status(404).json(failure("NOT_FOUND", "Post not found"));
    const project = await Project.findById(post.projectId).lean();
    const svc = getServices();
    const mode = project?.privacyMode ?? "balanced";
    const ip = req.ip ?? "0.0.0.0";
    const salt = (await svc.redis.get("ip-hash-salt")) ?? "mic-dev-salt";
    let ipHash: string | undefined;
    let anonymizedVisitorId: string | undefined;
    if (mode === "balanced" || mode === "extended") {
      ipHash = hashIp(ip, salt);
      anonymizedVisitorId = createHash("sha256")
        .update(`${salt}:${ipHash}:${req.headers["user-agent"] ?? ""}`)
        .digest("hex")
        .slice(0, 32);
    }
    if (parsed.data.consentState === "denied" || parsed.data.consentState === "necessary") {
      anonymizedVisitorId = undefined;
      ipHash = undefined;
    }

    const qr = await QrCode.findOne({ publicCode: parsed.data.publicCode }).lean();
    await VisitorEvent.create({
      tenantId: post.tenantId,
      projectId: post.projectId,
      environment: post.environment,
      eventId: randomUUID(),
      postId: post._id,
      qrId: qr?._id,
      type: parsed.data.type,
      anonymizedVisitorId,
      sessionId: parsed.data.sessionId,
      referrer: req.headers.referer,
      consentState: parsed.data.consentState,
      conversionType: parsed.data.conversionType,
      ipHash,
      countryApprox: String(req.headers["x-vercel-ip-country"] ?? ""),
      deviceCategory: "unknown",
      browserFamily: "unknown",
      osFamily: "unknown",
      botClassification: /bot|crawl|spider/i.test(req.headers["user-agent"] ?? "") ? "bot" : "human",
    });
    if (parsed.data.type === "qr_scan" && qr) {
      await QrCode.updateOne({ _id: qr._id }, { $inc: { scanCount: 1 } });
    }
    return res.status(201).json(success({ recorded: true }));
  }

  @Post("/reports")
  async reports(@Body() body: { publicCode?: string; reason?: string; details?: string }, @Res() res: Response) {
    await Report.create({
      publicCode: body.publicCode,
      reason: body.reason,
      details: body.details,
    });
    return res.status(201).json(success({ received: true }));
  }
}
