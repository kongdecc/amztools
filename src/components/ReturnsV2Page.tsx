import React, { useState, useRef } from 'react'
import { Download, Trash2 } from 'lucide-react'

const ReturnsV2Page = () => {
  const [originalData, setOriginalData] = useState<any[]>([])
  const [filteredData, setFilteredData] = useState<any[]>([])
  const [filters, setFilters] = useState<any>({ startDate: '', endDate: '', asin: '', reason: '', fc: '' })
  const [stats, setStats] = useState<any>({ totalReturns: 0, totalQuantity: 0, totalAsins: 0, totalSkus: 0, avgDaily: '0.0', topReason: '-' })
  const [comments, setComments] = useState<any[]>([])
  const [selectedIdx, setSelectedIdx] = useState<Set<number>>(new Set())
  const [commentAsin, setCommentAsin] = useState('')
  const chartsRef = useRef<Record<string, any>>({})
  const ChartRef = useRef<any>(null)
  const COLORS = ['#FF9900','#232F3E','#37475A','#FF6600','#FFA724','#FFD814','#C45500','#8B9DC3']
  const [asinSkuTop, setAsinSkuTop] = useState<Array<{ asin: string, list: Array<{ sku: string, count: number }> }>>([])

  const ensureChartLib = async () => {
    if (!ChartRef.current) {
      const mod = await import('chart.js/auto')
      ChartRef.current = mod.default || (mod as any)
    }
    return ChartRef.current
  }

  const handleFile = async (file: File) => {
    const data = await file.arrayBuffer()
    const xlsx = await import('xlsx')
    const wb = xlsx.read(data, { type: 'array' })
    const sheet = wb.Sheets[wb.SheetNames[0]]
    const json = xlsx.utils.sheet_to_json(sheet)
    setOriginalData(json as any[])
    setFilteredData(json as any[])
    populateFilters(json as any[])
    analyze(json as any[])
  }

  const populateFilters = (arr: any[]) => {
    const asins = Array.from(new Set(arr.map((i:any) => i.asin).filter(Boolean)))
    const reasons = Array.from(new Set(arr.map((i:any) => i.reason).filter(Boolean)))
    const fcs = Array.from(new Set(arr.map((i:any) => i['fulfillment-center-id']).filter(Boolean)))
    const dates = arr.map((i:any) => new Date(i['return-date'])).filter((d:any) => !isNaN(d as any))
    setFilters((prev:any) => ({
      ...prev,
      asinOptions: asins,
      reasonOptions: reasons,
      fcOptions: fcs,
      startDate: dates.length ? new Date(Math.min(...dates as any)).toISOString().split('T')[0] : '',
      endDate: dates.length ? new Date(Math.max(...dates as any)).toISOString().split('T')[0] : ''
    }))
  }

  const applyFilters = () => {
    const { startDate, endDate, asin, reason, fc } = filters
    const next = originalData.filter((item:any) => {
      const d = new Date(item['return-date'])
      if (startDate && d < new Date(startDate)) return false
      if (endDate && d > new Date(endDate + 'T23:59:59')) return false
      if (asin && item.asin !== asin) return false
      if (reason && item.reason !== reason) return false
      if (fc && item['fulfillment-center-id'] !== fc) return false
      return true
    })
    setFilteredData(next)
    analyze(next)
  }

  const resetFilters = () => {
    populateFilters(originalData)
    setFilteredData(originalData)
    analyze(originalData)
  }

  const analyze = async (arr: any[]) => {
    const totalReturns = arr.length
    const totalQuantity = arr.reduce((s:number, i:any) => s + (parseInt(i.quantity) || 1), 0)
    const totalAsins = new Set(arr.map((i:any) => i.asin).filter(Boolean)).size
    const totalSkus = new Set(arr.map((i:any) => i.sku).filter(Boolean)).size
    const dates = arr.map((i:any) => new Date(i['return-date'])).filter((d:any) => !isNaN(d as any))
    const daysDiff = dates.length ? Math.ceil((Math.max(...(dates as any)) - Math.min(...(dates as any))) / (1000*60*60*24)) + 1 : 1
    const avgDaily = (totalReturns / daysDiff).toFixed(1)
    const reasonCounts: Record<string, number> = {}
    arr.forEach((i:any) => { if (i.reason) reasonCounts[i.reason] = (reasonCounts[i.reason] || 0) + 1 })
    const top = Object.entries(reasonCounts).sort((a:any,b:any)=>b[1]-a[1])[0]
    setStats({ totalReturns, totalQuantity, totalAsins, totalSkus, avgDaily, topReason: top ? top[0] : '-' })
    const cs = arr.filter((i:any) => i['customer-comments'] && String(i['customer-comments']).trim()).map((i:any) => ({
      date: i['return-date'], asin: i.asin, sku: i.sku, reason: i.reason, comment: String(i['customer-comments']).trim()
    }))
    setComments(cs)
    setSelectedIdx(new Set())
    setCommentAsin('')

    const Chart = await ensureChartLib()
    const reasonCtx = (document.getElementById('reasonChart') as HTMLCanvasElement)?.getContext('2d')
    const asinCtx = (document.getElementById('asinChart') as HTMLCanvasElement)?.getContext('2d')
    const fcCtx = (document.getElementById('fcChart') as HTMLCanvasElement)?.getContext('2d')
    const trendCtx = (document.getElementById('trendChart') as HTMLCanvasElement)?.getContext('2d')

    if (chartsRef.current.reason) chartsRef.current.reason.destroy()
    if (chartsRef.current.asin) chartsRef.current.asin.destroy()
    if (chartsRef.current.fc) chartsRef.current.fc.destroy()
    if (chartsRef.current.trend) chartsRef.current.trend.destroy()

    const reasonLabels = Object.keys(reasonCounts)
    const reasonValues = Object.values(reasonCounts)
    if (reasonCtx) {
      chartsRef.current.reason = new Chart(reasonCtx, {
        type: 'pie',
        data: { labels: reasonLabels, datasets: [{ data: reasonValues, backgroundColor: COLORS }] },
        options: { responsive: true, maintainAspectRatio: false }
      })
    }

    const asinStats: Record<string, number> = {}
    const skuStatsByAsin: Record<string, Record<string, number>> = {}
    arr.forEach((i:any)=>{ 
      if(i.asin) {
        asinStats[i.asin]=(asinStats[i.asin]||0)+1 
        const sku = i.sku || '-'
        if (!skuStatsByAsin[i.asin]) skuStatsByAsin[i.asin] = {}
        skuStatsByAsin[i.asin][sku] = (skuStatsByAsin[i.asin][sku]||0)+1
      }
    })
    const asinEntries = Object.entries(asinStats).map(([asin,count])=>({ asin, count })).sort((a:any,b:any)=>b.count-a.count).slice(0,10)
    if (asinCtx) {
      chartsRef.current.asin = new Chart(asinCtx, {
        type: 'bar',
        data: { labels: asinEntries.map(e=>e.asin), datasets: [{ label: '退货数量', data: asinEntries.map(e=>e.count), backgroundColor: '#FF9900', borderColor: '#FF6600', borderWidth: 1 }] },
        options: { responsive: true, maintainAspectRatio: false }
      })
    }
    const asinSkuList = asinEntries.map(e => {
      const m = skuStatsByAsin[e.asin] || {}
      const tops = Object.entries(m).map(([sku, count])=>({ sku, count })).sort((a:any,b:any)=>b.count-a.count).slice(0,3)
      return { asin: e.asin, list: tops }
    })
    setAsinSkuTop(asinSkuList)

    const fcCounts: Record<string, number> = {}
    arr.forEach((i:any)=>{ const fc=i['fulfillment-center-id']; if(fc) fcCounts[fc]=(fcCounts[fc]||0)+1 })
    const fcLabels = Object.keys(fcCounts)
    const fcValues = Object.values(fcCounts)
    if (fcCtx) {
      chartsRef.current.fc = new Chart(fcCtx, {
        type: 'doughnut',
        data: { labels: fcLabels, datasets: [{ data: fcValues, backgroundColor: COLORS }] },
        options: { responsive: true, maintainAspectRatio: false }
      })
    }

    const daily: Record<string, number> = {}
    arr.forEach((i:any)=>{ const d=new Date(i['return-date']); if(!isNaN(d as any)){ const k=d.toISOString().split('T')[0]; daily[k]=(daily[k]||0)+1 } })
    const datesSorted = Object.keys(daily).sort()
    if (trendCtx) {
      chartsRef.current.trend = new Chart(trendCtx, {
        type: 'line',
        data: { labels: datesSorted, datasets: [{ label: '每日退货数量', data: datesSorted.map(d=>daily[d]), borderColor: '#FF9900', backgroundColor: 'rgba(255,153,0,0.1)', tension: 0.1 }] },
        options: { responsive: true, maintainAspectRatio: false }
      })
    }
  }

  const downloadText = (filename: string, text: string) => {
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
  }

  const downloadAllComments = () => {
    const list = String(commentAsin || '').trim() ? comments.filter(c => String(c.asin || '') === String(commentAsin)) : comments
    const text = list.map(c=>c.comment).join('\n')
    if (!text.trim()) { alert('无可下载的客户反馈内容'); return }
    const filename = `客户反馈汇总_${new Date().toISOString().split('T')[0]}.txt`
    downloadText(filename, text)
  }

  const downloadSelectedComments = () => {
    const idxs = Array.from(selectedIdx).sort((a,b)=>a-b)
    const text = idxs.map(i=>comments[i]?.comment || '').filter(Boolean).join('\n')
    if (!text.trim()) { alert('选中的反馈没有可下载的内容'); return }
    const filename = `客户反馈选中_${new Date().toISOString().split('T')[0]}.txt`
    downloadText(filename, text)
  }

  const exportAnalysis = async () => {
    const xlsx = await import('xlsx')
    const wb = xlsx.utils.book_new()
    const summary = [
      ['亚马逊退货分析报告'],
      ['生成时间', new Date().toLocaleString()],
      ['作者', '達哥'],
      [''],
      ['总退货次数', stats.totalReturns],
      ['退货商品总数', stats.totalQuantity],
      ['涉及ASIN数', stats.totalAsins],
      ['涉及SKU数', stats.totalSkus],
      ['平均每日退货', stats.avgDaily],
      ['最常见退货原因', stats.topReason]
    ]
    const s1 = xlsx.utils.aoa_to_sheet(summary)
    xlsx.utils.book_append_sheet(wb, s1, '汇总')
    const analysisRows = buildAnalysisRows()
    const s2 = xlsx.utils.json_to_sheet(analysisRows)
    xlsx.utils.book_append_sheet(wb, s2, '产品分析')
    const fcRows = buildFCRows()
    const s3 = xlsx.utils.json_to_sheet(fcRows)
    xlsx.utils.book_append_sheet(wb, s3, '配送中心分析')
    const commentRows = comments.map(c=>({ '退货日期': c.date, 'ASIN': c.asin, 'SKU': c.sku, '退货原因': c.reason, '客户评论': c.comment }))
    if (commentRows.length) {
      const s4 = xlsx.utils.json_to_sheet(commentRows)
      xlsx.utils.book_append_sheet(wb, s4, '客户评论')
    }
    const s5 = xlsx.utils.json_to_sheet(filteredData)
    xlsx.utils.book_append_sheet(wb, s5, '原始数据')
    xlsx.writeFile(wb, `退货分析报告_${new Date().toISOString().split('T')[0]}.xlsx`)
  }

  const buildAnalysisRows = () => {
    const map: Record<string, any> = {}
    filteredData.forEach((i:any)=>{
      if(!i.asin) return
      const k = i.asin
      if(!map[k]) map[k] = { asin: i.asin, sku: i.sku || '-', productName: i['product-name'] || '-', count: 0, quantity: 0, reasons: {}, customerDamaged: 0, defective: 0 }
      map[k].count++
      map[k].quantity += parseInt(i.quantity) || 1
      if(i.reason) map[k].reasons[i.reason] = (map[k].reasons[i.reason]||0)+1
      if(i['detailed-disposition'] === 'CUSTOMER_DAMAGED') map[k].customerDamaged++
      if(i['detailed-disposition'] === 'DEFECTIVE') map[k].defective++
    })
    const total = filteredData.length
    const rows = Object.values(map).sort((a:any,b:any)=>b.count-a.count).map((d:any)=>({
      ASIN: d.asin,
      SKU: d.sku,
      产品名称: d.productName,
      退货次数: d.count,
      退货数量: d.quantity,
      占比: `${((d.count / total) * 100).toFixed(1)}%`,
      主要退货原因: Object.entries(d.reasons).sort((a:any,b:any)=>b[1]-a[1])[0]?.[0] || '-',
      客户损坏率: `${((d.customerDamaged / d.count) * 100).toFixed(1)}%`,
      产品缺陷率: `${((d.defective / d.count) * 100).toFixed(1)}%`
    }))
    return rows
  }

  const buildFCRows = () => {
    const map: Record<string, any> = {}
    filteredData.forEach((i:any)=>{
      const fc=i['fulfillment-center-id']; if(!fc) return
      if(!map[fc]) map[fc] = { count: 0, quantity: 0, reasons: {} }
      map[fc].count++
      map[fc].quantity += parseInt(i.quantity) || 1
      if(i.reason) map[fc].reasons[i.reason] = (map[fc].reasons[i.reason]||0)+1
    })
    const total = filteredData.length
    return Object.entries(map).sort((a:any,b:any)=>b[1].count-a[1].count).map(([fc,data]:any)=>({
      配送中心: fc,
      退货次数: data.count,
      退货数量: data.quantity,
      占比: `${((data.count / total) * 100).toFixed(1)}%`,
      主要退货原因: Object.entries(data.reasons).sort((a:any,b:any)=>b[1]-a[1])[0]?.[0] || '-'
    }))
  }

  const downloadCharts = async () => {
    const ids = ['reasonChart','asinChart','fcChart','trendChart']
    const canvases = ids.map(id => document.getElementById(id) as HTMLCanvasElement).filter(Boolean)
    if (!canvases.length) return
    const exportWidth = 1600
    const margin = 60
    const gap = 40
    const headerTitleHeight = 32
    const headerSubHeight = 22
    const innerWidth = exportWidth - margin * 2
    const scaled = canvases.map((c) => {
      const img = new Image()
      img.src = c.toDataURL('image/png')
      return { img, w: innerWidth, h: Math.round(innerWidth * (c.height / c.width)) }
    })
    const chartsTotalHeight = scaled.reduce((sum, s) => sum + s.h, 0) + gap * (scaled.length - 1)
    const exportHeight = margin + headerTitleHeight + headerSubHeight + margin + chartsTotalHeight + margin
    const canvas = document.createElement('canvas')
    canvas.width = exportWidth
    canvas.height = exportHeight
    const ctx = canvas.getContext('2d')!
    ctx.fillStyle = 'white'
    ctx.fillRect(0,0,canvas.width,canvas.height)
    ctx.textAlign = 'center'
    ctx.fillStyle = '#232F3E'
    ctx.font = 'bold 28px Arial'
    ctx.fillText('亚马逊退货分析图表', exportWidth/2, margin + headerTitleHeight - 4)
    ctx.fillStyle = '#666'
    ctx.font = '16px Arial'
    ctx.fillText('作者：達哥', exportWidth/2, margin + headerTitleHeight + headerSubHeight)
    let y = margin + headerTitleHeight + headerSubHeight + margin
    for (const s of scaled) {
      await new Promise<void>((resolve) => { s.img.onload = () => resolve() })
      const x = Math.round((exportWidth - s.w)/2)
      ctx.drawImage(s.img, x, y, s.w, s.h)
      y += s.h + gap
    }
    const a = document.createElement('a')
    a.download = `亚马逊退货分析图表_${new Date().toISOString().split('T')[0]}.png`
    a.href = canvas.toDataURL('image/png')
    a.click()
  }

    const scrollTo = (id: string) => {
      const el = document.getElementById(id)
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }

    const UploadArea = () => (
      <div className="bg-white p-6 rounded-xl border border-gray-100 text-center">
      <div 
        className="border-2 border-dashed border-orange-400 rounded-xl p-10 cursor-pointer hover:bg-orange-50"
        onClick={() => document.getElementById('returnsFileInput')?.click()}
        onDragOver={(e:any)=>{ e.preventDefault() }}
        onDrop={(e:any)=>{ e.preventDefault(); const f=e.dataTransfer.files?.[0]; if(f) handleFile(f) }}
      >
        <Download className="w-10 h-10 text-orange-500 mx-auto" />
        <h3 className="mt-4 mb-1">点击或拖拽上传 Excel/CSV 文件</h3>
        <p className="text-gray-500 text-sm">支持 .xlsx, .xls, .csv 格式</p>
      </div>
      <input id="returnsFileInput" type="file" className="hidden" accept=".xlsx,.xls,.csv" onChange={(e:any)=>{ const f=e.target.files?.[0]; if(f) handleFile(f) }} />
    </div>
  )

  return (
    <div id="top-nav" className="space-y-6">
      <div className="flex items-center gap-2 mb-2">
        <Trash2 className="h-6 w-6 text-blue-600" />
        <h2 className="text-xl font-bold text-gray-800">亚马逊退货报告分析工具 V2</h2>
      </div>
      <UploadArea />
      {filteredData.length > 0 && (
        <>
          <div className="bg-white p-6 rounded-xl border border-gray-100">
            <h3 className="font-bold text-gray-700 mb-4">数据筛选</h3>
            <div className="space-y-3">
              <div className="flex flex-wrap gap-4 items-center">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-600">日期范围</span>
                  <input type="date" value={filters.startDate} onChange={(e:any)=>setFilters((p:any)=>({ ...p, startDate: e.target.value }))} className="border rounded px-2 py-1 text-sm" />
                  <span className="text-sm text-gray-600">至</span>
                  <input type="date" value={filters.endDate} onChange={(e:any)=>setFilters((p:any)=>({ ...p, endDate: e.target.value }))} className="border rounded px-2 py-1 text-sm" />
                </div>
                <div>
                  <span className="text-sm text-gray-600 mr-2">ASIN</span>
                  <select value={filters.asin} onChange={(e:any)=>setFilters((p:any)=>({ ...p, asin: e.target.value }))} className="border rounded px-2 py-1 text-sm">
                    <option value="">全部</option>
                    {(filters.asinOptions||[]).map((a:string)=>(<option key={a} value={a}>{a}</option>))}
                  </select>
                </div>
                <div>
                  <span className="text-sm text-gray-600 mr-2">退货原因</span>
                  <select value={filters.reason} onChange={(e:any)=>setFilters((p:any)=>({ ...p, reason: e.target.value }))} className="border rounded px-2 py-1 text-sm">
                    <option value="">全部</option>
                    {(filters.reasonOptions||[]).map((r:string)=>(<option key={r} value={r}>{r}</option>))}
                  </select>
                </div>
                <div>
                  <span className="text-sm text-gray-600 mr-2">配送中心</span>
                  <select value={filters.fc} onChange={(e:any)=>setFilters((p:any)=>({ ...p, fc: e.target.value }))} className="border rounded px-2 py-1 text-sm">
                    <option value="">全部</option>
                    {(filters.fcOptions||[]).map((c:string)=>(<option key={c} value={c}>{c}</option>))}
                  </select>
                </div>
                <div className="ml-auto flex items-center gap-2">
                  <button onClick={applyFilters} className="bg-gray-800 hover:bg-gray-900 text-white px-4 py-2 rounded text-sm">应用筛选</button>
                  <button onClick={resetFilters} className="border border-gray-200 text-gray-700 px-4 py-2 rounded text-sm hover:bg-gray-50">重置</button>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {[
                  { id: 'section-reason', label: '原因分布' },
                  { id: 'section-asin', label: 'ASIN排行' },
                  { id: 'section-fc', label: '配送中心分布' },
                  { id: 'section-trend', label: '退货趋势' },
                  { id: 'section-product', label: '产品分析' },
                  { id: 'section-fc-table', label: '配送中心分析' },
                  { id: 'section-comments', label: '客户评论' },
                  { id: 'section-download', label: '下载' },
                ].map(b => (
                  <button key={b.id} onClick={()=>scrollTo(b.id)} className="cursor-pointer px-3 py-1 rounded-full border border-orange-300 text-xs text-orange-700 hover:bg-orange-500 hover:text-white hover:border-orange-500 transition-colors">
                    {b.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
            <div className="bg-white p-4 rounded-xl border text-center"><div className="text-xs text-gray-500">总退货数量</div><div className="text-2xl font-bold text-orange-500 mt-1">{stats.totalReturns}</div></div>
            <div className="bg-white p-4 rounded-xl border text-center"><div className="text-xs text-gray-500">退货商品总数</div><div className="text-2xl font-bold text-orange-500 mt-1">{stats.totalQuantity}</div></div>
            <div className="bg-white p-4 rounded-xl border text-center"><div className="text-xs text-gray-500">涉及ASIN数</div><div className="text-2xl font-bold text-orange-500 mt-1">{stats.totalAsins}</div></div>
            <div className="bg-white p-4 rounded-xl border text-center"><div className="text-xs text-gray-500">涉及SKU数</div><div className="text-2xl font-bold text-orange-500 mt-1">{stats.totalSkus}</div></div>
            <div className="bg-white p-4 rounded-xl border text-center"><div className="text-xs text-gray-500">平均每日退货</div><div className="text-2xl font-bold text-orange-500 mt-1">{stats.avgDaily}</div></div>
            <div className="bg-white p-4 rounded-xl border text-center"><div className="text-xs text-gray-500">最常见退货原因</div><div className="text-base font-semibold text-orange-600 mt-1">{stats.topReason}</div></div>
          </div>

          <div className="space-y-6">
            <div id="section-reason" className="bg-white p-6 rounded-xl border">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-gray-700">退货原因分布</h3>
                <button onClick={()=>scrollTo('top-nav')} className="text-xs text-orange-600 hover:text-orange-700">返回顶部</button>
              </div>
              <div className="h-80"><canvas id="reasonChart"></canvas></div>
            </div>
            <div id="section-asin" className="bg-white p-6 rounded-xl border">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-gray-700">ASIN退货数量排行（前10）</h3>
                <button onClick={()=>scrollTo('top-nav')} className="text-xs text-orange-600 hover:text-orange-700">返回顶部</button>
              </div>
              <div className="h-80"><canvas id="asinChart"></canvas></div>
              <div className="mt-4 overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="bg-gray-100 text-gray-600">
                    <tr>
                      <th className="p-2 text-left">ASIN</th>
                      <th className="p-2 text-left">SKU</th>
                      <th className="p-2 text-left">数量</th>
                    </tr>
                  </thead>
                  <tbody>
                    {asinSkuTop.length === 0 ? (
                      <tr><td colSpan={3} className="p-2 text-center text-gray-400">暂无数据</td></tr>
                    ) : (
                      asinSkuTop.flatMap((row:any) => row.list.map((s:any, idx:number) => (
                        <tr key={`${row.asin}-${s.sku}-${idx}`} className="border-b">
                          <td className="p-2">{row.asin}</td>
                          <td className="p-2">{s.sku}</td>
                          <td className="p-2">{s.count}</td>
                        </tr>
                      )))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
            <div id="section-fc" className="bg-white p-6 rounded-xl border">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-gray-700">配送中心退货分布</h3>
                <button onClick={()=>scrollTo('top-nav')} className="text-xs text-orange-600 hover:text-orange-700">返回顶部</button>
              </div>
              <div className="h-80"><canvas id="fcChart"></canvas></div>
            </div>
            <div id="section-trend" className="bg-white p-6 rounded-xl border">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-gray-700">退货趋势分析</h3>
                <button onClick={()=>scrollTo('top-nav')} className="text-xs text-orange-600 hover:text-orange-700">返回顶部</button>
              </div>
              <div className="h-80"><canvas id="trendChart"></canvas></div>
            </div>
          </div>

          <div id="section-product" className="bg-white p-6 rounded-xl border">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-bold text-gray-700">产品退货分析</h3>
              <button onClick={()=>scrollTo('top-nav')} className="text-xs text-orange-600 hover:text-orange-700">返回顶部</button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-100 text-gray-600">
                  <tr>
                    <th className="p-2">ASIN</th>
                    <th className="p-2">SKU</th>
                    <th className="p-2">产品名称</th>
                    <th className="p-2">退货次数</th>
                    <th className="p-2">退货数量</th>
                    <th className="p-2">占比</th>
                    <th className="p-2">主要退货原因</th>
                    <th className="p-2">客户损坏率</th>
                    <th className="p-2">产品缺陷率</th>
                  </tr>
                </thead>
                <tbody>
                  {buildAnalysisRows().map((row:any, idx:number) => (
                    <tr key={idx} className="border-b">
                      <td className="p-2">{row['ASIN']}</td>
                      <td className="p-2">{row['SKU']}</td>
                      <td className="p-2">{row['产品名称']}</td>
                      <td className="p-2">{row['退货次数']}</td>
                      <td className="p-2">{row['退货数量']}</td>
                      <td className="p-2">{row['占比']}</td>
                      <td className="p-2">{row['主要退货原因']}</td>
                      <td className="p-2">{row['客户损坏率']}</td>
                      <td className="p-2">{row['产品缺陷率']}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div id="section-fc-table" className="bg-white p-6 rounded-xl border">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-bold text-gray-700">配送中心分析</h3>
              <button onClick={()=>scrollTo('top-nav')} className="text-xs text-orange-600 hover:text-orange-700">返回顶部</button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-100 text-gray-600">
                  <tr>
                    <th className="p-2">配送中心</th>
                    <th className="p-2">退货次数</th>
                    <th className="p-2">退货数量</th>
                    <th className="p-2">占比</th>
                    <th className="p-2">主要退货原因</th>
                  </tr>
                </thead>
                <tbody>
                  {buildFCRows().map((row:any, idx:number) => (
                    <tr key={idx} className="border-b">
                      <td className="p-2">{row['配送中心']}</td>
                      <td className="p-2">{row['退货次数']}</td>
                      <td className="p-2">{row['退货数量']}</td>
                      <td className="p-2">{row['占比']}</td>
                      <td className="p-2">{row['主要退货原因']}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div id="section-comments" className="bg-white p-6 rounded-xl border">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-gray-700">客户评论分析</h3>
              <button onClick={()=>scrollTo('top-nav')} className="text-xs text-orange-600 hover:text-orange-700">返回顶部</button>
            </div>
            {(() => {
              const asinOptions = Array.from(new Set(comments.map(c => String(c.asin || '')).filter(Boolean))).sort()
              const list = String(commentAsin || '').trim()
                ? comments.map((c, idx) => ({ c, idx })).filter(x => String(x.c.asin || '') === String(commentAsin))
                : comments.map((c, idx) => ({ c, idx }))
              const visibleIdxs = list.map(x => x.idx)
              const allVisibleSelected = visibleIdxs.length > 0 && visibleIdxs.every(i => selectedIdx.has(i))
              return (
                <>
                  <p className="text-xs text-gray-500">共收集到 <span className="font-medium">{comments.length}</span> 条客户反馈{String(commentAsin || '').trim() ? (<span>，当前筛选 <span className="font-medium">{list.length}</span> 条</span>) : null}</p>
                  <div className="flex items-center gap-3 my-2 flex-wrap">
                    <div className="flex items-center gap-2 text-sm">
                      <span className="text-gray-700">ASIN</span>
                      <select value={commentAsin} onChange={(e:any)=>{ setCommentAsin(e.target.value); setSelectedIdx(new Set()) }} className="border rounded px-2 py-1 text-sm">
                        <option value="">全部</option>
                        {asinOptions.map(a => (<option key={a} value={a}>{a}</option>))}
                      </select>
                    </div>
                    <label className="flex items-center gap-2 text-sm">
                      <input type="checkbox" checked={allVisibleSelected} onChange={(e:any)=>{ const v=e.target.checked; const s=new Set<number>(Array.from(selectedIdx)); if(v) visibleIdxs.forEach(i=>s.add(i)); else visibleIdxs.forEach(i=>s.delete(i)); setSelectedIdx(s) }} /> 全选
                    </label>
                    <button className="bg-gray-800 hover:bg-gray-900 text-white px-3 py-1.5 rounded text-xs" onClick={downloadSelectedComments}>下载选中</button>
                    <button className="border border-gray-200 text-gray-700 px-3 py-1.5 rounded text-xs hover:bg-gray-50" onClick={downloadAllComments}>下载所有反馈</button>
                  </div>
                  <div className="space-y-3">
                    {list.length === 0 ? (
                      <p className="text-center text-gray-500">暂无客户评论</p>
                    ) : list.map(({ c, idx }: any) => (
                      <div key={idx} className="p-3 bg-gray-50 rounded border-l-4 border-orange-500">
                        <div className="text-xs text-gray-600 mb-1"><span className="font-semibold">{c.asin || '未知ASIN'}</span> | SKU: {c.sku || '-'} | 退货原因: {c.reason || '-'} | {new Date(c.date).toLocaleDateString()}</div>
                        <div className="text-sm">{c.comment}</div>
                        <div className="mt-2"><input type="checkbox" checked={selectedIdx.has(idx)} onChange={(e:any)=>{ const s = new Set(Array.from(selectedIdx)); if(e.target.checked) s.add(idx); else s.delete(idx); setSelectedIdx(s) }} /></div>
                      </div>
                    ))}
                  </div>
                </>
              )
            })()}
          </div>

          <div id="section-download" className="text-center space-x-2">
            <button className="bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 rounded text-sm" onClick={exportAnalysis}>导出分析报告</button>
            <button className="bg-gray-800 hover:bg-gray-900 text-white px-4 py-2 rounded text-sm" onClick={downloadCharts}>下载图表</button>
            <button className="border border-orange-300 text-orange-700 hover:bg-orange-500 hover:text-white px-4 py-2 rounded text-sm" onClick={()=>scrollTo('top-nav')}>返回顶部</button>
          </div>
        </>
      )}
    </div>
  )
}

export default ReturnsV2Page
