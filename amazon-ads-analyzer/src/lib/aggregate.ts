import type { AdRecord } from "@/types";

type AggregateKey = {
  campaignName: string;
  adGroupName: string;
  matchType: string;
};

function toKeyPart(value: string) {
  return value.trim().toLowerCase();
}

function summarizeKey(values: string[], fallback: string) {
  const uniq = Array.from(new Set(values.map((v) => v.trim()).filter(Boolean)));
  if (!uniq.length) return fallback;
  if (uniq.length === 1) return uniq[0];
  return `（多：${uniq.length}）`;
}

export type AggregatedRowDetails = {
  campaignNames: string[];
  adGroupNames: string[];
  matchTypes: string[];
  sourceRows: number;
};

export function aggregateBySearchTerm(rows: AdRecord[]) {
  const byKey = new Map<string, { base: AdRecord; key: AggregateKey; rows: AdRecord[] }>();

  for (const row of rows) {
    const normalized = toKeyPart(row.searchTerm);
    if (!normalized) continue;
    const hit = byKey.get(normalized);
    if (!hit) {
      byKey.set(normalized, {
        base: {
          ...row,
          id: `agg:${normalized}`,
          date: "",
          campaignName: "",
          adGroupName: "",
          matchType: "",
        },
        key: {
          campaignName: row.campaignName,
          adGroupName: row.adGroupName,
          matchType: row.matchType,
        },
        rows: [row],
      });
    } else {
      hit.rows.push(row);
    }
  }

  const out: AdRecord[] = [];
  const detailsById: Record<string, AggregatedRowDetails> = {};

  for (const [normalized, bucket] of byKey) {
    const id = `agg:${normalized}`;
    const sum = bucket.rows.reduce(
      (acc, r) => {
        acc.impressions += r.impressions;
        acc.clicks += r.clicks;
        acc.spend += r.spend;
        acc.sales += r.sales;
        acc.orders += r.orders;
        return acc;
      },
      { impressions: 0, clicks: 0, spend: 0, sales: 0, orders: 0 }
    );

    const campaignNames = Array.from(new Set(bucket.rows.map((r) => r.campaignName.trim()).filter(Boolean))).sort(
      (a, b) => a.localeCompare(b, "zh-Hans-CN")
    );
    const adGroupNames = Array.from(new Set(bucket.rows.map((r) => r.adGroupName.trim()).filter(Boolean))).sort(
      (a, b) => a.localeCompare(b, "zh-Hans-CN")
    );
    const matchTypes = Array.from(new Set(bucket.rows.map((r) => r.matchType.trim()).filter(Boolean))).sort(
      (a, b) => a.localeCompare(b, "zh-Hans-CN")
    );

    const campaignName = summarizeKey(
      campaignNames,
      bucket.key.campaignName
    );
    const adGroupName = summarizeKey(
      adGroupNames,
      bucket.key.adGroupName
    );
    const matchType = summarizeKey(
      matchTypes,
      bucket.key.matchType
    );

    const ctr = sum.impressions > 0 ? sum.clicks / sum.impressions : 0;
    const cpc = sum.clicks > 0 ? sum.spend / sum.clicks : 0;
    const acos = sum.sales > 0 ? (sum.spend / sum.sales) * 100 : 0;
    const roas = sum.spend > 0 ? sum.sales / sum.spend : 0;
    const conversionRate = sum.clicks > 0 ? sum.orders / sum.clicks : 0;

    out.push({
      ...bucket.base,
      id,
      searchTerm: bucket.base.searchTerm,
      campaignName,
      adGroupName,
      matchType,
      impressions: sum.impressions,
      clicks: sum.clicks,
      spend: sum.spend,
      sales: sum.sales,
      orders: sum.orders,
      ctr,
      cpc,
      acos,
      roas,
      conversionRate,
    });

    detailsById[id] = {
      campaignNames,
      adGroupNames,
      matchTypes,
      sourceRows: bucket.rows.length,
    };
  }

  return { rows: out, detailsById };
}
