import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowDown, ArrowLeft, ArrowUp, ArrowUpDown, CircleHelp, Download, FileSpreadsheet, Loader2, Upload } from 'lucide-react';
import { useDropzone } from 'react-dropzone';
import { Link } from 'wouter';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';
import { parsePlacementReport, type PlacementRecord } from '@/lib/report-parsers';
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
  | 'campaignName'
  | 'placement'
  | 'placementBucket'
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

type ShareMetric = 'spend' | 'sales' | 'orders';
type ProductStage = '新品' | '成熟';

const PIE_COLORS = ['#4f46e5', '#06b6d4', '#10b981', '#f59e0b', '#ef4444', '#a855f7'];
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

function placementBucketName(value: PlacementRecord['placementBucket']) {
  if (value === 'TOS') return '搜索顶部';
  if (value === 'ROS') return '搜索其余';
  if (value === 'PP') return '商品页面';
  if (value === 'OFFSITE') return '站外';
  return '其他';
}

export default function PlacementReportPage() {
  const historyStore = useMemo(() => createUploadHistoryStore('placement-upload'), []);
  const [rows, setRows] = useState<PlacementRecord[]>([]);
  const [fileLabel, setFileLabel] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [currency, setCurrency] = useState('USD');
  const [query, setQuery] = useState('');
  const [bucketFilter, setBucketFilter] = useState('全部');
  const [campaignFilter, setCampaignFilter] = useState('全部');
  const [minClicks, setMinClicks] = useState('');
  const [minSpend, setMinSpend] = useState('');
  const [maxAcos, setMaxAcos] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('spend');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [tableLimit, setTableLimit] = useState('120');
  const [targetAcos, setTargetAcos] = useState('30');
  const [productStage, setProductStage] = useState<ProductStage>('成熟');
  const [minDecisionClicks, setMinDecisionClicks] = useState('20');
  const [lowEffAcosFactor, setLowEffAcosFactor] = useState('2');
  const [lowEffCvrFactor, setLowEffCvrFactor] = useState('0.5');
  const [shareMetric, setShareMetric] = useState<ShareMetric>('spend');
  const [historyItems, setHistoryItems] = useState<HistoryMeta[]>([]);
  const [mergeEnabled, setMergeEnabled] = useState(true);
  const [mergeTargetId, setMergeTargetId] = useState<string | null>(null);
  const historyItemsRef = useRef<HistoryMeta[]>([]);

  const buildRowKey = (row: PlacementRecord) =>
    [row.startDate, row.endDate, row.campaignName, row.placement, row.placementBucket].join('|').toLowerCase();

  const mergeRecords = (base: PlacementRecord[], incoming: PlacementRecord[]) => {
    const map = new Map<string, PlacementRecord>();
    for (const row of base) map.set(buildRowKey(row), row);
    for (const row of incoming) map.set(buildRowKey(row), row);
    return Array.from(map.values());
  };

  const getRangeSummary = (items: PlacementRecord[]) => {
    const starts = items.map((r) => r.startDate).filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d));
    const ends = items.map((r) => r.endDate).filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d));
    if (!starts.length && !ends.length) return { minYmd: null, maxYmd: null };
    const minYmd = starts.length ? starts.reduce((acc, d) => (d < acc ? d : acc), starts[0]) : ends[0];
    const maxYmd = ends.length ? ends.reduce((acc, d) => (d > acc ? d : acc), ends[0]) : starts[0];
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
      setMinDecisionClicks('12');
      setLowEffAcosFactor('2.2');
      setLowEffCvrFactor('0.45');
      return;
    }
    setTargetAcos('30');
    setMinDecisionClicks('20');
    setLowEffAcosFactor('2');
    setLowEffCvrFactor('0.5');
  }, [productStage]);

  const resetFilters = () => {
    setQuery('');
    setBucketFilter('全部');
    setCampaignFilter('全部');
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
    setTargetAcos('30');
    setProductStage('成熟');
    setMinDecisionClicks('20');
    setLowEffAcosFactor('2');
    setLowEffCvrFactor('0.5');
    setTableLimit('120');
    setShareMetric('spend');
    resetFilters();
  };

  const onDrop = async (files: File[]) => {
    if (!files.length) return;
    setIsLoading(true);
    try {
      let merged: PlacementRecord[] = [];
      let nextCurrency: string | null = null;
      for (const file of files) {
        const { records, currency: detectedCurrency } = await parsePlacementReport(file);
        merged = merged.concat(records);
        if (!nextCurrency && detectedCurrency) nextCurrency = detectedCurrency;
      }
      const dedupMap = new Map<string, PlacementRecord>();
      for (const item of merged) dedupMap.set(buildRowKey(item), item);
      const deduped = Array.from(dedupMap.values());

      let baseData: PlacementRecord[] = [];
      if (mergeTargetId) {
        const records = await historyStore.loadRecords<PlacementRecord>(mergeTargetId);
        if (!records?.length) {
          toast.error('要合并的历史记录已损坏或被清理');
          setMergeTargetId(null);
        } else {
          baseData = records;
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
      toast.success(`已解析 ${deduped.length} 条广告位数据，当前 ${finalRows.length} 条`);
    } catch (error) {
      console.error(error);
      toast.error('广告位报表解析失败');
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

  const reportRange = useMemo(() => {
    const starts = rows.map((r) => r.startDate).filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d));
    const ends = rows.map((r) => r.endDate).filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d));
    if (!starts.length && !ends.length) return null;
    const minYmd = starts.length ? starts.reduce((acc, d) => (d < acc ? d : acc), starts[0]) : ends[0];
    const maxYmd = ends.length ? ends.reduce((acc, d) => (d > acc ? d : acc), ends[0]) : starts[0];
    const minDate = new Date(`${minYmd}T00:00:00.000Z`);
    const maxDate = new Date(`${maxYmd}T00:00:00.000Z`);
    const days = Math.max(1, Math.floor((maxDate.getTime() - minDate.getTime()) / 86400000) + 1);
    return { minYmd, maxYmd, days };
  }, [rows]);

  const campaignOptions = useMemo(() => {
    const values = Array.from(new Set(rows.map((r) => r.campaignName).filter(Boolean)));
    values.sort((a, b) => a.localeCompare(b, 'zh-Hans-CN'));
    return values;
  }, [rows]);

  const filteredRows = useMemo(() => {
    const q = query.trim().toLowerCase();
    const minClicksValue = Number(minClicks);
    const minSpendValue = Number(minSpend);
    const maxAcosValue = Number(maxAcos);
    return rows.filter((row) => {
      if (q) {
        const haystack = `${row.campaignName} ${row.placement} ${placementBucketName(row.placementBucket)}`.toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      if (bucketFilter !== '全部' && row.placementBucket !== bucketFilter) return false;
      if (campaignFilter !== '全部' && row.campaignName !== campaignFilter) return false;
      if (Number.isFinite(minClicksValue) && minClicksValue > 0 && row.clicks < minClicksValue) return false;
      if (Number.isFinite(minSpendValue) && minSpendValue > 0 && row.spend < minSpendValue) return false;
      const acosForFilter = row.sales > 0 ? row.acos : row.spend > 0 ? Number.POSITIVE_INFINITY : 0;
      if (Number.isFinite(maxAcosValue) && maxAcosValue > 0 && acosForFilter > maxAcosValue) return false;
      return true;
    });
  }, [rows, query, bucketFilter, campaignFilter, minClicks, minSpend, maxAcos]);

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

  const targetAcosValue = Math.max(1, Number(targetAcos) || 30);
  const minDecisionClicksValue = Math.max(1, Number(minDecisionClicks) || 20);
  const lowEffAcosFactorValue = Math.max(1.1, Number(lowEffAcosFactor) || 2);
  const lowEffCvrFactorValue = Math.min(1, Math.max(0.1, Number(lowEffCvrFactor) || 0.5));

  const placementSummary = useMemo(() => {
    const map = new Map<PlacementRecord['placementBucket'], { count: number; impressions: number; clicks: number; spend: number; sales: number; orders: number }>();
    for (const row of filteredRows) {
      const hit = map.get(row.placementBucket) ?? { count: 0, impressions: 0, clicks: 0, spend: 0, sales: 0, orders: 0 };
      hit.count += 1;
      hit.impressions += row.impressions;
      hit.clicks += row.clicks;
      hit.spend += row.spend;
      hit.sales += row.sales;
      hit.orders += row.orders;
      map.set(row.placementBucket, hit);
    }
    return (['TOS', 'ROS', 'PP', 'OFFSITE', 'OTHER'] as const)
      .map((bucket) => {
        const hit = map.get(bucket) ?? { count: 0, impressions: 0, clicks: 0, spend: 0, sales: 0, orders: 0 };
        const ctr = hit.impressions > 0 ? hit.clicks / hit.impressions : 0;
        const conversionRate = hit.clicks > 0 ? hit.orders / hit.clicks : 0;
        const cpc = hit.clicks > 0 ? hit.spend / hit.clicks : 0;
        const acos = hit.sales > 0 ? (hit.spend / hit.sales) * 100 : 0;
        const roas = hit.spend > 0 ? hit.sales / hit.spend : 0;
        const avgOrderCost = hit.orders > 0 ? hit.spend / hit.orders : 0;
        return { bucket, bucketName: placementBucketName(bucket), ...hit, ctr, conversionRate, cpc, acos, roas, avgOrderCost };
      })
      .filter((item) => item.count > 0);
  }, [filteredRows]);

  const shareMetricLabel = shareMetric === 'sales' ? `销售额(${currency})` : shareMetric === 'orders' ? '订单数' : `花费(${currency})`;
  const formatShareMetricValue = (value: number) => (shareMetric === 'orders' ? value.toLocaleString() : formatMoney(value, currency));

  const shareData = useMemo(() => {
    const readMetric = (row: { spend: number; sales: number; orders: number }) =>
      shareMetric === 'sales' ? row.sales : shareMetric === 'orders' ? row.orders : row.spend;
    const total = placementSummary.reduce((acc, item) => acc + readMetric(item), 0);
    return placementSummary.map((item) => {
      const metric = readMetric(item);
      return { name: item.bucketName, metric, share: total > 0 ? metric / total : 0 };
    });
  }, [placementSummary, shareMetric]);

  const compareData = useMemo(
    () =>
      placementSummary.map((item) => ({
        name: item.bucketName,
        spend: Number(item.spend.toFixed(2)),
        sales: Number(item.sales.toFixed(2)),
        acos: Number(item.acos.toFixed(2)),
        cvr: Number((item.conversionRate * 100).toFixed(2)),
      })),
    [placementSummary]
  );

  const avgCvr = summary.conversionRate;
  const highEffBuckets = useMemo(
    () => placementSummary.filter((item) => item.clicks >= minDecisionClicksValue && item.acos > 0 && item.acos <= targetAcosValue && item.conversionRate >= avgCvr),
    [placementSummary, minDecisionClicksValue, targetAcosValue, avgCvr]
  );
  const lowEffBuckets = useMemo(
    () => placementSummary.filter((item) => item.clicks >= minDecisionClicksValue && item.acos >= targetAcosValue * lowEffAcosFactorValue && item.conversionRate <= avgCvr * lowEffCvrFactorValue),
    [placementSummary, minDecisionClicksValue, targetAcosValue, lowEffAcosFactorValue, avgCvr, lowEffCvrFactorValue]
  );
  const observeBuckets = useMemo(
    () => placementSummary.filter((item) => item.clicks > 0 && item.clicks < minDecisionClicksValue),
    [placementSummary, minDecisionClicksValue]
  );
  const bidRecommendation = useMemo(() => {
    return placementSummary.map((item) => {
      if (item.clicks < minDecisionClicksValue && item.clicks > 0) {
        return { ...item, action: '先观察', reason: `点击低于${minDecisionClicksValue}，样本不足` };
      }
      if (item.clicks >= minDecisionClicksValue && item.acos > 0 && item.acos <= targetAcosValue && item.conversionRate >= avgCvr) {
        return { ...item, action: '提高 10%-20%', reason: 'ACOS 低于目标且转化高' };
      }
      if (item.clicks >= minDecisionClicksValue && item.acos >= targetAcosValue * lowEffAcosFactorValue && item.conversionRate <= avgCvr * lowEffCvrFactorValue) {
        return { ...item, action: '下调 20%-50%', reason: 'ACOS 过高且转化低' };
      }
      return { ...item, action: '保持/小幅微调', reason: '表现中性，持续观察' };
    });
  }, [placementSummary, minDecisionClicksValue, targetAcosValue, avgCvr, lowEffAcosFactorValue, lowEffCvrFactorValue]);

  const campaignPlacementRecommendation = useMemo(() => {
    const campaignMap = new Map<string, { clicks: number; orders: number }>();
    for (const row of filteredRows) {
      const hit = campaignMap.get(row.campaignName) ?? { clicks: 0, orders: 0 };
      hit.clicks += row.clicks;
      hit.orders += row.orders;
      campaignMap.set(row.campaignName, hit);
    }
    const campaignCvr = new Map<string, number>();
    for (const [name, value] of campaignMap.entries()) {
      campaignCvr.set(name, value.clicks > 0 ? value.orders / value.clicks : 0);
    }

    const placementMap = new Map<string, { campaignName: string; bucket: PlacementRecord['placementBucket']; bucketName: string; impressions: number; clicks: number; spend: number; sales: number; orders: number }>();
    for (const row of filteredRows) {
      const key = `${row.campaignName}||${row.placementBucket}`;
      const hit = placementMap.get(key) ?? {
        campaignName: row.campaignName,
        bucket: row.placementBucket,
        bucketName: placementBucketName(row.placementBucket),
        impressions: 0,
        clicks: 0,
        spend: 0,
        sales: 0,
        orders: 0,
      };
      hit.impressions += row.impressions;
      hit.clicks += row.clicks;
      hit.spend += row.spend;
      hit.sales += row.sales;
      hit.orders += row.orders;
      placementMap.set(key, hit);
    }

    return Array.from(placementMap.values())
      .map((item) => {
        const conversionRate = item.clicks > 0 ? item.orders / item.clicks : 0;
        const acos = item.sales > 0 ? (item.spend / item.sales) * 100 : item.spend > 0 ? Number.POSITIVE_INFINITY : 0;
        const campaignAvgCvr = campaignCvr.get(item.campaignName) ?? 0;
        let action = '保持/小幅微调';
        let reason = '表现中性，持续观察';
        if (item.clicks > 0 && item.clicks < minDecisionClicksValue) {
          action = '先观察';
          reason = `点击低于${minDecisionClicksValue}，样本不足`;
        } else if (item.clicks >= minDecisionClicksValue && acos > 0 && acos <= targetAcosValue && conversionRate >= campaignAvgCvr) {
          action = '提高 10%-20%';
          reason = 'ACOS 低于目标且不弱于该活动均值';
        } else if (item.clicks >= minDecisionClicksValue && acos >= targetAcosValue * lowEffAcosFactorValue && conversionRate <= campaignAvgCvr * lowEffCvrFactorValue) {
          action = '下调 20%-50%';
          reason = 'ACOS 过高且明显低于该活动均值';
        }
        return {
          ...item,
          conversionRate,
          acos,
          campaignAvgCvr,
          action,
          reason,
        };
      })
      .sort((a, b) => b.spend - a.spend || b.clicks - a.clicks)
      .slice(0, 200);
  }, [filteredRows, minDecisionClicksValue, targetAcosValue, lowEffAcosFactorValue, lowEffCvrFactorValue]);

  const sortedRows = useMemo(() => {
    const items = [...filteredRows];
    items.sort((a, b) => {
      const readValue = (row: PlacementRecord) => {
        if (sortKey === 'campaignName') return row.campaignName.toLowerCase();
        if (sortKey === 'placement') return row.placement.toLowerCase();
        if (sortKey === 'placementBucket') return placementBucketName(row.placementBucket);
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
    return items;
  }, [filteredRows, sortKey, sortDirection]);

  const tableRows = useMemo(() => {
    const n = Number(tableLimit);
    if (!Number.isFinite(n) || n <= 0) return sortedRows;
    return sortedRows.slice(0, n);
  }, [sortedRows, tableLimit]);

  const toggleSort = (nextKey: SortKey) => {
    if (sortKey === nextKey) {
      setSortDirection((prev) => (prev === 'desc' ? 'asc' : 'desc'));
      return;
    }
    setSortKey(nextKey);
    setSortDirection('desc');
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

  const renderAcosBadge = (acos: number, spend: number, sales: number) => {
    const acosForColor = sales > 0 ? acos : spend > 0 ? Number.POSITIVE_INFINITY : 0;
    const acosText = sales > 0 ? `${acos.toFixed(2)}%` : spend > 0 ? '∞' : '0.00%';
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

  const exportDecisionSheets = () => {
    const wb = XLSX.utils.book_new();
    const highSheet = highEffBuckets.map((item) => ({
      广告位: item.bucketName,
      曝光: item.impressions,
      点击: item.clicks,
      [`花费(${currency})`]: Number(item.spend.toFixed(2)),
      [`销售(${currency})`]: Number(item.sales.toFixed(2)),
      订单: item.orders,
      ACOS百分比: Number(item.acos.toFixed(2)),
      CVR百分比: Number((item.conversionRate * 100).toFixed(2)),
      建议: '提高该广告位竞价 10%-20%',
    }));
    const lowSheet = lowEffBuckets.map((item) => ({
      广告位: item.bucketName,
      曝光: item.impressions,
      点击: item.clicks,
      [`花费(${currency})`]: Number(item.spend.toFixed(2)),
      [`销售(${currency})`]: Number(item.sales.toFixed(2)),
      订单: item.orders,
      ACOS百分比: Number(item.acos.toFixed(2)),
      CVR百分比: Number((item.conversionRate * 100).toFixed(2)),
      建议: '下调该广告位竞价 20%-50%',
    }));
    const observeSheet = observeBuckets.map((item) => ({
      广告位: item.bucketName,
      曝光: item.impressions,
      点击: item.clicks,
      [`花费(${currency})`]: Number(item.spend.toFixed(2)),
      [`销售(${currency})`]: Number(item.sales.toFixed(2)),
      订单: item.orders,
      ACOS百分比: Number(item.acos.toFixed(2)),
      CVR百分比: Number((item.conversionRate * 100).toFixed(2)),
      建议: `样本不足，观察到点击≥${minDecisionClicksValue}后再调整`,
    }));
    const bidSheet = bidRecommendation.map((item) => ({
      广告位: item.bucketName,
      [`花费(${currency})`]: Number(item.spend.toFixed(2)),
      [`销售(${currency})`]: Number(item.sales.toFixed(2)),
      订单: item.orders,
      ACOS百分比: Number(item.acos.toFixed(2)),
      CVR百分比: Number((item.conversionRate * 100).toFixed(2)),
      动作: item.action,
      原因: item.reason,
    }));
    const campaignBidSheet = campaignPlacementRecommendation.map((item) => ({
      广告活动: item.campaignName,
      广告位: item.bucketName,
      曝光: item.impressions,
      点击: item.clicks,
      [`花费(${currency})`]: Number(item.spend.toFixed(2)),
      [`销售(${currency})`]: Number(item.sales.toFixed(2)),
      订单: item.orders,
      ACOS百分比: Number(item.acos.toFixed(2)),
      CVR百分比: Number((item.conversionRate * 100).toFixed(2)),
      活动均值CVR百分比: Number((item.campaignAvgCvr * 100).toFixed(2)),
      动作: item.action,
      原因: item.reason,
    }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(highSheet), '高效广告位');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(lowSheet), '低效广告位');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(observeSheet), '观察池');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(bidSheet), '竞价建议');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(campaignBidSheet), '活动位建议');
    XLSX.writeFile(wb, `广告位分析决策-${Date.now()}.xlsx`);
    toast.success('已导出广告位分析决策清单');
  };

  if (!rows.length) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
        <div className="w-full max-w-4xl text-center space-y-6 animate-in fade-in zoom-in duration-500">
          <div className="space-y-2">
            <h1 className="text-4xl font-extrabold tracking-tight lg:text-5xl bg-clip-text text-transparent bg-gradient-to-r from-primary to-slate-800">
              广告位报表分析
            </h1>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
              精细评估搜索顶部、搜索其余、商品页面等广告位效率，给出差异化竞价建议。
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
              <div className="text-lg font-medium">{isLoading ? '解析中…' : '上传广告位报表'}</div>
              <div className="text-sm text-muted-foreground">支持 .csv / .xlsx / .xls，可批量上传</div>
            </div>
            <div className="absolute bottom-4 flex items-center gap-2 text-xs text-muted-foreground">
              <FileSpreadsheet className="h-3.5 w-3.5" />
              <span>支持 Amazon 商品推广广告位报表</span>
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
                  {historyItems.map((item) => (
                    <div key={item.id} className="flex items-start justify-between gap-3 rounded-md border p-3">
                      <div className="min-w-0 flex-1 space-y-1">
                        <div className="text-sm font-medium whitespace-normal break-words pr-2">{item.fileNames.join('、')}</div>
                        <div className="text-xs text-muted-foreground">
                          {renderRange(item)} • {item.total.toLocaleString()} 条 • {new Date(item.createdAt).toLocaleString('zh-CN')}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <Button type="button" size="sm" variant={mergeTargetId === item.id ? 'secondary' : 'outline'} onClick={() => setMergeTargetId(mergeTargetId === item.id ? null : item.id)}>
                          {mergeTargetId === item.id ? '已选合并' : '合并'}
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="secondary"
                          onClick={async () => {
                            const records = await historyStore.loadRecords<PlacementRecord>(item.id);
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
                  ))}
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
            <a className="ml-1 underline underline-offset-4" href="https://amzlink.top/" target="_blank" rel="noreferrer">
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
            <h1 className="text-2xl font-semibold tracking-tight">广告位报表分析</h1>
            <p className="text-sm text-muted-foreground">按广告位位置评估效率，输出差异化竞价建议。</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={resetAll}>重置数据与设置</Button>
            <Link href="/">
              <Button variant="outline" className="gap-2">
                <ArrowLeft className="h-4 w-4" />
                返回类型选择
              </Button>
            </Link>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <Badge variant="outline">记录数：{rows.length.toLocaleString()}</Badge>
          <Badge variant="outline">筛选后：{filteredRows.length.toLocaleString()}</Badge>
          {reportRange ? <Badge variant="outline">报告时间：{reportRange.minYmd} ~ {reportRange.maxYmd}（{reportRange.days} 天）</Badge> : null}
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
          <Card><CardContent className="pt-6"><div className="text-xs text-muted-foreground">CVR</div><div className="text-xl font-semibold">{formatPct(summary.conversionRate)}</div></CardContent></Card>
          <Card><CardContent className="pt-6"><div className="text-xs text-muted-foreground">目标 ACOS</div><Input type="number" min={1} step="0.1" value={targetAcos} onChange={(e) => setTargetAcos(e.target.value)} /></CardContent></Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>筛选与明细</CardTitle>
            <CardDescription>按活动、广告位、阈值筛选并支持字段排序</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
              <div className="space-y-1">
                <div className="text-xs text-muted-foreground">搜索活动/广告位</div>
                <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="输入关键字" />
              </div>
              <div className="space-y-1">
                <div className="text-xs text-muted-foreground">广告位分类</div>
                <Select value={bucketFilter} onValueChange={setBucketFilter}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="全部">全部</SelectItem>
                    <SelectItem value="TOS">搜索顶部</SelectItem>
                    <SelectItem value="ROS">搜索其余</SelectItem>
                    <SelectItem value="PP">商品页面</SelectItem>
                    <SelectItem value="OFFSITE">站外</SelectItem>
                    <SelectItem value="OTHER">其他</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <div className="text-xs text-muted-foreground">广告活动</div>
                <Select value={campaignFilter} onValueChange={setCampaignFilter}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="全部">全部</SelectItem>
                    {campaignOptions.map((name) => <SelectItem key={name} value={name}>{name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <div className="text-xs text-muted-foreground">最小点击</div>
                <Input type="number" min={0} value={minClicks} onChange={(e) => setMinClicks(e.target.value)} />
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
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
              </div>
              <div className="flex items-end">
                <Button variant="outline" onClick={resetFilters}>重置筛选</Button>
              </div>
            </div>

            <div className="overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead><SortHeader label="活动" value="campaignName" /></TableHead>
                    <TableHead><SortHeader label="广告位" value="placement" /></TableHead>
                    <TableHead><SortHeader label="分类" value="placementBucket" /></TableHead>
                    <TableHead className="text-right"><SortHeader label="展示" value="impressions" /></TableHead>
                    <TableHead className="text-right"><SortHeader label="点击" value="clicks" /></TableHead>
                    <TableHead className="text-right"><SortHeader label="花费" value="spend" /></TableHead>
                    <TableHead className="text-right"><SortHeader label="销售" value="sales" /></TableHead>
                    <TableHead className="text-right"><SortHeader label="订单" value="orders" /></TableHead>
                    <TableHead className="text-right"><SortHeader label="ACOS" value="acos" /></TableHead>
                    <TableHead className="text-right"><SortHeader label="CVR" value="conversionRate" /></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tableRows.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell className="max-w-[280px] truncate" title={row.campaignName}>{row.campaignName}</TableCell>
                      <TableCell className="max-w-[260px] truncate" title={row.placement}>{row.placement}</TableCell>
                      <TableCell>{placementBucketName(row.placementBucket)}</TableCell>
                      <TableCell className="text-right">{row.impressions.toLocaleString()}</TableCell>
                      <TableCell className="text-right">{row.clicks.toLocaleString()}</TableCell>
                      <TableCell className="text-right">{formatMoney(row.spend, currency)}</TableCell>
                      <TableCell className="text-right">{formatMoney(row.sales, currency)}</TableCell>
                      <TableCell className="text-right">{row.orders.toLocaleString()}</TableCell>
                      <TableCell className="text-right">{renderAcosBadge(row.acos, row.spend, row.sales)}</TableCell>
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
            <CardTitle>广告位占比与表现对比</CardTitle>
            <CardDescription>分析不同广告位的贡献占比与效率差异</CardDescription>
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
              <Card><CardContent className="pt-6"><div className="text-xs text-muted-foreground">广告位类型数</div><div className="text-xl font-semibold">{shareData.length.toLocaleString()}</div></CardContent></Card>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">广告位占比</CardTitle>
                  <CardDescription>看预算/销售/订单在不同广告位的分布</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="h-[320px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart margin={{ top: 20, right: 24, left: 24, bottom: 20 }}>
                        <Pie data={shareData} dataKey="metric" nameKey="name" outerRadius={92} label={renderPiePercentLabel} labelLine={false}>
                          {shareData.map((_, idx) => <Cell key={`placement-share-${idx}`} fill={PIE_COLORS[idx % PIE_COLORS.length]} />)}
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
                  <CardTitle className="text-base">广告位表现对比</CardTitle>
                  <CardDescription>比较花费、销售、ACOS 与 CVR</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="h-[320px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={compareData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="name" />
                        <YAxis yAxisId="money" />
                        <YAxis yAxisId="ratio" orientation="right" />
                        <Tooltip />
                        <Legend />
                        <Bar yAxisId="money" dataKey="spend" name={`花费(${currency})`} fill="#4f46e5" />
                        <Bar yAxisId="money" dataKey="sales" name={`销售(${currency})`} fill="#10b981" />
                        <Bar yAxisId="ratio" dataKey="acos" name="ACOS(%)" fill="#ef4444" />
                        <Bar yAxisId="ratio" dataKey="cvr" name="CVR(%)" fill="#06b6d4" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <span>竞价优化建议</span>
              <UiTooltip>
                <UiTooltipTrigger asChild>
                  <button type="button" className="inline-flex h-5 w-5 items-center justify-center text-muted-foreground hover:text-foreground">
                    <CircleHelp className="h-4 w-4" />
                  </button>
                </UiTooltipTrigger>
                <UiTooltipContent side="top" align="start" className="max-w-[420px] text-xs leading-5">
                  <div>规则依据：目标ACOS、最小样本点击、高ACOS倍数、低CVR系数。</div>
                  <div>高效：点击达标且 ACOS 不高于目标，同时 CVR 不低于均值。</div>
                  <div>低效：点击达标且 ACOS 超过目标倍数，且 CVR 明显低于均值。</div>
                  <div>观察池：点击未达到样本门槛，不做激进调价。</div>
                </UiTooltipContent>
              </UiTooltip>
            </CardTitle>
            <CardDescription>按广告位效率给出提价/降价/观察建议，支持导出执行清单</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <Button className="gap-2" onClick={exportDecisionSheets}>
                <Download className="h-4 w-4" />
                一键导出广告位决策 Excel
              </Button>
            </div>

            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-5">
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
                <div className="text-xs text-muted-foreground">最小样本点击</div>
                <Input type="number" min={1} value={minDecisionClicks} onChange={(e) => setMinDecisionClicks(e.target.value)} />
              </div>
              <div className="space-y-1">
                <div className="text-xs text-muted-foreground">高ACOS倍数</div>
                <Input type="number" min={1.1} step="0.1" value={lowEffAcosFactor} onChange={(e) => setLowEffAcosFactor(e.target.value)} />
              </div>
              <div className="space-y-1">
                <div className="text-xs text-muted-foreground">低CVR系数</div>
                <Input type="number" min={0.1} max={1} step="0.05" value={lowEffCvrFactor} onChange={(e) => setLowEffCvrFactor(e.target.value)} />
              </div>
              <div className="rounded-md border px-3 py-2 text-xs text-muted-foreground flex items-center">
                当前均值CVR：{formatPct(avgCvr)}
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-5">
              <Card><CardContent className="pt-6"><div className="text-xs text-muted-foreground">高效广告位</div><div className="text-xl font-semibold">{highEffBuckets.length}</div></CardContent></Card>
              <Card><CardContent className="pt-6"><div className="text-xs text-muted-foreground">低效广告位</div><div className="text-xl font-semibold">{lowEffBuckets.length}</div></CardContent></Card>
              <Card><CardContent className="pt-6"><div className="text-xs text-muted-foreground">观察池</div><div className="text-xl font-semibold">{observeBuckets.length}</div></CardContent></Card>
              <Card><CardContent className="pt-6"><div className="text-xs text-muted-foreground">活动位建议</div><div className="text-xl font-semibold">{campaignPlacementRecommendation.length}</div></CardContent></Card>
              <Card><CardContent className="pt-6"><div className="text-xs text-muted-foreground">目标 ACOS</div><div className="text-xl font-semibold">{targetAcosValue.toFixed(1)}%</div></CardContent></Card>
            </div>

            <div className="overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>广告位</TableHead>
                    <TableHead className="text-right">花费</TableHead>
                    <TableHead className="text-right">销售</TableHead>
                    <TableHead className="text-right">订单</TableHead>
                    <TableHead className="text-right">ACOS</TableHead>
                    <TableHead className="text-right">CVR</TableHead>
                    <TableHead>动作</TableHead>
                    <TableHead>原因</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {bidRecommendation.map((item) => (
                    <TableRow key={item.bucket}>
                      <TableCell>{item.bucketName}</TableCell>
                      <TableCell className="text-right">{formatMoney(item.spend, currency)}</TableCell>
                      <TableCell className="text-right">{formatMoney(item.sales, currency)}</TableCell>
                      <TableCell className="text-right">{item.orders.toLocaleString()}</TableCell>
                      <TableCell className="text-right">{renderAcosBadge(item.acos, item.spend, item.sales)}</TableCell>
                      <TableCell className="text-right">{formatPct(item.conversionRate)}</TableCell>
                      <TableCell>{item.action}</TableCell>
                      <TableCell>{item.reason}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <div className="rounded-md border p-3 text-sm text-muted-foreground">
              按广告活动拆分广告位建议（逐活动调价）：同一广告位在不同活动中的效率可能差异很大，建议优先按“活动×广告位”执行。
            </div>

            <div className="overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>广告活动</TableHead>
                    <TableHead>广告位</TableHead>
                    <TableHead className="text-right">点击</TableHead>
                    <TableHead className="text-right">花费</TableHead>
                    <TableHead className="text-right">销售</TableHead>
                    <TableHead className="text-right">ACOS</TableHead>
                    <TableHead className="text-right">CVR</TableHead>
                    <TableHead className="text-right">活动均值CVR</TableHead>
                    <TableHead>动作</TableHead>
                    <TableHead>原因</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {campaignPlacementRecommendation.slice(0, 120).map((item) => (
                    <TableRow key={`${item.campaignName}-${item.bucket}`}>
                      <TableCell className="max-w-[280px] truncate" title={item.campaignName}>{item.campaignName}</TableCell>
                      <TableCell>{item.bucketName}</TableCell>
                      <TableCell className="text-right">{item.clicks.toLocaleString()}</TableCell>
                      <TableCell className="text-right">{formatMoney(item.spend, currency)}</TableCell>
                      <TableCell className="text-right">{formatMoney(item.sales, currency)}</TableCell>
                      <TableCell className="text-right">{renderAcosBadge(item.acos, item.spend, item.sales)}</TableCell>
                      <TableCell className="text-right">{formatPct(item.conversionRate)}</TableCell>
                      <TableCell className="text-right">{formatPct(item.campaignAvgCvr)}</TableCell>
                      <TableCell>{item.action}</TableCell>
                      <TableCell>{item.reason}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
