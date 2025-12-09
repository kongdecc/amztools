import { SettingsProvider } from '@/components/SettingsProvider'
import FunctionalityClient from './FunctionalityClient'
import { db } from '@/lib/db'
import { Metadata } from 'next'
export const revalidate = 0

export async function generateMetadata(): Promise<Metadata> {
  let siteName = '运营魔方 ToolBox'
  let functionalityTitle = '功能中心'
  let functionalitySubtitle = ''
  
  try {
    const rows = await (db as any).siteSettings.findMany()
    const settings: any = {}
    for (const r of rows as any) settings[String((r as any).key)] = String((r as any).value ?? '')
    siteName = settings.siteName || siteName
    functionalityTitle = settings.functionalityTitle || functionalityTitle
    functionalitySubtitle = settings.functionalitySubtitle || ''
  } catch {}

  return {
    title: `${functionalityTitle} - ${siteName}`,
    description: functionalitySubtitle || `探索${siteName}提供的所有工具和功能`,
  }
}

export default async function FunctionalityPage() {
  const settingsPromise = (db as any).siteSettings.findMany().catch(() => [])
  const categoriesPromise = (db as any).toolCategory.findMany({ orderBy: { order: 'asc' } }).catch(() => [])
  const modulesPromise = (db as any).toolModule.findMany({ orderBy: { order: 'asc' } }).catch(() => [])
  const navPromise = (db as any).siteSettings.findUnique({ where: { key: 'navigation' } }).catch(() => null)

  const [settingsRows, categoriesRows, modulesRows, navRow] = await Promise.all([
    settingsPromise,
    categoriesPromise,
    modulesPromise,
    navPromise
  ])

  let initialSettings: Record<string, any> = {}
  try {
    for (const r of settingsRows as any) initialSettings[String((r as any).key)] = String((r as any).value ?? '')
  } catch {}

  let initialCategories: any[] = categoriesRows
  if (!Array.isArray(initialCategories) || initialCategories.length === 0) {
    initialCategories = [
      { key: 'operation', label: '运营工具', order: 1 },
      { key: 'advertising', label: '广告工具', order: 2 },
      { key: 'image-text', label: '图片文本', order: 3 }
    ]
  }

  let initialModules: any[] = []
  try {
    initialModules = Array.isArray(modulesRows) ? modulesRows.filter((m:any)=>m.status !== '下架') : []
  } catch { initialModules = [] }

  let navItems: any[] = []
  try {
    const arr = navRow && (navRow as any).value ? JSON.parse(String((navRow as any).value)) : []
    navItems = Array.isArray(arr) ? arr : []
  } catch { navItems = [] }

  const safeOrigin = process.env.NEXT_PUBLIC_SITE_URL || ''
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    "name": `${initialSettings.siteName || '运营魔方'} - ${initialSettings.functionalityTitle || '功能中心'}`,
    "description": initialSettings.functionalitySubtitle || '亚马逊运营工具集合',
    "url": `${safeOrigin}/functionality`,
    "hasPart": initialModules.map(m => ({
      "@type": "WebPage",
      "name": m.title,
      "description": m.desc,
      "url": `${safeOrigin}/?tab=${m.key}`
    }))
  }

  return (
    <SettingsProvider initial={initialSettings}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <FunctionalityClient initialNavItems={navItems} initialModules={initialModules} initialCategories={initialCategories} />
    </SettingsProvider>
  )
}

