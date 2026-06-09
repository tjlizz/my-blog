---
title: 用 WinSW 把 JAR 包注册成 Windows 服务
date: 2026-06-01 09:30:00
tags:
  - WinSW
  - Windows
  - Java
  - Spring Boot
  - 服务部署
  - 运维
categories:
  - 技术实践
excerpt: 在 Windows 服务器上跑 Spring Boot 应用，最省事的方案就是把它注册成系统服务。开机自启、崩溃重启、日志管理，全都有。这篇文章把 WinSW 的完整用法讲清楚。
description: 使用WinSW将Spring Boot JAR包注册为Windows系统服务实战，实现开机自启、崩溃重启与统一日志管理。
---

在 Windows 服务器上部署 Java 应用，很多人的做法是写一个 `.bat` 脚本，然后让运维手动双击运行。这种方式有几个明显的问题：

- 服务器重启后需要手动再次启动
- 没有守护进程，程序崩溃后不会自动恢复
- 日志管理混乱，输出全靠 `System.out.println`
- 需要保持一个命令行窗口常驻

**WinSW**（Windows Service Wrapper）解决的就是这些问题。它让任何可执行程序都能注册成 Windows 服务，自带开机自启、崩溃重启、日志滚动等能力，而且完全开源免费。

![WinSW 将 JAR 包包装成 Windows 服务，支持开机自启、异常重启和日志滚动](/images/winsw-jar-windows-service/winsw-jar-windows-service-cover.png)

> WinSW 的核心思路是：由 Windows 服务管理器托管 `winsw.exe`，再由 WinSW 启动并守护你的 `javaw -jar app.jar` 应用。

---

## 技术背景

### Windows 服务是什么

Windows 服务（Windows Service）是一种在后台长期运行的进程，由系统服务管理器（SCM）统一管理。它的特点：

- **开机自动启动**，无需用户登录
- **独立于用户会话**，不依赖任何登录的用户
- **可配置故障恢复**，崩溃后自动重启
- **统一管理入口**：任务管理器、`services.msc`、`sc` 命令都可以控制

### WinSW 做了什么

WinSW 本质上是一个"包装器"。它把你的程序（比如 `java -jar app.jar`）包装成一个 Windows 服务进程，让 SCM 可以像管理系统服务一样管理你的应用。

整个结构很简单：

```
WinSW.exe（服务宿主进程）
  └─ 启动并管理 ─→ java -jar your-app.jar
```

WinSW 负责与 Windows SCM 通信，你的 JAR 负责跑业务。

### `java` 和 `javaw` 的区别

启动 JAR 时可以选择 `java` 或 `javaw`，两者的核心区别是：

| | `java` | `javaw` |
|--|--------|---------|
| 控制台窗口 | **会弹出**黑色命令行窗口 | **不弹出**窗口，静默运行 |
| 标准输出 | 输出到控制台 | 无控制台，输出由 WinSW 捕获写入日志 |
| 适用场景 | 调试、命令行工具 | **Windows 服务、GUI 程序（推荐）** |

在 WinSW 管理的 Windows 服务里，程序运行在系统后台，根本不需要控制台窗口。用 `javaw` 既干净又符合服务程序的运行方式，所有输出都由 WinSW 接管并写入 `.out.log` / `.err.log` 文件。

> `javaw` 在 JDK 的 `bin` 目录下，与 `java.exe` 并列，路径相同，只是换个文件名。

---

## 准备工作

### 环境要求

- Windows Server 2012 R2 及以上，或 Windows 10/11
- .NET Framework 4.6.1 及以上（大多数 Windows 已内置）
- JDK 已安装并配置好 `JAVA_HOME`（或直接用完整路径）

### 下载 WinSW

WinSW 发布在 GitHub：[https://github.com/winsw/winsw/releases](https://github.com/winsw/winsw/releases)

下载页面有多个版本，按需选择：

| 文件名 | 适用场景 |
|--------|----------|
| `WinSW-x64.exe` | 64 位系统（主流选择）|
| `WinSW-x86.exe` | 32 位系统 |
| `WinSW-arm64.exe` | ARM 架构系统 |

下载后得到一个单独的 `.exe` 文件，无需安装，拷贝到目标目录即可使用。

---

## 目录结构规划

建议把每个服务独立放在一个目录下，结构清晰，便于维护：

```
D:\services\
└─ my-app\
   ├─ my-app.exe         ← WinSW 可执行文件（改名与 XML 同名）
   ├─ my-app.xml         ← WinSW 配置文件（与 exe 同名）
   ├─ my-app.jar         ← 你的 Spring Boot JAR
   └─ logs\              ← 日志目录（WinSW 自动创建）
```

> **命名规则很重要**：WinSW 的 `.exe` 和 `.xml` 文件必须同名（不含扩展名），WinSW 会自动查找同目录下同名的 XML 配置文件。

实际操作：把下载的 `WinSW-x64.exe` 重命名为 `my-app.exe`，然后在同目录下创建 `my-app.xml`。

---

## 编写配置文件

`my-app.xml` 是整个部署的核心，它告诉 WinSW 如何启动你的程序。

### 基础配置（最小可运行版本）

```xml
<?xml version="1.0" encoding="UTF-8"?>
<service>
  <!-- 服务 ID，必须唯一，不能包含空格 -->
  <id>my-app</id>

  <!-- 服务在 services.msc 中显示的名称 -->
  <name>My App Service</name>

  <!-- 服务描述，可选 -->
  <description>My Spring Boot Application</description>

  <!-- 可执行文件：javaw 不弹出控制台窗口，适合 Windows 服务场景 -->
  <executable>javaw</executable>

  <!-- 启动参数：完整的 JVM 启动命令（不含 javaw 本身） -->
  <arguments>-jar "D:\services\my-app\my-app.jar"</arguments>

  <!-- 服务启动类型：Automatic（自动）/ Manual（手动）/ Disabled（禁用） -->
  <startmode>Automatic</startmode>
</service>
```

这个配置已经可以运行。下面是生产环境推荐的完整配置：

### 完整配置（生产推荐）

```xml
<?xml version="1.0" encoding="UTF-8"?>
<service>

  <!-- ==================== 基础信息 ==================== -->
  <id>my-app</id>
  <name>My App Service</name>
  <description>My Spring Boot Application - Production</description>

  <!-- ==================== 启动命令 ==================== -->
  <!-- 使用 javaw 而非 java，避免弹出控制台窗口 -->
  <executable>javaw</executable>
  <arguments>
    -server
    -Xms512m
    -Xmx1024m
    -XX:+UseG1GC
    -Dfile.encoding=UTF-8
    -Dspring.profiles.active=prod
    -jar "D:\services\my-app\my-app.jar"
    --server.port=8080
  </arguments>

  <!-- 工作目录：JAR 运行时的当前目录，影响相对路径解析 -->
  <workingdirectory>D:\services\my-app</workingdirectory>

  <!-- ==================== 环境变量 ==================== -->
  <env name="JAVA_HOME" value="C:\Program Files\Java\jdk-17"/>
  <env name="APP_ENV" value="production"/>

  <!-- ==================== 启动类型 ==================== -->
  <startmode>Automatic</startmode>

  <!-- 延迟启动：系统启动后等一会再启动服务，避免依赖服务未就绪 -->
  <!-- <delayedAutoStart>true</delayedAutoStart> -->

  <!-- ==================== 故障恢复 ==================== -->
  <onfailure action="restart" delay="10 sec"/>
  <onfailure action="restart" delay="20 sec"/>
  <onfailure action="restart" delay="30 sec"/>
  <resetfailure>1 hour</resetfailure>

  <!-- ==================== 日志管理 ==================== -->
  <logpath>D:\services\my-app\logs</logpath>
  <log mode="roll-by-size-time">
    <!-- 日志文件大小上限，超过后滚动 -->
    <sizeThreshold>10240</sizeThreshold>
    <!-- 时间滚动模式：每天一个新文件 -->
    <pattern>yyyyMMdd</pattern>
    <!-- 保留最近 30 天的日志 -->
    <autoRollAtTime>00:00:00</autoRollAtTime>
    <zipOlderThanNumDays>3</zipOlderThanNumDays>
    <enablePIDFile>false</enablePIDFile>
  </log>

  <!-- ==================== 停止超时 ==================== -->
  <!-- 发送停止信号后等待多久强制终止 -->
  <stoptimeout>30 sec</stoptimeout>

  <!-- ==================== 依赖服务 ==================== -->
  <!-- 如果你的应用依赖数据库服务，可以在这里声明 -->
  <!-- <depend>MySQL</depend> -->

</service>
```

### 配置项详解

**`<executable>` 和 `<arguments>`**

`executable` 填可执行程序的路径（或环境变量中存在的命令名，如 `java`）。如果系统 `PATH` 里没有 `java`，需要写完整路径：

```xml
<executable>C:\Program Files\Java\jdk-17\bin\java.exe</executable>
```

`arguments` 里的参数换行写更清晰，WinSW 会自动拼接。

**`<onfailure>` 故障恢复**

三条 `onfailure` 对应三次故障后的动作，按顺序触发：第一次崩溃 10 秒后重启，第二次 20 秒后重启，第三次 30 秒后重启。`resetfailure` 表示 1 小时内没有崩溃则重置计数器。

**`<log mode>`** 支持四种模式：

| 模式 | 说明 |
|------|------|
| `append` | 追加到同一文件（默认） |
| `reset` | 每次启动时清空日志 |
| `roll` | 按大小滚动 |
| `roll-by-size-time` | 按大小和时间双重滚动（推荐生产使用） |

---

## 注册和管理服务

所有操作都需要以**管理员权限**打开命令提示符（CMD）或 PowerShell。

### 注册服务

```cmd
cd D:\services\my-app
my-app.exe install
```

成功后会看到：

```
2026-06-01 09:00:00,000 INFO  - Installing service 'My App Service (my-app)'...
2026-06-01 09:00:00,100 INFO  - Service 'My App Service (my-app)' was installed successfully.
```

### 启动服务

```cmd
my-app.exe start
```

或者用系统命令：

```cmd
net start my-app
sc start my-app
```

### 停止服务

```cmd
my-app.exe stop
```

或者：

```cmd
net stop my-app
sc stop my-app
```

### 重启服务

```cmd
my-app.exe restart
```

### 查看服务状态

```cmd
my-app.exe status
```

输出示例：

```
Started
```

或者通过 SC 查看详情：

```cmd
sc query my-app
```

### 卸载服务

先停止服务，再卸载：

```cmd
my-app.exe stop
my-app.exe uninstall
```

### 图形界面管理

按 `Win + R` 输入 `services.msc`，打开服务管理器，找到 "My App Service"，可以直接右键启动/停止/重启，也可以修改启动类型。

---

## 日志说明

WinSW 运行后会在 `<logpath>` 目录下生成三类日志文件：

```
logs\
├─ my-app.out.log    ← 程序标准输出（System.out.println）
├─ my-app.err.log    ← 程序错误输出（System.err / 异常堆栈）
└─ my-app.wrapper.log ← WinSW 自身的运行日志（启动/停止记录）
```

排查问题时，先看 `wrapper.log` 确认服务是否正常启动，再看 `err.log` 查应用异常。

Spring Boot 应用通常自带日志框架（Logback/Log4j2），建议在 `application.yml` 里也配置日志文件路径，两套日志各司其职：

- **WinSW 日志**：记录服务生命周期事件（启动/停止/崩溃/重启）
- **应用日志**：记录业务逻辑和异常

---

## 实战示例：部署 Spring Boot 应用

假设有一个打包好的 `user-service-1.0.0.jar`，需要部署到 `D:\services\user-service\`。

### 第一步：创建目录并放置文件

```
D:\services\user-service\
├─ user-service.exe    ← 重命名后的 WinSW
├─ user-service.xml    ← 下面要写的配置文件
└─ user-service-1.0.0.jar
```

### 第二步：编写配置文件

```xml
<?xml version="1.0" encoding="UTF-8"?>
<service>
  <id>user-service</id>
  <name>用户服务</name>
  <description>用户管理微服务，端口 8081</description>

  <executable>javaw</executable>
  <arguments>
    -Xms256m
    -Xmx512m
    -Dfile.encoding=UTF-8
    -Dspring.profiles.active=prod
    -jar "D:\services\user-service\user-service-1.0.0.jar"
    --server.port=8081
  </arguments>

  <workingdirectory>D:\services\user-service</workingdirectory>

  <startmode>Automatic</startmode>
  <delayedAutoStart>true</delayedAutoStart>

  <onfailure action="restart" delay="10 sec"/>
  <onfailure action="restart" delay="30 sec"/>
  <resetfailure>1 hour</resetfailure>

  <logpath>D:\services\user-service\logs</logpath>
  <log mode="roll-by-size-time">
    <sizeThreshold>10240</sizeThreshold>
    <pattern>yyyyMMdd</pattern>
    <autoRollAtTime>00:00:00</autoRollAtTime>
  </log>

  <stoptimeout>30 sec</stoptimeout>
</service>
```

### 第三步：以管理员身份注册并启动

```cmd
cd D:\services\user-service
user-service.exe install
user-service.exe start
```

### 第四步：验证服务运行

```cmd
# 查看服务状态
user-service.exe status

# 验证端口是否监听
netstat -ano | findstr 8081

# 测试接口
curl http://localhost:8081/actuator/health
```

### 升级版本（替换 JAR）

```cmd
# 1. 停止服务
user-service.exe stop

# 2. 替换 JAR 文件
copy /Y user-service-1.1.0.jar D:\services\user-service\user-service-1.0.0.jar

# 3. 启动服务
user-service.exe start
```

> 如果新版本 JAR 改了文件名，也需要同步更新 XML 里的 `<arguments>` 路径。

---

## 常见问题排查

### 服务注册失败：拒绝访问

**现象：** `install` 时提示 "Access is denied"

**原因：** 没有以管理员身份运行

**解决：** 右键命令提示符 → "以管理员身份运行"，再执行命令

---

### 服务启动后立即停止

**现象：** `start` 后状态马上变回 Stopped

**排查步骤：**

1. 查看 `logs\my-app.wrapper.log`，找 `ERROR` 关键字
2. 查看 `logs\my-app.err.log`，看 Java 异常信息
3. 常见原因：
   - JAR 路径写错（注意反斜杠和空格）
   - 端口被占用：`netstat -ano | findstr 8080`
   - JVM 参数不正确（内存设置超出系统可用内存）
   - 依赖的配置文件路径不对

---

### `javaw` 命令找不到

**现象：** `wrapper.log` 里提示找不到 `javaw`

**解决：** 在 XML 里用 Java 的完整路径：

```xml
<executable>C:\Program Files\Java\jdk-17\bin\javaw.exe</executable>
```

或者在 XML 里补充 PATH 环境变量：

```xml
<env name="PATH" value="%PATH%;C:\Program Files\Java\jdk-17\bin"/>
```

---

### 中文路径或中文日志乱码

**现象：** 日志文件里中文显示为乱码

**解决：** 在 `<arguments>` 里加上编码参数：

```xml
-Dfile.encoding=UTF-8
-Dstdout.encoding=UTF-8
-Dstderr.encoding=UTF-8
```

同时确保 XML 文件本身以 UTF-8 编码保存，第一行声明 `encoding="UTF-8"`。

---

### 卸载时提示服务正在运行

先停止再卸载：

```cmd
my-app.exe stop
# 等待几秒
my-app.exe uninstall
```

如果还是卸载失败，用 SC 命令强制删除：

```cmd
sc delete my-app
```

---

## 小结

WinSW 的核心就三个文件：一个 EXE、一个 XML、一个 JAR。配置逻辑也很清晰——XML 里告诉 WinSW 怎么启动你的程序，剩下的事情交给 Windows 服务管理器。

用一张表总结常用命令：

| 操作 | WinSW 命令 | 系统命令 |
|------|------------|----------|
| 注册服务 | `my-app.exe install` | — |
| 启动服务 | `my-app.exe start` | `net start my-app` |
| 停止服务 | `my-app.exe stop` | `net stop my-app` |
| 重启服务 | `my-app.exe restart` | — |
| 查看状态 | `my-app.exe status` | `sc query my-app` |
| 卸载服务 | `my-app.exe uninstall` | `sc delete my-app` |

生产部署时，几个细节值得注意：

- **用完整路径**：`executable` 和 `arguments` 里涉及路径的地方，尽量用绝对路径，避免工作目录带来的歧义
- **配置故障恢复**：`onfailure` 是生产环境必备，程序崩溃后自动重启是刚需
- **管理员权限**：注册和卸载服务必须在管理员权限下执行
- **日志滚动**：生产环境一定要配 `roll-by-size-time` 模式，防止日志把磁盘撑爆
