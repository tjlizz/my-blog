---
title: "NVM 使用指南：那些年被 Node 版本支配的恐惧"
date: "2026-06-04"
categories:
  - 前端
tags:
  - NVM
  - Node.js
  - 开发工具
  - 前端工程化
cover: /images/nvm-node-version-manager-guide/nvm-node-version-manager-guide-hero.svg
description: NVM Node版本管理工具完整使用教程，解决多项目Node版本冲突，让新老项目各自运行在兼容环境中。
---
 
![NVM 在同一台电脑上管理多个 Node 版本，让老项目和新项目各跑各的环境](/images/nvm-node-version-manager-guide/nvm-node-version-manager-guide-hero.svg)


## NVM 到底是什么

NVM（Node Version Manager）就是 Node.js 的版本管理工具。

你把它理解成一个"Node 版本切换器"就行。装一个 nvm，你就可以在同一台电脑上装十几个不同版本的 Node，随时切，互不干扰。

```
nvm use 8    → node -v 变成 v8.x
nvm use 18   → node -v 变成 v18.x
nvm use 20   → node -v 变成 v20.x
```

每个版本的 npm 也是配套的，不用手动处理。

> 一个项目锁 Node 14，另一个项目要求 Node 20，这不是“谁更先进”的问题，而是工具链和依赖能不能正常工作的边界条件。

## 安装 NVM

### macOS / Linux

用官方脚本：

```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash
```

或者 wget：

```bash
wget -qO- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash
```

装完后重启终端，或者执行：

```bash
source ~/.bashrc   # Linux
source ~/.zshrc    # macOS（新版默认 zsh）
```

验证一下：

```bash
nvm --version
```

### Windows

Windows 用 `nvm-windows`，是另一个项目，但用法基本一致：

```bash
# 去 GitHub 下载安装包
# https://github.com/coreybutler/nvm-windows/releases
```

下载 `nvm-setup.exe`，一路下一步就行。

## 日常用法

### 装一个 Node 版本

```bash
nvm install 18
```

装完之后会自动切到这个版本。想装具体小版本也行：

```bash
nvm install 18.17.1
```

### 查看可用的版本

```bash
nvm ls-remote
```

会列出一大串，从 v0.x 到最新的全都有。

### 切换版本

```bash
nvm use 20
```

当前终端窗口就切到 Node 20 了。

### 设置默认版本

每次打开新终端都要手动切很烦？设一个默认的：

```bash
nvm alias default 20
```

以后新开终端自动用 Node 20。

### 查看已安装的版本

```bash
nvm ls
```

输出大概长这样：

```
->     v18.17.1
       v20.11.0
       v22.2.0
default -> 20 (-> v20.11.0)
```

箭头指着当前使用的版本。

### 卸载版本

```bash
nvm uninstall 8
```

## 比手动管理强在哪

### 场景一：同时维护多个项目

你电脑上有 5 个项目，分别用 Node 14、16、18、20、22。

没有 nvm 的时候，你要么用一个版本狂飙（然后用 `--ignore-engines` 自欺欺人），要么装虚拟机。

有 nvm 之后：

```bash
cd project-a
nvm use 14
npm start

cd ../project-b
nvm use 20
npm start
```

### 场景二：测试兼容性

你发布了一个 npm 包，想快速测试在 Node 14 到 22 下能不能跑：

```bash
for version in 14 16 18 20 22; do
  nvm use $version
  node test.js
done
```

一行循环跑完所有版本。

### 场景三：接手古董项目

那种 package.json 里写着 `"engines": { "node": ">=6 <9" }` 的项目——别笑，真的还有。

```bash
nvm install 8
nvm use 8
npm install   # 不会报 engine 警告
```

### 场景四：CI/CD 环境

本地开发用 Node 20，但 CI 用 Node 18 跑测试。你在本地也能切到 18 复现 CI 的问题。不用对着 CI 日志干瞪眼。

## 一些容易忽略的东西

### .nvmrc 文件

![项目根目录里的 .nvmrc，把“该用哪个 Node 版本”从口头约定变成可执行约束](/images/nvm-node-version-manager-guide/nvm-project-nvmrc-flow.svg)

在你的项目根目录创建一个 `.nvmrc`，写上版本号：

```
18.17.1
```

然后别人 clone 了你的项目，只要跑：

```bash
nvm use
```

nvm 会自动读取 `.nvmrc` 切到对应的版本。配合 `nvm install`（如果没装也会自动装），体验很好：

```bash
nvm install
```

这比在 README 里写"请使用 Node 18"靠谱一百倍。99% 的人不看 README。

### 和 shell 集成

装完 nvm 后，shell 配置文件里会出现一段脚本。这个脚本会在你每次开终端时加载 nvm。

如果你觉得每次开终端都慢一点，可以把 nvm 改成懒加载：

```bash
# 在 .zshrc 里：
alias nvm='unalias nvm && source "$NVM_DIR/nvm.sh" && nvm "$@"'
```

第一次执行 nvm 命令时才加载，不拖慢终端启动速度。

### 全局 npm 包的问题

每次切版本，你之前用 `npm install -g` 装的包就没了。因为每个 Node 版本有自己独立的全局目录。

```bash
nvm use 18
npm install -g yarn pnpm

nvm use 20
yarn  # command not found
```

有两个办法：

1. 每个版本都装一遍（反正也就是一条命令）
2. 用 `nvm reinstall-packages` 把某个版本的全局包迁移到当前版本

```bash
nvm install 20 --reinstall-packages-from=18
```

### npm 版本也跟着变

每个 Node 版本捆绑的 npm 版本不同。比如 Node 18 装 npm 9，Node 20 装 npm 10。

```bash
nvm use 18
npm --version  # 9.x

nvm use 20
npm --version  # 10.x
```

想升某个版本的 npm 也可以：

```bash
nvm use 18
nvm install-latest-npm
```

## 为什么不推荐用其他方案

| 方案 | 问题 |
| --- | --- |
| 手动下载安装包 | 切版本全靠手，容易搞乱 |
| 用 Docker 跑 Node | 为每个项目开容器太重了，本地开发实时重载体验差 |
| 直接装最新版 | 老项目跑不起来，只能 `--ignore-engines` 硬上 |
| fnm（Rust 版 nvm） | 速度确实快，但生态不如 nvm 成熟，遇到问题不好找答案 |

不是说别的方案不能用。但 nvm 是最稳的那个。社区最大，文档最全，踩坑的人都帮你踩完了。

## 我的日常工作流

新电脑到手后：

```bash
# 1. 装 nvm
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash

# 2. 装两个主力版本
nvm install 20
nvm install 18

# 3. 默认用 20
nvm alias default 20

# 4. 装一些全局工具
npm install -g pnpm pm2 typescript

# 5. 下次遇到特定版本的项目
git clone xxx
cd xxx
cat .nvmrc  # 看看项目要求的版本
nvm use     # 自动切
```

日常开发几乎感觉不到 nvm 的存在。只有切项目的时候打一句 `nvm use`，其他时候它就在那安静地干活。

## 总结

NVM 解决的痛点很具体：**不同项目需要不同 Node 版本，你不能让它们互相打架。**

核心命令就几个：

| 命令 | 作用 |
| --- | --- |
| `nvm install <version>` | 安装指定版本 |
| `nvm use <version>` | 切换版本 |
| `nvm ls` | 查看已安装版本 |
| `nvm alias default <version>` | 设置默认版本 |
| `nvm ls-remote` | 查看可安装版本 |
| `.nvmrc` + `nvm use` | 项目自动切版本 |

装一个 nvm，从此 Node 版本再也不是事儿。
