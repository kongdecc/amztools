'use client'

import React, { useEffect, useState } from 'react'
import Link from 'next/link'
import Head from 'next/head'
import { useSettings } from '@/components/SettingsProvider'
import { LayoutDashboard, ChevronDown } from 'lucide-react'

type Post = { id: string; title: string; slug: string; content: string; status: string; order?: number; createdAt?: string; coverUrl?: string }

export default function BlogListClient({ initialList, initialTotal, initialNavItems, pageSize }: { initialList: Post[]; initialTotal: number; initialNavItems: any[]; pageSize: number }) {
  const { settings } = useSettings()
  const [list, setList] = useState<Post[]>(initialList || [])
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState<number>(initialTotal || 0)
  const [navItems, setNavItems] = useState<Array<any>>(initialNavItems || [])
  const [origin, setOrigin] = useState('')
  const [modules, setModules] = useState<any[]>([])
  useEffect(() => {
    (async () => {
      try {
        const r = await fetch(`/api/blog?page=${page}&pageSize=${pageSize}`, { cache: 'no-store' })
        const d = await r.json()
        if (Array.isArray(d)) {
          setList(d)
          setTotal(d.length)
        } else {
          setList(Array.isArray(d?.items) ? d.items : [])
          setTotal(Number(d?.total || 0))
        }
      } catch { setList([]); setTotal(0) }
    })()
  }, [page])
  useEffect(() => { try { setOrigin(window.location.origin) } catch {} }, [])
  useEffect(() => {
    (async () => { try { const r = await fetch('/api/modules', { cache: 'no-store' }); const d = await r.json(); const arr = Array.isArray(d) ? d : []; setModules(arr.filter((m:any)=>m.status !== '下架')) } catch {} })()
  }, [])
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <Head>
        <title>{settings.siteName} - 博客</title>
        <meta name="description" content={String(settings.seoDescription || settings.siteDescription || '')} />
        <meta name="keywords" content={String(settings.siteKeywords || '')} />
        <link rel="canonical" href={`${origin}/blog`} />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "WebSite",
          name: settings.siteName,
          url: origin || undefined
        }) }} />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "Organization",
          name: settings.siteName,
          url: origin || undefined,
          logo: settings.logoUrl || undefined
        }) }} />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "CollectionPage",
          name: `${settings.siteName} - 博客`,
          url: `${origin}/blog`,
          hasPart: (Array.isArray(list) ? list : []).map((item:any) => ({
            "@type": "Article",
            headline: item.title,
            url: `${origin}/blog/${item.slug}`,
            thumbnailUrl: item.coverUrl || undefined
          }))
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
                    <button onClick={()=>{ try { (window as any).location.href = '/functionality' } catch {} }} className="text-sm text-white/90 hover:text-white flex items-center gap-1">
                      {item.label || '功能分类'}
                      <ChevronDown className="h-4 w-4 transition-transform group-hover:rotate-180" />
                    </button>
                    <div className="absolute top-full right-0 mt-2 w-64 bg-white rounded-lg shadow-lg overflow-hidden z-50 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200">
                      <div className="p-2 space-y-1">
                        {modules.map((m:any)=>(
                          <button key={m.key} onClick={() => { try { (window as any).location.href = `/?tab=${m.key}&full=1` } catch {} }} className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-blue-50 hover:text-blue-600 rounded-lg transition-colors">{m.title}</button>
                        ))}
                      </div>
                    </div>
                  </div>
                )
              }
              return item.isExternal ? (
                <a key={item.id} href={item.href || '#'} target="_blank" rel="noopener noreferrer" className="text-sm text-white/90 hover:text-white">{item.label}</a>
              ) : (
                <Link key={item.id} href={item.href || '/'} className="text-sm text-white/90 hover:text-white">{item.label}</Link>
              )
            })}
        </nav>
      </header>
      <div className="flex-1">
      <div className="max-w-6xl mx-auto px-8 py-10">
        <Head>
          <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "BreadcrumbList",
            itemListElement: [
              { "@type": "ListItem", position: 1, name: "首页", item: `${origin}/` },
              { "@type": "ListItem", position: 2, name: "博客", item: `${origin}/blog` }
            ]
          }) }} />
        </Head>
        <nav aria-label="breadcrumb" className="text-xs text-gray-500 mb-4 flex items-center gap-2">
          <Link href="/" className="hover:text-blue-600">首页</Link>
          <span>/</span>
          <span className="text-gray-700">博客</span>
        </nav>
        <h1 className="text-2xl font-bold text-gray-800 mb-4">博客</h1>
        <div className="space-y-6">
          {list.map(item => (
            <article key={item.id} className="border-b border-gray-100 pb-6">
              <div className="flex items-start gap-4">
                {(item.coverUrl || '').trim() ? (
                  <Link href={`/blog/${item.slug}`} className="shrink-0">
                    <img src={item.coverUrl} alt={item.title} className="w-40 h-24 object-cover rounded border" />
                  </Link>
                ) : null}
                <div className="flex-1">
                  <h2 className="text-xl font-bold text-gray-800">
                    <Link href={`/blog/${item.slug}`} className="hover:text-blue-600">{item.title}</Link>
                    {Number(item.order) === 0 && (
                      <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded border border-amber-200 bg-amber-50 text-amber-700 text-xs">置顶</span>
                    )}
                  </h2>
                  <p className="text-xs text-gray-400 mt-1">{new Date(item.createdAt || Date.now()).toLocaleString()}</p>
                  <p className="text-sm text-gray-600 mt-2">{String(item.content || '').replace(/<[^>]+>/g,'').slice(0,120)}{String(item.content || '').length>120?'...':''}</p>
                  <div className="mt-3">
                    <Link href={`/blog/${item.slug}`} className="text-sm text-blue-600 hover:text-blue-800">阅读全文</Link>
                  </div>
                </div>
              </div>
            </article>
          ))}
          {list.length === 0 && <p className="text-sm text-gray-500">暂无文章。</p>}
        </div>
        <div className="mt-6">
          {(() => {
            const totalPages = Math.max(1, Math.ceil(total / pageSize))
            const startIndex = (page - 1) * pageSize + 1
            const endIndex = Math.min(total, page * pageSize)
            const makeRange = () => {
              const pages: number[] = []
              if (totalPages <= 7) {
                for (let i = 1; i <= totalPages; i++) pages.push(i)
              } else {
                pages.push(1)
                const left = Math.max(2, page - 2)
                const right = Math.min(totalPages - 1, page + 2)
                if (left > 2) pages.push(-1)
                for (let i = left; i <= right; i++) pages.push(i)
                if (right < totalPages - 1) pages.push(-1)
                pages.push(totalPages)
              }
              return pages
            }
            const range = makeRange()
            return (
              <div className="bg-white border border-gray-200 rounded-xl px-4 py-3 flex items-center gap-3">
                <span className="text-sm text-gray-600">第 {startIndex}-{endIndex} 条，共 {total} 篇文章</span>
                <button onClick={()=>setPage(p=>Math.max(1,p-1))} disabled={page<=1} className="px-2 py-1 rounded border text-sm disabled:opacity-50">〈</button>
                {range.map((n, idx) => n === -1 ? (
                  <span key={`dot-${idx}`} className="px-2 text-gray-400">···</span>
                ) : (
                  <button key={n} onClick={()=>setPage(n)} className={`px-3 py-1 rounded border text-sm ${n===page?'border-blue-500 text-blue-600':'border-gray-200 text-gray-700 hover:border-gray-300'}`}>{n}</button>
                ))}
                <button onClick={()=>setPage(p=>Math.min(totalPages,p+1))} disabled={page>=totalPages} className="px-2 py-1 rounded border text-sm disabled:opacity-50">〉</button>
                <span className="ml-auto text-sm text-gray-600">跳至</span>
                <input type="number" min={1} max={totalPages} defaultValue={page} onKeyDown={(e)=>{ if (e.key==='Enter') { const v = Number((e.target as HTMLInputElement).value||1); setPage(Math.min(totalPages, Math.max(1, v))) } }} className="w-16 border rounded px-2 py-1 text-sm" />
                <button onClick={(e)=>{ const input = (e.currentTarget.previousSibling as HTMLInputElement); const v = Number(input.value||1); setPage(Math.min(totalPages, Math.max(1, v))) }} className="px-3 py-1 rounded border text-sm">跳转</button>
              </div>
            )
          })()}
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
