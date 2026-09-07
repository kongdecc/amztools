import { PUBLIC_SETTINGS, PUBLIC_NAV, PUBLIC_MODULES, PUBLIC_CATEGORIES, PUBLIC_POSTS, SITE_URL, pageMetadata, jsonLd } from '@/lib/published-content'
import { Metadata } from 'next'
import { permanentRedirect, notFound } from 'next/navigation'
import { DEFAULT_SITE_SETTINGS } from '@/lib/constants'
import ClientPage from './ClientPage'
import ToolGuide from '@/components/ToolGuide'
import { SettingsProvider } from '@/components/SettingsProvider'
import { getFunctionalityShellData } from '@/lib/functionality-data'

export const dynamicParams = false
export function generateStaticParams() { return PUBLIC_MODULES.map(tool => ({ key: tool.key })) }

export async function generateMetadata({ params }: { params: Promise<{ key: string }> }): Promise<Metadata> {
  const { key } = await params
  const { settings, modules } = await getFunctionalityShellData()
  
  const tool = modules.find((m: any) => m.key === key)
  const siteName = settings.siteName || DEFAULT_SITE_SETTINGS.siteName
  
  if (!tool) notFound()

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
      canonical: new URL(tool.href || `/functionality/${key}`, SITE_URL).href
    },
    robots: {
      index: true,
      follow: true
    }
  }
}

export default async function Page({ params }: { params: Promise<{ key: string }> }) {
  const { key } = await params
  const { settings, categories, modules, navItems } = await getFunctionalityShellData()
  const tool = modules.find((m: any) => m.key === key)

  if (!tool) notFound()
  if (tool.href) {
    permanentRedirect(tool.href)
  }
  
  const safeOrigin = SITE_URL
  
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
      <ToolGuide tool={tool} />
    </SettingsProvider>
  )
}
