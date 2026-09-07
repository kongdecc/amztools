import type { ReactNode } from 'react'
import { Suspense } from 'react'
import type { Metadata } from 'next'
import './globals.css'
import GlobalPromoPopup from '@/components/GlobalPromoPopup'
import GoogleAnalytics from '@/components/GoogleAnalytics'
import { PUBLIC_SETTINGS, SITE_URL, jsonLd } from '@/lib/published-content'

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: PUBLIC_SETTINGS.siteName,
  description: PUBLIC_SETTINGS.seoDescription,
  icons: { icon: '/site-icon-v2.svg' },
  robots: { index: true, follow: true },
  verification: {
    google: PUBLIC_SETTINGS.googleVerification || undefined,
    other: PUBLIC_SETTINGS.baiduVerification ? { 'baidu-site-verification': PUBLIC_SETTINGS.baiduVerification } : undefined
  }
}
export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="zh-CN">
      <head>
        <script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-6790643369569237" crossOrigin="anonymous" />
      </head>
      <body suppressHydrationWarning>
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd({ '@context': 'https://schema.org', '@type': 'WebSite', name: PUBLIC_SETTINGS.siteName, alternateName: ['跨境工具魔方', 'AmzToolBox'], url: SITE_URL }) }} />
        <Suspense fallback={null}><GoogleAnalytics /></Suspense>
        <script dangerouslySetInnerHTML={{ __html: 'var _hmt=window._hmt||[];(function(){var h=document.createElement("script");h.src="https://hm.baidu.com/hm.js?f41283b760f768032fa2b7990826c3c3";document.head.appendChild(h)})();' }} />
        <GlobalPromoPopup />
        {children}
      </body>
    </html>
  )
}
