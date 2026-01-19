import { useMemo, useState } from 'react';
import { BookOpen, ChevronDown } from 'lucide-react';
import { useStore } from '@/store';
import { FileUpload } from '@/components/FileUpload';
import { KPIGrid } from '@/components/KPIGrid';
import { ScatterAnalysis } from '@/components/charts/ScatterAnalysis';
import { DataTable } from '@/components/DataTable';
import { SuggestionsPanel } from '@/components/SuggestionsPanel';
import { aggregateBySearchTerm } from '@/lib/aggregate';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { Streamdown } from 'streamdown';
import usageMarkdown from '../../使用说明.md?raw';

export default function Home() {
  const { data, fileName, settings } = useStore();
  const [usageOpen, setUsageOpen] = useState(false);
  const usageBody = (
    <div className="text-sm leading-relaxed [&_h1]:text-lg [&_h1]:font-semibold [&_h1]:mt-4 [&_h1]:mb-2 [&_h2]:text-base [&_h2]:font-semibold [&_h2]:mt-4 [&_h2]:mb-2 [&_h3]:text-sm [&_h3]:font-semibold [&_h3]:mt-3 [&_h3]:mb-1 [&_p]:my-2 [&_ul]:my-2 [&_ol]:my-2 [&_li]:my-1 [&_code]:rounded [&_code]:bg-muted [&_code]:px-1 [&_pre]:my-3 [&_pre]:overflow-auto [&_pre]:rounded-md [&_pre]:border [&_pre]:bg-muted/30 [&_pre]:p-3">
      <Streamdown>{usageMarkdown}</Streamdown>
    </div>
  );
  const usagePanel = (
    <div className="rounded-md border bg-muted/30">
      <ScrollArea className="h-[70vh] px-4 py-4">{usageBody}</ScrollArea>
    </div>
  );

  const filteredData = useMemo(() => {
    if (!data) return [];
    const splitTerms = (text: string) =>
      text
        .split(/[,\s，;；\n\r\t]+/g)
        .map((s) => s.trim())
        .filter(Boolean)
        .map((s) => s.toLowerCase());
    const includeTerms = splitTerms(settings.searchTerm);
    const excludeTerms = splitTerms(settings.excludeTerm);

    const campaignSet = settings.campaignNames.length ? new Set(settings.campaignNames) : null;
    const adGroupSet = settings.adGroupNames.length ? new Set(settings.adGroupNames) : null;
    const matchTypeSet = settings.matchTypes.length ? new Set(settings.matchTypes) : null;

    const toYmdUtc = (d: Date) =>
      new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())).toISOString().slice(0, 10);
    const fromYmd = settings.dateRange.from ? toYmdUtc(settings.dateRange.from) : null;
    const toYmd = settings.dateRange.to ? toYmdUtc(settings.dateRange.to) : null;

    return data.filter((item) => {
      const inRange = (value: number, min: number | null, max: number | null) => {
        if (min !== null && value < min) return false;
        if (max !== null && value > max) return false;
        return true;
      };

      if (fromYmd || toYmd) {
        if (!item.date) return false;
        if (fromYmd && item.date < fromYmd) return false;
        if (toYmd && item.date > toYmd) return false;
      }

      if (!inRange(item.impressions, settings.minImpressions, settings.impressionsMax)) return false;
      if (!inRange(item.clicks, settings.minClicks, settings.clicksMax)) return false;
      if (!inRange(item.spend, settings.spendMin, settings.spendMax)) return false;
      if (!inRange(item.sales, settings.salesMin, settings.salesMax)) return false;
      if (!inRange(item.orders, settings.ordersMin, settings.ordersMax)) return false;

      const ctrPct = item.ctr * 100;
      if (!inRange(ctrPct, settings.ctrMinPct, settings.ctrMaxPct)) return false;

      if (!inRange(item.cpc, settings.cpcMin, settings.cpcMax)) return false;

      const acosForFilter =
        item.sales > 0 ? item.acos : item.spend > 0 ? Number.POSITIVE_INFINITY : 0;
      if (!inRange(acosForFilter, settings.acosMin, settings.acosMax)) return false;

      if (!inRange(item.roas, settings.roasMin, settings.roasMax)) return false;

      const conversionPct = item.conversionRate * 100;
      if (!inRange(conversionPct, settings.conversionRateMinPct, settings.conversionRateMaxPct)) return false;

      if (campaignSet && !campaignSet.has(item.campaignName)) return false;
      if (adGroupSet && !adGroupSet.has(item.adGroupName)) return false;
      if (matchTypeSet && !matchTypeSet.has(item.matchType)) return false;

      const termText = item.searchTerm.toLowerCase();
      if (includeTerms.length && !includeTerms.some((t) => termText.includes(t))) return false;
      if (excludeTerms.length && excludeTerms.some((t) => termText.includes(t))) return false;

      if (settings.conversion === '有订单' && item.orders <= 0) return false;
      if (settings.conversion === '无订单' && item.orders > 0) return false;
      if (settings.conversion === '有销售' && item.sales <= 0) return false;
      if (settings.conversion === '无销售' && item.sales > 0) return false;

      return true;
    });
  }, [
    data,
    settings.adGroupNames,
    settings.campaignNames,
    settings.conversion,
    settings.excludeTerm,
    settings.matchTypes,
    settings.minClicks,
    settings.minImpressions,
    settings.acosMax,
    settings.acosMin,
    settings.clicksMax,
    settings.cpcMax,
    settings.cpcMin,
    settings.ctrMaxPct,
    settings.ctrMinPct,
    settings.conversionRateMaxPct,
    settings.conversionRateMinPct,
    settings.impressionsMax,
    settings.ordersMax,
    settings.ordersMin,
    settings.roasMax,
    settings.roasMin,
    settings.salesMax,
    settings.salesMin,
    settings.spendMax,
    settings.spendMin,
    settings.searchTerm,
    settings.dateRange.from,
    settings.dateRange.to,
  ]);

  // Calculations
  const metrics = useMemo(() => {
    if (!filteredData.length) {
      return {
        spend: 0,
        sales: 0,
        clicks: 0,
        impressions: 0,
        orders: 0,
        acos: 0,
        roas: 0,
        ctr: 0,
        cpc: 0,
        conversionRate: 0,
        wasteSpend: 0,
      };
    }

    const spend = filteredData.reduce((acc, curr) => acc + curr.spend, 0);
    const sales = filteredData.reduce((acc, curr) => acc + curr.sales, 0);
    const clicks = filteredData.reduce((acc, curr) => acc + curr.clicks, 0);
    const impressions = filteredData.reduce((acc, curr) => acc + curr.impressions, 0);
    const orders = filteredData.reduce((acc, curr) => acc + curr.orders, 0);
    const wasteSpend = filteredData.reduce(
      (acc, curr) => (curr.sales <= 0 && curr.orders <= 0 ? acc + curr.spend : acc),
      0
    );

    const acos = sales > 0 ? (spend / sales) * 100 : 0;
    const roas = spend > 0 ? sales / spend : 0;
    const ctr = impressions > 0 ? clicks / impressions : 0;
    const cpc = clicks > 0 ? spend / clicks : 0;
    const conversionRate = clicks > 0 ? orders / clicks : 0;

    return { spend, sales, clicks, impressions, orders, acos, roas, ctr, cpc, conversionRate, wasteSpend };
  }, [filteredData]);

  const analysisData = useMemo(() => {
    if (settings.viewMode !== "按搜索词汇总") return null;
    return aggregateBySearchTerm(filteredData);
  }, [filteredData, settings.viewMode]);
  const analysisRows = useMemo(() => (analysisData ? analysisData.rows : filteredData), [analysisData, filteredData]);

  if (!data) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
        <div className="w-full max-w-4xl text-center space-y-6 animate-in fade-in zoom-in duration-500">
          <div className="space-y-2">
            <h1 className="text-4xl font-extrabold tracking-tight lg:text-5xl bg-clip-text text-transparent bg-gradient-to-r from-primary to-slate-800">
              亚马逊广告分析工具
            </h1>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
              将原始搜索词报告转化为可执行的分析洞察。全程本地处理，更安全。
            </p>
          </div>

          <Collapsible open={usageOpen} onOpenChange={setUsageOpen}>
            <div className="flex justify-center">
              <CollapsibleTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2">
                  <BookOpen className="w-4 h-4" />
                  {usageOpen ? "收起使用说明" : "查看使用说明"}
                  <ChevronDown className={`w-4 h-4 transition-transform ${usageOpen ? "rotate-180" : ""}`} />
                </Button>
              </CollapsibleTrigger>
            </div>
            <CollapsibleContent>
              <div className="mt-4 text-left">{usagePanel}</div>
            </CollapsibleContent>
          </Collapsible>

          <FileUpload />
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mt-16 max-w-3xl mx-auto text-left">
            <div className="space-y-2">
              <h3 className="font-semibold text-foreground">安全与隐私</h3>
              <p className="text-sm text-muted-foreground">数据完全在浏览器中处理，不会上传到任何服务器。</p>
            </div>
             <div className="space-y-2">
              <h3 className="font-semibold text-foreground">即时分析</h3>
              <p className="text-sm text-muted-foreground">快速查看 ACOS、ROAS 等关键指标与可视化结果。</p>
            </div>
             <div className="space-y-2">
              <h3 className="font-semibold text-foreground">兼容 Excel</h3>
              <p className="text-sm text-muted-foreground">可直接导入标准的亚马逊搜索词报告（.xlsx）。</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-6 space-y-6 animate-in slide-in-from-bottom-4 duration-700">
      {/* Header */}
      <Collapsible open={usageOpen} onOpenChange={setUsageOpen}>
        <div className="flex flex-col gap-3">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <h1 className="text-2xl font-bold tracking-tight">分析看板</h1>
              <p className="text-sm text-muted-foreground">
                {settings.viewMode === "按搜索词汇总"
                  ? `报告：${fileName} • 原始 ${data.length} 条（汇总 ${analysisRows.length} 个搜索词）`
                  : `报告：${fileName} • 原始 ${data.length} 条，当前显示 ${analysisRows.length} 条`}
              </p>
            </div>
            <CollapsibleTrigger asChild>
              <Button variant="outline" size="sm" className="gap-2">
                <BookOpen className="w-4 h-4" />
                {usageOpen ? "收起使用说明" : "查看使用说明"}
                <ChevronDown className={`w-4 h-4 transition-transform ${usageOpen ? "rotate-180" : ""}`} />
              </Button>
            </CollapsibleTrigger>
          </div>

          <CollapsibleContent>{usagePanel}</CollapsibleContent>
        </div>
      </Collapsible>

      {/* KPIs */}
      <KPIGrid 
        totalSpend={metrics.spend}
        totalSales={metrics.sales}
        overallAcos={metrics.acos}
        totalClicks={metrics.clicks}
        totalImpressions={metrics.impressions}
        totalOrders={metrics.orders}
        overallRoas={metrics.roas}
        overallCtr={metrics.ctr}
        overallCpc={metrics.cpc}
        overallConversionRate={metrics.conversionRate}
        wasteSpend={metrics.wasteSpend}
        currency={settings.currency}
        targetAcos={settings.targetAcos}
      />

      <div className="space-y-6">
        <SuggestionsPanel data={analysisRows} currency={settings.currency} />
        <DataTable
          data={analysisRows}
          aggregatedDetailsById={analysisData?.detailsById}
          targetAcos={settings.targetAcos}
          currency={settings.currency}
        />
        <ScatterAnalysis data={analysisRows} targetAcos={settings.targetAcos} />
      </div>
    </div>
  );
}
