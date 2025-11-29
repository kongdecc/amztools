'use client'

import React, { useEffect, useState } from 'react'
import { LayoutDashboard, ChevronDown, Search } from 'lucide-react'
import { SettingsProvider, useSettings } from '@/components/SettingsProvider'

const Card = ({ children, className = "", onClick, ...props }: any) => (
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
}

function FunctionalityClient() {
  const [modules, setModules] = useState<Module[]>([])
  const [keyword, setKeyword] = useState('')
  const { settings } = useSettings()
  const [navItems, setNavItems] = useState<Array<any>>([])

  useEffect(() => {
    (async () => {
      const r = await fetch('/api/modules', { cache: 'no-store' })
      const d = await r.json()
      const arr: Module[] = Array.isArray(d) ? d : []
      setModules(arr.filter(m => m.status !== '下架').sort((a, b) => a.order - b.order))
    })()
  }, [])

  useEffect(() => {
    try {
      const raw = (settings as any).navigation
      const arr = raw ? JSON.parse(String(raw)) : []
      const items = Array.isArray(arr) ? arr : []
      setNavItems(items.filter((i:any) => i.active !== false))
    } catch {}
  }, [settings])

  const filtered = modules.filter(module => {
    if (!keyword.trim()) return true
    const k = keyword.trim().toLowerCase()
    return module.title.toLowerCase().includes(k) || module.desc.toLowerCase().includes(k)
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

  const handleNavigate = (key: string) => {
    window.location.href = `/?tab=${key}&full=1`
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <header className="h-14 bg-[#5b5bd6] text-white flex items-center px-10 shadow-md z-20">
        <div className={`flex items-center gap-2 font-bold text-lg`}>
          <div className="bg-white/20 p-1 rounded"><LayoutDashboard className="h-5 w-5" /></div>
          <span>{settings.siteName}</span>
        </div>
        <nav className="ml-auto mr-6 flex items-center gap-6">
          <a href="/" className="text-sm text-white/90 hover:text-white">首页</a>
          {navItems.map((item:any) => {
            const isFuncMenu = String(item.label || '').includes('功能分类') || String(item.id || '') === 'functionality'
            if (isFuncMenu) {
              return (
                <div key={item.id || 'function-menu'} className="relative group">
                  <button className="text-sm text-white/90 hover:text-white flex items-center gap-1">
                    {item.label || '功能分类'}
                    <ChevronDown className="h-4 w-4 transition-transform group-hover:rotate-180" />
                  </button>
                  <div className="absolute top-full right-0 mt-2 w-64 bg-white rounded-lg shadow-lg overflow-hidden z-50 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200">
                    <div className="p-2 space-y-1">
                      {modules.map((m: any) => (
                        <button 
                          key={m.key}
                          onClick={() => handleNavigate(m.key)}
                          className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-blue-50 hover:text-blue-600 rounded-lg transition-colors"
                        >
                          {m.title}
                        </button>
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
              <a key={item.id} href={item.href || '/'} className="text-sm text-white/90 hover:text-white">
                {item.label}
              </a>
            )
          })}
        </nav>
      </header>
      <div className="flex-1">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="text-center mb-12">
            <h1 className="text-4xl font-bold text-gray-900 mb-4">{settings.functionalityTitle || '功能中心'}</h1>
            <p className="text-lg text-gray-600 max-w-3xl mx-auto">
              {settings.functionalitySubtitle || '探索我们提供的所有工具和功能，帮助您更高效地管理亚马逊业务'}
            </p>
          </div>

          <div className="max-w-xl mx-auto relative z-10 mb-10">
            <Search className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
            <input 
              type="text" 
              placeholder="搜索工具，例如：竞价、大小写..." 
              className="w-full pl-10 pr-4 py-3 rounded-full border border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-sm"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filtered.map((module) => (
              <Card 
                key={module.key} 
                className="group relative p-6 hover:shadow-xl transition-all duration-300 cursor-pointer border-transparent hover:border-gray-100 bg-white overflow-hidden"
                onClick={() => handleNavigate(module.key)}
              >
                <div className="flex items-start gap-4 mb-4">
                  <div className={`w-12 h-12 rounded-xl ${colorSolidMap[module.color] || 'bg-blue-600'} flex items-center justify-center shadow-md shrink-0 group-hover:scale-105 transition-transform duration-300`}>
                    <LayoutDashboard className="h-6 w-6 text-white" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-gray-800 pt-1 group-hover:text-gray-900">
                      {module.status === '维护' ? `${module.title}（维护）` : module.title}
                    </h3>
                    {module.status === '维护' && (
                      <span className="ml-auto px-2 py-0.5 text-xs rounded border bg-yellow-50 text-yellow-600 border-yellow-200">
                        维护中
                      </span>
                    )}
                  </div>
                </div>
                <p className="text-sm text-gray-500 leading-relaxed mb-8 line-clamp-2">
                  {module.desc}
                </p>
                <div className={`absolute bottom-6 left-6 flex items-center gap-2 text-sm font-bold ${colorTextMap[module.color] || 'text-blue-600'} opacity-0 translate-y-4 group-hover:opacity-100 group-hover:translate-y-0 transition-all duration-300`}>
                  <span>立即使用</span>
                </div>
              </Card>
            ))}
          </div>

          {filtered.length === 0 && (
            <div className="text-center py-16 bg-white rounded-lg shadow-sm border border-gray-100">
              <p className="text-gray-500">没有找到匹配的功能</p>
            </div>
          )}
        </div>
      </div>
      
      {/* Footer */}
      <div className="mt-auto text-center py-6">
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
  );
}

export default function FunctionalityPage() {
  return (
    <SettingsProvider>
      <FunctionalityClient />
    </SettingsProvider>
  )
}
