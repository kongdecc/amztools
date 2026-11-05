import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { test } from 'node:test';

const presets = JSON.parse(readFileSync(new URL('../public/freight-invoice/warehouses.json', import.meta.url), 'utf8'));
const storeScript = readFileSync(new URL('../public/freight-invoice/warehouse-browser-store.js', import.meta.url), 'utf8');
const appScript = readFileSync(new URL('../public/freight-invoice/app.js', import.meta.url), 'utf8');
function browserStore(localState = {}) {
  const local = new Map([['freight-invoice-browser-warehouses-v1', JSON.stringify(localState)]]);
  const window = {
    location: { origin: 'https://example.test', href: 'https://example.test/freight-invoice/index.html' },
    fetch: async () => new Response(JSON.stringify(presets)),
  };
  const context = vm.createContext({ window, document: { currentScript: null }, URL, Response, Request,
    localStorage: { getItem: key => local.get(key), setItem: (key, value) => local.set(key, value) } });
  vm.runInContext(storeScript, context);
  return async query => (await window.freightInvoiceWarehouseFetch(`/api/warehouses?${query}`)).json();
}

test('updated presets are searchable by AWD label, code and international postal code', async () => {
  const search = browserStore();
  assert.equal((await search('q=AWD&limit=100')).total, 13);
  const result = await search('q=IUSL');
  assert.equal(result.total, 1);
  assert.equal(result.warehouses[0].code, 'IUSL[AWD]');
  assert.equal(result.warehouses[0].address, '600 Principio Parkway West');
  assert.equal((await search('q=T2C%205V8')).warehouses[0].code, 'YYC6');
  assert.equal((await search('q=MEX1')).warehouses[0].countryCode, 'MX');
});

test('existing browser edits and deletions still apply to refreshed defaults', async () => {
  const originalId = 'wh-cfe7da385759'; // KRB7 ID from the previous preset file.
  const original = presets.find(row => row.id === originalId);
  assert.equal(original.code, 'KRB7[AWD]');
  const custom = { ...original, address: 'Browser-owned edited address' };
  const edited = browserStore({ overrides: { [originalId]: custom } });
  assert.equal((await edited('q=KRB7')).warehouses[0].address, custom.address);
  const deleted = browserStore({ deletedIds: [originalId] });
  assert.equal((await deleted('q=KRB7')).total, 0);
});

test('selecting AWD presets fills separate invoice fields and exports the bare code', () => {
  const state = { shipment: {} };
  const context = vm.createContext({ state, $: () => null,
    closeWarehouseResults() {}, renderShipmentFields() {}, renderSelectedWarehouse() {},
    invalidatePreview() {}, updateSummary() {}, toast() {} });
  vm.runInContext(appScript.slice(appScript.indexOf('function normalizedWarehouseCode'), appScript.indexOf('function renderWarehouseResults')), context);
  vm.runInContext(appScript.slice(appScript.indexOf('function selectWarehouse('), appScript.indexOf('\n}', appScript.indexOf('function selectWarehouse(')) + 2), context);
  context.selectWarehouse(presets.find(row => row.code === 'IUSL[AWD]'));
  assert.equal(state.shipment.warehouseCode, 'IUSL');
  assert.equal(state.shipment.address1, '600 Principio Parkway West');
  assert.equal(state.shipment.city, 'North East');
  assert.equal(state.shipment.state, 'MD');
  assert.equal(state.shipment.postalCode, '21901');
  assert.equal(state.shipment.countryCode, 'US');
  assert.equal(context.normalizedWarehouseCode({ code: 'KRB7[AWD]' }), 'KRB7');
  assert.equal(context.normalizedWarehouseCode({ code: 'SCK4 (偏远)' }), 'SCK4');
});
