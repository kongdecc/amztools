import { BarChart3, Boxes, Clock3, PieChart, Search, ShoppingBag, Target, TrendingUp, Wallet } from 'lucide-react';
import { Link } from 'wouter';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

const reportCards = [
  {
    title: '搜索词报表分析',
    desc: '适合做否定词、词根、ASIN 与搜索词表现分析',
    path: '/search-term',
    icon: Search,
    formats: '.csv / .xlsx / .xls',
    status: '已支持',
  },
  {
    title: '投放报表分析',
    desc: '分析关键词/ASIN 投放位的点击、花费、转化表现',
    path: '/targeting-report',
    icon: Target,
    formats: '.csv / .xlsx / .xls',
    status: '已支持',
  },
  {
    title: '广告活动报表分析',
    desc: '按活动维度查看预算、花费、ACOS、ROAS 与状态',
    path: '/campaign-report',
    icon: BarChart3,
    formats: '.csv / .xlsx / .xls',
    status: '已支持',
  },
  {
    title: '广告位报表分析',
    desc: '按顶部/其余/商品页等广告位评估效率并给出竞价建议',
    path: '/placement-report',
    icon: PieChart,
    formats: '.csv / .xlsx / .xls',
    status: '已支持',
  },
  {
    title: '预算报表分析',
    desc: '按预算使用率与错失销售评估预算缺口并输出迁移建议',
    path: '/budget-report',
    icon: Wallet,
    formats: '.csv / .xlsx / .xls',
    status: '已支持',
  },
  {
    title: '推广的商品报表分析',
    desc: 'SKU/ASIN 维度评估投产与产品角色，支持四象限与转化诊断',
    path: '/advertised-product-report',
    icon: Boxes,
    formats: '.csv / .xlsx / .xls',
    status: '已支持',
  },
  {
    title: '已购买商品报表分析',
    desc: '分析直接/间接转化与交叉销售机会，识别引流款与承接款',
    path: '/purchased-product-report',
    icon: ShoppingBag,
    formats: '.csv / .xlsx / .xls',
    status: '已支持',
  },
  {
    title: '搜索词展示量份额报表分析',
    desc: '定位低份额高价值搜索词，判断预算/竞价导致的曝光损失',
    path: '/search-term-impression-share-report',
    icon: TrendingUp,
    formats: '.csv / .xlsx / .xls',
    status: '已支持',
  },
  {
    title: '按时间查看效果报表分析',
    desc: '按时段识别高效与低效投放窗口，优化预算节奏和分时竞价',
    path: '/performance-over-time-report',
    icon: Clock3,
    formats: '.csv / .xlsx / .xls',
    status: '已支持',
  },
];

export default function ReportHub() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <main className="mx-auto w-full max-w-6xl p-6 md:p-10 space-y-8">
        <div className="space-y-2">
          <h1 className="text-3xl font-semibold tracking-tight">Amazon 广告报表分析中心</h1>
          <p className="text-muted-foreground">
            先选择报表类型，再进入对应上传与分析页面。
          </p>
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5 xl:grid-cols-5">
          {reportCards.map((item) => {
            const Icon = item.icon;
            return (
              <Card key={item.path} className="flex h-full flex-col">
                <CardHeader className="space-y-3">
                  <div className="inline-flex h-10 w-10 items-center justify-center rounded-md bg-primary/10 text-primary">
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="space-y-1">
                    <CardTitle className="text-lg">{item.title}</CardTitle>
                    <CardDescription>{item.desc}</CardDescription>
                  </div>
                </CardHeader>
                <CardContent className="mt-auto space-y-3">
                  <div className="text-xs text-muted-foreground">支持格式：{item.formats}</div>
                  <div className="text-xs text-muted-foreground">当前状态：{item.status}</div>
                  <Link href={item.path}>
                    <Button className="w-full">进入分析</Button>
                  </Link>
                </CardContent>
              </Card>
            );
          })}
        </div>
        <footer className="pt-4 pb-2 text-center text-xs text-muted-foreground">
          版权归 跨境乐趣园所有 | 作者：達哥 | 官网：
          <a
            className="ml-1 underline underline-offset-4"
            href="https://amzlink.top/"
            target="_blank"
            rel="noreferrer"
          >
            https://amzlink.top/
          </a>
        </footer>
      </main>
    </div>
  );
}
