'use client'

import React, { useEffect, useState } from 'react'
import { Save, Globe, CheckCircle, AlertTriangle, XCircle, ExternalLink, RefreshCw, Play } from 'lucide-react'

export default function AdminSeo() {
  const [form, setForm] = useState({
    title: '',
    siteKeywords: '',
    siteDescription: '',
    seoDescription: '',
    sitemapEnabled: false,
    sitemapFrequency: 'daily',
    enableStructuredData: true,
    enableBreadcrumbs: true,
    robotsContent: '',
    robotsDisallowQuery: true,
    robotsDisallowAdmin: true,
    robotsDisallowPageParam: true,
    robotsDisallowUtmParams: true,
    googleVerification: '',
    baiduVerification: ''
  })
  const [loading, setLoading] = useState(true)
  const [msg, setMsg] = useState('')
  const [checkResults, setCheckResults] = useState<any[] | null>(null)
  const [checking, setChecking] = useState(false)

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      try {
        const r = await fetch('/api/settings', { cache: 'no-store', credentials: 'include' })
        const d = await r.json()
        setForm({
          title: d.title || '',
          siteKeywords: d.siteKeywords || '',
          siteDescription: d.siteDescription || '',
          seoDescription: d.seoDescription || '',
          sitemapEnabled: String(d.sitemapEnabled || 'true') === 'true',
          sitemapFrequency: d.sitemapFrequency || 'daily',
          enableStructuredData: String(d.enableStructuredData || 'true') === 'true',
          enableBreadcrumbs: String(d.enableBreadcrumbs || 'true') === 'true',
          robotsContent: d.robotsContent || 'User-agent: *\nAllow: /',
          robotsDisallowQuery: String(d.robotsDisallowQuery || 'true') === 'true',
          robotsDisallowAdmin: String(d.robotsDisallowAdmin || 'true') === 'true',
          robotsDisallowPageParam: String(d.robotsDisallowPageParam || 'true') === 'true',
          robotsDisallowUtmParams: String(d.robotsDisallowUtmParams || 'true') === 'true',
          googleVerification: d.googleVerification || '',
          baiduVerification: d.baiduVerification || ''
        })
      } finally {
        setLoading(false)
      }
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
      sitemapFrequency: form.sitemapFrequency,
      enableStructuredData: form.enableStructuredData ? 'true' : 'false',
      enableBreadcrumbs: form.enableBreadcrumbs ? 'true' : 'false',
      robotsContent: form.robotsContent,
      robotsDisallowQuery: form.robotsDisallowQuery ? 'true' : 'false',
      robotsDisallowAdmin: form.robotsDisallowAdmin ? 'true' : 'false',
      robotsDisallowPageParam: form.robotsDisallowPageParam ? 'true' : 'false',
      robotsDisallowUtmParams: form.robotsDisallowUtmParams ? 'true' : 'false',
      googleVerification: form.googleVerification,
      baiduVerification: form.baiduVerification
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
      setTimeout(() => setMsg(''), 3000)
    }
  }

  const set = (k: any, v: any) => setForm(prev => ({ ...prev, [k]: v }))

  const runCheck = () => {
    setChecking(true)
    setCheckResults(null)
    setTimeout(() => {
      const results = []
      
      // Title Check
      if (!form.title) results.push({ type: 'error', msg: '缺少全局标题' })
      else if (form.title.length > 60) results.push({ type: 'warning', msg: `标题过长 (${form.title.length}/60)` })
      else results.push({ type: 'success', msg: '标题设置正常' })

      // Keywords Check
      if (!form.siteKeywords) results.push({ type: 'warning', msg: '未设置关键词' })
      else results.push({ type: 'success', msg: '关键词已设置' })

      // Description Check
      if (!form.siteDescription && !form.seoDescription) results.push({ type: 'error', msg: '缺少站点描述' })
      else if ((form.siteDescription || form.seoDescription).length < 50) results.push({ type: 'warning', msg: '描述内容过短，建议增加' })
      else results.push({ type: 'success', msg: '描述设置正常' })

      // Sitemap Check
      if (!form.sitemapEnabled) results.push({ type: 'error', msg: 'Sitemap 未启用' })
      else results.push({ type: 'success', msg: 'Sitemap 已启用' })

      // Robots Check
      if (!form.robotsContent) results.push({ type: 'warning', msg: 'Robots.txt 内容为空' })
      else results.push({ type: 'success', msg: 'Robots.txt 已配置' })

      // Structured Data & Breadcrumbs
      if (form.enableStructuredData) results.push({ type: 'success', msg: '结构化数据已启用' })
      else results.push({ type: 'warning', msg: '建议启用结构化数据' })

      if (form.enableBreadcrumbs) results.push({ type: 'success', msg: '面包屑导航已启用' })
      else results.push({ type: 'warning', msg: '建议启用面包屑导航' })

      setCheckResults(results)
      setChecking(false)
    }, 1500)
  }

  const generateSitemap = async () => {
    const btn = document.getElementById('sitemap-btn') as HTMLButtonElement
    if (btn) {
      const originText = btn.innerText
      btn.innerText = '生成中...'
      btn.disabled = true
      try {
        // In a dynamic system, sitemap is generated on the fly. We can just ping it.
        await fetch('/sitemap.xml', { cache: 'reload' })
        setMsg('Sitemap 已重新生成')
        setTimeout(() => setMsg(''), 3000)
      } catch {
        setMsg('生成失败')
      } finally {
        btn.innerText = originText
        btn.disabled = false
      }
    }
  }

  return (
    <div className="max-w-5xl mx-auto p-8 pb-24">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">SEO 设置</h1>
          <p className="text-gray-500 mt-1">管理搜索引擎优化、Sitemap 和元数据配置</p>
        </div>
        <div className="flex items-center gap-3">
          {msg && <span className={`text-sm px-3 py-1 rounded ${msg.includes('成功') ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>{msg}</span>}
          <button onClick={save} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg shadow-sm text-sm font-medium flex items-center gap-2 transition-all active:scale-95">
            <Save size={18} /> 保存配置
          </button>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-20 text-gray-500">加载中...</div>
      ) : (
        <div className="space-y-6">
          {/* Sitemap 管理 */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/50">
              <h3 className="font-bold text-gray-800">Sitemap 管理</h3>
              <p className="text-xs text-gray-500 mt-0.5">网站地图帮助搜索引擎更好地索引您的网站内容</p>
            </div>
            <div className="p-6">
              <div className="flex flex-wrap items-center gap-4 mb-6">
                <button id="sitemap-btn" onClick={generateSitemap} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors">
                  <RefreshCw size={16} /> 生成 Sitemap
                </button>
                <a href="/sitemap.xml" target="_blank" className="bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors">
                  <ExternalLink size={16} /> 查看 Sitemap
                </a>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                   <div className="flex items-center justify-between">
                      <div>
                        <label className="block text-sm font-medium text-gray-700">启用 Sitemap</label>
                        <p className="text-xs text-gray-500 mt-0.5">自动生成网站地图，建议开启</p>
                      </div>
                      <div className="relative inline-block w-12 mr-2 align-middle select-none transition duration-200 ease-in">
                        <input type="checkbox" name="sitemapEnabled" id="sitemapEnabled" checked={form.sitemapEnabled} onChange={e => set('sitemapEnabled', e.target.checked)} className="toggle-checkbox absolute block w-6 h-6 rounded-full bg-white border-4 appearance-none cursor-pointer transition-transform duration-200 ease-in-out" style={{ transform: form.sitemapEnabled ? 'translateX(100%)' : 'translateX(0)', borderColor: form.sitemapEnabled ? '#2563eb' : '#e5e7eb' }} />
                        <label htmlFor="sitemapEnabled" className={`toggle-label block overflow-hidden h-6 rounded-full cursor-pointer ${form.sitemapEnabled ? 'bg-blue-600' : 'bg-gray-300'}`}></label>
                      </div>
                   </div>
                   
                   <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Sitemap 更新频率</label>
                      <select className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500" value={form.sitemapFrequency} onChange={e => set('sitemapFrequency', e.target.value)}>
                        <option value="always">总是 (always)</option>
                        <option value="hourly">每小时 (hourly)</option>
                        <option value="daily">每天 (daily) - 推荐</option>
                        <option value="weekly">每周 (weekly)</option>
                        <option value="monthly">每月 (monthly)</option>
                        <option value="yearly">每年 (yearly)</option>
                        <option value="never">从不 (never)</option>
                      </select>
                      <p className="text-xs text-gray-400 mt-1">告诉搜索引擎网站内容的更新频率</p>
                   </div>
                </div>
              </div>
            </div>
          </div>

          {/* SEO 检查 */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/50">
              <h3 className="font-bold text-gray-800">SEO 检查</h3>
              <p className="text-xs text-gray-500 mt-0.5">检查网站的 SEO 配置是否正确，发现潜在问题和优化建议</p>
            </div>
            <div className="p-6">
              {!checkResults && !checking && (
                <div className="text-center py-8">
                  <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-4 text-blue-600">
                    <Globe size={32} />
                  </div>
                  <h4 className="text-lg font-medium text-gray-900 mb-2">准备开始检查</h4>
                  <p className="text-gray-500 mb-6 max-w-md mx-auto">我们将分析您的站点配置、元数据完整性以及索引设置，为您提供优化建议。</p>
                  <button onClick={runCheck} className="bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 px-6 py-2.5 rounded-lg text-sm font-medium inline-flex items-center gap-2 transition-colors shadow-sm">
                    <Play size={16} /> 开始 SEO 检查
                  </button>
                </div>
              )}

              {checking && (
                <div className="text-center py-12">
                  <div className="w-12 h-12 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto mb-4"></div>
                  <p className="text-gray-600">正在分析站点配置...</p>
                </div>
              )}

              {checkResults && (
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="font-bold text-gray-800">检查结果</h4>
                    <button onClick={runCheck} className="text-sm text-blue-600 hover:text-blue-800 flex items-center gap-1">
                      <RefreshCw size={14} /> 重新检查
                    </button>
                  </div>
                  <div className="space-y-3">
                    {checkResults.map((res, idx) => (
                      <div key={idx} className={`flex items-center gap-3 p-3 rounded-lg border ${
                        res.type === 'success' ? 'bg-green-50 border-green-100 text-green-800' : 
                        res.type === 'warning' ? 'bg-yellow-50 border-yellow-100 text-yellow-800' : 
                        'bg-red-50 border-red-100 text-red-800'
                      }`}>
                        {res.type === 'success' ? <CheckCircle size={18} className="shrink-0" /> : 
                         res.type === 'warning' ? <AlertTriangle size={18} className="shrink-0" /> : 
                         <XCircle size={18} className="shrink-0" />}
                        <span className="text-sm font-medium">{res.msg}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* 结构化数据与高级设置 */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/50">
              <h3 className="font-bold text-gray-800">高级功能</h3>
              <p className="text-xs text-gray-500 mt-0.5">启用增强型搜索结果展示功能</p>
            </div>
            <div className="p-6 space-y-6">
               <div className="flex items-center justify-between">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">启用结构化数据</label>
                    <p className="text-xs text-gray-500 mt-0.5">为搜索引擎提供结构化数据（JSON-LD），提升搜索结果展示效果 - 建议开启</p>
                  </div>
                  <div className="relative inline-block w-12 mr-2 align-middle select-none transition duration-200 ease-in">
                    <input type="checkbox" id="enableStructuredData" checked={form.enableStructuredData} onChange={e => set('enableStructuredData', e.target.checked)} className="toggle-checkbox absolute block w-6 h-6 rounded-full bg-white border-4 appearance-none cursor-pointer transition-transform duration-200 ease-in-out" style={{ transform: form.enableStructuredData ? 'translateX(100%)' : 'translateX(0)', borderColor: form.enableStructuredData ? '#2563eb' : '#e5e7eb' }} />
                    <label htmlFor="enableStructuredData" className={`toggle-label block overflow-hidden h-6 rounded-full cursor-pointer ${form.enableStructuredData ? 'bg-blue-600' : 'bg-gray-300'}`}></label>
                  </div>
               </div>

               <div className="flex items-center justify-between pt-4 border-t border-gray-100">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">启用面包屑导航</label>
                    <p className="text-xs text-gray-500 mt-0.5">在页面顶部显示面包屑导航，提升用户体验和 SEO - 建议开启</p>
                  </div>
                  <div className="relative inline-block w-12 mr-2 align-middle select-none transition duration-200 ease-in">
                    <input type="checkbox" id="enableBreadcrumbs" checked={form.enableBreadcrumbs} onChange={e => set('enableBreadcrumbs', e.target.checked)} className="toggle-checkbox absolute block w-6 h-6 rounded-full bg-white border-4 appearance-none cursor-pointer transition-transform duration-200 ease-in-out" style={{ transform: form.enableBreadcrumbs ? 'translateX(100%)' : 'translateX(0)', borderColor: form.enableBreadcrumbs ? '#2563eb' : '#e5e7eb' }} />
                    <label htmlFor="enableBreadcrumbs" className={`toggle-label block overflow-hidden h-6 rounded-full cursor-pointer ${form.enableBreadcrumbs ? 'bg-blue-600' : 'bg-gray-300'}`}></label>
                  </div>
               </div>
            </div>
          </div>

          {/* 基础 SEO 配置 */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
             <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/50">
              <h3 className="font-bold text-gray-800">基础元数据</h3>
              <p className="text-xs text-gray-500 mt-0.5">配置站点全局标题、描述和关键词</p>
            </div>
            <div className="p-6 space-y-5">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">全局标题 (Title)</label>
                <input type="text" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-200" value={form.title} onChange={e => set('title', e.target.value)} />
                <p className="text-xs text-gray-400 mt-1">建议长度不超过 60 个字符</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">关键词 (Keywords)</label>
                <input type="text" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-200" value={form.siteKeywords} onChange={e => set('siteKeywords', e.target.value)} />
                <p className="text-xs text-gray-400 mt-1">多个关键词请用英文逗号 "," 分隔</p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">站点描述 (Description)</label>
                  <textarea className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm h-24 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-200" value={form.siteDescription} onChange={e => set('siteDescription', e.target.value)} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">SEO 描述 (覆盖全局)</label>
                  <textarea className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm h-24 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-200" value={form.seoDescription} onChange={e => set('seoDescription', e.target.value)} />
                </div>
              </div>
            </div>
          </div>

          {/* 爬虫与索引配置 */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/50">
              <h3 className="font-bold text-gray-800">爬虫协议 (Robots.txt)</h3>
              <p className="text-xs text-gray-500 mt-0.5">控制搜索引擎爬虫的行为</p>
            </div>
            <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-8">
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">robots.txt 内容</label>
                <textarea className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm h-40 font-mono bg-gray-50 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-200" value={form.robotsContent} onChange={e => set('robotsContent', e.target.value)} />
                <p className="text-xs text-gray-400 mt-1">保存后可通过 <a href="/robots.txt" target="_blank" className="text-blue-600 hover:underline">/robots.txt</a> 访问</p>
              </div>
              <div className="space-y-3 md:pt-7">
                <div className="flex items-center gap-3"><input type="checkbox" checked={form.robotsDisallowQuery} onChange={e => set('robotsDisallowQuery', e.target.checked)} className="rounded text-blue-600 focus:ring-blue-500" /><span className="text-sm text-gray-700">屏蔽查询参数 (/*?*)</span></div>
                <div className="flex items-center gap-3"><input type="checkbox" checked={form.robotsDisallowAdmin} onChange={e => set('robotsDisallowAdmin', e.target.checked)} className="rounded text-blue-600 focus:ring-blue-500" /><span className="text-sm text-gray-700">屏蔽后台 (/admin/)</span></div>
                <div className="flex items-center gap-3"><input type="checkbox" checked={form.robotsDisallowPageParam} onChange={e => set('robotsDisallowPageParam', e.target.checked)} className="rounded text-blue-600 focus:ring-blue-500" /><span className="text-sm text-gray-700">屏蔽分页 (/*?page=*)</span></div>
                <div className="flex items-center gap-3"><input type="checkbox" checked={form.robotsDisallowUtmParams} onChange={e => set('robotsDisallowUtmParams', e.target.checked)} className="rounded text-blue-600 focus:ring-blue-500" /><span className="text-sm text-gray-700">屏蔽营销参数 (/*?utm_*)</span></div>
              </div>
            </div>
          </div>

          {/* 验证代码 */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/50">
              <h3 className="font-bold text-gray-800">站长验证</h3>
              <p className="text-xs text-gray-500 mt-0.5">Google Search Console 和 百度站长平台验证</p>
            </div>
            <div className="p-6 space-y-5">
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Google 站点验证 (google-site-verification)</label><input type="text" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-200" placeholder="输入 meta content 的值" value={form.googleVerification} onChange={e => set('googleVerification', e.target.value)} /></div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1">百度 站点验证 (baidu-site-verification)</label><input type="text" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-200" placeholder="输入 meta content 的值" value={form.baiduVerification} onChange={e => set('baiduVerification', e.target.value)} /></div>
            </div>
          </div>

        </div>
      )}
    </div>
  )
}
