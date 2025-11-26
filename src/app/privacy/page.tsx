import { SettingsProvider } from '@/components/SettingsProvider'
import { db } from '@/lib/db'
import PrivacyClient from '@/app/privacy/PrivacyClient'
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
    if (Array.isArray(arr) && arr.length > 0) {
      navItems = arr
    } else {
      navItems = [
        { id: 'about', label: '关于', href: '/about', order: 1, isExternal: false, active: true },
        { id: 'blog', label: '博客', href: '/blog', order: 2, isExternal: false, active: true },
        { id: 'suggest', label: '提需求', href: '/suggest', order: 3, isExternal: false, active: true }
      ]
    }
  } catch {
    navItems = [
      { id: 'about', label: '关于', href: '/about', order: 1, isExternal: false, active: true },
      { id: 'blog', label: '博客', href: '/blog', order: 2, isExternal: false, active: true },
      { id: 'suggest', label: '提需求', href: '/suggest', order: 3, isExternal: false, active: true }
    ]
  }
  return (
    <SettingsProvider initial={initialSettings}>
      <PrivacyClient initialNavItems={navItems} />
    </SettingsProvider>
  )
}