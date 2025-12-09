import { NextResponse } from 'next/server'
import { SESSION_COOKIE, destroySession } from '@/lib/auth'

export async function POST(request: Request) {
  try {
    const cookie = request.headers.get('cookie') || ''
    const token = cookie.match(new RegExp(`${SESSION_COOKIE}=([^;]+)`))?.[1]
    if (token) {
      try { await destroySession(token) } catch {}
    }
    const res = NextResponse.json({ ok: true })
    res.cookies.set(SESSION_COOKIE, '', { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/', expires: new Date(0) })
    return res
  } catch {
    const res = NextResponse.json({ ok: true })
    res.cookies.set(SESSION_COOKIE, '', { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/', expires: new Date(0) })
    return res
  }
}