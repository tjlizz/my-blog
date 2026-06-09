---
title: OpenClaw 从入门到落地：安装、配置、渠道接入与避坑指南
date: 2026-06-01 13:00:00
categories:
  - AI
tags:
  - OpenClaw
  - AI Agent
  - 自部署
  - 教程
cover:
description: AI Agent框架OpenClaw从安装部署到多渠道接入的完整实践指南，含配置详解与常见避坑要点。
---

## 为什么是 OpenClaw

市面上的 AI 助手产品很多，但大部分都是 SaaS——数据在别人手里，模型按调用收费，功能边界由厂商决定。

OpenClaw 走的是另一条路：自部署、多渠道、Agent 原生。你自己买服务器，自己配模型 API，自己决定用哪个模型、开哪些工具、连什么聊天软件。

它不是又一个 ChatGPT 网页版。它是一个**网关**——把你用的聊天软件（Telegram、Discord、Signal、飞书……）和一个 AI Agent 连起来，让你在口袋里随时有一个能写代码、能查资料、能操作服务器的 AI 助手。

这篇文章从零开始，把安装、配置、渠道对接、写 Agent 技能、实际使用场景和踩过的坑全串起来。

<!-- more -->

## 第一步：安装

### 环境要求

OpenClaw 需要 Node.js 24（推荐）或 Node.js 22.19+。装好 Node 后：

```bash
curl -fsSL https://openclaw.ai/install.sh | bash
```

Windows 用户用 PowerShell：

```powershell
iwr -useb https://openclaw.ai/install.ps1 | iex
```

安装完后运行 `openclaw --version` 确认成功。如果提示找不到命令，检查 Node 的全局 bin 目录是否在 PATH 里。

### 运行 onboarding

```bash
openclaw onboard --install-daemon
```

这一步是交互式的，它会问：
- 用哪个模型提供商（Anthropic / OpenAI / 自定义）
- 输入 API Key
- 是否开机自启

跑完后 Gateway 就已经在后台运行了。验证一下：

```bash
openclaw gateway status
```

看到 Gateway 在监听 18789 端口，就说明好了。

```bash
openclaw dashboard
```

浏览器打开控制面板，你就可以直接在 Web 上发消息了。

### 踩坑：安装脚本挂代理

如果你在国内服务器上安装，curl 脚本可能下载失败。解决办法是在安装前先配好环境变量：

```bash
export http_proxy=http://your-proxy:port
export https_proxy=http://your-proxy:port
curl -fsSL https://openclaw.ai/install.sh | bash
```

或者用 npm 手动安装（适合网络受限环境）：

```bash
npm install -g openclaw
```

### 踩坑：systemd daemon 注册失败

`--install-daemon` 会在 Linux 上注册 systemd user service。如果你的系统没有 systemd（比如 Docker 容器），会报错。这时候用 `openclaw start` 前台运行就行，或者自己在容器里配进程管理。

---

## 第二步：理解工作区

OpenClaw 的核心概念是**工作区（workspace）**，默认在 `~/.openclaw/workspace`。

这是 Agent 的家。它看到的文件、读的配置、存的记忆——全在这里。

```
~/.openclaw/workspace/
├── AGENTS.md       # Agent 的行为指南
├── SOUL.md         # 人格设定（语气、风格、边界）
├── USER.md         # 关于你本人的信息
├── TOOLS.md        # 工具相关的本地备注
├── MEMORY.md       # 长期记忆（重要事件、决策、偏好）
├── HEARTBEAT.md    # 心跳任务清单
├── BOOTSTRAP.md    # 首次启动脚本（用完后删除）
└── memory/         # 每日日志文件
    └── 2026-06-01.md
```

### AGENTS.md 和 SOUL.md 是灵魂

这两个文件决定了 Agent 的行为方式。

**AGENTS.md** 定义 Agent 的工作规则：怎么使用工具、什么情况下需要问你、安全红线是什么。

**SOUL.md** 定义 Agent 的性格：是正式还是随意，是话痨还是简洁，有没有幽默感。

我第一次用的时候没太在意这两个文件，结果 Agent 回消息特别"AI 味"——客套、冗长、每句话都带礼貌用语。后来把 SOUL.md 改成"别废话，直接回答"，世界清静了。

### 记忆系统

`MEMORY.md` 是长期记忆，Agent 每次启动都会读。`memory/` 下面按日期存日志文件。

实际用下来，记忆系统最大的价值是：
- 你不用反复告诉它你的偏好
- 跨会话上下文能保持
- 决策记录可回溯

但要注意——记忆不是无限的。写多了会被截断。建议只记真正重要的东西，不要事无巨细全往里塞。

### 踩坑：工作区文件权限

OpenClaw 用文件系统读写的，如果工作区权限不对，Agent 写文件会失败。特别是把工作区放在需要 sudo 的路径下。建议：

```bash
chmod -R 755 ~/.openclaw/workspace
```

确保运行 Gateway 的用户有完整权限。

---

## 第三步：配置渠道

这是 OpenClaw 最核心的能力——一个 Agent，对接多个聊天软件。

### Telegram（最简单）

在 @BotFather 创建一个机器人，拿到 token，然后配到 `~/.openclaw/openclaw.json`：

```json
{
  "channels": {
    "telegram": {
      "enabled": true,
      "botToken": "123456:ABC-DEF1234...",
      "dmPolicy": "pairing"
    }
  }
}
```

重启 Gateway，去 Telegram 给你的 bot 发消息，配对后就能用了。全程不到五分钟。

### Discord

创建 Discord 应用，拿到 bot token，开通 Message Content Intent：

```json
{
  "channels": {
    "discord": {
      "enabled": true,
      "botToken": "你的token",
      "dmPolicy": "pairing",
      "groupPolicy": "allowlist"
    }
  }
}
```

### 飞书（Feishu）

飞书接入稍微复杂一点，需要：
- 在飞书开放平台创建应用
- 配置事件订阅（接收消息）
- 获取 app_id 和 app_secret

配置好后，飞书上的消息就直接路由到 OpenClaw 的 Agent 了。

### 踩坑：配对码过期

默认 DM 策略是 `pairing`，未知发送者会收到一个配对码，一小时过期。如果你刚配好渠道、发消息没反应，检查一下配对码是不是过期了。可以把 `dmPolicy` 临时改成 `open` 调试，确认通了再切回 `pairing`。

### 踩坑：多渠道的会话隔离

OpenClaw 的会话是按渠道+用户隔离的。你在 Telegram 上说的话，Discord 上看不到。这是设计如此——但如果你想让不同渠道共享上下文，需要用 `/session` 命令手动绑定到同一个会话。

---

## 第四步：写技能（Skills）

Skills 是 OpenClaw 最强大的扩展机制。一个 Skill = 一个 `SKILL.md` + 脚本/工具。

### Skill 的结构

```
~/.openclaw/workspace/skills/my-skill/
├── SKILL.md     # 技能说明（何时触发、怎么用）
└── script.sh    # 可选：配套脚本
```

`SKILL.md` 的头部定义触发条件：

```markdown
---
name: my-website-deployer
description: 部署网站到服务器
trigger: 用户说要部署
---

# 我的部署技能

当用户说"部署"时，执行以下步骤：
1. 从 GitHub 拉取最新代码
2. 运行构建
3. 同步到服务器
```

### 内建 Skills

OpenClaw 自带很多实用的 skill：

- **weather** — 查天气
- **diagram-maker** — 画架构图/流程图
- **meme-maker** — 做表情包
- **notion** — 操作 Notion 页面
- **taskflow** — 管理多步骤任务

### 实际场景：我写的一个部署 Skill

```markdown
---
name: deploy-blog
description: 博客部署流程
---

当用户说"发布博客"或"部署博客"时：

1. 在 /root/blogs 下检查是否有新的 Markdown 文件
2. 执行 hexo generate
3. 执行 git add + commit + push
4. 返回部署结果
```

有了这个 skill，我说一句"发博客"，Agent 会自动跑完整个流程。省掉了打开终端、切换目录、敲命令的动作。

### 踩坑：Skill 匹配优先级

多个 skill 的 description 可能互相覆盖。比如一个 skill 说"用户请求帮助时触发"，另一个说"用户说帮忙时触发"，Agent 可能两个都匹配。

解决办法是：description 写得越具体越好。不要用模糊的触发描述，加上明确的场景限制。

### 踩坑：MCP 工具配置

如果你需要让 Agent 调用外部服务（如 GitHub、Jira、数据库），得配 MCP 服务器。配置在 `mcp.servers` 下。常见的坑是：
- 环境变量没传进去（用 `env` 字段显式传递）
- 端口冲突（检查本地服务端口）
- 工具名加上了 `mcp-` 前缀，对应的工具策略忘了开

---

## 第五步：实际应用场景

### 场景一：移动端 AI 编程助手

这是我用得最多的场景。在 Telegram 上给 Agent 发消息：

> "帮我检查线上服务器的 Nginx 配置，看看有没有明显的问题"

Agent 会用 SSH 连上服务器，读配置，分析问题，然后把结果发到我的手机。全程不用开电脑。

### 场景二：自动化运维

定时任务（cron） + Agent：

```bash
openclaw cron add \
  --schedule "0 9 * * 1" \
  --task "检查服务器磁盘和内存状态，如果有异常发给我"
```

每周一早上九点，Agent 自动检查服务器健康状态，有问题直接推送。

### 场景三：知识库问答

把团队文档放到工作区，Agent 就可以基于这些文档回答问题。不需要额外训练模型，不需要搭 RAG 流水线——文件放那里，Agent 自然会读。

### 场景四：多 Agent 协作

OpenClaw 支持 `sessions_spawn`——在一个任务里派生子 Agent 去做独立工作。比如：
- 主 Agent 负责和用户对话
- 子 Agent 去查资料、生成代码、执行测试
- 结果返回来汇总结论

这个架构适合复杂任务的并行处理，但目前对模型能力要求比较高。

### 踩坑：Agent 做复杂任务时的 Token 消耗

一个需要调用多个工具、来回几次对话才能完成的任务，Token 消耗比你想象的大。特别是用便宜模型的时候，问题可能不是钱，而是上下文窗口满了被截断。

解决方案：
- 复杂任务拆成子 Agent 做，主 Agent 只做调度
- 定期用 `/prune` 压缩会话
- 不要在一个会话里堆太多无关对话

---

## 第六步：安全措施

### 工具策略

默认情况下 Agent 是有 shell 执行权限的。如果你只需要对话功能，把工具集缩小：

```json
{
  "tools": {
    "profile": "minimal"
  }
}
```

`minimal` 只保留 `session_status`。`coding` 模式有文件读写、exec、网络访问。`full` 不做任何限制。

### 沙箱

对安全性要求高的场景，可以开启 sandbox：

```json
{
  "agents": {
    "defaults": {
      "sandbox": "non-main"
    }
  }
}
```

Sandbox 模式下 Agent 的文件操作被限制在一个隔离目录里，不会影响到宿主机。

### 踩坑：Agent 暴露在公网

Gateway 默认只监听 `127.0.0.1:18789`。如果你想让手机在外面也能访问控制台，不要直接把端口暴露出去。建议通过 Tailscale / WireGuard 组网，或者用反向代理加认证。

---

## 总结

OpenClaw 最大的价值不在于它"能做什么"，而在于它把选择权交给了你。

- 数据在你自己的服务器上
- 模型你可以随便换
- 渠道可以随意接
- 行为可以精确控制

坏处也很明显——自部署意味着你要自己维护、自己排错、自己操心安全。不像 SaaS 产品那样即开即用。

但从"用别人的工具"到"拥有自己的 Agent"，这一步跨过去之后的自由度，是 SaaS 给不了的。

如果你已经在自部署的路上了，OpenClaw 是目前把"多渠道 + Agent + 工具链"整合得最好的一套方案。
