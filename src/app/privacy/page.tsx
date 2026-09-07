import { PUBLIC_SETTINGS, PUBLIC_NAV, PUBLIC_MODULES, PUBLIC_CATEGORIES, PUBLIC_POSTS, SITE_URL, pageMetadata, jsonLd } from '@/lib/published-content'
import { SettingsProvider } from '@/components/SettingsProvider'
import PrivacyClient from './PrivacyClient'
export const metadata = pageMetadata('隐私说明', '跨境工具魔方的隐私说明与数据处理方式。', '/privacy')
export default function Page() {
  return <SettingsProvider initial={PUBLIC_SETTINGS}><PrivacyClient initialNavItems={PUBLIC_NAV} /></SettingsProvider>
}
