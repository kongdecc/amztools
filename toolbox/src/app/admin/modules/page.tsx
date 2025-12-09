'use client'
import React, { useEffect, useMemo, useState } from 'react'
import { Box, Search, Plus, ChevronLeft, ChevronRight, ArrowUp, ArrowDown, Edit3, Trash2, Save, Ban, CheckCircle, RotateCcw } from 'lucide-react'

export default function AdminModules() {
  const [list, setList] = useState<Array<any>>([])
  const [categories, setCategories] = useState<Array<any>>([])
  const [editingId, setEditingId] = useState<string>('')
  const [keyword, setKeyword] = useState('')
  const [saving, setSaving] = useState(false)
  const [savedHint, setSavedHint] = useState('')
  const [selected, setSelected] = useState<Record<string, boolean>>({})
  const [originals, setOriginals] = useState<Record<string, any>>({})
  const [serverSnap, setServerSnap] = useState<Array<any>>([])
  useEffect(() => { (async () => { 
    const r = await fetch('/api/modules', { cache: 'no-store' }); 
    const d = await r.json(); 
    const mapped = (d || []).map((x: any, i: number) => ({ ...x, order: typeof x.order === 'number' && x.order > 0 ? x.order : i + 1 })); 
    setList(mapped); 
    setServerSnap(mapped.map((x: any) => ({ key: x.key, title: x.title, desc: x.desc, status: x.status, views: Number(x.views || 0), color: x.color || 'blue', order: Number(x.order || 0), category: x.category || 'other' }))) 
  
    try {
      const cr = await fetch('/api/categories', { cache: 'no-store' })
      const cd = await cr.json()
      setCategories(Array.isArray(cd) ? cd : [])
    } catch {}
  })() }, [])
  const filtered = useMemo(() => {
    if (!keyword.trim()) return list
    const k = keyword.trim().toLowerCase()
    return list.filter((x) => [x.title, x.key, x.desc].some((t: string) => String(t || '').toLowerCase().includes(k)))
  }, [list, keyword])
  const uidOf = (x: any) => x?.id ?? x?.key
  const isDirty = useMemo(() => {
    const norm = (arr: Array<any>) => arr.map((x: any) => ({ key: x.key, title: x.title, desc: x.desc, status: x.status, views: Number(x.views || 0), color: x.color || 'blue', order: Number(x.order || 0), category: x.category || 'other' })).sort((a: any, b: any) => a.key.localeCompare(b.key))
    try { return JSON.stringify(norm(list)) !== JSON.stringify(norm(serverSnap)) } catch { return false }
  }, [list, serverSnap])

function Badge({ text, color }: any) {
  const colors: any = {
    blue: 'bg-blue-50 text-blue-600 border-blue-100',
    indigo: 'bg-indigo-50 text-indigo-600 border-indigo-100',
    cyan: 'bg-cyan-50 text-cyan-600 border-cyan-100',
    violet: 'bg-violet-50 text-violet-600 border-violet-100',
    sky: 'bg-sky-50 text-sky-600 border-sky-100',
    purple: 'bg-purple-50 text-purple-600 border-purple-100',
    orange: 'bg-orange-50 text-orange-600 border-orange-100'
  }
  return <span className={`px-2.5 py-1 rounded text-xs border font-medium ${colors[color] || colors.blue}`}>{text}</span>
}

function StatusBadge({ status }: any) {
  const styles: any = {
    启用: 'bg-green-50 text-green-600 border-green-200',
    维护: 'bg-yellow-50 text-yellow-600 border-yellow-200',
    下架: 'bg-gray-100 text-gray-500 border-gray-200'
  }
  return <span className={`px-2 py-0.5 text-xs rounded border ${styles[status]}`}>{status}</span>
}

  const saveAll = async (newList: any[]) => {
    setSaving(true)
    setSavedHint('')
    try {
      const payload = newList.map(x => ({
        key: x.key,
        title: x.title,
        desc: x.desc,
        status: x.status,
        views: Number(x.views || 0),
        color: x.color || 'blue',
        order: Number(x.order || 0),
        category: x.category || 'other'
      }))
      const r = await fetch('/api/modules', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload), credentials: 'include' })
      if (!r.ok) throw new Error('保存失败')
      setSavedHint('已保存更改')
      // Update snapshots
      setServerSnap(newList.map((x: any) => ({ key: x.key, title: x.title, desc: x.desc, status: x.status, views: Number(x.views || 0), color: x.color || 'blue', order: Number(x.order || 0), category: x.category || 'other' })))
      setSelected({})
      setOriginals({})
    } catch {
      setSavedHint('保存失败')
    } finally {
      setSaving(false)
      setTimeout(() => setSavedHint(''), 2000)
    }
  }

  return (
    <div className="p-8">
      <div className="bg-white rounded-lg shadow-sm border border-gray-100 flex flex-col min-h-[600px]">
        <div className="p-5 border-b border-gray-100 flex justify-between items-center bg-white rounded-t-lg">
          <div>
            <h2 className="font-bold text-gray-800 text-lg">功能板块管理</h2>
            <p className="text-xs text-gray-400 mt-1">管理前台展示的工具模块、排序及状态</p>
          </div>
          <div className="flex gap-3">
            <div className="relative">
              <input value={keyword} onChange={(e) => setKeyword(e.target.value)} type="text" placeholder="搜索工具..." className="pl-8 pr-3 py-2 border border-gray-200 rounded text-sm focus:outline-none focus:border-blue-500 w-48" />
              <Search className="absolute left-2.5 top-2.5 text-gray-400" size={14} />
            </div>
            <button onClick={() => {
              const ts = Date.now()
              const key = `tool-${ts}`
              const item = { id: `mem-${ts}`, key, title: '新功能', desc: '', status: '启用', views: 0, color: 'blue', order: (list[list.length-1]?.order || list.length) + 1, isNew: true, category: 'other' }
              setList((prev) => [...prev, item])
              setEditingId(item.id)
            }} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded text-sm flex items-center gap-1 transition-colors shadow-sm font-medium"><Plus size={16} /> 新建功能</button>
            <button onClick={async () => {
              if (Object.keys(selected).filter(k => selected[k]).length === 0) {
                 await saveAll(list)
                 return
              }
              setSaving(true)
              // ... existing batch logic for selected items ...
              try {
                const keys = Object.keys(selected).filter(k => selected[k])
                const rows = list.filter((x) => keys.includes(uidOf(x)))
                for (const row of rows) {
                  const payload = { key: row.key, title: row.title, desc: row.desc, status: row.status, views: Number(row.views || 0), color: row.color || 'blue', order: Number(row.order || 0), category: row.category || 'other' }
                  const r = await fetch('/api/modules', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload), credentials: 'include' })
                  if (!r.ok) throw new Error('保存失败')
                }
                setSavedHint('已保存选中')
                // Refresh data
                const rr = await fetch('/api/modules', { cache: 'no-store' })
                const d = await rr.json()
                const mapped = (d || []).map((x: any, i: number) => ({ ...x, order: typeof x.order === 'number' && x.order > 0 ? x.order : i + 1 }))
                setList(mapped)
                setServerSnap(mapped.map((x: any) => ({ key: x.key, title: x.title, desc: x.desc, status: x.status, views: Number(x.views || 0), color: x.color || 'blue', order: Number(x.order || 0), category: x.category || 'other' })))
                setSelected({})
                setOriginals({})
              } catch {
                setSavedHint('保存失败')
              } finally {
                setSaving(false)
                setTimeout(() => setSavedHint(''), 2000)
              }
            }} className={`bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded text-sm flex items-center gap-1 transition-colors shadow-sm font-medium ${saving ? 'opacity-70 cursor-not-allowed' : ''}`}><Save size={16} /> {isDirty && Object.keys(selected).filter(k => selected[k]).length === 0 ? '保存全部更改' : '保存所选'}{savedHint ? `（${savedHint}）` : ''}</button>
            <button onClick={async () => {
              if (isDirty) {
                const ok = confirm('有未保存的更改，返回将不保存，确认返回？')
                if (!ok) return
              }
              const rr = await fetch('/api/modules', { cache: 'no-store' })
              const d = await rr.json()
              const mapped = (d || []).map((x: any, i: number) => ({ ...x, order: typeof x.order === 'number' && x.order > 0 ? x.order : i + 1 }))
              setList(mapped)
              setServerSnap(mapped.map((x: any) => ({ key: x.key, title: x.title, desc: x.desc, status: x.status, views: Number(x.views || 0), color: x.color || 'blue', order: Number(x.order || 0), category: x.category || 'other' })))
              setEditingId('')
              setSelected({})
              setOriginals({})
            }} className="border border-gray-200 text-gray-700 px-4 py-2 rounded text-sm flex items-center gap-1 hover:bg-gray-50 transition-colors"><RotateCcw size={16} /> 取消/返回</button>
          </div>
        </div>
        {Object.values(selected).filter(Boolean).length > 0 && (
          <div className="px-5 py-3 border-b border-gray-100 bg-gray-50 flex items-center justify-between text-sm">
            <div className="text-gray-600">已选 {Object.values(selected).filter(Boolean).length} 项</div>
            <div className="flex items-center gap-2">
              <button onClick={() => {
                const keys = Object.keys(selected).filter(k => selected[k])
                setList((prev) => prev.map((x) => keys.includes(uidOf(x)) ? { ...x, status: '下架' } : x))
              }} className="px-3 py-1.5 rounded border text-gray-700 hover:bg-gray-100 flex items-center gap-1"><Ban size={14} /> 批量下架</button>
              <button onClick={() => {
                const keys = Object.keys(selected).filter(k => selected[k])
                setList((prev) => prev.map((x) => keys.includes(uidOf(x)) ? { ...x, status: '启用' } : x))
              }} className="px-3 py-1.5 rounded border text-gray-700 hover:bg-gray-100 flex items-center gap-1"><CheckCircle size={14} /> 批量启用</button>
              <button onClick={() => {
                if (!confirm('确认删除所选功能？删除需点击“保存更改”后生效')) return
                const keys = Object.keys(selected).filter(k => selected[k])
                setList((prev) => prev.filter((x) => !keys.includes(uidOf(x))))
                setSelected({})
              }} className="px-3 py-1.5 rounded border text-red-600 hover:bg-red-50 flex items-center gap-1"><Trash2 size={14} /> 批量删除</button>
            </div>
          </div>
        )}
        <div className="flex-1 overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[#f8f9fb] text-gray-500 text-xs font-semibold uppercase tracking-wider border-y border-gray-100">
                <th className="p-4 w-10"><input type="checkbox" className="rounded border-gray-300" onChange={(e) => {
                  const v = e.target.checked
                  const next: Record<string, boolean> = { ...selected }
                  filtered.forEach((row: any) => { next[uidOf(row)] = v })
                  setSelected(next)
                }} checked={filtered.length>0 && filtered.every((row: any) => selected[uidOf(row)])} /></th>
                <th className="p-4 w-16">排序</th>
                <th className="p-4 w-40">工具名称</th>
                <th className="p-4 w-32">唯一标识 (Key)</th>
                <th className="p-4 w-32">分类</th>
                <th className="p-4">功能描述</th>
                <th className="p-4 w-24">访问热度</th>
                <th className="p-4 w-24">状态</th>
                <th className="p-4 w-40">更新时间</th>
                <th className="p-4 w-48 text-center">操作</th>
              </tr>
            </thead>
            <tbody className="text-sm text-gray-600 divide-y divide-gray-50">
              {filtered.map((row: any, idx: number) => (
                <tr key={row.id || row.key} className="hover:bg-blue-50/40 transition-colors group">
                  <td className="p-4"><input type="checkbox" className="rounded border-gray-300" checked={!!selected[uidOf(row)]} onChange={(e) => {
                    const id = uidOf(row)
                    const v = e.target.checked
                    setSelected((prev) => ({ ...prev, [id]: v }))
                  }} /></td>
                  <td className="p-4 font-mono text-gray-400">{idx + 1}</td>
                  <td className="p-4">
                    {editingId === uidOf(row) ? (
                      <input value={row.title} onChange={(e) => setList((prev) => prev.map((x) => (x.id ?? x.key) === (row.id ?? row.key) ? { ...x, title: e.target.value } : x))} className="w-40 border rounded px-2 py-1 text-sm" />
                    ) : (
                      <Badge text={row.title} color={row.color} />
                    )}
                  </td>
                  <td className="p-4 font-mono text-xs text-gray-500">
                    {editingId === uidOf(row) ? (
                      <input value={row.key} onChange={(e) => setList((prev) => prev.map((x) => (x.id ?? x.key) === (row.id ?? row.key) ? { ...x, key: e.target.value } : x))} className="w-32 border rounded px-2 py-1 text-xs font-mono" />
                    ) : row.key}
                  </td>
                  <td className="p-4 text-sm">
                    {editingId === uidOf(row) ? (
                      <select value={row.category || 'other'} onChange={(e) => setList((prev) => prev.map((x) => (x.id ?? x.key) === (row.id ?? row.key) ? { ...x, category: e.target.value } : x))} className="border rounded px-2 py-1 text-sm w-28">
                        {categories.map(c => <option key={c.key} value={c.key}>{c.label}</option>)}
                      </select>
                    ) : (
                      <span className="px-2 py-1 rounded text-xs bg-gray-100 text-gray-600">
                        {categories.find(c => c.key === row.category)?.label || row.category || '其他'}
                      </span>
                    )}
                  </td>
                  <td className="p-4 text-gray-500 max-w-xs" title={row.desc}>
                    {editingId === uidOf(row) ? (
                      <input value={row.desc || ''} onChange={(e) => setList((prev) => prev.map((x) => (x.id ?? x.key) === (row.id ?? row.key) ? { ...x, desc: e.target.value } : x))} className="w-full border rounded px-2 py-1 text-sm" />
                    ) : (
                      <span className="truncate block max-w-xs">{row.desc}</span>
                    )}
                  </td>
                  <td className="p-4 font-medium text-gray-700">
                    {editingId === uidOf(row) ? (
                      <input type="number" value={row.views ?? 0} onChange={(e) => setList((prev) => prev.map((x) => (x.id ?? x.key) === (row.id ?? row.key) ? { ...x, views: Number(e.target.value || 0) } : x))} className="w-24 border rounded px-2 py-1 text-sm text-right" />
                    ) : row.views}
                  </td>
                  <td className="p-4">
                    {editingId === uidOf(row) ? (
                      <select value={row.status} onChange={(e) => setList((prev) => prev.map((x) => (x.id ?? x.key) === (row.id ?? row.key) ? { ...x, status: e.target.value } : x))} className="border rounded px-2 py-1 text-sm">
                        <option value="启用">启用</option>
                        <option value="维护">维护</option>
                        <option value="下架">下架</option>
                      </select>
                    ) : (
                      <StatusBadge status={row.status} />
                    )}
                  </td>
                  <td className="p-4 text-gray-400 text-xs">{row.updatedAt?.slice?.(0,10) || ''}</td>
                  <td className="p-4">
                    <div className="flex items-center justify-center gap-2 opacity-60 group-hover:opacity-100 transition-opacity">
                      <button onClick={async () => {
                        const idx0 = list.findIndex((x) => (x.id ?? x.key) === (row.id ?? row.key))
                        if (idx0 <= 0) return
                        const copy = [...list]
                        const tmp = copy[idx0 - 1]
                        copy[idx0 - 1] = copy[idx0]
                        copy[idx0] = tmp
                        const mapped = copy.map((x, i) => ({ ...x, order: i + 1 }))
                        setList(mapped)
                        await saveAll(mapped)
                      }} className="p-1.5 hover:bg-gray-100 rounded text-gray-400 hover:text-blue-600" title="上移"><ArrowUp size={14} /></button>
                      <button onClick={async () => {
                        const idx0 = list.findIndex((x) => (x.id ?? x.key) === (row.id ?? row.key))
                        if (idx0 < 0 || idx0 >= list.length - 1) return
                        const copy = [...list]
                        const tmp = copy[idx0 + 1]
                        copy[idx0 + 1] = copy[idx0]
                        copy[idx0] = tmp
                        const mapped = copy.map((x, i) => ({ ...x, order: i + 1 }))
                        setList(mapped)
                        await saveAll(mapped)
                      }} className="p-1.5 hover:bg-gray-100 rounded text-gray-400 hover:text-blue-600" title="下移"><ArrowDown size={14} /></button>
                      <div className="w-px h-3 bg-gray-200 mx-1"></div>
                      {editingId === uidOf(row) ? (
                        <>
                          <button onClick={async () => {
                            const payload = { key: row.key, title: row.title, desc: row.desc, status: row.status, views: Number(row.views || 0), color: row.color || 'blue', order: Number(row.order || 0), category: row.category || 'other' }
                            try {
                              const r = await fetch('/api/modules', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload), credentials: 'include' })
                              if (r.ok) {
                                const rr = await fetch('/api/modules', { cache: 'no-store' })
                                const d = await rr.json()
                                const mapped = (d || []).map((x: any, i: number) => ({ ...x, order: typeof x.order === 'number' && x.order > 0 ? x.order : i + 1 }))
                                setList(mapped)
                                setServerSnap(mapped.map((x: any) => ({ key: x.key, title: x.title, desc: x.desc, status: x.status, views: Number(x.views || 0), color: x.color || 'blue', order: Number(x.order || 0), category: x.category || 'other' })))
                                setEditingId('')
                                setOriginals((prev) => { const n: any = { ...prev }; delete n[uidOf(row)]; return n })
                              } else {
                                alert('保存失败')
                              }
                            } catch { alert('保存失败') }
                          }} className="flex items-center gap-1 text-green-600 hover:text-green-800 px-2 py-1 rounded hover:bg-green-50"><Save size={14} />保存该记录</button>
                          <button onClick={() => { setEditingId(''); setOriginals((prev) => { const n: any = { ...prev }; delete n[uidOf(row)]; return n }) }} className="flex items-center gap-1 text-blue-600 hover:text-blue-800 px-2 py-1 rounded hover:bg-blue-50"><Edit3 size={14} />完成</button>
                          <button onClick={() => {
                            const id = uidOf(row)
                            const orig = originals[id]
                            if (orig) {
                              setList((prev) => prev.map((x) => uidOf(x) === id ? orig : x))
                            } else if (String(row.id || '').startsWith('mem-') || row.isNew) {
                              setList((prev) => prev.filter((x) => uidOf(x) !== id))
                            }
                            setEditingId('')
                            setOriginals((prev) => { const n: any = { ...prev }; delete n[id]; return n })
                          }} className="flex items-center gap-1 text-gray-600 hover:text-gray-800 px-2 py-1 rounded hover:bg-gray-100"><RotateCcw size={14} />取消</button>
                        </>
                      ) : (
                        <button onClick={() => { const id = uidOf(row); setOriginals((prev) => ({ ...prev, [id]: row })); setEditingId(id) }} className="flex items-center gap-1 text-blue-600 hover:text-blue-800 px-2 py-1 rounded hover:bg-blue-50"><Edit3 size={14} />编辑</button>
                      )}
                      <button onClick={() => setList((prev) => prev.map((x) => (x.id ?? x.key) === (row.id ?? row.key) ? { ...x, status: '下架' } : x))} className="flex items-center gap-1 text-gray-600 hover:text-gray-800 px-2 py-1 rounded hover:bg-gray-100"><Ban size={14} />下架</button>
                      <button onClick={() => { if (!confirm('确认删除该功能？删除需点击“保存更改”后生效')) return; setList((prev) => prev.filter((x) => (x.id ?? x.key) !== (row.id ?? row.key))) }} className="flex items-center gap-1 text-red-600 hover:text-red-700 px-2 py-1 rounded hover:bg-red-50"><Trash2 size={14} />删除</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="p-4 border-t border-gray-100 flex justify-between items-center text-sm text-gray-500">
          <div>共 {filtered.length} 条记录</div>
          <div className="flex items-center gap-2">
            <button className="w-8 h-8 flex items-center justify-center border rounded hover:bg-gray-50 disabled:opacity-50" disabled><ChevronLeft size={16} /></button>
            <button className="w-8 h-8 flex items-center justify-center bg-blue-600 text-white rounded border border-blue-600 shadow-sm">1</button>
            <button className="w-8 h-8 flex items-center justify-center border rounded hover:bg-gray-50"><ChevronRight size={16} /></button>
          </div>
        </div>
      </div>
    </div>
  )
}