# Freight invoice browser isolation

Products, uploaded templates, custom fields, draft, and export history are owned
by IndexedDB `freight-invoice-private-data-v1` in the current browser and origin.
Only built-in warehouse and field definitions are common to all visitors.
Warehouse changes remain in their separate local browser store and are not
included in invoice backup, restore, or clear operations.

The Python endpoint is a stateless Excel processor, not a data service. The v2
protocol supplies only the selected template and current invoice (catalog reads
send metadata only), and runs in a new temporary folder. Products, drafts,
history reads/deletes, backup/restore, and clearing data are entirely local.
Responses carry changed template/settings files, not a full snapshot. Exported
Excel bytes are returned once; the browser adds its own history and payload.
The folder (including exports) is removed before sending the response. The
browser commits successful changes atomically before reporting success. Same-
origin tabs serialize operations with Web Locks where available. Excel processing
requires a network connection; local data operations do not. The existing
private IndexedDB name and ZIP format are preserved across upgrades. Old
templates missing required-field metadata are analyzed once before metadata-
only catalog reads. Restore validates paths, format, record types and referenced
template files, and has a 256MB local compressed/expanded safety cap.
Transport is capped at 4,000,000 bytes per operation, including encoding overhead;
this is NOT a limit on the whole browser dataset. Oversized current templates,
invoice images, or preview results still require smaller files/split invoices,
and fail without replacing saved data. Deleting unrelated history is unnecessary.

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
node --test tests/freight-defaults.test.mjs
node --check public/freight-invoice/browser-data-store.js
node --check public/freight-invoice/app.js
```

The Python suite covers separate snapshots, parallel processing, field/template
isolation, Excel upload/preview/export, history, backup/restore, clear, rejected
legacy requests, and cleanup after failure. The browser suite covers separate
IndexedDB stores and reloads, quota/network failures, cross-tab serialization,
local-only restore, offline CRUD/backup, large existing datasets, delta merging,
single-copy exports, and oversized current requests. Default-value regressions
check uploaded Yuntuo templates, preserving explicit yes values, required-field
checks and the actual Excel output.

For a real isolated browser + Python integration test, set `PLAYWRIGHT_MODULE`
to an installed Playwright package, optionally set `PLAYWRIGHT_CHANNEL=msedge`
to use installed Edge, and run `node tests/freight-e2e.mjs`. This intercepts all
network requests, uses only synthetic data, and never opens a personal profile.
