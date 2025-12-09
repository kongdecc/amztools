import { NextResponse } from 'next/server'
import { SESSION_COOKIE, getSessionByToken } from '@/lib/auth'

export async function GET(request: Request) {
  try {
    const token = request.headers.get('cookie')?.match(new RegExp(`${SESSION_COOKIE}=([^;]+)`))?.[1]
    if (!token) {
      const res = NextResponse.json({ error: 'unauthorized' }, { status: 401 })
      res.cookies.set(SESSION_COOKIE, '', { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/', expires: new Date(0) })
      return res
    }
    const session = await getSessionByToken(token)
    if (!session) {
      const res = NextResponse.json({ error: 'unauthorized' }, { status: 401 })
      res.cookies.set(SESSION_COOKIE, '', { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/', expires: new Date(0) })
      return res
    }
    return NextResponse.json({ user: { id: session.userId, username: session.user.username } })
  } catch {
    return NextResponse.json({ error: 'failed' }, { status: 500 })
  }
}