"""Pydantic/Python mirror of ``packages/shared-types/src/campaign-intelligence.ts``
and the payment disclosure constants in ``business-intelligence.ts``.

Keep every tuple in this module byte-for-byte aligned with its TypeScript
counterpart. NestJS is the source of truth for these contracts; this service
only mirrors them so provider output can be schema-validated the same way on
both sides of the internal HMAC boundary.
"""

from __future__ import annotations

import re
from typing import Literal

CampaignObjective = Literal[
    "brand_awareness",
    "service_awareness",
    "product_awareness",
    "education",
    "thought_leadership",
    "engagement",
    "community_growth",
    "lead_generation",
    "consultation_request",
    "demo_request",
    "quote_request",
    "website_visit",
    "landing_page_visit",
    "whatsapp_contact",
    "phone_contact",
    "email_contact",
    "application_signup",
    "account_registration",
    "trial_request",
    "booking_request",
    "event_registration",
    "content_download",
    "retargeting",
    "customer_reactivation",
    "upsell",
    "cross_sell",
    "product_launch",
    "service_launch",
    "market_entry",
    "local_business_growth",
    "recruitment",
    "partnership_interest",
    "referral_interest",
    "unknown",
]

FunnelStage = Literal[
    "awareness",
    "problem_awareness",
    "consideration",
    "solution_comparison",
    "decision",
    "conversion",
    "onboarding",
    "retention",
    "expansion",
    "reactivation",
    "advocacy",
]

CampaignType = Literal[
    "single_service_campaign",
    "service_bundle_campaign",
    "industry_campaign",
    "market_campaign",
    "local_campaign",
    "multilingual_campaign",
    "educational_campaign",
    "lead_generation_campaign",
    "consultation_campaign",
    "product_launch_campaign",
    "service_launch_campaign",
    "comparison_campaign",
    "retargeting_campaign",
    "event_campaign",
    "content_series",
    "social_series",
    "short_video_series",
    "thought_leadership_series",
    "awareness_series",
    "conversion_series",
    "recruitment_campaign",
    "partnership_campaign",
]

CampaignPlatform = Literal[
    "facebook",
    "instagram",
    "linkedin",
    "tiktok",
    "youtube",
    "youtube_shorts",
    "x",
    "telegram",
    "whatsapp_status",
    "email",
    "website_blog",
    "website_service_page",
    "generic_social",
]

ContentFormat = Literal[
    "short_post",
    "long_post",
    "text_thread",
    "article",
    "blog_outline",
    "service_page_outline",
    "email_subject",
    "email_body",
    "carousel",
    "carousel_slide",
    "story",
    "story_sequence",
    "reel",
    "short_video",
    "long_video",
    "video_script",
    "voiceover_script",
    "storyboard",
    "shot_list",
    "image_post",
    "image_brief",
    "thumbnail_brief",
    "infographic_brief",
    "poll",
    "question_post",
    "educational_post",
    "case_scenario",
    "faq_post",
    "comparison_post",
    "myth_fact_post",
    "checklist_post",
    "announcement",
    "launch_post",
    "testimonial_structure",
    "call_to_action",
    "hashtag_set",
    "keyword_set",
]

CtaCode = Literal[
    "learn_more",
    "discover_service",
    "visit_website",
    "request_consultation",
    "request_demo",
    "request_quote",
    "contact_us",
    "contact_whatsapp",
    "call_now",
    "send_email",
    "book_discovery",
    "register_interest",
    "download_guide",
    "view_case_study",
    "compare_options",
    "start_project",
    "join_waitlist",
    "follow_page",
    "save_post",
    "share_post",
    "comment_question",
    "no_direct_cta",
]

LocalizationMode = Literal[
    "source_language_only",
    "direct_translation",
    "localized_translation",
    "transcreation",
    "market_specific_generation",
    "bilingual_variant",
    "multilingual_package",
]

ClaimState = Literal[
    "approved",
    "source_supported",
    "requires_evidence",
    "prohibited",
    "unknown",
    "human_review_required",
]

TranslationStrategy = Literal[
    "direct_translation",
    "transcreation",
    "human_translation",
    "glossary_assisted",
]

CampaignReviewReasonCode = Literal[
    "source_review_required",
    "audience_ambiguous",
    "decision_maker_uncertain",
    "promotion_eligibility_uncertain",
    "unsuitable_target",
    "regulated_domain",
    "payment_service",
    "provider_dependency",
    "country_availability_unknown",
    "tier3_language",
    "untested_locale",
    "translation_unavailable",
    "low_translation_confidence",
    "semantic_drift",
    "protected_term_changed",
    "missing_disclosure",
    "unsupported_claim",
    "evidence_required",
    "invalid_destination",
    "platform_policy_unverified",
    "low_brand_score",
    "low_compliance_score",
    "low_language_score",
    "low_overall_quality",
    "prompt_injection_detected",
    "service_message_conflict",
    "multilingual_variant_failed",
    "manual_review_requested",
]

PROTECTED_CAMPAIGN_TERMS: tuple[str, ...] = ("Miraaj.tech", "Tasks.cash")

# Mirrors PROHIBITED_CAMPAIGN_CLAIM_PATTERNS in campaign-intelligence.ts.
PROHIBITED_CAMPAIGN_CLAIM_PATTERNS: tuple[re.Pattern[str], ...] = (
    re.compile(r"guaranteed\s+(merchant\s+)?approval", re.IGNORECASE),
    re.compile(r"guaranteed\s+results?", re.IGNORECASE),
    re.compile(r"increase\s+revenue\s+by\s+\d+", re.IGNORECASE),
    re.compile(r"no\s+kyc", re.IGNORECASE),
    re.compile(r"no\s+kyb", re.IGNORECASE),
    re.compile(r"anonymous\s+(business\s+)?bank", re.IGNORECASE),
    re.compile(r"unhackable", re.IGNORECASE),
    re.compile(r"perfect\s+security", re.IGNORECASE),
    re.compile(r"number\s+one\b", re.IGNORECASE),
    re.compile(r"300\s*%", re.IGNORECASE),
)

# Mirrors PROHIBITED_PAYMENT_CLAIM_PATTERNS in business-intelligence.ts.
PROHIBITED_PAYMENT_CLAIM_PATTERNS: tuple[re.Pattern[str], ...] = (
    re.compile(r"guaranteed\s+merchant\s+approval", re.IGNORECASE),
    re.compile(r"no\s+kyc", re.IGNORECASE),
    re.compile(r"no\s+kyb", re.IGNORECASE),
    re.compile(r"anonymous\s+financial\s+account", re.IGNORECASE),
    re.compile(r"account\s+without\s+registration", re.IGNORECASE),
    re.compile(r"bypass\s+country\s+restrictions", re.IGNORECASE),
    re.compile(r"miraaj\.tech\s+is\s+a\s+bank", re.IGNORECASE),
)

# Extra fake-statistic heuristics not already covered above (e.g. "5x more
# clients", "#1 worldwide"). Conservative and additive; never used to remove
# content, only to raise a review flag.
FAKE_STATISTIC_PATTERNS: tuple[re.Pattern[str], ...] = (
    re.compile(r"\d+\s*x\s+(more|higher)\s+(clients|sales|revenue|leads)", re.IGNORECASE),
    re.compile(r"#\s*1\s+(worldwide|in\s+the\s+world)", re.IGNORECASE),
    re.compile(r"\d{2,4}\s*%\s*(guaranteed|success\s+rate)", re.IGNORECASE),
)

# Mirrors PAYMENT_COMPLIANCE_DISCLAIMERS in business-intelligence.ts.
PAYMENT_COMPLIANCE_DISCLAIMERS: dict[str, str] = {
    "en": (
        "Miraaj.tech provides technical integration, provider-selection guidance and "
        "lawful onboarding support. Financial accounts and merchant services are "
        "supplied by licensed third-party providers and remain subject to identity "
        "verification, company verification, country availability, activity "
        "eligibility and provider approval."
    ),
    "ar": (
        "تقدم Miraaj.tech خدمات التكامل التقني، والمساعدة في اختيار مزود الخدمة، "
        "ودعم إجراءات الربط القانونية. يتم توفير الحسابات المالية وخدمات التجار من "
        "خلال جهات مرخصة، وتخضع للتحقق من الهوية، والتحقق من الشركة، وتوفر الخدمة في "
        "البلد، وأهلية النشاط، وموافقة مزود الخدمة."
    ),
    "fr": (
        "Miraaj.tech fournit l’intégration technique, l’aide au choix du prestataire "
        "et l’accompagnement légal à l’intégration. Les comptes financiers et "
        "services marchands sont fournis par des prestataires tiers agréés et "
        "restent soumis à la vérification d’identité, à la vérification de "
        "l’entreprise, à la disponibilité dans le pays, à l’éligibilité de "
        "l’activité et à l’approbation du prestataire."
    ),
}

# Short, language-specific substrings used to confirm a disclosure is present
# even when the caller supplies a paraphrase rather than the exact string.
PAYMENT_DISCLOSURE_KEY_PHRASES: dict[str, tuple[str, ...]] = {
    "en": ("identity verification", "licensed third-party", "provider approval"),
    "ar": ("التحقق من الهوية", "جهات مرخصة", "موافقة مزود الخدمة"),
    "fr": ("vérification d’identité", "vérification d'identité", "prestataires tiers agréés"),
}

RTL_LANGUAGES: frozenset[str] = frozenset({"ar", "he", "fa", "ur"})


def containsProhibitedCampaignClaim(text: str) -> bool:  # noqa: N802 - mirrors TS name
    return any(pattern.search(text) for pattern in PROHIBITED_CAMPAIGN_CLAIM_PATTERNS)


def direction_for_language(language: str | None) -> Literal["ltr", "rtl"]:
    if not language:
        return "ltr"
    return "rtl" if language.strip().lower().split("-")[0] in RTL_LANGUAGES else "ltr"
