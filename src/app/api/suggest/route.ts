import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import fs from 'fs'
import path from 'path'

export const dynamic = 'force-dynamic'

type SuggestItem = {
  id: string
  nickname: string
  content: string
  createdAt: string
}

const dataDir = path.join(process.cwd(), '.data')
const dataFile = path.join(dataDir, 'suggest.json')

function readFileItems(): SuggestItem[] {
  try {
    if (!fs.existsSync(dataFile)) return []
    const raw = fs.readFileSync(dataFile, 'utf-8')
    const arr = JSON.parse(raw)
    return Array.isArray(arr) ? arr as SuggestItem[] : []
  } catch { return [] }
}

function writeFileItems(items: SuggestItem[]) {
  try {
    if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true })
    fs.writeFileSync(dataFile, JSON.stringify(items, null, 2), 'utf-8')
  } catch {}
}

async function readDbItems(): Promise<SuggestItem[] | null> {
  try {
    const rows = await (db as any).suggest.findMany({ orderBy: { createdAt: 'desc' } })
    if (!Array.isArray(rows)) return null
    return rows.map((r: any) => ({ id: String(r.id), nickname: String(r.nickname), content: String(r.content), createdAt: (r.createdAt instanceof Date ? r.createdAt : new Date(r.createdAt)).toISOString() }))
  } catch { return null }
}

async function writeDbItem(item: SuggestItem): Promise<boolean> {
  try {
    await (db as any).suggest.upsert({
      where: { id: item.id },
      update: { nickname: item.nickname, content: item.content },
      create: { id: item.id, nickname: item.nickname, content: item.content, createdAt: new Date(item.createdAt) }
    })
    return true
  } catch { return false }
}

export async function GET(request: Request) {
  const url = new URL(request.url)
  const page = Number(url.searchParams.get('page') || 1)
  const pageSize = Number(url.searchParams.get('pageSize') || 10)
  const dbItems = await readDbItems()
  const items = dbItems ?? readFileItems()
  const sorted = (Array.isArray(items) ? items : []).slice().sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
  const total = sorted.length
  const start = Math.max(0, (page - 1) * pageSize)
  const end = Math.min(total, start + pageSize)
  const pageItems = sorted.slice(start, end)
  return NextResponse.json({ items: pageItems, total, page, pageSize })
}

export async function POST(request: Request) {
  let body: any = {}
  try { body = await request.json() } catch { body = {} }
  const nickname = String(body.nickname || '').trim().slice(0, 40)
  const content = String(body.content || '').trim().slice(0, 2000)
  if (!nickname || !content) return NextResponse.json({ error: 'missing_fields' }, { status: 400 })
  const now = new Date().toISOString()
  const id = `sug-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  const item: SuggestItem = { id, nickname, content, createdAt: now }
  const ok = await writeDbItem(item)
  if (!ok) {
    const arr = readFileItems()
    arr.push(item)
    writeFileItems(arr)
  }
  return NextResponse.json({ ok: true, item })
}

export async function DELETE(request: Request) {
  const cookie = request.headers.get('cookie') || ''
  const token = cookie.match(/admin_session=([^;]+)/)?.[1]
  if (!token) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  let ids: string[] = []
  try {
    const url = new URL(request.url)
    const id = url.searchParams.get('id')
    const idsParam = url.searchParams.get('ids')
    if (id) ids.push(String(id))
    if (idsParam) ids.push(...String(idsParam).split(',').map(s => s.trim()).filter(Boolean))
  } catch {}
  if (ids.length === 0) {
    try {
      const body: any = await request.json()
      const bId = body?.id ? String(body.id) : ''
      const bIds = Array.isArray(body?.ids) ? body.ids.map((x: any) => String(x)).filter(Boolean) : []
      if (bId) ids.push(bId)
      if (bIds.length) ids.push(...bIds)
    } catch {}
  }
  ids = Array.from(new Set(ids)).filter(Boolean)
  if (!ids.length) return NextResponse.json({ error: 'bad_request' }, { status: 400 })
  let count = 0
  try {
    const res = await (db as any).suggest.deleteMany({ where: { id: { in: ids } } })
    count = Number(res?.count || 0)
    return NextResponse.json({ ok: true, count })
  } catch {
    const items = readFileItems()
    const before = items.length
    const next = items.filter(i => !ids.includes(i.id))
    writeFileItems(next)
    count = Math.max(0, before - next.length)
    return NextResponse.json({ ok: true, count })
  }
}