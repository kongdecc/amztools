'use client'

import React, { useState, useEffect } from 'react'
import { Plus, Save, Trash2, X, Edit2, GripVertical } from 'lucide-react'

export default function AdminCategories() {
  const [list, setList] = useState<Array<any>>([])
  const [loading, setLoading] = useState(true)
  const [editingId, setEditingId] = useState('')
  const [savedHint, setSavedHint] = useState('')
  const [draggedItem, setDraggedItem] = useState<any>(null)

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      const r = await fetch('/api/categories', { cache: 'no-store' })
      const d = await r.json()
      setList(Array.isArray(d) ? d : [])
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  const handleAdd = () => {
    const newItem = {
      id: `new-${Date.now()}`,
      key: '',
      label: '',
      order: list.length + 1,
      isNew: true
    }
    setList([...list, newItem])
    setEditingId(newItem.id)
  }

  const handleSave = async () => {
    try {
      const r = await fetch('/api/categories', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(list.map(({ id, isNew, ...rest }) => rest))
      })
      if (r.ok) {
        setSavedHint('保存成功')
        setEditingId('')
        loadData()
        setTimeout(() => setSavedHint(''), 2000)
      } else {
        alert('保存失败')
      }
    } catch (e) {
      alert('保存出错')
    }
  }

  const handleSaveItem = async (item: any) => {
    try {
      const r = await fetch('/api/categories', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify([item])
      })
      if (r.ok) {
        setSavedHint('保存成功')
        setEditingId('')
        loadData()
        setTimeout(() => setSavedHint(''), 2000)
      } else {
        alert('保存失败')
      }
    } catch (e) {
      alert('保存出错')
    }
  }

  const handleDelete = async (key: string) => {
    if (!confirm('确定要删除此分类吗？')) return
    try {
      const r = await fetch(`/api/categories?key=${key}`, { method: 'DELETE' })
      if (r.ok) {
        setList(list.filter(item => item.key !== key))
      } else {
        alert('删除失败')
      }
    } catch (e) {
      alert('删除出错')
    }
  }

  const onDragStart = (e: React.DragEvent, index: number) => {
    setDraggedItem(list[index])
    e.dataTransfer.effectAllowed = 'move'
    // Firefox requires data to be set
    e.dataTransfer.setData('text/plain', index.toString())
  }

  const onDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
  }

  const onDrop = (e: React.DragEvent, index: number) => {
    e.preventDefault()
    const draggedIdx = list.findIndex(i => i === draggedItem)
    if (draggedIdx === -1 || draggedIdx === index) return

    const newList = [...list]
    const [removed] = newList.splice(draggedIdx, 1)
    newList.splice(index, 0, removed)
    
    // Update order based on new index
    const orderedList = newList.map((item, i) => ({ ...item, order: i + 1 }))
    setList(orderedList)
    setDraggedItem(null)
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
      <div className="p-6 border-b border-gray-100 flex justify-between items-center">
        <div>
          <h3 className="text-lg font-bold text-gray-800">工具分类管理</h3>
          <p className="text-sm text-gray-500 mt-1">管理工具的分类标签，用于前台展示分组</p>
        </div>
        <div className="flex items-center gap-3">
          {savedHint && <span className="text-green-600 text-sm animate-fade-in">{savedHint}</span>}
          <button onClick={handleAdd} className="flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors text-sm font-medium">
            <Plus size={16} /> 新增分类
          </button>
          <button onClick={handleSave} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium shadow-sm">
            <Save size={16} /> 保存全部
          </button>
        </div>
      </div>
      
      <div className="p-6">
        {loading ? (
          <div className="text-center py-10 text-gray-500">加载中...</div>
        ) : list.length === 0 ? (
          <div className="text-center py-10 text-gray-500">暂无分类，请添加</div>
        ) : (
          <div className="space-y-2">
            {list.map((item, index) => (
              <div 
                key={item.id || item.key} 
                draggable={true}
                onDragStart={(e) => onDragStart(e, index)}
                onDragOver={(e) => onDragOver(e, index)}
                onDrop={(e) => onDrop(e, index)}
                className={`flex items-center gap-4 p-4 bg-gray-50 rounded-lg border border-gray-100 group hover:border-blue-200 hover:bg-blue-50/30 transition-all ${draggedItem === item ? 'opacity-50 border-dashed border-blue-300' : ''}`}
              >
                <div className="cursor-move text-gray-400 hover:text-gray-600">
                  <GripVertical size={20} />
                </div>
                
                <div className="flex-1 grid grid-cols-12 gap-4 items-center">
                  <div className="col-span-1">
                    <label className="text-xs text-gray-500 block mb-1">排序</label>
                    <input
                      type="number"
                      value={item.order}
                      onChange={(e) => {
                        const newList = [...list]
                        newList[index].order = parseInt(e.target.value)
                        setList(newList)
                      }}
                      className="w-full px-2 py-1 text-sm border rounded focus:outline-none focus:border-blue-500"
                    />
                  </div>
                  
                  <div className="col-span-3">
                    <label className="text-xs text-gray-500 block mb-1">Key (唯一标识)</label>
                    <input
                      type="text"
                      value={item.key}
                      onChange={(e) => {
                        const newList = [...list]
                        newList[index].key = e.target.value
                        setList(newList)
                      }}
                      disabled={!item.isNew && editingId !== (item.id || item.key)}
                      className="w-full px-3 py-1.5 text-sm border rounded focus:outline-none focus:border-blue-500 disabled:bg-gray-100 disabled:text-gray-500"
                      placeholder="e.g. operation"
                    />
                  </div>
                  
                  <div className="col-span-4">
                    <label className="text-xs text-gray-500 block mb-1">显示名称</label>
                    <input
                      type="text"
                      value={item.label}
                      onChange={(e) => {
                        const newList = [...list]
                        newList[index].label = e.target.value
                        setList(newList)
                      }}
                      className="w-full px-3 py-1.5 text-sm border rounded focus:outline-none focus:border-blue-500"
                      placeholder="e.g. 运营工具"
                    />
                  </div>

                  <div className="col-span-2">
                    <label className="text-xs text-gray-500 block mb-1">是否启用</label>
                    <div className="flex items-center h-[30px]">
                      <input
                        type="checkbox"
                        checked={item.enabled !== false}
                        onChange={(e) => {
                          const newList = [...list]
                          newList[index].enabled = e.target.checked
                          setList(newList)
                        }}
                        className="h-5 w-5 text-blue-600 border-gray-300 rounded focus:ring-blue-500 cursor-pointer"
                      />
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button onClick={() => handleSaveItem(item)} className="p-2 text-blue-600 hover:bg-blue-50 rounded" title="保存此项">
                    <Save size={18} />
                  </button>
                  {item.isNew ? (
                    <button onClick={() => setList(list.filter(i => i !== item))} className="p-2 text-red-500 hover:bg-red-50 rounded">
                      <X size={18} />
                    </button>
                  ) : (
                    <button onClick={() => handleDelete(item.key)} className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors">
                      <Trash2 size={18} />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
