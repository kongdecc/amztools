"use client"

import React, { useEffect, useState } from 'react'
import { Send } from 'lucide-react'

type Item = { id: string; nickname: string; content: string; createdAt: string }

export default function AdminSuggest() {
  const [list, setList] = useState<Item[]>([])
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const pageSize = 10
  const [selected, setSelected] = useState<string[]>([])
  useEffect(() => {
    const load = async () => {
      try {
        const r = await fetch(`/api/suggest?page=${page}&pageSize=${pageSize}`, { cache: 'no-store', credentials: 'include' })
        const d = await r.json()
        const arr = Array.isArray(d?.items) ? d.items : []
        setList(arr)
        setTotal(Number(d?.total || arr.length || 0))
        setSelected([])
      } catch { setList([]); setTotal(0) }
    }
    load()
  }, [page])
  const allChecked = list.length > 0 && selected.length === list.length
  const toggleAll = (checked: boolean) => {
    setSelected(checked ? list.map(i => i.id) : [])
  }
  const toggleOne = (id: string, checked: boolean) => {
    setSelected(prev => {
      const set = new Set(prev)
      if (checked) set.add(id)
      else set.delete(id)
      return Array.from(set)
    })
  }
  const deleteSelected = async () => {
    if (!selected.length) return
    if (!confirm(`确认删除选中的 ${selected.length} 条留言？`)) return
    try {
      const r = await fetch(`/api/suggest?ids=${encodeURIComponent(selected.join(','))}` , { method: 'DELETE', credentials: 'include' })
      if (!r.ok) throw new Error('删除失败')
      setList(prev => prev.filter(x => !selected.includes(x.id)))
      setTotal(t => Math.max(0, t - selected.length))
      setSelected([])
    } catch {}
  }
  return (
    <div className="bg-white p-6 rounded-lg border border-gray-100 shadow-sm">
      <div className="flex items-center gap-2 mb-4"><Send className="h-5 w-5 text-blue-600" /><h3 className="font-bold text-gray-800">用户提需求留言</h3></div>
      <div className="text-xs text-gray-500 mb-4">无需注册的留言将显示在此列表。可用于收集用户建议与需求。</div>
      <div className="mb-3 flex items-center gap-3">
        <label className="flex items-center gap-2 text-sm text-gray-700"><input type="checkbox" checked={allChecked} onChange={e=>toggleAll(e.target.checked)} /> 全选</label>
        <button onClick={deleteSelected} disabled={!selected.length} className="px-3 py-1.5 rounded border text-sm disabled:opacity-50">删除选中</button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-gray-600 border-b border-gray-200">
              <th className="py-2 pr-3 w-10"></th>
              <th className="py-2 pr-3">昵称</th>
              <th className="py-2 pr-3">内容</th>
              <th className="py-2 pr-3 w-40">时间</th>
              <th className="py-2 pr-3 w-24">操作</th>
            </tr>
          </thead>
          <tbody>
            {list.map(item => (
              <tr key={item.id} className="border-b border-gray-100">
                <td className="py-2 pr-3"><input type="checkbox" checked={selected.includes(item.id)} onChange={e=>toggleOne(item.id, e.target.checked)} /></td>
                <td className="py-2 pr-3 font-medium text-gray-800">{item.nickname}</td>
                <td className="py-2 pr-3 text-gray-700 whitespace-pre-line break-words">{item.content}</td>
                <td className="py-2 pr-3 text-gray-500">{new Date(item.createdAt).toLocaleString()}</td>
                <td className="py-2 pr-3">
                  <button onClick={async () => {
                    if (!confirm('确认删除该留言？')) return
                    try {
                      const r = await fetch(`/api/suggest?id=${encodeURIComponent(item.id)}`, { method: 'DELETE', credentials: 'include' })
                      if (!r.ok) throw new Error('删除失败')
                      setList(prev => prev.filter(x => x.id !== item.id))
                      setTotal(t => Math.max(0, t - 1))
                      setSelected(prev => prev.filter(x => x !== item.id))
                    } catch {}
                  }} className="px-2 py-1 rounded border text-sm">删除</button>
                </td>
              </tr>
            ))}
            {list.length === 0 && (
              <tr><td colSpan={5} className="py-6 text-center text-gray-500">暂无留言</td></tr>
            )}
          </tbody>
        </table>
      </div>
      <div className="mt-4 flex items-center gap-3">
        {(() => {
          const totalPages = Math.max(1, Math.ceil(total / pageSize))
          const makeRange = () => {
            const pages: number[] = []
            if (totalPages <= 7) { for (let i = 1; i <= totalPages; i++) pages.push(i) }
            else {
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
            <div className="flex items-center gap-2">
              <button onClick={()=>setPage(p=>Math.max(1,p-1))} disabled={page<=1} className="px-2 py-1 rounded border text-sm disabled:opacity-50">〈</button>
              {range.map((n, idx) => n === -1 ? (
                <span key={`dot-${idx}`} className="px-2 text-gray-400">···</span>
              ) : (
                <button key={n} onClick={()=>setPage(n)} className={`px-3 py-1 rounded border text-sm ${n===page?'border-blue-500 text-blue-600':'border-gray-200 text-gray-700 hover:border-gray-300'}`}>{n}</button>
              ))}
              <button onClick={()=>setPage(p=>Math.min(totalPages,p+1))} disabled={page>=totalPages} className="px-2 py-1 rounded border text-sm disabled:opacity-50">〉</button>
            </div>
          )
        })()}
      </div>
    </div>
  )
}