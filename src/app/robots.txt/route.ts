import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const proto = (request.headers.get('x-forwarded-proto') || 'http').replace(/[^a-z]/g, '')
  const host = request.headers.get('host') || 'localhost:3000'
  const origin = `${proto}://${host}`
  let settings: any = {}
  try {
    const r = await fetch(`${origin}/api/settings`, { cache: 'no-store' })
    if (r.ok) settings = await r.json()
  } catch {}
  const sitemapEnabled = String(settings.sitemapEnabled || 'true') === 'true'
  const robots = String(settings.robotsContent || 'User-agent: *\nAllow: /')
  const lines = [robots.trim()]
  const disallowQuery = String(settings.robotsDisallowQuery || 'false') === 'true'
  if (disallowQuery) lines.push('Disallow: /*?*')
  const disallowAdmin = String(settings.robotsDisallowAdmin || 'false') === 'true'
  if (disallowAdmin) lines.push('Disallow: /admin/')
  const disallowPageParam = String(settings.robotsDisallowPageParam || 'false') === 'true'
  if (disallowPageParam) lines.push('Disallow: /*?page=*')
  const disallowUtmParams = String(settings.robotsDisallowUtmParams || 'false') === 'true'
  if (disallowUtmParams) lines.push('Disallow: /*?utm_*')
  if (sitemapEnabled) lines.push(`Sitemap: ${origin}/sitemap.xml`)
  const body = lines.join('\n') + '\n'
  return new NextResponse(body, { headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' } })
}