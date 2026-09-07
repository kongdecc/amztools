import { SITE_URL, PUBLIC_MODULES, PUBLIC_POSTS, STATIC_PAGES, toolPath } from '@/lib/published-content'
export const dynamic = 'force-static'
const escapeXml = (text: string) => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;')
export function GET() {
  const paths = ['/', '/functionality', '/blog', '/about', '/privacy', '/suggest', '/reward',
    ...PUBLIC_MODULES.map(toolPath), ...STATIC_PAGES.map(page => page.href)]
  const urls = [...new Set(paths)].map(path => '<url><loc>' + escapeXml(new URL(path, SITE_URL).href) + '</loc></url>')
  for (const post of PUBLIC_POSTS) {
    urls.push('<url><loc>' + escapeXml(SITE_URL + '/blog/' + encodeURIComponent(post.slug)) + '</loc></url>')
  }
  return new Response('<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">' + urls.join('') + '</urlset>', { headers: { 'Content-Type': 'application/xml; charset=utf-8' } })
}
