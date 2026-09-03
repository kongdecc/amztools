// Run with PLAYWRIGHT_MODULE pointing to the installed Playwright package.
// Uses isolated headless contexts, synthetic Excel and a local Python bridge.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import path from 'node:path';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
function python(args, input = '') {
  return new Promise((resolve, reject) => {
    const child = spawn(process.env.PYTHON || 'python', ['tests/freight_backend_bridge.py', ...args], { windowsHide: true });
    let stdout = '', stderr = '';
    child.stdout.on('data', data => stdout += data);
    child.stderr.on('data', data => stderr += data);
    child.on('error', reject);
    child.on('close', code => code ? reject(new Error(stderr)) : resolve(stdout.trim()));
    child.stdin.end(input);
  });
}
const browser = await chromium.launch({ headless: true, ...(process.env.PLAYWRIGHT_CHANNEL ? { channel: process.env.PLAYWRIGHT_CHANNEL } : {}) });
try {
  const contexts = await Promise.all([browser.newContext(), browser.newContext()]);
  const requests = [], errors = [];
  for (const context of contexts) {
    await context.route('**/*', async route => {
      const url = new URL(route.request().url());
      if (url.origin !== 'https://invoice.test') return route.abort();
      if (url.pathname === '/api/top-ad') return route.fulfill({ json: { enabled: false } });
      if (url.pathname === '/api/freight-invoice-python') {
        const envelope = route.request().postData();
        requests.push(JSON.parse(envelope));
        try { return await route.fulfill({ contentType: 'application/json', body: await python([], envelope) }); }
        catch (error) { errors.push(String(error)); return route.fulfill({ status: 500, json: { error: String(error) } }); }
      }
      const name = path.basename(url.pathname);
      const type = { '.js': 'application/javascript', '.css': 'text/css', '.html': 'text/html', '.json': 'application/json' }[path.extname(name)];
      if (!type) return route.fulfill({ status: 404, body: '' });
      return route.fulfill({ contentType: type, body: await readFile(path.join('public/freight-invoice', name)) });
    });
  }
  const pages = await Promise.all(contexts.map(context => context.newPage()));
  for (const page of pages) {
    page.on('pageerror', error => errors.push(String(error)));
    await page.goto('https://invoice.test/freight-invoice/index.html');
    await page.waitForFunction(() => state.config.appEdition === '浏览器独立存储版');
  }
  const fixture = await python(['--fixture']);
  const output = await pages[0].evaluate(async fixture => {
    async function api(url, payload) {
      const response = await fetch(url, payload === undefined ? undefined : { method: 'POST', body: JSON.stringify(payload) });
      const data = await response.json(); if (!response.ok) throw new Error(data.error); return data;
    }
    await api('/api/products', { products: [{ id: 'a', sku: 'A-only' }] });
    const upload = await api('/api/templates/upload', { filename: 'test.xlsx', name: '云拓测试', data: fixture });
    const id = upload.template.id;
    await api(`/api/templates/${id}/mapping`, { mapping: { sheet: 'Invoice', fixed: { hasBattery: 'B1', hasMagnet: 'D1' },
      required: { fixed: ['hasBattery', 'hasMagnet'], items: [] }, items: { headerRow: 2, startRow: 3, reservedRows: 1, columns: { exportSku: 'A', quantity: 'B' } } } });
    state.config = await api('/api/config'); state.templateId = id; state.shipment = {};
    state.items = [{ exportSku: 'A-only', quantity: 2, cartons: 1, currency: 'USD' }];
    renderInvoice();
    const defaults = [document.querySelector('[data-shipment=hasBattery]').value, document.querySelector('[data-shipment=hasMagnet]').value];
    if (invoiceValidationErrors().length) throw new Error(invoiceValidationErrors().join(';'));
    await api('/api/draft', invoiceDraftPayload());
    const payload = { templateId: id, shipment: state.shipment, items: state.items };
    await api('/api/preview', payload);
    const response = await fetch('/api/export', { method: 'POST', body: JSON.stringify(payload) });
    if (!response.ok) throw new Error(await response.text());
    const bytes = new Uint8Array(await response.arrayBuffer());
    const history = (await api('/api/history')).history;
    const saved = new Uint8Array(await (await fetch(`/api/history/${history[0].id}/file`)).arrayBuffer());
    return { defaults, historyCount: history.length, exactFile: bytes.length === saved.length && bytes.every((value, index) => value === saved[index]) };
  }, fixture);
  assert.deepEqual(output, { defaults: ['否', '否'], historyCount: 1, exactFile: true });
  const isolated = await pages[1].evaluate(async () => ({
    products: (await (await fetch('/api/products')).json()).products,
    history: (await (await fetch('/api/history')).json()).history,
    templates: (await (await fetch('/api/templates')).json()).templates,
  }));
  assert.deepEqual(isolated, { products: [], history: [], templates: [] });
  await pages[0].reload();
  await pages[0].waitForFunction(() => state.draftRecord && state.products.length === 1);
  assert.equal(await pages[0].evaluate(() => state.shipment.hasBattery), '否');
  assert.ok(requests.every(request => !request.snapshot && !Object.keys(request.files).some(name => /history|products|draft/.test(name))));
  assert.deepEqual(errors, []);
  console.log('PASS: actual Chromium IndexedDB + Python upload, mapping, defaults, preview, export, history, reload and independent browsers');
} finally {
  await browser.close();
}
