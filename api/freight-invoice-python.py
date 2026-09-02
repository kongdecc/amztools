"""Vercel entry point for the freight invoice Excel engine.

The browser calls this single function with ``?path=/config`` (and similar
paths).  The adapter restores the original ``/api/...`` path expected by the
desktop server's request handler, so the tested Excel implementation can run
unchanged in Vercel's Python runtime.
"""

from __future__ import annotations

import os
import base64
import json
import sys
import threading
import uuid
from pathlib import Path
from urllib.parse import parse_qsl, urlencode, urlsplit


# Vercel functions have a read-only deployment filesystem and a writable /tmp.
# The frontend mirrors this state to IndexedDB and restores it after a cold start.
os.environ.setdefault(
    "FREIGHT_INVOICE_DATA_DIR",
    str(Path(os.environ.get("TMPDIR", "/tmp")) / "freight-invoice-data"),
)

# Vercel loads the entry point from the project root, so sibling modules under
# api/ are not guaranteed to be on sys.path as they are with a direct script run.
API_DIR = Path(__file__).resolve().parent
if str(API_DIR) not in sys.path:
    sys.path.insert(0, str(API_DIR))

from _freight_invoice.app import (  # noqa: E402
    InvoiceHandler,
    create_full_backup,
    restore_full_backup,
)


STATE_KEY = "freight-invoice-state-v1"
STATE_LOCK = threading.RLock()


def _database_url() -> str:
    for name in ("POSTGRES_URL", "PRISMA_DATABASE_URL"):
        value = os.environ.get(name, "").strip()
        if value.startswith(("postgres://", "postgresql://")):
            return value
    return ""


def _load_durable_state() -> None:
    """Hydrate /tmp from the Postgres store used by the main Next.js app."""
    database_url = _database_url()
    if not database_url:
        return
    try:
        import psycopg

        with psycopg.connect(database_url) as connection:
            with connection.cursor() as cursor:
                cursor.execute('SELECT "value" FROM "SiteSettings" WHERE "key" = %s', (STATE_KEY,))
                row = cursor.fetchone()
        if not row:
            return
        state = json.loads(row[0])
        backup = base64.b64decode(state.get("backup", ""), validate=True)
        restore_full_backup(backup)
    except Exception as exc:
        # Keep the function usable with its /tmp + IndexedDB fallback when the
        # database is temporarily unavailable or has not been provisioned yet.
        print(f"Freight invoice state hydration skipped: {exc}")


def _save_durable_state() -> None:
    """Persist all mutable files after a successful write operation."""
    database_url = _database_url()
    if not database_url:
        return
    try:
        import psycopg

        backup, _, _ = create_full_backup()
        value = json.dumps(
            {
                "backup": base64.b64encode(backup).decode("ascii"),
            },
            ensure_ascii=False,
            separators=(",", ":"),
        )
        with psycopg.connect(database_url) as connection:
            with connection.cursor() as cursor:
                cursor.execute(
                    '''
                    INSERT INTO "SiteSettings" ("id", "key", "value", "updatedAt")
                    VALUES (%s, %s, %s, NOW())
                    ON CONFLICT ("key") DO UPDATE
                    SET "value" = EXCLUDED."value", "updatedAt" = NOW()
                    ''',
                    (uuid.uuid4().hex, STATE_KEY, value),
                )
            connection.commit()
    except Exception as exc:
        print(f"Freight invoice state persistence skipped: {exc}")


class handler(InvoiceHandler):
    """Expose the existing request handler through one Vercel function."""

    def _use_backend_path(self) -> None:
        parsed = urlsplit(self.path)
        params = parse_qsl(parsed.query, keep_blank_values=True)
        requested_path = next((value for key, value in params if key == "path"), "/config")
        forwarded = [(key, value) for key, value in params if key != "path"]
        safe_path = "/" + requested_path.lstrip("/")
        self.path = f"/api{safe_path}"
        if forwarded:
            self.path += "?" + urlencode(forwarded)

    def send_response(self, code: int, message: str | None = None) -> None:
        self._response_status = code
        super().send_response(code, message)

    def do_GET(self) -> None:
        self._use_backend_path()
        with STATE_LOCK:
            _load_durable_state()
            super().do_GET()

    def do_POST(self) -> None:
        self._use_backend_path()
        is_preview = urlsplit(self.path).path == "/api/preview"
        with STATE_LOCK:
            _load_durable_state()
            super().do_POST()
            if not is_preview and 200 <= getattr(self, "_response_status", 500) < 300:
                _save_durable_state()

    def do_DELETE(self) -> None:
        self._use_backend_path()
        with STATE_LOCK:
            _load_durable_state()
            super().do_DELETE()
            if 200 <= getattr(self, "_response_status", 500) < 300:
                _save_durable_state()
