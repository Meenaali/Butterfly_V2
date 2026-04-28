from __future__ import annotations

import json
import os
from typing import Any
from urllib.request import Request, urlopen


OPENAI_API_KEY = os.environ.get("OPENAI_API_KEY")
OPENAI_VISION_MODEL = os.environ.get("OPENAI_VISION_MODEL", "gpt-4.1-mini")


def _fallback_interpretation(stage: str, analysis: dict[str, Any], experiment: dict[str, Any]) -> dict[str, Any]:
    target = experiment.get("primary_target") or experiment.get("protein_name") or "target protein"
    expected_size = experiment.get("protein_size_kda") or "unknown"
    lane_count = experiment.get("lane_count") or "unknown"
    flags = []
    causes = []
    next_steps = []
    band_notes = [
        f"Expected target window is approximately {expected_size} kDa, so interpretation should prioritise bands near that molecular-weight region.",
        f"Planned lane count is {lane_count}, so lane-to-lane consistency should be judged against that experimental layout.",
    ]

    saturation = float(analysis.get("saturation_pct") or 0.0)
    background_std = float(analysis.get("background_std") or 0.0)
    contrast = float(analysis.get("contrast") or 0.0)
    lane_variation = float(analysis.get("lane_variation") or 0.0)
    asymmetry = float(analysis.get("asymmetry_score") or 0.0)
    splice_risk = float(analysis.get("splice_risk_score") or 0.0)

    if saturation > 3:
        flags.append("Overexposure or localized saturation")
        causes.append("Exposure time may be too long for the signal intensity.")
        next_steps.append("Re-image with shorter exposures before changing antibody concentration.")
        band_notes.append("Band intensity may look broader or stronger than the true signal because parts of the image appear saturated.")
    if background_std > 28:
        flags.append("Uneven background")
        causes.append("Wash consistency, blocking choice, or membrane handling may be contributing haze.")
        next_steps.append("Increase wash volume and keep the membrane fully wet throughout the workflow.")
    if contrast < 30:
        flags.append("Low contrast")
        causes.append("Target signal may be weak, or the blot may be background-heavy.")
        next_steps.append("Compare short, medium, and long exposures and check transfer quality.")
    if lane_variation > 20:
        flags.append("Lane-to-lane inconsistency")
        causes.append("Loading, transfer contact, or sample viscosity may not be uniform.")
        next_steps.append("Review loading consistency and transfer sandwich assembly.")
        band_notes.append("Lane pattern variation is elevated, so comparative interpretation across conditions should be made cautiously.")
    if asymmetry > 18:
        flags.append("Left-right asymmetry")
        causes.append("Transfer contact, wash agitation, or illumination may be uneven.")
        next_steps.append("Check for edge drying, uneven contact, or asymmetric tray agitation.")
    if splice_risk > 8:
        flags.append("Image integrity review advised")
        causes.append("Abrupt row-to-row changes can reflect strong local edits or imaging artefacts.")
        next_steps.append("Interpret against the uncropped original image before drawing conclusions.")

    if not flags:
        flags.append("No major heuristic red flags detected")
        causes.append("The uploaded image looks broadly interpretable from simple image metrics.")
        next_steps.append("Use the image together with protein chemistry and antibody evidence to refine the next run.")

    return {
        "summary": f"Fallback AI interpretation for the {stage} image: Butterfly sees a generally interpretable blot for {target} with {len(flags)} notable quality cue(s).",
        "band_interpretation": [
            f"This {stage} image is being interpreted using Butterfly's local image heuristics because no multimodal API key is configured.",
            *band_notes,
            "Use a live multimodal model to get richer band-pattern interpretation, potential band identity reasoning, and more natural language review.",
        ],
        "quality_flags": flags[:6],
        "possible_causes": causes[:6],
        "next_steps": next_steps[:6],
        "confidence": "Heuristic fallback only",
        "source": "fallback",
    }


def _extract_text_output(payload: dict[str, Any]) -> str:
    output = payload.get("output", [])
    text_chunks: list[str] = []
    for item in output:
        for content in item.get("content", []):
            if content.get("type") in {"output_text", "text"} and content.get("text"):
                text_chunks.append(content["text"])
    return "\n".join(text_chunks).strip()


def interpret_blot_image(
    stage: str,
    image_base64: str,
    analysis: dict[str, Any],
    experiment: dict[str, Any],
    protein_intelligence: dict[str, Any] | None,
    antibody_compatibility: dict[str, Any] | None,
) -> dict[str, Any]:
    if not OPENAI_API_KEY:
        return _fallback_interpretation(stage, analysis, experiment)

    protein_context = protein_intelligence or {}
    antibody_context = antibody_compatibility or {}
    prompt = {
        "task": "Interpret a Western blot or blot-adjacent image for troubleshooting support.",
        "stage": stage,
        "target_protein": experiment.get("protein_name"),
        "primary_target": experiment.get("primary_target"),
        "antibody_type": experiment.get("primary_type"),
        "detection_method": experiment.get("detection_method"),
        "target_abundance": experiment.get("target_abundance_class"),
        "lane_count": experiment.get("lane_count"),
        "expected_target_size_kda": experiment.get("protein_size_kda"),
        "image_metrics": analysis,
        "protein_chemistry": protein_context.get("chemistry", {}),
        "antibody_validation": {
            "compatibility_score": antibody_context.get("score"),
            "validation_score": antibody_context.get("validation_score"),
            "validation_label": antibody_context.get("validation_label"),
        },
        "response_format": {
            "summary": "short natural-language interpretation",
            "band_interpretation": ["list", "of", "band-pattern", "observations"],
            "quality_flags": ["list", "of", "quality", "issues"],
            "possible_causes": ["list", "of", "likely", "causes"],
            "next_steps": ["list", "of", "practical", "actions"],
            "confidence": "one short phrase",
        },
    }

    request_body = {
        "model": OPENAI_VISION_MODEL,
        "input": [
            {
                "role": "system",
                "content": [
                    {
                        "type": "input_text",
                        "text": (
                            "You are Butterfly, an expert Western blot troubleshooting assistant. "
                            "Return valid JSON only, with keys summary, band_interpretation, quality_flags, possible_causes, next_steps, confidence. "
                            "Be careful, practical, and avoid overstating certainty."
                        ),
                    }
                ],
            },
            {
                "role": "user",
                "content": [
                    {"type": "input_text", "text": json.dumps(prompt)},
                    {"type": "input_image", "image_url": f"data:image/png;base64,{image_base64}"},
                ],
            },
        ],
    }

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
        payload = json.loads(response.read().decode("utf-8"))

    output_text = _extract_text_output(payload)
    try:
        parsed = json.loads(output_text)
    except json.JSONDecodeError:
        parsed = {
            "summary": output_text or "AI interpretation returned an unstructured response.",
            "band_interpretation": [],
            "quality_flags": [],
            "possible_causes": [],
            "next_steps": [],
            "confidence": "Model response could not be fully parsed",
        }

    parsed["source"] = "openai"
    parsed["model"] = OPENAI_VISION_MODEL
    return parsed
