'use client'

import React, { useEffect, useState } from 'react'
import { Save, Globe } from 'lucide-react'

export default function AdminSeo() {
  const [form, setForm] = useState({ title: '', siteKeywords: '', siteDescription: '', seoDescription: '', sitemapEnabled: false, robotsContent: '', robotsDisallowQuery: true, robotsDisallowAdmin: true, robotsDisallowPageParam: true, robotsDisallowUtmParams: true })
  const [msg, setMsg] = useState('')

  useEffect(() => {
    const load = async () => {
      const r = await fetch('/api/settings', { cache: 'no-store', credentials: 'include' })
      const d = await r.json()
      setForm({
        title: d.title || '',
        siteKeywords: d.siteKeywords || '',
        siteDescription: d.siteDescription || '',
        seoDescription: d.seoDescription || '',
        sitemapEnabled: String(d.sitemapEnabled || 'true') === 'true',
        robotsContent: d.robotsContent || 'User-agent: *\nAllow: /',
        robotsDisallowQuery: String(d.robotsDisallowQuery || 'true') === 'true',
        robotsDisallowAdmin: String(d.robotsDisallowAdmin || 'true') === 'true',
        robotsDisallowPageParam: String(d.robotsDisallowPageParam || 'true') === 'true',
        robotsDisallowUtmParams: String(d.robotsDisallowUtmParams || 'true') === 'true'
      })
    }
    load()
  }, [])

  const save = async () => {
    setMsg('')
    const payload = {
      title: form.title,
      siteKeywords: form.siteKeywords,
      siteDescription: form.siteDescription,
      seoDescription: form.seoDescription,
      sitemapEnabled: form.sitemapEnabled ? 'true' : 'false',
      robotsContent: form.robotsContent,
      robotsDisallowQuery: form.robotsDisallowQuery ? 'true' : 'false',
      robotsDisallowAdmin: form.robotsDisallowAdmin ? 'true' : 'false',
      robotsDisallowPageParam: form.robotsDisallowPageParam ? 'true' : 'false',
      robotsDisallowUtmParams: form.robotsDisallowUtmParams ? 'true' : 'false'
    }
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

  const set = (k: any, v: any) => setForm(prev => ({ ...prev, [k]: v }))

  return (
    <div className="max-w-4xl mx-auto p-8">
      <div className="bg-white rounded-lg border border-gray-100 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
          <div className="flex items-center gap-3"><div className="p-2 bg-indigo-100 text-indigo-600 rounded-lg"><Globe size={20} /></div><div><h2 className="text-lg font-bold text-gray-800">SEO 与代码植入</h2><p className="text-xs text-gray-500">搜索引擎优化及第三方统计/广告代码配置</p></div></div>
          <button onClick={save} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded text-sm font-medium flex items-center gap-2 transition-colors"><Save size={16} /> 保存配置</button>
        </div>
        <div className="p-8 space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="md:col-span-1"><h3 className="text-sm font-bold text-gray-800 mb-1">元数据配置</h3><p className="text-xs text-gray-500">控制网站在搜索结果中的展示</p></div>
            <div className="md:col-span-2 space-y-5">
              <div><label className="block text-sm font-medium text-gray-700 mb-1">全局标题 (Title)</label><input type="text" className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:border-blue-500" value={form.title} onChange={e => set('title', e.target.value)} /><p className="text-xs text-gray-400 mt-1">建议长度不超过 60 个字符</p></div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1">关键词 (Keywords)</label><input type="text" className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:border-blue-500" value={form.siteKeywords} onChange={e => set('siteKeywords', e.target.value)} /><p className="text-xs text-gray-400 mt-1">多个关键词请用英文逗号 "," 分隔</p></div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1">描述 (Description)</label><textarea className="w-full border border-gray-300 rounded px-3 py-2 text-sm h-24 focus:outline-none focus:border-blue-500" value={form.siteDescription} onChange={e => set('siteDescription', e.target.value)} /></div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1">SEO 描述 (覆盖全局)</label><textarea className="w-full border border-gray-300 rounded px-3 py-2 text-sm h-20 focus:outline-none focus:border-blue-500" value={form.seoDescription} onChange={e => set('seoDescription', e.target.value)} /></div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="md:col-span-1"><h3 className="text-sm font-bold text-gray-800 mb-1">索引与 robots.txt</h3><p className="text-xs text-gray-500">配置站点索引文件与爬虫策略</p></div>
            <div className="md:col-span-2 space-y-5">
              <div className="flex items-center gap-3"><input type="checkbox" checked={form.sitemapEnabled} onChange={e => set('sitemapEnabled', e.target.checked)} /><span className="text-sm text-gray-700">启用 sitemap.xml</span></div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1">robots.txt 内容</label><textarea className="w-full border border-gray-300 rounded px-3 py-2 text-sm h-28 focus:outline-none focus:border-blue-500" value={form.robotsContent} onChange={e => set('robotsContent', e.target.value)} /><p className="text-xs text-gray-400 mt-1">保存后可通过 /robots.txt 访问</p></div>
              <div className="flex items-center gap-3"><input type="checkbox" checked={form.robotsDisallowQuery} onChange={e => set('robotsDisallowQuery', e.target.checked)} /><span className="text-sm text-gray-700">屏蔽所有查询参数页面（Disallow /*?*）</span></div>
              <div className="flex items-center gap-3"><input type="checkbox" checked={form.robotsDisallowAdmin} onChange={e => set('robotsDisallowAdmin', e.target.checked)} /><span className="text-sm text-gray-700">屏蔽后台页面（Disallow /admin/）</span></div>
              <div className="flex items-center gap-3"><input type="checkbox" checked={form.robotsDisallowPageParam} onChange={e => set('robotsDisallowPageParam', e.target.checked)} /><span className="text-sm text-gray-700">屏蔽分页参数（Disallow /*?page=*）</span></div>
              <div className="flex items-center gap-3"><input type="checkbox" checked={form.robotsDisallowUtmParams} onChange={e => set('robotsDisallowUtmParams', e.target.checked)} /><span className="text-sm text-gray-700">屏蔽营销参数（Disallow /*?utm_*）</span></div>
            </div>
          </div>
          
          {msg && <div className="text-sm text-gray-600">{msg}</div>}
        </div>
      </div>
    </div>
  )
}