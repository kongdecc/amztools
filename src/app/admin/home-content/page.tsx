'use client'

import React, { useEffect, useState } from 'react'

export default function AdminHomeContent() {
  const [form, setForm] = useState({
    featuredTitle: '', featuredSubtitle: '',
    whyChooseTitle: '', whyChooseSubtitle: '',
    feature1Title: '', feature1Description: '',
    feature2Title: '', feature2Description: '',
    feature3Title: '', feature3Description: ''
  })
  const [loading, setLoading] = useState(true)
  const [msg, setMsg] = useState('')

  const load = async () => {
    setLoading(true)
    try {
      const r = await fetch('/api/home-content', { cache: 'no-store', credentials: 'include' })
      const data = await r.json()
      setForm({
        featuredTitle: data.featuredTitle || '',
        featuredSubtitle: data.featuredSubtitle || '',
        whyChooseTitle: data.whyChooseTitle || '',
        whyChooseSubtitle: data.whyChooseSubtitle || '',
        feature1Title: data.feature1Title || '',
        feature1Description: data.feature1Description || '',
        feature2Title: data.feature2Title || '',
        feature2Description: data.feature2Description || '',
        feature3Title: data.feature3Title || '',
        feature3Description: data.feature3Description || ''
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const save = async () => {
    setMsg('')
    const r = await fetch('/api/home-content', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form), credentials: 'include' })
    if (r.ok) setMsg('保存成功'); else setMsg('保存失败或未登录')
  }

  const set = (k: any, v: any) => setForm(prev => ({ ...prev, [k]: v }))

  return (
    <div className="p-8">
      <h1 className="text-xl font-bold text-gray-800 mb-4">首页内容</h1>
      {loading ? '加载中...' : (
        <div className="space-y-4 max-w-3xl">
          {[
            ['featuredTitle', 'Featured 标题'], ['featuredSubtitle', 'Featured 副标题'],
            ['whyChooseTitle', 'Why 选择 标题'], ['whyChooseSubtitle', 'Why 选择 副标题'],
            ['feature1Title', 'Feature1 标题'], ['feature1Description', 'Feature1 描述'],
            ['feature2Title', 'Feature2 标题'], ['feature2Description', 'Feature2 描述'],
            ['feature3Title', 'Feature3 标题'], ['feature3Description', 'Feature3 描述']
          ].map(([k, label]) => (
            <div key={k as string}>
              <label className="block text-sm text-gray-600 mb-1">{label}</label>
              {(k as string).includes('Description') || (k as string).includes('Subtitle') ? (
                <textarea className="w-full border rounded px-3 py-2 text-sm h-20" value={(form as any)[k as string]} onChange={e => set(k, e.target.value)} />
              ) : (
                <input className="w-full border rounded px-3 py-2 text-sm" value={(form as any)[k as string]} onChange={e => set(k, e.target.value)} />
              )}
            </div>
          ))}
          <button onClick={save} className="bg-blue-600 text-white rounded px-4 py-2 text-sm">保存</button>
          {msg && <div className="text-sm text-gray-600">{msg}</div>}
        </div>
      )}
    </div>
  )
}