import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import fs from 'fs'
import path from 'path'

type NavItem = { id: string; label: string; href: string; order: number; isExternal?: boolean; active?: boolean }

const defaults: NavItem[] = [
  { id: 'about', label: '关于', href: '/about', order: 1, isExternal: false, active: true },
  { id: 'blog', label: '博客', href: '/blog', order: 2, isExternal: false, active: true },
  { id: 'suggest', label: '提需求', href: '/suggest', order: 3, isExternal: false, active: true }
]

const dataDir = path.join(process.cwd(), '.data')
const navFile = path.join(dataDir, 'navigation.json')

function readFileNav(): NavItem[] | null {
  try {
    const raw = fs.readFileSync(navFile, 'utf-8')
    const arr = JSON.parse(raw)
    if (Array.isArray(arr)) return arr as NavItem[]
  } catch {}
  return null
}

function writeFileNav(items: NavItem[]) {
  try {
    if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true })
    fs.writeFileSync(navFile, JSON.stringify(items))
  } catch {}
}

async function readDbNav(includeInactive: boolean): Promise<NavItem[] | null> {
  try {
    const row = await (db as any).siteSettings.findUnique({ where: { key: 'navigation' } })
    if (!row || !row.value) return null
    const arr = JSON.parse(row.value)
    if (!Array.isArray(arr)) return null
    const items = arr as NavItem[]
    const filtered = includeInactive ? items : items.filter(i => i.active !== false)
    return filtered.sort((a, b) => Number(a.order || 0) - Number(b.order || 0))
  } catch {}
  return null
}

async function writeDbNav(items: NavItem[]): Promise<boolean> {
  try {
    const value = JSON.stringify(items)
    await (db as any).siteSettings.upsert({
      where: { key: 'navigation' },
      update: { value },
      create: { key: 'navigation', value }
    })
    return true
  } catch {}
  return false
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url)
    const includeInactive = url.searchParams.get('includeInactive') === 'true'
    const dbItems = await readDbNav(includeInactive)
    if (dbItems && dbItems.length) return NextResponse.json(dbItems)
    const fileItems = readFileNav()
    const base = fileItems && fileItems.length ? fileItems : defaults
    const filtered = includeInactive ? base : base.filter(i => i.active !== false)
    const hasSuggest = filtered.some(i => i.id === 'suggest' || String(i.href || '').trim() === '/suggest')
    const next = hasSuggest ? filtered : [...filtered, { id: 'suggest', label: '提需求', href: '/suggest', order: Math.max(...filtered.map(i=>Number(i.order||0))) + 1, isExternal: false, active: true }]
    return NextResponse.json(next.sort((a, b) => Number(a.order || 0) - Number(b.order || 0)))
  } catch {
    return NextResponse.json(defaults, { status: 200 })
  }
}

export async function PUT(request: Request) {
  const cookie = request.headers.get('cookie') || ''
  const token = cookie.match(/admin_session=([^;]+)/)?.[1]
  if (!token) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  let items: NavItem[] = []
  try {
    const body = await request.json()
    items = Array.isArray(body) ? body as NavItem[] : Array.isArray(body?.items) ? body.items as NavItem[] : []
    if (!Array.isArray(items)) return NextResponse.json({ error: 'bad_request' }, { status: 400 })
  } catch {
    return NextResponse.json({ error: 'bad_request' }, { status: 400 })
  }
  const norm = items.map(i => ({ id: String(i.id), label: String(i.label), href: String(i.href), order: Number(i.order || 0), isExternal: Boolean(i.isExternal), active: i.active === false ? false : true }))
  const ok = await writeDbNav(norm)
  if (!ok) writeFileNav(norm)
  return NextResponse.json({ ok: true })
}

export async function PATCH(request: Request) {
  const cookie = request.headers.get('cookie') || ''
  const token = cookie.match(/admin_session=([^;]+)/)?.[1]
  if (!token) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  let item: NavItem | null = null
  try { item = await request.json() as any } catch { return NextResponse.json({ error: 'bad_request' }, { status: 400 }) }
  if (!item || !item.id) return NextResponse.json({ error: 'bad_request' }, { status: 400 })
  const current = await readDbNav(true) ?? readFileNav() ?? defaults
  const next = current.slice()
  const idx = next.findIndex(x => x.id === item!.id)
  const merged = { id: String(item.id), label: String(item.label || (idx >= 0 ? next[idx].label : '')), href: String(item.href || (idx >= 0 ? next[idx].href : '')), order: Number(item.order ?? (idx >= 0 ? next[idx].order : next.length + 1)), isExternal: Boolean(item.isExternal ?? (idx >= 0 ? next[idx].isExternal : false)), active: item.active === false ? false : true }
  if (idx >= 0) next[idx] = merged
  else next.push(merged)
  const ok = await writeDbNav(next)
  if (!ok) writeFileNav(next)
  return NextResponse.json({ ok: true, id: merged.id })
}

export async function DELETE(request: Request) {
  const cookie = request.headers.get('cookie') || ''
  const token = cookie.match(/admin_session=([^;]+)/)?.[1]
  if (!token) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  try {
    const url = new URL(request.url)
    const id = url.searchParams.get('id') || ''
    if (!id) return NextResponse.json({ error: 'bad_request' }, { status: 400 })
    const current = await readDbNav(true) ?? readFileNav() ?? defaults
    const next = current.filter(x => x.id !== id)
    const ok = await writeDbNav(next)
    if (!ok) writeFileNav(next)
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'bad_request' }, { status: 400 })
  }
}
