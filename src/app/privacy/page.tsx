import { SettingsProvider } from '@/components/SettingsProvider'
import { db } from '@/lib/db'
import PrivacyClient from '@/app/privacy/PrivacyClient'
import { DEFAULT_NAV_ITEMS } from '@/lib/constants'

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
    const defaults = DEFAULT_NAV_ITEMS
    const list = Array.isArray(arr) ? arr : []
    const byId: Record<string, any> = {}
    for (const it of list) { if (it && typeof it.id === 'string') byId[it.id] = it }
    for (const d of defaults) {
      const ex = byId[d.id]
      if (!ex) byId[d.id] = d
      else {
        const href = typeof ex.href === 'string' ? ex.href : ''
        if (!href || href === '/adout' || !href.startsWith('/')) byId[d.id] = { ...ex, href: d.href }
        if (typeof ex.label !== 'string' || !ex.label) byId[d.id] = { ...byId[d.id], label: d.label }
        if (typeof ex.order !== 'number') byId[d.id] = { ...byId[d.id], order: d.order }
        byId[d.id] = { ...byId[d.id], isExternal: false, active: true }
      }
    }
    navItems = Object.values(byId)
  } catch {
    navItems = DEFAULT_NAV_ITEMS
  }
  return (
    <SettingsProvider initial={initialSettings}>
      <PrivacyClient initialNavItems={navItems} />
    </SettingsProvider>
  )
}
