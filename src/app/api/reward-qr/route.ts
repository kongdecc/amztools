import { NextResponse } from 'next/server'
import { SESSION_COOKIE, getSessionByToken } from '@/lib/auth'
import { db } from '@/lib/db'
import { FALLBACK_REWARD_QR_URL } from '@/config/reward'

export const dynamic = 'force-dynamic'

function fallbackImageResponse(method: 'GET' | 'HEAD') {
  if (method === 'HEAD') {
    return new NextResponse(null, {
      headers: {
        'Content-Type': 'image/jpeg',
        'Cache-Control': 'public, s-maxage=86400, stale-while-revalidate=604800',
        'X-Reward-Source': 'fallback'
      }
    })
  }

  const response = NextResponse.redirect(FALLBACK_REWARD_QR_URL, 307)
  response.headers.set('Cache-Control', 'public, s-maxage=86400, stale-while-revalidate=604800')
  response.headers.set('X-Reward-Source', 'fallback')
  return response
}

async function buildImageResponse(method: 'GET' | 'HEAD') {
  let row: any = null
  try {
    row = await (db as any).siteSettings.findUnique({ where: { key: 'reward_qr_data' } })
  } catch (e) {
    console.error('Reward QR DB lookup failed, using fallback:', e)
  }

  if (row && row.value) {
    // Value format: "data:image/png;base64,..."
    const parts = row.value.split(',')
    if (parts.length !== 2) {
      return fallbackImageResponse(method)
    }

    const header = parts[0]
    const base64Data = parts[1]
    const match = header.match(/:(.*?);/)
    const contentType = match ? match[1] : 'image/png'
    const headers = {
      'Content-Type': contentType,
      'Cache-Control': 'public, s-maxage=86400, stale-while-revalidate=604800',
      'X-Reward-Source': 'db'
    }

    if (method === 'HEAD') {
      return new NextResponse(null, { headers })
    }

    const buf = Buffer.from(base64Data, 'base64')
    return new NextResponse(buf, { headers })
  }

  return fallbackImageResponse(method)
}

export async function GET() {
  return buildImageResponse('GET')
}

export async function HEAD() {
  return buildImageResponse('HEAD')
}

export async function POST(request: Request) {
  console.log('POST /api/reward-qr started')
  try {
    const cookie = request.headers.get('cookie') || ''
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
    
    // Check file size (limit to 4MB)
    if (file.size > 4 * 1024 * 1024) {
      return NextResponse.json({ error: 'too_large', message: 'File size exceeds 4MB limit' }, { status: 400 })
    }

    const arrayBuffer = await file.arrayBuffer()
    const buf = Buffer.from(arrayBuffer)
    const base64 = buf.toString('base64')
    const mimeType = file.type || 'image/png'
    const dataUrl = `data:${mimeType};base64,${base64}`
    
    console.log('Saving to DB (length):', dataUrl.length)
    
    // Save to DB
    await (db as any).siteSettings.upsert({
      where: { key: 'reward_qr_data' },
      update: { value: dataUrl },
      create: { key: 'reward_qr_data', value: dataUrl }
    })
    
    const url = `/api/reward-qr?ts=${Date.now()}`
    console.log('Upload success, url:', url)
    return NextResponse.json({ ok: true, url })
  } catch (e: any) {
    console.error('Upload error full stack:', e)
    return NextResponse.json({ error: 'failed', message: e.message, stack: e.stack }, { status: 500 })
  }
}
