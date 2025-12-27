import { SettingsProvider } from '@/components/SettingsProvider'
import { DEFAULT_SITE_SETTINGS } from '@/lib/constants'
import { db } from '@/lib/db'
import BlogDetailClient from '../BlogDetailClient'
import fs from 'fs'
import path from 'path'
import { marked } from 'marked'
import { Metadata } from 'next'
export const dynamic = 'force-dynamic'

function getSiteBase(): URL | null {
  const raw = String(process.env.NEXT_PUBLIC_SITE_URL || '').trim()
  if (!raw) return null
  try {
    return new URL(raw.endsWith('/') ? raw : `${raw}/`)
  } catch {
    return null
  }
}

function stripText(html: string): string {
  return String(html || '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

async function getPostBySlug(slug: string) {
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
  return item
}

async function getSettingsMap(): Promise<Record<string, string>> {
  const out: Record<string, string> = {}
  try {
    const rows = await (db as any).siteSettings.findMany()
    for (const r of rows as any) out[String((r as any).key)] = String((r as any).value ?? '')
  } catch {}
  return out
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const base = getSiteBase()
  const settings = await getSettingsMap()
  const siteName = settings.siteName || DEFAULT_SITE_SETTINGS.siteName
  const siteDescription = settings.seoDescription || settings.siteDescription || ''
  const siteKeywords = settings.siteKeywords || ''
  const item = await getPostBySlug(slug)
  const title = item?.title ? `${String(item.title)} - ${siteName}` : `${siteName} - 博客`

  let description = siteDescription
  try {
    const html = String(marked.parse(String(item?.content || '')))
    const text = stripText(html)
    if (text) description = text.slice(0, 160)
  } catch {}

  const coverUrl = String(item?.coverUrl || '').trim()
  const image = (() => {
    if (!coverUrl) return undefined
    if (/^https?:\/\//i.test(coverUrl)) return coverUrl
    if (base && coverUrl.startsWith('/')) return new URL(coverUrl.slice(1), base).toString()
    return coverUrl
  })()

  return {
    metadataBase: base || undefined,
    title,
    description: description || undefined,
    keywords: siteKeywords || undefined,
    alternates: { canonical: `/blog/${slug}` },
    openGraph: {
      type: 'article',
      title,
      description,
      url: `/blog/${slug}`,
      images: image ? [{ url: image }] : undefined
    },
    twitter: {
      card: image ? 'summary_large_image' : 'summary',
      title,
      description,
      images: image ? [image] : undefined
    },
    robots: {
      index: true,
      follow: true
    }
  }
}

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const item = await getPostBySlug(slug)
  const content = String(item?.content || '')
  let initialHtml = ''
  try { initialHtml = String(marked.parse(content)) } catch { initialHtml = '' }
  let initialSettings: Record<string, any> = {}
  try {
    const rows = await (db as any).siteSettings.findMany()
    for (const r of rows as any) initialSettings[String((r as any).key)] = String((r as any).value ?? '')
  } catch {}
  let navItems: any[] = []
  try {
    const row = await (db as any).siteSettings.findUnique({ where: { key: 'navigation' } })
    const arr = row && (row as any).value ? JSON.parse(String((row as any).value)) : []
    const defaults = [
      { id: 'about', label: '关于', href: '/about', order: 1, isExternal: false, active: true },
      { id: 'blog', label: '博客', href: '/blog', order: 2, isExternal: false, active: true },
      { id: 'suggest', label: '提需求', href: '/suggest', order: 3, isExternal: false, active: true }
    ]
    const list = Array.isArray(arr) ? arr : []
    const byId: Record<string, any> = {}
    for (const it of list) { if (it && typeof it.id === 'string') byId[it.id] = it }
    for (const d of defaults) {
      const ex = byId[d.id]
      if (!ex) byId[d.id] = d
      else {
        const href = typeof ex.href === 'string' ? ex.href : ''
        if (!href || href === '/adout' || !href.startsWith('/')) byId[d.id] = { ...ex, href: d.href }
        if (typeof ex.label !== 'string' || !ex.label) byId[d.id] = { ...byId[d.id], label: d.label }
        if (typeof ex.order !== 'number') byId[d.id] = { ...byId[d.id], order: d.order }
        byId[d.id] = { ...byId[d.id], isExternal: false, active: true }
      }
    }
    navItems = Object.values(byId)
  } catch {
    navItems = [
      { id: 'about', label: '关于', href: '/about', order: 1, isExternal: false, active: true },
      { id: 'blog', label: '博客', href: '/blog', order: 2, isExternal: false, active: true },
      { id: 'suggest', label: '提需求', href: '/suggest', order: 3, isExternal: false, active: true }
    ]
  }
  const base = getSiteBase()
  const origin = base ? String(base).replace(/\/$/, '') : ''
  const title = String(item?.title || '')
  let desc = ''
  try {
    const text = stripText(initialHtml)
    desc = text.slice(0, 160)
  } catch {}
  const cover = String(item?.coverUrl || '').trim()
  const image = (() => {
    if (!cover) return undefined
    if (/^https?:\/\//i.test(cover)) return cover
    if (origin && cover.startsWith('/')) return `${origin}${cover}`
    return cover
  })()
  const breadcrumbLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      origin ? { "@type": "ListItem", position: 1, name: "首页", item: `${origin}/` } : undefined,
      origin ? { "@type": "ListItem", position: 2, name: "博客", item: `${origin}/blog` } : undefined,
      origin ? { "@type": "ListItem", position: 3, name: title || slug, item: `${origin}/blog/${slug}` } : undefined
    ].filter(Boolean)
  }
  const articleLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: title || slug,
    datePublished: item?.createdAt || undefined,
    dateModified: item?.updatedAt || undefined,
    image: image ? [image] : undefined,
    url: origin ? `${origin}/blog/${slug}` : undefined,
    description: desc || undefined,
    mainEntityOfPage: origin ? `${origin}/blog/${slug}` : undefined
  }
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(articleLd) }} />
      <SettingsProvider initial={initialSettings}>
        <BlogDetailClient item={item} initialNavItems={navItems} initialHtml={initialHtml} />
      </SettingsProvider>
    </>
  )
}
