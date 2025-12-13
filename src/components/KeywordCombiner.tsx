'use client'

import React, { useState } from 'react'
import { Trash2, Copy, Play, Download, Settings2, FileSpreadsheet, FileText, Shuffle } from 'lucide-react'
import { Card, Input } from '@/components/SharedUI'

// --- Local UI Components ---
const Button = ({ children, className = "", variant = "primary", size = "default", disabled, ...props }: any) => {
  const baseClass = "inline-flex items-center justify-center rounded-lg font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none"
  
  const variants: any = {
    primary: "bg-blue-600 text-white hover:bg-blue-700",
    secondary: "bg-gray-100 text-gray-900 hover:bg-gray-200",
    outline: "border border-gray-300 bg-transparent hover:bg-gray-50 text-gray-700",
    ghost: "hover:bg-gray-100 text-gray-700",
  }
  
  const sizes: any = {
    default: "h-10 py-2 px-4",
    sm: "h-9 px-3 rounded-md text-sm",
    lg: "h-11 px-8 rounded-md",
    icon: "h-10 w-10",
  }

  return (
    <button 
      className={`${baseClass} ${variants[variant] || variants.primary} ${sizes[size] || sizes.default} ${className}`} 
      disabled={disabled}
      {...props}
    >
      {children}
    </button>
  )
}

const Textarea = ({ className = "", ...props }: any) => (
  <textarea 
    className={`flex min-h-[80px] w-full rounded-md border border-gray-300 bg-transparent px-3 py-2 text-sm placeholder:text-gray-400 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-50 ${className}`} 
    {...props} 
  />
)

const Label = ({ className = "", children, ...props }: any) => (
  <label className={`text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 ${className}`} {...props}>
    {children}
  </label>
)

const Badge = ({ children, variant = "default", className = "" }: any) => {
  const variants: any = {
    default: "bg-blue-600 text-white",
    secondary: "bg-gray-100 text-gray-900",
    outline: "text-gray-900 border border-gray-200",
  }
  return (
    <div className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 ${variants[variant] || variants.default} ${className}`}>
      {children}
    </div>
  )
}

const Switch = ({ checked, onCheckedChange, id }: any) => (
  <button
    type="button"
    role="switch"
    aria-checked={checked}
    id={id}
    onClick={() => onCheckedChange(!checked)}
    className={`peer inline-flex h-[24px] w-[44px] shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 focus-visible:ring-offset-white disabled:cursor-not-allowed disabled:opacity-50 ${
      checked ? 'bg-blue-600' : 'bg-gray-200'
    }`}
  >
    <span
      className={`pointer-events-none block h-5 w-5 rounded-full bg-white shadow-lg ring-0 transition-transform ${
        checked ? 'translate-x-5' : 'translate-x-0'
      }`}
    />
  </button>
)

const Select = ({ value, onChange, options, className = "" }: any) => (
  <div className="relative">
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={`flex h-9 w-full items-center justify-between rounded-md border border-gray-300 bg-transparent px-3 py-2 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
    >
      {options.map((opt: any) => (
        <option key={opt.value} value={opt.value}>{opt.label}</option>
      ))}
    </select>
  </div>
)

export default function KeywordCombiner() {
  const [keywords, setKeywords] = useState(['', '', '']) // Store 3 sets of keywords
  const [enableK3, setEnableK3] = useState(false)
  const [result, setResult] = useState('')
  const [separator, setSeparator] = useState(' ') // Default space
  const [count, setCount] = useState(0)
  const [prefix, setPrefix] = useState('')
  const [suffix, setSuffix] = useState('')
  const [removeDuplicates, setRemoveDuplicates] = useState(true)

  // Update a specific keyword input
  const updateKeyword = (index: number, value: string) => {
    const newKeywords = [...keywords]
    newKeywords[index] = value
    setKeywords(newKeywords)
  }

  const handleGenerate = () => {
    // Process inputs: split by new line, trim, remove empty lines
    const lists = keywords.map(k => k.split('\n').map(i => i.trim()).filter(i => i !== ''))
    
    let generated: string[] = []
    const [l1, l2, l3] = lists
    
    // Handle the separator logic: if 'none' is selected, use empty string
    const effectiveSeparator = separator === 'none' ? '' : separator
    
    // Helper to wrap with prefix/suffix
    const wrap = (text: string) => `${prefix}${text}${suffix}`

    if (l1.length === 0 && l2.length === 0 && (!enableK3 || l3.length === 0)) return

    const list1 = l1.length ? l1 : ['']
    const list2 = l2.length ? l2 : ['']
    const list3 = (enableK3 && l3.length) ? l3 : ['']

    list1.forEach(k1 => {
      list2.forEach(k2 => {
        if (enableK3) {
          list3.forEach(k3 => {
             // Logic for 3 keywords
             const parts = [k1, k2, k3].filter(p => p !== '')
             if (parts.length > 0) {
               generated.push(wrap(parts.join(effectiveSeparator)))
             }
          })
        } else {
          // Logic for 2 keywords
          const parts = [k1, k2].filter(p => p !== '')
          if (parts.length > 0) {
            generated.push(wrap(parts.join(effectiveSeparator)))
          }
        }
      })
    })

    if (removeDuplicates) {
      generated = [...new Set(generated)]
    }

    setResult(generated.join('\n'))
    setCount(generated.length)
  }

  const handleClear = () => {
    setKeywords(['', '', ''])
    setResult('')
    setCount(0)
    setPrefix('')
    setSuffix('')
  }

  const handleCopy = () => {
    if (result) {
        navigator.clipboard.writeText(result)
        // Ideally show toast here, but for now we skip standard toast as it's not in SharedUI
        alert("已复制到剪贴板")
    }
  }

  const downloadFile = (content: string, filename: string, type: string) => {
    const blob = new Blob([content], { type })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const handleDownloadTxt = () => {
    if (!result) return
    downloadFile(result, 'keywords_combined.txt', 'text/plain')
  }

  const handleDownloadCsv = () => {
    if (!result) return
    // Add BOM for Excel to recognize UTF-8
    const bom = '\uFEFF'
    const csvContent = bom + "Keywords\n" + result
    downloadFile(csvContent, 'keywords_combined.csv', 'text/csv;charset=utf-8;')
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6 font-sans text-slate-900">
      
      {/* Header Section */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <Shuffle className="w-6 h-6 text-blue-600" />
            关键词组合
          </h1>
          <p className="text-slate-500 text-sm mt-1">
            专业版长尾词生成器：支持多组词根、自定义分隔符及批量处理。
          </p>
        </div>
        <div className="flex items-center gap-2 mt-4 md:mt-0">
           <div className="flex items-center space-x-2 bg-white px-3 py-1.5 rounded-full border border-slate-200 shadow-sm">
              <Switch 
                id="mode-switch" 
                checked={enableK3}
                onCheckedChange={setEnableK3}
              />
              <Label htmlFor="mode-switch" className="text-sm font-medium cursor-pointer text-slate-600">
                启用第三组关键词
              </Label>
            </div>
        </div>
      </div>

      {/* Configuration Toolbar */}
      <Card className="border-none shadow-sm bg-white p-4">
          <div className="flex flex-wrap gap-6 items-end">
            
            {/* Separator Setting */}
            <div className="space-y-1.5 w-40">
              <Label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">连接符号</Label>
              <Select 
                value={separator} 
                onChange={setSeparator}
                options={[
                    { value: ' ', label: '空格 (Space)' },
                    { value: 'none', label: '无 (紧凑)' },
                    { value: '-', label: '横杠 (-)' },
                    { value: '_', label: '下划线 (_)' },
                    { value: '+', label: '加号 (+)' },
                    { value: ',', label: '逗号 (,)' },
                ]}
              />
            </div>

            {/* Prefix/Suffix */}
            <div className="flex gap-2 flex-1 min-w-[200px]">
               <div className="space-y-1.5 flex-1">
                  <Label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">批量前缀</Label>
                  <Input 
                    placeholder="e.g.: best" 
                    className="h-9" 
                    value={prefix}
                    onChange={(e: any) => setPrefix(e.target.value)}
                  />
               </div>
               <div className="space-y-1.5 flex-1">
                  <Label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">批量后缀</Label>
                  <Input 
                    placeholder="e.g.: 2025" 
                    className="h-9" 
                    value={suffix}
                    onChange={(e: any) => setSuffix(e.target.value)}
                  />
               </div>
            </div>

            {/* Actions */}
            <div className="flex gap-2 w-full md:w-auto mt-2 md:mt-0">
              <Button onClick={handleGenerate} className="bg-blue-600 hover:bg-blue-700 text-white flex-1 md:flex-none h-9">
                <Play className="w-4 h-4 mr-2" />
                生成组合
              </Button>
              <Button variant="outline" onClick={handleClear} className="text-slate-600 h-9">
                <Trash2 className="w-4 h-4 mr-2" />
                重置
              </Button>
            </div>
          </div>
      </Card>

      {/* Input Grid */}
      <div className={`grid gap-4 transition-all duration-300 ${enableK3 ? 'grid-cols-1 md:grid-cols-3' : 'grid-cols-1 md:grid-cols-2'}`}>
        {/* Input 1 */}
        <div className="flex flex-col h-full">
          <div className="flex justify-between items-center mb-2 px-1">
             <Label className="font-semibold text-slate-700">关键词组 A</Label>
             <Badge variant="secondary" className="text-xs font-normal bg-slate-100 text-slate-500">
               {keywords[0].split('\n').filter(k => k.trim()).length} 个
             </Badge>
          </div>
          <Textarea 
            placeholder="e.g.:&#10;apple&#10;samsung&#10;sony"
            className="flex-1 min-h-[250px] resize-none border-slate-200 focus:border-blue-500 focus:ring-blue-500/20"
            value={keywords[0]}
            onChange={(e: any) => updateKeyword(0, e.target.value)}
          />
        </div>

        {/* Input 2 */}
        <div className="flex flex-col h-full">
          <div className="flex justify-between items-center mb-2 px-1">
             <Label className="font-semibold text-slate-700">关键词组 B</Label>
             <Badge variant="secondary" className="text-xs font-normal bg-slate-100 text-slate-500">
               {keywords[1].split('\n').filter(k => k.trim()).length} 个
             </Badge>
          </div>
          <Textarea 
            placeholder="e.g.:&#10;price&#10;review&#10;specs"
            className="flex-1 min-h-[250px] resize-none border-slate-200 focus:border-blue-500 focus:ring-blue-500/20"
            value={keywords[1]}
            onChange={(e: any) => updateKeyword(1, e.target.value)}
          />
        </div>

        {/* Input 3 (Conditional) */}
        {enableK3 && (
          <div className="flex flex-col h-full animate-in fade-in slide-in-from-right-4 duration-300">
            <div className="flex justify-between items-center mb-2 px-1">
               <Label className="font-semibold text-slate-700">关键词组 C</Label>
               <Badge variant="secondary" className="text-xs font-normal bg-slate-100 text-slate-500">
                 {keywords[2].split('\n').filter(k => k.trim()).length} 个
               </Badge>
            </div>
            <Textarea 
              placeholder="e.g.:&#10;usa&#10;online&#10;2025"
              className="flex-1 min-h-[250px] resize-none border-slate-200 focus:border-blue-500 focus:ring-blue-500/20"
              value={keywords[2]}
              onChange={(e: any) => updateKeyword(2, e.target.value)}
            />
          </div>
        )}
      </div>

      {/* Results Area */}
      <Card className="border-slate-200 shadow-sm overflow-hidden">
        <div className="bg-slate-50 border-b border-slate-200 px-4 py-3 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-slate-700">生成结果</span>
            <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-200 border-none">
              {count} 个词
            </Badge>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handleDownloadTxt} disabled={!result} className="h-8 bg-white text-slate-600 hover:text-slate-900">
              <FileText className="w-3.5 h-3.5 mr-2" />
              TXT
            </Button>
            <Button variant="outline" size="sm" onClick={handleDownloadCsv} disabled={!result} className="h-8 bg-white text-green-600 hover:text-green-700 hover:bg-green-50 border-green-200">
              <FileSpreadsheet className="w-3.5 h-3.5 mr-2" />
              Excel
            </Button>
            <Button size="sm" onClick={handleCopy} disabled={!result} className="h-8 bg-blue-600 hover:bg-blue-700 text-white ml-2">
              <Copy className="w-3.5 h-3.5 mr-2" />
              一键复制
            </Button>
          </div>
        </div>
        <Textarea 
          readOnly
          value={result}
          placeholder="Results will appear here..."
          className="min-h-[200px] border-0 focus:ring-0 rounded-none p-4 font-mono text-sm bg-white text-slate-600"
        />
      </Card>
    </div>
  )
}
