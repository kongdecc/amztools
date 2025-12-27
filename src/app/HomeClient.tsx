'use client'

import React, { useEffect, useState, useMemo, useCallback, Suspense } from 'react'
import { LayoutDashboard, Calculator, Type, Scale, CaseSensitive, ListOrdered, BarChart3, Truck, Search, ChevronDown, Hammer, ArrowLeftRight, Copy, Trash2, Eraser, Download, AlertCircle, CheckCircle, Filter, LayoutGrid, Maximize2, Minimize2, Image as ImageIcon, MoreHorizontal, Receipt, Crosshair, Globe, Star, Activity, Users, FileText, Warehouse, Languages, Shuffle } from 'lucide-react'
import { useSettings } from '@/components/SettingsProvider'
import Head from 'next/head'
import Link from 'next/link'
import ToolContainer from '@/components/ToolContainer'
import { DEFAULT_SITE_SETTINGS } from '@/lib/constants'

import { useRef } from 'react'
import { useSearchParams, useRouter, usePathname } from 'next/navigation'

const Card = ({ children, className = "", onClick, ...props }: any) => (
  <div onClick={onClick} className={`bg-white rounded-xl border border-gray-100 shadow-sm ${className}`} {...props}>{children}</div>
)

const Input = ({ className = "", ...props }: any) => (
  <input className={`flex h-9 w-full rounded-md border border-gray-300 bg-transparent px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-gray-400 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-indigo-500 disabled:cursor-not-allowed disabled:opacity-50 ${className}`} {...props} />
)

const HomePage = ({ onNavigate, modules, categories = [] }: { onNavigate: (id: string) => void; modules: Array<any>; categories?: Array<any> }) => {
  const { settings } = useSettings()
  const router = useRouter()
  const safeOrigin = (typeof window !== 'undefined' && (window as any).location) ? (window as any).location.origin : ''
  const defaultCategories = [
    { key: 'operation', label: '运营工具' },
    { key: 'advertising', label: '广告工具' },
    { key: 'image-text', label: '图片文本' }
  ]
  const activeCategories = categories.length > 0 ? categories : defaultCategories

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
    'fba-label-editor': FileText,
    'fba-warehouses': Warehouse,
    'storage-fee-calc': Warehouse,
    'pinyin-converter': Languages,
    'keyword-combiner': Shuffle,
  }
  const titleOverride: Record<string, string> = {
    'rating-sales-reverse': '好评及销量反推计算器'
  }
  const descOverride: Record<string, string> = {
    'fba-label-editor': '在线编辑FBA标签PDF，支持添加文字（如批量添加Made in China)、手动拖拽调整位置和大小，自动应用到所有页面'
  }
  
  const [searchKeyword, setSearchKeyword] = useState('')
  const visible = modules.map(m => ({
    ...m,
    title: titleOverride[m.key] || m.title,
    desc: descOverride[m.key] || m.desc
  })).filter((m: any) => {
    if (m.status === '下架') return false
    
    // 如果有搜索关键词，忽略分类限制，进行全局搜索
    if (searchKeyword.trim()) {
      const k = searchKeyword.trim().toLowerCase()
      return m.title.toLowerCase().includes(k) || m.desc.toLowerCase().includes(k)
    }

    // 没有搜索关键词时，应用分类过滤
    if (m.category && activeCategories.length > 0 && !activeCategories.some(c => c.key === m.category)) return false
    return true
  })
  
  const colorSolidMap: Record<string, string> = {
    blue: 'bg-blue-600',
    indigo: 'bg-indigo-600',
    cyan: 'bg-cyan-600',
    violet: 'bg-violet-600',
    sky: 'bg-sky-500',
    purple: 'bg-indigo-500',
    orange: 'bg-orange-500',
    emerald: 'bg-emerald-600',
    teal: 'bg-teal-600',
    rose: 'bg-rose-600',
    red: 'bg-red-600',
    amber: 'bg-amber-500',
    lime: 'bg-lime-600',
    fuchsia: 'bg-fuchsia-600',
  }
  const colorTextMap: Record<string, string> = {
    blue: 'text-blue-600',
    indigo: 'text-indigo-600',
    cyan: 'text-cyan-600',
    violet: 'text-violet-600',
    sky: 'text-sky-500',
    purple: 'text-indigo-500',
    orange: 'text-orange-500',
    emerald: 'text-emerald-600',
    teal: 'text-teal-600',
    rose: 'text-rose-600',
    red: 'text-red-600',
    amber: 'text-amber-500',
    lime: 'text-lime-600',
    fuchsia: 'text-fuchsia-600',
  }

  // 首页显示的卡片数量，默认6个
  const homeCardLimit = Number(settings.homeCardLimit || 6)
  const showMore = visible.length > homeCardLimit
  const displayedTools = showMore ? visible.slice(0, homeCardLimit) : visible

  return (
    <div className="space-y-6">
      <Card className="py-12 px-8 text-center space-y-6 relative overflow-hidden bg-gradient-to-br from-white to-slate-50">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 via-purple-500 to-indigo-500"></div>
        {(() => {
          const hide = String(settings.hideHomeHeroIfEmpty || 'false') === 'true'
          const t = String(settings.homeHeroTitle || '')
          const s = String(settings.homeHeroSubtitle || '')
          const showT = hide ? t.trim().length > 0 : true
          const showS = hide ? s.trim().length > 0 : true
          return (
            <>
              {showT && <h1 className={`text-3xl font-bold text-gray-800`}>{hide ? t : (t || '一站式图像与运营处理工具')}</h1>}
              {showS && <p className={`text-gray-500`}>{hide ? s : (s || '轻松处理您的数据，提升工作效率')}</p>}
            </>
          )
        })()}
        <div className="max-w-xl mx-auto relative z-10">
          <Search className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
          <input 
            type="text" 
            placeholder="搜索工具，例如：竞价、大小写..." 
            className="w-full pl-10 pr-4 py-3 rounded-full border border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-sm" 
            value={searchKeyword}
            onChange={(e) => setSearchKeyword(e.target.value)}
          />
          <div className="text-center mt-3 text-sm text-gray-500 font-medium flex items-center justify-center gap-4">
            <span>已经累计上传：<span className="text-indigo-600 font-bold">{modules.filter((m: any) => m.status !== '下架').length}</span> 个工具</span>
            <Link href="/marketing-calendar.html" target="_blank" className="text-indigo-600 hover:text-indigo-800 flex items-center gap-1 transition-colors">
              <span>📅</span>
              <span className="underline decoration-indigo-300 underline-offset-4 hover:decoration-indigo-600">2026年电商营销日历</span>
            </Link>
          </div>
        </div>
      </Card>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {displayedTools.map((tool: any) => {
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
          const colorKey = colorOverride[tool.key] || tool.color
          return (
            <Card key={tool.key} className="group relative p-6 hover:shadow-xl transition-all duration-300 cursor-pointer border-transparent hover:border-gray-100 bg-white overflow-hidden" onClick={() => onNavigate(tool.key)}>
              <div className="flex items-start gap-4 mb-4">
                <div className={`w-12 h-12 rounded-xl ${colorSolidMap[colorKey] || 'bg-blue-600'} flex items-center justify-center shadow-md shrink-0 group-hover:scale-105 transition-transform duration-300`}>
                  {(() => {
                    const I = iconMap[tool.key] || Hammer
                    return <I className="h-6 w-6 text-white" />
                  })()}
                </div>
                <h3 className="text-lg font-bold text-gray-800 pt-1 group-hover:text-gray-900">{tool.title}</h3>
                {tool.status === '维护' && <span className="ml-auto px-2 py-0.5 text-xs rounded border bg-yellow-50 text-yellow-600 border-yellow-200">维护中</span>}
              </div>
              <p className="text-sm text-gray-500 leading-relaxed mb-8 line-clamp-2">{tool.desc}</p>
              <div className={`absolute bottom-6 left-6 flex items-center gap-2 text-sm font-bold ${colorTextMap[colorKey] || 'text-blue-600'} opacity-0 translate-y-4 group-hover:opacity-100 group-hover:translate-y-0 transition-all duration-300`}>
                <span>立即使用</span>
                <ArrowLeftRight className="h-4 w-4" />
              </div>
            </Card>
          )
        })}
      </div>
      {showMore && (
        <div className="text-center mt-8">
          <Link 
            href="/functionality"
            className="inline-flex bg-gradient-to-r from-blue-500 to-purple-600 text-white px-8 py-3 rounded-lg font-medium hover:shadow-lg transform hover:-translate-y-1 transition-all items-center gap-2 mx-auto"
          >
            查看更多工具
            <ArrowLeftRight className="h-4 w-4" />
          </Link>
        </div>
      )}
    </div>
  )
}













export default function HomeLayoutClient({ initialModules, initialNavItems, initialActiveTab, initialFull, initialCategories }: { initialModules: any[]; initialNavItems: any[]; initialActiveTab?: string; initialFull?: boolean; initialCategories?: any[] }) {
  const searchParams = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()
  const [activeTab, setActiveTab] = useState<string>(() => {
    if (initialActiveTab && String(initialActiveTab).trim()) return String(initialActiveTab)
    if (typeof window !== 'undefined') {
      try {
        const qs = new URLSearchParams(window.location.search)
        const tab = qs.get('tab') || (window.location.hash ? window.location.hash.replace('#','') : '')
        return tab || 'home'
      } catch {}
    }
    return 'home'
  })
  const [isFull, setIsFull] = useState<boolean>(() => {
    if (typeof initialFull === 'boolean') return Boolean(initialFull)
    if (typeof window !== 'undefined') {
      try {
        const qs = new URLSearchParams(window.location.search)
        const fullParam = qs.get('full')
        if (fullParam === '1') return true
        if (fullParam === '0') return false
        const tab = qs.get('tab') || (window.location.hash ? window.location.hash.replace('#','') : '')
        return Boolean(tab && tab !== 'home')
      } catch {}
    }
    return false
  })
  const [modules, setModules] = useState<Array<any>>(initialModules || [])
  const [navItems, setNavItems] = useState<Array<any>>(initialNavItems || [])
  const [categories, setCategories] = useState<Array<any>>(initialCategories || [])
  
  useEffect(() => {
    const tab = searchParams.get('tab')
    if (tab) {
      setActiveTab(tab)
    } else {
      // Only reset to home if we are on the home path and no tab is specified. 
      // But here we are always on home page component.
      // If user navigates to '/' without params, we should probably show home.
      if (!window.location.hash) setActiveTab('home')
    }
    
    const full = searchParams.get('full')
    if (full === '1') setIsFull(true)
    else if (full === '0') setIsFull(false)
  }, [searchParams])

  const mainRef = useRef<HTMLDivElement>(null)

  const handleNavigate = (tab: string) => {
    if (tab === 'home') {
      // 使用 replace 而不是 push，避免历史记录堆积导致后退困难
      router.replace('/')
    } else {
      const params = new URLSearchParams(searchParams.toString())
      params.set('tab', tab)
      // 使用 replace 切换 tab，提高响应速度并避免页面重新加载
      router.replace(`/?${params.toString()}`, { scroll: false })
    }
  }
  
  const iconMap: Record<string, any> = useMemo(() => ({
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
    'fba-label-editor': FileText,
    'fba-warehouses': Warehouse,
    'pinyin-converter': Languages,
    'keyword-combiner': Shuffle,
  }), [])
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({})
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  const toggleCategory = useCallback((catKey: string) => {
    setExpandedCategories(prev => ({ ...prev, [catKey]: !prev[catKey] }))
  }, [])

  const menuItems = useMemo(() => [
    { id: 'home', label: '首页', icon: LayoutDashboard },
    ...categories.map(cat => ({
      id: cat.key,
      label: cat.label,
      children: modules.filter((m: any) => m.status !== '下架' && (m.category === cat.key || (!m.category && cat.key === 'image-text'))).map((m: any) => ({
        id: m.key,
        label: m.status === '维护' ? `${m.title}（维护）` : m.title,
        icon: iconMap[m.key] || Hammer
      }))
    }))
  ], [categories, modules, iconMap])

  useEffect(() => {
    // Auto-expand category if active tab is inside it
    const activeCat = menuItems.find((item: any) => item.children?.some((child: any) => child.id === activeTab))
    if (activeCat) {
      setExpandedCategories(prev => ({ ...prev, [activeCat.id]: true }))
    }
  }, [activeTab])
          useEffect(() => {
            if (activeTab && activeTab !== 'home') {
              try { 
                // Use non-blocking fetch
                setTimeout(() => {
                  fetch('/api/analytics/visits', { 
                    method: 'POST', 
                    headers: { 'Content-Type': 'application/json' }, 
                    body: JSON.stringify({ module: activeTab }),
                    keepalive: true
                  }).catch(() => {})
                }, 1000)
              } catch {}
            }
            // 页面切换时滚动到顶部
            setTimeout(() => {
              try { window.scrollTo({ top: 0, behavior: 'auto' }) } catch {}
              if (mainRef.current) {
                try { (mainRef.current as any).scrollTo({ top: 0, behavior: 'auto' }) } catch { mainRef.current.scrollTop = 0 }
              }
            }, 0);
          }, [activeTab])
          const { settings } = useSettings()
          const safeOrigin = (typeof window !== 'undefined' && (window as any).location) ? (window as any).location.origin : ''

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <Head>
        <title>{settings.siteName}</title>
        <meta name="keywords" content={settings.siteKeywords} />
        <meta name="description" content={settings.siteDescription} />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "BreadcrumbList",
          itemListElement: [
            { "@type": "ListItem", position: 1, name: "首页", item: `${safeOrigin}/` }
          ]
        }) }} />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "WebSite",
          name: settings.siteName,
          url: safeOrigin || undefined
        }) }} />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "Organization",
          name: settings.siteName,
          url: safeOrigin || undefined,
          logo: settings.logoUrl || undefined
        }) }} />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "CollectionPage",
          name: `${settings.siteName} - 工具集合`,
          url: safeOrigin || undefined,
          hasPart: (Array.isArray(modules) ? modules : []).filter((m:any) => m.status !== '下架').map((m:any) => ({
            "@type": "WebPage",
            name: m.title,
            url: `${safeOrigin}/#${m.key}`
          }))
        }) }} />
      </Head>
      <header className="h-14 bg-[#5b5bd6] text-white flex items-center px-4 md:px-10 shadow-md z-20 justify-between md:justify-start">
        <div className={`flex items-center gap-2 font-bold text-lg min-w-0 flex-1`}>
          <div className="bg-white/20 p-1 rounded shrink-0"><LayoutDashboard className="h-5 w-5" /></div>
          <span className="truncate md:text-lg text-base">{settings.siteName}</span>
        </div>
        <nav className="hidden md:flex ml-auto mr-6 items-center gap-6 shrink-0">
          <button onClick={() => handleNavigate('home')} className="text-sm text-white/90 hover:text-white cursor-pointer">首页</button>
          {navItems
            .slice()
            .sort((a: any, b: any) => Number(a.order || 0) - Number(b.order || 0))
            .map((item: any) => {
              const isFuncMenu = String(item.label || '').includes('功能分类') || String(item.id || '') === 'functionality'
              const hasChildren = Array.isArray(item.children) && item.children.length > 0
              if (isFuncMenu) {
                return (
                  <div key={item.id || 'function-menu'} className="relative group">
                    <button onClick={()=>{ router.push('/functionality') }} className="text-sm text-white/90 hover:text-white flex items-center gap-1 cursor-pointer">
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
                                  {m.title}
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
              if (hasChildren) {
                return (
                  <div key={item.id} className="relative group">
                    <button className="text-sm text-white/90 hover:text-white flex items-center gap-1 cursor-pointer">
                      {item.label}
                      <ChevronDown className="h-4 w-4 transition-transform group-hover:rotate-180" />
                    </button>
                    <div className="absolute top-full right-0 mt-2 w-64 bg-white rounded-lg shadow-lg overflow-hidden z-50 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200">
                      <div className="p-2 space-y-1">
                        {item.children.map((c: any) => (
                          c.isExternal ? (
                            <a key={c.id} href={c.href || '#'} target="_blank" rel="noopener noreferrer" className="block px-4 py-2 text-sm text-gray-700 hover:bg-blue-50 hover:text-blue-600 rounded-lg">
                              {c.label}
                            </a>
                          ) : (
                            c.href ? (
                              <Link key={c.id} href={c.href} className="block px-4 py-2 text-sm text-gray-700 hover:bg-blue-50 hover:text-blue-600 rounded-lg">
                                {c.label}
                              </Link>
                            ) : (
                              <button key={c.id} onClick={() => handleNavigate(c.id)} className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-blue-50 hover:text-blue-600 rounded-lg cursor-pointer">
                                {c.label}
                              </button>
                            )
                          )
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
                item.href ? (
                  <Link key={item.id} href={item.href} className="text-sm text-white/90 hover:text-white">
                    {item.label}
                  </Link>
                ) : (
                  <button key={item.id} onClick={() => handleNavigate(item.id)} className="text-sm text-white/90 hover:text-white cursor-pointer">
                    {item.label}
                  </button>
                )
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
                  <button onClick={() => { handleNavigate('home'); setMobileMenuOpen(false); }} className="block w-full text-left px-4 py-2 text-sm hover:bg-gray-50 font-medium text-blue-600">首页</button>
                  {navItems
                    .slice()
                    .sort((a: any, b: any) => Number(a.order || 0) - Number(b.order || 0))
                    .map((item: any) => {
                      const isFuncMenu = String(item.label || '').includes('功能分类') || String(item.id || '') === 'functionality'
                      if (isFuncMenu) {
                        return <button key={item.id} onClick={()=>{ setMobileMenuOpen(false); router.push('/functionality') }} className="block w-full text-left px-4 py-2 text-sm hover:bg-gray-50">{item.label || '功能分类'}</button>
                      }
                      if (item.isExternal) {
                        return <a key={item.id} href={item.href || '#'} target="_blank" rel="noopener noreferrer" className="block w-full text-left px-4 py-2 text-sm hover:bg-gray-50">{item.label}</a>
                      }
                      if (item.href) {
                        return <Link key={item.id} href={item.href} onClick={() => setMobileMenuOpen(false)} className="block w-full text-left px-4 py-2 text-sm hover:bg-gray-50">{item.label}</Link>
                      }
                      return <button key={item.id} onClick={() => { handleNavigate(item.id); setMobileMenuOpen(false); }} className="block w-full text-left px-4 py-2 text-sm hover:bg-gray-50">{item.label}</button>
                    })}
                </div>
              </>
            )}
          </div>
        </div>
      </header>
      <div className="flex flex-1">
        {!isFull && (
        <aside className="w-64 bg-white border-r border-gray-200 flex-shrink-0 hidden md:flex flex-col">
          <div className="p-4 space-y-1 flex-1 overflow-y-auto">
            {menuItems.map((item: any) => {
              if (item.children && item.children.length > 0) {
                const isExpanded = !!expandedCategories[item.id] // Default collapsed
                return (
                  <div key={item.id} className="mb-2">
                    <button 
                      onClick={() => toggleCategory(item.id)}
                      className="w-full flex items-center justify-between px-4 py-2 text-sm font-bold text-gray-500 uppercase tracking-wider hover:text-gray-800 transition-colors"
                    >
                      {item.label}
                      <ChevronDown className={`h-4 w-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                    </button>
                    {isExpanded && (
                      <div className="space-y-1 mt-1">
                        {item.children.map((child: any) => (
                          <button 
                            key={child.id} 
                            onClick={() => handleNavigate(child.id)} 
                            className={`w-full flex items-center gap-3 px-4 py-2 text-sm font-medium rounded-lg transition-colors ${activeTab === child.id ? 'bg-blue-50 text-blue-600' : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'}`}
                          >
                            <child.icon className={`h-4 w-4 ${activeTab === child.id ? 'text-blue-600' : 'text-gray-400'}`} />
                            {child.label}
                            {activeTab === child.id && <div className="ml-auto w-1.5 h-1.5 rounded-full bg-blue-600" />}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )
              }
              return (
                <button 
                  key={item.id} 
                  onClick={() => handleNavigate(item.id)} 
                  className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-lg transition-colors ${activeTab === item.id ? 'bg-blue-50 text-blue-600' : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'}`}
                >
                  {item.icon && <item.icon className={`h-5 w-5 ${activeTab === item.id ? 'text-blue-600' : 'text-gray-400'}`} />}
                  {item.label}
                  {activeTab === item.id && <div className="ml-auto w-1.5 h-1.5 rounded-full bg-blue-600" />}
                </button>
              )
            })}
          </div>
          {process.env.NODE_ENV !== 'production' && (
            <div className="p-4 border-t border-gray-100">
              <div className="flex gap-2">
                <div className="h-8 w-8 rounded-full bg-gray-800 text-white flex items-center justify-center text-xs font-bold">N</div>
                <div className="h-8 w-8 rounded-full bg-gray-200 flex items-center justify-center"><ChevronDown className="h-4 w-4 text-gray-600" /></div>
              </div>
            </div>
          )}
        </aside>
        )}
        <main ref={mainRef} className="flex-1 p-4 md:p-8 relative">
          {activeTab !== 'home' && (
            <div className="flex items-center justify-between mb-4 bg-white p-3 rounded-lg border border-gray-100 shadow-sm md:hidden">
               <span className="text-sm font-bold text-gray-700">功能详情</span>
               <button
                onClick={() => setIsFull(!isFull)}
                className="flex items-center gap-1 text-xs text-blue-600 bg-blue-50 px-2 py-1 rounded hover:bg-blue-100 transition-colors"
              >
                {isFull ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
                {isFull ? "退出全屏" : "全屏显示"}
              </button>
            </div>
          )}
          {activeTab !== 'home' && (
            <div className="hidden md:flex items-center justify-end mb-4 gap-2">
               <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">点击切换全屏模式</span>
               <button
                onClick={() => setIsFull(!isFull)}
                className="group p-2 bg-white border border-gray-200 rounded-lg shadow-sm hover:bg-gray-50 text-gray-600 transition-all hover:text-blue-600"
                title={isFull ? "退出全屏" : "最大化页面"}
              >
                {isFull ? <Minimize2 size={20} /> : <Maximize2 size={20} />}
              </button>
            </div>
          )}
          <div className="max-w-7xl mx-auto">
            {activeTab === 'home' ? (
              <HomePage onNavigate={handleNavigate} modules={modules} categories={categories} />
            ) : activeTab === 'functionality' ? (
              <div className="space-y-6">
                <div className="flex items-center gap-2 mb-2">
                  <LayoutGrid className="h-6 w-6 text-blue-600" />
                  <h2 className="text-xl font-bold text-gray-800">{String(settings.functionalityTitle || '功能中心')}</h2>
                </div>
                {String(settings.functionalitySubtitle || '').trim().length > 0 && (
                  <p className="text-sm text-gray-500">{String(settings.functionalitySubtitle)}</p>
                )}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {modules.filter((m: any) => m.status !== '下架').map((m: any) => {
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
                      'invoice-generator': 'cyan',
                      'amazon-global': 'orange',
                    }
                    const colorKey = colorOverride[m.key] || m.color
                    const colorSolidMap: Record<string, string> = {
                      blue: 'bg-blue-600',
                      indigo: 'bg-indigo-600',
                      cyan: 'bg-cyan-600',
                      violet: 'bg-violet-600',
                      sky: 'bg-sky-500',
                      purple: 'bg-indigo-500',
                      orange: 'bg-orange-500',
                      emerald: 'bg-emerald-600',
                      teal: 'bg-teal-600',
                      rose: 'bg-rose-600',
                      red: 'bg-red-600',
                      amber: 'bg-amber-500',
                      lime: 'bg-lime-600',
                      fuchsia: 'bg-fuchsia-600',
                    }
                    const colorTextMap: Record<string, string> = {
                      blue: 'text-blue-600',
                      indigo: 'text-indigo-600',
                      cyan: 'text-cyan-600',
                      violet: 'text-violet-600',
                      sky: 'text-sky-500',
                      purple: 'text-indigo-500',
                      orange: 'text-orange-500',
                      emerald: 'text-emerald-600',
                      teal: 'text-teal-600',
                      rose: 'text-rose-600',
                      red: 'text-red-600',
                      amber: 'text-amber-500',
                      lime: 'text-lime-600',
                      fuchsia: 'text-fuchsia-600',
                    }
                    return (
                      <Card key={m.key} className="group relative p-6 hover:shadow-xl transition-all duration-300 cursor-pointer border-transparent hover:border-gray-100 bg-white overflow-hidden" onClick={() => handleNavigate(m.key)}>
                        <div className="flex items-start gap-4 mb-4">
                          <div className={`w-12 h-12 rounded-xl ${colorSolidMap[colorKey] || 'bg-blue-600'} flex items-center justify-center shadow-md shrink-0 group-hover:scale-105 transition-transform duration-300`}>
                            {(() => {
                              const I = iconMap[m.key] || Hammer
                              return <I className="h-6 w-6 text-white" />
                            })()}
                          </div>
                          <h3 className="text-lg font-bold text-gray-800 pt-1 group-hover:text-gray-900">{m.title}</h3>
                          {m.status === '维护' && <span className="ml-auto px-2 py-0.5 text-xs rounded border bg-yellow-50 text-yellow-600 border-yellow-200">维护中</span>}
                        </div>
                        <p className="text-sm text-gray-500 leading-relaxed mb-8 line-clamp-2">{m.desc}</p>
                        <div className={`absolute bottom-6 left-6 flex items-center gap-2 text-sm font-bold ${colorTextMap[colorKey] || 'text-blue-600'} opacity-0 translate-y-4 group-hover:opacity-100 group-hover:translate-y-0 transition-all duration-300`}>
                          <span>立即使用</span>
                          <ArrowLeftRight className="h-4 w-4" />
                        </div>
                      </Card>
                    )
                  })}
                </div>
              </div>
            ) : (
              <ToolContainer activeTab={activeTab} />
            )}
          </div>
          
        </main>
      </div>
      <div className="mt-auto text-center py-6">
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




  const titleOverride: Record<string, string> = {
    'rating-sales-reverse': '好评及销量反推计算器'
  }
