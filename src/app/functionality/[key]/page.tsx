'use client'

import React from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { LayoutDashboard } from 'lucide-react'
import { SettingsProvider, useSettings } from '@/components/SettingsProvider'
import { ChevronDown } from 'lucide-react'
import EditorPage from '@/components/EditorPage'
import FBACalculatorPage from '@/components/FBACalculator'
import ForbiddenWordsChecker from '@/components/ForbiddenWordsChecker'
import TextComparator from '@/components/TextComparator'
import DuplicateRemover from '@/components/DuplicateRemover'
import ContentFilter from '@/components/ContentFilter'
import ImageResizer from '@/components/ImageResizer'
import InvoiceGenerator from '@/components/InvoiceGenerator'

const DetailClient = () => {
  const { key } = useParams<{ key: string }>()
  const { settings } = useSettings()
  const [modules, setModules] = React.useState<any[]>([])
  const [navItems, setNavItems] = React.useState<any[]>([])
  const [origin, setOrigin] = React.useState('')
  const [categories, setCategories] = React.useState<any[]>([])

  React.useEffect(() => {
    (async () => {
      try {
        const r = await fetch('/api/categories', { cache: 'no-store' })
        const d = await r.json()
        if (Array.isArray(d) && d.length > 0) setCategories(d)
        else setCategories([{ key: 'operation', label: '运营工具' }, { key: 'advertising', label: '广告工具' }, { key: 'image-text', label: '图片文本' }])
      } catch {
        setCategories([{ key: 'operation', label: '运营工具' }, { key: 'advertising', label: '广告工具' }, { key: 'image-text', label: '图片文本' }])
      }
    })()
  }, [])
  React.useEffect(() => { (async () => { try { const r = await fetch('/api/modules', { cache: 'no-store' }); const d = await r.json(); const arr = Array.isArray(d) ? d : []; setModules(arr.filter((m:any)=>m.status !== '下架')) } catch {} })() }, [])
  React.useEffect(() => { try { const raw = (settings as any).navigation; const arr = raw ? JSON.parse(String(raw)) : []; setNavItems(Array.isArray(arr) ? arr : []) } catch {} }, [settings])

  const renderTool = () => {
    switch (key) {
      case 'delivery':
        return <FBACalculatorPage />
      case 'editor':
        return <EditorPage />
      case 'forbidden-words':
        return <ForbiddenWordsChecker />
      case 'text-compare':
        return <TextComparator />
      case 'duplicate-remover':
        return <DuplicateRemover />
      case 'content-filter':
        return <ContentFilter />
      case 'image-resizer':
        return <ImageResizer />
      case 'invoice-generator':
        return <InvoiceGenerator />
      default:
        return (
          <div className="bg-white p-6 rounded-xl border">
            <p className="text-gray-600">该功能的独立详情页暂未提供，请从首页进入。</p>
            <div className="mt-3 text-sm">
              <Link href={`/?tab=${key}`} className="text-blue-600 hover:underline">从首页打开该功能</Link>
            </div>
          </div>
        )
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <header className="h-14 bg-[#5b5bd6] text-white flex items-center px-10 shadow-md z-20">
        <div className={`flex items-center gap-2 font-bold text-lg`}>
          <div className="bg-white/20 p-1 rounded"><LayoutDashboard className="h-5 w-5" /></div>
          <span>{settings.siteName}</span>
        </div>
        <nav className="ml-auto mr-6 flex items-center gap-6">
          <Link href="/" className="text-sm text-white/90 hover:text-white">首页</Link>
          {navItems.map((item:any) => {
            const isFuncMenu = String(item.label || '').includes('功能分类') || String(item.id || '') === 'functionality'
            if (isFuncMenu) {
              return (
                <div key={item.id || 'function-menu'} className="relative group">
                  <Link href="/functionality" className="text-sm text-white/90 hover:text-white flex items-center gap-1 cursor-pointer">
                    {item.label || '功能分类'}
                    <ChevronDown className="h-4 w-4 transition-transform group-hover:rotate-180" />
                  </Link>
                  <div className="absolute top-full right-0 mt-2 w-64 bg-white rounded-lg shadow-lg overflow-hidden z-50 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 max-h-[80vh] overflow-y-auto">
                    <div className="p-2 space-y-2">
                      {categories.map(cat => {
                        const catModules = modules.filter((m: any) => m.status !== '下架' && (m.category === cat.key || (!m.category && cat.key === 'image-text')))
                        if (catModules.length === 0) return null
                        return (
                          <div key={cat.key}>
                            <div className="px-3 py-1 text-xs font-semibold text-gray-400 uppercase">{cat.label}</div>
                            {catModules.map((m: any) => (
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
              <a key={item.id} href={item.href || '#'} target="_blank" rel="noopener noreferrer" className="text-sm text-white/90 hover:text-white">{item.label}</a>
            ) : (
              <a key={item.id} href={item.href || '/'} className="text-sm text-white/90 hover:text-white">{item.label}</a>
            )
          })}
        </nav>
      </header>
      <main className="flex-1 p-8">
        <div className="max-w-7xl mx-auto">
          {renderTool()}
        </div>
      </main>
      <div className="mt-auto text-center py-6">
        <footer className="text-xs text-gray-400">
          {settings.copyrightText || '© 2025 运营魔方 ToolBox. All rights reserved.'}
          <span className="mx-2">|</span>
          <a href="/privacy" className="hover:text-blue-600">隐私说明</a>
        </footer>
      </div>
    </div>
  )
}

export default function Page() {
  return (
    <SettingsProvider>
      <DetailClient />
    </SettingsProvider>
  )
}

