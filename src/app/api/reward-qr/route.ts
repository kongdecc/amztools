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
  console.log('POST /api/reward-qr started')
  try {
    const cookie = request.headers.get('cookie') || ''
    // console.log('Cookie:', cookie) 
    const token = cookie.match(new RegExp(`${SESSION_COOKIE}=([^;]+)`))?.[1]
    if (!token) {
      console.log('No token found')
      return NextResponse.json({ error: 'unauthorized', reason: 'no_token' }, { status: 401 })
    }
    
    const session = await getSessionByToken(token)
    if (!session) {
      console.log('Invalid token')
      return NextResponse.json({ error: 'unauthorized', reason: 'invalid_token' }, { status: 401 })
    }
    
    console.log('Auth success, parsing form data...')
    
    let fd: FormData
    try {
      fd = await request.formData()
    } catch (err) {
      console.error('Failed to parse form data:', err)
      return NextResponse.json({ error: 'bad_request', message: 'Failed to parse form data: ' + String(err) }, { status: 400 })
    }

    const file = fd.get('file') as File | null
    
    if (!file) {
      console.log('No file in form data')
      return NextResponse.json({ error: 'bad_request', message: 'No file provided' }, { status: 400 })
    }
    
    console.log('File received:', file.name, file.type, file.size)
    
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
    console.log('Determined extension:', ext)
    
    console.log('Data dir:', dataDir)
    if (!fs.existsSync(dataDir)) {
      console.log('Creating data dir...')
      fs.mkdirSync(dataDir, { recursive: true })
    }
    
    // Remove old files
    for (const e of exts) {
      const p = path.join(dataDir, `reward-qr.${e}`)
      try { if (fs.existsSync(p)) fs.unlinkSync(p) } catch {}
    }
    
    console.log('Reading file buffer...')
    const arrayBuffer = await file.arrayBuffer()
    const buf = Buffer.from(arrayBuffer)
    
    const dest = path.join(dataDir, `reward-qr.${ext}`)
    console.log('Writing to:', dest)
    fs.writeFileSync(dest, buf)
    
    // Double check file exists and size
    if (!fs.existsSync(dest) || fs.statSync(dest).size === 0) {
      console.error('File write verification failed')
      return NextResponse.json({ error: 'write_failed' }, { status: 500 })
    }
    
    const url = `/api/reward-qr?ts=${Date.now()}`
    console.log('Upload success, url:', url)
    return NextResponse.json({ ok: true, url })
  } catch (e: any) {
    console.error('Upload error full stack:', e)
    return NextResponse.json({ error: 'failed', message: e.message, stack: e.stack }, { status: 500 })
  }
}
