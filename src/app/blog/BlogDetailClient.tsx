'use client'

import Link from 'next/link'
import React, { useEffect, useState } from 'react'
import { LayoutDashboard, ChevronDown, MoreHorizontal } from 'lucide-react'
import { useSettings } from '@/components/SettingsProvider'
import { marked } from 'marked'
import { DEFAULT_CATEGORIES, DEFAULT_TOOLS, DEFAULT_SITE_SETTINGS } from '@/lib/constants'

type Post = { id: string; title: string; slug: string; content: string; status: string; order?: number; views?: number; createdAt?: string; updatedAt?: string; coverUrl?: string }

export default function BlogDetailClient({ item, initialNavItems, initialHtml }: { item: Post | null; initialNavItems: any[]; initialHtml?: string }) {
  const { settings } = useSettings()
  const [navItems] = useState<Array<any>>(initialNavItems || [])
  const [html, setHtml] = useState(initialHtml || '')
  const [views, setViews] = useState<number>(Number(item?.views || 0))
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [categories, setCategories] = useState<any[]>([])
  const [modules, setModules] = useState<any[]>([])

  const title = String(item?.title || '')
  const slug = String(item?.slug || '')

  useEffect(() => {
    (async () => {
      try {
        const r = await fetch('/api/categories', { cache: 'no-store' })
        const d = await r.json()
        if (Array.isArray(d) && d.length > 0) setCategories(d.filter((c: any) => c.enabled !== false))
        else setCategories(DEFAULT_CATEGORIES)
      } catch {
        setCategories(DEFAULT_CATEGORIES)
      }
    })()
  }, [])

  useEffect(() => {
    (async () => {
      try { const r = await fetch('/api/modules', { cache: 'no-store' }); const d = await r.json(); const arr = Array.isArray(d) ? d : []; setModules(arr.filter((m:any)=>m.status !== '下架')) } catch { setModules(DEFAULT_TOOLS) }
    })()
  }, [])

  useEffect(() => {
    (async () => {
      try {
        const { default: DOMPurify } = await import('isomorphic-dompurify')
        const out = DOMPurify.sanitize(String(marked.parse(String(item?.content || ''))))
        setHtml(out)
        try {
          const text = String(out || '')
            .replace(/<script[\s\S]*?<\/script>/gi, '')
            .replace(/<style[\s\S]*?<\/style>/gi, '')
            .replace(/<[^>]+>/g, '')
            .replace(/\s+/g, ' ')
            .trim()
        } catch {}
      } catch { setHtml('') }
    })()
  }, [item?.content])

  useEffect(() => {
    (async () => {
      try {
        if (!slug) return
        const key = `blog_viewed_${slug}`
        const last = Number(sessionStorage.getItem(key) || 0)
        const nowTs = Date.now()
        if (!last || nowTs - last > 5000) {
          sessionStorage.setItem(key, String(nowTs))
          const r = await fetch('/api/blog/views', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ slug }), cache: 'no-store' })
          let d: any = {}
          try { d = await r.json() } catch {}
          if (r.ok && d && typeof d.views !== 'undefined') {
            setViews(Number(d.views || 0))
          } else {
            setViews(v => v + 1)
          }
        }
      } catch {}
    })()
  }, [slug])

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <header className="h-14 bg-[#5b5bd6] text-white flex items-center px-4 md:px-10 shadow-md z-20 justify-between md:justify-start">
        <div className={`flex items-center gap-2 font-bold text-lg min-w-0 flex-1`}>
          {String(settings.logoUrl || '').trim() ? (
            <img src={settings.logoUrl} alt={settings.siteName} className="h-6 w-6 rounded object-contain shrink-0" />
          ) : (
            <div className="bg-white/20 p-1 rounded shrink-0"><LayoutDashboard className="h-5 w-5" /></div>
          )}
          <span className="truncate md:text-lg text-base">{settings.siteName}</span>
        </div>
        <nav className="hidden md:flex ml-auto mr-6 items-center gap-6 shrink-0">
          <Link href="/" className="text-sm text-white/90 hover:text-white">首页</Link>
          {navItems
            .slice()
            .sort((a: any, b: any) => Number(a.order || 0) - Number(b.order || 0))
            .map((item: any) => {
              const isFuncMenu = String(item.label || '').includes('功能分类') || String(item.id || '') === 'functionality'
              if (isFuncMenu) {
                return (
                  <div key={item.id || 'function-menu'} className="relative group">
                    <button onClick={()=>{ try { (window as any).location.href = '/functionality' } catch {} }} className="text-sm text-white/90 hover:text-white flex items-center gap-1 cursor-pointer">
                      {item.label || '功能分类'}
                      <ChevronDown className="h-4 w-4 transition-transform group-hover:rotate-180" />
                    </button>
                    <div className="absolute top-full right-0 mt-2 w-64 bg-white rounded-lg shadow-lg overflow-hidden z-50 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 max-h-[80vh] overflow-y-auto">
                      <div className="p-2 space-y-2">
                        {categories.map(cat => {
                          const catModules = modules.filter((m: any) => m.status !== '下架' && (m.category === cat.key || (!m.category && cat.key === 'image-text')))
                          if (catModules.length === 0) return null
                          return (
                            <div key={cat.key}>
                              <div className="px-3 py-1 text-xs font-semibold text-gray-400 uppercase">{cat.label}</div>
                              {catModules.map((m:any)=>(
                                <Link key={m.key} href={`/?tab=${m.key}`} className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-blue-50 hover:text-blue-600 rounded-lg transition-colors cursor-pointer">{m.title}</Link>
                              ))}
                            </div>
                          )
                        })}
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
        <div className="md:hidden flex items-center gap-3 shrink-0 ml-2">
          <div className="relative">
            <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="p-2 hover:bg-white/10 rounded transition-colors">
              <MoreHorizontal className="h-6 w-6 text-white" />
            </button>
            {mobileMenuOpen && (
              <>
                <div className="fixed inset-0 z-40 bg-black/20" onClick={() => setMobileMenuOpen(false)}></div>
                <div className="absolute top-full right-0 mt-2 w-48 bg-white rounded-lg shadow-xl py-2 z-50 text-gray-800 animate-in fade-in zoom-in-95 duration-200 max-h-[80vh] overflow-y-auto">
                  <Link href="/" className="block w-full text-left px-4 py-2 text-sm hover:bg-gray-50 font-medium text-blue-600">首页</Link>
                  {navItems
                    .slice()
                    .sort((a: any, b: any) => Number(a.order || 0) - Number(b.order || 0))
                    .map((item: any) => {
                      const isFuncMenu = String(item.label || '').includes('功能分类') || String(item.id || '') === 'functionality'
                      if (isFuncMenu) {
                        return <Link key={item.id} href="/functionality" className="block w-full text-left px-4 py-2 text-sm hover:bg-gray-50">{item.label || '功能分类'}</Link>
                      }
                      return item.isExternal ? (
                        <a key={item.id} href={item.href || '#'} target="_blank" rel="noopener noreferrer" className="block w-full text-left px-4 py-2 text-sm hover:bg-gray-50">
                          {item.label}
                        </a>
                      ) : (
                        <Link key={item.id} href={item.href || '/'} className="block w-full text-left px-4 py-2 text-sm hover:bg-gray-50">
                          {item.label}
                        </Link>
                      )
                    })}
                </div>
              </>
            )}
          </div>
        </div>
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
          <div className="text-xs text-gray-500 mb-6">{item?.createdAt ? new Date(item.createdAt).toLocaleString() : ''} · 浏览 {Number(views || 0)}</div>
          <div className="mdx text-[16px] leading-8 text-gray-800" dangerouslySetInnerHTML={{ __html: html }} />
          <style>{`
            .mdx h1 { font-size: 1.75rem; line-height: 2.25rem; margin: 1.25rem 0 0.75rem; font-weight: 700; color: #111827; }
            .mdx h2 { font-size: 1.5rem; line-height: 2rem; margin: 1rem 0 0.5rem; font-weight: 700; color: #111827; }
            .mdx h3 { font-size: 1.25rem; line-height: 1.75rem; margin: 0.75rem 0 0.5rem; font-weight: 600; color: #1f2937; }
            .mdx p { margin: 0.75rem 0; }
            .mdx ul, .mdx ol { margin: 0.75rem 0 0.75rem 1.5rem; }
            .mdx li { margin: 0.35rem 0; }
            .mdx hr { border: 0; border-top: 1px solid #e5e7eb; margin: 1.25rem 0; }
            .mdx blockquote { border-left: 3px solid #93c5fd; padding-left: 0.75rem; color: #4b5563; background: #f8fafc; margin: 0.75rem 0; }
            .mdx code { background: #f3f4f6; padding: 0.15rem 0.35rem; border-radius: 0.25rem; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 0.9em; }
            .mdx pre { background: #0f172a; color: #e5e7eb; padding: 0.75rem; border-radius: 0.5rem; overflow: auto; }
            .mdx pre code { background: transparent; color: inherit; padding: 0; }
            .mdx a { color: #2563eb; text-decoration: underline; }
            .mdx a:hover { color: #1e40af; }
            .mdx img { max-width: 100%; border-radius: 0.5rem; margin: 0.5rem 0; }
            .mdx table { width: 100%; border-collapse: collapse; margin: 1rem 0; }
            .mdx th, .mdx td { border: 1px solid #e5e7eb; padding: 0.5rem; }
            .mdx th { background: #f9fafb; }
            .mdx strong { color: #111827; }
          `}</style>
          <div className="mt-6 text-center">
            <Link href="/blog" className="text-sm text-blue-600 hover:text-blue-800">返回列表</Link>
          </div>
        </div>
      </div>
      <div className="px-6 pb-10 text-center">
        <footer className="text-xs text-gray-400">
          {settings.copyrightText || DEFAULT_SITE_SETTINGS.copyrightText}
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
