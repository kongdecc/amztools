import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { SESSION_COOKIE, getSessionByToken } from '@/lib/auth'
import fs from 'fs'
import path from 'path'

type BlogPost = {
  id: string
  title: string
  slug: string
  content: string
  status: string
  order: number
  views: number
  createdAt: string
  updatedAt: string
  coverUrl?: string
}

const dataDir = path.join(process.cwd(), '.data')
const blogFile = path.join(dataDir, 'blog.json')

function sortByLatestCreatedAt(items: BlogPost[]): BlogPost[] {
  const toTime = (s: unknown) => {
    const t = Date.parse(String(s || ''))
    return Number.isFinite(t) ? t : 0
  }
  return items
    .slice()
    .sort((a, b) => (toTime(b.createdAt) - toTime(a.createdAt)) || (Number(a.order || 0) - Number(b.order || 0)))
}

function readFilePosts(): BlogPost[] {
  try {
    const raw = fs.readFileSync(blogFile, 'utf-8')
    const arr = JSON.parse(raw)
    if (Array.isArray(arr)) return arr as BlogPost[]
  } catch {}
  return []
}

function writeFilePosts(items: BlogPost[]) {
  try {
    if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true })
    fs.writeFileSync(blogFile, JSON.stringify(items))
  } catch {}
}

function slugify(s: string): string {
  const base = String(s || '').trim().toLowerCase()
  const out = base
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
  return out || `post-${Date.now()}`
}

async function readDbPosts(includeDrafts: boolean): Promise<BlogPost[] | null> {
  try {
    const rows = await (db as any).blogPost.findMany()
    const items: BlogPost[] = rows.map((r: any) => ({
      id: String(r.id),
      title: String(r.title),
      slug: String(r.slug),
      content: String(r.content || ''),
      status: String(r.status || 'draft'),
      order: Number(r.order || 0),
      views: Number(r.views || 0),
      createdAt: (r.createdAt instanceof Date ? r.createdAt : new Date(r.createdAt)).toISOString(),
      updatedAt: (r.updatedAt instanceof Date ? r.updatedAt : new Date(r.updatedAt)).toISOString(),
      coverUrl: String(r.coverUrl || r.cover || '')
    }))
    const filtered = includeDrafts ? items : items.filter(i => i.status === 'published')
    return sortByLatestCreatedAt(filtered)
  } catch {}
  return null
}

async function writeDbPosts(items: BlogPost[]): Promise<boolean> {
  try {
    const existing = await (db as any).blogPost.findMany({ select: { id: true } })
    const keepIds = new Set(items.map(i => i.id))
    const toDelete = existing.map((r: any) => r.id).filter((id: string) => !keepIds.has(id))
    const ops: any[] = []
    if (toDelete.length) ops.push((db as any).blogPost.deleteMany({ where: { id: { in: toDelete } } }))
    ops.push(...items.map(i => (db as any).blogPost.upsert({
      where: { id: i.id },
      update: { title: i.title, slug: i.slug, content: i.content, status: i.status, order: i.order, views: i.views ?? 0, coverUrl: i.coverUrl || '' },
      create: { id: i.id, title: i.title, slug: i.slug, content: i.content, status: i.status || 'draft', order: i.order || 0, views: i.views ?? 0, coverUrl: i.coverUrl || '' }
    })))
    await db.$transaction(ops)
    return true
  } catch {}
  return false
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url)
    const includeDrafts = url.searchParams.get('includeDrafts') === 'true'
    const slug = url.searchParams.get('slug') || ''
    const pageParam = url.searchParams.get('page')
    const pageSizeParam = url.searchParams.get('pageSize')
    const page = Math.max(1, Number(pageParam || 1))
    const pageSize = Math.max(1, Number(pageSizeParam || 0))
    const dbItems = await readDbPosts(includeDrafts)
    let items = dbItems ?? readFilePosts()
    if (!items || items.length === 0) {
      items = readFilePosts()
    }
    const base = includeDrafts ? items : items.filter(i => i.status === 'published')
    const list = sortByLatestCreatedAt(base)
    if (slug) {
      const found = list.find(i => i.slug === slug)
      if (!found) return NextResponse.json({ error: 'not_found' }, { status: 404 })
      return NextResponse.json(found)
    }
    if (pageSize > 0) {
      const total = list.length
      const start = (page - 1) * pageSize
      const end = start + pageSize
      const itemsPage = list.slice(start, end)
      return NextResponse.json({ items: itemsPage, total, page, pageSize })
    }
    return NextResponse.json(list)
  } catch {
    return NextResponse.json(readFilePosts())
  }
}

export async function POST(request: Request) {
  const cookie = request.headers.get('cookie') || ''
  const token = cookie.match(new RegExp(`${SESSION_COOKIE}=([^;]+)`))?.[1]
  if (!token || !(await getSessionByToken(token))) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  let body: any = {}
  try { body = await request.json() } catch { body = {} }
  const title = String(body.title || '未命名')
  const slug = slugify(body.slug || title)
  const now = new Date().toISOString()
  const item: BlogPost = {
    id: body.id ? String(body.id) : `blog-${Date.now()}`,
    title,
    slug,
    content: String(body.content || ''),
    status: String(body.status || 'draft'),
    order: Number(body.order || 0),
    views: Number(body.views || 0),
    createdAt: now,
    updatedAt: now,
    coverUrl: String(body.coverUrl || '')
  }
  const current = await readDbPosts(true) ?? readFilePosts()
  const next = current.slice()
  const idx = next.findIndex(x => x.id === item.id)
  if (idx >= 0) next[idx] = { ...next[idx], ...item, updatedAt: now }
  else next.push(item)
  const ok = await writeDbPosts(next)
  if (!ok) writeFilePosts(next)
  return NextResponse.json({ ok: true, id: item.id })
}

export async function PUT(request: Request) {
  const cookie = request.headers.get('cookie') || ''
  const token = cookie.match(new RegExp(`${SESSION_COOKIE}=([^;]+)`))?.[1]
  if (!token || !(await getSessionByToken(token))) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  let list: BlogPost[] = []
  try {
    const body = await request.json()
    list = Array.isArray(body) ? body as BlogPost[] : Array.isArray(body?.items) ? body.items as BlogPost[] : []
  } catch {
    return NextResponse.json({ error: 'bad_request' }, { status: 400 })
  }
  const norm: BlogPost[] = list.map(i => ({
    id: String(i.id || `blog-${Date.now()}`),
    title: String(i.title || '未命名'),
    slug: slugify(i.slug || i.title),
    content: String(i.content || ''),
    status: String(i.status || 'draft'),
    order: Number(i.order || 0),
    views: Number(i.views || 0),
    createdAt: String(i.createdAt || new Date().toISOString()),
    updatedAt: new Date().toISOString(),
    coverUrl: String((i as any).coverUrl || '')
  }))
  const ok = await writeDbPosts(norm)
  if (!ok) writeFilePosts(norm)
  return NextResponse.json({ ok: true })
}

export async function DELETE(request: Request) {
  const cookie = request.headers.get('cookie') || ''
  const token = cookie.match(new RegExp(`${SESSION_COOKIE}=([^;]+)`))?.[1]
  if (!token || !(await getSessionByToken(token))) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  try {
    const url = new URL(request.url)
    const id = url.searchParams.get('id') || ''
    if (!id) return NextResponse.json({ error: 'bad_request' }, { status: 400 })
    const current = await readDbPosts(true) ?? readFilePosts()
    const next = current.filter(x => x.id !== id)
    const ok = await writeDbPosts(next)
    if (!ok) writeFilePosts(next)
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'bad_request' }, { status: 400 })
  }
}
