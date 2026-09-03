import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { test } from 'node:test';

const source = readFileSync(new URL('../public/freight-invoice/app.js', import.meta.url), 'utf8');
function setup(shipment = {}) {
  const state = { shipment, items: [{ currency: 'USD' }], templateId: 'tpl-aaaaaaaaaa',
    config: { templates: [{ id: 'tpl-aaaaaaaaaa', fixedFieldKeys: ['hasBattery', 'hasMagnet'], requiredFixedKeys: ['hasBattery', 'hasMagnet'] }] } };
  const context = { state, CURRENCIES: ['USD', 'EUR'], esc: String, num: Number };
  vm.createContext(context);
  vm.runInContext(source.slice(source.indexOf('function requiredValueMissing'), source.indexOf('function isCartonTemplate')), context);
  vm.runInContext(source.slice(source.indexOf('function fieldHtml'), source.indexOf('function renderShipmentFields')), context);
  vm.runInContext(source.slice(source.indexOf('function invoiceDraftPayload'), source.indexOf('function setDraftStatus')), context);
  return context;
}
test('uploaded Yuntuo template defaults are real data for validation, draft and display', () => {
  const c = setup();
  assert.equal(vm.runInContext('invoiceValidationErrors().length', c), 0);
  assert.equal(c.state.shipment.hasBattery, '否');
  assert.equal(c.state.shipment.hasMagnet, '否');
  assert.match(vm.runInContext("fieldHtml(['hasBattery','带电','yesno','否'])", c), /<option selected>否/);
  assert.equal(vm.runInContext('invoiceDraftPayload().shipment.hasMagnet', c), '否');
});
test('saved yes values survive default initialization and template switches', () => {
  const c = setup({ hasBattery: '是', hasMagnet: '是', currency: 'EUR', service: '' });
  vm.runInContext('applyShipmentSelectDefaults(); applyShipmentSelectDefaults()', c);
  assert.equal(c.state.shipment.hasBattery, '是');
  assert.equal(c.state.shipment.hasMagnet, '是');
  assert.equal(c.state.shipment.currency, 'EUR');
  assert.equal(c.state.shipment.service, ''); // Never fill routing choices from sample text.
});
test('legacy empty yes/no state is normalized but missing required text still fails', () => {
  const c = setup({ hasBattery: '', hasMagnet: null });
  c.state.config.templates[0].fixedFieldKeys.push('service');
  c.state.config.templates[0].requiredFixedKeys.push('service');
  assert.equal(vm.runInContext('invoiceValidationErrors().length', c), 1);
  assert.equal(c.state.shipment.hasBattery, '否');
  assert.equal(c.state.shipment.hasMagnet, '否');
});
