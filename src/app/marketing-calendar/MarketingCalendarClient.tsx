'use client'

import React, { useState, useMemo, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ChevronDown, MoreHorizontal, ArrowUp } from 'lucide-react'
import eventsData from './calendar-data.json'

interface MarketingCalendarClientProps {
  settings: Record<string, any>
  navItems: any[]
  categories: any[]
  modules: any[]
}

const MarketingCalendarClient = ({ settings, navItems, categories, modules }: MarketingCalendarClientProps) => {
  const router = useRouter()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [monthFilter, setMonthFilter] = useState('all')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [quickFilter, setQuickFilter] = useState('all')
  const [showBackToTop, setShowBackToTop] = useState(false)

  // Header Logic - Handle navigation
  const handleNavigate = (id: string) => {
    if (id === 'home') {
      router.push('/')
    } else {
      router.push(`/?tab=${id}`)
    }
  }

  // Calendar Logic
  const solarTerms = ["立春", "雨水", "惊蛰", "春分", "清明", "谷雨", "立夏", "小满", "芒种", "夏至", "小暑", "大暑", "立秋", "处暑", "白露", "秋分", "寒露", "霜降", "立冬", "小雪", "大雪", "冬至", "小寒", "大寒"];
  const usCommonHolidays = [
      '元旦', 'New Year', '情人', 'Valentine', '复活', 'Easter', '母亲', 'Mother', '父亲', 'Father',
      '万圣', 'Halloween', '感恩', 'Thanksgiving', '圣诞', 'Christmas', '黑五', 'Black Friday',
      '黑色星期五', '网一', 'Cyber Monday', '网络星期一', '超级碗', 'Super Bowl', '亚马逊', 'Prime',
      '返校', 'School', '马丁·路德·金', '总统日', '独立日'
  ];

  const filteredEvents = useMemo(() => {
    const term = searchTerm.toLowerCase()
    return eventsData.filter((event: any) => {
        const matchesSearch = event.content.toLowerCase().includes(term) || 
                              event.date_str.toLowerCase().includes(term) ||
                              event.lunar.toLowerCase().includes(term);
        
        let matchesMonth = false;
        if (monthFilter === 'all') {
            matchesMonth = true;
        } else if (monthFilter.startsWith('q')) {
            const quarter = parseInt(monthFilter.substring(1));
            const startMonth = (quarter - 1) * 3 + 1;
            const endMonth = startMonth + 2;
            matchesMonth = event.month >= startMonth && event.month <= endMonth;
        } else {
            matchesMonth = event.month == monthFilter;
        }
        
        let matchesCategory = false;
        if (categoryFilter === 'all') {
            matchesCategory = true;
        } else if (categoryFilter === 'solar_term') {
            matchesCategory = event.category_code === 'solar_term';
        } else {
            matchesCategory = event.category_code === categoryFilter;
        }
        
        let matchesQuickFilter = true;
        if (quickFilter === 'us') {
            const isExplicitUS = event.content.includes('美') || event.content.includes('USA');
            let isCommonHoliday = usCommonHolidays.some(keyword => event.content.includes(keyword));
            if (isCommonHoliday) {
                const otherCountryIndicators = ['(', '（'];
                if (otherCountryIndicators.some(indicator => event.content.includes(indicator))) {
                    const isUSInBracket = event.content.includes('(美)') || event.content.includes('（美）') || 
                                        event.content.includes('(USA)') || event.content.includes('（USA）');
                    if (!isUSInBracket) {
                        isCommonHoliday = false;
                    }
                }
            }
            matchesQuickFilter = isExplicitUS || isCommonHoliday;
        } else if (quickFilter === 'jp') {
            matchesQuickFilter = event.content.includes('日本') || event.content.includes('(日)');
        }

        return matchesSearch && matchesMonth && matchesCategory && matchesQuickFilter;
    })
  }, [searchTerm, monthFilter, categoryFilter, quickFilter])

  const eventsByMonth = useMemo(() => {
      const grouped: Record<number, any[]> = {};
      filteredEvents.forEach((event: any) => {
          if (!grouped[event.month]) grouped[event.month] = [];
          grouped[event.month].push(event);
      });
      return grouped;
  }, [filteredEvents]);

  const calculateDaysLeft = (dateStr: string) => {
    const match = dateStr.match(/(\d+)月(\d+)日/);
    if (!match) return null;
    const month = parseInt(match[1]);
    const day = parseInt(match[2]);
    const now = new Date();
    const currentYear = now.getFullYear();
    let targetDate = new Date(currentYear, month - 1, day);
    now.setHours(0, 0, 0, 0);
    targetDate.setHours(0, 0, 0, 0);
    if (targetDate < now) {
        targetDate.setFullYear(currentYear + 1);
    }
    const diffTime = targetDate.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
    return diffDays;
  }

  // Scroll to top logic
  useEffect(() => {
    const handleScroll = () => {
        if (window.scrollY > 300) {
            setShowBackToTop(true)
        } else {
            setShowBackToTop(false)
        }
    }
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleCopy = (text: string) => {
      navigator.clipboard.writeText(text).catch(console.error)
  }

  // CSS Variables mapped to styles
  const categoryStyles: Record<string, string> = {
    statutory: 'bg-[#fef2f2] text-[#ef4444] border-[#fca5a5]',
    overseas: 'bg-[#eff6ff] text-[#3b82f6] border-[#93c5fd]',
    promotion: 'bg-[#f3e8ff] text-[#a855f7] border-[#d8b4fe]',
    other: 'bg-[#f1f5f9] text-[#64748b] border-[#cbd5e1]',
    solar_term: 'bg-[#f0fdf4] text-[#16a34a] border-[#bbf7d0]',
  }

  return (
    <div className="min-h-screen bg-[#f8fafc] font-sans text-[#1e293b] flex flex-col">
      <style jsx global>{`
        .month-title::before {
            content: '';
            position: absolute;
            left: 0;
            top: 50%;
            transform: translateY(-50%);
            width: 6px;
            height: 24px;
            background-color: #3b82f6;
            border-radius: 3px;
        }
      `}</style>

      {/* Header - Matching Homepage */}
      <header className="bg-gradient-to-r from-indigo-600 to-purple-600 shadow-lg sticky top-0 z-50">
        <div className="max-w-[1920px] mx-auto px-4 h-16 flex items-center justify-between">
            <div className="flex items-center gap-8">
                <div onClick={() => router.push('/')} className="flex items-center gap-2 cursor-pointer group">
                    <div className="bg-white p-1.5 rounded-lg shadow-lg group-hover:scale-110 transition-transform duration-300">
                        <span className="text-2xl">📦</span>
                    </div>
                    <div>
                        <h1 className="text-xl font-bold text-white tracking-tight">{settings.siteTitle || '运营魔方 ToolBox'}</h1>
                        <p className="text-[10px] text-indigo-100 uppercase tracking-wider font-medium">{settings.siteSubtitle || 'AMAZON SELLER TOOLS'}</p>
                    </div>
                </div>

                <nav className="hidden md:flex items-center gap-1">
                    <button onClick={() => router.push('/')} className="px-4 py-2 text-sm font-medium text-white/90 hover:text-white hover:bg-white/10 rounded-lg transition-all">首页</button>
                    {navItems
                    .slice()
                    .sort((a: any, b: any) => Number(a.order || 0) - Number(b.order || 0))
                    .map((item: any) => {
                        const isFuncMenu = String(item.label || '').includes('功能分类') || String(item.id || '') === 'functionality'
                        if (isFuncMenu) {
                            return (
                                <div key={item.id} className="relative group">
                                    <button className="px-4 py-2 text-sm font-medium text-white/90 hover:text-white hover:bg-white/10 rounded-lg transition-all flex items-center gap-1">
                                        {item.label || '功能分类'}
                                        <ChevronDown className="h-4 w-4 transition-transform group-hover:rotate-180" />
                                    </button>
                                    <div className="absolute top-full left-0 mt-2 w-[600px] bg-white rounded-xl shadow-xl overflow-hidden z-50 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 border border-gray-100">
                                        <div className="p-4 grid grid-cols-3 gap-4">
                                            {categories.map((cat: any) => {
                                                const catModules = modules.filter((m: any) => m.status !== '下架' && (m.category === cat.key || (!m.category && cat.key === 'image-text')))
                                                if (catModules.length === 0) return null
                                                return (
                                                    <div key={cat.key}>
                                                        <div className="px-3 py-1 text-xs font-semibold text-gray-400 uppercase mb-2">{cat.label}</div>
                                                        <div className="space-y-1">
                                                            {catModules.map((m: any) => (
                                                                <button 
                                                                    key={m.key}
                                                                    onClick={() => handleNavigate(m.key)}
                                                                    className="block w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-blue-50 hover:text-blue-600 rounded-lg transition-colors"
                                                                >
                                                                    {m.title}
                                                                </button>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )
                                            })}
                                        </div>
                                    </div>
                                </div>
                            )
                        }
                        
                        // Other nav items
                        if (item.children && item.children.length > 0) {
                             return (
                                <div key={item.id} className="relative group">
                                    <button className="px-4 py-2 text-sm font-medium text-white/90 hover:text-white hover:bg-white/10 rounded-lg transition-all flex items-center gap-1">
                                        {item.label}
                                        <ChevronDown className="h-4 w-4 transition-transform group-hover:rotate-180" />
                                    </button>
                                    <div className="absolute top-full left-0 mt-2 w-48 bg-white rounded-lg shadow-xl overflow-hidden z-50 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200">
                                        <div className="py-2">
                                            {item.children.map((child: any) => (
                                                <button 
                                                    key={child.id}
                                                    onClick={() => child.isExternal ? window.open(child.href, '_blank') : (child.href ? router.push(child.href) : handleNavigate(child.id))}
                                                    className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-blue-50 hover:text-blue-600"
                                                >
                                                    {child.label}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                             )
                        }

                        return (
                            <button 
                                key={item.id}
                                onClick={() => item.isExternal ? window.open(item.href, '_blank') : (item.href ? router.push(item.href) : handleNavigate(item.id))}
                                className="px-4 py-2 text-sm font-medium text-white/90 hover:text-white hover:bg-white/10 rounded-lg transition-all"
                            >
                                {item.label}
                            </button>
                        )
                    })}
                </nav>
            </div>

            {/* Mobile Menu Button */}
            <div className="md:hidden">
                 <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="p-2 text-white hover:bg-white/10 rounded-lg">
                    <MoreHorizontal className="h-6 w-6" />
                 </button>
            </div>
        </div>

        {/* Mobile Menu */}
        {mobileMenuOpen && (
            <>
                <div className="fixed inset-0 z-40 bg-black/20 md:hidden" onClick={() => setMobileMenuOpen(false)}></div>
                <div className="absolute top-full right-0 mt-2 w-48 bg-white rounded-lg shadow-xl py-2 z-50 text-gray-800 animate-in fade-in zoom-in-95 duration-200 max-h-[80vh] overflow-y-auto mr-2 md:hidden">
                  <button onClick={() => { router.push('/'); setMobileMenuOpen(false); }} className="block w-full text-left px-4 py-2 text-sm hover:bg-gray-50 font-medium text-blue-600">首页</button>
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
      </header>

      {/* Main Content */}
      <main className="flex-1 w-full max-w-[1200px] mx-auto p-5 md:p-10">
        <div className="text-center mb-10">
            <h1 className="text-[#0f172a] text-4xl font-bold mb-2 tracking-tight">📅 2026年电商营销日历</h1>
            <p className="text-[#64748b] text-lg">全览节日、促销节点与重要活动</p>
        </div>

        {/* Controls */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-[#e2e8f0] sticky top-20 z-40 flex flex-wrap gap-5 items-center">
            <div className="flex-[1_1_300px] relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#64748b]">🔍</span>
                <input 
                    type="text" 
                    placeholder="搜索节日、活动或日期..." 
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 border border-[#e2e8f0] rounded-xl text-[15px] outline-none transition-all focus:border-blue-500 focus:shadow-[0_0_0_3px_rgba(59,130,246,0.1)] bg-[#f8fafc] focus:bg-white"
                />
            </div>
            
            <div className="flex gap-3 flex-wrap items-center">
                <div className="flex gap-2 flex-wrap justify-center">
                    <button 
                        onClick={() => setQuickFilter('all')}
                        className={`px-4 py-2 rounded-full text-sm border font-medium transition-all ${quickFilter === 'all' ? 'bg-blue-500 text-white border-blue-500' : 'bg-white text-[#64748b] border-[#e2e8f0] hover:bg-[#f1f5f9] hover:text-[#1e293b]'}`}
                    >
                        全部
                    </button>
                    <button 
                        onClick={() => setQuickFilter('us')}
                        className={`px-4 py-2 rounded-full text-sm border font-medium transition-all ${quickFilter === 'us' ? 'bg-blue-500 text-white border-blue-500' : 'bg-white text-[#64748b] border-[#e2e8f0] hover:bg-[#f1f5f9] hover:text-[#1e293b]'}`}
                    >
                        🇺🇸 美国
                    </button>
                    <button 
                        onClick={() => setQuickFilter('jp')}
                        className={`px-4 py-2 rounded-full text-sm border font-medium transition-all ${quickFilter === 'jp' ? 'bg-blue-500 text-white border-blue-500' : 'bg-white text-[#64748b] border-[#e2e8f0] hover:bg-[#f1f5f9] hover:text-[#1e293b]'}`}
                    >
                        🇯🇵 日本
                    </button>
                    <button 
                        onClick={() => {
                            const currentMonth = new Date().getMonth() + 1;
                            setMonthFilter(String(currentMonth));
                            window.scrollTo({ top: 100, behavior: 'smooth' });
                        }}
                        className="px-4 py-2 rounded-full text-sm border font-medium transition-all bg-white text-blue-500 border-blue-500 hover:bg-blue-50"
                    >
                        📅 本月
                    </button>
                </div>

                <select 
                    value={monthFilter}
                    onChange={(e) => setMonthFilter(e.target.value)}
                    className="px-4 py-2.5 border border-[#e2e8f0] rounded-xl text-sm bg-white cursor-pointer min-w-[120px] hover:border-[#cbd5e1] focus:outline-none focus:border-blue-500 focus:shadow-[0_0_0_3px_rgba(59,130,246,0.1)]"
                >
                    <option value="all">所有月份</option>
                    <option value="q1">Q1 第一季度</option>
                    <option value="q2">Q2 第二季度</option>
                    <option value="q3">Q3 第三季度</option>
                    <option value="q4">Q4 第四季度</option>
                    <option disabled>──────────</option>
                    {[...Array(12)].map((_, i) => (
                        <option key={i+1} value={String(i+1)}>{i+1}月</option>
                    ))}
                </select>

                <select 
                    value={categoryFilter}
                    onChange={(e) => setCategoryFilter(e.target.value)}
                    className="px-4 py-2.5 border border-[#e2e8f0] rounded-xl text-sm bg-white cursor-pointer min-w-[120px] hover:border-[#cbd5e1] focus:outline-none focus:border-blue-500 focus:shadow-[0_0_0_3px_rgba(59,130,246,0.1)]"
                >
                    <option value="all">所有分类</option>
                    <option value="statutory">🔴 法定节日</option>
                    <option value="overseas">🔵 海外节日</option>
                    <option value="promotion">🟣 活动及促销</option>
                    <option value="solar_term">🌱 节气</option>
                </select>

                <button 
                    onClick={() => {
                        setSearchTerm('')
                        setMonthFilter('all')
                        setCategoryFilter('all')
                        setQuickFilter('all')
                    }}
                    className="px-4 py-2 rounded-full text-sm border border-[#cbd5e1] text-[#64748b] bg-white hover:bg-[#f1f5f9] hover:text-[#1e293b] font-medium transition-all"
                >
                    ↺ 重置
                </button>
                <div className="text-[#64748b] text-sm font-medium">共 {filteredEvents.length} 条记录</div>
            </div>
        </div>

        {/* Calendar Grid */}
        <div className="mt-10 grid grid-cols-1 md:grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-5">
            {filteredEvents.length === 0 ? (
                <div className="col-span-full text-center py-20 bg-white rounded-2xl border-2 border-dashed border-[#e2e8f0] text-[#64748b]">
                    <span className="text-5xl block mb-4">🍃</span>
                    没有找到匹配的日历事件
                </div>
            ) : (
                Object.keys(eventsByMonth).sort((a,b) => Number(a)-Number(b)).map(month => (
                    <React.Fragment key={month}>
                        <div className="col-span-full mt-8 mb-4 flex items-center bg-[#f8fafc] sticky top-[130px] z-30 py-2.5">
                            <h2 className="text-2xl font-bold text-[#0f172a] relative pl-4 month-title">{month}月</h2>
                        </div>
                        {eventsByMonth[Number(month)].map((event: any, index: number) => {
                            const daysLeft = calculateDaysLeft(event.date_str);
                            let badgeClass = 'bg-[#cbd5e1]';
                            let badgeText = daysLeft !== null ? `${daysLeft}天后` : '';
                            
                            if (daysLeft !== null) {
                                if (daysLeft === 0) { badgeClass = 'bg-[#ef4444]'; badgeText = '今天'; }
                                else if (daysLeft < 0) { badgeClass = 'bg-[#94a3b8]'; badgeText = '已过'; }
                                else if (daysLeft <= 7) { badgeClass = 'bg-[#ef4444]'; }
                                else if (daysLeft <= 30) { badgeClass = 'bg-[#f97316]'; }
                                else if (daysLeft <= 60) { badgeClass = 'bg-[#10b981]'; }
                            }

                            const isWeekend = event.date_str.includes('周六') || event.date_str.includes('周日');

                            return (
                                <div key={`${event.date_str}-${index}`} className="group bg-white rounded-2xl p-5 pt-7 shadow-[0_1px_3px_rgba(0,0,0,0.1)] border border-transparent hover:-translate-y-1 hover:shadow-[0_10px_15px_-3px_rgba(0,0,0,0.1)] transition-all relative overflow-hidden flex flex-col gap-3 h-full box-border">
                                    {daysLeft !== null && daysLeft >= 0 && (
                                        <div className={`absolute top-0 right-0 px-3 py-1 rounded-bl-xl text-xs font-bold text-white shadow-sm z-10 ${badgeClass}`}>
                                            {badgeText}
                                        </div>
                                    )}
                                    
                                    <div className="flex justify-between items-baseline">
                                        <div className={`text-lg font-bold text-[#0f172a] ${isWeekend ? 'text-[#ef4444]' : ''}`}>{event.date_str}</div>
                                        <div className="text-sm text-[#64748b]">{event.lunar}</div>
                                    </div>
                                    
                                    <div className="text-[1.05rem] text-[#334155] font-medium leading-relaxed flex-grow">
                                        {event.content}
                                    </div>
                                    
                                    <div className="mt-auto">
                                        <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-xs font-semibold tracking-wide uppercase border ${categoryStyles[event.category_code] || 'bg-gray-100 text-gray-600 border-gray-200'}`}>
                                            {event.category}
                                        </span>
                                    </div>

                                    {/* Action Buttons */}
                                    <div className="absolute bottom-4 right-4 flex gap-2 opacity-0 translate-y-2 group-hover:opacity-100 group-hover:translate-y-0 transition-all z-20 bg-white/95 rounded-lg pl-2">
                                        <button 
                                            onClick={() => handleCopy(`${event.date_str} ${event.content}`)}
                                            className="w-8 h-8 rounded-lg border border-[#e2e8f0] bg-white text-[#64748b] flex items-center justify-center hover:bg-blue-500 hover:text-white hover:border-blue-500 shadow-sm transition-all"
                                            title="复制"
                                        >
                                            <span className="text-base">📋</span>
                                        </button>
                                    </div>
                                </div>
                            )
                        })}
                    </React.Fragment>
                ))
            )}
        </div>
      </main>

      {/* Footer - Matching Homepage */}
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

      {/* Back to top */}
      <button 
        onClick={scrollToTop}
        className={`fixed bottom-8 right-8 w-12 h-12 bg-blue-500 text-white rounded-full shadow-[0_4px_12px_rgba(59,130,246,0.4)] flex items-center justify-center transition-all z-50 hover:bg-blue-600 hover:-translate-y-1 ${showBackToTop ? 'opacity-100 visible' : 'opacity-0 invisible'}`}
        title="回到顶部"
      >
        <ArrowUp className="w-6 h-6" />
      </button>

    </div>
  )
}

export default MarketingCalendarClient
