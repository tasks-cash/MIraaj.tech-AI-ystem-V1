
import { connectMongo, disconnectMongo, Tenant, Project, Category, SocialTemplate, AiProvider } from "@maraaj/database";
import { DEFAULT_CATEGORIES, ROLE_PERMISSIONS } from "@maraaj/config";
import { initServices } from "../services/app-services";

async function main() {
  const svc = await initServices();
  await connectMongo(svc.env.MONGODB_URI);

  let tenant = await Tenant.findOne({ slug: "maraaj-tech" });
  if (!tenant) {
    tenant = await Tenant.create({ name: "Maraaj.tech", slug: "maraaj-tech", active: true });
  }

  const projectsSpec = [
    { name: "Maraaj Main", slug: "maraaj-main" },
    { name: "Tasks.cash", slug: "tasks-cash" },
  ];
  const envs = ["development", "staging", "production"] as const;

  for (const p of projectsSpec) {
    for (const environment of envs) {
      let project = await Project.findOne({ tenantId: tenant._id, slug: p.slug, environment });
      if (!project) {
        project = await Project.create({
          tenantId: tenant._id,
          name: p.name,
          slug: p.slug,
          environment,
          enabledModules: ["analysis", "social", "qr", "tracking", "webhooks"],
          active: true,
          privacyMode: "balanced",
        });
      }
      for (const [i, name] of DEFAULT_CATEGORIES.entries()) {
        const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-");
        const exists = await Category.findOne({ projectId: project._id, slug });
        if (!exists) {
          await Category.create({
            tenantId: tenant._id,
            projectId: project._id,
            environment,
            name,
            slug,
            displayOrder: i,
            active: true,
          });
        }
      }
      const templates = [
        { name: "AI Blue Violet", slug: "ai-blue-violet", categoryHint: "artificial-intelligence" },
        { name: "Medical White Green", slug: "medical-white-green", categoryHint: "dentistry" },
        { name: "Entertainment Vibrant", slug: "entertainment-vibrant", categoryHint: "entertainment" },
        { name: "Technology Navy Cyan", slug: "technology-navy-cyan", categoryHint: "technology" },
        { name: "General Maraaj Brand", slug: "general-maraaj-brand", categoryHint: "other" },
      ];
      for (const t of templates) {
        const exists = await SocialTemplate.findOne({ projectId: project._id, slug: t.slug });
        if (!exists) {
          await SocialTemplate.create({
            tenantId: tenant._id,
            projectId: project._id,
            environment,
            ...t,
            active: true,
            version: 1,
          });
        }
      }
    }
  }

  const existingProvider = await AiProvider.findOne({ name: "Local OCR" });
  if (!existingProvider) {
    await AiProvider.create({
      tenantId: tenant._id,
      name: "Local OCR",
      type: "ocr",
      adapter: "tesseract",
      priority: 10,
      enabled: true,
      healthStatus: "unknown",
    });
  }

  console.log("Seed complete");
  console.log("Tenant:", tenant.slug);
  console.log("Roles available:", Object.keys(ROLE_PERMISSIONS).join(", "));
  console.log("Create an admin with: pnpm admin:create");
  await disconnectMongo();
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
