import { db } from '@/lib/db'
import crypto from 'crypto'
import fs from 'fs'
import path from 'path'

export const SESSION_COOKIE = 'admin_session'
const globalForAuth = globalThis as unknown as { memSessions?: Map<string, { userId: string, username: string, expiresAt: Date }> }
const memSessions: Map<string, { userId: string, username: string, expiresAt: Date }> = globalForAuth.memSessions ?? new Map()
globalForAuth.memSessions = memSessions

const dataDir = path.join(process.cwd(), '.data')
const adminFile = path.join(dataDir, 'admin.json')

function readFileAdmin(): { username: string; passwordHash: string; passwordSalt: string } | null {
  try {
    const raw = fs.readFileSync(adminFile, 'utf-8')
    const obj = JSON.parse(raw)
    if (obj && typeof obj.username === 'string' && typeof obj.passwordHash === 'string' && typeof obj.passwordSalt === 'string') return obj
  } catch {}
  return null
}

function writeFileAdmin(admin: { username: string; passwordHash: string; passwordSalt: string }) {
  try {
    if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true })
    fs.writeFileSync(adminFile, JSON.stringify(admin))
  } catch {}
}

function hash(password: string, salt: string) {
  return crypto.scryptSync(password, salt, 64).toString('hex')
}

export function hashPassword(password: string) {
  const salt = crypto.randomBytes(16).toString('hex')
  const h = hash(password, salt)
  return { hash: h, salt }
}

export function verifyPassword(password: string, passwordHash: string, passwordSalt: string) {
  const h = hash(password, passwordSalt)
  return crypto.timingSafeEqual(Buffer.from(h, 'hex'), Buffer.from(passwordHash, 'hex'))
}

export async function ensureDefaultAdmin() {
  try {
    const existing = await db.adminUser.findFirst()
    if (!existing) {
      const { hash, salt } = hashPassword('dage168')
      await db.adminUser.create({ data: { username: 'dage666', passwordHash: hash, passwordSalt: salt } })
    }
  } catch {}
  const fileAdmin = readFileAdmin()
  if (!fileAdmin) {
    const { hash, salt } = hashPassword('dage168')
    writeFileAdmin({ username: 'dage666', passwordHash: hash, passwordSalt: salt })
  }
}

export async function authenticate(username: string, password: string) {
  try {
    const user = await db.adminUser.findUnique({ where: { username } })
    if (user) {
      const ok = verifyPassword(password, user.passwordHash, user.passwordSalt)
      return ok ? user : null
    }
  } catch {}
  const fileAdmin = readFileAdmin()
  if (fileAdmin && username === fileAdmin.username) {
    const ok = verifyPassword(password, fileAdmin.passwordHash, fileAdmin.passwordSalt)
    if (ok) return { id: 'file-user', username: fileAdmin.username, passwordHash: fileAdmin.passwordHash, passwordSalt: fileAdmin.passwordSalt } as any
    return null
  }
  const allowDev = process.env.ALLOW_DEV_LOGIN === 'true' || process.env.NODE_ENV !== 'production'
  if (allowDev && username === 'dage666' && password === 'dage168') {
    return { id: 'dev-user', username: 'dage666', passwordHash: '', passwordSalt: '' } as any
  }
  return null
}

export async function createSession(userId: string, username: string) {
  const token = crypto.randomUUID()
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
  try { await db.session.create({ data: { token, userId, expiresAt } }) } catch {}
  memSessions.set(token, { userId, username, expiresAt })
  return { token, expiresAt }
}

export async function getSessionByToken(token: string) {
  try {
    const session = await db.session.findUnique({ where: { token }, include: { user: true } })
    if (session) {
      if (session.expiresAt.getTime() < Date.now()) {
        try { await db.session.delete({ where: { token } }) } catch {}
        return null
      }
      return session
    }
  } catch {}
  const mem = memSessions.get(token)
  if (!mem) return null
  if (mem.expiresAt.getTime() < Date.now()) { memSessions.delete(token); return null }
  return { id: token, token, userId: mem.userId, expiresAt: mem.expiresAt, user: { id: mem.userId, username: mem.username } } as any
}

export async function destroySession(token: string) {
  try { await db.session.delete({ where: { token } }) } catch {}
  memSessions.delete(token)
}

export function buildCookieOptions(expiresAt: Date) {
  return {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    expires: expiresAt
  }
}

export function getFileAdmin(): { username: string; passwordHash: string; passwordSalt: string } | null {
  return readFileAdmin()
}

export function setFileAdmin(admin: { username: string; passwordHash: string; passwordSalt: string }) {
  writeFileAdmin(admin)
}