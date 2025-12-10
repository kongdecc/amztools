'use client'

import React, { useState } from 'react';
import { Calculator, RotateCcw } from 'lucide-react';

const Card = ({ children, className = "", ...props }: any) => (
  <div className={`bg-white rounded-xl border border-gray-100 shadow-sm ${className}`} {...props}>{children}</div>
);

const Input = ({ className = "", ...props }: any) => (
  <input className={`flex h-10 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm transition-all focus:border-blue-500 focus:ring-2 focus:ring-blue-200 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50 ${className}`} {...props} />
);

const Button = ({ children, className = "", variant = "primary", ...props }: any) => {
  const baseClass = "px-6 py-2.5 rounded-full text-sm font-semibold flex items-center justify-center gap-2 transition-all transform active:scale-95 shadow-sm";
  const variants: any = {
    primary: "bg-gradient-to-r from-blue-600 to-blue-500 text-white hover:from-blue-700 hover:to-blue-600 shadow-blue-200",
    secondary: "bg-gray-100 text-gray-700 hover:bg-gray-200",
    outline: "border border-gray-300 text-gray-700 hover:bg-gray-50"
  };
  return <button className={`${baseClass} ${variants[variant]} ${className}`} {...props}>{children}</button>;
};

export default function MaxReserveFeeCalculator() {
  const [currentCapacity, setCurrentCapacity] = useState<string>('');
  const [plannedCapacity, setPlannedCapacity] = useState<string>('');
  const [estimatedSales, setEstimatedSales] = useState<string>('');
  const [result, setResult] = useState<any>(null);

  const calculate = () => {
    const current = parseFloat(currentCapacity);
    const planned = parseFloat(plannedCapacity);
    const sales = parseFloat(estimatedSales);

    if (isNaN(current) || isNaN(planned) || isNaN(sales) || current <= 0 || planned <= 0 || sales <= 0) {
      alert('请输入有效的正数');
      return;
    }

    const newTotalCapacity = current + planned;
    const extraCapacityRatio = planned / newTotalCapacity;
    const proportionalSales = sales * extraCapacityRatio;
    const performancePointsRate = 0.15;
    const totalPerformancePoints = proportionalSales * performancePointsRate;
    const maxReserveFee = totalPerformancePoints / planned;

    setResult({
      current,
      planned,
      sales,
      newTotalCapacity,
      extraCapacityRatio,
      proportionalSales,
      totalPerformancePoints,
      maxReserveFee
    });
  };

  const reset = () => {
    setCurrentCapacity('');
    setPlannedCapacity('');
    setEstimatedSales('');
    setResult(null);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-2 mb-2">
        <Calculator className="h-6 w-6 text-emerald-600" />
        <h2 className="text-xl font-bold text-gray-800">白嫖库容的最高预留费计算工具</h2>
      </div>
      <Card className="p-8 md:p-10">
        <div className="text-center mb-8">
          <p className="text-gray-500 text-sm mb-4">作者：必胜哥&nbsp;&nbsp;&nbsp;&nbsp;公众号：必胜哥的三板斧</p>
          <div className="flex justify-center">
            <div className="text-center">
              <img 
                src="https://tc.z.wiki/autoupload/edKd7EnrdtB-UwY97x0oKsS6MvGWw9YIYwMnL2_E4yayl5f0KlZfm6UsKj-HyTuv/20250705/KWaE/430X430/qrcode_for_gh_3938b401b10d_430.jpg" 
                alt="公众号二维码" 
                className="w-32 h-32 rounded-xl shadow-lg border-2 border-white mx-auto hover:scale-105 transition-transform"
              />
              <p className="text-xs text-gray-400 mt-2">扫码关注公众号</p>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="space-y-2">
            <label htmlFor="currentCapacity" className="block text-sm font-medium text-gray-700">
              现有FBA库容限制 (立方英尺)
            </label>
            <Input
              type="number"
              id="currentCapacity"
              placeholder="填写立方英尺"
              value={currentCapacity}
              onChange={(e: any) => setCurrentCapacity(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="plannedCapacity" className="block text-sm font-medium text-gray-700">
              计划申请FBA库容 (立方英尺)
            </label>
            <Input
              type="number"
              id="plannedCapacity"
              placeholder="填写立方英尺"
              value={plannedCapacity}
              onChange={(e: any) => setPlannedCapacity(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="estimatedSales" className="block text-sm font-medium text-gray-700">
              申请月份销售额预估 (美元)
            </label>
            <Input
              type="number"
              id="estimatedSales"
              placeholder="填写美元金额"
              value={estimatedSales}
              onChange={(e: any) => setEstimatedSales(e.target.value)}
              onKeyDown={(e: any) => {
                if (e.key === 'Enter') calculate();
              }}
            />
          </div>

          <div className="flex gap-4 pt-4">
            <Button onClick={calculate} className="flex-1 text-lg py-3">
              <Calculator className="w-5 h-5" />
              进行分析计算
            </Button>
            <Button variant="secondary" onClick={reset} className="px-4">
              <RotateCcw className="w-5 h-5" />
            </Button>
          </div>
        </div>

        {result && (
          <div className="mt-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="bg-gradient-to-r from-green-500 to-green-600 rounded-xl p-6 text-white shadow-lg shadow-green-200 mb-6">
              <div className="text-center">
                <div className="text-sm font-medium opacity-90 mb-1">白嫖库容的最高预留费</div>
                <div className="text-3xl font-bold">${result.maxReserveFee.toFixed(2)} <span className="text-lg font-normal opacity-90">每立方英尺</span></div>
              </div>
            </div>

            <div className="bg-gray-50 rounded-xl p-6 border border-gray-200 space-y-4 text-sm text-gray-700 leading-relaxed">
              <h3 className="font-semibold text-gray-900 border-b border-gray-200 pb-2 mb-3">详细计算过程：</h3>
              
              <div className="grid grid-cols-[auto,1fr] gap-x-3 gap-y-2">
                <span className="text-gray-500">1.</span>
                <div>
                  <span className="text-gray-500 block text-xs mb-0.5">新的总FBA库容限制</span>
                  {result.current.toFixed(2)} + {result.planned.toFixed(2)} = <span className="font-medium text-gray-900">{result.newTotalCapacity.toFixed(2)} 立方英尺</span>
                </div>

                <span className="text-gray-500">2.</span>
                <div>
                  <span className="text-gray-500 block text-xs mb-0.5">额外库容占比</span>
                  {result.planned.toFixed(2)} ÷ {result.newTotalCapacity.toFixed(2)} = <span className="font-medium text-gray-900">{(result.extraCapacityRatio * 100).toFixed(2)}%</span>
                </div>

                <span className="text-gray-500">3.</span>
                <div>
                  <span className="text-gray-500 block text-xs mb-0.5">按比例分摊销售额</span>
                  ${result.sales.toFixed(2)} × {(result.extraCapacityRatio * 100).toFixed(2)}% = <span className="font-medium text-gray-900">${result.proportionalSales.toFixed(2)}</span>
                </div>

                <span className="text-gray-500">4.</span>
                <div>
                  <span className="text-gray-500 block text-xs mb-0.5">绩效积分赚取率</span>
                  <span className="font-medium text-gray-900">每$1销售额产生$0.15积分</span>
                </div>

                <span className="text-gray-500">5.</span>
                <div>
                  <span className="text-gray-500 block text-xs mb-0.5">绩效积分总额</span>
                  ${result.proportionalSales.toFixed(2)} × $0.15 = <span className="font-medium text-gray-900">${result.totalPerformancePoints.toFixed(2)}</span>
                </div>

                <span className="text-gray-500">6.</span>
                <div>
                  <span className="text-gray-500 block text-xs mb-0.5">最高预留费</span>
                  ${result.totalPerformancePoints.toFixed(2)} ÷ {result.planned.toFixed(2)} = <span className="font-medium text-gray-900">${result.maxReserveFee.toFixed(2)} 每立方英尺</span>
                </div>
              </div>
            </div>
            
            <div className="mt-6 flex justify-center">
              <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
                <img 
                  src="https://tc.z.wiki/autoupload/edKd7EnrdtB-UwY97x0oKsS6MvGWw9YIYwMnL2_E4yayl5f0KlZfm6UsKj-HyTuv/20250705/KWaE/430X430/qrcode_for_gh_3938b401b10d_430.jpg" 
                  alt="公众号二维码" 
                  className="w-32 h-32 rounded-lg object-cover"
                />
                <p className="text-xs text-center text-gray-400 mt-2">扫码关注作者</p>
              </div>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
