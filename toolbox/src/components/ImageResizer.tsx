'use client'

import React, { useState, useEffect, useRef } from 'react'
import JSZip from 'jszip'
import { Upload, X, Download, Image as ImageIcon, Settings, Trash2, RefreshCw, FileImage } from 'lucide-react'

const ImageResizer = () => {
  const [images, setImages] = useState<any[]>([])
  const [quality, setQuality] = useState(75)
  const [batchWidth, setBatchWidth] = useState('')
  const [batchHeight, setBatchHeight] = useState('')
  const [batchKeepRatio, setBatchKeepRatio] = useState(true)
  const [batchFormat, setBatchFormat] = useState('image/jpeg')
  const [isProcessing, setIsProcessing] = useState(false)
  const [progress, setProgress] = useState({ current: 0, total: 0 })
  const [isDragging, setIsDragging] = useState(false)
  
  const fileInputRef = useRef<HTMLInputElement>(null)
  const dropZoneRef = useRef<HTMLDivElement>(null)

  // Clean up object URLs on unmount
  useEffect(() => {
    return () => {
      images.forEach(img => {
        if (img.previewUrl) URL.revokeObjectURL(img.previewUrl)
        if (img.resizedUrl) URL.revokeObjectURL(img.resizedUrl)
      })
    }
  }, [])

  const processFiles = (files: FileList | File[]) => {
    const newFiles = Array.from(files).filter(file => file.type.startsWith('image/'))
      
    if (newFiles.length === 0) {
      alert('请选择有效的图片文件')
      return
    }

    if (images.length + newFiles.length > 100) {
      alert('图片总数不能超过100张')
      return
    }

    const newImages = newFiles.map(file => ({
      id: Math.random().toString(36).substr(2, 9),
      file,
      previewUrl: URL.createObjectURL(file),
      originalWidth: 0,
      originalHeight: 0,
      width: 0,
      height: 0,
      keepRatio: true,
      format: file.type, // Default to original format or closest
      resizedUrl: null,
      resizedSize: 0,
      status: 'pending' // pending, resized
    }))

    // Load dimensions
    newImages.forEach(imgObj => {
      const img = new Image()
      img.onload = () => {
        setImages(prev => prev.map(p => {
          if (p.id === imgObj.id) {
            return {
              ...p,
              originalWidth: img.width,
              originalHeight: img.height,
              width: img.width,
              height: img.height
            }
          }
          return p
        }))
      }
      img.src = imgObj.previewUrl
    })

    setImages(prev => [...prev, ...newImages])
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      processFiles(e.target.files)
    }
    // Reset input
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  // Drag and Drop handlers
  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(true)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
    
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processFiles(e.dataTransfer.files)
    }
  }

  const handleDelete = (id: string) => {
    setImages(prev => {
      const target = prev.find(img => img.id === id)
      if (target) {
        if (target.previewUrl) URL.revokeObjectURL(target.previewUrl)
        if (target.resizedUrl) URL.revokeObjectURL(target.resizedUrl)
      }
      return prev.filter(img => img.id !== id)
    })
  }
  
  const handleClearAll = () => {
    if (confirm('确定要清空所有图片吗？')) {
      images.forEach(img => {
        if (img.previewUrl) URL.revokeObjectURL(img.previewUrl)
        if (img.resizedUrl) URL.revokeObjectURL(img.resizedUrl)
      })
      setImages([])
      setBatchWidth('')
      setBatchHeight('')
    }
  }

  const handleResize = async (id: string) => {
    const imgObj = images.find(i => i.id === id)
    if (!imgObj) return

    if (!imgObj.width || !imgObj.height) {
      alert('请输入有效的宽度和高度')
      return
    }

    try {
      const canvas = document.createElement('canvas')
      canvas.width = imgObj.width
      canvas.height = imgObj.height
      const ctx = canvas.getContext('2d')
      
      const img = new Image()
      img.src = imgObj.previewUrl
      await new Promise((resolve) => {
        img.onload = resolve
      })
      
      if (ctx) ctx.drawImage(img, 0, 0, imgObj.width, imgObj.height)
      
      const targetFormat = imgObj.format || 'image/jpeg'
      
      canvas.toBlob((blob) => {
        if (!blob) return
        const newUrl = URL.createObjectURL(blob)
        
        // Revoke old resized url if exists
        if (imgObj.resizedUrl) URL.revokeObjectURL(imgObj.resizedUrl)

        setImages(prev => prev.map(p => {
          if (p.id === id) {
            return {
              ...p,
              resizedUrl: newUrl,
              resizedSize: blob.size,
              status: 'resized'
            }
          }
          return p
        }))
      }, targetFormat, quality / 100)
      
    } catch (error) {
      console.error('Resize failed', error)
      alert('调整大小失败')
    }
  }

  const handleBatchResize = async () => {
    const w = parseInt(batchWidth)
    const h = parseInt(batchHeight)
    
    if (!w || !h) {
      alert('请输入有效的批量宽度和高度')
      return
    }

    setIsProcessing(true)
    setProgress({ current: 0, total: images.length })

    // Update all images with batch settings first
    const updatedImages = images.map(img => ({
      ...img,
      width: w,
      height: h,
      format: batchFormat
    }))
    setImages(updatedImages)

    // Process sequentially to show progress
    for (let i = 0; i < updatedImages.length; i++) {
      const imgObj = updatedImages[i]
      
      // Resize logic (duplicated from handleResize for now to ensure we use updated state)
      try {
        const canvas = document.createElement('canvas')
        canvas.width = w
        canvas.height = h
        const ctx = canvas.getContext('2d')
        
        const img = new Image()
        img.src = imgObj.previewUrl
        await new Promise((resolve) => { img.onload = resolve })
        
        if (ctx) ctx.drawImage(img, 0, 0, w, h)
        
        await new Promise<void>((resolve) => {
          canvas.toBlob((blob) => {
            if (blob) {
              const newUrl = URL.createObjectURL(blob)
              setImages(prev => prev.map(p => {
                if (p.id === imgObj.id) {
                  if (p.resizedUrl) URL.revokeObjectURL(p.resizedUrl)
                  return { ...p, resizedUrl: newUrl, resizedSize: blob.size, status: 'resized' }
                }
                return p
              }))
            }
            resolve()
          }, batchFormat, quality / 100)
        })
      } catch (e) {
        console.error(e)
      }
      
      setProgress(prev => ({ ...prev, current: i + 1 }))
    }

    setIsProcessing(false)
  }

  const handleBatchDownload = async () => {
    const resizedImages = images.filter(img => img.status === 'resized' && img.resizedUrl)
    if (resizedImages.length === 0) {
      alert('请先调整图片大小')
      return
    }

    setIsProcessing(true)
    setProgress({ current: 0, total: resizedImages.length })

    try {
      const zip = new JSZip()
      
      for (let i = 0; i < resizedImages.length; i++) {
        const img = resizedImages[i]
        const response = await fetch(img.resizedUrl)
        const blob = await response.blob()
        
        const ext = getFileExtension(img.format)
        const name = img.file.name.split('.')[0]
        zip.file(`resized-${name}${ext}`, blob)
        
        setProgress(prev => ({ ...prev, current: i + 1 }))
      }

      const content = await zip.generateAsync({ type: 'blob' })
      const link = document.createElement('a')
      link.href = URL.createObjectURL(content)
      link.download = 'resized-images.zip'
      link.click()
    } catch (error) {
      console.error('Batch download failed', error)
      alert('批量下载失败')
    } finally {
      setIsProcessing(false)
    }
  }

  const getFileExtension = (mimeType: string) => {
    switch(mimeType) {
      case 'image/jpeg': return '.jpg'
      case 'image/png': return '.png'
      case 'image/gif': return '.gif'
      default: return '.jpg'
    }
  }

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-2 mb-2">
        <ImageIcon className="h-6 w-6 text-blue-600" />
        <h2 className="text-xl font-bold text-gray-800">图片尺寸修改工具</h2>
      </div>
      
      <div 
        ref={dropZoneRef}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        className={`bg-white p-12 rounded-xl border-2 border-dashed transition-colors text-center ${
          isDragging ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-blue-300'
        }`}
      >
        <div className="mb-6">
          <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-4">
            <Upload className="w-8 h-8 text-blue-600" />
          </div>
          <h3 className="text-lg font-medium text-gray-800 mb-2">
            拖拽图片到这里，或者点击上传
          </h3>
          <p className="text-gray-500 text-sm">
            支持 JPEG, PNG, GIF 格式，单次最多支持 100 张图片
          </p>
        </div>
        
        <label className="inline-block">
          <div className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 rounded-lg cursor-pointer flex items-center gap-2 transition-colors shadow-sm font-medium">
            <Upload size={20} />
            <span>选择图片</span>
          </div>
          <input 
            type="file" 
            ref={fileInputRef}
            onChange={handleFileChange} 
            accept="image/*" 
            multiple 
            className="hidden" 
          />
        </label>
      </div>

      {images.length > 0 && (
        <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
          <div className="space-y-6">
            {/* Global Controls */}
            <div className="border-b border-gray-100 pb-6">
              <div className="flex flex-wrap items-center gap-8 justify-center">
                <div className="flex items-center gap-4">
                  <label className="font-medium text-gray-700">压缩质量: {quality}%</label>
                  <input 
                    type="range" 
                    min="1" 
                    max="100" 
                    value={quality} 
                    onChange={(e) => setQuality(parseInt(e.target.value))}
                    className="w-48 accent-blue-600" 
                  />
                </div>
              </div>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-12 gap-6 items-end">
              <div className="lg:col-span-8 grid sm:grid-cols-3 gap-4">
                 <div>
                   <label className="block text-sm font-medium text-gray-700 mb-1">批量宽度</label>
                   <input 
                     type="number" 
                     value={batchWidth}
                     onChange={(e) => {
                       setBatchWidth(e.target.value)
                       if (batchKeepRatio && e.target.value && images[0]) {
                         const ratio = images[0].originalWidth / images[0].originalHeight
                         setBatchHeight(Math.round(parseInt(e.target.value) / ratio).toString())
                       }
                     }}
                     className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 outline-none"
                     placeholder="px"
                   />
                 </div>
                 <div>
                   <label className="block text-sm font-medium text-gray-700 mb-1">批量高度</label>
                   <input 
                     type="number" 
                     value={batchHeight}
                     onChange={(e) => {
                       setBatchHeight(e.target.value)
                       if (batchKeepRatio && e.target.value && images[0]) {
                         const ratio = images[0].originalWidth / images[0].originalHeight
                         setBatchWidth(Math.round(parseInt(e.target.value) * ratio).toString())
                       }
                     }}
                     className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 outline-none"
                     placeholder="px"
                   />
                 </div>
                 <div className="flex items-center h-10 mt-auto">
                   <label className="flex items-center gap-2 cursor-pointer">
                     <input 
                       type="checkbox" 
                       checked={batchKeepRatio}
                       onChange={(e) => setBatchKeepRatio(e.target.checked)}
                       className="rounded text-blue-600 focus:ring-blue-500 w-4 h-4"
                     />
                     <span className="text-sm text-gray-600">保持长宽比(基于首图)</span>
                   </label>
                 </div>
              </div>

              <div className="lg:col-span-4 flex flex-col gap-3">
                <select 
                  value={batchFormat}
                  onChange={(e) => setBatchFormat(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 outline-none"
                >
                  <option value="image/jpeg">JPEG</option>
                  <option value="image/png">PNG</option>
                  <option value="image/gif">GIF</option>
                </select>
                <div className="flex gap-2">
                  <button 
                    onClick={handleBatchResize}
                    disabled={isProcessing}
                    className="flex-1 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                  >
                    批量调整
                  </button>
                  <button 
                    onClick={handleBatchDownload}
                    disabled={isProcessing}
                    className="flex-1 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                  >
                    批量下载
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {images.length > 0 && (
        <div className="flex justify-end">
           <button 
             onClick={handleClearAll}
             className="text-red-500 hover:text-red-600 text-sm flex items-center gap-1"
           >
             <Trash2 size={16} />
             清空所有图片
           </button>
        </div>
      )}

      {/* Progress Modal */}
      {isProcessing && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-xl shadow-xl w-80 text-center">
            <h3 className="font-bold text-lg mb-4">处理中...</h3>
            <div className="h-2 bg-gray-200 rounded-full overflow-hidden mb-2">
              <div 
                className="h-full bg-blue-600 transition-all duration-300" 
                style={{ width: `${(progress.current / progress.total) * 100}%` }}
              />
            </div>
            <p className="text-sm text-gray-500">{progress.current} / {progress.total}</p>
          </div>
        </div>
      )}

      {/* Image Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
        {images.map((img) => (
          <div key={img.id} className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-gray-100 flex justify-between items-start">
              <h3 className="font-medium text-gray-800 truncate pr-4" title={img.file.name}>{img.file.name}</h3>
              <button 
                onClick={() => handleDelete(img.id)}
                className="text-gray-400 hover:text-red-500 transition-colors"
              >
                <X size={18} />
              </button>
            </div>
            
            <div className="p-4 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <div className="text-xs font-medium text-gray-500 text-center">原始图片</div>
                  <div className="aspect-square bg-gray-50 rounded-lg flex items-center justify-center overflow-hidden relative group">
                    <img src={img.previewUrl} alt="Original" className="max-w-full max-h-full object-contain" />
                    <div className="absolute inset-0 bg-black/60 flex items-center justify-center text-white text-xs opacity-0 group-hover:opacity-100 transition-opacity">
                      {img.originalWidth} x {img.originalHeight}
                    </div>
                  </div>
                  <div className="text-xs text-center text-gray-500">{formatFileSize(img.file.size)}</div>
                </div>

                <div className="space-y-2">
                  <div className="text-xs font-medium text-gray-500 text-center">调整预览</div>
                  <div className="aspect-square bg-gray-50 rounded-lg flex items-center justify-center overflow-hidden relative group">
                    {img.resizedUrl ? (
                      <>
                        <img src={img.resizedUrl} alt="Resized" className="max-w-full max-h-full object-contain" />
                         <div className="absolute inset-0 bg-black/60 flex items-center justify-center text-white text-xs opacity-0 group-hover:opacity-100 transition-opacity">
                          {img.width} x {img.height}
                        </div>
                      </>
                    ) : (
                      <div className="text-gray-300 text-xs p-4 text-center">等待调整</div>
                    )}
                  </div>
                  <div className="text-xs text-center text-gray-500">
                    {img.resizedSize ? formatFileSize(img.resizedSize) : '-'}
                  </div>
                </div>
              </div>

              <div className="bg-gray-50 p-4 rounded-lg space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">宽度</label>
                    <input 
                      type="number" 
                      value={img.width} 
                      onChange={(e) => {
                         const w = parseInt(e.target.value)
                         setImages(prev => prev.map(p => {
                           if (p.id === img.id) {
                             const updates: any = { width: w }
                             if (p.keepRatio && w) {
                               updates.height = Math.round(w / (p.originalWidth / p.originalHeight))
                             }
                             return { ...p, ...updates }
                           }
                           return p
                         }))
                      }}
                      className="w-full text-sm border border-gray-300 rounded px-2 py-1"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">高度</label>
                    <input 
                      type="number" 
                      value={img.height} 
                      onChange={(e) => {
                        const h = parseInt(e.target.value)
                        setImages(prev => prev.map(p => {
                          if (p.id === img.id) {
                            const updates: any = { height: h }
                            if (p.keepRatio && h) {
                              updates.width = Math.round(h * (p.originalWidth / p.originalHeight))
                            }
                            return { ...p, ...updates }
                           }
                           return p
                         }))
                      }}
                      className="w-full text-sm border border-gray-300 rounded px-2 py-1"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-2 text-xs text-gray-600">
                    <input 
                      type="checkbox" 
                      checked={img.keepRatio}
                      onChange={(e) => {
                        setImages(prev => prev.map(p => p.id === img.id ? { ...p, keepRatio: e.target.checked } : p))
                      }}
                      className="rounded text-blue-600 w-3.5 h-3.5"
                    />
                    保持比例
                  </label>
                  
                  <select 
                    value={img.format}
                    onChange={(e) => setImages(prev => prev.map(p => p.id === img.id ? { ...p, format: e.target.value } : p))}
                    className="text-xs border border-gray-300 rounded px-2 py-1"
                  >
                    <option value="image/jpeg">JPEG</option>
                    <option value="image/png">PNG</option>
                    <option value="image/gif">GIF</option>
                  </select>
                </div>

                <button 
                  onClick={() => handleResize(img.id)}
                  className="w-full bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 py-1.5 rounded text-sm font-medium transition-colors"
                >
                  调整此图
                </button>
              </div>

              {img.resizedUrl && (
                <a 
                  href={img.resizedUrl}
                  download={`resized-${img.file.name.split('.')[0]}${getFileExtension(img.format)}`}
                  className="flex items-center justify-center gap-2 w-full bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-lg text-sm font-medium transition-colors"
                >
                  <Download size={16} />
                  下载图片
                </a>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export default ImageResizer
