import React, { useState } from 'react'
import { ListOrdered, Trash2, Download } from 'lucide-react'
import { Card } from '@/components/SharedUI'

const WordCountPage = () => {
  const [text, setText] = useState('')
  const [stats, setStats] = useState<any>(null)
  const [options, setOptions] = useState({
    wordCount: 1,
    displayCount: 5,
    excludeGrammar: true
  })

  const grammarWords = new Set(['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by'])

  const calculate = (newPage = 1) => {
    const charCount = text.length
    const words = text.toLowerCase().match(/[a-z0-9]+/g) || []
    const totalWords = words.length
    const sentenceCount = text.split(/\n/).filter(line => line.trim().length > 0).length

    const nGrams: Record<string, number> = {}
    for (let i = 0; i < words.length - (options.wordCount - 1); i++) {
      const gram = words.slice(i, i + options.wordCount).join(' ')
      if (!options.excludeGrammar || !grammarWords.has(gram)) {
        nGrams[gram] = (nGrams[gram] || 0) + 1
      }
    }

    const sorted = Object.entries(nGrams).sort((a, b) => b[1] - a[1])
    
    const itemsPerPage = options.displayCount === -1 ? sorted.length : options.displayCount
    const totalPages = Math.ceil(sorted.length / itemsPerPage) || 1
    const currentPage = Math.min(Math.max(newPage, 1), totalPages)
    
    setStats({
      charCount,
      totalWords,
      sentenceCount,
      sorted,
      totalPages,
      currentPage,
      itemsPerPage,
      totalCount: Object.values(nGrams).reduce((a, b) => a + b, 0) || 1
    })
  }

  const download = () => {
    if (!stats || !stats.sorted.length) {
      alert('没有可下载的数据！')
      return
    }
    let csv = '\ufeff词组,出现次数,百分比\n'
    stats.sorted.forEach(([gram, count]: any) => {
      const pct = ((count / stats.totalCount) * 100).toFixed(2)
      const field = (gram.includes(',') || gram.includes('"')) ? `"${gram.replace(/"/g, '""')}"` : gram
      csv += `${field},${count},${pct}%\n`
    })
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5)
    a.download = `词频统计_${timestamp}.csv`
    a.href = url
    a.click()
    URL.revokeObjectURL(url)
  }

  const clear = () => {
    setText('')
    setStats(null)
  }

  const renderPagination = () => {
    if (!stats || stats.totalPages <= 1) return null
    const { currentPage, totalPages } = stats
    return (
      <div className="flex justify-center gap-2 mt-4">
        <button onClick={() => calculate(1)} disabled={currentPage === 1} className="px-3 py-1 bg-white border border-gray-300 rounded text-sm disabled:opacity-50 hover:bg-gray-50">首页</button>
        <button onClick={() => calculate(currentPage - 1)} disabled={currentPage === 1} className="px-3 py-1 bg-white border border-gray-300 rounded text-sm disabled:opacity-50 hover:bg-gray-50">上一页</button>
        <span className="px-2 py-1 text-sm text-gray-600">{currentPage}/{totalPages}</span>
        <button onClick={() => calculate(currentPage + 1)} disabled={currentPage === totalPages} className="px-3 py-1 bg-white border border-gray-300 rounded text-sm disabled:opacity-50 hover:bg-gray-50">下一页</button>
        <button onClick={() => calculate(totalPages)} disabled={currentPage === totalPages} className="px-3 py-1 bg-white border border-gray-300 rounded text-sm disabled:opacity-50 hover:bg-gray-50">尾页</button>
      </div>
    )
  }

  const renderTable = () => {
    if (!stats) return null
    const start = (stats.currentPage - 1) * stats.itemsPerPage
    const end = start + stats.itemsPerPage
    const items = stats.sorted.slice(start, end)
    
    return (
      <div className="mt-4">
        <table className="w-full text-sm text-left border-collapse border border-gray-200">
          <thead>
            <tr className="bg-gray-50">
              <th className="border border-gray-200 p-2 font-semibold text-gray-700">词组</th>
              <th className="border border-gray-200 p-2 font-semibold text-gray-700">出现次数</th>
              <th className="border border-gray-200 p-2 font-semibold text-gray-700">百分比</th>
            </tr>
          </thead>
          <tbody>
            {items.map(([gram, count]: any, i: number) => (
              <tr key={i} className="hover:bg-gray-50">
                <td className="border border-gray-200 p-2 text-gray-600">{gram}</td>
                <td className="border border-gray-200 p-2 text-gray-600">{count}</td>
                <td className="border border-gray-200 p-2 text-gray-600">{((count / stats.totalCount) * 100).toFixed(2)}%</td>
              </tr>
            ))}
          </tbody>
        </table>
        {renderPagination()}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 mb-2">
        <ListOrdered className="h-6 w-6 text-blue-600" />
        <h2 className="text-xl font-bold text-gray-800">单词词频统计</h2>
      </div>
      <div className="flex flex-col md:flex-row gap-6">
        <Card className="flex-1 p-4 bg-gray-50/50">
          <textarea 
            className="w-full h-96 p-4 bg-transparent border-none resize-none focus:ring-0 text-sm"
            placeholder="请输入待统计的英文"
            value={text}
            onChange={e => setText(e.target.value)}
          />
        </Card>
        <div className="flex flex-col gap-3 w-full md:w-48 shrink-0">
          <div className="p-4 bg-gray-100 rounded-lg space-y-3 text-sm">
            <div className="flex items-center justify-between">
              <label className="text-gray-600">单词个数</label>
              <select 
                className="w-16 p-1 rounded border border-gray-300"
                value={options.wordCount}
                onChange={e => setOptions({...options, wordCount: Number(e.target.value)})}
              >
                {[1,2,3,4,5].map(n => <option key={n} value={n}>{n}</option>)}
              </select>
            </div>
            <div className="flex items-center justify-between">
              <label className="text-gray-600">展示词数</label>
              <select 
                className="w-16 p-1 rounded border border-gray-300"
                value={options.displayCount}
                onChange={e => setOptions({...options, displayCount: Number(e.target.value)})}
              >
                {[5,10,15,20,-1].map(n => <option key={n} value={n}>{n === -1 ? '全部' : n}</option>)}
              </select>
            </div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input 
                type="checkbox" 
                checked={options.excludeGrammar}
                onChange={e => setOptions({...options, excludeGrammar: e.target.checked})}
                className="rounded text-blue-600 focus:ring-blue-500"
              />
              <span className="text-gray-600">排除语法词汇</span>
            </label>
          </div>
          <button onClick={() => calculate(1)} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium">一键统计</button>
          <button onClick={clear} className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 text-sm font-medium flex items-center justify-center gap-2">
            <Trash2 className="h-4 w-4" /> 清空
          </button>
          <button onClick={download} className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm font-medium flex items-center justify-center gap-2">
            <Download className="h-4 w-4" /> 下载Excel
          </button>
        </div>
        <Card className="flex-1 p-4 bg-gray-50/50 overflow-hidden">
          <div className="bg-gray-200/50 p-4 rounded mb-4 space-y-2 text-sm text-gray-600">
            <div>当前字符数 Characters: <span className="font-bold text-gray-800">{stats ? stats.charCount : 0}</span></div>
            <div>当前单词数 Words: <span className="font-bold text-gray-800">{stats ? stats.totalWords : 0}</span></div>
            <div>当前句子数 Sentences: <span className="font-bold text-gray-800">{stats ? stats.sentenceCount : 0}</span>（可能因缩写略有偏差）</div>
          </div>
          <div className="overflow-x-auto">
            {renderTable()}
          </div>
        </Card>
      </div>
    </div>
  )
}

export default WordCountPage
