'use client'

import React, { useState, useRef } from 'react'
import { pinyin } from 'pinyin-pro'
import { Volume2, Copy, Trash2, ArrowRightLeft, Languages } from 'lucide-react'
import { Card } from '@/components/SharedUI'

export default function PinyinConverter() {
  const [inputText, setInputText] = useState('')
  const [resultHtml, setResultHtml] = useState('')
  const [showResult, setShowResult] = useState(false)
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null)
  
  // Options state
  const [caseType, setCaseType] = useState<'lower' | 'capitalize' | 'upper'>('lower')
  const [separator, setSeparator] = useState<'space' | 'none'>('space')
  const [colorTone, setColorTone] = useState(false)
  const [resultMode, setResultMode] = useState<'text' | 'html'>('text')

  const resultRef = useRef<HTMLDivElement>(null)

  const showToastMsg = (msg: string, type: 'success' | 'error' = 'success') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 2000)
  }

  // Handle standard conversion
  const convert = (toneType: 'none' | 'symbol') => {
    if (!inputText.trim()) {
      showToastMsg('请输入内容', 'error')
      return
    }

    const options: any = {
      toneType: toneType,
      pattern: 'pinyin',
      separator: separator === 'none' ? '' : ' ',
      v: true
    }

    let res = pinyin(inputText, options)

    if (caseType === 'upper') {
      res = res.toUpperCase()
    } else if (caseType === 'capitalize') {
      if (separator === 'none') {
        res = res.charAt(0).toUpperCase() + res.slice(1)
      } else {
        res = res.replace(/(^|\s)([a-zà-ü])/g, (m) => m.toUpperCase())
      }
    }

    setResultHtml(res) // Plain text content
    setResultMode('text')
    setShowResult(true)
    setTimeout(() => resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 100)
  }

  // Handle comparison (Ruby) conversion
  const convertComparison = () => {
    if (!inputText.trim()) {
      showToastMsg('请输入内容', 'error')
      return
    }

    let html = ''
    
    // We process character by character to build Ruby tags
    // This logic mimics the original HTML script exactly
    for (let i = 0; i < inputText.length; i++) {
        const char = inputText[i]
        
        if (char === '\n') {
            html += '<br>'
            continue
        }
        if (char.trim() === '') {
            html += '&nbsp;'
            continue
        }

        // Check if Chinese character
        if (/[\u4e00-\u9fa5]/.test(char)) {
            const py = pinyin(char, { toneType: 'symbol' })
            // pinyin-pro returns array if type is 'array', but here we use default string return for single char
            // To get tone number, we need a separate call
            const pyNumArr = pinyin(char, { toneType: 'num', type: 'array' })
            const pyNum = pyNumArr ? pyNumArr[0] : '' 
            const toneNum = pyNum ? pyNum.slice(-1) : '0'
            
            let rtClass = ''
            if (colorTone && /[1-4]/.test(toneNum)) {
                rtClass = `class="tone-${toneNum}"`
            } else if (colorTone) {
                rtClass = `class="tone-0"`
            }

            html += `<ruby>${char}<rt ${rtClass}>${py}</rt></ruby>`
        } else {
            html += char
        }
    }

    setResultHtml(html)
    setResultMode('html')
    setShowResult(true)
    setTimeout(() => resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 100)
  }

  const speakText = () => {
    if (!inputText) return
    window.speechSynthesis.cancel()
    const utterance = new SpeechSynthesisUtterance(inputText)
    utterance.lang = 'zh-CN'
    utterance.rate = 0.9
    window.speechSynthesis.speak(utterance)
  }

  const copyResult = async () => {
    if (!resultRef.current) return
    
    try {
        // Use Range API to select text (works for both text and HTML/Ruby)
        const range = document.createRange()
        range.selectNodeContents(resultRef.current)
        const selection = window.getSelection()
        if (selection) {
            selection.removeAllRanges()
            selection.addRange(range)
            document.execCommand('copy') // Legacy but reliable for rich text copy if needed, or just text
            selection.removeAllRanges()
            showToastMsg('已复制到剪贴板')
        }
    } catch (err) {
        showToastMsg('复制失败', 'error')
    }
  }

  const clearContent = () => {
    setInputText('')
    setResultHtml('')
    setShowResult(false)
    window.speechSynthesis.cancel()
  }

  return (
    <div className="max-w-5xl mx-auto p-4 md:p-8 space-y-6">
      {/* Inline Styles for Ruby and Tones */}
      <style jsx global>{`
        ruby {
            font-family: "Courier New", Courier, monospace, sans-serif;
            margin: 0 4px;
            font-size: 1.4em;
            line-height: 2;
        }
        rt {
            font-size: 0.5em;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            font-weight: normal;
            user-select: none;
        }
        .tone-1 { color: #ef4444; }
        .tone-2 { color: #10b981; }
        .tone-3 { color: #8b5cf6; }
        .tone-4 { color: #3b82f6; }
        .tone-0 { color: #6b7280; }
        @keyframes fadeIn {
            from { opacity: 0; transform: translateY(10px); }
            to { opacity: 1; transform: translateY(0); }
        }
        .animate-fade-in {
            animation: fadeIn 0.3s ease-out forwards;
        }
      `}</style>

      {/* Header */}
      <div className="flex items-center gap-2 mb-6">
        <Languages className="h-6 w-6 text-blue-600" />
        <h2 className="text-xl font-bold text-gray-800">汉字转拼音</h2>
      </div>

      <Card className="p-6 md:p-8">
        {/* Input Area */}
        <div className="mb-6 relative">
            <textarea 
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                className="w-full h-40 p-4 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none resize-y text-gray-700 text-lg shadow-sm transition-all" 
                placeholder="在这里输入你要转换的中文..."
            />
            <div className="absolute bottom-3 right-3 text-xs text-gray-400">
                支持多行文本
            </div>
        </div>

        {/* Options Area */}
        <div className="bg-gray-50 p-4 rounded-lg border border-gray-100 mb-6 space-y-4 text-sm">
            <div className="flex flex-wrap items-center gap-6">
                <div className="flex items-center gap-3">
                    <span className="font-bold text-gray-700">字母方式:</span>
                    <label className="flex items-center cursor-pointer hover:text-blue-600">
                        <input type="radio" name="case" checked={caseType === 'lower'} onChange={() => setCaseType('lower')} className="mr-1 accent-blue-500" /> 全部小写
                    </label>
                    <label className="flex items-center cursor-pointer hover:text-blue-600">
                        <input type="radio" name="case" checked={caseType === 'capitalize'} onChange={() => setCaseType('capitalize')} className="mr-1 accent-blue-500" /> 首字母大写
                    </label>
                    <label className="flex items-center cursor-pointer hover:text-blue-600">
                        <input type="radio" name="case" checked={caseType === 'upper'} onChange={() => setCaseType('upper')} className="mr-1 accent-blue-500" /> 全部大写
                    </label>
                </div>

                <div className="flex items-center gap-3">
                    <span className="font-bold text-gray-700">拼音间隔:</span>
                    <label className="flex items-center cursor-pointer hover:text-blue-600">
                        <input type="radio" name="separator" checked={separator === 'space'} onChange={() => setSeparator('space')} className="mr-1 accent-blue-500" /> 空格
                    </label>
                    <label className="flex items-center cursor-pointer hover:text-blue-600">
                        <input type="radio" name="separator" checked={separator === 'none'} onChange={() => setSeparator('none')} className="mr-1 accent-blue-500" /> 无
                    </label>
                </div>
            </div>

            <div className="flex items-center gap-3 pt-2 border-t border-gray-200">
                <span className="font-bold text-gray-700">高级选项:</span>
                <label className="flex items-center cursor-pointer select-none">
                    <input type="checkbox" checked={colorTone} onChange={(e) => setColorTone(e.target.checked)} className="mr-2 accent-blue-500 w-4 h-4" /> 
                    <span className="text-gray-700">启用声调色彩 (教学模式)</span>
                </label>
            </div>
        </div>

        {/* Button Area */}
        <div className="flex flex-wrap gap-3 mb-8">
            <button onClick={() => convert('none')} className="bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 px-5 py-2.5 rounded-lg text-sm font-medium shadow-sm transition-all active:translate-y-[1px]">
                无声调拼音
            </button>
            <button onClick={() => convert('symbol')} className="bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 px-5 py-2.5 rounded-lg text-sm font-medium shadow-sm transition-all active:translate-y-[1px]">
                带声调拼音
            </button>
            <button onClick={convertComparison} className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2.5 rounded-lg text-sm font-medium shadow-md flex items-center transition-all active:translate-y-[1px]">
                <ArrowRightLeft className="h-4 w-4 mr-1" />
                生成拼音对照
            </button>
            <button onClick={clearContent} className="bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 px-5 py-2.5 rounded-lg text-sm font-medium ml-auto transition-all active:translate-y-[1px]">
                清空
            </button>
        </div>

        {/* Result Area */}
        {showResult && (
            <div className="animate-fade-in">
                <div className="flex justify-between items-end mb-2">
                    <h3 className="text-gray-800 font-bold text-lg">转换结果</h3>
                    <div className="flex gap-2">
                        <button onClick={speakText} className="flex items-center gap-1 text-xs bg-indigo-50 text-indigo-700 border border-indigo-200 px-3 py-1.5 rounded-md hover:bg-indigo-100 transition-colors">
                            <Volume2 className="h-4 w-4" />
                            朗读
                        </button>
                        <button onClick={copyResult} className="flex items-center gap-1 text-xs bg-white text-gray-700 border border-gray-300 px-3 py-1.5 rounded-md hover:bg-gray-50 transition-colors">
                            <Copy className="h-4 w-4" />
                            复制结果
                        </button>
                    </div>
                </div>
                
                <div className="relative">
                    <div 
                        ref={resultRef}
                        contentEditable
                        suppressContentEditableWarning
                        className="w-full p-6 bg-white border border-gray-200 rounded-lg text-gray-800 text-lg outline-none whitespace-pre-wrap leading-loose shadow-inner min-h-[12rem] max-h-[24rem] overflow-y-auto"
                        dangerouslySetInnerHTML={resultMode === 'html' ? { __html: resultHtml } : undefined}
                    >
                        {resultMode === 'text' ? resultHtml : undefined}
                    </div>
                </div>
            </div>
        )}
      </Card>

      {/* Toast */}
      {toast && (
        <div className={`fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-white px-4 py-2 rounded shadow-lg text-sm transition-opacity z-50 ${toast.type === 'error' ? 'bg-red-500' : 'bg-gray-800'}`}>
            {toast.msg}
        </div>
      )}
    </div>
  )
}
