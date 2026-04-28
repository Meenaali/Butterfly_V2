from __future__ import annotations

import json
import re
from pathlib import Path
from typing import Any

from .vector_store import delete_source, index_chunks, reset_collection, vector_backend_status

BASE_DIR = Path(__file__).resolve().parent.parent
DOCS_DIR = BASE_DIR / "data" / "docs"
CHUNKS_PATH = BASE_DIR / "data" / "rag_chunks.json"


def _safe_name(filename: str) -> str:
    cleaned = re.sub(r"[^A-Za-z0-9._-]+", "_", filename).strip("._")
    return cleaned or "document.txt"


def _chunk_text(text: str, chunk_size: int = 900) -> list[str]:
    compact = re.sub(r"\s+", " ", text).strip()
    if not compact:
        return []
    chunks = []
    start = 0
    while start < len(compact):
        end = min(len(compact), start + chunk_size)
        if end < len(compact):
            split = compact.rfind(". ", start, end)
            if split > start + 200:
                end = split + 1
        chunks.append(compact[start:end].strip())
        start = end
    return [chunk for chunk in chunks if chunk]


def _read_text(path: Path) -> str:
    suffix = path.suffix.lower()
    if suffix in {".txt", ".md"}:
        return path.read_text(encoding="utf-8", errors="ignore")
    if suffix == ".pdf":
        from pypdf import PdfReader

        reader = PdfReader(str(path))
        pages = []
        for page in reader.pages:
            pages.append(page.extract_text() or "")
        return "\n".join(pages)
    raise ValueError(f"Unsupported document type: {suffix}")


def load_indexed_chunks() -> list[dict[str, Any]]:
    if not CHUNKS_PATH.exists():
        return []
    return json.loads(CHUNKS_PATH.read_text(encoding="utf-8"))


def save_uploaded_document(filename: str, content: bytes) -> dict[str, Any]:
    DOCS_DIR.mkdir(parents=True, exist_ok=True)
    safe_name = _safe_name(filename)
    path = DOCS_DIR / safe_name
    path.write_bytes(content)

    text = _read_text(path)
    chunks = _chunk_text(text)
    indexed = load_indexed_chunks()
    indexed = [chunk for chunk in indexed if chunk.get("source_file") != safe_name]
    delete_source(safe_name)

    vector_chunks = []
    for index, chunk_text in enumerate(chunks):
        chunk_payload = {
            "id": f"{safe_name}:{index}",
            "title": safe_name,
            "source_file": safe_name,
            "source_kind": "uploaded",
            "text": chunk_text,
        }
        indexed.append(chunk_payload)
        vector_chunks.append(chunk_payload)

    CHUNKS_PATH.parent.mkdir(parents=True, exist_ok=True)
    CHUNKS_PATH.write_text(json.dumps(indexed, indent=2), encoding="utf-8")
    vector_result = index_chunks(vector_chunks)

    return {
        "filename": safe_name,
        "chunk_count": len(chunks),
        "character_count": len(text),
        "vector_backend": vector_result.get("backend", vector_backend_status()),
    }


def index_status() -> dict[str, Any]:
    DOCS_DIR.mkdir(parents=True, exist_ok=True)
    chunks = load_indexed_chunks()
    files = sorted(path.name for path in DOCS_DIR.iterdir() if path.is_file())
    return {
        "document_count": len(files),
        "chunk_count": len(chunks),
        "documents": files,
        "vector_backend": vector_backend_status(),
    }


def delete_document(filename: str) -> dict[str, Any]:
    safe_name = _safe_name(filename)
    path = DOCS_DIR / safe_name
    if path.exists():
        path.unlink()

    indexed = [chunk for chunk in load_indexed_chunks() if chunk.get("source_file") != safe_name]
    CHUNKS_PATH.parent.mkdir(parents=True, exist_ok=True)
    CHUNKS_PATH.write_text(json.dumps(indexed, indent=2), encoding="utf-8")
    delete_source(safe_name)
    return index_status()


def rebuild_document_index() -> dict[str, Any]:
    DOCS_DIR.mkdir(parents=True, exist_ok=True)
    reset_collection()
    indexed: list[dict[str, Any]] = []
    vector_chunks: list[dict[str, Any]] = []

    for path in sorted(DOCS_DIR.iterdir()):
        if not path.is_file():
            continue
        try:
            text = _read_text(path)
        except Exception:
            continue
        chunks = _chunk_text(text)
        for index, chunk_text in enumerate(chunks):
            chunk_payload = {
                "id": f"{path.name}:{index}",
                "title": path.name,
                "source_file": path.name,
                "source_kind": "uploaded",
                "text": chunk_text,
            }
            indexed.append(chunk_payload)
            vector_chunks.append(chunk_payload)

    CHUNKS_PATH.parent.mkdir(parents=True, exist_ok=True)
    CHUNKS_PATH.write_text(json.dumps(indexed, indent=2), encoding="utf-8")
    index_chunks(vector_chunks)
    return index_status()
