'use client'

import React, { useEffect, useState } from 'react'
import { LayoutDashboard, Calculator, Type, Scale, CaseSensitive, ListOrdered, BarChart3, Truck, Search, ChevronDown, Hammer, ArrowLeftRight } from 'lucide-react'
import { useSettings } from '@/components/SettingsProvider'
import Head from 'next/head'
import Link from 'next/link'

const Card = ({ children, className = "", onClick, ...props }: any) => (
  <div onClick={onClick} className={`bg-white rounded-xl border border-gray-100 shadow-sm ${className}`} {...props}>{children}</div>
)

const Input = ({ className = "", ...props }: any) => (
  <input className={`flex h-9 w-full rounded-md border border-gray-300 bg-transparent px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-gray-400 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-indigo-500 disabled:cursor-not-allowed disabled:opacity-50 ${className}`} {...props} />
)

const HomePage = ({ onNavigate, modules }: { onNavigate: (id: string) => void; modules: Array<any> }) => {
  const { settings } = useSettings()
  const safeOrigin = (typeof window !== 'undefined' && (window as any).location) ? (window as any).location.origin : ''
  const iconMap: Record<string, any> = {
    'ad-calc': Calculator,
    'editor': Type,
    'unit': Scale,
    'case': CaseSensitive,
    'word-count': ListOrdered,
    'char-count': BarChart3,
    'delivery': Truck,
  }
  const colorSolidMap: Record<string, string> = {
    blue: 'bg-blue-600',
    indigo: 'bg-indigo-600',
    cyan: 'bg-cyan-600',
    violet: 'bg-violet-600',
    sky: 'bg-sky-500',
    purple: 'bg-indigo-500',
    orange: 'bg-orange-500',
  }
  const colorTextMap: Record<string, string> = {
    blue: 'text-blue-600',
    indigo: 'text-indigo-600',
    cyan: 'text-cyan-600',
    violet: 'text-violet-600',
    sky: 'text-sky-500',
    purple: 'text-indigo-500',
    orange: 'text-orange-500',
  }
  const visible = modules.filter((m: any) => m.status !== '下架')
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
          <input type="text" placeholder="搜索工具，例如：竞价、大小写..." className="w-full pl-10 pr-4 py-3 rounded-full border border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-sm" />
        </div>
      </Card>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {visible.map((tool: any) => (
          <Card key={tool.key} className="group relative p-6 hover:shadow-xl transition-all duration-300 cursor-pointer border-transparent hover:border-gray-100 bg-white overflow-hidden" onClick={() => onNavigate(tool.key)}>
            <div className="flex items-start gap-4 mb-4">
              <div className={`w-12 h-12 rounded-xl ${colorSolidMap[tool.color] || 'bg-blue-600'} flex items-center justify-center shadow-md shrink-0 group-hover:scale-105 transition-transform duration-300`}>
                {(() => {
                  const I = iconMap[tool.key] || Hammer
                  return <I className="h-6 w-6 text-white" />
                })()}
              </div>
              <h3 className="text-lg font-bold text-gray-800 pt-1 group-hover:text-gray-900">{tool.title}</h3>
              {tool.status === '维护' && <span className="ml-auto px-2 py-0.5 text-xs rounded border bg-yellow-50 text-yellow-600 border-yellow-200">维护中</span>}
            </div>
            <p className="text-sm text-gray-500 leading-relaxed mb-8 line-clamp-2">{tool.desc}</p>
            <div className={`absolute bottom-6 left-6 flex items-center gap-2 text-sm font-bold ${colorTextMap[tool.color] || 'text-blue-600'} opacity-0 translate-y-4 group-hover:opacity-100 group-hover:translate-y-0 transition-all duration-300`}>
              <span>立即使用</span>
              <ArrowLeftRight className="h-4 w-4" />
            </div>
          </Card>
        ))}
      </div>
    </div>
  )
}

const AdCalculatorPage = () => {
  const renderRow = (strategyLabel: string, position: string, multiplier: string, isFirst = false) => (
    <tr className="text-sm border-b border-gray-200 hover:bg-gray-50">
      {isFirst && (
        <td className={`p-3 border-r border-gray-200 font-medium ${strategyLabel.includes('Fixed') ? 'text-red-500' : strategyLabel.includes('up') ? 'text-purple-600' : 'text-blue-500'}`}>{strategyLabel.split(' ')[0]} bids</td>
      )}
      {!isFirst && <td className="border-r border-gray-200"></td>}
      <td className="p-3 border-r border-gray-200 text-center text-gray-700">{position}</td>
      <td className="p-3 border-r border-gray-200 text-center text-gray-700">{multiplier}</td>
      <td className="p-2 border-r border-gray-200"><Input placeholder="0" className="text-center" /></td>
      <td className="p-2 border-r border-gray-200"><Input placeholder="0" className="text-center" /></td>
      <td className="p-2 border-r border-gray-200"><Input placeholder="0" className="text-center" /></td>
      <td className="p-2 border-r border-gray-200"><Input placeholder="0" className="text-center" /></td>
      <td className="p-3 border-r border-gray-200 bg-red-50/30"></td>
      <td className="p-3 bg-red-50/30"></td>
    </tr>
  )
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 mb-2">
        <Calculator className="h-6 w-6 text-blue-600" />
        <h2 className="text-xl font-bold text-gray-800">广告竞价计算</h2>
      </div>
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-indigo-50/50 text-sm font-semibold text-gray-700 border-b border-gray-200">
                <th className="p-3 border-r border-gray-200 text-left w-32">系列竞价策略</th>
                <th className="p-3 border-r border-gray-200 w-32">位置</th>
                <th className="p-3 border-r border-gray-200 w-20">最高倍数</th>
                <th className="p-3 border-r border-gray-200 w-24">原出价</th>
                <th className="p-3 border-r border-gray-200 w-24">新出价</th>
                <th className="p-3 border-r border-gray-200 w-24">原百分比</th>
                <th className="p-3 border-r border-gray-200 w-24">新百分比</th>
                <th className="p-3 border-r border-gray-200 w-20">原CPC</th>
                <th className="p-3 w-20">新CPC</th>
              </tr>
            </thead>
            <tbody>
              <tr className="bg-red-50 border-b border-red-100">
                <td colSpan={9} className="p-2 text-xs font-bold text-red-600 pl-3">Fixed bids (固定竞价)</td>
              </tr>
              {renderRow('Fixed bids', 'TOP', '1', true)}
              {renderRow('Fixed bids', 'Product pages', '1')}
              {renderRow('Fixed bids', 'Rest of search', '1')}
              <tr className="bg-purple-50 border-b border-purple-100">
                <td colSpan={9} className="p-2 text-xs font-bold text-purple-600 pl-3">up and down (动态竞价-提高和降低)</td>
              </tr>
              {renderRow('up and down', 'TOP', '2', true)}
              {renderRow('up and down', 'Product pages', '1.5')}
              {renderRow('up and down', 'Rest of search', '1.5')}
              <tr className="bg-blue-50 border-b border-blue-100">
                <td colSpan={9} className="p-2 text-xs font-bold text-blue-600 pl-3">down only (动态竞价-仅降低)</td>
              </tr>
              {renderRow('down only', 'TOP', '1', true)}
              {renderRow('down only', 'Product pages', '1')}
              {renderRow('down only', 'Rest of search', '1')}
            </tbody>
          </table>
        </div>
        <div className="p-4 bg-gray-50 text-xs text-gray-500 space-y-1 border-t border-gray-200">
          <p className="font-medium mb-1">说明：</p>
          <ul className="list-disc list-inside space-y-1 ml-1">
            <li>输入原出价/新出价/原百分比/新百分比，会自动计算对应的原CPC和新CPC。</li>
            <li>实际最高CPC = Bid × (1 + 百分比/100) × 最高倍数。</li>
          </ul>
        </div>
      </Card>
    </div>
  )
}

const UnitConverterPage = () => {
  const UnitGroup = ({ title, units }: { title: string; units: { label: string }[] }) => (
    <div className="space-y-4">
      <h3 className="font-bold text-gray-700 text-sm">{title}</h3>
      <div className="space-y-3">
        {units.map(unit => (
          <div key={unit.label} className="flex items-center gap-3">
            <label className="w-24 text-sm text-gray-600">{unit.label}</label>
            <Input />
          </div>
        ))}
      </div>
    </div>
  )
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 mb-2">
        <Scale className="h-6 w-6 text-blue-600" />
        <h2 className="text-xl font-bold text-gray-800">单位换算</h2>
      </div>
      <Card className="p-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
          <UnitGroup title="长度换算 (cm/in/m/ft/mm)" units={[{ label: '厘米 (cm)' }, { label: '英寸 (in)' }, { label: '米 (m)' }, { label: '英尺 (ft)' }, { label: '毫米 (mm)' }]} />
          <UnitGroup title="重量换算 (kg/oz/g/lb/t)" units={[{ label: '公斤 (kg)' }, { label: '盎司 (oz)' }, { label: '克 (g)' }, { label: '磅 (lb)' }, { label: '吨 (t)' }]} />
          <UnitGroup title="体积换算 (m³/L/mL/ft³/gal)" units={[{ label: '立方米 (m³)' }, { label: '升 (L)' }, { label: '毫升 (mL)' }, { label: '立方英尺 (ft³)' }, { label: '加仑 (gal)' }]} />
        </div>
      </Card>
    </div>
  )
}

const PlaceholderPage = ({ title, icon: Icon }: { title: string; icon: any }) => (
  <div className="space-y-6">
    <div className="flex items-center gap-2 mb-2">
      <Icon className="h-6 w-6 text-gray-400" />
      <h2 className="text-xl font-bold text-gray-800">{title}</h2>
    </div>
    <Card className="h-[60vh] flex flex-col items-center justify-center text-gray-400 bg-gray-50/50 border-dashed">
      <div className="p-6 bg-white rounded-full shadow-sm mb-6">
        <Hammer className="h-12 w-12 text-indigo-200" />
      </div>
      <h3 className="text-lg font-medium text-gray-600 mb-2">功能开发中</h3>
      <p className="text-sm text-gray-400 max-w-xs text-center">这个工具模块正在紧锣密鼓地开发中，<br/>请稍后回来查看更新。</p>
    </Card>
  </div>
)

export default function HomeLayoutClient({ initialModules, initialNavItems }: { initialModules: any[]; initialNavItems: any[] }) {
  const [activeTab, setActiveTab] = useState('home')
  const [modules, setModules] = useState<Array<any>>(initialModules || [])
  const [navItems, setNavItems] = useState<Array<any>>(initialNavItems || [])
  
  const iconMap: Record<string, any> = {
    'ad-calc': Calculator,
    'editor': Type,
    'unit': Scale,
    'case': CaseSensitive,
    'word-count': ListOrdered,
    'char-count': BarChart3,
    'delivery': Truck,
  }
  const menuItems = [
    { id: 'home', label: '首页', icon: LayoutDashboard },
    ...modules.filter((m: any) => m.status !== '下架').map((m: any) => ({ id: m.key, label: m.status === '维护' ? `${m.title}（维护）` : m.title, icon: iconMap[m.key] || Hammer }))
  ]
  useEffect(() => {
    if (activeTab && activeTab !== 'home') {
      try { fetch('/api/modules', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ key: activeTab }) }) } catch {}
    }
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
      <header className="h-14 bg-[#5b5bd6] text-white flex items-center px-10 shadow-md z-20">
        <div className={`flex items-center gap-2 font-bold text-lg`}>
          <div className="bg-white/20 p-1 rounded"><LayoutDashboard className="h-5 w-5" /></div>
          <span>{settings.siteName}</span>
        </div>
        <nav className="ml-auto mr-6 flex items-center gap-6">
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
      <div className="flex flex-1">
        <aside className="w-64 bg-white border-r border-gray-200 flex-shrink-0 hidden md:flex flex-col">
          <div className="p-4 space-y-1 flex-1 overflow-y-auto">
            {menuItems.map(item => (
              <button key={item.id} onClick={() => setActiveTab(item.id)} className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-lg transition-colors ${activeTab === item.id ? 'bg-blue-50 text-blue-600' : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'}`}>
                <item.icon className={`h-5 w-5 ${activeTab === item.id ? 'text-blue-600' : 'text-gray-400'}`} />
                {item.label}
                {activeTab === item.id && <div className="ml-auto w-1.5 h-1.5 rounded-full bg-blue-600" />}
              </button>
            ))}
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
        <main className="flex-1 p-8 overflow-y-auto h-[calc(100vh-3.5rem)]">
          <div className="max-w-6xl mx-auto">
            {activeTab === 'home' ? (
              <HomePage onNavigate={setActiveTab} modules={modules} />
            ) : (
              (() => {
                if (activeTab === 'ad-calc') return <AdCalculatorPage />
                if (activeTab === 'unit') return <UnitConverterPage />
                if (activeTab === 'editor') return <PlaceholderPage title="可视化编辑器" icon={Type} />
                if (activeTab === 'case') return <PlaceholderPage title="大小写转换" icon={CaseSensitive} />
                if (activeTab === 'word-count') return <PlaceholderPage title="词频统计" icon={ListOrdered} />
                if (activeTab === 'char-count') return <PlaceholderPage title="字符统计" icon={BarChart3} />
                if (activeTab === 'delivery') return <PlaceholderPage title="美国站配送费计算" icon={Truck} />
                return <PlaceholderPage title="功能开发中" icon={Hammer} />
              })()
            )}
          </div>
          <div className="mt-12 text-center">
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
        </main>
      </div>
    </div>
  )
}
