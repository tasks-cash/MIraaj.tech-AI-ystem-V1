export interface SiteCopy {
  nav: Record<"services" | "solutions" | "work" | "about" | "insights" | "start", string>;
  hero: { eyebrow: string; title: string; description: string; primary: string; secondary: string; assurances: string[] };
  sections: Record<"build" | "process" | "ai" | "payments" | "solutions" | "work" | "why" | "faq", string>;
  common: Record<"learnMore" | "viewConcept" | "concept" | "contact" | "quote" | "search" | "menu" | "close" | "previous" | "next" | "submit", string>;
  announcement: string;
  marketLine: string;
}

const en: SiteCopy = {
  nav: { services: "Services", solutions: "Solutions", work: "Work", about: "About", insights: "Insights", start: "Start your project" },
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
  sections: { build: "Everything your digital business needs, in one place.", process: "From first idea to first user.", ai: "AI that works inside your business—not a feature for show.", payments: "Make payment easier for your customers.", solutions: "Solutions shaped around the way you operate.", work: "Ideas turned into digital experiences.", why: "Clear technology, delivered around your business.", faq: "Questions, answered clearly." },
  common: { learnMore: "Learn more", viewConcept: "View concept", concept: "Concept", contact: "Talk to us", quote: "Request a quote", search: "Search", menu: "Menu", close: "Close", previous: "Previous", next: "Next", submit: "Submit" },
  announcement: "Have a project idea? Send it to us and we will turn it into a clear execution plan.",
  marketLine: "Digital services adapted for businesses in {country}.",
};

const ar: SiteCopy = {
  nav: { services: "الخدمات", solutions: "الحلول", work: "أعمالنا", about: "من نحن", insights: "المقالات", start: "ابدأ مشروعك" },
  hero: {
    eyebrow: "أنظمة ذكاء اصطناعي للعمليات التشغيلية الحقيقية",
    title: "حوّل عملك بأنظمة ذكية",
    description:
      "تحلّل Miraaj.tech سياق العمل، وتحدد الاحتياجات التشغيلية، وتساعد المؤسسات على بناء حلول آمنة للذكاء الاصطناعي والأتمتة والتحول الرقمي بما يناسب سوقها.",
    primary: "استكشف حلول الذكاء الاصطناعي",
    secondary: "اكتشف كيف يعمل النظام",
    assurances: ["تحليل لسياق العمل", "توصيات قابلة للتفسير", "مراجعة بشرية للحالات الحساسة"],
  },
  sections: { build: "كل ما يحتاجه مشروعك الرقمي، في مكان واحد.", process: "من أول فكرة إلى أول مستخدم.", ai: "ذكاء اصطناعي يعمل داخل مشروعك، لا مجرد ميزة للعرض.", payments: "اجعل الدفع أسهل لعملائك.", solutions: "حلول مبنية حول طريقة عمل مشروعك.", work: "أفكار تحولت إلى تجارب رقمية.", why: "تقنية مفهومة، وتنفيذ يناسب مشروعك.", faq: "إجابات واضحة عن أسئلتك." },
  common: { learnMore: "معرفة المزيد", viewConcept: "عرض المشروع التجريبي", concept: "مشروع تصوري", contact: "تحدث معنا", quote: "اطلب عرضًا", search: "بحث", menu: "القائمة", close: "إغلاق", previous: "السابق", next: "التالي", submit: "إرسال" },
  announcement: "لديك فكرة مشروع؟ أرسلها لنا وسنحوّلها إلى خطة تنفيذ واضحة.",
  marketLine: "نخدم المشاريع والعملاء في {country} بحلول رقمية مناسبة للسوق.",
};

const fr: SiteCopy = {
  ...en,
  nav: { services: "Services", solutions: "Solutions", work: "Réalisations", about: "À propos", insights: "Ressources", start: "Démarrer votre projet" },
  hero: {
    eyebrow: "Systèmes d'IA pour les opérations métier réelles",
    title: "Transformez votre activité avec des systèmes intelligents",
    description:
      "Miraaj.tech analyse le contexte métier, identifie les besoins opérationnels et aide les organisations à concevoir des solutions sécurisées d'IA, d'automatisation et de digital adaptées à leur marché.",
    primary: "Explorer les solutions d'IA",
    secondary: "Découvrir le fonctionnement",
    assurances: [
      "Analyse du contexte métier",
      "Recommandations explicables",
      "Revue humaine pour les cas sensibles",
    ],
  },
  announcement: "Vous avez une idée ? Confiez-la-nous pour la transformer en plan d'exécution clair.",
  marketLine: "Des services numériques adaptés aux entreprises en {country}.",
};

const de: SiteCopy = {
  ...en,
  nav: { services: "Leistungen", solutions: "Lösungen", work: "Projekte", about: "Über uns", insights: "Einblicke", start: "Projekt starten" },
  hero: { eyebrow: "Digitale Produkte für Ihr Unternehmen", title: "Von der Idee zum funktionierenden, skalierbaren Digitalprodukt.", description: "Web, Apps, KI, Automatisierung und Payment – klar geplant, hochwertig umgesetzt und langfristig erweiterbar.", primary: "Projekt starten", secondary: "Leistungen entdecken", assurances: ["Klare, zeitnahe Antwort", "Ein Plan passend zu Ihrem Bedarf", "Kein technisches Vorwissen nötig"] },
  announcement: "Sie haben eine Projektidee? Wir entwickeln daraus einen klaren Umsetzungsplan.",
  marketLine: "Digitale Lösungen für Unternehmen in {country} – mit Fokus auf Qualität, Datenschutz und Klarheit.",
};

const copyByLocale: Record<string, SiteCopy> = { en, ar, fr, de };

export function getCopy(locale: string): SiteCopy {
  return copyByLocale[locale] ?? en;
}

export function asIntlMessages(copy: SiteCopy) {
  return copy as unknown as Record<string, unknown>;
}
