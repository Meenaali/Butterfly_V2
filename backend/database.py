from __future__ import annotations

import json
import sqlite3
from pathlib import Path
from typing import Any


DB_PATH = Path(__file__).resolve().parent.parent / "data" / "butterfly.db"


def get_connection() -> sqlite3.Connection:
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    connection = sqlite3.connect(DB_PATH)
    connection.row_factory = sqlite3.Row
    return connection


def init_db() -> None:
    with get_connection() as connection:
        connection.execute(
            """
            CREATE TABLE IF NOT EXISTS experiments (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                title TEXT NOT NULL,
                payload_json TEXT NOT NULL
            )
            """
        )


def list_experiments() -> list[dict[str, Any]]:
    with get_connection() as connection:
        rows = connection.execute(
            "SELECT id, created_at, updated_at, title, payload_json FROM experiments ORDER BY updated_at DESC, id DESC"
        ).fetchall()

    items = []
    for row in rows:
        payload = json.loads(row["payload_json"])
        items.append(
            {
                "id": row["id"],
                "created_at": row["created_at"],
                "updated_at": row["updated_at"],
                "title": row["title"],
                "payload": payload,
            }
        )
    return items


def get_experiment(experiment_id: int) -> dict[str, Any] | None:
    with get_connection() as connection:
        row = connection.execute(
            "SELECT id, created_at, updated_at, title, payload_json FROM experiments WHERE id = ?",
            (experiment_id,),
        ).fetchone()

    if row is None:
        return None

    return {
        "id": row["id"],
        "created_at": row["created_at"],
        "updated_at": row["updated_at"],
        "title": row["title"],
        "payload": json.loads(row["payload_json"]),
    }


def create_experiment(title: str, payload: dict[str, Any]) -> dict[str, Any]:
    with get_connection() as connection:
        cursor = connection.execute(
            """
            INSERT INTO experiments (title, payload_json)
            VALUES (?, ?)
            """,
            (title, json.dumps(payload)),
        )
        experiment_id = cursor.lastrowid
        connection.commit()

    return get_experiment(int(experiment_id))


def update_experiment(experiment_id: int, title: str, payload: dict[str, Any]) -> dict[str, Any] | None:
    with get_connection() as connection:
        connection.execute(
            """
            UPDATE experiments
            SET title = ?, payload_json = ?, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
            """,
            (title, json.dumps(payload), experiment_id),
        )
        connection.commit()

    return get_experiment(experiment_id)
