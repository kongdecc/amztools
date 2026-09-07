import { PUBLIC_SETTINGS, PUBLIC_NAV, PUBLIC_MODULES, PUBLIC_CATEGORIES, PUBLIC_POSTS, SITE_URL, pageMetadata, jsonLd } from '@/lib/published-content'
import { SettingsProvider } from '@/components/SettingsProvider'
import SuggestClient from './SuggestClient'
export const metadata = pageMetadata('工具建议与需求反馈', '向跨境工具魔方提交使用反馈和工具需求。', '/suggest')
export default function Page() {
  return <SettingsProvider initial={PUBLIC_SETTINGS}><SuggestClient initialNavItems={PUBLIC_NAV} modules={PUBLIC_MODULES} /></SettingsProvider>
}
