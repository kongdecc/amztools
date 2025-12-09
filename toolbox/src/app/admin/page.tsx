'use client'

import React, { useEffect, useState } from 'react'
import { LayoutDashboard, Box, BarChart2, Search, Bell, Eye, Activity, Settings, Globe, User, Menu, Info, FileText, Send, Calendar as CalendarIcon, Heart } from 'lucide-react'
import AdminModules from '@/app/admin/modules/page'
import AdminCategories from '@/app/admin/categories/page'
import AdminSettings from '@/app/admin/settings/page'
import AdminSeo from '@/app/admin/seo/page'
import AdminAccount from '@/app/admin/account/page'
import AdminNavigation from '@/app/admin/navigation/page'
import AdminAbout from '@/app/admin/about/page'
import AdminBlog from '@/app/admin/blog/page'
import AdminSuggest from '@/app/admin/suggest/page'
import AdminReward from '@/app/admin/reward/page'
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, LineChart, Line } from 'recharts'

export default function AdminPage() {
  const [active, setActive] = useState<'dashboard'|'modules'|'categories'|'navigation'|'about'|'settings'|'seo'|'account'|'blog'|'suggest'|'reward'>('dashboard')
  const [modules, setModules] = useState<Array<any>>([])
  const [showAnalytics, setShowAnalytics] = useState(true)
  const [copyrightText, setCopyrightText] = useState('')
  const [analyticsData, setAnalyticsData] = useState<{ trend: Array<any>; bounceRate: number; avgDuration: string }>({ trend: [], bounceRate: 0, avgDuration: '' })
  
  // Date Range State
  const formatDate = (date: Date) => {
    const y = date.getFullYear()
    const m = String(date.getMonth() + 1).padStart(2, '0')
    const d = String(date.getDate()).padStart(2, '0')
    return `${y}-${m}-${d}`
  }
  const todayStr = formatDate(new Date())
  const [dateRange, setDateRange] = useState({ start: todayStr, end: todayStr })
  const [rangeLabel, setRangeLabel] = useState('今日')
  const [visitStats, setVisitStats] = useState({ total: 0, byModule: {} })
  const [isCalendarOpen, setIsCalendarOpen] = useState(false)

  useEffect(() => {
    (async () => {
      try {
        const r = await fetch('/api/modules', { cache: 'no-store' })
        const d = await r.json()
        setModules(d || [])
      } catch (e) {
        console.error(e)
      }
    })()
  }, [])

  useEffect(() => {
    fetchVisitStats(dateRange.start, dateRange.end)
  }, [dateRange])

  const fetchVisitStats = async (start: string, end: string) => {
    try {
      const r = await fetch(`/api/analytics/visits?start=${start}&end=${end}`, { cache: 'no-store' })
      const d = await r.json()
      // console.log('Fetched stats:', start, end, d)
      setVisitStats(d || { total: 0, byModule: {} })
    } catch (e) {
      console.error('Failed to fetch stats:', e)
      setVisitStats({ total: 0, byModule: {} })
    }
  }

  const handleQuickSelect = (type: 'today' | 'yesterday' | '7d' | '30d' | '180d' | '365d') => {
    const today = new Date()
    let start = new Date()
    let end = new Date()
    let label = ''

    if (type === 'today') {
      label = '今日'
    } else if (type === 'yesterday') {
      start.setDate(today.getDate() - 1)
      end.setDate(today.getDate() - 1)
      label = '昨日'
    } else if (type === '7d') {
      start.setDate(today.getDate() - 6)
      label = '近7天'
    } else if (type === '30d') {
      start.setDate(today.getDate() - 29)
      label = '近30天'
    } else if (type === '180d') {
      start.setDate(today.getDate() - 179)
      label = '近半年'
    } else if (type === '365d') {
      start.setDate(today.getDate() - 364)
      label = '近一年'
    }

    const s = formatDate(start)
    const e = formatDate(end)
    setDateRange({ start: s, end: e })
    setRangeLabel(label)
    setIsCalendarOpen(false)
  }

  const handleCustomDateChange = (type: 'start' | 'end', val: string) => {
    const newRange = { ...dateRange, [type]: val }
    if (newRange.start > newRange.end) {
      if (type === 'start') newRange.end = val
      else newRange.start = val
    }
    setDateRange(newRange)
    setRangeLabel(`${newRange.start} 至 ${newRange.end}`)
  }

  useEffect(() => {
    (async () => {
      try {
        const r = await fetch('/api/settings', { cache: 'no-store' })
        const d = await r.json()
        const flag = String(d?.showAnalytics || 'false') === 'true'
        setShowAnalytics(flag)
        setCopyrightText(String(d?.copyrightText || ''))
        if (flag) {
          try {
            const a = await fetch('/api/analytics', { cache: 'no-store' })
            const ad = await a.json()
            if (Array.isArray(ad?.trend)) setAnalyticsData({ trend: ad.trend, bounceRate: Number(ad?.bounceRate || 0), avgDuration: String(ad?.avgDuration || '') })
          } catch {}
        }
      } catch {}
    })()
  }, [])

  const analytics = React.useMemo(() => {
    if (!showAnalytics) return { trend: [], bounceRate: 0, avgDuration: '' }
    if (Array.isArray(analyticsData.trend) && analyticsData.trend.length) return analyticsData
    const totalViews = modules.reduce((s: number, x: any) => s + Number(x.views || 0), 0)
    const enabledCount = modules.filter((m: any) => m.status === '启用').length
    const disabledCount = modules.length - enabledCount
    const bounceRate = Math.min(95, Math.max(5, Math.round((disabledCount / Math.max(1, modules.length)) * 10000) / 100))
    const avgSeconds = Math.max(30, Math.round(totalViews / Math.max(1, modules.length)))
    const avgDuration = `${Math.floor(avgSeconds / 60)}m ${avgSeconds % 60}s`
    const base = totalViews > 0 ? Math.max(5, Math.ceil(totalViews / 7)) : 0
    const week = ['周一','周二','周三','周四','周五','周六','周日']
    const trend = week.map((name, i) => ({ name, uv: Math.max(0, base + Math.round(Math.sin(i) * base * 0.2)) }))
    return { trend, bounceRate, avgDuration }
  }, [showAnalytics, modules, analyticsData])

  return (
    <div className="min-h-screen bg-[#f0f2f5] flex font-sans text-gray-800">
      <aside className="w-64 bg-white border-r border-gray-200 flex flex-col fixed h-full z-20 shadow-[2px_0_8px_-3px_rgba(0,0,0,0.1)]">
        <div className="h-16 flex items-center px-6 border-b border-gray-100">
          <div className="flex items-center gap-2.5">
            <div className="bg-blue-600 text-white p-1.5 rounded-lg"><LayoutDashboard size={20} /></div>
            <span className="font-bold text-lg text-gray-800 tracking-tight">ToolBox Admin</span>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto py-6 space-y-1">
          <button onClick={() => setActive('dashboard')} className={`flex items-center gap-3 px-5 py-3.5 text-sm font-medium ${active==='dashboard'?'bg-blue-50 text-blue-600':'text-gray-600 hover:bg-gray-50 hover:text-gray-900'}`}><LayoutDashboard size={18} className={active==='dashboard'?'text-blue-600':'text-gray-400'} /> 仪表盘</button>
          <button onClick={() => setActive('modules')} className={`flex items-center gap-3 px-5 py-3.5 text-sm font-medium ${active==='modules'?'bg-blue-50 text-blue-600':'text-gray-600 hover:bg-gray-50 hover:text-gray-900'}`}><Box size={18} className={active==='modules'?'text-blue-600':'text-gray-400'} /> 功能板块管理</button>
          <button onClick={() => setActive('categories')} className={`flex items-center gap-3 px-5 py-3.5 text-sm font-medium ${active==='categories'?'bg-blue-50 text-blue-600':'text-gray-600 hover:bg-gray-50 hover:text-gray-900'}`}><Menu size={18} className={active==='categories'?'text-blue-600':'text-gray-400'} /> 工具分类管理</button>
          <button onClick={() => setActive('navigation')} className={`flex items-center gap-3 px-5 py-3.5 text-sm font-medium ${active==='navigation'?'bg-blue-50 text-blue-600':'text-gray-600 hover:bg-gray-50 hover:text-gray-900'}`}><Menu size={18} className={active==='navigation'?'text-blue-600':'text-gray-400'} /> 导航菜单管理</button>
          <button onClick={() => setActive('blog')} className={`flex items-center gap-3 px-5 py-3.5 text-sm font-medium ${active==='blog'?'bg-blue-50 text-blue-600':'text-gray-600 hover:bg-gray-50 hover:text-gray-900'}`}><FileText size={18} className={active==='blog'?'text-blue-600':'text-gray-400'} /> 博客管理</button>
          <button onClick={() => setActive('suggest')} className={`flex items-center gap-3 px-5 py-3.5 text-sm font-medium ${active==='suggest'?'bg-blue-50 text-blue-600':'text-gray-600 hover:bg-gray-50 hover:text-gray-900'}`}><Send size={18} className={active==='suggest'?'text-blue-600':'text-gray-400'} /> 提需求留言</button>
          <button onClick={() => setActive('reward')} className={`flex items-center gap-3 px-5 py-3.5 text-sm font-medium ${active==='reward'?'bg-blue-50 text-blue-600':'text-gray-600 hover:bg-gray-50 hover:text-gray-900'}`}><Heart size={18} className={active==='reward'?'text-blue-600':'text-gray-400'} /> 打赏设置</button>
          <div className="my-4 border-t border-gray-100 mx-5"></div>
          <button onClick={() => setActive('settings')} className={`flex items-center gap-3 px-5 py-3.5 text-sm font-medium ${active==='settings'?'bg-blue-50 text-blue-600':'text-gray-600 hover:bg-gray-50 hover:text-gray-900'}`}><Settings size={18} className={active==='settings'?'text-blue-600':'text-gray-400'} /> 站点设置</button>
          <button onClick={() => setActive('about')} className={`flex items-center gap-3 px-5 py-3.5 text-sm font-medium ${active==='about'?'bg-blue-50 text-blue-600':'text-gray-600 hover:bg-gray-50 hover:text-gray-900'}`}><Info size={18} className={active==='about'?'text-blue-600':'text-gray-400'} /> 关于页面</button>
          <button onClick={() => setActive('seo')} className={`flex items-center gap-3 px-5 py-3.5 text-sm font-medium ${active==='seo'?'bg-blue-50 text-blue-600':'text-gray-600 hover:bg-gray-50 hover:text-gray-900'}`}><Globe size={18} className={active==='seo'?'text-blue-600':'text-gray-400'} /> SEO 设置</button>
          <button onClick={() => setActive('account')} className={`flex items-center gap-3 px-5 py-3.5 text-sm font-medium ${active==='account'?'bg-blue-50 text-blue-600':'text-gray-600 hover:bg-gray-50 hover:text-gray-900'}`}><User size={18} className={active==='account'?'text-blue-600':'text-gray-400'} /> 账号管理</button>
        </div>
      </aside>
      <main className="flex-1 ml-64 flex flex-col min-h-screen">
        <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-8 sticky top-0 z-10 shadow-sm">
          <h2 className="font-bold text-gray-800 text-lg">{active==='dashboard'?'仪表盘':active==='modules'?'功能板块管理':active==='categories'?'工具分类管理':active==='navigation'?'导航菜单管理':active==='blog'?'博客管理':active==='suggest'?'提需求留言':active==='reward'?'打赏设置':active==='about'?'关于页面':active==='settings'?'站点设置':active==='seo'?'SEO 设置':'账号管理'}</h2>
          <div className="flex items-center gap-5">
            <div className="relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} /><input type="text" placeholder="搜索..." className="pl-9 pr-4 py-1.5 rounded-full bg-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-100 w-64 transition-all" /></div>
            <button className="relative text-gray-500 hover:text-blue-600 transition-colors"><Bell size={20} /><span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white"></span></button>
          </div>
        </header>
        <div className="p-8 space-y-6">
          {active==='modules' && (<AdminModules />)}
          {active==='categories' && (<AdminCategories />)}
          {active==='navigation' && (<AdminNavigation />)}
          {active==='about' && (<AdminAbout />)}
          {active==='blog' && (<AdminBlog />)}
          {active==='suggest' && (<AdminSuggest />)}
          {active==='reward' && (<AdminReward />)}
          {active==='settings' && (<AdminSettings />)}
          {active==='seo' && (<AdminSeo />)}
          {active==='account' && (<AdminAccount />)}
        {active==='dashboard' && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white p-5 rounded-lg border border-gray-100 shadow-sm flex items-center justify-between"><div><p className="text-gray-500 text-xs font-medium uppercase">总工具数</p><h3 className="text-2xl font-bold text-gray-800 mt-1">{modules.length}</h3></div><div className="p-3 bg-blue-50 rounded-full text-blue-600"><LayoutDashboard size={20} /></div></div>
          <div className="bg-white p-5 rounded-lg border border-gray-100 shadow-sm flex items-center justify-between">
            <div className="relative">
              <p 
                className="text-gray-500 text-xs font-medium uppercase flex items-center gap-1 cursor-pointer hover:text-blue-600" 
                onClick={() => setIsCalendarOpen(!isCalendarOpen)}
              >
                {rangeLabel} 访问 <CalendarIcon size={12} />
              </p>
              {isCalendarOpen && (
                <div className="absolute top-6 left-0 bg-white border border-gray-200 shadow-lg rounded-lg p-4 z-20 min-w-[300px]">
                  <div className="grid grid-cols-3 gap-2 mb-4">
                    <button onClick={() => handleQuickSelect('today')} className="text-xs px-2 py-1 bg-gray-50 hover:bg-blue-50 text-gray-600 hover:text-blue-600 rounded transition-colors">今日</button>
                    <button onClick={() => handleQuickSelect('yesterday')} className="text-xs px-2 py-1 bg-gray-50 hover:bg-blue-50 text-gray-600 hover:text-blue-600 rounded transition-colors">昨日</button>
                    <button onClick={() => handleQuickSelect('7d')} className="text-xs px-2 py-1 bg-gray-50 hover:bg-blue-50 text-gray-600 hover:text-blue-600 rounded transition-colors">近7天</button>
                    <button onClick={() => handleQuickSelect('30d')} className="text-xs px-2 py-1 bg-gray-50 hover:bg-blue-50 text-gray-600 hover:text-blue-600 rounded transition-colors">近30天</button>
                    <button onClick={() => handleQuickSelect('180d')} className="text-xs px-2 py-1 bg-gray-50 hover:bg-blue-50 text-gray-600 hover:text-blue-600 rounded transition-colors">近半年</button>
                    <button onClick={() => handleQuickSelect('365d')} className="text-xs px-2 py-1 bg-gray-50 hover:bg-blue-50 text-gray-600 hover:text-blue-600 rounded transition-colors">近一年</button>
                  </div>
                  <div className="flex items-center gap-2 mb-3">
                    <input 
                      type="date" 
                      value={dateRange.start} 
                      onChange={(e) => handleCustomDateChange('start', e.target.value)}
                      className="w-full text-xs border border-gray-300 rounded p-1.5 focus:outline-none focus:border-blue-500 transition-colors"
                    />
                    <span className="text-gray-400">-</span>
                    <input 
                      type="date" 
                      value={dateRange.end} 
                      onChange={(e) => handleCustomDateChange('end', e.target.value)}
                      className="w-full text-xs border border-gray-300 rounded p-1.5 focus:outline-none focus:border-blue-500 transition-colors"
                    />
                  </div>
                  <div className="text-right border-t border-gray-100 pt-2">
                      <button onClick={() => setIsCalendarOpen(false)} className="text-xs text-blue-600 hover:text-blue-800 font-medium">关闭</button>
                  </div>
                </div>
              )}
              <h3 className="text-2xl font-bold text-gray-800 mt-1">{visitStats.total.toLocaleString()}</h3>
            </div>
            <div className="p-3 bg-green-50 rounded-full text-green-600"><Eye size={20} /></div>
          </div>
          <div className="bg-white p-5 rounded-lg border border-gray-100 shadow-sm flex items-center justify-between"><div><p className="text-gray-500 text-xs font-medium uppercase">本月新增工具</p><h3 className="text-2xl font-bold text-gray-800 mt-1">{modules.filter((m: any) => { try { const t = new Date(m.updatedAt); const now = new Date(); return t.getMonth() === now.getMonth() && t.getFullYear() === now.getFullYear() } catch { return false } }).length}</h3></div><div className="p-3 bg-purple-50 rounded-full text-purple-600"><Box size={20} /></div></div>
          
          <div className="bg-white p-5 rounded-lg border border-gray-100 shadow-sm flex items-center justify-between"><div><p className="text-gray-500 text-xs font-medium uppercase">系统状态</p><h3 className="text-2xl font-bold text-green-600 mt-1">正常</h3></div><div className="p-3 bg-orange-50 rounded-full text-orange-600"><Activity size={20} /></div></div>
        </div>
        )}

          {active==='dashboard' && showAnalytics && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white p-6 rounded-lg border border-gray-100 shadow-sm">
              <h3 className="font-bold text-gray-800 mb-6 flex items-center gap-2"><BarChart2 size={18} className="text-blue-600" />热门工具排行 (Top 6)</h3>
              {(() => {
                const top = modules.slice().sort((a: any, b: any) => Number(b.views||0) - Number(a.views||0)).slice(0,6)
                if (!top.length) return <div className="h-64 w-full flex items-center justify-center text-sm text-gray-500">暂无数据</div>
                const max = Math.max(0, ...top.map((x: any) => Number(x.views || 0)))
                return (
                  <ul className="space-y-4">
                    {top.map((m: any, i: number) => (
                      <li key={m.key || i} className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <span className="w-7 h-7 rounded-md bg-blue-50 text-blue-600 text-xs font-bold flex items-center justify-center">{i+1}</span>
                          <span className="text-sm font-medium text-gray-800">{m.title}</span>
                          <span className={`text-xs px-2 py-0.5 rounded ${String(m.status)==='启用'?'bg-green-50 text-green-600':String(m.status)==='维护'?'bg-yellow-50 text-yellow-600':'bg-gray-50 text-gray-500'}`}>{m.status}</span>
                        </div>
                        <div className="flex items-center gap-3 min-w-[200px]">
                          <div className="w-32 h-2 bg-gray-100 rounded overflow-hidden">
                            <div className="h-2 bg-blue-500" style={{ width: `${max>0? Math.round(Number(m.views||0)/max*100) : 0}%` }} />
                          </div>
                          <span className="text-sm text-gray-600">{Number(m.views||0).toLocaleString()}</span>
                        </div>
                      </li>
                    ))}
                  </ul>
                )
              })()}
            </div>

          </div>
          )}

          
        </div>
        <footer className="mt-auto py-6 text-center text-xs text-gray-400">{copyrightText || '© 2025 ToolBox Admin System.'}</footer>
      </main>
    </div>
  )
}
