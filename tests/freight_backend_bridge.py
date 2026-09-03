"""Synthetic, stdin/stdout-only bridge for the headless browser regression."""
import base64
import importlib.util
import io
import json
import sys
from pathlib import Path

spec = importlib.util.spec_from_file_location('freight', Path(__file__).resolve().parents[1] / 'api/freight-invoice-python.py')
backend = importlib.util.module_from_spec(spec)
spec.loader.exec_module(backend)
if '--fixture' in sys.argv:
    from openpyxl import Workbook
    book = Workbook()
    sheet = book.active
    sheet.title = 'Invoice'
    sheet.append(['带电', '', '带磁', ''])
    sheet.append(['SKU', 'Quantity'])
    output = io.BytesIO()
    book.save(output)
    book.close()
    print(base64.b64encode(output.getvalue()).decode())
else:
    print(json.dumps(backend.execute(json.loads(sys.stdin.buffer.read().decode('utf-8'))), ensure_ascii=True))
