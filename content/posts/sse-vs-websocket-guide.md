---
title: SSE vs WebSocket：服务端推送的两种姿势，原理和实现全解析
date: 2026-06-04 15:30:00
categories:
  - 技术科普
tags:
  - SSE
  - WebSocket
  - HTTP
  - 实时通信
cover:
description: SSE与WebSocket两种服务端推送技术的原理对比与实现全解析，根据实时通信场景选择最合适的方案。
---

## 从实时推送这个需求说起

Web 应用发展到今天，"浏览器主动请求，服务器被动响应"的模型在很多场景下已经不够用。

消息通知、订单状态更新、AI 对话流式输出、实时股价——这些场景都需要服务器主动把数据推送给客户端。实现这个需求，主流方案就两个：SSE 和 WebSocket。

这两个东西经常被放在一起比较，但底子完全不同。选错了，要么杀鸡用牛刀，要么牛刀不够用。这篇把它们的原理和实现细节掰开揉碎讲清楚。

## SSE：基于 HTTP 的"单向通道"

SSE 全称 Server-Sent Events，服务端推送事件。名字已经说得很明白了——**服务端向客户端推送事件，单向的**。

### 原理一句话

客户端发一个普通的 HTTP 请求，告诉服务器"我不走了，你有数据就发过来"。服务器在同一个 HTTP 连接上，持续不断地把数据以 `text/event-stream` 格式写回。

### 客户端实现

浏览器原生支持，用 `EventSource` 接口就能搞定：

```javascript
const source = new EventSource('/api/sse/notifications');

// 监听命名事件
source.addEventListener('order-update', (event) => {
    const data = JSON.parse(event.data);
    updateOrderStatus(data);
});

// 监听未命名事件
source.onmessage = (event) => {
    console.log('收到数据:', event.data);
};

// 错误处理
source.onerror = (err) => {
    console.error('SSE 连接异常:', err);
    // EventSource 会自动重连，不用自己写重试逻辑
};
```

代码量少得可怜，浏览器自带重连机制。断线了自动重试，重试间隔服务端还能通过 `retry` 字段控制。

### 服务端实现

服务端稍微麻烦一点，但也不复杂。以 Spring Boot 为例：

```java
@GetMapping(path = "/api/sse/notifications", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
public SseEmitter streamNotifications() {
    SseEmitter emitter = new SseEmitter(0L); // 0L 表示不超时
    // 在另一个线程推送数据
    executorService.execute(() -> {
        try {
            while (true) {
                Notification notif = notificationQueue.poll(5, TimeUnit.SECONDS);
                if (notif != null) {
                    emitter.send(SseEmitter.event()
                        .name("order-update")
                        .data(notif));
                } else {
                    // 发送心跳，保持连接
                    emitter.send(SseEmitter.event().comment("heartbeat"));
                }
            }
        } catch (Exception e) {
            emitter.completeWithError(e);
        }
    });
    return emitter;
}
```

`SseEmitter` 是 Spring 对 SSE 的封装，核心就是建立连接后一直保持着，有数据就写，没数据就发心跳。

### 数据格式

SSE 的传输格式是纯文本，一行一个字段：

```
event: order-update
data: {"orderId": 1001, "status": "shipped", "timestamp": "2026-06-04T15:00:00Z"}

event: order-update
data: {"orderId": 1002, "status": "delivered"}

: 这个是注释，相当于心跳

data: 这是一条没有事件名的消息
```

每条消息用空行分隔。字段含义很直观：

- `event`：事件名称，客户端用 `addEventListener` 监听
- `data`：数据内容，可以是任何文本
- `id`：事件 ID，用于断线重连时告诉服务端从哪开始
- `retry`：重连间隔，毫秒
- `:` 开头的是注释，通常用作心跳

## WebSocket：全双工的"长连接"

WebSocket 跟 SSE 完全不是一路东西。SSE 是在 HTTP 协议上"借道"，WebSocket 是通过 HTTP 升级协议后的全新 TCP 通道。

### 握手机制

WebSocket 不是简单发个请求就完事的，它有个握手流程：

```
客户端 → 服务端：
GET /ws/chat HTTP/1.1
Host: example.com
Upgrade: websocket
Connection: Upgrade
Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==
Sec-WebSocket-Version: 13

服务端 → 客户端：
HTTP/1.1 101 Switching Protocols
Upgrade: websocket
Connection: Upgrade
Sec-WebSocket-Accept: s3pPLMBiTxaQ9kYGzzhZRbK+xOo=
```

关键在 `Upgrade: websocket` 和 `101 Switching Protocols`。握手完成后，协议就从 HTTP 切换到了 WebSocket，之后的数据传输走的是独立的二进制帧协议，不再受 HTTP 的约束。

### 客户端实现

```javascript
const ws = new WebSocket('wss://api.example.com/ws/chat');

// 连接建立
ws.onopen = () => {
    console.log('WebSocket 已连接');
    ws.send(JSON.stringify({ type: 'join', room: 'general' }));
};

// 接收消息
ws.onmessage = (event) => {
    const msg = JSON.parse(event.data);
    handleMessage(msg);
};

// 发送消息
function sendMessage(text) {
    ws.send(JSON.stringify({
        type: 'message',
        content: text,
        timestamp: Date.now()
    }));
}

// 错误处理
ws.onerror = (err) => {
    console.error('WebSocket 错误:', err);
};

// 连接关闭
ws.onclose = (event) => {
    console.log('WebSocket 已断开, code:', event.code);
    // 注意：WebSocket 不会自动重连，需要自己实现
    reconnect();
};
```

`WebSocket` 也是浏览器原生支持的，但跟 SSE 一个显著区别是：**WebSocket 断线后不会自动重连**，需要自己写重连逻辑。

### 服务端实现

Java 用 Spring WebSocket：

```java
@Component
public class ChatWebSocketHandler extends TextWebSocketHandler {
    
    private static final Map<String, WebSocketSession> sessions = new ConcurrentHashMap<>();
    
    @Override
    public void afterConnectionEstablished(WebSocketSession session) {
        String userId = extractUserId(session);
        sessions.put(userId, session);
        broadcast(userId + " 已上线");
    }
    
    @Override
    protected void handleTextMessage(WebSocketSession session, TextMessage message) {
        ChatMessage msg = parseMessage(message.getPayload());
        // 根据消息类型做不同处理
        switch (msg.getType()) {
            case "chat" -> sendToUser(msg.getTargetId(), msg);
            case "broadcast" -> broadcast(msg);
            case "typing" -> sendTypingIndicator(msg);
        }
    }
    
    @Override
    public void afterConnectionClosed(WebSocketSession session, CloseStatus status) {
        String userId = extractUserId(session);
        sessions.remove(userId);
        broadcast(userId + " 已离线");
    }
}
```

WebSocket 是真正的双向通信。客户端能发消息给服务端，服务端也能主动推给客户端。同一个连接上，两边都能随时开口说话。

## 核心区别一张表

| 维度 | SSE | WebSocket |
|------|-----|-----------|
| 通信方向 | 服务端 → 客户端（单向） | 双向 |
| 协议基础 | HTTP | WebSocket（基于 TCP） |
| 浏览器支持 | EventSource 原生支持 | WebSocket 原生支持 |
| 自动重连 | 内置 | 需自己实现 |
| 数据传输格式 | 纯文本（强制 UTF-8） | 文本或二进制 |
| 最大连接数限制（同域） | 浏览器限制 6 个 | 无明确限制 |
| 自定义 Headers | 不支持（EventSource 限制） | 支持 |
| 实现复杂度 | 简单 | 中等 |
| 兼容性 | 不支持 IE（Edge 支持） | 几乎所有现代浏览器 |

## 什么场景用 SSE

**AI 对话流式输出。** ChatGPT 那种一个字一个字往外蹦的效果，现在主流方案就是 SSE。数据流向单一（服务器→客户端），实现简单，浏览器自带的 EventSource 天然适合流式消费。

**消息通知。** 订单状态变更、系统告警、审批通知。都是服务器主动推给客户端，客户端不需要回传数据。SSE 够用，不需要 WebSocket 这种重量级方案。

**日志实时展示。** 运维面板上 tail 服务器日志。服务端只管吐数据，客户端只管渲染。单向、高吞吐、断线可续传——SSE 的 `Last-Event-ID` 机制让你重连后从断点继续接收。

**数据看板 / 监控面板。** 股价行情、服务器指标、在线人数统计。每隔几秒推送一次更新数据，SSE 比轮询优雅，又比 WebSocket 轻量。

```java
// Spring Boot 集成 SSE 实现流式输出（GPT 风格）
@GetMapping(value = "/api/chat/stream", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
public SseEmitter streamChat(@RequestParam String prompt) {
    SseEmitter emitter = new SseEmitter(60000L);
    
    aiService.streamChat(prompt, new StreamCallback() {
        @Override
        public void onToken(String token) {
            safeSend(() -> emitter.send(token));
        }
        @Override
        public void onComplete() {
            emitter.complete();
        }
        @Override
        public void onError(Throwable t) {
            emitter.completeWithError(t);
        }
    });
    
    return emitter;
}
```

## 什么场景用 WebSocket

**即时通讯 / 聊天。** 用户在群里发消息，消息要推给群里的其他人。这是典型的双向通信——每个人既要发也要收。WebSocket 是唯一合理的选择。

**多人协作。** 在线文档编辑、白板协作、协同编程。用户的操作需要实时广播给协作者，同时接收其他人的变更。WebSocket 的低延迟双向能力在这里不可替代。

**实时游戏。** 对战类游戏里，玩家的操作指令和服务器的事件推送都是毫秒级的双向交互。WebSocket 的二进制帧支持还能自定义高压缩比的通信协议。

**实时表单 / 数据绑定。** 一个用户在后台编辑配置，所有打开这个页面的管理员都要实时看到变化。双向同步的场景，WebSocket 更加自然。

## 一些容易忽略的细节

**浏览器同域 SSE 连接数限制。** Chrome 和 Firefox 对同一个域名只允许 6 个 SSE 连接。如果你同时打开多个页面或标签，6 个限制很容易用完。WebSocket 没有这个限制。

**WebSocket 的负载均衡。** WebSocket 连接是长连接，会绑定到具体服务器实例。如果后面挂了一组服务器，需要引入 Sticky Session 或者独立的消息中间件做广播。SSE 本质也是长连接，同样面临这个问题，但 SSE 可以降级到轮询。

**SSE 不能发自定义请求头。** `EventSource` API 设计得"太简单"了，导致你没法在初始化时带上 `Authorization` header。解决方案有两个：一是把 token 放在 URL 参数里（安全隐患自己评估），二是在 Server 端通过 Cookie 鉴权。当然你也可以用 fetch API 手动解析 SSE 流来绕过这个限制。

**WebSocket 对网关和防火墙不友好。** 某些企业网络会拦截非标准端口的 WebSocket 连接，或者代理不支持 Upgrade 头。SSE 走的是标准 HTTP 端口，通常不会被拦截。

## 总结

选 SSE 还是选 WebSocket，你只需要回答三个问题：

1. **需要双向通信吗？** 是 → WebSocket，否 → 继续往下看
2. **数据是服务器主动推送吗？** 是 → 考虑 SSE，否 → 不用选这两个
3. **实现简单优先，还是功能全面优先？** 简单优先 → SSE，全面优先 → WebSocket

没有哪个方案能覆盖所有场景。AI 流式输出用 SSE，最合适；在线聊天用 WebSocket，最合适。

把技术的边界搞清楚，你的架构决策就不会跑偏。
