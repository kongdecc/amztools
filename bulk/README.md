# 亚马逊批量广告表格生成器（Web版）

这个项目把 **Amazon Advertising Bulk Sheet（批量操作表）** 的“填Excel”过程，做成一个可视化的 Web 工具：你在页面里输入广告活动/广告组/SKU/关键词/否词/广告位加价等信息，点击导出，即可得到可在亚马逊后台 **Bulk operations** 上传的 `.xlsx` 文件。

> 当前版本支持：**Sponsored Products（SP）/ Sponsored Brands（SB）/ Sponsored Display（SD）/ Portfolios** 的常见建档场景。

## 支持范围（当前）

- **Sponsored Products Campaigns**（SP主表）自动生成多层级行：
  - Campaign
  -（可选）Bidding Adjustment
  - Ad Group
  - Product Ad（SKU）
  - Keyword（手动关键词模式）
  - Product Targeting（自动广告/商品定位模式）
  -（可选）Negative Keyword

- 导出文件会包含模板里的多个Sheet，目前可填充：
  - `Sponsored Products Campaigns`
  - `Sponsored Brands Campaigns`
  - `Sponsored Display Campaigns`
  - `Portfolios`

## 重要约束 / 说明

- 该工具为**纯前端离线生成**：数据不上传服务器。
- Amazon Bulk模板/字段会随时间调整；如果你在上传时遇到报错，可能需要：
  1) 更新模板头部字段；或
  2) 补齐某些必填列（例如某些站点/账户策略导致的必填差异）。

## 开发

```bash
pnpm install
pnpm dev
```

构建：

```bash
pnpm build
pnpm preview
```

## 下一步可扩展

- 基于站点/广告类型的必填字段模板（降低上传报错率）
- 从“历史下载Bulk数据”中反向导入并可视化编辑
- 常见报错规则的本地校验增强（日期先后、ID重复、策略冲突）
- 批量粘贴（CSV/TSV）与字段映射助手
