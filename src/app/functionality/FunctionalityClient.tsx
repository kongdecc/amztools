'use client'

import React, { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { LayoutDashboard, ChevronDown, Search, MoreHorizontal, Calculator, Type, Scale, CaseSensitive, ListOrdered, BarChart3, Truck, Trash2, AlertCircle, CheckCircle, Filter, Image as ImageIcon, Receipt, Crosshair, Globe, Star, Hammer, ArrowLeftRight, Activity, Users, Box, Warehouse, FileText, Languages, Shuffle } from 'lucide-react'
import { useSettings } from '@/components/SettingsProvider'

const Card = ({ children, className = '', onClick, ...props }: any) => (
  <div onClick={onClick} className={`bg-white rounded-xl border border-gray-100 shadow-sm ${className}`} {...props}>{children}</div>
)

interface Module {
  key: string
  title: string
  desc: string
  status: string
  views: number
  color: string
  order: number
  category?: string
}

export default function FunctionalityClient({ initialNavItems, initialModules, initialCategories }: { initialNavItems: any[]; initialModules?: Module[]; initialCategories?: any[] }) {
  const router = useRouter()
  const [modules, setModules] = useState<Module[]>(initialModules || [])
  const [categories, setCategories] = useState<any[]>(initialCategories || [])
  const [keyword, setKeyword] = useState('')
  const { settings } = useSettings()
  const [navItems, setNavItems] = useState<Array<any>>(initialNavItems || [])
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  useEffect(() => {
    (async () => {
      if (!initialModules || initialModules.length === 0) {
        try {
          const r = await fetch('/api/modules', { cache: 'no-store' })
          const d = await r.json()
          const arr: Module[] = Array.isArray(d) ? d : []
          const next = arr.filter(m => m.status !== '下架').sort((a, b) => a.order - b.order)
          setModules(next.length ? next : [])
        } catch { setModules([]) }
      }

      if (!initialCategories || initialCategories.length === 0) {
        try {
          const r = await fetch('/api/categories', { cache: 'no-store' })
          const d = await r.json()
          if (Array.isArray(d) && d.length > 0) {
            setCategories(d.filter((c: any) => c.enabled !== false))
          } else {
            setCategories([
              { key: 'operation', label: '运营工具' },
              { key: 'advertising', label: '广告工具' },
              { key: 'image-text', label: '图片文本' }
            ])
          }
        } catch {
          setCategories([
            { key: 'operation', label: '运营工具' },
            { key: 'advertising', label: '广告工具' },
            { key: 'image-text', label: '图片文本' }
          ])
        }
      }
    })()
  }, [])

  const titleOverride: Record<string, string> = {
    'rating-sales-reverse': '好评及销量反推计算器'
  }

  const descOverride: Record<string, string> = {
    'fba-label-editor': '在线编辑FBA标签PDF，支持添加文字（如批量添加Made in China)、手动拖拽调整位置和大小，自动应用到所有页面'
  }

  const filtered = modules.map(m => ({
    ...m,
    title: titleOverride[m.key] || m.title,
    desc: descOverride[m.key] || m.desc
  })).filter(module => {
    if (!keyword.trim()) return true
    const k = keyword.trim().toLowerCase()
    return module.title.toLowerCase().includes(k) || module.desc.toLowerCase().includes(k)
  })

  const colorSolidMap: Record<string, string> = {
    blue: 'bg-blue-600', indigo: 'bg-indigo-600', cyan: 'bg-cyan-600', violet: 'bg-violet-600', sky: 'bg-sky-500', purple: 'bg-indigo-500', orange: 'bg-orange-500', emerald: 'bg-emerald-600', teal: 'bg-teal-600', rose: 'bg-rose-600', red: 'bg-red-600', amber: 'bg-amber-500', lime: 'bg-lime-600', fuchsia: 'bg-fuchsia-600'
  }
  const colorTextMap: Record<string, string> = {
    blue: 'text-blue-600', indigo: 'text-indigo-600', cyan: 'text-cyan-600', violet: 'text-violet-600', sky: 'text-sky-500', purple: 'text-indigo-500', orange: 'text-orange-500', emerald: 'text-emerald-600', teal: 'text-teal-600', rose: 'text-rose-600', red: 'text-red-600', amber: 'text-amber-500', lime: 'text-lime-600', fuchsia: 'text-fuchsia-600'
  }

  const iconMap: Record<string, any> = {
    'ad-calc': Calculator,
    'cpc-compass': Crosshair,
    'editor': Type,
    'unit': Scale,
    'case': CaseSensitive,
    'word-count': ListOrdered,
    'char-count': BarChart3,
    'delivery': Truck,
    'returns-v2': Trash2,
    'listing-check': LayoutDashboard,
    'forbidden-words': AlertCircle,
    'text-compare': Search,
    'duplicate-remover': CheckCircle,
    'content-filter': Filter,
    'image-resizer': ImageIcon,
    'invoice-generator': Receipt,
    'amazon-global': Globe,
    'rating-sales-reverse': Star,
    'max-reserve-fee': Calculator,
    'keyword-strategy': Filter,
    'search-term-volatility': Activity,
    'partner-equity-calculator': Users,
    'natural-traffic-tool': BarChart3,
    'fba-warehouses': Warehouse,
    'fba-label-editor': FileText,
    'pinyin-converter': Languages,
    'keyword-combiner': Shuffle,
    'storage-fee-calc': Warehouse,
  }

  const colorOverride: Record<string, string> = {
    'ad-calc': 'blue',
    'cpc-compass': 'blue',
    'editor': 'fuchsia',
    'unit': 'emerald',
    'case': 'violet',
    'word-count': 'sky',
    'char-count': 'rose',
    'delivery': 'orange',
    'returns-v2': 'red',
    'listing-check': 'teal',
    'rating-sales-reverse': 'indigo',
  }

  const handleNavigate = (key: string) => { router.push(`/?tab=${key}&full=1`) }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <header className="h-14 bg-[#5b5bd6] text-white flex items-center px-4 md:px-10 shadow-md z-20 justify-between md:justify-start">
        <div className={`flex items-center gap-2 font-bold text-lg min-w-0 flex-1`}>
          <div className="bg-white/20 p-1 rounded shrink-0"><LayoutDashboard className="h-5 w-5" /></div>
          <span className="truncate md:text-lg text-base">{settings.siteName}</span>
        </div>
        <nav className="hidden md:flex ml-auto mr-6 items-center gap-6 shrink-0">
          <a href="/" className="text-sm text-white/90 hover:text-white">首页</a>
          {navItems.map((item:any) => {
            const isFuncMenu = String(item.label || '').includes('功能分类') || String(item.id || '') === 'functionality'
            if (isFuncMenu) {
              return (
                <div key={item.id || 'function-menu'} className="relative group">
                  <button onClick={() => router.push('/functionality')} className="text-sm text-white/90 hover:text-white flex items-center gap-1 cursor-pointer">
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
                            {catModules.map((m: any) => (
                              <button 
                                key={m.key}
                                onClick={() => handleNavigate(m.key)}
                                className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-blue-50 hover:text-blue-600 rounded-lg transition-colors cursor-pointer"
                              >
                                {titleOverride[m.key] || m.title}
                              </button>
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
        <div className="md:hidden flex items-center gap-3 shrink-0 ml-2">
          <div className="relative">
            <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="p-2 hover:bg-white/10 rounded transition-colors">
              <MoreHorizontal className="h-6 w-6 text-white" />
            </button>
            {mobileMenuOpen && (
              <>
                <div className="fixed inset-0 z-40 bg-black/20" onClick={() => setMobileMenuOpen(false)}></div>
                <div className="absolute top-full right-0 mt-2 w-48 bg-white rounded-lg shadow-xl py-2 z-50 text-gray-800 animate-in fade-in zoom-in-95 duration-200 max-h-[80vh] overflow-y-auto">
                  <a href="/" className="block w-full text-left px-4 py-2 text-sm hover:bg-gray-50 font-medium text-blue-600">首页</a>
                  {navItems.map((item:any) => {
                    const isFuncMenu = String(item.label || '').includes('功能分类') || String(item.id || '') === 'functionality'
                    if (isFuncMenu) {
                      return <button key={item.id} onClick={()=>{ setMobileMenuOpen(false); router.push('/functionality') }} className="block w-full text-left px-4 py-2 text-sm hover:bg-gray-50">{item.label || '功能分类'}</button>
                    }
                    if (item.isExternal) {
                      return <a key={item.id} href={item.href || '#'} target="_blank" rel="noopener noreferrer" className="block w-full text-left px-4 py-2 text-sm hover:bg-gray-50">{item.label}</a>
                    }
                    return <a key={item.id} href={item.href || '/'} className="block w-full text-left px-4 py-2 text-sm hover:bg-gray-50">{item.label}</a>
                  })}
                </div>
              </>
            )}
          </div>
        </div>
      </header>
      <div className="flex-1">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="text-center mb-12">
            <h1 className="text-4xl font-bold text-gray-900 mb-4">{settings.functionalityTitle || '功能中心'}</h1>
            <p className="text-lg text-gray-600 max-w-3xl mx-auto">{settings.functionalitySubtitle || '探索我们提供的所有工具和功能，帮助您更高效地管理亚马逊业务'}</p>
          </div>
          <div className="max-w-xl mx-auto relative z-10 mb-10">
            <Search className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
            <input type="text" placeholder="搜索工具，例如：竞价、大小写..." className="w-full pl-10 pr-4 py-3 rounded-full border border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-sm" value={keyword} onChange={(e) => setKeyword(e.target.value)} />
            <div className="text-center mt-3 text-sm text-gray-500 font-medium">
              已经累计上传：<span className="text-indigo-600 font-bold">{modules.filter((m: any) => m.status !== '下架').length}</span> 个工具
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filtered.map((module) => (
              <Link key={module.key} href={`/?tab=${module.key}&full=1`} className="block group" prefetch={false}>
                <Card className="h-full relative p-6 hover:shadow-xl transition-all duration-300 cursor-pointer border-transparent hover:border-gray-100 bg-white overflow-hidden">
                  <div className="flex items-start gap-4 mb-4">
                    <div className={`w-12 h-12 rounded-xl ${colorSolidMap[colorOverride[module.key] || module.color] || 'bg-blue-600'} flex items-center justify-center shadow-md shrink-0 group-hover:scale-105 transition-transform duration-300`}>
                      {(() => {
                        const I = iconMap[module.key] || Hammer
                        return <I className="h-6 w-6 text-white" />
                      })()}
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-gray-800 pt-1 group-hover:text-gray-900">{module.status === '维护' ? `${module.title}（维护）` : module.title}</h3>
                      {module.status === '维护' && (
                        <span className="ml-auto px-2 py-0.5 text-xs rounded border bg-yellow-50 text-yellow-600 border-yellow-200">维护中</span>
                      )}
                    </div>
                  </div>
                  <p className="text-sm text-gray-500 leading-relaxed mb-8 line-clamp-2">{module.desc}</p>
                  <div className={`absolute bottom-6 left-6 flex items-center gap-2 text-sm font-bold ${colorTextMap[colorOverride[module.key] || module.color] || 'text-blue-600'} opacity-0 translate-y-4 group-hover:opacity-100 group-hover:translate-y-0 transition-all duration-300`}>
                    <span>立即使用</span>
                    <ArrowLeftRight className="h-4 w-4" />
                  </div>
                </Card>
              </Link>
            ))}
          </div>
          {filtered.length === 0 && (
            <div className="text-center py-16 bg-white rounded-lg shadow-sm border border-gray-100"><p className="text-gray-500">没有找到匹配的功能</p></div>
          )}
        </div>
      </div>
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

