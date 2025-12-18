import React, { useState, useEffect, useMemo } from 'react';
import { 
  Calculator, 
  Ticket, 
  Briefcase, 
  Percent, 
  Award, 
  Share2, 
  Coins, 
  Zap, 
  ShoppingBag, 
  DollarSign, 
  ShieldCheck, 
  Tags, 
  Star,
  RotateCcw,
  Check,
  AlertCircle,
  XCircle,
  ToggleLeft,
  ToggleRight
} from 'lucide-react';
import { Card } from '@/components/SharedUI';

const promoTypes = [
  { id: 'coupon', name: '优惠券 (Coupon)', defaultType: '$', defaultVal: 5, icon: Ticket },
  { id: 'b2b', name: 'B2B价格', defaultType: '%', defaultVal: 10, icon: Briefcase },
  { id: 'promo_unlimited', name: '促销-无限制型', defaultType: '%', defaultVal: 10, icon: Percent },
  { id: 'promo_priority', name: '促销-优先型', defaultType: '%', defaultVal: 10, icon: Award },
  { id: 'social_code', name: '社交媒体促销代码', defaultType: '%', defaultVal: 15, icon: Share2 },
  { id: 'jp_points', name: '日本站积分', defaultType: '%', defaultVal: 1, icon: Coins },
  { id: 'lightning_deal', name: '秒杀 (LD)', defaultType: '%', defaultVal: 20, icon: Zap },
  { id: 'outlet', name: '奥特莱斯 (Outlet)', defaultType: '%', defaultVal: 20, icon: ShoppingBag },
  { id: 'price_discount', name: '价格折扣', defaultType: '%', defaultVal: 10, icon: DollarSign },
  { id: 'brand_promo', name: '品牌定制促销', defaultType: '%', defaultVal: 10, icon: ShieldCheck },
  { id: 'brand_coupon', name: '品牌定制优惠券', defaultType: '$', defaultVal: 5, icon: Tags },
  { id: 'prime_discount', name: 'Prime专享折扣', defaultType: '%', defaultVal: 20, icon: Star }
];

// 0=No Stack (不叠加), 1=Stack (叠加), 2=Optional (可自主选择)
const matrix = [
  [null, 1, 2, 2, 2, 1, 1, 1, 1, 1, 0, 1], // Coupon
  [1, null, 1, 1, 1, 0, 0, 0, 0, 1, 1, 0], // B2B
  [2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 2, 1], // Unlimited
  [2, 1, 1, 0, 0, 1, 1, 1, 1, 0, 2, 1], // Priority
  [2, 1, 1, 0, 0, 1, 1, 1, 1, 0, 2, 1], // Social
  [1, 0, 1, 1, 1, null, 1, 1, 1, 1, 1, 1], // JP Points
  [1, 0, 1, 1, 1, 1, null, null, 0, 1, 1, 0], // LD
  [1, 0, 1, 1, 1, 1, null, null, 0, 1, 1, 0], // Outlet
  [1, 0, 1, 1, 1, 1, 0, 0, null, 1, 1, 0], // Price Discount
  [1, 1, 1, 0, 0, 1, 1, 1, 1, 0, 2, 1], // Brand Promo
  [0, 1, 2, 2, 2, 1, 1, 1, 1, 2, null, 1], // Brand Coupon
  [1, 0, 1, 1, 1, 1, 0, 0, 0, 1, 1, null]  // Prime
];

const AmazonPromotionStackingCalculator = () => {
  const [basePrice, setBasePrice] = useState<number>(100.00);
  const [selectedPromos, setSelectedPromos] = useState<number[]>([]);
  const [promoValues, setPromoValues] = useState<{ [key: number]: { unit: string; val: number } }>({});
  const [optionalDecisions, setOptionalDecisions] = useState<{ [key: string]: boolean }>({});

  // Initialize promo values
  useEffect(() => {
    const initialValues: any = {};
    promoTypes.forEach((t, i) => {
      initialValues[i] = { unit: t.defaultType, val: t.defaultVal };
    });
    setPromoValues(initialValues);
  }, []);

  const handlePromoToggle = (index: number) => {
    if (selectedPromos.includes(index)) {
      setSelectedPromos(selectedPromos.filter(i => i !== index));
    } else {
      setSelectedPromos([...selectedPromos, index]);
    }
  };

  const handleValueChange = (index: number, field: 'unit' | 'val', value: any) => {
    setPromoValues({
      ...promoValues,
      [index]: { ...promoValues[index], [field]: value }
    });
  };

  const resetAll = () => {
    setSelectedPromos([]);
    setOptionalDecisions({});
    const initialValues: any = {};
    promoTypes.forEach((t, i) => {
      initialValues[i] = { unit: t.defaultType, val: t.defaultVal };
    });
    setPromoValues(initialValues);
  };

  const getDiscountValue = (index: number, price: number) => {
    const config = promoValues[index];
    if (!config) return 0;
    const val = parseFloat(config.val as any) || 0;
    if (config.unit === '%') return (price * val) / 100;
    return val;
  };

  const { conflicts, finalPrice, totalDeduction, discountPercent } = useMemo(() => {
    let conflictsList: any[] = [];
    let currentOptionalDecisions = { ...optionalDecisions };
    
    // 1. Identify Conflicts
    for (let i = 0; i < selectedPromos.length; i++) {
      for (let j = i + 1; j < selectedPromos.length; j++) {
        const idxA = selectedPromos[i];
        const idxB = selectedPromos[j];
        const status = matrix[idxA][idxB];
        const key = `${idxA}-${idxB}`;

        // Default optional to true (Stack) if new
        if (status === 2 && currentOptionalDecisions[key] === undefined) {
          currentOptionalDecisions[key] = true;
        }
        conflictsList.push({ idxA, idxB, status, key });
      }
    }

    // Calculate Final Price
    // Logic needs to be robust. 
    // Basic approach: Sum all "stackable" discounts.
    // Handle mutual exclusions by grouping or taking max?
    // The original code doesn't explicitly show the full calculation logic for complex overlapping sets in the snippet provided.
    // However, typical Amazon logic:
    // Base Price
    // - Sum of all applicable discounts that stack.
    // If A and B are mutually exclusive, we pick the one that gives better price (or simply the higher discount value).
    
    // Simplified Logic for Calculation based on conflicts:
    // This is a graph problem essentially. Max Independent Set on the graph of "active" promotions where edges are exclusions.
    // But since we have specific pairwise rules:
    // If status 0 (Exclusive): Pick MAX discount.
    // If status 1 (Stack): Add both.
    // If status 2 (Optional): User decides.

    // Let's approximate the calculation:
    // 1. Calculate discount value for each selected promo.
    // 2. Build a conflict graph.
    // 3. Find valid combination with max total discount.
    
    const discounts = selectedPromos.map(idx => ({
      idx,
      value: getDiscountValue(idx, basePrice)
    }));

    // Generate all subsets of selected promos and check validity
    // Since N is small (max 12), usually user selects 2-4, so 2^N is fine.
    // Actually we only need to check subsets of SELECTED promos.
    
    let maxDeduction = 0;

    const isCompatible = (subsetIndices: number[]) => {
      for (let i = 0; i < subsetIndices.length; i++) {
        for (let j = i + 1; j < subsetIndices.length; j++) {
          const a = subsetIndices[i];
          const b = subsetIndices[j];
          const status = matrix[a][b];
          if (status === 0) return false; // Mutually exclusive
          if (status === 2) {
             const key = a < b ? `${a}-${b}` : `${b}-${a}`;
             // If user chose NOT to stack (false), then they are effectively exclusive for this calculation context?
             // Actually "Optional" means:
             // - "Yes, Stack": They can coexist.
             // - "No, Don't Stack": They behave like exclusive (pick one).
             // Wait, if user says "No stack", it means they CANNOT both be present.
             if (currentOptionalDecisions[key] === false) return false;
          }
        }
      }
      return true;
    };

    // Iterate all combinations of selected promos
    // This is a bit heavy if user selects ALL, but practical usage is low count.
    const combine = (start: number, currentSet: number[], currentSum: number) => {
      if (currentSum > maxDeduction) {
        maxDeduction = currentSum;
      }

      for (let i = start; i < discounts.length; i++) {
        const nextPromo = discounts[i];
        // Check compatibility with currentSet
        const newSet = [...currentSet, nextPromo.idx];
        if (isCompatible(newSet)) {
          combine(i + 1, newSet, currentSum + nextPromo.value);
        }
      }
    };

    if (discounts.length > 0) {
       // Also check single items (base case)
       discounts.forEach(d => {
         if (d.value > maxDeduction) maxDeduction = d.value;
       });
       // Try combinations
       combine(0, [], 0);
    }

    const deduction = Math.min(maxDeduction, basePrice); // Can't go below 0
    const final = basePrice - deduction;
    const percent = basePrice > 0 ? (deduction / basePrice * 100).toFixed(1) : '0';

    return { 
      conflicts: conflictsList, 
      finalPrice: final.toFixed(2), 
      totalDeduction: deduction.toFixed(2),
      discountPercent: percent,
      decisions: currentOptionalDecisions
    };

  }, [basePrice, selectedPromos, promoValues, optionalDecisions]);

  // Update decisions state if new ones were generated in memo
  useEffect(() => {
     // This is tricky inside render, but we can sync if needed or just rely on the memo's local var for rendering.
     // To avoid loops, we won't set state here unless necessary. 
     // The memo uses `currentOptionalDecisions` which merges state + defaults.
  }, []);

  const handleDecisionChange = (key: string, val: boolean) => {
    setOptionalDecisions(prev => ({ ...prev, [key]: val }));
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-slate-900 p-6 rounded-2xl text-white flex flex-col md:flex-row justify-between items-center gap-4 shadow-lg">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Calculator className="w-7 h-7 text-yellow-400" />
            亚马逊促销叠加计算器
          </h1>
          <p className="text-slate-400 text-xs mt-1 md:ml-9">基于2025版《各类促销叠加情况》矩阵表逻辑</p>
        </div>
        <div className="bg-slate-800 px-5 py-2 rounded-lg border border-slate-700 flex items-center gap-3">
          <label className="text-xs text-slate-400 font-medium">商品原价 (Price)</label>
          <div className="flex items-center">
            <span className="text-slate-400 mr-1">$</span>
            <input 
              type="number" 
              value={basePrice} 
              onChange={(e) => setBasePrice(parseFloat(e.target.value) || 0)}
              className="bg-transparent text-xl font-mono font-bold text-white w-28 outline-none border-b border-slate-600 focus:border-yellow-400 transition-colors text-right" 
            />
          </div>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-6">
        {/* Left: Selection Area */}
        <Card className="w-full lg:w-3/5 p-6 border-slate-200 bg-slate-50">
          <div className="flex justify-between items-end mb-4">
            <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
              <span className="bg-blue-600 text-white w-6 h-6 rounded-full flex items-center justify-center text-xs">1</span>
              选择活动 & 设置力度
            </h2>
            <button onClick={resetAll} className="text-xs text-slate-500 hover:text-red-500 underline transition-colors flex items-center gap-1">
              <RotateCcw size={12} /> 重置所有
            </button>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {promoTypes.map((t, i) => {
              const isSelected = selectedPromos.includes(i);
              const config = promoValues[i];
              const Icon = t.icon;

              return (
                <div key={t.id} className="relative group">
                  <div 
                    onClick={() => handlePromoToggle(i)}
                    className={`cursor-pointer p-3 border rounded-lg transition-all duration-200 h-full flex flex-col shadow-sm hover:shadow-md ${isSelected ? 'bg-white border-blue-500 ring-1 ring-blue-200' : 'bg-white border-slate-200 hover:border-blue-300'}`}
                  >
                    <div className="flex justify-between items-center mb-2">
                      <div className="flex items-center gap-2">
                         <Icon size={16} className={`${isSelected ? 'text-blue-500' : 'text-slate-400'}`} />
                         <span className="font-semibold text-sm text-slate-700 leading-tight">{t.name}</span>
                      </div>
                      <div className={`w-4 h-4 rounded-full border flex-shrink-0 transition-colors flex items-center justify-center ${isSelected ? 'bg-blue-500 border-blue-500' : 'border-slate-300'}`}>
                        {isSelected && <Check size={10} className="text-white" />}
                      </div>
                    </div>
                    
                    {isSelected && config && (
                      <div className="mt-1 pt-2 border-t border-slate-100 z-20 relative" onClick={(e) => e.stopPropagation()}>
                        <div className="flex gap-1">
                          <select 
                            value={config.unit} 
                            onChange={(e) => handleValueChange(i, 'unit', e.target.value)}
                            className="bg-slate-50 border border-slate-200 text-xs rounded px-1 py-1 outline-none focus:border-blue-500 text-slate-600"
                          >
                            <option value="%">% Off</option>
                            <option value="$">$ Off</option>
                          </select>
                          <input 
                            type="number" 
                            value={config.val} 
                            onChange={(e) => handleValueChange(i, 'val', parseFloat(e.target.value) || 0)}
                            className="w-full bg-slate-50 border border-slate-200 text-sm rounded px-2 py-1 outline-none focus:border-blue-500 font-mono text-slate-700" 
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </Card>

        {/* Right: Results Area */}
        <Card className="w-full lg:w-2/5 p-0 bg-white flex flex-col min-h-[500px] overflow-hidden border-slate-200">
           <div className="p-6 pb-0">
              <h2 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
                <span className="bg-blue-600 text-white w-6 h-6 rounded-full flex items-center justify-center text-xs">2</span>
                叠加逻辑检测
              </h2>
           </div>

           <div className="flex-1 overflow-y-auto px-6 custom-scrollbar">
             {selectedPromos.length < 2 ? (
                <div className="h-full flex flex-col items-center justify-center text-slate-400 text-sm py-10">
                   <AlertCircle className="w-12 h-12 mb-3 opacity-20" />
                   <span>👈 请在左侧勾选至少两个活动</span>
                   {selectedPromos.length === 1 && (
                     <div className="mt-4 p-2 bg-green-50 text-green-700 rounded text-xs font-medium flex items-center gap-1">
                       <Check size={12} /> 单个活动正常生效中
                     </div>
                   )}
                </div>
             ) : (
                <div className="space-y-3 pb-4">
                  {conflicts.map((p: any, idx: number) => {
                    const nameA = promoTypes[p.idxA].name.split(' ')[0];
                    const nameB = promoTypes[p.idxB].name.split(' ')[0];
                    const decisionKey = p.key;
                    
                    if (p.status === 1) {
                      return (
                        <div key={idx} className="flex justify-between items-center p-2.5 bg-red-50 border border-red-100 rounded-lg text-xs">
                          <span className="text-red-800 font-bold flex items-center gap-1">
                             <XCircle size={14} />
                             {nameA} + {nameB}
                          </span>
                          <span className="bg-red-200 text-red-900 px-2 py-0.5 rounded font-medium">叠加 (折上折)</span>
                        </div>
                      );
                    } else if (p.status === 0) {
                      return (
                        <div key={idx} className="flex justify-between items-center p-2.5 bg-green-50 border border-green-100 rounded-lg text-xs">
                          <span className="text-green-800 font-bold flex items-center gap-1">
                             <Check size={14} />
                             {nameA} + {nameB}
                          </span>
                          <span className="bg-green-200 text-green-900 px-2 py-0.5 rounded font-medium">互斥 (取最优)</span>
                        </div>
                      );
                    } else if (p.status === 2) {
                      // Optional
                      const isChecked = optionalDecisions[decisionKey] !== false; // Default true
                      return (
                        <div key={idx} className="flex flex-col p-2.5 bg-yellow-50 border border-yellow-100 rounded-lg text-xs gap-2">
                          <div className="flex justify-between items-center">
                            <span className="text-yellow-800 font-bold flex items-center gap-1">
                               <AlertCircle size={14} />
                               {nameA} + {nameB}
                            </span>
                            <span className="bg-yellow-200 text-yellow-900 px-2 py-0.5 rounded font-medium">可自主选择</span>
                          </div>
                          <div className="flex items-center justify-between pl-4 border-l-2 border-yellow-200 ml-1">
                            <span className="text-slate-500">允许叠加使用?</span>
                            <div 
                              className="flex items-center gap-1 cursor-pointer select-none"
                              onClick={() => handleDecisionChange(decisionKey, !isChecked)}
                            >
                              <span className={`text-[10px] font-bold ${isChecked ? 'text-blue-600' : 'text-slate-400'}`}>
                                {isChecked ? '是 (YES)' : '否 (NO)'}
                              </span>
                              {isChecked ? <ToggleRight className="text-blue-500" size={24} /> : <ToggleLeft className="text-slate-400" size={24} />}
                            </div>
                          </div>
                        </div>
                      );
                    }
                    return null;
                  })}
                </div>
             )}
           </div>

           {/* Final Calculation */}
           <div className="mt-auto border-t border-slate-100 pt-6 bg-white z-10 p-6">
              <div className="flex justify-between items-end mb-2 px-1">
                  <span className="text-slate-500 text-sm">实际扣除金额</span>
                  <span className="text-red-600 font-mono font-bold">- ${totalDeduction}</span>
              </div>
              <div className="flex justify-between items-center bg-slate-900 text-white p-5 rounded-xl shadow-lg ring-1 ring-slate-900/5">
                  <div>
                      <span className="text-slate-400 text-xs uppercase tracking-wider font-semibold">预估最终售价</span>
                      <div className="text-4xl font-bold font-mono mt-1">${finalPrice}</div>
                  </div>
                  <div className="text-right pl-4 border-l border-slate-700">
                      <div className="text-xs text-slate-400 mb-1">总折扣率</div>
                      <div className="text-2xl font-bold text-yellow-400 leading-none">{discountPercent}%</div>
                      <div className="text-[10px] text-yellow-400/60 mt-1">OFF</div>
                  </div>
              </div>
           </div>
        </Card>
      </div>

      {/* Rules & Notes */}
      <Card className="bg-slate-50 border-slate-200 p-6 md:p-8">
          <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wide mb-4 flex items-center">
              <AlertCircle className="w-4 h-4 mr-2" />
              官方活动注意事项 (Rules & Notes)
          </h3>
          
          <div className="grid md:grid-cols-2 gap-8 text-xs text-slate-600 leading-relaxed">
              <div>
                  <p className="font-bold text-slate-800 mb-2 text-sm">⚠️ 核心建议</p>
                  <p className="mb-3 bg-yellow-50 border-l-4 border-yellow-400 p-3 rounded text-slate-700">
                      建议在同一时间段，对同一ASIN，<strong>只选择一种促销类型</strong>，以免造成价格折上折。
                  </p>
                  
                  <p className="font-bold text-slate-800 mb-2">各类促销定义：</p>
                  <ul className="list-disc pl-4 space-y-1 mb-4">
                      <li><strong>秒杀</strong>：秒杀 / Z划算</li>
                      <li><strong>促销-无限制型</strong>：折扣 Percentage off / 买赠 BxGy；<br/><span className="text-slate-500">买家可针对同一订单同时使用两种不同的无限制型折扣优惠码（叠加）。</span></li>
                      <li><strong>促销-优先型</strong>：折扣 Percentage off / 买赠 BxGy；<br/><span className="text-slate-500">买家可针对同一订单采用优惠力度更高的优惠码（不叠加）。</span></li>
                  </ul>
              </div>
              
              <div>
                  <p className="font-bold text-slate-800 mb-2 text-sm">💡 关于“可自主选择”的叠加说明</p>
                  <div className="bg-white border border-slate-200 p-4 rounded-lg shadow-sm">
                      <p className="mb-2 text-slate-700">
                          *** 只有当您为优惠券和促销（买一赠一或折扣）都选择 <strong>“是，允许叠加使用”</strong> 时，促销才会叠加使用。
                      </p>
                      <p className="text-slate-500">
                          如果对其中任一项您选择了 <strong>“否，不允许叠加使用”</strong>，促销将不会叠加使用，这意味着买家结账时，系统只会应用两个促销中优惠程度更高的促销。
                      </p>
                  </div>
              </div>
          </div>
      </Card>
    </div>
  );
};

export default AmazonPromotionStackingCalculator;
