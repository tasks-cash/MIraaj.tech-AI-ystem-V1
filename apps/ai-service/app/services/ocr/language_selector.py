from __future__ import annotations

LANGUAGE_TO_OCR_PACK: dict[str, str] = {
    "ar": "ara",
    "en": "eng",
    "fr": "fra",
    "es": "spa",
    "de": "deu",
    "pt": "por",
    "it": "ita",
    "nl": "nld",
    "tr": "tur",
    "ru": "rus",
}

OCR_PACK_TO_LANGUAGE: dict[str, str] = {value: key for key, value in LANGUAGE_TO_OCR_PACK.items()}

SCRIPT_TO_PACKS: dict[str, tuple[str, ...]] = {
    "Arabic": ("ara",),
    "Latin": ("eng", "fra", "spa", "deu", "por", "ita", "nld", "tur"),
    "Cyrillic": ("rus",),
}

COUNTRY_LANGUAGE_HINTS: dict[str, tuple[str, ...]] = {
    "DZ": ("ara", "fra"),
    "SA": ("ara",),
    "AE": ("ara", "eng"),
    "EG": ("ara",),
    "MA": ("ara", "fra"),
    "FR": ("fra",),
    "US": ("eng",),
    "GB": ("eng",),
    "ES": ("spa",),
    "DE": ("deu",),
    "BR": ("por",),
    "PT": ("por",),
    "IT": ("ita",),
    "NL": ("nld",),
    "TR": ("tur",),
    "RU": ("rus",),
}


def language_code_to_pack(language_code: str) -> str | None:
    normalized = language_code.strip().lower().split("-")[0]
    return LANGUAGE_TO_OCR_PACK.get(normalized)


def select_ocr_language_packs(
    *,
    installed_packs: frozenset[str],
    default_packs: tuple[str, ...],
    preliminary_packs: tuple[str, ...],
    max_languages: int,
    requested_languages: list[str] | None = None,
    locale: str | None = None,
    country: str | None = None,
    detected_scripts: list[str] | None = None,
) -> tuple[list[str], list[str]]:
    selected: list[str] = []
    unavailable: list[str] = []

    def add_pack(pack: str) -> None:
        if pack in selected:
            return
        if pack not in installed_packs:
            if pack not in unavailable:
                unavailable.append(pack)
            return
        if len(selected) >= max_languages:
            return
        selected.append(pack)

    if requested_languages:
        for language in requested_languages:
            pack = language_code_to_pack(language)
            if pack:
                add_pack(pack)
            else:
                unavailable.append(language)

    if locale:
        pack = language_code_to_pack(locale)
        if pack:
            add_pack(pack)

    if country:
        country_key = country.strip().upper()
        for language in COUNTRY_LANGUAGE_HINTS.get(country_key, ()):
            pack = language_code_to_pack(language)
            if pack:
                add_pack(pack)

    for script in detected_scripts or []:
        for pack in SCRIPT_TO_PACKS.get(script, ()):
            add_pack(pack)

    for pack in default_packs:
        add_pack(pack)

    if not selected:
        for pack in preliminary_packs:
            add_pack(pack)

    if not selected:
        for pack in default_packs:
            add_pack(pack)

    return selected[:max_languages], unavailable
