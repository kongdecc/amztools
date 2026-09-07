# SEO 与公开内容发布

公开页面的 SEO、工具目录、导航和博客读取仓库文件，不读取数据库。数据库超额不会改变已发布标题、说明、文章和 Sitemap。

## 编辑位置

- `src/config/site-seo.json`：站名、描述、主域名、Google/Baidu 验证代码、关于和隐私内容。
- `src/lib/constants.ts`：工具名称、说明、目录、分类和导航。
- `src/config/static-seo.json`：独立 HTML 工具的标题、说明、canonical。
- `src/config/published-posts.json`：已发布博客正文。当前快照来自 2026-09-07 的公开接口，包含 9 篇文章。
- 工具说明应直接写入各工具自身界面，保持内容与页面设计一致；不要另外追加通用 SEO 内容块。

后台 SEO 页可编辑并下载配置文件。下载并不代表发布成功：替换对应仓库文件，提交并部署才生效。原数据库 SEO 设置不再参与公开渲染。
后台博客仍用于数据库编辑；编辑完需把明确要发布的文章同步到发布快照。不要将私密草稿、账号配置或凭据导入公开 JSON。

## 发布和验证

1. 修改发布文件，保留已有博客 slug，避免旧链接失效。
2. 运行 `node scripts/inject-static-analytics.mjs`，更新静态 HTML。该步骤会在 Vercel 构建时自动执行。
3. 运行 `npm run vercel-build`。部署脚本不再执行数据库 seed；数据库迁移或初始化需要单独运行。
4. 启动生产服务后执行 `node scripts/verify-published-seo.mjs http://localhost:3000`。
5. 部署后重新验证线上站点。

Sitemap 只列最终页面地址，不列重定向地址。没有可信的内容修改时间时不输出 lastmod，避免把浏览数或每次部署当成内容更新。
缺失工具与文章返回 404；迁移后的工具地址永久重定向。临时业务故障不要伪装成永久删除。

## 搜索引擎侧

在 Google Search Console、Bing Webmaster 和百度搜索资源平台验证主域名，提交 `https://www.amztoolbox.top/sitemap.xml`。
Google 验证代码目前为空，需要从你自己的 Search Console 获取；DNS 验证也可使用。已有百度验证代码已保留。
检查首页和重点工具的 URL 检查报告：抓取结果、渲染正文、Google 选定的 canonical、索引原因。
域名级 www 跳转目前由 Vercel 项目配置控制，建议在域名设置中使用永久跳转，目标保持与 siteUrl 一致。

技术可抓取不保证收录或排名。用站长平台报告判断索引情况；站名或工具名的普通搜索还受查询竞争和排名影响。

## 数据库范围

后台登录、编辑、留言、货代发票等业务功能仍可能需要数据库。本次目标是让公开内容与 SEO 不依赖数据库，不是删除所有业务存储。
公开浏览器数据刷新走 `/api/published/*`，与服务器渲染使用同一快照。文章浏览不再逐次写数据库。
