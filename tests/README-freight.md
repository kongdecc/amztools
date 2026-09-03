# Freight invoice browser isolation

Products, uploaded templates, custom fields, draft, and export history are owned
by IndexedDB `freight-invoice-private-data-v1` in the current browser and origin.
Only built-in warehouse and field definitions are common to all visitors.
Warehouse changes remain in their separate local browser store and are not
included in invoice backup, restore, or clear operations.

The Python endpoint is a stateless Excel processor, not a data service. Each
request supplies the browser's ZIP snapshot and runs in a new temporary folder.
The folder (including exports) is removed before sending the response. The
browser commits successful changes atomically before reporting success. Same-
origin tabs serialize operations with Web Locks where available. Excel processing
requires a network connection; downloading an existing ZIP backup does not.
Transport is capped at 4,000,000 bytes, including base64 overhead. Oversized
requests/results fail without replacing the last saved browser snapshot.

The former shared SiteSettings snapshot is deliberately neither imported nor
deleted: its ownership cannot be established. Public settings queries exclude
all `freight-invoice-` keys. Only an authenticated administrative backup can
retain the old record for manual investigation. The function no longer reads
Postgres or a shared data directory, and legacy direct API calls return 410.
Private browser namespaces do not auto-import old shared mirrors. A user can
manually restore a ZIP known to be their own. Clearing site storage removes
local data; users should download backups before doing so.

Run regressions (synthetic data only):

```powershell
python tests/test_freight_isolation.py
node --test tests/freight-browser-storage.test.mjs
node --check public/freight-invoice/browser-data-store.js
node --check public/freight-invoice/app.js
```

The Python suite covers separate snapshots, parallel processing, field/template
isolation, Excel upload/preview/export, history, backup/restore, clear, rejected
legacy requests, and cleanup after failure. The browser suite covers separate
IndexedDB stores and reloads, quota/network failures, cross-tab serialization,
local-only restore, offline backup, and oversized requests.
