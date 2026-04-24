import { useCallback, useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, ArrowUpDown, BookOpen, CalendarIcon, ChevronDown, Copy, Download, RotateCcw } from 'lucide-react';
import { useStore } from '@/store';
import { FileUpload } from '@/components/FileUpload';
import { KPIGrid } from '@/components/KPIGrid';
import { ScatterAnalysis } from '@/components/charts/ScatterAnalysis';
import { DataTable } from '@/components/DataTable';
import { StructureAnalysisPanel, SuggestionsPanel } from '@/components/SuggestionsPanel';
import { aggregateBySearchTerm } from '@/lib/aggregate';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Tooltip as UiTooltip, TooltipContent as UiTooltipContent, TooltipTrigger as UiTooltipTrigger } from '@/components/ui/tooltip';
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/components/ui/hover-card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import type { DateRange } from 'react-day-picker';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { Streamdown } from 'streamdown';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';
import { format } from 'date-fns';
import usageMarkdown from '../../使用说明.md?raw';
import { Bar, BarChart, CartesianGrid, LabelList, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

async function copyToClipboard(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const el = document.createElement('textarea');
      el.value = text;
      el.setAttribute('readonly', 'true');
      el.style.position = 'fixed';
      el.style.left = '-9999px';
      document.body.appendChild(el);
      el.select();
      const ok = document.execCommand('copy');
      document.body.removeChild(el);
      return ok;
    } catch {
      return false;
    }
  }
}

function summarizeNames(values: Iterable<string>) {
  const uniq = Array.from(new Set(Array.from(values).map((v) => v.trim()).filter(Boolean))).sort((a, b) =>
    a.localeCompare(b, 'zh-Hans-CN')
  );
  if (!uniq.length) return { label: '—', names: [] as string[] };
  if (uniq.length === 1) return { label: uniq[0], names: uniq };
  return { label: `（多：${uniq.length}）`, names: uniq };
}

function isMultiValueLabel(value: string) {
  return value.startsWith('（多：') && value.endsWith('）');
}

function TopRangeInput({
  label,
  minValue,
  maxValue,
  onChangeMin,
  onChangeMax,
  minPlaceholder = '最小',
  maxPlaceholder = '最大',
  step,
}: {
  label: string;
  minValue: string;
  maxValue: string;
  onChangeMin: (value: string) => void;
  onChangeMax: (value: string) => void;
  minPlaceholder?: string;
  maxPlaceholder?: string;
  step?: number;
}) {
  return (
    <div className="space-y-1">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="grid grid-cols-2 gap-2">
        <Input
          type="number"
          min={0}
          value={minValue}
          placeholder={minPlaceholder}
          step={step}
          onChange={(e) => onChangeMin(e.target.value)}
        />
        <Input
          type="number"
          min={0}
          value={maxValue}
          placeholder={maxPlaceholder}
          step={step}
          onChange={(e) => onChangeMax(e.target.value)}
        />
      </div>
    </div>
  );
}

function HeaderTip({ label, tip }: { label: string; tip: string }) {
  return (
    <UiTooltip>
      <UiTooltipTrigger asChild>
        <span className="inline-flex items-center gap-1 cursor-help">
          <span>{label}</span>
          <span className="inline-flex items-center justify-center w-4 h-4 rounded-full border text-[10px] text-muted-foreground">
            ?
          </span>
        </span>
      </UiTooltipTrigger>
      <UiTooltipContent side="top" align="center">
        {tip}
      </UiTooltipContent>
    </UiTooltip>
  );
}

export default function Home() {
  const { data, fileName, settings, reset } = useStore();
  const [usageOpen, setUsageOpen] = useState(false);
  const [topOpen, setTopOpen] = useState(false);
  const [salesShareOpen, setSalesShareOpen] = useState(false);
  const [campaignOpen, setCampaignOpen] = useState(false);
  const [wasteOpen, setWasteOpen] = useState(false);
  const [compareTrendSeries, setCompareTrendSeries] = useState<Array<'spend' | 'sales' | 'orders'>>([
    'spend',
    'sales',
    'orders',
  ]);
  const [compareTrafficSeries, setCompareTrafficSeries] = useState<Array<'impressions' | 'clicks' | 'ctr'>>([
    'impressions',
    'clicks',
    'ctr',
  ]);
  const [compareConversionSeries, setCompareConversionSeries] = useState<Array<'orders' | 'conversionRate'>>([
    'orders',
    'conversionRate',
  ]);
  const [topDimension, setTopDimension] = useState<'keywords' | 'all' | 'asin'>('keywords');
  const [topN, setTopN] = useState<50 | 100>(50);
  const [topSortKey, setTopSortKey] = useState<
    | 'term'
    | 'spend'
    | 'sales'
    | 'orders'
    | 'clicks'
    | 'impressions'
    | 'acos'
    | 'roas'
    | 'cpc'
    | 'ctr'
    | 'conversionRate'
    | 'cpa'
  >('spend');
  const [topSortDir, setTopSortDir] = useState<'desc' | 'asc'>('desc');
  const [topQuery, setTopQuery] = useState('');
  const [topMinSpend, setTopMinSpend] = useState('');
  const [topMaxSpend, setTopMaxSpend] = useState('');
  const [topMinClicks, setTopMinClicks] = useState('');
  const [topMaxClicks, setTopMaxClicks] = useState('');
  const [topMinOrders, setTopMinOrders] = useState('');
  const [topMaxOrders, setTopMaxOrders] = useState('');
  const [topMinImpressions, setTopMinImpressions] = useState('');
  const [topMaxImpressions, setTopMaxImpressions] = useState('');
  const [topMinSales, setTopMinSales] = useState('');
  const [topMaxSales, setTopMaxSales] = useState('');
  const [topMinCtr, setTopMinCtr] = useState('');
  const [topMaxCtr, setTopMaxCtr] = useState('');
  const [topMinCpc, setTopMinCpc] = useState('');
  const [topMaxCpc, setTopMaxCpc] = useState('');
  const [topMinAcos, setTopMinAcos] = useState('');
  const [topMaxAcos, setTopMaxAcos] = useState('');
  const [topMinRoas, setTopMinRoas] = useState('');
  const [topMaxRoas, setTopMaxRoas] = useState('');
  const [topMinCpa, setTopMinCpa] = useState('');
  const [topMaxCpa, setTopMaxCpa] = useState('');
  const [topVisibleCols, setTopVisibleCols] = useState<
    Array<
      | 'impressions'
      | 'clicks'
      | 'spend'
      | 'sales'
      | 'orders'
      | 'ctr'
      | 'cpc'
      | 'acos'
      | 'roas'
      | 'conversionRate'
      | 'cpa'
    >
  >([
    'impressions',
    'clicks',
    'spend',
    'sales',
    'orders',
    'ctr',
    'cpc',
    'acos',
    'roas',
    'conversionRate',
    'cpa',
  ]);
  const [wasteTopN, setWasteTopN] = useState<10 | 20 | 50>(20);
  const [wasteCriteria, setWasteCriteria] = useState<'ordersZero' | 'salesZero' | 'ordersAndSalesZero'>('ordersAndSalesZero');
  const [wasteAdGroupSortKey, setWasteAdGroupSortKey] = useState<
    'campaignName' | 'adGroupName' | 'wasteSpend' | 'wasteClicks' | 'wasteShare' | 'spend' | 'orders'
  >('wasteSpend');
  const [wasteAdGroupSortDir, setWasteAdGroupSortDir] = useState<'desc' | 'asc'>('desc');
  const [wasteTermSortKey, setWasteTermSortKey] = useState<
    'term' | 'wasteSpend' | 'wasteClicks' | 'wasteShare' | 'spend' | 'orders'
  >('wasteSpend');
  const [wasteTermSortDir, setWasteTermSortDir] = useState<'desc' | 'asc'>('desc');
  const [wasteAdGroupDetail, setWasteAdGroupDetail] = useState<{
    campaignName: string;
    adGroupName: string;
  } | null>(null);
  const [wasteAdGroupFilterDimension, setWasteAdGroupFilterDimension] = useState<'search' | 'asin'>('search');
  const [wasteAdGroupFilterQuery, setWasteAdGroupFilterQuery] = useState('');
  const [rootOpen, setRootOpen] = useState(false);
  const [rootDimension, setRootDimension] = useState<'keywords' | 'all'>('keywords');
  const [rootN, setRootN] = useState<1 | 2 | 3>(1);
  const [rootTopN, setRootTopN] = useState<50 | 100 | 200>(100);
  const [rootSortKey, setRootSortKey] = useState<
    | 'root'
    | 'rootCount'
    | 'spend'
    | 'sales'
    | 'orders'
    | 'clicks'
    | 'impressions'
    | 'wasteSpend'
    | 'wasteClicks'
    | 'termCount'
    | 'impressionShare'
    | 'spendShare'
    | 'ctr'
    | 'cpc'
    | 'acos'
    | 'roas'
    | 'conversionRate'
    | 'cpa'
  >('wasteSpend');
  const [rootSortDir, setRootSortDir] = useState<'desc' | 'asc'>('desc');
  const [rootQuery, setRootQuery] = useState('');
  const [rootMinSpend, setRootMinSpend] = useState('');
  const [rootMinClicks, setRootMinClicks] = useState('');
  const [rootMinTerms, setRootMinTerms] = useState('');
  const [rootOnlyNoOrders, setRootOnlyNoOrders] = useState(true);
  const [rootOnlyNoSales, setRootOnlyNoSales] = useState(false);
  const [rootDetailExpanded, setRootDetailExpanded] = useState<Record<string, boolean>>({});
  const [campaignMinSpend, setCampaignMinSpend] = useState('');
  const [campaignMaxSpend, setCampaignMaxSpend] = useState('');
  const [campaignMinClicks, setCampaignMinClicks] = useState('');
  const [campaignMaxClicks, setCampaignMaxClicks] = useState('');
  const [campaignMinOrders, setCampaignMinOrders] = useState('');
  const [campaignMaxOrders, setCampaignMaxOrders] = useState('');
  const [campaignMinImpressions, setCampaignMinImpressions] = useState('');
  const [campaignMaxImpressions, setCampaignMaxImpressions] = useState('');
  const [campaignMinSales, setCampaignMinSales] = useState('');
  const [campaignMaxSales, setCampaignMaxSales] = useState('');
  const [campaignMinCtr, setCampaignMinCtr] = useState('');
  const [campaignMaxCtr, setCampaignMaxCtr] = useState('');
  const [campaignMinCpc, setCampaignMinCpc] = useState('');
  const [campaignMaxCpc, setCampaignMaxCpc] = useState('');
  const [campaignMinAcos, setCampaignMinAcos] = useState('');
  const [campaignMaxAcos, setCampaignMaxAcos] = useState('');
  const [campaignMinRoas, setCampaignMinRoas] = useState('');
  const [campaignMaxRoas, setCampaignMaxRoas] = useState('');
  const [campaignMinConversionRate, setCampaignMinConversionRate] = useState('');
  const [campaignMaxConversionRate, setCampaignMaxConversionRate] = useState('');
  const [campaignMinCpa, setCampaignMinCpa] = useState('');
  const [campaignMaxCpa, setCampaignMaxCpa] = useState('');
  const [campaignQuery, setCampaignQuery] = useState('');
  const [adGroupQuery, setAdGroupQuery] = useState('');
  const [campaignSortKey, setCampaignSortKey] = useState<
    | 'campaignName'
    | 'spend'
    | 'spendShare'
    | 'impressions'
    | 'clicks'
    | 'sales'
    | 'salesShare'
    | 'orders'
    | 'acos'
    | 'ctr'
    | 'conversionRate'
    | 'cpc'
    | 'cpa'
  >('spend');
  const [campaignSortDir, setCampaignSortDir] = useState<'desc' | 'asc'>('desc');
  const [adGroupSortKey, setAdGroupSortKey] = useState<
    | 'campaignName'
    | 'adGroupName'
    | 'spend'
    | 'spendShare'
    | 'impressions'
    | 'clicks'
    | 'sales'
    | 'salesShare'
    | 'orders'
    | 'acos'
    | 'ctr'
    | 'conversionRate'
    | 'cpc'
    | 'cpa'
  >('spend');
  const [adGroupSortDir, setAdGroupSortDir] = useState<'desc' | 'asc'>('desc');
  const [trafficGranularity, setTrafficGranularity] = useState<'day' | 'week' | 'month' | 'all'>('day');
  const [trafficOpen, setTrafficOpen] = useState(false);
  const [trafficSeries, setTrafficSeries] = useState<Array<'impressions' | 'clicks' | 'ctr'>>([
    'impressions',
    'clicks',
    'ctr',
  ]);
  const [performanceGranularity, setPerformanceGranularity] = useState<'day' | 'week' | 'month' | 'all'>('day');
  const [performanceOpen, setPerformanceOpen] = useState(false);
  const [performanceSeries, setPerformanceSeries] = useState<Array<'spend' | 'sales' | 'acos'>>([
    'spend',
    'sales',
    'acos',
  ]);
  const [conversionGranularity, setConversionGranularity] = useState<'day' | 'week' | 'month' | 'all'>('day');
  const [conversionOpen, setConversionOpen] = useState(false);
  const [conversionSeries, setConversionSeries] = useState<Array<'orders' | 'conversionRate'>>([
    'orders',
    'conversionRate',
  ]);

  const copyrightInline = (
    <div className="text-xs text-muted-foreground">
      版权归 跨境乐趣园所有 | 作者：達哥 | 官网：
      <a
        className="ml-1 underline underline-offset-4"
        href="https://amzlink.top/"
        target="_blank"
        rel="noreferrer"
      >
        https://amzlink.top/
      </a>
    </div>
  );
  const footerInline = (
    <footer className="pt-10 pb-6 text-center text-xs text-muted-foreground">
      版权归 跨境乐趣园所有 | 作者：達哥 | 官网：
      <a
        className="ml-1 underline underline-offset-4"
        href="https://amzlink.top/"
        target="_blank"
        rel="noreferrer"
      >
        https://amzlink.top/
      </a>
    </footer>
  );
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

  const splitTerms = (text: string) =>
    text
      .split(/[,\s，;；\n\r\t]+/g)
      .map((s) => s.trim())
      .filter(Boolean)
      .map((s) => s.toLowerCase());
  const tokenizeRoot = useCallback((text: string) => {
    return text
      .toLowerCase()
      .trim()
      .split(/[,\s，;；/|\\(){}<>「」【】、\n\r\t-]+/g)
      .map((s) => s.trim())
      .filter(Boolean);
  }, []);
  const filterData = useCallback((source: typeof data, includeDateRange: boolean, applyMetricFilters = true) => {
    if (!source) return [];
    const includeTerms = splitTerms(settings.searchTerm);
    const excludeTerms = splitTerms(settings.excludeTerm);
    const quickTerms = splitTerms(settings.quickFilter);

    const campaignSet = settings.campaignNames.length ? new Set(settings.campaignNames) : null;
    const adGroupSet = settings.adGroupNames.length ? new Set(settings.adGroupNames) : null;
    const matchTypeSet = settings.matchTypes.length ? new Set(settings.matchTypes) : null;

    const toYmdUtc = (d: Date) =>
      new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())).toISOString().slice(0, 10);
    const fromYmd = settings.dateRange.from ? toYmdUtc(settings.dateRange.from) : null;
    const toYmd = settings.dateRange.to ? toYmdUtc(settings.dateRange.to) : null;
    const inRange = (value: number, min: number | null, max: number | null) => {
      if (min !== null && value < min) return false;
      if (max !== null && value > max) return false;
      return true;
    };
    const matchesMetricRanges = (item: (typeof source)[number]) => {
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
      return true;
    };

    return source.filter((item) => {
      if (includeDateRange && (fromYmd || toYmd)) {
        if (!item.date) return false;
        if (fromYmd && item.date < fromYmd) return false;
        if (toYmd && item.date > toYmd) return false;
      }

      if (campaignSet && !campaignSet.has(item.campaignName)) return false;
      if (adGroupSet && !adGroupSet.has(item.adGroupName)) return false;
      if (matchTypeSet && !matchTypeSet.has(item.matchType)) return false;

      const termText = item.searchTerm.toLowerCase();
      if (includeTerms.length && !includeTerms.some((t) => termText.includes(t))) return false;
      if (excludeTerms.length && excludeTerms.some((t) => termText.includes(t))) return false;
      if (
        quickTerms.length &&
        !quickTerms.some((t) => (t.startsWith("b0") ? termText.trim() === t : termText.includes(t)))
      )
        return false;

      if (settings.conversion === '有订单' && item.orders <= 0) return false;
      if (settings.conversion === '无订单' && item.orders > 0) return false;
      if (settings.conversion === '有销售' && item.sales <= 0) return false;
      if (settings.conversion === '无销售' && item.sales > 0) return false;

      if (applyMetricFilters && !matchesMetricRanges(item)) return false;

      return true;
    });
  }, [
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
    settings.quickFilter,
    settings.dateRange.from,
    settings.dateRange.to,
  ]);
  const filteredData = useMemo(() => filterData(data, true), [data, filterData]);
  const filteredDataForAggregation = useMemo(() => filterData(data, true, false), [data, filterData]);
  const reportRangeSummary = useMemo(() => {
    if (!data?.length) return null;
    const dates = data.map((r) => r.date).filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d));
    if (!dates.length) return null;
    const minYmd = dates.reduce((acc, d) => (d < acc ? d : acc), dates[0]);
    const maxYmd = dates.reduce((acc, d) => (d > acc ? d : acc), dates[0]);
    const toUtcDate = (ymd: string) => {
      const [y, m, day] = ymd.split("-").map((v) => Number(v));
      return new Date(Date.UTC(y, m - 1, day));
    };
    const minDate = toUtcDate(minYmd);
    const maxDate = toUtcDate(maxYmd);
    const days = Math.max(1, Math.floor((maxDate.getTime() - minDate.getTime()) / 86400000) + 1);
    return { minYmd, maxYmd, days };
  }, [data]);

  // Calculations
  const metrics = useMemo(() => {
    if (!filteredData.length) {
      return {
        spend: 0,
        sales: 0,
        clicks: 0,
        impressions: 0,
        orders: 0,
        directSales: 0,
        indirectSales: 0,
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
    const directSales = filteredData.reduce(
      (acc, curr) => acc + (Number.isFinite(curr.directSales) ? curr.directSales : 0),
      0
    );
    const indirectSales = filteredData.reduce(
      (acc, curr) => acc + (Number.isFinite(curr.indirectSales) ? curr.indirectSales : 0),
      0
    );
    const wasteSpend = filteredData.reduce(
      (acc, curr) => (curr.sales <= 0 && curr.orders <= 0 ? acc + curr.spend : acc),
      0
    );

    const acos = sales > 0 ? (spend / sales) * 100 : 0;
    const roas = spend > 0 ? sales / spend : 0;
    const ctr = impressions > 0 ? clicks / impressions : 0;
    const cpc = clicks > 0 ? spend / clicks : 0;
    const conversionRate = clicks > 0 ? orders / clicks : 0;

    return {
      spend,
      sales,
      clicks,
      impressions,
      orders,
      directSales,
      indirectSales,
      acos,
      roas,
      ctr,
      cpc,
      conversionRate,
      wasteSpend,
    };
  }, [filteredData]);
  const aggregateByGranularity = useCallback((granularity: 'day' | 'week' | 'month' | 'all') => {
    const validRows = filteredData.filter((r) => r.date && /^\d{4}-\d{2}-\d{2}$/.test(r.date));
    if (!validRows.length) return [] as Array<{ period: string; impressions: number; clicks: number; spend: number; sales: number; orders: number; ctr: number; conversionRate: number; acos: number | null }>;
    const parseYmdUtc = (ymd: string) => {
      const [y, m, d] = ymd.split('-').map((v) => Number(v));
      return new Date(Date.UTC(y, m - 1, d));
    };
    const toYmdUtc = (date: Date) => date.toISOString().slice(0, 10);
    const map = new Map<string, { period: string; sortKey: string; impressions: number; clicks: number; spend: number; sales: number; orders: number }>();
    for (const row of validRows) {
      let period = row.date;
      let sortKey = row.date;
      if (granularity === 'week') {
        const currentDate = parseYmdUtc(row.date);
        const dayOfWeek = currentDate.getUTCDay();
        const offset = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
        const weekStart = new Date(currentDate);
        weekStart.setUTCDate(weekStart.getUTCDate() - offset);
        const weekEnd = new Date(weekStart);
        weekEnd.setUTCDate(weekEnd.getUTCDate() + 6);
        const weekStartYmd = toYmdUtc(weekStart);
        period = `${weekStartYmd} ~ ${toYmdUtc(weekEnd)}`;
        sortKey = weekStartYmd;
      } else if (granularity === 'month') {
        period = row.date.slice(0, 7);
        sortKey = period;
      } else if (granularity === 'all') {
        period = '全部';
        sortKey = '0000-00-00';
      }
      const hit = map.get(period);
      if (!hit) {
        map.set(period, {
          period,
          sortKey,
          impressions: row.impressions,
          clicks: row.clicks,
          spend: row.spend,
          sales: row.sales,
          orders: row.orders,
        });
      } else {
        hit.impressions += row.impressions;
        hit.clicks += row.clicks;
        hit.spend += row.spend;
        hit.sales += row.sales;
        hit.orders += row.orders;
      }
    }
    return Array.from(map.values())
      .sort((a, b) => a.sortKey.localeCompare(b.sortKey))
      .map(({ period, impressions, clicks, spend, sales, orders }) => ({
        period,
        impressions,
        clicks,
        spend,
        sales,
        orders,
        ctr: impressions > 0 ? (clicks / impressions) * 100 : 0,
        conversionRate: clicks > 0 ? (orders / clicks) * 100 : 0,
        acos: sales > 0 ? (spend / sales) * 100 : null,
      }));
  }, [filteredData]);
  const trafficTrend = useMemo(() => {
    return aggregateByGranularity(trafficGranularity);
  }, [aggregateByGranularity, trafficGranularity]);
  const performanceTrend = useMemo(() => {
    return aggregateByGranularity(performanceGranularity);
  }, [aggregateByGranularity, performanceGranularity]);
  const conversionTrend = useMemo(() => {
    return aggregateByGranularity(conversionGranularity);
  }, [aggregateByGranularity, conversionGranularity]);
  const trafficChartWidth = useMemo(
    () => (trafficGranularity === 'day' && trafficTrend.length > 45 ? Math.max(1200, trafficTrend.length * 34) : null),
    [trafficGranularity, trafficTrend.length]
  );
  const performanceChartWidth = useMemo(
    () => (performanceGranularity === 'day' && performanceTrend.length > 45 ? Math.max(1200, performanceTrend.length * 34) : null),
    [performanceGranularity, performanceTrend.length]
  );
  const conversionChartWidth = useMemo(
    () => (conversionGranularity === 'day' && conversionTrend.length > 45 ? Math.max(1200, conversionTrend.length * 34) : null),
    [conversionGranularity, conversionTrend.length]
  );

  const analysisData = useMemo(() => {
    if (settings.viewMode !== "按搜索词汇总") return null;
    const aggregated = aggregateBySearchTerm(filteredDataForAggregation);
    const rows = aggregated.rows.filter((item) => {
      const inRange = (value: number, min: number | null, max: number | null) => {
        if (min !== null && value < min) return false;
        if (max !== null && value > max) return false;
        return true;
      };
      if (!inRange(item.impressions, settings.minImpressions, settings.impressionsMax)) return false;
      if (!inRange(item.clicks, settings.minClicks, settings.clicksMax)) return false;
      if (!inRange(item.spend, settings.spendMin, settings.spendMax)) return false;
      if (!inRange(item.sales, settings.salesMin, settings.salesMax)) return false;
      if (!inRange(item.orders, settings.ordersMin, settings.ordersMax)) return false;
      if (!inRange(item.ctr * 100, settings.ctrMinPct, settings.ctrMaxPct)) return false;
      if (!inRange(item.cpc, settings.cpcMin, settings.cpcMax)) return false;
      const acosForFilter = item.sales > 0 ? item.acos : item.spend > 0 ? Number.POSITIVE_INFINITY : 0;
      if (!inRange(acosForFilter, settings.acosMin, settings.acosMax)) return false;
      if (!inRange(item.roas, settings.roasMin, settings.roasMax)) return false;
      if (!inRange(item.conversionRate * 100, settings.conversionRateMinPct, settings.conversionRateMaxPct)) return false;
      return true;
    });
    const detailsById = Object.fromEntries(
      rows.map((row) => [row.id, aggregated.detailsById[row.id]]).filter((entry) => entry[1])
    );
    return { rows, detailsById };
  }, [
    filteredDataForAggregation,
    settings.viewMode,
    settings.acosMax,
    settings.acosMin,
    settings.clicksMax,
    settings.conversionRateMaxPct,
    settings.conversionRateMinPct,
    settings.cpcMax,
    settings.cpcMin,
    settings.ctrMaxPct,
    settings.ctrMinPct,
    settings.impressionsMax,
    settings.minClicks,
    settings.minImpressions,
    settings.ordersMax,
    settings.ordersMin,
    settings.roasMax,
    settings.roasMin,
    settings.salesMax,
    settings.salesMin,
    settings.spendMax,
    settings.spendMin,
  ]);
  const analysisRows = useMemo(() => (analysisData ? analysisData.rows : filteredData), [analysisData, filteredData]);
  const compareBaseData = useMemo(() => filterData(data, false), [data, filterData]);

  const money = useMemo(
    () =>
      new Intl.NumberFormat('zh-CN', {
        style: 'currency',
        currency: settings.currency,
        maximumFractionDigits: 2,
      }),
    [settings.currency]
  );
  const normalizeTerm = useCallback((value: string) => value.trim().toLowerCase(), []);
  const isAsin = useCallback((value: string) => {
    const t = value.trim();
    if (!t) return false;
    if (/\s/.test(t)) return false;
    if (!t.toLowerCase().startsWith('b0')) return false;
    if (/^b0[a-z0-9]{8}$/i.test(t)) return true;
    return t.length >= 10;
  }, []);
  const salesShareTrend = useMemo(() => {
    const validRows = filteredData.filter((r) => r.date && /^\d{4}-\d{2}-\d{2}$/.test(r.date));
    if (!validRows.length) return [];
    const dailyMap = new Map<
      string,
      { date: string; directSales: number; indirectSales: number; totalSales: number }
    >();
    const dates: string[] = [];
    for (const row of validRows) {
      dates.push(row.date);
      const direct = Number.isFinite(row.directSales) ? row.directSales : 0;
      const indirect = Number.isFinite(row.indirectSales) ? row.indirectSales : 0;
      const hit = dailyMap.get(row.date);
      if (!hit) {
        dailyMap.set(row.date, {
          date: row.date,
          directSales: direct,
          indirectSales: indirect,
          totalSales: direct + indirect,
        });
      } else {
        hit.directSales += direct;
        hit.indirectSales += indirect;
        hit.totalSales += direct + indirect;
      }
    }
    dates.sort();
    const minDateStr = dates[0];
    const maxDateStr = dates[dates.length - 1];
    const result: { date: string; directSales: number; indirectSales: number; totalSales: number }[] = [];
    const current = new Date(minDateStr);
    const end = new Date(maxDateStr);
    current.setUTCHours(0, 0, 0, 0);
    end.setUTCHours(0, 0, 0, 0);
    while (current <= end) {
      const ymd = current.toISOString().slice(0, 10);
      const hit = dailyMap.get(ymd);
      if (hit) {
        result.push(hit);
      } else {
        result.push({ date: ymd, directSales: 0, indirectSales: 0, totalSales: 0 });
      }
      current.setDate(current.getDate() + 1);
    }
    return result.map((row) => ({
      ...row,
      directShare: row.totalSales > 0 ? row.directSales / row.totalSales : 0,
      indirectShare: row.totalSales > 0 ? row.indirectSales / row.totalSales : 0,
    }));
  }, [filteredData]);
  const campaignAdGroupSummary = useMemo(() => {
    if (!filteredData.length) {
      return {
        totalSpend: 0,
        totalSales: 0,
        totalOrders: 0,
        totalClicks: 0,
        totalImpressions: 0,
        campaigns: [] as Array<{
          campaignName: string;
          spend: number;
          clicks: number;
          sales: number;
          orders: number;
          impressions: number;
          ctr: number;
          cpc: number;
          acos: number;
          roas: number;
          conversionRate: number;
          cpa: number;
          spendShare: number;
          salesShare: number;
        }>,
        adGroups: [] as Array<{
          campaignName: string;
          adGroupName: string;
          spend: number;
          clicks: number;
          sales: number;
          orders: number;
          impressions: number;
          ctr: number;
          cpc: number;
          acos: number;
          roas: number;
          conversionRate: number;
          cpa: number;
          spendShare: number;
          salesShare: number;
        }>,
      };
    }
    const minCampaignSpend = Math.max(0, Number(campaignMinSpend) || 0);
    const maxCampaignSpend = Number(campaignMaxSpend);
    const minCampaignClicks = Math.max(0, Math.floor(Number(campaignMinClicks) || 0));
    const maxCampaignClicks = Math.floor(Number(campaignMaxClicks) || 0);
    const minCampaignOrders = Math.max(0, Math.floor(Number(campaignMinOrders) || 0));
    const maxCampaignOrders = Math.floor(Number(campaignMaxOrders) || 0);
    const minCampaignImpressions = Math.max(0, Math.floor(Number(campaignMinImpressions) || 0));
    const maxCampaignImpressions = Math.floor(Number(campaignMaxImpressions) || 0);
    const minCampaignSales = Math.max(0, Number(campaignMinSales) || 0);
    const maxCampaignSales = Number(campaignMaxSales);
    const minCampaignCtrPct = Math.max(0, Number(campaignMinCtr) || 0);
    const maxCampaignCtrPct = Number(campaignMaxCtr);
    const minCampaignCpc = Math.max(0, Number(campaignMinCpc) || 0);
    const maxCampaignCpc = Number(campaignMaxCpc);
    const minCampaignAcos = Math.max(0, Number(campaignMinAcos) || 0);
    const maxCampaignAcos = Number(campaignMaxAcos);
    const minCampaignRoas = Math.max(0, Number(campaignMinRoas) || 0);
    const maxCampaignRoas = Number(campaignMaxRoas);
    const minCampaignConversionPct = Math.max(0, Number(campaignMinConversionRate) || 0);
    const maxCampaignConversionPct = Number(campaignMaxConversionRate);
    const minCampaignCpa = Math.max(0, Number(campaignMinCpa) || 0);
    const maxCampaignCpa = Number(campaignMaxCpa);
    const campaignQueryText = campaignQuery.trim().toLowerCase();
    const adGroupQueryText = adGroupQuery.trim().toLowerCase();
    const totalSpend = filteredData.reduce((acc, r) => acc + r.spend, 0);
    const totalSales = filteredData.reduce((acc, r) => acc + r.sales, 0);
    const totalOrders = filteredData.reduce((acc, r) => acc + r.orders, 0);
    const totalClicks = filteredData.reduce((acc, r) => acc + r.clicks, 0);
    const totalImpressions = filteredData.reduce((acc, r) => acc + r.impressions, 0);
    const campaignMap = new Map<
      string,
      {
        campaignName: string;
        spend: number;
        clicks: number;
        sales: number;
        orders: number;
        impressions: number;
      }
    >();
    const adGroupMap = new Map<
      string,
      {
        campaignName: string;
        adGroupName: string;
        spend: number;
        clicks: number;
        sales: number;
        orders: number;
        impressions: number;
      }
    >();
    for (const row of filteredData) {
      const campaignKey = row.campaignName.trim() || 'Unknown';
      const campaignHit = campaignMap.get(campaignKey);
      if (!campaignHit) {
        campaignMap.set(campaignKey, {
          campaignName: campaignKey,
          spend: row.spend,
          clicks: row.clicks,
          sales: row.sales,
          orders: row.orders,
          impressions: row.impressions,
        });
      } else {
        campaignHit.spend += row.spend;
        campaignHit.clicks += row.clicks;
        campaignHit.sales += row.sales;
        campaignHit.orders += row.orders;
        campaignHit.impressions += row.impressions;
      }
      const adGroupKey = `${campaignKey}||${row.adGroupName.trim() || 'Unknown'}`;
      const adGroupHit = adGroupMap.get(adGroupKey);
      if (!adGroupHit) {
        adGroupMap.set(adGroupKey, {
          campaignName: campaignKey,
          adGroupName: row.adGroupName.trim() || 'Unknown',
          spend: row.spend,
          clicks: row.clicks,
          sales: row.sales,
          orders: row.orders,
          impressions: row.impressions,
        });
      } else {
        adGroupHit.spend += row.spend;
        adGroupHit.clicks += row.clicks;
        adGroupHit.sales += row.sales;
        adGroupHit.orders += row.orders;
        adGroupHit.impressions += row.impressions;
      }
    }
    const campaigns = Array.from(campaignMap.values())
      .map((r) => ({
        ...r,
        ctr: r.impressions > 0 ? r.clicks / r.impressions : 0,
        cpc: r.clicks > 0 ? r.spend / r.clicks : 0,
        acos: r.sales > 0 ? (r.spend / r.sales) * 100 : r.spend > 0 ? Number.POSITIVE_INFINITY : 0,
        roas: r.spend > 0 ? r.sales / r.spend : 0,
        conversionRate: r.clicks > 0 ? r.orders / r.clicks : 0,
        cpa: r.orders > 0 ? r.spend / r.orders : r.spend > 0 ? Number.POSITIVE_INFINITY : 0,
        spendShare: totalSpend > 0 ? r.spend / totalSpend : 0,
        salesShare: totalSales > 0 ? r.sales / totalSales : 0,
      }))
      .sort((a, b) => b.spend - a.spend);
    const adGroups = Array.from(adGroupMap.values())
      .map((r) => ({
        ...r,
        ctr: r.impressions > 0 ? r.clicks / r.impressions : 0,
        cpc: r.clicks > 0 ? r.spend / r.clicks : 0,
        acos: r.sales > 0 ? (r.spend / r.sales) * 100 : r.spend > 0 ? Number.POSITIVE_INFINITY : 0,
        roas: r.spend > 0 ? r.sales / r.spend : 0,
        conversionRate: r.clicks > 0 ? r.orders / r.clicks : 0,
        cpa: r.orders > 0 ? r.spend / r.orders : r.spend > 0 ? Number.POSITIVE_INFINITY : 0,
        spendShare: totalSpend > 0 ? r.spend / totalSpend : 0,
        salesShare: totalSales > 0 ? r.sales / totalSales : 0,
      }))
      .sort((a, b) => b.spend - a.spend);
    const matchesFilters = (r: (typeof campaigns)[number]) => {
      if (minCampaignSpend > 0 && r.spend < minCampaignSpend) return false;
      if (Number.isFinite(maxCampaignSpend) && maxCampaignSpend > 0 && r.spend > maxCampaignSpend) return false;
      if (minCampaignClicks > 0 && r.clicks < minCampaignClicks) return false;
      if (maxCampaignClicks > 0 && r.clicks > maxCampaignClicks) return false;
      if (minCampaignOrders > 0 && r.orders < minCampaignOrders) return false;
      if (maxCampaignOrders > 0 && r.orders > maxCampaignOrders) return false;
      if (minCampaignImpressions > 0 && r.impressions < minCampaignImpressions) return false;
      if (maxCampaignImpressions > 0 && r.impressions > maxCampaignImpressions) return false;
      if (minCampaignSales > 0 && r.sales < minCampaignSales) return false;
      if (Number.isFinite(maxCampaignSales) && maxCampaignSales > 0 && r.sales > maxCampaignSales) return false;
      if (minCampaignCtrPct > 0 && r.ctr * 100 < minCampaignCtrPct) return false;
      if (Number.isFinite(maxCampaignCtrPct) && maxCampaignCtrPct > 0 && r.ctr * 100 > maxCampaignCtrPct) return false;
      if (minCampaignCpc > 0 && r.cpc < minCampaignCpc) return false;
      if (Number.isFinite(maxCampaignCpc) && maxCampaignCpc > 0 && r.cpc > maxCampaignCpc) return false;
      const acosForFilter = r.sales > 0 ? r.acos : r.spend > 0 ? Number.POSITIVE_INFINITY : 0;
      if (minCampaignAcos > 0 && acosForFilter < minCampaignAcos) return false;
      if (Number.isFinite(maxCampaignAcos) && maxCampaignAcos > 0 && acosForFilter > maxCampaignAcos) return false;
      if (minCampaignRoas > 0 && r.roas < minCampaignRoas) return false;
      if (Number.isFinite(maxCampaignRoas) && maxCampaignRoas > 0 && r.roas > maxCampaignRoas) return false;
      if (minCampaignConversionPct > 0 && r.conversionRate * 100 < minCampaignConversionPct) return false;
      if (
        Number.isFinite(maxCampaignConversionPct) &&
        maxCampaignConversionPct > 0 &&
        r.conversionRate * 100 > maxCampaignConversionPct
      )
        return false;
      const cpaForFilter = r.orders > 0 ? r.cpa : r.spend > 0 ? Number.POSITIVE_INFINITY : 0;
      if (minCampaignCpa > 0 && cpaForFilter < minCampaignCpa) return false;
      if (Number.isFinite(maxCampaignCpa) && maxCampaignCpa > 0 && cpaForFilter > maxCampaignCpa) return false;
      return true;
    };
    const campaignRows = campaigns
      .filter(matchesFilters)
      .filter((r) => (campaignQueryText ? r.campaignName.toLowerCase().includes(campaignQueryText) : true));
    const adGroupRows = adGroups
      .filter(matchesFilters)
      .filter((r) => (campaignQueryText ? r.campaignName.toLowerCase().includes(campaignQueryText) : true))
      .filter((r) => (adGroupQueryText ? r.adGroupName.toLowerCase().includes(adGroupQueryText) : true));
    return {
      totalSpend,
      totalSales,
      totalOrders,
      totalClicks,
      totalImpressions,
      campaigns: campaignRows,
      adGroups: adGroupRows,
    };
  }, [
    campaignMaxAcos,
    campaignMaxClicks,
    campaignMaxCpa,
    campaignMaxCpc,
    campaignMaxConversionRate,
    campaignMaxCtr,
    campaignMaxImpressions,
    campaignMaxOrders,
    campaignMaxRoas,
    campaignMaxSales,
    campaignMaxSpend,
    campaignMinAcos,
    campaignMinClicks,
    campaignMinCpa,
    campaignMinCpc,
    campaignMinConversionRate,
    campaignMinCtr,
    campaignMinImpressions,
    campaignMinOrders,
    campaignMinRoas,
    campaignMinSales,
    campaignMinSpend,
    campaignQuery,
    adGroupQuery,
    filteredData,
  ]);
  const campaignSortedRows = useMemo(() => {
    const rows = [...campaignAdGroupSummary.campaigns];
    rows.sort((a, b) => {
      if (campaignSortKey === 'campaignName') {
        const cmp = a.campaignName.localeCompare(b.campaignName, 'zh-Hans-CN');
        return campaignSortDir === 'asc' ? cmp : -cmp;
      }
      const av = a[campaignSortKey];
      const bv = b[campaignSortKey];
      if (av === bv) return a.campaignName.localeCompare(b.campaignName, 'zh-Hans-CN');
      return campaignSortDir === 'asc' ? av - bv : bv - av;
    });
    return rows;
  }, [campaignAdGroupSummary.campaigns, campaignSortDir, campaignSortKey]);
  const adGroupSortedRows = useMemo(() => {
    const rows = [...campaignAdGroupSummary.adGroups];
    rows.sort((a, b) => {
      if (adGroupSortKey === 'campaignName') {
        const cmp = a.campaignName.localeCompare(b.campaignName, 'zh-Hans-CN');
        if (cmp !== 0) return adGroupSortDir === 'asc' ? cmp : -cmp;
        const next = a.adGroupName.localeCompare(b.adGroupName, 'zh-Hans-CN');
        return adGroupSortDir === 'asc' ? next : -next;
      }
      if (adGroupSortKey === 'adGroupName') {
        const cmp = a.adGroupName.localeCompare(b.adGroupName, 'zh-Hans-CN');
        if (cmp !== 0) return adGroupSortDir === 'asc' ? cmp : -cmp;
        const next = a.campaignName.localeCompare(b.campaignName, 'zh-Hans-CN');
        return adGroupSortDir === 'asc' ? next : -next;
      }
      const av = a[adGroupSortKey];
      const bv = b[adGroupSortKey];
      if (av === bv) {
        const cmp = a.campaignName.localeCompare(b.campaignName, 'zh-Hans-CN');
        return cmp === 0
          ? a.adGroupName.localeCompare(b.adGroupName, 'zh-Hans-CN')
          : cmp;
      }
      return adGroupSortDir === 'asc' ? av - bv : bv - av;
    });
    return rows;
  }, [adGroupSortDir, adGroupSortKey, campaignAdGroupSummary.adGroups]);
  const wasteCriteriaLabel = useMemo(() => {
    if (wasteCriteria === 'ordersZero') return '订单=0';
    if (wasteCriteria === 'salesZero') return '销售额=0';
    return '订单=0 且 销售额=0';
  }, [wasteCriteria]);
  const wasteRanking = useMemo(() => {
    const isWasteRow = (orders: number, sales: number) => {
      if (wasteCriteria === 'ordersZero') return orders <= 0;
      if (wasteCriteria === 'salesZero') return sales <= 0;
      return orders <= 0 && sales <= 0;
    };
    if (!filteredData.length) {
      return {
        totalWasteSpend: 0,
        totalWasteClicks: 0,
        totalWasteOrders: 0,
        totalWasteSales: 0,
        adGroups: [] as Array<{
          campaignName: string;
          adGroupName: string;
          spend: number;
          sales: number;
          orders: number;
          clicks: number;
          impressions: number;
          ctr: number;
          cpc: number;
          wasteSpend: number;
          wasteClicks: number;
          wasteOrders: number;
          wasteSales: number;
          wasteShare: number;
          effectiveSpend: number;
          effectiveOrders: number;
          effectiveSales: number;
        }>,
        terms: [] as Array<{
          term: string;
          spend: number;
          sales: number;
          orders: number;
          clicks: number;
          impressions: number;
          ctr: number;
          cpc: number;
          wasteSpend: number;
          wasteClicks: number;
          wasteOrders: number;
          wasteSales: number;
          wasteShare: number;
          effectiveSpend: number;
          effectiveOrders: number;
          effectiveSales: number;
          campaignLabel: string;
          adGroupLabel: string;
          campaignNames: string[];
          adGroupNames: string[];
        }>,
      };
    }
    const adGroupMap = new Map<
      string,
      {
        campaignName: string;
        adGroupName: string;
        spend: number;
        sales: number;
        orders: number;
        clicks: number;
        impressions: number;
        wasteSpend: number;
        wasteClicks: number;
        wasteOrders: number;
        wasteSales: number;
      }
    >();
    const termMap = new Map<
      string,
      {
        term: string;
        spend: number;
        sales: number;
        orders: number;
        clicks: number;
        impressions: number;
        wasteSpend: number;
        wasteClicks: number;
        wasteOrders: number;
        wasteSales: number;
        campaignSet: Set<string>;
        adGroupSet: Set<string>;
      }
    >();
    let totalWasteSpend = 0;
    let totalWasteClicks = 0;
    let totalWasteOrders = 0;
    let totalWasteSales = 0;

    for (const row of filteredData) {
      const campaignName = row.campaignName.trim() || 'Unknown';
      const adGroupName = row.adGroupName.trim() || 'Unknown';
      const adGroupKey = `${campaignName}||${adGroupName}`;
      const adGroupHit = adGroupMap.get(adGroupKey);
      if (!adGroupHit) {
        adGroupMap.set(adGroupKey, {
          campaignName,
          adGroupName,
          spend: row.spend,
          sales: row.sales,
          orders: row.orders,
          clicks: row.clicks,
          impressions: row.impressions,
          wasteSpend: 0,
          wasteClicks: 0,
          wasteOrders: 0,
          wasteSales: 0,
        });
      } else {
        adGroupHit.spend += row.spend;
        adGroupHit.sales += row.sales;
        adGroupHit.orders += row.orders;
        adGroupHit.clicks += row.clicks;
        adGroupHit.impressions += row.impressions;
      }

      const termKey = normalizeTerm(row.searchTerm);
      if (termKey) {
        const termHit = termMap.get(termKey);
        if (!termHit) {
          termMap.set(termKey, {
            term: row.searchTerm.trim(),
            spend: row.spend,
            sales: row.sales,
            orders: row.orders,
            clicks: row.clicks,
            impressions: row.impressions,
            wasteSpend: 0,
            wasteClicks: 0,
            wasteOrders: 0,
            wasteSales: 0,
            campaignSet: new Set(row.campaignName.trim() ? [row.campaignName.trim()] : []),
            adGroupSet: new Set(row.adGroupName.trim() ? [row.adGroupName.trim()] : []),
          });
        } else {
          termHit.spend += row.spend;
          termHit.sales += row.sales;
          termHit.orders += row.orders;
          termHit.clicks += row.clicks;
          termHit.impressions += row.impressions;
          if (row.campaignName.trim()) termHit.campaignSet.add(row.campaignName.trim());
          if (row.adGroupName.trim()) termHit.adGroupSet.add(row.adGroupName.trim());
        }
      }

      if (isWasteRow(row.orders, row.sales)) {
        totalWasteSpend += row.spend;
        totalWasteClicks += row.clicks;
        totalWasteOrders += row.orders;
        totalWasteSales += row.sales;
        const adGroupRow = adGroupMap.get(adGroupKey);
        if (adGroupRow) {
          adGroupRow.wasteSpend += row.spend;
          adGroupRow.wasteClicks += row.clicks;
          adGroupRow.wasteOrders += row.orders;
          adGroupRow.wasteSales += row.sales;
        }
        if (termKey) {
          const termRow = termMap.get(termKey);
          if (termRow) {
            termRow.wasteSpend += row.spend;
            termRow.wasteClicks += row.clicks;
            termRow.wasteOrders += row.orders;
            termRow.wasteSales += row.sales;
          }
        }
      }
    }

    const adGroups = Array.from(adGroupMap.values())
      .filter((r) => r.wasteSpend > 0)
      .map((r) => ({
        ...r,
        ctr: r.impressions > 0 ? r.clicks / r.impressions : 0,
        cpc: r.clicks > 0 ? r.spend / r.clicks : 0,
        wasteShare: r.spend > 0 ? r.wasteSpend / r.spend : 0,
        effectiveSpend: Math.max(0, r.spend - r.wasteSpend),
        effectiveOrders: Math.max(0, r.orders - r.wasteOrders),
        effectiveSales: Math.max(0, r.sales - r.wasteSales),
      }))
      .sort((a, b) => b.wasteSpend - a.wasteSpend || b.wasteClicks - a.wasteClicks || b.spend - a.spend);

    const terms = Array.from(termMap.values())
      .filter((r) => r.wasteSpend > 0)
      .map((r) => {
        const campaignInfo = summarizeNames(r.campaignSet);
        const adGroupInfo = summarizeNames(r.adGroupSet);
        return {
          ...r,
          ctr: r.impressions > 0 ? r.clicks / r.impressions : 0,
          cpc: r.clicks > 0 ? r.spend / r.clicks : 0,
          wasteShare: r.spend > 0 ? r.wasteSpend / r.spend : 0,
          effectiveSpend: Math.max(0, r.spend - r.wasteSpend),
          effectiveOrders: Math.max(0, r.orders - r.wasteOrders),
          effectiveSales: Math.max(0, r.sales - r.wasteSales),
          campaignLabel: campaignInfo.label,
          adGroupLabel: adGroupInfo.label,
          campaignNames: campaignInfo.names,
          adGroupNames: adGroupInfo.names,
        };
      })
      .sort((a, b) => b.wasteSpend - a.wasteSpend || b.wasteClicks - a.wasteClicks || b.spend - a.spend);

    return { totalWasteSpend, totalWasteClicks, totalWasteOrders, totalWasteSales, adGroups, terms };
  }, [filteredData, normalizeTerm, wasteCriteria]);
  const wasteAdGroupSortedRows = useMemo(() => {
    const rows = [...wasteRanking.adGroups];
    rows.sort((a, b) => {
      const dir = wasteAdGroupSortDir === 'asc' ? 1 : -1;
      if (wasteAdGroupSortKey === 'campaignName') {
        const cmp = a.campaignName.localeCompare(b.campaignName, 'zh-Hans-CN');
        if (cmp !== 0) return dir * cmp;
        return dir * a.adGroupName.localeCompare(b.adGroupName, 'zh-Hans-CN');
      }
      if (wasteAdGroupSortKey === 'adGroupName') {
        const cmp = a.adGroupName.localeCompare(b.adGroupName, 'zh-Hans-CN');
        if (cmp !== 0) return dir * cmp;
        return dir * a.campaignName.localeCompare(b.campaignName, 'zh-Hans-CN');
      }
      if (wasteAdGroupSortKey === 'orders') {
        if (a.effectiveOrders === b.effectiveOrders) return dir * (a.wasteSpend - b.wasteSpend);
        return dir * (a.effectiveOrders - b.effectiveOrders);
      }
      const av = a[wasteAdGroupSortKey];
      const bv = b[wasteAdGroupSortKey];
      if (av === bv) return dir * (a.wasteSpend - b.wasteSpend);
      return dir * (av - bv);
    });
    return rows;
  }, [wasteAdGroupSortDir, wasteAdGroupSortKey, wasteRanking.adGroups]);
  const wasteTermSortedRows = useMemo(() => {
    const rows = [...wasteRanking.terms];
    rows.sort((a, b) => {
      const dir = wasteTermSortDir === 'asc' ? 1 : -1;
      if (wasteTermSortKey === 'term') return dir * a.term.localeCompare(b.term, 'zh-Hans-CN');
      if (wasteTermSortKey === 'orders') {
        if (a.effectiveOrders === b.effectiveOrders) return dir * (a.wasteSpend - b.wasteSpend);
        return dir * (a.effectiveOrders - b.effectiveOrders);
      }
      const av = a[wasteTermSortKey];
      const bv = b[wasteTermSortKey];
      if (av === bv) return dir * (a.wasteSpend - b.wasteSpend);
      return dir * (av - bv);
    });
    return rows;
  }, [wasteTermSortDir, wasteTermSortKey, wasteRanking.terms]);
  const wasteAdGroupRows = useMemo(() => wasteAdGroupSortedRows.slice(0, wasteTopN), [wasteAdGroupSortedRows, wasteTopN]);
  const wasteTermRows = useMemo(() => wasteTermSortedRows.slice(0, wasteTopN), [wasteTermSortedRows, wasteTopN]);
  const wasteAdGroupDetailSummary = useMemo(() => {
    const isWasteRow = (orders: number, sales: number) => {
      if (wasteCriteria === 'ordersZero') return orders <= 0;
      if (wasteCriteria === 'salesZero') return sales <= 0;
      return orders <= 0 && sales <= 0;
    };
    if (!wasteAdGroupDetail) return null;
    const { campaignName, adGroupName } = wasteAdGroupDetail;
    const rows = filteredData.filter(
      (row) => row.campaignName.trim() === campaignName && row.adGroupName.trim() === adGroupName
    );
    const termMap = new Map<
      string,
      {
        term: string;
        spend: number;
        sales: number;
        orders: number;
        clicks: number;
        impressions: number;
        wasteSpend: number;
        wasteClicks: number;
        wasteOrders: number;
        wasteSales: number;
      }
    >();
    let spend = 0;
    let sales = 0;
    let orders = 0;
    let clicks = 0;
    let impressions = 0;
    let wasteSpend = 0;
    let wasteClicks = 0;
    let wasteOrders = 0;
    let wasteSales = 0;

    for (const row of rows) {
      spend += row.spend;
      sales += row.sales;
      orders += row.orders;
      clicks += row.clicks;
      impressions += row.impressions;
      const termKey = normalizeTerm(row.searchTerm);
      if (termKey) {
        const termHit = termMap.get(termKey);
        if (!termHit) {
          termMap.set(termKey, {
            term: row.searchTerm.trim(),
            spend: row.spend,
            sales: row.sales,
            orders: row.orders,
            clicks: row.clicks,
            impressions: row.impressions,
            wasteSpend: 0,
            wasteClicks: 0,
            wasteOrders: 0,
            wasteSales: 0,
          });
        } else {
          termHit.spend += row.spend;
          termHit.sales += row.sales;
          termHit.orders += row.orders;
          termHit.clicks += row.clicks;
          termHit.impressions += row.impressions;
        }
      }
      if (isWasteRow(row.orders, row.sales)) {
        wasteSpend += row.spend;
        wasteClicks += row.clicks;
        wasteOrders += row.orders;
        wasteSales += row.sales;
        if (termKey) {
          const termRow = termMap.get(termKey);
          if (termRow) {
            termRow.wasteSpend += row.spend;
            termRow.wasteClicks += row.clicks;
            termRow.wasteOrders += row.orders;
            termRow.wasteSales += row.sales;
          }
        }
      }
    }

    const terms = Array.from(termMap.values())
      .filter((r) => r.wasteSpend > 0)
      .map((r) => ({
        ...r,
        wasteShare: r.spend > 0 ? r.wasteSpend / r.spend : 0,
        effectiveSpend: Math.max(0, r.spend - r.wasteSpend),
        effectiveOrders: Math.max(0, r.orders - r.wasteOrders),
        effectiveSales: Math.max(0, r.sales - r.wasteSales),
      }))
      .sort((a, b) => b.wasteSpend - a.wasteSpend || b.wasteClicks - a.wasteClicks || b.spend - a.spend);

    return {
      campaignName,
      adGroupName,
      totalRows: rows.length,
      spend,
      sales,
      orders,
      clicks,
      impressions,
      wasteSpend,
      wasteClicks,
      wasteOrders,
      wasteSales,
      effectiveSpend: Math.max(0, spend - wasteSpend),
      effectiveOrders: Math.max(0, orders - wasteOrders),
      effectiveSales: Math.max(0, sales - wasteSales),
      terms,
    };
  }, [filteredData, normalizeTerm, wasteAdGroupDetail, wasteCriteria]);
  const wasteAdGroupDetailFilteredTerms = useMemo(() => {
    if (!wasteAdGroupDetailSummary) return [];
    const query = wasteAdGroupFilterQuery.trim().toLowerCase();
    return wasteAdGroupDetailSummary.terms.filter((row) => {
      if (wasteAdGroupFilterDimension === 'asin' && !isAsin(row.term)) return false;
      if (wasteAdGroupFilterDimension === 'search' && isAsin(row.term)) return false;
      if (query && !row.term.toLowerCase().includes(query)) return false;
      return true;
    });
  }, [isAsin, wasteAdGroupFilterDimension, wasteAdGroupFilterQuery, wasteAdGroupDetailSummary]);
  const jumpToSection = useCallback((id: string) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, []);
  const [topQuickDays, setTopQuickDays] = useState<0 | 7 | 14 | 30>(0);
  const [compareTerm, setCompareTerm] = useState<string | null>(null);
  const [compareAdGroupKey, setCompareAdGroupKey] = useState<string | null>(null);
  const [compareCustomRange, setCompareCustomRange] = useState<DateRange | undefined>(undefined);
  const [rootDetail, setRootDetail] = useState<string | null>(null);
  const compareTermRows = useMemo(() => {
    if (!compareTerm) return [];
    const key = normalizeTerm(compareTerm);
    if (!key) return [];
    return compareBaseData.filter((r) => normalizeTerm(r.searchTerm) === key);
  }, [compareBaseData, compareTerm, normalizeTerm]);
  const compareSummary = useMemo(() => {
    if (!compareTerm) return null;
    const toYmdUtc = (d: Date) =>
      new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())).toISOString().slice(0, 10);
    const dates = compareTermRows.map((r) => r.date).filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d));
    const minYmd = dates.length ? dates.reduce((acc, d) => (d < acc ? d : acc), dates[0]) : null;
    const maxYmd = dates.length ? dates.reduce((acc, d) => (d > acc ? d : acc), dates[0]) : null;
    const campaignNames = Array.from(new Set(compareTermRows.map((r) => r.campaignName.trim()).filter(Boolean))).sort(
      (a, b) => a.localeCompare(b, 'zh-Hans-CN')
    );
    const adGroupNames = Array.from(new Set(compareTermRows.map((r) => r.adGroupName.trim()).filter(Boolean))).sort(
      (a, b) => a.localeCompare(b, 'zh-Hans-CN')
    );
    const matchTypes = Array.from(new Set(compareTermRows.map((r) => r.matchType.trim()).filter(Boolean))).sort(
      (a, b) => a.localeCompare(b, 'zh-Hans-CN')
    );
    const buildMetrics = (rows: typeof compareTermRows) => {
      if (!rows.length) {
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
          cpa: 0,
          aov: 0,
          rows: 0,
        };
      }
      const spend = rows.reduce((acc, curr) => acc + curr.spend, 0);
      const sales = rows.reduce((acc, curr) => acc + curr.sales, 0);
      const clicks = rows.reduce((acc, curr) => acc + curr.clicks, 0);
      const impressions = rows.reduce((acc, curr) => acc + curr.impressions, 0);
      const orders = rows.reduce((acc, curr) => acc + curr.orders, 0);
      const acos = sales > 0 ? (spend / sales) * 100 : 0;
      const roas = spend > 0 ? sales / spend : 0;
      const ctr = impressions > 0 ? clicks / impressions : 0;
      const cpc = clicks > 0 ? spend / clicks : 0;
      const conversionRate = clicks > 0 ? orders / clicks : 0;
      const cpa = orders > 0 ? spend / orders : spend > 0 ? Number.POSITIVE_INFINITY : 0;
      const aov = orders > 0 ? sales / orders : 0;
      return { spend, sales, clicks, impressions, orders, acos, roas, ctr, cpc, conversionRate, cpa, aov, rows: rows.length };
    };
    const getRangeRows = (days: 0 | 7 | 14 | 30) => {
      if (!days) {
        return {
          rows: compareTermRows,
          rangeText: minYmd && maxYmd ? `${minYmd} ~ ${maxYmd}` : '—',
        };
      }
      if (!maxYmd) {
        return {
          rows: [],
          rangeText: '—',
        };
      }
      const max = new Date(`${maxYmd}T00:00:00.000Z`).getTime();
      const cutoff = new Date(max - (days - 1) * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
      return {
        rows: compareTermRows.filter((r) => r.date && r.date >= cutoff),
        rangeText: `${cutoff} ~ ${maxYmd}`,
      };
    };
    const customFromYmd = compareCustomRange?.from ? toYmdUtc(compareCustomRange.from) : null;
    const customToYmd = compareCustomRange?.to ? toYmdUtc(compareCustomRange.to) : null;
    const customRange =
      customFromYmd && customToYmd
        ? {
            label: '自定义',
            rangeText: `${customFromYmd} ~ ${customToYmd}`,
            metrics: buildMetrics(
              compareTermRows.filter((r) => r.date && r.date >= customFromYmd && r.date <= customToYmd)
            ),
          }
        : null;
    const ranges = ([
      { label: '近7天', days: 7 as const },
      { label: '近14天', days: 14 as const },
      { label: '近30天', days: 30 as const },
      { label: '全部', days: 0 as const },
    ] as const).map((range) => {
      const rangeRows = getRangeRows(range.days);
      return {
        label: range.label,
        rangeText: rangeRows.rangeText,
        metrics: buildMetrics(rangeRows.rows),
      };
    });
    const mergedRanges = customRange ? [customRange, ...ranges] : ranges;

    // Group by Campaign + AdGroup
    const byAdGroupMap = new Map<string, {
      key: string;
      campaignName: string;
      adGroupName: string;
      rows: typeof compareTermRows;
    }>();

    for (const row of compareTermRows) {
      // Apply custom date range filter if exists
      if (customFromYmd && customToYmd) {
        if (!row.date || row.date < customFromYmd || row.date > customToYmd) continue;
      }

      const key = `${row.campaignName}|${row.adGroupName}`;
      if (!byAdGroupMap.has(key)) {
        byAdGroupMap.set(key, {
          key,
          campaignName: row.campaignName,
          adGroupName: row.adGroupName,
          rows: [],
        });
      }
      byAdGroupMap.get(key)!.rows.push(row);
    }

    const byAdGroup = Array.from(byAdGroupMap.values()).map(group => ({
      key: group.key,
      campaignName: group.campaignName,
      adGroupName: group.adGroupName,
      metrics: buildMetrics(group.rows),
    })).sort((a, b) => b.metrics.orders - a.metrics.orders || b.metrics.spend - a.metrics.spend);

    return {
      term: compareTerm,
      totalRows: compareTermRows.length,
      minYmd,
      maxYmd,
      ranges: mergedRanges,
      byAdGroup,
      campaignNames,
      adGroupNames,
      matchTypes,
    };
  }, [compareCustomRange, compareTerm, compareTermRows]);
  const compareMinDate = compareSummary?.minYmd ? new Date(`${compareSummary.minYmd}T00:00:00.000Z`) : null;
  const compareMaxDate = compareSummary?.maxYmd ? new Date(`${compareSummary.maxYmd}T00:00:00.000Z`) : null;
  const handleCompareTerm = useCallback((term: string) => {
    setCompareTerm(term);
    setCompareAdGroupKey(null);
    setCompareCustomRange(undefined);
  }, []);
  const handleRootTermCompare = useCallback((term: string) => {
    setRootDetail(null);
    setCompareTerm(term);
    setCompareAdGroupKey(null);
    setCompareCustomRange(undefined);
  }, []);
  const compareTrend = useMemo(() => {
    if (!compareTermRows.length) return [];

    // 1. Collect all data into a map
    const dailyMap = new Map<string, { date: string; spend: number; sales: number; impressions: number; clicks: number; orders: number }>();
    const dates: string[] = [];
    const baseRows = compareAdGroupKey
      ? compareTermRows.filter((row) => `${row.campaignName}|${row.adGroupName}` === compareAdGroupKey)
      : compareTermRows;

    for (const row of baseRows) {
      if (!row.date || !/^\d{4}-\d{2}-\d{2}$/.test(row.date)) continue;
      dates.push(row.date);
      const hit = dailyMap.get(row.date);
      if (!hit) {
        dailyMap.set(row.date, {
          date: row.date,
          spend: row.spend,
          sales: row.sales,
          impressions: row.impressions,
          clicks: row.clicks,
          orders: row.orders,
        });
      } else {
        hit.spend += row.spend;
        hit.sales += row.sales;
        hit.impressions += row.impressions;
        hit.clicks += row.clicks;
        hit.orders += row.orders;
      }
    }

    if (!dates.length) return [];

    // 2. Find min and max date
    dates.sort();
    const minDateStr = dates[0];
    const maxDateStr = dates[dates.length - 1];

    // 3. Fill in gaps
    const result: { date: string; spend: number; sales: number; impressions: number; clicks: number; orders: number; cpc: number; ctr: number; conversionRate: number }[] = [];
    const current = new Date(minDateStr);
    const end = new Date(maxDateStr);
    
    // Reset time to avoid issues
    current.setUTCHours(0, 0, 0, 0);
    end.setUTCHours(0, 0, 0, 0);

    while (current <= end) {
      const ymd = current.toISOString().slice(0, 10);
      const hit = dailyMap.get(ymd);
      if (hit) {
        result.push({
          ...hit,
          cpc: hit.clicks > 0 ? hit.spend / hit.clicks : 0,
          ctr: hit.impressions > 0 ? (hit.clicks / hit.impressions) * 100 : 0,
          conversionRate: hit.clicks > 0 ? (hit.orders / hit.clicks) * 100 : 0,
        });
      } else {
        result.push({
          date: ymd,
          spend: 0,
          sales: 0,
          impressions: 0,
          clicks: 0,
          orders: 0,
          cpc: 0,
          ctr: 0,
          conversionRate: 0,
        });
      }
      current.setDate(current.getDate() + 1);
    }

    return result;
  }, [compareAdGroupKey, compareTermRows]);
  const compareAdGroupLabel = useMemo(() => {
    if (!compareAdGroupKey || !compareSummary) return '全部广告组';
    const hit = compareSummary.byAdGroup.find((group) => group.key === compareAdGroupKey);
    if (!hit) return '全部广告组';
    return `${hit.campaignName} / ${hit.adGroupName}`;
  }, [compareAdGroupKey, compareSummary]);
  const filteredDataForTop = useMemo(() => {
    if (!topQuickDays || !filteredData.length) return filteredData;
    const dates = filteredData.map((r) => r.date).filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d));
    if (!dates.length) return filteredData;
    const maxYmd = dates.reduce((acc, d) => (d > acc ? d : acc), dates[0]);
    const max = new Date(`${maxYmd}T00:00:00.000Z`).getTime();
    const cutoff = new Date(max - (topQuickDays - 1) * 24 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 10);
    return filteredData.filter((r) => r.date && r.date >= cutoff);
  }, [filteredData, topQuickDays]);
  const topBaseRows = useMemo(() => {
    const byTerm = new Map<
      string,
      { term: string; impressions: number; clicks: number; spend: number; sales: number; orders: number }
    >();
    for (const row of filteredDataForTop) {
      const key = normalizeTerm(row.searchTerm);
      if (!key) continue;
      const hit = byTerm.get(key);
      if (!hit) {
        byTerm.set(key, {
          term: row.searchTerm.trim(),
          impressions: row.impressions,
          clicks: row.clicks,
          spend: row.spend,
          sales: row.sales,
          orders: row.orders,
        });
      } else {
        hit.impressions += row.impressions;
        hit.clicks += row.clicks;
        hit.spend += row.spend;
        hit.sales += row.sales;
        hit.orders += row.orders;
      }
    }

    return Array.from(byTerm.values()).map((r) => {
      const ctr = r.impressions > 0 ? r.clicks / r.impressions : 0;
      const cpc = r.clicks > 0 ? r.spend / r.clicks : 0;
      const acos = r.sales > 0 ? (r.spend / r.sales) * 100 : r.spend > 0 ? Number.POSITIVE_INFINITY : 0;
      const roas = r.spend > 0 ? r.sales / r.spend : 0;
      const conversionRate = r.clicks > 0 ? r.orders / r.clicks : 0;
      const cpa = r.orders > 0 ? r.spend / r.orders : r.spend > 0 ? Number.POSITIVE_INFINITY : 0;
      return { ...r, ctr, cpc, acos, roas, conversionRate, cpa };
    });
  }, [filteredDataForTop, normalizeTerm]);

  const topDimensionRows = useMemo(() => {
    if (topDimension === 'keywords') return topBaseRows.filter((r) => !isAsin(r.term));
    if (topDimension === 'asin') return topBaseRows.filter((r) => isAsin(r.term));
    return topBaseRows;
  }, [topBaseRows, topDimension, isAsin]);

  const topFilteredRows = useMemo(() => {
    const query = topQuery.trim().toLowerCase();
    const minSpend = Math.max(0, Number(topMinSpend) || 0);
    const maxSpend = Number(topMaxSpend);
    const minClicks = Math.max(0, Math.floor(Number(topMinClicks) || 0));
    const maxClicks = Math.floor(Number(topMaxClicks) || 0);
    const minOrders = Math.max(0, Math.floor(Number(topMinOrders) || 0));
    const maxOrders = Math.floor(Number(topMaxOrders) || 0);
    const minImpressions = Math.max(0, Math.floor(Number(topMinImpressions) || 0));
    const maxImpressions = Math.floor(Number(topMaxImpressions) || 0);
    const minSales = Math.max(0, Number(topMinSales) || 0);
    const maxSales = Number(topMaxSales);
    const minCtrPct = Math.max(0, Number(topMinCtr) || 0);
    const maxCtrPct = Number(topMaxCtr);
    const minCpc = Math.max(0, Number(topMinCpc) || 0);
    const maxCpc = Number(topMaxCpc);
    const minAcos = Math.max(0, Number(topMinAcos) || 0);
    const maxAcos = Number(topMaxAcos);
    const minRoas = Math.max(0, Number(topMinRoas) || 0);
    const maxRoas = Number(topMaxRoas);
    const minCpa = Math.max(0, Number(topMinCpa) || 0);
    const maxCpa = Number(topMaxCpa);

    return topDimensionRows.filter((r) => {
      if (query && !r.term.toLowerCase().includes(query)) return false;
      if (minSpend > 0 && r.spend < minSpend) return false;
      if (Number.isFinite(maxSpend) && maxSpend > 0 && r.spend > maxSpend) return false;
      if (minClicks > 0 && r.clicks < minClicks) return false;
      if (maxClicks > 0 && r.clicks > maxClicks) return false;
      if (minOrders > 0 && r.orders < minOrders) return false;
      if (maxOrders > 0 && r.orders > maxOrders) return false;
      if (minImpressions > 0 && r.impressions < minImpressions) return false;
      if (maxImpressions > 0 && r.impressions > maxImpressions) return false;
      if (minSales > 0 && r.sales < minSales) return false;
      if (Number.isFinite(maxSales) && maxSales > 0 && r.sales > maxSales) return false;
      if (minCtrPct > 0 && r.ctr * 100 < minCtrPct) return false;
      if (Number.isFinite(maxCtrPct) && maxCtrPct > 0 && r.ctr * 100 > maxCtrPct) return false;
      if (minCpc > 0 && r.cpc < minCpc) return false;
      if (Number.isFinite(maxCpc) && maxCpc > 0 && r.cpc > maxCpc) return false;
      const acosForFilter = r.sales > 0 ? r.acos : r.spend > 0 ? Number.POSITIVE_INFINITY : 0;
      if (minAcos > 0 && acosForFilter < minAcos) return false;
      if (Number.isFinite(maxAcos) && maxAcos > 0 && acosForFilter > maxAcos) return false;
      if (minRoas > 0 && r.roas < minRoas) return false;
      if (Number.isFinite(maxRoas) && maxRoas > 0 && r.roas > maxRoas) return false;
      if (minCpa > 0 && r.cpa < minCpa) return false;
      if (Number.isFinite(maxCpa) && maxCpa > 0 && r.cpa > maxCpa) return false;
      return true;
    });
  }, [
    topDimensionRows,
    topMaxAcos,
    topMaxClicks,
    topMaxCpa,
    topMaxCpc,
    topMaxCtr,
    topMaxImpressions,
    topMaxOrders,
    topMaxRoas,
    topMaxSales,
    topMaxSpend,
    topMinAcos,
    topMinClicks,
    topMinCpa,
    topMinCpc,
    topMinCtr,
    topMinImpressions,
    topMinOrders,
    topMinRoas,
    topMinSales,
    topMinSpend,
    topQuery,
  ]);

  const topSortedRows = useMemo(() => {
    const rows = [...topFilteredRows];
    rows.sort((a, b) => {
      if (topSortKey === 'term') {
        const cmp = a.term.localeCompare(b.term, 'zh-Hans-CN');
        return topSortDir === 'asc' ? cmp : -cmp;
      }
      const av = a[topSortKey];
      const bv = b[topSortKey];
      if (av === bv) return a.term.localeCompare(b.term, 'zh-Hans-CN');
      return topSortDir === 'asc' ? av - bv : bv - av;
    });
    return rows;
  }, [topFilteredRows, topSortDir, topSortKey]);

  const topRows = useMemo(() => topSortedRows.slice(0, topN), [topN, topSortedRows]);
  const topAllSortedRows = useMemo(() => {
    const rows = [...topDimensionRows];
    rows.sort((a, b) => {
      if (topSortKey === 'term') {
        const cmp = a.term.localeCompare(b.term, 'zh-Hans-CN');
        return topSortDir === 'asc' ? cmp : -cmp;
      }
      const av = a[topSortKey];
      const bv = b[topSortKey];
      if (av === bv) return a.term.localeCompare(b.term, 'zh-Hans-CN');
      return topSortDir === 'asc' ? av - bv : bv - av;
    });
    return rows;
  }, [topDimensionRows, topSortDir, topSortKey]);
  const toggleTopSort = (key: typeof topSortKey) => {
    if (topSortKey === key) setTopSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else {
      setTopSortKey(key);
      setTopSortDir('desc');
    }
  };
  const renderTopSortIndicator = (key: typeof topSortKey) => {
    if (topSortKey !== key) return <ArrowUpDown className="size-3 opacity-50" />;
    return topSortDir === 'asc' ? <ArrowUp className="size-3 opacity-90" /> : <ArrowDown className="size-3 opacity-90" />;
  };
  const toggleCampaignSort = (key: typeof campaignSortKey) => {
    if (campaignSortKey === key) setCampaignSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else {
      setCampaignSortKey(key);
      setCampaignSortDir('desc');
    }
  };
  const renderCampaignSortIndicator = (key: typeof campaignSortKey) => {
    if (campaignSortKey !== key) return <ArrowUpDown className="size-3 opacity-50" />;
    return campaignSortDir === 'asc' ? <ArrowUp className="size-3 opacity-90" /> : <ArrowDown className="size-3 opacity-90" />;
  };
  const toggleAdGroupSort = (key: typeof adGroupSortKey) => {
    if (adGroupSortKey === key) setAdGroupSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else {
      setAdGroupSortKey(key);
      setAdGroupSortDir('desc');
    }
  };
  const renderAdGroupSortIndicator = (key: typeof adGroupSortKey) => {
    if (adGroupSortKey !== key) return <ArrowUpDown className="size-3 opacity-50" />;
    return adGroupSortDir === 'asc' ? <ArrowUp className="size-3 opacity-90" /> : <ArrowDown className="size-3 opacity-90" />;
  };
  const toggleWasteAdGroupSort = (key: typeof wasteAdGroupSortKey) => {
    if (wasteAdGroupSortKey === key) setWasteAdGroupSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else {
      setWasteAdGroupSortKey(key);
      setWasteAdGroupSortDir('desc');
    }
  };
  const renderWasteAdGroupSortIndicator = (key: typeof wasteAdGroupSortKey) => {
    if (wasteAdGroupSortKey !== key) return <ArrowUpDown className="size-3 opacity-50" />;
    return wasteAdGroupSortDir === 'asc' ? <ArrowUp className="size-3 opacity-90" /> : <ArrowDown className="size-3 opacity-90" />;
  };
  const toggleWasteTermSort = (key: typeof wasteTermSortKey) => {
    if (wasteTermSortKey === key) setWasteTermSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else {
      setWasteTermSortKey(key);
      setWasteTermSortDir('desc');
    }
  };
  const renderWasteTermSortIndicator = (key: typeof wasteTermSortKey) => {
    if (wasteTermSortKey !== key) return <ArrowUpDown className="size-3 opacity-50" />;
    return wasteTermSortDir === 'asc' ? <ArrowUp className="size-3 opacity-90" /> : <ArrowDown className="size-3 opacity-90" />;
  };
  const exportTopRows = (rows: Array<{
    term: string;
    impressions: number;
    clicks: number;
    spend: number;
    sales: number;
    orders: number;
    ctr: number;
    cpc: number;
    acos: number;
    roas: number;
    conversionRate: number;
    cpa: number;
  }>, label: string) => {
    if (!rows.length) return;
    const sheetRows = rows.map((r) => {
      const acosExport = r.sales > 0 ? Number(r.acos.toFixed(2)) : r.spend > 0 ? "∞" : Number((0).toFixed(2));
      const cpaExport = r.orders > 0 ? Number(r.cpa.toFixed(2)) : r.spend > 0 ? "∞" : Number((0).toFixed(2));
      return {
        搜索词: r.term,
        展示: r.impressions,
        点击: r.clicks,
        CTR百分比: Number((r.ctr * 100).toFixed(2)),
        CPC: Number(r.cpc.toFixed(4)),
        [`花费(${settings.currency})`]: Number(r.spend.toFixed(2)),
        [`销售额(${settings.currency})`]: Number(r.sales.toFixed(2)),
        订单: r.orders,
        ACOS百分比: acosExport,
        ROAS: Number(r.roas.toFixed(4)),
        转化率百分比: Number((r.conversionRate * 100).toFixed(2)),
        CPA: cpaExport,
      };
    });

    const ws = XLSX.utils.json_to_sheet(sheetRows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Top结果");
    const safeName = fileName ? fileName.replace(/\.[^.]+$/, "") : "分析结果";
    XLSX.writeFile(wb, `${safeName}-Top关键词-${label}.xlsx`);
  };

  const exportWasteAdGroupTerms = (
    rows: Array<{
      term: string;
      wasteSpend: number;
      wasteClicks: number;
      wasteShare: number;
      spend: number;
      effectiveOrders: number;
      sales: number;
    }>,
    label: string
  ) => {
    if (!rows.length || !wasteAdGroupDetailSummary) return;
    const sheetRows = rows.map((r) => ({
      搜索词: r.term,
      浪费花费: Number(r.wasteSpend.toFixed(2)),
      浪费点击: r.wasteClicks,
      浪费花费占比百分比: Number((r.wasteShare * 100).toFixed(2)),
      [`总花费(${settings.currency})`]: Number(r.spend.toFixed(2)),
      [`有效花费(${settings.currency})`]: Number(Math.max(0, r.spend - r.wasteSpend).toFixed(2)),
      有效订单: r.effectiveOrders,
      [`销售额(${settings.currency})`]: Number(r.sales.toFixed(2)),
    }));
    const ws = XLSX.utils.json_to_sheet(sheetRows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "广告组浪费明细");
    const safeName = fileName ? fileName.replace(/\.[^.]+$/, "") : "分析结果";
    XLSX.writeFile(wb, `${safeName}-广告组浪费明细-${label}.xlsx`);
  };

  const exportRootRows = (rows: Array<{
    root: string;
    termCount: number;
    rootCount: number;
    wasteClicks: number;
    wasteSpend: number;
    clicks: number;
    spend: number;
    impressionShare: number;
    spendShare: number;
    orders: number;
    sales: number;
    ctr: number;
    conversionRate: number;
    acos: number;
    cpa: number;
  }>, label: string) => {
    if (!rows.length) return;
    const sheetRows = rows.map((r) => {
      const acosExport = r.sales > 0 ? Number(r.acos.toFixed(2)) : r.spend > 0 ? "∞" : Number((0).toFixed(2));
      const cpaExport = r.orders > 0 ? Number(r.cpa.toFixed(2)) : r.spend > 0 ? "∞" : Number((0).toFixed(2));
      return {
        词根: r.root,
        覆盖词数: r.termCount,
        词频: r.rootCount,
        无订单点击: r.wasteClicks,
        [`无订单花费(${settings.currency})`]: Number(r.wasteSpend.toFixed(2)),
        点击: r.clicks,
        [`花费(${settings.currency})`]: Number(r.spend.toFixed(2)),
        曝光占比百分比: Number((r.impressionShare * 100).toFixed(2)),
        花费占比百分比: Number((r.spendShare * 100).toFixed(2)),
        订单: r.orders,
        [`销售额(${settings.currency})`]: Number(r.sales.toFixed(2)),
        CTR百分比: Number((r.ctr * 100).toFixed(2)),
        转化率百分比: Number((r.conversionRate * 100).toFixed(2)),
        ACOS百分比: acosExport,
        CPA: cpaExport,
      };
    });

    const ws = XLSX.utils.json_to_sheet(sheetRows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "词根统计");
    const safeName = fileName ? fileName.replace(/\.[^.]+$/, "") : "分析结果";
    XLSX.writeFile(wb, `${safeName}-词根统计-${label}.xlsx`);
  };
  const rootBaseRows = useMemo(() => {
    if (!filteredData.length) return [];
    const totalImpressions = filteredData.reduce((acc, row) => acc + row.impressions, 0);
    const totalSpend = filteredData.reduce((acc, row) => acc + row.spend, 0);
    const map = new Map<
      string,
      {
        root: string;
        impressions: number;
        clicks: number;
        spend: number;
        sales: number;
        orders: number;
        wasteSpend: number;
        wasteClicks: number;
        termSet: Set<string>;
        campaignSpendMap: Map<string, number>;
        adGroupSpendMap: Map<string, number>;
        campaignSet: Set<string>;
        adGroupSet: Set<string>;
        rootCount: number;
      }
    >();

    const addToMap = (map: Map<string, number>, key: string, value: number) => {
      if (!key) return;
      const hit = map.get(key) ?? 0;
      map.set(key, hit + value);
    };
    const pickTop = (map: Map<string, number>) => {
      let topName = '—';
      let topValue = -1;
      for (const [key, value] of map.entries()) {
        if (value > topValue) {
          topName = key;
          topValue = value;
        }
      }
      return { topName, count: map.size };
    };

    for (const row of filteredData) {
      if (rootDimension === 'keywords' && isAsin(row.searchTerm)) continue;
      const tokens = tokenizeRoot(row.searchTerm);
      if (tokens.length < rootN) continue;
      const termKey = normalizeTerm(row.searchTerm);
      for (let i = 0; i <= tokens.length - rootN; i += 1) {
        const root = tokens.slice(i, i + rootN).join(' ');
        if (!root) continue;
        let hit = map.get(root);
        if (!hit) {
          hit = {
            root,
            impressions: 0,
            clicks: 0,
            spend: 0,
            sales: 0,
            orders: 0,
            wasteSpend: 0,
            wasteClicks: 0,
            termSet: new Set<string>(),
            campaignSpendMap: new Map<string, number>(),
            adGroupSpendMap: new Map<string, number>(),
            campaignSet: new Set<string>(),
            adGroupSet: new Set<string>(),
            rootCount: 0,
          };
          map.set(root, hit);
        }
        hit.impressions += row.impressions;
        hit.clicks += row.clicks;
        hit.spend += row.spend;
        hit.sales += row.sales;
        hit.orders += row.orders;
        addToMap(hit.campaignSpendMap, row.campaignName.trim(), row.spend);
        addToMap(hit.adGroupSpendMap, row.adGroupName.trim(), row.spend);
        if (row.campaignName.trim()) hit.campaignSet.add(row.campaignName.trim());
        if (row.adGroupName.trim()) hit.adGroupSet.add(row.adGroupName.trim());
        hit.rootCount += 1;
        if (row.sales <= 0 && row.orders <= 0) {
          hit.wasteSpend += row.spend;
          hit.wasteClicks += row.clicks;
        }
        if (termKey) hit.termSet.add(termKey);
      }
    }

    return Array.from(map.values()).map((r) => {
      const ctr = r.impressions > 0 ? r.clicks / r.impressions : 0;
      const cpc = r.clicks > 0 ? r.spend / r.clicks : 0;
      const acos = r.sales > 0 ? (r.spend / r.sales) * 100 : r.spend > 0 ? Number.POSITIVE_INFINITY : 0;
      const roas = r.spend > 0 ? r.sales / r.spend : 0;
      const conversionRate = r.clicks > 0 ? r.orders / r.clicks : 0;
      const cpa = r.orders > 0 ? r.spend / r.orders : r.spend > 0 ? Number.POSITIVE_INFINITY : 0;
      const campaignTop = pickTop(r.campaignSpendMap);
      const adGroupTop = pickTop(r.adGroupSpendMap);
      const impressionShare = totalImpressions > 0 ? r.impressions / totalImpressions : 0;
      const spendShare = totalSpend > 0 ? r.spend / totalSpend : 0;
      return {
        root: r.root,
        impressions: r.impressions,
        clicks: r.clicks,
        spend: r.spend,
        sales: r.sales,
        orders: r.orders,
        wasteSpend: r.wasteSpend,
        wasteClicks: r.wasteClicks,
        termCount: r.termSet.size,
        rootCount: r.rootCount,
        impressionShare,
        spendShare,
        campaignTop: campaignTop.topName,
        campaignCount: campaignTop.count,
        adGroupTop: adGroupTop.topName,
        adGroupCount: adGroupTop.count,
        campaignNames: Array.from(r.campaignSet).sort((a, b) => a.localeCompare(b, 'zh-Hans-CN')),
        adGroupNames: Array.from(r.adGroupSet).sort((a, b) => a.localeCompare(b, 'zh-Hans-CN')),
        ctr,
        cpc,
        acos,
        roas,
        conversionRate,
        cpa,
      };
    });
  }, [filteredData, isAsin, normalizeTerm, rootDimension, rootN, tokenizeRoot]);

  const rootFilteredRows = useMemo(() => {
    const query = rootQuery.trim().toLowerCase();
    const minSpend = Math.max(0, Number(rootMinSpend) || 0);
    const minClicks = Math.max(0, Math.floor(Number(rootMinClicks) || 0));
    const minTerms = Math.max(0, Math.floor(Number(rootMinTerms) || 0));
    return rootBaseRows.filter((r) => {
      if (query && !r.root.includes(query)) return false;
      if (minSpend > 0 && r.spend < minSpend) return false;
      if (minClicks > 0 && r.clicks < minClicks) return false;
      if (minTerms > 0 && r.termCount < minTerms) return false;
      if (rootOnlyNoOrders && r.orders > 0) return false;
      if (rootOnlyNoSales && r.sales > 0) return false;
      return true;
    });
  }, [rootBaseRows, rootMinClicks, rootMinSpend, rootMinTerms, rootOnlyNoOrders, rootOnlyNoSales, rootQuery]);

  const rootSortedRows = useMemo(() => {
    const rows = [...rootFilteredRows];
    rows.sort((a, b) => {
      if (rootSortKey === 'root') {
        const cmp = a.root.localeCompare(b.root, 'zh-Hans-CN');
        return rootSortDir === 'asc' ? cmp : -cmp;
      }
      const av = a[rootSortKey];
      const bv = b[rootSortKey];
      if (av === bv) return a.root.localeCompare(b.root, 'zh-Hans-CN');
      return rootSortDir === 'asc' ? av - bv : bv - av;
    });
    return rows;
  }, [rootFilteredRows, rootSortDir, rootSortKey]);

  const rootRows = useMemo(() => rootSortedRows.slice(0, rootTopN), [rootSortedRows, rootTopN]);
  const rootDetailRows = useMemo(() => {
    if (!rootDetail) return [];
    const rootKey = normalizeTerm(rootDetail);
    if (!rootKey) return [];
    return filteredData.filter((row) => {
      if (rootDimension === 'keywords' && isAsin(row.searchTerm)) return false;
      const tokens = tokenizeRoot(row.searchTerm);
      if (tokens.length < rootN) return false;
      for (let i = 0; i <= tokens.length - rootN; i += 1) {
        if (tokens.slice(i, i + rootN).join(' ') === rootKey) return true;
      }
      return false;
    });
  }, [filteredData, isAsin, normalizeTerm, rootDetail, rootDimension, rootN, tokenizeRoot]);
  const rootDetailTermRows = useMemo(() => {
    if (!rootDetailRows.length) return [];
    const byTerm = new Map<
      string,
      {
        term: string;
        impressions: number;
        clicks: number;
        spend: number;
        sales: number;
        orders: number;
        campaignSet: Set<string>;
        adGroupSet: Set<string>;
      }
    >();
    for (const row of rootDetailRows) {
      const key = normalizeTerm(row.searchTerm);
      if (!key) continue;
      const hit = byTerm.get(key);
      if (!hit) {
        byTerm.set(key, {
          term: row.searchTerm.trim(),
          impressions: row.impressions,
          clicks: row.clicks,
          spend: row.spend,
          sales: row.sales,
          orders: row.orders,
          campaignSet: new Set(row.campaignName.trim() ? [row.campaignName.trim()] : []),
          adGroupSet: new Set(row.adGroupName.trim() ? [row.adGroupName.trim()] : []),
        });
      } else {
        hit.impressions += row.impressions;
        hit.clicks += row.clicks;
        hit.spend += row.spend;
        hit.sales += row.sales;
        hit.orders += row.orders;
        if (row.campaignName.trim()) hit.campaignSet.add(row.campaignName.trim());
        if (row.adGroupName.trim()) hit.adGroupSet.add(row.adGroupName.trim());
      }
    }

    return Array.from(byTerm.values()).map((r) => {
      const ctr = r.impressions > 0 ? r.clicks / r.impressions : 0;
      const cpc = r.clicks > 0 ? r.spend / r.clicks : 0;
      const acos = r.sales > 0 ? (r.spend / r.sales) * 100 : r.spend > 0 ? Number.POSITIVE_INFINITY : 0;
      const roas = r.spend > 0 ? r.sales / r.spend : 0;
      const conversionRate = r.clicks > 0 ? r.orders / r.clicks : 0;
      const cpa = r.orders > 0 ? r.spend / r.orders : r.spend > 0 ? Number.POSITIVE_INFINITY : 0;
      const campaignInfo = summarizeNames(r.campaignSet);
      const adGroupInfo = summarizeNames(r.adGroupSet);
      return {
        ...r,
        ctr,
        cpc,
        acos,
        roas,
        conversionRate,
        cpa,
        campaignLabel: campaignInfo.label,
        adGroupLabel: adGroupInfo.label,
        campaignNames: campaignInfo.names,
        adGroupNames: adGroupInfo.names,
      };
    });
  }, [normalizeTerm, rootDetailRows]);
  const rootDetailSummary = useMemo(() => {
    if (!rootDetail) return null;
    const spend = rootDetailRows.reduce((acc, curr) => acc + curr.spend, 0);
    const sales = rootDetailRows.reduce((acc, curr) => acc + curr.sales, 0);
    const clicks = rootDetailRows.reduce((acc, curr) => acc + curr.clicks, 0);
    const impressions = rootDetailRows.reduce((acc, curr) => acc + curr.impressions, 0);
    const orders = rootDetailRows.reduce((acc, curr) => acc + curr.orders, 0);
    const acos = sales > 0 ? (spend / sales) * 100 : spend > 0 ? Number.POSITIVE_INFINITY : 0;
    const roas = spend > 0 ? sales / spend : 0;
    const ctr = impressions > 0 ? clicks / impressions : 0;
    const cpc = clicks > 0 ? spend / clicks : 0;
    const conversionRate = clicks > 0 ? orders / clicks : 0;
    const cpa = orders > 0 ? spend / orders : spend > 0 ? Number.POSITIVE_INFINITY : 0;
    const campaignNames = Array.from(new Set(rootDetailRows.map((r) => r.campaignName.trim()).filter(Boolean))).sort(
      (a, b) => a.localeCompare(b, 'zh-Hans-CN')
    );
    const adGroupNames = Array.from(new Set(rootDetailRows.map((r) => r.adGroupName.trim()).filter(Boolean))).sort(
      (a, b) => a.localeCompare(b, 'zh-Hans-CN')
    );
    const matchTypes = Array.from(new Set(rootDetailRows.map((r) => r.matchType.trim()).filter(Boolean))).sort(
      (a, b) => a.localeCompare(b, 'zh-Hans-CN')
    );
    const terms = [...rootDetailTermRows].sort((a, b) => b.spend - a.spend || a.term.localeCompare(b.term, 'zh-Hans-CN'));
    return {
      root: rootDetail,
      rows: rootDetailRows.length,
      termCount: rootDetailTermRows.length,
      spend,
      sales,
      clicks,
      impressions,
      orders,
      acos,
      roas,
      ctr,
      cpc,
      conversionRate,
      cpa,
      campaignNames,
      adGroupNames,
      matchTypes,
      terms,
    };
  }, [rootDetail, rootDetailRows, rootDetailTermRows]);

  const toggleRootDetailExpanded = useCallback((key: string) => {
    setRootDetailExpanded((prev) => ({ ...prev, [key]: !prev[key] }));
  }, []);
  const setRootDetailExpandedState = useCallback((key: string, open: boolean) => {
    setRootDetailExpanded((prev) => ({ ...prev, [key]: open }));
  }, []);

  const renderRootDetailMultiCell = (
    kind: '广告活动' | '广告组',
    displayText: string,
    values: string[],
    rowKey: string
  ) => {
    if (!isMultiValueLabel(displayText) || !values.length) {
      return <span className="truncate">{displayText}</span>;
    }

    return (
      <HoverCard openDelay={200}>
        <HoverCardTrigger asChild>
          <button
            type="button"
            className="truncate underline decoration-dotted underline-offset-4 text-left"
            onClick={() => toggleRootDetailExpanded(rowKey)}
          >
            {displayText}
          </button>
        </HoverCardTrigger>
        <HoverCardContent align="start" className="w-[420px]">
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div className="text-sm font-medium">{kind}</div>
              <div className="text-xs text-muted-foreground">
                {values.length} 个 • 点击可展开明细
              </div>
            </div>
            <div className="flex flex-wrap gap-1">
              {values.map((v) => (
                <Badge key={v} variant="secondary">
                  {v}
                </Badge>
              ))}
            </div>
          </div>
        </HoverCardContent>
      </HoverCard>
    );
  };

  const renderRootSortIndicator = (key: typeof rootSortKey) => {
    if (rootSortKey !== key) return <ArrowUpDown className="size-3 opacity-50" />;
    return rootSortDir === 'asc' ? <ArrowUp className="size-3 opacity-90" /> : <ArrowDown className="size-3 opacity-90" />;
  };

  const rootSummary = useMemo(() => {
    const totalSpend = rootFilteredRows.reduce((acc, r) => acc + r.spend, 0);
    const totalWasteSpend = rootFilteredRows.reduce((acc, r) => acc + r.wasteSpend, 0);
    const totalClicks = rootFilteredRows.reduce((acc, r) => acc + r.clicks, 0);
    const totalOrders = rootFilteredRows.reduce((acc, r) => acc + r.orders, 0);
    return {
      rootCount: rootFilteredRows.length,
      baseCount: rootBaseRows.length,
      totalSpend,
      totalWasteSpend,
      totalClicks,
      totalOrders,
    };
  }, [rootBaseRows.length, rootFilteredRows]);

  if (!data) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-start p-4 md:py-8 overflow-y-auto">
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
          {footerInline}
        </div>
      </div>
    );
  }

  return (
    <div id="page-top" className="min-h-screen bg-background p-6 space-y-6 animate-in slide-in-from-bottom-4 duration-700">
      {/* Header */}
      <Collapsible open={usageOpen} onOpenChange={setUsageOpen}>
        <div className="flex flex-col gap-3">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <h1 className="text-2xl font-bold tracking-tight">分析看板</h1>
              <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                <span>
                  {settings.viewMode === "按搜索词汇总"
                    ? `报告：${fileName} • 原始 ${data.length} 条（汇总 ${analysisRows.length} 个搜索词）`
                    : `报告：${fileName} • 原始 ${data.length} 条，当前显示 ${analysisRows.length} 条`}
                </span>
                {reportRangeSummary ? (
                  <span>
                    {reportRangeSummary.minYmd === reportRangeSummary.maxYmd
                      ? `报告时间：${reportRangeSummary.minYmd}（${reportRangeSummary.days}天）`
                      : `报告时间：${reportRangeSummary.minYmd} ~ ${reportRangeSummary.maxYmd}（${reportRangeSummary.days}天）`}
                  </span>
                ) : null}
                <Button variant="outline" size="sm" className="gap-2" onClick={reset}>
                  <RotateCcw className="w-4 h-4" />
                  重置数据与设置
                </Button>
              </div>
            </div>
            <div className="flex flex-col items-start gap-2 md:flex-row md:items-center md:gap-3">
              <CollapsibleTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2">
                  <BookOpen className="w-4 h-4" />
                  {usageOpen ? "收起使用说明" : "查看使用说明"}
                  <ChevronDown className={`w-4 h-4 transition-transform ${usageOpen ? "rotate-180" : ""}`} />
                </Button>
              </CollapsibleTrigger>
              {copyrightInline}
            </div>
          </div>

          <CollapsibleContent>{usagePanel}</CollapsibleContent>
        </div>
      </Collapsible>

      {/* KPIs */}
      <KPIGrid 
        totalSpend={metrics.spend}
        totalSales={metrics.sales}
        directSales={metrics.directSales}
        indirectSales={metrics.indirectSales}
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

      <div className="flex flex-wrap items-center gap-2">
        <div className="text-xs text-muted-foreground">快速定位</div>
        <Button variant="outline" size="sm" onClick={() => jumpToSection('section-traffic')}>
          流量维度
        </Button>
        <Button variant="outline" size="sm" onClick={() => jumpToSection('section-performance')}>
          花费与销售维度
        </Button>
        <Button variant="outline" size="sm" onClick={() => jumpToSection('section-conversion')}>
          转化率维度
        </Button>
        <Button variant="outline" size="sm" onClick={() => jumpToSection('section-table')}>
          搜索词明细/汇总
        </Button>
        <Button variant="outline" size="sm" onClick={() => jumpToSection('section-sales-share')}>
          销售归因趋势
        </Button>
        <Button variant="outline" size="sm" onClick={() => jumpToSection('section-campaign')}>
          广告活动/广告组
        </Button>
        <Button variant="outline" size="sm" onClick={() => jumpToSection('section-suggestions')}>
          优化建议
        </Button>
        <Button variant="outline" size="sm" onClick={() => jumpToSection('section-structure')}>
          结构分析
        </Button>
        <Button variant="outline" size="sm" onClick={() => jumpToSection('section-waste')}>
          浪费花费排行榜
        </Button>
        <Button variant="outline" size="sm" onClick={() => jumpToSection('section-top')}>
          Top 关键词/搜索词
        </Button>
        <Button variant="outline" size="sm" onClick={() => jumpToSection('section-root')}>
          词根统计
        </Button>
        <Button variant="outline" size="sm" onClick={() => jumpToSection('section-scatter')}>
          散点分析
        </Button>
      </div>

      <div id="section-traffic">
        <div className="flex justify-end">
          <Button variant="ghost" size="sm" onClick={() => jumpToSection('page-top')}>
            回到顶部
          </Button>
        </div>
        <Card>
          <Collapsible open={trafficOpen} onOpenChange={setTrafficOpen}>
            <CardHeader className="pb-2">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <CardTitle>流量维度</CardTitle>
                  <CollapsibleTrigger asChild>
                    <Button variant="ghost" size="sm" className="gap-1">
                      {trafficOpen ? '收起' : '展开'}
                      <ChevronDown className={`w-4 h-4 transition-transform ${trafficOpen ? 'rotate-180' : ''}`} />
                    </Button>
                  </CollapsibleTrigger>
                </div>
                <Select value={trafficGranularity} onValueChange={(v) => setTrafficGranularity(v as typeof trafficGranularity)}>
                  <SelectTrigger className="w-[140px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent align="end">
                    <SelectItem value="day">按日</SelectItem>
                    <SelectItem value="week">按周</SelectItem>
                    <SelectItem value="month">按月</SelectItem>
                    <SelectItem value="all">全部</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CollapsibleContent>
              <CardContent>
                <div className="pb-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <span>显示</span>
                  <ToggleGroup
                    type="multiple"
                    size="sm"
                    variant="outline"
                    spacing={0}
                    value={trafficSeries}
                    onValueChange={(next) => {
                      if (!next.length) return;
                      setTrafficSeries(next as Array<'impressions' | 'clicks' | 'ctr'>);
                    }}
                  >
                    <ToggleGroupItem value="impressions">展示量</ToggleGroupItem>
                    <ToggleGroupItem value="clicks">点击量</ToggleGroupItem>
                    <ToggleGroupItem value="ctr">点击率</ToggleGroupItem>
                  </ToggleGroup>
                </div>
                <div className={cn("overflow-y-hidden", trafficChartWidth ? "overflow-x-auto" : "overflow-x-hidden")}>
                  {trafficTrend.length ? (
                    <div className="h-[320px]" style={trafficChartWidth ? { width: `${trafficChartWidth}px`, minWidth: '100%' } : undefined}>
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={trafficTrend} margin={{ top: 8, right: 12, left: 0, bottom: 8 }}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="period" tick={{ fontSize: 12 }} />
                          {trafficSeries.includes('impressions') || trafficSeries.includes('clicks') ? (
                            <YAxis yAxisId="traffic" tick={{ fontSize: 12 }} />
                          ) : null}
                          {trafficSeries.includes('ctr') ? (
                            <YAxis yAxisId="pct" orientation="right" tick={{ fontSize: 12 }} tickFormatter={(value) => `${Number(value).toFixed(1)}%`} />
                          ) : null}
                          <Tooltip
                            formatter={(value, name) => {
                              const raw = Array.isArray(value) ? value[0] : value;
                              const numeric = raw === null || raw === undefined ? null : Number(raw);
                              if (name === '点击率') return [numeric !== null && Number.isFinite(numeric) ? `${numeric.toFixed(2)}%` : '0.00%', name];
                              return [numeric !== null && Number.isFinite(numeric) ? numeric.toLocaleString() : '0', name];
                            }}
                            labelFormatter={(label) => `时间 ${label}`}
                          />
                          <Legend />
                          {trafficSeries.includes('impressions') ? (
                            <Bar yAxisId="traffic" dataKey="impressions" name="展示量" fill="var(--chart-1)" radius={[4, 4, 0, 0]} />
                          ) : null}
                          {trafficSeries.includes('clicks') ? (
                            <Bar yAxisId="traffic" dataKey="clicks" name="点击量" fill="var(--chart-2)" radius={[4, 4, 0, 0]} />
                          ) : null}
                          {trafficSeries.includes('ctr') ? (
                            <Bar yAxisId="pct" dataKey="ctr" name="点击率" fill="var(--chart-5)" radius={[4, 4, 0, 0]} />
                          ) : null}
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  ) : (
                    <div className="h-[320px] flex items-center justify-center text-sm text-muted-foreground">暂无可用日期数据</div>
                  )}
                </div>
              </CardContent>
            </CollapsibleContent>
          </Collapsible>
        </Card>
      </div>

      <div id="section-performance">
        <div className="flex justify-end">
          <Button variant="ghost" size="sm" onClick={() => jumpToSection('page-top')}>
            回到顶部
          </Button>
        </div>
        <Card>
          <Collapsible open={performanceOpen} onOpenChange={setPerformanceOpen}>
            <CardHeader className="pb-2">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <CardTitle>花费与销售维度</CardTitle>
                  <CollapsibleTrigger asChild>
                    <Button variant="ghost" size="sm" className="gap-1">
                      {performanceOpen ? '收起' : '展开'}
                      <ChevronDown className={`w-4 h-4 transition-transform ${performanceOpen ? 'rotate-180' : ''}`} />
                    </Button>
                  </CollapsibleTrigger>
                </div>
                <Select value={performanceGranularity} onValueChange={(v) => setPerformanceGranularity(v as typeof performanceGranularity)}>
                  <SelectTrigger className="w-[140px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent align="end">
                    <SelectItem value="day">按日</SelectItem>
                    <SelectItem value="week">按周</SelectItem>
                    <SelectItem value="month">按月</SelectItem>
                    <SelectItem value="all">全部</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CollapsibleContent>
              <CardContent>
                <div className="pb-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <span>显示</span>
                  <ToggleGroup
                    type="multiple"
                    size="sm"
                    variant="outline"
                    spacing={0}
                    value={performanceSeries}
                    onValueChange={(next) => {
                      if (!next.length) return;
                      setPerformanceSeries(next as Array<'spend' | 'sales' | 'acos'>);
                    }}
                  >
                    <ToggleGroupItem value="spend">花费</ToggleGroupItem>
                    <ToggleGroupItem value="sales">销售额</ToggleGroupItem>
                    <ToggleGroupItem value="acos">ACOS</ToggleGroupItem>
                  </ToggleGroup>
                </div>
                <div className={cn("overflow-y-hidden", performanceChartWidth ? "overflow-x-auto" : "overflow-x-hidden")}>
                  {performanceTrend.length ? (
                    <div className="h-[320px]" style={performanceChartWidth ? { width: `${performanceChartWidth}px`, minWidth: '100%' } : undefined}>
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={performanceTrend} margin={{ top: 8, right: 12, left: 0, bottom: 8 }}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="period" tick={{ fontSize: 12 }} />
                          {performanceSeries.includes('spend') || performanceSeries.includes('sales') ? (
                            <YAxis yAxisId="amount" tick={{ fontSize: 12 }} />
                          ) : null}
                          {performanceSeries.includes('acos') ? (
                            <YAxis yAxisId="acos" orientation="right" tick={{ fontSize: 12 }} tickFormatter={(value) => `${Number(value).toFixed(0)}%`} />
                          ) : null}
                          <Tooltip
                            formatter={(value, name) => {
                              const raw = Array.isArray(value) ? value[0] : value;
                              const numeric = raw === null || raw === undefined ? null : Number(raw);
                              if (name === 'ACOS') {
                                return [numeric === null || !Number.isFinite(numeric) ? '∞' : `${numeric.toFixed(2)}%`, name];
                              }
                              return [numeric !== null && Number.isFinite(numeric) ? numeric.toLocaleString() : '0', name];
                            }}
                            labelFormatter={(label) => `时间 ${label}`}
                          />
                          <Legend />
                          {performanceSeries.includes('spend') ? (
                            <Bar yAxisId="amount" dataKey="spend" name="花费" fill="var(--chart-3)" radius={[4, 4, 0, 0]} />
                          ) : null}
                          {performanceSeries.includes('sales') ? (
                            <Bar yAxisId="amount" dataKey="sales" name="销售额" fill="var(--chart-4)" radius={[4, 4, 0, 0]} />
                          ) : null}
                          {performanceSeries.includes('acos') ? (
                            <Bar yAxisId="acos" dataKey="acos" name="ACOS" fill="var(--chart-5)" radius={[4, 4, 0, 0]} />
                          ) : null}
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  ) : (
                    <div className="h-[320px] flex items-center justify-center text-sm text-muted-foreground">暂无可用日期数据</div>
                  )}
                </div>
              </CardContent>
            </CollapsibleContent>
          </Collapsible>
        </Card>
      </div>

      <div id="section-conversion">
        <div className="flex justify-end">
          <Button variant="ghost" size="sm" onClick={() => jumpToSection('page-top')}>
            回到顶部
          </Button>
        </div>
        <Card>
          <Collapsible open={conversionOpen} onOpenChange={setConversionOpen}>
            <CardHeader className="pb-2">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <CardTitle>转化率维度</CardTitle>
                  <CollapsibleTrigger asChild>
                    <Button variant="ghost" size="sm" className="gap-1">
                      {conversionOpen ? '收起' : '展开'}
                      <ChevronDown className={`w-4 h-4 transition-transform ${conversionOpen ? 'rotate-180' : ''}`} />
                    </Button>
                  </CollapsibleTrigger>
                </div>
                <Select value={conversionGranularity} onValueChange={(v) => setConversionGranularity(v as typeof conversionGranularity)}>
                  <SelectTrigger className="w-[140px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent align="end">
                    <SelectItem value="day">按日</SelectItem>
                    <SelectItem value="week">按周</SelectItem>
                    <SelectItem value="month">按月</SelectItem>
                    <SelectItem value="all">全部</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CollapsibleContent>
              <CardContent>
                <div className="pb-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <span>显示</span>
                  <ToggleGroup
                    type="multiple"
                    size="sm"
                    variant="outline"
                    spacing={0}
                    value={conversionSeries}
                    onValueChange={(next) => {
                      if (!next.length) return;
                      setConversionSeries(next as Array<'orders' | 'conversionRate'>);
                    }}
                  >
                    <ToggleGroupItem value="orders">订单数</ToggleGroupItem>
                    <ToggleGroupItem value="conversionRate">转化率</ToggleGroupItem>
                  </ToggleGroup>
                </div>
                <div className={cn("overflow-y-hidden", conversionChartWidth ? "overflow-x-auto" : "overflow-x-hidden")}>
                  {conversionTrend.length ? (
                    <div className="h-[320px]" style={conversionChartWidth ? { width: `${conversionChartWidth}px`, minWidth: '100%' } : undefined}>
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={conversionTrend} margin={{ top: 8, right: 12, left: 0, bottom: 8 }}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="period" tick={{ fontSize: 12 }} />
                          {conversionSeries.includes('orders') ? (
                            <YAxis yAxisId="orders" tick={{ fontSize: 12 }} />
                          ) : null}
                          {conversionSeries.includes('conversionRate') ? (
                            <YAxis yAxisId="rate" orientation="right" tick={{ fontSize: 12 }} tickFormatter={(value) => `${Number(value).toFixed(1)}%`} />
                          ) : null}
                          <Tooltip
                            formatter={(value, name) => {
                              const raw = Array.isArray(value) ? value[0] : value;
                              const numeric = raw === null || raw === undefined ? null : Number(raw);
                              if (name === '转化率') {
                                return [numeric !== null && Number.isFinite(numeric) ? `${numeric.toFixed(2)}%` : '0.00%', name];
                              }
                              return [numeric !== null && Number.isFinite(numeric) ? numeric.toLocaleString() : '0', name];
                            }}
                            labelFormatter={(label) => `时间 ${label}`}
                          />
                          <Legend />
                          {conversionSeries.includes('orders') ? (
                            <Bar yAxisId="orders" dataKey="orders" name="订单数" fill="var(--chart-3)" radius={[4, 4, 0, 0]} />
                          ) : null}
                          {conversionSeries.includes('conversionRate') ? (
                            <Bar yAxisId="rate" dataKey="conversionRate" name="转化率" fill="var(--chart-2)" radius={[4, 4, 0, 0]} />
                          ) : null}
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  ) : (
                    <div className="h-[320px] flex items-center justify-center text-sm text-muted-foreground">暂无可用日期数据</div>
                  )}
                </div>
              </CardContent>
            </CollapsibleContent>
          </Collapsible>
        </Card>
      </div>

      <div className="space-y-6">
        <div id="section-table">
          <div className="flex justify-end">
            <Button variant="ghost" size="sm" onClick={() => jumpToSection('page-top')}>
              回到顶部
            </Button>
          </div>
          <DataTable
            data={analysisRows}
            aggregatedDetailsById={analysisData?.detailsById}
            targetAcos={settings.targetAcos}
            currency={settings.currency}
            onSearchTermCompare={handleCompareTerm}
          />
        </div>
        <div id="section-sales-share">
          <div className="flex justify-end">
            <Button variant="ghost" size="sm" onClick={() => jumpToSection('page-top')}>
              回到顶部
            </Button>
          </div>
          <Card className="col-span-1 md:col-span-2">
            <Collapsible open={salesShareOpen} onOpenChange={setSalesShareOpen}>
              <CardHeader>
                <div className="flex flex-col gap-2">
                  <div className="flex items-center gap-2">
                    <CardTitle>广告SKU/其他SKU销售占比趋势</CardTitle>
                    <CollapsibleTrigger asChild>
                      <Button variant="ghost" size="sm" className="gap-1">
                        {salesShareOpen ? '收起' : '展开'}
                        <ChevronDown className={`w-4 h-4 transition-transform ${salesShareOpen ? 'rotate-180' : ''}`} />
                      </Button>
                    </CollapsibleTrigger>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    广告SKU占比 {(metrics.sales > 0 ? (metrics.directSales / metrics.sales) * 100 : 0).toFixed(2)}% • 其他SKU占比{' '}
                    {(metrics.sales > 0 ? (metrics.indirectSales / metrics.sales) * 100 : 0).toFixed(2)}% • 当前筛选内
                  </div>
                </div>
              </CardHeader>
              <CollapsibleContent>
                <CardContent className="h-[320px]">
              {salesShareTrend.length ? (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={salesShareTrend} margin={{ top: 12, right: 16, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                    <YAxis
                      tick={{ fontSize: 12 }}
                      tickFormatter={(v) => `${(Number(v) * 100).toFixed(0)}%`}
                      domain={[0, 1]}
                    />
                    <Tooltip
                      formatter={(value: number) => `${(value * 100).toFixed(2)}%`}
                      labelFormatter={(label) => `日期 ${label}`}
                    />
                    <Line type="monotone" dataKey="directShare" name="广告SKU占比" stroke="var(--chart-2)" dot={false} />
                    <Line type="monotone" dataKey="indirectShare" name="其他SKU占比" stroke="var(--chart-4)" dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="text-sm text-muted-foreground flex items-center justify-center h-full">暂无可用日期数据</div>
              )}
                </CardContent>
              </CollapsibleContent>
            </Collapsible>
          </Card>
        </div>
        <div id="section-campaign">
          <div className="flex justify-end">
            <Button variant="ghost" size="sm" onClick={() => jumpToSection('page-top')}>
              回到顶部
            </Button>
          </div>
          <Card className="col-span-1 md:col-span-2">
            <Collapsible open={campaignOpen} onOpenChange={setCampaignOpen}>
              <CardHeader>
                <div className="flex flex-col gap-2">
                  <div className="flex items-center gap-2">
                    <CardTitle>广告活动/广告组表现</CardTitle>
                    <CollapsibleTrigger asChild>
                      <Button variant="ghost" size="sm" className="gap-1">
                        {campaignOpen ? '收起' : '展开'}
                        <ChevronDown className={`w-4 h-4 transition-transform ${campaignOpen ? 'rotate-180' : ''}`} />
                      </Button>
                    </CollapsibleTrigger>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    活动 {campaignAdGroupSummary.campaigns.length.toLocaleString()} • 广告组{' '}
                    {campaignAdGroupSummary.adGroups.length.toLocaleString()} • 花费 {money.format(campaignAdGroupSummary.totalSpend)} • 销售额{' '}
                    {money.format(campaignAdGroupSummary.totalSales)} • 订单 {campaignAdGroupSummary.totalOrders.toLocaleString()}
                  </div>
                </div>
              </CardHeader>
              <CollapsibleContent>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-2">
                    <div className="space-y-1">
                      <div className="text-xs text-muted-foreground">广告活动搜索</div>
                      <Input
                        value={campaignQuery}
                        onChange={(e) => setCampaignQuery(e.target.value)}
                        placeholder="输入广告活动关键词"
                      />
                    </div>
                    <div className="space-y-1">
                      <div className="text-xs text-muted-foreground">广告组搜索</div>
                      <Input
                        value={adGroupQuery}
                        onChange={(e) => setAdGroupQuery(e.target.value)}
                        placeholder="输入广告组关键词"
                      />
                    </div>
                    <TopRangeInput
                      label="花费"
                      minValue={campaignMinSpend}
                      maxValue={campaignMaxSpend}
                      onChangeMin={setCampaignMinSpend}
                      onChangeMax={setCampaignMaxSpend}
                      step={0.01}
                    />
                    <TopRangeInput
                      label="点击"
                      minValue={campaignMinClicks}
                      maxValue={campaignMaxClicks}
                      onChangeMin={setCampaignMinClicks}
                      onChangeMax={setCampaignMaxClicks}
                      step={1}
                    />
                    <TopRangeInput
                      label="订单"
                      minValue={campaignMinOrders}
                      maxValue={campaignMaxOrders}
                      onChangeMin={setCampaignMinOrders}
                      onChangeMax={setCampaignMaxOrders}
                      step={1}
                    />
                    <TopRangeInput
                      label="展示"
                      minValue={campaignMinImpressions}
                      maxValue={campaignMaxImpressions}
                      onChangeMin={setCampaignMinImpressions}
                      onChangeMax={setCampaignMaxImpressions}
                      step={1}
                    />
                    <TopRangeInput
                      label="销售额"
                      minValue={campaignMinSales}
                      maxValue={campaignMaxSales}
                      onChangeMin={setCampaignMinSales}
                      onChangeMax={setCampaignMaxSales}
                      step={0.01}
                    />
                    <TopRangeInput
                      label="CTR(%)"
                      minValue={campaignMinCtr}
                      maxValue={campaignMaxCtr}
                      onChangeMin={setCampaignMinCtr}
                      onChangeMax={setCampaignMaxCtr}
                      step={0.1}
                    />
                    <TopRangeInput
                      label="CPC"
                      minValue={campaignMinCpc}
                      maxValue={campaignMaxCpc}
                      onChangeMin={setCampaignMinCpc}
                      onChangeMax={setCampaignMaxCpc}
                      step={0.01}
                    />
                    <TopRangeInput
                      label="ACOS(%)"
                      minValue={campaignMinAcos}
                      maxValue={campaignMaxAcos}
                      onChangeMin={setCampaignMinAcos}
                      onChangeMax={setCampaignMaxAcos}
                      step={0.1}
                    />
                    <TopRangeInput
                      label="ROAS"
                      minValue={campaignMinRoas}
                      maxValue={campaignMaxRoas}
                      onChangeMin={setCampaignMinRoas}
                      onChangeMax={setCampaignMaxRoas}
                      step={0.01}
                    />
                    <TopRangeInput
                      label="转化率(%)"
                      minValue={campaignMinConversionRate}
                      maxValue={campaignMaxConversionRate}
                      onChangeMin={setCampaignMinConversionRate}
                      onChangeMax={setCampaignMaxConversionRate}
                      step={0.1}
                    />
                    <TopRangeInput
                      label="CPA"
                      minValue={campaignMinCpa}
                      maxValue={campaignMaxCpa}
                      onChangeMin={setCampaignMinCpa}
                      onChangeMax={setCampaignMaxCpa}
                      step={0.01}
                    />
                    <div className="flex items-end">
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full"
                        onClick={() => {
                          setCampaignMinSpend('');
                          setCampaignMaxSpend('');
                          setCampaignMinClicks('');
                          setCampaignMaxClicks('');
                          setCampaignMinOrders('');
                          setCampaignMaxOrders('');
                          setCampaignMinImpressions('');
                          setCampaignMaxImpressions('');
                          setCampaignMinSales('');
                          setCampaignMaxSales('');
                          setCampaignMinCtr('');
                          setCampaignMaxCtr('');
                          setCampaignMinCpc('');
                          setCampaignMaxCpc('');
                          setCampaignMinAcos('');
                          setCampaignMaxAcos('');
                          setCampaignMinRoas('');
                          setCampaignMaxRoas('');
                          setCampaignMinConversionRate('');
                          setCampaignMaxConversionRate('');
                          setCampaignMinCpa('');
                          setCampaignMaxCpa('');
                          setCampaignQuery('');
                          setAdGroupQuery('');
                        }}
                      >
                        重置筛选
                      </Button>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 gap-4">
                <div className="rounded-md border">
                  <div className="px-3 py-2 text-sm font-medium">广告活动</div>
                  <div className="max-h-[360px] overflow-y-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>
                            <button className="flex items-center gap-1" onClick={() => toggleCampaignSort('campaignName')} type="button">
                              广告活动
                              {renderCampaignSortIndicator('campaignName')}
                            </button>
                          </TableHead>
                          <TableHead className="text-right">
                            <button className="flex items-center gap-1 ml-auto" onClick={() => toggleCampaignSort('spend')} type="button">
                              花费
                              {renderCampaignSortIndicator('spend')}
                            </button>
                          </TableHead>
                          <TableHead className="text-right">
                            <button className="flex items-center gap-1 ml-auto" onClick={() => toggleCampaignSort('spendShare')} type="button">
                              花费占比
                              {renderCampaignSortIndicator('spendShare')}
                            </button>
                          </TableHead>
                          <TableHead className="text-right">
                            <button className="flex items-center gap-1 ml-auto" onClick={() => toggleCampaignSort('impressions')} type="button">
                              展示
                              {renderCampaignSortIndicator('impressions')}
                            </button>
                          </TableHead>
                          <TableHead className="text-right">
                            <button className="flex items-center gap-1 ml-auto" onClick={() => toggleCampaignSort('clicks')} type="button">
                              点击
                              {renderCampaignSortIndicator('clicks')}
                            </button>
                          </TableHead>
                          <TableHead className="text-right">
                            <button className="flex items-center gap-1 ml-auto" onClick={() => toggleCampaignSort('sales')} type="button">
                              销售额
                              {renderCampaignSortIndicator('sales')}
                            </button>
                          </TableHead>
                          <TableHead className="text-right">
                            <button className="flex items-center gap-1 ml-auto" onClick={() => toggleCampaignSort('salesShare')} type="button">
                              销售占比
                              {renderCampaignSortIndicator('salesShare')}
                            </button>
                          </TableHead>
                          <TableHead className="text-right">
                            <button className="flex items-center gap-1 ml-auto" onClick={() => toggleCampaignSort('orders')} type="button">
                              订单
                              {renderCampaignSortIndicator('orders')}
                            </button>
                          </TableHead>
                          <TableHead className="text-right">
                            <button className="flex items-center gap-1 ml-auto" onClick={() => toggleCampaignSort('acos')} type="button">
                              ACOS
                              {renderCampaignSortIndicator('acos')}
                            </button>
                          </TableHead>
                          <TableHead className="text-right">
                            <button className="flex items-center gap-1 ml-auto" onClick={() => toggleCampaignSort('ctr')} type="button">
                              CTR
                              {renderCampaignSortIndicator('ctr')}
                            </button>
                          </TableHead>
                          <TableHead className="text-right">
                            <button className="flex items-center gap-1 ml-auto" onClick={() => toggleCampaignSort('conversionRate')} type="button">
                              转化率
                              {renderCampaignSortIndicator('conversionRate')}
                            </button>
                          </TableHead>
                          <TableHead className="text-right">
                            <button className="flex items-center gap-1 ml-auto" onClick={() => toggleCampaignSort('cpc')} type="button">
                              CPC
                              {renderCampaignSortIndicator('cpc')}
                            </button>
                          </TableHead>
                          <TableHead className="text-right">
                            <button className="flex items-center gap-1 ml-auto" onClick={() => toggleCampaignSort('cpa')} type="button">
                              CPA
                              {renderCampaignSortIndicator('cpa')}
                            </button>
                          </TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {campaignSortedRows.slice(0, 20).map((row) => {
                          const acosForColor = row.sales > 0 ? row.acos : row.spend > 0 ? Number.POSITIVE_INFINITY : 0;
                          const acosText = row.sales > 0 ? `${row.acos.toFixed(2)}%` : row.spend > 0 ? '∞' : '0.00%';
                          return (
                            <TableRow key={row.campaignName}>
                              <TableCell className="font-medium">{row.campaignName}</TableCell>
                              <TableCell className="text-right">{money.format(row.spend)}</TableCell>
                              <TableCell className="text-right">{(row.spendShare * 100).toFixed(2)}%</TableCell>
                              <TableCell className="text-right">{row.impressions.toLocaleString()}</TableCell>
                              <TableCell className="text-right">{row.clicks.toLocaleString()}</TableCell>
                              <TableCell className="text-right">{money.format(row.sales)}</TableCell>
                              <TableCell className="text-right">{(row.salesShare * 100).toFixed(2)}%</TableCell>
                              <TableCell className="text-right">{row.orders.toLocaleString()}</TableCell>
                              <TableCell className="text-right">
                                <Badge
                                  variant="outline"
                                  className={cn(
                                    'w-16 justify-center',
                                    acosForColor > settings.targetAcos
                                      ? 'border-destructive text-destructive bg-destructive/10'
                                      : 'border-emerald-600 text-emerald-600 bg-emerald-50'
                                  )}
                                >
                                  {acosText}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-right">{(row.ctr * 100).toFixed(2)}%</TableCell>
                              <TableCell className="text-right">{(row.conversionRate * 100).toFixed(2)}%</TableCell>
                              <TableCell className="text-right">{money.format(row.cpc)}</TableCell>
                              <TableCell className="text-right">{Number.isFinite(row.cpa) ? money.format(row.cpa) : '∞'}</TableCell>
                            </TableRow>
                          );
                        })}
                        {!campaignAdGroupSummary.campaigns.length ? (
                          <TableRow>
                            <TableCell colSpan={13} className="text-center text-muted-foreground py-8">
                              暂无数据
                            </TableCell>
                          </TableRow>
                        ) : null}
                      </TableBody>
                    </Table>
                  </div>
                </div>
                <div className="rounded-md border">
                  <div className="px-3 py-2 text-sm font-medium">广告组</div>
                  <div className="max-h-[360px] overflow-y-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>
                            <button className="flex items-center gap-1" onClick={() => toggleAdGroupSort('campaignName')} type="button">
                              广告活动
                              {renderAdGroupSortIndicator('campaignName')}
                            </button>
                          </TableHead>
                          <TableHead>
                            <button className="flex items-center gap-1" onClick={() => toggleAdGroupSort('adGroupName')} type="button">
                              广告组
                              {renderAdGroupSortIndicator('adGroupName')}
                            </button>
                          </TableHead>
                          <TableHead className="text-right">
                            <button className="flex items-center gap-1 ml-auto" onClick={() => toggleAdGroupSort('spend')} type="button">
                              花费
                              {renderAdGroupSortIndicator('spend')}
                            </button>
                          </TableHead>
                          <TableHead className="text-right">
                            <button className="flex items-center gap-1 ml-auto" onClick={() => toggleAdGroupSort('spendShare')} type="button">
                              花费占比
                              {renderAdGroupSortIndicator('spendShare')}
                            </button>
                          </TableHead>
                          <TableHead className="text-right">
                            <button className="flex items-center gap-1 ml-auto" onClick={() => toggleAdGroupSort('impressions')} type="button">
                              展示
                              {renderAdGroupSortIndicator('impressions')}
                            </button>
                          </TableHead>
                          <TableHead className="text-right">
                            <button className="flex items-center gap-1 ml-auto" onClick={() => toggleAdGroupSort('clicks')} type="button">
                              点击
                              {renderAdGroupSortIndicator('clicks')}
                            </button>
                          </TableHead>
                          <TableHead className="text-right">
                            <button className="flex items-center gap-1 ml-auto" onClick={() => toggleAdGroupSort('sales')} type="button">
                              销售额
                              {renderAdGroupSortIndicator('sales')}
                            </button>
                          </TableHead>
                          <TableHead className="text-right">
                            <button className="flex items-center gap-1 ml-auto" onClick={() => toggleAdGroupSort('salesShare')} type="button">
                              销售占比
                              {renderAdGroupSortIndicator('salesShare')}
                            </button>
                          </TableHead>
                          <TableHead className="text-right">
                            <button className="flex items-center gap-1 ml-auto" onClick={() => toggleAdGroupSort('orders')} type="button">
                              订单
                              {renderAdGroupSortIndicator('orders')}
                            </button>
                          </TableHead>
                          <TableHead className="text-right">
                            <button className="flex items-center gap-1 ml-auto" onClick={() => toggleAdGroupSort('acos')} type="button">
                              ACOS
                              {renderAdGroupSortIndicator('acos')}
                            </button>
                          </TableHead>
                          <TableHead className="text-right">
                            <button className="flex items-center gap-1 ml-auto" onClick={() => toggleAdGroupSort('ctr')} type="button">
                              CTR
                              {renderAdGroupSortIndicator('ctr')}
                            </button>
                          </TableHead>
                          <TableHead className="text-right">
                            <button className="flex items-center gap-1 ml-auto" onClick={() => toggleAdGroupSort('conversionRate')} type="button">
                              转化率
                              {renderAdGroupSortIndicator('conversionRate')}
                            </button>
                          </TableHead>
                          <TableHead className="text-right">
                            <button className="flex items-center gap-1 ml-auto" onClick={() => toggleAdGroupSort('cpc')} type="button">
                              CPC
                              {renderAdGroupSortIndicator('cpc')}
                            </button>
                          </TableHead>
                          <TableHead className="text-right">
                            <button className="flex items-center gap-1 ml-auto" onClick={() => toggleAdGroupSort('cpa')} type="button">
                              CPA
                              {renderAdGroupSortIndicator('cpa')}
                            </button>
                          </TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {adGroupSortedRows.slice(0, 20).map((row) => {
                          const acosForColor = row.sales > 0 ? row.acos : row.spend > 0 ? Number.POSITIVE_INFINITY : 0;
                          const acosText = row.sales > 0 ? `${row.acos.toFixed(2)}%` : row.spend > 0 ? '∞' : '0.00%';
                          return (
                            <TableRow key={`${row.campaignName}-${row.adGroupName}`}>
                              <TableCell className="font-medium">{row.campaignName}</TableCell>
                              <TableCell className="font-medium">{row.adGroupName}</TableCell>
                              <TableCell className="text-right">{money.format(row.spend)}</TableCell>
                              <TableCell className="text-right">{(row.spendShare * 100).toFixed(2)}%</TableCell>
                              <TableCell className="text-right">{row.impressions.toLocaleString()}</TableCell>
                              <TableCell className="text-right">{row.clicks.toLocaleString()}</TableCell>
                              <TableCell className="text-right">{money.format(row.sales)}</TableCell>
                              <TableCell className="text-right">{(row.salesShare * 100).toFixed(2)}%</TableCell>
                              <TableCell className="text-right">{row.orders.toLocaleString()}</TableCell>
                              <TableCell className="text-right">
                                <Badge
                                  variant="outline"
                                  className={cn(
                                    'w-16 justify-center',
                                    acosForColor > settings.targetAcos
                                      ? 'border-destructive text-destructive bg-destructive/10'
                                      : 'border-emerald-600 text-emerald-600 bg-emerald-50'
                                  )}
                                >
                                  {acosText}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-right">{(row.ctr * 100).toFixed(2)}%</TableCell>
                              <TableCell className="text-right">{(row.conversionRate * 100).toFixed(2)}%</TableCell>
                              <TableCell className="text-right">{money.format(row.cpc)}</TableCell>
                              <TableCell className="text-right">{Number.isFinite(row.cpa) ? money.format(row.cpa) : '∞'}</TableCell>
                            </TableRow>
                          );
                        })}
                        {!campaignAdGroupSummary.adGroups.length ? (
                          <TableRow>
                            <TableCell colSpan={14} className="text-center text-muted-foreground py-8">
                              暂无数据
                            </TableCell>
                          </TableRow>
                        ) : null}
                      </TableBody>
                    </Table>
                  </div>
                </div>
                  </div>
                </CardContent>
              </CollapsibleContent>
            </Collapsible>
          </Card>
        </div>
        <div id="section-suggestions">
          <div className="flex justify-end">
            <Button variant="ghost" size="sm" onClick={() => jumpToSection('page-top')}>
              回到顶部
            </Button>
          </div>
          <SuggestionsPanel
            data={analysisRows}
            currency={settings.currency}
            aggregatedDetailsById={analysisData?.detailsById}
          />
        </div>
        <div id="section-structure">
          <div className="flex justify-end">
            <Button variant="ghost" size="sm" onClick={() => jumpToSection('page-top')}>
              回到顶部
            </Button>
          </div>
          <StructureAnalysisPanel data={analysisRows} currency={settings.currency} />
        </div>
        <div id="section-waste">
          <div className="flex justify-end">
            <Button variant="ghost" size="sm" onClick={() => jumpToSection('page-top')}>
              回到顶部
            </Button>
          </div>
          <Card className="col-span-1 md:col-span-2">
            <Collapsible open={wasteOpen} onOpenChange={setWasteOpen}>
              <CardHeader>
                <div className="flex flex-col gap-2">
                  <div className="flex items-center gap-2">
                    <CardTitle>浪费花费排行榜</CardTitle>
                    <CollapsibleTrigger asChild>
                      <Button variant="ghost" size="sm" className="gap-1">
                        {wasteOpen ? '收起' : '展开'}
                        <ChevronDown className={`w-4 h-4 transition-transform ${wasteOpen ? 'rotate-180' : ''}`} />
                      </Button>
                    </CollapsibleTrigger>
                  </div>
                  <div className="text-xs text-muted-foreground">统计条件：{wasteCriteriaLabel}；“有效”字段 = 总计 - 浪费（同口径）</div>
                </div>
              </CardHeader>
              <CollapsibleContent>
                <CardContent className="space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="text-xs text-muted-foreground">
                      总花费 {money.format(metrics.spend)} • 浪费花费 {money.format(wasteRanking.totalWasteSpend)} • 有效花费{' '}
                      {money.format(Math.max(0, metrics.spend - wasteRanking.totalWasteSpend))} • 浪费点击{' '}
                      {wasteRanking.totalWasteClicks.toLocaleString()} • 浪费订单 {Math.max(0, wasteRanking.totalWasteOrders).toLocaleString()} • 浪费花费占比{' '}
                      {(metrics.spend > 0 ? (wasteRanking.totalWasteSpend / metrics.spend) * 100 : 0).toFixed(2)}%
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="text-xs text-muted-foreground">浪费口径</div>
                      <Select value={wasteCriteria} onValueChange={(v) => setWasteCriteria(v as typeof wasteCriteria)}>
                        <SelectTrigger size="sm" className="w-[170px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent align="end">
                          <SelectItem value="ordersZero">订单=0</SelectItem>
                          <SelectItem value="salesZero">销售额=0</SelectItem>
                          <SelectItem value="ordersAndSalesZero">订单=0 且 销售额=0</SelectItem>
                        </SelectContent>
                      </Select>
                      <div className="text-xs text-muted-foreground">Top N</div>
                      <Select
                        value={String(wasteTopN)}
                        onValueChange={(v) =>
                          setWasteTopN(Number(v) === 50 ? 50 : Number(v) === 10 ? 10 : 20)
                        }
                      >
                        <SelectTrigger size="sm" className="w-[120px]">
                          <SelectValue placeholder="Top N" />
                        </SelectTrigger>
                        <SelectContent align="end">
                          <SelectItem value="10">Top 10</SelectItem>
                          <SelectItem value="20">Top 20</SelectItem>
                          <SelectItem value="50">Top 50</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 gap-4">
                    <div className="rounded-md border">
                      <div className="px-3 py-2 text-sm font-medium">广告组浪费排行</div>
                      <div className="max-h-[420px] overflow-y-auto">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead className="w-[54px]">#</TableHead>
                              <TableHead>
                                <button
                                  className="flex items-center gap-1"
                                  onClick={() => toggleWasteAdGroupSort('campaignName')}
                                  type="button"
                                >
                                  广告活动
                                  {renderWasteAdGroupSortIndicator('campaignName')}
                                </button>
                              </TableHead>
                              <TableHead>
                                <button
                                  className="flex items-center gap-1"
                                  onClick={() => toggleWasteAdGroupSort('adGroupName')}
                                  type="button"
                                >
                                  广告组
                                  {renderWasteAdGroupSortIndicator('adGroupName')}
                                </button>
                              </TableHead>
                              <TableHead className="text-right">
                                <button
                                  className="flex items-center gap-1 ml-auto"
                                  onClick={() => toggleWasteAdGroupSort('wasteSpend')}
                                  type="button"
                                >
                                  浪费花费
                                  {renderWasteAdGroupSortIndicator('wasteSpend')}
                                </button>
                              </TableHead>
                              <TableHead className="text-right">
                                <button
                                  className="flex items-center gap-1 ml-auto"
                                  onClick={() => toggleWasteAdGroupSort('wasteClicks')}
                                  type="button"
                                >
                                  浪费点击
                                  {renderWasteAdGroupSortIndicator('wasteClicks')}
                                </button>
                              </TableHead>
                              <TableHead className="text-right">
                                <button
                                  className="flex items-center gap-1 ml-auto"
                                  onClick={() => toggleWasteAdGroupSort('wasteShare')}
                                  type="button"
                                >
                                  浪费花费占比
                                  {renderWasteAdGroupSortIndicator('wasteShare')}
                                </button>
                              </TableHead>
                              <TableHead className="text-right">
                                <button
                                  className="flex items-center gap-1 ml-auto"
                                  onClick={() => toggleWasteAdGroupSort('spend')}
                                  type="button"
                                >
                                  <HeaderTip label="总花费" tip="该广告组在当前筛选下的全部花费（无单+有单）" />
                                  {renderWasteAdGroupSortIndicator('spend')}
                                </button>
                              </TableHead>
                              <TableHead className="text-right">
                                <HeaderTip label="有效花费" tip="总花费 - 浪费花费（按当前浪费口径计算）" />
                              </TableHead>
                              <TableHead className="text-right">
                                <button
                                  className="flex items-center gap-1 ml-auto"
                                  onClick={() => toggleWasteAdGroupSort('orders')}
                                  type="button"
                                >
                                  <HeaderTip label="有效订单" tip="总订单 - 浪费订单（按当前浪费口径计算）" />
                                  {renderWasteAdGroupSortIndicator('orders')}
                                </button>
                              </TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {wasteAdGroupRows.map((row, idx) => (
                              <TableRow key={`${row.campaignName}||${row.adGroupName}`}>
                                <TableCell className="text-muted-foreground">{idx + 1}</TableCell>
                                <TableCell className="max-w-[220px] truncate" title={row.campaignName}>
                                  {row.campaignName}
                                </TableCell>
                                <TableCell className="max-w-[220px] truncate" title={row.adGroupName}>
                                  <button
                                    type="button"
                                    className="truncate text-left text-primary hover:underline"
                                    onClick={() =>
                                      setWasteAdGroupDetail({ campaignName: row.campaignName, adGroupName: row.adGroupName })
                                    }
                                  >
                                    {row.adGroupName}
                                  </button>
                                </TableCell>
                                <TableCell className="text-right">{money.format(row.wasteSpend)}</TableCell>
                                <TableCell className="text-right">{row.wasteClicks.toLocaleString()}</TableCell>
                                <TableCell className="text-right">{(row.wasteShare * 100).toFixed(2)}%</TableCell>
                                <TableCell className="text-right">{money.format(row.spend)}</TableCell>
                                <TableCell className="text-right">{money.format(Math.max(0, row.spend - row.wasteSpend))}</TableCell>
                                <TableCell className="text-right">{row.effectiveOrders.toLocaleString()}</TableCell>
                              </TableRow>
                            ))}
                            {!wasteAdGroupRows.length ? (
                              <TableRow>
                                <TableCell colSpan={9} className="text-center text-muted-foreground py-8">
                                  暂无数据（可尝试放宽筛选）
                                </TableCell>
                              </TableRow>
                            ) : null}
                          </TableBody>
                        </Table>
                      </div>
                    </div>
                    <div className="rounded-md border">
                      <div className="px-3 py-2 text-sm font-medium">搜索词浪费排行</div>
                      <div className="max-h-[420px] overflow-y-auto">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead className="w-[54px]">#</TableHead>
                              <TableHead>
                                <button className="flex items-center gap-1" onClick={() => toggleWasteTermSort('term')} type="button">
                                  搜索词
                                  {renderWasteTermSortIndicator('term')}
                                </button>
                              </TableHead>
                              <TableHead>广告活动</TableHead>
                              <TableHead>广告组</TableHead>
                              <TableHead className="text-right">
                                <button
                                  className="flex items-center gap-1 ml-auto"
                                  onClick={() => toggleWasteTermSort('wasteSpend')}
                                  type="button"
                                >
                                  浪费花费
                                  {renderWasteTermSortIndicator('wasteSpend')}
                                </button>
                              </TableHead>
                              <TableHead className="text-right">
                                <button
                                  className="flex items-center gap-1 ml-auto"
                                  onClick={() => toggleWasteTermSort('wasteClicks')}
                                  type="button"
                                >
                                  浪费点击
                                  {renderWasteTermSortIndicator('wasteClicks')}
                                </button>
                              </TableHead>
                              <TableHead className="text-right">
                                <button
                                  className="flex items-center gap-1 ml-auto"
                                  onClick={() => toggleWasteTermSort('wasteShare')}
                                  type="button"
                                >
                                  浪费花费占比
                                  {renderWasteTermSortIndicator('wasteShare')}
                                </button>
                              </TableHead>
                              <TableHead className="text-right">
                                <button
                                  className="flex items-center gap-1 ml-auto"
                                  onClick={() => toggleWasteTermSort('spend')}
                                  type="button"
                                >
                                  <HeaderTip label="总花费" tip="该搜索词在当前筛选下全部花费（无单+有单）" />
                                  {renderWasteTermSortIndicator('spend')}
                                </button>
                              </TableHead>
                              <TableHead className="text-right">
                                <HeaderTip label="有效花费" tip="总花费 - 浪费花费（按当前浪费口径计算）" />
                              </TableHead>
                              <TableHead className="text-right">
                                <button
                                  className="flex items-center gap-1 ml-auto"
                                  onClick={() => toggleWasteTermSort('orders')}
                                  type="button"
                                >
                                  <HeaderTip label="有效订单" tip="总订单 - 浪费订单（按当前浪费口径计算）" />
                                  {renderWasteTermSortIndicator('orders')}
                                </button>
                              </TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {wasteTermRows.map((row, idx) => (
                              <TableRow key={`${row.term}-${idx}`}>
                                <TableCell className="text-muted-foreground">{idx + 1}</TableCell>
                                <TableCell className="font-medium max-w-[240px] truncate" title={row.term}>
                                  <button
                                    type="button"
                                    className="truncate text-left text-primary hover:underline"
                                    onClick={() => handleCompareTerm(row.term)}
                                  >
                                    {row.term}
                                  </button>
                                </TableCell>
                                <TableCell
                                  className="max-w-[200px] truncate"
                                  title={row.campaignNames.length ? row.campaignNames.join('、') : ''}
                                >
                                  {row.campaignLabel}
                                </TableCell>
                                <TableCell
                                  className="max-w-[200px] truncate"
                                  title={row.adGroupNames.length ? row.adGroupNames.join('、') : ''}
                                >
                                  {row.adGroupLabel}
                                </TableCell>
                                <TableCell className="text-right">{money.format(row.wasteSpend)}</TableCell>
                                <TableCell className="text-right">{row.wasteClicks.toLocaleString()}</TableCell>
                                <TableCell className="text-right">{(row.wasteShare * 100).toFixed(2)}%</TableCell>
                                <TableCell className="text-right">{money.format(row.spend)}</TableCell>
                                <TableCell className="text-right">{money.format(Math.max(0, row.spend - row.wasteSpend))}</TableCell>
                                <TableCell className="text-right">{row.effectiveOrders.toLocaleString()}</TableCell>
                              </TableRow>
                            ))}
                            {!wasteTermRows.length ? (
                              <TableRow>
                                <TableCell colSpan={10} className="text-center text-muted-foreground py-8">
                                  暂无数据（可尝试放宽筛选）
                                </TableCell>
                              </TableRow>
                            ) : null}
                          </TableBody>
                        </Table>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </CollapsibleContent>
            </Collapsible>
          </Card>
        </div>
        <Dialog
          open={Boolean(wasteAdGroupDetailSummary)}
          onOpenChange={(open) => {
            if (!open) {
              setWasteAdGroupDetail(null);
            }
          }}
        >
          <DialogContent className="w-[96vw] max-w-[96vw] sm:max-w-[960px] h-[90vh] max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>广告组浪费明细</DialogTitle>
              <DialogDescription>
                {wasteAdGroupDetailSummary
                  ? `${wasteAdGroupDetailSummary.campaignName} / ${wasteAdGroupDetailSummary.adGroupName}`
                  : ''}
              </DialogDescription>
            </DialogHeader>
            {wasteAdGroupDetailSummary ? (
              <div className="space-y-3">
                <div className="text-xs text-muted-foreground">
                  匹配记录 {wasteAdGroupDetailSummary.totalRows.toLocaleString()} 条（按当前筛选条件）
                </div>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-xs">
                  <div className="rounded-md border p-2 space-y-1">
                    <div className="text-muted-foreground">浪费花费</div>
                    <div className="font-medium">{money.format(wasteAdGroupDetailSummary.wasteSpend)}</div>
                  </div>
                  <div className="rounded-md border p-2 space-y-1">
                    <div className="text-muted-foreground">浪费点击</div>
                    <div className="font-medium">{wasteAdGroupDetailSummary.wasteClicks.toLocaleString()}</div>
                  </div>
                  <div className="rounded-md border p-2 space-y-1">
                    <div className="text-muted-foreground">浪费花费占比</div>
                    <div className="font-medium">
                      {(wasteAdGroupDetailSummary.spend > 0
                        ? (wasteAdGroupDetailSummary.wasteSpend / wasteAdGroupDetailSummary.spend) * 100
                        : 0
                      ).toFixed(2)}
                      %
                    </div>
                  </div>
                  <div className="rounded-md border p-2 space-y-1">
                    <div className="text-muted-foreground">总花费</div>
                    <div className="font-medium">{money.format(wasteAdGroupDetailSummary.spend)}</div>
                  </div>
                  <div className="rounded-md border p-2 space-y-1">
                    <div className="text-muted-foreground">有效花费</div>
                    <div className="font-medium">{money.format(Math.max(0, wasteAdGroupDetailSummary.spend - wasteAdGroupDetailSummary.wasteSpend))}</div>
                  </div>
                  <div className="rounded-md border p-2 space-y-1">
                    <div className="text-muted-foreground">有效订单</div>
                    <div className="font-medium">{wasteAdGroupDetailSummary.effectiveOrders.toLocaleString()}</div>
                  </div>
                  <div className="rounded-md border p-2 space-y-1">
                    <div className="text-muted-foreground">总销售额</div>
                    <div className="font-medium">{money.format(wasteAdGroupDetailSummary.sales)}</div>
                  </div>
                  <div className="rounded-md border p-2 space-y-1">
                    <div className="text-muted-foreground">有效销售额</div>
                    <div className="font-medium">{money.format(wasteAdGroupDetailSummary.effectiveSales)}</div>
                  </div>
                </div>
                <div className="rounded-lg border p-3 space-y-2">
                  <div className="text-sm font-medium">搜索词浪费明细</div>
                  <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                    <Tabs
                      value={wasteAdGroupFilterDimension}
                      onValueChange={(v) => setWasteAdGroupFilterDimension(v as typeof wasteAdGroupFilterDimension)}
                      className="w-full md:w-auto"
                    >
                      <TabsList className="w-full md:w-fit overflow-x-auto">
                        <TabsTrigger
                          value="search"
                          className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
                        >
                          搜索词
                        </TabsTrigger>
                        <TabsTrigger
                          value="asin"
                          className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
                        >
                          ASIN
                        </TabsTrigger>
                      </TabsList>
                    </Tabs>
                    <div className="flex flex-1 flex-col gap-2 md:flex-row md:items-center md:justify-end">
                      <div className="w-full md:max-w-[220px]">
                        <Input
                          value={wasteAdGroupFilterQuery}
                          onChange={(e) => setWasteAdGroupFilterQuery(e.target.value)}
                          placeholder="输入搜索词"
                        />
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          className="gap-2"
                          onClick={() => exportWasteAdGroupTerms(wasteAdGroupDetailFilteredTerms, "筛选结果")}
                          disabled={!wasteAdGroupDetailFilteredTerms.length}
                        >
                          <Download className="w-4 h-4" />
                          导出当前
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="gap-2"
                          onClick={() => exportWasteAdGroupTerms(wasteAdGroupDetailSummary.terms, "全部结果")}
                          disabled={!wasteAdGroupDetailSummary.terms.length}
                        >
                          <Download className="w-4 h-4" />
                          导出全部
                        </Button>
                      </div>
                    </div>
                  </div>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[54px]">#</TableHead>
                        <TableHead>搜索词</TableHead>
                        <TableHead className="text-right">浪费花费</TableHead>
                        <TableHead className="text-right">浪费点击</TableHead>
                        <TableHead className="text-right">浪费花费占比</TableHead>
                        <TableHead className="text-right">总花费</TableHead>
                        <TableHead className="text-right">有效花费</TableHead>
                        <TableHead className="text-right">有效订单</TableHead>
                        <TableHead className="text-right">有效销售额</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {wasteAdGroupDetailFilteredTerms.map((row, idx) => (
                        <TableRow key={`${row.term}-${idx}`}>
                          <TableCell className="text-muted-foreground">{idx + 1}</TableCell>
                          <TableCell className="font-medium max-w-[360px] truncate" title={row.term}>
                            {row.term}
                          </TableCell>
                          <TableCell className="text-right">{money.format(row.wasteSpend)}</TableCell>
                          <TableCell className="text-right">{row.wasteClicks.toLocaleString()}</TableCell>
                          <TableCell className="text-right">{(row.wasteShare * 100).toFixed(2)}%</TableCell>
                          <TableCell className="text-right">{money.format(row.spend)}</TableCell>
                          <TableCell className="text-right">{money.format(Math.max(0, row.spend - row.wasteSpend))}</TableCell>
                          <TableCell className="text-right">{row.effectiveOrders.toLocaleString()}</TableCell>
                          <TableCell className="text-right">{money.format(row.effectiveSales)}</TableCell>
                        </TableRow>
                      ))}
                      {!wasteAdGroupDetailFilteredTerms.length ? (
                        <TableRow>
                          <TableCell colSpan={9} className="text-center text-muted-foreground py-8">
                            暂无数据（可尝试放宽筛选）
                          </TableCell>
                        </TableRow>
                      ) : null}
                    </TableBody>
                  </Table>
                </div>
              </div>
            ) : null}
          </DialogContent>
        </Dialog>
        <div id="section-top">
          <div className="flex justify-end">
            <Button variant="ghost" size="sm" onClick={() => jumpToSection('page-top')}>
              回到顶部
            </Button>
          </div>
          <Card className="col-span-1 md:col-span-2">
          <Collapsible open={topOpen} onOpenChange={setTopOpen}>
            <CardHeader>
              <div className="flex flex-col gap-3">
                <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <CardTitle>Top 关键词/搜索词</CardTitle>
                      <CollapsibleTrigger asChild>
                        <Button variant="ghost" size="sm" className="gap-1">
                          {topOpen ? '收起' : '展开'}
                          <ChevronDown className={`w-4 h-4 transition-transform ${topOpen ? 'rotate-180' : ''}`} />
                        </Button>
                      </CollapsibleTrigger>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      维度、Top N 与列展示互不影响全局筛选
                    </div>
                  </div>

                </div>
              </div>
            </CardHeader>
            <CollapsibleContent>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-2 flex-wrap">
                <div className="text-xs text-muted-foreground">日期快捷</div>
                <Button
                  variant={topQuickDays === 0 ? "default" : "outline"}
                  size="sm"
                  onClick={() => setTopQuickDays(0)}
                >
                  全部
                </Button>
                <Button
                  variant={topQuickDays === 7 ? "default" : "outline"}
                  size="sm"
                  onClick={() => setTopQuickDays(7)}
                  disabled={!filteredData.some((r) => /^\d{4}-\d{2}-\d{2}$/.test(r.date))}
                >
                  近7天
                </Button>
                <Button
                  variant={topQuickDays === 14 ? "default" : "outline"}
                  size="sm"
                  onClick={() => setTopQuickDays(14)}
                  disabled={!filteredData.some((r) => /^\d{4}-\d{2}-\d{2}$/.test(r.date))}
                >
                  近14天
                </Button>
                <Button
                  variant={topQuickDays === 30 ? "default" : "outline"}
                  size="sm"
                  onClick={() => setTopQuickDays(30)}
                  disabled={!filteredData.some((r) => /^\d{4}-\d{2}-\d{2}$/.test(r.date))}
                >
                  近30天
                </Button>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <Select value={String(topN)} onValueChange={(v) => setTopN(Number(v) === 100 ? 100 : 50)}>
                  <SelectTrigger size="sm" className="w-[120px]">
                    <SelectValue placeholder="Top N" />
                  </SelectTrigger>
                  <SelectContent align="end">
                    <SelectItem value="50">Top 50</SelectItem>
                    <SelectItem value="100">Top 100</SelectItem>
                  </SelectContent>
                </Select>

                <Select value={topSortKey} onValueChange={(v) => setTopSortKey(v as typeof topSortKey)}>
                  <SelectTrigger size="sm" className="w-[160px]">
                    <SelectValue placeholder="排序指标" />
                  </SelectTrigger>
                  <SelectContent align="end">
                    <SelectItem value="term">按词</SelectItem>
                    <SelectItem value="spend">按花费</SelectItem>
                    <SelectItem value="sales">按销售额</SelectItem>
                    <SelectItem value="orders">按订单</SelectItem>
                    <SelectItem value="clicks">按点击</SelectItem>
                    <SelectItem value="impressions">按展示</SelectItem>
                    <SelectItem value="acos">按 ACOS</SelectItem>
                    <SelectItem value="roas">按 ROAS</SelectItem>
                    <SelectItem value="cpc">按 CPC</SelectItem>
                    <SelectItem value="ctr">按 CTR</SelectItem>
                    <SelectItem value="conversionRate">按转化率</SelectItem>
                    <SelectItem value="cpa">按 CPA</SelectItem>
                  </SelectContent>
                </Select>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setTopSortDir((d) => (d === 'desc' ? 'asc' : 'desc'))}
                >
                  {topSortDir === 'desc' ? '降序' : '升序'}
                </Button>

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm">
                      自定义列
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-[220px]">
                    <DropdownMenuLabel>展示列</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    {([
                      { key: 'impressions', label: '展示' },
                      { key: 'clicks', label: '点击' },
                      { key: 'spend', label: '花费' },
                      { key: 'sales', label: '销售额' },
                      { key: 'orders', label: '订单' },
                      { key: 'ctr', label: 'CTR' },
                      { key: 'cpc', label: 'CPC' },
                      { key: 'acos', label: 'ACOS' },
                      { key: 'roas', label: 'ROAS' },
                      { key: 'conversionRate', label: '转化率' },
                      { key: 'cpa', label: 'CPA' },
                    ] as const).map((c) => (
                      <DropdownMenuCheckboxItem
                        key={c.key}
                        checked={topVisibleCols.includes(c.key)}
                        onSelect={(e) => e.preventDefault()}
                        onCheckedChange={(checked) => {
                          setTopVisibleCols((prev) => {
                            if (checked) return prev.includes(c.key) ? prev : [...prev, c.key];
                            return prev.filter((k) => k !== c.key);
                          });
                        }}
                      >
                        {c.label}
                      </DropdownMenuCheckboxItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-2"
                  onClick={() => exportTopRows(topRows, "筛选结果")}
                  disabled={!topRows.length}
                >
                  <Download className="w-4 h-4" />
                  导出筛选
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-2"
                  onClick={() => exportTopRows(topAllSortedRows, "全部结果")}
                  disabled={!topAllSortedRows.length}
                >
                  <Download className="w-4 h-4" />
                  导出全部
                </Button>
              </div>

              <div className="flex flex-col md:flex-row md:items-center gap-2">
                <Tabs
                  value={topDimension}
                  onValueChange={(v) => setTopDimension(v as typeof topDimension)}
                  className="w-full md:w-auto"
                >
                  <TabsList className="w-full md:w-fit overflow-x-auto">
                    <TabsTrigger
                      value="keywords"
                      className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
                    >
                      关键词（不含 ASIN）
                    </TabsTrigger>
                    <TabsTrigger
                      value="all"
                      className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
                    >
                      搜索词（全部）
                    </TabsTrigger>
                    <TabsTrigger
                      value="asin"
                      className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
                    >
                      ASIN（仅 B0 开头）
                    </TabsTrigger>
                  </TabsList>
                </Tabs>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-2 w-full">
                  <div className="space-y-1">
                    <div className="text-xs text-muted-foreground">搜索</div>
                    <Input
                      value={topQuery}
                      onChange={(e) => setTopQuery(e.target.value)}
                      placeholder="输入关键词"
                    />
                  </div>
                  <TopRangeInput
                    label="花费"
                    minValue={topMinSpend}
                    maxValue={topMaxSpend}
                    onChangeMin={setTopMinSpend}
                    onChangeMax={setTopMaxSpend}
                    step={0.01}
                  />
                  <TopRangeInput
                    label="点击"
                    minValue={topMinClicks}
                    maxValue={topMaxClicks}
                    onChangeMin={setTopMinClicks}
                    onChangeMax={setTopMaxClicks}
                    step={1}
                  />
                  <TopRangeInput
                    label="订单"
                    minValue={topMinOrders}
                    maxValue={topMaxOrders}
                    onChangeMin={setTopMinOrders}
                    onChangeMax={setTopMaxOrders}
                    step={1}
                  />
                  <TopRangeInput
                    label="展示"
                    minValue={topMinImpressions}
                    maxValue={topMaxImpressions}
                    onChangeMin={setTopMinImpressions}
                    onChangeMax={setTopMaxImpressions}
                    step={1}
                  />
                  <TopRangeInput
                    label="销售额"
                    minValue={topMinSales}
                    maxValue={topMaxSales}
                    onChangeMin={setTopMinSales}
                    onChangeMax={setTopMaxSales}
                    step={0.01}
                  />
                  <TopRangeInput
                    label="CTR(%)"
                    minValue={topMinCtr}
                    maxValue={topMaxCtr}
                    onChangeMin={setTopMinCtr}
                    onChangeMax={setTopMaxCtr}
                    step={0.1}
                  />
                  <TopRangeInput
                    label="CPC"
                    minValue={topMinCpc}
                    maxValue={topMaxCpc}
                    onChangeMin={setTopMinCpc}
                    onChangeMax={setTopMaxCpc}
                    step={0.01}
                  />
                  <TopRangeInput
                    label="ACOS(%)"
                    minValue={topMinAcos}
                    maxValue={topMaxAcos}
                    onChangeMin={setTopMinAcos}
                    onChangeMax={setTopMaxAcos}
                    step={0.1}
                  />
                  <TopRangeInput
                    label="ROAS"
                    minValue={topMinRoas}
                    maxValue={topMaxRoas}
                    onChangeMin={setTopMinRoas}
                    onChangeMax={setTopMaxRoas}
                    step={0.01}
                  />
                  <TopRangeInput
                    label="CPA"
                    minValue={topMinCpa}
                    maxValue={topMaxCpa}
                    onChangeMin={setTopMinCpa}
                    onChangeMax={setTopMaxCpa}
                    step={0.01}
                  />
                  <div className="flex items-end">
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full"
                      onClick={() => {
                        setTopQuery('');
                        setTopMinSpend('');
                        setTopMaxSpend('');
                        setTopMinClicks('');
                        setTopMaxClicks('');
                        setTopMinOrders('');
                        setTopMaxOrders('');
                        setTopMinImpressions('');
                        setTopMaxImpressions('');
                        setTopMinSales('');
                        setTopMaxSales('');
                        setTopMinCtr('');
                        setTopMaxCtr('');
                        setTopMinCpc('');
                        setTopMaxCpc('');
                        setTopMinAcos('');
                        setTopMaxAcos('');
                        setTopMinRoas('');
                        setTopMaxRoas('');
                        setTopMinCpa('');
                        setTopMaxCpa('');
                      }}
                    >
                      重置筛选
                    </Button>
                  </div>
                </div>
              </div>
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[54px]">#</TableHead>
                        <TableHead className="min-w-[320px]">
                          <button className="flex items-center gap-1" onClick={() => toggleTopSort('term')} type="button">
                            词
                            <span className="text-xs text-primary font-medium">点击词看对比</span>
                            {renderTopSortIndicator('term')}
                          </button>
                        </TableHead>
                        <TableHead className="w-[72px] text-right">复制</TableHead>
                        {topVisibleCols.includes('impressions') ? (
                          <TableHead className="text-right">
                            <button className="flex items-center gap-1 ml-auto" onClick={() => toggleTopSort('impressions')} type="button">
                              展示
                              {renderTopSortIndicator('impressions')}
                            </button>
                          </TableHead>
                        ) : null}
                        {topVisibleCols.includes('clicks') ? (
                          <TableHead className="text-right">
                            <button className="flex items-center gap-1 ml-auto" onClick={() => toggleTopSort('clicks')} type="button">
                              点击
                              {renderTopSortIndicator('clicks')}
                            </button>
                          </TableHead>
                        ) : null}
                        {topVisibleCols.includes('spend') ? (
                          <TableHead className="text-right">
                            <button className="flex items-center gap-1 ml-auto" onClick={() => toggleTopSort('spend')} type="button">
                              花费
                              {renderTopSortIndicator('spend')}
                            </button>
                          </TableHead>
                        ) : null}
                        {topVisibleCols.includes('sales') ? (
                          <TableHead className="text-right">
                            <button className="flex items-center gap-1 ml-auto" onClick={() => toggleTopSort('sales')} type="button">
                              销售额
                              {renderTopSortIndicator('sales')}
                            </button>
                          </TableHead>
                        ) : null}
                        {topVisibleCols.includes('orders') ? (
                          <TableHead className="text-right">
                            <button className="flex items-center gap-1 ml-auto" onClick={() => toggleTopSort('orders')} type="button">
                              订单
                              {renderTopSortIndicator('orders')}
                            </button>
                          </TableHead>
                        ) : null}
                        {topVisibleCols.includes('ctr') ? (
                          <TableHead className="text-right">
                            <button className="flex items-center gap-1 ml-auto" onClick={() => toggleTopSort('ctr')} type="button">
                              CTR
                              {renderTopSortIndicator('ctr')}
                            </button>
                          </TableHead>
                        ) : null}
                        {topVisibleCols.includes('cpc') ? (
                          <TableHead className="text-right">
                            <button className="flex items-center gap-1 ml-auto" onClick={() => toggleTopSort('cpc')} type="button">
                              CPC
                              {renderTopSortIndicator('cpc')}
                            </button>
                          </TableHead>
                        ) : null}
                        {topVisibleCols.includes('acos') ? (
                          <TableHead className="text-right">
                            <button className="flex items-center gap-1 ml-auto" onClick={() => toggleTopSort('acos')} type="button">
                              ACOS
                              {renderTopSortIndicator('acos')}
                            </button>
                          </TableHead>
                        ) : null}
                        {topVisibleCols.includes('roas') ? (
                          <TableHead className="text-right">
                            <button className="flex items-center gap-1 ml-auto" onClick={() => toggleTopSort('roas')} type="button">
                              ROAS
                              {renderTopSortIndicator('roas')}
                            </button>
                          </TableHead>
                        ) : null}
                        {topVisibleCols.includes('conversionRate') ? (
                          <TableHead className="text-right">
                            <button className="flex items-center gap-1 ml-auto" onClick={() => toggleTopSort('conversionRate')} type="button">
                              转化率
                              {renderTopSortIndicator('conversionRate')}
                            </button>
                          </TableHead>
                        ) : null}
                        {topVisibleCols.includes('cpa') ? (
                          <TableHead className="text-right">
                            <button className="flex items-center gap-1 ml-auto" onClick={() => toggleTopSort('cpa')} type="button">
                              CPA
                              {renderTopSortIndicator('cpa')}
                            </button>
                          </TableHead>
                        ) : null}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {topRows.map((r, idx) => (
                        <TableRow key={`${r.term}-${idx}`}>
                          {(() => {
                            const acosForColor = r.sales > 0 ? r.acos : r.spend > 0 ? Number.POSITIVE_INFINITY : 0;
                            const acosText = r.sales > 0 ? `${r.acos.toFixed(2)}%` : r.spend > 0 ? '∞' : '0.00%';
                            return (
                              <>
                          <TableCell className="text-muted-foreground">{idx + 1}</TableCell>
                          <TableCell className="font-medium max-w-[520px] truncate" title={r.term}>
                            <button
                              type="button"
                              className="truncate text-left text-primary hover:underline"
                              onClick={() => handleCompareTerm(r.term)}
                              title="查看对比"
                            >
                              {r.term}
                            </button>
                          </TableCell>
                          <TableCell className="text-right whitespace-nowrap">
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon-sm"
                              aria-label="复制"
                              title="复制"
                              onClick={async () => {
                                const ok = await copyToClipboard(r.term);
                                if (ok) toast.success('已复制');
                                else toast.error('复制失败');
                              }}
                            >
                              <Copy className="size-4" />
                            </Button>
                          </TableCell>
                          {topVisibleCols.includes('impressions') ? (
                            <TableCell className="text-right">{r.impressions.toLocaleString()}</TableCell>
                          ) : null}
                          {topVisibleCols.includes('clicks') ? (
                            <TableCell className="text-right">{r.clicks.toLocaleString()}</TableCell>
                          ) : null}
                          {topVisibleCols.includes('spend') ? (
                            <TableCell className="text-right">{money.format(r.spend)}</TableCell>
                          ) : null}
                          {topVisibleCols.includes('sales') ? (
                            <TableCell className="text-right">{money.format(r.sales)}</TableCell>
                          ) : null}
                          {topVisibleCols.includes('orders') ? (
                            <TableCell className="text-right">{r.orders.toLocaleString()}</TableCell>
                          ) : null}
                          {topVisibleCols.includes('ctr') ? (
                            <TableCell className="text-right">{(r.ctr * 100).toFixed(2)}%</TableCell>
                          ) : null}
                          {topVisibleCols.includes('cpc') ? (
                            <TableCell className="text-right">{money.format(r.cpc)}</TableCell>
                          ) : null}
                          {topVisibleCols.includes('acos') ? (
                            <TableCell className="text-right">
                              <Badge
                                variant="outline"
                                className={cn(
                                  "w-16 justify-center",
                                  acosForColor > settings.targetAcos
                                    ? "border-destructive text-destructive bg-destructive/10"
                                    : "border-emerald-600 text-emerald-600 bg-emerald-50"
                                )}
                              >
                                {acosText}
                              </Badge>
                            </TableCell>
                          ) : null}
                          {topVisibleCols.includes('roas') ? (
                            <TableCell className="text-right">{r.roas.toFixed(2)}</TableCell>
                          ) : null}
                          {topVisibleCols.includes('conversionRate') ? (
                            <TableCell className="text-right">{(r.conversionRate * 100).toFixed(2)}%</TableCell>
                          ) : null}
                          {topVisibleCols.includes('cpa') ? (
                            <TableCell className="text-right">
                              {Number.isFinite(r.cpa) ? money.format(r.cpa) : '∞'}
                            </TableCell>
                          ) : null}
                              </>
                            );
                          })()}
                        </TableRow>
                      ))}
                      {!topRows.length ? (
                        <TableRow>
                          <TableCell colSpan={3 + topVisibleCols.length} className="text-center text-muted-foreground py-10">
                            暂无数据（可尝试放宽筛选）
                          </TableCell>
                        </TableRow>
                      ) : null}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </CollapsibleContent>
          </Collapsible>
        </Card>
        </div>
        <div id="section-root">
          <div className="flex justify-end">
            <Button variant="ghost" size="sm" onClick={() => jumpToSection('page-top')}>
              回到顶部
            </Button>
          </div>
          <Card className="col-span-1 md:col-span-2">
          <Collapsible open={rootOpen} onOpenChange={setRootOpen}>
            <CardHeader>
              <div className="flex flex-col gap-3">
                <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <CardTitle>词根统计</CardTitle>
                      <CollapsibleTrigger asChild>
                        <Button variant="ghost" size="sm" className="gap-1">
                          {rootOpen ? '收起' : '展开'}
                          <ChevronDown className={`w-4 h-4 transition-transform ${rootOpen ? 'rotate-180' : ''}`} />
                        </Button>
                      </CollapsibleTrigger>
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-1"
                        onClick={() => exportRootRows(rootBaseRows, "全部")}
                        disabled={!rootBaseRows.length}
                      >
                        <Download className="w-4 h-4" />
                        下载全部
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-1"
                        onClick={() => exportRootRows(rootFilteredRows, "筛选")}
                        disabled={!rootFilteredRows.length}
                      >
                        <Download className="w-4 h-4" />
                        下载筛选
                      </Button>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      共 {rootSummary.baseCount} 个词根，筛选后 {rootSummary.rootCount} 个 • 花费 {money.format(rootSummary.totalSpend)} • 无订单花费 {money.format(rootSummary.totalWasteSpend)}
                    </div>
                  </div>
                </div>
              </div>
            </CardHeader>
            <CollapsibleContent>
              <CardContent className="space-y-4">
                <div className="flex flex-wrap items-center gap-2">
                  <Tabs
                    value={rootDimension}
                    onValueChange={(v) => setRootDimension(v as typeof rootDimension)}
                    className="w-full md:w-auto"
                  >
                    <TabsList className="w-full md:w-fit overflow-x-auto">
                      <TabsTrigger value="keywords">关键词（不含 ASIN）</TabsTrigger>
                      <TabsTrigger value="all">搜索词（全部）</TabsTrigger>
                    </TabsList>
                  </Tabs>
                  <Select value={String(rootN)} onValueChange={(v) => setRootN(Number(v) === 3 ? 3 : Number(v) === 2 ? 2 : 1)}>
                    <SelectTrigger size="sm" className="w-[140px]">
                      <SelectValue placeholder="词根长度" />
                    </SelectTrigger>
                    <SelectContent align="end">
                      <SelectItem value="1">1 词根</SelectItem>
                      <SelectItem value="2">2 词根</SelectItem>
                      <SelectItem value="3">3 词根</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={String(rootTopN)} onValueChange={(v) => setRootTopN(Number(v) === 200 ? 200 : Number(v) === 100 ? 100 : 50)}>
                    <SelectTrigger size="sm" className="w-[120px]">
                      <SelectValue placeholder="Top N" />
                    </SelectTrigger>
                    <SelectContent align="end">
                      <SelectItem value="50">Top 50</SelectItem>
                      <SelectItem value="100">Top 100</SelectItem>
                      <SelectItem value="200">Top 200</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={rootSortKey} onValueChange={(v) => setRootSortKey(v as typeof rootSortKey)}>
                    <SelectTrigger size="sm" className="w-[160px]">
                      <SelectValue placeholder="排序指标" />
                    </SelectTrigger>
                    <SelectContent align="end">
                      <SelectItem value="root">按词根</SelectItem>
                      <SelectItem value="rootCount">按词频</SelectItem>
                      <SelectItem value="wasteSpend">按无订单花费</SelectItem>
                      <SelectItem value="wasteClicks">按无订单点击</SelectItem>
                      <SelectItem value="spend">按花费</SelectItem>
                      <SelectItem value="sales">按销售额</SelectItem>
                      <SelectItem value="orders">按订单</SelectItem>
                      <SelectItem value="clicks">按点击</SelectItem>
                      <SelectItem value="impressions">按展示</SelectItem>
                      <SelectItem value="termCount">按覆盖词数</SelectItem>
                      <SelectItem value="impressionShare">按曝光占比</SelectItem>
                      <SelectItem value="spendShare">按花费占比</SelectItem>
                      <SelectItem value="acos">按 ACOS</SelectItem>
                      <SelectItem value="roas">按 ROAS</SelectItem>
                      <SelectItem value="cpc">按 CPC</SelectItem>
                      <SelectItem value="ctr">按 CTR</SelectItem>
                      <SelectItem value="conversionRate">按转化率</SelectItem>
                      <SelectItem value="cpa">按 CPA</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setRootSortDir((d) => (d === 'desc' ? 'asc' : 'desc'))}
                  >
                    {rootSortDir === 'desc' ? '降序' : '升序'}
                  </Button>
                  <Button
                    variant={rootOnlyNoOrders ? "default" : "outline"}
                    size="sm"
                    onClick={() => setRootOnlyNoOrders((v) => !v)}
                  >
                    仅无订单
                  </Button>
                  <Button
                    variant={rootOnlyNoSales ? "default" : "outline"}
                    size="sm"
                    onClick={() => setRootOnlyNoSales((v) => !v)}
                  >
                    仅无销售
                  </Button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2">
                  <div className="space-y-1">
                    <div className="text-xs text-muted-foreground">搜索</div>
                    <Input
                      value={rootQuery}
                      onChange={(e) => setRootQuery(e.target.value)}
                      placeholder="输入词根"
                    />
                  </div>
                  <div className="space-y-1">
                    <div className="text-xs text-muted-foreground">最少花费</div>
                    <Input
                      type="number"
                      min={0}
                      value={rootMinSpend}
                      onChange={(e) => setRootMinSpend(e.target.value)}
                      placeholder="例如 10"
                      step={0.01}
                    />
                  </div>
                  <div className="space-y-1">
                    <div className="text-xs text-muted-foreground">最少点击</div>
                    <Input
                      type="number"
                      min={0}
                      value={rootMinClicks}
                      onChange={(e) => setRootMinClicks(e.target.value)}
                      placeholder="例如 10"
                      step={1}
                    />
                  </div>
                  <div className="space-y-1">
                    <div className="text-xs text-muted-foreground">最少覆盖词数</div>
                    <Input
                      type="number"
                      min={0}
                      value={rootMinTerms}
                      onChange={(e) => setRootMinTerms(e.target.value)}
                      placeholder="例如 5"
                      step={1}
                    />
                  </div>
                  <div className="flex items-end">
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full"
                      onClick={() => {
                        setRootQuery('');
                        setRootMinSpend('');
                        setRootMinClicks('');
                        setRootMinTerms('');
                        setRootOnlyNoOrders(true);
                        setRootOnlyNoSales(false);
                      }}
                    >
                      重置筛选
                    </Button>
                  </div>
                </div>

                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[54px]">#</TableHead>
                        <TableHead className="min-w-[240px]">
                          <button className="flex items-center gap-1" onClick={() => setRootSortKey('root')} type="button">
                            词根
                            {renderRootSortIndicator('root')}
                          </button>
                        </TableHead>
                        <TableHead className="w-[72px] text-right">复制</TableHead>
                        <TableHead className="text-right">
                          <button className="flex items-center gap-1 ml-auto" onClick={() => setRootSortKey('termCount')} type="button">
                            <HeaderTip label="覆盖词数" tip="包含该词根的不同搜索词数量" />
                            {renderRootSortIndicator('termCount')}
                          </button>
                        </TableHead>
                        <TableHead className="text-right">
                          <button className="flex items-center gap-1 ml-auto" onClick={() => setRootSortKey('rootCount')} type="button">
                            <HeaderTip label="词频" tip="该词根在搜索词中出现的总次数" />
                            {renderRootSortIndicator('rootCount')}
                          </button>
                        </TableHead>
                        <TableHead className="text-right">
                          <button className="flex items-center gap-1 ml-auto" onClick={() => setRootSortKey('wasteClicks')} type="button">
                            <HeaderTip label="无订单点击" tip="该词根下订单为 0 的点击量" />
                            {renderRootSortIndicator('wasteClicks')}
                          </button>
                        </TableHead>
                        <TableHead className="text-right">
                          <button className="flex items-center gap-1 ml-auto" onClick={() => setRootSortKey('wasteSpend')} type="button">
                            <HeaderTip label="无订单花费" tip="该词根下订单为 0 的花费" />
                            {renderRootSortIndicator('wasteSpend')}
                          </button>
                        </TableHead>
                        <TableHead className="text-right">
                          <button className="flex items-center gap-1 ml-auto" onClick={() => setRootSortKey('clicks')} type="button">
                            <HeaderTip label="点击" tip="该词根的总点击量" />
                            {renderRootSortIndicator('clicks')}
                          </button>
                        </TableHead>
                        <TableHead className="text-right">
                          <button className="flex items-center gap-1 ml-auto" onClick={() => setRootSortKey('spend')} type="button">
                            <HeaderTip label="花费" tip="该词根的总花费" />
                            {renderRootSortIndicator('spend')}
                          </button>
                        </TableHead>
                        <TableHead className="text-right">
                          <button className="flex items-center gap-1 ml-auto" onClick={() => setRootSortKey('impressionShare')} type="button">
                            <HeaderTip label="曝光占比" tip="该词根曝光占全部筛选数据的比例" />
                            {renderRootSortIndicator('impressionShare')}
                          </button>
                        </TableHead>
                        <TableHead className="text-right">
                          <button className="flex items-center gap-1 ml-auto" onClick={() => setRootSortKey('spendShare')} type="button">
                            <HeaderTip label="花费占比" tip="该词根花费占全部筛选数据的比例" />
                            {renderRootSortIndicator('spendShare')}
                          </button>
                        </TableHead>
                        <TableHead className="text-right">
                          <button className="flex items-center gap-1 ml-auto" onClick={() => setRootSortKey('orders')} type="button">
                            <HeaderTip label="订单" tip="该词根的总订单数" />
                            {renderRootSortIndicator('orders')}
                          </button>
                        </TableHead>
                        <TableHead className="text-right">
                          <button className="flex items-center gap-1 ml-auto" onClick={() => setRootSortKey('sales')} type="button">
                            <HeaderTip label="销售额" tip="该词根的总销售额" />
                            {renderRootSortIndicator('sales')}
                          </button>
                        </TableHead>
                        <TableHead className="text-right">
                          <button className="flex items-center gap-1 ml-auto" onClick={() => setRootSortKey('ctr')} type="button">
                            CTR
                            {renderRootSortIndicator('ctr')}
                          </button>
                        </TableHead>
                        <TableHead className="text-right">
                          <button className="flex items-center gap-1 ml-auto" onClick={() => setRootSortKey('conversionRate')} type="button">
                            转化率
                            {renderRootSortIndicator('conversionRate')}
                          </button>
                        </TableHead>
                        <TableHead className="text-right">
                          <button className="flex items-center gap-1 ml-auto" onClick={() => setRootSortKey('acos')} type="button">
                            ACOS
                            {renderRootSortIndicator('acos')}
                          </button>
                        </TableHead>
                        <TableHead className="text-right">
                          <button className="flex items-center gap-1 ml-auto" onClick={() => setRootSortKey('cpa')} type="button">
                            CPA
                            {renderRootSortIndicator('cpa')}
                          </button>
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {rootRows.map((r, idx) => {
                        const acosForColor = r.sales > 0 ? r.acos : r.spend > 0 ? Number.POSITIVE_INFINITY : 0;
                        const acosText = r.sales > 0 ? `${r.acos.toFixed(2)}%` : r.spend > 0 ? '∞' : '0.00%';
                        return (
                          <TableRow key={`${r.root}-${idx}`}>
                            <TableCell className="text-muted-foreground">{idx + 1}</TableCell>
                            <TableCell className="font-medium max-w-[420px] truncate" title={r.root}>
                              <button
                                type="button"
                                className="truncate text-left text-primary hover:underline"
                                onClick={() => setRootDetail(r.root)}
                                title="查看词根详情"
                              >
                                {r.root}
                              </button>
                            </TableCell>
                            <TableCell className="text-right whitespace-nowrap">
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon-sm"
                                aria-label="复制"
                                title="复制"
                                onClick={async () => {
                                  const ok = await copyToClipboard(r.root);
                                  if (ok) toast.success('已复制');
                                  else toast.error('复制失败');
                                }}
                              >
                                <Copy className="size-4" />
                              </Button>
                            </TableCell>
                            <TableCell className="text-right">{r.termCount.toLocaleString()}</TableCell>
                            <TableCell className="text-right">{r.rootCount.toLocaleString()}</TableCell>
                            <TableCell className="text-right">{r.wasteClicks.toLocaleString()}</TableCell>
                            <TableCell className="text-right">{money.format(r.wasteSpend)}</TableCell>
                            <TableCell className="text-right">{r.clicks.toLocaleString()}</TableCell>
                            <TableCell className="text-right">{money.format(r.spend)}</TableCell>
                            <TableCell className="text-right">{(r.impressionShare * 100).toFixed(2)}%</TableCell>
                            <TableCell className="text-right">{(r.spendShare * 100).toFixed(2)}%</TableCell>
                            <TableCell className="text-right">{r.orders.toLocaleString()}</TableCell>
                            <TableCell className="text-right">{money.format(r.sales)}</TableCell>
                            <TableCell className="text-right">{(r.ctr * 100).toFixed(2)}%</TableCell>
                            <TableCell className="text-right">{(r.conversionRate * 100).toFixed(2)}%</TableCell>
                            <TableCell className="text-right">
                              <Badge
                                variant="outline"
                                className={cn(
                                  "w-16 justify-center",
                                  acosForColor > settings.targetAcos
                                    ? "border-destructive text-destructive bg-destructive/10"
                                    : "border-emerald-600 text-emerald-600 bg-emerald-50"
                                )}
                              >
                                {acosText}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right">
                              {Number.isFinite(r.cpa) ? money.format(r.cpa) : '∞'}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                      {!rootRows.length ? (
                        <TableRow>
                          <TableCell colSpan={17} className="text-center text-muted-foreground py-10">
                            暂无数据（可尝试放宽筛选）
                          </TableCell>
                        </TableRow>
                      ) : null}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </CollapsibleContent>
          </Collapsible>
        </Card>
        </div>
        <Dialog
          open={Boolean(rootDetailSummary)}
          onOpenChange={(open) => {
            if (!open) {
              setRootDetail(null);
            }
          }}
        >
          <DialogContent className="w-[98vw] max-w-[98vw] sm:max-w-[98vw] h-[90vh] max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>词根数据明细</DialogTitle>
              <DialogDescription>{rootDetailSummary?.root}</DialogDescription>
            </DialogHeader>
            {rootDetailSummary ? (
              <div className="space-y-3">
                <div className="text-xs text-muted-foreground">
                  匹配记录 {rootDetailSummary.rows.toLocaleString()} 条（按当前筛选条件）
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                  <div className="rounded-md border p-2 space-y-1">
                    <div className="text-muted-foreground">搜索词数</div>
                    <div className="font-medium">{rootDetailSummary.termCount.toLocaleString()}</div>
                  </div>
                  <div className="rounded-md border p-2 space-y-1">
                    <div className="text-muted-foreground">花费</div>
                    <div className="font-medium">{money.format(rootDetailSummary.spend)}</div>
                  </div>
                  <div className="rounded-md border p-2 space-y-1">
                    <div className="text-muted-foreground">销售额</div>
                    <div className="font-medium">{money.format(rootDetailSummary.sales)}</div>
                  </div>
                  <div className="rounded-md border p-2 space-y-1">
                    <div className="text-muted-foreground">订单</div>
                    <div className="font-medium">{rootDetailSummary.orders.toLocaleString()}</div>
                  </div>
                  <div className="rounded-md border p-2 space-y-1">
                    <div className="text-muted-foreground">展示</div>
                    <div className="font-medium">{rootDetailSummary.impressions.toLocaleString()}</div>
                  </div>
                  <div className="rounded-md border p-2 space-y-1">
                    <div className="text-muted-foreground">点击</div>
                    <div className="font-medium">{rootDetailSummary.clicks.toLocaleString()}</div>
                  </div>
                  <div className="rounded-md border p-2 space-y-1">
                    <div className="text-muted-foreground">CTR</div>
                    <div className="font-medium">{(rootDetailSummary.ctr * 100).toFixed(2)}%</div>
                  </div>
                  <div className="rounded-md border p-2 space-y-1">
                    <div className="text-muted-foreground">ACOS</div>
                    <div className="font-medium">
                      {Number.isFinite(rootDetailSummary.acos) ? `${rootDetailSummary.acos.toFixed(2)}%` : '∞'}
                    </div>
                  </div>
                </div>

                {(() => {
                  const campaignKey = `root-detail:${rootDetailSummary.root}:campaign`;
                  const adGroupKey = `root-detail:${rootDetailSummary.root}:adgroup`;
                  const matchKey = `root-detail:${rootDetailSummary.root}:match`;
                  return (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-xs text-muted-foreground">
                      <Collapsible
                        open={Boolean(rootDetailExpanded[campaignKey])}
                        onOpenChange={(open) => setRootDetailExpandedState(campaignKey, open)}
                      >
                        <div className="space-y-1">
                          <div className="flex items-center justify-between gap-2">
                            <div>广告活动 {rootDetailSummary.campaignNames.length} 个</div>
                            <CollapsibleTrigger asChild>
                              <Button variant="ghost" size="sm" className="h-6 px-2">
                                {rootDetailExpanded[campaignKey] ? '收起' : '展开'}
                              </Button>
                            </CollapsibleTrigger>
                          </div>
                          <CollapsibleContent>
                            <div className="flex flex-wrap gap-1">
                              {rootDetailSummary.campaignNames.length ? (
                                rootDetailSummary.campaignNames.map((name) => (
                                  <Badge key={name} variant="secondary">
                                    {name}
                                  </Badge>
                                ))
                              ) : (
                                <span className="text-xs text-muted-foreground">—</span>
                              )}
                            </div>
                          </CollapsibleContent>
                        </div>
                      </Collapsible>
                      <Collapsible
                        open={Boolean(rootDetailExpanded[adGroupKey])}
                        onOpenChange={(open) => setRootDetailExpandedState(adGroupKey, open)}
                      >
                        <div className="space-y-1">
                          <div className="flex items-center justify-between gap-2">
                            <div>广告组 {rootDetailSummary.adGroupNames.length} 个</div>
                            <CollapsibleTrigger asChild>
                              <Button variant="ghost" size="sm" className="h-6 px-2">
                                {rootDetailExpanded[adGroupKey] ? '收起' : '展开'}
                              </Button>
                            </CollapsibleTrigger>
                          </div>
                          <CollapsibleContent>
                            <div className="flex flex-wrap gap-1">
                              {rootDetailSummary.adGroupNames.length ? (
                                rootDetailSummary.adGroupNames.map((name) => (
                                  <Badge key={name} variant="secondary">
                                    {name}
                                  </Badge>
                                ))
                              ) : (
                                <span className="text-xs text-muted-foreground">—</span>
                              )}
                            </div>
                          </CollapsibleContent>
                        </div>
                      </Collapsible>
                      <Collapsible
                        open={Boolean(rootDetailExpanded[matchKey])}
                        onOpenChange={(open) => setRootDetailExpandedState(matchKey, open)}
                      >
                        <div className="space-y-1">
                          <div className="flex items-center justify-between gap-2">
                            <div>匹配类型 {rootDetailSummary.matchTypes.length} 个</div>
                            <CollapsibleTrigger asChild>
                              <Button variant="ghost" size="sm" className="h-6 px-2">
                                {rootDetailExpanded[matchKey] ? '收起' : '展开'}
                              </Button>
                            </CollapsibleTrigger>
                          </div>
                          <CollapsibleContent>
                            <div className="flex flex-wrap gap-1">
                              {rootDetailSummary.matchTypes.length ? (
                                rootDetailSummary.matchTypes.map((name) => (
                                  <Badge key={name} variant="secondary">
                                    {name}
                                  </Badge>
                                ))
                              ) : (
                                <span className="text-xs text-muted-foreground">—</span>
                              )}
                            </div>
                          </CollapsibleContent>
                        </div>
                      </Collapsible>
                    </div>
                  );
                })()}

                <div className="rounded-lg border p-3 space-y-2">
                  <div className="text-sm font-medium">包含该词根的搜索词</div>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[54px]">#</TableHead>
                        <TableHead>搜索词</TableHead>
                        <TableHead>广告活动</TableHead>
                        <TableHead>广告组</TableHead>
                        <TableHead className="text-right">展示</TableHead>
                        <TableHead className="text-right">点击</TableHead>
                        <TableHead className="text-right">花费</TableHead>
                        <TableHead className="text-right">销售额</TableHead>
                        <TableHead className="text-right">订单</TableHead>
                        <TableHead className="text-right">CTR</TableHead>
                        <TableHead className="text-right">ACOS</TableHead>
                        <TableHead className="text-right">转化率</TableHead>
                        <TableHead className="text-right">CPA</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {rootDetailSummary.terms.map((term, idx) => {
                        const acosForColor = term.sales > 0 ? term.acos : term.spend > 0 ? Number.POSITIVE_INFINITY : 0;
                        const acosText = term.sales > 0 ? `${term.acos.toFixed(2)}%` : term.spend > 0 ? '∞' : '0.00%';
                        const rowKey = `${rootDetailSummary.root}:${term.term}`;
                        const expanded = Boolean(rootDetailExpanded[rowKey]);
                        return (
                          <>
                            <TableRow key={`${term.term}-${idx}`}>
                              <TableCell className="text-muted-foreground">{idx + 1}</TableCell>
                              <TableCell className="font-medium max-w-[520px] truncate" title={term.term}>
                                <button
                                  type="button"
                                  className="truncate text-left text-primary hover:underline"
                                  onClick={() => handleRootTermCompare(term.term)}
                                  title="查看对比"
                                >
                                  {term.term}
                                </button>
                              </TableCell>
                              <TableCell
                                className="max-w-[200px] truncate"
                                title={term.campaignNames.length ? term.campaignNames.join('、') : ''}
                              >
                                {renderRootDetailMultiCell('广告活动', term.campaignLabel, term.campaignNames, rowKey)}
                              </TableCell>
                              <TableCell
                                className="max-w-[200px] truncate"
                                title={term.adGroupNames.length ? term.adGroupNames.join('、') : ''}
                              >
                                {renderRootDetailMultiCell('广告组', term.adGroupLabel, term.adGroupNames, rowKey)}
                              </TableCell>
                              <TableCell className="text-right">{term.impressions.toLocaleString()}</TableCell>
                              <TableCell className="text-right">{term.clicks.toLocaleString()}</TableCell>
                              <TableCell className="text-right">{money.format(term.spend)}</TableCell>
                              <TableCell className="text-right">{money.format(term.sales)}</TableCell>
                              <TableCell className="text-right">{term.orders.toLocaleString()}</TableCell>
                              <TableCell className="text-right">{(term.ctr * 100).toFixed(2)}%</TableCell>
                              <TableCell className="text-right">
                                <Badge
                                  variant="outline"
                                  className={cn(
                                    "w-16 justify-center",
                                    acosForColor > settings.targetAcos
                                      ? "border-destructive text-destructive bg-destructive/10"
                                      : "border-emerald-600 text-emerald-600 bg-emerald-50"
                                  )}
                                >
                                  {acosText}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-right">{(term.conversionRate * 100).toFixed(2)}%</TableCell>
                              <TableCell className="text-right">
                                {Number.isFinite(term.cpa) ? money.format(term.cpa) : '∞'}
                              </TableCell>
                            </TableRow>
                            {expanded ? (
                              <TableRow>
                                <TableCell colSpan={13} className="bg-muted/20">
                                  <div className="p-3 rounded-md border bg-background space-y-3">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                      <div className="space-y-2">
                                        <div className="text-xs font-medium">广告活动（{term.campaignNames.length}）</div>
                                        <div className="flex flex-wrap gap-1">
                                          {term.campaignNames.length ? (
                                            term.campaignNames.map((v) => (
                                              <Badge key={v} variant="secondary">
                                                {v}
                                              </Badge>
                                            ))
                                          ) : (
                                            <span className="text-xs text-muted-foreground">—</span>
                                          )}
                                        </div>
                                      </div>
                                      <div className="space-y-2">
                                        <div className="text-xs font-medium">广告组（{term.adGroupNames.length}）</div>
                                        <div className="flex flex-wrap gap-1">
                                          {term.adGroupNames.length ? (
                                            term.adGroupNames.map((v) => (
                                              <Badge key={v} variant="secondary">
                                                {v}
                                              </Badge>
                                            ))
                                          ) : (
                                            <span className="text-xs text-muted-foreground">—</span>
                                          )}
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                </TableCell>
                              </TableRow>
                            ) : null}
                          </>
                        );
                      })}
                      {!rootDetailSummary.terms.length ? (
                        <TableRow>
                          <TableCell colSpan={13} className="text-center text-muted-foreground py-10">
                            暂无数据
                          </TableCell>
                        </TableRow>
                      ) : null}
                    </TableBody>
                  </Table>
                </div>
              </div>
            ) : null}
          </DialogContent>
        </Dialog>
        <div id="section-scatter">
          <div className="flex justify-end">
            <Button variant="ghost" size="sm" onClick={() => jumpToSection('page-top')}>
              回到顶部
            </Button>
          </div>
          <ScatterAnalysis data={analysisRows} targetAcos={settings.targetAcos} />
        </div>
        <Dialog
          open={Boolean(compareSummary)}
          onOpenChange={(open) => {
            if (!open) {
              setCompareTerm(null);
              setCompareAdGroupKey(null);
              setCompareCustomRange(undefined);
            }
          }}
        >
        <DialogContent className="w-[98vw] max-w-[98vw] sm:max-w-[98vw] h-[95vh] max-h-[95vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>搜索词数据对比</DialogTitle>
              <DialogDescription>{compareSummary?.term}</DialogDescription>
            </DialogHeader>
            {compareSummary ? (
              <div className="space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  <div className="text-xs text-muted-foreground">自定义日期</div>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" size="sm" className="gap-2">
                        <CalendarIcon className="w-4 h-4" />
                        {compareCustomRange?.from
                          ? compareCustomRange?.to
                            ? `${format(compareCustomRange.from, 'yyyy-MM-dd')} ~ ${format(compareCustomRange.to, 'yyyy-MM-dd')}`
                            : format(compareCustomRange.from, 'yyyy-MM-dd')
                          : '选择日期范围'}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent align="start" className="w-auto p-0">
                      <Calendar
                        mode="range"
                        numberOfMonths={2}
                        selected={compareCustomRange}
                        onSelect={(range) => setCompareCustomRange(range ?? undefined)}
                        disabled={(d) => {
                          if (!compareMinDate || !compareMaxDate) return false;
                          const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())).getTime();
                          return t < compareMinDate.getTime() || t > compareMaxDate.getTime();
                        }}
                      />
                    </PopoverContent>
                  </Popover>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={!compareCustomRange?.from && !compareCustomRange?.to}
                    onClick={() => setCompareCustomRange(undefined)}
                  >
                    清除
                  </Button>
                </div>
                <div className="text-xs text-muted-foreground">
                  匹配记录 {compareSummary.totalRows} 条（同词在不同日期/广告活动/广告组/匹配类型的原始行）
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-xs text-muted-foreground">
                  <div className="space-y-1">
                    <div>广告活动 {compareSummary.campaignNames.length} 个</div>
                    <div className="flex flex-wrap gap-1">
                      {compareSummary.campaignNames.map((name) => (
                        <Badge key={name} variant="secondary">
                          {name}
                        </Badge>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-1">
                    <div>广告组 {compareSummary.adGroupNames.length} 个</div>
                    <div className="flex flex-wrap gap-1">
                      {compareSummary.adGroupNames.map((name) => (
                        <Badge key={name} variant="secondary">
                          {name}
                        </Badge>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-1">
                    <div>匹配类型 {compareSummary.matchTypes.length} 个</div>
                    <div className="flex flex-wrap gap-1">
                      {compareSummary.matchTypes.map((name) => (
                        <Badge key={name} variant="secondary">
                          {name}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="rounded-lg border p-3 space-y-2" id="compare-trend">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="text-sm font-medium">趋势</div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span>{compareAdGroupLabel}</span>
                      {compareAdGroupKey ? (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => setCompareAdGroupKey(null)}
                        >
                          清除
                        </Button>
                      ) : null}
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <span>显示</span>
                    <ToggleGroup
                      type="multiple"
                      size="sm"
                      variant="outline"
                      spacing={0}
                      value={compareTrendSeries}
                      onValueChange={(next) => {
                        if (!next.length) return;
                        setCompareTrendSeries(next as Array<'spend' | 'sales' | 'orders'>);
                      }}
                    >
                      <ToggleGroupItem value="spend">花费</ToggleGroupItem>
                      <ToggleGroupItem value="sales">销售额</ToggleGroupItem>
                      <ToggleGroupItem value="orders">订单</ToggleGroupItem>
                    </ToggleGroup>
                  </div>
                  {compareTrend.length ? (
                    <div className="h-[260px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={compareTrend} margin={{ top: 10, right: 16, left: 0, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                          <YAxis tick={{ fontSize: 11 }} />
                          <Tooltip
                            formatter={(value, name) => {
                              if (name === '花费' || name === '销售额') {
                                return [money.format(Number(value)), name];
                              }
                              return [Number(value).toLocaleString(), name];
                            }}
                          />
                          {compareTrendSeries.includes('spend') ? (
                            <Line type="monotone" dataKey="spend" name="花费" stroke="var(--chart-5)" strokeWidth={2} />
                          ) : null}
                          {compareTrendSeries.includes('sales') ? (
                            <Line type="monotone" dataKey="sales" name="销售额" stroke="var(--chart-2)" strokeWidth={2} />
                          ) : null}
                          {compareTrendSeries.includes('orders') ? (
                            <Line type="monotone" dataKey="orders" name="订单" stroke="var(--chart-4)" strokeWidth={2} />
                          ) : null}
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  ) : (
                    <div className="text-sm text-muted-foreground">暂无趋势数据</div>
                  )}
                </div>
                <div className="rounded-lg border p-3 space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="text-sm font-medium">流量趋势（柱图）</div>
                    <div className="text-xs text-muted-foreground">{compareAdGroupLabel}</div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <span>显示</span>
                    <ToggleGroup
                      type="multiple"
                      size="sm"
                      variant="outline"
                      spacing={0}
                      value={compareTrafficSeries}
                      onValueChange={(next) => {
                        if (!next.length) return;
                        setCompareTrafficSeries(next as Array<'impressions' | 'clicks' | 'ctr'>);
                      }}
                    >
                      <ToggleGroupItem value="impressions">展示量</ToggleGroupItem>
                      <ToggleGroupItem value="clicks">点击量</ToggleGroupItem>
                      <ToggleGroupItem value="ctr">点击率</ToggleGroupItem>
                    </ToggleGroup>
                  </div>
                  {compareTrend.length ? (
                    <div className="h-[220px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={compareTrend} margin={{ top: 10, right: 16, left: 0, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                          {compareTrafficSeries.includes('impressions') || compareTrafficSeries.includes('clicks') ? (
                            <YAxis yAxisId="traffic" tick={{ fontSize: 11 }} />
                          ) : null}
                          {compareTrafficSeries.includes('ctr') ? (
                            <YAxis yAxisId="ctr" orientation="right" tick={{ fontSize: 11 }} tickFormatter={(value) => `${Number(value).toFixed(1)}%`} />
                          ) : null}
                          <Tooltip
                            formatter={(value, name) => {
                              const raw = Array.isArray(value) ? value[0] : value;
                              const numeric = raw === null || raw === undefined ? null : Number(raw);
                              if (name === '点击率') return [numeric !== null && Number.isFinite(numeric) ? `${numeric.toFixed(2)}%` : '0.00%', name];
                              return [numeric !== null && Number.isFinite(numeric) ? numeric.toLocaleString() : '0', name];
                            }}
                          />
                          <Legend />
                          {compareTrafficSeries.includes('impressions') ? (
                            <Bar yAxisId="traffic" dataKey="impressions" name="展示量" fill="var(--chart-1)" radius={[4, 4, 0, 0]} />
                          ) : null}
                          {compareTrafficSeries.includes('clicks') ? (
                            <Bar yAxisId="traffic" dataKey="clicks" name="点击量" fill="var(--chart-2)" radius={[4, 4, 0, 0]} />
                          ) : null}
                          {compareTrafficSeries.includes('ctr') ? (
                            <Bar yAxisId="ctr" dataKey="ctr" name="点击率" fill="var(--chart-5)" radius={[4, 4, 0, 0]} />
                          ) : null}
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  ) : (
                    <div className="text-sm text-muted-foreground">暂无趋势数据</div>
                  )}
                </div>
                <div className="rounded-lg border p-3 space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="text-sm font-medium">转化趋势（柱图）</div>
                    <div className="text-xs text-muted-foreground">{compareAdGroupLabel}</div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <span>显示</span>
                    <ToggleGroup
                      type="multiple"
                      size="sm"
                      variant="outline"
                      spacing={0}
                      value={compareConversionSeries}
                      onValueChange={(next) => {
                        if (!next.length) return;
                        setCompareConversionSeries(next as Array<'orders' | 'conversionRate'>);
                      }}
                    >
                      <ToggleGroupItem value="orders">订单数</ToggleGroupItem>
                      <ToggleGroupItem value="conversionRate">转化率</ToggleGroupItem>
                    </ToggleGroup>
                  </div>
                  {compareTrend.length ? (
                    <div className="h-[220px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={compareTrend} margin={{ top: 10, right: 16, left: 0, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                          {compareConversionSeries.includes('orders') ? (
                            <YAxis yAxisId="orders" tick={{ fontSize: 11 }} />
                          ) : null}
                          {compareConversionSeries.includes('conversionRate') ? (
                            <YAxis yAxisId="rate" orientation="right" tick={{ fontSize: 11 }} tickFormatter={(value) => `${Number(value).toFixed(1)}%`} />
                          ) : null}
                          <Tooltip
                            formatter={(value, name) => {
                              const raw = Array.isArray(value) ? value[0] : value;
                              const numeric = raw === null || raw === undefined ? null : Number(raw);
                              if (name === '转化率') return [numeric !== null && Number.isFinite(numeric) ? `${numeric.toFixed(2)}%` : '0.00%', name];
                              return [numeric !== null && Number.isFinite(numeric) ? numeric.toLocaleString() : '0', name];
                            }}
                          />
                          <Legend />
                          {compareConversionSeries.includes('orders') ? (
                            <Bar yAxisId="orders" dataKey="orders" name="订单数" fill="var(--chart-3)" radius={[4, 4, 0, 0]} />
                          ) : null}
                          {compareConversionSeries.includes('conversionRate') ? (
                            <Bar yAxisId="rate" dataKey="conversionRate" name="转化率" fill="var(--chart-2)" radius={[4, 4, 0, 0]} />
                          ) : null}
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  ) : (
                    <div className="text-sm text-muted-foreground">暂无趋势数据</div>
                  )}
                </div>
                <div className="rounded-lg border p-3 space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="text-sm font-medium">CPC 趋势（独立）</div>
                    <div className="text-xs text-muted-foreground">{compareAdGroupLabel}</div>
                  </div>
                  <div className="text-xs text-muted-foreground">只展示 CPC，便于观察波动</div>
                  {compareTrend.length ? (
                    <div className="h-[220px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={compareTrend} margin={{ top: 10, right: 16, left: 0, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                          <YAxis
                            tick={{ fontSize: 11 }}
                            tickFormatter={(value) => money.format(Number(value))}
                            domain={[
                              (min: number) => Math.max(0, min * 0.9),
                              (max: number) => (Number.isFinite(max) && max > 0 ? max * 1.2 : 1),
                            ]}
                          />
                          <Tooltip formatter={(value) => [money.format(Number(value)), 'CPC']} />
                          <Line type="monotone" dataKey="cpc" name="CPC" stroke="var(--chart-3)" strokeWidth={2}>
                            <LabelList
                              dataKey="cpc"
                              position="top"
                              formatter={(value: number) => money.format(Number(value))}
                              className="fill-muted-foreground"
                              fontSize={10}
                            />
                          </Line>
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  ) : (
                    <div className="text-sm text-muted-foreground">暂无趋势数据</div>
                  )}
                </div>
                <div className="rounded-lg border p-3 space-y-2">
                  <div className="text-sm font-medium">按广告组细分 {compareCustomRange ? '(自定义日期范围内)' : '(全部日期)'}</div>
                  <div className="max-h-[300px] overflow-y-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>广告活动</TableHead>
                          <TableHead>广告组</TableHead>
                          <TableHead className="text-right">点击</TableHead>
                          <TableHead className="text-right">订单</TableHead>
                          <TableHead className="text-right">销售额</TableHead>
                          <TableHead className="text-right">花费</TableHead>
                          <TableHead className="text-right">
                            <HeaderTip label="CPC" tip="点击数值可查看该广告组趋势" />
                          </TableHead>
                          <TableHead className="text-right">ACOS</TableHead>
                          <TableHead className="text-right">转化率</TableHead>
                          <TableHead className="text-right">CPA</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {compareSummary.byAdGroup.map((group) => (
                          <TableRow
                            key={`${group.campaignName}-${group.adGroupName}`}
                            className={cn(compareAdGroupKey === group.key && "bg-muted/40")}
                          >
                            <TableCell className="max-w-[200px] truncate" title={group.campaignName}>{group.campaignName}</TableCell>
                            <TableCell className="max-w-[200px] truncate" title={group.adGroupName}>{group.adGroupName}</TableCell>
                            <TableCell className="text-right">{group.metrics.clicks.toLocaleString()}</TableCell>
                            <TableCell className="text-right">{group.metrics.orders}</TableCell>
                            <TableCell className="text-right">{money.format(group.metrics.sales)}</TableCell>
                            <TableCell className="text-right">{money.format(group.metrics.spend)}</TableCell>
                            <TableCell className="text-right">
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="h-auto px-2 py-1"
                                title="点击查看趋势"
                                onClick={() => {
                                  setCompareAdGroupKey(group.key);
                                  requestAnimationFrame(() => {
                                    document.getElementById("compare-trend")?.scrollIntoView({ behavior: "smooth", block: "start" });
                                  });
                                }}
                              >
                                {money.format(group.metrics.cpc)}
                              </Button>
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex justify-end">
                                <Badge
                                  variant="outline"
                                  className={cn(
                                    "w-16 justify-center",
                                    (group.metrics.sales > 0 ? group.metrics.acos : group.metrics.spend > 0 ? Number.POSITIVE_INFINITY : 0) > settings.targetAcos
                                      ? "border-destructive text-destructive bg-destructive/10"
                                      : "border-emerald-600 text-emerald-600 bg-emerald-50"
                                  )}
                                >
                                  {group.metrics.sales > 0 ? `${group.metrics.acos.toFixed(2)}%` : group.metrics.spend > 0 ? "∞" : "0.00%"}
                                </Badge>
                              </div>
                            </TableCell>
                            <TableCell className="text-right">{(group.metrics.conversionRate * 100).toFixed(2)}%</TableCell>
                            <TableCell className="text-right">{Number.isFinite(group.metrics.cpa) ? money.format(group.metrics.cpa) : '∞'}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
                <div className="flex flex-nowrap gap-3 overflow-x-auto pb-4">
                  {compareSummary.ranges.map((range) => (
                    <div
                      key={range.label}
                      className="rounded-lg border p-3 space-y-3 w-[280px] flex-none bg-card"
                    >
                      <div className="flex items-center justify-between border-b pb-2">
                        <div className="font-semibold text-sm">{range.label}</div>
                        <div className="text-[10px] text-muted-foreground">{range.rangeText}</div>
                      </div>
                      {range.metrics.rows ? (
                        <div className="grid grid-cols-2 gap-x-2 gap-y-1.5 text-xs">
                          <div className="text-muted-foreground">记录</div>
                          <div className="text-right">{range.metrics.rows.toLocaleString()}</div>
                          <div className="text-muted-foreground">花费</div>
                          <div className="text-right">{money.format(range.metrics.spend)}</div>
                          <div className="text-muted-foreground">销售额</div>
                          <div className="text-right">{money.format(range.metrics.sales)}</div>
                          <div className="text-muted-foreground">展示</div>
                          <div className="text-right">{range.metrics.impressions.toLocaleString()}</div>
                          <div className="text-muted-foreground">点击</div>
                          <div className="text-right">{range.metrics.clicks.toLocaleString()}</div>
                          <div className="text-muted-foreground">订单</div>
                          <div className="text-right">{range.metrics.orders.toLocaleString()}</div>
                          <div className="text-muted-foreground">CPA</div>
                          <div className="text-right">
                            {Number.isFinite(range.metrics.cpa) ? money.format(range.metrics.cpa) : '∞'}
                          </div>
                          <div className="text-muted-foreground">客单价</div>
                          <div className="text-right">
                            {range.metrics.orders > 0 ? money.format(range.metrics.aov) : '—'}
                          </div>
                          <div className="text-muted-foreground">CTR</div>
                          <div className="text-right">{(range.metrics.ctr * 100).toFixed(2)}%</div>
                          <div className="text-muted-foreground">CPC</div>
                          <div className="text-right">{money.format(range.metrics.cpc)}</div>
                          <div className="text-muted-foreground">ACOS</div>
                          <div className="text-right">
                            <Badge
                              variant="outline"
                              className={cn(
                                "w-16 justify-center",
                                (range.metrics.sales > 0 ? range.metrics.acos : range.metrics.spend > 0 ? Number.POSITIVE_INFINITY : 0) > settings.targetAcos
                                  ? "border-destructive text-destructive bg-destructive/10"
                                  : "border-emerald-600 text-emerald-600 bg-emerald-50"
                              )}
                            >
                              {range.metrics.sales > 0 ? `${range.metrics.acos.toFixed(2)}%` : range.metrics.spend > 0 ? "∞" : "0.00%"}
                            </Badge>
                          </div>
                          <div className="text-muted-foreground">ROAS</div>
                          <div className="text-right">{range.metrics.roas.toFixed(2)}</div>
                          <div className="text-muted-foreground">转化率</div>
                          <div className="text-right">{(range.metrics.conversionRate * 100).toFixed(2)}%</div>
                        </div>
                      ) : (
                        <div className="text-sm text-muted-foreground">暂无数据</div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
