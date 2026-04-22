from __future__ import annotations

from dataclasses import dataclass
from typing import Any


@dataclass
class RecommendationResult:
    summary: str
    score: float
    rationale: list[str]
    actions: list[str]


def _safe_float(value: Any) -> float | None:
    try:
        if value in ("", None):
            return None
        return float(value)
    except (TypeError, ValueError):
        return None


def _normalise_supplier(value: str | None) -> str:
    if not value:
        return "unspecified supplier"
    lower = value.strip().lower()
    if "cell signaling" in lower or "cst" in lower:
        return "Cell Signaling Technology"
    if "abcam" in lower:
        return "Abcam"
    if "santa cruz" in lower:
        return "Santa Cruz"
    if "bio-rad" in lower or "biorad" in lower:
        return "Bio-Rad"
    return value.strip()


def _abundance_class(experiment: dict[str, Any]) -> str:
    explicit = (experiment.get("target_abundance_class") or "").strip().lower()
    if explicit in {"very low", "low", "moderate", "high", "very high"}:
        return explicit

    load = _safe_float(experiment.get("protein_load_ug"))
    if load is None:
        return "moderate"
    if load >= 35:
        return "very high"
    if load >= 25:
        return "high"
    if load < 8:
        return "very low"
    if load < 10:
        return "low"
    return "moderate"


def suggest_transfer_mode(protein_size_kda: float | None, selected_mode: str) -> tuple[str, str]:
    if selected_mode and selected_mode != "either":
        return selected_mode, "the workflow is already committed to this transfer hardware"

    if protein_size_kda is None:
        return "wet", "wet transfer is the safer default when the target size is not yet confirmed"

    if protein_size_kda >= 110:
        return "wet", "large proteins usually transfer more reliably with longer, cooler wet conditions"

    if protein_size_kda <= 30:
        return "semi-dry", "small proteins often transfer efficiently under shorter semi-dry runs"

    return "either", "mid-sized targets can work well with either transfer mode when contact and buffer balance are controlled"


def transfer_recommendations(experiment: dict[str, Any], analysis: dict[str, Any] | None) -> RecommendationResult:
    protein = experiment.get("protein_name") or "the target protein"
    size = _safe_float(experiment.get("protein_size_kda"))
    load = _safe_float(experiment.get("protein_load_ug"))
    selected_mode = experiment.get("transfer_mode") or "either"
    membrane = experiment.get("membrane_type") or "pvdf"

    recommended_mode, mode_reason = suggest_transfer_mode(size, selected_mode)
    rationale = [f"Preferred transfer mode: {recommended_mode} because {mode_reason}."]
    actions = []
    score = 0.6

    if size is not None:
        if size >= 120:
            rationale.append("High molecular weight targets are more prone to incomplete transfer.")
            actions.append("Use lower methanol and a longer wet transfer with active cooling.")
            score += 0.08
        elif size <= 20:
            rationale.append("Small targets can over-transfer or pass through the membrane.")
            actions.append("Shorten transfer duration or lower current density to reduce blow-through.")
            score += 0.05
        else:
            actions.append("Keep transfer time close to standard settings and optimise around image quality first.")

    if load is not None:
        if load > 30:
            rationale.append("High protein loading increases the chance of broad, diffuse, or background-heavy bands.")
            actions.append("Reduce lane load or lower antibody concentration before increasing exposure time.")
            score -= 0.05
        elif load < 10:
            rationale.append("Low protein loading will need more careful detection sensitivity.")
            actions.append("Prioritise sensitive detection and preserve signal during washing.")
            score -= 0.02

    actions.append(f"Use careful stack assembly with {membrane.upper()} and remove bubbles across the full membrane surface.")

    if analysis:
        contrast = analysis.get("contrast", 0.0)
        lane_variation = analysis.get("lane_variation", 0.0)
        saturation = analysis.get("saturation_pct", 0.0)
        edge_delta = analysis.get("edge_delta", 0.0)

        if contrast < 45:
            rationale.append("Image contrast is weak, which can indicate under-transfer or a low-information stain.")
            actions.append("Increase transfer time modestly or validate transfer with total-protein staining.")
            score -= 0.08
        else:
            score += 0.06

        if lane_variation > 20:
            rationale.append("Lane-to-lane variation is elevated, suggesting uneven contact or heating.")
            actions.append("Rebuild the transfer sandwich and check cassette pressure and buffer coverage.")
            score -= 0.1
        else:
            score += 0.07

        if saturation > 4:
            rationale.append("The transfer image contains substantial saturation, so acquisition settings may be masking the real transfer state.")
            actions.append("Re-image with shorter exposure before changing wet-lab conditions aggressively.")
            score -= 0.06

        if edge_delta > 18:
            rationale.append("Edge-to-centre intensity shifts suggest uneven transfer or imaging illumination.")
            actions.append("Check for edge drying, uneven roller pressure, or local heating across the membrane.")
            score -= 0.06

    summary = f"Transfer plan for {protein}: start with {recommended_mode} transfer and refine around contact quality, target size, and image consistency."
    return RecommendationResult(summary=summary, score=max(0.0, min(1.0, score)), rationale=rationale, actions=actions)


def blocking_recommendations(experiment: dict[str, Any], analysis: dict[str, Any] | None) -> RecommendationResult:
    blocker = experiment.get("blocking_reagent") or "milk"
    antibody_type = experiment.get("primary_type") or "total"
    load = _safe_float(experiment.get("protein_load_ug"))
    detection_method = (experiment.get("detection_method") or "ECL").lower()

    rationale = [f"Current blocker: {blocker}."]
    actions = []
    score = 0.62

    predicted_blocker = "3% milk"
    predicted_block_duration = "30 to 45 minutes"
    predicted_wash_stringency = "moderate"
    predicted_wash_program = "3 x 5 to 10 min in TBST"

    abundance_class = _abundance_class(experiment)

    rationale.append(f"Estimated abundance class from current lane load: {abundance_class}.")

    if antibody_type == "phospho":
        rationale.append("Phospho-specific antibodies often perform more cleanly with BSA than milk because milk contains casein and endogenous phosphoproteins that can increase phospho-antibody background or competition.")
        predicted_blocker = "2% to 3% BSA"
        predicted_block_duration = "30 minutes"
        predicted_wash_stringency = "gentle-to-moderate"
        predicted_wash_program = "3 x 5 to 7 min in TBST"
        actions.append("Prefer BSA over milk for phospho-sensitive targets, especially when using anti-phospho primary antibodies.")
        score += 0.04
    elif abundance_class in {"high", "very high"}:
        predicted_blocker = "1% to 2% milk"
        predicted_block_duration = "20 to 30 minutes"
        predicted_wash_stringency = "moderate-to-strong"
        predicted_wash_program = "3 to 5 x 10 min in TBST"
        rationale.append("A more abundant target often benefits from lighter blocking but more disciplined washing and shorter exposure.")
        actions.append("Do not compensate for abundance with excessively strong blocking before adjusting antibody dilution and exposure.")
    elif abundance_class in {"low", "very low"}:
        predicted_blocker = "1% to 2% BSA or 2% milk"
        predicted_block_duration = "20 to 30 minutes"
        predicted_wash_stringency = "gentle"
        predicted_wash_program = "3 x 5 min in TBST"
        rationale.append("Lower-abundance targets can lose useful signal if blocking or washing becomes too aggressive.")
        actions.append("Avoid over-blocking and over-washing before confirming the signal is truly specific.")

    if "high-sensitivity" in detection_method:
        rationale.append("High-sensitivity detection increases the chance of seeing blocker-related haze and secondary-driven background.")
        predicted_wash_stringency = "moderate-to-strong" if abundance_class not in {"low", "very low"} else "moderate"
        actions.append("Use the detection sensitivity as a reason to tighten antibody dilution and wash discipline before increasing blocker concentration.")

    if blocker == "milk" and antibody_type == "phospho":
        actions.append("Switch from milk to BSA before increasing primary concentration.")
        score -= 0.08

    if analysis:
        bg_spread = analysis.get("background_std", 0.0)
        median = analysis.get("median", 0.0)
        contrast = analysis.get("contrast", 0.0)
        low_signal = analysis.get("low_signal_pct", 0.0)

        if bg_spread > 30:
            rationale.append("Background is spatially uneven across the blot.")
            predicted_wash_stringency = "strong"
            predicted_wash_program = "5 x 10 min in TBST with high volume"
            actions.append("Increase wash volume and duration, and avoid any membrane drying between steps.")
            score -= 0.1
        else:
            score += 0.08

        if median > 175:
            rationale.append("The blot baseline is bright, suggesting nonspecific signal or overexposure.")
            predicted_blocker = "3% to 5% BSA" if antibody_type == "phospho" else "2% to 3% milk"
            predicted_block_duration = "45 to 60 minutes"
            actions.append("Try a slightly longer block, fresher blocker, or a lower secondary dilution.")
            score -= 0.08

        if median < 65 and low_signal > 35:
            rationale.append("The blot is globally dark, which may reflect weak signal capture rather than clean binding.")
            predicted_block_duration = "20 to 30 minutes"
            predicted_wash_stringency = "gentle"
            predicted_wash_program = "3 x 5 min in TBST"
            actions.append("Check acquisition settings and consider more sensitive detection before increasing antibody concentration.")
            score -= 0.04

        if contrast < 35:
            rationale.append("Band-to-background contrast is low.")
            predicted_wash_stringency = "moderate-to-strong"
            predicted_wash_program = "4 x 8 to 10 min in TBST"
            actions.append("Increase wash stringency gently before increasing the primary antibody concentration.")
            score -= 0.06
        else:
            actions.append("Keep wash conditions close to current settings and fine-tune antibody dilutions in smaller steps.")
            score += 0.06

    actions.insert(0, f"Predicted blocker: {predicted_blocker}.")
    actions.insert(1, f"Predicted block duration: {predicted_block_duration}.")
    actions.insert(2, f"Predicted wash stringency: {predicted_wash_stringency}.")
    actions.insert(3, f"Predicted wash program: {predicted_wash_program}.")

    summary = "Blocking and washing should be predicted from abundance, target class, detection sensitivity, and observed background rather than defaulting automatically to 5% milk."
    return RecommendationResult(summary=summary, score=max(0.0, min(1.0, score)), rationale=rationale, actions=actions)


def antibody_recommendations(experiment: dict[str, Any], blocking_analysis: dict[str, Any] | None) -> RecommendationResult:
    target = experiment.get("primary_target") or experiment.get("protein_name") or "your target"
    supplier = _normalise_supplier(experiment.get("primary_company"))
    primary_type = experiment.get("primary_type") or "total"
    load = _safe_float(experiment.get("protein_load_ug"))

    rationale = [f"Antibody target: {target} from {supplier}."]
    actions = []
    score = 0.65

    if primary_type == "loading-control":
        actions.extend(
            [
                "Start primary antibody around 1:3000 to 1:10000.",
                "Use secondary around 1:5000 to 1:10000.",
                "Use standard ECL and keep exposures short to avoid rapid saturation.",
            ]
        )
        score += 0.08
    elif primary_type == "phospho":
        actions.extend(
            [
                "Start primary antibody around 1:500 to 1:1000.",
                "Use a modest secondary dilution near 1:5000.",
                "Use BSA blocking and standard-to-high sensitivity ECL depending on abundance.",
            ]
        )
        score += 0.05
    elif primary_type == "low-abundance" or (load is not None and load < 10):
        actions.extend(
            [
                "Start primary antibody around 1:250 to 1:1000.",
                "Use secondary around 1:3000 to 1:5000.",
                "Use higher-sensitivity ECL but still begin with short exposure windows.",
            ]
        )
        score += 0.03
    else:
        actions.extend(
            [
                "Start primary antibody around 1:1000 to 1:3000.",
                "Use secondary around 1:5000 to 1:10000.",
                "Use standard ECL first, then step up in sensitivity only if signal is still weak.",
            ]
        )

    target_lower = target.lower()
    if "phospho" in target_lower or "p-" in target_lower:
        rationale.append("The target name itself suggests phosphorylation-specific detection.")
        actions.append("Keep blocking phosphate-compatible and avoid milk if nonspecific haze appears.")
        score += 0.04

    if supplier == "Cell Signaling Technology":
        rationale.append("CST antibodies often publish a strong recommended dilution range that is usually a reliable upper bound.")
        actions.append("Use the datasheet dilution as the ceiling, then step slightly more conservative for the first run.")
        score += 0.03
    elif supplier == "Abcam":
        rationale.append("Abcam antibodies can vary substantially by clone, so image readout should drive dilution refinement quickly.")
        actions.append("Keep a tighter first-pass dilution ladder if the first blot is ambiguous.")
    elif supplier == "Santa Cruz":
        rationale.append("Santa Cruz antibodies often benefit from more careful secondary and wash optimisation when background is high.")
        actions.append("Reduce secondary concentration before assuming the primary must be diluted further.")
    elif supplier == "Bio-Rad":
        rationale.append("Bio-Rad loading and validation reagents are often robust enough that overexposure becomes the first failure mode.")
        actions.append("Protect the first exposure window from saturation before changing reagent concentration.")

    if blocking_analysis:
        if blocking_analysis.get("background_std", 0.0) > 30:
            rationale.append("The developed blot shows uneven or elevated background.")
            actions.append("Lower the secondary concentration before making the primary more dilute.")
            score -= 0.06
        if blocking_analysis.get("saturation_pct", 0.0) > 3:
            rationale.append("The blot image is already close to saturated in places.")
            actions.append("Shorten exposure before changing antibody concentration, otherwise you may over-correct.")
            score -= 0.05

    summary = f"Antibody plan for {target}: use the vendor datasheet as the ceiling, but start from a conservative dilution and tune exposure before over-concentrating reagents."
    return RecommendationResult(summary=summary, score=max(0.0, min(1.0, score)), rationale=rationale, actions=actions)


def integrity_recommendations(
    gel_analysis: dict[str, Any] | None,
    transfer_analysis: dict[str, Any] | None,
    blocking_analysis: dict[str, Any] | None,
) -> RecommendationResult:
    rationale = []
    actions = []
    score = 0.78

    for label, analysis in (("gel", gel_analysis), ("transfer", transfer_analysis), ("final blot", blocking_analysis)):
        if not analysis:
            continue

        saturation = analysis.get("saturation_pct", 0.0)
        bg_spread = analysis.get("background_std", 0.0)
        edge_delta = analysis.get("edge_delta", 0.0)
        contrast = analysis.get("contrast", 0.0)
        splice_risk = analysis.get("splice_risk_score", 0.0)
        manipulation_risk = analysis.get("manipulation_risk_score", 0.0)
        asymmetry = analysis.get("asymmetry_score", 0.0)

        if saturation > 3:
            rationale.append(f"The {label} image has meaningful saturation, which weakens later quantification.")
            actions.append(f"Re-acquire the {label} image with shorter exposure and keep the uncropped original.")
            score -= 0.09

        if bg_spread > 28:
            rationale.append(f"The {label} image background is uneven.")
            actions.append(f"Avoid strong local contrast edits on the {label} image because they can exaggerate artefacts.")
            score -= 0.07

        if edge_delta > 24:
            rationale.append(f"The {label} image shows edge-to-centre intensity drift.")
            actions.append(f"Review illumination uniformity and preserve full-frame evidence for the {label} stage.")
            score -= 0.06

        if contrast < 30:
            rationale.append(f"The {label} image has low contrast.")
            actions.append(f"Re-image the {label} stage before relying on software rescue or publication figures.")
            score -= 0.05

        if splice_risk > 8:
            rationale.append(f"The {label} image shows an abrupt row-to-row intensity discontinuity consistent with possible splice boundaries or strong local edits.")
            actions.append(f"Keep full uncropped evidence for the {label} image and avoid stitching unless it is explicitly disclosed.")
            score -= 0.07

        if manipulation_risk > 10:
            rationale.append(f"The {label} image has clipping or edge behaviour that looks consistent with aggressive brightness or contrast handling.")
            actions.append(f"Use only global tonal adjustments on the {label} image and preserve the original capture for review.")
            score -= 0.06

        if asymmetry > 18:
            rationale.append(f"The {label} image shows left-right signal imbalance.")
            actions.append(f"Check loading symmetry, transfer contact, and any asymmetric wash agitation for the {label} stage.")
            score -= 0.05

    if not rationale:
        rationale.append("No high-risk image integrity concerns were detected from the uploaded stages.")
        actions.append("Keep uncropped originals and document any global brightness or contrast adjustments.")

    summary = "Image integrity screening highlights whether the uploaded images are reliable enough for troubleshooting and downstream quantification."
    return RecommendationResult(summary=summary, score=max(0.0, min(1.0, score)), rationale=rationale, actions=actions)
