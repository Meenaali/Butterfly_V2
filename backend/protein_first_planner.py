from __future__ import annotations

import json
import os
from typing import Any
from urllib.request import Request, urlopen

from .rag_assistant import retrieve_supporting_chunks


OPENAI_API_KEY = os.environ.get("OPENAI_API_KEY")
OPENAI_TEXT_MODEL = os.environ.get("OPENAI_TEXT_MODEL", "gpt-4.1-mini")


def _infer_primary_type(experiment: dict[str, Any]) -> str:
    explicit = (experiment.get("primary_type") or "").strip().lower()
    if explicit:
        return explicit
    label = f"{experiment.get('primary_target') or ''} {experiment.get('protein_name') or ''}".lower()
    if "phospho" in label or "p-" in label:
        return "phospho"
    return "total"


def _target_size(protein_intelligence: dict[str, Any], experiment: dict[str, Any]) -> float | None:
    chemistry = (protein_intelligence or {}).get("chemistry", {})
    for value in (chemistry.get("molecular_weight_kda"), experiment.get("protein_size_kda")):
        if isinstance(value, (int, float)):
            return float(value)
        if isinstance(value, str):
            try:
                return float(value)
            except ValueError:
                continue
    return None


def _similar_mw_risks(experiment: dict[str, Any], protein_intelligence: dict[str, Any]) -> list[dict[str, Any]]:
    chemistry = (protein_intelligence or {}).get("chemistry", {})
    uniprot = (protein_intelligence or {}).get("uniprot", {})
    feature_counts = (protein_intelligence or {}).get("ebi_features", {}).get("counts", {})
    keywords = [str(item).lower() for item in (uniprot.get("keywords") or [])]
    expression_system = (experiment.get("expression_system") or "cell lysate").strip()
    target_size = _target_size(protein_intelligence, experiment)
    if target_size is None:
        size_window = "the expected target region"
    else:
        lower = max(target_size - max(5.0, target_size * 0.08), 0.0)
        upper = target_size + max(5.0, target_size * 0.08)
        size_window = f"roughly {round(lower)} to {round(upper)} kDa"

    risks = list((protein_intelligence or {}).get("band_risks") or [])

    if feature_counts.get("SIGNAL", 0) or feature_counts.get("PROPEP", 0) or feature_counts.get("PEPTIDE", 0):
        risks.append(
            {
                "type": "mature_form_shift",
                "title": "Mature versus precursor band risk",
                "detail": f"In {expression_system}, precursor and mature processed forms may both appear around {size_window}, so the antibody epitope should be checked against both full-length and processed products.",
            }
        )

    if any(keyword in " ".join(keywords) for keyword in ["glycoprotein", "glycosylation", "secreted", "membrane"]):
        risks.append(
            {
                "type": "ptm_shift",
                "title": "Post-translational mobility-shift risk",
                "detail": f"Glycosylation or trafficking-related processing could create closely spaced bands near {size_window}, especially in lysate or overexpression systems where maturation states differ.",
            }
        )

    if chemistry.get("aggregation_risk") in {"moderate", "high"}:
        risks.append(
            {
                "type": "aggregate_fragment_overlap",
                "title": "Aggregate or fragment overlap risk",
                "detail": f"When aggregation risk is not low, partial degradation or incompletely denatured species can sit in the same apparent molecular-weight neighbourhood as the main target in {expression_system}.",
            }
        )

    if feature_counts.get("DOMAIN", 0) > 1:
        risks.append(
            {
                "type": "stable_fragment_overlap",
                "title": "Stable domain-fragment overlap risk",
                "detail": f"Multi-domain proteins can generate stable fragments that stay close enough to {size_window} to be mistaken for the intended band unless the antibody epitope is well mapped.",
            }
        )

    deduped: list[dict[str, Any]] = []
    seen = set()
    for item in risks:
        key = (item.get("type"), item.get("title"), item.get("detail"))
        if key in seen:
            continue
        seen.add(key)
        deduped.append(item)
    return deduped[:6]


def _fallback_plan(experiment: dict[str, Any], protein_intelligence: dict[str, Any], retrieved_chunks: list[dict[str, Any]]) -> dict[str, Any]:
    chemistry = (protein_intelligence or {}).get("chemistry", {})
    band_risks = _similar_mw_risks(experiment, protein_intelligence)
    target = experiment.get("primary_target") or experiment.get("protein_name") or "target protein"
    size = _target_size(protein_intelligence, experiment) or "unknown"
    primary_type = _infer_primary_type(experiment)
    hydrophobic = (chemistry.get("hydrophobic_domain_count") or 0) > 0 or chemistry.get("membrane_retention_risk") == "high"
    large = isinstance(size, (int, float)) and size >= 110
    small = isinstance(size, (int, float)) and size <= 25

    gel = "10%"
    if isinstance(size, (int, float)):
        if size >= 150:
            gel = "6%"
        elif size >= 100:
            gel = "7.5%"
        elif size >= 60:
            gel = "8%"
        elif size >= 35:
            gel = "10%"
        elif size >= 20:
            gel = "12%"
        else:
            gel = "15%"

    membrane = "PVDF" if hydrophobic else "Nitrocellulose"
    transfer_mode = "Wet transfer" if hydrophobic or large else "Semi-dry transfer" if small else "Wet transfer"
    blocker = "2% to 3% BSA" if primary_type == "phospho" else "3% milk"
    wash = "3 x 5 to 7 min TBST" if primary_type == "phospho" else "3 x 5 to 10 min TBST"
    detection = "High-sensitivity ECL" if (experiment.get("target_abundance_class") or "").lower() in {"low", "very low"} else "Standard ECL"
    load = "15 to 20 ug/lane" if detection == "High-sensitivity ECL" else "8 to 15 ug/lane"

    risks = [
        "Band identity ambiguity should be checked against the expected molecular-weight window before changing the whole protocol.",
    ]
    for item in band_risks:
        risks.append(item["detail"])
    if chemistry.get("aggregation_risk") in {"moderate", "high"}:
        risks.append("Aggregation risk is not low, so denaturation and sample preparation are likely to matter as much as antibody conditions.")
    if hydrophobic:
        risks.append("Hydrophobic or membrane-associated character raises the risk of under-transfer and patchy membrane recovery.")

    protocol = [
        f"Run {gel} SDS-PAGE as the first-pass gel choice for an expected size around {size} kDa.",
        f"Transfer to {membrane} using {transfer_mode.lower()} as the first-pass hardware choice.",
        f"Block in {blocker} and start with {wash}.",
        f"Start detection with {detection} and keep first exposures short.",
        f"Load approximately {load} unless you already know the target is unusually abundant.",
    ]
    if transfer_mode == "Wet transfer":
        protocol.append("Prioritise careful sandwich assembly, cooling, and bubble-free contact before changing current aggressively.")
    if primary_type == "phospho":
        protocol.append("Treat phospho background as a blocker/wash problem before assuming the antibody concentration is wrong.")

    next_tests = [
        "Run the first blot without complex optimisation ladders; change one major variable at a time after seeing the first result.",
        "If signal is weak, increase detection sensitivity or improve transfer before sharply increasing primary concentration.",
        "If background is high, reduce secondary concentration and tighten washing before redesigning the whole method.",
    ]

    if retrieved_chunks:
        next_tests.append(f"Butterfly also retrieved supporting protocol knowledge from: {', '.join(chunk['title'] for chunk in retrieved_chunks[:3])}.")

    return {
        "summary": f"Best starting strategy for {target}: Butterfly recommends a protein-led first blot to reduce unnecessary optimisation before the first run.",
        "best_plan": protocol,
        "why": [
            f"The expected target size is around {size} kDa.",
            f"Primary-context inference suggests a {primary_type} workflow.",
            f"Predicted membrane-retention risk is {chemistry.get('membrane_retention_risk', 'unknown')} and aggregation risk is {chemistry.get('aggregation_risk', 'unknown')}.",
        ],
        "predicted_risks": risks[:6],
        "confounding_bands": band_risks[:5],
        "first_three_changes": next_tests[:4],
        "mode": "fallback-protein-plan",
    }


def generate_protein_first_plan(experiment: dict[str, Any], protein_intelligence: dict[str, Any], antibody_compatibility: dict[str, Any] | None = None) -> dict[str, Any]:
    retrieved_chunks = retrieve_supporting_chunks(
        question="best starting western blot protocol plan for this protein",
        experiment=experiment,
        protein_intelligence=protein_intelligence,
    )

    return _fallback_plan(experiment, protein_intelligence, retrieved_chunks)

    payload = {
        "question": "Generate the best first-pass Western blot strategy from the protein itself, with minimal user burden.",
        "experiment": experiment,
        "protein_intelligence": protein_intelligence,
        "antibody_compatibility": antibody_compatibility or {},
        "retrieved_protocol_knowledge": retrieved_chunks,
        "confounding_band_risks": _similar_mw_risks(experiment, protein_intelligence),
        "response_format": {
            "summary": "short overview",
            "best_plan": ["ordered methodological steps"],
            "why": ["reasoning bullets"],
            "predicted_risks": ["main risks"],
            "confounding_bands": [{"type": "risk type", "title": "label", "detail": "explanation"}],
            "first_three_changes": ["what to change first if the first blot is not ideal"],
        },
    }

    request_body = {
        "model": OPENAI_TEXT_MODEL,
        "input": [
            {
                "role": "system",
                "content": [
                    {
                        "type": "input_text",
                        "text": (
                            "You are Butterfly, an expert protein-first Western blot planning assistant. "
                            "Your job is to reduce unnecessary optimisation studies by proposing the best first-pass method from protein information alone. "
                            "Prioritise a student-friendly first protocol, explain likely confounding bands near the expected molecular-weight window, "
                            "and explicitly consider isoforms, processed forms, PTM-shifted species, and stable fragments that could appear in lysate or overexpression systems. "
                            "Return valid JSON only with keys summary, best_plan, why, predicted_risks, confounding_bands, first_three_changes."
                        ),
                    }
                ],
            },
            {
                "role": "user",
                "content": [{"type": "input_text", "text": json.dumps(payload)}],
            },
        ],
    }

    try:
        request = Request(
            "https://api.openai.com/v1/responses",
            data=json.dumps(request_body).encode("utf-8"),
            headers={
                "Content-Type": "application/json",
                "Authorization": f"Bearer {OPENAI_API_KEY}",
            },
            method="POST",
        )
        with urlopen(request, timeout=60) as response:  # noqa: S310
            api_payload = json.loads(response.read().decode("utf-8"))

        output_text = ""
        for item in api_payload.get("output", []):
            for content in item.get("content", []):
                if content.get("type") in {"output_text", "text"} and content.get("text"):
                    output_text += content["text"]

        try:
            parsed = json.loads(output_text)
        except json.JSONDecodeError:
            parsed = _fallback_plan(experiment, protein_intelligence, retrieved_chunks)
            parsed["summary"] = output_text.strip() or parsed["summary"]

        parsed["mode"] = "openai-protein-plan"
        return parsed
    except Exception as exc:  # pragma: no cover - network dependent
        parsed = _fallback_plan(experiment, protein_intelligence, retrieved_chunks)
        parsed["summary"] = (
            "Butterfly returned a protein-led predictive model based on the available protein evidence."
        )
        parsed["predicted_risks"] = parsed.get("predicted_risks", [])[:6]
        parsed["mode"] = "openai-fallback-protein-plan"
        return parsed
