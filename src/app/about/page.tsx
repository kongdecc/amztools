'use client'

import Head from 'next/head'
import Link from 'next/link'
import React, { useEffect, useState } from 'react'
import { LayoutDashboard } from 'lucide-react'
import { SettingsProvider, useSettings } from '@/components/SettingsProvider'
import { marked } from 'marked'

function AboutContent() {
  const { settings } = useSettings()
  const title = String(settings.aboutTitle || '关于我们')
  const content = String(settings.aboutContent || '欢迎使用本工具箱。这里将介绍项目背景、目标与联系方式。')
  const [html, setHtml] = useState('')
  const [navItems, setNavItems] = useState<Array<any>>([])
  const [origin, setOrigin] = useState('')
  useEffect(() => {
    (async () => {
      try {
        const { default: DOMPurify } = await import('isomorphic-dompurify')
        const out = DOMPurify.sanitize(String(marked.parse(content)))
        setHtml(out)
      } catch {
        setHtml('')
      }
    })()
  }, [content])
  useEffect(() => {
    (async () => {
      try {
        const r = await fetch('/api/navigation', { cache: 'no-store' })
        const d = await r.json()
        setNavItems(Array.isArray(d) ? d : [])
      } catch {}
    })()
  }, [])
  useEffect(() => { try { setOrigin(window.location.origin) } catch {} }, [])
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <Head>
        <title>{title}</title>
        <meta name="description" content={String(settings.seoDescription || settings.siteDescription || '')} />
        <meta name="keywords" content={String(settings.siteKeywords || '')} />
        <link rel="canonical" href={`${origin}/about`} />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "BreadcrumbList",
          itemListElement: [
            { "@type": "ListItem", position: 1, name: "首页", item: `${origin}/` },
            { "@type": "ListItem", position: 2, name: "关于", item: `${origin}/about` }
          ]
        }) }} />
      </Head>
      <header className="h-14 bg-[#5b5bd6] text-white flex items-center px-10 shadow-md z-20">
        <div className={`flex items-center gap-2 font-bold text-lg`}>
          {String(settings.logoUrl || '').trim() ? (
            <img src={settings.logoUrl} alt={settings.siteName} className="h-6 w-6 rounded object-contain" />
          ) : (
            <div className="bg-white/20 p-1 rounded"><LayoutDashboard className="h-5 w-5" /></div>
          )}
          <span>{settings.siteName}</span>
        </div>
        <nav className="ml-auto mr-6 flex items-center gap-6">
          <Link href="/" className="text-sm text-white/90 hover:text-white">首页</Link>
          {navItems
            .slice()
            .sort((a: any, b: any) => Number(a.order || 0) - Number(b.order || 0))
            .map((item: any) => (
              item.isExternal ? (
                <a key={item.id} href={item.href || '#'} target="_blank" rel="noopener noreferrer" className="text-sm text-white/90 hover:text-white">
                  {item.label}
                </a>
              ) : (
                <Link key={item.id} href={item.href || '/'} className="text-sm text-white/90 hover:text-white">
                  {item.label}
                </Link>
              )
            ))}
        </nav>
      </header>
      <div className="flex-1">
      <div className="max-w-6xl mx-auto px-8 py-10">
        <nav aria-label="breadcrumb" className="text-xs text-gray-500 mb-4 flex items-center gap-2">
          <Link href="/" className="hover:text-blue-600">首页</Link>
          <span>/</span>
          <span className="text-gray-700">关于</span>
        </nav>
        <h1 className="text-2xl font-bold text-gray-800 mb-4">{title}</h1>
        <div className="text-sm text-gray-700" dangerouslySetInnerHTML={{ __html: html }} />
        
      </div>
      </div>
      <div className="px-6 pb-10 text-center">
        <footer className="text-xs text-gray-400">
          {settings.copyrightText || '© 2025 运营魔方 ToolBox. All rights reserved.'}
          <span className="mx-2">|</span>
          <a href="/privacy" className="hover:text-blue-600">隐私说明</a>
        </footer>
        {(() => {
          try {
            const arr = JSON.parse(String(settings.friendLinks || '[]'))
            const list = Array.isArray(arr) ? arr : []
            if (list.length === 0) return null
            return (
              <div className="mt-2 text-xs text-gray-500">
                {String(settings.showFriendLinksLabel || 'false') === 'true' && <span>友情链接： </span>}
                {list
                  .slice()
                  .sort((a: any, b: any) => (Number(a.order || 0) - Number(b.order || 0)))
                  .map((l: any, i: number) => (
                    <span key={i}>
                      <a href={l.href || '#'} target={l.isExternal ? '_blank' : '_self'} rel={l.isExternal ? 'noopener noreferrer' : undefined} className="hover:text-blue-600">
                        {l.label || '友链'}
                      </a>
                      {i < list.length - 1 ? ', ' : ''}
                    </span>
                  ))}
              </div>
            )
          } catch { return null }
        })()}
      </div>
    </div>
  )
}

export default function Page() {
  return (
    <SettingsProvider>
      <AboutContent />
    </SettingsProvider>
  )
}