import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { test } from 'node:test';

const source = readFileSync(new URL('../public/freight-invoice/browser-data-store.js', import.meta.url), 'utf8');
const pack = value => Buffer.from(JSON.stringify(value)).toString('base64');
const unpack = value => value ? JSON.parse(Buffer.from(value, 'base64').toString()) : {};

function memory() { return { rows: new Map(), failWrites: false, lock: Promise.resolve() }; }

function browser(storage = memory()) {
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
    URL, Response, Request, Headers, Blob, Uint8Array, atob, btoa,
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
      assert.equal(envelope.protocol, 'freight-browser-v1');
      let state = unpack(envelope.snapshot);
      const data = unpack(envelope.body);
      if (envelope.path === '/restore') state = data;
      if (envelope.path === '/products' && envelope.method === 'POST') state.products = data.products;
      const result = { protocol: envelope.protocol, status: 200, headers: { 'Content-Type': 'application/json' }, body: pack({ products: state.products || [] }) };
      if (envelope.method !== 'GET') { result.snapshot = pack(state); result.counts = { products: state.products?.length || 0 }; }
      return Response.json(result);
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

test('quota and network failures do not commit or acknowledge success', async () => {
  const a = browser();
  await a.save([{ sku: 'keep' }]);
  a.storage.failWrites = true;
  await assert.rejects(a.save([{ sku: 'lose' }]), /存储失败/);
  a.storage.failWrites = false;
  assert.deepEqual(await a.products(), [{ sku: 'keep' }]);
  a.offline();
  await assert.rejects(a.save([{ sku: 'lose' }]), /offline/);
  const backup = await a.request('/api/backup');
  assert.deepEqual(JSON.parse(await backup.text()), { products: [{ sku: 'keep' }] });
});

test('same-browser tabs serialize operations and restore affects only that browser', async () => {
  const a = browser(), tab = browser(a.storage), b = browser();
  await Promise.all([a.save([{ sku: 'first' }]), tab.save([{ sku: 'last' }])]);
  assert.deepEqual(await a.products(), [{ sku: 'last' }]);
  const backup = await (await a.request('/api/backup')).blob();
  await a.request('/api/restore', { method: 'POST', body: backup });
  assert.deepEqual(await b.products(), []);
  assert.equal(a.calls.at(-1).snapshot, ''); // Restore never merges previous data.
});

test('oversized requests fail before sending and preserve stored data', async () => {
  const a = browser();
  await a.save([{ sku: 'keep' }]);
  await assert.rejects(a.save([{ image: 'x'.repeat(4000000) }]), /容量/);
  assert.equal(a.calls.length, 1);
  assert.deepEqual(await a.products(), [{ sku: 'keep' }]);
});
