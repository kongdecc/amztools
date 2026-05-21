'use client'

import React, { useMemo, useState } from 'react'
import { Calculator, Info, RefreshCcw, Snowflake, Truck } from 'lucide-react'

type ProductType = 'normal' | 'frozen'

interface InputsState {
  length: string
  width: string
  height: string
  weight: string
  price: string
  type: ProductType
  autoSort: boolean
}

interface FeeTier {
  group: string
  tier: string
  maxSum: number
  maxL: number
  maxW: number
  maxH: number
  maxWeightG: number
  feeHigh: number
  feeLow: number
  note: string
}

interface ResultState {
  status: 'idle' | 'error' | 'limit' | 'unmatched' | 'success'
  badges: Array<{ label: string; tone: 'green' | 'blue' | 'orange' | 'red' }>
  title: string
  subtitle?: string
  totalFee?: number
  items?: Array<{ label: string; value: string }>
  message?: string
}

const feeTable: FeeTier[] = [
  { group: '小件商品', tier: '小件商品', maxSum: 45, maxL: 25, maxW: 18, maxH: 2, maxWeightG: 250, feeHigh: 288, feeLow: 222, note: '不超过 25 × 18 × 2 cm，且不超过 250 g' },
  { group: '标准尺寸', tier: '标准尺寸 1', maxSum: 68.3, maxL: 35, maxW: 30, maxH: 3.3, maxWeightG: 1000, feeHigh: 318, feeLow: 252, note: '不超过 35 × 30 × 3.3 cm，且不超过 1 kg' },
  { group: '标准尺寸', tier: '标准尺寸 2a', maxSum: 20, maxL: 45, maxW: 35, maxH: 20, maxWeightG: 2000, feeHigh: 410, feeLow: 344, note: '不超过 20 cm，且不超过 2 kg' },
  { group: '标准尺寸', tier: '标准尺寸 2b', maxSum: 30, maxL: 45, maxW: 35, maxH: 20, maxWeightG: 2000, feeHigh: 415, feeLow: 358, note: '不超过 30 cm，且不超过 2 kg' },
  { group: '标准尺寸', tier: '标准尺寸 2c', maxSum: 40, maxL: 45, maxW: 35, maxH: 20, maxWeightG: 2000, feeHigh: 420, feeLow: 371, note: '不超过 40 cm，且不超过 2 kg' },
  { group: '标准尺寸', tier: '标准尺寸 2d', maxSum: 50, maxL: 45, maxW: 35, maxH: 20, maxWeightG: 2000, feeHigh: 425, feeLow: 379, note: '不超过 50 cm，且不超过 2 kg' },
  { group: '标准尺寸', tier: '标准尺寸 2e', maxSum: 60, maxL: 45, maxW: 35, maxH: 20, maxWeightG: 2000, feeHigh: 430, feeLow: 391, note: '不超过 60 cm，且不超过 2 kg' },
  { group: '标准尺寸', tier: '标准尺寸 3', maxSum: 80, maxL: 45, maxW: 35, maxH: 20, maxWeightG: 5000, feeHigh: 472, feeLow: 427, note: '不超过 80 cm，且不超过 5 kg' },
  { group: '标准尺寸', tier: '标准尺寸 4', maxSum: 100, maxL: 45, maxW: 35, maxH: 20, maxWeightG: 9000, feeHigh: 532, feeLow: 466, note: '不超过 100 cm，且不超过 9 kg' },
  { group: '大件', tier: '大件 1', maxSum: 60, maxL: 999, maxW: 999, maxH: 999, maxWeightG: 2000, feeHigh: 589, feeLow: 523, note: '不超过 60 cm，且不超过 2 kg' },
  { group: '大件', tier: '大件 2', maxSum: 80, maxL: 999, maxW: 999, maxH: 999, maxWeightG: 5000, feeHigh: 624, feeLow: 558, note: '不超过 80 cm，且不超过 5 kg' },
  { group: '大件', tier: '大件 3', maxSum: 100, maxL: 999, maxW: 999, maxH: 999, maxWeightG: 10000, feeHigh: 675, feeLow: 609, note: '不超过 100 cm，且不超过 10 kg' },
  { group: '大件', tier: '大件 4', maxSum: 120, maxL: 999, maxW: 999, maxH: 999, maxWeightG: 15000, feeHigh: 781, feeLow: 715, note: '不超过 120 cm，且不超过 15 kg' },
  { group: '大件', tier: '大件 5', maxSum: 140, maxL: 999, maxW: 999, maxH: 999, maxWeightG: 20000, feeHigh: 1020, feeLow: 954, note: '不超过 140 cm，且不超过 20 kg' },
  { group: '大件', tier: '大件 6', maxSum: 160, maxL: 999, maxW: 999, maxH: 999, maxWeightG: 25000, feeHigh: 1100, feeLow: 1034, note: '不超过 160 cm，且不超过 25 kg' },
  { group: '大件', tier: '大件 7', maxSum: 180, maxL: 999, maxW: 999, maxH: 999, maxWeightG: 30000, feeHigh: 1532, feeLow: 1466, note: '不超过 180 cm，且不超过 30 kg' },
  { group: '大件', tier: '大件 8', maxSum: 200, maxL: 999, maxW: 999, maxH: 999, maxWeightG: 40000, feeHigh: 1756, feeLow: 1690, note: '不超过 200 cm，且不超过 40 kg' },
  { group: '超大件', tier: '超大件 1', maxSum: 200, maxL: 250, maxW: 999, maxH: 999, maxWeightG: 50000, feeHigh: 2755, feeLow: 2689, note: '不超过 200 cm，且不超过 50 kg' },
  { group: '超大件', tier: '超大件 2', maxSum: 220, maxL: 250, maxW: 999, maxH: 999, maxWeightG: 50000, feeHigh: 3573, feeLow: 3507, note: '不超过 220 cm，且不超过 50 kg' },
  { group: '超大件', tier: '超大件 3', maxSum: 240, maxL: 250, maxW: 999, maxH: 999, maxWeightG: 50000, feeHigh: 4496, feeLow: 4430, note: '不超过 240 cm，且不超过 50 kg' },
  { group: '超大件', tier: '超大件 4a', maxSum: 260, maxL: 250, maxW: 999, maxH: 999, maxWeightG: 50000, feeHigh: 5625, feeLow: 5559, note: '不超过 260 cm，且不超过 50 kg' },
  { group: '超大件', tier: '超大件 4b', maxSum: 400, maxL: 250, maxW: 999, maxH: 999, maxWeightG: 50000, feeHigh: 13950, feeLow: 13884, note: '不超过 400 cm，且不超过 50 kg' },
]

const fullFeeTableRows = [
  ['小件商品', '-', '-', '不超过 25 厘米 × 18 厘米 × 2.0 厘米', '不超过 250 克', '288 日元', '222 日元'],
  ['标准尺寸', '1', '1', '不超过 35 厘米 × 30 厘米 × 3.3 厘米', '不超过 1 千克', '318 日元', '252 日元'],
  ['标准尺寸', '2', '2a', '不超过 20 厘米', '不超过 2 千克', '410 日元', '344 日元'],
  ['标准尺寸', '3', '2b', '不超过 30 厘米', '不超过 2 千克', '415 日元', '358 日元'],
  ['标准尺寸', '4', '2c', '不超过 40 厘米', '不超过 2 千克', '420 日元', '371 日元'],
  ['标准尺寸', '5', '2d', '不超过 50 厘米', '不超过 2 千克', '425 日元', '379 日元'],
  ['标准尺寸', '6', '2e', '不超过 60 厘米', '不超过 2 千克', '430 日元', '391 日元'],
  ['标准尺寸', '7', '3', '不超过 80 厘米', '不超过 5 千克', '472 日元', '427 日元'],
  ['标准尺寸', '8', '4', '不超过 100 厘米', '不超过 9 千克', '532 日元', '466 日元'],
  ['大件', '1', '1', '不超过 60 厘米', '不超过 2 千克', '589 日元', '523 日元'],
  ['大件', '2', '2', '不超过 80 厘米', '不超过 5 千克', '624 日元', '558 日元'],
  ['大件', '3', '3', '不超过 100 厘米', '不超过 10 千克', '675 日元', '609 日元'],
  ['大件', '4', '4', '不超过 120 厘米', '不超过 15 千克', '781 日元', '715 日元'],
  ['大件', '5', '5', '不超过 140 厘米', '不超过 20 千克', '1,020 日元', '954 日元'],
  ['大件', '6', '6', '不超过 160 厘米', '不超过 25 千克', '1,100 日元', '1,034 日元'],
  ['大件', '7', '7', '不超过 180 厘米', '不超过 30 千克', '1,532 日元', '1,466 日元'],
  ['大件', '8', '8', '不超过 200 厘米', '不超过 40 千克', '1,756 日元', '1,690 日元'],
  ['超大件', '1', '1', '不超过 200 厘米', '不超过 50 千克', '2,755 日元', '2,689 日元'],
  ['超大件', '2', '2', '不超过 220 厘米', '不超过 50 千克', '3,573 日元', '3,507 日元'],
  ['超大件', '3', '3', '不超过 240 厘米', '不超过 50 千克', '4,496 日元', '4,430 日元'],
  ['超大件', '4', '4a', '不超过 260 厘米', '不超过 50 千克', '5,625 日元', '5,559 日元'],
  ['超大件', '5', '4b', '不超过 400 厘米', '不超过 50 千克', '13,950 日元', '13,884 日元'],
] as const

const sizeGuideRows = [
  ['小号', '250 克', '25 厘米', '18 厘米', '2 厘米', '45 厘米', '不超过 25 厘米 × 18 厘米 × 2 厘米且不超过 250 克'],
  ['标准', '9 千克', '45 厘米', '35 厘米', '20 厘米', '100 厘米', '不超过 45 厘米 × 35 厘米 × 20 厘米且不超过 9 千克'],
  ['大件', '40 千克', '不适用', '不适用', '不适用', '200 厘米', '超过标准尺寸，但尺寸合计不超过 200 厘米且不超过 40 千克'],
  ['超大件', '50 千克', '250 厘米', '不适用', '不适用', '400 厘米', '尺寸合计不超过 400 厘米，重量不超过 50 千克，最长边不超过 250 厘米'],
] as const

const initialInputs: InputsState = {
  length: '',
  width: '',
  height: '',
  weight: '',
  price: '',
  type: 'normal',
  autoSort: true,
}

const initialResult: ResultState = {
  status: 'idle',
  badges: [{ label: '等待输入', tone: 'blue' }],
  title: '请输入商品尺寸、重量和售价，然后点击“计算配送费”。',
}

export default function AmazonJpFbaCalculatorPage() {
  const [inputs, setInputs] = useState<InputsState>(initialInputs)
  const [result, setResult] = useState<ResultState>(initialResult)

  const frozenExtraText = useMemo(
    () => (inputs.type === 'frozen' ? '冷冻商品每件额外加收 375 日元。' : '非冷冻商品按基础配送费计算。'),
    [inputs.type]
  )

  const handleInputChange = (key: keyof InputsState, value: string | boolean) => {
    setInputs((prev) => ({ ...prev, [key]: value }))
  }

  const calculateFee = () => {
    const lengthInput = Number(inputs.length)
    const widthInput = Number(inputs.width)
    const heightInput = Number(inputs.height)
    const weightG = Number(inputs.weight)
    const price = Number(inputs.price)

    if (!lengthInput || !widthInput || !heightInput || !weightG || price < 0 || Number.isNaN(price)) {
      setResult({
        status: 'error',
        badges: [{ label: '输入不完整', tone: 'red' }],
        title: '请完整输入商品的长、宽、高、重量和售价。',
        subtitle: '所有数值都需要大于 0，售价不能小于 0。',
      })
      return
    }

    let dims = [lengthInput, widthInput, heightInput]
    if (inputs.autoSort) dims = [...dims].sort((a, b) => b - a)

    const [L, W, H] = dims
    const sum = L + W + H

    if (sum > 400 || weightG > 50000 || L > 250) {
      setResult({
        status: 'limit',
        badges: [{ label: '超出 FBA 限制', tone: 'red' }],
        title: '无法计算',
        items: [
          { label: '排序后三边', value: `${L} × ${W} × ${H} cm` },
          { label: '尺寸合计', value: `${sum.toFixed(1)} cm` },
          { label: '重量', value: `${weightG} g` },
        ],
        message: '尺寸超过 400 厘米，重量超过 50 千克，或最长边超过 250 厘米的商品不能享受亚马逊物流服务。',
      })
      return
    }

    const matched = feeTable.find((item) => L <= item.maxL && W <= item.maxW && H <= item.maxH && sum <= item.maxSum && weightG <= item.maxWeightG)

    if (!matched) {
      setResult({
        status: 'unmatched',
        badges: [{ label: '未匹配费用档位', tone: 'red' }],
        title: '请人工复核',
        items: [
          { label: '排序后三边', value: `${L} × ${W} × ${H} cm` },
          { label: '尺寸合计', value: `${sum.toFixed(1)} cm` },
          { label: '重量', value: `${weightG} g` },
        ],
        message: '该商品没有匹配到当前费用表中的档位，请检查输入值。',
      })
      return
    }

    const isLowPrice = price <= 1000
    const baseFee = isLowPrice ? matched.feeLow : matched.feeHigh
    const frozenFee = inputs.type === 'frozen' ? 375 : 0
    const totalFee = baseFee + frozenFee

    setResult({
      status: 'success',
      badges: [
        { label: matched.group, tone: getTone(matched.group) },
        { label: matched.tier, tone: 'blue' },
        { label: isLowPrice ? '低价商品费用' : '普通商品费用', tone: isLowPrice ? 'green' : 'orange' },
        ...(inputs.type === 'frozen' ? [{ label: '冷冻商品', tone: 'red' as const }] : []),
      ],
      title: formatYen(totalFee),
      subtitle: '/ 件',
      totalFee,
      items: [
        { label: '基础配送费', value: formatYen(baseFee) },
        { label: '冷冻商品附加费', value: formatYen(frozenFee) },
        { label: '商品售价判断', value: isLowPrice ? '≤ 1,000 日元' : '> 1,000 日元' },
        { label: '排序后三边', value: `${L} × ${W} × ${H} cm` },
        { label: '尺寸合计', value: `${sum.toFixed(1)} cm` },
        { label: '商品重量', value: `${weightG} g / ${(weightG / 1000).toFixed(2)} kg` },
        { label: '匹配条件', value: matched.note },
      ],
    })
  }

  const resetForm = () => {
    setInputs(initialInputs)
    setResult(initialResult)
  }

  return (
    <div className="space-y-6">
      <section className="rounded-2xl bg-gradient-to-r from-teal-700 to-sky-500 p-6 text-white shadow-sm">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-white/15 p-3">
            <Truck className="h-6 w-6" />
          </div>
          <div>
            <h2 className="text-2xl font-bold">亚马逊 JP 站点 FBA 配送费计算器</h2>
            <p className="mt-2 text-sm leading-6 text-teal-50">根据商品包装后的尺寸、重量、售价，自动估算日本站亚马逊物流配送费用。</p>
          </div>
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-2">
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-5 flex items-center gap-2">
            <Calculator className="h-5 w-5 text-teal-600" />
            <h3 className="text-lg font-bold text-slate-900">输入商品信息</h3>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <Field label="最长边 / 长度，厘米">
              <input value={inputs.length} onChange={(e) => handleInputChange('length', e.target.value)} type="number" min="0" step="0.1" placeholder="例如：30" className={inputClassName} />
            </Field>
            <Field label="次长边 / 宽度，厘米">
              <input value={inputs.width} onChange={(e) => handleInputChange('width', e.target.value)} type="number" min="0" step="0.1" placeholder="例如：20" className={inputClassName} />
            </Field>
            <Field label="最短边 / 高度，厘米">
              <input value={inputs.height} onChange={(e) => handleInputChange('height', e.target.value)} type="number" min="0" step="0.1" placeholder="例如：10" className={inputClassName} />
            </Field>
            <Field label="商品重量，克">
              <input value={inputs.weight} onChange={(e) => handleInputChange('weight', e.target.value)} type="number" min="0" step="1" placeholder="例如：800" className={inputClassName} />
            </Field>
            <Field label="商品售价，日元">
              <input value={inputs.price} onChange={(e) => handleInputChange('price', e.target.value)} type="number" min="0" step="1" placeholder="例如：1500" className={inputClassName} />
            </Field>
            <Field label="商品类型">
              <select value={inputs.type} onChange={(e) => handleInputChange('type', e.target.value as ProductType)} className={inputClassName}>
                <option value="normal">非冷冻商品</option>
                <option value="frozen">冷冻食品商品</option>
              </select>
            </Field>
            <label className="md:col-span-2 flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
              <input type="checkbox" checked={inputs.autoSort} onChange={(e) => handleInputChange('autoSort', e.target.checked)} className="h-4 w-4 rounded border-slate-300 text-teal-600 focus:ring-teal-500" />
              自动将三边按从大到小排序后计算
            </label>
          </div>

          <div className="mt-5 flex flex-wrap gap-3">
            <button type="button" onClick={calculateFee} className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-teal-700 px-4 py-3 text-sm font-semibold text-white transition hover:bg-teal-800">
              <Calculator className="h-4 w-4" />
              计算配送费
            </button>
            <button type="button" onClick={resetForm} className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-200 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-300">
              <RefreshCcw className="h-4 w-4" />
              重置
            </button>
          </div>

          <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-800">
            如果商品成套销售，那么重量和尺寸则为套装中所有商品包装在一起之后的总重量和尺寸。
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-5 flex items-center gap-2">
            <Info className="h-5 w-5 text-sky-600" />
            <h3 className="text-lg font-bold text-slate-900">计算结果</h3>
          </div>

          <div className="min-h-[320px] rounded-2xl border border-slate-200 bg-slate-50 p-5">
            <div className="mb-4 flex flex-wrap gap-2">
              {result.badges.map((badge) => (
                <span key={`${badge.label}-${badge.tone}`} className={`rounded-full px-3 py-1 text-xs font-bold ${badgeClassMap[badge.tone]}`}>
                  {badge.label}
                </span>
              ))}
            </div>

            {result.status === 'success' ? (
              <>
                <div className="mb-4">
                  <div className="text-4xl font-extrabold text-red-600">{result.title} <span className="text-lg font-semibold text-slate-500">{result.subtitle}</span></div>
                </div>
                <div className="grid gap-3">
                  {result.items?.map((item) => (
                    <div key={item.label} className="flex items-start justify-between gap-4 border-b border-dashed border-slate-300 pb-2 text-sm">
                      <span className="text-slate-500">{item.label}</span>
                      <strong className="text-right text-slate-900">{item.value}</strong>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="space-y-4 text-sm leading-6">
                <p className="font-semibold text-slate-900">{result.title}</p>
                {result.subtitle && <p className="text-slate-600">{result.subtitle}</p>}
                {result.items?.map((item) => (
                  <div key={item.label} className="flex items-start justify-between gap-4 border-b border-dashed border-slate-300 pb-2">
                    <span className="text-slate-500">{item.label}</span>
                    <strong className="text-right text-slate-900">{item.value}</strong>
                  </div>
                ))}
                {result.message && <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-red-700">{result.message}</div>}
              </div>
            )}
          </div>

          <div className={`mt-4 rounded-xl border px-4 py-3 text-sm leading-6 ${inputs.type === 'frozen' ? 'border-sky-200 bg-sky-50 text-sky-700' : 'border-slate-200 bg-slate-50 text-slate-600'}`}>
            <div className="flex items-center gap-2 font-medium">
              <Snowflake className="h-4 w-4" />
              冷冻附加费说明
            </div>
            <p className="mt-1">{frozenExtraText}</p>
          </div>
        </section>
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h3 className="text-lg font-bold text-slate-900">完整配送费用表格</h3>
        <div className="mt-4 overflow-x-auto rounded-2xl border border-slate-200">
          <table className="min-w-[880px] w-full border-collapse text-center text-sm">
            <thead>
              <tr className="bg-slate-100 text-slate-700">
                <Th>尺寸分段</Th>
                <Th>旧标号</Th>
                <Th>新标号</Th>
                <Th>尺寸</Th>
                <Th>重量</Th>
                <Th>商品单价超过 1,000 日元时每件商品的配送费用</Th>
                <Th>商品单价不超过 1,000 日元时每件商品的配送费用</Th>
              </tr>
            </thead>
            <tbody>
              {fullFeeTableRows.map((row, index) => (
                <tr key={`${row[0]}-${row[1]}-${index}`} className="border-t border-slate-200">
                  <Td className="bg-slate-50 font-bold text-teal-700">{row[0]}</Td>
                  <Td>{row[1]}</Td>
                  <Td>{row[2]}</Td>
                  <Td>{row[3]}</Td>
                  <Td>{row[4]}</Td>
                  <Td>{row[5]}</Td>
                  <Td>{row[6]}</Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-sm text-slate-500">以上费用包含 10% 的消费税。</p>
        <p className="mt-1 text-sm text-slate-500">亚马逊在收取冷冻食品商品的亚马逊物流配送费用时，将针对每件产品收取 375 日元的附加费。</p>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h3 className="text-lg font-bold text-slate-900">商品尺寸分段说明表格</h3>
        <div className="mt-4 overflow-x-auto rounded-2xl border border-slate-200">
          <table className="min-w-[880px] w-full border-collapse text-center text-sm">
            <thead>
              <tr className="bg-slate-100 text-slate-700">
                <Th>商品尺寸分段</Th>
                <Th>重量</Th>
                <Th>最长边</Th>
                <Th>次长边</Th>
                <Th>最短边</Th>
                <Th>尺寸</Th>
                <Th>说明</Th>
              </tr>
            </thead>
            <tbody>
              {sizeGuideRows.map((row) => (
                <tr key={row[0]} className="border-t border-slate-200">
                  <Td className="bg-slate-50 font-bold text-teal-700">{row[0]}</Td>
                  <Td>{row[1]}</Td>
                  <Td>{row[2]}</Td>
                  <Td>{row[3]}</Td>
                  <Td>{row[4]}</Td>
                  <Td>{row[5]}</Td>
                  <Td className="text-left">{row[6]}</Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p className="mt-3 text-sm text-slate-500">尺寸 = 包装后商品的长宽高之和。</p>

        <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-800">
          注意：尺寸超过 400 厘米，或重量超过 50 千克的商品不能享受亚马逊物流服务。
        </div>

        <div className="mt-5 grid gap-5 lg:grid-cols-2">
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <h4 className="font-bold text-slate-900">标准尺寸商品与大件商品</h4>
            <p className="mt-2 text-sm leading-6 text-slate-600">标准尺寸商品是指包装好后的重量不超过 9 千克并且尺寸不超过以下标准的商品：</p>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-600">
              <li>最长边 45 厘米</li>
              <li>次长边 35 厘米</li>
              <li>最短边 20 厘米</li>
            </ul>
            <p className="mt-2 text-sm leading-6 text-slate-600">超过上述尺寸的商品属于大件商品。</p>
          </div>

          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <h4 className="font-bold text-slate-900">超大尺寸限制</h4>
            <p className="mt-2 text-sm leading-6 text-slate-600">超大件商品无法享受以下亚马逊物流功能和服务：</p>
            <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-slate-600">
              <li>亚马逊物流贴标服务</li>
              <li>亚马逊物流预处理服务</li>
              <li>商品到达运营中心时的通知服务，接收开始和完成时的通知将照常发送</li>
              <li>已过期库存报告</li>
            </ol>
            <p className="mt-3 text-sm leading-6 text-slate-600">超大尺寸商品不能享受以下买家服务：</p>
            <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-slate-600">
              <li>计划配送</li>
              <li>安装服务</li>
              <li>回收，包括回收优惠券发放、取件等</li>
            </ol>
          </div>
        </div>
      </section>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-2">
      <span className="text-sm font-medium text-slate-600">{label}</span>
      {children}
    </label>
  )
}

function Th({ children }: { children: React.ReactNode }) {
  return <th className="border border-slate-200 px-3 py-2 font-semibold">{children}</th>
}

function Td({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <td className={`border border-slate-200 px-3 py-2 align-middle text-slate-700 ${className}`}>{children}</td>
}

const inputClassName =
  'h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm outline-none transition focus:border-sky-500 focus:ring-4 focus:ring-sky-100'

const badgeClassMap = {
  green: 'bg-green-100 text-green-700',
  blue: 'bg-blue-100 text-blue-700',
  orange: 'bg-orange-100 text-orange-700',
  red: 'bg-red-100 text-red-700',
}

function formatYen(value: number) {
  return `${new Intl.NumberFormat('ja-JP').format(value)} 日元`
}

function getTone(group: string): 'green' | 'blue' | 'orange' | 'red' {
  if (group === '小件商品') return 'green'
  if (group === '标准尺寸') return 'blue'
  if (group === '大件') return 'orange'
  return 'red'
}
