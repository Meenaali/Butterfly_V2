from __future__ import annotations

import base64
import hashlib
import hmac
import os
import secrets
import time
from pathlib import Path
from typing import Any

from fastapi import Cookie, Depends, FastAPI, HTTPException, Response
from fastapi import File, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

from .analysis import analyze_image_bytes
from .ai_interpretation import interpret_blot_image
from .antibody_compatibility import check_antibody_compatibility
from .database import create_experiment, create_pilot_submission, get_experiment, init_db, list_experiments, update_experiment
from .documents import delete_document, index_status, rebuild_document_index, save_uploaded_document
from .protein_first_planner import generate_protein_first_plan
from .protein_intelligence import build_protein_intelligence
from .rag_assistant import ask_butterfly
from .recommendations import (
    RecommendationResult,
    antibody_recommendations,
    blocking_recommendations,
    integrity_recommendations,
    transfer_recommendations,
)
from .troubleshooting import build_troubleshooting_plan


BASE_DIR = Path(__file__).resolve().parent.parent
FRONTEND_DIR = BASE_DIR / "frontend"
AUTH_COOKIE_NAME = "butterfly_session"
AUTH_MAX_AGE_SECONDS = 60 * 60 * 12
BUTTERFLY_PASSWORD = os.environ.get("BUTTERFLY_PASSWORD", "butterfly-demo")
BUTTERFLY_SECRET = os.environ.get("BUTTERFLY_SECRET", "local-butterfly-secret-change-on-render")
BUTTERFLY_COOKIE_SECURE = os.environ.get("BUTTERFLY_COOKIE_SECURE", "false").lower() == "true"

app = FastAPI(title="Butterfly API", version="0.1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class ExperimentPayload(BaseModel):
    title: str = Field(min_length=1)
    experiment: dict[str, Any]
    analyses: dict[str, Any] = Field(default_factory=dict)
    recommendations: dict[str, Any] = Field(default_factory=dict)
    protein_intelligence: dict[str, Any] = Field(default_factory=dict)
    antibody_compatibility: dict[str, Any] = Field(default_factory=dict)
    ai_interpretations: dict[str, Any] = Field(default_factory=dict)
    protein_first_plan: dict[str, Any] = Field(default_factory=dict)
    troubleshooting_plan: dict[str, Any] = Field(default_factory=dict)


class AnalyzeRequest(BaseModel):
    stage: str = Field(pattern="^(gel|transfer|final)$")
    image_base64: str


class ProteinIntelligenceRequest(BaseModel):
    uniprot_id: str | None = None
    protein_name: str | None = None
    organism_name: str | None = None
    protein_sequence: str | None = None


class AntibodyCompatibilityRequest(BaseModel):
    primary_url: str | None = None
    secondary_url: str | None = None
    primary_host_species: str | None = None
    primary_isotype: str | None = None
    primary_clone: str | None = None
    secondary_target_species: str | None = None
    secondary_isotype: str | None = None
    secondary_conjugate: str | None = None
    detection_method: str | None = "ECL"
    application: str | None = "WB"


class TroubleshootingRequest(BaseModel):
    symptom: str | None = "high background"
    experiment: dict[str, Any]
    analyses: dict[str, Any] = Field(default_factory=dict)
    protein_intelligence: dict[str, Any] = Field(default_factory=dict)
    antibody_compatibility: dict[str, Any] = Field(default_factory=dict)


class AIInterpretRequest(BaseModel):
    stage: str = Field(pattern="^(gel|transfer|final)$")
    image_base64: str
    analysis: dict[str, Any] = Field(default_factory=dict)
    experiment: dict[str, Any] = Field(default_factory=dict)
    protein_intelligence: dict[str, Any] = Field(default_factory=dict)
    antibody_compatibility: dict[str, Any] = Field(default_factory=dict)


class ChatRequest(BaseModel):
    question: str = Field(min_length=3)
    experiment: dict[str, Any] = Field(default_factory=dict)
    analyses: dict[str, Any] = Field(default_factory=dict)
    protein_intelligence: dict[str, Any] = Field(default_factory=dict)
    antibody_compatibility: dict[str, Any] = Field(default_factory=dict)


class LoginRequest(BaseModel):
    password: str


class ProteinFirstPlanRequest(BaseModel):
    experiment: dict[str, Any] = Field(default_factory=dict)
    protein_intelligence: dict[str, Any] = Field(default_factory=dict)
    antibody_compatibility: dict[str, Any] = Field(default_factory=dict)


class DocumentDeleteRequest(BaseModel):
    filename: str = Field(min_length=1)


class PilotIntakeRequest(BaseModel):
    full_name: str | None = None
    title: str = Field(min_length=1)
    role: str = Field(min_length=1)
    institution: str | None = None
    email: str | None = None
    experience_level: str = Field(min_length=1)
    contact_for_follow_up: bool = True


def _sign_session(expires_at: int) -> str:
    payload = f"butterfly:{expires_at}"
    signature = hmac.new(BUTTERFLY_SECRET.encode("utf-8"), payload.encode("utf-8"), hashlib.sha256).hexdigest()
    return f"{payload}:{signature}"


def _valid_session(cookie_value: str | None) -> bool:
    if not cookie_value:
        return False

    parts = cookie_value.split(":")
    if len(parts) != 3 or parts[0] != "butterfly":
        return False

    try:
        expires_at = int(parts[1])
    except ValueError:
        return False

    if expires_at < int(time.time()):
        return False

    expected = _sign_session(expires_at)
    return hmac.compare_digest(cookie_value, expected)


def require_auth(butterfly_session: str | None = Cookie(default=None, alias=AUTH_COOKIE_NAME)) -> None:
    if not _valid_session(butterfly_session):
        raise HTTPException(status_code=401, detail="Login required")


def recommendation_to_dict(result: RecommendationResult) -> dict[str, Any]:
    return {
        "summary": result.summary,
        "score": round(result.score, 3),
        "rationale": result.rationale,
        "actions": result.actions,
    }


def build_recommendations(experiment: dict[str, Any], analyses: dict[str, Any]) -> dict[str, Any]:
    transfer = recommendation_to_dict(transfer_recommendations(experiment, analyses.get("transfer")))
    blocking = recommendation_to_dict(blocking_recommendations(experiment, analyses.get("final")))
    antibody = recommendation_to_dict(antibody_recommendations(experiment, analyses.get("final")))
    integrity = recommendation_to_dict(
        integrity_recommendations(analyses.get("gel"), analyses.get("transfer"), analyses.get("final"))
    )
    return {
        "transfer": transfer,
        "blocking": blocking,
        "antibody": antibody,
        "integrity": integrity,
    }


@app.on_event("startup")
def startup() -> None:
    init_db()


@app.get("/api/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/api/auth/status")
def auth_status(butterfly_session: str | None = Cookie(default=None, alias=AUTH_COOKIE_NAME)) -> dict[str, bool]:
    return {"authenticated": _valid_session(butterfly_session)}


@app.post("/api/auth/login")
def login(request: LoginRequest, response: Response) -> dict[str, bool]:
    if not secrets.compare_digest(request.password, BUTTERFLY_PASSWORD):
        raise HTTPException(status_code=401, detail="Incorrect password")

    expires_at = int(time.time()) + AUTH_MAX_AGE_SECONDS
    response.set_cookie(
        AUTH_COOKIE_NAME,
        _sign_session(expires_at),
        max_age=AUTH_MAX_AGE_SECONDS,
        httponly=True,
        samesite="lax",
        secure=BUTTERFLY_COOKIE_SECURE,
    )
    return {"authenticated": True}


@app.post("/api/auth/logout")
def logout(response: Response) -> dict[str, bool]:
    response.delete_cookie(AUTH_COOKIE_NAME)
    return {"authenticated": False}


@app.post("/api/pilot-intake", dependencies=[Depends(require_auth)])
def pilot_intake(request: PilotIntakeRequest) -> dict[str, Any]:
    payload = request.model_dump()
    if not payload.get("contact_for_follow_up"):
        payload["full_name"] = None
        payload["email"] = None
    return create_pilot_submission(payload)


@app.post("/api/analyze", dependencies=[Depends(require_auth)])
def analyze(request: AnalyzeRequest) -> dict[str, Any]:
    try:
        image_bytes = base64.b64decode(request.image_base64)
    except Exception as exc:  # pragma: no cover - defensive path
        raise HTTPException(status_code=400, detail="Invalid base64 image payload") from exc

    analysis = analyze_image_bytes(image_bytes)
    return {"stage": request.stage, "analysis": analysis}


@app.post("/api/protein-intelligence", dependencies=[Depends(require_auth)])
def protein_intelligence(request: ProteinIntelligenceRequest) -> dict[str, Any]:
    result = build_protein_intelligence(
        uniprot_id=request.uniprot_id,
        protein_name=request.protein_name,
        organism_name=request.organism_name,
        protein_sequence=request.protein_sequence,
    )
    return {
        "resolved_accession": result.resolved_accession,
        "query_strategy": result.query_strategy,
        "uniprot": result.uniprot,
        "alphafold": result.alphafold,
        "ebi_features": result.ebi_features,
        "chemistry": result.chemistry,
        "buffer_compatibility": result.buffer_compatibility,
        "band_risks": result.band_risks,
        "predictions": result.predictions,
        "buffer_recommendations": result.buffer_recommendations,
        "caveats": result.caveats,
    }


@app.post("/api/antibody-compatibility", dependencies=[Depends(require_auth)])
def antibody_compatibility(request: AntibodyCompatibilityRequest) -> dict[str, Any]:
    return check_antibody_compatibility(request.model_dump())


@app.post("/api/troubleshooting", dependencies=[Depends(require_auth)])
def troubleshooting(request: TroubleshootingRequest) -> dict[str, Any]:
    result = build_troubleshooting_plan(
        symptom=request.symptom,
        experiment=request.experiment,
        analyses=request.analyses,
        protein_intelligence=request.protein_intelligence,
        antibody_compatibility=request.antibody_compatibility,
    )
    return {
        "symptom": result.symptom,
        "summary": result.summary,
        "likely_causes": result.likely_causes,
        "decision_tree": result.decision_tree,
        "immediate_fixes": result.immediate_fixes,
        "next_run_plan": result.next_run_plan,
        "evidence_tools": result.evidence_tools,
        "supporting_material": result.supporting_material,
    }


@app.post("/api/ai-interpret", dependencies=[Depends(require_auth)])
def ai_interpret(request: AIInterpretRequest) -> dict[str, Any]:
    return interpret_blot_image(
        stage=request.stage,
        image_base64=request.image_base64,
        analysis=request.analysis,
        experiment=request.experiment,
        protein_intelligence=request.protein_intelligence,
        antibody_compatibility=request.antibody_compatibility,
    )


@app.post("/api/chat", dependencies=[Depends(require_auth)])
def chat(request: ChatRequest) -> dict[str, Any]:
    return ask_butterfly(
        question=request.question,
        experiment=request.experiment,
        analyses=request.analyses,
        protein_intelligence=request.protein_intelligence,
        antibody_compatibility=request.antibody_compatibility,
    )


@app.post("/api/protein-first-plan", dependencies=[Depends(require_auth)])
def protein_first_plan(request: ProteinFirstPlanRequest) -> dict[str, Any]:
    return generate_protein_first_plan(
        experiment=request.experiment,
        protein_intelligence=request.protein_intelligence,
        antibody_compatibility=request.antibody_compatibility,
    )


@app.get("/api/index-status", dependencies=[Depends(require_auth)])
def get_index_status() -> dict[str, Any]:
    return index_status()


@app.post("/api/index-documents", dependencies=[Depends(require_auth)])
async def index_documents(files: list[UploadFile] = File(...)) -> dict[str, Any]:
    results = []
    for upload in files:
        content = await upload.read()
        results.append(save_uploaded_document(upload.filename or "document.txt", content))
    return {
        "indexed": results,
        "status": index_status(),
    }


@app.post("/api/delete-document", dependencies=[Depends(require_auth)])
def remove_document(request: DocumentDeleteRequest) -> dict[str, Any]:
    return {"status": delete_document(request.filename)}


@app.post("/api/rebuild-index", dependencies=[Depends(require_auth)])
def rebuild_index() -> dict[str, Any]:
    return {"status": rebuild_document_index()}


@app.get("/api/experiments", dependencies=[Depends(require_auth)])
def experiments() -> list[dict[str, Any]]:
    return list_experiments()


@app.get("/api/experiments/{experiment_id}", dependencies=[Depends(require_auth)])
def experiment(experiment_id: int) -> dict[str, Any]:
    item = get_experiment(experiment_id)
    if item is None:
        raise HTTPException(status_code=404, detail="Experiment not found")
    return item


@app.post("/api/recommendations", dependencies=[Depends(require_auth)])
def recommendations(payload: ExperimentPayload) -> dict[str, Any]:
    return build_recommendations(payload.experiment, payload.analyses)


@app.post("/api/experiments", dependencies=[Depends(require_auth)])
def save_experiment(payload: ExperimentPayload) -> dict[str, Any]:
    recommendation_payload = payload.recommendations or build_recommendations(payload.experiment, payload.analyses)
    saved = create_experiment(
        payload.title,
        {
            "experiment": payload.experiment,
            "analyses": payload.analyses,
            "recommendations": recommendation_payload,
            "protein_intelligence": payload.protein_intelligence,
            "antibody_compatibility": payload.antibody_compatibility,
            "ai_interpretations": payload.ai_interpretations,
            "protein_first_plan": payload.protein_first_plan,
            "troubleshooting_plan": payload.troubleshooting_plan,
        },
    )
    return saved


@app.put("/api/experiments/{experiment_id}", dependencies=[Depends(require_auth)])
def update_saved_experiment(experiment_id: int, payload: ExperimentPayload) -> dict[str, Any]:
    existing = get_experiment(experiment_id)
    if existing is None:
        raise HTTPException(status_code=404, detail="Experiment not found")

    recommendation_payload = payload.recommendations or build_recommendations(payload.experiment, payload.analyses)
    updated = update_experiment(
        experiment_id,
        payload.title,
        {
            "experiment": payload.experiment,
            "analyses": payload.analyses,
            "recommendations": recommendation_payload,
            "protein_intelligence": payload.protein_intelligence,
            "antibody_compatibility": payload.antibody_compatibility,
            "ai_interpretations": payload.ai_interpretations,
            "protein_first_plan": payload.protein_first_plan,
            "troubleshooting_plan": payload.troubleshooting_plan,
        },
    )
    return updated


app.mount("/assets", StaticFiles(directory=FRONTEND_DIR), name="assets")


@app.get("/")
def frontend() -> FileResponse:
    return FileResponse(FRONTEND_DIR / "index.html")
