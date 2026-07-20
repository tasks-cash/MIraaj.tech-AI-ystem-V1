from app.core.config import get_settings
from app.services.ocr.language_selector import select_ocr_language_packs


def test_language_selector_respects_max_languages() -> None:
    settings = get_settings()
    selected, unavailable = select_ocr_language_packs(
        installed_packs=settings.ocr_languages_installed_packs,
        default_packs=settings.ocr_languages_default_packs,
        preliminary_packs=settings.ocr_preliminary_language_packs,
        max_languages=2,
        requested_languages=["ar", "en", "fr", "es"],
    )
    assert len(selected) == 2
    assert selected == ["ara", "eng"]


def test_language_selector_uses_country_hints() -> None:
    settings = get_settings()
    selected, _unavailable = select_ocr_language_packs(
        installed_packs=settings.ocr_languages_installed_packs,
        default_packs=settings.ocr_languages_default_packs,
        preliminary_packs=settings.ocr_preliminary_language_packs,
        max_languages=4,
        country="DZ",
    )
    assert "ara" in selected
    assert "fra" in selected


def test_language_selector_marks_missing_packs() -> None:
    selected, unavailable = select_ocr_language_packs(
        installed_packs=frozenset({"eng"}),
        default_packs=("eng",),
        preliminary_packs=("eng",),
        max_languages=4,
        requested_languages=["zh"],
    )
    assert selected == ["eng"]
    assert unavailable == ["zh"]
