import type { HomeCopy } from "./home-copy.en";

export const fr: HomeCopy = {
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
  trust: {
    eyebrow: "Fondations de capacité",
    title: "Conçu pour un travail opérationnel exigeant",
    items: [
      "Architecture multilingue",
      "OCR et analyse documentaire",
      "Intelligence image et média",
      "Analyse du contexte métier",
      "Appariement déterministe des services",
      "Flux de revue humaine",
      "Traitement privé et sécurisé",
      "Recommandations explicables",
    ],
  },
  overview: {
    eyebrow: "Vue d'ensemble du système d'IA",
    title: "Des preuves aux recommandations explicables",
    description:
      "Miraaj.tech suit un pipeline d'intelligence structuré. Les résultats restent révisables—surtout lorsque la confiance est faible ou que le domaine est réglementé.",
    steps: [
      {
        title: "Analyser",
        body: "Traiter documents, images, textes et preuves métier multilingues.",
      },
      {
        title: "Comprendre",
        body: "Identifier le type d'activité, l'audience, le contexte, les besoins, la maturité et les contraintes.",
      },
      {
        title: "Apparier",
        body: "Comparer le profil aux solutions Miraaj.tech approuvées.",
      },
      {
        title: "Recommander",
        body: "Fournir des recommandations explicables, des prérequis et des phases de mise en œuvre.",
      },
      {
        title: "Réviser",
        body: "Orienter les cas sensibles, réglementés ou à faible confiance vers une revue humaine.",
      },
    ],
    note: "Les sorties automatisées sont consultatives. La validation NestJS et l'approbation humaine restent autoritaires.",
  },
  coreSolutions: {
    eyebrow: "Solutions d'IA essentielles",
    title: "Des capacités d'IA pratiques pour les opérations métier",
    description:
      "Ces domaines de solutions décrivent comment Miraaj.tech conçoit le travail d'IA autour de processus réels. La disponibilité dépend du périmètre, de la préparation et de la livraison approuvée.",
    items: [
      {
        title: "Assistant IA sur mesure",
        body: "Un assistant privé adapté aux processus, aux connaissances et aux permissions de l'entreprise.",
        status: "available",
      },
      {
        title: "IA pour le support client",
        body: "Aide à organiser, classer et répondre aux demandes clients avec des points de transfert clairs.",
        status: "available",
      },
      {
        title: "Assistant IA commercial",
        body: "Soutient la qualification des leads, le suivi et les flux de vente.",
        status: "capability",
      },
      {
        title: "Assistant de connaissances internes",
        body: "Recherche dans les documents internes approuvés et le savoir opérationnel.",
        status: "available",
      },
      {
        title: "IA d'analyse documentaire",
        body: "Extrait et structure l'information à partir de documents et de PDF.",
        status: "available",
      },
      {
        title: "Analyse d'images et de médias",
        body: "Comprend le contenu visuel métier, le texte, la langue et le contexte.",
        status: "available",
      },
      {
        title: "IA d'intelligence métier",
        body: "Construit un profil structuré des besoins, objectifs et maturité de l'activité.",
        status: "available",
      },
      {
        title: "Moteur de recommandation de services",
        body: "Associe les preuves métier aux services Miraaj.tech approuvés adaptés.",
        status: "available",
      },
      {
        title: "IA d'automatisation des flux",
        body: "Coordonne les processus métier répétitifs et les intégrations système.",
        status: "available",
      },
      {
        title: "IA multilingue",
        body: "Prend en charge les preuves multilingues, la détection de langue et les flux RTL et LTR.",
        status: "available",
      },
      {
        title: "IA de reporting et d'insights",
        body: "Transforme des données structurées en insights opérationnels utiles.",
        status: "capability",
      },
      {
        title: "Services d'intégration IA",
        body: "Connecte les fournisseurs d'IA et les API adaptés aux systèmes métier existants.",
        status: "available",
      },
    ],
    statusAvailable: "Capacité prête à livrer",
    statusCapability: "Conçue avec un cadrage projet",
  },
  analysis: {
    eyebrow: "Intelligence média et documentaire",
    title: "Analyse sécurisée des preuves métier",
    description:
      "Le pipeline média de Miraaj.tech traite en privé les types de médias approuvés, extrait des signaux et évalue la confiance avant de poursuivre les recommandations.",
    items: [
      "Architecture sécurisée d'upload média",
      "Traitement JPEG, PNG, WebP et PDF",
      "OCR avec support multilingue",
      "Parcours de contenu vérifiés en arabe, anglais et français",
      "Architecture multilingue étendue",
      "Détection de script et de langue",
      "Détection de contenu multilingue mixte",
      "Suppression des métadonnées et normalisation d'image",
      "Détection des doublons exacts et proches",
      "Extraction de signaux métier et d'audience",
      "Score de confiance",
      "Règles de revue humaine pour les cas incertains",
    ],
  },
  intelligence: {
    eyebrow: "Intelligence métier",
    title: "Comprendre l'activité avant de recommander des solutions",
    description:
      "Le profilage structuré transforme les preuves en un contexte métier exploitable—sans inventer de données clients.",
    exampleLabel: "Profil d'exemple (démonstration synthétique)",
    fields: [
      { label: "Type d'activité", value: "Clinique dentaire" },
      { label: "Audience", value: "Décideurs de la clinique" },
      { label: "Maturité", value: "Présence digitale en croissance" },
      { label: "Besoins prioritaires", value: "Réservation · Opérations · Rappels" },
      { label: "Phase recommandée", value: "Fondations puis automatisation" },
      { label: "Statut de revue", value: "Revue du domaine médical requise" },
    ],
    signals: [
      "Type d'activité et secteur",
      "Type et stade de l'organisation",
      "Maturité digitale",
      "Contexte professionnel ou grand public",
      "Probabilité d'atteindre un décideur",
      "Besoins opérationnels et points de friction",
      "Objectifs et préparation à l'automatisation",
      "Préparation sécurité et paiements",
      "Contexte marché et langue",
      "Éligibilité aux promotions",
    ],
  },
  matching: {
    eyebrow: "Recommandation de services",
    title: "Appariement déterministe avec les solutions approuvées",
    description:
      "Les recommandations s'appuient sur les preuves, l'éligibilité et la disponibilité des services—pas sur une invention libre.",
    basis: [
      "Preuves métier",
      "Pertinence audience et décideur",
      "Adéquation sectorielle",
      "Besoins, points de friction et objectifs",
      "Maturité digitale",
      "Marché et langue",
      "Prérequis et conformité",
      "Disponibilité du service",
    ],
    categories: [
      "Conception et développement",
      "Gestion d'entreprise",
      "Intelligence artificielle",
      "Automatisation",
      "Paiements",
      "Cybersécurité",
      "Infrastructure cloud",
      "Données et analytique",
      "Croissance et médias",
      "Conseil et transformation",
    ],
    viewMore: "Voir plus de catégories de solutions",
    viewLess: "Afficher moins de catégories",
  },
  automation: {
    eyebrow: "Solutions d'automatisation",
    title: "Des flux fiables avec un contrôle humain clair",
    description:
      "L'automatisation réduit le travail répétitif. L'assistance IA et l'approbation humaine restent des rôles distincts.",
    items: [
      "Automatisation des flux WhatsApp",
      "Automatisation e-mail",
      "Intégration SMS",
      "Automatisation Telegram",
      "Suivi des leads",
      "Automatisation des réservations",
      "Rappels de rendez-vous",
      "Rappels de paiement",
      "Automatisation des factures",
      "Flux d'approbation",
      "Onboarding collaborateurs",
      "Onboarding clients",
      "Synchronisation des données",
      "Automatisation des tableurs",
      "Génération de rapports",
      "Systèmes de notification",
      "Automatisation des flux API",
      "Flux métier sur mesure",
    ],
    distinctions: [
      {
        title: "Assistance IA",
        body: "Suggère, classifie ou rédige dans des limites approuvées.",
      },
      {
        title: "Automatisation déterministe",
        body: "Exécute des règles de processus et des intégrations de façon stable.",
      },
      {
        title: "Approbation humaine",
        body: "Maintient le jugement, la conformité et les exceptions sous contrôle.",
      },
    ],
  },
  industries: {
    eyebrow: "Solutions sectorielles",
    title: "Des solutions pensées pour les décideurs professionnels",
    description:
      "Les offres sectorielles ciblent les opérateurs et les managers—pas un ciblage grand public inadapté.",
    items: [
      {
        title: "Santé et cliniques dentaires",
        solutions: [
          "Gestion de clinique",
          "Prise de rendez-vous",
          "Parcours patient",
          "Rappels WhatsApp",
          "Reporting",
          "Contrôle d'accès",
          "Sauvegarde",
        ],
      },
      {
        title: "Éducation et établissements scolaires",
        solutions: [
          "Gestion scolaire",
          "Présences",
          "Planification",
          "Paiements",
          "Communication parents",
          "Gestion des collaborateurs",
          "Reporting",
        ],
      },
      {
        title: "Restaurants et hôtellerie",
        solutions: [
          "Gestion de restaurant",
          "Réservations",
          "Stocks",
          "Commandes",
          "Communication client",
          "Analytique",
        ],
      },
      {
        title: "Commerce de détail et e-commerce",
        solutions: [
          "Vitrines en ligne",
          "Gestion du catalogue",
          "Intégration du checkout",
          "Flux de commandes",
          "Analytique",
        ],
      },
      {
        title: "Immobilier",
        solutions: [
          "Plateformes d'annonces",
          "Flux de leads",
          "Intégrations CRM",
          "Automatisation",
        ],
      },
      {
        title: "Construction",
        solutions: [
          "Suivi de projets",
          "Flux documentaires",
          "Coordination d'équipes",
          "Reporting",
        ],
      },
      {
        title: "Logistique et flotte",
        solutions: [
          "Tableaux de bord opérationnels",
          "Suivi des itinéraires et du statut",
          "Notifications",
          "Reporting",
        ],
      },
      {
        title: "Services professionnels",
        solutions: [
          "Sites corporate",
          "Portails clients",
          "Planification",
          "Assistants de connaissances",
        ],
      },
      {
        title: "Opérations financières",
        solutions: [
          "Paiements adaptés au fournisseur",
          "Support de rapprochement",
          "Flux sensibles à la conformité",
          "Reporting",
        ],
      },
      {
        title: "Entreprises multi-sites",
        solutions: [
          "Tableaux de bord par site",
          "Accès basé sur les rôles",
          "Isolation des données",
          "Supervision centrale",
        ],
      },
    ],
  },
  multilingual: {
    eyebrow: "Intelligence multilingue",
    title: "Langue, locale et marché restent distincts",
    description:
      "Miraaj.tech traite le pays, la langue et la locale comme des dimensions séparées, avec support RTL et LTR et des limites de qualité assumées.",
    points: [
      "La langue et le pays sont gérés séparément",
      "La locale est gérée séparément de la langue",
      "RTL et LTR sont pris en charge",
      "Les preuves multilingues mixtes sont prises en charge",
      "L'arabe, l'anglais et le français sont vérifiés en premier",
      "Les langues supplémentaires suivent l'architecture globale",
      "Une revue humaine peut être requise pour les langues ou locales à moindre confiance",
    ],
    demoLabel: "Démonstration linguistique",
    demoNote:
      "Cet aperçu ne modifie pas la locale ni l'itinéraire actuel de votre site.",
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
    eyebrow: "Sécurité et revue humaine",
    title: "Conçu pour réduire le risque—pas pour promettre la perfection",
    description:
      "Le travail sensible reste privé, révisable et soumis aux permissions. Aucune affirmation de sécurité absolue n'est utilisée.",
    items: [
      "Topologie d'infrastructure privée",
      "Communication sécurisée entre services",
      "Permissions basées sur les rôles",
      "Informations d'audit structurées",
      "Stockage média privé",
      "Accès contrôlé aux fournisseurs",
      "Protection contre l'injection de prompts",
      "Revue du contenu sensible",
      "Revue des domaines réglementés",
      "Confiance explicable",
      "Flux d'approbation humaine",
      "Pas de ciblage B2B automatique de groupes grand public inadaptés",
    ],
  },
  explorer: {
    eyebrow: "Explorateur de solutions IA",
    title: "Explorer des directions de solutions pertinentes",
    description:
      "Un guide frontend léger pour aider les visiteurs à démarrer une conversation. Ce n'est pas le moteur d'appariement de production.",
    disclaimer:
      "Explorateur de solutions initial · Aucune réponse n'est stockée · Pas une recommandation finale",
    stepBusiness: "Sélectionner le type d'activité",
    stepNeed: "Sélectionner le besoin principal",
    stepMaturity: "Sélectionner la maturité de l'activité",
    stepResult: "Catégories suggérées",
    businessTypes: [
      "Clinique",
      "École",
      "Restaurant",
      "Commerce de détail",
      "E-commerce",
      "Immobilier",
      "Construction",
      "Logistique",
      "Services professionnels",
      "Entreprise multi-sites",
      "Autre",
    ],
    needs: [
      "Créer un site ou une application",
      "Gérer les opérations",
      "Automatiser les flux de travail",
      "Ajouter un assistant IA",
      "Améliorer le support client",
      "Améliorer les ventes",
      "Analyser des documents",
      "Renforcer la sécurité",
      "Ajouter des flux de paiement",
      "Créer des tableaux de bord et des rapports",
    ],
    maturity: [
      "Démarrage",
      "Présence digitale de base",
      "En croissance",
      "Intégré",
      "Avancé",
    ],
    resultTitle: "Catégories de solutions suggérées",
    resultBody:
      "D'après vos choix, ces catégories constituent un bon point de départ pour explorer. Une revue spécialisée décide encore du périmètre final.",
    categories: [
      "Conception et développement",
      "Gestion d'entreprise",
      "Intelligence artificielle",
      "Automatisation",
      "Paiements",
      "Cybersécurité",
    ],
    ctaPrimary: "Démarrer votre projet",
    ctaSecondary: "Explorer les services",
    next: "Continuer",
    back: "Retour",
    restart: "Recommencer",
  },
  why: {
    eyebrow: "Pourquoi Miraaj.tech",
    title: "Une architecture d'IA centrée sur le métier",
    description:
      "La différence n'est pas un marketing plus bruyant—c'est une structure plus claire, une revue et une discipline de livraison.",
    items: [
      {
        title: "IA centrée sur le métier",
        body: "Les solutions partent des opérations, des contraintes et des décideurs.",
      },
      {
        title: "Recommandations explicables",
        body: "L'appariement reste lié aux preuves, à l'éligibilité et aux services approuvés.",
      },
      {
        title: "Fondation multilingue",
        body: "Langue, locale et marché sont modélisés séparément avec support RTL.",
      },
      {
        title: "Revue humaine pour les décisions sensibles",
        body: "Les cas réglementés, de paiement et à faible confiance restent sous contrôle.",
      },
      {
        title: "Validation déterministe",
        body: "Les suggestions du fournisseur ne peuvent pas outrepasser silencieusement la politique ou l'approbation.",
      },
      {
        title: "Conception système sécurisée",
        body: "Traitement privé, permissions et auditabilité réduisent l'exposition.",
      },
      {
        title: "Intégrations sur mesure",
        body: "L'IA et l'automatisation se connectent aux systèmes déjà utilisés par votre équipe.",
      },
      {
        title: "Mise en œuvre modulaire",
        body: "Les phases suivent la maturité au lieu d'imposer un lancement surdimensionné.",
      },
      {
        title: "Livraison adaptée à la maturité",
        body: "Les activités en démarrage et les opérateurs multi-sites reçoivent des parcours distincts.",
      },
      {
        title: "Opérations multi-systèmes",
        body: "L'architecture peut prendre en charge sites, rôles et domaines de données séparés.",
      },
    ],
  },
  implementation: {
    eyebrow: "Processus de mise en œuvre",
    title: "Un parcours maîtrisé, de la découverte à l'amélioration",
    description:
      "Chaque phase a un objectif clair, des points de revue et un résultat que vous pouvez évaluer.",
    steps: [
      {
        title: "Découverte",
        body: "Comprendre l'entreprise, les flux de travail et les objectifs.",
      },
      {
        title: "Analyse",
        body: "Analyser les systèmes, les données, les documents et le contexte opérationnel.",
      },
      {
        title: "Architecture de solution",
        body: "Sélectionner les composants d'IA, d'automatisation et de plateforme adaptés.",
      },
      {
        title: "Mise en œuvre",
        body: "Construire et intégrer par phases contrôlées.",
      },
      {
        title: "Validation",
        body: "Tester la sécurité, les flux, le comportement multilingue et les règles métier.",
      },
      {
        title: "Lancement et amélioration",
        body: "Déployer, surveiller et améliorer à partir des retours approuvés.",
      },
    ],
  },
  finalCta: {
    title: "Construisez le bon système d'IA pour votre activité",
    description:
      "Commencez par une découverte structurée et identifiez les solutions d'IA, d'automatisation et de digital qui correspondent à vos opérations.",
    primary: "Démarrer votre projet",
    secondary: "Explorer les solutions",
  },
  marketLine: "Services digitaux et d'IA adaptés aux entreprises en {country}.",
};
