---
title: "Nginx 反向代理实战：一台服务器、一个端口、一张证书，跑多个 Web 服务"
date: "2026-06-03"
categories:
  - 运维
tags:
  - Nginx
  - 反向代理
  - HTTPS
  - SSL
  - 服务部署
cover: /images/nginx-reverse-proxy-multi-service-https/nginx-reverse-proxy-hero.svg
description: 用Nginx反向代理在一台服务器上部署多个Web服务并统一管理HTTPS证书，实现端口复用与安全收口。
---

![Nginx 把一个 HTTPS 入口后的多个内部服务统一收口，再按路径或域名转发出去](/images/nginx-reverse-proxy-multi-service-https/nginx-reverse-proxy-hero.svg)

## 为什么要用反向代理

手里一台服务器，上面跑了几个服务：

- 前端页面（Vite 开发服务器，端口 5173）
- 后端 API（Node.js，端口 3000）
- 静态文件服务（端口 8080）
- 可能还有个 Docker 里的应用（端口 9000）

总不能跟用户说 "请访问 `http://example.com:5173`" 吧。用户只会一脸问号。

而且只有一个 80（HTTP）和 443（HTTPS）端口能用，证书也只有一张。怎么让所有服务都走 HTTPS，看起来都像同一个站点？

答案就是 **Nginx 反向代理**。

## 什么是反向代理

反向代理就是用户请求先打到 Nginx，Nginx 再根据请求路径或域名，把请求转发给内部的不同服务。

```
用户 → Nginx (443) → 判断路径 → 转发到 localhost:3000 / localhost:5173 ...
```

用户全程只看到同一个域名、同一个端口，背后是几个服务完全透明。

> 从部署视角看，Nginx 干的事很简单：把“外部统一入口”和“内部服务拆分”这两个需求同时满足。

正向代理（你用的 VPN、科学上网）是代理你出去。反向代理是代理别人进来。方向别搞反了。

## 最简配置：路径转发

假设你的服务分布如下：

| 路径 | 后端服务 |
| --- | --- |
| `/` | 前端静态页（localhost:5173） |
| `/api` | 后端 API（localhost:3000） |
| `/blog` | 博客（localhost:8080） |

一个 `nginx.conf` 搞定：

```nginx
server {
    listen 80;
    server_name example.com;

    location / {
        proxy_pass http://localhost:5173;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /api/ {
        proxy_pass http://localhost:3000/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /blog/ {
        proxy_pass http://localhost:8080/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

### proxy_pass 末尾的 / 有讲究

这是最容易踩坑的地方。

```nginx
# 有斜杠 — 匹配到的路径会被替换掉
location /api/ {
    proxy_pass http://localhost:3000/;
}
# 请求 /api/users → 转发到 /users

# 无斜杠 — 匹配到的路径会透传
location /api/ {
    proxy_pass http://localhost:3000;
}
# 请求 /api/users → 转发到 /api/users
```

你要搞清楚你的后端服务期望什么路径。大部分后端 API 期望不带 `/api` 前缀的路径，所以加 `/` 的情况更多。

## 子域名转发：一个端口跑完全部服务

![路径转发适合同域下拆路径，子域名转发适合多个服务都想占根路径的情况](/images/nginx-reverse-proxy-multi-service-https/nginx-routing-modes.svg)

路径转发有个问题：如果两个服务都抢根路径 `/`，你就没法搞了。

这时候用子域名：

```nginx
server {
    listen 80;
    server_name app.example.com;
    location / {
        proxy_pass http://localhost:5173;
        # ...
    }
}

server {
    listen 80;
    server_name api.example.com;
    location / {
        proxy_pass http://localhost:3000;
        # ...
    }
}

server {
    listen 80;
    server_name blog.example.com;
    location / {
        proxy_pass http://localhost:8080;
        # ...
    }
}
```

三个子域名，都走同一个 80 端口。Nginx 根据 `Host` 头来区分请求要转发给谁。

## 配 HTTPS：一张证书搞定多个服务

### 方案一：泛域名证书（推荐）

如果多个服务共用同一个主域名，比如 `*.example.com`，直接申请一张泛域名证书。

```
证书名称: *.example.com
适用: app.example.com, api.example.com, blog.example.com ...
```

用 Certbot 申请：

```bash
sudo certbot certonly --manual --preferred-challenges dns \
    -d "*.example.com" -d example.com
```

DNS 验证方式需要在域名管理加一条 `TXT` 记录，配置完就能拿到证书。

拿到后在 Nginx 里配：

```nginx
server {
    listen 443 ssl http2;
    server_name app.example.com api.example.com blog.example.com;

    ssl_certificate /etc/letsencrypt/live/example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/example.com/privkey.pem;

    # 上面的 location 配置照搬
}
```

**一张证书，所有子域名全通。**

### 方案二：多域名证书（SAN 证书）

如果你的几个服务完全不同域，比如 `app.com`、`api.org`、`blog.net`，可以用 SAN 证书。

申请时把三个域名都加上：

```bash
sudo certbot certonly --manual --preferred-challenges dns \
    -d app.com -d api.org -d blog.net
```

证书签发后，在 Nginx 里直接引用：

```nginx
ssl_certificate /etc/letsencrypt/live/app.com/fullchain.pem;
ssl_certificate_key /etc/letsencrypt/live/app.com/privkey.pem;
```

> 注意：申请这类证书需要验证所有域名的所有权，DNS 验证要在每个域名下加 TXT 记录。

### HTTP 自动跳转 HTTPS

一般套路是把 HTTP 全部 301 到 HTTPS：

```nginx
server {
    listen 80;
    server_name app.example.com api.example.com blog.example.com;
    return 301 https://$host$request_uri;
}
```

## 完整的生产级配置示例

汇总一下，一个完整的配置大概长这样：

```nginx
# HTTP → HTTPS 跳转
server {
    listen 80;
    server_name app.example.com api.example.com;
    return 301 https://$host$request_uri;
}

# HTTPS 入口
server {
    listen 443 ssl http2;
    server_name app.example.com api.example.com;

    ssl_certificate /etc/letsencrypt/live/example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/example.com/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;

    # 安全头
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;

    # 前端应用
    location / {
        proxy_pass http://localhost:5173;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # API 服务
    location /api/ {
        proxy_pass http://localhost:3000/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # WebSocket 支持
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }

    # 静态资源缓存
    location /static/ {
        alias /var/www/static/;
        expires 30d;
        add_header Cache-Control "public, immutable";
    }
}
```

## 容易踩坑的地方

### 坑一：WebSocket 不工作

Nginx 默认不转发 WebSocket 的 Upgrade 头，需要显式声明：

```nginx
proxy_http_version 1.1;
proxy_set_header Upgrade $http_upgrade;
proxy_set_header Connection "upgrade";
```

### 坑二：请求体太大被截断

上传文件时 Nginx 有默认 1MB 限制，超了直接 413：

```nginx
client_max_body_size 50m;
```

放在 `http`、`server` 或 `location` 块里都行，范围不同。

### 坑三：后端获取不到真实 IP

后端服务看到的远程 IP 永远是 `127.0.0.1`（Nginx 的本地地址）。必须传 `X-Forwarded-For`：

```nginx
proxy_set_header X-Real-IP $remote_addr;
proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
proxy_set_header X-Forwarded-Proto $scheme;
```

后端也要做对应的处理。以 Express 为例装一个 `trust-proxy` 中间件：

```js
app.set('trust proxy', 1);
```

### 坑四：proxy_pass 超时

后端接口慢一点，Nginx 就 504 了：

```nginx
proxy_connect_timeout 60s;
proxy_read_timeout 60s;
proxy_send_timeout 60s;
```

### 坑五：502 Bad Gateway

后端服务没启动，或者端口写错了。先确认：

```bash
curl http://localhost:3000
```

如果本地 curl 都不通，说明问题不在 Nginx，在后端。

### 坑六：证书续期后忘记 reload

Let's Encrypt 证书 90 天有效期，自动续期后 Nginx 要 reload 才能加载新证书：

```bash
sudo systemctl reload nginx
```

可以把 reload 加到 cron 里：

```bash
0 3 * * * /usr/bin/certbot renew --quiet && /usr/bin/systemctl reload nginx
```

## 调试技巧

### 检查配置是否正确

```bash
sudo nginx -t
```

有语法错误会告诉你第几行有问题。

### 查看请求转发日志

在 location 块里加上：

```nginx
access_log /var/log/nginx/app-access.log;
error_log /var/log/nginx/app-error.log;
```

然后 tail 实时看：

```bash
tail -f /var/log/nginx/app-access.log
```

能看到每个请求最终被转发到了哪里。

### 检查后端是否收到请求

```bash
sudo tcpdump -i lo port 3000
```

如果 Nginx 配置正确，请求应该出现在本地回环接口上。

## 总结

| 场景 | 方案 |
| --- | --- |
| 多个服务共享一个端口 | 用 Nginx 做反向代理，路径转发或子域名转发 |
| 一张证书覆盖多个子域名 | 泛域名证书 `*.example.com` |
| 不同域名共用一张证书 | SAN 证书，申请时列出所有域名 |
| HTTP 跳转 HTTPS | `return 301 https://$host$request_uri` |
| WebSocket | 加上 Upgrade / Connection 头 |
| 获取真实客户端 IP | 传 X-Forwarded-For，后端 trust proxy |

配置 Nginx 反向代理跑通不难，难的是把各种边界情况想清楚。按上面的配置一步步来，一台服务器、一个 443 端口、一张证书，跑十几个服务不是问题。
