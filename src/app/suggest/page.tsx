import { SettingsProvider } from '@/components/SettingsProvider'
import SuggestClient from './SuggestClient'
import { db } from '@/lib/db'
import { Metadata } from 'next'
import { DEFAULT_NAV_ITEMS, DEFAULT_TOOLS, DEFAULT_SITE_SETTINGS } from '@/lib/constants'

export const revalidate = 0

export async function generateMetadata(): Promise<Metadata> {
  let siteName = DEFAULT_SITE_SETTINGS.siteName
  let siteDescription = ''
  let siteKeywords = ''
  try {
    const rows = await (db as any).siteSettings.findMany()
    const settings: any = {}
    for (const r of rows as any) settings[String((r as any).key)] = String((r as any).value ?? '')
    siteName = settings.siteName || siteName
    siteDescription = settings.seoDescription || settings.siteDescription || ''
    siteKeywords = settings.siteKeywords || ''
  } catch {}

  return {
    title: `${siteName} - 提需求`,
    description: siteDescription,
    keywords: siteKeywords,
  }
}

export default async function Page() {
  let initialSettings: Record<string, any> = {}
  let navItems: any[] = []
  let modules: any[] = []

  try {
    const rows = await (db as any).siteSettings.findMany()
    for (const r of rows as any) initialSettings[String((r as any).key)] = String((r as any).value ?? '')
    
    const row = await (db as any).siteSettings.findUnique({ where: { key: 'navigation' } })
    const arr = row && (row as any).value ? JSON.parse(String((row as any).value)) : []
    navItems = Array.isArray(arr) && arr.length > 0 ? arr : DEFAULT_NAV_ITEMS

    const mods = await (db as any).toolModule.findMany({ orderBy: { order: 'asc' } })
    modules = Array.isArray(mods) ? mods.filter((m:any) => m.status !== '下架') : []
    
    // Merge logic
    const ensure = (arr: any[]) => {
      const keys = new Set(arr.map((x: any) => x.key))
      const merged = arr.slice()
      for (const d of DEFAULT_TOOLS) if (!keys.has(d.key)) merged.push(d)
      return merged
    }
    modules = ensure(modules)

    // Force override status for 'word-count' if it is '维护'
    modules = modules.map((m: any) => {
      if (m.key === 'word-count' && m.status === '维护') {
        return { ...m, status: '启用' }
      }
      return m
    })

  } catch { 
    navItems = DEFAULT_NAV_ITEMS
    modules = DEFAULT_TOOLS
  }

  // Fallback nav items if empty (optional, but good for robustness)
  if (navItems.length === 0) {
    navItems = DEFAULT_NAV_ITEMS
  }

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "首页", item: "/" }, // Use relative or construct absolute if needed
      { "@type": "ListItem", position: 2, name: "提需求", item: "/suggest" }
    ]
  }

  return (
    <SettingsProvider initial={initialSettings}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <SuggestClient initialNavItems={navItems} modules={modules} />
    </SettingsProvider>
  )
}
