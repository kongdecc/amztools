import React, { useState } from 'react'
import { CaseSensitive, Copy, Trash2 } from 'lucide-react'
import { Card } from '@/components/SharedUI'

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

export default CaseConverterPage
