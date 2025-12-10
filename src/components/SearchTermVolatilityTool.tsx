'use client'

import React, { useState } from 'react';
import { Upload, FileText, Activity, Trash2, Download, Search, TrendingUp, TrendingDown, Minus, Plus } from 'lucide-react';

const Card = ({ children, className = "", ...props }: any) => (
  <div className={`bg-white rounded-xl border border-gray-100 shadow-sm ${className}`} {...props}>{children}</div>
);

const Input = ({ className = "", ...props }: any) => (
  <input className={`flex h-10 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm transition-all focus:border-blue-500 focus:ring-2 focus:ring-blue-200 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50 ${className}`} {...props} />
);

const Button = ({ children, className = "", variant = "primary", ...props }: any) => {
  const baseClass = "px-6 py-2.5 rounded-full text-sm font-semibold flex items-center justify-center gap-2 transition-all transform active:scale-95 shadow-sm cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed";
  const variants: any = {
    primary: "bg-gradient-to-r from-blue-600 to-blue-500 text-white hover:from-blue-700 hover:to-blue-600 shadow-blue-200",
    success: "bg-gradient-to-r from-green-500 to-green-400 text-white hover:from-green-600 hover:to-green-500 shadow-green-200",
    danger: "bg-red-50 text-red-600 hover:bg-red-100 border border-red-200"
  };
  return <button className={`${baseClass} ${variants[variant]} ${className}`} {...props}>{children}</button>;
};

export default function SearchTermVolatilityTool() {
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  const [thresholds, setThresholds] = useState({
    aba: 20,
    click: 20,
    convert: 20
  });
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<any[]>([]);
  const [summary, setSummary] = useState<any>(null);
  const [dates, setDates] = useState({ old: '', new: '' });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newFiles = Array.from(e.target.files);
      setUploadedFiles(prev => [...prev, ...newFiles]);
      // Reset results when files change
      setResults([]);
      setSummary(null);
    }
  };

  const removeFile = (index: number) => {
    setUploadedFiles(prev => prev.filter((_, i) => i !== index));
    setResults([]);
    setSummary(null);
  };

  const parseCSVLine = (line: string) => {
    const result = [];
    let current = '';
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        result.push(current);
        current = '';
      } else {
        current += char;
      }
    }
    result.push(current);
    return result;
  };

  const parseCSV = (file: File): Promise<{ data: any[], date: string }> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = function(e) {
        try {
          const text = e.target?.result as string;
          const lines = text.split('\n').filter(line => line.trim());
          
          // Delete first line
          lines.shift();
          
          if (lines.length < 2) {
            reject(new Error('CSV文件格式不正确'));
            return;
          }

          const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
          const data = [];
          
          for (let i = 1; i < lines.length; i++) {
            const values = parseCSVLine(lines[i]);
            const row: any = {};
            
            headers.forEach((header, index) => {
              row[header] = values[index] ? values[index].trim().replace(/"/g, '') : '';
            });
            
            // Calculate sum of top 3 shares
            const click1 = parseFloat(row['点击量最高的商品 #1：点击份额']) || 0;
            const click2 = parseFloat(row['点击量最高的商品 #2：点击份额']) || 0;
            const click3 = parseFloat(row['点击量最高的商品 #3：点击份额']) || 0;
            row['前三点击份额之和'] = click1 + click2 + click3;
            
            const convert1 = parseFloat(row['点击量最高的商品 #1：转化份额']) || 0;
            const convert2 = parseFloat(row['点击量最高的商品 #2：转化份额']) || 0;
            const convert3 = parseFloat(row['点击量最高的商品 #3：转化份额']) || 0;
            row['前三转化份额之和'] = convert1 + convert2 + convert3;
            
            data.push(row);
          }
          
          // Get report date
          const date = data[0]['报告日期'] || '';
          
          resolve({ data, date });
        } catch (error) {
          reject(error);
        }
      };
      reader.onerror = () => reject(new Error('文件读取失败'));
      reader.readAsText(file, 'UTF-8');
    });
  };

  const performAnalysis = (oldData: any, newData: any, abaThreshold: number, clickThreshold: number, convertThreshold: number) => {
    const results: any[] = [];
    const oldMap = new Map();
    const newMap = new Map();
    
    oldData.data.forEach((row: any) => {
      oldMap.set(row['搜索词'], row);
    });
    
    newData.data.forEach((row: any) => {
      newMap.set(row['搜索词'], row);
    });
    
    // Check new search terms
    newMap.forEach((row, keyword) => {
      if (!oldMap.has(keyword)) {
        results.push({
          tags: ['新增搜索词'],
          keyword: keyword,
          oldRank: '-',
          newRank: row['搜索频率排名'],
          oldClick: '-',
          newClick: row['前三点击份额之和'].toFixed(2),
          oldConvert: '-',
          newConvert: row['前三转化份额之和'].toFixed(2)
        });
      }
    });
    
    // Check lost search terms
    oldMap.forEach((row, keyword) => {
      if (!newMap.has(keyword)) {
        results.push({
          tags: ['丢失搜索词'],
          keyword: keyword,
          oldRank: row['搜索频率排名'],
          newRank: '-',
          oldClick: row['前三点击份额之和'].toFixed(2),
          newClick: '-',
          oldConvert: row['前三转化份额之和'].toFixed(2),
          newConvert: '-'
        });
      }
    });
    
    // Check common search terms changes
    oldMap.forEach((oldRow, keyword) => {
      if (newMap.has(keyword)) {
        const newRow = newMap.get(keyword);
        const tags: string[] = [];
        
        const oldRank = parseFloat(oldRow['搜索频率排名']) || 0;
        const newRank = parseFloat(newRow['搜索频率排名']) || 0;
        const oldClick = oldRow['前三点击份额之和'] || 0;
        const newClick = newRow['前三点击份额之和'] || 0;
        const oldConvert = oldRow['前三转化份额之和'] || 0;
        const newConvert = newRow['前三转化份额之和'] || 0;
        
        // ABA Rank Change
        if (oldRank > 0) {
          const abaChange = (newRank - oldRank) / oldRank;
          if (Math.abs(abaChange) > abaThreshold) {
            if (abaChange < 0) {
              tags.push('ABA大幅上涨');
            } else {
              tags.push('ABA大幅下跌');
            }
          }
        }
        
        // Click Share Change
        if (oldClick > 0) {
          const clickChange = (newClick - oldClick) / oldClick;
          if (Math.abs(clickChange) > clickThreshold) {
            if (clickChange < 0) {
              tags.push('前三点击份额下降');
            } else {
              tags.push('前三点击份额上涨');
            }
          }
        }
        
        // Conversion Share Change
        if (oldConvert > 0) {
          const convertChange = (newConvert - oldConvert) / oldConvert;
          if (Math.abs(convertChange) > convertThreshold) {
            if (convertChange < 0) {
              tags.push('前三转化份额下降');
            } else {
              tags.push('前三转化份额上涨');
            }
          }
        }
        
        if (tags.length > 0) {
          results.push({
            tags: tags,
            keyword: keyword,
            oldRank: oldRank,
            newRank: newRank,
            oldClick: oldClick.toFixed(2),
            newClick: newClick.toFixed(2),
            oldConvert: oldConvert.toFixed(2),
            newConvert: newConvert.toFixed(2)
          });
        }
      }
    });
    
    return results;
  };

  const handleAnalyze = async () => {
    if (uploadedFiles.length < 2) {
      alert('请至少上传2个CSV文件进行对比分析');
      return;
    }

    setLoading(true);
    try {
      const allData = await Promise.all(uploadedFiles.map(file => parseCSV(file)));
      
      // Sort by date
      allData.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
      
      const oldData = allData[0];
      const newData = allData[allData.length - 1];

      setDates({
        old: oldData.date,
        new: newData.date
      });

      const analysisResults = performAnalysis(
        oldData, 
        newData, 
        thresholds.aba / 100, 
        thresholds.click / 100, 
        thresholds.convert / 100
      );
      
      setResults(analysisResults);
      
      // Generate summary
      setSummary({
        new: analysisResults.filter(r => r.tags.includes('新增搜索词')).length,
        lost: analysisResults.filter(r => r.tags.includes('丢失搜索词')).length,
        abaUp: analysisResults.filter(r => r.tags.includes('ABA大幅上涨')).length,
        abaDown: analysisResults.filter(r => r.tags.includes('ABA大幅下跌')).length,
        clickUp: analysisResults.filter(r => r.tags.includes('前三点击份额上涨')).length,
        clickDown: analysisResults.filter(r => r.tags.includes('前三点击份额下降')).length,
        convertUp: analysisResults.filter(r => r.tags.includes('前三转化份额上涨')).length,
        convertDown: analysisResults.filter(r => r.tags.includes('前三转化份额下降')).length,
        total: analysisResults.length
      });
      
    } catch (error: any) {
      alert('分析过程中出错: ' + error.message);
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const exportCSV = () => {
    if (results.length === 0) return;
    
    let csv = '\ufeff'; // UTF-8 BOM
    csv += `输出标记,搜索词,${dates.old}-搜索频率排名,${dates.new}-搜索频率排名,${dates.old}-前三点击份额,${dates.new}-前三点击份额,${dates.old}-前三转化份额,${dates.new}-前三转化份额\n`;
    
    results.forEach(result => {
      csv += `"${result.tags.join(', ')}","${result.keyword}",${result.oldRank},${result.newRank},${result.oldClick},${result.newClick},${result.oldConvert},${result.newConvert}\n`;
    });
    
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `分析结果_${new Date().toISOString().slice(0,10)}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const getTagColor = (tag: string) => {
    if (tag === '新增搜索词' || tag === 'ABA大幅上涨') return 'bg-green-100 text-green-800';
    if (tag === '丢失搜索词' || tag === 'ABA大幅下跌' || tag === '前三转化份额下降') return 'bg-red-100 text-red-800';
    if (tag === '前三点击份额上涨') return 'bg-cyan-100 text-cyan-800';
    if (tag === '前三点击份额下降') return 'bg-yellow-100 text-yellow-800';
    if (tag === '前三转化份额上涨') return 'bg-purple-100 text-purple-800';
    return 'bg-gray-100 text-gray-800';
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex items-center gap-2 mb-2">
        <Activity className="h-6 w-6 text-purple-600" />
        <h2 className="text-xl font-bold text-gray-800">快速查询波动率高的搜索词</h2>
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

        <div className="space-y-8">
          {/* Upload Section */}
          <div className="bg-slate-50 border-2 border-dashed border-purple-200 rounded-xl p-8 text-center transition-all hover:border-purple-300 hover:bg-slate-100">
            <h3 className="text-lg font-semibold text-gray-700 mb-4 flex items-center justify-center gap-2">
              <FileText className="h-5 w-5 text-purple-600" />
              上传CSV文件
            </h3>
            <div className="relative inline-block">
              <input 
                type="file" 
                id="csvFiles" 
                accept=".csv" 
                multiple 
                onChange={handleFileChange}
                className="hidden" 
              />
              <label 
                htmlFor="csvFiles" 
                className="inline-flex items-center gap-2 px-8 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 cursor-pointer shadow-md hover:shadow-lg transition-all transform hover:-translate-y-0.5"
              >
                <Upload className="h-5 w-5" />
                选择CSV文件
              </label>
            </div>
            
            {uploadedFiles.length > 0 && (
              <div className="mt-6 space-y-2 max-w-md mx-auto">
                {uploadedFiles.map((file, index) => (
                  <div key={index} className="flex items-center justify-between bg-white p-3 rounded-lg border border-gray-200 shadow-sm">
                    <span className="text-sm text-gray-600 truncate flex-1 text-left flex items-center gap-2">
                      <FileText className="h-4 w-4 text-gray-400" />
                      {file.name} 
                      <span className="text-xs text-gray-400">({(file.size / 1024).toFixed(2)} KB)</span>
                    </span>
                    <button 
                      onClick={() => removeFile(index)}
                      className="text-red-500 hover:text-red-700 p-1 hover:bg-red-50 rounded-full transition-colors"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Thresholds Input */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-gray-50 p-6 rounded-xl border border-gray-100">
              <label className="block text-sm font-semibold text-gray-700 mb-2">ABA排名变化比例</label>
              <div className="flex items-center">
                <Input 
                  type="number" 
                  value={thresholds.aba} 
                  onChange={(e: any) => setThresholds(prev => ({ ...prev, aba: parseFloat(e.target.value) || 0 }))}
                  className="rounded-r-none border-r-0"
                />
                <div className="bg-purple-600 text-white px-4 py-2 rounded-r-md text-sm font-semibold flex items-center h-10">%</div>
              </div>
            </div>
            <div className="bg-gray-50 p-6 rounded-xl border border-gray-100">
              <label className="block text-sm font-semibold text-gray-700 mb-2">前三点击份额变化比例</label>
              <div className="flex items-center">
                <Input 
                  type="number" 
                  value={thresholds.click} 
                  onChange={(e: any) => setThresholds(prev => ({ ...prev, click: parseFloat(e.target.value) || 0 }))}
                  className="rounded-r-none border-r-0"
                />
                <div className="bg-purple-600 text-white px-4 py-2 rounded-r-md text-sm font-semibold flex items-center h-10">%</div>
              </div>
            </div>
            <div className="bg-gray-50 p-6 rounded-xl border border-gray-100">
              <label className="block text-sm font-semibold text-gray-700 mb-2">前三转化额变化比例</label>
              <div className="flex items-center">
                <Input 
                  type="number" 
                  value={thresholds.convert} 
                  onChange={(e: any) => setThresholds(prev => ({ ...prev, convert: parseFloat(e.target.value) || 0 }))}
                  className="rounded-r-none border-r-0"
                />
                <div className="bg-purple-600 text-white px-4 py-2 rounded-r-md text-sm font-semibold flex items-center h-10">%</div>
              </div>
            </div>
          </div>

          <Button 
            onClick={handleAnalyze} 
            disabled={uploadedFiles.length < 2 || loading}
            className="w-full h-12 text-lg bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 shadow-purple-200"
          >
            {loading ? '分析中...' : '开始分析'}
          </Button>

          {/* Results Section */}
          {results.length > 0 && summary && (
            <div className="space-y-6 animate-fade-in">
              <div className="flex justify-end">
                <Button variant="success" onClick={exportCSV}>
                  <Download className="h-4 w-4" />
                  导出为CSV
                </Button>
              </div>

              <div className="bg-blue-50 border-l-4 border-purple-600 p-6 rounded-r-xl space-y-3">
                <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                  <Activity className="h-5 w-5 text-purple-600" />
                  分析摘要
                </h3>
                <p className="text-sm text-gray-600"><strong>对比时间段：</strong>{dates.old} → {dates.new}</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                  <div className="space-y-2">
                    <p className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-green-500"></span>新增搜索词: {summary.new} 个</p>
                    <p className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-red-500"></span>丢失搜索词: {summary.lost} 个</p>
                    <p className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-green-600"></span>ABA大幅上涨: {summary.abaUp} 个</p>
                    <p className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-red-600"></span>ABA大幅下跌: {summary.abaDown} 个</p>
                  </div>
                  <div className="space-y-2">
                    <p className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-cyan-600"></span>前三点击份额上涨: {summary.clickUp} 个</p>
                    <p className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-yellow-600"></span>前三点击份额下降: {summary.clickDown} 个</p>
                    <p className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-purple-600"></span>前三转化份额上涨: {summary.convertUp} 个</p>
                    <p className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-red-400"></span>前三转化份额下降: {summary.convertDown} 个</p>
                  </div>
                </div>
                <p className="font-semibold text-gray-700 mt-2">共发现 {summary.total} 个需要关注的搜索词</p>
              </div>

              <div className="overflow-x-auto border border-gray-200 rounded-xl shadow-sm">
                <table className="w-full text-sm text-left">
                  <thead className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white">
                    <tr>
                      <th className="px-4 py-3 whitespace-nowrap">输出标记</th>
                      <th className="px-4 py-3 whitespace-nowrap">搜索词</th>
                      <th className="px-4 py-3 whitespace-nowrap">{dates.old}-搜索频率排名</th>
                      <th className="px-4 py-3 whitespace-nowrap">{dates.new}-搜索频率排名</th>
                      <th className="px-4 py-3 whitespace-nowrap">{dates.old}-前三点击份额</th>
                      <th className="px-4 py-3 whitespace-nowrap">{dates.new}-前三点击份额</th>
                      <th className="px-4 py-3 whitespace-nowrap">{dates.old}-前三转化份额</th>
                      <th className="px-4 py-3 whitespace-nowrap">{dates.new}-前三转化份额</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 bg-white">
                    {results.map((result, idx) => (
                      <tr key={idx} className="hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap gap-1">
                            {result.tags.map((tag: string, tIdx: number) => (
                              <span key={tIdx} className={`px-2 py-0.5 rounded-full text-xs font-medium ${getTagColor(tag)}`}>
                                {tag}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td className="px-4 py-3 font-medium text-gray-900">{result.keyword}</td>
                        <td className="px-4 py-3 text-gray-600">{result.oldRank}</td>
                        <td className="px-4 py-3 text-gray-600">{result.newRank}</td>
                        <td className="px-4 py-3 text-gray-600">{result.oldClick}</td>
                        <td className="px-4 py-3 text-gray-600">{result.newClick}</td>
                        <td className="px-4 py-3 text-gray-600">{result.oldConvert}</td>
                        <td className="px-4 py-3 text-gray-600">{result.newConvert}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
