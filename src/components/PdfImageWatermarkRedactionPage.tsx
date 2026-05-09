'use client'

import React, { useEffect, useMemo, useRef, useState } from 'react'
import * as pdfjsLib from 'pdfjs-dist'
import { PDFDocument } from 'pdf-lib'
import {
  Download,
  ExternalLink,
  Eye,
  FileImage,
  FileText,
  Image as ImageIcon,
  MousePointer2,
  PaintBucket,
  RotateCcw,
  Shield,
  SquareDashedMousePointer,
  Upload,
} from 'lucide-react'

pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs'

type WatermarkMode = 'count' | 'center' | 'gap' | 'none'
type MaskMode = 'mosaic' | 'blur' | 'solid'
type MaskScope = 'current' | 'all'
type CurrentFileType = 'pdf' | 'image' | null
type ImageOutputFormat = 'png' | 'jpeg'

interface RedactionArea {
  page: number
  xRatio: number
  yRatio: number
  wRatio: number
  hRatio: number
}

interface SettingsState {
  watermarkText: string
  mode: WatermarkMode
  fontFamily: string
  fontSize: string
  color: string
  opacity: string
  rotation: string
  countX: string
  countY: string
  xGap: string
  yGap: string
  maskMode: MaskMode
  maskScope: MaskScope
  mosaicSize: string
  blurRadius: string
  maskColor: string
  drawMode: boolean
  imageFormat: ImageOutputFormat
  imageQuality: string
}

const DEFAULT_SETTINGS: SettingsState = {
  watermarkText: '内部资料 仅供查看 禁止外传',
  mode: 'count',
  fontFamily: 'Microsoft YaHei, PingFang SC, SimHei, Arial, sans-serif',
  fontSize: '32',
  color: '#888888',
  opacity: '0.22',
  rotation: '-30',
  countX: '2',
  countY: '4',
  xGap: '280',
  yGap: '200',
  maskMode: 'mosaic',
  maskScope: 'current',
  mosaicSize: '14',
  blurRadius: '10',
  maskColor: '#000000',
  drawMode: true,
  imageFormat: 'png',
  imageQuality: '0.92',
}

const fieldClassName =
  'h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-blue-600 focus:ring-2 focus:ring-blue-100'

export default function PdfImageWatermarkRedactionPage() {
  const [settings, setSettings] = useState<SettingsState>(DEFAULT_SETTINGS)
  const [status, setStatus] = useState<{ text: string; type: 'info' | 'success' | 'error' }>({
    text: '',
    type: 'info',
  })
  const [currentFile, setCurrentFile] = useState<File | null>(null)
  const [currentFileType, setCurrentFileType] = useState<CurrentFileType>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(0)
  const [redactionAreas, setRedactionAreas] = useState<RedactionArea[]>([])
  const [isDragging, setIsDragging] = useState(false)
  const [isGenerating, setIsGenerating] = useState(false)
  const [previewReady, setPreviewReady] = useState(false)
  const [isPreviewDragging, setIsPreviewDragging] = useState(false)
  const [previewPdfDocument, setPreviewPdfDocument] = useState<any>(null)
  const [currentImage, setCurrentImage] = useState<HTMLImageElement | null>(null)
  const [downloadInfo, setDownloadInfo] = useState<{ url: string; name: string } | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const previewBoxRef = useRef<HTMLDivElement>(null)
  const previewTimerRef = useRef<number | null>(null)
  const dragStartRef = useRef<{ x: number; y: number } | null>(null)
  const dragSnapshotRef = useRef<ImageData | null>(null)
  const renderTokenRef = useRef(0)
  const mountedRef = useRef(true)

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      if (previewTimerRef.current) window.clearTimeout(previewTimerRef.current)
      if (downloadInfo?.url) URL.revokeObjectURL(downloadInfo.url)
    }
  }, [downloadInfo])

  useEffect(() => {
    if (!hasLoadedFile(currentFileType, previewPdfDocument, currentImage)) return
    if (previewTimerRef.current) window.clearTimeout(previewTimerRef.current)
    previewTimerRef.current = window.setTimeout(() => {
      void renderPreview()
    }, 220)
    return () => {
      if (previewTimerRef.current) window.clearTimeout(previewTimerRef.current)
    }
  }, [settings, currentPage, redactionAreas, currentFileType, previewPdfDocument, currentImage])

  useEffect(() => {
    const handleResize = () => {
      if (hasLoadedFile(currentFileType, previewPdfDocument, currentImage)) {
        void renderPreview()
      }
    }
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [currentFileType, previewPdfDocument, currentImage])

  const currentPageAreas = useMemo(() => getAreasForPage(redactionAreas, currentFileType === 'image' ? 1 : currentPage), [redactionAreas, currentFileType, currentPage])

  const pageInfoText = useMemo(() => {
    if (currentFileType === 'image' && currentImage) return '图片预览'
    return `第 ${totalPages ? currentPage : 0} / ${totalPages} 页`
  }, [currentFileType, currentImage, totalPages, currentPage])

  const openNewWindow = () => {
    window.open('/functionality/pdf-image-watermark-redaction', '_blank', 'noopener,noreferrer')
  }

  const showStatus = (text: string, type: 'info' | 'success' | 'error' = 'info') => {
    setStatus({ text, type })
  }

  const clearDownloadInfo = () => {
    setDownloadInfo((prev) => {
      if (prev?.url) URL.revokeObjectURL(prev.url)
      return null
    })
  }

  const resetFileState = () => {
    setCurrentFile(null)
    setCurrentFileType(null)
    setPreviewPdfDocument(null)
    setCurrentImage(null)
    setCurrentPage(1)
    setTotalPages(0)
    setRedactionAreas([])
    setPreviewReady(false)
    clearDownloadInfo()
  }

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) {
      resetFileState()
      return
    }

    clearDownloadInfo()
    setRedactionAreas([])
    setCurrentPage(1)

    const isPdf = file.type === 'application/pdf' || /\.pdf$/i.test(file.name)
    const isImage = file.type.startsWith('image/') || /\.(png|jpe?g|webp|gif|bmp)$/i.test(file.name)

    if (!isPdf && !isImage) {
      showStatus('请选择有效的 PDF 或图片文件。', 'error')
      resetFileState()
      event.target.value = ''
      return
    }

    try {
      if (isPdf) {
        showStatus('正在加载 PDF……', 'info')
        const arrayBuffer = await file.arrayBuffer()
        const pdfDoc = await pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer) }).promise

        if (!mountedRef.current) return
        setCurrentFile(file)
        setCurrentFileType('pdf')
        setPreviewPdfDocument(pdfDoc)
        setCurrentImage(null)
        setTotalPages(pdfDoc.numPages)
        setCurrentPage(1)
        setPreviewReady(false)
        showStatus('PDF 已加载，可以调整水印参数并实时预览。', 'success')
        return
      }

      showStatus('正在加载图片……', 'info')
      const image = await loadImageFile(file)
      if (!mountedRef.current) return
      setCurrentFile(file)
      setCurrentFileType('image')
      setPreviewPdfDocument(null)
      setCurrentImage(image)
      setTotalPages(1)
      setCurrentPage(1)
      setPreviewReady(false)
      showStatus('图片已加载，可以调整水印参数、框选打码并导出处理后的图片。', 'success')
    } catch (error) {
      console.error(error)
      showStatus(`文件加载失败：${getErrorMessage(error)}`, 'error')
      resetFileState()
    } finally {
      event.target.value = ''
    }
  }

  const updateSetting = <K extends keyof SettingsState>(key: K, value: SettingsState[K]) => {
    setSettings((prev) => ({ ...prev, [key]: value }))
  }

  const renderPreview = async () => {
    if (!hasLoadedFile(currentFileType, previewPdfDocument, currentImage) || !canvasRef.current || !previewBoxRef.current) return

    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const settingsValue = parseSettings(settings)
    const renderToken = ++renderTokenRef.current

    try {
      if (currentFileType === 'image' && currentImage) {
        const naturalWidth = currentImage.naturalWidth || currentImage.width
        const naturalHeight = currentImage.naturalHeight || currentImage.height
        const scale = getImagePreviewScale(currentImage, previewBoxRef.current)

        canvas.width = Math.max(1, Math.floor(naturalWidth * scale))
        canvas.height = Math.max(1, Math.floor(naturalHeight * scale))
        ctx.clearRect(0, 0, canvas.width, canvas.height)
        ctx.drawImage(currentImage, 0, 0, canvas.width, canvas.height)

        applyRedactionsToCanvas(ctx, canvas.width, canvas.height, 1, redactionAreas, settingsValue, 1, true)
        drawWatermarkToCanvas(ctx, canvas.width, canvas.height, settingsValue, 1)

        if (renderToken === renderTokenRef.current) {
          setPreviewReady(true)
        }
        return
      }

      const page = await previewPdfDocument.getPage(currentPage)
      if (renderToken !== renderTokenRef.current) return

      const containerWidth = Math.max(260, previewBoxRef.current.clientWidth - 60)
      const originalViewport = page.getViewport({ scale: 1 })
      const scale = Math.min(1.5, Math.max(0.35, containerWidth / originalViewport.width))
      const viewport = page.getViewport({ scale })

      canvas.width = Math.max(1, Math.floor(viewport.width))
      canvas.height = Math.max(1, Math.floor(viewport.height))
      ctx.clearRect(0, 0, canvas.width, canvas.height)

      await page.render({ canvasContext: ctx, viewport }).promise
      if (renderToken !== renderTokenRef.current) return

      applyRedactionsToCanvas(ctx, canvas.width, canvas.height, currentPage, redactionAreas, settingsValue, scale, true)
      drawWatermarkToCanvas(ctx, canvas.width, canvas.height, settingsValue, scale)

      if (renderToken === renderTokenRef.current) {
        setPreviewReady(true)
      }
    } catch (error) {
      console.error(error)
      showStatus(`预览刷新失败：${getErrorMessage(error)}`, 'error')
    }
  }

  const prevPage = () => {
    if (currentFileType !== 'pdf' || !previewPdfDocument || currentPage <= 1) return
    setCurrentPage((prev) => prev - 1)
  }

  const nextPage = () => {
    if (currentFileType !== 'pdf' || !previewPdfDocument || currentPage >= totalPages) return
    setCurrentPage((prev) => prev + 1)
  }

  const getCanvasPoint = (event: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    if (!canvas) return { x: 0, y: 0 }
    const rect = canvas.getBoundingClientRect()
    const scaleX = canvas.width / rect.width
    const scaleY = canvas.height / rect.height
    return {
      x: (event.clientX - rect.left) * scaleX,
      y: (event.clientY - rect.top) * scaleY,
    }
  }

  const handleStartDraw = (event: React.MouseEvent<HTMLCanvasElement>) => {
    if (!settings.drawMode || !hasLoadedFile(currentFileType, previewPdfDocument, currentImage) || !canvasRef.current) return
    const ctx = canvasRef.current.getContext('2d')
    if (!ctx) return

    setIsPreviewDragging(true)
    dragStartRef.current = getCanvasPoint(event)
    dragSnapshotRef.current = ctx.getImageData(0, 0, canvasRef.current.width, canvasRef.current.height)
  }

  const handleDrawing = (event: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isPreviewDragging || !canvasRef.current || !dragStartRef.current || !dragSnapshotRef.current) return
    const ctx = canvasRef.current.getContext('2d')
    if (!ctx) return

    const point = getCanvasPoint(event)
    const x = Math.min(dragStartRef.current.x, point.x)
    const y = Math.min(dragStartRef.current.y, point.y)
    const w = Math.abs(point.x - dragStartRef.current.x)
    const h = Math.abs(point.y - dragStartRef.current.y)

    ctx.putImageData(dragSnapshotRef.current, 0, 0)
    ctx.save()
    ctx.strokeStyle = '#dc2626'
    ctx.lineWidth = 2
    ctx.setLineDash([8, 5])
    ctx.fillStyle = 'rgba(220, 38, 38, 0.12)'
    ctx.fillRect(x, y, w, h)
    ctx.strokeRect(x, y, w, h)
    ctx.restore()
  }

  const finishDraw = async (event?: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isPreviewDragging || !canvasRef.current || !dragStartRef.current) return
    const point = event ? getCanvasPoint(event) : dragStartRef.current
    const canvas = canvasRef.current
    const x = Math.min(dragStartRef.current.x, point.x)
    const y = Math.min(dragStartRef.current.y, point.y)
    const w = Math.abs(point.x - dragStartRef.current.x)
    const h = Math.abs(point.y - dragStartRef.current.y)

    setIsPreviewDragging(false)
    dragStartRef.current = null
    dragSnapshotRef.current = null

    if (w < 8 || h < 8) {
      await renderPreview()
      return
    }

    const page = settings.maskScope === 'all' ? 0 : currentFileType === 'image' ? 1 : currentPage
    setRedactionAreas((prev) => [
      ...prev,
      {
        page,
        xRatio: x / canvas.width,
        yRatio: y / canvas.height,
        wRatio: w / canvas.width,
        hRatio: h / canvas.height,
      },
    ])
  }

  const cancelDraw = async () => {
    if (!isPreviewDragging) return
    setIsPreviewDragging(false)
    dragStartRef.current = null
    dragSnapshotRef.current = null
    await renderPreview()
  }

  const deleteArea = (index: number) => {
    setRedactionAreas((prev) => prev.filter((_, areaIndex) => areaIndex !== index))
  }

  const clearCurrentPageAreas = () => {
    const targetPage = currentFileType === 'image' ? 1 : currentPage
    setRedactionAreas((prev) => prev.filter((area) => area.page !== targetPage))
  }

  const clearAllAreas = () => {
    setRedactionAreas([])
  }

  const resetForm = () => {
    setSettings(DEFAULT_SETTINGS)
    showStatus('已恢复默认设置。', 'info')
  }

  const generateOutput = async () => {
    if (!currentFile || !hasLoadedFile(currentFileType, previewPdfDocument, currentImage) || isGenerating) {
      showStatus('请先选择一个 PDF 或图片文件。', 'error')
      return
    }

    setIsGenerating(true)
    clearDownloadInfo()
    const parsedSettings = parseSettings(settings)

    try {
      if (currentFileType === 'image' && currentImage) {
        showStatus('正在生成图片，请稍候……', 'info')
        const outputCanvas = document.createElement('canvas')
        const naturalWidth = currentImage.naturalWidth || currentImage.width
        const naturalHeight = currentImage.naturalHeight || currentImage.height
        outputCanvas.width = naturalWidth
        outputCanvas.height = naturalHeight
        const ctx = outputCanvas.getContext('2d')
        if (!ctx) throw new Error('无法创建导出画布。')

        const mimeType = parsedSettings.imageFormat === 'jpeg' ? 'image/jpeg' : 'image/png'
        const extension = parsedSettings.imageFormat === 'jpeg' ? 'jpg' : 'png'

        if (mimeType === 'image/jpeg') {
          ctx.save()
          ctx.fillStyle = '#ffffff'
          ctx.fillRect(0, 0, outputCanvas.width, outputCanvas.height)
          ctx.restore()
        }

        ctx.drawImage(currentImage, 0, 0, outputCanvas.width, outputCanvas.height)
        const imageOutputScale = getImageOutputWatermarkScale(currentImage, canvasRef.current)
        applyRedactionsToCanvas(ctx, outputCanvas.width, outputCanvas.height, 1, redactionAreas, parsedSettings, imageOutputScale, false)
        drawWatermarkToCanvas(ctx, outputCanvas.width, outputCanvas.height, parsedSettings, imageOutputScale)

        const blob = await canvasToBlob(outputCanvas, mimeType, parsedSettings.imageQuality)
        const url = URL.createObjectURL(blob)
        const outputName = `${stripExtension(currentFile.name)}_processed.${extension}`
        setDownloadInfo({ url, name: outputName })
        showStatus('生成成功，可下载处理后的图片。', 'success')
        return
      }

      if (currentFileType !== 'pdf' || !previewPdfDocument) throw new Error('当前未加载 PDF。')
      showStatus('正在生成 PDF，请稍候……', 'info')

      const outputPdf = await PDFDocument.create()
      const outputScale = 2

      for (let pageNumber = 1; pageNumber <= totalPages; pageNumber += 1) {
        showStatus(`正在处理第 ${pageNumber} / ${totalPages} 页……`, 'info')
        const page = await previewPdfDocument.getPage(pageNumber)
        const viewport = page.getViewport({ scale: outputScale })
        const canvas = document.createElement('canvas')
        canvas.width = Math.max(1, Math.floor(viewport.width))
        canvas.height = Math.max(1, Math.floor(viewport.height))
        const ctx = canvas.getContext('2d')
        if (!ctx) throw new Error('无法创建 PDF 渲染画布。')

        await page.render({ canvasContext: ctx, viewport }).promise
        applyRedactionsToCanvas(ctx, canvas.width, canvas.height, pageNumber, redactionAreas, parsedSettings, outputScale, false)
        drawWatermarkToCanvas(ctx, canvas.width, canvas.height, parsedSettings, outputScale)

        const pngDataUrl = canvas.toDataURL('image/png')
        const pngImage = await outputPdf.embedPng(pngDataUrl)
        const pdfWidth = viewport.width / outputScale
        const pdfHeight = viewport.height / outputScale
        const newPage = outputPdf.addPage([pdfWidth, pdfHeight])
        newPage.drawImage(pngImage, { x: 0, y: 0, width: pdfWidth, height: pdfHeight })
      }

      const pdfBytes = await outputPdf.save()
      const pdfBuffer = pdfBytes.buffer.slice(pdfBytes.byteOffset, pdfBytes.byteOffset + pdfBytes.byteLength)
      const blob = new Blob([pdfBuffer], { type: 'application/pdf' })
      const url = URL.createObjectURL(blob)
      const outputName = `${stripExtension(currentFile.name)}_processed.pdf`
      setDownloadInfo({ url, name: outputName })
      showStatus('生成成功，可下载处理后的 PDF。', 'success')
    } catch (error) {
      console.error(error)
      showStatus(`处理失败：${getErrorMessage(error)}`, 'error')
    } finally {
      setIsGenerating(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 rounded-2xl bg-gradient-to-r from-blue-600 to-violet-600 p-6 text-white shadow-sm md:flex-row md:items-center md:justify-between">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Shield className="h-6 w-6 text-blue-100" />
            <h2 className="text-2xl font-bold">PDF / 图片 水印与打码工具</h2>
          </div>
          <p className="max-w-4xl text-sm leading-6 text-blue-50">
            支持 PDF 与图片文件，提供中文水印、按数量均匀分布水印、实时预览、拖拽打码、马赛克、模糊和纯色遮挡。
          </p>
        </div>
        <button
          type="button"
          onClick={openNewWindow}
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/20 bg-white/10 px-4 py-3 text-sm font-semibold text-white transition hover:bg-white/15"
        >
          <ExternalLink className="h-4 w-4" />
          新窗口打开
        </button>
      </div>

      <div className="grid gap-6 xl:grid-cols-[450px_minmax(0,1fr)]">
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="text-xl font-bold text-slate-900">文件与水印设置</h3>

          <div className="mt-5 space-y-4">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(event) => {
                event.preventDefault()
                setIsDragging(true)
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={(event) => {
                event.preventDefault()
                setIsDragging(false)
                const file = event.dataTransfer.files?.[0]
                if (file && fileInputRef.current) {
                  const transfer = new DataTransfer()
                  transfer.items.add(file)
                  fileInputRef.current.files = transfer.files
                  void handleFileChange({ target: fileInputRef.current } as React.ChangeEvent<HTMLInputElement>)
                }
              }}
              className={`w-full rounded-2xl border-2 border-dashed px-5 py-8 text-center transition ${
                isDragging ? 'border-blue-600 bg-blue-50' : 'border-slate-300 bg-slate-50 hover:border-blue-500 hover:bg-blue-50'
              }`}
            >
              <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-white shadow-sm">
                <Upload className="h-7 w-7 text-slate-700" />
              </div>
              <div className="text-base font-bold text-slate-900">选择 PDF 或图片文件</div>
              <div className="mt-2 text-sm text-slate-500">支持 PDF、PNG、JPG、WebP、GIF、BMP</div>
              {currentFile ? <div className="mt-3 text-sm font-medium text-blue-700">{currentFile.name}</div> : null}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="application/pdf,image/png,image/jpeg,image/webp,image/gif,image/bmp"
              className="hidden"
              onChange={handleFileChange}
            />

            <Field label="水印文字">
              <input className={fieldClassName} value={settings.watermarkText} onChange={(event) => updateSetting('watermarkText', event.target.value)} />
            </Field>

            <div className="grid gap-4 md:grid-cols-2">
              <Field label="水印模式">
                <select className={fieldClassName} value={settings.mode} onChange={(event) => updateSetting('mode', event.target.value as WatermarkMode)}>
                  <option value="count">按数量均匀分布</option>
                  <option value="center">单个居中</option>
                  <option value="gap">按固定间距铺满</option>
                  <option value="none">不加水印</option>
                </select>
              </Field>
              <Field label="字体">
                <select className={fieldClassName} value={settings.fontFamily} onChange={(event) => updateSetting('fontFamily', event.target.value)}>
                  <option value="Microsoft YaHei, PingFang SC, SimHei, Arial, sans-serif">默认中文字体</option>
                  <option value="SimHei, Microsoft YaHei, Arial, sans-serif">黑体</option>
                  <option value="SimSun, Songti SC, serif">宋体</option>
                  <option value="KaiTi, Kaiti SC, serif">楷体</option>
                  <option value="Arial, sans-serif">Arial</option>
                </select>
              </Field>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <Field label="字号">
                <input className={fieldClassName} type="number" min="8" max="220" value={settings.fontSize} onChange={(event) => updateSetting('fontSize', event.target.value)} />
              </Field>
              <Field label="水印颜色">
                <input className={`${fieldClassName} p-1`} type="color" value={settings.color} onChange={(event) => updateSetting('color', event.target.value)} />
              </Field>
            </div>

            <RangeField label="水印透明度" value={settings.opacity} displayValue={settings.opacity}>
              <input
                className="w-full accent-blue-600"
                type="range"
                min="0.05"
                max="1"
                step="0.05"
                value={settings.opacity}
                onChange={(event) => updateSetting('opacity', event.target.value)}
              />
            </RangeField>

            <RangeField label="水印旋转角度" value={settings.rotation} displayValue={`${settings.rotation}°`}>
              <input
                className="w-full accent-blue-600"
                type="range"
                min="-90"
                max="90"
                step="1"
                value={settings.rotation}
                onChange={(event) => updateSetting('rotation', event.target.value)}
              />
            </RangeField>

            <div className="grid gap-4 md:grid-cols-2">
              <Field label="横向数量">
                <input className={fieldClassName} type="number" min="1" max="10" value={settings.countX} onChange={(event) => updateSetting('countX', event.target.value)} />
              </Field>
              <Field label="纵向数量">
                <input className={fieldClassName} type="number" min="1" max="20" value={settings.countY} onChange={(event) => updateSetting('countY', event.target.value)} />
              </Field>
            </div>

            <HintBox>
              使用“按数量均匀分布”时，系统会根据页面尺寸自动计算间距。例如横向 2、纵向 4，则每页显示 8 个水印。
            </HintBox>

            <div className="grid gap-4 md:grid-cols-2">
              <Field label="固定横向间距">
                <input className={fieldClassName} type="number" min="60" max="1200" value={settings.xGap} onChange={(event) => updateSetting('xGap', event.target.value)} />
              </Field>
              <Field label="固定纵向间距">
                <input className={fieldClassName} type="number" min="60" max="1200" value={settings.yGap} onChange={(event) => updateSetting('yGap', event.target.value)} />
              </Field>
            </div>

            <SubTitle icon={PaintBucket} title="打码设置" />

            <div className="grid gap-4 md:grid-cols-2">
              <Field label="打码方式">
                <select className={fieldClassName} value={settings.maskMode} onChange={(event) => updateSetting('maskMode', event.target.value as MaskMode)}>
                  <option value="mosaic">马赛克</option>
                  <option value="blur">模糊</option>
                  <option value="solid">纯色遮挡</option>
                </select>
              </Field>
              <Field label="新增区域范围">
                <select className={fieldClassName} value={settings.maskScope} onChange={(event) => updateSetting('maskScope', event.target.value as MaskScope)}>
                  <option value="current">仅当前页</option>
                  <option value="all">所有页面</option>
                </select>
              </Field>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <Field label="马赛克块大小">
                <input className={fieldClassName} type="number" min="4" max="80" value={settings.mosaicSize} onChange={(event) => updateSetting('mosaicSize', event.target.value)} />
              </Field>
              <Field label="模糊强度">
                <input className={fieldClassName} type="number" min="2" max="60" value={settings.blurRadius} onChange={(event) => updateSetting('blurRadius', event.target.value)} />
              </Field>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <Field label="遮挡颜色">
                <input className={`${fieldClassName} p-1`} type="color" value={settings.maskColor} onChange={(event) => updateSetting('maskColor', event.target.value)} />
              </Field>
              <Field label="框选模式">
                <label className="flex h-11 items-center gap-3 rounded-xl border border-slate-300 px-3 text-sm text-slate-700">
                  <input type="checkbox" checked={settings.drawMode} onChange={(event) => updateSetting('drawMode', event.target.checked)} />
                  允许拖拽框选
                </label>
              </Field>
            </div>

            <Field label="已添加打码区域">
              <div className="max-h-[150px] overflow-auto rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm">
                {redactionAreas.length ? (
                  <div className="space-y-2">
                    {redactionAreas.map((area, index) => (
                      <div key={`${area.page}-${index}`} className="flex items-start justify-between gap-3 border-b border-dashed border-slate-300 pb-2 last:border-b-0 last:pb-0">
                        <span className="text-slate-600">
                          {index + 1}. {currentFileType === 'image' ? '图片' : area.page === 0 ? '所有页面' : `第 ${area.page} 页`}，宽{' '}
                          {Math.round(area.wRatio * 100)}%，高 {Math.round(area.hRatio * 100)}%
                        </span>
                        <button
                          type="button"
                          onClick={() => deleteArea(index)}
                          className="rounded-lg bg-red-600 px-2.5 py-1 text-xs font-semibold text-white transition hover:bg-red-700"
                        >
                          删除
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <span className="text-slate-500">暂无打码区域。</span>
                )}
              </div>
            </Field>

            <SubTitle icon={FileImage} title="图片输出设置" />

            <div className="grid gap-4 md:grid-cols-2">
              <Field label="图片导出格式">
                <select className={fieldClassName} value={settings.imageFormat} onChange={(event) => updateSetting('imageFormat', event.target.value as ImageOutputFormat)}>
                  <option value="png">PNG（透明/无损）</option>
                  <option value="jpeg">JPG（文件更小）</option>
                </select>
              </Field>
              <RangeField label="JPG 图片质量" value={settings.imageQuality} displayValue={settings.imageQuality}>
                <input
                  className="w-full accent-blue-600"
                  type="range"
                  min="0.1"
                  max="1"
                  step="0.05"
                  value={settings.imageQuality}
                  onChange={(event) => updateSetting('imageQuality', event.target.value)}
                />
              </RangeField>
            </div>

            <HintBox>图片输出设置仅对图片文件生效；PDF 文件仍导出为 PDF。</HintBox>

            <div className="flex flex-wrap gap-3">
              <ActionButton kind="primary" onClick={generateOutput} disabled={isGenerating}>
                <Download className="h-4 w-4" />
                {isGenerating ? '处理中…' : '生成处理后的文件'}
              </ActionButton>
              <ActionButton kind="secondary" onClick={() => void renderPreview()} disabled={!hasLoadedFile(currentFileType, previewPdfDocument, currentImage)}>
                <Eye className="h-4 w-4" />
                刷新预览
              </ActionButton>
              <ActionButton kind="secondary" onClick={resetForm}>
                <RotateCcw className="h-4 w-4" />
                恢复默认
              </ActionButton>
              <ActionButton kind="danger" onClick={clearCurrentPageAreas} disabled={!currentPageAreas.length}>
                清除当前页打码
              </ActionButton>
              <ActionButton kind="danger" onClick={clearAllAreas} disabled={!redactionAreas.length}>
                清除全部打码
              </ActionButton>
            </div>

            {status.text ? (
              <div
                className={`rounded-xl border px-4 py-3 text-sm leading-6 ${
                  status.type === 'success'
                    ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                    : status.type === 'error'
                      ? 'border-red-200 bg-red-50 text-red-700'
                      : 'border-blue-200 bg-blue-50 text-blue-700'
                }`}
              >
                {status.text}
                {downloadInfo ? (
                  <div className="mt-3">
                    <a
                      href={downloadInfo.url}
                      download={downloadInfo.name}
                      className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 font-semibold text-white transition hover:bg-emerald-700"
                    >
                      <Download className="h-4 w-4" />
                      下载处理后的文件
                    </a>
                  </div>
                ) : null}
              </div>
            ) : null}

            <HintBox title="说明">
              <ul className="list-disc space-y-1 pl-5">
                <li>推荐使用“按数量均匀分布”模式，可有效避免水印重叠。</li>
                <li>如果水印文字很长，建议适当减少横向数量或减小字号。</li>
                <li>打码后生成的 PDF 会转为图片型 PDF，文字通常无法再复制或搜索。</li>
                <li>图片模式下，预览区会实时显示水印；导出时会按原图比例自动放大水印，尽量保持与预览一致。</li>
                <li>图片文件支持 PNG、JPG、WebP、GIF、BMP；GIF 会按当前浏览器可读取的首帧处理。</li>
              </ul>
            </HintBox>
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h3 className="text-xl font-bold text-slate-900">实时预览与框选打码</h3>
              <p className="mt-2 text-sm text-slate-500">勾选框选模式后，在页面上拖拽即可添加打码区域。</p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <ActionButton kind="secondary" onClick={prevPage} disabled={currentFileType !== 'pdf' || currentPage <= 1}>
                上一页
              </ActionButton>
              <span className="min-w-[90px] text-center text-sm font-bold text-slate-700">{pageInfoText}</span>
              <ActionButton kind="secondary" onClick={nextPage} disabled={currentFileType !== 'pdf' || currentPage >= totalPages}>
                下一页
              </ActionButton>
            </div>
          </div>

          <div ref={previewBoxRef} className="mt-5 flex min-h-[660px] items-start justify-center overflow-auto rounded-2xl border border-slate-200 bg-slate-200 p-4">
            {!previewReady ? (
              <div className="flex min-h-[540px] w-full items-center justify-center rounded-xl border-2 border-dashed border-slate-300 bg-white px-6 text-center text-sm leading-7 text-slate-500">
                请选择一个 PDF 或图片文件。<br />
                上传后这里会显示页面/图片预览。
              </div>
            ) : null}
            <canvas
              ref={canvasRef}
              className={`${previewReady ? 'block' : 'hidden'} max-w-full bg-white shadow-[0_12px_36px_rgba(15,23,42,0.18)] ${settings.drawMode ? 'cursor-crosshair' : ''}`}
              onMouseDown={handleStartDraw}
              onMouseMove={handleDrawing}
              onMouseUp={(event) => void finishDraw(event)}
              onMouseLeave={() => void cancelDraw()}
            />
          </div>
        </section>
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <label className="block text-sm font-semibold text-slate-700">{label}</label>
      {children}
    </div>
  )
}

function RangeField({
  label,
  displayValue,
  children,
}: {
  label: string
  value: string
  displayValue: string
  children: React.ReactNode
}) {
  return (
    <div className="space-y-2">
      <label className="block text-sm font-semibold text-slate-700">{label}</label>
      <div className="flex items-center gap-3">
        <div className="flex-1">{children}</div>
        <span className="min-w-[62px] rounded-lg bg-slate-100 px-2.5 py-1.5 text-center text-sm text-slate-700">{displayValue}</span>
      </div>
    </div>
  )
}

function HintBox({ title, children }: { title?: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl bg-slate-50 px-4 py-3 text-sm leading-6 text-slate-600">
      {title ? <div className="mb-1 font-semibold text-slate-800">{title}</div> : null}
      {children}
    </div>
  )
}

function SubTitle({ icon: Icon, title }: { icon: any; title: string }) {
  return (
    <div className="mt-2 flex items-center gap-2 border-t border-slate-200 pt-5">
      <Icon className="h-4 w-4 text-slate-500" />
      <h4 className="text-base font-bold text-slate-900">{title}</h4>
    </div>
  )
}

function ActionButton({
  kind,
  children,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  kind: 'primary' | 'secondary' | 'danger'
}) {
  const className =
    kind === 'primary'
      ? 'bg-blue-600 text-white hover:bg-blue-700'
      : kind === 'danger'
        ? 'bg-red-600 text-white hover:bg-red-700'
        : 'bg-slate-200 text-slate-700 hover:bg-slate-300'

  return (
    <button
      type="button"
      className={`inline-flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60 ${className}`}
      {...props}
    >
      {children}
    </button>
  )
}

function parseSettings(settings: SettingsState) {
  return {
    text: settings.watermarkText.trim(),
    mode: settings.mode,
    fontFamily: settings.fontFamily,
    fontSize: Number(settings.fontSize) || 32,
    color: settings.color,
    opacity: Number(settings.opacity) || 0.22,
    rotation: Number(settings.rotation) || 0,
    countX: Math.max(1, Number(settings.countX) || 2),
    countY: Math.max(1, Number(settings.countY) || 4),
    xGap: Number(settings.xGap) || 280,
    yGap: Number(settings.yGap) || 200,
    maskMode: settings.maskMode,
    maskScope: settings.maskScope,
    mosaicSize: Number(settings.mosaicSize) || 14,
    blurRadius: Number(settings.blurRadius) || 10,
    maskColor: settings.maskColor,
    imageFormat: settings.imageFormat,
    imageQuality: Number(settings.imageQuality) || 0.92,
  }
}

function hasLoadedFile(currentFileType: CurrentFileType, previewPdfDocument: any, currentImage: HTMLImageElement | null) {
  return (currentFileType === 'pdf' && !!previewPdfDocument) || (currentFileType === 'image' && !!currentImage)
}

function getAreasForPage(redactionAreas: RedactionArea[], pageNumber: number) {
  return redactionAreas.filter((area) => area.page === 0 || area.page === pageNumber)
}

function loadImageFile(file: File) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new window.Image()
    const objectUrl = URL.createObjectURL(file)
    image.onload = () => {
      URL.revokeObjectURL(objectUrl)
      resolve(image)
    }
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl)
      reject(new Error('图片读取失败，请换一张图片再试。'))
    }
    image.src = objectUrl
  })
}

function getImagePreviewScale(image: HTMLImageElement, previewBox: HTMLDivElement) {
  const containerWidth = Math.max(260, previewBox.clientWidth - 60)
  const naturalWidth = image.naturalWidth || image.width || 1
  return Math.min(1.5, Math.max(0.05, containerWidth / naturalWidth))
}

function getImageOutputWatermarkScale(image: HTMLImageElement, canvas: HTMLCanvasElement | null) {
  if (!canvas?.width) return 1
  const naturalWidth = image.naturalWidth || image.width || 1
  return Math.max(1, naturalWidth / canvas.width)
}

function drawWatermarkToCanvas(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  settings: ReturnType<typeof parseSettings>,
  scale = 1
) {
  if (!settings.text || settings.mode === 'none') return

  ctx.save()
  ctx.globalAlpha = settings.opacity
  ctx.fillStyle = settings.color
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.font = `bold ${settings.fontSize * scale}px ${settings.fontFamily}`

  const angle = (settings.rotation * Math.PI) / 180

  if (settings.mode === 'center') {
    ctx.translate(width / 2, height / 2)
    ctx.rotate(angle)
    ctx.fillText(settings.text, 0, 0)
  }

  if (settings.mode === 'count') {
    const cols = Math.max(1, Math.floor(settings.countX))
    const rows = Math.max(1, Math.floor(settings.countY))
    for (let row = 0; row < rows; row += 1) {
      for (let col = 0; col < cols; col += 1) {
        const x = (width * (col + 0.5)) / cols
        const y = (height * (row + 0.5)) / rows
        ctx.save()
        ctx.translate(x, y)
        ctx.rotate(angle)
        ctx.fillText(settings.text, 0, 0)
        ctx.restore()
      }
    }
  }

  if (settings.mode === 'gap') {
    const xGap = settings.xGap * scale
    const yGap = settings.yGap * scale
    for (let x = -width; x <= width * 2; x += xGap) {
      for (let y = -height; y <= height * 2; y += yGap) {
        ctx.save()
        ctx.translate(x, y)
        ctx.rotate(angle)
        ctx.fillText(settings.text, 0, 0)
        ctx.restore()
      }
    }
  }

  ctx.restore()
}

function clampRect(x: number, y: number, w: number, h: number, width: number, height: number) {
  const nx = Math.max(0, Math.floor(x))
  const ny = Math.max(0, Math.floor(y))
  const nw = Math.max(1, Math.floor(Math.min(w, width - nx)))
  const nh = Math.max(1, Math.floor(Math.min(h, height - ny)))
  return { x: nx, y: ny, w: nw, h: nh }
}

function applyMosaic(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, blockSize: number) {
  const rect = clampRect(x, y, w, h, ctx.canvas.width, ctx.canvas.height)
  const size = Math.max(4, Math.floor(blockSize))
  const imageData = ctx.getImageData(rect.x, rect.y, rect.w, rect.h)
  const data = imageData.data

  for (let by = 0; by < rect.h; by += size) {
    for (let bx = 0; bx < rect.w; bx += size) {
      let r = 0
      let g = 0
      let b = 0
      let a = 0
      let count = 0

      for (let yy = by; yy < Math.min(by + size, rect.h); yy += 1) {
        for (let xx = bx; xx < Math.min(bx + size, rect.w); xx += 1) {
          const idx = (yy * rect.w + xx) * 4
          r += data[idx]
          g += data[idx + 1]
          b += data[idx + 2]
          a += data[idx + 3]
          count += 1
        }
      }

      r = Math.round(r / count)
      g = Math.round(g / count)
      b = Math.round(b / count)
      a = Math.round(a / count)

      for (let yy = by; yy < Math.min(by + size, rect.h); yy += 1) {
        for (let xx = bx; xx < Math.min(bx + size, rect.w); xx += 1) {
          const idx = (yy * rect.w + xx) * 4
          data[idx] = r
          data[idx + 1] = g
          data[idx + 2] = b
          data[idx + 3] = a
        }
      }
    }
  }

  ctx.putImageData(imageData, rect.x, rect.y)
}

function applyBlur(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, radius: number) {
  const canvas = ctx.canvas
  const blur = Math.max(2, Math.floor(radius))
  const padding = blur * 3
  const sx = Math.max(0, Math.floor(x - padding))
  const sy = Math.max(0, Math.floor(y - padding))
  const sw = Math.min(canvas.width - sx, Math.floor(w + padding * 2))
  const sh = Math.min(canvas.height - sy, Math.floor(h + padding * 2))

  const temp = document.createElement('canvas')
  temp.width = sw
  temp.height = sh
  const tempCtx = temp.getContext('2d')
  if (!tempCtx) return

  tempCtx.drawImage(canvas, sx, sy, sw, sh, 0, 0, sw, sh)

  ctx.save()
  ctx.beginPath()
  ctx.rect(x, y, w, h)
  ctx.clip()
  ctx.filter = `blur(${blur}px)`
  ctx.drawImage(temp, sx, sy)
  ctx.filter = 'none'
  ctx.restore()
}

function applyRedactionsToCanvas(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  pageNumber: number,
  redactionAreas: RedactionArea[],
  settings: ReturnType<typeof parseSettings>,
  scale = 1,
  showBorder = false
) {
  const areas = getAreasForPage(redactionAreas, pageNumber)

  for (const area of areas) {
    const x = area.xRatio * width
    const y = area.yRatio * height
    const w = area.wRatio * width
    const h = area.hRatio * height

    if (settings.maskMode === 'mosaic') {
      applyMosaic(ctx, x, y, w, h, settings.mosaicSize * scale)
    } else if (settings.maskMode === 'blur') {
      applyBlur(ctx, x, y, w, h, settings.blurRadius * scale)
    } else {
      ctx.save()
      ctx.fillStyle = settings.maskColor
      ctx.fillRect(x, y, w, h)
      ctx.restore()
    }

    if (showBorder) {
      ctx.save()
      ctx.strokeStyle = '#dc2626'
      ctx.lineWidth = 2
      ctx.setLineDash([8, 5])
      ctx.strokeRect(x, y, w, h)
      ctx.restore()
    }
  }
}

function canvasToBlob(canvas: HTMLCanvasElement, mimeType: string, quality?: number) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob)
      else reject(new Error('导出图片失败，请重试。'))
    }, mimeType, quality)
  })
}

function stripExtension(name: string) {
  return name.replace(/\.[^.]+$/i, '')
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : '未知错误'
}
