import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { test } from 'node:test';
import { randomBytes } from 'node:crypto';
import JSZip from 'jszip';

const source = readFileSync(new URL('../public/freight-invoice/browser-data-store.js', import.meta.url), 'utf8');
const pack = value => Buffer.from(JSON.stringify(value)).toString('base64');
const unpack = value => value ? JSON.parse(Buffer.from(value, 'base64').toString()) : {};

function memory() { return { rows: new Map(), failWrites: false, lock: Promise.resolve() }; }

function browser(storage = memory(), processor = null) {
  const calls = [];
  let offline = false;
  const db = {
    close() {}, createObjectStore() {},
    transaction(name, mode) {
      const transaction = { objectStore() {
        return {
          get(key) {
            const request = {};
            setTimeout(() => { request.result = storage.rows.get(key); transaction.oncomplete?.(); }, 0);
            return request;
          },
          put(value, key) {
            setTimeout(() => {
              if (storage.failWrites) transaction.onabort?.();
              else { storage.rows.set(key, value); transaction.oncomplete?.(); }
            }, 0);
            return {};
          },
        };
      } };
      return transaction;
    },
  };
  const context = {
    URL, Response, Request, Headers, Blob, Uint8Array, atob, btoa, TextEncoder, TextDecoder, JSZip,
    indexedDB: { open(name) {
      assert.equal(name, 'freight-invoice-private-data-v1');
      const request = { result: db };
      setTimeout(() => request.onsuccess(), 0);
      return request;
    } },
    navigator: { locks: { request(name, run) {
      const result = storage.lock.then(run);
      storage.lock = result.catch(() => {});
      return result;
    } } },
    location: { origin: 'https://site.test' },
    async fetch(url, options) {
      if (offline) throw new Error('offline');
      assert.equal(url, '/api/freight-invoice-python');
      assert.equal(options.method, 'POST');
      const envelope = JSON.parse(options.body);
      calls.push(envelope);
      assert.equal(envelope.protocol, 'freight-browser-v2');
      assert.equal(envelope.snapshot, undefined);
      assert.ok(Object.keys(envelope.files).every(name => name === 'custom_templates.json' || name === 'template_settings.json' || name.startsWith('custom_templates/')));
      if (processor) return Response.json(await processor(envelope));
      return Response.json({ protocol: envelope.protocol, status: 200, headers: { 'Content-Type': 'application/json' }, body: pack({ templates: unpack(envelope.files['custom_templates.json']) }) });
    },
  };
  context.window = context;
  vm.runInNewContext(source, context);
  return {
    storage, calls,
    offline() { offline = true; },
    request: context.freightInvoiceDataFetch,
    async products() { return (await (await context.freightInvoiceDataFetch('/api/products')).json()).products; },
    save(products) { return context.freightInvoiceDataFetch('/api/products', { method: 'POST', body: JSON.stringify({ products }) }); },
  };
}

test('two browsers and reloads never exchange local snapshots', async () => {
  const a = browser(), b = browser();
  await a.save([{ sku: 'A-secret' }]);
  assert.deepEqual(await b.products(), []);
  assert.deepEqual(await browser(a.storage).products(), [{ sku: 'A-secret' }]);
  await b.save([{ sku: 'B-secret' }]);
  assert.deepEqual(await a.products(), [{ sku: 'A-secret' }]);
  assert.equal(a.request('/api/top-ad'), null);
  assert.equal(a.request('https://other.test/api/products'), null);
});

test('quota failure preserves state; products, draft and backup work offline', async () => {
  const a = browser();
  await a.save([{ sku: 'keep' }]);
  a.storage.failWrites = true;
  await assert.rejects(a.save([{ sku: 'lose' }]), /存储失败/);
  a.storage.failWrites = false;
  assert.deepEqual(await a.products(), [{ sku: 'keep' }]);
  a.offline();
  await a.save([{ sku: 'saved-offline' }]);
  await a.request('/api/draft', { method: 'POST', body: JSON.stringify({ shipment: {}, items: [] }) });
  const before = a.storage.rows.get('snapshot').encoded;
  await assert.rejects(a.request('/api/preview', { method: 'POST', body: '{}' }), /offline/);
  assert.equal(a.storage.rows.get('snapshot').encoded, before);
  const backup = await a.request('/api/backup');
  const zip = await JSZip.loadAsync(await backup.arrayBuffer());
  assert.deepEqual(JSON.parse(await zip.file('products.json').async('string')), [{ sku: 'saved-offline' }]);
  assert.ok(zip.file('invoice_draft.json'));
  assert.equal(a.calls.length, 0);
});

test('same-browser tabs serialize operations and restore affects only that browser', async () => {
  const a = browser(), tab = browser(a.storage), b = browser();
  await Promise.all([a.save([{ sku: 'first' }]), tab.save([{ sku: 'last' }])]);
  assert.deepEqual(await a.products(), [{ sku: 'last' }]);
  const backup = await (await a.request('/api/backup')).blob();
  await a.request('/api/restore', { method: 'POST', body: backup });
  assert.deepEqual(await b.products(), []);
  assert.equal(a.calls.length, 0); // Restore never sends any data to a server.
});

test('oversized CURRENT operation fails without changing local data', async () => {
  const a = browser();
  await a.save([{ sku: 'keep' }]);
  await assert.rejects(a.request('/api/preview', { method: 'POST', body: JSON.stringify({ items: [{ image: 'x'.repeat(4000000) }] }) }), /单次在线传输/);
  assert.equal(a.calls.length, 0);
  assert.deepEqual(await a.products(), [{ sku: 'keep' }]);
});

async function seedArchive(storage, zip) {
  zip.file('backup_manifest.json', JSON.stringify({ format: 'freight-invoice-full-backup', formatVersion: 1 }));
  storage.rows.set('snapshot', { encoded: await zip.generateAsync({ type: 'base64', compression: 'DEFLATE' }), counts: {} });
}

test('large existing private data is preserved, but only current workbook travels', async () => {
  const storage = memory(), zip = new JSZip();
  const record = { id: 'tpl-aaaaaaaaaa', storedFile: 'tpl-aaaaaaaaaa.xlsx', mapping: { required: { fixed: [], items: [] } } };
  const other = { id: 'tpl-bbbbbbbbbb', storedFile: 'tpl-bbbbbbbbbb.xlsx' };
  zip.file('custom_templates.json', JSON.stringify([record, other]));
  zip.file('custom_templates/tpl-aaaaaaaaaa.xlsx', new Uint8Array([1, 2, 3]));
  zip.file('custom_templates/tpl-bbbbbbbbbb.xlsx', randomBytes(2000000));
  zip.file('history_files/20260101000000-aaaaaaaa.xlsx', randomBytes(4000000));
  zip.file('export_history.json', JSON.stringify([{ id: '20260101000000-aaaaaaaa', payload: { secret: true } }]));
  zip.file('products.json', JSON.stringify([{ sku: 'private-library' }]));
  await seedArchive(storage, zip);
  assert.ok(storage.rows.get('snapshot').encoded.length > 4000000);
  const a = browser(storage);
  await a.request('/api/preview', { method: 'POST', body: JSON.stringify({ templateId: record.id, shipment: {}, items: [{ sku: 'current' }] }) });
  assert.deepEqual(Object.keys(a.calls[0].files).sort(), ['custom_templates.json', 'custom_templates/tpl-aaaaaaaaaa.xlsx']);
  assert.ok(JSON.stringify(a.calls[0]).length < 2000);
  assert.deepEqual(await a.products(), [{ sku: 'private-library' }]);
  a.offline();
  const backup = await (await a.request('/api/backup')).blob();
  await a.request('/api/restore', { method: 'POST', body: backup });
  const restored = await JSZip.loadAsync(storage.rows.get('snapshot').encoded, { base64: true });
  assert.equal((await restored.file('history_files/20260101000000-aaaaaaaa.xlsx').async('uint8array')).length, 4000000);
  assert.equal(a.calls.length, 1);
});

test('export stores the returned Excel once locally; metadata updates preserve other templates', async () => {
  const storage = memory(), zip = new JSZip();
  const aRecord = { id: 'tpl-aaaaaaaaaa', storedFile: 'tpl-aaaaaaaaaa.xlsx' }, bRecord = { id: 'tpl-bbbbbbbbbb', storedFile: 'tpl-bbbbbbbbbb.xlsx' };
  zip.file('custom_templates.json', JSON.stringify([aRecord, bRecord]));
  zip.file('custom_templates/tpl-aaaaaaaaaa.xlsx', 'template A');
  zip.file('custom_templates/tpl-bbbbbbbbbb.xlsx', 'template B');
  await seedArchive(storage, zip);
  const content = randomBytes(2300000), id = '20260101000000-1234abcd';
  const a = browser(storage, envelope => ({ protocol: envelope.protocol, status: 200, headers: {},
    body: envelope.path === '/export' ? content.toString('base64') : pack({ status: 'ok' }),
    changes: envelope.path === '/export' ? {} : { 'custom_templates.json': pack([{ ...aRecord, name: 'changed' }]) }, removed: [],
    ...(envelope.path === '/export' ? { historyRecord: { id, filename: 'test.xlsx' } } : {}) }));
  await a.request(`/api/templates/${aRecord.id}/mapping`, { method: 'POST', body: '{}' });
  let saved = await JSZip.loadAsync(storage.rows.get('snapshot').encoded, { base64: true });
  const records = JSON.parse(await saved.file('custom_templates.json').async('string'));
  assert.equal(records.length, 2);
  assert.ok(saved.file('custom_templates/tpl-bbbbbbbbbb.xlsx'));
  const payload = { templateId: aRecord.id, shipment: { hasBattery: '否', hasMagnet: '否' }, items: [{ sku: 'current' }] };
  const response = await a.request('/api/export', { method: 'POST', body: JSON.stringify(payload) });
  assert.deepEqual(Buffer.from(await response.arrayBuffer()), content);
  a.offline();
  assert.deepEqual(Buffer.from(await (await a.request(`/api/history/${id}/file`)).arrayBuffer()), content);
  const history = await (await a.request(`/api/history/${id}`)).json();
  assert.deepEqual(history.record.payload, payload);
});

test('invalid restore is atomic, and legacy warehouse data is excluded', async () => {
  const a = browser(); await a.save([{ sku: 'keep' }]);
  const before = a.storage.rows.get('snapshot').encoded;
  await assert.rejects(a.request('/api/restore', { method: 'POST', body: 'bad zip' }));
  assert.equal(a.storage.rows.get('snapshot').encoded, before);
  const zip = new JSZip();
  zip.file('backup_manifest.json', JSON.stringify({ format: 'freight-invoice-full-backup', formatVersion: 1 }));
  zip.file('warehouses.json', '[{"code":"ignore"}]');
  zip.file('products.json', '[]');
  await a.request('/api/restore', { method: 'POST', body: await zip.generateAsync({ type: 'uint8array' }) });
  const saved = await JSZip.loadAsync(a.storage.rows.get('snapshot').encoded, { base64: true });
  assert.equal(saved.file('warehouses.json'), null);
  assert.equal(a.calls.length, 0);
});

test('local clear and delete never affect another browser or call the processor', async () => {
  const a = browser(), b = browser();
  await a.save([{ id: 'one', sku: 'A' }, { id: 'two', sku: 'A2' }]);
  await b.save([{ sku: 'B' }]);
  await a.request('/api/products/bulk-delete', { method: 'POST', body: JSON.stringify({ ids: ['one'] }) });
  assert.deepEqual(await a.products(), [{ id: 'two', sku: 'A2' }]);
  await a.request('/api/data/clear-all', { method: 'POST', body: JSON.stringify({ confirmation: 'CLEAR_ALL_DATA' }) });
  assert.deepEqual(await a.products(), []);
  assert.deepEqual(await b.products(), [{ sku: 'B' }]);
  assert.equal(a.calls.length + b.calls.length, 0);
});

test('legacy template required metadata is inferred once without unrelated files', async () => {
  const storage = memory(), zip = new JSZip();
  const record = { id: 'tpl-aaaaaaaaaa', storedFile: 'tpl-aaaaaaaaaa.xlsx', mapping: { fixed: { service: 'B1' } } };
  zip.file('custom_templates.json', JSON.stringify([record]));
  zip.file('custom_templates/tpl-aaaaaaaaaa.xlsx', 'test workbook');
  await seedArchive(storage, zip);
  const a = browser(storage, envelope => ({ protocol: envelope.protocol, status: 200, headers: {}, body: pack(
    envelope.path === `/templates/${record.id}` ? { template: { ...record, mapping: { ...record.mapping, required: { fixed: ['service'], items: [] } } } } : { templates: [] }) }));
  await a.request('/api/config');
  await a.request('/api/config');
  assert.equal(a.calls.filter(call => call.path === `/templates/${record.id}`).length, 1);
  assert.ok(a.calls.filter(call => call.path === '/config').every(call => !call.files['custom_templates/tpl-aaaaaaaaaa.xlsx']));
  const saved = await JSZip.loadAsync(storage.rows.get('snapshot').encoded, { base64: true });
  assert.deepEqual(JSON.parse(await saved.file('custom_templates.json').async('string'))[0].mapping.required.fixed, ['service']);
});
