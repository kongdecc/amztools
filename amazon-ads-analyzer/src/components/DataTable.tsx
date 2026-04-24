import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { AdRecord } from "@/types";
import type { AggregatedRowDetails } from "@/lib/aggregate";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import { cn } from "@/lib/utils";
import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { format } from "date-fns";
import type { DateRange } from "react-day-picker";
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useStore } from "@/store";
import { ArrowDown, ArrowUp, ArrowUpDown, CalendarIcon, ChevronDown, Copy, Download, FilterX, RotateCcw } from "lucide-react";
import * as XLSX from "xlsx";

interface DataTableProps {
  data: AdRecord[];
  targetAcos: number;
  currency: string;
  aggregatedDetailsById?: Record<string, AggregatedRowDetails>;
  onSearchTermCompare?: (term: string) => void;
}

type SortKey =
  | "searchTerm"
  | "campaignName"
  | "adGroupName"
  | "matchType"
  | "impressions"
  | "clicks"
  | "spend"
  | "sales"
  | "orders"
  | "ctr"
  | "cpc"
  | "acos"
  | "roas"
  | "conversionRate";

type SortDir = "asc" | "desc";

function getAcosForCompare(row: AdRecord) {
  if (row.sales > 0) return row.acos;
  if (row.spend > 0) return Number.POSITIVE_INFINITY;
  return 0;
}

function getSortValue(row: AdRecord, key: SortKey) {
  if (key === "acos") return getAcosForCompare(row);
  return row[key];
}

function isAsin(value: string) {
  const t = value.trim();
  if (!t) return false;
  if (/\s/.test(t)) return false;
  if (!t.toLowerCase().startsWith("b0")) return false;
  if (/^b0[a-z0-9]{8}$/i.test(t)) return true;
  return t.length >= 10;
}

function getPaginationItems(current: number, total: number) {
  const items: Array<number | "ellipsis"> = [];
  const add = (v: number | "ellipsis") => items.push(v);

  if (total <= 7) {
    for (let i = 1; i <= total; i += 1) add(i);
    return items;
  }

  add(1);
  const left = Math.max(2, current - 1);
  const right = Math.min(total - 1, current + 1);

  if (left > 2) add("ellipsis");
  for (let i = left; i <= right; i += 1) add(i);
  if (right < total - 1) add("ellipsis");
  add(total);

  return items;
}

function toUniqueSorted(values: string[]) {
  return Array.from(new Set(values.filter(Boolean))).sort((a, b) =>
    a.localeCompare(b, "zh-Hans-CN")
  );
}

function parseNumberInput(value: string) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function isMultiValueLabel(v: string) {
  return v.startsWith("（多：") && v.endsWith("）");
}

async function copyToClipboard(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const el = document.createElement("textarea");
      el.value = text;
      el.setAttribute("readonly", "true");
      el.style.position = "fixed";
      el.style.left = "-9999px";
      document.body.appendChild(el);
      el.select();
      const ok = document.execCommand("copy");
      document.body.removeChild(el);
      return ok;
    } catch {
      return false;
    }
  }
}

function NumberInput({
  value,
  onChangeNumber,
  placeholder,
}: {
  value: number | null;
  onChangeNumber: (value: number | null) => void;
  placeholder?: string;
}) {
  const [focused, setFocused] = useState(false);
  const [text, setText] = useState("");

  const displayValue = focused ? text : value === null ? "" : String(value);

  return (
    <Input
      type="number"
      min={0}
      value={displayValue}
      placeholder={placeholder}
      onFocus={() => {
        setFocused(true);
        setText(value === null ? "" : String(value));
      }}
      onBlur={() => {
        setFocused(false);
        if (text.trim() === "") onChangeNumber(null);
        else onChangeNumber(Math.max(0, parseNumberInput(text)));
      }}
      onChange={(e) => {
        const nextText = e.target.value;
        setText(nextText);
        if (nextText.trim() === "") onChangeNumber(null);
        else onChangeNumber(Math.max(0, parseNumberInput(nextText)));
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          (e.currentTarget as HTMLInputElement).blur();
        }
      }}
    />
  );
}

function RangeInput({
  label,
  minValue,
  maxValue,
  onChangeMin,
  onChangeMax,
  resetKey,
}: {
  label: string;
  minValue: number | null;
  maxValue: number | null;
  onChangeMin: (value: number | null) => void;
  onChangeMax: (value: number | null) => void;
  resetKey: number;
}) {
  return (
    <div className="space-y-1">
      <Label>{label}</Label>
      <div className="grid grid-cols-2 gap-2">
        <NumberInput
          key={`${resetKey}-${label}-min`}
          value={minValue}
          onChangeNumber={onChangeMin}
          placeholder="最小"
        />
        <NumberInput
          key={`${resetKey}-${label}-max`}
          value={maxValue}
          onChangeNumber={onChangeMax}
          placeholder="最大"
        />
      </div>
    </div>
  );
}

function MultiSelectDropdown({
  label,
  options,
  selected,
  onChange,
}: {
  label: string;
  options: string[];
  selected: string[];
  onChange: (next: string[]) => void;
}) {
  const selectedSet = useMemo(() => new Set(selected), [selected]);
  const summary = selected.length ? `${label}（${selected.length}）` : `${label}（全部）`;
  const [open, setOpen] = useState(false);
  const [keyword, setKeyword] = useState("");
  const filteredOptions = useMemo(() => {
    const q = keyword.trim().toLowerCase();
    if (!q) return options;
    return options.filter((opt) => opt.toLowerCase().includes(q));
  }, [keyword, options]);

  return (
    <DropdownMenu
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setKeyword("");
      }}
    >
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="default" className="justify-between w-full">
          <span className="truncate">{summary}</span>
          <ChevronDown className="w-4 h-4 opacity-60" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        className="min-w-[240px] w-[var(--radix-popper-anchor-width)] max-h-[420px] overflow-auto"
      >
        <DropdownMenuLabel>{label}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <div className="px-2 pb-2">
          <Input
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            placeholder={`输入关键词筛选${label}`}
          />
        </div>
        <div className="flex gap-2 px-2 pb-2">
          <Button variant="secondary" size="sm" onClick={() => onChange([])}>
            全部
          </Button>
          <Button variant="outline" size="sm" onClick={() => onChange(filteredOptions)}>
            全选
          </Button>
        </div>
        <DropdownMenuSeparator />
        {filteredOptions.map((opt) => (
          <DropdownMenuCheckboxItem
            key={opt}
            checked={selectedSet.has(opt)}
            onCheckedChange={(checked) => {
              if (checked) onChange([...selected, opt]);
              else onChange(selected.filter((x) => x !== opt));
            }}
          >
            <span className="truncate">{opt}</span>
          </DropdownMenuCheckboxItem>
        ))}
        {options.length && !filteredOptions.length ? (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem disabled>无匹配结果</DropdownMenuItem>
          </>
        ) : null}
        {!options.length ? (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem disabled>暂无可选项</DropdownMenuItem>
          </>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function DataTable({ data, targetAcos, currency, aggregatedDetailsById, onSearchTermCompare }: DataTableProps) {
  const { data: rawData, fileName, settings, updateSettings, resetFilters, filtersVersion } = useStore();
  const baseData = useMemo(() => rawData ?? [], [rawData]);
  const [sortKey, setSortKey] = useState<SortKey>("spend");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [pageSize, setPageSize] = useState<number>(50);
  const [customPageSizeInput, setCustomPageSizeInput] = useState<string>("");
  const [panelOpen, setPanelOpen] = useState(false);
  const [page, setPage] = useState<number>(1);
  const [filtersOpen, setFiltersOpen] = useState(true);
  const [metricsOpen, setMetricsOpen] = useState(true);
  const [termScope, setTermScope] = useState<"keywords" | "all" | "asin">("all");
  const [copyFeedback, setCopyFeedback] = useState<{ id: string; ok: boolean } | null>(null);
  const [expandedAgg, setExpandedAgg] = useState<Record<string, boolean>>({});
  const copyFeedbackTimerRef = useRef<number | null>(null);
  const reportRangeKeyRef = useRef<string | null>(null);
  const [calendarAnchor, setCalendarAnchor] = useState<{ key: string; month: Date } | null>(null);
  const [calendarKey, setCalendarKey] = useState(0);

  useEffect(() => {
    return () => {
      if (copyFeedbackTimerRef.current !== null) {
        window.clearTimeout(copyFeedbackTimerRef.current);
      }
    };
  }, []);

  const campaignOptions = useMemo(() => toUniqueSorted(baseData.map((d) => d.campaignName)), [baseData]);
  const adGroupOptions = useMemo(() => toUniqueSorted(baseData.map((d) => d.adGroupName)), [baseData]);
  const matchTypeOptions = useMemo(() => toUniqueSorted(baseData.map((d) => d.matchType)), [baseData]);
  const reportDateRange = useMemo(() => {
    const dates = baseData.map((r) => r.date).filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d));
    if (!dates.length) return null;
    const minYmd = dates.reduce((acc, d) => (d < acc ? d : acc), dates[0]);
    const maxYmd = dates.reduce((acc, d) => (d > acc ? d : acc), dates[0]);
    return {
      minYmd,
      maxYmd,
      from: new Date(`${minYmd}T00:00:00.000Z`),
      to: new Date(`${maxYmd}T00:00:00.000Z`),
    };
  }, [baseData]);
  const reportRangeKey = reportDateRange ? `${reportDateRange.minYmd}-${reportDateRange.maxYmd}` : "empty";
  const calendarDefaultMonth =
    calendarAnchor?.key === reportRangeKey
      ? calendarAnchor.month
      : reportDateRange?.from ?? new Date();
  const isDateDisabled = (d: Date) => {
    if (!reportDateRange) return false;
    const min = reportDateRange.from.getTime();
    const max = reportDateRange.to.getTime();
    const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())).getTime();
    return t < min || t > max;
  };

  useEffect(() => {
    if (!reportDateRange) return;
    const key = `${reportDateRange.minYmd}-${reportDateRange.maxYmd}`;
    if (reportRangeKeyRef.current === key) return;
    reportRangeKeyRef.current = key;
    updateSettings({ dateRange: { from: reportDateRange.from, to: reportDateRange.to } });
  }, [reportDateRange, updateSettings]);

  const money = useMemo(
    () =>
      new Intl.NumberFormat("zh-CN", {
        style: "currency",
        currency,
        maximumFractionDigits: 2,
      }),
    [currency]
  );

  const tableSource = useMemo(() => {
    if (termScope === "all") return data;
    if (termScope === "asin") return data.filter((row) => isAsin(row.searchTerm));
    return data.filter((row) => !isAsin(row.searchTerm));
  }, [data, termScope]);

  const sortedData = useMemo(() => {
    const next = [...tableSource];
    next.sort((a, b) => {
      const av = getSortValue(a, sortKey);
      const bv = getSortValue(b, sortKey);

      let cmp = 0;
      if (typeof av === "number" && typeof bv === "number") cmp = av - bv;
      else cmp = String(av).localeCompare(String(bv), "zh-Hans-CN");

      return sortDir === "asc" ? cmp : -cmp;
    });
    return next;
  }, [sortDir, sortKey, tableSource]);

  const effectivePageSize = pageSize === 0 ? Math.max(1, sortedData.length) : pageSize;
  const totalPages = Math.max(1, Math.ceil(sortedData.length / effectivePageSize));
  const safePage = Math.min(Math.max(page, 1), totalPages);

  const pageData = useMemo(() => {
    const start = (safePage - 1) * effectivePageSize;
    const end = start + effectivePageSize;
    return sortedData.slice(start, end);
  }, [effectivePageSize, safePage, sortedData]);

  const rangeText = useMemo(() => {
    if (!sortedData.length) return "0 / 0";
    const start = (safePage - 1) * effectivePageSize + 1;
    const end = Math.min(sortedData.length, safePage * effectivePageSize);
    return `${start}-${end} / ${sortedData.length}`;
  }, [effectivePageSize, safePage, sortedData.length]);
  const hasActiveFilterConditions = useMemo(() => {
    const hasTextFilter =
      settings.searchTerm.trim().length > 0 ||
      settings.quickFilter.trim().length > 0 ||
      settings.excludeTerm.trim().length > 0;
    const hasSelectFilter =
      settings.campaignNames.length > 0 ||
      settings.adGroupNames.length > 0 ||
      settings.matchTypes.length > 0 ||
      settings.conversion !== "全部";
    const hasRangeFilter =
      settings.minImpressions !== null ||
      settings.impressionsMax !== null ||
      settings.minClicks !== null ||
      settings.clicksMax !== null ||
      settings.spendMin !== null ||
      settings.spendMax !== null ||
      settings.salesMin !== null ||
      settings.salesMax !== null ||
      settings.ordersMin !== null ||
      settings.ordersMax !== null ||
      settings.ctrMinPct !== null ||
      settings.ctrMaxPct !== null ||
      settings.cpcMin !== null ||
      settings.cpcMax !== null ||
      settings.acosMin !== null ||
      settings.acosMax !== null ||
      settings.roasMin !== null ||
      settings.roasMax !== null ||
      settings.conversionRateMinPct !== null ||
      settings.conversionRateMaxPct !== null;
    return hasTextFilter || hasSelectFilter || hasRangeFilter;
  }, [
    settings.acosMax,
    settings.acosMin,
    settings.adGroupNames,
    settings.campaignNames,
    settings.clicksMax,
    settings.conversion,
    settings.conversionRateMaxPct,
    settings.conversionRateMinPct,
    settings.cpcMax,
    settings.cpcMin,
    settings.ctrMaxPct,
    settings.ctrMinPct,
    settings.excludeTerm,
    settings.impressionsMax,
    settings.matchTypes,
    settings.minClicks,
    settings.minImpressions,
    settings.ordersMax,
    settings.ordersMin,
    settings.quickFilter,
    settings.roasMax,
    settings.roasMin,
    settings.salesMax,
    settings.salesMin,
    settings.searchTerm,
    settings.spendMax,
    settings.spendMin,
  ]);

  const aggregatedSourceRows = useMemo(() => {
    if (!aggregatedDetailsById) return null;
    return tableSource.reduce((acc, row) => acc + (aggregatedDetailsById[row.id]?.sourceRows ?? 0), 0);
  }, [aggregatedDetailsById, tableSource]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(key);
      setSortDir("desc");
    }
  };

  const renderSortIndicator = (key: SortKey) => {
    if (sortKey !== key) return <ArrowUpDown className="size-3 opacity-50" />;
    return sortDir === "asc" ? (
      <ArrowUp className="size-3 opacity-90" />
    ) : (
      <ArrowDown className="size-3 opacity-90" />
    );
  };

  const showCopyFeedback = (id: string, ok: boolean) => {
    setCopyFeedback({ id, ok });
    if (copyFeedbackTimerRef.current !== null) window.clearTimeout(copyFeedbackTimerRef.current);
    copyFeedbackTimerRef.current = window.setTimeout(() => setCopyFeedback(null), 1200);
  };

  const toggleAggExpanded = (id: string) => {
    setExpandedAgg((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const toYmd = (d: Date) => format(d, "yyyy-MM-dd");
  const getQuickRange = (days: number) => {
    if (!reportDateRange) return null;
    const max = reportDateRange.to.getTime();
    const min = reportDateRange.from.getTime();
    const startTime = max - (days - 1) * 24 * 60 * 60 * 1000;
    return { from: new Date(Math.max(startTime, min)), to: new Date(max) };
  };
  const isQuickRangeSelected = (days: number) => {
    if (!settings.dateRange.from || !settings.dateRange.to) return false;
    const range = getQuickRange(days);
    if (!range) return false;
    return toYmd(range.from) === toYmd(settings.dateRange.from) && toYmd(range.to) === toYmd(settings.dateRange.to);
  };

  const handleReturnToToday = () => {
    const today = new Date();
    setCalendarAnchor({ key: reportRangeKey, month: today });
    setCalendarKey((k) => k + 1);
    if (!reportDateRange) {
      updateSettings({ dateRange: { from: today, to: today } });
      return;
    }
    const t = new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate())).getTime();
    const min = reportDateRange.from.getTime();
    const max = reportDateRange.to.getTime();
    if (t >= min && t <= max) {
      updateSettings({ dateRange: { from: today, to: today } });
    }
  };

  const handleQuickRange = (days: number) => {
    const range = getQuickRange(days);
    if (!range) return;
    const end = range.to;
    setCalendarAnchor({ key: reportRangeKey, month: end });
    setCalendarKey((k) => k + 1);
    updateSettings({ dateRange: range });
  };

  const renderMultiValueCell = (
    kind: "广告活动" | "广告组" | "匹配类型",
    displayText: string,
    values: string[] | undefined,
    rowId: string,
    stats?: { campaignName: string; adGroupName: string; clicks: number; orders: number }[]
  ) => {
    if (!isMultiValueLabel(displayText) || !values?.length) return <span className="truncate">{displayText}</span>;

    return (
      <HoverCard openDelay={200}>
        <HoverCardTrigger asChild>
          <button
            type="button"
            className="truncate underline decoration-dotted underline-offset-4 text-left"
            onClick={() => toggleAggExpanded(rowId)}
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
            {kind === "广告组" && stats?.length ? (
              <div className="flex flex-wrap gap-1">
                {stats.map((item) => (
                  <Badge key={`${item.campaignName}-${item.adGroupName}`} variant="secondary">
                    {item.campaignName} / {item.adGroupName} · 点击 {item.clicks.toLocaleString()}
                  </Badge>
                ))}
              </div>
            ) : (
              <div className="flex flex-wrap gap-1">
                {values.map((v) => (
                  <Badge key={v} variant="secondary">
                    {v}
                  </Badge>
                ))}
              </div>
            )}
          </div>
        </HoverCardContent>
      </HoverCard>
    );
  };

  const handleExport = () => {
    if (!tableSource.length) return;
    const rows = tableSource.map((row) => {
      const acosText = row.sales > 0 ? row.acos : row.spend > 0 ? Number.POSITIVE_INFINITY : 0;
      const acosExport =
        row.sales > 0 ? Number(row.acos.toFixed(2)) : row.spend > 0 ? "∞" : Number((0).toFixed(2));

      return {
        搜索词: row.searchTerm,
        广告活动: row.campaignName,
        广告组: row.adGroupName,
        匹配类型: row.matchType,
        展示: row.impressions,
        点击: row.clicks,
        CTR百分比: Number((row.ctr * 100).toFixed(2)),
        CPC: Number(row.cpc.toFixed(4)),
        [`花费(${currency})`]: Number(row.spend.toFixed(2)),
        [`销售额(${currency})`]: Number(row.sales.toFixed(2)),
        订单: row.orders,
        ACOS百分比: acosExport,
        ROAS: Number(row.roas.toFixed(4)),
        转化率百分比: Number((row.conversionRate * 100).toFixed(2)),
        ACOS排序值: Number.isFinite(acosText) ? Number(acosText.toFixed(2)) : "∞",
      };
    });

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "分析结果");
    const safeName = fileName ? fileName.replace(/\.[^.]+$/, "") : "分析结果";
    XLSX.writeFile(wb, `${safeName}-分析结果.xlsx`);
  };

  return (
    <Card className="col-span-1 md:col-span-2">
      <Collapsible open={panelOpen} onOpenChange={setPanelOpen}>
        <CardHeader>
          <div className="space-y-3">
            <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <CardTitle>{settings.viewMode === "按搜索词汇总" ? "搜索词汇总" : "搜索词明细"}</CardTitle>
                  <CollapsibleTrigger asChild>
                    <Button variant="ghost" size="sm" className="gap-1">
                      {panelOpen ? "收起" : "展开"}
                      <ChevronDown className={`w-4 h-4 transition-transform ${panelOpen ? "rotate-180" : ""}`} />
                    </Button>
                  </CollapsibleTrigger>
                </div>
                <div className="text-xs text-muted-foreground">
                  {settings.viewMode === "按搜索词汇总" && aggregatedSourceRows !== null
                    ? `共 ${baseData.length} 条，筛选后 ${aggregatedSourceRows} 条，汇总 ${tableSource.length} 个 • ${rangeText}`
                    : `共 ${baseData.length} 条，筛选后 ${tableSource.length} 条 • ${rangeText}`}
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">视图</span>
                  <Select
                    value={settings.viewMode}
                    onValueChange={(v) => updateSettings({ viewMode: v as typeof settings.viewMode })}
                  >
                    <SelectTrigger size="sm" className="w-[180px]">
                      <SelectValue placeholder="视图" />
                    </SelectTrigger>
                    <SelectContent align="end">
                      <SelectItem value="按搜索词汇总">按搜索词汇总</SelectItem>
                      <SelectItem value="明细">明细</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Tabs value={termScope} onValueChange={(v) => { setTermScope(v as typeof termScope); setPage(1); }} className="w-full md:w-auto">
                  <TabsList className="w-full md:w-fit">
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
                <Button variant="outline" size="sm" className="gap-2" onClick={handleExport} disabled={!tableSource.length}>
                  <Download className="w-4 h-4" />
                  导出筛选结果
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-2"
                  onClick={resetFilters}
                  disabled={!hasActiveFilterConditions}
                >
                  <FilterX className="w-4 h-4" />
                  清空筛选
                </Button>
                <Button variant="outline" size="sm" disabled={!panelOpen} onClick={() => setFiltersOpen((v) => !v)}>
                  {filtersOpen ? "收起筛选" : "展开筛选"}
                </Button>
                <div className="flex items-center gap-2">
                  <Select
                    value={String(pageSize)}
                    onValueChange={(v) => {
                      setPageSize(Number(v));
                      setPage(1);
                      setCustomPageSizeInput("");
                    }}
                  >
                    <SelectTrigger size="sm" className="w-[140px]">
                      <SelectValue placeholder="每页条数" />
                    </SelectTrigger>
                    <SelectContent align="end">
                      {[25, 50, 100, 0].includes(pageSize) ? null : (
                        <SelectItem value={String(pageSize)}>每页 {pageSize}</SelectItem>
                      )}
                      <SelectItem value="25">每页 25</SelectItem>
                      <SelectItem value="50">每页 50</SelectItem>
                      <SelectItem value="100">每页 100</SelectItem>
                      <SelectItem value="0">全部</SelectItem>
                    </SelectContent>
                  </Select>
                  <Input
                    className="w-[110px]"
                    type="number"
                    min={1}
                    inputMode="numeric"
                    value={customPageSizeInput}
                    onChange={(e) => {
                      const raw = e.target.value;
                      setCustomPageSizeInput(raw);
                      const next = Math.floor(Number(raw));
                      if (!Number.isFinite(next) || next <= 0) return;
                      setPageSize(next);
                      setPage(1);
                    }}
                    placeholder="自定义"
                  />
                </div>
            </div>
          </div>

          <Collapsible open={panelOpen && filtersOpen} onOpenChange={setFiltersOpen}>
            <CollapsibleContent>
              <div className="rounded-lg border bg-card p-4 space-y-4">
                <div className="space-y-2">
                  <div className="text-xs text-muted-foreground">日期范围（开始日期）</div>
                  <div className="flex flex-wrap gap-2 items-center">
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="min-w-[220px] justify-start gap-2 font-normal"
                        >
                          <CalendarIcon className="w-4 h-4" />
                          {settings.dateRange.from
                            ? settings.dateRange.to
                              ? `${format(settings.dateRange.from, "yyyy-MM-dd")} ~ ${format(
                                  settings.dateRange.to,
                                  "yyyy-MM-dd"
                                )}`
                              : format(settings.dateRange.from, "yyyy-MM-dd")
                            : "全部日期"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent align="start" className="w-auto p-0">
                        <Calendar
                          key={`calendar-${reportRangeKey}-${calendarKey}`}
                          mode="range"
                          numberOfMonths={2}
                          defaultMonth={calendarDefaultMonth}
                          selected={settings.dateRange as DateRange}
                          onSelect={(range) => updateSettings({ dateRange: range ?? {} })}
                          disabled={isDateDisabled}
                        />
                      </PopoverContent>
                    </Popover>
                    <Button
                      type="button"
                      variant={isQuickRangeSelected(7) ? "default" : "outline"}
                      size="sm"
                      className="gap-2"
                      disabled={!reportDateRange}
                      onClick={() => handleQuickRange(7)}
                    >
                      近7天
                    </Button>
                    <Button
                      type="button"
                      variant={isQuickRangeSelected(14) ? "default" : "outline"}
                      size="sm"
                      className="gap-2"
                      disabled={!reportDateRange}
                      onClick={() => handleQuickRange(14)}
                    >
                      近14天
                    </Button>
                    <Button
                      type="button"
                      variant={isQuickRangeSelected(30) ? "default" : "outline"}
                      size="sm"
                      className="gap-2"
                      disabled={!reportDateRange}
                      onClick={() => handleQuickRange(30)}
                    >
                      近30天
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="gap-2"
                      onClick={handleReturnToToday}
                    >
                      <CalendarIcon className="w-4 h-4" />
                      回到今天
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="gap-2"
                      disabled={!settings.dateRange.from && !settings.dateRange.to}
                      onClick={() => updateSettings({ dateRange: {} })}
                    >
                      <RotateCcw className="w-4 h-4" />
                      清除
                    </Button>
                  </div>
                  <div className="text-[11px] text-muted-foreground">
                    原表日期范围：{reportDateRange ? `${reportDateRange.minYmd} ~ ${reportDateRange.maxYmd}` : "—"}
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
                  <div className="md:col-span-4 space-y-1">
                    <Label>搜索词包含</Label>
                    <Input
                      value={settings.searchTerm}
                      onChange={(e) => updateSettings({ searchTerm: e.target.value })}
                      placeholder="例如：usb 充电 / usb,charger"
                    />
                  </div>

                  <div className="md:col-span-4 space-y-1">
                    <Label>快速筛选（搜索词/ASIN）</Label>
                    <Input
                      value={settings.quickFilter}
                      onChange={(e) => updateSettings({ quickFilter: e.target.value })}
                      placeholder="例如：B0XXXXXXX / usb charger"
                    />
                    <div className="text-[11px] text-muted-foreground">
                      B0 开头按 ASIN 精确匹配，其余按包含匹配
                    </div>
                  </div>

                  <div className="md:col-span-4 space-y-1">
                    <Label>排除词</Label>
                    <Input
                      value={settings.excludeTerm}
                      onChange={(e) => updateSettings({ excludeTerm: e.target.value })}
                      placeholder="例如：free 竞品 / free,brand"
                    />
                  </div>

                  <div className="md:col-span-3 space-y-1">
                    <Label>转化</Label>
                    <Select
                      value={settings.conversion}
                      onValueChange={(v) => updateSettings({ conversion: v as typeof settings.conversion })}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="全部" />
                      </SelectTrigger>
                      <SelectContent align="start">
                        <SelectItem value="全部">全部</SelectItem>
                        <SelectItem value="有订单">有订单</SelectItem>
                        <SelectItem value="无订单">无订单</SelectItem>
                        <SelectItem value="有销售">有销售</SelectItem>
                        <SelectItem value="无销售">无销售</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="md:col-span-3 space-y-1">
                    <Label>匹配类型</Label>
                    <MultiSelectDropdown
                      label="匹配类型"
                      options={matchTypeOptions}
                      selected={settings.matchTypes}
                      onChange={(next) => updateSettings({ matchTypes: next })}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
                  <div className="md:col-span-6 space-y-1">
                    <Label>广告活动</Label>
                    <MultiSelectDropdown
                      label="广告活动"
                      options={campaignOptions}
                      selected={settings.campaignNames}
                      onChange={(next) => updateSettings({ campaignNames: next })}
                    />
                  </div>

                  <div className="md:col-span-6 space-y-1">
                    <Label>广告组</Label>
                    <MultiSelectDropdown
                      label="广告组"
                      options={adGroupOptions}
                      selected={settings.adGroupNames}
                      onChange={(next) => updateSettings({ adGroupNames: next })}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
                  <div className="md:col-span-12">
                    <Collapsible open={metricsOpen} onOpenChange={setMetricsOpen}>
                      <div className="flex items-center justify-between">
                        <div className="text-sm text-muted-foreground">指标区间筛选（留空不限制）</div>
                        <CollapsibleTrigger asChild>
                          <Button variant="ghost" size="sm" className="text-primary font-medium">
                            {metricsOpen ? "收起指标" : "展开指标"}
                          </Button>
                        </CollapsibleTrigger>
                      </div>
                      <CollapsibleContent className="pt-3">
                        <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
                          <div className="md:col-span-3">
                            <RangeInput
                              label="展示"
                              minValue={settings.minImpressions}
                              maxValue={settings.impressionsMax}
                              onChangeMin={(v) =>
                                updateSettings({
                                  minImpressions: v === null ? null : Math.floor(v),
                                })
                              }
                              onChangeMax={(v) =>
                                updateSettings({
                                  impressionsMax: v === null ? null : Math.floor(v),
                                })
                              }
                              resetKey={filtersVersion}
                            />
                          </div>
                          <div className="md:col-span-3">
                            <RangeInput
                              label="点击"
                              minValue={settings.minClicks}
                              maxValue={settings.clicksMax}
                              onChangeMin={(v) =>
                                updateSettings({
                                  minClicks: v === null ? null : Math.floor(v),
                                })
                              }
                              onChangeMax={(v) =>
                                updateSettings({
                                  clicksMax: v === null ? null : Math.floor(v),
                                })
                              }
                              resetKey={filtersVersion}
                            />
                          </div>
                          <div className="md:col-span-3">
                            <RangeInput
                              label="CTR（%）"
                              minValue={settings.ctrMinPct}
                              maxValue={settings.ctrMaxPct}
                              onChangeMin={(v) => updateSettings({ ctrMinPct: v })}
                              onChangeMax={(v) => updateSettings({ ctrMaxPct: v })}
                              resetKey={filtersVersion}
                            />
                          </div>
                          <div className="md:col-span-3">
                            <RangeInput
                              label="CPC"
                              minValue={settings.cpcMin}
                              maxValue={settings.cpcMax}
                              onChangeMin={(v) => updateSettings({ cpcMin: v })}
                              onChangeMax={(v) => updateSettings({ cpcMax: v })}
                              resetKey={filtersVersion}
                            />
                          </div>

                          <div className="md:col-span-3">
                            <RangeInput
                              label="花费"
                              minValue={settings.spendMin}
                              maxValue={settings.spendMax}
                              onChangeMin={(v) => updateSettings({ spendMin: v })}
                              onChangeMax={(v) => updateSettings({ spendMax: v })}
                              resetKey={filtersVersion}
                            />
                          </div>
                          <div className="md:col-span-3">
                            <RangeInput
                              label="销售额"
                              minValue={settings.salesMin}
                              maxValue={settings.salesMax}
                              onChangeMin={(v) => updateSettings({ salesMin: v })}
                              onChangeMax={(v) => updateSettings({ salesMax: v })}
                              resetKey={filtersVersion}
                            />
                          </div>
                          <div className="md:col-span-3">
                            <RangeInput
                              label="订单"
                              minValue={settings.ordersMin}
                              maxValue={settings.ordersMax}
                              onChangeMin={(v) =>
                                updateSettings({
                                  ordersMin: v === null ? null : Math.floor(v),
                                })
                              }
                              onChangeMax={(v) =>
                                updateSettings({
                                  ordersMax: v === null ? null : Math.floor(v),
                                })
                              }
                              resetKey={filtersVersion}
                            />
                          </div>
                          <div className="md:col-span-3">
                            <RangeInput
                              label="ACOS（%）"
                              minValue={settings.acosMin}
                              maxValue={settings.acosMax}
                              onChangeMin={(v) => updateSettings({ acosMin: v })}
                              onChangeMax={(v) => updateSettings({ acosMax: v })}
                              resetKey={filtersVersion}
                            />
                          </div>

                          <div className="md:col-span-3">
                            <RangeInput
                              label="ROAS"
                              minValue={settings.roasMin}
                              maxValue={settings.roasMax}
                              onChangeMin={(v) => updateSettings({ roasMin: v })}
                              onChangeMax={(v) => updateSettings({ roasMax: v })}
                              resetKey={filtersVersion}
                            />
                          </div>
                          <div className="md:col-span-3">
                            <RangeInput
                              label="转化率（%）"
                              minValue={settings.conversionRateMinPct}
                              maxValue={settings.conversionRateMaxPct}
                              onChangeMin={(v) => updateSettings({ conversionRateMinPct: v })}
                              onChangeMax={(v) => updateSettings({ conversionRateMaxPct: v })}
                              resetKey={filtersVersion}
                            />
                          </div>
                        </div>
                      </CollapsibleContent>
                    </Collapsible>
                  </div>

                  <div className="md:col-span-12 space-y-2 pt-2">
                    <div className="flex justify-between items-center">
                      <Label>目标 ACOS（用于颜色标记）</Label>
                      <span className="text-sm font-medium text-primary">{settings.targetAcos}%</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <Input
                        className="w-[120px]"
                        type="number"
                        min={0}
                        max={100}
                        step={1}
                        value={String(settings.targetAcos)}
                        onChange={(e) => {
                          const next = Math.max(0, Math.min(100, Math.floor(Number(e.target.value) || 0)));
                          updateSettings({ targetAcos: next });
                        }}
                      />
                      <div className="text-xs text-muted-foreground">支持直接输入（0-100）</div>
                    </div>
                    <Slider
                      value={[settings.targetAcos]}
                      onValueChange={([v]) => updateSettings({ targetAcos: v })}
                      max={100}
                      step={1}
                    />
                  </div>

                  <div className="md:col-span-12 flex items-end gap-3">
                    <div className="space-y-1">
                      <Label>货币</Label>
                      <Input
                        className="w-[120px]"
                        value={settings.currency}
                        onChange={(e) => updateSettings({ currency: e.target.value })}
                        placeholder="USD"
                      />
                    </div>
                    <div className="text-xs text-muted-foreground pb-1">
                      影响金额显示与导出格式
                    </div>
                  </div>

                  <div className="md:col-span-12 flex flex-col md:flex-row gap-2 pt-2">
                    <Button
                      variant="outline"
                      className="gap-2"
                      onClick={resetFilters}
                      disabled={!hasActiveFilterConditions}
                    >
                      <RotateCcw className="w-4 h-4" />
                      重置筛选条件
                    </Button>
                  </div>
                </div>
              </div>
            </CollapsibleContent>
          </Collapsible>
        </div>
      </CardHeader>
      <CollapsibleContent>
        <CardContent>
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[320px]">
                  <button className="flex items-center gap-1" onClick={() => toggleSort("searchTerm")} type="button">
                    搜索词
                    <span className="text-xs text-primary font-medium">点击词看对比</span>
                    {renderSortIndicator("searchTerm")}
                  </button>
                </TableHead>
                <TableHead className="min-w-[220px]">
                  <button className="flex items-center gap-1" onClick={() => toggleSort("campaignName")} type="button">
                    广告活动
                    {renderSortIndicator("campaignName")}
                  </button>
                </TableHead>
                <TableHead className="min-w-[220px]">
                  <button className="flex items-center gap-1" onClick={() => toggleSort("adGroupName")} type="button">
                    广告组
                    {renderSortIndicator("adGroupName")}
                  </button>
                </TableHead>
                <TableHead className="min-w-[120px]">
                  <button className="flex items-center gap-1" onClick={() => toggleSort("matchType")} type="button">
                    匹配类型
                    {renderSortIndicator("matchType")}
                  </button>
                </TableHead>
                <TableHead className="text-right">
                  <button className="flex items-center gap-1 ml-auto" onClick={() => toggleSort("impressions")} type="button">
                    展示
                    {renderSortIndicator("impressions")}
                  </button>
                </TableHead>
                <TableHead className="text-right">
                  <button className="flex items-center gap-1 ml-auto" onClick={() => toggleSort("clicks")} type="button">
                    点击
                    {renderSortIndicator("clicks")}
                  </button>
                </TableHead>
                <TableHead className="text-right">
                  <button className="flex items-center gap-1 ml-auto" onClick={() => toggleSort("ctr")} type="button">
                    CTR
                    {renderSortIndicator("ctr")}
                  </button>
                </TableHead>
                <TableHead className="text-right">
                  <button className="flex items-center gap-1 ml-auto" onClick={() => toggleSort("cpc")} type="button">
                    CPC
                    {renderSortIndicator("cpc")}
                  </button>
                </TableHead>
                <TableHead className="text-right">
                  <button className="flex items-center gap-1 ml-auto" onClick={() => toggleSort("spend")} type="button">
                    花费
                    {renderSortIndicator("spend")}
                  </button>
                </TableHead>
                <TableHead className="text-right">
                  <button className="flex items-center gap-1 ml-auto" onClick={() => toggleSort("sales")} type="button">
                    销售额
                    {renderSortIndicator("sales")}
                  </button>
                </TableHead>
                <TableHead className="text-right">
                  <button className="flex items-center gap-1 ml-auto" onClick={() => toggleSort("orders")} type="button">
                    订单
                    {renderSortIndicator("orders")}
                  </button>
                </TableHead>
                <TableHead className="text-right">
                  <button className="flex items-center gap-1 ml-auto" onClick={() => toggleSort("acos")} type="button">
                    ACOS
                    {renderSortIndicator("acos")}
                  </button>
                </TableHead>
                <TableHead className="text-right">
                  <button className="flex items-center gap-1 ml-auto" onClick={() => toggleSort("roas")} type="button">
                    ROAS
                    {renderSortIndicator("roas")}
                  </button>
                </TableHead>
                <TableHead className="text-right">
                  <button className="flex items-center gap-1 ml-auto" onClick={() => toggleSort("conversionRate")} type="button">
                    转化率
                    {renderSortIndicator("conversionRate")}
                  </button>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pageData.map((row) => {
                const acosForColor = getAcosForCompare(row);
                const acosText = row.sales > 0 ? `${row.acos.toFixed(1)}%` : row.spend > 0 ? "∞" : "0.0%";
                const details = aggregatedDetailsById?.[row.id];
                const expanded = Boolean(details && expandedAgg[row.id]);

                return (
                  <Fragment key={row.id}>
                    <TableRow>
                      <TableCell className="font-medium max-w-[320px] truncate" title={row.searchTerm}>
                        <div className="flex items-center gap-2 min-w-0">
                          {details ? (
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon-sm"
                              className="shrink-0"
                              aria-label={expanded ? "收起明细" : "展开明细"}
                              title={expanded ? "收起明细" : "展开明细"}
                              onClick={() => toggleAggExpanded(row.id)}
                            >
                              <ChevronDown className={cn("size-4 transition-transform", expanded ? "rotate-180" : "")} />
                            </Button>
                          ) : null}
                          <button
                            type="button"
                            className="truncate text-left text-primary hover:underline"
                            onClick={() => onSearchTermCompare?.(row.searchTerm)}
                            title="查看对比"
                          >
                            {row.searchTerm}
                          </button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            className="shrink-0"
                            aria-label="复制搜索词"
                            title="复制"
                            onClick={async () => {
                              const ok = await copyToClipboard(row.searchTerm);
                              showCopyFeedback(row.id, ok);
                            }}
                          >
                            <Copy />
                          </Button>
                          {copyFeedback?.id === row.id ? (
                            <span
                              className={cn(
                                "text-xs shrink-0",
                                copyFeedback.ok ? "text-emerald-600" : "text-destructive"
                              )}
                            >
                              {copyFeedback.ok ? "已复制" : "复制失败"}
                            </span>
                          ) : null}
                        </div>
                      </TableCell>
                      <TableCell className="max-w-[220px] truncate" title={row.campaignName}>
                      {renderMultiValueCell("广告活动", row.campaignName, details?.campaignNames, row.id)}
                      </TableCell>
                      <TableCell className="max-w-[220px] truncate" title={row.adGroupName}>
                      {renderMultiValueCell("广告组", row.adGroupName, details?.adGroupNames, row.id, details?.adGroupStats)}
                      </TableCell>
                      <TableCell title={row.matchType}>
                      {renderMultiValueCell("匹配类型", row.matchType, details?.matchTypes, row.id)}
                      </TableCell>
                      <TableCell className="text-right">{row.impressions.toLocaleString()}</TableCell>
                      <TableCell className="text-right">{row.clicks.toLocaleString()}</TableCell>
                      <TableCell className="text-right">{(row.ctr * 100).toFixed(2)}%</TableCell>
                      <TableCell className="text-right">{money.format(row.cpc)}</TableCell>
                      <TableCell className="text-right">{money.format(row.spend)}</TableCell>
                      <TableCell className="text-right">{money.format(row.sales)}</TableCell>
                      <TableCell className="text-right">{row.orders.toLocaleString()}</TableCell>
                      <TableCell className="text-right">
                        <Badge
                          variant="outline"
                          className={cn(
                            "w-16 justify-center",
                            acosForColor > targetAcos
                              ? "border-destructive text-destructive bg-destructive/10"
                              : "border-emerald-600 text-emerald-600 bg-emerald-50"
                          )}
                        >
                          {acosText}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">{row.roas.toFixed(2)}</TableCell>
                      <TableCell className="text-right">{(row.conversionRate * 100).toFixed(2)}%</TableCell>
                    </TableRow>
                    {details && expanded ? (
                      <TableRow>
                        <TableCell colSpan={14} className="bg-muted/20">
                          <div className="p-3 rounded-md border bg-background space-y-3">
                            <div className="flex items-center justify-between gap-3">
                              <div className="text-sm font-medium">明细</div>
                              <div className="text-xs text-muted-foreground">来源 {details.sourceRows} 条</div>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                              <div className="space-y-2">
                                <div className="text-xs font-medium">广告活动（{details.campaignNames.length}）</div>
                                <div className="flex flex-wrap gap-1">
                                  {details.campaignNames.length ? (
                                    details.campaignNames.map((v) => (
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
                                <div className="text-xs font-medium">广告组（{details.adGroupNames.length}）</div>
                                <div className="flex flex-wrap gap-1">
                                  {details.adGroupNames.length ? (
                                    details.adGroupNames.map((v) => (
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
                                <div className="text-xs font-medium">匹配类型（{details.matchTypes.length}）</div>
                                <div className="flex flex-wrap gap-1">
                                  {details.matchTypes.length ? (
                                    details.matchTypes.map((v) => (
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
                  </Fragment>
                );
              })}
            </TableBody>
          </Table>
        </div>

        {pageSize === 0 || totalPages <= 1 ? null : (
          <div className="pt-4">
            <Pagination>
              <PaginationContent>
                <PaginationItem>
                  <PaginationPrevious
                    href="#"
                    onClick={(e) => {
                      e.preventDefault();
                      setPage(Math.max(1, safePage - 1));
                    }}
                  />
                </PaginationItem>

                {getPaginationItems(safePage, totalPages).map((it, idx) => {
                  if (it === "ellipsis") {
                    return (
                      <PaginationItem key={`e-${idx}`}>
                        <PaginationEllipsis />
                      </PaginationItem>
                    );
                  }

                  return (
                    <PaginationItem key={it}>
                      <PaginationLink
                        href="#"
                        isActive={it === safePage}
                        onClick={(e) => {
                          e.preventDefault();
                          setPage(it);
                        }}
                      >
                        {it}
                      </PaginationLink>
                    </PaginationItem>
                  );
                })}

                <PaginationItem>
                  <PaginationNext
                    href="#"
                    onClick={(e) => {
                      e.preventDefault();
                      setPage(Math.min(totalPages, safePage + 1));
                    }}
                  />
                </PaginationItem>
              </PaginationContent>
            </Pagination>
          </div>
        )}
        </CardContent>
      </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}
