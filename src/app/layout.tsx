import type { ReactNode } from 'react'
import './globals.css'
import { db } from '@/lib/db'
import { Metadata } from 'next'
import fs from 'fs'
import path from 'path'

export async function generateMetadata(): Promise<Metadata> {
  let logoUrl = ''
  let siteName = '运营魔方 ToolBox'
  let googleVerification = ''
  let baiduVerification = ''

  try {
    const rows = await (db as any).siteSettings.findMany()
    const settings: any = {}
    for (const r of rows as any) settings[String((r as any).key)] = String((r as any).value ?? '')
    logoUrl = settings.logoUrl || ''
    siteName = settings.siteName || siteName
    googleVerification = settings.googleVerification || ''
    baiduVerification = settings.baiduVerification || ''

    // If no logoUrl in settings, check if local file exists
    if (!logoUrl) {
      try {
        const dataDir = path.join(process.cwd(), '.data')
        const exts = ['png','jpg','jpeg','webp','svg']
        for (const ext of exts) {
          if (fs.existsSync(path.join(dataDir, `logo.${ext}`))) {
            logoUrl = '/api/logo'
            break
          }
        }
      } catch {}
    }
  } catch {}

  return {
    title: siteName,
    icons: logoUrl ? { icon: logoUrl } : undefined,
    verification: {
      google: googleVerification || undefined,
      other: baiduVerification ? { 'baidu-site-verification': baiduVerification } : undefined
    }
  }
}

export default async function RootLayout({ children }: { children: ReactNode }) {
  let analyticsHeadHtml = ''
  let analyticsBodyHtml = ''

  try {
    const rows = await (db as any).siteSettings.findMany()
    const settings: any = {}
    for (const r of rows as any) settings[String((r as any).key)] = String((r as any).value ?? '')
    analyticsHeadHtml = settings.analyticsHeadHtml || ''
    analyticsBodyHtml = settings.analyticsBodyHtml || ''
  } catch {}

  return (
    <html lang="zh-CN">
      <body suppressHydrationWarning={true}>
        {analyticsHeadHtml && <div dangerouslySetInnerHTML={{ __html: analyticsHeadHtml }} style={{ display: 'none' }} />}
        {children}
        {analyticsBodyHtml && <div dangerouslySetInnerHTML={{ __html: analyticsBodyHtml }} />}
      </body>
    </html>
  )
}