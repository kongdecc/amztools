import { SettingsProvider } from '@/components/SettingsProvider'
import FunctionalityClient from './FunctionalityClient'
import { db } from '@/lib/db'
import { Metadata } from 'next'

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
  let initialSettings: Record<string, any> = {}
  let initialModules: any[] = []
  let navItems: any[] = []
  let initialCategories: any[] = []
  try {
    const rows = await (db as any).siteSettings.findMany()
    for (const r of rows as any) initialSettings[String((r as any).key)] = String((r as any).value ?? '')
  } catch {}
  try {
    initialCategories = await (db as any).toolCategory.findMany({ orderBy: { order: 'asc' } })
    if (initialCategories.length === 0) {
      initialCategories = [
        { key: 'operation', label: '运营工具', order: 1 },
        { key: 'advertising', label: '广告工具', order: 2 },
        { key: 'image-text', label: '图片文本', order: 3 }
      ]
    }
  } catch {
    initialCategories = [
      { key: 'operation', label: '运营工具', order: 1 },
      { key: 'advertising', label: '广告工具', order: 2 },
      { key: 'image-text', label: '图片文本', order: 3 }
    ]
  }
  try {
    initialModules = await (db as any).toolModule.findMany({ orderBy: { order: 'asc' } })
    initialModules = Array.isArray(initialModules) ? initialModules.filter((m:any)=>m.status !== '下架') : []
  } catch { initialModules = [] }
  try {
    const row = await (db as any).siteSettings.findUnique({ where: { key: 'navigation' } })
    const arr = row && (row as any).value ? JSON.parse(String((row as any).value)) : []
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

