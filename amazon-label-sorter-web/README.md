# Amazon 箱唛按 SKU 归集工具（网页版）

纯前端静态网页：把多个仓库混排的 Amazon FBA / AWD 标签 PDF，按 SKU 跨仓归集成独立 PDF，并打包 ZIP 下载。

## 隐私设计

- PDF 只在用户浏览器本地读取、识别和生成，不上传服务器。
- 项目中不包含任何测试 PDF、客户名、公司名或货件资料。
- “去掉公司名”会修改 PDF 文字指令，而不是用白色方块遮挡；遇到不支持的编码会停止生成并提示。

## 本地运行

```bash
npm install
npm run dev
```

生产构建：

```bash
npm run build
```

构建结果位于 `dist/`。

## 部署到 Vercel

1. 将本文件夹单独推送到 GitHub 仓库（不要把上一级目录的测试 PDF 一起提交）。
2. 在 Vercel 选择 **Add New → Project**，导入该仓库。
3. Framework Preset 选择 **Vite**；Build Command 使用 `npm run build`；Output Directory 使用 `dist`。
4. 点击 Deploy。项目无需环境变量、数据库或后端服务。

## 当前支持

- 多 PDF、多仓库、跨文件按 SKU 归集
- FBA `Single SKU` 模板
- AWD `SKU:` 模板
- 可选删除 `FBA:` / `AWD:` 后面的公司名
- 可选添加 `Made in China`
- 生成每个 SKU 的 PDF、`分组明细.csv` 和使用说明，统一打包 ZIP

加密 PDF、纯扫描图片 PDF 或未知的新模板可能无法识别；请在识别预览中核对页数和 SKU。

