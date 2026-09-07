import { PUBLIC_SETTINGS, PUBLIC_NAV, PUBLIC_MODULES, PUBLIC_CATEGORIES, PUBLIC_POSTS, SITE_URL, pageMetadata, jsonLd } from '@/lib/published-content'
import { SettingsProvider } from '@/components/SettingsProvider'
import { marked } from 'marked'
import AboutClient from './AboutClient'
export const metadata = pageMetadata('关于跨境工具魔方', '了解跨境工具魔方 AmzToolBox 的免费亚马逊运营、图片与文本处理工具。', '/about')
export default function Page() {
  return <SettingsProvider initial={PUBLIC_SETTINGS}><AboutClient initialNavItems={PUBLIC_NAV} initialHtml={String(marked.parse(PUBLIC_SETTINGS.aboutContent))} /></SettingsProvider>
}
