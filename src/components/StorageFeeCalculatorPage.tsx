'use client'

import React, { useState, useEffect, useRef } from 'react'
import { Warehouse, RotateCcw, Info, Package, TrendingUp, History, Trash2, ChevronRight, ChevronDown } from 'lucide-react'
import { Card } from '@/components/SharedUI'

const StorageFeeCalculatorPage = () => {
  // --- Constants & Data ---
  const BASE_RATES_2024 = {
    offPeak: { standard: 0.78, oversize: 0.56 }, // Jan-Sep
    peak: { standard: 2.40, oversize: 1.40 }     // Oct-Dec
  }

  const UTIL_SURCHARGE_TIERS = [
    [0, 22, 0, 0],
    [22, 28, 0.44, 0.23],
    [28, 36, 0.76, 0.46],
    [36, 44, 1.16, 0.63],
    [44, 52, 1.58, 0.76],
    [52, 9999, 1.88, 1.26]
  ]

  const AGED_RATES_PRE_2026 = [
    { min: 0, max: 180, fee: 0 },
    { min: 181, max: 210, fee: 0.50 },
    { min: 211, max: 240, fee: 1.00 },
    { min: 241, max: 270, fee: 1.50 },
    { min: 271, max: 300, fee: 5.45 },
    { min: 301, max: 330, fee: 5.70 },
    { min: 331, max: 365, fee: 5.90 },
    { min: 366, max: 99999, fee: 6.90, minUnit: 0.15 }
  ]

  const AGED_RATES_POST_2026 = [
    { min: 0, max: 180, fee: 0 },
    { min: 181, max: 210, fee: 0.50 },
    { min: 211, max: 240, fee: 1.00 },
    { min: 241, max: 270, fee: 1.50 },
    { min: 271, max: 300, fee: 5.45 },
    { min: 301, max: 330, fee: 5.70 },
    { min: 331, max: 365, fee: 5.90 },
    { min: 366, max: 455, fee: 6.90, minUnit: 0.30 },
    { min: 456, max: 99999, fee: 7.90, minUnit: 0.35 }
  ]

  // --- State ---
  const [calcDate, setCalcDate] = useState(new Date().toISOString().split('T')[0])
  const [quantity, setQuantity] = useState(100)
  const [length, setLength] = useState(11)
  const [width, setWidth] = useState(8)
  const [height, setHeight] = useState(2)
  const [weight, setWeight] = useState(0.5)
  const [category, setCategory] = useState('standard')
  const [ageDays, setAgeDays] = useState(185)
  const [utilWeeks, setUtilWeeks] = useState(10)
  const [isNewSeller, setIsNewSeller] = useState(false)
  const [history, setHistory] = useState<any[]>([])

  // Results State
  const [results, setResults] = useState({
    totalFee: 0,
    perUnitFee: 0,
    sizeTier: '-',
    volume: 0,
    season: '-',
    policyYear: '-',
    baseFee: 0,
    utilFee: 0,
    utilMsg: '',
    agedFee: 0,
    agedMsg: '',
    logicHtml: ''
  })

  const chartRef = useRef<HTMLCanvasElement>(null)
  const chartInstance = useRef<any>(null)
  const ChartLib = useRef<any>(null)

  // --- Functions ---

  const getSeason = (date: Date) => {
    const month = date.getMonth() + 1
    return (month >= 10) ? 'peak' : 'offPeak'
  }

  const getSizeTier = (l: number, w: number, h: number, weightLbs: number) => {
    const dims = [l, w, h].sort((a, b) => b - a)
    const longest = dims[0]
    const median = dims[1]
    const shortest = dims[2]

    if (weightLbs <= 1 && longest <= 15 && median <= 12 && shortest <= 0.75) {
      return 'standard'
    }

    const l_eff = Math.max(l, 2)
    const w_eff = Math.max(w, 2)
    const h_eff = Math.max(h, 2)
    const volWeight = (l_eff * w_eff * h_eff) / 139
    const shippingWeight = Math.max(weightLbs, volWeight)

    if (shippingWeight <= 20 && longest <= 18 && median <= 14 && shortest <= 8) {
      return 'standard'
    }

    return 'oversize'
  }

  const ensureChartLib = async () => {
    if (!ChartLib.current) {
      const mod = await import('chart.js/auto')
      ChartLib.current = mod.default || (mod as any)
    }
    return ChartLib.current
  }

  const updateChart = async (base: number, util: number, aged: number) => {
    if (!chartRef.current) return
    const Chart = await ensureChartLib()

    if (chartInstance.current) {
      chartInstance.current.destroy()
    }

    chartInstance.current = new Chart(chartRef.current, {
      type: 'doughnut',
      data: {
        labels: ['基本仓储费', '利用率附加费', '超龄库存附加费'],
        datasets: [{
          data: [base, util, aged],
          backgroundColor: [
            '#3b82f6', // blue
            '#ef4444', // red
            '#b91c1c'  // dark red
          ],
          borderWidth: 0
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'bottom',
            labels: { boxWidth: 12, font: { size: 10 } }
          }
        }
      }
    })
  }

  const calculateFees = (saveToHistory = true) => {
    const date = new Date(calcDate)
    const qty = parseInt(String(quantity)) || 0
    const l = parseFloat(String(length)) || 0
    const w = parseFloat(String(width)) || 0
    const h = parseFloat(String(height)) || 0
    const wt = parseFloat(String(weight)) || 0
    
    // Basic Calculations
    const cubicFeetPerUnit = (l * w * h) / 1728
    const totalVolume = cubicFeetPerUnit * qty
    const sizeTier = getSizeTier(l, w, h, wt)
    const season = getSeason(date)
    
    // Base Rate
    let baseRate = 0
    if (category === 'dangerous') {
      baseRate = (season === 'offPeak') 
        ? (sizeTier === 'standard' ? 0.99 : 0.78)
        : (sizeTier === 'standard' ? 3.63 : 2.43)
    } else {
      baseRate = (BASE_RATES_2024 as any)[season][sizeTier]
    }
    const totalBaseFee = totalVolume * baseRate

    // Utilization Surcharge
    let utilSurchargeRate = 0
    let utilMsg = "未触发 (周数不足或豁免)"
    
    if (!isNewSeller && totalVolume >= 25 && utilWeeks > 22) {
      const tier = UTIL_SURCHARGE_TIERS.find(t => utilWeeks >= t[0] && utilWeeks < t[1])
      if (tier) {
        utilSurchargeRate = (sizeTier === 'standard') ? tier[2] : tier[3]
        utilMsg = `费率: $${utilSurchargeRate}/ft³ (${utilWeeks}周)`
      }
    } else if (isNewSeller) {
      utilMsg = "已豁免 (新卖家或体积过小)"
    } else if (totalVolume < 25) {
      utilMsg = "未触发 (总体积 < 25 ft³)"
    }
    const totalUtilFee = totalVolume * utilSurchargeRate

    // Aged Inventory Surcharge
    const policyDate = new Date('2026-01-16')
    const isPost2026 = date >= policyDate
    const agedTable = isPost2026 ? AGED_RATES_POST_2026 : AGED_RATES_PRE_2026
    
    let agedFeeTotal = 0
    let agedMsg = "库龄 < 181天，无附加费"
    
    const agedTier = agedTable.find(t => ageDays >= t.min && ageDays <= t.max)
    if (agedTier && agedTier.fee > 0) {
      if (category === 'clothing' && ageDays >= 181 && ageDays <= 270) {
        agedMsg = "服装类豁免 (库龄 181-270天)"
      } else {
        const volFee = cubicFeetPerUnit * agedTier.fee
        let unitFee = 0
        if (agedTier.minUnit) {
          unitFee = agedTier.minUnit
        }
        const agedFeePerUnit = Math.max(volFee, unitFee)
        agedFeeTotal = agedFeePerUnit * qty
        
        if (unitFee > volFee) {
          agedMsg = `按件收费 (库龄 ${ageDays}天, 费率 $${unitFee}/件)`
        } else {
          agedMsg = `按体积收费 (库龄 ${ageDays}天, 费率 $${agedTier.fee}/ft³)`
        }
      }
    }

    const grandTotal = totalBaseFee + totalUtilFee + agedFeeTotal

    // Logic Log
    const logHtml = `
      <p>1. 单件体积: ${cubicFeetPerUnit.toFixed(4)} ft³ (总: ${totalVolume.toFixed(2)} ft³)</p>
      <p>2. 基础费率: $${baseRate}/ft³ (${season === 'peak' ? '旺季' : '淡季'})</p>
      <p>3. 利用率附加费: ${utilSurchargeRate > 0 ? `+$${utilSurchargeRate}/ft³` : '无'}</p>
      <p>4. 超龄判定: ${agedMsg}</p>
    `

    setResults({
      totalFee: grandTotal,
      perUnitFee: qty > 0 ? grandTotal / qty : 0,
      sizeTier: sizeTier === 'standard' ? '标准尺寸' : '大件商品',
      volume: totalVolume,
      season: season === 'peak' ? '旺季 (10-12月)' : '淡季 (1-9月)',
      policyYear: isPost2026 ? '适用 2026 新政' : '适用 2024/2025 政策',
      baseFee: totalBaseFee,
      utilFee: totalUtilFee,
      utilMsg: utilMsg,
      agedFee: agedFeeTotal,
      agedMsg: agedMsg,
      logicHtml: logHtml
    })

    updateChart(totalBaseFee, totalUtilFee, agedFeeTotal)

    if (saveToHistory) {
      addToHistory({
        date: new Date().toLocaleString(),
        inputs: {
          calcDate, quantity, length, width, height, weight, category, ageDays, utilWeeks, isNewSeller
        },
        results: {
          total: grandTotal,
          size: sizeTier
        }
      })
    }
  }

  // History Management
  const HISTORY_KEY = 'fba_calc_history_v1'

  const loadHistoryList = () => {
    const h = JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]')
    setHistory(h)
  }

  const addToHistory = (record: any) => {
    let h = JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]')
    h.unshift(record)
    if (h.length > 20) h = h.slice(0, 20)
    localStorage.setItem(HISTORY_KEY, JSON.stringify(h))
    setHistory(h)
  }

  const deleteHistoryItem = (index: number) => {
    let h = [...history]
    h.splice(index, 1)
    localStorage.setItem(HISTORY_KEY, JSON.stringify(h))
    setHistory(h)
  }

  const clearHistory = () => {
    if(confirm('确定要清空所有历史记录吗？')) {
      localStorage.removeItem(HISTORY_KEY)
      setHistory([])
    }
  }

  const loadHistoryItem = (item: any) => {
    const i = item.inputs
    setCalcDate(i.calcDate)
    setQuantity(i.quantity)
    setLength(i.length)
    setWidth(i.width)
    setHeight(i.height)
    setWeight(i.weight)
    setCategory(i.category)
    setAgeDays(i.ageDays)
    setUtilWeeks(i.utilWeeks)
    setIsNewSeller(i.isNewSeller)
    // We can't immediately trigger calculation with new state because state updates are async
    // But we can trigger it in useEffect or just let the user click calculate.
    // The original app calls calculateFees(false) immediately.
    // We'll rely on the user clicking "Calculate" or we can add a flag to trigger calc.
    // Actually, let's just update the state and the user can see the values.
  }

  useEffect(() => {
    loadHistoryList()
    calculateFees(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="md:flex md:items-center md:justify-between">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2">
            <div className="p-2 bg-blue-50 rounded-lg">
              <Warehouse className="h-6 w-6 text-blue-600" />
            </div>
            <h2 className="text-xl font-bold text-gray-800">亚马逊 FBA 全能仓储费计算器</h2>
          </div>
          <p className="mt-1 text-sm text-gray-500">
            集成月度仓储费、利用率附加费及超龄库存附加费（含2026新规）
          </p>
        </div>
        <div className="mt-4 flex md:mt-0 md:ml-4">
            <details className="relative inline-block text-left group">
                <summary className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none cursor-pointer">
                    <Info className="h-4 w-4 mr-2" />
                    功能介绍与逻辑
                </summary>
                <div className="origin-top-right absolute right-0 mt-2 w-96 rounded-md shadow-lg bg-white ring-1 ring-black ring-opacity-5 focus:outline-none z-10 p-4 hidden group-open:block">
                    <h4 className="text-sm font-bold text-gray-900 mb-2">功能介绍</h4>
                    <p className="text-xs text-gray-600 mb-3">
                        本工具用于计算亚马逊 FBA 的综合仓储成本，包含月度仓储费、仓储利用率附加费及超龄库存附加费。
                    </p>
                    <h4 className="text-sm font-bold text-gray-900 mb-2">核心逻辑</h4>
                    <ul className="text-xs text-gray-600 list-disc pl-4 space-y-1">
                        <li><strong>尺寸分段</strong>：基于发货重量（取实重与体积重较大值），并应用最小 2 英寸规则。</li>
                        <li><strong>月度仓储费</strong>：自动区分旺季（10-12月）与淡季，支持危险品费率。</li>
                        <li><strong>利用率附加费</strong>：仅针对专业账户且仓储利用率超标（&gt;22周）的卖家。</li>
                        <li><strong>超龄库存</strong>：支持 2026 年新规（366-455天分段），并包含服装类 181-270 天豁免规则。</li>
                    </ul>
                </div>
            </details>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Inputs */}
        <div className="lg:col-span-1 space-y-6">
          
          {/* Section 1: 商品信息 */}
          <Card className="p-5 space-y-4">
            <h3 className="text-lg font-medium text-gray-900 border-b pb-2">1. 商品基础信息</h3>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-sm font-medium text-gray-700">计算日期</label>
                <input 
                  type="date" 
                  value={calcDate}
                  onChange={(e) => setCalcDate(e.target.value)}
                  className="w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm border p-2" 
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium text-gray-700">库存数量 (件)</label>
                <input 
                  type="number" 
                  value={quantity}
                  onChange={(e) => setQuantity(Number(e.target.value))}
                  min="1"
                  className="w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm border p-2" 
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div className="space-y-1">
                <label className="text-sm font-medium text-gray-700">长 (英寸)</label>
                <input 
                  type="number" 
                  value={length}
                  onChange={(e) => setLength(Number(e.target.value))}
                  step="0.1"
                  className="w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm border p-2" 
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium text-gray-700">宽 (英寸)</label>
                <input 
                  type="number" 
                  value={width}
                  onChange={(e) => setWidth(Number(e.target.value))}
                  step="0.1"
                  className="w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm border p-2" 
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium text-gray-700">高 (英寸)</label>
                <input 
                  type="number" 
                  value={height}
                  onChange={(e) => setHeight(Number(e.target.value))}
                  step="0.1"
                  className="w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm border p-2" 
                />
              </div>
            </div>
            
            <div className="space-y-1">
              <label className="text-sm font-medium text-gray-700">单件重量 (磅 lbs)</label>
              <input 
                type="number" 
                value={weight}
                onChange={(e) => setWeight(Number(e.target.value))}
                step="0.01"
                className="w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm border p-2" 
              />
            </div>

            <div className="space-y-1">
              <label className="text-sm font-medium text-gray-700">商品类型</label>
              <select 
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm border p-2"
              >
                <option value="standard">一般商品 (非危险品)</option>
                <option value="dangerous">危险品</option>
                <option value="clothing">服装/鞋靴 (部分附加费豁免)</option>
              </select>
            </div>
          </Card>

          {/* Section 2: 仓储状态 */}
          <Card className="p-5 space-y-4">
            <h3 className="text-lg font-medium text-gray-900 border-b pb-2">2. 仓储状态设定</h3>
            
            <div className="space-y-1">
              <label className="flex justify-between text-sm font-medium text-gray-700">
                <span>当前库龄 (天)</span>
                <span className="text-xs text-gray-400">决定超龄附加费</span>
              </label>
              <input 
                type="number" 
                value={ageDays}
                onChange={(e) => setAgeDays(Number(e.target.value))}
                className="w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm border p-2" 
                placeholder="例如: 366"
              />
            </div>

            <div className="space-y-1">
              <label className="flex justify-between text-sm font-medium text-gray-700">
                <span>仓储利用率 (周)</span>
                <span className="text-xs text-gray-400">决定利用率附加费</span>
              </label>
              <input 
                type="number" 
                value={utilWeeks}
                onChange={(e) => setUtilWeeks(Number(e.target.value))}
                className="w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm border p-2" 
                placeholder="例如: 25"
              />
              <p className="text-xs text-gray-500 mt-1">
                * 数据来源：请在亚马逊卖家后台 FBA 仪表盘中查看“仓储利用率”指标。<br/>
                * 仅当您的首单发货超过365天且日均体积&gt;25立方英尺时适用。
              </p>
            </div>

            <div className="flex items-start">
              <div className="flex items-center h-5">
                <input 
                  id="isNewSeller" 
                  type="checkbox" 
                  checked={isNewSeller}
                  onChange={(e) => setIsNewSeller(e.target.checked)}
                  className="focus:ring-indigo-500 h-4 w-4 text-indigo-600 border-gray-300 rounded"
                />
              </div>
              <div className="ml-3 text-sm">
                <label htmlFor="isNewSeller" className="font-medium text-gray-700">豁免条件</label>
                <p className="text-gray-500">我是新卖家(首单&lt;365天) 或 日均体积&lt;25立方英尺</p>
              </div>
            </div>
          </Card>

          <Card className="p-5">
            <button 
              type="button" 
              onClick={() => calculateFees(true)}
              className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            >
              立即计算
            </button>
          </Card>

        </div>

        {/* Right Column: Results */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Top Stats */}
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
            <Card className="px-4 py-5 sm:p-6 border-l-4 border-blue-500">
              <dt className="text-sm font-medium text-gray-500 truncate">总计月度费用</dt>
              <dd className="mt-1 text-2xl font-bold text-blue-600">${results.totalFee.toFixed(2)}</dd>
              <dd className="text-xs text-gray-500 mt-1">每件成本: <span>${results.perUnitFee.toFixed(2)}</span></dd>
            </Card>
            <Card className="px-4 py-5 sm:p-6 border-l-4 border-green-500">
              <dt className="text-sm font-medium text-gray-500 truncate">尺寸分段</dt>
              <dd className="mt-1 text-lg font-bold text-gray-900">{results.sizeTier}</dd>
              <dd className="text-xs text-gray-500 mt-1">体积: <span>{results.volume.toFixed(2)}</span> ft³</dd>
            </Card>
            <Card className="px-4 py-5 sm:p-6 border-l-4 border-orange-500">
              <dt className="text-sm font-medium text-gray-500 truncate">当前费率季节</dt>
              <dd className="mt-1 text-lg font-bold text-gray-900">{results.season}</dd>
              <dd className="text-xs text-gray-500 mt-1">{results.policyYear}</dd>
            </Card>
          </div>

          {/* Breakdown & Chart */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Table */}
            <Card className="p-5">
              <h3 className="text-lg font-medium text-gray-900 mb-4">费用明细表</h3>
              <div className="flow-root">
                <ul role="list" className="divide-y divide-gray-200">
                  <li className="py-3 flex justify-between">
                    <div className="text-sm font-medium text-gray-900">基本月度仓储费</div>
                    <div className="text-sm text-gray-500">${results.baseFee.toFixed(2)}</div>
                  </li>
                  <li className="py-3 flex justify-between">
                    <div className="text-sm font-medium text-gray-900">
                      仓储利用率附加费
                      <span className="block text-xs text-gray-400 font-normal">{results.utilMsg}</span>
                    </div>
                    <div className="text-sm text-red-500">${results.utilFee.toFixed(2)}</div>
                  </li>
                  <li className="py-3 flex justify-between bg-red-50 -mx-5 px-5">
                    <div className="text-sm font-medium text-red-800">
                      超龄库存附加费
                      <span className="block text-xs text-red-600 font-normal">{results.agedMsg}</span>
                    </div>
                    <div className="text-sm font-bold text-red-700">${results.agedFee.toFixed(2)}</div>
                  </li>
                  <li className="py-3 flex justify-between border-t-2 border-gray-200 mt-2">
                    <div className="text-base font-bold text-gray-900">总计</div>
                    <div className="text-base font-bold text-indigo-600">${results.totalFee.toFixed(2)}</div>
                  </li>
                </ul>
              </div>
            </Card>

            {/* Chart */}
            <Card className="p-5 flex flex-col items-center justify-center">
              <h3 className="text-lg font-medium text-gray-900 mb-2 w-full text-left">成本构成</h3>
              <div className="w-64 h-64">
                <canvas ref={chartRef}></canvas>
              </div>
            </Card>
          </div>

          {/* Logic Explanation */}
          <Card className="p-5 bg-gray-50">
            <h4 className="text-sm font-bold text-gray-700 uppercase tracking-wider mb-2">计算逻辑说明</h4>
            <div className="text-xs text-gray-600 space-y-1" dangerouslySetInnerHTML={{ __html: results.logicHtml || '<p>等待计算...</p>' }}>
            </div>
          </Card>

          {/* History Section */}
          <Card className="p-5">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-medium text-gray-900 flex items-center gap-2">
                <History className="h-5 w-5" />
                计算历史记录
              </h3>
              <button onClick={clearHistory} className="text-xs text-red-600 hover:text-red-800 underline">清空历史</button>
            </div>
            <div className="max-h-60 overflow-y-auto">
              {history.length === 0 ? (
                <p className="text-sm text-gray-500 text-center py-4">暂无历史记录</p>
              ) : (
                <ul className="divide-y divide-gray-100">
                  {history.map((item, index) => (
                    <li key={index} className="py-2 flex justify-between items-center hover:bg-gray-50 cursor-pointer p-2 rounded transition group">
                      <div onClick={() => loadHistoryItem(item)} className="flex-1">
                        <p className="text-xs font-bold text-gray-900">${item.results.total.toFixed(2)}</p>
                        <p className="text-xs text-gray-500">{item.date}</p>
                      </div>
                      <div className="flex items-center space-x-2">
                        <div className="text-right" onClick={() => loadHistoryItem(item)}>
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800">
                            {item.results.size === 'standard' ? '标准' : '大件'}
                          </span>
                          <p className="text-xs text-indigo-600 mt-1">点击回填</p>
                        </div>
                        <button 
                          onClick={(e) => { e.stopPropagation(); deleteHistoryItem(index) }} 
                          className="text-gray-400 hover:text-red-500 p-1 rounded-full hover:bg-red-50 transition" 
                          title="删除此记录"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <p className="text-xs text-gray-400 mt-2 text-center">记录仅保存在本地浏览器中</p>
          </Card>

          {/* 1. Monthly Storage Fee Rates */}
          <details className="bg-white overflow-hidden shadow rounded-lg group">
              <summary className="p-4 font-medium cursor-pointer flex justify-between items-center bg-gray-50 hover:bg-gray-100 transition">
                  <span className="text-xl font-bold text-gray-900 flex items-center gap-2">
                    <Package className="h-5 w-5" />
                    费用规则参考表
                  </span>
                  <span className="text-xs text-gray-500 group-open:hidden">点击查看详情</span>
                  <ChevronDown className="h-5 w-5 text-gray-400 hidden group-open:block" />
              </summary>
              <div className="p-4 border-t space-y-6">
                  {/* Standard Size, Non-Peak */}
                  <div>
                      <h4 className="text-sm font-bold text-gray-700 mb-2">1. 非危险品 - 淡季 (1月 - 9月)</h4>
                      <div className="overflow-x-auto">
                          <table className="min-w-full divide-y divide-gray-200 text-xs text-center">
                              <thead className="bg-gray-50 font-medium text-gray-500">
                                  <tr>
                                      <th className="px-2 py-2 text-left" rowSpan={2}>仓储利用率</th>
                                      <th className="px-2 py-2 border-l" colSpan={3}>标准尺寸</th>
                                      <th className="px-2 py-2 border-l" colSpan={3}>大件商品</th>
                                  </tr>
                                  <tr>
                                      <th className="px-2 py-1 border-l">基本费</th>
                                      <th className="px-2 py-1">附加费</th>
                                      <th className="px-2 py-1 bg-gray-100 font-bold">总计</th>
                                      <th className="px-2 py-1 border-l">基本费</th>
                                      <th className="px-2 py-1">附加费</th>
                                      <th className="px-2 py-1 bg-gray-100 font-bold">总计</th>
                                  </tr>
                              </thead>
                              <tbody className="divide-y divide-gray-200">
                                  <tr>
                                      <td className="px-2 py-2 text-left">22 周以内 / 豁免</td>
                                      <td className="px-2 py-2 border-l text-gray-500">$0.78</td>
                                      <td className="px-2 py-2 text-gray-400">-</td>
                                      <td className="px-2 py-2 bg-gray-50 font-bold">$0.78</td>
                                      <td className="px-2 py-2 border-l text-gray-500">$0.56</td>
                                      <td className="px-2 py-2 text-gray-400">-</td>
                                      <td className="px-2 py-2 bg-gray-50 font-bold">$0.56</td>
                                  </tr>
                                  <tr>
                                      <td className="px-2 py-2 text-left">22 ~ 28 周</td>
                                      <td className="px-2 py-2 border-l text-gray-500">$0.78</td>
                                      <td className="px-2 py-2 text-red-500">$0.44</td>
                                      <td className="px-2 py-2 bg-gray-50 font-bold">$1.22</td>
                                      <td className="px-2 py-2 border-l text-gray-500">$0.56</td>
                                      <td className="px-2 py-2 text-red-500">$0.23</td>
                                      <td className="px-2 py-2 bg-gray-50 font-bold">$0.79</td>
                                  </tr>
                                  <tr>
                                      <td className="px-2 py-2 text-left">28 ~ 36 周</td>
                                      <td className="px-2 py-2 border-l text-gray-500">$0.78</td>
                                      <td className="px-2 py-2 text-red-500">$0.76</td>
                                      <td className="px-2 py-2 bg-gray-50 font-bold">$1.54</td>
                                      <td className="px-2 py-2 border-l text-gray-500">$0.56</td>
                                      <td className="px-2 py-2 text-red-500">$0.46</td>
                                      <td className="px-2 py-2 bg-gray-50 font-bold">$1.02</td>
                                  </tr>
                                  <tr>
                                      <td className="px-2 py-2 text-left">36 ~ 44 周</td>
                                      <td className="px-2 py-2 border-l text-gray-500">$0.78</td>
                                      <td className="px-2 py-2 text-red-500">$1.16</td>
                                      <td className="px-2 py-2 bg-gray-50 font-bold">$1.94</td>
                                      <td className="px-2 py-2 border-l text-gray-500">$0.56</td>
                                      <td className="px-2 py-2 text-red-500">$0.63</td>
                                      <td className="px-2 py-2 bg-gray-50 font-bold">$1.19</td>
                                  </tr>
                                  <tr>
                                      <td className="px-2 py-2 text-left">44 ~ 52 周</td>
                                      <td className="px-2 py-2 border-l text-gray-500">$0.78</td>
                                      <td className="px-2 py-2 text-red-500">$1.58</td>
                                      <td className="px-2 py-2 bg-gray-50 font-bold">$2.36</td>
                                      <td className="px-2 py-2 border-l text-gray-500">$0.56</td>
                                      <td className="px-2 py-2 text-red-500">$0.76</td>
                                      <td className="px-2 py-2 bg-gray-50 font-bold">$1.32</td>
                                  </tr>
                                  <tr>
                                      <td className="px-2 py-2 text-left">超过 52 周</td>
                                      <td className="px-2 py-2 border-l text-gray-500">$0.78</td>
                                      <td className="px-2 py-2 text-red-500">$1.88</td>
                                      <td className="px-2 py-2 bg-gray-50 font-bold">$2.66</td>
                                      <td className="px-2 py-2 border-l text-gray-500">$0.56</td>
                                      <td className="px-2 py-2 text-red-500">$1.26</td>
                                      <td className="px-2 py-2 bg-gray-50 font-bold">$1.82</td>
                                  </tr>
                                  <tr className="bg-green-50">
                                      <td className="px-2 py-2 text-left font-medium text-green-800">豁免卖家*</td>
                                      <td className="px-2 py-2 border-l text-green-700">$0.78</td>
                                      <td className="px-2 py-2 text-gray-400">不适用</td>
                                      <td className="px-2 py-2 font-bold text-green-800">$0.78</td>
                                      <td className="px-2 py-2 border-l text-green-700">$0.56</td>
                                      <td className="px-2 py-2 text-gray-400">不适用</td>
                                      <td className="px-2 py-2 font-bold text-green-800">$0.56</td>
                                  </tr>
                              </tbody>
                              <tfoot className="bg-gray-50">
                                  <tr>
                                      <td colSpan={7} className="px-2 py-1 text-left text-xs text-gray-500 italic">
                                          * 豁免卖家：新卖家(&lt;365天)、个人计划或日均体积≤25 ft³
                                      </td>
                                  </tr>
                              </tfoot>
                          </table>
                      </div>
                  </div>

                  {/* Non-Dangerous, Peak */}
                  <div>
                      <h4 className="text-sm font-bold text-orange-700 mb-2">2. 非危险品 - 旺季 (10月 - 12月)</h4>
                      <div className="overflow-x-auto">
                          <table className="min-w-full divide-y divide-orange-200 text-xs text-center border border-orange-200">
                              <thead className="bg-orange-50 font-medium text-orange-800">
                                  <tr>
                                      <th className="px-2 py-2 text-left" rowSpan={2}>仓储利用率</th>
                                      <th className="px-2 py-2 border-l border-orange-200" colSpan={3}>标准尺寸</th>
                                      <th className="px-2 py-2 border-l border-orange-200" colSpan={3}>大件商品</th>
                                  </tr>
                                  <tr>
                                      <th className="px-2 py-1 border-l border-orange-200">基本费</th>
                                      <th className="px-2 py-1">附加费</th>
                                      <th className="px-2 py-1 bg-orange-100 font-bold">总计</th>
                                      <th className="px-2 py-1 border-l border-orange-200">基本费</th>
                                      <th className="px-2 py-1">附加费</th>
                                      <th className="px-2 py-1 bg-orange-100 font-bold">总计</th>
                                  </tr>
                              </thead>
                              <tbody className="divide-y divide-orange-200 bg-white">
                                  <tr>
                                      <td className="px-2 py-2 text-left">22 周以内 / 豁免</td>
                                      <td className="px-2 py-2 border-l border-orange-200 text-gray-500">$2.40</td>
                                      <td className="px-2 py-2 text-gray-400">-</td>
                                      <td className="px-2 py-2 bg-orange-50 font-bold">$2.40</td>
                                      <td className="px-2 py-2 border-l border-orange-200 text-gray-500">$1.40</td>
                                      <td className="px-2 py-2 text-gray-400">-</td>
                                      <td className="px-2 py-2 bg-orange-50 font-bold">$1.40</td>
                                  </tr>
                                  <tr>
                                      <td className="px-2 py-2 text-left">22 ~ 28 周</td>
                                      <td className="px-2 py-2 border-l border-orange-200 text-gray-500">$2.40</td>
                                      <td className="px-2 py-2 text-red-500">$0.44</td>
                                      <td className="px-2 py-2 bg-orange-50 font-bold">$2.84</td>
                                      <td className="px-2 py-2 border-l border-orange-200 text-gray-500">$1.40</td>
                                      <td className="px-2 py-2 text-red-500">$0.23</td>
                                      <td className="px-2 py-2 bg-orange-50 font-bold">$1.63</td>
                                  </tr>
                                  <tr>
                                      <td className="px-2 py-2 text-left">28 ~ 36 周</td>
                                      <td className="px-2 py-2 border-l border-orange-200 text-gray-500">$2.40</td>
                                      <td className="px-2 py-2 text-red-500">$0.76</td>
                                      <td className="px-2 py-2 bg-orange-50 font-bold">$3.16</td>
                                      <td className="px-2 py-2 border-l border-orange-200 text-gray-500">$1.40</td>
                                      <td className="px-2 py-2 text-red-500">$0.46</td>
                                      <td className="px-2 py-2 bg-orange-50 font-bold">$1.86</td>
                                  </tr>
                                  <tr>
                                      <td className="px-2 py-2 text-left">36 ~ 44 周</td>
                                      <td className="px-2 py-2 border-l border-orange-200 text-gray-500">$2.40</td>
                                      <td className="px-2 py-2 text-red-500">$1.16</td>
                                      <td className="px-2 py-2 bg-orange-50 font-bold">$3.56</td>
                                      <td className="px-2 py-2 border-l border-orange-200 text-gray-500">$1.40</td>
                                      <td className="px-2 py-2 text-red-500">$0.63</td>
                                      <td className="px-2 py-2 bg-orange-50 font-bold">$2.03</td>
                                  </tr>
                                  <tr>
                                      <td className="px-2 py-2 text-left">44 ~ 52 周</td>
                                      <td className="px-2 py-2 border-l border-orange-200 text-gray-500">$2.40</td>
                                      <td className="px-2 py-2 text-red-500">$1.58</td>
                                      <td className="px-2 py-2 bg-orange-50 font-bold">$3.98</td>
                                      <td className="px-2 py-2 border-l border-orange-200 text-gray-500">$1.40</td>
                                      <td className="px-2 py-2 text-red-500">$0.76</td>
                                      <td className="px-2 py-2 bg-orange-50 font-bold">$2.16</td>
                                  </tr>
                                  <tr>
                                      <td className="px-2 py-2 text-left">超过 52 周</td>
                                      <td className="px-2 py-2 border-l border-orange-200 text-gray-500">$2.40</td>
                                      <td className="px-2 py-2 text-red-500">$1.88</td>
                                      <td className="px-2 py-2 bg-orange-50 font-bold">$4.28</td>
                                      <td className="px-2 py-2 border-l border-orange-200 text-gray-500">$1.40</td>
                                      <td className="px-2 py-2 text-red-500">$1.26</td>
                                      <td className="px-2 py-2 bg-orange-50 font-bold">$2.66</td>
                                  </tr>
                                  <tr className="bg-green-50">
                                      <td className="px-2 py-2 text-left font-medium text-green-800">豁免卖家*</td>
                                      <td className="px-2 py-2 border-l border-green-200 text-green-700">$2.40</td>
                                      <td className="px-2 py-2 text-gray-400">不适用</td>
                                      <td className="px-2 py-2 font-bold text-green-800">$2.40</td>
                                      <td className="px-2 py-2 border-l border-green-200 text-green-700">$1.40</td>
                                      <td className="px-2 py-2 text-gray-400">不适用</td>
                                      <td className="px-2 py-2 font-bold text-green-800">$1.40</td>
                                  </tr>
                              </tbody>
                              <tfoot className="bg-orange-50">
                                  <tr>
                                      <td colSpan={7} className="px-2 py-1 text-left text-xs text-orange-800 italic">
                                          * 豁免卖家：新卖家(&lt;365天)、个人计划或日均体积≤25 ft³
                                      </td>
                                  </tr>
                              </tfoot>
                          </table>
                      </div>
                  </div>

                  {/* Dangerous Goods */}
                  <div>
                      <h4 className="text-sm font-bold text-gray-700 mb-2">3. 危险品 (无利用率附加费)</h4>
                      <div className="overflow-x-auto">
                          <table className="min-w-full divide-y divide-gray-200 text-xs text-left">
                              <thead className="bg-gray-50">
                                  <tr>
                                      <th className="px-3 py-2">月份</th>
                                      <th className="px-3 py-2">标准尺寸 (每 ft³)</th>
                                      <th className="px-3 py-2">大件商品 (每 ft³)</th>
                                  </tr>
                              </thead>
                              <tbody className="divide-y divide-gray-200">
                                  <tr>
                                      <td className="px-3 py-2">1月 - 9月 (淡季)</td>
                                      <td className="px-3 py-2">$0.99</td>
                                      <td className="px-3 py-2">$0.78</td>
                                  </tr>
                                  <tr className="bg-orange-50">
                                      <td className="px-3 py-2 text-orange-800">10月 - 12月 (旺季)</td>
                                      <td className="px-3 py-2 text-orange-800">$3.63</td>
                                      <td className="px-3 py-2 text-orange-800">$2.43</td>
                                  </tr>
                              </tbody>
                          </table>
                      </div>
                  </div>
              </div>
          </details>

          {/* 2. Aged Inventory Surcharge */}
          <details className="bg-white overflow-hidden shadow rounded-lg group mt-4">
              <summary className="p-4 font-medium cursor-pointer flex justify-between items-center bg-gray-50 hover:bg-gray-100 transition">
                  <span className="flex items-center gap-2">
                    <History className="h-5 w-5 text-gray-600" />
                    <span>超龄库存附加费率 (每立方英尺)</span>
                  </span>
                  <span className="text-xs text-gray-500 group-open:hidden">点击查看详情</span>
                  <ChevronDown className="h-5 w-5 text-gray-400 hidden group-open:block" />
              </summary>
              <div className="p-4 border-t space-y-6">
                  
                  {/* Pre 2026 */}
                  <div>
                      <h4 className="text-sm font-bold text-gray-700 mb-2">1. 2026年1月16日 之前</h4>
                      <div className="overflow-x-auto">
                          <table className="min-w-full divide-y divide-gray-200 text-xs text-center">
                              <thead className="bg-gray-50 font-medium text-gray-500">
                                  <tr>
                                      <th className="px-2 py-2 text-left">库龄 (天)</th>
                                      <th className="px-2 py-2">181-210</th>
                                      <th className="px-2 py-2">211-240</th>
                                      <th className="px-2 py-2">241-270</th>
                                      <th className="px-2 py-2">271-300</th>
                                      <th className="px-2 py-2">301-330</th>
                                      <th className="px-2 py-2">331-365</th>
                                      <th className="px-2 py-2 bg-red-50 text-red-700 font-bold">366+</th>
                                  </tr>
                              </thead>
                              <tbody className="divide-y divide-gray-200">
                                  <tr>
                                      <td className="px-2 py-2 text-left font-medium">费率 ($/ft³)</td>
                                      <td className="px-2 py-2">$0.50*</td>
                                      <td className="px-2 py-2">$1.00*</td>
                                      <td className="px-2 py-2">$1.50*</td>
                                      <td className="px-2 py-2">$5.45</td>
                                      <td className="px-2 py-2">$5.70</td>
                                      <td className="px-2 py-2">$5.90</td>
                                      <td className="px-2 py-2 bg-red-50 font-bold">$6.90</td>
                                  </tr>
                              </tbody>
                              <tfoot className="bg-gray-50">
                                  <tr>
                                      <td colSpan={8} className="px-2 py-1 text-left text-gray-500 italic">
                                          * 服装、鞋靴类商品豁免 181-270 天的超龄附加费
                                      </td>
                                  </tr>
                              </tfoot>
                          </table>
                      </div>
                  </div>

                  {/* Post 2026 */}
                  <div>
                      <h4 className="text-sm font-bold text-red-700 mb-2">2. 2026年1月16日 之后 (新规)</h4>
                      <div className="overflow-x-auto">
                          <table className="min-w-full divide-y divide-red-200 text-xs text-center border border-red-200">
                              <thead className="bg-red-50 font-medium text-red-800">
                                  <tr>
                                      <th className="px-2 py-2 text-left">库龄 (天)</th>
                                      <th className="px-2 py-2">181-210</th>
                                      <th className="px-2 py-2">211-240</th>
                                      <th className="px-2 py-2">241-270</th>
                                      <th className="px-2 py-2">271-300</th>
                                      <th className="px-2 py-2">301-330</th>
                                      <th className="px-2 py-2">331-365</th>
                                      <th className="px-2 py-2 font-bold">366-455</th>
                                      <th className="px-2 py-2 bg-red-100 font-bold">455+</th>
                                  </tr>
                              </thead>
                              <tbody className="divide-y divide-red-200 bg-white">
                                  <tr>
                                      <td className="px-2 py-2 text-left font-medium">费率 ($/ft³)</td>
                                      <td className="px-2 py-2">$0.50*</td>
                                      <td className="px-2 py-2">$1.00*</td>
                                      <td className="px-2 py-2">$1.50*</td>
                                      <td className="px-2 py-2">$5.45</td>
                                      <td className="px-2 py-2">$5.70</td>
                                      <td className="px-2 py-2">$5.90</td>
                                      <td className="px-2 py-2 font-bold">$6.90</td>
                                      <td className="px-2 py-2 bg-red-100 font-bold">$10.00</td>
                                  </tr>
                              </tbody>
                              <tfoot className="bg-red-50">
                                  <tr>
                                      <td colSpan={9} className="px-2 py-1 text-left text-red-800 italic">
                                          * 新增 366-455 天分段 ($6.90)，455天以上涨至 $10.00
                                      </td>
                                  </tr>
                              </tfoot>
                          </table>
                      </div>
                  </div>
              </div>
          </details>

        </div>
      </div>
    </div>
  )
}

export default StorageFeeCalculatorPage
