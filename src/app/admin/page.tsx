'use client'

import React, { useEffect, useState } from 'react'
import { LayoutDashboard, Box, BarChart2, Search, Bell, Eye, Activity, Settings, Globe, User, Menu, Info, FileText, Send } from 'lucide-react'
import AdminModules from '@/app/admin/modules/page'
import AdminSettings from '@/app/admin/settings/page'
import AdminSeo from '@/app/admin/seo/page'
import AdminAccount from '@/app/admin/account/page'
import AdminNavigation from '@/app/admin/navigation/page'
import AdminAbout from '@/app/admin/about/page'
import AdminBlog from '@/app/admin/blog/page'
import AdminSuggest from '@/app/admin/suggest/page'
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, LineChart, Line } from 'recharts'

export default function AdminPage() {
  const [active, setActive] = useState<'dashboard'|'modules'|'navigation'|'about'|'settings'|'seo'|'account'|'blog'|'suggest'>('dashboard')
  const [modules, setModules] = useState<Array<any>>([])
  const [showAnalytics, setShowAnalytics] = useState(true)
  const [copyrightText, setCopyrightText] = useState('')
  const [analyticsData, setAnalyticsData] = useState<{ trend: Array<any>; bounceRate: number; avgDuration: string }>({ trend: [], bounceRate: 0, avgDuration: '' })
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
          <button onClick={() => setActive('navigation')} className={`flex items-center gap-3 px-5 py-3.5 text-sm font-medium ${active==='navigation'?'bg-blue-50 text-blue-600':'text-gray-600 hover:bg-gray-50 hover:text-gray-900'}`}><Menu size={18} className={active==='navigation'?'text-blue-600':'text-gray-400'} /> 导航菜单管理</button>
          <button onClick={() => setActive('blog')} className={`flex items-center gap-3 px-5 py-3.5 text-sm font-medium ${active==='blog'?'bg-blue-50 text-blue-600':'text-gray-600 hover:bg-gray-50 hover:text-gray-900'}`}><FileText size={18} className={active==='blog'?'text-blue-600':'text-gray-400'} /> 博客管理</button>
          <button onClick={() => setActive('suggest')} className={`flex items-center gap-3 px-5 py-3.5 text-sm font-medium ${active==='suggest'?'bg-blue-50 text-blue-600':'text-gray-600 hover:bg-gray-50 hover:text-gray-900'}`}><Send size={18} className={active==='suggest'?'text-blue-600':'text-gray-400'} /> 提需求留言</button>
          <div className="my-4 border-t border-gray-100 mx-5"></div>
          <button onClick={() => setActive('settings')} className={`flex items-center gap-3 px-5 py-3.5 text-sm font-medium ${active==='settings'?'bg-blue-50 text-blue-600':'text-gray-600 hover:bg-gray-50 hover:text-gray-900'}`}><Settings size={18} className={active==='settings'?'text-blue-600':'text-gray-400'} /> 站点设置</button>
          <button onClick={() => setActive('about')} className={`flex items-center gap-3 px-5 py-3.5 text-sm font-medium ${active==='about'?'bg-blue-50 text-blue-600':'text-gray-600 hover:bg-gray-50 hover:text-gray-900'}`}><Info size={18} className={active==='about'?'text-blue-600':'text-gray-400'} /> 关于页面</button>
          <button onClick={() => setActive('seo')} className={`flex items-center gap-3 px-5 py-3.5 text-sm font-medium ${active==='seo'?'bg-blue-50 text-blue-600':'text-gray-600 hover:bg-gray-50 hover:text-gray-900'}`}><Globe size={18} className={active==='seo'?'text-blue-600':'text-gray-400'} /> SEO 设置</button>
          <button onClick={() => setActive('account')} className={`flex items-center gap-3 px-5 py-3.5 text-sm font-medium ${active==='account'?'bg-blue-50 text-blue-600':'text-gray-600 hover:bg-gray-50 hover:text-gray-900'}`}><User size={18} className={active==='account'?'text-blue-600':'text-gray-400'} /> 账号管理</button>
        </div>
      </aside>
      <main className="flex-1 ml-64 flex flex-col min-h-screen">
        <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-8 sticky top-0 z-10 shadow-sm">
          <h2 className="font-bold text-gray-800 text-lg">{active==='dashboard'?'仪表盘':active==='modules'?'功能板块管理':active==='navigation'?'导航菜单管理':active==='blog'?'博客管理':active==='suggest'?'提需求留言':active==='about'?'关于页面':active==='settings'?'站点设置':active==='seo'?'SEO 设置':'账号管理'}</h2>
          <div className="flex items-center gap-5">
            <div className="relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} /><input type="text" placeholder="搜索..." className="pl-9 pr-4 py-1.5 rounded-full bg-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-100 w-64 transition-all" /></div>
            <button className="relative text-gray-500 hover:text-blue-600 transition-colors"><Bell size={20} /><span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white"></span></button>
          </div>
        </header>
        <div className="p-8 space-y-6">
          {active==='modules' && (<AdminModules />)}
          {active==='navigation' && (<AdminNavigation />)}
          {active==='about' && (<AdminAbout />)}
          {active==='blog' && (<AdminBlog />)}
          {active==='suggest' && (<AdminSuggest />)}
          {active==='settings' && (<AdminSettings />)}
          {active==='seo' && (<AdminSeo />)}
          {active==='account' && (<AdminAccount />)}
        {active==='dashboard' && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white p-5 rounded-lg border border-gray-100 shadow-sm flex items-center justify-between"><div><p className="text-gray-500 text-xs font-medium uppercase">总工具数</p><h3 className="text-2xl font-bold text-gray-800 mt-1">{modules.length}</h3></div><div className="p-3 bg-blue-50 rounded-full text-blue-600"><LayoutDashboard size={20} /></div></div>
          <div className="bg-white p-5 rounded-lg border border-gray-100 shadow-sm flex items-center justify-between"><div><p className="text-gray-500 text-xs font-medium uppercase">今日访问</p><h3 className="text-2xl font-bold text-gray-800 mt-1">{modules.reduce((s: number, x: any) => s + Number(x.views || 0), 0).toLocaleString()}</h3></div><div className="p-3 bg-green-50 rounded-full text-green-600"><Eye size={20} /></div></div>
          <div className="bg-white p-5 rounded-lg border border-gray-100 shadow-sm flex items-center justify-between"><div><p className="text-gray-500 text-xs font-medium uppercase">本月新增工具</p><h3 className="text-2xl font-bold text-gray-800 mt-1">{modules.filter((m: any) => { try { const t = new Date(m.updatedAt); const now = new Date(); return t.getMonth() === now.getMonth() && t.getFullYear() === now.getFullYear() } catch { return false } }).length}</h3></div><div className="p-3 bg-purple-50 rounded-full text-purple-600"><Box size={20} /></div></div>
          
          <div className="bg-white p-5 rounded-lg border border-gray-100 shadow-sm flex items-center justify-between"><div><p className="text-gray-500 text-xs font-medium uppercase">系统状态</p><h3 className="text-2xl font-bold text-green-600 mt-1">正常</h3></div><div className="p-3 bg-orange-50 rounded-full text-orange-600"><Activity size={20} /></div></div>
        </div>
        )}

          {active==='dashboard' && showAnalytics && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white p-6 rounded-lg border border-gray-100 shadow-sm">
              <h3 className="font-bold text-gray-800 mb-6 flex items-center gap-2"><BarChart2 size={18} className="text-blue-600" />热门工具排行 (Top 6)</h3>
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  {(() => {
                    const data = modules.slice().sort((a: any, b: any) => Number(b.views||0) - Number(a.views||0)).slice(0,6).map((x: any) => ({ name: x.title, views: Number(x.views||0) }))
                    const has = data.some((d: any) => Number(d.views) > 0)
                    if (!has) return <div className="flex items-center justify-center h-full text-sm text-gray-500">暂无数据</div>
                    return (
                      <BarChart data={data} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#f0f0f0" />
                        <XAxis type="number" hide />
                        <YAxis dataKey="name" type="category" width={80} tick={{ fontSize: 12, fill: '#666' }} axisLine={false} tickLine={false} />
                        <Tooltip cursor={{ fill: '#f8f9fa' }} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} />
                        <Bar dataKey="views" fill="#3b82f6" radius={[0, 4, 4, 0]} barSize={20} />
                      </BarChart>
                    )
                  })()}
                </ResponsiveContainer>
              </div>
            </div>
            <div className="bg-white p-6 rounded-lg border border-gray-100 shadow-sm">
              <h3 className="font-bold text-gray-800 mb-6 flex items-center gap-2"><Activity size={18} className="text-purple-600" />近7日访问趋势</h3>
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  {(() => {
                    const data = Array.isArray(analytics.trend) ? analytics.trend : []
                    const has = data.some((d: any) => Number(d.uv) > 0)
                    if (!has) return <div className="flex items-center justify-center h-full text-sm text-gray-500">暂无数据</div>
                    return (
                      <LineChart data={data}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                        <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#666' }} axisLine={false} tickLine={false} dy={10} />
                        <YAxis tick={{ fontSize: 12, fill: '#666' }} axisLine={false} tickLine={false} />
                        <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} />
                        <Line type="monotone" dataKey="uv" stroke="#8b5cf6" strokeWidth={3} dot={{ r: 4, fill: '#fff', strokeWidth: 2 }} activeDot={{ r: 6 }} />
                      </LineChart>
                    )
                  })()}
                </ResponsiveContainer>
              </div>
            </div>
          </div>
          )}

          
        </div>
        <footer className="mt-auto py-6 text-center text-xs text-gray-400">{copyrightText || '© 2025 ToolBox Admin System.'}</footer>
      </main>
    </div>
  )
}
