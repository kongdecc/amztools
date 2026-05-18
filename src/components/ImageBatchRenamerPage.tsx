'use client'

import React, { useEffect, useMemo, useRef, useState } from 'react'
import JSZip from 'jszip'
import { Download, ExternalLink, Image as ImageIcon, PencilLine, RefreshCcw, Shuffle, Upload } from 'lucide-react'

type MatchMode = 'random' | 'order' | 'manual'
type DuplicateMode = 'number' | 'keep'
type NotEnoughMode = 'cycle' | 'original' | 'auto'

interface RenameItem {
  file: File
  oldName: string
  baseName: string
  manualName: string
  newName: string
  url: string
}

const buttonBase =
  'inline-flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50'

const fieldClassName =
  'h-11 w-full rounded-xl border border-slate-300 px-3 text-sm outline-none transition focus:border-slate-900'

export default function ImageBatchRenamerPage() {
  const [selectedFiles, setSelectedFiles] = useState<File[]>([])
  const [renameMap, setRenameMap] = useState<RenameItem[]>([])
  const [keywordsText, setKeywordsText] = useState('')
  const [prefix, setPrefix] = useState('')
  const [matchMode, setMatchMode] = useState<MatchMode>('random')
  const [duplicateMode, setDuplicateMode] = useState<DuplicateMode>('number')
  const [notEnoughMode, setNotEnoughMode] = useState<NotEnoughMode>('cycle')
  const [isDragging, setIsDragging] = useState(false)
  const [status, setStatus] = useState<{ text: string; type: '' | 'error' | 'success' }>({
    text: '操作提示：先选择图片并输入关键词，然后点击“生成/刷新预览”。如果想指定某张图片的名称，可以在预览表格里直接修改。',
    type: '',
  })
  const [fileStatus, setFileStatus] = useState<{ text: string; type: '' | 'error' | 'success' }>({
    text: '当前未选择图片',
    type: '',
  })
  const [isExporting, setIsExporting] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const objectUrlsRef = useRef<string[]>([])

  useEffect(() => {
    return () => {
      objectUrlsRef.current.forEach((url) => URL.revokeObjectURL(url))
      objectUrlsRef.current = []
    }
  }, [])

  const countText = useMemo(() => `${selectedFiles.length} 张图片`, [selectedFiles.length])

  const handleOpenNewWindow = () => {
    window.open('/functionality/image-batch-renamer', '_blank', 'noopener,noreferrer')
  }

  const setMainStatus = (text: string, type: '' | 'error' | 'success' = '') => {
    setStatus({ text, type })
  }

  const getKeywords = () =>
    keywordsText
      .split(/\n|,|，|;|；/g)
      .map((item) => normalizeSpaces(item))
      .filter(Boolean)

  const handleFiles = (files: File[]) => {
    const nextFiles = files.filter((file) => file.type.startsWith('image/'))

    objectUrlsRef.current.forEach((url) => URL.revokeObjectURL(url))
    objectUrlsRef.current = []
    setRenameMap([])
    setSelectedFiles(nextFiles)

    if (nextFiles.length === 0) {
      setFileStatus({ text: '未选择有效图片', type: 'error' })
      return
    }

    setFileStatus({ text: `已选择 ${nextFiles.length} 张图片`, type: 'success' })
  }

  const onFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files?.length) {
      handleFiles(Array.from(event.target.files))
    }
    event.target.value = ''
  }

  const getBaseNamesByMode = (currentRenameMap: RenameItem[] = renameMap) => {
    const keywords = getKeywords()
    let keywordPool = [...keywords]

    if (matchMode === 'random') {
      keywordPool = shuffleArray(keywordPool)
    }

    return selectedFiles.map((file, index) => {
      let baseName = ''

      if (matchMode === 'manual' && currentRenameMap[index]?.manualName) {
        baseName = currentRenameMap[index].manualName
      } else if (index < keywordPool.length) {
        baseName = keywordPool[index]
      } else if (keywordPool.length > 0 && notEnoughMode === 'cycle') {
        baseName = keywordPool[index % keywordPool.length]
      } else if (notEnoughMode === 'original') {
        baseName = removeExtension(file.name)
      } else {
        baseName = `image ${padNumber(index + 1)}`
      }

      baseName = sanitizeFileName(`${prefix}${baseName}`)

      if (!baseName) {
        baseName = `image ${padNumber(index + 1)}`
      }

      return baseName
    })
  }

  const buildRenameMap = (currentRenameMap: RenameItem[] = renameMap) => {
    const baseNames = getBaseNamesByMode(currentRenameMap)
    const usedNames = new Map<string, number>()

    return selectedFiles.map((file, index) => {
      let cleanName = baseNames[index]

      if (duplicateMode === 'number') {
        const count = usedNames.get(cleanName) || 0
        usedNames.set(cleanName, count + 1)
        if (count > 0) cleanName = `${cleanName} ${padNumber(count + 1)}`
      }

      const extension = getExtension(file.name) || '.jpg'
      const previousUrl = currentRenameMap[index]?.url
      const url = previousUrl || URL.createObjectURL(file)
      if (!previousUrl) objectUrlsRef.current.push(url)

      return {
        file,
        oldName: file.name,
        baseName: cleanName,
        manualName: cleanName,
        newName: `${cleanName}${extension}`,
        url,
      }
    })
  }

  const generatePreview = () => {
    if (selectedFiles.length === 0) {
      setMainStatus('请先选择图片。', 'error')
      return
    }

    const keywords = getKeywords()
    if (keywords.length === 0 && matchMode !== 'manual') {
      setMainStatus('请至少输入一个关键词。', 'error')
      return
    }

    const nextRenameMap = buildRenameMap()
    setRenameMap(nextRenameMap)
    setMainStatus('已生成预览。你可以在表格里直接修改每张图片的新名称。', 'success')
  }

  const updateManualName = (index: number, value: string) => {
    setRenameMap((prev) => {
      const target = prev[index]
      if (!target) return prev

      const extension = getExtension(target.file.name) || '.jpg'
      let cleanName = sanitizeFileName(value)
      if (!cleanName) cleanName = `image ${padNumber(index + 1)}`

      const next = [...prev]
      next[index] = {
        ...target,
        manualName: cleanName,
        baseName: cleanName,
        newName: `${cleanName}${extension}`,
      }
      return next
    })
  }

  const applyKeywordsToInputs = () => {
    if (selectedFiles.length === 0) {
      setMainStatus('请先选择图片。', 'error')
      return
    }

    if (renameMap.length === 0) {
      generatePreview()
      return
    }

    const baseNames = getBaseNamesByMode()
    setRenameMap((prev) =>
      prev.map((item, index) => {
        const extension = getExtension(item.oldName) || '.jpg'
        const cleanName = sanitizeFileName(baseNames[index] || `image ${padNumber(index + 1)}`)
        return {
          ...item,
          manualName: cleanName,
          baseName: cleanName,
          newName: `${cleanName}${extension}`,
        }
      })
    )
    setMainStatus('已按当前关键词重新填入可编辑名称。', 'success')
  }

  const refreshNamesFromInputs = (currentRenameMap: RenameItem[]) => {
    return currentRenameMap.map((item, index) => {
      const extension = getExtension(item.file.name) || '.jpg'
      let cleanName = sanitizeFileName(item.manualName)
      if (!cleanName) cleanName = `image ${padNumber(index + 1)}`
      return {
        ...item,
        manualName: cleanName,
        baseName: cleanName,
        newName: `${cleanName}${extension}`,
      }
    })
  }

  const downloadZip = async () => {
    if (selectedFiles.length === 0) {
      setMainStatus('请先选择图片。', 'error')
      return
    }

    let currentRenameMap = renameMap
    if (currentRenameMap.length === 0) {
      const keywords = getKeywords()
      if (keywords.length === 0 && matchMode !== 'manual') {
        setMainStatus('请至少输入一个关键词。', 'error')
        return
      }
      currentRenameMap = buildRenameMap()
      setRenameMap(currentRenameMap)
    }

    if (currentRenameMap.length === 0) {
      setMainStatus('请先生成预览后再下载。', 'error')
      return
    }

    currentRenameMap = refreshNamesFromInputs(currentRenameMap)
    setRenameMap(currentRenameMap)
    setIsExporting(true)
    setMainStatus('正在打包 ZIP，请稍等……')

    try {
      const zip = new JSZip()
      const filenameSet = new Set<string>()

      currentRenameMap.forEach((item, index) => {
        let finalName = sanitizeFinalFileName(item.newName, item.file.name, index)

        if (filenameSet.has(finalName)) {
          const ext = getExtension(finalName)
          const base = finalName.slice(0, finalName.length - ext.length)
          finalName = `${base} ${padNumber(index + 1)}${ext}`
        }

        filenameSet.add(finalName)
        zip.file(finalName, item.file)
      })

      const content = await zip.generateAsync({ type: 'blob' })
      const url = URL.createObjectURL(content)
      const link = document.createElement('a')
      link.href = url
      link.download = '重命名图片.zip'
      document.body.appendChild(link)
      link.click()
      link.remove()
      URL.revokeObjectURL(url)
      setMainStatus('ZIP 已生成并开始下载。', 'success')
    } catch (error) {
      console.error(error)
      setMainStatus('打包失败，请重试或减少图片数量。', 'error')
    } finally {
      setIsExporting(false)
    }
  }

  const resetAll = () => {
    objectUrlsRef.current.forEach((url) => URL.revokeObjectURL(url))
    objectUrlsRef.current = []
    setSelectedFiles([])
    setRenameMap([])
    setKeywordsText('')
    setPrefix('')
    setMatchMode('random')
    setDuplicateMode('number')
    setNotEnoughMode('cycle')
    if (fileInputRef.current) fileInputRef.current.value = ''
    setFileStatus({ text: '当前未选择图片', type: '' })
    setMainStatus('已清空，可以重新选择图片和关键词。')
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 rounded-2xl bg-gradient-to-r from-slate-900 to-slate-700 p-6 text-white shadow-sm md:flex-row md:items-center md:justify-between">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <ImageIcon className="h-6 w-6 text-indigo-200" />
            <h2 className="text-2xl font-bold">图片批量随机/指定重命名工具</h2>
          </div>
          <p className="max-w-3xl text-sm leading-6 text-slate-200">
            上传图片，输入关键词，可随机匹配、按顺序匹配，也可以手动指定每张图片的新名字；所有处理都在浏览器本地完成。
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

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="mb-4 text-lg font-bold text-slate-900">1. 选择图片</h3>
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
              handleFiles(Array.from(event.dataTransfer.files))
            }}
            className={`w-full rounded-2xl border-2 border-dashed px-6 py-10 text-center transition ${
              isDragging ? 'border-blue-600 bg-blue-50' : 'border-blue-300 bg-blue-50/60 hover:border-blue-600 hover:bg-blue-100/70'
            }`}
          >
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-white shadow-sm">
              <Upload className="h-7 w-7 text-slate-700" />
            </div>
            <strong className="block text-lg text-slate-900">点击选择图片</strong>
            <span className="mt-2 block text-sm text-slate-500">也可以把图片拖到这里，支持多张图片</span>
          </button>
          <input ref={fileInputRef} type="file" accept="image/*" multiple className="hidden" onChange={onFileChange} />
          <StatusBox className="mt-4" type={fileStatus.type}>
            {fileStatus.text}
          </StatusBox>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="mb-4 text-lg font-bold text-slate-900">2. 输入关键词</h3>
          <textarea
            value={keywordsText}
            onChange={(event) => setKeywordsText(event.target.value)}
            placeholder={`每行一个关键词，例如：
phone case
iphone case
samsung phone case
clear phone case`}
            className="min-h-[230px] w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm leading-6 outline-none transition focus:border-slate-900"
          />
          <p className="mt-3 text-sm leading-6 text-slate-500">建议一行一个关键词，也支持用逗号、分号分隔。</p>
        </section>
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h3 className="mb-5 text-lg font-bold text-slate-900">3. 命名设置</h3>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Field label="匹配方式">
            <select value={matchMode} onChange={(event) => setMatchMode(event.target.value as MatchMode)} className={fieldClassName}>
              <option value="random">随机匹配关键词</option>
              <option value="order">按顺序匹配关键词</option>
              <option value="manual">手动指定/编辑名称</option>
            </select>
          </Field>
          <Field label="文件名前缀，可选">
            <input value={prefix} onChange={(event) => setPrefix(event.target.value)} placeholder="例如：Product - " className={fieldClassName} />
          </Field>
          <Field label="重复处理方式">
            <select value={duplicateMode} onChange={(event) => setDuplicateMode(event.target.value as DuplicateMode)} className={fieldClassName}>
              <option value="number">重复时自动加序号</option>
              <option value="keep">尽量只使用关键词</option>
            </select>
          </Field>
          <Field label="关键词数量不足时">
            <select value={notEnoughMode} onChange={(event) => setNotEnoughMode(event.target.value as NotEnoughMode)} className={fieldClassName}>
              <option value="cycle">循环使用关键词</option>
              <option value="original">保留原文件名</option>
              <option value="auto">使用 image 序号</option>
            </select>
          </Field>
        </div>

        <div className="mt-6 flex flex-wrap gap-3">
          <button type="button" onClick={generatePreview} className={`${buttonBase} bg-blue-600 text-white hover:bg-blue-700`}>
            <RefreshCcw className="h-4 w-4" />
            生成/刷新预览
          </button>
          <button type="button" onClick={applyKeywordsToInputs} className={`${buttonBase} bg-amber-500 text-white hover:bg-amber-600`}>
            <Shuffle className="h-4 w-4" />
            按当前关键词填入可编辑名称
          </button>
          <button
            type="button"
            onClick={() => void downloadZip()}
            disabled={isExporting}
            className={`${buttonBase} bg-emerald-600 text-white hover:bg-emerald-700`}
          >
            <Download className="h-4 w-4" />
            {isExporting ? '正在打包 ZIP...' : '下载重命名 ZIP'}
          </button>
          <button type="button" onClick={resetAll} className={`${buttonBase} bg-slate-200 text-slate-700 hover:bg-slate-300`}>
            清空重来
          </button>
        </div>

        <StatusBox className="mt-4" type={status.type}>
          {status.text}
        </StatusBox>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-2">
            <PencilLine className="h-5 w-5 text-slate-500" />
            <h3 className="text-lg font-bold text-slate-900">4. 重命名预览与手动指定</h3>
          </div>
          <span className="inline-flex items-center rounded-full bg-indigo-50 px-3 py-1 text-sm font-semibold text-indigo-700">{countText}</span>
        </div>

        {renameMap.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-6 py-10 text-center text-sm leading-6 text-slate-500">
            {selectedFiles.length === 0 ? '暂无预览。' : '已选择图片，但还没有生成重命名预览。'}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-[920px] w-full border-separate border-spacing-0 overflow-hidden rounded-2xl">
              <thead>
                <tr>
                  <TableHead className="w-[76px]">预览</TableHead>
                  <TableHead className="w-[260px]">原文件名</TableHead>
                  <TableHead>新文件名，可手动编辑，不用输入扩展名</TableHead>
                  <TableHead className="w-[260px]">最终文件名</TableHead>
                </tr>
              </thead>
              <tbody>
                {renameMap.map((item, index) => {
                  const extension = getExtension(item.oldName) || '.jpg'
                  return (
                    <tr key={`${item.oldName}-${index}`} className="bg-white">
                      <TableCell>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={item.url} alt="" className="h-[58px] w-[58px] rounded-lg bg-slate-100 object-cover" />
                      </TableCell>
                      <TableCell>{item.oldName}</TableCell>
                      <TableCell>
                        <input
                          value={item.manualName || item.baseName}
                          onChange={(event) => updateManualName(index, event.target.value)}
                          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-slate-900"
                        />
                        <div className="mt-1 text-xs text-slate-500">扩展名会自动保留：{extension}</div>
                      </TableCell>
                      <TableCell>
                        <strong className="text-slate-900">{item.newName}</strong>
                      </TableCell>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm leading-6 text-slate-600">
          本工具在浏览器本地运行，不会上传你的图片。由于浏览器限制，工具不会直接改动原文件，而是下载一个重命名后的 ZIP。
        </div>
      </section>
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

function StatusBox({
  type,
  className = '',
  children,
}: {
  type: '' | 'error' | 'success'
  className?: string
  children: React.ReactNode
}) {
  const tone =
    type === 'success'
      ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
      : type === 'error'
        ? 'border-red-200 bg-red-50 text-red-700'
        : 'border-slate-200 bg-slate-50 text-slate-700'

  return <div className={`${className} rounded-xl border px-4 py-3 text-sm leading-6 ${tone}`}>{children}</div>
}

function TableHead({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <th className={`${className} border-b border-slate-200 bg-slate-50 px-4 py-3 text-left text-sm font-semibold text-slate-700`}>{children}</th>
}

function TableCell({ children }: { children: React.ReactNode }) {
  return <td className="border-b border-slate-200 px-4 py-3 align-middle text-sm text-slate-600 last:border-b-0">{children}</td>
}

function normalizeSpaces(text: string) {
  return String(text || '')
    .replace(/\s+/g, ' ')
    .trim()
}

function shuffleArray<T>(array: T[]) {
  const arr = [...array]
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return arr
}

function sanitizeFileName(name: string) {
  return normalizeSpaces(name)
    .replace(/[\\/:*?"<>|]/g, '')
    .replace(/\s+-\s+/g, ' - ')
    .replace(/^\.+/g, '')
    .trim()
}

function getExtension(filename: string) {
  const index = filename.lastIndexOf('.')
  if (index === -1) return ''
  return filename.slice(index).toLowerCase()
}

function removeExtension(filename: string) {
  return filename.replace(/\.[^/.]+$/, '')
}

function padNumber(num: number, length = 2) {
  return String(num).padStart(length, '0')
}

function sanitizeFinalFileName(name: string, originalName: string, index: number) {
  const originalExt = getExtension(originalName) || '.jpg'
  let finalName = sanitizeFileName(name)

  if (!finalName) {
    finalName = `image ${padNumber(index + 1)}${originalExt}`
  }

  if (!/\.[a-zA-Z0-9]{2,5}$/.test(finalName)) {
    finalName += originalExt
  }

  return finalName
}
