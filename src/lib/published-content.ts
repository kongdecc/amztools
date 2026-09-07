import type { Metadata } from 'next'
import config from '@/config/site-seo.json'
import posts from '@/config/published-posts.json'
import { DEFAULT_SITE_SETTINGS, DEFAULT_TOOLS, DEFAULT_CATEGORIES, DEFAULT_NAV_ITEMS, BLOCKED_TOOL_KEYS, ensureNavItems } from '@/lib/constants'

export const SITE_URL = config.siteUrl
export const PUBLIC_SETTINGS: Record<string, string> = { ...DEFAULT_SITE_SETTINGS, ...config, faviconUrl: '/site-icon-v2.svg' }
export const PUBLIC_MODULES = DEFAULT_TOOLS.filter(tool => !BLOCKED_TOOL_KEYS.includes(tool.key))
export const PUBLIC_CATEGORIES = DEFAULT_CATEGORIES
export const PUBLIC_NAV = ensureNavItems(DEFAULT_NAV_ITEMS)
export const PUBLIC_POSTS = posts.filter(post => post.status === 'published').sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
export const STATIC_PAGES = [
  { href: '/marketing-calendar.html', title: '2026年电商营销日历', desc: '查看全年重点营销节点、节日大促和选品运营节奏安排。' },
  { href: '/marketing-calendar-summary.html', title: '2026年亚马逊全球营销日历', desc: '查看亚马逊全球站点营销节点与活动节奏汇总。' },
  { href: '/china-industry-belts.html', title: '中国产业带', desc: '查看中国产业带信息，辅助选品、供应链与货源调研。' },
  { href: '/cpsc_efiling_screening_tool.html', title: 'CPSC 合规与 eFiling 筛查工具', desc: '按品类、年龄段、材料与申报场景进行美国站合规初步筛查。' }
]
export function toolPath(tool: { key: string; href?: string }) {
  return tool.href || '/functionality/' + tool.key
}
export function pageMetadata(title: string, description: string, pathname: string): Metadata {
  return {
    metadataBase: new URL(SITE_URL),
    title: title + ' - ' + config.siteName,
    description,
    alternates: { canonical: new URL(pathname, SITE_URL).href },
    openGraph: { title, description, url: new URL(pathname, SITE_URL).href, siteName: config.siteName, locale: 'zh_CN', type: 'website' }
  }
}
export function jsonLd(value: unknown) {
  return JSON.stringify(value).replace(/</g, '\\u003c')
}
