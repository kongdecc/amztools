import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowDown, ArrowLeft, ArrowUp, ArrowUpDown, CircleHelp, Download, FileSpreadsheet, Loader2, Upload } from 'lucide-react';
import { useDropzone } from 'react-dropzone';
import { Link } from 'wouter';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';
import { parseCampaignReport, type CampaignRecord } from '@/lib/report-parsers';
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

function formatMoney(value: number, currency: string) {
  return new Intl.NumberFormat('zh-CN', { style: 'currency', currency, maximumFractionDigits: 2 }).format(value);
}

function formatPct(value: number) {
  return `${(value * 100).toFixed(2)}%`;
}

type SortKey =
  | 'campaignName'
  | 'status'
  | 'campaignType'
  | 'targetingType'
  | 'biddingStrategy'
  | 'budget'
  | 'impressions'
  | 'clicks'
  | 'spend'
  | 'sales'
  | 'orders'
  | 'ctr'
  | 'cpc'
  | 'acos'
  | 'roas';

type StatusFilter = '全部' | 'ENABLED' | 'PAUSED';
type ProductStage = '新品' | '成熟';
type DecisionCampaignRow = CampaignRecord & { days: number; budgetUse: number; acosForDecision: number };

export default function CampaignReportPage() {
  const historyStore = useMemo(() => createUploadHistoryStore('campaign-upload'), []);
  const [rows, setRows] = useState<CampaignRecord[]>([]);
  const [fileLabel, setFileLabel] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [currency, setCurrency] = useState('USD');
  const [targetAcos, setTargetAcos] = useState('30');
  const [productStage, setProductStage] = useState<ProductStage>('成熟');
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('全部');
  const [campaignTypeFilter, setCampaignTypeFilter] = useState('全部');
  const [targetingTypeFilter, setTargetingTypeFilter] = useState('全部');
  const [biddingFilter, setBiddingFilter] = useState('全部');
  const [minSpend, setMinSpend] = useState('');
  const [minOrders, setMinOrders] = useState('');
  const [maxAcos, setMaxAcos] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('spend');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [tableLimit, setTableLimit] = useState('120');
  const [problemSpendThreshold, setProblemSpendThreshold] = useState('20');
  const [starMinClicks, setStarMinClicks] = useState('20');
  const [starMinOrders, setStarMinOrders] = useState('3');
  const [highAcosFactor, setHighAcosFactor] = useState('1.8');
  const [highAcosMinClicks, setHighAcosMinClicks] = useState('20');
  const [observeMaxClicks, setObserveMaxClicks] = useState('10');
  const [cleanupMaxSpend, setCleanupMaxSpend] = useState('2');
  const [cleanupMaxBudgetUsePct, setCleanupMaxBudgetUsePct] = useState('5');
  const [historyItems, setHistoryItems] = useState<HistoryMeta[]>([]);
  const [mergeEnabled, setMergeEnabled] = useState(true);
  const [mergeTargetId, setMergeTargetId] = useState<string | null>(null);
  const historyItemsRef = useRef<HistoryMeta[]>([]);

  const buildRowKey = (row: CampaignRecord) =>
    [row.startDate, row.endDate, row.campaignName, row.campaignType, row.targetingType].join('|').toLowerCase();

  const mergeRecords = (base: CampaignRecord[], incoming: CampaignRecord[]) => {
    const map = new Map<string, CampaignRecord>();
    for (const row of base) map.set(buildRowKey(row), row);
    for (const row of incoming) map.set(buildRowKey(row), row);
    return Array.from(map.values());
  };

  const getRangeSummary = (items: CampaignRecord[]) => {
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
      setProblemSpendThreshold('15');
      setStarMinClicks('12');
      setStarMinOrders('2');
      setHighAcosFactor('2.2');
      setHighAcosMinClicks('15');
      setObserveMaxClicks('12');
      setCleanupMaxSpend('1.5');
      setCleanupMaxBudgetUsePct('4');
      return;
    }
    setTargetAcos('30');
    setProblemSpendThreshold('20');
    setStarMinClicks('20');
    setStarMinOrders('3');
    setHighAcosFactor('1.8');
    setHighAcosMinClicks('20');
    setObserveMaxClicks('10');
    setCleanupMaxSpend('2');
    setCleanupMaxBudgetUsePct('5');
  }, [productStage]);

  const resetFilters = () => {
    setQuery('');
    setStatusFilter('全部');
    setCampaignTypeFilter('全部');
    setTargetingTypeFilter('全部');
    setBiddingFilter('全部');
    setMinSpend('');
    setMinOrders('');
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
    setProblemSpendThreshold('20');
    setStarMinClicks('20');
    setStarMinOrders('3');
    setHighAcosFactor('1.8');
    setHighAcosMinClicks('20');
    setObserveMaxClicks('10');
    setCleanupMaxSpend('2');
    setCleanupMaxBudgetUsePct('5');
    setTableLimit('120');
    resetFilters();
  };

  const onDrop = async (files: File[]) => {
    if (!files.length) return;
    setIsLoading(true);
    try {
      let merged: CampaignRecord[] = [];
      let nextCurrency: string | null = null;
      for (const file of files) {
        const { records, currency: detectedCurrency } = await parseCampaignReport(file);
        merged = merged.concat(records);
        if (!nextCurrency && detectedCurrency) nextCurrency = detectedCurrency;
      }
      const dedupMap = new Map<string, CampaignRecord>();
      for (const item of merged) dedupMap.set(buildRowKey(item), item);
      const deduped = Array.from(dedupMap.values());

      let baseData: CampaignRecord[] = [];
      let targetLabel: string | null = null;
      if (mergeTargetId) {
        const records = await historyStore.loadRecords<CampaignRecord>(mergeTargetId);
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
      toast.success(`已解析 ${deduped.length} 条广告活动数据，当前 ${finalRows.length} 条${mergeText}`);
    } catch (error) {
      console.error(error);
      toast.error('广告活动报表解析失败');
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
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
      'application/vnd.ms-excel': ['.xls'],
      'text/csv': ['.csv'],
    },
  });

  const reportRange = useMemo(() => {
    const starts = rows.map((r) => r.startDate).filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d));
    const ends = rows.map((r) => r.endDate).filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d));
    if (!starts.length && !ends.length) return null;
    const minYmd = starts.length
      ? starts.reduce((acc, d) => (d < acc ? d : acc), starts[0])
      : ends.reduce((acc, d) => (d < acc ? d : acc), ends[0]);
    const maxYmd = ends.length
      ? ends.reduce((acc, d) => (d > acc ? d : acc), ends[0])
      : starts.reduce((acc, d) => (d > acc ? d : acc), starts[0]);
    const minDate = new Date(`${minYmd}T00:00:00.000Z`);
    const maxDate = new Date(`${maxYmd}T00:00:00.000Z`);
    const days = Math.max(1, Math.floor((maxDate.getTime() - minDate.getTime()) / 86400000) + 1);
    return { minYmd, maxYmd, days };
  }, [rows]);

  const campaignTypeOptions = useMemo(() => {
    const values = Array.from(new Set(rows.map((r) => r.campaignType).filter(Boolean)));
    values.sort((a, b) => a.localeCompare(b, 'zh-Hans-CN'));
    return values;
  }, [rows]);

  const targetingTypeOptions = useMemo(() => {
    const values = Array.from(new Set(rows.map((r) => r.targetingType).filter(Boolean)));
    values.sort((a, b) => a.localeCompare(b, 'zh-Hans-CN'));
    return values;
  }, [rows]);

  const biddingOptions = useMemo(() => {
    const values = Array.from(new Set(rows.map((r) => r.biddingStrategy).filter(Boolean)));
    values.sort((a, b) => a.localeCompare(b, 'zh-Hans-CN'));
    return values;
  }, [rows]);

  const filteredRows = useMemo(() => {
    const q = query.trim().toLowerCase();
    const minSpendValue = Number(minSpend);
    const minOrdersValue = Number(minOrders);
    const maxAcosValue = Number(maxAcos);
    return rows.filter((row) => {
      if (q) {
        const haystack = `${row.campaignName} ${row.campaignType} ${row.targetingType}`.toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      if (statusFilter !== '全部' && row.status.toUpperCase() !== statusFilter) return false;
      if (campaignTypeFilter !== '全部' && row.campaignType !== campaignTypeFilter) return false;
      if (targetingTypeFilter !== '全部' && row.targetingType !== targetingTypeFilter) return false;
      if (biddingFilter !== '全部' && row.biddingStrategy !== biddingFilter) return false;
      if (Number.isFinite(minSpendValue) && minSpendValue > 0 && row.spend < minSpendValue) return false;
      if (Number.isFinite(minOrdersValue) && minOrdersValue > 0 && row.orders < minOrdersValue) return false;
      const acosForFilter = row.sales > 0 ? row.acos : row.spend > 0 ? Number.POSITIVE_INFINITY : 0;
      if (Number.isFinite(maxAcosValue) && maxAcosValue > 0 && acosForFilter > maxAcosValue) return false;
      return true;
    });
  }, [rows, query, statusFilter, campaignTypeFilter, targetingTypeFilter, biddingFilter, minSpend, minOrders, maxAcos]);

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
  const problemSpendValue = Math.max(1, Number(problemSpendThreshold) || 20);
  const starMinClicksValue = Math.max(1, Number(starMinClicks) || 20);
  const starMinOrdersValue = Math.max(1, Number(starMinOrders) || 3);
  const highAcosFactorValue = Math.max(1.1, Number(highAcosFactor) || 1.8);
  const highAcosMinClicksValue = Math.max(1, Number(highAcosMinClicks) || 20);
  const observeMaxClicksValue = Math.max(1, Number(observeMaxClicks) || 10);
  const cleanupMaxSpendValue = Math.max(0, Number(cleanupMaxSpend) || 2);
  const cleanupMaxBudgetUseRatio = Math.max(0, Number(cleanupMaxBudgetUsePct) || 5) / 100;

  const sortedRows = useMemo(() => {
    const data = [...filteredRows];
    data.sort((a, b) => {
      const readValue = (row: CampaignRecord) => {
        if (sortKey === 'campaignName') return row.campaignName.toLowerCase();
        if (sortKey === 'status') return row.status.toLowerCase();
        if (sortKey === 'campaignType') return row.campaignType.toLowerCase();
        if (sortKey === 'targetingType') return row.targetingType.toLowerCase();
        if (sortKey === 'biddingStrategy') return row.biddingStrategy.toLowerCase();
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
    return data;
  }, [filteredRows, sortKey, sortDirection]);

  const tableRows = useMemo(() => {
    const n = Number(tableLimit);
    if (!Number.isFinite(n) || n <= 0) return sortedRows;
    return sortedRows.slice(0, n);
  }, [sortedRows, tableLimit]);

  const decisionRows = useMemo<DecisionCampaignRow[]>(
    () =>
      filteredRows.map((row) => {
        const start = row.startDate ? Date.parse(`${row.startDate}T00:00:00.000Z`) : NaN;
        const end = row.endDate ? Date.parse(`${row.endDate}T00:00:00.000Z`) : NaN;
        const days = Number.isFinite(start) && Number.isFinite(end) ? Math.max(1, Math.floor((end - start) / 86400000) + 1) : 30;
        const budgetUse = row.budget > 0 ? row.spend / (row.budget * days) : 0;
        const acosForDecision = row.sales > 0 ? row.acos : row.spend > 0 ? Number.POSITIVE_INFINITY : 0;
        return { ...row, days, budgetUse, acosForDecision };
      }),
    [filteredRows]
  );

  const avgSales = decisionRows.length ? summary.sales / decisionRows.length : 0;

  const starRows = useMemo(
    () =>
      [...decisionRows]
        .filter((r) => r.clicks >= starMinClicksValue && r.orders >= starMinOrdersValue && r.sales >= avgSales && r.acosForDecision <= targetAcosValue)
        .sort((a, b) => b.sales - a.sales || b.orders - a.orders)
        .slice(0, 20),
    [avgSales, decisionRows, starMinClicksValue, starMinOrdersValue, targetAcosValue]
  );

  const costDownRows = useMemo(
    () =>
      [...decisionRows]
        .filter((r) => r.clicks >= highAcosMinClicksValue && r.spend >= problemSpendValue && r.acosForDecision >= targetAcosValue * highAcosFactorValue)
        .sort((a, b) => b.acosForDecision - a.acosForDecision || b.spend - a.spend)
        .slice(0, 20),
    [decisionRows, highAcosFactorValue, highAcosMinClicksValue, problemSpendValue, targetAcosValue]
  );

  const observeRows = useMemo(
    () =>
      [...decisionRows]
        .filter((r) => r.orders <= 0 && r.clicks > 0 && r.clicks < observeMaxClicksValue)
        .sort((a, b) => b.clicks - a.clicks || b.spend - a.spend)
        .slice(0, 20),
    [decisionRows, observeMaxClicksValue]
  );

  const cleanupRows = useMemo(
    () =>
      [...decisionRows]
        .filter((r) => r.orders <= 0 && r.sales <= 0 && r.spend <= cleanupMaxSpendValue && r.budgetUse <= cleanupMaxBudgetUseRatio)
        .sort((a, b) => a.spend - b.spend)
        .slice(0, 20),
    [cleanupMaxBudgetUseRatio, cleanupMaxSpendValue, decisionRows]
  );

  const campaignTypeSummary = useMemo(() => {
    const map = new Map<string, { count: number; spend: number; sales: number; orders: number }>();
    for (const row of filteredRows) {
      const key = row.campaignType || 'Unknown';
      const hit = map.get(key) ?? { count: 0, spend: 0, sales: 0, orders: 0 };
      hit.count += 1;
      hit.spend += row.spend;
      hit.sales += row.sales;
      hit.orders += row.orders;
      map.set(key, hit);
    }
    return Array.from(map.entries())
      .map(([campaignType, value]) => {
        const acos = value.sales > 0 ? (value.spend / value.sales) * 100 : 0;
        const roas = value.spend > 0 ? value.sales / value.spend : 0;
        return { campaignType, ...value, acos, roas };
      })
      .sort((a, b) => b.spend - a.spend);
  }, [filteredRows]);

  const statusSummary = useMemo(() => {
    const enabled = filteredRows.filter((r) => r.status.toUpperCase() === 'ENABLED');
    const paused = filteredRows.filter((r) => r.status.toUpperCase() === 'PAUSED');
    return { enabled: enabled.length, paused: paused.length, total: filteredRows.length };
  }, [filteredRows]);

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

  const renderAcosBadge = (row: CampaignRecord) => {
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

  const getBudgetUse = (row: CampaignRecord) => {
    const start = row.startDate ? Date.parse(`${row.startDate}T00:00:00.000Z`) : NaN;
    const end = row.endDate ? Date.parse(`${row.endDate}T00:00:00.000Z`) : NaN;
    const days = Number.isFinite(start) && Number.isFinite(end) ? Math.max(1, Math.floor((end - start) / 86400000) + 1) : 30;
    if (row.budget <= 0) return 0;
    return row.spend / (row.budget * days);
  };

  const exportDecisionSheets = () => {
    if (!starRows.length && !costDownRows.length && !observeRows.length && !cleanupRows.length) {
      toast.error('没有可导出的活动决策清单');
      return;
    }
    const toAcosExport = (item: CampaignRecord) =>
      item.sales > 0 ? Number(item.acos.toFixed(2)) : item.spend > 0 ? '∞' : Number((0).toFixed(2));
    const safeName = fileLabel ? fileLabel.replace(/\.[^.]+$/, '') : '广告活动报表';
    const wb = XLSX.utils.book_new();

    const starSheet = starRows.map((row) => ({
      活动名称: row.campaignName,
      活动类型: row.campaignType,
      状态: row.status,
      [`花费(${currency})`]: Number(row.spend.toFixed(2)),
      [`销售额(${currency})`]: Number(row.sales.toFixed(2)),
      订单: row.orders,
      ACOS百分比: toAcosExport(row),
      ROAS: Number(row.roas.toFixed(4)),
      预算使用率百分比: Number((row.budgetUse * 100).toFixed(2)),
      建议动作: '预算 +20%-40%，竞价 +10%-15%',
    }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(starSheet), '明星活动');

    const costDownSheet = costDownRows.map((row) => ({
      活动名称: row.campaignName,
      活动类型: row.campaignType,
      状态: row.status,
      [`花费(${currency})`]: Number(row.spend.toFixed(2)),
      [`销售额(${currency})`]: Number(row.sales.toFixed(2)),
      订单: row.orders,
      ACOS百分比: toAcosExport(row),
      ROAS: Number(row.roas.toFixed(4)),
      预算使用率百分比: Number((row.budgetUse * 100).toFixed(2)),
      建议动作: '竞价 -10%-20%，同步清理低效词',
    }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(costDownSheet), '降本活动');

    const observeSheet = observeRows.map((row) => ({
      活动名称: row.campaignName,
      活动类型: row.campaignType,
      状态: row.status,
      [`花费(${currency})`]: Number(row.spend.toFixed(2)),
      [`销售额(${currency})`]: Number(row.sales.toFixed(2)),
      点击: row.clicks,
      订单: row.orders,
      预算使用率百分比: Number((row.budgetUse * 100).toFixed(2)),
      建议动作: `观察至点击≥${observeMaxClicksValue}后再判断否定/暂停`,
    }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(observeSheet), '观察池');

    const cleanupSheet = cleanupRows.map((row) => ({
      活动名称: row.campaignName,
      活动类型: row.campaignType,
      状态: row.status,
      [`预算(${currency})`]: Number(row.budget.toFixed(2)),
      [`花费(${currency})`]: Number(row.spend.toFixed(2)),
      点击: row.clicks,
      订单: row.orders,
      预算使用率百分比: Number((row.budgetUse * 100).toFixed(2)),
      建议动作: '暂停或并入同类活动，减少预算碎片化',
    }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(cleanupSheet), '清理池');

    XLSX.writeFile(wb, `${safeName}-活动决策清单.xlsx`);
    toast.success('已导出活动决策清单');
  };

  if (!rows.length) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
        <div className="w-full max-w-4xl text-center space-y-6 animate-in fade-in zoom-in duration-500">
          <div className="space-y-2">
            <h1 className="text-4xl font-extrabold tracking-tight lg:text-5xl bg-clip-text text-transparent bg-gradient-to-r from-primary to-slate-800">
              广告活动报表分析
            </h1>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
              从活动层级评估预算与 ROI，识别明星活动、问题活动和潜力活动，指导预算分配。
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
              <div className="text-lg font-medium">{isLoading ? '解析中…' : '上传广告活动报表'}</div>
              <div className="text-sm text-muted-foreground">支持 .csv / .xlsx / .xls，可批量上传</div>
            </div>
            <div className="absolute bottom-4 flex items-center gap-2 text-xs text-muted-foreground">
              <FileSpreadsheet className="h-3.5 w-3.5" />
              <span>支持 Amazon 商品推广广告活动报表</span>
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
                              const records = await historyStore.loadRecords<CampaignRecord>(item.id);
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
            <h1 className="text-2xl font-semibold tracking-tight">广告活动报表分析</h1>
            <p className="text-sm text-muted-foreground">适用“商品推广_广告活动_报告”，按活动维度查看投放健康度。</p>
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
          <Badge variant="outline">活动数：{rows.length.toLocaleString()}</Badge>
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
          <Card><CardContent className="pt-6"><div className="text-xs text-muted-foreground">启用/暂停</div><div className="text-xl font-semibold">{statusSummary.enabled} / {statusSummary.paused}</div></CardContent></Card>
          <Card>
            <CardContent className="pt-6 space-y-2">
              <div className="text-xs text-muted-foreground">目标 ACOS(%)</div>
              <Input type="number" min={1} step="0.1" value={targetAcos} onChange={(e) => setTargetAcos(e.target.value)} />
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>活动明细（支持字段排序）</CardTitle>
            <CardDescription>按筛选结果展示，点击表头可切换排序方向</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4 mb-4">
              <div className="space-y-1">
                <div className="text-xs text-muted-foreground">搜索活动名/类型</div>
                <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="输入关键字" />
              </div>
              <div className="space-y-1">
                <div className="text-xs text-muted-foreground">状态</div>
                <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as StatusFilter)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="全部">全部</SelectItem>
                    <SelectItem value="ENABLED">ENABLED</SelectItem>
                    <SelectItem value="PAUSED">PAUSED</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <div className="text-xs text-muted-foreground">活动类型</div>
                <Select value={campaignTypeFilter} onValueChange={setCampaignTypeFilter}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="全部">全部</SelectItem>
                    {campaignTypeOptions.map((v) => <SelectItem key={v} value={v}>{v}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <div className="text-xs text-muted-foreground">定位类型</div>
                <Select value={targetingTypeFilter} onValueChange={setTargetingTypeFilter}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="全部">全部</SelectItem>
                    {targetingTypeOptions.map((v) => <SelectItem key={v} value={v}>{v}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-5 mb-4">
              <div className="space-y-1">
                <div className="text-xs text-muted-foreground">竞价策略</div>
                <Select value={biddingFilter} onValueChange={setBiddingFilter}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="全部">全部</SelectItem>
                    {biddingOptions.map((v) => <SelectItem key={v} value={v}>{v}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <div className="text-xs text-muted-foreground">最小花费</div>
                <Input type="number" min={0} step="0.1" value={minSpend} onChange={(e) => setMinSpend(e.target.value)} />
              </div>
              <div className="space-y-1">
                <div className="text-xs text-muted-foreground">最小订单</div>
                <Input type="number" min={0} value={minOrders} onChange={(e) => setMinOrders(e.target.value)} />
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
                      <TableHead><SortHeader label="活动" value="campaignName" /></TableHead>
                      <TableHead><SortHeader label="状态" value="status" /></TableHead>
                      <TableHead><SortHeader label="活动类型" value="campaignType" /></TableHead>
                      <TableHead><SortHeader label="定位类型" value="targetingType" /></TableHead>
                      <TableHead><SortHeader label="竞价策略" value="biddingStrategy" /></TableHead>
                      <TableHead className="text-right"><SortHeader label="预算" value="budget" /></TableHead>
                      <TableHead className="text-right"><SortHeader label="展示" value="impressions" /></TableHead>
                      <TableHead className="text-right"><SortHeader label="点击" value="clicks" /></TableHead>
                      <TableHead className="text-right"><SortHeader label="花费" value="spend" /></TableHead>
                      <TableHead className="text-right"><SortHeader label="销售" value="sales" /></TableHead>
                      <TableHead className="text-right"><SortHeader label="订单" value="orders" /></TableHead>
                      <TableHead className="text-right">预算使用率</TableHead>
                      <TableHead className="text-right"><SortHeader label="ACOS" value="acos" /></TableHead>
                      <TableHead className="text-right"><SortHeader label="ROAS" value="roas" /></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {tableRows.map((row) => (
                      <TableRow key={row.id}>
                        <TableCell className="max-w-[320px] truncate" title={row.campaignName}>{row.campaignName}</TableCell>
                        <TableCell>{row.status}</TableCell>
                        <TableCell>{row.campaignType}</TableCell>
                        <TableCell>{row.targetingType}</TableCell>
                        <TableCell>{row.biddingStrategy}</TableCell>
                        <TableCell className="text-right">{formatMoney(row.budget, currency)}</TableCell>
                        <TableCell className="text-right">{row.impressions.toLocaleString()}</TableCell>
                        <TableCell className="text-right">{row.clicks.toLocaleString()}</TableCell>
                        <TableCell className="text-right">{formatMoney(row.spend, currency)}</TableCell>
                        <TableCell className="text-right">{formatMoney(row.sales, currency)}</TableCell>
                        <TableCell className="text-right">{row.orders.toLocaleString()}</TableCell>
                        <TableCell className="text-right">{formatPct(getBudgetUse(row))}</TableCell>
                        <TableCell className="text-right">{renderAcosBadge(row)}</TableCell>
                        <TableCell className="text-right">{row.roas.toFixed(2)}</TableCell>
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
            <CardTitle className="flex items-center gap-2">
              <span>活动层执行清单</span>
              <UiTooltip>
                <UiTooltipTrigger asChild>
                  <button type="button" className="inline-flex h-5 w-5 items-center justify-center text-muted-foreground hover:text-foreground">
                    <CircleHelp className="h-4 w-4" />
                  </button>
                </UiTooltipTrigger>
                <UiTooltipContent side="top" align="start" className="max-w-[420px] text-xs leading-5">
                  <div>规则由产品阶段、目标ACOS、样本门槛和预算使用率共同决定。</div>
                  <div>加投：点击/订单达标，且 ACOS ≤ 目标；降本：ACOS 超过目标倍数且花费达标。</div>
                  <div>观察池：无单但点击未达否定阈值；清理池：几乎不消耗预算且持续无转化。</div>
                </UiTooltipContent>
              </UiTooltip>
            </CardTitle>
            <CardDescription>将活动拆分为加投/降本/观察/清理四类，便于运营直接执行</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <Button className="gap-2" onClick={exportDecisionSheets}>
                <Download className="h-4 w-4" />
                一键导出活动决策 Excel
              </Button>
              <div className="text-xs text-muted-foreground">导出加投/降本/观察/清理四张执行表</div>
            </div>
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-8">
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
                <div className="text-xs text-muted-foreground">目标 ACOS(%)</div>
                <Input type="number" min={1} step="0.1" value={targetAcos} onChange={(e) => setTargetAcos(e.target.value)} />
              </div>
              <div className="space-y-1">
                <div className="text-xs text-muted-foreground">加投最小点击</div>
                <Input type="number" min={1} value={starMinClicks} onChange={(e) => setStarMinClicks(e.target.value)} />
              </div>
              <div className="space-y-1">
                <div className="text-xs text-muted-foreground">加投最小订单</div>
                <Input type="number" min={1} value={starMinOrders} onChange={(e) => setStarMinOrders(e.target.value)} />
              </div>
              <div className="space-y-1">
                <div className="text-xs text-muted-foreground">降本最小花费</div>
                <Input type="number" min={1} step="0.1" value={problemSpendThreshold} onChange={(e) => setProblemSpendThreshold(e.target.value)} />
              </div>
              <div className="space-y-1">
                <div className="text-xs text-muted-foreground">高ACOS倍数</div>
                <Input type="number" min={1.1} step="0.1" value={highAcosFactor} onChange={(e) => setHighAcosFactor(e.target.value)} />
              </div>
              <div className="space-y-1">
                <div className="text-xs text-muted-foreground">高ACOS最小点击</div>
                <Input type="number" min={1} value={highAcosMinClicks} onChange={(e) => setHighAcosMinClicks(e.target.value)} />
              </div>
              <div className="space-y-1">
                <div className="text-xs text-muted-foreground">观察最大点击</div>
                <Input type="number" min={1} value={observeMaxClicks} onChange={(e) => setObserveMaxClicks(e.target.value)} />
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
              <div className="space-y-1">
                <div className="text-xs text-muted-foreground">清理最大花费</div>
                <Input type="number" min={0} step="0.1" value={cleanupMaxSpend} onChange={(e) => setCleanupMaxSpend(e.target.value)} />
              </div>
              <div className="space-y-1">
                <div className="text-xs text-muted-foreground">清理最大预算使用率(%)</div>
                <Input type="number" min={0} step="0.1" value={cleanupMaxBudgetUsePct} onChange={(e) => setCleanupMaxBudgetUsePct(e.target.value)} />
              </div>
              <div className="rounded-md border px-3 py-2 text-xs text-muted-foreground flex items-center">
                当前样本均值销售额：{formatMoney(avgSales, currency)}
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
              <Card><CardContent className="pt-6"><div className="text-xs text-muted-foreground">加投活动</div><div className="text-xl font-semibold">{starRows.length.toLocaleString()}</div></CardContent></Card>
              <Card><CardContent className="pt-6"><div className="text-xs text-muted-foreground">降本活动</div><div className="text-xl font-semibold">{costDownRows.length.toLocaleString()}</div></CardContent></Card>
              <Card><CardContent className="pt-6"><div className="text-xs text-muted-foreground">观察池</div><div className="text-xl font-semibold">{observeRows.length.toLocaleString()}</div></CardContent></Card>
              <Card><CardContent className="pt-6"><div className="text-xs text-muted-foreground">清理池</div><div className="text-xl font-semibold">{cleanupRows.length.toLocaleString()}</div></CardContent></Card>
            </div>

            <div className="grid gap-3 lg:grid-cols-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">加投活动</CardTitle>
                  <CardDescription>样本达标且 ACOS 不高于目标</CardDescription>
                </CardHeader>
                <CardContent className="space-y-2">
                  {starRows.length ? starRows.map((row) => (
                    <div key={row.id} className="rounded-md border p-2 text-xs space-y-1">
                      <div className="font-medium truncate" title={row.campaignName}>{row.campaignName}</div>
                      <div>销售 {formatMoney(row.sales, currency)} · ACOS {row.acos.toFixed(2)}% · 预算使用 {formatPct(row.budgetUse)}</div>
                    </div>
                  )) : <div className="text-sm text-muted-foreground">暂无符合条件的数据</div>}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">降本活动</CardTitle>
                  <CardDescription>ACOS 显著超目标且已形成花费</CardDescription>
                </CardHeader>
                <CardContent className="space-y-2">
                  {costDownRows.length ? costDownRows.map((row) => (
                    <div key={row.id} className="rounded-md border p-2 text-xs space-y-1">
                      <div className="font-medium truncate" title={row.campaignName}>{row.campaignName}</div>
                      <div>花费 {formatMoney(row.spend, currency)} · ACOS {row.sales > 0 ? `${row.acos.toFixed(2)}%` : '∞'}</div>
                    </div>
                  )) : <div className="text-sm text-muted-foreground">暂无符合条件的数据</div>}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">观察池</CardTitle>
                  <CardDescription>无单但点击未到否定阈值，先观察</CardDescription>
                </CardHeader>
                <CardContent className="space-y-2">
                  {observeRows.length ? observeRows.map((row) => (
                    <div key={row.id} className="rounded-md border p-2 text-xs space-y-1">
                      <div className="font-medium truncate" title={row.campaignName}>{row.campaignName}</div>
                      <div>点击 {row.clicks} · 花费 {formatMoney(row.spend, currency)} · 订单 0</div>
                    </div>
                  )) : <div className="text-sm text-muted-foreground">暂无符合条件的数据</div>}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">清理池</CardTitle>
                  <CardDescription>低消耗、低预算利用、无转化活动</CardDescription>
                </CardHeader>
                <CardContent className="space-y-2">
                  {cleanupRows.length ? cleanupRows.map((row) => (
                    <div key={row.id} className="rounded-md border p-2 text-xs space-y-1">
                      <div className="font-medium truncate" title={row.campaignName}>{row.campaignName}</div>
                      <div>花费 {formatMoney(row.spend, currency)} · 预算使用 {formatPct(row.budgetUse)} · 订单 0</div>
                    </div>
                  )) : <div className="text-sm text-muted-foreground">暂无符合条件的数据</div>}
                </CardContent>
              </Card>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>活动类型分布</CardTitle>
            <CardDescription>用于判断预算是否过度集中，辅助宏观结构优化</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>活动类型</TableHead>
                    <TableHead className="text-right">活动数</TableHead>
                    <TableHead className="text-right">订单</TableHead>
                    <TableHead className="text-right">花费</TableHead>
                    <TableHead className="text-right">销售</TableHead>
                    <TableHead className="text-right">ACOS</TableHead>
                    <TableHead className="text-right">ROAS</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {campaignTypeSummary.map((row) => (
                    <TableRow key={row.campaignType}>
                      <TableCell>{row.campaignType}</TableCell>
                      <TableCell className="text-right">{row.count.toLocaleString()}</TableCell>
                      <TableCell className="text-right">{row.orders.toLocaleString()}</TableCell>
                      <TableCell className="text-right">{formatMoney(row.spend, currency)}</TableCell>
                      <TableCell className="text-right">{formatMoney(row.sales, currency)}</TableCell>
                      <TableCell className="text-right">{row.acos.toFixed(2)}%</TableCell>
                      <TableCell className="text-right">{row.roas.toFixed(2)}</TableCell>
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
