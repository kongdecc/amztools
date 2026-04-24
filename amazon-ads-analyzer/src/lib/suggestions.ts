import type { AdRecord, AnalysisSettings } from "@/types";
import type { AggregatedRowDetails } from "@/lib/aggregate";

export type SuggestionKind = "否定词候选" | "加词候选" | "出价上调" | "出价下调" | "高点击低转化" | "广告组高点击无成交" | "高ACOS";

export type SuggestedMatchType = "Negative Exact" | "Negative Phrase" | "Exact" | "Phrase";

export type SuggestionRow = {
  kind: SuggestionKind;
  searchTerm: string;
  suggestedMatchType: SuggestedMatchType;
  reason: string;
  bidAdjustmentPct?: number;
  rowId: string;
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

function getBidAdjustmentPct(kind: "up" | "down", acos: number, targetAcos: number) {
  if (!Number.isFinite(targetAcos) || targetAcos <= 0) return kind === "up" ? 10 : -10;
  const ratio = acos / targetAcos;
  if (kind === "up") {
    if (ratio <= 0.5) return 20;
    if (ratio <= 0.7) return 15;
    return 10;
  }
  if (ratio >= 2) return -30;
  if (ratio >= 1.6) return -20;
  return -10;
}

export function generateSuggestions(
  rows: AdRecord[],
  settings: AnalysisSettings,
  detailsById?: Record<string, AggregatedRowDetails>
) {
  const totalClicks = rows.reduce((acc, r) => acc + r.clicks, 0);
  const totalSpend = rows.reduce((acc, r) => acc + r.spend, 0);
  const overallAvgCpc = totalClicks > 0 ? totalSpend / totalClicks : 0;

  const rules = settings.suggestionRules;
  const targetAcos = Math.max(0, settings.targetAcos);
  const negativeClicks = Math.max(1, Math.floor(rules.negativeMinClicks));
  const harvestClicks = Math.max(1, Math.floor(rules.harvestMinClicks));
  const bidClicks = Math.max(1, Math.floor(rules.bidMinClicks));
  const negativeSpend = Math.max(0, rules.negativeMinSpend);
  const harvestMinOrders = Math.max(1, Math.floor(rules.harvestMinOrders));
  const harvestMinCvrPct = Math.max(0, rules.harvestMinCvrPct);
  const bidUpAcosFactor = Math.max(0, rules.bidUpAcosFactor);
  const bidDownAcosFactor = Math.max(0, rules.bidDownAcosFactor);
  const bidUpAcosThreshold = targetAcos * bidUpAcosFactor;
  const bidDownAcosThreshold = targetAcos * bidDownAcosFactor;
  const adaptiveNegativeSpend = Math.max(negativeSpend, overallAvgCpc * negativeClicks);
  const highClickMinClicks = Math.max(1, Math.floor(rules.highClickMinClicks));
  const highClickMaxCvrPct = Math.max(0, rules.highClickMaxCvrPct);
  const adGroupNoOrderMinClicks = Math.max(1, Math.floor(rules.adGroupNoOrderMinClicks));
  const highAcosThreshold = Math.max(0, rules.highAcosThreshold);

  const negatives: SuggestionRow[] = [];
  const harvests: SuggestionRow[] = [];
  const bidUp: SuggestionRow[] = [];
  const bidDown: SuggestionRow[] = [];
  const watch: SuggestionRow[] = [];

  for (const row of rows) {
    const ctrPct = row.ctr * 100;
    const conversionRatePct = row.conversionRate * 100;
    const acosComparable = getAcosForCompare(row);
    const acos = row.sales > 0 ? row.acos : null;
    const roas = row.spend > 0 ? row.roas : null;
    const adGroupDetails = detailsById?.[row.id];
    const adGroupStats = adGroupDetails?.adGroupStats;

    if (row.spend > 0 && row.sales <= 0 && row.orders <= 0) {
      if (row.clicks >= negativeClicks || row.spend >= adaptiveNegativeSpend) {
        const reason =
          row.clicks >= negativeClicks
            ? `点击≥${negativeClicks}仍无转化`
            : `花费≥${adaptiveNegativeSpend.toFixed(2)}仍无转化`;
        negatives.push({
          kind: "否定词候选",
          searchTerm: row.searchTerm,
          suggestedMatchType: row.searchTerm.includes(" ") ? "Negative Phrase" : "Negative Exact",
          reason,
          rowId: row.id,
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
      const acosOk = row.acos <= targetAcos;
      const strong = conversionRatePct >= harvestMinCvrPct || row.orders >= harvestMinOrders;
      if (acosOk && strong) {
        harvests.push({
          kind: "加词候选",
          searchTerm: row.searchTerm,
          suggestedMatchType: row.searchTerm.includes(" ") ? "Phrase" : "Exact",
          reason:
            conversionRatePct >= harvestMinCvrPct
              ? `转化率≥${harvestMinCvrPct.toFixed(0)}% 且 ACOS≤${targetAcos.toFixed(0)}%`
              : `订单≥${harvestMinOrders} 且 ACOS≤${targetAcos.toFixed(0)}%`,
          rowId: row.id,
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
      if (row.acos <= bidUpAcosThreshold) {
        const bidAdjustmentPct = getBidAdjustmentPct("up", row.acos, targetAcos);
        bidUp.push({
          kind: "出价上调",
          searchTerm: row.searchTerm,
          suggestedMatchType: row.searchTerm.includes(" ") ? "Phrase" : "Exact",
          reason: `ACOS≤${bidUpAcosThreshold.toFixed(1)}%（目标 ACOS ${targetAcos.toFixed(0)}% × ${Math.round(bidUpAcosFactor * 100)}%），建议提价 ${bidAdjustmentPct}%`,
          bidAdjustmentPct,
          rowId: row.id,
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
      } else if (acosComparable >= bidDownAcosThreshold && row.sales > 0) {
        const bidAdjustmentPct = getBidAdjustmentPct("down", acosComparable, targetAcos);
        bidDown.push({
          kind: "出价下调",
          searchTerm: row.searchTerm,
          suggestedMatchType: row.searchTerm.includes(" ") ? "Phrase" : "Exact",
          reason: `ACOS≥${bidDownAcosThreshold.toFixed(1)}%（目标 ACOS ${targetAcos.toFixed(0)}% × ${Math.round(bidDownAcosFactor * 100)}%），建议降价 ${Math.abs(bidAdjustmentPct)}%`,
          bidAdjustmentPct,
          rowId: row.id,
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

    if (adGroupStats?.length) {
      for (const group of adGroupStats) {
        if (group.orders <= 0 || group.clicks < highClickMinClicks) continue;
        const groupCtrPct = group.impressions > 0 ? (group.clicks / group.impressions) * 100 : 0;
        const groupCpc = group.clicks > 0 ? group.spend / group.clicks : 0;
        const groupConversionRatePct = group.clicks > 0 ? (group.orders / group.clicks) * 100 : 0;
        if (groupConversionRatePct > highClickMaxCvrPct) continue;
        const groupAcos = group.sales > 0 ? (group.spend / group.sales) * 100 : null;
        const groupRoas = group.spend > 0 ? group.sales / group.spend : null;
        watch.push({
          kind: "高点击低转化",
          searchTerm: row.searchTerm,
          suggestedMatchType: row.searchTerm.includes(" ") ? "Phrase" : "Exact",
          reason: `点击≥${highClickMinClicks} 且 转化率≤${highClickMaxCvrPct.toFixed(1)}%`,
          rowId: `${row.id}::${group.campaignName}::${group.adGroupName}`,
          campaignName: group.campaignName,
          adGroupName: group.adGroupName,
          matchType: row.matchType,
          impressions: group.impressions,
          clicks: group.clicks,
          spend: group.spend,
          sales: group.sales,
          orders: group.orders,
          ctrPct: groupCtrPct,
          cpc: groupCpc,
          acos: groupAcos,
          roas: groupRoas,
          conversionRatePct: groupConversionRatePct,
        });
      }
    } else if (row.orders > 0 && row.clicks >= highClickMinClicks && conversionRatePct <= highClickMaxCvrPct) {
      watch.push({
        kind: "高点击低转化",
        searchTerm: row.searchTerm,
        suggestedMatchType: row.searchTerm.includes(" ") ? "Phrase" : "Exact",
        reason: `点击≥${highClickMinClicks} 且 转化率≤${highClickMaxCvrPct.toFixed(1)}%`,
        rowId: row.id,
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

    if (adGroupStats?.length) {
      for (const group of adGroupStats) {
        if (group.orders <= 0 || group.sales <= 0) continue;
        const groupAcos = (group.spend / group.sales) * 100;
        if (groupAcos < highAcosThreshold) continue;
        const groupCtrPct = group.impressions > 0 ? (group.clicks / group.impressions) * 100 : 0;
        const groupCpc = group.clicks > 0 ? group.spend / group.clicks : 0;
        const groupConversionRatePct = group.clicks > 0 ? (group.orders / group.clicks) * 100 : 0;
        const groupRoas = group.spend > 0 ? group.sales / group.spend : null;
        watch.push({
          kind: "高ACOS",
          searchTerm: row.searchTerm,
          suggestedMatchType: row.searchTerm.includes(" ") ? "Phrase" : "Exact",
          reason: `ACOS≥${highAcosThreshold.toFixed(1)}%`,
          rowId: `${row.id}::${group.campaignName}::${group.adGroupName}`,
          campaignName: group.campaignName,
          adGroupName: group.adGroupName,
          matchType: row.matchType,
          impressions: group.impressions,
          clicks: group.clicks,
          spend: group.spend,
          sales: group.sales,
          orders: group.orders,
          ctrPct: groupCtrPct,
          cpc: groupCpc,
          acos: groupAcos,
          roas: groupRoas,
          conversionRatePct: groupConversionRatePct,
        });
      }
    } else if (row.orders > 0 && row.sales > 0 && row.acos >= highAcosThreshold) {
      watch.push({
        kind: "高ACOS",
        searchTerm: row.searchTerm,
        suggestedMatchType: row.searchTerm.includes(" ") ? "Phrase" : "Exact",
        reason: `ACOS≥${highAcosThreshold.toFixed(1)}%`,
        rowId: row.id,
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

    if (adGroupStats?.length) {
      for (const group of adGroupStats) {
        if (group.orders > 0 || group.clicks < adGroupNoOrderMinClicks) continue;
        const groupCtrPct = group.impressions > 0 ? (group.clicks / group.impressions) * 100 : 0;
        const groupCpc = group.clicks > 0 ? group.spend / group.clicks : 0;
        const groupAcos = group.sales > 0 ? (group.spend / group.sales) * 100 : null;
        const groupRoas = group.spend > 0 ? group.sales / group.spend : null;
        watch.push({
          kind: "广告组高点击无成交",
          searchTerm: row.searchTerm,
          suggestedMatchType: row.searchTerm.includes(" ") ? "Phrase" : "Exact",
          reason: `单广告组点击≥${adGroupNoOrderMinClicks}且无成交`,
          rowId: `${row.id}::${group.campaignName}::${group.adGroupName}`,
          campaignName: group.campaignName,
          adGroupName: group.adGroupName,
          matchType: row.matchType,
          impressions: group.impressions,
          clicks: group.clicks,
          spend: group.spend,
          sales: group.sales,
          orders: group.orders,
          ctrPct: groupCtrPct,
          cpc: groupCpc,
          acos: groupAcos,
          roas: groupRoas,
          conversionRatePct: group.clicks > 0 ? (group.orders / group.clicks) * 100 : 0,
        });
      }
    } else if (row.orders <= 0 && row.clicks >= adGroupNoOrderMinClicks) {
      watch.push({
        kind: "广告组高点击无成交",
        searchTerm: row.searchTerm,
        suggestedMatchType: row.searchTerm.includes(" ") ? "Phrase" : "Exact",
        reason: `单广告组点击≥${adGroupNoOrderMinClicks}且无成交`,
        rowId: row.id,
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

  negatives.sort((a, b) => b.spend - a.spend);
  harvests.sort((a, b) => (b.sales - a.sales) || (b.orders - a.orders) || (b.clicks - a.clicks));
  bidUp.sort((a, b) => (b.sales - a.sales) || (b.orders - a.orders));
  bidDown.sort((a, b) => (b.spend - a.spend) || (b.acos ?? 0) - (a.acos ?? 0));
  watch.sort((a, b) => (b.spend - a.spend) || (b.acos ?? 0) - (a.acos ?? 0) || (b.clicks - a.clicks));

  return {
    negatives,
    harvests,
    bidUp,
    bidDown,
    watch,
    meta: {
      overallAvgCpc,
      negativeClicks,
      harvestClicks,
      bidClicks,
      negativeSpend: adaptiveNegativeSpend,
      harvestMinOrders,
      harvestMinCvrPct,
      bidUpAcosFactor,
      bidDownAcosFactor,
    },
  };
}
