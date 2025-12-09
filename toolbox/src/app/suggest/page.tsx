import { SettingsProvider } from '@/components/SettingsProvider'
import SuggestClient from './SuggestClient'
import { db } from '@/lib/db'
import { Metadata } from 'next'
export const revalidate = 0

export async function generateMetadata(): Promise<Metadata> {
  let siteName = '运营魔方 ToolBox'
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
    navItems = Array.isArray(arr) ? arr : []

    const mods = await (db as any).toolModule.findMany({ orderBy: { order: 'asc' } })
    modules = Array.isArray(mods) ? mods.filter((m:any) => m.status !== '下架') : []
  } catch { 
    navItems = []
    modules = []
  }

  // Fallback nav items if empty (optional, but good for robustness)
  if (navItems.length === 0) {
    navItems = [
      { id: 'about', label: '关于', href: '/about', order: 1, isExternal: false, active: true },
      { id: 'blog', label: '博客', href: '/blog', order: 2, isExternal: false, active: true },
      { id: 'suggest', label: '提需求', href: '/suggest', order: 3, isExternal: false, active: true }
    ]
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
