import assert from 'node:assert/strict';
import { test } from 'node:test';
import { getDeliverySeason } from '../src/lib/delivery-season';

for (const [day, season, version] of [
  ['2025-10-14', 'non_peak', '2025'],
  ['2025-10-15', 'peak', '2025'],
  ['2026-01-14', 'peak', '2025'],
  ['2026-01-15', 'non_peak', '2026'],
  ['2026-10-14', 'non_peak', '2026'],
  ['2026-10-15', 'peak', '2026'],
  ['2026-10-17', 'peak', '2026'],
  ['2026-12-31', 'peak', '2026'],
  ['2027-01-01', 'peak', '2026'],
  ['2027-01-14', 'peak', '2026'],
  ['2027-01-15', 'non_peak', '2026'],
  ['2027-10-15', 'peak', '2026'],
] as const) {
  test(`delivery season on ${day}`, () => {
    const [year, month, date] = day.split('-').map(Number);
    assert.deepEqual(getDeliverySeason(new Date(year, month - 1, date)), { season, version });
  });
}
