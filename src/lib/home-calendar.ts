const DAY_MS = 86_400_000
const BEIJING_OFFSET_MS = 8 * 60 * 60 * 1000

export const WORLD_CLOCKS = [
  { label: '北京', zone: 'Asia/Shanghai', country: 'cn', city: '北京' },
  { label: '美东', zone: 'America/New_York', country: 'us', city: '纽约' },
  { label: '美西', zone: 'America/Los_Angeles', country: 'us', city: '洛杉矶' },
  { label: '英国', zone: 'Europe/London', country: 'gb', city: '伦敦' },
  { label: '欧洲', zone: 'Europe/Berlin', country: 'eu', city: '柏林（欧洲中部时间）' },
  { label: '日本', zone: 'Asia/Tokyo', country: 'jp', city: '东京' },
] as const

const clockFormatters = new Map<string, Intl.DateTimeFormat>()

export function formatWorldClock(now: Date, timeZone: string) {
  let formatter = clockFormatters.get(timeZone)
  if (!formatter) {
    formatter = new Intl.DateTimeFormat('en-GB', {
      timeZone, month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
    })
    clockFormatters.set(timeZone, formatter)
  }
  const parts = formatter.formatToParts(now)
  const value = (type: Intl.DateTimeFormatPartTypes) => parts.find(part => part.type === type)!.value
  return `${value('month')}-${value('day')} ${value('hour')}:${value('minute')}:${value('second')}`
}

// Represent Beijing calendar dates as UTC midnight so day differences are exact,
// independent of the visitor's timezone and daylight saving transitions.
export function getBeijingDay(now: Date) {
  return Math.floor((now.getTime() + BEIJING_OFFSET_MS) / DAY_MS) * DAY_MS
}

export function getISOWeek(day: number) {
  const thursday = new Date(day)
  thursday.setUTCDate(thursday.getUTCDate() + 4 - (thursday.getUTCDay() || 7))
  const year = thursday.getUTCFullYear()
  const week = Math.ceil(((thursday.getTime() - Date.UTC(year, 0, 1)) / DAY_MS + 1) / 7)
  return { year, week }
}

// Verified against HKO Gregorian–Lunar conversion tables. Keep these overrides:
// some ICU releases incorrectly place the 2027 New Year on February 7.
// Source: https://www.hko.gov.hk/tc/gts/time/calendar/pdf/files/{year}.pdf
const springFestivalDates = new Map<number, number>([
  [2026, Date.UTC(2026, 1, 17)],
  [2027, Date.UTC(2027, 1, 6)],
  [2028, Date.UTC(2028, 0, 26)],
  [2029, Date.UTC(2029, 1, 13)],
  [2030, Date.UTC(2030, 1, 3)],
])

export function getSpringFestivalDay(year: number): number {
  const known = springFestivalDates.get(year)
  if (known !== undefined) return known

  const lunar = new Intl.DateTimeFormat('en-u-ca-chinese', {
    timeZone: 'Asia/Shanghai', month: 'numeric', day: 'numeric',
  })
  for (let day = Date.UTC(year, 0, 21); day <= Date.UTC(year, 1, 20); day += DAY_MS) {
    const parts = lunar.formatToParts(new Date(day))
    if (parts.some(part => part.type === 'month' && part.value === '1') &&
        parts.some(part => part.type === 'day' && part.value === '1')) {
      springFestivalDates.set(year, day)
      return day
    }
  }
  throw new Error(`Unable to find Spring Festival for ${year}`)
}

export function getHolidayCountdowns(today: number) {
  const year = new Date(today).getUTCFullYear()
  const holidays = [
    { key: 'christmas', label: '圣诞节', dateForYear: (y: number) => Date.UTC(y, 11, 25) },
    { key: 'new-year', label: '元旦', dateForYear: (y: number) => Date.UTC(y, 0, 1) },
    { key: 'spring-festival', label: '春节', dateForYear: getSpringFestivalDay },
  ]
  return holidays.map(({ key, label, dateForYear }) => {
    let date = dateForYear(year)
    if (date < today) date = dateForYear(year + 1)
    return { key, label, date: new Date(date).toISOString().slice(0, 10), days: (date - today) / DAY_MS }
  })
}
