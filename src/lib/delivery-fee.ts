import { FBA_RATES, fbaMeasure, fbaCharge, fbaPriceIndex, fulfillmentAddons } from './delivery-rates';
import { getDeliverySeason } from './delivery-season';

export function calculateDeliveryFee(inputs: any) {
  const length = (value: any, unit: string) => (parseFloat(value) || 0) / (unit === 'cm' ? 2.54 : 1);
  const dimensions = [length(inputs.length, inputs.lengthUnit), length(inputs.width, inputs.widthUnit), length(inputs.height, inputs.heightUnit)];
  const actual = (parseFloat(inputs.actualWeight) || 0) * ({ lb: 1, oz: 1 / 16, g: 1 / 453.59237, kg: 1000 / 453.59237 }[inputs.weightUnit as string] ?? 1 / 16);
  const measurement = fbaMeasure(dimensions, actual);
  const settings = inputs.autoSeason ? getDeliverySeason() : inputs;
  const period = settings.season === 'peak' ? 'peak' : 'regular';
  const category = inputs.productType === 'danger' ? 'hazmat' : inputs.productType === 'apparel' ? 'apparel' : 'standard';
  const valid = actual > 0 && dimensions.every(value => value > 0) && !measurement.ambiguous;
  const charge = valid ? fbaCharge(period, category, measurement.section, measurement.index, measurement.ship, fbaPriceIndex(parseFloat(inputs.priceUSD) || 0)) : { fee: 0 };
  const addons = fulfillmentAddons(charge.fee, valid && !!inputs.hasLithium, valid);
  const surcharge = parseFloat(inputs.surchargeUSD) || 0;
  return {
    tier: measurement.section === 'small' ? '小号标准尺寸' : measurement.section === 'large' ? '大号标准尺寸' : measurement.index === 0 ? '小号大件' : measurement.index === 1 ? '大号大件' : '超大件',
    shipWeightOz: measurement.ship * 16,
    fee: valid ? charge.fee : 'N/A',
    lithiumUSD: addons.lithium,
    fuelUSD: addons.fuel,
    totalShippingFee: Math.round((addons.total + surcharge) * 100) / 100,
    surchargeSuggest: measurement.special,
    error: measurement.ambiguous ? '体积重量超过 150 磅、实际重量未超过 150 磅，请以卖家平台核对。' : !valid ? '请填写大于 0 的包装尺寸和商品重量。' : '',
  };
}

// Adapt the reference rows to the existing fee table and CSV export format.
export function deliveryRateTable(productType: string, season: string) {
  const category = productType === 'danger' ? 'hazmat' : productType === 'apparel' ? 'apparel' : 'standard';
  const rates = FBA_RATES[season === 'peak' ? 'peak' : 'regular'][category];
  const bands = (row: number[]) => ({ lt10: row[0], mid: row[1], high: row[2] });
  const columns = (rows: number[][]) => ({ lt10: rows.map(row => row[0]), mid: rows.map(row => row[1]), high: rows.map(row => row[2]) });
  const large = columns(rates.large.slice(0, 12));
  return {
    small_standard: { steps: [2,4,6,8,10,12,14,16], ...columns(rates.small) },
    large_standard: { pre3_steps_oz: [4,8,12,16,20,24,28,32,36,40,44,48], lt10_pre3: large.lt10, mid_pre3: large.mid, high_pre3: large.high, post3_base: bands(rates.large[12]), post3_increment_per_4oz: .08, post3_increment_per_half_lb: .16 },
    small_oversize_0_50: { base: bands(rates.bulky[0]), per_lb: .38 },
    large_oversize_0_50: { base: bands(rates.bulky[1]), per_lb: .38 },
    super_oversize_0_50: { base: bands(rates.bulky[2]), per_lb: .38 },
    super_oversize_50_70: { base: bands(rates.bulky[3]), start_lb: 51, per_lb: .75 },
    super_oversize_70_150: { base: bands(rates.bulky[4]), start_lb: 71, per_lb: .75 },
    super_oversize_gt_150: { base: bands(rates.bulky[5]), start_lb: 151, per_lb: .19 },
  };
}
