'use client'

import React, { useState, useEffect } from 'react'
import Link from 'next/link'
import { useSettings } from '@/components/SettingsProvider'
import { LayoutDashboard, Send, ChevronDown } from 'lucide-react'

interface SuggestClientProps {
  initialNavItems: any[]
  modules: any[]
}

export default function SuggestClient({ initialNavItems, modules }: SuggestClientProps) {
  const { settings } = useSettings()
  const [navItems, setNavItems] = useState<any[]>(initialNavItems)
  
  // 监听 settings 变化更新 navItems (虽然 SSR 已经传了初值，但 settings 更新可能带来新导航)
  useEffect(() => {
    try {
      const raw = (settings as any).navigation
      const arr = raw ? JSON.parse(String(raw)) : []
      if (Array.isArray(arr) && arr.length) setNavItems(arr)
    } catch {}
  }, [settings])

  const [nickname, setNickname] = useState('')
  const [content, setContent] = useState('')
  const [msg, setMsg] = useState('')

  const submit = async () => {
    setMsg('')
    const nk = nickname.trim()
    const ct = content.trim()
    if (!nk || !ct) { setMsg('请填写昵称和内容'); return }
    try {
      const key = `suggest_last`
      const last = Number(sessionStorage.getItem(key) || 0)
      const nowTs = Date.now()
      if (last && nowTs - last < 15000) { setMsg('提交太频繁，请稍后再试'); return }
      sessionStorage.setItem(key, String(nowTs))
      const r = await fetch('/api/suggest', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ nickname: nk, content: ct }), cache: 'no-store' })
      if (!r.ok) { setMsg('提交失败，请稍后重试'); return }
      setNickname('')
      setContent('')
      setMsg('提交成功')
    } catch { setMsg('提交失败，请稍后重试') }
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <header className="h-14 bg-[#5b5bd6] text-white flex items-center px-10 shadow-md z-20">
        <div className={`flex items-center gap-2 font-bold text-lg`}>
          {String(settings.logoUrl || '').trim() ? (
            <img src={settings.logoUrl} alt={settings.siteName} className="h-6 w-6 rounded object-contain" />
          ) : (
            <div className="bg-white/20 p-1 rounded"><LayoutDashboard className="h-5 w-5" /></div>
          )}
          <span>{settings.siteName}</span>
        </div>
        <nav className="ml-auto mr-6 flex items-center gap-6">
          <Link href="/" className="text-sm text-white/90 hover:text-white">首页</Link>
          {navItems
            .slice()
            .sort((a: any, b: any) => Number(a.order || 0) - Number(b.order || 0))
            .map((item:any) => {
            const isFuncMenu = String(item.label || '').includes('功能分类') || String(item.id || '') === 'functionality'
            if (isFuncMenu) {
              return (
                <div key={item.id || 'function-menu'} className="relative group">
                  <button onClick={()=>{ try { (window as any).location.href = '/functionality' } catch {} }} className="text-sm text-white/90 hover:text-white flex items-center gap-1 cursor-pointer">
                    {item.label || '功能分类'}
                    <ChevronDown className="h-4 w-4 transition-transform group-hover:rotate-180" />
                  </button>
                  <div className="absolute top-full right-0 mt-2 w-64 bg-white rounded-lg shadow-lg overflow-hidden z-50 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200">
                    <div className="p-2 space-y-1">
                      {modules.map((m: any) => (
                        <Link 
                          key={m.key}
                          href={`/?tab=${m.key}`}
                          className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-blue-50 hover:text-blue-600 rounded-lg transition-colors cursor-pointer"
                        >
                          {m.title}
                        </Link>
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
              <Link key={item.id} href={item.href || '/'} className="text-sm text-white/90 hover:text-white">
                {item.label}
              </Link>
            )
          })}
        </nav>
      </header>

      <div className="flex-1">
        <div className="max-w-6xl mx-auto px-8 py-10">
          <nav aria-label="breadcrumb" className="text-xs text-gray-500 mb-4 flex items-center gap-2">
            <Link href="/" className="hover:text-blue-600">首页</Link>
            <span>/</span>
            <span className="text-gray-700">提需求</span>
          </nav>
          <h1 className="text-2xl font-bold text-gray-800 mb-4">提交建议与需求</h1>
          <div className="bg-white border border-gray-200 rounded-xl p-6 space-y-4">
            <div>
              <label className="block text-sm text-gray-600 mb-1">昵称</label>
              <input value={nickname} onChange={e=>setNickname(e.target.value)} className="w-full border rounded px-3 py-2 text-sm" maxLength={40} placeholder="你的昵称" />
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">建议/需求内容</label>
              <textarea value={content} onChange={e=>setContent(e.target.value)} className="w-full border rounded px-3 py-2 text-sm h-28" maxLength={2000} placeholder="详细描述你希望新增的功能或改进" />
            </div>
            <div className="flex items-center gap-3">
              <button onClick={submit} className="px-4 py-2 rounded bg-blue-600 text-white text-sm flex items-center gap-2"><Send className="h-4 w-4" />提交</button>
              <span className="text-sm text-gray-500">无需注册，直接提交</span>
              {msg && <span className="text-sm text-green-600">{msg}</span>}
            </div>
          </div>
          
        </div>
      </div>
      <div className="px-6 pb-10 text-center">
        <footer className="text-xs text-gray-400">
          {settings.copyrightText || '© 2025 运营魔方 ToolBox. All rights reserved.'}
          <span className="mx-2">|</span>
          <a href="/privacy" className="hover:text-blue-600">隐私说明</a>
        </footer>
      </div>
    </div>
  )
}
