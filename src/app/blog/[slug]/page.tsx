import { SettingsProvider } from '@/components/SettingsProvider'
import { db } from '@/lib/db'
import BlogDetailClient from '../BlogDetailClient'
import fs from 'fs'
import path from 'path'
import { marked } from 'marked'
import DOMPurify from 'isomorphic-dompurify'
export const dynamic = 'force-dynamic'

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  let item: any = null
  try {
    const r = await db.blogPost.findUnique({ where: { slug } })
    if (r) item = { id: String(r.id), title: String(r.title), slug: String(r.slug), content: String(r.content || ''), status: String(r.status || 'draft'), order: Number(r.order || 0), views: Number(r.views || 0), createdAt: (r.createdAt instanceof Date ? r.createdAt : new Date(r.createdAt)).toISOString(), updatedAt: (r.updatedAt instanceof Date ? r.updatedAt : new Date(r.updatedAt)).toISOString(), coverUrl: String((r as any).coverUrl || '') }
  } catch { item = null }
  if (!item) {
    try {
      const dataDir = path.join(process.cwd(), '.data')
      const blogFile = path.join(dataDir, 'blog.json')
      const raw = fs.readFileSync(blogFile, 'utf-8')
      const arr = JSON.parse(raw)
      const list = Array.isArray(arr) ? arr : []
      const found = list.find((i: any) => String(i.slug || '') === slug)
      if (found) item = {
        id: String(found.id || `blog-${Date.now()}`),
        title: String(found.title || ''),
        slug: String(found.slug || ''),
        content: String(found.content || ''),
        status: String(found.status || 'published'),
        order: Number(found.order || 0),
        views: Number(found.views || 0),
        createdAt: String(found.createdAt || new Date().toISOString()),
        updatedAt: String(found.updatedAt || found.createdAt || new Date().toISOString()),
        coverUrl: String((found as any).coverUrl || '')
      }
    } catch {}
  }
  const content = String(item?.content || '')
  let initialHtml = ''
  try { initialHtml = DOMPurify.sanitize(String(marked.parse(content))) } catch { initialHtml = '' }
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
      <BlogDetailClient item={item} initialNavItems={navItems} initialHtml={initialHtml} />
    </SettingsProvider>
  )
}
