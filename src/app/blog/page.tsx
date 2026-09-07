import { PUBLIC_SETTINGS, PUBLIC_NAV, PUBLIC_MODULES, PUBLIC_CATEGORIES, PUBLIC_POSTS, SITE_URL, pageMetadata, jsonLd } from '@/lib/published-content'
import { SettingsProvider } from '@/components/SettingsProvider'
import BlogListClient from './BlogListClient'
export const metadata = pageMetadata('亚马逊运营博客', '阅读亚马逊广告、Listing、价格与运营费用的文章，配合跨境工具魔方工具使用。', '/blog')
export default function Page() {
  return <SettingsProvider initial={PUBLIC_SETTINGS}><BlogListClient initialList={PUBLIC_POSTS.slice(0, 10)} initialTotal={PUBLIC_POSTS.length} initialNavItems={PUBLIC_NAV} pageSize={10} /></SettingsProvider>
}
