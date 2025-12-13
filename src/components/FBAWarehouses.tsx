'use client';

import React, { useState, useEffect, useMemo } from 'react';
import rawData from './fba_warehouses_data.json';
import { Copy, RotateCcw, Warehouse } from 'lucide-react';

interface WarehouseData {
  "国家": string;
  "地区": string;
  "Code": string;
  "地址": string;
  "城市": string;
  "洲/省": string;
  "邮编": string;
}

const ITEMS_PER_PAGE = 15;

const FBAWarehouses = () => {
  // Filter out unwanted countries
  const cleanData = useMemo(() => {
    return (rawData as WarehouseData[]).filter(d => d['国家'] !== 'AE' && d['国家'] !== 'CE' && d['国家'] !== 'CZ');
  }, []);

  // State
  const [data, setData] = useState<WarehouseData[]>(cleanData);
  const [filteredData, setFilteredData] = useState<WarehouseData[]>(cleanData);
  const [currentPage, setCurrentPage] = useState(1);
  const [sortCol, setSortCol] = useState<keyof WarehouseData | ''>('');
  const [sortAsc, setSortAsc] = useState(true);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Filters
  const [countryFilter, setCountryFilter] = useState('');
  const [regionFilter, setRegionFilter] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [remoteFilter, setRemoteFilter] = useState(false);

  // Derived lists for selects
  const countries = useMemo(() => Array.from(new Set(cleanData.map((d: any) => d['国家']))).sort(), [cleanData]);
  const regions = useMemo(() => Array.from(new Set(cleanData.map((d: any) => d['地区']))).sort(), [cleanData]);

  // Filter Logic
  useEffect(() => {
    let res = cleanData;

    if (countryFilter) {
      res = res.filter(d => d['国家'] === countryFilter);
    }
    if (regionFilter) {
      res = res.filter(d => d['地区'] === regionFilter);
    }
    if (remoteFilter) {
      res = res.filter(d => (d['Code'] || '').includes('偏远'));
    }
    if (searchInput) {
      const lowerSearch = searchInput.toLowerCase().trim();
      res = res.filter(d => {
        const code = (d['Code'] || '').toString().toLowerCase();
        const address = (d['地址'] || '').toString().toLowerCase();
        const zip = (d['邮编'] || '').toString().toLowerCase();
        return code.includes(lowerSearch) || address.includes(lowerSearch) || zip.includes(lowerSearch);
      });
    }

    // Sort
    if (sortCol) {
      res.sort((a, b) => {
        const valA = (a[sortCol] || '').toString().toLowerCase();
        const valB = (b[sortCol] || '').toString().toLowerCase();
        if (valA < valB) return sortAsc ? -1 : 1;
        if (valA > valB) return sortAsc ? 1 : -1;
        return 0;
      });
    }

    setFilteredData(res);
    setCurrentPage(1); // Reset to page 1 on filter change
  }, [countryFilter, regionFilter, searchInput, remoteFilter, sortCol, sortAsc]);

  // Pagination Logic
  const totalPages = Math.ceil(filteredData.length / ITEMS_PER_PAGE);
  const paginatedData = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredData.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredData, currentPage]);

  const handleSort = (col: keyof WarehouseData) => {
    if (sortCol === col) {
      setSortAsc(!sortAsc);
    } else {
      setSortCol(col);
      setSortAsc(true);
    }
  };

  const handleReset = () => {
    setCountryFilter('');
    setRegionFilter('');
    setSearchInput('');
    setRemoteFilter(false);
  };

  const copyText = (text: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text).then(() => {
      setToastMessage(`已复制: ${text}`);
      setTimeout(() => setToastMessage(null), 2000);
    }).catch(err => {
      console.error('无法复制', err);
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 mb-2">
        <Warehouse className="h-6 w-6 text-blue-600" />
        <h2 className="text-xl font-bold text-gray-800">FBA 仓库数据查询</h2>
      </div>

      <div className="w-full max-w-[1400px] mx-auto bg-white p-5 rounded-lg shadow-[0_2px_10px_rgba(0,0,0,0.1)] font-sans text-[#333]">

      {/* Controls */}
      <div className="flex flex-wrap gap-4 mb-5 p-5 bg-[#f8f9fa] rounded-md border border-[#e9ecef] items-end">
        <div className="flex flex-col flex-1 min-w-[150px]">
          <label className="mb-1.5 font-semibold text-[0.9em] color-[#555] cursor-pointer">国家筛选</label>
          <select 
            value={countryFilter} 
            onChange={(e) => setCountryFilter(e.target.value)}
            className="p-2.5 border border-[#ddd] rounded text-sm w-full focus:border-[#4a90e2] focus:outline-none focus:shadow-[0_0_0_2px_rgba(74,144,226,0.2)] transition-colors"
          >
            <option value="">全部国家</option>
            {countries.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>

        <div className="flex flex-col flex-1 min-w-[150px]">
          <label className="mb-1.5 font-semibold text-[0.9em] color-[#555] cursor-pointer">地区筛选</label>
          <select 
            value={regionFilter} 
            onChange={(e) => setRegionFilter(e.target.value)}
            className="p-2.5 border border-[#ddd] rounded text-sm w-full focus:border-[#4a90e2] focus:outline-none focus:shadow-[0_0_0_2px_rgba(74,144,226,0.2)] transition-colors"
          >
            <option value="">全部地区</option>
            {regions.map(r => <option key={r} value={r}>{r}</option>)}
          </select>
        </div>

        <div className="flex flex-col flex-[2] min-w-[200px]">
          <label className="mb-1.5 font-semibold text-[0.9em] color-[#555] cursor-pointer">搜索 (仓库代码 / 地址 / 邮编)</label>
          <input 
            type="text" 
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="输入关键词搜索..." 
            className="p-2.5 border border-[#ddd] rounded text-sm w-full focus:border-[#4a90e2] focus:outline-none focus:shadow-[0_0_0_2px_rgba(74,144,226,0.2)] transition-colors"
          />
        </div>

        <div className="flex items-center min-w-[150px] pb-2.5 cursor-pointer">
          <input 
            type="checkbox" 
            id="remoteFilter"
            checked={remoteFilter}
            onChange={(e) => setRemoteFilter(e.target.checked)}
            className="w-auto mr-2.5 scale-125 cursor-pointer"
          />
          <label htmlFor="remoteFilter" className="font-semibold text-[0.9em] color-[#555] cursor-pointer select-none">仅显示偏远地区</label>
        </div>

        <div className="flex gap-2.5 items-end pb-[1px]">
          <button 
            onClick={handleReset}
            className="px-5 py-2.5 border border-[#ced4da] rounded cursor-pointer text-sm transition-all h-[38px] whitespace-nowrap font-medium bg-[#f1f3f5] text-[#495057] hover:bg-[#e2e6ea] hover:border-[#adb5bd] flex items-center gap-1"
          >
             ↺ 重置筛选
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="mt-2.5 text-[0.9em] text-[#6c757d] text-right flex justify-between items-center mb-2">
        <span>{filteredData.length === 0 ? '没有找到匹配的记录' : `显示 ${filteredData.length} 条记录 (共 ${cleanData.length} 条)`}</span>
        <span className="text-[0.9em] text-[#666] font-medium">💡 提示：点击表格中的 <span className="text-[#4a90e2]">[仓库代码]</span> 或 <span className="text-[#4a90e2]">[地址]</span> 即可复制</span>
      </div>

      {/* Table */}
      <div className="w-full overflow-x-auto shadow-[0_1px_3px_rgba(0,0,0,0.1)] rounded-sm">
        <table className="w-full border-collapse">
          <thead>
            <tr>
              {['国家', '地区', 'Code', '地址', '城市', '洲/省', '邮编'].map((col) => (
                <th 
                  key={col}
                  onClick={() => handleSort(col as keyof WarehouseData)}
                  className="p-3 text-left border-b border-[#eee] bg-[#f8f9fa] text-[#495057] font-semibold sticky top-0 cursor-pointer select-none hover:bg-[#e9ecef] transition-colors whitespace-nowrap"
                >
                  {col === 'Code' ? '仓库代码' : col}
                  {col === 'Code' || col === '地址' ? <small className="font-normal text-[#888] ml-1">(点击复制)</small> : null}
                  <span className="float-right text-[#ccc] text-xs ml-1">
                    {sortCol === col ? (sortAsc ? '↑' : '↓') : '↕'}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {paginatedData.length > 0 ? (
              paginatedData.map((row, idx) => {
                const isRemote = row['Code'].includes('偏远');
                return (
                  <tr key={idx} className="hover:bg-[#f1f3f5] border-b border-[#eee]">
                    <td className="p-3">{row['国家']}</td>
                    <td className="p-3">{row['地区']}</td>
                    <td 
                      className="p-3 cursor-pointer relative group"
                      onClick={() => copyText(row['Code'])}
                      title="点击复制"
                    >
                      {isRemote ? <span className="text-[#e74c3c] font-bold">{row['Code']}</span> : <strong>{row['Code']}</strong>}
                      <span className="hidden group-hover:block absolute right-[5px] top-1/2 -translate-y-1/2 bg-[#333] text-white px-1.5 py-0.5 rounded text-[10px] opacity-80">复制</span>
                    </td>
                    <td 
                      className="p-3 cursor-pointer relative group max-w-xs truncate"
                      onClick={() => copyText(row['地址'])}
                      title={row['地址']}
                    >
                      {row['地址']}
                      <span className="hidden group-hover:block absolute right-[5px] top-1/2 -translate-y-1/2 bg-[#333] text-white px-1.5 py-0.5 rounded text-[10px] opacity-80">复制</span>
                    </td>
                    <td className="p-3">{row['城市']}</td>
                    <td className="p-3">{row['洲/省']}</td>
                    <td className="p-3">{row['邮编']}</td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan={7} className="text-center p-8 text-[#999]">没有找到匹配的记录</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {filteredData.length > 0 && (
        <div className="flex justify-center items-center mt-5 gap-4">
          <button 
            onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
            disabled={currentPage <= 1}
            className="px-4 py-2 bg-white border border-[#ddd] rounded cursor-pointer transition-all hover:bg-[#f1f3f5] hover:border-[#cacedb] disabled:text-[#ccc] disabled:cursor-not-allowed disabled:bg-[#fafafa]"
          >
            上一页
          </button>
          <span className="text-[#666] text-[0.9em]">第 {currentPage} / {totalPages || 1} 页</span>
          <button 
            onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
            disabled={currentPage >= totalPages}
            className="px-4 py-2 bg-white border border-[#ddd] rounded cursor-pointer transition-all hover:bg-[#f1f3f5] hover:border-[#cacedb] disabled:text-[#ccc] disabled:cursor-not-allowed disabled:bg-[#fafafa]"
          >
            下一页
          </button>
        </div>
      )}

      {/* Toast */}
      {toastMessage && (
        <div className="fixed left-1/2 bottom-[50px] -ml-[125px] min-w-[250px] bg-[#333] text-white text-center rounded p-4 z-50 animate-fade-in-up shadow-lg">
          {toastMessage}
        </div>
      )}
      </div>
    </div>
  );
};

export default FBAWarehouses;
