'use client'

import React, { useState } from 'react';
import * as XLSX from 'xlsx';
import { Upload, Download, FileSpreadsheet, Loader2, Filter } from 'lucide-react';

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
    success: "bg-gradient-to-r from-green-500 to-green-400 text-white hover:from-green-600 hover:to-green-500 shadow-green-200"
  };
  return <button className={`${baseClass} ${variants[variant]} ${className}`} {...props}>{children}</button>;
};

export default function KeywordStrategyTool() {
  const [formData, setFormData] = useState({
    singleAsinLimit: 10,
    totalAsinLimit: 30,
    headWordsMin: 1,
    headWordsMax: 500,
    midWordsMin: 501,
    midWordsMax: 2000,
    longTailMin: 2001,
    longTailMax: 50000
  });

  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [showResults, setShowResults] = useState(false);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: parseFloat(value) || 0 }));
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setError('');
      // Hide results when new file is selected
      setShowResults(false);
      setResults([]);
    }
  };

  const processData = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) {
      setError('请选择Excel文件');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data);
      const firstSheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[firstSheetName];
      const jsonData: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

      const filteredData: any[] = [];
      const { singleAsinLimit, totalAsinLimit, headWordsMin, headWordsMax, midWordsMin, midWordsMax, longTailMin, longTailMax } = formData;

      for (let i = 1; i < jsonData.length; i++) {
        const row = jsonData[i];
        if (!row || row.length < 20) continue;

        const ranking = row[0];
        const keyword = row[1];
        const asin1Share = parseFloat(row[11]) || 0;
        const asin2Share = parseFloat(row[15]) || 0;
        const asin3Share = parseFloat(row[19]) || 0;

        const maxSingleAsinShare = Math.max(asin1Share, asin2Share, asin3Share);
        const totalAsinShare = asin1Share + asin2Share + asin3Share;

        if (maxSingleAsinShare <= singleAsinLimit && totalAsinShare <= totalAsinLimit) {
          let trafficSize = '';
          if (ranking >= headWordsMin && ranking <= headWordsMax) {
            trafficSize = '头部大词';
          } else if (ranking >= midWordsMin && ranking <= midWordsMax) {
            trafficSize = '中部流量词';
          } else if (ranking >= longTailMin && ranking <= longTailMax) {
            trafficSize = '中长尾词';
          }

          if (trafficSize) {
            filteredData.push({
              ranking,
              keyword,
              trafficSize,
              maxSingleAsinShare: maxSingleAsinShare.toFixed(2),
              totalAsinShare: totalAsinShare.toFixed(2)
            });
          }
        }
      }

      setResults(filteredData);
      setShowResults(true);
      
      // Scroll to results (simple implementation via timeout)
      setTimeout(() => {
        document.getElementById('results-section')?.scrollIntoView({ behavior: 'smooth' });
      }, 100);

    } catch (err) {
      console.error(err);
      setError('文件读取错误，请确保文件格式正确');
    } finally {
      setLoading(false);
    }
  };

  const downloadResults = () => {
    if (results.length === 0) {
      alert('没有数据可下载');
      return;
    }

    const ws = XLSX.utils.json_to_sheet(results.map(item => ({
      '搜索频率排名': item.ranking,
      '搜索词': item.keyword,
      '流量大小': item.trafficSize,
      '最大单个ASIN转化份额': item.maxSingleAsinShare + '%',
      '三个ASIN转化份额总和': item.totalAsinShare + '%'
    })));

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, '筛选结果');
    XLSX.writeFile(wb, `亚马逊关键词筛选结果_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-2 mb-2">
        <Filter className="h-6 w-6 text-indigo-600" />
        <h2 className="text-xl font-bold text-gray-800">亚马逊投放关键词选择策略</h2>
      </div>
      <Card className="p-8 md:p-10">
        <div className="text-center mb-8">
          <p className="text-gray-500 text-sm mb-4">作者公众号：必胜哥的三板斧</p>
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

        <form onSubmit={processData} className="space-y-8">
          {/* ASIN Share Limits */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-800 border-l-4 border-blue-500 pl-3">ASIN转化份额限制</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">单个ASIN转化份额限制</label>
                <Input
                  type="number"
                  name="singleAsinLimit"
                  value={formData.singleAsinLimit}
                  onChange={handleInputChange}
                  min="0"
                  max="100"
                  step="0.1"
                  required
                  placeholder="输入数字"
                />
              </div>
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">三个ASIN转化份额总和限制</label>
                <Input
                  type="number"
                  name="totalAsinLimit"
                  value={formData.totalAsinLimit}
                  onChange={handleInputChange}
                  min="0"
                  max="100"
                  step="0.1"
                  required
                  placeholder="输入数字"
                />
              </div>
            </div>
            <div className="bg-blue-50 border-l-4 border-blue-500 p-4 rounded-r-md">
              <h4 className="font-semibold text-blue-900 text-sm mb-1">说明：</h4>
              <p className="text-sm text-blue-800">
                如果其中单个ASIN的转化份额超过10%，或者三个ASIN的转化份额总和超过30%，这就意味着该关键词具有一定的垄断性。
                可以根据自身产品填写ASIN转化份额的限制，过滤关键词。
              </p>
            </div>
          </div>

          {/* Keyword Classification */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-800 border-l-4 border-blue-500 pl-3">关键词分类范围</h3>
            
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">头部大词 ABA排名范围</label>
                <div className="flex items-center gap-3">
                  <Input type="number" name="headWordsMin" value={formData.headWordsMin} onChange={handleInputChange} min="0" required />
                  <span className="text-gray-400">至</span>
                  <Input type="number" name="headWordsMax" value={formData.headWordsMax} onChange={handleInputChange} min="0" required />
                </div>
              </div>

              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">中部流量词 ABA排名范围</label>
                <div className="flex items-center gap-3">
                  <Input type="number" name="midWordsMin" value={formData.midWordsMin} onChange={handleInputChange} min="0" required />
                  <span className="text-gray-400">至</span>
                  <Input type="number" name="midWordsMax" value={formData.midWordsMax} onChange={handleInputChange} min="0" required />
                </div>
              </div>

              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">中长尾词 ABA排名范围</label>
                <div className="flex items-center gap-3">
                  <Input type="number" name="longTailMin" value={formData.longTailMin} onChange={handleInputChange} min="0" required />
                  <span className="text-gray-400">至</span>
                  <Input type="number" name="longTailMax" value={formData.longTailMax} onChange={handleInputChange} min="0" required />
                </div>
              </div>
            </div>

            <div className="bg-blue-50 border-l-4 border-blue-500 p-4 rounded-r-md">
              <h4 className="font-semibold text-blue-900 text-sm mb-1">说明：</h4>
              <p className="text-sm text-blue-800">
                根据自己的产品，定义什么词是头部词，中部词，中长尾词，更加精准划分关键词流量大小。
                可以根据自身产品填写ABA的范围定义关键词的流量大小。
              </p>
            </div>
          </div>

          {/* File Upload */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-800 border-l-4 border-blue-500 pl-3">上传热门搜索词表格</h3>
            <div className="relative group">
              <input
                type="file"
                id="excelFile"
                accept=".xlsx,.xls"
                onChange={handleFileChange}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
              />
              <div className={`border-2 border-dashed rounded-xl p-8 text-center transition-all ${file ? 'border-green-500 bg-green-50' : 'border-gray-300 bg-gray-50 group-hover:border-blue-500 group-hover:bg-blue-50'}`}>
                <FileSpreadsheet className={`w-10 h-10 mx-auto mb-3 ${file ? 'text-green-500' : 'text-gray-400'}`} />
                <p className={`text-sm font-medium ${file ? 'text-green-700' : 'text-gray-600'}`}>
                  {file ? `已选择: ${file.name}` : '点击选择或拖拽 Excel 文件到此处'}
                </p>
                {!file && <p className="text-xs text-gray-400 mt-1">支持 .xlsx, .xls 格式</p>}
              </div>
            </div>
            {error && <p className="text-red-500 text-sm text-center font-medium">{error}</p>}
          </div>

          <div className="flex justify-center pt-4">
            <Button type="submit" disabled={loading} className="w-full md:w-auto min-w-[200px]">
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  正在分析...
                </>
              ) : (
                '开始分析'
              )}
            </Button>
          </div>
        </form>
      </Card>

      {/* Results Section */}
      {showResults && (
        <Card id="results-section" className="p-8 md:p-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="text-center mb-6">
            <h3 className="text-2xl font-bold text-gray-900">分析结果</h3>
            <p className="text-gray-600 mt-2">共筛选出 <strong className="text-blue-600">{results.length}</strong> 个符合条件的关键词</p>
          </div>

          <div className="overflow-x-auto rounded-lg border border-gray-200 mb-8">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-white uppercase bg-gradient-to-r from-blue-600 to-blue-500">
                <tr>
                  <th className="px-6 py-4">搜索频率排名</th>
                  <th className="px-6 py-4">搜索词</th>
                  <th className="px-6 py-4">流量大小</th>
                  <th className="px-6 py-4">最大单个ASIN转化份额</th>
                  <th className="px-6 py-4">三个ASIN转化份额总和</th>
                </tr>
              </thead>
              <tbody>
                {results.slice(0, 100).map((item, index) => (
                  <tr key={index} className="bg-white border-b hover:bg-gray-50">
                    <td className="px-6 py-4 font-medium text-gray-900">{item.ranking}</td>
                    <td className="px-6 py-4">{item.keyword}</td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium
                        ${item.trafficSize === '头部大词' ? 'bg-purple-100 text-purple-800' :
                          item.trafficSize === '中部流量词' ? 'bg-blue-100 text-blue-800' :
                          'bg-green-100 text-green-800'}`}>
                        {item.trafficSize}
                      </span>
                    </td>
                    <td className="px-6 py-4">{item.maxSingleAsinShare}%</td>
                    <td className="px-6 py-4">{item.totalAsinShare}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {results.length > 100 && (
              <div className="text-center py-4 text-sm text-gray-500 bg-gray-50 border-t">
                仅显示前 100 条数据，完整数据请下载 Excel 表格
              </div>
            )}
          </div>

          <div className="flex justify-center">
            <Button variant="success" onClick={downloadResults} className="w-full md:w-auto min-w-[200px]">
              <Download className="w-4 h-4" />
              下载结果表格
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
}
