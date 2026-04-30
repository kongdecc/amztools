import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowDown, ArrowLeft, ArrowUp, ArrowUpDown, CircleHelp, Loader2, Percent, Upload } from 'lucide-react';
import { useDropzone } from 'react-dropzone';
import { Link } from 'wouter';
import { toast } from 'sonner';
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { parseSearchTermImpressionShareReport, type SearchTermImpressionShareRecord } from '@/lib/report-parsers';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tooltip as UiTooltip, TooltipContent as UiTooltipContent, TooltipTrigger as UiTooltipTrigger } from '@/components/ui/tooltip';
import { createUploadHistoryStore, type HistoryMeta } from '@/lib/upload-history';
import { cn } from '@/lib/utils';

function formatMoney(value: number, currency: string) {
  return new Intl.NumberFormat('zh-CN', { style: 'currency', currency, maximumFractionDigits: 2 }).format(value);
}

function formatPct(value: number) {
  return `${(value * 100).toFixed(2)}%`;
}

type SortKey = 'customerSearchTerm' | 'campaignName' | 'impressionShare' | 'impressionShareRank' | 'clicks' | 'spend' | 'sales' | 'acos' | 'orders';
type ShareQuadrant = '高份额高效' | '低份额高效' | '高份额低效' | '低份额低效';
type ViewMode = '按搜索词汇总' | '明细';
type AnalyzedShareRow = SearchTermImpressionShareRecord & {
  quadrant: ShareQuadrant;
  sampleQualified: boolean;
  opportunityScore: number;
};

function classifyShareQuadrant(
  item: SearchTermImpressionShareRecord,
  shareThreshold: number,
  targetAcos: number,
  minDecisionClicks: number,
  minDecisionSpend: number,
  minDecisionOrders: number
): ShareQuadrant {
  const highShare = item.impressionShare >= shareThreshold;
  const acosForDecision = item.sales > 0 ? item.acos : item.spend > 0 ? Number.POSITIVE_INFINITY : 0;
  const sampleQualified = item.clicks >= minDecisionClicks && item.spend >= minDecisionSpend;
  const highEfficiency = sampleQualified && item.orders >= minDecisionOrders && acosForDecision <= targetAcos;
  if (highShare && highEfficiency) return '高份额高效';
  if (!highShare && highEfficiency) return '低份额高效';
  if (highShare && !highEfficiency) return '高份额低效';
  return '低份额低效';
}

export default function SearchTermImpressionShareReportPage() {
  const historyStore = useMemo(() => createUploadHistoryStore('search-term-share-upload'), []);
  const [rows, setRows] = useState<SearchTermImpressionShareRecord[]>([]);
  const [fileLabel, setFileLabel] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [currency, setCurrency] = useState('USD');
  const [query, setQuery] = useState('');
  const [campaignFilter, setCampaignFilter] = useState('全部');
  const [matchTypeFilter, setMatchTypeFilter] = useState('全部');
  const [quadrantFilter, setQuadrantFilter] = useState<'全部' | ShareQuadrant>('全部');
  const [minShare, setMinShare] = useState('');
  const [maxAcos, setMaxAcos] = useState('');
  const [maxRank, setMaxRank] = useState('');
  const [targetAcos, setTargetAcos] = useState('30');
  const [shareThresholdPct, setShareThresholdPct] = useState('30');
  const [viewMode, setViewMode] = useState<ViewMode>('按搜索词汇总');
  const [minDecisionClicks, setMinDecisionClicks] = useState('8');
  const [minDecisionSpend, setMinDecisionSpend] = useState('5');
  const [minDecisionOrders, setMinDecisionOrders] = useState('1');
  const [sortKey, setSortKey] = useState<SortKey>('spend');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [tableLimit, setTableLimit] = useState('150');
  const [historyItems, setHistoryItems] = useState<HistoryMeta[]>([]);
  const [mergeEnabled, setMergeEnabled] = useState(true);
  const [mergeTargetId, setMergeTargetId] = useState<string | null>(null);
  const historyItemsRef = useRef<HistoryMeta[]>([]);

  const buildRowKey = (row: SearchTermImpressionShareRecord) =>
    [row.startDate, row.endDate, row.country, row.customerSearchTerm, row.campaignName, row.adGroupName, row.matchType, row.targeting]
      .join('|')
      .toLowerCase();

  const mergeRecords = (base: SearchTermImpressionShareRecord[], incoming: SearchTermImpressionShareRecord[]) => {
    const map = new Map<string, SearchTermImpressionShareRecord>();
    for (const row of base) map.set(buildRowKey(row), row);
    for (const row of incoming) map.set(buildRowKey(row), row);
    return Array.from(map.values());
  };

  const getRangeSummary = (items: SearchTermImpressionShareRecord[]) => {
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

  const resetFilters = () => {
    setQuery('');
    setCampaignFilter('全部');
    setMatchTypeFilter('全部');
    setQuadrantFilter('全部');
    setMinShare('');
    setMaxAcos('');
    setMaxRank('');
    setSortKey('spend');
    setSortDirection('desc');
  };

  const resetAll = () => {
    setRows([]);
    setFileLabel('');
    setCurrency('USD');
    setTableLimit('150');
    setTargetAcos('30');
    setShareThresholdPct('30');
    setViewMode('按搜索词汇总');
    setMinDecisionClicks('8');
    setMinDecisionSpend('5');
    setMinDecisionOrders('1');
    resetFilters();
  };

  const onDrop = async (files: File[]) => {
    if (!files.length) return;
    setIsLoading(true);
    try {
      let merged: SearchTermImpressionShareRecord[] = [];
      let nextCurrency: string | null = null;
      for (const file of files) {
        const { records, currency: detectedCurrency } = await parseSearchTermImpressionShareReport(file);
        merged = merged.concat(records);
        if (!nextCurrency && detectedCurrency) nextCurrency = detectedCurrency;
      }
      const dedupMap = new Map<string, SearchTermImpressionShareRecord>();
      for (const item of merged) dedupMap.set(buildRowKey(item), item);
      const deduped = Array.from(dedupMap.values());

      let baseData: SearchTermImpressionShareRecord[] = [];
      if (mergeTargetId) {
        const records = await historyStore.loadRecords<SearchTermImpressionShareRecord>(mergeTargetId);
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
      toast.success(`已解析 ${deduped.length} 条展示份额数据，当前 ${finalRows.length} 条`);
    } catch (error) {
      console.error(error);
      toast.error('搜索词展示量份额报表解析失败');
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
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
      'application/vnd.ms-excel': ['.xls'],
      'text/csv': ['.csv'],
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

  const matchTypeOptions = useMemo(() => {
    const values = Array.from(new Set(rows.map((r) => r.matchType).filter(Boolean)));
    values.sort((a, b) => a.localeCompare(b, 'zh-Hans-CN'));
    return values;
  }, [rows]);

  const targetAcosValue = Math.max(1, Number(targetAcos) || 30);
  const shareThreshold = Math.max(0, Number(shareThresholdPct) || 30) / 100;
  const minDecisionClicksValue = Math.max(1, Number(minDecisionClicks) || 8);
  const minDecisionSpendValue = Math.max(0, Number(minDecisionSpend) || 5);
  const minDecisionOrdersValue = Math.max(1, Number(minDecisionOrders) || 1);
  const renderAcosBadge = (acos: number, spend: number, sales: number) => {
    const acosForColor = sales > 0 ? acos : spend > 0 ? Number.POSITIVE_INFINITY : 0;
    const acosText = sales > 0 ? `${acos.toFixed(2)}%` : spend > 0 ? '∞' : '0.00%';
    return (
      <Badge
        variant="outline"
        className={cn(
          'w-16 justify-center',
          acosForColor > targetAcosValue ? 'border-destructive text-destructive bg-destructive/10' : 'border-emerald-600 text-emerald-600 bg-emerald-50'
        )}
      >
        {acosText}
      </Badge>
    );
  };

  const baseFilteredRows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((row) => {
      if (q) {
        const haystack = `${row.customerSearchTerm} ${row.targeting} ${row.campaignName} ${row.adGroupName}`.toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      if (campaignFilter !== '全部' && row.campaignName !== campaignFilter) return false;
      if (matchTypeFilter !== '全部' && row.matchType !== matchTypeFilter) return false;
      return true;
    });
  }, [rows, query, campaignFilter, matchTypeFilter]);

  const applyMetricFilters = useCallback((list: SearchTermImpressionShareRecord[]) => {
    const minShareValue = Number(minShare);
    const maxAcosValue = Number(maxAcos);
    const maxRankValue = Number(maxRank);
    return list.filter((row) => {
      if (Number.isFinite(minShareValue) && minShareValue > 0 && row.impressionShare < minShareValue / 100) return false;
      const acosForFilter = row.sales > 0 ? row.acos : row.spend > 0 ? Number.POSITIVE_INFINITY : 0;
      if (Number.isFinite(maxAcosValue) && maxAcosValue > 0 && acosForFilter > maxAcosValue) return false;
      if (Number.isFinite(maxRankValue) && maxRankValue > 0 && row.impressionShareRank > maxRankValue) return false;
      return true;
    });
  }, [maxAcos, maxRank, minShare]);

  const displayRows = useMemo(() => {
    if (viewMode === '明细') return applyMetricFilters(baseFilteredRows);
    const map = new Map<string, SearchTermImpressionShareRecord[]>();
    for (const row of baseFilteredRows) {
      const key = row.customerSearchTerm.trim().toLowerCase();
      const list = map.get(key) ?? [];
      list.push(row);
      map.set(key, list);
    }
    const aggregated: SearchTermImpressionShareRecord[] = [];
    for (const group of map.values()) {
      const bySpend = [...group].sort((a, b) => b.spend - a.spend);
      const top = bySpend[0];
      const clicks = group.reduce((acc, row) => acc + row.clicks, 0);
      const impressions = group.reduce((acc, row) => acc + row.impressions, 0);
      const spend = group.reduce((acc, row) => acc + row.spend, 0);
      const orders = group.reduce((acc, row) => acc + row.orders, 0);
      const sales = group.reduce((acc, row) => acc + row.sales, 0);
      const weightedShare = impressions > 0 ? group.reduce((acc, row) => acc + row.impressionShare * row.impressions, 0) / impressions : top.impressionShare;
      const rank = group.reduce((acc, row) => Math.min(acc, row.impressionShareRank || Number.MAX_SAFE_INTEGER), Number.MAX_SAFE_INTEGER);
      const campaigns = new Set(group.map((row) => row.campaignName));
      const matchTypes = new Set(group.map((row) => row.matchType));
      const reasons = new Map<string, number>();
      for (const row of group) {
        const reason = row.impressionShareTopReason || '报告未提供';
        reasons.set(reason, (reasons.get(reason) ?? 0) + 1);
      }
      const topReason = Array.from(reasons.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] ?? '报告未提供';
      const startDate = group.reduce((acc, row) => (!acc || row.startDate < acc ? row.startDate : acc), group[0].startDate);
      const endDate = group.reduce((acc, row) => (!acc || row.endDate > acc ? row.endDate : acc), group[0].endDate);
      aggregated.push({
        ...top,
        id: `agg-${top.customerSearchTerm}`,
        startDate,
        endDate,
        campaignName: campaigns.size > 1 ? `（多：${campaigns.size}）${top.campaignName}` : top.campaignName,
        matchType: matchTypes.size > 1 ? `（多：${matchTypes.size}）` : top.matchType,
        impressionShare: weightedShare,
        impressionShareRank: rank === Number.MAX_SAFE_INTEGER ? 0 : rank,
        impressionShareTopReason: topReason || '报告未提供',
        clicks,
        impressions,
        spend,
        orders,
        sales,
        ctr: impressions > 0 ? clicks / impressions : 0,
        cpc: clicks > 0 ? spend / clicks : 0,
        acos: sales > 0 ? (spend / sales) * 100 : spend > 0 ? Number.POSITIVE_INFINITY : 0,
        roas: spend > 0 ? sales / spend : 0,
        conversionRate: clicks > 0 ? orders / clicks : 0,
      });
    }
    return applyMetricFilters(aggregated);
  }, [applyMetricFilters, baseFilteredRows, viewMode]);

  const analyzedRows = useMemo<AnalyzedShareRow[]>(
    () =>
      displayRows
        .map((item) => {
          const sampleQualified = item.clicks >= minDecisionClicksValue && item.spend >= minDecisionSpendValue;
          const quadrant = classifyShareQuadrant(
            item,
            shareThreshold,
            targetAcosValue,
            minDecisionClicksValue,
            minDecisionSpendValue,
            minDecisionOrdersValue
          );
          const opportunityScore =
            (1 - Math.min(1, item.impressionShare)) * 45 +
            Math.log10(1 + Math.max(0, item.sales)) * 22 +
            Math.log10(1 + Math.max(0, item.clicks)) * 15;
          return {
            ...item,
            quadrant,
            sampleQualified,
            opportunityScore,
          };
        })
        .filter((item) => (quadrantFilter === '全部' ? true : item.quadrant === quadrantFilter)),
    [displayRows, minDecisionClicksValue, minDecisionOrdersValue, minDecisionSpendValue, quadrantFilter, shareThreshold, targetAcosValue]
  );

  const summary = useMemo(() => {
    const spend = analyzedRows.reduce((acc, curr) => acc + curr.spend, 0);
    const sales = analyzedRows.reduce((acc, curr) => acc + curr.sales, 0);
    const orders = analyzedRows.reduce((acc, curr) => acc + curr.orders, 0);
    const clicks = analyzedRows.reduce((acc, curr) => acc + curr.clicks, 0);
    const impressions = analyzedRows.reduce((acc, curr) => acc + curr.impressions, 0);
    const weightedShare = impressions > 0 ? analyzedRows.reduce((acc, curr) => acc + curr.impressionShare * curr.impressions, 0) / impressions : 0;
    const acos = sales > 0 ? (spend / sales) * 100 : 0;
    const roas = spend > 0 ? sales / spend : 0;
    const ctr = impressions > 0 ? clicks / impressions : 0;
    const cpc = clicks > 0 ? spend / clicks : 0;
    const conversionRate = clicks > 0 ? orders / clicks : 0;
    return { spend, sales, orders, clicks, impressions, weightedShare, acos, roas, ctr, cpc, conversionRate };
  }, [analyzedRows]);

  const quadrantSummary = useMemo(() => {
    const map = new Map<ShareQuadrant, { count: number; spend: number; sales: number }>();
    for (const row of analyzedRows) {
      const hit = map.get(row.quadrant) ?? { count: 0, spend: 0, sales: 0 };
      hit.count += 1;
      hit.spend += row.spend;
      hit.sales += row.sales;
      map.set(row.quadrant, hit);
    }
    return (['高份额高效', '低份额高效', '高份额低效', '低份额低效'] as const).map((q) => {
      const hit = map.get(q) ?? { count: 0, spend: 0, sales: 0 };
      return { quadrant: q, ...hit };
    });
  }, [analyzedRows]);

  const opportunityRows = useMemo(
    () =>
      analyzedRows
        .filter((r) => r.quadrant === '低份额高效' && r.sampleQualified)
        .sort((a, b) => b.opportunityScore - a.opportunityScore || b.sales - a.sales)
        .slice(0, 30),
    [analyzedRows]
  );

  const costDownRows = useMemo(
    () =>
      analyzedRows
        .filter((r) => r.quadrant === '高份额低效' && r.sampleQualified)
        .sort((a, b) => b.spend - a.spend || b.acos - a.acos)
        .slice(0, 30),
    [analyzedRows]
  );

  const topShareRows = useMemo(
    () =>
      [...analyzedRows]
        .sort((a, b) => b.impressionShare - a.impressionShare || b.sales - a.sales)
        .slice(0, 12)
        .map((r) => ({ term: r.customerSearchTerm, share: Number((r.impressionShare * 100).toFixed(2)) })),
    [analyzedRows]
  );

  const sortedRows = useMemo(() => {
    const items = [...analyzedRows];
    items.sort((a, b) => {
      const readValue = (row: AnalyzedShareRow) => {
        if (sortKey === 'customerSearchTerm') return row.customerSearchTerm.toLowerCase();
        if (sortKey === 'campaignName') return row.campaignName.toLowerCase();
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
  }, [analyzedRows, sortKey, sortDirection]);

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

  if (!rows.length) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
        <div className="w-full max-w-4xl text-center space-y-6 animate-in fade-in zoom-in duration-500">
          <div className="space-y-2">
            <h1 className="text-4xl font-extrabold tracking-tight lg:text-5xl bg-clip-text text-transparent bg-gradient-to-r from-primary to-slate-800">
              搜索词展示量份额报表分析
            </h1>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
              识别“预算不足/竞价不足”导致的曝光损失，定位低份额高价值机会词。
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
              <div className="text-lg font-medium">{isLoading ? '解析中…' : '上传搜索词展示量份额报表'}</div>
              <div className="text-sm text-muted-foreground">支持 .csv / .xlsx / .xls，可批量上传</div>
            </div>
            <div className="absolute bottom-4 flex items-center gap-2 text-xs text-muted-foreground">
              <Percent className="h-3.5 w-3.5" />
              <span>支持 Amazon 商品推广搜索词展示量份额报表</span>
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
                      <span className="block max-w-[240px] truncate">{item.fileNames.join('、')}</span>
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
                            const records = await historyStore.loadRecords<SearchTermImpressionShareRecord>(item.id);
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
            <h1 className="text-2xl font-semibold tracking-tight">搜索词展示量份额报表分析</h1>
            <p className="text-sm text-muted-foreground">份额与效能双维度矩阵，快速识别进攻词、守成词与降本词。</p>
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
          <Badge variant="outline">当前视图词数：{analyzedRows.length.toLocaleString()}</Badge>
          <Badge variant="outline">视图：{viewMode}</Badge>
          {reportRange ? <Badge variant="outline">报告时间：{reportRange.minYmd} ~ {reportRange.maxYmd}（{reportRange.days} 天）</Badge> : null}
          {fileLabel ? <Badge variant="outline">文件：{fileLabel}</Badge> : null}
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Card><CardContent className="pt-6"><div className="text-xs text-muted-foreground">花费</div><div className="text-xl font-semibold">{formatMoney(summary.spend, currency)}</div></CardContent></Card>
          <Card><CardContent className="pt-6"><div className="text-xs text-muted-foreground">销售额</div><div className="text-xl font-semibold">{formatMoney(summary.sales, currency)}</div></CardContent></Card>
          <Card><CardContent className="pt-6"><div className="text-xs text-muted-foreground">订单</div><div className="text-xl font-semibold">{summary.orders.toLocaleString()}</div></CardContent></Card>
          <Card><CardContent className="pt-6"><div className="text-xs text-muted-foreground">加权份额</div><div className="text-xl font-semibold">{formatPct(summary.weightedShare)}</div></CardContent></Card>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Card><CardContent className="pt-6"><div className="text-xs text-muted-foreground">ACOS / ROAS</div><div className="text-xl font-semibold">{summary.acos.toFixed(2)}% / {summary.roas.toFixed(2)}</div></CardContent></Card>
          <Card><CardContent className="pt-6"><div className="text-xs text-muted-foreground">CTR / CVR</div><div className="text-xl font-semibold">{formatPct(summary.ctr)} / {formatPct(summary.conversionRate)}</div></CardContent></Card>
          <Card>
            <CardContent className="pt-6 space-y-2">
              <div className="text-xs text-muted-foreground">目标 ACOS(%)</div>
              <Input type="number" min={1} step="0.1" value={targetAcos} onChange={(e) => setTargetAcos(e.target.value)} />
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6 space-y-2">
              <div className="text-xs text-muted-foreground">高份额阈值(%)</div>
              <Input type="number" min={0} step="0.1" value={shareThresholdPct} onChange={(e) => setShareThresholdPct(e.target.value)} />
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardContent className="pt-6 space-y-2">
              <div className="text-xs text-muted-foreground">视图</div>
              <Select value={viewMode} onValueChange={(value) => setViewMode(value as ViewMode)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="按搜索词汇总">按搜索词汇总</SelectItem>
                  <SelectItem value="明细">明细</SelectItem>
                </SelectContent>
              </Select>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6 space-y-2">
              <div className="text-xs text-muted-foreground">样本门槛-最小点击</div>
              <Input type="number" min={1} value={minDecisionClicks} onChange={(e) => setMinDecisionClicks(e.target.value)} />
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6 space-y-2">
              <div className="text-xs text-muted-foreground">样本门槛-最小花费</div>
              <Input type="number" min={0} step="0.1" value={minDecisionSpend} onChange={(e) => setMinDecisionSpend(e.target.value)} />
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6 space-y-2">
              <div className="text-xs text-muted-foreground">样本门槛-最小订单</div>
              <Input type="number" min={1} value={minDecisionOrders} onChange={(e) => setMinDecisionOrders(e.target.value)} />
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>筛选与明细</CardTitle>
            <CardDescription>按活动、匹配类型、份额阈值、ACOS 与排名筛选</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
              <div className="space-y-1">
                <div className="text-xs text-muted-foreground">搜索词/投放/活动</div>
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
                <div className="text-xs text-muted-foreground">匹配类型</div>
                <Select value={matchTypeFilter} onValueChange={setMatchTypeFilter}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="全部">全部</SelectItem>
                    {matchTypeOptions.map((name) => <SelectItem key={name} value={name}>{name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <div className="text-xs text-muted-foreground flex items-center gap-1">
                  <span>份额象限</span>
                  <UiTooltip>
                    <UiTooltipTrigger asChild>
                      <button type="button" className="inline-flex h-4 w-4 items-center justify-center text-muted-foreground hover:text-foreground">
                        <CircleHelp className="h-3.5 w-3.5" />
                      </button>
                    </UiTooltipTrigger>
                    <UiTooltipContent side="top" align="start" className="max-w-[380px] text-xs leading-5">
                      <div>象限判定维度：展示量份额（高/低）+ 效能（高/低）。</div>
                      <div>高份额阈值：{shareThresholdPct}%；效能阈值：ACOS ≤ {targetAcosValue.toFixed(1)}%。</div>
                      <div>样本门槛：点击 ≥ {minDecisionClicksValue}、花费 ≥ {minDecisionSpendValue.toFixed(1)}、订单 ≥ {minDecisionOrdersValue}。</div>
                      <div>仅样本达标时才会判定为高效，否则归入低效侧。</div>
                    </UiTooltipContent>
                  </UiTooltip>
                </div>
                <Select value={quadrantFilter} onValueChange={(value) => setQuadrantFilter(value as '全部' | ShareQuadrant)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="全部">全部</SelectItem>
                    <SelectItem value="高份额高效">高份额高效</SelectItem>
                    <SelectItem value="低份额高效">低份额高效</SelectItem>
                    <SelectItem value="高份额低效">高份额低效</SelectItem>
                    <SelectItem value="低份额低效">低份额低效</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-5">
              <div className="space-y-1">
                <div className="text-xs text-muted-foreground">最小份额(%)</div>
                <Input type="number" min={0} step="0.1" value={minShare} onChange={(e) => setMinShare(e.target.value)} />
              </div>
              <div className="space-y-1">
                <div className="text-xs text-muted-foreground">最大 ACOS(%)</div>
                <Input type="number" min={0} step="0.1" value={maxAcos} onChange={(e) => setMaxAcos(e.target.value)} />
              </div>
              <div className="space-y-1">
                <div className="text-xs text-muted-foreground">最大份额排名</div>
                <Input type="number" min={1} value={maxRank} onChange={(e) => setMaxRank(e.target.value)} />
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
                    <TableHead><SortHeader label="搜索词" value="customerSearchTerm" /></TableHead>
                    <TableHead><SortHeader label="活动" value="campaignName" /></TableHead>
                    <TableHead className="text-right"><SortHeader label="份额" value="impressionShare" /></TableHead>
                    <TableHead className="text-right"><SortHeader label="排名" value="impressionShareRank" /></TableHead>
                    <TableHead className="text-right"><SortHeader label="花费" value="spend" /></TableHead>
                    <TableHead className="text-right"><SortHeader label="销售" value="sales" /></TableHead>
                    <TableHead className="text-right"><SortHeader label="ACOS" value="acos" /></TableHead>
                    <TableHead className="text-right"><SortHeader label="点击" value="clicks" /></TableHead>
                    <TableHead className="text-right"><SortHeader label="订单" value="orders" /></TableHead>
                    <TableHead>
                      <span className="inline-flex items-center gap-1">
                        <span>象限</span>
                        <UiTooltip>
                          <UiTooltipTrigger asChild>
                            <button type="button" className="inline-flex h-4 w-4 items-center justify-center text-muted-foreground hover:text-foreground">
                              <CircleHelp className="h-3.5 w-3.5" />
                            </button>
                          </UiTooltipTrigger>
                          <UiTooltipContent side="top" align="start" className="max-w-[380px] text-xs leading-5">
                            <div>高份额高效：份额高 + ACOS达标 + 样本达标。</div>
                            <div>低份额高效：份额低 + ACOS达标 + 样本达标。</div>
                            <div>高份额低效：份额高但ACOS不达标或样本不足。</div>
                            <div>低份额低效：份额低且ACOS不达标或样本不足。</div>
                          </UiTooltipContent>
                        </UiTooltip>
                      </span>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tableRows.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell className="max-w-[320px] truncate">{row.customerSearchTerm}</TableCell>
                      <TableCell className="max-w-[260px] truncate">{row.campaignName}</TableCell>
                      <TableCell className="text-right">{formatPct(row.impressionShare)}</TableCell>
                      <TableCell className="text-right">{row.impressionShareRank.toLocaleString()}</TableCell>
                      <TableCell className="text-right">{formatMoney(row.spend, currency)}</TableCell>
                      <TableCell className="text-right">{formatMoney(row.sales, currency)}</TableCell>
                      <TableCell className="text-right">{renderAcosBadge(row.acos, row.spend, row.sales)}</TableCell>
                      <TableCell className="text-right">{row.clicks.toLocaleString()}</TableCell>
                      <TableCell className="text-right">{row.orders.toLocaleString()}</TableCell>
                      <TableCell>{row.quadrant}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>份额矩阵与机会词</CardTitle>
            <CardDescription>低份额高效 = 优先扩量；高份额低效 = 优先降本</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 lg:grid-cols-2">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">份额-效能四象限数量</CardTitle>
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
                        <Bar dataKey="count" name="搜索词数" fill="#4f46e5" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">份额 Top12</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-[280px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={topShareRows}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="term" hide />
                        <YAxis />
                        <Tooltip />
                        <Legend />
                        <Bar dataKey="share" name="份额(%)" fill="#06b6d4" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>机会搜索词</TableHead>
                    <TableHead>匹配类型</TableHead>
                    <TableHead className="text-right">份额</TableHead>
                    <TableHead className="text-right">排名</TableHead>
                    <TableHead className="text-right">销售额</TableHead>
                    <TableHead className="text-right">ACOS</TableHead>
                    <TableHead className="text-right">
                      <span className="inline-flex items-center justify-end gap-1">
                        <span>机会分</span>
                        <UiTooltip>
                          <UiTooltipTrigger asChild>
                            <button type="button" className="inline-flex h-4 w-4 items-center justify-center text-muted-foreground hover:text-foreground">
                              <CircleHelp className="h-3.5 w-3.5" />
                            </button>
                          </UiTooltipTrigger>
                          <UiTooltipContent side="top" align="end" className="max-w-[420px] text-xs leading-5">
                            <div>机会分用于“低份额高效词”的排序，分越高优先级越高。</div>
                            <div>计算方式：份额缺口权重 + 销售规模权重 + 点击样本权重。</div>
                            <div>公式：机会分 = (1-份额)×45 + log10(1+销售额)×22 + log10(1+点击量)×15。</div>
                            <div>解读：份额越低、销售越高、点击样本越足，机会分越高。</div>
                          </UiTooltipContent>
                        </UiTooltip>
                      </span>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {opportunityRows.map((row) => (
                    <TableRow key={`${row.id}-opp`}>
                      <TableCell className="max-w-[300px] truncate">{row.customerSearchTerm}</TableCell>
                      <TableCell>{row.matchType}</TableCell>
                      <TableCell className="text-right">{formatPct(row.impressionShare)}</TableCell>
                      <TableCell className="text-right">{row.impressionShareRank.toLocaleString()}</TableCell>
                      <TableCell className="text-right">{formatMoney(row.sales, currency)}</TableCell>
                      <TableCell className="text-right">{renderAcosBadge(row.acos, row.spend, row.sales)}</TableCell>
                      <TableCell className="text-right">{row.opportunityScore.toFixed(1)}</TableCell>
                    </TableRow>
                  ))}
                  {!opportunityRows.length ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center text-sm text-muted-foreground py-6">
                        暂无机会词，请放宽筛选或降低样本门槛
                      </TableCell>
                    </TableRow>
                  ) : null}
                </TableBody>
              </Table>
            </div>

            <div className="overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>降本搜索词</TableHead>
                    <TableHead>匹配类型</TableHead>
                    <TableHead className="text-right">份额</TableHead>
                    <TableHead className="text-right">花费</TableHead>
                    <TableHead className="text-right">ACOS</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {costDownRows.map((row) => (
                    <TableRow key={`${row.id}-down`}>
                      <TableCell className="max-w-[300px] truncate">{row.customerSearchTerm}</TableCell>
                      <TableCell>{row.matchType}</TableCell>
                      <TableCell className="text-right">{formatPct(row.impressionShare)}</TableCell>
                      <TableCell className="text-right">{formatMoney(row.spend, currency)}</TableCell>
                      <TableCell className="text-right">{renderAcosBadge(row.acos, row.spend, row.sales)}</TableCell>
                    </TableRow>
                  ))}
                  {!costDownRows.length ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-sm text-muted-foreground py-6">
                        暂无高份额低效词
                      </TableCell>
                    </TableRow>
                  ) : null}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
