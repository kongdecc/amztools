import { SettingsProvider } from '@/components/SettingsProvider'
import HomeLayoutClient from './HomeClient'
import { Suspense } from 'react'
import { getEnabledFunctionalityShellData } from '@/lib/functionality-data'

export const revalidate = 60

export default async function Page({ searchParams }: { searchParams?: Record<string, string> }) {
  const {
    settings: initialSettings,
    navItems,
    modules,
    categories
  } = await getEnabledFunctionalityShellData()

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
