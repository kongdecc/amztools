'use client'

import React, { useEffect, useState } from 'react'
import { LayoutDashboard, Calculator, Type, Scale, CaseSensitive, ListOrdered, BarChart3, Truck, Search, ChevronDown, Hammer, ArrowLeftRight, Copy, Trash2, Eraser, Download } from 'lucide-react'
import { useSettings } from '@/components/SettingsProvider'
import Head from 'next/head'
import Link from 'next/link'
import EditorPage from '../components/EditorPage'

const Card = ({ children, className = "", onClick, ...props }: any) => (
  <div onClick={onClick} className={`bg-white rounded-xl border border-gray-100 shadow-sm ${className}`} {...props}>{children}</div>
)

const Input = ({ className = "", ...props }: any) => (
  <input className={`flex h-9 w-full rounded-md border border-gray-300 bg-transparent px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-gray-400 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-indigo-500 disabled:cursor-not-allowed disabled:opacity-50 ${className}`} {...props} />
)

const HomePage = ({ onNavigate, modules }: { onNavigate: (id: string) => void; modules: Array<any> }) => {
  const { settings } = useSettings()
  const safeOrigin = (typeof window !== 'undefined' && (window as any).location) ? (window as any).location.origin : ''
  const iconMap: Record<string, any> = {
    'ad-calc': Calculator,
    'editor': Type,
    'unit': Scale,
    'case': CaseSensitive,
    'word-count': ListOrdered,
    'char-count': BarChart3,
    'delivery': Truck,
  }
  const colorSolidMap: Record<string, string> = {
    blue: 'bg-blue-600',
    indigo: 'bg-indigo-600',
    cyan: 'bg-cyan-600',
    violet: 'bg-violet-600',
    sky: 'bg-sky-500',
    purple: 'bg-indigo-500',
    orange: 'bg-orange-500',
  }
  const colorTextMap: Record<string, string> = {
    blue: 'text-blue-600',
    indigo: 'text-indigo-600',
    cyan: 'text-cyan-600',
    violet: 'text-violet-600',
    sky: 'text-sky-500',
    purple: 'text-indigo-500',
    orange: 'text-orange-500',
  }
  const visible = modules.filter((m: any) => m.status !== '下架')
  return (
    <div className="space-y-6">
      <Card className="py-12 px-8 text-center space-y-6 relative overflow-hidden bg-gradient-to-br from-white to-slate-50">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 via-purple-500 to-indigo-500"></div>
        {(() => {
          const hide = String(settings.hideHomeHeroIfEmpty || 'false') === 'true'
          const t = String(settings.homeHeroTitle || '')
          const s = String(settings.homeHeroSubtitle || '')
          const showT = hide ? t.trim().length > 0 : true
          const showS = hide ? s.trim().length > 0 : true
          return (
            <>
              {showT && <h1 className={`text-3xl font-bold text-gray-800`}>{hide ? t : (t || '一站式图像与运营处理工具')}</h1>}
              {showS && <p className={`text-gray-500`}>{hide ? s : (s || '轻松处理您的数据，提升工作效率')}</p>}
            </>
          )
        })()}
        <div className="max-w-xl mx-auto relative z-10">
          <Search className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
          <input type="text" placeholder="搜索工具，例如：竞价、大小写..." className="w-full pl-10 pr-4 py-3 rounded-full border border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-sm" />
        </div>
      </Card>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {visible.map((tool: any) => (
          <Card key={tool.key} className="group relative p-6 hover:shadow-xl transition-all duration-300 cursor-pointer border-transparent hover:border-gray-100 bg-white overflow-hidden" onClick={() => onNavigate(tool.key)}>
            <div className="flex items-start gap-4 mb-4">
              <div className={`w-12 h-12 rounded-xl ${colorSolidMap[tool.color] || 'bg-blue-600'} flex items-center justify-center shadow-md shrink-0 group-hover:scale-105 transition-transform duration-300`}>
                {(() => {
                  const I = iconMap[tool.key] || Hammer
                  return <I className="h-6 w-6 text-white" />
                })()}
              </div>
              <h3 className="text-lg font-bold text-gray-800 pt-1 group-hover:text-gray-900">{tool.title}</h3>
              {tool.status === '维护' && <span className="ml-auto px-2 py-0.5 text-xs rounded border bg-yellow-50 text-yellow-600 border-yellow-200">维护中</span>}
            </div>
            <p className="text-sm text-gray-500 leading-relaxed mb-8 line-clamp-2">{tool.desc}</p>
            <div className={`absolute bottom-6 left-6 flex items-center gap-2 text-sm font-bold ${colorTextMap[tool.color] || 'text-blue-600'} opacity-0 translate-y-4 group-hover:opacity-100 group-hover:translate-y-0 transition-all duration-300`}>
              <span>立即使用</span>
              <ArrowLeftRight className="h-4 w-4" />
            </div>
          </Card>
        ))}
      </div>
    </div>
  )
}

const AdCalculatorPage = () => {
  const [data, setData] = useState(
    [
      { strategy: 'Fixed bids', position: 'TOP', multiplier: 1 },
      { strategy: 'Fixed bids', position: 'Product pages', multiplier: 1 },
      { strategy: 'Fixed bids', position: 'Rest of search', multiplier: 1 },
      { strategy: 'up and down', position: 'TOP', multiplier: 2 },
      { strategy: 'up and down', position: 'Product pages', multiplier: 1.5 },
      { strategy: 'up and down', position: 'Rest of search', multiplier: 1.5 },
      { strategy: 'down only', position: 'TOP', multiplier: 1 },
      { strategy: 'down only', position: 'Product pages', multiplier: 1 },
      { strategy: 'down only', position: 'Rest of search', multiplier: 1 },
    ].map(item => ({ ...item, bidOld: '', bidNew: '', percentOld: '', percentNew: '' }))
  )

  const updateField = (index: number, field: string, value: string) => {
    const newData = [...data]
    newData[index] = { ...newData[index], [field]: value }
    setData(newData)
  }

  const calculateCPC = (bid: string, percent: string, multiplier: number) => {
    const b = parseFloat(bid)
    const p = parseFloat(percent)
    if (isNaN(b)) return ''
    const pct = isNaN(p) ? 0 : p
    return (b * (1 + pct / 100) * multiplier).toFixed(3)
  }

  const renderRow = (index: number, isFirst = false) => {
    const row = data[index]
    const cpcOld = calculateCPC(row.bidOld, row.percentOld, row.multiplier)
    const cpcNew = calculateCPC(row.bidNew, row.percentNew, row.multiplier)

    return (
      <tr key={index} className="text-sm border-b border-gray-200 hover:bg-gray-50">
        {isFirst && (
          <td className={`p-3 border-r border-gray-200 font-medium ${row.strategy.includes('Fixed') ? 'text-red-500' : row.strategy.includes('up') ? 'text-purple-600' : 'text-blue-500'}`}>
            {row.strategy.split(' ')[0]} bids
          </td>
        )}
        {!isFirst && <td className="border-r border-gray-200"></td>}
        <td className="p-3 border-r border-gray-200 text-center text-gray-700">{row.position}</td>
        <td className="p-3 border-r border-gray-200 text-center text-gray-700">{row.multiplier}</td>
        <td className="p-2 border-r border-gray-200">
          <Input 
            type="number" 
            value={row.bidOld} 
            onChange={(e: any) => updateField(index, 'bidOld', e.target.value)} 
            placeholder="0" 
            className="text-center" 
          />
        </td>
        <td className="p-2 border-r border-gray-200">
          <Input 
            type="number" 
            value={row.bidNew} 
            onChange={(e: any) => updateField(index, 'bidNew', e.target.value)} 
            placeholder="0" 
            className="text-center" 
          />
        </td>
        <td className="p-2 border-r border-gray-200">
          <Input 
            type="number" 
            value={row.percentOld} 
            onChange={(e: any) => updateField(index, 'percentOld', e.target.value)} 
            placeholder="0" 
            className="text-center" 
          />
        </td>
        <td className="p-2 border-r border-gray-200">
          <Input 
            type="number" 
            value={row.percentNew} 
            onChange={(e: any) => updateField(index, 'percentNew', e.target.value)} 
            placeholder="0" 
            className="text-center" 
          />
        </td>
        <td className="p-3 border-r border-gray-200 bg-red-50/30 text-center text-red-600 font-medium">{cpcOld}</td>
        <td className="p-3 bg-red-50/30 text-center text-red-600 font-medium">{cpcNew}</td>
      </tr>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 mb-2">
        <Calculator className="h-6 w-6 text-blue-600" />
        <h2 className="text-xl font-bold text-gray-800">广告竞价计算</h2>
      </div>
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-indigo-50/50 text-sm font-semibold text-gray-700 border-b border-gray-200">
                <th className="p-3 border-r border-gray-200 text-left w-32">系列竞价策略</th>
                <th className="p-3 border-r border-gray-200 w-32">位置</th>
                <th className="p-3 border-r border-gray-200 w-20">最高倍数</th>
                <th className="p-3 border-r border-gray-200 w-24">原出价</th>
                <th className="p-3 border-r border-gray-200 w-24">新出价</th>
                <th className="p-3 border-r border-gray-200 w-24">原百分比</th>
                <th className="p-3 border-r border-gray-200 w-24">新百分比</th>
                <th className="p-3 border-r border-gray-200 w-20">原CPC</th>
                <th className="p-3 w-20">新CPC</th>
              </tr>
            </thead>
            <tbody>
              <tr className="bg-red-50 border-b border-red-100">
                <td colSpan={9} className="p-2 text-xs font-bold text-red-600 pl-3">Fixed bids (固定竞价)</td>
              </tr>
              {renderRow(0, true)}
              {renderRow(1)}
              {renderRow(2)}
              <tr className="bg-purple-50 border-b border-purple-100">
                <td colSpan={9} className="p-2 text-xs font-bold text-purple-600 pl-3">up and down (动态竞价-提高和降低)</td>
              </tr>
              {renderRow(3, true)}
              {renderRow(4)}
              {renderRow(5)}
              <tr className="bg-blue-50 border-b border-blue-100">
                <td colSpan={9} className="p-2 text-xs font-bold text-blue-600 pl-3">down only (动态竞价-仅降低)</td>
              </tr>
              {renderRow(6, true)}
              {renderRow(7)}
              {renderRow(8)}
            </tbody>
          </table>
        </div>
        <div className="p-4 bg-gray-50 text-xs text-gray-500 space-y-1 border-t border-gray-200">
          <p className="font-medium mb-1">说明：</p>
          <ul className="list-disc list-inside space-y-1 ml-1">
            <li>输入原出价/新出价/原百分比/新百分比，会自动计算对应的原CPC和新CPC。</li>
            <li>实际最高CPC = Bid × (1 + 百分比/100) × 最高倍数。</li>
            <li>百分比输入如“28”即代表28%，不需要输入%号。</li>
            <li>最高倍数由策略和广告位决定（TOP/1.5/2等）。</li>
          </ul>
        </div>
      </Card>
    </div>
  )
}

const UnitConverterPage = () => {
  const [length, setLength] = useState<any>({ cm: '', in: '', m: '', ft: '', mm: '' })
  const [weight, setWeight] = useState<any>({ kg: '', oz: '', g: '', lb: '', t: '' })
  const [volume, setVolume] = useState<any>({ m3: '', l: '', ml: '', ft3: '', gal: '' })

  const convertLength = (field: string, val: string) => {
    if (val === '') {
      setLength({ cm: '', in: '', m: '', ft: '', mm: '' })
      return
    }
    const v = parseFloat(val)
    if (isNaN(v)) return

    let n: any = {}
    if (field === 'cm') {
      n.cm = val
      n.in = (v / 2.54).toFixed(2)
      n.m = (v / 100).toFixed(2)
      n.ft = (v / 30.48).toFixed(2)
      n.mm = (v * 10).toFixed(2)
    } else if (field === 'in') {
      n.in = val
      n.cm = (v * 2.54).toFixed(2)
      n.m = (v * 0.0254).toFixed(2)
      n.ft = (v / 12).toFixed(2)
      n.mm = (v * 25.4).toFixed(2)
    } else if (field === 'm') {
      n.m = val
      n.cm = (v * 100).toFixed(2)
      n.in = (v / 0.0254).toFixed(2)
      n.ft = (v * 3.28084).toFixed(2)
      n.mm = (v * 1000).toFixed(2)
    } else if (field === 'ft') {
      n.ft = val
      n.cm = (v * 30.48).toFixed(2)
      n.in = (v * 12).toFixed(2)
      n.m = (v / 3.28084).toFixed(2)
      n.mm = (v * 304.8).toFixed(2)
    } else if (field === 'mm') {
      n.mm = val
      n.cm = (v / 10).toFixed(2)
      n.in = (v / 25.4).toFixed(2)
      n.m = (v / 1000).toFixed(2)
      n.ft = (v / 304.8).toFixed(2)
    }
    setLength(n)
  }

  const convertWeight = (field: string, val: string) => {
    if (val === '') {
      setWeight({ kg: '', oz: '', g: '', lb: '', t: '' })
      return
    }
    const v = parseFloat(val)
    if (isNaN(v)) return

    let n: any = {}
    if (field === 'kg') {
      n.kg = val
      n.oz = (v * 35.274).toFixed(2)
      n.g = (v * 1000).toFixed(2)
      n.lb = (v * 2.20462).toFixed(2)
      n.t = (v / 1000).toFixed(2)
    } else if (field === 'oz') {
      n.oz = val
      n.kg = (v / 35.274).toFixed(2)
      n.g = (v * 28.3495).toFixed(2)
      n.lb = (v / 16).toFixed(2)
      n.t = (v / 35274).toFixed(6)
    } else if (field === 'g') {
      n.g = val
      n.kg = (v / 1000).toFixed(2)
      n.oz = (v / 28.3495).toFixed(2)
      n.lb = (v / 453.592).toFixed(2)
      n.t = (v / 1e6).toFixed(6)
    } else if (field === 'lb') {
      n.lb = val
      n.kg = (v / 2.20462).toFixed(2)
      n.oz = (v * 16).toFixed(2)
      n.g = (v * 453.592).toFixed(2)
      n.t = (v / 2204.62).toFixed(6)
    } else if (field === 't') {
      n.t = val
      n.kg = (v * 1000).toFixed(2)
      n.oz = (v * 35274).toFixed(2)
      n.g = (v * 1e6).toFixed(2)
      n.lb = (v * 2204.62).toFixed(2)
    }
    setWeight(n)
  }

  const convertVolume = (field: string, val: string) => {
    if (val === '') {
      setVolume({ m3: '', l: '', ml: '', ft3: '', gal: '' })
      return
    }
    const v = parseFloat(val)
    if (isNaN(v)) return

    let n: any = {}
    if (field === 'm3') {
      n.m3 = val
      n.l = (v * 1000).toFixed(2)
      n.ml = (v * 1e6).toFixed(2)
      n.ft3 = (v * 35.3147).toFixed(2)
      n.gal = (v * 264.172).toFixed(2)
    } else if (field === 'l') {
      n.l = val
      n.m3 = (v / 1000).toFixed(6)
      n.ml = (v * 1000).toFixed(2)
      n.ft3 = (v / 28.3168).toFixed(2)
      n.gal = (v / 3.78541).toFixed(2)
    } else if (field === 'ml') {
      n.ml = val
      n.m3 = (v / 1e6).toFixed(6)
      n.l = (v / 1000).toFixed(2)
      n.ft3 = (v / 28316.8).toFixed(6)
      n.gal = (v / 3785.41).toFixed(6)
    } else if (field === 'ft3') {
      n.ft3 = val
      n.m3 = (v / 35.3147).toFixed(6)
      n.l = (v * 28.3168).toFixed(2)
      n.ml = (v * 28316.8).toFixed(2)
      n.gal = (v * 7.48052).toFixed(2)
    } else if (field === 'gal') {
      n.gal = val
      n.m3 = (v / 264.172).toFixed(6)
      n.l = (v * 3.78541).toFixed(2)
      n.ml = (v * 3785.41).toFixed(2)
      n.ft3 = (v / 7.48052).toFixed(2)
    }
    setVolume(n)
  }

  const UnitGroup = ({ title, units, state, handler }: any) => (
    <div className="space-y-4">
      <h3 className="font-bold text-gray-700 text-sm">{title}</h3>
      <div className="space-y-3">
        {units.map((u: any) => (
          <div key={u.key} className="flex items-center gap-3">
            <label className="w-24 text-sm text-gray-600">{u.label}</label>
            <Input type="number" value={state[u.key]} onChange={(e: any) => handler(u.key, e.target.value)} />
          </div>
        ))}
      </div>
    </div>
  )

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 mb-2">
        <Scale className="h-6 w-6 text-blue-600" />
        <h2 className="text-xl font-bold text-gray-800">单位换算</h2>
      </div>
      <Card className="p-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
          <UnitGroup 
            title="长度换算" 
            units={[{ key: 'cm', label: '厘米 (cm)' }, { key: 'in', label: '英寸 (in)' }, { key: 'm', label: '米 (m)' }, { key: 'ft', label: '英尺 (ft)' }, { key: 'mm', label: '毫米 (mm)' }]} 
            state={length}
            handler={convertLength}
          />
          <UnitGroup 
            title="重量换算" 
            units={[{ key: 'kg', label: '公斤 (kg)' }, { key: 'oz', label: '盎司 (oz)' }, { key: 'g', label: '克 (g)' }, { key: 'lb', label: '磅 (lb)' }, { key: 't', label: '吨 (t)' }]} 
            state={weight}
            handler={convertWeight}
          />
          <UnitGroup 
            title="体积换算" 
            units={[{ key: 'm3', label: '立方米 (m³)' }, { key: 'l', label: '升 (L)' }, { key: 'ml', label: '毫升 (mL)' }, { key: 'ft3', label: '立方英尺 (ft³)' }, { key: 'gal', label: '加仑 (gal)' }]} 
            state={volume}
            handler={convertVolume}
          />
        </div>
      </Card>
    </div>
  )
}

const CaseConverterPage = () => {
  const [text, setText] = useState('')
  const [result, setResult] = useState('')

  const convert = (type: string) => {
    if (type === 'upper') setResult(text.toUpperCase())
    else if (type === 'lower') setResult(text.toLowerCase())
    else if (type === 'capitalize') {
      setResult(text.replace(/[a-zA-Z]+/g, word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()))
    }
  }

  const copy = () => {
    navigator.clipboard.writeText(result)
    alert('结果已复制到剪贴板！')
  }

  const clear = () => {
    setText('')
    setResult('')
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 mb-2">
        <CaseSensitive className="h-6 w-6 text-blue-600" />
        <h2 className="text-xl font-bold text-gray-800">大小写转换</h2>
      </div>
      <div className="flex flex-col md:flex-row gap-6">
        <Card className="flex-1 p-4 bg-gray-50/50">
          <textarea 
            className="w-full h-96 p-4 bg-transparent border-none resize-none focus:ring-0 text-sm"
            placeholder="要转换的文本"
            value={text}
            onChange={e => setText(e.target.value)}
          />
        </Card>
        <div className="flex flex-col gap-3 w-full md:w-32 shrink-0">
          <button onClick={() => convert('upper')} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium">全部转大写</button>
          <button onClick={() => convert('lower')} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium">全部转小写</button>
          <button onClick={() => convert('capitalize')} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium">首字转大写</button>
          <button onClick={copy} className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm font-medium flex items-center justify-center gap-2">
            <Copy className="h-4 w-4" /> 复制结果
          </button>
          <button onClick={clear} className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 text-sm font-medium flex items-center justify-center gap-2">
            <Trash2 className="h-4 w-4" /> 清空
          </button>
        </div>
        <Card className="flex-1 p-4 bg-gray-50/50">
          <textarea 
            className="w-full h-96 p-4 bg-transparent border-none resize-none focus:ring-0 text-sm"
            readOnly
            value={result}
            placeholder="转换结果"
          />
        </Card>
      </div>
    </div>
  )
}

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

const CharCountPage = () => {
  const [text, setText] = useState('')

  const copy = () => {
    navigator.clipboard.writeText(text)
    alert('文本已复制到剪贴板！')
  }

  const trim = () => {
    setText(text.trim())
  }

  const removeBreaks = () => {
    setText(text.replace(/[\r\n]+/g, ' '))
  }

  const clear = () => {
    setText('')
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 mb-2">
        <BarChart3 className="h-6 w-6 text-blue-600" />
        <h2 className="text-xl font-bold text-gray-800">字符统计</h2>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-4">
          <Card className="p-4 bg-gray-50/50">
            <textarea 
              className="w-full h-80 p-4 bg-transparent border-none resize-none focus:ring-0 text-sm"
              placeholder="请输入统计字符的英文"
              value={text}
              onChange={e => setText(e.target.value)}
            />
          </Card>
          <div className="flex flex-wrap gap-3">
            <button onClick={copy} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium flex items-center gap-2"><Copy className="h-4 w-4" /> 一键复制</button>
            <button onClick={trim} className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm font-medium flex items-center gap-2"><Eraser className="h-4 w-4" /> 清空首尾空白</button>
            <button onClick={removeBreaks} className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm font-medium flex items-center gap-2"><Type className="h-4 w-4" /> 清空换行符</button>
            <button onClick={clear} className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 text-sm font-medium flex items-center gap-2"><Trash2 className="h-4 w-4" /> 清空</button>
          </div>
        </div>
        <Card className="p-6 bg-indigo-50/50 border-indigo-100">
          <div className="space-y-6">
            <div className="space-y-3">
              <h3 className="font-bold text-gray-800">温馨提示，在亚马逊卖家后台中：</h3>
              <ul className="space-y-2 text-sm text-gray-600">
                <li className="flex items-center gap-2"><div className="h-1.5 w-1.5 rounded-full bg-blue-400"></div>Product Title最多不超过 200（包括空格）字符</li>
                <li className="flex items-center gap-2"><div className="h-1.5 w-1.5 rounded-full bg-blue-400"></div>Bullet Point每行最多不超过 500 字符</li>
                <li className="flex items-center gap-2"><div className="h-1.5 w-1.5 rounded-full bg-blue-400"></div>Search Terms每行最多不超过 250 字符</li>
              </ul>
            </div>
            <div className="pt-6 border-t border-indigo-200">
              <h3 className="font-bold text-gray-800 mb-4">字符统计结果：</h3>
              <div className="flex items-baseline gap-2">
                <span className="text-gray-600 text-sm">当前字符数 CHARACTERS:</span>
                <span className="text-4xl font-bold text-green-600">{text.length}</span>
              </div>
            </div>
          </div>
        </Card>
      </div>
    </div>
  )
}

const PlaceholderPage = ({ title, icon: Icon }: { title: string; icon: any }) => (
  <div className="space-y-6">
    <div className="flex items-center gap-2 mb-2">
      <Icon className="h-6 w-6 text-gray-400" />
      <h2 className="text-xl font-bold text-gray-800">{title}</h2>
    </div>
    <Card className="h-[60vh] flex flex-col items-center justify-center text-gray-400 bg-gray-50/50 border-dashed">
      <div className="p-6 bg-white rounded-full shadow-sm mb-6">
        <Hammer className="h-12 w-12 text-indigo-200" />
      </div>
      <h3 className="text-lg font-medium text-gray-600 mb-2">功能开发中</h3>
      <p className="text-sm text-gray-400 max-w-xs text-center">这个工具模块正在紧锣密鼓地开发中，<br/>请稍后回来查看更新。</p>
    </Card>
  </div>
)

export default function HomeLayoutClient({ initialModules, initialNavItems }: { initialModules: any[]; initialNavItems: any[] }) {
  const [activeTab, setActiveTab] = useState('home')
  const [modules, setModules] = useState<Array<any>>(initialModules || [])
  const [navItems, setNavItems] = useState<Array<any>>(initialNavItems || [])
  
  const iconMap: Record<string, any> = {
    'ad-calc': Calculator,
    'editor': Type,
    'unit': Scale,
    'case': CaseSensitive,
    'word-count': ListOrdered,
    'char-count': BarChart3,
    'delivery': Truck,
  }
  const menuItems = [
    { id: 'home', label: '首页', icon: LayoutDashboard },
    ...modules.filter((m: any) => m.status !== '下架').map((m: any) => ({ id: m.key, label: m.status === '维护' ? `${m.title}（维护）` : m.title, icon: iconMap[m.key] || Hammer }))
  ]
  useEffect(() => {
    if (activeTab && activeTab !== 'home') {
      try { fetch('/api/modules', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ key: activeTab }) }) } catch {}
    }
  }, [activeTab])
  const { settings } = useSettings()
  const safeOrigin = (typeof window !== 'undefined' && (window as any).location) ? (window as any).location.origin : ''
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <Head>
        <title>{settings.siteName}</title>
        <meta name="keywords" content={settings.siteKeywords} />
        <meta name="description" content={settings.siteDescription} />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "BreadcrumbList",
          itemListElement: [
            { "@type": "ListItem", position: 1, name: "首页", item: `${safeOrigin}/` }
          ]
        }) }} />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "WebSite",
          name: settings.siteName,
          url: safeOrigin || undefined
        }) }} />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "Organization",
          name: settings.siteName,
          url: safeOrigin || undefined,
          logo: settings.logoUrl || undefined
        }) }} />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "CollectionPage",
          name: `${settings.siteName} - 工具集合`,
          url: safeOrigin || undefined,
          hasPart: (Array.isArray(modules) ? modules : []).filter((m:any) => m.status !== '下架').map((m:any) => ({
            "@type": "WebPage",
            name: m.title,
            url: `${safeOrigin}/#${m.key}`
          }))
        }) }} />
      </Head>
      <header className="h-14 bg-[#5b5bd6] text-white flex items-center px-10 shadow-md z-20">
        <div className={`flex items-center gap-2 font-bold text-lg`}>
          <div className="bg-white/20 p-1 rounded"><LayoutDashboard className="h-5 w-5" /></div>
          <span>{settings.siteName}</span>
        </div>
        <nav className="ml-auto mr-6 flex items-center gap-6">
          {navItems
            .slice()
            .sort((a: any, b: any) => Number(a.order || 0) - Number(b.order || 0))
            .map((item: any) => (
              item.isExternal ? (
                <a key={item.id} href={item.href || '#'} target="_blank" rel="noopener noreferrer" className="text-sm text-white/90 hover:text-white">
                  {item.label}
                </a>
              ) : (
                <Link key={item.id} href={item.href || '/'} className="text-sm text-white/90 hover:text-white">
                  {item.label}
                </Link>
              )
            ))}
        </nav>
      </header>
      <div className="flex flex-1">
        <aside className="w-64 bg-white border-r border-gray-200 flex-shrink-0 hidden md:flex flex-col">
          <div className="p-4 space-y-1 flex-1 overflow-y-auto">
            {menuItems.map(item => (
              <button key={item.id} onClick={() => setActiveTab(item.id)} className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-lg transition-colors ${activeTab === item.id ? 'bg-blue-50 text-blue-600' : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'}`}>
                <item.icon className={`h-5 w-5 ${activeTab === item.id ? 'text-blue-600' : 'text-gray-400'}`} />
                {item.label}
                {activeTab === item.id && <div className="ml-auto w-1.5 h-1.5 rounded-full bg-blue-600" />}
              </button>
            ))}
          </div>
          {process.env.NODE_ENV !== 'production' && (
            <div className="p-4 border-t border-gray-100">
              <div className="flex gap-2">
                <div className="h-8 w-8 rounded-full bg-gray-800 text-white flex items-center justify-center text-xs font-bold">N</div>
                <div className="h-8 w-8 rounded-full bg-gray-200 flex items-center justify-center"><ChevronDown className="h-4 w-4 text-gray-600" /></div>
              </div>
            </div>
          )}
        </aside>
        <main className="flex-1 p-8 overflow-y-auto h-[calc(100vh-3.5rem)]">
          <div className="max-w-6xl mx-auto">
            {activeTab === 'home' ? (
              <HomePage onNavigate={setActiveTab} modules={modules} />
            ) : (
              (() => {
                if (activeTab === 'ad-calc') return <AdCalculatorPage />
                if (activeTab === 'unit') return <UnitConverterPage />
                if (activeTab === 'editor') return <EditorPage />
                if (activeTab === 'case') return <CaseConverterPage />
                if (activeTab === 'word-count') return <WordCountPage />
                if (activeTab === 'char-count') return <CharCountPage />
                if (activeTab === 'delivery') return <PlaceholderPage title="美国站配送费计算" icon={Truck} />
                return <PlaceholderPage title="功能开发中" icon={Hammer} />
              })()
            )}
          </div>
          <div className="mt-12 text-center">
            <footer className="text-xs text-gray-400">
              {settings.copyrightText || '© 2025 运营魔方 ToolBox. All rights reserved.'}
              <span className="mx-2">|</span>
              <a href="/privacy" className="hover:text-blue-600">隐私说明</a>
            </footer>
            {(() => {
              try {
                const arr = JSON.parse(String(settings.friendLinks || '[]'))
                const list = Array.isArray(arr) ? arr : []
                if (list.length === 0) return null
                return (
                  <div className="mt-2 text-xs text-gray-500">
                    {String(settings.showFriendLinksLabel || 'false') === 'true' && <span>友情链接： </span>}
                    {list
                      .slice()
                      .sort((a: any, b: any) => (Number(a.order || 0) - Number(b.order || 0)))
                      .map((l: any, i: number) => (
                        <span key={i}>
                          <a href={l.href || '#'} target={l.isExternal ? '_blank' : '_self'} rel={l.isExternal ? 'noopener noreferrer' : undefined} className="hover:text-blue-600">
                            {l.label || '友链'}
                          </a>
                          {i < list.length - 1 ? ', ' : ''}
                        </span>
                      ))}
                  </div>
                )
              } catch { return null }
            })()}
          </div>
        </main>
      </div>
    </div>
  )
}
