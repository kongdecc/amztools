import { NextResponse } from 'next/server'
import { SESSION_COOKIE, getSessionByToken } from '@/lib/auth'
import fs from 'fs'
import path from 'path'

export const dynamic = 'force-dynamic'

const dataDir = path.join(process.cwd(), '.data')
const exts = ['png','jpg','jpeg','webp','svg']

function getQrPath(): { filePath: string | null, ext: string | null } {
  for (const ext of exts) {
    const p = path.join(dataDir, `reward-qr.${ext}`)
    if (fs.existsSync(p)) return { filePath: p, ext }
  }
  return { filePath: null, ext: null }
}

function contentTypeForExt(ext: string | null): string {
  switch (ext) {
    case 'png': return 'image/png'
    case 'jpg':
    case 'jpeg': return 'image/jpeg'
    case 'webp': return 'image/webp'
    case 'svg': return 'image/svg+xml'
    default: return 'application/octet-stream'
  }
}

export async function GET() {
  try {
    const { filePath, ext } = getQrPath()
    if (!filePath) return NextResponse.json({ error: 'not_found' }, { status: 404 })
    const buf = fs.readFileSync(filePath)
    return new NextResponse(buf, { headers: { 'Content-Type': contentTypeForExt(ext), 'Cache-Control': 'public, max-age=3600' } })
  } catch {
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
    
    const type = String(file.type || '')
    let ext = ''
    if (type.startsWith('image/')) {
      ext = type.split('/')[1]
    }
    if (!ext) {
      const name = String((file as any).name || '')
      const m = name.match(/\.([a-zA-Z0-9]+)$/)
      ext = m ? m[1].toLowerCase() : ''
    }
    
    if (!ext || !exts.includes(ext)) ext = 'png'
    
    if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true })
    
    // Remove old files
    for (const e of exts) {
      const p = path.join(dataDir, `reward-qr.${e}`)
      try { if (fs.existsSync(p)) fs.unlinkSync(p) } catch {}
    }
    
    const buf = Buffer.from(await file.arrayBuffer())
    const dest = path.join(dataDir, `reward-qr.${ext}`)
    fs.writeFileSync(dest, buf)
    
    // Double check file exists and size
    if (!fs.existsSync(dest) || fs.statSync(dest).size === 0) {
      return NextResponse.json({ error: 'write_failed' }, { status: 500 })
    }
    
    const url = `/api/reward-qr?ts=${Date.now()}`
    return NextResponse.json({ ok: true, url })
  } catch (e) {
    console.error('Upload error:', e)
    return NextResponse.json({ error: 'failed', message: String(e) }, { status: 500 })
  }
}
