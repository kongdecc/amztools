import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowDown, ArrowLeft, ArrowUp, ArrowUpDown, Boxes, CircleHelp, Download, Loader2, Upload } from 'lucide-react';
import { useDropzone } from 'react-dropzone';
import { Link } from 'wouter';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';
import { parseAdvertisedProductReport, type AdvertisedProductRecord } from '@/lib/report-parsers';
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
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

function formatMoney(value: number, currency: string) {
  return new Intl.NumberFormat('zh-CN', { style: 'currency', currency, maximumFractionDigits: 2 }).format(value);
}

function formatPct(value: number) {
  return `${(value * 100).toFixed(2)}%`;
}

type SortKey =
  | 'campaignName'
  | 'advertisedSku'
  | 'advertisedAsin'
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
  | 'otherSkuSalesRatio';

type Quadrant = '明星产品' | '现金牛产品' | '潜力产品' | '问题产品';
type QuadrantMode = 'sales' | 'orders';
type ProductStage = '新品' | '成长期' | '成熟期';
type ViewMode = '明细' | '按SKU聚合' | '按ASIN聚合';

function classifyQuadrant(item: AdvertisedProductRecord, threshold: number, targetAcos: number, mode: QuadrantMode): Quadrant {
  const highOutput = mode === 'sales' ? item.sales >= threshold : item.orders >= threshold;
  const acosForDecision = item.sales > 0 ? item.acos : item.spend > 0 ? Number.POSITIVE_INFINITY : 0;
  const lowAcos = acosForDecision <= targetAcos;
  if (highOutput && lowAcos) return '明星产品';
  if (highOutput && !lowAcos) return '现金牛产品';
  if (!highOutput && lowAcos) return '潜力产品';
  return '问题产品';
}

export default function AdvertisedProductReportPage() {
  const historyStore = useMemo(() => createUploadHistoryStore('advertised-product-upload'), []);
  const [rows, setRows] = useState<AdvertisedProductRecord[]>([]);
  const [fileLabel, setFileLabel] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [currency, setCurrency] = useState('USD');
  const [query, setQuery] = useState('');
  const [campaignFilter, setCampaignFilter] = useState('全部');
  const [quadrantFilter, setQuadrantFilter] = useState<'全部' | Quadrant>('全部');
  const [minClicks, setMinClicks] = useState('');
  const [minSales, setMinSales] = useState('');
  const [maxAcos, setMaxAcos] = useState('');
  const [targetAcos, setTargetAcos] = useState('30');
  const [productStage, setProductStage] = useState<ProductStage>('成熟期');
  const [minDecisionClicks, setMinDecisionClicks] = useState('20');
  const [minDecisionOrders, setMinDecisionOrders] = useState('2');
  const [problemAcosFactor, setProblemAcosFactor] = useState('2');
  const [viewMode, setViewMode] = useState<ViewMode>('明细');
  const [quadrantMode, setQuadrantMode] = useState<QuadrantMode>('sales');
  const [sortKey, setSortKey] = useState<SortKey>('spend');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [tableLimit, setTableLimit] = useState('120');
  const [historyItems, setHistoryItems] = useState<HistoryMeta[]>([]);
  const [mergeEnabled, setMergeEnabled] = useState(true);
  const [mergeTargetId, setMergeTargetId] = useState<string | null>(null);
  const historyItemsRef = useRef<HistoryMeta[]>([]);

  const buildRowKey = (row: AdvertisedProductRecord) =>
    [row.startDate, row.endDate, row.campaignName, row.advertisedSku, row.advertisedAsin].join('|').toLowerCase();

  const mergeRecords = (base: AdvertisedProductRecord[], incoming: AdvertisedProductRecord[]) => {
    const map = new Map<string, AdvertisedProductRecord>();
    for (const row of base) map.set(buildRowKey(row), row);
    for (const row of incoming) map.set(buildRowKey(row), row);
    return Array.from(map.values());
  };

  const getRangeSummary = (items: AdvertisedProductRecord[]) => {
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
      setTargetAcos('60');
      setMinDecisionClicks('12');
      setMinDecisionOrders('1');
      setProblemAcosFactor('2.4');
      return;
    }
    if (productStage === '成长期') {
      setTargetAcos('40');
      setMinDecisionClicks('16');
      setMinDecisionOrders('2');
      setProblemAcosFactor('2.2');
      return;
    }
    setTargetAcos('30');
    setMinDecisionClicks('20');
    setMinDecisionOrders('2');
    setProblemAcosFactor('2');
  }, [productStage]);

  const resetFilters = () => {
    setQuery('');
    setCampaignFilter('全部');
    setQuadrantFilter('全部');
    setMinClicks('');
    setMinSales('');
    setMaxAcos('');
    setSortKey('spend');
    setSortDirection('desc');
  };

  const resetAll = () => {
    setRows([]);
    setFileLabel('');
    setCurrency('USD');
    setTargetAcos('30');
    setProductStage('成熟期');
    setMinDecisionClicks('20');
    setMinDecisionOrders('2');
    setProblemAcosFactor('2');
    setViewMode('明细');
    setTableLimit('120');
    resetFilters();
  };

  const onDrop = async (files: File[]) => {
    if (!files.length) return;
    setIsLoading(true);
    try {
      let merged: AdvertisedProductRecord[] = [];
      let nextCurrency: string | null = null;
      for (const file of files) {
        const { records, currency: detectedCurrency } = await parseAdvertisedProductReport(file);
        merged = merged.concat(records);
        if (!nextCurrency && detectedCurrency) nextCurrency = detectedCurrency;
      }
      const dedupMap = new Map<string, AdvertisedProductRecord>();
      for (const item of merged) dedupMap.set(buildRowKey(item), item);
      const deduped = Array.from(dedupMap.values());

      let baseData: AdvertisedProductRecord[] = [];
      if (mergeTargetId) {
        const records = await historyStore.loadRecords<AdvertisedProductRecord>(mergeTargetId);
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
      toast.success(`已解析 ${deduped.length} 条推广商品数据，当前 ${finalRows.length} 条`);
    } catch (error) {
      console.error(error);
      toast.error('推广的商品报表解析失败');
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

  const deleteHistoryItem = async (item: HistoryMeta) => {
    if (!window.confirm('确认删除这条历史记录吗？此操作不可恢复。')) return;
    await historyStore.deleteRecord(item.id);
    const next = historyItemsRef.current.filter((h) => h.id !== item.id);
    historyItemsRef.current = next;
    setHistoryItems(next);
    await historyStore.persistMeta(next);
    if (mergeTargetId === item.id) setMergeTargetId(null);
    toast.success('已删除历史记录');
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

  const avgSalesAll = useMemo(() => {
    if (!rows.length) return 0;
    return rows.reduce((acc, row) => acc + row.sales, 0) / rows.length;
  }, [rows]);

  const avgOrdersAll = useMemo(() => {
    if (!rows.length) return 0;
    return rows.reduce((acc, row) => acc + row.orders, 0) / rows.length;
  }, [rows]);

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

  const targetAcosValue = Math.max(1, Number(targetAcos) || 30);
  const minDecisionClicksValue = Math.max(1, Number(minDecisionClicks) || 20);
  const minDecisionOrdersValue = Math.max(1, Number(minDecisionOrders) || 2);
  const problemAcosFactorValue = Math.max(1.1, Number(problemAcosFactor) || 2);
  const quadrantThreshold = quadrantMode === 'sales' ? avgSalesAll : avgOrdersAll;
  const quadrantThresholdLabel = quadrantMode === 'sales' ? `销售额均值 ${formatMoney(quadrantThreshold, currency)}` : `订单均值 ${quadrantThreshold.toFixed(2)}`;

  const baseFilteredRows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((row) => {
      if (q) {
        const haystack = `${row.campaignName} ${row.advertisedSku} ${row.advertisedAsin}`.toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      if (campaignFilter !== '全部' && row.campaignName !== campaignFilter) return false;
      return true;
    });
  }, [rows, query, campaignFilter]);

  const applyMetricFilters = useCallback((list: AdvertisedProductRecord[]) => {
    const minClicksValue = Number(minClicks);
    const minSalesValue = Number(minSales);
    const maxAcosValue = Number(maxAcos);
    return list.filter((row) => {
      if (Number.isFinite(minClicksValue) && minClicksValue > 0 && row.clicks < minClicksValue) return false;
      if (Number.isFinite(minSalesValue) && minSalesValue > 0 && row.sales < minSalesValue) return false;
      const acosForFilter = row.sales > 0 ? row.acos : row.spend > 0 ? Number.POSITIVE_INFINITY : 0;
      if (Number.isFinite(maxAcosValue) && maxAcosValue > 0 && acosForFilter > maxAcosValue) return false;
      return true;
    });
  }, [maxAcos, minClicks, minSales]);

  const filteredRows = useMemo(() => {
    if (viewMode === '明细') return applyMetricFilters(baseFilteredRows);
    const by = viewMode === '按SKU聚合' ? 'advertisedSku' : 'advertisedAsin';
    const map = new Map<string, AdvertisedProductRecord[]>();
    for (const row of baseFilteredRows) {
      const key = String(row[by]).trim().toLowerCase() || '(empty)';
      const list = map.get(key) ?? [];
      list.push(row);
      map.set(key, list);
    }
    const aggregated: AdvertisedProductRecord[] = [];
    for (const group of map.values()) {
      const base = group[0];
      const impressions = group.reduce((acc, r) => acc + r.impressions, 0);
      const clicks = group.reduce((acc, r) => acc + r.clicks, 0);
      const spend = group.reduce((acc, r) => acc + r.spend, 0);
      const sales = group.reduce((acc, r) => acc + r.sales, 0);
      const orders = group.reduce((acc, r) => acc + r.orders, 0);
      const units = group.reduce((acc, r) => acc + r.units, 0);
      const adSkuUnits = group.reduce((acc, r) => acc + r.adSkuUnits, 0);
      const otherSkuUnits = group.reduce((acc, r) => acc + r.otherSkuUnits, 0);
      const adSkuSales = group.reduce((acc, r) => acc + r.adSkuSales, 0);
      const otherSkuSales = group.reduce((acc, r) => acc + r.otherSkuSales, 0);
      aggregated.push({
        ...base,
        id: `agg-${viewMode}-${String(base[by])}`,
        campaignName: group.length > 1 ? `（多活动:${new Set(group.map((r) => r.campaignName)).size}）${base.campaignName}` : base.campaignName,
        impressions,
        clicks,
        ctr: impressions > 0 ? clicks / impressions : 0,
        cpc: clicks > 0 ? spend / clicks : 0,
        spend,
        sales,
        orders,
        units,
        acos: sales > 0 ? (spend / sales) * 100 : spend > 0 ? Number.POSITIVE_INFINITY : 0,
        roas: spend > 0 ? sales / spend : 0,
        conversionRate: clicks > 0 ? orders / clicks : 0,
        adSkuUnits,
        otherSkuUnits,
        adSkuSales,
        otherSkuSales,
        otherSkuSalesRatio: sales > 0 ? otherSkuSales / sales : 0,
      });
    }
    return applyMetricFilters(aggregated);
  }, [applyMetricFilters, baseFilteredRows, viewMode]);

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
    const otherSkuSales = filteredRows.reduce((acc, curr) => acc + curr.otherSkuSales, 0);
    const otherSkuRatio = sales > 0 ? otherSkuSales / sales : 0;
    return { spend, sales, orders, clicks, impressions, acos, roas, ctr, cpc, conversionRate, otherSkuSales, otherSkuRatio };
  }, [filteredRows]);

  const quadrantRows = useMemo(
    () =>
      filteredRows
        .map((item) => ({ ...item, quadrant: classifyQuadrant(item, quadrantThreshold, targetAcosValue, quadrantMode) }))
        .filter((row) => (quadrantFilter === '全部' ? true : row.quadrant === quadrantFilter)),
    [filteredRows, quadrantThreshold, targetAcosValue, quadrantMode, quadrantFilter]
  );

  const quadrantSummary = useMemo(() => {
    const map = new Map<Quadrant, { count: number; spend: number; sales: number }>();
    for (const row of quadrantRows) {
      const hit = map.get(row.quadrant) ?? { count: 0, spend: 0, sales: 0 };
      hit.count += 1;
      hit.spend += row.spend;
      hit.sales += row.sales;
      map.set(row.quadrant, hit);
    }
    return (['明星产品', '现金牛产品', '潜力产品', '问题产品'] as const).map((q) => {
      const hit = map.get(q) ?? { count: 0, spend: 0, sales: 0 };
      return { quadrant: q, ...hit };
    });
  }, [quadrantRows]);

  const ctrCvrRows = useMemo(() => {
    const avgCtr = summary.ctr;
    const avgCvr = summary.conversionRate;
    const buckets = {
      '高CTR高CVR': 0,
      '高CTR低CVR': 0,
      '低CTR高CVR': 0,
      '低CTR低CVR': 0,
    };
    for (const row of filteredRows) {
      const highCtr = row.ctr >= avgCtr;
      const highCvr = row.conversionRate >= avgCvr;
      if (highCtr && highCvr) buckets['高CTR高CVR'] += 1;
      else if (highCtr && !highCvr) buckets['高CTR低CVR'] += 1;
      else if (!highCtr && highCvr) buckets['低CTR高CVR'] += 1;
      else buckets['低CTR低CVR'] += 1;
    }
    return [
      { name: '高CTR高CVR', value: buckets['高CTR高CVR'] },
      { name: '高CTR低CVR', value: buckets['高CTR低CVR'] },
      { name: '低CTR高CVR', value: buckets['低CTR高CVR'] },
      { name: '低CTR低CVR', value: buckets['低CTR低CVR'] },
    ];
  }, [filteredRows, summary.ctr, summary.conversionRate]);

  const diagnosedRows = useMemo(
    () =>
      quadrantRows.map((row) => {
        const highCtr = row.ctr >= summary.ctr;
        const highCvr = row.conversionRate >= summary.conversionRate;
        const sampleReady = row.clicks >= minDecisionClicksValue;
        const ctrCvrTag = highCtr && highCvr ? '高CTR高CVR' : highCtr && !highCvr ? '高CTR低CVR' : !highCtr && highCvr ? '低CTR高CVR' : '低CTR低CVR';
        let action = '观察';
        if (!sampleReady) {
          action = '观察';
        } else if (row.quadrant === '问题产品' && row.acos >= targetAcosValue * problemAcosFactorValue) {
          action = '止损';
        } else if (ctrCvrTag === '高CTR高CVR' && row.orders >= minDecisionOrdersValue) {
          action = '加投';
        } else if (ctrCvrTag === '高CTR低CVR') {
          action = '优化承接';
        } else if (ctrCvrTag === '低CTR高CVR') {
          action = '优化吸引';
        } else if (row.quadrant === '潜力产品') {
          action = '加投';
        }
        return { ...row, sampleReady, ctrCvrTag, action };
      }),
    [quadrantRows, summary.ctr, summary.conversionRate, minDecisionClicksValue, targetAcosValue, problemAcosFactorValue, minDecisionOrdersValue]
  );

  const actionSummary = useMemo(() => {
    const map = new Map<string, number>();
    for (const row of diagnosedRows) map.set(row.action, (map.get(row.action) ?? 0) + 1);
    return {
      加投: map.get('加投') ?? 0,
      优化承接: map.get('优化承接') ?? 0,
      优化吸引: map.get('优化吸引') ?? 0,
      止损: map.get('止损') ?? 0,
      观察: map.get('观察') ?? 0,
    };
  }, [diagnosedRows]);

  const sortedRows = useMemo(() => {
    const items = [...diagnosedRows];
    items.sort((a, b) => {
      const readValue = (row: (AdvertisedProductRecord & { quadrant: Quadrant; ctrCvrTag: string; action: string })) => {
        if (sortKey === 'campaignName') return row.campaignName.toLowerCase();
        if (sortKey === 'advertisedSku') return row.advertisedSku.toLowerCase();
        if (sortKey === 'advertisedAsin') return row.advertisedAsin.toLowerCase();
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
  }, [diagnosedRows, sortKey, sortDirection]);

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

  const exportDecision = () => {
    const wb = XLSX.utils.book_new();
    const quadrantSheet = diagnosedRows.map((r) => ({
      象限口径: quadrantMode === 'sales' ? '按销售额阈值' : '按订单阈值',
      活动: r.campaignName,
      SKU: r.advertisedSku,
      ASIN: r.advertisedAsin,
      象限: r.quadrant,
      CTR_CVR诊断: r.ctrCvrTag,
      样本达标: r.sampleReady ? '是' : '否',
      动作: r.action,
      阈值类型: quadrantMode === 'sales' ? '销售额' : '订单',
      阈值数值: quadrantMode === 'sales' ? Number(quadrantThreshold.toFixed(2)) : Number(quadrantThreshold.toFixed(2)),
      [`花费(${currency})`]: Number(r.spend.toFixed(2)),
      [`销售(${currency})`]: Number(r.sales.toFixed(2)),
      订单: r.orders,
      ACOS百分比: Number(r.acos.toFixed(2)),
      ROAS: Number(r.roas.toFixed(3)),
      CVR百分比: Number((r.conversionRate * 100).toFixed(2)),
      建议:
        r.quadrant === '明星产品'
          ? '提高预算30%-50%'
          : r.quadrant === '现金牛产品'
            ? '优化词包与降低低效竞价'
            : r.quadrant === '潜力产品'
              ? '增加曝光与扩词'
              : '暂停或重构',
    }));
    const trafficSheet = diagnosedRows.map((r) => ({
      活动: r.campaignName,
      SKU: r.advertisedSku,
      CTR百分比: Number((r.ctr * 100).toFixed(2)),
      CVR百分比: Number((r.conversionRate * 100).toFixed(2)),
      CTR_CVR诊断: r.ctrCvrTag,
      样本达标: r.sampleReady ? '是' : '否',
      动作: r.action,
      [`花费(${currency})`]: Number(r.spend.toFixed(2)),
      [`销售(${currency})`]: Number(r.sales.toFixed(2)),
      其他SKU销售占比百分比: Number((r.otherSkuSalesRatio * 100).toFixed(2)),
    }));
    const actionSheet = diagnosedRows.map((r) => ({
      活动: r.campaignName,
      SKU: r.advertisedSku,
      ASIN: r.advertisedAsin,
      象限: r.quadrant,
      CTR_CVR诊断: r.ctrCvrTag,
      样本达标: r.sampleReady ? '是' : '否',
      动作: r.action,
      [`花费(${currency})`]: Number(r.spend.toFixed(2)),
      [`销售(${currency})`]: Number(r.sales.toFixed(2)),
      订单: r.orders,
      ACOS百分比: Number(r.acos.toFixed(2)),
    }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(quadrantSheet), '产品象限建议');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(trafficSheet), 'CTR_CVR诊断');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(actionSheet), '执行动作');
    XLSX.writeFile(wb, `推广商品分析决策-${Date.now()}.xlsx`);
    toast.success('已导出推广商品决策清单');
  };

  if (!rows.length) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
        <div className="w-full max-w-4xl text-center space-y-6 animate-in fade-in zoom-in duration-500">
          <div className="space-y-2">
            <h1 className="text-4xl font-extrabold tracking-tight lg:text-5xl bg-clip-text text-transparent bg-gradient-to-r from-primary to-slate-800">
              推广的商品报表分析
            </h1>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
              面向 SKU/ASIN 的精细化运营分析，识别明星、潜力与问题商品并输出动作建议。
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
              <div className="text-lg font-medium">{isLoading ? '解析中…' : '上传推广的商品报表'}</div>
              <div className="text-sm text-muted-foreground">支持 .csv / .xlsx / .xls，可批量上传</div>
            </div>
            <div className="absolute bottom-4 flex items-center gap-2 text-xs text-muted-foreground">
              <Boxes className="h-3.5 w-3.5" />
              <span>支持 Amazon 商品推广的商品报表</span>
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
          </div>

          <div className="rounded-lg border bg-card p-4 space-y-3 text-left">
            <div className="flex items-center justify-between">
              <div className="text-sm font-medium">历史记录</div>
              <Button type="button" size="sm" variant="outline" onClick={clearHistory} disabled={!historyItems.length}>清空</Button>
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
                            const records = await historyStore.loadRecords<AdvertisedProductRecord>(item.id);
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
                        <Button type="button" size="sm" variant="ghost" onClick={() => void deleteHistoryItem(item)}>
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
            <h1 className="text-2xl font-semibold tracking-tight">推广的商品报表分析</h1>
            <p className="text-sm text-muted-foreground">SKU / ASIN 维度分析，支持四象限（销售额/订单口径）、CTR-CVR 与关联销售诊断。</p>
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
          <Badge variant="outline">基础筛选后：{baseFilteredRows.length.toLocaleString()}</Badge>
          <Badge variant="outline">当前视图：{viewMode}</Badge>
          <Badge variant="outline">视图数据量：{filteredRows.length.toLocaleString()}</Badge>
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
          <Card><CardContent className="pt-6"><div className="text-xs text-muted-foreground">CVR</div><div className="text-xl font-semibold">{formatPct(summary.conversionRate)}</div></CardContent></Card>
          <Card><CardContent className="pt-6"><div className="text-xs text-muted-foreground">其他SKU销售额</div><div className="text-xl font-semibold">{formatMoney(summary.otherSkuSales, currency)}</div></CardContent></Card>
          <Card>
            <CardContent className="pt-6 space-y-2">
              <div className="text-xs text-muted-foreground">目标 ACOS(%)</div>
              <Input type="number" min={1} step="0.1" value={targetAcos} onChange={(e) => setTargetAcos(e.target.value)} />
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <span>四象限口径设置</span>
              <UiTooltip>
                <UiTooltipTrigger asChild>
                  <button type="button" className="inline-flex h-5 w-5 items-center justify-center text-muted-foreground hover:text-foreground">
                    <CircleHelp className="h-4 w-4" />
                  </button>
                </UiTooltipTrigger>
                <UiTooltipContent side="top" align="start" className="max-w-[420px] text-xs leading-5">
                  <div>建议先选产品阶段，再微调目标ACOS和样本门槛。</div>
                  <div>CTR/CVR诊断按当前筛选数据均值计算，避免跨类目误判。</div>
                  <div>点击未达样本门槛时默认归入“观察”，不做激进调整。</div>
                </UiTooltipContent>
              </UiTooltip>
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-1">
              <div className="text-xs text-muted-foreground">产品阶段</div>
              <Select value={productStage} onValueChange={(value) => setProductStage(value as ProductStage)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="新品">新品</SelectItem>
                  <SelectItem value="成长期">成长期</SelectItem>
                  <SelectItem value="成熟期">成熟期</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <div className="text-xs text-muted-foreground">象限口径</div>
              <Select value={quadrantMode} onValueChange={(value) => setQuadrantMode(value as QuadrantMode)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="sales">按销售额阈值</SelectItem>
                  <SelectItem value="orders">按订单阈值</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <div className="text-xs text-muted-foreground">当前阈值</div>
              <div className="h-10 rounded-md border px-3 flex items-center text-sm">{quadrantThresholdLabel}</div>
            </div>
            <div className="space-y-1">
              <div className="text-xs text-muted-foreground">说明</div>
              <div className="h-10 rounded-md border px-3 flex items-center text-xs text-muted-foreground">高产出 + 低 ACOS 为明星；低产出 + 高 ACOS 为问题。</div>
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Card>
            <CardContent className="pt-6 space-y-2">
              <div className="text-xs text-muted-foreground">样本门槛-最小点击</div>
              <Input type="number" min={1} value={minDecisionClicks} onChange={(e) => setMinDecisionClicks(e.target.value)} />
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6 space-y-2">
              <div className="text-xs text-muted-foreground">样本门槛-最小订单</div>
              <Input type="number" min={1} value={minDecisionOrders} onChange={(e) => setMinDecisionOrders(e.target.value)} />
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6 space-y-2">
              <div className="text-xs text-muted-foreground">问题产品ACOS倍数</div>
              <Input type="number" min={1.1} step="0.1" value={problemAcosFactor} onChange={(e) => setProblemAcosFactor(e.target.value)} />
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>筛选与明细</CardTitle>
            <CardDescription>支持按活动、象限、阈值筛选并进行字段排序</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-5">
              <div className="space-y-1">
                <div className="text-xs text-muted-foreground">搜索活动/SKU/ASIN</div>
                <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="输入关键字" />
              </div>
              <div className="space-y-1">
                <div className="text-xs text-muted-foreground">活动</div>
                <Select value={campaignFilter} onValueChange={setCampaignFilter}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="全部">全部</SelectItem>
                    {campaignOptions.map((name) => <SelectItem key={name} value={name}>{name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <div className="text-xs text-muted-foreground">产品象限</div>
                <Select value={quadrantFilter} onValueChange={(value) => setQuadrantFilter(value as '全部' | Quadrant)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="全部">全部</SelectItem>
                    <SelectItem value="明星产品">明星产品</SelectItem>
                    <SelectItem value="现金牛产品">现金牛产品</SelectItem>
                    <SelectItem value="潜力产品">潜力产品</SelectItem>
                    <SelectItem value="问题产品">问题产品</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <div className="text-xs text-muted-foreground">视图</div>
                <Select value={viewMode} onValueChange={(value) => setViewMode(value as ViewMode)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="明细">明细</SelectItem>
                    <SelectItem value="按SKU聚合">按SKU聚合</SelectItem>
                    <SelectItem value="按ASIN聚合">按ASIN聚合</SelectItem>
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
                <div className="text-xs text-muted-foreground">最小销售额</div>
                <Input type="number" min={0} step="0.1" value={minSales} onChange={(e) => setMinSales(e.target.value)} />
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
                    <TableHead><SortHeader label="SKU" value="advertisedSku" /></TableHead>
                    <TableHead><SortHeader label="ASIN" value="advertisedAsin" /></TableHead>
                    <TableHead className="text-right"><SortHeader label="花费" value="spend" /></TableHead>
                    <TableHead className="text-right"><SortHeader label="销售" value="sales" /></TableHead>
                    <TableHead className="text-right"><SortHeader label="订单" value="orders" /></TableHead>
                    <TableHead className="text-right"><SortHeader label="CTR" value="ctr" /></TableHead>
                    <TableHead className="text-right"><SortHeader label="CVR" value="conversionRate" /></TableHead>
                    <TableHead className="text-right"><SortHeader label="ACOS" value="acos" /></TableHead>
                    <TableHead className="text-right"><SortHeader label="其他SKU销售占比" value="otherSkuSalesRatio" /></TableHead>
                    <TableHead>象限</TableHead>
                    <TableHead>CTR/CVR诊断</TableHead>
                    <TableHead>动作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tableRows.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell className="max-w-[260px] truncate" title={row.campaignName}>{row.campaignName}</TableCell>
                      <TableCell>{row.advertisedSku}</TableCell>
                      <TableCell>{row.advertisedAsin}</TableCell>
                      <TableCell className="text-right">{formatMoney(row.spend, currency)}</TableCell>
                      <TableCell className="text-right">{formatMoney(row.sales, currency)}</TableCell>
                      <TableCell className="text-right">{row.orders.toLocaleString()}</TableCell>
                      <TableCell className="text-right">{formatPct(row.ctr)}</TableCell>
                      <TableCell className="text-right">{formatPct(row.conversionRate)}</TableCell>
                      <TableCell className="text-right">{renderAcosBadge(row.acos, row.spend, row.sales)}</TableCell>
                      <TableCell className="text-right">{formatPct(row.otherSkuSalesRatio)}</TableCell>
                      <TableCell>{row.quadrant}</TableCell>
                      <TableCell>{row.ctrCvrTag}</TableCell>
                      <TableCell>{row.action}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>产品四象限与流量诊断</CardTitle>
            <CardDescription>当前口径：{quadrantMode === 'sales' ? '按销售额阈值' : '按订单阈值'}（{quadrantThresholdLabel}）</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 lg:grid-cols-2">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">四象限数量分布</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-[280px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={quadrantSummary}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="quadrant" />
                        <YAxis />
                        <Tooltip />
                        <Legend />
                        <Bar dataKey="count" name="产品数" fill="#4f46e5" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">CTR / CVR 组合诊断</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-[280px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={ctrCvrRows}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="name" />
                        <YAxis />
                        <Tooltip />
                        <Legend />
                        <Bar dataKey="value" name="产品数" fill="#06b6d4" />
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
            <CardTitle>运营动作建议</CardTitle>
            <CardDescription>按“加投/优化承接/优化吸引/止损/观察”输出执行清单</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <Button className="gap-2" onClick={exportDecision}>
                <Download className="h-4 w-4" />
                一键导出推广商品决策 Excel
              </Button>
            </div>
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-5">
              <Card><CardContent className="pt-6"><div className="text-xs text-muted-foreground">加投</div><div className="text-xl font-semibold">{actionSummary['加投'].toLocaleString()}</div></CardContent></Card>
              <Card><CardContent className="pt-6"><div className="text-xs text-muted-foreground">优化承接</div><div className="text-xl font-semibold">{actionSummary['优化承接'].toLocaleString()}</div></CardContent></Card>
              <Card><CardContent className="pt-6"><div className="text-xs text-muted-foreground">优化吸引</div><div className="text-xl font-semibold">{actionSummary['优化吸引'].toLocaleString()}</div></CardContent></Card>
              <Card><CardContent className="pt-6"><div className="text-xs text-muted-foreground">止损</div><div className="text-xl font-semibold">{actionSummary['止损'].toLocaleString()}</div></CardContent></Card>
              <Card><CardContent className="pt-6"><div className="text-xs text-muted-foreground">观察</div><div className="text-xl font-semibold">{actionSummary['观察'].toLocaleString()}</div></CardContent></Card>
            </div>
            <div className="text-sm text-muted-foreground">
              关联销售占比（其他SKU销售额 / 总销售额）：{formatPct(summary.otherSkuRatio)}，可用于识别“流量入口型商品”。
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
