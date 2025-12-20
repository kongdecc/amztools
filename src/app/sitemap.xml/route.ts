import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import fs from 'fs'
import path from 'path'

export const dynamic = 'force-dynamic'

async function getSettings(origin: string) {
  try {
    const r = await fetch(`${origin}/api/settings`, { cache: 'no-store' })
    if (r.ok) return await r.json()
  } catch {}
  return {}
}

async function getPosts(origin: string) {
  try {
    const r = await fetch(`${origin}/api/blog?page=1&pageSize=1000`, { cache: 'no-store' })
    const d = await r.json()
    const arr = Array.isArray(d) ? d : Array.isArray(d?.items) ? d.items : []
    return arr
  } catch { return [] }
}

async function getNav(origin: string) {
  try {
    const r = await fetch(`${origin}/api/navigation`, { cache: 'no-store' })
    const d = await r.json()
    return Array.isArray(d) ? d : []
  } catch { return [] }
}

async function getNavLastMod(): Promise<string> {
  try {
    const row = await (db as any).siteSettings.findUnique({ where: { key: 'navigation' }, select: { updatedAt: true } })
    if (row?.updatedAt) return (row.updatedAt instanceof Date ? row.updatedAt : new Date(row.updatedAt)).toISOString()
  } catch {}
  try {
    const file = path.join(process.cwd(), '.data', 'navigation.json')
    const stat = fs.statSync(file)
    if (stat?.mtime) return stat.mtime.toISOString()
  } catch {}
  return new Date().toISOString()
}

export async function GET(request: Request) {
  const proto = (request.headers.get('x-forwarded-proto') || 'http').replace(/[^a-z]/g, '')
  const host = request.headers.get('host') || 'localhost:3000'
  const origin = `${proto}://${host}`
  const settings = await getSettings(origin)
  const enabled = String(settings.sitemapEnabled || 'true') === 'true'
  if (!enabled) return NextResponse.json({ error: 'disabled' }, { status: 404 })
  const frequency = String(settings.sitemapFrequency || '').trim().toLowerCase()
  const allowedFreq = new Set(['always', 'hourly', 'daily', 'weekly', 'monthly', 'yearly', 'never'])
  const changefreq = allowedFreq.has(frequency) ? frequency : ''
  const posts = await getPosts(origin)
  const nav = await getNav(origin)
  const urls: string[] = []
  const seen = new Set<string>()
  const buildUrl = (loc: string, opts?: { lastmod?: string; priority?: string }) => {
    const parts: string[] = [`<url><loc>${loc}</loc>`]
    if (opts?.lastmod) parts.push(`<lastmod>${opts.lastmod}</lastmod>`)
    if (changefreq) parts.push(`<changefreq>${changefreq}</changefreq>`)
    if (opts?.priority) parts.push(`<priority>${opts.priority}</priority>`)
    parts.push(`</url>`)
    return parts.join('')
  }
  const pushUrl = (u: string, opts?: { lastmod?: string; priority?: string }) => {
    if (seen.has(u)) return
    urls.push(buildUrl(u, opts))
    seen.add(u)
  }
  const nowIso = new Date().toISOString()
  pushUrl(`${origin}/`, { lastmod: nowIso, priority: '1.0' })
  pushUrl(`${origin}/blog`, { lastmod: nowIso, priority: '0.9' })
  pushUrl(`${origin}/about`, { lastmod: nowIso, priority: '0.6' })
  pushUrl(`${origin}/privacy`, { lastmod: nowIso, priority: '0.3' })
  pushUrl(`${origin}/suggest`, { lastmod: nowIso, priority: '0.5' })
  const navLastmod = await getNavLastMod()
  nav
    .filter((n: any) => !n.isExternal && typeof n.href === 'string' && n.href.startsWith('/'))
    .forEach((n: any) => {
      const href = String(n.href || '/').replace(/\/$/, '') || '/'
      const url = href === '/' ? `${origin}/` : `${origin}${href}`
      if (!seen.has(url)) {
        urls.push(buildUrl(url, { lastmod: navLastmod, priority: '0.8' }))
        seen.add(url)
      }
    })
  posts.forEach((p: any) => {
    const loc = `${origin}/blog/${p.slug}`
    const lastmod = p.updatedAt || p.createdAt || ''
    const image = (p.coverUrl || '').trim()
    const imageNode = image ? `<image:image><image:loc>${image}</image:loc></image:image>` : ''
    if (!seen.has(loc)) {
      urls.push(`<url><loc>${loc}</loc>${lastmod ? `<lastmod>${new Date(lastmod).toISOString()}</lastmod>` : ''}${changefreq ? `<changefreq>${changefreq}</changefreq>` : ''}<priority>0.7</priority>${imageNode}</url>`)
      seen.add(loc)
    }
  })
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n`+
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">`+
    urls.join('')+
    `</urlset>`
  return new NextResponse(xml, { headers: { 'Content-Type': 'application/xml; charset=utf-8', 'Cache-Control': 'no-store' } })
}
