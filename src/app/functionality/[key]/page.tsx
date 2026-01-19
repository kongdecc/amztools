import { Metadata } from 'next'
import { db } from '@/lib/db'
import { DEFAULT_TOOLS, DEFAULT_CATEGORIES, DEFAULT_NAV_ITEMS, DEFAULT_SITE_SETTINGS } from '@/lib/constants'
import ClientPage from './ClientPage'
import { SettingsProvider } from '@/components/SettingsProvider'

export const dynamic = 'force-dynamic'

// Helper to fetch data
async function getData() {
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

  // Process Settings
  const settings: any = {}
  for (const r of settingsRows as any) settings[String((r as any).key)] = String((r as any).value ?? '')
  
  // Process Categories
  let categories = Array.isArray(categoriesRows) && categoriesRows.length > 0 ? categoriesRows : DEFAULT_CATEGORIES

  // Process Modules
  let modules = Array.isArray(modulesRows) ? modulesRows.filter((m:any)=>m.status !== '下架') : []
  if (modules.length === 0) {
    modules = DEFAULT_TOOLS
  } else {
    const keys = new Set(modules.map((x: any) => x.key))
    for (const t of DEFAULT_TOOLS) {
      if (!keys.has(t.key)) modules.push(t)
    }
  }
  // Force override logic
   modules = modules.map((m: any) => {
      if (m.key === 'word-count' && m.status === '维护') {
        return { ...m, status: '启用' }
      }
      return m
    })

  // Process Nav
  let navItems = []
  try {
    const arr = navRow && (navRow as any).value ? JSON.parse(String((navRow as any).value)) : []
    navItems = Array.isArray(arr) && arr.length > 0 ? arr : DEFAULT_NAV_ITEMS
  } catch { navItems = DEFAULT_NAV_ITEMS }

  return { settings, categories, modules, navItems }
}

export async function generateStaticParams() {
  const { modules } = await getData()
  return modules.map((m: any) => ({ key: m.key }))
}

export async function generateMetadata({ params }: { params: Promise<{ key: string }> }): Promise<Metadata> {
  const { key } = await params
  const { settings, modules } = await getData()
  
  const tool = modules.find((m: any) => m.key === key)
  const siteName = settings.siteName || DEFAULT_SITE_SETTINGS.siteName
  
  if (!tool) {
    return {
      title: `未找到工具 - ${siteName}`,
      description: '请求的工具不存在'
    }
  }

  const title = `${tool.title} - ${siteName}`
  const description = tool.desc || `${tool.title} - ${siteName} 在线免费使用`
  const keywords = `${tool.title}, ${siteName}, 亚马逊工具, 免费工具`

  return {
    title,
    description,
    keywords,
    openGraph: {
      title,
      description,
      type: 'website',
      url: `/functionality/${key}`
    },
    alternates: {
      canonical: `/functionality/${key}`
    },
    robots: {
      index: true,
      follow: true
    }
  }
}

export default async function Page({ params }: { params: Promise<{ key: string }> }) {
  const { key } = await params
  const { settings, categories, modules, navItems } = await getData()
  const tool = modules.find((m: any) => m.key === key)
  
  const safeOrigin = (process.env.NEXT_PUBLIC_SITE_URL || '').replace(/\/$/, '')
  
  const jsonLd = tool ? {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    "name": tool.title,
    "description": tool.desc,
    "applicationCategory": "BusinessApplication",
    "operatingSystem": "Web",
    "offers": {
      "@type": "Offer",
      "price": "0",
      "priceCurrency": "CNY"
    }
  } : null

  const breadcrumbLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    "itemListElement": [
      { "@type": "ListItem", "position": 1, "name": "首页", "item": `${safeOrigin}/` },
      { "@type": "ListItem", "position": 2, "name": "功能中心", "item": `${safeOrigin}/functionality` },
      tool ? { "@type": "ListItem", "position": 3, "name": tool.title, "item": `${safeOrigin}/functionality/${key}` } : null
    ].filter(Boolean)
  }

  return (
    <SettingsProvider initial={settings}>
      {jsonLd && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd) }} />
      <ClientPage initialModules={modules} initialNavItems={navItems} initialCategories={categories} />
    </SettingsProvider>
  )
}
