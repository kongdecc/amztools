'use client'

import React, { useState, useEffect } from 'react'
import { Calculator, Save, Trash2, RotateCcw, HelpCircle, ChevronDown, Info, Settings, TrendingUp, Target, Crosshair } from 'lucide-react'

// --- Constants & Data ---

// Commission Rules
const COMM_RULES: Record<string, any> = {
  "亚马逊设备配件 (Amazon Device Accessories)": { type: 0, rate: 0.45, min: 0.30 },
  "汽车和户外动力设备 (Automotive & Powersports)": { type: 0, rate: 0.12, min: 0.30 },
  "母婴 (Baby Products)": { type: 1, tiers: [[10, 0.08], [Infinity, 0.15]], min: 0.30 },
  "背包、手提包和箱包 (Backpacks, Handbags & Luggage)": { type: 0, rate: 0.15, min: 0.30 },
  "基础设备电动工具 (Base Equipment Power Tools)": { type: 0, rate: 0.12, min: 0.30 },
  "美妆和个护健康 (Beauty, Health & Personal Care)": { type: 1, tiers: [[10, 0.08], [Infinity, 0.15]], min: 0.30 },
  "商业、工业与科学用品 (Business, Industrial & Scientific Supplies)": { type: 0, rate: 0.12, min: 0.30 },
  "服装和配饰 (Clothing & Accessories)": { type: 1, tiers: [[15, 0.05], [20, 0.10], [Infinity, 0.17]], min: 0.30 },
  "小型电器 (Compact Appliances)": { type: 2, tiers: [[300, 0.15], [Infinity, 0.08]], min: 0.30 },
  "电脑 (Computers)": { type: 0, rate: 0.08, min: 0.30 },
  "消费类电子产品 (Consumer Electronics)": { type: 0, rate: 0.08, min: 0.30 },
  "电子产品配件 (Electronics Accessories)": { type: 2, tiers: [[100, 0.15], [Infinity, 0.08]], min: 0.30 },
  "眼镜 (Eyewear)": { type: 0, rate: 0.15, min: 0.30 },
  "艺术品 (Fine Art)": { type: 2, tiers: [[100, 0.20], [1000, 0.15], [5000, 0.10], [Infinity, 0.05]], min: 0 },
  "鞋靴 (Footwear)": { type: 0, rate: 0.15, min: 0.30 },
  "全尺寸电器 (Full-Size Appliances)": { type: 0, rate: 0.08, min: 0.30 },
  "家具 (Furniture)": { type: 2, tiers: [[200, 0.15], [Infinity, 0.10]], min: 0.30 },
  "礼品卡 (Gift Cards)": { type: 0, rate: 0.20, min: 0 },
  "食品 (Grocery & Gourmet Food)": { type: 1, tiers: [[15, 0.08], [Infinity, 0.15]], min: 0 },
  "家居及厨房用品 (Home & Kitchen)": { type: 0, rate: 0.15, min: 0.30 },
  "珠宝首饰 (Jewelry)": { type: 2, tiers: [[250, 0.20], [Infinity, 0.05]], min: 0.30 },
  "草坪和园艺 (Lawn & Garden)": { type: 0, rate: 0.15, min: 0.30 },
  "割草机和除雪机 (Lawn Mowers & Snow Throwers)": { type: 1, tiers: [[500, 0.15], [Infinity, 0.08]], min: 0.30 },
  "床垫 (Mattresses)": { type: 0, rate: 0.15, min: 0.30 },
  "媒介类商品 (Media)": { type: 0, rate: 0.15, min: 0 },
  "乐器和影音制作 (Musical Instruments & AV Production)": { type: 0, rate: 0.15, min: 0.30 },
  "办公用品 (Office Products)": { type: 0, rate: 0.15, min: 0.30 },
  "宠物用品 (Pet Supplies)": { type: 0, rate: 0.15, min: 0.30 },
  "运动户外 (Sports & Outdoors)": { type: 0, rate: 0.15, min: 0.30 },
  "轮胎 (Tires)": { type: 0, rate: 0.10, min: 0.30 },
  "工具和家居装修 (Tools & Home Improvement)": { type: 0, rate: 0.15, min: 0.30 },
  "玩具和游戏 (Toys & Games)": { type: 0, rate: 0.15, min: 0.30 },
  "视频游戏机 (Video Game Consoles)": { type: 0, rate: 0.08, min: 0 },
  "视频游戏和游戏配件 (Video Games & Accessories)": { type: 0, rate: 0.15, min: 0 },
  "钟表 (Watches)": { type: 2, tiers: [[1500, 0.16], [Infinity, 0.03]], min: 0.30 },
  "其他 (Everything Else)": { type: 0, rate: 0.15, min: 0.30 }
};

// FBA Fee Data
const FEE_DATA: any = {
  normal: {
    non_peak_2025: {
      ss: { steps:[2,4,6,8,10,12,14,16], lt10:[2.29,2.38,2.47,2.56,2.66,2.76,2.83,2.88], mid:[3.06,3.15,3.24,3.33,3.43,3.53,3.60,3.65] },
      ls: { steps:[4,8,12,16,20,24,28,32,36,40,44,48], lt10:[2.91,3.13,3.38,3.78,4.22,4.60,4.75,5.00,5.10,5.28,5.44,5.85], mid:[3.68,3.90,4.15,4.55,4.99,5.37,5.52,5.77,5.87,6.05,6.21,6.62], post:{lt10:6.15, mid:6.92}, inc:0.08 },
      so: { base:{lt10:8.84, mid:9.61}, per:0.38 },
      lo: { base:{lt10:8.84, mid:9.61}, per:0.38 },
      spl: { base:{lt10:25.56, mid:26.33}, per:0.38 }
    },
    non_peak_2026: {
      ss: { steps:[2,4,6,8,10,12,14,16], lt10:[2.43,2.49,2.56,2.66,2.77,2.82,2.92,2.95], mid:[3.32,3.42,3.45,3.54,3.68,3.78,3.91,3.96] },
      ls: { steps:[4,8,12,16,20,24,28,32,36,40,44,48], lt10:[2.91,3.13,3.38,3.78,4.22,4.60,4.75,5.00,5.10,5.28,5.44,5.85], mid:[3.73,3.95,4.20,4.60,5.04,5.42,5.57,5.82,5.92,6.10,6.26,6.67], post:{lt10:6.15, mid:6.97}, inc:0.08 },
      so: { base:{lt10:6.69, mid:7.55}, per:0.38 },
      lo: { base:{lt10:8.49, mid:9.35}, per:0.38 },
      spl: { base:{lt10:25.47, mid:26.33}, per:0.38 }
    },
    peak_2025: {
      ss: { steps:[2,4,6,8,10,12,14,16], lt10:[2.48,2.57,2.67,2.76,2.87,2.97,3.05,3.10], mid:[3.25,3.34,3.44,3.53,3.64,3.74,3.82,3.87] },
      ls: { steps:[4,8,12,16,20,24,28,32,36,40,44,48], lt10:[3.15,3.39,3.66,4.07,4.52,4.91,5.07,5.33,5.47,5.67,5.84,6.26], mid:[3.92,4.16,4.43,4.84,5.29,5.68,5.84,6.10,6.24,6.44,6.61,7.03], post:{lt10:6.69, mid:7.46}, inc:0.08 },
      so: { base:{lt10:9.88, mid:10.65}, per:0.38 },
      lo: { base:{lt10:9.88, mid:10.65}, per:0.38 },
      spl: { base:{lt10:28.29, mid:29.06}, per:0.38 }
    }
  },
  apparel: {
    non_peak_2025: {
       ss: { steps:[2,4,6,8,10,12,14,16], lt10:[2.50,2.50,2.65,2.65,2.95,2.95,3.21,3.21], mid:[3.27,3.27,3.42,3.42,3.72,3.72,3.98,3.98] },
       ls: { steps:[4,8,12,16,24,32,40,48], lt10:[3.48,3.68,3.90,4.35,5.13,5.13,5.37,5.37], mid:[4.25,4.45,4.67,5.12,5.90,5.90,6.14,6.14], post:{lt10:6.82, mid:6.97}, inc:0.16 }
    },
    non_peak_2026: {
       ss: { steps:[2,4,6,8,10,12,14,16], lt10:[2.62,2.64,2.68,2.81,3.00,3.10,3.20,3.30], mid:[3.51,3.54,3.59,3.69,3.91,4.09,4.20,4.25] },
       ls: { steps:[4,8,12,16,24,32,40,48], lt10:[3.48,3.68,3.90,4.35,5.05,5.22,5.32,5.43], mid:[4.30,4.50,4.72,5.17,5.87,6.04,6.14,6.25], post:{lt10:6.78, mid:6.97}, inc:0.16 }
    }
  }
};

// --- Helper Components ---

const Card = ({ children, className = "" }: any) => (
  <div className={`bg-white rounded-xl border border-gray-200 shadow-sm p-5 ${className}`}>{children}</div>
)

const TooltipIcon = ({ text }: { text: string }) => (
  <div className="group relative ml-1 cursor-pointer inline-block align-middle">
    <HelpCircle className="h-3 w-3 text-gray-400 hover:text-blue-500" />
    <div className="absolute bottom-full right-0 mb-2 w-56 p-2 bg-gray-800 text-white text-xs rounded shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50 whitespace-pre-wrap font-normal leading-relaxed">
      {text}
      <div className="absolute top-full right-1 -mt-1 border-4 border-transparent border-t-gray-800"></div>
    </div>
  </div>
)

const Label = ({ children, tooltip }: any) => (
  <label className="flex items-center justify-between text-xs font-semibold text-gray-500 mb-1.5">
    <span>{children}</span>
    {tooltip && <TooltipIcon text={tooltip} />}
  </label>
)

const InputGroup = ({ children }: any) => (
  <div className="flex gap-2 w-full">{children}</div>
)

const Input = (props: any) => (
  <input
    className={`w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm text-gray-800 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 hover:border-gray-400 shadow-sm transition-all ${props.className || ''}`}
    {...props}
  />
)

const Select = (props: any) => (
  <div className="relative inline-block">
    <select
      className={`block w-full px-3 py-2 pr-8 bg-white border border-gray-300 rounded-lg text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 appearance-none transition-all truncate ${props.className || ''}`}
      style={{ WebkitAppearance: 'none', MozAppearance: 'none', appearance: 'none', backgroundImage: 'none' }}
      {...props}
    >
      {props.children}
    </select>
    <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
  </div>
)

const ResultRow = ({ label, value, sub, highlight, danger, tooltip }: any) => (
  <div className={`flex justify-between items-center text-sm ${highlight ? 'pt-2 mt-2 border-t border-gray-200 font-bold' : 'mb-2'}`}>
    <div className="flex items-center gap-1">
      <span className={highlight ? 'text-gray-800' : 'text-gray-500'}>{label}</span>
      {tooltip && (
        <div className="group relative cursor-pointer">
          <HelpCircle className="h-3 w-3 text-gray-400 hover:text-blue-500" />
          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 p-2 bg-gray-800 text-white text-xs rounded shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50 whitespace-pre-wrap font-normal">
            {tooltip}
            <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 border-4 border-transparent border-t-gray-800"></div>
          </div>
        </div>
      )}
    </div>
    <div className="text-right">
      <div className={`font-mono ${highlight ? 'text-base text-blue-600' : 'text-gray-800'} ${danger ? '!text-red-500' : ''}`}>{value}</div>
      {sub && <div className="text-xs text-gray-400 font-normal">{sub}</div>}
    </div>
  </div>
)

// --- Main Component ---

export default function CpcCalculator() {
  // --- State ---
  const [m, setM] = useState({
    l: '', w: '', h: '', dim_unit: 'in',
    weight: '', weight_unit: 'oz',
    season: 'auto',
    category: '',
    type: 'normal',
    has_lithium: false,
    price: '',
    exchange_rate: '7.2'
  })

  const [c1, setC1] = useState({
    price: '',
    cost: '', cost_unit: 'RMB',
    ship: '', ship_unit: 'RMB',
    fba: '',
    comm: '',
    ret_rate: '5',
    ret_cost: '3',
    other_cost: '',
    cpc: '0.50'
  })

  const [c2, setC2] = useState({
    price: '',
    cost_total: '', cost_unit: 'RMB',
    fee_total: '',
    other_cost: '',
    cvr: '10',
    market_cpc: '1.20',
    strategy: 'custom',
    acos: '25',
    ad_share: '30'
  })

  const [results, setResults] = useState<any>({
    m: { tier: '--', weight: 0, fba: 0, comm: 0, commRate: '0%' },
    c1: { profit: 0, margin: 0, maxClicks: 0, minCVR: 0, beAcos: 0, warn: '' },
    c2: { recCPC: 0, safeCPC: 0, beCPC: 0, netProfit: 0, netMargin: 0, tacos: 0, warn: [] }
  })

  const [records, setRecords] = useState<Record<string, any>>({})
  const [saveName, setSaveName] = useState('')

  // --- Logic ---

  // Helpers
  const safeFloat = (v: any) => parseFloat(v) || 0
  const fmtMoney = (n: number) => '$' + n.toFixed(2)
  const fmtPct = (n: number) => n.toFixed(2) + '%'

  // Load Records
  useEffect(() => {
    try {
      const s = localStorage.getItem('cpc_compass_records')
      if (s) setRecords(JSON.parse(s))
    } catch {}
  }, [])

  // Save Records
  const saveRecord = () => {
    if (!saveName.trim()) { alert('请输入记录名称'); return }
    const newRecs = { ...records, [saveName]: { m, c1, c2, timestamp: Date.now() } }
    setRecords(newRecs)
    localStorage.setItem('cpc_compass_records', JSON.stringify(newRecs))
    alert('保存成功')
  }

  const loadRecord = (key: string) => {
    const r = records[key]
    if (r) {
      if (r.m) setM(r.m)
      if (r.c1) setC1(r.c1)
      if (r.c2) setC2(r.c2)
      setSaveName(key)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }

  const deleteRecord = (key: string) => {
    if (!confirm('确定删除?')) return
    const newRecs = { ...records }
    delete newRecs[key]
    setRecords(newRecs)
    localStorage.setItem('cpc_compass_records', JSON.stringify(newRecs))
  }

  const clearAll = () => {
    if (!confirm('确定清空?')) return
    setM({ ...m, l:'', w:'', h:'', weight:'', price:'' })
    setC1({ ...c1, price:'', cost:'', ship:'', fba:'', comm:'', cpc:'' })
    setC2({ ...c2, price:'', cost_total:'', fee_total:'', other_cost:'' })
  }

  // Calculations
  useEffect(() => {
    // --- Master Calc ---
    let l = safeFloat(m.l), w = safeFloat(m.w), h = safeFloat(m.h)
    if (m.dim_unit === 'cm') { l/=2.54; w/=2.54; h/=2.54 }
    
    let weight = safeFloat(m.weight)
    if (m.weight_unit === 'lb') weight *= 16
    if (m.weight_unit === 'g') weight /= 28.35
    
    const price = safeFloat(m.price)
    
    // Season
    let season = m.season
    if (season === 'auto') {
      const now = new Date()
      const mon = now.getMonth() + 1
      const year = now.getFullYear()
      const isPeak = (mon >= 10 || mon === 1)
      if (year >= 2026) season = 'non_peak_2026'
      else season = isPeak ? 'peak_2025' : 'non_peak_2025'
    }

    // FBA
    let fbaFee = 0, tierName = '--', shipWeight = 0
    if (l && w && h && weight) {
      // Sort dims: L is max, H is min
      const sorted = [l, w, h].sort((a,b) => b-a)
      const L = sorted[0], W = sorted[1], H = sorted[2]
      const girth = L + 2*W + 2*H
      const volWeight = (l * w * h) / 139 * 16
      
      // Helper to determine tier key
      const getTierKey = (wOz: number) => {
         const wLb = wOz / 16
         if (wOz <= 16 && L <= 15 && W <= 12 && H <= 0.75) return 'ss'
         if (wOz <= 320 && L <= 18 && W <= 14 && H <= 8) return 'ls'
         
         if (wLb > 150 || L > 108 || girth > 165) return 'spl'
         if (wLb <= 70 && L <= 60 && W <= 30 && girth <= 130) return 'so'
         if (wLb <= 50 && L <= 108 && girth <= 165) return 'lo'
         
         return 'spl'
      }

      // 1. Initial tier check with actual weight
      const initialTier = getTierKey(weight)
      
      // 2. Determine shipping weight
      // Rule: Use larger of actual or vol, EXCEPT for Small Standard (ss) and Special Oversize > 150lb (spl with weight > 2400oz)
      let finalWeight = weight
      if (!(initialTier === 'ss' || (initialTier === 'spl' && weight >= 2400))) {
         finalWeight = Math.max(weight, volWeight)
      }
      shipWeight = finalWeight

      // 3. Final tier
      const tier = getTierKey(shipWeight)
      
      const tierMap: any = { 
        ss: '小号标准尺寸', 
        ls: '大号标准尺寸', 
        so: '小号大件', 
        lo: '大号大件', 
        spl: '超大件' 
      }
      tierName = tierMap[tier] || tier.toUpperCase()
      
      let dataSet = FEE_DATA[m.type] || FEE_DATA['normal']
      let seasonData = dataSet[season] || FEE_DATA['normal']['non_peak_2025']
      const table = seasonData[tier]
      
      if (table) {
        // If sale price is empty/invalid, default to $10~$50 band to avoid underestimating FBA fee.
        const band = price > 0 && price < 10 ? 'lt10' : 'mid'
        if (tier === 'ss' || (tier === 'ls' && table.steps)) {
          const steps = table.steps
          const fees = table[band] || table['mid']
          let found = false
          for(let i=0; i<steps.length; i++) {
            if (shipWeight <= steps[i]) { fbaFee = fees[i]; found = true; break }
          }
          if (!found && tier === 'ls') {
             const base = table.post[band] || table.post.mid
             const excess = shipWeight - 48
             const unit = (m.type === 'apparel') ? 8 : 4
             fbaFee = base + Math.ceil(excess / unit) * table.inc
          }
        } else {
          const base = table.base[band] || table.base.mid
          const weightLb = shipWeight / 16
          fbaFee = base + Math.ceil(Math.max(0, weightLb-1)) * table.per
        }
      }
      if (m.has_lithium && m.type !== 'danger') fbaFee += 0.11
      fbaFee = fbaFee * 1.035
    }

    // Commission
    let commFee = 0, commRateStr = '0%'
    if (m.category && COMM_RULES[m.category]) {
      const rule = COMM_RULES[m.category]
      if (rule.type === 0) {
        commFee = price * rule.rate
        commRateStr = (rule.rate * 100).toFixed(2) + '%'
      } else if (rule.type === 1) {
        const tier = rule.tiers.find((t:any) => price <= t[0])
        const rate = tier ? tier[1] : rule.tiers[rule.tiers.length-1][1]
        commFee = price * rate
        commRateStr = (rate * 100).toFixed(2) + '%'
      } else if (rule.type === 2) {
        let rem = price, prev = 0, total = 0
        rule.tiers.forEach((t:any) => {
          if (rem <= 0) return
          const limit = t[0], rate = t[1]
          const chunk = Math.min(rem, limit - prev)
          total += chunk * rate
          rem -= chunk
          prev = limit
        })
        commFee = total
        commRateStr = 'Mixed'
      }
      if (commFee < rule.min && price > 0) commFee = rule.min
    }

    setResults((prev:any) => ({ ...prev, m: { tier: tierName, weight: shipWeight/16, fba: fbaFee, comm: commFee, commRate: commRateStr } }))

  }, [m])

  useEffect(() => {
    // --- C1 Calc ---
    const price = safeFloat(c1.price)
    const exRate = safeFloat(m.exchange_rate) || 7.2
    
    let cost = safeFloat(c1.cost)
    if (c1.cost_unit === 'RMB') cost /= exRate
    
    let ship = safeFloat(c1.ship)
    if (c1.ship_unit === 'RMB') ship /= exRate
    
    const fba = safeFloat(c1.fba)
    const comm = safeFloat(c1.comm)
    const retRate = safeFloat(c1.ret_rate) / 100
    const retCost = safeFloat(c1.ret_cost)
    const other = safeFloat(c1.other_cost)
    const cpc = safeFloat(c1.cpc)
    
    const revenue = price * (1 - retRate)
    const expenses = cost + ship + fba + comm + (retRate * retCost) + other
    const profit = revenue - expenses
    const margin = price > 0 ? (profit / price) * 100 : 0
    
    let maxClicks = 0
    if (cpc > 0 && profit > 0) maxClicks = profit / cpc
    
    let minCVR = 0
    if (maxClicks > 0) minCVR = (1 / maxClicks) * 100
    
    let warn = ''
    if (profit <= 0) warn = '⚠️ 警告：当前定价在扣除各项成本后为负毛利，无法投放广告。'

    setResults((prev:any) => ({ ...prev, c1: { profit, margin, maxClicks, minCVR, beAcos: margin, warn } }))
  }, [c1, m.exchange_rate])

  useEffect(() => {
    // --- C2 Calc ---
    const price = safeFloat(c2.price)
    const exRate = safeFloat(m.exchange_rate) || 7.2
    
    let costTotal = safeFloat(c2.cost_total)
    if (c2.cost_unit === 'RMB') costTotal /= exRate
    
    const feeTotal = safeFloat(c2.fee_total)
    const other = safeFloat(c2.other_cost)
    const cvr = safeFloat(c2.cvr) / 100
    const targetAcos = safeFloat(c2.acos) / 100
    const adShare = safeFloat(c2.ad_share) / 100
    const marketCPC = safeFloat(c2.market_cpc)
    
    const profit = price - costTotal - feeTotal - other
    const recCPC = price * cvr * targetAcos
    const safeCPC = recCPC * 0.8
    
    const margin = price > 0 ? profit / price : 0
    const beCPC = price * cvr * margin
    
    const adSpendPerUnit = price * adShare * targetAcos
    const netProfit = profit - adSpendPerUnit
    const netMargin = price > 0 ? (netProfit / price) * 100 : 0
    const tacos = price > 0 ? (adSpendPerUnit / price) * 100 : 0
    
    const warns: string[] = []
    if (profit <= 0) warns.push("基础毛利已为负，请检查成本或定价！")
    if (marketCPC > 0 && beCPC < marketCPC) warns.push(`⚠️ 盈亏平衡 CPC ($${beCPC.toFixed(2)}) 低于市场参考价 ($${marketCPC.toFixed(2)})`)
    if (netProfit <= 0 && profit > 0) warns.push("综合利润为负，广告花费过高")
    
    setResults((prev:any) => ({ ...prev, c2: { recCPC, safeCPC, beCPC, netProfit, netMargin, tacos, warn: warns } }))
  }, [c2, m.exchange_rate])

  const syncData = () => {
    const data = results.m
    const price = safeFloat(m.price)
    if (price > 0) {
      setC1(prev => ({ ...prev, price: price.toString() }))
      setC2(prev => ({ ...prev, price: price.toString() }))
    }
    if (data.fba > 0) {
      setC1(prev => ({ ...prev, fba: data.fba.toFixed(2) }))
    }
    if (data.comm > 0) {
      setC1(prev => ({ ...prev, comm: data.comm.toFixed(2) }))
    }
    if (data.fba > 0 || data.comm > 0) {
       setC2(prev => ({ ...prev, fee_total: (data.fba + data.comm).toFixed(2) }))
    }
  }

  const applyStrategy = (s: string) => {
     setC2(prev => ({ ...prev, strategy: s }))
     if (s === 'custom') return
     
     const price = safeFloat(c2.price)
     const exRate = safeFloat(m.exchange_rate) || 7.2
     let costTotal = safeFloat(c2.cost_total)
     if (c2.cost_unit === 'RMB') costTotal /= exRate
     const feeTotal = safeFloat(c2.fee_total)
     const other = safeFloat(c2.other_cost)
     
     const profit = price - costTotal - feeTotal - other
     const margin = price > 0 ? profit / price : 0
     
     if (margin <= 0) {
       alert('当前毛利 <= 0，无法应用策略')
       setC2(prev => ({ ...prev, strategy: 'custom' }))
       return
     }
     
     let factor = 1.0
     if (s === 'growth') factor = 0.7
     if (s === 'profit') factor = 0.4
     if (s === 'liquid') factor = 1.2
     
     setC2(prev => ({ ...prev, acos: (margin * factor * 100).toFixed(2) }))
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 mb-2">
        <Crosshair className="h-6 w-6 text-blue-600" />
        <h2 className="text-xl font-bold text-gray-800">CPC&ACOS&利润测算</h2>
      </div>

      {/* Master Config */}
      <Card className="!p-0 overflow-hidden border-blue-100">
        <div className="bg-blue-50/50 px-6 py-4 border-b border-blue-100 flex items-center gap-2">
           <Settings size={18} className="text-blue-600" />
           <h3 className="font-bold text-gray-800">产品基础档案 (Master Config)</h3>
        </div>
        
        <div className="p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-[1fr_1.2fr_0.8fr] gap-8">
          {/* Column 1 */}
          <div className="space-y-5 min-w-0">
             <div>
               <Label>尺寸 (L x W x H)</Label>
               <InputGroup>
                 <Input placeholder="L" value={m.l} onChange={(e:any)=>setM({...m, l:e.target.value})} />
                 <Input placeholder="W" value={m.w} onChange={(e:any)=>setM({...m, w:e.target.value})} />
                 <Input placeholder="H" value={m.h} onChange={(e:any)=>setM({...m, h:e.target.value})} />
                 <Select className="w-24 bg-gray-50" value={m.dim_unit} onChange={(e:any)=>setM({...m, dim_unit:e.target.value})}>
                   <option value="in">in</option>
                   <option value="cm">cm</option>
                 </Select>
               </InputGroup>
             </div>
             <div>
               <Label>重量</Label>
               <InputGroup>
                 <Input placeholder="Weight" value={m.weight} onChange={(e:any)=>setM({...m, weight:e.target.value})} />
                 <Select className="w-24 bg-gray-50" value={m.weight_unit} onChange={(e:any)=>setM({...m, weight_unit:e.target.value})}>
                   <option value="oz">oz</option>
                   <option value="lb">lb</option>
                   <option value="g">g</option>
                 </Select>
               </InputGroup>
             </div>
             <div>
               <Label>计费年份 & 季节</Label>
               <Select className="bg-gray-50" value={m.season} onChange={(e:any)=>setM({...m, season:e.target.value})}>
                  <option value="auto">自动 (根据当前日期)</option>
                  <option value="non_peak_2025">2025 非旺季</option>
                  <option value="peak_2025">2025 旺季 (Oct-Jan)</option>
                  <option value="non_peak_2026">2026 非旺季</option>
               </Select>
             </div>
          </div>

          {/* Column 2 */}
          <div className="space-y-5 min-w-0">
            <div>
              <Label>产品类目 (决定佣金)</Label>
              <Select className="bg-gray-50" value={m.category} onChange={(e:any)=>setM({...m, category:e.target.value})}>
                <option value="">-- 请选择类目 --</option>
                {Object.keys(COMM_RULES).sort().map(k => <option key={k} value={k}>{k}</option>)}
              </Select>
            </div>
            <div>
              <Label>商品类型 (决定 FBA)</Label>
              <Select className="bg-gray-50" value={m.type} onChange={(e:any)=>setM({...m, type:e.target.value})}>
                <option value="normal">普通商品 (非服装/危险品)</option>
                <option value="apparel">服装 (Apparel)</option>
                <option value="danger">危险品 (Dangerous Goods)</option>
              </Select>
              <label className="flex items-center gap-2 mt-2 text-xs text-gray-500 cursor-pointer hover:text-blue-600 transition-colors">
                <input type="checkbox" checked={m.has_lithium} onChange={(e:any)=>setM({...m, has_lithium:e.target.checked})} className="rounded text-blue-600 focus:ring-blue-500 border-gray-300" />
                含锂电池 (+$0.11)
              </label>
            </div>
            <div className="flex gap-4">
              <div className="flex-1">
                <Label>基准售价 (USD)</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">$</span>
                  <Input className="pl-7 border border-gray-300 ring-1 ring-gray-200" placeholder="49.99" value={m.price} onChange={(e:any)=>setM({...m, price:e.target.value})} />
                </div>
              </div>
              <div className="flex-1">
                <Label>汇率 (USD/RMB)</Label>
                <Input placeholder="7.2" value={m.exchange_rate} onChange={(e:any)=>setM({...m, exchange_rate:e.target.value})} />
              </div>
            </div>
          </div>

          {/* Column 3 - Results */}
          <div className="flex flex-col h-full min-w-0">
            <div className="bg-slate-50 rounded-xl p-4 border border-slate-100 space-y-2 flex-1">
               <h4 className="font-bold text-gray-700 mb-2 text-sm">预估费用概览</h4>
               <div className="flex justify-between text-xs items-center">
                 <span className="text-gray-500 flex items-center">尺寸分段:<TooltipIcon text="基于长宽高的最大边、次大边、围长及重量判断" /></span>
                 <span className="bg-white px-1.5 py-0.5 rounded border border-gray-200 font-mono font-bold text-gray-700 truncate max-w-[100px]">{results.m.tier}</span>
               </div>
               <div className="flex justify-between text-xs items-center">
                 <span className="text-gray-500 flex items-center">计费重量:<TooltipIcon text="取 实际重量 与 体积重量(L*W*H/139) 中的较大值" /></span>
                 <span className="font-mono font-bold text-gray-800">{results.m.weight.toFixed(2)} lb</span>
               </div>
               <div className="h-px bg-gray-200 my-1.5"></div>
               <div className="flex justify-between text-xs items-center">
                <span className="text-gray-500 flex items-center">FBA 配送费:<TooltipIcon text="基于尺寸分段、重量及当年费率表 (含锂电池费与3.5%燃油附加费)" /></span>
                 <span className="text-blue-600 font-mono font-bold text-sm">${results.m.fba.toFixed(2)}</span>
               </div>
               <div className="flex justify-between text-xs items-center">
                 <span className="text-gray-500 flex items-center">预估佣金:<TooltipIcon text="基于类目规则 (固定比例 或 阶梯费率) * 售价" /></span>
                 <div className="text-right">
                   <span className="text-orange-600 font-mono font-bold text-sm block">${results.m.comm.toFixed(2)}</span>
                   <span className="text-[10px] text-gray-400 block">{results.m.commRate}</span>
                 </div>
               </div>
            </div>
            <button 
              onClick={syncData}
              className="mt-3 w-full py-2 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-700 hover:to-blue-600 text-white font-semibold rounded-lg shadow-sm transition-all flex items-center justify-center gap-1.5 text-xs"
            >
              <RotateCcw size={14} />
              一键同步到下方测算器
            </button>
          </div>
        </div>
      </Card>

      {/* Calculators Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Card 1 */}
        <Card className="flex flex-col h-full border-t-4 border-t-blue-500">
          <div className="flex items-center justify-between mb-6 pb-3 border-b border-gray-100">
            <div className="flex items-center gap-2">
              <div className="bg-blue-100 p-1.5 rounded-lg text-blue-600"><Target size={20}/></div>
              <h3 className="font-bold text-gray-800">不亏本点击 & ACOS 测算</h3>
            </div>
            <span className="text-xs px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 border border-blue-100 font-medium">正向推导</span>
          </div>
          <div className="space-y-5 flex-1">
            <div>
              <Label>售价 (Price)</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">$</span>
                <Input className="pl-7 border border-gray-300 ring-1 ring-gray-200" value={c1.price} onChange={(e:any)=>setC1({...c1, price:e.target.value})} />
              </div>
            </div>
            <InputGroup>
               <div className="flex-1">
                 <Label>采购成本</Label>
                 <div className="flex gap-1">
                   <Input value={c1.cost} onChange={(e:any)=>setC1({...c1, cost:e.target.value})} />
                   <Select className="w-20 bg-gray-50" value={c1.cost_unit} onChange={(e:any)=>setC1({...c1, cost_unit:e.target.value})}>
                     <option value="USD">$</option>
                     <option value="RMB">¥</option>
                   </Select>
                 </div>
               </div>
               <div className="flex-1">
                 <Label>头程运费</Label>
                 <div className="flex gap-1">
                   <Input value={c1.ship} onChange={(e:any)=>setC1({...c1, ship:e.target.value})} />
                   <Select className="w-20 bg-gray-50" value={c1.ship_unit} onChange={(e:any)=>setC1({...c1, ship_unit:e.target.value})}>
                     <option value="USD">$</option>
                     <option value="RMB">¥</option>
                   </Select>
                 </div>
               </div>
            </InputGroup>
            <InputGroup>
              <div className="flex-1">
                 <Label>FBA 费用</Label>
                 <Input value={c1.fba} onChange={(e:any)=>setC1({...c1, fba:e.target.value})} />
              </div>
              <div className="flex-1">
                 <Label>佣金 ($)</Label>
                 <Input value={c1.comm} onChange={(e:any)=>setC1({...c1, comm:e.target.value})} />
              </div>
            </InputGroup>
            <InputGroup>
              <div className="flex-1">
                 <Label>退货率 %</Label>
                 <Input value={c1.ret_rate} onChange={(e:any)=>setC1({...c1, ret_rate:e.target.value})} />
              </div>
              <div className="flex-1">
                 <Label tooltip="每单退货额外损失（运费、处理、报废等）">退货杂费</Label>
                 <Input value={c1.ret_cost} onChange={(e:any)=>setC1({...c1, ret_cost:e.target.value})} />
              </div>
            </InputGroup>
            <div>
              <Label>其他杂费 (仓储/标贴等)</Label>
              <Input value={c1.other_cost} onChange={(e:any)=>setC1({...c1, other_cost:e.target.value})} />
            </div>
            <div>
              <Label>计划 CPC 出价</Label>
              <Input value={c1.cpc} onChange={(e:any)=>setC1({...c1, cpc:e.target.value})} />
            </div>
            
            <div className="bg-gray-50 rounded-xl p-5 border border-gray-100 mt-6 space-y-1">
              <ResultRow label="有效毛利 (每单)" value={fmtMoney(results.c1.profit)} danger={results.c1.profit<0} tooltip="售价*(1-退货率) - 采购 - 头程 - FBA - 佣金 - (退货率*退货杂费)" />
              <ResultRow label="毛利率" value={fmtPct(results.c1.margin)} tooltip="有效毛利 / 售价" />
              <ResultRow label="盈亏平衡点击数" value={results.c1.maxClicks.toFixed(1)} highlight tooltip="有效毛利 / CPC" />
              <ResultRow label="最低保本转化率" value={fmtPct(results.c1.minCVR)} tooltip="1 / 盈亏平衡点击数" />
              <ResultRow label="盈亏平衡 ACOS" value={fmtPct(results.c1.beAcos)} tooltip="有效毛利 / 售价 (即毛利率)" />
            </div>
            {results.c1.warn && <div className="p-3 rounded-lg bg-amber-50 text-amber-700 text-xs border border-amber-100 flex items-start gap-2">
              <Info size={14} className="mt-0.5 shrink-0" />
              {results.c1.warn}
            </div>}
          </div>
        </Card>

        {/* Card 2 */}
        <Card className="flex flex-col h-full border-t-4 border-t-purple-500">
          <div className="flex items-center justify-between mb-6 pb-3 border-b border-gray-100">
            <div className="flex items-center gap-2">
              <div className="bg-purple-100 p-1.5 rounded-lg text-purple-600"><TrendingUp size={20}/></div>
              <h3 className="font-bold text-gray-800">反推 CPC & 综合利润</h3>
            </div>
            <span className="text-xs px-2.5 py-1 rounded-full bg-purple-50 text-purple-700 border border-purple-100 font-medium">反向推导</span>
          </div>
          <div className="space-y-5 flex-1">
             <div>
              <Label>售价 (Price)</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">$</span>
                <Input className="pl-7 border border-gray-300 ring-1 ring-gray-200" value={c2.price} onChange={(e:any)=>setC2({...c2, price:e.target.value})} />
              </div>
            </div>
            <InputGroup>
               <div className="flex-1">
                 <Label>采购 + 头程 (Sum)</Label>
                 <div className="flex gap-1">
                   <Input value={c2.cost_total} onChange={(e:any)=>setC2({...c2, cost_total:e.target.value})} />
                   <Select className="w-20 bg-gray-50" value={c2.cost_unit} onChange={(e:any)=>setC2({...c2, cost_unit:e.target.value})}>
                     <option value="USD">$</option>
                     <option value="RMB">¥</option>
                   </Select>
                 </div>
               </div>
               <div className="flex-1">
                 <Label>FBA + 佣金 (Sum)</Label>
                 <Input value={c2.fee_total} onChange={(e:any)=>setC2({...c2, fee_total:e.target.value})} />
               </div>
            </InputGroup>
            <InputGroup>
               <div className="flex-1">
                 <Label>预估转化率 (CVR %)</Label>
                 <Input value={c2.cvr} onChange={(e:any)=>setC2({...c2, cvr:e.target.value})} />
               </div>
               <div className="flex-1">
                 <Label tooltip="第三方工具（如卖家精灵/Sif）查询到的类目平均或Top竞品出价">市场参考 CPC</Label>
                 <Input value={c2.market_cpc} onChange={(e:any)=>setC2({...c2, market_cpc:e.target.value})} />
               </div>
            </InputGroup>
            <div>
              <Label>其他杂费</Label>
              <Input value={c2.other_cost} onChange={(e:any)=>setC2({...c2, other_cost:e.target.value})} />
            </div>
            <div>
              <Label tooltip={`不同阶段对利润要求不同：
• 新品冲榜：允许亏损 (ACOS > 毛利)，换取排名。
• 稳健增长：微利 (ACOS ≈ 毛利*70%)，平衡量与利。
• 利润收割：保利润 (ACOS ≈ 毛利*40%)。
选择后系统会自动计算推荐的 Target ACOS，你也可以手动修改。`}>推广阶段/策略</Label>
              <Select className="bg-gray-50" value={c2.strategy} onChange={(e:any)=>applyStrategy(e.target.value)}>
                <option value="custom">-- 自定义 (Custom) --</option>
                <option value="launch">🚀 新品冲榜 (Target ACOS = 毛利 100%)</option>
                <option value="growth">📈 稳健增长 (Target ACOS = 毛利 70%)</option>
                <option value="profit">💰 利润收割 (Target ACOS = 毛利 40%)</option>
                <option value="liquid">💸 清仓回款 (Target ACOS = 毛利 120%)</option>
              </Select>
            </div>
            <InputGroup>
               <div className="flex-1">
                 <Label>目标 ACOS %</Label>
                 <Input value={c2.acos} onChange={(e:any)=>setC2({...c2, acos:e.target.value})} />
               </div>
               <div className="flex-1">
                 <Label>广告单占比 % (TACOS)</Label>
                 <Input value={c2.ad_share} onChange={(e:any)=>setC2({...c2, ad_share:e.target.value})} />
               </div>
            </InputGroup>

            <div className="bg-gray-50 rounded-xl p-5 border border-gray-100 mt-6 space-y-1">
              <ResultRow label="建议最高 CPC" value={fmtMoney(results.c2.recCPC)} sub="Price * CVR * TargetACOS" tooltip="售价 * 转化率 * 目标ACOS" />
              <ResultRow label="安全出价 (80%)" value={fmtMoney(results.c2.safeCPC)} tooltip="建议CPC * 0.8 (留安全边际)" />
              <ResultRow label="盈亏平衡 CPC" value={fmtMoney(results.c2.beCPC)} tooltip="售价 * 转化率 * 毛利率" />
              <ResultRow label="综合利润 (每单)" value={fmtMoney(results.c2.netProfit)} danger={results.c2.netProfit<0} highlight tooltip="毛利 - (售价 * 广告占比 * 目标ACOS)" />
              <ResultRow label="综合利润率" value={fmtPct(results.c2.netMargin)} tooltip="综合利润 / 售价" />
              <ResultRow label="综合 ACOS (TACOS)" value={fmtPct(results.c2.tacos)} tooltip="广告占比 * 目标ACOS" />
            </div>
             {results.c2.warn.length > 0 && (
               <div className="p-3 rounded-lg bg-amber-50 text-amber-700 text-xs border border-amber-100 space-y-1">
                 {results.c2.warn.map((w:string, i:number) => (
                   <div key={i} className="flex items-start gap-2">
                     <Info size={14} className="mt-0.5 shrink-0" />
                     {w}
                   </div>
                 ))}
               </div>
             )}
          </div>
        </Card>
      </div>

      {/* Save Controls */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
        <div className="text-sm font-bold text-gray-800 mb-4 flex items-center gap-2">
          <Save size={18} className="text-blue-600" />
          测算记录管理
        </div>
        <div className="flex gap-2 mb-6">
          <Input placeholder="记录名称 (例如: SKU-001-新品期)" value={saveName} onChange={(e:any)=>setSaveName(e.target.value)} className="max-w-md ring-1 ring-gray-200" />
          <button onClick={saveRecord} className="px-5 py-2 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700 shadow-sm transition-colors">保存当前</button>
          <button onClick={clearAll} className="px-5 py-2 bg-white text-red-600 text-sm font-medium rounded-lg hover:bg-red-50 border border-gray-200 hover:border-red-200 transition-colors">一键清空</button>
        </div>

        <div className="space-y-2 max-h-60 overflow-y-auto">
          {Object.keys(records).length === 0 ? (
             <div className="text-center text-sm text-gray-400 py-8 bg-gray-50 rounded-lg border border-dashed border-gray-200">暂无保存记录</div>
          ) : (
             Object.keys(records).sort((a,b)=>records[b].timestamp-records[a].timestamp).map(name => (
               <div key={name} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200 hover:border-blue-300 hover:bg-blue-50/30 transition-colors group">
                 <div>
                   <div className="text-sm font-bold text-gray-700 group-hover:text-blue-700">{name}</div>
                   <div className="text-xs text-gray-400 mt-0.5">{new Date(records[name].timestamp).toLocaleString()}</div>
                 </div>
                 <div className="flex gap-2">
                   <button onClick={()=>loadRecord(name)} className="px-3 py-1.5 bg-white text-blue-600 text-xs font-medium rounded border border-gray-200 hover:border-blue-300 hover:text-blue-700 transition-colors">加载</button>
                   <button onClick={()=>deleteRecord(name)} className="px-3 py-1.5 bg-white text-gray-400 hover:text-red-600 text-xs font-medium rounded border border-gray-200 hover:border-red-200 transition-colors"><Trash2 size={14}/></button>
                 </div>
               </div>
             ))
          )}
        </div>
      </div>
    </div>
  )
}
