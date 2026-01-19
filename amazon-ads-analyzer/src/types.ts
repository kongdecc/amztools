// Type definitions for Amazon Ad Reports

export interface RawAdRecord {
  '开始日期'?: string;
  '结束日期'?: string;
  '广告组合名称'?: string;
  '货币'?: string;
  '广告活动名称'?: string;
  '广告组名称'?: string;
  '投放'?: string;
  '匹配类型'?: string;
  '客户搜索词'?: string; // Key field
  '展示量'?: number;
  '点击量'?: number;
  '点击率(CTR)'?: number;
  '每次点击成本(CPC)'?: number;
  '花费'?: number;
  '7天总销售额'?: number;
  '广告成本销售比(ACOS)'?: number;
  '投入产出比(ROAS)'?: number;
  '7天总订单数(#)'?: number;
  '7天总销售量(#)'?: number;
  '7天的转化率'?: number;
  // ... potentially others
}

export interface AdRecord {
  id: string; // generated nanoid
  date: string; // YYYY-MM-DD
  campaignName: string;
  adGroupName: string;
  matchType: string;
  searchTerm: string;
  impressions: number;
  clicks: number;
  spend: number;
  sales: number;
  orders: number;
  
  // Calculated / Normalized fields
  ctr: number; // clicks / impressions
  cpc: number; // spend / clicks
  acos: number; // spend / sales (0 if sales 0)
  roas: number; // sales / spend (0 if spend 0)
  conversionRate: number; // orders / clicks
}

export type ConversionFilter = "全部" | "有订单" | "无订单" | "有销售" | "无销售";
export type TableViewMode = "明细" | "按搜索词汇总";
export type ProductStage = "新品" | "成熟";

export interface SuggestionRules {
  productStage: ProductStage;
  negativeMinClicks: number;
  negativeMinSpend: number;
  harvestMinClicks: number;
  harvestMinOrders: number;
  harvestMinCvrPct: number;
  bidMinClicks: number;
  bidUpAcosFactor: number;
  bidDownAcosFactor: number;
}

export interface AnalysisSettings {
  targetAcos: number; // e.g., 30 (%)
  minClicks: number | null;
  minImpressions: number | null;
  spendMin: number | null;
  spendMax: number | null;
  salesMin: number | null;
  salesMax: number | null;
  ordersMin: number | null;
  ordersMax: number | null;
  clicksMax: number | null;
  impressionsMax: number | null;
  ctrMinPct: number | null;
  ctrMaxPct: number | null;
  cpcMin: number | null;
  cpcMax: number | null;
  acosMin: number | null;
  acosMax: number | null;
  roasMin: number | null;
  roasMax: number | null;
  conversionRateMinPct: number | null;
  conversionRateMaxPct: number | null;
  currency: string;
  searchTerm: string;
  excludeTerm: string;
  campaignNames: string[];
  adGroupNames: string[];
  matchTypes: string[];
  conversion: ConversionFilter;
  viewMode: TableViewMode;
  chartTopN: number;
  suggestionRules: SuggestionRules;
  dateRange: {
    from?: Date;
    to?: Date;
  }
}
