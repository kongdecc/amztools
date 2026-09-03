"""Stateless Excel processor. User state is owned exclusively by IndexedDB.

V2 calls supply only operation-scoped files; v1 snapshots remain compatible for
older open tabs. Nothing is loaded from Postgres or from a previous invocation.
A fresh temporary directory is removed before the response is sent. Legacy
direct API calls are deliberately rejected.
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
SCOPED_PROTOCOL = "freight-browser-v2"
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


def scoped_file(name: str) -> bool:
    return name in {"custom_templates.json", "template_settings.json"} or bool(
        re.fullmatch(r"custom_templates/tpl-[0-9a-f]{10}\.(?:xlsx|xlsm|xls)", name))


def scoped_files() -> dict:
    return {path.relative_to(engine.DATA_DIR).as_posix(): path.read_bytes()
            for path in engine.DATA_DIR.rglob("*") if path.is_file()
            and scoped_file(path.relative_to(engine.DATA_DIR).as_posix())}


def execute(envelope: dict) -> dict:
    if not isinstance(envelope, dict) or envelope.get("protocol") not in {PROTOCOL, SCOPED_PROTOCOL}:
        raise ValueError("请刷新页面使用浏览器独立存储版本；旧共享接口已关闭")
    scoped = envelope["protocol"] == SCOPED_PROTOCOL
    method = envelope.get("method", "GET")
    route = envelope.get("path", "")
    if method not in {"GET", "POST", "DELETE"} or not isinstance(route, str) or not re.fullmatch(r"/[A-Za-z0-9/_-]+", route):
        raise ValueError("无效的本地数据操作")
    if route.startswith("/warehouses"):
        raise ValueError("仓库库由浏览器独立管理")
    if scoped and not re.fullmatch(r"/(?:config|templates(?:/[A-Za-z0-9/_-]+)?|field-catalog(?:/[A-Za-z0-9/_-]+)?|preview|export)", route):
        raise ValueError("此操作应在浏览器本地完成")
    if scoped and envelope.get("snapshot"):
        raise ValueError("新版接口不接收完整本地数据")
    body = (json.dumps(envelope["payload"], ensure_ascii=False).encode("utf-8")
            if scoped and "payload" in envelope else base64.b64decode(envelope.get("body", ""), validate=True))
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
            before = {}
            if scoped:
                files = envelope.get("files", {})
                if not isinstance(files, dict) or len(files) > 1000:
                    raise ValueError("模板处理数据无效")
                for name, encoded in files.items():
                    if not scoped_file(name):
                        raise ValueError("请求包含非本次处理所需的数据")
                    content = base64.b64decode(encoded, validate=True)
                    target = engine.DATA_DIR / name
                    target.parent.mkdir(parents=True, exist_ok=True)
                    target.write_bytes(content)
                before = scoped_files()
            elif snapshot:
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
            result = {"protocol": envelope["protocol"], "status": request.status,
                      "headers": {k: v for k, v in request.response_headers.items() if k.lower() != "content-length"},
                      "body": encode(content)}
            if method != "GET" and route != "/preview" and 200 <= request.status < 300:
                if scoped:
                    after = scoped_files()
                    result["changes"] = {name: encode(value) for name, value in after.items() if before.get(name) != value}
                    result["removed"] = [name for name in before if name not in after]
                    if route == "/export":
                        # The Excel body is returned once; the browser retains
                        # its own payload and adds the history file locally.
                        result["historyRecord"] = engine.export_history_summary(engine.read_export_history()[0])
                else:
                    backup, _, manifest = engine.create_full_backup()
                    result["snapshot"] = encode(backup)
                    result["counts"] = manifest["counts"]
            # Fail before acknowledging a mutation that the browser cannot save.
            if len(json.dumps(result).encode("utf-8")) > MAX_WIRE_BYTES:
                raise ValueError("本次 Excel 或预览结果超过单次在线传输上限 4 MB（4,000,000 字节，含编码数据），请减小当前模板/商品图片或拆分本次票件；无需删除历史，本地数据未修改")
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
                self.send_json({"error": "请求超过单次在线传输上限 4 MB（4,000,000 字节，含编码数据），请精简模板或压缩图片后重试；本地数据未修改"}, 413)
                return
            result = execute(json.loads(self.rfile.read(length)))
            self.send_json(result)
        except (ValueError, TypeError, KeyError) as exc:
            self.send_json({"error": str(exc)}, 400)
        except Exception:
            self.send_json({"error": "Excel 处理失败，本地数据未修改"}, 500)
