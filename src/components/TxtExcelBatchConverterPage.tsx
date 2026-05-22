'use client'

import React, { useMemo, useRef, useState } from 'react'
import * as XLSX from 'xlsx'
import JSZip from 'jszip'
import { ArrowLeftRight, Download, Eye, FileSpreadsheet, FileText, Trash2, UploadCloud } from 'lucide-react'

type Mode = 'txt-to-excel' | 'excel-to-txt'

type SelectedFile = File

type PreviewData =
  | { type: 'empty'; message: string }
  | { type: 'table'; title: string; rows: string[][] }

const TXT_SOURCE_DELIMITER_OPTIONS = [
  { value: 'auto', label: '自动识别' },
  { value: 'tab', label: '制表符 Tab' },
  { value: 'comma', label: '逗号 ,' },
  { value: 'semicolon', label: '分号 ;' },
  { value: 'pipe', label: '竖线 |' },
  { value: 'space', label: '空格' },
  { value: 'custom', label: '自定义' },
]

const TXT_ENCODING_OPTIONS = [
  { value: 'utf-8', label: 'UTF-8' },
  { value: 'gbk', label: 'GBK' },
  { value: 'gb18030', label: 'GB18030' },
  { value: 'big5', label: 'Big5' },
  { value: 'utf-16le', label: 'UTF-16 LE' },
]

const TXT_TO_EXCEL_OUTPUT_OPTIONS = [
  { value: 'one-workbook', label: '合并为一个 Excel，每个 TXT 一个 Sheet' },
  { value: 'zip-workbooks', label: '每个 TXT 单独生成 Excel，并打包 ZIP' },
]

const EXCEL_TXT_DELIMITER_OPTIONS = [
  { value: 'tab', label: '制表符 Tab' },
  { value: 'comma', label: '逗号 ,' },
  { value: 'semicolon', label: '分号 ;' },
  { value: 'pipe', label: '竖线 |' },
  { value: 'space', label: '空格' },
  { value: 'custom', label: '自定义' },
]

const EXCEL_TO_TXT_OUTPUT_OPTIONS = [
  { value: 'sheet-txt-zip', label: '每个工作表生成一个 TXT，并打包 ZIP' },
  { value: 'workbook-txt-zip', label: '每个 Excel 合并为一个 TXT，并打包 ZIP' },
  { value: 'one-txt', label: '全部 Excel 合并为一个 TXT' },
]

const TXT_QUOTE_OPTIONS = [
  { value: 'auto', label: '自动加引号，推荐' },
  { value: 'always', label: '全部字段加引号' },
  { value: 'none', label: '不加引号' },
]

const TXT_BOM_OPTIONS = [
  { value: 'bom', label: 'UTF-8 with BOM，Excel 友好' },
  { value: 'none', label: 'UTF-8 无 BOM' },
]

export default function TxtExcelBatchConverterPage() {
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const [mode, setMode] = useState<Mode>('txt-to-excel')
  const [selectedFiles, setSelectedFiles] = useState<SelectedFile[]>([])
  const [isDragOver, setIsDragOver] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [preview, setPreview] = useState<PreviewData>({ type: 'empty', message: '点击“预览第一个文件”后显示前 20 行。' })
  const [logs, setLogs] = useState<string[]>(['等待选择文件...'])

  const [txtDelimiterSelect, setTxtDelimiterSelect] = useState('auto')
  const [txtCustomDelimiter, setTxtCustomDelimiter] = useState('')
  const [txtEncoding, setTxtEncoding] = useState('utf-8')
  const [txtToExcelOutputMode, setTxtToExcelOutputMode] = useState('one-workbook')

  const [excelTxtDelimiterSelect, setExcelTxtDelimiterSelect] = useState('tab')
  const [excelCustomDelimiter, setExcelCustomDelimiter] = useState('')
  const [excelToTxtOutputMode, setExcelToTxtOutputMode] = useState('sheet-txt-zip')
  const [txtQuoteMode, setTxtQuoteMode] = useState('auto')
  const [txtBomMode, setTxtBomMode] = useState('bom')

  const acceptValue =
    mode === 'txt-to-excel'
      ? '.txt,.csv,text/plain,text/csv'
      : '.xlsx,.xls,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,text/csv'

  const dropTitle = mode === 'txt-to-excel' ? '点击选择 TXT 文件，或将文件拖拽到这里' : '点击选择 Excel 文件，或将文件拖拽到这里'
  const dropSubTitle = mode === 'txt-to-excel' ? '支持批量选择 .txt / .csv 文件' : '支持批量选择 .xlsx / .xls / .csv 文件'

  const previewHeaders = useMemo(() => {
    if (preview.type !== 'table' || preview.rows.length === 0) return []
    const maxCols = Math.max(...preview.rows.map((row) => row.length))
    return Array.from({ length: maxCols }, (_, index) => `列 ${index + 1}`)
  }, [preview])

  function pushLog(message: string) {
    const time = new Date().toLocaleTimeString()
    setLogs((prev) => [...prev, `[${time}] ${message}`])
  }

  function resetPreview(message = '点击“预览第一个文件”后显示前 20 行。') {
    setPreview({ type: 'empty', message })
  }

  function switchMode(nextMode: Mode) {
    if (nextMode === mode) return
    setMode(nextMode)
    setSelectedFiles([])
    resetPreview()
    pushLog(nextMode === 'txt-to-excel' ? '已切换到 TXT 转 Excel 模式。' : '已切换到 Excel 转 TXT 模式。')
  }

  function handlePickFiles() {
    fileInputRef.current?.click()
  }

  function dedupeFiles(files: File[]) {
    const map = new Map<string, File>()
    files.forEach((file) => {
      const key = `${file.name}_${file.size}_${file.lastModified}`
      if (!map.has(key)) map.set(key, file)
    })
    return Array.from(map.values())
  }

  function addFiles(files: File[]) {
    const validFiles = files.filter((file) => {
      const lower = file.name.toLowerCase()
      if (mode === 'txt-to-excel') {
        return lower.endsWith('.txt') || lower.endsWith('.csv') || file.type.includes('text') || !file.type
      }
      return lower.endsWith('.xlsx') || lower.endsWith('.xls') || lower.endsWith('.csv')
    })

    const merged = dedupeFiles([...selectedFiles, ...validFiles])
    setSelectedFiles(merged)

    if (validFiles.length > 0) {
      pushLog(`已添加 ${validFiles.length} 个文件。当前共 ${merged.length} 个文件。`)
    } else {
      pushLog(mode === 'txt-to-excel' ? '没有检测到有效的 TXT/CSV 文件。' : '没有检测到有效的 Excel/XLS/CSV 文件。')
    }
  }

  async function handlePreview() {
    if (!selectedFiles.length) return
    try {
      if (mode === 'txt-to-excel') {
        const file = selectedFiles[0]
        const text = await readFileAsText(file, txtEncoding)
        const delimiter = getTxtSourceDelimiter(text, txtDelimiterSelect, txtCustomDelimiter)
        const rows = parseTextToRows(text, delimiter).slice(0, 20)
        setPreview({
          type: 'table',
          title: `预览文件：${file.name}，识别分隔符：${formatDelimiterName(delimiter)}`,
          rows,
        })
        pushLog(`已预览 TXT：${file.name}`)
      } else {
        const file = selectedFiles[0]
        const workbook = await readWorkbook(file)
        const firstSheetName = workbook.SheetNames[0]
        if (!firstSheetName) throw new Error('该 Excel 没有工作表。')
        const rows = sheetToRows(workbook.Sheets[firstSheetName]).slice(0, 20)
        setPreview({
          type: 'table',
          title: `预览文件：${file.name}，工作表：${firstSheetName}`,
          rows,
        })
        pushLog(`已预览 Excel：${file.name} / ${firstSheetName}`)
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : '未知错误'
      pushLog(`预览失败：${message}`)
      alert(`预览失败：${message}`)
    }
  }

  async function handleConvert() {
    if (!selectedFiles.length) return
    try {
      setIsProcessing(true)
      if (mode === 'txt-to-excel') {
        if (txtToExcelOutputMode === 'one-workbook') {
          await downloadOneWorkbookFromTxt(selectedFiles, {
            encoding: txtEncoding,
            delimiterMode: txtDelimiterSelect,
            customDelimiter: txtCustomDelimiter,
            onLog: pushLog,
          })
        } else {
          await downloadZipWorkbooksFromTxt(selectedFiles, {
            encoding: txtEncoding,
            delimiterMode: txtDelimiterSelect,
            customDelimiter: txtCustomDelimiter,
            onLog: pushLog,
          })
        }
      } else if (excelToTxtOutputMode === 'sheet-txt-zip') {
        await downloadSheetTxtZipFromExcel(selectedFiles, {
          delimiterMode: excelTxtDelimiterSelect,
          customDelimiter: excelCustomDelimiter,
          quoteMode: txtQuoteMode,
          bomMode: txtBomMode,
          onLog: pushLog,
        })
      } else if (excelToTxtOutputMode === 'workbook-txt-zip') {
        await downloadWorkbookTxtZipFromExcel(selectedFiles, {
          delimiterMode: excelTxtDelimiterSelect,
          customDelimiter: excelCustomDelimiter,
          quoteMode: txtQuoteMode,
          bomMode: txtBomMode,
          onLog: pushLog,
        })
      } else {
        await downloadOneTxtFromExcel(selectedFiles, {
          delimiterMode: excelTxtDelimiterSelect,
          customDelimiter: excelCustomDelimiter,
          quoteMode: txtQuoteMode,
          bomMode: txtBomMode,
          onLog: pushLog,
        })
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : '未知错误'
      pushLog(`转换失败：${message}`)
      alert(`转换失败：${message}`)
    } finally {
      setIsProcessing(false)
    }
  }

  function handleClear() {
    setSelectedFiles([])
    resetPreview()
    pushLog('已清空文件。')
  }

  return (
    <div className="space-y-6">
      <section className="rounded-2xl bg-gradient-to-r from-blue-700 to-indigo-500 p-6 text-white shadow-sm">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-white/15 p-3">
            <ArrowLeftRight className="h-6 w-6" />
          </div>
          <div>
            <h2 className="text-2xl font-bold">TXT 与 Excel 双向批量转换工具</h2>
            <p className="mt-2 text-sm leading-6 text-blue-50">
              支持多个 TXT 批量转 Excel，也支持多个 Excel / XLS / CSV 批量转 TXT，所有文件均在浏览器本地处理。
            </p>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="grid gap-3 md:grid-cols-2">
          <ModeCard
            active={mode === 'txt-to-excel'}
            title="TXT 转 Excel"
            desc="多个 TXT 合并为一个 Excel，或分别生成 Excel 后打包下载"
            onClick={() => switchMode('txt-to-excel')}
          />
          <ModeCard
            active={mode === 'excel-to-txt'}
            title="Excel 转 TXT"
            desc="多个 Excel / XLS / CSV 批量转 TXT，可按工作表拆分"
            onClick={() => switchMode('excel-to-txt')}
          />
        </div>

        <div
          className={`mt-6 rounded-2xl border-2 border-dashed p-8 text-center transition ${
            isDragOver ? 'border-blue-600 bg-blue-100' : 'border-blue-300 bg-blue-50'
          }`}
          onClick={handlePickFiles}
          onDragOver={(event) => {
            event.preventDefault()
            setIsDragOver(true)
          }}
          onDragLeave={() => setIsDragOver(false)}
          onDrop={(event) => {
            event.preventDefault()
            setIsDragOver(false)
            addFiles(Array.from(event.dataTransfer.files || []))
          }}
        >
          <UploadCloud className="mx-auto mb-3 h-10 w-10 text-blue-600" />
          <strong className="block text-lg text-blue-700">{dropTitle}</strong>
          <span className="mt-2 block text-sm text-slate-500">{dropSubTitle}</span>
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            multiple
            accept={acceptValue}
            onChange={(event) => {
              addFiles(Array.from(event.target.files || []))
              event.currentTarget.value = ''
            }}
          />
        </div>

        {mode === 'txt-to-excel' ? (
          <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <SelectField label="TXT 源文件分隔符" value={txtDelimiterSelect} onChange={setTxtDelimiterSelect} options={TXT_SOURCE_DELIMITER_OPTIONS} />
            {txtDelimiterSelect === 'custom' && (
              <InputField label="自定义分隔符" value={txtCustomDelimiter} onChange={setTxtCustomDelimiter} placeholder="例如：|" />
            )}
            <SelectField label="TXT 源文件编码" value={txtEncoding} onChange={setTxtEncoding} options={TXT_ENCODING_OPTIONS} />
            <SelectField label="Excel 下载方式" value={txtToExcelOutputMode} onChange={setTxtToExcelOutputMode} options={TXT_TO_EXCEL_OUTPUT_OPTIONS} />
          </div>
        ) : (
          <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <SelectField label="TXT 输出分隔符" value={excelTxtDelimiterSelect} onChange={setExcelTxtDelimiterSelect} options={EXCEL_TXT_DELIMITER_OPTIONS} />
            {excelTxtDelimiterSelect === 'custom' && (
              <InputField label="自定义分隔符" value={excelCustomDelimiter} onChange={setExcelCustomDelimiter} placeholder="例如：|" />
            )}
            <SelectField label="TXT 下载方式" value={excelToTxtOutputMode} onChange={setExcelToTxtOutputMode} options={EXCEL_TO_TXT_OUTPUT_OPTIONS} />
            <SelectField label="TXT 字段引号处理" value={txtQuoteMode} onChange={setTxtQuoteMode} options={TXT_QUOTE_OPTIONS} />
            <SelectField label="TXT 编码标记" value={txtBomMode} onChange={setTxtBomMode} options={TXT_BOM_OPTIONS} />
          </div>
        )}

        <div className="mt-6 flex flex-wrap gap-3">
          <ActionButton icon={Download} primary disabled={!selectedFiles.length || isProcessing} onClick={handleConvert}>
            {isProcessing ? '处理中...' : '开始转换并下载'}
          </ActionButton>
          <ActionButton icon={Eye} disabled={!selectedFiles.length || isProcessing} onClick={handlePreview}>
            预览第一个文件
          </ActionButton>
          <ActionButton icon={Trash2} danger disabled={!selectedFiles.length || isProcessing} onClick={handleClear}>
            清空文件
          </ActionButton>
        </div>

        <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm leading-6 text-amber-700">
          如果 TXT 转 Excel 出现乱码，请切换源文件编码为 `GBK` 或 `GB18030`。Excel 转 TXT 默认输出 `UTF-8`，可选带 `BOM`，更适合 Windows 记事本和 Excel 打开中文。
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-2">
        <Panel title="已选择文件">
          {selectedFiles.length === 0 ? (
            <div className="p-4 text-sm text-slate-500">暂无文件</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-slate-100 text-slate-600">
                  <tr>
                    <th className="px-3 py-2">序号</th>
                    <th className="px-3 py-2">文件名</th>
                    <th className="px-3 py-2">大小</th>
                    <th className="px-3 py-2">修改时间</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedFiles.map((file, index) => (
                    <tr key={`${file.name}-${file.size}-${file.lastModified}`} className="border-t border-slate-200">
                      <td className="px-3 py-2">{index + 1}</td>
                      <td className="px-3 py-2">{file.name}</td>
                      <td className="px-3 py-2">{formatSize(file.size)}</td>
                      <td className="px-3 py-2">{new Date(file.lastModified).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>

        <Panel title="数据预览">
          {preview.type === 'empty' ? (
            <div className="p-4 text-sm text-slate-500">{preview.message}</div>
          ) : (
            <div>
              <div className="border-b border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700">{preview.title}</div>
              <div className="max-h-[360px] overflow-auto">
                <table className="min-w-full text-left text-sm">
                  <thead className="bg-slate-100 text-slate-600">
                    <tr>
                      {previewHeaders.map((header) => (
                        <th key={header} className="px-3 py-2">
                          {header}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {preview.rows.map((row, rowIndex) => (
                      <tr key={rowIndex} className="border-t border-slate-200">
                        {previewHeaders.map((_, colIndex) => (
                          <td key={`${rowIndex}-${colIndex}`} className="px-3 py-2 align-top">
                            {row[colIndex] ?? ''}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </Panel>
      </div>

      <Panel title="处理日志">
        <div className="max-h-[220px] overflow-auto whitespace-pre-wrap px-4 py-3 text-sm leading-7 text-slate-600">
          {logs.join('\n')}
        </div>
      </Panel>
    </div>
  )
}

function ModeCard({
  active,
  title,
  desc,
  onClick,
}: {
  active: boolean
  title: string
  desc: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-2xl border p-4 text-left transition ${
        active ? 'border-blue-600 bg-blue-600 text-white shadow-lg shadow-blue-200' : 'border-blue-100 bg-slate-50 text-blue-900'
      }`}
    >
      <strong className="block text-base">{title}</strong>
      <span className={`mt-1 block text-sm ${active ? 'text-blue-50' : 'text-slate-500'}`}>{desc}</span>
    </button>
  )
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 bg-white px-4 py-3 font-bold text-slate-900">{title}</div>
      {children}
    </section>
  )
}

function SelectField({
  label,
  value,
  onChange,
  options,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  options: Array<{ value: string; label: string }>
}) {
  return (
    <label className="flex flex-col gap-2">
      <span className="text-sm font-medium text-slate-700">{label}</span>
      <select
        className="h-11 rounded-xl border border-slate-300 bg-white px-3 text-sm outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  )
}

function InputField({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  placeholder?: string
}) {
  return (
    <label className="flex flex-col gap-2">
      <span className="text-sm font-medium text-slate-700">{label}</span>
      <input
        className="h-11 rounded-xl border border-slate-300 bg-white px-3 text-sm outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
      />
    </label>
  )
}

function ActionButton({
  children,
  icon: Icon,
  primary = false,
  danger = false,
  disabled = false,
  onClick,
}: {
  children: React.ReactNode
  icon: React.ComponentType<{ className?: string }>
  primary?: boolean
  danger?: boolean
  disabled?: boolean
  onClick: () => void
}) {
  const className = primary
    ? 'bg-blue-600 text-white hover:bg-blue-700'
    : danger
      ? 'bg-red-50 text-red-600 hover:bg-red-100'
      : 'bg-slate-200 text-slate-700 hover:bg-slate-300'

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`inline-flex items-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60 ${className}`}
    >
      <Icon className="h-4 w-4" />
      {children}
    </button>
  )
}

async function readFileAsText(file: File, encoding: string) {
  const buffer = await file.arrayBuffer()
  try {
    const decoder = new TextDecoder(encoding, { fatal: false })
    return decoder.decode(buffer).replace(/^\uFEFF/, '')
  } catch {
    const decoder = new TextDecoder('utf-8', { fatal: false })
    return decoder.decode(buffer).replace(/^\uFEFF/, '')
  }
}

function getTxtSourceDelimiter(text: string, selected: string, customValue: string) {
  if (selected === 'custom') {
    if (!customValue) throw new Error('请输入 TXT 源文件自定义分隔符。')
    return customValue
  }
  const delimiterMap: Record<string, string> = {
    tab: '\t',
    comma: ',',
    semicolon: ';',
    pipe: '|',
    space: ' ',
  }
  if (selected !== 'auto') return delimiterMap[selected]
  return detectDelimiter(text)
}

function getTxtOutputDelimiter(selected: string, customValue: string) {
  if (selected === 'custom') {
    if (!customValue) throw new Error('请输入 TXT 输出自定义分隔符。')
    return customValue
  }
  const delimiterMap: Record<string, string> = {
    tab: '\t',
    comma: ',',
    semicolon: ';',
    pipe: '|',
    space: ' ',
  }
  return delimiterMap[selected]
}

function detectDelimiter(text: string) {
  const sampleLines = text
    .split(/\r\n|\n|\r/)
    .filter((line) => line.trim() !== '')
    .slice(0, 30)

  if (!sampleLines.length) return '\t'

  const candidates = ['\t', ',', ';', '|', ' ']
  let bestDelimiter = '\t'
  let bestScore = -Infinity

  for (const delimiter of candidates) {
    const counts = sampleLines.map((line) => {
      if (delimiter === ' ') return line.trim().split(/\s+/).length
      return parseDelimitedLine(line, delimiter).length
    })
    const avg = counts.reduce((sum, current) => sum + current, 0) / counts.length
    const variance = counts.reduce((sum, current) => sum + Math.pow(current - avg, 2), 0) / counts.length
    const score = avg > 1 ? avg * 10 - variance * 3 : -100
    if (score > bestScore) {
      bestScore = score
      bestDelimiter = delimiter
    }
  }

  return bestDelimiter
}

function parseTextToRows(text: string, delimiter: string) {
  return text
    .split(/\r\n|\n|\r/)
    .filter((line) => line.trim() !== '')
    .map((line) => {
      if (delimiter === ' ') return line.trim().split(/\s+/)
      return parseDelimitedLine(line, delimiter)
    })
}

function parseDelimitedLine(line: string, delimiter: string) {
  const result: string[] = []
  let current = ''
  let inQuotes = false

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i]
    const nextChar = line[i + 1]
    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        current += '"'
        i += 1
      } else {
        inQuotes = !inQuotes
      }
    } else if (!inQuotes && line.startsWith(delimiter, i)) {
      result.push(current)
      current = ''
      i += delimiter.length - 1
    } else {
      current += char
    }
  }

  result.push(current)
  return result
}

async function readWorkbook(file: File) {
  const buffer = await file.arrayBuffer()
  return XLSX.read(buffer, { type: 'array', cellDates: true })
}

function sheetToRows(sheet: XLSX.WorkSheet) {
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '', raw: false }) as unknown[][]
  return rows.map((row) => row.map((cell) => (cell == null ? '' : String(cell))))
}

async function downloadOneWorkbookFromTxt(
  files: File[],
  options: { encoding: string; delimiterMode: string; customDelimiter: string; onLog: (message: string) => void }
) {
  const workbook = XLSX.utils.book_new()
  const usedSheetNames = new Set<string>()

  options.onLog('开始将 TXT 合并转换为一个 Excel 工作簿...')

  for (const file of files) {
    const text = await readFileAsText(file, options.encoding)
    const delimiter = getTxtSourceDelimiter(text, options.delimiterMode, options.customDelimiter)
    const rows = parseTextToRows(text, delimiter)

    if (!rows.length) {
      options.onLog(`跳过空文件：${file.name}`)
      continue
    }

    const worksheet = XLSX.utils.aoa_to_sheet(rows)
    const sheetName = getUniqueSheetName(file.name, usedSheetNames)
    XLSX.utils.book_append_sheet(workbook, worksheet, sheetName)
    options.onLog(`已加入 Sheet：${sheetName}，共 ${rows.length} 行。`)
  }

  if (!workbook.SheetNames.length) throw new Error('没有可转换的数据。')

  const filename = `TXT批量转Excel_${formatDateTime(new Date())}.xlsx`
  XLSX.writeFile(workbook, filename)
  options.onLog(`下载完成：${filename}`)
}

async function downloadZipWorkbooksFromTxt(
  files: File[],
  options: { encoding: string; delimiterMode: string; customDelimiter: string; onLog: (message: string) => void }
) {
  const zip = new JSZip()
  const usedExcelNames = new Set<string>()
  options.onLog('开始将每个 TXT 单独转换为 Excel，并打包 ZIP...')

  for (const file of files) {
    const text = await readFileAsText(file, options.encoding)
    const delimiter = getTxtSourceDelimiter(text, options.delimiterMode, options.customDelimiter)
    const rows = parseTextToRows(text, delimiter)

    if (!rows.length) {
      options.onLog(`跳过空文件：${file.name}`)
      continue
    }

    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(rows), '数据')
    const excelArray = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' })
    const excelName = getUniqueExcelFileName(removeExtension(file.name), usedExcelNames)
    zip.file(excelName, excelArray)
    options.onLog(`已生成：${excelName}，共 ${rows.length} 行。`)
  }

  const zipBlob = await zip.generateAsync({ type: 'blob' })
  const zipName = `TXT批量转Excel_${formatDateTime(new Date())}.zip`
  triggerBlobDownload(zipBlob, zipName)
  options.onLog(`下载完成：${zipName}`)
}

function rowsToTxt(rows: string[][], delimiter: string, quoteMode: string) {
  return rows
    .map((row) => row.map((cell) => escapeTxtCell(cell, delimiter, quoteMode)).join(delimiter))
    .join('\r\n')
}

function escapeTxtCell(value: string, delimiter: string, quoteMode: string) {
  const text = value == null ? '' : String(value)
  if (quoteMode === 'none') return text

  const needQuote =
    quoteMode === 'always' ||
    text.includes('"') ||
    text.includes('\r') ||
    text.includes('\n') ||
    text.includes(delimiter)

  if (!needQuote) return text
  return `"${text.replace(/"/g, '""')}"`
}

async function downloadSheetTxtZipFromExcel(
  files: File[],
  options: { delimiterMode: string; customDelimiter: string; quoteMode: string; bomMode: string; onLog: (message: string) => void }
) {
  const delimiter = getTxtOutputDelimiter(options.delimiterMode, options.customDelimiter)
  const zip = new JSZip()
  const usedTxtNames = new Set<string>()

  options.onLog('开始转换：每个工作表生成一个 TXT，并直接放入 ZIP 根目录...')

  for (const file of files) {
    const workbook = await readWorkbook(file)
    const workbookBaseName = safeFileName(removeExtension(file.name))
    const validSheetNames = workbook.SheetNames.filter((sheetName) => sheetToRows(workbook.Sheets[sheetName]).length > 0)

    if (!validSheetNames.length) {
      options.onLog(`跳过空文件：${file.name}`)
      continue
    }

    const firstValidSheetName = validSheetNames[0]
    for (const sheetName of workbook.SheetNames) {
      const rows = sheetToRows(workbook.Sheets[sheetName])
      if (!rows.length) {
        options.onLog(`跳过空工作表：${file.name} / ${sheetName}`)
        continue
      }

      const txt = rowsToTxt(rows, delimiter, options.quoteMode)
      let baseTxtName = workbookBaseName
      if (validSheetNames.length > 1 && sheetName !== firstValidSheetName) {
        baseTxtName = `${workbookBaseName}_${safeFileName(sheetName)}`
      }

      const txtName = getUniqueTxtFileName(baseTxtName, usedTxtNames)
      zip.file(txtName, options.bomMode === 'bom' ? `\uFEFF${txt}` : txt)
      options.onLog(`已生成 TXT：${txtName}，来源：${file.name} / ${sheetName}，共 ${rows.length} 行。`)
    }
  }

  const zipBlob = await zip.generateAsync({ type: 'blob' })
  const zipName = `Excel批量转TXT_按工作表_${formatDateTime(new Date())}.zip`
  triggerBlobDownload(zipBlob, zipName)
  options.onLog(`下载完成：${zipName}`)
}

async function downloadWorkbookTxtZipFromExcel(
  files: File[],
  options: { delimiterMode: string; customDelimiter: string; quoteMode: string; bomMode: string; onLog: (message: string) => void }
) {
  const delimiter = getTxtOutputDelimiter(options.delimiterMode, options.customDelimiter)
  const zip = new JSZip()
  const usedTxtNames = new Set<string>()

  options.onLog('开始转换：每个 Excel 合并为一个 TXT，并打包 ZIP...')

  for (const file of files) {
    const workbook = await readWorkbook(file)
    const parts: string[] = []

    for (const sheetName of workbook.SheetNames) {
      const rows = sheetToRows(workbook.Sheets[sheetName])
      if (!rows.length) {
        options.onLog(`跳过空工作表：${file.name} / ${sheetName}`)
        continue
      }
      parts.push(`# 工作表：${sheetName}`)
      parts.push(rowsToTxt(rows, delimiter, options.quoteMode))
      parts.push('')
    }

    if (!parts.length) {
      options.onLog(`跳过空文件：${file.name}`)
      continue
    }

    const txtName = getUniqueTxtFileName(removeExtension(file.name), usedTxtNames)
    const txt = parts.join('\r\n')
    zip.file(txtName, options.bomMode === 'bom' ? `\uFEFF${txt}` : txt)
    options.onLog(`已生成 TXT：${txtName}`)
  }

  const zipBlob = await zip.generateAsync({ type: 'blob' })
  const zipName = `Excel批量转TXT_按文件_${formatDateTime(new Date())}.zip`
  triggerBlobDownload(zipBlob, zipName)
  options.onLog(`下载完成：${zipName}`)
}

async function downloadOneTxtFromExcel(
  files: File[],
  options: { delimiterMode: string; customDelimiter: string; quoteMode: string; bomMode: string; onLog: (message: string) => void }
) {
  const delimiter = getTxtOutputDelimiter(options.delimiterMode, options.customDelimiter)
  const parts: string[] = []

  options.onLog('开始转换：全部 Excel 合并为一个 TXT...')

  for (const file of files) {
    const workbook = await readWorkbook(file)
    parts.push(`# 文件：${file.name}`)

    for (const sheetName of workbook.SheetNames) {
      const rows = sheetToRows(workbook.Sheets[sheetName])
      if (!rows.length) {
        options.onLog(`跳过空工作表：${file.name} / ${sheetName}`)
        continue
      }
      parts.push(`# 工作表：${sheetName}`)
      parts.push(rowsToTxt(rows, delimiter, options.quoteMode))
      parts.push('')
      options.onLog(`已加入：${file.name} / ${sheetName}，共 ${rows.length} 行。`)
    }

    parts.push('')
  }

  const txt = parts.join('\r\n')
  if (!txt.trim()) throw new Error('没有可转换的数据。')

  const filename = `Excel批量转TXT_合并_${formatDateTime(new Date())}.txt`
  triggerBlobDownload(makeTxtBlob(txt, options.bomMode), filename)
  options.onLog(`下载完成：${filename}`)
}

function makeTxtBlob(text: string, bomMode: string) {
  const content = bomMode === 'bom' ? `\uFEFF${text}` : text
  return new Blob([content], { type: 'text/plain;charset=utf-8' })
}

function getUniqueSheetName(filename: string, usedSheetNames: Set<string>) {
  let base = removeExtension(filename).replace(/[\\/?*\[\]:]/g, '_').trim()
  if (!base) base = 'Sheet'
  base = base.slice(0, 31)

  let name = base
  let index = 1
  while (usedSheetNames.has(name)) {
    const suffix = `_${index}`
    name = `${base.slice(0, 31 - suffix.length)}${suffix}`
    index += 1
  }
  usedSheetNames.add(name)
  return name
}

function getUniqueTxtFileName(baseName: string, usedNames: Set<string>) {
  const safeBase = safeFileName(baseName || '未命名')
  let filename = `${safeBase}.txt`
  let index = 1
  while (usedNames.has(filename)) {
    filename = `${safeBase}_${index}.txt`
    index += 1
  }
  usedNames.add(filename)
  return filename
}

function getUniqueExcelFileName(baseName: string, usedNames: Set<string>) {
  const safeBase = safeFileName(baseName || '未命名')
  let filename = `${safeBase}.xlsx`
  let index = 1
  while (usedNames.has(filename)) {
    filename = `${safeBase}_${index}.xlsx`
    index += 1
  }
  usedNames.add(filename)
  return filename
}

function removeExtension(filename: string) {
  return filename.replace(/\.[^/.]+$/, '')
}

function safeFileName(name: string) {
  const cleaned = String(name || '未命名').replace(/[\\/:*?"<>|]/g, '_').trim()
  return cleaned || '未命名'
}

function formatSize(size: number) {
  if (size < 1024) return `${size} B`
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(2)} KB`
  return `${(size / 1024 / 1024).toFixed(2)} MB`
}

function formatDateTime(date: Date) {
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}_${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`
}

function triggerBlobDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  URL.revokeObjectURL(url)
}

function formatDelimiterName(delimiter: string) {
  if (delimiter === '\t') return 'Tab 制表符'
  if (delimiter === ' ') return '空格'
  return delimiter
}
