import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { test } from 'node:test';
import { calculateDeliveryFee, deliveryRateTable } from '../src/lib/delivery-fee';
import { FBA_RATES } from '../src/lib/delivery-rates';

const reference = vm.createContext({});
vm.runInContext(readFileSync('public/amazon-fee-visualizer/fba-data.js', 'utf8') + '\n' + readFileSync('public/amazon-fee-visualizer/fba.js', 'utf8'), reference);
const plain = (value: any) => JSON.parse(JSON.stringify(value));

test('all 2026 rate cells match the visualizer source', () => {
  assert.deepEqual(FBA_RATES, plain(vm.runInContext('FBA_RATES', reference)));
  for (const [type, category] of [['normal', 'standard'], ['apparel', 'apparel'], ['danger', 'hazmat']]) {
    for (const season of ['peak', 'non_peak']) {
      const table = deliveryRateTable(type, season);
      const rates = FBA_RATES[season === 'peak' ? 'peak' : 'regular'][category];
      for (const [column, band] of ['lt10', 'mid', 'high'].entries()) {
        assert.deepEqual(table.small_standard[band], rates.small.map(row => row[column]));
        assert.deepEqual(table.large_standard[band + '_pre3'], rates.large.slice(0, 12).map(row => row[column]));
        assert.equal(table.large_standard.post3_base[band], rates.large[12][column]);
        const bulky = ['small_oversize_0_50', 'large_oversize_0_50', 'super_oversize_0_50', 'super_oversize_50_70', 'super_oversize_70_150', 'super_oversize_gt_150'];
        bulky.forEach((key, index) => assert.equal(table[key].base[band], rates.bulky[index][column]));
      }
    }
  }
});

test('delivery totals match the visualizer across categories, prices, seasons and size boundaries', () => {
  const shapes = [[10, 5, .5], [18, 14, 8], [20, 1, 1], [37, 10, 2], [37.01, 10, 2], [59, 10, 2], [59.01, 10, 2], [97, 5, 2]];
  const weights = [.125,.25,.5,.75,1,1.25,1.5,2.25,2.75,3,3.01,20,50,50.01,51,51.01,70,70.01,71,71.01,150,150.01,151,151.01];
  for (const dimensions of shapes) for (const weight of weights) {
    reference.dimensions = dimensions;
    reference.actual = weight;
    const m = vm.runInContext('fbaMeasure(dimensions, actual)', reference);
    for (const [type, category] of [['normal','standard'], ['apparel','apparel'], ['danger','hazmat']]) {
      for (const season of ['peak','non_peak']) for (const price of [0,9.99,10,50,50.01]) for (const lithium of [false,true]) {
        const result = calculateDeliveryFee({ length: dimensions[0], width: dimensions[1], height: dimensions[2], actualWeight: weight, weightUnit: 'lb', priceUSD: price, productType: type, season, version: '2026', hasLithium: lithium });
        if (m.ambiguous) { assert.equal(result.fee, 'N/A'); assert.ok(result.error); continue; }
        Object.assign(reference, { period: season === 'peak' ? 'peak' : 'regular', category, price, lithium });
        const expected = vm.runInContext('fulfillmentAddons(fbaCharge(period, category, fbaMeasure(dimensions, actual).section, fbaMeasure(dimensions, actual).index, fbaMeasure(dimensions, actual).ship, fbaPriceIndex(price)).fee, lithium, true)', reference);
        assert.equal(result.totalShippingFee, expected.total, JSON.stringify({ dimensions, weight, type, season, price, lithium }));
        assert.equal(result.fuelUSD, expected.fuel);
        assert.equal(result.shipWeightOz, m.ship * 16);
      }
    }
  }
});

test('metric units and optional surcharge preserve reference calculation', () => {
  const input = { length: 10, width: 5, height: .5, actualWeight: 1, weightUnit: 'lb', priceUSD: 20, productType: 'normal', season: 'peak', version: '2026' };
  const base = calculateDeliveryFee(input);
  const metric = calculateDeliveryFee({ ...input, length: 25.4, width: 12.7, height: 1.27, lengthUnit: 'cm', widthUnit: 'cm', heightUnit: 'cm', actualWeight: 453.59237, weightUnit: 'g' });
  assert.equal(metric.totalShippingFee, base.totalShippingFee);
  assert.equal(calculateDeliveryFee({ ...input, surchargeUSD: 2 }).totalShippingFee, Math.round((base.totalShippingFee + 2) * 100) / 100);
  assert.ok(calculateDeliveryFee({ ...input, length: 0 }).error);
});
