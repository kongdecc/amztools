import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';

const sourceUrl = new URL('../src/components/fba_warehouses_data.json', import.meta.url);
const targetUrl = new URL('../public/freight-invoice/warehouses.json', import.meta.url);
const source = JSON.parse(readFileSync(sourceUrl, 'utf8'));
const presets = JSON.parse(readFileSync(targetUrl, 'utf8'));
const countryCodes = {
  美国: 'US', 加拿大: 'CA', 英国: 'GB', 德国: 'DE', 法国: 'FR', 西班牙: 'ES',
  意大利: 'IT', 日本: 'JP', 澳大利亚: 'AU', 波兰: 'PL', 墨西哥: 'MX',
};
const baseCode = code => code.replace(/\[AWD\]$/i, '');
const awdCodes = new Set(source.filter(row => /\[AWD\]$/i.test(row.Code)).map(row => baseCode(row.Code)));
let labeled = 0;
for (const preset of presets) {
  if (awdCodes.has(preset.code)) { preset.code += '[AWD]'; labeled++; }
}
const existingCodes = new Set(presets.map(row => row.code));
const existingIds = new Set(presets.map(row => row.id));

// These source addresses split the city across commas or repeat locality names.
const streetOverrides = {
  DTW5: '19991 Brownstown Center Dr',
  GGE2: '134 Main Street',
  XFR3: 'STADTRING 265',
};
function streetAddress(row) {
  if (streetOverrides[baseCode(row.Code)]) return streetOverrides[baseCode(row.Code)];
  const full = row['地址'];
  const city = row['城市'];
  const index = city ? full.toLocaleLowerCase().lastIndexOf(city.toLocaleLowerCase()) : -1;
  // Existing street-only addresses are already suitable for an invoice.
  if (index < 0) return full;
  let street = full.slice(0, index).replace(/[,\s]+$/, '');
  // Some European/Mexican addresses put the postal code before the city.
  if (row['邮编'] && street.endsWith(row['邮编'])) {
    street = street.slice(0, -row['邮编'].length).replace(/[,\s]+$/, '');
  }
  assert(street, `Missing street address for ${row.Code}`);
  return street;
}

let added = 0;
for (const row of source) {
  if (existingCodes.has(row.Code)) continue;
  const country = row['国家'];
  const record = {
    code: row.Code, country,
    countryCode: countryCodes[country] || (/^[A-Z]{2}$/.test(country) ? country : ''),
    region: row['地区'], address: streetAddress(row), city: row['城市'],
    state: row['洲/省'], postalCode: row['邮编'],
  };
  assert(record.countryCode, `Missing country code for ${row.Code}`);
  record.id = `wh-${createHash('sha256').update(JSON.stringify(record)).digest('hex').slice(0, 12)}`;
  assert(!existingIds.has(record.id), `Duplicate warehouse ID: ${record.id}`);
  presets.push(record);
  existingCodes.add(record.code);
  existingIds.add(record.id);
  added++;
}
assert.equal(existingIds.size, presets.length);
writeFileSync(targetUrl, JSON.stringify(presets, null, 2) + '\n');
console.log(`Warehouse presets: added ${added}, labeled ${labeled} AWD, total ${presets.length}.`);
