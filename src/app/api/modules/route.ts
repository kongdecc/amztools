import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { DEFAULT_TOOLS } from '@/lib/constants'
import fs from 'fs'
import path from 'path'

const DATA_FILE = path.join(process.cwd(), 'data', 'modules.json')

const defaults = (DEFAULT_TOOLS as any[]).map((t: any) => ({
  ...t,
  views: Number(t.views || 0)
}))

function getLocalData() {
  try {
    if (fs.existsSync(DATA_FILE)) {
      const content = fs.readFileSync(DATA_FILE, 'utf-8')
      return JSON.parse(content)
    }
  } catch {}
  return null
}

function saveLocalData(data: Array<any>) {
  try {
    const dir = path.dirname(DATA_FILE)
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true })
    }
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2))
  } catch {}
}


export async function GET() {
  try {
    let rows = await (db as any).toolModule.findMany({ orderBy: { order: 'asc' } })
    const existing = new Set(rows.map((r: any) => r.key))
    const missing = defaults.filter(d => !existing.has(d.key))
    if (missing.length) {
      await db.$transaction(missing.map(d => (db as any).toolModule.upsert({
        where: { key: d.key },
        update: d,
        create: d
      })))
      rows = await (db as any).toolModule.findMany({ orderBy: { order: 'asc' } })
    }
    return NextResponse.json(rows)
  } catch {
    const local = getLocalData()
    const data = (local || defaults).slice().sort((a: any, b: any) => Number(a.order || 0) - Number(b.order || 0))
    return NextResponse.json(data)
  }
}

export async function PUT(request: Request) {
  const cookie = request.headers.get('cookie') || ''
  const token = cookie.match(/admin_session=([^;]+)/)?.[1]
  if (!token) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  let list: Array<any> = []
  try {
    list = await request.json()
  } catch {
    return NextResponse.json({ error: 'bad_request' }, { status: 400 })
  }
  try {
    const existing = await (db as any).toolModule.findMany({ select: { key: true } })
    const keepKeys = new Set(list.map(item => item.key))
    const toDelete = existing.map((r: any) => r.key).filter((k: any) => !keepKeys.has(k))
    const ops: Array<any> = []
    if (toDelete.length) ops.push((db as any).toolModule.deleteMany({ where: { key: { in: toDelete } } }))
    ops.push(...list.map(item => (db as any).toolModule.upsert({
      where: { key: item.key },
      update: { title: item.title, desc: item.desc, status: item.status, views: item.views ?? 0, color: item.color ?? 'blue', order: item.order ?? 0, category: item.category || 'other' },
      create: { key: item.key, title: item.title, desc: item.desc, status: item.status ?? '启用', views: item.views ?? 0, color: item.color ?? 'blue', order: item.order ?? 0, category: item.category || 'other' }
    })))
    await db.$transaction(ops)
    return NextResponse.json({ ok: true })
  } catch {
    const mapped = list.map((x, i) => ({ ...x, id: x.key, updatedAt: new Date().toISOString(), order: Number(x.order ?? i + 1) }))
    saveLocalData(mapped)
    return NextResponse.json({ ok: true, dev: true })
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const key = body?.key
    if (!key) return NextResponse.json({ error: 'bad_request' }, { status: 400 })
    try {
      const row = await (db as any).toolModule.update({ where: { key }, data: { views: { increment: 1 } } })
      return NextResponse.json({ ok: true, views: row.views })
    } catch {
      const arr = (getLocalData() || defaults).slice()
      const idx = arr.findIndex((x: any) => x.key === key)
      if (idx >= 0) arr[idx] = { ...arr[idx], views: Number(arr[idx].views || 0) + 1 }
      saveLocalData(arr)
      return NextResponse.json({ ok: true, dev: true })
    }
  } catch {
    return NextResponse.json({ error: 'bad_request' }, { status: 400 })
  }
}
export async function PATCH(request: Request) {
  const cookie = request.headers.get('cookie') || ''
  const token = cookie.match(/admin_session=([^;]+)/)?.[1]
  if (!token) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  let item: any = null
  try { item = await request.json() } catch { return NextResponse.json({ error: 'bad_request' }, { status: 400 }) }
  const key = item?.key
  if (!key) return NextResponse.json({ error: 'bad_request' }, { status: 400 })
  try {
    await (db as any).toolModule.upsert({
      where: { key },
      update: { title: item.title, desc: item.desc, status: item.status, views: item.views ?? 0, color: item.color ?? 'blue', order: item.order ?? 0, category: item.category || 'other' },
      create: { key, title: item.title, desc: item.desc, status: item.status ?? '启用', views: item.views ?? 0, color: item.color ?? 'blue', order: item.order ?? 0, category: item.category || 'other' }
    })
    return NextResponse.json({ ok: true, key })
  } catch {
    const arr = (getLocalData() || defaults).slice()
    const idx = arr.findIndex((x: any) => x.key === key)
    const next = { ...item, id: key, updatedAt: new Date().toISOString() }
    if (idx >= 0) arr[idx] = { ...arr[idx], ...next }
    else arr.push(next)
    saveLocalData(arr)
    return NextResponse.json({ ok: true, dev: true, key })
  }
}
