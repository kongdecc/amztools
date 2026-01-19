import { useMemo, useState } from "react";
import { ResponsiveContainer, ScatterChart, Scatter, XAxis, YAxis, ZAxis, Tooltip, Cell, type TooltipContentProps } from 'recharts';
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import type { AdRecord } from '@/types';
import { useStore } from "@/store";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent } from "@/components/ui/collapsible";

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
  const { settings, updateSettings } = useStore();
  const [helpOpen, setHelpOpen] = useState(false);

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

  return (
    <Card className="col-span-1 md:col-span-2 min-h-[400px]">
      <CardHeader>
        <div className="flex flex-col gap-3">
          <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
            <div className="space-y-1">
              <CardTitle>
                花费与销售额相关性（{limit >= data.length ? "全部" : `Top ${limit}`} 搜索词）
              </CardTitle>
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

              <Button variant="outline" size="sm" onClick={() => setHelpOpen((v) => !v)}>
                {helpOpen ? "收起说明" : "怎么看这个图"}
              </Button>
            </div>
          </div>

          <Collapsible open={helpOpen} onOpenChange={setHelpOpen}>
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
      <CardContent className="h-[350px]">
        <ResponsiveContainer width="100%" height="100%">
          <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
            <XAxis type="number" dataKey="x" name="花费" stroke="#888888" fontSize={12} />
            <YAxis type="number" dataKey="y" name="销售额" stroke="#888888" fontSize={12} />
            <ZAxis type="number" dataKey="z" range={[50, 400]} name="点击" />
            <Tooltip content={ScatterCustomTooltip} cursor={{ strokeDasharray: '3 3' }} />
            <Scatter name="搜索词" data={chartData} fill="#8884d8">
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
    </Card>
  );
}
