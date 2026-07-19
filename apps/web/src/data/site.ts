import type { Article, FAQItem, Industry, PaymentProvider, Project, Service } from "@/types";

export const services: Service[] = [
  { slug: "web-development", group: "build", icon: "Globe2", title: "Websites & web platforms", description: "Fast, accessible websites and web products designed around your business.", capabilities: ["Corporate websites", "Web portals", "Booking platforms"] },
  { slug: "mobile-app-development", group: "build", icon: "Smartphone", title: "Mobile applications", description: "Useful mobile experiences for customers, teams and growing services.", capabilities: ["iOS & Android", "Product UX", "App integrations"] },
  { slug: "desktop-applications", group: "build", icon: "Monitor", title: "Desktop applications", description: "Focused tools for internal operations and specialist workflows.", capabilities: ["Cross-platform apps", "Offline workflows", "Secure integrations"] },
  { slug: "ecommerce", group: "build", icon: "ShoppingBag", title: "E-commerce", description: "Clear storefronts and checkout journeys built to support growth.", capabilities: ["Catalogs", "Checkout UX", "Operations"] },
  { slug: "custom-software", group: "build", icon: "Blocks", title: "Custom software", description: "Systems shaped around the way your business actually works.", capabilities: ["Admin systems", "Business platforms", "API architecture"] },
  { slug: "scripts-automation", group: "automate", icon: "Workflow", title: "Scripts & automation", description: "Reduce repetitive work with reliable, compliant workflows.", capabilities: ["Scheduled jobs", "API synchronization", "Report generation"] },
  { slug: "ai-solutions", group: "automate", icon: "Sparkles", title: "AI solutions", description: "Practical AI assistants, search and document workflows with human control.", capabilities: ["Knowledge assistants", "Document analysis", "Smart search"] },
  { slug: "payment-integration", group: "grow", icon: "CreditCard", title: "Payment integration", description: "Payment experiences matched to your country, company and provider requirements.", capabilities: ["Provider selection", "Checkout integration", "Compliance-aware UX"] },
  { slug: "video-production", group: "grow", icon: "Clapperboard", title: "Video & creative", description: "Product stories, motion and social content that explain your value.", capabilities: ["Product demos", "Motion graphics", "Localization"] },
];

export const processSteps = [
  ["Discovery", "Understand the goal, audience and constraints."],
  ["Scope", "Turn the need into priorities and a clear delivery plan."],
  ["UX direction", "Shape the user journey and visual language."],
  ["Prototype", "Validate the most important interactions early."],
  ["Development", "Build in focused, reviewable increments."],
  ["Quality assurance", "Test behavior, accessibility and performance."],
  ["Launch", "Prepare a controlled, measurable release."],
  ["Continuous support", "Improve and maintain the product after launch."],
] as const;

export const projects: Project[] = [
  { slug: "northstar-commerce", name: "Northstar Commerce", category: "E-commerce", summary: "A concept storefront and operations workspace for an international product brand.", services: ["Web", "E-commerce", "Payments"], concept: true, accent: "from-blue-500 to-cyan-400" },
  { slug: "carepath-booking", name: "CarePath Booking", category: "Healthcare", summary: "A concept booking experience focused on clarity, accessibility and patient confidence.", services: ["Web platform", "UX", "Automation"], concept: true, accent: "from-emerald-500 to-cyan-400" },
  { slug: "orbit-ai-workspace", name: "Orbit AI Workspace", category: "AI", summary: "A concept internal assistant for finding approved answers across company knowledge.", services: ["AI", "Search", "Product design"], concept: true, accent: "from-violet-500 to-blue-500" },
  { slug: "atlas-operations", name: "Atlas Operations", category: "Business systems", summary: "A concept management application for connected projects, teams and workflows.", services: ["Custom software", "Automation", "Desktop"], concept: true, accent: "from-orange-400 to-rose-400" },
];

export const industries: Industry[] = [
  { slug: "startups", title: "Startups", description: "Move from an idea to a focused first product.", solutions: ["MVP strategy", "Product design", "Scalable development"] },
  { slug: "small-business", title: "Small businesses", description: "Create a credible digital presence and simplify daily work.", solutions: ["Websites", "Automation", "Maintenance"] },
  { slug: "ecommerce", title: "E-commerce", description: "Improve discovery, checkout and operations.", solutions: ["Storefronts", "Payments", "Integrations"] },
  { slug: "agencies", title: "Agencies", description: "Add dependable technical capacity to client delivery.", solutions: ["Development", "White-label collaboration", "Automation"] },
  { slug: "healthcare", title: "Healthcare", description: "Design clear, privacy-conscious service experiences.", solutions: ["Bookings", "Portals", "Accessible UX"] },
  { slug: "education", title: "Education", description: "Build useful learning and administration tools.", solutions: ["Learning platforms", "Membership", "Content systems"] },
  { slug: "real-estate", title: "Real estate", description: "Connect property discovery, leads and team workflows.", solutions: ["Listing platforms", "CRM integrations", "Automation"] },
  { slug: "professional-services", title: "Professional services", description: "Communicate expertise and streamline client journeys.", solutions: ["Corporate web", "Client portals", "Scheduling"] },
];

export const faqs: FAQItem[] = [
  { category: "General", question: "Do I need a technical specification?", answer: "No. Explain the business goal in your own words and we will help turn it into a clear scope." },
  { category: "Projects", question: "Can you improve an existing product?", answer: "Yes. We can audit, redesign, modernize or extend an existing website, app or internal system." },
  { category: "Development", question: "Do you handle design and development together?", answer: "Yes. Product thinking, interface design, development and quality assurance can run as one connected process." },
  { category: "Support", question: "Is support available after launch?", answer: "Support and continuous improvement can be included according to the product and the level of coverage required." },
  { category: "Payments", question: "Can you integrate payment providers?", answer: "Yes. We help assess and integrate suitable providers. Availability depends on the company's country, activity, documents and each provider's approval." },
  { category: "AI", question: "Can you build a custom AI solution?", answer: "Yes, when AI is the right tool. We design assistants, document workflows, search and integrations with review and control points." },
  { category: "Pricing", question: "How is a project estimated?", answer: "The estimate reflects scope, screens, integrations, languages, timing and ongoing support—not a generic package." },
  { category: "Localization", question: "Can the same product serve several markets?", answer: "Yes. We can plan localization, language direction, market-specific content and payment considerations from the start." },
];

export const articles: Article[] = [
  { slug: "idea-to-plan", title: "How to turn an app idea into an execution plan", excerpt: "A practical path from a broad idea to priorities, scope and first release.", category: "Product", demo: true, readingTime: 6 },
  { slug: "app-or-website", title: "When does your business need an app instead of a website?", excerpt: "Choose the format that matches the user journey instead of following trends.", category: "Strategy", demo: true, readingTime: 5 },
  { slug: "payment-provider", title: "How to assess the right payment provider", excerpt: "Country, activity, customer experience and provider requirements all matter.", category: "Payments", demo: true, readingTime: 7 },
  { slug: "useful-business-ai", title: "Where AI creates real value inside a business", excerpt: "Look for repeatable knowledge and workflow problems before selecting tools.", category: "AI", demo: true, readingTime: 6 },
  { slug: "automation-basics", title: "Reduce repetitive work with responsible automation", excerpt: "Identify stable processes and add review points where judgment matters.", category: "Automation", demo: true, readingTime: 5 },
  { slug: "trustworthy-company-website", title: "What makes a company website feel trustworthy?", excerpt: "Clear information, restrained design and honest proof build confidence.", category: "Web", demo: true, readingTime: 4 },
];

export const paymentProviders: PaymentProvider[] = [
  { name: "Stripe", kind: "global" }, { name: "PayPal", kind: "global" },
  { name: "Adyen", kind: "global" }, { name: "Checkout.com", kind: "global" },
  { name: "Mollie", kind: "global" }, { name: "Klarna", kind: "global" },
  { name: "Apple Pay", kind: "wallet" }, { name: "Google Pay", kind: "wallet" },
  { name: "Local providers", kind: "local" },
];
