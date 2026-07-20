/**
 * Homepage-specific copy for the shared [country]/[locale] homepage.
 * Verified locales: en, ar, fr. Other locales fall back to English.
 */

export interface HomeCopy {
  hero: {
    eyebrow: string;
    title: string;
    description: string;
    primary: string;
    secondary: string;
    assurances: string[];
  };
  trust: {
    eyebrow: string;
    title: string;
    items: string[];
  };
  overview: {
    eyebrow: string;
    title: string;
    description: string;
    steps: Array<{ title: string; body: string }>;
    note: string;
  };
  coreSolutions: {
    eyebrow: string;
    title: string;
    description: string;
    items: Array<{ title: string; body: string; status: "available" | "capability" }>;
    statusAvailable: string;
    statusCapability: string;
  };
  analysis: {
    eyebrow: string;
    title: string;
    description: string;
    items: string[];
  };
  intelligence: {
    eyebrow: string;
    title: string;
    description: string;
    exampleLabel: string;
    fields: Array<{ label: string; value: string }>;
    signals: string[];
  };
  matching: {
    eyebrow: string;
    title: string;
    description: string;
    basis: string[];
    categories: string[];
    viewMore: string;
    viewLess: string;
  };
  automation: {
    eyebrow: string;
    title: string;
    description: string;
    items: string[];
    distinctions: Array<{ title: string; body: string }>;
  };
  industries: {
    eyebrow: string;
    title: string;
    description: string;
    items: Array<{ title: string; solutions: string[] }>;
  };
  multilingual: {
    eyebrow: string;
    title: string;
    description: string;
    points: string[];
    demoLabel: string;
    demoNote: string;
    demoSamples: Array<{ locale: string; label: string; sample: string }>;
  };
  security: {
    eyebrow: string;
    title: string;
    description: string;
    items: string[];
  };
  explorer: {
    eyebrow: string;
    title: string;
    description: string;
    disclaimer: string;
    stepBusiness: string;
    stepNeed: string;
    stepMaturity: string;
    stepResult: string;
    businessTypes: string[];
    needs: string[];
    maturity: string[];
    resultTitle: string;
    resultBody: string;
    categories: string[];
    ctaPrimary: string;
    ctaSecondary: string;
    next: string;
    back: string;
    restart: string;
  };
  why: {
    eyebrow: string;
    title: string;
    description: string;
    items: Array<{ title: string; body: string }>;
  };
  implementation: {
    eyebrow: string;
    title: string;
    description: string;
    steps: Array<{ title: string; body: string }>;
  };
  finalCta: {
    title: string;
    description: string;
    primary: string;
    secondary: string;
  };
  marketLine: string;
}

export const en: HomeCopy = {
  hero: {
    eyebrow: "AI Systems for Real Business Operations",
    title: "Transform Your Business With Intelligent Systems",
    description:
      "Miraaj.tech analyzes business context, identifies operational needs and helps organizations build secure AI, automation and digital solutions adapted to their market.",
    primary: "Explore AI Solutions",
    secondary: "Discover How It Works",
    assurances: [
      "Business-context analysis",
      "Explainable recommendations",
      "Human review for sensitive cases",
    ],
  },
  trust: {
    eyebrow: "Capability foundation",
    title: "Built for serious operational work",
    items: [
      "Multilingual architecture",
      "OCR and document analysis",
      "Image and media intelligence",
      "Business-context analysis",
      "Deterministic service matching",
      "Human-review workflow",
      "Secure private processing",
      "Explainable recommendations",
    ],
  },
  overview: {
    eyebrow: "AI system overview",
    title: "From evidence to explainable recommendations",
    description:
      "Miraaj.tech follows a structured intelligence pipeline. Results remain reviewable—especially when confidence is low or the domain is regulated.",
    steps: [
      {
        title: "Analyze",
        body: "Process documents, images, text and multilingual business evidence.",
      },
      {
        title: "Understand",
        body: "Identify business type, audience, context, needs, maturity and constraints.",
      },
      {
        title: "Match",
        body: "Compare the profile against approved Miraaj.tech solutions.",
      },
      {
        title: "Recommend",
        body: "Provide explainable recommendations, prerequisites and implementation phases.",
      },
      {
        title: "Review",
        body: "Route sensitive, regulated or low-confidence cases to human review.",
      },
    ],
    note: "Automated output is advisory. NestJS validation and human approval remain authoritative.",
  },
  coreSolutions: {
    eyebrow: "Core AI solutions",
    title: "Practical AI capabilities for business operations",
    description:
      "These solution areas describe how Miraaj.tech designs AI work around real processes. Availability depends on scope, readiness and approved delivery.",
    items: [
      {
        title: "Custom AI Assistant",
        body: "A private assistant adapted to company processes, knowledge and permissions.",
        status: "available",
      },
      {
        title: "Customer Support AI",
        body: "Helps organize, classify and respond to customer requests with clear handoff points.",
        status: "available",
      },
      {
        title: "Sales AI Assistant",
        body: "Supports lead qualification, follow-up and sales workflows.",
        status: "capability",
      },
      {
        title: "Internal Knowledge Assistant",
        body: "Searches approved internal documents and operational knowledge.",
        status: "available",
      },
      {
        title: "Document Analysis AI",
        body: "Extracts and structures information from documents and PDFs.",
        status: "available",
      },
      {
        title: "Image and Media Analysis",
        body: "Understands visual business content, text, language and context.",
        status: "available",
      },
      {
        title: "Business Intelligence AI",
        body: "Builds a structured profile of business needs, objectives and maturity.",
        status: "available",
      },
      {
        title: "Service Recommendation Engine",
        body: "Matches business evidence with appropriate approved Miraaj.tech services.",
        status: "available",
      },
      {
        title: "Workflow Automation AI",
        body: "Coordinates repetitive business processes and system integrations.",
        status: "available",
      },
      {
        title: "Multilingual AI",
        body: "Supports multilingual evidence, language detection, RTL and LTR workflows.",
        status: "available",
      },
      {
        title: "Reporting and Insight AI",
        body: "Converts structured data into useful operational insights.",
        status: "capability",
      },
      {
        title: "AI Integration Services",
        body: "Connects suitable AI providers and APIs to existing business systems.",
        status: "available",
      },
    ],
    statusAvailable: "Delivery-ready capability",
    statusCapability: "Designed with project scoping",
  },
  analysis: {
    eyebrow: "Media and document intelligence",
    title: "Secure analysis for business evidence",
    description:
      "The Miraaj.tech media pipeline processes approved media types privately, extracts signals and scores confidence before recommendations continue.",
    items: [
      "Secure media upload architecture",
      "JPEG, PNG, WebP and PDF processing",
      "OCR with multilingual support",
      "Arabic, English and French verified content paths",
      "Extended multilingual architecture",
      "Script and language detection",
      "Mixed-language detection",
      "Metadata removal and image normalization",
      "Exact and near-duplicate detection",
      "Business and audience signal extraction",
      "Confidence scoring",
      "Human-review rules for uncertain cases",
    ],
  },
  intelligence: {
    eyebrow: "Business intelligence",
    title: "Understand the business before recommending solutions",
    description:
      "Structured profiling turns evidence into a usable business context—without inventing customer data.",
    exampleLabel: "Example profile (synthetic demonstration)",
    fields: [
      { label: "Business type", value: "Dental clinic" },
      { label: "Audience", value: "Clinic decision-makers" },
      { label: "Maturity", value: "Growing digital presence" },
      { label: "Top needs", value: "Booking · Operations · Reminders" },
      { label: "Recommended phase", value: "Foundation then automation" },
      { label: "Review status", value: "Medical domain review required" },
    ],
    signals: [
      "Business type and industry",
      "Organization type and stage",
      "Digital maturity",
      "Professional or consumer context",
      "Decision-maker likelihood",
      "Operational needs and pain points",
      "Objectives and automation readiness",
      "Security and payment readiness",
      "Market and language context",
      "Promotion eligibility",
    ],
  },
  matching: {
    eyebrow: "Service recommendation",
    title: "Deterministic matching against approved solutions",
    description:
      "Recommendations are driven by evidence, eligibility and service availability—not free-form invention.",
    basis: [
      "Business evidence",
      "Audience and decision-maker relevance",
      "Industry fit",
      "Needs, pain points and objectives",
      "Digital maturity",
      "Market and language",
      "Prerequisites and compliance",
      "Service availability",
    ],
    categories: [
      "Build",
      "Business management",
      "Artificial intelligence",
      "Automation",
      "Payments",
      "Cybersecurity",
      "Cloud infrastructure",
      "Data and analytics",
      "Growth and media",
      "Consulting and transformation",
    ],
    viewMore: "View more solution categories",
    viewLess: "Show fewer categories",
  },
  automation: {
    eyebrow: "Automation solutions",
    title: "Reliable workflows with clear human control",
    description:
      "Automation reduces repetitive work. AI assistance and human approval remain distinct roles.",
    items: [
      "WhatsApp workflow automation",
      "Email automation",
      "SMS integration",
      "Telegram automation",
      "Lead follow-up",
      "Booking automation",
      "Appointment reminders",
      "Payment reminders",
      "Invoice automation",
      "Approval workflows",
      "Employee onboarding",
      "Customer onboarding",
      "Data synchronization",
      "Spreadsheet automation",
      "Report generation",
      "Notification systems",
      "API workflow automation",
      "Custom business workflows",
    ],
    distinctions: [
      {
        title: "AI assistance",
        body: "Suggests, classifies or drafts within approved boundaries.",
      },
      {
        title: "Deterministic automation",
        body: "Runs stable process rules and integrations consistently.",
      },
      {
        title: "Human approval",
        body: "Keeps judgment, compliance and exceptions under control.",
      },
    ],
  },
  industries: {
    eyebrow: "Industry solutions",
    title: "Solutions shaped around professional decision-makers",
    description:
      "Industry packages focus on operators and managers—not unsuitable consumer targeting.",
    items: [
      {
        title: "Healthcare and dental clinics",
        solutions: [
          "Clinic management",
          "Appointment booking",
          "Patient workflow",
          "WhatsApp reminders",
          "Reporting",
          "Access control",
          "Backup",
        ],
      },
      {
        title: "Education and schools",
        solutions: [
          "School management",
          "Attendance",
          "Scheduling",
          "Payments",
          "Parent communication",
          "Employee management",
          "Reporting",
        ],
      },
      {
        title: "Restaurants and hospitality",
        solutions: [
          "Restaurant management",
          "Reservations",
          "Inventory",
          "Orders",
          "Customer communication",
          "Analytics",
        ],
      },
      {
        title: "Retail and e-commerce",
        solutions: [
          "Storefronts",
          "Catalog operations",
          "Checkout integration",
          "Order workflows",
          "Analytics",
        ],
      },
      {
        title: "Real estate",
        solutions: [
          "Listing platforms",
          "Lead workflows",
          "CRM integrations",
          "Automation",
        ],
      },
      {
        title: "Construction",
        solutions: [
          "Project tracking",
          "Document workflows",
          "Team coordination",
          "Reporting",
        ],
      },
      {
        title: "Logistics and fleet",
        solutions: [
          "Operations dashboards",
          "Route and status tracking",
          "Notifications",
          "Reporting",
        ],
      },
      {
        title: "Professional services",
        solutions: [
          "Corporate web",
          "Client portals",
          "Scheduling",
          "Knowledge assistants",
        ],
      },
      {
        title: "Financial operations",
        solutions: [
          "Provider-aware payments",
          "Reconciliation support",
          "Compliance-aware workflows",
          "Reporting",
        ],
      },
      {
        title: "Multi-branch businesses",
        solutions: [
          "Branch dashboards",
          "Role-based access",
          "Data isolation",
          "Central monitoring",
        ],
      },
    ],
  },
  multilingual: {
    eyebrow: "Multilingual intelligence",
    title: "Language, locale and market stay separate",
    description:
      "Miraaj.tech treats country, language and locale as distinct dimensions, with RTL and LTR support and honest quality boundaries.",
    points: [
      "Language and country are handled separately",
      "Locale is handled separately from language",
      "RTL and LTR are supported",
      "Mixed-language evidence is supported",
      "Arabic, English and French are initially verified",
      "Additional languages follow the global architecture",
      "Human review may be required for lower-confidence languages or locales",
    ],
    demoLabel: "Language demonstration",
    demoNote:
      "This preview does not change your current website locale or route.",
    demoSamples: [
      {
        locale: "en",
        label: "English",
        sample: "Analyze business evidence and recommend suitable systems.",
      },
      {
        locale: "ar",
        label: "العربية",
        sample: "حلّل أدلة العمل واقترح الأنظمة المناسبة بوضوح.",
      },
      {
        locale: "fr",
        label: "Français",
        sample:
          "Analysez les preuves métier et recommandez les systèmes adaptés.",
      },
    ],
  },
  security: {
    eyebrow: "Security and human review",
    title: "Designed to reduce risk—not to claim perfection",
    description:
      "Sensitive work stays private, reviewable and permission-aware. Absolute security claims are not used.",
    items: [
      "Private infrastructure topology",
      "Secure service-to-service communication",
      "Role-based permissions",
      "Structured audit information",
      "Private media storage",
      "Controlled provider access",
      "Prompt-injection protection",
      "Sensitive-content review",
      "Regulated-domain review",
      "Explainable confidence",
      "Human approval workflows",
      "No automatic B2B targeting of unsuitable consumer groups",
    ],
  },
  explorer: {
    eyebrow: "AI solution explorer",
    title: "Explore relevant solution directions",
    description:
      "A lightweight frontend guide to help visitors start a conversation. It is not the production matching engine.",
    disclaimer:
      "Initial solution explorer · No answers are stored · Not a final recommendation",
    stepBusiness: "Select business type",
    stepNeed: "Select primary need",
    stepMaturity: "Select business maturity",
    stepResult: "Suggested categories",
    businessTypes: [
      "Clinic",
      "School",
      "Restaurant",
      "Retail",
      "E-commerce",
      "Real estate",
      "Construction",
      "Logistics",
      "Professional services",
      "Multi-branch business",
      "Other",
    ],
    needs: [
      "Build a website or application",
      "Manage operations",
      "Automate workflows",
      "Add an AI assistant",
      "Improve customer support",
      "Improve sales",
      "Analyze documents",
      "Improve security",
      "Add payment workflows",
      "Create dashboards and reports",
    ],
    maturity: [
      "Starting",
      "Basic digital presence",
      "Growing",
      "Integrated",
      "Advanced",
    ],
    resultTitle: "Suggested solution categories",
    resultBody:
      "Based on your selections, these categories are a useful starting point for discovery. A specialist review still decides the final scope.",
    categories: [
      "Build",
      "Business management",
      "Artificial intelligence",
      "Automation",
      "Payments",
      "Cybersecurity",
    ],
    ctaPrimary: "Start your project",
    ctaSecondary: "Explore services",
    next: "Continue",
    back: "Back",
    restart: "Start over",
  },
  why: {
    eyebrow: "Why Miraaj.tech",
    title: "Business-first AI architecture",
    description:
      "The difference is not louder marketing—it is clearer structure, review and delivery discipline.",
    items: [
      {
        title: "Business-first AI",
        body: "Solutions start from operations, constraints and decision-makers.",
      },
      {
        title: "Explainable recommendations",
        body: "Matching stays tied to evidence, eligibility and approved services.",
      },
      {
        title: "Multilingual foundation",
        body: "Language, locale and market are modeled separately with RTL support.",
      },
      {
        title: "Human review for sensitive decisions",
        body: "Regulated, payment and low-confidence cases stay under control.",
      },
      {
        title: "Deterministic validation",
        body: "Provider suggestions cannot silently override policy or approval.",
      },
      {
        title: "Secure system design",
        body: "Private processing, permissions and auditability reduce exposure.",
      },
      {
        title: "Custom integrations",
        body: "AI and automation connect to the systems your team already uses.",
      },
      {
        title: "Modular implementation",
        body: "Phases follow maturity instead of forcing an oversized launch.",
      },
      {
        title: "Maturity-aware delivery",
        body: "Starting businesses and multi-branch operators receive different paths.",
      },
      {
        title: "Multi-system operations",
        body: "Architecture can support branches, roles and separated data domains.",
      },
    ],
  },
  implementation: {
    eyebrow: "Implementation process",
    title: "A controlled path from discovery to improvement",
    description:
      "Each phase has a clear purpose, review points and an outcome you can evaluate.",
    steps: [
      {
        title: "Discovery",
        body: "Understand the company, workflow and objectives.",
      },
      {
        title: "Analysis",
        body: "Analyze systems, data, documents and operational context.",
      },
      {
        title: "Solution architecture",
        body: "Select suitable AI, automation and platform components.",
      },
      {
        title: "Implementation",
        body: "Build and integrate in controlled phases.",
      },
      {
        title: "Validation",
        body: "Test security, workflows, multilingual behavior and business rules.",
      },
      {
        title: "Launch and improvement",
        body: "Deploy, monitor and improve based on approved feedback.",
      },
    ],
  },
  finalCta: {
    title: "Build the Right AI System for Your Business",
    description:
      "Start with a structured discovery process and identify the AI, automation and digital solutions that match your operations.",
    primary: "Start Your Project",
    secondary: "Explore Solutions",
  },
  marketLine: "Digital and AI services adapted for businesses in {country}.",
};
