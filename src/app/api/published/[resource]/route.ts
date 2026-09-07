import { NextResponse } from 'next/server'
import { PUBLIC_SETTINGS, PUBLIC_MODULES, PUBLIC_CATEGORIES, PUBLIC_NAV, PUBLIC_POSTS } from '@/lib/published-content'

// Public browser refreshes use the same deployment snapshot as server-rendered pages.
export async function GET(request: Request, { params }: { params: Promise<{ resource: string }> }) {
  const { resource } = await params
  const data: Record<string, unknown> = { settings: PUBLIC_SETTINGS, modules: PUBLIC_MODULES, categories: PUBLIC_CATEGORIES, navigation: PUBLIC_NAV }
  if (Object.prototype.hasOwnProperty.call(data, resource)) return NextResponse.json(data[resource])
  if (resource === 'blog') {
    const query = new URL(request.url).searchParams
    const slug = query.get('slug')
    if (slug) {
      const post = PUBLIC_POSTS.find(item => item.slug === slug)
      return post ? NextResponse.json(post) : NextResponse.json({ error: 'not_found' }, { status: 404 })
    }
    const page = Math.max(1, Number(query.get('page')) || 1)
    const pageSize = Math.min(1000, Math.max(1, Number(query.get('pageSize')) || 10))
    return NextResponse.json({ items: PUBLIC_POSTS.slice((page - 1) * pageSize, page * pageSize), total: PUBLIC_POSTS.length, page, pageSize })
  }
  return NextResponse.json({ error: 'not_found' }, { status: 404 })
}
