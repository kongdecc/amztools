'use client'

import React, { useEffect, useMemo, useRef, useState } from 'react'
import * as exifr from 'exifr'
import { ExternalLink, Image as ImageIcon, Info, Trash2, Upload } from 'lucide-react'

interface ParsedImageItem {
  id: string
  file: File
  imageUrl: string
  width: number
  height: number
  exif: Record<string, any>
  exifReadable: boolean
}

export default function ImageInfoViewerPage() {
  const [items, setItems] = useState<ParsedImageItem[]>([])
  const [notice, setNotice] = useState('')
  const [summary, setSummary] = useState('')
  const [isDragging, setIsDragging] = useState(false)
  const [isParsing, setIsParsing] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const itemsRef = useRef<ParsedImageItem[]>([])

  useEffect(() => {
    itemsRef.current = items
  }, [items])

  useEffect(() => {
    return () => {
      itemsRef.current.forEach((item) => URL.revokeObjectURL(item.imageUrl))
    }
  }, [])

  const hasItems = items.length > 0
  const summaryHint = useMemo(() => {
    if (!hasItems) return ''
    return `共解析 ${items.length} 张图片。提示：如果设备、作者显示“未知”，通常是图片元数据被平台压缩或清除了。`
  }, [hasItems, items.length])

  const openNewWindow = () => {
    window.open('/functionality/image-info-viewer', '_blank', 'noopener,noreferrer')
  }

  const resetView = () => {
    itemsRef.current.forEach((item) => URL.revokeObjectURL(item.imageUrl))
    setItems([])
    setNotice('')
    setSummary('')
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const handleInputChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || [])
    await handleFiles(files)
    event.target.value = ''
  }

  const handleFiles = async (files: File[]) => {
    const imageFiles = files.filter((file) => file.type.startsWith('image/'))
    if (!imageFiles.length) {
      setNotice('请选择图片文件。')
      return
    }

    resetView()
    setIsParsing(true)
    setNotice('')
    setSummary(`正在解析 ${imageFiles.length} 张图片...`)

    const nextItems: ParsedImageItem[] = []
    for (let index = 0; index < imageFiles.length; index += 1) {
      const file = imageFiles[index]
      const parsed = await parseSingleFile(file)
      nextItems.push(parsed)
      setSummary(`已解析 ${index + 1} / ${imageFiles.length} 张图片`)
    }

    setItems(nextItems)
    setSummary(`共解析 ${nextItems.length} 张图片。提示：如果设备、作者显示“未知”，通常是图片元数据被平台压缩或清除了。`)
    setIsParsing(false)
  }

  const parseSingleFile = async (file: File): Promise<ParsedImageItem> => {
    const imageUrl = URL.createObjectURL(file)
    let width = 0
    let height = 0
    let exifReadable = true
    let metadata: Record<string, any> = {}

    try {
      const dimensions = await getImageDimensions(imageUrl)
      width = dimensions.width
      height = dimensions.height
    } catch (error) {
      console.error(error)
    }

    try {
      metadata =
        (await exifr.parse(file, {
          tiff: true,
          xmp: true,
          icc: true,
          iptc: true,
          jfif: true,
          ihdr: true,
          mergeOutput: true,
        })) || {}
    } catch (error) {
      exifReadable = false
      metadata = {}
    }

    return {
      id: `${file.name}-${file.lastModified}-${Math.random().toString(36).slice(2, 8)}`,
      file,
      imageUrl,
      width,
      height,
      exif: metadata,
      exifReadable,
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 rounded-2xl bg-gradient-to-r from-sky-50 to-emerald-50 p-6 shadow-sm ring-1 ring-slate-200 md:flex-row md:items-center md:justify-between">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <ImageIcon className="h-6 w-6 text-blue-600" />
            <h2 className="text-2xl font-bold text-slate-900">批量图片信息查看器</h2>
          </div>
          <p className="max-w-3xl text-sm leading-6 text-slate-600">
            一次上传多张图片，查看尺寸、清晰度、设备、作者、拍摄参数，并用通俗语言解释 EXIF 信息。所有解析都在浏览器本地完成。
          </p>
        </div>
        <button
          type="button"
          onClick={openNewWindow}
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
        >
          <ExternalLink className="h-4 w-4" />
          新窗口打开
        </button>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          onDragEnter={(event) => {
            event.preventDefault()
            setIsDragging(true)
          }}
          onDragOver={(event) => {
            event.preventDefault()
            setIsDragging(true)
          }}
          onDragLeave={(event) => {
            event.preventDefault()
            setIsDragging(false)
          }}
          onDrop={async (event) => {
            event.preventDefault()
            setIsDragging(false)
            await handleFiles(Array.from(event.dataTransfer.files || []))
          }}
          className={`w-full rounded-2xl border-2 border-dashed px-6 py-10 text-center transition ${
            isDragging ? 'border-blue-500 bg-blue-50' : 'border-blue-200 bg-slate-50 hover:border-blue-500 hover:bg-blue-50'
          }`}
        >
          <div className="mx-auto mb-4 grid h-16 w-16 place-items-center rounded-2xl bg-blue-100">
            <Upload className="h-8 w-8 text-blue-600" />
          </div>
          <div className="text-xl font-bold text-slate-900">点击选择图片，或拖拽多张图片到这里</div>
          <div className="mt-2 text-sm text-slate-500">
            支持 JPG、PNG、WEBP、HEIC 等常见图片。所有解析都在浏览器本地完成，不会上传图片。
          </div>
        </button>

        <input ref={fileInputRef} type="file" accept="image/*" multiple className="hidden" onChange={handleInputChange} />

        <div className="mt-5 flex flex-wrap justify-center gap-3">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={isParsing}
            className="inline-flex items-center gap-2 rounded-full bg-blue-600 px-5 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Upload className="h-4 w-4" />
            选择图片
          </button>
          <button
            type="button"
            onClick={resetView}
            disabled={!hasItems && !summary}
            className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-5 py-3 text-sm font-bold text-emerald-700 transition hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Trash2 className="h-4 w-4" />
            清空结果
          </button>
        </div>

        {notice ? (
          <div className="mt-5 rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-800">
            {notice}
          </div>
        ) : null}

        {summary ? (
          <div className="mt-5 rounded-2xl bg-blue-50 px-4 py-3 text-sm font-semibold text-blue-900">
            {isParsing ? summary : summaryHint || summary}
          </div>
        ) : null}

        {!hasItems && !isParsing ? (
          <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 px-6 py-10 text-center text-sm text-slate-500">
            还没有上传图片。
          </div>
        ) : null}

        <div className="mt-5 grid gap-5">
          {items.map((item) => (
            <ImageInfoCard key={item.id} item={item} />
          ))}
        </div>
      </div>
    </div>
  )
}

function ImageInfoCard({ item }: { item: ParsedImageItem }) {
  const { file, imageUrl, width, height, exif, exifReadable } = item
  const megapixels = width && height ? `${((width * height) / 1000000).toFixed(2)} MP` : '未知'
  const approxK = getApproxK(width, height)
  const cameraMake = exif.Make || exif.make || ''
  const cameraModel = exif.Model || exif.model || ''
  const lens = exif.LensModel || exif.Lens || ''
  const author = exif.Artist || exif.Creator || exif.Author || exif.Credit || exif.Byline || exif.copyright || ''
  const date = exif.DateTimeOriginal || exif.CreateDate || exif.ModifyDate || (file.lastModified ? new Date(file.lastModified) : '') || ''
  const software = exif.Software || ''
  const gps = formatGps(exif)
  const aperture = exif.FNumber ? `f/${exif.FNumber}` : ''
  const shutter = exif.ExposureTime ? formatShutter(exif.ExposureTime) : ''
  const iso = exif.ISO || exif.ISOSpeedRatings || ''
  const focal = exif.FocalLength ? `${exif.FocalLength}mm` : ''

  const plainRows = [
    ['图片大小', width && height ? `${width} x ${height} px` : '未知', '也就是图片的宽和高。像素越高，通常越适合放大展示或印刷。'],
    ['清晰度参考', `${megapixels}${approxK ? ` · 约 ${approxK}` : ''}`, 'MP 是百万像素；4K/2K 是按图片最长边粗略判断，方便普通用户理解。'],
    ['文件体积', formatBytes(file.size), '这是图片占用的存储空间，不等于清晰度；压缩越狠，体积可能越小。'],
    ['拍摄设备', joinKnown([cameraMake, cameraModel]) || '未知', '如果这里未知，通常代表图片来源平台清除了拍摄设备信息。'],
    ['作者 / 版权', author || '未知', '只有图片原本写入了作者或版权信息时才会显示。'],
    ['拍摄 / 创建时间', formatExifDate(date) || '未知', '可能是相机拍摄时间，也可能是软件导出或文件修改时间。'],
  ]

  const techRows = [
    ['图片格式', file.type || getExt(file.name) || '未知'],
    ['镜头', lens || '未知'],
    ['光圈', aperture || '未知'],
    ['快门', shutter || '未知'],
    ['ISO', iso || '未知'],
    ['焦距', focal || '未知'],
    ['编辑软件', software || '未知'],
    ['GPS 位置', gps],
    ['色彩空间', exif.ColorSpace || exif.colorSpace || '未知'],
    ['EXIF 状态', exifReadable && Object.keys(exif).length ? '已读取到元数据' : '未读取到或已被清除'],
  ]

  return (
    <article className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="grid gap-5 p-5 lg:grid-cols-[280px_minmax(0,1fr)]">
        <div className="flex min-h-[230px] items-center justify-center overflow-hidden rounded-2xl bg-slate-50">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={imageUrl}
            alt={file.name}
            className="max-h-[260px] max-w-full object-contain"
            onError={(event) => {
              const img = event.currentTarget
              img.style.display = 'none'
              const parent = img.parentElement
              if (parent && !parent.querySelector('[data-fallback="true"]')) {
                const fallback = document.createElement('div')
                fallback.dataset.fallback = 'true'
                fallback.className = 'px-4 text-center text-sm text-slate-500'
                fallback.textContent = '当前浏览器无法预览这张图片，但仍可读取部分元数据。'
                parent.appendChild(fallback)
              }
            }}
          />
        </div>

        <div>
          <h3 className="break-all text-xl font-bold leading-8 text-slate-900">{file.name}</h3>
          <div className="mb-4 mt-1 text-sm text-slate-500">
            {file.type || '未知格式'} · {formatBytes(file.size)}
          </div>

          <div className="mb-3 flex items-center gap-2 text-sm font-extrabold text-slate-800">
            <Info className="h-4 w-4 text-emerald-600" />
            通俗版信息
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            {plainRows.map(([label, value, explain]) => (
              <InfoItem key={label} label={label} value={value} explain={explain} tone="plain" />
            ))}
          </div>

          <div className="mb-3 mt-5 flex items-center gap-2 text-sm font-extrabold text-slate-800">
            <ImageIcon className="h-4 w-4 text-blue-600" />
            拍摄参数
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            {techRows.map(([label, value]) => (
              <InfoItem key={label} label={label} value={value} explain={getExplain(label)} />
            ))}
          </div>
        </div>
      </div>

      <details className="border-t border-slate-200 bg-slate-50">
        <summary className="cursor-pointer px-5 py-4 text-sm font-extrabold text-slate-700">
          专业人员查看：完整 EXIF / 元数据
        </summary>
        <pre className="overflow-auto bg-slate-950 px-5 py-4 text-xs leading-6 text-slate-100">
          {Object.keys(exif).length ? JSON.stringify(cleanExif(exif), null, 2) : '未读取到 EXIF / 元数据。'}
        </pre>
      </details>
    </article>
  )
}

function InfoItem({
  label,
  value,
  explain = '',
  tone = 'default',
}: {
  label: string
  value: string
  explain?: string
  tone?: 'default' | 'plain'
}) {
  return (
    <div
      className={`rounded-2xl border p-4 ${
        tone === 'plain' ? 'border-emerald-100 bg-emerald-50/40' : 'border-slate-100 bg-slate-50'
      }`}
    >
      <div className="mb-1 text-xs text-slate-500">{label}</div>
      <div className="break-words text-sm font-bold leading-6 text-slate-900">{String(value || '未知')}</div>
      {explain ? <div className="mt-2 text-xs leading-5 text-slate-500">{explain}</div> : null}
    </div>
  )
}

function getImageDimensions(url: string) {
  return new Promise<{ width: number; height: number }>((resolve, reject) => {
    const img = new window.Image()
    img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight })
    img.onerror = reject
    img.src = url
  })
}

function getApproxK(width: number, height: number) {
  if (!width || !height) return ''
  const longSide = Math.max(width, height)
  if (longSide >= 7600) return '8K'
  if (longSide >= 5000) return '6K'
  if (longSide >= 3800) return '4K'
  if (longSide >= 2500) return '2K'
  if (longSide >= 1800) return '1080P'
  if (longSide >= 1200) return '720P'
  return '低于 720P'
}

function formatBytes(bytes: number) {
  if (!bytes && bytes !== 0) return '未知'
  const units = ['B', 'KB', 'MB', 'GB']
  let size = bytes
  let index = 0
  while (size >= 1024 && index < units.length - 1) {
    size /= 1024
    index += 1
  }
  return `${size.toFixed(index === 0 ? 0 : 2)} ${units[index]}`
}

function formatExifDate(value: unknown) {
  if (!value) return ''
  if (value instanceof Date) return value.toLocaleString('zh-CN')
  return String(value)
}

function formatGps(exif: Record<string, any>) {
  if (exif.latitude && exif.longitude) {
    return `${Number(exif.latitude).toFixed(6)}, ${Number(exif.longitude).toFixed(6)}`
  }
  if (exif.GPSLatitude && exif.GPSLongitude) {
    return `${exif.GPSLatitude}, ${exif.GPSLongitude}`
  }
  return '未知'
}

function formatShutter(value: unknown) {
  const num = Number(value)
  if (!num) return String(value)
  if (num < 1) return `1/${Math.round(1 / num)} 秒`
  return `${num} 秒`
}

function joinKnown(values: unknown[]) {
  return values.filter((value) => value && value !== '未知').join(' ')
}

function getExt(name: string) {
  const match = name.match(/\.([a-zA-Z0-9]+)$/)
  return match ? match[1].toUpperCase() : ''
}

function cleanExif(exif: Record<string, any>) {
  const result: Record<string, any> = {}
  for (const [key, value] of Object.entries(exif)) {
    if (value instanceof Date) result[key] = value.toLocaleString('zh-CN')
    else if (typeof value === 'function') continue
    else result[key] = value
  }
  return result
}

function getExplain(label: string) {
  const map: Record<string, string> = {
    图片格式: '例如 JPG、PNG、WEBP。JPG 常用于照片，PNG 常用于透明图或设计图。',
    镜头: '相机或手机拍摄时使用的镜头型号。',
    光圈: 'f 后面的数字越小，背景虚化通常越明显，进光量也更大。',
    快门: '快门时间越短，越容易拍清楚运动物体；越长，越容易出现拖影。',
    ISO: '感光度。数值越高，暗光下更亮，但画面噪点可能更多。',
    焦距: '数值越小越广角，数值越大越像长焦拉近。',
    编辑软件: '图片被 Photoshop、手机相册或其他软件处理过时，可能会留下软件名。',
    'GPS 位置': '只有开启定位拍摄且未被清除时才会显示。',
    色彩空间: '常见为 sRGB，适合网页和多数平台展示。',
    'EXIF 状态': 'EXIF 是图片里隐藏的拍摄和版权信息，不是每张图片都有。',
  }
  return map[label] || ''
}
