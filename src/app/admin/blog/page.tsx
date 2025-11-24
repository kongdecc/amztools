'use client'

import React, { useEffect, useMemo, useState } from 'react'
import { Search, Plus, Save, Trash2, Edit3, ArrowUp, ArrowDown } from 'lucide-react'

type Post = { id: string; title: string; slug: string; content: string; status: string; order: number; views: number; coverUrl?: string; createdAt?: string; updatedAt?: string }

export default function AdminBlog() {
  const [list, setList] = useState<Post[]>([])
  const [keyword, setKeyword] = useState('')
  const [saving, setSaving] = useState(false)
  const [savedHint, setSavedHint] = useState('')
  const [selected, setSelected] = useState<Record<string, boolean>>({})
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Post | null>(null)
  const [page, setPage] = useState(1)
  const pageSize = 10

  useEffect(() => {
    (async () => {
      try {
        const r = await fetch('/api/blog?includeDrafts=true&page=1&pageSize=1000', { cache: 'no-store', credentials: 'include' })
        const d = await r.json()
        const arr = Array.isArray(d) ? d : Array.isArray(d?.items) ? d.items : []
        const mapped = arr.map((x: any, i: number) => ({ ...x, order: typeof x.order === 'number' ? x.order : i + 1, views: Number(x.views || 0), coverUrl: String(x.coverUrl || '') }))
        setList(mapped)
      } catch { setList([]) }
    })()
  }, [])

  const filtered = useMemo(() => {
    if (!keyword.trim()) return list
    const k = keyword.trim().toLowerCase()
    return list.filter((x) => [x.title, x.slug, x.content].some((t) => String(t || '').toLowerCase().includes(k)))
  }, [list, keyword])
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize))
  const paged = useMemo(() => {
    const start = (page - 1) * pageSize
    return filtered.slice(start, start + pageSize)
  }, [filtered, page])

  const toggleSelect = (id: string, v?: boolean) => setSelected((prev) => ({ ...prev, [id]: v ?? !prev[id] }))
  const selectAll = () => setSelected(Object.fromEntries(list.map(x => [x.id, true])))
  const batchDelete = async () => {
    if (!confirm('确认删除选中的记录吗？此操作不可恢复')) return
    const ids = Object.entries(selected).filter(([_, v]) => v).map(([id]) => id)
    if (!ids.length) return
    const next = list.filter(x => !ids.includes(x.id))
    setList(next)
    setSelected({})
    setSaving(true)
    try {
      await Promise.all(ids.map(id => fetch(`/api/blog?id=${encodeURIComponent(id)}`, { method: 'DELETE', credentials: 'include' })))
      setSavedHint('已批量删除')
    } finally { setSaving(false); setTimeout(() => setSavedHint(''), 1500) }
  }

  const saveAll = async () => {
    setSaving(true)
    setSavedHint('')
    const payload = list.map(x => ({ ...x }))
    try {
      const r = await fetch('/api/blog', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload), credentials: 'include' })
      setSavedHint(r.ok ? '已保存' : '保存失败或未登录')
    } finally { setSaving(false); setTimeout(() => setSavedHint(''), 1500) }
  }

  const saveOne = async (id: string, patch?: Partial<Post>) => {
    const item = list.find(x => x.id === id)
    if (!item) return
    const payload = { ...item, ...(patch || {}) }
    const r = await fetch('/api/blog', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload), credentials: 'include' })
    if (r.ok) {
      setList(prev => prev.map(x => x.id === id ? { ...x, ...payload, updatedAt: new Date().toISOString() } : x))
      setSavedHint('已保存')
      setTimeout(() => setSavedHint(''), 1500)
    }
  }

  const moveUp = (id: string) => {
    setList(prev => {
      const arr = prev.slice().sort((a,b)=>Number(a.order||0)-Number(b.order||0))
      const idx = arr.findIndex(x => x.id === id)
      if (idx > 0) {
        const a = arr[idx - 1], b = arr[idx]
        const t = a.order; a.order = b.order; b.order = t
      }
      return arr
    })
  }
  const moveDown = (id: string) => {
    setList(prev => {
      const arr = prev.slice().sort((a,b)=>Number(a.order||0)-Number(b.order||0))
      const idx = arr.findIndex(x => x.id === id)
      if (idx >= 0 && idx < arr.length - 1) {
        const a = arr[idx], b = arr[idx + 1]
        const t = a.order; a.order = b.order; b.order = t
      }
      return arr
    })
  }

  const openNew = () => {
    const ts = Date.now()
    setEditing({ id: `blog-${ts}`, title: '新文章', slug: `post-${ts}`, content: '', status: 'draft', order: (list[list.length-1]?.order || list.length) + 1, views: 0, coverUrl: '' })
    setModalOpen(true)
  }
  const openEdit = (item: Post) => { setEditing({ ...item }); setModalOpen(true) }
  const closeModal = () => { setModalOpen(false); setEditing(null) }
  const saveModal = async () => {
    if (!editing) return
    const payload = { ...editing }
    const r = await fetch('/api/blog', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload), credentials: 'include' })
    if (r.ok) {
      setList(prev => {
        const arr = prev.slice()
        const idx = arr.findIndex(x => x.id === payload.id)
        if (idx >= 0) arr[idx] = { ...arr[idx], ...payload }
        else arr.push(payload as Post)
        return arr
      })
      closeModal()
    }
  }
  const delItem = async (id: string) => {
    if (!confirm('确认删除该文章吗？此操作不可恢复')) return
    setList(prev => prev.filter(x => x.id !== id))
    const r = await fetch(`/api/blog?id=${encodeURIComponent(id)}`, { method: 'DELETE', credentials: 'include' })
    if (r.ok) { setSavedHint('已删除'); setTimeout(() => setSavedHint(''), 1500) }
  }

  return (
    <div className="p-8">
      <div className="bg-white rounded-lg shadow-sm border border-gray-100 flex flex-col min-h-[600px]">
        <div className="p-5 border-b border-gray-100 flex justify-between items-center bg-white rounded-t-lg">
          <div>
            <h2 className="font-bold text-gray-800 text-lg">博客管理</h2>
            <p className="text-xs text-gray-400 mt-1">管理文章列表、发布状态、排序和内容</p>
          </div>
          <div className="flex gap-3 items-center">
            <div className="relative">
              <input value={keyword} onChange={(e) => setKeyword(e.target.value)} type="text" placeholder="搜索文章..." className="pl-8 pr-3 py-2 border border-gray-200 rounded text-sm focus:outline-none focus:border-blue-500 w-56" />
              <Search className="absolute left-2.5 top-2.5 text-gray-400" size={14} />
            </div>
            <button onClick={openNew} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded text-sm flex items-center gap-1 transition-colors shadow-sm font-medium"><Plus size={16} /> 发新文章</button>
            <button onClick={selectAll} className="px-3 py-2 rounded border text-sm">全选</button>
            <button onClick={batchDelete} className="px-3 py-2 rounded border text-sm text-red-600 flex items-center gap-1"><Trash2 size={14} /> 批量删除</button>
            <button onClick={saveAll} disabled={saving} className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded text-sm flex items-center gap-1 transition-colors shadow-sm font-medium disabled:opacity-50"><Save size={16} /> 保存</button>
            {savedHint && <span className="text-xs text-gray-400">{savedHint}</span>}
          </div>
        </div>

        <div className="p-5">
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-gray-500">
                  <th className="text-left px-3 py-2">标题</th>
                  <th className="text-left px-3 py-2">状态</th>
                  <th className="text-left px-3 py-2">发布日期</th>
                  <th className="text-left px-3 py-2">最后修改</th>
                  <th className="text-left px-3 py-2">浏览量</th>
                  <th className="text-left px-3 py-2">操作</th>
                </tr>
              </thead>
              <tbody>
                {paged
                  .slice()
                  .sort((a,b)=>Number(a.order||0)-Number(b.order||0))
                  .map(item => (
                    <tr key={item.id} className="border-t border-gray-100">
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-2">
                          <input type="checkbox" checked={!!selected[item.id]} onChange={() => toggleSelect(item.id)} />
                          <div>
                            <div className="font-medium text-gray-800">
                              {item.title}
                              {Number(item.order||0) === 0 && (
                                <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded border border-amber-200 bg-amber-50 text-amber-700 text-xs">置顶</span>
                              )}
                            </div>
                            <div className="text-xs text-gray-400">/blog/{item.slug}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-3">
                        <select value={item.status} onChange={(e)=>{ const v=e.target.value; setList(prev=>prev.map(x=>x.id===item.id?{...x,status:v}:x)); saveOne(item.id,{ status: v }) }} className="border rounded px-2 py-1 text-xs">
                          <option value="draft">草稿</option>
                          <option value="published">已发布</option>
                        </select>
                      </td>
                      <td className="px-3 py-3 text-gray-600">{new Date(item.createdAt || Date.now()).toLocaleString()}</td>
                      <td className="px-3 py-3 text-gray-600">{new Date(item.updatedAt || Date.now()).toLocaleString()}</td>
                      <td className="px-3 py-3 text-gray-800">{Number(item.views||0)}</td>
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-2">
                          <button onClick={() => moveUp(item.id)} className="px-2 py-1 rounded border text-xs">上移</button>
                          <button onClick={() => moveDown(item.id)} className="px-2 py-1 rounded border text-xs">下移</button>
                          <button onClick={() => { setList(prev=>prev.map(x=>x.id===item.id?{...x,order:0}:x)); saveOne(item.id,{ order: 0 }) }} className="px-2 py-1 rounded border text-xs">置顶</button>
                          <button onClick={() => saveOne(item.id)} className="px-2 py-1 rounded border text-xs"><Save size={14} /></button>
                          <button onClick={() => openEdit(item)} className="px-2 py-1 rounded border text-xs"><Edit3 size={14} /></button>
                          <button onClick={() => delItem(item.id)} className="px-2 py-1 rounded border text-xs text-red-600"><Trash2 size={14} /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                {filtered.length === 0 && (
                  <tr><td className="px-3 py-6 text-sm text-gray-500" colSpan={6}>暂无文章，点击“发新文章”开始。</td></tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="mt-4">
            {(() => {
              const startIndex = (page - 1) * pageSize + 1
              const endIndex = Math.min(filtered.length, page * pageSize)
              const makeRange = () => {
                const pages: number[] = []
                if (totalPages <= 7) {
                  for (let i = 1; i <= totalPages; i++) pages.push(i)
                } else {
                  pages.push(1)
                  const left = Math.max(2, page - 2)
                  const right = Math.min(totalPages - 1, page + 2)
                  if (left > 2) pages.push(-1)
                  for (let i = left; i <= right; i++) pages.push(i)
                  if (right < totalPages - 1) pages.push(-1)
                  pages.push(totalPages)
                }
                return pages
              }
              const range = makeRange()
              return (
                <div className="bg-white border border-gray-200 rounded-xl px-4 py-3 flex items-center gap-3">
                  <span className="text-sm text-gray-600">第 {startIndex}-{endIndex} 条，共 {filtered.length} 篇文章</span>
                  <button onClick={()=>setPage(p=>Math.max(1,p-1))} disabled={page<=1} className="px-2 py-1 rounded border text-sm disabled:opacity-50">〈</button>
                  {range.map((n, idx) => n === -1 ? (
                    <span key={`dot-${idx}`} className="px-2 text-gray-400">···</span>
                  ) : (
                    <button key={n} onClick={()=>setPage(n)} className={`px-3 py-1 rounded border text-sm ${n===page?'border-blue-500 text-blue-600':'border-gray-200 text-gray-700 hover:border-gray-300'}`}>{n}</button>
                  ))}
                  <button onClick={()=>setPage(p=>Math.min(totalPages,p+1))} disabled={page>=totalPages} className="px-2 py-1 rounded border text-sm disabled:opacity-50">〉</button>
                  <span className="ml-auto text-sm text-gray-600">跳至</span>
                  <input type="number" min={1} max={totalPages} defaultValue={page} onKeyDown={(e)=>{ if (e.key==='Enter') { const v = Number((e.target as HTMLInputElement).value||1); setPage(Math.min(totalPages, Math.max(1, v))) } }} className="w-16 border rounded px-2 py-1 text-sm" />
                  <button onClick={(e)=>{ const input = (e.currentTarget.previousSibling as HTMLInputElement); const v = Number(input.value||1); setPage(Math.min(totalPages, Math.max(1, v))) }} className="px-3 py-1 rounded border text-sm">跳转</button>
                </div>
              )
            })()}
          </div>
        </div>
      </div>

      {modalOpen && editing && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl p-6">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-gray-800">{editing.id.startsWith('blog-')?'新文章':'编辑文章'}</h3>
              <button onClick={closeModal} className="text-gray-500">关闭</button>
            </div>
            <div className="mt-4 space-y-4">
              <div>
                <label className="block text-sm text-gray-600 mb-1">标题</label>
                <input value={editing.title} onChange={(e)=>setEditing(prev=>prev?{...prev,title:e.target.value}:prev)} className="w-full border rounded px-3 py-2 text-sm" />
              </div>
              <div className="flex items-center gap-4">
                <div className="flex-1">
                  <label className="block text-sm text-gray-600 mb-1">Slug</label>
                  <input value={editing.slug} onChange={(e)=>setEditing(prev=>prev?{...prev,slug:e.target.value}:prev)} className="w-full border rounded px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="block text-sm text-gray-600 mb-1">状态</label>
                  <select value={editing.status} onChange={(e)=>setEditing(prev=>prev?{...prev,status:e.target.value}:prev)} className="border rounded px-3 py-2 text-sm">
                    <option value="draft">草稿</option>
                    <option value="published">已发布</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">封面图 URL</label>
                <input value={editing.coverUrl || ''} onChange={(e)=>setEditing(prev=>prev?{...prev,coverUrl:e.target.value}:prev)} className="w-full border rounded px-3 py-2 text-sm" placeholder="https://..." />
                {(editing.coverUrl || '').trim() && (
                  <div className="mt-2"><img src={editing.coverUrl} alt="封面预览" className="max-h-40 rounded border" /></div>
                )}
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">正文（支持 Markdown）</label>
                <textarea value={editing.content} onChange={(e)=>setEditing(prev=>prev?{...prev,content:e.target.value}:prev)} className="w-full border rounded px-3 py-2 text-xs h-48" />
                <p className="mt-2 text-xs text-gray-500">提示：前台将进行安全渲染。</p>
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button onClick={closeModal} className="px-4 py-2 rounded border text-sm">取消</button>
              <button onClick={saveModal} className="px-4 py-2 rounded bg-blue-600 hover:bg-blue-700 text-white text-sm">保存</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}