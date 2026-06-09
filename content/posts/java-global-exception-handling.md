---
title: Java 全局异常捕获实战：别再让崩溃裸奔了
date: 2026-06-01 10:00:00
categories:
  - Java
tags:
  - Java
  - Exception
  - Spring Boot
  - 后端
cover:
description: Spring Boot全局异常处理最佳实践：统一异常拦截、返回格式封装与日志追踪，告别线上崩溃无法排查的困境。
---

## 为什么会遇到这个问题

写 Java 最烦的事之一：线上跑得好好的，突然冒出个异常，日志一翻——空的。或者只看到一句 `NullPointerException`，根本不知道从哪蹦出来的。

更头疼的是，用户发来截图说「你的页面崩了」，你连哪个接口报的错都找不到。这种体验，做过后端的都懂。

Java 的异常机制本身很完善——try-catch、throws、finally——但实际项目里，总有一些漏网之鱼：

- 开发忘了加 try-catch
- 异步线程里的异常，主线程感知不到
- 框架层抛出的异常，业务代码接不住

所以**全局异常捕获**不是一个「锦上添花」的功能，而是每个 Java 项目都应该有的基础设施。

## 全局异常捕获的本质

说白了，全局异常捕获就是给整个应用装一个「逃生网」。不管异常从哪冒出来，最终都能落到一个统一的地方处理，然后决定怎么响应——记录日志、返回友好的错误信息、或者做降级处理。

Java 层面提供了几个入口来做这件事，不同场景用不同的方案。

## 方案一：Thread.UncaughtExceptionHandler — 主线程最后的防线

这是 Java 最底层的全局异常捕获机制。当线程抛出异常但没有被 catch 时，JVM 会调用线程的 `UncaughtExceptionHandler`。

### 最基本的用法

```java
Thread.setDefaultUncaughtExceptionHandler((thread, throwable) -> {
    System.err.println("线程 [" + thread.getName() + "] 挂了，原因：");
    throwable.printStackTrace();
    // 这里可以发报警、写日志、做兜底
});
```

这段代码一写，整个 JVM 进程里所有线程未捕获的异常，都会走到这个回调里。

### 实际项目里的增强版

```java
public class GlobalExceptionHandler implements Thread.UncaughtExceptionHandler {
    
    private static final Logger log = LoggerFactory.getLogger(GlobalExceptionHandler.class);
    
    @Override
    public void uncaughtException(Thread t, Throwable e) {
        log.error("未捕获异常 - 线程: {} (id={}), 线程组: {}", 
            t.getName(), t.getId(), t.getThreadGroup() != null ? t.getThreadGroup().getName() : "null", e);
        
        // 发送告警通知（邮件、钉钉、企业微信等）
        alertService.sendAlert("线程 " + t.getName() + " 崩溃", e);
        
        // 记录埋点
        metricsCollector.increment("jvm.uncaught.exception");
    }
}
```

启动时注册：

```java
public static void main(String[] args) {
    Thread.setDefaultUncaughtExceptionHandler(new GlobalExceptionHandler());
    SpringApplication.run(YourApp.class, args);
}
```

### 容易踩的坑

`setDefaultUncaughtExceptionHandler` 设置的是全局默认处理器。如果某个线程自己调了 `setUncaughtExceptionHandler` 设置了专有处理器，那全局的这个不会覆盖它。这点要清楚——它不是万能的，它是兜底的兜底。

另外，**守护线程的异常**也会被捕获，但要注意守护线程不受 JVM 退出保护，它抛异常时 JVM 可能已经在退出了，handler 里的逻辑可能没跑完。

## 方案二：Spring Boot 的 @ControllerAdvice — Web 层的统一拦截

如果你的项目是 Spring Boot 或者 Spring MVC，`@ControllerAdvice` 是处理 Web 层异常最优雅的方式。

### 基本实现

```java
@RestControllerAdvice
public class GlobalWebExceptionHandler {

    private static final Logger log = LoggerFactory.getLogger(GlobalWebExceptionHandler.class);

    @ExceptionHandler(IllegalArgumentException.class)
    public Result<Void> handleIllegalArgument(IllegalArgumentException e) {
        log.warn("参数校验失败: {}", e.getMessage());
        return Result.error(400, e.getMessage());
    }

    @ExceptionHandler(NullPointerException.class)
    public Result<Void> handleNullPointer(NullPointerException e) {
        log.error("空指针异常: ", e);
        return Result.error(500, "服务器内部错误");
    }

    @ExceptionHandler(Exception.class)
    public Result<Void> handleException(Exception e) {
        log.error("未知异常: ", e);
        return Result.error(500, "服务器内部错误");
    }
}
```

### 配合自定义异常使用

光靠捕获内置异常不够灵活。实际项目里，大家都会搭配自定义业务异常：

```java
public class BusinessException extends RuntimeException {
    private final int code;
    private final String message;
    
    public BusinessException(int code, String message) {
        super(message);
        this.code = code;
    }
    
    public int getCode() { return code; }
}
```

然后在全局处理器里统一处理：

```java
@ExceptionHandler(BusinessException.class)
public Result<Void> handleBusiness(BusinessException e) {
    log.warn("业务异常: code={}, msg={}", e.getCode(), e.getMessage());
    return Result.error(e.getCode(), e.getMessage());
}
```

### 从异常里获取更多上下文

Spring 的 `@ExceptionHandler` 还能注入更多参数，拿到请求上下文：

```java
@ExceptionHandler(Exception.class)
public Result<Void> handleException(Exception e, HttpServletRequest request) {
    log.error("请求 {} {} 发生异常: ", request.getMethod(), request.getRequestURI(), e);
    return Result.error(500, "服务器繁忙，请稍后重试");
}
```

### 不同异常返回不同 HTTP 状态码

```java
@ExceptionHandler(MissingServletRequestParameterException.class)
@ResponseStatus(HttpStatus.BAD_REQUEST)
public Result<Void> handleMissingParam(MissingServletRequestParameterException e) {
    return Result.error(400, "缺少参数: " + e.getParameterName());
}

@ExceptionHandler(HttpRequestMethodNotSupportedException.class)
@ResponseStatus(HttpStatus.METHOD_NOT_ALLOWED)
public Result<Void> handleMethodNotSupported(HttpRequestMethodNotSupportedException e) {
    return Result.error(405, "不支持的请求方法: " + e.getMethod());
}

@ExceptionHandler(NoHandlerFoundException.class)
@ResponseStatus(HttpStatus.NOT_FOUND)
public Result<Void> handleNotFound(NoHandlerFoundException e) {
    return Result.error(404, "接口不存在");
}
```

### 处理顺序的坑

多个 `@ExceptionHandler` 的匹配规则是**找最匹配的**，不是按声明顺序。比如抛了 `IllegalArgumentException`，会优先命中专门的 `handleIllegalArgument`，而不是走 `handleException`。

但要注意：如果你写了两个都能匹配到同一层级的处理器，顺序就不确定了。建议只保留一个宽泛的 `Exception.class` 兜底，其他的按具体异常类型写。

## 方案三：Filter + ErrorPage — Servlet 容器的保底

有些异常连 `@ControllerAdvice` 都抓不到——比如在 Filter 里抛的、在 Spring 的 DispatcherServlet 之前就炸了的。这时候就得靠 Servlet 容器级别的处理。

### 自定义 Filter 捕获

```java
@Component
@Order(Ordered.HIGHEST_PRECEDENCE)
public class ExceptionCaptureFilter implements Filter {

    private static final Logger log = LoggerFactory.getLogger(ExceptionCaptureFilter.class);

    @Override
    public void doFilter(ServletRequest request, ServletResponse response, FilterChain chain)
            throws IOException, ServletException {
        try {
            chain.doFilter(request, response);
        } catch (Exception e) {
            log.error("Filter 层捕获异常: ", e);
            HttpServletResponse resp = (HttpServletResponse) response;
            resp.setStatus(HttpStatus.INTERNAL_SERVER_ERROR.value());
            resp.setContentType("application/json;charset=UTF-8");
            resp.getWriter().write("{\"code\":500,\"message\":\"服务器内部错误\"}");
        }
    }
}
```

### 错误页面兜底

Spring Boot 在 `application.yml` 里可以配置：

```yaml
server:
  error:
    path: /error
    whitelabel:
      enabled: false
```

然后自己写一个 `/error` 的 Controller：

```java
@RestController
public class CustomErrorController implements ErrorController {

    @RequestMapping("/error")
    public Result<Void> handleError(HttpServletRequest request) {
        Integer statusCode = (Integer) request.getAttribute(RequestDispatcher.ERROR_STATUS_CODE);
        String message = (String) request.getAttribute(RequestDispatcher.ERROR_MESSAGE);
        return Result.error(statusCode != null ? statusCode : 500, message != null ? message : "未知错误");
    }
}
```

这样连 404、405 这些 Spring 拦截不到的请求也能统一响应 JSON 了，而不是返回一堆丑陋的 HTML 错误页。

## 方案四：异步线程的异常捕获

开发中最容易被忽略的，就是线程池里跑飞了的异常。

### 线程池场景

```java
ExecutorService executor = Executors.newFixedThreadPool(4);
executor.submit(() -> {
    // 如果这里抛异常，submit 能吞掉！
    throw new RuntimeException("任务执行失败");
});
```

`submit()` 的返回值是 `Future`，异常被封装在 `Future.get()` 里。如果不调 `get()`，异常就被静默吞掉了。这是 Java 很多线上事故的根源。

### 正确做法

**方案 A：确保调 get()**

```java
Future<?> future = executor.submit(task);
try {
    future.get();
} catch (ExecutionException e) {
    log.error("异步任务执行异常", e.getCause());
}
```

**方案 B：使用 execute 代替 submit**

```java
executor.execute(() -> {
    try {
        // 业务逻辑
    } catch (Exception e) {
        log.error("任务执行失败", e);
        throw e;
    }
});
```

`execute()` 的异常会直接抛到线程的 UncaughtExceptionHandler 里（如果设置了的话）。

**方案 C：装饰线程池**

```java
public class ExceptionAwareThreadPoolExecutor extends ThreadPoolExecutor {
    
    public ExceptionAwareThreadPoolExecutor(int core, int max, long keepAlive, TimeUnit unit,
                                             BlockingQueue<Runnable> queue) {
        super(core, max, keepAlive, unit, queue);
    }
    
    @Override
    protected void afterExecute(Runnable r, Throwable t) {
        super.afterExecute(r, t);
        if (t == null && r instanceof Future<?>) {
            try {
                ((Future<?>) r).get();
            } catch (CancellationException e) {
                // 任务被取消，忽略
            } catch (ExecutionException e) {
                t = e.getCause();
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
            }
        }
        if (t != null) {
            log.error("线程池任务异常", t);
        }
    }
}
```

`afterExecute` 是 `ThreadPoolExecutor` 提供的钩子，能捕获任务执行后的异常——不管是用 `submit` 还是 `execute`。

### Spring @Async 的异常处理

```java
@Configuration
public class AsyncConfig implements AsyncConfigurer {
    
    @Override
    public Executor getAsyncExecutor() {
        ThreadPoolTaskExecutor executor = new ThreadPoolTaskExecutor();
        executor.setCorePoolSize(5);
        executor.setMaxPoolSize(10);
        executor.setQueueCapacity(100);
        executor.setThreadNamePrefix("async-");
        executor.initialize();
        return executor;
    }
    
    @Override
    public AsyncUncaughtExceptionHandler getAsyncUncaughtExceptionHandler() {
        return (throwable, method, params) -> 
            log.error("异步方法 {} 执行异常，参数: {}", method.getName(), Arrays.toString(params), throwable);
    }
}
```

## 方案五：日志记录的完善建议

全局捕获只是第一步，更关键的是**把异常信息完整记录下来**。

### 一个合格的异常日志应该包含

```
[2026-06-01 10:23:45.678] [http-nio-8080-exec-3] ERROR c.y.p.GlobalWebExceptionHandler - 
请求: GET /api/user/123 
参数: {} 
用户: userId=456 
异常: java.lang.NullPointerException: Cannot invoke "String.length()" because "name" is null
    at com.yourproject.service.UserService.getUser(UserService.java:45)
    at com.yourproject.controller.UserController.getUser(UserController.java:23)
    ...
```

能做到这个级别，线上排查效率会提升很多。

### 推荐实践

```java
@ExceptionHandler(Exception.class)
public Result<Void> handleException(Exception e, HttpServletRequest request) {
    MDC.put("requestId", request.getAttribute("requestId").toString());
    log.error("请求 [{} {}] 异常: ", request.getMethod(), 
        request.getRequestURI(), e);
    return Result.error(500, "系统繁忙");
}
```

配合 MDC（Mapped Diagnostic Context）可以在日志里自动带上 traceId，把所有相关日志串起来。

## 完整的最佳实践方案

把上面这些串起来，一个相对完善的项目应该这样做：

```
1. 启动时注册 global UncaughtExceptionHandler
   → 兜住所有漏掉的线程级异常

2. @RestControllerAdvice 处理 Controller 层异常
   → 统一响应格式，返回 JSON 而不是错误页

3. Filter 层包装异常捕获
   → 兜住进入 Spring 之前的异常

4. 自定义 ErrorController 处理 404/405 等路径异常
   → 消灭白标页

5. 线程池重写 afterExecute
   → 异步任务异常不再静默吞掉

6. 统一日志格式 + MDC traceId
   → 异常可追溯，可复现
```

## 总结

全局异常捕获这个事，说起来不难，但真正做好需要覆盖各个层面：

- **JVM 层面**：UncaughtExceptionHandler，兜住漏网之鱼
- **Web 层面**：@ControllerAdvice + Filter + ErrorController，三层拦截
- **异步层面**：线程池 afterExecute + AsyncConfigurer 自定义处理器
- **日志层面**：统一格式 + traceId，让异常可追溯

把这些配好了，线上再出问题，你至少知道从哪查起。别让异常在暗处爆炸——给它一个明确的出口。

建议现在就去检查一下你的项目，看看有几个口子还漏着。
