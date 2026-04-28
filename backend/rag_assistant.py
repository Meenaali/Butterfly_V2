from __future__ import annotations

import json
import os
import re
from typing import Any
from urllib.request import Request, urlopen

from .documents import load_indexed_chunks
from .vector_store import index_chunks, semantic_search

OPENAI_API_KEY = os.environ.get("OPENAI_API_KEY")
OPENAI_TEXT_MODEL = os.environ.get("OPENAI_TEXT_MODEL", "gpt-4.1-mini")


KNOWLEDGE_BASE = [
    {
        "id": "blocking-phospho",
        "title": "Blocking choice for phospho targets",
        "text": "Phospho-specific antibodies often behave more cleanly with BSA than milk because milk contains casein and other phosphoprotein-like components that can increase background or apparent competition.",
    },
    {
        "id": "background-washing",
        "title": "High background troubleshooting",
        "text": "High background is commonly driven by excessive secondary concentration, insufficient wash volume or duration, blocker mismatch, membrane drying, or exposure settings that reveal nonspecific haze.",
    },
    {
        "id": "smearing-sampleprep",
        "title": "Smearing troubleshooting",
        "text": "Smearing is often caused by sample overload, incomplete denaturation or reduction, salt or nucleic acid contamination, aggregation-prone protein chemistry, or gel percentage mismatch.",
    },
    {
        "id": "weaksignal-transfer",
        "title": "Weak signal troubleshooting",
        "text": "Weak signal can reflect poor transfer, low abundance, overly harsh washing, low-affinity antibody, insufficient exposure, or an epitope that is not well preserved after denaturation.",
    },
    {
        "id": "ghostbands-controls",
        "title": "Ghost and nonspecific bands",
        "text": "Ghost bands and unexpected bands should be separated using no-primary controls, positive and negative control lysates, clone-validation review, and careful comparison against predicted cleavage or processed forms.",
    },
    {
        "id": "hydrophobic-transfer",
        "title": "Hydrophobic or membrane proteins",
        "text": "Hydrophobic or membrane-associated proteins often transfer more reliably to PVDF and may benefit from gentler wet transfer conditions, strong denaturation, and careful interpretation of weak or uneven recovery.",
    },
    {
        "id": "integrity-imaging",
        "title": "Image integrity and exposure",
        "text": "Saturation, clipping, asymmetric illumination, and abrupt discontinuities can make blot interpretation unreliable. Re-image from the uncropped original before changing wet-lab conditions aggressively.",
    },
]


def _seed_builtin_knowledge() -> None:
    chunks = []
    for chunk in KNOWLEDGE_BASE:
        chunks.append(
            {
                "id": chunk["id"],
                "title": chunk["title"],
                "source_file": chunk["id"],
                "source_kind": "builtin",
                "text": chunk["text"],
            }
        )
    index_chunks(chunks)


def _tokenize(text: str) -> set[str]:
    return set(re.findall(r"[a-z0-9]{3,}", text.lower()))


def _build_context_block(experiment: dict[str, Any], analyses: dict[str, Any], protein_intelligence: dict[str, Any], antibody_compatibility: dict[str, Any]) -> dict[str, Any]:
    chemistry = (protein_intelligence or {}).get("chemistry", {})
    return {
        "protein_name": experiment.get("protein_name"),
        "primary_target": experiment.get("primary_target"),
        "protein_size_kda": experiment.get("protein_size_kda"),
        "lane_count": experiment.get("lane_count"),
        "target_abundance": experiment.get("target_abundance_class"),
        "antibody_type": experiment.get("primary_type"),
        "blocking_reagent": experiment.get("blocking_reagent"),
        "detection_method": experiment.get("detection_method"),
        "transfer_mode": experiment.get("transfer_mode"),
        "membrane_type": experiment.get("membrane_type"),
        "overall_outcome": experiment.get("overall_outcome"),
        "chemistry": {
            "theoretical_pI": chemistry.get("theoretical_pI"),
            "molecular_weight_kda": chemistry.get("molecular_weight_kda"),
            "hydrophobic_domain_count": chemistry.get("hydrophobic_domain_count"),
            "aggregation_risk": chemistry.get("aggregation_risk"),
            "membrane_retention_risk": chemistry.get("membrane_retention_risk"),
            "cleavage_site_count": chemistry.get("cleavage_site_count"),
        },
        "antibody_validation": {
            "compatibility_score": (antibody_compatibility or {}).get("score"),
            "validation_score": (antibody_compatibility or {}).get("validation_score"),
            "validation_label": (antibody_compatibility or {}).get("validation_label"),
        },
        "image_metrics": analyses or {},
    }


def _retrieve_chunks(question: str, experiment: dict[str, Any], protein_intelligence: dict[str, Any]) -> list[dict[str, Any]]:
    _seed_builtin_knowledge()
    query_terms = _tokenize(question)
    chemistry = (protein_intelligence or {}).get("chemistry", {})
    if (experiment.get("primary_type") or "") == "phospho":
        query_terms.update({"phospho", "blocking", "bsa", "milk"})
    if chemistry.get("hydrophobic_domain_count"):
        query_terms.update({"hydrophobic", "transfer", "pvdf", "membrane"})
    if chemistry.get("aggregation_risk") in {"moderate", "high"}:
        query_terms.update({"aggregation", "smearing", "sample", "denaturation"})

    semantic_chunks = semantic_search(question, n_results=4)
    scored = []
    for chunk in KNOWLEDGE_BASE + load_indexed_chunks():
        text_terms = _tokenize(chunk["title"] + " " + chunk["text"])
        overlap = len(query_terms & text_terms)
        if overlap:
            scored.append((overlap, chunk))
    scored.sort(key=lambda item: item[0], reverse=True)
    lexical_chunks = [chunk for _, chunk in scored[:4]]

    merged = []
    seen = set()
    for chunk in semantic_chunks + lexical_chunks:
        key = (chunk.get("title"), chunk.get("text"))
        if key in seen:
            continue
        seen.add(key)
        merged.append(chunk)
    return merged[:6]


def retrieve_supporting_chunks(question: str, experiment: dict[str, Any], protein_intelligence: dict[str, Any]) -> list[dict[str, Any]]:
    return _retrieve_chunks(question, experiment, protein_intelligence)


def _fallback_answer(question: str, chunks: list[dict[str, Any]], context: dict[str, Any]) -> dict[str, Any]:
    target = context.get("primary_target") or context.get("protein_name") or "your target"
    size = context.get("protein_size_kda") or context.get("chemistry", {}).get("molecular_weight_kda") or "unknown"
    titles = [chunk["title"] for chunk in chunks]
    answer_lines = [
        f"Butterfly's grounded answer for {target}:",
        f"The expected target size is around {size} kDa, so any troubleshooting should be compared against that band window first.",
    ]
    if titles:
        answer_lines.append(f"I based this on retrieved troubleshooting themes: {', '.join(titles)}.")
    for chunk in chunks[:3]:
        answer_lines.append(chunk["text"])

    return {
        "answer": " ".join(answer_lines),
        "citations": [{"title": chunk["title"], "text": chunk["text"]} for chunk in chunks],
        "mode": "fallback-rag",
    }


def ask_butterfly(question: str, experiment: dict[str, Any], analyses: dict[str, Any], protein_intelligence: dict[str, Any], antibody_compatibility: dict[str, Any]) -> dict[str, Any]:
    context = _build_context_block(experiment, analyses, protein_intelligence, antibody_compatibility)
    chunks = _retrieve_chunks(question, experiment, protein_intelligence)

    if not OPENAI_API_KEY:
        return _fallback_answer(question, chunks, context)

    request_body = {
        "model": OPENAI_TEXT_MODEL,
        "input": [
            {
                "role": "system",
                "content": [
                    {
                        "type": "input_text",
                        "text": (
                            "You are Butterfly, a grounded Western blot troubleshooting assistant. "
                            "Answer only from the supplied context and retrieved snippets. "
                            "Be concise, practical, and explicit when you are inferring."
                        ),
                    }
                ],
            },
            {
                "role": "user",
                "content": [
                    {
                        "type": "input_text",
                        "text": json.dumps(
                            {
                                "question": question,
                                "experiment_context": context,
                                "retrieved_chunks": chunks,
                                "response_format": {
                                    "answer": "short grounded answer",
                                    "citations": [{"title": "source title", "text": "short supporting snippet"}],
                                },
                            }
                        ),
                    }
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

    output_text = ""
    for item in payload.get("output", []):
        for content in item.get("content", []):
            if content.get("type") in {"output_text", "text"} and content.get("text"):
                output_text += content["text"]

    try:
        parsed = json.loads(output_text)
    except json.JSONDecodeError:
        parsed = {"answer": output_text.strip(), "citations": [{"title": chunk["title"], "text": chunk["text"]} for chunk in chunks[:3]]}

    parsed["mode"] = "openai-rag"
    return parsed
