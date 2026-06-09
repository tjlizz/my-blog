---
title: 搞懂 sitemap.xml 和 robots.txt，网站 SEO 的第一步
date: 2026-06-09 10:00:00
tags:
  - SEO
  - sitemap
  - robots.txt
  - 爬虫
  - 网站优化
categories:
  - 技术实践
excerpt: sitemap.xml 告诉搜索引擎你有哪些页面，robots.txt 告诉它哪些不能碰。两个文件搞明白，网站收录不再玄学。
description: 从零讲清 sitemap.xml 和 robots.txt 的格式、配置、注意事项，以及它们怎么配合让搜索引擎更好地收录你的网站。
---

如果你自己搭过网站，大概率听过这两个文件：`robots.txt` 和 `sitemap.xml`。

但很多人对它们的理解是模糊的——"好像跟 SEO 有关"、"放根目录就行"、"抄了一个模板就不管了"。

实际上，这两个文件是你和搜索引擎爬虫之间的"沟通协议"。搞懂了它们，收录问题能解决一大半。这篇文章不扯概念，直接讲清楚它们是什么、怎么写、怎么用、怎么避免踩坑。

## 你被收录了吗

先做个小测试。

打开浏览器，访问你的网站域名，在网址后面加上 `/robots.txt`。比如 `https://yoursite.com/robots.txt`。看看返回了什么。

大概率两种情况：

- **404 Not Found**——你根本没有这个文件
- **一个空白或者默认文件**——可能是服务器框架自动生成的

然后再试试 `/sitemap.xml`。结果多半也是 404 或空白。

这说明一个问题：搜索引擎的爬虫访问你的网站时，你什么都没告诉它。它只能靠自己猜你的网站结构，能爬到什么算什么，漏掉多少页面全凭运气。

这就是很多新手网站"上线了几个月，Google 只收录了首页"的根本原因。

## robots.txt：给爬虫画的"红线"

`robots.txt` 是一个纯文本文件，放在网站的根目录。它的作用只有一个——告诉搜索引擎爬虫，**哪些路径可以访问，哪些不行**。

### 最基本的格式

```
User-agent: *
Disallow: /admin/
Disallow: /private/
Sitemap: https://yoursite.com/sitemap.xml
```

三行就能说清楚一件事：所有爬虫（`*` 表示所有）不要去爬 `/admin/` 和 `/private/` 目录，同时告诉它我们的 sitemap 在哪。

### 每一行在说什么

**User-agent**：指定规则对哪个爬虫生效。`*` 是通配符，代表所有爬虫。如果你想给 Google 单独定规则，可以写 `User-agent: Googlebot`。

**Disallow**：禁止访问的路径。可以是目录（`/admin/`），也可以是具体文件（`/private/config.json`）。

**Allow**：在 Disallow 范围内的例外。比如你禁止了整个 `/uploads/` 目录，但想开放里面的 `/uploads/public/` 子目录，就可以用 Allow 放行。

**Sitemap**：告诉爬虫你的 sitemap 文件在哪。虽然不是所有爬虫都读这项（Google 就支持），但这个声明是官方的推荐做法。

### 常见场景举例

**1. 整个网站对所有人都开放**

```
User-agent: *
Disallow:
```

注意 Disallow 后面是空的，不是没有这行。空的 Disallow 等于"全都可以爬"。

**2. 只禁止部分管理路径**

```
User-agent: *
Disallow: /wp-admin/
Disallow: /login
Disallow: /api/
```

WordPress 站点经常这么写，防止后台管理页面被收录。API 接口也要禁止，它们不是给人看的页面。

**3. 完全禁止收录**

```
User-agent: *
Disallow: /
```

这个写法等于告诉所有爬虫：整个网站都别来。一般用在开发环境、测试站或者还没上线的网站上。

### 几个必须注意的点

**robots.txt 是建议，不是强制。** 遵守它的爬虫才是好爬虫。恶意的爬虫或者攻击者根本不会管这个文件。所以别把敏感信息——比如真实的密码文件路径——写在 robots.txt 里，它挡不住坏人，反而暴露了信息。

**文件大小有限制。** Google 只看 robots.txt 的前 500 KiB，超出部分忽略。

**一行一个规则。** 不支持用逗号分隔多个路径。

**缓存很严重。** 爬虫一般不会每次都重新请求 robots.txt，修改后可能要等几天才能生效。Google Search Console 可以手动刷新，算是唯一的补救手段。

## sitemap.xml：给爬虫的"地图"

如果说 robots.txt 是"别去这些地方"，那 sitemap.xml 就是"这些地方值得去"。

它是一个 XML 文件，列出了你网站上所有重要的页面，以及每个页面的**最后更新时间**、**更新频率**、**优先级**等元信息。

### 一个典型的 sitemap

```xml
<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://yoursite.com/</loc>
    <lastmod>2026-06-08</lastmod>
    <changefreq>daily</changefreq>
    <priority>1.0</priority>
  </url>
  <url>
    <loc>https://yoursite.com/about/</loc>
    <lastmod>2026-05-20</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.8</priority>
  </url>
  <url>
    <loc>https://yoursite.com/blog/hello-world/</loc>
    <lastmod>2026-06-01</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.6</priority>
  </url>
</urlset>
```

### 每个标签的含义

**`<loc>`**：必填。页面的完整 URL，必须是绝对地址（包含 `https://` 和域名）。

**`<lastmod>`**：可选。页面最后一次修改的日期。爬虫看到这个字段，可以用来判断页面需不需要重新抓取。格式用 W3C Datetime，常用的是 `YYYY-MM-DD`。

**`<changefreq>`**：可选。预估的更新频率，可选值包括 `always`、`hourly`、`daily`、`weekly`、`monthly`、`yearly`、`never`。

**`<priority>`**：可选。0.0 到 1.0 之间的数字，表示这个页面相对于站内其他页面的重要性。默认 0.5。注意这只是给爬虫的"建议"，它不一定听你的。

### 什么时候该用 sitemap

很多人的直觉是"网站做好了就生成 sitemap"，这话没错但有优先级。以下情况 sitemap 的收益最大：

- **网站是新上线的**——没有任何外链，爬虫不知道你的存在
- **页面很多（超过 500 个）**——靠爬虫自己逛完所有页面需要很久
- **网站结构很深**——页面嵌套超过 3 层，爬虫容易漏掉深层页面
- **有大量独立的页面**——比如电商产品页、新闻文章页，没有良好的站内导航链接
- **用了 JavaScript 渲染**——有些爬虫执行 JS 能力有限，sitemap 可以帮它们找到内容

如果你的网站总共只有五六个静态页面，而且都在导航栏里，那 sitemap 的作用不大——爬虫自己就能逛完。

### 大网站的 sitemap 策略

如果你的网站超过 50,000 个 URL，或者 sitemap 文件超过 50MB（未压缩），就必须拆分成多个 sitemap 文件，再用一个 **sitemap index** 汇总：

```xml
<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <sitemap>
    <loc>https://yoursite.com/sitemap-products.xml</loc>
    <lastmod>2026-06-08</lastmod>
  </sitemap>
  <sitemap>
    <loc>https://yoursite.com/sitemap-blog.xml</loc>
    <lastmod>2026-06-08</lastmod>
  </sitemap>
  <sitemap>
    <loc>https://yoursite.com/sitemap-other.xml</loc>
    <lastmod>2026-05-30</lastmod>
  </sitemap>
</sitemapindex>
```

### 如何生成 sitemap

手动写 sitemap 太傻了。大部分场景都有自动化的方案：

- **静态网站生成器（Hexo、Hugo、Jekyll）**——都有现成的 sitemap 插件，构建时自动生成
- **WordPress**——Yoast SEO、Rank Math 等插件自动管理
- **动态网站**——可以写一个路由定期生成 XML 文件，或者用 CDN 配合定时任务
- **SSR 框架（Next.js、Nuxt）**——都有 sitemap 模块或插件

原则只有一个：**永远不要手动维护 sitemap**。一旦你忘了更新，它比没有更糟糕——会给爬虫提供错误信息。

## 两个文件怎么配合

很多人把 robots.txt 和 sitemap.xml 当成两个独立的东西，其实它们是一起工作的。

完整的工作流是这样的：

1. 爬虫到达你的网站
2. 先读 `robots.txt`，确认哪些能爬、哪些不能
3. 从 robots.txt 里找到 sitemap 的链接（或者自己去搜 `sitemap.xml`）
4. 读取 sitemap，获取网站所有页面的列表和更新信息
5. 按优先级逐个发起抓取请求

也就是说，**robots.txt 决定了爬虫能不能找到你的 sitemap**。

常见的错误是把 sitemap 放在 `Disallow` 的路径里——比如你的 sitemap 在 `/private/sitemap.xml`，而 `robots.txt` 里写了 `Disallow: /private/`。那爬虫直接就绕过去了，sitemap 白做了。

## 容易踩坑的地方

**重定向问题。** 有些网站的 robots.txt 是通过服务器内部重定向访问的——比如 `http` 跳 `https`。但部分爬虫在第一次请求时不跟随重定向，可能拿到了空白内容。最好保证 robots.txt 在根目录是真实文件，不走重定向。

**Sitemap 里包含 noindex 的页面。** noindex 是在页面 HTML 的 meta 标签或者 HTTP 响应头里告诉爬虫"不要收录这个页面"。sitemap 里如果包含这些页面，爬虫会对比两个信号，最终遵守 noindex，但浪费了抓取配额。

**Sitemap 里放非文本页面。** 只放 HTML 页面。图片、PDF、视频可以上传到 Google Search Console 专门的媒体资源报告里，不需要堆在 sitemap 里稀释质量。

**robots.txt 用错了编码。** 必须用 UTF-8 编码。如果用 GBK 或其他编码，含有中文路径的规则会失效。

**忘记在 Google Search Console 提交 sitemap。** 光在 robots.txt 里声明 sitemap 是不够的。在 Google Search Console 里手动提交一次，可以加速初始收录。

## 总结

`robots.txt` 和 `sitemap.xml` 是网站 SEO 最基础的配置，但也是最容易被忽视的。

两个文件加在一起，也就几十行内容，花十分钟配置好，能让搜索引擎更高效地理解你的网站。对收录、索引、排名都有正向影响。

配置清单：

- ✅ robots.txt 放在根目录，用 UTF-8 编码
- ✅ robots.txt 里声明 Sitemap 路径
- ✅ 不要用 robots.txt 屏蔽 sitemap
- ✅ sitemap 只包含重要的、可索引的页面
- ✅ sitemap 确保自动更新，绝不手动维护
- ✅ 去 Google Search Console 提交 sitemap
- ✅ 如果网站大，拆成多个 sitemap 用 index 汇总

把这些做完，你的网站和搜索引擎之间就有了一个清晰的"沟通协议"。之后再去优化内容质量、页面速度、外链建设，才有意义。

没有这两个文件，后面的一切都是白搭。
