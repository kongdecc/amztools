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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

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

type SingleSpUiMode = SpCampaignWizard["mode"];
type SpUiMode = SingleSpUiMode | "visual-batch";

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
  placementAmazonBusinessPct?: number;
  audienceId: string;
  shopperCohortPercentage?: number;
  shopperCohortType: string;
  sites: string[];
  adGroups: SpBatchAdGroupDraft[];
};

type SpBatchDraft = {
  campaigns: SpBatchCampaignDraft[];
};

type PositiveKeywordMatchType = Exclude<SpMatchType, "negativeExact" | "negativePhrase">;
type NegativeKeywordMatchType = Extract<SpMatchType, "negativeExact" | "negativePhrase">;
type SpKeywordUiRow = {
  text: string;
  matchType: PositiveKeywordMatchType;
  bid: number;
  state: State;
};
type BatchBidRuleMode = "keep" | "fixed" | "list" | "step";
type AutoTargetingType = "close-match" | "loose-match" | "substitutes" | "complements";
type ProductTargetingExpandMode = "exact" | "expanded";
type ProductTargetingInputMode = "asin" | "category";
type ProductTargetingUiType = "asin" | "category" | "custom";
type BatchBidRuleConfig = {
  mode: BatchBidRuleMode;
  value: number;
  listText: string;
  step: number;
};

type SpBatchDuplicateDialogState = {
  open: boolean;
  sourceIndex: number | null;
  sourceCampaign: SpBatchCampaignDraft | null;
  count: number;
  startNumber: number;
  digits: number;
  separator: string;
  campaignNamePrefix: string;
  campaignIdPrefix: string;
  adGroupNamePrefix: string;
  adGroupIdPrefix: string;
  adGroupBidMode: BatchBidRuleMode;
  adGroupBidValue: number;
  adGroupBidList: string;
  adGroupBidStep: number;
  primaryBidMode: BatchBidRuleMode;
  primaryBidValue: number;
  primaryBidList: string;
  primaryBidStep: number;
  autoBidRules: Record<AutoTargetingType, BatchBidRuleConfig>;
};

type DuplicateDialogStepField = "adGroupBidStep" | "primaryBidStep" | `autoBidRules.${AutoTargetingType}.step`;

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
  "Audience ID": "受众ID",
  "Shopper Cohort Percentage": "受众比例",
  "Shopper Cohort Type": "受众类型",
  Sites: "站点限制",
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
  "Audience ID",
  "Shopper Cohort Percentage",
  "Shopper Cohort Type",
  "Sites",
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

function Crosshair({ className }: { className?: string }) {
  return (
    <IconBase className={className}>
      <circle cx="12" cy="12" r="6" />
      <path d="M12 2v3" />
      <path d="M12 19v3" />
      <path d="M2 12h3" />
      <path d="M19 12h3" />
    </IconBase>
  );
}

function SplitTree({ className }: { className?: string }) {
  return (
    <IconBase className={className}>
      <path d="M12 4v6" />
      <path d="M6 20v-4" />
      <path d="M18 20v-4" />
      <path d="M12 10v3" />
      <path d="M12 13H6v3" />
      <path d="M12 13h6v3" />
      <circle cx="12" cy="4" r="1.5" />
      <circle cx="6" cy="20" r="1.5" />
      <circle cx="18" cy="20" r="1.5" />
    </IconBase>
  );
}

function KeywordGenerationButton({
  icon,
  label,
  hint,
  className,
  onClick,
  disabled,
}: {
  icon: ReactNode;
  label: string;
  hint: string;
  className?: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <Button
      size="sm"
      className={cn("h-auto min-h-[46px] justify-start px-3 py-2 text-left whitespace-normal", className)}
      onClick={onClick}
      disabled={disabled}
    >
      <span className="flex items-start gap-2">
        <span className="mt-0.5 shrink-0">{icon}</span>
        <span className="block">
          <span className="block text-sm font-semibold leading-none">{label}</span>
          <span className="mt-1 block text-[10px] leading-tight opacity-90">{hint}</span>
        </span>
      </span>
    </Button>
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
  text: string,
  fallbackMatchType: NegativeKeywordMatchType = "negativePhrase"
): {
  rows: Array<{ text: string; matchType: NegativeKeywordMatchType; state: State }>;
  invalidCount: number;
} {
  const rows: Array<{ text: string; matchType: NegativeKeywordMatchType; state: State }> = [];
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

    const matchType = parseNegativeMatchType(parts[1]) ?? fallbackMatchType;
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
  const parsed = parseSpProductTargetingBulk(text, 0.75).rows.filter((row) => isAutoTargetingExpression(row.expression));
  if (parsed.length) return parsed;
  return createDefaultAutoTargetingRows(0.75);
}

function toAutoTargetingText(rows: Array<{ expression: string; bid: number; state: State }>) {
  return rows.map((x) => `${x.expression},${x.bid},${x.state}`).join("\n");
}

function parseKeywordRowsForUi(
  text: string,
  fallbackBid: number
): SpKeywordUiRow[] {
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
    .filter((x): x is SpKeywordUiRow => !!x);
  if (rows.length) return rows;
  return [{ text: "", matchType: "exact", bid: fallbackBid, state: "enabled" }];
}

function toKeywordRowsText(rows: SpKeywordUiRow[]) {
  return rows.map((x) => `${x.text},${x.matchType},${x.bid},${x.state}`).join("\n");
}

function expandKeywordTextByMatchTypes(
  text: string,
  fallbackBid: number,
  defaultMatchTypes: Array<PositiveKeywordMatchType>
) {
  const rows: Array<{ text: string; matchType: PositiveKeywordMatchType; bid: number; state: State }> = [];
  const effectiveMatchTypes: Array<PositiveKeywordMatchType> = defaultMatchTypes.length
    ? defaultMatchTypes
    : ["exact"];
  for (const line of text.split(/\r?\n/)) {
    const raw = line.trim();
    if (!raw) continue;
    const parts = raw.includes("\t") ? raw.split("\t").map((x) => x.trim()) : raw.split(",").map((x) => x.trim());
    const keywordText = parts[0] || "";
    if (!keywordText) continue;
    const explicitMatchType = parseKeywordMatchType(parts[1]);
    const bidParsed = Number(parts[2]);
    const bid = Number.isFinite(bidParsed) && bidParsed > 0 ? bidParsed : fallbackBid;
    const state = parseState(parts[3]) ?? "enabled";
    if (explicitMatchType) {
      rows.push({ text: keywordText, matchType: explicitMatchType, bid, state });
      continue;
    }
    effectiveMatchTypes.forEach((matchType) => {
      rows.push({ text: keywordText, matchType, bid, state });
    });
  }
  return toKeywordRowsText(rows);
}

function createBatchBidRuleConfig(value = 0.75, step = -0.05): BatchBidRuleConfig {
  return {
    mode: "keep",
    value,
    listText: "",
    step,
  };
}

function createDefaultAutoBidRules(value = 0.75): Record<AutoTargetingType, BatchBidRuleConfig> {
  return {
    "close-match": createBatchBidRuleConfig(value),
    "loose-match": createBatchBidRuleConfig(value),
    substitutes: createBatchBidRuleConfig(value),
    complements: createBatchBidRuleConfig(value),
  };
}

function getAutoTargetingBidByExpression(source: SpBatchCampaignDraft, expression: AutoTargetingType) {
  const firstAdGroup = source.adGroups[0];
  if (!firstAdGroup) return 0.75;
  return parseSpProductTargetingBulk(firstAdGroup.productTargetingsText, firstAdGroup.adGroupDefaultBid).rows.find(
    (row) => row.expression === expression
  )?.bid ?? firstAdGroup.adGroupDefaultBid;
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

function mergeNegativeKeywordRowsText(
  baseText: string,
  incomingRows: Array<{ text: string; matchType: Extract<SpMatchType, "negativeExact" | "negativePhrase">; state: State }>
) {
  const merged = new Map<string, { text: string; matchType: Extract<SpMatchType, "negativeExact" | "negativePhrase">; state: State }>();
  for (const row of parseNegativeKeywordRowsForUi(baseText)) {
    if (!row.text.trim()) continue;
    merged.set(`${row.text.trim().toLowerCase()}::${row.matchType}`, row);
  }
  for (const row of incomingRows) {
    if (!row.text.trim()) continue;
    merged.set(`${row.text.trim().toLowerCase()}::${row.matchType}`, row);
  }
  return toNegativeKeywordRowsText(Array.from(merged.values()));
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

function buildProductTargetingExpressionFromAsin(asin: string, mode: ProductTargetingExpandMode) {
  const normalized = asin.trim();
  if (!normalized) return "";
  return mode === "exact" ? `asin="${normalized}"` : `asin-expanded="${normalized}"`;
}

function buildProductTargetingExpressionFromCategory(categoryId: string) {
  const normalized = categoryId.trim();
  if (!normalized) return "";
  return `category="${normalized}"`;
}

function getProductTargetingExpandModes(
  values: Array<ProductTargetingExpandMode> | undefined,
  fallback: Array<ProductTargetingExpandMode> = ["expanded"]
) {
  return values && values.length ? values : fallback;
}

function parseProductTargetingExpression(expression: string): {
  targetType: ProductTargetingUiType;
  value: string;
  expandMode?: ProductTargetingExpandMode;
} {
  const raw = expression.trim();
  const exactAsin = /^asin="([^"]+)"$/i.exec(raw);
  if (exactAsin) return { targetType: "asin", value: exactAsin[1], expandMode: "exact" };
  const expandedAsin = /^asin-expanded="([^"]+)"$/i.exec(raw);
  if (expandedAsin) return { targetType: "asin", value: expandedAsin[1], expandMode: "expanded" };
  const category = /^category="?([^"]+)"?$/i.exec(raw);
  if (category) return { targetType: "category", value: category[1] };
  return { targetType: "custom", value: raw };
}

function buildProductTargetingExpressionFromUiRow(row: {
  targetType: ProductTargetingUiType;
  value: string;
  expandMode?: ProductTargetingExpandMode;
}) {
  if (row.targetType === "asin") return buildProductTargetingExpressionFromAsin(row.value, row.expandMode ?? "expanded");
  if (row.targetType === "category") return buildProductTargetingExpressionFromCategory(row.value);
  return row.value.trim();
}

function buildProductTargetingTextFromInput(
  text: string,
  fallbackBid: number,
  inputMode: ProductTargetingInputMode,
  expandModes: Array<ProductTargetingExpandMode>
) {
  const rows: Array<{ expression: string; bid: number; state: State }> = [];
  const effectiveModes = getProductTargetingExpandModes(expandModes);
  for (const line of text.split(/\r?\n/)) {
    const raw = line.trim();
    if (!raw) continue;
    const parts = raw.includes("\t") ? raw.split("\t").map((x) => x.trim()) : raw.split(",").map((x) => x.trim());
    const firstValue = parts[0] || "";
    if (!firstValue) continue;
    const bidParsed = Number(parts[1]);
    const bid = Number.isFinite(bidParsed) && bidParsed > 0 ? bidParsed : fallbackBid;
    const state = parseState(parts[2]) ?? "enabled";
    if (/^(asin(?:-expanded)?|category)=/i.test(firstValue)) {
      rows.push({ expression: firstValue, bid, state });
      continue;
    }
    if (inputMode === "category") {
      rows.push({
        expression: buildProductTargetingExpressionFromCategory(firstValue),
        bid,
        state,
      });
      continue;
    }
    effectiveModes.forEach((mode) => {
      rows.push({
        expression: buildProductTargetingExpressionFromAsin(firstValue, mode),
        bid,
        state,
      });
    });
  }
  return toProductTargetingRowsText(rows);
}

function parseProductTargetingRowsForUi(
  text: string,
  fallbackBid: number
): Array<{ targetType: ProductTargetingUiType; value: string; expandMode?: ProductTargetingExpandMode; bid: number; state: State }> {
  const rows = text
    .split(/\r?\n/)
    .map((line) => {
      const raw = line.trim();
      if (!raw) return null;
      const parts = raw.includes("\t") ? raw.split("\t").map((x) => x.trim()) : raw.split(",").map((x) => x.trim());
      const bidParsed = Number(parts[1]);
      const parsed = parseProductTargetingExpression(parts[0] ?? "");
      return {
        ...parsed,
        bid: Number.isFinite(bidParsed) && bidParsed > 0 ? bidParsed : fallbackBid,
        state: parseState(parts[2]) ?? "enabled",
      };
    })
    .filter((x): x is { targetType: ProductTargetingUiType; value: string; expandMode?: ProductTargetingExpandMode; bid: number; state: State } => !!x);
  if (rows.length) return rows;
  return [{ targetType: "asin", value: "", expandMode: "expanded", bid: fallbackBid, state: "enabled" }];
}

function toProductTargetingRowsText(rows: Array<{ expression: string; bid: number; state: State }>) {
  return rows.map((x) => `${x.expression},${x.bid},${x.state}`).join("\n");
}

function toProductTargetingUiRowsText(
  rows: Array<{ targetType: ProductTargetingUiType; value: string; expandMode?: ProductTargetingExpandMode; bid: number; state: State }>
) {
  return toProductTargetingRowsText(
    rows
      .map((row) => ({
        expression: buildProductTargetingExpressionFromUiRow(row),
        bid: row.bid,
        state: row.state,
      }))
      .filter((row) => row.expression.trim())
  );
}

const autoTargetingTypeOptions: AutoTargetingType[] = ["close-match", "loose-match", "substitutes", "complements"];
const autoTargetingTypeLabels: Record<AutoTargetingType, string> = {
  "close-match": "紧密匹配",
  "loose-match": "宽泛匹配",
  substitutes: "同类替代",
  complements: "关联商品",
};

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
  audienceid: "Audience ID",
  "受众id": "Audience ID",
  shoppercohortpercentage: "Shopper Cohort Percentage",
  "受众比例": "Shopper Cohort Percentage",
  shoppercohorttype: "Shopper Cohort Type",
  "受众类型": "Shopper Cohort Type",
  sites: "Sites",
  "站点限制": "Sites",
};

function normalizeImportLabel(value: unknown) {
  return String(value ?? "")
    .trim()
    .replace(/\s+/g, "")
    .replace(/[()（）]/g, "");
}

function parseSitesCell(value: string) {
  return value
    .split(/[|,;，；]/)
    .map((item) => item.trim())
    .filter(Boolean);
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

function buildBatchSequenceSuffix(value: number, digits: number, separator: string) {
  return `${separator}${String(value).padStart(digits, "0")}`;
}

function roundBatchBid(value: number) {
  return Math.round(value * 10000) / 10000;
}

function parseBatchBidList(text: string) {
  return text
    .split(/[,\n，]+/)
    .map((x) => Number(x.trim()))
    .filter((x) => Number.isFinite(x) && x > 0);
}

function resolveBatchBidRuleValue(
  mode: BatchBidRuleMode,
  index: number,
  originalValue: number,
  options: { value: number; listText: string; step: number }
) {
  if (mode === "keep") return roundBatchBid(originalValue);
  if (mode === "fixed") return roundBatchBid(options.value);
  if (mode === "list") {
    const values = parseBatchBidList(options.listText);
    const fallback = values.length ? values[Math.min(index, values.length - 1)] : originalValue;
    return roundBatchBid(fallback);
  }
  return roundBatchBid(options.value + options.step * (index + 1));
}

function getFirstPrimaryBid(source: SpBatchCampaignDraft) {
  const firstAdGroup = source.adGroups[0];
  if (!firstAdGroup) return 0.75;
  if (source.mode === "manual-keyword") {
    return parseSpKeywordBulk(firstAdGroup.keywordsText, firstAdGroup.adGroupDefaultBid).rows[0]?.bid ?? firstAdGroup.adGroupDefaultBid;
  }
  return parseSpProductTargetingBulk(firstAdGroup.productTargetingsText, firstAdGroup.adGroupDefaultBid).rows[0]?.bid ?? firstAdGroup.adGroupDefaultBid;
}

function resolveBatchBidRuleFromConfig(config: BatchBidRuleConfig, index: number, originalValue: number) {
  return resolveBatchBidRuleValue(config.mode, index, originalValue, config);
}

function appendBatchSuffix(value: string, suffix: string) {
  const trimmed = value.trim();
  if (!trimmed) return value;
  return `${trimmed}${suffix}`;
}

function buildDuplicateValue(original: string, prefix: string, suffix: string) {
  const trimmedPrefix = prefix.trim();
  if (trimmedPrefix) return `${trimmedPrefix}${suffix}`;
  return appendBatchSuffix(original, suffix);
}

function duplicateSpBatchCampaign(
  source: SpBatchCampaignDraft,
  suffix: string,
  duplicateIndex: number,
  overrides?: {
    campaignNamePrefix?: string;
    campaignIdPrefix?: string;
    adGroupNamePrefix?: string;
    adGroupIdPrefix?: string;
    adGroupBidMode?: BatchBidRuleMode;
    adGroupBidValue?: number;
    adGroupBidList?: string;
    adGroupBidStep?: number;
    primaryBidMode?: BatchBidRuleMode;
    primaryBidValue?: number;
    primaryBidList?: string;
    primaryBidStep?: number;
    autoBidRules?: Record<AutoTargetingType, BatchBidRuleConfig>;
  }
): SpBatchCampaignDraft {
  const firstPrimaryBid = getFirstPrimaryBid(source);
  return {
    ...source,
    campaignId: buildDuplicateValue(source.campaignId, overrides?.campaignIdPrefix || "", suffix),
    campaignName: buildDuplicateValue(source.campaignName, overrides?.campaignNamePrefix || "", suffix),
    adGroups: source.adGroups.map((adGroup) => {
      const nextAdGroupBid = resolveBatchBidRuleValue(
        overrides?.adGroupBidMode ?? "keep",
        duplicateIndex,
        adGroup.adGroupDefaultBid,
        {
          value: overrides?.adGroupBidValue ?? adGroup.adGroupDefaultBid,
          listText: overrides?.adGroupBidList ?? "",
          step: overrides?.adGroupBidStep ?? 0,
        }
      );
      const nextPrimaryBid = resolveBatchBidRuleValue(
        overrides?.primaryBidMode ?? "keep",
        duplicateIndex,
        firstPrimaryBid,
        {
          value: overrides?.primaryBidValue ?? firstPrimaryBid,
          listText: overrides?.primaryBidList ?? "",
          step: overrides?.primaryBidStep ?? 0,
        }
      );
      const productTargetingRows = parseSpProductTargetingBulk(adGroup.productTargetingsText, adGroup.adGroupDefaultBid).rows;
      return {
        ...adGroup,
        adGroupId: buildDuplicateValue(adGroup.adGroupId, overrides?.adGroupIdPrefix || "", suffix),
        adGroupName: buildDuplicateValue(adGroup.adGroupName, overrides?.adGroupNamePrefix || "", suffix),
        adGroupDefaultBid: nextAdGroupBid,
        keywordsText:
          source.mode === "manual-keyword"
            ? toKeywordRowsText(parseSpKeywordBulk(adGroup.keywordsText, adGroup.adGroupDefaultBid).rows.map((row) => ({ ...row, bid: nextPrimaryBid })))
            : adGroup.keywordsText,
        productTargetingsText:
          source.mode === "manual-keyword"
            ? adGroup.productTargetingsText
            : toProductTargetingRowsText(
                productTargetingRows.map((row) => {
                  if (source.mode !== "auto" || !autoTargetingTypeOptions.includes(row.expression as AutoTargetingType)) {
                    return { ...row, bid: nextPrimaryBid };
                  }
                  const expression = row.expression as AutoTargetingType;
                  const config = overrides?.autoBidRules?.[expression] ?? createBatchBidRuleConfig(row.bid, 0);
                  return {
                    ...row,
                    bid: resolveBatchBidRuleFromConfig(config, duplicateIndex, row.bid),
                  };
                })
              ),
      };
    }),
  };
}

function duplicateSbCampaignWizard(
  source: SbCampaignWizard,
  suffix: string,
  overrides?: { campaignNamePrefix?: string; campaignIdPrefix?: string; adGroupIdPrefix?: string }
): SbCampaignWizard {
  return {
    ...source,
    campaignId: buildDuplicateValue(source.campaignId, overrides?.campaignIdPrefix || "", suffix),
    campaignName: buildDuplicateValue(source.campaignName, overrides?.campaignNamePrefix || "", suffix),
    adGroupId: buildDuplicateValue(source.adGroupId, overrides?.adGroupIdPrefix || "", suffix),
    landingPageAsins: [...source.landingPageAsins],
    creativeAsins: [...source.creativeAsins],
    keywords: source.keywords.map((row) => ({ ...row })),
    negativeKeywords: source.negativeKeywords.map((row) => ({ ...row })),
    negativeProductTargetings: source.negativeProductTargetings.map((row) => ({ ...row })),
    batchCopies: [],
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
  if (normalized.includes("亚马逊企业购") || normalized === "placementAmazonBusiness") {
    return "placementAmazonBusiness";
  }
  if (normalized.includes("其余位置") || normalized === "placementRestOfSearch") {
    return "placementRestOfSearch";
  }
  if (
    normalized === "placementTop" ||
    normalized === "placementProductPage" ||
    normalized === "placementRestOfSearch" ||
    normalized === "placementAmazonBusiness"
  ) {
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
    placementAmazonBusinessPct: current.placementAmazonBusinessPct ?? null,
    audienceId: current.audienceId.trim(),
    shopperCohortPercentage: current.shopperCohortPercentage ?? null,
    shopperCohortType: current.shopperCohortType.trim(),
    sites: current.sites,
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
    placementAmazonBusinessPct: baseline.placementAmazonBusinessPct ?? null,
    audienceId: baseline.audienceId.trim(),
    shopperCohortPercentage: baseline.shopperCohortPercentage ?? null,
    shopperCohortType: baseline.shopperCohortType.trim(),
    sites: baseline.sites,
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
  compare("亚马逊企业购加价", current.placementAmazonBusinessPct ?? null, baseline.placementAmazonBusinessPct ?? null);
  compare("受众ID", current.audienceId.trim(), baseline.audienceId.trim());
  compare("受众比例", current.shopperCohortPercentage ?? null, baseline.shopperCohortPercentage ?? null);
  compare("受众类型", current.shopperCohortType.trim(), baseline.shopperCohortType.trim());
  compare("站点限制", current.sites, baseline.sites);

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
  return parseProductTargetingRowsForUi(adGroup.productTargetingsText, adGroup.adGroupDefaultBid || 0.75)
    .filter((row) => buildProductTargetingExpressionFromUiRow(row).trim())
    .length;
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

function createDefaultBatchProductTargetingsText(mode: SpCampaignWizard["mode"], defaultBid = 0.75) {
  if (mode === "auto") {
    return toAutoTargetingText(createDefaultAutoTargetingRows(defaultBid));
  }
  if (mode === "manual-product-targeting") {
    return toProductTargetingRowsText(
      createDefaultManualProductTargetings(defaultBid).map((row) => ({
        expression: row.expression,
        bid: row.bid ?? defaultBid,
        state: row.state,
      }))
    );
  }
  return "";
}

function createInitialSpBatchAdGroup(mode: SpCampaignWizard["mode"] = "manual-keyword"): SpBatchAdGroupDraft {
  return {
    adGroupId: "",
    adGroupName: "",
    adGroupState: "enabled",
    adGroupDefaultBid: 0.75,
    skusText: "",
    keywordsText: "",
    productTargetingsText: createDefaultBatchProductTargetingsText(mode, 0.75),
    negativeKeywordsText: "",
    negativeProductTargetingsText: "",
  };
}

function createInitialSpBatchCampaign(mode: SpCampaignWizard["mode"] = "manual-keyword"): SpBatchCampaignDraft {
  return {
    mode,
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
    placementAmazonBusinessPct: undefined,
    audienceId: "",
    shopperCohortPercentage: undefined,
    shopperCohortType: "",
    sites: [],
    adGroups: [createInitialSpBatchAdGroup(mode)],
  };
}

function isEmptySpBatchCampaign(campaign: SpBatchCampaignDraft) {
  const firstAdGroup = campaign.adGroups[0];
  if (!firstAdGroup) return true;
  return (
    !campaign.campaignId.trim() &&
    !campaign.campaignName.trim() &&
    !campaign.portfolioId.trim() &&
    !firstAdGroup.adGroupId.trim() &&
    !firstAdGroup.adGroupName.trim() &&
    !normalizeLines(firstAdGroup.skusText).length &&
    !normalizeLines(firstAdGroup.keywordsText).length &&
    !normalizeLines(firstAdGroup.productTargetingsText).length &&
    !normalizeLines(firstAdGroup.negativeKeywordsText).length &&
    !normalizeLines(firstAdGroup.negativeProductTargetingsText).length
  );
}

function getEffectiveSpBatchDraft(draft: SpBatchDraft): SpBatchDraft {
  return {
    campaigns: draft.campaigns.filter((campaign) => !isEmptySpBatchCampaign(campaign)),
  };
}

function buildBatchCampaignFromSpWizard(w: SpCampaignWizard): SpBatchCampaignDraft {
  const productTargetings = normalizeSpProductTargetingsForMode(w.mode, w.productTargetings, w.adGroupDefaultBid || 0.75)
    .filter((row) => row.expression.trim());
  return {
    mode: w.mode,
    campaignId: w.campaignId,
    campaignName: w.campaignName,
    startDate: w.startDate,
    endDate: w.endDate || "",
    state: w.state,
    dailyBudget: w.dailyBudget,
    portfolioId: w.portfolioId || "",
    biddingStrategy: w.biddingStrategy,
    placementTopPct: w.placementTopPct,
    placementRestPct: w.placementRestPct,
    placementProductPagePct: w.placementProductPagePct,
    placementAmazonBusinessPct: w.placementAmazonBusinessPct,
    audienceId: w.audienceId || "",
    shopperCohortPercentage: w.shopperCohortPercentage,
    shopperCohortType: w.shopperCohortType || "",
    sites: [...(w.sites || [])],
    adGroups: [
      {
        adGroupId: w.adGroupId,
        adGroupName: w.adGroupName,
        adGroupState: w.adGroupState,
        adGroupDefaultBid: w.adGroupDefaultBid,
        skusText: w.skus.join("\n"),
        keywordsText: toKeywordRowsText(
          w.keywords
            .filter((row) => row.text.trim())
            .map((row) => ({ text: row.text, matchType: row.matchType, bid: row.bid, state: row.state }))
        ),
        productTargetingsText: toProductTargetingRowsText(
          productTargetings.map((row) => ({
            expression: row.expression,
            bid: row.bid ?? (w.adGroupDefaultBid || 0.75),
            state: row.state,
          }))
        ),
        negativeKeywordsText: toNegativeKeywordRowsText(
          w.negativeKeywords
            .filter((row) => row.text.trim())
            .map((row) => ({ text: row.text, matchType: row.matchType, state: row.state }))
        ),
        negativeProductTargetingsText: w.negativeProductTargetings
          .filter((row) => row.expression.trim())
          .map((row) => `${row.expression},${row.state}`)
          .join("\n"),
      },
    ],
  };
}

function sanitizeSkagSegment(value: string, maxLength = 32) {
  return value
    .trim()
    .replace(/[\s/\\,:*?"<>|#]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, maxLength);
}

function buildKeywordSplitAdGroupValue(base: string, keywordText: string, index: number, fallbackPrefix: string) {
  const prefix = base.trim() || fallbackPrefix;
  const suffixParts = [String(index + 1).padStart(3, "0")];
  const keywordSegment = sanitizeSkagSegment(keywordText);
  if (keywordSegment) suffixParts.push(keywordSegment);
  return `${prefix}-${suffixParts.join("-")}`;
}

function buildSingleKeywordEntityValue(
  base: string,
  row: SpKeywordUiRow,
  index: number,
  fallbackPrefix: string
) {
  const prefix = base.trim() || fallbackPrefix;
  const suffixParts = [String(index + 1).padStart(3, "0")];
  const keywordSegment = sanitizeSkagSegment(row.text);
  const matchSegment = sanitizeSkagSegment(row.matchType, 16);
  if (keywordSegment) suffixParts.push(keywordSegment);
  if (matchSegment) suffixParts.push(matchSegment);
  return `${prefix}-${suffixParts.join("-")}`;
}

function groupKeywordRowsByText(rows: SpKeywordUiRow[]) {
  const groups: Array<{ text: string; rows: SpKeywordUiRow[] }> = [];
  const lookup = new Map<string, { text: string; rows: SpKeywordUiRow[] }>();

  rows.forEach((row) => {
    const keywordText = row.text.trim();
    if (!keywordText) return;
    const key = keywordText.toLowerCase();
    let group = lookup.get(key);
    if (!group) {
      group = { text: keywordText, rows: [] };
      lookup.set(key, group);
      groups.push(group);
    }
    group.rows.push({ ...row, text: keywordText });
  });

  return groups;
}

function buildKeywordSplitAdGroupsFromDraft(adGroup: SpBatchAdGroupDraft) {
  const keywordGroups = groupKeywordRowsByText(parseKeywordRowsForUi(adGroup.keywordsText, adGroup.adGroupDefaultBid || 0.75));
  return keywordGroups.map((keywordGroup, index) => ({
    ...adGroup,
    adGroupId: buildKeywordSplitAdGroupValue(adGroup.adGroupId, keywordGroup.text, index, "AG"),
    adGroupName: buildKeywordSplitAdGroupValue(adGroup.adGroupName, keywordGroup.text, index, "AG"),
    keywordsText: toKeywordRowsText(keywordGroup.rows),
  }));
}

function buildKeywordSplitBatchDraftFromSpWizard(w: SpCampaignWizard): SpBatchDraft {
  const sourceCampaign = buildBatchCampaignFromSpWizard(w);
  const baseAdGroup = sourceCampaign.adGroups[0] ?? createInitialSpBatchAdGroup("manual-keyword");
  return {
    campaigns: [
      {
        ...sourceCampaign,
        adGroups: buildKeywordSplitAdGroupsFromDraft(baseAdGroup),
      },
    ],
  };
}

function buildSingleKeywordCampaignsFromDraft(campaign: SpBatchCampaignDraft, adGroup: SpBatchAdGroupDraft) {
  const keywordRows = parseKeywordRowsForUi(adGroup.keywordsText, adGroup.adGroupDefaultBid || 0.75).filter((row) => row.text.trim());
  return keywordRows.map((row, index) => {
    const nextCampaignId = buildSingleKeywordEntityValue(campaign.campaignId, row, index, "SP");
    const nextCampaignName = buildSingleKeywordEntityValue(campaign.campaignName, row, index, "SP");
    const nextAdGroupId = buildSingleKeywordEntityValue(adGroup.adGroupId, row, index, "AG");
    const nextAdGroupName = buildSingleKeywordEntityValue(adGroup.adGroupName, row, index, "AG");
    return {
      ...campaign,
      campaignId: nextCampaignId,
      campaignName: nextCampaignName,
      adGroups: [
        {
          ...adGroup,
          adGroupId: nextAdGroupId,
          adGroupName: nextAdGroupName,
          keywordsText: toKeywordRowsText([row]),
        },
      ],
    };
  });
}

function buildSingleKeywordCampaignBatchDraftFromSpWizard(w: SpCampaignWizard): SpBatchDraft {
  const sourceCampaign = buildBatchCampaignFromSpWizard(w);
  const baseAdGroup = sourceCampaign.adGroups[0] ?? createInitialSpBatchAdGroup("manual-keyword");
  return {
    campaigns: buildSingleKeywordCampaignsFromDraft(sourceCampaign, baseAdGroup),
  };
}

function createInitialSpBatchDraft(): SpBatchDraft {
  return {
    campaigns: [createInitialSpBatchCampaign()],
  };
}

function createSingleSpModeRecord<T>(factory: () => T): Record<SingleSpUiMode, T> {
  return {
    "manual-keyword": factory(),
    auto: factory(),
    "manual-product-targeting": factory(),
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
          audienceId: stringifyCell(row["Audience ID"]),
          shopperCohortPercentage: parsePositiveNumber(row["Shopper Cohort Percentage"], initial.shopperCohortPercentage ?? 0) || undefined,
          shopperCohortType: stringifyCell(row["Shopper Cohort Type"]),
          sites: parseSitesCell(stringifyCell(row["Sites"])),
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
    const audienceId = stringifyCell(row["Audience ID"]);
    const shopperCohortPercentageRaw = stringifyCell(row["Shopper Cohort Percentage"]);
    const shopperCohortPercentage =
      shopperCohortPercentageRaw === "" ? undefined : parsePositiveNumber(row["Shopper Cohort Percentage"], node.draft.shopperCohortPercentage ?? 0);
    const shopperCohortType = stringifyCell(row["Shopper Cohort Type"]);
    const sites = parseSitesCell(stringifyCell(row["Sites"]));
    if (campaignName) node.draft.campaignName = campaignName;
    if (/^\d{8}$/.test(startDate)) node.draft.startDate = startDate;
    if (!endDate || /^\d{8}$/.test(endDate)) node.draft.endDate = endDate;
    if (state) node.draft.state = state;
    if (portfolioId) node.draft.portfolioId = portfolioId;
    node.draft.dailyBudget = parsePositiveNumber(row["Daily Budget"], node.draft.dailyBudget);
    if (strategy) node.draft.biddingStrategy = strategy;
    if (audienceId) node.draft.audienceId = audienceId;
    if (shopperCohortPercentage != null) node.draft.shopperCohortPercentage = shopperCohortPercentage;
    if (shopperCohortType) node.draft.shopperCohortType = shopperCohortType;
    if (sites.length) node.draft.sites = sites;
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
      const initial = createInitialSpBatchAdGroup(campaignNode.draft.mode);
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
      if (placement === "placementAmazonBusiness") campaignNode.draft.placementAmazonBusinessPct = percentage;
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
      adGroups: adGroups.length ? adGroups : [createInitialSpBatchAdGroup(mode)],
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
      "Audience ID": c.audienceId || "",
      "Shopper Cohort Percentage": c.shopperCohortPercentage,
      "Shopper Cohort Type": c.shopperCohortType || "",
      Sites: c.sites.filter(Boolean).join("|"),
    });

    const placements: Array<{ placement: string; pct?: number }> = [
      { placement: "placementTop", pct: c.placementTopPct },
      { placement: "placementRestOfSearch", pct: c.placementRestPct },
      { placement: "placementProductPage", pct: c.placementProductPagePct },
      { placement: "placementAmazonBusiness", pct: c.placementAmazonBusinessPct },
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

const batchBidRuleModeOptions: { label: string; value: BatchBidRuleMode }[] = [
  { label: "保持原始", value: "keep" },
  { label: "固定值", value: "fixed" },
  { label: "逗号列表", value: "list" },
  { label: "等差变化", value: "step" },
];

function isAutoTargetingExpression(expression: string): expression is AutoTargetingType {
  return autoTargetingTypeOptions.includes(expression.trim() as AutoTargetingType);
}

function createDefaultAutoTargetingRows(defaultBid = 0.75): Array<{ expression: string; bid: number; state: State }> {
  return createDefaultAutoProductTargetings(defaultBid).map((row) => ({
    expression: row.expression,
    bid: row.bid ?? defaultBid,
    state: row.state,
  }));
}

function appendPreferredAutoTargetingRow(
  rows: Array<{ expression: string; bid: number; state: State }>,
  defaultBid = 0.75
): Array<{ expression: string; bid: number; state: State }> {
  const existing = new Set(rows.map((row) => row.expression));
  const nextExpression = autoTargetingTypeOptions.find((expression) => !existing.has(expression)) ?? "close-match";
  return [...rows, { expression: nextExpression, bid: defaultBid, state: "enabled" }];
}

function createDefaultAutoProductTargetings(defaultBid = 0.75): SpCampaignWizard["productTargetings"] {
  return [
    { expression: "close-match", bid: defaultBid, state: "enabled" },
    { expression: "loose-match", bid: defaultBid, state: "enabled" },
    { expression: "substitutes", bid: defaultBid, state: "enabled" },
    { expression: "complements", bid: defaultBid, state: "enabled" },
  ];
}

function createDefaultManualProductTargetings(defaultBid = 0.75): SpCampaignWizard["productTargetings"] {
  return [{ expression: 'asin-expanded="B0XXXXXXXX"', bid: defaultBid, state: "enabled" }];
}

function normalizeSpProductTargetingsForMode(
  mode: SpUiMode,
  productTargetings: SpCampaignWizard["productTargetings"],
  fallbackBid = 0.75
): SpCampaignWizard["productTargetings"] {
  const normalized = productTargetings.filter((row) => row.expression.trim());
  if (mode === "auto") {
    const autoRows = normalized.filter((row) => isAutoTargetingExpression(row.expression));
    return autoRows.length ? autoRows : createDefaultAutoProductTargetings(fallbackBid);
  }
  if (mode === "manual-product-targeting") {
    const manualRows = normalized.filter((row) => !isAutoTargetingExpression(row.expression));
    return manualRows.length ? manualRows : createDefaultManualProductTargetings(fallbackBid);
  }
  return normalized;
}

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
    placementAmazonBusinessPct: undefined,
    audienceId: "",
    shopperCohortPercentage: undefined,
    shopperCohortType: "",
    sites: [],
    adGroupId: "",
    adGroupName: "",
    adGroupState: "enabled",
    adGroupDefaultBid: 0.75,
    skus: [],
    keywords: [{ text: "", matchType: "exact", bid: 0.75, state: "enabled" }],
    negativeKeywords: [],
    negativeProductTargetings: [],
    productTargetings: createDefaultManualProductTargetings(),
  };
}

function createInitialSpForMode(mode: SingleSpUiMode): SpCampaignWizard {
  const initial = createInitialSp();
  return {
    ...initial,
    mode,
    targetingType: mode === "auto" ? "AUTO" : "MANUAL",
    productTargetings: normalizeSpProductTargetingsForMode(mode, initial.productTargetings, initial.adGroupDefaultBid || 0.75),
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
    negativeKeywords: [],
    negativeProductTargetings: [],
    batchCopies: [],
    splitSkag: false,
    skagScope: "adGroups",
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
  const [spInlineBatchEditorOpenByMode, setSpInlineBatchEditorOpenByMode] = useState<Record<SingleSpUiMode, boolean>>({
    "manual-keyword": false,
    auto: false,
    "manual-product-targeting": false,
  });
  const [spBatchDraft, setSpBatchDraft] = useState<SpBatchDraft>(() => createInitialSpBatchDraft());
  const [spInlineBatchDraftByMode, setSpInlineBatchDraftByMode] = useState<Record<SingleSpUiMode, SpBatchDraft>>(() =>
    createSingleSpModeRecord(() => createInitialSpBatchDraft())
  );
  const [spOpenCampaigns, setSpOpenCampaigns] = useState<Record<string, boolean>>({ "campaign-0": true });
  const [spInlineOpenCampaignsByMode, setSpInlineOpenCampaignsByMode] = useState<Record<SingleSpUiMode, Record<string, boolean>>>(() =>
    createSingleSpModeRecord(() => ({ "campaign-0": true }))
  );
  const [spSelectedCampaigns, setSpSelectedCampaigns] = useState<Record<string, boolean>>({});
  const [spInlineSelectedCampaignsByMode, setSpInlineSelectedCampaignsByMode] = useState<Record<SingleSpUiMode, Record<string, boolean>>>(() =>
    createSingleSpModeRecord(() => ({}))
  );
  const [spImportedContext, setSpImportedContext] = useState<SpImportedWorkbookContext | null>(null);
  const [spBatchDuplicateDialog, setSpBatchDuplicateDialog] = useState<SpBatchDuplicateDialogState>({
    open: false,
    sourceIndex: null,
    sourceCampaign: null,
    count: 10,
    startNumber: 1,
    digits: 3,
    separator: "-",
    campaignNamePrefix: "",
    campaignIdPrefix: "",
    adGroupNamePrefix: "",
    adGroupIdPrefix: "",
    adGroupBidMode: "keep",
    adGroupBidValue: 0.75,
    adGroupBidList: "",
    adGroupBidStep: -0.05,
    primaryBidMode: "keep",
    primaryBidValue: 0.75,
    primaryBidList: "",
    primaryBidStep: -0.05,
    autoBidRules: createDefaultAutoBidRules(),
  });
  const importWorkbookInputRef = useRef<HTMLInputElement | null>(null);
  const spImportModeRef = useRef<"draft-create" | "history-update">("draft-create");

  const [spByMode, setSpByMode] = useState<Record<SingleSpUiMode, SpCampaignWizard>>({
    "manual-keyword": createInitialSpForMode("manual-keyword"),
    auto: createInitialSpForMode("auto"),
    "manual-product-targeting": createInitialSpForMode("manual-product-targeting"),
  });

  const currentSingleSpMode: SingleSpUiMode = spMode === "visual-batch" ? "manual-keyword" : spMode;
  const spCurrentWizard = spMode === "visual-batch" ? spByMode["manual-keyword"] : spByMode[currentSingleSpMode];
  const setSpCurrentWizard = (updater: (prev: SpCampaignWizard) => SpCampaignWizard) => {
    if (spMode === "visual-batch") return;
    setSpByMode((prev) => ({
      ...prev,
      [currentSingleSpMode]: updater(prev[currentSingleSpMode]),
    }));
  };
  const spWizard = useMemo<SpCampaignWizard>(() => {
    const targetingType = spMode === "auto" ? "AUTO" : "MANUAL";
    return { ...spCurrentWizard, mode: spMode === "visual-batch" ? "manual-keyword" : spMode, targetingType };
  }, [spCurrentWizard, spMode]);
  const spCurrentInlineBatchEditorOpen = spMode === "visual-batch" ? false : spInlineBatchEditorOpenByMode[currentSingleSpMode];
  const spCurrentBatchDraft = spMode === "visual-batch" ? spBatchDraft : spInlineBatchDraftByMode[currentSingleSpMode];
  const spCurrentOpenCampaigns = spMode === "visual-batch" ? spOpenCampaigns : spInlineOpenCampaignsByMode[currentSingleSpMode];
  const spCurrentSelectedCampaigns = spMode === "visual-batch" ? spSelectedCampaigns : spInlineSelectedCampaignsByMode[currentSingleSpMode];
  const spCurrentImportedContext = spMode === "visual-batch" ? spImportedContext : null;
  const setSpCurrentInlineBatchEditorOpen = (updater: SetStateAction<boolean>) => {
    if (spMode === "visual-batch") return;
    setSpInlineBatchEditorOpenByMode((prev) => ({
      ...prev,
      [currentSingleSpMode]:
        typeof updater === "function" ? (updater as (prevState: boolean) => boolean)(prev[currentSingleSpMode]) : updater,
    }));
  };
  const setSpCurrentBatchDraft = (updater: (prev: SpBatchDraft) => SpBatchDraft) => {
    if (spMode === "visual-batch") {
      setSpBatchDraft(updater);
    } else {
      setSpInlineBatchDraftByMode((prev) => ({
        ...prev,
        [currentSingleSpMode]: updater(prev[currentSingleSpMode]),
      }));
    }
  };
  const setSpCurrentOpenCampaigns = (updater: SetStateAction<Record<string, boolean>>) => {
    if (spMode === "visual-batch") {
      setSpOpenCampaigns(updater);
    } else {
      setSpInlineOpenCampaignsByMode((prev) => ({
        ...prev,
        [currentSingleSpMode]:
          typeof updater === "function"
            ? (updater as (prevState: Record<string, boolean>) => Record<string, boolean>)(prev[currentSingleSpMode])
            : updater,
      }));
    }
  };
  const setSpCurrentSelectedCampaigns = (updater: SetStateAction<Record<string, boolean>>) => {
    if (spMode === "visual-batch") {
      setSpSelectedCampaigns(updater);
    } else {
      setSpInlineSelectedCampaignsByMode((prev) => ({
        ...prev,
        [currentSingleSpMode]:
          typeof updater === "function"
            ? (updater as (prevState: Record<string, boolean>) => Record<string, boolean>)(prev[currentSingleSpMode])
            : updater,
      }));
    }
  };
  const effectiveSpBatchDraft = useMemo(() => getEffectiveSpBatchDraft(spCurrentBatchDraft), [spCurrentBatchDraft]);
  const spUsesBatchSource = spMode === "visual-batch" || (spCurrentInlineBatchEditorOpen && effectiveSpBatchDraft.campaigns.length > 0);
  const spBatch = useMemo(() => buildSpRowsFromBatchDraft(effectiveSpBatchDraft), [effectiveSpBatchDraft]);

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
    () => (spUsesBatchSource ? spBatch.errors : validateSpWizard(spWizard)),
    [spUsesBatchSource, spBatch.errors, spWizard]
  );
  const sbIssues = useMemo(() => validateSbWizard(sb), [sb]);
  const sdIssues = useMemo(() => validateSdWizard(sd), [sd]);
  const portfolioIssues = useMemo(() => validatePortfolioWizard(portfolio), [portfolio]);

  const spWarnings = useMemo(() => {
    if (spUsesBatchSource) return spBatch.warnings;
    return warnSpWizard(spWizard, { minBidSp: settings.minBidSp, keywordMaxChars: settings.keywordMaxChars });
  }, [spUsesBatchSource, spBatch.warnings, spWizard, settings.minBidSp, settings.keywordMaxChars]);
  const sbWarnings = useMemo(
    () => warnSbWizard(sb, { minBidSb: settings.minBidSb, keywordMaxChars: settings.keywordMaxChars }),
    [sb, settings.minBidSb, settings.keywordMaxChars]
  );
  const sdWarnings = useMemo(() => warnSdWizard(sd, { minBidSd: settings.minBidSd }), [sd, settings.minBidSd]);
  const portfolioWarnings = useMemo(() => [], []);


  const spRows = useMemo(() => {
    if (spUsesBatchSource) return spBatch.errors.length ? [] : spBatch.rows;
    return spIssues.length ? [] : buildSpRows(spWizard);
  }, [spUsesBatchSource, spBatch.errors.length, spBatch.rows, spWizard, spIssues.length]);
  const spPreviewData = useMemo(() => {
    if (!(spUsesBatchSource && spCurrentImportedContext)) {
      return {
        rows: spRows,
        meta: spRows.map((row) =>
          createPreviewRowMeta(normalizeCompareValue(row["Operation"]) === "update" ? "update" : "create")
        ),
      };
    }
    const selectedDraft: SpBatchDraft = {
      campaigns: spCurrentBatchDraft.campaigns.filter(
        (campaign, index) => !isEmptySpBatchCampaign(campaign) && (spCurrentSelectedCampaigns[buildCampaignKey(index)] ?? false)
      ),
    };
    const selectedBatch = buildSpRowsFromBatchDraft(selectedDraft);
    return selectedBatch.errors.length
      ? { rows: [], meta: [] }
      : buildSpPreviewRowsWithDiff(spCurrentImportedContext, selectedBatch.rows);
  }, [spUsesBatchSource, spCurrentImportedContext, spRows, spCurrentBatchDraft, spCurrentSelectedCampaigns]);
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
          spUsesBatchSource && spCurrentImportedContext
            ? {
                campaigns: spCurrentBatchDraft.campaigns.filter(
                  (campaign, index) => !isEmptySpBatchCampaign(campaign) && (spCurrentSelectedCampaigns[buildCampaignKey(index)] ?? false)
                ),
              }
            : effectiveSpBatchDraft;
        const selectedSpBatch = buildSpRowsFromBatchDraft(selectedSpDraft);
        const issuesNow = spUsesBatchSource ? selectedSpBatch.errors : validateSpWizard(spWizard);
        if (issuesNow.length) {
          toast.error("请先修正表单问题", { description: issuesNow.slice(0, 6).join("；") });
          return;
        }
        if (spUsesBatchSource && spCurrentImportedContext && !selectedSpDraft.campaigns.length) {
          toast.error("请先选择要导出的活动", { description: "导入更新模式下，至少勾选 1 个活动后再导出。" });
          return;
        }
        const spExportRows = spUsesBatchSource ? selectedSpBatch.rows : buildSpRows(spWizard);
        sheets[SHEETS.spCampaigns] = spExportRows;
        filenameBase = spUsesBatchSource ? "SP批量广告-批量结果" : (spWizard.campaignName || spWizard.campaignId || "SP批量广告");

        if (spUsesBatchSource && spCurrentImportedContext) {
          const wb = cloneWorkbook(spCurrentImportedContext.workbook);
          const originalSheetCount = wb.SheetNames.length;
          pruneWorkbookToUploadableSheets(wb);
          const mergedRows = mergeSpRowsWithImportedContext(spCurrentImportedContext, spExportRows);
          const operationStats = countRowsByOperation(mergedRows);
          const removedSheetCount = Math.max(0, originalSheetCount - wb.SheetNames.length);
          const headers = spCurrentImportedContext.headerRow.length ? spCurrentImportedContext.headerRow : HEADERS[SHEETS.spCampaigns];
          replaceWorkbookSheetRows(wb, spCurrentImportedContext.sheetName, headers, mergedRows);
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
      const init = createInitialSpForMode("manual-keyword");
      setSpByMode({
        "manual-keyword": init,
        auto: createInitialSpForMode("auto"),
        "manual-product-targeting": createInitialSpForMode("manual-product-targeting"),
      });
      setSpMode(init.mode);
      setSpInlineBatchEditorOpenByMode(createSingleSpModeRecord(() => false));
      setSpBatchDraft(createInitialSpBatchDraft());
      setSpInlineBatchDraftByMode(createSingleSpModeRecord(() => createInitialSpBatchDraft()));
      setSpOpenCampaigns({ "campaign-0": true });
      setSpInlineOpenCampaignsByMode(createSingleSpModeRecord(() => ({ "campaign-0": true })));
      setSpSelectedCampaigns({});
      setSpInlineSelectedCampaignsByMode(createSingleSpModeRecord(() => ({})));
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
                  <li>`多种类型批量创建`：适合在同一批里混合建立手动关键词、自动广告和商品定位活动；每个活动都能单独展开编辑。</li>
                  <li>`手动关键词 / 自动广告 / 商品定位` 单独模块：适合先把一个母版活动写好，再点 `批量复制`，原地生成多个类似活动并继续在当前模块里编辑，不需要切换到别的模块。</li>
                  <li>`手动关键词` 里新增了两个快捷动作：`一键生成SKAG` 会生成 `1活动 + 1广告组 + 1关键词`；`一键按词拆成多广告组` 会生成 `单活动 + 多广告组`。</li>
                  <li>`多种类型批量创建` 的手动关键词活动里，也可以直接使用 `拆成SKAG` 和 `按词拆成多广告组`，生成后会默认折叠，方便继续批量检查。</li>
                  <li>SP 活动现在补齐了模板字段：`placementAmazonBusiness`、`Audience ID`、`Shopper Cohort Percentage`、`Shopper Cohort Type`；导出时会按原始 bulk 模板列写入。</li>
                  <li>如果你做 `单词单活动 / SKAG`，先在否词区或批量结果顶部粘贴一套否词库，再用 `否词库到选中 / 全部`，即可把同一套否词一键铺到整批结果。</li>
                  <li>历史更新场景下，可勾选只导出部分活动，右侧预览会同步只显示已勾选内容，并标出新增行、更新行和具体变化单元格。</li>
                  <li>导出前先看右侧“预览与校验”，优先确认没有阻断导出的报错；数据很多时可切到“专注预览”或使用顶部横向滚动条快速检查大表字段。</li>
                </ul>
              </div>
              <div className="rounded-xl border border-border/70 bg-muted/25 p-4">
                <div className="font-semibold text-foreground">四、SP 模块怎么选</div>
                <ul className="mt-2 list-disc space-y-1 pl-5">
                  <li>`多种类型批量创建`：一批里要同时建多种广告类型时使用，适合整盘活动一起规划。</li>
                  <li>`手动关键词`：适合做常规关键词活动，也适合从一个成熟母版快速复制出多套相似活动。</li>
                  <li>`自动广告`：适合统一管理 4 种自动投放类型，默认会直接带出 4 个自动类型。</li>
                  <li>`商品定位`：适合按 `单件商品 / 品类` 建立定位，默认值和批量导入方式都已按商品定位习惯单独处理。</li>
                </ul>
              </div>
              <div className="rounded-xl border border-border/70 bg-muted/25 p-4">
                <div className="font-semibold text-foreground">五、工作区和批量编辑说明</div>
                <ul className="mt-2 list-disc space-y-1 pl-5">
                  <li>`双栏`：左边录入，右边核对，适合日常使用。</li>
                  <li>`专注编辑`：适合长时间填表、批量改 Bid、复制活动、编辑多层活动结构。</li>
                  <li>`专注预览`：适合导出前专门检查字段顺序、Create / Update、差异高亮和最终行数。</li>
                  <li>凡是通过 `批量复制`、`一键生成SKAG`、`一键按词拆成多广告组`、`拆成SKAG`、`按词拆成多广告组` 生成出来的记录，进入批量区后默认都会折叠。</li>
                  <li>批量区顶部支持 `删除选中` 和 `删除全部`；如果只是想看结构，可先保持折叠再按需展开局部活动。</li>
                  <li>批量区顶部支持 `否词库到选中 / 全部`，适合批量生成 SKAG 后再统一补整批否词。</li>
                  <li>批量区里如果表格较宽，会在当前区域内横向滚动；这属于正常表现，不会影响右侧预览。</li>
                </ul>
              </div>
              <div className="rounded-xl border border-border/70 bg-muted/25 p-4">
                <div className="font-semibold text-foreground">六、注意事项</div>
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
              ? "lg:grid-cols-[minmax(0,1.08fr)_minmax(360px,0.92fr)] xl:grid-cols-[minmax(0,1.12fr)_minmax(380px,0.88fr)]"
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
                <Button variant="outline" onClick={onResetCurrent}>
                  重置当前模块
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
                    showInlineBatchEditor={spCurrentInlineBatchEditorOpen}
                    setShowInlineBatchEditor={setSpCurrentInlineBatchEditorOpen}
                    setPreviewOperationFilter={setPreviewOperationFilter}
                    w={spCurrentWizard}
                    setW={setSpCurrentWizard}
                    batchDraft={spCurrentBatchDraft}
                    setBatchDraft={setSpCurrentBatchDraft}
                    setImportedContext={setSpImportedContext}
                    openCampaigns={spCurrentOpenCampaigns}
                    setOpenCampaigns={setSpCurrentOpenCampaigns}
                    selectedCampaigns={spCurrentSelectedCampaigns}
                    setSelectedCampaigns={setSpCurrentSelectedCampaigns}
                    batchResult={spBatch}
                    importedContext={spCurrentImportedContext}
                    spIssues={spIssues}
                    duplicateDialog={spBatchDuplicateDialog}
                    setDuplicateDialog={setSpBatchDuplicateDialog}
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
  showInlineBatchEditor,
  setShowInlineBatchEditor,
  setPreviewOperationFilter,
  w,
  setW,
  batchDraft,
  setBatchDraft,
  setImportedContext,
  openCampaigns,
  setOpenCampaigns,
  selectedCampaigns,
  setSelectedCampaigns,
  batchResult,
  importedContext,
  spIssues,
  duplicateDialog,
  setDuplicateDialog,
}: {
  mode: SpUiMode;
  setMode: (m: SpUiMode) => void;
  showInlineBatchEditor: boolean;
  setShowInlineBatchEditor: Dispatch<SetStateAction<boolean>>;
  setPreviewOperationFilter: Dispatch<SetStateAction<"all" | "create" | "update">>;
  w: SpCampaignWizard;
  setW: (updater: (prev: SpCampaignWizard) => SpCampaignWizard) => void;
  batchDraft: SpBatchDraft;
  setBatchDraft: (updater: (prev: SpBatchDraft) => SpBatchDraft) => void;
  setImportedContext: Dispatch<SetStateAction<SpImportedWorkbookContext | null>>;
  openCampaigns: Record<string, boolean>;
  setOpenCampaigns: Dispatch<SetStateAction<Record<string, boolean>>>;
  selectedCampaigns: Record<string, boolean>;
  setSelectedCampaigns: Dispatch<SetStateAction<Record<string, boolean>>>;
  batchResult: SpBatchBuildResult;
  importedContext: SpImportedWorkbookContext | null;
  spIssues: string[];
  duplicateDialog: SpBatchDuplicateDialogState;
  setDuplicateDialog: Dispatch<SetStateAction<SpBatchDuplicateDialogState>>;
}) {
  const [keywordBulkInput, setKeywordBulkInput] = useState("");
  const [productTargetingBulkInput, setProductTargetingBulkInput] = useState("");
  const [negativeKeywordBulkInput, setNegativeKeywordBulkInput] = useState("");
  const [negativeProductTargetingBulkInput, setNegativeProductTargetingBulkInput] = useState("");
  const [keywordBulkBidByGroup, setKeywordBulkBidByGroup] = useState<Record<string, string>>({});
  const [keywordDefaultMatchTypesByGroup, setKeywordDefaultMatchTypesByGroup] = useState<Record<string, Array<PositiveKeywordMatchType>>>({});
  const [negativeKeywordDefaultMatchTypeByGroup, setNegativeKeywordDefaultMatchTypeByGroup] = useState<Record<string, NegativeKeywordMatchType>>({});
  const [productTargetingBulkInputByGroup, setProductTargetingBulkInputByGroup] = useState<Record<string, string>>({});
  const [productTargetingInputModeByGroup, setProductTargetingInputModeByGroup] = useState<Record<string, ProductTargetingInputMode>>({});
  const [productTargetingExpandModesByGroup, setProductTargetingExpandModesByGroup] = useState<Record<string, Array<ProductTargetingExpandMode>>>({});
  const [spKeywordDefaultMatchTypes, setSpKeywordDefaultMatchTypes] = useState<Array<PositiveKeywordMatchType>>(["exact"]);
  const [spNegativeKeywordDefaultMatchType, setSpNegativeKeywordDefaultMatchType] = useState<NegativeKeywordMatchType>("negativePhrase");
  const [spProductTargetingInputMode, setSpProductTargetingInputMode] = useState<ProductTargetingInputMode>("asin");
  const [spProductTargetingExpandModes, setSpProductTargetingExpandModes] = useState<Array<ProductTargetingExpandMode>>(["expanded"]);
  const [singleKeywordBulkBidInput, setSingleKeywordBulkBidInput] = useState("");
  const [singleProductTargetingBulkBidInput, setSingleProductTargetingBulkBidInput] = useState("");
  const [duplicateDialogStepDrafts, setDuplicateDialogStepDrafts] = useState<Partial<Record<DuplicateDialogStepField, string>>>({});
  const [campaignFilter, setCampaignFilter] = useState("");
  const [openAdGroups, setOpenAdGroups] = useState<Record<string, boolean>>({ "adgroup-0-0": true });
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
  const selectedCampaignIndexes = batchDraft.campaigns
    .map((_, index) => index)
    .filter((index) => selectedCampaigns[buildCampaignKey(index)] ?? false);
  const duplicateSourceCampaign =
    duplicateDialog.sourceCampaign ?? (duplicateDialog.sourceIndex != null ? batchDraft.campaigns[duplicateDialog.sourceIndex] : null);
  const activeDuplicateAutoExpressions = useMemo(() => {
    if (duplicateSourceCampaign?.mode !== "auto") return autoTargetingTypeOptions;
    const firstAdGroup = duplicateSourceCampaign.adGroups[0];
    if (!firstAdGroup) return autoTargetingTypeOptions;
    const found = parseAutoTargetingRows(firstAdGroup.productTargetingsText)
      .map((row) => row.expression)
      .filter((expression, index, array): expression is AutoTargetingType =>
        autoTargetingTypeOptions.includes(expression as AutoTargetingType) && array.indexOf(expression) === index
      );
    return found.length ? found : autoTargetingTypeOptions;
  }, [duplicateSourceCampaign]);

  useEffect(() => {
    if (mode !== "auto" && mode !== "manual-product-targeting") return;
    const normalized = normalizeSpProductTargetingsForMode(mode, w.productTargetings, w.adGroupDefaultBid || 0.75);
    if (JSON.stringify(normalized) === JSON.stringify(w.productTargetings)) return;
    set("productTargetings", normalized);
  }, [mode, w.productTargetings, w.adGroupDefaultBid]);

  function focusCampaign(campaignKey: string) {
    setOpenCampaigns({ [campaignKey]: true });
  }

  function collapseBatchResults() {
    setOpenCampaigns({});
    setOpenAdGroups({});
  }

  function openSpBatchDuplicateDialog(index: number) {
    const source = batchDraft.campaigns[index];
    const firstPrimaryBid = source ? getFirstPrimaryBid(source) : 0.75;
    const autoBidRules = source
      ? Object.fromEntries(
          autoTargetingTypeOptions.map((expression) => [expression, createBatchBidRuleConfig(getAutoTargetingBidByExpression(source, expression))])
        ) as Record<AutoTargetingType, BatchBidRuleConfig>
      : createDefaultAutoBidRules();
    setDuplicateDialogStepDrafts({});
    setDuplicateDialog((prev) => ({
      ...prev,
      open: true,
      sourceIndex: index,
      sourceCampaign: source ?? null,
      campaignNamePrefix: source?.campaignName.trim() || "",
      campaignIdPrefix: source?.campaignId.trim() || "",
      adGroupNamePrefix: source?.adGroups[0]?.adGroupName.trim() || "",
      adGroupIdPrefix: source?.adGroups[0]?.adGroupId.trim() || "",
      adGroupBidValue: source?.adGroups[0]?.adGroupDefaultBid ?? 0.75,
      adGroupBidList: "",
      primaryBidValue: firstPrimaryBid,
      primaryBidList: "",
      autoBidRules,
    }));
  }

  function openSpSingleDuplicateDialog() {
    if (spIssues.length > 0) {
      toast.error("请先修正当前表单后再批量复制", {
        description: spIssues.slice(0, 6).join("；"),
      });
      return;
    }
    const source = buildBatchCampaignFromSpWizard(w);
    const firstPrimaryBid = getFirstPrimaryBid(source);
    const autoBidRules =
      source.mode === "auto"
        ? Object.fromEntries(
            autoTargetingTypeOptions.map((expression) => [expression, createBatchBidRuleConfig(getAutoTargetingBidByExpression(source, expression))])
          ) as Record<AutoTargetingType, BatchBidRuleConfig>
        : createDefaultAutoBidRules();
    setDuplicateDialogStepDrafts({});
    setDuplicateDialog((prev) => ({
      ...prev,
      open: true,
      sourceIndex: null,
      sourceCampaign: source,
      campaignNamePrefix: source.campaignName.trim() || "",
      campaignIdPrefix: source.campaignId.trim() || "",
      adGroupNamePrefix: source.adGroups[0]?.adGroupName.trim() || "",
      adGroupIdPrefix: source.adGroups[0]?.adGroupId.trim() || "",
      adGroupBidValue: source.adGroups[0]?.adGroupDefaultBid ?? 0.75,
      adGroupBidList: "",
      primaryBidValue: firstPrimaryBid,
      primaryBidList: "",
      autoBidRules,
    }));
  }

  function removeCampaignsByIndexes(indexes: number[]) {
    if (!indexes.length) {
      toast.error("请先选中要删除的活动");
      return;
    }
    const removing = new Set(indexes);
    setBatchDraft((prev) => ({
      ...prev,
      campaigns: prev.campaigns.filter((_, index) => !removing.has(index)),
    }));
    setOpenCampaigns({});
    setOpenAdGroups({});
    setSelectedCampaigns({});
    toast.success(`已删除 ${indexes.length} 个活动`);
  }

  function removeAllBatchCampaigns() {
    if (!batchDraft.campaigns.length) {
      toast.error("当前没有可删除的活动");
      return;
    }
    setBatchDraft((prev) => ({ ...prev, campaigns: [] }));
    setOpenCampaigns({});
    setOpenAdGroups({});
    setSelectedCampaigns({});
    toast.success(`已删除全部 ${batchDraft.campaigns.length} 个活动`);
  }

  function getKeywordDefaultMatchTypes(groupKey: string) {
    return keywordDefaultMatchTypesByGroup[groupKey] ?? ["exact"];
  }

  function getNegativeKeywordDefaultMatchType(groupKey: string): NegativeKeywordMatchType {
    return negativeKeywordDefaultMatchTypeByGroup[groupKey] ?? "negativePhrase";
  }

  function getSelectedProductTargetingExpandModes(groupKey: string) {
    return getProductTargetingExpandModes(productTargetingExpandModesByGroup[groupKey]);
  }

  function getProductTargetingInputMode(groupKey: string) {
    return productTargetingInputModeByGroup[groupKey] ?? "asin";
  }

  function toggleKeywordDefaultMatchType(
    groupKey: string,
    matchType: PositiveKeywordMatchType
  ) {
    const order: Array<PositiveKeywordMatchType> = ["exact", "phrase", "broad"];
    setKeywordDefaultMatchTypesByGroup((prev) => {
      const current: Array<PositiveKeywordMatchType> = prev[groupKey] ?? ["exact"];
      const exists = current.includes(matchType);
      const next: Array<PositiveKeywordMatchType> = exists
        ? current.filter((item) => item !== matchType)
        : [...current, matchType];
      const normalized: Array<PositiveKeywordMatchType> = next.length
        ? [...next].sort((a, b) => order.indexOf(a) - order.indexOf(b))
        : ["exact"];
      return { ...prev, [groupKey]: normalized };
    });
  }

  function toggleProductTargetingExpandMode(groupKey: string, mode: ProductTargetingExpandMode) {
    const order: Array<ProductTargetingExpandMode> = ["exact", "expanded"];
    setProductTargetingExpandModesByGroup((prev) => {
      const current: Array<ProductTargetingExpandMode> = getProductTargetingExpandModes(prev[groupKey]);
      const exists = current.includes(mode);
      const next: Array<ProductTargetingExpandMode> = exists ? current.filter((item) => item !== mode) : [...current, mode];
      const normalized: Array<ProductTargetingExpandMode> = next.length
        ? [...next].sort((a, b) => order.indexOf(a) - order.indexOf(b))
        : ["expanded"];
      return { ...prev, [groupKey]: normalized };
    });
  }

  function updateAutoBidRule(expression: AutoTargetingType, patch: Partial<BatchBidRuleConfig>) {
    setDuplicateDialog((prev) => ({
      ...prev,
      autoBidRules: {
        ...prev.autoBidRules,
        [expression]: {
          ...prev.autoBidRules[expression],
          ...patch,
        },
      },
    }));
  }

  function getDuplicateDialogStepInputValue(field: DuplicateDialogStepField, value: number) {
    return duplicateDialogStepDrafts[field] ?? String(value);
  }

  function updateDuplicateDialogStepInput(
    field: DuplicateDialogStepField,
    rawValue: string,
    applyValue: (value: number) => void
  ) {
    setDuplicateDialogStepDrafts((prev) => ({ ...prev, [field]: rawValue }));
    if (rawValue.trim() === "") return;
    const nextValue = Number(rawValue);
    if (!Number.isFinite(nextValue)) return;
    applyValue(nextValue);
  }

  function clearDuplicateDialogStepDrafts(fields?: DuplicateDialogStepField[]) {
    setDuplicateDialogStepDrafts((prev) => {
      if (!fields || fields.length === 0) return {};
      const next = { ...prev };
      fields.forEach((field) => {
        delete next[field];
      });
      return next;
    });
  }

  function syncAutoBidRuleToOtherExpressions(sourceExpression: AutoTargetingType) {
    if (activeDuplicateAutoExpressions.length < 2) return;
    setDuplicateDialog((prev) => {
      const sourceRule = prev.autoBidRules[sourceExpression];
      const nextRules = { ...prev.autoBidRules };
      activeDuplicateAutoExpressions.forEach((expression) => {
        if (expression === sourceExpression) return;
        nextRules[expression] = { ...sourceRule };
      });
      return {
        ...prev,
        autoBidRules: nextRules,
      };
    });
    clearDuplicateDialogStepDrafts(
      activeDuplicateAutoExpressions.map((expression) => `autoBidRules.${expression}.step` as DuplicateDialogStepField)
    );
    toast.success(`已将${autoTargetingTypeLabels[sourceExpression]}的竞价规则同步到其他自动投放类型`);
  }

  function applyKeywordDefaultMatchTypes(campaignIndex: number, adGroupIndex: number, group: SpBatchAdGroupDraft) {
    const groupKey = `${campaignIndex}-${adGroupIndex}`;
    const selectedMatchTypes = getKeywordDefaultMatchTypes(groupKey);
    const expandedText = expandKeywordTextByMatchTypes(group.keywordsText, group.adGroupDefaultBid || 0.75, selectedMatchTypes);
    setBatchDraft((prev) => ({
      ...prev,
      campaigns: prev.campaigns.map((campaign, cIdx) =>
        cIdx !== campaignIndex
          ? campaign
          : {
              ...campaign,
              adGroups: campaign.adGroups.map((adGroup, gIdx) =>
                gIdx === adGroupIndex ? { ...adGroup, keywordsText: expandedText } : adGroup
              ),
            }
      ),
    }));
    toast.success(`已按${selectedMatchTypes.join(" / ")}展开纯关键词`);
  }

  function splitBatchAdGroupByKeyword(campaignIndex: number, adGroupIndex: number, group: SpBatchAdGroupDraft) {
    const splitAdGroups = buildKeywordSplitAdGroupsFromDraft(group);
    if (!splitAdGroups.length) {
      toast.error("没有可拆分的广告组", { description: "请先在当前广告组中填写至少 1 个有效关键词。" });
      return;
    }

    const filledKeywordRows = parseKeywordRowsForUi(group.keywordsText, group.adGroupDefaultBid || 0.75).filter((row) => row.text.trim()).length;
    setBatchDraft((prev) => ({
      ...prev,
      campaigns: prev.campaigns.map((campaign, cIdx) =>
        cIdx !== campaignIndex
          ? campaign
          : {
              ...campaign,
              adGroups: [
                ...campaign.adGroups.slice(0, adGroupIndex),
                ...splitAdGroups,
                ...campaign.adGroups.slice(adGroupIndex + 1),
              ],
            }
      ),
    }));
    collapseBatchResults();
    toast.success(`已拆成 ${splitAdGroups.length} 个按词广告组`, {
      description:
        splitAdGroups.length < filledKeywordRows
          ? "相同关键词的不同匹配已自动归并到同一广告组。"
          : "当前广告组里的 SKU、否词和否定 ASIN 已同步复制到每个广告组。",
    });
  }

  function splitBatchCampaignIntoSingleKeywordCampaigns(campaignIndex: number, campaign: SpBatchCampaignDraft) {
    if (campaign.mode !== "manual-keyword") {
      toast.error("当前只有手动关键词活动支持这个操作");
      return;
    }
    if (campaign.adGroups.length !== 1) {
      toast.error("请先保证当前活动只有 1 个广告组", {
        description: "这个模式会拆成“1活动1组1词”，多广告组活动建议先在单页母版里生成，或先整理成单组。",
      });
      return;
    }

    const singleKeywordCampaigns = buildSingleKeywordCampaignsFromDraft(campaign, campaign.adGroups[0]);
    if (!singleKeywordCampaigns.length) {
      toast.error("没有可拆分的 SKAG", { description: "请先填写至少 1 个有效关键词。" });
      return;
    }

    setBatchDraft((prev) => ({
      ...prev,
      campaigns: [
        ...prev.campaigns.slice(0, campaignIndex),
        ...singleKeywordCampaigns,
        ...prev.campaigns.slice(campaignIndex + 1),
      ],
    }));
    collapseBatchResults();
    setSelectedCampaigns((prev) => ({
      ...Object.fromEntries(singleKeywordCampaigns.map((_, index) => [buildCampaignKey(campaignIndex + index), true])),
      ...prev,
    }));
    toast.success(`已拆成 ${singleKeywordCampaigns.length} 个 SKAG`, {
      description: "每个新活动都只有 1 个活动、1 个广告组和 1 条关键词。",
    });
  }

  function applyProductTargetingExpandModes(campaignIndex: number, adGroupIndex: number, group: SpBatchAdGroupDraft) {
    const groupKey = `${campaignIndex}-${adGroupIndex}`;
    const selectedModes = getSelectedProductTargetingExpandModes(groupKey);
    const sourceText = productTargetingBulkInputByGroup[groupKey] ?? "";
    const expandedText = buildProductTargetingTextFromInput(
      sourceText,
      group.adGroupDefaultBid || 0.75,
      getProductTargetingInputMode(groupKey),
      selectedModes
    );
    const parsedRows = parseSpProductTargetingBulk(expandedText, group.adGroupDefaultBid || 0.75).rows;
    if (!parsedRows.length) {
      toast.error("没有可导入的商品定位", { description: "请至少输入 1 个 ASIN 或 Product Targeting Expression。" });
      return;
    }
    setBatchDraft((prev) => ({
      ...prev,
      campaigns: prev.campaigns.map((campaign, cIdx) =>
        cIdx !== campaignIndex
          ? campaign
          : {
              ...campaign,
              adGroups: campaign.adGroups.map((adGroup, gIdx) =>
                gIdx === adGroupIndex
                  ? {
                      ...adGroup,
                      productTargetingsText: toProductTargetingUiRowsText([
                        ...parseProductTargetingRowsForUi(adGroup.productTargetingsText, adGroup.adGroupDefaultBid || 0.75).filter((row) =>
                          buildProductTargetingExpressionFromUiRow(row).trim()
                        ),
                        ...parseProductTargetingRowsForUi(expandedText, group.adGroupDefaultBid || 0.75),
                      ]),
                    }
                  : adGroup
              ),
            }
      ),
    }));
    setProductTargetingBulkInputByGroup((prev) => ({ ...prev, [groupKey]: "" }));
    toast.success(`已按${selectedModes.join(" / ")}导入 ${parsedRows.length} 条商品定位`);
  }

  function toggleSpProductTargetingExpandMode(mode: ProductTargetingExpandMode) {
    const order: Array<ProductTargetingExpandMode> = ["exact", "expanded"];
    setSpProductTargetingExpandModes((prev) => {
      const current: Array<ProductTargetingExpandMode> = getProductTargetingExpandModes(prev);
      const exists = current.includes(mode);
      const next: Array<ProductTargetingExpandMode> = exists ? current.filter((item) => item !== mode) : [...current, mode];
      const normalized: Array<ProductTargetingExpandMode> = next.length
        ? [...next].sort((a, b) => order.indexOf(a) - order.indexOf(b))
        : ["expanded"];
      return normalized;
    });
  }

  function validateBidRule(mode: BatchBidRuleMode, count: number, options: { label: string; value: number; listText: string; step: number; fallback: number }) {
    if (mode === "keep") return null;
    if (mode === "fixed") {
      return options.value > 0 ? null : `${options.label}固定值必须大于 0`;
    }
    if (mode === "list") {
      const values = parseBatchBidList(options.listText);
      return values.length ? null : `${options.label}列表至少填写 1 个大于 0 的数值`;
    }
    for (let index = 0; index < count; index += 1) {
      const next = resolveBatchBidRuleValue(mode, index, options.fallback, options);
      if (!(next > 0)) return `${options.label}在第 ${index + 1} 个活动上生成了无效出价`;
    }
    return null;
  }

  function createDuplicatedCampaigns() {
    const source = duplicateDialog.sourceCampaign ?? (duplicateDialog.sourceIndex != null ? batchDraft.campaigns[duplicateDialog.sourceIndex] : null);
    if (!source) return;
    const fromSingleWizard = duplicateDialog.sourceIndex == null;

    const count = Math.max(0, Math.floor(duplicateDialog.count));
    const startNumber = Math.max(0, Math.floor(duplicateDialog.startNumber));
    const digits = Math.min(6, Math.max(1, Math.floor(duplicateDialog.digits)));

    if (count < 1) {
      toast.error("复制数量至少为 1");
      return;
    }

    const sequenceCount = count + 1;

    const adGroupBidIssue = validateBidRule(duplicateDialog.adGroupBidMode, sequenceCount, {
      label: "广告组默认竞价",
      value: duplicateDialog.adGroupBidValue,
      listText: duplicateDialog.adGroupBidList,
      step: duplicateDialog.adGroupBidStep,
      fallback: source.adGroups[0]?.adGroupDefaultBid ?? 0.75,
    });
    if (adGroupBidIssue) {
      toast.error(adGroupBidIssue);
      return;
    }

    if (source.mode === "auto") {
      for (const expression of activeDuplicateAutoExpressions) {
        const config = duplicateDialog.autoBidRules[expression];
        const issue = validateBidRule(config.mode, sequenceCount, {
          label: `${autoTargetingTypeLabels[expression]}竞价`,
          value: config.value,
          listText: config.listText,
          step: config.step,
          fallback: getAutoTargetingBidByExpression(source, expression),
        });
        if (issue) {
          toast.error(issue);
          return;
        }
      }
    } else {
      const primaryBidIssue = validateBidRule(duplicateDialog.primaryBidMode, sequenceCount, {
        label: source.mode === "manual-keyword" ? "关键词竞价" : "商品投放竞价",
        value: duplicateDialog.primaryBidValue,
        listText: duplicateDialog.primaryBidList,
        step: duplicateDialog.primaryBidStep,
        fallback: getFirstPrimaryBid(source),
      });
      if (primaryBidIssue) {
        toast.error(primaryBidIssue);
        return;
      }
    }

    const sourceCampaign = duplicateSpBatchCampaign(
      source,
      buildBatchSequenceSuffix(startNumber, digits, duplicateDialog.separator),
      0,
      {
        campaignNamePrefix: duplicateDialog.campaignNamePrefix,
        campaignIdPrefix: duplicateDialog.campaignIdPrefix,
        adGroupNamePrefix: duplicateDialog.adGroupNamePrefix,
        adGroupIdPrefix: duplicateDialog.adGroupIdPrefix,
        adGroupBidMode: duplicateDialog.adGroupBidMode,
        adGroupBidValue: duplicateDialog.adGroupBidValue,
        adGroupBidList: duplicateDialog.adGroupBidList,
        adGroupBidStep: duplicateDialog.adGroupBidStep,
        primaryBidMode: duplicateDialog.primaryBidMode,
        primaryBidValue: duplicateDialog.primaryBidValue,
        primaryBidList: duplicateDialog.primaryBidList,
        primaryBidStep: duplicateDialog.primaryBidStep,
        autoBidRules: duplicateDialog.autoBidRules,
      }
    );
    const suffixes = Array.from({ length: count }, (_, index) =>
      buildBatchSequenceSuffix(startNumber + index + 1, digits, duplicateDialog.separator)
    );
    const duplicates = suffixes.map((suffix, index) =>
      duplicateSpBatchCampaign(source, suffix, index + 1, {
        campaignNamePrefix: duplicateDialog.campaignNamePrefix,
        campaignIdPrefix: duplicateDialog.campaignIdPrefix,
        adGroupNamePrefix: duplicateDialog.adGroupNamePrefix,
        adGroupIdPrefix: duplicateDialog.adGroupIdPrefix,
        adGroupBidMode: duplicateDialog.adGroupBidMode,
        adGroupBidValue: duplicateDialog.adGroupBidValue,
        adGroupBidList: duplicateDialog.adGroupBidList,
        adGroupBidStep: duplicateDialog.adGroupBidStep,
        primaryBidMode: duplicateDialog.primaryBidMode,
        primaryBidValue: duplicateDialog.primaryBidValue,
        primaryBidList: duplicateDialog.primaryBidList,
        primaryBidStep: duplicateDialog.primaryBidStep,
        autoBidRules: duplicateDialog.autoBidRules,
      })
    );
    const sourceIndex = duplicateDialog.sourceIndex;
    const insertCampaigns = [sourceCampaign, ...duplicates];
    const insertStartIndex = fromSingleWizard ? 0 : batchDraft.campaigns.length;
    const nextCampaigns = fromSingleWizard
      ? insertCampaigns
      : [
          ...batchDraft.campaigns.map((campaign, index) => (index === sourceIndex ? sourceCampaign : campaign)),
          ...duplicates,
        ];

    setBatchDraft((prev) => ({
      ...prev,
      campaigns: fromSingleWizard
        ? insertCampaigns
        : [...prev.campaigns.map((campaign, index) => (index === sourceIndex ? sourceCampaign : campaign)), ...duplicates],
    }));
    const selectedEntries = fromSingleWizard
      ? Object.fromEntries(nextCampaigns.map((_, index) => [buildCampaignKey(index), true]))
      : {
          ...selectedCampaigns,
          ...(sourceIndex != null ? { [buildCampaignKey(sourceIndex)]: true } : {}),
          ...Object.fromEntries(duplicates.map((_, index) => [buildCampaignKey(insertStartIndex + index), true])),
        };
    collapseBatchResults();
    setSelectedCampaigns(
      selectedEntries
    );
    if (fromSingleWizard) {
      setImportedContext(null);
      setShowInlineBatchEditor(true);
      setPreviewOperationFilter("all");
    }
    clearDuplicateDialogStepDrafts();
    setDuplicateDialog((prev) => ({ ...prev, open: false, sourceIndex: null, sourceCampaign: null }));
    toast.success(`已生成 ${insertCampaigns.length} 个按编号排序的活动`, {
      description: fromSingleWizard
        ? `母版已从第 ${startNumber} 个编号开始，下面可直接继续批量编辑。`
        : `母版也会占用第一个编号，其余复制活动继续顺延编号。`,
    });
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

  function handleSpModeChange(nextMode: SpUiMode) {
    setMode(nextMode);
    setPreviewOperationFilter("all");
    if (nextMode === "auto" || nextMode === "manual-product-targeting") {
      setW((prev) => ({
        ...prev,
        productTargetings: normalizeSpProductTargetingsForMode(nextMode, prev.productTargetings, prev.adGroupDefaultBid || 0.75),
      }));
    }
  }

  function importKeywordsFromBulkInput() {
    const expandedText = expandKeywordTextByMatchTypes(
      keywordBulkInput,
      w.adGroupDefaultBid || 0.75,
      spKeywordDefaultMatchTypes
    );
    const { rows, invalidCount } = parseSpKeywordBulk(expandedText, w.adGroupDefaultBid || 0.75);
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

  function applySingleKeywordBidToAll(bid: number) {
    if (!(bid > 0)) {
      toast.error("请输入有效的Bid", { description: "例如 0.75、1.2" });
      return;
    }
    set(
      "keywords",
      w.keywords.map((row) => ({ ...row, bid }))
    );
    toast.success(`已把 ${w.keywords.length} 条关键词的Bid设为 ${bid}`);
  }

  function applySingleCustomKeywordBid() {
    const bid = Number(singleKeywordBulkBidInput);
    if (!singleKeywordBulkBidInput || !Number.isFinite(bid) || bid <= 0) {
      toast.error("请输入有效的自定义Bid", { description: "例如 0.75、1.2" });
      return;
    }
    applySingleKeywordBidToAll(bid);
  }

  function generateKeywordSplitBatch() {
    const splitDraft = buildKeywordSplitBatchDraftFromSpWizard(w);
    const adGroupCount = splitDraft.campaigns[0]?.adGroups.length ?? 0;
    if (!adGroupCount) {
      toast.error("没有可生成的广告组拆分结果", { description: "请先至少填写 1 个有效关键词。" });
      return;
    }

    const filledKeywordRows = w.keywords.filter((row) => row.text.trim()).length;
    setBatchDraft(() => splitDraft);
    setImportedContext(null);
    setShowInlineBatchEditor(true);
    setPreviewOperationFilter("all");
    collapseBatchResults();
    setSelectedCampaigns({ [buildCampaignKey(0)]: true });
    toast.success(`已生成 ${adGroupCount} 个按词拆分广告组`, {
      description:
        adGroupCount < filledKeywordRows
          ? "相同关键词的不同匹配已自动归并到同一广告组，已切换到批量编辑视图。"
          : "已切换到批量编辑视图，你可以继续微调广告组名称、SKU、否词和出价。",
    });
  }

  function generateSingleKeywordCampaignBatch() {
    const singleKeywordDraft = buildSingleKeywordCampaignBatchDraftFromSpWizard(w);
    const campaignCount = singleKeywordDraft.campaigns.length;
    if (!campaignCount) {
      toast.error("没有可生成的 SKAG", { description: "请先至少填写 1 个有效关键词。" });
      return;
    }

    setBatchDraft(() => singleKeywordDraft);
    setImportedContext(null);
    setShowInlineBatchEditor(true);
    setPreviewOperationFilter("all");
    collapseBatchResults();
    setSelectedCampaigns(Object.fromEntries(singleKeywordDraft.campaigns.map((_, index) => [buildCampaignKey(index), true])));
    toast.success(`已生成 ${campaignCount} 个 SKAG`, {
      description: "每个活动都只保留 1 个广告组和 1 条关键词，SKU、否词和否定 ASIN 已同步复制。",
    });
  }

  function toggleSpKeywordDefaultMatchType(matchType: PositiveKeywordMatchType) {
    const order: Array<PositiveKeywordMatchType> = ["exact", "phrase", "broad"];
    setSpKeywordDefaultMatchTypes((prev) => {
      const exists = prev.includes(matchType);
      const next = exists ? prev.filter((item) => item !== matchType) : [...prev, matchType];
      return next.length ? [...next].sort((a, b) => order.indexOf(a) - order.indexOf(b)) : ["exact"];
    });
  }

  function applyNegativeKeywordDefaultMatchType(groupKey: string, matchType: NegativeKeywordMatchType) {
    setNegativeKeywordDefaultMatchTypeByGroup((prev) => ({ ...prev, [groupKey]: matchType }));
    setBatchDraft((prev) => ({
      ...prev,
      campaigns: prev.campaigns.map((campaign, campaignIndex) =>
        campaignIndex !== Number(groupKey.split("-")[0])
          ? campaign
          : {
              ...campaign,
              adGroups: campaign.adGroups.map((adGroup, adGroupIndex) =>
                adGroupIndex !== Number(groupKey.split("-")[1])
                  ? adGroup
                  : {
                      ...adGroup,
                      negativeKeywordsText: toNegativeKeywordRowsText(
                        parseNegativeKeywordRowsForUi(adGroup.negativeKeywordsText).map((row) => ({ ...row, matchType }))
                      ),
                    }
              ),
            }
      ),
    }));
  }

  function importProductTargetingsFromBulkInput() {
    const expandedText = buildProductTargetingTextFromInput(
      productTargetingBulkInput,
      w.adGroupDefaultBid || 0.75,
      spProductTargetingInputMode,
      spProductTargetingExpandModes
    );
    const { rows, invalidCount } = parseSpProductTargetingBulk(expandedText, w.adGroupDefaultBid || 0.75);
    if (!rows.length) {
      toast.error("没有可导入的商品定位", { description: "请按行粘贴 ASIN 或 Product Targeting Expression。" });
      return;
    }

    const current = w.productTargetings.filter((x) => x.expression.trim());
    set("productTargetings", [...current, ...rows]);
    setProductTargetingBulkInput("");
    toast.success(`已导入 ${rows.length} 条商品定位`, {
      description: invalidCount > 0 ? `其中 ${invalidCount} 行格式无效已跳过。` : "你可以在下方表格继续编辑。",
    });
  }

  function applySingleProductTargetingBidToAll(bid: number) {
    if (!(bid > 0)) {
      toast.error("请输入有效的Bid", { description: "例如 0.75、1.2" });
      return;
    }
    set(
      "productTargetings",
      w.productTargetings.map((row) => ({ ...row, bid }))
    );
    toast.success(`已把 ${w.productTargetings.length} 条${mode === "auto" ? "自动投放" : "商品定位"}的Bid设为 ${bid}`);
  }

  function applySingleCustomProductTargetingBid() {
    const bid = Number(singleProductTargetingBulkBidInput);
    if (!singleProductTargetingBulkBidInput || !Number.isFinite(bid) || bid <= 0) {
      toast.error("请输入有效的自定义Bid", { description: "例如 0.75、1.2" });
      return;
    }
    applySingleProductTargetingBidToAll(bid);
  }

  function importNegativeKeywordsFromBulkInput() {
    const { rows, invalidCount } = parseSpNegativeKeywordBulk(negativeKeywordBulkInput, spNegativeKeywordDefaultMatchType);
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

  function applyNegativeKeywordLibraryToBatch(scope: "selected" | "all") {
    const { rows, invalidCount } = parseSpNegativeKeywordBulk(negativeKeywordBulkInput, spNegativeKeywordDefaultMatchType);
    if (!rows.length) {
      toast.error("没有可应用的否词库", { description: "请先在上方粘贴否词库内容。" });
      return;
    }
    const targetIndexes =
      scope === "selected"
        ? batchDraft.campaigns
            .map((_, index) => index)
            .filter((index) => selectedCampaigns[buildCampaignKey(index)])
        : batchDraft.campaigns.map((_, index) => index);
    if (!targetIndexes.length) {
      toast.error(scope === "selected" ? "请先选中活动" : "当前没有可应用的活动");
      return;
    }

    let affectedCampaigns = 0;
    let affectedAdGroups = 0;
    setBatchDraft((prev) => ({
      ...prev,
      campaigns: prev.campaigns.map((campaign, index) => {
        if (!targetIndexes.includes(index) || campaign.mode !== "manual-keyword") return campaign;
        affectedCampaigns += 1;
        return {
          ...campaign,
          adGroups: campaign.adGroups.map((adGroup) => {
            affectedAdGroups += 1;
            return {
              ...adGroup,
              negativeKeywordsText: mergeNegativeKeywordRowsText(adGroup.negativeKeywordsText, rows),
            };
          }),
        };
      }),
    }));
    toast.success(`已把否词库应用到 ${affectedCampaigns} 个活动 / ${affectedAdGroups} 个广告组`, {
      description: invalidCount > 0 ? `另有 ${invalidCount} 行格式无效已跳过。` : "同词同匹配会自动去重覆盖。",
    });
  }

  return (
    <Tabs value={mode} onValueChange={(v) => handleSpModeChange(v as SpUiMode)}>
      <TabsList className="grid h-auto w-full grid-cols-2 gap-2 rounded-xl border border-border/60 bg-muted/25 p-1 md:grid-cols-4">
        <TabsTrigger value="visual-batch">多种类型批量创建</TabsTrigger>
        <TabsTrigger value="manual-keyword">手动关键词</TabsTrigger>
        <TabsTrigger value="auto">自动广告</TabsTrigger>
        <TabsTrigger value="manual-product-targeting">商品定位</TabsTrigger>
      </TabsList>

      <TabsContent value={mode} className="mt-5">
        {mode === "visual-batch" || showInlineBatchEditor ? (
          <section className="grid min-w-0 gap-4">
            <div className="rounded-2xl border border-border/70 bg-gradient-to-br from-background to-muted/20 p-4 shadow-sm">
              <div className="text-sm font-semibold text-foreground">
                {mode === "visual-batch" ? "多种类型批量创建" : "批量创建结果"}
              </div>
              <div className="mt-1 text-xs text-muted-foreground">
                按活动卡片逐个展开编辑，结构和单独版块保持一致，方便在一个页面里混合管理多种广告类型。
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

            <div className="grid gap-3 rounded-2xl border border-border/70 bg-gradient-to-br from-muted/10 to-muted/30 p-4 shadow-sm">
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <Badge variant="secondary">活动 {batchResult.campaigns}</Badge>
                <Badge variant="secondary">广告组 {batchResult.adGroups}</Badge>
                <Badge variant="secondary">SKU {batchResult.skus}</Badge>
                <Badge variant="secondary">关键词/定位 {batchResult.keywords}</Badge>
                <Badge variant="secondary">将生成 {batchResult.rows.length} 行</Badge>
                <Badge variant="outline">已选 {selectedCampaignCount}</Badge>
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
              <div className="flex flex-wrap items-start gap-3">
                <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border/60 bg-background/80 p-2 shadow-sm">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() =>
                      setSelectedCampaigns(
                        Object.fromEntries(batchDraft.campaigns.map((_, index) => [buildCampaignKey(index), true]))
                      )
                    }
                  >
                    全选活动
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                      setSelectedCampaigns(
                        Object.fromEntries(batchDraft.campaigns.map((_, index) => [buildCampaignKey(index), false]))
                      )
                    }
                  >
                    清空选择
                  </Button>
                  {importedContext ? (
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
                  ) : null}
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => removeCampaignsByIndexes(selectedCampaignIndexes)}
                    disabled={selectedCampaignIndexes.length === 0}
                  >
                    删除选中
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    className="bg-red-700 text-white hover:bg-red-800"
                    onClick={removeAllBatchCampaigns}
                    disabled={batchDraft.campaigns.length === 0}
                  >
                    删除全部
                  </Button>
                </div>
                <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border/60 bg-background/80 p-2 shadow-sm">
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
                    variant="ghost"
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
                </div>
                <div className="grid gap-3 rounded-xl border border-emerald-300/60 bg-emerald-50/70 p-3 shadow-sm">
                  <div className="text-xs font-medium text-emerald-900">批量结果快捷应用</div>
                  <div className="grid gap-2 lg:grid-cols-[minmax(220px,1fr)_auto]">
                    <Textarea
                      value={negativeKeywordBulkInput}
                      onChange={(e) => setNegativeKeywordBulkInput(e.target.value)}
                      className="min-h-[84px] bg-white font-mono text-[12px]"
                      placeholder={"否词库粘贴到这里，再点右侧按钮应用到批量结果\nbad keyword,negativePhrase,enabled\nanother keyword\tnegativeExact\tpaused"}
                    />
                    <div className="flex flex-wrap items-start gap-2 lg:flex-col lg:items-stretch">
                      <Button variant="outline" size="sm" onClick={() => applyNegativeKeywordLibraryToBatch("selected")}>
                        否词库到选中
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => applyNegativeKeywordLibraryToBatch("all")}>
                        否词库到全部
                      </Button>
                    </div>
                  </div>
                  <div className="text-[11px] text-emerald-800">这里专门用于批量生成 SKAG 后，统一补否词库。</div>
                </div>
                <div className="rounded-lg border border-dashed border-border/60 bg-background/70 px-3 py-2 text-xs text-muted-foreground">点击或编辑某个活动时，会自动收起其它活动；广告组也支持二级折叠。</div>
                {importedContext ? <div className="rounded-lg border border-amber-300/60 bg-amber-50/70 px-3 py-2 text-xs text-amber-800">浅黄色输入框表示该字段相对导入原表已发生修改。</div> : null}
              </div>
            </div>

            <div className="grid min-w-0 gap-4">
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
                const campaignPlacementAmazonBusinessChanged =
                  campaignBaseline ? isDiffValue(c.placementAmazonBusinessPct ?? null, campaignBaseline.placementAmazonBusinessPct ?? null) : false;
                const campaignAudienceIdChanged = campaignBaseline ? isDiffValue(c.audienceId || "", campaignBaseline.audienceId || "") : false;
                const campaignAudiencePctChanged =
                  campaignBaseline ? isDiffValue(c.shopperCohortPercentage ?? null, campaignBaseline.shopperCohortPercentage ?? null) : false;
                const campaignAudienceTypeChanged =
                  campaignBaseline ? isDiffValue(c.shopperCohortType || "", campaignBaseline.shopperCohortType || "") : false;

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
                  className={cn(
                    "min-w-0 rounded-2xl border bg-card/70 shadow-sm backdrop-blur-sm transition-colors",
                    selectedCampaigns[campaignKey]
                      ? "border-sky-300/80 ring-2 ring-sky-300/40 shadow-[0_18px_50px_-34px_rgba(14,165,233,0.55)]"
                      : "border-border/70 hover:border-sky-200/60"
                  )}
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
                            选中
                          </label>
                          <div className="rounded-lg border border-sky-200/70 bg-sky-500/10 px-3 py-1.5 text-base font-bold tracking-tight text-sky-800 shadow-sm dark:border-sky-500/20 dark:bg-sky-500/15 dark:text-sky-200">
                            {c.campaignName.trim() || `活动 #${cIdx + 1}`}
                          </div>
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
                      <div className="flex flex-wrap items-center justify-end gap-2">
                        <CollapsibleTrigger asChild>
                          <Button variant="outline" size="sm" className="gap-2">
                            <ChevronRight className={cn("h-4 w-4 transition-transform", campaignOpen && "rotate-90")} />
                            {campaignOpen ? "折叠活动" : "展开活动"}
                          </Button>
                        </CollapsibleTrigger>
                        <Button
                          size="sm"
                          className="gap-2 bg-sky-600 text-white shadow-sm hover:bg-sky-700"
                          onClick={() => openSpBatchDuplicateDialog(cIdx)}
                        >
                          批量复制
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => removeCampaignsByIndexes([cIdx])}
                        >
                          删除活动
                        </Button>
                      </div>
                    </div>
                    <CollapsibleContent className="mt-4 grid min-w-0 gap-4">
                  <div className="grid min-w-0 gap-3">
                    <SectionTitle>A. Campaign（广告活动）</SectionTitle>
                    <div className="mt-1 grid gap-3 sm:grid-cols-2">
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
                                      v === "auto"
                                        ? {
                                            ...ag,
                                            productTargetingsText: toAutoTargetingText(
                                              parseAutoTargetingRows(ag.productTargetingsText).map((row) => ({
                                                ...row,
                                                bid: row.bid || ag.adGroupDefaultBid || 0.75,
                                              }))
                                            ),
                                          }
                                        : v === "manual-product-targeting"
                                          ? {
                                              ...ag,
                                              productTargetingsText: toProductTargetingRowsText(
                                                parseSpProductTargetingBulk(
                                                  ag.productTargetingsText,
                                                  ag.adGroupDefaultBid || 0.75
                                                ).rows.filter((row) => !isAutoTargetingExpression(row.expression)).length
                                                  ? parseSpProductTargetingBulk(
                                                      ag.productTargetingsText,
                                                      ag.adGroupDefaultBid || 0.75
                                                    ).rows
                                                      .filter((row) => !isAutoTargetingExpression(row.expression))
                                                      .map((row) => ({
                                                        expression: row.expression,
                                                        bid: row.bid || ag.adGroupDefaultBid || 0.75,
                                                        state: row.state,
                                                      }))
                                                  : createDefaultManualProductTargetings(ag.adGroupDefaultBid || 0.75).map((row) => ({
                                                      expression: row.expression,
                                                      bid: row.bid ?? (ag.adGroupDefaultBid || 0.75),
                                                      state: row.state,
                                                    }))
                                              ),
                                            }
                                          : { ...ag, productTargetingsText: "" }
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
                    </div>
                  </div>

                  <section className="grid min-w-0 gap-3">
                    <SectionTitle tone="indigo">B. Bidding Adjustment（广告位加价，可选）</SectionTitle>
                    <div className="grid gap-3 sm:grid-cols-4">
                    <Labeled label="placementTop" hint="搜索结果顶部" labelClassName={getDiffLabelClassName(campaignPlacementTopChanged)}>
                      <Input className={getDiffFieldClassName(campaignPlacementTopChanged)} type="number" value={c.placementTopPct ?? ""} onChange={(e) => setBatchDraft((prev) => ({ ...prev, campaigns: prev.campaigns.map((x, i) => i === cIdx ? { ...x, placementTopPct: e.target.value === "" ? undefined : Number(e.target.value) } : x) }))} />
                    </Labeled>
                    <Labeled label="placementRestOfSearch" hint="搜索结果其余" labelClassName={getDiffLabelClassName(campaignPlacementRestChanged)}>
                      <Input className={getDiffFieldClassName(campaignPlacementRestChanged)} type="number" value={c.placementRestPct ?? ""} onChange={(e) => setBatchDraft((prev) => ({ ...prev, campaigns: prev.campaigns.map((x, i) => i === cIdx ? { ...x, placementRestPct: e.target.value === "" ? undefined : Number(e.target.value) } : x) }))} />
                    </Labeled>
                    <Labeled label="placementProductPage" hint="商品页面" labelClassName={getDiffLabelClassName(campaignPlacementProductPageChanged)}>
                      <Input className={getDiffFieldClassName(campaignPlacementProductPageChanged)} type="number" value={c.placementProductPagePct ?? ""} onChange={(e) => setBatchDraft((prev) => ({ ...prev, campaigns: prev.campaigns.map((x, i) => i === cIdx ? { ...x, placementProductPagePct: e.target.value === "" ? undefined : Number(e.target.value) } : x) }))} />
                    </Labeled>
                    <Labeled label="placementAmazonBusiness" hint="亚马逊企业购" labelClassName={getDiffLabelClassName(campaignPlacementAmazonBusinessChanged)}>
                      <Input className={getDiffFieldClassName(campaignPlacementAmazonBusinessChanged)} type="number" value={c.placementAmazonBusinessPct ?? ""} onChange={(e) => setBatchDraft((prev) => ({ ...prev, campaigns: prev.campaigns.map((x, i) => i === cIdx ? { ...x, placementAmazonBusinessPct: e.target.value === "" ? undefined : Number(e.target.value) } : x) }))} />
                    </Labeled>
                    </div>
                  </section>

                  <section className="grid min-w-0 gap-3">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                      <SectionTitle tone="indigo" className="min-w-0 flex-1">B2. Audience（受众，可选）</SectionTitle>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-3">
                      <Labeled label="Audience ID" hint="模板列存在，可按账户支持填写" labelClassName={getDiffLabelClassName(campaignAudienceIdChanged)}>
                        <Input className={getDiffFieldClassName(campaignAudienceIdChanged)} value={c.audienceId || ""} onChange={(e) => setBatchDraft((prev) => ({ ...prev, campaigns: prev.campaigns.map((x, i) => i === cIdx ? { ...x, audienceId: e.target.value } : x) }))} placeholder="可不填" />
                      </Labeled>
                      <Labeled label="Shopper Cohort Percentage" hint="受众比例" labelClassName={getDiffLabelClassName(campaignAudiencePctChanged)}>
                        <Input className={getDiffFieldClassName(campaignAudiencePctChanged)} type="number" value={c.shopperCohortPercentage ?? ""} onChange={(e) => setBatchDraft((prev) => ({ ...prev, campaigns: prev.campaigns.map((x, i) => i === cIdx ? { ...x, shopperCohortPercentage: e.target.value === "" ? undefined : Number(e.target.value) } : x) }))} placeholder="如 20" />
                      </Labeled>
                      <Labeled label="Shopper Cohort Type" hint="受众类型" labelClassName={getDiffLabelClassName(campaignAudienceTypeChanged)}>
                        <Input className={getDiffFieldClassName(campaignAudienceTypeChanged)} value={c.shopperCohortType || ""} onChange={(e) => setBatchDraft((prev) => ({ ...prev, campaigns: prev.campaigns.map((x, i) => i === cIdx ? { ...x, shopperCohortType: e.target.value } : x) }))} placeholder="可不填" />
                      </Labeled>
                    </div>
                  </section>

                  <div className="mt-4 grid gap-3">
                    {c.adGroups.map((g, gIdx) => {
                      const adGroupKey = buildAdGroupKey(cIdx, gIdx);
                      const adGroupOpen = hasOwnState(openAdGroups, adGroupKey) ? openAdGroups[adGroupKey] : true;
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
                        className={cn(
                          "min-w-0 rounded-xl border bg-background/80 shadow-sm transition-colors dark:bg-card/40",
                          adGroupOpen ? "border-indigo-200/80 shadow-[0_14px_36px_-30px_rgba(79,70,229,0.55)]" : "border-border/70"
                        )}
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
                              <span className="rounded-lg border border-indigo-200/70 bg-indigo-500/10 px-3 py-1.5 text-[15px] font-bold tracking-tight text-indigo-800 shadow-sm dark:border-indigo-500/20 dark:bg-indigo-500/15 dark:text-indigo-200">
                                {g.adGroupName.trim() || `广告组 #${gIdx + 1}`}
                              </span>
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
                        <CollapsibleContent className="mt-2 grid min-w-0 gap-3">
                        <section className="grid min-w-0 gap-3">
                          <SectionTitle tone="indigo">C. Ad Group（广告组）</SectionTitle>
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
                        </section>
                        <Separator />
                        <section className="grid min-w-0 gap-3">
                          <SectionTitle tone="emerald">D. Product Ad（投放商品/SKU）</SectionTitle>
                          <div className={cn("rounded-lg border border-border/70 bg-muted/20 p-3", getDiffFieldClassName(adGroupSkusChanged))}>
                            <Labeled label="SKU列表" hint="一行一个SKU" required labelClassName={getDiffLabelClassName(adGroupSkusChanged)}>
                              <Textarea value={g.skusText} onChange={(e) => setBatchDraft((prev) => ({ ...prev, campaigns: prev.campaigns.map((x, i) => i !== cIdx ? x : { ...x, adGroups: x.adGroups.map((a, ai) => ai === gIdx ? { ...a, skusText: e.target.value } : a) } ) }))} className={cn("min-h-[90px] font-mono text-[12px]", getDiffFieldClassName(adGroupSkusChanged))} />
                            </Labeled>
                          </div>

                          {c.mode === "manual-keyword" && (
                            <div className="grid min-w-0 gap-3">
                              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                                <SectionTitle tone="emerald" className="min-w-0 flex-1">E. Keyword（投放关键词）</SectionTitle>
                                <div className="flex w-full flex-wrap items-center gap-2 lg:w-auto lg:justify-end">
                                  <Badge variant="outline" className="font-mono text-[11px]">
                                    Entity: Keyword
                                  </Badge>
                                  <KeywordGenerationButton
                                    icon={<Crosshair className="h-4 w-4" />}
                                    label="拆成SKAG"
                                    hint="整活动：1活动1组1词"
                                    className="bg-emerald-600 text-white shadow-sm hover:bg-emerald-700"
                                    onClick={() => splitBatchCampaignIntoSingleKeywordCampaigns(cIdx, c)}
                                  />
                                  <KeywordGenerationButton
                                    icon={<SplitTree className="h-4 w-4" />}
                                    label="按词拆成多广告组"
                                    hint="当前组：单活动多组"
                                    className="bg-violet-600 text-white shadow-sm hover:bg-violet-700"
                                    onClick={() => splitBatchAdGroupByKeyword(cIdx, gIdx, g)}
                                    disabled={!parseKeywordRowsForUi(g.keywordsText, g.adGroupDefaultBid || 0.75).some((row) => row.text.trim())}
                                  />
                                </div>
                              </div>
                              <div className={cn("text-sm font-medium", getDiffLabelClassName(adGroupKeywordsChanged))}>关键词列表 *</div>
                              <div className={cn("rounded-lg border border-border/70 bg-muted/20 p-3", getDiffFieldClassName(adGroupKeywordsChanged))}>
                                <div className="text-xs text-muted-foreground">
                                  批量输入：可直接粘贴多行关键词，支持 `关键词` 或 `关键词,匹配方式,bid,state`（支持 Tab 分隔）。未填写匹配方式时，可按下方已选匹配批量展开。
                                </div>
                                <div className="mt-2 flex flex-wrap items-center gap-2">
                                  <span className="text-xs text-muted-foreground">默认匹配：</span>
                                  {([
                                    ["exact", "精准"],
                                    ["phrase", "词组"],
                                    ["broad", "广泛"],
                                  ] as const).map(([value, label]) => {
                                    const groupKey = `${cIdx}-${gIdx}`;
                                    const active = getKeywordDefaultMatchTypes(groupKey).includes(value);
                                    return (
                                      <Button
                                        key={value}
                                        size="sm"
                                        variant={active ? "default" : "outline"}
                                        onClick={() => toggleKeywordDefaultMatchType(groupKey, value)}
                                      >
                                        {label}
                                      </Button>
                                    );
                                  })}
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => applyKeywordDefaultMatchTypes(cIdx, gIdx, g)}
                                  >
                                    批量导入关键词
                                  </Button>
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
                              <div className={cn("mt-1 min-w-0 overflow-auto rounded-lg border border-border/70", getDiffFieldClassName(adGroupKeywordsChanged))}>
                                <Table className="min-w-[760px]">
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
                            <div className="grid min-w-0 gap-3">
                              <SectionTitle tone="indigo">E. Product Targeting（自动投放类型）</SectionTitle>
                              <div className={cn("text-sm font-medium", getDiffLabelClassName(adGroupTargetingsChanged))}>自动投放类型列表 *</div>
                              <div className={cn("mt-1 min-w-0 overflow-auto rounded-lg border border-border/70", getDiffFieldClassName(adGroupTargetingsChanged))}>
                                <Table className="min-w-[620px]">
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
                                              : createDefaultAutoTargetingRows(0.75);
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
                                  const list = appendPreferredAutoTargetingRow(
                                    parseAutoTargetingRows(g.productTargetingsText),
                                    g.adGroupDefaultBid || 0.75
                                  );
                                  setBatchDraft((prev) => ({ ...prev, campaigns: prev.campaigns.map((x, i) => i !== cIdx ? x : { ...x, adGroups: x.adGroups.map((a, ai) => ai === gIdx ? { ...a, productTargetingsText: toAutoTargetingText(list) } : a) } ) }));
                                }}
                              >
                                <Plus className="h-4 w-4" /> 添加自动投放类型
                              </Button>
                            </div>
                          ) : c.mode === "manual-product-targeting" ? (
                            <div className="grid min-w-0 gap-3">
                              <SectionTitle tone="indigo">E. Product Targeting（商品定位）</SectionTitle>
                              <div className={cn("text-sm font-medium", getDiffLabelClassName(adGroupTargetingsChanged))}>商品定位列表 *</div>
                              <div className={cn("rounded-lg border border-border/70 bg-muted/20 p-3", getDiffFieldClassName(adGroupTargetingsChanged))}>
                                <div className="text-xs text-muted-foreground">
                                  当前支持两种业务化输入：`单件商品` 和 `品类`。导入时会自动转换成 bulk 所需的 `Product Targeting Expression`。
                                </div>
                                <div className="mt-2 flex flex-wrap items-center gap-2">
                                  <span className="text-xs text-muted-foreground">输入方式：</span>
                                  {([
                                    ["asin", "单件商品"],
                                    ["category", "品类"],
                                  ] as const).map(([value, label]) => {
                                    const groupKey = `${cIdx}-${gIdx}`;
                                    const active = getProductTargetingInputMode(groupKey) === value;
                                    return (
                                      <Button
                                        key={value}
                                        size="sm"
                                        variant={active ? "default" : "outline"}
                                        onClick={() => setProductTargetingInputModeByGroup((prev) => ({ ...prev, [groupKey]: value }))}
                                      >
                                        {label}
                                      </Button>
                                    );
                                  })}
                                </div>
                                {getProductTargetingInputMode(`${cIdx}-${gIdx}`) === "asin" ? (
                                  <div className="mt-2 flex flex-wrap items-center gap-2">
                                    <span className="text-xs text-muted-foreground">匹配范围：</span>
                                    {([
                                      ["exact", "精准"],
                                      ["expanded", "已扩展"],
                                    ] as const).map(([value, label]) => {
                                      const groupKey = `${cIdx}-${gIdx}`;
                                      const active = getSelectedProductTargetingExpandModes(groupKey).includes(value);
                                      return (
                                        <Button
                                          key={value}
                                          size="sm"
                                          variant={active ? "default" : "outline"}
                                          onClick={() => toggleProductTargetingExpandMode(groupKey, value)}
                                        >
                                          {label}
                                        </Button>
                                      );
                                    })}
                                  </div>
                                ) : null}
                                <div className="mt-2 grid gap-2 sm:grid-cols-[1fr_auto]">
                                  <Textarea
                                    value={productTargetingBulkInputByGroup[`${cIdx}-${gIdx}`] ?? ""}
                                    onChange={(e) =>
                                      setProductTargetingBulkInputByGroup((prev) => ({ ...prev, [`${cIdx}-${gIdx}`]: e.target.value }))
                                    }
                                    className="min-h-[84px] font-mono text-[12px]"
                                    placeholder={
                                      getProductTargetingInputMode(`${cIdx}-${gIdx}`) === "asin"
                                        ? "B0XXXXXXXX\nB0YYYYYYYY,0.75,enabled"
                                        : "123456789\n987654321,0.45,enabled"
                                    }
                                  />
                                  <Button
                                    className="h-fit bg-sky-600 text-white hover:bg-sky-700 sm:self-end"
                                    onClick={() => applyProductTargetingExpandModes(cIdx, gIdx, g)}
                                  >
                                    {getProductTargetingInputMode(`${cIdx}-${gIdx}`) === "asin" ? "导入商品定位" : "导入品类定位"}
                                  </Button>
                                </div>
                              </div>
                              <div className={cn("mt-1 min-w-0 overflow-auto rounded-lg border border-border/70", getDiffFieldClassName(adGroupTargetingsChanged))}>
                                <Table className="min-w-[760px]">
                                  <TableHeader>
                                    <TableRow>
                                      <TableHead className="min-w-[240px]">目标值</TableHead>
                                      <TableHead className="min-w-[160px]">范围/说明</TableHead>
                                      <TableHead className="min-w-[120px]">Bid</TableHead>
                                      <TableHead className="min-w-[140px]">State</TableHead>
                                      <TableHead className="w-[1%]"></TableHead>
                                    </TableRow>
                                  </TableHeader>
                                  <TableBody>
                                    {parseProductTargetingRowsForUi(g.productTargetingsText, g.adGroupDefaultBid || 0.75).map((row, rIdx) => (
                                      <TableRow key={rIdx}>
                                        <TableCell>
                                          <Input value={row.value} onChange={(e) => {
                                            const list = parseProductTargetingRowsForUi(g.productTargetingsText, g.adGroupDefaultBid || 0.75).map((x, i) => i === rIdx ? { ...x, value: e.target.value } : x);
                                            setBatchDraft((prev) => ({ ...prev, campaigns: prev.campaigns.map((x, i) => i !== cIdx ? x : { ...x, adGroups: x.adGroups.map((a, ai) => ai === gIdx ? { ...a, productTargetingsText: toProductTargetingUiRowsText(list) } : a) } ) }));
                                          }} placeholder={row.targetType === "category" ? "品类ID" : row.targetType === "custom" ? "原始表达式" : "ASIN"} />
                                        </TableCell>
                                        <TableCell>
                                          {row.targetType === "asin" ? (
                                            <Select value={row.expandMode ?? "expanded"} onValueChange={(v) => {
                                              const list = parseProductTargetingRowsForUi(g.productTargetingsText, g.adGroupDefaultBid || 0.75).map((x, i) => i === rIdx ? { ...x, expandMode: v as ProductTargetingExpandMode } : x);
                                              setBatchDraft((prev) => ({ ...prev, campaigns: prev.campaigns.map((x, i) => i !== cIdx ? x : { ...x, adGroups: x.adGroups.map((a, ai) => ai === gIdx ? { ...a, productTargetingsText: toProductTargetingUiRowsText(list) } : a) } ) }));
                                            }}>
                                              <SelectTrigger><SelectValue /></SelectTrigger>
                                              <SelectContent>
                                                <SelectItem value="exact">精准</SelectItem>
                                                <SelectItem value="expanded">已扩展</SelectItem>
                                              </SelectContent>
                                            </Select>
                                          ) : (
                                            <div className="text-sm text-muted-foreground">{row.targetType === "category" ? "品类定位" : "原始表达式"}</div>
                                          )}
                                        </TableCell>
                                        <TableCell>
                                          <Input type="number" value={row.bid} onChange={(e) => {
                                            const list = parseProductTargetingRowsForUi(g.productTargetingsText, g.adGroupDefaultBid || 0.75).map((x, i) => i === rIdx ? { ...x, bid: Number(e.target.value || 0) } : x);
                                            setBatchDraft((prev) => ({ ...prev, campaigns: prev.campaigns.map((x, i) => i !== cIdx ? x : { ...x, adGroups: x.adGroups.map((a, ai) => ai === gIdx ? { ...a, productTargetingsText: toProductTargetingUiRowsText(list) } : a) } ) }));
                                          }} />
                                        </TableCell>
                                        <TableCell>
                                          <Select value={row.state} onValueChange={(v) => {
                                            const list = parseProductTargetingRowsForUi(g.productTargetingsText, g.adGroupDefaultBid || 0.75).map((x, i) => i === rIdx ? { ...x, state: v as State } : x);
                                            setBatchDraft((prev) => ({ ...prev, campaigns: prev.campaigns.map((x, i) => i !== cIdx ? x : { ...x, adGroups: x.adGroups.map((a, ai) => ai === gIdx ? { ...a, productTargetingsText: toProductTargetingUiRowsText(list) } : a) } ) }));
                                          }}>
                                            <SelectTrigger><SelectValue /></SelectTrigger>
                                            <SelectContent>{stateOptions.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
                                          </Select>
                                        </TableCell>
                                        <TableCell>
                                          <Button variant="ghost" size="icon" onClick={() => {
                                            const old = parseProductTargetingRowsForUi(g.productTargetingsText, g.adGroupDefaultBid || 0.75);
                                            const list = old.filter((_, i) => i !== rIdx);
                                            const next = list.length
                                              ? list
                                              : [{ targetType: "asin" as ProductTargetingUiType, value: "", expandMode: "expanded" as ProductTargetingExpandMode, bid: g.adGroupDefaultBid || 0.75, state: "enabled" as State }];
                                            setBatchDraft((prev) => ({ ...prev, campaigns: prev.campaigns.map((x, i) => i !== cIdx ? x : { ...x, adGroups: x.adGroups.map((a, ai) => ai === gIdx ? { ...a, productTargetingsText: toProductTargetingUiRowsText(next) } : a) } ) }));
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
                                const list = [
                                  ...parseProductTargetingRowsForUi(g.productTargetingsText, g.adGroupDefaultBid || 0.75),
                                  { targetType: "asin" as ProductTargetingUiType, value: "", expandMode: "expanded" as ProductTargetingExpandMode, bid: g.adGroupDefaultBid || 0.75, state: "enabled" as State },
                                ];
                                setBatchDraft((prev) => ({ ...prev, campaigns: prev.campaigns.map((x, i) => i !== cIdx ? x : { ...x, adGroups: x.adGroups.map((a, ai) => ai === gIdx ? { ...a, productTargetingsText: toProductTargetingUiRowsText(list) } : a) } ) }));
                              }}>
                                <Plus className="h-4 w-4" /> 添加商品定位
                              </Button>
                            </div>
                          ) : null}

                          <div className="grid min-w-0 gap-3">
                            <SectionTitle tone="amber">F. Negative Keyword（否词，可选）</SectionTitle>
                            <div className={cn("text-sm font-medium", getDiffLabelClassName(adGroupNegativeKeywordsChanged))}>否词列表（可选）</div>
                            <div className={cn("rounded-lg border border-border/70 bg-muted/20 p-3", getDiffFieldClassName(adGroupNegativeKeywordsChanged))}>
                              <div className="text-xs text-muted-foreground">
                                批量输入：可直接粘贴多行否词，支持 `否词` 或 `否词,匹配方式,state`（支持 Tab 分隔）。未填写匹配方式时，按下方已选类型处理。
                              </div>
                              <div className="mt-2 flex flex-wrap items-center gap-2">
                                <span className="text-xs text-muted-foreground">默认类型：</span>
                                {([
                                  ["negativeExact", "精准"],
                                  ["negativePhrase", "词组"],
                                ] as const).map(([value, label]) => {
                                  const groupKey = `${cIdx}-${gIdx}`;
                                  const active = getNegativeKeywordDefaultMatchType(groupKey) === value;
                                  return (
                                    <Button
                                      key={value}
                                      size="sm"
                                      variant={active ? "default" : "outline"}
                                      onClick={() => applyNegativeKeywordDefaultMatchType(groupKey, value)}
                                    >
                                      {label}
                                    </Button>
                                  );
                                })}
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
                            <div className={cn("mt-1 min-w-0 overflow-auto rounded-lg border border-border/70", getDiffFieldClassName(adGroupNegativeKeywordsChanged))}>
                              <Table className="min-w-[700px]">
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

                          <div className="grid min-w-0 gap-3">
                            <SectionTitle tone="amber">G. Negative Product Targeting（否定ASIN/类目，可选）</SectionTitle>
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
                            <div className={cn("mt-1 min-w-0 overflow-auto rounded-lg border border-border/70", getDiffFieldClassName(adGroupNegativeTargetingsChanged))}>
                              <Table className="min-w-[720px]">
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
                        </section>
                        {c.mode === "auto" && (
                        <div className="mt-3 flex flex-wrap items-center gap-2 rounded-lg border border-dashed border-indigo-200/70 bg-indigo-50/60 px-3 py-2 text-xs text-indigo-900 dark:border-indigo-500/30 dark:bg-indigo-500/10 dark:text-indigo-100">
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
                                                  productTargetingsText: createDefaultBatchProductTargetingsText("auto", a.adGroupDefaultBid || 0.75),
                                                }
                                          ),
                                        }
                                  ),
                                }))
                              }
                            >
                              一键填充4种自动投放
                            </Button>
                            <span>可按需把不需要的类型改为 paused 或删除行。</span>
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
                          campaigns: prev.campaigns.map((x, i) => (i === cIdx ? { ...x, adGroups: [...x.adGroups, createInitialSpBatchAdGroup(c.mode)] } : x)),
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
            <Dialog
              open={duplicateDialog.open}
              onOpenChange={(open) => {
                if (!open) clearDuplicateDialogStepDrafts();
                setDuplicateDialog((prev) => ({ ...prev, open }));
              }}
            >
              <DialogContent className="max-h-[88vh] overflow-hidden border border-border/70 bg-background/95 p-0 shadow-2xl sm:max-w-3xl">
                <div className="flex max-h-[88vh] flex-col">
                  <DialogHeader className="border-b px-5 pt-5 pb-3">
                    <DialogTitle>批量复制多个类似活动</DialogTitle>
                    <DialogDescription className="text-xs leading-5">
                      基于当前活动模板，一次性追加多个相似活动，并自动给活动与广告组名称/ID 添加递增编号后缀。
                    </DialogDescription>
                  </DialogHeader>
                  <div className="overflow-y-auto px-5 py-4">
                    <div className="grid gap-3 sm:grid-cols-2">
                  <Labeled label="活动名称前缀" hint="留空则沿用当前活动名">
                    <Input
                      value={duplicateDialog.campaignNamePrefix}
                      onChange={(e) => setDuplicateDialog((prev) => ({ ...prev, campaignNamePrefix: e.target.value }))}
                      placeholder="如：RES-SP-AUTO"
                    />
                  </Labeled>
                  <Labeled label="活动 ID 前缀" hint="留空则沿用当前 Campaign ID">
                    <Input
                      value={duplicateDialog.campaignIdPrefix}
                      onChange={(e) => setDuplicateDialog((prev) => ({ ...prev, campaignIdPrefix: e.target.value }))}
                      placeholder="如：RES-SP-AUTO"
                    />
                  </Labeled>
                  <Labeled label="广告组名称前缀" hint="留空则沿用首个广告组名">
                    <Input
                      value={duplicateDialog.adGroupNamePrefix}
                      onChange={(e) => setDuplicateDialog((prev) => ({ ...prev, adGroupNamePrefix: e.target.value }))}
                      placeholder="如：RES-SP-AUTO-AG"
                    />
                  </Labeled>
                  <Labeled label="广告组 ID 前缀" hint="留空则沿用首个广告组 ID">
                    <Input
                      value={duplicateDialog.adGroupIdPrefix}
                      onChange={(e) => setDuplicateDialog((prev) => ({ ...prev, adGroupIdPrefix: e.target.value }))}
                      placeholder="如：RES-SP-AUTO-AG"
                    />
                  </Labeled>
                          <Labeled label="复制数量" required hint="额外复制数量（母版也会编号）">
                    <Input
                      type="number"
                      min={1}
                      value={duplicateDialog.count}
                      onChange={(e) =>
                        setDuplicateDialog((prev) => ({ ...prev, count: Number(e.target.value || 0) }))
                      }
                    />
                  </Labeled>
                  <Labeled label="起始编号" required hint="如 1">
                    <Input
                      type="number"
                      min={0}
                      value={duplicateDialog.startNumber}
                      onChange={(e) =>
                        setDuplicateDialog((prev) => ({ ...prev, startNumber: Number(e.target.value || 0) }))
                      }
                    />
                  </Labeled>
                  <Labeled label="编号位数" required hint="如 3 => 001">
                    <Input
                      type="number"
                      min={1}
                      max={6}
                      value={duplicateDialog.digits}
                      onChange={(e) =>
                        setDuplicateDialog((prev) => ({ ...prev, digits: Number(e.target.value || 0) }))
                      }
                    />
                  </Labeled>
                  <Labeled label="分隔符" hint="默认使用 -">
                    <Input
                      value={duplicateDialog.separator}
                      onChange={(e) => setDuplicateDialog((prev) => ({ ...prev, separator: e.target.value }))}
                      placeholder="-"
                    />
                  </Labeled>
                    </div>
                    <div className="mt-4 grid gap-4 rounded-xl border border-border/60 bg-muted/15 p-4 shadow-sm">
                      <div className="font-medium text-sm">竞价规则</div>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <Labeled label="广告组默认竞价规则" hint="固定值 / 列表 / 等差">
                          <Select value={duplicateDialog.adGroupBidMode} onValueChange={(value) => setDuplicateDialog((prev) => ({ ...prev, adGroupBidMode: value as BatchBidRuleMode }))}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {batchBidRuleModeOptions.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </Labeled>
                        {duplicateDialog.adGroupBidMode === "fixed" || duplicateDialog.adGroupBidMode === "step" ? (
                          <Labeled label={duplicateDialog.adGroupBidMode === "fixed" ? "广告组默认竞价固定值" : "广告组默认竞价基准值"} hint="等差模式下，001 会在此基础上加减一步">
                            <Input
                              type="number"
                              step="0.01"
                              value={duplicateDialog.adGroupBidValue}
                              onChange={(e) => setDuplicateDialog((prev) => ({ ...prev, adGroupBidValue: Number(e.target.value || 0) }))}
                            />
                          </Labeled>
                        ) : null}
                        {duplicateDialog.adGroupBidMode === "list" ? (
                          <Labeled label="广告组默认竞价列表" hint="如 1,0.9,0.8">
                            <Input
                              value={duplicateDialog.adGroupBidList}
                              onChange={(e) => setDuplicateDialog((prev) => ({ ...prev, adGroupBidList: e.target.value }))}
                              placeholder="1,0.9,0.8"
                            />
                          </Labeled>
                        ) : null}
                        {duplicateDialog.adGroupBidMode === "step" ? (
                          <Labeled label="广告组默认竞价步长" hint="可填负数，如每个 -0.05">
                            <Input
                              type="number"
                              step="0.01"
                              value={getDuplicateDialogStepInputValue("adGroupBidStep", duplicateDialog.adGroupBidStep)}
                              onChange={(e) =>
                                updateDuplicateDialogStepInput("adGroupBidStep", e.target.value, (value) =>
                                  setDuplicateDialog((prev) => ({ ...prev, adGroupBidStep: value }))
                                )
                              }
                              onBlur={() => clearDuplicateDialogStepDrafts(["adGroupBidStep"])}
                            />
                          </Labeled>
                        ) : null}
                      </div>
                      {duplicateSourceCampaign?.mode === "auto" ? (
                        <div className="grid gap-3">
                          <div className="text-xs text-muted-foreground">自动广告支持 4 种匹配分别独立控价，规则会应用到复制出来的每个活动。</div>
                          <div className="grid gap-3 md:grid-cols-2">
                            {activeDuplicateAutoExpressions.map((expression) => {
                              const config = duplicateDialog.autoBidRules[expression];
                              return (
                                <div key={expression} className="grid gap-3 rounded-lg border border-border/60 bg-background/80 p-3">
                                  <div className="flex items-center justify-between gap-2">
                                    <div className="font-medium text-sm">{autoTargetingTypeLabels[expression]}</div>
                                    {activeDuplicateAutoExpressions.length > 1 ? (
                                      <Button size="sm" variant="ghost" onClick={() => syncAutoBidRuleToOtherExpressions(expression)}>
                                        同步到其他类型
                                      </Button>
                                    ) : null}
                                  </div>
                                  <Labeled label="竞价规则">
                                    <Select value={config.mode} onValueChange={(value) => updateAutoBidRule(expression, { mode: value as BatchBidRuleMode })}>
                                      <SelectTrigger><SelectValue /></SelectTrigger>
                                      <SelectContent>
                                        {batchBidRuleModeOptions.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}
                                      </SelectContent>
                                    </Select>
                                  </Labeled>
                                  {config.mode === "fixed" || config.mode === "step" ? (
                                    <Labeled label={config.mode === "fixed" ? "固定竞价" : "竞价基准值"} hint="等差模式下，001 会在此基础上加减一步">
                                      <Input
                                        type="number"
                                        step="0.01"
                                        value={config.value}
                                        onChange={(e) => updateAutoBidRule(expression, { value: Number(e.target.value || 0) })}
                                      />
                                    </Labeled>
                                  ) : null}
                                  {config.mode === "list" ? (
                                    <Labeled label="竞价列表" hint="如 0.8,0.7,0.6">
                                      <Input
                                        value={config.listText}
                                        onChange={(e) => updateAutoBidRule(expression, { listText: e.target.value })}
                                        placeholder="0.8,0.7,0.6"
                                      />
                                    </Labeled>
                                  ) : null}
                                  {config.mode === "step" ? (
                                    <Labeled label="竞价步长" hint="可填负数，如每个 -0.05">
                                      <Input
                                        type="number"
                                        step="0.01"
                                        value={getDuplicateDialogStepInputValue(`autoBidRules.${expression}.step`, config.step)}
                                        onChange={(e) =>
                                          updateDuplicateDialogStepInput(`autoBidRules.${expression}.step`, e.target.value, (value) =>
                                            updateAutoBidRule(expression, { step: value })
                                          )
                                        }
                                        onBlur={() => clearDuplicateDialogStepDrafts([`autoBidRules.${expression}.step` as DuplicateDialogStepField])}
                                      />
                                    </Labeled>
                                  ) : null}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ) : (
                        <div className="grid gap-3 sm:grid-cols-2">
                          <Labeled
                            label={duplicateSourceCampaign?.mode === "manual-keyword" ? "关键词竞价规则" : "商品投放竞价规则"}
                            hint="会统一作用于该活动内的主投放项"
                          >
                            <Select value={duplicateDialog.primaryBidMode} onValueChange={(value) => setDuplicateDialog((prev) => ({ ...prev, primaryBidMode: value as BatchBidRuleMode }))}>
                              <SelectTrigger><SelectValue /></SelectTrigger>
                              <SelectContent>
                                {batchBidRuleModeOptions.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}
                              </SelectContent>
                            </Select>
                          </Labeled>
                          {duplicateDialog.primaryBidMode === "fixed" || duplicateDialog.primaryBidMode === "step" ? (
                            <Labeled label={duplicateDialog.primaryBidMode === "fixed" ? "主投放固定竞价" : "主投放竞价基准值"} hint="等差模式下，母版对应第 1 个编号">
                              <Input
                                type="number"
                                step="0.01"
                                value={duplicateDialog.primaryBidValue}
                                onChange={(e) => setDuplicateDialog((prev) => ({ ...prev, primaryBidValue: Number(e.target.value || 0) }))}
                              />
                            </Labeled>
                          ) : null}
                          {duplicateDialog.primaryBidMode === "list" ? (
                            <Labeled label="主投放竞价列表" hint="如 0.8,0.7,0.6">
                              <Input
                                value={duplicateDialog.primaryBidList}
                                onChange={(e) => setDuplicateDialog((prev) => ({ ...prev, primaryBidList: e.target.value }))}
                                placeholder="0.8,0.7,0.6"
                              />
                            </Labeled>
                          ) : null}
                          {duplicateDialog.primaryBidMode === "step" ? (
                            <Labeled label="主投放竞价步长" hint="可填负数，如每个 -0.05">
                              <Input
                                type="number"
                                step="0.01"
                                value={getDuplicateDialogStepInputValue("primaryBidStep", duplicateDialog.primaryBidStep)}
                                onChange={(e) =>
                                  updateDuplicateDialogStepInput("primaryBidStep", e.target.value, (value) =>
                                    setDuplicateDialog((prev) => ({ ...prev, primaryBidStep: value }))
                                  )
                                }
                                onBlur={() => clearDuplicateDialogStepDrafts(["primaryBidStep"])}
                              />
                            </Labeled>
                          ) : null}
                        </div>
                      )}
                    </div>
                    <div className="mt-4 rounded-lg border border-border/60 bg-muted/20 p-3 text-xs text-muted-foreground">
                      {(() => {
                        const source = duplicateSourceCampaign;
                        const suffix = buildBatchSequenceSuffix(
                          Math.max(0, Math.floor(duplicateDialog.startNumber)),
                          Math.min(6, Math.max(1, Math.floor(duplicateDialog.digits || 1))),
                          duplicateDialog.separator
                        );
                        const previewCampaignName = buildDuplicateValue(source?.campaignName || "活动", duplicateDialog.campaignNamePrefix, suffix);
                        const previewCampaignId = buildDuplicateValue(source?.campaignId || "Campaign", duplicateDialog.campaignIdPrefix, suffix);
                        const previewAdGroupName = buildDuplicateValue(source?.adGroups[0]?.adGroupName || "广告组", duplicateDialog.adGroupNamePrefix, suffix);
                        const previewAdGroupId = buildDuplicateValue(source?.adGroups[0]?.adGroupId || "AG", duplicateDialog.adGroupIdPrefix, suffix);
                        const previewCount = Math.min(Math.max(duplicateDialog.count + 1, 0), 5);
                        return (
                          <div className="grid gap-1.5">
                            <div>活动名：{previewCampaignName}</div>
                            <div>活动 ID：{previewCampaignId}</div>
                            <div>广告组名：{previewAdGroupName}</div>
                            <div>广告组 ID：{previewAdGroupId}</div>
                            {source ? (
                              <>
                                <div className="pt-1 font-medium text-foreground">前 {previewCount} 个活动竞价预览</div>
                                {Array.from({ length: previewCount }, (_, index) => {
                                  const adGroupBid = resolveBatchBidRuleValue(duplicateDialog.adGroupBidMode, index, source.adGroups[0]?.adGroupDefaultBid ?? 0.75, {
                                    value: duplicateDialog.adGroupBidValue,
                                    listText: duplicateDialog.adGroupBidList,
                                    step: duplicateDialog.adGroupBidStep,
                                  });
                                  const primaryBid = resolveBatchBidRuleValue(duplicateDialog.primaryBidMode, index, getFirstPrimaryBid(source), {
                                    value: duplicateDialog.primaryBidValue,
                                    listText: duplicateDialog.primaryBidList,
                                    step: duplicateDialog.primaryBidStep,
                                  });
                                  return (
                                    <div key={index} className="grid gap-1 rounded-lg border border-border/40 bg-background/60 p-2">
                                      <div>#{index + 1} 广告组默认竞价 {adGroupBid}</div>
                                      {source.mode === "auto" ? (
                                        <div>
                                          {activeDuplicateAutoExpressions.map((expression) => {
                                            const config = duplicateDialog.autoBidRules[expression];
                                            const nextBid = resolveBatchBidRuleFromConfig(
                                              config,
                                              index,
                                              getAutoTargetingBidByExpression(source, expression)
                                            );
                                            return `${autoTargetingTypeLabels[expression]} ${nextBid}`;
                                          }).join(" | ")}
                                        </div>
                                      ) : (
                                        <div>{source.mode === "manual-keyword" ? "关键词" : "商品投放"}竞价 {primaryBid}</div>
                                      )}
                                    </div>
                                  );
                                })}
                              </>
                            ) : null}
                          </div>
                        );
                      })()}
                    </div>
                  </div>
                <DialogFooter className="border-t px-5 py-3">
                  <Button
                    variant="outline"
                    onClick={() => {
                      clearDuplicateDialogStepDrafts();
                      setDuplicateDialog((prev) => ({ ...prev, open: false, sourceIndex: null, sourceCampaign: null }));
                    }}
                  >
                    取消
                  </Button>
                  <Button onClick={createDuplicatedCampaigns}>立即生成</Button>
                </DialogFooter>
                </div>
              </DialogContent>
            </Dialog>
          </section>
        ) : (
        <div className="grid gap-5">
          <section className="grid gap-3">
            <div className="flex items-center justify-between">
              <SectionTitle className="min-w-0 flex-1">A. Campaign（广告活动）</SectionTitle>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="font-mono text-[11px]">
                  Entity: Campaign
                </Badge>
                <Button
                  size="sm"
                  className="gap-2 bg-sky-600 text-white shadow-sm hover:bg-sky-700"
                  onClick={openSpSingleDuplicateDialog}
                >
                  批量复制
                </Button>
              </div>
            </div>
            <div className="text-xs text-muted-foreground">说明：导出时会自动填充 Operation=Create；Campaign ID 是关联键，不是 Campaign Name。点击“批量复制”后，会把当前表单作为母版带入复制弹窗。</div>

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
              <SectionTitle className="min-w-0 flex-1" tone="indigo">B. Bidding Adjustment（广告位加价，可选）</SectionTitle>
              <Badge variant="outline" className="font-mono text-[11px]">
                Entity: Bidding Adjustment
              </Badge>
            </div>
            <div className="grid gap-3 sm:grid-cols-4">
              <Labeled label="placementTop" hint="搜索结果顶部">
                <Input type="number" value={w.placementTopPct ?? 0} onChange={(e) => set("placementTopPct", Number(e.target.value || 0))} />
              </Labeled>
              <Labeled label="placementRestOfSearch" hint="搜索结果其余">
                <Input type="number" value={w.placementRestPct ?? 0} onChange={(e) => set("placementRestPct", Number(e.target.value || 0))} />
              </Labeled>
              <Labeled label="placementProductPage" hint="商品页面">
                <Input type="number" value={w.placementProductPagePct ?? 0} onChange={(e) => set("placementProductPagePct", Number(e.target.value || 0))} />
              </Labeled>
              <Labeled label="placementAmazonBusiness" hint="亚马逊企业购">
                <Input type="number" value={w.placementAmazonBusinessPct ?? 0} onChange={(e) => set("placementAmazonBusinessPct", Number(e.target.value || 0))} />
              </Labeled>
            </div>
            <p className="text-xs text-muted-foreground">范围 0-900；不想设置也可以保持0（或后续删掉该行）。</p>
          </section>

          <Separator />

          <section className="grid gap-3">
            <div className="flex items-center justify-between">
              <SectionTitle className="min-w-0 flex-1" tone="indigo">B2. Audience（受众，可选）</SectionTitle>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <Labeled label="Audience ID" hint="模板支持字段，可按账户需要填写">
                <Input value={w.audienceId || ""} onChange={(e) => set("audienceId", e.target.value)} placeholder="可不填" />
              </Labeled>
              <Labeled label="Shopper Cohort Percentage" hint="受众比例">
                <Input type="number" value={w.shopperCohortPercentage ?? ""} onChange={(e) => set("shopperCohortPercentage", e.target.value === "" ? undefined : Number(e.target.value))} placeholder="如 20" />
              </Labeled>
              <Labeled label="Shopper Cohort Type" hint="受众类型">
                <Input value={w.shopperCohortType || ""} onChange={(e) => set("shopperCohortType", e.target.value)} placeholder="可不填" />
              </Labeled>
            </div>
          </section>

          <Separator />

          <section className="grid gap-3">
            <div className="flex items-center justify-between">
              <SectionTitle className="min-w-0 flex-1" tone="indigo">C. Ad Group（广告组）</SectionTitle>
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
              <SectionTitle className="min-w-0 flex-1" tone="emerald">D. Product Ad（投放SKU）</SectionTitle>
              <Badge variant="outline" className="font-mono text-[11px]">
                Entity: Product Ad
              </Badge>
            </div>
            <div className="rounded-lg border border-border/70 bg-muted/20 p-3">
              <Labeled label="SKU列表" hint="一行一个SKU" required>
                <Textarea
                  value={w.skus.join("\n")}
                  onChange={(e) => set("skus", normalizeLines(e.target.value))}
                  className="min-h-[96px] font-mono text-[13px]"
                  placeholder="SKU-1\nSKU-2"
                />
              </Labeled>
              <p className="mt-2 text-xs text-muted-foreground">支持批量粘贴：可直接从Excel复制整列SKU到此输入框。</p>
            </div>
          </section>

          <Separator />

          {mode === "manual-keyword" && (
            <section className="grid gap-3">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <SectionTitle className="min-w-0 flex-1" tone="emerald">E. Keyword（投放关键词）</SectionTitle>
                <div className="flex w-full flex-wrap items-center gap-2 lg:w-auto lg:justify-end">
                  <Badge variant="outline" className="font-mono text-[11px]">
                    Entity: Keyword
                  </Badge>
                  <KeywordGenerationButton
                    icon={<Crosshair className="h-4 w-4" />}
                    label="一键生成SKAG"
                    hint="1活动1组1词"
                    className="bg-emerald-600 text-white shadow-sm hover:bg-emerald-700"
                    onClick={generateSingleKeywordCampaignBatch}
                    disabled={!w.keywords.some((row) => row.text.trim())}
                  />
                  <KeywordGenerationButton
                    icon={<SplitTree className="h-4 w-4" />}
                    label="一键按词拆成多广告组"
                    hint="单活动多组"
                    className="bg-violet-600 text-white shadow-sm hover:bg-violet-700"
                    onClick={generateKeywordSplitBatch}
                    disabled={!w.keywords.some((row) => row.text.trim())}
                  />
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
                    批量导入格式：`关键词` 或 `关键词,匹配方式,bid,state`（也支持Tab分隔；匹配方式支持 broad/phrase/exact 或 广泛/词组/精准）。未填写匹配方式时，会按下方已选匹配批量展开。
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <span className="text-xs text-muted-foreground">默认匹配：</span>
                    {([
                      ["exact", "精准"],
                      ["phrase", "词组"],
                      ["broad", "广泛"],
                    ] as const).map(([value, label]) => {
                      const active = spKeywordDefaultMatchTypes.includes(value);
                      return (
                        <Button
                          key={value}
                          size="sm"
                          variant={active ? "default" : "outline"}
                          onClick={() => toggleSpKeywordDefaultMatchType(value)}
                        >
                          {label}
                        </Button>
                      );
                    })}
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
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <Button size="sm" variant="outline" onClick={() => applySingleKeywordBidToAll(w.adGroupDefaultBid || 0.75)}>
                      全部Bid=默认出价
                    </Button>
                    <Input
                      type="number"
                      className="h-8 w-[140px]"
                      placeholder="自定义Bid"
                      value={singleKeywordBulkBidInput}
                      onChange={(e) => setSingleKeywordBulkBidInput(e.target.value)}
                    />
                    <Button size="sm" variant="outline" onClick={applySingleCustomKeywordBid}>
                      应用自定义Bid
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
                <SectionTitle className="min-w-0 flex-1" tone="indigo">E. Product Targeting（{mode === "auto" ? "自动投放类型" : "商品定位"}）</SectionTitle>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="font-mono text-[11px]">
                    Entity: Product Targeting
                  </Badge>
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-2"
                    onClick={() =>
                      set(
                        "productTargetings",
                        mode === "auto"
                          ? appendPreferredAutoTargetingRow(
                              w.productTargetings.map((row) => ({
                                expression: row.expression,
                                bid: row.bid ?? (w.adGroupDefaultBid || 0.75),
                                state: row.state,
                              })),
                              w.adGroupDefaultBid || 0.75
                            )
                          : [...w.productTargetings, { expression: 'asin-expanded="B0XXXXXXXX"', bid: 0.75, state: "enabled" }]
                      )
                    }
                  >
                    <Plus className="h-4 w-4" />
                    添加
                  </Button>
                </div>
              </div>

              {mode === "manual-product-targeting" ? (
                <div className="rounded-lg border border-border/70 bg-muted/20 p-3">
                  <div className="text-xs text-muted-foreground">
                    当前支持两种业务化输入：`单件商品` 和 `品类`。导入时会自动转换成 bulk 所需的 `Product Targeting Expression`。
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <span className="text-xs text-muted-foreground">输入方式：</span>
                    {([
                      ["asin", "单件商品"],
                      ["category", "品类"],
                    ] as const).map(([value, label]) => {
                      const active = spProductTargetingInputMode === value;
                      return (
                        <Button
                          key={value}
                          size="sm"
                          variant={active ? "default" : "outline"}
                          onClick={() => setSpProductTargetingInputMode(value)}
                        >
                          {label}
                        </Button>
                      );
                    })}
                  </div>
                  {spProductTargetingInputMode === "asin" ? (
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <span className="text-xs text-muted-foreground">匹配范围：</span>
                      {([
                        ["exact", "精准"],
                        ["expanded", "已扩展"],
                      ] as const).map(([value, label]) => {
                        const active = spProductTargetingExpandModes.includes(value);
                        return (
                          <Button
                            key={value}
                            size="sm"
                            variant={active ? "default" : "outline"}
                            onClick={() => toggleSpProductTargetingExpandMode(value)}
                          >
                            {label}
                          </Button>
                        );
                      })}
                    </div>
                  ) : null}
                  <div className="mt-2 grid gap-2 sm:grid-cols-[1fr_auto]">
                    <Textarea
                      value={productTargetingBulkInput}
                      onChange={(e) => setProductTargetingBulkInput(e.target.value)}
                      className="min-h-[84px] font-mono text-[12px]"
                      placeholder={spProductTargetingInputMode === "asin" ? "B0XXXXXXXX\nB0YYYYYYYY,0.75,enabled" : "123456789\n987654321,0.45,enabled"}
                    />
                    <Button className="h-fit bg-sky-600 text-white hover:bg-sky-700 sm:self-end" onClick={importProductTargetingsFromBulkInput}>
                      {spProductTargetingInputMode === "asin" ? "导入商品定位" : "导入品类定位"}
                    </Button>
                  </div>
                </div>
              ) : null}

              <div className="flex flex-wrap items-center gap-2">
                <Button size="sm" variant="outline" onClick={() => applySingleProductTargetingBidToAll(w.adGroupDefaultBid || 0.75)}>
                  全部Bid=默认出价
                </Button>
                <Input
                  type="number"
                  className="h-8 w-[140px]"
                  placeholder="自定义Bid"
                  value={singleProductTargetingBulkBidInput}
                  onChange={(e) => setSingleProductTargetingBulkBidInput(e.target.value)}
                />
                <Button size="sm" variant="outline" onClick={applySingleCustomProductTargetingBid}>
                  应用自定义Bid
                </Button>
              </div>

              <div className="overflow-auto rounded-lg border border-border/70">
                <Table>
                  <TableHeader>
                    <TableRow>
                      {mode === "auto" ? (
                        <>
                          <TableHead className="min-w-[240px]">Product Targeting Expression</TableHead>
                          <TableHead className="min-w-[160px]">Target Value</TableHead>
                          <TableHead className="min-w-[160px]">Range</TableHead>
                          <TableHead className="min-w-[120px]">Bid *</TableHead>
                        </>
                      ) : (
                        <>
                          <TableHead className="min-w-[240px]">目标值</TableHead>
                          <TableHead className="min-w-[160px]">范围/说明</TableHead>
                          <TableHead className="min-w-[120px]">Bid *</TableHead>
                        </>
                      )}
                      <TableHead className="min-w-[160px]">State</TableHead>
                      <TableHead className="w-[1%]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {mode === "auto"
                      ? w.productTargetings.map((t, idx) => (
                          <TableRow key={idx}>
                            <TableCell>
                              <Input value={t.expression} onChange={(e) => set("productTargetings", w.productTargetings.map((x, i) => (i === idx ? { ...x, expression: e.target.value } : x)))} />
                            </TableCell>
                            <TableCell>
                              <div className="text-sm text-muted-foreground">自动投放</div>
                            </TableCell>
                            <TableCell>
                              <div className="text-sm text-muted-foreground">固定类型</div>
                            </TableCell>
                            <TableCell>
                              <Input
                                type="number"
                                value={t.bid ?? (w.adGroupDefaultBid || 0.75)}
                                onChange={(e) =>
                                  set(
                                    "productTargetings",
                                    w.productTargetings.map((x, i) => (i === idx ? { ...x, bid: Number(e.target.value || 0) } : x))
                                  )
                                }
                              />
                            </TableCell>
                            <TableCell>
                              <Select value={t.state} onValueChange={(v) => set("productTargetings", w.productTargetings.map((x, i) => (i === idx ? { ...x, state: v as State } : x)))}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>{stateOptions.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
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
                                      : createDefaultAutoProductTargetings(0.75)
                                  )
                                }
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))
                      : parseProductTargetingRowsForUi(toProductTargetingRowsText(w.productTargetings.map((x) => ({ expression: x.expression, bid: x.bid ?? 0.75, state: x.state }))), w.adGroupDefaultBid || 0.75).map((row, idx) => (
                          <TableRow key={idx}>
                            <TableCell>
                              <Input value={row.value} placeholder={row.targetType === "category" ? "品类ID" : row.targetType === "custom" ? "原始表达式" : "ASIN"} onChange={(e) => {
                                const list = parseProductTargetingRowsForUi(toProductTargetingRowsText(w.productTargetings.map((x) => ({ expression: x.expression, bid: x.bid ?? 0.75, state: x.state }))), w.adGroupDefaultBid || 0.75).map((x, i) => i === idx ? { ...x, value: e.target.value } : x);
                                set("productTargetings", parseSpProductTargetingBulk(toProductTargetingUiRowsText(list), w.adGroupDefaultBid || 0.75).rows);
                              }} />
                            </TableCell>
                            <TableCell>
                              {row.targetType === "asin" ? (
                                <Select value={row.expandMode ?? "expanded"} onValueChange={(v) => {
                                  const list = parseProductTargetingRowsForUi(toProductTargetingRowsText(w.productTargetings.map((x) => ({ expression: x.expression, bid: x.bid ?? 0.75, state: x.state }))), w.adGroupDefaultBid || 0.75).map((x, i) => i === idx ? { ...x, expandMode: v as ProductTargetingExpandMode } : x);
                                  set("productTargetings", parseSpProductTargetingBulk(toProductTargetingUiRowsText(list), w.adGroupDefaultBid || 0.75).rows);
                                }}>
                                  <SelectTrigger><SelectValue /></SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="exact">精准</SelectItem>
                                    <SelectItem value="expanded">已扩展</SelectItem>
                                  </SelectContent>
                                </Select>
                              ) : (
                                <div className="text-sm text-muted-foreground">{row.targetType === "category" ? "品类定位" : "原始表达式"}</div>
                              )}
                            </TableCell>
                            <TableCell>
                              <Input type="number" value={row.bid} onChange={(e) => {
                                const list = parseProductTargetingRowsForUi(toProductTargetingRowsText(w.productTargetings.map((x) => ({ expression: x.expression, bid: x.bid ?? 0.75, state: x.state }))), w.adGroupDefaultBid || 0.75).map((x, i) => i === idx ? { ...x, bid: Number(e.target.value || 0) } : x);
                                set("productTargetings", parseSpProductTargetingBulk(toProductTargetingUiRowsText(list), w.adGroupDefaultBid || 0.75).rows);
                              }} />
                            </TableCell>
                            <TableCell>
                              <Select value={row.state} onValueChange={(v) => {
                                const list = parseProductTargetingRowsForUi(toProductTargetingRowsText(w.productTargetings.map((x) => ({ expression: x.expression, bid: x.bid ?? 0.75, state: x.state }))), w.adGroupDefaultBid || 0.75).map((x, i) => i === idx ? { ...x, state: v as State } : x);
                                set("productTargetings", parseSpProductTargetingBulk(toProductTargetingUiRowsText(list), w.adGroupDefaultBid || 0.75).rows);
                              }}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>{stateOptions.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
                              </Select>
                            </TableCell>
                            <TableCell>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => {
                                  const list = parseProductTargetingRowsForUi(toProductTargetingRowsText(w.productTargetings.map((x) => ({ expression: x.expression, bid: x.bid ?? 0.75, state: x.state }))), w.adGroupDefaultBid || 0.75).filter((_, i) => i !== idx);
                                  const next = list.length ? list : [{ targetType: "asin" as ProductTargetingUiType, value: "", expandMode: "expanded" as ProductTargetingExpandMode, bid: 0.75, state: "enabled" as State }];
                                  set("productTargetings", parseSpProductTargetingBulk(toProductTargetingUiRowsText(next), w.adGroupDefaultBid || 0.75).rows);
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

              {mode === "auto" && (
                <p className="text-xs text-muted-foreground">提示：自动广告默认会把4种投放都打开。建议在这里把不需要的3种设置为 paused。</p>
              )}
            </section>
          )}

          <Separator />

          <section className="grid gap-3">
            <div className="flex items-center justify-between">
              <SectionTitle className="min-w-0 flex-1" tone="amber">F. Negative Keyword（否词，可选）</SectionTitle>
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
                批量导入格式：`否词` 或 `否词,匹配方式,state`（也支持Tab分隔；匹配方式支持 negativePhrase/negativeExact 或 否定词组/否定精准）。未填写匹配方式时，按下方已选类型导入。
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <span className="text-xs text-muted-foreground">默认类型：</span>
                {([
                  ["negativeExact", "精准"],
                  ["negativePhrase", "词组"],
                ] as const).map(([value, label]) => {
                  const active = spNegativeKeywordDefaultMatchType === value;
                  return (
                    <Button
                      key={value}
                      size="sm"
                      variant={active ? "default" : "outline"}
                      onClick={() => setSpNegativeKeywordDefaultMatchType(value)}
                    >
                      {label}
                    </Button>
                  );
                })}
              </div>
              <div className="mt-2 grid gap-2 sm:grid-cols-[1fr_auto]">
                <Textarea
                  value={negativeKeywordBulkInput}
                  onChange={(e) => setNegativeKeywordBulkInput(e.target.value)}
                  className="min-h-[84px] font-mono text-[12px]"
                  placeholder={"bad keyword,negativePhrase,enabled\nanother keyword\tnegativeExact\tpaused"}
                />
                <div className="flex flex-wrap items-start gap-2 sm:flex-col sm:items-stretch">
                  <Button className="h-fit bg-sky-600 text-white hover:bg-sky-700" onClick={importNegativeKeywordsFromBulkInput}>
                    导入到当前活动
                  </Button>
                  {showInlineBatchEditor ? (
                    <>
                      <Button variant="outline" className="h-fit" onClick={() => applyNegativeKeywordLibraryToBatch("selected")}>
                        应用到已选批量活动
                      </Button>
                      <Button variant="outline" className="h-fit" onClick={() => applyNegativeKeywordLibraryToBatch("all")}>
                        应用到全部批量活动
                      </Button>
                    </>
                  ) : null}
                </div>
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <div className="text-xs text-muted-foreground">模板里有 `Match Type` 字段，否词支持 `negativeExact` 和 `negativePhrase`。批量应用按钮会在生成批量结果后显示，并自动去重。</div>
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
              <SectionTitle className="min-w-0 flex-1" tone="amber">G. Negative Product Targeting（否定ASIN/类目，可选）</SectionTitle>
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
        {mode !== "visual-batch" ? (
          <Dialog
            open={duplicateDialog.open}
            onOpenChange={(open) => {
              if (!open) clearDuplicateDialogStepDrafts();
              setDuplicateDialog((prev) => ({ ...prev, open }));
            }}
          >
            <DialogContent className="max-h-[90vh] overflow-hidden p-0 sm:max-w-3xl">
              <div className="flex max-h-[90vh] flex-col">
                <DialogHeader className="border-b px-6 pt-6 pb-4">
                  <DialogTitle>批量复制多个类似活动</DialogTitle>
                  <DialogDescription>
                    基于当前活动模板，一次性追加多个相似活动，并自动给活动与广告组名称/ID 添加递增编号后缀。
                  </DialogDescription>
                </DialogHeader>
                <div className="overflow-y-auto px-6 py-4">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Labeled label="活动名称前缀" hint="留空则沿用当前活动名">
                      <Input
                        value={duplicateDialog.campaignNamePrefix}
                        onChange={(e) => setDuplicateDialog((prev) => ({ ...prev, campaignNamePrefix: e.target.value }))}
                        placeholder="如：RES-SP-AUTO"
                      />
                    </Labeled>
                    <Labeled label="活动 ID 前缀" hint="留空则沿用当前 Campaign ID">
                      <Input
                        value={duplicateDialog.campaignIdPrefix}
                        onChange={(e) => setDuplicateDialog((prev) => ({ ...prev, campaignIdPrefix: e.target.value }))}
                        placeholder="如：RES-SP-AUTO"
                      />
                    </Labeled>
                    <Labeled label="广告组名称前缀" hint="留空则沿用首个广告组名">
                      <Input
                        value={duplicateDialog.adGroupNamePrefix}
                        onChange={(e) => setDuplicateDialog((prev) => ({ ...prev, adGroupNamePrefix: e.target.value }))}
                        placeholder="如：RES-SP-AUTO-AG"
                      />
                    </Labeled>
                    <Labeled label="广告组 ID 前缀" hint="留空则沿用首个广告组 ID">
                      <Input
                        value={duplicateDialog.adGroupIdPrefix}
                        onChange={(e) => setDuplicateDialog((prev) => ({ ...prev, adGroupIdPrefix: e.target.value }))}
                        placeholder="如：RES-SP-AUTO-AG"
                      />
                    </Labeled>
                    <Labeled label="复制数量" required hint="额外复制数量（母版也会编号）">
                      <Input
                        type="number"
                        min={1}
                        value={duplicateDialog.count}
                        onChange={(e) =>
                          setDuplicateDialog((prev) => ({ ...prev, count: Number(e.target.value || 0) }))
                        }
                      />
                    </Labeled>
                    <Labeled label="起始编号" required hint="如 1">
                      <Input
                        type="number"
                        min={0}
                        value={duplicateDialog.startNumber}
                        onChange={(e) =>
                          setDuplicateDialog((prev) => ({ ...prev, startNumber: Number(e.target.value || 0) }))
                        }
                      />
                    </Labeled>
                    <Labeled label="编号位数" required hint="如 3 => 001">
                      <Input
                        type="number"
                        min={1}
                        max={6}
                        value={duplicateDialog.digits}
                        onChange={(e) =>
                          setDuplicateDialog((prev) => ({ ...prev, digits: Number(e.target.value || 0) }))
                        }
                      />
                    </Labeled>
                    <Labeled label="分隔符" hint="默认使用 -">
                      <Input
                        value={duplicateDialog.separator}
                        onChange={(e) => setDuplicateDialog((prev) => ({ ...prev, separator: e.target.value }))}
                        placeholder="-"
                      />
                    </Labeled>
                  </div>
                  <div className="mt-4 grid gap-4 rounded-lg border border-border/60 bg-muted/15 p-4">
                    <div className="font-medium text-sm">竞价规则</div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <Labeled label="广告组默认竞价规则" hint="固定值 / 列表 / 等差">
                        <Select value={duplicateDialog.adGroupBidMode} onValueChange={(value) => setDuplicateDialog((prev) => ({ ...prev, adGroupBidMode: value as BatchBidRuleMode }))}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {batchBidRuleModeOptions.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </Labeled>
                      {duplicateDialog.adGroupBidMode === "fixed" || duplicateDialog.adGroupBidMode === "step" ? (
                        <Labeled label={duplicateDialog.adGroupBidMode === "fixed" ? "广告组默认竞价固定值" : "广告组默认竞价基准值"} hint="等差模式下，001 会在此基础上加减一步">
                          <Input
                            type="number"
                            step="0.01"
                            value={duplicateDialog.adGroupBidValue}
                            onChange={(e) => setDuplicateDialog((prev) => ({ ...prev, adGroupBidValue: Number(e.target.value || 0) }))}
                          />
                        </Labeled>
                      ) : null}
                      {duplicateDialog.adGroupBidMode === "list" ? (
                        <Labeled label="广告组默认竞价列表" hint="如 1,0.9,0.8">
                          <Input
                            value={duplicateDialog.adGroupBidList}
                            onChange={(e) => setDuplicateDialog((prev) => ({ ...prev, adGroupBidList: e.target.value }))}
                            placeholder="1,0.9,0.8"
                          />
                        </Labeled>
                      ) : null}
                      {duplicateDialog.adGroupBidMode === "step" ? (
                        <Labeled label="广告组默认竞价步长" hint="可填负数，如每个 -0.05">
                          <Input
                            type="number"
                            step="0.01"
                            value={getDuplicateDialogStepInputValue("adGroupBidStep", duplicateDialog.adGroupBidStep)}
                            onChange={(e) =>
                              updateDuplicateDialogStepInput("adGroupBidStep", e.target.value, (value) =>
                                setDuplicateDialog((prev) => ({ ...prev, adGroupBidStep: value }))
                              )
                            }
                            onBlur={() => clearDuplicateDialogStepDrafts(["adGroupBidStep"])}
                          />
                        </Labeled>
                      ) : null}
                    </div>
                    {duplicateSourceCampaign?.mode === "auto" ? (
                      <div className="grid gap-3">
                        <div className="text-xs text-muted-foreground">自动广告支持 4 种匹配分别独立控价，规则会应用到复制出来的每个活动。</div>
                        <div className="grid gap-3 md:grid-cols-2">
                          {activeDuplicateAutoExpressions.map((expression) => {
                            const config = duplicateDialog.autoBidRules[expression];
                            return (
                              <div key={expression} className="grid gap-3 rounded-lg border border-border/60 bg-background/80 p-3">
                                <div className="flex items-center justify-between gap-2">
                                  <div className="font-medium text-sm">{autoTargetingTypeLabels[expression]}</div>
                                  {activeDuplicateAutoExpressions.length > 1 ? (
                                    <Button size="sm" variant="ghost" onClick={() => syncAutoBidRuleToOtherExpressions(expression)}>
                                      同步到其他类型
                                    </Button>
                                  ) : null}
                                </div>
                                <Labeled label="竞价规则">
                                  <Select value={config.mode} onValueChange={(value) => updateAutoBidRule(expression, { mode: value as BatchBidRuleMode })}>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                      {batchBidRuleModeOptions.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}
                                    </SelectContent>
                                  </Select>
                                </Labeled>
                                {config.mode === "fixed" || config.mode === "step" ? (
                                  <Labeled label={config.mode === "fixed" ? "固定竞价" : "竞价基准值"} hint="等差模式下，001 会在此基础上加减一步">
                                    <Input
                                      type="number"
                                      step="0.01"
                                      value={config.value}
                                      onChange={(e) => updateAutoBidRule(expression, { value: Number(e.target.value || 0) })}
                                    />
                                  </Labeled>
                                ) : null}
                                {config.mode === "list" ? (
                                  <Labeled label="竞价列表" hint="如 0.8,0.7,0.6">
                                    <Input
                                      value={config.listText}
                                      onChange={(e) => updateAutoBidRule(expression, { listText: e.target.value })}
                                      placeholder="0.8,0.7,0.6"
                                    />
                                  </Labeled>
                                ) : null}
                                {config.mode === "step" ? (
                                  <Labeled label="竞价步长" hint="可填负数，如每个 -0.05">
                                    <Input
                                      type="number"
                                      step="0.01"
                                      value={getDuplicateDialogStepInputValue(`autoBidRules.${expression}.step`, config.step)}
                                      onChange={(e) =>
                                        updateDuplicateDialogStepInput(`autoBidRules.${expression}.step`, e.target.value, (value) =>
                                          updateAutoBidRule(expression, { step: value })
                                        )
                                      }
                                      onBlur={() => clearDuplicateDialogStepDrafts([`autoBidRules.${expression}.step` as DuplicateDialogStepField])}
                                    />
                                  </Labeled>
                                ) : null}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ) : (
                      <div className="grid gap-3 sm:grid-cols-2">
                        <Labeled
                          label={duplicateSourceCampaign?.mode === "manual-keyword" ? "关键词竞价规则" : "商品投放竞价规则"}
                          hint="会统一作用于该活动内的主投放项"
                        >
                          <Select value={duplicateDialog.primaryBidMode} onValueChange={(value) => setDuplicateDialog((prev) => ({ ...prev, primaryBidMode: value as BatchBidRuleMode }))}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {batchBidRuleModeOptions.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </Labeled>
                        {duplicateDialog.primaryBidMode === "fixed" || duplicateDialog.primaryBidMode === "step" ? (
                          <Labeled label={duplicateDialog.primaryBidMode === "fixed" ? "主投放固定竞价" : "主投放竞价基准值"} hint="等差模式下，母版对应第 1 个编号">
                            <Input
                              type="number"
                              step="0.01"
                              value={duplicateDialog.primaryBidValue}
                              onChange={(e) => setDuplicateDialog((prev) => ({ ...prev, primaryBidValue: Number(e.target.value || 0) }))}
                            />
                          </Labeled>
                        ) : null}
                        {duplicateDialog.primaryBidMode === "list" ? (
                          <Labeled label="主投放竞价列表" hint="如 0.8,0.7,0.6">
                            <Input
                              value={duplicateDialog.primaryBidList}
                              onChange={(e) => setDuplicateDialog((prev) => ({ ...prev, primaryBidList: e.target.value }))}
                              placeholder="0.8,0.7,0.6"
                            />
                          </Labeled>
                        ) : null}
                        {duplicateDialog.primaryBidMode === "step" ? (
                          <Labeled label="主投放竞价步长" hint="可填负数，如每个 -0.05">
                            <Input
                              type="number"
                              step="0.01"
                              value={getDuplicateDialogStepInputValue("primaryBidStep", duplicateDialog.primaryBidStep)}
                              onChange={(e) =>
                                updateDuplicateDialogStepInput("primaryBidStep", e.target.value, (value) =>
                                  setDuplicateDialog((prev) => ({ ...prev, primaryBidStep: value }))
                                )
                              }
                              onBlur={() => clearDuplicateDialogStepDrafts(["primaryBidStep"])}
                            />
                          </Labeled>
                        ) : null}
                      </div>
                    )}
                  </div>
                  <div className="mt-4 rounded-lg border border-border/60 bg-muted/20 p-3 text-xs text-muted-foreground">
                    {(() => {
                      const source = duplicateSourceCampaign;
                      const suffix = buildBatchSequenceSuffix(
                        Math.max(0, Math.floor(duplicateDialog.startNumber)),
                        Math.min(6, Math.max(1, Math.floor(duplicateDialog.digits || 1))),
                        duplicateDialog.separator
                      );
                      const previewCampaignName = buildDuplicateValue(source?.campaignName || "活动", duplicateDialog.campaignNamePrefix, suffix);
                      const previewCampaignId = buildDuplicateValue(source?.campaignId || "Campaign", duplicateDialog.campaignIdPrefix, suffix);
                      const previewAdGroupName = buildDuplicateValue(source?.adGroups[0]?.adGroupName || "广告组", duplicateDialog.adGroupNamePrefix, suffix);
                      const previewAdGroupId = buildDuplicateValue(source?.adGroups[0]?.adGroupId || "AG", duplicateDialog.adGroupIdPrefix, suffix);
                      const previewCount = Math.min(Math.max(duplicateDialog.count + 1, 0), 5);
                      return (
                        <div className="grid gap-1.5">
                          <div>活动名：{previewCampaignName}</div>
                          <div>活动 ID：{previewCampaignId}</div>
                          <div>广告组名：{previewAdGroupName}</div>
                          <div>广告组 ID：{previewAdGroupId}</div>
                          {source ? (
                            <>
                              <div className="pt-1 font-medium text-foreground">前 {previewCount} 个活动竞价预览</div>
                              {Array.from({ length: previewCount }, (_, index) => {
                                const adGroupBid = resolveBatchBidRuleValue(duplicateDialog.adGroupBidMode, index, source.adGroups[0]?.adGroupDefaultBid ?? 0.75, {
                                  value: duplicateDialog.adGroupBidValue,
                                  listText: duplicateDialog.adGroupBidList,
                                  step: duplicateDialog.adGroupBidStep,
                                });
                                const primaryBid = resolveBatchBidRuleValue(duplicateDialog.primaryBidMode, index, getFirstPrimaryBid(source), {
                                  value: duplicateDialog.primaryBidValue,
                                  listText: duplicateDialog.primaryBidList,
                                  step: duplicateDialog.primaryBidStep,
                                });
                                return (
                                  <div key={index} className="grid gap-1 rounded-lg border border-border/40 bg-background/60 p-2">
                                    <div>#{index + 1} 广告组默认竞价 {adGroupBid}</div>
                                    {source.mode === "auto" ? (
                                      <div>
                                        {activeDuplicateAutoExpressions.map((expression) => {
                                          const config = duplicateDialog.autoBidRules[expression];
                                          const nextBid = resolveBatchBidRuleFromConfig(
                                            config,
                                            index,
                                            getAutoTargetingBidByExpression(source, expression)
                                          );
                                          return `${autoTargetingTypeLabels[expression]} ${nextBid}`;
                                        }).join(" | ")}
                                      </div>
                                    ) : (
                                      <div>{source.mode === "manual-keyword" ? "关键词" : "商品投放"}竞价 {primaryBid}</div>
                                    )}
                                  </div>
                                );
                              })}
                            </>
                          ) : null}
                        </div>
                      );
                    })()}
                  </div>
                </div>
                <DialogFooter className="border-t px-6 py-4">
                  <Button
                    variant="outline"
                    onClick={() => {
                      clearDuplicateDialogStepDrafts();
                      setDuplicateDialog((prev) => ({ ...prev, open: false, sourceIndex: null, sourceCampaign: null }));
                    }}
                  >
                    取消
                  </Button>
                  <Button onClick={createDuplicatedCampaigns}>立即生成</Button>
                </DialogFooter>
              </div>
            </DialogContent>
          </Dialog>
        ) : null}
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
  const [sbKeywordDefaultMatchTypes, setSbKeywordDefaultMatchTypes] = useState<PositiveKeywordMatchType[]>(["exact", "phrase", "broad"]);
  const [sbKeywordBulkBidInput, setSbKeywordBulkBidInput] = useState("");
  const [sbNegativeKeywordBulkInput, setSbNegativeKeywordBulkInput] = useState("");
  const [sbNegativeProductTargetingBulkInput, setSbNegativeProductTargetingBulkInput] = useState("");
  const [sbNegativeKeywordDefaultMatchType, setSbNegativeKeywordDefaultMatchType] = useState<NegativeKeywordMatchType>("negativePhrase");
  const [sbDuplicateOpen, setSbDuplicateOpen] = useState(false);
  const [sbDuplicateCount, setSbDuplicateCount] = useState(3);
  const [sbDuplicateStartNumber, setSbDuplicateStartNumber] = useState(1);
  const [sbDuplicateDigits, setSbDuplicateDigits] = useState(3);
  const [sbDuplicateSeparator, setSbDuplicateSeparator] = useState("-");
  const [sbDuplicateCampaignNamePrefix, setSbDuplicateCampaignNamePrefix] = useState("");
  const [sbDuplicateCampaignIdPrefix, setSbDuplicateCampaignIdPrefix] = useState("");
  const [sbDuplicateAdGroupIdPrefix, setSbDuplicateAdGroupIdPrefix] = useState("");

  function set<K extends keyof SbCampaignWizard>(key: K, value: SbCampaignWizard[K]) {
    setW((prev) => ({ ...prev, [key]: value }));
  }

  function toggleSbKeywordDefaultMatchType(matchType: PositiveKeywordMatchType) {
    setSbKeywordDefaultMatchTypes((prev) => {
      if (prev.includes(matchType)) {
        const next = prev.filter((item) => item !== matchType);
        return next.length ? next : prev;
      }
      return [...prev, matchType];
    });
  }

  function parseSbKeywordBulkInput() {
    const rows: SbCampaignWizard["keywords"] = [];
    let invalidCount = 0;
    for (const line of keywordBulkInput.split(/\r?\n/)) {
      const raw = line.trim();
      if (!raw) continue;
      const parts = raw.includes("\t") ? raw.split("\t").map((x) => x.trim()) : raw.split(",").map((x) => x.trim());
      const keywordText = parts[0] || "";
      if (!keywordText) {
        invalidCount += 1;
        continue;
      }
      const explicitMatchType = parseKeywordMatchType(parts[1]);
      const bidParsed = Number(parts[2]);
      const bid = Number.isFinite(bidParsed) && bidParsed > 0 ? bidParsed : 0.1;
      const state = parseState(parts[3]) ?? "enabled";
      const matchTypes = explicitMatchType ? [explicitMatchType] : sbKeywordDefaultMatchTypes;
      for (const matchType of matchTypes) rows.push({ text: keywordText, matchType, bid, state });
    }
    return { rows, invalidCount };
  }

  function importSbKeywordsFromBulkInput() {
    const { rows, invalidCount } = parseSbKeywordBulkInput();
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

  function activateSbCampaignSkag() {
    setW((prev) => ({ ...prev, splitSkag: true, skagScope: "campaigns" }));
    toast.success("SB 已设置为：一键生成SKAG（1活动1组1词）");
  }

  function activateSbAdGroupSplit() {
    setW((prev) => ({ ...prev, splitSkag: true, skagScope: "adGroups" }));
    toast.success("SB 已设置为：一键按词拆成多广告组（单活动多组）");
  }

  function applySbCustomKeywordBid() {
    const bid = Number(sbKeywordBulkBidInput);
    if (!(bid > 0)) {
      toast.error("请输入有效的自定义Bid");
      return;
    }
    set("keywords", w.keywords.map((row) => ({ ...row, bid })));
    toast.success(`已把 ${w.keywords.length} 条关键词的Bid设为 ${bid}`);
  }

  function importSbNegativeKeywordsFromBulkInput() {
    const { rows, invalidCount } = parseSpNegativeKeywordBulk(sbNegativeKeywordBulkInput, sbNegativeKeywordDefaultMatchType);
    if (!rows.length) {
      toast.error("没有可导入的否词", { description: "请按行粘贴，至少包含否定关键词文本。" });
      return;
    }
    const current = w.negativeKeywords.filter((k) => k.text.trim());
    set("negativeKeywords", [...current, ...rows]);
    setSbNegativeKeywordBulkInput("");
    toast.success(`已导入 ${rows.length} 条否词`, {
      description: invalidCount > 0 ? `其中 ${invalidCount} 行格式无效已跳过。` : "你可以在下方表格继续编辑。",
    });
  }

  function importSbNegativeProductTargetingsFromBulkInput() {
    const parsed = parseSpNegativeProductTargetingBulk(sbNegativeProductTargetingBulkInput);
    const rows = parsed.rows.map((row) => ({
      ...row,
      expression: /^B[A-Z0-9]{8,}$/i.test(row.expression.trim()) ? `asin="${row.expression.trim()}"` : row.expression,
    }));
    if (!rows.length) {
      toast.error("没有可导入的否定商品", { description: "请按行粘贴 ASIN 或 Product Targeting Expression。" });
      return;
    }
    const current = w.negativeProductTargetings.filter((x) => x.expression.trim());
    set("negativeProductTargetings", [...current, ...rows]);
    setSbNegativeProductTargetingBulkInput("");
    toast.success(`已导入 ${rows.length} 条否定商品`, {
      description: parsed.invalidCount > 0 ? `其中 ${parsed.invalidCount} 行格式无效已跳过。` : "你可以在下方表格继续编辑。",
    });
  }

  function openSbBatchDuplicateDialog() {
    const issues = validateSbWizard({ ...w, batchCopies: [] });
    if (issues.length) {
      toast.error("请先填写一个完整的SB母版后再批量复制", { description: issues.slice(0, 6).join("；") });
      return;
    }
    setSbDuplicateCampaignNamePrefix(w.campaignName.trim() || "");
    setSbDuplicateCampaignIdPrefix(w.campaignId.trim() || "");
    setSbDuplicateAdGroupIdPrefix(w.adGroupId.trim() || "");
    setSbDuplicateOpen(true);
  }

  function applySbBatchDuplicate() {
    const issues = validateSbWizard({ ...w, batchCopies: [] });
    if (issues.length) {
      toast.error("请先修正当前SB表单后再批量复制", { description: issues[0] });
      return;
    }
    const count = Math.max(0, Math.floor(sbDuplicateCount));
    if (count < 1) {
      toast.error("复制数量至少为 1");
      return;
    }
    const startNumber = Math.max(0, Math.floor(sbDuplicateStartNumber));
    const digits = Math.min(6, Math.max(1, Math.floor(sbDuplicateDigits || 1)));
    const source = { ...w, batchCopies: [] };
    const overrides = {
      campaignNamePrefix: sbDuplicateCampaignNamePrefix,
      campaignIdPrefix: sbDuplicateCampaignIdPrefix,
      adGroupIdPrefix: sbDuplicateAdGroupIdPrefix,
    };
    const sourceSuffix = buildBatchSequenceSuffix(startNumber, digits, sbDuplicateSeparator);
    const numberedSource = duplicateSbCampaignWizard(source, sourceSuffix, overrides);
    const copies = Array.from({ length: count }, (_, index) =>
      duplicateSbCampaignWizard(source, buildBatchSequenceSuffix(startNumber + index + 1, digits, sbDuplicateSeparator), overrides)
    );
    setW(() => ({ ...numberedSource, batchCopies: copies }));
    setSbDuplicateOpen(false);
    toast.success(`已生成 ${count + 1} 个SB活动`, { description: "母版也会占用第一个编号，导出时会一起写入SB表。" });
  }
  return (
    <div className="grid gap-5">
      <section className="grid gap-3">
        <div className="flex items-center justify-between gap-3">
          <h3 className="font-semibold">A. Campaign（品牌推广广告活动）</h3>
          <div className="flex flex-wrap items-center justify-end gap-2">
            <Badge variant="outline" className="font-mono text-[11px]">
              Sheet: Sponsored Brands Campaigns
            </Badge>
            <Button size="sm" className="bg-slate-900 text-white hover:bg-slate-800" onClick={openSbBatchDuplicateDialog}>
              批量复制
            </Button>
          </div>
        </div>
        <div className="text-xs text-muted-foreground">说明：导出时会自动填充 Entity 与 Operation=Create，ID字段用于层级关联，不是名称字段。</div>
        {(w.batchCopies?.length ?? 0) > 0 ? (
          <div className="rounded-lg border border-sky-200 bg-sky-50 p-3 text-xs text-sky-800">
            已生成 {1 + (w.batchCopies?.length ?? 0)} 个SB活动；导出时会把母版和复制活动一起写入。继续调整母版后，建议重新点一次“批量复制”刷新编号结果。
          </div>
        ) : null}

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
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <SectionTitle className="min-w-0 flex-1" tone="emerald">D. Keyword（投放关键词）</SectionTitle>
          <div className="flex w-full flex-wrap items-center gap-2 lg:w-auto lg:justify-end">
            <Badge variant="outline" className="font-mono text-[11px]">Entity: Keyword</Badge>
            <KeywordGenerationButton icon={<Crosshair className="h-4 w-4" />} label="一键生成SKAG" hint="1活动1组1词" className="bg-emerald-600 text-white shadow-sm hover:bg-emerald-700" onClick={activateSbCampaignSkag} disabled={!w.keywords.some((row) => row.text.trim())} />
            <KeywordGenerationButton icon={<SplitTree className="h-4 w-4" />} label="一键按词拆成多广告组" hint="单活动多组" className="bg-violet-600 text-white shadow-sm hover:bg-violet-700" onClick={activateSbAdGroupSplit} disabled={!w.keywords.some((row) => row.text.trim())} />
            {w.splitSkag ? <Button variant="outline" size="sm" onClick={() => setW((prev) => ({ ...prev, splitSkag: false }))}>关闭拆分</Button> : null}
            <Button variant="outline" size="sm" className="gap-2" onClick={() => set("keywords", [...w.keywords, { text: "", matchType: "phrase", bid: 0.1, state: "enabled" }])}>
              <Plus className="h-4 w-4" />添加
            </Button>
          </div>
        </div>

        <div className="rounded-lg border border-border/70 bg-muted/20 p-3">
          <div className="text-xs text-muted-foreground">
            批量输入：可直接粘贴多行关键词，支持 `关键词` 或 `关键词,匹配方式,bid,state`（支持 Tab 分隔）。未填写匹配方式时，会按下方已选匹配批量展开。
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span className="text-xs text-muted-foreground">默认匹配：</span>
            {([ ["exact", "精准"], ["phrase", "词组"], ["broad", "广泛"] ] as const).map(([value, label]) => {
              const active = sbKeywordDefaultMatchTypes.includes(value);
              return <Button key={value} size="sm" variant={active ? "default" : "outline"} onClick={() => toggleSbKeywordDefaultMatchType(value)}>{label}</Button>;
            })}
          </div>
          <Textarea
            value={keywordBulkInput}
            onChange={(e) => setKeywordBulkInput(e.target.value)}
            className="mt-2 min-h-[84px] font-mono text-[12px]"
            placeholder={"running shoes\nbrand keyword,phrase,0.1,enabled\nhiking boots\texact\t0.12\tpaused"}
          />
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Button size="sm" variant="outline" onClick={importSbKeywordsFromBulkInput}>
              批量导入关键词
            </Button>
            <Input type="number" className="h-8 w-[140px]" placeholder="自定义Bid" value={sbKeywordBulkBidInput} onChange={(e) => setSbKeywordBulkBidInput(e.target.value)} />
            <Button size="sm" variant="outline" onClick={applySbCustomKeywordBid}>应用自定义Bid</Button>
            {w.splitSkag ? <Badge variant="secondary">{w.skagScope === "campaigns" ? "当前：1活动1组1词" : "当前：单活动多广告组"}</Badge> : null}
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
      </section>

      <Separator />

      <section className="grid gap-3">
        <div className="flex items-center justify-between">
          <SectionTitle className="min-w-0 flex-1" tone="amber">E. Negative Keyword（否词，可选）</SectionTitle>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="font-mono text-[11px]">Entity: Negative Keyword</Badge>
            <Button variant="outline" size="sm" className="gap-2" onClick={() => set("negativeKeywords", [...w.negativeKeywords, { text: "", matchType: "negativePhrase", state: "enabled" }])}>
              <Plus className="h-4 w-4" />添加
            </Button>
          </div>
        </div>
        <div className="rounded-lg border border-border/70 bg-muted/20 p-3">
          <div className="text-xs text-muted-foreground">批量导入格式：`否词` 或 `否词,匹配方式,state`（支持 Tab 分隔；匹配方式支持 negativePhrase/negativeExact 或 否定词组/否定精准）。</div>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span className="text-xs text-muted-foreground">默认类型：</span>
            {([ ["negativeExact", "精准"], ["negativePhrase", "词组"] ] as const).map(([value, label]) => {
              const active = sbNegativeKeywordDefaultMatchType === value;
              return <Button key={value} size="sm" variant={active ? "default" : "outline"} onClick={() => setSbNegativeKeywordDefaultMatchType(value)}>{label}</Button>;
            })}
          </div>
          <div className="mt-2 grid gap-2 sm:grid-cols-[1fr_auto]">
            <Textarea value={sbNegativeKeywordBulkInput} onChange={(e) => setSbNegativeKeywordBulkInput(e.target.value)} className="min-h-[84px] font-mono text-[12px]" placeholder={"bad keyword,negativePhrase,enabled\nanother keyword\tnegativeExact\tpaused"} />
            <Button className="h-fit bg-sky-600 text-white hover:bg-sky-700 sm:self-end" onClick={importSbNegativeKeywordsFromBulkInput}>批量导入否词</Button>
          </div>
        </div>
        {w.negativeKeywords.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border/70 p-4 text-sm text-muted-foreground">还没有否词。需要的话点“添加”。</div>
        ) : (
          <div className="overflow-auto rounded-lg border border-border/70">
            <Table>
              <TableHeader><TableRow><TableHead className="min-w-[260px]">Keyword Text</TableHead><TableHead className="min-w-[220px]">Match Type</TableHead><TableHead className="min-w-[160px]">State</TableHead><TableHead className="w-[1%]"></TableHead></TableRow></TableHeader>
              <TableBody>{w.negativeKeywords.map((nk, idx) => (
                <TableRow key={idx}>
                  <TableCell><Input value={nk.text} onChange={(e) => set("negativeKeywords", w.negativeKeywords.map((x, i) => (i === idx ? { ...x, text: e.target.value } : x)))} placeholder="negative keyword" /></TableCell>
                  <TableCell><Select value={nk.matchType} onValueChange={(v) => set("negativeKeywords", w.negativeKeywords.map((x, i) => (i === idx ? { ...x, matchType: v as any } : x)))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{negMatchOptions.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent></Select></TableCell>
                  <TableCell><Select value={nk.state} onValueChange={(v) => set("negativeKeywords", w.negativeKeywords.map((x, i) => (i === idx ? { ...x, state: v as State } : x)))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{stateOptions.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent></Select></TableCell>
                  <TableCell><Button variant="ghost" size="icon" onClick={() => set("negativeKeywords", w.negativeKeywords.filter((_, i) => i !== idx))}><Trash2 className="h-4 w-4" /></Button></TableCell>
                </TableRow>
              ))}</TableBody>
            </Table>
          </div>
        )}
        <p className="text-xs text-muted-foreground">否词建议：词组否定不超过4个单词；精准否定不超过10个单词。导出时写入 SB 表的 `Negative Keyword` 行。</p>
      </section>

      <Separator />

      <section className="grid gap-3">
        <div className="flex items-center justify-between">
          <SectionTitle className="min-w-0 flex-1" tone="amber">F. Negative Product Targeting（否定ASIN/类目，可选）</SectionTitle>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="font-mono text-[11px]">Entity: Negative Product Targeting</Badge>
            <Button variant="outline" size="sm" className="gap-2" onClick={() => set("negativeProductTargetings", [...w.negativeProductTargetings, { expression: 'asin="B0XXXXXXXX"', state: "enabled" }])}>
              <Plus className="h-4 w-4" />添加
            </Button>
          </div>
        </div>
        <div className="rounded-lg border border-border/70 bg-muted/20 p-3">
          <div className="text-xs text-muted-foreground">批量导入格式：`ASIN`、`Product Targeting Expression` 或 `Product Targeting Expression,state`（支持 Tab 分隔）。直接粘贴 ASIN 会自动转成 `asin="..."`。</div>
          <div className="mt-2 grid gap-2 sm:grid-cols-[1fr_auto]">
            <Textarea value={sbNegativeProductTargetingBulkInput} onChange={(e) => setSbNegativeProductTargetingBulkInput(e.target.value)} className="min-h-[84px] font-mono text-[12px]" placeholder={'B0XXXXXXXX\nasin="B0YYYYYYYY",enabled'} />
            <Button className="h-fit bg-sky-600 text-white hover:bg-sky-700 sm:self-end" onClick={importSbNegativeProductTargetingsFromBulkInput}>批量导入否定商品</Button>
          </div>
        </div>
        {w.negativeProductTargetings.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border/70 p-4 text-sm text-muted-foreground">还没有否定商品。需要的话点“添加”。</div>
        ) : (
          <div className="overflow-auto rounded-lg border border-border/70">
            <Table>
              <TableHeader><TableRow><TableHead className="min-w-[360px]">Product Targeting Expression</TableHead><TableHead className="min-w-[160px]">State</TableHead><TableHead className="w-[1%]"></TableHead></TableRow></TableHeader>
              <TableBody>{w.negativeProductTargetings.map((npt, idx) => (
                <TableRow key={idx}>
                  <TableCell><Input value={npt.expression} onChange={(e) => set("negativeProductTargetings", w.negativeProductTargetings.map((x, i) => (i === idx ? { ...x, expression: e.target.value } : x)))} placeholder={'asin="B0XXXXXXXX"'} /></TableCell>
                  <TableCell><Select value={npt.state} onValueChange={(v) => set("negativeProductTargetings", w.negativeProductTargetings.map((x, i) => (i === idx ? { ...x, state: v as State } : x)))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{stateOptions.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent></Select></TableCell>
                  <TableCell><Button variant="ghost" size="icon" onClick={() => set("negativeProductTargetings", w.negativeProductTargetings.filter((_, i) => i !== idx))}><Trash2 className="h-4 w-4" /></Button></TableCell>
                </TableRow>
              ))}</TableBody>
            </Table>
          </div>
        )}
      </section>

      <Separator />

        <div className="rounded-lg border border-border/70 bg-muted/30 p-3 text-xs text-muted-foreground">
          提示：SB的字段（Ad Format、品牌资产ID等）会随账户与广告类型变化；如上传报错，请依据报错信息补齐对应字段或调整取值规则。
        </div>

      <Dialog open={sbDuplicateOpen} onOpenChange={setSbDuplicateOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>批量复制多个类似SB活动</DialogTitle>
            <DialogDescription>
              当前SB表单会作为母版，生成编号后的 Campaign ID / Campaign Name / Ad Group ID；关键词、否词、否定商品和创意字段会同步复制。
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4">
            <div className="grid gap-3 sm:grid-cols-4">
              <Labeled label="复制数量" required hint="额外复制数量；母版也会编号">
                <Input type="number" min={1} value={sbDuplicateCount} onChange={(e) => setSbDuplicateCount(Number(e.target.value || 0))} />
              </Labeled>
              <Labeled label="起始编号" required>
                <Input type="number" min={0} value={sbDuplicateStartNumber} onChange={(e) => setSbDuplicateStartNumber(Number(e.target.value || 0))} />
              </Labeled>
              <Labeled label="编号位数" required>
                <Input type="number" min={1} max={6} value={sbDuplicateDigits} onChange={(e) => setSbDuplicateDigits(Number(e.target.value || 1))} />
              </Labeled>
              <Labeled label="分隔符">
                <Input value={sbDuplicateSeparator} onChange={(e) => setSbDuplicateSeparator(e.target.value)} placeholder="-" />
              </Labeled>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <Labeled label="Campaign Name 前缀" hint="留空则在原值后追加编号">
                <Input value={sbDuplicateCampaignNamePrefix} onChange={(e) => setSbDuplicateCampaignNamePrefix(e.target.value)} placeholder="SB-Brand-" />
              </Labeled>
              <Labeled label="Campaign ID 前缀" hint="留空则在原值后追加编号">
                <Input value={sbDuplicateCampaignIdPrefix} onChange={(e) => setSbDuplicateCampaignIdPrefix(e.target.value)} placeholder="SB-C-" />
              </Labeled>
              <Labeled label="Ad Group ID 前缀" hint="留空则在原值后追加编号">
                <Input value={sbDuplicateAdGroupIdPrefix} onChange={(e) => setSbDuplicateAdGroupIdPrefix(e.target.value)} placeholder="SB-AG-" />
              </Labeled>
            </div>
            <div className="rounded-lg border border-border/70 bg-muted/30 p-3 text-xs text-muted-foreground">
              预览：{buildDuplicateValue(w.campaignName || "Campaign", sbDuplicateCampaignNamePrefix, buildBatchSequenceSuffix(Math.max(0, Math.floor(sbDuplicateStartNumber)), Math.min(6, Math.max(1, Math.floor(sbDuplicateDigits || 1))), sbDuplicateSeparator))}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSbDuplicateOpen(false)}>取消</Button>
            <Button onClick={applySbBatchDuplicate}>立即生成</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
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
      <div className="grid gap-0.5">
        <div className={cn("text-sm font-medium leading-5", labelClassName)}>
          {label}
          {required && <span className="text-destructive"> *</span>}
        </div>
        {hint && <div className="text-xs leading-5 text-muted-foreground">{hint}</div>}
      </div>
      {children}
    </div>
  );
}

function SectionTitle({
  children,
  tone = "sky",
  className,
}: {
  children: ReactNode;
  tone?: "sky" | "indigo" | "emerald" | "amber";
  className?: string;
}) {
  const toneClassName =
    tone === "indigo"
      ? "border-indigo-200/80 bg-indigo-50/80 text-indigo-900 dark:border-indigo-500/30 dark:bg-indigo-500/10 dark:text-indigo-100"
      : tone === "emerald"
        ? "border-emerald-200/80 bg-emerald-50/80 text-emerald-900 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-100"
        : tone === "amber"
          ? "border-amber-200/80 bg-amber-50/80 text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-100"
          : "border-sky-200/80 bg-sky-50/80 text-sky-900 dark:border-sky-500/30 dark:bg-sky-500/10 dark:text-sky-100";

  return (
    <div className={cn("flex items-center gap-3", className)}>
      <h3 className={cn("inline-flex items-center rounded-lg border px-3 py-1.5 text-sm font-semibold tracking-tight shadow-sm", toneClassName)}>
        {children}
      </h3>
      <div className="hidden h-px flex-1 border-t border-dashed border-border/60 sm:block" />
    </div>
  );
}
