import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowDown, ArrowLeft, ArrowUp, ArrowUpDown, CircleHelp, Download, Loader2, Upload, Wallet } from 'lucide-react';
import { useDropzone } from 'react-dropzone';
import { Link } from 'wouter';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';
import { parseBudgetReport, type BudgetRecord } from '@/lib/report-parsers';
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
  | 'status'
  | 'budget'
  | 'avgDailySpend'
  | 'budgetUsageRate'
  | 'budgetInRangeRate'
  | 'spend'
  | 'sales'
  | 'orders'
  | 'missedSalesMax'
  | 'acos'
  | 'roas';

type UsageBucket = '紧急受限' | '轻度受限' | '合理' | '预算过剩';
type ProductStage = '新品' | '成熟';

export default function BudgetReportPage() {
  const historyStore = useMemo(() => createUploadHistoryStore('budget-upload'), []);
  const [rows, setRows] = useState<BudgetRecord[]>([]);
  const [fileLabel, setFileLabel] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [currency, setCurrency] = useState('USD');
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('全部');
  const [bucketFilter, setBucketFilter] = useState<'全部' | UsageBucket>('全部');
  const [minUsageRate, setMinUsageRate] = useState('');
  const [maxUsageRate, setMaxUsageRate] = useState('');
  const [minLostSales, setMinLostSales] = useState('');
  const [productStage, setProductStage] = useState<ProductStage>('成熟');
  const [urgentUsagePct, setUrgentUsagePct] = useState('95');
  const [mildUsagePct, setMildUsagePct] = useState('80');
  const [reasonableUsagePct, setReasonableUsagePct] = useState('50');
  const [priorityMinClicks, setPriorityMinClicks] = useState('20');
  const [recipientMaxAcos, setRecipientMaxAcos] = useState('30');
  const [donorMinAcos, setDonorMinAcos] = useState('40');
  const [observeMinUsagePct, setObserveMinUsagePct] = useState('80');
  const [observeMaxUsagePct, setObserveMaxUsagePct] = useState('95');
  const [shrinkMaxUsagePct, setShrinkMaxUsagePct] = useState('50');
  const [shrinkMaxAcos, setShrinkMaxAcos] = useState('35');
  const [sortKey, setSortKey] = useState<SortKey>('budgetUsageRate');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [tableLimit, setTableLimit] = useState('120');
  const [historyItems, setHistoryItems] = useState<HistoryMeta[]>([]);
  const [mergeEnabled, setMergeEnabled] = useState(true);
  const [mergeTargetId, setMergeTargetId] = useState<string | null>(null);
  const historyItemsRef = useRef<HistoryMeta[]>([]);

  const buildRowKey = (row: BudgetRecord) =>
    [row.startDate, row.endDate, row.campaignName, row.status, row.targetingType].join('|').toLowerCase();

  const mergeRecords = (base: BudgetRecord[], incoming: BudgetRecord[]) => {
    const map = new Map<string, BudgetRecord>();
    for (const row of base) map.set(buildRowKey(row), row);
    for (const row of incoming) map.set(buildRowKey(row), row);
    return Array.from(map.values());
  };

  const getRangeSummary = (items: BudgetRecord[]) => {
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
      setUrgentUsagePct('95');
      setMildUsagePct('80');
      setReasonableUsagePct('50');
      setPriorityMinClicks('12');
      setRecipientMaxAcos('40');
      setDonorMinAcos('50');
      setObserveMinUsagePct('80');
      setObserveMaxUsagePct('95');
      setShrinkMaxUsagePct('45');
      setShrinkMaxAcos('40');
      return;
    }
    setUrgentUsagePct('95');
    setMildUsagePct('80');
    setReasonableUsagePct('50');
    setPriorityMinClicks('20');
    setRecipientMaxAcos('30');
    setDonorMinAcos('40');
    setObserveMinUsagePct('80');
    setObserveMaxUsagePct('95');
    setShrinkMaxUsagePct('50');
    setShrinkMaxAcos('35');
  }, [productStage]);

  const resetFilters = () => {
    setQuery('');
    setStatusFilter('全部');
    setBucketFilter('全部');
    setMinUsageRate('');
    setMaxUsageRate('');
    setMinLostSales('');
    setSortKey('budgetUsageRate');
    setSortDirection('desc');
  };

  const resetAll = () => {
    setRows([]);
    setFileLabel('');
    setCurrency('USD');
    setProductStage('成熟');
    setTableLimit('120');
    resetFilters();
  };

  const onDrop = async (files: File[]) => {
    if (!files.length) return;
    setIsLoading(true);
    try {
      let merged: BudgetRecord[] = [];
      let nextCurrency: string | null = null;
      for (const file of files) {
        const { records, currency: detectedCurrency } = await parseBudgetReport(file);
        merged = merged.concat(records);
        if (!nextCurrency && detectedCurrency) nextCurrency = detectedCurrency;
      }
      const dedupMap = new Map<string, BudgetRecord>();
      for (const item of merged) dedupMap.set(buildRowKey(item), item);
      const deduped = Array.from(dedupMap.values());

      let baseData: BudgetRecord[] = [];
      if (mergeTargetId) {
        const records = await historyStore.loadRecords<BudgetRecord>(mergeTargetId);
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
      toast.success(`已解析 ${deduped.length} 条预算数据，当前 ${finalRows.length} 条`);
    } catch (error) {
      console.error(error);
      toast.error('预算报表解析失败');
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

  const urgentUsageValue = Math.max(1, Number(urgentUsagePct) || 95) / 100;
  const mildUsageValue = Math.max(1, Number(mildUsagePct) || 80) / 100;
  const reasonableUsageValue = Math.max(1, Number(reasonableUsagePct) || 50) / 100;
  const priorityMinClicksValue = Math.max(1, Number(priorityMinClicks) || 20);
  const recipientMaxAcosValue = Math.max(1, Number(recipientMaxAcos) || 30);
  const donorMinAcosValue = Math.max(1, Number(donorMinAcos) || 40);
  const observeMinUsageValue = Math.max(1, Number(observeMinUsagePct) || 80) / 100;
  const observeMaxUsageValue = Math.max(1, Number(observeMaxUsagePct) || 95) / 100;
  const shrinkMaxUsageValue = Math.max(1, Number(shrinkMaxUsagePct) || 50) / 100;
  const shrinkMaxAcosValue = Math.max(1, Number(shrinkMaxAcos) || 35);

  const classifyUsageBucket = useCallback(
    (rate: number): UsageBucket => {
      if (rate > urgentUsageValue) return '紧急受限';
      if (rate >= mildUsageValue) return '轻度受限';
      if (rate >= reasonableUsageValue) return '合理';
      return '预算过剩';
    },
    [urgentUsageValue, mildUsageValue, reasonableUsageValue]
  );

  const filteredRows = useMemo(() => {
    const q = query.trim().toLowerCase();
    const minUsage = Number(minUsageRate) / 100;
    const maxUsage = Number(maxUsageRate) / 100;
    const minLost = Number(minLostSales);
    return rows.filter((row) => {
      if (q) {
        const haystack = `${row.campaignName} ${row.status} ${row.targetingType}`.toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      if (statusFilter !== '全部' && row.status.toUpperCase() !== statusFilter) return false;
      const bucket = classifyUsageBucket(row.budgetUsageRate);
      if (bucketFilter !== '全部' && bucket !== bucketFilter) return false;
      if (Number.isFinite(minUsage) && minUsage > 0 && row.budgetUsageRate < minUsage) return false;
      if (Number.isFinite(maxUsage) && maxUsage > 0 && row.budgetUsageRate > maxUsage) return false;
      if (Number.isFinite(minLost) && minLost > 0 && row.estimatedLostSalesMid < minLost) return false;
      return true;
    });
  }, [rows, query, statusFilter, bucketFilter, minUsageRate, maxUsageRate, minLostSales, classifyUsageBucket]);

  const summary = useMemo(() => {
    const spend = filteredRows.reduce((acc, curr) => acc + curr.spend, 0);
    const sales = filteredRows.reduce((acc, curr) => acc + curr.sales, 0);
    const orders = filteredRows.reduce((acc, curr) => acc + curr.orders, 0);
    const budget = filteredRows.reduce((acc, curr) => acc + curr.budget, 0);
    const avgDailySpend = filteredRows.reduce((acc, curr) => acc + curr.avgDailySpend, 0);
    const lostSalesMid = filteredRows.reduce((acc, curr) => acc + curr.estimatedLostSalesMid, 0);
    const acos = sales > 0 ? (spend / sales) * 100 : 0;
    const roas = spend > 0 ? sales / spend : 0;
    const budgetUsageRate = budget > 0 ? avgDailySpend / budget : 0;
    return { spend, sales, orders, budget, avgDailySpend, lostSalesMid, acos, roas, budgetUsageRate };
  }, [filteredRows]);

  const usageSummary = useMemo(() => {
    const buckets: Record<UsageBucket, number> = { 紧急受限: 0, 轻度受限: 0, 合理: 0, 预算过剩: 0 };
    for (const row of filteredRows) buckets[classifyUsageBucket(row.budgetUsageRate)] += 1;
    return buckets;
  }, [filteredRows, classifyUsageBucket]);

  const chartData = useMemo(() => {
    return [
      { name: '紧急受限', count: usageSummary['紧急受限'] },
      { name: '轻度受限', count: usageSummary['轻度受限'] },
      { name: '合理', count: usageSummary['合理'] },
      { name: '预算过剩', count: usageSummary['预算过剩'] },
    ];
  }, [usageSummary]);

  const priorityRows = useMemo(
    () =>
      [...filteredRows]
        .filter((r) => (r.budgetUsageRate > urgentUsageValue && r.clicks >= priorityMinClicksValue) || r.estimatedLostSalesMid > 0)
        .sort((a, b) => b.estimatedLostSalesMid - a.estimatedLostSalesMid || b.budgetUsageRate - a.budgetUsageRate)
        .slice(0, 20),
    [filteredRows, urgentUsageValue, priorityMinClicksValue]
  );

  const migrationRows = useMemo(() => {
    const source = filteredRows
      .filter((r) => classifyUsageBucket(r.budgetUsageRate) === '预算过剩' && r.acos >= donorMinAcosValue)
      .map((r) => ({ ...r, type: '可削减' as const }))
      .slice(0, 10);
    const target = filteredRows
      .filter((r) => classifyUsageBucket(r.budgetUsageRate) === '紧急受限' && r.clicks >= priorityMinClicksValue && r.acos > 0 && r.acos <= recipientMaxAcosValue)
      .map((r) => ({ ...r, type: '建议加预算' as const }))
      .slice(0, 10);
    return [...target, ...source];
  }, [filteredRows, classifyUsageBucket, donorMinAcosValue, priorityMinClicksValue, recipientMaxAcosValue]);

  const observeRows = useMemo(
    () =>
      filteredRows
        .filter((r) => r.orders <= 0 && r.budgetUsageRate >= observeMinUsageValue && r.budgetUsageRate < observeMaxUsageValue)
        .sort((a, b) => b.budgetUsageRate - a.budgetUsageRate || b.clicks - a.clicks)
        .slice(0, 20),
    [filteredRows, observeMaxUsageValue, observeMinUsageValue]
  );

  const shrinkRows = useMemo(
    () =>
      filteredRows
        .filter((r) => r.sales <= 0 && r.budgetUsageRate <= shrinkMaxUsageValue && (r.acos === 0 || r.acos >= shrinkMaxAcosValue))
        .sort((a, b) => a.budgetUsageRate - b.budgetUsageRate || a.spend - b.spend)
        .slice(0, 20),
    [filteredRows, shrinkMaxAcosValue, shrinkMaxUsageValue]
  );

  const sortedRows = useMemo(() => {
    const items = [...filteredRows];
    items.sort((a, b) => {
      const readValue = (row: BudgetRecord) => {
        if (sortKey === 'campaignName') return row.campaignName.toLowerCase();
        if (sortKey === 'status') return row.status.toLowerCase();
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

  const usageBadge = (rate: number) => {
    const bucket = classifyUsageBucket(rate);
    const cls =
      bucket === '紧急受限'
        ? 'border-destructive text-destructive bg-destructive/10'
        : bucket === '轻度受限'
          ? 'border-amber-600 text-amber-700 bg-amber-50'
          : bucket === '预算过剩'
            ? 'border-slate-500 text-slate-600 bg-slate-50'
            : 'border-emerald-600 text-emerald-600 bg-emerald-50';
    return <Badge variant="outline" className={cn('w-20 justify-center', cls)}>{formatPct(rate)}</Badge>;
  };

  const exportDecision = () => {
    const wb = XLSX.utils.book_new();
    const prioritySheet = priorityRows.map((r) => ({
      活动: r.campaignName,
      状态: r.status,
      日预算: Number(r.budget.toFixed(2)),
      平均日花费: Number(r.avgDailySpend.toFixed(2)),
      预算使用率百分比: Number((r.budgetUsageRate * 100).toFixed(2)),
      预计错失销售中位数: Number(r.estimatedLostSalesMid.toFixed(2)),
      建议: r.budgetUsageRate > urgentUsageValue ? '预算提高 50%-100%' : '预算提高 20%-30%',
    }));
    const migrationSheet = migrationRows.map((r) => ({
      活动: r.campaignName,
      类型: r.type,
      日预算: Number(r.budget.toFixed(2)),
      平均日花费: Number(r.avgDailySpend.toFixed(2)),
      预算使用率百分比: Number((r.budgetUsageRate * 100).toFixed(2)),
      ACOS百分比: Number(r.acos.toFixed(2)),
      建议动作: r.type === '建议加预算' ? '增加预算并保持竞价' : '削减预算并迁移至高效活动',
    }));
    const observeSheet = observeRows.map((r) => ({
      活动: r.campaignName,
      状态: r.status,
      日预算: Number(r.budget.toFixed(2)),
      平均日花费: Number(r.avgDailySpend.toFixed(2)),
      点击: r.clicks,
      订单: r.orders,
      预算使用率百分比: Number((r.budgetUsageRate * 100).toFixed(2)),
      建议动作: '暂不调整预算，观察3-7天',
    }));
    const shrinkSheet = shrinkRows.map((r) => ({
      活动: r.campaignName,
      状态: r.status,
      日预算: Number(r.budget.toFixed(2)),
      平均日花费: Number(r.avgDailySpend.toFixed(2)),
      预算使用率百分比: Number((r.budgetUsageRate * 100).toFixed(2)),
      ACOS百分比: Number(r.acos.toFixed(2)),
      建议动作: '预算下调 20%-50% 或合并活动',
    }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(prioritySheet), '预算优先级');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(migrationSheet), '预算迁移建议');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(observeSheet), '预算观察池');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(shrinkSheet), '预算收缩池');
    XLSX.writeFile(wb, `预算分析决策-${Date.now()}.xlsx`);
    toast.success('已导出预算分析决策清单');
  };

  if (!rows.length) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
        <div className="w-full max-w-4xl text-center space-y-6 animate-in fade-in zoom-in duration-500">
          <div className="space-y-2">
            <h1 className="text-4xl font-extrabold tracking-tight lg:text-5xl bg-clip-text text-transparent bg-gradient-to-r from-primary to-slate-800">
              预算报表分析
            </h1>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
              识别预算不足与预算闲置问题，量化机会损失并生成预算迁移建议。
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
              <div className="text-lg font-medium">{isLoading ? '解析中…' : '上传预算报表'}</div>
              <div className="text-sm text-muted-foreground">支持 .csv / .xlsx / .xls，可批量上传</div>
            </div>
            <div className="absolute bottom-4 flex items-center gap-2 text-xs text-muted-foreground">
              <Wallet className="h-3.5 w-3.5" />
              <span>支持 Amazon 商品推广预算报表</span>
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
                            const records = await historyStore.loadRecords<BudgetRecord>(item.id);
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
            <h1 className="text-2xl font-semibold tracking-tight">预算报表分析</h1>
            <p className="text-sm text-muted-foreground">识别预算缺口与浪费，执行预算迁移与提效策略。</p>
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
          <Card><CardContent className="pt-6"><div className="text-xs text-muted-foreground">总预算</div><div className="text-xl font-semibold">{formatMoney(summary.budget, currency)}</div></CardContent></Card>
          <Card><CardContent className="pt-6"><div className="text-xs text-muted-foreground">总花费</div><div className="text-xl font-semibold">{formatMoney(summary.spend, currency)}</div></CardContent></Card>
          <Card><CardContent className="pt-6"><div className="text-xs text-muted-foreground">预算使用率</div><div className="text-xl font-semibold">{formatPct(summary.budgetUsageRate)}</div></CardContent></Card>
          <Card><CardContent className="pt-6"><div className="text-xs text-muted-foreground">预计错失销售（中位）</div><div className="text-xl font-semibold">{formatMoney(summary.lostSalesMid, currency)}</div></CardContent></Card>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Card><CardContent className="pt-6"><div className="text-xs text-muted-foreground">销售额</div><div className="text-xl font-semibold">{formatMoney(summary.sales, currency)}</div></CardContent></Card>
          <Card><CardContent className="pt-6"><div className="text-xs text-muted-foreground">订单</div><div className="text-xl font-semibold">{summary.orders.toLocaleString()}</div></CardContent></Card>
          <Card><CardContent className="pt-6"><div className="text-xs text-muted-foreground">ACOS / ROAS</div><div className="text-xl font-semibold">{summary.acos.toFixed(2)}% / {summary.roas.toFixed(2)}</div></CardContent></Card>
          <Card><CardContent className="pt-6"><div className="text-xs text-muted-foreground">日均花费</div><div className="text-xl font-semibold">{formatMoney(summary.avgDailySpend, currency)}</div></CardContent></Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>预算诊断分布</CardTitle>
            <CardDescription>按预算使用率分层，快速识别紧急受限与预算闲置活动</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="count" name="活动数" fill="#4f46e5" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>筛选与明细</CardTitle>
            <CardDescription>支持预算使用率、预计错失销售筛选与字段排序</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
              <div className="space-y-1">
                <div className="text-xs text-muted-foreground">搜索活动名</div>
                <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="输入关键字" />
              </div>
              <div className="space-y-1">
                <div className="text-xs text-muted-foreground">状态</div>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="全部">全部</SelectItem>
                    <SelectItem value="ENABLED">ENABLED</SelectItem>
                    <SelectItem value="PAUSED">PAUSED</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <div className="text-xs text-muted-foreground">预算诊断</div>
                <Select value={bucketFilter} onValueChange={(value) => setBucketFilter(value as '全部' | UsageBucket)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="全部">全部</SelectItem>
                    <SelectItem value="紧急受限">紧急受限</SelectItem>
                    <SelectItem value="轻度受限">轻度受限</SelectItem>
                    <SelectItem value="合理">合理</SelectItem>
                    <SelectItem value="预算过剩">预算过剩</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <div className="text-xs text-muted-foreground">最小预计错失销售</div>
                <Input type="number" min={0} step="0.1" value={minLostSales} onChange={(e) => setMinLostSales(e.target.value)} />
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
              <div className="space-y-1">
                <div className="text-xs text-muted-foreground">最小预算使用率(%)</div>
                <Input type="number" min={0} step="0.1" value={minUsageRate} onChange={(e) => setMinUsageRate(e.target.value)} />
              </div>
              <div className="space-y-1">
                <div className="text-xs text-muted-foreground">最大预算使用率(%)</div>
                <Input type="number" min={0} step="0.1" value={maxUsageRate} onChange={(e) => setMaxUsageRate(e.target.value)} />
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
                    <TableHead><SortHeader label="状态" value="status" /></TableHead>
                    <TableHead className="text-right"><SortHeader label="预算" value="budget" /></TableHead>
                    <TableHead className="text-right"><SortHeader label="日均花费" value="avgDailySpend" /></TableHead>
                    <TableHead className="text-right"><SortHeader label="预算使用率" value="budgetUsageRate" /></TableHead>
                    <TableHead className="text-right"><SortHeader label="预算内时间" value="budgetInRangeRate" /></TableHead>
                    <TableHead className="text-right"><SortHeader label="花费" value="spend" /></TableHead>
                    <TableHead className="text-right"><SortHeader label="销售" value="sales" /></TableHead>
                    <TableHead className="text-right"><SortHeader label="预计错失销售上限" value="missedSalesMax" /></TableHead>
                    <TableHead className="text-right"><SortHeader label="ACOS" value="acos" /></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tableRows.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell className="max-w-[300px] truncate" title={row.campaignName}>{row.campaignName}</TableCell>
                      <TableCell>{row.status}</TableCell>
                      <TableCell className="text-right">{formatMoney(row.budget, currency)}</TableCell>
                      <TableCell className="text-right">{formatMoney(row.avgDailySpend, currency)}</TableCell>
                      <TableCell className="text-right">{usageBadge(row.budgetUsageRate)}</TableCell>
                      <TableCell className="text-right">{formatPct(row.budgetInRangeRate)}</TableCell>
                      <TableCell className="text-right">{formatMoney(row.spend, currency)}</TableCell>
                      <TableCell className="text-right">{formatMoney(row.sales, currency)}</TableCell>
                      <TableCell className="text-right">{formatMoney(row.missedSalesMax, currency)}</TableCell>
                      <TableCell className="text-right">{row.acos.toFixed(2)}%</TableCell>
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
              <span>预算动作建议</span>
              <UiTooltip>
                <UiTooltipTrigger asChild>
                  <button type="button" className="inline-flex h-5 w-5 items-center justify-center text-muted-foreground hover:text-foreground">
                    <CircleHelp className="h-4 w-4" />
                  </button>
                </UiTooltipTrigger>
                <UiTooltipContent side="top" align="start" className="max-w-[420px] text-xs leading-5">
                  <div>高优先级：预算使用率超过紧急阈值，且点击达到样本门槛，或已出现预计错失销售。</div>
                  <div>预算迁移：将预算过剩且高ACOS活动预算迁移到受限且低ACOS活动。</div>
                  <div>观察池：使用率较高但无订单，先观察3-7天再调整。</div>
                  <div>收缩池：低使用率且无销售活动，建议降预算或并入同类活动。</div>
                </UiTooltipContent>
              </UiTooltip>
            </CardTitle>
            <CardDescription>按“增预算/迁移/观察/收缩”四类输出执行清单</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <Button className="gap-2" onClick={exportDecision}>
                <Download className="h-4 w-4" />
                一键导出预算决策 Excel
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
                <div className="text-xs text-muted-foreground">紧急阈值(%)</div>
                <Input type="number" min={1} step="0.1" value={urgentUsagePct} onChange={(e) => setUrgentUsagePct(e.target.value)} />
              </div>
              <div className="space-y-1">
                <div className="text-xs text-muted-foreground">轻度阈值(%)</div>
                <Input type="number" min={1} step="0.1" value={mildUsagePct} onChange={(e) => setMildUsagePct(e.target.value)} />
              </div>
              <div className="space-y-1">
                <div className="text-xs text-muted-foreground">合理阈值(%)</div>
                <Input type="number" min={1} step="0.1" value={reasonableUsagePct} onChange={(e) => setReasonableUsagePct(e.target.value)} />
              </div>
              <div className="space-y-1">
                <div className="text-xs text-muted-foreground">优先提升最小点击</div>
                <Input type="number" min={1} value={priorityMinClicks} onChange={(e) => setPriorityMinClicks(e.target.value)} />
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-6">
              <div className="space-y-1">
                <div className="text-xs text-muted-foreground">受限活动最大ACOS(%)</div>
                <Input type="number" min={1} step="0.1" value={recipientMaxAcos} onChange={(e) => setRecipientMaxAcos(e.target.value)} />
              </div>
              <div className="space-y-1">
                <div className="text-xs text-muted-foreground">过剩活动最小ACOS(%)</div>
                <Input type="number" min={1} step="0.1" value={donorMinAcos} onChange={(e) => setDonorMinAcos(e.target.value)} />
              </div>
              <div className="space-y-1">
                <div className="text-xs text-muted-foreground">观察最小使用率(%)</div>
                <Input type="number" min={1} step="0.1" value={observeMinUsagePct} onChange={(e) => setObserveMinUsagePct(e.target.value)} />
              </div>
              <div className="space-y-1">
                <div className="text-xs text-muted-foreground">观察最大使用率(%)</div>
                <Input type="number" min={1} step="0.1" value={observeMaxUsagePct} onChange={(e) => setObserveMaxUsagePct(e.target.value)} />
              </div>
              <div className="space-y-1">
                <div className="text-xs text-muted-foreground">收缩最大使用率(%)</div>
                <Input type="number" min={1} step="0.1" value={shrinkMaxUsagePct} onChange={(e) => setShrinkMaxUsagePct(e.target.value)} />
              </div>
              <div className="space-y-1">
                <div className="text-xs text-muted-foreground">收缩最小ACOS(%)</div>
                <Input type="number" min={1} step="0.1" value={shrinkMaxAcos} onChange={(e) => setShrinkMaxAcos(e.target.value)} />
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
              <Card><CardContent className="pt-6"><div className="text-xs text-muted-foreground">优先提升</div><div className="text-xl font-semibold">{priorityRows.length.toLocaleString()}</div></CardContent></Card>
              <Card><CardContent className="pt-6"><div className="text-xs text-muted-foreground">预算迁移</div><div className="text-xl font-semibold">{migrationRows.length.toLocaleString()}</div></CardContent></Card>
              <Card><CardContent className="pt-6"><div className="text-xs text-muted-foreground">观察池</div><div className="text-xl font-semibold">{observeRows.length.toLocaleString()}</div></CardContent></Card>
              <Card><CardContent className="pt-6"><div className="text-xs text-muted-foreground">收缩池</div><div className="text-xl font-semibold">{shrinkRows.length.toLocaleString()}</div></CardContent></Card>
            </div>

            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">预算优先提升活动</CardTitle>
                  <CardDescription>预算受限且存在潜在销售损失</CardDescription>
                </CardHeader>
                <CardContent className="space-y-2">
                  {priorityRows.length ? priorityRows.map((row) => (
                    <div key={row.id} className="rounded-md border p-2 text-xs space-y-1">
                      <div className="font-medium truncate" title={row.campaignName}>{row.campaignName}</div>
                      <div>预算使用率 {formatPct(row.budgetUsageRate)} · 预计错失销售中位 {formatMoney(row.estimatedLostSalesMid, currency)}</div>
                    </div>
                  )) : <div className="text-sm text-muted-foreground">暂无符合条件的数据</div>}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">预算迁移清单</CardTitle>
                  <CardDescription>从低效预算过剩活动迁移到高效受限活动</CardDescription>
                </CardHeader>
                <CardContent className="space-y-2">
                  {migrationRows.length ? migrationRows.map((row) => (
                    <div key={`${row.id}-${row.type}`} className="rounded-md border p-2 text-xs space-y-1">
                      <div className="font-medium truncate" title={row.campaignName}>{row.campaignName}</div>
                      <div>{row.type} · 使用率 {formatPct(row.budgetUsageRate)} · ACOS {row.acos.toFixed(2)}%</div>
                    </div>
                  )) : <div className="text-sm text-muted-foreground">暂无符合条件的数据</div>}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">预算观察池</CardTitle>
                  <CardDescription>预算使用率较高但暂无订单，先观察</CardDescription>
                </CardHeader>
                <CardContent className="space-y-2">
                  {observeRows.length ? observeRows.map((row) => (
                    <div key={`${row.id}-observe`} className="rounded-md border p-2 text-xs space-y-1">
                      <div className="font-medium truncate" title={row.campaignName}>{row.campaignName}</div>
                      <div>使用率 {formatPct(row.budgetUsageRate)} · 点击 {row.clicks} · 订单 {row.orders}</div>
                    </div>
                  )) : <div className="text-sm text-muted-foreground">暂无符合条件的数据</div>}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">预算收缩池</CardTitle>
                  <CardDescription>低利用且无销售活动，建议降预算或合并</CardDescription>
                </CardHeader>
                <CardContent className="space-y-2">
                  {shrinkRows.length ? shrinkRows.map((row) => (
                    <div key={`${row.id}-shrink`} className="rounded-md border p-2 text-xs space-y-1">
                      <div className="font-medium truncate" title={row.campaignName}>{row.campaignName}</div>
                      <div>使用率 {formatPct(row.budgetUsageRate)} · 花费 {formatMoney(row.spend, currency)} · 销售 {formatMoney(row.sales, currency)}</div>
                    </div>
                  )) : <div className="text-sm text-muted-foreground">暂无符合条件的数据</div>}
                </CardContent>
              </Card>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
