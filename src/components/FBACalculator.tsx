import React, { useState, useEffect, useMemo } from 'react';
import { Truck, Save, RotateCcw, Copy, Trash2, ChevronDown, ChevronUp, Download } from 'lucide-react';

// --- Shared UI Components (matching HomeClient.tsx) ---
const Card = ({ children, className = "", onClick, ...props }: any) => (
  <div onClick={onClick} className={`bg-white rounded-xl border border-gray-100 shadow-sm ${className}`} {...props}>{children}</div>
);

const Input = ({ className = "", ...props }: any) => (
  <input className={`flex h-9 w-full rounded-md border border-gray-300 bg-transparent px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-gray-400 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-indigo-500 disabled:cursor-not-allowed disabled:opacity-50 ${className}`} {...props} />
);

const Button = ({ children, className = "", variant = "primary", ...props }: any) => {
  const baseClass = "px-4 py-2 rounded-lg text-sm font-medium flex items-center justify-center gap-2 transition-colors";
  const variants: any = {
    primary: "bg-blue-600 text-white hover:bg-blue-700",
    secondary: "bg-gray-100 text-gray-700 hover:bg-gray-200",
    danger: "bg-red-500 text-white hover:bg-red-600",
    success: "bg-green-600 text-white hover:bg-green-700",
    outline: "border border-gray-300 text-gray-700 hover:bg-gray-50"
  };
  return <button className={`${baseClass} ${variants[variant]} ${className}`} {...props}>{children}</button>;
};

const Collapsible = ({ title, children, defaultOpen = false }: any) => {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border border-gray-200 rounded-lg bg-white overflow-hidden">
      <button onClick={() => setOpen(!open)} className="w-full flex items-center justify-between p-4 bg-gray-50 hover:bg-gray-100 transition-colors">
        <span className="font-bold text-gray-700">{title}</span>
        {open ? <ChevronUp className="w-5 h-5 text-gray-500"/> : <ChevronDown className="w-5 h-5 text-gray-500"/>}
      </button>
      {open && <div className="p-4 border-t border-gray-200 overflow-x-auto">{children}</div>}
    </div>
  );
};


// --- Helper Components for Reference Tables ---

const SizeClassificationTable = () => (
  <div className="overflow-x-auto">
    <table className="w-full text-xs text-left border-collapse border border-gray-200">
      <thead>
        <tr className="bg-gray-100">
          <th className="border border-gray-200 p-2">商品尺寸分段</th>
          <th className="border border-gray-200 p-2">发货重量</th>
          <th className="border border-gray-200 p-2">最长边</th>
          <th className="border border-gray-200 p-2">次长边</th>
          <th className="border border-gray-200 p-2">最短边</th>
          <th className="border border-gray-200 p-2">长度+围长</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td className="border border-gray-200 p-2">小号标准尺寸</td>
          <td className="border border-gray-200 p-2">≤16盎司</td>
          <td className="border border-gray-200 p-2">≤15英寸</td>
          <td className="border border-gray-200 p-2">≤12英寸</td>
          <td className="border border-gray-200 p-2">≤0.75英寸</td>
          <td className="border border-gray-200 p-2">不适用</td>
        </tr>
        <tr>
          <td className="border border-gray-200 p-2">大号标准尺寸</td>
          <td className="border border-gray-200 p-2">≤20磅</td>
          <td className="border border-gray-200 p-2">≤18英寸</td>
          <td className="border border-gray-200 p-2">≤14英寸</td>
          <td className="border border-gray-200 p-2">≤8英寸</td>
          <td className="border border-gray-200 p-2">不适用</td>
        </tr>
        <tr>
          <td className="border border-gray-200 p-2">小号大件</td>
          <td className="border border-gray-200 p-2">≤70磅</td>
          <td className="border border-gray-200 p-2">≤60英寸</td>
          <td className="border border-gray-200 p-2">≤30英寸</td>
          <td className="border border-gray-200 p-2">不适用</td>
          <td className="border border-gray-200 p-2">≤130英寸</td>
        </tr>
        <tr>
          <td className="border border-gray-200 p-2">中号大件</td>
          <td className="border border-gray-200 p-2">≤150磅</td>
          <td className="border border-gray-200 p-2">≤108英寸</td>
          <td className="border border-gray-200 p-2">不适用</td>
          <td className="border border-gray-200 p-2">不适用</td>
          <td className="border border-gray-200 p-2">≤130英寸</td>
        </tr>
        <tr>
          <td className="border border-gray-200 p-2">大号大件</td>
          <td className="border border-gray-200 p-2">≤150磅</td>
          <td className="border border-gray-200 p-2">≤108英寸</td>
          <td className="border border-gray-200 p-2">不适用</td>
          <td className="border border-gray-200 p-2">不适用</td>
          <td className="border border-gray-200 p-2">≤165英寸</td>
        </tr>
        <tr>
          <td className="border border-gray-200 p-2">特殊大件</td>
          <td className="border border-gray-200 p-2">超过150磅</td>
          <td className="border border-gray-200 p-2">超过108英寸</td>
          <td className="border border-gray-200 p-2">不适用</td>
          <td className="border border-gray-200 p-2">不适用</td>
          <td className="border border-gray-200 p-2">超过165英寸</td>
        </tr>
      </tbody>
    </table>
    <ul className="list-disc ml-5 mt-2 text-xs text-gray-600 space-y-1">
      <li>发货重量为商品重量或体积重量中的较大值，用于确定尺寸分段。</li>
      <li>对于大号标准尺寸、大号大件和超大件（150磅以下），亚马逊使用体积重量计费（如果体积重量&gt;商品重量）。</li>
      <li>对于小号标准尺寸、超大件（150磅及以上），仅使用商品重量计费。</li>
      <li>体积重量计算公式：<b>体积重量(磅) = (长x宽x高，单位英寸) ÷ 139</b>，宽和高最小取2英寸。</li>
    </ul>

    <div className="mt-4">
       <h4 className="font-bold text-sm text-gray-700 mb-2">3. 常见问题：</h4>
       <ul className="list-disc ml-5 text-xs text-gray-600 space-y-1">
         <li><b>商品重量</b> ：指商品完全包装后的实际称重重量。</li>
         <li><b>体积重量</b> ：根据商品尺寸估算的重量，适用大号标准尺寸、大号大件、超大件（150磅以下）。</li>
         <li>发货重量取商品重量与体积重量中的较大值，确定最终费用分段。</li>
       </ul>
    </div>

    <div className="mt-4">
       <h4 className="font-bold text-sm text-gray-700 mb-2">4. 示例：</h4>
       <ul className="list-disc ml-5 text-xs text-gray-600 space-y-1">
         <li><b>移动设备壳</b>：13.8×9×0.7英寸，2.88盎司 → 分段：小号标准尺寸</li>
         <li><b>T恤</b>：8.5×4.8×1英寸，6.08盎司 → 分段：大号标准尺寸（服装）</li>
         <li><b>婴儿床</b>：24×7.5×6英寸，7.9磅 → 分段：大号大件</li>
         <li><b>显示器</b>：54×35×3.5英寸，体积重量47.59磅 → 分段：超大件</li>
         <li><b>消毒液</b>：12×6×3英寸，2磅 → 分段：大号标准尺寸（危险品）</li>
       </ul>
    </div>

    <div className="mt-4">
       <h4 className="font-bold text-sm text-gray-700 mb-2">5. 利润计算逻辑说明：</h4>
       <ul className="list-disc ml-5 text-xs text-gray-600 space-y-1">
         <li><b>亚马逊回款 (Payout)</b> = 售价 - 佣金 - FBA配送费</li>
         <li><b>总成本</b> = (采购成本 + 头程运费) ÷ 汇率</li>
         <li><b>退货损失</b> = (售价 + FBA配送费) × 退货率 × 不可售比例 + 退款管理费 × 退货率</li>
         <li><b>广告费</b> = 售价 × ACoS</li>
         <li><b>净利润</b> = 亚马逊回款 - 总成本 - 广告费 - 退货损失 - 月仓储费 - 其他杂费</li>
         <li><b>盈亏平衡ACoS</b> = (净利润 + 广告费) ÷ 售价</li>
       </ul>
    </div>
  </div>
);

const ReferralFeeTable = () => (
  <div className="overflow-x-auto">
    <table className="w-full text-xs text-left border-collapse border border-gray-200">
      <thead>
        <tr className="bg-gray-100">
          <th className="border border-gray-200 p-2">佣金分类</th>
          <th className="border border-gray-200 p-2">销售佣金百分比</th>
          <th className="border border-gray-200 p-2">最低销售佣金</th>
        </tr>
      </thead>
      <tbody>
        {Object.entries(REFERRAL_RULES).map(([key, rule]: any) => {
           let rateText = '';
           if (rule.type === 'threshold') {
             rateText = `总售价≤$${rule.threshold}: ${(rule.lowRate*100)}%\n总售价>$${rule.threshold}: ${(rule.highRate*100)}%`;
           } else if (rule.type === 'threshold_multi') {
             rateText = rule.ranges.map((r:any) => r.max === Infinity ? `总售价>$${rule.ranges[rule.ranges.length-2].max}: ${(r.rate*100)}%` : `总售价≤$${r.max}: ${(r.rate*100)}%`).join('\n');
           } else if (rule.type === 'tiered') {
             rateText = `总售价≤$${rule.threshold}部分: ${(rule.rate1*100)}%\n总售价>$${rule.threshold}部分: ${(rule.rate2*100)}%`;
           } else if (rule.type === 'tiered_multi') {
             rateText = rule.ranges.map((r:any) => r.limit === Infinity ? `总售价>$${rule.ranges[rule.ranges.length-2].limit}部分: ${(r.rate*100)}%` : `总售价≤$${r.limit}部分: ${(r.rate*100)}%`).join('\n');
           } else {
             rateText = `${(rule.rate*100)}%`;
           }
           
           return (
             <tr key={key}>
               <td className="border border-gray-200 p-2">{rule.name}</td>
               <td className="border border-gray-200 p-2 whitespace-pre-wrap">{rateText}</td>
               <td className="border border-gray-200 p-2">{rule.min ? `$${rule.min.toFixed(2)}` : '--'}</td>
             </tr>
           );
        })}
      </tbody>
    </table>
  </div>
);

const FeeTable = ({ initialSeason, initialVersion }: any) => {
  const [tab, setTab] = useState('normal');
  const [season, setSeason] = useState(initialSeason);
  const [version, setVersion] = useState(initialVersion);
  useEffect(() => { setSeason(initialSeason); setVersion(initialVersion); }, [initialSeason, initialVersion]);

  const seasonKey = season === 'peak' ? 'peak_2025' : (version === '2026' ? 'non_peak_2026' : 'non_peak_2025');
  const currentData = feeData[tab]?.[seasonKey];

  const renderRows = () => {
    if (!currentData) return <tr><td colSpan={5} className="p-4 text-center text-gray-500">暂无数据</td></tr>;
    
    const rows: any[] = [];
    const pushRow = (tier: string, range: string, lt10: number, mid: number, high: number) => {
       rows.push(
         <tr key={`${tier}-${range}`}>
           <td className="border border-gray-200 p-2">{tier}</td>
           <td className="border border-gray-200 p-2">{range}</td>
           <td className="border border-gray-200 p-2">${lt10.toFixed(2)}</td>
           <td className="border border-gray-200 p-2">${mid.toFixed(2)}</td>
           <td className="border border-gray-200 p-2">${high.toFixed(2)}</td>
         </tr>
       );
    };

    const ss = currentData.small_standard;
    if (ss) {
        for (let i = 0; i < ss.steps.length; i++) {
            const range = (i === 0 ? '≤' + ss.steps[i] + '盎司' : ss.steps[i-1] + '至' + ss.steps[i] + '盎司');
            pushRow('小号标准尺寸', range, ss.lt10[i], ss.mid[i], ss.high[i]);
        }
    }

    const ls = currentData.large_standard;
    if (ls) {
        for (let i = 0; i < ls.pre3_steps_oz.length; i++) {
            const prev = i === 0 ? 0 : ls.pre3_steps_oz[i-1];
            const curr = ls.pre3_steps_oz[i];
            const range = (i === 0 ? '≤' + curr + '盎司' : (prev + '至' + curr + '盎司'));
            pushRow('大号标准尺寸', range, ls.lt10_pre3[i], ls.mid_pre3[i], ls.high_pre3[i]);
        }
        if (ls.post3_base) {
            const incText = tab === 'apparel' ? ` + 每半磅$${(ls.post3_increment_per_half_lb || 0).toFixed(2)}` : ` + 每4盎司$${(ls.post3_increment_per_4oz || 0).toFixed(2)}`;
            rows.push(
                <tr key="ls-post3">
                    <td className="border border-gray-200 p-2">大号标准尺寸</td>
                    <td className="border border-gray-200 p-2">3至20磅</td>
                    <td className="border border-gray-200 p-2">${ls.post3_base.lt10.toFixed(2)}{incText}</td>
                    <td className="border border-gray-200 p-2">${ls.post3_base.mid.toFixed(2)}{incText}</td>
                    <td className="border border-gray-200 p-2">${ls.post3_base.high.toFixed(2)}{incText}</td>
                </tr>
            );
        }
    }

    const so = currentData.small_oversize_0_50;
    if (so) rows.push(<tr key="so"><td className="border border-gray-200 p-2">小号大件</td><td className="border border-gray-200 p-2">0至50磅</td><td className="border border-gray-200 p-2">${so.base.lt10.toFixed(2)} + 每磅${so.per_lb.toFixed(2)}</td><td className="border border-gray-200 p-2">${so.base.mid.toFixed(2)} + 每磅${so.per_lb.toFixed(2)}</td><td className="border border-gray-200 p-2">${so.base.high.toFixed(2)} + 每磅${so.per_lb.toFixed(2)}</td></tr>);

    const lo = currentData.large_oversize_0_50;
    if (lo) rows.push(<tr key="lo"><td className="border border-gray-200 p-2">大号大件</td><td className="border border-gray-200 p-2">0至50磅</td><td className="border border-gray-200 p-2">${lo.base.lt10.toFixed(2)} + 每磅${lo.per_lb.toFixed(2)}</td><td className="border border-gray-200 p-2">${lo.base.mid.toFixed(2)} + 每磅${lo.per_lb.toFixed(2)}</td><td className="border border-gray-200 p-2">${lo.base.high.toFixed(2)} + 每磅${lo.per_lb.toFixed(2)}</td></tr>);

    const su0 = currentData.super_oversize_0_50;
    if (su0) rows.push(<tr key="su0"><td className="border border-gray-200 p-2">超大件</td><td className="border border-gray-200 p-2">0至50磅</td><td className="border border-gray-200 p-2">${su0.base.lt10.toFixed(2)} + 每磅${su0.per_lb.toFixed(2)}</td><td className="border border-gray-200 p-2">${su0.base.mid.toFixed(2)} + 每磅${su0.per_lb.toFixed(2)}</td><td className="border border-gray-200 p-2">${su0.base.high.toFixed(2)} + 每磅${su0.per_lb.toFixed(2)}</td></tr>);

    const su5070 = currentData.super_oversize_50_70;
    if (su5070) rows.push(<tr key="su5070"><td className="border border-gray-200 p-2">超大件</td><td className="border border-gray-200 p-2">50至70磅</td><td className="border border-gray-200 p-2">${su5070.base.lt10.toFixed(2)} + 超出首重{su5070.start_lb}磅每磅${su5070.per_lb.toFixed(2)}</td><td className="border border-gray-200 p-2">${su5070.base.mid.toFixed(2)} + 超出首重{su5070.start_lb}磅每磅${su5070.per_lb.toFixed(2)}</td><td className="border border-gray-200 p-2">${su5070.base.high.toFixed(2)} + 超出首重{su5070.start_lb}磅每磅${su5070.per_lb.toFixed(2)}</td></tr>);

    const su70150 = currentData.super_oversize_70_150;
    if (su70150) rows.push(<tr key="su70150"><td className="border border-gray-200 p-2">超大件</td><td className="border border-gray-200 p-2">70至150磅</td><td className="border border-gray-200 p-2">${su70150.base.lt10.toFixed(2)} + 超出首重{su70150.start_lb}磅每磅${su70150.per_lb.toFixed(2)}</td><td className="border border-gray-200 p-2">${su70150.base.mid.toFixed(2)} + 超出首重{su70150.start_lb}磅每磅${su70150.per_lb.toFixed(2)}</td><td className="border border-gray-200 p-2">${su70150.base.high.toFixed(2)} + 超出首重{su70150.start_lb}磅每磅${su70150.per_lb.toFixed(2)}</td></tr>);

    const su150 = currentData.super_oversize_gt_150;
    if (su150) rows.push(<tr key="su150"><td className="border border-gray-200 p-2">超大件</td><td className="border border-gray-200 p-2">超过150磅</td><td className="border border-gray-200 p-2">${su150.base.lt10.toFixed(2)} + 超出首重{su150.start_lb}磅每磅${su150.per_lb.toFixed(2)}</td><td className="border border-gray-200 p-2">${su150.base.mid.toFixed(2)} + 超出首重{su150.start_lb}磅每磅${su150.per_lb.toFixed(2)}</td><td className="border border-gray-200 p-2">${su150.base.high.toFixed(2)} + 超出首重{su150.start_lb}磅每磅${su150.per_lb.toFixed(2)}</td></tr>);

    return rows;
  };

  const handleDownload = () => {
    // Simple CSV export implementation
    let csv = '\uFEFF';
    const title = { 'normal': '普通商品配送费用表', 'apparel': '服装配送费用表', 'danger': '危险品配送费用表' }[tab];
    const seasonLabel = season === 'peak' ? '旺季' : '非旺季';
    csv += `${title} (${seasonLabel}-${version})\n\n`;
    csv += "尺寸分段,重量范围,费用(<$10),费用($10~$50),费用(>$50)\n";
    
    // Note: Re-generating rows for CSV is cleaner than parsing DOM, but for simplicity here we just alert or do a basic export.
    // A full implementation would traverse the data again similarly to renderRows but output string.
    // Given the complexity, let's skip the detailed CSV generation for now or just add a placeholder.
    // User asked for "表格", the download is an extra feature from HTML.
    alert("下载功能在此React版本中暂未完全实现 (需重写CSV生成逻辑)");
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <Button variant={tab === 'normal' ? 'primary' : 'outline'} onClick={() => setTab('normal')} size="sm">普通商品</Button>
        <Button variant={tab === 'apparel' ? 'primary' : 'outline'} onClick={() => setTab('apparel')} size="sm">服装</Button>
        <Button variant={tab === 'danger' ? 'primary' : 'outline'} onClick={() => setTab('danger')} size="sm">危险品</Button>
        {/* <Button variant="success" onClick={handleDownload} size="sm"><Download className="w-4 h-4"/> 下载当前表格</Button> */}
      </div>
      <div className="flex gap-4 items-center text-sm">
        <label className="flex items-center gap-2">
           季节:
           <select value={season} onChange={(e) => setSeason(e.target.value)} className="border rounded px-2 py-1">
             <option value="non_peak">非旺季</option>
             <option value="peak">旺季</option>
           </select>
        </label>
        <label className="flex items-center gap-2">
           计费版本:
           <select value={version} onChange={(e) => setVersion(e.target.value)} className="border rounded px-2 py-1">
             <option value="2025">2025</option>
             <option value="2026">2026</option>
           </select>
        </label>
      </div>
      
      <div className="overflow-x-auto">
        <table className="w-full text-xs text-left border-collapse border border-gray-200">
          <thead>
            <tr className="bg-gray-100">
              <th className="border border-gray-200 p-2">尺寸分段</th>
              <th className="border border-gray-200 p-2">重量范围</th>
              <th className="border border-gray-200 p-2">费用(&lt;$10)</th>
              <th className="border border-gray-200 p-2">费用($10~$50)</th>
              <th className="border border-gray-200 p-2">费用(&gt;$50)</th>
            </tr>
          </thead>
          <tbody>
            {renderRows()}
          </tbody>
        </table>
      </div>
      <ul className="list-disc ml-5 mt-2 text-xs text-gray-600 space-y-1">
        <li>服装类商品、危险品商品配送费用与普通商品有所不同，具体见上表。</li>
        <li>所有费用按发货重量计费，发货重量为实际重量和体积重量中的较大值。</li>
      </ul>
    </div>
  );
};

// --- Logic & Constants ---

function cmToInch(cm: number) { return cm / 2.54; }
function gToOz(g: number) { return g / 28.3495; }
function ozToLb(oz: number) { return oz / 16; }
function lbToOz(lb: number) { return lb * 16; }
function round2(x: number) { return Math.round(x * 100) / 100; }

function sort3(a: number, b: number, c: number) {
  let arr = [a, b, c].sort((x, y) => y - x);
  return { l: arr[0], w: arr[1], h: arr[2] };
}

// Fee Data
const feeData: any = {
  normal: {
    non_peak_2025: {
      small_standard: { steps: [2,4,6,8,10,12,14,16], lt10: [2.29,2.38,2.47,2.56,2.66,2.76,2.83,2.88], mid: [3.06,3.15,3.24,3.33,3.43,3.53,3.60,3.65], high: [3.06,3.15,3.24,3.33,3.43,3.53,3.60,3.65] },
      large_standard: { pre3_steps_oz: [4,8,12,16,20,24,28,32,36,40,44,48], lt10_pre3: [2.91,3.13,3.38,3.78,4.22,4.60,4.75,5.00,5.10,5.28,5.44,5.85], mid_pre3: [3.68,3.90,4.15,4.55,4.99,5.37,5.52,5.77,5.87,6.05,6.21,6.62], high_pre3: [3.68,3.90,4.15,4.55,4.99,5.37,5.52,5.77,5.87,6.05,6.21,6.62], post3_base: { lt10: 6.15, mid: 6.92, high: 6.92 }, post3_increment_per_4oz: 0.08 },
      small_oversize_0_50: { base: { lt10: 8.84, mid: 9.61, high: 9.61 }, per_lb: 0.38 },
      large_oversize_0_50: { base: { lt10: 8.84, mid: 9.61, high: 9.61 }, per_lb: 0.38 },
      super_oversize_0_50: { base: { lt10: 25.56, mid: 26.33, high: 26.33 }, per_lb: 0.38 },
      super_oversize_50_70: { base: { lt10: 39.35, mid: 40.12, high: 40.12 }, start_lb: 50, per_lb: 0.75 },
      super_oversize_70_150: { base: { lt10: 54.04, mid: 54.81, high: 54.81 }, start_lb: 71, per_lb: 0.75 },
      super_oversize_gt_150: { base: { lt10: 194.18, mid: 194.95, high: 194.95 }, start_lb: 151, per_lb: 0.19 }
    },
    non_peak_2026: {
      small_standard: { steps: [2,4,6,8,10,12,14,16], lt10: [2.43,2.49,2.56,2.66,2.77,2.82,2.92,2.95], mid: [3.32,3.42,3.45,3.54,3.68,3.78,3.91,3.96], high: [3.58,3.68,3.71,3.80,3.94,4.04,4.17,4.22] },
      large_standard: { pre3_steps_oz: [4,8,12,16,20,24,28,32,36,40,44,48], lt10_pre3: [2.91,3.13,3.38,3.78,4.22,4.60,4.75,5.00,5.10,5.28,5.44,5.85], mid_pre3: [3.73,3.95,4.20,4.60,5.04,5.42,5.57,5.82,5.92,6.10,6.26,6.67], high_pre3: [3.99,4.21,4.46,4.86,5.30,5.68,5.83,6.08,6.18,6.36,6.52,6.93], post3_base: { lt10: 6.15, mid: 6.97, high: 7.23 }, post3_increment_per_4oz: 0.08 },
      small_oversize_0_50: { base: { lt10: 6.78, mid: 7.55, high: 7.55 }, per_lb: 0.38 },
      large_oversize_0_50: { base: { lt10: 8.58, mid: 9.35, high: 9.35 }, per_lb: 0.38 },
      super_oversize_0_50: { base: { lt10: 25.56, mid: 26.33, high: 26.33 }, per_lb: 0.38 },
      super_oversize_50_70: { base: { lt10: 36.55, mid: 37.32, high: 37.32 }, start_lb: 50, per_lb: 0.75 },
      super_oversize_70_150: { base: { lt10: 50.55, mid: 51.32, high: 51.32 }, start_lb: 71, per_lb: 0.75 },
      super_oversize_gt_150: { base: { lt10: 194.18, mid: 194.95, high: 194.95 }, start_lb: 151, per_lb: 0.19 }
    },
    peak_2025: {
      small_standard: { steps: [2,4,6,8,10,12,14,16], lt10: [2.48,2.57,2.67,2.76,2.87,2.97,3.05,3.10], mid: [3.25,3.34,3.44,3.53,3.64,3.74,3.82,3.87], high: [3.25,3.34,3.44,3.53,3.64,3.74,3.82,3.87] },
      large_standard: { pre3_steps_oz: [4,8,12,16,20,24,28,32,36,40,44,48], lt10_pre3: [3.15,3.39,3.66,4.07,4.52,4.91,5.07,5.33,5.47,5.67,5.84,6.26], mid_pre3: [3.92,4.16,4.43,4.84,5.29,5.68,5.84,6.10,6.24,6.44,6.61,7.03], high_pre3: [3.92,4.16,4.43,4.84,5.29,5.68,5.84,6.10,6.24,6.44,6.61,7.03], post3_base: { lt10: 6.69, mid: 7.46, high: 7.46 }, post3_increment_per_4oz: 0.08 },
      small_oversize_0_50: { base: { lt10: 9.88, mid: 10.65, high: 10.65 }, per_lb: 0.38 },
      large_oversize_0_50: { base: { lt10: 9.88, mid: 10.65, high: 10.65 }, per_lb: 0.38 },
      super_oversize_0_50: { base: { lt10: 28.29, mid: 29.06, high: 29.06 }, per_lb: 0.38 },
      super_oversize_50_70: { base: { lt10: 42.16, mid: 42.93, high: 42.93 }, start_lb: 50, per_lb: 0.75 },
      super_oversize_70_150: { base: { lt10: 58.46, mid: 59.23, high: 59.23 }, start_lb: 71, per_lb: 0.75 },
      super_oversize_gt_150: { base: { lt10: 202.69, mid: 203.46, high: 203.46 }, start_lb: 151, per_lb: 0.19 }
    }
  },
  apparel: {
    non_peak_2025: {
      small_standard: { steps: [2,4,6,8,10,12,14,16], lt10: [2.50,2.50,2.65,2.65,2.95,2.95,3.21,3.21], mid: [3.27,3.27,3.42,3.42,3.72,3.72,3.98,3.98], high: [3.27,3.27,3.42,3.42,3.72,3.72,3.98,3.98] },
      large_standard: { pre3_steps_oz: [4,8,12,16,24,32,40,48], lt10_pre3: [3.48,3.68,3.90,4.35,5.13,5.13,5.37,5.37], mid_pre3: [4.25,4.45,4.67,5.12,5.90,5.90,6.14,6.14], high_pre3: [4.25,4.45,4.67,5.12,5.90,5.90,6.14,6.14], post3_base: { lt10: 6.82, mid: 6.97, high: 7.63 }, post3_increment_per_half_lb: 0.16 },
      small_oversize_0_50: { base: { lt10: 8.84, mid: 9.61, high: 9.61 }, per_lb: 0.38 },
      large_oversize_0_50: { base: { lt10: 8.84, mid: 9.61, high: 9.61 }, per_lb: 0.38 },
      super_oversize_0_50: { base: { lt10: 25.56, mid: 26.33, high: 26.33 }, per_lb: 0.38 },
      super_oversize_50_70: { base: { lt10: 39.35, mid: 40.12, high: 40.12 }, start_lb: 51, per_lb: 0.75 },
      super_oversize_70_150: { base: { lt10: 54.04, mid: 54.81, high: 54.81 }, start_lb: 71, per_lb: 0.75 },
      super_oversize_gt_150: { base: { lt10: 194.18, mid: 194.95, high: 194.95 }, start_lb: 151, per_lb: 0.19 }
    },
    non_peak_2026: {
      small_standard: { steps: [2,4,6,8,10,12,14,16], lt10: [2.62,2.64,2.68,2.81,3.00,3.10,3.20,3.30], mid: [3.51,3.54,3.59,3.69,3.91,4.09,4.20,4.25], high: [3.77,3.80,3.85,3.95,4.17,4.35,4.46,4.51] },
      large_standard: { pre3_steps_oz: [4,8,12,16,24,32,40,48], lt10_pre3: [3.48,3.68,3.90,4.35,5.05,5.22,5.32,5.43], mid_pre3: [4.30,4.50,4.72,5.17,5.87,6.04,6.14,6.25], high_pre3: [4.56,4.76,4.98,5.43,6.13,6.30,6.40,6.51], post3_base: { lt10: 6.78, mid: 6.97, high: 7.55 }, post3_increment_per_half_lb: 0.16 },
      small_oversize_0_50: { base: { lt10: 8.84, mid: 9.61, high: 9.61 }, per_lb: 0.38 },
      large_oversize_0_50: { base: { lt10: 8.58, mid: 9.35, high: 9.35 }, per_lb: 0.38 },
      super_oversize_0_50: { base: { lt10: 25.56, mid: 26.33, high: 26.33 }, per_lb: 0.38 },
      super_oversize_50_70: { base: { lt10: 36.55, mid: 37.32, high: 37.32 }, start_lb: 50, per_lb: 0.75 },
      super_oversize_70_150: { base: { lt10: 50.55, mid: 51.32, high: 51.32 }, start_lb: 71, per_lb: 0.75 },
      super_oversize_gt_150: { base: { lt10: 194.18, mid: 194.95, high: 194.95 }, start_lb: 151, per_lb: 0.19 }
    },
    peak_2025: {
      small_standard: { steps: [2,4,6,8,10,12,14,16], lt10: [2.73,2.73,2.90,2.90,3.22,3.22,3.50,3.50], mid: [3.50,3.50,3.67,3.67,3.99,3.99,4.27,4.27], high: [3.50,3.50,3.67,3.67,3.99,3.99,4.27,4.27] },
      large_standard: { pre3_steps_oz: [4,8,12,16,20,24,28,32,36,40,44,48], lt10_pre3: [3.79,4.00,4.23,4.69,5.50,5.50,5.76,5.76,6.27,6.27,6.50,6.50], mid_pre3: [4.56,4.77,5.00,5.46,6.27,6.27,6.53,6.53,7.04,7.04,7.27,7.27], high_pre3: [4.56,4.77,5.00,5.46,6.27,6.27,6.53,6.53,7.04,7.04,7.27,7.27], post3_base: { lt10: 6.82, mid: 7.59, high: 7.59 }, post3_increment_per_half_lb: 0.16 },
      small_oversize_0_50: { base: { lt10: 9.88, mid: 10.65, high: 10.65 }, per_lb: 0.38 },
      large_oversize_0_50: { base: { lt10: 9.88, mid: 10.65, high: 10.65 }, per_lb: 0.38 },
      super_oversize_0_50: { base: { lt10: 28.29, mid: 29.06, high: 29.06 }, per_lb: 0.38 },
      super_oversize_50_70: { base: { lt10: 42.16, mid: 42.93, high: 42.93 }, start_lb: 50, per_lb: 0.75 },
      super_oversize_70_150: { base: { lt10: 58.46, mid: 59.23, high: 59.23 }, start_lb: 71, per_lb: 0.75 },
      super_oversize_gt_150: { base: { lt10: 202.69, mid: 203.46, high: 203.46 }, start_lb: 151, per_lb: 0.19 }
    }
  },
  danger: {
    non_peak_2025: {
      small_standard: { steps: [2,4,6,8,10,12,14,16], lt10: [3.26,3.32,3.39,3.45,3.53,3.59,3.64,3.64], mid: [4.03,4.09,4.16,4.22,4.30,4.36,4.41,4.41], high: [4.03,4.09,4.16,4.22,4.30,4.36,4.41,4.41] },
      large_standard: { pre3_steps_oz: [20,24,28,32,36,40,44,48], lt10_pre3: [4.82,5.20,5.35,5.49,5.56,5.74,5.90,6.31], mid_pre3: [5.59,5.97,6.12,6.26,6.33,6.51,6.67,7.08], high_pre3: [5.59,5.97,6.12,6.26,6.33,6.51,6.67,7.08], post3_base: { lt10: 6.61, mid: 7.38, high: 7.38 }, post3_increment_per_4oz: 0.08 },
      small_oversize_0_50: { base: { lt10: 9.56, mid: 10.33, high: 10.33 }, per_lb: 0.38 },
      large_oversize_0_50: { base: { lt10: 9.56, mid: 10.33, high: 10.33 }, per_lb: 0.38 },
      super_oversize_0_50: { base: { lt10: 27.67, mid: 28.44, high: 28.44 }, per_lb: 0.38 },
      super_oversize_50_70: { base: { lt10: 42.56, mid: 43.33, high: 43.33 }, start_lb: 50, per_lb: 0.75 },
      super_oversize_70_150: { base: { lt10: 61.17, mid: 61.94, high: 61.94 }, start_lb: 71, per_lb: 0.75 },
      super_oversize_gt_150: { base: { lt10: 218.76, mid: 219.53, high: 219.53 }, start_lb: 151, per_lb: 0.19 }
    },
    non_peak_2026: {
      small_standard: { steps: [2,4,6,8,10,12,14,16], lt10: [3.40,3.43,3.48,3.55,3.64,3.65,3.73,3.73], mid: [4.29,4.36,4.37,4.43,4.55,4.61,4.72,4.72], high: [4.55,4.62,4.63,4.69,4.81,4.87,4.98,4.98] },
      large_standard: { pre3_steps_oz: [20,24,28,32,36,40,44,48], lt10_pre3: [4.82,5.20,5.35,5.49,5.56,5.74,5.90,6.31], mid_pre3: [5.64,6.02,6.17,6.31,6.38,6.56,6.72,7.13], high_pre3: [5.90,6.28,6.43,6.57,6.64,6.82,6.98,7.39], post3_base: { lt10: 6.61, mid: 7.43, high: 7.69 }, post3_increment_per_4oz: 0.08 },
      small_oversize_0_50: { base: { lt10: 7.5, mid: 8.27, high: 8.27 }, per_lb: 0.38 },
      large_oversize_0_50: { base: { lt10: 9.3, mid: 10.07, high: 10.07 }, per_lb: 0.38 },
      super_oversize_0_50: { base: { lt10: 27.67, mid: 28.44, high: 28.44 }, per_lb: 0.38 },
      super_oversize_50_70: { base: { lt10: 39.76, mid: 40.53, high: 40.53 }, start_lb: 50, per_lb: 0.75 },
      super_oversize_70_150: { base: { lt10: 57.68, mid: 58.45, high: 58.45 }, start_lb: 71, per_lb: 0.75 },
      super_oversize_gt_150: { base: { lt10: 218.76, mid: 219.53, high: 219.53 }, start_lb: 151, per_lb: 0.19 }
    },
    peak_2025: {
      small_standard: { steps: [2,4,6,8,10,12,14,16], lt10: [3.60,3.69,3.79,3.88,3.99,4.08,4.16,4.25], mid: [4.37,4.46,4.56,4.65,4.76,4.85,4.93,5.02], high: [4.37,4.46,4.56,4.65,4.76,4.85,4.93,5.02] },
      large_standard: { pre3_steps_oz: [4,8,12,16,20,24,28,32,36,40,44,48], lt10_pre3: [4.32,4.56,4.82,5.04,5.51,5.91,6.08,6.24,6.33,6.53,6.70,7.12], mid_pre3: [5.09,5.33,5.59,5.81,6.28,6.68,6.85,7.01,7.10,7.30,7.47,7.89], high_pre3: [5.09,5.33,5.59,5.81,6.28,6.68,6.85,7.01,7.10,7.30,7.47,7.89], post3_base: { lt10: 7.51, mid: 8.28, high: 8.28 }, post3_increment_per_4oz: 0.08 },
      small_oversize_0_50: { base: { lt10: 11.12, mid: 11.89, high: 11.89 }, per_lb: 0.38 },
      large_oversize_0_50: { base: { lt10: 11.12, mid: 11.89, high: 11.89 }, per_lb: 0.38 },
      super_oversize_0_50: { base: { lt10: 31.71, mid: 32.48, high: 32.48 }, per_lb: 0.38 },
      super_oversize_50_70: { base: { lt10: 46.66, mid: 47.43, high: 47.43 }, start_lb: 50, per_lb: 0.75 },
      super_oversize_70_150: { base: { lt10: 67.53, mid: 68.30, high: 68.30 }, start_lb: 71, per_lb: 0.75 },
      super_oversize_gt_150: { base: { lt10: 230.84, mid: 231.61, high: 231.61 }, start_lb: 151, per_lb: 0.19 }
    }
  }
};

const REFERRAL_RULES: any = {
  "Amazon Device Accessories": { name: "亚马逊设备配件", rate: 0.45, min: 0.30 },
  "Automotive": { name: "汽车和户外动力设备", rate: 0.12, min: 0.30 },
  "Baby": { name: "母婴", type: "threshold", threshold: 10.00, lowRate: 0.08, highRate: 0.15, min: 0.30 },
  "Backpacks": { name: "背包、手提包和箱包", rate: 0.15, min: 0.30 },
  "Power Tools": { name: "基础设备电动工具", rate: 0.12, min: 0.30 },
  "Beauty": { name: "美妆和个护健康", type: "threshold", threshold: 10.00, lowRate: 0.08, highRate: 0.15, min: 0.30 },
  "Business": { name: "商业、工业与科学用品", rate: 0.12, min: 0.30 },
  "Clothing": { name: "服装和配饰", type: "threshold_multi", ranges: [{max:15, rate:0.05}, {max:20, rate:0.10}, {max:Infinity, rate:0.17}], min: 0.30 },
  "Small Appliances": { name: "小型电器", type: "tiered", threshold: 300.00, rate1: 0.15, rate2: 0.08, min: 0.30 },
  "Computers": { name: "电脑", rate: 0.08, min: 0.30 },
  "Consumer Electronics": { name: "消费类电子产品", rate: 0.08, min: 0.30 },
  "Electronics Accessories": { name: "电子产品配件", type: "tiered", threshold: 100.00, rate1: 0.15, rate2: 0.08, min: 0.30 },
  "Other": { name: "其他", rate: 0.15, min: 0.30 },
  "Eyewear": { name: "眼镜", rate: 0.15, min: 0.30 },
  "Fine Art": { name: "艺术品", type: "tiered_multi", ranges: [{limit:100, rate:0.20}, {limit:1000, rate:0.15}, {limit:5000, rate:0.10}, {limit:Infinity, rate:0.05}], min: 0 },
  "Footwear": { name: "鞋靴", rate: 0.15, min: 0.30 },
  "Full-Size Appliances": { name: "全尺寸电器", rate: 0.08, min: 0.30 },
  "Furniture": { name: "家具", type: "tiered", threshold: 200.00, rate1: 0.15, rate2: 0.10, min: 0.30 },
  "Gift Cards": { name: "礼品卡", rate: 0.20, min: 0 },
  "Grocery": { name: "食品", type: "threshold", threshold: 15.00, lowRate: 0.08, highRate: 0.15, min: 0 },
  "Home & Kitchen": { name: "家居及厨房用品", rate: 0.15, min: 0.30 },
  "Jewelry": { name: "珠宝首饰", type: "tiered", threshold: 250.00, rate1: 0.20, rate2: 0.05, min: 0.30 },
  "Lawn & Garden": { name: "草坪和园艺", rate: 0.15, min: 0.30 },
  "Mowers": { name: "割草机和除雪机", type: "threshold", threshold: 500.00, lowRate: 0.15, highRate: 0.08, min: 0.30 },
  "Mattresses": { name: "床垫", rate: 0.15, min: 0.30 },
  "Media": { name: "媒介类商品", rate: 0.15, min: 0 },
  "Musical Instruments": { name: "乐器和影音制作", rate: 0.15, min: 0.30 },
  "Office Products": { name: "办公用品", rate: 0.15, min: 0.30 },
  "Pet Products": { name: "宠物用品", rate: 0.15, min: 0.30 },
  "Sports": { name: "运动户外", rate: 0.15, min: 0.30 },
  "Tires": { name: "轮胎", rate: 0.10, min: 0.30 },
  "Tools": { name: "工具和家居装修", rate: 0.15, min: 0.30 },
  "Toys": { name: "玩具和游戏", rate: 0.15, min: 0.30 },
  "Video Game Consoles": { name: "视频游戏机", rate: 0.08, min: 0 },
  "Video Games": { name: "视频游戏和游戏配件", rate: 0.15, min: 0 },
  "Watches": { name: "钟表", type: "tiered", threshold: 1500.00, rate1: 0.16, rate2: 0.03, min: 0.30 }
};

const STORAGE_KEY = 'fba_calc_history';

// --- Main Component ---

export default function FBACalculatorPage() {
  const [inputs, setInputs] = useState<any>({
    productName: '',
    shipmentQty: 1,
    length: 0, width: 0, height: 0,
    lengthUnit: 'in', widthUnit: 'in', heightUnit: 'in',
    actualWeight: 0, weightUnit: 'oz',
    productType: 'normal',
    hasLithium: false,
    priceUSD: 0,
    season: 'non_peak',
    version: '2025',
    autoSeason: true,
    surchargeUSD: 0,
    profitPrice: 0,
    exchangeRate: 7.2,
    productCostCNY: 0,
    shippingCostCNY: 0,
    categorySelect: 'custom',
    manualReferralFee: null,
    manualFBAFee: null,
    referralRateCustom: 0.15,
    fbaFeeInput: 0,
    storageFee: 0,
    otherFee: 0,
    promotionCost: 0,
    returnRate: 5,
    unsellableRate: 30,
    acos: 10,
    returnRateSlider: 5,
    acosSlider: 10
  });

  const [results, setResults] = useState<any>({
    tier: '',
    shipWeightOz: 0,
    fee: 'N/A',
    lithiumUSD: 0,
    totalShippingFee: 0,
    surchargeSuggest: false,
    amazonPayout: 0,
    productCostUSD: 0,
    totalCost: 0,
    grossProfit: 0,
    adsCost: 0,
    returnLoss: 0,
    netProfit: 0,
    margin: 0,
    breakEvenACoS: 0,
    netProfitCNY: 0,
    batchInvestment: 0,
    batchNetProfit: 0,
    batchPayout: 0,
    batchROI: 0,
    referralFee: 0
  });

  const [history, setHistory] = useState<any[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [showOpCost, setShowOpCost] = useState(false);
  const [formulaOpen, setFormulaOpen] = useState<any>({});

  const resetAll = () => {
    setInputs({
      productName: '',
      shipmentQty: 1,
      length: 0, width: 0, height: 0,
      lengthUnit: 'in', widthUnit: 'in', heightUnit: 'in',
      actualWeight: 0, weightUnit: 'oz',
      productType: 'normal',
      hasLithium: false,
      priceUSD: 0,
      season: 'non_peak',
      version: '2025',
      autoSeason: true,
      surchargeUSD: 0,
      profitPrice: 0,
      exchangeRate: 7.2,
      productCostCNY: 0,
      shippingCostCNY: 0,
      categorySelect: 'custom',
      manualReferralFee: null,
      manualFBAFee: null,
      referralRateCustom: 0.15,
      fbaFeeInput: 0,
      storageFee: 0,
      otherFee: 0,
      promotionCost: 0,
      returnRate: 5,
      unsellableRate: 30,
      acos: 10,
      returnRateSlider: 5,
      acosSlider: 10
    });
  };

  // Load history on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        setHistory(JSON.parse(saved));
      }
    } catch (e) {
      console.error("Failed to load history", e);
    }
  }, []);

  const [sortedCategories, setSortedCategories] = useState<string[]>([]);

  useEffect(() => {
    const sorted = Object.keys(REFERRAL_RULES).sort((a,b) => REFERRAL_RULES[a].name.localeCompare(REFERRAL_RULES[b].name, 'zh'));
    setSortedCategories(sorted);
  }, []);

  useEffect(() => {
    const now = new Date();
    const toNum = (yy:number, mm:number, dd:number) => yy * 10000 + mm * 100 + dd;
    const inRange = (sY:number,sM:number,sD:number,eY:number,eM:number,eD:number) => {
      const cur = toNum(now.getFullYear(), now.getMonth()+1, now.getDate());
      const s = toNum(sY,sM,sD);
      const e = toNum(eY,eM,eD);
      return cur >= s && cur <= e;
    };
    if (inputs.autoSeason) {
      let season = 'non_peak';
      let version = '2025';
      if (inRange(2025,10,15,2026,1,14)) { season = 'peak'; version = '2025'; }
      else if (toNum(now.getFullYear(), now.getMonth()+1, now.getDate()) >= toNum(2026,1,15)) { season = 'non_peak'; version = '2026'; }
      else { season = 'non_peak'; version = '2025'; }
      setInputs((prev:any) => ({ ...prev, season, version }));
    }
  }, [inputs.autoSeason]);

  // Update logic
  useEffect(() => {
    calculateAll();
  }, [inputs]);

  // Sync inputs that need direct syncing (price, sliders)
  const updateInput = (key: string, value: any) => {
    const newInputs = { ...inputs, [key]: value };
    
    // Sync Logic
    if (key === 'categorySelect') newInputs.manualReferralFee = null;
    if (key === 'returnRateSlider') newInputs.returnRate = value;
    if (key === 'acosSlider') newInputs.acos = value;
    if (key === 'priceUSD') newInputs.profitPrice = value;
    if (key === 'profitPrice') newInputs.priceUSD = value;
    if (key === 'returnRate') newInputs.returnRateSlider = value;
    if (key === 'returnRateSlider') newInputs.returnRate = value;
    if (key === 'acos') newInputs.acosSlider = value;
    if (key === 'acosSlider') newInputs.acos = value;
    if (key === 'productType' && value === 'danger') newInputs.hasLithium = false;
    if (key === 'autoSeason' && value === false) {
      newInputs.autoSeason = false;
    }

    setInputs(newInputs);
  };

  const toggleFormula = (k: string) => {
    setFormulaOpen((p: any) => ({ ...p, [k]: !p[k] }));
  };

  const formulaText = (k: string) => {
    if (k === 'amazonPayout') return '售价 - 佣金 - FBA配送费';
    if (k === 'productCostUSD') return '(采购成本 + 头程运费) ÷ 汇率';
    if (k === 'grossProfit') return '亚马逊回款 - (采购成本 + 头程运费)';
    if (k === 'adsCost') return '售价 × ACoS';
    if (k === 'returnLoss') return '(售价 + FBA配送费) × 退货率 × 不可售比例 + 退款管理费 × 退货率';
    if (k === 'operatingCostTotal') return '广告 + 促销 + 仓储 + 退货损失 + 其他';
    if (k === 'netProfit') return '毛利润 - 总运营成本';
    if (k === 'breakEvenACoS') return '毛利润 ÷ 售价';
    return '';
  };

  const calculateAll = () => {
    // 1. Calculate Shipping Fee
    let l = parseFloat(inputs.length) || 0;
    let w = parseFloat(inputs.width) || 0;
    let h = parseFloat(inputs.height) || 0;
    
    if (inputs.lengthUnit === 'cm') l = cmToInch(l);
    if (inputs.widthUnit === 'cm') w = cmToInch(w);
    if (inputs.heightUnit === 'cm') h = cmToInch(h);

    let actualWeightOz = parseFloat(inputs.actualWeight) || 0;
    if (inputs.weightUnit === 'g') actualWeightOz = gToOz(actualWeightOz);
    if (inputs.weightUnit === 'lb') actualWeightOz = lbToOz(actualWeightOz);

    const getVolumeWeight = (l: number, w: number, h: number) => {
      let _w = Math.max(w, 2);
      let _h = Math.max(h, 2);
      let volumeLb = (l * _w * _h) / 139;
      return Math.max(0, volumeLb);
    };

    let volumeWeightLb = getVolumeWeight(l, w, h);
    let volumeWeightOz = volumeWeightLb * 16;

    const getTier = (l: number, w: number, h: number, shipWeightOz: number) => {
      const { l: L, w: W, h: H } = sort3(l, w, h);
      const sum = L + 2 * W + 2 * H;
      if (shipWeightOz <= 16 && L <= 15 && W <= 12 && H <= 0.75) return "小号标准尺寸";
      if (shipWeightOz <= 320 && L <= 18 && W <= 14 && H <= 8) return "大号标准尺寸";
      const weightLb = shipWeightOz / 16;
      if (weightLb > 150 || L > 108 || sum > 165) return "超大件";
      if (weightLb <= 70 && L <= 60 && W <= 30 && sum <= 130) return "小号大件";
      if (weightLb <= 50 && L <= 108 && sum <= 165) return "大号大件";
      return "超大件";
    };

    let tierTemp = getTier(l, w, h, actualWeightOz);
    let shipWeightOz = actualWeightOz;
    if (!(tierTemp === "小号标准尺寸" || (tierTemp === "超大件" && actualWeightOz >= 2400))) {
      shipWeightOz = Math.max(actualWeightOz, volumeWeightOz);
    }
    let tier = getTier(l, w, h, shipWeightOz);

    const getFee = (productType: string, tier: string, shipWeightOz: number, price: number) => {
      let seasonKey = inputs.season === 'peak' ? 'peak_2025' : (inputs.version === '2026' ? 'non_peak_2026' : 'non_peak_2025');
      const dataset = feeData[productType]?.[seasonKey];
      if (!dataset) return 'N/A';
      
      const band = price < 10 ? 'lt10' : (price <= 50 ? 'mid' : 'high');
      const weightLb = shipWeightOz / 16;

      if (tier === '小号标准尺寸') {
        const steps = dataset.small_standard.steps;
        const fees = dataset.small_standard[band];
        for (let i = 0; i < steps.length; i++) { if (shipWeightOz <= steps[i]) return fees[i]; }
        return 'N/A';
      }
      if (tier === '大号标准尺寸') {
        const ls = dataset.large_standard;
        const steps = ls.pre3_steps_oz;
        const fees = ls[band + '_pre3'];
        for (let i = 0; i < steps.length; i++) { if (shipWeightOz <= steps[i]) return fees[i]; }
        if (productType === 'apparel') {
            if (weightLb > 3) { const base = ls.post3_base[band]; const extra = Math.ceil((shipWeightOz - 48) / 8) * (ls.post3_increment_per_half_lb || 0); return base + extra; }
        } else {
            if (weightLb > 3) { const base = ls.post3_base[band]; const extra = Math.ceil((shipWeightOz - 48) / 4) * (ls.post3_increment_per_4oz || 0); return base + extra; }
        }
        return 'N/A';
      }
      if (tier === '小号大件') { const cfg = dataset.small_oversize_0_50; let fee = cfg.base[band]; if (weightLb > 1) fee += Math.ceil(weightLb - 1) * cfg.per_lb; return fee; }
      if (tier === '大号大件') { const cfg = dataset.large_oversize_0_50; let fee = cfg.base[band]; if (weightLb > 1) fee += Math.ceil(weightLb - 1) * cfg.per_lb; return fee; }
      if (tier === '超大件') {
        if (weightLb <= 50) { const cfg = dataset.super_oversize_0_50; let fee = cfg.base[band]; if (weightLb > 1) fee += Math.ceil(weightLb - 1) * cfg.per_lb; return fee; }
        if (weightLb <= 70) { const cfg = dataset.super_oversize_50_70; const fee = cfg.base[band] + Math.ceil(weightLb - cfg.start_lb) * cfg.per_lb; return fee; }
        if (weightLb <= 150) { const cfg = dataset.super_oversize_70_150; const fee = cfg.base[band] + Math.ceil(weightLb - cfg.start_lb) * cfg.per_lb; return fee; }
        const cfg = dataset.super_oversize_gt_150; const fee = cfg.base[band] + Math.ceil(weightLb - cfg.start_lb) * cfg.per_lb; return fee;
      }
      return 'N/A';
    };

    const priceUSD = parseFloat(inputs.priceUSD) || 0;
    const fee = getFee(inputs.productType, tier, shipWeightOz, priceUSD);
    
    let feeNum = 0;
    if (fee !== 'N/A') {
      feeNum = typeof fee === 'number' ? fee : parseFloat(fee);
    }

    const dims = sort3(l,w,h);
    const sum = dims.l + 2*dims.w + 2*dims.h;
    const weightLb = shipWeightOz / 16;
    const surchargeSuggest = (tier === '超大件' && weightLb <= 150 && (dims.l > 96 || sum > 130));
    const surchargeUSD = parseFloat(inputs.surchargeUSD) || 0;
    const lithiumUSD = (inputs.productType !== 'danger' && inputs.hasLithium) ? 0.11 : 0;
    const totalShippingFee = feeNum + surchargeUSD + lithiumUSD;

    // 2. Profit Calculation
    const profitPrice = parseFloat(inputs.profitPrice) || 0;
    const exchangeRate = parseFloat(inputs.exchangeRate) || 7.2;
    const productCostCNY = parseFloat(inputs.productCostCNY) || 0;
    const shippingCostCNY = parseFloat(inputs.shippingCostCNY) || 0;
    const productCostUSD = (productCostCNY + shippingCostCNY) / exchangeRate;

    let referralFee = 0;
    if (inputs.manualReferralFee !== null) {
      referralFee = parseFloat(inputs.manualReferralFee);
      if (isNaN(referralFee)) referralFee = 0;
    } else if (inputs.categorySelect === 'custom') {
      referralFee = profitPrice * (parseFloat(inputs.referralRateCustom) || 0);
    } else {
      const rule = REFERRAL_RULES[inputs.categorySelect];
      if (rule) {
        // Calculate Referral Fee Logic
        const calculateReferralFee = (price: number, rule: any) => {
           if (!rule) return 0;
           let fee = 0;
           if (rule.type === 'threshold') {
             const rate = price <= rule.threshold ? rule.lowRate : rule.highRate;
             fee = price * rate;
           } else if (rule.type === 'threshold_multi') {
              let rate = rule.ranges[rule.ranges.length - 1].rate;
              for (let r of rule.ranges) {
                if (price <= r.max) { rate = r.rate; break; }
              }
              fee = price * rate;
           } else if (rule.type === 'tiered') {
             if (price <= rule.threshold) {
               fee = price * rule.rate1;
             } else {
               fee = (rule.threshold * rule.rate1) + ((price - rule.threshold) * rule.rate2);
             }
           } else if (rule.type === 'tiered_multi') {
              let remaining = price;
              let prevLimit = 0;
              for (let r of rule.ranges) {
                const limit = r.limit;
                const rangeSize = limit - prevLimit;
                const taxableAmount = Math.min(remaining, rangeSize);
                if (taxableAmount > 0) {
                  fee += taxableAmount * r.rate;
                  remaining -= taxableAmount;
                }
                prevLimit = limit;
                if (remaining <= 0) break;
              }
           } else {
             fee = price * rule.rate;
           }
           if (rule.min && fee < rule.min) fee = rule.min;
           return fee;
        };
        referralFee = calculateReferralFee(profitPrice, rule);
      }
    }

    // Auto update fbaFeeInput if needed, but we rely on the one from state for calculation?
    // In React, we should probably update the input state if it hasn't been manually touched?
    // Or just use totalShippingFee for calculation if fbaFeeInput is not manually set.
    // To match original behavior: It updates the input.
    // However, triggering state update inside render/calc cycle is bad.
    // We'll calculate profit using `totalShippingFee` unless user manually overrides.
    // Actually, let's just use `totalShippingFee` for now as the "FBA Fee" in profit calc,
    // and display it. If we want manual override, we'd need a separate "manualFBAFee" state or similar.
    // For simplicity and to match the HTML behavior where it auto-updates:
    const finalFBAFee = inputs.manualFBAFee !== null ? (parseFloat(inputs.manualFBAFee) || 0) : totalShippingFee;

    const storageFee = parseFloat(inputs.storageFee) || 0;
    const otherFee = parseFloat(inputs.otherFee) || 0;
    const returnRate = (parseFloat(inputs.returnRate) || 0) / 100;
    const unsellableRate = (parseFloat(inputs.unsellableRate) || 0) / 100;
    const refundAdminFeeUnit = Math.min(5.00, referralFee * 0.20);
    const returnLossUnsellable = (profitPrice + finalFBAFee) * returnRate * unsellableRate;
    const returnLossAdmin = refundAdminFeeUnit * returnRate;
    const returnLoss = returnLossUnsellable + returnLossAdmin;
    
    const acos = (parseFloat(inputs.acos) || 0) / 100;
    const adsCost = profitPrice * acos;

    const amazonPayout = profitPrice - referralFee - finalFBAFee;
    const promotionCost = parseFloat(inputs.promotionCost) || 0;
    const totalOperatingCost = adsCost + storageFee + returnLoss + otherFee + promotionCost;
    const realGrossProfit = amazonPayout - productCostUSD;
    const netProfit = realGrossProfit - totalOperatingCost;
    const netProfitMargin = profitPrice > 0 ? (netProfit / profitPrice) : 0;
    const breakEvenACoS = profitPrice > 0 ? (realGrossProfit / profitPrice) : 0;
    const netProfitCNY = netProfit * exchangeRate;

    const shipmentQty = parseInt(inputs.shipmentQty) || 1;
    const totalInvestmentCNY = (productCostCNY + shippingCostCNY) * shipmentQty;
    const totalNetProfitCNY = netProfitCNY * shipmentQty;
    const totalPayoutUSD = amazonPayout * shipmentQty;
    let batchROI = 0;
    if (totalInvestmentCNY > 0) {
      batchROI = totalNetProfitCNY / totalInvestmentCNY;
    } else if (totalNetProfitCNY > 0) {
      batchROI = 999;
    }

    setResults({
      tier,
      shipWeightOz,
      fee,
      lithiumUSD,
      totalShippingFee,
      surchargeSuggest,
      amazonPayout,
      productCostUSD,
      totalCost: productCostUSD + referralFee + finalFBAFee + totalOperatingCost,
      grossProfit: realGrossProfit,
      adsCost,
      promotionCost,
      returnLoss,
      returnLossUnsellable,
      returnLossAdmin,
      refundAdminFeeUnit,
      netProfit,
      margin: netProfitMargin,
      breakEvenACoS,
      netProfitCNY,
      operatingCostTotal: totalOperatingCost,
      batchInvestment: totalInvestmentCNY,
      batchNetProfit: totalNetProfitCNY,
      batchPayout: totalPayoutUSD,
      batchROI,
      referralFee // added for display
    });
  };

  const saveToHistory = () => {
    const name = inputs.productName || '未命名商品';
    const time = new Date().toLocaleString('zh-CN', { hour12: false });
    // 直接现算一次配送费，避免因状态未更新而保存为0
    let l = parseFloat(inputs.length) || 0;
    let w = parseFloat(inputs.width) || 0;
    let h = parseFloat(inputs.height) || 0;
    if (inputs.lengthUnit === 'cm') l = cmToInch(l);
    if (inputs.widthUnit === 'cm') w = cmToInch(w);
    if (inputs.heightUnit === 'cm') h = cmToInch(h);
    let actualWeightOz = parseFloat(inputs.actualWeight) || 0;
    if (inputs.weightUnit === 'g') actualWeightOz = gToOz(actualWeightOz);
    if (inputs.weightUnit === 'lb') actualWeightOz = lbToOz(actualWeightOz);
    const getVolumeWeight = (l: number, w: number, h: number) => { let _w = Math.max(w, 2); let _h = Math.max(h, 2); let volumeLb = (l * _w * _h) / 139; return Math.max(0, volumeLb); };
    let volumeWeightOz = getVolumeWeight(l, w, h) * 16;
    const getTier = (l: number, w: number, h: number, shipWeightOz: number) => { const { l: L, w: W, h: H } = sort3(l, w, h); const sum = L + 2 * W + 2 * H; if (shipWeightOz <= 16 && L <= 15 && W <= 12 && H <= 0.75) return "小号标准尺寸"; if (shipWeightOz <= 320 && L <= 18 && W <= 14 && H <= 8) return "大号标准尺寸"; const weightLb = shipWeightOz / 16; if (weightLb > 150 || L > 108 || sum > 165) return "超大件"; if (weightLb <= 70 && L <= 60 && W <= 30 && sum <= 130) return "小号大件"; if (weightLb <= 50 && L <= 108 && sum <= 165) return "大号大件"; return "超大件"; };
    let tierTemp = getTier(l, w, h, actualWeightOz);
    let shipWeightOz = actualWeightOz;
    if (!(tierTemp === "小号标准尺寸" || (tierTemp === "超大件" && actualWeightOz >= 2400))) { shipWeightOz = Math.max(actualWeightOz, volumeWeightOz); }
    let tier = getTier(l, w, h, shipWeightOz);
    const priceUSD = parseFloat(inputs.priceUSD) || 0;
    const seasonKey = inputs.season === 'peak' ? 'peak_2025' : (inputs.version === '2026' ? 'non_peak_2026' : 'non_peak_2025');
    const dataset = feeData[inputs.productType]?.[seasonKey];
    const band = priceUSD < 10 ? 'lt10' : (priceUSD <= 50 ? 'mid' : 'high');
    const weightLb = shipWeightOz / 16;
    const pickFee = () => {
      if (!dataset) return 0;
      if (tier === '小号标准尺寸') { const steps = dataset.small_standard.steps; const fees = dataset.small_standard[band]; for (let i = 0; i < steps.length; i++) { if (shipWeightOz <= steps[i]) return fees[i]; } return 0; }
      if (tier === '大号标准尺寸') {
        const ls = dataset.large_standard; const steps = ls.pre3_steps_oz; const fees = ls[band + '_pre3'];
        for (let i = 0; i < steps.length; i++) { if (shipWeightOz <= steps[i]) return fees[i]; }
        if (inputs.productType === 'apparel') { if (weightLb > 3) { const base = ls.post3_base[band]; const extra = Math.ceil((shipWeightOz - 48) / 8) * (ls.post3_increment_per_half_lb || 0); return base + extra; } }
        else { if (weightLb > 3) { const base = ls.post3_base[band]; const extra = Math.ceil((shipWeightOz - 48) / 4) * (ls.post3_increment_per_4oz || 0); return base + extra; } }
        return 0;
      }
      if (tier === '小号大件') { const cfg = dataset.small_oversize_0_50; let fee = cfg.base[band]; if (weightLb > 1) fee += Math.ceil(weightLb - 1) * cfg.per_lb; return fee; }
      if (tier === '大号大件') { const cfg = dataset.large_oversize_0_50; let fee = cfg.base[band]; if (weightLb > 1) fee += Math.ceil(weightLb - 1) * cfg.per_lb; return fee; }
      if (tier === '超大件') {
        if (weightLb <= 50) { const cfg = dataset.super_oversize_0_50; let fee = cfg.base[band]; if (weightLb > 1) fee += Math.ceil(weightLb - 1) * cfg.per_lb; return fee; }
        if (weightLb <= 70) { const cfg = dataset.super_oversize_50_70; return cfg.base[band] + Math.ceil(weightLb - cfg.start_lb) * cfg.per_lb; }
        if (weightLb <= 150) { const cfg = dataset.super_oversize_70_150; return cfg.base[band] + Math.ceil(weightLb - cfg.start_lb) * cfg.per_lb; }
        const cfg = dataset.super_oversize_gt_150; return cfg.base[band] + Math.ceil(weightLb - cfg.start_lb) * cfg.per_lb;
      }
      return 0;
    };
    let feeNum = pickFee();
    const surchargeUSD = parseFloat(inputs.surchargeUSD) || 0;
    const lithiumUSD = (inputs.productType !== 'danger' && inputs.hasLithium) ? 0.11 : 0;
    const totalShippingFeeSave = feeNum + surchargeUSD + lithiumUSD;
    const finalFBAFeeForSave = inputs.manualFBAFee !== null && String(inputs.manualFBAFee).trim() !== ''
      ? (parseFloat(String(inputs.manualFBAFee)) || 0)
      : totalShippingFeeSave;
    const newItem = {
        id: Date.now(),
        time,
        name,
        price: inputs.priceUSD,
        netProfit: results.netProfit.toFixed(2),
        margin: (results.margin * 100).toFixed(2) + '%',
        inputs: { ...inputs, fbaFeeInput: finalFBAFeeForSave }
    };
    const newHistory = [newItem, ...history].slice(0, 20);
    setHistory(newHistory);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newHistory));
    alert('记录已保存');
  };

  const loadFromHistory = (item: any) => {
    const loaded = { ...item.inputs };
    const tryGet = (...keys: string[]) => {
      for (const k of keys) {
        const v: any = (loaded as any)[k];
        if (v !== undefined && v !== null && String(v).trim() !== '') {
          const num = typeof v === 'number' ? v : parseFloat(String(v));
          return isNaN(num) ? v : num;
        }
      }
      return null;
    };
    if (loaded.manualFBAFee === undefined || loaded.manualFBAFee === null || String(loaded.manualFBAFee).trim() === '') {
      const v = tryGet(
        'manualFBAFee',
        'fbaFeeInput',
        'FBAFeeManual',
        'fbaFee',
        'manual_fba_fee',
        'FBA_Fee',
        'shippingFeeManual',
        'shipping_fee_manual',
        'FBA配送费',
        '配送费',
        'fba_fee',
        'fbafee',
        'shippingFee',
        'shipping_fee'
      );
      if (v === null) {
        const v2 = (item as any)?.fbaFeeInput ?? (item as any)?.totalShippingFee ?? (item as any)?.results?.totalShippingFee ?? null;
        if (v2 !== null && v2 !== undefined) (loaded as any).manualFBAFee = typeof v2 === 'number' ? v2 : parseFloat(String(v2)) || 0;
      } else {
        (loaded as any).manualFBAFee = v;
      }
    }
    if (!(loaded as any).manualFBAFee || (parseFloat(String((loaded as any).manualFBAFee)) || 0) <= 0) {
      // 兼容旧记录：若未保存配送费或为0，则按当前输入自动现算一遍并填充
      let l = parseFloat(loaded.length) || 0;
      let w = parseFloat(loaded.width) || 0;
      let h = parseFloat(loaded.height) || 0;
      if (loaded.lengthUnit === 'cm') l = cmToInch(l);
      if (loaded.widthUnit === 'cm') w = cmToInch(w);
      if (loaded.heightUnit === 'cm') h = cmToInch(h);
      let actualWeightOz = parseFloat(loaded.actualWeight) || 0;
      if (loaded.weightUnit === 'g') actualWeightOz = gToOz(actualWeightOz);
      if (loaded.weightUnit === 'lb') actualWeightOz = lbToOz(actualWeightOz);
      const getVolumeWeight = (l: number, w: number, h: number) => { let _w = Math.max(w, 2); let _h = Math.max(h, 2); let volumeLb = (l * _w * _h) / 139; return Math.max(0, volumeLb); };
      let volumeWeightOz = getVolumeWeight(l, w, h) * 16;
      const getTier = (l: number, w: number, h: number, shipWeightOz: number) => { const { l: L, w: W, h: H } = sort3(l, w, h); const sum = L + 2 * W + 2 * H; if (shipWeightOz <= 16 && L <= 15 && W <= 12 && H <= 0.75) return "小号标准尺寸"; if (shipWeightOz <= 320 && L <= 18 && W <= 14 && H <= 8) return "大号标准尺寸"; const weightLb = shipWeightOz / 16; if (weightLb > 150 || L > 108 || sum > 165) return "超大件"; if (weightLb <= 70 && L <= 60 && W <= 30 && sum <= 130) return "小号大件"; if (weightLb <= 50 && L <= 108 && sum <= 165) return "大号大件"; return "超大件"; };
      let tierTemp = getTier(l, w, h, actualWeightOz);
      let shipWeightOz = actualWeightOz;
      if (!(tierTemp === "小号标准尺寸" || (tierTemp === "超大件" && actualWeightOz >= 2400))) { shipWeightOz = Math.max(actualWeightOz, volumeWeightOz); }
      let tier = getTier(l, w, h, shipWeightOz);
      const priceUSD = parseFloat(loaded.priceUSD) || 0;
      const seasonKey = loaded.season === 'peak' ? 'peak_2025' : (loaded.version === '2026' ? 'non_peak_2026' : 'non_peak_2025');
      const dataset = feeData[loaded.productType]?.[seasonKey];
      const band = priceUSD < 10 ? 'lt10' : (priceUSD <= 50 ? 'mid' : 'high');
      const weightLb = shipWeightOz / 16;
      const pickFee = () => {
        if (!dataset) return 0;
        if (tier === '小号标准尺寸') { const steps = dataset.small_standard.steps; const fees = dataset.small_standard[band]; for (let i = 0; i < steps.length; i++) { if (shipWeightOz <= steps[i]) return fees[i]; } return 0; }
        if (tier === '大号标准尺寸') {
          const ls = dataset.large_standard; const steps = ls.pre3_steps_oz; const fees = ls[band + '_pre3'];
          for (let i = 0; i < steps.length; i++) { if (shipWeightOz <= steps[i]) return fees[i]; }
          if (loaded.productType === 'apparel') { if (weightLb > 3) { const base = ls.post3_base[band]; const extra = Math.ceil((shipWeightOz - 48) / 8) * (ls.post3_increment_per_half_lb || 0); return base + extra; } }
          else { if (weightLb > 3) { const base = ls.post3_base[band]; const extra = Math.ceil((shipWeightOz - 48) / 4) * (ls.post3_increment_per_4oz || 0); return base + extra; } }
          return 0;
        }
        if (tier === '小号大件') { const cfg = dataset.small_oversize_0_50; let fee = cfg.base[band]; if (weightLb > 1) fee += Math.ceil(weightLb - 1) * cfg.per_lb; return fee; }
        if (tier === '大号大件') { const cfg = dataset.large_oversize_0_50; let fee = cfg.base[band]; if (weightLb > 1) fee += Math.ceil(weightLb - 1) * cfg.per_lb; return fee; }
        if (tier === '超大件') {
          if (weightLb <= 50) { const cfg = dataset.super_oversize_0_50; let fee = cfg.base[band]; if (weightLb > 1) fee += Math.ceil(weightLb - 1) * cfg.per_lb; return fee; }
          if (weightLb <= 70) { const cfg = dataset.super_oversize_50_70; return cfg.base[band] + Math.ceil(weightLb - cfg.start_lb) * cfg.per_lb; }
          if (weightLb <= 150) { const cfg = dataset.super_oversize_70_150; return cfg.base[band] + Math.ceil(weightLb - cfg.start_lb) * cfg.per_lb; }
          const cfg = dataset.super_oversize_gt_150; return cfg.base[band] + Math.ceil(weightLb - cfg.start_lb) * cfg.per_lb;
        }
        return 0;
      };
      let feeNum = pickFee();
      const surchargeUSD = parseFloat(loaded.surchargeUSD) || 0;
      const lithiumUSD = (loaded.productType !== 'danger' && loaded.hasLithium) ? 0.11 : 0;
      (loaded as any).manualFBAFee = feeNum + surchargeUSD + lithiumUSD;
    }
    setInputs(loaded);
    setShowHistory(false);
  };

  const deleteHistoryItem = (id: number) => {
    if(!confirm('确定删除此记录?')) return;
    const newHistory = history.filter(i => i.id !== id);
    setHistory(newHistory);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newHistory));
  };

  const clearHistory = () => {
    if(confirm('确定要清空所有记录吗？')) {
        setHistory([]);
        localStorage.removeItem(STORAGE_KEY);
    }
  };

  const copyResult = () => {
    const text = `【${inputs.productName || '商品'}】利润分析
回款: $${results.amazonPayout.toFixed(2)}
总成本: $${results.totalCost.toFixed(2)}
净利润: $${results.netProfit.toFixed(2)}
净利率: ${(results.margin * 100).toFixed(2)}%

【整批分析 (数量: ${inputs.shipmentQty})】
总资金投入: ¥${results.batchInvestment.toFixed(2)}
预计总净利: ¥${results.batchNetProfit.toFixed(2)}
最后回款: $${results.batchPayout.toFixed(2)}
投资回报率: ${(results.batchROI * 100).toFixed(2)}%`;

    navigator.clipboard.writeText(text).then(() => {
        alert('结果已复制到剪贴板');
    }).catch(err => {
        console.error('Failed to copy: ', err);
        alert('复制失败，请手动复制');
    });
  };

  // Chart Logic
  const renderChart = () => {
      if (inputs.priceUSD <= 0) return null;
      const total = parseFloat(inputs.priceUSD);
      const getPct = (val: number) => Math.max(0, (val / total) * 100);
      
      const costPct = getPct((results.totalCost - results.fee - results.referralFee - results.adsCost - results.returnLoss - parseFloat(inputs.storageFee) - parseFloat(inputs.otherFee))); // Wait, totalCost includes everything.
      // Let's reconstruct components for chart:
      const productCostUSD = (parseFloat(inputs.productCostCNY) + parseFloat(inputs.shippingCostCNY)) / parseFloat(inputs.exchangeRate);
      
      const costP = getPct(productCostUSD);
      const fbaP = getPct(results.totalShippingFee);
      const refP = getPct(results.referralFee);
      const adsP = getPct(results.adsCost);
      const otherP = getPct(results.returnLoss + parseFloat(inputs.storageFee) + parseFloat(inputs.otherFee));
      const profitP = results.netProfit > 0 ? getPct(results.netProfit) : 0;

      return (
        <div className="flex h-6 rounded-md overflow-hidden bg-gray-200 mb-4 cursor-help text-[10px] text-white/90">
            <div className="flex items-center justify-center bg-gray-500" style={{width: `${costP}%`}} title={`采购+头程: $${productCostUSD.toFixed(2)}`}></div>
            <div className="flex items-center justify-center bg-cyan-500" style={{width: `${fbaP}%`}} title={`FBA配送: $${results.totalShippingFee.toFixed(2)}`}></div>
            <div className="flex items-center justify-center bg-yellow-500 text-gray-800" style={{width: `${refP}%`}} title={`佣金: $${results.referralFee.toFixed(2)}`}></div>
            <div className="flex items-center justify-center bg-orange-500" style={{width: `${adsP}%`}} title={`广告: $${results.adsCost.toFixed(2)}`}></div>
            <div className="flex items-center justify-center bg-red-500" style={{width: `${otherP}%`}} title={`其他(退货/仓储): ${(results.returnLoss + parseFloat(inputs.storageFee) + parseFloat(inputs.otherFee)).toFixed(2)}`}></div>
            {profitP > 0 && <div className="flex items-center justify-center bg-green-500" style={{width: `${profitP}%`}} title={`净利润: $${results.netProfit.toFixed(2)}`}></div>}
        </div>
      );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 mb-2">
        <Truck className="h-6 w-6 text-blue-600" />
        <h2 className="text-xl font-bold text-gray-800">美国站配送费及利润计算</h2>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Column: Shipping */}
        <Card className="p-6 space-y-6">
          <div className="flex items-center gap-2 pb-2 border-b border-gray-100">
             <h3 className="font-bold text-gray-700">📦 配送费计算</h3>
             <div className="ml-auto">
               <button onClick={resetAll} className="text-xs px-3 py-1.5 rounded border border-gray-200 text-gray-600 hover:bg-gray-50">重置</button>
             </div>
          </div>

          <div className="space-y-4">
             {/* Product Info */}
             <div className="bg-gray-50 p-4 rounded-lg space-y-3">
               <h4 className="text-xs font-bold text-gray-500 uppercase">商品信息</h4>
               <div className="flex gap-4">
                 <div className="flex-1">
                   <label className="text-xs text-gray-500 mb-1 block">名称</label>
                   <Input value={inputs.productName} onChange={(e:any) => updateInput('productName', e.target.value)} placeholder="例如: iPhone 15 Case" />
                 </div>
                 <div className="w-24">
                   <label className="text-xs text-gray-500 mb-1 block">发货数量</label>
                   <Input type="number" value={inputs.shipmentQty} onChange={(e:any) => updateInput('shipmentQty', e.target.value)} />
                 </div>
               </div>
             </div>

             {/* Dimensions */}
             <div className="bg-gray-50 p-4 rounded-lg space-y-3">
               <h4 className="text-xs font-bold text-gray-500 uppercase">商品尺寸</h4>
               <div className="grid grid-cols-3 gap-4">
                 <div>
                   <label className="text-xs text-gray-500 mb-1 block">长</label>
                   <div className="flex">
                     <Input type="number" value={inputs.length} onChange={(e:any) => updateInput('length', e.target.value)} className="rounded-r-none border-r-0" />
                     <select className="bg-gray-100 border border-gray-300 rounded-r-md text-xs px-1 focus:outline-none" value={inputs.lengthUnit} onChange={(e:any) => updateInput('lengthUnit', e.target.value)}>
                        <option value="in">in</option><option value="cm">cm</option>
                     </select>
                   </div>
                 </div>
                 <div>
                   <label className="text-xs text-gray-500 mb-1 block">宽</label>
                   <div className="flex">
                     <Input type="number" value={inputs.width} onChange={(e:any) => updateInput('width', e.target.value)} className="rounded-r-none border-r-0" />
                     <select className="bg-gray-100 border border-gray-300 rounded-r-md text-xs px-1 focus:outline-none" value={inputs.widthUnit} onChange={(e:any) => updateInput('widthUnit', e.target.value)}>
                        <option value="in">in</option><option value="cm">cm</option>
                     </select>
                   </div>
                 </div>
                 <div>
                   <label className="text-xs text-gray-500 mb-1 block">高</label>
                   <div className="flex">
                     <Input type="number" value={inputs.height} onChange={(e:any) => updateInput('height', e.target.value)} className="rounded-r-none border-r-0" />
                     <select className="bg-gray-100 border border-gray-300 rounded-r-md text-xs px-1 focus:outline-none" value={inputs.heightUnit} onChange={(e:any) => updateInput('heightUnit', e.target.value)}>
                        <option value="in">in</option><option value="cm">cm</option>
                     </select>
                   </div>
                 </div>
               </div>
             </div>

             {/* Weight */}
             <div className="bg-gray-50 p-4 rounded-lg space-y-3">
               <h4 className="text-xs font-bold text-gray-500 uppercase">重量</h4>
               <div className="flex gap-4">
                  <div className="flex-1">
                   <label className="text-xs text-gray-500 mb-1 block">实重</label>
                   <div className="flex">
                     <Input type="number" value={inputs.actualWeight} onChange={(e:any) => updateInput('actualWeight', e.target.value)} className="rounded-r-none border-r-0" />
                     <select className="bg-gray-100 border border-gray-300 rounded-r-md text-xs px-2 focus:outline-none" value={inputs.weightUnit} onChange={(e:any) => updateInput('weightUnit', e.target.value)}>
                        <option value="oz">oz</option><option value="g">g</option><option value="lb">lb</option>
                     </select>
                   </div>
                  </div>
               </div>
             </div>

             {/* Attributes */}
             <div className="bg-gray-50 p-4 rounded-lg space-y-3">
               <h4 className="text-xs font-bold text-gray-500 uppercase">商品属性</h4>
               <div className="flex gap-4 items-center">
                 <div className="flex-1">
                    <label className="text-xs text-gray-500 mb-1 block">类型</label>
                    <select className="w-full h-9 rounded-md border border-gray-300 bg-transparent px-3 py-1 text-sm shadow-sm" value={inputs.productType} onChange={(e:any) => updateInput('productType', e.target.value)}>
                      <option value="normal">普通 (Normal)</option>
                      <option value="apparel">服装 (Apparel)</option>
                      <option value="danger">危险品 (Dangerous)</option>
                    </select>
                 </div>
                <div className="flex items-center pt-5">
                   <input type="checkbox" checked={inputs.hasLithium} onChange={(e:any) => updateInput('hasLithium', e.target.checked)} className="mr-2" disabled={inputs.productType === 'danger'} />
                   <span className="text-sm text-gray-700">含锂电池</span>
                 </div>
               </div>
             </div>

             {/* Settings */}
             <div className="bg-gray-50 p-4 rounded-lg space-y-3">
               <h4 className="text-xs font-bold text-gray-500 uppercase">计费设置</h4>
               <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">售价($)</label>
                    <Input type="number" value={inputs.priceUSD} onChange={(e:any) => updateInput('priceUSD', e.target.value)} className="bg-yellow-50 border-yellow-200" />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">附加费($)</label>
                    <Input type="number" value={inputs.surchargeUSD} onChange={(e:any) => updateInput('surchargeUSD', e.target.value)} />
                  </div>
               </div>
               <div className="flex gap-4 items-center">
                  <div className="flex-1">
                     <label className="text-xs text-gray-500 mb-1 block">季节</label>
                     <select disabled={inputs.autoSeason} className="w-full h-9 rounded-md border border-gray-300 bg-transparent px-3 py-1 text-sm shadow-sm disabled:opacity-50" value={inputs.season} onChange={(e:any) => updateInput('season', e.target.value)}>
                        <option value="non_peak">非旺季</option>
                        <option value="peak">旺季</option>
                     </select>
                  </div>
                  <div className="flex-1">
                     <label className="text-xs text-gray-500 mb-1 block">版本</label>
                     <select disabled={inputs.autoSeason} className="w-full h-9 rounded-md border border-gray-300 bg-transparent px-3 py-1 text-sm shadow-sm disabled:opacity-50" value={inputs.version} onChange={(e:any) => updateInput('version', e.target.value)}>
                        <option value="2025">2025</option>
                        <option value="2026">2026</option>
                     </select>
                  </div>
               </div>
               <div className="flex items-center">
                    <input type="checkbox" checked={inputs.autoSeason} onChange={(e:any) => updateInput('autoSeason', e.target.checked)} className="mr-2" />
                    <span className="text-sm text-gray-700">自动按日期</span>
               </div>
             </div>

             {/* Result Box */}
             <div className="bg-blue-50 border border-blue-100 rounded-lg p-4 text-sm text-gray-700 space-y-1">
               <div className="flex justify-between"><span>尺寸标准:</span> <span className="font-medium">{results.tier || 'N/A'}</span></div>
               <div className="flex justify-between"><span>配送重量:</span> <span className="font-medium">{round2(results.shipWeightOz)} oz ({round2(ozToLb(results.shipWeightOz))} lb)</span></div>
               <div className="flex justify-between"><span>基本配送费:</span> <span className="font-medium">{typeof results.fee === 'number' ? '$'+results.fee.toFixed(2) : results.fee}</span></div>
               {results.lithiumUSD > 0 && <div className="flex justify-between"><span>锂电池费:</span> <span className="font-medium">${results.lithiumUSD.toFixed(2)}</span></div>}
               {parseFloat(inputs.surchargeUSD) > 0 && <div className="flex justify-between"><span>附加费:</span> <span className="font-medium">${parseFloat(inputs.surchargeUSD).toFixed(2)}</span></div>}
               <div className="border-t border-blue-200 pt-2 mt-2 flex justify-between text-base font-bold text-blue-800">
                 <span>总配送费:</span> <span>${results.totalShippingFee.toFixed(2)}</span>
               </div>
               {results.surchargeSuggest && <div className="text-xs text-yellow-600 mt-1">⚠️ 可能产生特大号附加费</div>}
             </div>
          </div>
        </Card>

        {/* Right Column: Profit */}
        <Card className="p-6 space-y-6">
          <div className="flex items-center gap-2 pb-2 border-b border-gray-100">
             <h3 className="font-bold text-gray-700">💰 利润计算</h3>
          </div>

          <div className="space-y-4">
            {/* Core Data */}
            <div className="bg-gray-50 p-4 rounded-lg space-y-3">
               <h4 className="text-xs font-bold text-gray-500 uppercase">核心数据</h4>
               <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">售价($)</label>
                    <Input type="number" value={inputs.profitPrice} onChange={(e:any) => updateInput('profitPrice', e.target.value)} className="bg-yellow-50 border-yellow-200" />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">汇率(￥/$)</label>
                    <Input type="number" value={inputs.exchangeRate} onChange={(e:any) => updateInput('exchangeRate', e.target.value)} />
                  </div>
               </div>
            </div>

            {/* Cost */}
            <div className="bg-gray-50 p-4 rounded-lg space-y-3">
               <h4 className="text-xs font-bold text-gray-500 uppercase">成本 (CNY)</h4>
               <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">采购成本(￥)</label>
                    <Input type="number" value={inputs.productCostCNY} onChange={(e:any) => updateInput('productCostCNY', e.target.value)} className="bg-yellow-50 border-yellow-200" />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">头程运费(￥)</label>
                    <Input type="number" value={inputs.shippingCostCNY} onChange={(e:any) => updateInput('shippingCostCNY', e.target.value)} className="bg-yellow-50 border-yellow-200" />
                  </div>
               </div>
            </div>

            {/* Amazon Fees */}
            <div className="bg-gray-50 p-4 rounded-lg space-y-3">
               <h4 className="text-xs font-bold text-gray-500 uppercase">亚马逊费用 (USD)</h4>
               <div>
                  <label className="text-xs text-gray-500 mb-1 block">商品类目</label>
                  <select className="w-full h-9 rounded-md border border-gray-300 bg-transparent px-3 py-1 text-sm shadow-sm" value={inputs.categorySelect} onChange={(e:any) => updateInput('categorySelect', e.target.value)}>
                    <option value="custom">-- 自定义 (Custom) --</option>
                    {sortedCategories.map(key => (
                        <option key={key} value={key}>{REFERRAL_RULES[key].name} ({key})</option>
                    ))}
                  </select>
               </div>
               <div className="grid grid-cols-2 gap-4">
                 <div>
                    <label className="text-xs text-gray-500 mb-1 block">佣金费($)</label>
                    <div className="relative">
                        <Input 
                            value={inputs.manualReferralFee !== null ? inputs.manualReferralFee : results.referralFee.toFixed(2)} 
                            onChange={(e:any) => updateInput('manualReferralFee', e.target.value)}
                            className={inputs.manualReferralFee !== null ? "bg-white pr-8" : "bg-gray-100 text-gray-500"} 
                        />
                        {inputs.manualReferralFee !== null && (
                            <button 
                                onClick={() => updateInput('manualReferralFee', null)}
                                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-blue-600"
                                title="重置为自动计算"
                            >
                                <RotateCcw className="w-4 h-4" />
                            </button>
                        )}
                    </div>
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">自定义比例</label>
                    <Input type="number" value={inputs.referralRateCustom} onChange={(e:any) => updateInput('referralRateCustom', e.target.value)} disabled={inputs.categorySelect !== 'custom'} />
                  </div>
               </div>
               <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">FBA配送费($)</label>
                  <div className="relative">
                    <Input 
                      type="number" 
                      value={inputs.manualFBAFee !== null ? inputs.manualFBAFee : results.totalShippingFee.toFixed(2)} 
                      onChange={(e:any) => updateInput('manualFBAFee', e.target.value)} 
                      className={inputs.manualFBAFee !== null ? "bg-white pr-8" : "bg-gray-100 text-gray-500"} 
                    />
                    {inputs.manualFBAFee !== null && (
                      <button 
                        onClick={() => updateInput('manualFBAFee', null)} 
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-blue-600" 
                        title="重置为自动计算"
                      >
                        <RotateCcw className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">月仓储费($)</label>
                  <Input type="number" value={inputs.storageFee} onChange={(e:any) => updateInput('storageFee', e.target.value)} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">其他杂费($)</label>
                  <Input type="number" value={inputs.otherFee} onChange={(e:any) => updateInput('otherFee', e.target.value)} />
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">促销费用($)</label>
                  <Input type="number" value={inputs.promotionCost} onChange={(e:any) => updateInput('promotionCost', e.target.value)} />
                </div>
              </div>
            </div>

            {/* Operations */}
            <div className="bg-gray-50 p-4 rounded-lg space-y-3">
               <h4 className="text-xs font-bold text-gray-500 uppercase">运营指标</h4>
               <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">退货率(%)</label>
                    <Input type="number" value={inputs.returnRate} onChange={(e:any) => updateInput('returnRate', e.target.value)} />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">不可售(%)</label>
                    <Input type="number" value={inputs.unsellableRate} onChange={(e:any) => updateInput('unsellableRate', e.target.value)} />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">广告ACoS(%)</label>
                    <Input type="number" value={inputs.acos} onChange={(e:any) => updateInput('acos', e.target.value)} />
                  </div>
               </div>
            </div>

            {/* Sensitivity */}
            <div className="bg-yellow-50 border border-yellow-100 p-4 rounded-lg space-y-3">
               <h4 className="text-xs font-bold text-yellow-700 uppercase">敏感性分析</h4>
               <div>
                  <div className="flex justify-between text-xs text-gray-600 mb-1">
                      <span>退货率: {inputs.returnRateSlider}%</span>
                  </div>
                  <input type="range" min="0" max="30" step="0.5" value={inputs.returnRateSlider} onChange={(e:any) => updateInput('returnRateSlider', e.target.value)} className="w-full h-2 bg-yellow-200 rounded-lg appearance-none cursor-pointer" />
               </div>
               <div>
                  <div className="flex justify-between text-xs text-gray-600 mb-1">
                      <span>广告ACoS: {inputs.acosSlider}%</span>
                  </div>
                  <input type="range" min="0" max="100" step="1" value={inputs.acosSlider} onChange={(e:any) => updateInput('acosSlider', e.target.value)} className="w-full h-2 bg-yellow-200 rounded-lg appearance-none cursor-pointer" />
               </div>
            </div>

            <div className="bg-green-50 border border-green-100 rounded-lg p-4 text-sm text-gray-700 space-y-2">
               {renderChart()}
               <div className="flex justify-between items-center relative">
                 <span className="flex items-center gap-2">
                   <span>亚马逊回款:</span>
                   <button onClick={()=>toggleFormula('amazonPayout')} className="w-5 h-5 rounded-full bg-gray-200 text-gray-700 hover:bg-gray-300 text-xs">?</button>
                 </span>
                 <span className="font-medium">${results.amazonPayout.toFixed(2)}</span>
                 {formulaOpen['amazonPayout'] && <div className="absolute right-0 top-6 z-10 bg-white border border-gray-200 rounded-md shadow px-2 py-1 text-xs text-gray-700">公式: {formulaText('amazonPayout')}</div>}
               </div>
               <div className="flex justify-between items-center relative">
                 <span className="flex items-center gap-2">
                   <span>总成本:</span>
                   <button onClick={()=>toggleFormula('productCostUSD')} className="w-5 h-5 rounded-full bg-gray-200 text-gray-700 hover:bg-gray-300 text-xs">?</button>
                 </span>
                 <span className="font-medium">${results.productCostUSD.toFixed(2)}</span>
                 {formulaOpen['productCostUSD'] && <div className="absolute right-0 top-6 z-10 bg-white border border-gray-200 rounded-md shadow px-2 py-1 text-xs text-gray-700">公式: {formulaText('productCostUSD')}</div>}
               </div>
               <div className="flex justify-between items-center relative">
                 <span className="flex items-center gap-2">
                   <span>广告费:</span>
                   <button onClick={()=>toggleFormula('adsCost')} className="w-5 h-5 rounded-full bg-gray-200 text-gray-700 hover:bg-gray-300 text-xs">?</button>
                 </span>
                 <span className="font-medium">${results.adsCost.toFixed(2)}</span>
                 {formulaOpen['adsCost'] && <div className="absolute right-0 top-6 z-10 bg-white border border-gray-200 rounded-md shadow px-2 py-1 text-xs text-gray-700">公式: {formulaText('adsCost')}</div>}
               </div>
               <div className="flex justify-between"><span>促销费用:</span> <span className="font-medium">${results.promotionCost?.toFixed(2) || '0.00'}</span></div>
               
               <div className="border-t border-green-200 pt-2">
                 <div className="flex items-center justify-between relative">
                   <span className="flex items-center gap-2">
                     <span>总运营成本:</span>
                     <button onClick={()=>toggleFormula('operatingCostTotal')} className="w-5 h-5 rounded-full bg-gray-200 text-gray-700 hover:bg-gray-300 text-xs">?</button>
                   </span>
                   <span className="font-medium">${results.operatingCostTotal?.toFixed(2) || '0.00'}</span>
                   <button onClick={()=>setShowOpCost(!showOpCost)} className="ml-2 text-xs text-orange-600 hover:text-orange-700 flex items-center gap-1">{showOpCost ? '收起' : '详情'} {showOpCost ? <ChevronUp className="w-3 h-3"/> : <ChevronDown className="w-3 h-3"/>}</button>
                   {formulaOpen['operatingCostTotal'] && <div className="absolute right-0 top-6 z-10 bg-white border border-gray-200 rounded-md shadow px-2 py-1 text-xs text-gray-700">公式: {formulaText('operatingCostTotal')}</div>}
                 </div>
                 {showOpCost && (
                   <div className="mt-2 space-y-1 text-xs text-gray-600">
                     <div className="flex justify-between"><span>广告</span><span>${results.adsCost.toFixed(2)}</span></div>
                     <div className="flex justify-between"><span>促销</span><span>${results.promotionCost?.toFixed(2) || '0.00'}</span></div>
                     <div className="flex justify-between"><span>仓储</span><span>${parseFloat(inputs.storageFee||0).toFixed(2)}</span></div>
                    <div className="flex justify-between items-center relative">
                      <span className="flex items-center gap-2">
                        <span>退货损失</span>
                        <button onClick={()=>toggleFormula('returnLoss')} className="w-5 h-5 rounded-full bg-gray-200 text-gray-700 hover:bg-gray-300 text-xs">?</button>
                      </span>
                      <span>${results.returnLoss.toFixed(2)}</span>
                      {formulaOpen['returnLoss'] && <div className="absolute right-0 top-6 z-10 bg-white border border-gray-200 rounded-md shadow px-2 py-1 text-xs text-gray-700">公式: {formulaText('returnLoss')}</div>}
                    </div>
                     <div className="pl-2">不可售损失: ${results.returnLossUnsellable?.toFixed(2) || '0.00'}</div>
                     <div className="pl-2">退款管理费损失: ${results.returnLossAdmin?.toFixed(2) || '0.00'} (单位: ${results.refundAdminFeeUnit?.toFixed(2) || '0.00'})</div>
                     <div className="flex justify-between"><span>其他</span><span>${parseFloat(inputs.otherFee||0).toFixed(2)}</span></div>
                   </div>
                 )}
               </div>
               <div className="border-t border-green-200 pt-2 mt-2 space-y-1">
                 <div className="flex justify-between items-center relative">
                   <span className="flex items-center gap-2"><span>毛利润:</span><button onClick={()=>toggleFormula('grossProfit')} className="w-5 h-5 rounded-full bg-gray-200 text-gray-700 hover:bg-gray-300 text-xs">?</button></span>
                   <span className="font-medium">${results.grossProfit.toFixed(2)}</span>
                   {formulaOpen['grossProfit'] && <div className="absolute right-0 top-6 z-10 bg-white border border-gray-200 rounded-md shadow px-2 py-1 text-xs text-gray-700">公式: {formulaText('grossProfit')}</div>}
                 </div>
                 <div className="flex justify-between items-center relative text-lg font-bold">
                   <span className="flex items-center gap-2"><span>净利润:</span><button onClick={()=>toggleFormula('netProfit')} className="w-5 h-5 rounded-full bg-gray-200 text-gray-700 hover:bg-gray-300 text-xs">?</button></span>
                   <span className={results.netProfit >= 0 ? "text-green-700" : "text-red-600"}>${results.netProfit.toFixed(2)} {results.margin > 0.2 ? '😊' : (results.margin > 0.05 ? '😐' : '😩')}</span>
                   {formulaOpen['netProfit'] && <div className="absolute right-0 top-6 z-10 bg-white border border-gray-200 rounded-md shadow px-2 py-1 text-xs text-gray-700">公式: {formulaText('netProfit')}</div>}
                 </div>
                 <div className="flex justify-between items-center relative text-xs text-gray-500"><span className="flex items-center gap-2"><span>盈亏平衡ACoS:</span><button onClick={()=>toggleFormula('breakEvenACoS')} className="w-5 h-5 rounded-full bg-gray-200 text-gray-700 hover:bg-gray-300 text-xs">?</button></span> <span>{(results.breakEvenACoS * 100).toFixed(2)}%</span>{formulaOpen['breakEvenACoS'] && <div className="absolute right-0 top-6 z-10 bg-white border border-gray-200 rounded-md shadow px-2 py-1 text-xs text-gray-700">公式: {formulaText('breakEvenACoS')}</div>}</div>
                 <div className="flex justify-between text-xs text-gray-500"><span>净利率:</span> <span>{(results.margin * 100).toFixed(2)}%</span></div>
                 <div className="text-center text-gray-600">
                   人民币净利润: <span className="font-bold">¥{results.netProfitCNY.toFixed(2)}</span>
                 </div>
               </div>
               
               <div className="mt-2 bg-blue-50 border border-blue-100 p-3 rounded">
                  <div className="font-bold text-blue-800 text-xs mb-2">📋 整批利润分析 (Batch Analysis)</div>
                  <div className="flex justify-between text-sm"><span>总资金投入:</span><span>¥{results.batchInvestment.toFixed(2)}</span></div>
                  <div className="flex justify-between text-sm"><span>预计总净利:</span><span className={results.batchNetProfit >= 0 ? 'text-green-700 font-medium' : 'text-red-600 font-medium'}>¥{results.batchNetProfit.toFixed(2)}</span></div>
                  <div className="flex justify-between text-sm"><span>最后回款:</span><span>${results.batchPayout.toFixed(2)}</span></div>
                  <div className="flex justify-between text-sm"><span>投资回报率:</span><span className={results.batchROI >= 0 ? 'text-green-700 font-medium' : 'text-red-600 font-medium'}>{(results.batchROI * 100).toFixed(2)}%</span></div>
               </div>
            </div>
            
            <div className="flex gap-2">
                <Button className="flex-1" variant="secondary" onClick={copyResult}><Copy className="w-4 h-4"/> 复制结果</Button>
                <Button className="flex-1" onClick={saveToHistory}><Save className="w-4 h-4"/> 保存记录</Button>
            </div>
          </div>
        </Card>
      </div>

      {/* History Section */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
        <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-gray-700 flex items-center gap-2">📜 历史记录 <span className="text-xs font-normal text-gray-400">(保存在本地)</span></h3>
            <Button variant="outline" size="sm" onClick={clearHistory} className="text-xs h-8"><Trash2 className="w-3 h-3"/> 清空</Button>
        </div>
        <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
                <thead className="text-xs text-gray-500 uppercase bg-gray-50">
                    <tr>
                        <th className="px-4 py-3">时间</th>
                        <th className="px-4 py-3">名称</th>
                        <th className="px-4 py-3">售价</th>
                        <th className="px-4 py-3">净利</th>
                        <th className="px-4 py-3">利润率</th>
                        <th className="px-4 py-3">操作</th>
                    </tr>
                </thead>
                <tbody>
                    {history.length === 0 ? (
                        <tr><td colSpan={6} className="px-4 py-4 text-center text-gray-400">暂无记录</td></tr>
                    ) : (
                        history.map((item: any) => (
                            <tr key={item.id} className="border-b border-gray-100 hover:bg-gray-50">
                                <td className="px-4 py-3">{item.time.split(' ')[0]}</td>
                                <td className="px-4 py-3 max-w-[150px] truncate" title={item.name}>{item.name}</td>
                                <td className="px-4 py-3">${item.price}</td>
                                <td className={`px-4 py-3 font-medium ${parseFloat(item.netProfit) >= 0 ? 'text-green-600' : 'text-red-600'}`}>{item.netProfit}</td>
                                <td className="px-4 py-3">{item.margin}</td>
                                <td className="px-4 py-3 flex gap-2">
                                    <button onClick={() => loadFromHistory(item)} className="text-blue-600 hover:text-blue-800 text-xs">加载</button>
                                    <button onClick={() => deleteHistoryItem(item.id)} className="text-red-500 hover:text-red-700 text-xs">删除</button>
                                </td>
                            </tr>
                        ))
                    )}
                </tbody>
            </table>
        </div>
      </div>

      {/* Reference Tables */}
      <div className="space-y-4">
        <Collapsible title="亚马逊美国站配送费用与尺寸分段规则">
          <SizeClassificationTable />
        </Collapsible>

        <Collapsible title="销售佣金费率表">
          <ReferralFeeTable />
        </Collapsible>

        <Collapsible title="配送费用分段">
          <FeeTable initialSeason={inputs.season} initialVersion={inputs.version} />
        </Collapsible>
      </div>
    </div>
  );
}
