'use client'

import React, { useState, useRef, useEffect, useCallback } from 'react'
import { 
  Upload, Image as ImageIcon, Download, Trash2, Settings, 
  FileArchive, Check, AlertCircle, RefreshCw, X
} from 'lucide-react'
import { Card } from '@/components/SharedUI'
import imageCompression from 'browser-image-compression'
import JSZip from 'jszip'

// Helper for formatting bytes
const formatBytes = (bytes: number) => {
  if (!Number.isFinite(bytes)) return '-'
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

interface ImageItem {
  id: string
  file: File
  status: 'pending' | 'processing' | 'done' | 'error'
  previewUrl: string
  originalSize: number
  compressedBlob?: Blob
  compressedSize?: number
  compressedUrl?: string
  error?: string
}

const ImageCompressionPage = () => {
  const [items, setItems] = useState<ImageItem[]>([])
  const [isProcessing, setIsProcessing] = useState(false)
  
  // Settings
  const [targetSizeKB, setTargetSizeKB] = useState(800)
  const [resizeMode, setResizeMode] = useState('max1600') // max1600, max2000, keep, custom
  const [customMaxEdge, setCustomMaxEdge] = useState(1600)
  const [outputFormat, setOutputFormat] = useState('auto') // auto, image/jpeg, image/png
  
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Cleanup object URLs on unmount
  useEffect(() => {
    return () => {
      items.forEach(item => {
        if (item.previewUrl) URL.revokeObjectURL(item.previewUrl)
        if (item.compressedUrl) URL.revokeObjectURL(item.compressedUrl)
      })
    }
  }, [items])

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      await addFiles(Array.from(e.target.files))
    }
    // Reset input
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const addFiles = async (files: File[]) => {
    const newItems: ImageItem[] = files
      .filter(f => f.type.startsWith('image/'))
      .map(f => ({
        id: Math.random().toString(36).substring(7),
        file: f,
        status: 'pending',
        previewUrl: URL.createObjectURL(f),
        originalSize: f.size
      }))
    
    setItems(prev => [...prev, ...newItems])
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      addFiles(Array.from(e.dataTransfer.files))
    }
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
  }

  const removeItem = (id: string) => {
    setItems(prev => {
      const item = prev.find(i => i.id === id)
      if (item) {
        URL.revokeObjectURL(item.previewUrl)
        if (item.compressedUrl) URL.revokeObjectURL(item.compressedUrl)
      }
      return prev.filter(i => i.id !== id)
    })
  }

  const clearAll = () => {
    items.forEach(item => {
      URL.revokeObjectURL(item.previewUrl)
      if (item.compressedUrl) URL.revokeObjectURL(item.compressedUrl)
    })
    setItems([])
  }

  const processImages = async () => {
    if (isProcessing) return
    setIsProcessing(true)

    const maxWidthOrHeight = resizeMode === 'custom' 
      ? customMaxEdge 
      : resizeMode === 'max1600' ? 1600 
      : resizeMode === 'max2000' ? 2000 
      : undefined

    const options = {
      maxSizeMB: targetSizeKB / 1024,
      maxWidthOrHeight: maxWidthOrHeight,
      useWebWorker: true,
      fileType: outputFormat === 'auto' ? undefined : outputFormat,
    }

    const newItems = [...items]

    for (let i = 0; i < newItems.length; i++) {
      const item = newItems[i]
      if (item.status === 'done') continue

      item.status = 'processing'
      setItems([...newItems])

      try {
        // Handle GIF skipping or special handling if needed (browser-image-compression might skip GIFs)
        if (item.file.type === 'image/gif') {
            // Simple skip for now or just copy
            item.compressedBlob = item.file
            item.compressedSize = item.file.size
            item.compressedUrl = URL.createObjectURL(item.file)
            item.status = 'done'
            continue
        }

        const compressedFile = await imageCompression(item.file, options as any)
        
        item.compressedBlob = compressedFile
        item.compressedSize = compressedFile.size
        item.compressedUrl = URL.createObjectURL(compressedFile)
        item.status = 'done'
      } catch (err: any) {
        console.error('Compression error:', err)
        item.status = 'error'
        item.error = err.message || 'Compression failed'
      }
      
      setItems([...newItems])
    }

    setIsProcessing(false)
  }

  const downloadItem = (item: ImageItem) => {
    if (!item.compressedUrl || !item.compressedBlob) return
    
    const link = document.createElement('a')
    link.href = item.compressedUrl
    
    // Determine extension
    let ext = 'jpg'
    if (item.compressedBlob.type === 'image/png') ext = 'png'
    if (item.compressedBlob.type === 'image/webp') ext = 'webp'
    
    // Construct filename: original_800kb.ext
    const originalName = item.file.name.substring(0, item.file.name.lastIndexOf('.')) || item.file.name
    link.download = `${originalName}_${targetSizeKB}kb.${ext}`
    
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const downloadZip = async () => {
    const zip = new JSZip()
    const processedItems = items.filter(i => i.status === 'done' && i.compressedBlob)
    
    if (processedItems.length === 0) return

    processedItems.forEach(item => {
      if (!item.compressedBlob) return
      
      let ext = 'jpg'
      if (item.compressedBlob.type === 'image/png') ext = 'png'
      if (item.compressedBlob.type === 'image/webp') ext = 'webp'
      
      const originalName = item.file.name.substring(0, item.file.name.lastIndexOf('.')) || item.file.name
      const fileName = `${originalName}_${targetSizeKB}kb.${ext}`
      
      zip.file(fileName, item.compressedBlob)
    })

    const content = await zip.generateAsync({ type: 'blob' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(content)
    link.download = `images_compressed_${processedItems.length}.zip`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(link.href)
  }

  const stats = {
    total: items.length,
    processed: items.filter(i => i.status === 'done').length,
    originalSize: items.reduce((acc, i) => acc + i.originalSize, 0),
    compressedSize: items.reduce((acc, i) => acc + (i.compressedSize || 0), 0),
  }
  
  const savedPercent = stats.originalSize > 0 && stats.compressedSize > 0
    ? ((1 - stats.compressedSize / stats.originalSize) * 100).toFixed(1)
    : '0'

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 mb-2">
        <ImageIcon className="h-6 w-6 text-blue-600" />
        <div>
          <h2 className="text-xl font-bold text-gray-800">图片压缩与格式转换</h2>
          <p className="text-sm text-gray-500">批量压缩、格式转换，本地处理不上传服务器</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Column: Upload & List */}
        <div className="space-y-6">
          <Card className="p-0 overflow-hidden">
            <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
              <h3 className="font-semibold text-gray-700 flex items-center gap-2">
                <Upload className="w-4 h-4" />
                上传图片
              </h3>
              <span className="text-xs text-gray-500 font-mono">{items.length} 个文件</span>
            </div>
            
            <div className="p-4">
              <div 
                className="border-2 border-dashed border-gray-200 rounded-xl bg-gray-50/50 p-8 flex flex-col items-center justify-center text-center transition-colors hover:bg-blue-50/30 hover:border-blue-200 cursor-pointer"
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className="w-10 h-10 text-gray-300 mb-3" />
                <p className="text-sm font-medium text-gray-700 mb-1">点击或拖拽图片到这里</p>
                <p className="text-xs text-gray-400">支持 JPG, PNG, WebP</p>
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  className="hidden" 
                  accept="image/*" 
                  multiple 
                  onChange={handleFileSelect} 
                />
              </div>

              {items.length > 0 && (
                <div className="mt-4 flex justify-end">
                   <button 
                    onClick={clearAll}
                    className="text-xs text-red-500 hover:text-red-600 flex items-center gap-1 px-3 py-1.5 rounded-full hover:bg-red-50 transition-colors"
                  >
                    <Trash2 className="w-3 h-3" />
                    清空列表
                  </button>
                </div>
              )}
            </div>
          </Card>

          {/* Image List */}
          {items.length > 0 && (
            <div className="space-y-3">
              {items.map(item => (
                <Card key={item.id} className="p-3 flex gap-3 items-start group">
                  <div className="w-24 h-24 shrink-0 bg-gray-100 rounded-lg overflow-hidden border border-gray-200 relative">
                    <img src={item.previewUrl} alt="preview" className="w-full h-full object-contain" />
                    {item.status === 'done' && (
                      <div className="absolute bottom-0 right-0 bg-green-500 text-white text-[10px] px-1.5 py-0.5 rounded-tl-lg">
                        -{((1 - (item.compressedSize! / item.originalSize)) * 100).toFixed(0)}%
                      </div>
                    )}
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-start">
                      <h4 className="text-sm font-medium text-gray-800 truncate pr-2" title={item.file.name}>
                        {item.file.name}
                      </h4>
                      <button 
                        onClick={() => removeItem(item.id)}
                        className="text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                    
                    <div className="mt-1 text-xs text-gray-500 space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="bg-gray-100 px-1.5 py-0.5 rounded">原始: {formatBytes(item.originalSize)}</span>
                        {item.status === 'done' && (
                           <span className="bg-green-50 text-green-700 px-1.5 py-0.5 rounded border border-green-100">
                             输出: {formatBytes(item.compressedSize!)}
                           </span>
                        )}
                      </div>
                      
                      {item.status === 'processing' && (
                        <div className="flex items-center gap-1 text-blue-600">
                          <RefreshCw className="w-3 h-3 animate-spin" />
                          <span>处理中...</span>
                        </div>
                      )}
                      
                      {item.status === 'error' && (
                        <div className="flex items-center gap-1 text-red-600">
                          <AlertCircle className="w-3 h-3" />
                          <span>{item.error}</span>
                        </div>
                      )}

                      {item.status === 'done' && (
                        <div className="pt-2">
                          <button 
                            onClick={() => downloadItem(item)}
                            className="flex items-center gap-1 text-blue-600 hover:text-blue-700 font-medium"
                          >
                            <Download className="w-3 h-3" />
                            下载
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>

        {/* Right Column: Settings & Actions */}
        <div className="space-y-6">
          <Card className="p-0 overflow-hidden sticky top-6">
             <div className="p-4 border-b border-gray-100 bg-gray-50/50">
              <h3 className="font-semibold text-gray-700 flex items-center gap-2">
                <Settings className="w-4 h-4" />
                压缩设置
              </h3>
            </div>
            
            <div className="p-5 space-y-6">
              {/* Quality / Size */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">目标大小 (KB)</label>
                <div className="grid grid-cols-3 gap-2">
                  {[500, 800, 1200].map(size => (
                    <button
                      key={size}
                      onClick={() => setTargetSizeKB(size)}
                      className={`px-3 py-2 text-sm border rounded-lg transition-colors ${
                        targetSizeKB === size 
                          ? 'bg-blue-50 border-blue-500 text-blue-700 font-medium' 
                          : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300'
                      }`}
                    >
                      {size} KB
                    </button>
                  ))}
                </div>
                <p className="text-xs text-gray-400">系统会自动调整质量以接近目标大小</p>
              </div>

              {/* Resize Mode */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">尺寸调整</label>
                <select 
                  value={resizeMode}
                  onChange={(e) => setResizeMode(e.target.value)}
                  className="w-full h-9 rounded-md border border-gray-300 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                >
                  <option value="max1600">最大边 1600px (默认)</option>
                  <option value="max2000">最大边 2000px</option>
                  <option value="keep">保持原尺寸</option>
                  <option value="custom">自定义</option>
                </select>
                {resizeMode === 'custom' && (
                  <input 
                    type="number" 
                    value={customMaxEdge}
                    onChange={(e) => setCustomMaxEdge(Number(e.target.value))}
                    className="w-full h-9 mt-2 rounded-md border border-gray-300 px-3 text-sm"
                    placeholder="输入最大边像素值"
                  />
                )}
              </div>

              {/* Output Format */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">输出格式</label>
                <select 
                  value={outputFormat}
                  onChange={(e) => setOutputFormat(e.target.value)}
                  className="w-full h-9 rounded-md border border-gray-300 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                >
                  <option value="auto">自动 (推荐)</option>
                  <option value="image/jpeg">强制 JPEG</option>
                  <option value="image/png">强制 PNG</option>
                </select>
                <p className="text-xs text-gray-400">自动：透明图转PNG，其他转JPEG</p>
              </div>

              <div className="pt-4 border-t border-gray-100">
                <button 
                  onClick={processImages}
                  disabled={items.length === 0 || isProcessing}
                  className={`w-full py-2.5 rounded-xl font-medium flex items-center justify-center gap-2 transition-all ${
                    items.length === 0 || isProcessing
                      ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                      : 'bg-gradient-to-b from-blue-500 to-blue-600 text-white shadow-md hover:from-blue-600 hover:to-blue-700 hover:shadow-lg active:scale-[0.98]'
                  }`}
                >
                  {isProcessing ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      处理中...
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4" />
                      开始处理
                    </>
                  )}
                </button>

                {stats.processed > 0 && (
                  <div className="mt-4 space-y-3">
                     <div className="p-3 bg-green-50 border border-green-100 rounded-lg">
                        <div className="flex justify-between items-center text-sm text-green-800 mb-1">
                          <span>已处理: {stats.processed}/{stats.total}</span>
                          <span className="font-bold">节省 {savedPercent}%</span>
                        </div>
                        <div className="text-xs text-green-600">
                           {formatBytes(stats.originalSize)} → {formatBytes(stats.compressedSize)}
                        </div>
                     </div>

                     <button 
                      onClick={downloadZip}
                      className="w-full py-2.5 rounded-xl font-medium flex items-center justify-center gap-2 bg-white border border-blue-200 text-blue-600 hover:bg-blue-50 transition-colors"
                    >
                      <FileArchive className="w-4 h-4" />
                      打包下载 (ZIP)
                    </button>
                  </div>
                )}
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}

export default ImageCompressionPage
