import type {
  AudienceSignalLabel,
  AudienceType,
  BusinessNeedCode,
  BusinessSignalLabel,
  BusinessType,
  GroupSourceContext,
} from "@miraaj/shared-types";
import {
  AUDIENCE_TYPES,
  isConsumerAudience,
  isProfessionalAudience,
} from "@miraaj/shared-types";

/** Maps Prompt 2 vision business signal labels onto the Prompt 3 controlled taxonomy. */
export const BUSINESS_SIGNAL_TO_BUSINESS_TYPE: Record<BusinessSignalLabel, BusinessType> = {
  dental_clinic: "dental_clinic",
  general_healthcare: "general_clinic",
  pharmacy: "pharmacy",
  education: "school",
  restaurant: "restaurant",
  hotel: "hotel",
  real_estate: "real_estate_agency",
  construction: "construction_company",
  logistics: "logistics_company",
  agriculture: "agriculture_business",
  retail: "retail_store",
  e_commerce: "ecommerce_business",
  legal_services: "law_firm",
  accounting: "accounting_office",
  automotive: "automotive_workshop",
  salon: "salon",
  gym: "gym",
  travel: "travel_agency",
  software: "software_company",
  professional_services: "professional_services",
  unknown: "unknown",
};

const AUDIENCE_TYPE_SET = new Set<string>(AUDIENCE_TYPES);

export function mapAudienceSignalToAudienceType(
  label: AudienceSignalLabel,
): AudienceType {
  return AUDIENCE_TYPE_SET.has(label) ? (label) : "unknown";
}

export function inferGroupSourceContext(
  audienceType: AudienceType,
): GroupSourceContext {
  if (audienceType === "patient") return "patient_group";
  if (audienceType === "student") return "student_group";
  if (audienceType === "parent") return "parent_group";
  if (audienceType === "employee") return "employee_group";
  if (audienceType === "consumer" || audienceType === "general_public") {
    return "consumer_group";
  }
  if (isProfessionalAudience(audienceType)) return "business_owner_group";
  if (audienceType === "mixed") return "mixed_context";
  return "unknown";
}

export function inferPromotionEligibility(
  audienceType: AudienceType,
  businessTypeConfidence: number,
): "eligible_b2b" | "unsuitable" | "review_required" | "unknown" {
  if (isConsumerAudience(audienceType)) return "unsuitable";
  if (isProfessionalAudience(audienceType) && businessTypeConfidence >= 0.5) {
    return "eligible_b2b";
  }
  if (audienceType === "mixed" || audienceType === "unknown") {
    return "review_required";
  }
  return "unknown";
}

/** Deterministic starter needs per business type — refined by human review over time. */
export const BUSINESS_TYPE_DEFAULT_NEEDS: Partial<
  Record<BusinessType, BusinessNeedCode[]>
> = {
  dental_clinic: ["patient_management", "booking", "reporting"],
  general_clinic: ["patient_management", "booking"],
  medical_center: ["patient_management", "booking", "reporting"],
  hospital: ["patient_management", "reporting", "analytics"],
  pharmacy: ["inventory", "patient_management"],
  school: ["student_management", "attendance"],
  kindergarten: ["student_management", "attendance"],
  training_center: ["student_management", "booking"],
  university: ["student_management", "reporting"],
  restaurant: ["restaurant_management", "booking", "online_checkout"],
  coffee_shop: ["restaurant_management", "online_checkout"],
  hotel: ["hotel_management", "booking", "online_checkout"],
  travel_agency: ["booking", "crm"],
  real_estate_agency: ["real_estate_management", "crm", "lead_generation"],
  property_management: ["real_estate_management", "reporting"],
  ecommerce_business: ["ecommerce_store", "inventory", "online_checkout"],
  retail_store: ["inventory", "online_checkout"],
  wholesale_business: ["inventory", "erp"],
};
