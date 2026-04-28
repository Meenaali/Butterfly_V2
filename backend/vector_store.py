from __future__ import annotations

import json
import math
import os
from pathlib import Path
from typing import Any
from urllib.request import Request, urlopen


BASE_DIR = Path(__file__).resolve().parent.parent
CHROMA_DIR = BASE_DIR / "data" / "chroma"
COLLECTION_NAME = "butterfly_rag"
OPENAI_API_KEY = os.environ.get("OPENAI_API_KEY")
OPENAI_EMBED_MODEL = os.environ.get("OPENAI_EMBED_MODEL", "text-embedding-3-small")
EMBED_DIMENSION = 256


def _get_collection():
    try:
        import chromadb
    except Exception:
        return None

    CHROMA_DIR.mkdir(parents=True, exist_ok=True)
    client = chromadb.PersistentClient(path=str(CHROMA_DIR))
    return client.get_or_create_collection(name=COLLECTION_NAME)


def _hash_embedding(text: str, dim: int = EMBED_DIMENSION) -> list[float]:
    vector = [0.0] * dim
    for token in text.lower().split():
        index = hash(token) % dim
        vector[index] += 1.0
    norm = math.sqrt(sum(value * value for value in vector)) or 1.0
    return [value / norm for value in vector]


def _openai_embeddings(texts: list[str]) -> list[list[float]]:
    body = {
        "input": texts,
        "model": OPENAI_EMBED_MODEL,
    }
    request = Request(
        "https://api.openai.com/v1/embeddings",
        data=json.dumps(body).encode("utf-8"),
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {OPENAI_API_KEY}",
        },
        method="POST",
    )
    with urlopen(request, timeout=60) as response:  # noqa: S310
        payload = json.loads(response.read().decode("utf-8"))
    data = payload.get("data", [])
    return [item["embedding"] for item in data]


def embed_texts(texts: list[str]) -> list[list[float]]:
    if OPENAI_API_KEY:
        try:
            return _openai_embeddings(texts)
        except Exception:
            pass
    return [_hash_embedding(text) for text in texts]


def index_chunks(chunks: list[dict[str, Any]]) -> dict[str, Any]:
    collection = _get_collection()
    if collection is None:
        return {"backend": "fallback", "indexed": 0}
    if not chunks:
        return {"backend": "chromadb", "indexed": 0}

    ids = [chunk["id"] for chunk in chunks]
    documents = [chunk["text"] for chunk in chunks]
    metadatas = [
        {
            "title": chunk.get("title", ""),
            "source_file": chunk.get("source_file", ""),
            "source_kind": chunk.get("source_kind", "uploaded"),
        }
        for chunk in chunks
    ]
    embeddings = embed_texts(documents)
    collection.upsert(ids=ids, documents=documents, metadatas=metadatas, embeddings=embeddings)
    return {"backend": "chromadb", "indexed": len(chunks)}


def delete_source(source_file: str) -> None:
    collection = _get_collection()
    if collection is None:
        return
    try:
        collection.delete(where={"source_file": source_file})
    except Exception:
        return


def reset_collection() -> None:
    collection = _get_collection()
    if collection is None:
        return
    try:
        collection.delete(where={})
    except Exception:
        return


def semantic_search(query: str, n_results: int = 4) -> list[dict[str, Any]]:
    collection = _get_collection()
    if collection is None:
        return []

    try:
        query_embedding = embed_texts([query])[0]
        results = collection.query(
            query_embeddings=[query_embedding],
            n_results=n_results,
            include=["documents", "metadatas", "distances"],
        )
    except Exception:
        return []

    documents = results.get("documents", [[]])[0]
    metadatas = results.get("metadatas", [[]])[0]
    distances = results.get("distances", [[]])[0]
    chunks = []
    for document, metadata, distance in zip(documents, metadatas, distances):
        meta = metadata or {}
        chunks.append(
            {
                "title": meta.get("title") or meta.get("source_file") or "Retrieved knowledge",
                "text": document,
                "source_file": meta.get("source_file", ""),
                "source_kind": meta.get("source_kind", "uploaded"),
                "distance": distance,
            }
        )
    return chunks


def vector_backend_status() -> str:
    return "chromadb" if _get_collection() is not None else "fallback"
