import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

const defaultCategories = [
  { key: 'operation', label: '运营工具', order: 1 },
  { key: 'advertising', label: '广告工具', order: 2 },
  { key: 'image-text', label: '图片文本', order: 3 },
  { key: 'other', label: '其他', order: 99 }
]

export async function GET() {
  try {
    let rows = await (db as any).toolCategory.findMany({ orderBy: { order: 'asc' } })
    if (rows.length === 0) {
      // Seed defaults if empty
      for (const d of defaultCategories) {
        await (db as any).toolCategory.upsert({
          where: { key: d.key },
          update: d,
          create: d
        })
      }
      rows = await (db as any).toolCategory.findMany({ orderBy: { order: 'asc' } })
    }
    return NextResponse.json(rows)
  } catch (e) {
    // Fallback if DB fails or table missing
    console.error(e)
    return NextResponse.json(defaultCategories)
  }
}

export async function POST(request: Request) {
  const cookie = request.headers.get('cookie') || ''
  const token = cookie.match(/admin_session=([^;]+)/)?.[1]
  if (!token) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  try {
    const body = await request.json()
    if (!body.key || !body.label) return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
    
    const row = await (db as any).toolCategory.create({
      data: {
        key: body.key,
        label: body.label,
        order: Number(body.order || 0)
      }
    })
    return NextResponse.json(row)
  } catch (e) {
    return NextResponse.json({ error: 'Failed to create' }, { status: 500 })
  }
}

export async function PUT(request: Request) {
  const cookie = request.headers.get('cookie') || ''
  const token = cookie.match(/admin_session=([^;]+)/)?.[1]
  if (!token) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  try {
    const list = await request.json()
    if (!Array.isArray(list)) return NextResponse.json({ error: 'Invalid data' }, { status: 400 })

    const ops = list.map((item: any) => (db as any).toolCategory.upsert({
      where: { key: item.key },
      update: { label: item.label, order: item.order, enabled: item.enabled !== false },
      create: { key: item.key, label: item.label, order: item.order, enabled: item.enabled !== false }
    }))
    
    await db.$transaction(ops)
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ error: 'Failed to update' }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  const cookie = request.headers.get('cookie') || ''
  const token = cookie.match(/admin_session=([^;]+)/)?.[1]
  if (!token) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  try {
    const { searchParams } = new URL(request.url)
    const key = searchParams.get('key')
    if (!key) return NextResponse.json({ error: 'Missing key' }, { status: 400 })

    await (db as any).toolCategory.delete({ where: { key } })
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ error: 'Failed to delete' }, { status: 500 })
  }
}
