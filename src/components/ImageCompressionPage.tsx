'use client'

import React, { useState, useRef, useEffect, useCallback } from 'react'
import { Upload, Image as ImageIcon, Download, Trash2, Settings, FileArchive, Check, AlertCircle, RefreshCw, X, HelpCircle } from 'lucide-react'
import { Card } from '@/components/SharedUI'
import JSZip from 'jszip'

// --- Constants & Helpers ---

const formatBytes = (bytes: number) => {
  if (!Number.isFinite(bytes)) return '-'
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

const clamp = (n: number, a: number, b: number) => Math.max(a, Math.min(b, n))

const safeBaseName = (filename: string) => {
  const dot = filename.lastIndexOf('.')
  const base = dot > 0 ? filename.slice(0, dot) : filename
  return base.replace(/[\\/:*?"<>|]/g, '_').trim() || 'image'
}

const extForMime = (mime: string) => {
  if (mime === 'image/jpeg') return 'jpg'
  if (mime === 'image/png') return 'png'
  if (mime === 'image/webp') return 'webp'
  return 'bin'
}

// --- Image Processing Logic (Ported from HTML) ---

async function isAnimatedGif(file: File): Promise<boolean> {
  return new Promise((resolve) => {
    if (!file || file.type !== 'image/gif') return resolve(false)
    const reader = new FileReader()
    reader.onload = () => {
      const bytes = new Uint8Array(reader.result as ArrayBuffer)
      // NETSCAPE2.0
      const needle = [78, 69, 84, 83, 67, 65, 80, 69, 50, 46, 48]
      let found = false
      outer: for (let i = 0; i <= bytes.length - needle.length; i++) {
        for (let j = 0; j < needle.length; j++) {
          if (bytes[i + j] !== needle[j]) continue outer
        }
        found = true; break
      }
      resolve(found)
    }
    reader.onerror = () => resolve(false)
    reader.readAsArrayBuffer(file.slice(0, 256 * 1024))
  })
}

function getExifOrientationFromArrayBuffer(buf: ArrayBuffer): number {
  try {
    const view = new DataView(buf)
    if (view.getUint16(0, false) !== 0xFFD8) return 1
    let offset = 2
    const length = view.byteLength
    while (offset < length) {
      const marker = view.getUint16(offset, false)
      offset += 2
      if (marker === 0xFFE1) {
        offset += 2
        if (view.getUint32(offset, false) !== 0x45786966) return 1
        offset += 6
        const tiffOffset = offset
        const endianness = view.getUint16(tiffOffset, false)
        const little = endianness === 0x4949
        if (!little && endianness !== 0x4D4D) return 1
        const magic = view.getUint16(tiffOffset + 2, little)
        if (magic !== 0x002A) return 1
        const ifd0 = view.getUint32(tiffOffset + 4, little)
        let dirOffset = tiffOffset + ifd0
        const entries = view.getUint16(dirOffset, little)
        dirOffset += 2
        for (let i = 0; i < entries; i++) {
          const entryOffset = dirOffset + i * 12
          const tag = view.getUint16(entryOffset, little)
          if (tag === 0x0112) {
            const type = view.getUint16(entryOffset + 2, little)
            const count = view.getUint32(entryOffset + 4, little)
            if (type === 3 && count === 1) {
              const val = view.getUint16(entryOffset + 8, little)
              return val || 1
            }
          }
        }
        return 1
      } else if ((marker & 0xFF00) !== 0xFF00) {
        break
      } else {
        const size = view.getUint16(offset, false)
        offset += size
      }
    }
  } catch (e) { }
  return 1
}

function drawImageWithOrientation(ctx: CanvasRenderingContext2D, img: ImageBitmap, orientation: number, dw: number, dh: number) {
  ctx.save()
  if (orientation === 6) {
    ctx.rotate(Math.PI / 2)
    ctx.drawImage(img, 0, -dh, dw, dh)
  } else if (orientation === 8) {
    ctx.rotate(-Math.PI / 2)
    ctx.drawImage(img, -dw, 0, dw, dh)
  } else if (orientation === 3) {
    ctx.rotate(Math.PI)
    ctx.drawImage(img, -dw, -dh, dw, dh)
  } else {
    ctx.drawImage(img, 0, 0, dw, dh)
  }
  ctx.restore()
}

function computeResize(w: number, h: number, maxEdge: number | null) {
  if (!maxEdge || maxEdge <= 0) return { w, h, scale: 1 }
  const longEdge = Math.max(w, h)
  if (longEdge <= maxEdge) return { w, h, scale: 1 }
  const scale = maxEdge / longEdge
  return { w: Math.round(w * scale), h: Math.round(h * scale), scale }
}

function canvasToBlob(canvas: HTMLCanvasElement, mime: string, quality?: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) return reject(new Error('导出失败'))
      resolve(blob)
    }, mime, quality)
  })
}

async function encodeWithTargetSize(canvas: HTMLCanvasElement, mime: string, targetBytes: number, qMin: number, qMax: number) {
  if (mime === 'image/png') {
    const blob = await canvasToBlob(canvas, mime)
    return { blob, hitTarget: blob.size <= targetBytes }
  }
  let lo = qMin, hi = qMax
  let best: Blob | null = null
  let bestUnder: Blob | null = null
  const rounds = 7

  for (let i = 0; i < rounds; i++) {
    const q = (lo + hi) / 2
    const blob = await canvasToBlob(canvas, mime, q)
    const size = blob.size

    if (size > targetBytes) {
      best = blob
      hi = q
    } else {
      bestUnder = blob
      lo = q
    }
    if (Math.abs(size - targetBytes) / targetBytes < 0.06) break
  }
  const blob = bestUnder || best
  const hitTarget = blob ? blob.size <= targetBytes : false
  return { blob, hitTarget: hitTarget }
}

async function detectAlphaViaCanvas(bitmap: ImageBitmap) {
  const w = Math.min(64, bitmap.width)
  const h = Math.min(64, bitmap.height)
  const c = document.createElement('canvas')
  c.width = w; c.height = h
  const ctx = c.getContext('2d', { willReadFrequently: true })
  if (!ctx) return false
  ctx.clearRect(0, 0, w, h)
  ctx.drawImage(bitmap, 0, 0, w, h)
  const img = ctx.getImageData(0, 0, w, h).data
  for (let i = 3; i < img.length; i += 4) {
    if (img[i] < 255) return true
  }
  return false
}

// --- Component ---

interface ImageItem {
  id: number
  file: File
  name: string
  type: string
  size: number
  animatedGif: boolean
  bitmapUrl: string
  width?: number
  height?: number
  hasAlpha?: boolean
  outBlob?: Blob | null
  outMime?: string
  outUrl?: string
  outSize?: number
  outName?: string
  outW?: number
  outH?: number
  status: 'pending' | 'processing' | 'done' | 'error'
  note: string
}

const ImageCompressionPage = () => {
  const [items, setItems] = useState<ImageItem[]>([])
  const [isProcessing, setIsProcessing] = useState(false)
  const [progress, setProgress] = useState({ done: 0, total: 0 })
  
  // Settings
  const [targetSizeKB, setTargetSizeKB] = useState(800)
  const [resizeMode, setResizeMode] = useState('max1600') // max1600, max2000, keep, custom
  const [customMaxEdge, setCustomMaxEdge] = useState(1600)
  const [outputFormat, setOutputFormat] = useState('auto') // auto, image/jpeg, image/png
  
  // Options
  const [autoZip, setAutoZip] = useState(true)
  const [keepExif, setKeepExif] = useState(false)
  const [forceWhiteBg, setForceWhiteBg] = useState(false)

  // Modal
  const [showZipModal, setShowZipModal] = useState(false)
  const [zipStats, setZipStats] = useState({ count: 0, src: '', out: '', saved: '' })

  const fileInputRef = useRef<HTMLInputElement>(null)
  const hoverPreviewRef = useRef<HTMLDivElement>(null)
  const hoverZoomBoxRef = useRef<HTMLDivElement>(null)
  const hoverPreviewDimRef = useRef<HTMLElement>(null)
  const hoverActiveIdRef = useRef<number | null>(null)

  // Cleanup
  useEffect(() => {
    return () => {
      items.forEach(it => {
        if (it.bitmapUrl) URL.revokeObjectURL(it.bitmapUrl)
        if (it.outUrl) URL.revokeObjectURL(it.outUrl)
      })
    }
  }, [])

  // --- Logic ---

  const addFiles = async (files: File[]) => {
    const newItems: ImageItem[] = []
    for (const f of files) {
      if (!f.type || !f.type.startsWith('image/')) continue
      
      const item: ImageItem = {
        id: Math.random(), // Simple ID
        file: f,
        name: f.name,
        type: f.type,
        size: f.size,
        animatedGif: false,
        bitmapUrl: URL.createObjectURL(f),
        status: 'pending',
        note: ''
      }
      
      // Async checks
      item.animatedGif = await isAnimatedGif(f)
      if (!item.animatedGif) {
        try {
          const bmp = await createImageBitmap(f)
          item.width = bmp.width
          item.height = bmp.height
          item.hasAlpha = await detectAlphaViaCanvas(bmp)
          bmp.close()
        } catch (e) {}
      }
      newItems.push(item)
    }
    setItems(prev => {
        // Reset results of existing items if adding new ones? 
        // Original logic resets everything on add. Let's append but reset status of all?
        // Original: resetResults() called on add.
        const resetOld = prev.map(it => ({ 
            ...it, 
            status: 'pending' as const, 
            outBlob: null, outUrl: (it.outUrl ? (URL.revokeObjectURL(it.outUrl), undefined) : undefined), 
            outSize: undefined, outName: undefined, outW: undefined, outH: undefined, note: ''
        }))
        return [...resetOld, ...newItems]
    })
    setProgress({ done: 0, total: 0 })
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault(); e.stopPropagation()
    if (e.dataTransfer.files?.length) addFiles(Array.from(e.dataTransfer.files))
  }

  const clearAll = () => {
    items.forEach(it => {
      if (it.bitmapUrl) URL.revokeObjectURL(it.bitmapUrl)
      if (it.outUrl) URL.revokeObjectURL(it.outUrl)
    })
    setItems([])
    setProgress({ done: 0, total: 0 })
  }

  const removeItem = (id: number) => {
    setItems(prev => {
      const target = prev.find(i => i.id === id)
      if (target) {
        if (target.bitmapUrl) URL.revokeObjectURL(target.bitmapUrl)
        if (target.outUrl) URL.revokeObjectURL(target.outUrl)
      }
      return prev.filter(i => i.id !== id)
    })
  }

  const processAll = async () => {
    if (isProcessing || items.length === 0) return
    setIsProcessing(true)
    
    // Preset map
    const presetMap: Record<number, {qMin: number, qMax: number}> = {
      1200: { qMin: 0.78, qMax: 0.92 },
      800:  { qMin: 0.70, qMax: 0.90 },
      500:  { qMin: 0.62, qMax: 0.88 },
    }
    const preset = presetMap[targetSizeKB] || presetMap[800]
    const targetBytes = targetSizeKB * 1024
    
    const maxEdge = resizeMode === 'keep' ? null : 
                    resizeMode === 'max2000' ? 2000 : 
                    resizeMode === 'custom' ? clamp(customMaxEdge, 200, 6000) : 1600

    let doneCount = 0
    const total = items.length
    setProgress({ done: 0, total })

    // We process sequentially to avoid freezing UI too much, but allow React to render progress
    // Using a temp array to track state updates
    const currentItems = [...items]
    
    // Reset output
    currentItems.forEach(it => {
        if (it.outUrl) URL.revokeObjectURL(it.outUrl)
        it.outBlob = null; it.outUrl = undefined; it.outSize = undefined
        it.status = 'pending'; it.note = ''
    })
    setItems([...currentItems])

    for (let i = 0; i < total; i++) {
        const it = currentItems[i]
        
        if (it.animatedGif) {
            it.status = 'done'
            it.note = '动图 GIF 不支持，已跳过。'
            doneCount++
            setProgress({ done: doneCount, total })
            setItems([...currentItems])
            continue
        }

        it.status = 'processing'
        setItems([...currentItems])

        // Yield to main thread to let UI update
        await new Promise(r => setTimeout(r, 10))

        try {
            let orientation = 1
            if (it.file.type === 'image/jpeg') {
                const buf = await it.file.arrayBuffer()
                orientation = getExifOrientationFromArrayBuffer(buf)
            }

            const bitmap = await createImageBitmap(it.file)
            const srcW = bitmap.width
            const srcH = bitmap.height

            const { w: dstW, h: dstH } = computeResize(srcW, srcH, maxEdge)
            
            const rotate90 = (orientation === 6 || orientation === 8)
            const canvas = document.createElement('canvas')
            canvas.width = rotate90 ? dstH : dstW
            canvas.height = rotate90 ? dstW : dstH

            const ctx = canvas.getContext('2d', { alpha: true })
            if (!ctx) throw new Error('Canvas context failed')

            // Pick output mime
            let outMime = 'image/jpeg'
            if (outputFormat === 'image/png') outMime = 'image/png'
            else if (outputFormat === 'image/jpeg') outMime = 'image/jpeg'
            else outMime = it.hasAlpha ? 'image/png' : 'image/jpeg'

            if (outMime === 'image/jpeg') {
                if (forceWhiteBg || it.hasAlpha) {
                    ctx.fillStyle = '#ffffff'
                    ctx.fillRect(0, 0, canvas.width, canvas.height)
                }
            } else {
                ctx.clearRect(0, 0, canvas.width, canvas.height)
            }

            ctx.imageSmoothingEnabled = true
            ctx.imageSmoothingQuality = 'high'
            drawImageWithOrientation(ctx, bitmap, orientation, dstW, dstH)
            bitmap.close()

            const { blob, hitTarget } = await encodeWithTargetSize(canvas, outMime, targetBytes, preset.qMin, preset.qMax)

            if (!blob) throw new Error('Encoding failed')

            if (outMime === 'image/png' && !hitTarget) {
                it.note = 'PNG 为无损格式，体积未必能明显变小；如需更小建议改用 JPEG 或降低尺寸。'
            } else if (!hitTarget) {
                it.note = '已尽量压缩但未达到目标（为避免变糊已触及质量下限）。可尝试“体积优先”或降低最大边。'
            }

            if (keepExif) {
                it.note = (it.note ? it.note + ' ' : '') + '提示：浏览器重编码通常无法保留 EXIF 元数据。'
            }

            const base = safeBaseName(it.name)
            const outExt = extForMime(outMime)
            
            it.outMime = outMime
            it.outName = `${base}_${targetSizeKB}kb.${outExt}`
            it.outBlob = blob
            it.outSize = blob.size
            it.outUrl = URL.createObjectURL(blob)
            it.outW = canvas.width
            it.outH = canvas.height
            it.status = 'done'

        } catch (err: any) {
            console.error(err)
            it.status = 'error'
            it.note = `处理失败：${err.message || String(err)}`
        }

        doneCount++
        setProgress({ done: doneCount, total })
        setItems([...currentItems])
    }

    setIsProcessing(false)

    // Auto zip check
    const successItems = currentItems.filter(x => x.outBlob && x.status === 'done')
    if (autoZip && successItems.length > 0) {
        const srcTotal = items.reduce((s, it) => s + it.size, 0)
        const outTotal = successItems.reduce((s, it) => s + (it.outSize || 0), 0)
        const saved = srcTotal > 0 ? (1 - outTotal / srcTotal) * 100 : 0
        
        setZipStats({
            count: successItems.length,
            src: formatBytes(srcTotal),
            out: formatBytes(outTotal),
            saved: `${saved.toFixed(1)}%`
        })
        setShowZipModal(true)
        downloadZip(currentItems)
    }
  }

  const downloadZip = async (currentList = items) => {
    const zip = new JSZip()
    const processed = currentList.filter(i => i.status === 'done' && i.outBlob)
    if (!processed.length) return

    processed.forEach(item => {
        if (item.outBlob && item.outName) {
            zip.file(item.outName, item.outBlob)
        }
    })

    const content = await zip.generateAsync({ type: 'blob' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(content)
    link.download = `images_${processed.length}pcs.zip`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    setTimeout(() => URL.revokeObjectURL(link.href), 1000)
  }

  const downloadOne = (item: ImageItem) => {
      if (!item.outBlob || !item.outUrl) return
      const link = document.createElement('a')
      link.href = item.outUrl
      link.download = item.outName || 'image.jpg'
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
  }

  // --- Preview Logic ---
  
  const handleMouseMove = (e: React.MouseEvent, item: ImageItem) => {
      if (!item.outUrl || item.status !== 'done' || !item.outW || !item.outH) return
      const thumb = e.currentTarget.getBoundingClientRect()
      const lens = e.currentTarget.querySelector('.lens') as HTMLElement
      
      // Update Preview Box
      if (hoverPreviewRef.current && hoverZoomBoxRef.current && hoverPreviewDimRef.current) {
          hoverPreviewRef.current.style.display = 'block'
          hoverActiveIdRef.current = item.id
          
          // Position Panel
          const pad = 12
          const size = window.innerWidth < 720 ? 400 : 480
          let x = e.clientX + pad
          let y = e.clientY + pad
          if (x + size + 12 > window.innerWidth) x = e.clientX - size - pad
          if (y + size + 12 > window.innerHeight) y = e.clientY - size - pad
          x = clamp(x, 8, Math.max(8, window.innerWidth - size - 8))
          y = clamp(y, 8, Math.max(8, window.innerHeight - size - 8))
          
          hoverPreviewRef.current.style.left = `${x}px`
          hoverPreviewRef.current.style.top = `${y}px`
          
          // Content
          hoverPreviewDimRef.current.textContent = `${item.outW}×${item.outH} · 100%`
          hoverZoomBoxRef.current.style.backgroundImage = `url("${item.outUrl}")`
          hoverZoomBoxRef.current.style.backgroundSize = `${item.outW}px ${item.outH}px`
          
          // Calculate Lens & Pan
          const rx = clamp((e.clientX - thumb.left) / thumb.width, 0, 1)
          const ry = clamp((e.clientY - thumb.top) / thumb.height, 0, 1)
          
          const viewW = hoverZoomBoxRef.current.clientWidth
          const viewH = hoverZoomBoxRef.current.clientHeight
          const bgW = item.outW!
          const bgH = item.outH!
          
          const panX = clamp(rx * bgW - viewW / 2, 0, Math.max(0, bgW - viewW))
          const panY = clamp(ry * bgH - viewH / 2, 0, Math.max(0, bgH - viewH))
          
          hoverZoomBoxRef.current.style.backgroundPosition = `${-panX}px ${-panY}px`
          
          // Lens Position
          if (lens) {
              lens.style.opacity = '1'
              const lensW = clamp((viewW / bgW) * thumb.width, 24, thumb.width)
              const lensH = clamp((viewH / bgH) * thumb.height, 24, thumb.height)
              const lx = clamp((e.clientX - thumb.left) - lensW / 2, 0, thumb.width - lensW)
              const ly = clamp((e.clientY - thumb.top) - lensH / 2, 0, thumb.height - lensH)
              
              lens.style.width = `${lensW}px`
              lens.style.height = `${lensH}px`
              lens.style.transform = `translate(${lx}px, ${ly}px)`
          }
      }
  }
  
  const handleMouseLeave = () => {
      if (hoverPreviewRef.current) hoverPreviewRef.current.style.display = 'none'
      hoverActiveIdRef.current = null
      const lenses = document.querySelectorAll('.lens')
      lenses.forEach((l: any) => l.style.opacity = '0')
  }

  // --- Render ---
  
  return (
    <div className="space-y-6 max-w-[1100px] mx-auto pb-20">
      {/* Header */}
      <div className="flex flex-col gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">图片压缩与格式转换</h2>
          <p className="text-sm text-gray-500 mt-1">本工具在浏览器本地处理图片：批量压缩、改格式、打包下载（不会上传）。</p>
        </div>
        <div className="flex flex-wrap gap-2">
            <span className="px-3 py-1.5 text-xs text-gray-500 bg-white/70 backdrop-blur-sm border border-gray-200 rounded-full">批量上传/批量处理</span>
            <span className="px-3 py-1.5 text-xs text-gray-500 bg-white/70 backdrop-blur-sm border border-gray-200 rounded-full">默认：均衡 + 最大边 1600px</span>
            <span className="px-3 py-1.5 text-xs text-gray-500 bg-white/70 backdrop-blur-sm border border-gray-200 rounded-full">自动格式：透明→PNG，否则→JPEG</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1.1fr_0.9fr] gap-4">
        {/* Upload Card */}
        <Card className="p-0 overflow-hidden shadow-sm border border-gray-200/60 rounded-2xl">
           <div className="px-4 py-3 border-b border-gray-100 flex justify-between items-center bg-white">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-gray-800 text-sm">上传</span>
                <span className="text-xs text-gray-400 font-mono">{items.length} 个文件</span>
              </div>
           </div>
           <div className="p-4">
              <div 
                className="border-dashed border border-gray-300 rounded-2xl bg-gray-50/50 min-h-[150px] flex flex-col items-center justify-center text-center gap-2 transition-colors hover:bg-blue-50/20 hover:border-blue-300"
                onDrop={handleDrop}
                onDragOver={(e) => { e.preventDefault(); e.stopPropagation() }}
                onClick={(e) => {
                    if ((e.target as HTMLElement).tagName !== 'BUTTON') fileInputRef.current?.click()
                }}
              >
                <strong className="text-sm text-gray-700">拖拽图片到这里，或点击选择文件</strong>
                <span className="text-xs text-gray-400">支持 PNG / JPG(JPEG) / GIF / WebP。动画 GIF 将自动跳过。</span>
                <div className="flex gap-2 mt-2">
                    <button 
                        onClick={() => fileInputRef.current?.click()}
                        className="px-3 py-2 bg-gradient-to-b from-[#0077ed] to-[#0071e3] text-white text-xs rounded-xl shadow-sm hover:opacity-90 active:scale-[0.98] transition-all"
                    >
                        选择文件
                    </button>
                    <button 
                        onClick={(e) => { e.stopPropagation(); clearAll() }}
                        disabled={items.length === 0}
                        className="px-3 py-2 bg-white border border-gray-200 text-gray-700 text-xs rounded-xl hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                    >
                        清空列表
                    </button>
                </div>
                <input ref={fileInputRef} type="file" className="hidden" accept="image/*" multiple onChange={(e) => e.target.files && addFiles(Array.from(e.target.files))} />
              </div>
           </div>
        </Card>

        {/* Settings Card */}
        <Card className="p-0 overflow-hidden shadow-sm border border-gray-200/60 rounded-2xl">
           <div className="px-4 py-3 border-b border-gray-100 flex justify-between items-center bg-white">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-gray-800 text-sm">设置</span>
                <span className="text-xs text-gray-400">一键压缩</span>
              </div>
           </div>
           <div className="p-4 space-y-4">
              
              {/* Quality */}
              <div className="grid grid-cols-[80px_1fr] gap-2 items-center text-xs">
                 <span className="text-gray-500">清晰度档位</span>
                 <div className="flex items-center gap-2">
                    <select 
                        value={targetSizeKB}
                        onChange={(e) => setTargetSizeKB(Number(e.target.value))}
                        className="flex-1 border border-gray-200 rounded-xl px-3 py-2 bg-white/90 text-gray-700 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-50"
                    >
                        <option value="1200">清晰优先</option>
                        <option value="800">均衡（推荐）</option>
                        <option value="500">体积优先</option>
                    </select>
                    <span className="px-2 py-1 bg-orange-50 text-orange-700 border border-orange-200/50 rounded-full text-[10px] whitespace-nowrap">肉眼不糊</span>
                 </div>
              </div>

              {/* Format */}
              <div className="grid grid-cols-[80px_1fr] gap-2 items-center text-xs">
                 <span className="text-gray-500">输出格式</span>
                 <div className="flex items-center gap-2 flex-wrap">
                    <select 
                        value={outputFormat}
                        onChange={(e) => setOutputFormat(e.target.value)}
                        className="flex-1 border border-gray-200 rounded-xl px-3 py-2 bg-white/90 text-gray-700 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-50"
                    >
                        <option value="auto">自动（推荐）</option>
                        <option value="image/jpeg">强制 JPEG</option>
                        <option value="image/png">强制 PNG</option>
                    </select>
                    <span className="px-2 py-1 bg-gray-50 text-gray-500 border border-gray-200 rounded-full text-[10px]">
                        {outputFormat === 'auto' ? '自动：透明→PNG，否则→JPEG' : outputFormat === 'image/png' ? '强制 PNG' : '强制 JPEG'}
                    </span>
                 </div>
              </div>

              {/* Resize */}
              <div className="grid grid-cols-[80px_1fr] gap-2 items-center text-xs">
                 <span className="text-gray-500">尺寸</span>
                 <div className="flex items-center gap-2">
                    <select 
                        value={resizeMode}
                        onChange={(e) => setResizeMode(e.target.value)}
                        className="flex-1 border border-gray-200 rounded-xl px-3 py-2 bg-white/90 text-gray-700 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-50"
                    >
                        <option value="max1600">最大边 1600px（默认）</option>
                        <option value="keep">保持原尺寸</option>
                        <option value="max2000">最大边 2000px</option>
                        <option value="custom">自定义最大边</option>
                    </select>
                    <input 
                        type="number" 
                        value={customMaxEdge}
                        onChange={(e) => setCustomMaxEdge(Number(e.target.value))}
                        disabled={resizeMode !== 'custom'}
                        className="w-16 border border-gray-200 rounded-xl px-2 py-2 bg-white/90 text-center outline-none focus:border-blue-400 disabled:opacity-50"
                    />
                 </div>
              </div>

              {/* Filename Preview */}
              <div className="grid grid-cols-[80px_1fr] gap-2 items-center text-xs">
                 <span className="text-gray-500">文件名</span>
                 <div className="flex items-center gap-2">
                    <span className="px-2 py-1 bg-green-50 text-green-700 border border-green-200/50 rounded-full font-mono text-[10px]">原名_{targetSizeKB}kb.jpg</span>
                    <span className="text-gray-400">随档位自动变更</span>
                 </div>
              </div>

              {/* Checkboxes */}
              <div className="grid grid-cols-[80px_1fr] gap-2 items-start text-xs">
                 <span className="text-gray-500 pt-1">下载</span>
                 <div className="flex flex-col gap-2">
                    <label className="flex items-center gap-2 cursor-pointer text-gray-600 bg-gray-50 px-2 py-1 rounded-lg border border-gray-100 w-fit">
                        <input type="checkbox" checked={autoZip} onChange={(e) => setAutoZip(e.target.checked)} className="rounded text-blue-600 focus:ring-0" />
                        处理完成后下载 ZIP
                    </label>
                 </div>
              </div>

               <div className="grid grid-cols-[80px_1fr] gap-2 items-start text-xs">
                 <span className="text-gray-500 pt-1">可选</span>
                 <div className="flex flex-wrap gap-2">
                    <label className="flex items-center gap-2 cursor-pointer text-gray-600 bg-gray-50 px-2 py-1 rounded-lg border border-gray-100" title="浏览器重编码通常无法保留EXIF">
                        <input type="checkbox" checked={keepExif} onChange={(e) => setKeepExif(e.target.checked)} className="rounded text-blue-600 focus:ring-0" />
                        保留元数据（不推荐）
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer text-gray-600 bg-gray-50 px-2 py-1 rounded-lg border border-gray-100">
                        <input type="checkbox" checked={forceWhiteBg} onChange={(e) => setForceWhiteBg(e.target.checked)} className="rounded text-blue-600 focus:ring-0" />
                        透明转 JPEG：白底
                    </label>
                 </div>
              </div>
              
              <div className="text-xs text-gray-400 leading-relaxed bg-gray-50/50 p-2 rounded-lg">
                预览：处理完成后，鼠标移到缩略图上，会出现“镜头框”，右侧显示输出图的 100% 细节（不做额外放大）。
              </div>

              <div className="flex items-center justify-between gap-4 pt-2 border-t border-gray-100">
                 <div className="flex gap-2">
                    <button 
                        onClick={processAll}
                        disabled={items.length === 0 || isProcessing}
                        className="px-4 py-2 bg-gradient-to-b from-[#2aa84a] to-[#249843] text-white text-xs rounded-xl shadow-sm hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-all font-medium"
                    >
                        {isProcessing ? '处理中...' : '开始处理'}
                    </button>
                    <button 
                        onClick={() => downloadZip()}
                        disabled={items.filter(i => i.status === 'done').length === 0}
                        className="px-4 py-2 bg-gradient-to-b from-[#0077ed] to-[#0071e3] text-white text-xs rounded-xl shadow-sm hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-all font-medium"
                    >
                        打包下载 (ZIP)
                    </button>
                 </div>
                 <div className="text-xs font-mono text-gray-500">
                    {progress.total > 0 ? `处理中：${progress.done}/${progress.total}` : '等待上传…'}
                 </div>
              </div>

              {/* Progress Bar */}
              <div className="h-2 w-full bg-gray-100 rounded-full overflow-hidden border border-gray-200/50">
                 <div 
                    className="h-full bg-gradient-to-r from-blue-500 to-green-500 transition-all duration-300"
                    style={{ width: progress.total ? `${(progress.done / progress.total) * 100}%` : '0%' }}
                 />
              </div>

           </div>
        </Card>
      </div>

      {/* Results Card */}
      <Card className="p-0 overflow-hidden shadow-sm border border-gray-200/60 rounded-2xl">
         <div className="px-4 py-3 border-b border-gray-100 flex justify-between items-center bg-white">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-gray-800 text-sm">结果</span>
              <span className="text-xs text-gray-400">可单张下载或 ZIP 打包；缩略图支持悬停 100% 细节预览</span>
            </div>
         </div>
         <div className="p-4 min-h-[100px] bg-gray-50/30">
            {items.length === 0 ? (
                <div className="text-center text-xs text-gray-400 py-8">还没有文件。把图片拖进来试试。</div>
            ) : (
                <div className="space-y-3">
                    {items.map(it => {
                        const srcMeta = `${formatBytes(it.size)} · ${it.type} · ${it.width ? `${it.width}×${it.height}` : ''}`
                        const outMeta = it.outBlob 
                            ? `${formatBytes(it.outSize!)} · ${(it.outMime ? extForMime(it.outMime).toUpperCase() : '-')}`
                            : '-'
                        const saved = (it.outBlob && it.size) ? (1 - it.outSize! / it.size) : null
                        const savedText = saved == null ? '-' : `${(saved * 100).toFixed(1)}%`
                        
                        return (
                            <div key={it.id} className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-shadow">
                                {/* Top */}
                                <div className="flex items-center justify-between px-3 py-2 border-b border-gray-100 bg-gray-50/50">
                                    <div className="flex flex-col min-w-0">
                                        <b className="text-sm text-gray-800 truncate" title={it.name}>{it.name}</b>
                                        <small className="text-[10px] text-gray-500 font-mono">{srcMeta}</small>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        {it.animatedGif ? <span className="px-2 py-0.5 rounded-full text-[10px] bg-red-50 text-red-600 border border-red-100">已跳过：动图</span> :
                                         it.status === 'done' ? <span className="px-2 py-0.5 rounded-full text-[10px] bg-green-50 text-green-700 border border-green-200">已完成</span> :
                                         it.status === 'processing' ? <span className="px-2 py-0.5 rounded-full text-[10px] bg-orange-50 text-orange-700 border border-orange-200">处理中</span> :
                                         it.status === 'error' ? <span className="px-2 py-0.5 rounded-full text-[10px] bg-red-50 text-red-600 border border-red-100">失败</span> :
                                         <span className="px-2 py-0.5 rounded-full text-[10px] bg-gray-100 text-gray-500 border border-gray-200">待处理</span>
                                        }
                                        
                                        {outputFormat === 'auto' && it.hasAlpha !== undefined && (
                                            <span className="px-2 py-0.5 rounded-full text-[10px] bg-gray-100 text-gray-500 border border-gray-200">
                                                输出：{it.hasAlpha ? 'PNG' : 'JPEG'}
                                            </span>
                                        )}

                                        <button onClick={() => removeItem(it.id)} className="px-2 py-1 text-xs bg-white border border-gray-200 rounded text-gray-500 hover:text-red-500">移除</button>
                                        <button onClick={() => downloadOne(it)} disabled={!it.outBlob} className="px-2 py-1 text-xs bg-gradient-to-b from-[#0077ed] to-[#0071e3] text-white rounded hover:opacity-90 disabled:opacity-50">下载</button>
                                    </div>
                                </div>
                                {/* Mid */}
                                <div className="p-3 grid grid-cols-1 sm:grid-cols-[160px_1fr] gap-4">
                                    <div 
                                        className="w-[160px] h-[120px] bg-gray-50 border border-gray-200 rounded-xl relative overflow-hidden flex items-center justify-center cursor-crosshair group"
                                        onMouseMove={(e) => handleMouseMove(e, it)}
                                        onMouseLeave={handleMouseLeave}
                                    >
                                        {it.bitmapUrl ? <img src={it.bitmapUrl} alt="preview" className="max-w-full max-h-full object-contain pointer-events-none" /> : <span className="text-xs text-gray-400">无预览</span>}
                                        <div className="lens absolute top-0 left-0 border border-blue-500/40 bg-blue-500/10 rounded pointer-events-none opacity-0 transition-opacity"></div>
                                    </div>
                                    <div className="space-y-1">
                                        <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                                            <div className="text-gray-500">输出文件：<b className="font-mono text-gray-800">{it.outName || '-'}</b></div>
                                            <div className="text-gray-500">输出大小：<b className="font-mono text-gray-800">{outMeta}</b></div>
                                            <div className="text-gray-500">节省体积：<b className="font-mono text-gray-800">{savedText}</b></div>
                                            <div className="text-gray-500">处理说明：<b className="text-gray-800">{it.animatedGif ? '动图 GIF 已跳过' : (it.status === 'done' ? '完成' : it.status === 'error' ? '失败' : '—')}</b></div>
                                        </div>
                                        {it.note && <div className="text-xs text-orange-600 mt-2 bg-orange-50 p-2 rounded border border-orange-100">{it.note}</div>}
                                    </div>
                                </div>
                            </div>
                        )
                    })}
                </div>
            )}
         </div>
      </Card>

      {/* Hover Preview Portal */}
      <div ref={hoverPreviewRef} className="fixed z-50 hidden pointer-events-none shadow-2xl rounded-2xl overflow-hidden bg-white/90 backdrop-blur border border-gray-200 w-[480px] h-[480px]">
         <div className="px-3 py-2 text-xs text-gray-500 border-b border-gray-100 flex justify-between bg-white/80">
            <span>100% 细节</span>
            <b ref={hoverPreviewDimRef} className="font-mono text-gray-800">-</b>
         </div>
         <div ref={hoverZoomBoxRef} className="w-full h-[calc(100%-32px)] bg-gray-50 bg-no-repeat bg-[0_0]"></div>
      </div>

      {/* Zip Modal */}
      {showZipModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
            <div className="bg-white/95 backdrop-blur rounded-2xl shadow-2xl w-full max-w-[500px] border border-white/60">
                <div className="p-4 border-b border-gray-100 flex justify-between items-center">
                    <b className="text-gray-800">处理完成</b>
                    <button onClick={() => setShowZipModal(false)} className="text-gray-400 hover:text-gray-600"><X className="w-4 h-4" /></button>
                </div>
                <div className="p-6">
                    <p className="text-sm text-gray-600 mb-4">已为你生成压缩后的文件。若浏览器未自动开始下载，请点击下方按钮下载 ZIP。</p>
                    <div className="grid grid-cols-2 gap-4 text-xs bg-gray-50 p-3 rounded-xl border border-gray-100">
                        <div className="text-gray-500">文件数量：<b className="text-gray-800">{zipStats.count} 个</b></div>
                        <div className="text-gray-500">原始总大小：<b className="text-gray-800">{zipStats.src}</b></div>
                        <div className="text-gray-500">输出总大小：<b className="text-gray-800">{zipStats.out}</b></div>
                        <div className="text-gray-500">节省比例：<b className="text-gray-800">{zipStats.saved}</b></div>
                    </div>
                </div>
                <div className="p-4 flex justify-end gap-3 bg-gray-50/50 rounded-b-2xl">
                    <button onClick={() => downloadZip()} className="px-4 py-2 bg-white border border-gray-200 text-gray-700 text-xs rounded-xl hover:bg-gray-50">再次下载 ZIP</button>
                    <button onClick={() => { downloadZip(); setShowZipModal(false) }} className="px-4 py-2 bg-blue-600 text-white text-xs rounded-xl hover:bg-blue-700">下载 ZIP</button>
                </div>
            </div>
        </div>
      )}

    </div>
  )
}

export default ImageCompressionPage
