import { useMemo, useState } from "react";
import {
  ResponsiveContainer,
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  ZAxis,
  Tooltip,
  Cell,
  type TooltipContentProps,
} from 'recharts';
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import type { AdRecord } from '@/types';
import { useStore } from "@/store";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { ChevronDown } from "lucide-react";

interface ScatterAnalysisProps {
  data: AdRecord[];
  targetAcos: number;
}

type ChartPoint = {
  name: string;
  x: number;
  y: number;
  z: number;
  acos: number;
  roas: number;
  clicks: number;
  orders: number;
  ctrPct: number;
  cpc: number;
};

function normalizeTerm(value: string) {
  return value.trim().toLowerCase();
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

function ScatterCustomTooltip({ active, payload }: TooltipContentProps<number, string>) {
  if (!active || !payload?.length) return null;
  const d = payload[0]?.payload as ChartPoint | undefined;
  if (!d) return null;

  return (
    <div className="bg-popover border border-border p-3 rounded-lg shadow-lg text-xs">
      <p className="font-bold mb-1 max-w-[200px] truncate">{d.name}</p>
      <p>花费：{d.x.toFixed(2)}</p>
      <p>销售额：{d.y.toFixed(2)}</p>
      <p>点击：{d.clicks}</p>
      <p>订单：{d.orders}</p>
      <p>CTR：{d.ctrPct.toFixed(2)}%</p>
      <p>CPC：{d.cpc.toFixed(2)}</p>
      <p>ACOS：{d.acos.toFixed(1)}%</p>
      <p>ROAS：{d.roas.toFixed(2)}</p>
    </div>
  );
}

export function ScatterAnalysis({ data, targetAcos }: ScatterAnalysisProps) {
  const { settings, updateSettings, data: rawData } = useStore();
  const [panelOpen, setPanelOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [selectedTerm, setSelectedTerm] = useState<string | null>(null);

  const limit = Math.max(1, settings.chartTopN || 200);
  const chartData = useMemo(() => {
    return [...data]
      .sort((a, b) => b.spend - a.spend)
      .slice(0, limit)
      .map(item => ({
        name: item.searchTerm,
        x: item.spend,
        y: item.sales,
        z: item.clicks,
        acos: item.acos,
        roas: item.roas,
        clicks: item.clicks,
        orders: item.orders,
        ctrPct: item.ctr * 100,
        cpc: item.cpc,
      }));
  }, [data, limit]);

  const filteredRawRows = useMemo(() => {
    if (!rawData) return [];
    const splitTerms = (text: string) =>
      text
        .split(/[,\s，;；\n\r\t]+/g)
        .map((s) => s.trim())
        .filter(Boolean)
        .map((s) => s.toLowerCase());
    const includeTerms = splitTerms(settings.searchTerm);
    const excludeTerms = splitTerms(settings.excludeTerm);

    const campaignSet = settings.campaignNames.length ? new Set(settings.campaignNames) : null;
    const adGroupSet = settings.adGroupNames.length ? new Set(settings.adGroupNames) : null;
    const matchTypeSet = settings.matchTypes.length ? new Set(settings.matchTypes) : null;

    const toYmdUtc = (d: Date) =>
      new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())).toISOString().slice(0, 10);
    const fromYmd = settings.dateRange.from ? toYmdUtc(settings.dateRange.from) : null;
    const toYmd = settings.dateRange.to ? toYmdUtc(settings.dateRange.to) : null;

    return rawData.filter((item) => {
      const inRange = (value: number, min: number | null, max: number | null) => {
        if (min !== null && value < min) return false;
        if (max !== null && value > max) return false;
        return true;
      };

      if (fromYmd || toYmd) {
        if (!item.date) return false;
        if (fromYmd && item.date < fromYmd) return false;
        if (toYmd && item.date > toYmd) return false;
      }

      if (!inRange(item.impressions, settings.minImpressions, settings.impressionsMax)) return false;
      if (!inRange(item.clicks, settings.minClicks, settings.clicksMax)) return false;
      if (!inRange(item.spend, settings.spendMin, settings.spendMax)) return false;
      if (!inRange(item.sales, settings.salesMin, settings.salesMax)) return false;
      if (!inRange(item.orders, settings.ordersMin, settings.ordersMax)) return false;

      const ctrPct = item.ctr * 100;
      if (!inRange(ctrPct, settings.ctrMinPct, settings.ctrMaxPct)) return false;

      if (!inRange(item.cpc, settings.cpcMin, settings.cpcMax)) return false;

      const acosForFilter = item.sales > 0 ? item.acos : item.spend > 0 ? Number.POSITIVE_INFINITY : 0;
      if (!inRange(acosForFilter, settings.acosMin, settings.acosMax)) return false;

      if (!inRange(item.roas, settings.roasMin, settings.roasMax)) return false;

      const conversionPct = item.conversionRate * 100;
      if (!inRange(conversionPct, settings.conversionRateMinPct, settings.conversionRateMaxPct)) return false;

      if (campaignSet && !campaignSet.has(item.campaignName)) return false;
      if (adGroupSet && !adGroupSet.has(item.adGroupName)) return false;
      if (matchTypeSet && !matchTypeSet.has(item.matchType)) return false;

      const termText = item.searchTerm.toLowerCase();
      if (includeTerms.length && !includeTerms.some((t) => termText.includes(t))) return false;
      if (excludeTerms.length && excludeTerms.some((t) => termText.includes(t))) return false;

      if (settings.conversion === '有订单' && item.orders <= 0) return false;
      if (settings.conversion === '无订单' && item.orders > 0) return false;
      if (settings.conversion === '有销售' && item.sales <= 0) return false;
      if (settings.conversion === '无销售' && item.sales > 0) return false;

      return true;
    });
  }, [rawData, settings]);

  const selectedTermDaily = useMemo(() => {
    if (!selectedTerm) return [];
    const target = normalizeTerm(selectedTerm);
    const rows = filteredRawRows.filter((r) => normalizeTerm(r.searchTerm) === target && /^\d{4}-\d{2}-\d{2}$/.test(r.date));
    if (!rows.length) return [];

    const byDate = new Map<
      string,
      { date: string; spend: number; sales: number; clicks: number; orders: number; impressions: number }
    >();
    for (const r of rows) {
      const hit = byDate.get(r.date);
      if (!hit) {
        byDate.set(r.date, {
          date: r.date,
          spend: r.spend,
          sales: r.sales,
          clicks: r.clicks,
          orders: r.orders,
          impressions: r.impressions,
        });
      } else {
        hit.spend += r.spend;
        hit.sales += r.sales;
        hit.clicks += r.clicks;
        hit.orders += r.orders;
        hit.impressions += r.impressions;
      }
    }

    return Array.from(byDate.values())
      .map((d) => {
        const cpc = d.clicks > 0 ? d.spend / d.clicks : 0;
        const acosPct = d.sales > 0 ? (d.spend / d.sales) * 100 : d.spend > 0 ? Number.POSITIVE_INFINITY : 0;
        return { ...d, cpc, acosPct };
      })
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [filteredRawRows, selectedTerm]);

  const selectedInsights = useMemo(() => {
    if (!selectedTermDaily.length) return null;
    const total = selectedTermDaily.reduce(
      (acc, d) => {
        acc.spend += d.spend;
        acc.sales += d.sales;
        acc.clicks += d.clicks;
        acc.orders += d.orders;
        return acc;
      },
      { spend: 0, sales: 0, clicks: 0, orders: 0 }
    );
    const avgCpc = total.clicks > 0 ? total.spend / total.clicks : 0;
    const avgAcos = total.sales > 0 ? (total.spend / total.sales) * 100 : 0;
    const bestSales = selectedTermDaily.reduce((best, d) => (d.sales > best.sales ? d : best), selectedTermDaily[0]);
    return { total, avgCpc, avgAcos, bestSales };
  }, [selectedTermDaily]);

  return (
    <Card className="col-span-1 md:col-span-2 min-h-[400px]">
      <Collapsible open={panelOpen} onOpenChange={setPanelOpen}>
        <CardHeader>
          <div className="flex flex-col gap-3">
            <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <CardTitle>
                    花费与销售额相关性（{limit >= data.length ? "全部" : `Top ${limit}`} 搜索词）
                  </CardTitle>
                  <CollapsibleTrigger asChild>
                    <Button variant="ghost" size="sm" className="gap-1">
                      {panelOpen ? "收起" : "展开"}
                      <ChevronDown className={`w-4 h-4 transition-transform ${panelOpen ? "rotate-180" : ""}`} />
                    </Button>
                  </CollapsibleTrigger>
                </div>
                <div className="text-xs text-muted-foreground">
                  横轴=花费，纵轴=销售额，点大小=点击，颜色=是否超过目标 ACOS
                </div>
              </div>

              <div className="flex items-end gap-2">
                <div className="space-y-1">
                  <div className="text-xs text-muted-foreground">散点 Top N</div>
                  <Input
                    className="w-[140px]"
                    type="number"
                    min={1}
                    value={String(settings.chartTopN)}
                    onChange={(e) =>
                      updateSettings({
                        chartTopN: Math.max(1, Math.floor(Number(e.target.value) || 200)),
                      })
                    }
                  />
                  <div className="text-[11px] text-muted-foreground">
                    按花费取前 N 条绘图，避免点太密
                  </div>
                </div>

                <Button variant="outline" size="sm" disabled={!panelOpen} onClick={() => setHelpOpen((v) => !v)}>
                  {helpOpen ? "收起说明" : "怎么看这个图"}
                </Button>
              </div>
            </div>

            <Collapsible open={panelOpen && helpOpen} onOpenChange={setHelpOpen}>
              <CollapsibleContent>
                <div className="rounded-md border bg-muted/30 p-3 text-xs text-muted-foreground space-y-1">
                  <div>右下：高花费低销售，优先排查（否词/出价/匹配/Listing）。</div>
                  <div>左上：低花费高销售，可适度加预算扩量。</div>
                  <div>右上：高花费高销售，看是否超过目标 ACOS 决定扩量或控量。</div>
                  <div>左下：低花费低销售，优先级最低。</div>
                  <div>悬停查看该搜索词的 CTR/CPC/订单/ROAS 等细节。</div>
                </div>
              </CollapsibleContent>
            </Collapsible>
          </div>
        </CardHeader>
        <CollapsibleContent>
          <CardContent className="h-[350px]">
            <ResponsiveContainer width="100%" height="100%">
              <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                <XAxis type="number" dataKey="x" name="花费" stroke="#888888" fontSize={12} />
                <YAxis type="number" dataKey="y" name="销售额" stroke="#888888" fontSize={12} />
                <ZAxis type="number" dataKey="z" range={[50, 400]} name="点击" />
                <Tooltip content={ScatterCustomTooltip} cursor={{ strokeDasharray: '3 3' }} />
                <Scatter
                  name="搜索词"
                  data={chartData}
                  fill="#8884d8"
                  onClick={async (payload: unknown) => {
                    const p = payload as { payload?: ChartPoint } | null;
                    const term = p?.payload?.name ?? "";
                    if (!term) return;
                    const ok = await copyToClipboard(term);
                    if (ok) toast.success("已复制搜索词");
                    else toast.error("复制失败");
                    setSelectedTerm(term);
                  }}
                >
                  {chartData.map((entry, index) => (
                    <Cell 
                      key={`cell-${index}`} 
                      fill={entry.acos > targetAcos ? 'var(--chart-3)' : 'var(--chart-2)'} 
                    />
                  ))}
                </Scatter>
              </ScatterChart>
            </ResponsiveContainer>
          </CardContent>
        </CollapsibleContent>
      </Collapsible>

      <Dialog
        open={!!selectedTerm}
        onOpenChange={(open) => {
          if (!open) setSelectedTerm(null);
        }}
      >
        <DialogContent className="max-w-[900px]">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between gap-3">
              <span className="truncate">{selectedTerm ?? ""}</span>
              <Button
                variant="outline"
                size="sm"
                className="shrink-0"
                onClick={async () => {
                  if (!selectedTerm) return;
                  const ok = await copyToClipboard(selectedTerm);
                  if (ok) toast.success("已复制搜索词");
                  else toast.error("复制失败");
                }}
              >
                复制搜索词
              </Button>
            </DialogTitle>
            <DialogDescription>基于当前筛选条件下的历史数据，汇总该搜索词的天数、平均 CPC、整体 ACOS 与销售额最高值。</DialogDescription>
          </DialogHeader>

          {!selectedInsights ? (
            <div className="text-sm text-muted-foreground py-8 text-center">当前筛选下没有可用于分析的日期数据</div>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                <div className="rounded-md border p-3">
                  <div className="text-xs text-muted-foreground">天数</div>
                  <div className="font-medium">{selectedTermDaily.length}</div>
                </div>
                <div className="rounded-md border p-3">
                  <div className="text-xs text-muted-foreground">平均 CPC</div>
                  <div className="font-medium">{selectedInsights.avgCpc.toFixed(4)}</div>
                </div>
                <div className="rounded-md border p-3">
                  <div className="text-xs text-muted-foreground">整体 ACOS</div>
                  <div className="font-medium">{selectedInsights.avgAcos.toFixed(2)}%</div>
                </div>
                <div className="rounded-md border p-3">
                  <div className="text-xs text-muted-foreground">销售额最高</div>
                  <div className="font-medium">{selectedInsights.bestSales.sales.toFixed(2)}</div>
                </div>
              </div>

            </div>
          )}
        </DialogContent>
      </Dialog>
    </Card>
  );
}
