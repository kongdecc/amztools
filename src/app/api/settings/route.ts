import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { SESSION_COOKIE, getSessionByToken } from '@/lib/auth'
import fs from 'fs'
import path from 'path'
import { DEFAULT_SITE_SETTINGS } from '@/lib/constants'
export const dynamic = 'force-dynamic'

const defaults = {
  siteName: DEFAULT_SITE_SETTINGS.siteName,
  logoUrl: '',
  faviconUrl: '',
  siteDescription: DEFAULT_SITE_SETTINGS.siteDescription,
  siteKeywords: '工具箱, 广告计算, 文本处理',
  analyticsHeadHtml: '',
  analyticsBodyHtml: '',
  showAnalytics: 'false',
  copyrightText: DEFAULT_SITE_SETTINGS.copyrightText,
  homeHeroTitle: '一站式图像与运营处理工具',
  homeHeroSubtitle: '轻松处理您的数据，提升工作效率',
  hideHomeHeroIfEmpty: 'false',
  friendLinks: '[]',
  privacyPolicy: DEFAULT_SITE_SETTINGS.privacyPolicy,
  showFriendLinksLabel: 'false',
  aboutTitle: '关于我们',
  aboutContent: DEFAULT_SITE_SETTINGS.aboutContent,
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
    
    // Fix: Ensure persistent site name and copyright if they match the old default
    if (merged.siteName === '运营魔方 ToolBox') {
      merged.siteName = DEFAULT_SITE_SETTINGS.siteName
    }
    if (merged.copyrightText && merged.copyrightText.includes('运营魔方 ToolBox')) {
      merged.copyrightText = DEFAULT_SITE_SETTINGS.copyrightText
    }

    return NextResponse.json(merged, { headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' } })
  } catch {
    const fileObj = readFileSettings()
    const merged = { ...defaults, ...fileObj, ...memSettings }
    
    // Fix: Ensure persistent site name and copyright if they match the old default
    if (merged.siteName === '运营魔方 ToolBox') {
      merged.siteName = DEFAULT_SITE_SETTINGS.siteName
    }
    if (merged.copyrightText && merged.copyrightText.includes('运营魔方 ToolBox')) {
      merged.copyrightText = DEFAULT_SITE_SETTINGS.copyrightText
    }

    return NextResponse.json(merged, { headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' } })
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
