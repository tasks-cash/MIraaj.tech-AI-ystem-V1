
import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  Res,
} from "@nestjs/common";
import type { Request, Response } from "express";
import {
  Project,
  Category,
  Group,
  Asset,
  Post as PostModel,
  PostVersion,
  Analysis,
  ReviewTask,
  TrainingFeedback,
  ApiClient,
  QrCode,
  Webhook,
  WebhookDelivery,
  AiProvider,
  VisitorEvent,
  LinkCheck,
  SecurityEvent,
  AuditLog,
  SocialCard,
  UsageRecord,
} from "@maraaj/database";
import {
  createProjectSchema,
  createApiClientSchema,
  createPostSchema,
  createCategorySchema,
  createGroupSchema,
  publicEventSchema,
  paginationSchema,
} from "@maraaj/validation";
import { generateEd25519KeyPair, sha256Hex, hmacSha256Base64 } from "@maraaj/crypto";
import { generatePublicCode, buildGoUrl, generateQrPng, generateQrSvg } from "@maraaj/qr";
import {
  renderSocialCard,
  SOCIAL_FORMATS,
  TEMPLATE_PALETTES,
  versionedFilename,
} from "@maraaj/social-card";
import { detectImageMime, sha256Buffer } from "@maraaj/storage";
import { randomBytes, randomUUID } from "node:crypto";
import { getServices } from "../services/app-services";
import { success, failure } from "../common/response";
import { AppError } from "../common/errors";
import {
  requirePermission,
  requireMachineAuth,
  requireUser,
  IdempotentReplay,
} from "./auth.controller";
import { writeAudit } from "../common/audit";
import { validateDestinationUrl } from "../security/link-safety";
import { ROLE_PERMISSIONS } from "@maraaj/config";

async function storeIdempotent(
  clientId: string | undefined,
  idemKey: string | undefined,
  status: number,
  body: unknown,
) {
  if (!clientId || !idemKey) return;
  const svc = getServices();
  await svc.cache.setJson(svc.cache.idempotencyKey(clientId, idemKey), { status, body }, 86400);
}

@Controller("/api/v1")
export class ResourcesController {
  // ---- Projects ----
  @Get("/projects")
  async listProjects(@Req() req: Request, @Res() res: Response) {
    await requirePermission(req, "projects.read");
    const projects = await Project.find({ active: true }).lean();
    return res.json(success(projects));
  }

  @Post("/projects")
  async createProject(@Body() body: unknown, @Req() req: Request, @Res() res: Response) {
    const user = await requirePermission(req, "projects.create");
    const parsed = createProjectSchema.safeParse(body);
    if (!parsed.success) {
      return res.status(400).json(failure("VALIDATION_ERROR", "Invalid project", parsed.error.issues));
    }
    const project = await Project.create({
      ...parsed.data,
      tenantId: user.tenantId,
    });
    await writeAudit({
      tenantId: String(user.tenantId),
      projectId: String(project._id),
      actorType: "user",
      actorId: String(user._id),
      action: "project.create",
      entityType: "project",
      entityId: String(project._id),
      newValues: { name: project.name, slug: project.slug },
    });
    return res.status(201).json(success(project));
  }

  @Get("/projects/:id")
  async getProject(@Param("id") id: string, @Req() req: Request, @Res() res: Response) {
    await requirePermission(req, "projects.read");
    const project = await Project.findById(id).lean();
    if (!project) return res.status(404).json(failure("NOT_FOUND", "Project not found"));
    return res.json(success(project));
  }

  @Patch("/projects/:id")
  async patchProject(
    @Param("id") id: string,
    @Body() body: Record<string, unknown>,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    await requirePermission(req, "projects.update");
    const project = await Project.findByIdAndUpdate(id, { $set: body }, { new: true });
    if (!project) return res.status(404).json(failure("NOT_FOUND", "Project not found"));
    return res.json(success(project));
  }

  @Delete("/projects/:id")
  async deleteProject(@Param("id") id: string, @Req() req: Request, @Res() res: Response) {
    await requirePermission(req, "projects.delete");
    await Project.findByIdAndUpdate(id, { $set: { active: false } });
    return res.json(success({ ok: true }));
  }

  // ---- API Clients ----
  @Get("/api-clients")
  async listClients(@Req() req: Request, @Res() res: Response) {
    await requirePermission(req, "apiClients.read");
    const clients = await ApiClient.find().select("-publicKeyPem").lean();
    return res.json(
      success(
        clients.map((c) => ({
          ...c,
          publicKeyPem: undefined,
          hasPublicKey: true,
        })),
      ),
    );
  }

  @Post("/api-clients")
  async createClient(@Body() body: unknown, @Req() req: Request, @Res() res: Response) {
    const user = await requirePermission(req, "apiClients.create");
    const parsed = createApiClientSchema.safeParse(body);
    if (!parsed.success) {
      return res.status(400).json(failure("VALIDATION_ERROR", "Invalid api client", parsed.error.issues));
    }
    const project = await Project.findById(parsed.data.projectId);
    if (!project) return res.status(404).json(failure("NOT_FOUND", "Project not found"));
    const keys = generateEd25519KeyPair();
    const clientId = `mic_${randomBytes(12).toString("hex")}`;
    const keyId = `key_${randomBytes(8).toString("hex")}`;
    const client = await ApiClient.create({
      tenantId: project.tenantId,
      projectId: project._id,
      environment: parsed.data.environment,
      name: parsed.data.name,
      clientId,
      keyId,
      publicKeyPem: keys.publicKeyPem,
      scopes: parsed.data.scopes,
      allowedIps: parsed.data.allowedIps,
      allowedOrigins: parsed.data.allowedOrigins,
      mtlsEnabled: parsed.data.mtlsEnabled,
      certificateFingerprint: parsed.data.certificateFingerprint,
      expiresAt: parsed.data.expiresAt ? new Date(parsed.data.expiresAt) : undefined,
    });
    await writeAudit({
      tenantId: String(project.tenantId),
      projectId: String(project._id),
      actorType: "user",
      actorId: String(user._id),
      action: "apiClient.create",
      entityType: "apiClient",
      entityId: String(client._id),
    });
    // Private key shown once
    return res.status(201).json(
      success({
        client: {
          id: String(client._id),
          clientId,
          keyId,
          scopes: client.scopes,
          projectId: String(project._id),
          environment: client.environment,
        },
        credentials: {
          clientId,
          keyId,
          privateKeyPem: keys.privateKeyPem,
          publicKeyPem: keys.publicKeyPem,
          warning: "Store the private key now. It will not be shown again.",
        },
      }),
    );
  }

  @Post("/api-clients/:id/confirm-saved")
  async confirmSaved(@Param("id") id: string, @Req() req: Request, @Res() res: Response) {
    await requirePermission(req, "apiClients.create");
    await ApiClient.findByIdAndUpdate(id, { $set: { credentialsConfirmedAt: new Date() } });
    return res.json(success({ confirmed: true }));
  }

  @Post("/api-clients/:id/rotate")
  async rotateClient(@Param("id") id: string, @Req() req: Request, @Res() res: Response) {
    const user = await requirePermission(req, "apiClients.rotate");
    const existing = await ApiClient.findById(id);
    if (!existing) return res.status(404).json(failure("NOT_FOUND", "Client not found"));
    const keys = generateEd25519KeyPair();
    const keyId = `key_${randomBytes(8).toString("hex")}`;
    existing.status = "revoked";
    existing.revokedAt = new Date();
    await existing.save();
    const next = await ApiClient.create({
      tenantId: existing.tenantId,
      projectId: existing.projectId,
      environment: existing.environment,
      name: existing.name,
      clientId: existing.clientId,
      keyId,
      publicKeyPem: keys.publicKeyPem,
      scopes: existing.scopes,
      allowedIps: existing.allowedIps,
      allowedOrigins: existing.allowedOrigins,
      mtlsEnabled: existing.mtlsEnabled,
      rotationOf: existing.keyId,
    });
    await writeAudit({
      tenantId: String(existing.tenantId),
      projectId: String(existing.projectId),
      actorType: "user",
      actorId: String(user._id),
      action: "apiClient.rotate",
      entityType: "apiClient",
      entityId: String(next._id),
    });
    return res.json(
      success({
        client: { id: String(next._id), clientId: next.clientId, keyId },
        credentials: { privateKeyPem: keys.privateKeyPem, publicKeyPem: keys.publicKeyPem },
      }),
    );
  }

  @Post("/api-clients/:id/revoke")
  async revokeClient(@Param("id") id: string, @Req() req: Request, @Res() res: Response) {
    const user = await requirePermission(req, "apiClients.revoke");
    const client = await ApiClient.findByIdAndUpdate(
      id,
      { $set: { status: "revoked", revokedAt: new Date() } },
      { new: true },
    );
    if (!client) return res.status(404).json(failure("NOT_FOUND", "Client not found"));
    await writeAudit({
      tenantId: String(client.tenantId),
      projectId: String(client.projectId),
      actorType: "user",
      actorId: String(user._id),
      action: "apiClient.revoke",
      entityType: "apiClient",
      entityId: id,
    });
    return res.json(success({ revoked: true }));
  }

  @Post("/api-clients/:id/test")
  async testClient(@Param("id") id: string, @Req() req: Request, @Res() res: Response) {
    await requirePermission(req, "apiClients.read");
    const client = await ApiClient.findById(id).lean();
    if (!client) return res.status(404).json(failure("NOT_FOUND", "Client not found"));
    return res.json(
      success({
        ok: client.status === "active",
        lastUsedAt: client.lastUsedAt,
        status: client.status,
      }),
    );
  }

  @Get("/api-clients/:id/usage")
  async clientUsage(@Param("id") id: string, @Req() req: Request, @Res() res: Response) {
    await requirePermission(req, "apiClients.read");
    const client = await ApiClient.findById(id).lean();
    if (!client) return res.status(404).json(failure("NOT_FOUND", "Client not found"));
    const period = new Date().toISOString().slice(0, 7);
    const usage = await UsageRecord.find({
      projectId: client.projectId,
      period,
    }).lean();
    return res.json(success({ usage, lastUsedAt: client.lastUsedAt }));
  }

  // ---- Categories / Groups ----
  @Get("/categories")
  async listCategories(@Req() req: Request, @Res() res: Response, @Query("projectId") projectId?: string) {
    try {
      await requirePermission(req, "categories.manage");
    } catch {
      await requirePermission(req, "posts.read");
    }
    const q: Record<string, unknown> = { active: true };
    if (projectId) q.projectId = projectId;
    return res.json(success(await Category.find(q).sort({ displayOrder: 1 }).lean()));
  }

  @Post("/categories")
  async createCategory(@Body() body: unknown, @Req() req: Request, @Res() res: Response) {
    const user = await requirePermission(req, "categories.manage");
    const parsed = createCategorySchema.safeParse(body);
    if (!parsed.success) {
      return res.status(400).json(failure("VALIDATION_ERROR", "Invalid category", parsed.error.issues));
    }
    const projectId = String((body as { projectId?: string }).projectId ?? "");
    const project = await Project.findById(projectId);
    if (!project) return res.status(404).json(failure("NOT_FOUND", "Project not found"));
    const cat = await Category.create({
      ...parsed.data,
      tenantId: project.tenantId,
      projectId: project._id,
      environment: project.environment,
      createdBy: user._id,
      updatedBy: user._id,
    });
    return res.status(201).json(success(cat));
  }

  @Patch("/categories/:id")
  async patchCategory(
    @Param("id") id: string,
    @Body() body: Record<string, unknown>,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    await requirePermission(req, "categories.manage");
    const cat = await Category.findByIdAndUpdate(id, { $set: body }, { new: true });
    if (!cat) return res.status(404).json(failure("NOT_FOUND", "Category not found"));
    return res.json(success(cat));
  }

  @Delete("/categories/:id")
  async deleteCategory(@Param("id") id: string, @Req() req: Request, @Res() res: Response) {
    await requirePermission(req, "categories.manage");
    await Category.findByIdAndUpdate(id, { $set: { active: false } });
    return res.json(success({ ok: true }));
  }

  @Get("/groups")
  async listGroups(@Req() req: Request, @Res() res: Response, @Query("projectId") projectId?: string) {
    await requirePermission(req, "groups.manage");
    const q: Record<string, unknown> = { active: true };
    if (projectId) q.projectId = projectId;
    return res.json(success(await Group.find(q).lean()));
  }

  @Post("/groups")
  async createGroup(@Body() body: unknown, @Req() req: Request, @Res() res: Response) {
    await requirePermission(req, "groups.manage");
    const parsed = createGroupSchema.safeParse(body);
    if (!parsed.success) {
      return res.status(400).json(failure("VALIDATION_ERROR", "Invalid group", parsed.error.issues));
    }
    const projectId = String((body as { projectId?: string }).projectId ?? "");
    const project = await Project.findById(projectId);
    if (!project) return res.status(404).json(failure("NOT_FOUND", "Project not found"));
    const group = await Group.create({
      ...parsed.data,
      tenantId: project.tenantId,
      projectId: project._id,
      environment: project.environment,
    });
    return res.status(201).json(success(group));
  }

  @Patch("/groups/:id")
  async patchGroup(
    @Param("id") id: string,
    @Body() body: Record<string, unknown>,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    await requirePermission(req, "groups.manage");
    const group = await Group.findByIdAndUpdate(id, { $set: body }, { new: true });
    if (!group) return res.status(404).json(failure("NOT_FOUND", "Group not found"));
    return res.json(success(group));
  }

  @Delete("/groups/:id")
  async deleteGroup(@Param("id") id: string, @Req() req: Request, @Res() res: Response) {
    await requirePermission(req, "groups.manage");
    await Group.findByIdAndUpdate(id, { $set: { active: false } });
    return res.json(success({ ok: true }));
  }

  // ---- Assets ----
  @Post("/assets/presign")
  async presign(@Body() body: Record<string, unknown>, @Req() req: Request, @Res() res: Response) {
    try {
      const auth = await requireMachineAuth(req, ["assets.write"]);
      return await this.doPresign(body, auth.signed.tenantId, auth.signed.projectId, auth.signed.environment, res, auth.signed.clientId, auth.idemKey);
    } catch (e) {
      if (e instanceof IdempotentReplay) return res.status(e.status).json(e.body);
      try {
        const user = await requirePermission(req, "assets.manage");
        const projectId = String(body.projectId ?? "");
        const project = await Project.findById(projectId);
        if (!project) return res.status(404).json(failure("NOT_FOUND", "Project not found"));
        return await this.doPresign(
          body,
          String(project.tenantId),
          String(project._id),
          project.environment,
          res,
        );
      } catch (err) {
        return handleErr(err, res);
      }
    }
  }

  private async doPresign(
    body: Record<string, unknown>,
    tenantId: string,
    projectId: string,
    environment: string,
    res: Response,
    clientId?: string,
    idemKey?: string,
  ) {
    const svc = getServices();
    const contentType = String(body.contentType ?? "");
    const allowed = ["image/jpeg", "image/png", "image/webp", "image/avif"];
    if (!allowed.includes(contentType)) {
      return res.status(400).json(failure("UPLOAD_INVALID_TYPE", "Unsupported content type"));
    }
    const maxSizeBytes = Number(body.maxSizeBytes ?? 10_000_000);
    if (maxSizeBytes > 20_000_000) {
      return res.status(400).json(failure("UPLOAD_TOO_LARGE", "File too large"));
    }
    const filename = String(body.filename ?? "upload.bin");
    const key = svc.storage.buildObjectKey({
      tenantId,
      projectId,
      kind: "assets",
      filename,
    });
    const asset = await Asset.create({
      tenantId,
      projectId,
      environment,
      objectKey: key,
      mimeType: contentType,
      sizeBytes: maxSizeBytes,
      status: "pending",
    });
    const signed = await svc.storage.presignUpload({
      key,
      contentType,
      maxSizeBytes,
      expiresIn: 300,
    });
    const payload = success({
      assetId: String(asset._id),
      uploadUrl: signed.url,
      objectKey: key,
      expiresIn: signed.expiresIn,
    });
    await storeIdempotent(clientId, idemKey, 200, payload);
    return res.json(payload);
  }

  @Post("/assets/complete")
  async completeAsset(@Body() body: Record<string, unknown>, @Req() req: Request, @Res() res: Response) {
    const svc = getServices();
    let tenantId = "";
    let projectId = "";
    try {
      const auth = await requireMachineAuth(req, ["assets.write"]);
      tenantId = auth.signed.tenantId;
      projectId = auth.signed.projectId;
    } catch (e) {
      if (e instanceof IdempotentReplay) return res.status(e.status).json(e.body);
      await requirePermission(req, "assets.manage");
    }
    const assetId = String(body.assetId ?? "");
    const asset = await Asset.findById(assetId);
    if (!asset) return res.status(404).json(failure("ASSET_NOT_FOUND", "Asset not found"));
    if (projectId && String(asset.projectId) !== projectId) {
      return res.status(403).json(failure("PROJECT_ACCESS_DENIED", "Project access denied"));
    }
    let buf: Buffer;
    try {
      buf = await svc.storage.getObject(asset.objectKey);
    } catch {
      return res.status(400).json(failure("ASSET_NOT_FOUND", "Upload not found in storage"));
    }
    if (buf.length > 20_000_000) {
      asset.status = "rejected";
      await asset.save();
      return res.status(400).json(failure("UPLOAD_TOO_LARGE", "File too large"));
    }
    const mime = detectImageMime(buf);
    if (!mime) {
      asset.status = "rejected";
      await asset.save();
      return res.status(400).json(failure("UPLOAD_INVALID_TYPE", "Invalid image signature"));
    }
    // ClamAV adapter (optional)
    if (svc.env.CLAMAV_HOST) {
      // Placeholder: real INSTREAM scan would go here
    }
    asset.mimeType = mime;
    asset.sizeBytes = buf.length;
    asset.sha256 = sha256Buffer(buf);
    asset.status = "ready";
    // Duplicate detection
    const dup = await Asset.findOne({
      projectId: asset.projectId,
      sha256: asset.sha256,
      _id: { $ne: asset._id },
    }).lean();
    await asset.save();
    await svc.queues["image-ingestion"]?.add("ingest", {
      assetId: String(asset._id),
      tenantId: String(asset.tenantId),
      projectId: String(asset.projectId),
      correlationId: randomUUID(),
      createdAt: new Date().toISOString(),
    });
    return res.json(success({ asset, duplicateOf: dup?._id ? String(dup._id) : null }));
  }

  @Get("/assets/:id")
  async getAsset(@Param("id") id: string, @Req() req: Request, @Res() res: Response) {
    await requirePermission(req, "assets.manage");
    const asset = await Asset.findById(id).lean();
    if (!asset) return res.status(404).json(failure("ASSET_NOT_FOUND", "Asset not found"));
    return res.json(success(asset));
  }

  @Delete("/assets/:id")
  async deleteAsset(@Param("id") id: string, @Req() req: Request, @Res() res: Response) {
    await requirePermission(req, "assets.manage");
    const asset = await Asset.findById(id);
    if (!asset) return res.status(404).json(failure("ASSET_NOT_FOUND", "Asset not found"));
    const svc = getServices();
    await svc.storage.deleteObject(asset.objectKey).catch(() => undefined);
    asset.blocked = true;
    asset.status = "rejected";
    await asset.save();
    return res.json(success({ ok: true }));
  }

  // ---- Posts ----
  @Get("/posts")
  async listPosts(@Req() req: Request, @Res() res: Response, @Query() query: Record<string, string>) {
    await requirePermission(req, "posts.read");
    const page = paginationSchema.parse(query);
    const filter: Record<string, unknown> = { deletedAt: null };
    if (query.projectId) filter.projectId = query.projectId;
    if (query.status) filter.publicationStatus = query.status;
    const [items, total] = await Promise.all([
      PostModel.find(filter)
        .sort({ createdAt: -1 })
        .skip((page.page - 1) * page.limit)
        .limit(page.limit)
        .lean(),
      PostModel.countDocuments(filter),
    ]);
    return res.json(success({ items, total, page: page.page, limit: page.limit }));
  }

  @Post("/posts")
  async createPost(@Body() body: unknown, @Req() req: Request, @Res() res: Response) {
    const parsed = createPostSchema.safeParse(body);
    if (!parsed.success) {
      return res.status(400).json(failure("VALIDATION_ERROR", "Invalid post", parsed.error.issues));
    }
    let tenantId = "";
    let projectId = "";
    let environment = "development";
    let actorId = "";
    let clientId: string | undefined;
    let idemKey: string | undefined;
    try {
      const auth = await requireMachineAuth(req, ["posts.write"]);
      tenantId = auth.signed.tenantId;
      projectId = auth.signed.projectId;
      environment = auth.signed.environment;
      actorId = auth.signed.clientId;
      clientId = auth.signed.clientId;
      idemKey = auth.idemKey;
    } catch (e) {
      if (e instanceof IdempotentReplay) return res.status(e.status).json(e.body);
      const user = await requirePermission(req, "posts.create");
      projectId = String((body as { projectId?: string }).projectId ?? "");
      const project = await Project.findById(projectId);
      if (!project) return res.status(404).json(failure("NOT_FOUND", "Project not found"));
      tenantId = String(project.tenantId);
      environment = project.environment;
      actorId = String(user._id);
    }

    let destinationDomain: string | undefined;
    if (parsed.data.destinationUrl) {
      const check = await validateDestinationUrl(parsed.data.destinationUrl, {
        allowHttpInDev: getServices().env.APP_ENV === "development",
      });
      destinationDomain = check.finalDomain;
      await LinkCheck.create({
        tenantId,
        projectId,
        environment,
        url: parsed.data.destinationUrl,
        ...check,
        checkedAt: new Date(),
        nextCheckAt: new Date(Date.now() + 24 * 3600_000),
      });
    }

    const publicCode = generatePublicCode(10);
    const post = await PostModel.create({
      tenantId,
      projectId,
      environment,
      ...parsed.data,
      publicCode,
      destinationDomain,
      primaryAssetId: parsed.data.assetId,
      assetIds: parsed.data.assetId ? [parsed.data.assetId] : [],
      publicationStatus: "draft",
      createdBy: actorId,
    });
    await PostVersion.create({
      postId: post._id,
      version: 1,
      snapshot: post.toObject(),
      changedBy: actorId,
    });
    const payload = success(post);
    await storeIdempotent(clientId, idemKey, 201, payload);
    return res.status(201).json(payload);
  }

  @Get("/posts/:id")
  async getPost(@Param("id") id: string, @Req() req: Request, @Res() res: Response) {
    await requirePermission(req, "posts.read");
    const post = await PostModel.findById(id).lean();
    if (!post) return res.status(404).json(failure("NOT_FOUND", "Post not found"));
    return res.json(success(post));
  }

  @Patch("/posts/:id")
  async patchPost(
    @Param("id") id: string,
    @Body() body: Record<string, unknown>,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const user = await requirePermission(req, "posts.update");
    const post = await PostModel.findById(id);
    if (!post) return res.status(404).json(failure("NOT_FOUND", "Post not found"));
    Object.assign(post, body);
    post.version += 1;
    await post.save();
    await PostVersion.create({
      postId: post._id,
      version: post.version,
      snapshot: post.toObject(),
      changedBy: user._id,
    });
    await invalidatePostCaches(post);
    return res.json(success(post));
  }

  @Delete("/posts/:id")
  async deletePost(@Param("id") id: string, @Req() req: Request, @Res() res: Response) {
    await requirePermission(req, "posts.delete");
    await PostModel.findByIdAndUpdate(id, { $set: { deletedAt: new Date(), publicationStatus: "archived" } });
    return res.json(success({ ok: true }));
  }

  @Post("/posts/:id/analyze")
  async analyze(@Param("id") id: string, @Req() req: Request, @Res() res: Response) {
    let actor = "system";
    try {
      const auth = await requireMachineAuth(req, ["analysis.run"]);
      actor = auth.signed.clientId;
    } catch (e) {
      if (e instanceof IdempotentReplay) return res.status(e.status).json(e.body);
      const user = await requirePermission(req, "analysis.run");
      actor = String(user._id);
    }
    const post = await PostModel.findById(id);
    if (!post) return res.status(404).json(failure("NOT_FOUND", "Post not found"));
    if (post.analysisStatus === "running") {
      return res.status(409).json(failure("ANALYSIS_ALREADY_RUNNING", "Analysis already running"));
    }
    const analysisId = `an_${randomBytes(10).toString("hex")}`;
    const analysis = await Analysis.create({
      tenantId: post.tenantId,
      projectId: post.projectId,
      environment: post.environment,
      analysisId,
      postId: post._id,
      assetId: post.primaryAssetId,
      status: "queued",
      stage: "queued",
    });
    post.analysisStatus = "running";
    post.publicationStatus = "analyzing";
    await post.save();
    await ReviewTask.deleteMany({ postId: post._id, status: "pending" });
    const svc = getServices();
    await svc.queues["image-analysis"]?.add(
      "analyze",
      {
        analysisId,
        postId: String(post._id),
        assetId: String(post.primaryAssetId ?? ""),
        tenantId: String(post.tenantId),
        projectId: String(post.projectId),
        actorId: actor,
        correlationId: randomUUID(),
        createdAt: new Date().toISOString(),
      },
      { jobId: analysisId },
    );
    return res.json(success({ analysisId, status: "queued", id: String(analysis._id) }));
  }

  @Post("/posts/:id/reanalyze")
  async reanalyze(@Param("id") id: string, @Req() req: Request, @Res() res: Response) {
    return this.analyze(id, req, res);
  }

  @Post("/posts/:id/approve")
  async approve(
    @Param("id") id: string,
    @Body() body: Record<string, unknown>,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const user = await requirePermission(req, "analysis.review");
    const post = await PostModel.findById(id);
    if (!post) return res.status(404).json(failure("NOT_FOUND", "Post not found"));
    const prevCategory = post.categoryId;
    if (body.categoryId) post.categoryId = body.categoryId as never;
    if (body.groupId) post.groupId = body.groupId as never;
    if (body.title) post.title = String(body.title);
    if (body.description) post.description = String(body.description);
    if (body.tags) post.tags = body.tags as string[];
    post.publicationStatus = "approved";
    post.reviewedBy = user._id;
    await post.save();
    await ReviewTask.updateMany({ postId: post._id, status: "pending" }, { $set: { status: "completed" } });
    await TrainingFeedback.create({
      tenantId: post.tenantId,
      projectId: post.projectId,
      environment: post.environment,
      assetId: post.primaryAssetId,
      postId: post._id,
      predictedCategory: String(prevCategory ?? ""),
      correctedCategory: String(post.categoryId ?? ""),
      predictedGroup: "",
      correctedGroup: String(post.groupId ?? ""),
      reviewerId: user._id,
      reason: String(body.reason ?? "approved"),
    });
    await invalidatePostCaches(post);
    return res.json(success(post));
  }

  @Post("/posts/:id/reject")
  async reject(@Param("id") id: string, @Body() body: Record<string, unknown>, @Req() req: Request, @Res() res: Response) {
    const user = await requirePermission(req, "analysis.review");
    const post = await PostModel.findByIdAndUpdate(
      id,
      { $set: { publicationStatus: "rejected", reviewedBy: user._id } },
      { new: true },
    );
    if (!post) return res.status(404).json(failure("NOT_FOUND", "Post not found"));
    await TrainingFeedback.create({
      tenantId: post.tenantId,
      projectId: post.projectId,
      environment: post.environment,
      postId: post._id,
      assetId: post.primaryAssetId,
      reviewerId: user._id,
      reason: String(body.reason ?? "rejected"),
    });
    return res.json(success(post));
  }

  @Post("/posts/:id/publish")
  async publish(@Param("id") id: string, @Req() req: Request, @Res() res: Response) {
    const user = await requirePermission(req, "posts.publish");
    const post = await PostModel.findById(id);
    if (!post) return res.status(404).json(failure("NOT_FOUND", "Post not found"));
    if (!["approved", "scheduled"].includes(post.publicationStatus)) {
      return res.status(400).json(failure("POST_NOT_PUBLISHABLE", "Post is not publishable"));
    }
    if (post.destinationUrl) {
      try {
        await validateDestinationUrl(post.destinationUrl, {
          allowHttpInDev: getServices().env.APP_ENV === "development",
        });
      } catch {
        return res.status(400).json(failure("DESTINATION_UNSAFE", "Destination is unsafe"));
      }
    }
    post.publicationStatus = "published";
    post.publishedAt = new Date();
    post.publishedBy = user._id;
    await post.save();
    await getServices().queues["publishing"]?.add("publish", {
      postId: String(post._id),
      tenantId: String(post.tenantId),
      projectId: String(post.projectId),
      correlationId: randomUUID(),
      createdAt: new Date().toISOString(),
    });
    await invalidatePostCaches(post);
    return res.json(success(post));
  }

  @Post("/posts/:id/unpublish")
  async unpublish(@Param("id") id: string, @Req() req: Request, @Res() res: Response) {
    await requirePermission(req, "posts.publish");
    const post = await PostModel.findByIdAndUpdate(
      id,
      { $set: { publicationStatus: "approved" } },
      { new: true },
    );
    if (!post) return res.status(404).json(failure("NOT_FOUND", "Post not found"));
    await invalidatePostCaches(post);
    return res.json(success(post));
  }

  @Post("/posts/:id/schedule")
  async schedule(
    @Param("id") id: string,
    @Body() body: { scheduledAt?: string },
    @Req() req: Request,
    @Res() res: Response,
  ) {
    await requirePermission(req, "posts.publish");
    const post = await PostModel.findByIdAndUpdate(
      id,
      {
        $set: {
          publicationStatus: "scheduled",
          scheduledAt: body.scheduledAt ? new Date(body.scheduledAt) : new Date(),
        },
      },
      { new: true },
    );
    if (!post) return res.status(404).json(failure("NOT_FOUND", "Post not found"));
    return res.json(success(post));
  }

  @Post("/posts/:id/generate-social-assets")
  async genSocial(@Param("id") id: string, @Req() req: Request, @Res() res: Response) {
    await requirePermission(req, "socialCards.manage");
    const post = await PostModel.findById(id);
    if (!post) return res.status(404).json(failure("NOT_FOUND", "Post not found"));
    const svc = getServices();
    const cards: any[] = [];
    for (const formatKey of Object.keys(SOCIAL_FORMATS) as (keyof typeof SOCIAL_FORMATS)[]) {
      const buf = await renderSocialCard(formatKey, {
        title: post.title,
        description: post.description ?? "",
        brand: "Maraaj.tech",
        category: String(post.categoryId ?? ""),
        domain: post.destinationDomain ?? "maraaj.tech",
        locale: "en",
        dir: "ltr",
        palette: TEMPLATE_PALETTES.general,
      });
      const filename = versionedFilename({
        postId: String(post._id),
        locale: "en",
        format: formatKey,
        version: post.version,
      });
      const key = svc.storage.buildObjectKey({
        tenantId: String(post.tenantId),
        projectId: String(post.projectId),
        kind: "social",
        filename,
      });
      await svc.storage.putObject(key, buf, "image/jpeg");
      const card = await SocialCard.create({
        tenantId: post.tenantId,
        projectId: post.projectId,
        environment: post.environment,
        postId: post._id,
        format: formatKey,
        width: SOCIAL_FORMATS[formatKey].width,
        height: SOCIAL_FORMATS[formatKey].height,
        locale: "en",
        objectKey: key,
        templateVersion: 1,
        version: post.version,
      });
      cards.push(card);
    }
    post.socialCardIds = cards.map((c) => c._id);
    const header = cards.find((c) => c.format === "website_header");
    if (header) post.headerImageId = header._id;
    await post.save();
    await invalidatePostCaches(post);
    return res.json(success({ cards }));
  }

  @Post("/posts/:id/generate-qr")
  async genQr(@Param("id") id: string, @Req() req: Request, @Res() res: Response) {
    await requirePermission(req, "qr.manage");
    const post = await PostModel.findById(id);
    if (!post) return res.status(404).json(failure("NOT_FOUND", "Post not found"));
    const svc = getServices();
    const publicCode = post.publicCode || generatePublicCode(10);
    if (!post.publicCode) {
      post.publicCode = publicCode;
      await post.save();
    }
    const url = buildGoUrl(svc.env.PUBLIC_WEB_URL, publicCode, "q");
    const png = await generateQrPng(url);
    const key = svc.storage.buildObjectKey({
      tenantId: String(post.tenantId),
      projectId: String(post.projectId),
      kind: "qr",
      filename: `qr-${publicCode}.png`,
    });
    await svc.storage.putObject(key, png, "image/png");
    const qr = await QrCode.findOneAndUpdate(
      { postId: post._id },
      {
        $set: {
          tenantId: post.tenantId,
          projectId: post.projectId,
          environment: post.environment,
          publicCode,
          destinationType: "post",
          destinationId: post._id,
          active: true,
          designObjectKey: key,
        },
      },
      { upsert: true, new: true },
    );
    await invalidatePostCaches(post);
    return res.json(success({ qr, url, svg: await generateQrSvg(url) }));
  }

  @Get("/posts/:id/analytics")
  async postAnalytics(@Param("id") id: string, @Req() req: Request, @Res() res: Response) {
    await requirePermission(req, "analytics.read");
    const events = await VisitorEvent.aggregate([
      { $match: { postId: new (await import("mongoose")).Types.ObjectId(id) } },
      { $group: { _id: "$type", count: { $sum: 1 } } },
    ]);
    return res.json(success({ events }));
  }

  @Get("/posts/:id/revisions")
  async revisions(@Param("id") id: string, @Req() req: Request, @Res() res: Response) {
    await requirePermission(req, "posts.read");
    const versions = await PostVersion.find({ postId: id }).sort({ version: -1 }).lean();
    return res.json(success(versions));
  }

  // ---- Analysis jobs ----
  @Get("/analysis-jobs/:id")
  async getAnalysis(@Param("id") id: string, @Req() req: Request, @Res() res: Response) {
    await requirePermission(req, "analysis.read");
    const analysis = await Analysis.findOne({ analysisId: id }).lean();
    if (!analysis) return res.status(404).json(failure("NOT_FOUND", "Analysis not found"));
    return res.json(success(analysis));
  }

  @Get("/analysis-jobs/:id/results")
  async analysisResults(@Param("id") id: string, @Req() req: Request, @Res() res: Response) {
    return this.getAnalysis(id, req, res);
  }

  @Post("/analysis-jobs/:id/cancel")
  async cancelAnalysis(@Param("id") id: string, @Req() req: Request, @Res() res: Response) {
    await requirePermission(req, "analysis.run");
    await Analysis.findOneAndUpdate({ analysisId: id }, { $set: { status: "cancelled" } });
    return res.json(success({ cancelled: true }));
  }

  @Post("/analysis-jobs/:id/retry")
  async retryAnalysis(@Param("id") id: string, @Req() req: Request, @Res() res: Response) {
    await requirePermission(req, "analysis.run");
    const analysis = await Analysis.findOne({ analysisId: id });
    if (!analysis) return res.status(404).json(failure("NOT_FOUND", "Analysis not found"));
    analysis.status = "queued";
    await analysis.save();
    await getServices().queues["image-analysis"]?.add("analyze", {
      analysisId: id,
      postId: String(analysis.postId),
      assetId: String(analysis.assetId ?? ""),
      tenantId: String(analysis.tenantId),
      projectId: String(analysis.projectId),
      correlationId: randomUUID(),
      createdAt: new Date().toISOString(),
    });
    return res.json(success({ queued: true }));
  }

  // ---- Review queue ----
  @Get("/review")
  async reviewQueue(@Req() req: Request, @Res() res: Response) {
    await requirePermission(req, "analysis.review");
    const tasks = await ReviewTask.find({ status: "pending" }).sort({ createdAt: 1 }).limit(50).lean();
    const postIds = tasks.map((t) => t.postId);
    const posts = await PostModel.find({ _id: { $in: postIds } }).lean();
    const analyses = await Analysis.find({ postId: { $in: postIds } }).lean();
    return res.json(success({ tasks, posts, analyses }));
  }

  // ---- QR ----
  @Get("/qr")
  async listQr(@Req() req: Request, @Res() res: Response) {
    await requirePermission(req, "qr.manage");
    return res.json(success(await QrCode.find().sort({ createdAt: -1 }).limit(100).lean()));
  }

  @Post("/qr")
  async createQr(@Body() body: Record<string, unknown>, @Req() req: Request, @Res() res: Response) {
    await requirePermission(req, "qr.manage");
    const postId = String(body.postId ?? "");
    req.url = `/api/v1/posts/${postId}/generate-qr`;
    return this.genQr(postId, req, res);
  }

  @Get("/qr/:id")
  async getQr(@Param("id") id: string, @Req() req: Request, @Res() res: Response) {
    await requirePermission(req, "qr.manage");
    const qr = await QrCode.findById(id).lean();
    if (!qr) return res.status(404).json(failure("NOT_FOUND", "QR not found"));
    return res.json(success(qr));
  }

  @Patch("/qr/:id")
  async patchQr(
    @Param("id") id: string,
    @Body() body: Record<string, unknown>,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    await requirePermission(req, "qr.manage");
    const qr = await QrCode.findByIdAndUpdate(id, { $set: body }, { new: true });
    if (!qr) return res.status(404).json(failure("NOT_FOUND", "QR not found"));
    return res.json(success(qr));
  }

  @Delete("/qr/:id")
  async deleteQr(@Param("id") id: string, @Req() req: Request, @Res() res: Response) {
    await requirePermission(req, "qr.manage");
    await QrCode.findByIdAndUpdate(id, { $set: { active: false } });
    return res.json(success({ ok: true }));
  }

  @Get("/qr/:id/analytics")
  async qrAnalytics(@Param("id") id: string, @Req() req: Request, @Res() res: Response) {
    await requirePermission(req, "analytics.read");
    const qr = await QrCode.findById(id).lean();
    if (!qr) return res.status(404).json(failure("NOT_FOUND", "QR not found"));
    const scans = await VisitorEvent.countDocuments({ qrId: id, type: "qr_scan" });
    return res.json(success({ scanCount: scans, uniqueVisitorCount: qr.uniqueVisitorCount }));
  }

  // ---- Webhooks ----
  @Get("/webhooks")
  async listWebhooks(@Req() req: Request, @Res() res: Response) {
    await requirePermission(req, "webhooks.manage");
    return res.json(success(await Webhook.find().lean()));
  }

  @Post("/webhooks")
  async createWebhook(@Body() body: Record<string, unknown>, @Req() req: Request, @Res() res: Response) {
    const user = await requirePermission(req, "webhooks.manage");
    const svc = getServices();
    const project = await Project.findById(String(body.projectId ?? ""));
    if (!project) return res.status(404).json(failure("NOT_FOUND", "Project not found"));
    const secret = randomBytes(32).toString("hex");
    const secretEnc = await svc.crypto.encrypt(secret);
    const wh = await Webhook.create({
      tenantId: project.tenantId,
      projectId: project._id,
      environment: project.environment,
      url: String(body.url),
      events: (body.events as string[]) ?? ["post.published"],
      secretEnc,
      allowedDomains: (body.allowedDomains as string[]) ?? [],
    });
    await writeAudit({
      tenantId: String(project.tenantId),
      projectId: String(project._id),
      actorType: "user",
      actorId: String(user._id),
      action: "webhook.create",
      entityType: "webhook",
      entityId: String(wh._id),
    });
    return res.status(201).json(success({ webhook: wh, secret }));
  }

  @Patch("/webhooks/:id")
  async patchWebhook(
    @Param("id") id: string,
    @Body() body: Record<string, unknown>,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    await requirePermission(req, "webhooks.manage");
    const wh = await Webhook.findByIdAndUpdate(id, { $set: body }, { new: true });
    if (!wh) return res.status(404).json(failure("NOT_FOUND", "Webhook not found"));
    return res.json(success(wh));
  }

  @Delete("/webhooks/:id")
  async deleteWebhook(@Param("id") id: string, @Req() req: Request, @Res() res: Response) {
    await requirePermission(req, "webhooks.manage");
    await Webhook.findByIdAndUpdate(id, { $set: { active: false } });
    return res.json(success({ ok: true }));
  }

  @Post("/webhooks/:id/test")
  async testWebhook(@Param("id") id: string, @Req() req: Request, @Res() res: Response) {
    await requirePermission(req, "webhooks.manage");
    await getServices().queues["webhook-delivery"]?.add("deliver", {
      webhookId: id,
      event: "webhook.test",
      payload: { ok: true },
      correlationId: randomUUID(),
      tenantId: "",
      projectId: "",
      createdAt: new Date().toISOString(),
    });
    return res.json(success({ queued: true }));
  }

  @Get("/webhooks/:id/deliveries")
  async webhookDeliveries(@Param("id") id: string, @Req() req: Request, @Res() res: Response) {
    await requirePermission(req, "webhooks.manage");
    return res.json(success(await WebhookDelivery.find({ webhookId: id }).sort({ createdAt: -1 }).limit(50).lean()));
  }

  @Post("/webhooks/deliveries/:id/replay")
  async replayDelivery(@Param("id") id: string, @Req() req: Request, @Res() res: Response) {
    await requirePermission(req, "webhooks.manage");
    const d = await WebhookDelivery.findOne({ deliveryId: id });
    if (!d) return res.status(404).json(failure("NOT_FOUND", "Delivery not found"));
    await getServices().queues["webhook-delivery"]?.add("deliver", {
      webhookId: String(d.webhookId),
      event: d.event,
      deliveryId: d.deliveryId,
      correlationId: randomUUID(),
      tenantId: "",
      projectId: "",
      createdAt: new Date().toISOString(),
    });
    return res.json(success({ queued: true }));
  }

  // ---- Providers ----
  @Get("/providers")
  async listProviders(@Req() req: Request, @Res() res: Response) {
    await requirePermission(req, "providers.manage");
    return res.json(success(await AiProvider.find().select("-credentialsEnc").lean()));
  }

  @Post("/providers")
  async createProvider(@Body() body: Record<string, unknown>, @Req() req: Request, @Res() res: Response) {
    const user = await requirePermission(req, "providers.manage");
    const svc = getServices();
    const secret = String(body.apiKey ?? "");
    const credentialsEnc = secret ? await svc.crypto.encrypt(secret) : undefined;
    const provider = await AiProvider.create({
      tenantId: user.tenantId,
      name: String(body.name),
      type: String(body.type),
      adapter: String(body.adapter ?? "local"),
      credentialsEnc,
      priority: Number(body.priority ?? 100),
    });
    return res.status(201).json(success({ id: provider._id, name: provider.name, type: provider.type }));
  }

  @Patch("/providers/:id")
  async patchProvider(
    @Param("id") id: string,
    @Body() body: Record<string, unknown>,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    await requirePermission(req, "providers.manage");
    const update = { ...body };
    delete update.apiKey;
    const provider = await AiProvider.findByIdAndUpdate(id, { $set: update }, { new: true }).select(
      "-credentialsEnc",
    );
    if (!provider) return res.status(404).json(failure("NOT_FOUND", "Provider not found"));
    return res.json(success(provider));
  }

  @Post("/providers/:id/test")
  async testProvider(@Param("id") id: string, @Req() req: Request, @Res() res: Response) {
    await requirePermission(req, "providers.manage");
    const svc = getServices();
    try {
      const r = await fetch(`${svc.env.AI_SERVICE_URL}/health`);
      const ok = r.ok;
      await AiProvider.findByIdAndUpdate(id, {
        $set: { healthStatus: ok ? "healthy" : "down", lastHealthCheckAt: new Date() },
      });
      return res.json(success({ ok }));
    } catch {
      return res.json(success({ ok: false }));
    }
  }

  @Post("/providers/:id/disable")
  async disableProvider(@Param("id") id: string, @Req() req: Request, @Res() res: Response) {
    await requirePermission(req, "providers.manage");
    await AiProvider.findByIdAndUpdate(id, { $set: { enabled: false } });
    return res.json(success({ disabled: true }));
  }

  // ---- Security / Audit / Dashboard ----
  @Get("/security/events")
  async securityEvents(@Req() req: Request, @Res() res: Response) {
    await requirePermission(req, "security.read");
    const events = await SecurityEvent.find().sort({ createdAt: -1 }).limit(100).lean();
    return res.json(success(events));
  }

  @Post("/security/events/:id/resolve")
  async resolveSecurity(
    @Param("id") id: string,
    @Body() body: { note?: string },
    @Req() req: Request,
    @Res() res: Response,
  ) {
    await requirePermission(req, "security.manage");
    await SecurityEvent.findByIdAndUpdate(id, {
      $set: { status: "resolved" },
      $push: { notes: body.note ?? "resolved" },
    });
    return res.json(success({ resolved: true }));
  }

  @Get("/audit")
  async audit(@Req() req: Request, @Res() res: Response) {
    await requirePermission(req, "audit.read");
    const logs = await AuditLog.find().sort({ timestamp: -1 }).limit(100).lean();
    return res.json(success(logs));
  }

  @Get("/dashboard/overview")
  async overview(@Req() req: Request, @Res() res: Response) {
    await requireUser(req);
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);
    const [
      analysesToday,
      analysesMonth,
      pendingReviews,
      publishedPosts,
      qrScans,
      securityAlerts,
      recentAudit,
    ] = await Promise.all([
      Analysis.countDocuments({ createdAt: { $gte: startOfDay } }),
      Analysis.countDocuments({ createdAt: { $gte: startOfMonth } }),
      ReviewTask.countDocuments({ status: "pending" }),
      PostModel.countDocuments({ publicationStatus: "published" }),
      VisitorEvent.countDocuments({ type: "qr_scan", createdAt: { $gte: startOfMonth } }),
      SecurityEvent.countDocuments({ status: "open", severity: { $in: ["high", "critical"] } }),
      AuditLog.find().sort({ timestamp: -1 }).limit(10).lean(),
    ]);
    const uniqueVisitors = await VisitorEvent.distinct("anonymizedVisitorId", {
      createdAt: { $gte: startOfMonth },
    });
    const conversions = await VisitorEvent.countDocuments({
      type: "conversion",
      createdAt: { $gte: startOfMonth },
    });
    return res.json(
      success({
        analysesToday,
        analysesMonth,
        pendingReviews,
        publishedPosts,
        qrScans,
        uniqueVisitors: uniqueVisitors.length,
        conversions,
        securityAlerts,
        recentAudit,
        failedJobs: await Analysis.countDocuments({ status: "failed" }),
        providerCosts: 0,
      }),
    );
  }

  @Get("/training-feedback")
  async trainingFeedback(@Req() req: Request, @Res() res: Response) {
    await requirePermission(req, "analysis.review");
    return res.json(success(await TrainingFeedback.find().sort({ createdAt: -1 }).limit(100).lean()));
  }

  @Post("/training-feedback/export")
  async exportTraining(@Req() req: Request, @Res() res: Response) {
    await requirePermission(req, "training.export");
    await getServices().queues["dataset-export"]?.add("export", {
      format: "jsonl",
      correlationId: randomUUID(),
      tenantId: "",
      projectId: "",
      createdAt: new Date().toISOString(),
    });
    return res.json(success({ queued: true }));
  }

  @Get("/users/me")
  async me(@Req() req: Request, @Res() res: Response) {
    const user = await requireUser(req);
    return res.json(
      success({
        id: String(user._id),
        email: user.email,
        name: user.name,
        roles: user.roles,
        permissions: user.permissions,
      }),
    );
  }

  @Get("/roles")
  async roles(@Req() req: Request, @Res() res: Response) {
    await requirePermission(req, "roles.manage");
    return res.json(success(ROLE_PERMISSIONS));
  }
}

function handleErr(err: unknown, res: Response) {
  if (err instanceof AppError) {
    return res.status(err.status).json(failure(err.code, err.message, err.details));
  }
  console.error(err);
  return res.status(500).json(failure("INTERNAL_ERROR", "An unexpected error occurred"));
}

async function invalidatePostCaches(post: { projectId: unknown; publicCode?: string | null }) {
  const svc = getServices();
  if (!post.publicCode) return;
  const locales = ["en", "ar", "fr"];
  await svc.cache.del(
    ...locales.map((l) => svc.cache.pageKey(String(post.projectId), post.publicCode!, l)),
  );
}

// silence unused import warning in some builds
void hmacSha256Base64;
void sha256Hex;
void requireMachineAuth;
