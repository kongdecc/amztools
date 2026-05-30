// 设计理念：Spreadsheet Punk（工业表格朋克）
// - 以“工具感/效率感”为核心：高对比、密度适中、强调结构线与信息层级
// - 强调可视化录入 → 自动生成Bulk Sheet行，不强迫用户直接编辑Excel

export type SpBiddingStrategy = "Fixed bid" | "Dynamic bids - down only" | "Dynamic bids - up and down";
export type State = "enabled" | "paused";
export type SpMatchType = "broad" | "phrase" | "exact" | "negativeExact" | "negativePhrase";

export type SpPlacement = "placementTop" | "placementRestOfSearch" | "placementProductPage" | "placementAmazonBusiness";

export type SdBudgetType = "daily" | "lifetime";
export type SdTactic =
  | "T00020" // SD views remarketing
  | "T00030" // SD product targeting
  | "T00040" // SD audiences
  | string;

export const SHEETS = {
  sbCampaigns: "Sponsored Brands Campaigns",
  sbMultiAdGroup: "SB Multi Ad Group Campaigns",
  rasCampaigns: "RAS Campaigns",
  sdCampaigns: "Sponsored Display Campaigns",
  portfolios: "Portfolios",
  spCampaigns: "Sponsored Products Campaigns",
  config: "Config",
} as const;

// 来自你上传的 AmazonAdvertisingBulksheetSellerTemplate (1).xlsx 头部
export const HEADERS = {
  [SHEETS.sbCampaigns]: [
    "Product",
    "Entity",
    "Operation",
    "Campaign ID",
    "Draft Campaign ID",
    "Portfolio ID",
    "Ad Group ID",
    "Keyword ID",
    "Product Targeting ID",
    "Campaign Name",
    "Start Date",
    "End Date",
    "State",
    "Budget Type",
    "Budget",
    "Bid Optimization",
    "Bid Multiplier",
    "Bid",
    "Keyword Text",
    "Match Type",
    "Product Targeting Expression",
    "Ad Format",
    "Landing Page URL",
    "Landing Page ASINs",
    "Brand Entity ID",
    "Brand Name",
    "Brand Logo Asset ID",
    "Custom Image Asset ID",
    "Creative Headline",
    "Creative ASINs",
    "Video Media IDs",
    "Creative Type",
  ],
  [SHEETS.sbMultiAdGroup]: [
    "Product",
    "Entity",
    "Operation",
    "Campaign ID",
    "Portfolio ID",
    "Ad Group ID",
    "Ad ID",
    "Keyword ID",
    "Product Targeting ID",
    "Campaign Name",
    "Ad Group Name",
    "Ad Name",
    "Start Date",
    "End Date",
    "State",
    "Brand Entity ID",
    "Budget Type",
    "Budget",
    "Bid Optimization",
    "Product Location",
    "Bid",
    "Placement",
    "Percentage",
    "Audience ID",
    "Shopper Cohort Percentage",
    "Shopper Cohort Type",
    "Keyword Text",
    "Match Type",
    "Native Language Keyword",
    "Native Language Locale",
    "Product Targeting Expression",
    "Landing Page URL",
    "Landing Page ASINs",
    "Landing Page Type",
    "Brand Name",
    "Consent To Translate",
    "Brand Logo Asset ID",
    "Brand Logo Crop",
    "Custom Images",
    "Creative Headline",
    "Creative ASINs",
    "Video Asset IDs",
    "Subpages",
    "Sites",
  ],
  [SHEETS.rasCampaigns]: [
    "Product",
    "Entity",
    "Operation",
    "Campaign ID",
    "Ad Group ID",
    "Target ID",
    "Product Ad ID",
    "Portfolio ID",
    "Retailer ID",
    "Retailer Offer ID",
    "Name",
    "State",
    "Start Date",
    "End Date",
    "Targeting Type",
    "Target Type",
    "Target Level",
    "Budget",
    "Budget Type",
    "Ad Group Default Bid",
    "Negative",
    "Bid",
    "Currency Code",
    "Keyword Text",
    "Keyword Match Type",
    "Auto Match Type",
    "Bidding Strategy",
    "Bidding Adjustment Percentage",
    "Bidding Adjustment Placement",
  ],
  [SHEETS.sdCampaigns]: [
    "Product",
    "Entity",
    "Operation",
    "Campaign ID",
    "Portfolio ID",
    "Ad Group ID",
    "Ad ID",
    "Targeting ID",
    "Campaign Name",
    "Ad Group Name",
    "Start Date",
    "End Date",
    "State",
    "Tactic",
    "Budget Type",
    "Budget",
    "SKU",
    "Ad Group Default Bid",
    "Bid",
    "Bid Optimization",
    "Cost Type",
    "Targeting Expression",
  ],
  [SHEETS.portfolios]: [
    "Product",
    "Entity",
    "Operation",
    "Portfolio ID",
    "Portfolio Name",
    "Budget Amount",
    "Budget Currency Code",
    "Budget Policy",
    "Budget Start Date",
    "Budget End Date",
  ],
  [SHEETS.spCampaigns]: [
    "Product",
    "Entity",
    "Operation",
    "Campaign ID",
    "Ad Group ID",
    "Portfolio ID",
    "Ad ID",
    "Keyword ID",
    "Product Targeting ID",
    "Campaign Name",
    "Ad Group Name",
    "Start Date",
    "End Date",
    "Targeting Type",
    "State",
    "Daily Budget",
    "SKU",
    "Ad Group Default Bid",
    "Bid",
    "Keyword Text",
    "Native Language Keyword",
    "Native Language Locale",
    "Match Type",
    "Bidding Strategy",
    "Placement",
    "Percentage",
    "Product Targeting Expression",
    "Audience ID",
    "Shopper Cohort Percentage",
    "Shopper Cohort Type",
    "Sites",
  ],
  [SHEETS.config]: [],
} as const;

export type SheetName = (typeof SHEETS)[keyof typeof SHEETS];

export type SpCampaignWizard = {
  mode: "manual-keyword" | "auto" | "manual-product-targeting";

  campaignId: string;
  campaignName: string;
  startDate: string; // yyyymmdd
  endDate?: string;
  targetingType: "MANUAL" | "AUTO";
  state: State;
  dailyBudget: number;
  portfolioId?: string;
  biddingStrategy: SpBiddingStrategy;

  placementTopPct?: number;
  placementRestPct?: number;
  placementProductPagePct?: number;

  adGroupId: string;
  adGroupName: string;
  adGroupState: State;
  adGroupDefaultBid: number;

  skus: string[];

  keywords: Array<{ text: string; matchType: Exclude<SpMatchType, "negativeExact" | "negativePhrase">; bid: number; state: State }>;
  negativeKeywords: Array<{ text: string; matchType: Extract<SpMatchType, "negativeExact" | "negativePhrase">; state: State }>;
  negativeProductTargetings: Array<{ expression: string; state: State }>;

  productTargetings: Array<{ expression: string; bid?: number; state: State }>;
};

export type PortfolioWizard = {
  portfolioId: string;
  portfolioName: string;
  operation: "Create" | "Update" | "Archive";
  budgetAmount?: number;
  budgetCurrencyCode?: string; // e.g. USD
  budgetPolicy?: string; // e.g. "daily"
  budgetStartDate?: string; // yyyymmdd
  budgetEndDate?: string; // yyyymmdd
};

export type SbMatchType = "broad" | "phrase" | "exact";

export type SbCampaignWizard = {
  campaignId: string;
  campaignName: string;
  startDate: string; // yyyymmdd
  endDate?: string;
  state: State;

  budgetType: "daily" | "lifetime";
  budget: number;

  portfolioId?: string;

  // SB常见结构：Campaign / Ad Group / Keyword（或Product Targeting）
  adGroupId: string;

  // 创意/落地页
  adFormat: string; // 例如 productCollection / video / storeSpotlight（以账户支持为准）
  landingPageUrl?: string;
  landingPageAsins: string[];
  creativeHeadline: string;
  creativeAsins: string[];

  // 品牌字段（很多账户可留空或由后台生成；这里先做可选）
  brandEntityId?: string;
  brandName?: string;
  brandLogoAssetId?: string;
  customImageAssetId?: string;

  keywords: Array<{ text: string; matchType: SbMatchType; bid: number; state: State }>;
};

export type SdCampaignWizard = {
  campaignId: string;
  campaignName: string;
  startDate: string; // yyyymmdd
  endDate?: string;
  state: State;
  portfolioId?: string;

  tactic: SdTactic;
  budgetType: SdBudgetType;
  budget: number;

  adGroupId: string;
  adGroupName: string;
  adGroupDefaultBid: number;

  skus: string[];

  // 目标表达式：
  // - 商品/类目：例如 asin="B0XXXX"、asin-expanded="B0XXXX"
  // - 受众/再营销等：实际以模板/账户支持为准
  targetings: Array<{ expression: string; bid?: number; state: State }>;

  // 这两列在部分账户/场景可能需要；MVP先可选
  bidOptimization?: string;
  costType?: string;
};

export type SpBulkRow = Partial<Record<(typeof HEADERS)[typeof SHEETS.spCampaigns][number], string | number | undefined>>;
export type SbBulkRow = Partial<Record<(typeof HEADERS)[typeof SHEETS.sbCampaigns][number], string | number | undefined>>;
export type SdBulkRow = Partial<Record<(typeof HEADERS)[typeof SHEETS.sdCampaigns][number], string | number | undefined>>;
export type PortfolioBulkRow = Partial<Record<(typeof HEADERS)[typeof SHEETS.portfolios][number], string | number | undefined>>;

function yyyymmdd(value: string) {
  const v = value.trim();
  if (!/^\d{8}$/.test(v)) return null;
  return v;
}

export type ValidationResult = { errors: string[]; warnings: string[] };

function countWords(s: string) {
  return s
    .trim()
    .split(/\s+/)
    .map((x) => x.trim())
    .filter(Boolean).length;
}

function compactLines(lines: string[]) {
  return lines
    .map((x) => x.trim())
    .filter(Boolean);
}

export function validateSpWizard(w: SpCampaignWizard): string[] {
  const issues: string[] = [];
  const skus = compactLines(w.skus);
  if (!w.campaignId.trim()) issues.push("Campaign ID 不能为空");
  if (!w.campaignName.trim()) issues.push("Campaign Name 不能为空");
  if (!yyyymmdd(w.startDate)) issues.push("Start Date 必须是8位数字（YYYYMMDD）");
  if (w.endDate && !yyyymmdd(w.endDate)) issues.push("End Date 必须是8位数字（YYYYMMDD）");
  if (!(w.dailyBudget > 0)) issues.push("Daily Budget 必须大于0");
  if (!w.adGroupId.trim()) issues.push("Ad Group ID 不能为空");
  if (!w.adGroupName.trim()) issues.push("Ad Group Name 不能为空");
  if (!(w.adGroupDefaultBid > 0)) issues.push("Ad Group Default Bid 必须大于0");
  if (!skus.length) issues.push("至少填写1个SKU");

  if (w.mode === "manual-keyword") {
    if (!w.keywords.length) issues.push("手动关键词模式：至少填写1个关键词");
    for (const [i, k] of w.keywords.entries()) {
      if (!k.text.trim()) issues.push(`关键词第${i + 1}行：Keyword Text 不能为空`);
      if (!(k.bid > 0)) issues.push(`关键词第${i + 1}行：Bid 必须大于0`);
    }
  }

  if (w.mode === "manual-product-targeting") {
    if (!w.productTargetings.length) issues.push("商品定位模式：至少填写1条Product Targeting Expression");
    for (const [i, t] of w.productTargetings.entries()) {
      if (!t.expression.trim()) issues.push(`商品定位第${i + 1}行：Expression 不能为空`);
      if (!(Number(t.bid) > 0)) issues.push(`商品定位第${i + 1}行：Bid 必须大于0`);
    }
  }

  if (w.mode === "auto") {
    if (!w.productTargetings.length) issues.push("自动广告模式：建议填写4种自动投放（close/loose/substitutes/complements）并按需暂停其余");
    for (const [i, t] of w.productTargetings.entries()) {
      if (!t.expression.trim()) issues.push(`自动投放第${i + 1}行：Expression 不能为空`);
      if (!(Number(t.bid) > 0)) issues.push(`自动投放第${i + 1}行：Bid 必须大于0`);
    }
  }

  for (const [i, nk] of w.negativeKeywords.entries()) {
    if (!nk.text.trim()) issues.push(`否词第${i + 1}行：Keyword Text 不能为空`);
  }
  for (const [i, npt] of w.negativeProductTargetings.entries()) {
    if (!npt.expression.trim()) issues.push(`否定ASIN第${i + 1}行：Product Targeting Expression 不能为空`);
  }

  const pctFields: Array<[string, number | undefined]> = [
    ["placementTop", w.placementTopPct],
    ["placementRestOfSearch", w.placementRestPct],
    ["placementProductPage", w.placementProductPagePct],
  ];
  for (const [name, pct] of pctFields) {
    if (pct == null) continue;
    if (!Number.isFinite(pct) || pct < 0 || pct > 900) issues.push(`${name} Percentage 需在0-900之间`);
  }

  return issues;
}

export function validatePortfolioWizard(p: PortfolioWizard): string[] {
  const issues: string[] = [];
  if (!p.portfolioId.trim()) issues.push("Portfolio ID 不能为空");
  if (p.operation !== "Archive" && !p.portfolioName.trim()) issues.push("Portfolio Name 不能为空（Archive除外）");
  if (p.budgetStartDate && !yyyymmdd(p.budgetStartDate)) issues.push("Budget Start Date 必须是YYYYMMDD");
  if (p.budgetEndDate && !yyyymmdd(p.budgetEndDate)) issues.push("Budget End Date 必须是YYYYMMDD");
  return issues;
}

export function validateSbWizard(w: SbCampaignWizard): string[] {
  const issues: string[] = [];
  const landingPageAsins = compactLines(w.landingPageAsins);
  const creativeAsins = compactLines(w.creativeAsins);
  if (!w.campaignId.trim()) issues.push("Campaign ID 不能为空");
  if (!w.campaignName.trim()) issues.push("Campaign Name 不能为空");
  if (!yyyymmdd(w.startDate)) issues.push("Start Date 必须是YYYYMMDD");
  if (w.endDate && !yyyymmdd(w.endDate)) issues.push("End Date 必须是YYYYMMDD");
  if (!(w.budget > 0)) issues.push("Budget 必须大于0");
  if (!w.adGroupId.trim()) issues.push("Ad Group ID 不能为空");
  if (!w.adFormat.trim()) issues.push("Ad Format 不能为空（不同SB类型会不同）");
  if (!landingPageAsins.length && !w.landingPageUrl) issues.push("Landing Page ASINs 或 Landing Page URL 至少填写一个");
  if (!w.creativeHeadline.trim()) issues.push("Creative Headline 不能为空");
  if (!creativeAsins.length) issues.push("Creative ASINs 至少填写1个");
  if (!w.keywords.length) issues.push("至少填写1个关键词");
  for (const [i, k] of w.keywords.entries()) {
    if (!k.text.trim()) issues.push(`关键词第${i + 1}行：Keyword Text 不能为空`);
    if (!(k.bid > 0)) issues.push(`关键词第${i + 1}行：Bid 必须大于0`);
  }
  return issues;
}

export function validateSdWizard(w: SdCampaignWizard): string[] {
  const issues: string[] = [];
  const skus = compactLines(w.skus);
  if (!w.campaignId.trim()) issues.push("Campaign ID 不能为空");
  if (!w.campaignName.trim()) issues.push("Campaign Name 不能为空");
  if (!yyyymmdd(w.startDate)) issues.push("Start Date 必须是YYYYMMDD");
  if (w.endDate && !yyyymmdd(w.endDate)) issues.push("End Date 必须是YYYYMMDD");
  if (!(w.budget > 0)) issues.push("Budget 必须大于0");
  if (!w.tactic.trim()) issues.push("Tactic 不能为空（不同场景有不同代码）");
  if (!w.adGroupId.trim()) issues.push("Ad Group ID 不能为空");
  if (!w.adGroupName.trim()) issues.push("Ad Group Name 不能为空");
  if (!(w.adGroupDefaultBid > 0)) issues.push("Ad Group Default Bid 必须大于0");
  if (!skus.length) issues.push("至少填写1个SKU");
  if (!w.targetings.length) issues.push("至少填写1条Targeting Expression");
  for (const [i, t] of w.targetings.entries()) {
    if (!t.expression.trim()) issues.push(`Targeting第${i + 1}行：Expression 不能为空`);
  }
  return issues;
}

// 非阻断提醒：长度/单词数/最低竞价等
export function warnSpWizard(w: SpCampaignWizard, opts?: { minBidSp?: number; keywordMaxChars?: number }) {
  const minBid = opts?.minBidSp ?? 0.02;
  const maxChars = opts?.keywordMaxChars ?? 80;
  const warnings: string[] = [];

  // 关键词：长度/单词数
  for (const [i, k] of w.keywords.entries()) {
    const text = (k.text || "").trim();
    if (!text) continue;
    if (text.length > maxChars) warnings.push(`关键词第${i + 1}行：长度为${text.length}字符，可能超过平台限制（建议≤${maxChars}）`);
    const words = countWords(text);
    if (words > 10) warnings.push(`关键词第${i + 1}行：包含${words}个单词，可能过长（建议≤10）`);
    if (k.bid != null && Number(k.bid) < minBid) warnings.push(`关键词第${i + 1}行：Bid ${k.bid} 低于最低建议出价 ${minBid}`);
  }

  // 商品定位：Bid最低价
  for (const [i, t] of w.productTargetings.entries()) {
    if (t.bid != null && Number(t.bid) < minBid) warnings.push(`商品定位第${i + 1}行：Bid ${t.bid} 低于最低建议出价 ${minBid}`);
  }

  // 否词：单词数限制（来自你提供的资料里的常见经验值）
  for (const [i, nk] of w.negativeKeywords.entries()) {
    const text = (nk.text || "").trim();
    if (!text) continue;
    const words = countWords(text);
    if (nk.matchType === "negativePhrase" && words > 4) warnings.push(`否词第${i + 1}行：词组否定含${words}个单词，可能会报错（经验值≤4）`);
    if (nk.matchType === "negativeExact" && words > 10) warnings.push(`否词第${i + 1}行：精准否定含${words}个单词，可能会报错（经验值≤10）`);
  }

  // 广告组默认竞价提醒
  if (w.adGroupDefaultBid != null && Number(w.adGroupDefaultBid) < minBid) warnings.push(`Ad Group Default Bid ${w.adGroupDefaultBid} 低于最低建议出价 ${minBid}`);

  // 广告位百分比范围（虽然errors里也会挡住，但这里给更友好提示）
  const pctFields: Array<[string, number | undefined]> = [
    ["placementTop", w.placementTopPct],
    ["placementRestOfSearch", w.placementRestPct],
    ["placementProductPage", w.placementProductPagePct],
  ];
  for (const [name, pct] of pctFields) {
    if (pct == null) continue;
    if (pct < 0 || pct > 900) warnings.push(`${name} Percentage 为${pct}，建议范围0-900`);
  }

  return warnings;
}

export function warnSbWizard(w: SbCampaignWizard, opts?: { minBidSb?: number; keywordMaxChars?: number }) {
  const minBid = opts?.minBidSb ?? 0.1;
  const maxChars = opts?.keywordMaxChars ?? 80;
  const warnings: string[] = [];

  for (const [i, k] of w.keywords.entries()) {
    const text = (k.text || "").trim();
    if (!text) continue;
    if (text.length > maxChars) warnings.push(`关键词第${i + 1}行：长度为${text.length}字符，可能超过平台限制（建议≤${maxChars}）`);
    const words = countWords(text);
    if (words > 10) warnings.push(`关键词第${i + 1}行：包含${words}个单词，可能过长（建议≤10）`);
    if (k.bid != null && Number(k.bid) < minBid) warnings.push(`关键词第${i + 1}行：Bid ${k.bid} 低于最低建议出价 ${minBid}`);
  }

  return warnings;
}

export function warnSdWizard(w: SdCampaignWizard, opts?: { minBidSd?: number }) {
  const minBid = opts?.minBidSd ?? 0.02;
  const warnings: string[] = [];

  if (w.adGroupDefaultBid != null && Number(w.adGroupDefaultBid) < minBid) warnings.push(`Ad Group Default Bid ${w.adGroupDefaultBid} 低于最低建议出价 ${minBid}`);

  for (const [i, t] of w.targetings.entries()) {
    if (t.bid != null && Number(t.bid) < minBid) warnings.push(`Targeting第${i + 1}行：Bid ${t.bid} 低于最低建议出价 ${minBid}`);
  }

  return warnings;
}


function spBaseRow(w: SpCampaignWizard): SpBulkRow {
  return {
    Product: "Sponsored Products",
    Operation: "Create",
    "Campaign ID": w.campaignId,
    "Ad Group ID": w.adGroupId,
    "Portfolio ID": w.portfolioId || "",
    "Campaign Name": w.campaignName,
    "Ad Group Name": w.adGroupName,
    "Start Date": w.startDate,
    "End Date": w.endDate || "",
    "Targeting Type": w.targetingType,
    State: w.state,
    "Daily Budget": w.dailyBudget,
    "Bidding Strategy": w.biddingStrategy,
  };
}

export function buildSpRows(w: SpCampaignWizard): SpBulkRow[] {
  const rows: SpBulkRow[] = [];
  const skus = compactLines(w.skus);

  // 1) Campaign
  rows.push({
    ...spBaseRow(w),
    Entity: "Campaign",
  });

  // 2) Bidding Adjustment (可选)
  const placements: Array<[SpPlacement, number | undefined]> = [
    ["placementTop", w.placementTopPct],
    ["placementRestOfSearch", w.placementRestPct],
    ["placementProductPage", w.placementProductPagePct],
  ];
  for (const [placement, pct] of placements) {
    if (pct == null) continue;
    rows.push({
      ...spBaseRow(w),
      Entity: "Bidding Adjustment",
      Placement: placement,
      Percentage: pct,
    });
  }

  // 3) Ad Group
  rows.push({
    ...spBaseRow(w),
    Entity: "Ad Group",
    State: w.adGroupState,
    "Ad Group Default Bid": w.adGroupDefaultBid,
  });

  // 4) Product Ads (SKU)
  for (const sku of skus) {
    rows.push({
      ...spBaseRow(w),
      Entity: "Product Ad",
      State: "enabled",
      SKU: sku,
    });
  }

  // 5) Keyword / Product Targeting
  if (w.mode === "manual-keyword") {
    for (const k of w.keywords) {
      rows.push({
        ...spBaseRow(w),
        Entity: "Keyword",
        State: k.state,
        Bid: k.bid,
        "Keyword Text": k.text,
        "Match Type": k.matchType,
      });
    }
  }

  if (w.mode === "auto" || w.mode === "manual-product-targeting") {
    for (const t of w.productTargetings) {
      rows.push({
        ...spBaseRow(w),
        Entity: "Product Targeting",
        State: t.state,
        Bid: t.bid ?? w.adGroupDefaultBid,
        "Product Targeting Expression": t.expression,
      });
    }
  }

  // 6) Negative Keywords
  for (const nk of w.negativeKeywords) {
    rows.push({
      ...spBaseRow(w),
      Entity: "Negative Keyword",
      State: nk.state,
      "Keyword Text": nk.text,
      "Match Type": nk.matchType,
    });
  }

  // 7) Negative Product Targeting (否定ASIN/类目等)
  for (const npt of w.negativeProductTargetings) {
    rows.push({
      ...spBaseRow(w),
      Entity: "Negative Product Targeting",
      State: npt.state,
      "Product Targeting Expression": npt.expression,
    });
  }

  return rows;
}

export function buildPortfolioRows(p: PortfolioWizard): PortfolioBulkRow[] {
  return [
    {
      Product: "Sponsored Products",
      Entity: "Portfolio",
      Operation: p.operation,
      "Portfolio ID": p.portfolioId,
      "Portfolio Name": p.portfolioName,
      "Budget Amount": p.budgetAmount ?? "",
      "Budget Currency Code": p.budgetCurrencyCode ?? "",
      "Budget Policy": p.budgetPolicy ?? "",
      "Budget Start Date": p.budgetStartDate ?? "",
      "Budget End Date": p.budgetEndDate ?? "",
    },
  ];
}

function sbBaseRow(w: SbCampaignWizard): SbBulkRow {
  const landingPageAsins = compactLines(w.landingPageAsins);
  const creativeAsins = compactLines(w.creativeAsins);
  return {
    Product: "Sponsored Brands",
    Operation: "Create",
    "Campaign ID": w.campaignId,
    "Portfolio ID": w.portfolioId || "",
    "Ad Group ID": w.adGroupId,
    "Campaign Name": w.campaignName,
    "Start Date": w.startDate,
    "End Date": w.endDate || "",
    State: w.state,
    "Budget Type": w.budgetType,
    Budget: w.budget,
    "Ad Format": w.adFormat,
    "Landing Page URL": w.landingPageUrl || "",
    "Landing Page ASINs": landingPageAsins.join(","),
    "Brand Entity ID": w.brandEntityId || "",
    "Brand Name": w.brandName || "",
    "Brand Logo Asset ID": w.brandLogoAssetId || "",
    "Custom Image Asset ID": w.customImageAssetId || "",
    "Creative Headline": w.creativeHeadline,
    "Creative ASINs": creativeAsins.join(","),
  };
}

export function buildSbRows(w: SbCampaignWizard): SbBulkRow[] {
  const rows: SbBulkRow[] = [];

  // Campaign
  rows.push({
    ...sbBaseRow(w),
    Entity: "Campaign",
  });

  // Ad Group
  rows.push({
    ...sbBaseRow(w),
    Entity: "Ad Group",
  });

  // Keywords
  for (const k of w.keywords) {
    rows.push({
      ...sbBaseRow(w),
      Entity: "Keyword",
      State: k.state,
      Bid: k.bid,
      "Keyword Text": k.text,
      "Match Type": k.matchType,
    });
  }

  return rows;
}

function sdBaseRow(w: SdCampaignWizard): SdBulkRow {
  return {
    Product: "Sponsored Display",
    Operation: "Create",
    "Campaign ID": w.campaignId,
    "Portfolio ID": w.portfolioId || "",
    "Ad Group ID": w.adGroupId,
    "Campaign Name": w.campaignName,
    "Ad Group Name": w.adGroupName,
    "Start Date": w.startDate,
    "End Date": w.endDate || "",
    State: w.state,
    Tactic: w.tactic,
    "Budget Type": w.budgetType,
    Budget: w.budget,
    "Ad Group Default Bid": w.adGroupDefaultBid,
    "Bid Optimization": w.bidOptimization || "",
    "Cost Type": w.costType || "",
  };
}

export function buildSdRows(w: SdCampaignWizard): SdBulkRow[] {
  const rows: SdBulkRow[] = [];
  const skus = compactLines(w.skus);

  rows.push({
    ...sdBaseRow(w),
    Entity: "Campaign",
  });

  rows.push({
    ...sdBaseRow(w),
    Entity: "Ad Group",
  });

  for (const sku of skus) {
    rows.push({
      ...sdBaseRow(w),
      Entity: "Ad",
      SKU: sku,
      State: "enabled",
    });
  }

  for (const t of w.targetings) {
    rows.push({
      ...sdBaseRow(w),
      Entity: "Targeting",
      Bid: t.bid ?? "",
      "Targeting Expression": t.expression,
      State: t.state,
    });
  }

  return rows;
}

export function rowsToAoA(headers: readonly string[], rows: Record<string, any>[]) {
  const aoa: any[][] = [Array.from(headers)];
  for (const r of rows) {
    aoa.push(headers.map((h) => (r[h] == null ? "" : r[h])));
  }
  return aoa;
}
