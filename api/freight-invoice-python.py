"""Stateless Excel processor. User state is owned exclusively by IndexedDB.

Every call supplies its own ZIP snapshot. Nothing is loaded from Postgres or
from a previous invocation. A fresh temporary directory is removed before the
response is sent. Legacy direct API calls are deliberately rejected.
"""
from __future__ import annotations

import base64
import io
import json
import re
import sys
import tempfile
import threading
from http.server import BaseHTTPRequestHandler
from pathlib import Path
from types import SimpleNamespace

API_DIR = Path(__file__).resolve().parent
if str(API_DIR) not in sys.path:
    sys.path.insert(0, str(API_DIR))
from _freight_invoice import app as engine  # noqa: E402

PROTOCOL = "freight-browser-v1"
MAX_WIRE_BYTES = 4_000_000  # Leave headroom below the platform payload limit.
STATE_LOCK = threading.RLock()
DATA_PATHS = {
    "EXPORT_DIR": "exports",
    "PRODUCTS_FILE": "products.json", "WAREHOUSES_FILE": "warehouses.json",
    "HISTORY_FILE": "export_history.json", "HISTORY_FILES_DIR": "history_files",
    "DRAFT_FILE": "invoice_draft.json", "CUSTOM_TEMPLATES_FILE": "custom_templates.json",
    "CUSTOM_TEMPLATES_DIR": "custom_templates", "TEMPLATE_SETTINGS_FILE": "template_settings.json",
}


class BufferedHandler(engine.InvoiceHandler):
    def send_response(self, code, message=None):
        self.status = int(code)

    def send_header(self, name, value):
        self.response_headers[name] = str(value)

    def end_headers(self):
        pass

    def log_message(self, *args):
        pass  # Never log user payloads, filenames or snapshots.


def encode(value: bytes) -> str:
    return base64.b64encode(value).decode("ascii")


def execute(envelope: dict) -> dict:
    if not isinstance(envelope, dict) or envelope.get("protocol") != PROTOCOL:
        raise ValueError("请刷新页面使用浏览器独立存储版本；旧共享接口已关闭")
    method = envelope.get("method", "GET")
    route = envelope.get("path", "")
    if method not in {"GET", "POST", "DELETE"} or not isinstance(route, str) or not re.fullmatch(r"/[A-Za-z0-9/_-]+", route):
        raise ValueError("无效的本地数据操作")
    if route.startswith("/warehouses"):
        raise ValueError("仓库库由浏览器独立管理")
    body = base64.b64decode(envelope.get("body", ""), validate=True)
    snapshot = base64.b64decode(envelope.get("snapshot", ""), validate=True)

    # The original engine uses module-level Paths; serialize their rebinding.
    # Independent Vercel instances are safe too: every request starts empty.
    with STATE_LOCK, tempfile.TemporaryDirectory(prefix="freight-request-") as folder:
        original = {name: getattr(engine, name) for name in ["DATA_DIR", *DATA_PATHS, "BACKUP_MAX_BYTES"]}
        engine.DATA_DIR = Path(folder)
        for name, relative in DATA_PATHS.items():
            setattr(engine, name, Path(folder) / relative)
        engine.BACKUP_MAX_BYTES = 32 * 1024 * 1024
        engine.TEMPLATE_REQUIRED_CACHE.clear()
        try:
            if snapshot:
                engine.restore_full_backup(snapshot)
            request = BufferedHandler.__new__(BufferedHandler)
            request.path = "/api" + route
            request.headers = {"Content-Length": str(len(body)), "Content-Type": envelope.get("contentType", "application/json")}
            request.rfile = io.BytesIO(body)
            request.wfile = io.BytesIO()
            request.server = SimpleNamespace(server_address=("127.0.0.1", 0))
            request.command = method
            request.request_version = "HTTP/1.1"
            request.response_headers = {}
            request.status = 500
            getattr(request, "do_" + method)()
            content = request.wfile.getvalue()
            if route == "/config" and request.status == 200:
                config = json.loads(content)
                config.update(appEdition="浏览器独立存储版", storageMode="仅保存在当前浏览器", warehouseCount=0)
                content = json.dumps(config, ensure_ascii=False).encode("utf-8")
            result = {"protocol": PROTOCOL, "status": request.status,
                      "headers": {k: v for k, v in request.response_headers.items() if k.lower() != "content-length"},
                      "body": encode(content)}
            if method != "GET" and route != "/preview" and 200 <= request.status < 300:
                backup, _, manifest = engine.create_full_backup()
                result["snapshot"] = encode(backup)
                result["counts"] = manifest["counts"]
            # Fail before acknowledging a mutation that the browser cannot save.
            if len(json.dumps(result).encode("utf-8")) > MAX_WIRE_BYTES:
                raise ValueError("数据超过在线处理容量；本地原数据未修改，请先备份并减少历史文件或图片")
            return result
        finally:
            for name, value in original.items():
                setattr(engine, name, value)
            engine.TEMPLATE_REQUIRED_CACHE.clear()


class handler(BaseHTTPRequestHandler):
    def log_message(self, *args):
        pass

    def send_json(self, data, status=200):
        content = json.dumps(data, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Cache-Control", "private, no-store")
        self.send_header("Content-Length", str(len(content)))
        self.end_headers()
        self.wfile.write(content)

    def do_GET(self):
        self.send_json({"error": "旧共享接口已关闭，请刷新页面使用浏览器独立存储版本", "protocol": PROTOCOL}, 410)

    do_DELETE = do_GET
    do_PUT = do_GET
    do_PATCH = do_GET

    def do_POST(self):
        try:
            length = int(self.headers.get("Content-Length", "0"))
            if length <= 0 or length > MAX_WIRE_BYTES:
                self.send_json({"error": "请求超过在线处理容量，本地数据未修改"}, 413)
                return
            result = execute(json.loads(self.rfile.read(length)))
            self.send_json(result)
        except (ValueError, TypeError, KeyError) as exc:
            self.send_json({"error": str(exc)}, 400)
        except Exception:
            self.send_json({"error": "Excel 处理失败，本地数据未修改"}, 500)
