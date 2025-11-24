'use client'

import React, { useEffect, useState } from 'react'
import Head from 'next/head'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { SettingsProvider, useSettings } from '@/components/SettingsProvider'
import { LayoutDashboard } from 'lucide-react'

import { marked } from 'marked'

function BlogDetailContent() {
  const params = useParams()
  const slug = String(params?.slug || '')
  const { settings } = useSettings()
  const [title, setTitle] = useState('')
  const [html, setHtml] = useState('')
  const [item, setItem] = useState<any>(null)
  const [desc, setDesc] = useState('')
  const [navItems, setNavItems] = useState<Array<any>>([])
  const [origin, setOrigin] = useState('')
  useEffect(() => {
    (async () => {
      try {
        const r = await fetch(`/api/blog?slug=${encodeURIComponent(slug)}`, { cache: 'no-store' })
        if (!r.ok) return
        const item = await r.json()
        setTitle(String(item.title || ''))
        const { default: DOMPurify } = await import('isomorphic-dompurify')
        const out = DOMPurify.sanitize(String(marked.parse(String(item.content || ''))))
        setHtml(out)
        setItem(item)
        try {
          const text = String(out || '')
            .replace(/<script[\s\S]*?<\/script>/gi, '')
            .replace(/<style[\s\S]*?<\/style>/gi, '')
            .replace(/<[^>]+>/g, '')
            .replace(/\s+/g, ' ')
            .trim()
          setDesc(text.slice(0, 160))
        } catch {}
        try {
          const key = `blog_viewed_${slug}`
          const last = Number(sessionStorage.getItem(key) || 0)
          const nowTs = Date.now()
          if (!last || nowTs - last > 5000) {
            sessionStorage.setItem(key, String(nowTs))
            const vr = await fetch('/api/blog/views', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ slug }), cache: 'no-store' })
            let vd: any = {}
            try { vd = await vr.json() } catch {}
            if (vr.ok && vd && typeof vd.views !== 'undefined') {
              setItem((prev: any) => prev ? { ...prev, views: Number(vd.views || 0) } : prev)
            } else {
              setItem((prev: any) => prev ? { ...prev, views: Number(prev.views || 0) + 1 } : prev)
            }
          }
        } catch {}
      } catch {}
    })()
  }, [slug])
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
        <title>{title || '文章'}</title>
        <link rel="canonical" href={`${origin}/blog/${slug}`} />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "BreadcrumbList",
          itemListElement: [
            { "@type": "ListItem", position: 1, name: "首页", item: `${origin}/` },
            { "@type": "ListItem", position: 2, name: "博客", item: `${origin}/blog` },
            { "@type": "ListItem", position: 3, name: title || slug, item: `${origin}/blog/${slug}` }
          ]
        }) }} />
        <meta name="description" content={desc || String(settings.seoDescription || settings.siteDescription || '')} />
        <meta name="keywords" content={String(settings.siteKeywords || '')} />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "Article",
          headline: title || slug,
          datePublished: item?.createdAt || undefined,
          dateModified: item?.updatedAt || undefined,
          image: item?.coverUrl ? [item.coverUrl] : undefined,
          url: `${origin}/blog/${slug}`,
          description: desc || undefined,
          mainEntityOfPage: `${origin}/blog/${slug}`,
          interactionStatistic: item?.views ? {
            "@type": "InteractionCounter",
            interactionType: { "@type": "ViewAction" },
            userInteractionCount: Number(item.views || 0)
          } : undefined
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
          <Link href="/blog" className="hover:text-blue-600">博客</Link>
          <span>/</span>
          <span className="text-gray-700">{title || slug}</span>
        </nav>
        <h1 className="text-2xl font-bold text-gray-800 mb-4">{title}</h1>
        <div className="text-xs text-gray-500 mb-6">{item?.createdAt ? new Date(item.createdAt).toLocaleString() : ''} · 浏览 {Number(item?.views || 0)}</div>
        <div className="prose prose-indigo max-w-none text-sm text-gray-700 content" dangerouslySetInnerHTML={{ __html: html }} />
        <style>{`
          .content a { color: #2563eb; text-decoration: underline; }
          .content a:hover { color: #1e40af; }
        `}</style>
        <div className="mt-6 text-center">
          <Link href="/blog" className="text-sm text-blue-600 hover:text-blue-800">返回列表</Link>
        </div>
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
      <BlogDetailContent />
    </SettingsProvider>
  )
}