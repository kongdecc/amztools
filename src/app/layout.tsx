import type { ReactNode } from 'react'
import './globals.css'
import { db } from '@/lib/db'

export default async function RootLayout({ children }: { children: ReactNode }) {
  let logoUrl = ''
  let siteName = ''
  let googleVerification = ''
  let baiduVerification = ''

  try {
    const rows = await (db as any).siteSettings.findMany()
    const settings: any = {}
    for (const r of rows as any) settings[String((r as any).key)] = String((r as any).value ?? '')
    logoUrl = settings.logoUrl || ''
    siteName = settings.siteName || ''
    googleVerification = settings.googleVerification || ''
    baiduVerification = settings.baiduVerification || ''
  } catch {}

  return (
    <html lang="zh-CN">
      <head>
        {logoUrl && <link rel="icon" href={logoUrl} />}
        {googleVerification && <meta name="google-site-verification" content={googleVerification} />}
        {baiduVerification && <meta name="baidu-site-verification" content={baiduVerification} />}
      </head>
      <body suppressHydrationWarning={true}>{children}</body>
    </html>
  )
}