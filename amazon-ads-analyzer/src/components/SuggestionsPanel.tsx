import { useMemo, useState } from "react";
import * as XLSX from "xlsx";
import { Download, Copy, Sparkles, Settings2, RotateCcw } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import type { AdRecord } from "@/types";
import { generateSuggestions, type SuggestionRow } from "@/lib/suggestions";
import { DEFAULT_SUGGESTION_RULES, useStore } from "@/store";

interface SuggestionsPanelProps {
  data: AdRecord[];
  currency: string;
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

export function SuggestionsPanel({ data, currency }: SuggestionsPanelProps) {
  const [tab, setTab] = useState<"neg" | "harvest" | "bid">("neg");
  const settings = useStore((s) => s.settings);
  const updateSettings = useStore((s) => s.updateSettings);

  const money = useMemo(
    () =>
      new Intl.NumberFormat("zh-CN", {
        style: "currency",
        currency,
        maximumFractionDigits: 2,
      }),
    [currency]
  );

  const { negatives, harvests, bidUp, bidDown } = useMemo(
    () => generateSuggestions(data, settings),
    [data, settings]
  );

  const totalWasteSpend = useMemo(
    () => data.reduce((acc, r) => (r.sales <= 0 && r.orders <= 0 ? acc + r.spend : acc), 0),
    [data]
  );

  const totalSales = useMemo(() => data.reduce((acc, r) => acc + r.sales, 0), [data]);
  const totalSpend = useMemo(() => data.reduce((acc, r) => acc + r.spend, 0), [data]);
  const overallAcos = totalSales > 0 ? (totalSpend / totalSales) * 100 : 0;

  const exportAll = () => {
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(toSheetRows(negatives)), "否定词候选");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(toSheetRows(harvests)), "加词候选");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(toSheetRows(bidUp)), "出价上调");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(toSheetRows(bidDown)), "出价下调");
    const bulkRows = [
      ...toBulkSheetRows(negatives),
      ...toBulkSheetRows(harvests),
      ...toBulkSheetRows(bidUp),
      ...toBulkSheetRows(bidDown),
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(bulkRows), "Bulk-可粘贴");
    XLSX.writeFile(wb, `操作建议-${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  const exportCurrent = () => {
    const wb = XLSX.utils.book_new();
    if (tab === "neg") XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(toSheetRows(negatives)), "否定词候选");
    if (tab === "harvest") XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(toSheetRows(harvests)), "加词候选");
    if (tab === "bid") {
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(toSheetRows(bidUp)), "出价上调");
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(toSheetRows(bidDown)), "出价下调");
    }
    const bulkRows =
      tab === "neg"
        ? toBulkSheetRows(negatives)
        : tab === "harvest"
          ? toBulkSheetRows(harvests)
          : [...toBulkSheetRows(bidUp), ...toBulkSheetRows(bidDown)];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(bulkRows), "Bulk-可粘贴");
    XLSX.writeFile(wb, `操作建议-${tab}-${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  const renderTable = (rows: SuggestionRow[]) => (
    <div className="rounded-md border overflow-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="min-w-[280px]">搜索词</TableHead>
            <TableHead className="min-w-[120px]">建议</TableHead>
            <TableHead className="min-w-[140px]">推荐匹配</TableHead>
            <TableHead className="text-right">花费</TableHead>
            <TableHead className="text-right">销售额</TableHead>
            <TableHead className="text-right">订单</TableHead>
            <TableHead className="text-right">点击</TableHead>
            <TableHead className="text-right">ACOS</TableHead>
            <TableHead className="text-right">转化率</TableHead>
            <TableHead className="min-w-[220px]">说明</TableHead>
            <TableHead className="w-[72px] text-right">复制</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r, idx) => (
            <TableRow key={`${r.kind}-${idx}-${r.searchTerm}`}>
              <TableCell className="font-medium max-w-[360px] truncate" title={r.searchTerm}>
                {r.searchTerm}
              </TableCell>
              <TableCell>
                <Badge variant="secondary">{r.kind}</Badge>
              </TableCell>
              <TableCell>{r.suggestedMatchType}</TableCell>
              <TableCell className="text-right">{money.format(r.spend)}</TableCell>
              <TableCell className="text-right">{money.format(r.sales)}</TableCell>
              <TableCell className="text-right">{r.orders.toLocaleString()}</TableCell>
              <TableCell className="text-right">{r.clicks.toLocaleString()}</TableCell>
              <TableCell className="text-right">{formatPctOrInfinity(r.acos)}</TableCell>
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
            </TableRow>
          ))}
          {!rows.length ? (
            <TableRow>
              <TableCell colSpan={11} className="text-center text-muted-foreground py-10">
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
      <CardHeader className="space-y-2">
        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
          <div className="space-y-1">
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="size-4 text-primary" />
              操作建议
            </CardTitle>
            <div className="text-xs text-muted-foreground">
              浪费花费 {money.format(totalWasteSpend)} • 整体 ACOS {overallAcos.toFixed(2)}%
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2">
                  <Settings2 className="w-4 h-4" />
                  调整规则
                </Button>
              </SheetTrigger>
              <SheetContent className="w-[420px] sm:w-[520px]">
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
            <Button variant="outline" size="sm" className="gap-2" onClick={exportAll}>
              <Download className="w-4 h-4" />
              导出全部
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
          <TabsList>
            <TabsTrigger value="neg">否定词候选（{negatives.length}）</TabsTrigger>
            <TabsTrigger value="harvest">加词候选（{harvests.length}）</TabsTrigger>
            <TabsTrigger value="bid">出价调整（{bidUp.length + bidDown.length}）</TabsTrigger>
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
        </Tabs>
      </CardContent>
    </Card>
  );
}
