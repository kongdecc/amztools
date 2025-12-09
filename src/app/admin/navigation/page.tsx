'use client'

import React, { useEffect, useMemo, useState, useRef } from 'react'
import { Plus, Search, Edit3, Trash2, Save, Ban, CheckCircle, Link as LinkIcon, Globe, ArrowUp, ArrowDown, GripVertical } from 'lucide-react'

type NavItem = { id: string; label: string; href: string; order: number; isExternal?: boolean; active?: boolean }

export default function AdminNavigation() {
  const [list, setList] = useState<NavItem[]>([])
  const [editingId, setEditingId] = useState<string>('')
  const [keyword, setKeyword] = useState('')
  const [saving, setSaving] = useState(false)
  const [savedHint, setSavedHint] = useState('')
  const [selected, setSelected] = useState<Record<string, boolean>>({})
  const [serverSnap, setServerSnap] = useState<NavItem[]>([])
  const [draggingId, setDraggingId] = useState<string>('')
  const [dragOverId, setDragOverId] = useState<string>('')

  // 拖拽开始
  const handleDragStart = (e: React.DragEvent, id: string) => {
    setDraggingId(id)
    e.dataTransfer.effectAllowed = 'move'
  }

  // 拖拽进入
  const handleDragEnter = (e: React.DragEvent, id: string) => {
    e.preventDefault()
    if (draggingId !== id) {
      setDragOverId(id)
    }
  }

  // 拖拽结束
  const handleDragEnd = () => {
    setDraggingId('')
    setDragOverId('')
  }

  // 拖拽放置
  const handleDrop = (e: React.DragEvent, id: string) => {
    e.preventDefault()
    if (draggingId === id) return

    const draggingItem = list.find(item => item.id === draggingId)
    const targetItem = list.find(item => item.id === id)

    if (!draggingItem || !targetItem) return

    // 重新排序
    const sorted = list.slice().sort((a, b) => a.order - b.order)
    const draggingIndex = sorted.findIndex(item => item.id === draggingId)
    const targetIndex = sorted.findIndex(item => item.id === id)

    const newSorted = [...sorted]
    newSorted.splice(draggingIndex, 1)
    newSorted.splice(targetIndex, 0, draggingItem)

    // 更新order值
    const updatedList = newSorted.map((item, index) => ({
      ...item,
      order: index + 1
    }))

    setList(updatedList)
    setDraggingId('')
    setDragOverId('')
  }

  useEffect(() => {
    (async () => {
      const r = await fetch('/api/navigation?includeInactive=true', { cache: 'no-store' })
      const d = await r.json()
      const arr: NavItem[] = Array.isArray(d) ? d : []
      const mapped = arr.map((x, i) => ({ ...x, order: typeof x.order === 'number' && x.order > 0 ? x.order : i + 1, active: x.active === false ? false : true, isExternal: x.isExternal === true }))
      setList(mapped)
      setServerSnap(mapped.map(x => ({ ...x })))
    })()
  }, [])

  const filtered = useMemo(() => {
    if (!keyword.trim()) return list
    const k = keyword.trim().toLowerCase()
    return list.filter(x => [x.label, x.href, x.id].some(t => String(t || '').toLowerCase().includes(k)))
  }, [list, keyword])

  // 自动保存逻辑
  useEffect(() => {
    if (JSON.stringify(list) === JSON.stringify(serverSnap)) return
    
    const saveTimeout = setTimeout(async () => {
      setSaving(true)
      setSavedHint('')
      try {
        // 确保order值唯一且连续
        const sorted = list.slice().sort((a, b) => a.order - b.order)
        const payload = sorted.map((x, index) => ({
          id: x.id, 
          label: x.label, 
          href: x.href, 
          order: index + 1, 
          isExternal: Boolean(x.isExternal), 
          active: x.active === false ? false : true 
        }))
        const r = await fetch('/api/navigation', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload), credentials: 'include' })
        if (!r.ok) throw new Error('保存失败')
        const rr = await fetch('/api/navigation?includeInactive=true', { cache: 'no-store' })
        const d = await rr.json()
        const mapped = (Array.isArray(d) ? d : []).map((x: any, i: number) => ({ ...x, order: typeof x.order === 'number' && x.order > 0 ? x.order : i + 1, active: x.active === false ? false : true, isExternal: x.isExternal === true }))
        setServerSnap(mapped.map((x: any) => ({ ...x })))
        setSavedHint('已自动保存')
      } catch {
        setSavedHint('保存失败')
      } finally {
        setSaving(false)
        setTimeout(() => setSavedHint(''), 2000)
      }
    }, 500) // 500ms防抖

    return () => clearTimeout(saveTimeout)
  }, [list, serverSnap])

  const isDirty = useMemo(() => {
    const norm = (arr: NavItem[]) => arr.map(x => ({ id: x.id, label: x.label, href: x.href, order: Number(x.order || 0), isExternal: Boolean(x.isExternal), active: x.active === false ? false : true })).sort((a, b) => a.id.localeCompare(b.id))
    const a = JSON.stringify(norm(serverSnap))
    const b = JSON.stringify(norm(list))
    return a !== b
  }, [list, serverSnap])

  return (
    <div className="p-8">
      <div className="bg-white rounded-lg shadow-sm border border-gray-100 flex flex-col min-h-[600px]">
        <div className="p-5 border-b border-gray-100 flex justify-between items-center bg-white rounded-t-lg">
          <div>
            <h2 className="font-bold text-gray-800 text-lg">导航菜单管理</h2>
            <p className="text-xs text-gray-400 mt-1">编辑、删除、隐藏/启用导航项，支持外链</p>
          </div>
          <div className="flex gap-3">
            <div className="relative">
              <input value={keyword} onChange={(e) => setKeyword(e.target.value)} type="text" placeholder="搜索菜单..." className="pl-8 pr-3 py-2 border border-gray-200 rounded text-sm focus:outline-none focus:border-blue-500 w-48" />
              <Search className="absolute left-2.5 top-2.5 text-gray-400" size={14} />
            </div>
            <button onClick={() => {
              const ts = Date.now()
              const id = `nav-${ts}`
              const item: NavItem = { id, label: '新菜单', href: '/', order: (list[list.length-1]?.order || list.length) + 1, isExternal: false, active: true }
              setList(prev => [...prev, item])
              setEditingId(id)
            }} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded text-sm flex items-center gap-1 transition-colors shadow-sm font-medium"><Plus size={16} /> 新建菜单</button>
            <button onClick={async () => {
              setSaving(true)
              setSavedHint('')
              try {
                // 确保order值唯一且连续
                const sorted = list.slice().sort((a, b) => a.order - b.order)
                const payload = sorted.map((x, index) => ({
                  id: x.id, 
                  label: x.label, 
                  href: x.href, 
                  order: index + 1, 
                  isExternal: Boolean(x.isExternal), 
                  active: x.active === false ? false : true 
                }))
                const r = await fetch('/api/navigation', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload), credentials: 'include' })
                if (!r.ok) throw new Error('保存失败')
                const rr = await fetch('/api/navigation?includeInactive=true', { cache: 'no-store' })
                const d = await rr.json()
                const mapped = (Array.isArray(d) ? d : []).map((x: any, i: number) => ({ ...x, order: typeof x.order === 'number' && x.order > 0 ? x.order : i + 1, active: x.active === false ? false : true, isExternal: x.isExternal === true }))
                setList(mapped)
                setServerSnap(mapped.map((x: any) => ({ ...x })))
                setSelected({})
                setSavedHint('已保存全部')
              } catch {
                setSavedHint('保存失败')
              } finally {
                setSaving(false)
                setTimeout(() => setSavedHint(''), 2000)
              }
            }} className={`bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded text-sm flex items-center gap-1 transition-colors shadow-sm font-medium ${saving ? 'opacity-70 cursor-not-allowed' : ''}`}><Save size={16} /> 保存全部{savedHint ? `（${savedHint}）` : ''}</button>
          </div>
        </div>

        <div className="px-5 py-3 border-b border-gray-100 bg-gray-50 flex items-center justify-between text-sm">
          <div className="text-gray-600">{isDirty ? '存在未保存更改' : '无更改'} · 已选 {Object.values(selected).filter(Boolean).length} 项</div>
          <div className="flex items-center gap-2">
            <button onClick={() => setSelected(prev => { const next: Record<string, boolean> = { ...prev }; filtered.forEach(x => { next[x.id] = true }); return next })} className="px-2 py-1 rounded border text-gray-600 hover:bg-gray-100">全选</button>
            <button onClick={() => setSelected({})} className="px-2 py-1 rounded border text-gray-600 hover:bg-gray-100">清空选择</button>
            <button onClick={async () => {
              const ids = Object.keys(selected).filter(k => selected[k])
              if (ids.length === 0) { setSavedHint('请先选择'); setTimeout(() => setSavedHint(''), 1500); return }
              if (!confirm(`确认删除选中的 ${ids.length} 项？`)) return
              try {
                for (const id of ids) {
                  const r = await fetch(`/api/navigation?id=${encodeURIComponent(id)}`, { method: 'DELETE', credentials: 'include' })
                  if (!r.ok) throw new Error('删除失败')
                }
                setList(prev => prev.filter(x => !ids.includes(x.id)))
                setServerSnap(prev => prev.filter(x => !ids.includes(x.id)))
                setSelected({})
                setSavedHint('已批量删除')
              } catch {
                setSavedHint('批量删除失败')
              } finally {
                setTimeout(() => setSavedHint(''), 2000)
              }
            }} className="px-2 py-1 rounded border text-red-600 hover:bg-red-50">批量删除</button>
          </div>
        </div>

        <div className="flex-1 overflow-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="p-3 text-left text-xs font-medium text-gray-500">选择</th>
                <th className="p-3 text-left text-xs font-medium text-gray-500">排序</th>
                <th className="p-3 text-left text-xs font-medium text-gray-500">标题</th>
                <th className="p-3 text-left text-xs font-medium text-gray-500">链接</th>
                <th className="p-3 text-left text-xs font-medium text-gray-500">外链</th>
                <th className="p-3 text-left text-xs font-medium text-gray-500">状态</th>
                <th className="p-3 text-center text-xs font-medium text-gray-500">操作</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(row => (
                <tr 
                  key={row.id} 
                  className={`group border-b transition-all duration-200 ${draggingId === row.id ? 'opacity-50' : ''} ${dragOverId === row.id ? 'bg-blue-50' : ''}`}
                  draggable={editingId !== row.id}
                  onDragStart={(e) => handleDragStart(e, row.id)}
                  onDragEnter={(e) => handleDragEnter(e, row.id)}
                  onDragEnd={handleDragEnd}
                  onDrop={(e) => handleDrop(e, row.id)}
                  onDragOver={(e) => e.preventDefault()}
                >
                  <td className="p-4">
                    <input type="checkbox" checked={!!selected[row.id]} onChange={e => setSelected(prev => ({ ...prev, [row.id]: e.target.checked }))} />
                  </td>
                  <td className="p-4">
                    <div className="flex items-center gap-2">
                      {editingId !== row.id && (
                        <GripVertical 
                          size={16} 
                          className="text-gray-400 cursor-grab active:cursor-grabbing hover:text-gray-600 transition-colors"
                        />
                      )}
                      {editingId === row.id ? (
                        <input type="number" value={row.order ?? 0} onChange={e => setList(prev => prev.map(x => x.id === row.id ? { ...x, order: Number(e.target.value || 0) } : x))} className="w-20 border rounded px-2 py-1 text-sm text-right" />
                      ) : (
                        <span className="text-gray-700">{row.order ?? 0}</span>
                      )}
                    </div>
                  </td>
                  <td className="p-4">
                    {editingId === row.id ? (
                      <div className="flex flex-col gap-1">
                        <input type="text" value={row.label} onChange={e => setList(prev => prev.map(x => x.id === row.id ? { ...x, label: e.target.value } : x))} className="w-48 border rounded px-2 py-1 text-sm" />
                        <div className="flex gap-1">
                          {['❤️', '☕', '👍', '⭐', '🎉', '🎁', '🔥'].map(emoji => (
                            <button key={emoji} onClick={() => setList(prev => prev.map(x => x.id === row.id ? { ...x, label: x.label + emoji } : x))} className="text-xs hover:bg-gray-100 p-0.5 rounded border border-transparent hover:border-gray-200" title="插入表情">{emoji}</button>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2"><span className="font-medium text-gray-800">{row.label}</span></div>
                    )}
                  </td>
                  <td className="p-4">
                    {editingId === row.id ? (
                      <input type="text" value={row.href} onChange={e => setList(prev => prev.map(x => x.id === row.id ? { ...x, href: e.target.value } : x))} className="w-72 border rounded px-2 py-1 text-sm" />
                    ) : (
                      <div className="flex items-center gap-2 text-gray-600"><LinkIcon size={16} /> <span className="truncate max-w-[300px]">{row.href}</span></div>
                    )}
                  </td>
                  <td className="p-4">
                    {editingId === row.id ? (
                      <label className="inline-flex items-center gap-2 text-sm text-gray-600"><input type="checkbox" checked={!!row.isExternal} onChange={e => setList(prev => prev.map(x => x.id === row.id ? { ...x, isExternal: e.target.checked } : x))} /> 外链</label>
                    ) : (
                      row.isExternal ? <span className="px-2 py-0.5 text-xs rounded border bg-indigo-50 text-indigo-600 border-indigo-200">外链</span> : <span className="px-2 py-0.5 text-xs rounded border bg-gray-50 text-gray-500 border-gray-200">站内</span>
                    )}
                  </td>
                  <td className="p-4">
                    <button onClick={() => setList(prev => prev.map(x => x.id === row.id ? { ...x, active: !x.active } : x))} className={`px-2 py-1 text-xs rounded border ${row.active ? 'bg-green-50 text-green-600 border-green-200' : 'bg-gray-100 text-gray-500 border-gray-200'}`}>{row.active ? '启用' : '隐藏'}</button>
                  </td>
                  <td className="p-4">
                    <div className="flex items-center justify-center gap-2 opacity-60 group-hover:opacity-100 transition-opacity">
                      {editingId === row.id ? (
                        <>
                          <button onClick={async () => {
                            setSaving(true)
                            setSavedHint('')
                            try {
                              const payload = { id: row.id, label: row.label, href: row.href, order: Number(row.order || 0), isExternal: Boolean(row.isExternal), active: row.active === false ? false : true }
                              const r = await fetch('/api/navigation', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload), credentials: 'include' })
                              if (!r.ok) throw new Error('保存失败')
                              setEditingId('')
                              setSavedHint('已保存此项')
                              const rr = await fetch('/api/navigation?includeInactive=true', { cache: 'no-store' })
                              const d = await rr.json()
                              const mapped = (Array.isArray(d) ? d : []).map((x: any, i: number) => ({ ...x, order: typeof x.order === 'number' && x.order > 0 ? x.order : i + 1, active: x.active === false ? false : true, isExternal: x.isExternal === true }))
                              setList(mapped)
                              setServerSnap(mapped.map((x: any) => ({ ...x })))
                            } catch {
                              setSavedHint('保存失败')
                            } finally {
                              setSaving(false)
                              setTimeout(() => setSavedHint(''), 2000)
                            }
                          }} className="flex items-center gap-1 text-blue-600 hover:text-blue-700 px-2 py-1 rounded"><Save size={16} /> 保存此项</button>
                          <button onClick={() => setEditingId('')} className="flex items-center gap-1 text-gray-600 hover:text-gray-700 px-2 py-1 rounded"><CheckCircle size={16} /> 完成</button>
                          <button onClick={() => setList(prev => prev.map(x => x.id === row.id ? serverSnap.find(s => s.id === row.id) || x : x))} className="flex items-center gap-1 text-gray-400 hover:text-gray-500 px-2 py-1 rounded"><Ban size={16} /> 取消</button>
                        </>
                      ) : (
                        <>
                          <button onClick={() => setEditingId(row.id)} className="flex items-center gap-1 text-indigo-600 hover:text-indigo-700 px-2 py-1 rounded"><Edit3 size={16} /> 编辑</button>
                          <button onClick={() => {
                            const sorted = list.slice().sort((a, b) => (a.order || 0) - (b.order || 0))
                            const idx = sorted.findIndex(x => x.id === row.id)
                            if (idx <= 0) return
                            const above = sorted[idx - 1]
                            const current = sorted[idx]
                            setList(prev => prev.map(x => x.id === above.id ? { ...x, order: current.order } : x.id === current.id ? { ...x, order: above.order } : x))
                          }} className="flex items-center gap-1 text-gray-600 hover:text-gray-800 px-2 py-1 rounded"><ArrowUp size={16} /> 上移</button>
                          <button onClick={() => {
                            const sorted = list.slice().sort((a, b) => (a.order || 0) - (b.order || 0))
                            const idx = sorted.findIndex(x => x.id === row.id)
                            if (idx >= sorted.length - 1) return
                            const current = sorted[idx]
                            const below = sorted[idx + 1]
                            setList(prev => prev.map(x => x.id === below.id ? { ...x, order: current.order } : x.id === current.id ? { ...x, order: below.order } : x))
                          }} className="flex items-center gap-1 text-gray-600 hover:text-gray-800 px-2 py-1 rounded"><ArrowDown size={16} /> 下移</button>
                          <button onClick={async () => {
                            if (!confirm('确认删除该菜单？')) return
                            try {
                              const r = await fetch(`/api/navigation?id=${encodeURIComponent(row.id)}`, { method: 'DELETE', credentials: 'include' })
                              if (!r.ok) throw new Error('删除失败')
                              setList(prev => prev.filter(x => x.id !== row.id))
                              setServerSnap(prev => prev.filter(x => x.id !== row.id))
                              setSavedHint('已删除')
                            } catch {
                              setSavedHint('删除失败')
                            } finally {
                              setTimeout(() => setSavedHint(''), 2000)
                            }
                          }} className="flex items-center gap-1 text-red-600 hover:text-red-700 px-2 py-1 rounded"><Trash2 size={16} /> 删除</button>
                        </>
                      )}
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
            <div className="flex items-center gap-2 text-gray-500"><Globe size={16} /> 导航预览</div>
            <div className="flex items-center gap-3">
              {list.slice().sort((a, b) => a.order - b.order).map(item => (
                <div key={item.id} className="flex items-center gap-2 text-sm">
                  <span className="font-medium text-gray-800">{item.label}</span>
                  {item.isExternal ? <span className="text-xs px-2 py-0.5 rounded border bg-indigo-50 text-indigo-600 border-indigo-200">外链</span> : null}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}