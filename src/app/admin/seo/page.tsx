'use client'
import { useState } from 'react'
import config from '@/config/site-seo.json'

export default function AdminSeo() {
  const [value, setValue] = useState(JSON.stringify(config, null, 2))
  const [error, setError] = useState('')
  function download() {
    try {
      const data = JSON.parse(value)
      if (!data.siteName || !data.siteUrl || !data.seoDescription) throw new Error('请填写 siteName、siteUrl 和 seoDescription')
      new URL(data.siteUrl)
      const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2) + '\n'], { type: 'application/json' }))
      const link = document.createElement('a')
      link.href = url
      link.download = 'site-seo.json'
      link.click()
      URL.revokeObjectURL(url)
      setError('配置已导出。替换仓库 src/config/site-seo.json 并部署后生效。')
    } catch (e) { setError(e instanceof Error ? e.message : '配置格式不正确') }
  }
  return <main className="p-6 space-y-4">
    <h1 className="text-2xl font-bold">SEO 发布配置</h1>
    <p>公开页面的 SEO 已独立于数据库。此处显示当前部署配置，编辑后可下载；替换仓库中的配置文件并重新部署后生效。</p>
    <p>工具名称和说明由 src/lib/constants.ts 管理，公开博客由 src/config/published-posts.json 管理。站点地图自动生成，数据库内的旧 SEO 设置不再覆盖公开页面。</p>
    <textarea aria-label="SEO 配置 JSON" className="w-full h-[520px] border rounded p-4 font-mono text-sm" value={value} onChange={e => setValue(e.target.value)} />
    <button onClick={download} className="bg-blue-600 text-white px-4 py-2 rounded">下载发布配置</button>
    <p role="status">{error}</p>
    <p><a href="/sitemap.xml" target="_blank" className="text-blue-600">查看站点地图</a> · <a href="/robots.txt" target="_blank" className="text-blue-600">查看抓取规则</a></p>
  </main>
}
