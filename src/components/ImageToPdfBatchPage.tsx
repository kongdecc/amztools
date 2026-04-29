'use client'

import React, { useEffect, useRef, useState } from 'react'
import { jsPDF } from 'jspdf'
import { ArrowDownUp, ExternalLink, FileDown, Image as ImageIcon, Trash2, Upload } from 'lucide-react'

type OrientationOption = 'portrait' | 'landscape' | 'auto'
type FitMode = 'contain' | 'cover'
type PageSizeOption = 'a4' | 'letter' | 'image'

interface ImageItem {
  id: string
  file: File
  url: string
  name: string
  size: number
  width: number
  height: number
}

const buttonBase =
  'inline-flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-45'

export default function ImageToPdfBatchPage() {
  const [images, setImages] = useState<ImageItem[]>([])
  const [status, setStatus] = useState('尚未选择图片。')
  const [isDragging, setIsDragging] = useState(false)
  const [isExporting, setIsExporting] = useState(false)
  const [pageSize, setPageSize] = useState<PageSizeOption>('a4')
  const [orientation, setOrientation] = useState<OrientationOption>('portrait')
  const [fitMode, setFitMode] = useState<FitMode>('contain')
  const [margin, setMargin] = useState('8')
  const fileInputRef = useRef<HTMLInputElement>(null)
  const imagesRef = useRef<ImageItem[]>([])

  useEffect(() => {
    imagesRef.current = images
  }, [images])

  useEffect(() => {
    return () => {
      imagesRef.current.forEach((item) => URL.revokeObjectURL(item.url))
    }
  }, [])

  const updateStatus = (text: string) => setStatus(text)

  const handleOpenNewWindow = () => {
    window.open('/functionality/image-to-pdf-batch', '_blank', 'noopener,noreferrer')
  }

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files?.length) {
      void addFiles(event.target.files)
    }
    event.target.value = ''
  }

  const addFiles = async (fileList: FileList | File[]) => {
    const files = Array.from(fileList).filter((file) => file.type.startsWith('image/'))
    if (!files.length) {
      updateStatus('没有识别到图片文件，请选择 JPG、PNG、WebP 等图片。')
      return
    }

    try {
      const newItems = await Promise.all(
        files.map(
          (file) =>
            new Promise<ImageItem>((resolve, reject) => {
              const url = URL.createObjectURL(file)
              const img = new window.Image()
              img.onload = () =>
                resolve({
                  id: `${file.name}-${file.lastModified}-${Math.random().toString(36).slice(2, 8)}`,
                  file,
                  url,
                  name: file.name,
                  size: file.size,
                  width: img.naturalWidth,
                  height: img.naturalHeight,
                })
              img.onerror = () => {
                URL.revokeObjectURL(url)
                reject(new Error(`${file.name} 加载失败`))
              }
              img.src = url
            })
        )
      )

      setImages((prev) => {
        const total = prev.length + newItems.length
        updateStatus(`已添加 ${newItems.length} 张图片，共 ${total} 张。`)
        return [...prev, ...newItems]
      })
    } catch (error) {
      updateStatus(error instanceof Error ? error.message : '图片加载失败，请重试。')
    }
  }

  const handleClear = () => {
    images.forEach((item) => URL.revokeObjectURL(item.url))
    setImages([])
    if (fileInputRef.current) fileInputRef.current.value = ''
    updateStatus('尚未选择图片。')
  }

  const handleSort = () => {
    setImages((prev) => {
      const sorted = [...prev].sort((a, b) => a.name.localeCompare(b.name, 'zh-CN', { numeric: true }))
      return sorted
    })
    updateStatus(`已按文件名排序，共 ${images.length} 张图片。`)
  }

  const moveImage = (index: number, direction: -1 | 1) => {
    setImages((prev) => {
      const target = index + direction
      if (target < 0 || target >= prev.length) return prev
      const next = [...prev]
      ;[next[index], next[target]] = [next[target], next[index]]
      return next
    })
    updateStatus('已调整图片顺序。')
  }

  const removeImage = (index: number) => {
    setImages((prev) => {
      const target = prev[index]
      if (!target) return prev
      URL.revokeObjectURL(target.url)
      const next = [...prev]
      next.splice(index, 1)
      updateStatus(next.length ? `已删除 1 张图片，剩余 ${next.length} 张。` : '尚未选择图片。')
      return next
    })
  }

  const handleDrop = (event: React.DragEvent<HTMLElement>) => {
    event.preventDefault()
    setIsDragging(false)
    if (event.dataTransfer.files?.length) {
      void addFiles(event.dataTransfer.files)
    }
  }

  const exportPdf = async () => {
    if (!images.length || isExporting) return

    setIsExporting(true)
    updateStatus('正在生成 PDF，请稍候……')

    try {
      const marginMm = Math.max(0, Number(margin) || 0)
      let pdf: jsPDF | null = null

      for (let index = 0; index < images.length; index += 1) {
        const item = images[index]
        const imageData = await fileToDataUrl(item.file)
        const imageOrientation = item.width >= item.height ? 'landscape' : 'portrait'
        const currentOrientation = orientation === 'auto' ? imageOrientation : orientation

        let format: PageSizeOption | [number, number] = pageSize
        if (pageSize === 'image') {
          format = [pxToMm(item.width), pxToMm(item.height)]
        }

        if (!pdf) {
          pdf = new jsPDF({ orientation: currentOrientation, unit: 'mm', format })
        } else {
          pdf.addPage(format, currentOrientation)
        }

        const pageWidth = pdf.internal.pageSize.getWidth()
        const pageHeight = pdf.internal.pageSize.getHeight()
        const boxWidth = Math.max(1, pageWidth - marginMm * 2)
        const boxHeight = Math.max(1, pageHeight - marginMm * 2)
        const imgRatio = item.width / item.height
        const boxRatio = boxWidth / boxHeight

        let drawWidth = boxWidth
        let drawHeight = boxHeight

        if (fitMode === 'cover') {
          if (imgRatio > boxRatio) {
            drawHeight = boxHeight
            drawWidth = drawHeight * imgRatio
          } else {
            drawWidth = boxWidth
            drawHeight = drawWidth / imgRatio
          }
        } else if (imgRatio > boxRatio) {
          drawWidth = boxWidth
          drawHeight = drawWidth / imgRatio
        } else {
          drawHeight = boxHeight
          drawWidth = drawHeight * imgRatio
        }

        const x = (pageWidth - drawWidth) / 2
        const y = (pageHeight - drawHeight) / 2
        pdf.addImage(imageData, getImageType(item.file.type), x, y, drawWidth, drawHeight, undefined, 'FAST')
        updateStatus(`正在处理第 ${index + 1} / ${images.length} 页：${item.name}`)
      }

      if (!pdf) throw new Error('没有可导出的图片。')

      const timestamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')
      pdf.save(`images-to-pdf-${timestamp}.pdf`)
      updateStatus(`PDF 已生成并开始下载，共 ${images.length} 页。`)
    } catch (error) {
      console.error(error)
      updateStatus(`生成失败：${error instanceof Error ? error.message : '未知错误'}`)
    } finally {
      setIsExporting(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 rounded-2xl bg-gradient-to-r from-slate-900 to-slate-700 p-6 text-white shadow-sm md:flex-row md:items-center md:justify-between">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <ImageIcon className="h-6 w-6 text-indigo-200" />
            <h2 className="text-2xl font-bold">批量图片转 PDF 工具</h2>
          </div>
          <p className="max-w-3xl text-sm leading-6 text-slate-200">
            选择多张 JPG、PNG、WebP 图片后，可自动合并成一个 PDF。多张图片时，每张图片单独占一页，全部在浏览器本地处理。
          </p>
        </div>
        <button
          type="button"
          onClick={handleOpenNewWindow}
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/20 bg-white/10 px-4 py-3 text-sm font-semibold text-white transition hover:bg-white/15"
        >
          <ExternalLink className="h-4 w-4" />
          新窗口打开
        </button>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          onDragOver={(event) => {
            event.preventDefault()
            setIsDragging(true)
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          className={`w-full rounded-2xl border-2 border-dashed px-6 py-10 text-center transition ${
            isDragging ? 'border-slate-900 bg-indigo-50' : 'border-slate-300 bg-slate-50 hover:border-slate-900 hover:bg-indigo-50'
          }`}
        >
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-white shadow-sm">
            <Upload className="h-7 w-7 text-slate-700" />
          </div>
          <strong className="block text-lg text-slate-900">点击选择图片，或把图片拖到这里</strong>
          <span className="mt-2 block text-sm text-slate-500">支持多选；生成过程全部在浏览器本地完成</span>
        </button>
        <input ref={fileInputRef} type="file" accept="image/*" multiple className="hidden" onChange={handleFileChange} />

        <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Field label="PDF 页面尺寸">
            <select
              value={pageSize}
              onChange={(event) => setPageSize(event.target.value as PageSizeOption)}
              className="h-11 w-full rounded-xl border border-slate-300 px-3 text-sm outline-none transition focus:border-slate-900"
            >
              <option value="a4">A4</option>
              <option value="letter">Letter</option>
              <option value="image">跟随图片尺寸</option>
            </select>
          </Field>
          <Field label="页面方向">
            <select
              value={orientation}
              onChange={(event) => setOrientation(event.target.value as OrientationOption)}
              className="h-11 w-full rounded-xl border border-slate-300 px-3 text-sm outline-none transition focus:border-slate-900"
            >
              <option value="portrait">竖版</option>
              <option value="landscape">横版</option>
              <option value="auto">自动匹配图片</option>
            </select>
          </Field>
          <Field label="图片适配方式">
            <select
              value={fitMode}
              onChange={(event) => setFitMode(event.target.value as FitMode)}
              className="h-11 w-full rounded-xl border border-slate-300 px-3 text-sm outline-none transition focus:border-slate-900"
            >
              <option value="contain">完整显示，保留边距</option>
              <option value="cover">铺满页面，可能裁切</option>
            </select>
          </Field>
          <Field label="页面边距 mm">
            <input
              type="number"
              min="0"
              max="50"
              value={margin}
              onChange={(event) => setMargin(event.target.value)}
              className="h-11 w-full rounded-xl border border-slate-300 px-3 text-sm outline-none transition focus:border-slate-900"
            />
          </Field>
        </div>

        <div className="mt-6 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={exportPdf}
            disabled={!images.length || isExporting}
            className={`${buttonBase} bg-slate-900 text-white hover:bg-black`}
          >
            <FileDown className="h-4 w-4" />
            {isExporting ? '生成中...' : '导出 PDF'}
          </button>
          <button
            type="button"
            onClick={handleSort}
            disabled={!images.length || isExporting}
            className={`${buttonBase} bg-slate-200 text-slate-900 hover:bg-slate-300`}
          >
            <ArrowDownUp className="h-4 w-4" />
            按文件名排序
          </button>
          <button
            type="button"
            onClick={handleClear}
            disabled={!images.length || isExporting}
            className={`${buttonBase} bg-red-100 text-red-700 hover:bg-red-200`}
          >
            <Trash2 className="h-4 w-4" />
            清空图片
          </button>
        </div>

        <div className="mt-4 text-sm leading-6 text-slate-600">{status}</div>
        <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-800">
          提示：如用于打印，建议选择 A4 + 完整显示；如想每页无白边铺满，选择“铺满页面”。
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h3 className="text-xl font-bold text-slate-900">图片预览与顺序</h3>
          <span className="text-sm font-medium text-slate-500">{images.length} 张</span>
        </div>

        {!images.length ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-6 py-10 text-center text-sm text-slate-500">
            选择图片后会在这里显示，顺序就是 PDF 页码顺序。
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {images.map((item, index) => (
              <div key={item.id} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                <div className="flex aspect-square items-center justify-center overflow-hidden bg-slate-100">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={item.url} alt={item.name} className="h-full w-full object-contain" />
                </div>
                <div className="space-y-3 p-4">
                  <div className="truncate text-sm font-semibold text-slate-900" title={item.name}>
                    {index + 1}. {item.name}
                  </div>
                  <div className="text-xs text-slate-500">
                    {item.width} x {item.height}px · {formatSize(item.size)}
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      type="button"
                      onClick={() => moveImage(index, -1)}
                      disabled={index === 0 || isExporting}
                      className={`${buttonBase} px-2 py-2 text-xs bg-slate-200 text-slate-900 hover:bg-slate-300`}
                    >
                      上移
                    </button>
                    <button
                      type="button"
                      onClick={() => moveImage(index, 1)}
                      disabled={index === images.length - 1 || isExporting}
                      className={`${buttonBase} px-2 py-2 text-xs bg-slate-200 text-slate-900 hover:bg-slate-300`}
                    >
                      下移
                    </button>
                    <button
                      type="button"
                      onClick={() => removeImage(index)}
                      disabled={isExporting}
                      className={`${buttonBase} px-2 py-2 text-xs bg-red-100 text-red-700 hover:bg-red-200`}
                    >
                      删除
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-2">
      <span className="block text-sm font-medium text-slate-600">{label}</span>
      {children}
    </label>
  )
}

function fileToDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(new Error(`读取图片失败：${file.name}`))
    reader.readAsDataURL(file)
  })
}

function getImageType(mime: string) {
  if (mime.includes('png')) return 'PNG'
  if (mime.includes('webp')) return 'WEBP'
  return 'JPEG'
}

function pxToMm(px: number) {
  return (px * 25.4) / 96
}

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`
}
