'use client'

import React, { useEffect, useState } from 'react'
import { Save, Info } from 'lucide-react'

export default function AdminAbout() {
  const [form, setForm] = useState({ aboutTitle: '', aboutContent: '' })
  const [msg, setMsg] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      try {
        const r = await fetch('/api/settings', { cache: 'no-store', credentials: 'include' })
        const d = await r.json()
        setForm({ aboutTitle: d.aboutTitle || '关于我们', aboutContent: d.aboutContent || '' })
      } catch {}
      setLoading(false)
    }
    load()
  }, [])

  const set = (k: any, v: any) => setForm(prev => ({ ...prev, [k]: v }))
  const save = async () => {
    setMsg('')
    const payload = { aboutTitle: form.aboutTitle, aboutContent: form.aboutContent }
    const r = await fetch('/api/settings', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload), credentials: 'include' })
    setMsg(r.ok ? '保存成功' : '保存失败或未登录')
    if (r.ok) {
      try {
        const raw = localStorage.getItem('settings_cache')
        const base = raw ? JSON.parse(raw) : {}
        const merged = { ...(base && typeof base === 'object' ? base : {}), ...payload }
        localStorage.setItem('settings_cache', JSON.stringify(merged))
        localStorage.setItem('settings_updated', String(Date.now()))
      } catch {}
    }
  }

  return (
    <div className="max-w-4xl mx-auto p-8">
      <div className="bg-white rounded-lg border border-gray-100 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
          <div className="flex items-center gap-3"><div className="p-2 bg-indigo-100 text-indigo-600 rounded-lg"><Info size={20} /></div><div><h2 className="text-lg font-bold text-gray-800">关于页面内容</h2><p className="text-xs text-gray-500">编辑“关于我们”标题与主体内容</p></div></div>
          <button onClick={save} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded text-sm font-medium flex items-center gap-2 transition-colors"><Save size={16} /> 保存</button>
        </div>
        {loading ? (
          <div className="p-6 text-sm text-gray-600">加载中...</div>
        ) : (
          <div className="p-6 space-y-6">
            <div>
              <label className="block text-sm text-gray-600 mb-1">关于标题</label>
              <input className="w-full border rounded px-3 py-2 text-sm" value={form.aboutTitle} onChange={e => set('aboutTitle', e.target.value)} />
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">关于内容（支持 Markdown）</label>
              <textarea className="w-full border rounded px-3 py-2 text-xs h-40" value={form.aboutContent} onChange={e => set('aboutContent', e.target.value)} />
              <p className="mt-2 text-xs text-gray-500">提示：可直接输入 Markdown 或 HTML，前台将进行安全渲染。</p>
            </div>
            {msg && <div className="text-sm text-gray-600">{msg}</div>}
          </div>
        )}
      </div>
    </div>
  )
}