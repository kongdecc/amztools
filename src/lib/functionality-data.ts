import { cache } from 'react'
import { db } from '@/lib/db'
import {
  BLOCKED_TOOL_KEYS,
  DEFAULT_CATEGORIES,
  DEFAULT_NAV_ITEMS,
  DEFAULT_SITE_SETTINGS,
  DEFAULT_TOOLS,
  ensureNavItems
} from '@/lib/constants'

const blockedKeys = new Set(BLOCKED_TOOL_KEYS)

function normalizeModules(rows: any[]) {
  let modules = Array.isArray(rows)
    ? rows.filter((item: any) => item.status !== '下架' && !blockedKeys.has(item.key))
    : []

  if (modules.length === 0) {
    modules = DEFAULT_TOOLS.filter((item: any) => !blockedKeys.has(item.key))
  } else {
    const keys = new Set(modules.map((item: any) => item.key))
    for (const item of DEFAULT_TOOLS) {
      if (!keys.has(item.key) && !blockedKeys.has(item.key)) {
        modules.push(item)
      }
    }
  }

  return modules
    .filter((item: any) => !blockedKeys.has(item.key))
    .map((item: any) => {
      if (item.key === 'word-count' && item.status === '维护') {
        return { ...item, status: '启用' }
      }
      if (item.key === 'listing-check') {
        return {
          ...item,
          title: 'Listing自检工具（新规）',
          desc: item.desc || '标题/五点/ST/长描述合规与关键词埋入检查，含2026标题与商品亮点新规自检'
        }
      }
      return item
    })
}

function normalizeCategories(rows: any[]) {
  if (!Array.isArray(rows) || rows.length === 0) {
    return DEFAULT_CATEGORIES
  }
  return rows
}

function normalizeSettings(rows: any[]) {
  const settings: Record<string, string> = {}

  try {
    for (const row of rows as any[]) {
      settings[String((row as any).key)] = String((row as any).value ?? '')
    }
  } catch {}

  return settings
}

function normalizeNavItems(navRow: any) {
  try {
    const raw = navRow?.value ? JSON.parse(String(navRow.value)) : []
    return ensureNavItems(Array.isArray(raw) && raw.length > 0 ? raw : DEFAULT_NAV_ITEMS)
  } catch {
    return ensureNavItems(DEFAULT_NAV_ITEMS)
  }
}

export const getFunctionalityShellData = cache(async () => {
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

  return {
    settings: normalizeSettings(settingsRows),
    categories: normalizeCategories(categoriesRows),
    modules: normalizeModules(modulesRows),
    navItems: normalizeNavItems(navRow)
  }
})

export const getEnabledFunctionalityShellData = cache(async () => {
  const data = await getFunctionalityShellData()
  return {
    ...data,
    categories: data.categories.filter((item: any) => item.enabled !== false)
  }
})

export const getFunctionalityMetadataSettings = cache(async () => {
  const { settings } = await getFunctionalityShellData()
  return {
    siteName: settings.siteName || DEFAULT_SITE_SETTINGS.siteName,
    functionalityTitle: settings.functionalityTitle || '功能中心',
    functionalitySubtitle: settings.functionalitySubtitle || ''
  }
})
