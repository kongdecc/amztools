import { PUBLIC_SETTINGS, PUBLIC_MODULES, PUBLIC_CATEGORIES, PUBLIC_NAV } from './published-content'

export async function getFunctionalityShellData() {
  return { settings: PUBLIC_SETTINGS, modules: PUBLIC_MODULES, categories: PUBLIC_CATEGORIES, navItems: PUBLIC_NAV }
}
export async function getEnabledFunctionalityShellData() {
  const data = await getFunctionalityShellData()
  return { ...data, categories: data.categories.filter(item => item.enabled !== false) }
}
export async function getFunctionalityMetadataSettings() {
  return {
    siteName: PUBLIC_SETTINGS.siteName,
    functionalityTitle: PUBLIC_SETTINGS.functionalityTitle,
    functionalitySubtitle: PUBLIC_SETTINGS.functionalitySubtitle
  }
}
