# Blog System

一个使用 Node.js 实现的轻量级静态博客生成系统。它读取 `content/posts` 下的 Markdown 文件，解析 Front Matter，生成首页、文章页、标签页、分类页、搜索页和 `search-index.json`，最终输出到 `dist` 目录。

## 安装

```bash
npm install
```

## 站点配置

根目录的 `blog.config.json` 用于配置站点 SEO 和统计信息：

```json
{
  "title": "My Blog",
  "description": "一个简洁、清晰、适合阅读技术文章的内容站。",
  "siteUrl": "https://example.com",
  "author": "Blog Author",
  "language": "zh-CN",
  "googleAnalyticsId": "G-XXXXXXXXXX",
  "defaultImage": "/images/site-cover.png"
}
```

- `title`：博客名称，会用于导航、页面标题和结构化数据
- `description`：站点描述，会用于首页 meta description
- `siteUrl`：站点域名，用于生成绝对 canonical、`sitemap.xml` 和 `robots.txt`
- `author`：文章结构化数据中的作者
- `language`：HTML `lang` 属性
- `googleAnalyticsId`：Google Analytics 统计 ID，留空则不输出统计脚本
- `defaultImage`：默认分享图，可留空

## 本地预览

```bash
npm run dev
```

默认访问：

```txt
http://localhost:3000
```

开发服务会监听 `content`、`themes`、`public`、`src` 目录变化并自动重新构建。

## 构建

```bash
npm run build
```

构建结果会输出到：

```txt
dist/
```

`dist` 可以直接部署到 Nginx、Cloudflare Pages、GitHub Pages 或任何静态托管平台。

## 写文章

在 `content/posts` 下创建 Markdown 文件，文件名会作为文章 slug，例如：

```txt
content/posts/ai-assisted-development.md
```

会生成：

```txt
dist/posts/ai-assisted-development/index.html
```

Markdown 顶部需要包含 Front Matter：

```md
---
title: AI 辅助开发提效：正确姿势是让它当助手，而不是主角
date: 2026-05-29 15:46:00
tags:
  - AI
  - 开发效率
  - Git
  - 工程实践
categories:
  - 技术思考
excerpt: AI 不是来取代开发者的，它只是一个极其高效的"代码民工"。
description: 探讨AI辅助开发的正确姿势。
---

这里是正文内容
```

必要字段是 `title` 和 `date`。如果缺少必要字段，构建时会输出友好的错误提示。

## 文章图片

图片支持三种放法：

```txt
content/images/demo/a.png
content/posts/images/demo/a.png
content/posts/article-slug/images/a.png
```

前两种会复制到 `dist/images`，文章中可以这样引用：

```md
![示例图片](/images/demo/a.png)
```

第三种会复制到对应文章目录下，适合只属于单篇文章的图片：

```md
![示例图片](images/a.png)
```

## 支持字段

- `title`：文章标题
- `date`：发布时间，按时间倒序排序
- `tags`：标签数组
- `categories`：分类数组
- `excerpt`：首页和搜索结果摘要
- `description`：SEO 描述
- `cover`：文章分享图，例如 `/images/post-cover.png`

## 路由

构建后会生成类似路径：

```txt
dist/index.html
dist/posts/article-slug/index.html
dist/tags/AI/index.html
dist/categories/技术思考/index.html
dist/search/index.html
dist/search-index.json
dist/sitemap.xml
dist/robots.txt
```

中文标签和中文分类会保留为目录名，同时页面中的链接会自动进行 URL 编码。

## 静态搜索

构建时会生成 `dist/search-index.json`，包含文章标题、摘要、正文纯文本、标签、分类和 URL。搜索页使用纯前端 JavaScript 在本地完成搜索，不依赖后端接口。

## 主题扩展

默认主题位于：

```txt
themes/github/
```

包含：

```txt
layout.html
index.html
post.html
search.html
style.css
```

后续可以扩展 `src/renderer.js`，让主题目录变成可配置项。

## 部署

### Nginx

将 `dist` 目录配置为站点根目录即可。

### Cloudflare Pages

构建命令：

```bash
npm run build
```

输出目录：

```txt
dist
```

### GitHub Pages

运行 `npm run build` 后，将 `dist` 发布到 Pages 对应分支或使用 GitHub Actions 自动部署。
