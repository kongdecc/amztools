import { useCallback, useMemo, useState } from "react";
import * as XLSX from "xlsx";
import { Download, Copy, Sparkles, Settings2, RotateCcw, ChevronDown, ArrowUpDown, ArrowUp, ArrowDown, CalendarIcon } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format } from "date-fns";
import type { DateRange } from "react-day-picker";
import { toast } from "sonner";
import type { AdRecord } from "@/types";
import type { AggregatedRowDetails } from "@/lib/aggregate";
import { generateSuggestions, type SuggestionRow } from "@/lib/suggestions";
import { DEFAULT_SUGGESTION_RULES, useStore } from "@/store";
import { cn } from "@/lib/utils";

interface SuggestionsPanelProps {
  data: AdRecord[];
  currency: string;
  aggregatedDetailsById?: Record<string, AggregatedRowDetails>;
}

function copyToClipboard(text: string) {
  if (!text) return Promise.resolve(false);
  if (navigator.clipboard?.writeText) return navigator.clipboard.writeText(text).then(() => true).catch(() => false);
  const el = document.createElement("textarea");
  el.value = text;
  el.style.position = "fixed";
  el.style.left = "-9999px";
  document.body.appendChild(el);
  el.focus();
  el.select();
  const ok = document.execCommand("copy");
  document.body.removeChild(el);
  return Promise.resolve(ok);
}

function formatPctOrInfinity(v: number | null) {
  if (v === null) return "—";
  if (!Number.isFinite(v)) return "∞";
  return `${v.toFixed(1)}%`;
}

function toWorkbookSheetName(category: string, index: number) {
  const normalized = category.replace(/[\\/*?:[\]]/g, " ").replace(/\s+/g, " ").trim();
  const base = normalized || `分类${index + 1}`;
  const maxLen = 28;
  const short = base.length > maxLen ? base.slice(0, maxLen) : base;
  return `${String(index + 1).padStart(2, "0")}-${short}`.slice(0, 31);
}

function toSheetRows(rows: SuggestionRow[]) {
  return rows.map((r) => ({
    建议类型: r.kind,
    搜索词: r.searchTerm,
    推荐匹配: r.suggestedMatchType,
    说明: r.reason,
    广告活动: r.campaignName,
    广告组: r.adGroupName,
    原匹配类型: r.matchType,
    展示: r.impressions,
    点击: r.clicks,
    花费: r.spend,
    销售额: r.sales,
    订单: r.orders,
    CTR百分比: Number.isFinite(r.ctrPct) ? Number(r.ctrPct.toFixed(2)) : 0,
    CPC: r.cpc,
    ACOS百分比: r.acos === null ? null : Number(r.acos.toFixed(2)),
    ROAS: r.roas === null ? null : Number(r.roas.toFixed(2)),
    转化率百分比: Number.isFinite(r.conversionRatePct) ? Number(r.conversionRatePct.toFixed(2)) : 0,
  }));
}

function isMultiValueLabel(v: string) {
  return v.startsWith("（多：") && v.endsWith("）");
}

function bulkMatchTypeFromSuggested(s: SuggestionRow["suggestedMatchType"]) {
  if (s === "Exact") return "Exact";
  if (s === "Phrase") return "Phrase";
  if (s === "Negative Exact") return "Negative Exact";
  return "Negative Phrase";
}

function toBulkSheetRows(rows: SuggestionRow[]) {
  return rows.map((r) => {
    const campaign = isMultiValueLabel(r.campaignName) ? "" : r.campaignName;
    const adGroup = isMultiValueLabel(r.adGroupName) ? "" : r.adGroupName;
    const recordType = r.kind === "否定词候选" ? "Negative keyword" : "Keyword";
    const status = "enabled";
    const note =
      !campaign || !adGroup
        ? "该搜索词来自多个活动/广告组，请在批量表中选择填入"
        : "";
    const bidAction = r.kind === "出价上调" ? "+10%" : r.kind === "出价下调" ? "-10%" : "";

    return {
      "Record Type": recordType,
      Campaign: campaign,
      "Ad Group": adGroup,
      "Keyword Text": r.searchTerm,
      "Match Type": bulkMatchTypeFromSuggested(r.suggestedMatchType),
      Status: status,
      "Bid Action": bidAction,
      Notes: note,
    };
  });
}

function toDecisionConfigRows(
  targetAcos: number,
  rules: ReturnType<typeof useStore.getState>["settings"]["suggestionRules"],
  dateRange: { from?: Date; to?: Date }
) {
  const rangeLabel =
    dateRange.from && dateRange.to ? `${format(dateRange.from, "yyyy-MM-dd")} ~ ${format(dateRange.to, "yyyy-MM-dd")}` : "全部日期";
  return [
    { 模块: "全局", 参数: "分析日期范围", 当前值: rangeLabel, 说明: "当前建议计算所使用的日期范围" },
    { 模块: "全局", 参数: "目标ACOS(%)", 当前值: targetAcos, 说明: "用于出价调整与表现评估基准" },
    { 模块: "否定词", 参数: "最低点击数", 当前值: rules.negativeMinClicks, 说明: "点击达到阈值才进入否定评估" },
    { 模块: "否定词", 参数: "最低花费", 当前值: rules.negativeMinSpend, 说明: "花费达到阈值才进入否定评估" },
    { 模块: "加词", 参数: "最低点击数", 当前值: rules.harvestMinClicks, 说明: "避免低样本误判" },
    { 模块: "加词", 参数: "最低订单数", 当前值: rules.harvestMinOrders, 说明: "有转化基础再考虑加词" },
    { 模块: "加词", 参数: "最低转化率(%)", 当前值: rules.harvestMinCvrPct, 说明: "筛选高质量词" },
    { 模块: "出价", 参数: "最低点击数", 当前值: rules.bidMinClicks, 说明: "达到最小样本后进行调价" },
    { 模块: "出价", 参数: "上调ACOS系数", 当前值: rules.bidUpAcosFactor, 说明: "ACOS低于目标×该系数建议上调" },
    { 模块: "出价", 参数: "下调ACOS系数", 当前值: rules.bidDownAcosFactor, 说明: "ACOS高于目标×该系数建议下调" },
    { 模块: "关注", 参数: "高点击最低点击数", 当前值: rules.highClickMinClicks, 说明: "用于发现高点击低转化词" },
    { 模块: "关注", 参数: "高点击最大转化率(%)", 当前值: rules.highClickMaxCvrPct, 说明: "超过该值不归类为高点击低转化" },
    { 模块: "关注", 参数: "广告组无单最低点击数", 当前值: rules.adGroupNoOrderMinClicks, 说明: "用于定位广告组层面无单问题" },
    { 模块: "关注", 参数: "高ACOS阈值(%)", 当前值: rules.highAcosThreshold, 说明: "超过阈值进入高ACOS关注" },
  ];
}

interface StructureAnalysisPanelProps {
  data: AdRecord[];
  currency: string;
}

export function StructureAnalysisPanel({ data, currency }: StructureAnalysisPanelProps) {
  const [panelOpen, setPanelOpen] = useState(false);
  const [structureDimension, setStructureDimension] = useState<
    "searchTerm" | "wordFrequency" | "asin" | "targetingObject"
  >("searchTerm");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [detailSortKey, setDetailSortKey] = useState<
    "searchTerm" | "impressions" | "clicks" | "orders" | "ctr" | "conversionRate" | "spend" | "sales" | "coverageCount"
  >("clicks");
  const [detailSortDir, setDetailSortDir] = useState<"asc" | "desc">("desc");
  const [structureHighExposureMin, setStructureHighExposureMin] = useState("1000");
  const [structureLowExposureMax, setStructureLowExposureMax] = useState("200");
  const [structureHighCtrMin, setStructureHighCtrMin] = useState("1.2");
  const [structureLowCtrMax, setStructureLowCtrMax] = useState("0.4");
  const [structureHighClickMin, setStructureHighClickMin] = useState("20");
  const [structureLowClickMax, setStructureLowClickMax] = useState("10");
  const [structureHighConversionMinOrders, setStructureHighConversionMinOrders] = useState("2");
  const [structureLowConversionMaxOrders, setStructureLowConversionMaxOrders] = useState("0");
  const [wordFreqHighCvrPct, setWordFreqHighCvrPct] = useState("12");
  const [wordFreqLowCvrPct, setWordFreqLowCvrPct] = useState("4");
  const [wordFreqZeroHighClicks, setWordFreqZeroHighClicks] = useState("30");
  const [wordFreqZeroMidClicks, setWordFreqZeroMidClicks] = useState("7");
  const [asinZeroHighClicks, setAsinZeroHighClicks] = useState("15");
  const [asinZeroMidClicks, setAsinZeroMidClicks] = useState("7");
  const [targetObjHighClicks, setTargetObjHighClicks] = useState("25");
  const [targetObjMidClicks, setTargetObjMidClicks] = useState("10");
  const [structureResultFilter, setStructureResultFilter] = useState("all");
  const [structureResultQuery, setStructureResultQuery] = useState("");
  const money = useMemo(
    () =>
      new Intl.NumberFormat("zh-CN", {
        style: "currency",
        currency,
        maximumFractionDigits: 2,
      }),
    [currency]
  );
  const structureConfig = useMemo(() => {
    const toNonNegative = (value: string, fallback: number, integer = true) => {
      const numeric = Number(value);
      if (!Number.isFinite(numeric)) return fallback;
      if (integer) return Math.max(0, Math.floor(numeric));
      return Math.max(0, numeric);
    };
    return {
      highExposureMin: toNonNegative(structureHighExposureMin, 1000),
      lowExposureMax: toNonNegative(structureLowExposureMax, 200),
      highCtrMinPct: toNonNegative(structureHighCtrMin, 1.2, false),
      lowCtrMaxPct: toNonNegative(structureLowCtrMax, 0.4, false),
      highClickMin: toNonNegative(structureHighClickMin, 20),
      lowClickMax: toNonNegative(structureLowClickMax, 10),
      highConversionMinOrders: toNonNegative(structureHighConversionMinOrders, 2),
      lowConversionMaxOrders: toNonNegative(structureLowConversionMaxOrders, 0),
      wordFreqHighCvrPct: toNonNegative(wordFreqHighCvrPct, 12, false),
      wordFreqLowCvrPct: toNonNegative(wordFreqLowCvrPct, 4, false),
      wordFreqZeroHighClicks: toNonNegative(wordFreqZeroHighClicks, 30),
      wordFreqZeroMidClicks: toNonNegative(wordFreqZeroMidClicks, 7),
      asinZeroHighClicks: toNonNegative(asinZeroHighClicks, 15),
      asinZeroMidClicks: toNonNegative(asinZeroMidClicks, 7),
      targetObjHighClicks: toNonNegative(targetObjHighClicks, 25),
      targetObjMidClicks: toNonNegative(targetObjMidClicks, 10),
    };
  }, [
    structureHighClickMin,
    structureHighConversionMinOrders,
    structureHighCtrMin,
    structureHighExposureMin,
    structureLowClickMax,
    structureLowConversionMaxOrders,
    structureLowCtrMax,
    structureLowExposureMax,
    wordFreqHighCvrPct,
    wordFreqLowCvrPct,
    wordFreqZeroHighClicks,
    wordFreqZeroMidClicks,
    asinZeroHighClicks,
    asinZeroMidClicks,
    targetObjHighClicks,
    targetObjMidClicks,
  ]);
  const aggregateByLabel = useCallback((
    sourceRows: typeof data,
    getLabel: (row: (typeof data)[number]) => string,
    idPrefix: string
  ) => {
    const map = new Map<
      string,
      {
        label: string;
        impressions: number;
        clicks: number;
        orders: number;
        spend: number;
        sales: number;
      }
    >();
    for (const row of sourceRows) {
      const label = getLabel(row).trim();
      if (!label) continue;
      const hit = map.get(label);
      if (!hit) {
        map.set(label, {
          label,
          impressions: row.impressions,
          clicks: row.clicks,
          orders: row.orders,
          spend: row.spend,
          sales: row.sales,
        });
      } else {
        hit.impressions += row.impressions;
        hit.clicks += row.clicks;
        hit.orders += row.orders;
        hit.spend += row.spend;
        hit.sales += row.sales;
      }
    }
    return Array.from(map.values()).map((item) => {
      const ctr = item.impressions > 0 ? item.clicks / item.impressions : 0;
      const conversionRate = item.clicks > 0 ? item.orders / item.clicks : 0;
      const cpc = item.clicks > 0 ? item.spend / item.clicks : 0;
      const acos = item.sales > 0 ? (item.spend / item.sales) * 100 : item.spend > 0 ? Number.POSITIVE_INFINITY : 0;
      const roas = item.spend > 0 ? item.sales / item.spend : 0;
      return {
        id: `${idPrefix}-${item.label}`,
        searchTerm: item.label,
        campaignName: "—",
        adGroupName: "—",
        matchType: "—",
        impressions: item.impressions,
        clicks: item.clicks,
        spend: item.spend,
        sales: item.sales,
        orders: item.orders,
        ctr,
        cpc,
        acos,
        roas,
        conversionRate,
      };
    });
  }, []);
  const searchTermGroups = useMemo(() => {
    const groups = new Map<string, AdRecord[]>();
    const addRow = (category: string, row: AdRecord) => {
      const hit = groups.get(category);
      if (!hit) groups.set(category, [row]);
      else hit.push(row);
    };
    const getExposureLevel = (impressions: number) => {
      if (impressions >= structureConfig.highExposureMin) return "高曝光";
      if (impressions <= structureConfig.lowExposureMax) return "低曝光";
      return "中曝光";
    };
    const getCtrLevel = (ctrPct: number) => {
      if (ctrPct >= structureConfig.highCtrMinPct) return "高点击率";
      if (ctrPct <= structureConfig.lowCtrMaxPct) return "低点击率";
      return "中点击率";
    };
    const getConversionLevel = (orders: number) => {
      if (orders >= structureConfig.highConversionMinOrders) return "高转化";
      if (orders <= structureConfig.lowConversionMaxOrders) return "低转化";
      return "中转化";
    };
    const getClickLevel = (clicks: number) => {
      if (clicks >= structureConfig.highClickMin) return "高点击量";
      if (clicks <= structureConfig.lowClickMax) return "低点击量";
      return "中点击量";
    };
    for (const row of data) {
      const exposureLevel = getExposureLevel(row.impressions);
      const ctrLevel = getCtrLevel(row.ctr * 100);
      const conversionLevel = getConversionLevel(row.orders);
      addRow(`搜索词-${exposureLevel}-${ctrLevel}-${conversionLevel}`, row);
      if (row.orders === 0) {
        addRow(`搜索词-${getClickLevel(row.clicks)}-0转化`, row);
      }
      if (row.clicks >= structureConfig.highClickMin && row.orders <= structureConfig.lowConversionMaxOrders) {
        addRow("搜索词-高点击-低转化", row);
      }
      if (row.clicks <= structureConfig.lowClickMax && row.orders >= structureConfig.highConversionMinOrders) {
        addRow("搜索词-低点击-高转化", row);
      }
    }
    return Array.from(groups.entries())
      .map(([category, rows]) => {
        const sortedRows = [...rows].sort((a, b) => {
          if (a.clicks !== b.clicks) return b.clicks - a.clicks;
          if (a.orders !== b.orders) return b.orders - a.orders;
          if (a.spend !== b.spend) return b.spend - a.spend;
          return a.searchTerm.localeCompare(b.searchTerm, "zh-Hans-CN");
        });
        const spend = rows.reduce((acc, r) => acc + r.spend, 0);
        const sales = rows.reduce((acc, r) => acc + r.sales, 0);
        const clicks = rows.reduce((acc, r) => acc + r.clicks, 0);
        const impressions = rows.reduce((acc, r) => acc + r.impressions, 0);
        const orders = rows.reduce((acc, r) => acc + r.orders, 0);
        return {
          category,
          rows: sortedRows,
          count: rows.length,
          spend,
          sales,
          clicks,
          impressions,
          orders,
          ctrPct: impressions > 0 ? (clicks / impressions) * 100 : 0,
          conversionPct: clicks > 0 ? (orders / clicks) * 100 : 0,
        };
      })
      .sort((a, b) => {
        if (a.count !== b.count) return b.count - a.count;
        if (a.clicks !== b.clicks) return b.clicks - a.clicks;
        return a.category.localeCompare(b.category, "zh-Hans-CN");
      });
  }, [data, structureConfig]);
  const wordFrequencyGroups = useMemo(() => {
    const splitWords = (text: string) =>
      text
        .toLowerCase()
        .split(/[,\s，;；/|\\(){}<>「」【】、\n\r\t-]+/g)
        .map((s) => s.trim())
        .filter(Boolean);
    const wordMap = new Map<
      string,
      {
        word: string;
        impressions: number;
        clicks: number;
        orders: number;
        spend: number;
        sales: number;
        coveredTerms: Set<string>;
      }
    >();
    for (const row of data) {
      const uniqWords = new Set(splitWords(row.searchTerm));
      for (const word of uniqWords) {
        const hit = wordMap.get(word);
        if (!hit) {
          wordMap.set(word, {
            word,
            impressions: row.impressions,
            clicks: row.clicks,
            orders: row.orders,
            spend: row.spend,
            sales: row.sales,
            coveredTerms: new Set([row.searchTerm]),
          });
        } else {
          hit.impressions += row.impressions;
          hit.clicks += row.clicks;
          hit.orders += row.orders;
          hit.spend += row.spend;
          hit.sales += row.sales;
          hit.coveredTerms.add(row.searchTerm);
        }
      }
    }
    const groups = new Map<string, Array<{
      id: string;
      searchTerm: string;
      campaignName: string;
      adGroupName: string;
      matchType: string;
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
      coverageCount: number;
    }>>();
    const push = (category: string, row: (typeof groups extends Map<string, Array<infer T>> ? T : never)) => {
      const hit = groups.get(category);
      if (!hit) groups.set(category, [row]);
      else hit.push(row);
    };
    for (const item of wordMap.values()) {
      const ctr = item.impressions > 0 ? item.clicks / item.impressions : 0;
      const cpc = item.clicks > 0 ? item.spend / item.clicks : 0;
      const acos = item.sales > 0 ? (item.spend / item.sales) * 100 : item.spend > 0 ? Number.POSITIVE_INFINITY : 0;
      const roas = item.spend > 0 ? item.sales / item.spend : 0;
      const conversionRate = item.clicks > 0 ? item.orders / item.clicks : 0;
      const row = {
        id: `word-${item.word}`,
        searchTerm: item.word,
        campaignName: "—",
        adGroupName: "—",
        matchType: "词频",
        impressions: item.impressions,
        clicks: item.clicks,
        spend: item.spend,
        sales: item.sales,
        orders: item.orders,
        ctr,
        cpc,
        acos,
        roas,
        conversionRate,
        coverageCount: item.coveredTerms.size,
      };
      if (item.orders <= structureConfig.lowConversionMaxOrders) {
        if (item.clicks >= structureConfig.wordFreqZeroHighClicks) push(`词频-${structureConfig.lowConversionMaxOrders}转化_${structureConfig.wordFreqZeroHighClicks}次以上点击`, row);
        else if (item.clicks >= structureConfig.wordFreqZeroMidClicks) push(`词频-${structureConfig.lowConversionMaxOrders}转化_${structureConfig.wordFreqZeroMidClicks}-${Math.max(structureConfig.wordFreqZeroHighClicks - 1, structureConfig.wordFreqZeroMidClicks)}次点击`, row);
        else push(`词频-${structureConfig.lowConversionMaxOrders}转化_${structureConfig.wordFreqZeroMidClicks}次点击以下`, row);
      } else {
        const cvrPct = conversionRate * 100;
        if (cvrPct >= structureConfig.wordFreqHighCvrPct) push("词频-高转化率", row);
        else if (cvrPct <= structureConfig.wordFreqLowCvrPct) push("词频-低转化率", row);
        else push("词频-中转化率", row);
      }
    }
    return Array.from(groups.entries())
      .map(([category, rows]) => {
        const sortedRows = [...rows].sort((a, b) => {
          if (a.clicks !== b.clicks) return b.clicks - a.clicks;
          if (a.orders !== b.orders) return b.orders - a.orders;
          if (a.spend !== b.spend) return b.spend - a.spend;
          return a.searchTerm.localeCompare(b.searchTerm, "zh-Hans-CN");
        });
        const spend = sortedRows.reduce((acc, r) => acc + r.spend, 0);
        const sales = sortedRows.reduce((acc, r) => acc + r.sales, 0);
        const clicks = sortedRows.reduce((acc, r) => acc + r.clicks, 0);
        const impressions = sortedRows.reduce((acc, r) => acc + r.impressions, 0);
        const orders = sortedRows.reduce((acc, r) => acc + r.orders, 0);
        return {
          category,
          rows: sortedRows,
          count: sortedRows.length,
          coverageTotal: sortedRows.reduce((acc, r) => acc + (r.coverageCount ?? 0), 0),
          spend,
          sales,
          clicks,
          impressions,
          orders,
          ctrPct: impressions > 0 ? (clicks / impressions) * 100 : 0,
          conversionPct: clicks > 0 ? (orders / clicks) * 100 : 0,
        };
      })
      .sort((a, b) => {
        if ((a.coverageTotal ?? 0) !== (b.coverageTotal ?? 0)) return (b.coverageTotal ?? 0) - (a.coverageTotal ?? 0);
        if (a.clicks !== b.clicks) return b.clicks - a.clicks;
        return a.category.localeCompare(b.category, "zh-Hans-CN");
      });
  }, [data, structureConfig]);
  const asinGroups = useMemo(() => {
    const asinRows = data.filter((row) => /^b0[a-z0-9]{8,}$/i.test(row.searchTerm.trim()) && !/\s/.test(row.searchTerm.trim()));
    const aggregated = aggregateByLabel(asinRows, (row) => row.searchTerm, "asin");
    const groups = new Map<string, typeof aggregated>();
    const push = (category: string, row: (typeof aggregated)[number]) => {
      const hit = groups.get(category);
      if (!hit) groups.set(category, [row]);
      else hit.push(row);
    };
    for (const row of aggregated) {
      const cvrPct = row.conversionRate * 100;
      if (row.orders <= structureConfig.lowConversionMaxOrders) {
        if (row.clicks >= structureConfig.asinZeroHighClicks) push(`ASIN-${structureConfig.lowConversionMaxOrders}转化_${structureConfig.asinZeroHighClicks}次以上点击`, row);
        else if (row.clicks >= structureConfig.asinZeroMidClicks) push(`ASIN-${structureConfig.lowConversionMaxOrders}转化_${structureConfig.asinZeroMidClicks}-${Math.max(structureConfig.asinZeroHighClicks - 1, structureConfig.asinZeroMidClicks)}次点击`, row);
        else push(`ASIN-${structureConfig.lowConversionMaxOrders}转化_${structureConfig.asinZeroMidClicks}次点击以下`, row);
      } else if (cvrPct >= structureConfig.wordFreqHighCvrPct) {
        push("ASIN-高转化率", row);
      } else if (cvrPct <= structureConfig.wordFreqLowCvrPct) {
        push("ASIN-低转化率", row);
      } else {
        push("ASIN-中转化率", row);
      }
    }
    return Array.from(groups.entries())
      .map(([category, rows]) => {
        const sortedRows = [...rows].sort((a, b) => b.clicks - a.clicks);
        const spend = sortedRows.reduce((acc, r) => acc + r.spend, 0);
        const sales = sortedRows.reduce((acc, r) => acc + r.sales, 0);
        const clicks = sortedRows.reduce((acc, r) => acc + r.clicks, 0);
        const impressions = sortedRows.reduce((acc, r) => acc + r.impressions, 0);
        const orders = sortedRows.reduce((acc, r) => acc + r.orders, 0);
        return {
          category,
          rows: sortedRows,
          count: sortedRows.length,
          spend,
          sales,
          clicks,
          impressions,
          orders,
          ctrPct: impressions > 0 ? (clicks / impressions) * 100 : 0,
          conversionPct: clicks > 0 ? (orders / clicks) * 100 : 0,
        };
      })
      .sort((a, b) => b.impressions - a.impressions || b.clicks - a.clicks || b.count - a.count);
  }, [aggregateByLabel, data, structureConfig]);
  const targetingObjectGroups = useMemo(() => {
    const toMultiLabel = (count: number) => `（多：${count}）`;
    const aggregated = (() => {
      const map = new Map<
        string,
        AdRecord & {
          coverageCount: number;
          campaignCount: number;
          adGroupCount: number;
          campaignNames: string[];
          adGroupNames: string[];
          adGroupStats: { campaignName: string; adGroupName: string; clicks: number; orders: number }[];
        }
      >();
      const campaignSets = new Map<string, Set<string>>();
      const adGroupSets = new Map<string, Set<string>>();
      const pairStats = new Map<string, Map<string, { campaignName: string; adGroupName: string; clicks: number; orders: number }>>();

      for (const row of data) {
        const targeting = row.targeting.trim();
        if (!targeting) continue;
        const campaignName = row.campaignName.trim();
        const adGroupName = row.adGroupName.trim();
        const validCampaign = Boolean(campaignName) && campaignName !== "—" && !isMultiValueLabel(campaignName);
        const validAdGroup = Boolean(adGroupName) && adGroupName !== "—" && !isMultiValueLabel(adGroupName);
        const hit = map.get(targeting);
        if (!hit) {
          map.set(targeting, {
            ...row,
            id: `obj-${targeting}`,
            searchTerm: targeting,
            matchType: "投放对象",
            campaignName: validCampaign ? campaignName : "—",
            adGroupName: validAdGroup ? adGroupName : "—",
            coverageCount: validCampaign && validAdGroup ? 1 : 0,
            campaignCount: validCampaign ? 1 : 0,
            adGroupCount: validAdGroup ? 1 : 0,
            campaignNames: validCampaign ? [campaignName] : [],
            adGroupNames: validAdGroup ? [adGroupName] : [],
            adGroupStats: validCampaign && validAdGroup ? [{ campaignName, adGroupName, clicks: row.clicks, orders: row.orders }] : [],
          });
          campaignSets.set(targeting, validCampaign ? new Set([campaignName]) : new Set());
          adGroupSets.set(targeting, validAdGroup ? new Set([adGroupName]) : new Set());
          pairStats.set(
            targeting,
            validCampaign && validAdGroup
              ? new Map([[`${campaignName}||${adGroupName}`, { campaignName, adGroupName, clicks: row.clicks, orders: row.orders }]])
              : new Map()
          );
        } else {
          const impressions = hit.impressions + row.impressions;
          const clicks = hit.clicks + row.clicks;
          const spend = hit.spend + row.spend;
          const sales = hit.sales + row.sales;
          const directSales = hit.directSales + row.directSales;
          const indirectSales = hit.indirectSales + row.indirectSales;
          const orders = hit.orders + row.orders;
          hit.impressions = impressions;
          hit.clicks = clicks;
          hit.spend = spend;
          hit.sales = sales;
          hit.directSales = directSales;
          hit.indirectSales = indirectSales;
          hit.orders = orders;
          hit.ctr = impressions > 0 ? clicks / impressions : 0;
          hit.cpc = clicks > 0 ? spend / clicks : 0;
          hit.acos = sales > 0 ? (spend / sales) * 100 : 0;
          hit.roas = spend > 0 ? sales / spend : 0;
          hit.conversionRate = clicks > 0 ? orders / clicks : 0;

          const campaignSet = campaignSets.get(targeting) ?? new Set<string>();
          if (validCampaign) campaignSet.add(campaignName);
          campaignSets.set(targeting, campaignSet);
          const adGroupSet = adGroupSets.get(targeting) ?? new Set<string>();
          if (validAdGroup) adGroupSet.add(adGroupName);
          adGroupSets.set(targeting, adGroupSet);

          const pairMap = pairStats.get(targeting) ?? new Map<string, { campaignName: string; adGroupName: string; clicks: number; orders: number }>();
          if (validCampaign && validAdGroup) {
            const pairKey = `${campaignName}||${adGroupName}`;
            const pair = pairMap.get(pairKey);
            if (!pair) {
              pairMap.set(pairKey, { campaignName, adGroupName, clicks: row.clicks, orders: row.orders });
            } else {
              pair.clicks += row.clicks;
              pair.orders += row.orders;
            }
          }
          pairStats.set(targeting, pairMap);
        }
      }

      for (const [targeting, row] of map.entries()) {
        const campaignNames = Array.from(campaignSets.get(targeting) ?? []).sort((a, b) => a.localeCompare(b, "zh-Hans-CN"));
        const adGroupNames = Array.from(adGroupSets.get(targeting) ?? []).sort((a, b) => a.localeCompare(b, "zh-Hans-CN"));
        const adGroupStats = Array.from(pairStats.get(targeting)?.values() ?? []).sort((a, b) => b.clicks - a.clicks);
        row.campaignNames = campaignNames;
        row.adGroupNames = adGroupNames;
        row.adGroupStats = adGroupStats;
        row.coverageCount = adGroupStats.length;
        row.campaignCount = campaignNames.length;
        row.adGroupCount = adGroupNames.length;
        row.campaignName = campaignNames.length > 1 ? toMultiLabel(campaignNames.length) : campaignNames[0] ?? "—";
        row.adGroupName = adGroupNames.length > 1 ? toMultiLabel(adGroupNames.length) : adGroupNames[0] ?? "—";
      }

      return Array.from(map.values());
    })();
    const groups = new Map<string, typeof aggregated>();
    const push = (category: string, row: (typeof aggregated)[number]) => {
      const hit = groups.get(category);
      if (!hit) groups.set(category, [row]);
      else hit.push(row);
    };
    for (const row of aggregated) {
      const cvrPct = row.conversionRate * 100;
      if (row.orders <= structureConfig.lowConversionMaxOrders) {
        if (row.clicks >= structureConfig.targetObjHighClicks) push(`投放对象-${structureConfig.lowConversionMaxOrders}转化_${structureConfig.targetObjHighClicks}次点击以上`, row);
        else if (row.clicks >= structureConfig.targetObjMidClicks) push(`投放对象-${structureConfig.lowConversionMaxOrders}转化_${structureConfig.targetObjMidClicks}-${Math.max(structureConfig.targetObjHighClicks - 1, structureConfig.targetObjMidClicks)}次点击`, row);
        else push(`投放对象-${structureConfig.lowConversionMaxOrders}转化_${structureConfig.targetObjMidClicks}次点击以下`, row);
      } else {
        const clickLevel =
          row.clicks >= structureConfig.targetObjHighClicks
            ? "高点击"
            : row.clicks >= structureConfig.targetObjMidClicks
              ? "中点击"
              : "低点击";
        const convLevel =
          cvrPct >= structureConfig.wordFreqHighCvrPct
            ? "高转化"
            : cvrPct <= structureConfig.wordFreqLowCvrPct
              ? "低转化"
              : "中转化";
        push(`投放对象-${clickLevel}_${convLevel}`, row);
      }
    }
    return Array.from(groups.entries())
      .map(([category, rows]) => {
        const sortedRows = [...rows].sort((a, b) => b.clicks - a.clicks);
        const spend = sortedRows.reduce((acc, r) => acc + r.spend, 0);
        const sales = sortedRows.reduce((acc, r) => acc + r.sales, 0);
        const clicks = sortedRows.reduce((acc, r) => acc + r.clicks, 0);
        const impressions = sortedRows.reduce((acc, r) => acc + r.impressions, 0);
        const orders = sortedRows.reduce((acc, r) => acc + r.orders, 0);
        return {
          category,
          rows: sortedRows,
          count: sortedRows.length,
          spend,
          sales,
          clicks,
          impressions,
          orders,
          ctrPct: impressions > 0 ? (clicks / impressions) * 100 : 0,
          conversionPct: clicks > 0 ? (orders / clicks) * 100 : 0,
        };
      })
      .sort((a, b) => b.count - a.count || b.clicks - a.clicks);
  }, [data, structureConfig]);
  const structureGroups = useMemo(
    () =>
      structureDimension === "searchTerm"
        ? searchTermGroups
        : structureDimension === "wordFrequency"
          ? wordFrequencyGroups
          : structureDimension === "asin"
            ? asinGroups
            : targetingObjectGroups,
    [asinGroups, searchTermGroups, structureDimension, targetingObjectGroups, wordFrequencyGroups]
  );
  const structureFilterOptions = useMemo(() => {
    if (structureDimension === "searchTerm") {
      return [
        { value: "all", label: "全部结果" },
        { value: "highConversion", label: "仅高转化" },
        { value: "lowConversion", label: "仅低转化" },
        { value: "highClickLowConversion", label: "仅高点击低转化" },
        { value: "lowClickHighConversion", label: "仅低点击高转化" },
      ];
    }
    if (structureDimension === "wordFrequency") {
      return [
        { value: "all", label: "全部结果" },
        { value: "highConversion", label: "词频高转化率" },
        { value: "midConversion", label: "词频中转化率" },
        { value: "lowConversion", label: "词频低转化率" },
        { value: "zeroConversion", label: "词频0转化" },
      ];
    }
    if (structureDimension === "asin") {
      return [
        { value: "all", label: "全部结果" },
        { value: "highConversion", label: "ASIN高转化率" },
        { value: "midConversion", label: "ASIN中转化率" },
        { value: "lowConversion", label: "ASIN低转化率" },
        { value: "zeroConversion", label: "ASIN0转化" },
      ];
    }
    if (structureDimension === "targetingObject") {
      return [
        { value: "all", label: "全部结果" },
        { value: "highConversion", label: "投放对象高转化" },
        { value: "midConversion", label: "投放对象中转化" },
        { value: "lowConversion", label: "投放对象低转化" },
        { value: "zeroConversion", label: "投放对象0转化" },
      ];
    }
    return [
      { value: "all", label: "全部结果" },
      { value: "highConversion", label: "高转化" },
      { value: "midConversion", label: "中转化" },
      { value: "lowConversion", label: "低转化" },
    ];
  }, [structureDimension]);
  const filteredStructureGroups = useMemo(() => {
    const query = structureResultQuery.trim().toLowerCase();
    return structureGroups.filter((group) => {
      const matchPreset =
        structureResultFilter === "all"
          ? true
          : structureResultFilter === "midConversion"
            ? group.category.includes("中转化")
            : structureResultFilter === "zeroConversion"
              ? group.category.includes("0转化")
          : structureResultFilter === "highConversion"
            ? group.category.includes("高转化")
            : structureResultFilter === "lowConversion"
              ? group.category.includes("低转化")
              : structureResultFilter === "highClickLowConversion"
                ? group.category.includes("高点击-低转化")
                : group.category.includes("低点击-高转化");
      if (!matchPreset) return false;
      if (!query) return true;
      return group.category.toLowerCase().includes(query);
    });
  }, [structureGroups, structureResultFilter, structureResultQuery]);
  const selectedGroup = useMemo(
    () => filteredStructureGroups.find((group) => group.category === selectedCategory) ?? null,
    [filteredStructureGroups, selectedCategory]
  );
  const sortedDetailRows = useMemo(() => {
    if (!selectedGroup) return [];
    const rows = [...selectedGroup.rows];
    rows.sort((a, b) => {
      if (detailSortKey === "searchTerm") {
        const cmp = a.searchTerm.localeCompare(b.searchTerm, "zh-Hans-CN");
        return detailSortDir === "asc" ? cmp : -cmp;
      }
      if (detailSortKey === "coverageCount") {
        const av = Number((a as { coverageCount?: number }).coverageCount ?? 0);
        const bv = Number((b as { coverageCount?: number }).coverageCount ?? 0);
        if (av === bv) return a.searchTerm.localeCompare(b.searchTerm, "zh-Hans-CN");
        return detailSortDir === "asc" ? av - bv : bv - av;
      }
      const av =
        detailSortKey === "ctr"
          ? a.ctr
          : detailSortKey === "conversionRate"
            ? a.conversionRate
            : a[detailSortKey];
      const bv =
        detailSortKey === "ctr"
          ? b.ctr
          : detailSortKey === "conversionRate"
            ? b.conversionRate
            : b[detailSortKey];
      if (av === bv) return a.searchTerm.localeCompare(b.searchTerm, "zh-Hans-CN");
      return detailSortDir === "asc" ? av - bv : bv - av;
    });
    return rows;
  }, [selectedGroup, detailSortDir, detailSortKey]);
  const toggleDetailSort = (
    key: "searchTerm" | "impressions" | "clicks" | "orders" | "ctr" | "conversionRate" | "spend" | "sales" | "coverageCount"
  ) => {
    if (detailSortKey === key) {
      setDetailSortDir((d) => (d === "asc" ? "desc" : "asc"));
      return;
    }
    setDetailSortKey(key);
    setDetailSortDir("desc");
  };
  const renderDetailSortIcon = (
    key: "searchTerm" | "impressions" | "clicks" | "orders" | "ctr" | "conversionRate" | "spend" | "sales" | "coverageCount"
  ) => {
    if (detailSortKey !== key) return <ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground" />;
    return detailSortDir === "desc" ? <ArrowDown className="h-3.5 w-3.5" /> : <ArrowUp className="h-3.5 w-3.5" />;
  };
  const renderTargetingMultiValueCell = (
    kind: "广告活动" | "广告组",
    displayText: string,
    values: string[] | undefined,
    stats?: { campaignName: string; adGroupName: string; clicks: number; orders: number }[]
  ) => {
    if (!isMultiValueLabel(displayText) || !values?.length) return <span className="truncate">{displayText}</span>;
    return (
      <Popover>
        <PopoverTrigger asChild>
          <button type="button" className="truncate underline decoration-dotted underline-offset-4 text-left">
            {displayText}
          </button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-[420px] max-h-[300px] overflow-auto">
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div className="text-sm font-medium">{kind}</div>
              <div className="text-xs text-muted-foreground">{values.length} 个</div>
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
        </PopoverContent>
      </Popover>
    );
  };
  const exportStructure = () => {
    const wb = XLSX.utils.book_new();
    const catalogRows = structureGroups.map((group) => ({
      分类目录: group.category,
      词数: group.count,
      展示: group.impressions,
      点击: group.clicks,
      订单: group.orders,
      花费: Number(group.spend.toFixed(2)),
      销售额: Number(group.sales.toFixed(2)),
      CTR百分比: Number(group.ctrPct.toFixed(2)),
      转化率百分比: Number(group.conversionPct.toFixed(2)),
    }));
    const configRows = [
      {
        参数: "分析维度",
        值:
          structureDimension === "searchTerm"
            ? "搜索词"
            : structureDimension === "wordFrequency"
              ? "词频"
              : structureDimension === "asin"
                ? "ASIN"
                : structureDimension === "targetingObject"
                  ? "投放对象"
                    : "投放对象",
      },
      { 参数: "高曝光阈值(展示≥)", 值: structureConfig.highExposureMin },
      { 参数: "低曝光阈值(展示≤)", 值: structureConfig.lowExposureMax },
      { 参数: "高点击率阈值(CTR%≥)", 值: structureConfig.highCtrMinPct },
      { 参数: "低点击率阈值(CTR%≤)", 值: structureConfig.lowCtrMaxPct },
      { 参数: "高点击阈值(点击≥)", 值: structureConfig.highClickMin },
      { 参数: "低点击阈值(点击≤)", 值: structureConfig.lowClickMax },
      { 参数: "高转化阈值(订单≥)", 值: structureConfig.highConversionMinOrders },
      { 参数: "低转化阈值(订单≤)", 值: structureConfig.lowConversionMaxOrders },
      { 参数: "词频高转化率阈值(%)", 值: structureConfig.wordFreqHighCvrPct },
      { 参数: "词频低转化率阈值(%)", 值: structureConfig.wordFreqLowCvrPct },
      { 参数: "词频0转化高点击阈值(点击≥)", 值: structureConfig.wordFreqZeroHighClicks },
      { 参数: "词频0转化中点击阈值(点击≥)", 值: structureConfig.wordFreqZeroMidClicks },
      { 参数: "ASIN0转化高点击阈值(点击≥)", 值: structureConfig.asinZeroHighClicks },
      { 参数: "ASIN0转化中点击阈值(点击≥)", 值: structureConfig.asinZeroMidClicks },
      { 参数: "投放对象高点击阈值(点击≥)", 值: structureConfig.targetObjHighClicks },
      { 参数: "投放对象中点击阈值(点击≥)", 值: structureConfig.targetObjMidClicks },
    ];
    const wsCatalog = XLSX.utils.json_to_sheet(catalogRows);
    XLSX.utils.book_append_sheet(wb, wsCatalog, "目录");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(configRows), "参数配置");
    structureGroups.forEach((group, index) => {
      const sheetName = toWorkbookSheetName(group.category, index);
      const detailRows = group.rows.map((r) => ({
        搜索词: r.searchTerm,
        广告活动: r.campaignName,
        广告组: r.adGroupName,
        匹配类型: r.matchType,
        展示: r.impressions,
        点击: r.clicks,
        订单: r.orders,
        花费: Number(r.spend.toFixed(2)),
        销售额: Number(r.sales.toFixed(2)),
        CTR百分比: Number((r.ctr * 100).toFixed(2)),
        转化率百分比: Number((r.conversionRate * 100).toFixed(2)),
        CPC: Number(r.cpc.toFixed(2)),
        ACOS百分比: Number.isFinite(r.acos) ? Number(r.acos.toFixed(2)) : null,
      }));
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(detailRows), sheetName);
      const rowIndex = index + 1;
      const cell = XLSX.utils.encode_cell({ c: 0, r: rowIndex });
      const targetCell = wsCatalog[cell];
      if (targetCell) {
        targetCell.l = { Target: `#'${sheetName}'!A1`, Tooltip: `跳转到 ${sheetName}` };
      }
    });
    XLSX.writeFile(wb, `结构分析-${structureDimension}-${new Date().toISOString().slice(0, 10)}.xlsx`);
  };
  const resetStructureFilters = () => {
    setStructureHighExposureMin("1000");
    setStructureLowExposureMax("200");
    setStructureHighCtrMin("1.2");
    setStructureLowCtrMax("0.4");
    setStructureHighClickMin("20");
    setStructureLowClickMax("10");
    setStructureHighConversionMinOrders("2");
    setStructureLowConversionMaxOrders("0");
    setWordFreqHighCvrPct("12");
    setWordFreqLowCvrPct("4");
    setWordFreqZeroHighClicks("30");
    setWordFreqZeroMidClicks("7");
    setAsinZeroHighClicks("15");
    setAsinZeroMidClicks("7");
    setTargetObjHighClicks("25");
    setTargetObjMidClicks("10");
    setStructureResultFilter("all");
    setStructureResultQuery("");
    setSelectedCategory(null);
  };
  return (
    <Card className="col-span-1 md:col-span-2">
      <Collapsible open={panelOpen} onOpenChange={setPanelOpen}>
        <CardHeader className="space-y-2">
          <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <CardTitle>结构分析</CardTitle>
                <CollapsibleTrigger asChild>
                  <Button variant="ghost" size="sm" className="gap-1">
                    {panelOpen ? "收起" : "展开"}
                    <ChevronDown className={`w-4 h-4 transition-transform ${panelOpen ? "rotate-180" : ""}`} />
                  </Button>
                </CollapsibleTrigger>
              </div>
              <div className="text-xs text-muted-foreground">
                {structureDimension === "searchTerm"
                  ? `点击≥${structureConfig.highClickMin}且订单≤${structureConfig.lowConversionMaxOrders} 为高点击低转化；点击≤${structureConfig.lowClickMax}且订单≥${structureConfig.highConversionMinOrders} 为低点击高转化`
                  : structureDimension === "wordFrequency"
                    ? `词频分层：高转化率≥${structureConfig.wordFreqHighCvrPct}%，低转化率≤${structureConfig.wordFreqLowCvrPct}%，0转化按点击分层`
                    : structureDimension === "asin"
                      ? `ASIN分层：高转化率≥${structureConfig.wordFreqHighCvrPct}%，低转化率≤${structureConfig.wordFreqLowCvrPct}%，${structureConfig.lowConversionMaxOrders}转化按点击分层`
                      : `投放对象分层：按点击级别（高/中/低）与转化级别（高/中/低）组合`}
              </div>
            </div>
            <Button variant="outline" size="sm" className="gap-2" onClick={exportStructure} disabled={!structureGroups.length}>
              <Download className="w-4 h-4" />
              导出结构分析
            </Button>
          </div>
        </CardHeader>
        <CollapsibleContent>
          <CardContent className="space-y-4">
            <Tabs
              value={structureDimension}
              onValueChange={(v) => {
                setStructureDimension(v as typeof structureDimension);
                setSelectedCategory(null);
                setStructureResultFilter("all");
              }}
            >
              <TabsList>
                <TabsTrigger value="searchTerm" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white">搜索词</TabsTrigger>
                <TabsTrigger value="wordFrequency" className="data-[state=active]:bg-violet-600 data-[state=active]:text-white">词频</TabsTrigger>
                <TabsTrigger value="asin" className="data-[state=active]:bg-emerald-600 data-[state=active]:text-white">ASIN</TabsTrigger>
                <TabsTrigger value="targetingObject" className="data-[state=active]:bg-amber-600 data-[state=active]:text-white">投放对象</TabsTrigger>
              </TabsList>
            </Tabs>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="space-y-1">
                <Label>高点击阈值（点击≥）</Label>
                <Input type="number" min={0} value={structureHighClickMin} onChange={(e) => setStructureHighClickMin(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label>低点击阈值（点击≤）</Label>
                <Input type="number" min={0} value={structureLowClickMax} onChange={(e) => setStructureLowClickMax(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label>高转化阈值（订单≥）</Label>
                <Input type="number" min={0} value={structureHighConversionMinOrders} onChange={(e) => setStructureHighConversionMinOrders(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label>低转化阈值（订单≤）</Label>
                <Input type="number" min={0} value={structureLowConversionMaxOrders} onChange={(e) => setStructureLowConversionMaxOrders(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label>高曝光阈值（展示≥）</Label>
                <Input type="number" min={0} value={structureHighExposureMin} onChange={(e) => setStructureHighExposureMin(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label>低曝光阈值（展示≤）</Label>
                <Input type="number" min={0} value={structureLowExposureMax} onChange={(e) => setStructureLowExposureMax(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label>高点击率阈值（CTR%≥）</Label>
                <Input type="number" min={0} step={0.1} value={structureHighCtrMin} onChange={(e) => setStructureHighCtrMin(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label>低点击率阈值（CTR%≤）</Label>
                <Input type="number" min={0} step={0.1} value={structureLowCtrMax} onChange={(e) => setStructureLowCtrMax(e.target.value)} />
              </div>
              {structureDimension === "wordFrequency" ? (
                <>
                  <div className="space-y-1">
                    <Label>词频高转化率阈值（%）</Label>
                    <Input type="number" min={0} step={0.1} value={wordFreqHighCvrPct} onChange={(e) => setWordFreqHighCvrPct(e.target.value)} />
                  </div>
                  <div className="space-y-1">
                    <Label>词频低转化率阈值（%）</Label>
                    <Input type="number" min={0} step={0.1} value={wordFreqLowCvrPct} onChange={(e) => setWordFreqLowCvrPct(e.target.value)} />
                  </div>
                  <div className="space-y-1">
                    <Label>0转化高点击阈值（点击≥）</Label>
                    <Input type="number" min={0} value={wordFreqZeroHighClicks} onChange={(e) => setWordFreqZeroHighClicks(e.target.value)} />
                  </div>
                  <div className="space-y-1">
                    <Label>0转化中点击阈值（点击≥）</Label>
                    <Input type="number" min={0} value={wordFreqZeroMidClicks} onChange={(e) => setWordFreqZeroMidClicks(e.target.value)} />
                  </div>
                </>
              ) : null}
              {structureDimension === "asin" ? (
                <>
                  <div className="space-y-1">
                    <Label>ASIN 0转化高点击阈值（点击≥）</Label>
                    <Input type="number" min={0} value={asinZeroHighClicks} onChange={(e) => setAsinZeroHighClicks(e.target.value)} />
                  </div>
                  <div className="space-y-1">
                    <Label>ASIN 0转化中点击阈值（点击≥）</Label>
                    <Input type="number" min={0} value={asinZeroMidClicks} onChange={(e) => setAsinZeroMidClicks(e.target.value)} />
                  </div>
                </>
              ) : null}
              {structureDimension === "targetingObject" ? (
                <>
                  <div className="space-y-1">
                    <Label>投放对象高点击阈值（点击≥）</Label>
                    <Input type="number" min={0} value={targetObjHighClicks} onChange={(e) => setTargetObjHighClicks(e.target.value)} />
                  </div>
                  <div className="space-y-1">
                    <Label>投放对象中点击阈值（点击≥）</Label>
                    <Input type="number" min={0} value={targetObjMidClicks} onChange={(e) => setTargetObjMidClicks(e.target.value)} />
                  </div>
                </>
              ) : null}
              <div className="space-y-1 md:col-span-2">
                <Label>结果筛选</Label>
                <Select value={structureResultFilter} onValueChange={setStructureResultFilter}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {structureFilterOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1 md:col-span-2">
                <Label>分类搜索</Label>
                <Input
                  value={structureResultQuery}
                  onChange={(e) => setStructureResultQuery(e.target.value)}
                  placeholder="输入分类关键词，如：高转化/高点击"
                />
              </div>
              <div className="flex items-end md:col-span-4">
                <Button variant="outline" size="sm" className="gap-2" onClick={resetStructureFilters}>
                  <RotateCcw className="w-4 h-4" />
                  重置筛选
                </Button>
              </div>
            </div>
            <div className="rounded-md border">
              <div className="px-3 py-2 text-sm font-medium text-red-600">
                {structureDimension === "searchTerm"
                  ? "搜索词汇总分析结果（目录）"
                  : structureDimension === "wordFrequency"
                    ? "词频汇总分析结果（目录）"
                    : structureDimension === "asin"
                      ? "ASIN汇总分析结果（目录）"
                      : "投放对象汇总分析结果（目录）"}
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[52px]">#</TableHead>
                    <TableHead>分类</TableHead>
                    <TableHead className="text-right">词数</TableHead>
                    {structureDimension === "wordFrequency" ? <TableHead className="text-right">覆盖词数</TableHead> : null}
                    <TableHead className="text-right">点击</TableHead>
                    <TableHead className="text-right">订单</TableHead>
                    <TableHead className="text-right">花费</TableHead>
                    <TableHead className="text-right">销售额</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredStructureGroups.map((group, index) => (
                    <TableRow key={group.category}>
                      <TableCell>{index + 1}</TableCell>
                      <TableCell>
                        <button
                          type="button"
                          className="text-blue-600 underline underline-offset-4"
                          onClick={() => {
                            if (structureDimension === "targetingObject") {
                              setDetailSortKey("coverageCount");
                              setDetailSortDir("desc");
                            }
                            setSelectedCategory(group.category);
                          }}
                        >
                          {group.category}
                        </button>
                      </TableCell>
                      <TableCell className="text-right">{group.count.toLocaleString()}</TableCell>
                      {structureDimension === "wordFrequency" ? (
                        <TableCell className="text-right">{Number((group as { coverageTotal?: number }).coverageTotal ?? 0).toLocaleString()}</TableCell>
                      ) : null}
                      <TableCell className="text-right">{group.clicks.toLocaleString()}</TableCell>
                      <TableCell className="text-right">{group.orders.toLocaleString()}</TableCell>
                      <TableCell className="text-right">{money.format(group.spend)}</TableCell>
                      <TableCell className="text-right">{money.format(group.sales)}</TableCell>
                    </TableRow>
                  ))}
                  {!filteredStructureGroups.length ? (
                    <TableRow>
                      <TableCell colSpan={structureDimension === "wordFrequency" ? 8 : 7} className="text-center text-muted-foreground py-8">
                        暂无可分析数据
                      </TableCell>
                    </TableRow>
                  ) : null}
                </TableBody>
              </Table>
            </div>
            <Dialog
              open={Boolean(selectedCategory)}
              onOpenChange={(open) => {
                if (!open) setSelectedCategory(null);
              }}
            >
              <DialogContent className="w-[98vw] max-w-[98vw] sm:max-w-[98vw] h-[95vh] max-h-[95vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>{selectedGroup ? selectedGroup.category : "分类详情"}</DialogTitle>
                  <DialogDescription>
                    {selectedGroup
                      ? `词数 ${selectedGroup.count.toLocaleString()} • 点击 ${selectedGroup.clicks.toLocaleString()} • 订单 ${selectedGroup.orders.toLocaleString()} • 花费 ${money.format(selectedGroup.spend)} • 销售额 ${money.format(selectedGroup.sales)}`
                      : "暂无数据"}
                  </DialogDescription>
                </DialogHeader>
                <div className="rounded-md border overflow-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[52px]">#</TableHead>
                        <TableHead>
                          <button type="button" className="inline-flex items-center gap-1 font-medium" onClick={() => toggleDetailSort("searchTerm")}>
                            <span>
                              {structureDimension === "wordFrequency"
                                ? "词频词"
                                : structureDimension === "asin"
                                  ? "ASIN"
                                  : "投放对象"}
                            </span>
                            {renderDetailSortIcon("searchTerm")}
                          </button>
                        </TableHead>
                        {structureDimension === "wordFrequency" ? (
                          <TableHead className="text-right">覆盖词数</TableHead>
                        ) : null}
                        {structureDimension === "targetingObject" ? <TableHead>广告活动</TableHead> : null}
                        {structureDimension === "targetingObject" ? <TableHead>广告组</TableHead> : null}
                        <TableHead className="text-right">
                          <button type="button" className="inline-flex items-center gap-1 ml-auto font-medium" onClick={() => toggleDetailSort("impressions")}>
                            <span>展示</span>
                            {renderDetailSortIcon("impressions")}
                          </button>
                        </TableHead>
                        <TableHead className="text-right">
                          <button type="button" className="inline-flex items-center gap-1 ml-auto font-medium" onClick={() => toggleDetailSort("clicks")}>
                            <span>点击</span>
                            {renderDetailSortIcon("clicks")}
                          </button>
                        </TableHead>
                        <TableHead className="text-right">
                          <button type="button" className="inline-flex items-center gap-1 ml-auto font-medium" onClick={() => toggleDetailSort("orders")}>
                            <span>订单</span>
                            {renderDetailSortIcon("orders")}
                          </button>
                        </TableHead>
                        <TableHead className="text-right">
                          <button type="button" className="inline-flex items-center gap-1 ml-auto font-medium" onClick={() => toggleDetailSort("ctr")}>
                            <span>CTR</span>
                            {renderDetailSortIcon("ctr")}
                          </button>
                        </TableHead>
                        <TableHead className="text-right">
                          <button type="button" className="inline-flex items-center gap-1 ml-auto font-medium" onClick={() => toggleDetailSort("conversionRate")}>
                            <span>转化率</span>
                            {renderDetailSortIcon("conversionRate")}
                          </button>
                        </TableHead>
                        <TableHead className="text-right">
                          <button type="button" className="inline-flex items-center gap-1 ml-auto font-medium" onClick={() => toggleDetailSort("spend")}>
                            <span>花费</span>
                            {renderDetailSortIcon("spend")}
                          </button>
                        </TableHead>
                        <TableHead className="text-right">
                          <button type="button" className="inline-flex items-center gap-1 ml-auto font-medium" onClick={() => toggleDetailSort("sales")}>
                            <span>销售额</span>
                            {renderDetailSortIcon("sales")}
                          </button>
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sortedDetailRows.slice(0, 500).map((row, index) => (
                        <TableRow key={`${selectedCategory ?? "detail"}-${row.id}-${index}`}>
                          <TableCell>{index + 1}</TableCell>
                          <TableCell className="max-w-[360px] truncate" title={row.searchTerm}>
                            {row.searchTerm}
                          </TableCell>
                          {structureDimension === "wordFrequency" ? (
                            <TableCell className="text-right">{Number((row as { coverageCount?: number }).coverageCount ?? 0).toLocaleString()}</TableCell>
                          ) : null}
                          {structureDimension === "targetingObject" ? (
                            <TableCell className="max-w-[260px] truncate" title={row.campaignName}>
                              {renderTargetingMultiValueCell(
                                "广告活动",
                                row.campaignName,
                                (row as { campaignNames?: string[] }).campaignNames
                              )}
                            </TableCell>
                          ) : null}
                          {structureDimension === "targetingObject" ? (
                            <TableCell className="max-w-[240px] truncate" title={row.adGroupName}>
                              {renderTargetingMultiValueCell(
                                "广告组",
                                row.adGroupName,
                                (row as { adGroupNames?: string[] }).adGroupNames,
                                (row as { adGroupStats?: { campaignName: string; adGroupName: string; clicks: number; orders: number }[] }).adGroupStats
                              )}
                            </TableCell>
                          ) : null}
                          <TableCell className="text-right">{row.impressions.toLocaleString()}</TableCell>
                          <TableCell className="text-right">{row.clicks.toLocaleString()}</TableCell>
                          <TableCell className="text-right">{row.orders.toLocaleString()}</TableCell>
                          <TableCell className="text-right">{(row.ctr * 100).toFixed(2)}%</TableCell>
                          <TableCell className="text-right">{(row.conversionRate * 100).toFixed(2)}%</TableCell>
                          <TableCell className="text-right">{money.format(row.spend)}</TableCell>
                          <TableCell className="text-right">{money.format(row.sales)}</TableCell>
                        </TableRow>
                      ))}
                      {!selectedGroup?.rows.length ? (
                        <TableRow>
                          <TableCell colSpan={structureDimension === "wordFrequency" ? 10 : structureDimension === "targetingObject" ? 11 : 9} className="text-center text-muted-foreground py-8">
                            暂无可查看明细
                          </TableCell>
                        </TableRow>
                      ) : null}
                    </TableBody>
                  </Table>
                </div>
              </DialogContent>
            </Dialog>
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}

export function SuggestionsPanel({ data, currency, aggregatedDetailsById }: SuggestionsPanelProps) {
  const [tab, setTab] = useState<"neg" | "harvest" | "bid" | "watch">("neg");
  const [panelOpen, setPanelOpen] = useState(false);
  const settings = useStore((s) => s.settings);
  const updateSettings = useStore((s) => s.updateSettings);
  const rawData = useStore((s) => s.data);
  const [watchSortKey, setWatchSortKey] = useState<
    | "searchTerm"
    | "kind"
    | "suggestedMatchType"
    | "campaignName"
    | "adGroupName"
    | "impressions"
    | "spend"
    | "sales"
    | "orders"
    | "clicks"
    | "acos"
    | "conversionRatePct"
  >("spend");
  const [watchSortDir, setWatchSortDir] = useState<"asc" | "desc">("desc");

  const reportDateRange = useMemo(() => {
    const base = rawData ?? data;
    const dates = base.map((r) => r.date).filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d));
    if (!dates.length) return null;
    const minYmd = dates.reduce((acc, d) => (d < acc ? d : acc), dates[0]);
    const maxYmd = dates.reduce((acc, d) => (d > acc ? d : acc), dates[0]);
    return {
      minYmd,
      maxYmd,
      from: new Date(`${minYmd}T00:00:00.000Z`),
      to: new Date(`${maxYmd}T00:00:00.000Z`),
    };
  }, [data, rawData]);

  const toYmd = (d: Date) =>
    new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())).toISOString().slice(0, 10);

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

  const isDateDisabled = (d: Date) => {
    if (!reportDateRange) return false;
    const min = reportDateRange.from.getTime();
    const max = reportDateRange.to.getTime();
    const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())).getTime();
    return t < min || t > max;
  };

  const handleQuickRange = (days: number) => {
    const range = getQuickRange(days);
    if (!range) return;
    updateSettings({ dateRange: range });
  };

  const money = useMemo(
    () =>
      new Intl.NumberFormat("zh-CN", {
        style: "currency",
        currency,
        maximumFractionDigits: 2,
      }),
    [currency]
  );

  const { negatives, harvests, bidUp, bidDown, watch } = useMemo(
    () => generateSuggestions(data, settings, aggregatedDetailsById),
    [data, settings, aggregatedDetailsById]
  );
  const ruleSummary = useMemo(() => {
    const { suggestionRules, targetAcos } = settings;
    const bidUpThreshold = targetAcos * suggestionRules.bidUpAcosFactor;
    const bidDownThreshold = targetAcos * suggestionRules.bidDownAcosFactor;
    return {
      neg: `否定词：无订单/无销售，且 点击≥${suggestionRules.negativeMinClicks} 或 花费≥${suggestionRules.negativeMinSpend}`,
      harvest: `加词：有订单/有销售，点击≥${suggestionRules.harvestMinClicks}，ACOS≤${targetAcos}% 且 转化率≥${suggestionRules.harvestMinCvrPct}% 或 订单≥${suggestionRules.harvestMinOrders}`,
      bid: `出价调整：有订单/有销售，点击≥${suggestionRules.bidMinClicks}，上调阈值 ACOS≤${bidUpThreshold.toFixed(1)}%，下调阈值 ACOS≥${bidDownThreshold.toFixed(1)}%`,
      watch: `重点关注：点击≥${suggestionRules.highClickMinClicks} 且 转化率≤${suggestionRules.highClickMaxCvrPct.toFixed(1)}%；单广告组点击≥${suggestionRules.adGroupNoOrderMinClicks}且无成交；ACOS≥${suggestionRules.highAcosThreshold.toFixed(1)}%`,
    };
  }, [settings]);

  const totalWasteSpend = useMemo(
    () => data.reduce((acc, r) => (r.sales <= 0 && r.orders <= 0 ? acc + r.spend : acc), 0),
    [data]
  );

  const totalSales = useMemo(() => data.reduce((acc, r) => acc + r.sales, 0), [data]);
  const totalSpend = useMemo(() => data.reduce((acc, r) => acc + r.spend, 0), [data]);
  const overallAcos = totalSales > 0 ? (totalSpend / totalSales) * 100 : 0;
  const sortedWatch = useMemo(() => {
    if (!watch.length) return watch;
    const rows = [...watch];
    rows.sort((a, b) => {
      const dir = watchSortDir === "asc" ? 1 : -1;
      if (watchSortKey === "searchTerm") return dir * a.searchTerm.localeCompare(b.searchTerm, "zh-Hans-CN");
      if (watchSortKey === "kind") return dir * a.kind.localeCompare(b.kind, "zh-Hans-CN");
      if (watchSortKey === "suggestedMatchType") return dir * a.suggestedMatchType.localeCompare(b.suggestedMatchType, "zh-Hans-CN");
      if (watchSortKey === "campaignName") return dir * a.campaignName.localeCompare(b.campaignName, "zh-Hans-CN");
      if (watchSortKey === "adGroupName") return dir * a.adGroupName.localeCompare(b.adGroupName, "zh-Hans-CN");
      if (watchSortKey === "impressions") return dir * (a.impressions - b.impressions);
      if (watchSortKey === "spend") return dir * (a.spend - b.spend);
      if (watchSortKey === "sales") return dir * (a.sales - b.sales);
      if (watchSortKey === "orders") return dir * (a.orders - b.orders);
      if (watchSortKey === "clicks") return dir * (a.clicks - b.clicks);
      if (watchSortKey === "conversionRatePct") return dir * (a.conversionRatePct - b.conversionRatePct);
      const aAcos = a.acos;
      const bAcos = b.acos;
      if (aAcos === null && bAcos === null) return 0;
      if (aAcos === null) return 1;
      if (bAcos === null) return -1;
      return dir * (aAcos - bAcos);
    });
    return rows;
  }, [watch, watchSortKey, watchSortDir]);

  const toggleWatchSort = (key: typeof watchSortKey) => {
    if (watchSortKey === key) setWatchSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setWatchSortKey(key);
      setWatchSortDir("desc");
    }
  };

  const exportAll = () => {
    const wb = XLSX.utils.book_new();
    const configRows = toDecisionConfigRows(settings.targetAcos, settings.suggestionRules, settings.dateRange);
    const summaryRows = [
      { 分类: "否定词候选", 数量: negatives.length },
      { 分类: "加词候选", 数量: harvests.length },
      { 分类: "出价上调", 数量: bidUp.length },
      { 分类: "出价下调", 数量: bidDown.length },
      { 分类: "重点关注", 数量: watch.length },
      { 分类: "总建议数", 数量: negatives.length + harvests.length + bidUp.length + bidDown.length + watch.length },
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(configRows), "参数配置");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(summaryRows), "建议汇总");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(toSheetRows(negatives)), "否定词候选");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(toSheetRows(harvests)), "加词候选");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(toSheetRows(bidUp)), "出价上调");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(toSheetRows(bidDown)), "出价下调");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(toSheetRows(watch)), "重点关注");
    const bulkRows = [
      ...toBulkSheetRows(negatives),
      ...toBulkSheetRows(harvests),
      ...toBulkSheetRows(bidUp),
      ...toBulkSheetRows(bidDown),
      ...toBulkSheetRows(watch),
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(bulkRows), "Bulk-可粘贴");
    XLSX.writeFile(wb, `决策建议-${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  const exportCurrent = () => {
    const wb = XLSX.utils.book_new();
    if (tab === "neg") XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(toSheetRows(negatives)), "否定词候选");
    if (tab === "harvest") XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(toSheetRows(harvests)), "加词候选");
    if (tab === "bid") {
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(toSheetRows(bidUp)), "出价上调");
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(toSheetRows(bidDown)), "出价下调");
    }
    if (tab === "watch") XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(toSheetRows(watch)), "重点关注");
    const bulkRows =
      tab === "neg"
        ? toBulkSheetRows(negatives)
        : tab === "harvest"
          ? toBulkSheetRows(harvests)
          : tab === "bid"
            ? [...toBulkSheetRows(bidUp), ...toBulkSheetRows(bidDown)]
            : toBulkSheetRows(watch);
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(bulkRows), "Bulk-可粘贴");
    XLSX.writeFile(wb, `操作建议-${tab}-${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  const renderMultiValueCell = (
    kind: "广告活动" | "广告组",
    displayText: string,
    values: string[] | undefined,
    stats?: { campaignName: string; adGroupName: string; clicks: number; orders: number }[]
  ) => {
    if (!isMultiValueLabel(displayText) || !values?.length) return <span className="truncate">{displayText}</span>;

    return (
      <HoverCard openDelay={200}>
        <HoverCardTrigger asChild>
          <button type="button" className="truncate underline decoration-dotted underline-offset-4 text-left">
            {displayText}
          </button>
        </HoverCardTrigger>
        <HoverCardContent align="start" className="w-[420px]">
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div className="text-sm font-medium">{kind}</div>
              <div className="text-xs text-muted-foreground">{values.length} 个</div>
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

  const renderTable = (
    rows: SuggestionRow[],
    options?: {
      sortable?: boolean;
      sortKey?: typeof watchSortKey;
      sortDir?: typeof watchSortDir;
      onSortChange?: (key: typeof watchSortKey) => void;
      highlightAcos?: boolean;
    }
  ) => (
    <div className="rounded-md border overflow-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="min-w-[280px]">
              {options?.sortable ? (
                <button className="flex items-center gap-1" onClick={() => options.onSortChange?.("searchTerm")} type="button">
                  搜索词
                  {options.sortKey === "searchTerm" ? (options.sortDir === "asc" ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" />) : <ArrowUpDown className="size-3 opacity-50" />}
                </button>
              ) : (
                "搜索词"
              )}
            </TableHead>
            <TableHead className="min-w-[120px]">
              {options?.sortable ? (
                <button className="flex items-center gap-1" onClick={() => options.onSortChange?.("kind")} type="button">
                  建议
                  {options.sortKey === "kind" ? (options.sortDir === "asc" ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" />) : <ArrowUpDown className="size-3 opacity-50" />}
                </button>
              ) : (
                "建议"
              )}
            </TableHead>
            <TableHead className="min-w-[140px]">
              {options?.sortable ? (
                <button className="flex items-center gap-1" onClick={() => options.onSortChange?.("suggestedMatchType")} type="button">
                  推荐匹配
                  {options.sortKey === "suggestedMatchType" ? (options.sortDir === "asc" ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" />) : <ArrowUpDown className="size-3 opacity-50" />}
                </button>
              ) : (
                "推荐匹配"
              )}
            </TableHead>
            <TableHead className="min-w-[160px]">
              {options?.sortable ? (
                <button className="flex items-center gap-1" onClick={() => options.onSortChange?.("campaignName")} type="button">
                  广告活动
                  {options.sortKey === "campaignName" ? (options.sortDir === "asc" ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" />) : <ArrowUpDown className="size-3 opacity-50" />}
                </button>
              ) : (
                "广告活动"
              )}
            </TableHead>
            <TableHead className="min-w-[180px]">
              {options?.sortable ? (
                <button className="flex items-center gap-1" onClick={() => options.onSortChange?.("adGroupName")} type="button">
                  广告组
                  {options.sortKey === "adGroupName" ? (options.sortDir === "asc" ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" />) : <ArrowUpDown className="size-3 opacity-50" />}
                </button>
              ) : (
                "广告组"
              )}
            </TableHead>
            <TableHead className="text-right">
              {options?.sortable ? (
                <button className="flex items-center gap-1 ml-auto" onClick={() => options.onSortChange?.("impressions")} type="button">
                  展示
                  {options.sortKey === "impressions" ? (options.sortDir === "asc" ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" />) : <ArrowUpDown className="size-3 opacity-50" />}
                </button>
              ) : (
                "展示"
              )}
            </TableHead>
            <TableHead className="text-right">
              {options?.sortable ? (
                <button className="flex items-center gap-1 ml-auto" onClick={() => options.onSortChange?.("spend")} type="button">
                  花费
                  {options.sortKey === "spend" ? (options.sortDir === "asc" ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" />) : <ArrowUpDown className="size-3 opacity-50" />}
                </button>
              ) : (
                "花费"
              )}
            </TableHead>
            <TableHead className="text-right">
              {options?.sortable ? (
                <button className="flex items-center gap-1 ml-auto" onClick={() => options.onSortChange?.("sales")} type="button">
                  销售额
                  {options.sortKey === "sales" ? (options.sortDir === "asc" ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" />) : <ArrowUpDown className="size-3 opacity-50" />}
                </button>
              ) : (
                "销售额"
              )}
            </TableHead>
            <TableHead className="text-right">
              {options?.sortable ? (
                <button className="flex items-center gap-1 ml-auto" onClick={() => options.onSortChange?.("orders")} type="button">
                  订单
                  {options.sortKey === "orders" ? (options.sortDir === "asc" ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" />) : <ArrowUpDown className="size-3 opacity-50" />}
                </button>
              ) : (
                "订单"
              )}
            </TableHead>
            <TableHead className="text-right">
              {options?.sortable ? (
                <button className="flex items-center gap-1 ml-auto" onClick={() => options.onSortChange?.("clicks")} type="button">
                  点击
                  {options.sortKey === "clicks" ? (options.sortDir === "asc" ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" />) : <ArrowUpDown className="size-3 opacity-50" />}
                </button>
              ) : (
                "点击"
              )}
            </TableHead>
            <TableHead className="text-right">
              {options?.sortable ? (
                <button className="flex items-center gap-1 ml-auto" onClick={() => options.onSortChange?.("acos")} type="button">
                  ACOS
                  {options.sortKey === "acos" ? (options.sortDir === "asc" ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" />) : <ArrowUpDown className="size-3 opacity-50" />}
                </button>
              ) : (
                "ACOS"
              )}
            </TableHead>
            <TableHead className="text-right">
              {options?.sortable ? (
                <button className="flex items-center gap-1 ml-auto" onClick={() => options.onSortChange?.("conversionRatePct")} type="button">
                  转化率
                  {options.sortKey === "conversionRatePct" ? (options.sortDir === "asc" ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" />) : <ArrowUpDown className="size-3 opacity-50" />}
                </button>
              ) : (
                "转化率"
              )}
            </TableHead>
            <TableHead className="min-w-[220px]">说明</TableHead>
            <TableHead className="w-[72px] text-right">复制</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r, idx) => (
            <TableRow key={`${r.kind}-${idx}-${r.searchTerm}`}>
              {(() => {
                const details = aggregatedDetailsById?.[r.rowId];
                const overTarget = r.acos !== null && r.acos > settings.targetAcos;
                return (
                  <>
                    <TableCell className="font-medium max-w-[360px] truncate" title={r.searchTerm}>
                      {r.searchTerm}
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">{r.kind}</Badge>
                    </TableCell>
                    <TableCell>{r.suggestedMatchType}</TableCell>
                    <TableCell className="max-w-[220px] truncate" title={r.campaignName}>
                      {renderMultiValueCell("广告活动", r.campaignName, details?.campaignNames)}
                    </TableCell>
                    <TableCell className="max-w-[220px] truncate" title={r.adGroupName}>
                      {renderMultiValueCell("广告组", r.adGroupName, details?.adGroupNames, details?.adGroupStats)}
                    </TableCell>
                    <TableCell className="text-right">{r.impressions.toLocaleString()}</TableCell>
                    <TableCell className="text-right">{money.format(r.spend)}</TableCell>
                    <TableCell className="text-right">{money.format(r.sales)}</TableCell>
                    <TableCell className="text-right">{r.orders.toLocaleString()}</TableCell>
                    <TableCell className="text-right">{r.clicks.toLocaleString()}</TableCell>
                    <TableCell className="text-right">
                      {options?.highlightAcos ? (
                        <Badge
                          variant="outline"
                          className={cn(
                            "w-16 justify-center",
                            overTarget
                              ? "border-destructive text-destructive bg-destructive/10"
                              : "border-emerald-600 text-emerald-600 bg-emerald-50"
                          )}
                        >
                          {formatPctOrInfinity(r.acos)}
                        </Badge>
                      ) : (
                        formatPctOrInfinity(r.acos)
                      )}
                    </TableCell>
                    <TableCell className="text-right">{`${r.conversionRatePct.toFixed(2)}%`}</TableCell>
                    <TableCell className="max-w-[320px] truncate" title={r.reason}>
                      {r.reason}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        aria-label="复制搜索词"
                        title="复制"
                        onClick={async () => {
                          const ok = await copyToClipboard(r.searchTerm);
                          if (ok) toast.success("已复制");
                          else toast.error("复制失败");
                        }}
                      >
                        <Copy />
                      </Button>
                    </TableCell>
                  </>
                );
              })()}
            </TableRow>
          ))}
          {!rows.length ? (
            <TableRow>
              <TableCell colSpan={14} className="text-center text-muted-foreground py-10">
                暂无建议（可尝试放宽筛选，或切换到“按搜索词汇总”视图）
              </TableCell>
            </TableRow>
          ) : null}
        </TableBody>
      </Table>
    </div>
  );

  return (
    <Card className="col-span-1 md:col-span-2">
      <Collapsible open={panelOpen} onOpenChange={setPanelOpen}>
        <CardHeader className="space-y-2">
          <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <CardTitle className="flex items-center gap-2">
                  <Sparkles className="size-4 text-primary" />
                  操作建议
                </CardTitle>
                <CollapsibleTrigger asChild>
                  <Button variant="ghost" size="sm" className="gap-1">
                    {panelOpen ? "收起" : "展开"}
                    <ChevronDown className={`w-4 h-4 transition-transform ${panelOpen ? "rotate-180" : ""}`} />
                  </Button>
                </CollapsibleTrigger>
              </div>
              <div className="text-xs text-muted-foreground">
                浪费花费 {money.format(totalWasteSpend)} • 整体 ACOS {overallAcos.toFixed(2)}%
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className="gap-2">
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
                    mode="range"
                    numberOfMonths={2}
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
              <Sheet>
                <SheetTrigger asChild>
                  <Button variant="outline" size="sm" className="gap-2">
                    <Settings2 className="w-4 h-4" />
                    调整规则
                  </Button>
                </SheetTrigger>
                <SheetContent className="w-[96vw] sm:w-[640px] max-w-[96vw] max-h-[100dvh] overflow-y-auto">
                <SheetHeader>
                  <SheetTitle>操作建议规则</SheetTitle>
                  <SheetDescription>调整阈值后会立即影响建议列表与导出内容</SheetDescription>
                </SheetHeader>

                <div className="mt-6 space-y-6">
                  <div className="space-y-2">
                    <Label>产品阶段</Label>
                    <Select
                      value={settings.suggestionRules.productStage}
                      onValueChange={(v) => {
                        const stage = v as typeof settings.suggestionRules.productStage;
                        updateSettings({
                          suggestionRules: {
                            ...settings.suggestionRules,
                            productStage: stage,
                            harvestMinCvrPct: stage === "新品" ? 8 : 12,
                          },
                        });
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="选择阶段" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="新品">新品</SelectItem>
                        <SelectItem value="成熟">成熟</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-3">
                    <div className="text-sm font-medium">否定词候选</div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <Label>最少点击</Label>
                        <Input
                          type="number"
                          min={1}
                          value={String(settings.suggestionRules.negativeMinClicks)}
                          onChange={(e) =>
                            updateSettings({
                              suggestionRules: {
                                ...settings.suggestionRules,
                                negativeMinClicks: Math.max(1, Math.floor(Number(e.target.value) || 1)),
                              },
                            })
                          }
                        />
                      </div>
                      <div className="space-y-1">
                        <Label>最少花费</Label>
                        <Input
                          type="number"
                          min={0}
                          value={String(settings.suggestionRules.negativeMinSpend)}
                          onChange={(e) =>
                            updateSettings({
                              suggestionRules: {
                                ...settings.suggestionRules,
                                negativeMinSpend: Math.max(0, Number(e.target.value) || 0),
                              },
                            })
                          }
                        />
                      </div>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className="text-sm font-medium">加词候选</div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <Label>最少点击</Label>
                        <Input
                          type="number"
                          min={1}
                          value={String(settings.suggestionRules.harvestMinClicks)}
                          onChange={(e) =>
                            updateSettings({
                              suggestionRules: {
                                ...settings.suggestionRules,
                                harvestMinClicks: Math.max(1, Math.floor(Number(e.target.value) || 1)),
                              },
                            })
                          }
                        />
                      </div>
                      <div className="space-y-1">
                        <Label>最少订单</Label>
                        <Input
                          type="number"
                          min={1}
                          value={String(settings.suggestionRules.harvestMinOrders)}
                          onChange={(e) =>
                            updateSettings({
                              suggestionRules: {
                                ...settings.suggestionRules,
                                harvestMinOrders: Math.max(1, Math.floor(Number(e.target.value) || 1)),
                              },
                            })
                          }
                        />
                      </div>
                      <div className="space-y-1">
                        <Label>最少转化率（%）</Label>
                        <Input
                          type="number"
                          min={0}
                          value={String(settings.suggestionRules.harvestMinCvrPct)}
                          onChange={(e) =>
                            updateSettings({
                              suggestionRules: {
                                ...settings.suggestionRules,
                                harvestMinCvrPct: Math.max(0, Number(e.target.value) || 0),
                              },
                            })
                          }
                        />
                      </div>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className="text-sm font-medium">出价调整</div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <Label>最少点击</Label>
                        <Input
                          type="number"
                          min={1}
                          value={String(settings.suggestionRules.bidMinClicks)}
                          onChange={(e) =>
                            updateSettings({
                              suggestionRules: {
                                ...settings.suggestionRules,
                                bidMinClicks: Math.max(1, Math.floor(Number(e.target.value) || 1)),
                              },
                            })
                          }
                        />
                      </div>
                      <div className="space-y-1">
                        <Label>上调阈值（目标 ACOS ×）</Label>
                        <Input
                          type="number"
                          min={0}
                          step={0.05}
                          value={String(settings.suggestionRules.bidUpAcosFactor)}
                          onChange={(e) =>
                            updateSettings({
                              suggestionRules: {
                                ...settings.suggestionRules,
                                bidUpAcosFactor: Math.max(0, Number(e.target.value) || 0),
                              },
                            })
                          }
                        />
                      </div>
                      <div className="space-y-1">
                        <Label>下调阈值（目标 ACOS ×）</Label>
                        <Input
                          type="number"
                          min={0}
                          step={0.05}
                          value={String(settings.suggestionRules.bidDownAcosFactor)}
                          onChange={(e) =>
                            updateSettings({
                              suggestionRules: {
                                ...settings.suggestionRules,
                                bidDownAcosFactor: Math.max(0, Number(e.target.value) || 0),
                              },
                            })
                          }
                        />
                      </div>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className="text-sm font-medium">重点关注</div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <Label>高点击阈值</Label>
                        <Input
                          type="number"
                          min={1}
                          value={String(settings.suggestionRules.highClickMinClicks)}
                          onChange={(e) =>
                            updateSettings({
                              suggestionRules: {
                                ...settings.suggestionRules,
                                highClickMinClicks: Math.max(1, Math.floor(Number(e.target.value) || 1)),
                              },
                            })
                          }
                        />
                      </div>
                      <div className="space-y-1">
                        <Label>最高转化率（%）</Label>
                        <Input
                          type="number"
                          min={0}
                          step={0.1}
                          value={String(settings.suggestionRules.highClickMaxCvrPct)}
                          onChange={(e) =>
                            updateSettings({
                              suggestionRules: {
                                ...settings.suggestionRules,
                                highClickMaxCvrPct: Math.max(0, Number(e.target.value) || 0),
                              },
                            })
                          }
                        />
                      </div>
                      <div className="space-y-1">
                        <Label>广告组无成交点击</Label>
                        <Input
                          type="number"
                          min={1}
                          value={String(settings.suggestionRules.adGroupNoOrderMinClicks)}
                          onChange={(e) =>
                            updateSettings({
                              suggestionRules: {
                                ...settings.suggestionRules,
                                adGroupNoOrderMinClicks: Math.max(1, Math.floor(Number(e.target.value) || 1)),
                              },
                            })
                          }
                        />
                      </div>
                      <div className="space-y-1">
                        <Label>高 ACOS 阈值（%）</Label>
                        <Input
                          type="number"
                          min={0}
                          step={0.1}
                          value={String(settings.suggestionRules.highAcosThreshold)}
                          onChange={(e) =>
                            updateSettings({
                              suggestionRules: {
                                ...settings.suggestionRules,
                                highAcosThreshold: Math.max(0, Number(e.target.value) || 0),
                              },
                            })
                          }
                        />
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-2 pt-2">
                    <div className="text-xs text-muted-foreground">
                      目标 ACOS 来自表格筛选区的“目标 ACOS”
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-2"
                      onClick={() => updateSettings({ suggestionRules: DEFAULT_SUGGESTION_RULES })}
                    >
                      <RotateCcw className="w-4 h-4" />
                      恢复默认
                    </Button>
                  </div>
                </div>
                </SheetContent>
              </Sheet>
              <Button variant="outline" size="sm" className="gap-2" onClick={exportCurrent}>
                <Download className="w-4 h-4" />
                导出当前
              </Button>
              <Button size="sm" className="gap-2" onClick={exportAll}>
                <Download className="w-4 h-4" />
                一键导出决策表
              </Button>
            </div>
          </div>
        </CardHeader>
        <CollapsibleContent>
          <CardContent className="space-y-3">
            <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
              <div className="text-xs text-muted-foreground">
                {tab === "neg"
                  ? ruleSummary.neg
                  : tab === "harvest"
                    ? ruleSummary.harvest
                    : tab === "bid"
                      ? ruleSummary.bid
                      : ruleSummary.watch}
              </div>
              <TabsList className="h-auto flex-wrap justify-start">
                <TabsTrigger value="neg">否定词候选（{negatives.length}）</TabsTrigger>
                <TabsTrigger value="harvest">加词候选（{harvests.length}）</TabsTrigger>
                <TabsTrigger value="bid">出价调整（{bidUp.length + bidDown.length}）</TabsTrigger>
                <TabsTrigger value="watch">重点关注（{watch.length}）</TabsTrigger>
              </TabsList>
              <TabsContent value="neg">{renderTable(negatives.slice(0, 200))}</TabsContent>
              <TabsContent value="harvest">{renderTable(harvests.slice(0, 200))}</TabsContent>
              <TabsContent value="bid">
                <div className="space-y-4">
                  <div className="text-sm font-medium">建议上调（{bidUp.length}）</div>
                  {renderTable(bidUp.slice(0, 120))}
                  <div className="text-sm font-medium pt-2">建议下调（{bidDown.length}）</div>
                  {renderTable(bidDown.slice(0, 120))}
                </div>
              </TabsContent>
              <TabsContent value="watch">
                {renderTable(sortedWatch.slice(0, 200), {
                  sortable: true,
                  sortKey: watchSortKey,
                  sortDir: watchSortDir,
                  onSortChange: toggleWatchSort,
                  highlightAcos: true,
                })}
              </TabsContent>
            </Tabs>
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}
