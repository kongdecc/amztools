'use client'

import React, { useState } from 'react'
import { Card, Input } from '@/components/SharedUI'
import { Calculator, RotateCcw, Box, Info, Settings, Edit } from 'lucide-react'

// --- Local UI Components ---
const Button = ({ children, className = "", variant = "primary", ...props }: any) => {
  const baseClass = "px-4 py-2 rounded-lg text-sm font-medium flex items-center justify-center gap-2 transition-colors";
  const variants: any = {
    primary: "bg-blue-600 text-white hover:bg-blue-700",
    secondary: "bg-gray-100 text-gray-700 hover:bg-gray-200",
  };
  return <button className={`${baseClass} ${variants[variant]} ${className}`} {...props}>{children}</button>;
};

// --- Logic ---

function floorDiv(a: number, b: number) {
  if (!a || !b || a <= 0 || b <= 0) return 0;
  return Math.floor(a / b);
}

// 计算单个平面（给定产品平面尺寸 a×b，在箱子 L×W 内）：
// 1) 主方案：a 沿 L，b 沿 W
// 2) 补洞方案：旋转 b×a 填充剩余长或宽
// 返回每层最大件数 + 详细描述
function calcLayerWithPatch(L: number, W: number, a: number, b: number) {
  // 主方案
  const nL_main = floorDiv(L, a);
  const nW_main = floorDiv(W, b);
  let mainCount = nL_main * nW_main;

  // 如果主方案都放不下，直接返回 0
  if (mainCount === 0) {
    return {
      perLayer: 0,
      desc: '此平面方案下无法摆放完整一件',
      detail: { mainCount: 0, patchCount: 0 }
    };
  }

  // 补洞1：长向剩余，用旋转 b×a 补
  const L_res = L - nL_main * a;
  let patchCountL = 0;
  if (L_res > 0) {
    const nL_patch = floorDiv(L_res, b);
    const nW_patch = floorDiv(W, a);
    patchCountL = nL_patch * nW_patch;
  }
  const totalL = mainCount + patchCountL;

  // 补洞2：宽向剩余，用旋转 b×a 补
  const W_res = W - nW_main * b;
  let patchCountW = 0;
  if (W_res > 0) {
    const nL_patch2 = floorDiv(L, b);
    const nW_patch2 = floorDiv(W_res, a);
    patchCountW = nL_patch2 * nW_patch2;
  }
  const totalW = mainCount + patchCountW;

  // 选择补洞效果更好的方案
  if (totalL >= totalW) {
    return {
      perLayer: totalL,
      desc:
        `主摆：沿长 ${nL_main} 件 × 沿宽 ${nW_main} 件，共 ${mainCount} 件；` +
        (patchCountL > 0
          ? `长向余量补洞：再放 ${patchCountL} 件；`
          : '长向余量不足以补洞；') +
        `每层合计 ${totalL} 件`,
      detail: { mainCount, patchCount: patchCountL, patchType: 'L' }
    };
  } else {
    return {
      perLayer: totalW,
      desc:
        `主摆：沿长 ${nL_main} 件 × 沿宽 ${nW_main} 件，共 ${mainCount} 件；` +
        (patchCountW > 0
          ? `宽向余量补洞：再放 ${patchCountW} 件；`
          : '宽向余量不足以补洞；') +
        `每层合计 ${totalW} 件`,
      detail: { mainCount, patchCount: patchCountW, patchType: 'W' }
    };
  }
}

// 生成全部朝向，并结合高度方向叠层，选出最佳装箱方案
function calculateBestPacking(carton: { L: number, W: number, H: number }, unit: { l: number, w: number, h: number }) {
  const { L: CL, W: CW, H: CH } = carton;
  const { l, w, h } = unit;

  const orientations = [];

  // 三组基本：高度 = l, w, h；平面为剩余两边
  const dims = [
    { height: l, a: w, b: h, name: '高度=l，平面=w×h' },
    { height: l, a: h, b: w, name: '高度=l，平面=h×w' },

    { height: w, a: l, b: h, name: '高度=w，平面=l×h' },
    { height: w, a: h, b: l, name: '高度=w，平面=h×l' },

    { height: h, a: l, b: w, name: '高度=h，平面=l×w' },
    { height: h, a: w, b: l, name: '高度=h，平面=w×l' }
  ];

  for (const d of dims) {
    orientations.push(d);
  }

  let best = {
    total: 0,
    perLayer: 0,
    layers: 0,
    orientation: null as any,
    desc: '',
    index: -1
  };

  orientations.forEach((ori, idx) => {
    const hUnit = ori.height;
    const layers = floorDiv(CH, hUnit);
    if (layers === 0) return;

    // 平面尝试：产品平面 a×b 放在箱子 CL×CW 内
    const layerResult = calcLayerWithPatch(CL, CW, ori.a, ori.b);
    if (layerResult.perLayer === 0) return;

    const total = layerResult.perLayer * layers;

    if (total > best.total) {
      best = {
        total,
        perLayer: layerResult.perLayer,
        layers,
        orientation: ori,
        desc: layerResult.desc,
        index: idx
      };
    }
  });

  return best;
}

export default function CartonCalculatorAdvanced() {
  const [mode, setMode] = useState<'auto' | 'manual'>('auto');
  const [inputs, setInputs] = useState({
    cartonL: '',
    cartonW: '',
    cartonH: '',
    cartonActualWeight: '',
    unitL: '',
    unitW: '',
    unitH: '',
    unitWeight: '',
    manualPieces: '',
    rulePreset: 'express_6000',
    volDivisor: '6000'
  });

  const [result, setResult] = useState<any>(null);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { id, value } = e.target;
    
    if (id === 'rulePreset') {
      let newDivisor = inputs.volDivisor;
      if (value === 'express_6000') newDivisor = '6000';
      else if (value === 'air_5000') newDivisor = '5000';
      
      setInputs(prev => ({ ...prev, [id]: value, volDivisor: newDivisor }));
    } else {
      setInputs(prev => ({ ...prev, [id]: value }));
    }
  };

  const handleReset = () => {
    setInputs({
      cartonL: '',
      cartonW: '',
      cartonH: '',
      cartonActualWeight: '',
      unitL: '',
      unitW: '',
      unitH: '',
      unitWeight: '',
      manualPieces: '',
      rulePreset: 'express_6000',
      volDivisor: '6000'
    });
    setResult(null);
  };

  const handleCalculate = () => {
    const cartonL = parseFloat(inputs.cartonL);
    const cartonW = parseFloat(inputs.cartonW);
    const cartonH = parseFloat(inputs.cartonH);

    const unitL = parseFloat(inputs.unitL);
    const unitW = parseFloat(inputs.unitW);
    const unitH = parseFloat(inputs.unitH);

    const cartonActualWeight = parseFloat(inputs.cartonActualWeight);
    const unitWeight = parseFloat(inputs.unitWeight);
    const manualPieces = parseInt(inputs.manualPieces);

    const divisor = parseFloat(inputs.volDivisor);

    if (!cartonL || !cartonW || !cartonH || !unitL || !unitW || !unitH || !divisor) {
      setResult({ error: '请至少填写：箱子尺寸、单件尺寸、除数。' });
      return;
    }

    if (mode === 'manual' && (!manualPieces || manualPieces <= 0)) {
        setResult({ error: '请输入有效的每箱装箱数量。' });
        return;
    }

    const carton = { L: cartonL, W: cartonW, H: cartonH };
    const unit = { l: unitL, w: unitW, h: unitH };

    let piecesPerCarton = 0;
    let best = null;

    if (mode === 'auto') {
        // 1. 算最佳装箱方案（多朝向 + 补洞）
        best = calculateBestPacking(carton, unit);

        if (!best || best.total === 0) {
            setResult({ error: '注意：在尝试多种朝向和补洞后，仍无法装入完整一件，请检查箱规或产品尺寸。' });
            return;
        }
        piecesPerCarton = best.total;
    } else {
        // 手动模式
        piecesPerCarton = manualPieces;
        // 仅作参考计算
        best = calculateBestPacking(carton, unit);
    }

    // 2. 箱体积 & 体积重
    const volumeCm3 = cartonL * cartonW * cartonH;         // cm³
    const volumeM3 = volumeCm3 / 1000000.0;                 // m³
    const volWeight = volumeCm3 / divisor;                  // kg

    // 3. 单件体积与利用率
    const unitVolume = unitL * unitW * unitH;
    const usedVolume = unitVolume * piecesPerCarton;
    const utilization = usedVolume / volumeCm3;             // 比例

    let utilClass = 'text-green-600'; // mid
    let utilText = '';
    if (utilization < 0.6) {
      utilClass = 'text-orange-500'; // low
      utilText = '体积利用率偏低';
    } else if (utilization < 0.85) {
      utilClass = 'text-green-600'; // mid
      utilText = '体积利用率中等';
    } else {
      utilClass = 'text-blue-600'; // high
      utilText = '体积利用率较高';
    }
    
    // 如果利用率超过100%，给个警告
    if (utilization > 1) {
        utilClass = 'text-red-600';
        utilText = '体积利用率超100%，可能装不下！';
    }

    // 4. 算实重
    let actualWeight = 0;
    let actualWeightExplain = '';
    let hasActualWeight = false;

    if (!isNaN(cartonActualWeight)) {
      actualWeight = cartonActualWeight;
      actualWeightExplain = '（按已知整箱实重）';
      hasActualWeight = true;
    } else if (!isNaN(unitWeight)) {
      actualWeight = unitWeight * piecesPerCarton;
      actualWeightExplain = `（按单件实重 × 装箱件数估算）`;
      hasActualWeight = true;
    } else {
      actualWeight = 0;
      hasActualWeight = false;
    }

    // 5. 判断哪种计费
    let chargeType = '';
    let chargeTag = null;
    let compareText = '';

    if (hasActualWeight) {
      if (volWeight > actualWeight) {
        chargeType = '按体积重计费';
        chargeTag = <span className="inline-block px-2 py-0.5 rounded text-xs bg-orange-500 text-white ml-1">体积重计费</span>;
      } else {
        chargeType = '按实重计费';
        chargeTag = <span className="inline-block px-2 py-0.5 rounded text-xs bg-green-500 text-white ml-1">实重计费</span>;
      }
      compareText = `计费按：${chargeType}`;
    } else {
      compareText = '尚未填写实重/单件重量，无法判断按体积重还是实重计费。';
    }

    setResult({
      success: true,
      mode,
      best,
      piecesPerCarton,
      volumeCm3,
      volumeM3,
      volWeight,
      unitVolume,
      usedVolume,
      utilization,
      utilClass,
      utilText,
      actualWeight,
      actualWeightExplain,
      hasActualWeight,
      chargeType,
      chargeTag,
      compareText,
      divisor
    });
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="text-center space-y-2 mb-8">
        <h1 className="text-2xl font-bold text-gray-800">箱规装箱数量 & 体积重/实重 计算器</h1>
        <p className="text-gray-500 text-sm">
            {mode === 'auto' 
                ? '支持 6 种朝向 + 单层补洞混合摆放，估算更接近实际装箱结果' 
                : '已知装箱数量，快速计算体积重、实重及利用率'
            }
        </p>
      </div>
      
      {/* Mode Switcher */}
      <div className="flex justify-center mb-6">
        <div className="bg-gray-100 p-1 rounded-lg flex gap-1">
            <button 
                onClick={() => setMode('auto')}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${mode === 'auto' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
            >
                <div className="flex items-center gap-2">
                    <Box className="w-4 h-4" />
                    智能测算装箱数
                </div>
            </button>
            <button 
                onClick={() => setMode('manual')}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${mode === 'manual' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
            >
                <div className="flex items-center gap-2">
                    <Edit className="w-4 h-4" />
                    已知装箱数
                </div>
            </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* ① 箱规 */}
        <Card className="p-4 space-y-4">
          <h2 className="font-semibold border-l-4 border-blue-500 pl-2">① 箱规（外箱尺寸）</h2>
          
          <div className="space-y-2">
            <label className="text-sm text-gray-600">箱子尺寸 L × W × H（cm）</label>
            <div className="grid grid-cols-3 gap-2">
              <Input id="cartonL" type="number" step="0.1" min="0" placeholder="长 L" value={inputs.cartonL} onChange={handleInputChange} />
              <Input id="cartonW" type="number" step="0.1" min="0" placeholder="宽 W" value={inputs.cartonW} onChange={handleInputChange} />
              <Input id="cartonH" type="number" step="0.1" min="0" placeholder="高 H" value={inputs.cartonH} onChange={handleInputChange} />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm text-gray-600">每箱实重（kg，选填）</label>
            <Input id="cartonActualWeight" type="number" step="0.01" min="0" placeholder="例：20" value={inputs.cartonActualWeight} onChange={handleInputChange} />
          </div>

          <div className="space-y-2">
            <label className="text-sm text-gray-600">或：单件实重（kg，选填）</label>
            <Input id="unitWeight" type="number" step="0.01" min="0" placeholder="例：0.25" value={inputs.unitWeight} onChange={handleInputChange} />
          </div>
        </Card>

        {/* ② 单件尺寸 & 数量 */}
        <Card className="p-4 space-y-4">
          <h2 className="font-semibold border-l-4 border-blue-500 pl-2">② 单件产品尺寸</h2>
          
          <div className="space-y-2">
            <label className="text-sm text-gray-600">单件尺寸 l × w × h（cm）</label>
            <div className="grid grid-cols-3 gap-2">
              <Input id="unitL" type="number" step="0.01" min="0" placeholder="长 l" value={inputs.unitL} onChange={handleInputChange} />
              <Input id="unitW" type="number" step="0.01" min="0" placeholder="宽 w" value={inputs.unitW} onChange={handleInputChange} />
              <Input id="unitH" type="number" step="0.01" min="0" placeholder="高 h" value={inputs.unitH} onChange={handleInputChange} />
            </div>
          </div>

          {mode === 'manual' && (
             <div className="space-y-2 pt-2 border-t border-gray-100">
                <label className="text-sm text-blue-600 font-medium">每箱装箱数量（件）</label>
                <Input id="manualPieces" type="number" step="1" min="1" placeholder="例：50" value={inputs.manualPieces} onChange={handleInputChange} className="border-blue-300 ring-1 ring-blue-100" />
             </div>
          )}

          {mode === 'auto' && (
            <div className="text-xs text-gray-500 bg-gray-50 p-2 rounded">
              ※ 本工具会尝试产品的多种朝向，单层主方案 + 边角补洞摆放，结果较简单整除更接近实际。
            </div>
          )}
        </Card>

        {/* ③ 计费规则 */}
        <Card className="p-4 space-y-4">
          <h2 className="font-semibold border-l-4 border-blue-500 pl-2">③ 计费规则（体积重）</h2>
          
          <div className="space-y-2">
            <label className="text-sm text-gray-600">计费方式预设</label>
            <select 
              id="rulePreset" 
              className="flex h-9 w-full rounded-md border border-gray-300 bg-white px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-indigo-500"
              value={inputs.rulePreset}
              onChange={handleInputChange}
            >
              <option value="express_6000">快递常用：L×W×H ÷ 6000</option>
              <option value="air_5000">空运（部分）：L×W×H ÷ 5000</option>
              <option value="custom">自定义除数</option>
            </select>
          </div>

          <div className="space-y-2">
            <label className="text-sm text-gray-600">体积重除数</label>
            <Input id="volDivisor" type="number" step="1" min="1" value={inputs.volDivisor} onChange={handleInputChange} />
          </div>

          <div className="text-xs text-gray-500">
            常见：国内/国际快递 6000，部分空运 5000，具体以快递/货代报价为准。
          </div>

          <div className="flex gap-2 pt-2">
            <Button variant="primary" onClick={handleCalculate} className="flex-1">
              <Calculator className="w-4 h-4" /> 开始计算
            </Button>
            <Button variant="secondary" onClick={handleReset} className="flex-1">
              <RotateCcw className="w-4 h-4" /> 清空
            </Button>
          </div>
        </Card>

        {/* ④ 结果显示 */}
        <Card className="p-4 space-y-4">
          <h2 className="font-semibold border-l-4 border-blue-500 pl-2">④ 结果</h2>
          
          <div className="text-sm">
            {!result && (
              <div className="text-gray-500 py-4 text-center">
                请在左侧输入完整数据后，点击“开始计算”。
              </div>
            )}

            {result && result.error && (
              <div className="text-red-500 p-2 bg-red-50 rounded">
                <span className="inline-block px-1.5 py-0.5 rounded text-xs bg-red-500 text-white mr-1">注意</span>
                {result.error}
              </div>
            )}

            {result && result.success && (
              <div className="space-y-4">
                <div>
                  <div className="font-bold mb-1 flex items-center gap-1">
                    一、装箱结果
                    {result.mode === 'auto' 
                        ? <span className="inline-block px-1.5 py-0.5 rounded text-xs bg-blue-500 text-white font-normal">智能测算</span>
                        : <span className="inline-block px-1.5 py-0.5 rounded text-xs bg-purple-500 text-white font-normal">指定数量</span>
                    }
                  </div>
                  <p>每箱装箱：<strong className="text-blue-600 text-lg">{result.piecesPerCarton}</strong> 件</p>
                  
                  {result.mode === 'auto' && (
                    <>
                        <p className="text-xs text-gray-500 mt-1">
                            (每层 {result.best.perLayer} 件 × {result.best.layers} 层)
                        </p>
                        <p className="text-xs text-gray-600 mt-1">
                            朝向：{result.best.orientation.name}
                        </p>
                        <p className="text-xs text-gray-500 mt-1 bg-gray-50 p-1 rounded">
                            {result.best.desc}
                        </p>
                    </>
                  )}

                  {result.mode === 'manual' && result.best && result.best.total > 0 && (
                      <div className="mt-2 text-xs bg-gray-50 p-2 rounded border border-gray-100">
                          <p className="text-gray-500 mb-1">参考：系统智能测算最大可装 <strong>{result.best.total}</strong> 件</p>
                          {result.piecesPerCarton > result.best.total && (
                              <p className="text-orange-500">注意：您输入的数量大于测算最大值，请确认是否能装下。</p>
                          )}
                      </div>
                  )}
                </div>

                <div>
                  <div className="font-bold mb-1">二、体积及利用率</div>
                  <p>箱体积：{result.volumeCm3.toFixed(0)} cm³ ≈ {result.volumeM3.toFixed(4)} m³</p>
                  <p>单件体积：{result.unitVolume.toFixed(0)} cm³</p>
                  <p>装箱总体积：{result.usedVolume.toFixed(0)} cm³</p>
                  <p>利用率：<span className={`${result.utilClass} font-bold`}>{(result.utilization * 100).toFixed(1)}%</span></p>
                  <p className="text-xs text-gray-500">{result.utilText}</p>
                </div>

                <div>
                  <div className="font-bold mb-1">三、体积重 / 实重</div>
                  <p>体积重：<strong className="text-gray-800">{result.volWeight.toFixed(2)} kg</strong> <span className="text-xs text-gray-400">(/ {result.divisor})</span></p>
                  {result.hasActualWeight ? (
                    <p>每箱实重：<strong>{result.actualWeight.toFixed(2)} kg</strong> <span className="text-xs text-gray-500">{result.actualWeightExplain}</span></p>
                  ) : (
                    <p className="text-gray-400 text-xs">未提供重量，仅展示体积重</p>
                  )}
                </div>

                <div>
                  <div className="font-bold mb-1">四、计费判断</div>
                  <div className="flex items-center flex-wrap">
                    {result.hasActualWeight ? (
                      <>
                        <span className="font-bold mr-1">{result.chargeType}</span>
                        {result.chargeTag}
                      </>
                    ) : (
                      <span className="text-gray-500">{result.compareText}</span>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </Card>
      </div>

      <div className="text-center text-xs text-gray-400 mt-8 pb-4">
        本工具提供“智能测算”与“已知数量”两种模式，仅作估算参考；实际出货请以打样装箱结果为准。
      </div>
    </div>
  )
}
