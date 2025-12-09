import React, { useState } from 'react';
import { Search, ExternalLink, Trash2, Globe, Package, Map, CheckSquare, Square } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";

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

  // --- ASIN Mode State ---
  const [asins, setAsins] = useState('');
  const [asinResults, setAsinResults] = useState<string[]>([]);
  const [selectedRegions, setSelectedRegions] = useState<string[]>(['北美/南美', '欧洲', '亚洲/澳洲', '中东/非洲']);

  // --- Handlers: Keyword ---
  const generateKeywords = () => {
    if (!keywords.trim()) return;
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
    let sites: typeof ALL_SITES = [];
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
      <Card className="shadow-xl border-t-4 border-t-orange-500">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-2xl text-slate-800">
            <Globe className="w-7 h-7 text-orange-500" />
            亚马逊批量查逊工具（关键词&ASIN)
          </CardTitle>
        </CardHeader>

        <Tabs defaultValue="keyword" value={activeTab} onValueChange={setActiveTab} className="w-full">
          <div className="px-6">
            <TabsList className="grid w-full grid-cols-2 mb-4">
              <TabsTrigger value="keyword" className="data-[state=active]:bg-orange-100 data-[state=active]:text-orange-800">
                <Search className="w-4 h-4 mr-2" /> 关键词排名监控 (单站点)
              </TabsTrigger>
              <TabsTrigger value="asin" className="data-[state=active]:bg-blue-100 data-[state=active]:text-blue-800">
                <Map className="w-4 h-4 mr-2" /> ASIN 全球跟卖侦查 (全站点)
              </TabsTrigger>
            </TabsList>
          </div>

          {/* ================= KEYWORD TAB ================= */}
          <TabsContent value="keyword" className="px-6 pb-6 space-y-4">
            <div className="flex items-center gap-4 bg-slate-50 p-3 rounded-lg border">
              <span className="text-sm font-medium whitespace-nowrap">目标站点：</span>
              <Select value={kwDomain} onValueChange={setKwDomain}>
                <SelectTrigger className="w-[240px] bg-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ALL_SITES.map(site => (
                    <SelectItem key={site.url} value={site.url}>
                      {site.name} ({site.code})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Textarea 
              placeholder="输入关键词，每行一个..." 
              className="min-h-[120px] font-mono"
              value={keywords}
              onChange={e => setKeywords(e.target.value)}
            />
            
            <div className="flex gap-2">
              <Button onClick={generateKeywords} className="bg-orange-500 hover:bg-orange-600 flex-1">
                生成搜索链接
              </Button>
              <Button variant="outline" onClick={() => {setKeywords(''); setKwResults([]);}}>
                清空
              </Button>
            </div>

            {kwResults.length > 0 && (
              <div className="border rounded-md divide-y mt-4">
                <div className="p-2 bg-slate-100 font-medium text-sm flex justify-between items-center">
                  <span>生成结果 ({kwResults.length})</span>
                  <Button variant="ghost" size="sm" className="h-6 text-xs text-blue-600" 
                    onClick={() => kwResults.forEach(r => window.open(r.url, '_blank'))}>
                    全部打开
                  </Button>
                </div>
                <div className="max-h-[300px] overflow-y-auto">
                  {kwResults.map((r, i) => (
                    <div key={i} className="p-2 flex justify-between items-center hover:bg-slate-50 text-sm">
                      <span className="truncate mr-4">{i+1}. {r.text}</span>
                      <a href={r.url} target="_blank" className="text-blue-500 hover:underline text-xs flex items-center">
                        打开 <ExternalLink className="w-3 h-3 ml-1" />
                      </a>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </TabsContent>

          {/* ================= ASIN TAB ================= */}
          <TabsContent value="asin" className="px-6 pb-6 space-y-4">
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
                    <Checkbox 
                      checked={selectedRegions.includes(region)}
                      onCheckedChange={() => toggleRegion(region)}
                    />
                    <span className="text-sm text-slate-700">{region}</span>
                  </label>
                ))}
              </div>
            </div>

            <Textarea 
              placeholder="输入 ASIN，每行一个 (例如: B08L5WHFT9)..." 
              className="min-h-[100px] font-mono"
              value={asins}
              onChange={e => setAsins(e.target.value)}
            />

            <div className="flex gap-2">
              <Button onClick={generateAsins} className="bg-blue-600 hover:bg-blue-700 flex-1">
                <Package className="w-4 h-4 mr-2" /> 分析 ASIN
              </Button>
              <Button variant="outline" onClick={() => {setAsins(''); setAsinResults([]);}}>
                清空
              </Button>
            </div>

            {asinResults.length > 0 && (
              <div className="space-y-4 mt-4">
                {asinResults.map((asin, idx) => (
                  <Card key={idx} className="border-l-4 border-l-blue-500">
                    <CardContent className="p-4">
                      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-3">
                        <div className="font-mono font-bold text-lg text-slate-800 flex items-center gap-2">
                          <span className="bg-slate-100 px-2 py-1 rounded text-sm text-slate-500">#{idx + 1}</span>
                          {asin}
                        </div>
                        <Button 
                          size="sm" 
                          onClick={() => openAsinGlobal(asin)}
                          className="bg-slate-800 text-white hover:bg-slate-700 w-full md:w-auto"
                        >
                          <ExternalLink className="w-4 h-4 mr-2" /> 一键打开所选区域 ({getSelectedSites().length}个)
                        </Button>
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
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </Card>
      
      <div className="mt-4 text-center text-xs text-slate-400">
         支持站点：北美(US/CA/MX/BR) · 欧洲(UK/DE/FR/IT/ES/NL/SE/PL/BE/TR) · 亚太(JP/AU/IN/SG) · 中东(AE/SA/EG)
      </div>
    </div>
  );
};

export default AmazonGlobalTool;