---
title: Java 中的 DTO、DO、VO 到底有什么区别？一篇讲清楚
date: 2026-06-04 14:00:00
categories:
  - Java
tags:
  - Java
  - DTO
  - DO
  - VO
cover:
description: 深入解析Java分层架构中DTO、DO、VO三种对象的定义、职责划分及使用场景，告别对象混用的代码坏味道。
---

## 刚入坑时的迷茫

刚写 Java 那会儿，看到项目里有 `UserDTO`、`UserDO`、`UserVO`，心里直犯嘀咕：这仨不都是 user 吗？干嘛要写三遍？多此一举吧？

后来被 review 怼了一顿才明白——不是代码啰嗦，是我太年轻。

这三个东西，各管各的事，分清楚之后代码质量直接上了一个台阶。今天就把我的理解写下来，希望能帮到刚开始接触这块的朋友。

## 先给个最直接的结论

- **DO**（Data Object）—— 跟数据库表一对一，ORM 用
- **DTO**（Data Transfer Object）—— 接口之间传输数据，远程调用用
- **VO**（View Object）—— 给前端页面展示用，视图层用

就这么简单。但真正用好的关键，是搞清楚"为什么需要分开，不分开会怎样"。

## DO：数据库的映射，别让它出门

DO 通常长这样：

```java
public class UserDO {
    private Long id;
    private String username;
    private String password;      // 敏感字段
    private String email;
    private String phone;
    private Integer status;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
```

一眼就能看出来，这跟数据库里的 `user` 表字段一模一样。用 MyBatis 或 JPA 的时候，查询结果直接映射到这个对象上。

**DO 的核心原则：不出服务层。**

把它直接返回给前端？那 `password` 字段就裸奔了。把它直接传到 RPC 接口？调用方可能只需要 3 个字段，你塞了 15 个，白白浪费带宽。

有些团队把 DO、Entity、PO（Persistent Object）混着叫，无所谓，本质都是一个东西——持久层的数据载体。

## DTO：接口的契约，两头解耦

DTO 是专门为接口通信设计的。拿用户注册场景来说：

```java
// 注册请求
public class UserRegisterDTO {
    @NotBlank
    private String username;
    @NotBlank
    @Size(min = 6, max = 20)
    private String password;
    @Email
    private String email;
}

// 注册响应
public class UserRegisterResultDTO {
    private Long userId;
    private String username;
    private String message;
}
```

注意看，`UserRegisterDTO` 里只有注册需要传的三个字段。DO 里那些 `createdAt`、`updatedAt`、`status` 在这里都不需要出现。

**DTO 解决的核心问题：**

1. **接口和内部实现解耦**。今天数据库表加了字段，只要 DTO 不变，调用方代码就不用改。
2. **精确控制传输数据**。不多传、不少传、不暴露内部字段。
3. **可以做校验注解**。DTO 上可以加 `@NotNull`、`@Size` 这类校验，DO 上加了也没用——没人会对数据库对象做入参校验。

RPC 接口、HTTP API 的请求体和响应体，都应该是 DTO。

## VO：前端需要什么，VO 就给什么

VO 是专门给前端准备的。前端要的数据结构跟后端内部的数据结构往往不一样。

一个常见的例子：

```java
public class UserVO {
    private Long userId;
    private String displayName;       // 拼接好的展示名
    private String avatarUrl;         // 完整 URL
    private String roleNames;         // 角色名列表，逗号分隔
    private String statusDesc;        // "已激活" 而不是 1
}
```

注意几个细节：

- `displayName` 可能是 `nickname` 为空时 fallback 到 `username` 的结果，这个逻辑在 DO 里写不合适，在 VO 里组装好再给前端
- `statusDesc` 把数据库的 `1` 翻译成了"已激活"，前端拿到直接渲染，不用自己判断
- 字段名可以跟 DO 不一样，只要前端约定好了就行

**VO 的黄金法则：前端拿到就能直接用，不需要再加工。**

## 一个完整的流转流程

结合一个用户查询接口来看整个链路：

**Controller 层**：接收 DTO → 调用 Service → 返回 VO

```java
@RestController
public class UserController {
    
    @GetMapping("/user/{id}")
    public Result<UserVO> getUser(@PathVariable Long id) {
        // Controller 只管接收和返回，不做业务
        UserVO vo = userService.getUser(id);
        return Result.success(vo);
    }
}
```

**Service 层**：拆包 DTO → 查 DO → 组装返回

```java
public class UserServiceImpl implements UserService {
    
    public UserVO getUser(Long id) {
        // Service 层操作 DO
        UserDO userDO = userMapper.selectById(id);
        if (userDO == null) {
            throw new BusinessException("用户不存在");
        }
        
        // DO → VO 转换
        UserVO vo = new UserVO();
        vo.setUserId(userDO.getId());
        vo.setDisplayName(
            StringUtils.isNotBlank(userDO.getNickname()) 
                ? userDO.getNickname() 
                : userDO.getUsername()
        );
        vo.setStatusDesc(userDO.getStatus() == 1 ? "已激活" : "未激活");
        return vo;
    }
}
```

**DAO 层**：只负责把数据库结果映射成 DO

数据流向一目了然：

```
DB → DO → Service(DO转VO) → VO → Controller → 前端
                    ↘ DTO → RPC/外部接口
```

## 不分层的后果

看过不少项目，DO 直接当 VO 返回。遇到几个典型坑：

**密码泄露**。这个不用多说，`UserDO` 直接序列化返回，`password` 字段就跟着出去了。就算你给 `password` 加了 `@JsonIgnore`，也只是管住了当前接口。哪天换个接口忘了加，又是一场事故。

**字段冗余**。列表接口只需要 id 和 name，你返回了 20 个字段，前端调一次接口拉一堆没用的数据。移动端带宽本来就金贵，这么搞迟早被用户骂。

**改一个字段影响上下游**。`status` 字段从 `int` 改成 `enum`，本来只是数据库层的事，因为 DO 直接传到前端，你得通知前端改判断逻辑。层层耦合，改都不敢改。

## 什么场景可以偷懒

规矩是死的，项目是活的。不是所有地方都要三层分离。

**简单的 CRUD 项目**，比如内部管理系统，就没必要拆分那么细。DO 即 DTO 即 VO，直接一套到底，节省时间。

判断标准很直接：**DO 里的字段是否会被直接暴露给不该看到的人？** 如果是纯内部使用、不涉及安全和敏感信息，合在一起问题不大。

同样，**如果写个 Demo 或者小工具**，也没必要整三层。等代码膨胀到需要拆的时候再拆，不迟。

## 一些实用的转换工具

DO → DTO → VO 之间的转换最烦人，写 getter/setter 赋值能写到手酸。推荐几个方案：

**MapStruct**：编译期生成转换代码，性能好、零反射。推荐程度排第一。

```java
@Mapper
public interface UserMapper {
    UserVO toVO(UserDO userDO);
    UserDTO toDTO(UserDO userDO);
}
```

写一个接口就够了，MapStruct 会自动生成实现类。

**手动 BeanUtils**：技术老、项目老，很多项目里还有。`BeanUtils.copyProperties` 跑的是反射，性能一般，但胜在简单。注意两个坑：字段名必须一致、类型必须匹配。

**自己写转换方法**：小项目里用，最直观但最啰嗦。

```java
public static UserVO convert(UserDO userDO) {
    UserVO vo = new UserVO();
    vo.setUserId(userDO.getId());
    // ... 一个个 set
    return vo;
}
```

我个人倾向 MapStruct，项目里用了一次就回不去了。

## 总结

DO、DTO、VO 本质上是"关注点分离"思想在 Java 项目里的具体实践：

- **DO** 管数据库，不出服务层
- **DTO** 管接口通信，接口间传递
- **VO** 管视图展示，给前端用

分清楚了，代码好维护、接口好改、安全也好控制。

但也别走极端。小项目别硬拆，大项目别偷懒。根据实际场景灵活选择，才是真的好工程师。
