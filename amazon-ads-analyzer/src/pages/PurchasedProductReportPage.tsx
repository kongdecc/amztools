import { useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react';
import { ArrowDown, ArrowLeft, ArrowUp, ArrowUpDown, CircleHelp, Download, Loader2, ShoppingBag, Upload } from 'lucide-react';
import { useDropzone } from 'react-dropzone';
import { Link } from 'wouter';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';
import { Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { parseAdvertisedProductReport, parsePurchasedProductReport, type AdvertisedProductRecord, type PurchasedProductRecord } from '@/lib/report-parsers';
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

type SortKey = 'campaignName' | 'advertisedAsin' | 'purchasedAsin' | 'otherSkuOrders' | 'otherSkuSales' | 'startDate';

type PathFilter = '全部' | '直接转化' | '间接转化';

type EntryRole = '高流量入口款' | '高转化核心款' | '低效问题款';

export default function PurchasedProductReportPage() {
  const historyStore = useMemo(() => createUploadHistoryStore('purchased-product-upload'), []);
  const [rows, setRows] = useState<PurchasedProductRecord[]>([]);
  const [fileLabel, setFileLabel] = useState('');
  const [directSourceLabel, setDirectSourceLabel] = useState('');
  const [directRows, setDirectRows] = useState<AdvertisedProductRecord[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [currency, setCurrency] = useState('USD');
  const [query, setQuery] = useState('');
  const [campaignFilter, setCampaignFilter] = useState('全部');
  const [targetingFilter, setTargetingFilter] = useState('全部');
  const [matchTypeFilter, setMatchTypeFilter] = useState('全部');
  const [pathFilter, setPathFilter] = useState<PathFilter>('全部');
  const [minIndirectSales, setMinIndirectSales] = useState('');
  const [minIndirectOrders, setMinIndirectOrders] = useState('');
  const [entryHighRatePct, setEntryHighRatePct] = useState('45');
  const [entryCoreRatePct, setEntryCoreRatePct] = useState('20');
  const [entryMinIndirectSales, setEntryMinIndirectSales] = useState('10');
  const [pairPrioritySales, setPairPrioritySales] = useState('20');
  const [pairPriorityOrders, setPairPriorityOrders] = useState('2');
  const [scoreWeightPath, setScoreWeightPath] = useState('1');
  const [scoreWeightSales, setScoreWeightSales] = useState('1');
  const [scoreWeightOrders, setScoreWeightOrders] = useState('1');
  const [sortKey, setSortKey] = useState<SortKey>('otherSkuSales');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [tableLimit, setTableLimit] = useState('120');
  const [historyItems, setHistoryItems] = useState<HistoryMeta[]>([]);
  const [mergeEnabled, setMergeEnabled] = useState(true);
  const [mergeTargetId, setMergeTargetId] = useState<string | null>(null);
  const historyItemsRef = useRef<HistoryMeta[]>([]);
  const directUploadInputRef = useRef<HTMLInputElement | null>(null);

  const buildRowKey = (row: PurchasedProductRecord) =>
    [row.startDate, row.endDate, row.campaignName, row.adGroupName, row.advertisedAsin, row.purchasedAsin, row.targeting, row.matchType]
      .join('|')
      .toLowerCase();

  const mergeRecords = (base: PurchasedProductRecord[], incoming: PurchasedProductRecord[]) => {
    const map = new Map<string, PurchasedProductRecord>();
    for (const row of base) map.set(buildRowKey(row), row);
    for (const row of incoming) map.set(buildRowKey(row), row);
    return Array.from(map.values());
  };

  const getRangeSummary = (items: PurchasedProductRecord[]) => {
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
    setTargetingFilter('全部');
    setMatchTypeFilter('全部');
    setPathFilter('全部');
    setMinIndirectSales('');
    setMinIndirectOrders('');
    setEntryHighRatePct('45');
    setEntryCoreRatePct('20');
    setEntryMinIndirectSales('10');
    setPairPrioritySales('20');
    setPairPriorityOrders('2');
    setScoreWeightPath('1');
    setScoreWeightSales('1');
    setScoreWeightOrders('1');
    setSortKey('otherSkuSales');
    setSortDirection('desc');
  };

  const resetAll = () => {
    setRows([]);
    setFileLabel('');
    setCurrency('USD');
    setTableLimit('120');
    resetFilters();
  };

  const onDrop = async (files: File[]) => {
    if (!files.length) return;
    setIsLoading(true);
    try {
      let merged: PurchasedProductRecord[] = [];
      let nextCurrency: string | null = null;
      for (const file of files) {
        const { records, currency: detectedCurrency } = await parsePurchasedProductReport(file);
        merged = merged.concat(records);
        if (!nextCurrency && detectedCurrency) nextCurrency = detectedCurrency;
      }
      const dedupMap = new Map<string, PurchasedProductRecord>();
      for (const item of merged) dedupMap.set(buildRowKey(item), item);
      const deduped = Array.from(dedupMap.values());

      let baseData: PurchasedProductRecord[] = [];
      if (mergeTargetId) {
        const records = await historyStore.loadRecords<PurchasedProductRecord>(mergeTargetId);
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
      toast.success(`已解析 ${deduped.length} 条已购买商品数据，当前 ${finalRows.length} 条`);
    } catch (error) {
      console.error(error);
      toast.error('已购买商品报表解析失败');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDirectFileUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setIsLoading(true);
    try {
      const { records } = await parseAdvertisedProductReport(file);
      setDirectRows(records);
      setDirectSourceLabel(file.name);
      toast.success(`已载入推广商品数据 ${records.length.toLocaleString()} 条`);
    } catch (error) {
      console.error(error);
      toast.error('推广商品报表解析失败');
    } finally {
      setIsLoading(false);
      event.target.value = '';
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

  const campaignOptions = useMemo(() => {
    const values = Array.from(new Set(rows.map((r) => r.campaignName).filter(Boolean)));
    values.sort((a, b) => a.localeCompare(b, 'zh-Hans-CN'));
    return values;
  }, [rows]);

  const targetingOptions = useMemo(() => {
    const values = Array.from(new Set(rows.map((r) => r.targeting).filter(Boolean)));
    values.sort((a, b) => a.localeCompare(b, 'zh-Hans-CN'));
    return values;
  }, [rows]);

  const matchTypeOptions = useMemo(() => {
    const values = Array.from(new Set(rows.map((r) => r.matchType).filter(Boolean)));
    values.sort((a, b) => a.localeCompare(b, 'zh-Hans-CN'));
    return values;
  }, [rows]);

  const filteredRows = useMemo(() => {
    const q = query.trim().toLowerCase();
    const minSalesValue = Number(minIndirectSales);
    const minOrdersValue = Number(minIndirectOrders);
    return rows.filter((row) => {
      if (q) {
        const haystack = `${row.campaignName} ${row.advertisedAsin} ${row.purchasedAsin} ${row.targeting}`.toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      if (campaignFilter !== '全部' && row.campaignName !== campaignFilter) return false;
      if (targetingFilter !== '全部' && row.targeting !== targetingFilter) return false;
      if (matchTypeFilter !== '全部' && row.matchType !== matchTypeFilter) return false;
      if (pathFilter === '直接转化' && !row.isDirectPurchase) return false;
      if (pathFilter === '间接转化' && row.isDirectPurchase) return false;
      if (Number.isFinite(minSalesValue) && minSalesValue > 0 && row.otherSkuSales < minSalesValue) return false;
      if (Number.isFinite(minOrdersValue) && minOrdersValue > 0 && row.otherSkuOrders < minOrdersValue) return false;
      return true;
    });
  }, [rows, query, campaignFilter, targetingFilter, matchTypeFilter, pathFilter, minIndirectSales, minIndirectOrders]);

  const sortedRows = useMemo(() => {
    const items = [...filteredRows];
    items.sort((a, b) => {
      const readValue = (row: PurchasedProductRecord) => {
        if (sortKey === 'campaignName') return row.campaignName.toLowerCase();
        if (sortKey === 'advertisedAsin') return row.advertisedAsin.toLowerCase();
        if (sortKey === 'purchasedAsin') return row.purchasedAsin.toLowerCase();
        if (sortKey === 'startDate') return row.startDate;
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
      if (na === nb) return b.otherSkuSales - a.otherSkuSales;
      return sortDirection === 'asc' ? na - nb : nb - na;
    });
    return items;
  }, [filteredRows, sortKey, sortDirection]);

  const tableRows = useMemo(() => {
    const n = Number(tableLimit);
    if (!Number.isFinite(n) || n <= 0) return sortedRows;
    return sortedRows.slice(0, n);
  }, [sortedRows, tableLimit]);

  const summary = useMemo(() => {
    const total = filteredRows.length;
    const directPaths = filteredRows.filter((r) => r.isDirectPurchase).length;
    const indirectPaths = total - directPaths;
    const indirectOrders = filteredRows.reduce((acc, curr) => acc + curr.otherSkuOrders, 0);
    const indirectSales = filteredRows.reduce((acc, curr) => acc + curr.otherSkuSales, 0);
    const indirectPathRate = total > 0 ? indirectPaths / total : 0;
    const avgIndirectAov = indirectOrders > 0 ? indirectSales / indirectOrders : 0;
    const uniquePurchasedAsin = new Set(filteredRows.map((r) => r.purchasedAsin)).size;
    const uniqueAdvertisedAsin = new Set(filteredRows.map((r) => r.advertisedAsin)).size;
    return {
      total,
      directPaths,
      indirectPaths,
      indirectPathRate,
      indirectOrders,
      indirectSales,
      avgIndirectAov,
      uniquePurchasedAsin,
      uniqueAdvertisedAsin,
    };
  }, [filteredRows]);

  const combinedContributionRows = useMemo(() => {
    const directMap = new Map<string, { directOrders: number; directSales: number }>();
    for (const row of directRows) {
      const key = row.advertisedAsin;
      const hit = directMap.get(key) ?? { directOrders: 0, directSales: 0 };
      hit.directOrders += row.orders;
      hit.directSales += row.sales;
      directMap.set(key, hit);
    }
    const indirectMap = new Map<string, { indirectOrders: number; indirectSales: number; indirectPaths: number }>();
    for (const row of filteredRows) {
      const key = row.advertisedAsin;
      const hit = indirectMap.get(key) ?? { indirectOrders: 0, indirectSales: 0, indirectPaths: 0 };
      if (!row.isDirectPurchase) {
        hit.indirectOrders += row.otherSkuOrders;
        hit.indirectSales += row.otherSkuSales;
        hit.indirectPaths += 1;
      }
      indirectMap.set(key, hit);
    }
    const asinSet = new Set([...directMap.keys(), ...indirectMap.keys()]);
    return Array.from(asinSet)
      .map((asin) => {
        const d = directMap.get(asin) ?? { directOrders: 0, directSales: 0 };
        const i = indirectMap.get(asin) ?? { indirectOrders: 0, indirectSales: 0, indirectPaths: 0 };
        const totalOrders = d.directOrders + i.indirectOrders;
        const totalSales = d.directSales + i.indirectSales;
        const indirectSalesShare = totalSales > 0 ? i.indirectSales / totalSales : 0;
        return { asin, ...d, ...i, totalOrders, totalSales, indirectSalesShare };
      })
      .sort((a, b) => b.totalSales - a.totalSales || b.totalOrders - a.totalOrders)
      .slice(0, 100);
  }, [directRows, filteredRows]);

  const entryHighRateValue = Math.max(1, Number(entryHighRatePct) || 45) / 100;
  const entryCoreRateValue = Math.max(0, Number(entryCoreRatePct) || 20) / 100;
  const entryMinIndirectSalesValue = Math.max(0, Number(entryMinIndirectSales) || 10);
  const pairPrioritySalesValue = Math.max(0, Number(pairPrioritySales) || 20);
  const pairPriorityOrdersValue = Math.max(0, Number(pairPriorityOrders) || 2);
  const scoreWeightPathValue = Math.max(0, Number(scoreWeightPath) || 1);
  const scoreWeightSalesValue = Math.max(0, Number(scoreWeightSales) || 1);
  const scoreWeightOrdersValue = Math.max(0, Number(scoreWeightOrders) || 1);

  const pathPieData = useMemo(
    () => [
      { name: '直接转化路径', value: summary.directPaths },
      { name: '间接转化路径', value: summary.indirectPaths },
    ],
    [summary.directPaths, summary.indirectPaths]
  );

  const purchasedAsinBarData = useMemo(() => {
    const map = new Map<string, { count: number; indirectSales: number }>();
    for (const row of filteredRows) {
      const hit = map.get(row.purchasedAsin) ?? { count: 0, indirectSales: 0 };
      hit.count += 1;
      hit.indirectSales += row.otherSkuSales;
      map.set(row.purchasedAsin, hit);
    }
    return Array.from(map.entries())
      .map(([asin, v]) => ({ asin, count: v.count, indirectSales: Number(v.indirectSales.toFixed(2)) }))
      .sort((a, b) => b.count - a.count || b.indirectSales - a.indirectSales)
      .slice(0, 10);
  }, [filteredRows]);

  const crossSellPairs = useMemo(() => {
    const map = new Map<string, { advertisedAsin: string; purchasedAsin: string; count: number; orders: number; sales: number }>();
    for (const row of filteredRows) {
      if (row.isDirectPurchase) continue;
      const key = `${row.advertisedAsin}|${row.purchasedAsin}`;
      const hit = map.get(key) ?? { advertisedAsin: row.advertisedAsin, purchasedAsin: row.purchasedAsin, count: 0, orders: 0, sales: 0 };
      hit.count += 1;
      hit.orders += row.otherSkuOrders;
      hit.sales += row.otherSkuSales;
      map.set(key, hit);
    }
    const raw = Array.from(map.values());
    const maxPaths = raw.reduce((acc, item) => Math.max(acc, item.count), 0);
    const maxSales = raw.reduce((acc, item) => Math.max(acc, item.sales), 0);
    const maxOrders = raw.reduce((acc, item) => Math.max(acc, item.orders), 0);
    const totalWeight = scoreWeightPathValue + scoreWeightSalesValue + scoreWeightOrdersValue || 1;
    return raw
      .map((item) => {
        const pathScore = maxPaths > 0 ? item.count / maxPaths : 0;
        const salesScore = maxSales > 0 ? item.sales / maxSales : 0;
        const ordersScore = maxOrders > 0 ? item.orders / maxOrders : 0;
        const priorityScore =
          ((pathScore * scoreWeightPathValue + salesScore * scoreWeightSalesValue + ordersScore * scoreWeightOrdersValue) / totalWeight) * 100;
        return {
          ...item,
          priorityScore,
          roleHint: item.sales >= pairPrioritySalesValue || item.orders >= pairPriorityOrdersValue ? '优先做捆绑/关联推荐' : '纳入常规关联位',
          action: item.sales >= pairPrioritySalesValue || item.orders >= pairPriorityOrdersValue ? '创建组合包并加大关联位曝光' : '保持关联推荐，持续观察',
        };
      })
      .sort((a, b) => b.priorityScore - a.priorityScore || b.sales - a.sales || b.orders - a.orders)
      .slice(0, 30);
  }, [filteredRows, pairPriorityOrdersValue, pairPrioritySalesValue, scoreWeightOrdersValue, scoreWeightPathValue, scoreWeightSalesValue]);

  const entryProducts = useMemo(() => {
    const map = new Map<string, { asin: string; totalPaths: number; indirectPaths: number; indirectOrders: number; indirectSales: number }>();
    for (const row of filteredRows) {
      const hit = map.get(row.advertisedAsin) ?? {
        asin: row.advertisedAsin,
        totalPaths: 0,
        indirectPaths: 0,
        indirectOrders: 0,
        indirectSales: 0,
      };
      hit.totalPaths += 1;
      if (!row.isDirectPurchase) {
        hit.indirectPaths += 1;
        hit.indirectOrders += row.otherSkuOrders;
        hit.indirectSales += row.otherSkuSales;
      }
      map.set(row.advertisedAsin, hit);
    }
    const base = Array.from(map.values());
    return base
      .map((item) => {
        const indirectRate = item.totalPaths > 0 ? item.indirectPaths / item.totalPaths : 0;
        let role: EntryRole = '低效问题款';
        if (item.indirectSales >= entryMinIndirectSalesValue && indirectRate >= entryHighRateValue) role = '高流量入口款';
        else if (indirectRate <= entryCoreRateValue) role = '高转化核心款';
        const action = role === '高流量入口款' ? '保持引流预算，强化关联推荐到利润款' : role === '高转化核心款' ? '作为核心款加投并保护排名' : '缩减预算或暂停，复核页面与选品';
        return { ...item, indirectRate, role, action };
      })
      .sort((a, b) => b.indirectSales - a.indirectSales || b.indirectOrders - a.indirectOrders)
      .slice(0, 30);
  }, [filteredRows, entryCoreRateValue, entryHighRateValue, entryMinIndirectSalesValue]);

  const roleSummary = useMemo(() => {
    const map = new Map<EntryRole, number>();
    for (const item of entryProducts) map.set(item.role, (map.get(item.role) ?? 0) + 1);
    return {
      高流量入口款: map.get('高流量入口款') ?? 0,
      高转化核心款: map.get('高转化核心款') ?? 0,
      低效问题款: map.get('低效问题款') ?? 0,
    };
  }, [entryProducts]);

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

  const exportDecision = () => {
    const wb = XLSX.utils.book_new();
    const detailSheet = sortedRows.map((row) => ({
      开始日期: row.startDate,
      结束日期: row.endDate,
      活动: row.campaignName,
      广告ASIN: row.advertisedAsin,
      购买ASIN: row.purchasedAsin,
      路径类型: row.isDirectPurchase ? '直接转化' : '间接转化',
      间接订单: row.isDirectPurchase ? '' : row.otherSkuOrders,
      [`间接销售额(${currency})`]: row.isDirectPurchase ? '' : Number(row.otherSkuSales.toFixed(2)),
      投放: row.targeting,
      匹配类型: row.matchType,
    }));
    const crossSheet = crossSellPairs.map((row) => ({
      广告ASIN: row.advertisedAsin,
      购买ASIN: row.purchasedAsin,
      组合路径数: row.count,
      间接订单: row.orders,
      [`间接销售额(${currency})`]: Number(row.sales.toFixed(2)),
      优先级评分: Number(row.priorityScore.toFixed(2)),
      建议: row.roleHint,
      动作: row.action,
    }));
    const entrySheet = entryProducts.map((row) => ({
      广告ASIN: row.asin,
      路径总数: row.totalPaths,
      间接路径数: row.indirectPaths,
      间接路径占比百分比: Number((row.indirectRate * 100).toFixed(2)),
      间接订单: row.indirectOrders,
      [`间接销售额(${currency})`]: Number(row.indirectSales.toFixed(2)),
      角色定位: row.role,
      动作: row.action,
    }));
    const combinedSheet = combinedContributionRows.map((row) => ({
      广告ASIN: row.asin,
      直接订单_推广商品: row.directOrders,
      [`直接销售额(${currency})_推广商品`]: Number(row.directSales.toFixed(2)),
      间接订单_已购买商品: row.indirectOrders,
      [`间接销售额(${currency})_已购买商品`]: Number(row.indirectSales.toFixed(2)),
      总订单: row.totalOrders,
      [`总销售额(${currency})`]: Number(row.totalSales.toFixed(2)),
      间接销售占比百分比: Number((row.indirectSalesShare * 100).toFixed(2)),
    }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(detailSheet), '路径明细');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(crossSheet), '交叉销售机会');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(entrySheet), '入口商品定位');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(combinedSheet), '联合贡献视图');
    XLSX.writeFile(wb, `已购买商品分析-${Date.now()}.xlsx`);
    toast.success('已导出已购买商品决策清单');
  };

  if (!rows.length) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
        <div className="w-full max-w-4xl text-center space-y-6 animate-in fade-in zoom-in duration-500">
          <div className="space-y-2">
            <h1 className="text-4xl font-extrabold tracking-tight lg:text-5xl bg-clip-text text-transparent bg-gradient-to-r from-primary to-slate-800">
              已购买商品报表分析
            </h1>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
              分析广告点击后的真实购买路径，识别直接转化、间接转化和交叉销售机会。
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
              <div className="text-lg font-medium">{isLoading ? '解析中…' : '上传已购买商品报表'}</div>
              <div className="text-sm text-muted-foreground">支持 .csv / .xlsx / .xls，可批量上传</div>
            </div>
            <div className="absolute bottom-4 flex items-center gap-2 text-xs text-muted-foreground">
              <ShoppingBag className="h-3.5 w-3.5" />
              <span>支持 Amazon 商品推广已购买商品报表</span>
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
                            const records = await historyStore.loadRecords<PurchasedProductRecord>(item.id);
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
            <h1 className="text-2xl font-semibold tracking-tight">已购买商品报表分析</h1>
            <p className="text-sm text-muted-foreground">聚焦直接/间接转化结构、交叉销售组合和入口商品角色。</p>
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
          <Badge variant="outline">联合视图ASIN：{combinedContributionRows.length.toLocaleString()}</Badge>
          {reportRange ? <Badge variant="outline">报告时间：{reportRange.minYmd} ~ {reportRange.maxYmd}（{reportRange.days} 天）</Badge> : null}
          {fileLabel ? <Badge variant="outline">文件：{fileLabel}</Badge> : null}
          {directSourceLabel ? <Badge variant="outline">推广商品源：{directSourceLabel}</Badge> : <Badge variant="outline">推广商品源：未加载</Badge>}
        </div>

        <Card>
          <CardHeader>
            <CardTitle>联合视图数据源</CardTitle>
            <CardDescription>上传推广商品报表后，可按广告ASIN查看“直接贡献+间接贡献”</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <input ref={directUploadInputRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={handleDirectFileUpload} />
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="outline" onClick={() => directUploadInputRef.current?.click()} disabled={isLoading}>
                {isLoading ? '解析中…' : '上传推广商品报表'}
              </Button>
              <span className="text-xs text-muted-foreground">建议上传与当前已购买商品同周期的推广商品报表</span>
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Card><CardContent className="pt-6"><div className="text-xs text-muted-foreground">路径总数</div><div className="text-xl font-semibold">{summary.total.toLocaleString()}</div></CardContent></Card>
          <Card><CardContent className="pt-6"><div className="text-xs text-muted-foreground">直接路径数（非订单）</div><div className="text-xl font-semibold">{summary.directPaths.toLocaleString()}</div></CardContent></Card>
          <Card><CardContent className="pt-6"><div className="text-xs text-muted-foreground">间接转化路径</div><div className="text-xl font-semibold">{summary.indirectPaths.toLocaleString()}</div></CardContent></Card>
          <Card><CardContent className="pt-6"><div className="text-xs text-muted-foreground">间接路径占比</div><div className="text-xl font-semibold">{formatPct(summary.indirectPathRate)}</div></CardContent></Card>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Card><CardContent className="pt-6"><div className="text-xs text-muted-foreground">间接订单数</div><div className="text-xl font-semibold">{summary.indirectOrders.toLocaleString()}</div></CardContent></Card>
          <Card><CardContent className="pt-6"><div className="text-xs text-muted-foreground">间接销售额</div><div className="text-xl font-semibold">{formatMoney(summary.indirectSales, currency)}</div></CardContent></Card>
          <Card><CardContent className="pt-6"><div className="text-xs text-muted-foreground">间接客单价</div><div className="text-xl font-semibold">{formatMoney(summary.avgIndirectAov, currency)}</div></CardContent></Card>
          <Card><CardContent className="pt-6"><div className="text-xs text-muted-foreground">购买ASIN数</div><div className="text-xl font-semibold">{summary.uniquePurchasedAsin.toLocaleString()}</div></CardContent></Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>筛选与路径明细</CardTitle>
            <CardDescription>支持按路径类型、活动、阈值筛选并进行字段排序</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-5">
              <div className="space-y-1">
                <div className="text-xs text-muted-foreground">搜索活动/广告ASIN/购买ASIN</div>
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
                <div className="text-xs text-muted-foreground">路径类型</div>
                <Select value={pathFilter} onValueChange={(value) => setPathFilter(value as PathFilter)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="全部">全部</SelectItem>
                    <SelectItem value="直接转化">直接转化</SelectItem>
                    <SelectItem value="间接转化">间接转化</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <div className="text-xs text-muted-foreground">投放</div>
                <Select value={targetingFilter} onValueChange={setTargetingFilter}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="全部">全部</SelectItem>
                    {targetingOptions.map((value) => <SelectItem key={value} value={value}>{value}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <div className="text-xs text-muted-foreground">最小间接销售额</div>
                <Input type="number" min={0} step="0.1" value={minIndirectSales} onChange={(e) => setMinIndirectSales(e.target.value)} />
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
              <div className="space-y-1">
                <div className="text-xs text-muted-foreground">匹配类型</div>
                <Select value={matchTypeFilter} onValueChange={setMatchTypeFilter}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="全部">全部</SelectItem>
                    {matchTypeOptions.map((value) => <SelectItem key={value} value={value}>{value}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <div className="text-xs text-muted-foreground">最小间接订单</div>
                <Input type="number" min={0} value={minIndirectOrders} onChange={(e) => setMinIndirectOrders(e.target.value)} />
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
                    <TableHead><SortHeader label="开始日期" value="startDate" /></TableHead>
                    <TableHead><SortHeader label="活动" value="campaignName" /></TableHead>
                    <TableHead><SortHeader label="广告ASIN" value="advertisedAsin" /></TableHead>
                    <TableHead><SortHeader label="购买ASIN" value="purchasedAsin" /></TableHead>
                    <TableHead className="text-right"><SortHeader label="间接订单" value="otherSkuOrders" /></TableHead>
                    <TableHead className="text-right"><SortHeader label="间接销售额" value="otherSkuSales" /></TableHead>
                    <TableHead>投放</TableHead>
                    <TableHead>匹配类型</TableHead>
                    <TableHead>路径类型</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tableRows.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell>{row.startDate}</TableCell>
                      <TableCell className="max-w-[260px] truncate" title={row.campaignName}>{row.campaignName}</TableCell>
                      <TableCell>{row.advertisedAsin}</TableCell>
                      <TableCell>{row.purchasedAsin}</TableCell>
                      <TableCell className="text-right">{row.isDirectPurchase ? '-' : row.otherSkuOrders.toLocaleString()}</TableCell>
                      <TableCell className="text-right">{row.isDirectPurchase ? '-' : formatMoney(row.otherSkuSales, currency)}</TableCell>
                      <TableCell className="max-w-[220px] truncate" title={row.targeting}>{row.targeting}</TableCell>
                      <TableCell>{row.matchType}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={row.isDirectPurchase ? 'border-emerald-600 text-emerald-700 bg-emerald-50' : 'border-indigo-600 text-indigo-700 bg-indigo-50'}>
                          {row.isDirectPurchase ? '直接转化' : '间接转化'}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>转化结构与购买集中度</CardTitle>
            <CardDescription>从路径结构看广告真实贡献，再看购买ASIN分布集中在哪些商品</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">直接 vs 间接路径</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[280px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={pathPieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} label>
                        <Cell fill="#22c55e" />
                        <Cell fill="#4f46e5" />
                      </Pie>
                      <Tooltip />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">购买ASIN Top10（按路径数）</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[280px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={purchasedAsinBarData} margin={{ left: 8, right: 8 }}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="asin" hide />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      <Bar dataKey="count" name="路径数" fill="#06b6d4" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>联合贡献视图（广告ASIN）</CardTitle>
            <CardDescription>直接订单/销售来自推广商品报表；间接订单/销售来自已购买商品报表</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>广告ASIN</TableHead>
                    <TableHead className="text-right">直接订单</TableHead>
                    <TableHead className="text-right">直接销售额</TableHead>
                    <TableHead className="text-right">间接订单</TableHead>
                    <TableHead className="text-right">间接销售额</TableHead>
                    <TableHead className="text-right">总订单</TableHead>
                    <TableHead className="text-right">总销售额</TableHead>
                    <TableHead className="text-right">间接销售占比</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {combinedContributionRows.slice(0, 60).map((row) => (
                    <TableRow key={row.asin}>
                      <TableCell>{row.asin}</TableCell>
                      <TableCell className="text-right">{row.directOrders.toLocaleString()}</TableCell>
                      <TableCell className="text-right">{formatMoney(row.directSales, currency)}</TableCell>
                      <TableCell className="text-right">{row.indirectOrders.toLocaleString()}</TableCell>
                      <TableCell className="text-right">{formatMoney(row.indirectSales, currency)}</TableCell>
                      <TableCell className="text-right">{row.totalOrders.toLocaleString()}</TableCell>
                      <TableCell className="text-right">{formatMoney(row.totalSales, currency)}</TableCell>
                      <TableCell className="text-right">{formatPct(row.indirectSalesShare)}</TableCell>
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
              <span>交叉销售机会</span>
              <UiTooltip>
                <UiTooltipTrigger asChild>
                  <button type="button" className="inline-flex h-5 w-5 items-center justify-center text-muted-foreground hover:text-foreground">
                    <CircleHelp className="h-4 w-4" />
                  </button>
                </UiTooltipTrigger>
                <UiTooltipContent side="top" align="start" className="max-w-[420px] text-xs leading-5">
                  <div>高优先级组合默认规则：间接销售额或间接订单达到阈值。</div>
                  <div>入口款识别依据：间接路径占比+间接销售额双条件。</div>
                  <div>建议按月复盘并更新“经常一起购买/组合包/商品投放定向”。</div>
                </UiTooltipContent>
              </UiTooltip>
            </CardTitle>
            <CardDescription>重点关注“广告ASIN → 购买ASIN”的高频间接路径，优先做关联推荐和组合策略</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-8">
              <div className="space-y-1">
                <div className="text-xs text-muted-foreground">高优先销售阈值</div>
                <Input type="number" min={0} step="0.1" value={pairPrioritySales} onChange={(e) => setPairPrioritySales(e.target.value)} />
              </div>
              <div className="space-y-1">
                <div className="text-xs text-muted-foreground">高优先订单阈值</div>
                <Input type="number" min={0} value={pairPriorityOrders} onChange={(e) => setPairPriorityOrders(e.target.value)} />
              </div>
              <div className="space-y-1">
                <div className="text-xs text-muted-foreground">入口款间接占比阈值(%)</div>
                <Input type="number" min={1} step="0.1" value={entryHighRatePct} onChange={(e) => setEntryHighRatePct(e.target.value)} />
              </div>
              <div className="space-y-1">
                <div className="text-xs text-muted-foreground">核心款间接占比阈值(%)</div>
                <Input type="number" min={0} step="0.1" value={entryCoreRatePct} onChange={(e) => setEntryCoreRatePct(e.target.value)} />
              </div>
              <div className="space-y-1">
                <div className="text-xs text-muted-foreground">入口款最小间接销售额</div>
                <Input type="number" min={0} step="0.1" value={entryMinIndirectSales} onChange={(e) => setEntryMinIndirectSales(e.target.value)} />
              </div>
              <div className="space-y-1">
                <div className="text-xs text-muted-foreground">评分权重-路径数</div>
                <Input type="number" min={0} step="0.1" value={scoreWeightPath} onChange={(e) => setScoreWeightPath(e.target.value)} />
              </div>
              <div className="space-y-1">
                <div className="text-xs text-muted-foreground">评分权重-间接销售</div>
                <Input type="number" min={0} step="0.1" value={scoreWeightSales} onChange={(e) => setScoreWeightSales(e.target.value)} />
              </div>
              <div className="space-y-1">
                <div className="text-xs text-muted-foreground">评分权重-间接订单</div>
                <Input type="number" min={0} step="0.1" value={scoreWeightOrders} onChange={(e) => setScoreWeightOrders(e.target.value)} />
              </div>
            </div>
            <div className="rounded-md border px-3 py-2 text-xs text-muted-foreground space-y-1">
              <div>字段说明与建议值：</div>
              <div>高优先销售阈值：定义“高价值组合”的最小间接销售额，常用 20-50。</div>
              <div>高优先订单阈值：定义“高频组合”的最小间接订单数，常用 2-5。</div>
              <div>入口款间接占比阈值：高于该值且间接销售达标，判定为入口款，常用 40%-60%。</div>
              <div>核心款间接占比阈值：低于该值，说明直接转化更强，常用 15%-25%。</div>
              <div>评分权重：路径数偏“稳定性”、间接销售偏“金额价值”、间接订单偏“规模价值”，默认 1:1:1。</div>
            </div>
            <div className="overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>广告ASIN</TableHead>
                    <TableHead>购买ASIN</TableHead>
                    <TableHead className="text-right">路径数</TableHead>
                    <TableHead className="text-right">间接订单</TableHead>
                    <TableHead className="text-right">间接销售额</TableHead>
                    <TableHead className="text-right">优先级评分</TableHead>
                    <TableHead>优先级</TableHead>
                    <TableHead>动作建议</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {crossSellPairs.map((row) => (
                    <TableRow key={`${row.advertisedAsin}-${row.purchasedAsin}`}>
                      <TableCell>{row.advertisedAsin}</TableCell>
                      <TableCell>{row.purchasedAsin}</TableCell>
                      <TableCell className="text-right">{row.count.toLocaleString()}</TableCell>
                      <TableCell className="text-right">{row.orders.toLocaleString()}</TableCell>
                      <TableCell className="text-right">{formatMoney(row.sales, currency)}</TableCell>
                      <TableCell className="text-right">{row.priorityScore.toFixed(1)}</TableCell>
                      <TableCell>{row.roleHint}</TableCell>
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
            <CardTitle>入口商品角色定位</CardTitle>
            <CardDescription>根据间接路径占比和间接销售额识别引流款、核心款和问题款</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 md:grid-cols-3">
              <Card><CardContent className="pt-6"><div className="text-xs text-muted-foreground">高流量入口款</div><div className="text-xl font-semibold">{roleSummary['高流量入口款'].toLocaleString()}</div></CardContent></Card>
              <Card><CardContent className="pt-6"><div className="text-xs text-muted-foreground">高转化核心款</div><div className="text-xl font-semibold">{roleSummary['高转化核心款'].toLocaleString()}</div></CardContent></Card>
              <Card><CardContent className="pt-6"><div className="text-xs text-muted-foreground">低效问题款</div><div className="text-xl font-semibold">{roleSummary['低效问题款'].toLocaleString()}</div></CardContent></Card>
            </div>
            <div className="overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>广告ASIN</TableHead>
                    <TableHead className="text-right">路径总数</TableHead>
                    <TableHead className="text-right">间接路径占比</TableHead>
                    <TableHead className="text-right">间接订单</TableHead>
                    <TableHead className="text-right">间接销售额</TableHead>
                    <TableHead>角色</TableHead>
                    <TableHead>动作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {entryProducts.map((row) => (
                    <TableRow key={row.asin}>
                      <TableCell>{row.asin}</TableCell>
                      <TableCell className="text-right">{row.totalPaths.toLocaleString()}</TableCell>
                      <TableCell className="text-right">{formatPct(row.indirectRate)}</TableCell>
                      <TableCell className="text-right">{row.indirectOrders.toLocaleString()}</TableCell>
                      <TableCell className="text-right">{formatMoney(row.indirectSales, currency)}</TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={
                            row.role === '高流量入口款'
                              ? 'border-indigo-600 text-indigo-700 bg-indigo-50'
                              : row.role === '高转化核心款'
                                ? 'border-emerald-600 text-emerald-700 bg-emerald-50'
                                : 'border-muted-foreground text-muted-foreground'
                          }
                        >
                          {row.role}
                        </Badge>
                      </TableCell>
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
            <CardTitle>运营动作建议</CardTitle>
            <CardDescription>导出路径明细、交叉销售机会与入口商品定位，直接用于复盘与执行</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-md border px-3 py-2 text-xs text-muted-foreground">
              说明：本报告“7天内其他SKU订单数/销售额”是间接转化指标，不包含直接订单。直接转化请结合“推广的商品报告”查看订单与销售。
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button className="gap-2" onClick={exportDecision}>
                <Download className="h-4 w-4" />
                一键导出已购买商品决策 Excel
              </Button>
            </div>
            <div className="text-sm text-muted-foreground">
              当前筛选下，间接路径占比为 {formatPct(summary.indirectPathRate)}，间接销售额为 {formatMoney(summary.indirectSales, currency)}。
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
