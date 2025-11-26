import { SettingsProvider } from '@/components/SettingsProvider'
import { db } from '@/lib/db'
import BlogDetailClient from '../BlogDetailClient'
export const dynamic = 'force-dynamic'

export default async function Page({ params }: { params: { slug: string } }) {
  const slug = String(params?.slug || '')
  let item: any = null
  try {
    const r = await db.blogPost.findUnique({ where: { slug } })
    if (r) item = { id: String(r.id), title: String(r.title), slug: String(r.slug), content: String(r.content || ''), status: String(r.status || 'draft'), order: Number(r.order || 0), views: Number(r.views || 0), createdAt: (r.createdAt instanceof Date ? r.createdAt : new Date(r.createdAt)).toISOString(), updatedAt: (r.updatedAt instanceof Date ? r.updatedAt : new Date(r.updatedAt)).toISOString(), coverUrl: String((r as any).coverUrl || '') }
  } catch { item = null }
  let initialSettings: Record<string, any> = {}
  try {
    const rows = await (db as any).siteSettings.findMany()
    for (const r of rows as any) initialSettings[String((r as any).key)] = String((r as any).value ?? '')
  } catch {}
  let navItems: any[] = []
  try {
    const row = await (db as any).siteSettings.findUnique({ where: { key: 'navigation' } })
    const arr = row && (row as any).value ? JSON.parse(String((row as any).value)) : []
    if (Array.isArray(arr) && arr.length > 0) {
      navItems = arr
    } else {
      navItems = [
        { id: 'about', label: '关于', href: '/about', order: 1, isExternal: false, active: true },
        { id: 'blog', label: '博客', href: '/blog', order: 2, isExternal: false, active: true },
        { id: 'suggest', label: '提需求', href: '/suggest', order: 3, isExternal: false, active: true }
      ]
    }
  } catch {
    navItems = [
      { id: 'about', label: '关于', href: '/about', order: 1, isExternal: false, active: true },
      { id: 'blog', label: '博客', href: '/blog', order: 2, isExternal: false, active: true },
      { id: 'suggest', label: '提需求', href: '/suggest', order: 3, isExternal: false, active: true }
    ]
  }
  return (
    <SettingsProvider initial={initialSettings}>
      <BlogDetailClient item={item} initialNavItems={navItems} />
    </SettingsProvider>
  )
}