/**
 * Prompt 3 — structured seed data for the Miraaj.tech service catalog.
 * Generated from arrays (not hand-written documents) so catalog-seed.service.ts
 * stays idempotent and easy to extend. NestJS remains the final authority on
 * ranking; this file only declares eligibility metadata used by the
 * deterministic matching engine.
 */
import {
  AUDIENCE_TYPES,
  BUSINESS_TYPES,
  PROFESSIONAL_AUDIENCE_TYPES,
  type AudienceType,
  type BusinessNeedCode,
  type BusinessType,
  type ServiceCategoryCode,
} from "@miraaj/shared-types";

export interface ServiceSeedDefinition {
  slug: string;
  categoryCode: ServiceCategoryCode;
  name: string;
  description: string;
  supportedBusinessTypes: BusinessType[];
  supportedAudienceTypes: AudienceType[];
  targetNeeds: BusinessNeedCode[];
  requiresProfessionalAudience: boolean;
  requiresDecisionMakerEvidence: boolean;
  isPaymentService: boolean;
  isRegulatedDomainOnly: boolean;
  providerDependency: string | null;
  prerequisiteSlugs: string[];
  phase: number;
  bundleEligible: boolean;
  tags: string[];
  availability: { global: boolean; countries: string[] };
}

const ALL_BUSINESS_TYPES_EXCEPT_UNKNOWN: BusinessType[] = BUSINESS_TYPES.filter(
  (type) => type !== "unknown",
);
const ALL_PROFESSIONAL_AUDIENCES: AudienceType[] = [
  ...PROFESSIONAL_AUDIENCE_TYPES,
];
const EXEC_AUDIENCES: AudienceType[] = [
  "business_owner",
  "company_founder",
  "executive",
  "operations_manager",
];

if ((AUDIENCE_TYPES as readonly string[]).length === 0) {
  throw new Error("AUDIENCE_TYPES taxonomy must not be empty.");
}

type SeedOverrides = Partial<
  Omit<ServiceSeedDefinition, "slug" | "categoryCode" | "name" | "description">
>;

function svc(
  slug: string,
  categoryCode: ServiceCategoryCode,
  name: string,
  description: string,
  overrides: SeedOverrides = {},
): ServiceSeedDefinition {
  return {
    slug,
    categoryCode,
    name,
    description,
    supportedBusinessTypes:
      overrides.supportedBusinessTypes ?? ALL_BUSINESS_TYPES_EXCEPT_UNKNOWN,
    supportedAudienceTypes:
      overrides.supportedAudienceTypes ?? ALL_PROFESSIONAL_AUDIENCES,
    targetNeeds: overrides.targetNeeds ?? [],
    requiresProfessionalAudience: overrides.requiresProfessionalAudience ?? true,
    requiresDecisionMakerEvidence:
      overrides.requiresDecisionMakerEvidence ?? false,
    isPaymentService: overrides.isPaymentService ?? false,
    isRegulatedDomainOnly: overrides.isRegulatedDomainOnly ?? false,
    providerDependency: overrides.providerDependency ?? null,
    prerequisiteSlugs: overrides.prerequisiteSlugs ?? [],
    phase: overrides.phase ?? 1,
    bundleEligible: overrides.bundleEligible ?? true,
    tags: overrides.tags ?? [categoryCode],
    availability: overrides.availability ?? { global: true, countries: [] },
  };
}

const DENTAL: BusinessType[] = ["dental_clinic"];
const CLINICAL: BusinessType[] = [
  "dental_clinic",
  "general_clinic",
  "medical_center",
  "hospital",
];
const PHARMACY: BusinessType[] = ["pharmacy"];
const EDUCATION: BusinessType[] = [
  "school",
  "kindergarten",
  "training_center",
  "university",
];
const RESTAURANT: BusinessType[] = ["restaurant", "coffee_shop"];
const HOSPITALITY: BusinessType[] = ["hotel", "travel_agency"];
const REAL_ESTATE: BusinessType[] = ["real_estate_agency", "property_management"];
const ECOMMERCE: BusinessType[] = [
  "retail_store",
  "ecommerce_business",
  "wholesale_business",
  "marketplace_business",
];
const LOGISTICS: BusinessType[] = [
  "logistics_company",
  "fleet_operator",
  "car_rental",
  "automotive_workshop",
];
const LEGAL_ACCOUNTING: BusinessType[] = [
  "law_firm",
  "accounting_office",
  "consultancy",
];
const MULTI_BRANCH_TYPES: BusinessType[] = [
  "restaurant",
  "coffee_shop",
  "retail_store",
  "pharmacy",
  "salon",
  "gym",
  "school",
  "medical_center",
  "hotel",
];

const CLINICAL_AUDIENCE: AudienceType[] = ["clinic_owner", "dentist", "doctor"];
const PHARMACY_AUDIENCE: AudienceType[] = ["pharmacist", "clinic_owner"];
const EDUCATION_AUDIENCE: AudienceType[] = ["school_manager", ...EXEC_AUDIENCES];
const RESTAURANT_AUDIENCE: AudienceType[] = ["restaurant_owner", ...EXEC_AUDIENCES];
const HOSPITALITY_AUDIENCE: AudienceType[] = ["hotel_manager", ...EXEC_AUDIENCES];
const REAL_ESTATE_AUDIENCE: AudienceType[] = [
  "real_estate_professional",
  ...EXEC_AUDIENCES,
];
const LEGAL_AUDIENCE: AudienceType[] = ["lawyer", "accountant", ...EXEC_AUDIENCES];

/** build — websites, apps, portals, platforms, and vertical management systems. */
const BUILD_SERVICES: ServiceSeedDefinition[] = [
  svc("corporate_website", "build", "Corporate Website", "Multi-page corporate website with CMS-driven content.", { targetNeeds: ["corporate_website"], phase: 0 }),
  svc("service_business_website", "build", "Service Business Website", "Lead-generating website tailored to service businesses.", { targetNeeds: ["service_website"], phase: 0 }),
  svc("ecommerce_store_build", "build", "E-commerce Store Build", "Full online store with catalog, cart, and checkout.", { supportedBusinessTypes: ECOMMERCE, supportedAudienceTypes: ["ecommerce_operator", "retailer", ...EXEC_AUDIENCES], targetNeeds: ["ecommerce_store"], phase: 1 }),
  svc("landing_page_build", "build", "Landing Page Build", "Conversion-focused landing page for a single offer.", { targetNeeds: ["landing_page"], phase: 0 }),
  svc("multilingual_website_build", "build", "Multilingual Website", "Website localized across Arabic, French, and English.", { targetNeeds: ["multilingual_website"], phase: 1 }),
  svc("website_modernization", "build", "Website Modernization", "Redesign and rebuild of an outdated website.", { targetNeeds: ["website_modernization"], phase: 1 }),
  svc("mobile_app_ios_android", "build", "Mobile Application (iOS/Android)", "Cross-platform mobile app for customers or staff.", { targetNeeds: ["mobile_application"], phase: 2, requiresDecisionMakerEvidence: true }),
  svc("desktop_application_build", "build", "Desktop Application", "Windows/macOS desktop application for internal operations.", { targetNeeds: ["desktop_application"], phase: 2 }),
  svc("custom_web_application", "build", "Custom Web Application", "Bespoke web application for a specific business workflow.", { targetNeeds: ["custom_web_application"], phase: 1, requiresDecisionMakerEvidence: true }),
  svc("customer_portal_build", "build", "Customer Portal", "Self-service portal for customer account management.", { targetNeeds: ["customer_portal"], phase: 2 }),
  svc("employee_portal_build", "build", "Employee Portal", "Internal portal for HR, documents, and announcements.", { targetNeeds: ["employee_portal"], phase: 2 }),
  svc("supplier_portal_build", "build", "Supplier Portal", "Portal for supplier onboarding, orders, and documents.", { targetNeeds: ["supplier_portal"], phase: 3 }),
  svc("marketplace_platform_build", "build", "Marketplace Platform", "Multi-vendor marketplace with commissions and payouts.", { supportedBusinessTypes: ["marketplace_business", "ecommerce_business"], targetNeeds: ["marketplace"], phase: 3, requiresDecisionMakerEvidence: true }),
  svc("saas_platform_build", "build", "SaaS Platform Build", "Multi-tenant SaaS product engineering.", { supportedBusinessTypes: ["software_company", "digital_agency"], targetNeeds: ["saas_platform"], phase: 3, requiresDecisionMakerEvidence: true }),
  svc("multi_branch_platform_build", "build", "Multi-Branch Platform", "Unified platform for businesses operating multiple branches.", { supportedBusinessTypes: MULTI_BRANCH_TYPES, targetNeeds: ["multi_branch_platform"], phase: 3, requiresDecisionMakerEvidence: true, tags: ["build", "multi_branch"] }),
  svc("dental_clinic_management", "build", "Dental Clinic Management System", "Appointments, patient records, and billing for dental clinics.", { supportedBusinessTypes: DENTAL, supportedAudienceTypes: CLINICAL_AUDIENCE, targetNeeds: ["patient_management", "booking"], requiresDecisionMakerEvidence: true, isRegulatedDomainOnly: true, tags: ["build", "clinical"] }),
  svc("school_management", "build", "School Management System", "Enrollment, attendance, grading, and parent communication.", { supportedBusinessTypes: EDUCATION, supportedAudienceTypes: EDUCATION_AUDIENCE, targetNeeds: ["student_management", "attendance"], requiresDecisionMakerEvidence: true, isRegulatedDomainOnly: true, tags: ["build", "education"] }),
  svc("restaurant_management", "build", "Restaurant Management System", "Menu, orders, tables, and kitchen display workflows.", { supportedBusinessTypes: RESTAURANT, supportedAudienceTypes: RESTAURANT_AUDIENCE, targetNeeds: ["restaurant_management", "booking"], tags: ["build", "restaurant"] }),
  svc("hotel_management", "build", "Hotel Management System", "Reservations, housekeeping, and front-desk operations.", { supportedBusinessTypes: HOSPITALITY, supportedAudienceTypes: HOSPITALITY_AUDIENCE, targetNeeds: ["hotel_management", "booking"], tags: ["build", "hospitality"] }),
  svc("real_estate_management_platform", "build", "Real Estate Management Platform", "Listings, leads, and property management workflows.", { supportedBusinessTypes: REAL_ESTATE, supportedAudienceTypes: REAL_ESTATE_AUDIENCE, targetNeeds: ["real_estate_management"], tags: ["build", "real_estate"] }),
  svc("booking_platform_build", "build", "Booking Platform", "Online booking and calendar management for services.", { targetNeeds: ["booking", "scheduling"], phase: 1 }),
  svc("scheduling_platform_build", "build", "Scheduling Platform", "Staff and resource scheduling with conflict detection.", { targetNeeds: ["scheduling"], phase: 1 }),
  svc("patient_management_system", "build", "Patient Management System", "Patient records, visits, and clinical documentation.", { supportedBusinessTypes: CLINICAL, supportedAudienceTypes: CLINICAL_AUDIENCE, targetNeeds: ["patient_management"], requiresDecisionMakerEvidence: true, isRegulatedDomainOnly: true, tags: ["build", "clinical"] }),
  svc("student_management_system", "build", "Student Management System", "Student records, enrollment, and academic tracking.", { supportedBusinessTypes: EDUCATION, supportedAudienceTypes: EDUCATION_AUDIENCE, targetNeeds: ["student_management"], requiresDecisionMakerEvidence: true, isRegulatedDomainOnly: true, tags: ["build", "education"] }),
  svc("pharmacy_management_system", "build", "Pharmacy Management System", "Inventory, prescriptions, and point-of-sale for pharmacies.", { supportedBusinessTypes: PHARMACY, supportedAudienceTypes: PHARMACY_AUDIENCE, targetNeeds: ["inventory", "patient_management"], requiresDecisionMakerEvidence: true, isRegulatedDomainOnly: true, tags: ["build", "clinical"] }),
  svc("clinic_erp_build", "build", "Clinic ERP", "End-to-end clinic operations, billing, and reporting.", { supportedBusinessTypes: CLINICAL, supportedAudienceTypes: CLINICAL_AUDIENCE, targetNeeds: ["erp", "patient_management"], phase: 2, requiresDecisionMakerEvidence: true, isRegulatedDomainOnly: true, tags: ["build", "clinical"] }),
];

/** manage — operational back-office systems. */
const MANAGE_SERVICES: ServiceSeedDefinition[] = [
  svc("crm_implementation", "manage", "CRM Implementation", "Customer relationship management setup and customization.", { targetNeeds: ["crm"], phase: 1 }),
  svc("erp_implementation", "manage", "ERP Implementation", "Enterprise resource planning rollout across departments.", { targetNeeds: ["erp"], phase: 2, requiresDecisionMakerEvidence: true }),
  svc("inventory_management_system", "manage", "Inventory Management System", "Stock tracking across locations with low-stock alerts.", { supportedBusinessTypes: [...ECOMMERCE, ...PHARMACY, "manufacturing_company", "wholesale_business"], targetNeeds: ["inventory"], phase: 1 }),
  svc("warehouse_management_system", "manage", "Warehouse Management System", "Warehouse operations, picking, and stock movement.", { supportedBusinessTypes: [...LOGISTICS, "manufacturing_company", "wholesale_business"], targetNeeds: ["warehouse"], phase: 2 }),
  svc("accounting_interface_integration", "manage", "Accounting Interface Integration", "Connects operational data to accounting systems.", { targetNeeds: ["accounting_interface"], phase: 2 }),
  svc("invoicing_system", "manage", "Invoicing System", "Automated invoice generation and delivery.", { targetNeeds: ["invoices"], phase: 1 }),
  svc("expense_management_system", "manage", "Expense Management System", "Expense capture, approval, and reporting.", { targetNeeds: ["expenses"], phase: 1 }),
  svc("employee_management_system", "manage", "Employee Management System", "Staff records, roles, and performance tracking.", { targetNeeds: ["employee_management"], phase: 1 }),
  svc("attendance_tracking_system", "manage", "Attendance Tracking System", "Clock-in/out, shift tracking, and attendance reports.", { targetNeeds: ["attendance"], phase: 1 }),
  svc("payroll_configuration_service", "manage", "Payroll Configuration Service", "Payroll rules, deductions, and payslip generation setup.", { targetNeeds: ["payroll_configuration"], phase: 2, requiresDecisionMakerEvidence: true }),
  svc("document_management_system", "manage", "Document Management System", "Centralized document storage, versioning, and access control.", { targetNeeds: ["document_management"], phase: 1 }),
  svc("reporting_dashboard", "manage", "Reporting Dashboard", "Operational dashboards summarizing key business metrics.", { targetNeeds: ["reporting"], phase: 1 }),
  svc("multi_branch_operations_management", "manage", "Multi-Branch Operations Management", "Central visibility and control across multiple branches.", { supportedBusinessTypes: MULTI_BRANCH_TYPES, targetNeeds: ["multi_branch_platform", "reporting"], phase: 3, requiresDecisionMakerEvidence: true }),
  svc("supplier_relationship_management", "manage", "Supplier Relationship Management", "Supplier scorecards, contracts, and communication tracking.", { targetNeeds: ["supplier_portal"], phase: 3 }),
];

/** artificial_intelligence — AI assistants and automation intelligence. */
const AI_SERVICES: ServiceSeedDefinition[] = [
  svc("custom_ai_assistant", "artificial_intelligence", "Custom AI Assistant", "Business-specific AI assistant trained on your data.", { targetNeeds: ["custom_ai_assistant"], phase: 2 }),
  svc("customer_support_ai_agent", "artificial_intelligence", "Customer Support AI Agent", "AI agent that answers customer questions across channels.", { targetNeeds: ["customer_support_ai"], phase: 2 }),
  svc("sales_ai_agent", "artificial_intelligence", "Sales AI Agent", "AI agent that qualifies and follows up with leads.", { targetNeeds: ["sales_ai"], phase: 2 }),
  svc("document_analysis_ai", "artificial_intelligence", "Document Analysis AI", "Extracts structured data from business documents.", { targetNeeds: ["document_analysis"], phase: 2 }),
  svc("image_analysis_ai", "artificial_intelligence", "Image Analysis AI", "Analyzes product or business images for insights.", { targetNeeds: ["image_analysis"], phase: 2 }),
  svc("business_analysis_ai", "artificial_intelligence", "Business Analysis AI", "AI-assisted analysis of business operations and evidence.", { targetNeeds: ["business_analysis"], phase: 2 }),
  svc("recommendation_engine_build", "artificial_intelligence", "Recommendation Engine", "Personalized product or content recommendation engine.", { supportedBusinessTypes: ECOMMERCE, targetNeeds: ["recommendation_engine"], phase: 3, requiresDecisionMakerEvidence: true }),
  svc("content_assistance_ai", "artificial_intelligence", "Content Assistance AI", "AI-assisted drafting of marketing and support content.", { targetNeeds: ["content_assistance"], phase: 2 }),
  svc("internal_knowledge_assistant", "artificial_intelligence", "Internal Knowledge Assistant", "AI assistant answering questions from internal documentation.", { targetNeeds: ["internal_knowledge_assistant"], phase: 2 }),
  svc("lead_qualification_ai", "artificial_intelligence", "Lead Qualification AI", "Automatically scores and routes inbound leads.", { targetNeeds: ["lead_qualification"], phase: 2 }),
  svc("demand_forecasting_ai", "artificial_intelligence", "Demand Forecasting AI", "Forecasts demand for inventory and staffing planning.", { supportedBusinessTypes: [...ECOMMERCE, "manufacturing_company", "restaurant"], targetNeeds: ["forecasting"], phase: 3, requiresDecisionMakerEvidence: true }),
  svc("ai_workflow_orchestration", "artificial_intelligence", "AI Workflow Orchestration", "Coordinates multiple AI agents across business workflows.", { targetNeeds: ["ai_workflow_orchestration"], phase: 3, requiresDecisionMakerEvidence: true }),
  svc("patient_triage_ai_assistant", "artificial_intelligence", "Patient Triage AI Assistant", "AI assistant that helps triage and route patient inquiries.", { supportedBusinessTypes: CLINICAL, supportedAudienceTypes: CLINICAL_AUDIENCE, targetNeeds: ["customer_support_ai", "patient_management"], requiresDecisionMakerEvidence: true, isRegulatedDomainOnly: true, tags: ["artificial_intelligence", "clinical"] }),
  svc("legal_document_ai_assistant", "artificial_intelligence", "Legal Document AI Assistant", "AI-assisted drafting and review of legal documents.", { supportedBusinessTypes: ["law_firm"], supportedAudienceTypes: LEGAL_AUDIENCE, targetNeeds: ["document_analysis", "document_generation"], requiresDecisionMakerEvidence: true, isRegulatedDomainOnly: true, tags: ["artificial_intelligence", "legal"] }),
  svc("accounting_ai_assistant", "artificial_intelligence", "Accounting AI Assistant", "AI assistant for bookkeeping questions and reconciliation help.", { supportedBusinessTypes: LEGAL_ACCOUNTING, supportedAudienceTypes: LEGAL_AUDIENCE, targetNeeds: ["accounting_interface"], phase: 2 }),
  svc("multilingual_ai_support_agent", "artificial_intelligence", "Multilingual AI Support Agent", "Support agent covering Arabic, French, and English.", { targetNeeds: ["customer_support_ai", "multilingual_content"], phase: 2 }),
];

/** automation — messaging, workflow, and document automation. */
const AUTOMATION_SERVICES: ServiceSeedDefinition[] = [
  svc("whatsapp_business_automation", "automation", "WhatsApp Business Automation", "Automated WhatsApp flows for orders and support.", { targetNeeds: ["whatsapp_automation"], phase: 1 }),
  svc("email_marketing_automation", "automation", "Email Marketing Automation", "Automated nurture and campaign email sequences.", { targetNeeds: ["email_automation"], phase: 1 }),
  svc("sms_automation", "automation", "SMS Automation", "Automated SMS notifications and reminders.", { targetNeeds: ["sms_automation"], phase: 1 }),
  svc("telegram_bot_automation", "automation", "Telegram Bot Automation", "Automated Telegram bot for orders and updates.", { targetNeeds: ["telegram_automation"], phase: 1 }),
  svc("booking_automation", "automation", "Booking Automation", "Automated confirmations and reminders for bookings.", { targetNeeds: ["booking_automation"], phase: 1 }),
  svc("lead_follow_up_automation", "automation", "Lead Follow-up Automation", "Automated multi-step follow-up sequences for leads.", { targetNeeds: ["lead_follow_up"], phase: 1 }),
  svc("payment_reminder_automation", "automation", "Payment Reminder Automation", "Automated reminders for outstanding invoices.", { targetNeeds: ["payment_reminders"], phase: 1 }),
  svc("invoice_automation", "automation", "Invoice Automation", "Automated invoice creation from orders or contracts.", { targetNeeds: ["invoice_automation"], phase: 1 }),
  svc("document_generation_automation", "automation", "Document Generation Automation", "Automated generation of contracts and reports from templates.", { targetNeeds: ["document_generation"], phase: 2 }),
  svc("approval_workflow_automation", "automation", "Approval Workflow Automation", "Multi-step approval routing for internal requests.", { targetNeeds: ["approval_workflow"], phase: 2 }),
  svc("onboarding_automation", "automation", "Onboarding Automation", "Automated onboarding sequences for customers or staff.", { targetNeeds: ["onboarding_automation"], phase: 2 }),
  svc("data_sync_automation", "automation", "Data Sync Automation", "Keeps data synchronized across connected systems.", { targetNeeds: ["data_sync"], phase: 2 }),
  svc("scheduled_reports_automation", "automation", "Scheduled Reports Automation", "Automatically delivered recurring business reports.", { targetNeeds: ["scheduled_reports"], phase: 1 }),
  svc("notification_automation", "automation", "Notification Automation", "Rules-based notifications across channels.", { targetNeeds: ["notifications"], phase: 1 }),
  svc("custom_workflow_automation", "automation", "Custom Workflow Automation", "Bespoke automation for a specific business process.", { targetNeeds: ["custom_workflow"], phase: 2 }),
  svc("hr_onboarding_automation", "automation", "HR Onboarding Automation", "Automated employee onboarding paperwork and tasks.", { targetNeeds: ["onboarding_automation", "employee_management"], phase: 2 }),
];

/** payments — all attach compliance disclaimers and provider dependency. */
const PAYMENT_SERVICES: ServiceSeedDefinition[] = [
  svc("online_checkout_integration", "payments", "Online Checkout Integration", "Integrates a licensed payment provider checkout flow.", { targetNeeds: ["online_checkout"], phase: 1 }),
  svc("payment_links_setup", "payments", "Payment Links Setup", "Shareable payment links for invoices and orders.", { targetNeeds: ["payment_links"], phase: 1 }),
  svc("subscription_billing_setup", "payments", "Subscription Billing Setup", "Recurring subscription billing configuration.", { targetNeeds: ["subscriptions"], phase: 2 }),
  svc("recurring_payments_setup", "payments", "Recurring Payments Setup", "Recurring charge scheduling through a licensed provider.", { targetNeeds: ["recurring_payments"], phase: 2 }),
  svc("invoices_payments_integration", "payments", "Invoices & Payments Integration", "Connects invoicing to online payment collection.", { targetNeeds: ["invoices_payments"], phase: 1 }),
  svc("bank_transfer_workflow_setup", "payments", "Bank Transfer Workflow Setup", "Structured bank-transfer confirmation workflow.", { targetNeeds: ["bank_transfer_workflow"], phase: 1 }),
  svc("payment_confirmation_automation", "payments", "Payment Confirmation Automation", "Automated confirmation messaging after successful payment.", { targetNeeds: ["payment_confirmation"], phase: 1 }),
  svc("refunds_management_setup", "payments", "Refunds Management Setup", "Structured refund request and approval workflow.", { targetNeeds: ["refunds"], phase: 2 }),
  svc("reconciliation_automation", "payments", "Reconciliation Automation", "Automated reconciliation of payments against orders.", { targetNeeds: ["reconciliation"], phase: 2 }),
  svc("marketplace_payments_setup", "payments", "Marketplace Payments Setup", "Split payments and payouts for marketplace vendors.", { supportedBusinessTypes: ["marketplace_business"], targetNeeds: ["marketplace_payments"], phase: 3, requiresDecisionMakerEvidence: true }),
  svc("multi_currency_payment_interface", "payments", "Multi-Currency Payment Interface", "Accepts and displays multiple currencies at checkout.", { targetNeeds: ["multi_currency_interface"], phase: 2 }),
  svc("payment_provider_integration", "payments", "Payment Provider Integration", "Technical integration with a licensed payment provider.", { targetNeeds: ["provider_integration"], phase: 1 }),
  svc("merchant_onboarding_support", "payments", "Merchant Onboarding Support", "Guidance through a licensed provider's merchant onboarding.", { targetNeeds: ["merchant_onboarding_support"], phase: 1, requiresDecisionMakerEvidence: true }),
  svc("transaction_dashboard_build", "payments", "Transaction Dashboard", "Dashboard summarizing transactions, fees, and payouts.", { targetNeeds: ["transaction_dashboard"], phase: 2 }),
].map((item) => ({
  ...item,
  isPaymentService: true,
  providerDependency: "licensed_third_party_payment_provider",
}));

/** cybersecurity — audits, hardening, and resilience. */
const CYBERSECURITY_SERVICES: ServiceSeedDefinition[] = [
  svc("security_audit", "cybersecurity", "Security Audit", "Comprehensive assessment of application and infrastructure security.", { targetNeeds: ["security_audit"], phase: 1, requiresDecisionMakerEvidence: true }),
  svc("authentication_hardening", "cybersecurity", "Authentication Hardening", "Strengthens login, MFA, and session security.", { targetNeeds: ["authentication_hardening"], phase: 1 }),
  svc("access_control_implementation", "cybersecurity", "Access Control Implementation", "Role-based access control across systems.", { targetNeeds: ["access_control"], phase: 1 }),
  svc("api_security_hardening", "cybersecurity", "API Security Hardening", "Secures APIs against common attack vectors.", { targetNeeds: ["api_security"], phase: 1 }),
  svc("secure_file_uploads_implementation", "cybersecurity", "Secure File Uploads", "Safe handling and storage of user-uploaded files.", { targetNeeds: ["secure_file_uploads"], phase: 1 }),
  svc("cloud_security_hardening", "cybersecurity", "Cloud Security Hardening", "Secures cloud infrastructure configuration and access.", { targetNeeds: ["cloud_security"], phase: 1 }),
  svc("backup_strategy_setup", "cybersecurity", "Backup Strategy Setup", "Automated, tested backup strategy for critical data.", { targetNeeds: ["backup"], phase: 1 }),
  svc("disaster_recovery_planning", "cybersecurity", "Disaster Recovery Planning", "Recovery plans and runbooks for major incidents.", { targetNeeds: ["disaster_recovery"], phase: 2, requiresDecisionMakerEvidence: true }),
  svc("security_monitoring_setup", "cybersecurity", "Security Monitoring Setup", "Continuous monitoring and alerting for security events.", { targetNeeds: ["monitoring"], phase: 2 }),
  svc("audit_logging_implementation", "cybersecurity", "Audit Logging Implementation", "Tamper-evident audit trails for sensitive actions.", { targetNeeds: ["audit_logs"], phase: 1 }),
  svc("secrets_management_setup", "cybersecurity", "Secrets Management Setup", "Centralized, encrypted management of credentials and keys.", { targetNeeds: ["secrets_management"], phase: 1 }),
  svc("infrastructure_hardening", "cybersecurity", "Infrastructure Hardening", "Hardens servers, containers, and network configuration.", { targetNeeds: ["infrastructure_hardening"], phase: 1 }),
  svc("privacy_by_design_consulting", "cybersecurity", "Privacy-by-Design Consulting", "Advises on privacy-preserving system design.", { targetNeeds: ["privacy_design"], phase: 0 }),
];

/** cloud_infrastructure — hosting, deployment, and operability. */
const CLOUD_SERVICES: ServiceSeedDefinition[] = [
  svc("cloud_architecture_design", "cloud_infrastructure", "Cloud Architecture Design", "Designs a scalable, secure cloud architecture.", { targetNeeds: ["cloud_architecture"], phase: 0 }),
  svc("application_deployment_setup", "cloud_infrastructure", "Application Deployment Setup", "Repeatable deployment pipeline to production.", { targetNeeds: ["deployment"], phase: 0 }),
  svc("containerization_setup", "cloud_infrastructure", "Containerization Setup", "Packages applications into portable containers.", { targetNeeds: ["containerization"], phase: 1 }),
  svc("managed_hosting_planning", "cloud_infrastructure", "Managed Hosting Planning", "Plans managed hosting to reduce operational burden.", { targetNeeds: ["managed_hosting_planning"], phase: 0 }),
  svc("staging_environment_setup", "cloud_infrastructure", "Staging Environment Setup", "Isolated staging environment mirroring production.", { targetNeeds: ["staging_environment"], phase: 0 }),
  svc("production_environment_setup", "cloud_infrastructure", "Production Environment Setup", "Hardened, monitored production environment.", { targetNeeds: ["production_environment"], phase: 0 }),
  svc("object_storage_setup", "cloud_infrastructure", "Object Storage Setup", "Scalable object storage for media and documents.", { targetNeeds: ["object_storage"], phase: 1 }),
  svc("database_hosting_setup", "cloud_infrastructure", "Database Hosting Setup", "Managed, backed-up database hosting.", { targetNeeds: ["database_hosting"], phase: 0 }),
  svc("redis_caching_setup", "cloud_infrastructure", "Redis Caching Setup", "Caching layer to reduce latency and database load.", { targetNeeds: ["redis_caching"], phase: 2 }),
  svc("queue_infrastructure_setup", "cloud_infrastructure", "Queue Infrastructure Setup", "Reliable background job and queue infrastructure.", { targetNeeds: ["queues"], phase: 2 }),
  svc("cdn_setup", "cloud_infrastructure", "CDN Setup", "Content delivery network for faster global access.", { targetNeeds: ["cdn"], phase: 1 }),
  svc("dns_management_setup", "cloud_infrastructure", "DNS Management Setup", "Domain and DNS configuration and monitoring.", { targetNeeds: ["dns"], phase: 0 }),
  svc("centralized_logging_setup", "cloud_infrastructure", "Centralized Logging Setup", "Aggregated, searchable application logs.", { targetNeeds: ["logging"], phase: 1 }),
  svc("ci_cd_pipeline_setup", "cloud_infrastructure", "CI/CD Pipeline Setup", "Automated build, test, and deployment pipeline.", { targetNeeds: ["ci_cd"], phase: 1 }),
  svc("scalability_planning", "cloud_infrastructure", "Scalability Planning", "Plans for handling growth in traffic and data.", { targetNeeds: ["scalability"], phase: 3, requiresDecisionMakerEvidence: true }),
  svc("high_availability_architecture", "cloud_infrastructure", "High-Availability Architecture", "Redundant architecture to minimize downtime.", { targetNeeds: ["high_availability"], phase: 3, requiresDecisionMakerEvidence: true }),
  svc("cost_visibility_dashboard", "cloud_infrastructure", "Cost Visibility Dashboard", "Dashboard tracking cloud spend by service.", { targetNeeds: ["cost_visibility"], phase: 2 }),
];

/** data_analytics — dashboards and forecasting. */
const ANALYTICS_SERVICES: ServiceSeedDefinition[] = [
  svc("business_analytics_dashboard", "data_analytics", "Business Analytics Dashboard", "Consolidated dashboard of core business metrics.", { targetNeeds: ["analytics"], phase: 2 }),
  svc("reporting_automation_setup", "data_analytics", "Reporting Automation Setup", "Automates recurring management reports.", { targetNeeds: ["reporting"], phase: 2 }),
  svc("kpi_tracking_dashboard", "data_analytics", "KPI Tracking Dashboard", "Tracks and visualizes key performance indicators.", { targetNeeds: ["analytics"], phase: 2 }),
  svc("data_warehouse_setup", "data_analytics", "Data Warehouse Setup", "Centralized warehouse for cross-system analytics.", { targetNeeds: ["analytics"], phase: 3, requiresDecisionMakerEvidence: true }),
  svc("customer_analytics_platform", "data_analytics", "Customer Analytics Platform", "Segments and analyzes customer behavior.", { supportedBusinessTypes: ECOMMERCE, targetNeeds: ["analytics"], phase: 3 }),
  svc("sales_analytics_platform", "data_analytics", "Sales Analytics Platform", "Tracks pipeline, conversion, and sales performance.", { targetNeeds: ["analytics"], phase: 2 }),
  svc("operational_analytics_dashboard", "data_analytics", "Operational Analytics Dashboard", "Monitors day-to-day operational efficiency.", { targetNeeds: ["analytics"], phase: 2 }),
  svc("predictive_analytics_setup", "data_analytics", "Predictive Analytics Setup", "Forecasts trends using historical business data.", { targetNeeds: ["forecasting"], phase: 3, requiresDecisionMakerEvidence: true }),
  svc("data_visualization_platform", "data_analytics", "Data Visualization Platform", "Interactive charts and exploration tools.", { targetNeeds: ["analytics"], phase: 2 }),
  svc("multi_branch_analytics_rollup", "data_analytics", "Multi-Branch Analytics Rollup", "Aggregated analytics across all branches.", { supportedBusinessTypes: MULTI_BRANCH_TYPES, targetNeeds: ["analytics", "multi_branch_platform"], phase: 3, requiresDecisionMakerEvidence: true }),
];

/** growth_marketing_media — branding, content, and demand generation. */
const GROWTH_SERVICES: ServiceSeedDefinition[] = [
  svc("branding_identity_design", "growth_marketing_media", "Branding & Identity Design", "Logo, brand guidelines, and visual identity.", { targetNeeds: ["branding"], phase: 0 }),
  svc("social_media_strategy_consulting", "growth_marketing_media", "Social Media Strategy Consulting", "Strategy and planning for organic social presence.", { targetNeeds: ["social_media_strategy"], phase: 0 }),
  svc("content_calendar_planning", "growth_marketing_media", "Content Calendar Planning", "Structured content planning across channels.", { targetNeeds: ["content_calendar"], phase: 1 }),
  svc("advertising_strategy_consulting", "growth_marketing_media", "Advertising Strategy Consulting", "Paid advertising strategy across channels.", { targetNeeds: ["advertising_strategy"], phase: 1 }),
  svc("campaign_landing_page_build", "growth_marketing_media", "Campaign Landing Page", "Dedicated landing page for a marketing campaign.", { targetNeeds: ["campaign_landing_page"], phase: 1 }),
  svc("lead_generation_funnel_build", "growth_marketing_media", "Lead Generation Funnel", "End-to-end funnel from ad to qualified lead.", { targetNeeds: ["lead_generation"], phase: 1 }),
  svc("seo_optimization_service", "growth_marketing_media", "SEO Optimization Service", "Improves organic search visibility and ranking.", { targetNeeds: ["seo"], phase: 1 }),
  svc("video_production_service", "growth_marketing_media", "Video Production Service", "Professional video content production.", { targetNeeds: ["video_production"], phase: 1 }),
  svc("product_demo_video_production", "growth_marketing_media", "Product Demo Video Production", "Explainer video showcasing a product or service.", { targetNeeds: ["product_demo_video"], phase: 1 }),
  svc("social_short_video_production", "growth_marketing_media", "Social Short-Video Production", "Short-form video content for social platforms.", { targetNeeds: ["social_short_video"], phase: 1 }),
  svc("multilingual_content_localization", "growth_marketing_media", "Multilingual Content Localization", "Localizes marketing content across languages.", { targetNeeds: ["multilingual_content"], phase: 1 }),
  svc("referral_program_setup", "growth_marketing_media", "Referral Program Setup", "Structured referral incentives and tracking.", { targetNeeds: ["referral_program"], phase: 2 }),
  svc("customer_loyalty_program_setup", "growth_marketing_media", "Customer Loyalty Program Setup", "Points, tiers, and rewards for repeat customers.", { targetNeeds: ["customer_loyalty"], phase: 2 }),
  svc("marketing_automation_setup", "growth_marketing_media", "Marketing Automation Setup", "Automated multi-channel marketing sequences.", { targetNeeds: ["email_automation", "lead_generation"], phase: 2 }),
  svc("influencer_campaign_consulting", "growth_marketing_media", "Influencer Campaign Consulting", "Plans and coordinates influencer partnerships.", { targetNeeds: ["advertising_strategy"], phase: 1 }),
  svc("email_newsletter_design", "growth_marketing_media", "Email Newsletter Design", "Branded, recurring email newsletter design.", { targetNeeds: ["content_calendar", "email_automation"], phase: 1 }),
];

/** consulting_transformation — advisory and change management. */
const CONSULTING_SERVICES: ServiceSeedDefinition[] = [
  svc("digital_transformation_consulting", "consulting_transformation", "Digital Transformation Consulting", "Roadmap for modernizing operations with technology.", { targetNeeds: ["business_analysis"], phase: 0, requiresDecisionMakerEvidence: true }),
  svc("technology_stack_assessment", "consulting_transformation", "Technology Stack Assessment", "Evaluates current systems and recommends improvements.", { targetNeeds: ["business_analysis"], phase: 0 }),
  svc("process_automation_consulting", "consulting_transformation", "Process Automation Consulting", "Identifies high-value automation opportunities.", { targetNeeds: ["custom_workflow"], phase: 0 }),
  svc("it_infrastructure_audit", "consulting_transformation", "IT Infrastructure Audit", "Reviews infrastructure for risk and inefficiency.", { targetNeeds: ["business_analysis"], phase: 0 }),
  svc("software_vendor_selection_consulting", "consulting_transformation", "Software Vendor Selection Consulting", "Independent guidance on selecting software vendors.", { targetNeeds: ["business_analysis"], phase: 0, requiresDecisionMakerEvidence: true }),
  svc("change_management_consulting", "consulting_transformation", "Change Management Consulting", "Supports teams through technology-driven change.", { targetNeeds: ["business_analysis"], phase: 0, requiresDecisionMakerEvidence: true }),
  svc("data_governance_consulting", "consulting_transformation", "Data Governance Consulting", "Establishes policies for data quality and ownership.", { targetNeeds: ["business_analysis"], phase: 1 }),
  svc("digital_maturity_assessment", "consulting_transformation", "Digital Maturity Assessment", "Benchmarks digital maturity against industry peers.", { targetNeeds: ["business_analysis"], phase: 0 }),
  svc("multi_branch_standardization_consulting", "consulting_transformation", "Multi-Branch Standardization Consulting", "Standardizes processes and systems across branches.", { supportedBusinessTypes: MULTI_BRANCH_TYPES, targetNeeds: ["multi_branch_platform"], phase: 3, requiresDecisionMakerEvidence: true }),
  svc("merger_it_integration_consulting", "consulting_transformation", "Merger IT Integration Consulting", "Plans technology integration during mergers.", { targetNeeds: ["business_analysis"], phase: 3, requiresDecisionMakerEvidence: true }),
  svc("sustainability_tech_consulting", "consulting_transformation", "Sustainability Technology Consulting", "Advises on technology choices reducing environmental impact.", { targetNeeds: ["business_analysis"], phase: 1 }),
  svc("staff_technology_training", "consulting_transformation", "Staff Technology Training", "Hands-on training for staff on new systems.", { targetNeeds: ["business_analysis"], phase: 2 }),
];

export const CATALOG_SEED_SERVICES: ServiceSeedDefinition[] = [
  ...BUILD_SERVICES,
  ...MANAGE_SERVICES,
  ...AI_SERVICES,
  ...AUTOMATION_SERVICES,
  ...PAYMENT_SERVICES,
  ...CYBERSECURITY_SERVICES,
  ...CLOUD_SERVICES,
  ...ANALYTICS_SERVICES,
  ...GROWTH_SERVICES,
  ...CONSULTING_SERVICES,
];

export interface CategorySeedDefinition {
  code: ServiceCategoryCode;
  name: string;
  description: string;
  sortOrder: number;
}

export const CATALOG_SEED_CATEGORIES: CategorySeedDefinition[] = [
  { code: "build", name: "Build", description: "Websites, apps, portals, and platforms.", sortOrder: 0 },
  { code: "manage", name: "Manage", description: "Operational back-office and management systems.", sortOrder: 1 },
  { code: "artificial_intelligence", name: "Artificial Intelligence", description: "AI assistants, agents, and intelligent automation.", sortOrder: 2 },
  { code: "automation", name: "Automation", description: "Messaging, workflow, and document automation.", sortOrder: 3 },
  { code: "payments", name: "Payments", description: "Payment integration and provider-dependent financial workflows.", sortOrder: 4 },
  { code: "cybersecurity", name: "Cybersecurity", description: "Security audits, hardening, and resilience.", sortOrder: 5 },
  { code: "cloud_infrastructure", name: "Cloud Infrastructure", description: "Hosting, deployment, and operability.", sortOrder: 6 },
  { code: "data_analytics", name: "Data & Analytics", description: "Dashboards, reporting, and forecasting.", sortOrder: 7 },
  { code: "growth_marketing_media", name: "Growth, Marketing & Media", description: "Branding, content, and demand generation.", sortOrder: 8 },
  { code: "consulting_transformation", name: "Consulting & Transformation", description: "Advisory and change management services.", sortOrder: 9 },
];

export interface BundleSeedDefinition {
  code: "dental" | "restaurant" | "school" | "real_estate" | "ecommerce" | "multi_branch";
  name: string;
  description: string;
  memberSlugs: string[];
  applicableBusinessTypes: BusinessType[];
}

export const CATALOG_SEED_BUNDLES: BundleSeedDefinition[] = [
  {
    code: "dental",
    name: "Dental Clinic Growth Bundle",
    description: "Core systems and safeguards for dental clinics.",
    memberSlugs: [
      "dental_clinic_management",
      "patient_management_system",
      "booking_platform_build",
      "whatsapp_business_automation",
      "payment_reminder_automation",
      "security_audit",
      "backup_strategy_setup",
    ],
    applicableBusinessTypes: DENTAL,
  },
  {
    code: "restaurant",
    name: "Restaurant Operations Bundle",
    description: "Ordering, booking, and marketing for restaurants.",
    memberSlugs: [
      "restaurant_management",
      "booking_platform_build",
      "whatsapp_business_automation",
      "online_checkout_integration",
      "customer_loyalty_program_setup",
      "social_media_strategy_consulting",
    ],
    applicableBusinessTypes: RESTAURANT,
  },
  {
    code: "school",
    name: "School Administration Bundle",
    description: "Enrollment, attendance, and parent communication for schools.",
    memberSlugs: [
      "school_management",
      "student_management_system",
      "attendance_tracking_system",
      "sms_automation",
      "payment_reminder_automation",
      "security_audit",
    ],
    applicableBusinessTypes: EDUCATION,
  },
  {
    code: "real_estate",
    name: "Real Estate Growth Bundle",
    description: "Listings, leads, and CRM for real estate agencies.",
    memberSlugs: [
      "real_estate_management_platform",
      "crm_implementation",
      "lead_generation_funnel_build",
      "whatsapp_business_automation",
      "seo_optimization_service",
    ],
    applicableBusinessTypes: REAL_ESTATE,
  },
  {
    code: "ecommerce",
    name: "E-commerce Launch Bundle",
    description: "Store, payments, and growth tooling for online retail.",
    memberSlugs: [
      "ecommerce_store_build",
      "online_checkout_integration",
      "inventory_management_system",
      "recommendation_engine_build",
      "seo_optimization_service",
      "security_audit",
    ],
    applicableBusinessTypes: ECOMMERCE,
  },
  {
    code: "multi_branch",
    name: "Multi-Branch Standardization Bundle",
    description: "Unified platform, analytics, and governance across branches.",
    memberSlugs: [
      "multi_branch_platform_build",
      "multi_branch_operations_management",
      "multi_branch_analytics_rollup",
      "multi_branch_standardization_consulting",
      "access_control_implementation",
    ],
    applicableBusinessTypes: MULTI_BRANCH_TYPES,
  },
];
