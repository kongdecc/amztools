import { PUBLIC_SETTINGS, PUBLIC_NAV, PUBLIC_MODULES, PUBLIC_CATEGORIES, PUBLIC_POSTS, SITE_URL, pageMetadata, jsonLd } from '@/lib/published-content'
import { SettingsProvider } from '@/components/SettingsProvider'
import HomeLayoutClient from './HomeClient'
import { Suspense } from 'react'
import { getEnabledFunctionalityShellData } from '@/lib/functionality-data'

export const metadata = { ...pageMetadata('跨境工具魔方 AmzToolBox 免费亚马逊运营工具', PUBLIC_SETTINGS.seoDescription, '/'), title: '跨境工具魔方 AmzToolBox - 免费亚马逊运营工具箱' }

export default async function Page({ searchParams }: { searchParams?: Promise<Record<string, string>> }) {
  const {
    settings: initialSettings,
    navItems,
    modules,
    categories
  } = await getEnabledFunctionalityShellData()

  const query = await searchParams
  const initialActiveTab = String(query?.tab || '')
  const initialFull = String(query?.full || '') === '1'
  return (
    <SettingsProvider initial={initialSettings}>
      <Suspense fallback={null}>
        <HomeLayoutClient initialModules={modules} initialNavItems={navItems} initialActiveTab={initialActiveTab} initialFull={initialFull} initialCategories={categories} />
      </Suspense>
    </SettingsProvider>
  )
}
