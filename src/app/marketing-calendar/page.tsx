import MarketingCalendarClient from './MarketingCalendarClient'
import { db } from '@/lib/db'

export const revalidate = 0

export default async function Page() {
  const settingsPromise = (db as any).siteSettings.findMany().catch(() => [])
  const navPromise = (db as any).siteSettings.findUnique({ where: { key: 'navigation' } }).catch(() => null)
  const modulesPromise = (db as any).toolModule.findMany({ orderBy: { order: 'asc' } }).catch(() => [])
  const categoriesPromise = (db as any).toolCategory.findMany({ where: { enabled: true }, orderBy: { order: 'asc' } }).catch(() => [])

  const [settingsRows, navRow, modulesRows, categoriesRows] = await Promise.all([
    settingsPromise,
    navPromise,
    modulesPromise,
    categoriesPromise
  ])

  let initialSettings: Record<string, any> = {}
  try {
    for (const r of settingsRows as any) initialSettings[String((r as any).key)] = String((r as any).value ?? '')
  } catch {}

  let navItems: any[] = []
  try {
    const arr = navRow && (navRow as any).value ? JSON.parse(String((navRow as any).value)) : []
    navItems = Array.isArray(arr) && arr.length > 0 ? arr : [
      { id: 'about', label: '关于', href: '/about', order: 1, isExternal: false, active: true },
      { id: 'blog', label: '博客', href: '/blog', order: 2, isExternal: false, active: true },
      { id: 'suggest', label: '提需求', href: '/suggest', order: 3, isExternal: false, active: true }
    ]
  } catch {
    navItems = [
      { id: 'about', label: '关于', href: '/about', order: 1, isExternal: false, active: true },
      { id: 'blog', label: '博客', href: '/blog', order: 2, isExternal: false, active: true },
      { id: 'suggest', label: '提需求', href: '/suggest', order: 3, isExternal: false, active: true }
    ]
  }

  // Ensure consistent category/module data structure
  let modules = Array.isArray(modulesRows) ? modulesRows : []
  let categories = Array.isArray(categoriesRows) ? categoriesRows : []

  // Fallback if DB empty (optional, but good for stability)
  if (categories.length === 0) {
      categories = [
          { key: 'advertising', label: '广告运营', order: 1, enabled: true },
          { key: 'operation', label: '日常运营', order: 2, enabled: true },
          { key: 'image-text', label: '图片文本', order: 3, enabled: true },
      ]
  }

  return (
    <MarketingCalendarClient 
        settings={initialSettings} 
        navItems={navItems} 
        categories={categories} 
        modules={modules} 
    />
  )
}
