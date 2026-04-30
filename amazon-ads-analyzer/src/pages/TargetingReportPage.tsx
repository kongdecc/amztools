import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowDown, ArrowLeft, ArrowUp, ArrowUpDown, CircleHelp, Download, FileSpreadsheet, Loader2, Upload } from 'lucide-react';
import { useDropzone } from 'react-dropzone';
import { Link } from 'wouter';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';
import { parseTargetingReport, type TargetingRecord } from '@/lib/report-parsers';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Switch } from '@/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tooltip as UiTooltip, TooltipContent as UiTooltipContent, TooltipTrigger as UiTooltipTrigger } from '@/components/ui/tooltip';
import { createUploadHistoryStore, type HistoryMeta } from '@/lib/upload-history';
import { cn } from '@/lib/utils';
import { Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

function formatMoney(value: number, currency: string) {
  return new Intl.NumberFormat('zh-CN', { style: 'currency', currency, maximumFractionDigits: 2 }).format(value);
}

function formatPct(value: number) {
  return `${(value * 100).toFixed(2)}%`;
}

type SortKey =
  | 'targeting'
  | 'date'
  | 'campaignName'
  | 'matchType'
  | 'impressions'
  | 'clicks'
  | 'spend'
  | 'sales'
  | 'orders'
  | 'ctr'
  | 'cpc'
  | 'acos'
  | 'roas'
  | 'conversionRate';

type TargetingType = '关键词' | 'ASIN' | '其他';
type ConversionFilter = '全部' | '有订单' | '无订单';
type ShareMetric = 'spend' | 'sales' | 'orders';
type ProductStage = '新品' | '成熟';

type EnrichedTargetingRecord = TargetingRecord & {
  targetingType: TargetingType;
};

const CHART_COLORS = ['#4f46e5', '#06b6d4', '#10b981', '#f59e0b', '#ef4444', '#a855f7', '#14b8a6'];

const RADIAN = Math.PI / 180;

function renderPiePercentLabel({
  cx,
  cy,
  midAngle,
  innerRadius,
  outerRadius,
  percent,
}: {
  cx?: number;
  cy?: number;
  midAngle?: number;
  innerRadius?: number;
  outerRadius?: number;
  percent?: number;
}) {
  const safePercent = percent ?? 0;
  if (safePercent <= 0) return null;
  const safeCx = cx ?? 0;
  const safeCy = cy ?? 0;
  const safeInner = innerRadius ?? 0;
  const safeOuter = outerRadius ?? 0;
  const safeAngle = midAngle ?? 0;
  const radius = safeInner + (safeOuter - safeInner) * 0.62;
  const x = safeCx + radius * Math.cos(-safeAngle * RADIAN);
  const y = safeCy + radius * Math.sin(-safeAngle * RADIAN);
  return (
    <text x={x} y={y} fill="#111827" textAnchor="middle" dominantBaseline="central" fontSize={12} fontWeight={600}>
      {(safePercent * 100).toFixed(1)}%
    </text>
  );
}

function detectTargetingType(text: string): TargetingType {
  const normalized = text.trim().toLowerCase();
  if (!normalized) return '其他';
  if (
    normalized.startsWith('asin=') ||
    normalized.startsWith('asin-expanded=') ||
    /^b0[a-z0-9]{8}$/i.test(normalized.replace(/["']/g, '')) ||
    /b0[a-z0-9]{8}/i.test(normalized)
  ) {
    return 'ASIN';
  }
  if (normalized.includes('category=') || normalized.includes('similar=') || normalized.includes('complements=')) {
    return '其他';
  }
  return '关键词';
}

export default function TargetingReportPage() {
  const historyStore = useMemo(() => createUploadHistoryStore('targeting-upload'), []);
  const [rows, setRows] = useState<TargetingRecord[]>([]);
  const [fileLabel, setFileLabel] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [currency, setCurrency] = useState('USD');
  const [query, setQuery] = useState('');
  const [campaignFilter, setCampaignFilter] = useState('全部');
  const [matchTypeFilter, setMatchTypeFilter] = useState('全部');
  const [targetingTypeFilter, setTargetingTypeFilter] = useState<'全部' | TargetingType>('全部');
  const [conversionFilter, setConversionFilter] = useState<ConversionFilter>('全部');
  const [minClicks, setMinClicks] = useState('');
  const [minSpend, setMinSpend] = useState('');
  const [maxAcos, setMaxAcos] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('spend');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [tableLimit, setTableLimit] = useState('120');
  const [targetAcos, setTargetAcos] = useState('30');
  const [productStage, setProductStage] = useState<ProductStage>('成熟');
  const [highOrderThreshold, setHighOrderThreshold] = useState('2');
  const [highEffClickThreshold, setHighEffClickThreshold] = useState('8');
  const [wasteClickThreshold, setWasteClickThreshold] = useState('10');
  const [wasteSpendThreshold, setWasteSpendThreshold] = useState('20');
  const [highAcosFactor, setHighAcosFactor] = useState('2');
  const [highAcosClickThreshold, setHighAcosClickThreshold] = useState('8');
  const [historyItems, setHistoryItems] = useState<HistoryMeta[]>([]);
  const [mergeEnabled, setMergeEnabled] = useState(true);
  const [mergeTargetId, setMergeTargetId] = useState<string | null>(null);
  const [shareMetric, setShareMetric] = useState<ShareMetric>('spend');
  const historyItemsRef = useRef<HistoryMeta[]>([]);

  const buildRowKey = (row: TargetingRecord) =>
    [row.date, row.campaignName, row.adGroupName, row.targeting, row.matchType].join('|').toLowerCase();

  const mergeRecords = (base: TargetingRecord[], incoming: TargetingRecord[]) => {
    const map = new Map<string, TargetingRecord>();
    for (const row of base) map.set(buildRowKey(row), row);
    for (const row of incoming) map.set(buildRowKey(row), row);
    return Array.from(map.values());
  };

  const getRangeSummary = (items: TargetingRecord[]) => {
    const dates = items.map((r) => r.date).filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d));
    if (!dates.length) return { minYmd: null, maxYmd: null };
    const minYmd = dates.reduce((acc, d) => (d < acc ? d : acc), dates[0]);
    const maxYmd = dates.reduce((acc, d) => (d > acc ? d : acc), dates[0]);
    return { minYmd, maxYmd };
  };

  useEffect(() => {
    let alive = true;
    historyStore.loadMeta().then((items) => {
      if (!alive) return;
      historyItemsRef.current = items;
      setHistoryItems(items);
    });
    return () => {
      alive = false;
    };
  }, [historyStore]);

  useEffect(() => {
    if (productStage === '新品') {
      setTargetAcos('40');
      setHighOrderThreshold('1');
      setHighEffClickThreshold('6');
      setWasteClickThreshold('12');
      setWasteSpendThreshold('15');
      setHighAcosFactor('2.2');
      setHighAcosClickThreshold('10');
      return;
    }
    setTargetAcos('30');
    setHighOrderThreshold('2');
    setHighEffClickThreshold('8');
    setWasteClickThreshold('10');
    setWasteSpendThreshold('20');
    setHighAcosFactor('2');
    setHighAcosClickThreshold('8');
  }, [productStage]);

  const resetFilters = () => {
    setQuery('');
    setCampaignFilter('全部');
    setMatchTypeFilter('全部');
    setTargetingTypeFilter('全部');
    setConversionFilter('全部');
    setMinClicks('');
    setMinSpend('');
    setMaxAcos('');
    setSortKey('spend');
    setSortDirection('desc');
  };

  const resetAll = () => {
    setRows([]);
    setFileLabel('');
    setCurrency('USD');
    setProductStage('成熟');
    setTargetAcos('30');
    setHighOrderThreshold('2');
    setHighEffClickThreshold('8');
    setWasteClickThreshold('10');
    setWasteSpendThreshold('20');
    setHighAcosFactor('2');
    setHighAcosClickThreshold('8');
    setTableLimit('120');
    resetFilters();
  };

  const onDrop = async (files: File[]) => {
    if (!files.length) return;
    setIsLoading(true);
    try {
      let merged: TargetingRecord[] = [];
      let nextCurrency: string | null = null;
      for (const file of files) {
        const { records, currency: detectedCurrency } = await parseTargetingReport(file);
        merged = merged.concat(records);
        if (!nextCurrency && detectedCurrency) nextCurrency = detectedCurrency;
      }
      const dedupMap = new Map<string, TargetingRecord>();
      for (const item of merged) {
        dedupMap.set(buildRowKey(item), item);
      }
      const deduped = Array.from(dedupMap.values());

      let baseData: TargetingRecord[] = [];
      let targetLabel: string | null = null;
      if (mergeTargetId) {
        const records = await historyStore.loadRecords<TargetingRecord>(mergeTargetId);
        if (!records?.length) {
          toast.error('要合并的历史记录已损坏或被清理');
          setMergeTargetId(null);
        } else {
          baseData = records;
          targetLabel = historyItemsRef.current.find((item) => item.id === mergeTargetId)?.fileNames.join('、') ?? null;
        }
      } else if (mergeEnabled && rows.length) {
        baseData = rows;
      }
      const finalRows = mergeEnabled ? mergeRecords(baseData, deduped) : deduped;

      setRows(finalRows);
      const nextFileLabel =
        mergeTargetId
          ? `合并历史记录（新增${files.length}个文件）`
          : mergeEnabled && rows.length
            ? `累计上传（新增${files.length}个文件）`
            : files.length === 1
              ? files[0].name
              : `批量上传（${files.length}）`;
      setFileLabel(nextFileLabel);
      if (nextCurrency) setCurrency(nextCurrency);
      resetFilters();

      const range = getRangeSummary(finalRows);
      const historyItem: HistoryMeta = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
        fileNames: files.map((f) => f.name),
        createdAt: Date.now(),
        currency: nextCurrency,
        minYmd: range.minYmd,
        maxYmd: range.maxYmd,
        total: finalRows.length,
      };
      const nextItems = [historyItem, ...historyItemsRef.current].slice(0, historyStore.maxItems);
      historyItemsRef.current = nextItems;
      setHistoryItems(nextItems);
      await historyStore.persistMeta(nextItems);
      await historyStore.saveRecords(historyItem.id, finalRows);

      const mergeText = targetLabel ? `（合并：${targetLabel}）` : '';
      toast.success(`已解析 ${deduped.length} 条投放数据，当前 ${finalRows.length} 条${mergeText}`);
    } catch (error) {
      console.error(error);
      toast.error('投放报表解析失败');
    } finally {
      setIsLoading(false);
    }
  };

  const clearHistory = async () => {
    if (!historyItems.length) return;
    if (!window.confirm('确认清空全部历史记录吗？此操作不可恢复。')) return;
    await historyStore.clearAll(historyItems);
    historyItemsRef.current = [];
    setHistoryItems([]);
    setMergeTargetId(null);
    toast.success('已清空历史记录');
  };

  const renderRange = (item: HistoryMeta) => {
    if (item.minYmd && item.maxYmd) {
      return item.minYmd === item.maxYmd ? item.minYmd : `${item.minYmd} ~ ${item.maxYmd}`;
    }
    return '无日期';
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    multiple: true,
    accept: {
      'text/csv': ['.csv'],
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
      'application/vnd.ms-excel': ['.xls'],
    },
  });

  const typedRows = useMemo<EnrichedTargetingRecord[]>(
    () => rows.map((item) => ({ ...item, targetingType: detectTargetingType(item.targeting) })),
    [rows]
  );

  const reportRange = useMemo(() => {
    const dates = typedRows.map((r) => r.date).filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d));
    if (!dates.length) return null;
    const minYmd = dates.reduce((acc, d) => (d < acc ? d : acc), dates[0]);
    const maxYmd = dates.reduce((acc, d) => (d > acc ? d : acc), dates[0]);
    const minDate = new Date(`${minYmd}T00:00:00.000Z`);
    const maxDate = new Date(`${maxYmd}T00:00:00.000Z`);
    const days = Math.max(1, Math.floor((maxDate.getTime() - minDate.getTime()) / 86400000) + 1);
    return { minYmd, maxYmd, days };
  }, [typedRows]);

  const campaignOptions = useMemo(() => {
    const values = Array.from(new Set(typedRows.map((r) => r.campaignName).filter(Boolean)));
    values.sort((a, b) => a.localeCompare(b, 'zh-Hans-CN'));
    return values;
  }, [typedRows]);

  const matchTypeOptions = useMemo(() => {
    const values = Array.from(new Set(typedRows.map((r) => r.matchType).filter(Boolean)));
    values.sort((a, b) => a.localeCompare(b, 'zh-Hans-CN'));
    return values;
  }, [typedRows]);

  const filteredRows = useMemo(() => {
    const q = query.trim().toLowerCase();
    const minClicksValue = Number(minClicks);
    const minSpendValue = Number(minSpend);
    const maxAcosValue = Number(maxAcos);
    return typedRows.filter((row) => {
      if (q) {
        const haystack = `${row.targeting} ${row.campaignName} ${row.adGroupName}`.toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      if (campaignFilter !== '全部' && row.campaignName !== campaignFilter) return false;
      if (matchTypeFilter !== '全部' && row.matchType !== matchTypeFilter) return false;
      if (targetingTypeFilter !== '全部' && row.targetingType !== targetingTypeFilter) return false;
      if (conversionFilter === '有订单' && row.orders <= 0) return false;
      if (conversionFilter === '无订单' && row.orders > 0) return false;
      if (Number.isFinite(minClicksValue) && minClicksValue > 0 && row.clicks < minClicksValue) return false;
      if (Number.isFinite(minSpendValue) && minSpendValue > 0 && row.spend < minSpendValue) return false;
      const acosForFilter = row.sales > 0 ? row.acos : row.spend > 0 ? Number.POSITIVE_INFINITY : 0;
      if (Number.isFinite(maxAcosValue) && maxAcosValue > 0 && acosForFilter > maxAcosValue) return false;
      return true;
    });
  }, [typedRows, query, campaignFilter, matchTypeFilter, targetingTypeFilter, conversionFilter, minClicks, minSpend, maxAcos]);

  const summary = useMemo(() => {
    const spend = filteredRows.reduce((acc, curr) => acc + curr.spend, 0);
    const sales = filteredRows.reduce((acc, curr) => acc + curr.sales, 0);
    const orders = filteredRows.reduce((acc, curr) => acc + curr.orders, 0);
    const clicks = filteredRows.reduce((acc, curr) => acc + curr.clicks, 0);
    const impressions = filteredRows.reduce((acc, curr) => acc + curr.impressions, 0);
    const acos = sales > 0 ? (spend / sales) * 100 : 0;
    const roas = spend > 0 ? sales / spend : 0;
    const ctr = impressions > 0 ? clicks / impressions : 0;
    const cpc = clicks > 0 ? spend / clicks : 0;
    const conversionRate = clicks > 0 ? orders / clicks : 0;
    return { spend, sales, orders, clicks, impressions, acos, roas, ctr, cpc, conversionRate };
  }, [filteredRows]);

  const sortedRows = useMemo(() => {
    const rowsCopy = [...filteredRows];
    rowsCopy.sort((a, b) => {
      const readValue = (row: EnrichedTargetingRecord) => {
        if (sortKey === 'targeting') return row.targeting.toLowerCase();
        if (sortKey === 'campaignName') return row.campaignName.toLowerCase();
        if (sortKey === 'matchType') return row.matchType.toLowerCase();
        if (sortKey === 'date') return row.date;
        return row[sortKey];
      };
      const av = readValue(a);
      const bv = readValue(b);
      if (typeof av === 'string' && typeof bv === 'string') {
        const cmp = av.localeCompare(bv, 'zh-Hans-CN');
        return sortDirection === 'asc' ? cmp : -cmp;
      }
      const na = typeof av === 'number' ? av : 0;
      const nb = typeof bv === 'number' ? bv : 0;
      if (na === nb) return b.spend - a.spend;
      return sortDirection === 'asc' ? na - nb : nb - na;
    });
    return rowsCopy;
  }, [filteredRows, sortKey, sortDirection]);

  const tableRows = useMemo(() => {
    const n = Number(tableLimit);
    if (!Number.isFinite(n) || n <= 0) return sortedRows;
    return sortedRows.slice(0, n);
  }, [sortedRows, tableLimit]);

  const targetingTypeSummary = useMemo(() => {
    const map = new Map<TargetingType, { count: number; spend: number; sales: number; orders: number; clicks: number; impressions: number }>();
    for (const row of filteredRows) {
      const hit = map.get(row.targetingType) ?? { count: 0, spend: 0, sales: 0, orders: 0, clicks: 0, impressions: 0 };
      hit.count += 1;
      hit.spend += row.spend;
      hit.sales += row.sales;
      hit.orders += row.orders;
      hit.clicks += row.clicks;
      hit.impressions += row.impressions;
      map.set(row.targetingType, hit);
    }
    return (['关键词', 'ASIN', '其他'] as const).map((type) => {
      const hit = map.get(type) ?? { count: 0, spend: 0, sales: 0, orders: 0, clicks: 0, impressions: 0 };
      const acos = hit.sales > 0 ? (hit.spend / hit.sales) * 100 : 0;
      const roas = hit.spend > 0 ? hit.sales / hit.spend : 0;
      const ctr = hit.impressions > 0 ? hit.clicks / hit.impressions : 0;
      const conversionRate = hit.clicks > 0 ? hit.orders / hit.clicks : 0;
      return { type, ...hit, acos, roas, ctr, conversionRate };
    });
  }, [filteredRows]);

  const matchTypeSummary = useMemo(() => {
    const map = new Map<string, { count: number; spend: number; sales: number; orders: number; clicks: number }>();
    for (const row of filteredRows) {
      const key = row.matchType || '-';
      const hit = map.get(key) ?? { count: 0, spend: 0, sales: 0, orders: 0, clicks: 0 };
      hit.count += 1;
      hit.spend += row.spend;
      hit.sales += row.sales;
      hit.orders += row.orders;
      hit.clicks += row.clicks;
      map.set(key, hit);
    }
    return Array.from(map.entries())
      .map(([matchType, value]) => {
        const acos = value.sales > 0 ? (value.spend / value.sales) * 100 : 0;
        const roas = value.spend > 0 ? value.sales / value.spend : 0;
        const conversionRate = value.clicks > 0 ? value.orders / value.clicks : 0;
        return { matchType, ...value, acos, roas, conversionRate };
      })
      .sort((a, b) => b.spend - a.spend);
  }, [filteredRows]);

  const avgConversionRate = summary.conversionRate;
  const highOrderValue = Math.max(1, Number(highOrderThreshold) || 2);
  const highEffClickValue = Math.max(1, Number(highEffClickThreshold) || 8);
  const targetAcosValue = Math.max(1, Number(targetAcos) || 30);
  const wasteClickValue = Math.max(1, Number(wasteClickThreshold) || 10);
  const wasteSpendValue = Math.max(0, Number(wasteSpendThreshold) || 20);
  const highAcosFactorValue = Math.max(1.1, Number(highAcosFactor) || 2);
  const highAcosClickValue = Math.max(1, Number(highAcosClickThreshold) || 8);
  const matchTypeDisplayLimit = Number.MAX_SAFE_INTEGER;
  const shareMetricLabel = shareMetric === 'sales' ? `销售额(${currency})` : shareMetric === 'orders' ? '订单数' : `花费(${currency})`;
  const formatShareMetricValue = (value: number) => {
    if (shareMetric === 'orders') return Number(value).toLocaleString();
    return formatMoney(Number(value), currency);
  };

  const targetingShareData = useMemo(() => {
    const readMetric = (item: { spend: number; sales: number; orders: number }) => {
      if (shareMetric === 'sales') return item.sales;
      if (shareMetric === 'orders') return item.orders;
      return item.spend;
    };
    const totalMetric = targetingTypeSummary.reduce((acc, item) => acc + readMetric(item), 0);
    return targetingTypeSummary
      .filter((item) => item.count > 0)
      .map((item) => ({
        name: item.type,
        spend: item.spend,
        sales: item.sales,
        orders: item.orders,
        metric: readMetric(item),
        share: totalMetric > 0 ? readMetric(item) / totalMetric : 0,
      }));
  }, [targetingTypeSummary, shareMetric]);

  const matchShareData = useMemo(() => {
    const readMetric = (item: { spend: number; sales: number; orders: number }) => {
      if (shareMetric === 'sales') return item.sales;
      if (shareMetric === 'orders') return item.orders;
      return item.spend;
    };
    const totalMetric = matchTypeSummary.reduce((acc, item) => acc + readMetric(item), 0);
    return matchTypeSummary
      .filter((item) => item.count > 0)
      .slice(0, matchTypeDisplayLimit)
      .map((item) => ({
        name: item.matchType,
        spend: item.spend,
        sales: item.sales,
        orders: item.orders,
        metric: readMetric(item),
        share: totalMetric > 0 ? readMetric(item) / totalMetric : 0,
        acos: item.acos,
      }));
  }, [matchTypeSummary, shareMetric, matchTypeDisplayLimit]);

  const targetingPerformanceData = useMemo(
    () =>
      targetingTypeSummary
        .filter((item) => item.count > 0)
        .map((item) => ({
          name: item.type,
          spend: Number(item.spend.toFixed(2)),
          sales: Number(item.sales.toFixed(2)),
          acos: Number(item.acos.toFixed(2)),
          cvr: Number((item.conversionRate * 100).toFixed(2)),
        })),
    [targetingTypeSummary]
  );

  const matchPerformanceData = useMemo(
    () =>
      matchTypeSummary.slice(0, matchTypeDisplayLimit).map((item) => ({
        name: item.matchType,
        spend: Number(item.spend.toFixed(2)),
        sales: Number(item.sales.toFixed(2)),
        acos: Number(item.acos.toFixed(2)),
        cvr: Number((item.conversionRate * 100).toFixed(2)),
      })),
    [matchTypeSummary, matchTypeDisplayLimit]
  );

  const highPerformRows = useMemo(
    () =>
      [...filteredRows]
        .filter(
          (row) =>
            row.clicks >= highEffClickValue &&
            row.orders >= highOrderValue &&
            row.sales > 0 &&
            row.acos > 0 &&
            row.acos <= targetAcosValue &&
            row.conversionRate >= avgConversionRate
        )
        .sort((a, b) => b.orders - a.orders || b.sales - a.sales)
        .slice(0, 20),
    [filteredRows, highEffClickValue, highOrderValue, targetAcosValue, avgConversionRate]
  );

  const wasteRows = useMemo(
    () =>
      [...filteredRows]
        .filter((row) => row.orders <= 0 && row.clicks >= wasteClickValue && row.spend >= wasteSpendValue)
        .sort((a, b) => b.spend - a.spend)
        .slice(0, 20),
    [filteredRows, wasteClickValue, wasteSpendValue]
  );

  const highAcosRows = useMemo(
    () =>
      [...filteredRows]
        .filter((row) => row.clicks >= highAcosClickValue && row.spend > 0 && row.sales > 0 && row.acos >= targetAcosValue * highAcosFactorValue)
        .sort((a, b) => b.acos - a.acos)
        .slice(0, 20),
    [filteredRows, highAcosClickValue, targetAcosValue, highAcosFactorValue]
  );

  const observeRows = useMemo(
    () =>
      [...filteredRows]
        .filter((row) => row.orders <= 0 && row.clicks > 0 && row.clicks < wasteClickValue)
        .sort((a, b) => b.clicks - a.clicks || b.spend - a.spend)
        .slice(0, 20),
    [filteredRows, wasteClickValue]
  );

  const toggleSort = (nextKey: SortKey) => {
    if (sortKey === nextKey) {
      setSortDirection((prev) => (prev === 'desc' ? 'asc' : 'desc'));
      return;
    }
    setSortKey(nextKey);
    setSortDirection('desc');
  };

  const exportDecisionSheets = () => {
    if (!highPerformRows.length && !wasteRows.length && !highAcosRows.length && !observeRows.length) {
      toast.error('没有可导出的决策清单数据');
      return;
    }
    const toAcosExport = (item: EnrichedTargetingRecord) =>
      item.sales > 0 ? Number(item.acos.toFixed(2)) : item.spend > 0 ? '∞' : Number((0).toFixed(2));
    const safeName = fileLabel ? fileLabel.replace(/\.[^.]+$/, '') : '投放报表';
    const wb = XLSX.utils.book_new();

    const actionByType = (targetingType: TargetingType, action: '加投' | '否定' | '降价' | '观察') => {
      if (action === '加投') {
        if (targetingType === '关键词') return '提高关键词竞价 10%-15%，并单独建精准组';
        if (targetingType === 'ASIN') return '提高商品投放竞价 10%-15%，扩展相近ASIN';
        return '小幅提价 5%-10%，持续观察转化稳定性';
      }
      if (action === '否定') {
        if (targetingType === '关键词') return '先做精准否定，再视情况扩展词组否定';
        if (targetingType === 'ASIN') return '添加为否定ASIN或下调对应分组预算';
        return '暂停该投放位并检查相关性';
      }
      if (action === '降价') {
        if (targetingType === '关键词') return '降竞价 10%-20%，并收敛匹配';
        if (targetingType === 'ASIN') return '降商品投放竞价 10%-20%，保留高转化ASIN';
        return '降价 10%-15%，同步复核Listing承接';
      }
      return '样本不足，继续观察至达到无单点击阈值再决策';
    };

    const harvestRows = highPerformRows.map((row) => ({
      投放: row.targeting,
      投放类型: row.targetingType,
      匹配类型: row.matchType,
      广告活动: row.campaignName,
      广告组: row.adGroupName,
      点击: row.clicks,
      订单: row.orders,
      [`花费(${currency})`]: Number(row.spend.toFixed(2)),
      [`销售额(${currency})`]: Number(row.sales.toFixed(2)),
      ACOS百分比: toAcosExport(row),
      ROAS: Number(row.roas.toFixed(4)),
      转化率百分比: Number((row.conversionRate * 100).toFixed(2)),
      执行动作: actionByType(row.targetingType, '加投'),
      优先级: row.orders >= highOrderValue + 2 ? '高' : '中',
    }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(harvestRows), '加投清单');

    const negativeRows = wasteRows.map((row) => ({
      投放: row.targeting,
      投放类型: row.targetingType,
      匹配类型: row.matchType,
      广告活动: row.campaignName,
      广告组: row.adGroupName,
      点击: row.clicks,
      订单: row.orders,
      [`花费(${currency})`]: Number(row.spend.toFixed(2)),
      [`销售额(${currency})`]: Number(row.sales.toFixed(2)),
      ACOS百分比: toAcosExport(row),
      执行动作: actionByType(row.targetingType, '否定'),
      优先级: row.spend >= wasteSpendValue * 2 ? '高' : '中',
    }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(negativeRows), '否定清单');

    const bidDownRows = highAcosRows.map((row) => ({
      投放: row.targeting,
      投放类型: row.targetingType,
      匹配类型: row.matchType,
      广告活动: row.campaignName,
      广告组: row.adGroupName,
      点击: row.clicks,
      订单: row.orders,
      [`花费(${currency})`]: Number(row.spend.toFixed(2)),
      [`销售额(${currency})`]: Number(row.sales.toFixed(2)),
      ACOS百分比: toAcosExport(row),
      ROAS: Number(row.roas.toFixed(4)),
      执行动作: actionByType(row.targetingType, '降价'),
      优先级: row.acos >= targetAcosValue * (highAcosFactorValue + 0.6) ? '高' : '中',
    }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(bidDownRows), '降价清单');

    const observeSheetRows = observeRows.map((row) => ({
      投放: row.targeting,
      投放类型: row.targetingType,
      匹配类型: row.matchType,
      广告活动: row.campaignName,
      广告组: row.adGroupName,
      点击: row.clicks,
      [`花费(${currency})`]: Number(row.spend.toFixed(2)),
      执行动作: actionByType(row.targetingType, '观察'),
      备注: `当前无单且点击小于${wasteClickValue}，暂不建议立即否定`,
    }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(observeSheetRows), '观察池');

    XLSX.writeFile(wb, `${safeName}-投放决策清单.xlsx`);
    toast.success('已导出投放决策清单');
  };

  const renderAcosBadge = (row: EnrichedTargetingRecord) => {
    const acosForColor = row.sales > 0 ? row.acos : row.spend > 0 ? Number.POSITIVE_INFINITY : 0;
    const acosText = row.sales > 0 ? `${row.acos.toFixed(2)}%` : row.spend > 0 ? '∞' : '0.00%';
    return (
      <Badge
        variant="outline"
        className={cn(
          'w-16 justify-center',
          acosForColor > targetAcosValue
            ? 'border-destructive text-destructive bg-destructive/10'
            : 'border-emerald-600 text-emerald-600 bg-emerald-50'
        )}
      >
        {acosText}
      </Badge>
    );
  };

  const SortHeader = ({ label, value }: { label: string; value: SortKey }) => (
    <button type="button" className="inline-flex items-center gap-1 font-medium" onClick={() => toggleSort(value)}>
      <span>{label}</span>
      {sortKey === value ? (
        sortDirection === 'desc' ? (
          <ArrowDown className="h-3.5 w-3.5" />
        ) : (
          <ArrowUp className="h-3.5 w-3.5" />
        )
      ) : (
        <ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground" />
      )}
    </button>
  );

  if (!rows.length) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
        <div className="w-full max-w-4xl text-center space-y-6 animate-in fade-in zoom-in duration-500">
          <div className="space-y-2">
            <h1 className="text-4xl font-extrabold tracking-tight lg:text-5xl bg-clip-text text-transparent bg-gradient-to-r from-primary to-slate-800">
              投放报表分析
            </h1>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
              聚焦关键词/ASIN 投放位的加投、否定与降价决策，支持多维筛选与导出执行清单。
            </p>
          </div>

          <Card
            {...getRootProps()}
            className={cn(
              'relative flex min-h-[260px] cursor-pointer flex-col items-center justify-center gap-3 border-2 border-dashed transition-all',
              isDragActive ? 'border-primary bg-primary/5 scale-[1.01]' : 'hover:border-primary/40',
              isLoading && 'pointer-events-none opacity-60'
            )}
          >
            <input {...getInputProps()} />
            <div className="rounded-full bg-secondary p-3">
              {isLoading ? <Loader2 className="h-6 w-6 animate-spin text-primary" /> : <Upload className="h-6 w-6 text-primary" />}
            </div>
            <div className="text-center space-y-1">
              <div className="text-lg font-medium">{isLoading ? '解析中…' : '上传投放报表'}</div>
              <div className="text-sm text-muted-foreground">支持 .csv / .xlsx / .xls，可批量上传</div>
            </div>
            <div className="absolute bottom-4 flex items-center gap-2 text-xs text-muted-foreground">
              <FileSpreadsheet className="h-3.5 w-3.5" />
              <span>支持 Amazon 商品推广投放报表</span>
            </div>
          </Card>

          <div className="rounded-lg border bg-card p-4 space-y-3 text-left">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Switch checked={mergeEnabled} onCheckedChange={setMergeEnabled} />
                <span className="text-sm">自动累计并去重重叠日期</span>
              </div>
              <div className="text-xs text-muted-foreground">当前：{fileLabel || '未加载报告'}</div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="text-xs text-muted-foreground">合并到历史记录</div>
              <Select value={mergeTargetId ?? 'none'} onValueChange={(value) => setMergeTargetId(value === 'none' ? null : value)}>
                <SelectTrigger className="w-[280px]" disabled={!historyItems.length}>
                  <SelectValue placeholder={historyItems.length ? '选择历史记录' : '暂无历史记录'} />
                </SelectTrigger>
                <SelectContent align="start">
                  <SelectItem value="none">不合并历史记录</SelectItem>
                  {historyItems.map((item) => (
                    <SelectItem key={item.id} value={item.id}>
                      <span className="block max-w-[240px] truncate" title={item.fileNames.join('、')}>{item.fileNames.join('、')}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="text-xs text-muted-foreground">历史记录自动保存到浏览器本地</div>
          </div>

          <div className="rounded-lg border bg-card p-4 space-y-3 text-left">
            <div className="flex items-center justify-between">
              <div className="text-sm font-medium">历史记录</div>
              <Button type="button" size="sm" variant="outline" onClick={clearHistory} disabled={!historyItems.length}>
                清空
              </Button>
            </div>
            {!historyItems.length ? (
              <div className="text-sm text-muted-foreground">暂无历史记录</div>
            ) : (
              <ScrollArea className="max-h-[240px]">
                <div className="space-y-2 pr-2">
                  {historyItems.map((item) => {
                    const isSelected = mergeTargetId === item.id;
                    return (
                      <div key={item.id} className="flex items-start justify-between gap-3 rounded-md border p-3">
                        <div className="min-w-0 flex-1 space-y-1">
                          <div className="text-sm font-medium whitespace-normal break-words pr-2">{item.fileNames.join('、')}</div>
                          <div className="text-xs text-muted-foreground">
                            {renderRange(item)} • {item.total.toLocaleString()} 条 • {new Date(item.createdAt).toLocaleString('zh-CN')}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <Button type="button" size="sm" variant={isSelected ? 'secondary' : 'outline'} onClick={() => setMergeTargetId(isSelected ? null : item.id)}>
                            {isSelected ? '已选合并' : '合并'}
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="secondary"
                            onClick={async () => {
                              const records = await historyStore.loadRecords<TargetingRecord>(item.id);
                              if (!records?.length) {
                                toast.error('历史记录已损坏或被清理');
                                return;
                              }
                              setRows(records);
                              setFileLabel(item.fileNames.join('、'));
                              if (item.currency) setCurrency(item.currency);
                              toast.success(`已加载历史记录，共 ${item.total} 条`);
                            }}
                          >
                            加载
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            onClick={async () => {
                              if (!window.confirm('确认删除这条历史记录吗？此操作不可恢复。')) return;
                              await historyStore.deleteRecord(item.id);
                              const next = historyItemsRef.current.filter((h) => h.id !== item.id);
                              historyItemsRef.current = next;
                              setHistoryItems(next);
                              await historyStore.persistMeta(next);
                              if (mergeTargetId === item.id) setMergeTargetId(null);
                              toast.success('已删除历史记录');
                            }}
                          >
                            删除
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </ScrollArea>
            )}
          </div>

          <div className="flex justify-center">
            <Link href="/">
              <Button variant="outline" className="gap-2">
                <ArrowLeft className="h-4 w-4" />
                返回类型选择
              </Button>
            </Link>
          </div>
          <footer className="pt-1 pb-2 text-center text-xs text-muted-foreground">
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
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <main className="mx-auto w-full max-w-7xl p-6 md:p-10 space-y-6">
        <div className="flex items-center justify-between gap-3">
          <div className="space-y-1">
            <h1 className="text-2xl font-semibold tracking-tight">投放报表分析</h1>
            <p className="text-sm text-muted-foreground">适用“商品推广 投放 报告”，按投放词/ASIN 统计表现。</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" className="gap-2" onClick={resetAll}>
              重置数据与设置
            </Button>
            <Link href="/">
              <Button variant="outline" className="gap-2">
                <ArrowLeft className="h-4 w-4" />
                返回类型选择
              </Button>
            </Link>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <Badge variant="outline">记录数：{typedRows.length.toLocaleString()}</Badge>
          <Badge variant="outline">筛选后：{filteredRows.length.toLocaleString()}</Badge>
          {reportRange ? (
            <Badge variant="outline">
              报告时间：{reportRange.minYmd} ~ {reportRange.maxYmd}（{reportRange.days} 天）
            </Badge>
          ) : null}
          {fileLabel ? <Badge variant="outline">文件：{fileLabel}</Badge> : null}
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Card><CardContent className="pt-6"><div className="text-xs text-muted-foreground">花费</div><div className="text-xl font-semibold">{formatMoney(summary.spend, currency)}</div></CardContent></Card>
          <Card><CardContent className="pt-6"><div className="text-xs text-muted-foreground">销售额</div><div className="text-xl font-semibold">{formatMoney(summary.sales, currency)}</div></CardContent></Card>
          <Card><CardContent className="pt-6"><div className="text-xs text-muted-foreground">订单</div><div className="text-xl font-semibold">{summary.orders.toLocaleString()}</div></CardContent></Card>
          <Card><CardContent className="pt-6"><div className="text-xs text-muted-foreground">ACOS / ROAS</div><div className="text-xl font-semibold">{summary.acos.toFixed(2)}% / {summary.roas.toFixed(2)}</div></CardContent></Card>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Card><CardContent className="pt-6"><div className="text-xs text-muted-foreground">CTR</div><div className="text-xl font-semibold">{formatPct(summary.ctr)}</div></CardContent></Card>
          <Card><CardContent className="pt-6"><div className="text-xs text-muted-foreground">CPC</div><div className="text-xl font-semibold">{formatMoney(summary.cpc, currency)}</div></CardContent></Card>
          <Card><CardContent className="pt-6"><div className="text-xs text-muted-foreground">转化率</div><div className="text-xl font-semibold">{formatPct(summary.conversionRate)}</div></CardContent></Card>
          <Card>
            <CardContent className="pt-6 space-y-2">
              <div className="text-xs text-muted-foreground">目标 ACOS(%)</div>
              <Input type="number" min={1} step="0.1" value={targetAcos} onChange={(e) => setTargetAcos(e.target.value)} />
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>投放明细（支持字段排序）</CardTitle>
            <CardDescription>按筛选结果展示，点击表头可切换排序方向</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4 mb-4">
              <div className="space-y-1">
                <div className="text-xs text-muted-foreground">搜索关键词/ASIN/活动</div>
                <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="输入任意关键字" />
              </div>
              <div className="space-y-1">
                <div className="text-xs text-muted-foreground">广告活动</div>
                <Select value={campaignFilter} onValueChange={setCampaignFilter}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="全部">全部</SelectItem>
                    {campaignOptions.map((name) => (
                      <SelectItem key={name} value={name}>{name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <div className="text-xs text-muted-foreground">匹配类型</div>
                <Select value={matchTypeFilter} onValueChange={setMatchTypeFilter}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="全部">全部</SelectItem>
                    {matchTypeOptions.map((name) => (
                      <SelectItem key={name} value={name}>{name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <div className="text-xs text-muted-foreground">投放类型</div>
                <Select
                  value={targetingTypeFilter}
                  onValueChange={(value) => setTargetingTypeFilter(value as '全部' | TargetingType)}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="全部">全部</SelectItem>
                    <SelectItem value="关键词">关键词</SelectItem>
                    <SelectItem value="ASIN">ASIN</SelectItem>
                    <SelectItem value="其他">其他</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-5 mb-4">
              <div className="space-y-1">
                <div className="text-xs text-muted-foreground">订单状态</div>
                <Select value={conversionFilter} onValueChange={(value) => setConversionFilter(value as ConversionFilter)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="全部">全部</SelectItem>
                    <SelectItem value="有订单">有订单</SelectItem>
                    <SelectItem value="无订单">无订单</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <div className="text-xs text-muted-foreground">最小点击</div>
                <Input type="number" min={0} value={minClicks} onChange={(e) => setMinClicks(e.target.value)} />
              </div>
              <div className="space-y-1">
                <div className="text-xs text-muted-foreground">最小花费</div>
                <Input type="number" min={0} step="0.01" value={minSpend} onChange={(e) => setMinSpend(e.target.value)} />
              </div>
              <div className="space-y-1">
                <div className="text-xs text-muted-foreground">最大 ACOS(%)</div>
                <Input type="number" min={0} step="0.1" value={maxAcos} onChange={(e) => setMaxAcos(e.target.value)} />
              </div>
              <div className="space-y-1">
                <div className="text-xs text-muted-foreground">显示条数上限</div>
                <Input type="number" min={1} value={tableLimit} onChange={(e) => setTableLimit(e.target.value)} />
                <div className="text-[11px] text-muted-foreground">筛选并排序后，最多显示多少条明细</div>
              </div>
            </div>

            <div className="flex flex-wrap gap-2 mb-4">
              <Button variant="outline" onClick={resetFilters}>重置筛选</Button>
            </div>

            {tableRows.length ? (
              <div className="overflow-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead><button type="button" className="inline-flex items-center gap-1 font-medium" onClick={() => toggleSort('targeting')}><span>投放</span>{sortKey === 'targeting' ? (sortDirection === 'desc' ? <ArrowDown className="h-3.5 w-3.5" /> : <ArrowUp className="h-3.5 w-3.5" />) : <ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground" />}</button></TableHead>
                      <TableHead><SortHeader label="类型" value="matchType" /></TableHead>
                      <TableHead><SortHeader label="活动" value="campaignName" /></TableHead>
                      <TableHead className="text-right"><SortHeader label="展示" value="impressions" /></TableHead>
                      <TableHead className="text-right"><SortHeader label="点击" value="clicks" /></TableHead>
                      <TableHead className="text-right"><SortHeader label="花费" value="spend" /></TableHead>
                      <TableHead className="text-right"><SortHeader label="销售额" value="sales" /></TableHead>
                      <TableHead className="text-right"><SortHeader label="订单" value="orders" /></TableHead>
                      <TableHead className="text-right"><SortHeader label="CTR" value="ctr" /></TableHead>
                      <TableHead className="text-right"><SortHeader label="CPC" value="cpc" /></TableHead>
                      <TableHead className="text-right"><SortHeader label="ACOS" value="acos" /></TableHead>
                      <TableHead className="text-right"><SortHeader label="ROAS" value="roas" /></TableHead>
                      <TableHead className="text-right"><SortHeader label="CVR" value="conversionRate" /></TableHead>
                      <TableHead><SortHeader label="日期" value="date" /></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {tableRows.map((row) => (
                      <TableRow key={row.id}>
                        <TableCell className="max-w-[320px] truncate" title={row.targeting}>{row.targeting}</TableCell>
                        <TableCell>{row.targetingType} / {row.matchType}</TableCell>
                        <TableCell className="max-w-[300px] truncate" title={row.campaignName}>{row.campaignName}</TableCell>
                        <TableCell className="text-right">{row.impressions.toLocaleString()}</TableCell>
                        <TableCell className="text-right">{row.clicks.toLocaleString()}</TableCell>
                        <TableCell className="text-right">{formatMoney(row.spend, currency)}</TableCell>
                        <TableCell className="text-right">{formatMoney(row.sales, currency)}</TableCell>
                        <TableCell className="text-right">{row.orders.toLocaleString()}</TableCell>
                        <TableCell className="text-right">{formatPct(row.ctr)}</TableCell>
                        <TableCell className="text-right">{formatMoney(row.cpc, currency)}</TableCell>
                        <TableCell className="text-right">{renderAcosBadge(row)}</TableCell>
                        <TableCell className="text-right">{row.roas.toFixed(2)}</TableCell>
                        <TableCell className="text-right">{formatPct(row.conversionRate)}</TableCell>
                        <TableCell>{row.date || '-'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <div className="text-sm text-muted-foreground">暂无满足筛选条件的数据，请调整条件</div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>投放与匹配类型占比及整体表现</CardTitle>
            <CardDescription>看清类型结构与整体表现，支持占比指标切换</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
              <div className="space-y-1">
                <div className="text-xs text-muted-foreground">占比指标</div>
                <Select value={shareMetric} onValueChange={(value) => setShareMetric(value as ShareMetric)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="spend">花费占比</SelectItem>
                    <SelectItem value="sales">销售占比</SelectItem>
                    <SelectItem value="orders">订单占比</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Card><CardContent className="pt-6"><div className="text-xs text-muted-foreground">占比口径</div><div className="text-xl font-semibold">{shareMetricLabel}</div></CardContent></Card>
              <Card><CardContent className="pt-6"><div className="text-xs text-muted-foreground">匹配类型数</div><div className="text-xl font-semibold">{matchShareData.length.toLocaleString()}</div></CardContent></Card>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Card><CardContent className="pt-6"><div className="text-xs text-muted-foreground">整体花费</div><div className="text-xl font-semibold">{formatMoney(summary.spend, currency)}</div></CardContent></Card>
              <Card><CardContent className="pt-6"><div className="text-xs text-muted-foreground">整体销售</div><div className="text-xl font-semibold">{formatMoney(summary.sales, currency)}</div></CardContent></Card>
              <Card><CardContent className="pt-6"><div className="text-xs text-muted-foreground">整体 ACOS</div><div className="text-xl font-semibold">{summary.acos.toFixed(2)}%</div></CardContent></Card>
              <Card><CardContent className="pt-6"><div className="text-xs text-muted-foreground">整体 CVR</div><div className="text-xl font-semibold">{formatPct(summary.conversionRate)}</div></CardContent></Card>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">投放类型占比</CardTitle>
                  <CardDescription>按关键词 / ASIN / 其他维度看结构分配</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="h-[320px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart margin={{ top: 20, right: 24, left: 24, bottom: 20 }}>
                        <Pie
                          data={targetingShareData}
                          dataKey="metric"
                          nameKey="name"
                          outerRadius={88}
                          label={renderPiePercentLabel}
                          labelLine={false}
                        >
                          {targetingShareData.map((_, idx) => (
                            <Cell key={`targeting-share-${idx}`} fill={CHART_COLORS[idx % CHART_COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(value: number) => formatShareMetricValue(Number(value))} />
                        <Legend />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">匹配类型占比</CardTitle>
                  <CardDescription>识别预算集中在哪些匹配策略</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="h-[320px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart margin={{ top: 20, right: 24, left: 24, bottom: 20 }}>
                        <Pie
                          data={matchShareData}
                          dataKey="metric"
                          nameKey="name"
                          outerRadius={88}
                          label={renderPiePercentLabel}
                          labelLine={false}
                        >
                          {matchShareData.map((_, idx) => (
                            <Cell key={`match-share-${idx}`} fill={CHART_COLORS[idx % CHART_COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(value: number) => formatShareMetricValue(Number(value))} />
                        <Legend />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">投放类型表现对比</CardTitle>
                  <CardDescription>比较不同投放类型的花费、销售与 ACOS</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="h-[280px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={targetingPerformanceData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="name" />
                        <YAxis yAxisId="money" />
                        <YAxis yAxisId="ratio" orientation="right" />
                        <Tooltip />
                        <Legend />
                        <Bar yAxisId="money" dataKey="spend" name={`花费(${currency})`} fill="#4f46e5" />
                        <Bar yAxisId="money" dataKey="sales" name={`销售(${currency})`} fill="#10b981" />
                        <Bar yAxisId="ratio" dataKey="acos" name="ACOS(%)" fill="#ef4444" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">匹配类型表现对比</CardTitle>
                  <CardDescription>比较匹配类型的花费、销售、ACOS 与 CVR</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="h-[280px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={matchPerformanceData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="name" />
                        <YAxis yAxisId="money" />
                        <YAxis yAxisId="ratio" orientation="right" />
                        <Tooltip />
                        <Legend />
                        <Bar yAxisId="money" dataKey="spend" name={`花费(${currency})`} fill="#6366f1" />
                        <Bar yAxisId="money" dataKey="sales" name={`销售(${currency})`} fill="#06b6d4" />
                        <Bar yAxisId="ratio" dataKey="acos" name="ACOS(%)" fill="#f97316" />
                        <Bar yAxisId="ratio" dataKey="cvr" name="CVR(%)" fill="#22c55e" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="grid gap-3 md:grid-cols-3">
              {targetingTypeSummary.map((item) => (
                <Card key={item.type}>
                  <CardContent className="pt-6 space-y-1">
                    <div className="text-sm font-medium">{item.type}</div>
                    <div className="text-xs text-muted-foreground">
                      {item.count.toLocaleString()} 条 | 订单 {item.orders.toLocaleString()}
                    </div>
                    <div className="text-sm">
                      花费 {formatMoney(item.spend, currency)} / 销售 {formatMoney(item.sales, currency)}
                    </div>
                    <div className="text-xs text-muted-foreground">ACOS {item.acos.toFixed(2)}% · ROAS {item.roas.toFixed(2)} · CVR {formatPct(item.conversionRate)}</div>
                  </CardContent>
                </Card>
              ))}
            </div>
            <div className="grid gap-2 text-xs text-muted-foreground">
              {targetingShareData.map((item) => (
                <div key={`type-share-${item.name}`} className="flex items-center justify-between rounded-md border px-3 py-2">
                  <span>{item.name}</span>
                  <span>{formatShareMetricValue(item.metric)} · {(item.share * 100).toFixed(1)}%</span>
                </div>
              ))}
            </div>
            <div className="overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>匹配类型</TableHead>
                    <TableHead className="text-right">条数</TableHead>
                    <TableHead className="text-right">点击</TableHead>
                    <TableHead className="text-right">订单</TableHead>
                    <TableHead className="text-right">花费</TableHead>
                    <TableHead className="text-right">销售</TableHead>
                    <TableHead className="text-right">ACOS</TableHead>
                    <TableHead className="text-right">CVR</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {matchTypeSummary.map((row) => (
                    <TableRow key={row.matchType}>
                      <TableCell>{row.matchType}</TableCell>
                      <TableCell className="text-right">{row.count.toLocaleString()}</TableCell>
                      <TableCell className="text-right">{row.clicks.toLocaleString()}</TableCell>
                      <TableCell className="text-right">{row.orders.toLocaleString()}</TableCell>
                      <TableCell className="text-right">{formatMoney(row.spend, currency)}</TableCell>
                      <TableCell className="text-right">{formatMoney(row.sales, currency)}</TableCell>
                      <TableCell className="text-right">{row.acos.toFixed(2)}%</TableCell>
                      <TableCell className="text-right">{formatPct(row.conversionRate)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <span>运营决策清单</span>
              <UiTooltip>
                <UiTooltipTrigger asChild>
                  <button type="button" className="inline-flex h-5 w-5 items-center justify-center text-muted-foreground hover:text-foreground">
                    <CircleHelp className="h-4 w-4" />
                  </button>
                </UiTooltipTrigger>
                <UiTooltipContent side="top" align="start" className="max-w-[420px] text-xs leading-5">
                  <div>规则由四项阈值共同决定：目标ACOS、高效最小订单/点击、无单最小点击/花费、高ACOS倍数。</div>
                  <div>建议先选择产品阶段（新品/成熟），再微调阈值，避免不同阶段用同一套规则。</div>
                  <div>无单但未达点击阈值的目标会进入观察池，不立即执行否定。</div>
                </UiTooltipContent>
              </UiTooltip>
            </CardTitle>
            <CardDescription>高效加投、无单否定、高 ACOS 降价 + 观察池，输出更适合执行</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <Button className="gap-2" onClick={exportDecisionSheets}>
                <Download className="h-4 w-4" />
                一键导出 Excel（加投/否定/降价/观察）
              </Button>
              <div className="text-xs text-muted-foreground">导出当前筛选结果下的加投/否定/降价/观察清单</div>
            </div>
            <div className="grid gap-3 md:grid-cols-3 lg:grid-cols-7">
              <div className="space-y-1">
                <div className="text-xs text-muted-foreground">产品阶段</div>
                <Select value={productStage} onValueChange={(value) => setProductStage(value as ProductStage)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="新品">新品</SelectItem>
                    <SelectItem value="成熟">成熟</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <div className="text-xs text-muted-foreground">高效投放最小订单</div>
                <Input type="number" min={1} value={highOrderThreshold} onChange={(e) => setHighOrderThreshold(e.target.value)} />
              </div>
              <div className="space-y-1">
                <div className="text-xs text-muted-foreground">高效投放最小点击</div>
                <Input type="number" min={1} value={highEffClickThreshold} onChange={(e) => setHighEffClickThreshold(e.target.value)} />
              </div>
              <div className="space-y-1">
                <div className="text-xs text-muted-foreground">无单最小点击</div>
                <Input type="number" min={1} value={wasteClickThreshold} onChange={(e) => setWasteClickThreshold(e.target.value)} />
              </div>
              <div className="space-y-1">
                <div className="text-xs text-muted-foreground">无单最小花费</div>
                <Input type="number" min={0} step="0.1" value={wasteSpendThreshold} onChange={(e) => setWasteSpendThreshold(e.target.value)} />
              </div>
              <div className="space-y-1">
                <div className="text-xs text-muted-foreground">目标 ACOS(%)</div>
                <Input type="number" min={1} step="0.1" value={targetAcos} onChange={(e) => setTargetAcos(e.target.value)} />
              </div>
              <div className="space-y-1">
                <div className="text-xs text-muted-foreground">高 ACOS 倍数</div>
                <Input type="number" min={1.1} step="0.1" value={highAcosFactor} onChange={(e) => setHighAcosFactor(e.target.value)} />
              </div>
              <div className="space-y-1">
                <div className="text-xs text-muted-foreground">高 ACOS 最小点击</div>
                <Input type="number" min={1} value={highAcosClickThreshold} onChange={(e) => setHighAcosClickThreshold(e.target.value)} />
              </div>
            </div>

            <div className="grid gap-2 text-xs text-muted-foreground md:grid-cols-4">
              <div className="rounded-md border px-3 py-2">加投清单：{highPerformRows.length.toLocaleString()} 条</div>
              <div className="rounded-md border px-3 py-2">否定清单：{wasteRows.length.toLocaleString()} 条</div>
              <div className="rounded-md border px-3 py-2">降价清单：{highAcosRows.length.toLocaleString()} 条</div>
              <div className="rounded-md border px-3 py-2">观察池：{observeRows.length.toLocaleString()} 条</div>
            </div>

            <div className="grid gap-3 lg:grid-cols-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">高效投放（建议加投）</CardTitle>
                  <CardDescription>点击达标 + 订单达标 + ACOS ≤ 目标 + CVR ≥ 均值</CardDescription>
                </CardHeader>
                <CardContent className="space-y-2">
                  {highPerformRows.length ? highPerformRows.map((row) => (
                    <div key={row.id} className="rounded-md border p-2 text-xs space-y-1">
                      <div className="font-medium truncate" title={row.targeting}>{row.targeting}</div>
                      <div className="text-muted-foreground truncate" title={row.campaignName}>{row.campaignName}</div>
                      <div>订单 {row.orders} · ACOS {row.acos.toFixed(2)}% · CVR {formatPct(row.conversionRate)}</div>
                    </div>
                  )) : <div className="text-sm text-muted-foreground">暂无符合条件的数据</div>}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">高花费无单（建议否定）</CardTitle>
                  <CardDescription>点击与花费达到阈值但无订单</CardDescription>
                </CardHeader>
                <CardContent className="space-y-2">
                  {wasteRows.length ? wasteRows.map((row) => (
                    <div key={row.id} className="rounded-md border p-2 text-xs space-y-1">
                      <div className="font-medium truncate" title={row.targeting}>{row.targeting}</div>
                      <div className="text-muted-foreground truncate" title={row.campaignName}>{row.campaignName}</div>
                      <div>点击 {row.clicks} · 花费 {formatMoney(row.spend, currency)} · 订单 0</div>
                    </div>
                  )) : <div className="text-sm text-muted-foreground">暂无符合条件的数据</div>}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">高 ACOS 投放（建议降价）</CardTitle>
                  <CardDescription>点击达标且 ACOS 超过目标倍数，优先降竞价或收敛匹配</CardDescription>
                </CardHeader>
                <CardContent className="space-y-2">
                  {highAcosRows.length ? highAcosRows.map((row) => (
                    <div key={row.id} className="rounded-md border p-2 text-xs space-y-1">
                      <div className="font-medium truncate" title={row.targeting}>{row.targeting}</div>
                      <div className="text-muted-foreground truncate" title={row.campaignName}>{row.campaignName}</div>
                      <div>ACOS {row.acos.toFixed(2)}% · 花费 {formatMoney(row.spend, currency)} · 销售 {formatMoney(row.sales, currency)}</div>
                    </div>
                  )) : <div className="text-sm text-muted-foreground">暂无符合条件的数据</div>}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">观察池（先不否定）</CardTitle>
                  <CardDescription>无单但点击未达到否定阈值，避免过早处理</CardDescription>
                </CardHeader>
                <CardContent className="space-y-2">
                  {observeRows.length ? observeRows.map((row) => (
                    <div key={row.id} className="rounded-md border p-2 text-xs space-y-1">
                      <div className="font-medium truncate" title={row.targeting}>{row.targeting}</div>
                      <div className="text-muted-foreground truncate" title={row.campaignName}>{row.campaignName}</div>
                      <div>点击 {row.clicks} · 花费 {formatMoney(row.spend, currency)} · 订单 0</div>
                    </div>
                  )) : <div className="text-sm text-muted-foreground">暂无观察目标</div>}
                </CardContent>
              </Card>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
