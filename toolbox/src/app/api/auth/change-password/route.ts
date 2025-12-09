import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { SESSION_COOKIE, getSessionByToken, hashPassword, verifyPassword, ensureDefaultAdmin, getFileAdmin, setFileAdmin } from '@/lib/auth'

export async function POST(request: Request) {
  try {
    const cookie = request.headers.get('cookie') || ''
    const token = cookie.match(new RegExp(`${SESSION_COOKIE}=([^;]+)`))?.[1]
    if (!token) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

    const session = await getSessionByToken(token)
    if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

    const { currentPassword, newPassword } = await request.json()
    if (!currentPassword || !newPassword) return NextResponse.json({ error: '请输入当前密码与新密码' }, { status: 400 })
    if (String(newPassword).length < 6) return NextResponse.json({ error: '新密码长度至少6位' }, { status: 400 })

    let user: any = null
    try { user = await db.adminUser.findUnique({ where: { id: session.userId } }) } catch {}
    if (!user && session?.user?.username) {
      try { user = await db.adminUser.findUnique({ where: { username: session.user.username } }) } catch {}
    }
    if (!user) {
      try { await ensureDefaultAdmin(); user = await db.adminUser.findFirst() } catch {}
    }
    if (!user) {
      const fileAdmin = getFileAdmin()
      if (fileAdmin && (!session?.user?.username || session.user.username === fileAdmin.username)) {
        let ok = false
        try { ok = verifyPassword(currentPassword, fileAdmin.passwordHash, fileAdmin.passwordSalt) } catch { return NextResponse.json({ error: '数据库不可用或密码校验失败' }, { status: 500 }) }
        if (!ok) return NextResponse.json({ error: '当前密码不正确' }, { status: 401 })
        const { hash, salt } = hashPassword(newPassword)
        try { setFileAdmin({ username: fileAdmin.username, passwordHash: hash, passwordSalt: salt }) } catch { return NextResponse.json({ error: '文件存储不可用，修改失败' }, { status: 500 }) }
        const res = NextResponse.json({ success: true })
        res.cookies.set(SESSION_COOKIE, '', { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/', expires: new Date(0) })
        return res
      }
      return NextResponse.json({ error: '用户不存在' }, { status: 404 })
    }

    let ok = false
    try { ok = verifyPassword(currentPassword, user.passwordHash, user.passwordSalt) } catch { return NextResponse.json({ error: '数据库不可用或密码校验失败' }, { status: 500 }) }
    if (!ok) return NextResponse.json({ error: '当前密码不正确' }, { status: 401 })

    const { hash, salt } = hashPassword(newPassword)
    try { await db.adminUser.update({ where: { id: user.id }, data: { passwordHash: hash, passwordSalt: salt } }) } catch { return NextResponse.json({ error: '数据库不可用，修改失败' }, { status: 500 }) }

    try { await db.session.deleteMany({ where: { userId: user.id } }) } catch {}
    const res = NextResponse.json({ success: true })
    res.cookies.set(SESSION_COOKIE, '', { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/', expires: new Date(0) })
    return res
  } catch {
    return NextResponse.json({ error: '修改密码失败' }, { status: 500 })
  }
}