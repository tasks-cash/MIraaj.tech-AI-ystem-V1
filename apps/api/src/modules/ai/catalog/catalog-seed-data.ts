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
const CONSTRUCTION: BusinessType[] = ["construction_company"];
const AGRICULTURE: BusinessType[] = ["agriculture_business"];
const SALON_GYM: BusinessType[] = ["salon", "gym"];
const SOFTWARE: BusinessType[] = ["software_company", "digital_agency"];
const PROFESSIONAL: BusinessType[] = ["professional_services", "consultancy"];
const MANUFACTURING: BusinessType[] = ["manufacturing_company"];
const TRAVEL: BusinessType[] = ["travel_agency"];

type SvcTuple = readonly [string, string, string, SeedOverrides?];

function svcMany(
  categoryCode: ServiceCategoryCode,
  entries: readonly SvcTuple[],
): ServiceSeedDefinition[] {
  return entries.map(([slug, name, description, overrides]) =>
    svc(slug, categoryCode, name, description, overrides ?? {}),
  );
}

function asPaymentServices(items: ServiceSeedDefinition[]): ServiceSeedDefinition[] {
  return items.map((item) => ({
    ...item,
    isPaymentService: true,
    providerDependency: "licensed_third_party_payment_provider",
  }));
}

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

const BUILD_VERTICAL_WEBSITES: ServiceSeedDefinition[] = svcMany("build", [
  ["small_business_website", "Small Business Website", "Compact website for micro and small businesses.", { targetNeeds: ["service_website"], phase: 0 }],
  ["professional_website", "Professional Website", "Personal brand website for solo professionals.", { supportedBusinessTypes: [...LEGAL_ACCOUNTING, ...PROFESSIONAL, "creator_business"], targetNeeds: ["service_website"], phase: 0 }],
  ["portfolio_website", "Portfolio Website", "Showcase portfolio for creative and professional work.", { supportedBusinessTypes: ["creator_business", "digital_agency", ...PROFESSIONAL], targetNeeds: ["service_website"], phase: 0 }],
  ["clinic_website", "Clinic Website", "Patient-facing website for clinics and medical centers.", { supportedBusinessTypes: CLINICAL, supportedAudienceTypes: CLINICAL_AUDIENCE, targetNeeds: ["corporate_website", "booking"], phase: 0, isRegulatedDomainOnly: true }],
  ["school_website", "School Website", "Public website for schools and training centers.", { supportedBusinessTypes: EDUCATION, supportedAudienceTypes: EDUCATION_AUDIENCE, targetNeeds: ["corporate_website"], phase: 0, isRegulatedDomainOnly: true }],
  ["restaurant_website", "Restaurant Website", "Menu, reservations, and brand presence for restaurants.", { supportedBusinessTypes: RESTAURANT, supportedAudienceTypes: RESTAURANT_AUDIENCE, targetNeeds: ["service_website", "booking"], phase: 0 }],
  ["hotel_website", "Hotel Website", "Booking-focused website for hotels and hospitality.", { supportedBusinessTypes: HOSPITALITY, supportedAudienceTypes: HOSPITALITY_AUDIENCE, targetNeeds: ["service_website", "booking", "hotel_management"], phase: 0 }],
  ["real_estate_website", "Real Estate Website", "Listings and lead capture for real estate agencies.", { supportedBusinessTypes: REAL_ESTATE, supportedAudienceTypes: REAL_ESTATE_AUDIENCE, targetNeeds: ["service_website", "real_estate_management"], phase: 0 }],
  ["construction_company_website", "Construction Company Website", "Project portfolio and inquiry website for builders.", { supportedBusinessTypes: CONSTRUCTION, targetNeeds: ["service_website"], phase: 0 }],
  ["law_firm_website", "Law Firm Website", "Practice-area website with secure contact workflows.", { supportedBusinessTypes: ["law_firm"], supportedAudienceTypes: LEGAL_AUDIENCE, targetNeeds: ["corporate_website"], phase: 0, isRegulatedDomainOnly: true }],
  ["accounting_company_website", "Accounting Company Website", "Services and client intake website for accountants.", { supportedBusinessTypes: ["accounting_office", "consultancy"], supportedAudienceTypes: LEGAL_AUDIENCE, targetNeeds: ["corporate_website"], phase: 0 }],
  ["logistics_website", "Logistics Website", "Shipment tracking and quote request website.", { supportedBusinessTypes: LOGISTICS, targetNeeds: ["service_website"], phase: 0 }],
  ["agriculture_website", "Agriculture Business Website", "Product and farm information website.", { supportedBusinessTypes: AGRICULTURE, targetNeeds: ["service_website"], phase: 0 }],
  ["industrial_company_website", "Industrial Company Website", "Manufacturing and industrial capabilities website.", { supportedBusinessTypes: MANUFACTURING, targetNeeds: ["corporate_website"], phase: 0 }],
  ["tourism_website", "Tourism Website", "Packages and booking website for travel operators.", { supportedBusinessTypes: [...HOSPITALITY, ...TRAVEL], targetNeeds: ["service_website", "booking"], phase: 0 }],
  ["accessible_website", "Accessible Website", "WCAG-oriented accessible website build.", { targetNeeds: ["corporate_website"], phase: 1 }],
  ["high_performance_website", "High-Performance Website", "Performance-optimized website with strict Core Web Vitals targets.", { targetNeeds: ["website_modernization"], phase: 1 }],
  ["website_migration", "Website Migration", "Safe migration from legacy CMS or hosting.", { targetNeeds: ["website_modernization"], phase: 1 }],
  ["website_maintenance", "Website Maintenance", "Ongoing updates, patches, and content support.", { targetNeeds: ["website_modernization"], phase: 1 }],
  ["website_security_hardening", "Website Security Hardening", "Hardens public website against common web threats.", { targetNeeds: ["security_audit", "website_modernization"], phase: 1 }],
  ["product_landing_page", "Product Landing Page", "Landing page focused on a single product offer.", { targetNeeds: ["landing_page"], phase: 0 }],
  ["service_landing_page", "Service Landing Page", "Landing page focused on a service offering.", { targetNeeds: ["landing_page", "service_website"], phase: 0 }],
  ["advertising_landing_page", "Advertising Landing Page", "Paid-traffic landing page with conversion tracking hooks.", { targetNeeds: ["campaign_landing_page", "landing_page"], phase: 1 }],
  ["lead_generation_landing_page", "Lead Generation Landing Page", "Lead capture landing page with form workflows.", { targetNeeds: ["lead_generation", "landing_page"], phase: 1 }],
  ["event_landing_page", "Event Landing Page", "Registration landing page for events and webinars.", { targetNeeds: ["landing_page"], phase: 1 }],
  ["course_landing_page", "Course Landing Page", "Enrollment landing page for courses and training.", { supportedBusinessTypes: EDUCATION, targetNeeds: ["landing_page"], phase: 1 }],
  ["application_launch_page", "Application Launch Page", "Launch page for a new app or SaaS release.", { supportedBusinessTypes: SOFTWARE, targetNeeds: ["landing_page"], phase: 1 }],
  ["partner_portal_build", "Partner Portal", "Portal for partners, resellers, and affiliates.", { targetNeeds: ["supplier_portal"], phase: 3 }],
  ["membership_platform_build", "Membership Platform", "Membership tiers, access control, and billing hooks.", { targetNeeds: ["customer_portal", "subscriptions"], phase: 2 }],
  ["subscription_platform_build", "Subscription Platform", "Recurring subscription product platform.", { supportedBusinessTypes: [...SOFTWARE, ...ECOMMERCE], targetNeeds: ["subscriptions", "saas_platform"], phase: 2 }],
  ["internal_operations_platform", "Internal Operations Platform", "Custom internal ops platform for teams.", { targetNeeds: ["custom_web_application", "employee_portal"], phase: 2, requiresDecisionMakerEvidence: true }],
  ["multi_tenant_platform_build", "Multi-Tenant Platform", "Shared platform architecture for multiple tenants.", { supportedBusinessTypes: SOFTWARE, targetNeeds: ["saas_platform"], phase: 3, requiresDecisionMakerEvidence: true }],
  ["progressive_web_application", "Progressive Web Application", "Installable PWA with offline-capable shell.", { targetNeeds: ["mobile_application"], phase: 2 }],
  ["real_time_web_application", "Real-Time Web Application", "Web app with live updates and websocket workflows.", { targetNeeds: ["custom_web_application"], phase: 2, requiresDecisionMakerEvidence: true }],
  ["document_management_platform", "Document Management Platform", "Document storage, search, and approval workflows.", { targetNeeds: ["document_management"], phase: 2 }],
  ["android_application", "Android Application", "Native Android application.", { targetNeeds: ["mobile_application"], phase: 2 }],
  ["ios_application", "iOS Application", "Native iOS application.", { targetNeeds: ["mobile_application"], phase: 2 }],
  ["cross_platform_mobile_application", "Cross-Platform Mobile Application", "Shared codebase mobile app for iOS and Android.", { targetNeeds: ["mobile_application"], phase: 2 }],
  ["customer_mobile_application", "Customer Mobile Application", "Customer-facing mobile app for orders and account access.", { supportedBusinessTypes: [...ECOMMERCE, ...RESTAURANT], targetNeeds: ["mobile_application"], phase: 2 }],
  ["employee_mobile_application", "Employee Mobile Application", "Staff mobile app for field and internal workflows.", { targetNeeds: ["mobile_application", "employee_portal"], phase: 2 }],
  ["delivery_application", "Delivery Application", "Driver and delivery tracking mobile application.", { supportedBusinessTypes: [...LOGISTICS, ...RESTAURANT, ...ECOMMERCE], targetNeeds: ["mobile_application", "scheduling"], phase: 3 }],
  ["booking_application", "Booking Application", "Mobile booking experience for services.", { targetNeeds: ["booking", "mobile_application"], phase: 2 }],
  ["ecommerce_application", "E-commerce Mobile Application", "Mobile storefront with catalog and checkout.", { supportedBusinessTypes: ECOMMERCE, targetNeeds: ["ecommerce_store", "mobile_application"], phase: 2 }],
  ["field_service_application", "Field Service Application", "Mobile app for technicians and on-site teams.", { supportedBusinessTypes: [...LOGISTICS, "automotive_workshop", ...CONSTRUCTION], targetNeeds: ["mobile_application", "scheduling"], phase: 3 }],
  ["education_application", "Education Mobile Application", "Mobile app for students, parents, or staff.", { supportedBusinessTypes: EDUCATION, targetNeeds: ["mobile_application", "student_management"], phase: 3, isRegulatedDomainOnly: true }],
  ["healthcare_application", "Healthcare Mobile Application", "Patient or clinic mobile workflows.", { supportedBusinessTypes: CLINICAL, supportedAudienceTypes: CLINICAL_AUDIENCE, targetNeeds: ["mobile_application", "patient_management"], phase: 3, isRegulatedDomainOnly: true }],
  ["logistics_application", "Logistics Mobile Application", "Fleet and shipment mobile operations app.", { supportedBusinessTypes: LOGISTICS, targetNeeds: ["mobile_application", "warehouse"], phase: 3 }],
  ["mobile_app_modernization", "Mobile App Modernization", "Rebuild or refactor an outdated mobile application.", { targetNeeds: ["mobile_application", "website_modernization"], phase: 2 }],
  ["online_store", "Online Store", "Standalone e-commerce storefront.", { supportedBusinessTypes: ECOMMERCE, targetNeeds: ["ecommerce_store"], phase: 1 }],
  ["b2b_store", "B2B Store", "Wholesale or account-based online ordering portal.", { supportedBusinessTypes: ["wholesale_business", "manufacturing_company"], targetNeeds: ["ecommerce_store"], phase: 2 }],
  ["b2c_store", "B2C Store", "Consumer-facing online retail store.", { supportedBusinessTypes: ECOMMERCE, targetNeeds: ["ecommerce_store"], phase: 1 }],
  ["multi_vendor_marketplace", "Multi-Vendor Marketplace", "Marketplace with vendor onboarding and commissions.", { supportedBusinessTypes: ["marketplace_business"], targetNeeds: ["marketplace"], phase: 3, requiresDecisionMakerEvidence: true }],
  ["subscription_commerce", "Subscription Commerce", "Subscription-based product or box commerce setup.", { supportedBusinessTypes: ECOMMERCE, targetNeeds: ["subscriptions", "ecommerce_store"], phase: 2 }],
  ["digital_product_store", "Digital Product Store", "Store for downloadable or licensed digital goods.", { supportedBusinessTypes: [...ECOMMERCE, "creator_business"], targetNeeds: ["ecommerce_store"], phase: 2 }],
  ["wholesale_portal", "Wholesale Portal", "B2B ordering portal with tiered pricing.", { supportedBusinessTypes: ["wholesale_business"], targetNeeds: ["ecommerce_store", "customer_portal"], phase: 2 }],
  ["order_management_system", "Order Management System", "Central order intake, fulfillment, and status tracking.", { supportedBusinessTypes: [...ECOMMERCE, ...RESTAURANT], targetNeeds: ["inventory", "reporting"], phase: 2 }],
  ["shipping_integration", "Shipping Integration", "Carrier rate quotes, labels, and tracking integration.", { supportedBusinessTypes: ECOMMERCE, targetNeeds: ["inventory"], phase: 2 }],
  ["inventory_integration", "Inventory Integration", "Syncs stock levels across store and warehouse systems.", { supportedBusinessTypes: ECOMMERCE, targetNeeds: ["inventory"], phase: 2 }],
  ["ecommerce_payment_integration", "E-commerce Payment Integration", "Checkout payment integration for online stores.", { supportedBusinessTypes: ECOMMERCE, targetNeeds: ["online_checkout", "provider_integration"], phase: 1 }],
  ["discount_coupon_system", "Discount Coupon System", "Coupon codes, promotions, and redemption rules.", { supportedBusinessTypes: ECOMMERCE, targetNeeds: ["customer_loyalty"], phase: 2 }],
  ["abandoned_cart_automation", "Abandoned Cart Automation", "Automated recovery flows for abandoned checkout sessions.", { supportedBusinessTypes: ECOMMERCE, targetNeeds: ["email_automation", "lead_follow_up"], phase: 2 }],
  ["ecommerce_analytics_build", "E-commerce Analytics Setup", "Analytics instrumentation for storefront conversion funnels.", { supportedBusinessTypes: ECOMMERCE, targetNeeds: ["analytics"], phase: 2 }],
]);

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

const MANAGE_CRM_ERP_BOOKING: ServiceSeedDefinition[] = svcMany("manage", [
  ["sales_crm", "Sales CRM", "Pipeline and opportunity tracking for sales teams.", { targetNeeds: ["crm"], phase: 1 }],
  ["customer_service_crm", "Customer Service CRM", "Case management and support history for service teams.", { targetNeeds: ["crm", "customer_support_ai"], phase: 1 }],
  ["real_estate_crm", "Real Estate CRM", "Lead, listing, and deal tracking for real estate teams.", { supportedBusinessTypes: REAL_ESTATE, supportedAudienceTypes: REAL_ESTATE_AUDIENCE, targetNeeds: ["crm", "real_estate_management"], phase: 1 }],
  ["medical_crm", "Medical CRM", "Patient communication and follow-up CRM for clinics.", { supportedBusinessTypes: CLINICAL, supportedAudienceTypes: CLINICAL_AUDIENCE, targetNeeds: ["crm", "patient_management"], phase: 2, isRegulatedDomainOnly: true }],
  ["education_crm", "Education CRM", "Enrollment and parent communication CRM.", { supportedBusinessTypes: EDUCATION, supportedAudienceTypes: EDUCATION_AUDIENCE, targetNeeds: ["crm", "student_management"], phase: 2, isRegulatedDomainOnly: true }],
  ["b2b_crm", "B2B CRM", "Account-based CRM for business-to-business sales.", { targetNeeds: ["crm"], phase: 1 }],
  ["lead_management_crm", "Lead Management CRM", "Lead capture, scoring, and routing CRM.", { targetNeeds: ["crm", "lead_qualification"], phase: 1 }],
  ["partner_crm", "Partner CRM", "Partner pipeline and co-selling CRM.", { targetNeeds: ["crm", "supplier_portal"], phase: 2 }],
  ["custom_crm", "Custom CRM", "Tailored CRM workflows for unique sales processes.", { targetNeeds: ["crm", "custom_web_application"], phase: 2, requiresDecisionMakerEvidence: true }],
  ["multi_branch_crm", "Multi-Branch CRM", "Unified CRM visibility across branches.", { supportedBusinessTypes: MULTI_BRANCH_TYPES, targetNeeds: ["crm", "multi_branch_platform"], phase: 3, requiresDecisionMakerEvidence: true }],
  ["small_business_erp", "Small Business ERP", "Lightweight ERP for small operating businesses.", { targetNeeds: ["erp", "reporting"], phase: 2 }],
  ["enterprise_erp", "Enterprise ERP", "Department-spanning ERP for larger organizations.", { supportedBusinessTypes: ["general_business", "marketplace_business", "software_company", "manufacturing_company"], targetNeeds: ["erp"], phase: 3, requiresDecisionMakerEvidence: true }],
  ["retail_erp", "Retail ERP", "Retail operations ERP with store and stock control.", { supportedBusinessTypes: [...ECOMMERCE, "retail_store"], targetNeeds: ["erp", "inventory"], phase: 2 }],
  ["manufacturing_erp", "Manufacturing ERP", "Production, BOM, and shop-floor ERP.", { supportedBusinessTypes: MANUFACTURING, targetNeeds: ["erp", "inventory"], phase: 3, requiresDecisionMakerEvidence: true }],
  ["construction_erp", "Construction ERP", "Project, subcontractor, and materials ERP.", { supportedBusinessTypes: CONSTRUCTION, targetNeeds: ["erp", "inventory"], phase: 3, requiresDecisionMakerEvidence: true }],
  ["logistics_erp", "Logistics ERP", "Fleet, routing, and shipment ERP.", { supportedBusinessTypes: LOGISTICS, targetNeeds: ["erp", "warehouse"], phase: 3 }],
  ["education_erp", "Education ERP", "Institution-wide ERP for schools and universities.", { supportedBusinessTypes: EDUCATION, supportedAudienceTypes: EDUCATION_AUDIENCE, targetNeeds: ["erp", "student_management"], phase: 3, isRegulatedDomainOnly: true }],
  ["healthcare_erp", "Healthcare ERP", "Clinical and administrative ERP for healthcare providers.", { supportedBusinessTypes: CLINICAL, supportedAudienceTypes: CLINICAL_AUDIENCE, targetNeeds: ["erp", "patient_management"], phase: 3, isRegulatedDomainOnly: true }],
  ["hospitality_erp", "Hospitality ERP", "Property, reservations, and F&B ERP for hospitality.", { supportedBusinessTypes: HOSPITALITY, supportedAudienceTypes: HOSPITALITY_AUDIENCE, targetNeeds: ["erp", "hotel_management"], phase: 3 }],
  ["custom_erp", "Custom ERP", "Bespoke ERP aligned to unique operational workflows.", { targetNeeds: ["erp", "custom_web_application"], phase: 3, requiresDecisionMakerEvidence: true }],
  ["appointment_booking", "Appointment Booking", "Appointment scheduling for service businesses.", { targetNeeds: ["booking", "scheduling"], phase: 1 }],
  ["medical_appointment_booking", "Medical Appointment Booking", "Clinical appointment booking with reminders.", { supportedBusinessTypes: CLINICAL, supportedAudienceTypes: CLINICAL_AUDIENCE, targetNeeds: ["booking", "patient_management"], phase: 1, isRegulatedDomainOnly: true }],
  ["salon_booking", "Salon Booking", "Stylist and service booking for salons.", { supportedBusinessTypes: SALON_GYM, targetNeeds: ["booking", "scheduling"], phase: 1 }],
  ["restaurant_reservation", "Restaurant Reservation", "Table reservation and waitlist management.", { supportedBusinessTypes: RESTAURANT, supportedAudienceTypes: RESTAURANT_AUDIENCE, targetNeeds: ["booking", "restaurant_management"], phase: 1 }],
  ["hotel_booking", "Hotel Booking", "Room reservation and availability management.", { supportedBusinessTypes: HOSPITALITY, supportedAudienceTypes: HOSPITALITY_AUDIENCE, targetNeeds: ["booking", "hotel_management"], phase: 1 }],
  ["class_scheduling", "Class Scheduling", "Class and session scheduling for education and training.", { supportedBusinessTypes: EDUCATION, targetNeeds: ["scheduling", "student_management"], phase: 1 }],
  ["staff_scheduling", "Staff Scheduling", "Shift and staff roster scheduling.", { targetNeeds: ["scheduling", "employee_management"], phase: 1 }],
  ["resource_scheduling", "Resource Scheduling", "Room, equipment, and resource scheduling.", { targetNeeds: ["scheduling"], phase: 1 }],
  ["multi_location_booking", "Multi-Location Booking", "Booking across multiple branches or sites.", { supportedBusinessTypes: MULTI_BRANCH_TYPES, targetNeeds: ["booking", "multi_branch_platform"], phase: 2 }],
  ["multi_warehouse_management", "Multi-Warehouse Management", "Stock control across multiple warehouses.", { supportedBusinessTypes: [...LOGISTICS, ...ECOMMERCE, "wholesale_business"], targetNeeds: ["warehouse", "inventory"], phase: 2 }],
  ["medical_inventory", "Medical Inventory", "Clinical consumables and supply inventory tracking.", { supportedBusinessTypes: CLINICAL, targetNeeds: ["inventory", "patient_management"], phase: 2, isRegulatedDomainOnly: true }],
  ["restaurant_inventory", "Restaurant Inventory", "Ingredient and kitchen inventory management.", { supportedBusinessTypes: RESTAURANT, targetNeeds: ["inventory", "restaurant_management"], phase: 1 }],
  ["retail_inventory", "Retail Inventory", "Store-level stock and replenishment management.", { supportedBusinessTypes: [...ECOMMERCE, "retail_store"], targetNeeds: ["inventory"], phase: 1 }],
  ["construction_material_inventory", "Construction Material Inventory", "Materials tracking for construction projects.", { supportedBusinessTypes: CONSTRUCTION, targetNeeds: ["inventory"], phase: 2 }],
  ["serial_batch_tracking", "Serial and Batch Tracking", "Serial numbers and batch traceability for stock.", { supportedBusinessTypes: [...MANUFACTURING, "pharmacy"], targetNeeds: ["inventory", "warehouse"], phase: 2 }],
  ["purchase_supplier_management", "Purchase and Supplier Management", "Purchase orders and supplier coordination.", { targetNeeds: ["inventory", "supplier_portal"], phase: 2 }],
  ["invoice_management", "Invoice Management", "Invoice lifecycle management beyond basic invoicing.", { targetNeeds: ["invoices", "invoices_payments"], phase: 1 }],
  ["revenue_tracking", "Revenue Tracking", "Revenue summaries and trend tracking.", { targetNeeds: ["reporting", "analytics"], phase: 1 }],
  ["cash_flow_dashboard", "Cash Flow Dashboard", "Cash inflow and outflow visibility dashboard.", { targetNeeds: ["reporting", "analytics"], phase: 2 }],
  ["payment_tracking", "Payment Tracking", "Tracks incoming payments against orders and invoices.", { targetNeeds: ["payment_tracking", "invoices_payments"], phase: 1 }],
  ["subscription_management", "Subscription Management", "Subscription plans, renewals, and billing status.", { targetNeeds: ["subscriptions", "recurring_payments"], phase: 2 }],
  ["quote_proposal_management", "Quote and Proposal Management", "Quotes, proposals, and approval workflows.", { targetNeeds: ["invoices", "crm"], phase: 2 }],
  ["purchase_order_management", "Purchase Order Management", "PO creation, approval, and fulfillment tracking.", { targetNeeds: ["inventory", "expenses"], phase: 2 }],
  ["branch_financial_dashboards", "Branch Financial Dashboards", "Financial rollups per branch for multi-site operators.", { supportedBusinessTypes: MULTI_BRANCH_TYPES, targetNeeds: ["reporting", "multi_branch_platform"], phase: 3, requiresDecisionMakerEvidence: true }],
  ["recruitment_workflow", "Recruitment Workflow", "Hiring pipeline and candidate tracking.", { targetNeeds: ["employee_management"], phase: 2 }],
  ["leave_management", "Leave Management", "Leave requests, balances, and approvals.", { targetNeeds: ["employee_management", "attendance"], phase: 2 }],
  ["employee_documents", "Employee Documents", "Secure storage for HR documents and contracts.", { targetNeeds: ["document_management", "employee_management"], phase: 2 }],
  ["performance_management", "Performance Management", "Goals, reviews, and performance tracking.", { targetNeeds: ["employee_management", "reporting"], phase: 2 }],
  ["shift_management", "Shift Management", "Shift planning and swap workflows.", { targetNeeds: ["attendance", "scheduling"], phase: 2 }],
  ["staff_portal", "Staff Portal", "Self-service portal for staff schedules and documents.", { targetNeeds: ["employee_portal", "employee_management"], phase: 2 }],
  ["hr_analytics", "HR Analytics", "Workforce and attendance analytics.", { targetNeeds: ["analytics", "employee_management"], phase: 2 }],
  ["general_clinic_management_system", "General Clinic Management System", "Operations platform for general medical clinics.", { supportedBusinessTypes: ["general_clinic", "medical_center"], supportedAudienceTypes: CLINICAL_AUDIENCE, targetNeeds: ["patient_management", "booking"], phase: 2, isRegulatedDomainOnly: true }],
  ["medical_center_management_system", "Medical Center Management System", "Multi-department management for medical centers.", { supportedBusinessTypes: ["medical_center", "hospital"], supportedAudienceTypes: CLINICAL_AUDIENCE, targetNeeds: ["patient_management", "erp"], phase: 3, isRegulatedDomainOnly: true }],
  ["kindergarten_management_system", "Kindergarten Management System", "Enrollment and parent communication for kindergartens.", { supportedBusinessTypes: ["kindergarten"], supportedAudienceTypes: EDUCATION_AUDIENCE, targetNeeds: ["student_management", "attendance"], phase: 2, isRegulatedDomainOnly: true }],
  ["training_center_management_system", "Training Center Management System", "Courses, enrollment, and scheduling for training centers.", { supportedBusinessTypes: ["training_center"], supportedAudienceTypes: EDUCATION_AUDIENCE, targetNeeds: ["student_management", "scheduling"], phase: 2 }],
  ["university_management_system", "University Management System", "Faculty, student, and campus operations platform.", { supportedBusinessTypes: ["university"], supportedAudienceTypes: EDUCATION_AUDIENCE, targetNeeds: ["student_management", "erp"], phase: 3, isRegulatedDomainOnly: true }],
  ["coffee_shop_management_system", "Coffee Shop Management System", "Orders, inventory, and staff workflows for coffee shops.", { supportedBusinessTypes: ["coffee_shop"], supportedAudienceTypes: RESTAURANT_AUDIENCE, targetNeeds: ["restaurant_management", "inventory"], phase: 1 }],
  ["property_management_system", "Property Management System", "Leases, tenants, and maintenance for property managers.", { supportedBusinessTypes: ["property_management", "real_estate_agency"], supportedAudienceTypes: REAL_ESTATE_AUDIENCE, targetNeeds: ["real_estate_management"], phase: 2 }],
  ["construction_management_system", "Construction Management System", "Projects, subcontractors, and site reporting.", { supportedBusinessTypes: CONSTRUCTION, targetNeeds: ["erp", "reporting"], phase: 2 }],
  ["logistics_management_system", "Logistics Management System", "Shipments, routes, and carrier coordination.", { supportedBusinessTypes: LOGISTICS, targetNeeds: ["warehouse", "erp"], phase: 2 }],
  ["fleet_management_system", "Fleet Management System", "Vehicle fleet tracking and maintenance.", { supportedBusinessTypes: ["fleet_operator", "logistics_company"], targetNeeds: ["warehouse", "scheduling"], phase: 2 }],
  ["car_rental_management_system", "Car Rental Management System", "Reservations, fleet, and contracts for car rental.", { supportedBusinessTypes: ["car_rental"], targetNeeds: ["booking", "inventory"], phase: 2 }],
  ["automotive_workshop_system", "Automotive Workshop System", "Work orders, parts, and service history for workshops.", { supportedBusinessTypes: ["automotive_workshop"], targetNeeds: ["scheduling", "inventory"], phase: 2 }],
  ["salon_management_system", "Salon Management System", "Appointments, staff, and retail for salons.", { supportedBusinessTypes: SALON_GYM, targetNeeds: ["booking", "employee_management"], phase: 1 }],
  ["gym_management_system", "Gym Management System", "Memberships, classes, and access control for gyms.", { supportedBusinessTypes: ["gym"], targetNeeds: ["booking", "customer_loyalty"], phase: 1 }],
  ["law_firm_management_system", "Law Firm Management System", "Matters, billing, and document workflows for law firms.", { supportedBusinessTypes: ["law_firm"], supportedAudienceTypes: LEGAL_AUDIENCE, targetNeeds: ["document_management", "crm"], phase: 2, isRegulatedDomainOnly: true }],
  ["accounting_office_system", "Accounting Office System", "Client engagements, tasks, and document workflows.", { supportedBusinessTypes: ["accounting_office"], supportedAudienceTypes: LEGAL_AUDIENCE, targetNeeds: ["accounting_interface", "document_management"], phase: 2 }],
  ["travel_agency_system", "Travel Agency System", "Packages, bookings, and supplier coordination.", { supportedBusinessTypes: TRAVEL, targetNeeds: ["booking", "crm"], phase: 2 }],
  ["agriculture_management_system", "Agriculture Management System", "Crop, inventory, and field operations tracking.", { supportedBusinessTypes: AGRICULTURE, targetNeeds: ["inventory", "reporting"], phase: 2 }],
  ["retail_management_system", "Retail Management System", "POS, stock, and store operations platform.", { supportedBusinessTypes: ["retail_store", "wholesale_business"], targetNeeds: ["inventory", "erp"], phase: 2 }],
  ["multi_branch_management_system", "Multi-Branch Management System", "Centralized control for multi-branch operators.", { supportedBusinessTypes: MULTI_BRANCH_TYPES, targetNeeds: ["multi_branch_platform", "reporting"], phase: 3, requiresDecisionMakerEvidence: true }],
]);

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

const AI_EXTENDED_SERVICES: ServiceSeedDefinition[] = svcMany("artificial_intelligence", [
  ["internal_company_assistant", "Internal Company Assistant", "AI assistant for internal policies and procedures.", { targetNeeds: ["internal_knowledge_assistant"], phase: 2 }],
  ["hr_assistant", "HR Assistant", "AI assistant for HR policies and employee questions.", { targetNeeds: ["internal_knowledge_assistant", "employee_management"], phase: 2 }],
  ["medical_administration_assistant", "Medical Administration Assistant", "AI assistant for non-clinical admin workflows in healthcare.", { supportedBusinessTypes: CLINICAL, supportedAudienceTypes: CLINICAL_AUDIENCE, targetNeeds: ["patient_management", "document_analysis"], phase: 3, isRegulatedDomainOnly: true }],
  ["education_assistant", "Education Assistant", "AI assistant for school administration and communication.", { supportedBusinessTypes: EDUCATION, supportedAudienceTypes: EDUCATION_AUDIENCE, targetNeeds: ["student_management", "content_assistance"], phase: 2, isRegulatedDomainOnly: true }],
  ["post_analysis_ai", "Post Analysis AI", "Analyzes social posts and marketing content for business signals.", { targetNeeds: ["business_analysis", "content_assistance"], phase: 2 }],
  ["business_classification_ai", "Business Classification AI", "Assists classification of business type and industry signals.", { targetNeeds: ["business_analysis"], phase: 2 }],
  ["audience_analysis_ai", "Audience Analysis AI", "Assists classification of audience and buyer context.", { targetNeeds: ["business_analysis", "lead_qualification"], phase: 2 }],
  ["service_recommendation_ai", "Service Recommendation AI", "Explains and summarizes deterministic service matches.", { targetNeeds: ["business_analysis"], phase: 2 }],
  ["content_generation_ai", "Content Generation AI", "Drafts marketing and operational content with review gates.", { targetNeeds: ["content_assistance"], phase: 2 }],
  ["translation_assistant", "Translation Assistant", "Assists multilingual translation with human review.", { targetNeeds: ["multilingual_content", "content_assistance"], phase: 2 }],
  ["summarization_assistant", "Summarization Assistant", "Summarizes long documents and meeting notes.", { targetNeeds: ["document_analysis"], phase: 2 }],
  ["knowledge_base_assistant", "Knowledge Base Assistant", "Answers questions from curated knowledge bases.", { targetNeeds: ["internal_knowledge_assistant"], phase: 2 }],
  ["search_retrieval_assistant", "Search and Retrieval Assistant", "Semantic search over business documents.", { targetNeeds: ["internal_knowledge_assistant", "document_management"], phase: 2 }],
  ["campaign_intelligence_ai", "Campaign Intelligence AI", "Analyzes campaign performance signals for planning.", { targetNeeds: ["business_analysis", "advertising_strategy"], phase: 3 }],
  ["social_content_ai", "Social Content AI", "Drafts social content variants for human review.", { targetNeeds: ["content_assistance", "social_media_strategy"], phase: 2 }],
  ["reporting_insight_ai", "Reporting Insight AI", "Generates narrative insights from operational reports.", { targetNeeds: ["reporting", "analytics"], phase: 2 }],
  ["forecasting_interface", "Forecasting Interface", "Interface for demand and revenue forecasting models.", { targetNeeds: ["forecasting", "analytics"], phase: 3 }],
  ["custom_multimodal_ai", "Custom Multimodal AI", "Custom AI combining text, image, and document inputs.", { targetNeeds: ["custom_ai_assistant", "image_analysis"], phase: 3, requiresDecisionMakerEvidence: true }],
  ["local_private_ai_planning", "Local Private AI Planning", "Architecture planning for private/on-prem AI deployments.", { targetNeeds: ["custom_ai_assistant", "business_analysis"], phase: 3, requiresDecisionMakerEvidence: true }],
  ["ai_provider_integration", "AI Provider Integration", "Integrates external AI providers into business workflows.", { supportedBusinessTypes: SOFTWARE, targetNeeds: ["custom_ai_assistant"], phase: 2 }],
  ["ai_api_integration", "AI API Integration", "Exposes AI capabilities through secured internal APIs.", { supportedBusinessTypes: SOFTWARE, targetNeeds: ["custom_ai_assistant", "api_security"], phase: 2 }],
  ["ai_governance_review_interface", "AI Governance Review Interface", "Review interface for AI outputs, policies, and approvals.", { targetNeeds: ["business_analysis", "audit_logs"], phase: 3, requiresDecisionMakerEvidence: true }],
]);

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

const AUTOMATION_EXTENDED_SERVICES: ServiceSeedDefinition[] = svcMany("automation", [
  ["whatsapp_reminders", "WhatsApp Reminders", "Automated WhatsApp appointment and payment reminders.", { targetNeeds: ["whatsapp_automation", "payment_reminders"], phase: 1 }],
  ["whatsapp_lead_follow_up", "WhatsApp Lead Follow-up", "Automated WhatsApp sequences for inbound leads.", { targetNeeds: ["whatsapp_automation", "lead_follow_up"], phase: 1 }],
  ["whatsapp_appointment_confirmation", "WhatsApp Appointment Confirmation", "Confirms appointments through WhatsApp.", { targetNeeds: ["whatsapp_automation", "booking_automation"], phase: 1 }],
  ["whatsapp_order_notification", "WhatsApp Order Notification", "Order status updates through WhatsApp.", { supportedBusinessTypes: [...RESTAURANT, ...ECOMMERCE], targetNeeds: ["whatsapp_automation", "notifications"], phase: 1 }],
  ["email_campaign_workflow", "Email Campaign Workflow", "Multi-step email campaign automation.", { targetNeeds: ["email_automation", "lead_generation"], phase: 1 }],
  ["sms_integration", "SMS Integration", "SMS provider integration for notifications.", { targetNeeds: ["sms_automation"], phase: 1 }],
  ["telegram_bot_integration", "Telegram Bot Integration", "Telegram bot integration for notifications and commands.", { targetNeeds: ["telegram_automation"], phase: 1 }],
  ["telegram_notification_workflow", "Telegram Notification Workflow", "Automated Telegram alerts for business events.", { targetNeeds: ["telegram_automation", "notifications"], phase: 1 }],
  ["lead_routing_automation", "Lead Routing Automation", "Routes leads to owners based on rules.", { targetNeeds: ["lead_follow_up", "crm"], phase: 1 }],
  ["sales_follow_up_automation", "Sales Follow-up Automation", "Automated sales cadences and task creation.", { targetNeeds: ["lead_follow_up", "sales_ai"], phase: 1 }],
  ["customer_onboarding_automation", "Customer Onboarding Automation", "Automated onboarding for new customers.", { targetNeeds: ["onboarding_automation"], phase: 2 }],
  ["support_ticket_automation", "Support Ticket Automation", "Ticket triage and escalation automation.", { targetNeeds: ["customer_support_ai", "notifications"], phase: 2 }],
  ["data_synchronization", "Data Synchronization", "Keeps connected systems synchronized on a schedule.", { targetNeeds: ["data_sync"], phase: 2 }],
  ["spreadsheet_automation", "Spreadsheet Automation", "Automates repetitive spreadsheet updates.", { targetNeeds: ["data_sync", "scheduled_reports"], phase: 2 }],
  ["report_generation_automation", "Report Generation Automation", "Generates and distributes recurring reports.", { targetNeeds: ["scheduled_reports", "reporting"], phase: 1 }],
  ["api_workflow_automation", "API Workflow Automation", "Orchestrates workflows across HTTP APIs.", { targetNeeds: ["custom_workflow", "data_sync"], phase: 2 }],
  ["webhook_automation", "Webhook Automation", "Receives and routes webhook events to workflows.", { targetNeeds: ["custom_workflow"], phase: 2 }],
  ["multi_system_integration", "Multi-System Integration", "Connects multiple SaaS and internal systems.", { targetNeeds: ["data_sync", "custom_workflow"], phase: 2 }],
  ["scheduled_tasks", "Scheduled Tasks", "Cron-style scheduled business tasks.", { targetNeeds: ["scheduled_reports", "notifications"], phase: 1 }],
  ["notification_systems", "Notification Systems", "Central notification routing across channels.", { targetNeeds: ["notifications"], phase: 1 }],
]);

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

const PAYMENT_PROVIDER_SERVICES: ServiceSeedDefinition[] = asPaymentServices(
  svcMany("payments", [
    ["card_payment_integration", "Card Payment Integration", "Card checkout through a licensed payment provider.", { targetNeeds: ["online_checkout", "provider_integration"], phase: 1 }],
    ["payment_reference_generation", "Payment Reference Generation", "Structured payment reference codes for bank transfers.", { targetNeeds: ["bank_transfer_workflow"], phase: 1 }],
    ["payment_confirmation_workflow", "Payment Confirmation Workflow", "Workflow to confirm and reconcile incoming payments.", { targetNeeds: ["payment_confirmation"], phase: 1 }],
    ["refund_workflow", "Refund Workflow", "Refund request, approval, and provider execution workflow.", { targetNeeds: ["refunds"], phase: 2 }],
    ["marketplace_payment_workflow", "Marketplace Payment Workflow", "Split payments and vendor payout workflow.", { supportedBusinessTypes: ["marketplace_business"], targetNeeds: ["marketplace_payments"], phase: 3 }],
    ["split_payment_integration", "Split Payment Integration", "Split payment routing through a licensed provider.", { targetNeeds: ["marketplace_payments", "provider_integration"], phase: 3 }],
    ["payout_workflow_integration", "Payout Workflow Integration", "Vendor and partner payout workflow integration.", { targetNeeds: ["marketplace_payments"], phase: 3 }],
    ["payment_reconciliation", "Payment Reconciliation", "Reconciles provider settlements with internal records.", { targetNeeds: ["reconciliation"], phase: 2 }],
    ["payment_webhook_integration", "Payment Webhook Integration", "Secure webhook handling for payment provider events.", { targetNeeds: ["provider_integration"], phase: 1 }],
    ["fraud_monitoring_provider_integration", "Fraud Monitoring Provider Integration", "Integrates licensed fraud monitoring signals at checkout.", { targetNeeds: ["provider_integration", "security_audit"], phase: 2 }],
    ["stripe_integration", "Stripe Integration", "Technical integration with Stripe as a licensed provider.", { targetNeeds: ["provider_integration", "online_checkout"], phase: 1 }],
    ["paypal_integration", "PayPal Integration", "Technical integration with PayPal as a licensed provider.", { targetNeeds: ["provider_integration", "online_checkout"], phase: 1 }],
    ["adyen_integration", "Adyen Integration", "Technical integration with Adyen as a licensed provider.", { targetNeeds: ["provider_integration"], phase: 2 }],
    ["checkout_com_integration", "Checkout.com Integration", "Technical integration with Checkout.com as a licensed provider.", { targetNeeds: ["provider_integration"], phase: 2 }],
    ["paddle_integration", "Paddle Integration", "Technical integration with Paddle as a licensed provider.", { targetNeeds: ["provider_integration", "subscriptions"], phase: 2 }],
    ["mollie_integration", "Mollie Integration", "Technical integration with Mollie as a licensed provider.", { targetNeeds: ["provider_integration"], phase: 2 }],
    ["local_payment_gateway_integration", "Local Payment Gateway Integration", "Integration with a country-specific licensed gateway.", { targetNeeds: ["provider_integration", "multi_currency_interface"], phase: 2 }],
    ["custom_payment_api_integration", "Custom Payment API Integration", "Custom integration to a licensed provider API.", { targetNeeds: ["provider_integration"], phase: 2 }],
    ["payment_provider_selection", "Payment Provider Selection", "Independent guidance on selecting a licensed payment provider.", { targetNeeds: ["merchant_onboarding_support", "provider_integration"], phase: 0, requiresDecisionMakerEvidence: true }],
    ["documentation_checklist_guidance", "Documentation Checklist Guidance", "Checklist guidance for provider onboarding documentation.", { targetNeeds: ["merchant_onboarding_support"], phase: 0 }],
    ["business_account_application_guidance", "Business Account Application Guidance", "Guidance preparing a lawful merchant account application.", { targetNeeds: ["merchant_onboarding_support"], phase: 0, requiresDecisionMakerEvidence: true }],
    ["financial_operations_dashboard", "Financial Operations Dashboard", "Dashboard for payouts, fees, and settlement visibility.", { targetNeeds: ["transaction_dashboard", "reconciliation"], phase: 2 }],
  ]),
);

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

const CYBERSECURITY_EXTENDED_SERVICES: ServiceSeedDefinition[] = svcMany("cybersecurity", [
  ["cybersecurity_consultation", "Cybersecurity Consultation", "Advisory review of security posture and priorities.", { targetNeeds: ["security_audit"], phase: 0 }],
  ["security_architecture", "Security Architecture", "Designs security architecture for applications and data.", { targetNeeds: ["security_audit", "cloud_security"], phase: 1, requiresDecisionMakerEvidence: true }],
  ["web_application_security_review", "Web Application Security Review", "Reviews web apps for common vulnerabilities.", { targetNeeds: ["security_audit", "api_security"], phase: 1 }],
  ["mobile_application_security_review", "Mobile Application Security Review", "Reviews mobile apps for security risks.", { targetNeeds: ["security_audit"], phase: 1 }],
  ["api_security_review", "API Security Review", "Reviews API authentication and authorization design.", { targetNeeds: ["api_security"], phase: 1 }],
  ["multi_factor_authentication", "Multi-Factor Authentication", "Implements MFA for admin and user accounts.", { targetNeeds: ["authentication_hardening"], phase: 1 }],
  ["role_based_access_control", "Role-Based Access Control", "Implements RBAC across business systems.", { targetNeeds: ["access_control"], phase: 1 }],
  ["session_security_review", "Session Security Review", "Reviews session cookies, timeouts, and fixation risks.", { targetNeeds: ["authentication_hardening"], phase: 1 }],
  ["password_policy_implementation", "Password Policy Implementation", "Enforces password complexity and rotation policies.", { targetNeeds: ["authentication_hardening"], phase: 1 }],
  ["rate_limiting", "Rate Limiting", "Protects public endpoints with rate limits.", { targetNeeds: ["api_security"], phase: 1 }],
  ["abuse_protection", "Abuse Protection", "Bot and abuse detection for public forms and APIs.", { targetNeeds: ["api_security", "monitoring"], phase: 1 }],
  ["secure_media_storage", "Secure Media Storage", "Secures uploaded media storage and access URLs.", { targetNeeds: ["secure_file_uploads", "object_storage"], phase: 1 }],
  ["database_security_review", "Database Security Review", "Reviews database access, encryption, and backups.", { targetNeeds: ["cloud_security", "backup"], phase: 1 }],
  ["business_continuity_planning", "Business Continuity Planning", "Plans for continuity during outages and incidents.", { targetNeeds: ["disaster_recovery"], phase: 2, requiresDecisionMakerEvidence: true }],
  ["vulnerability_management_workflow", "Vulnerability Management Workflow", "Tracks remediation of discovered vulnerabilities.", { targetNeeds: ["monitoring", "security_audit"], phase: 2 }],
  ["secure_deployment_planning", "Secure Deployment Planning", "Plans secure CI/CD and release practices.", { targetNeeds: ["ci_cd", "infrastructure_hardening"], phase: 1 }],
  ["incident_response_planning", "Incident Response Planning", "Runbooks and roles for security incidents.", { targetNeeds: ["monitoring", "disaster_recovery"], phase: 2 }],
  ["data_retention_controls", "Data Retention Controls", "Retention and deletion policies for business data.", { targetNeeds: ["privacy_design", "audit_logs"], phase: 2 }],
  ["multi_branch_data_isolation", "Multi-Branch Data Isolation", "Isolates branch data with centralized governance.", { supportedBusinessTypes: MULTI_BRANCH_TYPES, targetNeeds: ["multi_branch_isolation", "access_control"], phase: 3 }],
  ["security_maintenance_plan", "Security Maintenance Plan", "Ongoing patching and security maintenance plan.", { targetNeeds: ["infrastructure_hardening", "monitoring"], phase: 1 }],
]);

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

const CLOUD_EXTENDED_SERVICES: ServiceSeedDefinition[] = svcMany("cloud_infrastructure", [
  ["cloud_migration", "Cloud Migration", "Plans and executes migration to cloud infrastructure.", { targetNeeds: ["cloud_architecture", "deployment"], phase: 2, requiresDecisionMakerEvidence: true }],
  ["docker_infrastructure", "Docker Infrastructure", "Docker-based deployment infrastructure.", { targetNeeds: ["containerization", "deployment"], phase: 1 }],
  ["multi_environment_setup", "Multi-Environment Setup", "Development, staging, and production environment separation.", { targetNeeds: ["staging_environment", "production_environment"], phase: 0 }],
  ["development_environment", "Development Environment", "Shared development environment for teams.", { targetNeeds: ["staging_environment"], phase: 0 }],
  ["media_storage", "Media Storage", "Scalable storage for business media assets.", { targetNeeds: ["object_storage"], phase: 1 }],
  ["queue_architecture", "Queue Architecture", "Design for background jobs and async workflows.", { targetNeeds: ["queues"], phase: 2 }],
  ["cdn_configuration", "CDN Configuration", "CDN setup for static assets and media.", { targetNeeds: ["cdn"], phase: 1 }],
  ["domain_configuration", "Domain Configuration", "Domain registration and routing configuration.", { targetNeeds: ["dns"], phase: 0 }],
  ["dns_configuration", "DNS Configuration", "DNS records and health checks.", { targetNeeds: ["dns"], phase: 0 }],
  ["email_infrastructure", "Email Infrastructure", "Transactional email DNS and provider setup.", { targetNeeds: ["email_automation"], phase: 1 }],
  ["infrastructure_monitoring", "Infrastructure Monitoring", "Monitors servers, containers, and uptime.", { targetNeeds: ["logging", "high_availability"], phase: 1 }],
  ["alerting", "Alerting", "Alert routing for infrastructure and application incidents.", { targetNeeds: ["logging"], phase: 1 }],
  ["backup_automation", "Backup Automation", "Automated backups with retention policies.", { targetNeeds: ["backup"], phase: 1 }],
  ["recovery_testing", "Recovery Testing", "Periodic restore tests for backups.", { targetNeeds: ["backup", "disaster_recovery"], phase: 2 }],
  ["performance_optimization", "Performance Optimization", "Optimizes application and infrastructure performance.", { targetNeeds: ["scalability"], phase: 2 }],
  ["high_availability_planning", "High-Availability Planning", "Plans redundant architecture for critical workloads.", { targetNeeds: ["high_availability"], phase: 3 }],
  ["infrastructure_documentation", "Infrastructure Documentation", "Runbooks and architecture documentation.", { targetNeeds: ["cloud_architecture"], phase: 1 }],
  ["devops_workflow", "DevOps Workflow", "Collaborative build and release workflow design.", { targetNeeds: ["ci_cd"], phase: 1 }],
  ["ci_cd_planning", "CI/CD Planning", "Plans automated build, test, and deploy pipelines.", { targetNeeds: ["ci_cd"], phase: 1 }],
]);

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

const ANALYTICS_EXTENDED_SERVICES: ServiceSeedDefinition[] = svcMany("data_analytics", [
  ["business_dashboard", "Business Dashboard", "Executive summary dashboard for daily operations.", { targetNeeds: ["analytics", "reporting"], phase: 1 }],
  ["executive_dashboard", "Executive Dashboard", "High-level KPI dashboard for leadership.", { targetNeeds: ["analytics", "reporting"], phase: 2, requiresDecisionMakerEvidence: true }],
  ["marketing_analytics", "Marketing Analytics", "Campaign and channel performance analytics.", { targetNeeds: ["analytics", "advertising_strategy"], phase: 2 }],
  ["financial_analytics_interface", "Financial Analytics Interface", "Financial KPIs and trend analytics interface.", { targetNeeds: ["analytics", "reporting"], phase: 2 }],
  ["inventory_analytics", "Inventory Analytics", "Stock movement and shrink analytics.", { supportedBusinessTypes: [...ECOMMERCE, "retail_store", "pharmacy"], targetNeeds: ["analytics", "inventory"], phase: 2 }],
  ["employee_analytics", "Employee Analytics", "Workforce productivity and attendance analytics.", { targetNeeds: ["analytics", "employee_management"], phase: 2 }],
  ["branch_comparison", "Branch Comparison Analytics", "Compares branch performance side by side.", { supportedBusinessTypes: MULTI_BRANCH_TYPES, targetNeeds: ["analytics", "multi_branch_platform"], phase: 3 }],
  ["campaign_analytics", "Campaign Analytics", "Tracks campaign reach and conversion metrics.", { targetNeeds: ["analytics", "lead_generation"], phase: 2 }],
  ["lead_funnel", "Lead Funnel Analytics", "Visualizes lead stages and drop-off.", { targetNeeds: ["analytics", "lead_generation"], phase: 2 }],
  ["conversion_analytics", "Conversion Analytics", "Conversion rate analysis across funnels.", { targetNeeds: ["analytics"], phase: 2 }],
  ["website_analytics", "Website Analytics", "Traffic and behavior analytics for websites.", { targetNeeds: ["analytics", "seo"], phase: 1 }],
  ["ecommerce_analytics", "E-commerce Analytics", "Store conversion, AOV, and product analytics.", { supportedBusinessTypes: ECOMMERCE, targetNeeds: ["analytics"], phase: 2 }],
  ["operational_reporting", "Operational Reporting", "Operational reports for day-to-day teams.", { targetNeeds: ["reporting"], phase: 1 }],
  ["custom_report_builder", "Custom Report Builder", "Self-service report builder for business users.", { targetNeeds: ["reporting", "analytics"], phase: 2 }],
  ["kpi_definition", "KPI Definition", "Workshops to define measurable KPIs.", { targetNeeds: ["analytics", "business_analysis"], phase: 0 }],
  ["data_integration", "Data Integration", "Connects data sources for unified reporting.", { targetNeeds: ["analytics", "data_sync"], phase: 2 }],
  ["data_cleaning_workflow", "Data Cleaning Workflow", "Standardizes and cleans imported business data.", { targetNeeds: ["analytics"], phase: 2 }],
  ["multi_source_reporting", "Multi-Source Reporting", "Reports spanning CRM, finance, and ops systems.", { targetNeeds: ["reporting", "analytics"], phase: 2 }],
  ["real_time_dashboard", "Real-Time Dashboard", "Live operational dashboard with streaming metrics.", { targetNeeds: ["analytics"], phase: 3 }],
  ["custom_analytics_platform", "Custom Analytics Platform", "Tailored analytics platform for unique metrics.", { targetNeeds: ["analytics", "custom_web_application"], phase: 3, requiresDecisionMakerEvidence: true }],
]);

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

const GROWTH_EXTENDED_SERVICES: ServiceSeedDefinition[] = svcMany("growth_marketing_media", [
  ["campaign_planning", "Campaign Planning", "Structured planning for marketing campaigns.", { targetNeeds: ["advertising_strategy", "content_calendar"], phase: 1 }],
  ["facebook_campaign_package", "Facebook Campaign Package", "Creative and setup package for Facebook campaigns.", { targetNeeds: ["advertising_strategy"], phase: 1 }],
  ["instagram_campaign_package", "Instagram Campaign Package", "Creative and setup package for Instagram campaigns.", { targetNeeds: ["advertising_strategy"], phase: 1 }],
  ["linkedin_campaign_package", "LinkedIn Campaign Package", "B2B campaign package for LinkedIn.", { targetNeeds: ["advertising_strategy", "lead_generation"], phase: 1 }],
  ["tiktok_campaign_package", "TikTok Campaign Package", "Short-video campaign package for TikTok.", { targetNeeds: ["advertising_strategy", "social_short_video"], phase: 1 }],
  ["youtube_campaign_package", "YouTube Campaign Package", "Video campaign package for YouTube.", { targetNeeds: ["advertising_strategy", "video_production"], phase: 1 }],
  ["telegram_campaign_package", "Telegram Campaign Package", "Campaign package for Telegram channels.", { targetNeeds: ["advertising_strategy", "telegram_automation"], phase: 1 }],
  ["x_campaign_package", "X Campaign Package", "Campaign package for X (Twitter).", { targetNeeds: ["advertising_strategy"], phase: 1 }],
  ["multi_platform_campaign", "Multi-Platform Campaign", "Coordinated campaign across multiple platforms.", { targetNeeds: ["advertising_strategy", "content_calendar"], phase: 2 }],
  ["local_market_campaign", "Local Market Campaign", "Geo-targeted campaign for a local market.", { targetNeeds: ["advertising_strategy", "seo"], phase: 1 }],
  ["lead_generation_campaign", "Lead Generation Campaign", "Paid and organic lead generation campaign setup.", { targetNeeds: ["lead_generation", "advertising_strategy"], phase: 1 }],
  ["product_launch_campaign", "Product Launch Campaign", "Launch campaign for a new product or service.", { targetNeeds: ["advertising_strategy", "product_demo_video"], phase: 1 }],
  ["retargeting_content_package", "Retargeting Content Package", "Creative package for retargeting audiences.", { targetNeeds: ["advertising_strategy"], phase: 1 }],
  ["social_content_calendar", "Social Content Calendar", "Detailed social publishing calendar.", { targetNeeds: ["content_calendar", "social_media_strategy"], phase: 1 }],
  ["facebook_content", "Facebook Content Production", "Content production for Facebook pages.", { targetNeeds: ["content_calendar", "social_media_strategy"], phase: 1 }],
  ["instagram_content", "Instagram Content Production", "Feed and story content for Instagram.", { targetNeeds: ["content_calendar", "social_media_strategy"], phase: 1 }],
  ["linkedin_content", "LinkedIn Content Production", "Professional content for LinkedIn.", { targetNeeds: ["content_calendar", "social_media_strategy"], phase: 1 }],
  ["website_copywriting", "Website Copywriting", "Conversion-oriented website copy.", { targetNeeds: ["branding", "seo"], phase: 1 }],
  ["service_page_copywriting", "Service Page Copywriting", "Copy for individual service pages.", { targetNeeds: ["service_website", "seo"], phase: 1 }],
  ["advertising_copywriting", "Advertising Copywriting", "Short-form ad copy for paid channels.", { targetNeeds: ["advertising_strategy"], phase: 1 }],
  ["arabic_content", "Arabic Content Production", "Arabic marketing content production.", { targetNeeds: ["multilingual_content"], phase: 1 }],
  ["english_content", "English Content Production", "English marketing content production.", { targetNeeds: ["multilingual_content"], phase: 1 }],
  ["french_content", "French Content Production", "French marketing content production.", { targetNeeds: ["multilingual_content"], phase: 1 }],
  ["seo_content", "SEO Content Production", "Search-optimized content production.", { targetNeeds: ["seo", "content_calendar"], phase: 1 }],
  ["technical_seo", "Technical SEO", "Technical SEO audit and fixes.", { targetNeeds: ["seo"], phase: 1 }],
  ["on_page_seo", "On-Page SEO", "On-page optimization for key pages.", { targetNeeds: ["seo"], phase: 1 }],
  ["local_seo", "Local SEO", "Local search optimization for physical businesses.", { targetNeeds: ["seo"], phase: 1 }],
  ["multilingual_seo", "Multilingual SEO", "SEO across Arabic, French, and English locales.", { targetNeeds: ["seo", "multilingual_content"], phase: 2 }],
  ["brand_strategy", "Brand Strategy", "Brand positioning and messaging strategy.", { targetNeeds: ["branding"], phase: 0 }],
  ["visual_identity", "Visual Identity System", "Visual identity beyond logo design.", { targetNeeds: ["branding"], phase: 0 }],
  ["presentation_templates", "Presentation Templates", "Branded slide and presentation templates.", { targetNeeds: ["branding"], phase: 1 }],
  ["explainer_video", "Explainer Video Production", "Animated or live explainer video.", { targetNeeds: ["video_production", "product_demo_video"], phase: 1 }],
  ["tutorial_video", "Tutorial Video Production", "How-to video content for products or services.", { targetNeeds: ["video_production"], phase: 1 }],
]);

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

const CONSULTING_EXTENDED_SERVICES: ServiceSeedDefinition[] = svcMany("consulting_transformation", [
  ["technology_consulting", "Technology Consulting", "Independent technology advisory for business leaders.", { targetNeeds: ["business_analysis"], phase: 0 }],
  ["business_system_audit", "Business System Audit", "Reviews current tools and data flows.", { targetNeeds: ["business_analysis"], phase: 0 }],
  ["existing_system_audit", "Existing System Audit", "Audit of legacy systems before modernization.", { targetNeeds: ["business_analysis", "website_modernization"], phase: 0 }],
  ["legacy_system_modernization", "Legacy System Modernization Consulting", "Roadmap to modernize legacy applications.", { targetNeeds: ["website_modernization", "custom_web_application"], phase: 1, requiresDecisionMakerEvidence: true }],
  ["product_redesign", "Product Redesign Consulting", "UX and product redesign advisory.", { targetNeeds: ["business_analysis"], phase: 1 }],
  ["ux_audit", "UX Audit", "Heuristic review of user experience flows.", { targetNeeds: ["business_analysis"], phase: 0 }],
  ["performance_audit", "Performance Audit", "Reviews application and website performance.", { targetNeeds: ["business_analysis", "scalability"], phase: 0 }],
  ["integration_audit", "Integration Audit", "Maps integrations and identifies gaps.", { targetNeeds: ["business_analysis", "data_sync"], phase: 0 }],
  ["ai_readiness_assessment", "AI Readiness Assessment", "Assesses data and workflow readiness for AI.", { targetNeeds: ["custom_ai_assistant", "business_analysis"], phase: 0 }],
  ["automation_readiness_assessment", "Automation Readiness Assessment", "Identifies automation candidates and blockers.", { targetNeeds: ["custom_workflow", "business_analysis"], phase: 0 }],
  ["payment_readiness_assessment", "Payment Readiness Assessment", "Assesses readiness for licensed payment integration.", { targetNeeds: ["provider_integration", "merchant_onboarding_support"], phase: 0 }],
  ["internationalization_readiness", "Internationalization Readiness", "Assesses multilingual and multi-country expansion readiness.", { targetNeeds: ["multilingual_website", "multilingual_content"], phase: 0 }],
  ["solution_architecture", "Solution Architecture Consulting", "Designs target solution architecture.", { targetNeeds: ["cloud_architecture", "business_analysis"], phase: 0, requiresDecisionMakerEvidence: true }],
  ["multi_branch_architecture", "Multi-Branch Architecture Consulting", "Architecture for multi-branch operators.", { supportedBusinessTypes: MULTI_BRANCH_TYPES, targetNeeds: ["multi_branch_platform"], phase: 2, requiresDecisionMakerEvidence: true }],
  ["multi_tenant_architecture", "Multi-Tenant Architecture Consulting", "Architecture for multi-tenant SaaS products.", { supportedBusinessTypes: SOFTWARE, targetNeeds: ["saas_platform"], phase: 2, requiresDecisionMakerEvidence: true }],
  ["api_first_architecture", "API-First Architecture Consulting", "Designs API-first integration architecture.", { supportedBusinessTypes: SOFTWARE, targetNeeds: ["custom_web_application"], phase: 1 }],
  ["marketplace_architecture", "Marketplace Architecture Consulting", "Architecture for multi-vendor marketplaces.", { supportedBusinessTypes: ["marketplace_business"], targetNeeds: ["marketplace"], phase: 2, requiresDecisionMakerEvidence: true }],
  ["project_discovery", "Project Discovery", "Structured discovery workshops for new initiatives.", { targetNeeds: ["business_analysis"], phase: 0 }],
  ["product_roadmap", "Product Roadmap Consulting", "Prioritized product and technology roadmap.", { supportedBusinessTypes: SOFTWARE, targetNeeds: ["business_analysis"], phase: 0, requiresDecisionMakerEvidence: true }],
  ["maintenance_support_plan", "Maintenance and Support Plan", "Plans ongoing maintenance and support SLAs.", { targetNeeds: ["website_modernization"], phase: 1 }],
  ["documentation_training", "Documentation and Training", "User documentation and admin training materials.", { targetNeeds: ["business_analysis"], phase: 1 }],
]);

export const CATALOG_SEED_SERVICES: ServiceSeedDefinition[] = [
  ...BUILD_SERVICES,
  ...BUILD_VERTICAL_WEBSITES,
  ...MANAGE_SERVICES,
  ...MANAGE_CRM_ERP_BOOKING,
  ...AI_SERVICES,
  ...AI_EXTENDED_SERVICES,
  ...AUTOMATION_SERVICES,
  ...AUTOMATION_EXTENDED_SERVICES,
  ...PAYMENT_SERVICES,
  ...PAYMENT_PROVIDER_SERVICES,
  ...CYBERSECURITY_SERVICES,
  ...CYBERSECURITY_EXTENDED_SERVICES,
  ...CLOUD_SERVICES,
  ...CLOUD_EXTENDED_SERVICES,
  ...ANALYTICS_SERVICES,
  ...ANALYTICS_EXTENDED_SERVICES,
  ...GROWTH_SERVICES,
  ...GROWTH_EXTENDED_SERVICES,
  ...CONSULTING_SERVICES,
  ...CONSULTING_EXTENDED_SERVICES,
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
