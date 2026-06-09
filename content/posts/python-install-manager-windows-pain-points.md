---
title: Python Install Manager 是什么？Windows 上装 Python 终于不用折腾了
date: 2026-06-09 14:00:00
categories:
  - Python
tags:
  - Python
  - Windows
  - PyManager
  - PEP773
  - 开发者工具
cover:
description: Python 官方推出了全新的 Windows Install Manager，解决多版本 Python 管理混乱的痛点。本文深入解析它的设计思路、解决了哪些历史遗留问题、以及如何上手使用。
---

## 引子

如果你在 Windows 上用过 Python，大概率经历过这些场景：

> 场景一：你想写个脚本，打开 cmd 敲 `python`，结果弹出一个微软商店窗口——嗯？Python 不是装了吗？

> 场景二：项目 A 用 Python 3.10，项目 B 用 3.12。你在硬盘上翻了半天，发现装了三个版本的 Python，但每次 `python` 出来的是哪个，完全看缘分。

> 场景三：你想卸载某个老版本，去「添加或删除程序」里找了一圈，看到三个叫「Python」的东西，也不敢乱删。

这些不是你的问题。这是 Python 在 Windows 上十几年积累下来的老账。

直到最近，Python 官方终于出手了。

---

## 故事要从头说起

### Windows 上装 Python 的「三座大山」

要理解 Python Install Manager 解决了什么，得先知道以前有多痛苦。

Python 在 Windows 上分发的方式，长期以来有三条路：

**第一条：传统的 .exe 安装器。**

你去 python.org 下载一个 `python-3.x.x-amd64.exe`，双击，一路 Next。装完能用，但仅此而已。

这个安装器是个一次性工具。它不像 Linux 上的 `apt`，也不像 macOS 上的 `brew`，装完之后它就消失了。你想装个新版本？再下一遍。想卸掉旧版本？去系统设置里找。想同时装 3.10 和 3.12 然后切换？——抱歉，你得靠 PATH 环境变量自己手撕。

**第二条：Windows Store 版本。**

微软商店里也有 Python。好处是会自动更新，但坏处也很明显——权限受限，文件系统隔离开，有些包装不上，有些脚本跑不了。重度用户基本绕道走。

**第三条：py launcher。**

微软和 Python 团队联合搞了一个叫 `py` 的工具，早期叫「Python Launcher」。它解决了「命令行里敲什么能调出 Python」的问题——你可以 `py -3.10` 调 3.10，`py -3.12` 调 3.12。但 `py` **只管选，不管装**。它只能在你已经装好的版本里切换，不能帮你装新版本。

换句话说，`py` 是个遥控器，但你还是得自己买菜、洗菜、做菜。

这三条路各管一摊，互不打通，Windows 上 Python 的版本管理一直处于一种「能用但不优雅」的状态。

---

## Python Install Manager：Python 官方终于想通了

2025 年 4 月，PEP 773 被正式接受。这份提案定义了一个全新的工具——**Python Install Manager**，也叫 **PyManager**。

它的代码仓库就在 GitHub 的 `python/pymanager`，是 CPython 官方项目的一部分。负责人是 Steve Dower——Python 社区里 Windows 分发的头号维护者，基本上 Windows 上 Python 怎么装、怎么跑，都是他在管。

这个工具的目标很简单：**把「装 Python」这件事变成一条命令。**

### 它长什么样？

你可以通过三种方式装上 PyManager：

1. **Microsoft Store** — 搜 "Python Install Manager"，点一下安装
2. **python.org 下载页** — 直接下载安装包
3. **WinGet** — `winget install 9NQ7512CXL7T`

装完之后，打开命令行，敲：

```
py help
```

你就会看到一组管理命令。这是以前的老 `py launcher` 做不到的——老版本里敲 `py help` 只会报错。

### 核心命令：装、卸、查、切

**装一个版本：**

```
py install 3.12
```

就这么简单。它会自动从 Python 官网下载并安装。不需要再去找下载链接、不需要跑安装向导、不需要勾选 "Add Python to PATH"。

**查已安装的版本：**

```
py list
```

输出示例：

```
Python 3.14 (64-bit)   [管理器管理]
Python 3.12 (64-bit)   [手动安装，不可管理]
Python 3.10 (64-bit)   [手动安装，不可管理]
```

已安装但用老方式装的版本会显示出来，只是不可管理。如果想让它们归 PyManager 管，卸了重装就行。

**查可安装的版本：**

```
py list --online
```

能看到从 Python 3.5 到最新版的完整列表，包括实验性的 free-threaded 构建和 embeddable distro。

**卸载：**

```
py uninstall 3.10
```

一行命令搞定，不用去控制面板里大海捞针了。

### 设置默认版本

PyManager 默认会用最新版。如果你想改，设一个环境变量：

```
set PYTHON_MANAGER_DEFAULT=3.12
```

之后敲 `py`，调出来的就是 3.12。

### 别忘了 pymanager 这个别名

`py` 这个命令在很多项目里可能有冲突（比如某些虚拟环境里自定义了 `py`）。为了避免这种麻烦，PyManager 提供了一个无歧义的别名：

```
pymanager install 3.12
```

功能和 `py` 完全一样，只是名字更明确。

---

## 它到底解决了什么痛点？

### 痛点一：多版本管理靠手

以前你在 Windows 上装 Python 3.8、3.10、3.12，得到的是三个独立的安装目录：

```
C:\Users\you\AppData\Local\Programs\Python\Python38
C:\Users\you\AppData\Local\Programs\Python\Python310
C:\Users\you\AppData\Local\Programs\Python\Python312
```

哪个版本被加到 PATH 里、哪个版本被 `python` 命令调用，全看你安装的顺序和勾选的选项。想换版本？手动改 PATH 环境变量。

PyManager 把这一切统一了。所有安装的版本都在它的管辖之下，用 `py install` 和 `py uninstall` 管理，不需要碰 PATH。

### 痛点二：py launcher 只能选不能装

老 `py` 基本上就是个「快捷方式管理器」。它知道你有 3.10 和 3.12，但它不知道怎么给你装一个 3.11。你得自己去 python.org 下载、手动安装，装完了 `py` 才能识别。

PyManager 把安装和选择合二为一。`py install 3.11` → `py -3.11` → 完事。

"Python Launcher" 变成了真正的 "Python Manager"。

### 痛点三：卸载版本靠猜

去 Windows 设置里看「添加或删除程序」：

```
Python 3.10.11 (64-bit)
Python 3.12.4 (64-bit)
Python Launcher
```

你敢随便点卸载吗？反正我不敢。卸载了 `Python Launcher` 会不会连带把所有版本的启动功能搞坏？删了 `3.10.11` 但 3.12 也在用同一个注册表项怎么办？

PyManager 解决了这个问题。你装的版本，它都能卸干净。

### 痛点四：新手上手门槛

对刚学 Python 的人来说，装 Python 本身就是第一道坎。Windows 上传统的安装器界面包含一堆复选框：

- [x] Install launcher for all users
- [ ] Add Python to PATH
- [ ] Precompile standard library
- [ ] Install debugging symbols
- [ ] Download debug binaries

初学者看到这些选项，大概率是「我该选什么？算了随便勾吧」。勾错了，后面出问题又不知道怎么排查。

PyManager 把体验简化成：
1. 装 PyManager（一键）
2. `py install 3.12`（一行命令）
3. `python` 就能跑了

不需要理解 PATH、不需要纠结选项。

### 痛点五：企业级的大规模部署

对团队和 CI/CD 来说，以前要写 PowerShell 脚本去下载 .exe、静默安装、配 PATH。每一步都可能因为版本号或者下载链接的变化而断掉。

有了 PyManager，自动化部署变成：

```powershell
winget install 9NQ7512CXL7T
py install 3.12
```

干净、可重复、不需要维护下载链接。

---

## 它不是什么？

说清楚了它做了什么，也得说说它**不**做什么。

PyManager **不是**包管理器。它只管理 Python 解释器本身，不管理 pip 安装的第三方包。装 Flask、装 Django、装 Pandas 还是用 `pip install`。

PyManager **不是**跨平台的。它目前只支持 Windows。macOS 和 Linux 上的 Python 管理有 pyenv、asdf、系统包管理器，它们各司其职。

PyManager **不是**虚拟环境管理器。`venv` 依旧是你创建虚拟环境的工具，PyManager 只是帮你选好基础解释器版本。

---

## 未来时间线

PEP 773 明确了一个里程碑：

- **传统 .exe 安装器和老 py launcher 将在 PEP 通过两年后停止发布**
- **Windows Store 上现有的 Python 应用将立即被 PyManager 替代**
- **embeddable distro 不再作为独立下载项列出，但可以通过 PyManager 安装**
- **PyManager 本身会持续更新，版本号采用「年份.序号」格式（比如 26.2）**

换句话说，如果你现在还在用老方式装 Python，**最多两年，你会被推着用 PyManager**。早用早适应。

---

## 一点题外话

PyManager 这个项目很有意思的地方在于：它不是社区自发的，而是 CPython 核心团队主动做的。

这说明 Python 官方开始正视「Python 安装体验」这个长期被忽视的问题。以前的态度是：我（CPython 团队）把代码写好，至于你怎么装上去，那是发行版维护者的事。Windows 上的体验一直都是「能跑就行」。

PyManager 的出现意味着官方开始做**最后一公里的交付体验**了。

套用 PEP 773 里的一句话：

> "Installation of the python.org Python distribution on Windows is complex."

翻译过来就是：**我们知道 Windows 上装 Python 一直很复杂。现在我们来修。**

---

## 总结

**Python Install Manager（PyManager）** 是一个由 CPython 官方开发的 Windows 工具，用于安装、管理、切换 Python 版本。

它解决的核心问题：

| 问题 | 以前 | 现在 |
| --- | --- | --- |
| 装新版本 | 去官网下载 .exe，手动安装 | `py install 3.12` |
| 查已装版本 | 翻「添加或删除程序」 | `py list` |
| 切换默认版本 | 改 PATH 环境变量 | 设 `PYTHON_MANAGER_DEFAULT` |
| 卸载版本 | 系统设置里找，不敢乱删 | `py uninstall 3.10` |
| 新手上手 | 理解不了一堆复选框 | 一行命令搞定 |
| 自动化部署 | 写复杂的脚本 | `winget install` + `py install` |

如果你在 Windows 上写 Python，无论你是刚入门的新手，还是被多版本环境折磨多年的老手，PyManager 都值得你下载试一下。它也许不会改变你写代码的方式，但至少能让「装 Python」这件事从碍事的步骤变成一个不假思索的 `py install`。
