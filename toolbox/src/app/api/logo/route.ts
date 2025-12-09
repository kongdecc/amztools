import { NextResponse } from 'next/server'
import { SESSION_COOKIE, getSessionByToken } from '@/lib/auth'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    // Try to get from DB first
    const row = await (db as any).siteSettings.findUnique({ where: { key: 'site_logo_data' } })
    if (row && row.value) {
      const parts = row.value.split(',')
      if (parts.length === 2) {
        const header = parts[0]
        const base64Data = parts[1]
        const match = header.match(/:(.*?);/)
        const contentType = match ? match[1] : 'image/png'
        const buf = Buffer.from(base64Data, 'base64')
        return new NextResponse(buf, { headers: { 'Content-Type': contentType, 'Cache-Control': 'public, max-age=3600' } })
      }
    }
    return NextResponse.json({ error: 'not_found' }, { status: 404 })
  } catch (e) {
    console.error('GET logo error:', e)
    return NextResponse.json({ error: 'failed' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const cookie = request.headers.get('cookie') || ''
    const token = cookie.match(new RegExp(`${SESSION_COOKIE}=([^;]+)`))?.[1]
    if (!token || !(await getSessionByToken(token))) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
    
    const fd = await request.formData()
    const file = fd.get('file') as File | null
    if (!file) return NextResponse.json({ error: 'bad_request' }, { status: 400 })
    
    // Limit size to 4MB
    if (file.size > 4 * 1024 * 1024) {
      return NextResponse.json({ error: 'too_large', message: 'File size exceeds 4MB limit' }, { status: 400 })
    }

    const arrayBuffer = await file.arrayBuffer()
    const buf = Buffer.from(arrayBuffer)
    const base64 = buf.toString('base64')
    const mimeType = file.type || 'image/png'
    const dataUrl = `data:${mimeType};base64,${base64}`
    
    await (db as any).siteSettings.upsert({
      where: { key: 'site_logo_data' },
      update: { value: dataUrl },
      create: { key: 'site_logo_data', value: dataUrl }
    })

    const url = `/api/logo?ts=${Date.now()}`
    return NextResponse.json({ ok: true, url })
  } catch (e: any) {
    console.error('Logo upload error:', e)
    return NextResponse.json({ error: 'failed', message: e.message }, { status: 500 })
  }
}