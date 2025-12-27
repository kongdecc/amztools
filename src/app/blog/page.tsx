import { SettingsProvider } from '@/components/SettingsProvider'
import BlogListClient from './BlogListClient'
import { db } from '@/lib/db'
import { Metadata } from 'next'
import { DEFAULT_NAV_ITEMS, DEFAULT_SITE_SETTINGS } from '@/lib/constants'

function getSiteBase(): URL | null {
  const raw = String(process.env.NEXT_PUBLIC_SITE_URL || '').trim()
  if (!raw) return null
  try {
    return new URL(raw.endsWith('/') ? raw : `${raw}/`)
  } catch {
    return null
  }
}

export async function generateMetadata(): Promise<Metadata> {
  const base = getSiteBase()
  let siteName = DEFAULT_SITE_SETTINGS.siteName
  let siteDescription = ''
  let siteKeywords = ''
  try {
    const rows = await (db as any).siteSettings.findMany()
    const settings: any = {}
    for (const r of rows as any) settings[String((r as any).key)] = String((r as any).value ?? '')
    siteName = settings.siteName || siteName
    siteDescription = settings.seoDescription || settings.siteDescription || ''
    siteKeywords = settings.siteKeywords || ''
  } catch {}

  const title = `${siteName} - 博客`
  const description = siteDescription || '博客文章列表'

  return {
    metadataBase: base || undefined,
    title,
    description,
    keywords: siteKeywords || undefined,
    alternates: { canonical: '/blog' },
    openGraph: {
      title,
      description,
      url: '/blog',
      type: 'website'
    },
    robots: {
      index: true,
      follow: true
    }
  }
}

export default async function Page() {
  const pageSize = 10
  let total = 0
  let list: any[] = []
  try {
    total = await db.blogPost.count({ where: { status: 'published' } })
    const rows = await db.blogPost.findMany({ where: { status: 'published' }, orderBy: [{ createdAt: 'desc' }], take: pageSize, skip: 0 })
    list = rows.map((r: any) => ({ id: String(r.id), title: String(r.title), slug: String(r.slug), content: String(r.content || ''), status: String(r.status || 'draft'), order: Number(r.order || 0), createdAt: (r.createdAt instanceof Date ? r.createdAt : new Date(r.createdAt)).toISOString(), coverUrl: String(r.coverUrl || '') }))
  } catch { total = 0; list = [] }
  let initialSettings: Record<string, any> = {}
  try {
    const rows = await (db as any).siteSettings.findMany()
    for (const r of rows as any) initialSettings[String((r as any).key)] = String((r as any).value ?? '')
  } catch {}
  let navItems: any[] = []
  try {
    const row = await db.siteSettings.findUnique({ where: { key: 'navigation' } })
    const arr = row && row.value ? JSON.parse(row.value) : []
    if (Array.isArray(arr) && arr.length > 0) {
      navItems = arr
    } else {
      navItems = DEFAULT_NAV_ITEMS
    }
  } catch {
    navItems = DEFAULT_NAV_ITEMS
  }
  const base = getSiteBase()
  const origin = base ? String(base).replace(/\/$/, '') : ''
  const seoSiteName = String(initialSettings['siteName'] || DEFAULT_SITE_SETTINGS.siteName)
  const logoUrl = String(initialSettings['logoUrl'] || '')
  const blogUrl = origin ? `${origin}/blog` : undefined
  const toAbs = (u: string) => {
    const s = String(u || '').trim()
    if (!s) return undefined
    if (/^https?:\/\//i.test(s)) return s
    if (origin && s.startsWith('/')) return `${origin}${s}`
    return s
  }
  const collectionLd = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: `${seoSiteName} - 博客`,
    url: blogUrl,
    hasPart: (Array.isArray(list) ? list : []).map((item: any) => ({
      "@type": "Article",
      headline: String(item.title || ''),
      url: origin ? `${origin}/blog/${item.slug}` : undefined,
      thumbnailUrl: toAbs(item.coverUrl) || undefined
    }))
  }
  const websiteLd = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: seoSiteName,
    url: origin || undefined
  }
  const orgLd = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: seoSiteName,
    url: origin || undefined,
    logo: toAbs(logoUrl) || undefined
  }
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(orgLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(collectionLd) }} />
      <SettingsProvider initial={initialSettings}>
        <BlogListClient initialList={list} initialTotal={total} initialNavItems={navItems} pageSize={pageSize} />
      </SettingsProvider>
    </>
  )
}
