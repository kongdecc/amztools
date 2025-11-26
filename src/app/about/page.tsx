import { SettingsProvider } from '@/components/SettingsProvider'
import { db } from '@/lib/db'
import AboutClient from '@/app/about/AboutClient'
export const dynamic = 'force-dynamic'

export default async function Page() {
  let initialSettings: Record<string, any> = {}
  try {
    const rows = await (db as any).siteSettings.findMany()
    for (const r of rows as any) initialSettings[String((r as any).key)] = String((r as any).value ?? '')
  } catch {}
  let navItems: any[] = []
  try {
    const row = await (db as any).siteSettings.findUnique({ where: { key: 'navigation' } })
    const arr = row && (row as any).value ? JSON.parse(String((row as any).value)) : []
    navItems = Array.isArray(arr) ? arr : []
  } catch { navItems = [] }
  return (
    <SettingsProvider initial={initialSettings}>
      <AboutClient initialNavItems={navItems} />
    </SettingsProvider>
  )
}