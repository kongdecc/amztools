import type { ReactNode } from 'react'
import './globals.css'
import { db } from '@/lib/db'
import { Metadata } from 'next'

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

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="zh-CN">
      <body suppressHydrationWarning={true}>{children}</body>
    </html>
  )
}