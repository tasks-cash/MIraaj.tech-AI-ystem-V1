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
    eyebrow: "Digital products built around your business",
    title: "Turn your idea into a digital product that works and grows.",
    description: "We design and build websites, apps, systems, AI, automation and payment experiences—from first idea to launch and support.",
    primary: "Start your project",
    secondary: "Explore our services",
    assurances: ["A clear, timely response", "A plan shaped around your needs", "No technical background required"],
  },
  sections: { build: "Everything your digital business needs, in one place.", process: "From first idea to first user.", ai: "AI that works inside your business—not a feature for show.", payments: "Make payment easier for your customers.", solutions: "Solutions shaped around the way you operate.", work: "Ideas turned into digital experiences.", why: "Clear technology, delivered around your business.", faq: "Questions, answered clearly." },
  common: { learnMore: "Learn more", viewConcept: "View concept", concept: "Concept", contact: "Talk to us", quote: "Request a quote", search: "Search", menu: "Menu", close: "Close", previous: "Previous", next: "Next", submit: "Submit" },
  announcement: "Have a project idea? Send it to us and we will turn it into a clear execution plan.",
  marketLine: "Digital services adapted for businesses in {country}.",
};

const ar: SiteCopy = {
  nav: { services: "الخدمات", solutions: "الحلول", work: "أعمالنا", about: "من نحن", insights: "المقالات", start: "ابدأ مشروعك" },
  hero: {
    eyebrow: "منتجات رقمية مبنية حول مشروعك",
    title: "حوّل فكرتك إلى منتج رقمي يعمل وينمو.",
    description: "نصمم ونطور المواقع والتطبيقات والأنظمة وحلول الذكاء الاصطناعي والأتمتة ووسائل الدفع، من أول فكرة إلى الإطلاق والدعم.",
    primary: "ابدأ مشروعك",
    secondary: "استكشف خدماتنا",
    assurances: ["رد واضح وسريع", "خطة مناسبة لاحتياجك", "لا تحتاج إلى معرفة تقنية مسبقة"],
  },
  sections: { build: "كل ما يحتاجه مشروعك الرقمي، في مكان واحد.", process: "من أول فكرة إلى أول مستخدم.", ai: "ذكاء اصطناعي يعمل داخل مشروعك، لا مجرد ميزة للعرض.", payments: "اجعل الدفع أسهل لعملائك.", solutions: "حلول مبنية حول طريقة عمل مشروعك.", work: "أفكار تحولت إلى تجارب رقمية.", why: "تقنية مفهومة، وتنفيذ يناسب مشروعك.", faq: "إجابات واضحة عن أسئلتك." },
  common: { learnMore: "معرفة المزيد", viewConcept: "عرض المشروع التجريبي", concept: "مشروع تصوري", contact: "تحدث معنا", quote: "اطلب عرضًا", search: "بحث", menu: "القائمة", close: "إغلاق", previous: "السابق", next: "التالي", submit: "إرسال" },
  announcement: "لديك فكرة مشروع؟ أرسلها لنا وسنحوّلها إلى خطة تنفيذ واضحة.",
  marketLine: "نخدم المشاريع والعملاء في {country} بحلول رقمية مناسبة للسوق.",
};

const fr: SiteCopy = {
  ...en,
  nav: { services: "Services", solutions: "Solutions", work: "Réalisations", about: "À propos", insights: "Ressources", start: "Démarrer votre projet" },
  hero: { eyebrow: "Des produits numériques pensés pour votre activité", title: "Transformez votre idée en un produit numérique utile et évolutif.", description: "Sites, applications, IA, automatisation et paiements : nous construisons une solution claire, de l'idée au lancement.", primary: "Démarrer votre projet", secondary: "Découvrir nos services", assurances: ["Réponse claire et rapide", "Plan adapté à vos besoins", "Aucune expertise technique requise"] },
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
