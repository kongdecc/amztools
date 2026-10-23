'use client'

import { useEffect, useMemo, useState } from 'react'
import { CalendarDays } from 'lucide-react'
import { WORLD_CLOCKS, formatWorldClock, getBeijingDay, getHolidayCountdowns, getISOWeek } from '@/lib/home-calendar'

// Use the site's Tailwind utilities so spacing and borders follow its
// PostCSS cascade-layer compatibility transform, including on older browsers.
const styles = {
  bar: '@container overflow-hidden rounded-xl border border-slate-200 bg-slate-50 text-[13px] text-slate-500',
  clocks: 'grid grid-cols-2 gap-x-4 gap-y-3 px-4 py-3.5 @min-[560px]:grid-cols-3 @min-[1050px]:grid-cols-6 @max-[359px]:gap-x-2 @max-[359px]:px-2.5',
  clock: 'flex items-center justify-center gap-1.5 whitespace-nowrap text-xs @min-[560px]:text-[13px] @max-[359px]:gap-1 @max-[359px]:text-[11px]',
  flag: 'h-[15px] w-[22px] shrink-0 rounded-[2px] @max-[359px]:h-3 @max-[359px]:w-[18px]',
  time: 'text-slate-600 tabular-nums',
  calendar: 'flex flex-wrap items-center justify-center gap-x-6 gap-y-2.5 border-t border-slate-200 bg-white px-4 py-2.5',
  today: 'flex flex-wrap items-center justify-center gap-x-2 gap-y-1.5',
  week: 'text-indigo-500',
  basis: 'text-[11px] text-slate-400',
  holidays: 'flex flex-wrap items-center justify-center gap-x-4 gap-y-2',
  holiday: 'flex items-center gap-1 whitespace-nowrap',
  count: 'font-semibold text-indigo-500 tabular-nums',
}

function Flag({ country }: { country: typeof WORLD_CLOCKS[number]['country'] }) {
  return (
    <svg viewBox="0 0 30 20" className={styles.flag} aria-hidden="true">
      {country === 'cn' && <>
        <path fill="#ee4459" d="M0 0h30v20H0z" />
        <g fill="#ffdf69">
          <path d="m6 3 1 3h3L7.5 8l1 3L6 9l-2.5 2 1-3L2 6h3z" />
          <circle cx="12" cy="3" r="1" /><circle cx="14" cy="6" r="1" />
          <circle cx="14" cy="10" r="1" /><circle cx="12" cy="13" r="1" />
        </g>
      </>}
      {country === 'us' && <>
        <path fill="#fff" d="M0 0h30v20H0z" />
        <path stroke="#ed4b63" strokeWidth="2" d="M0 1h30M0 5h30M0 9h30M0 13h30M0 17h30" />
        <path fill="#4479c1" d="M0 0h13v11H0z" />
        <path fill="#fff" d="m6.5 1 1.2 3.3h3.5L8.4 6.4l1.1 3.3-3-2-3 2 1.1-3.3L1.8 4.3h3.5z" />
      </>}
      {country === 'gb' && <>
        <path fill="#315b9e" d="M0 0h30v20H0z" />
        <path stroke="#fff" strokeWidth="5" d="m0 0 30 20M30 0 0 20" />
        <path stroke="#e6546b" strokeWidth="2" d="m0 0 30 20M30 0 0 20" />
        <path stroke="#fff" strokeWidth="7" d="M15 0v20M0 10h30" />
        <path stroke="#e6546b" strokeWidth="4" d="M15 0v20M0 10h30" />
      </>}
      {country === 'eu' && <>
        <path fill="#164eae" d="M0 0h30v20H0z" />
        {Array.from({ length: 12 }, (_, i) => (
          <circle key={i} fill="#ffdc46" cx={15 + 5.5 * Math.sin(i * Math.PI / 6)} cy={10 - 5.5 * Math.cos(i * Math.PI / 6)} r="0.8" />
        ))}
      </>}
      {country === 'jp' && <>
        <path fill="#fff" stroke="#f0b6c0" d="M.5.5h29v19H.5z" />
        <circle fill="#ed4160" cx="15" cy="10" r="5" />
      </>}
    </svg>
  )
}

export default function HomeTimeBar() {
  // The first server/client render shares placeholders, avoiding hydration errors.
  const [now, setNow] = useState<Date | null>(null)
  useEffect(() => {
    const update = () => setNow(new Date())
    update()
    const timer = window.setInterval(update, 1000)
    document.addEventListener('visibilitychange', update)
    return () => {
      window.clearInterval(timer)
      document.removeEventListener('visibilitychange', update)
    }
  }, [])

  const today = now ? getBeijingDay(now) : null
  const calendar = useMemo(() => {
    if (today === null) return null
    const date = new Date(today)
    return {
      date: `${date.getUTCFullYear()}年${date.getUTCMonth() + 1}月${date.getUTCDate()}日`,
      weekday: `星期${'日一二三四五六'[date.getUTCDay()]}`,
      isoWeek: getISOWeek(today),
      holidays: getHolidayCountdowns(today),
    }
  }, [today])

  return (
    <section className={styles.bar} aria-label="世界时间与节日倒计时">
      <div className={styles.clocks}>
        {WORLD_CLOCKS.map(clock => (
          <div key={clock.zone} className={styles.clock} title={`${clock.city} · ${clock.zone}（自动适用当地夏令时）`}>
            <Flag country={clock.country} />
            <span>{clock.label}</span>
            <span className={styles.time}>{now ? formatWorldClock(now, clock.zone) : '-- --:--:--'}</span>
          </div>
        ))}
      </div>
      <div className={styles.calendar}>
        <div className={styles.today} title="日期与倒计时以北京时间为准；周次采用 ISO 8601（周一为每周第一天）">
          <CalendarDays size={15} className="shrink-0 text-indigo-400" aria-hidden="true" />
          {calendar ? <>
            <span>{calendar.date}</span>
            <span>{calendar.weekday}</span>
            <span className={styles.week}>{calendar.isoWeek.year}年第{calendar.isoWeek.week}周</span>
          </> : <span>正在载入日期…</span>}
          <span className={styles.basis}>北京时间</span>
        </div>
        <div className={styles.holidays}>
          {calendar ? calendar.holidays.map(holiday => (
            <span key={holiday.key} className={styles.holiday} title={`${holiday.date} · 北京时间 · 节日当天（非调休假期）`}>
              {holiday.days === 0 ? <><strong className={styles.count}>{holiday.label}</strong><span>就是今天</span></> : <>
                <span>距{holiday.label}</span><strong className={styles.count}>{holiday.days}</strong><span>天</span>
              </>}
            </span>
          )) : <span>正在载入节日倒计时…</span>}
        </div>
      </div>
    </section>
  )
}
