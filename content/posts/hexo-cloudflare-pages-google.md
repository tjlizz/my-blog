---
title: 用 Hexo 写博客，部署到 Cloudflare Pages，再推送给 Google
date: 2026-05-29 16:54:00
tags:
  - Hexo
  - Cloudflare Pages
  - Google Search Console
  - 博客搭建
  - SEO
categories:
  - 技术实践
excerpt: 从本地写 Markdown，到全球可访问的博客，再到 Google 能搜到你——这篇文章把整条链路讲清楚。
description: Hexo博客搭建、Cloudflare Pages免费部署、Google搜索引擎收录的零成本建站全链路实践。
---

很多人写博客，最后卡在"写完了放哪"这件事上。自己搭服务器太贵、GitHub Pages 国内访问慢、Vercel 部分地区被墙……有没有一个又免费、又快、又稳的方案？

有。**Hexo + Cloudflare Pages + Google Search Console**，这三个工具组合在一起，就是一套完整的个人博客解决方案。

这篇文章讲完整的链路：本地写文章 → 推到 GitHub → 自动构建部署到 Cloudflare Pages → 提交给 Google 收录。

![Hexo 博客从本地写作、Git 推送、Cloudflare Pages 部署到 Google 收录的完整链路](/images/hexo-cloudflare-pages-google/hexo-cloudflare-google-hero.png)

> 这套方案的关键，是把写作、构建、部署和收录拆成清晰的自动化链路。

---

## 技术背景

### 为什么选 Hexo

Hexo 是一个基于 Node.js 的静态博客框架。核心逻辑很简单：你写 Markdown 文件，Hexo 把它们渲染成 HTML。

它的优势是：

- **纯静态**：生成的是 HTML/CSS/JS 文件，不需要数据库，也不需要服务器运行时
- **主题生态丰富**：Fluid、NexT、Butterfly 等主题开箱即用，颜值不错
- **部署友好**：生成的静态文件可以直接扔到任何静态托管服务

缺点也很明显：不适合频繁更新的动态内容，评论功能需要依赖第三方服务（Disqus、Waline 等）。

### 为什么选 Cloudflare Pages

你可能熟悉 GitHub Pages，但 Cloudflare Pages 在它基础上有几个关键优势：

| 对比项 | GitHub Pages | Cloudflare Pages |
|--------|-------------|-----------------|
| 全球 CDN | 有限 | ✅ 覆盖全球 200+ 节点 |
| 国内访问 | 不稳定 | ✅ 相对稳定 |
| 自定义域名 | 支持 | ✅ 支持，且自动 HTTPS |
| 构建触发 | Push 触发 | ✅ Push 触发 |
| 免费额度 | 无限 | ✅ 每月 500 次构建免费 |
| 预览部署 | 不支持 | ✅ PR 自动生成预览 URL |

Cloudflare 本身就是全球最大的 CDN 服务商之一，用它托管静态博客，访问速度和稳定性都很有保障。

### 为什么要提交 Google Search Console

写完博客不代表 Google 能搜到。Google 的爬虫会自己发现网页，但这个过程可能要几周甚至更久。

Google Search Console（GSC）是 Google 提供的免费工具，核心功能有两个：

1. **验证你的网站所有权**：告诉 Google"这个域名是我的"
2. **主动提交 Sitemap**：让 Google 知道你网站的所有页面，加速收录

配合 Hexo 的 sitemap 插件，每次发布新文章后提交一次，通常一两天内就能在 Google 搜到。

---

## 解决方案

### 第一步：安装 Hexo，初始化博客

确保本地已安装 Node.js（建议 v18 以上），然后全局安装 Hexo：

```bash
npm install -g hexo-cli
```

初始化博客项目：

```bash
hexo init my-blog
cd my-blog
npm install
```

本地预览，确认能正常运行：

```bash
hexo server
# 浏览器打开 http://localhost:4000
```

### 第二步：安装主题（以 Fluid 为例）

```bash
npm install --save hexo-theme-fluid
```

在 `_config.yml` 中切换主题：

```yaml
theme: fluid
```

创建 `_config.fluid.yml`（主题专属配置，优先级更高），参考 [Fluid 官方文档](https://hexo.fluid-dev.com/docs/start/) 按需配置。

### 第三步：安装 Sitemap 插件（必须）

> **这一步不能跳过。** 没有 Sitemap，Google 不知道你网站有哪些页面，SEO 等于白做。

Hexo 默认不带 Sitemap，需要手动安装插件。安装后每次 `hexo generate` 都会自动生成 `/sitemap.xml`：

```bash
npm install hexo-generator-sitemap --save
```



同时把博客的 URL 改成你的真实域名（这影响 sitemap 里的链接是否正确）：

```yaml
url: https://your-domain.com
```

### 第四步：推送到 GitHub

在 GitHub 创建一个新的仓库（比如 `my-blog`），然后把本地项目推上去：

```bash
git init
git add .
git commit -m "init: hexo blog"
git remote add origin https://github.com/your-username/my-blog.git
git push -u origin main
```

> **注意**：把 `public/` 目录加入 `.gitignore`，不需要把生成物提交到仓库——Cloudflare Pages 会帮你在云端构建。

`.gitignore` 里添加：

```
public/
.deploy_git/
```

### 第五步：连接 Cloudflare Pages

1. 登录 [Cloudflare Dashboard](https://dash.cloudflare.com)，进入 **Workers & Pages**
2. 点击 **Create application** → **Pages** → **Connect to Git**
3. 授权连接你的 GitHub 账号，选择刚才的仓库
4. 配置构建参数：

   | 配置项 | 填写内容 |
   |--------|---------|
   | Framework preset | Hexo |
   | Build command | `hexo generate` |
   | Build output directory | `public` |

5. 点击 **Save and Deploy**，等待第一次构建完成

构建成功后，Cloudflare 会给你一个默认域名，格式类似 `my-blog-xxx.pages.dev`，可以直接访问。

![Cloudflare Pages 接收 Git 推送后自动构建 Hexo，并把静态文件发布到全球节点](/images/hexo-cloudflare-pages-google/cloudflare-pages-deploy.png)

> GitHub 负责存源码，Cloudflare Pages 负责构建和分发，`public/` 目录不需要手动提交。

### 第六步：绑定自定义域名（可选但推荐）

在 Pages 项目设置里，进入 **Custom domains** → 添加你的域名。

如果域名也托管在 Cloudflare，DNS 会自动配置；如果在其他平台（如阿里云、腾讯云），按提示添加 CNAME 记录即可：

```
类型: CNAME
名称: @（或 www）
目标: your-project.pages.dev
```

### 第七步：提交 Google Search Console

**7.1 验证网站所有权**

打开 [Google Search Console](https://search.google.com/search-console)，点击 **添加资源**。

推荐选择 **网址前缀** 方式，输入你的完整域名（如 `https://your-domain.com`）。

验证方式推荐 **HTML 标签**：

1. Google 会给你一段 meta 标签，类似：
   ```html
   <meta name="google-site-verification" content="xxxxxxxxxxxxxxxx" />
   ```
2. 在 Hexo 配置中加入这段 meta。如果用的是 Fluid 主题，在 `_config.fluid.yml` 里：

   ```yaml
   head:
     meta:
       - name: google-site-verification
         content: "xxxxxxxxxxxxxxxx"
   ```

3. 重新生成部署（push 到 GitHub，等 Cloudflare 自动构建），然后回到 GSC 点击验证。

**7.2 提交 Sitemap**

验证通过后，在 GSC 左侧菜单找到 **站点地图**，输入：

```
sitemap.xml
```

点击提交。Google 会开始抓取你的所有页面，通常 1-3 天内完成首次收录。

![通过 Google Search Console 提交 sitemap，让搜索引擎更快发现博客页面](/images/hexo-cloudflare-pages-google/google-search-console-indexing.png)

> Sitemap 的作用是把站点结构主动交给 Google，减少新文章“等爬虫偶遇”的时间。

---

## 后续工作流

搭好之后，日常写博客的流程就变得很简单：

```bash
# 新建一篇文章
hexo new post "我的新文章"

# 本地预览
hexo server

# 写完后推送到 GitHub
git add .
git commit -m "post: 我的新文章"
git push

# Cloudflare Pages 自动触发构建，几分钟后上线
```

每次推送新文章后，可以去 Google Search Console 的 **URL 检查** 工具，输入文章 URL 手动请求编入索引，加快收录速度。

---

## 常见问题



**Q：没装 Sitemap 插件，Google 还能收录我的文章吗？**  
A：能，但很慢。Google 没有 Sitemap 就只能靠自然抓取——新文章可能要等几周甚至不被发现。**强烈建议安装**，这是 SEO 最基础的配置。

**Q：Sitemap 里的链接是 `http://example.com/...`？**  
A：没有修改 `_config.yml` 里的 `url` 字段。把它改成你的真实域名并重新部署。

**Q：Google 很久没收录怎么办？**  
A：确认 sitemap 可以正常访问（`https://your-domain.com/sitemap.xml`），并在 GSC 的 URL 检查里手动提交几篇文章的链接。

 
---

## 总结

整条链路的核心是：**Hexo 生成静态文件 → Git 管理版本 → Cloudflare Pages 自动构建部署 → Google Search Console 加速收录**。

每个环节都选了成本最低（免费）、维护最少的方案。一次搭好，之后只需要专注写文章。

---
 
