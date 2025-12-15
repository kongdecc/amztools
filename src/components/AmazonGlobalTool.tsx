'use client'

import React, { useState } from 'react';
import { Search, ExternalLink, Globe, Package, Map, History, Trash2 } from 'lucide-react';

// 亚马逊全球站点数据结构
const REGIONS = {
  "北美/南美": [
    { code: 'US', name: '美国', url: 'https://www.amazon.com' },
    { code: 'CA', name: '加拿大', url: 'https://www.amazon.ca' },
    { code: 'MX', name: '墨西哥', url: 'https://www.amazon.com.mx' },
    { code: 'BR', name: '巴西', url: 'https://www.amazon.com.br' },
  ],
  "欧洲": [
    { code: 'UK', name: '英国', url: 'https://www.amazon.co.uk' },
    { code: 'DE', name: '德国', url: 'https://www.amazon.de' },
    { code: 'FR', name: '法国', url: 'https://www.amazon.fr' },
    { code: 'IT', name: '意大利', url: 'https://www.amazon.it' },
    { code: 'ES', name: '西班牙', url: 'https://www.amazon.es' },
    { code: 'NL', name: '荷兰', url: 'https://www.amazon.nl' },
    { code: 'SE', name: '瑞典', url: 'https://www.amazon.se' },
    { code: 'PL', name: '波兰', url: 'https://www.amazon.pl' },
    { code: 'BE', name: '比利时', url: 'https://www.amazon.com.be' },
    { code: 'TR', name: '土耳其', url: 'https://www.amazon.com.tr' },
  ],
  "亚洲/澳洲": [
    { code: 'JP', name: '日本', url: 'https://www.amazon.co.jp' },
    { code: 'AU', name: '澳大利亚', url: 'https://www.amazon.com.au' },
    { code: 'IN', name: '印度', url: 'https://www.amazon.in' },
    { code: 'SG', name: '新加坡', url: 'https://www.amazon.sg' },
  ],
  "中东/非洲": [
    { code: 'AE', name: '阿联酋', url: 'https://www.amazon.ae' },
    { code: 'SA', name: '沙特', url: 'https://www.amazon.sa' },
    { code: 'EG', name: '埃及', url: 'https://www.amazon.eg' },
    // { code: 'ZA', name: '南非', url: 'https://www.amazon.co.za' }, // 新站点，暂保留
  ]
};

// 扁平化所有站点用于搜索
const ALL_SITES = Object.values(REGIONS).flat();

const AmazonGlobalTool = () => {
  const [activeTab, setActiveTab] = useState('keyword');
  
  // --- Keyword Mode State ---
  const [kwDomain, setKwDomain] = useState('https://www.amazon.com');
  const [keywords, setKeywords] = useState('');
  const [kwResults, setKwResults] = useState<{text: string, url: string}[]>([]);
  const [searchHistory, setSearchHistory] = useState<string[]>([]);

  // Load history on mount
  React.useEffect(() => {
    const saved = localStorage.getItem('amz_global_search_history');
    if (saved) {
      try {
        setSearchHistory(JSON.parse(saved));
      } catch (e) {
        console.error('Failed to parse history', e);
      }
    }
  }, []);

  const saveToHistory = (input: string) => {
    const lines = input.split('\n').map(l => l.trim()).filter(l => l);
    if (lines.length === 0) return;

    setSearchHistory(prev => {
      const next = [...lines, ...prev];
      const unique = Array.from(new Set(next));
      const limited = unique.slice(0, 20);
      localStorage.setItem('amz_global_search_history', JSON.stringify(limited));
      return limited;
    });
  };

  const clearHistory = () => {
    if (window.confirm('确定要清空历史记录吗？')) {
      setSearchHistory([]);
      localStorage.removeItem('amz_global_search_history');
    }
  };

  const useHistoryItem = (item: string) => {
    setKeywords(prev => {
      const cleanPrev = prev.trim();
      if (!cleanPrev) return item;
      if (cleanPrev.split('\n').map(l => l.trim()).includes(item)) return prev;
      return cleanPrev + '\n' + item;
    });
  };

  // --- ASIN Mode State ---
  const [asins, setAsins] = useState('');
  const [asinResults, setAsinResults] = useState<string[]>([]);
  const [selectedRegions, setSelectedRegions] = useState<string[]>(['北美/南美', '欧洲', '亚洲/澳洲', '中东/非洲']);

  // --- Handlers: Keyword ---
  const generateKeywords = () => {
    if (!keywords.trim()) return;
    
    saveToHistory(keywords);

    const lines = keywords.split('\n').filter(line => line.trim() !== '');
    const links = lines.map(line => {
      const clean = line.trim();
      return {
        text: clean,
        url: `${kwDomain}/s?k=${encodeURIComponent(clean).replace(/%20/g, '+')}`
      };
    });
    setKwResults(links);
  };

  // --- Handlers: ASIN ---
  const generateAsins = () => {
    if (!asins.trim()) return;
    const lines = asins.split('\n').filter(line => line.trim() !== '').map(l => l.trim().toUpperCase());
    setAsinResults(lines);
  };

  const toggleRegion = (regionName: string) => {
    setSelectedRegions(prev => 
      prev.includes(regionName) 
        ? prev.filter(r => r !== regionName)
        : [...prev, regionName]
    );
  };

  const getSelectedSites = () => {
    let sites: any[] = [];
    selectedRegions.forEach(region => {
      if (REGIONS[region as keyof typeof REGIONS]) {
        sites = [...sites, ...REGIONS[region as keyof typeof REGIONS]];
      }
    });
    return sites;
  };

  const openAsinGlobal = (asin: string) => {
    const targetSites = getSelectedSites();
    if (targetSites.length > 10) {
      if (!window.confirm(`即将为 ASIN: ${asin} 打开 ${targetSites.length} 个标签页。确定吗？`)) return;
    }
    
    targetSites.forEach(site => {
      window.open(`${site.url}/dp/${asin}`, '_blank');
    });
  };

  const openSingleAsinSite = (asin: string, siteUrl: string) => {
    window.open(`${siteUrl}/dp/${asin}`, '_blank');
  };

  return (
    <div className="p-4 max-w-4xl mx-auto">
      <div className="bg-white rounded-xl shadow-xl border-t-4 border-t-orange-500">
        <div className="p-6 pb-2">
          <h2 className="flex items-center gap-2 text-2xl font-semibold text-slate-800">
            <Globe className="w-7 h-7 text-orange-500" />
            亚马逊批量查询工具（关键词&ASIN)
          </h2>
        </div>

        <div className="w-full">
          <div className="px-6">
            <div className="grid w-full grid-cols-2 mb-4 bg-slate-100 p-1 rounded-lg">
              <button 
                onClick={() => setActiveTab('keyword')}
                className={`flex items-center justify-center py-2 text-sm font-medium rounded-md transition-all ${
                  activeTab === 'keyword' 
                    ? 'bg-white text-orange-800 shadow-sm ring-1 ring-black/5' 
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Search className="w-4 h-4 mr-2" /> 关键词排名监控 (单站点)
              </button>
              <button 
                onClick={() => setActiveTab('asin')}
                className={`flex items-center justify-center py-2 text-sm font-medium rounded-md transition-all ${
                  activeTab === 'asin' 
                    ? 'bg-white text-blue-800 shadow-sm ring-1 ring-black/5' 
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Map className="w-4 h-4 mr-2" /> ASIN 全球跟卖侦查 (全站点)
              </button>
            </div>
          </div>

          {/* ================= KEYWORD TAB ================= */}
          {activeTab === 'keyword' && (
            <div className="px-6 pb-6 space-y-4">
              <div className="flex items-center gap-4 bg-slate-50 p-3 rounded-lg border">
                <span className="text-sm font-medium whitespace-nowrap">目标站点：</span>
                <select 
                  value={kwDomain} 
                  onChange={(e) => setKwDomain(e.target.value)}
                  className="w-[240px] h-10 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400 focus:border-transparent"
                >
                  {ALL_SITES.map(site => (
                    <option key={site.url} value={site.url}>
                      {site.name} ({site.code})
                    </option>
                  ))}
                </select>
              </div>

              <textarea 
                placeholder="输入关键词，每行一个..." 
                className="flex min-h-[120px] w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-slate-400 focus:border-transparent disabled:cursor-not-allowed disabled:opacity-50"
                value={keywords}
                onChange={e => setKeywords(e.target.value)}
              />
              
              <div className="flex gap-2">
                <button 
                  onClick={generateKeywords} 
                  className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-orange-500 text-white hover:bg-orange-600 h-10 px-4 py-2 flex-1"
                >
                  生成搜索链接
                </button>
                <button 
                  onClick={() => {setKeywords(''); setKwResults([]);}}
                  className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-slate-200 bg-white hover:bg-slate-100 hover:text-slate-900 h-10 px-4 py-2"
                >
                  清空
                </button>
              </div>

              {/* History Section */}
              {searchHistory.length > 0 && (
                <div className="pt-2">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-xs font-semibold text-slate-500 flex items-center gap-1">
                      <History className="w-3 h-3" /> 历史搜索记录 <span className="text-[10px] font-normal text-slate-400 ml-1">(仅保存在本地)</span>
                    </h3>
                    <button 
                      onClick={clearHistory}
                      className="text-xs text-slate-400 hover:text-red-500 flex items-center gap-1"
                    >
                      <Trash2 className="w-3 h-3" /> 清空历史
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {searchHistory.map((item, idx) => (
                      <button
                        key={idx}
                        onClick={() => useHistoryItem(item)}
                        className="text-xs bg-slate-100 hover:bg-slate-200 text-slate-600 px-2 py-1 rounded border border-slate-200 transition-colors"
                      >
                        {item}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {kwResults.length > 0 && (
                <div className="border rounded-md divide-y mt-4">
                  <div className="p-2 bg-slate-100 font-medium text-sm flex justify-between items-center">
                    <span>生成结果 ({kwResults.length})</span>
                    <button 
                      className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-xs font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 hover:bg-slate-100 hover:text-slate-900 h-6 text-blue-600 px-2" 
                      onClick={() => kwResults.forEach(r => window.open(r.url, '_blank'))}
                    >
                      全部打开
                    </button>
                  </div>
                  <div className="max-h-[300px] overflow-y-auto">
                    {kwResults.map((r, i) => (
                      <div key={i} className="p-2 flex justify-between items-center hover:bg-slate-50 text-sm">
                        <span className="truncate mr-4">{i+1}. {r.text}</span>
                        <a href={r.url} target="_blank" rel="noreferrer" className="text-blue-500 hover:underline text-xs flex items-center">
                          打开 <ExternalLink className="w-3 h-3 ml-1" />
                        </a>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ================= ASIN TAB ================= */}
          {activeTab === 'asin' && (
            <div className="px-6 pb-6 space-y-4">
              <div className="bg-blue-50 p-4 rounded-lg border border-blue-100 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-blue-800 flex items-center gap-2">
                    <Globe className="w-4 h-4" /> 选择要侦查的区域
                  </h3>
                  <span className="text-xs text-blue-600">已选站点数: {getSelectedSites().length}</span>
                </div>
                <div className="flex flex-wrap gap-4">
                  {Object.keys(REGIONS).map(region => (
                    <label key={region} className="flex items-center space-x-2 cursor-pointer hover:bg-blue-100/50 p-1 rounded">
                      <input 
                        type="checkbox"
                        className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                        checked={selectedRegions.includes(region)}
                        onChange={() => toggleRegion(region)}
                      />
                      <span className="text-sm text-slate-700">{region}</span>
                    </label>
                  ))}
                </div>
              </div>

              <textarea 
                placeholder="输入 ASIN，每行一个 (例如: B08L5WHFT9)..." 
                className="flex min-h-[100px] w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-slate-400 focus:border-transparent disabled:cursor-not-allowed disabled:opacity-50"
                value={asins}
                onChange={e => setAsins(e.target.value)}
              />

              <div className="flex gap-2">
                <button 
                  onClick={generateAsins} 
                  className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-blue-600 text-white hover:bg-blue-700 h-10 px-4 py-2 flex-1"
                >
                  <Package className="w-4 h-4 mr-2" /> 分析 ASIN
                </button>
                <button 
                  onClick={() => {setAsins(''); setAsinResults([]);}}
                  className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-slate-200 bg-white hover:bg-slate-100 hover:text-slate-900 h-10 px-4 py-2"
                >
                  清空
                </button>
              </div>

              {asinResults.length > 0 && (
                <div className="space-y-4 mt-4">
                  {asinResults.map((asin, idx) => (
                    <div key={idx} className="rounded-lg border bg-card text-card-foreground shadow-sm border-l-4 border-l-blue-500">
                      <div className="p-4">
                        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-3">
                          <div className="font-mono font-bold text-lg text-slate-800 flex items-center gap-2">
                            <span className="bg-slate-100 px-2 py-1 rounded text-sm text-slate-500">#{idx + 1}</span>
                            {asin}
                          </div>
                          <button 
                            onClick={() => openAsinGlobal(asin)}
                            className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-slate-800 text-white hover:bg-slate-700 h-9 px-3 w-full md:w-auto"
                          >
                            <ExternalLink className="w-4 h-4 mr-2" /> 一键打开所选区域 ({getSelectedSites().length}个)
                          </button>
                        </div>
                        
                        {/* Quick Links for specific sites */}
                        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2">
                          {getSelectedSites().map(site => (
                            <button
                              key={site.code}
                              onClick={() => openSingleAsinSite(asin, site.url)}
                              className="text-xs border rounded px-2 py-1 hover:bg-blue-50 hover:border-blue-300 text-slate-600 flex items-center justify-center gap-1 transition-colors"
                              title={`打开 ${site.name} 站点`}
                            >
                              {site.code} <ExternalLink className="w-2 h-2 opacity-50" />
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
      
      <div className="mt-4 text-center text-xs text-slate-400">
         支持站点：北美(US/CA/MX/BR) · 欧洲(UK/DE/FR/IT/ES/NL/SE/PL/BE/TR) · 亚太(JP/AU/IN/SG) · 中东(AE/SA/EG)
      </div>
    </div>
  );
};

export default AmazonGlobalTool;
