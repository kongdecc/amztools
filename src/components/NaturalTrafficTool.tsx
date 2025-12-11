'use client';

import React, { useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import { Upload, FileSpreadsheet, Download, AlertCircle, CheckCircle2, BarChart3, HelpCircle } from 'lucide-react';

interface ProcessResult {
  outAOA: any[][];
  merges: XLSX.Range[];
  expanded: number;
  skippedFirst: number;
  matchedCount: number;
  unmatchedCount: number;
  maxVariantCols: number;
  variantColStart: number;
  extraTrafficColIndex: number;
}

export default function NaturalTrafficTool() {
  const [file1, setFile1] = useState<File | null>(null);
  const [file2, setFile2] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [status, setStatus] = useState<{ type: 'info' | 'success' | 'error' | 'warning'; message: string } | null>(null);
  const [result, setResult] = useState<ProcessResult | null>(null);
  const [previewData, setPreviewData] = useState<any[][]>([]);
  const [wb, setWb] = useState<XLSX.WorkBook | null>(null);

  const fileInput1Ref = useRef<HTMLInputElement>(null);
  const fileInput2Ref = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, setFile: (f: File | null) => void) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setStatus(null);
      setResult(null);
      setWb(null);
    }
  };

  const readFile = (file: File): Promise<ArrayBuffer> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target?.result as ArrayBuffer);
      reader.onerror = () => reject(new Error('文件读取失败'));
      reader.readAsArrayBuffer(file);
    });
  };

  const parseHCell = (raw: any) => {
    if (!raw) return [];
    const text = String(raw).trim();
    if (!text) return [];
    const groups: string[][] = [];
    const regex = /\[([^\]]+)\]/g;
    let match;
    while ((match = regex.exec(text)) !== null) {
      const parts = splitFiveParts(match[1]);
      if (parts) groups.push(parts);
    }
    return groups;
  };

  const splitFiveParts = (str: string) => {
    const parts: string[] = [];
    let remaining = str.trim();
    for (let i = 0; i < 4; i++) {
      const commaIdx = remaining.indexOf(',');
      if (commaIdx === -1) return null;
      parts.push(remaining.substring(0, commaIdx).trim());
      remaining = remaining.substring(commaIdx + 1).trim();
    }
    if (remaining) {
      parts.push(remaining);
      return parts;
    }
    return null;
  };

  const transformSheet = (ws: XLSX.WorkSheet) => {
    const aoa = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' }) as any[][];
    if (!aoa || aoa.length === 0) throw new Error('表格1为空');

    const headerRow = aoa[0] || [];
    let hIndex = 7; // Default H column index
    const targetName = '获得多自然位的变体｜自然流量占比｜获得自然位的天数｜平均自然排名｜近30天销量';
    const found = headerRow.findIndex((h: any) => String(h).trim() === targetName);
    if (found !== -1) hIndex = found;

    let trafficColIndex = -1;
    const trafficColNames = ['关键词给该Listing贡献的自然流量', '自然流量', '关键词给该listing贡献的自然流量'];
    
    for (let i = 0; i < headerRow.length; i++) {
      const header = String(headerRow[i] || '').trim();
      if (trafficColNames.some(name => header.includes(name) || header === name)) {
        trafficColIndex = i;
        break;
      }
    }

    const newHeaders = [];
    for (let i = 0; i < headerRow.length; i++) {
      if (i === hIndex) {
        newHeaders.push('获得多自然位的变体', '自然流量占比', '子体额外自然流量', '获得自然位的天数', '平均自然排名', '近30天销量');
      } else {
        newHeaders.push(headerRow[i] || `列${i + 1}`);
      }
    }

    const outAOA = [newHeaders];
    const merges: XLSX.Range[] = [];
    let expanded = 0;
    let skippedFirst = 0;
    let currentRow = 1;

    for (let r = 1; r < aoa.length; r++) {
      const row = aoa[r];
      if (!row || row.length === 0) continue;

      const hVal = row[hIndex];
      const groups = parseHCell(hVal);
      let keywordTraffic = 0;

      if (trafficColIndex !== -1) {
        const trafficValue = row[trafficColIndex];
        keywordTraffic = parseFloat(String(trafficValue || '0').replace(/[,%]/g, '')) || 0;
      }

      let processGroups = groups;
      if (groups.length > 0) {
        processGroups = groups.slice(1); // Always skip first group as per logic
        skippedFirst++;
      }

      const groupCount = processGroups.length;
      const startRow = currentRow;

      if (groupCount === 0) {
        const newRow = [];
        for (let i = 0; i < row.length; i++) {
          if (i === hIndex) {
            newRow.push('', '', '', '', '', '');
          } else {
            newRow.push(row[i] || '');
          }
        }
        outAOA.push(newRow);
        currentRow++;
      } else {
        processGroups.forEach((g) => {
          const newRow = [];
          for (let i = 0; i < row.length; i++) {
            if (i === hIndex) {
              const naturalTrafficRatio = parseFloat(String(g[1] || '0').replace(/[,%]/g, '')) || 0;
              const extraTraffic = (naturalTrafficRatio / 100) * keywordTraffic;
              newRow.push(g[0] || '', g[1] || '', extraTraffic.toFixed(2), g[2] || '', g[3] || '', g[4] || '');
            } else {
              newRow.push(row[i] || '');
            }
          }
          outAOA.push(newRow);
          expanded++;
        });
        currentRow += groupCount;

        if (groupCount > 1) {
          let colIdx = 0;
          for (let i = 0; i < row.length; i++) {
            if (i !== hIndex) {
              merges.push({ s: { r: startRow, c: colIdx }, e: { r: currentRow - 1, c: colIdx } });
              colIdx++;
            } else {
              colIdx += 6;
            }
          }
        }
      }
    }

    return { outAOA, merges, expanded, skippedFirst };
  };

  const buildVariantMap = (ws: XLSX.WorkSheet) => {
    const aoa = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' }) as any[][];
    if (!aoa || aoa.length === 0) throw new Error('表格2为空');

    const headerRow = aoa[0] || [];
    let asinIndex = -1;
    let variantTypeIndex = -1;

    headerRow.forEach((h, idx) => {
      const headerStr = String(h).trim().toUpperCase();
      if (headerStr === 'ASIN') asinIndex = idx;
      if (headerStr === '变体类型' || headerStr.includes('变体类型')) variantTypeIndex = idx;
    });

    if (asinIndex === -1) throw new Error('表格2中未找到ASIN列');
    if (variantTypeIndex === -1) throw new Error('表格2中未找到变体类型列');

    const map: Record<string, string> = {};
    for (let r = 1; r < aoa.length; r++) {
      const row = aoa[r];
      if (!row || row.length === 0) continue;
      const asin = String(row[asinIndex] || '').trim();
      const variantType = String(row[variantTypeIndex] || '').trim();
      if (asin) map[asin] = variantType;
    }
    return map;
  };

  const splitVariantType = (variantType: string) => {
    if (!variantType) return [];
    let text = variantType.trim();
    text = text.replace(/^\[|\]$/g, '');
    return text.split(',').map(p => p.trim()).filter(p => p);
  };

  const matchAndAddVariantTypes = (result1: any, variantMap: Record<string, string>) => {
    const { outAOA, merges } = result1;
    const headerRow = outAOA[0];
    const variantColIndex = headerRow.findIndex((h: any) => String(h).trim() === '获得多自然位的变体');
    
    if (variantColIndex === -1) throw new Error('未找到"获得多自然位的变体"列');
    
    const extraTrafficColIndex = headerRow.findIndex((h: any) => String(h).trim() === '子体额外自然流量');
    
    let maxVariantCols = 0;
    let matchedCount = 0;
    let unmatchedCount = 0;

    for (let r = 1; r < outAOA.length; r++) {
      const asin = String(outAOA[r][variantColIndex] || '').trim();
      if (asin && variantMap[asin]) {
        const parts = splitVariantType(variantMap[asin]);
        maxVariantCols = Math.max(maxVariantCols, parts.length);
        matchedCount++;
      } else if (asin) {
        unmatchedCount++;
      }
    }

    const newHeaderRow = [];
    for (let i = 0; i < headerRow.length; i++) {
      newHeaderRow.push(headerRow[i]);
      if (i === variantColIndex) {
        for (let j = 1; j <= maxVariantCols; j++) {
          newHeaderRow.push(`变体类型${j}`);
        }
      }
    }

    const variantColStart = variantColIndex + 1;
    const newAOA = [newHeaderRow];

    for (let r = 1; r < outAOA.length; r++) {
      const row = outAOA[r];
      const asin = String(row[variantColIndex] || '').trim();
      const newRow = [];
      for (let i = 0; i < row.length; i++) {
        newRow.push(row[i]);
        if (i === variantColIndex) {
          if (asin && variantMap[asin]) {
            const parts = splitVariantType(variantMap[asin]);
            for (let j = 0; j < maxVariantCols; j++) {
              newRow.push(parts[j] || '');
            }
          } else {
            for (let j = 0; j < maxVariantCols; j++) {
              newRow.push('');
            }
          }
        }
      }
      newAOA.push(newRow);
    }

    const newMerges = [];
    for (const merge of merges) {
      const oldCol = merge.s.c;
      let newCol = oldCol;
      if (oldCol > variantColIndex) {
        newCol = oldCol + maxVariantCols;
      }
      newMerges.push({
        s: { r: merge.s.r, c: newCol },
        e: { r: merge.e.r, c: newCol }
      });
    }

    let newExtraTrafficColIndex = extraTrafficColIndex;
    if (extraTrafficColIndex > variantColIndex) {
      newExtraTrafficColIndex = extraTrafficColIndex + maxVariantCols;
    }

    return {
      outAOA: newAOA,
      merges: newMerges,
      matchedCount,
      unmatchedCount,
      maxVariantCols,
      variantColStart,
      extraTrafficColIndex: newExtraTrafficColIndex
    };
  };

  const processFiles = async () => {
    if (!file1 || !file2) {
      setStatus({ type: 'warning', message: '请先选择两个Excel文件' });
      return;
    }

    setIsProcessing(true);
    setStatus({ type: 'info', message: '正在处理数据...' });

    try {
      const arrayBuffer1 = await readFile(file1);
      const wb1 = XLSX.read(new Uint8Array(arrayBuffer1), { type: 'array' });
      const ws1 = wb1.Sheets[wb1.SheetNames[0]];
      const result1 = transformSheet(ws1);

      const arrayBuffer2 = await readFile(file2);
      const wb2 = XLSX.read(new Uint8Array(arrayBuffer2), { type: 'array' });
      const ws2 = wb2.Sheets[wb2.SheetNames[0]];
      const variantMap = buildVariantMap(ws2);

      const finalResult = matchAndAddVariantTypes(result1, variantMap);

      setResult({
        ...finalResult,
        expanded: result1.expanded,
        skippedFirst: result1.skippedFirst
      });
      setPreviewData(finalResult.outAOA.slice(0, 31)); // Preview first 30 rows + header

      const newWs = XLSX.utils.aoa_to_sheet(finalResult.outAOA);
      if (finalResult.merges && finalResult.merges.length > 0) {
        newWs['!merges'] = finalResult.merges;
      }
      const newWb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(newWb, newWs, 'Result');
      setWb(newWb);

      setStatus({
        type: 'success',
        message: '处理完成！'
      });
    } catch (err: any) {
      setStatus({ type: 'error', message: '处理失败: ' + err.message });
      console.error(err);
    } finally {
      setIsProcessing(false);
    }
  };

  const downloadResult = () => {
    if (!wb) return;
    const timestamp = new Date().toISOString().slice(0, 16).replace(/[:-]/g, '');
    const filename = `处理结果_${timestamp}.xlsx`;
    XLSX.writeFile(wb, filename);
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Header */}
        <div className="text-center mb-10">
          <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-blue-400 mb-2">
            多个自然位额外获得自然流量处理工具
          </h1>
          <div className="flex flex-col items-center justify-center mt-6 space-y-4">
            <div className="flex items-center space-x-2 text-gray-600">
              <span className="text-sm">作者公众号</span>
              <span className="font-semibold text-gray-900">必胜哥的三板斧</span>
            </div>
            <div className="w-32 h-32 rounded-2xl shadow-lg overflow-hidden transition-transform hover:scale-105 duration-300">
              <img 
                src="https://tc.z.wiki/autoupload/edKd7EnrdtB-UwY97x0oKsS6MvGWw9YIYwMnL2_E4yayl5f0KlZfm6UsKj-HyTuv/20250705/KWaE/430X430/qrcode_for_gh_3938b401b10d_430.jpg" 
                alt="公众号二维码" 
                className="w-full h-full object-cover"
              />
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
          
          {/* Instructions */}
          <div className="mb-8 p-6 bg-blue-50 rounded-xl border border-blue-100">
            <h2 className="flex items-center text-lg font-semibold text-gray-900 mb-4">
              <HelpCircle className="w-5 h-5 mr-2 text-blue-600" />
              工具说明
            </h2>
            <div className="space-y-3 text-gray-600 text-sm leading-relaxed">
              <p>
                <strong className="text-gray-900">步骤1：</strong>
                处理「查多变体自然位表格」- H列拆分为6列（新增"子体额外自然流量"），
                <span className="text-orange-600 font-medium">自动跳过第一组数据</span>，合并单元格
              </p>
              <p>
                <strong className="text-gray-900">步骤2：</strong>
                使用「查流量结构表格」匹配ASIN对应的变体类型数据
              </p>
              <p>
                <strong className="text-gray-900">步骤3：</strong>
                在"获得多自然位的变体"后插入变体类型列（变体类型1、变体类型2等）
              </p>
              <div className="pt-2 border-t border-blue-200 mt-2">
                <span className="font-medium text-blue-800">计算公式：</span>
                子体额外自然流量 = 自然流量占比 × 关键词给该Listing贡献的自然流量
              </div>
            </div>
          </div>

          {/* File Uploads */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
            <div 
              className={`relative group p-8 border-2 border-dashed rounded-xl transition-all duration-200 cursor-pointer text-center
                ${file1 ? 'border-green-400 bg-green-50/30' : 'border-gray-300 hover:border-blue-400 hover:bg-gray-50'}`}
              onClick={() => fileInput1Ref.current?.click()}
            >
              <input 
                type="file" 
                ref={fileInput1Ref}
                className="hidden" 
                accept=".xlsx,.xls,.csv"
                onChange={(e) => handleFileChange(e, setFile1)}
              />
              <FileSpreadsheet className={`w-10 h-10 mx-auto mb-3 ${file1 ? 'text-green-500' : 'text-gray-400 group-hover:text-blue-500'}`} />
              <h3 className="font-medium text-gray-900 mb-1">表格1：查多变体自然位表格</h3>
              <p className="text-xs text-gray-500 mb-2">点击上传文件</p>
              {file1 ? (
                <div className="inline-flex items-center px-3 py-1 rounded-full bg-green-100 text-green-700 text-xs font-medium">
                  <CheckCircle2 className="w-3 h-3 mr-1" />
                  {file1.name}
                </div>
              ) : (
                <span className="text-xs text-gray-400">未选择文件</span>
              )}
            </div>

            <div 
              className={`relative group p-8 border-2 border-dashed rounded-xl transition-all duration-200 cursor-pointer text-center
                ${file2 ? 'border-green-400 bg-green-50/30' : 'border-gray-300 hover:border-blue-400 hover:bg-gray-50'}`}
              onClick={() => fileInput2Ref.current?.click()}
            >
              <input 
                type="file" 
                ref={fileInput2Ref}
                className="hidden" 
                accept=".xlsx,.xls,.csv"
                onChange={(e) => handleFileChange(e, setFile2)}
              />
              <FileSpreadsheet className={`w-10 h-10 mx-auto mb-3 ${file2 ? 'text-green-500' : 'text-gray-400 group-hover:text-blue-500'}`} />
              <h3 className="font-medium text-gray-900 mb-1">表格2：查流量结构表格</h3>
              <p className="text-xs text-gray-500 mb-2">点击上传文件</p>
              {file2 ? (
                <div className="inline-flex items-center px-3 py-1 rounded-full bg-green-100 text-green-700 text-xs font-medium">
                  <CheckCircle2 className="w-3 h-3 mr-1" />
                  {file2.name}
                </div>
              ) : (
                <span className="text-xs text-gray-400">未选择文件</span>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-4 mb-6">
            <button
              onClick={processFiles}
              disabled={isProcessing || !file1 || !file2}
              className={`flex-1 py-4 px-6 rounded-xl font-medium text-white shadow-sm transition-all duration-200 flex items-center justify-center
                ${isProcessing || !file1 || !file2 
                  ? 'bg-gray-300 cursor-not-allowed' 
                  : 'bg-blue-600 hover:bg-blue-700 hover:shadow-md active:scale-[0.98]'}`}
            >
              {isProcessing ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent mr-2" />
                  处理中...
                </>
              ) : (
                <>
                  <BarChart3 className="w-5 h-5 mr-2" />
                  开始处理
                </>
              )}
            </button>
            
            <button
              onClick={downloadResult}
              disabled={!wb}
              className={`flex-1 py-4 px-6 rounded-xl font-medium border-2 transition-all duration-200 flex items-center justify-center
                ${!wb 
                  ? 'border-gray-200 text-gray-400 cursor-not-allowed bg-gray-50' 
                  : 'border-blue-600 text-blue-600 hover:bg-blue-50 active:scale-[0.98]'}`}
            >
              <Download className="w-5 h-5 mr-2" />
              下载结果
            </button>
          </div>

          {/* Status Message */}
          {status && (
            <div className={`p-4 rounded-xl border mb-6 flex items-start
              ${status.type === 'error' ? 'bg-red-50 border-red-100 text-red-700' : 
                status.type === 'success' ? 'bg-green-50 border-green-100 text-green-700' :
                status.type === 'warning' ? 'bg-orange-50 border-orange-100 text-orange-700' :
                'bg-blue-50 border-blue-100 text-blue-700'}`}
            >
              {status.type === 'error' && <AlertCircle className="w-5 h-5 mr-3 flex-shrink-0 mt-0.5" />}
              {status.type === 'success' && <CheckCircle2 className="w-5 h-5 mr-3 flex-shrink-0 mt-0.5" />}
              {status.type === 'warning' && <AlertCircle className="w-5 h-5 mr-3 flex-shrink-0 mt-0.5" />}
              {status.type === 'info' && <div className="animate-spin rounded-full h-4 w-4 border-2 border-current border-t-transparent mr-3 flex-shrink-0 mt-1" />}
              
              <div className="flex-1">
                <p className="font-medium">{status.message}</p>
                {result && status.type === 'success' && (
                  <div className="mt-3 text-sm space-y-1 opacity-90">
                    <p>📊 表格1拆分: {result.expanded} 行（已跳过第一组数据）</p>
                    <p>📊 跳过的数据组: {result.skippedFirst} 个</p>
                    <p>📊 成功匹配: {result.matchedCount} 个变体</p>
                    <p>📊 未匹配: {result.unmatchedCount} 个变体</p>
                    <p>📊 变体类型列数: {result.maxVariantCols} 列</p>
                    <p>📊 合并单元格数: {result.merges.length} 个</p>
                    <p>📊 总输出行数: {result.outAOA.length - 1} 行</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Preview */}
          {previewData.length > 0 && result && (
            <div className="mt-10 pt-8 border-t border-gray-100">
              <h3 className="text-xl font-bold text-gray-900 mb-4">数据预览</h3>
              <p className="text-sm text-gray-500 mb-4">
                最多显示前30行，
                <span className="inline-block w-3 h-3 bg-blue-100 mx-1 rounded-sm border border-blue-200"></span>
                变体类型列以蓝色高亮，
                <span className="inline-block w-3 h-3 bg-yellow-100 mx-1 rounded-sm border border-yellow-200"></span>
                子体额外自然流量列以黄色高亮
              </p>
              
              <div className="overflow-x-auto rounded-lg border border-gray-200 shadow-sm">
                <table className="w-full text-sm text-left">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200">
                      {previewData[0].map((header: any, i: number) => (
                        <th key={i} className="px-4 py-3 font-semibold text-gray-700 whitespace-nowrap">
                          {header}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {previewData.slice(1).map((row, r) => (
                      <tr key={r} className="hover:bg-gray-50 transition-colors">
                        {row.map((cell: any, c: number) => {
                          let className = "px-4 py-3 whitespace-nowrap text-gray-600";
                          if (c >= result.variantColStart && c < result.variantColStart + result.maxVariantCols) {
                            className += " bg-blue-50 text-blue-700 font-medium";
                          } else if (c === result.extraTrafficColIndex) {
                            className += " bg-yellow-50 text-yellow-700 font-medium";
                          }
                          return (
                            <td key={c} className={className}>
                              {cell}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
