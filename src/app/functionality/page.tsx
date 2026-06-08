import { SettingsProvider } from '@/components/SettingsProvider'
import FunctionalityClient from './FunctionalityClient'
import { Metadata } from 'next'
import { getEnabledFunctionalityShellData, getFunctionalityMetadataSettings } from '@/lib/functionality-data'

export const revalidate = 60

export async function generateMetadata(): Promise<Metadata> {
  const { siteName, functionalityTitle, functionalitySubtitle } = await getFunctionalityMetadataSettings()

  return {
    title: `${functionalityTitle} - ${siteName}`,
    description: functionalitySubtitle || `探索${siteName}提供的所有工具和功能`,
  }
}

export default async function FunctionalityPage() {
  const {
    settings: initialSettings,
    categories: initialCategories,
    modules: initialModules,
    navItems
  } = await getEnabledFunctionalityShellData()

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

