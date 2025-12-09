import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import fs from 'fs'
import path from 'path'

const dataDir = path.join(process.cwd(), '.data')
const blogFile = path.join(dataDir, 'blog.json')

function readFilePosts(): any[] {
  try {
    const raw = fs.readFileSync(blogFile, 'utf-8')
    const arr = JSON.parse(raw)
    if (Array.isArray(arr)) return arr
  } catch {}
  return []
}

function writeFilePosts(items: any[]) {
  try {
    if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true })
    fs.writeFileSync(blogFile, JSON.stringify(items))
  } catch {}
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const slug = String(body?.slug || '')
    if (!slug) return NextResponse.json({ error: 'bad_request' }, { status: 400 })
    try {
      const row = await (db as any).blogPost.update({ where: { slug }, data: { views: { increment: 1 } } })
      return NextResponse.json({ ok: true, views: Number(row.views || 0) })
    } catch {
      const arr = readFilePosts()
      const idx = arr.findIndex((x: any) => String(x.slug) === slug)
      if (idx >= 0) {
        arr[idx].views = Number(arr[idx].views || 0) + 1
        writeFilePosts(arr)
        return NextResponse.json({ ok: true, views: Number(arr[idx].views || 0), dev: true })
      }
      return NextResponse.json({ error: 'not_found' }, { status: 404 })
    }
  } catch {
    return NextResponse.json({ error: 'bad_request' }, { status: 400 })
  }
}