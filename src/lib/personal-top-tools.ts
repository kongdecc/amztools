const STORAGE_KEY = 'amztools:personal-tool-usage:v1'
const UPDATE_EVENT = 'amztools:personal-tool-usage-updated'

export const PERSONAL_TOP_CATEGORY_KEY = 'personal-top'
export const PERSONAL_TOP_CATEGORY_LABEL = '常用工具 Top 8'
export const PERSONAL_TOP_LIMIT = 8

type ToolLike = {
  key: string
  title?: string
  order?: number
  status?: string
}

type ToolUsageMap = Record<string, number>

function isBrowser() {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined'
}

function normalizeUsageMap(value: unknown): ToolUsageMap {
  if (!value || typeof value !== 'object') return {}

  const next: ToolUsageMap = {}
  for (const [key, count] of Object.entries(value as Record<string, unknown>)) {
    if (!key) continue
    const normalizedCount = Number(count)
    if (Number.isFinite(normalizedCount) && normalizedCount > 0) {
      next[key] = Math.floor(normalizedCount)
    }
  }
  return next
}

export function getPersonalToolUsage(): ToolUsageMap {
  if (!isBrowser()) return {}

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return {}
    return normalizeUsageMap(JSON.parse(raw))
  } catch {
    return {}
  }
}

export function recordPersonalToolVisit(key: string) {
  const safeKey = String(key || '').trim()
  if (!safeKey || !isBrowser()) return

  try {
    const usage = getPersonalToolUsage()
    usage[safeKey] = Number(usage[safeKey] || 0) + 1
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(usage))
    window.dispatchEvent(new CustomEvent(UPDATE_EVENT, { detail: { key: safeKey, count: usage[safeKey] } }))
  } catch {}
}

export function subscribePersonalToolUsage(callback: () => void) {
  if (!isBrowser()) return () => {}

  const handleUpdate = () => callback()
  const handleStorage = (event: StorageEvent) => {
    if (event.key === STORAGE_KEY) callback()
  }

  window.addEventListener(UPDATE_EVENT, handleUpdate as EventListener)
  window.addEventListener('storage', handleStorage)

  return () => {
    window.removeEventListener(UPDATE_EVENT, handleUpdate as EventListener)
    window.removeEventListener('storage', handleStorage)
  }
}

function sortModules<T extends ToolLike>(modules: T[], usage: ToolUsageMap) {
  return modules
    .filter((module) => module && module.status !== '下架' && Number(usage[module.key] || 0) > 0)
    .slice()
    .sort((a, b) => {
      const diff = Number(usage[b.key] || 0) - Number(usage[a.key] || 0)
      if (diff !== 0) return diff

      const orderDiff = Number(a.order || 0) - Number(b.order || 0)
      if (orderDiff !== 0) return orderDiff

      return String(a.title || a.key).localeCompare(String(b.title || b.key), 'zh-CN')
    })
}

export function getPersonalTopModules<T extends ToolLike>(modules: T[], limit = PERSONAL_TOP_LIMIT): T[] {
  const safeModules = Array.isArray(modules) ? modules.filter(Boolean) : []
  const usage = getPersonalToolUsage()
  return sortModules(safeModules, usage).slice(0, limit)
}

export function sortModulesWithPersonalTop<T extends ToolLike>(modules: T[], limit = PERSONAL_TOP_LIMIT): T[] {
  const safeModules = Array.isArray(modules) ? modules.filter(Boolean) : []
  const topModules = getPersonalTopModules(safeModules, limit)
  if (topModules.length === 0) return safeModules

  const topKeys = new Set(topModules.map((module) => module.key))
  const restModules = safeModules.filter((module) => !topKeys.has(module.key))
  return [...topModules, ...restModules]
}
