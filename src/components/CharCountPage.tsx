import React, { useState } from 'react'
import { BarChart3, Copy, Eraser, Type, Trash2 } from 'lucide-react'
import { Card } from './SharedUI'

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

export default CharCountPage
