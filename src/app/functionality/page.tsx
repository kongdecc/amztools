import { SettingsProvider } from '@/components/SettingsProvider'
import FunctionalityClient from './FunctionalityClient'
import { db } from '@/lib/db'

export default async function FunctionalityPage() {
  let initialSettings: Record<string, any> = {}
  let initialModules: any[] = []
  let navItems: any[] = []
  try {
    const rows = await (db as any).siteSettings.findMany()
    for (const r of rows as any) initialSettings[String((r as any).key)] = String((r as any).value ?? '')
  } catch {}
  try {
    initialModules = await (db as any).toolModule.findMany({ orderBy: { order: 'asc' } })
    initialModules = Array.isArray(initialModules) ? initialModules.filter((m:any)=>m.status !== '下架') : []
  } catch { initialModules = [] }
  try {
    const row = await (db as any).siteSettings.findUnique({ where: { key: 'navigation' } })
    const arr = row && (row as any).value ? JSON.parse(String((row as any).value)) : []
    navItems = Array.isArray(arr) ? arr : []
  } catch { navItems = [] }
  return (
    <SettingsProvider initial={initialSettings}>
      <FunctionalityClient initialNavItems={navItems} initialModules={initialModules} />
    </SettingsProvider>
  )
}

