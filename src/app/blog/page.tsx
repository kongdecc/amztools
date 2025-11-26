import { SettingsProvider } from '@/components/SettingsProvider'
import BlogListClient from './BlogListClient'
import { db } from '@/lib/db'

export default async function Page() {
  const pageSize = 10
  let total = 0
  let list: any[] = []
  try {
    total = await db.blogPost.count({ where: { status: 'published' } })
    const rows = await db.blogPost.findMany({ where: { status: 'published' }, orderBy: [{ order: 'asc' }, { createdAt: 'desc' }], take: pageSize, skip: 0 })
    list = rows.map((r: any) => ({ id: String(r.id), title: String(r.title), slug: String(r.slug), content: String(r.content || ''), status: String(r.status || 'draft'), order: Number(r.order || 0), createdAt: (r.createdAt instanceof Date ? r.createdAt : new Date(r.createdAt)).toISOString(), coverUrl: String(r.coverUrl || '') }))
  } catch { total = 0; list = [] }
  let navItems: any[] = []
  try {
    const row = await db.siteSettings.findUnique({ where: { key: 'navigation' } })
    const arr = row && row.value ? JSON.parse(row.value) : []
    navItems = Array.isArray(arr) ? arr : []
  } catch {
    navItems = [
      { id: 'about', label: '关于', href: '/about', order: 1, isExternal: false, active: true },
      { id: 'blog', label: '博客', href: '/blog', order: 2, isExternal: false, active: true },
      { id: 'suggest', label: '提需求', href: '/suggest', order: 3, isExternal: false, active: true }
    ]
  }
  return (
    <SettingsProvider>
      <BlogListClient initialList={list} initialTotal={total} initialNavItems={navItems} pageSize={pageSize} />
    </SettingsProvider>
  )
}