import type { ReactNode } from 'react'
import './globals.css'
import { db } from '@/lib/db'
import { Metadata } from 'next'
import fs from 'fs'
import path from 'path'

import { DEFAULT_SITE_SETTINGS } from '@/lib/constants'

export async function generateMetadata(): Promise<Metadata> {
  let logoUrl = ''
  let faviconUrl = ''
  let siteName = DEFAULT_SITE_SETTINGS.siteName
  let siteDescription = DEFAULT_SITE_SETTINGS.siteDescription
  let siteKeywords = ''
  let googleVerification = ''
  let baiduVerification = ''

  try {
    const rows = await (db as any).siteSettings.findMany().catch(() => [])
    const settings: any = {}
    for (const r of rows as any) settings[String((r as any).key)] = String((r as any).value ?? '')
    logoUrl = settings.logoUrl || ''
    faviconUrl = settings.faviconUrl || ''
    siteName = settings.siteName || siteName
    siteDescription = settings.seoDescription || settings.siteDescription || siteDescription
    siteKeywords = settings.siteKeywords || ''
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
    
    if (!faviconUrl) faviconUrl = logoUrl
  } catch {}

  let metadataBase: URL | undefined = undefined
  const rawBase = String(process.env.NEXT_PUBLIC_SITE_URL || '').trim()
  if (rawBase) {
    try {
      metadataBase = new URL(rawBase.endsWith('/') ? rawBase : `${rawBase}/`)
    } catch {}
  }

  const ogImage = (() => {
    const u = String(logoUrl || '').trim()
    if (!u) return undefined
    if (/^https?:\/\//i.test(u)) return u
    if (metadataBase && u.startsWith('/')) return new URL(u.slice(1), metadataBase).toString()
    return undefined
  })()

  return {
    metadataBase,
    title: siteName,
    description: siteDescription || undefined,
    keywords: siteKeywords || undefined,
    icons: faviconUrl ? { icon: faviconUrl } : undefined,
    openGraph: {
      type: 'website',
      title: siteName,
      description: siteDescription || undefined,
      url: '/',
      images: ogImage ? [{ url: ogImage }] : undefined
    },
    robots: {
      index: true,
      follow: true
    },
    verification: {
      google: googleVerification || undefined,
      other: baiduVerification ? { 'baidu-site-verification': baiduVerification } : undefined
    }
  }
}

export default async function RootLayout({ children }: { children: ReactNode }) {
  let analyticsHeadHtml = ''
  let analyticsBodyHtml = ''
  let enableStructuredData = false
  let siteName = DEFAULT_SITE_SETTINGS.siteName
  let siteDescription = DEFAULT_SITE_SETTINGS.siteDescription
  let logoUrl = ''
  let siteUrl = ''

  try {
    const rows = await (db as any).siteSettings.findMany().catch(() => [])
    const settings: any = {}
    for (const r of rows as any) settings[String((r as any).key)] = String((r as any).value ?? '')
    analyticsHeadHtml = settings.analyticsHeadHtml || ''
    analyticsBodyHtml = settings.analyticsBodyHtml || ''
    enableStructuredData = String(settings.enableStructuredData || 'true') === 'true'
    siteName = settings.siteName || siteName
    siteDescription = settings.siteDescription || siteDescription
    logoUrl = settings.logoUrl || ''
  } catch {}

  try {
    const raw = String(process.env.NEXT_PUBLIC_SITE_URL || '').trim()
    if (raw) siteUrl = String(new URL(raw.endsWith('/') ? raw : `${raw}/`)).replace(/\/$/, '')
  } catch {}

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "name": siteName,
    "description": siteDescription,
    "url": siteUrl || undefined,
    "logo": logoUrl
  }

  return (
    <html lang="zh-CN">
      <body suppressHydrationWarning={true}>
        {enableStructuredData && (
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
          />
        )}
        {analyticsHeadHtml && <div dangerouslySetInnerHTML={{ __html: analyticsHeadHtml }} style={{ display: 'none' }} />}
        {children}
        {analyticsBodyHtml && <div dangerouslySetInnerHTML={{ __html: analyticsBodyHtml }} />}
      </body>
    </html>
  )
}
