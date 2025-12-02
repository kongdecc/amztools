import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { SESSION_COOKIE, getSessionByToken } from '@/lib/auth'
import fs from 'fs'
import path from 'path'
export const dynamic = 'force-dynamic'

const defaults = {
  siteName: '运营魔方 ToolBox',
  logoUrl: '',
  faviconUrl: '',
  siteDescription: '为跨境运营人员打造的免费在线工具箱',
  siteKeywords: '工具箱, 广告计算, 文本处理',
  analyticsHeadHtml: '',
  analyticsBodyHtml: '',
  showAnalytics: 'false',
  copyrightText: '© 2025 运营魔方 ToolBox. All rights reserved.',
  homeHeroTitle: '一站式图像与运营处理工具',
  homeHeroSubtitle: '轻松处理您的数据，提升工作效率',
  hideHomeHeroIfEmpty: 'false',
  friendLinks: '[]',
  privacyPolicy: '我们重视您的隐私。此页面说明我们收集哪些数据、如何使用以及您的权利。我们仅收集提供服务所需的基础信息，不出售个人数据，并提供访问、更正或删除数据的途径。',
  showFriendLinksLabel: 'false',
  aboutTitle: '关于我们',
  aboutContent: '欢迎使用本工具箱。这里将介绍项目背景、目标与联系方式。',
  seoDescription: '',
  sitemapEnabled: 'true',
  sitemapFrequency: 'daily',
  enableStructuredData: 'true',
  enableBreadcrumbs: 'true',
  robotsContent: 'User-agent: *\nAllow: /',
  robotsDisallowQuery: 'true',
  robotsDisallowAdmin: 'true',
  robotsDisallowPageParam: 'true',
  robotsDisallowUtmParams: 'true'
}

const globalForSettings = globalThis as unknown as { memSettings?: Record<string, string> }
const memSettings: Record<string, string> = globalForSettings.memSettings ?? {}
globalForSettings.memSettings = memSettings

const dataDir = path.join(process.cwd(), '.data')
const dataFile = path.join(dataDir, 'settings.json')
function readFileSettings(): Record<string, string> {
  try {
    if (!fs.existsSync(dataFile)) return {}
    const raw = fs.readFileSync(dataFile, 'utf-8')
    const obj = JSON.parse(raw)
    if (obj && typeof obj === 'object') return obj
    return {}
  } catch { return {} }
}
function writeFileSettings(obj: Record<string, string>) {
  try {
    if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true })
    const safe = JSON.stringify(obj, null, 2)
    fs.writeFileSync(dataFile, safe, 'utf-8')
  } catch {}
}

export async function GET() {
  try {
    const rows = await db.siteSettings.findMany()
    const dbObj: Record<string, string> = {}
    rows.forEach(r => { dbObj[r.key] = r.value })
    const fileObj = readFileSettings()
    const merged = { ...defaults, ...fileObj, ...memSettings, ...dbObj }
    return NextResponse.json(merged, { headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' } })
  } catch {
    const fileObj = readFileSettings()
    return NextResponse.json({ ...defaults, ...fileObj, ...memSettings }, { headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' } })
  }
}

export async function PUT(request: Request) {
  const cookie = request.headers.get('cookie') || ''
  const token = cookie.match(new RegExp(`${SESSION_COOKIE}=([^;]+)`))?.[1]
  if (!token || !(await getSessionByToken(token))) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }
  let body: Record<string, any> = {}
  try { body = await request.json() } catch { body = {} }
  try {
    const ops = Object.entries(body).map(([key, value]) => db.siteSettings.upsert({
      where: { key },
      update: { value: String(value) },
      create: { key, value: String(value) }
    }))
    await db.$transaction(ops)
    Object.entries(body || {}).forEach(([key, value]) => { memSettings[key] = String(value) })
    writeFileSettings({ ...readFileSettings(), ...memSettings })
    return NextResponse.json({ ok: true })
  } catch {
    Object.entries(body || {}).forEach(([key, value]) => { memSettings[key] = String(value) })
    writeFileSettings({ ...readFileSettings(), ...memSettings })
    return NextResponse.json({ ok: true, dev: true })
  }
}