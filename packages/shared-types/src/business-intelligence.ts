/**
 * Prompt 3 — Business intelligence and Miraaj.tech service matching contracts.
 * Deterministic NestJS matching is the final authority; providers only suggest evidence.
 */

export const BUSINESS_TYPES = [
  "dental_clinic",
  "general_clinic",
  "medical_center",
  "pharmacy",
  "medical_laboratory",
  "hospital",
  "school",
  "kindergarten",
  "training_center",
  "university",
  "restaurant",
  "coffee_shop",
  "hotel",
  "travel_agency",
  "real_estate_agency",
  "property_management",
  "construction_company",
  "logistics_company",
  "fleet_operator",
  "car_rental",
  "automotive_workshop",
  "retail_store",
  "ecommerce_business",
  "wholesale_business",
  "manufacturing_company",
  "agriculture_business",
  "law_firm",
  "accounting_office",
  "consultancy",
  "salon",
  "gym",
  "software_company",
  "digital_agency",
  "professional_services",
  "creator_business",
  "marketplace_business",
  "nonprofit",
  "government_or_public_entity",
  "general_business",
  "unknown",
] as const;
export type BusinessType = (typeof BUSINESS_TYPES)[number];

export const ORGANIZATION_TYPES = [
  "solo_professional",
  "micro_business",
  "small_business",
  "medium_business",
  "enterprise",
  "institution",
  "franchise",
  "multi_branch_business",
  "marketplace_operator",
  "public_entity",
  "nonprofit",
  "unknown",
] as const;
export type OrganizationType = (typeof ORGANIZATION_TYPES)[number];

export const BUSINESS_STAGES = [
  "idea",
  "pre_launch",
  "newly_launched",
  "operating",
  "growing",
  "scaling",
  "mature",
  "modernization",
  "distressed",
  "unknown",
] as const;
export type BusinessStage = (typeof BUSINESS_STAGES)[number];

export const DIGITAL_MATURITY_LEVELS = [
  "none",
  "basic",
  "fragmented",
  "developing",
  "integrated",
  "advanced",
  "unknown",
] as const;
export type DigitalMaturity = (typeof DIGITAL_MATURITY_LEVELS)[number];

export const AUDIENCE_TYPES = [
  "business_owner",
  "company_founder",
  "executive",
  "operations_manager",
  "clinic_owner",
  "dentist",
  "doctor",
  "pharmacist",
  "school_manager",
  "restaurant_owner",
  "hotel_manager",
  "real_estate_professional",
  "construction_manager",
  "logistics_manager",
  "retailer",
  "ecommerce_operator",
  "lawyer",
  "accountant",
  "employee",
  "consumer",
  "patient",
  "student",
  "parent",
  "general_public",
  "mixed",
  "unknown",
] as const;
export type AudienceType = (typeof AUDIENCE_TYPES)[number];

export const GROUP_SOURCE_CONTEXTS = [
  "professional_group",
  "business_owner_group",
  "industry_community",
  "consumer_group",
  "patient_group",
  "student_group",
  "parent_group",
  "employee_group",
  "public_marketplace",
  "product_listing",
  "company_page",
  "personal_profile",
  "news_or_information",
  "mixed_context",
  "unknown",
] as const;
export type GroupSourceContext = (typeof GROUP_SOURCE_CONTEXTS)[number];

export const PROMOTION_ELIGIBILITIES = [
  "eligible_b2b",
  "eligible_b2c",
  "eligible_mixed",
  "review_required",
  "unsuitable",
  "unknown",
] as const;
export type PromotionEligibility = (typeof PROMOTION_ELIGIBILITIES)[number];

export const BUSINESS_NEED_CODES = [
  "corporate_website",
  "service_website",
  "ecommerce_store",
  "landing_page",
  "multilingual_website",
  "website_modernization",
  "mobile_application",
  "desktop_application",
  "custom_web_application",
  "customer_portal",
  "employee_portal",
  "supplier_portal",
  "marketplace",
  "saas_platform",
  "multi_branch_platform",
  "crm",
  "erp",
  "booking",
  "scheduling",
  "patient_management",
  "student_management",
  "restaurant_management",
  "hotel_management",
  "real_estate_management",
  "inventory",
  "warehouse",
  "accounting_interface",
  "invoices",
  "expenses",
  "payment_tracking",
  "employee_management",
  "attendance",
  "payroll_configuration",
  "document_management",
  "reporting",
  "analytics",
  "custom_ai_assistant",
  "customer_support_ai",
  "sales_ai",
  "document_analysis",
  "image_analysis",
  "business_analysis",
  "recommendation_engine",
  "content_assistance",
  "internal_knowledge_assistant",
  "lead_qualification",
  "forecasting",
  "ai_workflow_orchestration",
  "whatsapp_automation",
  "email_automation",
  "sms_automation",
  "telegram_automation",
  "booking_automation",
  "lead_follow_up",
  "payment_reminders",
  "invoice_automation",
  "document_generation",
  "approval_workflow",
  "onboarding_automation",
  "data_sync",
  "scheduled_reports",
  "notifications",
  "custom_workflow",
  "online_checkout",
  "payment_links",
  "subscriptions",
  "recurring_payments",
  "invoices_payments",
  "bank_transfer_workflow",
  "payment_confirmation",
  "refunds",
  "reconciliation",
  "marketplace_payments",
  "multi_currency_interface",
  "provider_integration",
  "merchant_onboarding_support",
  "transaction_dashboard",
  "security_audit",
  "authentication_hardening",
  "access_control",
  "api_security",
  "secure_file_uploads",
  "cloud_security",
  "backup",
  "disaster_recovery",
  "monitoring",
  "audit_logs",
  "secrets_management",
  "infrastructure_hardening",
  "privacy_design",
  "multi_branch_isolation",
  "cloud_architecture",
  "deployment",
  "containerization",
  "managed_hosting_planning",
  "staging_environment",
  "production_environment",
  "object_storage",
  "database_hosting",
  "redis_caching",
  "queues",
  "cdn",
  "dns",
  "logging",
  "ci_cd",
  "scalability",
  "high_availability",
  "cost_visibility",
  "branding",
  "social_media_strategy",
  "content_calendar",
  "advertising_strategy",
  "campaign_landing_page",
  "lead_generation",
  "seo",
  "video_production",
  "product_demo_video",
  "social_short_video",
  "multilingual_content",
  "referral_program",
  "customer_loyalty",
] as const;
export type BusinessNeedCode = (typeof BUSINESS_NEED_CODES)[number];

export const SERVICE_CATEGORIES = [
  "build",
  "manage",
  "artificial_intelligence",
  "automation",
  "payments",
  "cybersecurity",
  "cloud_infrastructure",
  "data_analytics",
  "growth_marketing_media",
  "consulting_transformation",
] as const;
export type ServiceCategoryCode = (typeof SERVICE_CATEGORIES)[number];

export const SERVICE_CATALOG_ITEM_STATUSES = [
  "draft",
  "active",
  "paused",
  "deprecated",
  "archived",
] as const;
export type ServiceCatalogItemStatus =
  (typeof SERVICE_CATALOG_ITEM_STATUSES)[number];

export const CATALOG_VERSION_STATUSES = [
  "draft",
  "testing",
  "active",
  "deprecated",
  "archived",
] as const;
export type CatalogVersionStatus = (typeof CATALOG_VERSION_STATUSES)[number];

export const SERVICE_MATCH_STATES = [
  "recommended",
  "recommended_with_prerequisites",
  "optional",
  "future_phase",
  "blocked",
  "excluded",
  "review_required",
  "unavailable",
] as const;
export type ServiceMatchState = (typeof SERVICE_MATCH_STATES)[number];

export const BUSINESS_PROFILE_STATUSES = [
  "draft",
  "generated",
  "awaiting_review",
  "approved",
  "corrected",
  "rejected",
  "superseded",
] as const;
export type BusinessProfileStatus = (typeof BUSINESS_PROFILE_STATUSES)[number];

export const RECOMMENDATION_SET_STATUSES = [
  "generated",
  "awaiting_review",
  "approved",
  "corrected",
  "rejected",
  "superseded",
  "failed",
] as const;
export type RecommendationSetStatus =
  (typeof RECOMMENDATION_SET_STATUSES)[number];

export const INTELLIGENCE_JOB_STATUSES = [
  "created",
  "queued",
  "active",
  "loading_evidence",
  "reasoning",
  "profiling",
  "matching",
  "bundling",
  "scoring",
  "awaiting_review",
  "completed",
  "failed",
  "cancelled",
  "dead_letter",
  "reused",
] as const;
export type IntelligenceJobStatus = (typeof INTELLIGENCE_JOB_STATUSES)[number];

export const INTELLIGENCE_REVIEW_REASON_CODES = [
  "business_type_ambiguous",
  "industry_ambiguous",
  "audience_ambiguous",
  "decision_maker_uncertain",
  "professional_context_uncertain",
  "consumer_context_detected",
  "unsuitable_b2b_target",
  "promotion_eligibility_unknown",
  "regulated_domain",
  "payment_provider_dependency",
  "country_availability_unknown",
  "prerequisite_unknown",
  "contradictory_evidence",
  "low_profile_confidence",
  "low_recommendation_confidence",
  "tier3_language",
  "untested_locale",
  "provider_only_reasoning",
  "manual_review_requested",
  "source_analysis_review_required",
] as const;
export type IntelligenceReviewReasonCode =
  (typeof INTELLIGENCE_REVIEW_REASON_CODES)[number];

export const INTELLIGENCE_ERROR_CODES = [
  "INTELLIGENCE_SOURCE_NOT_FOUND",
  "INTELLIGENCE_SOURCE_NOT_READY",
  "INTELLIGENCE_SOURCE_REJECTED",
  "INTELLIGENCE_SOURCE_REVISION_INVALID",
  "INTELLIGENCE_JOB_ALREADY_EXISTS",
  "INTELLIGENCE_JOB_NOT_RETRYABLE",
  "INTELLIGENCE_JOB_CANCELLED",
  "INTELLIGENCE_PROVIDER_DISABLED",
  "INTELLIGENCE_PROVIDER_UNAVAILABLE",
  "INTELLIGENCE_PROVIDER_TIMEOUT",
  "INTELLIGENCE_PROVIDER_INVALID_RESPONSE",
  "INTELLIGENCE_SCHEMA_VALIDATION_FAILED",
  "BUSINESS_PROFILE_NOT_FOUND",
  "BUSINESS_PROFILE_AMBIGUOUS",
  "BUSINESS_PROFILE_REVIEW_REQUIRED",
  "SERVICE_CATALOG_NOT_FOUND",
  "SERVICE_CATALOG_NO_ACTIVE_VERSION",
  "SERVICE_CATALOG_VERSION_INACTIVE",
  "SERVICE_CATALOG_ITEM_NOT_FOUND",
  "SERVICE_CATALOG_ITEM_INACTIVE",
  "MATCHING_POLICY_NOT_FOUND",
  "MATCHING_POLICY_INACTIVE",
  "SERVICE_MATCH_NO_ELIGIBLE_RESULTS",
  "SERVICE_MATCH_PREREQUISITE_MISSING",
  "SERVICE_MATCH_AUDIENCE_INELIGIBLE",
  "SERVICE_MATCH_MARKET_UNSUPPORTED",
  "SERVICE_MATCH_REVIEW_REQUIRED",
  "RECOMMENDATION_NOT_FOUND",
  "RECOMMENDATION_NOT_RETRYABLE",
  "RECOMMENDATION_REVIEW_REQUIRED",
  "RECOMMENDATION_REVISION_CONFLICT",
  "PAYMENT_PROVIDER_APPROVAL_DEPENDENT",
  "REGULATED_DOMAIN_REVIEW_REQUIRED",
  "PROMOTION_TARGET_UNSUITABLE",
] as const;
export type IntelligenceErrorCode = (typeof INTELLIGENCE_ERROR_CODES)[number];

export const CONSUMER_AUDIENCE_TYPES: readonly AudienceType[] = [
  "consumer",
  "patient",
  "student",
  "parent",
  "general_public",
] as const;

export const PROFESSIONAL_AUDIENCE_TYPES: readonly AudienceType[] = [
  "business_owner",
  "company_founder",
  "executive",
  "operations_manager",
  "clinic_owner",
  "dentist",
  "doctor",
  "pharmacist",
  "school_manager",
  "restaurant_owner",
  "hotel_manager",
  "real_estate_professional",
  "construction_manager",
  "logistics_manager",
  "retailer",
  "ecommerce_operator",
  "lawyer",
  "accountant",
] as const;

export const CONSUMER_GROUP_CONTEXTS: readonly GroupSourceContext[] = [
  "consumer_group",
  "patient_group",
  "student_group",
  "parent_group",
  "public_marketplace",
] as const;

export const REGULATED_BUSINESS_TYPES: readonly BusinessType[] = [
  "dental_clinic",
  "general_clinic",
  "medical_center",
  "pharmacy",
  "medical_laboratory",
  "hospital",
  "school",
  "kindergarten",
  "university",
  "law_firm",
  "accounting_office",
  "government_or_public_entity",
] as const;

export const AI_INTELLIGENCE_QUEUE_NAMES = {
  INTELLIGENCE: "miraaj.ai.intelligence",
  DEAD_LETTER: "miraaj.ai.intelligence.dead-letter",
} as const;

export const AI_INTELLIGENCE_JOB_NAMES = {
  BUILD_BUSINESS_PROFILE: "build-business-profile",
  MATCH_SERVICES: "match-services",
  RECOMPUTE_RECOMMENDATIONS: "recompute-recommendations",
} as const;

export const PAYMENT_COMPLIANCE_DISCLAIMERS = {
  en: "Miraaj.tech provides technical integration, provider-selection guidance and lawful onboarding support. Financial accounts and merchant services are supplied by licensed third-party providers and remain subject to identity verification, company verification, country availability, activity eligibility and provider approval.",
  ar: "تقدم Miraaj.tech خدمات التكامل التقني، والمساعدة في اختيار مزود الخدمة، ودعم إجراءات الربط القانونية. يتم توفير الحسابات المالية وخدمات التجار من خلال جهات مرخصة، وتخضع للتحقق من الهوية، والتحقق من الشركة، وتوفر الخدمة في البلد، وأهلية النشاط، وموافقة مزود الخدمة.",
  fr: "Miraaj.tech fournit l’intégration technique, l’aide au choix du prestataire et l’accompagnement légal à l’intégration. Les comptes financiers et services marchands sont fournis par des prestataires tiers agréés et restent soumis à la vérification d’identité, à la vérification de l’entreprise, à la disponibilité dans le pays, à l’éligibilité de l’activité et à l’approbation du prestataire.",
} as const;

export const PROHIBITED_PAYMENT_CLAIM_PATTERNS = [
  /guaranteed\s+merchant\s+approval/i,
  /no\s+kyc/i,
  /no\s+kyb/i,
  /anonymous\s+financial\s+account/i,
  /account\s+without\s+registration/i,
  /bypass\s+country\s+restrictions/i,
  /miraaj\.tech\s+is\s+a\s+bank/i,
] as const;

export interface RankedCodeSignal<TCode extends string = string> {
  code: TCode;
  confidence: number;
  evidence: readonly string[];
  contradictingEvidence?: readonly string[];
  provenance:
    | "ocr"
    | "vision"
    | "analysis_result"
    | "user_hint"
    | "provider"
    | "deterministic"
    | "human_review"
    | "merged";
  inferred: boolean;
  warning?: string;
}

export interface ServiceMatchScoreBreakdown {
  businessTypeFit: number;
  industryFit: number;
  organizationFit: number;
  audienceFit: number;
  decisionMakerFit: number;
  professionalContextFit: number;
  needFit: number;
  painPointFit: number;
  objectiveFit: number;
  digitalMaturityFit: number;
  businessStageFit: number;
  marketFit: number;
  languageFit: number;
  channelFit: number;
  integrationFit: number;
  urgencyFit: number;
  securityFit: number;
  paymentReadinessFit: number;
  automationReadinessFit: number;
  capabilityAvailabilityFit: number;
  prerequisiteFit: number;
  complianceFit: number;
}

export interface ServiceMatchPenalties {
  consumerAudiencePenalty: number;
  audienceAmbiguityPenalty: number;
  businessTypeAmbiguityPenalty: number;
  contradictionPenalty: number;
  unsupportedMarketPenalty: number;
  unavailableCapabilityPenalty: number;
  missingPrerequisitePenalty: number;
  regulatedDomainPenalty: number;
  providerDependencyPenalty: number;
  lowEvidencePenalty: number;
  duplicateRecommendationPenalty: number;
  incompatibleServicePenalty: number;
}

export interface LocalizedStringMap {
  readonly [languageOrLocale: string]: string;
}

export function containsProhibitedPaymentClaim(text: string): boolean {
  return PROHIBITED_PAYMENT_CLAIM_PATTERNS.some((pattern) => pattern.test(text));
}

export function isConsumerAudience(audience: AudienceType): boolean {
  return (CONSUMER_AUDIENCE_TYPES as readonly string[]).includes(audience);
}

export function isProfessionalAudience(audience: AudienceType): boolean {
  return (PROFESSIONAL_AUDIENCE_TYPES as readonly string[]).includes(audience);
}

export function isConsumerGroupContext(context: GroupSourceContext): boolean {
  return (CONSUMER_GROUP_CONTEXTS as readonly string[]).includes(context);
}

export function isRegulatedBusinessType(type: BusinessType): boolean {
  return (REGULATED_BUSINESS_TYPES as readonly string[]).includes(type);
}
