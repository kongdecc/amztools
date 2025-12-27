import { SettingsProvider } from '@/components/SettingsProvider'
import HomeLayoutClient from './HomeClient'
import { db } from '@/lib/db'
import { Suspense } from 'react'
import { DEFAULT_TOOLS, DEFAULT_CATEGORIES, DEFAULT_NAV_ITEMS } from '@/lib/constants'

export const revalidate = 0

export default async function Page({ searchParams }: { searchParams?: Record<string, string> }) {
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

  // Auto-seed for image-compression if missing
  if (Array.isArray(modulesRows) && !modulesRows.some((m: any) => m.key === 'image-compression')) {
    try {
      const existing = await (db as any).toolModule.findUnique({ where: { key: 'image-compression' } })
      if (!existing) {
        await (db as any).toolModule.create({
          data: {
            key: 'image-compression',
            title: '图片压缩与格式转换',
            desc: '批量压缩、格式转换，本地处理不上传服务器',
            status: '启用',
            views: 0,
            color: 'blue',
            order: 14,
            category: 'image-text'
          }
        })
      }
      const existingCat = await (db as any).toolCategory.findUnique({ where: { key: 'image-text' } })
      if (!existingCat) {
        await (db as any).toolCategory.create({
          data: { key: 'image-text', label: '图片文本', order: 3, enabled: true }
        })
      }
    } catch (e) {
      console.error('Auto-seed failed:', e)
    }
  }

  let initialSettings: Record<string, any> = {}
  try {
    for (const r of settingsRows as any) initialSettings[String((r as any).key)] = String((r as any).value ?? '')
  } catch {}

  let navItems: any[] = []
  try {
    const arr = navRow && (navRow as any).value ? JSON.parse(String((navRow as any).value)) : []
    navItems = Array.isArray(arr) && arr.length > 0 ? arr : DEFAULT_NAV_ITEMS
  } catch {
    navItems = DEFAULT_NAV_ITEMS
  }

  let modules: any[] = modulesRows
  try {
    // Filter disabled modules to match functionality page logic
    if (Array.isArray(modules)) {
      modules = modules.filter((m: any) => m.status !== '下架')
    }

    const ensure = (arr: any[]) => {
      const keys = new Set(arr.map((x: any) => x.key))
      const merged = arr.slice()
      for (const d of DEFAULT_TOOLS) if (!keys.has(d.key)) merged.push(d)
      return merged
    }
    modules = ensure(Array.isArray(modules) ? modules : [])
    
    // Force override status for 'word-count' if it is '维护' to remove the label
    modules = modules.map((m: any) => {
      if (m.key === 'word-count' && m.status === '维护') {
        return { ...m, status: '启用' }
      }
      return m
    })

    if (!Array.isArray(modules) || modules.length === 0) {
      modules = DEFAULT_TOOLS
    }
  } catch {
    modules = DEFAULT_TOOLS
  }

  let categories = categoriesRows
  if (!categories || categories.length === 0) {
    categories = DEFAULT_CATEGORIES
  }

  // Ensure "Functionality" menu item exists
  const hasFuncMenu = navItems.some((item: any) => String(item.label || '').includes('功能分类') || String(item.id || '') === 'functionality')
  if (!hasFuncMenu) {
    navItems.splice(0, 0, { id: 'functionality', label: '功能分类', order: 0, children: [] })
  }

  const initialActiveTab = String(searchParams?.tab || '')
  const initialFull = String(searchParams?.full || '') === '1'
  return (
    <SettingsProvider initial={initialSettings}>
      <Suspense fallback={null}>
        <HomeLayoutClient initialModules={modules} initialNavItems={navItems} initialActiveTab={initialActiveTab} initialFull={initialFull} initialCategories={categories} />
      </Suspense>
    </SettingsProvider>
  )
}
