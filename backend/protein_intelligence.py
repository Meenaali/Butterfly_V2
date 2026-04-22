from __future__ import annotations

import json
import re
from dataclasses import dataclass
from typing import Any
from urllib.parse import quote
from urllib.request import Request, urlopen


UNIPROT_BASE = "https://rest.uniprot.org"
ALPHAFOLD_BASE = "https://alphafold.ebi.ac.uk"
EBI_PROTEINS_BASE = "https://www.ebi.ac.uk/proteins/api"


@dataclass
class ProteinIntelligenceResult:
    resolved_accession: str | None
    query_strategy: str
    uniprot: dict[str, Any]
    alphafold: dict[str, Any]
    ebi_features: dict[str, Any]
    chemistry: dict[str, Any]
    predictions: list[str]
    buffer_recommendations: list[str]
    caveats: list[str]


def _get_json(url: str, accept: str = "application/json") -> Any:
    request = Request(url, headers={"Accept": accept, "User-Agent": "Butterfly/0.1"})
    with urlopen(request, timeout=20) as response:  # noqa: S310
        return json.loads(response.read().decode("utf-8"))


def _safe_get(mapping: dict[str, Any], *path: str) -> Any:
    current: Any = mapping
    for segment in path:
        if not isinstance(current, dict):
            return None
        current = current.get(segment)
    return current


def resolve_uniprot_accession(uniprot_id: str | None, protein_name: str | None, organism_name: str | None) -> tuple[str | None, str]:
    if uniprot_id:
        return uniprot_id.strip().upper(), "direct UniProt accession"

    if not protein_name:
        return None, "sequence-only"

    query_parts = [protein_name.strip()]
    if organism_name:
        query_parts.append(f' AND organism_name:"{organism_name.strip()}"')

    url = f"{UNIPROT_BASE}/uniprotkb/search?query={quote(''.join(query_parts))}&format=json&size=1"
    payload = _get_json(url)
    results = payload.get("results", [])
    if not results:
        return None, "name search with no UniProt hit"
    return results[0].get("primaryAccession"), "UniProt name search"


def fetch_uniprot_entry(accession: str) -> dict[str, Any]:
    return _get_json(f"{UNIPROT_BASE}/uniprotkb/{accession}.json")


def fetch_alphafold_prediction(accession: str) -> list[dict[str, Any]]:
    return _get_json(f"{ALPHAFOLD_BASE}/api/prediction/{accession}")


def fetch_ebi_features(accession: str) -> dict[str, Any]:
    return _get_json(f"{EBI_PROTEINS_BASE}/features/{accession}")


def molecular_weight_kda(sequence: str) -> float:
    aa_weights = {
        "A": 89.09, "R": 174.2, "N": 132.12, "D": 133.1, "C": 121.15,
        "E": 147.13, "Q": 146.15, "G": 75.07, "H": 155.16, "I": 131.17,
        "L": 131.17, "K": 146.19, "M": 149.21, "F": 165.19, "P": 115.13,
        "S": 105.09, "T": 119.12, "W": 204.23, "Y": 181.19, "V": 117.15,
    }
    if not sequence:
        return 0.0
    total = sum(aa_weights.get(residue, 110.0) for residue in sequence) - (len(sequence) - 1) * 18.015
    return total / 1000.0


def theoretical_pI(sequence: str) -> float:
    if not sequence:
        return 7.0

    pka = {
        "Cterm": 3.1,
        "Nterm": 8.0,
        "C": 8.5,
        "D": 3.9,
        "E": 4.1,
        "H": 6.5,
        "K": 10.8,
        "R": 12.5,
        "Y": 10.1,
    }

    counts = {aa: sequence.count(aa) for aa in "CDEHKRY"}

    def net_charge(ph: float) -> float:
        positive = (1 / (1 + 10 ** (ph - pka["Nterm"])))
        positive += counts["H"] / (1 + 10 ** (ph - pka["H"]))
        positive += counts["K"] / (1 + 10 ** (ph - pka["K"]))
        positive += counts["R"] / (1 + 10 ** (ph - pka["R"]))

        negative = (1 / (1 + 10 ** (pka["Cterm"] - ph)))
        negative += counts["D"] / (1 + 10 ** (pka["D"] - ph))
        negative += counts["E"] / (1 + 10 ** (pka["E"] - ph))
        negative += counts["C"] / (1 + 10 ** (pka["C"] - ph))
        negative += counts["Y"] / (1 + 10 ** (pka["Y"] - ph))
        return positive - negative

    low = 0.0
    high = 14.0
    for _ in range(60):
        mid = (low + high) / 2
        if net_charge(mid) > 0:
            low = mid
        else:
            high = mid
    return (low + high) / 2


def hydrophobic_fraction(sequence: str) -> float:
    hydrophobic = set("AILMFWYV")
    if not sequence:
        return 0.0
    return sum(1 for residue in sequence if residue in hydrophobic) / len(sequence)


def normalize_protein_sequence(raw_sequence: str | None) -> str:
    if not raw_sequence:
        return ""

    sequence_lines = []
    for line in raw_sequence.splitlines():
        stripped = line.strip()
        if stripped and not stripped.startswith(">"):
            sequence_lines.append(stripped)

    sequence = "".join(sequence_lines).upper()
    return re.sub(r"[^ACDEFGHIKLMNPQRSTVWY]", "", sequence)


def longest_hydrophobic_run(sequence: str) -> int:
    hydrophobic = set("AILMFWYV")
    longest = 0
    current = 0
    for residue in sequence:
        if residue in hydrophobic:
            current += 1
            longest = max(longest, current)
        else:
            current = 0
    return longest


def hydrophobic_window_count(sequence: str, window: int = 19, threshold: float = 0.58) -> int:
    if len(sequence) < window:
        return 0

    hydrophobic = set("AILMFWYV")
    count = 0
    for index in range(0, len(sequence) - window + 1):
        fragment = sequence[index : index + window]
        fraction = sum(1 for residue in fragment if residue in hydrophobic) / window
        if fraction >= threshold:
            count += 1
    return count


def predicted_cleavage_motifs(sequence: str) -> dict[str, int]:
    if not sequence:
        return {"furin_like": 0, "dibasic": 0, "acid_labile_dp": 0}

    return {
        "furin_like": len(re.findall(r"R.[KR]R", sequence)),
        "dibasic": len(re.findall(r"[KR]{2,}", sequence)),
        "acid_labile_dp": len(re.findall(r"DP", sequence)),
    }


def classify_risk(score: float) -> str:
    if score >= 0.7:
        return "high"
    if score >= 0.4:
        return "moderate"
    return "low"


def _feature_summary(feature_payload: dict[str, Any]) -> dict[str, Any]:
    features = feature_payload.get("features", [])
    counts: dict[str, int] = {}
    examples = []
    for feature in features:
        feature_type = feature.get("type", "UNKNOWN")
        counts[feature_type] = counts.get(feature_type, 0) + 1
        if len(examples) < 8 and feature_type in {"TRANSMEM", "INTRAMEM", "SIGNAL", "DOMAIN", "DNA_BIND", "TOPO_DOM", "REGION"}:
            examples.append(
                {
                    "type": feature_type,
                    "begin": feature.get("begin"),
                    "end": feature.get("end"),
                    "description": feature.get("description") or "",
                }
            )
    return {
        "feature_count": len(features),
        "counts": counts,
        "examples": examples,
    }


def _extract_uniprot_summary(entry: dict[str, Any]) -> dict[str, Any]:
    genes = entry.get("genes", [])
    gene_names = []
    for gene in genes:
        primary = _safe_get(gene, "geneName", "value")
        if primary:
            gene_names.append(primary)

    keywords = [item.get("name") for item in entry.get("keywords", [])[:8] if item.get("name")]
    sequence = _safe_get(entry, "sequence", "value") or ""

    return {
        "accession": entry.get("primaryAccession"),
        "entry_id": entry.get("uniProtkbId"),
        "reviewed": entry.get("entryType"),
        "protein_name": _safe_get(entry, "proteinDescription", "recommendedName", "fullName", "value"),
        "genes": gene_names,
        "organism": _safe_get(entry, "organism", "scientificName"),
        "sequence_length": len(sequence),
        "keywords": keywords,
    }


def _extract_alphafold_summary(predictions: list[dict[str, Any]]) -> dict[str, Any]:
    if not predictions:
        return {"available": False}

    top = predictions[0]
    confidence = float(top.get("globalMetricValue", 0.0))
    if confidence >= 85:
        label = "high"
    elif confidence >= 70:
        label = "moderate"
    else:
        label = "cautious"

    return {
        "available": True,
        "model_id": top.get("modelEntityId"),
        "mean_plddt": confidence,
        "confidence_label": label,
        "fraction_very_high": top.get("fractionPlddtVeryHigh"),
        "fraction_confident": top.get("fractionPlddtConfident"),
        "fraction_low_or_very_low": round(float(top.get("fractionPlddtLow", 0.0)) + float(top.get("fractionPlddtVeryLow", 0.0)), 3),
        "pdb_url": top.get("pdbUrl"),
        "image_url": top.get("paeImageUrl"),
    }


def _chemistry_summary(sequence: str, feature_summary: dict[str, Any]) -> dict[str, Any]:
    p_i = theoretical_pI(sequence)
    hydrophobicity = hydrophobic_fraction(sequence)
    counts = feature_summary.get("counts", {})
    annotated_tm_count = counts.get("TRANSMEM", 0) + counts.get("INTRAMEM", 0)
    hydrophobic_windows = hydrophobic_window_count(sequence)
    hydrophobic_run = longest_hydrophobic_run(sequence)
    cleavage_motifs = predicted_cleavage_motifs(sequence)
    cleavage_feature_count = sum(counts.get(feature_type, 0) for feature_type in ("SIGNAL", "PROPEP", "PEPTIDE", "CHAIN", "TRANSIT"))
    cleavage_site_count = cleavage_feature_count + sum(cleavage_motifs.values())
    hydrophobic_domain_count = max(annotated_tm_count, hydrophobic_windows)

    membrane_score = 0.0
    membrane_score += min(hydrophobicity / 0.5, 1.0) * 0.35
    membrane_score += min(hydrophobic_domain_count / 3, 1.0) * 0.45
    membrane_score += 0.2 if hydrophobic_run >= 12 else 0.0

    aggregation_score = 0.0
    aggregation_score += min(hydrophobicity / 0.48, 1.0) * 0.35
    aggregation_score += min(hydrophobic_domain_count / 3, 1.0) * 0.35
    aggregation_score += 0.15 if p_i >= 8.5 else 0.0
    aggregation_score += 0.15 if len(sequence) >= 900 else 0.0

    return {
        "sequence_length": len(sequence),
        "molecular_weight_kda": round(molecular_weight_kda(sequence), 2),
        "theoretical_pI": round(p_i, 2),
        "hydrophobic_fraction": round(hydrophobicity, 3),
        "longest_hydrophobic_run": hydrophobic_run,
        "hydrophobic_window_count": hydrophobic_windows,
        "hydrophobic_domain_count": hydrophobic_domain_count,
        "transmembrane_count": annotated_tm_count,
        "signal_peptide_count": counts.get("SIGNAL", 0),
        "cleavage_site_count": cleavage_site_count,
        "cleavage_motifs": cleavage_motifs,
        "domain_count": counts.get("DOMAIN", 0),
        "dna_binding_count": counts.get("DNA_BIND", 0),
        "membrane_retention_risk": classify_risk(membrane_score),
        "aggregation_risk": classify_risk(aggregation_score),
    }


def _prediction_text(chemistry: dict[str, Any], alphafold: dict[str, Any], features: dict[str, Any]) -> list[str]:
    predictions = []
    if chemistry["hydrophobic_domain_count"] > 0:
        predictions.append(
            f"Hydrophobic domain signal is {chemistry['membrane_retention_risk']}; this increases the chance the target will retain well on PVDF but may need gentler transfer tuning to avoid poor release from gel or uneven membrane capture."
        )
    if chemistry["signal_peptide_count"] > 0:
        predictions.append("A signal peptide is annotated, which supports secretory-pathway or membrane trafficking context and can influence processing state.")
    if chemistry["cleavage_site_count"] > 0:
        predictions.append("Potential processing or cleavage features are present, so expected band size and antibody epitope position should be checked against the mature protein form, not only the full-length sequence.")
    if chemistry["theoretical_pI"] >= 8.5:
        predictions.append("The protein is predicted to be relatively basic, so preserving denaturation and minimizing aggregation will matter during sample preparation and transfer.")
    elif chemistry["theoretical_pI"] <= 5.5:
        predictions.append("The protein is predicted to be relatively acidic, which supports a standard SDS-PAGE baseline but still needs exposure and transfer tuning by size.")
    if chemistry["hydrophobic_fraction"] >= 0.38:
        predictions.append("Hydrophobic content is elevated, which increases the chance that PVDF and gentler transfer tuning will outperform more aggressive dry conditions.")
    if chemistry["aggregation_risk"] != "low":
        predictions.append(f"Predicted aggregation risk is {chemistry['aggregation_risk']}; sample preparation should prioritise strong denaturation, fresh reducing agent, and avoiding unnecessary concentration steps.")
    if alphafold.get("available"):
        predictions.append(
            f"AlphaFold reports a mean confidence around {alphafold['mean_plddt']}, so structural reasoning is {'useful' if alphafold['confidence_label'] != 'cautious' else 'worth using cautiously'} for planning exposed versus uncertain regions."
        )
    if features.get("counts", {}).get("DOMAIN", 0) > 1:
        predictions.append("Multiple annotated domains are present, so antibody choice should consider which region is stable and likely retained after denaturation.")
    return predictions[:6]


def _buffer_recommendations(chemistry: dict[str, Any]) -> list[str]:
    recommendations = [
        "Use a standard Laemmli sample buffer baseline unless a validated lab-specific system already exists.",
        "Use Tris-glycine-SDS running buffer as the default starting point for the first optimisation pass.",
    ]

    if chemistry["theoretical_pI"] >= 8.5:
        recommendations.append("Because the target is relatively basic, keep sufficient SDS and reducing agent in sample prep and avoid under-denaturing the protein.")
    elif chemistry["theoretical_pI"] <= 5.5:
        recommendations.append("Because the target is relatively acidic, begin with standard running conditions and tune transfer time before changing the gel chemistry.")

    if chemistry["hydrophobic_domain_count"] > 0 or chemistry["hydrophobic_fraction"] >= 0.38:
        recommendations.extend(
            [
                "Prefer PVDF over nitrocellulose as the first membrane choice for a hydrophobic or membrane-associated target.",
                "Start with wet transfer or a gentler semi-dry condition, and consider retaining a small amount of SDS in transfer buffer if recovery is poor.",
            ]
        )
    else:
        recommendations.append("For a non-membrane target, standard transfer buffer without unusual additives is a sensible first pass.")

    if chemistry["molecular_weight_kda"] >= 120:
        recommendations.append("For a large target, favor wet transfer with longer duration and active cooling rather than sharply increasing current.")
    elif chemistry["molecular_weight_kda"] <= 25:
        recommendations.append("For a small target, shorten transfer duration to reduce blow-through and do not over-correct with excessive current.")

    if chemistry["aggregation_risk"] != "low":
        recommendations.append("For predicted aggregation risk, use fresh reducing sample buffer, fully denature before loading, and avoid very high sample concentration unless the target is low abundance.")

    if chemistry["cleavage_site_count"] > 0:
        recommendations.append("For possible cleavage or processing, choose antibodies and expected molecular-weight windows around the mature/processed form as well as full-length protein.")

    return recommendations[:9]


def build_protein_intelligence(
    uniprot_id: str | None,
    protein_name: str | None,
    organism_name: str | None,
    protein_sequence: str | None,
) -> ProteinIntelligenceResult:
    accession, strategy = resolve_uniprot_accession(uniprot_id, protein_name, organism_name)

    uniprot_entry: dict[str, Any] = {}
    alphafold_predictions: list[dict[str, Any]] = []
    ebi_feature_payload: dict[str, Any] = {"features": []}
    caveats = []
    sequence = normalize_protein_sequence(protein_sequence)

    if accession:
        try:
            uniprot_entry = fetch_uniprot_entry(accession)
            if not sequence:
                sequence = _safe_get(uniprot_entry, "sequence", "value") or ""
        except Exception as exc:  # pragma: no cover - network dependent
            caveats.append(f"UniProt lookup failed: {exc}")

        try:
            alphafold_predictions = fetch_alphafold_prediction(accession)
        except Exception as exc:  # pragma: no cover - network dependent
            caveats.append(f"AlphaFold lookup failed: {exc}")

        try:
            ebi_feature_payload = fetch_ebi_features(accession)
        except Exception as exc:  # pragma: no cover - network dependent
            caveats.append(f"EBI Proteins lookup failed: {exc}")
    else:
        caveats.append("No UniProt accession could be resolved, so structural and curated feature lookups are limited.")

    uniprot_summary = _extract_uniprot_summary(uniprot_entry) if uniprot_entry else {
        "accession": accession,
        "entry_id": None,
        "reviewed": None,
        "protein_name": protein_name,
        "genes": [],
        "organism": organism_name,
        "sequence_length": len(sequence),
        "keywords": [],
    }
    feature_summary = _feature_summary(ebi_feature_payload)
    alphafold_summary = _extract_alphafold_summary(alphafold_predictions)
    chemistry = _chemistry_summary(sequence, feature_summary)
    predictions = _prediction_text(chemistry, alphafold_summary, feature_summary)
    buffer_recommendations = _buffer_recommendations(chemistry)

    caveats.append("Structural predictions and curated annotations are planning aids only; denaturing Western blot behavior must still be confirmed experimentally.")

    return ProteinIntelligenceResult(
        resolved_accession=accession,
        query_strategy=strategy,
        uniprot=uniprot_summary,
        alphafold=alphafold_summary,
        ebi_features=feature_summary,
        chemistry=chemistry,
        predictions=predictions,
        buffer_recommendations=buffer_recommendations,
        caveats=caveats,
    )
