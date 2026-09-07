import { SITE_URL } from '@/lib/published-content'
export const dynamic = 'force-static'
export function GET() {
  return new Response('User-agent: *\nAllow: /\nDisallow: /admin\nDisallow: /login\nDisallow: /*?tab=\nDisallow: /*?full=\nSitemap: ' + SITE_URL + '/sitemap.xml\n', {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' }
  })
}
