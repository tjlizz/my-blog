---
title: Long 类型前后端传输精度丢失：根源、复现与解法
date: 2026-06-09 19:00:00
categories:
  - 后端
tags:
  - Java
  - JavaScript
  - Long
  - 精度丢失
  - JSON
  - 序列化
  - 前端
cover:
description: 后端 Long 类型的值传到前端莫名其妙就变了？本文深入分析 JSON 序列化中 64 位整数精度丢失的根本原因，并给出企业级的完整解决方案。
---

## 一个问题

先看一个场景。后端定义的订单 ID 是 Long 类型：

```java
@Data
public class Order {
    private Long id;    // 主键
    private String name;
}
```

数据库里的值是 `18014398509481985`。前后端联调的时候，前端说拿到的 ID 不对。

后端查日志：对的，查数据库：对的。前端 console.log 打出来：`18014398509481984`——**少了 1**。

不是网络传输的问题，不是数据库的问题。问题出在 JSON 到 JavaScript 的路上。

---

## JSON 本身没毛病

JSON 规范里其实对数字类型没有明确的精度限制。RFC 7159 里说数字可以是任意精度，但落到具体实现时，就看解析器怎么处理了。

后端把 Long 序列化成 JSON，假如用的是 Jackson，默认行为就是原样输出：

```json
{"id": 18014398509481985, "name": "测试订单"}
```

这个数字本身在 JSON 字符串里是正确无误的。HTTP 传输也不丢数据。问题出在前端收到之后：**JavaScript 不认识这么大的整数。**

---

## JavaScript 的 Number 只能安全表示 53 位整数

JavaScript 的 Number 类型采用的是 IEEE 754 双精度浮点数标准。它的有效数字位是 **53 位**（包括隐含的 1 位）。

这意味 JavaScript 能**精确**表示的整数范围是：

```
2^53 - 1 = 9007199254740991
```

也就是大约 **9 千万亿**。超过这个范围，整数就会出现精度损失。

后端 Java 的 Long 是 **64 位有符号**整数，范围是：

```
-2^63  ~  2^63 - 1
-9223372036854775808  ~  9223372036854775807
```

这个范围的上限（约 922 亿亿）远大于 JavaScript 的 53 位安全整数（约 9 千万亿）。

换句话说，**后端 Long 能装下的数字，前端 JavaScript 不一定能精确表示。**

再看最开始的例子：`18014398509481985`，换算成二进制是 55 位的整数，JavaScript 装不下，丢精度了。

---

## 为什么后端偏爱 Long 做 ID？

既然 Long 有这个问题，那为什么那么多系统还是用 Long 做主键？

历史原因和实际需求都有。

**自增 ID 的规模演进：**

- 早期用 `int`（32 位），最大 21 亿
- 后来不够了，升级到 `Long`（64 位），最大约 922 亿亿
- 分库分表、分布式 ID 生成器（雪花算法等）直接输出 64 位整数

雪花算法生成的 ID 通常是 64 位的 Long，结构大致是：

```
1位符号位 + 41位时间戳 + 10位机器ID + 12位序列号
```

这个值很容易就超过 53 位。比如 `179318286682791936`，放 JSON 里没问题，放到 JavaScript 里就变了。

所以这个问题本质上是：**后端用 64 位整数做主键，而 JavaScript 只能精确处理 53 位整数。**

---

## 复现一下

在浏览器控制台试一下就知道了：

```js
// JavaScript 能精确表示的最大整数
Number.MAX_SAFE_INTEGER  // 9007199254740991

// 超过安全范围
9007199254740992         // 9007199254740992   — 还好
9007199254740993         // 9007199254740992   — 不对了，精度丢了！

// 更大的数，后端常见的雪花 ID
console.log(18014398509481985)
// 18014398509481984   — 比原值少了 1
```

Java 后端：

```java
Long id = 18014398509481985L;
```

经过 Jackson 序列化变成 JSON：

```json
{"id": 18014398509481985}
```

前端用 `JSON.parse()` 解析：

```js
const obj = JSON.parse('{"id": 18014398509481985}');
console.log(obj.id); // 18014398509481984
```

差了 1。如果是作为 key 去查询或者判等，这就是 bug。

---

## 怎么解决？

核心思路就一个：**不让 JavaScript 把它当数字处理，而是当字符串。**

### 解法一：后端改序列化，Long → String

**Jackson 方案：**

```java
@JsonSerialize(using = ToStringSerializer.class)
private Long id;
```

或者全局配置，把所有的 Long 都序列化成字符串：

```java
@Bean
public Jackson2ObjectMapperBuilderCustomizer customizer() {
    return builder -> builder.serializerByType(Long.class, ToStringSerializer.instance);
}
```

之后生成的 JSON 就变成了：

```json
{"id": "18014398509481985"}
```

前端收到的就是字符串，不会丢精度。前端使用时如果需要计算，再自己转。

**Fastjson 方案：**

```java
// 全局配置
SerializerFeature.WriteNonStringValueAsString
```

### 解法二：前端用 BigInt

现代浏览器支持 `BigInt`，可以处理任意精度的整数：

```js
const id = BigInt("18014398509481985");
console.log(id.toString()); // 18014398509481985
```

但需要注意：

- `JSON.parse()` 不会自动把大整数转成 BigInt
- 需要自定义 reviver 或者在序列化时就处理
- BigInt 不能直接和普通 Number 混用运算

通常的配合方式：

```json
{"id": 18014398509481985}
```

```js
// JSON.parse 的 reviver 参数
const obj = JSON.parse(jsonStr, (key, value) => {
  if (key === 'id' && typeof value === 'number' && !Number.isSafeInteger(value)) {
    return BigInt(value);
  }
  return value;
});
```

### 解法三：后端换个 ID 生成策略

如果条件允许，可以避免使用 64 位整数做前端可见的 ID：

- 用 **UUID** / ULID，天然是字符串
- 用**分布式发号器**但输出的值控制在 53 位以内
- 前端只展示不使用的 ID，不对 ID 做运算（但判等和查询还是会用到）

### 解法四：自定义序列化格式

定义一个专门的大整数类型，序列化时同时输出字符串和数字：

```json
{"id": {"value": "18014398509481985", "_type": "long"}}
```

或者用约定好的格式标记：

```json
{"id": "L:18014398509481985"}
```

前端解析时检测前缀，按字符串处理。

大部分场景下不需要这么重，但如果是前后端由不同团队维护、使用不同语言的微服务架构，这种显式的类型标记可以避免歧义。

---

## 推荐方案

综合来看，最务实的方案是：

**后端将 Long 类型的 ID 序列化为字符串。**

理由：

- 改动最小，后端一个注解或一行配置
- 前端不需要额外处理，拿到就是对的
- 不依赖前端是否支持 BigInt
- 对老版本浏览器友好
- 兼容 GraphQL、gRPC-Web 等其他传输协议

具体就是 Jackson 的全局配置：

```java
@Bean
public Jackson2ObjectMapperBuilderCustomizer longToStringCustomizer() {
    return builder -> builder
        .serializerByType(Long.class, ToStringSerializer.instance)
        .serializerByType(Long.TYPE, ToStringSerializer.instance);
}
```

前端 axios 请求拿到 `id` 是 `"18014398509481985"`，不管你是查详情、点列表、做缓存 key，都不会遇到精度问题。

---

## 总结

| 角色 | 发生了什么 |
| --- | --- |
| 后端 Long | 64 位有符号整数，范围超大 |
| JSON 序列化 | 原样输出数字，没问题 |
| HTTP 传输 | 透传，没问题 |
| JavaScript 解析 | **IEEE 754 双精度浮点，只能安全表示 53 位** |
| 前台收到 | 大整数被截断或近似，精度丢失 |

解决思路就是把 Long 序列化成字符串，不让 JavaScript 用 Number 去解析它。

下次遇到前端说 ID 不对时，先看看那个数字有没有超过 9007199254740991。超过了，就别怪前端——它已经很努力了。
