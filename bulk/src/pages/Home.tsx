import { useEffect, useMemo, useRef, useState, type ChangeEvent, type Dispatch, type ReactNode, type SetStateAction } from "react";
import { motion } from "framer-motion";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import {
  buildPortfolioRows,
  buildSbRows,
  buildSdRows,
  buildSpRows,
  validatePortfolioWizard,
  validateSbWizard,
  validateSdWizard,
  validateSpWizard,
  warnSbWizard,
  warnSdWizard,
  warnSpWizard,
  type PortfolioWizard,
  type SbCampaignWizard,
  type SdCampaignWizard,
  type SpCampaignWizard,
  type SpBulkRow,
  type SpMatchType,
  type SpBiddingStrategy,
  type State,
  SHEETS,
  HEADERS,
} from "@/lib/bulk";
import {
  buildWorkbookFromTemplate,
  cloneWorkbook,
  downloadWorkbook,
  pruneWorkbookToUploadableSheets,
  readSheetAoA,
  readSheetRows,
  readWorkbookFromFile,
  replaceWorkbookSheetRows,
} from "@/lib/xlsx-export";
import { cn } from "@/lib/utils";
import type { WorkBook } from "xlsx";

type SpUiMode = SpCampaignWizard["mode"] | "visual-batch";

type SpStructuredImportResult = {
  rows: SpBulkRow[];
  errors: string[];
  warnings: string[];
  campaigns: number;
  adGroups: number;
  skus: number;
  keywords: number;
};

type SpBatchAdGroupDraft = {
  adGroupId: string;
  adGroupName: string;
  adGroupState: State;
  adGroupDefaultBid: number;
  skusText: string;
  keywordsText: string;
  productTargetingsText: string;
  negativeKeywordsText: string;
  negativeProductTargetingsText: string;
};

type SpBatchCampaignDraft = {
  mode: SpCampaignWizard["mode"];
  campaignId: string;
  campaignName: string;
  startDate: string;
  endDate: string;
  state: State;
  dailyBudget: number;
  portfolioId: string;
  biddingStrategy: SpBiddingStrategy;
  placementTopPct?: number;
  placementRestPct?: number;
  placementProductPagePct?: number;
  adGroups: SpBatchAdGroupDraft[];
};

type SpBatchDraft = {
  campaigns: SpBatchCampaignDraft[];
};

type SpBatchBuildResult = {
  rows: SpBulkRow[];
  errors: string[];
  warnings: string[];
  campaigns: number;
  adGroups: number;
  skus: number;
  keywords: number;
};

type SpImportedWorkbookResult = {
  draft: SpBatchDraft | null;
  errors: string[];
  warnings: string[];
  campaigns: number;
  adGroups: number;
  skus: number;
  keywords: number;
};

type SpImportedWorkbookContext = {
  workbook: WorkBook;
  fileName: string;
  sheetName: string;
  importMode: "draft-create" | "history-update";
  detectedImportMode: "draft-create" | "history-update";
  headerRow: string[];
  rawRows: Record<string, any>[];
  canonicalRows: Record<string, any>[];
  baselineDraft: SpBatchDraft;
};

type PreviewRowMeta = {
  rowStatus: "create" | "update";
  changedHeaders: string[];
  changeCount: number;
};

const previewHeaderLabels: Record<string, string> = {
  Operation: "操作",
  Product: "产品",
  Entity: "实体",
  "Campaign Name": "活动名称",
  "Ad Group Name": "广告组名称",
  "Start Date": "开始日期",
  "End Date": "结束日期",
  State: "状态",
  "Daily Budget": "预算",
  "Portfolio ID": "组合ID",
  "Bidding Strategy": "竞价策略",
  Placement: "广告位",
  Percentage: "加价比例",
  "Ad Group Default Bid": "广告组默认竞价",
  SKU: "SKU",
  Bid: "竞价",
  "Keyword Text": "关键词",
  "Match Type": "匹配类型",
  "Product Targeting Expression": "商品定位",
  "Targeting Type": "投放类型",
};

const previewHeaderOrder = [
  "Operation",
  "Product",
  "Entity",
  "Campaign Name",
  "Start Date",
  "End Date",
  "State",
  "Daily Budget",
  "Portfolio ID",
  "Bidding Strategy",
  "Placement",
  "Percentage",
  "Ad Group Name",
  "Ad Group Default Bid",
  "Bid",
  "SKU",
  "Keyword Text",
  "Match Type",
  "Product Targeting Expression",
  "Targeting Type",
] as const;

function createPreviewRowMeta(rowStatus: "create" | "update", changedHeaders: string[] = []): PreviewRowMeta {
  return {
    rowStatus,
    changedHeaders,
    changeCount: changedHeaders.length,
  };
}

function getPreviewChangedHeaderLabels(meta?: PreviewRowMeta) {
  if (!meta || !meta.changedHeaders.length) return "";
  return [...meta.changedHeaders]
    .sort((left, right) => {
      const leftRank = previewHeaderOrder.indexOf(left as (typeof previewHeaderOrder)[number]);
      const rightRank = previewHeaderOrder.indexOf(right as (typeof previewHeaderOrder)[number]);
      return (leftRank === -1 ? Number.MAX_SAFE_INTEGER : leftRank) - (rightRank === -1 ? Number.MAX_SAFE_INTEGER : rightRank);
    })
    .map((header) => previewHeaderLabels[header] ?? header)
    .join("、");
}

function IconBase({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

function Download({ className }: { className?: string }) {
  return (
    <IconBase className={className}>
      <path d="M12 3v12" />
      <path d="m7 10 5 5 5-5" />
      <path d="M5 21h14" />
    </IconBase>
  );
}

function Plus({ className }: { className?: string }) {
  return (
    <IconBase className={className}>
      <path d="M12 5v14" />
      <path d="M5 12h14" />
    </IconBase>
  );
}

function Upload({ className }: { className?: string }) {
  return (
    <IconBase className={className}>
      <path d="M12 21V9" />
      <path d="m7 14 5-5 5 5" />
      <path d="M5 4h14" />
    </IconBase>
  );
}

function ChevronRight({ className }: { className?: string }) {
  return (
    <IconBase className={className}>
      <path d="m9 18 6-6-6-6" />
    </IconBase>
  );
}

function Trash2({ className }: { className?: string }) {
  return (
    <IconBase className={className}>
      <path d="M3 6h18" />
      <path d="M8 6V4h8v2" />
      <path d="M19 6v14H5V6" />
      <path d="M10 11v6" />
      <path d="M14 11v6" />
    </IconBase>
  );
}

function todayYYYYMMDD() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}${m}${day}`;
}

function normalizeLines(text: string) {
  return text
    .split(/\r?\n/)
    .map((s) => s.trim());
}

function parseKeywordMatchType(value?: string): Exclude<SpMatchType, "negativeExact" | "negativePhrase"> | null {
  const v = (value || "").trim().toLowerCase();
  if (!v) return null;
  if (v === "broad" || v === "广泛") return "broad";
  if (v === "phrase" || v === "词组") return "phrase";
  if (v === "exact" || v === "精准") return "exact";
  return null;
}

function parseState(value?: string): State | null {
  const v = (value || "").trim().toLowerCase();
  if (!v) return null;
  if (v === "enabled" || v === "enable" || v === "启用" || v === "已启用") return "enabled";
  if (v === "paused" || v === "pause" || v === "暂停" || v === "已暂停") return "paused";
  return null;
}

function parseSpKeywordBulk(
  text: string,
  fallbackBid: number
): {
  rows: Array<{ text: string; matchType: Exclude<SpMatchType, "negativeExact" | "negativePhrase">; bid: number; state: State }>;
  invalidCount: number;
} {
  const rows: Array<{ text: string; matchType: Exclude<SpMatchType, "negativeExact" | "negativePhrase">; bid: number; state: State }> = [];
  let invalidCount = 0;

  for (const line of text.split(/\r?\n/)) {
    const raw = line.trim();
    if (!raw) continue;

    const parts = raw.includes("\t")
      ? raw.split("\t").map((x) => x.trim())
      : raw.split(",").map((x) => x.trim());
    const keywordText = parts[0] || "";
    if (!keywordText) {
      invalidCount += 1;
      continue;
    }

    const matchType = parseKeywordMatchType(parts[1]) ?? "exact";
    const bidParsed = Number(parts[2]);
    const bid = Number.isFinite(bidParsed) && bidParsed > 0 ? bidParsed : fallbackBid;
    const state = parseState(parts[3]) ?? "enabled";

    rows.push({ text: keywordText, matchType, bid, state });
  }

  return { rows, invalidCount };
}

function parseNegativeMatchType(value?: string): Extract<SpMatchType, "negativeExact" | "negativePhrase"> | null {
  const v = (value || "").trim().toLowerCase();
  if (!v) return null;
  if (v === "negativephrase" || v === "negative phrase" || v === "词组" || v === "否定词组" || v === "否定词组匹配") return "negativePhrase";
  if (v === "negativeexact" || v === "negative exact" || v === "精准" || v === "否定精准" || v === "否定精准匹配") return "negativeExact";
  return null;
}

function parseSpNegativeKeywordBulk(
  text: string
): {
  rows: Array<{ text: string; matchType: Extract<SpMatchType, "negativeExact" | "negativePhrase">; state: State }>;
  invalidCount: number;
} {
  const rows: Array<{ text: string; matchType: Extract<SpMatchType, "negativeExact" | "negativePhrase">; state: State }> = [];
  let invalidCount = 0;

  for (const line of text.split(/\r?\n/)) {
    const raw = line.trim();
    if (!raw) continue;
    const parts = raw.includes("\t")
      ? raw.split("\t").map((x) => x.trim())
      : raw.split(",").map((x) => x.trim());
    const keywordText = parts[0] || "";
    if (!keywordText) {
      invalidCount += 1;
      continue;
    }

    const matchType = parseNegativeMatchType(parts[1]) ?? "negativePhrase";
    const state = parseState(parts[2]) ?? "enabled";
    rows.push({ text: keywordText, matchType, state });
  }

  return { rows, invalidCount };
}

function parseSpNegativeProductTargetingBulk(
  text: string
): {
  rows: Array<{ expression: string; state: State }>;
  invalidCount: number;
} {
  const rows: Array<{ expression: string; state: State }> = [];
  let invalidCount = 0;

  for (const line of text.split(/\r?\n/)) {
    const raw = line.trim();
    if (!raw) continue;
    const parts = raw.includes("\t")
      ? raw.split("\t").map((x) => x.trim())
      : raw.split(",").map((x) => x.trim());
    const expression = parts[0] || "";
    if (!expression) {
      invalidCount += 1;
      continue;
    }

    const state = parseState(parts[1]) ?? "enabled";
    rows.push({ expression, state });
  }

  return { rows, invalidCount };
}

function parseSpProductTargetingBulk(
  text: string,
  fallbackBid: number
): {
  rows: Array<{ expression: string; bid: number; state: State }>;
  invalidCount: number;
} {
  const rows: Array<{ expression: string; bid: number; state: State }> = [];
  let invalidCount = 0;

  for (const line of text.split(/\r?\n/)) {
    const raw = line.trim();
    if (!raw) continue;
    const parts = raw.includes("\t")
      ? raw.split("\t").map((x) => x.trim())
      : raw.split(",").map((x) => x.trim());
    const expression = parts[0] || "";
    if (!expression) {
      invalidCount += 1;
      continue;
    }

    const bidParsed = Number(parts[1]);
    const bid = Number.isFinite(bidParsed) && bidParsed > 0 ? bidParsed : fallbackBid;
    const state = parseState(parts[2]) ?? "enabled";
    rows.push({ expression, bid, state });
  }

  return { rows, invalidCount };
}

function parseSdTargetingBulk(
  text: string,
  fallbackBid: number
): {
  rows: Array<{ expression: string; bid?: number; state: State }>;
  invalidCount: number;
} {
  const rows: Array<{ expression: string; bid?: number; state: State }> = [];
  let invalidCount = 0;

  for (const line of text.split(/\r?\n/)) {
    const raw = line.trim();
    if (!raw) continue;

    const parts = raw.includes("\t")
      ? raw.split("\t").map((x) => x.trim())
      : raw.split(",").map((x) => x.trim());
    const firstValue = parts[0] || "";
    if (!firstValue) {
      invalidCount += 1;
      continue;
    }

    const expression = /^asin(?:-expanded)?=/.test(firstValue) ? firstValue : `asin-expanded="${firstValue}"`;
    const bidParsed = Number(parts[1]);
    const bid = Number.isFinite(bidParsed) && bidParsed > 0 ? bidParsed : fallbackBid;
    const state = parseState(parts[2]) ?? "enabled";
    rows.push({ expression, bid, state });
  }

  return { rows, invalidCount };
}

function parseAutoTargetingRows(text: string): Array<{ expression: string; bid: number; state: State }> {
  const parsed = parseSpProductTargetingBulk(text, 0.75).rows;
  if (parsed.length) return parsed;
  return [{ expression: "close-match", bid: 0.75, state: "enabled" }];
}

function toAutoTargetingText(rows: Array<{ expression: string; bid: number; state: State }>) {
  return rows.map((x) => `${x.expression},${x.bid},${x.state}`).join("\n");
}

function parseKeywordRowsForUi(
  text: string,
  fallbackBid: number
): Array<{ text: string; matchType: Exclude<SpMatchType, "negativeExact" | "negativePhrase">; bid: number; state: State }> {
  const lines = text.split(/\r?\n/);
  const rows = lines
    .map((line) => {
      const raw = line.trim();
      if (!raw) return null;
      const parts = raw.includes("\t") ? raw.split("\t").map((x) => x.trim()) : raw.split(",").map((x) => x.trim());
      const bidParsed = Number(parts[2]);
      return {
        text: parts[0] ?? "",
        matchType: parseKeywordMatchType(parts[1]) ?? "exact",
        bid: Number.isFinite(bidParsed) && bidParsed > 0 ? bidParsed : fallbackBid,
        state: parseState(parts[3]) ?? "enabled",
      };
    })
    .filter((x): x is { text: string; matchType: Exclude<SpMatchType, "negativeExact" | "negativePhrase">; bid: number; state: State } => !!x);
  if (rows.length) return rows;
  return [{ text: "", matchType: "exact", bid: fallbackBid, state: "enabled" }];
}

function toKeywordRowsText(
  rows: Array<{ text: string; matchType: Exclude<SpMatchType, "negativeExact" | "negativePhrase">; bid: number; state: State }>
) {
  return rows.map((x) => `${x.text},${x.matchType},${x.bid},${x.state}`).join("\n");
}

function parseNegativeKeywordRowsForUi(text: string): Array<{ text: string; matchType: Extract<SpMatchType, "negativeExact" | "negativePhrase">; state: State }> {
  const rows = text
    .split(/\r?\n/)
    .map((line) => {
      const raw = line.trim();
      if (!raw) return null;
      const parts = raw.includes("\t") ? raw.split("\t").map((x) => x.trim()) : raw.split(",").map((x) => x.trim());
      return {
        text: parts[0] ?? "",
        matchType: parseNegativeMatchType(parts[1]) ?? "negativePhrase",
        state: parseState(parts[2]) ?? "enabled",
      };
    })
    .filter((x): x is { text: string; matchType: Extract<SpMatchType, "negativeExact" | "negativePhrase">; state: State } => !!x);
  if (rows.length) return rows;
  return [{ text: "", matchType: "negativePhrase", state: "enabled" }];
}

function toNegativeKeywordRowsText(rows: Array<{ text: string; matchType: Extract<SpMatchType, "negativeExact" | "negativePhrase">; state: State }>) {
  return rows.map((x) => `${x.text},${x.matchType},${x.state}`).join("\n");
}

function parseNegativeProductTargetingRowsForUi(text: string): Array<{ expression: string; state: State }> {
  const rows = text
    .split(/\r?\n/)
    .map((line) => {
      const raw = line.trim();
      if (!raw) return null;
      const parts = raw.includes("\t") ? raw.split("\t").map((x) => x.trim()) : raw.split(",").map((x) => x.trim());
      return {
        expression: parts[0] ?? "",
        state: parseState(parts[1]) ?? "enabled",
      };
    })
    .filter((x): x is { expression: string; state: State } => !!x);
  if (rows.length) return rows;
  return [{ expression: "", state: "enabled" }];
}

function toNegativeProductTargetingRowsText(rows: Array<{ expression: string; state: State }>) {
  return rows.map((x) => `${x.expression},${x.state}`).join("\n");
}

function parseProductTargetingRowsForUi(text: string, fallbackBid: number): Array<{ expression: string; bid: number; state: State }> {
  const rows = text
    .split(/\r?\n/)
    .map((line) => {
      const raw = line.trim();
      if (!raw) return null;
      const parts = raw.includes("\t") ? raw.split("\t").map((x) => x.trim()) : raw.split(",").map((x) => x.trim());
      const bidParsed = Number(parts[1]);
      return {
        expression: parts[0] ?? "",
        bid: Number.isFinite(bidParsed) && bidParsed > 0 ? bidParsed : fallbackBid,
        state: parseState(parts[2]) ?? "enabled",
      };
    })
    .filter((x): x is { expression: string; bid: number; state: State } => !!x);
  if (rows.length) return rows;
  return [{ expression: "", bid: fallbackBid, state: "enabled" }];
}

const autoTargetingTypeOptions = ["close-match", "loose-match", "substitutes", "complements"] as const;

const validSpBiddingStrategies: readonly SpBiddingStrategy[] = [
  "Fixed bid",
  "Dynamic bids - down only",
  "Dynamic bids - up and down",
];

const spImportSheetNameCandidates = [SHEETS.spCampaigns, "商品推广活动"] as const;

const spImportHeaderAliases: Record<string, string> = {
  product: "Product",
  "产品": "Product",
  entity: "Entity",
  "实体层级": "Entity",
  operation: "Operation",
  "操作": "Operation",
  "campaignid": "Campaign ID",
  "广告活动编号": "Campaign ID",
  "adgroupid": "Ad Group ID",
  "广告组编号": "Ad Group ID",
  "portfolioid": "Portfolio ID",
  "广告组合编号": "Portfolio ID",
  "adid": "Ad ID",
  "广告编号": "Ad ID",
  "keywordid": "Keyword ID",
  "关键词编号": "Keyword ID",
  "producttargetingid": "Product Targeting ID",
  "商品投放id": "Product Targeting ID",
  "campaignname": "Campaign Name",
  "广告活动名称": "Campaign Name",
  "adgroupname": "Ad Group Name",
  "广告组名称": "Ad Group Name",
  "startdate": "Start Date",
  "开始日期": "Start Date",
  "enddate": "End Date",
  "结束日期": "End Date",
  "targetingtype": "Targeting Type",
  "投放类型": "Targeting Type",
  state: "State",
  "状态": "State",
  "dailybudget": "Daily Budget",
  "每日预算": "Daily Budget",
  sku: "SKU",
  "广告组默认竞价": "Ad Group Default Bid",
  "adgroupdefaultbid": "Ad Group Default Bid",
  bid: "Bid",
  "竞价": "Bid",
  "keywordtext": "Keyword Text",
  "关键词文本": "Keyword Text",
  "nativelanguagekeyword": "Native Language Keyword",
  "母语关键词": "Native Language Keyword",
  "nativelanguagelocale": "Native Language Locale",
  "母语区域": "Native Language Locale",
  "matchtype": "Match Type",
  "匹配类型": "Match Type",
  "biddingstrategy": "Bidding Strategy",
  "竞价方案": "Bidding Strategy",
  placement: "Placement",
  "广告位": "Placement",
  percentage: "Percentage",
  "百分比": "Percentage",
  "producttargetingexpression": "Product Targeting Expression",
  "拓展商品投放名称": "Product Targeting Expression",
  "拓展商品投放名称仅供参考": "Product Targeting Expression",
};

function normalizeImportLabel(value: unknown) {
  return String(value ?? "")
    .trim()
    .replace(/\s+/g, "")
    .replace(/[()（）]/g, "");
}

function hasOwnState(record: Record<string, boolean>, key: string) {
  return Object.prototype.hasOwnProperty.call(record, key);
}

function buildCampaignKey(index: number) {
  return `campaign-${index}`;
}

function buildAdGroupKey(campaignIndex: number, adGroupIndex: number) {
  return `adgroup-${campaignIndex}-${adGroupIndex}`;
}

function remapCampaignStateAfterDelete(record: Record<string, boolean>, deletedIndex: number) {
  const next: Record<string, boolean> = {};
  for (const [key, value] of Object.entries(record)) {
    const match = /^campaign-(\d+)$/.exec(key);
    if (!match) continue;
    const index = Number(match[1]);
    if (index === deletedIndex) continue;
    next[buildCampaignKey(index > deletedIndex ? index - 1 : index)] = value;
  }
  return next;
}

function remapAdGroupStateAfterCampaignDelete(record: Record<string, boolean>, deletedCampaignIndex: number) {
  const next: Record<string, boolean> = {};
  for (const [key, value] of Object.entries(record)) {
    const match = /^adgroup-(\d+)-(\d+)$/.exec(key);
    if (!match) continue;
    const campaignIndex = Number(match[1]);
    const adGroupIndex = Number(match[2]);
    if (campaignIndex === deletedCampaignIndex) continue;
    next[buildAdGroupKey(campaignIndex > deletedCampaignIndex ? campaignIndex - 1 : campaignIndex, adGroupIndex)] = value;
  }
  return next;
}

function remapAdGroupStateAfterDelete(record: Record<string, boolean>, campaignIndex: number, deletedAdGroupIndex: number) {
  const next: Record<string, boolean> = {};
  for (const [key, value] of Object.entries(record)) {
    const match = /^adgroup-(\d+)-(\d+)$/.exec(key);
    if (!match) continue;
    const currentCampaignIndex = Number(match[1]);
    const adGroupIndex = Number(match[2]);
    if (currentCampaignIndex !== campaignIndex) {
      next[key] = value;
      continue;
    }
    if (adGroupIndex === deletedAdGroupIndex) continue;
    next[buildAdGroupKey(campaignIndex, adGroupIndex > deletedAdGroupIndex ? adGroupIndex - 1 : adGroupIndex)] = value;
  }
  return next;
}

function shouldAutoExpandFromFocus(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;
  return Boolean(target.closest("input, textarea, [contenteditable='true']"));
}

function cloneSpBatchDraft(draft: SpBatchDraft): SpBatchDraft {
  return {
    campaigns: draft.campaigns.map((campaign) => ({
      ...campaign,
      adGroups: campaign.adGroups.map((adGroup) => ({ ...adGroup })),
    })),
  };
}

function normalizeSpImportedRow(row: Record<string, any>) {
  const next: Record<string, any> = {};
  for (const [key, value] of Object.entries(row)) {
    const canonical = spImportHeaderAliases[normalizeImportLabel(key).toLowerCase()] ?? key;
    next[canonical] = value;
  }
  return next;
}

function parseImportedSpEntity(value: string) {
  const normalized = value.trim().toLowerCase();
  if (!normalized) return "";
  const map: Record<string, string> = {
    campaign: "Campaign",
    "广告活动": "Campaign",
    "bidding adjustment": "Bidding Adjustment",
    "竞价调整": "Bidding Adjustment",
    "ad group": "Ad Group",
    "广告组": "Ad Group",
    "product ad": "Product Ad",
    "商品广告": "Product Ad",
    keyword: "Keyword",
    "关键词": "Keyword",
    "product targeting": "Product Targeting",
    "商品定向": "Product Targeting",
    "negative keyword": "Negative Keyword",
    "否定关键词": "Negative Keyword",
    "negative product targeting": "Negative Product Targeting",
    "否定商品定向": "Negative Product Targeting",
  };
  return map[normalized] ?? value.trim();
}

function parseImportedSpBiddingStrategy(value: string) {
  const normalized = value.trim();
  if (!normalized) return null;
  if (normalized === "固定竞价" || normalized === "Fixed bid") return "Fixed bid";
  if (normalized === "动态竞价 - 仅降低" || normalized === "Dynamic bids - down only") return "Dynamic bids - down only";
  if (normalized === "动态竞价 - 提高和降低" || normalized === "Dynamic bids - up and down") return "Dynamic bids - up and down";
  return null;
}

function parseImportedPlacement(value: string) {
  const normalized = value.trim();
  if (!normalized) return null;
  if (normalized.includes("首页首位")) return "placementTop";
  if (normalized.includes("商品页面")) return "placementProductPage";
  if (normalized.includes("其余位置") || normalized.includes("亚马逊企业购") || normalized === "placementRestOfSearch") {
    return "placementRestOfSearch";
  }
  if (normalized === "placementTop" || normalized === "placementProductPage" || normalized === "placementRestOfSearch") {
    return normalized;
  }
  return null;
}

function scoreSpImportHeaderRow(headerRow: Array<string | number | boolean | null>) {
  const normalized = new Set(headerRow.map((cell) => normalizeImportLabel(cell).toLowerCase()));
  const required = ["产品", "实体层级", "广告活动编号", "广告活动名称", "状态"];
  return required.reduce((sum, key) => sum + (normalized.has(normalizeImportLabel(key).toLowerCase()) ? 1 : 0), 0);
}

function normalizeCompareValue(value: unknown) {
  return String(value ?? "").trim().toLowerCase();
}

function normalizeSpCompareValueByField(canonicalKey: string, value: unknown) {
  const text = stringifyCell(value);
  if (!text) return "";

  if (canonicalKey === "Entity") {
    return normalizeCompareValue(parseImportedSpEntity(text));
  }
  if (canonicalKey === "State") {
    return parseState(text) ?? normalizeCompareValue(text);
  }
  if (canonicalKey === "Bidding Strategy") {
    return parseImportedSpBiddingStrategy(text) ?? normalizeCompareValue(text);
  }
  if (canonicalKey === "Placement") {
    return parseImportedPlacement(text) ?? normalizeCompareValue(text);
  }
  if (canonicalKey === "Targeting Type") {
    if (text.toUpperCase() === "AUTO" || text === "自动") return "auto";
    if (text.toUpperCase() === "MANUAL" || text === "手动") return "manual";
  }
  if (canonicalKey === "Match Type") {
    return parseKeywordMatchType(text) ?? parseNegativeMatchType(text) ?? normalizeCompareValue(text);
  }
  if (canonicalKey === "Daily Budget" || canonicalKey === "Ad Group Default Bid" || canonicalKey === "Bid" || canonicalKey === "Percentage") {
    const num = Number(text);
    return Number.isFinite(num) ? String(num) : normalizeCompareValue(text);
  }

  return normalizeCompareValue(text);
}

function shouldPreserveImportedCell(
  canonicalKey: string,
  generatedValue: unknown,
  rawCanonicalValue: unknown
) {
  return normalizeSpCompareValueByField(canonicalKey, generatedValue) === normalizeSpCompareValueByField(canonicalKey, rawCanonicalValue);
}

function detectSpImportMode(rows: Record<string, any>[]): "draft-create" | "history-update" {
  let updateLikeRows = 0;
  let rowsWithEntityIds = 0;

  for (const rawRow of rows) {
    const row = normalizeSpImportedRow(rawRow);
    const operation = normalizeCompareValue(row["Operation"]);
    const entity = parseImportedSpEntity(stringifyCell(row["Entity"]));
    const adId = stringifyCell(row["Ad ID"]);
    const keywordId = stringifyCell(row["Keyword ID"]);
    const productTargetingId = stringifyCell(row["Product Targeting ID"]);

    if (operation === "update" || operation === "archive") {
      updateLikeRows += 1;
    }

    if (
      (entity === "Product Ad" && adId) ||
      (entity === "Keyword" && keywordId) ||
      (entity === "Negative Keyword" && keywordId) ||
      (entity === "Product Targeting" && productTargetingId) ||
      (entity === "Negative Product Targeting" && productTargetingId)
    ) {
      rowsWithEntityIds += 1;
    }
  }

  return updateLikeRows > 0 || rowsWithEntityIds > 0 ? "history-update" : "draft-create";
}

function countRowsByOperation(rows: Record<string, any>[]) {
  return rows.reduce(
    (acc, row) => {
      const operation = normalizeCompareValue(row["Operation"]);
      if (operation === "update") acc.update += 1;
      else if (operation === "create") acc.create += 1;
      else if (operation === "archive") acc.archive += 1;
      else acc.other += 1;
      return acc;
    },
    { create: 0, update: 0, archive: 0, other: 0 }
  );
}

function buildSpImportedHeaderMap(headerRow: string[]) {
  const map: Record<string, string> = {};
  for (const header of headerRow) {
    const canonical = spImportHeaderAliases[normalizeImportLabel(header).toLowerCase()] ?? header;
    if (!map[canonical]) map[canonical] = header;
  }
  return map;
}

function buildSpRowIdentity(row: Record<string, any>) {
  const entity = parseImportedSpEntity(stringifyCell(row["Entity"]));
  const campaignId = stringifyCell(row["Campaign ID"]);
  const adGroupId = stringifyCell(row["Ad Group ID"]);

  if (entity === "Campaign") return `Campaign|${campaignId}`;
  if (entity === "Bidding Adjustment") {
    return `Bidding Adjustment|${campaignId}|${parseImportedPlacement(stringifyCell(row["Placement"])) ?? normalizeCompareValue(row["Placement"])}`;
  }
  if (entity === "Ad Group") return `Ad Group|${campaignId}|${adGroupId}`;
  if (entity === "Product Ad") return `Product Ad|${campaignId}|${adGroupId}|${normalizeCompareValue(row["SKU"])}`;
  if (entity === "Keyword") {
    return `Keyword|${campaignId}|${adGroupId}|${normalizeCompareValue(row["Keyword Text"])}|${parseKeywordMatchType(stringifyCell(row["Match Type"])) ?? normalizeCompareValue(row["Match Type"])}`;
  }
  if (entity === "Negative Keyword") {
    return `Negative Keyword|${campaignId}|${adGroupId}|${normalizeCompareValue(row["Keyword Text"])}|${parseNegativeMatchType(stringifyCell(row["Match Type"])) ?? normalizeCompareValue(row["Match Type"])}`;
  }
  if (entity === "Product Targeting") {
    return `Product Targeting|${campaignId}|${adGroupId}|${normalizeCompareValue(row["Product Targeting Expression"])}`;
  }
  if (entity === "Negative Product Targeting") {
    return `Negative Product Targeting|${campaignId}|${adGroupId}|${normalizeCompareValue(row["Product Targeting Expression"])}`;
  }
  return [
    entity,
    campaignId,
    adGroupId,
    normalizeCompareValue(row["Keyword Text"]),
    normalizeCompareValue(row["Product Targeting Expression"]),
    normalizeCompareValue(row["SKU"]),
  ].join("|");
}

function buildSpImportedRowLookup(rows: Record<string, any>[]) {
  const lookup = new Map<string, Record<string, any>[]>();
  for (const row of rows) {
    const key = buildSpRowIdentity(row);
    const bucket = lookup.get(key) ?? [];
    bucket.push(row);
    lookup.set(key, bucket);
  }
  return lookup;
}

function mergeSpRowsWithImportedContext(context: SpImportedWorkbookContext, generatedRows: SpBulkRow[]) {
  const headerMap = buildSpImportedHeaderMap(context.headerRow);
  const originalLookup = buildSpImportedRowLookup(context.rawRows.map((row) => normalizeSpImportedRow(row)).map((row, index) => ({
    ...row,
    __rawIndex: index,
  })));
  const consumedRawIndexes = new Set<number>();

  return generatedRows.map((generatedRow) => {
    const key = buildSpRowIdentity(generatedRow as Record<string, any>);
    const bucket = originalLookup.get(key) ?? [];
    const match = bucket.shift();
    const rawRow =
      match && typeof match.__rawIndex === "number"
        ? context.rawRows[match.__rawIndex]
        : undefined;
    const rawCanonicalRow = rawRow ? normalizeSpImportedRow(rawRow) : undefined;

    if (match && typeof match.__rawIndex === "number") {
      consumedRawIndexes.add(match.__rawIndex);
    }

    const next: Record<string, any> = rawRow ? { ...rawRow } : {};
    for (const [canonicalKey, value] of Object.entries(generatedRow)) {
      const targetKey = headerMap[canonicalKey] ?? canonicalKey;
      if (canonicalKey === "Operation" && context.importMode === "history-update") {
        next[targetKey] = rawRow ? "Update" : value || "Create";
        continue;
      }
      if (rawRow && rawCanonicalRow && shouldPreserveImportedCell(canonicalKey, value, rawCanonicalRow[canonicalKey])) {
        continue;
      }
      next[targetKey] = value ?? "";
    }
    return next;
  });
}

function buildSpPreviewRowsWithDiff(context: SpImportedWorkbookContext, generatedRows: SpBulkRow[]) {
  const headerMap = buildSpImportedHeaderMap(context.headerRow);
  const originalLookup = buildSpImportedRowLookup(
    context.rawRows
      .map((row) => normalizeSpImportedRow(row))
      .map((row, index) => ({
        ...row,
        __rawIndex: index,
      }))
  );

  const rows: Record<string, any>[] = [];
  const meta: PreviewRowMeta[] = [];

  for (const generatedRow of generatedRows) {
    const key = buildSpRowIdentity(generatedRow as Record<string, any>);
    const bucket = originalLookup.get(key) ?? [];
    const match = bucket.shift();
    const rawRow =
      match && typeof match.__rawIndex === "number"
        ? context.rawRows[match.__rawIndex]
        : undefined;
    const rawCanonicalRow = rawRow ? normalizeSpImportedRow(rawRow) : undefined;
    const next: Record<string, any> = rawRow ? { ...rawRow } : {};
    const changedHeaders: string[] = [];

    for (const [canonicalKey, value] of Object.entries(generatedRow)) {
      const targetKey = headerMap[canonicalKey] ?? canonicalKey;

      if (canonicalKey === "Operation" && context.importMode === "history-update") {
        const nextOperation = rawRow ? "Update" : value || "Create";
        next[targetKey] = nextOperation;
        if (normalizeCompareValue(nextOperation) !== normalizeCompareValue(rawCanonicalRow?.[canonicalKey])) {
          changedHeaders.push(targetKey);
        }
        continue;
      }

      if (rawRow && rawCanonicalRow && shouldPreserveImportedCell(canonicalKey, value, rawCanonicalRow[canonicalKey])) {
        continue;
      }

      next[targetKey] = value ?? "";
      if (rawRow) changedHeaders.push(targetKey);
    }

    rows.push(next);
    meta.push(createPreviewRowMeta(rawRow ? "update" : "create", changedHeaders));
  }

  return { rows, meta };
}

function getCampaignDiffState(
  current: SpBatchCampaignDraft,
  baselineMap: Map<string, SpBatchCampaignDraft>
): "new" | "modified" | null {
  const baseline = baselineMap.get(current.campaignId);
  if (!baseline) return current.campaignId.trim() ? "new" : null;
  const currentComparable = JSON.stringify({
    mode: current.mode,
    campaignId: current.campaignId,
    campaignName: current.campaignName,
    startDate: current.startDate,
    endDate: current.endDate,
    state: current.state,
    dailyBudget: current.dailyBudget,
    portfolioId: current.portfolioId,
    biddingStrategy: current.biddingStrategy,
    placementTopPct: current.placementTopPct ?? null,
    placementRestPct: current.placementRestPct ?? null,
    placementProductPagePct: current.placementProductPagePct ?? null,
  });
  const baselineComparable = JSON.stringify({
    mode: baseline.mode,
    campaignId: baseline.campaignId,
    campaignName: baseline.campaignName,
    startDate: baseline.startDate,
    endDate: baseline.endDate,
    state: baseline.state,
    dailyBudget: baseline.dailyBudget,
    portfolioId: baseline.portfolioId,
    biddingStrategy: baseline.biddingStrategy,
    placementTopPct: baseline.placementTopPct ?? null,
    placementRestPct: baseline.placementRestPct ?? null,
    placementProductPagePct: baseline.placementProductPagePct ?? null,
  });
  return currentComparable === baselineComparable ? null : "modified";
}

function getCampaignDiffFields(
  current: SpBatchCampaignDraft,
  baselineMap: Map<string, SpBatchCampaignDraft>
) {
  const baseline = baselineMap.get(current.campaignId);
  if (!baseline) return current.campaignId.trim() ? ["新活动"] : [];

  const changed: string[] = [];
  const compare = (label: string, left: unknown, right: unknown) => {
    if (JSON.stringify(left) !== JSON.stringify(right)) changed.push(label);
  };

  compare("投放类型", current.mode, baseline.mode);
  compare("活动名称", current.campaignName.trim(), baseline.campaignName.trim());
  compare("开始日期", current.startDate.trim(), baseline.startDate.trim());
  compare("结束日期", (current.endDate || "").trim(), (baseline.endDate || "").trim());
  compare("状态", current.state, baseline.state);
  compare("预算", current.dailyBudget, baseline.dailyBudget);
  compare("组合ID", (current.portfolioId || "").trim(), (baseline.portfolioId || "").trim());
  compare("竞价策略", current.biddingStrategy, baseline.biddingStrategy);
  compare("首页顶部加价", current.placementTopPct ?? null, baseline.placementTopPct ?? null);
  compare("其余位置加价", current.placementRestPct ?? null, baseline.placementRestPct ?? null);
  compare("商品页加价", current.placementProductPagePct ?? null, baseline.placementProductPagePct ?? null);

  return changed;
}

function isDiffValue(left: unknown, right: unknown) {
  return JSON.stringify(left) !== JSON.stringify(right);
}

function getAdGroupDiffState(
  campaignId: string,
  current: SpBatchAdGroupDraft,
  baselineMap: Map<string, SpBatchAdGroupDraft>
): "new" | "modified" | null {
  const baseline = baselineMap.get(`${campaignId}::${current.adGroupId}`);
  if (!baseline) return current.adGroupId.trim() ? "new" : null;
  const currentComparable = JSON.stringify(current);
  const baselineComparable = JSON.stringify(baseline);
  return currentComparable === baselineComparable ? null : "modified";
}

function getAdGroupDiffFields(
  campaignId: string,
  current: SpBatchAdGroupDraft,
  baselineMap: Map<string, SpBatchAdGroupDraft>
) {
  const baseline = baselineMap.get(`${campaignId}::${current.adGroupId}`);
  if (!baseline) return current.adGroupId.trim() ? ["新广告组"] : [];

  const changed: string[] = [];
  const compare = (label: string, left: unknown, right: unknown) => {
    if (JSON.stringify(left) !== JSON.stringify(right)) changed.push(label);
  };

  compare("广告组名称", current.adGroupName.trim(), baseline.adGroupName.trim());
  compare("默认竞价", current.adGroupDefaultBid, baseline.adGroupDefaultBid);
  compare("状态", current.adGroupState, baseline.adGroupState);
  compare("SKU列表", normalizeLines(current.skusText), normalizeLines(baseline.skusText));
  compare("关键词列表", normalizeLines(current.keywordsText), normalizeLines(baseline.keywordsText));
  compare("商品定位", normalizeLines(current.productTargetingsText), normalizeLines(baseline.productTargetingsText));
  compare("否词列表", normalizeLines(current.negativeKeywordsText), normalizeLines(baseline.negativeKeywordsText));
  compare("否定ASIN", normalizeLines(current.negativeProductTargetingsText), normalizeLines(baseline.negativeProductTargetingsText));

  return changed;
}

function getDiffFieldClassName(changed: boolean) {
  return changed
    ? "border-amber-400/70 bg-amber-50/80 ring-1 ring-amber-300/30 dark:border-amber-500/60 dark:bg-amber-500/10"
    : "";
}

function getDiffLabelClassName(changed: boolean) {
  return changed ? "text-amber-700 dark:text-amber-300" : undefined;
}

function stringifyCell(value: unknown) {
  return String(value ?? "").trim();
}

function parsePositiveNumber(value: unknown, fallback: number) {
  const num = Number(value);
  return Number.isFinite(num) && num > 0 ? num : fallback;
}

function pushUniqueLine(list: string[], value: string) {
  const next = value.trim();
  if (!next || list.includes(next)) return;
  list.push(next);
}

function countFilledLines(text: string) {
  return normalizeLines(text).filter(Boolean).length;
}

function countPrimaryItemsForAdGroup(mode: SpCampaignWizard["mode"], adGroup: SpBatchAdGroupDraft) {
  if (mode === "manual-keyword") {
    return parseKeywordRowsForUi(adGroup.keywordsText, adGroup.adGroupDefaultBid || 0.75).filter((row) => row.text.trim()).length;
  }
  return parseProductTargetingRowsForUi(adGroup.productTargetingsText, adGroup.adGroupDefaultBid || 0.75).filter((row) => row.expression.trim()).length;
}

function parseSpStructuredBulkInput(text: string): SpStructuredImportResult {
  const lines = text
    .split(/\r?\n/)
    .map((x) => x.trim())
    .filter(Boolean);
  if (!lines.length) {
    return { rows: [], errors: [], warnings: [], campaigns: 0, adGroups: 0, skus: 0, keywords: 0 };
  }

  const errors: string[] = [];
  const warnings: string[] = [];
  const delimiter = lines.some((x) => x.includes("\t")) ? "\t" : ",";
  const splitLine = (line: string) => line.split(delimiter).map((x) => x.trim());
  const normalizeKey = (s: string) => s.toLowerCase().replace(/[\s_\-]/g, "");

  const headerAliases: Record<string, string[]> = {
    campaignid: ["campaignid", "campaign id", "活动id", "广告活动id"],
    campaignname: ["campaignname", "campaign name", "活动名", "广告活动名称"],
    adgroupid: ["adgroupid", "ad group id", "广告组id"],
    adgroupname: ["adgroupname", "ad group name", "广告组名称"],
    sku: ["sku", "skus"],
    keywordtext: ["keywordtext", "keyword", "keyword text", "关键词", "关键词文本"],
    matchtype: ["matchtype", "match type", "匹配方式"],
    bid: ["bid", "出价"],
    state: ["state", "状态"],
    dailybudget: ["dailybudget", "daily budget", "日预算"],
    startdate: ["startdate", "start date", "开始日期"],
    enddate: ["enddate", "end date", "结束日期"],
    portfolioid: ["portfolioid", "portfolio id", "组合id"],
    campaignstate: ["campaignstate", "campaign state"],
    adgroupstate: ["adgroupstate", "ad group state"],
    skustate: ["skustate", "sku state"],
    keywordstate: ["keywordstate", "keyword state"],
    adgroupdefaultbid: ["adgroupdefaultbid", "ad group default bid"],
    biddingstrategy: ["biddingstrategy", "bidding strategy"],
    targetingtype: ["targetingtype", "targeting type"],
  };

  const first = splitLine(lines[0]);
  const firstNorm = first.map(normalizeKey);
  const isHeader =
    firstNorm.some((k) => headerAliases.campaignid.includes(k)) &&
    firstNorm.some((k) => headerAliases.adgroupid.includes(k));

  const headerMap = new Map<string, number>();
  if (isHeader) {
    for (let i = 0; i < firstNorm.length; i += 1) {
      for (const [canonical, aliases] of Object.entries(headerAliases)) {
        if (aliases.includes(firstNorm[i])) headerMap.set(canonical, i);
      }
    }
  }

  const rowsRaw = isHeader ? lines.slice(1) : lines;
  const getValue = (parts: string[], canonical: string, fixedIndex: number) => {
    if (isHeader) {
      const idx = headerMap.get(canonical);
      return idx == null ? "" : parts[idx] || "";
    }
    return parts[fixedIndex] || "";
  };

  type CampaignNode = {
    campaignId: string;
    campaignName: string;
    startDate: string;
    endDate: string;
    campaignState: State;
    dailyBudget: number;
    portfolioId: string;
    biddingStrategy: SpBiddingStrategy;
    targetingType: "MANUAL" | "AUTO";
  };
  type AdGroupNode = {
    key: string;
    campaignId: string;
    adGroupId: string;
    adGroupName: string;
    adGroupState: State;
    adGroupDefaultBid: number;
  };

  const campaigns = new Map<string, CampaignNode>();
  const adGroups = new Map<string, AdGroupNode>();
  const skuKeys = new Set<string>();
  const keywordKeys = new Set<string>();
  const skuRows: Array<{ campaignId: string; adGroupId: string; sku: string; state: State }> = [];
  const keywordRows: Array<{
    campaignId: string;
    adGroupId: string;
    keywordText: string;
    matchType: Exclude<SpMatchType, "negativeExact" | "negativePhrase">;
    bid: number;
    state: State;
  }> = [];

  for (let i = 0; i < rowsRaw.length; i += 1) {
    const rowNo = i + (isHeader ? 2 : 1);
    const parts = splitLine(rowsRaw[i]);

    const campaignId = getValue(parts, "campaignid", 0);
    const campaignName = getValue(parts, "campaignname", 1);
    const adGroupId = getValue(parts, "adgroupid", 2);
    const adGroupName = getValue(parts, "adgroupname", 3);
    const sku = getValue(parts, "sku", 4);
    const keywordText = getValue(parts, "keywordtext", 5);

    if (!campaignId || !campaignName || !adGroupId || !adGroupName) {
      errors.push(`第${rowNo}行：缺少 Campaign/Ad Group 关键字段`);
      continue;
    }
    if (!sku) warnings.push(`第${rowNo}行：SKU 为空，已跳过 Product Ad 行`);
    if (!keywordText) warnings.push(`第${rowNo}行：Keyword Text 为空，已跳过 Keyword 行`);

    const matchType = parseKeywordMatchType(getValue(parts, "matchtype", 6)) ?? "exact";
    const bidValue = Number(getValue(parts, "bid", 7));
    const adGroupDefaultBid = Number(getValue(parts, "adgroupdefaultbid", 17));
    const fallbackBid = Number.isFinite(adGroupDefaultBid) && adGroupDefaultBid > 0 ? adGroupDefaultBid : 0.75;
    const keywordBid = Number.isFinite(bidValue) && bidValue > 0 ? bidValue : fallbackBid;
    const sharedState = parseState(getValue(parts, "state", 8)) ?? "enabled";
    const campaignState = parseState(getValue(parts, "campaignstate", 13)) ?? sharedState;
    const adGroupState = parseState(getValue(parts, "adgroupstate", 14)) ?? sharedState;
    const skuState = parseState(getValue(parts, "skustate", 15)) ?? "enabled";
    const keywordState = parseState(getValue(parts, "keywordstate", 16)) ?? "enabled";
    const dailyBudgetRaw = Number(getValue(parts, "dailybudget", 9));
    const dailyBudget = Number.isFinite(dailyBudgetRaw) && dailyBudgetRaw > 0 ? dailyBudgetRaw : 20;
    const startDateRaw = getValue(parts, "startdate", 10);
    const startDate = /^\d{8}$/.test(startDateRaw) ? startDateRaw : todayYYYYMMDD();
    const endDateRaw = getValue(parts, "enddate", 11);
    const endDate = /^\d{8}$/.test(endDateRaw) ? endDateRaw : "";
    const portfolioId = getValue(parts, "portfolioid", 12);
    const strategyRaw = getValue(parts, "biddingstrategy", 18);
    const biddingStrategy: SpBiddingStrategy =
      strategyRaw === "Dynamic bids - down only" || strategyRaw === "Dynamic bids - up and down" || strategyRaw === "Fixed bid"
        ? strategyRaw
        : "Fixed bid";
    const targetingTypeRaw = getValue(parts, "targetingtype", 19).toUpperCase();
    const targetingType: "MANUAL" | "AUTO" = targetingTypeRaw === "AUTO" ? "AUTO" : "MANUAL";

    if (!campaigns.has(campaignId)) {
      campaigns.set(campaignId, {
        campaignId,
        campaignName,
        startDate,
        endDate,
        campaignState,
        dailyBudget,
        portfolioId,
        biddingStrategy,
        targetingType,
      });
    }
    const adGroupKey = `${campaignId}__${adGroupId}`;
    if (!adGroups.has(adGroupKey)) {
      adGroups.set(adGroupKey, {
        key: adGroupKey,
        campaignId,
        adGroupId,
        adGroupName,
        adGroupState,
        adGroupDefaultBid: fallbackBid,
      });
    }

    if (sku) {
      const skuKey = `${campaignId}__${adGroupId}__${sku}`;
      if (!skuKeys.has(skuKey)) {
        skuKeys.add(skuKey);
        skuRows.push({ campaignId, adGroupId, sku, state: skuState });
      }
    }
    if (keywordText) {
      const kwKey = `${campaignId}__${adGroupId}__${keywordText}__${matchType}`;
      if (!keywordKeys.has(kwKey)) {
        keywordKeys.add(kwKey);
        keywordRows.push({ campaignId, adGroupId, keywordText, matchType, bid: keywordBid, state: keywordState });
      }
    }
  }

  if (errors.length) {
    return {
      rows: [],
      errors,
      warnings,
      campaigns: campaigns.size,
      adGroups: adGroups.size,
      skus: skuRows.length,
      keywords: keywordRows.length,
    };
  }

  const rows: SpBulkRow[] = [];
  const adGroupsByCampaign = new Map<string, AdGroupNode[]>();
  for (const ag of adGroups.values()) {
    const list = adGroupsByCampaign.get(ag.campaignId) ?? [];
    list.push(ag);
    adGroupsByCampaign.set(ag.campaignId, list);
  }

  for (const c of campaigns.values()) {
    rows.push({
      Product: "Sponsored Products",
      Entity: "Campaign",
      Operation: "Create",
      "Campaign ID": c.campaignId,
      "Campaign Name": c.campaignName,
      "Portfolio ID": c.portfolioId || "",
      "Start Date": c.startDate,
      "End Date": c.endDate || "",
      "Targeting Type": c.targetingType,
      State: c.campaignState,
      "Daily Budget": c.dailyBudget,
      "Bidding Strategy": c.biddingStrategy,
    });

    for (const ag of adGroupsByCampaign.get(c.campaignId) ?? []) {
      rows.push({
        Product: "Sponsored Products",
        Entity: "Ad Group",
        Operation: "Create",
        "Campaign ID": c.campaignId,
        "Ad Group ID": ag.adGroupId,
        "Portfolio ID": c.portfolioId || "",
        "Campaign Name": c.campaignName,
        "Ad Group Name": ag.adGroupName,
        "Start Date": c.startDate,
        "End Date": c.endDate || "",
        "Targeting Type": c.targetingType,
        State: ag.adGroupState,
        "Daily Budget": c.dailyBudget,
        "Ad Group Default Bid": ag.adGroupDefaultBid,
        "Bidding Strategy": c.biddingStrategy,
      });

      for (const sku of skuRows.filter((x) => x.campaignId === c.campaignId && x.adGroupId === ag.adGroupId)) {
        rows.push({
          Product: "Sponsored Products",
          Entity: "Product Ad",
          Operation: "Create",
          "Campaign ID": c.campaignId,
          "Ad Group ID": ag.adGroupId,
          "Portfolio ID": c.portfolioId || "",
          "Campaign Name": c.campaignName,
          "Ad Group Name": ag.adGroupName,
          "Start Date": c.startDate,
          "End Date": c.endDate || "",
          "Targeting Type": c.targetingType,
          State: sku.state,
          "Daily Budget": c.dailyBudget,
          SKU: sku.sku,
          "Bidding Strategy": c.biddingStrategy,
        });
      }

      for (const kw of keywordRows.filter((x) => x.campaignId === c.campaignId && x.adGroupId === ag.adGroupId)) {
        rows.push({
          Product: "Sponsored Products",
          Entity: "Keyword",
          Operation: "Create",
          "Campaign ID": c.campaignId,
          "Ad Group ID": ag.adGroupId,
          "Portfolio ID": c.portfolioId || "",
          "Campaign Name": c.campaignName,
          "Ad Group Name": ag.adGroupName,
          "Start Date": c.startDate,
          "End Date": c.endDate || "",
          "Targeting Type": c.targetingType,
          State: kw.state,
          "Daily Budget": c.dailyBudget,
          Bid: kw.bid,
          "Keyword Text": kw.keywordText,
          "Match Type": kw.matchType,
          "Bidding Strategy": c.biddingStrategy,
        });
      }
    }
  }

  return {
    rows,
    errors: [],
    warnings,
    campaigns: campaigns.size,
    adGroups: adGroups.size,
    skus: skuRows.length,
    keywords: keywordRows.length,
  };
}

function createInitialSpBatchAdGroup(): SpBatchAdGroupDraft {
  return {
    adGroupId: "",
    adGroupName: "",
    adGroupState: "enabled",
    adGroupDefaultBid: 0.75,
    skusText: "",
    keywordsText: "",
    productTargetingsText: "",
    negativeKeywordsText: "",
    negativeProductTargetingsText: "",
  };
}

function createInitialSpBatchCampaign(): SpBatchCampaignDraft {
  return {
    mode: "manual-keyword",
    campaignId: "",
    campaignName: "",
    startDate: todayYYYYMMDD(),
    endDate: "",
    state: "enabled",
    dailyBudget: 20,
    portfolioId: "",
    biddingStrategy: "Fixed bid",
    placementTopPct: undefined,
    placementRestPct: undefined,
    placementProductPagePct: undefined,
    adGroups: [createInitialSpBatchAdGroup()],
  };
}

function createInitialSpBatchDraft(): SpBatchDraft {
  return {
    campaigns: [createInitialSpBatchCampaign()],
  };
}

function buildSpBatchDraftFromImportedRows(rows: Record<string, any>[]): SpImportedWorkbookResult {
  const normalizedRows = rows.map(normalizeSpImportedRow);

  if (!normalizedRows.length) {
    return {
      draft: null,
      errors: ["导入文件里没有可读取的 SP 数据行"],
      warnings: [],
      campaigns: 0,
      adGroups: 0,
      skus: 0,
      keywords: 0,
    };
  }

  type ImportedAdGroupNode = {
    draft: SpBatchAdGroupDraft;
    skus: string[];
    keywords: string[];
    productTargetings: string[];
    negativeKeywords: string[];
    negativeProductTargetings: string[];
  };

  type ImportedCampaignNode = {
    draft: Omit<SpBatchCampaignDraft, "adGroups">;
    adGroups: Map<string, ImportedAdGroupNode>;
    hasKeywords: boolean;
    hasAutoTargetings: boolean;
    hasManualProductTargetings: boolean;
  };

  const warnings: string[] = [];
  const errors: string[] = [];
  const campaigns = new Map<string, ImportedCampaignNode>();

  function ensureCampaign(row: Record<string, any>, rowNo: number) {
    const campaignId = stringifyCell(row["Campaign ID"]);
    if (!campaignId) {
      warnings.push(`第${rowNo}行：缺少 Campaign ID，已跳过`);
      return null;
    }

    let node = campaigns.get(campaignId);
    if (!node) {
      const initial = createInitialSpBatchCampaign();
      node = {
        draft: {
          ...initial,
          campaignId,
          campaignName: stringifyCell(row["Campaign Name"]) || initial.campaignName,
          startDate: /^\d{8}$/.test(stringifyCell(row["Start Date"])) ? stringifyCell(row["Start Date"]) : initial.startDate,
          endDate: /^\d{8}$/.test(stringifyCell(row["End Date"])) ? stringifyCell(row["End Date"]) : "",
          state: parseState(stringifyCell(row["State"])) ?? initial.state,
          dailyBudget: parsePositiveNumber(row["Daily Budget"], initial.dailyBudget),
          portfolioId: stringifyCell(row["Portfolio ID"]),
          biddingStrategy: parseImportedSpBiddingStrategy(stringifyCell(row["Bidding Strategy"])) ?? initial.biddingStrategy,
          mode:
            stringifyCell(row["Targeting Type"]).toUpperCase() === "AUTO" || stringifyCell(row["Targeting Type"]) === "自动"
              ? "auto"
              : initial.mode,
        },
        adGroups: new Map(),
        hasKeywords: false,
        hasAutoTargetings: false,
        hasManualProductTargetings: false,
      };
      campaigns.set(campaignId, node);
    }

    const campaignName = stringifyCell(row["Campaign Name"]);
    const startDate = stringifyCell(row["Start Date"]);
    const endDate = stringifyCell(row["End Date"]);
    const portfolioId = stringifyCell(row["Portfolio ID"]);
    const strategy = parseImportedSpBiddingStrategy(stringifyCell(row["Bidding Strategy"]));
    const targetingType = stringifyCell(row["Targeting Type"]).toUpperCase();
    const state = parseState(stringifyCell(row["State"]));
    if (campaignName) node.draft.campaignName = campaignName;
    if (/^\d{8}$/.test(startDate)) node.draft.startDate = startDate;
    if (!endDate || /^\d{8}$/.test(endDate)) node.draft.endDate = endDate;
    if (state) node.draft.state = state;
    if (portfolioId) node.draft.portfolioId = portfolioId;
    node.draft.dailyBudget = parsePositiveNumber(row["Daily Budget"], node.draft.dailyBudget);
    if (strategy) node.draft.biddingStrategy = strategy;
    if (targetingType === "AUTO" || stringifyCell(row["Targeting Type"]) === "自动") node.draft.mode = "auto";
    return node;
  }

  function ensureAdGroup(campaignNode: ImportedCampaignNode, row: Record<string, any>, rowNo: number) {
    const adGroupId = stringifyCell(row["Ad Group ID"]);
    if (!adGroupId) {
      warnings.push(`第${rowNo}行：缺少 Ad Group ID，已跳过`);
      return null;
    }

    let node = campaignNode.adGroups.get(adGroupId);
    if (!node) {
      const initial = createInitialSpBatchAdGroup();
      node = {
        draft: {
          ...initial,
          adGroupId,
          adGroupName: stringifyCell(row["Ad Group Name"]) || initial.adGroupName,
          adGroupState: parseState(stringifyCell(row["State"])) ?? initial.adGroupState,
          adGroupDefaultBid: parsePositiveNumber(row["Ad Group Default Bid"], initial.adGroupDefaultBid),
        },
        skus: [],
        keywords: [],
        productTargetings: [],
        negativeKeywords: [],
        negativeProductTargetings: [],
      };
      campaignNode.adGroups.set(adGroupId, node);
    }

    const adGroupName = stringifyCell(row["Ad Group Name"]);
    const adGroupState = parseState(stringifyCell(row["State"]));
    if (adGroupName) node.draft.adGroupName = adGroupName;
    if (adGroupState) node.draft.adGroupState = adGroupState;
    node.draft.adGroupDefaultBid = parsePositiveNumber(row["Ad Group Default Bid"], node.draft.adGroupDefaultBid);
    return node;
  }

  for (let idx = 0; idx < normalizedRows.length; idx += 1) {
    const rowNo = idx + 2;
    const row = normalizedRows[idx];
    const entity = parseImportedSpEntity(stringifyCell(row["Entity"]));
    if (!entity) continue;

    const campaignNode = ensureCampaign(row, rowNo);
    if (!campaignNode) continue;

    if (entity === "Campaign") continue;

    if (entity === "Bidding Adjustment") {
      const placement = parseImportedPlacement(stringifyCell(row["Placement"]));
      const percentageRaw = stringifyCell(row["Percentage"]);
      const percentage = percentageRaw === "" ? undefined : Number(percentageRaw);
      if (!placement || !Number.isFinite(percentage)) continue;
      if (placement === "placementTop") campaignNode.draft.placementTopPct = percentage;
      if (placement === "placementRestOfSearch") campaignNode.draft.placementRestPct = percentage;
      if (placement === "placementProductPage") campaignNode.draft.placementProductPagePct = percentage;
      continue;
    }

    const adGroupNode = ensureAdGroup(campaignNode, row, rowNo);
    if (!adGroupNode) continue;

    if (entity === "Ad Group") continue;

    if (entity === "Product Ad") {
      const sku = stringifyCell(row["SKU"]);
      if (!sku) {
        warnings.push(`第${rowNo}行：Product Ad 缺少 SKU，已跳过`);
        continue;
      }
      pushUniqueLine(adGroupNode.skus, sku);
      continue;
    }

    if (entity === "Keyword") {
      const keywordText = stringifyCell(row["Keyword Text"]);
      if (!keywordText) {
        warnings.push(`第${rowNo}行：Keyword 缺少 Keyword Text，已跳过`);
        continue;
      }
      const matchType = parseKeywordMatchType(stringifyCell(row["Match Type"])) ?? "exact";
      const state = parseState(stringifyCell(row["State"])) ?? "enabled";
      const bid = parsePositiveNumber(row["Bid"], adGroupNode.draft.adGroupDefaultBid || 0.75);
      pushUniqueLine(adGroupNode.keywords, `${keywordText},${matchType},${bid},${state}`);
      campaignNode.hasKeywords = true;
      continue;
    }

    if (entity === "Product Targeting") {
      const expression = stringifyCell(row["Product Targeting Expression"]);
      if (!expression) {
        warnings.push(`第${rowNo}行：Product Targeting 缺少表达式，已跳过`);
        continue;
      }
      const state = parseState(stringifyCell(row["State"])) ?? "enabled";
      const bid = parsePositiveNumber(row["Bid"], adGroupNode.draft.adGroupDefaultBid || 0.75);
      pushUniqueLine(adGroupNode.productTargetings, `${expression},${bid},${state}`);
      if (autoTargetingTypeOptions.includes(expression as (typeof autoTargetingTypeOptions)[number])) {
        campaignNode.hasAutoTargetings = true;
      } else {
        campaignNode.hasManualProductTargetings = true;
      }
      continue;
    }

    if (entity === "Negative Keyword") {
      const keywordText = stringifyCell(row["Keyword Text"]);
      if (!keywordText) continue;
      const matchType = parseNegativeMatchType(stringifyCell(row["Match Type"])) ?? "negativePhrase";
      const state = parseState(stringifyCell(row["State"])) ?? "enabled";
      pushUniqueLine(adGroupNode.negativeKeywords, `${keywordText},${matchType},${state}`);
      continue;
    }

    if (entity === "Negative Product Targeting") {
      const expression = stringifyCell(row["Product Targeting Expression"]);
      if (!expression) continue;
      const state = parseState(stringifyCell(row["State"])) ?? "enabled";
      pushUniqueLine(adGroupNode.negativeProductTargetings, `${expression},${state}`);
    }
  }

  if (!campaigns.size) {
    return {
      draft: null,
      errors: ["文件里没有识别到可导入的活动数据"],
      warnings,
      campaigns: 0,
      adGroups: 0,
      skus: 0,
      keywords: 0,
    };
  }

  const draftCampaigns: SpBatchCampaignDraft[] = [];
  let adGroupsCount = 0;
  let skusCount = 0;
  let keywordsCount = 0;

  for (const campaignNode of campaigns.values()) {
    if (campaignNode.hasAutoTargetings && (campaignNode.hasKeywords || campaignNode.hasManualProductTargetings)) {
      errors.push(`活动 ${campaignNode.draft.campaignName || campaignNode.draft.campaignId} 同时包含自动投放与其他定位结构，当前无法安全回填`);
      continue;
    }
    if (campaignNode.hasKeywords && campaignNode.hasManualProductTargetings) {
      errors.push(`活动 ${campaignNode.draft.campaignName || campaignNode.draft.campaignId} 同时包含关键词和商品定位，当前批量 UI 无法同时编辑这两种结构`);
      continue;
    }

    const mode: SpCampaignWizard["mode"] = campaignNode.hasAutoTargetings
      ? "auto"
      : campaignNode.hasManualProductTargetings
        ? "manual-product-targeting"
        : campaignNode.hasKeywords
          ? "manual-keyword"
          : campaignNode.draft.mode;

    const adGroups = Array.from(campaignNode.adGroups.values()).map((adGroupNode) => {
      adGroupsCount += 1;
      skusCount += adGroupNode.skus.length;
      keywordsCount += mode === "manual-keyword" ? adGroupNode.keywords.length : adGroupNode.productTargetings.length;
      return {
        ...adGroupNode.draft,
        skusText: adGroupNode.skus.join("\n"),
        keywordsText: adGroupNode.keywords.join("\n"),
        productTargetingsText: adGroupNode.productTargetings.join("\n"),
        negativeKeywordsText: adGroupNode.negativeKeywords.join("\n"),
        negativeProductTargetingsText: adGroupNode.negativeProductTargetings.join("\n"),
      };
    });

    draftCampaigns.push({
      ...campaignNode.draft,
      mode,
      adGroups: adGroups.length ? adGroups : [createInitialSpBatchAdGroup()],
    });
  }

  return {
    draft: errors.length ? null : { campaigns: draftCampaigns },
    errors,
    warnings,
    campaigns: draftCampaigns.length,
    adGroups: adGroupsCount,
    skus: skusCount,
    keywords: keywordsCount,
  };
}

function buildSpRowsFromBatchDraft(draft: SpBatchDraft): SpBatchBuildResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const rows: SpBulkRow[] = [];
  let adGroupsCount = 0;
  let skusCount = 0;
  let keywordsCount = 0;

  for (let ci = 0; ci < draft.campaigns.length; ci += 1) {
    const c = draft.campaigns[ci];
    const cLabel = `活动#${ci + 1}`;
    if (!c.campaignId.trim()) errors.push(`${cLabel}：Campaign ID 不能为空`);
    if (!c.campaignName.trim()) errors.push(`${cLabel}：Campaign Name 不能为空`);
    if (!/^\d{8}$/.test(c.startDate)) errors.push(`${cLabel}：Start Date 必须是 YYYYMMDD`);
    if (c.endDate && !/^\d{8}$/.test(c.endDate)) errors.push(`${cLabel}：End Date 必须是 YYYYMMDD`);
    if (!(c.dailyBudget > 0)) errors.push(`${cLabel}：Daily Budget 必须大于0`);
    if (!c.adGroups.length) errors.push(`${cLabel}：至少添加1个广告组`);
  }

  if (errors.length) {
    return {
      rows: [],
      errors,
      warnings,
      campaigns: draft.campaigns.length,
      adGroups: 0,
      skus: 0,
      keywords: 0,
    };
  }

  for (let ci = 0; ci < draft.campaigns.length; ci += 1) {
    const c = draft.campaigns[ci];
    const targetingType = c.mode === "auto" ? "AUTO" : "MANUAL";
    rows.push({
      Product: "Sponsored Products",
      Entity: "Campaign",
      Operation: "Create",
      "Campaign ID": c.campaignId,
      "Campaign Name": c.campaignName,
      "Portfolio ID": c.portfolioId || "",
      "Start Date": c.startDate,
      "End Date": c.endDate || "",
      "Targeting Type": targetingType,
      State: c.state,
      "Daily Budget": c.dailyBudget,
      "Bidding Strategy": c.biddingStrategy,
    });

    const placements: Array<{ placement: string; pct?: number }> = [
      { placement: "placementTop", pct: c.placementTopPct },
      { placement: "placementRestOfSearch", pct: c.placementRestPct },
      { placement: "placementProductPage", pct: c.placementProductPagePct },
    ];
    for (const p of placements) {
      if (p.pct == null) continue;
      rows.push({
        Product: "Sponsored Products",
        Entity: "Bidding Adjustment",
        Operation: "Create",
        "Campaign ID": c.campaignId,
        "Portfolio ID": c.portfolioId || "",
        "Campaign Name": c.campaignName,
        "Start Date": c.startDate,
        "End Date": c.endDate || "",
        "Targeting Type": targetingType,
        State: c.state,
        "Daily Budget": c.dailyBudget,
        Placement: p.placement,
        Percentage: p.pct,
        "Bidding Strategy": c.biddingStrategy,
      });
    }

    for (let gi = 0; gi < c.adGroups.length; gi += 1) {
      const g = c.adGroups[gi];
      const gLabel = `活动#${ci + 1} 广告组#${gi + 1}`;
      adGroupsCount += 1;
      if (!g.adGroupId.trim()) errors.push(`${gLabel}：Ad Group ID 不能为空`);
      if (!g.adGroupName.trim()) errors.push(`${gLabel}：Ad Group Name 不能为空`);
      if (!(g.adGroupDefaultBid > 0)) errors.push(`${gLabel}：Ad Group Default Bid 必须大于0`);

      const skus = normalizeLines(g.skusText).filter(Boolean);
      const kwParsed = parseSpKeywordBulk(g.keywordsText, g.adGroupDefaultBid || 0.75);
      const ptParsed = parseSpProductTargetingBulk(g.productTargetingsText, g.adGroupDefaultBid || 0.75);
      const negKwParsed = parseSpNegativeKeywordBulk(g.negativeKeywordsText);
      const negPtParsed = parseSpNegativeProductTargetingBulk(g.negativeProductTargetingsText);
      if (!skus.length) errors.push(`${gLabel}：至少填写1个SKU`);
      if (c.mode === "manual-keyword" && !kwParsed.rows.length) errors.push(`${gLabel}：至少填写1个关键词`);
      if ((c.mode === "auto" || c.mode === "manual-product-targeting") && !ptParsed.rows.length) {
        errors.push(`${gLabel}：至少填写1条商品定位表达式`);
      }
      if (kwParsed.invalidCount > 0) warnings.push(`${gLabel}：关键词有 ${kwParsed.invalidCount} 行格式无效已跳过`);
      if (ptParsed.invalidCount > 0) warnings.push(`${gLabel}：商品定位有 ${ptParsed.invalidCount} 行格式无效已跳过`);
      if (negKwParsed.invalidCount > 0) warnings.push(`${gLabel}：否词有 ${negKwParsed.invalidCount} 行格式无效已跳过`);
      if (negPtParsed.invalidCount > 0) warnings.push(`${gLabel}：否定ASIN有 ${negPtParsed.invalidCount} 行格式无效已跳过`);

      if (!g.adGroupId.trim() || !g.adGroupName.trim() || !(g.adGroupDefaultBid > 0)) continue;

      rows.push({
        Product: "Sponsored Products",
        Entity: "Ad Group",
        Operation: "Create",
        "Campaign ID": c.campaignId,
        "Ad Group ID": g.adGroupId,
        "Portfolio ID": c.portfolioId || "",
        "Campaign Name": c.campaignName,
        "Ad Group Name": g.adGroupName,
        "Start Date": c.startDate,
        "End Date": c.endDate || "",
        "Targeting Type": targetingType,
        State: g.adGroupState,
        "Daily Budget": c.dailyBudget,
        "Ad Group Default Bid": g.adGroupDefaultBid,
        "Bidding Strategy": c.biddingStrategy,
      });

      for (const sku of skus) {
        skusCount += 1;
        rows.push({
          Product: "Sponsored Products",
          Entity: "Product Ad",
          Operation: "Create",
          "Campaign ID": c.campaignId,
          "Ad Group ID": g.adGroupId,
          "Portfolio ID": c.portfolioId || "",
          "Campaign Name": c.campaignName,
          "Ad Group Name": g.adGroupName,
          "Start Date": c.startDate,
          "End Date": c.endDate || "",
          "Targeting Type": targetingType,
          State: "enabled",
          "Daily Budget": c.dailyBudget,
          SKU: sku,
          "Bidding Strategy": c.biddingStrategy,
        });
      }

      if (c.mode === "manual-keyword") {
        for (const kw of kwParsed.rows) {
          keywordsCount += 1;
          rows.push({
            Product: "Sponsored Products",
            Entity: "Keyword",
            Operation: "Create",
            "Campaign ID": c.campaignId,
            "Ad Group ID": g.adGroupId,
            "Portfolio ID": c.portfolioId || "",
            "Campaign Name": c.campaignName,
            "Ad Group Name": g.adGroupName,
            "Start Date": c.startDate,
            "End Date": c.endDate || "",
            "Targeting Type": targetingType,
            State: kw.state,
            "Daily Budget": c.dailyBudget,
            Bid: kw.bid,
            "Keyword Text": kw.text,
            "Match Type": kw.matchType,
            "Bidding Strategy": c.biddingStrategy,
          });
        }
      }

      if (c.mode === "auto" || c.mode === "manual-product-targeting") {
        for (const pt of ptParsed.rows) {
          keywordsCount += 1;
          rows.push({
            Product: "Sponsored Products",
            Entity: "Product Targeting",
            Operation: "Create",
            "Campaign ID": c.campaignId,
            "Ad Group ID": g.adGroupId,
            "Portfolio ID": c.portfolioId || "",
            "Campaign Name": c.campaignName,
            "Ad Group Name": g.adGroupName,
            "Start Date": c.startDate,
            "End Date": c.endDate || "",
            "Targeting Type": targetingType,
            State: pt.state,
            "Daily Budget": c.dailyBudget,
            Bid: pt.bid,
            "Product Targeting Expression": pt.expression,
            "Bidding Strategy": c.biddingStrategy,
          });
        }
      }

      for (const nkw of negKwParsed.rows) {
        rows.push({
          Product: "Sponsored Products",
          Entity: "Negative Keyword",
          Operation: "Create",
          "Campaign ID": c.campaignId,
          "Ad Group ID": g.adGroupId,
          "Portfolio ID": c.portfolioId || "",
          "Campaign Name": c.campaignName,
          "Ad Group Name": g.adGroupName,
          "Start Date": c.startDate,
          "End Date": c.endDate || "",
          "Targeting Type": targetingType,
          State: nkw.state,
          "Daily Budget": c.dailyBudget,
          "Keyword Text": nkw.text,
          "Match Type": nkw.matchType,
          "Bidding Strategy": c.biddingStrategy,
        });
      }

      for (const npt of negPtParsed.rows) {
        rows.push({
          Product: "Sponsored Products",
          Entity: "Negative Product Targeting",
          Operation: "Create",
          "Campaign ID": c.campaignId,
          "Ad Group ID": g.adGroupId,
          "Portfolio ID": c.portfolioId || "",
          "Campaign Name": c.campaignName,
          "Ad Group Name": g.adGroupName,
          "Start Date": c.startDate,
          "End Date": c.endDate || "",
          "Targeting Type": targetingType,
          State: npt.state,
          "Daily Budget": c.dailyBudget,
          "Product Targeting Expression": npt.expression,
          "Bidding Strategy": c.biddingStrategy,
        });
      }
    }
  }

  if (errors.length) {
    return {
      rows: [],
      errors,
      warnings,
      campaigns: draft.campaigns.length,
      adGroups: adGroupsCount,
      skus: skusCount,
      keywords: keywordsCount,
    };
  }

  return {
    rows,
    errors: [],
    warnings,
    campaigns: draft.campaigns.length,
    adGroups: adGroupsCount,
    skus: skusCount,
    keywords: keywordsCount,
  };
}

const biddingStrategies: { label: string; value: SpBiddingStrategy }[] = [
  { label: "Fixed bid（固定竞价）", value: "Fixed bid" },
  { label: "Dynamic bids - down only（仅降低）", value: "Dynamic bids - down only" },
  { label: "Dynamic bids - up and down（提高和降低）", value: "Dynamic bids - up and down" },
];

const stateOptions: { label: string; value: State }[] = [
  { label: "enabled（启用）", value: "enabled" },
  { label: "paused（暂停）", value: "paused" },
];

const keywordMatchOptions: {
  label: string;
  value: Exclude<SpMatchType, "negativeExact" | "negativePhrase">;
}[] = [
  { label: "broad（广泛）", value: "broad" },
  { label: "phrase（词组）", value: "phrase" },
  { label: "exact（精准）", value: "exact" },
];

const negMatchOptions: {
  label: string;
  value: Extract<SpMatchType, "negativeExact" | "negativePhrase">;
}[] = [
  { label: "negativePhrase（否定词组）", value: "negativePhrase" },
  { label: "negativeExact（否定精准）", value: "negativeExact" },
];

const spBatchModeOptions: { label: string; value: SpCampaignWizard["mode"] }[] = [
  { label: "手动关键词", value: "manual-keyword" },
  { label: "自动广告", value: "auto" },
  { label: "商品定位", value: "manual-product-targeting" },
];

function createInitialSp(): SpCampaignWizard {
  return {
    mode: "manual-keyword",
    campaignId: "",
    campaignName: "",
    startDate: todayYYYYMMDD(),
    endDate: "",
    targetingType: "MANUAL",
    state: "enabled",
    dailyBudget: 20,
    portfolioId: "",
    biddingStrategy: "Fixed bid",
    placementTopPct: undefined,
    placementRestPct: undefined,
    placementProductPagePct: undefined,
    adGroupId: "",
    adGroupName: "",
    adGroupState: "enabled",
    adGroupDefaultBid: 0.75,
    skus: [],
    keywords: [{ text: "", matchType: "exact", bid: 0.75, state: "enabled" }],
    negativeKeywords: [],
    negativeProductTargetings: [],
    productTargetings: [
      { expression: "close-match", bid: 0.75, state: "enabled" },
      { expression: "loose-match", bid: 0.75, state: "paused" },
      { expression: "substitutes", bid: 0.75, state: "paused" },
      { expression: "complements", bid: 0.75, state: "paused" },
    ],
  };
}

function createInitialPortfolio(): PortfolioWizard {
  return {
    portfolioId: "",
    portfolioName: "",
    operation: "Create",
    budgetAmount: undefined,
    budgetCurrencyCode: "USD",
    budgetPolicy: "daily",
    budgetStartDate: "",
    budgetEndDate: "",
  };
}

function createInitialSb(): SbCampaignWizard {
  return {
    campaignId: "",
    campaignName: "",
    startDate: todayYYYYMMDD(),
    endDate: "",
    state: "enabled",
    budgetType: "daily",
    budget: 20,
    portfolioId: "",
    adGroupId: "",
    adFormat: "productCollection",
    landingPageUrl: "",
    landingPageAsins: [],
    creativeHeadline: "",
    creativeAsins: [],
    brandEntityId: "",
    brandName: "",
    brandLogoAssetId: "",
    customImageAssetId: "",
    keywords: [{ text: "", matchType: "exact", bid: 0.1, state: "enabled" }],
  };
}

function createInitialSd(): SdCampaignWizard {
  return {
    campaignId: "",
    campaignName: "",
    startDate: todayYYYYMMDD(),
    endDate: "",
    state: "enabled",
    portfolioId: "",
    tactic: "T00030",
    budgetType: "daily",
    budget: 20,
    adGroupId: "",
    adGroupName: "",
    adGroupDefaultBid: 0.75,
    skus: [],
    targetings: [{ expression: 'asin="B0XXXXXXXX"', bid: 0.75, state: "enabled" }],
    bidOptimization: "",
    costType: "",
  };
}

export default function Home() {
  const [tool, setTool] = useState<"sp" | "sb" | "sd" | "portfolios">("sp");
  const [helpOpen, setHelpOpen] = useState(false);
  const [workspaceLayout, setWorkspaceLayout] = useState<"split" | "editor" | "preview">("split");
  const [previewOperationFilter, setPreviewOperationFilter] = useState<"all" | "create" | "update">("all");
  const [spMode, setSpMode] = useState<SpUiMode>("manual-keyword");
  const [spBatchDraft, setSpBatchDraft] = useState<SpBatchDraft>(() => createInitialSpBatchDraft());
  const [spOpenCampaigns, setSpOpenCampaigns] = useState<Record<string, boolean>>({ "campaign-0": true });
  const [spSelectedCampaigns, setSpSelectedCampaigns] = useState<Record<string, boolean>>({});
  const [spImportedContext, setSpImportedContext] = useState<SpImportedWorkbookContext | null>(null);
  const importWorkbookInputRef = useRef<HTMLInputElement | null>(null);
  const spImportModeRef = useRef<"draft-create" | "history-update">("draft-create");

  const [sp, setSp] = useState<SpCampaignWizard>(() => createInitialSp());

  const spWizard = useMemo<SpCampaignWizard>(() => {
    const targetingType = spMode === "auto" ? "AUTO" : "MANUAL";
    return { ...sp, mode: spMode === "visual-batch" ? "manual-keyword" : spMode, targetingType };
  }, [sp, spMode]);
  const spBatch = useMemo(() => buildSpRowsFromBatchDraft(spBatchDraft), [spBatchDraft]);

  const [portfolio, setPortfolio] = useState<PortfolioWizard>(() => createInitialPortfolio());

  const [sb, setSb] = useState<SbCampaignWizard>(() => createInitialSb());

  const [sd, setSd] = useState<SdCampaignWizard>(() => createInitialSd());

  const [settings, setSettings] = useState(() => ({
    currency: "USD",
    minBidSp: 0.02,
    minBidSb: 0.1,
    minBidSd: 0.02,
    keywordMaxChars: 80,
  }));

  const spIssues = useMemo(
    () => (spMode === "visual-batch" ? spBatch.errors : validateSpWizard(spWizard)),
    [spMode, spBatch.errors, spWizard]
  );
  const sbIssues = useMemo(() => validateSbWizard(sb), [sb]);
  const sdIssues = useMemo(() => validateSdWizard(sd), [sd]);
  const portfolioIssues = useMemo(() => validatePortfolioWizard(portfolio), [portfolio]);

  const spWarnings = useMemo(() => {
    if (spMode === "visual-batch") return spBatch.warnings;
    return warnSpWizard(spWizard, { minBidSp: settings.minBidSp, keywordMaxChars: settings.keywordMaxChars });
  }, [spMode, spBatch.warnings, spWizard, settings.minBidSp, settings.keywordMaxChars]);
  const sbWarnings = useMemo(
    () => warnSbWizard(sb, { minBidSb: settings.minBidSb, keywordMaxChars: settings.keywordMaxChars }),
    [sb, settings.minBidSb, settings.keywordMaxChars]
  );
  const sdWarnings = useMemo(() => warnSdWizard(sd, { minBidSd: settings.minBidSd }), [sd, settings.minBidSd]);
  const portfolioWarnings = useMemo(() => [], []);


  const spRows = useMemo(() => {
    if (spMode === "visual-batch") return spBatch.errors.length ? [] : spBatch.rows;
    return spIssues.length ? [] : buildSpRows(spWizard);
  }, [spMode, spBatch.errors.length, spBatch.rows, spWizard, spIssues.length]);
  const spPreviewData = useMemo(() => {
    if (!(spMode === "visual-batch" && spImportedContext)) {
      return {
        rows: spRows,
        meta: spRows.map((row) =>
          createPreviewRowMeta(normalizeCompareValue(row["Operation"]) === "update" ? "update" : "create")
        ),
      };
    }
    const selectedDraft: SpBatchDraft = {
      campaigns: spBatchDraft.campaigns.filter((_, index) => spSelectedCampaigns[buildCampaignKey(index)] ?? false),
    };
    const selectedBatch = buildSpRowsFromBatchDraft(selectedDraft);
    return selectedBatch.errors.length
      ? { rows: [], meta: [] }
      : buildSpPreviewRowsWithDiff(spImportedContext, selectedBatch.rows);
  }, [spMode, spImportedContext, spRows, spBatchDraft, spSelectedCampaigns]);
  const spPreviewRows = spPreviewData.rows;
  const sbRows = useMemo(() => (sbIssues.length ? [] : buildSbRows(sb)), [sb, sbIssues.length]);
  const sdRows = useMemo(() => (sdIssues.length ? [] : buildSdRows(sd)), [sd, sdIssues.length]);
  const portfolioRows = useMemo(
    () => (portfolioIssues.length ? [] : buildPortfolioRows(portfolio)),
    [portfolio, portfolioIssues.length]
  );
  const currentPreviewRows = tool === "sp" ? spPreviewRows : tool === "sb" ? sbRows : tool === "sd" ? sdRows : portfolioRows;
  const currentPreviewMeta = tool === "sp" ? spPreviewData.meta : [];
  const filteredPreviewData = useMemo(() => {
    const rows: Record<string, any>[] = [];
    const meta: PreviewRowMeta[] = [];
    currentPreviewRows.forEach((row, index) => {
      if (previewOperationFilter !== "all" && normalizeCompareValue(row["Operation"]) !== previewOperationFilter) {
        return;
      }
      rows.push(row);
      meta.push(
        currentPreviewMeta[index] ??
          createPreviewRowMeta(normalizeCompareValue(row["Operation"]) === "update" ? "update" : "create")
      );
    });
    return { rows, meta };
  }, [currentPreviewMeta, currentPreviewRows, previewOperationFilter]);
  const filteredPreviewRows = filteredPreviewData.rows;
  const filteredPreviewMeta = filteredPreviewData.meta;
  const currentPreviewOperationCounts = useMemo(() => countRowsByOperation(currentPreviewRows), [currentPreviewRows]);
  const currentPreviewDiffSummary = useMemo(() => {
    if (tool !== "sp") return null;
    const createRows = filteredPreviewMeta.filter((item) => item.rowStatus === "create").length;
    const updateRows = filteredPreviewMeta.filter((item) => item.rowStatus === "update").length;
    const changedCells = filteredPreviewMeta.reduce((sum, item) => sum + item.changeCount, 0);
    return { createRows, updateRows, changedCells };
  }, [filteredPreviewMeta, tool]);

  function openSpImportDialog(mode: "draft-create" | "history-update") {
    spImportModeRef.current = mode;
    importWorkbookInputRef.current?.click();
  }

  async function onExport() {
    const loading = toast.loading("正在生成模板…");
    try {
      const sheets: any = {};
      let filenameBase = "Bulk";
      let usedImportedWorkbook = false;

      if (tool === "sp") {
        const selectedSpDraft =
          spMode === "visual-batch" && spImportedContext
            ? {
                campaigns: spBatchDraft.campaigns.filter((_, index) => spSelectedCampaigns[buildCampaignKey(index)] ?? false),
              }
            : spBatchDraft;
        const selectedSpBatch = buildSpRowsFromBatchDraft(selectedSpDraft);
        const issuesNow = spMode === "visual-batch" ? selectedSpBatch.errors : validateSpWizard(spWizard);
        if (issuesNow.length) {
          toast.error("请先修正表单问题", { description: issuesNow.slice(0, 6).join("；") });
          return;
        }
        if (spMode === "visual-batch" && spImportedContext && !selectedSpDraft.campaigns.length) {
          toast.error("请先选择要导出的活动", { description: "导入更新模式下，至少勾选 1 个活动后再导出。" });
          return;
        }
        const spExportRows = spMode === "visual-batch" ? selectedSpBatch.rows : buildSpRows(spWizard);
        sheets[SHEETS.spCampaigns] = spExportRows;
        filenameBase = spMode === "visual-batch" ? "SP批量广告-可视化批量创建" : (spWizard.campaignName || spWizard.campaignId || "SP批量广告");

        if (spMode === "visual-batch" && spImportedContext) {
          const wb = cloneWorkbook(spImportedContext.workbook);
          const originalSheetCount = wb.SheetNames.length;
          pruneWorkbookToUploadableSheets(wb);
          const mergedRows = mergeSpRowsWithImportedContext(spImportedContext, spExportRows);
          const operationStats = countRowsByOperation(mergedRows);
          const removedSheetCount = Math.max(0, originalSheetCount - wb.SheetNames.length);
          const headers = spImportedContext.headerRow.length ? spImportedContext.headerRow : HEADERS[SHEETS.spCampaigns];
          replaceWorkbookSheetRows(wb, spImportedContext.sheetName, headers, mergedRows);
          const safeName = filenameBase.replace(/[\\/:*?\"<>|]/g, "-");
          downloadWorkbook(wb, `${safeName}.xlsx`);
          usedImportedWorkbook = true;
          toast.success("已基于导入原表导出", {
            description:
              `活动 ${selectedSpDraft.campaigns.length} 个，导出 ${mergedRows.length} 行，其中 Create ${operationStats.create} 行、Update ${operationStats.update} 行。` +
              (removedSheetCount > 0 ? ` 已自动过滤 ${removedSheetCount} 个不可上传工作表。` : " 未修改字段会尽量沿用原表内容。"),
          });
        }
      }

      if (tool === "sb") {
        const issuesNow = validateSbWizard(sb);
        if (issuesNow.length) {
          toast.error("请先修正表单问题", { description: issuesNow.slice(0, 6).join("；") });
          return;
        }
        sheets[SHEETS.sbCampaigns] = buildSbRows(sb);
        filenameBase = sb.campaignName || sb.campaignId || "SB批量广告";
      }

      if (tool === "sd") {
        const issuesNow = validateSdWizard(sd);
        if (issuesNow.length) {
          toast.error("请先修正表单问题", { description: issuesNow.slice(0, 6).join("；") });
          return;
        }
        sheets[SHEETS.sdCampaigns] = buildSdRows(sd);
        filenameBase = sd.campaignName || sd.campaignId || "SD批量广告";
      }

      if (tool === "portfolios") {
        const issuesNow = validatePortfolioWizard(portfolio);
        if (issuesNow.length) {
          toast.error("请先修正表单问题", { description: issuesNow.slice(0, 6).join("；") });
          return;
        }
        sheets[SHEETS.portfolios] = buildPortfolioRows(portfolio);
        filenameBase = portfolio.portfolioName || portfolio.portfolioId || "Portfolios";
      }

      if (!usedImportedWorkbook) {
        const wb = await buildWorkbookFromTemplate(sheets);
        const safeName = filenameBase.replace(/[\\/:*?\"<>|]/g, "-");
        downloadWorkbook(wb, `${safeName}.xlsx`);
        const firstSheetRows = (Object.values(sheets)[0] as Record<string, any>[] | undefined) ?? [];
        const operationStats = countRowsByOperation(firstSheetRows);
        toast.success("已生成并下载Bulk表格", {
          description:
            `导出 ${firstSheetRows.length} 行，其中 Create ${operationStats.create} 行` +
            (operationStats.update ? `、Update ${operationStats.update} 行` : "") +
            (operationStats.archive ? `、Archive ${operationStats.archive} 行` : "") +
            "。",
        });
      }
    } catch (e: any) {
      toast.error("生成失败", { description: String(e?.message || e) });
    } finally {
      toast.dismiss(loading);
    }
  }

  async function onImportSpWorkbook(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    const selectedImportMode = spImportModeRef.current;

    const loading = toast.loading("正在读取表格…");
    try {
      const workbook = await readWorkbookFromFile(file);
      const headerCandidates = workbook.SheetNames.map((name) => ({
        name,
        headerRow: readSheetAoA(workbook, name)[0] ?? [],
      }));
      const directSheetName = workbook.SheetNames.find((name) =>
        spImportSheetNameCandidates.some((candidate) => normalizeImportLabel(candidate).toLowerCase() === normalizeImportLabel(name).toLowerCase())
      );
      const matchedSheetName =
        directSheetName ??
        headerCandidates
          .map((candidate) => ({ name: candidate.name, score: scoreSpImportHeaderRow(candidate.headerRow) }))
          .sort((a, b) => b.score - a.score)[0]?.name;
      const rows = matchedSheetName ? readSheetRows(workbook, matchedSheetName) : [];
      const parsed = buildSpBatchDraftFromImportedRows(rows);
      const detectedImportMode = detectSpImportMode(rows);

      if (parsed.errors.length || !parsed.draft) {
        toast.error("导入失败", { description: parsed.errors.slice(0, 3).join("；") || "未识别到可导入数据" });
        return;
      }

      setTool("sp");
      setSpMode("visual-batch");
      setSpBatchDraft(parsed.draft);
      setSpOpenCampaigns(
        Object.fromEntries(parsed.draft.campaigns.map((_, index) => [`campaign-${index}`, index === 0]))
      );
      setSpSelectedCampaigns(
        Object.fromEntries(parsed.draft.campaigns.map((_, index) => [buildCampaignKey(index), true]))
      );
      setSpImportedContext({
        workbook,
        fileName: file.name,
        sheetName: matchedSheetName || SHEETS.spCampaigns,
        importMode: selectedImportMode,
        detectedImportMode,
        headerRow: (headerCandidates.find((candidate) => candidate.name === matchedSheetName)?.headerRow ?? []).map((cell) => stringifyCell(cell)),
        rawRows: rows,
        canonicalRows: rows.map((row) => normalizeSpImportedRow(row)),
        baselineDraft: cloneSpBatchDraft(parsed.draft),
      });

      toast.success(`已导入 ${parsed.campaigns} 个活动`, {
        description:
          `${matchedSheetName || "目标工作表"}：广告组 ${parsed.adGroups} 个，SKU ${parsed.skus} 个，关键词/定位 ${parsed.keywords} 条。` +
          (selectedImportMode === "history-update"
            ? "将按历史下载表模式处理，导出时匹配到的记录自动补 Update。"
            : "将按未上传草稿模式处理，导出时继续使用 Create。"),
      });

      if (selectedImportMode !== detectedImportMode) {
        toast.warning("导入模式与自动识别结果不同", {
          description:
            `你当前选择的是${selectedImportMode === "history-update" ? "历史下载表" : "未上传草稿"}，` +
            `自动识别更像${detectedImportMode === "history-update" ? "历史下载表" : "未上传草稿"}。若导出逻辑不符合预期，可重新选择另一入口导入。`,
        });
      }

      if (parsed.warnings.length) {
        toast.warning("部分行已跳过", { description: parsed.warnings.slice(0, 2).join("；") });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "文件读取失败";
      toast.error("导入失败", { description: message });
    } finally {
      toast.dismiss(loading);
    }
  }

  function onResetCurrent() {
    const ok = window.confirm("确认重置当前模块的填写内容吗？此操作不可撤销。");
    if (!ok) return;

    if (tool === "sp") {
      const init = createInitialSp();
      setSp(init);
      setSpMode(init.mode);
      setSpBatchDraft(createInitialSpBatchDraft());
      setSpOpenCampaigns({ "campaign-0": true });
      setSpSelectedCampaigns({});
      setSpImportedContext(null);
    }
    if (tool === "sb") setSb(createInitialSb());
    if (tool === "sd") setSd(createInitialSd());
    if (tool === "portfolios") setPortfolio(createInitialPortfolio());

    toast.success("已重置当前模块");
  }

  const currentIssues =
    tool === "sp" ? spIssues : tool === "sb" ? sbIssues : tool === "sd" ? sdIssues : portfolioIssues;
  const currentWarnings =
    tool === "sp" ? spWarnings : tool === "sb" ? sbWarnings : tool === "sd" ? sdWarnings : portfolioWarnings;
  const currentRowCount =
    tool === "sp" ? spPreviewRows.length : tool === "sb" ? sbRows.length : tool === "sd" ? sdRows.length : portfolioRows.length;

  return (
    <div className="min-h-screen bg-[radial-gradient(1200px_circle_at_20%_20%,oklch(0.92_0.08_250/0.9),transparent_55%),radial-gradient(900px_circle_at_80%_30%,oklch(0.9_0.12_120/0.75),transparent_55%),linear-gradient(180deg,oklch(0.99_0_0),oklch(0.97_0.01_250))]">
      <div className="mx-auto max-w-7xl px-5 py-10">
        <motion.header
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.21, 0.47, 0.12, 0.99] }}
          className="flex flex-col gap-3"
        >
          <div className="flex items-center gap-3">
            <div className="h-11 w-11 rounded-xl bg-foreground text-background grid place-items-center shadow-[0_18px_40px_-18px_rgba(0,0,0,0.45)]">
              <span className="font-black tracking-tight">Bulk</span>
            </div>
            <div>
              <h1 className="text-2xl md:text-3xl font-black tracking-tight">亚马逊批量广告表格生成器</h1>
              <p className="text-sm text-muted-foreground">
                纯前端生成，不上传你的数据到任何服务器。支持新建批量表，也支持导入历史 bulk 表后按需更新再导出。
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary">已支持：SP / SB / SD / Portfolios</Badge>
          </div>
        </motion.header>

        <Separator className="my-8" />

        <Collapsible open={helpOpen} onOpenChange={setHelpOpen}>
          <Card className="mb-6 border-border/60 bg-card/50 p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold tracking-tight">使用说明与注意事项</h2>
                <div className="mt-2 grid gap-1 text-sm">
                  <p className="font-semibold text-rose-600 dark:text-rose-400">
                    本工具导出的文档，避免关联，需放到相应的帐号环境的文件夹，再进行上传！
                  </p>
                  <p className="text-muted-foreground">共有直接新建、草稿续改和历史更新三种用法。</p>
                </div>
              </div>
              <CollapsibleTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2">
                  <ChevronRight className={cn("h-4 w-4 transition-transform", helpOpen && "rotate-90")} />
                  {helpOpen ? "收起说明" : "展开说明"}
                </Button>
              </CollapsibleTrigger>
            </div>
            <CollapsibleContent className="mt-4 grid gap-4 text-sm text-muted-foreground">
              <div className="rounded-xl border border-border/70 bg-muted/25 p-4">
                <div className="font-semibold text-foreground">一、适合什么场景</div>
                <ul className="mt-2 list-disc space-y-1 pl-5">
                  <li>批量新建 Sponsored Products / Sponsored Brands / Sponsored Display / Portfolios。</li>
                  <li>导入未上传的草稿表继续编辑后导出。</li>
                  <li>导入亚马逊后台下载的历史 bulk 表，只修改部分活动，再导出更新。</li>
                </ul>
              </div>
              <div className="rounded-xl border border-border/70 bg-muted/25 p-4">
                <div className="font-semibold text-foreground">二、三种进入方式怎么选</div>
                <ul className="mt-2 list-disc space-y-1 pl-5">
                  <li>`直接新建`：适合从 0 开始创建新活动，不需要先准备已有 bulk 文件，导出通常使用 `Create`。</li>
                  <li>`导入未上传草稿`：适合你自己生成但还没上传的 bulk 文件，导出通常继续使用 `Create`。</li>
                  <li>`导入历史下载表`：适合亚马逊后台下载回来的历史 bulk 表，导出时已匹配原记录会自动补 `Update`。</li>
                  <li>如果页面提示“自动识别结果”和你选择的入口不一致，优先按文件真实来源重新选择导入入口。</li>
                </ul>
              </div>
              <div className="rounded-xl border border-border/70 bg-muted/25 p-4">
                <div className="font-semibold text-foreground">三、推荐操作流程</div>
                <ul className="mt-2 list-disc space-y-1 pl-5">
                  <li>先导入文件或直接新建活动，再在左侧编辑活动、广告组、SKU、关键词、否词和否定 ASIN。</li>
                  <li>历史更新场景下，可勾选只导出部分活动，右侧预览会同步只显示已勾选内容，并标出新增行、更新行和具体变化单元格。</li>
                  <li>导出前先看右侧“预览与校验”，优先确认没有阻断导出的报错；数据很多时可切到“专注预览”或使用顶部横向滚动条快速检查大表字段。</li>
                </ul>
              </div>
              <div className="rounded-xl border border-border/70 bg-muted/25 p-4">
                <div className="font-semibold text-foreground">四、注意事项</div>
                <ul className="mt-2 list-disc space-y-1 pl-5">
                  <li>历史 bulk 文件里常夹带 `Search Term Report`、上传处理汇总等报告页，工具导出时会自动过滤这些不可上传工作表。</li>
                  <li>历史下载表通常带有历史 ID 和业绩列，但 `Operation` 可能为空；工具会在导出时为匹配到的历史记录自动补 `Update`。</li>
                  <li>历史更新模式下，如果某个字段实际上没有变化，导出会尽量保留原表原值，不会为了统一格式把它强制覆盖。</li>
                  <li>新增的关键词、否词、商品定位、否定 ASIN 等记录仍会按新增逻辑导出，不会强行写成 `Update`。</li>
                  <li>校验参数区仅用于提醒，不代表亚马逊所有站点的最终限制，特殊站点请以后台要求为准。</li>
                </ul>
              </div>
            </CollapsibleContent>
          </Card>
        </Collapsible>

        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border/70 bg-muted/25 px-4 py-3">
          <div>
            <div className="text-sm font-semibold">工作区布局</div>
            <div className="text-xs text-muted-foreground">推荐默认双栏；录入时切专注编辑，核对大表和差异时切专注预览。</div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant={workspaceLayout === "split" ? "default" : "outline"} size="sm" onClick={() => setWorkspaceLayout("split")}>
              双栏
            </Button>
            <Button variant={workspaceLayout === "editor" ? "default" : "outline"} size="sm" onClick={() => setWorkspaceLayout("editor")}>
              专注编辑
            </Button>
            <Button variant={workspaceLayout === "preview" ? "default" : "outline"} size="sm" onClick={() => setWorkspaceLayout("preview")}>
              专注预览
            </Button>
          </div>
        </div>

        <div
          className={cn(
            "grid gap-6",
            workspaceLayout === "split"
              ? "lg:grid-cols-[minmax(0,0.98fr)_minmax(0,1.02fr)] xl:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)]"
              : "grid-cols-1"
          )}
        >
          {workspaceLayout !== "preview" && (
          <Card className="min-w-0 p-5 md:p-6 bg-card/70 backdrop-blur supports-[backdrop-filter]:bg-card/55 border-border/60 shadow-[0_24px_60px_-36px_rgba(0,0,0,0.35)]">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold tracking-tight">向导</h2>
                <p className="text-sm text-muted-foreground">选择一个模块填表，导出可上传到Bulk operations。</p>
              </div>
              <div className="flex flex-wrap items-center justify-end gap-2">
                <input
                  ref={importWorkbookInputRef}
                  type="file"
                  accept=".xlsx,.xlsm,.xls"
                  className="hidden"
                  onChange={onImportSpWorkbook}
                />
                <Button
                  variant="outline"
                  className="gap-2"
                  onClick={() => openSpImportDialog("draft-create")}
                >
                  <Upload className="h-4 w-4" />
                  导入未上传草稿
                </Button>
                <Button
                  variant="outline"
                  className="gap-2"
                  onClick={() => openSpImportDialog("history-update")}
                >
                  <Upload className="h-4 w-4" />
                  导入历史下载表
                </Button>
                <Button onClick={onExport} className="gap-2" disabled={currentIssues.length > 0}>
                  <Download className="h-4 w-4" />
                  导出 .xlsx
                </Button>
              </div>
            </div>

            <div className="mt-5">
              <div className="mb-4 grid gap-3 rounded-xl border border-border/70 bg-muted/25 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="font-semibold">校验参数（可按站点调整）</div>
                  <Badge variant="outline" className="font-mono text-[11px]">仅用于提醒/校验</Badge>
                </div>
                <div className="grid gap-3 sm:grid-cols-5">
                  <Labeled label="币种" hint="用于提示展示">
                    <Input value={settings.currency} onChange={(e) => setSettings((p) => ({ ...p, currency: e.target.value }))} />
                  </Labeled>
                  <Labeled label="SP最低竞价" hint="低于则提示">
                    <Input
                      type="number"
                      value={settings.minBidSp}
                      onChange={(e) => setSettings((p) => ({ ...p, minBidSp: Number(e.target.value || 0) }))}
                    />
                  </Labeled>
                  <Labeled label="SB最低竞价" hint="低于则提示">
                    <Input
                      type="number"
                      value={settings.minBidSb}
                      onChange={(e) => setSettings((p) => ({ ...p, minBidSb: Number(e.target.value || 0) }))}
                    />
                  </Labeled>
                  <Labeled label="SD最低竞价" hint="低于则提示">
                    <Input
                      type="number"
                      value={settings.minBidSd}
                      onChange={(e) => setSettings((p) => ({ ...p, minBidSd: Number(e.target.value || 0) }))}
                    />
                  </Labeled>
                  <Labeled label="关键词最大字符" hint="超出则提示">
                    <Input
                      type="number"
                      value={settings.keywordMaxChars}
                      onChange={(e) => setSettings((p) => ({ ...p, keywordMaxChars: Number(e.target.value || 0) }))}
                    />
                  </Labeled>
                </div>
                <div className="text-xs text-muted-foreground">
                  默认值为通用参考（SP最低竞价常见为0.02；SB最低竞价常见为0.1；否词单词数限制经验值：词组≤4、精准≤10）。不同站点/类目/账户规则可能不同，请按实际要求调整。
                </div>
              </div>

              <Tabs value={tool} onValueChange={(v) => setTool(v as any)}>
                <TabsList className="grid h-auto w-full grid-cols-2 gap-2 md:grid-cols-4">
                  <TabsTrigger value="sp" className="h-auto whitespace-normal px-3 py-2 text-center leading-snug">Sponsored Products</TabsTrigger>
                  <TabsTrigger value="sb" className="h-auto whitespace-normal px-3 py-2 text-center leading-snug">Sponsored Brands</TabsTrigger>
                  <TabsTrigger value="sd" className="h-auto whitespace-normal px-3 py-2 text-center leading-snug">Sponsored Display</TabsTrigger>
                  <TabsTrigger value="portfolios" className="h-auto whitespace-normal px-3 py-2 text-center leading-snug">Portfolios</TabsTrigger>
                </TabsList>

                <TabsContent value="sp" className="mt-5">
                  <SpWizardUI
                    mode={spMode}
                    setMode={setSpMode}
                    w={sp}
                    setW={setSp}
                    batchDraft={spBatchDraft}
                    setBatchDraft={setSpBatchDraft}
                    openCampaigns={spOpenCampaigns}
                    setOpenCampaigns={setSpOpenCampaigns}
                    selectedCampaigns={spSelectedCampaigns}
                    setSelectedCampaigns={setSpSelectedCampaigns}
                    batchResult={spBatch}
                    importedContext={spImportedContext}
                    spIssues={spIssues}
                  />
                </TabsContent>

                <TabsContent value="sb" className="mt-5">
                  <SbWizardUI w={sb} setW={setSb} />
                </TabsContent>

                <TabsContent value="sd" className="mt-5">
                  <SdWizardUI w={sd} setW={setSd} />
                </TabsContent>

                <TabsContent value="portfolios" className="mt-5">
                  <PortfolioWizardUI w={portfolio} setW={setPortfolio} />
                </TabsContent>
              </Tabs>
            </div>
          </Card>
          )}

          {workspaceLayout !== "editor" && (
          <Card className="min-w-0 p-5 md:p-6 bg-card/55 backdrop-blur supports-[backdrop-filter]:bg-card/45 border-border/60">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold tracking-tight">预览与校验</h2>
                <p className="text-sm text-muted-foreground">导出前先看一下会生成哪些行；大表可直接使用上方横向滚动条，不用先拖到最底部再左右查看。</p>
              </div>
              <div className="text-right">
                <Button variant="outline" size="sm" className="mb-2" onClick={onResetCurrent}>
                  重置当前模块
                </Button>
                <div className="text-sm font-semibold">行数</div>
                <div className="text-2xl font-black tabular-nums">{currentRowCount}</div>
              </div>
            </div>

            <div className="mt-4">
              {currentIssues.length > 0 ? (
                <div className="rounded-xl border border-destructive/40 bg-destructive/5 p-4">
                  <div className="font-semibold">需要修正的问题（阻断导出）</div>
                  <ul className="mt-2 list-disc pl-5 text-sm text-muted-foreground">
                    {currentIssues.slice(0, 10).map((x, i) => (
                      <li key={i}>{x}</li>
                    ))}
                  </ul>
                </div>
              ) : (
                <div className="rounded-xl border border-border/70 bg-muted/40 p-4 text-sm text-muted-foreground">校验通过。你可以直接导出。</div>
              )}

              {currentWarnings.length > 0 && (
                <div className="mt-3 rounded-xl border border-amber-500/35 bg-amber-500/5 p-4">
                  <div className="font-semibold">提醒（不阻断导出）</div>
                  <ul className="mt-2 list-disc pl-5 text-sm text-muted-foreground">
                    {currentWarnings.slice(0, 10).map((x, i) => (
                      <li key={i}>{x}</li>
                    ))}
                  </ul>
                  {currentWarnings.length > 10 && (
                    <div className="mt-2 text-xs text-muted-foreground">……还有 {currentWarnings.length - 10} 项</div>
                  )}
                </div>
              )}
            </div>

            <Separator className="my-5" />

            <div className="mb-4 flex flex-wrap items-center gap-2">
              <div className="text-xs text-muted-foreground">预览筛选</div>
              <Button
                variant={previewOperationFilter === "all" ? "default" : "outline"}
                size="sm"
                onClick={() => setPreviewOperationFilter("all")}
              >
                全部 {currentPreviewRows.length}
              </Button>
              <Button
                variant={previewOperationFilter === "create" ? "default" : "outline"}
                size="sm"
                onClick={() => setPreviewOperationFilter("create")}
              >
                仅看 Create {currentPreviewOperationCounts.create}
              </Button>
              <Button
                variant={previewOperationFilter === "update" ? "default" : "outline"}
                size="sm"
                onClick={() => setPreviewOperationFilter("update")}
                disabled={currentPreviewOperationCounts.update === 0}
              >
                仅看 Update {currentPreviewOperationCounts.update}
              </Button>
            </div>

            {tool === "sp" && spImportedContext && currentPreviewDiffSummary && (
              <div className="mb-4 flex flex-wrap items-center gap-2">
                <Badge variant="outline" className="border-emerald-500/40 bg-emerald-500/5 text-emerald-700 dark:text-emerald-300">
                  新增行 {currentPreviewDiffSummary.createRows}
                </Badge>
                <Badge variant="outline" className="border-amber-500/40 bg-amber-500/5 text-amber-700 dark:text-amber-300">
                  更新行 {currentPreviewDiffSummary.updateRows}
                </Badge>
                <Badge variant="outline" className="border-sky-500/40 bg-sky-500/5 text-sky-700 dark:text-sky-300">
                  变更单元格 {currentPreviewDiffSummary.changedCells}
                </Badge>
              </div>
            )}

            {tool === "sp" && (
              <PreviewTable
                title="Sponsored Products Campaigns"
                headers={HEADERS[SHEETS.spCampaigns]}
                rows={filteredPreviewRows}
                rowMeta={filteredPreviewMeta}
              />
            )}
            {tool === "sb" && <PreviewTable title="Sponsored Brands Campaigns" headers={HEADERS[SHEETS.sbCampaigns]} rows={filteredPreviewRows} />}
            {tool === "sd" && <PreviewTable title="Sponsored Display Campaigns" headers={HEADERS[SHEETS.sdCampaigns]} rows={filteredPreviewRows} />}
            {tool === "portfolios" && <PreviewTable title="Portfolios" headers={HEADERS[SHEETS.portfolios]} rows={filteredPreviewRows} />}

            <p className="mt-3 text-xs text-muted-foreground">
              说明：导出文件会保留官方模板需要的标准结构、下拉选项和说明页；历史更新模式下会自动过滤不可上传的报告工作表，并尽量保留原表未改字段。
            </p>
          </Card>
          )}
        </div>

        <footer className="mt-10 text-xs text-muted-foreground">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span>纯前端生成，不上传你的数据到任何服务器</span>
            <span>
              版权归 跨境乐趣园所有 | 作者：達哥 | 官网：
              {" "}
              <a
                href="https://amzlink.top/"
                target="_blank"
                rel="noreferrer"
                className="text-primary underline-offset-4 hover:underline"
              >
                https://amzlink.top/
              </a>
            </span>
          </div>
        </footer>
      </div>
    </div>
  );
}

function PreviewTable({
  title,
  headers,
  rows,
  rowMeta,
}: {
  title: string;
  headers: readonly string[];
  rows: Record<string, any>[];
  rowMeta?: PreviewRowMeta[];
}) {
  const head = headers;
  const topScrollRef = useRef<HTMLDivElement | null>(null);
  const previewViewportRef = useRef<HTMLDivElement | null>(null);
  const tableScrollRef = useRef<HTMLDivElement | null>(null);
  const syncingScrollRef = useRef<"top" | "body" | null>(null);
  const [scrollMetrics, setScrollMetrics] = useState({ scrollWidth: 0, clientWidth: 0 });

  useEffect(() => {
    const updateMetrics = () => {
      const node = tableScrollRef.current;
      if (!node) return;
      const nextScrollWidth = node.scrollWidth;
      setScrollMetrics((prev) => {
        if (prev.scrollWidth === nextScrollWidth && prev.clientWidth === node.clientWidth) return prev;
        return { scrollWidth: nextScrollWidth, clientWidth: node.clientWidth };
      });
    };

    updateMetrics();
    const viewportNode = previewViewportRef.current;
    if (!viewportNode) return;
    const node = viewportNode.querySelector('[data-preview-table-scroll="true"]') as HTMLDivElement | null;
    if (!node) return;
    tableScrollRef.current = node;
    updateMetrics();

    const observer = typeof ResizeObserver !== "undefined" ? new ResizeObserver(updateMetrics) : null;
    observer?.observe(node);
    window.addEventListener("resize", updateMetrics);

    const handleTableScroll = () => syncScroll("body");
    node.addEventListener("scroll", handleTableScroll, { passive: true });

    return () => {
      node.removeEventListener("scroll", handleTableScroll);
      observer?.disconnect();
      window.removeEventListener("resize", updateMetrics);
    };
  }, [headers, rows]);

  const hasHorizontalOverflow = scrollMetrics.scrollWidth > scrollMetrics.clientWidth + 1;

  function syncScroll(source: "top" | "body") {
    const topNode = topScrollRef.current;
    const bodyNode = tableScrollRef.current;
    if (!topNode || !bodyNode) return;
    if (syncingScrollRef.current && syncingScrollRef.current !== source) return;
    syncingScrollRef.current = source;
    if (source === "top") bodyNode.scrollLeft = topNode.scrollLeft;
    else topNode.scrollLeft = bodyNode.scrollLeft;
    requestAnimationFrame(() => {
      syncingScrollRef.current = null;
    });
  }

  return (
    <>
      <div className="flex items-center justify-between">
        <div className="text-sm font-semibold">{title}</div>
        <div className="flex items-center gap-2">
          <div className="text-xs text-muted-foreground">可横向和纵向滚动查看全部字段与全部行</div>
          <Badge variant="outline" className="font-mono text-[11px]">
            {rows.length} 行
          </Badge>
          <Badge variant="secondary" className="font-mono text-[11px]">
            {headers.length} 列
          </Badge>
        </div>
      </div>

      {hasHorizontalOverflow && (
        <div className="sticky top-2 z-20 mt-3 rounded-lg border border-border/70 bg-background/95 px-3 py-2 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-background/80">
          <div className="mb-1 text-[11px] text-muted-foreground">横向字段较多时，可直接拖动这里快速左右查看</div>
          <div ref={topScrollRef} onScroll={() => syncScroll("top")} className="h-4 overflow-x-scroll overflow-y-hidden">
            <div style={{ width: scrollMetrics.scrollWidth, height: 1 }} />
          </div>
        </div>
      )}

      <div ref={previewViewportRef} className="mt-3 max-h-[78vh] overflow-y-auto rounded-lg border border-border/70">
        <div data-preview-table-scroll="true" className="overflow-x-auto">
          <table className="min-w-max w-full caption-bottom text-sm">
            <thead className="[&_tr]:border-b">
              <tr className="hover:bg-muted/50 border-b transition-colors">
                {head.map((h) => (
                  <th
                    key={h}
                    className="text-foreground sticky top-0 z-10 h-10 whitespace-nowrap bg-background/95 px-2 text-left align-middle font-medium backdrop-blur supports-[backdrop-filter]:bg-background/80"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="[&_tr:last-child]:border-0">
              {rows.map((r, idx) => (
                <tr key={idx} className={cn("hover:bg-muted/50 border-b transition-colors", rowMeta?.[idx]?.rowStatus === "create" ? "bg-emerald-500/5" : "", rowMeta?.[idx]?.rowStatus === "update" ? "bg-amber-500/[0.04]" : "")}>
                  {head.map((h) => (
                    <td
                      key={h}
                      className={cn(
                        "p-2 align-middle whitespace-nowrap font-mono text-[12px]",
                        h === "Entity" ? "font-semibold" : "",
                        rowMeta?.[idx]?.changedHeaders.includes(h)
                          ? "bg-amber-100/70 text-amber-950 dark:bg-amber-500/15 dark:text-amber-100"
                          : ""
                      )}
                    >
                      {h === "Operation" && rowMeta?.[idx] ? (
                        <div className="flex min-w-[170px] flex-col gap-1">
                          <span
                            className={cn(
                              "inline-flex w-fit rounded-md px-2 py-0.5 text-[11px] font-semibold tracking-wide",
                              rowMeta[idx].rowStatus === "create"
                                ? "bg-emerald-500/12 text-emerald-700 dark:text-emerald-300"
                                : "bg-amber-500/12 text-amber-700 dark:text-amber-300"
                            )}
                          >
                            {String((r as any)[h] ?? "")}
                          </span>
                          {rowMeta[idx].changedHeaders.length > 0 && (
                            <div className="max-w-[280px] whitespace-normal text-[11px] leading-4 text-muted-foreground">
                              改了：{getPreviewChangedHeaderLabels(rowMeta[idx])}
                            </div>
                          )}
                        </div>
                      ) : (
                        String((r as any)[h] ?? "")
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

function SpWizardUI({
  mode,
  setMode,
  w,
  setW,
  batchDraft,
  setBatchDraft,
  openCampaigns,
  setOpenCampaigns,
  selectedCampaigns,
  setSelectedCampaigns,
  batchResult,
  importedContext,
}: {
  mode: SpUiMode;
  setMode: (m: SpUiMode) => void;
  w: SpCampaignWizard;
  setW: (updater: (prev: SpCampaignWizard) => SpCampaignWizard) => void;
  batchDraft: SpBatchDraft;
  setBatchDraft: (updater: (prev: SpBatchDraft) => SpBatchDraft) => void;
  openCampaigns: Record<string, boolean>;
  setOpenCampaigns: Dispatch<SetStateAction<Record<string, boolean>>>;
  selectedCampaigns: Record<string, boolean>;
  setSelectedCampaigns: Dispatch<SetStateAction<Record<string, boolean>>>;
  batchResult: SpBatchBuildResult;
  importedContext: SpImportedWorkbookContext | null;
  spIssues: string[];
}) {
  const [keywordBulkInput, setKeywordBulkInput] = useState("");
  const [negativeKeywordBulkInput, setNegativeKeywordBulkInput] = useState("");
  const [negativeProductTargetingBulkInput, setNegativeProductTargetingBulkInput] = useState("");
  const [keywordBulkBidByGroup, setKeywordBulkBidByGroup] = useState<Record<string, string>>({});
  const [campaignFilter, setCampaignFilter] = useState("");
  const [openAdGroups, setOpenAdGroups] = useState<Record<string, boolean>>({});
  const importedCampaignMap = useMemo(
    () => new Map((importedContext?.baselineDraft.campaigns ?? []).map((campaign) => [campaign.campaignId, campaign])),
    [importedContext]
  );
  const importedAdGroupMap = useMemo(
    () =>
      new Map(
        (importedContext?.baselineDraft.campaigns ?? []).flatMap((campaign) =>
          campaign.adGroups.map((adGroup) => [`${campaign.campaignId}::${adGroup.adGroupId}`, adGroup] as const)
        )
      ),
    [importedContext]
  );

  const normalizedCampaignFilter = campaignFilter.trim().toLowerCase();
  const filteredCampaignEntries = batchDraft.campaigns
    .map((campaign, index) => ({ campaign, index, key: buildCampaignKey(index) }))
    .filter(({ campaign }) => {
      if (!normalizedCampaignFilter) return true;
      const name = campaign.campaignName.trim().toLowerCase();
      const id = campaign.campaignId.trim().toLowerCase();
      return name.includes(normalizedCampaignFilter) || id.includes(normalizedCampaignFilter);
    });
  const selectedCampaignCount = batchDraft.campaigns.filter((_, index) => selectedCampaigns[buildCampaignKey(index)] ?? false).length;
  const modifiedCampaignKeys = new Set(
    batchDraft.campaigns
      .map((campaign, index) => ({ campaign, index }))
      .filter(({ campaign }) => Boolean(getCampaignDiffState(campaign, importedCampaignMap)))
      .map(({ index }) => buildCampaignKey(index))
  );

  function focusCampaign(campaignKey: string) {
    setOpenCampaigns({ [campaignKey]: true });
  }

  function focusAdGroup(campaignIndex: number, adGroupIndex: number, campaignKey: string, adGroups: SpBatchAdGroupDraft[]) {
    focusCampaign(campaignKey);
    setOpenAdGroups((prev) => {
      const next = { ...prev };
      adGroups.forEach((_, index) => {
        next[`adgroup-${campaignIndex}-${index}`] = index === adGroupIndex;
      });
      return next;
    });
  }

  function set<K extends keyof SpCampaignWizard>(key: K, value: SpCampaignWizard[K]) {
    setW((prev) => ({ ...prev, [key]: value }));
  }

  function importKeywordsFromBulkInput() {
    const { rows, invalidCount } = parseSpKeywordBulk(keywordBulkInput, w.adGroupDefaultBid || 0.75);
    if (!rows.length) {
      toast.error("没有可导入的关键词", { description: "请按行粘贴，至少包含关键词文本。" });
      return;
    }

    const current = w.keywords.filter((k) => k.text.trim());
    set("keywords", [...current, ...rows]);
    setKeywordBulkInput("");
    toast.success(`已导入 ${rows.length} 条关键词`, {
      description: invalidCount > 0 ? `其中 ${invalidCount} 行格式无效已跳过。` : "你可以在下方表格继续编辑。",
    });
  }

  function importNegativeKeywordsFromBulkInput() {
    const { rows, invalidCount } = parseSpNegativeKeywordBulk(negativeKeywordBulkInput);
    if (!rows.length) {
      toast.error("没有可导入的否词", { description: "请按行粘贴，至少包含关键词文本。" });
      return;
    }

    const current = w.negativeKeywords.filter((k) => k.text.trim());
    set("negativeKeywords", [...current, ...rows]);
    setNegativeKeywordBulkInput("");
    toast.success(`已导入 ${rows.length} 条否词`, {
      description: invalidCount > 0 ? `其中 ${invalidCount} 行格式无效已跳过。` : "你可以在下方表格继续编辑。",
    });
  }

  function importNegativeProductTargetingsFromBulkInput() {
    const { rows, invalidCount } = parseSpNegativeProductTargetingBulk(negativeProductTargetingBulkInput);
    if (!rows.length) {
      toast.error("没有可导入的否定ASIN", { description: "请按行粘贴 Product Targeting Expression。" });
      return;
    }

    const current = w.negativeProductTargetings.filter((x) => x.expression.trim());
    set("negativeProductTargetings", [...current, ...rows]);
    setNegativeProductTargetingBulkInput("");
    toast.success(`已导入 ${rows.length} 条否定ASIN`, {
      description: invalidCount > 0 ? `其中 ${invalidCount} 行格式无效已跳过。` : "你可以在下方表格继续编辑。",
    });
  }

  return (
    <Tabs value={mode} onValueChange={(v) => setMode(v as any)}>
      <TabsList className="grid w-full grid-cols-4">
        <TabsTrigger value="visual-batch">可视化批量创建</TabsTrigger>
        <TabsTrigger value="manual-keyword">手动关键词</TabsTrigger>
        <TabsTrigger value="auto">自动广告</TabsTrigger>
        <TabsTrigger value="manual-product-targeting">商品定位</TabsTrigger>
      </TabsList>

      <TabsContent value={mode} className="mt-5">
        {mode === "visual-batch" ? (
          <section className="grid gap-4">
            <div className="rounded-xl border border-sky-300/70 bg-sky-50/50 p-4 text-sm text-sky-900">
              <div className="font-semibold">可视化批量创建（3步完成）</div>
              <div className="mt-1 text-xs text-sky-800">
                1) 添加活动并设置预算/竞价策略/广告位加价；2) 在活动下添加广告组并填写 SKU、关键词、否词、否定ASIN；3) 看右侧预览无报错后直接导出上传。
              </div>
            </div>

            {importedContext ? (
              <div className="rounded-xl border border-emerald-300/70 bg-emerald-50/60 p-4 text-sm text-emerald-900">
                <div className="font-semibold">
                  {importedContext.importMode === "history-update" ? "已载入历史下载表模式" : "已载入未上传草稿模式"}
                </div>
                <div className="mt-1 text-xs text-emerald-800">
                  来源文件：{importedContext.fileName}。当前会标记“新增 / 已修改”项，导出时优先保留原表未改字段和其它工作表。
                </div>
                <div className="mt-2 text-xs text-emerald-900">
                  你选择的导入入口：{importedContext.importMode === "history-update" ? "历史下载表" : "未上传草稿"}；
                  自动识别结果：{importedContext.detectedImportMode === "history-update" ? "历史下载表" : "未上传草稿"}。
                  {importedContext.importMode === "history-update"
                    ? " 导出时，匹配到原表的记录会自动补 Operation=Update，新增记录仍保持 Create。"
                    : " 这类表通常继续使用 Create 导出。"}
                </div>
                <div className="mt-2 text-xs text-emerald-800">
                  导出前会自动过滤 `RAS Search Term Report`、`SP Search Term Report`、上传处理汇总等非 bulk 工作表，避免因无效表头导致上传失败。
                </div>
              </div>
            ) : null}

            <div className="grid gap-3 rounded-xl border border-border/70 bg-muted/20 p-4">
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <Badge variant="secondary">活动 {batchResult.campaigns}</Badge>
                <Badge variant="secondary">广告组 {batchResult.adGroups}</Badge>
                <Badge variant="secondary">SKU {batchResult.skus}</Badge>
                <Badge variant="secondary">关键词/定位 {batchResult.keywords}</Badge>
                <Badge variant="secondary">将生成 {batchResult.rows.length} 行</Badge>
                {importedContext ? <Badge variant="outline">导出已选 {selectedCampaignCount}</Badge> : null}
              </div>
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <Input
                  value={campaignFilter}
                  onChange={(e) => setCampaignFilter(e.target.value)}
                  placeholder="按活动名 / Campaign ID 搜索过滤"
                  className="max-w-md bg-background"
                />
                <div className="flex flex-wrap items-center gap-2">
                  <div className="text-xs text-muted-foreground">
                    当前显示 {filteredCampaignEntries.length} / {batchDraft.campaigns.length} 个活动
                  </div>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setOpenCampaigns(
                      Object.fromEntries(batchDraft.campaigns.map((_, index) => [`campaign-${index}`, true]))
                    );
                    setOpenAdGroups(
                      Object.fromEntries(
                        batchDraft.campaigns.flatMap((campaign, cIdx) =>
                          campaign.adGroups.map((_, gIdx) => [`adgroup-${cIdx}-${gIdx}`, true])
                        )
                      )
                    );
                  }}
                >
                  全部展开
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setOpenCampaigns(
                      Object.fromEntries(batchDraft.campaigns.map((_, index) => [`campaign-${index}`, false]))
                    );
                    setOpenAdGroups({});
                  }}
                >
                  全部折叠
                </Button>
                {importedContext ? (
                  <>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        setSelectedCampaigns(
                          Object.fromEntries(batchDraft.campaigns.map((_, index) => [buildCampaignKey(index), true]))
                        )
                      }
                    >
                      全选导出
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        setSelectedCampaigns(
                          Object.fromEntries(batchDraft.campaigns.map((_, index) => [buildCampaignKey(index), false]))
                        )
                      }
                    >
                      清空导出
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        setSelectedCampaigns(
                          Object.fromEntries(batchDraft.campaigns.map((_, index) => [buildCampaignKey(index), modifiedCampaignKeys.has(buildCampaignKey(index))]))
                        )
                      }
                    >
                      仅选已修改
                    </Button>
                  </>
                ) : null}
                <div className="text-xs text-muted-foreground">点击或编辑某个活动时，会自动收起其它活动；广告组也支持二级折叠。</div>
                {importedContext ? <div className="text-xs text-amber-700">浅黄色输入框表示该字段相对导入原表已发生修改。</div> : null}
              </div>
            </div>

            <div className="grid gap-4">
              {filteredCampaignEntries.length === 0 ? (
                <div className="rounded-xl border border-dashed border-border/70 bg-muted/10 p-6 text-sm text-muted-foreground">
                  没有匹配到活动，请尝试按活动名称或 Campaign ID 搜索。
                </div>
              ) : null}
              {filteredCampaignEntries.map(({ campaign: c, index: cIdx, key: campaignKey }) => {
                const campaignOpen = hasOwnState(openCampaigns, campaignKey) ? openCampaigns[campaignKey] : false;
                const adGroupCount = c.adGroups.length;
                const skuCount = c.adGroups.reduce((sum, group) => sum + countFilledLines(group.skusText), 0);
                const primaryCount = c.adGroups.reduce((sum, group) => sum + countPrimaryItemsForAdGroup(c.mode, group), 0);
                const campaignDiffState = getCampaignDiffState(c, importedCampaignMap);
                const campaignDiffFields = importedContext ? getCampaignDiffFields(c, importedCampaignMap) : [];
                const campaignBaseline = importedContext ? importedCampaignMap.get(c.campaignId) : undefined;
                const campaignNameChanged = campaignBaseline ? isDiffValue(c.campaignName.trim(), campaignBaseline.campaignName.trim()) : false;
                const campaignStartDateChanged = campaignBaseline ? isDiffValue(c.startDate.trim(), campaignBaseline.startDate.trim()) : false;
                const campaignEndDateChanged = campaignBaseline ? isDiffValue((c.endDate || "").trim(), (campaignBaseline.endDate || "").trim()) : false;
                const campaignBudgetChanged = campaignBaseline ? isDiffValue(c.dailyBudget, campaignBaseline.dailyBudget) : false;
                const campaignStateChanged = campaignBaseline ? isDiffValue(c.state, campaignBaseline.state) : false;
                const campaignModeChanged = campaignBaseline ? isDiffValue(c.mode, campaignBaseline.mode) : false;
                const campaignBiddingChanged = campaignBaseline ? isDiffValue(c.biddingStrategy, campaignBaseline.biddingStrategy) : false;
                const campaignPortfolioChanged = campaignBaseline ? isDiffValue(c.portfolioId || "", campaignBaseline.portfolioId || "") : false;
                const campaignPlacementTopChanged = campaignBaseline ? isDiffValue(c.placementTopPct ?? null, campaignBaseline.placementTopPct ?? null) : false;
                const campaignPlacementRestChanged = campaignBaseline ? isDiffValue(c.placementRestPct ?? null, campaignBaseline.placementRestPct ?? null) : false;
                const campaignPlacementProductPageChanged =
                  campaignBaseline ? isDiffValue(c.placementProductPagePct ?? null, campaignBaseline.placementProductPagePct ?? null) : false;

                return (
                <Collapsible
                  key={campaignKey}
                  open={campaignOpen}
                  onOpenChange={(open) => {
                    if (open) {
                      focusCampaign(campaignKey);
                      return;
                    }
                    setOpenCampaigns((prev) => ({ ...prev, [campaignKey]: false }));
                  }}
                  className="rounded-xl border border-border/70 bg-card/40"
                >
                  <div
                    className="p-4"
                    onFocusCapture={(event) => {
                      if (!shouldAutoExpandFromFocus(event.target)) return;
                      focusCampaign(campaignKey);
                    }}
                  >
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          {importedContext ? (
                            <label className="mr-1 inline-flex items-center gap-2 text-xs text-muted-foreground">
                              <Checkbox
                                checked={selectedCampaigns[campaignKey] ?? false}
                                onCheckedChange={(checked) =>
                                  setSelectedCampaigns((prev) => ({
                                    ...prev,
                                    [campaignKey]: checked === true,
                                  }))
                                }
                              />
                              导出
                            </label>
                          ) : null}
                          <div className="font-semibold text-sky-700 dark:text-sky-300">{c.campaignName.trim() || `活动 #${cIdx + 1}`}</div>
                          <Badge variant="outline" className="font-mono text-[11px]">{c.mode}</Badge>
                          {campaignDiffState ? (
                            <Badge
                              variant="outline"
                              className={cn(
                                "text-[11px]",
                                campaignDiffState === "new"
                                  ? "border-emerald-500/60 text-emerald-700"
                                  : "border-amber-500/60 text-amber-700"
                              )}
                            >
                              {campaignDiffState === "new" ? "新增" : "已修改"}
                            </Badge>
                          ) : null}
                          <Badge variant="secondary">组 {adGroupCount}</Badge>
                          <Badge variant="secondary">SKU {skuCount}</Badge>
                          <Badge variant="secondary">关键词/定位 {primaryCount}</Badge>
                        </div>
                        <div className="mt-1 text-xs text-muted-foreground">
                          ID: {c.campaignId || "未填写"} | 预算: {c.dailyBudget || 0} | 状态: {c.state}
                        </div>
                        {campaignDiffState && campaignDiffFields.length > 0 ? (
                          <div className="mt-2 flex flex-wrap items-center gap-1.5">
                            {campaignDiffFields.slice(0, 6).map((field) => (
                              <Badge
                                key={field}
                                variant="outline"
                                className={cn(
                                  "text-[11px]",
                                  campaignDiffState === "new"
                                    ? "border-emerald-500/60 bg-emerald-500/5 text-emerald-700"
                                    : "border-amber-500/60 bg-amber-500/5 text-amber-700"
                                )}
                              >
                                {field}
                              </Badge>
                            ))}
                            {campaignDiffFields.length > 6 ? (
                              <Badge variant="outline" className="text-[11px] border-amber-500/40 text-amber-700">
                                +{campaignDiffFields.length - 6} 项
                              </Badge>
                            ) : null}
                          </div>
                        ) : null}
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <CollapsibleTrigger asChild>
                          <Button variant="outline" size="sm" className="gap-2">
                            <ChevronRight className={cn("h-4 w-4 transition-transform", campaignOpen && "rotate-90")} />
                            {campaignOpen ? "折叠活动" : "展开活动"}
                          </Button>
                        </CollapsibleTrigger>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setBatchDraft((prev) => ({
                              ...prev,
                              campaigns: prev.campaigns.length > 1 ? prev.campaigns.filter((_, i) => i !== cIdx) : prev.campaigns,
                            }));
                            setOpenCampaigns((prev) => remapCampaignStateAfterDelete(prev, cIdx));
                            setSelectedCampaigns((prev) => remapCampaignStateAfterDelete(prev, cIdx));
                            setOpenAdGroups((prev) => remapAdGroupStateAfterCampaignDelete(prev, cIdx));
                          }}
                        >
                          删除活动
                        </Button>
                      </div>
                    </div>
                    <CollapsibleContent className="mt-4 grid gap-4">
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    <Labeled label="Campaign ID" required>
                      <Input value={c.campaignId} onChange={(e) => setBatchDraft((prev) => ({ ...prev, campaigns: prev.campaigns.map((x, i) => i === cIdx ? { ...x, campaignId: e.target.value } : x) }))} />
                    </Labeled>
                    <Labeled label="Campaign Name" required labelClassName={getDiffLabelClassName(campaignNameChanged)}>
                      <Input className={getDiffFieldClassName(campaignNameChanged)} value={c.campaignName} onChange={(e) => setBatchDraft((prev) => ({ ...prev, campaigns: prev.campaigns.map((x, i) => i === cIdx ? { ...x, campaignName: e.target.value } : x) }))} />
                    </Labeled>
                    <Labeled label="Start Date" hint="YYYYMMDD" required labelClassName={getDiffLabelClassName(campaignStartDateChanged)}>
                      <Input className={getDiffFieldClassName(campaignStartDateChanged)} value={c.startDate} onChange={(e) => setBatchDraft((prev) => ({ ...prev, campaigns: prev.campaigns.map((x, i) => i === cIdx ? { ...x, startDate: e.target.value } : x) }))} />
                    </Labeled>
                    <Labeled label="End Date" hint="可选：YYYYMMDD" labelClassName={getDiffLabelClassName(campaignEndDateChanged)}>
                      <Input className={getDiffFieldClassName(campaignEndDateChanged)} value={c.endDate || ""} onChange={(e) => setBatchDraft((prev) => ({ ...prev, campaigns: prev.campaigns.map((x, i) => i === cIdx ? { ...x, endDate: e.target.value } : x) }))} />
                    </Labeled>
                    <Labeled label="Daily Budget" required labelClassName={getDiffLabelClassName(campaignBudgetChanged)}>
                      <Input className={getDiffFieldClassName(campaignBudgetChanged)} type="number" value={c.dailyBudget} onChange={(e) => setBatchDraft((prev) => ({ ...prev, campaigns: prev.campaigns.map((x, i) => i === cIdx ? { ...x, dailyBudget: Number(e.target.value || 0) } : x) }))} />
                    </Labeled>
                    <Labeled label="State" required labelClassName={getDiffLabelClassName(campaignStateChanged)}>
                      <Select value={c.state} onValueChange={(v) => setBatchDraft((prev) => ({ ...prev, campaigns: prev.campaigns.map((x, i) => i === cIdx ? { ...x, state: v as State } : x) }))}>
                        <SelectTrigger className={getDiffFieldClassName(campaignStateChanged)}><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {stateOptions.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </Labeled>
                    <Labeled label="投放类型" hint="决定本活动填写关键词还是商品定位" required labelClassName={getDiffLabelClassName(campaignModeChanged)}>
                      <Select
                        value={c.mode}
                        onValueChange={(v) =>
                          setBatchDraft((prev) => ({
                            ...prev,
                            campaigns: prev.campaigns.map((x, i) =>
                              i !== cIdx
                                ? x
                                : {
                                    ...x,
                                    mode: v as SpCampaignWizard["mode"],
                                    adGroups: x.adGroups.map((ag) =>
                                      v === "auto" && !normalizeLines(ag.productTargetingsText).filter(Boolean).length
                                        ? {
                                            ...ag,
                                            productTargetingsText:
                                              "close-match,0.75,enabled\nloose-match,0.75,enabled\nsubstitutes,0.75,enabled\ncomplements,0.75,enabled",
                                          }
                                        : ag
                                    ),
                                  }
                            ),
                          }))
                        }
                      >
                        <SelectTrigger className={getDiffFieldClassName(campaignModeChanged)}><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {spBatchModeOptions.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </Labeled>
                    <Labeled label="Bidding Strategy" required labelClassName={getDiffLabelClassName(campaignBiddingChanged)}>
                      <Select value={c.biddingStrategy} onValueChange={(v) => setBatchDraft((prev) => ({ ...prev, campaigns: prev.campaigns.map((x, i) => i === cIdx ? { ...x, biddingStrategy: v as SpBiddingStrategy } : x) }))}>
                        <SelectTrigger className={getDiffFieldClassName(campaignBiddingChanged)}><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {biddingStrategies.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </Labeled>
                    <Labeled label="Portfolio ID" hint="可选" labelClassName={getDiffLabelClassName(campaignPortfolioChanged)}>
                      <Input className={getDiffFieldClassName(campaignPortfolioChanged)} value={c.portfolioId || ""} onChange={(e) => setBatchDraft((prev) => ({ ...prev, campaigns: prev.campaigns.map((x, i) => i === cIdx ? { ...x, portfolioId: e.target.value } : x) }))} />
                    </Labeled>
                    <Labeled label="placementTop %" hint="可选" labelClassName={getDiffLabelClassName(campaignPlacementTopChanged)}>
                      <Input className={getDiffFieldClassName(campaignPlacementTopChanged)} type="number" value={c.placementTopPct ?? ""} onChange={(e) => setBatchDraft((prev) => ({ ...prev, campaigns: prev.campaigns.map((x, i) => i === cIdx ? { ...x, placementTopPct: e.target.value === "" ? undefined : Number(e.target.value) } : x) }))} />
                    </Labeled>
                    <Labeled label="placementRest %" hint="可选" labelClassName={getDiffLabelClassName(campaignPlacementRestChanged)}>
                      <Input className={getDiffFieldClassName(campaignPlacementRestChanged)} type="number" value={c.placementRestPct ?? ""} onChange={(e) => setBatchDraft((prev) => ({ ...prev, campaigns: prev.campaigns.map((x, i) => i === cIdx ? { ...x, placementRestPct: e.target.value === "" ? undefined : Number(e.target.value) } : x) }))} />
                    </Labeled>
                    <Labeled label="placementProductPage %" hint="可选" labelClassName={getDiffLabelClassName(campaignPlacementProductPageChanged)}>
                      <Input className={getDiffFieldClassName(campaignPlacementProductPageChanged)} type="number" value={c.placementProductPagePct ?? ""} onChange={(e) => setBatchDraft((prev) => ({ ...prev, campaigns: prev.campaigns.map((x, i) => i === cIdx ? { ...x, placementProductPagePct: e.target.value === "" ? undefined : Number(e.target.value) } : x) }))} />
                    </Labeled>
                  </div>

                  <div className="mt-4 grid gap-3">
                    {c.adGroups.map((g, gIdx) => {
                      const adGroupKey = buildAdGroupKey(cIdx, gIdx);
                      const adGroupOpen = hasOwnState(openAdGroups, adGroupKey) ? openAdGroups[adGroupKey] : false;
                      const adGroupSkuCount = countFilledLines(g.skusText);
                      const adGroupPrimaryCount = countPrimaryItemsForAdGroup(c.mode, g);
                      const adGroupDiffState = getAdGroupDiffState(c.campaignId, g, importedAdGroupMap);
                      const adGroupDiffFields = importedContext ? getAdGroupDiffFields(c.campaignId, g, importedAdGroupMap) : [];
                      const adGroupBaseline = importedContext ? importedAdGroupMap.get(`${c.campaignId}::${g.adGroupId}`) : undefined;
                      const adGroupNameChanged = adGroupBaseline ? isDiffValue(g.adGroupName.trim(), adGroupBaseline.adGroupName.trim()) : false;
                      const adGroupBidChanged = adGroupBaseline ? isDiffValue(g.adGroupDefaultBid, adGroupBaseline.adGroupDefaultBid) : false;
                      const adGroupStateChanged = adGroupBaseline ? isDiffValue(g.adGroupState, adGroupBaseline.adGroupState) : false;
                      const adGroupSkusChanged = adGroupBaseline ? isDiffValue(normalizeLines(g.skusText), normalizeLines(adGroupBaseline.skusText)) : false;
                      const adGroupKeywordsChanged = adGroupBaseline ? isDiffValue(normalizeLines(g.keywordsText), normalizeLines(adGroupBaseline.keywordsText)) : false;
                      const adGroupTargetingsChanged =
                        adGroupBaseline ? isDiffValue(normalizeLines(g.productTargetingsText), normalizeLines(adGroupBaseline.productTargetingsText)) : false;
                      const adGroupNegativeKeywordsChanged =
                        adGroupBaseline ? isDiffValue(normalizeLines(g.negativeKeywordsText), normalizeLines(adGroupBaseline.negativeKeywordsText)) : false;
                      const adGroupNegativeTargetingsChanged =
                        adGroupBaseline
                          ? isDiffValue(normalizeLines(g.negativeProductTargetingsText), normalizeLines(adGroupBaseline.negativeProductTargetingsText))
                          : false;
                      return (
                      <Collapsible
                        key={adGroupKey}
                        open={adGroupOpen}
                        onOpenChange={(open) => {
                          if (open) {
                            focusAdGroup(cIdx, gIdx, campaignKey, c.adGroups);
                            return;
                          }
                          setOpenAdGroups((prev) => ({ ...prev, [adGroupKey]: false }));
                        }}
                        className="rounded-lg border border-border/70 bg-muted/25"
                      >
                        <div
                          className="p-3"
                          onFocusCapture={(event) => {
                            if (!shouldAutoExpandFromFocus(event.target)) return;
                            focusAdGroup(cIdx, gIdx, campaignKey, c.adGroups);
                          }}
                        >
                        <div className="flex items-center justify-between gap-2">
                          <div>
                            <div className="flex flex-wrap items-center gap-2 text-sm font-semibold">
                              <span className="text-indigo-700 dark:text-indigo-300">{g.adGroupName.trim() || `广告组 #${gIdx + 1}`}</span>
                              {adGroupDiffState ? (
                                <Badge
                                  variant="outline"
                                  className={cn(
                                    "text-[11px]",
                                    adGroupDiffState === "new"
                                      ? "border-emerald-500/60 text-emerald-700"
                                      : "border-amber-500/60 text-amber-700"
                                  )}
                                >
                                  {adGroupDiffState === "new" ? "新增" : "已修改"}
                                </Badge>
                              ) : null}
                            </div>
                            <div className="mt-1 text-xs text-muted-foreground">
                              ID: {g.adGroupId || "未填写"} | SKU {adGroupSkuCount} | 关键词/定位 {adGroupPrimaryCount}
                            </div>
                            {adGroupDiffState && adGroupDiffFields.length > 0 ? (
                              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                                {adGroupDiffFields.slice(0, 6).map((field) => (
                                  <Badge
                                    key={field}
                                    variant="outline"
                                    className={cn(
                                      "text-[11px]",
                                      adGroupDiffState === "new"
                                        ? "border-emerald-500/60 bg-emerald-500/5 text-emerald-700"
                                        : "border-amber-500/60 bg-amber-500/5 text-amber-700"
                                    )}
                                  >
                                    {field}
                                  </Badge>
                                ))}
                                {adGroupDiffFields.length > 6 ? (
                                  <Badge variant="outline" className="text-[11px] border-amber-500/40 text-amber-700">
                                    +{adGroupDiffFields.length - 6} 项
                                  </Badge>
                                ) : null}
                              </div>
                            ) : null}
                          </div>
                          <div className="flex items-center gap-2">
                            <CollapsibleTrigger asChild>
                              <Button variant="outline" size="sm" className="gap-2">
                                <ChevronRight className={cn("h-4 w-4 transition-transform", adGroupOpen && "rotate-90")} />
                                {adGroupOpen ? "折叠组" : "展开组"}
                              </Button>
                            </CollapsibleTrigger>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setBatchDraft((prev) => ({
                                  ...prev,
                                  campaigns: prev.campaigns.map((x, i) =>
                                    i !== cIdx
                                      ? x
                                      : {
                                          ...x,
                                          adGroups:
                                            x.adGroups.length > 1
                                              ? x.adGroups.filter((_, ai) => ai !== gIdx)
                                              : x.adGroups,
                                        }
                                  ),
                                }));
                                setOpenAdGroups((prev) => remapAdGroupStateAfterDelete(prev, cIdx, gIdx));
                              }}
                            >
                              删除组
                            </Button>
                          </div>
                        </div>
                        <CollapsibleContent className="mt-2 grid gap-3">
                        <div className="grid gap-3 sm:grid-cols-2">
                          <Labeled label="Ad Group ID" required>
                            <Input value={g.adGroupId} onChange={(e) => setBatchDraft((prev) => ({ ...prev, campaigns: prev.campaigns.map((x, i) => i !== cIdx ? x : { ...x, adGroups: x.adGroups.map((a, ai) => ai === gIdx ? { ...a, adGroupId: e.target.value } : a) } ) }))} />
                          </Labeled>
                          <Labeled label="Ad Group Name" required labelClassName={getDiffLabelClassName(adGroupNameChanged)}>
                            <Input className={getDiffFieldClassName(adGroupNameChanged)} value={g.adGroupName} onChange={(e) => setBatchDraft((prev) => ({ ...prev, campaigns: prev.campaigns.map((x, i) => i !== cIdx ? x : { ...x, adGroups: x.adGroups.map((a, ai) => ai === gIdx ? { ...a, adGroupName: e.target.value } : a) } ) }))} />
                          </Labeled>
                          <Labeled label="Ad Group Default Bid" required labelClassName={getDiffLabelClassName(adGroupBidChanged)}>
                            <Input className={getDiffFieldClassName(adGroupBidChanged)} type="number" value={g.adGroupDefaultBid} onChange={(e) => setBatchDraft((prev) => ({ ...prev, campaigns: prev.campaigns.map((x, i) => i !== cIdx ? x : { ...x, adGroups: x.adGroups.map((a, ai) => ai === gIdx ? { ...a, adGroupDefaultBid: Number(e.target.value || 0) } : a) } ) }))} />
                          </Labeled>
                          <Labeled label="Ad Group State" required labelClassName={getDiffLabelClassName(adGroupStateChanged)}>
                            <Select value={g.adGroupState} onValueChange={(v) => setBatchDraft((prev) => ({ ...prev, campaigns: prev.campaigns.map((x, i) => i !== cIdx ? x : { ...x, adGroups: x.adGroups.map((a, ai) => ai === gIdx ? { ...a, adGroupState: v as State } : a) } ) }))}>
                              <SelectTrigger className={getDiffFieldClassName(adGroupStateChanged)}><SelectValue /></SelectTrigger>
                              <SelectContent>
                                {stateOptions.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                              </SelectContent>
                            </Select>
                          </Labeled>
                        </div>
                        <div className="grid gap-3">
                          <Labeled label="SKU列表" hint="一行一个SKU" required labelClassName={getDiffLabelClassName(adGroupSkusChanged)}>
                            <Textarea value={g.skusText} onChange={(e) => setBatchDraft((prev) => ({ ...prev, campaigns: prev.campaigns.map((x, i) => i !== cIdx ? x : { ...x, adGroups: x.adGroups.map((a, ai) => ai === gIdx ? { ...a, skusText: e.target.value } : a) } ) }))} className={cn("min-h-[90px] font-mono text-[12px]", getDiffFieldClassName(adGroupSkusChanged))} />
                          </Labeled>

                          {c.mode === "manual-keyword" && (
                            <div className="grid gap-2">
                              <div className={cn("text-sm font-medium", getDiffLabelClassName(adGroupKeywordsChanged))}>关键词列表 *</div>
                              <div className={cn("rounded-lg border border-border/70 bg-muted/20 p-3", getDiffFieldClassName(adGroupKeywordsChanged))}>
                                <div className="text-xs text-muted-foreground">
                                  批量输入：可直接粘贴多行关键词，支持 `关键词` 或 `关键词,匹配方式,bid,state`（支持 Tab 分隔）。
                                </div>
                                <Textarea
                                  value={g.keywordsText}
                                  onChange={(e) =>
                                    setBatchDraft((prev) => ({
                                      ...prev,
                                      campaigns: prev.campaigns.map((x, i) =>
                                        i !== cIdx
                                          ? x
                                          : {
                                              ...x,
                                              adGroups: x.adGroups.map((a, ai) => (ai === gIdx ? { ...a, keywordsText: e.target.value } : a)),
                                            }
                                      ),
                                    }))
                                  }
                                  className={cn("mt-2 min-h-[84px] font-mono text-[12px]", getDiffFieldClassName(adGroupKeywordsChanged))}
                                  placeholder={"running shoes\nwomen shoes,phrase,0.75,enabled"}
                                />
                                <div className="mt-2 flex flex-wrap items-center gap-2">
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => {
                                      const list = parseKeywordRowsForUi(g.keywordsText, g.adGroupDefaultBid || 0.75).map((x) => ({ ...x, matchType: "exact" as const }));
                                      setBatchDraft((prev) => ({ ...prev, campaigns: prev.campaigns.map((x, i) => i !== cIdx ? x : { ...x, adGroups: x.adGroups.map((a, ai) => ai === gIdx ? { ...a, keywordsText: toKeywordRowsText(list) } : a) } ) }));
                                    }}
                                  >
                                    全部设为精准
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => {
                                      const list = parseKeywordRowsForUi(g.keywordsText, g.adGroupDefaultBid || 0.75).map((x) => ({ ...x, matchType: "phrase" as const }));
                                      setBatchDraft((prev) => ({ ...prev, campaigns: prev.campaigns.map((x, i) => i !== cIdx ? x : { ...x, adGroups: x.adGroups.map((a, ai) => ai === gIdx ? { ...a, keywordsText: toKeywordRowsText(list) } : a) } ) }));
                                    }}
                                  >
                                    全部设为词组
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => {
                                      const list = parseKeywordRowsForUi(g.keywordsText, g.adGroupDefaultBid || 0.75).map((x) => ({ ...x, matchType: "broad" as const }));
                                      setBatchDraft((prev) => ({ ...prev, campaigns: prev.campaigns.map((x, i) => i !== cIdx ? x : { ...x, adGroups: x.adGroups.map((a, ai) => ai === gIdx ? { ...a, keywordsText: toKeywordRowsText(list) } : a) } ) }));
                                    }}
                                  >
                                    全部设为广泛
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => {
                                      const list = parseKeywordRowsForUi(g.keywordsText, g.adGroupDefaultBid || 0.75).map((x) => ({ ...x, bid: g.adGroupDefaultBid || 0.75 }));
                                      setBatchDraft((prev) => ({ ...prev, campaigns: prev.campaigns.map((x, i) => i !== cIdx ? x : { ...x, adGroups: x.adGroups.map((a, ai) => ai === gIdx ? { ...a, keywordsText: toKeywordRowsText(list) } : a) } ) }));
                                    }}
                                  >
                                    全部Bid=默认出价
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => {
                                      const list = parseKeywordRowsForUi(g.keywordsText, g.adGroupDefaultBid || 0.75).map((x) => ({ ...x, state: "enabled" as const }));
                                      setBatchDraft((prev) => ({ ...prev, campaigns: prev.campaigns.map((x, i) => i !== cIdx ? x : { ...x, adGroups: x.adGroups.map((a, ai) => ai === gIdx ? { ...a, keywordsText: toKeywordRowsText(list) } : a) } ) }));
                                    }}
                                  >
                                    全部启用
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => {
                                      const list = parseKeywordRowsForUi(g.keywordsText, g.adGroupDefaultBid || 0.75).map((x) => ({ ...x, state: "paused" as const }));
                                      setBatchDraft((prev) => ({ ...prev, campaigns: prev.campaigns.map((x, i) => i !== cIdx ? x : { ...x, adGroups: x.adGroups.map((a, ai) => ai === gIdx ? { ...a, keywordsText: toKeywordRowsText(list) } : a) } ) }));
                                    }}
                                  >
                                    全部暂停
                                  </Button>
                                  <Input
                                    type="number"
                                    className="h-8 w-[140px]"
                                    placeholder="自定义Bid"
                                    value={keywordBulkBidByGroup[`${cIdx}-${gIdx}`] ?? ""}
                                    onChange={(e) =>
                                      setKeywordBulkBidByGroup((prev) => ({
                                        ...prev,
                                        [`${cIdx}-${gIdx}`]: e.target.value,
                                      }))
                                    }
                                  />
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => {
                                      const raw = keywordBulkBidByGroup[`${cIdx}-${gIdx}`];
                                      const bid = Number(raw);
                                      if (!raw || !Number.isFinite(bid) || bid <= 0) {
                                        toast.error("请输入有效的自定义Bid", { description: "例如 0.75、1.2" });
                                        return;
                                      }
                                      const list = parseKeywordRowsForUi(g.keywordsText, g.adGroupDefaultBid || 0.75).map((x) => ({ ...x, bid }));
                                      setBatchDraft((prev) => ({ ...prev, campaigns: prev.campaigns.map((x, i) => i !== cIdx ? x : { ...x, adGroups: x.adGroups.map((a, ai) => ai === gIdx ? { ...a, keywordsText: toKeywordRowsText(list) } : a) } ) }));
                                    }}
                                  >
                                    应用自定义Bid
                                  </Button>
                                </div>
                              </div>
                              <div className={cn("overflow-auto rounded-lg border border-border/70", getDiffFieldClassName(adGroupKeywordsChanged))}>
                                <Table>
                                  <TableHeader>
                                    <TableRow>
                                      <TableHead className="min-w-[260px]">Keyword Text</TableHead>
                                      <TableHead className="min-w-[180px]">Match Type</TableHead>
                                      <TableHead className="min-w-[120px]">Bid</TableHead>
                                      <TableHead className="min-w-[140px]">State</TableHead>
                                      <TableHead className="w-[1%]"></TableHead>
                                    </TableRow>
                                  </TableHeader>
                                  <TableBody>
                                    {parseKeywordRowsForUi(g.keywordsText, g.adGroupDefaultBid || 0.75).map((row, rIdx) => (
                                      <TableRow key={rIdx}>
                                        <TableCell>
                                          <Input
                                            value={row.text}
                                            onChange={(e) => {
                                              const list = parseKeywordRowsForUi(g.keywordsText, g.adGroupDefaultBid || 0.75).map((x, i) => (i === rIdx ? { ...x, text: e.target.value } : x));
                                              setBatchDraft((prev) => ({ ...prev, campaigns: prev.campaigns.map((x, i) => i !== cIdx ? x : { ...x, adGroups: x.adGroups.map((a, ai) => ai === gIdx ? { ...a, keywordsText: toKeywordRowsText(list) } : a) } ) }));
                                            }}
                                          />
                                        </TableCell>
                                        <TableCell>
                                          <Select
                                            value={row.matchType}
                                            onValueChange={(v) => {
                                              const list = parseKeywordRowsForUi(g.keywordsText, g.adGroupDefaultBid || 0.75).map((x, i) => (i === rIdx ? { ...x, matchType: v as Exclude<SpMatchType, "negativeExact" | "negativePhrase"> } : x));
                                              setBatchDraft((prev) => ({ ...prev, campaigns: prev.campaigns.map((x, i) => i !== cIdx ? x : { ...x, adGroups: x.adGroups.map((a, ai) => ai === gIdx ? { ...a, keywordsText: toKeywordRowsText(list) } : a) } ) }));
                                            }}
                                          >
                                            <SelectTrigger><SelectValue /></SelectTrigger>
                                            <SelectContent>
                                              {keywordMatchOptions.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                                            </SelectContent>
                                          </Select>
                                        </TableCell>
                                        <TableCell>
                                          <Input
                                            type="number"
                                            value={row.bid}
                                            onChange={(e) => {
                                              const list = parseKeywordRowsForUi(g.keywordsText, g.adGroupDefaultBid || 0.75).map((x, i) => (i === rIdx ? { ...x, bid: Number(e.target.value || 0) } : x));
                                              setBatchDraft((prev) => ({ ...prev, campaigns: prev.campaigns.map((x, i) => i !== cIdx ? x : { ...x, adGroups: x.adGroups.map((a, ai) => ai === gIdx ? { ...a, keywordsText: toKeywordRowsText(list) } : a) } ) }));
                                            }}
                                          />
                                        </TableCell>
                                        <TableCell>
                                          <Select
                                            value={row.state}
                                            onValueChange={(v) => {
                                              const list = parseKeywordRowsForUi(g.keywordsText, g.adGroupDefaultBid || 0.75).map((x, i) => (i === rIdx ? { ...x, state: v as State } : x));
                                              setBatchDraft((prev) => ({ ...prev, campaigns: prev.campaigns.map((x, i) => i !== cIdx ? x : { ...x, adGroups: x.adGroups.map((a, ai) => ai === gIdx ? { ...a, keywordsText: toKeywordRowsText(list) } : a) } ) }));
                                            }}
                                          >
                                            <SelectTrigger><SelectValue /></SelectTrigger>
                                            <SelectContent>
                                              {stateOptions.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                                            </SelectContent>
                                          </Select>
                                        </TableCell>
                                        <TableCell>
                                          <Button
                                            variant="ghost"
                                            size="icon"
                                            onClick={() => {
                                              const old = parseKeywordRowsForUi(g.keywordsText, g.adGroupDefaultBid || 0.75);
                                              const list = old.filter((_, i) => i !== rIdx);
                                              const next = list.length ? list : [{ text: "", matchType: "exact" as const, bid: g.adGroupDefaultBid || 0.75, state: "enabled" as const }];
                                              setBatchDraft((prev) => ({ ...prev, campaigns: prev.campaigns.map((x, i) => i !== cIdx ? x : { ...x, adGroups: x.adGroups.map((a, ai) => ai === gIdx ? { ...a, keywordsText: toKeywordRowsText(next) } : a) } ) }));
                                            }}
                                          >
                                            <Trash2 className="h-4 w-4" />
                                          </Button>
                                        </TableCell>
                                      </TableRow>
                                    ))}
                                  </TableBody>
                                </Table>
                              </div>
                              <Button
                                variant="outline"
                                size="sm"
                                className="w-fit"
                                onClick={() => {
                                  const list = [...parseKeywordRowsForUi(g.keywordsText, g.adGroupDefaultBid || 0.75), { text: "", matchType: "exact" as const, bid: g.adGroupDefaultBid || 0.75, state: "enabled" as const }];
                                  setBatchDraft((prev) => ({ ...prev, campaigns: prev.campaigns.map((x, i) => i !== cIdx ? x : { ...x, adGroups: x.adGroups.map((a, ai) => ai === gIdx ? { ...a, keywordsText: toKeywordRowsText(list) } : a) } ) }));
                                }}
                              >
                                <Plus className="h-4 w-4" /> 添加关键词
                              </Button>
                            </div>
                          )}

                          {c.mode === "auto" ? (
                            <div className="grid gap-2">
                              <div className={cn("text-sm font-medium", getDiffLabelClassName(adGroupTargetingsChanged))}>自动投放类型列表 *</div>
                              <div className={cn("overflow-auto rounded-lg border border-border/70", getDiffFieldClassName(adGroupTargetingsChanged))}>
                                <Table>
                                  <TableHeader>
                                    <TableRow>
                                      <TableHead className="min-w-[220px]">类型</TableHead>
                                      <TableHead className="min-w-[120px]">Bid</TableHead>
                                      <TableHead className="min-w-[140px]">State</TableHead>
                                      <TableHead className="w-[1%]"></TableHead>
                                    </TableRow>
                                  </TableHeader>
                                  <TableBody>
                                    {parseAutoTargetingRows(g.productTargetingsText).map((row, rIdx) => (
                                      <TableRow key={rIdx}>
                                        <TableCell>
                                          <Select
                                            value={row.expression}
                                            onValueChange={(v) => {
                                              const list = parseAutoTargetingRows(g.productTargetingsText).map((x, i) => (i === rIdx ? { ...x, expression: v } : x));
                                              setBatchDraft((prev) => ({ ...prev, campaigns: prev.campaigns.map((x, i) => i !== cIdx ? x : { ...x, adGroups: x.adGroups.map((a, ai) => ai === gIdx ? { ...a, productTargetingsText: toAutoTargetingText(list) } : a) } ) }));
                                            }}
                                          >
                                            <SelectTrigger><SelectValue /></SelectTrigger>
                                            <SelectContent>
                                              {autoTargetingTypeOptions.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                                            </SelectContent>
                                          </Select>
                                        </TableCell>
                                        <TableCell>
                                          <Input type="number" value={row.bid} onChange={(e) => {
                                            const list = parseAutoTargetingRows(g.productTargetingsText).map((x, i) => i === rIdx ? { ...x, bid: Number(e.target.value || 0) } : x);
                                            setBatchDraft((prev) => ({ ...prev, campaigns: prev.campaigns.map((x, i) => i !== cIdx ? x : { ...x, adGroups: x.adGroups.map((a, ai) => ai === gIdx ? { ...a, productTargetingsText: toAutoTargetingText(list) } : a) } ) }));
                                          }} />
                                        </TableCell>
                                        <TableCell>
                                          <Select value={row.state} onValueChange={(v) => {
                                            const list = parseAutoTargetingRows(g.productTargetingsText).map((x, i) => i === rIdx ? { ...x, state: v as State } : x);
                                            setBatchDraft((prev) => ({ ...prev, campaigns: prev.campaigns.map((x, i) => i !== cIdx ? x : { ...x, adGroups: x.adGroups.map((a, ai) => ai === gIdx ? { ...a, productTargetingsText: toAutoTargetingText(list) } : a) } ) }));
                                          }}>
                                            <SelectTrigger><SelectValue /></SelectTrigger>
                                            <SelectContent>{stateOptions.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
                                          </Select>
                                        </TableCell>
                                        <TableCell>
                                          <Button variant="ghost" size="icon" onClick={() => {
                                            const old = parseAutoTargetingRows(g.productTargetingsText);
                                            const list = old.filter((_, i) => i !== rIdx);
                                            const next: Array<{ expression: string; bid: number; state: State }> = list.length
                                              ? list
                                              : [{ expression: "close-match", bid: 0.75, state: "enabled" as State }];
                                            setBatchDraft((prev) => ({ ...prev, campaigns: prev.campaigns.map((x, i) => i !== cIdx ? x : { ...x, adGroups: x.adGroups.map((a, ai) => ai === gIdx ? { ...a, productTargetingsText: toAutoTargetingText(next) } : a) } ) }));
                                          }}>
                                            <Trash2 className="h-4 w-4" />
                                          </Button>
                                        </TableCell>
                                      </TableRow>
                                    ))}
                                  </TableBody>
                                </Table>
                              </div>
                              <Button
                                variant="outline"
                                size="sm"
                                className="w-fit"
                                onClick={() => {
                                  const list: Array<{ expression: string; bid: number; state: State }> = [
                                    ...parseAutoTargetingRows(g.productTargetingsText),
                                    { expression: "close-match", bid: 0.75, state: "enabled" as State },
                                  ];
                                  setBatchDraft((prev) => ({ ...prev, campaigns: prev.campaigns.map((x, i) => i !== cIdx ? x : { ...x, adGroups: x.adGroups.map((a, ai) => ai === gIdx ? { ...a, productTargetingsText: toAutoTargetingText(list) } : a) } ) }));
                                }}
                              >
                                <Plus className="h-4 w-4" /> 添加自动投放类型
                              </Button>
                            </div>
                          ) : c.mode === "manual-product-targeting" ? (
                            <div className="grid gap-2">
                              <div className={cn("text-sm font-medium", getDiffLabelClassName(adGroupTargetingsChanged))}>商品定位列表 *</div>
                              <div className={cn("overflow-auto rounded-lg border border-border/70", getDiffFieldClassName(adGroupTargetingsChanged))}>
                                <Table>
                                  <TableHeader>
                                    <TableRow>
                                      <TableHead className="min-w-[320px]">Product Targeting Expression</TableHead>
                                      <TableHead className="min-w-[120px]">Bid</TableHead>
                                      <TableHead className="min-w-[140px]">State</TableHead>
                                      <TableHead className="w-[1%]"></TableHead>
                                    </TableRow>
                                  </TableHeader>
                                  <TableBody>
                                    {parseProductTargetingRowsForUi(g.productTargetingsText, g.adGroupDefaultBid || 0.75).map((row, rIdx) => (
                                      <TableRow key={rIdx}>
                                        <TableCell>
                                          <Input value={row.expression} onChange={(e) => {
                                            const list = parseProductTargetingRowsForUi(g.productTargetingsText, g.adGroupDefaultBid || 0.75).map((x, i) => i === rIdx ? { ...x, expression: e.target.value } : x);
                                            setBatchDraft((prev) => ({ ...prev, campaigns: prev.campaigns.map((x, i) => i !== cIdx ? x : { ...x, adGroups: x.adGroups.map((a, ai) => ai === gIdx ? { ...a, productTargetingsText: toAutoTargetingText(list) } : a) } ) }));
                                          }} />
                                        </TableCell>
                                        <TableCell>
                                          <Input type="number" value={row.bid} onChange={(e) => {
                                            const list = parseProductTargetingRowsForUi(g.productTargetingsText, g.adGroupDefaultBid || 0.75).map((x, i) => i === rIdx ? { ...x, bid: Number(e.target.value || 0) } : x);
                                            setBatchDraft((prev) => ({ ...prev, campaigns: prev.campaigns.map((x, i) => i !== cIdx ? x : { ...x, adGroups: x.adGroups.map((a, ai) => ai === gIdx ? { ...a, productTargetingsText: toAutoTargetingText(list) } : a) } ) }));
                                          }} />
                                        </TableCell>
                                        <TableCell>
                                          <Select value={row.state} onValueChange={(v) => {
                                            const list = parseProductTargetingRowsForUi(g.productTargetingsText, g.adGroupDefaultBid || 0.75).map((x, i) => i === rIdx ? { ...x, state: v as State } : x);
                                            setBatchDraft((prev) => ({ ...prev, campaigns: prev.campaigns.map((x, i) => i !== cIdx ? x : { ...x, adGroups: x.adGroups.map((a, ai) => ai === gIdx ? { ...a, productTargetingsText: toAutoTargetingText(list) } : a) } ) }));
                                          }}>
                                            <SelectTrigger><SelectValue /></SelectTrigger>
                                            <SelectContent>{stateOptions.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
                                          </Select>
                                        </TableCell>
                                        <TableCell>
                                          <Button variant="ghost" size="icon" onClick={() => {
                                            const old = parseProductTargetingRowsForUi(g.productTargetingsText, g.adGroupDefaultBid || 0.75);
                                            const list = old.filter((_, i) => i !== rIdx);
                                            const next: Array<{ expression: string; bid: number; state: State }> = list.length
                                              ? list
                                              : [{ expression: "", bid: g.adGroupDefaultBid || 0.75, state: "enabled" as State }];
                                            setBatchDraft((prev) => ({ ...prev, campaigns: prev.campaigns.map((x, i) => i !== cIdx ? x : { ...x, adGroups: x.adGroups.map((a, ai) => ai === gIdx ? { ...a, productTargetingsText: toAutoTargetingText(next) } : a) } ) }));
                                          }}>
                                            <Trash2 className="h-4 w-4" />
                                          </Button>
                                        </TableCell>
                                      </TableRow>
                                    ))}
                                  </TableBody>
                                </Table>
                              </div>
                              <Button variant="outline" size="sm" className="w-fit" onClick={() => {
                                const list: Array<{ expression: string; bid: number; state: State }> = [
                                  ...parseProductTargetingRowsForUi(g.productTargetingsText, g.adGroupDefaultBid || 0.75),
                                  { expression: "", bid: g.adGroupDefaultBid || 0.75, state: "enabled" as State },
                                ];
                                setBatchDraft((prev) => ({ ...prev, campaigns: prev.campaigns.map((x, i) => i !== cIdx ? x : { ...x, adGroups: x.adGroups.map((a, ai) => ai === gIdx ? { ...a, productTargetingsText: toAutoTargetingText(list) } : a) } ) }));
                              }}>
                                <Plus className="h-4 w-4" /> 添加商品定位
                              </Button>
                            </div>
                          ) : null}

                          <div className="grid gap-2">
                            <div className={cn("text-sm font-medium", getDiffLabelClassName(adGroupNegativeKeywordsChanged))}>否词列表（可选）</div>
                            <div className={cn("rounded-lg border border-border/70 bg-muted/20 p-3", getDiffFieldClassName(adGroupNegativeKeywordsChanged))}>
                              <div className="text-xs text-muted-foreground">
                                批量输入：可直接粘贴多行否词，支持 `否词` 或 `否词,匹配方式,state`（支持 Tab 分隔）。
                              </div>
                              <Textarea
                                value={g.negativeKeywordsText}
                                onChange={(e) =>
                                  setBatchDraft((prev) => ({
                                    ...prev,
                                    campaigns: prev.campaigns.map((x, i) =>
                                      i !== cIdx
                                        ? x
                                        : {
                                            ...x,
                                            adGroups: x.adGroups.map((a, ai) => (ai === gIdx ? { ...a, negativeKeywordsText: e.target.value } : a)),
                                          }
                                    ),
                                  }))
                                }
                                className={cn("mt-2 min-h-[84px] font-mono text-[12px]", getDiffFieldClassName(adGroupNegativeKeywordsChanged))}
                                placeholder={"free,negativePhrase,enabled\ncheap,negativeExact,paused"}
                              />
                              <div className="mt-2 flex flex-wrap items-center gap-2">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => {
                                    const list = parseNegativeKeywordRowsForUi(g.negativeKeywordsText).map((x) => ({ ...x, matchType: "negativeExact" as const }));
                                    setBatchDraft((prev) => ({ ...prev, campaigns: prev.campaigns.map((x, i) => i !== cIdx ? x : { ...x, adGroups: x.adGroups.map((a, ai) => ai === gIdx ? { ...a, negativeKeywordsText: toNegativeKeywordRowsText(list) } : a) } ) }));
                                  }}
                                >
                                  全部设为否定精准
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => {
                                    const list = parseNegativeKeywordRowsForUi(g.negativeKeywordsText).map((x) => ({ ...x, matchType: "negativePhrase" as const }));
                                    setBatchDraft((prev) => ({ ...prev, campaigns: prev.campaigns.map((x, i) => i !== cIdx ? x : { ...x, adGroups: x.adGroups.map((a, ai) => ai === gIdx ? { ...a, negativeKeywordsText: toNegativeKeywordRowsText(list) } : a) } ) }));
                                  }}
                                >
                                  全部设为否定词组
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => {
                                    const list = parseNegativeKeywordRowsForUi(g.negativeKeywordsText).map((x) => ({ ...x, state: "enabled" as const }));
                                    setBatchDraft((prev) => ({ ...prev, campaigns: prev.campaigns.map((x, i) => i !== cIdx ? x : { ...x, adGroups: x.adGroups.map((a, ai) => ai === gIdx ? { ...a, negativeKeywordsText: toNegativeKeywordRowsText(list) } : a) } ) }));
                                  }}
                                >
                                  全部启用
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => {
                                    const list = parseNegativeKeywordRowsForUi(g.negativeKeywordsText).map((x) => ({ ...x, state: "paused" as const }));
                                    setBatchDraft((prev) => ({ ...prev, campaigns: prev.campaigns.map((x, i) => i !== cIdx ? x : { ...x, adGroups: x.adGroups.map((a, ai) => ai === gIdx ? { ...a, negativeKeywordsText: toNegativeKeywordRowsText(list) } : a) } ) }));
                                  }}
                                >
                                  全部暂停
                                </Button>
                              </div>
                            </div>
                            <div className={cn("overflow-auto rounded-lg border border-border/70", getDiffFieldClassName(adGroupNegativeKeywordsChanged))}>
                              <Table>
                                <TableHeader>
                                  <TableRow>
                                    <TableHead className="min-w-[260px]">Keyword Text</TableHead>
                                    <TableHead className="min-w-[220px]">Match Type</TableHead>
                                    <TableHead className="min-w-[140px]">State</TableHead>
                                    <TableHead className="w-[1%]"></TableHead>
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {parseNegativeKeywordRowsForUi(g.negativeKeywordsText).map((row, rIdx) => (
                                    <TableRow key={rIdx}>
                                      <TableCell><Input value={row.text} onChange={(e) => {
                                        const list = parseNegativeKeywordRowsForUi(g.negativeKeywordsText).map((x, i) => i === rIdx ? { ...x, text: e.target.value } : x);
                                        setBatchDraft((prev) => ({ ...prev, campaigns: prev.campaigns.map((x, i) => i !== cIdx ? x : { ...x, adGroups: x.adGroups.map((a, ai) => ai === gIdx ? { ...a, negativeKeywordsText: toNegativeKeywordRowsText(list) } : a) } ) }));
                                      }} /></TableCell>
                                      <TableCell>
                                        <Select value={row.matchType} onValueChange={(v) => {
                                          const list = parseNegativeKeywordRowsForUi(g.negativeKeywordsText).map((x, i) => i === rIdx ? { ...x, matchType: v as Extract<SpMatchType, "negativeExact" | "negativePhrase"> } : x);
                                          setBatchDraft((prev) => ({ ...prev, campaigns: prev.campaigns.map((x, i) => i !== cIdx ? x : { ...x, adGroups: x.adGroups.map((a, ai) => ai === gIdx ? { ...a, negativeKeywordsText: toNegativeKeywordRowsText(list) } : a) } ) }));
                                        }}>
                                          <SelectTrigger><SelectValue /></SelectTrigger>
                                          <SelectContent>{negMatchOptions.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
                                        </Select>
                                      </TableCell>
                                      <TableCell>
                                        <Select value={row.state} onValueChange={(v) => {
                                          const list = parseNegativeKeywordRowsForUi(g.negativeKeywordsText).map((x, i) => i === rIdx ? { ...x, state: v as State } : x);
                                          setBatchDraft((prev) => ({ ...prev, campaigns: prev.campaigns.map((x, i) => i !== cIdx ? x : { ...x, adGroups: x.adGroups.map((a, ai) => ai === gIdx ? { ...a, negativeKeywordsText: toNegativeKeywordRowsText(list) } : a) } ) }));
                                        }}>
                                          <SelectTrigger><SelectValue /></SelectTrigger>
                                          <SelectContent>{stateOptions.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
                                        </Select>
                                      </TableCell>
                                      <TableCell>
                                        <Button variant="ghost" size="icon" onClick={() => {
                                          const old = parseNegativeKeywordRowsForUi(g.negativeKeywordsText);
                                          const list = old.filter((_, i) => i !== rIdx);
                                          const next = list.length ? list : [{ text: "", matchType: "negativePhrase" as const, state: "enabled" as const }];
                                          setBatchDraft((prev) => ({ ...prev, campaigns: prev.campaigns.map((x, i) => i !== cIdx ? x : { ...x, adGroups: x.adGroups.map((a, ai) => ai === gIdx ? { ...a, negativeKeywordsText: toNegativeKeywordRowsText(next) } : a) } ) }));
                                        }}>
                                          <Trash2 className="h-4 w-4" />
                                        </Button>
                                      </TableCell>
                                    </TableRow>
                                  ))}
                                </TableBody>
                              </Table>
                            </div>
                            <Button variant="outline" size="sm" className="w-fit" onClick={() => {
                              const list = [...parseNegativeKeywordRowsForUi(g.negativeKeywordsText), { text: "", matchType: "negativePhrase" as const, state: "enabled" as const }];
                              setBatchDraft((prev) => ({ ...prev, campaigns: prev.campaigns.map((x, i) => i !== cIdx ? x : { ...x, adGroups: x.adGroups.map((a, ai) => ai === gIdx ? { ...a, negativeKeywordsText: toNegativeKeywordRowsText(list) } : a) } ) }));
                            }}>
                              <Plus className="h-4 w-4" /> 添加否词
                            </Button>
                          </div>

                          <div className="grid gap-2">
                            <div className={cn("text-sm font-medium", getDiffLabelClassName(adGroupNegativeTargetingsChanged))}>否定ASIN列表（可选）</div>
                            <div className={cn("rounded-lg border border-border/70 bg-muted/20 p-3", getDiffFieldClassName(adGroupNegativeTargetingsChanged))}>
                              <div className="text-xs text-muted-foreground">
                                批量输入：可直接粘贴多行否定 ASIN/定向表达式，支持 `表达式` 或 `表达式,state`（支持 Tab 分隔）。
                              </div>
                              <Textarea
                                value={g.negativeProductTargetingsText}
                                onChange={(e) =>
                                  setBatchDraft((prev) => ({
                                    ...prev,
                                    campaigns: prev.campaigns.map((x, i) =>
                                      i !== cIdx
                                        ? x
                                        : {
                                            ...x,
                                            adGroups: x.adGroups.map((a, ai) => (ai === gIdx ? { ...a, negativeProductTargetingsText: e.target.value } : a)),
                                          }
                                    ),
                                  }))
                                }
                                className={cn("mt-2 min-h-[84px] font-mono text-[12px]", getDiffFieldClassName(adGroupNegativeTargetingsChanged))}
                                placeholder={'asin="B0XXXXXXXX",enabled\nasinSameAs="B0YYYYYYYY",paused'}
                              />
                              <div className="mt-2 flex flex-wrap items-center gap-2">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => {
                                    const list = parseNegativeProductTargetingRowsForUi(g.negativeProductTargetingsText).map((x) => ({ ...x, state: "enabled" as const }));
                                    setBatchDraft((prev) => ({ ...prev, campaigns: prev.campaigns.map((x, i) => i !== cIdx ? x : { ...x, adGroups: x.adGroups.map((a, ai) => ai === gIdx ? { ...a, negativeProductTargetingsText: toNegativeProductTargetingRowsText(list) } : a) } ) }));
                                  }}
                                >
                                  全部启用
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => {
                                    const list = parseNegativeProductTargetingRowsForUi(g.negativeProductTargetingsText).map((x) => ({ ...x, state: "paused" as const }));
                                    setBatchDraft((prev) => ({ ...prev, campaigns: prev.campaigns.map((x, i) => i !== cIdx ? x : { ...x, adGroups: x.adGroups.map((a, ai) => ai === gIdx ? { ...a, negativeProductTargetingsText: toNegativeProductTargetingRowsText(list) } : a) } ) }));
                                  }}
                                >
                                  全部暂停
                                </Button>
                              </div>
                            </div>
                            <div className={cn("overflow-auto rounded-lg border border-border/70", getDiffFieldClassName(adGroupNegativeTargetingsChanged))}>
                              <Table>
                                <TableHeader>
                                  <TableRow>
                                    <TableHead className="min-w-[360px]">Product Targeting Expression</TableHead>
                                    <TableHead className="min-w-[140px]">State</TableHead>
                                    <TableHead className="w-[1%]"></TableHead>
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {parseNegativeProductTargetingRowsForUi(g.negativeProductTargetingsText).map((row, rIdx) => (
                                    <TableRow key={rIdx}>
                                      <TableCell><Input value={row.expression} onChange={(e) => {
                                        const list = parseNegativeProductTargetingRowsForUi(g.negativeProductTargetingsText).map((x, i) => i === rIdx ? { ...x, expression: e.target.value } : x);
                                        setBatchDraft((prev) => ({ ...prev, campaigns: prev.campaigns.map((x, i) => i !== cIdx ? x : { ...x, adGroups: x.adGroups.map((a, ai) => ai === gIdx ? { ...a, negativeProductTargetingsText: toNegativeProductTargetingRowsText(list) } : a) } ) }));
                                      }} placeholder={'asin="B0XXXXXXXX"'} /></TableCell>
                                      <TableCell>
                                        <Select value={row.state} onValueChange={(v) => {
                                          const list = parseNegativeProductTargetingRowsForUi(g.negativeProductTargetingsText).map((x, i) => i === rIdx ? { ...x, state: v as State } : x);
                                          setBatchDraft((prev) => ({ ...prev, campaigns: prev.campaigns.map((x, i) => i !== cIdx ? x : { ...x, adGroups: x.adGroups.map((a, ai) => ai === gIdx ? { ...a, negativeProductTargetingsText: toNegativeProductTargetingRowsText(list) } : a) } ) }));
                                        }}>
                                          <SelectTrigger><SelectValue /></SelectTrigger>
                                          <SelectContent>{stateOptions.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
                                        </Select>
                                      </TableCell>
                                      <TableCell>
                                        <Button variant="ghost" size="icon" onClick={() => {
                                          const old = parseNegativeProductTargetingRowsForUi(g.negativeProductTargetingsText);
                                          const list = old.filter((_, i) => i !== rIdx);
                                          const next = list.length ? list : [{ expression: "", state: "enabled" as const }];
                                          setBatchDraft((prev) => ({ ...prev, campaigns: prev.campaigns.map((x, i) => i !== cIdx ? x : { ...x, adGroups: x.adGroups.map((a, ai) => ai === gIdx ? { ...a, negativeProductTargetingsText: toNegativeProductTargetingRowsText(next) } : a) } ) }));
                                        }}>
                                          <Trash2 className="h-4 w-4" />
                                        </Button>
                                      </TableCell>
                                    </TableRow>
                                  ))}
                                </TableBody>
                              </Table>
                            </div>
                            <Button variant="outline" size="sm" className="w-fit" onClick={() => {
                              const list = [...parseNegativeProductTargetingRowsForUi(g.negativeProductTargetingsText), { expression: "", state: "enabled" as const }];
                              setBatchDraft((prev) => ({ ...prev, campaigns: prev.campaigns.map((x, i) => i !== cIdx ? x : { ...x, adGroups: x.adGroups.map((a, ai) => ai === gIdx ? { ...a, negativeProductTargetingsText: toNegativeProductTargetingRowsText(list) } : a) } ) }));
                            }}>
                              <Plus className="h-4 w-4" /> 添加否定ASIN
                            </Button>
                          </div>
                        </div>
                        {c.mode === "auto" && (
                          <div className="mt-2 flex flex-wrap items-center gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() =>
                                setBatchDraft((prev) => ({
                                  ...prev,
                                  campaigns: prev.campaigns.map((x, i) =>
                                    i !== cIdx
                                      ? x
                                      : {
                                          ...x,
                                          adGroups: x.adGroups.map((a, ai) =>
                                            ai !== gIdx
                                              ? a
                                              : {
                                                  ...a,
                                                  productTargetingsText:
                                                    "close-match,0.75,enabled\nloose-match,0.75,enabled\nsubstitutes,0.75,enabled\ncomplements,0.75,enabled",
                                                }
                                          ),
                                        }
                                  ),
                                }))
                              }
                            >
                              一键填充4种自动投放
                            </Button>
                            <span className="text-xs text-muted-foreground">可按需把不需要的类型改为 paused 或删除行。</span>
                          </div>
                        )}
                        </CollapsibleContent>
                        </div>
                      </Collapsible>
                    )})}
                    <Button
                      variant="outline"
                      className="w-fit"
                      onClick={() => {
                        focusCampaign(campaignKey);
                        setBatchDraft((prev) => ({
                          ...prev,
                          campaigns: prev.campaigns.map((x, i) => (i === cIdx ? { ...x, adGroups: [...x.adGroups, createInitialSpBatchAdGroup()] } : x)),
                        }));
                        setOpenAdGroups((prev) => ({
                          ...prev,
                          [buildAdGroupKey(cIdx, c.adGroups.length)]: true,
                        }));
                      }}
                    >
                      <Plus className="h-4 w-4" /> 添加广告组
                    </Button>
                    <div className="text-xs text-muted-foreground">提示：每个广告组都可以独立配置 SKU/关键词/否词/否定ASIN，适配不同打法。</div>
                  </div>
                    </CollapsibleContent>
                  </div>
                </Collapsible>
              )})}
              <Button
                className="w-fit bg-sky-600 text-white hover:bg-sky-700"
                onClick={() => {
                  const nextIndex = batchDraft.campaigns.length;
                  setBatchDraft((prev) => ({ ...prev, campaigns: [...prev.campaigns, createInitialSpBatchCampaign()] }));
                  setOpenCampaigns({ [buildCampaignKey(nextIndex)]: true });
                  setSelectedCampaigns((prev) => ({ ...prev, [buildCampaignKey(nextIndex)]: true }));
                  setOpenAdGroups({ [buildAdGroupKey(nextIndex, 0)]: true });
                }}
              >
                <Plus className="h-4 w-4" /> 添加活动
              </Button>
              <div className="text-xs text-muted-foreground">提示：活动级设置（预算、竞价策略、广告位加价）会应用到该活动下所有广告组。</div>
            </div>
          </section>
        ) : (
        <div className="grid gap-5">
          <section className="grid gap-3">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">A. Campaign（广告活动）</h3>
              <Badge variant="outline" className="font-mono text-[11px]">
                Entity: Campaign
              </Badge>
            </div>
            <div className="text-xs text-muted-foreground">说明：导出时会自动填充 Operation=Create；Campaign ID 是关联键，不是 Campaign Name。</div>

            <div className="grid gap-3 sm:grid-cols-2">
              <Labeled label="Campaign ID" hint="广告活动关联ID（不是名称）；同一活动下所有行保持一致" required>
                <Input value={w.campaignId} onChange={(e) => set("campaignId", e.target.value)} placeholder="如：SP-Exact-XXX" />
              </Labeled>
              <Labeled label="Campaign Name" required>
                <Input value={w.campaignName} onChange={(e) => set("campaignName", e.target.value)} placeholder="如：SP-Exact-XXX" />
              </Labeled>
              <Labeled label="Start Date" hint="8位数字 YYYYMMDD" required>
                <Input value={w.startDate} onChange={(e) => set("startDate", e.target.value)} />
              </Labeled>
              <Labeled label="Daily Budget" hint="单位：站点币种" required>
                <Input type="number" value={w.dailyBudget} onChange={(e) => set("dailyBudget", Number(e.target.value || 0))} />
              </Labeled>
              <Labeled label="State" required>
                <Select value={w.state} onValueChange={(v) => set("state", v as State)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {stateOptions.map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Labeled>
              <Labeled label="Bidding Strategy" required>
                <Select value={w.biddingStrategy} onValueChange={(v) => set("biddingStrategy", v as SpBiddingStrategy)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {biddingStrategies.map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Labeled>
              <Labeled label="Portfolio ID" hint="可选：已有组合ID则填写">
                <Input value={w.portfolioId || ""} onChange={(e) => set("portfolioId", e.target.value)} placeholder="可不填" />
              </Labeled>
              <Labeled label="End Date" hint="可选：YYYYMMDD">
                <Input value={w.endDate || ""} onChange={(e) => set("endDate", e.target.value)} placeholder="一般留空" />
              </Labeled>
            </div>
          </section>

          <Separator />

          <section className="grid gap-3">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">B. Bidding Adjustment（广告位加价，可选）</h3>
              <Badge variant="outline" className="font-mono text-[11px]">
                Entity: Bidding Adjustment
              </Badge>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <Labeled label="placementTop" hint="搜索结果顶部">
                <Input type="number" value={w.placementTopPct ?? 0} onChange={(e) => set("placementTopPct", Number(e.target.value || 0))} />
              </Labeled>
              <Labeled label="placementRestOfSearch" hint="搜索结果其余">
                <Input type="number" value={w.placementRestPct ?? 0} onChange={(e) => set("placementRestPct", Number(e.target.value || 0))} />
              </Labeled>
              <Labeled label="placementProductPage" hint="商品页面">
                <Input type="number" value={w.placementProductPagePct ?? 0} onChange={(e) => set("placementProductPagePct", Number(e.target.value || 0))} />
              </Labeled>
            </div>
            <p className="text-xs text-muted-foreground">范围 0-900；不想设置也可以保持0（或后续删掉该行）。</p>
          </section>

          <Separator />

          <section className="grid gap-3">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">C. Ad Group（广告组）</h3>
              <Badge variant="outline" className="font-mono text-[11px]">
                Entity: Ad Group
              </Badge>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Labeled label="Ad Group ID" hint="广告组关联ID（不是名称）；同一广告组下所有行保持一致" required>
                <Input value={w.adGroupId} onChange={(e) => set("adGroupId", e.target.value)} placeholder="如：SP-Exact-XXX" />
              </Labeled>
              <Labeled label="Ad Group Name" required>
                <Input value={w.adGroupName} onChange={(e) => set("adGroupName", e.target.value)} placeholder="如：SP-Exact-XXX" />
              </Labeled>
              <Labeled label="Ad Group Default Bid" hint="必填，但不影响关键词出价" required>
                <Input type="number" value={w.adGroupDefaultBid} onChange={(e) => set("adGroupDefaultBid", Number(e.target.value || 0))} />
              </Labeled>
              <Labeled label="Ad Group State" required>
                <Select value={w.adGroupState} onValueChange={(v) => set("adGroupState", v as State)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {stateOptions.map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Labeled>
            </div>
          </section>

          <Separator />

          <section className="grid gap-3">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">D. Product Ad（投放SKU）</h3>
              <Badge variant="outline" className="font-mono text-[11px]">
                Entity: Product Ad
              </Badge>
            </div>
            <Labeled label="SKU列表" hint="一行一个SKU" required>
              <Textarea
                value={w.skus.join("\n")}
                onChange={(e) => set("skus", normalizeLines(e.target.value))}
                className="min-h-[96px] font-mono text-[13px]"
                placeholder="SKU-1\nSKU-2"
              />
            </Labeled>
            <p className="text-xs text-muted-foreground">支持批量粘贴：可直接从Excel复制整列SKU到此输入框。</p>
          </section>

          <Separator />

          {mode === "manual-keyword" && (
            <section className="grid gap-3">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold">E. Keyword（投放关键词）</h3>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="font-mono text-[11px]">
                    Entity: Keyword
                  </Badge>
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-2"
                    onClick={() =>
                      set("keywords", [...w.keywords, { text: "", matchType: "phrase", bid: 0.75, state: "enabled" }])
                    }
                  >
                    <Plus className="h-4 w-4" />
                    添加
                  </Button>
                </div>
              </div>

              <div className="overflow-auto rounded-lg border border-border/70">
                <div className="border-b border-border/70 bg-muted/30 p-3">
                  <div className="text-xs text-muted-foreground">
                    批量导入格式：`关键词` 或 `关键词,匹配方式,bid,state`（也支持Tab分隔；匹配方式支持 broad/phrase/exact 或 广泛/词组/精准）。
                  </div>
                  <div className="mt-2 grid gap-2 sm:grid-cols-[1fr_auto]">
                    <Textarea
                      value={keywordBulkInput}
                      onChange={(e) => setKeywordBulkInput(e.target.value)}
                      className="min-h-[84px] font-mono text-[12px]"
                      placeholder={"running shoes\nwomen shoes,phrase,0.75,enabled\nhiking boots\texact\t0.9\tpaused"}
                    />
                    <Button className="h-fit bg-sky-600 text-white hover:bg-sky-700 sm:self-end" onClick={importKeywordsFromBulkInput}>
                      批量导入关键词
                    </Button>
                  </div>
                </div>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="min-w-[260px]">Keyword Text</TableHead>
                      <TableHead className="min-w-[180px]">Match Type</TableHead>
                      <TableHead className="min-w-[120px]">Bid</TableHead>
                      <TableHead className="min-w-[160px]">State</TableHead>
                      <TableHead className="w-[1%]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {w.keywords.map((k, idx) => (
                      <TableRow key={idx}>
                        <TableCell>
                          <Input
                            value={k.text}
                            onChange={(e) =>
                              set(
                                "keywords",
                                w.keywords.map((x, i) => (i === idx ? { ...x, text: e.target.value } : x))
                              )
                            }
                            placeholder="keyword"
                          />
                        </TableCell>
                        <TableCell>
                          <Select
                            value={k.matchType}
                            onValueChange={(v) =>
                              set(
                                "keywords",
                                w.keywords.map((x, i) => (i === idx ? { ...x, matchType: v as any } : x))
                              )
                            }
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {keywordMatchOptions.map((o) => (
                                <SelectItem key={o.value} value={o.value}>
                                  {o.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            value={k.bid}
                            onChange={(e) =>
                              set(
                                "keywords",
                                w.keywords.map((x, i) => (i === idx ? { ...x, bid: Number(e.target.value || 0) } : x))
                              )
                            }
                          />
                        </TableCell>
                        <TableCell>
                          <Select
                            value={k.state}
                            onValueChange={(v) =>
                              set(
                                "keywords",
                                w.keywords.map((x, i) => (i === idx ? { ...x, state: v as State } : x))
                              )
                            }
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {stateOptions.map((o) => (
                                <SelectItem key={o.value} value={o.value}>
                                  {o.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() =>
                              set(
                                "keywords",
                                w.keywords.filter((_, i) => i !== idx).length
                                  ? w.keywords.filter((_, i) => i !== idx)
                                  : [{ text: "", matchType: "exact", bid: 0.75, state: "enabled" }]
                              )
                            }
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </section>
          )}

          {(mode === "auto" || mode === "manual-product-targeting") && (
            <section className="grid gap-3">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold">E. Product Targeting（{mode === "auto" ? "自动投放类型" : "商品定位"}）</h3>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="font-mono text-[11px]">
                    Entity: Product Targeting
                  </Badge>
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-2"
                    onClick={() =>
                      set("productTargetings", [...w.productTargetings, { expression: 'asin="B0XXXXXXXX"', bid: 0.75, state: "enabled" }])
                    }
                  >
                    <Plus className="h-4 w-4" />
                    添加
                  </Button>
                </div>
              </div>

              <div className="overflow-auto rounded-lg border border-border/70">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="min-w-[320px]">Product Targeting Expression</TableHead>
                      <TableHead className="min-w-[120px]">Bid（可选）</TableHead>
                      <TableHead className="min-w-[160px]">State</TableHead>
                      <TableHead className="w-[1%]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {w.productTargetings.map((t, idx) => (
                      <TableRow key={idx}>
                        <TableCell>
                          <Input
                            value={t.expression}
                            onChange={(e) =>
                              set(
                                "productTargetings",
                                w.productTargetings.map((x, i) => (i === idx ? { ...x, expression: e.target.value } : x))
                              )
                            }
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            value={t.bid ?? ""}
                            onChange={(e) =>
                              set(
                                "productTargetings",
                                w.productTargetings.map((x, i) =>
                                  i === idx ? { ...x, bid: e.target.value === "" ? undefined : Number(e.target.value) } : x
                                )
                              )
                            }
                          />
                        </TableCell>
                        <TableCell>
                          <Select
                            value={t.state}
                            onValueChange={(v) =>
                              set(
                                "productTargetings",
                                w.productTargetings.map((x, i) => (i === idx ? { ...x, state: v as State } : x))
                              )
                            }
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {stateOptions.map((o) => (
                                <SelectItem key={o.value} value={o.value}>
                                  {o.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() =>
                              set(
                                "productTargetings",
                                w.productTargetings.filter((_, i) => i !== idx).length
                                  ? w.productTargetings.filter((_, i) => i !== idx)
                                  : [{ expression: "close-match", bid: 0.75, state: "enabled" }]
                              )
                            }
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {mode === "auto" && (
                <p className="text-xs text-muted-foreground">提示：自动广告默认会把4种投放都打开。建议在这里把不需要的3种设置为 paused。</p>
              )}
            </section>
          )}

          <Separator />

          <section className="grid gap-3">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">F. Negative Keyword（否词，可选）</h3>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="font-mono text-[11px]">
                  Entity: Negative Keyword
                </Badge>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-2"
                  onClick={() => set("negativeKeywords", [...w.negativeKeywords, { text: "", matchType: "negativePhrase", state: "enabled" }])}
                >
                  <Plus className="h-4 w-4" />
                  添加
                </Button>
              </div>
            </div>

            <div className="rounded-lg border border-border/70 bg-muted/25 p-3">
              <div className="text-xs text-muted-foreground">
                批量导入格式：`否词` 或 `否词,匹配方式,state`（也支持Tab分隔；匹配方式支持 negativePhrase/negativeExact 或 否定词组/否定精准）。
              </div>
              <div className="mt-2 grid gap-2 sm:grid-cols-[1fr_auto]">
                <Textarea
                  value={negativeKeywordBulkInput}
                  onChange={(e) => setNegativeKeywordBulkInput(e.target.value)}
                  className="min-h-[84px] font-mono text-[12px]"
                  placeholder={"bad keyword,negativePhrase,enabled\nanother keyword\tnegativeExact\tpaused"}
                />
                <Button className="h-fit bg-sky-600 text-white hover:bg-sky-700 sm:self-end" onClick={importNegativeKeywordsFromBulkInput}>
                  批量导入否词
                </Button>
              </div>
            </div>

            {w.negativeKeywords.length === 0 ? (
              <div className="rounded-lg border border-dashed border-border/70 p-4 text-sm text-muted-foreground">还没有否词。需要的话点“添加”。</div>
            ) : (
              <div className="overflow-auto rounded-lg border border-border/70">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="min-w-[260px]">Keyword Text</TableHead>
                      <TableHead className="min-w-[220px]">Match Type</TableHead>
                      <TableHead className="min-w-[160px]">State</TableHead>
                      <TableHead className="w-[1%]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {w.negativeKeywords.map((nk, idx) => (
                      <TableRow key={idx}>
                        <TableCell>
                          <Input
                            value={nk.text}
                            onChange={(e) => set("negativeKeywords", w.negativeKeywords.map((x, i) => (i === idx ? { ...x, text: e.target.value } : x)))}
                            placeholder="negative keyword"
                          />
                        </TableCell>
                        <TableCell>
                          <Select
                            value={nk.matchType}
                            onValueChange={(v) => set("negativeKeywords", w.negativeKeywords.map((x, i) => (i === idx ? { ...x, matchType: v as any } : x)))}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {negMatchOptions.map((o) => (
                                <SelectItem key={o.value} value={o.value}>
                                  {o.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell>
                          <Select
                            value={nk.state}
                            onValueChange={(v) => set("negativeKeywords", w.negativeKeywords.map((x, i) => (i === idx ? { ...x, state: v as State } : x)))}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {stateOptions.map((o) => (
                                <SelectItem key={o.value} value={o.value}>
                                  {o.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell>
                          <Button variant="ghost" size="icon" onClick={() => set("negativeKeywords", w.negativeKeywords.filter((_, i) => i !== idx))}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}

            <p className="text-xs text-muted-foreground">否词建议：词组否定不超过4个单词；精准否定不超过10个单词（否则可能报错）。</p>
          </section>

          <Separator />

          <section className="grid gap-3">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">G. Negative Product Targeting（否定ASIN/类目，可选）</h3>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="font-mono text-[11px]">
                  Entity: Negative Product Targeting
                </Badge>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-2"
                  onClick={() =>
                    set("negativeProductTargetings", [...w.negativeProductTargetings, { expression: 'asin="B0XXXXXXXX"', state: "enabled" }])
                  }
                >
                  <Plus className="h-4 w-4" />
                  添加
                </Button>
              </div>
            </div>

            <div className="rounded-lg border border-border/70 bg-muted/25 p-3">
              <div className="text-xs text-muted-foreground">
                批量导入格式：`Product Targeting Expression` 或 `Product Targeting Expression,state`（也支持Tab分隔）。
              </div>
              <div className="mt-2 grid gap-2 sm:grid-cols-[1fr_auto]">
                <Textarea
                  value={negativeProductTargetingBulkInput}
                  onChange={(e) => setNegativeProductTargetingBulkInput(e.target.value)}
                  className="min-h-[84px] font-mono text-[12px]"
                  placeholder={'asin="B0XXXXXXXX",enabled\nasin-expanded="B0YYYYYYYY"\tpaused'}
                />
                <Button className="h-fit bg-sky-600 text-white hover:bg-sky-700 sm:self-end" onClick={importNegativeProductTargetingsFromBulkInput}>
                  批量导入否定ASIN
                </Button>
              </div>
            </div>

            {w.negativeProductTargetings.length === 0 ? (
              <div className="rounded-lg border border-dashed border-border/70 p-4 text-sm text-muted-foreground">还没有否定ASIN。需要的话点“添加”。</div>
            ) : (
              <div className="overflow-auto rounded-lg border border-border/70">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="min-w-[360px]">Product Targeting Expression</TableHead>
                      <TableHead className="min-w-[160px]">State</TableHead>
                      <TableHead className="w-[1%]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {w.negativeProductTargetings.map((npt, idx) => (
                      <TableRow key={idx}>
                        <TableCell>
                          <Input
                            value={npt.expression}
                            onChange={(e) =>
                              set(
                                "negativeProductTargetings",
                                w.negativeProductTargetings.map((x, i) => (i === idx ? { ...x, expression: e.target.value } : x))
                              )
                            }
                            placeholder={'asin="B0XXXXXXXX"'}
                          />
                        </TableCell>
                        <TableCell>
                          <Select
                            value={npt.state}
                            onValueChange={(v) =>
                              set(
                                "negativeProductTargetings",
                                w.negativeProductTargetings.map((x, i) => (i === idx ? { ...x, state: v as State } : x))
                              )
                            }
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {stateOptions.map((o) => (
                                <SelectItem key={o.value} value={o.value}>
                                  {o.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => set("negativeProductTargetings", w.negativeProductTargetings.filter((_, i) => i !== idx))}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
            <p className="text-xs text-muted-foreground">说明：使用同一主表字段 `Product Targeting Expression`，通过 Entity=Negative Product Targeting 区分为否定ASIN。</p>
          </section>
        </div>
        )}
      </TabsContent>
    </Tabs>
  );
}

function SbWizardUI({
  w,
  setW,
}: {
  w: SbCampaignWizard;
  setW: (updater: (prev: SbCampaignWizard) => SbCampaignWizard) => void;
}) {
  const [keywordBulkInput, setKeywordBulkInput] = useState("");

  function set<K extends keyof SbCampaignWizard>(key: K, value: SbCampaignWizard[K]) {
    setW((prev) => ({ ...prev, [key]: value }));
  }

  function importSbKeywordsFromBulkInput() {
    const { rows, invalidCount } = parseSpKeywordBulk(keywordBulkInput, 0.1);
    if (!rows.length) {
      toast.error("没有可导入的关键词", { description: "请按行粘贴，至少包含关键词文本。" });
      return;
    }

    const current = w.keywords.filter((k) => k.text.trim());
    set("keywords", [...current, ...rows]);
    setKeywordBulkInput("");
    toast.success(`已导入 ${rows.length} 条关键词`, {
      description: invalidCount > 0 ? `其中 ${invalidCount} 行格式无效已跳过。` : "你可以在下方表格继续编辑。",
    });
  }

  return (
    <div className="grid gap-5">
      <section className="grid gap-3">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold">A. Campaign（品牌推广广告活动）</h3>
          <Badge variant="outline" className="font-mono text-[11px]">
            Sheet: Sponsored Brands Campaigns
          </Badge>
        </div>
        <div className="text-xs text-muted-foreground">说明：导出时会自动填充 Entity 与 Operation=Create，ID字段用于层级关联，不是名称字段。</div>

        <div className="grid gap-3 sm:grid-cols-2">
          <Labeled label="Campaign ID" hint="广告活动关联ID（不是名称）；同一活动下所有行保持一致" required>
            <Input value={w.campaignId} onChange={(e) => set("campaignId", e.target.value)} placeholder="如：SB-KW-XXX" />
          </Labeled>
          <Labeled label="Campaign Name" required>
            <Input value={w.campaignName} onChange={(e) => set("campaignName", e.target.value)} placeholder="如：SB-KW-XXX" />
          </Labeled>
          <Labeled label="Start Date" hint="YYYYMMDD" required>
            <Input value={w.startDate} onChange={(e) => set("startDate", e.target.value)} />
          </Labeled>
          <Labeled label="End Date" hint="可选 YYYYMMDD">
            <Input value={w.endDate || ""} onChange={(e) => set("endDate", e.target.value)} />
          </Labeled>
          <Labeled label="State" required>
            <Select value={w.state} onValueChange={(v) => set("state", v as State)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {stateOptions.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Labeled>
          <Labeled label="Portfolio ID" hint="可选">
            <Input value={w.portfolioId || ""} onChange={(e) => set("portfolioId", e.target.value)} placeholder="可不填" />
          </Labeled>
          <Labeled label="Budget Type" required>
            <Select value={w.budgetType} onValueChange={(v) => set("budgetType", v as any)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="daily">daily</SelectItem>
                <SelectItem value="lifetime">lifetime</SelectItem>
              </SelectContent>
            </Select>
          </Labeled>
          <Labeled label="Budget" required>
            <Input type="number" value={w.budget} onChange={(e) => set("budget", Number(e.target.value || 0))} />
          </Labeled>
        </div>
      </section>

      <Separator />

      <section className="grid gap-3">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold">B. Ad Group（广告组）</h3>
          <Badge variant="outline" className="font-mono text-[11px]">
            Entity: Ad Group
          </Badge>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Labeled label="Ad Group ID" hint="广告组关联ID（不是名称）；同一广告组下所有行保持一致" required>
            <Input value={w.adGroupId} onChange={(e) => set("adGroupId", e.target.value)} placeholder="如：SB-KW-XXX" />
          </Labeled>
          <div />
        </div>
      </section>

      <Separator />

      <section className="grid gap-3">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold">C. 创意与落地页</h3>
          <Badge variant="outline" className="font-mono text-[11px]">
            Ad Format / Landing Page / Creative
          </Badge>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <Labeled label="Ad Format" hint="不同SB类型会不同" required>
            <Input value={w.adFormat} onChange={(e) => set("adFormat", e.target.value)} placeholder="例如：productCollection" />
          </Labeled>
          <Labeled label="Landing Page URL" hint="可选（与ASIN二选一或都填）">
            <Input value={w.landingPageUrl || ""} onChange={(e) => set("landingPageUrl", e.target.value)} placeholder="https://..." />
          </Labeled>
          <Labeled label="Landing Page ASINs" hint="一行一个ASIN（可选）">
            <Textarea
              value={w.landingPageAsins.join("\n")}
              onChange={(e) => set("landingPageAsins", normalizeLines(e.target.value))}
              className="min-h-[80px] font-mono text-[13px]"
              placeholder="B0XXXXXXX\nB0YYYYYYY"
            />
          </Labeled>
          <Labeled label="Creative Headline" required>
            <Input value={w.creativeHeadline} onChange={(e) => set("creativeHeadline", e.target.value)} placeholder="标题文案" />
          </Labeled>
          <Labeled label="Creative ASINs" hint="一行一个ASIN" required>
            <Textarea
              value={w.creativeAsins.join("\n")}
              onChange={(e) => set("creativeAsins", normalizeLines(e.target.value))}
              className="min-h-[80px] font-mono text-[13px]"
              placeholder="B0XXXXXXX\nB0YYYYYYY"
            />
          </Labeled>
          <Labeled label="Brand Entity ID" hint="可选">
            <Input value={w.brandEntityId || ""} onChange={(e) => set("brandEntityId", e.target.value)} />
          </Labeled>
          <Labeled label="Brand Name" hint="可选">
            <Input value={w.brandName || ""} onChange={(e) => set("brandName", e.target.value)} />
          </Labeled>
          <Labeled label="Brand Logo Asset ID" hint="可选">
            <Input value={w.brandLogoAssetId || ""} onChange={(e) => set("brandLogoAssetId", e.target.value)} />
          </Labeled>
          <Labeled label="Custom Image Asset ID" hint="可选">
            <Input value={w.customImageAssetId || ""} onChange={(e) => set("customImageAssetId", e.target.value)} />
          </Labeled>
        </div>
      </section>

      <Separator />

      <section className="grid gap-3">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold">D. Keyword（投放关键词）</h3>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="font-mono text-[11px]">
              Entity: Keyword
            </Badge>
            <Button
              variant="outline"
              size="sm"
              className="gap-2"
              onClick={() => set("keywords", [...w.keywords, { text: "", matchType: "phrase", bid: 0.1, state: "enabled" }])}
            >
              <Plus className="h-4 w-4" />
              添加
            </Button>
          </div>
        </div>

        <div className="rounded-lg border border-border/70 bg-muted/20 p-3">
          <div className="text-xs text-muted-foreground">
            批量输入：可直接粘贴多行关键词，支持 `关键词` 或 `关键词,匹配方式,bid,state`（支持 Tab 分隔）。
          </div>
          <Textarea
            value={keywordBulkInput}
            onChange={(e) => setKeywordBulkInput(e.target.value)}
            className="mt-2 min-h-[84px] font-mono text-[12px]"
            placeholder={"running shoes\nbrand keyword,phrase,0.1,enabled"}
          />
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Button size="sm" variant="outline" onClick={importSbKeywordsFromBulkInput}>
              批量导入关键词
            </Button>
          </div>
        </div>

        <div className="overflow-auto rounded-lg border border-border/70">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="min-w-[260px]">Keyword Text</TableHead>
                <TableHead className="min-w-[180px]">Match Type</TableHead>
                <TableHead className="min-w-[120px]">Bid</TableHead>
                <TableHead className="min-w-[160px]">State</TableHead>
                <TableHead className="w-[1%]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {w.keywords.map((k, idx) => (
                <TableRow key={idx}>
                  <TableCell>
                    <Input
                      value={k.text}
                      onChange={(e) => set("keywords", w.keywords.map((x, i) => (i === idx ? { ...x, text: e.target.value } : x)))}
                      placeholder="keyword"
                    />
                  </TableCell>
                  <TableCell>
                    <Select
                      value={k.matchType}
                      onValueChange={(v) =>
                        set("keywords", w.keywords.map((x, i) => (i === idx ? { ...x, matchType: v as any } : x)))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="broad">broad（广泛）</SelectItem>
                        <SelectItem value="phrase">phrase（词组）</SelectItem>
                        <SelectItem value="exact">exact（精准）</SelectItem>
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>
                    <Input
                      type="number"
                      value={k.bid}
                      onChange={(e) =>
                        set("keywords", w.keywords.map((x, i) => (i === idx ? { ...x, bid: Number(e.target.value || 0) } : x)))
                      }
                    />
                  </TableCell>
                  <TableCell>
                    <Select
                      value={k.state}
                      onValueChange={(v) => set("keywords", w.keywords.map((x, i) => (i === idx ? { ...x, state: v as State } : x)))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {stateOptions.map((o) => (
                          <SelectItem key={o.value} value={o.value}>
                            {o.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        const next = w.keywords.filter((_, i) => i !== idx);
                        set("keywords", next.length ? next : [{ text: "", matchType: "exact", bid: 0.1, state: "enabled" }]);
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        <div className="rounded-lg border border-border/70 bg-muted/30 p-3 text-xs text-muted-foreground">
          提示：SB的字段（Ad Format、品牌资产ID等）会随账户与广告类型变化；如上传报错，请依据报错信息补齐对应字段或调整取值规则。
        </div>
      </section>
    </div>
  );
}

function SdWizardUI({
  w,
  setW,
}: {
  w: SdCampaignWizard;
  setW: (updater: (prev: SdCampaignWizard) => SdCampaignWizard) => void;
}) {
  const [targetingBulkInput, setTargetingBulkInput] = useState("");

  function set<K extends keyof SdCampaignWizard>(key: K, value: SdCampaignWizard[K]) {
    setW((prev) => ({ ...prev, [key]: value }));
  }

  function importSdTargetingsFromBulkInput() {
    const { rows, invalidCount } = parseSdTargetingBulk(targetingBulkInput, w.adGroupDefaultBid || 0.75);
    if (!rows.length) {
      toast.error("没有可导入的 ASIN/定向", { description: "请按行粘贴 ASIN 或 Targeting Expression。" });
      return;
    }

    const current = w.targetings.filter((x) => x.expression.trim());
    set("targetings", [...current, ...rows]);
    setTargetingBulkInput("");
    toast.success(`已导入 ${rows.length} 条定向`, {
      description: invalidCount > 0 ? `其中 ${invalidCount} 行格式无效已跳过。` : "你可以在下方表格继续编辑。",
    });
  }

  return (
    <div className="grid gap-5">
      <section className="grid gap-3">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold">A. Campaign（展示型广告活动）</h3>
          <Badge variant="outline" className="font-mono text-[11px]">
            Sheet: Sponsored Display Campaigns
          </Badge>
        </div>

        <div className="text-xs text-muted-foreground">说明：导出时会自动填充 Entity 与 Operation=Create，ID字段用于层级关联，不是名称字段。</div>

        <div className="grid gap-3 sm:grid-cols-2">
          <Labeled label="Campaign ID" hint="广告活动关联ID（不是名称）；同一活动下所有行保持一致" required>
            <Input value={w.campaignId} onChange={(e) => set("campaignId", e.target.value)} placeholder="如：SD-PT-XXX" />
          </Labeled>
          <Labeled label="Campaign Name" required>
            <Input value={w.campaignName} onChange={(e) => set("campaignName", e.target.value)} placeholder="如：SD-PT-XXX" />
          </Labeled>
          <Labeled label="Start Date" hint="YYYYMMDD" required>
            <Input value={w.startDate} onChange={(e) => set("startDate", e.target.value)} />
          </Labeled>
          <Labeled label="End Date" hint="可选 YYYYMMDD">
            <Input value={w.endDate || ""} onChange={(e) => set("endDate", e.target.value)} />
          </Labeled>
          <Labeled label="State" required>
            <Select value={w.state} onValueChange={(v) => set("state", v as State)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {stateOptions.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Labeled>
          <Labeled label="Portfolio ID" hint="可选">
            <Input value={w.portfolioId || ""} onChange={(e) => set("portfolioId", e.target.value)} placeholder="可不填" />
          </Labeled>
          <Labeled label="Tactic" hint="不同SD场景对应不同代码" required>
            <Input value={w.tactic} onChange={(e) => set("tactic", e.target.value)} placeholder="如：T00030" />
          </Labeled>
          <Labeled label="Budget Type" required>
            <Select value={w.budgetType} onValueChange={(v) => set("budgetType", v as any)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="daily">daily</SelectItem>
                <SelectItem value="lifetime">lifetime</SelectItem>
              </SelectContent>
            </Select>
          </Labeled>
          <Labeled label="Budget" required>
            <Input type="number" value={w.budget} onChange={(e) => set("budget", Number(e.target.value || 0))} />
          </Labeled>
        </div>
      </section>

      <Separator />

      <section className="grid gap-3">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold">B. Ad Group（广告组）</h3>
          <Badge variant="outline" className="font-mono text-[11px]">
            Entity: Ad Group
          </Badge>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <Labeled label="Ad Group ID" hint="广告组关联ID（不是名称）；同一广告组下所有行保持一致" required>
            <Input value={w.adGroupId} onChange={(e) => set("adGroupId", e.target.value)} />
          </Labeled>
          <Labeled label="Ad Group Name" required>
            <Input value={w.adGroupName} onChange={(e) => set("adGroupName", e.target.value)} />
          </Labeled>
          <Labeled label="Ad Group Default Bid" required>
            <Input type="number" value={w.adGroupDefaultBid} onChange={(e) => set("adGroupDefaultBid", Number(e.target.value || 0))} />
          </Labeled>
        </div>
      </section>

      <Separator />

      <section className="grid gap-3">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold">C. Ad（投放SKU）</h3>
          <Badge variant="outline" className="font-mono text-[11px]">
            Entity: Ad
          </Badge>
        </div>
        <Labeled label="SKU列表" hint="一行一个SKU" required>
          <Textarea
            value={w.skus.join("\n")}
            onChange={(e) => set("skus", normalizeLines(e.target.value))}
            className="min-h-[96px] font-mono text-[13px]"
            placeholder="SKU-1\nSKU-2"
          />
        </Labeled>
      </section>

      <Separator />

      <section className="grid gap-3">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold">D. Targeting（投放目标）</h3>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="font-mono text-[11px]">
              Entity: Targeting
            </Badge>
            <Button
              variant="outline"
              size="sm"
              className="gap-2"
              onClick={() => set("targetings", [...w.targetings, { expression: 'asin-expanded="B0XXXXXXXX"', bid: 0.75, state: "enabled" }])}
            >
              <Plus className="h-4 w-4" />
              添加
            </Button>
          </div>
        </div>

        <div className="rounded-lg border border-border/70 bg-muted/20 p-3">
          <div className="text-xs text-muted-foreground">
            批量输入：可直接粘贴多行 ASIN 或 Targeting Expression，支持 `ASIN`、`asin-expanded="B0..."` 或 `表达式,bid,state`（支持 Tab 分隔）。
          </div>
          <Textarea
            value={targetingBulkInput}
            onChange={(e) => setTargetingBulkInput(e.target.value)}
            className="mt-2 min-h-[84px] font-mono text-[12px]"
            placeholder={'B0XXXXXXXX\nasin-expanded="B0YYYYYYYY",0.75,enabled'}
          />
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Button size="sm" variant="outline" onClick={importSdTargetingsFromBulkInput}>
              批量导入 ASIN / 定向
            </Button>
          </div>
        </div>

        <div className="overflow-auto rounded-lg border border-border/70">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="min-w-[340px]">Targeting Expression</TableHead>
                <TableHead className="min-w-[120px]">Bid（可选）</TableHead>
                <TableHead className="min-w-[160px]">State</TableHead>
                <TableHead className="w-[1%]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {w.targetings.map((t, idx) => (
                <TableRow key={idx}>
                  <TableCell>
                    <Input value={t.expression} onChange={(e) => set("targetings", w.targetings.map((x, i) => (i === idx ? { ...x, expression: e.target.value } : x)))} />
                  </TableCell>
                  <TableCell>
                    <Input
                      type="number"
                      value={t.bid ?? ""}
                      onChange={(e) =>
                        set(
                          "targetings",
                          w.targetings.map((x, i) => (i === idx ? { ...x, bid: e.target.value === "" ? undefined : Number(e.target.value) } : x))
                        )
                      }
                    />
                  </TableCell>
                  <TableCell>
                    <Select value={t.state} onValueChange={(v) => set("targetings", w.targetings.map((x, i) => (i === idx ? { ...x, state: v as State } : x)))}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {stateOptions.map((o) => (
                          <SelectItem key={o.value} value={o.value}>
                            {o.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>
                    <Button variant="ghost" size="icon" onClick={() => set("targetings", w.targetings.filter((_, i) => i !== idx))}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <Labeled label="Bid Optimization" hint="可选（不同账户可能会用到）">
            <Input value={w.bidOptimization || ""} onChange={(e) => set("bidOptimization", e.target.value)} placeholder="可留空" />
          </Labeled>
          <Labeled label="Cost Type" hint="可选（不同账户可能会用到）">
            <Input value={w.costType || ""} onChange={(e) => set("costType", e.target.value)} placeholder="可留空" />
          </Labeled>
        </div>
      </section>

      <div className="rounded-lg border border-border/70 bg-muted/30 p-3 text-xs text-muted-foreground">
        提示：SD的Tactic/Targeting Expression与账户、站点、投放类型相关；如上传报错，请按报错提示补齐字段并修正校验规则。
      </div>
    </div>
  );
}

function PortfolioWizardUI({
  w,
  setW,
}: {
  w: PortfolioWizard;
  setW: (updater: (prev: PortfolioWizard) => PortfolioWizard) => void;
}) {
  function set<K extends keyof PortfolioWizard>(key: K, value: PortfolioWizard[K]) {
    setW((prev) => ({ ...prev, [key]: value }));
  }

  return (
    <div className="grid gap-5">
      <section className="grid gap-3">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold">Portfolio（广告组合）</h3>
          <Badge variant="outline" className="font-mono text-[11px]">
            Sheet: Portfolios
          </Badge>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <Labeled label="Operation" required>
            <Select value={w.operation} onValueChange={(v) => set("operation", v as any)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Create">Create</SelectItem>
                <SelectItem value="Update">Update</SelectItem>
                <SelectItem value="Archive">Archive</SelectItem>
              </SelectContent>
            </Select>
          </Labeled>
          <div />
          <Labeled label="Portfolio ID" required>
            <Input value={w.portfolioId} onChange={(e) => set("portfolioId", e.target.value)} placeholder="如：PORT-001" />
          </Labeled>
          <Labeled label="Portfolio Name" hint="Archive时可留空" required={w.operation !== "Archive"}>
            <Input value={w.portfolioName} onChange={(e) => set("portfolioName", e.target.value)} placeholder="如：旺季主推" />
          </Labeled>

          <Labeled label="Budget Amount" hint="可选">
            <Input type="number" value={w.budgetAmount ?? ""} onChange={(e) => set("budgetAmount", e.target.value === "" ? undefined : Number(e.target.value))} />
          </Labeled>
          <Labeled label="Budget Currency Code" hint="可选">
            <Input value={w.budgetCurrencyCode ?? ""} onChange={(e) => set("budgetCurrencyCode", e.target.value)} placeholder="USD" />
          </Labeled>
          <Labeled label="Budget Policy" hint="可选">
            <Input value={w.budgetPolicy ?? ""} onChange={(e) => set("budgetPolicy", e.target.value)} placeholder="daily" />
          </Labeled>
          <div />
          <Labeled label="Budget Start Date" hint="可选 YYYYMMDD">
            <Input value={w.budgetStartDate ?? ""} onChange={(e) => set("budgetStartDate", e.target.value)} />
          </Labeled>
          <Labeled label="Budget End Date" hint="可选 YYYYMMDD">
            <Input value={w.budgetEndDate ?? ""} onChange={(e) => set("budgetEndDate", e.target.value)} />
          </Labeled>
        </div>
      </section>

      <div className="rounded-lg border border-border/70 bg-muted/30 p-3 text-xs text-muted-foreground">
        提示：Portfolio通常用于把多个广告活动归类到同一个“组合”里，并按组合维度做预算控制。
      </div>
    </div>
  );
}

function Labeled({
  label,
  hint,
  required,
  labelClassName,
  children,
}: {
  label: string;
  hint?: string;
  required?: boolean;
  labelClassName?: string;
  children: ReactNode;
}) {
  return (
    <div className="grid gap-1.5">
      <div className="flex items-center gap-2">
        <div className={cn("text-sm font-medium", labelClassName)}>
          {label}
          {required && <span className="text-destructive"> *</span>}
        </div>
        {hint && <div className="text-xs text-muted-foreground">{hint}</div>}
      </div>
      {children}
    </div>
  );
}
