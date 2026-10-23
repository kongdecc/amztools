import assert from 'node:assert/strict'
import { test } from 'node:test'
import { WORLD_CLOCKS, formatWorldClock, getBeijingDay, getHolidayCountdowns, getISOWeek, getSpringFestivalDay } from '../src/lib/home-calendar'

const day = (date: string) => Date.parse(`${date}T00:00:00Z`)
const countdown = (date: string, key: string) => getHolidayCountdowns(day(date)).find(holiday => holiday.key === key)!

test('world clocks match the six reference regions, including previous-day dates', () => {
  const now = new Date('2026-10-23T01:55:10Z')
  assert.deepEqual(WORLD_CLOCKS.map(clock => formatWorldClock(now, clock.zone)), [
    '10-23 09:55:10', '10-22 21:55:10', '10-22 18:55:10',
    '10-23 02:55:10', '10-23 03:55:10', '10-23 10:55:10',
  ])
})

test('US and European daylight saving change on their own local schedules', () => {
  for (const [zone, before, after, expectedBefore, expectedAfter] of [
    ['America/New_York', '2027-03-14T06:59:59Z', '2027-03-14T07:00:00Z', '03-14 01:59:59', '03-14 03:00:00'],
    ['America/Los_Angeles', '2027-03-14T09:59:59Z', '2027-03-14T10:00:00Z', '03-14 01:59:59', '03-14 03:00:00'],
    ['Europe/London', '2027-03-28T00:59:59Z', '2027-03-28T01:00:00Z', '03-28 00:59:59', '03-28 02:00:00'],
    ['Europe/Berlin', '2027-03-28T00:59:59Z', '2027-03-28T01:00:00Z', '03-28 01:59:59', '03-28 03:00:00'],
    ['America/New_York', '2026-11-01T05:59:59Z', '2026-11-01T06:00:00Z', '11-01 01:59:59', '11-01 01:00:00'],
  ]) {
    assert.equal(formatWorldClock(new Date(before), zone), expectedBefore)
    assert.equal(formatWorldClock(new Date(after), zone), expectedAfter)
  }
  assert.equal(formatWorldClock(new Date('2027-01-01T15:00:00Z'), 'Asia/Tokyo'), '01-02 00:00:00')
})

test('calendar switches at Beijing midnight, regardless of visitor timezone', () => {
  assert.equal(getBeijingDay(new Date('2026-12-31T15:59:59Z')), day('2026-12-31'))
  const midnight = getBeijingDay(new Date('2026-12-31T16:00:00Z'))
  assert.equal(midnight, day('2027-01-01'))
  assert.equal(getHolidayCountdowns(midnight).find(h => h.key === 'new-year')?.days, 0)
})

test('ISO week numbers retain the correct week year at year boundaries', () => {
  for (const [date, year, week] of [
    ['2026-10-23', 2026, 43], ['2026-12-31', 2026, 53],
    ['2027-01-01', 2026, 53], ['2027-01-04', 2027, 1],
    ['2028-01-01', 2027, 52], ['2028-01-03', 2028, 1],
    ['2029-12-31', 2030, 1],
  ] as const) {
    assert.deepEqual(getISOWeek(day(date)), { year, week })
  }
})

test('Spring Festival dates match official HKO tables through 2030', () => {
  for (const date of ['2026-02-17', '2027-02-06', '2028-01-26', '2029-02-13', '2030-02-03']) {
    assert.equal(getSpringFestivalDay(Number(date.slice(0, 4))), day(date))
    assert.equal(countdown(date, 'spring-festival').days, 0)
  }
})

test('holidays include today and move to the following year only after the holiday', () => {
  assert.equal(countdown('2026-10-23', 'christmas').days, 63)
  assert.equal(countdown('2026-10-23', 'new-year').days, 70)
  assert.equal(countdown('2026-10-23', 'spring-festival').days, 106)
  assert.equal(countdown('2026-12-25', 'christmas').days, 0)
  assert.equal(countdown('2026-12-26', 'christmas').date, '2027-12-25')
  assert.equal(countdown('2027-01-02', 'new-year').date, '2028-01-01')
  assert.equal(countdown('2027-02-07', 'spring-festival').date, '2028-01-26')
  assert.equal(countdown('2028-01-27', 'spring-festival').date, '2029-02-13')
})

test('every day over the next two years has valid next-occurrence countdowns, including leap day', () => {
  for (let today = day('2026-10-23'); today <= day('2028-10-23'); today += 86_400_000) {
    for (const holiday of getHolidayCountdowns(today)) {
      assert.ok(Number.isInteger(holiday.days) && holiday.days >= 0 && holiday.days < 390)
      assert.equal(day(holiday.date) - today, holiday.days * 86_400_000)
    }
  }
})
