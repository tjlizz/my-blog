---
title: Git 实用指南：从基础配置到多仓库协作
date: 2026-06-01 09:00:00
tags:
  - Git
  - GitHub
  - Gitee
  - SSH
  - 版本控制
  - 开发工具
categories:
  - 技术实践
excerpt: 从零开始配置 Git，生成 SSH 密钥连接 GitHub，同时推送到 GitHub 和 Gitee 双仓库，以及如何安全删除已提交记录但保留文件——这篇文章把常用的 Git 操作讲清楚。
description: 从零配置Git、SSH密钥连接、双仓库推送与历史记录安全管理，覆盖日常开发常用Git操作的完整指南。
---

Git 是每个开发者绕不开的工具，但很多人只会 `add`、`commit`、`push` 这三板斧，遇到稍微复杂一点的需求就手足无措。

这篇文章从实际使用出发，覆盖四个高频场景：

1. **基础配置**——第一次用 Git 该怎么设置
2. **SSH 密钥**——生成密钥并连接到 GitHub
3. **多远程仓库**——同时推送到 GitHub 和 Gitee
4. **撤销提交**——删除已提交到仓库的记录，但保留本地文件

![Git 工作流总览：配置、SSH、多仓库与历史清理](/images/git-essential-guide/git-workflow-overview.png)

> 从基础配置到 SSH 认证、多仓库同步和历史清理，Git 的核心能力都围绕“安全、可追踪、可协作”展开。

---

## 一、Git 基础配置

### 为什么要先配置

Git 的每一次提交都会记录作者信息（姓名 + 邮箱）。如果不配置，提交历史里要么是空白，要么是系统默认的奇怪字符串。这些信息会永久写入提交记录，同步到远程仓库，也会显示在 GitHub 的贡献图上。

### 全局配置（适用所有项目）

打开终端，执行以下两条命令：

```bash
git config --global user.name "你的名字"
git config --global user.email "你的邮箱@example.com"
```

`--global` 表示全局生效，配置写入 `~/.gitconfig` 文件。大多数情况下，用全局配置就够了。

### 项目级配置（仅当前仓库生效）

如果某个项目需要用不同的身份提交（比如公司项目用公司邮箱，个人项目用个人邮箱），进入项目目录后，去掉 `--global` 即可：

```bash
git config user.name "工作账号"
git config user.email "work@company.com"
```

项目级配置会写入当前仓库的 `.git/config` 文件，优先级高于全局配置。

### 查看当前配置

```bash
# 查看全局配置
git config --global --list

# 查看当前仓库配置（含全局继承）
git config --list
```

### 常用附加配置

```bash
# 设置默认分支名为 main（与 GitHub 保持一致）
git config --global init.defaultBranch main

# 设置默认编辑器为 VS Code
git config --global core.editor "code --wait"

# Windows 用户：解决中文路径乱码问题
git config --global core.quotepath false

# 配置换行符处理（Windows 推荐）
git config --global core.autocrlf true

# 配置换行符处理（macOS / Linux 推荐）
git config --global core.autocrlf input
```

---

## 二、生成 SSH 密钥并连接 GitHub

### SSH 和 HTTPS 的区别

连接 GitHub 有两种方式：

| 方式 | 地址格式 | 认证方式 | 特点 |
|------|----------|----------|------|
| HTTPS | `https://github.com/...` | 用户名 + Token | 简单，但每次可能需要输入凭证 |
| SSH | `git@github.com:...` | 密钥对 | 配置一次，永久免密推拉 |

SSH 配置稍微复杂一点，但用起来更顺手，推荐长期使用 Git 的开发者配置 SSH。

### 第一步：检查是否已有密钥

```bash
ls ~/.ssh
```

如果看到 `id_ed25519` 和 `id_ed25519.pub`（或者 `id_rsa` 和 `id_rsa.pub`），说明已经有密钥了，可以跳过生成步骤，直接去第三步添加公钥。

### 第二步：生成新密钥

推荐使用 `ed25519` 算法，比老式的 RSA 更安全，密钥也更短：

```bash
ssh-keygen -t ed25519 -C "你的邮箱@example.com"
```

执行后会提示：

```
Generating public/private ed25519 key pair.
Enter file in which to save the key (/Users/yourname/.ssh/id_ed25519):
```

直接回车使用默认路径。然后会提示设置密码短语（passphrase）：

```
Enter passphrase (empty for no passphrase):
```

可以直接回车跳过（不设密码），或者设置一个密码增加安全性。设置密码后每次使用密钥都需要输入，可以配合 `ssh-agent` 缓存密码避免重复输入。

生成完成后，`~/.ssh/` 目录下会有两个文件：

- `id_ed25519`：**私钥**，绝对不能泄露，不能上传到任何地方
- `id_ed25519.pub`：**公钥**，内容需要添加到 GitHub

### 第三步：将公钥添加到 GitHub

查看公钥内容：

```bash
cat ~/.ssh/id_ed25519.pub
```

复制输出的整段内容（以 `ssh-ed25519` 开头，以邮箱结尾）。

打开 GitHub：

1. 右上角头像 → **Settings**
2. 左侧菜单 → **SSH and GPG keys**
3. 点击 **New SSH key**
4. Title 填写一个描述，比如 "MacBook Pro" 或 "工作电脑"
5. Key type 保持 **Authentication Key**
6. Key 字段粘贴刚才复制的公钥内容
7. 点击 **Add SSH key**

### 第四步：验证连接

```bash
ssh -T git@github.com
```

首次连接会提示是否信任 GitHub 的主机指纹：

```
The authenticity of host 'github.com (20.27.177.113)' can't be established.
...
Are you sure you want to continue connecting (yes/no/[fingerprint])?
```

输入 `yes` 回车，如果看到以下输出，说明连接成功：

```
Hi yourname! You've successfully authenticated, but GitHub does not provide shell access.
```

### 启动 ssh-agent（可选，用于缓存密码）

如果生成密钥时设置了密码短语，可以用 `ssh-agent` 缓存，避免每次推拉都输入：

```bash
# 启动 ssh-agent
eval "$(ssh-agent -s)"

# 添加私钥到 agent
ssh-add ~/.ssh/id_ed25519
```

macOS 用户可以在 `~/.ssh/config` 里配置自动加载：

```
Host github.com
  AddKeysToAgent yes
  UseKeychain yes
  IdentityFile ~/.ssh/id_ed25519
```

---

## 三、同时推送到 GitHub 和 Gitee

国内有很多开发者同时维护 GitHub 和 Gitee 两个平台——GitHub 面向国际社区，Gitee 访问更稳定。每次手动推两次太麻烦，下面介绍两种一次推送双仓库的方案。

![通过 SSH 将一个本地 Git 仓库同步推送到两个远程仓库](/images/git-essential-guide/git-ssh-multi-remote.png)

> 本地仓库只需要维护一套提交历史，通过 SSH 密钥认证后，可以把同一次 `push` 同步到多个远程地址。

### 准备工作：在 Gitee 也添加 SSH 公钥

Gitee 的 SSH 配置方式与 GitHub 类似：

1. 登录 Gitee，点击右上角头像 → **设置**
2. 左侧 → **SSH 公钥**
3. 将同一个 `id_ed25519.pub` 的内容粘贴进去（GitHub 和 Gitee 可以共用同一个公钥）
4. 标题随意填写，确认添加

验证 Gitee 连接：

```bash
ssh -T git@gitee.com
```

看到 `Hi yourname! You've successfully authenticated` 说明连接成功。

### 方案一：为一个远程名配置多个推送地址（推荐）

这是最简洁的方案。`git push` 时，一次命令同时推到两个仓库。

**第一步：设置 origin 指向 GitHub**

```bash
git remote add origin git@github.com:yourname/your-repo.git
```

如果 `origin` 已存在，用 `set-url` 修改：

```bash
git remote set-url origin git@github.com:yourname/your-repo.git
```

**第二步：为 origin 添加 Gitee 作为额外推送地址**

```bash
git remote set-url --add origin git@gitee.com:yourname/your-repo.git
```

**第三步：验证配置**

```bash
git remote -v
```

输出如下，表示配置成功：

```
origin  git@github.com:yourname/your-repo.git (fetch)
origin  git@github.com:yourname/your-repo.git (push)
origin  git@gitee.com:yourname/your-repo.git (push)
```

注意：`fetch`（拉取）只从 GitHub 拉，`push`（推送）会推到两个地址。这个设计是合理的——同步两个仓库时，以 GitHub 为主源即可。

**第四步：正常推送**

```bash
git push origin main
```

Git 会依次推送到 GitHub 和 Gitee，两个仓库同时更新。

---

### 方案二：配置独立的远程名

如果需要分别控制推送到哪个仓库，可以给 GitHub 和 Gitee 设置不同的远程名：

```bash
# 添加 GitHub（命名为 github）
git remote add github git@github.com:yourname/your-repo.git

# 添加 Gitee（命名为 gitee）
git remote add gitee git@gitee.com:yourname/your-repo.git
```

查看配置：

```bash
git remote -v
```

推送时指定目标：

```bash
# 只推 GitHub
git push github main

# 只推 Gitee
git push gitee main

# 同时推两个
git push github main && git push gitee main
```

这种方案更灵活，适合两个仓库有时需要独立管理的场景。

---

## 四、删除已提交到仓库的记录，但保留文件

这是个很常见的需求：不小心把不该提交的文件（比如配置文件、密钥、大文件）推上去了，需要从提交历史里删除，但本地文件要保留。

### 场景一：只从 Git 追踪中移除，保留本地文件

如果文件已经被追踪（tracked），想让 Git 忘掉它，但本地文件保留不动：

```bash
# 移除单个文件
git rm --cached 文件名

# 移除整个目录
git rm --cached -r 目录名/

# 移除所有 .env 文件（通配符）
git rm --cached .env
```

`--cached` 的含义是：只从 Git 的暂存区和追踪列表中删除，不删除本地文件。

操作完成后，把文件加入 `.gitignore`，然后提交：

```bash
echo ".env" >> .gitignore
git add .gitignore
git commit -m "remove .env from tracking"
git push
```

> ⚠️ 注意：这只是从当前节点开始不再追踪。历史提交记录中依然存在这个文件。如果文件包含敏感信息（如密钥、密码），需要用下面的方法彻底清除历史。

---

### 场景二：彻底从所有历史记录中删除文件

如果需要从所有提交历史中完全抹掉某个文件（比如误提交了密钥），需要重写 Git 历史。

**方法：使用 `git filter-repo`**

`git filter-repo` 是目前官方推荐的历史重写工具，比已废弃的 `filter-branch` 更快更安全。

**安装：**

```bash
# macOS（Homebrew）
brew install git-filter-repo

# pip 安装（跨平台）
pip install git-filter-repo

# Windows（通过 pip）
pip install git-filter-repo
```

**从历史中删除指定文件：**

```bash
git filter-repo --path 要删除的文件名 --invert-paths
```

`--invert-paths` 表示反向匹配，即删除指定路径，保留其他所有文件。

**删除某个目录：**

```bash
git filter-repo --path 目录名/ --invert-paths
```

**删除多个文件：**

```bash
git filter-repo --path file1.txt --path secrets/config.json --invert-paths
```

**操作完成后，强制推送到远程：**

```bash
# 重新关联远程仓库（filter-repo 会移除 remote，需手动添加回来）
git remote add origin git@github.com:yourname/your-repo.git

# 强制推送所有分支
git push origin --force --all

# 强制推送所有 tag
git push origin --force --tags
```

> ⚠️ **强制推送会重写远程历史**，团队协作时必须通知所有成员重新克隆仓库，否则他们再次推送时会把旧历史带回来。

---

### 场景三：撤销最近一次提交，保留文件修改

如果只是最近一次提交提交错了，想撤回但保留文件改动：

```bash
git reset --soft HEAD~1
```

`--soft` 表示撤销提交，但保留改动在暂存区（staged）。文件内容不变，可以重新修改后再提交。

如果想连暂存区也清空（改动保留在工作区但未 staged）：

```bash
git reset HEAD~1
```

等同于 `git reset --mixed HEAD~1`（默认模式）。

> 如果已经推送到远程，撤销后需要强制推送：`git push --force`。同样需要注意团队协作的影响。

---

### 撤销操作对比

| 命令 | 提交记录 | 暂存区 | 工作区文件 | 适用场景 |
|------|----------|--------|------------|----------|
| `git rm --cached` | 保留（新增一次提交） | 移除追踪 | **保留** | 取消追踪但不删文件 |
| `git reset --soft HEAD~1` | 撤销最近提交 | 保留改动 | **保留** | 撤销提交但保留暂存 |
| `git reset HEAD~1` | 撤销最近提交 | 清空 | **保留** | 撤销提交，文件回到未暂存 |
| `git reset --hard HEAD~1` | 撤销最近提交 | 清空 | **丢失** | 彻底放弃改动（危险） |
| `git filter-repo` | 重写所有历史 | — | **保留** | 彻底清除敏感文件 |

---

## 总结

这篇文章覆盖了 Git 日常使用中最常见的几个场景：

- **基础配置**：`user.name` 和 `user.email` 是最基本的，项目级配置可以覆盖全局配置，适合多身份开发场景
- **SSH 连接**：`ed25519` 算法生成密钥，公钥添加到 GitHub，一次配置永久免密
- **多仓库推送**：用 `git remote set-url --add` 为 `origin` 添加第二个推送地址，一次 `push` 同步 GitHub 和 Gitee
- **删除提交记录**：用 `git rm --cached` 取消追踪文件；用 `git filter-repo` 彻底重写历史；用 `git reset --soft` 撤销最近提交但保留改动

Git 的强大之处在于它给了你完整的历史控制权——但权力越大，操作前越要谨慎，尤其是涉及强制推送和历史重写的操作，在团队中使用前一定要先沟通。
