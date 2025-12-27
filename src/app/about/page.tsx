import { SettingsProvider } from '@/components/SettingsProvider'
import { db } from '@/lib/db'
import { marked } from 'marked'
import AboutClient from '@/app/about/AboutClient'
import { DEFAULT_NAV_ITEMS, DEFAULT_SITE_SETTINGS } from '@/lib/constants'

export const revalidate = 0

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
    if (Array.isArray(arr) && arr.length > 0) {
      navItems = arr
    } else {
      navItems = DEFAULT_NAV_ITEMS
    }
  } catch {
    navItems = DEFAULT_NAV_ITEMS
  }
  const aboutContent = String(initialSettings['aboutContent'] || DEFAULT_SITE_SETTINGS.siteDescription)
  let initialHtml = ''
  try { initialHtml = String(marked.parse(aboutContent)) } catch { initialHtml = '' }
  return (
    <SettingsProvider initial={initialSettings}>
      <AboutClient initialNavItems={navItems} initialHtml={initialHtml} />
    </SettingsProvider>
  )
}
