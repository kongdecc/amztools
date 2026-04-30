import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowDown, ArrowLeft, ArrowUp, ArrowUpDown, CalendarClock, Download, Loader2, Upload } from 'lucide-react';
import { useDropzone } from 'react-dropzone';
import { Link } from 'wouter';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';
import { Area, AreaChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { parsePerformanceOverTimeReport, type PerformanceOverTimeRecord } from '@/lib/report-parsers';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { createUploadHistoryStore, type HistoryMeta } from '@/lib/upload-history';
import { cn } from '@/lib/utils';

function formatMoney(value: number, currency: string) {
  return new Intl.NumberFormat('zh-CN', { style: 'currency', currency, maximumFractionDigits: 2 }).format(value);
}

function formatPct(value: number) {
  return `${(value * 100).toFixed(2)}%`;
}

type SortKey = 'startDate' | 'country' | 'clicks' | 'spend' | 'cpc' | 'orders' | 'sales' | 'acos' | 'conversionRate';
type TimeBucket = '高效时段' | '扩量时段' | '控本时段' | '观察时段';

function classifyTimeBucket(item: PerformanceOverTimeRecord, targetAcos: number, avgCpc: number): TimeBucket {
  const acosForDecision = item.sales > 0 ? item.acos : item.spend > 0 ? Number.POSITIVE_INFINITY : 0;
  const lowAcos = acosForDecision <= targetAcos;
  const lowCpc = item.cpc <= avgCpc || avgCpc === 0;
  if (lowAcos && lowCpc) return '高效时段';
  if (lowAcos && !lowCpc) return '扩量时段';
  if (!lowAcos && !lowCpc) return '控本时段';
  return '观察时段';
}

export default function PerformanceOverTimeReportPage() {
  const historyStore = useMemo(() => createUploadHistoryStore('performance-over-time-upload'), []);
  const [rows, setRows] = useState<PerformanceOverTimeRecord[]>([]);
  const [fileLabel, setFileLabel] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [currency, setCurrency] = useState('USD');
  const [query, setQuery] = useState('');
  const [countryFilter, setCountryFilter] = useState('全部');
  const [bucketFilter, setBucketFilter] = useState<'全部' | TimeBucket>('全部');
  const [minSpend, setMinSpend] = useState('');
  const [maxAcos, setMaxAcos] = useState('');
  const [targetAcos, setTargetAcos] = useState('30');
  const [sortKey, setSortKey] = useState<SortKey>('startDate');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [tableLimit, setTableLimit] = useState('200');
  const [historyItems, setHistoryItems] = useState<HistoryMeta[]>([]);
  const [mergeEnabled, setMergeEnabled] = useState(true);
  const [mergeTargetId, setMergeTargetId] = useState<string | null>(null);
  const historyItemsRef = useRef<HistoryMeta[]>([]);

  const buildRowKey = (row: PerformanceOverTimeRecord) => [row.startDate, row.endDate, row.country, row.clicks, row.spend].join('|').toLowerCase();

  const mergeRecords = (base: PerformanceOverTimeRecord[], incoming: PerformanceOverTimeRecord[]) => {
    const map = new Map<string, PerformanceOverTimeRecord>();
    for (const row of base) map.set(buildRowKey(row), row);
    for (const row of incoming) map.set(buildRowKey(row), row);
    return Array.from(map.values());
  };

  const getRangeSummary = (items: PerformanceOverTimeRecord[]) => {
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
    setCountryFilter('全部');
    setBucketFilter('全部');
    setMinSpend('');
    setMaxAcos('');
    setSortKey('startDate');
    setSortDirection('desc');
  };

  const resetAll = () => {
    setRows([]);
    setFileLabel('');
    setCurrency('USD');
    setTableLimit('200');
    setTargetAcos('30');
    resetFilters();
  };

  const onDrop = async (files: File[]) => {
    if (!files.length) return;
    setIsLoading(true);
    try {
      let merged: PerformanceOverTimeRecord[] = [];
      let nextCurrency: string | null = null;
      for (const file of files) {
        const { records, currency: detectedCurrency } = await parsePerformanceOverTimeReport(file);
        merged = merged.concat(records);
        if (!nextCurrency && detectedCurrency) nextCurrency = detectedCurrency;
      }
      const dedupMap = new Map<string, PerformanceOverTimeRecord>();
      for (const item of merged) dedupMap.set(buildRowKey(item), item);
      const deduped = Array.from(dedupMap.values());

      let baseData: PerformanceOverTimeRecord[] = [];
      if (mergeTargetId) {
        const records = await historyStore.loadRecords<PerformanceOverTimeRecord>(mergeTargetId);
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
      toast.success(`已解析 ${deduped.length} 条按时间效果数据，当前 ${finalRows.length} 条`);
    } catch (error) {
      console.error(error);
      toast.error('按时间查看效果报表解析失败');
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

  const countryOptions = useMemo(() => {
    const values = Array.from(new Set(rows.map((r) => r.country).filter(Boolean)));
    values.sort((a, b) => a.localeCompare(b, 'zh-Hans-CN'));
    return values;
  }, [rows]);

  const targetAcosValue = Math.max(1, Number(targetAcos) || 30);
  const avgCpcAll = useMemo(() => {
    const totalClicks = rows.reduce((acc, curr) => acc + curr.clicks, 0);
    if (totalClicks <= 0) return 0;
    return rows.reduce((acc, curr) => acc + curr.spend, 0) / totalClicks;
  }, [rows]);

  const filteredRows = useMemo(() => {
    const q = query.trim().toLowerCase();
    const minSpendValue = Number(minSpend);
    const maxAcosValue = Number(maxAcos);
    return rows.filter((row) => {
      if (q) {
        const haystack = `${row.startDate} ${row.endDate} ${row.country}`.toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      if (countryFilter !== '全部' && row.country !== countryFilter) return false;
      if (bucketFilter !== '全部' && classifyTimeBucket(row, targetAcosValue, avgCpcAll) !== bucketFilter) return false;
      if (Number.isFinite(minSpendValue) && minSpendValue > 0 && row.spend < minSpendValue) return false;
      const acosForFilter = row.sales > 0 ? row.acos : row.spend > 0 ? Number.POSITIVE_INFINITY : 0;
      if (Number.isFinite(maxAcosValue) && maxAcosValue > 0 && acosForFilter > maxAcosValue) return false;
      return true;
    });
  }, [rows, query, countryFilter, bucketFilter, minSpend, maxAcos, targetAcosValue, avgCpcAll]);

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
    const avgDailySpend = filteredRows.length ? filteredRows.reduce((acc, curr) => acc + curr.avgDailySpend, 0) / filteredRows.length : 0;
    return { spend, sales, orders, clicks, impressions, acos, roas, ctr, cpc, conversionRate, avgDailySpend };
  }, [filteredRows]);

  const bucketRows = useMemo(
    () => filteredRows.map((item) => ({ ...item, bucket: classifyTimeBucket(item, targetAcosValue, avgCpcAll) })),
    [filteredRows, targetAcosValue, avgCpcAll]
  );

  const bucketSummary = useMemo(() => {
    const map = new Map<TimeBucket, { count: number; spend: number; sales: number }>();
    for (const row of bucketRows) {
      const hit = map.get(row.bucket) ?? { count: 0, spend: 0, sales: 0 };
      hit.count += 1;
      hit.spend += row.spend;
      hit.sales += row.sales;
      map.set(row.bucket, hit);
    }
    return (['高效时段', '扩量时段', '控本时段', '观察时段'] as const).map((q) => {
      const hit = map.get(q) ?? { count: 0, spend: 0, sales: 0 };
      return { bucket: q, ...hit };
    });
  }, [bucketRows]);

  const trendRows = useMemo(
    () =>
      [...bucketRows]
        .sort((a, b) => a.startDate.localeCompare(b.startDate))
        .map((row) => ({
          period: row.startDate === row.endDate ? row.startDate : `${row.startDate}~${row.endDate}`,
          spend: Number(row.spend.toFixed(2)),
          sales: Number(row.sales.toFixed(2)),
          clicks: row.clicks,
        })),
    [bucketRows]
  );

  const actionRows = useMemo(
    () =>
      [...bucketRows]
        .sort((a, b) => b.spend - a.spend || b.clicks - a.clicks)
        .slice(0, 50)
        .map((row) => ({
          ...row,
          action:
            row.bucket === '高效时段'
              ? '提高该时段竞价与预算'
              : row.bucket === '扩量时段'
                ? '维持预算并优化词包承接'
                : row.bucket === '控本时段'
                  ? '下调竞价或限制预算'
                  : '继续观察样本量',
        })),
    [bucketRows]
  );

  const sortedRows = useMemo(() => {
    const items = [...bucketRows];
    items.sort((a, b) => {
      const readValue = (row: (PerformanceOverTimeRecord & { bucket: TimeBucket })) => {
        if (sortKey === 'country') return row.country.toLowerCase();
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
      if (na === nb) return b.spend - a.spend;
      return sortDirection === 'asc' ? na - nb : nb - na;
    });
    return items;
  }, [bucketRows, sortKey, sortDirection]);

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

  const exportDecision = () => {
    const wb = XLSX.utils.book_new();
    const detailSheet = sortedRows.map((row) => ({
      开始日期: row.startDate,
      结束日期: row.endDate,
      国家地区: row.country,
      点击量: row.clicks,
      [`花费(${currency})`]: Number(row.spend.toFixed(2)),
      [`销售额(${currency})`]: Number(row.sales.toFixed(2)),
      ACOS百分比: Number(row.acos.toFixed(2)),
      CPC: Number(row.cpc.toFixed(3)),
      分析分层: row.bucket,
    }));
    const actionSheet = actionRows.map((row) => ({
      开始日期: row.startDate,
      结束日期: row.endDate,
      分层: row.bucket,
      [`花费(${currency})`]: Number(row.spend.toFixed(2)),
      ACOS百分比: Number(row.acos.toFixed(2)),
      建议动作: row.action,
    }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(detailSheet), '按时间明细');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(actionSheet), '时段动作建议');
    XLSX.writeFile(wb, `按时间效果分析-${Date.now()}.xlsx`);
    toast.success('已导出按时间效果决策清单');
  };

  if (!rows.length) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
        <div className="w-full max-w-4xl text-center space-y-6 animate-in fade-in zoom-in duration-500">
          <div className="space-y-2">
            <h1 className="text-4xl font-extrabold tracking-tight lg:text-5xl bg-clip-text text-transparent bg-gradient-to-r from-primary to-slate-800">
              按时间查看效果报表分析
            </h1>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
              按时间识别高效时段、扩量时段与控本时段，优化预算节奏与分时竞价。
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
              <div className="text-lg font-medium">{isLoading ? '解析中…' : '上传按时间查看效果报表'}</div>
              <div className="text-sm text-muted-foreground">支持 .csv / .xlsx / .xls，可批量上传</div>
            </div>
            <div className="absolute bottom-4 flex items-center gap-2 text-xs text-muted-foreground">
              <CalendarClock className="h-3.5 w-3.5" />
              <span>支持 Amazon 商品推广按时间查看效果报表</span>
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
                            const records = await historyStore.loadRecords<PerformanceOverTimeRecord>(item.id);
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
            <h1 className="text-2xl font-semibold tracking-tight">按时间查看效果报表分析</h1>
            <p className="text-sm text-muted-foreground">按时间段汇总表现并分层建议，辅助分时预算与竞价管理。</p>
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
          <Card><CardContent className="pt-6"><div className="text-xs text-muted-foreground">点击</div><div className="text-xl font-semibold">{summary.clicks.toLocaleString()}</div></CardContent></Card>
          <Card><CardContent className="pt-6"><div className="text-xs text-muted-foreground">销售额</div><div className="text-xl font-semibold">{formatMoney(summary.sales, currency)}</div></CardContent></Card>
          <Card><CardContent className="pt-6"><div className="text-xs text-muted-foreground">日均花费</div><div className="text-xl font-semibold">{formatMoney(summary.avgDailySpend, currency)}</div></CardContent></Card>
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
          <Card><CardContent className="pt-6"><div className="text-xs text-muted-foreground">基准 CPC</div><div className="text-xl font-semibold">{formatMoney(avgCpcAll, currency)}</div></CardContent></Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>筛选与明细</CardTitle>
            <CardDescription>按国家、分层、阈值筛选并排序</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
              <div className="space-y-1">
                <div className="text-xs text-muted-foreground">搜索日期/国家</div>
                <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="输入关键字" />
              </div>
              <div className="space-y-1">
                <div className="text-xs text-muted-foreground">国家/地区</div>
                <Select value={countryFilter} onValueChange={setCountryFilter}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="全部">全部</SelectItem>
                    {countryOptions.map((name) => <SelectItem key={name} value={name}>{name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <div className="text-xs text-muted-foreground">时段分层</div>
                <Select value={bucketFilter} onValueChange={(value) => setBucketFilter(value as '全部' | TimeBucket)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="全部">全部</SelectItem>
                    <SelectItem value="高效时段">高效时段</SelectItem>
                    <SelectItem value="扩量时段">扩量时段</SelectItem>
                    <SelectItem value="控本时段">控本时段</SelectItem>
                    <SelectItem value="观察时段">观察时段</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <div className="text-xs text-muted-foreground">最小花费</div>
                <Input type="number" min={0} step="0.1" value={minSpend} onChange={(e) => setMinSpend(e.target.value)} />
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
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
                    <TableHead><SortHeader label="开始日期" value="startDate" /></TableHead>
                    <TableHead><SortHeader label="国家" value="country" /></TableHead>
                    <TableHead className="text-right"><SortHeader label="点击" value="clicks" /></TableHead>
                    <TableHead className="text-right"><SortHeader label="花费" value="spend" /></TableHead>
                    <TableHead className="text-right"><SortHeader label="CPC" value="cpc" /></TableHead>
                    <TableHead className="text-right"><SortHeader label="订单" value="orders" /></TableHead>
                    <TableHead className="text-right"><SortHeader label="销售" value="sales" /></TableHead>
                    <TableHead className="text-right"><SortHeader label="ACOS" value="acos" /></TableHead>
                    <TableHead className="text-right"><SortHeader label="CVR" value="conversionRate" /></TableHead>
                    <TableHead>分层</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tableRows.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell>{row.startDate}</TableCell>
                      <TableCell>{row.country}</TableCell>
                      <TableCell className="text-right">{row.clicks.toLocaleString()}</TableCell>
                      <TableCell className="text-right">{formatMoney(row.spend, currency)}</TableCell>
                      <TableCell className="text-right">{formatMoney(row.cpc, currency)}</TableCell>
                      <TableCell className="text-right">{row.orders.toLocaleString()}</TableCell>
                      <TableCell className="text-right">{formatMoney(row.sales, currency)}</TableCell>
                      <TableCell className="text-right">{row.acos.toFixed(2)}%</TableCell>
                      <TableCell className="text-right">{formatPct(row.conversionRate)}</TableCell>
                      <TableCell>{row.bucket}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>趋势与时段分层</CardTitle>
            <CardDescription>趋势图看花费/销售节奏，分层图看资源倾斜方向</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 lg:grid-cols-2">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">趋势（花费/销售）</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-[280px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={trendRows}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="period" hide />
                        <YAxis />
                        <Tooltip />
                        <Legend />
                        <Area type="monotone" dataKey="spend" name="花费" stroke="#4f46e5" fill="#4f46e5" fillOpacity={0.2} />
                        <Area type="monotone" dataKey="sales" name="销售额" stroke="#06b6d4" fill="#06b6d4" fillOpacity={0.2} />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">分层数量分布</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-[280px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={bucketSummary}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="bucket" />
                        <YAxis />
                        <Tooltip />
                        <Legend />
                        <Area type="monotone" dataKey="count" name="时段数" stroke="#f97316" fill="#f97316" fillOpacity={0.25} />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>开始日期</TableHead>
                    <TableHead>结束日期</TableHead>
                    <TableHead>分层</TableHead>
                    <TableHead className="text-right">花费</TableHead>
                    <TableHead className="text-right">ACOS</TableHead>
                    <TableHead>动作建议</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {actionRows.map((row) => (
                    <TableRow key={`${row.id}-act`}>
                      <TableCell>{row.startDate}</TableCell>
                      <TableCell>{row.endDate}</TableCell>
                      <TableCell>{row.bucket}</TableCell>
                      <TableCell className="text-right">{formatMoney(row.spend, currency)}</TableCell>
                      <TableCell className="text-right">{row.acos.toFixed(2)}%</TableCell>
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
            <CardDescription>导出明细与时段动作建议，支持大促前后复盘</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <Button className="gap-2" onClick={exportDecision}>
                <Download className="h-4 w-4" />
                一键导出按时间效果决策 Excel
              </Button>
            </div>
            <div className="text-sm text-muted-foreground">
              当前筛选下高效时段 {bucketSummary.find((b) => b.bucket === '高效时段')?.count ?? 0} 个，控本时段 {bucketSummary.find((b) => b.bucket === '控本时段')?.count ?? 0} 个。
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
