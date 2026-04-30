import * as XLSX from 'xlsx';
import { nanoid } from 'nanoid';

type ColumnSpec = {
  aliases: string[];
  regexes?: RegExp[];
};

export type TargetingRecord = {
  id: string;
  date: string;
  campaignName: string;
  adGroupName: string;
  targeting: string;
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
};

export type CampaignRecord = {
  id: string;
  startDate: string;
  endDate: string;
  campaignName: string;
  campaignType: string;
  targetingType: string;
  biddingStrategy: string;
  status: string;
  budget: number;
  impressions: number;
  clicks: number;
  spend: number;
  sales: number;
  orders: number;
  ctr: number;
  cpc: number;
  acos: number;
  roas: number;
};

export type PlacementRecord = {
  id: string;
  startDate: string;
  endDate: string;
  campaignName: string;
  biddingStrategy: string;
  placement: string;
  placementBucket: 'TOS' | 'ROS' | 'PP' | 'OFFSITE' | 'OTHER';
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
};

export type BudgetRecord = {
  id: string;
  startDate: string;
  endDate: string;
  campaignName: string;
  status: string;
  targetingType: string;
  biddingStrategy: string;
  budget: number;
  suggestedBudget: number;
  budgetInRangeRate: number;
  impressions: number;
  missedImpressionsMin: number;
  missedImpressionsMax: number;
  clicks: number;
  missedClicksMin: number;
  missedClicksMax: number;
  ctr: number;
  spend: number;
  cpc: number;
  orders: number;
  sales: number;
  acos: number;
  roas: number;
  missedSalesMin: number;
  missedSalesMax: number;
  days: number;
  avgDailySpend: number;
  budgetUsageRate: number;
  estimatedLostSalesMid: number;
};

export type AdvertisedProductRecord = {
  id: string;
  startDate: string;
  endDate: string;
  portfolioName: string;
  campaignName: string;
  adGroupName: string;
  advertisedSku: string;
  advertisedAsin: string;
  impressions: number;
  clicks: number;
  ctr: number;
  cpc: number;
  spend: number;
  sales: number;
  orders: number;
  units: number;
  acos: number;
  roas: number;
  conversionRate: number;
  adSkuUnits: number;
  otherSkuUnits: number;
  adSkuSales: number;
  otherSkuSales: number;
  otherSkuSalesRatio: number;
};

export type PurchasedProductRecord = {
  id: string;
  startDate: string;
  endDate: string;
  portfolioName: string;
  campaignName: string;
  adGroupName: string;
  advertisedSku: string;
  advertisedAsin: string;
  targeting: string;
  matchType: string;
  purchasedAsin: string;
  otherSkuUnits: number;
  otherSkuOrders: number;
  otherSkuSales: number;
  isDirectPurchase: boolean;
};

export type SearchTermImpressionShareRecord = {
  id: string;
  startDate: string;
  endDate: string;
  country: string;
  customerSearchTerm: string;
  impressionShareRank: number;
  impressionShare: number;
  impressionShareTopReason: string;
  targeting: string;
  matchType: string;
  portfolioName: string;
  campaignName: string;
  adGroupName: string;
  clicks: number;
  impressions: number;
  ctr: number;
  spend: number;
  cpc: number;
  orders: number;
  sales: number;
  acos: number;
  roas: number;
  conversionRate: number;
};

export type PerformanceOverTimeRecord = {
  id: string;
  startDate: string;
  endDate: string;
  country: string;
  clicks: number;
  impressions: number;
  ctr: number;
  cpc: number;
  spend: number;
  orders: number;
  sales: number;
  acos: number;
  roas: number;
  conversionRate: number;
  days: number;
  avgDailySpend: number;
};

export type ParseResult<T> = {
  records: T[];
  currency: string | null;
};

function normalizeHeaderKey(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[\s\u3000]+/g, '')
    .replace(/[()（）【】[\]{}%#'".,:;，；：、/\\-]+/g, '');
}

function normalizeDate(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'number' && Number.isFinite(value)) {
    const parsed = XLSX.SSF?.parse_date_code?.(value);
    if (parsed?.y && parsed?.m && parsed?.d) {
      const dt = new Date(Date.UTC(parsed.y, parsed.m - 1, parsed.d));
      return dt.toISOString().slice(0, 10);
    }
  }
  const s = String(value).trim();
  if (!s) return '';
  const m = s.match(/(\d{4})[/-](\d{1,2})[/-](\d{1,2})/);
  if (m) {
    const dt = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
    if (!Number.isNaN(dt.getTime())) return dt.toISOString().slice(0, 10);
  }
  const dt = new Date(s);
  if (!Number.isNaN(dt.getTime())) return dt.toISOString().slice(0, 10);
  return s;
}

function normalizeCurrencyCode(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const s = value.trim();
  if (!s) return null;
  const upper = s.toUpperCase();
  if (upper === 'JPY' || s.includes('円') || s.includes('￥')) return 'JPY';
  if (upper === 'USD') return 'USD';
  if (upper === 'CNY' || upper === 'RMB') return 'CNY';
  if (upper === 'EUR') return 'EUR';
  if (upper === 'GBP') return 'GBP';
  if (upper === 'CAD') return 'CAD';
  if (upper === 'AUD') return 'AUD';
  if (upper === 'MXN') return 'MXN';
  if (upper === 'BRL') return 'BRL';
  if (/^[A-Z]{3}$/.test(upper)) return upper;
  return null;
}

function detectCurrencyFromRow(row: Record<string, unknown>): string | null {
  const candidates = [row['货币'], row['通貨'], row['Currency'], row['currency'], row['币种']];
  for (const v of candidates) {
    const currency = normalizeCurrencyCode(v);
    if (currency) return currency;
  }
  for (const [k, v] of Object.entries(row)) {
    if (k.includes('货币') || /currency/i.test(k)) {
      const currency = normalizeCurrencyCode(v);
      if (currency) return currency;
    }
  }
  return null;
}

function toNumber(value: unknown): number {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  if (typeof value === 'string') {
    const cleaned = value.replace(/[$,%\s，,]/g, '');
    const parsed = Number.parseFloat(cleaned);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

function hasPercentSymbol(value: unknown): boolean {
  return typeof value === 'string' && value.includes('%');
}

function toRatioFromPercentLike(value: unknown, fallbackRatio: number): number {
  const raw = toNumber(value);
  if (!Number.isFinite(raw) || raw <= 0) return fallbackRatio;
  if (hasPercentSymbol(value)) return raw / 100;
  return raw > 1 ? raw / 100 : raw;
}

function toAcosPercent(value: unknown, spend: number, sales: number): number {
  const computed = sales > 0 ? (spend / sales) * 100 : 0;
  const raw = toNumber(value);
  if (!Number.isFinite(raw) || raw <= 0) return computed;
  if (hasPercentSymbol(value)) return raw;
  if (raw <= 1) return raw * 100;
  if (raw >= 10) return raw;
  if (computed > 0) {
    const asPercent = raw;
    const asRatio = raw * 100;
    return Math.abs(asRatio - computed) < Math.abs(asPercent - computed) ? asRatio : asPercent;
  }
  return raw * 100;
}

function buildHeaderLookup(rows: Array<Record<string, unknown>>) {
  const keys = new Set<string>();
  for (let i = 0; i < Math.min(20, rows.length); i += 1) {
    for (const k of Object.keys(rows[i] ?? {})) keys.add(k);
  }
  const originalKeys = Array.from(keys);
  const normalizedToOriginal = new Map<string, string>();
  for (const key of originalKeys) normalizedToOriginal.set(normalizeHeaderKey(key), key);
  return { originalKeys, normalizedToOriginal };
}

function resolveColumn(
  name: string,
  spec: ColumnSpec,
  originalKeys: string[],
  normalizedToOriginal: Map<string, string>,
  cache: Map<string, string | null>
) {
  const cached = cache.get(name);
  if (cached !== undefined) return cached;
  for (const alias of spec.aliases) {
    const hit = normalizedToOriginal.get(normalizeHeaderKey(alias));
    if (hit) {
      cache.set(name, hit);
      return hit;
    }
  }
  const aliasNorm = spec.aliases.map(normalizeHeaderKey);
  for (const key of originalKeys) {
    const normalized = normalizeHeaderKey(key);
    if (aliasNorm.some((a) => normalized.includes(a) || a.includes(normalized))) {
      cache.set(name, key);
      return key;
    }
  }
  if (spec.regexes?.length) {
    for (const key of originalKeys) {
      if (spec.regexes.some((re) => re.test(key))) {
        cache.set(name, key);
        return key;
      }
    }
  }
  cache.set(name, null);
  return null;
}

async function readRowsFromWorkbook(file: File) {
  const arrayBuffer = await file.arrayBuffer();
  const workbook = XLSX.read(arrayBuffer, { type: 'array' });
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  return XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '', raw: true });
}

async function readRowsFromCsv(file: File) {
  const text = await file.text();
  const workbook = XLSX.read(text, { type: 'string' });
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  return XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '', raw: true });
}

async function readRows(file: File) {
  const isCsv = file.name.toLowerCase().endsWith('.csv');
  if (isCsv) return readRowsFromCsv(file);
  return readRowsFromWorkbook(file);
}

export async function parseTargetingReport(file: File): Promise<ParseResult<TargetingRecord>> {
  const rawRows = await readRowsFromWorkbook(file);
  const { originalKeys, normalizedToOriginal } = buildHeaderLookup(rawRows);
  const cache = new Map<string, string | null>();

  const columns = {
    date: resolveColumn('date', { aliases: ['开始日期', '日期', 'Start Date'], regexes: [/开始日期/, /start\s*date/i] }, originalKeys, normalizedToOriginal, cache),
    campaignName: resolveColumn('campaignName', { aliases: ['广告活动名称', 'Campaign Name'], regexes: [/广告活动/, /campaign/i] }, originalKeys, normalizedToOriginal, cache),
    adGroupName: resolveColumn('adGroupName', { aliases: ['广告组名称', 'Ad Group Name'], regexes: [/广告组/, /ad\s*group/i] }, originalKeys, normalizedToOriginal, cache),
    targeting: resolveColumn('targeting', { aliases: ['投放', 'Targeting', 'Keyword'], regexes: [/投放/, /targeting/i, /keyword/i] }, originalKeys, normalizedToOriginal, cache),
    matchType: resolveColumn('matchType', { aliases: ['匹配类型', 'Match Type'], regexes: [/匹配类型/, /match\s*type/i] }, originalKeys, normalizedToOriginal, cache),
    impressions: resolveColumn('impressions', { aliases: ['展示量', 'Impressions'], regexes: [/展示量/, /impressions?/i] }, originalKeys, normalizedToOriginal, cache),
    clicks: resolveColumn('clicks', { aliases: ['点击量', 'Clicks'], regexes: [/点击量/, /clicks?/i] }, originalKeys, normalizedToOriginal, cache),
    spend: resolveColumn('spend', { aliases: ['花费', 'Spend'], regexes: [/花费/, /spend/i] }, originalKeys, normalizedToOriginal, cache),
    sales: resolveColumn('sales', { aliases: ['7天总销售额', '7 Day Total Sales'], regexes: [/\d+\s*天.*销售额/i, /\d+\s*day.*sales/i] }, originalKeys, normalizedToOriginal, cache),
    orders: resolveColumn('orders', { aliases: ['7天总订单数(#)', '7 Day Total Orders (#)'], regexes: [/\d+\s*天.*订单数/i, /\d+\s*day.*orders/i] }, originalKeys, normalizedToOriginal, cache),
  };

  const detectedCurrency = rawRows.reduce<string | null>((acc, row) => acc ?? detectCurrencyFromRow(row), null);
  const records: TargetingRecord[] = [];

  for (const row of rawRows) {
    const targeting = String((columns.targeting ? row[columns.targeting] : row['投放']) ?? '').trim();
    const campaignName = String((columns.campaignName ? row[columns.campaignName] : row['广告活动名称']) ?? '').trim();
    if (!targeting && !campaignName) continue;
    if (/^总计$|^合计$|^total$/i.test(targeting)) continue;
    if (!targeting) continue;

    const impressions = toNumber(columns.impressions ? row[columns.impressions] : 0);
    const clicks = toNumber(columns.clicks ? row[columns.clicks] : 0);
    const spend = toNumber(columns.spend ? row[columns.spend] : 0);
    const sales = toNumber(columns.sales ? row[columns.sales] : 0);
    const orders = toNumber(columns.orders ? row[columns.orders] : 0);

    const ctr = impressions > 0 ? clicks / impressions : 0;
    const cpc = clicks > 0 ? spend / clicks : 0;
    const acos = sales > 0 ? (spend / sales) * 100 : 0;
    const roas = spend > 0 ? sales / spend : 0;
    const conversionRate = clicks > 0 ? orders / clicks : 0;

    records.push({
      id: nanoid(),
      date: normalizeDate(columns.date ? row[columns.date] : row['开始日期']),
      campaignName: campaignName || 'Unknown',
      adGroupName: String((columns.adGroupName ? row[columns.adGroupName] : row['广告组名称']) ?? '').trim() || 'Unknown',
      targeting,
      matchType: String((columns.matchType ? row[columns.matchType] : row['匹配类型']) ?? '').trim() || '-',
      impressions,
      clicks,
      spend,
      sales,
      orders,
      ctr,
      cpc,
      acos,
      roas,
      conversionRate,
    });
  }

  return { records, currency: detectedCurrency };
}

export async function parseCampaignReport(file: File): Promise<ParseResult<CampaignRecord>> {
  const rawRows = await readRows(file);
  const { originalKeys, normalizedToOriginal } = buildHeaderLookup(rawRows);
  const cache = new Map<string, string | null>();

  const columns = {
    startDate: resolveColumn('startDate', { aliases: ['开始日期', 'Start Date'], regexes: [/开始日期/, /start\s*date/i] }, originalKeys, normalizedToOriginal, cache),
    endDate: resolveColumn('endDate', { aliases: ['结束日期', 'End Date'], regexes: [/结束日期/, /end\s*date/i] }, originalKeys, normalizedToOriginal, cache),
    campaignName: resolveColumn('campaignName', { aliases: ['广告活动名称', 'Campaign Name'], regexes: [/广告活动/, /campaign/i] }, originalKeys, normalizedToOriginal, cache),
    campaignType: resolveColumn('campaignType', { aliases: ['广告活动类型', 'Campaign Type'], regexes: [/活动类型/, /campaign\s*type/i] }, originalKeys, normalizedToOriginal, cache),
    targetingType: resolveColumn('targetingType', { aliases: ['定位类型', 'Targeting Type'], regexes: [/定位类型/, /targeting\s*type/i] }, originalKeys, normalizedToOriginal, cache),
    biddingStrategy: resolveColumn('biddingStrategy', { aliases: ['竞价策略', 'Bidding strategy'], regexes: [/竞价策略/, /bidding/i] }, originalKeys, normalizedToOriginal, cache),
    status: resolveColumn('status', { aliases: ['状态', 'Status'], regexes: [/状态/, /status/i] }, originalKeys, normalizedToOriginal, cache),
    budget: resolveColumn('budget', { aliases: ['预算', 'Budget'], regexes: [/预算/, /budget/i] }, originalKeys, normalizedToOriginal, cache),
    impressions: resolveColumn('impressions', { aliases: ['展示量', 'Impressions'], regexes: [/展示量/, /impressions?/i] }, originalKeys, normalizedToOriginal, cache),
    clicks: resolveColumn('clicks', { aliases: ['点击量', 'Clicks'], regexes: [/点击量/, /clicks?/i] }, originalKeys, normalizedToOriginal, cache),
    spend: resolveColumn('spend', { aliases: ['花费', 'Spend'], regexes: [/花费/, /spend/i] }, originalKeys, normalizedToOriginal, cache),
    orders: resolveColumn('orders', { aliases: ['7天总订单数(#)', '7 Day Total Orders (#)'], regexes: [/\d+\s*天.*订单数/i, /\d+\s*day.*orders/i] }, originalKeys, normalizedToOriginal, cache),
    sales: resolveColumn('sales', { aliases: ['7天总销售额', '7 Day Total Sales'], regexes: [/\d+\s*天.*销售额/i, /\d+\s*day.*sales/i] }, originalKeys, normalizedToOriginal, cache),
    ctr: resolveColumn('ctr', { aliases: ['点击率 (CTR)', '点击率(CTR)', 'CTR'], regexes: [/ctr/i, /点击率/] }, originalKeys, normalizedToOriginal, cache),
    cpc: resolveColumn('cpc', { aliases: ['单次点击成本 (CPC)', '每次点击成本(CPC)', 'CPC'], regexes: [/cpc/i, /点击成本/] }, originalKeys, normalizedToOriginal, cache),
    acos: resolveColumn('acos', { aliases: ['广告投入产出比 (ACOS) 总计', '广告成本销售比(ACOS)', 'ACOS'], regexes: [/acos/i] }, originalKeys, normalizedToOriginal, cache),
    roas: resolveColumn('roas', { aliases: ['总广告投资回报率 (ROAS)', '投入产出比(ROAS)', 'ROAS'], regexes: [/roas/i] }, originalKeys, normalizedToOriginal, cache),
  };

  const detectedCurrency = rawRows.reduce<string | null>((acc, row) => acc ?? detectCurrencyFromRow(row), null);
  const records: CampaignRecord[] = [];

  for (const row of rawRows) {
    const campaignName = String((columns.campaignName ? row[columns.campaignName] : row['广告活动名称']) ?? '').trim();
    if (!campaignName) continue;
    if (/^总计$|^合计$|^total$/i.test(campaignName)) continue;

    const impressions = toNumber(columns.impressions ? row[columns.impressions] : 0);
    const clicks = toNumber(columns.clicks ? row[columns.clicks] : 0);
    const spend = toNumber(columns.spend ? row[columns.spend] : 0);
    const sales = toNumber(columns.sales ? row[columns.sales] : 0);
    const orders = toNumber(columns.orders ? row[columns.orders] : 0);

    const ctrRawValue = columns.ctr ? row[columns.ctr] : 0;
    const cpcRaw = toNumber(columns.cpc ? row[columns.cpc] : 0);
    const acosRawValue = columns.acos ? row[columns.acos] : 0;
    const roasRaw = toNumber(columns.roas ? row[columns.roas] : 0);

    const ctr = toRatioFromPercentLike(ctrRawValue, impressions > 0 ? clicks / impressions : 0);
    const cpc = cpcRaw || (clicks > 0 ? spend / clicks : 0);
    const acos = toAcosPercent(acosRawValue, spend, sales);
    const roas = roasRaw || (spend > 0 ? sales / spend : 0);

    records.push({
      id: nanoid(),
      startDate: normalizeDate(columns.startDate ? row[columns.startDate] : row['开始日期']),
      endDate: normalizeDate(columns.endDate ? row[columns.endDate] : row['结束日期']),
      campaignName,
      campaignType: String((columns.campaignType ? row[columns.campaignType] : row['广告活动类型']) ?? '').trim() || 'Unknown',
      targetingType: String((columns.targetingType ? row[columns.targetingType] : row['定位类型']) ?? '').trim() || 'Unknown',
      biddingStrategy: String((columns.biddingStrategy ? row[columns.biddingStrategy] : row['竞价策略']) ?? '').trim() || 'Unknown',
      status: String((columns.status ? row[columns.status] : row['状态']) ?? '').trim() || 'Unknown',
      budget: toNumber(columns.budget ? row[columns.budget] : 0),
      impressions,
      clicks,
      spend,
      sales,
      orders,
      ctr,
      cpc,
      acos,
      roas,
    });
  }

  return { records, currency: detectedCurrency };
}

function normalizePlacementBucket(value: string): PlacementRecord['placementBucket'] {
  const text = value.trim();
  if (!text) return 'OTHER';
  if (text.includes('搜索结果顶部') || /top of search/i.test(text)) return 'TOS';
  if (text.includes('搜索结果的其余位置') || text.includes('其余位置') || /rest of search/i.test(text)) return 'ROS';
  if (text.includes('商品页面') || /product pages?/i.test(text)) return 'PP';
  if (text.includes('站外') || /off[-\s]?amazon/i.test(text)) return 'OFFSITE';
  return 'OTHER';
}

export async function parsePlacementReport(file: File): Promise<ParseResult<PlacementRecord>> {
  const rawRows = await readRows(file);
  const { originalKeys, normalizedToOriginal } = buildHeaderLookup(rawRows);
  const cache = new Map<string, string | null>();

  const columns = {
    startDate: resolveColumn('startDate', { aliases: ['开始日期', 'Start Date'], regexes: [/开始日期/, /start\s*date/i] }, originalKeys, normalizedToOriginal, cache),
    endDate: resolveColumn('endDate', { aliases: ['结束日期', 'End Date'], regexes: [/结束日期/, /end\s*date/i] }, originalKeys, normalizedToOriginal, cache),
    campaignName: resolveColumn('campaignName', { aliases: ['广告活动名称', 'Campaign Name'], regexes: [/广告活动/, /campaign/i] }, originalKeys, normalizedToOriginal, cache),
    biddingStrategy: resolveColumn('biddingStrategy', { aliases: ['竞价策略', 'Bidding strategy'], regexes: [/竞价策略/, /bidding/i] }, originalKeys, normalizedToOriginal, cache),
    placement: resolveColumn('placement', { aliases: ['放置', '广告位', 'Placement'], regexes: [/放置/, /广告位/, /placement/i] }, originalKeys, normalizedToOriginal, cache),
    impressions: resolveColumn('impressions', { aliases: ['展示量', 'Impressions'], regexes: [/展示量/, /impressions?/i] }, originalKeys, normalizedToOriginal, cache),
    clicks: resolveColumn('clicks', { aliases: ['点击量', 'Clicks'], regexes: [/点击量/, /clicks?/i] }, originalKeys, normalizedToOriginal, cache),
    cpc: resolveColumn('cpc', { aliases: ['每次点击成本(CPC)', '单次点击成本 (CPC)', 'CPC'], regexes: [/cpc/i, /点击成本/] }, originalKeys, normalizedToOriginal, cache),
    spend: resolveColumn('spend', { aliases: ['花费', 'Spend'], regexes: [/花费/, /spend/i] }, originalKeys, normalizedToOriginal, cache),
    sales: resolveColumn('sales', { aliases: ['7天总销售额', '7 Day Total Sales'], regexes: [/\d+\s*天.*销售额/i, /\d+\s*day.*sales/i] }, originalKeys, normalizedToOriginal, cache),
    orders: resolveColumn('orders', { aliases: ['7天总订单数(#)', '7 Day Total Orders (#)'], regexes: [/\d+\s*天.*订单数/i, /\d+\s*day.*orders/i] }, originalKeys, normalizedToOriginal, cache),
    acos: resolveColumn('acos', { aliases: ['广告投入产出比 (ACOS) 总计', '广告成本销售比(ACOS)', 'ACOS'], regexes: [/acos/i] }, originalKeys, normalizedToOriginal, cache),
    roas: resolveColumn('roas', { aliases: ['总广告投资回报率 (ROAS)', '投入产出比(ROAS)', 'ROAS'], regexes: [/roas/i] }, originalKeys, normalizedToOriginal, cache),
  };

  const detectedCurrency = rawRows.reduce<string | null>((acc, row) => acc ?? detectCurrencyFromRow(row), null);
  const records: PlacementRecord[] = [];

  for (const row of rawRows) {
    const campaignName = String((columns.campaignName ? row[columns.campaignName] : row['广告活动名称']) ?? '').trim();
    const placement = String((columns.placement ? row[columns.placement] : row['放置']) ?? '').trim();
    if (!campaignName && !placement) continue;
    if (/^总计$|^合计$|^total$/i.test(campaignName) || /^总计$|^合计$|^total$/i.test(placement)) continue;
    if (!placement) continue;

    const impressions = toNumber(columns.impressions ? row[columns.impressions] : 0);
    const clicks = toNumber(columns.clicks ? row[columns.clicks] : 0);
    const spend = toNumber(columns.spend ? row[columns.spend] : 0);
    const sales = toNumber(columns.sales ? row[columns.sales] : 0);
    const orders = toNumber(columns.orders ? row[columns.orders] : 0);

    const ctr = impressions > 0 ? clicks / impressions : 0;
    const cpcRaw = toNumber(columns.cpc ? row[columns.cpc] : 0);
    const cpc = cpcRaw || (clicks > 0 ? spend / clicks : 0);
    const acosRawValue = columns.acos ? row[columns.acos] : 0;
    const roasRaw = toNumber(columns.roas ? row[columns.roas] : 0);
    const acos = toAcosPercent(acosRawValue, spend, sales);
    const roas = roasRaw || (spend > 0 ? sales / spend : 0);
    const conversionRate = clicks > 0 ? orders / clicks : 0;

    records.push({
      id: nanoid(),
      startDate: normalizeDate(columns.startDate ? row[columns.startDate] : row['开始日期']),
      endDate: normalizeDate(columns.endDate ? row[columns.endDate] : row['结束日期']),
      campaignName: campaignName || 'Unknown',
      biddingStrategy: String((columns.biddingStrategy ? row[columns.biddingStrategy] : row['竞价策略']) ?? '').trim() || 'Unknown',
      placement,
      placementBucket: normalizePlacementBucket(placement),
      impressions,
      clicks,
      spend,
      sales,
      orders,
      ctr,
      cpc,
      acos,
      roas,
      conversionRate,
    });
  }

  return { records, currency: detectedCurrency };
}

export async function parseBudgetReport(file: File): Promise<ParseResult<BudgetRecord>> {
  const rawRows = await readRows(file);
  const { originalKeys, normalizedToOriginal } = buildHeaderLookup(rawRows);
  const cache = new Map<string, string | null>();

  const columns = {
    startDate: resolveColumn('startDate', { aliases: ['开始日期', 'Start Date'], regexes: [/开始日期/, /start\s*date/i] }, originalKeys, normalizedToOriginal, cache),
    endDate: resolveColumn('endDate', { aliases: ['结束日期', 'End Date'], regexes: [/结束日期/, /end\s*date/i] }, originalKeys, normalizedToOriginal, cache),
    campaignName: resolveColumn('campaignName', { aliases: ['广告活动名称', 'Campaign Name'], regexes: [/广告活动/, /campaign/i] }, originalKeys, normalizedToOriginal, cache),
    status: resolveColumn('status', { aliases: ['状态', 'Status'], regexes: [/状态/, /status/i] }, originalKeys, normalizedToOriginal, cache),
    targetingType: resolveColumn('targetingType', { aliases: ['定位类型', 'Targeting Type'], regexes: [/定位类型/, /targeting\s*type/i] }, originalKeys, normalizedToOriginal, cache),
    biddingStrategy: resolveColumn('biddingStrategy', { aliases: ['竞价策略', 'Bidding strategy'], regexes: [/竞价策略/, /bidding/i] }, originalKeys, normalizedToOriginal, cache),
    budget: resolveColumn('budget', { aliases: ['预算', 'Budget'], regexes: [/预算/, /budget/i] }, originalKeys, normalizedToOriginal, cache),
    suggestedBudget: resolveColumn('suggestedBudget', { aliases: ['建议预算', 'Suggested Budget'], regexes: [/建议预算/, /suggested\s*budget/i] }, originalKeys, normalizedToOriginal, cache),
    budgetInRangeRate: resolveColumn(
      'budgetInRangeRate',
      { aliases: ['预算范围内的平均时间', 'Average time in budget'], regexes: [/预算范围内的平均时间/, /time\s*in\s*budget/i] },
      originalKeys,
      normalizedToOriginal,
      cache
    ),
    impressions: resolveColumn('impressions', { aliases: ['展示量', 'Impressions'], regexes: [/展示量/, /impressions?/i] }, originalKeys, normalizedToOriginal, cache),
    missedImpressionsMin: resolveColumn(
      'missedImpressionsMin',
      { aliases: ['预计错失的展示量范围（最小值）', 'Estimated missed impressions min'], regexes: [/错失.*展示量.*最小/, /missed.*impressions?.*min/i] },
      originalKeys,
      normalizedToOriginal,
      cache
    ),
    missedImpressionsMax: resolveColumn(
      'missedImpressionsMax',
      { aliases: ['预计错失的展示量范围（最大值）', 'Estimated missed impressions max'], regexes: [/错失.*展示量.*最大/, /missed.*impressions?.*max/i] },
      originalKeys,
      normalizedToOriginal,
      cache
    ),
    clicks: resolveColumn('clicks', { aliases: ['点击量', 'Clicks'], regexes: [/点击量/, /clicks?/i] }, originalKeys, normalizedToOriginal, cache),
    missedClicksMin: resolveColumn(
      'missedClicksMin',
      { aliases: ['预计错失的点击量范围（最小值）', 'Estimated missed clicks min'], regexes: [/错失.*点击量.*最小/, /missed.*clicks?.*min/i] },
      originalKeys,
      normalizedToOriginal,
      cache
    ),
    missedClicksMax: resolveColumn(
      'missedClicksMax',
      { aliases: ['预计错失的点击量范围（最大）', '预计错失的点击量范围（最大值）', 'Estimated missed clicks max'], regexes: [/错失.*点击量.*最大/, /missed.*clicks?.*max/i] },
      originalKeys,
      normalizedToOriginal,
      cache
    ),
    ctr: resolveColumn('ctr', { aliases: ['点击率 (CTR)', '点击率(CTR)', 'CTR'], regexes: [/ctr/i, /点击率/] }, originalKeys, normalizedToOriginal, cache),
    spend: resolveColumn('spend', { aliases: ['花费', 'Spend'], regexes: [/花费/, /spend/i] }, originalKeys, normalizedToOriginal, cache),
    cpc: resolveColumn('cpc', { aliases: ['单次点击成本 (CPC)', '每次点击成本(CPC)', 'CPC'], regexes: [/cpc/i, /点击成本/] }, originalKeys, normalizedToOriginal, cache),
    orders: resolveColumn('orders', { aliases: ['7天总订单数(#)', '7 Day Total Orders (#)'], regexes: [/\d+\s*天.*订单数/i, /\d+\s*day.*orders/i] }, originalKeys, normalizedToOriginal, cache),
    sales: resolveColumn('sales', { aliases: ['7天总销售额', '7 Day Total Sales'], regexes: [/\d+\s*天.*销售额/i, /\d+\s*day.*sales/i] }, originalKeys, normalizedToOriginal, cache),
    acos: resolveColumn('acos', { aliases: ['广告投入产出比 (ACOS) 总计', '广告成本销售比(ACOS)', 'ACOS'], regexes: [/acos/i] }, originalKeys, normalizedToOriginal, cache),
    roas: resolveColumn('roas', { aliases: ['总广告投资回报率 (ROAS)', '投入产出比(ROAS)', 'ROAS'], regexes: [/roas/i] }, originalKeys, normalizedToOriginal, cache),
    missedSalesMin: resolveColumn(
      'missedSalesMin',
      { aliases: ['预计错失的销售额范围（最小值）', 'Estimated missed sales min'], regexes: [/错失.*销售额.*最小/, /missed.*sales.*min/i] },
      originalKeys,
      normalizedToOriginal,
      cache
    ),
    missedSalesMax: resolveColumn(
      'missedSalesMax',
      { aliases: ['预计错失的销售额范围（最大值）', 'Estimated missed sales max'], regexes: [/错失.*销售额.*最大/, /missed.*sales.*max/i] },
      originalKeys,
      normalizedToOriginal,
      cache
    ),
  };

  const detectedCurrency = rawRows.reduce<string | null>((acc, row) => acc ?? detectCurrencyFromRow(row), null);
  const records: BudgetRecord[] = [];

  for (const row of rawRows) {
    const campaignName = String((columns.campaignName ? row[columns.campaignName] : row['广告活动名称']) ?? '').trim();
    if (!campaignName) continue;
    if (/^总计$|^合计$|^total$/i.test(campaignName)) continue;

    const startDate = normalizeDate(columns.startDate ? row[columns.startDate] : row['开始日期']);
    const endDate = normalizeDate(columns.endDate ? row[columns.endDate] : row['结束日期']);
    const start = startDate ? new Date(`${startDate}T00:00:00.000Z`) : null;
    const end = endDate ? new Date(`${endDate}T00:00:00.000Z`) : null;
    const days =
      start && end && !Number.isNaN(start.getTime()) && !Number.isNaN(end.getTime())
        ? Math.max(1, Math.floor((end.getTime() - start.getTime()) / 86400000) + 1)
        : 1;

    const budget = toNumber(columns.budget ? row[columns.budget] : 0);
    const spend = toNumber(columns.spend ? row[columns.spend] : 0);
    const sales = toNumber(columns.sales ? row[columns.sales] : 0);
    const orders = toNumber(columns.orders ? row[columns.orders] : 0);
    const impressions = toNumber(columns.impressions ? row[columns.impressions] : 0);
    const clicks = toNumber(columns.clicks ? row[columns.clicks] : 0);

    const ctrRawValue = columns.ctr ? row[columns.ctr] : 0;
    const cpcRaw = toNumber(columns.cpc ? row[columns.cpc] : 0);
    const acosRawValue = columns.acos ? row[columns.acos] : 0;
    const roasRaw = toNumber(columns.roas ? row[columns.roas] : 0);
    const budgetInRangeRawValue = columns.budgetInRangeRate ? row[columns.budgetInRangeRate] : 0;

    const ctr = toRatioFromPercentLike(ctrRawValue, impressions > 0 ? clicks / impressions : 0);
    const cpc = cpcRaw || (clicks > 0 ? spend / clicks : 0);
    const acos = toAcosPercent(acosRawValue, spend, sales);
    const roas = roasRaw || (spend > 0 ? sales / spend : 0);

    const avgDailySpend = days > 0 ? spend / days : spend;
    const budgetUsageRate = budget > 0 ? avgDailySpend / budget : 0;
    const budgetInRangeRate = toRatioFromPercentLike(budgetInRangeRawValue, 0);

    const missedSalesMin = toNumber(columns.missedSalesMin ? row[columns.missedSalesMin] : 0);
    const missedSalesMax = toNumber(columns.missedSalesMax ? row[columns.missedSalesMax] : 0);
    const estimatedLostSalesMid = (missedSalesMin + missedSalesMax) / 2;

    records.push({
      id: nanoid(),
      startDate,
      endDate,
      campaignName,
      status: String((columns.status ? row[columns.status] : row['状态']) ?? '').trim() || 'Unknown',
      targetingType: String((columns.targetingType ? row[columns.targetingType] : row['定位类型']) ?? '').trim() || 'Unknown',
      biddingStrategy: String((columns.biddingStrategy ? row[columns.biddingStrategy] : row['竞价策略']) ?? '').trim() || 'Unknown',
      budget,
      suggestedBudget: toNumber(columns.suggestedBudget ? row[columns.suggestedBudget] : 0),
      budgetInRangeRate,
      impressions,
      missedImpressionsMin: toNumber(columns.missedImpressionsMin ? row[columns.missedImpressionsMin] : 0),
      missedImpressionsMax: toNumber(columns.missedImpressionsMax ? row[columns.missedImpressionsMax] : 0),
      clicks,
      missedClicksMin: toNumber(columns.missedClicksMin ? row[columns.missedClicksMin] : 0),
      missedClicksMax: toNumber(columns.missedClicksMax ? row[columns.missedClicksMax] : 0),
      ctr,
      spend,
      cpc,
      orders,
      sales,
      acos,
      roas,
      missedSalesMin,
      missedSalesMax,
      days,
      avgDailySpend,
      budgetUsageRate,
      estimatedLostSalesMid,
    });
  }

  return { records, currency: detectedCurrency };
}

export async function parseAdvertisedProductReport(file: File): Promise<ParseResult<AdvertisedProductRecord>> {
  const rawRows = await readRows(file);
  const { originalKeys, normalizedToOriginal } = buildHeaderLookup(rawRows);
  const cache = new Map<string, string | null>();

  const columns = {
    startDate: resolveColumn('startDate', { aliases: ['开始日期', 'Start Date'], regexes: [/开始日期/, /start\s*date/i] }, originalKeys, normalizedToOriginal, cache),
    endDate: resolveColumn('endDate', { aliases: ['结束日期', 'End Date'], regexes: [/结束日期/, /end\s*date/i] }, originalKeys, normalizedToOriginal, cache),
    portfolioName: resolveColumn('portfolioName', { aliases: ['广告组合名称', 'Portfolio name'], regexes: [/广告组合/, /portfolio/i] }, originalKeys, normalizedToOriginal, cache),
    campaignName: resolveColumn('campaignName', { aliases: ['广告活动名称', 'Campaign Name'], regexes: [/广告活动/, /campaign/i] }, originalKeys, normalizedToOriginal, cache),
    adGroupName: resolveColumn('adGroupName', { aliases: ['广告组名称', 'Ad Group Name'], regexes: [/广告组/, /ad\s*group/i] }, originalKeys, normalizedToOriginal, cache),
    advertisedSku: resolveColumn('advertisedSku', { aliases: ['广告SKU', 'Advertised SKU'], regexes: [/广告sku/i, /advertised\s*sku/i] }, originalKeys, normalizedToOriginal, cache),
    advertisedAsin: resolveColumn('advertisedAsin', { aliases: ['广告ASIN', 'Advertised ASIN'], regexes: [/广告asin/i, /advertised\s*asin/i] }, originalKeys, normalizedToOriginal, cache),
    impressions: resolveColumn('impressions', { aliases: ['展示量', 'Impressions'], regexes: [/展示量/, /impressions?/i] }, originalKeys, normalizedToOriginal, cache),
    clicks: resolveColumn('clicks', { aliases: ['点击量', 'Clicks'], regexes: [/点击量/, /clicks?/i] }, originalKeys, normalizedToOriginal, cache),
    ctr: resolveColumn('ctr', { aliases: ['点击率(CTR)', '点击率 (CTR)', 'CTR'], regexes: [/ctr/i, /点击率/] }, originalKeys, normalizedToOriginal, cache),
    cpc: resolveColumn('cpc', { aliases: ['每次点击成本(CPC)', '单次点击成本 (CPC)', 'CPC'], regexes: [/cpc/i, /点击成本/] }, originalKeys, normalizedToOriginal, cache),
    spend: resolveColumn('spend', { aliases: ['花费', 'Spend'], regexes: [/花费/, /spend/i] }, originalKeys, normalizedToOriginal, cache),
    sales: resolveColumn('sales', { aliases: ['7天总销售额', '7 Day Total Sales'], regexes: [/\d+\s*天.*销售额/i, /\d+\s*day.*sales/i] }, originalKeys, normalizedToOriginal, cache),
    acos: resolveColumn('acos', { aliases: ['广告成本销售比(ACOS)', '广告投入产出比 (ACOS) 总计', 'ACOS'], regexes: [/acos/i] }, originalKeys, normalizedToOriginal, cache),
    roas: resolveColumn('roas', { aliases: ['投入产出比(ROAS)', '总广告投资回报率 (ROAS)', 'ROAS'], regexes: [/roas/i] }, originalKeys, normalizedToOriginal, cache),
    orders: resolveColumn('orders', { aliases: ['7天总订单数(#)', '7 Day Total Orders (#)'], regexes: [/\d+\s*天.*订单数/i, /\d+\s*day.*orders/i] }, originalKeys, normalizedToOriginal, cache),
    units: resolveColumn('units', { aliases: ['7天总销售量(#)', '7 Day Total Units (#)'], regexes: [/\d+\s*天.*销售量/i, /\d+\s*day.*units?/i] }, originalKeys, normalizedToOriginal, cache),
    conversionRate: resolveColumn('conversionRate', { aliases: ['7天的转化率', '7 Day Conversion Rate'], regexes: [/转化率/, /conversion\s*rate/i] }, originalKeys, normalizedToOriginal, cache),
    adSkuUnits: resolveColumn('adSkuUnits', { aliases: ['7天内广告SKU销售量(#)', '7 Day Advertised SKU Units (#)'], regexes: [/广告sku.*销售量/i, /advertised\s*sku.*units?/i] }, originalKeys, normalizedToOriginal, cache),
    otherSkuUnits: resolveColumn('otherSkuUnits', { aliases: ['7天内其他SKU销售量(#)', '7 Day Other SKU Units (#)'], regexes: [/其他sku.*销售量/i, /other\s*sku.*units?/i] }, originalKeys, normalizedToOriginal, cache),
    adSkuSales: resolveColumn('adSkuSales', { aliases: ['7天内广告SKU销售额', '7 Day Advertised SKU Sales'], regexes: [/广告sku.*销售额/i, /advertised\s*sku.*sales/i] }, originalKeys, normalizedToOriginal, cache),
    otherSkuSales: resolveColumn('otherSkuSales', { aliases: ['7天内其他SKU销售额', '7 Day Other SKU Sales'], regexes: [/其他sku.*销售额/i, /other\s*sku.*sales/i] }, originalKeys, normalizedToOriginal, cache),
  };

  const detectedCurrency = rawRows.reduce<string | null>((acc, row) => acc ?? detectCurrencyFromRow(row), null);
  const records: AdvertisedProductRecord[] = [];

  for (const row of rawRows) {
    const campaignName = String((columns.campaignName ? row[columns.campaignName] : row['广告活动名称']) ?? '').trim();
    const advertisedAsin = String((columns.advertisedAsin ? row[columns.advertisedAsin] : row['广告ASIN']) ?? '').trim();
    const advertisedSku = String((columns.advertisedSku ? row[columns.advertisedSku] : row['广告SKU']) ?? '').trim();
    if (!campaignName && !advertisedAsin && !advertisedSku) continue;
    if (/^总计$|^合计$|^total$/i.test(campaignName)) continue;

    const impressions = toNumber(columns.impressions ? row[columns.impressions] : 0);
    const clicks = toNumber(columns.clicks ? row[columns.clicks] : 0);
    const spend = toNumber(columns.spend ? row[columns.spend] : 0);
    const sales = toNumber(columns.sales ? row[columns.sales] : 0);
    const orders = toNumber(columns.orders ? row[columns.orders] : 0);

    const ctrRawValue = columns.ctr ? row[columns.ctr] : 0;
    const cpcRaw = toNumber(columns.cpc ? row[columns.cpc] : 0);
    const acosRawValue = columns.acos ? row[columns.acos] : 0;
    const roasRaw = toNumber(columns.roas ? row[columns.roas] : 0);
    const conversionRateRawValue = columns.conversionRate ? row[columns.conversionRate] : 0;

    const ctr = toRatioFromPercentLike(ctrRawValue, impressions > 0 ? clicks / impressions : 0);
    const cpc = cpcRaw || (clicks > 0 ? spend / clicks : 0);
    const acos = toAcosPercent(acosRawValue, spend, sales);
    const roas = roasRaw || (spend > 0 ? sales / spend : 0);
    const conversionRate = toRatioFromPercentLike(conversionRateRawValue, clicks > 0 ? orders / clicks : 0);

    const adSkuSales = toNumber(columns.adSkuSales ? row[columns.adSkuSales] : 0);
    const otherSkuSales = toNumber(columns.otherSkuSales ? row[columns.otherSkuSales] : 0);
    const otherSkuSalesRatio = sales > 0 ? otherSkuSales / sales : 0;

    records.push({
      id: nanoid(),
      startDate: normalizeDate(columns.startDate ? row[columns.startDate] : row['开始日期']),
      endDate: normalizeDate(columns.endDate ? row[columns.endDate] : row['结束日期']),
      portfolioName: String((columns.portfolioName ? row[columns.portfolioName] : row['广告组合名称']) ?? '').trim() || 'Unknown',
      campaignName,
      adGroupName: String((columns.adGroupName ? row[columns.adGroupName] : row['广告组名称']) ?? '').trim() || 'Unknown',
      advertisedSku: advertisedSku || 'Unknown',
      advertisedAsin: advertisedAsin || 'Unknown',
      impressions,
      clicks,
      ctr,
      cpc,
      spend,
      sales,
      orders,
      units: toNumber(columns.units ? row[columns.units] : 0),
      acos,
      roas,
      conversionRate,
      adSkuUnits: toNumber(columns.adSkuUnits ? row[columns.adSkuUnits] : 0),
      otherSkuUnits: toNumber(columns.otherSkuUnits ? row[columns.otherSkuUnits] : 0),
      adSkuSales,
      otherSkuSales,
      otherSkuSalesRatio,
    });
  }

  return { records, currency: detectedCurrency };
}

export async function parsePurchasedProductReport(file: File): Promise<ParseResult<PurchasedProductRecord>> {
  const rawRows = await readRows(file);
  const { originalKeys, normalizedToOriginal } = buildHeaderLookup(rawRows);
  const cache = new Map<string, string | null>();

  const columns = {
    startDate: resolveColumn('startDate', { aliases: ['开始日期', 'Start Date'], regexes: [/开始日期/, /start\s*date/i] }, originalKeys, normalizedToOriginal, cache),
    endDate: resolveColumn('endDate', { aliases: ['结束日期', 'End Date'], regexes: [/结束日期/, /end\s*date/i] }, originalKeys, normalizedToOriginal, cache),
    portfolioName: resolveColumn('portfolioName', { aliases: ['广告组合名称', 'Portfolio name'], regexes: [/广告组合/, /portfolio/i] }, originalKeys, normalizedToOriginal, cache),
    campaignName: resolveColumn('campaignName', { aliases: ['广告活动名称', 'Campaign Name'], regexes: [/广告活动/, /campaign/i] }, originalKeys, normalizedToOriginal, cache),
    adGroupName: resolveColumn('adGroupName', { aliases: ['广告组名称', 'Ad Group Name'], regexes: [/广告组/, /ad\s*group/i] }, originalKeys, normalizedToOriginal, cache),
    advertisedSku: resolveColumn('advertisedSku', { aliases: ['广告SKU', 'Advertised SKU'], regexes: [/广告sku/i, /advertised\s*sku/i] }, originalKeys, normalizedToOriginal, cache),
    advertisedAsin: resolveColumn('advertisedAsin', { aliases: ['广告ASIN', 'Advertised ASIN'], regexes: [/广告asin/i, /advertised\s*asin/i] }, originalKeys, normalizedToOriginal, cache),
    targeting: resolveColumn('targeting', { aliases: ['投放', 'Targeting'], regexes: [/投放/, /targeting/i] }, originalKeys, normalizedToOriginal, cache),
    matchType: resolveColumn('matchType', { aliases: ['匹配类型', 'Match Type'], regexes: [/匹配类型/, /match\s*type/i] }, originalKeys, normalizedToOriginal, cache),
    purchasedAsin: resolveColumn('purchasedAsin', { aliases: ['已购买的ASIN', 'Purchased ASIN'], regexes: [/已购买.*asin/i, /purchased\s*asin/i] }, originalKeys, normalizedToOriginal, cache),
    otherSkuUnits: resolveColumn('otherSkuUnits', { aliases: ['7天内其他SKU销售量(#)', '7 Day Other SKU Units (#)'], regexes: [/其他sku.*销售量/i, /other\s*sku.*units?/i] }, originalKeys, normalizedToOriginal, cache),
    otherSkuOrders: resolveColumn('otherSkuOrders', { aliases: ['7天内其他SKU订单数(#)', '7 Day Other SKU Orders (#)'], regexes: [/其他sku.*订单数/i, /other\s*sku.*orders?/i] }, originalKeys, normalizedToOriginal, cache),
    otherSkuSales: resolveColumn('otherSkuSales', { aliases: ['7天内其他SKU销售额', '7 Day Other SKU Sales'], regexes: [/其他sku.*销售额/i, /other\s*sku.*sales/i] }, originalKeys, normalizedToOriginal, cache),
  };

  const detectedCurrency = rawRows.reduce<string | null>((acc, row) => acc ?? detectCurrencyFromRow(row), null);
  const records: PurchasedProductRecord[] = [];

  for (const row of rawRows) {
    const campaignName = String((columns.campaignName ? row[columns.campaignName] : row['广告活动名称']) ?? '').trim();
    const advertisedAsin = String((columns.advertisedAsin ? row[columns.advertisedAsin] : row['广告ASIN']) ?? '').trim();
    const purchasedAsin = String((columns.purchasedAsin ? row[columns.purchasedAsin] : row['已购买的ASIN']) ?? '').trim();
    if (!campaignName && !advertisedAsin && !purchasedAsin) continue;
    if (/^总计$|^合计$|^total$/i.test(campaignName)) continue;

    records.push({
      id: nanoid(),
      startDate: normalizeDate(columns.startDate ? row[columns.startDate] : row['开始日期']),
      endDate: normalizeDate(columns.endDate ? row[columns.endDate] : row['结束日期']),
      portfolioName: String((columns.portfolioName ? row[columns.portfolioName] : row['广告组合名称']) ?? '').trim() || 'Unknown',
      campaignName: campaignName || 'Unknown',
      adGroupName: String((columns.adGroupName ? row[columns.adGroupName] : row['广告组名称']) ?? '').trim() || 'Unknown',
      advertisedSku: String((columns.advertisedSku ? row[columns.advertisedSku] : row['广告SKU']) ?? '').trim() || 'Unknown',
      advertisedAsin: advertisedAsin || 'Unknown',
      targeting: String((columns.targeting ? row[columns.targeting] : row['投放']) ?? '').trim() || '-',
      matchType: String((columns.matchType ? row[columns.matchType] : row['匹配类型']) ?? '').trim() || '-',
      purchasedAsin: purchasedAsin || 'Unknown',
      otherSkuUnits: toNumber(columns.otherSkuUnits ? row[columns.otherSkuUnits] : 0),
      otherSkuOrders: toNumber(columns.otherSkuOrders ? row[columns.otherSkuOrders] : 0),
      otherSkuSales: toNumber(columns.otherSkuSales ? row[columns.otherSkuSales] : 0),
      isDirectPurchase: Boolean(advertisedAsin) && Boolean(purchasedAsin) && advertisedAsin === purchasedAsin,
    });
  }

  return { records, currency: detectedCurrency };
}

export async function parseSearchTermImpressionShareReport(file: File): Promise<ParseResult<SearchTermImpressionShareRecord>> {
  const rawRows = await readRows(file);
  const { originalKeys, normalizedToOriginal } = buildHeaderLookup(rawRows);
  const cache = new Map<string, string | null>();

  const columns = {
    startDate: resolveColumn('startDate', { aliases: ['开始日期', 'Start Date'], regexes: [/开始日期/, /start\s*date/i] }, originalKeys, normalizedToOriginal, cache),
    endDate: resolveColumn('endDate', { aliases: ['结束日期', 'End Date'], regexes: [/结束日期/, /end\s*date/i] }, originalKeys, normalizedToOriginal, cache),
    country: resolveColumn('country', { aliases: ['国家/地区', 'Country/Region'], regexes: [/国家|地区/, /country/i] }, originalKeys, normalizedToOriginal, cache),
    customerSearchTerm: resolveColumn(
      'customerSearchTerm',
      { aliases: ['客户搜索词', 'Customer Search Term'], regexes: [/客户搜索词/, /search\s*term/i] },
      originalKeys,
      normalizedToOriginal,
      cache
    ),
    impressionShareRank: resolveColumn(
      'impressionShareRank',
      { aliases: ['搜索词展示量排名', 'Search Term Impression Rank'], regexes: [/展示量排名/, /impression.*rank/i] },
      originalKeys,
      normalizedToOriginal,
      cache
    ),
    impressionShare: resolveColumn(
      'impressionShare',
      { aliases: ['搜索词展示量份额', 'Search Term Impression Share'], regexes: [/展示量份额/, /impression.*share/i] },
      originalKeys,
      normalizedToOriginal,
      cache
    ),
    impressionShareTopReason: resolveColumn(
      'impressionShareTopReason',
      {
        aliases: ['展示量份额排名前的原因', '搜索词展示量份额排名前的原因', 'Top Reason For Impression Share Rank', 'Top reason for search term impression share rank'],
        regexes: [/份额.*排名前.*原因/, /份额.*原因/, /impression.*share.*reason/i, /top.*reason/i],
      },
      originalKeys,
      normalizedToOriginal,
      cache
    ),
    targeting: resolveColumn('targeting', { aliases: ['投放', 'Targeting'], regexes: [/投放/, /targeting/i] }, originalKeys, normalizedToOriginal, cache),
    matchType: resolveColumn('matchType', { aliases: ['匹配类型', 'Match Type'], regexes: [/匹配类型/, /match\s*type/i] }, originalKeys, normalizedToOriginal, cache),
    portfolioName: resolveColumn('portfolioName', { aliases: ['广告组合名称', 'Portfolio name'], regexes: [/广告组合/, /portfolio/i] }, originalKeys, normalizedToOriginal, cache),
    campaignName: resolveColumn('campaignName', { aliases: ['广告活动名称', 'Campaign Name'], regexes: [/广告活动/, /campaign/i] }, originalKeys, normalizedToOriginal, cache),
    adGroupName: resolveColumn('adGroupName', { aliases: ['广告组名称', 'Ad Group Name'], regexes: [/广告组/, /ad\s*group/i] }, originalKeys, normalizedToOriginal, cache),
    clicks: resolveColumn('clicks', { aliases: ['点击量', 'Clicks'], regexes: [/点击量/, /clicks?/i] }, originalKeys, normalizedToOriginal, cache),
    impressions: resolveColumn('impressions', { aliases: ['展示量', 'Impressions'], regexes: [/展示量/, /impressions?/i] }, originalKeys, normalizedToOriginal, cache),
    ctr: resolveColumn('ctr', { aliases: ['点击率 (CTR)', '点击率(CTR)', 'CTR'], regexes: [/ctr/i, /点击率/] }, originalKeys, normalizedToOriginal, cache),
    spend: resolveColumn('spend', { aliases: ['花费', 'Spend'], regexes: [/花费/, /spend/i] }, originalKeys, normalizedToOriginal, cache),
    cpc: resolveColumn('cpc', { aliases: ['单次点击成本 (CPC)', '每次点击成本(CPC)', 'CPC'], regexes: [/cpc/i, /点击成本/] }, originalKeys, normalizedToOriginal, cache),
    orders: resolveColumn('orders', { aliases: ['7 天内的总订单量 (#)', '7 Day Total Orders (#)'], regexes: [/订单量|订单数/, /orders?/i] }, originalKeys, normalizedToOriginal, cache),
    sales: resolveColumn('sales', { aliases: ['7 天内的总销售额', '7 Day Total Sales'], regexes: [/总销售额|销售额/, /sales/i] }, originalKeys, normalizedToOriginal, cache),
    acos: resolveColumn('acos', { aliases: ['广告投入产出比 (ACOS) 总计', '广告成本销售比(ACOS)', 'ACOS'], regexes: [/acos/i] }, originalKeys, normalizedToOriginal, cache),
    roas: resolveColumn('roas', { aliases: ['总广告投资回报率 (ROAS)', '投入产出比(ROAS)', 'ROAS'], regexes: [/roas/i] }, originalKeys, normalizedToOriginal, cache),
    conversionRate: resolveColumn('conversionRate', { aliases: ['7 天转化率', '7 Day Conversion Rate'], regexes: [/转化率/, /conversion\s*rate/i] }, originalKeys, normalizedToOriginal, cache),
  };

  const detectedCurrency = rawRows.reduce<string | null>((acc, row) => acc ?? detectCurrencyFromRow(row), null);
  const records: SearchTermImpressionShareRecord[] = [];

  for (const row of rawRows) {
    const customerSearchTerm = String((columns.customerSearchTerm ? row[columns.customerSearchTerm] : row['客户搜索词']) ?? '').trim();
    const campaignName = String((columns.campaignName ? row[columns.campaignName] : row['广告活动名称']) ?? '').trim();
    if (!customerSearchTerm && !campaignName) continue;
    if (/^总计$|^合计$|^total$/i.test(customerSearchTerm) || /^总计$|^合计$|^total$/i.test(campaignName)) continue;

    const clicks = toNumber(columns.clicks ? row[columns.clicks] : 0);
    const impressions = toNumber(columns.impressions ? row[columns.impressions] : 0);
    const spend = toNumber(columns.spend ? row[columns.spend] : 0);
    const orders = toNumber(columns.orders ? row[columns.orders] : 0);
    const sales = toNumber(columns.sales ? row[columns.sales] : 0);

    const ctrRawValue = columns.ctr ? row[columns.ctr] : 0;
    const cpcRaw = toNumber(columns.cpc ? row[columns.cpc] : 0);
    const acosRawValue = columns.acos ? row[columns.acos] : 0;
    const roasRaw = toNumber(columns.roas ? row[columns.roas] : 0);
    const conversionRateRawValue = columns.conversionRate ? row[columns.conversionRate] : 0;
    const impressionShareRawValue = columns.impressionShare ? row[columns.impressionShare] : 0;

    const ctr = toRatioFromPercentLike(ctrRawValue, impressions > 0 ? clicks / impressions : 0);
    const cpc = cpcRaw || (clicks > 0 ? spend / clicks : 0);
    const acos = toAcosPercent(acosRawValue, spend, sales);
    const roas = roasRaw || (spend > 0 ? sales / spend : 0);
    const conversionRate = toRatioFromPercentLike(conversionRateRawValue, clicks > 0 ? orders / clicks : 0);
    const impressionShare = toRatioFromPercentLike(impressionShareRawValue, 0);

    records.push({
      id: nanoid(),
      startDate: normalizeDate(columns.startDate ? row[columns.startDate] : row['开始日期']),
      endDate: normalizeDate(columns.endDate ? row[columns.endDate] : row['结束日期']),
      country: String((columns.country ? row[columns.country] : row['国家/地区']) ?? '').trim() || 'Unknown',
      customerSearchTerm: customerSearchTerm || 'Unknown',
      impressionShareRank: toNumber(columns.impressionShareRank ? row[columns.impressionShareRank] : 0),
      impressionShare,
      impressionShareTopReason: String((columns.impressionShareTopReason ? row[columns.impressionShareTopReason] : '') ?? '').trim() || '报告未提供',
      targeting: String((columns.targeting ? row[columns.targeting] : row['投放']) ?? '').trim() || '-',
      matchType: String((columns.matchType ? row[columns.matchType] : row['匹配类型']) ?? '').trim() || '-',
      portfolioName: String((columns.portfolioName ? row[columns.portfolioName] : row['广告组合名称']) ?? '').trim() || 'Unknown',
      campaignName: campaignName || 'Unknown',
      adGroupName: String((columns.adGroupName ? row[columns.adGroupName] : row['广告组名称']) ?? '').trim() || 'Unknown',
      clicks,
      impressions,
      ctr,
      spend,
      cpc,
      orders,
      sales,
      acos,
      roas,
      conversionRate,
    });
  }

  return { records, currency: detectedCurrency };
}

export async function parsePerformanceOverTimeReport(file: File): Promise<ParseResult<PerformanceOverTimeRecord>> {
  const rawRows = await readRows(file);
  const { originalKeys, normalizedToOriginal } = buildHeaderLookup(rawRows);
  const cache = new Map<string, string | null>();

  const columns = {
    startDate: resolveColumn('startDate', { aliases: ['开始日期', 'Start Date'], regexes: [/开始日期/, /start\s*date/i] }, originalKeys, normalizedToOriginal, cache),
    endDate: resolveColumn('endDate', { aliases: ['结束日期', 'End Date'], regexes: [/结束日期/, /end\s*date/i] }, originalKeys, normalizedToOriginal, cache),
    country: resolveColumn('country', { aliases: ['国家/地区', 'Country/Region'], regexes: [/国家|地区/, /country/i] }, originalKeys, normalizedToOriginal, cache),
    clicks: resolveColumn('clicks', { aliases: ['点击量', 'Clicks'], regexes: [/点击量/, /clicks?/i] }, originalKeys, normalizedToOriginal, cache),
    impressions: resolveColumn('impressions', { aliases: ['展示量', 'Impressions'], regexes: [/展示量/, /impressions?/i] }, originalKeys, normalizedToOriginal, cache),
    ctr: resolveColumn('ctr', { aliases: ['点击率 (CTR)', '点击率(CTR)', 'CTR'], regexes: [/ctr/i, /点击率/] }, originalKeys, normalizedToOriginal, cache),
    cpc: resolveColumn('cpc', { aliases: ['单次点击成本 (CPC)', '每次点击成本(CPC)', 'CPC'], regexes: [/cpc/i, /点击成本/] }, originalKeys, normalizedToOriginal, cache),
    spend: resolveColumn('spend', { aliases: ['花费', 'Spend'], regexes: [/花费/, /spend/i] }, originalKeys, normalizedToOriginal, cache),
    orders: resolveColumn('orders', { aliases: ['7天总订单数(#)', '7 Day Total Orders (#)'], regexes: [/订单数|订单量/, /orders?/i] }, originalKeys, normalizedToOriginal, cache),
    sales: resolveColumn('sales', { aliases: ['7天总销售额', '7 Day Total Sales'], regexes: [/销售额/, /sales/i] }, originalKeys, normalizedToOriginal, cache),
    acos: resolveColumn('acos', { aliases: ['广告投入产出比 (ACOS) 总计', '广告成本销售比(ACOS)', 'ACOS'], regexes: [/acos/i] }, originalKeys, normalizedToOriginal, cache),
    roas: resolveColumn('roas', { aliases: ['总广告投资回报率 (ROAS)', '投入产出比(ROAS)', 'ROAS'], regexes: [/roas/i] }, originalKeys, normalizedToOriginal, cache),
    conversionRate: resolveColumn('conversionRate', { aliases: ['7天转化率', '7 Day Conversion Rate'], regexes: [/转化率/, /conversion\s*rate/i] }, originalKeys, normalizedToOriginal, cache),
  };

  const detectedCurrency = rawRows.reduce<string | null>((acc, row) => acc ?? detectCurrencyFromRow(row), null);
  const records: PerformanceOverTimeRecord[] = [];

  for (const row of rawRows) {
    const startDate = normalizeDate(columns.startDate ? row[columns.startDate] : row['开始日期']);
    const endDate = normalizeDate(columns.endDate ? row[columns.endDate] : row['结束日期']);
    const country = String((columns.country ? row[columns.country] : row['国家/地区']) ?? '').trim();
    if (!startDate && !endDate && !country) continue;

    const start = startDate ? new Date(`${startDate}T00:00:00.000Z`) : null;
    const end = endDate ? new Date(`${endDate}T00:00:00.000Z`) : null;
    const days =
      start && end && !Number.isNaN(start.getTime()) && !Number.isNaN(end.getTime())
        ? Math.max(1, Math.floor((end.getTime() - start.getTime()) / 86400000) + 1)
        : 1;

    const clicks = toNumber(columns.clicks ? row[columns.clicks] : 0);
    const impressions = toNumber(columns.impressions ? row[columns.impressions] : 0);
    const spend = toNumber(columns.spend ? row[columns.spend] : 0);
    const orders = toNumber(columns.orders ? row[columns.orders] : 0);
    const sales = toNumber(columns.sales ? row[columns.sales] : 0);
    const ctrRawValue = columns.ctr ? row[columns.ctr] : 0;
    const cpcRaw = toNumber(columns.cpc ? row[columns.cpc] : 0);
    const acosRawValue = columns.acos ? row[columns.acos] : 0;
    const roasRaw = toNumber(columns.roas ? row[columns.roas] : 0);
    const conversionRateRawValue = columns.conversionRate ? row[columns.conversionRate] : 0;

    const ctr = toRatioFromPercentLike(ctrRawValue, impressions > 0 ? clicks / impressions : 0);
    const cpc = cpcRaw || (clicks > 0 ? spend / clicks : 0);
    const acos = toAcosPercent(acosRawValue, spend, sales);
    const roas = roasRaw || (spend > 0 ? sales / spend : 0);
    const conversionRate = toRatioFromPercentLike(conversionRateRawValue, clicks > 0 ? orders / clicks : 0);

    records.push({
      id: nanoid(),
      startDate,
      endDate,
      country: country || 'Unknown',
      clicks,
      impressions,
      ctr,
      cpc,
      spend,
      orders,
      sales,
      acos,
      roas,
      conversionRate,
      days,
      avgDailySpend: days > 0 ? spend / days : spend,
    });
  }

  return { records, currency: detectedCurrency };
}
