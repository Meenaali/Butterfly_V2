from __future__ import annotations

from dataclasses import dataclass
from typing import Any


@dataclass
class TroubleshootingResult:
    symptom: str
    summary: str
    likely_causes: list[str]
    decision_tree: list[str]
    immediate_fixes: list[str]
    next_run_plan: list[str]
    evidence_tools: list[dict[str, str]]


def _normalise_symptom(value: str | None) -> str:
    symptom = (value or "").strip().lower()
    if symptom in {"ghost bands", "high background", "weak signal", "no signal", "non-specific bands", "smearing"}:
        return symptom
    return "high background"


def _abundance(experiment: dict[str, Any]) -> str:
    return (experiment.get("target_abundance_class") or "moderate").strip().lower()


def _antibody_type(experiment: dict[str, Any]) -> str:
    target = f"{experiment.get('primary_target') or ''} {experiment.get('protein_name') or ''}".lower()
    explicit = (experiment.get("primary_type") or "").strip().lower()
    if explicit:
        return explicit
    if "phospho" in target or "p-" in target:
        return "phospho"
    return "total"


def _chemistry_context(protein_intelligence: dict[str, Any]) -> dict[str, Any]:
    return protein_intelligence.get("chemistry") or {}


def _evidence_tools(experiment: dict[str, Any]) -> list[dict[str, str]]:
    target = experiment.get("primary_target") or experiment.get("protein_name") or "target protein"
    supplier = experiment.get("primary_company") or "supplier"
    clone = experiment.get("primary_clone") or experiment.get("primary_url") or "clone/catalog"
    return [
        {
            "name": "EXPASY ProtParam / ProtScale",
            "use": "Cross-check pI, hydrophobicity, instability and GRAVY-style chemistry for transfer/blocking risk.",
            "url": "https://web.expasy.org/protparam/",
        },
        {
            "name": "CiteAb",
            "use": f"Search {target}, {supplier}, and {clone} to compare citation-backed antibody use, WB application, host species and reactivity.",
            "url": "https://www.citeab.com/",
        },
        {
            "name": "BenchSci / ASCEND",
            "use": f"Use institutional access to review figure-level antibody evidence for {target}, especially WB images, sample context and validation pillars.",
            "url": "https://www.benchsci.com/",
        },
    ]


def build_troubleshooting_plan(
    symptom: str | None,
    experiment: dict[str, Any],
    analyses: dict[str, Any] | None,
    protein_intelligence: dict[str, Any] | None,
    antibody_compatibility: dict[str, Any] | None,
) -> TroubleshootingResult:
    selected = _normalise_symptom(symptom)
    abundance = _abundance(experiment)
    antibody_type = _antibody_type(experiment)
    chemistry = _chemistry_context(protein_intelligence or {})
    compatibility_score = float((antibody_compatibility or {}).get("score") or 0.0)
    validation_score = float((antibody_compatibility or {}).get("validation_score") or 0.0)
    aggregation_risk = chemistry.get("aggregation_risk", "unknown")
    membrane_risk = chemistry.get("membrane_retention_risk", "unknown")
    hydrophobic_domains = chemistry.get("hydrophobic_domain_count", 0)
    image_analyses = analyses or {}
    gel_analysis = image_analyses.get("gel") or {}
    transfer_analysis = image_analyses.get("transfer") or {}
    final_analysis = image_analyses.get("final") or {}

    likely_causes: list[str] = []
    decision_tree: list[str] = []
    immediate_fixes: list[str] = []
    next_run_plan: list[str] = []

    if selected == "ghost bands":
        likely_causes.extend(
            [
                "Residual primary or secondary antibody binding to old target, degradation fragments, or processed isoforms.",
                "Over-concentrated primary antibody, especially when the target is high abundance.",
                "Cross-reactivity from insufficient antibody validation or a secondary that recognises unintended Ig species.",
            ]
        )
        decision_tree.extend(
            [
                "If ghost bands match predicted cleavage/processed sizes, check UniProt/EMBL-EBI feature annotations before changing the whole method.",
                "If bands disappear in the no-primary control, suspect the primary antibody or antigen processing.",
                "If bands remain in the no-primary control, suspect secondary antibody, blocker, membrane contamination, or substrate carryover.",
            ]
        )
        immediate_fixes.extend(
            [
                "Run a no-primary secondary-only control on the next blot.",
                "Reduce primary concentration one step before increasing wash harshness.",
                "Use fresh blocking buffer and avoid reusing antibody if ghosting appears after repeated incubations.",
            ]
        )
        next_run_plan.extend(
            [
                "Test primary dilution ladder: current, 2x more dilute, and 4x more dilute.",
                "Keep transfer and exposure constant so the antibody variable is interpretable.",
                "Compare expected full-length band with predicted processed/degradation-size windows.",
            ]
        )
    elif selected == "high background":
        likely_causes.extend(
            [
                "Secondary antibody too concentrated or insufficient washing.",
                "Blocker mismatch with antibody biology, especially milk with phospho-specific antibodies.",
                "High-sensitivity ECL or long exposure revealing low-level nonspecific binding.",
            ]
        )
        decision_tree.extend(
            [
                "If the whole membrane is hazy, change blocker/washes/secondary before changing transfer.",
                "If only lanes are dirty, suspect sample load, viscosity, salt, or overloaded target.",
                "If background is speckled, suspect particulates, dry membrane spots, dirty trays, or precipitated antibody.",
            ]
        )
        immediate_fixes.extend(
            [
                "Increase wash volume and use 4 x 8 to 10 minutes TBST before changing multiple variables.",
                "Dilute secondary one step further and shorten exposure.",
                "For phospho targets, switch from milk to BSA because milk can contribute phosphoprotein-related background.",
            ]
        )
        next_run_plan.extend(
            [
                "Run blocker comparison: BSA versus milk while keeping antibody concentrations fixed.",
                "Run secondary-only control if the whole membrane remains bright.",
                "Capture short, medium and long exposures to distinguish real background from imaging saturation.",
            ]
        )
    elif selected in {"weak signal", "no signal"}:
        likely_causes.extend(
            [
                "Insufficient target load, weak antibody affinity, epitope masking, or excessive washing/blocking.",
                "Transfer mismatch for target size or hydrophobicity.",
                "Detection chemistry too insensitive for target abundance.",
            ]
        )
        decision_tree.extend(
            [
                "If total protein transfer looks poor, fix transfer before antibody concentration.",
                "If transfer looks good but target is absent, check antibody validation and sample expression.",
                "If signal appears only at long exposure, improve detection sensitivity before overloading sample.",
            ]
        )
        immediate_fixes.extend(
            [
                "Confirm transfer using total-protein stain or reversible membrane stain.",
                "Reduce wash harshness for the next run if the target is low abundance.",
                "Increase primary concentration only after transfer and antibody validation are plausible.",
            ]
        )
        next_run_plan.extend(
            [
                "Use a positive-control lysate if available.",
                "Compare standard ECL with higher-sensitivity ECL using the same antibody dilution.",
                "For hydrophobic or membrane proteins, prefer PVDF and gentler wet transfer optimisation.",
            ]
        )
    elif selected == "smearing":
        likely_causes.extend(
            [
                "Sample overload, incomplete reduction/denaturation, salt or nucleic acid contamination.",
                "Aggregation-prone protein chemistry or hydrophobic membrane-associated domains.",
                "Gel percentage or running conditions not matched to target size.",
            ]
        )
        decision_tree.extend(
            [
                "If smearing starts in the gel, fix sample prep and loading before changing antibody conditions.",
                "If smearing appears after transfer, check transfer heat, current and membrane contact.",
                "If only the target smears, consider aggregation, PTMs, cleavage, or overloaded target expression.",
            ]
        )
        immediate_fixes.extend(
            [
                "Lower sample load and use fresh reducing Laemmli buffer.",
                "Spin lysate before loading and avoid freeze-thaw debris.",
                "Do not overheat aggregation-prone membrane proteins; compare milder denaturation if appropriate.",
            ]
        )
        next_run_plan.extend(
            [
                "Run a load ladder before changing antibody concentration.",
                "Match gel percentage to target molecular weight.",
                "If aggregation risk is high, prioritise sample prep optimisation over blocking changes.",
            ]
        )
    else:
        likely_causes.extend(
            [
                "Primary antibody concentration too high or insufficiently validated clone.",
                "Antibody recognising related isoforms, degradation fragments, or post-translationally modified species.",
                "Secondary cross-reactivity or species/isotype mismatch.",
            ]
        )
        decision_tree.extend(
            [
                "If extra bands align with known isoforms, validate expected biology before discarding the antibody.",
                "If extra bands occur across all lanes, run no-primary and positive/negative controls.",
                "If extra bands vary by sample, compare expression biology, lysis and degradation risk.",
            ]
        )
        immediate_fixes.extend(
            [
                "Use a stronger wash programme before changing both antibodies at once.",
                "Dilute primary one step and keep secondary constant.",
                "Check clone-specific WB validation in CiteAb or BenchSci if available.",
            ]
        )
        next_run_plan.extend(
            [
                "Run positive and negative control lysates.",
                "Compare clone validation evidence before buying a replacement antibody.",
                "Use peptide competition or knockdown/knockout evidence where feasible.",
            ]
        )

    if antibody_type == "phospho" and selected in {"high background", "ghost bands", "non-specific bands"}:
        likely_causes.append("Phospho-specific workflow risk: milk can add phosphoprotein-related nonspecific signal.")
        immediate_fixes.append("Use BSA as the default phospho-blocker unless the antibody datasheet explicitly validates milk.")

    if abundance in {"high", "very high"} and selected in {"high background", "ghost bands", "smearing"}:
        likely_causes.append("High target abundance or high lane load can make otherwise acceptable antibody conditions look dirty.")
        next_run_plan.append("Add a lower lane-load condition so background and true target signal can be separated.")

    if compatibility_score and compatibility_score < 0.55:
        likely_causes.append("Primary/secondary compatibility score is low, so the troubleshooting priority is antibody pairing.")
        immediate_fixes.append("Resolve host species, isotype and secondary conjugate matching before changing transfer or blocker.")

    if validation_score and validation_score < 0.48:
        likely_causes.append("Primary validation evidence is limited, so clone choice may be a root cause rather than the blot method.")
        next_run_plan.append("Review clone-level evidence in CiteAb/BenchSci or choose an antibody with stronger WB validation.")

    if membrane_risk == "high" or int(hydrophobic_domains or 0) > 0:
        decision_tree.append("Because hydrophobic/membrane-retention risk is elevated, interpret weak or uneven signal together with transfer conditions, not antibody alone.")

    if aggregation_risk in {"moderate", "high"}:
        decision_tree.append("Because aggregation risk is not low, check sample preparation and denaturation before over-adjusting blocking.")

    if gel_analysis:
        lane_variation = float(gel_analysis.get("lane_variation") or 0.0)
        gel_contrast = float(gel_analysis.get("contrast") or 0.0)
        if lane_variation > 20:
            likely_causes.append("Gel image analysis shows elevated lane-to-lane variation, so loading consistency or gel running quality may be part of the symptom.")
            immediate_fixes.append("Repeat with a cleaner loading plan, consistent sample viscosity, and a load ladder before changing antibody conditions.")
        if gel_contrast < 30:
            decision_tree.append("Gel image contrast is low; confirm the upstream sample/gel quality before assuming the blotting chemistry is the main cause.")

    if transfer_analysis:
        transfer_contrast = float(transfer_analysis.get("contrast") or 0.0)
        transfer_variation = float(transfer_analysis.get("lane_variation") or 0.0)
        transfer_edge_delta = float(transfer_analysis.get("edge_delta") or 0.0)
        if transfer_contrast < 35 and selected in {"weak signal", "no signal", "smearing"}:
            likely_causes.append("Transfer image analysis suggests weak transfer contrast, so incomplete transfer may explain the poor blot signal.")
            immediate_fixes.append("Optimise transfer time/contact/cooling before increasing primary antibody concentration.")
        if transfer_variation > 20 or transfer_edge_delta > 18:
            likely_causes.append("Transfer image analysis suggests uneven contact or edge-to-centre drift.")
            next_run_plan.append("Rebuild the transfer sandwich carefully and document cassette pressure, bubble removal, cooling and buffer coverage.")

    if final_analysis:
        saturation = float(final_analysis.get("saturation_pct") or 0.0)
        background_std = float(final_analysis.get("background_std") or 0.0)
        contrast = float(final_analysis.get("contrast") or 0.0)
        asymmetry = float(final_analysis.get("asymmetry_score") or 0.0)
        splice_risk = float(final_analysis.get("splice_risk_score") or 0.0)
        manipulation_risk = float(final_analysis.get("manipulation_risk_score") or 0.0)
        if saturation > 3:
            likely_causes.append("Final image analysis shows saturation, so exposure may be exaggerating bands or hiding true background.")
            immediate_fixes.append("Re-image with shorter exposures before changing the wet-lab method.")
        if background_std > 28:
            likely_causes.append("Final image analysis shows uneven background, supporting a wash/blocking/handling cause.")
            immediate_fixes.append("Increase wash volume and consistency, keep the membrane wet, and filter or freshly prepare antibody/blocking solutions.")
        if contrast < 30 and selected in {"weak signal", "no signal", "high background"}:
            decision_tree.append("Final image contrast is low; separate weak target signal from high background by using short/medium/long exposures and a secondary-only control.")
        if asymmetry > 18:
            likely_causes.append("Final image analysis shows left-right asymmetry, so transfer contact, wash agitation or imaging illumination may be contributing.")
        if splice_risk > 8 or manipulation_risk > 10:
            decision_tree.append("Final image integrity metrics are elevated; troubleshoot using the uncropped original before interpreting subtle band changes.")

    summary = (
        f"For {selected}, Butterfly prioritises the most reversible fixes first: controls, antibody dilution/pairing, blocker choice, washing, exposure, then transfer/sample-prep changes."
    )

    return TroubleshootingResult(
        symptom=selected,
        summary=summary,
        likely_causes=likely_causes[:10],
        decision_tree=decision_tree[:10],
        immediate_fixes=immediate_fixes[:10],
        next_run_plan=next_run_plan[:10],
        evidence_tools=_evidence_tools(experiment),
    )
