"use client"

import Head from 'next/head'
import Link from 'next/link'
import React, { useEffect, useState } from 'react'
import { LayoutDashboard, ChevronDown } from 'lucide-react'
import { useSettings } from '@/components/SettingsProvider'
import { marked } from 'marked'

export default function AboutClient({ initialNavItems, initialHtml }: { initialNavItems: any[]; initialHtml?: string }) {
  const { settings } = useSettings()
  const title = String(settings.aboutTitle || '关于我们')
  const content = String(settings.aboutContent || '欢迎使用本工具箱。这里将介绍项目背景、目标与联系方式。')
  const [html, setHtml] = useState(initialHtml || '')
  const [navItems] = useState<Array<any>>(initialNavItems || [])
  const [modules, setModules] = useState<any[]>([])
  const [origin, setOrigin] = useState('')
  useEffect(() => {
    (async () => {
      try {
        const { default: DOMPurify } = await import('isomorphic-dompurify')
        const out = DOMPurify.sanitize(String(marked.parse(content)))
        setHtml(out)
      } catch { setHtml('') }
    })()
  }, [content])
  useEffect(() => { try { setOrigin(window.location.origin) } catch {} }, [])
  useEffect(() => {
    (async () => {
      try { const r = await fetch('/api/modules', { cache: 'no-store' }); const d = await r.json(); const arr = Array.isArray(d) ? d : []; setModules(arr.filter((m:any)=>m.status !== '下架')) } catch {}
    })()
  }, [])
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
            .map((item: any) => {
              const isFuncMenu = String(item.label || '').includes('功能分类') || String(item.id || '') === 'functionality'
              if (isFuncMenu) {
                return (
                  <div key={item.id || 'function-menu'} className="relative group">
                    <Link href="/functionality" className="text-sm text-white/90 hover:text-white flex items-center gap-1 cursor-pointer">
                      {item.label || '功能分类'}
                      <ChevronDown className="h-4 w-4 transition-transform group-hover:rotate-180" />
                    </Link>
                    <div className="absolute top-full right-0 mt-2 w-64 bg-white rounded-lg shadow-lg overflow-hidden z-50 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200">
                      <div className="p-2 space-y-1">
                        {modules.map((m: any) => (
                          <Link key={m.key} href={`/?tab=${m.key}`} className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-blue-50 hover:text-blue-600 rounded-lg transition-colors cursor-pointer">{m.title}</Link>
                        ))}
                      </div>
                    </div>
                  </div>
                )
              }
              return item.isExternal ? (
                <a key={item.id} href={item.href || '#'} target="_blank" rel="noopener noreferrer" className="text-sm text-white/90 hover:text-white">
                  {item.label}
                </a>
              ) : (
                <Link key={item.id} href={item.href || '/'} className="text-sm text-white/90 hover:text-white">
                  {item.label}
                </Link>
              )
            })}
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
          <div className="text-[15px] leading-7 text-gray-800 space-y-4" dangerouslySetInnerHTML={{ __html: html }} />
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
