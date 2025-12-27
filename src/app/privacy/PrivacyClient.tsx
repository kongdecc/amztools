"use client"

import Head from 'next/head'
import Link from 'next/link'
import React, { useEffect, useState } from 'react'
import { LayoutDashboard, ChevronDown, MoreHorizontal } from 'lucide-react'
import { useSettings } from '@/components/SettingsProvider'
import { DEFAULT_CATEGORIES, DEFAULT_TOOLS, DEFAULT_SITE_SETTINGS } from '@/lib/constants'

export default function PrivacyClient({ initialNavItems }: { initialNavItems: any[] }) {
  const { settings } = useSettings()
  const content = String(settings.privacyPolicy || DEFAULT_SITE_SETTINGS.privacyPolicy || '')
  const paragraphs = content.split('\n').filter(p => p.trim().length)
  const [navItems] = useState<Array<any>>(initialNavItems || [])
  const [origin, setOrigin] = useState('')
  const [categories, setCategories] = useState<any[]>([])
  const [modules, setModules] = useState<any[]>([])
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

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

  useEffect(() => { try { setOrigin(window.location.origin) } catch {} }, [])
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <Head>
        <title>隐私说明</title>
        <meta name="description" content={String(settings.seoDescription || settings.siteDescription || '')} />
        <meta name="keywords" content={String(settings.siteKeywords || '')} />
        <link rel="canonical" href={`${origin}/privacy`} />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "BreadcrumbList",
          itemListElement: [
            { "@type": "ListItem", position: 1, name: "首页", item: `${origin}/` },
            { "@type": "ListItem", position: 2, name: "隐私说明", item: `${origin}/privacy` }
          ]
        }) }} />
      </Head>
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
            <span className="text-gray-700">隐私说明</span>
          </nav>
          <h1 className="text-2xl font-bold text-gray-800 mb-4">隐私说明</h1>
          <div className="space-y-4 text-[15px] text-gray-800 leading-7">
            {paragraphs.length === 0 ? (
              <p>暂无隐私说明内容。</p>
            ) : (
              paragraphs.map((p, i) => <p key={i}>{p}</p>)
            )}
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