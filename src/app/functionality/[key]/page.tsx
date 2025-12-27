'use client'

import React from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { LayoutDashboard, Calculator, Crosshair, Type, Scale, CaseSensitive, ListOrdered, BarChart3, Truck, Trash2, AlertCircle, CheckCircle, Filter, Image as ImageIcon, Receipt, Globe, Star, Hammer, Search, Activity, Users, Box, Warehouse, FileText, Tags } from 'lucide-react'
import { SettingsProvider, useSettings } from '@/components/SettingsProvider'
import { ChevronDown } from 'lucide-react'
import EditorPage from '@/components/EditorPage'
import FBACalculatorPage from '@/components/FBACalculator'
import FBAWarehouses from '@/components/FBAWarehouses'
import FBALabelEditor from '@/components/FBALabelEditor'
import ForbiddenWordsChecker from '@/components/ForbiddenWordsChecker'
import TextComparator from '@/components/TextComparator'
import DuplicateRemover from '@/components/DuplicateRemover'
import ContentFilter from '@/components/ContentFilter'
import ImageResizer from '@/components/ImageResizer'
import ImageCompressionPage from '@/components/ImageCompressionPage'
import InvoiceGenerator from '@/components/InvoiceGenerator'
import CpcCalculator from '@/components/CpcCalculator'
import AmazonGlobalTool from '@/components/AmazonGlobalTool'
import AmazonRatingSalesReverse from '@/components/AmazonRatingSalesReverse'
import MaxReserveFeeCalculator from '@/components/MaxReserveFeeCalculator'
import KeywordStrategyTool from '@/components/KeywordStrategyTool'
import SearchTermVolatilityTool from '@/components/SearchTermVolatilityTool'
import PartnerEquityCalculator from '@/components/PartnerEquityCalculator'
import CartonCalculatorAdvanced from '@/components/CartonCalculatorAdvanced'
import NaturalTrafficTool from '@/components/NaturalTrafficTool'
import AmazonPromotionStackingCalculator from '@/components/AmazonPromotionStackingCalculator'
import StorageFeeCalculatorPage from '@/components/StorageFeeCalculatorPage'
import { DEFAULT_NAV_ITEMS, DEFAULT_TOOLS, DEFAULT_CATEGORIES, DEFAULT_SITE_SETTINGS } from '@/lib/constants'

const DetailClient = () => {
  const { key } = useParams<{ key: string }>()
  const { settings } = useSettings()
  const [modules, setModules] = React.useState<any[]>([])
  const [navItems, setNavItems] = React.useState<any[]>([])
  const [origin, setOrigin] = React.useState('')
  const [categories, setCategories] = React.useState<any[]>([])

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
    'carton-calc-advanced': Box,
    'natural-traffic-tool': BarChart3,
    'fba-warehouses': Warehouse,
    'fba-label-editor': FileText,
    'amazon-promotion-stacking': Tags,
    'storage-fee-calc': Warehouse,
  }

  const titleOverride: Record<string, string> = {
    'rating-sales-reverse': '好评及销量反推计算器'
  }

  React.useEffect(() => {
    (async () => {
      try {
        const r = await fetch('/api/categories', { cache: 'no-store' })
        const d = await r.json()
        if (Array.isArray(d) && d.length > 0) setCategories(d)
        else setCategories(DEFAULT_CATEGORIES)
      } catch {
        setCategories(DEFAULT_CATEGORIES)
      }
    })()
  }, [])
  React.useEffect(() => { 
    (async () => { 
      try { 
        const r = await fetch('/api/modules', { cache: 'no-store' }); 
        const d = await r.json(); 
        const arr = Array.isArray(d) ? d : []; 
        let merged = arr.filter((m:any)=>m.status !== '下架')
        // Merge with defaults
        if (merged.length === 0) {
          merged = DEFAULT_TOOLS
        } else {
          const keys = new Set(merged.map((x: any) => x.key))
          for (const t of DEFAULT_TOOLS) {
            if (!keys.has(t.key)) merged.push(t)
          }
        }
        // Force override status for 'word-count' if it is '维护'
        merged = merged.map((m: any) => {
          if (m.key === 'word-count' && m.status === '维护') {
            return { ...m, status: '启用' }
          }
          return m
        })
        setModules(merged) 
      } catch {
        setModules(DEFAULT_TOOLS)
      } 
    })() 
  }, [])
  React.useEffect(() => { 
    try { 
      const raw = (settings as any).navigation; 
      const arr = raw ? JSON.parse(String(raw)) : []; 
      setNavItems(Array.isArray(arr) && arr.length > 0 ? arr : DEFAULT_NAV_ITEMS) 
    } catch {
      setNavItems(DEFAULT_NAV_ITEMS)
    } 
  }, [settings])

  

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
      case 'image-compression':
        return <ImageCompressionPage />
      case 'invoice-generator':
        return <InvoiceGenerator />
      case 'cpc-compass':
        return <CpcCalculator />
      case 'amazon-global':
        return <AmazonGlobalTool />
      case 'rating-sales-reverse':
        return <AmazonRatingSalesReverse />
      case 'max-reserve-fee':
        return <MaxReserveFeeCalculator />
      case 'keyword-strategy':
        return <KeywordStrategyTool />
      case 'search-term-volatility':
        return <SearchTermVolatilityTool />
      case 'partner-equity-calculator':
        return <PartnerEquityCalculator />
      case 'carton-calc-advanced':
        return <CartonCalculatorAdvanced />
      case 'natural-traffic-tool':
        return <NaturalTrafficTool />
      case 'fba-warehouses':
      return <FBAWarehouses />
    case 'fba-label-editor':
      return <FBALabelEditor />
    case 'amazon-promotion-stacking':
      return <AmazonPromotionStackingCalculator />
    case 'storage-fee-calc':
      return <StorageFeeCalculatorPage />
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
                            {catModules.map((m: any) => {
                              const I = iconMap[m.key] || Hammer
                              const label = titleOverride[m.key] || m.title
                              return (
                                <Link key={m.key} href={`/?tab=${m.key}`} className="flex items-center gap-2 w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-blue-50 hover:text-blue-600 rounded-lg transition-colors cursor-pointer">
                                  <I className="h-4 w-4" />
                                  <span>{label}</span>
                                </Link>
                              )
                            })}
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
          {settings.copyrightText || DEFAULT_SITE_SETTINGS.copyrightText}
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

