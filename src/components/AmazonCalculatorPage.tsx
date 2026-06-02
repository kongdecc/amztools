import React, { useState, useRef } from 'react';
import { Card, Input } from '@/components/SharedUI';
import { Upload, Calculator, AlertCircle, CheckCircle, Info, FileText } from 'lucide-react';
import * as XLSX from 'xlsx';
import { PRESET_RATES } from '@/lib/amazonRates';

// Types for logs
type LogType = 'info' | 'success' | 'warn' | 'error';
interface LogEntry {
  type: LogType;
  message: string;
  timestamp: number;
}

const AmazonCalculatorPage = () => {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [totalSalesResult, setTotalSalesResult] = useState<string | null>(null);
  const [totalRefundResult, setTotalRefundResult] = useState<string | null>(null);
  const [netSalesResult, setNetSalesResult] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  // Removed quarter state as per request
  // const [quarter, setQuarter] = useState('all'); 
  const salesInputRef = useRef<HTMLInputElement>(null);
  const refundInputRef = useRef<HTMLInputElement>(null);
  const rateInputRef = useRef<HTMLInputElement>(null);

  // Helper: Add Log
  const addLog = (message: string, type: LogType = 'info') => {
    setLogs(prev => [...prev, { type, message, timestamp: Date.now() }]);
  };

  // Helper: Format Date (YYYY-MM-DD)
  const formatDate = (date: Date): string => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  };

  // Helper: Read Excel File
  const readExcelFile = (file: File): Promise<any[]> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: 'array', cellDates: true });
          const firstSheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[firstSheetName];
          const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 0, defval: "" });
          resolve(jsonData as any[]);
        } catch (err) {
          reject(err);
        }
      };
      reader.onerror = (err) => reject(err);
      reader.readAsArrayBuffer(file);
    });
  };

  const handleCalculate = async () => {
    setLogs([]);
    setTotalSalesResult('计算中...');
    setTotalRefundResult('...');
    setNetSalesResult('...');
    setIsProcessing(true);

    const salesFiles = salesInputRef.current?.files;
    const refundFiles = refundInputRef.current?.files;
    const rateFiles = rateInputRef.current?.files;

    if (!salesFiles || salesFiles.length === 0) {
      addLog('错误: 请确保已上传销售报表。', 'error');
      setTotalSalesResult('错误');
      setIsProcessing(false);
      return;
    }

    try {
      addLog('开始处理...', 'info');
      
      // Removed quarter logging logic
      // if (quarter !== 'all') {
      //     addLog(`已启用季度筛选: 第 ${quarter} 季度`, 'info');
      // } else {
      //     addLog(`季度筛选: 全部 (不筛选)`, 'info');
      // }

      // 1. 获取汇率数据
      let rateData = PRESET_RATES;
      if (rateFiles && rateFiles.length > 0) {
        const rateFile = rateFiles[0];
        try {
          rateData = await readExcelFile(rateFile);
          addLog(`使用上传的汇率表 "${rateFile.name}"，共 ${rateData.length} 行数据。`, 'success');
        } catch (e: any) {
          addLog(`读取上传的汇率表失败: ${e.message}，将尝试使用预设数据。`, 'warn');
        }
      } else {
        addLog(`使用内置预设汇率数据，共 ${rateData.length} 行。`, 'success');
      }

      // 构建汇率映射 Map: DateStr -> { "USD/CNY": 7.1, ... }
      const rateMap = new Map<string, any>();
      rateData.forEach((row: any) => {
        let dateStr = null;
        if (row['日期']) {
          if (row['日期'] instanceof Date) {
            dateStr = formatDate(row['日期']);
          } else {
            const parsed = new Date(row['日期']);
            if (!isNaN(parsed.getTime())) {
                dateStr = formatDate(parsed);
            } else {
                dateStr = String(row['日期']).trim();
            }
          }
        }
        
        if (dateStr) {
          rateMap.set(dateStr, row);
        }
      });

      if (rateMap.size > 0) {
        const dates = Array.from(rateMap.keys()).sort();
        addLog(`汇率覆盖日期范围: ${dates[0]} 至 ${dates[dates.length-1]}`, 'info');
      } else {
        addLog('警告: 汇率表中未找到有效日期数据。', 'warn');
      }

      // 2. 循环读取销售表并计算
      let totalRMB = 0;
      let totalProcessedCount = 0;
      let totalSkippedCount = 0;
      // let totalFilteredCount = 0; // Removed filter logic
      let totalMissingRateCount = 0;

      const fieldsToAdd = [
        '商品价格', 
        '商品税', 
        '运费', 
        '运费税', 
        '礼品包装价格', 
        '礼品包装税费'
      ];

      const fieldsToSubtract = [
        '商品促销折扣',
        '货件促销折扣'
      ];

      addLog(`开始处理 ${salesFiles.length} 个销售文件...`, 'info');

      for (let f = 0; f < salesFiles.length; f++) {
        const salesFile = salesFiles[f];
        addLog(`正在读取文件 [${f+1}/${salesFiles.length}]: ${salesFile.name}`, 'info');
        
        const salesData = await readExcelFile(salesFile);
        addLog(`  - 读取成功，共 ${salesData.length} 行。`, 'success');

        if (salesData.length > 0 && salesData[0]['配送日期'] === undefined) {
             addLog(`  - 错误: 未找到"配送日期"列，跳过此文件。可能是编码问题。`, 'error');
             continue;
        }

        let fileProcessed = 0;
        
        for (let i = 0; i < salesData.length; i++) {
          const row: any = salesData[i];
          
          // 检查配送日期
          const deliveryDateRaw = row['配送日期'];
          if (!deliveryDateRaw) {
              totalSkippedCount++;
              continue; 
          }

          // 解析配送日期 (removed quarterly filter logic)
          let deliveryDate: Date;
          if (deliveryDateRaw instanceof Date) {
              deliveryDate = deliveryDateRaw;
          } else {
              deliveryDate = new Date(deliveryDateRaw);
          }

          if (isNaN(deliveryDate.getTime())) {
              totalSkippedCount++;
              continue;
          }

          // Removed quarterly filter logic
          // if (quarter !== 'all') {
          //     const month = deliveryDate.getMonth() + 1; // 1-12
          //     let q = 0;
          //     if (month >= 1 && month <= 3) q = 1;
          //     else if (month >= 4 && month <= 6) q = 2;
          //     else if (month >= 7 && month <= 9) q = 3;
          //     else if (month >= 10 && month <= 12) q = 4;
          //     
          //     if (String(q) !== quarter) {
          //         totalFilteredCount++;
          //         continue;
          //     }
          // }

          // 获取预计配送日期用于汇率匹配
          const estimatedDateRaw = row['预计配送日期'];
          if (!estimatedDateRaw) {
              totalSkippedCount++;
              continue;
          }

          // 解析预计配送日期
          let estimatedDate: Date;
          if (estimatedDateRaw instanceof Date) {
              estimatedDate = estimatedDateRaw;
          } else {
              estimatedDate = new Date(estimatedDateRaw);
          }

          if (isNaN(estimatedDate.getTime())) {
              totalSkippedCount++;
              continue;
          }

          const dateStr = formatDate(estimatedDate);
          
          // 获取货币类型
          const currency = row['货币'] || 'USD'; // 默认为 USD

          // 智能匹配汇率逻辑
          let finalRate: number | null = null;
          
          // 1. 查找汇率 (回溯)
          let checkDate = new Date(estimatedDate);
          let foundRateRow = null;
          let foundDateStr = null;
          
          for (let d = 0; d < 10; d++) {
              const checkStr = formatDate(checkDate);
              if (rateMap.has(checkStr)) {
                  foundRateRow = rateMap.get(checkStr);
                  foundDateStr = checkStr;
                  break;
              }
              checkDate.setDate(checkDate.getDate() - 1);
          }

          if (!foundRateRow) {
              if (totalMissingRateCount < 5) {
                  addLog(`  - 行 ${i+2}: 错误 - 未找到 ${dateStr} (及前10天) 的汇率数据。`, 'error');
              }
              totalMissingRateCount++;
              continue;
          }

          // 2. 根据货币类型匹配汇率列
          if (currency === 'CNY') {
              finalRate = 1;
          } else {
              const directKey = `${currency}/CNY`;
              const hundredKey = `100${currency}/CNY`;
              const indirectKey = `CNY/${currency}`;

              if (foundRateRow[directKey] !== undefined) {
                  finalRate = parseFloat(foundRateRow[directKey]);
              } else if (foundRateRow[hundredKey] !== undefined) {
                  finalRate = parseFloat(foundRateRow[hundredKey]) / 100;
              } else if (foundRateRow[indirectKey] !== undefined) {
                  const val = parseFloat(foundRateRow[indirectKey]);
                  if (val !== 0) finalRate = 1 / val;
              }
          }

          if (finalRate === null || isNaN(finalRate)) {
              if (totalMissingRateCount < 5) {
                  addLog(`  - 行 ${i+2}: 错误 - 在 ${foundDateStr} 数据中未找到货币 ${currency} 的汇率 (尝试了 ${currency}/CNY, 100${currency}/CNY, CNY/${currency})。`, 'error');
              }
              totalMissingRateCount++;
              continue;
          }

          // 计算该行总金额
          let rowSumOriginal = 0;
          
          // 加项
          fieldsToAdd.forEach(field => {
              const val = parseFloat(row[field]);
              if (!isNaN(val)) {
                  rowSumOriginal += val;
              }
          });

          // 减项 (取绝对值后相减)
          fieldsToSubtract.forEach(field => {
              const val = parseFloat(row[field]);
              if (!isNaN(val)) {
                  rowSumOriginal -= Math.abs(val);
              }
          });

          // 转换为人民币
          const rowRMB = rowSumOriginal * finalRate;
          totalRMB += rowRMB;
          fileProcessed++;
          totalProcessedCount++;
        }
        addLog(`  - 文件处理完成，有效订单: ${fileProcessed}`, 'info');
      }

      // ===========================
      // 3. 处理退款文件 (Refunds)
      // ===========================
      let totalRefundRMB = 0;
      if (refundFiles && refundFiles.length > 0) {
        addLog(`>>> 开始处理退款文件...`, 'info');
        const refundFile = refundFiles[0];
        const refundData = await readExcelFile(refundFile);
        addLog(`  - 读取退款文件成功，共 ${refundData.length} 行。`, 'success');
        
        // 尝试检测货币
        let refundCurrency = 'USD';
        if (refundData.length > 0) {
          const headers = Object.keys(refundData[0]);
          const totalHeader = headers.find(h => h.startsWith('总计 ('));
          if (totalHeader) {
            const match = totalHeader.match(/总计 \((.+)\)/);
            if (match && match[1]) {
              refundCurrency = match[1];
              addLog(`  - 检测到退款货币为: ${refundCurrency}`, 'info');
            }
          }
        }

        let refundProcessed = 0;
        let refundSkipped = 0;

        for (let i = 0; i < refundData.length; i++) {
          const row: any = refundData[i];
          
          // 检查日期
          const dateRaw = row['日期'];
          if (!dateRaw) { refundSkipped++; continue; }
          
          // 格式化日期
          let dateStr: string | null = null;
          if (dateRaw instanceof Date) {
              dateStr = formatDate(dateRaw);
          } else {
              const parsed = new Date(dateRaw);
              if (!isNaN(parsed.getTime())) {
                  dateStr = formatDate(parsed);
              } else {
                  dateStr = null;
              }
          }

          if (!dateStr) { refundSkipped++; continue; }

          // 获取金额 "商品价格总额"
          const amountRaw = row['商品价格总额'];
          const amount = parseFloat(amountRaw);
          if (isNaN(amount)) { refundSkipped++; continue; }

          // 匹配汇率
          let finalRate: number | null = null;
          let checkDate = new Date(dateStr);
          let foundRateRow = null;
          let foundDateStr = null;
          
          for (let d = 0; d < 10; d++) {
              const checkStr = formatDate(checkDate);
              if (rateMap.has(checkStr)) {
                  foundRateRow = rateMap.get(checkStr);
                  foundDateStr = checkStr;
                  break;
              }
              checkDate.setDate(checkDate.getDate() - 1);
          }

          if (foundRateRow) {
               // 根据货币类型匹配汇率列
              if (refundCurrency === 'CNY') {
                  finalRate = 1;
              } else {
                  const directKey = `${refundCurrency}/CNY`;
                  const hundredKey = `100${refundCurrency}/CNY`;
                  const indirectKey = `CNY/${refundCurrency}`;

                  if (foundRateRow[directKey] !== undefined) {
                      finalRate = parseFloat(foundRateRow[directKey]);
                  } else if (foundRateRow[hundredKey] !== undefined) {
                      finalRate = parseFloat(foundRateRow[hundredKey]) / 100;
                  } else if (foundRateRow[indirectKey] !== undefined) {
                      const val = parseFloat(foundRateRow[indirectKey]);
                      if (val !== 0) finalRate = 1 / val;
                  }
              }
          }

          if (finalRate === null || isNaN(finalRate)) {
            // 找不到汇率跳过或记录
            refundSkipped++;
            continue;
          }

          // 转换为人民币 (金额通常为负数，累加即可)
          const rowRMB = amount * finalRate;
          totalRefundRMB += rowRMB;
          refundProcessed++;
        }
        addLog(`  - 退款文件处理完成，有效记录: ${refundProcessed} 条`, 'success');
      }

      // 4. 显示结果
      const displayRefundRMB = Math.abs(totalRefundRMB);
      const netRMB = totalRMB - displayRefundRMB;

      // 完成
      addLog('------------------------------------------------', 'info');
      addLog(`所有文件计算完成!`, 'success');
      addLog(`总有效订单数: ${totalProcessedCount}`, 'info');
      // addLog(`因季度筛选跳过: ${totalFilteredCount}`, 'info'); // Removed log
      addLog(`无效/数据缺失跳过: ${totalSkippedCount}`, 'info');
      if (totalMissingRateCount > 0) {
        addLog(`总缺失汇率行数: ${totalMissingRateCount} (请检查汇率表日期范围)`, 'warn');
      }
      
      setTotalSalesResult(totalRMB.toLocaleString('zh-CN', { style: 'currency', currency: 'CNY' }));
      setTotalRefundResult(displayRefundRMB.toLocaleString('zh-CN', { style: 'currency', currency: 'CNY' }));
      setNetSalesResult(netRMB.toLocaleString('zh-CN', { style: 'currency', currency: 'CNY' }));

      addLog('所有计算完成！', 'success');

    } catch (e: any) {
      addLog(`发生未知错误: ${e.message}`, 'error');
      console.error(e);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleReset = () => {
    setLogs([]);
    setTotalSalesResult(null);
    setTotalRefundResult(null);
    setNetSalesResult(null);
    if (salesInputRef.current) salesInputRef.current.value = '';
    if (refundInputRef.current) refundInputRef.current.value = '';
    if (rateInputRef.current) rateInputRef.current.value = '';
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
        {/* Safety Declaration */}
        <div className="bg-blue-50 border-l-4 border-blue-500 p-4 rounded-r-md">
            <div className="flex">
                <div className="flex-shrink-0">
                    <Info className="h-5 w-5 text-blue-400" aria-hidden="true" />
                </div>
                <div className="ml-3">
                    <p className="text-sm text-blue-700">
                        <strong>🔒 安全声明：</strong> 本工具所有数据处理和计算均在您的浏览器<strong>本地进行</strong>（Client-side processing）。您的文件<strong>不会</strong>上传到任何服务器，也不会保存到任何外部数据库，请放心使用。
                    </p>
                </div>
            </div>
        </div>

      <div className="space-y-6">
        {/* Input Section */}
        <Card className="p-6 space-y-6">
          <div className="flex items-center space-x-2 text-lg font-semibold text-gray-900">
            <Calculator className="w-5 h-5 text-indigo-600" />
            <span>亚马逊销售额计算</span>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                上传销售报表 (支持多选)
              </label>
              <div className="text-xs text-gray-500 mb-1">
                 下载路径：首页-报告-配送-销量-亚马逊配送货件 (.csv)
              </div>
              <div className="relative">
                <Input
                  type="file"
                  multiple
                  ref={salesInputRef}
                  accept=".csv,.xlsx,.xls"
                  className="pl-10 py-2 h-auto file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100"
                />
                <FileText className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
              <p className="mt-1 text-xs text-gray-500">
                按住 Ctrl 或 Shift 键可选择多个CSV文件。必须包含以下列："配送日期"、"预计配送日期"、"货币"；以及金额列："商品价格"、"商品税"、"运费"、"运费税"、"礼品包装价格"、"礼品包装税费"、"商品促销折扣"、"货件促销折扣"。
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                上传亚马逊退款明细 (可选)
              </label>
              <div className="text-xs text-gray-500 mb-1">
                 用于计算退款总额并得出净销售额
              </div>
              <div className="relative">
                <Input
                  type="file"
                  ref={refundInputRef}
                  accept=".csv,.xlsx,.xls"
                  className="pl-10 py-2 h-auto file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-yellow-50 file:text-yellow-700 hover:file:bg-yellow-100"
                />
                <FileText className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
              <p className="mt-1 text-xs text-gray-500">
                文件应包含"日期"和"商品价格总额"列。
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                上传自定义汇率表 (可选)
              </label>
              <div className="text-xs text-gray-500 mb-1">
                 默认使用内置数据：从2025年6月25日-2026年6月2日
              </div>
              <div className="relative">
                <Input
                  type="file"
                  ref={rateInputRef}
                  accept=".xlsx,.xls,.csv"
                  className="pl-10 py-2 h-auto file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100"
                />
                <Upload className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
              <p className="mt-1 text-xs text-gray-500">
                请上传包含"日期"和汇率字段(如 USD/CNY)的Excel文件。
              </p>
            </div>

            {/* Quarter Selection Removed */}
            
            <details className="text-xs text-gray-600 border border-dashed border-gray-300 p-2 rounded bg-gray-50">
                <summary className="cursor-pointer font-semibold text-indigo-600">❓ 支持哪些货币自动换算？如何换算？</summary>
                <div className="mt-2 space-y-2">
                    <p>本工具会自动识别销售表格中的 <strong>“货币”</strong> 列，并根据汇率表自动换算为人民币 (CNY)。</p>
                    <p><strong>支持的货币逻辑：</strong></p>
                    <ul className="list-disc pl-5 space-y-1">
                        <li><strong>直接汇率 (乘以汇率):</strong> 如 USD (美元), EUR (欧元), GBP (英镑), CAD (加元), AUD (澳元) 等。 <br/><em>算法：金额 × (USD/CNY)</em></li>
                        <li><strong>百单位汇率 (乘以汇率 ÷ 100):</strong> 如 JPY (日元)。 <br/><em>算法：金额 × (100JPY/CNY) ÷ 100</em></li>
                        <li><strong>间接汇率 (除以汇率):</strong> 如 MXN (墨西哥比索), THB (泰铢) 等，汇率表中通常体现为 "CNY/MXN"。 <br/><em>算法：金额 ÷ (CNY/MXN)</em></li>
                    </ul>
                    <p>如果您的表格包含其他货币，请确保汇率表中有对应的 "XXX/CNY" 或 "CNY/XXX" 列。</p>
                </div>
            </details>

            <div className="flex space-x-4">
                <button
                  onClick={handleCalculate}
                  disabled={isProcessing}
                  className={`flex-1 flex items-center justify-center space-x-2 py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 ${isProcessing ? 'opacity-75 cursor-wait' : ''}`}
                >
                  {isProcessing ? (
                    <>
                      <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      计算中...
                    </>
                  ) : (
                    <>
                      <Calculator className="w-4 h-4" />
                      <span>开始计算</span>
                    </>
                  )}
                </button>

                <button
                  onClick={handleReset}
                  disabled={isProcessing}
                  className="flex items-center justify-center space-x-2 py-2 px-6 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                >
                   <span>重置</span>
                </button>
            </div>
          </div>
        </Card>

      {/* Result Section */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="p-6 flex flex-col justify-center items-center space-y-2 bg-indigo-50 border-indigo-100">
                <h3 className="text-sm font-medium text-indigo-900">销售总额 (RMB)</h3>
                <div className="text-2xl font-bold text-indigo-600 tracking-tight">
                    {totalSalesResult || '¥0.00'}
                </div>
            </Card>

            <Card className="p-6 flex flex-col justify-center items-center space-y-2 bg-red-50 border-red-100">
                <h3 className="text-sm font-medium text-red-900">退款总额 (RMB)</h3>
                <div className="text-2xl font-bold text-red-600 tracking-tight">
                    {totalRefundResult || '¥0.00'}
                </div>
            </Card>

            <Card className="p-6 flex flex-col justify-center items-center space-y-2 bg-blue-50 border-blue-100 border-l-4 border-l-blue-500 relative">
                <h3 className="text-sm font-medium text-blue-900 flex items-center gap-1">
                    净销售额 (RMB) 
                </h3>
                <div className="text-3xl font-bold text-blue-700 tracking-tight">
                    {netSalesResult || '¥0.00'}
                </div>
                <div className="text-xs text-red-500 font-semibold mt-1">
                    (税务局申报是这个数据)
                </div>
            </Card>
        </div>
      </div>

      {/* Log Console */}
      <Card className="p-4 bg-gray-900 text-gray-100 font-mono text-sm h-64 overflow-y-auto rounded-lg shadow-inner">
        <div className="flex items-center justify-between mb-2 pb-2 border-b border-gray-700">
          <span className="font-semibold text-gray-400">运行日志</span>
          <span className="text-xs text-gray-500">{logs.length} 条记录</span>
        </div>
        <div className="space-y-1">
          {logs.length === 0 && (
            <div className="text-gray-600 italic">等待操作...</div>
          )}
          {logs.map((log, idx) => (
            <div key={idx} className={`flex items-start space-x-2 ${
              log.type === 'error' ? 'text-red-400' :
              log.type === 'warn' ? 'text-yellow-400' :
              log.type === 'success' ? 'text-green-400' :
              'text-gray-300'
            }`}>
              <span className="text-gray-600 text-xs mt-0.5">[{new Date(log.timestamp).toLocaleTimeString()}]</span>
              <span>
                {log.type === 'error' && '❌ '}
                {log.type === 'warn' && '⚠️ '}
                {log.type === 'success' && '✅ '}
                {log.message}
              </span>
            </div>
          ))}
        </div>
      </Card>
      
    </div>
  );
};

export default AmazonCalculatorPage;
