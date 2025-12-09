import React, { useState } from 'react'
import { Calculator } from 'lucide-react'
import { Card, Input } from '@/components/SharedUI'

const AdCalculatorPage = () => {
  const [data, setData] = useState(
    [
      { strategy: 'Fixed bids', position: 'TOP', multiplier: 1 },
      { strategy: 'Fixed bids', position: 'Product pages', multiplier: 1 },
      { strategy: 'Fixed bids', position: 'Rest of search', multiplier: 1 },
      { strategy: 'up and down', position: 'TOP', multiplier: 2 },
      { strategy: 'up and down', position: 'Product pages', multiplier: 1.5 },
      { strategy: 'up and down', position: 'Rest of search', multiplier: 1.5 },
      { strategy: 'down only', position: 'TOP', multiplier: 1 },
      { strategy: 'down only', position: 'Product pages', multiplier: 1 },
      { strategy: 'down only', position: 'Rest of search', multiplier: 1 },
    ].map(item => ({ ...item, bidOld: '', bidNew: '', percentOld: '', percentNew: '' }))
  )

  const updateField = (index: number, field: string, value: string) => {
    const newData = [...data]
    newData[index] = { ...newData[index], [field]: value }
    setData(newData)
  }

  const calculateCPC = (bid: string, percent: string, multiplier: number) => {
    const b = parseFloat(bid)
    const p = parseFloat(percent)
    if (isNaN(b)) return ''
    const pct = isNaN(p) ? 0 : p
    return (b * (1 + pct / 100) * multiplier).toFixed(3)
  }

  const renderRow = (index: number, isFirst = false) => {
    const row = data[index]
    const cpcOld = calculateCPC(row.bidOld, row.percentOld, row.multiplier)
    const cpcNew = calculateCPC(row.bidNew, row.percentNew, row.multiplier)

    return (
      <tr key={index} className="text-sm border-b border-gray-200 hover:bg-gray-50">
        {isFirst && (
          <td className={`p-3 border-r border-gray-200 font-medium ${row.strategy.includes('Fixed') ? 'text-red-500' : row.strategy.includes('up') ? 'text-purple-600' : 'text-blue-500'}`}>
            {row.strategy.split(' ')[0]} bids
          </td>
        )}
        {!isFirst && <td className="border-r border-gray-200"></td>}
        <td className="p-3 border-r border-gray-200 text-center text-gray-700">{row.position}</td>
        <td className="p-3 border-r border-gray-200 text-center text-gray-700">{row.multiplier}</td>
        <td className="p-2 border-r border-gray-200">
          <Input 
            type="number" 
            value={row.bidOld} 
            onChange={(e: any) => updateField(index, 'bidOld', e.target.value)} 
            placeholder="0" 
            className="text-center" 
          />
        </td>
        <td className="p-2 border-r border-gray-200">
          <Input 
            type="number" 
            value={row.bidNew} 
            onChange={(e: any) => updateField(index, 'bidNew', e.target.value)} 
            placeholder="0" 
            className="text-center" 
          />
        </td>
        <td className="p-2 border-r border-gray-200">
          <Input 
            type="number" 
            value={row.percentOld} 
            onChange={(e: any) => updateField(index, 'percentOld', e.target.value)} 
            placeholder="0" 
            className="text-center" 
          />
        </td>
        <td className="p-2 border-r border-gray-200">
          <Input 
            type="number" 
            value={row.percentNew} 
            onChange={(e: any) => updateField(index, 'percentNew', e.target.value)} 
            placeholder="0" 
            className="text-center" 
          />
        </td>
        <td className="p-3 border-r border-gray-200 bg-red-50/30 text-center text-red-600 font-medium">{cpcOld}</td>
        <td className="p-3 bg-red-50/30 text-center text-red-600 font-medium">{cpcNew}</td>
      </tr>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 mb-2">
        <Calculator className="h-6 w-6 text-blue-600" />
        <h2 className="text-xl font-bold text-gray-800">广告竞价计算</h2>
      </div>
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-indigo-50/50 text-sm font-semibold text-gray-700 border-b border-gray-200">
                <th className="p-3 border-r border-gray-200 text-left w-32">系列竞价策略</th>
                <th className="p-3 border-r border-gray-200 w-32">位置</th>
                <th className="p-3 border-r border-gray-200 w-20">最高倍数</th>
                <th className="p-3 border-r border-gray-200 w-24">原出价</th>
                <th className="p-3 border-r border-gray-200 w-24">新出价</th>
                <th className="p-3 border-r border-gray-200 w-24">原百分比</th>
                <th className="p-3 border-r border-gray-200 w-24">新百分比</th>
                <th className="p-3 border-r border-gray-200 w-20">原CPC</th>
                <th className="p-3 w-20">新CPC</th>
              </tr>
            </thead>
            <tbody>
              <tr className="bg-red-50 border-b border-red-100">
                <td colSpan={9} className="p-2 text-xs font-bold text-red-600 pl-3">Fixed bids (固定竞价)</td>
              </tr>
              {renderRow(0, true)}
              {renderRow(1)}
              {renderRow(2)}
              <tr className="bg-purple-50 border-b border-purple-100">
                <td colSpan={9} className="p-2 text-xs font-bold text-purple-600 pl-3">up and down (动态竞价-提高和降低)</td>
              </tr>
              {renderRow(3, true)}
              {renderRow(4)}
              {renderRow(5)}
              <tr className="bg-blue-50 border-b border-blue-100">
                <td colSpan={9} className="p-2 text-xs font-bold text-blue-600 pl-3">down only (动态竞价-仅降低)</td>
              </tr>
              {renderRow(6, true)}
              {renderRow(7)}
              {renderRow(8)}
            </tbody>
          </table>
        </div>
        <div className="p-4 bg-gray-50 text-xs text-gray-500 space-y-1 border-t border-gray-200">
          <p className="font-medium mb-1">说明：</p>
          <ul className="list-disc list-inside space-y-1 ml-1">
            <li>输入原出价/新出价/原百分比/新百分比，会自动计算对应的原CPC和新CPC。</li>
            <li>实际最高CPC = Bid × (1 + 百分比/100) × 最高倍数。</li>
            <li>百分比输入如“28”即代表28%，不需要输入%号。</li>
            <li>最高倍数由策略和广告位决定（TOP/1.5/2等）。</li>
          </ul>
        </div>
      </Card>
    </div>
  )
}

export default AdCalculatorPage
