from __future__ import annotations

from io import BytesIO
from typing import Any

import numpy as np
from PIL import Image


def analyze_image_bytes(image_bytes: bytes) -> dict[str, Any]:
    image = Image.open(BytesIO(image_bytes)).convert("L")
    image.thumbnail((900, 900))
    matrix = np.asarray(image, dtype=np.float32)

    flat = matrix.flatten()
    mean = float(np.mean(flat))
    std = float(np.std(flat))
    p10 = float(np.percentile(flat, 10))
    p50 = float(np.percentile(flat, 50))
    p90 = float(np.percentile(flat, 90))

    saturation_pct = float(np.mean(flat > 245) * 100.0)
    low_signal_pct = float(np.mean(flat < 20) * 100.0)

    segments = np.array_split(matrix, 8, axis=1)
    lane_means = np.array([float(np.mean(segment)) for segment in segments], dtype=np.float32)
    lane_variation = float((np.std(lane_means) / max(np.mean(lane_means), 1.0)) * 100.0)

    edge_band = max(1, int(matrix.shape[1] * 0.08))
    edge_pixels = np.concatenate([matrix[:, :edge_band], matrix[:, -edge_band:]], axis=1)
    center_pixels = matrix[:, edge_band:-edge_band] if matrix.shape[1] > edge_band * 2 else matrix
    edge_delta = float(abs(np.mean(edge_pixels) - np.mean(center_pixels)))

    band_density = float(np.mean(flat < p10) * 100.0)
    dynamic_range = float(max(flat.max() - flat.min(), 0.0))
    half = max(1, matrix.shape[1] // 2)
    left_mean = float(np.mean(matrix[:, :half]))
    right_mean = float(np.mean(matrix[:, half:])) if matrix.shape[1] > half else left_mean
    asymmetry_score = float(abs(left_mean - right_mean))

    row_means = np.mean(matrix, axis=1)
    row_diffs = np.abs(np.diff(row_means)) if row_means.size > 1 else np.array([0.0], dtype=np.float32)
    splice_risk_score = float(np.percentile(row_diffs, 95)) if row_diffs.size else 0.0

    clipping_pct = float(np.mean((flat < 8) | (flat > 247)) * 100.0)
    manipulation_risk_score = float((clipping_pct * 0.8) + (max(edge_delta - 12.0, 0.0) * 0.35))

    return {
        "width": int(matrix.shape[1]),
        "height": int(matrix.shape[0]),
        "mean": round(mean, 3),
        "background_std": round(std, 3),
        "contrast": round(p90 - p10, 3),
        "median": round(p50, 3),
        "saturation_pct": round(saturation_pct, 3),
        "low_signal_pct": round(low_signal_pct, 3),
        "lane_variation": round(lane_variation, 3),
        "edge_delta": round(edge_delta, 3),
        "band_density_pct": round(band_density, 3),
        "dynamic_range": round(dynamic_range, 3),
        "asymmetry_score": round(asymmetry_score, 3),
        "splice_risk_score": round(splice_risk_score, 3),
        "manipulation_risk_score": round(manipulation_risk_score, 3),
        "clipping_pct": round(clipping_pct, 3),
    }
