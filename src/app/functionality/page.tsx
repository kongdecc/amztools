'use client'

import React, { useEffect, useState } from 'react'
import { LayoutDashboard, Search } from 'lucide-react'

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

export default function FunctionalityPage() {
  const [modules, setModules] = useState<Module[]>([])
  const [keyword, setKeyword] = useState('')

  useEffect(() => {
    (async () => {
      const r = await fetch('/api/modules', { cache: 'no-store' })
      const d = await r.json()
      const arr: Module[] = Array.isArray(d) ? d : []
      setModules(arr.filter(m => m.status !== '下架').sort((a, b) => a.order - b.order))
    })()
  }, [])

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
    window.location.href = `/?tab=${key}`
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">功能中心</h1>
          <p className="text-lg text-gray-600 max-w-3xl mx-auto">
            探索我们提供的所有工具和功能，帮助您更高效地管理亚马逊业务
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
  );
}
