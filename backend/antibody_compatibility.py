from __future__ import annotations

import re
from dataclasses import dataclass
from html import unescape
from typing import Any
from urllib.parse import urlparse
from urllib.request import Request, urlopen


HOST_SPECIES = ("rabbit", "mouse", "goat", "rat", "sheep", "donkey", "chicken", "hamster")
APPLICATION_TERMS = ("western blot", "wb", "immunoblot")


@dataclass
class AntibodyFacts:
    url: str | None
    vendor: str | None
    host_species: str | None
    target_species: str | None
    isotype: str | None
    conjugate: str | None
    applications: list[str]
    catalog_hint: str | None
    clone_hint: str | None
    validation_evidence: dict[str, Any]
    confidence_notes: list[str]


def _fetch_page_text(url: str | None) -> tuple[str, str | None, list[str]]:
    if not url:
        return "", None, ["No URL provided."]

    notes = []
    try:
        parsed = urlparse(url)
        vendor = parsed.netloc.replace("www.", "")
        request = Request(url, headers={"User-Agent": "Butterfly/0.1", "Accept": "text/html,application/xhtml+xml"})
        with urlopen(request, timeout=20) as response:  # noqa: S310
            raw = response.read().decode("utf-8", errors="ignore")
    except Exception as exc:  # pragma: no cover - network dependent
        return "", None, [f"Could not fetch product page: {exc}"]

    text = re.sub(r"<script.*?</script>", " ", raw, flags=re.IGNORECASE | re.DOTALL)
    text = re.sub(r"<style.*?</style>", " ", text, flags=re.IGNORECASE | re.DOTALL)
    text = re.sub(r"<[^>]+>", " ", text)
    text = unescape(re.sub(r"\s+", " ", text)).strip()
    if not text:
        notes.append("Product page returned no readable text.")
    return text, vendor, notes


def _find_host_species(text: str, manual: str | None = None) -> str | None:
    if manual:
        manual_lower = manual.lower().strip()
        if manual_lower in HOST_SPECIES:
            return manual_lower

    lower = text.lower()
    for species in HOST_SPECIES:
        patterns = [
            rf"host species\s*[:\-]?\s*{species}",
            rf"host\s*[:\-]?\s*{species}",
            rf"{species}\s+(monoclonal|polyclonal|recombinant monoclonal)",
            rf"raised in\s+{species}",
        ]
        if any(re.search(pattern, lower) for pattern in patterns):
            return species
    return None


def _find_target_species(text: str, manual: str | None = None) -> str | None:
    if manual:
        manual_lower = manual.lower().strip().replace("anti-", "")
        if manual_lower in HOST_SPECIES:
            return manual_lower

    lower = text.lower()
    for species in HOST_SPECIES:
        patterns = [
            rf"anti[-\s]{species}",
            rf"{species}\s+igg",
            rf"target species\s*[:\-]?\s*{species}",
        ]
        if any(re.search(pattern, lower) for pattern in patterns):
            return species
    return None


def _find_isotype(text: str, manual: str | None = None) -> str | None:
    if manual:
        return manual.strip()

    lower = text.lower()
    for isotype in ("igg1", "igg2a", "igg2b", "igg2c", "igg3", "igm", "iga", "igg"):
        if re.search(rf"\b{isotype}\b", lower):
            return isotype.upper().replace("IG", "Ig")
    return None


def _find_conjugate(text: str, manual: str | None = None) -> str | None:
    if manual:
        return manual.strip().upper()

    lower = text.lower()
    if "hrp" in lower or "peroxidase" in lower:
        return "HRP"
    if "alkaline phosphatase" in lower or re.search(r"\bap\b", lower):
        return "AP"
    for fluor in ("alexa fluor", "fitc", "cy3", "cy5", "irdye"):
        if fluor in lower:
            return "fluorescent"
    return None


def _find_applications(text: str, manual: str | None = None) -> list[str]:
    applications = set()
    if manual:
        applications.add(manual.upper())

    lower = text.lower()
    for term in APPLICATION_TERMS:
        if re.search(rf"\b{re.escape(term)}\b", lower):
            applications.add("WB")
    if "elisa" in lower:
        applications.add("ELISA")
    if "immunohistochemistry" in lower or re.search(r"\bihc\b", lower):
        applications.add("IHC")
    if "immunofluorescence" in lower or re.search(r"\bif\b", lower):
        applications.add("IF")
    return sorted(applications)


def _catalog_hint(text: str) -> str | None:
    match = re.search(r"\b(ab\d{3,8}|NA9\d{2}|RPN\d{3,5}|A\d{4,7})\b", text, flags=re.IGNORECASE)
    return match.group(1) if match else None


def _clone_hint(text: str, manual: str | None = None) -> str | None:
    if manual:
        return manual.strip()

    patterns = [
        r"clone\s*[:\-]?\s*([A-Za-z0-9._/-]{2,24})",
        r"clone\s+([A-Za-z0-9._/-]{2,24})",
        r"monoclonal antibody\s*\(([A-Za-z0-9._/-]{2,24})\)",
    ]
    for pattern in patterns:
        match = re.search(pattern, text, flags=re.IGNORECASE)
        if match:
            return match.group(1).strip(" .;,")
    return None


def _validation_evidence(text: str) -> dict[str, Any]:
    lower = text.lower()
    signals = []
    score = 0.1

    citation_matches = re.findall(r"\b(?:pubmed|pmid|citation|cited by|publications?|references?)\b", lower)
    citation_count = min(len(citation_matches), 25)
    if citation_count:
        signals.append(f"Manufacturer page contains {citation_count} citation/publication-style signal(s).")
        score += min(0.22, citation_count * 0.025)

    application_matches = re.findall(r"\b(?:western blot|immunoblot|\bwb\b)\b", lower)
    wb_signal_count = min(len(application_matches), 20)
    if wb_signal_count:
        signals.append("WB/immunoblot application language was detected.")
        score += 0.16

    validation_terms = {
        "knockout": "Knockout validation",
        "knockdown": "Knockdown validation",
        "sirna": "siRNA validation",
        "peptide blocking": "Peptide blocking validation",
        "orthogonal": "Orthogonal validation",
        "independent validation": "Independent validation",
        "cell treatment": "Treatment-response validation",
    }
    matched_validation = sorted({label for term, label in validation_terms.items() if term in lower})
    if matched_validation:
        signals.extend(matched_validation)
        score += min(0.24, 0.08 * len(matched_validation))

    manufacturing_terms = {
        "recombinant monoclonal": "Recombinant monoclonal manufacturing",
        "monoclonal": "Monoclonal clone information",
        "polyclonal": "Polyclonal manufacturing information",
        "lot": "Lot/batch information",
        "rrid": "RRID traceability",
        "concentration": "Supplied concentration information",
        "immunogen": "Immunogen/epitope information",
    }
    matched_manufacturing = sorted({label for term, label in manufacturing_terms.items() if term in lower})
    if matched_manufacturing:
        signals.extend(matched_manufacturing[:5])
        score += min(0.18, 0.035 * len(matched_manufacturing))

    if "loading control" in lower:
        signals.append("Loading-control context detected; saturation risk should be managed carefully.")
        score += 0.03

    if not text:
        signals.append("No readable manufacturer text was available; validation score relies on manual fields only.")

    if score >= 0.72:
        label = "strong"
    elif score >= 0.48:
        label = "moderate"
    else:
        label = "limited"

    return {
        "score": round(max(0.0, min(1.0, score)), 3),
        "label": label,
        "citation_signal_count": citation_count,
        "wb_signal_count": wb_signal_count,
        "signals": signals[:8],
        "interpretation": "Validation scoring uses manufacturer-page signals such as WB use, citation language, clone/manufacturing details, RRID, immunogen, lot/concentration, and knockout/knockdown/orthogonal validation terms.",
    }


def extract_antibody_facts(
    url: str | None,
    manual_host_species: str | None = None,
    manual_target_species: str | None = None,
    manual_isotype: str | None = None,
    manual_conjugate: str | None = None,
    manual_application: str | None = None,
    manual_clone: str | None = None,
) -> AntibodyFacts:
    text, vendor, notes = _fetch_page_text(url)
    return AntibodyFacts(
        url=url,
        vendor=vendor,
        host_species=_find_host_species(text, manual_host_species),
        target_species=_find_target_species(text, manual_target_species),
        isotype=_find_isotype(text, manual_isotype),
        conjugate=_find_conjugate(text, manual_conjugate),
        applications=_find_applications(text, manual_application),
        catalog_hint=_catalog_hint(text),
        clone_hint=_clone_hint(text, manual_clone),
        validation_evidence=_validation_evidence(text),
        confidence_notes=notes,
    )


def _cytiva_secondary_suggestion(primary_host: str | None) -> dict[str, str] | None:
    if primary_host == "rabbit":
        return {
            "vendor": "Cytiva / Amersham",
            "name": "ECL Rabbit IgG, HRP-linked whole antibody",
            "catalog": "NA934",
            "reason": "Rabbit primary antibodies pair with anti-rabbit IgG HRP secondaries for ECL Western blotting.",
        }
    if primary_host == "mouse":
        return {
            "vendor": "Cytiva / Amersham",
            "name": "ECL Mouse IgG, HRP-linked whole antibody",
            "catalog": "NA931",
            "reason": "Mouse primary antibodies pair with anti-mouse IgG HRP secondaries for ECL Western blotting.",
        }
    return None


def check_antibody_compatibility(payload: dict[str, Any]) -> dict[str, Any]:
    primary = extract_antibody_facts(
        payload.get("primary_url"),
        manual_host_species=payload.get("primary_host_species"),
        manual_isotype=payload.get("primary_isotype"),
        manual_application=payload.get("application"),
        manual_clone=payload.get("primary_clone"),
    )
    secondary = extract_antibody_facts(
        payload.get("secondary_url"),
        manual_target_species=payload.get("secondary_target_species"),
        manual_isotype=payload.get("secondary_isotype"),
        manual_conjugate=payload.get("secondary_conjugate"),
        manual_application=payload.get("application"),
    )

    detection = (payload.get("detection_method") or "ECL").lower()
    application = (payload.get("application") or "WB").upper()
    findings = []
    warnings = []
    score = 0.45
    validation_score = primary.validation_evidence.get("score", 0.0)

    if primary.host_species:
        findings.append(f"Primary host appears to be {primary.host_species}.")
        score += 0.15
    else:
        warnings.append("Primary host species could not be confirmed from the page or manual input.")

    if secondary.target_species:
        findings.append(f"Secondary appears to target {secondary.target_species}.")
        score += 0.15
    elif secondary.url:
        warnings.append("Secondary target species could not be confirmed from the page.")

    if primary.host_species and secondary.target_species:
        if primary.host_species == secondary.target_species:
            findings.append("Secondary target species matches the primary host species.")
            score += 0.2
        else:
            warnings.append("Secondary target species does not match the primary host species.")
            score -= 0.25

    if secondary.conjugate:
        findings.append(f"Secondary conjugate appears to be {secondary.conjugate}.")
        if "ecl" in detection and secondary.conjugate == "HRP":
            findings.append("HRP conjugate is compatible with ECL detection.")
            score += 0.15
        elif "ecl" in detection:
            warnings.append("ECL detection usually expects an HRP-conjugated secondary.")
            score -= 0.12
    elif secondary.url:
        warnings.append("Secondary conjugate could not be confirmed.")

    if application in primary.applications or "WB" in primary.applications:
        findings.append("Primary page appears to include WB / immunoblot use.")
        score += 0.08
    elif primary.url:
        warnings.append("WB validation for the primary was not confidently detected.")

    if application in secondary.applications or "WB" in secondary.applications:
        findings.append("Secondary page appears to include WB / immunoblot use.")
        score += 0.08
    elif secondary.url:
        warnings.append("WB validation for the secondary was not confidently detected.")

    suggestion = _cytiva_secondary_suggestion(primary.host_species)
    if suggestion and not secondary.url:
        findings.append(f"Suggested Cytiva HRP secondary: {suggestion['catalog']} ({suggestion['name']}).")

    if primary.clone_hint:
        findings.append(f"Primary clone/manufacturing hint: {primary.clone_hint}.")

    if primary.validation_evidence.get("label") == "strong":
        findings.append("Primary antibody validation evidence appears strong from the readable manufacturer-page text.")
        score += 0.08
    elif primary.validation_evidence.get("label") == "moderate":
        findings.append("Primary antibody validation evidence appears moderate from the readable manufacturer-page text.")
        score += 0.04
    else:
        warnings.append("Primary antibody validation evidence is limited from the readable page text; check datasheet images, citations, and clone-specific validation manually.")

    if score >= 0.78 and not any("does not match" in warning for warning in warnings):
        status = "compatible"
    elif score >= 0.55:
        status = "manual review"
    else:
        status = "not compatible"

    return {
        "status": status,
        "score": round(max(0.0, min(1.0, score)), 3),
        "primary": primary.__dict__,
        "secondary": secondary.__dict__,
        "suggested_secondary": suggestion,
        "validation_score": round(validation_score, 3),
        "validation_label": primary.validation_evidence.get("label", "limited"),
        "findings": findings,
        "warnings": warnings,
        "interpretation": "Compatibility is based on primary host species, secondary target species, isotype/conjugate hints, WB application evidence, ECL suitability, and clone/manufacturer validation signals. Citation counts are page-text signals, not a full PubMed systematic review.",
    }
