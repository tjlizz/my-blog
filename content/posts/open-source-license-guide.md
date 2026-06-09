---
title: 开源协议怎么选？MIT、GPL、Apache 到底有什么区别
date: 2026-06-02 07:31:13
categories:
  - 开源
tags:
  - 开源协议
  - MIT
  - GPL
  - Apache
  - License
cover: /images/open-source-license-guide/open-source-license-guide-hero.png
description: 主流开源协议MIT、GPL、Apache、BSD的详细解读与选型指南，帮你在GitHub上正确选择License。
---

每次在 GitHub 上新建仓库，到了 "Choose a license" 那一步，很多人就卡住了。MIT、GPL、Apache、BSD…… 一堆名字摆在那，看着都差不多，选错了又怕出事。

其实没你想的那么复杂。开源协议的核心问题就两个：

1. **别人能拿你的代码卖钱吗？**
2. **别人改完代码，需不需要把改动也公开？**

搞懂这两个问题，选协议就跟点菜一样简单。

![开源协议选型头图：MIT、Apache、GPL、LGPL、AGPL、MPL 的分叉选择](/images/open-source-license-guide/open-source-license-guide-hero.png)

## MIT — 最简单的选择，没有之一

MIT 协议短到什么程度？原文就二十来行，核心意思一句话：**爱怎么用怎么用，出事别找我，署个名就行**。

你想抄、想改、想塞进闭源商业软件卖钱——都可以。唯一的要求就是保留原作者的版权声明。

所以大厂最爱 MIT。React 是 MIT、jQuery 是 MIT、Node.js 早期也是 MIT。无拘无束，不用请律师审条款。

**适合谁**：想让代码传播得最广、不想管别人怎么用、追求省事。大部分人选 MIT 都不会错。

**代价是什么**：你写了个爆款库，Facebook 拿去塞进 React Native 闭源卖钱，你一分拿不到，也说不了什么。MIT 就是这样——给了别人最大的自由。

## BSD — 和 MIT 差不多，多了个防碰瓷条款

BSD 有两个版本：

- **BSD 2-Clause**：跟 MIT 几乎一样，随便用，署名就行
- **BSD 3-Clause**：多了一条 "别拿我的名字给你的产品打广告"

3-Clause 那条很有用。有人拿你的代码做了个产品，满世界宣传 "基于 XXX 核心技术"，结果出 bug 了用户跑来骂你——有了这条，你可以理直气壮说关我屁事。

Go 语言用的 BSD、Nginx 用的 BSD、Redis 用的也是 BSD。

## Apache 2.0 — MIT 的升级版，大厂最爱

Apache 2.0 跟 MIT 一样宽松——可以闭源商用、可以随便改——但它多了两个 MIT 没有的东西：

**专利授权**：你用 MIT 协议的代码，理论上贡献者哪天不高兴了可以告你专利侵权。Apache 2.0 明确说 "我不会告你"，这对公司来说太重要了。

**修改声明**：你改了我的代码，不能假装就是你写的。得告诉别人你改了什么。

Google 的 Android、Kubernetes、Spring 全家桶、Hadoop 全线都是 Apache 2.0。大厂选它不是因为更严格，而是因为专利条款让法务部睡得着觉。

## GPL — Copyleft 的灵魂

Richard Stallman 当年写 GPL 的时候想法很简单：**你用我的代码，你的代码也得开源**。

这个叫 Copyleft。不是说你不能商用——你可以卖钱，但你卖的时候必须把源码一起给客户，客户拿到源码后也可以继续传播。

关键是**传染性**。你写了段 GPL 代码，别人在你的代码基础上做了个新软件，那新软件也得 GPL。不管你是直接复制还是链接引用——沾上了就甩不掉。

Linux 内核是 GPL v2，Git 也是 GPL v2，WordPress 也是。为什么这些项目选 GPL？因为它们不想被闭源分叉吃掉。你今天 fork 了 Linux 加了一堆闭源特性卖钱？不行，你得开源。

**GPL v2 vs v3**：v2 短小精悍，Linux 内核一直用 v2。v3 加了专利保护和一个叫 "反 Tivoization" 的东西——有些厂商虽然开源了代码，但用硬件签名锁死，你改了代码也跑不了。v3 把这条路也堵了。但 v3 更复杂，很多人不太愿意碰。

**⚠️ 实话说**：GPL 在商业世界口碑不太好。很多公司法务听到 GPL 就头大，合规审查极其麻烦。你选 GPL 基本等于告诉大公司 "别用我的代码"。

## LGPL — 专门给库准备的

GPL 的传染性有个问题：如果我用的是 C 语言的 glibc，只要链接了它我的软件就得 GPL？那所有 Linux 软件都得开源了。

所以 GNU 搞了个 LGPL（Lesser GPL），规则变成：你的程序**动态链接**这个库，不需要开源。但如果**修改了库本身**，修改部分必须开源。

Glibc 是 LGPL、FFmpeg 有 LGPL 版本、Qt 早期也是 LGPL。

**适合谁**：你写了个底层库，希望大家都来用（包括闭源项目），但不想库本身被人改了不还回来。

## AGPL — 你跑在服务器上也得开源

传统 GPL 有个巨大的漏洞：**我搭了个网站用你的 GPL 代码，用户只是通过浏览器访问，算不算 "分发" 软件？不算。那我的修改就不用公开。**

AGPL 直接把这条补死了。只要有人通过网络使用你的服务，你就得提供源码。

MongoDB 早期用的就是 AGPL（后来改成了更严格的 SSPL），Nextcloud 也用 AGPL。做 SaaS 的朋友对这个协议最有感触——你辛辛苦苦写了个服务，别人拿去改改就部署上线赚钱，还不用开源——AGPL 就是防这个的。

当然，AGPL 比 GPL 还让公司害怕。很多开源项目的 README 里直接写 "We're AGPL，commercial license available"，意思很明白：不想开源就付钱。

## MPL — 折中方案

MPL（Mozilla Public License）想解决一个问题：GPL 太激进，MIT 太松，有没有中间选项？

答案是有。MPL 是**文件级别的传染**。你改了 `foo.js`，那这个 `foo.js` 必须保持 MPL 开源。但项目的其他文件可以闭源。

Firefox 就是用 MPL 的。

**适合谁**：你想要一定的保护，但项目里有部分私有代码不想公开。MPL 给你划了一条清晰的线。

![开源协议宽松度与传染性对比：从 MIT、BSD、Apache 到 MPL、LGPL、GPL 和 AGPL](/images/open-source-license-guide/open-source-license-spectrum.png)

## 实战选择指南

现在回过头来看，选协议其实就是选项目的性格：

![开源协议决策图：传播优先选 MIT，专利安全选 Apache，衍生开源选 GPL/LGPL，SaaS 保护选 AGPL，MPL 作为折中路线](/images/open-source-license-guide/open-source-license-decision-tree.png)

你的项目是个**工具库**，希望被全世界引用 —— MIT 或 Apache 2.0。不用想太多，选这俩永远不会错。

你在**大厂工作**，或者项目可能被大厂用 —— Apache 2.0。专利条款能免去跟法务部扯皮的麻烦。

你**不想被闭源白嫖** —— GPL。代价是商业公司大概率绕着你走。

你做了个**SaaS 产品**，怕别人抄 —— AGPL。但也别指望它被广泛采用。

你写了**底层基础设施**，希望生态繁荣 —— LGPL 或 MIT。

你想要**中间路线**，部分开源部分闭源 —— MPL。

## 几个容易踩的坑

**没有协议 = 没有授权**。GitHub 上很多项目不放 License 文件，这不等于 "大家都来用"——法律上恰恰相反，默认保留所有权利，别人什么都不能做。

**协议不兼容是个大问题**。GPL v2 和 Apache 2.0 就互不兼容——专利条款有冲突。你混用了这两个协议的代码，基本算违规。选之前去 choosealicense.com 查一下兼容性。

**别自己写协议**。网上有人喜欢自己写个 "XX 开源协议"，看着很酷，但法律上没人认。OSI 批准的协议很多年了，经历了大量判例检验，选现成的比什么都强。

**双许可很常见**。MySQL 就是 GPL + 商业许可两条路。你个人用、开源项目用，走 GPL 免费。公司想闭源集成，付钱买商业许可。Qt、MongoDB 都这么玩。

## 总结

开源协议没有最好，只有最合适。搞清楚你到底在意什么——是传播广度、商业友好、还是衍生作品必须开源——答案自然就有了。

如果真的拿不准，选 MIT。大多数时候够用了。
