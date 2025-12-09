'use client'

import React, { useEffect, useState, useRef } from 'react'

export default function AdminSettings() {
  const [form, setForm] = useState({ siteName: '', logoUrl: '', faviconUrl: '', analyticsHeadHtml: '', analyticsBodyHtml: '', showAnalytics: false, copyrightText: '', homeHeroTitle: '', homeHeroSubtitle: '', hideHomeHeroIfEmpty: false, homeCardLimit: 6, friendLinks: '[]', privacyPolicy: '', showFriendLinksLabel: false, functionalityTitle: '', functionalitySubtitle: '' })
  const [loading, setLoading] = useState(true)
  const [msg, setMsg] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleBackup = async () => {
    try {
      const res = await fetch('/api/backup')
      if (!res.ok) throw new Error('Backup failed')
      const blob = await res.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `backup-${new Date().toISOString().split('T')[0]}.json`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
    } catch (e) {
      alert('备份失败')
    }
  }

  const handleRestore = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    
    if (!confirm('确定要恢复数据吗？这将覆盖现有数据！')) {
        if (fileInputRef.current) fileInputRef.current.value = ''
        return
    }

    const reader = new FileReader()
    reader.onload = async (e) => {
      try {
        const json = JSON.parse(e.target?.result as string)
        const res = await fetch('/api/backup', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(json)
        })
        if (res.ok) {
          alert('恢复成功')
          load() // Reload settings
        } else {
          alert('恢复失败')
        }
      } catch (err) {
        alert('文件格式错误或恢复失败')
      } finally {
        if (fileInputRef.current) fileInputRef.current.value = ''
      }
    }
    reader.readAsText(file)
  }

  const load = async () => {
    setLoading(true)
    try {
      const r = await fetch('/api/settings', { cache: 'no-store', credentials: 'include' })
      const data = await r.json()
      setForm({
        siteName: data.siteName || '',
        logoUrl: data.logoUrl || '',
        faviconUrl: data.faviconUrl || '',
        analyticsHeadHtml: data.analyticsHeadHtml || '',
        analyticsBodyHtml: data.analyticsBodyHtml || '',
        showAnalytics: String(data.showAnalytics || 'false') === 'true',
        copyrightText: data.copyrightText || '',
        homeHeroTitle: data.homeHeroTitle || '',
        homeHeroSubtitle: data.homeHeroSubtitle || '',
        hideHomeHeroIfEmpty: String(data.hideHomeHeroIfEmpty || 'false') === 'true',
        homeCardLimit: Number(data.homeCardLimit || 6),
        friendLinks: data.friendLinks || '[]',
        privacyPolicy: data.privacyPolicy || '',
        showFriendLinksLabel: String(data.showFriendLinksLabel || 'false') === 'true',
        functionalityTitle: data.functionalityTitle || '',
        functionalitySubtitle: data.functionalitySubtitle || ''
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const save = async () => {
    setMsg('')
    const payload = { ...form, showAnalytics: form.showAnalytics ? 'true' : 'false', showFriendLinksLabel: form.showFriendLinksLabel ? 'true' : 'false', hideHomeHeroIfEmpty: form.hideHomeHeroIfEmpty ? 'true' : 'false' }
    const r = await fetch('/api/settings', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload), credentials: 'include' })
    if (r.ok) { setMsg('保存成功'); try { localStorage.setItem('settings_cache', JSON.stringify(payload)); localStorage.setItem('settings_updated', String(Date.now())) } catch {} ; try { await load() } catch {} } else setMsg('保存失败或未登录')
  }

  const set = (k: any, v: any) => setForm(prev => ({ ...prev, [k]: v }))
  const safeParseLinks = (): Array<{ label: string; href: string; isExternal?: boolean; order?: number }> => {
    try { const arr = JSON.parse(String(form.friendLinks || '[]')); return Array.isArray(arr) ? arr : [] } catch { return [] }
  }
  const updateLinks = (list: Array<{ label: string; href: string; isExternal?: boolean; order?: number }>) => {
    const normalized = list.map((l, i) => ({ label: (l.label || '').trim(), href: (l.href || '').trim(), isExternal: !!l.isExternal, order: typeof l.order === 'number' ? l.order : i + 1 }))
    set('friendLinks', JSON.stringify(normalized))
  }

  return (
    <div className="p-8">
      <h1 className="text-xl font-bold text-gray-800 mb-4">站点设置</h1>
      {loading ? '加载中...' : (
        <div className="space-y-4 max-w-2xl">
          <div>
            <label className="block text-sm text-gray-600 mb-1">站点名称</label>
            <input className="w-full border rounded px-3 py-2 text-sm" value={form.siteName} onChange={e => set('siteName', e.target.value)} />
          </div>
          <div>
            <label className="block text-sm text-gray-600 mb-1">LOGO 地址（URL）</label>
            <input className="w-full border rounded px-3 py-2 text-sm" placeholder="https://example.com/logo.png 或 /api/logo" value={form.logoUrl} onChange={e => set('logoUrl', e.target.value)} />
            <div className="mt-2 flex items-center gap-3">
              <input type="file" accept="image/*" onChange={async e => { const f = e.target.files?.[0]; if (f) { try { const fd = new FormData(); fd.append('file', f); const r = await fetch('/api/logo', { method: 'POST', body: fd, credentials: 'include' }); const d = await r.json().catch(()=>({})); if (r.ok && d?.url) { set('logoUrl', d.url); try { await fetch('/api/settings', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ logoUrl: d.url }), credentials: 'include' }) } catch {} } } catch {} } }} />
              {String(form.logoUrl || '').trim() && (<img src={form.logoUrl} alt="LOGO" className="h-10 w-auto rounded border" />)}
            </div>
          </div>
          
          <div>
            <label className="block text-sm text-gray-600 mb-1">浏览器图标（Favicon）</label>
            <input className="w-full border rounded px-3 py-2 text-sm" placeholder="https://example.com/favicon.ico 或 /api/favicon" value={form.faviconUrl} onChange={e => set('faviconUrl', e.target.value)} />
            <div className="mt-2 flex items-center gap-3">
              <input type="file" accept="image/*" onChange={async e => { const f = e.target.files?.[0]; if (f) { try { const fd = new FormData(); fd.append('file', f); const r = await fetch('/api/favicon', { method: 'POST', body: fd, credentials: 'include' }); const d = await r.json().catch(()=>({})); if (r.ok && d?.url) { set('faviconUrl', d.url); try { await fetch('/api/settings', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ faviconUrl: d.url }), credentials: 'include' }) } catch {} } } catch {} } }} />
              {String(form.faviconUrl || '').trim() && (<img src={form.faviconUrl} alt="Favicon" className="h-10 w-10 rounded border object-contain" />)}
            </div>
          </div>
          
          <div>
            <label className="block text-sm text-gray-600 mb-1">Head 统计代码</label>
            <textarea className="w-full border rounded px-3 py-2 text-xs h-24 font-mono" value={form.analyticsHeadHtml} onChange={e => set('analyticsHeadHtml', e.target.value)} />
          </div>
          <div>
            <label className="block text-sm text-gray-600 mb-1">Body 底部代码</label>
            <textarea className="w-full border rounded px-3 py-2 text-xs h-24 font-mono" value={form.analyticsBodyHtml} onChange={e => set('analyticsBodyHtml', e.target.value)} />
          </div>
          <div>
            <label className="block text-sm text-gray-600 mb-1">首页标题</label>
            <input className="w-full border rounded px-3 py-2 text-sm" value={form.homeHeroTitle} onChange={e => set('homeHeroTitle', e.target.value)} />
          </div>
          <div>
            <label className="block text-sm text-gray-600 mb-1">首页副标题</label>
            <input className="w-full border rounded px-3 py-2 text-sm" value={form.homeHeroSubtitle} onChange={e => set('homeHeroSubtitle', e.target.value)} />
          </div>
          <div className="flex items-center gap-2">
            <input id="hideHomeHeroIfEmpty" type="checkbox" checked={form.hideHomeHeroIfEmpty} onChange={e => set('hideHomeHeroIfEmpty', e.target.checked)} />
            <label htmlFor="hideHomeHeroIfEmpty" className="text-sm text-gray-600">当标题或副标题为空时不显示</label>
          </div>
          
          <div>
            <label className="block text-sm text-gray-600 mb-1">首页工具卡片显示数量</label>
            <input type="number" min="1" max="100" className="w-full border rounded px-3 py-2 text-sm" value={form.homeCardLimit} onChange={e => set('homeCardLimit', parseInt(e.target.value) || 6)} />
            <p className="text-xs text-gray-400 mt-1">默认显示 6 个，超过部分需点击"查看更多"展开</p>
          </div>
          
          {/* 功能中心设置 */}
          <div className="pt-6 border-t border-gray-200">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">功能中心设置</h3>
            <div>
              <label className="block text-sm text-gray-600 mb-1">功能中心标题</label>
              <input className="w-full border rounded px-3 py-2 text-sm" value={form.functionalityTitle} onChange={e => set('functionalityTitle', e.target.value)} />
            </div>
            <div className="mt-3">
              <label className="block text-sm text-gray-600 mb-1">功能中心副标题</label>
              <input className="w-full border rounded px-3 py-2 text-sm" value={form.functionalitySubtitle} onChange={e => set('functionalitySubtitle', e.target.value)} />
            </div>
          </div>

          <div>
            <label className="block text-sm text-gray-600 mb-1">页脚版权</label>
            <input className="w-full border rounded px-3 py-2 text-sm" value={form.copyrightText} onChange={e => set('copyrightText', e.target.value)} />
          </div>
          <div>
            <label className="block text-sm text-gray-600 mb-1">友情链接管理</label>
            <div className="space-y-3">
              {safeParseLinks().map((link, idx) => (
                <div key={idx} className="grid grid-cols-1 md:grid-cols-12 gap-2 items-end">
                  <div className="md:col-span-3">
                    <input placeholder="名称" className="w-full border rounded px-3 py-2 text-sm" value={link.label || ''} onChange={e => { const arr = safeParseLinks(); arr[idx] = { ...arr[idx], label: e.target.value }; updateLinks(arr) }} />
                  </div>
                  <div className="md:col-span-5">
                    <input placeholder="链接地址" className="w-full border rounded px-3 py-2 text-sm" value={link.href || ''} onChange={e => { const arr = safeParseLinks(); arr[idx] = { ...arr[idx], href: e.target.value }; updateLinks(arr) }} />
                  </div>
                  <div className="md:col-span-2">
                    <input type="number" placeholder="排序" className="w-full border rounded px-3 py-2 text-sm" value={link.order ?? idx + 1} onChange={e => { const n = parseInt(e.target.value || '0', 10); const arr = safeParseLinks(); arr[idx] = { ...arr[idx], order: isNaN(n) ? idx + 1 : n }; updateLinks(arr) }} />
                  </div>
                  <div className="md:col-span-2">
                    <select className="w-full border rounded px-3 py-2 text-sm" value={link.isExternal ? 'true' : 'false'} onChange={e => { const arr = safeParseLinks(); arr[idx] = { ...arr[idx], isExternal: e.target.value === 'true' }; updateLinks(arr) }}>
                      <option value="false">站内</option>
                      <option value="true">外链</option>
                    </select>
                  </div>
                  <div className="md:col-span-12">
                    <button type="button" className="text-xs text-red-600 border border-red-200 rounded px-2 py-1" onClick={() => { const arr = safeParseLinks().filter((_, i) => i !== idx); updateLinks(arr) }}>删除</button>
                  </div>
                </div>
              ))}
              <button type="button" className="text-sm bg-blue-600 text-white rounded px-3 py-2" onClick={() => { const arr = safeParseLinks(); const nextOrder = (arr.reduce((m, l) => Math.max(m, l.order ?? 0), 0) || arr.length) + 1; arr.push({ label: '', href: '', isExternal: true, order: nextOrder }); updateLinks(arr) }}>新增链接</button>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <input id="showFriendLinksLabel" type="checkbox" checked={form.showFriendLinksLabel} onChange={e => set('showFriendLinksLabel', e.target.checked)} />
            <label htmlFor="showFriendLinksLabel" className="text-sm text-gray-600">在前台友链前显示“友情链接：”</label>
          </div>
          <div>
            <label className="block text-sm text-gray-600 mb-1">隐私政策（Privacy Policy）</label>
            <textarea className="w-full border rounded px-3 py-2 text-xs h-24" value={form.privacyPolicy} onChange={e => set('privacyPolicy', e.target.value)} />
          </div>
          <div className="flex items-center gap-2">
            <input id="showAnalytics" type="checkbox" checked={form.showAnalytics} onChange={e => set('showAnalytics', e.target.checked)} />
            <label htmlFor="showAnalytics" className="text-sm text-gray-600">开启统计展示（仪表盘趋势/活跃/关键指标）</label>
          </div>

          {/* 备份与恢复 */}
          <div className="pt-6 border-t border-gray-200">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">数据备份与恢复</h3>
            <div className="flex gap-4">
              <button type="button" onClick={handleBackup} className="bg-green-600 text-white rounded px-4 py-2 text-sm hover:bg-green-700">
                导出备份数据
              </button>
              <button type="button" onClick={() => fileInputRef.current?.click()} className="bg-yellow-600 text-white rounded px-4 py-2 text-sm hover:bg-yellow-700">
                导入恢复数据
              </button>
              <input 
                type="file" 
                ref={fileInputRef} 
                className="hidden" 
                accept=".json" 
                onChange={handleRestore} 
              />
            </div>
            <p className="text-xs text-gray-400 mt-2">注意：恢复数据将覆盖当前所有设置和内容，请谨慎操作。</p>
          </div>

          <button onClick={save} className="bg-blue-600 text-white rounded px-4 py-2 text-sm">保存</button>
          {msg && <div className="text-sm text-gray-600">{msg}</div>}
        </div>
      )}
    </div>
  )
}