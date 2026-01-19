import type { AdRecord, AnalysisSettings } from "@/types";

export type SuggestionKind = "否定词候选" | "加词候选" | "出价上调" | "出价下调";

export type SuggestedMatchType = "Negative Exact" | "Negative Phrase" | "Exact" | "Phrase";

export type SuggestionRow = {
  kind: SuggestionKind;
  searchTerm: string;
  suggestedMatchType: SuggestedMatchType;
  reason: string;
  campaignName: string;
  adGroupName: string;
  matchType: string;
  impressions: number;
  clicks: number;
  spend: number;
  sales: number;
  orders: number;
  ctrPct: number;
  cpc: number;
  acos: number | null;
  roas: number | null;
  conversionRatePct: number;
};

function getAcosForCompare(row: AdRecord) {
  if (row.sales > 0) return row.acos;
  if (row.spend > 0) return Number.POSITIVE_INFINITY;
  return 0;
}

export function generateSuggestions(rows: AdRecord[], settings: AnalysisSettings) {
  const totalClicks = rows.reduce((acc, r) => acc + r.clicks, 0);
  const totalSpend = rows.reduce((acc, r) => acc + r.spend, 0);
  const overallAvgCpc = totalClicks > 0 ? totalSpend / totalClicks : 0;

  const rules = settings.suggestionRules;
  const negativeClicks = Math.max(1, Math.floor(rules.negativeMinClicks));
  const harvestClicks = Math.max(1, Math.floor(rules.harvestMinClicks));
  const bidClicks = Math.max(1, Math.floor(rules.bidMinClicks));
  const negativeSpend = Math.max(0, rules.negativeMinSpend);
  const harvestMinOrders = Math.max(1, Math.floor(rules.harvestMinOrders));
  const harvestMinCvrPct = Math.max(0, rules.harvestMinCvrPct);
  const bidUpAcosFactor = Math.max(0, rules.bidUpAcosFactor);
  const bidDownAcosFactor = Math.max(0, rules.bidDownAcosFactor);

  const negatives: SuggestionRow[] = [];
  const harvests: SuggestionRow[] = [];
  const bidUp: SuggestionRow[] = [];
  const bidDown: SuggestionRow[] = [];

  for (const row of rows) {
    const ctrPct = row.ctr * 100;
    const conversionRatePct = row.conversionRate * 100;
    const acosComparable = getAcosForCompare(row);
    const acos = row.sales > 0 ? row.acos : null;
    const roas = row.spend > 0 ? row.roas : null;

    if (row.spend > 0 && row.sales <= 0 && row.orders <= 0) {
      if (row.clicks >= negativeClicks || row.spend >= negativeSpend) {
        const reason =
          row.clicks >= negativeClicks
            ? `点击≥${negativeClicks}仍无转化`
            : `花费≥${negativeSpend.toFixed(2)}仍无转化`;
        negatives.push({
          kind: "否定词候选",
          searchTerm: row.searchTerm,
          suggestedMatchType: row.searchTerm.includes(" ") ? "Negative Phrase" : "Negative Exact",
          reason,
          campaignName: row.campaignName,
          adGroupName: row.adGroupName,
          matchType: row.matchType,
          impressions: row.impressions,
          clicks: row.clicks,
          spend: row.spend,
          sales: row.sales,
          orders: row.orders,
          ctrPct,
          cpc: row.cpc,
          acos,
          roas,
          conversionRatePct,
        });
      }
    }

    if (row.orders > 0 && row.sales > 0 && row.clicks >= harvestClicks) {
      const acosOk = row.acos <= settings.targetAcos;
      const strong = conversionRatePct >= harvestMinCvrPct || row.orders >= harvestMinOrders;
      if (acosOk && strong) {
        harvests.push({
          kind: "加词候选",
          searchTerm: row.searchTerm,
          suggestedMatchType: row.searchTerm.includes(" ") ? "Phrase" : "Exact",
          reason:
            conversionRatePct >= harvestMinCvrPct
              ? `转化率≥${harvestMinCvrPct.toFixed(0)}% 且 ACOS 达标`
              : `订单≥${harvestMinOrders} 且 ACOS 达标`,
          campaignName: row.campaignName,
          adGroupName: row.adGroupName,
          matchType: row.matchType,
          impressions: row.impressions,
          clicks: row.clicks,
          spend: row.spend,
          sales: row.sales,
          orders: row.orders,
          ctrPct,
          cpc: row.cpc,
          acos,
          roas,
          conversionRatePct,
        });
      }
    }

    if (row.orders > 0 && row.sales > 0 && row.clicks >= bidClicks) {
      if (row.acos <= settings.targetAcos * bidUpAcosFactor) {
        bidUp.push({
          kind: "出价上调",
          searchTerm: row.searchTerm,
          suggestedMatchType: row.searchTerm.includes(" ") ? "Phrase" : "Exact",
          reason: `ACOS≤目标的${Math.round(bidUpAcosFactor * 100)}%（${settings.targetAcos}%）`,
          campaignName: row.campaignName,
          adGroupName: row.adGroupName,
          matchType: row.matchType,
          impressions: row.impressions,
          clicks: row.clicks,
          spend: row.spend,
          sales: row.sales,
          orders: row.orders,
          ctrPct,
          cpc: row.cpc,
          acos,
          roas,
          conversionRatePct,
        });
      } else if (acosComparable >= settings.targetAcos * bidDownAcosFactor && row.sales > 0) {
        bidDown.push({
          kind: "出价下调",
          searchTerm: row.searchTerm,
          suggestedMatchType: row.searchTerm.includes(" ") ? "Phrase" : "Exact",
          reason: `ACOS≥目标的${Math.round(bidDownAcosFactor * 100)}%（${settings.targetAcos}%）`,
          campaignName: row.campaignName,
          adGroupName: row.adGroupName,
          matchType: row.matchType,
          impressions: row.impressions,
          clicks: row.clicks,
          spend: row.spend,
          sales: row.sales,
          orders: row.orders,
          ctrPct,
          cpc: row.cpc,
          acos,
          roas,
          conversionRatePct,
        });
      }
    }
  }

  negatives.sort((a, b) => b.spend - a.spend);
  harvests.sort((a, b) => (b.sales - a.sales) || (b.orders - a.orders) || (b.clicks - a.clicks));
  bidUp.sort((a, b) => (b.sales - a.sales) || (b.orders - a.orders));
  bidDown.sort((a, b) => (b.spend - a.spend) || (b.acos ?? 0) - (a.acos ?? 0));

  return {
    negatives,
    harvests,
    bidUp,
    bidDown,
    meta: {
      overallAvgCpc,
      negativeClicks,
      harvestClicks,
      bidClicks,
      negativeSpend,
      harvestMinOrders,
      harvestMinCvrPct,
      bidUpAcosFactor,
      bidDownAcosFactor,
    },
  };
}
