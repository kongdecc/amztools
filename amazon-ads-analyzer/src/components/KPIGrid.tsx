import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import {
  DollarSign,
  ShoppingCart,
  Percent,
  MousePointerClick,
  Target,
  TrendingUp,
  ShoppingBag,
  AlertTriangle,
} from "lucide-react";

interface KPIGridProps {
  totalSpend: number;
  totalSales: number;
  overallAcos: number;
  totalClicks: number;
  totalImpressions: number;
  totalOrders: number;
  overallRoas: number;
  overallCtr: number;
  overallCpc: number;
  overallConversionRate: number;
  wasteSpend: number;
  currency: string;
  targetAcos: number;
}

export function KPIGrid({
  totalSpend,
  totalSales,
  overallAcos,
  totalClicks,
  totalImpressions,
  totalOrders,
  overallRoas,
  overallCtr,
  overallCpc,
  overallConversionRate,
  wasteSpend,
  currency,
  targetAcos,
}: KPIGridProps) {
  const formatMoney = (val: number) => 
    new Intl.NumberFormat('zh-CN', { style: 'currency', currency }).format(val);

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">总花费</CardTitle>
          <DollarSign className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{formatMoney(totalSpend)}</div>
          <p className="text-xs text-muted-foreground">广告投入</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">总销售额</CardTitle>
          <ShoppingCart className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{formatMoney(totalSales)}</div>
          <p className="text-xs text-muted-foreground">带来销售</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">整体 ACOS</CardTitle>
          <Percent className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className={cn(
            "text-2xl font-bold",
            overallAcos > targetAcos ? "text-destructive" : "text-emerald-600"
          )}>
            {overallAcos.toFixed(2)}%
          </div>
          <p className="text-xs text-muted-foreground">投产效率</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">总点击</CardTitle>
          <MousePointerClick className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{totalClicks.toLocaleString()}</div>
          <p className="text-xs text-muted-foreground">流量规模</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">整体 ROAS</CardTitle>
          <TrendingUp className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{overallRoas.toFixed(2)}</div>
          <p className="text-xs text-muted-foreground">销售 / 花费</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">总订单</CardTitle>
          <ShoppingBag className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{totalOrders.toLocaleString()}</div>
          <p className="text-xs text-muted-foreground">订单规模</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">CTR / CVR</CardTitle>
          <Target className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            {(overallCtr * 100).toFixed(2)}% / {(overallConversionRate * 100).toFixed(2)}%
          </div>
          <p className="text-xs text-muted-foreground">
            展示 {totalImpressions.toLocaleString()} • CPC {formatMoney(overallCpc)}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">浪费花费</CardTitle>
          <AlertTriangle className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className={cn("text-2xl font-bold", wasteSpend > 0 ? "text-destructive" : "text-emerald-600")}>
            {formatMoney(wasteSpend)}
          </div>
          <p className="text-xs text-muted-foreground">无销售且无订单的花费</p>
        </CardContent>
      </Card>
    </div>
  );
}
