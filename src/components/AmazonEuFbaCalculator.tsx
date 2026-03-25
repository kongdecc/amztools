'use client'

import React, { useEffect, useMemo, useRef, useState } from 'react'
import { AlertCircle, ExternalLink, Maximize2, Minimize2, RefreshCw } from 'lucide-react'

const TOOL_PATH = '/amazon-eu-fba-calculator.html'

export default function AmazonEuFbaCalculator() {
  const hostRef = useRef<HTMLDivElement | null>(null)
  const [isFullScreen, setIsFullScreen] = useState(false)
  const [isReady, setIsReady] = useState(false)
  const [loadError, setLoadError] = useState<string>('')

  const frameHeight = useMemo(() => {
    if (isFullScreen) return 'calc(100vh - 140px)'
    return 'calc(100vh - 260px)'
  }, [isFullScreen])

  const mountTool = async () => {
    const host = hostRef.current
    if (!host) return
    setIsReady(false)
    setLoadError('')
    try {
      const res = await fetch(TOOL_PATH, { cache: 'no-store' })
      if (!res.ok) throw new Error(`加载失败: HTTP ${res.status}`)
      const htmlText = await res.text()
      const parser = new DOMParser()
      const parsed = parser.parseFromString(htmlText, 'text/html')

      const styles = Array.from(parsed.querySelectorAll('style')).map((x) => x.textContent || '').join('\n')
      const scripts = Array.from(parsed.querySelectorAll('script')).map((x) => x.textContent || '').join('\n')

      const bodyClone = parsed.body.cloneNode(true) as HTMLElement
      bodyClone.querySelectorAll('script').forEach((x) => x.remove())

      const scopedBase = `
        :host{display:block}
        .tool-root{width:100%}
        .tool-root .container{max-width:none !important;width:100% !important;padding:16px !important;margin:0 !important;}
        .tool-root body{margin:0}
        @media (max-width:860px){
          .tool-root .container{padding:12px !important;}
        }
      `

      const transformedScript = scripts
        .replaceAll('document.getElementById', 'root.getElementById')
        .replaceAll('document.querySelectorAll', 'root.querySelectorAll')
        .replaceAll('document.querySelector', 'root.querySelector')

      const shadow = host.shadowRoot || host.attachShadow({ mode: 'open' })
      shadow.innerHTML = `<style>${styles}\n${scopedBase}</style><div class="tool-root">${bodyClone.innerHTML}</div>`
      const run = new Function('root', transformedScript)
      run(shadow)
      setIsReady(true)
    } catch (e: any) {
      setLoadError(e?.message || '加载失败')
    }
  }

  useEffect(() => {
    mountTool()
  }, [])

  const openInNewTab = () => {
    window.open(TOOL_PATH, '_blank', 'noopener,noreferrer')
  }

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 md:p-5">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div>
            <h2 className="text-lg md:text-xl font-bold text-gray-800">Amazon EU FBA 费用计算器</h2>
            <p className="text-sm text-gray-500 mt-1">已去除 iframe，直接在系统页面内渲染并运行原版逻辑</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button onClick={mountTool} className="px-3 py-2 rounded-lg text-sm font-medium border border-gray-200 text-gray-700 hover:bg-gray-50 transition-colors flex items-center gap-2">
              <RefreshCw className="h-4 w-4" />
              刷新工具
            </button>
            <button onClick={() => setIsFullScreen(v => !v)} className="px-3 py-2 rounded-lg text-sm font-medium border border-gray-200 text-gray-700 hover:bg-gray-50 transition-colors flex items-center gap-2">
              {isFullScreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
              {isFullScreen ? '退出全屏' : '全屏显示'}
            </button>
            <button onClick={openInNewTab} className="px-3 py-2 rounded-lg text-sm font-medium bg-blue-600 text-white hover:bg-blue-700 transition-colors flex items-center gap-2">
              <ExternalLink className="h-4 w-4" />
              新窗口打开
            </button>
          </div>
        </div>
      </div>
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        {!isReady && !loadError && <div className="h-10 px-4 flex items-center text-xs text-gray-500 border-b border-gray-100">正在加载计算器...</div>}
        {loadError && (
          <div className="px-4 py-3 text-sm text-red-600 bg-red-50 border-b border-red-100 flex items-center gap-2">
            <AlertCircle className="h-4 w-4" />
            {loadError}
          </div>
        )}
        <div
          style={isFullScreen ? { height: frameHeight, minHeight: 760 } : { minHeight: 760 }}
          className={isFullScreen ? 'w-full overflow-y-auto' : 'w-full'}
        >
          <div ref={hostRef} className="w-full" />
        </div>
      </div>
    </div>
  )
}
