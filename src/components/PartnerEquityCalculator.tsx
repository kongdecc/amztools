'use client'

import React, { useState, useEffect } from 'react';
import { Users, Download, Printer } from 'lucide-react';
import * as XLSX from 'xlsx';

const Card = ({ children, className = "", ...props }: any) => (
  <div className={`bg-white rounded-xl border border-gray-100 shadow-sm ${className}`} {...props}>{children}</div>
);

const Input = ({ className = "", error = false, ...props }: any) => (
  <input 
    className={`flex h-10 w-full rounded-md border ${error ? 'border-red-500 bg-red-50' : 'border-gray-300 bg-white'} px-3 py-2 text-sm shadow-sm transition-all focus:border-blue-500 focus:ring-2 focus:ring-blue-200 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50 disabled:bg-gray-100 disabled:text-gray-500 ${className}`} 
    {...props} 
  />
);

const Button = ({ children, className = "", variant = "primary", ...props }: any) => {
  const baseClass = "px-6 py-2.5 rounded-full text-sm font-semibold flex items-center justify-center gap-2 transition-all transform active:scale-95 shadow-sm";
  const variants: any = {
    primary: "bg-gradient-to-r from-blue-600 to-blue-500 text-white hover:from-blue-700 hover:to-blue-600 shadow-blue-200",
    success: "bg-emerald-600 text-white hover:bg-emerald-700 shadow-emerald-200",
    secondary: "bg-gray-100 text-gray-700 hover:bg-gray-200",
    outline: "border border-gray-300 text-gray-700 hover:bg-gray-50"
  };
  return <button className={`${baseClass} ${variants[variant]} ${className}`} {...props}>{children}</button>;
};

const TabButton = ({ active, onClick, children }: any) => (
  <button
    onClick={onClick}
    className={`px-6 py-3 font-medium text-sm transition-colors border-b-2 ${
      active
        ? 'border-blue-500 text-blue-600'
        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
    }`}
  >
    {children}
  </button>
);

// 2 Partner Calculator Logic
const Calculator2Partners = () => {
  const [totalInv, setTotalInv] = useState<number>(200000);
  const [fundRatio, setFundRatio] = useState<number>(50);
  const [invA, setInvA] = useState<number>(100000);
  const [laborA, setLaborA] = useState<number>(80);
  const [roleA, setRoleA] = useState<string>("供应链、运营、广告等核心工作");
  const [roleB, setRoleB] = useState<string>("客服、发货等协助工作");

  // Derived values
  const laborRatio = Math.max(0, 100 - fundRatio);
  const invB = Math.max(0, totalInv - invA);
  const laborB = Math.max(0, 100 - laborA);

  const totalFund = invA + invB;
  const fundShareA = totalFund > 0 ? (invA / totalFund * 100) : 0;
  const fundShareB = totalFund > 0 ? (invB / totalFund * 100) : 0;

  const fundEquityA = (fundShareA / 100) * fundRatio;
  const fundEquityB = (fundShareB / 100) * fundRatio;

  const laborEquityA = (laborA / 100) * laborRatio;
  const laborEquityB = (laborB / 100) * laborRatio;

  const totalEquityA = fundEquityA + laborEquityA;
  const totalEquityB = fundEquityB + laborEquityB;

  const valueA = totalInv * (totalEquityA / 100);
  const valueB = totalInv * (totalEquityB / 100);

  // Warnings
  const invWarning = invA > totalInv;
  const laborWarning = laborA > 100;

  const handleDownload = () => {
    if (invWarning) {
      alert('错误：合伙人A出资金额不能超过总投资金额，请先修正后再下载！');
      return;
    }
    if (laborWarning) {
      alert('错误：合伙人A人力股占比不能超过100%，请先修正后再下载！');
      return;
    }

    const data = [
      ['合伙人股权分配计算表 (2人)'],
      ['作者公众号：必胜哥的三板斧'],
      [''],
      ['基础信息'],
      ['总投资金额', totalInv, '元'],
      [''],
      ['股权结构分配'],
      ['股权类型', '占总股权比例', '说明'],
      ['资金股', fundRatio + '%', '按出资比例分配的股权'],
      ['人力股', laborRatio + '%', '按工作投入分配的股权'],
      [''],
      ['资金股分配 (占总股权' + fundRatio + '%)'],
      ['合伙人', '出资金额(元)', '资金股占比', '对应总股权比例'],
      ['合伙人 A', invA, fundShareA.toFixed(1) + '%', fundEquityA.toFixed(1) + '%'],
      ['合伙人 B (自动计算)', invB, fundShareB.toFixed(1) + '%', fundEquityB.toFixed(1) + '%'],
      [''],
      ['人力股分配 (占总股权' + laborRatio + '%)'],
      ['合伙人', '人力股占比', '对应总股权比例', '主要职责'],
      ['合伙人 A', laborA + '%', laborEquityA.toFixed(1) + '%', roleA],
      ['合伙人 B (自动计算)', laborB + '%', laborEquityB.toFixed(1) + '%', roleB],
      [''],
      ['最终股权分配结果'],
      ['合伙人', '资金股权', '人力股权', '总股权比例', '股权价值(元)'],
      ['合伙人 A', fundEquityA.toFixed(1) + '%', laborEquityA.toFixed(1) + '%', totalEquityA.toFixed(1) + '%', valueA],
      ['合伙人 B', fundEquityB.toFixed(1) + '%', laborEquityB.toFixed(1) + '%', totalEquityB.toFixed(1) + '%', valueB]
    ];

    const ws = XLSX.utils.aoa_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "股权分配");
    
    // Set column widths
    ws['!cols'] = [{wch: 20}, {wch: 15}, {wch: 15}, {wch: 15}, {wch: 20}];
    
    XLSX.writeFile(wb, '合伙人股权分配计算表_2人.xlsx');
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="grid grid-cols-1 gap-6">
        {/* Basic Info */}
        <section className="bg-gray-50 p-6 rounded-lg border border-gray-200">
          <h3 className="text-lg font-bold text-gray-800 border-b-2 border-blue-500 pb-2 mb-4">💰 基础投资信息</h3>
          <table className="w-full bg-white border-collapse border border-gray-200 text-sm">
            <thead>
              <tr className="bg-blue-500 text-white">
                <th className="p-3 border border-blue-600">项目</th>
                <th className="p-3 border border-blue-600 w-1/3">金额/比例</th>
                <th className="p-3 border border-blue-600">说明</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="p-3 border border-gray-200 text-center">总投资金额</td>
                <td className="p-3 border border-gray-200">
                  <div className="flex items-center gap-2">
                    <Input 
                      type="number" 
                      value={totalInv} 
                      onChange={(e: any) => setTotalInv(parseFloat(e.target.value) || 0)}
                    />
                    <span>元</span>
                  </div>
                </td>
                <td className="p-3 border border-gray-200 text-center text-gray-500">项目启动所需的总资金</td>
              </tr>
            </tbody>
          </table>
        </section>

        {/* Equity Structure */}
        <section className="bg-gray-50 p-6 rounded-lg border border-gray-200">
          <h3 className="text-lg font-bold text-gray-800 border-b-2 border-blue-500 pb-2 mb-4">⚖️ 股权结构分配</h3>
          <table className="w-full bg-white border-collapse border border-gray-200 text-sm">
            <thead>
              <tr className="bg-blue-500 text-white">
                <th className="p-3 border border-blue-600">股权类型</th>
                <th className="p-3 border border-blue-600 w-1/3">占总股权比例</th>
                <th className="p-3 border border-blue-600">说明</th>
              </tr>
            </thead>
            <tbody>
              <tr className="bg-yellow-50 font-bold">
                <td className="p-3 border border-gray-200 text-center">资金股</td>
                <td className="p-3 border border-gray-200">
                  <div className="flex items-center gap-2">
                    <Input 
                      type="number" 
                      value={fundRatio} 
                      min="0" max="100"
                      onChange={(e: any) => setFundRatio(parseFloat(e.target.value) || 0)}
                    />
                    <span>%</span>
                  </div>
                </td>
                <td className="p-3 border border-gray-200 text-center text-gray-500 font-normal">按出资比例分配的股权</td>
              </tr>
              <tr className="bg-yellow-50 font-bold">
                <td className="p-3 border border-gray-200 text-center">人力股</td>
                <td className="p-3 border border-gray-200 text-center">{laborRatio}%</td>
                <td className="p-3 border border-gray-200 text-center text-gray-500 font-normal">按工作投入分配的股权</td>
              </tr>
            </tbody>
          </table>
        </section>

        {/* Fund Share */}
        <section className="bg-gray-50 p-6 rounded-lg border border-gray-200">
          <h3 className="text-lg font-bold text-gray-800 border-b-2 border-blue-500 pb-2 mb-4">
            💸 资金股分配 (占总股权 {fundRatio}%)
          </h3>
          <table className="w-full bg-white border-collapse border border-gray-200 text-sm">
            <thead>
              <tr className="bg-blue-500 text-white">
                <th className="p-3 border border-blue-600">合伙人</th>
                <th className="p-3 border border-blue-600 w-1/3">出资金额 (元)</th>
                <th className="p-3 border border-blue-600">资金股占比</th>
                <th className="p-3 border border-blue-600">对应总股权比例</th>
              </tr>
            </thead>
            <tbody>
              <tr className="bg-blue-50">
                <td className="p-3 border border-gray-200 text-center">合伙人 A</td>
                <td className="p-3 border border-gray-200">
                  <Input 
                    type="number" 
                    value={invA} 
                    error={invWarning}
                    onChange={(e: any) => setInvA(parseFloat(e.target.value) || 0)}
                  />
                  {invWarning && (
                    <div className="text-red-600 text-xs mt-1 font-bold">⚠️ 出资金额不能超过总投资金额</div>
                  )}
                </td>
                <td className="p-3 border border-gray-200 text-center">{fundShareA.toFixed(1)}%</td>
                <td className="p-3 border border-gray-200 text-center">{fundEquityA.toFixed(1)}%</td>
              </tr>
              <tr className="bg-orange-50">
                <td className="p-3 border border-gray-200 text-center">合伙人 B</td>
                <td className="p-3 border border-gray-200">
                  <Input type="number" value={invB} disabled />
                  <div className="text-orange-600 text-xs mt-1 font-bold">💡 自动计算 = 总投资 - 合伙人A出资</div>
                </td>
                <td className="p-3 border border-gray-200 text-center">{fundShareB.toFixed(1)}%</td>
                <td className="p-3 border border-gray-200 text-center">{fundEquityB.toFixed(1)}%</td>
              </tr>
            </tbody>
          </table>
        </section>

        {/* Labor Share */}
        <section className="bg-gray-50 p-6 rounded-lg border border-gray-200">
          <h3 className="text-lg font-bold text-gray-800 border-b-2 border-blue-500 pb-2 mb-4">
            👥 人力股分配 (占总股权 {laborRatio}%)
          </h3>
          <table className="w-full bg-white border-collapse border border-gray-200 text-sm">
            <thead>
              <tr className="bg-blue-500 text-white">
                <th className="p-3 border border-blue-600">合伙人</th>
                <th className="p-3 border border-blue-600 w-1/4">人力股占比</th>
                <th className="p-3 border border-blue-600">对应总股权比例</th>
                <th className="p-3 border border-blue-600 w-1/3">主要职责</th>
              </tr>
            </thead>
            <tbody>
              <tr className="bg-blue-50">
                <td className="p-3 border border-gray-200 text-center">合伙人 A</td>
                <td className="p-3 border border-gray-200">
                  <div className="flex items-center gap-2">
                    <Input 
                      type="number" 
                      value={laborA} 
                      min="0" max="100"
                      error={laborWarning}
                      onChange={(e: any) => setLaborA(parseFloat(e.target.value) || 0)}
                    />
                    <span>%</span>
                  </div>
                  {laborWarning && (
                    <div className="text-red-600 text-xs mt-1 font-bold">⚠️ 人力股占比不能超过100%</div>
                  )}
                </td>
                <td className="p-3 border border-gray-200 text-center">{laborEquityA.toFixed(1)}%</td>
                <td className="p-3 border border-gray-200">
                  <Input type="text" value={roleA} onChange={(e: any) => setRoleA(e.target.value)} />
                </td>
              </tr>
              <tr className="bg-orange-50">
                <td className="p-3 border border-gray-200 text-center">合伙人 B</td>
                <td className="p-3 border border-gray-200">
                  <div className="flex items-center gap-2">
                    <Input type="number" value={laborB} disabled />
                    <span>%</span>
                  </div>
                  <div className="text-orange-600 text-xs mt-1 font-bold">💡 自动计算 = 100% - 合伙人A人力股占比</div>
                </td>
                <td className="p-3 border border-gray-200 text-center">{laborEquityB.toFixed(1)}%</td>
                <td className="p-3 border border-gray-200">
                  <Input type="text" value={roleB} onChange={(e: any) => setRoleB(e.target.value)} />
                </td>
              </tr>
            </tbody>
          </table>
        </section>

        {/* Result */}
        <section className="bg-gray-50 p-6 rounded-lg border border-gray-200">
          <h3 className="text-lg font-bold text-gray-800 border-b-2 border-blue-500 pb-2 mb-4">📈 最终股权分配结果</h3>
          <table className="w-full bg-white border-collapse border border-gray-200 text-sm">
            <thead>
              <tr className="bg-blue-500 text-white">
                <th className="p-3 border border-blue-600">合伙人</th>
                <th className="p-3 border border-blue-600">资金股权</th>
                <th className="p-3 border border-blue-600">人力股权</th>
                <th className="p-3 border border-blue-600">总股权比例</th>
                <th className="p-3 border border-blue-600">股权价值 (元)</th>
              </tr>
            </thead>
            <tbody>
              <tr className="bg-green-50 font-bold">
                <td className="p-3 border border-gray-200 text-center">合伙人 A</td>
                <td className="p-3 border border-gray-200 text-center">{fundEquityA.toFixed(1)}%</td>
                <td className="p-3 border border-gray-200 text-center">{laborEquityA.toFixed(1)}%</td>
                <td className="p-3 border border-gray-200 text-center text-blue-600">{totalEquityA.toFixed(1)}%</td>
                <td className="p-3 border border-gray-200 text-center text-green-700">{valueA.toLocaleString('zh-CN')}</td>
              </tr>
              <tr className="bg-green-50 font-bold">
                <td className="p-3 border border-gray-200 text-center">合伙人 B</td>
                <td className="p-3 border border-gray-200 text-center">{fundEquityB.toFixed(1)}%</td>
                <td className="p-3 border border-gray-200 text-center">{laborEquityB.toFixed(1)}%</td>
                <td className="p-3 border border-gray-200 text-center text-blue-600">{totalEquityB.toFixed(1)}%</td>
                <td className="p-3 border border-gray-200 text-center text-green-700">{valueB.toLocaleString('zh-CN')}</td>
              </tr>
            </tbody>
          </table>
        </section>

        <div className="flex justify-center gap-4 mt-8 print:hidden">
          <Button variant="success" onClick={handleDownload}>
            <Download className="w-4 h-4" />
            下载 Excel 表格
          </Button>
          <Button variant="primary" onClick={() => window.print()}>
            <Printer className="w-4 h-4" />
            打印报告
          </Button>
        </div>
      </div>
    </div>
  );
};

// 3 Partner Calculator Logic
const Calculator3Partners = () => {
  const [totalInv, setTotalInv] = useState<number>(300000);
  const [fundRatio, setFundRatio] = useState<number>(50);
  const [invA, setInvA] = useState<number>(120000);
  const [invB, setInvB] = useState<number>(120000);
  const [laborA, setLaborA] = useState<number>(50);
  const [laborB, setLaborB] = useState<number>(30);
  const [roleA, setRoleA] = useState<string>("CEO、战略规划、核心运营");
  const [roleB, setRoleB] = useState<string>("技术总监、产品开发");
  const [roleC, setRoleC] = useState<string>("销售总监、市场拓展");

  // Derived values
  const laborRatio = Math.max(0, 100 - fundRatio);
  const invC = Math.max(0, totalInv - invA - invB);
  const laborC = Math.max(0, 100 - laborA - laborB);

  const totalFund = invA + invB + invC;
  const fundShareA = totalFund > 0 ? (invA / totalFund * 100) : 0;
  const fundShareB = totalFund > 0 ? (invB / totalFund * 100) : 0;
  const fundShareC = totalFund > 0 ? (invC / totalFund * 100) : 0;

  const fundEquityA = (fundShareA / 100) * fundRatio;
  const fundEquityB = (fundShareB / 100) * fundRatio;
  const fundEquityC = (fundShareC / 100) * fundRatio;

  const laborEquityA = (laborA / 100) * laborRatio;
  const laborEquityB = (laborB / 100) * laborRatio;
  const laborEquityC = (laborC / 100) * laborRatio;

  const totalEquityA = fundEquityA + laborEquityA;
  const totalEquityB = fundEquityB + laborEquityB;
  const totalEquityC = fundEquityC + laborEquityC;

  const valueA = totalInv * (totalEquityA / 100);
  const valueB = totalInv * (totalEquityB / 100);
  const valueC = totalInv * (totalEquityC / 100);

  // Warnings
  const invAWarning = invA > totalInv;
  const invBWarning = invB > totalInv;
  const invTotalWarning = (invA + invB) > totalInv;
  const laborTotalWarning = (laborA + laborB) > 100;

  const handleDownload = () => {
    if (invAWarning || invBWarning || invTotalWarning) {
      alert('错误：合伙人出资金额配置有误，请先修正后再下载！');
      return;
    }
    if (laborTotalWarning) {
      alert('错误：合伙人A、B人力股占比总和不能超过100%，请先修正后再下载！');
      return;
    }

    const data = [
      ['合伙人股权分配计算表 (3人)'],
      ['作者公众号：必胜哥的三板斧'],
      [''],
      ['基础信息'],
      ['总投资金额', totalInv, '元'],
      [''],
      ['股权结构分配'],
      ['股权类型', '占总股权比例', '说明'],
      ['资金股', fundRatio + '%', '按出资比例分配的股权'],
      ['人力股', laborRatio + '%', '按工作投入分配的股权'],
      [''],
      ['资金股分配 (占总股权' + fundRatio + '%)'],
      ['合伙人', '出资金额(元)', '资金股占比', '对应总股权比例'],
      ['合伙人 A', invA, fundShareA.toFixed(1) + '%', fundEquityA.toFixed(1) + '%'],
      ['合伙人 B', invB, fundShareB.toFixed(1) + '%', fundEquityB.toFixed(1) + '%'],
      ['合伙人 C (自动计算)', invC, fundShareC.toFixed(1) + '%', fundEquityC.toFixed(1) + '%'],
      [''],
      ['人力股分配 (占总股权' + laborRatio + '%)'],
      ['合伙人', '人力股占比', '对应总股权比例', '主要职责'],
      ['合伙人 A', laborA + '%', laborEquityA.toFixed(1) + '%', roleA],
      ['合伙人 B', laborB + '%', laborEquityB.toFixed(1) + '%', roleB],
      ['合伙人 C (自动计算)', laborC + '%', laborEquityC.toFixed(1) + '%', roleC],
      [''],
      ['最终股权分配结果'],
      ['合伙人', '资金股权', '人力股权', '总股权比例', '股权价值(元)'],
      ['合伙人 A', fundEquityA.toFixed(1) + '%', laborEquityA.toFixed(1) + '%', totalEquityA.toFixed(1) + '%', valueA],
      ['合伙人 B', fundEquityB.toFixed(1) + '%', laborEquityB.toFixed(1) + '%', totalEquityB.toFixed(1) + '%', valueB],
      ['合伙人 C', fundEquityC.toFixed(1) + '%', laborEquityC.toFixed(1) + '%', totalEquityC.toFixed(1) + '%', valueC]
    ];

    const ws = XLSX.utils.aoa_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "股权分配");
    
    // Set column widths
    ws['!cols'] = [{wch: 20}, {wch: 15}, {wch: 15}, {wch: 15}, {wch: 20}];
    
    XLSX.writeFile(wb, '合伙人股权分配计算表_3人.xlsx');
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="grid grid-cols-1 gap-6">
        {/* Basic Info */}
        <section className="bg-gray-50 p-6 rounded-lg border border-gray-200">
          <h3 className="text-lg font-bold text-gray-800 border-b-2 border-blue-500 pb-2 mb-4">💰 基础投资信息</h3>
          <table className="w-full bg-white border-collapse border border-gray-200 text-sm">
            <thead>
              <tr className="bg-blue-500 text-white">
                <th className="p-3 border border-blue-600">项目</th>
                <th className="p-3 border border-blue-600 w-1/3">金额/比例</th>
                <th className="p-3 border border-blue-600">说明</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="p-3 border border-gray-200 text-center">总投资金额</td>
                <td className="p-3 border border-gray-200">
                  <div className="flex items-center gap-2">
                    <Input 
                      type="number" 
                      value={totalInv} 
                      onChange={(e: any) => setTotalInv(parseFloat(e.target.value) || 0)}
                    />
                    <span>元</span>
                  </div>
                </td>
                <td className="p-3 border border-gray-200 text-center text-gray-500">项目启动所需的总资金</td>
              </tr>
            </tbody>
          </table>
        </section>

        {/* Equity Structure */}
        <section className="bg-gray-50 p-6 rounded-lg border border-gray-200">
          <h3 className="text-lg font-bold text-gray-800 border-b-2 border-blue-500 pb-2 mb-4">⚖️ 股权结构分配</h3>
          <table className="w-full bg-white border-collapse border border-gray-200 text-sm">
            <thead>
              <tr className="bg-blue-500 text-white">
                <th className="p-3 border border-blue-600">股权类型</th>
                <th className="p-3 border border-blue-600 w-1/3">占总股权比例</th>
                <th className="p-3 border border-blue-600">说明</th>
              </tr>
            </thead>
            <tbody>
              <tr className="bg-yellow-50 font-bold">
                <td className="p-3 border border-gray-200 text-center">资金股</td>
                <td className="p-3 border border-gray-200">
                  <div className="flex items-center gap-2">
                    <Input 
                      type="number" 
                      value={fundRatio} 
                      min="0" max="100"
                      onChange={(e: any) => setFundRatio(parseFloat(e.target.value) || 0)}
                    />
                    <span>%</span>
                  </div>
                </td>
                <td className="p-3 border border-gray-200 text-center text-gray-500 font-normal">按出资比例分配的股权</td>
              </tr>
              <tr className="bg-yellow-50 font-bold">
                <td className="p-3 border border-gray-200 text-center">人力股</td>
                <td className="p-3 border border-gray-200 text-center">{laborRatio}%</td>
                <td className="p-3 border border-gray-200 text-center text-gray-500 font-normal">按工作投入分配的股权</td>
              </tr>
            </tbody>
          </table>
        </section>

        {/* Fund Share */}
        <section className="bg-gray-50 p-6 rounded-lg border border-gray-200">
          <h3 className="text-lg font-bold text-gray-800 border-b-2 border-blue-500 pb-2 mb-4">
            💸 资金股分配 (占总股权 {fundRatio}%)
          </h3>
          <table className="w-full bg-white border-collapse border border-gray-200 text-sm">
            <thead>
              <tr className="bg-blue-500 text-white">
                <th className="p-3 border border-blue-600">合伙人</th>
                <th className="p-3 border border-blue-600 w-1/3">出资金额 (元)</th>
                <th className="p-3 border border-blue-600">资金股占比</th>
                <th className="p-3 border border-blue-600">对应总股权比例</th>
              </tr>
            </thead>
            <tbody>
              <tr className="bg-blue-50">
                <td className="p-3 border border-gray-200 text-center">合伙人 A</td>
                <td className="p-3 border border-gray-200">
                  <Input 
                    type="number" 
                    value={invA} 
                    error={invAWarning || invTotalWarning}
                    onChange={(e: any) => setInvA(parseFloat(e.target.value) || 0)}
                  />
                  {invAWarning && (
                    <div className="text-red-600 text-xs mt-1 font-bold">⚠️ 出资金额不能超过总投资金额</div>
                  )}
                </td>
                <td className="p-3 border border-gray-200 text-center">{fundShareA.toFixed(1)}%</td>
                <td className="p-3 border border-gray-200 text-center">{fundEquityA.toFixed(1)}%</td>
              </tr>
              <tr className="bg-orange-50">
                <td className="p-3 border border-gray-200 text-center">合伙人 B</td>
                <td className="p-3 border border-gray-200">
                  <Input 
                    type="number" 
                    value={invB} 
                    error={invBWarning || invTotalWarning}
                    onChange={(e: any) => setInvB(parseFloat(e.target.value) || 0)}
                  />
                  {invBWarning && (
                    <div className="text-red-600 text-xs mt-1 font-bold">⚠️ 出资金额不能超过总投资金额</div>
                  )}
                </td>
                <td className="p-3 border border-gray-200 text-center">{fundShareB.toFixed(1)}%</td>
                <td className="p-3 border border-gray-200 text-center">{fundEquityB.toFixed(1)}%</td>
              </tr>
              <tr className="bg-purple-50">
                <td className="p-3 border border-gray-200 text-center">合伙人 C</td>
                <td className="p-3 border border-gray-200">
                  <Input type="number" value={invC} disabled />
                  <div className="text-purple-600 text-xs mt-1 font-bold">💡 自动计算 = 总投资 - A出资 - B出资</div>
                  {invTotalWarning && (
                     <div className="text-red-600 text-xs mt-1 font-bold">⚠️ A+B出资总和超过总投资</div>
                  )}
                </td>
                <td className="p-3 border border-gray-200 text-center">{fundShareC.toFixed(1)}%</td>
                <td className="p-3 border border-gray-200 text-center">{fundEquityC.toFixed(1)}%</td>
              </tr>
            </tbody>
          </table>
        </section>

        {/* Labor Share */}
        <section className="bg-gray-50 p-6 rounded-lg border border-gray-200">
          <h3 className="text-lg font-bold text-gray-800 border-b-2 border-blue-500 pb-2 mb-4">
            👥 人力股分配 (占总股权 {laborRatio}%)
          </h3>
          <table className="w-full bg-white border-collapse border border-gray-200 text-sm">
            <thead>
              <tr className="bg-blue-500 text-white">
                <th className="p-3 border border-blue-600">合伙人</th>
                <th className="p-3 border border-blue-600 w-1/4">人力股占比</th>
                <th className="p-3 border border-blue-600">对应总股权比例</th>
                <th className="p-3 border border-blue-600 w-1/3">主要职责</th>
              </tr>
            </thead>
            <tbody>
              <tr className="bg-blue-50">
                <td className="p-3 border border-gray-200 text-center">合伙人 A</td>
                <td className="p-3 border border-gray-200">
                  <div className="flex items-center gap-2">
                    <Input 
                      type="number" 
                      value={laborA} 
                      min="0" max="100"
                      error={laborTotalWarning}
                      onChange={(e: any) => setLaborA(parseFloat(e.target.value) || 0)}
                    />
                    <span>%</span>
                  </div>
                  {laborTotalWarning && (
                    <div className="text-red-600 text-xs mt-1 font-bold">⚠️ 人力股占比总和超过100%</div>
                  )}
                </td>
                <td className="p-3 border border-gray-200 text-center">{laborEquityA.toFixed(1)}%</td>
                <td className="p-3 border border-gray-200">
                  <Input type="text" value={roleA} onChange={(e: any) => setRoleA(e.target.value)} />
                </td>
              </tr>
              <tr className="bg-orange-50">
                <td className="p-3 border border-gray-200 text-center">合伙人 B</td>
                <td className="p-3 border border-gray-200">
                  <div className="flex items-center gap-2">
                    <Input 
                      type="number" 
                      value={laborB} 
                      min="0" max="100"
                      error={laborTotalWarning}
                      onChange={(e: any) => setLaborB(parseFloat(e.target.value) || 0)}
                    />
                    <span>%</span>
                  </div>
                </td>
                <td className="p-3 border border-gray-200 text-center">{laborEquityB.toFixed(1)}%</td>
                <td className="p-3 border border-gray-200">
                  <Input type="text" value={roleB} onChange={(e: any) => setRoleB(e.target.value)} />
                </td>
              </tr>
              <tr className="bg-purple-50">
                <td className="p-3 border border-gray-200 text-center">合伙人 C</td>
                <td className="p-3 border border-gray-200">
                  <div className="flex items-center gap-2">
                    <Input type="number" value={laborC} disabled />
                    <span>%</span>
                  </div>
                  <div className="text-purple-600 text-xs mt-1 font-bold">💡 自动计算 = 100% - A - B</div>
                </td>
                <td className="p-3 border border-gray-200 text-center">{laborEquityC.toFixed(1)}%</td>
                <td className="p-3 border border-gray-200">
                  <Input type="text" value={roleC} onChange={(e: any) => setRoleC(e.target.value)} />
                </td>
              </tr>
            </tbody>
          </table>
        </section>

        {/* Result */}
        <section className="bg-gray-50 p-6 rounded-lg border border-gray-200">
          <h3 className="text-lg font-bold text-gray-800 border-b-2 border-blue-500 pb-2 mb-4">📈 最终股权分配结果</h3>
          <table className="w-full bg-white border-collapse border border-gray-200 text-sm">
            <thead>
              <tr className="bg-blue-500 text-white">
                <th className="p-3 border border-blue-600">合伙人</th>
                <th className="p-3 border border-blue-600">资金股权</th>
                <th className="p-3 border border-blue-600">人力股权</th>
                <th className="p-3 border border-blue-600">总股权比例</th>
                <th className="p-3 border border-blue-600">股权价值 (元)</th>
              </tr>
            </thead>
            <tbody>
              <tr className="bg-green-50 font-bold">
                <td className="p-3 border border-gray-200 text-center">合伙人 A</td>
                <td className="p-3 border border-gray-200 text-center">{fundEquityA.toFixed(1)}%</td>
                <td className="p-3 border border-gray-200 text-center">{laborEquityA.toFixed(1)}%</td>
                <td className="p-3 border border-gray-200 text-center text-blue-600">{totalEquityA.toFixed(1)}%</td>
                <td className="p-3 border border-gray-200 text-center text-green-700">{valueA.toLocaleString('zh-CN')}</td>
              </tr>
              <tr className="bg-green-50 font-bold">
                <td className="p-3 border border-gray-200 text-center">合伙人 B</td>
                <td className="p-3 border border-gray-200 text-center">{fundEquityB.toFixed(1)}%</td>
                <td className="p-3 border border-gray-200 text-center">{laborEquityB.toFixed(1)}%</td>
                <td className="p-3 border border-gray-200 text-center text-blue-600">{totalEquityB.toFixed(1)}%</td>
                <td className="p-3 border border-gray-200 text-center text-green-700">{valueB.toLocaleString('zh-CN')}</td>
              </tr>
              <tr className="bg-green-50 font-bold">
                <td className="p-3 border border-gray-200 text-center">合伙人 C</td>
                <td className="p-3 border border-gray-200 text-center">{fundEquityC.toFixed(1)}%</td>
                <td className="p-3 border border-gray-200 text-center">{laborEquityC.toFixed(1)}%</td>
                <td className="p-3 border border-gray-200 text-center text-blue-600">{totalEquityC.toFixed(1)}%</td>
                <td className="p-3 border border-gray-200 text-center text-green-700">{valueC.toLocaleString('zh-CN')}</td>
              </tr>
            </tbody>
          </table>
        </section>

        <div className="flex justify-center gap-4 mt-8 print:hidden">
          <Button variant="success" onClick={handleDownload}>
            <Download className="w-4 h-4" />
            下载 Excel 表格
          </Button>
          <Button variant="primary" onClick={() => window.print()}>
            <Printer className="w-4 h-4" />
            打印报告
          </Button>
        </div>
      </div>
    </div>
  );
};

export default function PartnerEquityCalculator() {
  const [activeTab, setActiveTab] = useState<'2' | '3'>('2');

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-2 mb-2">
        <Users className="h-6 w-6 text-emerald-600" />
        <h2 className="text-xl font-bold text-gray-800">合伙人股权分配计算器</h2>
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

        <div className="flex justify-center border-b border-gray-200 mb-8">
          <TabButton active={activeTab === '2'} onClick={() => setActiveTab('2')}>
            2位合伙人
          </TabButton>
          <TabButton active={activeTab === '3'} onClick={() => setActiveTab('3')}>
            3位合伙人
          </TabButton>
        </div>

        {activeTab === '2' ? <Calculator2Partners /> : <Calculator3Partners />}
      </Card>
    </div>
  );
}
