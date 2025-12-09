import React, { useState, useEffect } from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import { Calculator, TrendingUp, Info, AlertCircle, Star, Settings2, Store } from 'lucide-react'

const AmazonRatingSalesReverse = () => {
  const [ratings, setRatings] = useState<Record<number, number>>({ 5: 22, 4: 1, 3: 8, 2: 0, 1: 5 })
  const [targetRating, setTargetRating] = useState(4.5)
  const [neededReviews, setNeededReviews] = useState<number | string>(0)
  const [currentScore, setCurrentScore] = useState(0)
  const [totalRatings, setTotalRatings] = useState(0)
  const [currentRatingVal, setCurrentRatingVal] = useState(0)

  const [newRatingsCount, setNewRatingsCount] = useState(10)
  const [ratingRateMin, setRatingRateMin] = useState(8.0)
  const [ratingRateMax, setRatingRateMax] = useState(10.0)
  const [salesEstimate, setSalesEstimate] = useState({ min: 0, max: 0 })

  const [feedbackCount, setFeedbackCount] = useState(5)
  const [feedbackRateMin, setFeedbackRateMin] = useState(0.6)
  const [feedbackRateMax, setFeedbackRateMax] = useState(0.8)
  const [storeSalesEstimate, setStoreSalesEstimate] = useState({ min: 0, max: 0 })

  const COLORS = ['#22c55e', '#84cc16', '#eab308', '#f97316', '#ef4444']

  useEffect(() => {
    const total = Object.values(ratings).reduce((a, b) => a + b, 0)
    const score = ratings[5] * 5 + ratings[4] * 4 + ratings[3] * 3 + ratings[2] * 2 + ratings[1] * 1
    const currentR = total === 0 ? 0 : score / total
    setTotalRatings(total)
    setCurrentScore(score)
    setCurrentRatingVal(currentR)

    if (targetRating >= 5) {
      setNeededReviews('无法计算')
    } else if (currentR >= targetRating) {
      setNeededReviews(0)
    } else {
      const numerator = targetRating * total - score
      const denominator = 5 - targetRating
      const result = Math.ceil(numerator / denominator)
      setNeededReviews(result > 0 ? result : 0)
    }
  }, [ratings, targetRating])

  useEffect(() => {
    const rMin = ratingRateMin > 0 ? ratingRateMin / 100 : 0.08
    const rMax = ratingRateMax > 0 ? ratingRateMax / 100 : 0.1
    const maxSales = Math.round(newRatingsCount / rMin)
    const minSales = Math.round(newRatingsCount / rMax)
    setSalesEstimate({ min: minSales, max: maxSales })
  }, [newRatingsCount, ratingRateMin, ratingRateMax])

  useEffect(() => {
    const fMin = feedbackRateMin > 0 ? feedbackRateMin / 100 : 0.006
    const fMax = feedbackRateMax > 0 ? feedbackRateMax / 100 : 0.008
    const maxStoreSales = Math.round(feedbackCount / fMin)
    const minStoreSales = Math.round(feedbackCount / fMax)
    setStoreSalesEstimate({ min: minStoreSales, max: maxStoreSales })
  }, [feedbackCount, feedbackRateMin, feedbackRateMax])

  const handleRatingChange = (star: number, value: string) => {
    setRatings((prev) => ({ ...prev, [star]: parseInt(value) || 0 }))
  }

  const chartData = [
    { name: '5星', count: ratings[5], color: COLORS[0] },
    { name: '4星', count: ratings[4], color: COLORS[1] },
    { name: '3星', count: ratings[3], color: COLORS[2] },
    { name: '2星', count: ratings[2], color: COLORS[3] },
    { name: '1星', count: ratings[1], color: COLORS[4] },
  ]

  return (
    <div className="max-w-5xl mx-auto p-4 space-y-6 bg-gray-50 min-h-screen font-sans text-gray-800">
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-indigo-900 flex items-center gap-2">
            <Star className="w-8 h-8 text-indigo-600" />
            好评及销量反推计算器
          </h1>
          <p className="text-gray-500 mt-1 text-sm">Listing 补单计算 + 销量反推 (支持自定义留评率)</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-7 space-y-6">
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 h-full flex flex-col">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2 text-gray-800">
              <Star className="w-5 h-5 text-yellow-500 fill-yellow-500" />
              Listing 评分补单计算
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-8 mb-6">
              <div className="space-y-3">
                {[5, 4, 3, 2, 1].map((star) => (
                  <div key={star} className="flex items-center gap-3">
                    <span className="w-8 font-medium text-gray-600 text-sm">{star}★</span>
                    <div className="flex-1 relative">
                      <input
                        type="number"
                        min="0"
                        value={ratings[star]}
                        onChange={(e) => handleRatingChange(star, e.target.value)}
                        className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-indigo-500 outline-none transition bg-gray-50"
                        placeholder="0"
                      />
                    </div>
                  </div>
                ))}
              </div>

              <div className="h-[200px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} layout="vertical" margin={{ top: 0, right: 10, left: 0, bottom: 0 }}>
                    <XAxis type="number" hide />
                    <YAxis dataKey="name" type="category" width={30} tick={{ fontSize: 12 }} />
                    <Bar dataKey="count" radius={[0, 4, 4, 0]} barSize={20}>
                      {chartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="mb-6 p-4 bg-indigo-50 rounded-lg border border-indigo-100">
              <div className="flex justify-between mb-2">
                <label className="font-medium text-indigo-900 text-sm">目标星级</label>
                <span className="font-bold text-indigo-600 text-lg">{targetRating}</span>
              </div>
              <input
                type="range"
                min="3.0"
                max="4.9"
                step="0.1"
                value={targetRating}
                onChange={(e) => setTargetRating(parseFloat(e.target.value))}
                className="w-full h-2 bg-indigo-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
              />
            </div>

            <div className="bg-gray-900 text-white p-5 rounded-xl mt-auto">
              <div className="flex justify-between items-center mb-4 border-b border-gray-700 pb-4">
                <div>
                  <div className="text-gray-400 text-xs uppercase tracking-wider">当前评分</div>
                  <div className="text-xl font-bold text-yellow-400">{currentRatingVal.toFixed(4)}</div>
                </div>
                <div className="text-right">
                  <div className="text-gray-400 text-xs uppercase tracking-wider">总评价数</div>
                  <div className="text-xl font-bold">{totalRatings}</div>
                </div>
              </div>
              <div className="flex items-center justify-between mb-2">
                <div className="text-gray-300 text-sm">需增加 5星好评：</div>
                <div className="text-3xl font-bold text-green-400">
                  {neededReviews} <span className="text-sm text-gray-500 font-normal">个</span>
                </div>
              </div>
              {typeof neededReviews === 'number' && neededReviews > totalRatings * 0.5 && totalRatings > 10 && (
                <div className="mt-3 flex items-start gap-2 text-orange-200 text-xs bg-orange-900/40 p-2 rounded border border-orange-800/50">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-orange-400" />
                  <span>警告：需补单数量较大（超过当前总数50%），操作风险极高，建议分批进行。</span>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="lg:col-span-5 space-y-6">
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2 text-gray-800">
              <TrendingUp className="w-5 h-5 text-green-600" />
              Listing 销量反推
            </h2>
            <div className="bg-green-50 p-3 rounded-lg border border-green-100 mb-4">
              <div className="flex items-center gap-2 mb-2 text-green-800 font-medium text-sm">
                <Settings2 className="w-4 h-4" />
                自定义留评率 (%)
              </div>
              <div className="flex items-center gap-2">
                <input type="number" value={ratingRateMin} onChange={(e) => setRatingRateMin(parseFloat(e.target.value))} className="w-full px-2 py-1 text-sm border border-green-200 rounded text-center" />
                <span className="text-gray-400">-</span>
                <input type="number" value={ratingRateMax} onChange={(e) => setRatingRateMax(parseFloat(e.target.value))} className="w-full px-2 py-1 text-sm border border-green-200 rounded text-center" />
              </div>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">新增 Ratings 数量</label>
                <input type="number" value={newRatingsCount} onChange={(e) => setNewRatingsCount(parseInt(e.target.value) || 0)} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 outline-none" />
              </div>
              <div className="pt-2 border-t border-gray-100">
                <div className="text-xs text-gray-400 mb-1">预估 Listing 销量</div>
                <div className="text-2xl font-bold text-gray-800">{salesEstimate.min} ~ {salesEstimate.max}</div>
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2 text-gray-800">
              <Store className="w-5 h-5 text-blue-600" />
              店铺销量反推 (Feedback)
            </h2>
            <div className="bg-blue-50 p-3 rounded-lg border border-blue-100 mb-4">
              <div className="flex items-center gap-2 mb-2 text-blue-800 font-medium text-sm">
                <Settings2 className="w-4 h-4" />
                Feedback率 (%) (默认 0.6-0.8)
              </div>
              <div className="flex items-center gap-2">
                <input type="number" step="0.1" value={feedbackRateMin} onChange={(e) => setFeedbackRateMin(parseFloat(e.target.value))} className="w-full px-2 py-1 text-sm border border-blue-200 rounded text-center" />
                <span className="text-gray-400">-</span>
                <input type="number" step="0.1" value={feedbackRateMax} onChange={(e) => setFeedbackRateMax(parseFloat(e.target.value))} className="w-full px-2 py-1 text-sm border border-blue-200 rounded text-center" />
              </div>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">新增 Feedback 数量</label>
                <input type="number" value={feedbackCount} onChange={(e) => setFeedbackCount(parseInt(e.target.value) || 0)} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
              </div>
              <div className="pt-2 border-t border-gray-100">
                <div className="text-xs text-gray-400 mb-1">预估店铺总销量</div>
                <div className="text-2xl font-bold text-gray-800">{storeSalesEstimate.min} ~ {storeSalesEstimate.max}</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 mt-6">
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2 text-gray-700">
          <Info className="w-5 h-5" />
          计算逻辑与原理说明
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 text-sm text-gray-600 leading-relaxed">
          <div>
            <h4 className="font-bold text-gray-900 mb-2">1. 补单计算原理</h4>
            <p className="mb-2">核心是求解加权平均数的逆运算。设当前总分为 S，总人数为 N，目标分数为 T，需要增加的5星数量为 X。</p>
            <p className="font-mono bg-gray-100 p-2 rounded mb-2 text-xs">公式：X = (T × N - S) / (5 - T)</p>
            <p>因为分母是 (5 - T)，当目标分数越接近5分，分母越小，所需的 X 会呈指数级增长。这就是为什么从 4.3 升到 4.5 很难的原因。</p>
          </div>
          <div>
            <h4 className="font-bold text-gray-900 mb-2">2. 运营经验总结 </h4>
            <ul className="list-disc pl-5 space-y-1">
              <li><span className="font-medium">留评率：</span>一般为销量的 8%~10% (Dip Powder类目)。</li>
              <li><span className="font-medium">Review占比：</span>文字评论通常只占总Rating的 25%~33%。如果超过 50%，通常是极端好或极端差的产品。</li>
              <li><span className="font-medium">变体影响：</span>合并变体导致销量波动，但Rating通常稳定；合并僵尸链接会改变Rating但Feedback不变。</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}

export default AmazonRatingSalesReverse

