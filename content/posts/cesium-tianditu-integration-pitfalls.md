---
title: Cesium 接入天地图影像的几个坑：img_w、tileMatrixSetID、注记图层和 token 配置
date: 2026-06-01 15:00:00
categories:
   - GIS
tags:
   - Cesium
   - 天地图
   - WebGIS
   - 三维地球
   - 踩坑记录
cover:
description: Cesium三维地球接入天地图WMTS服务的实战踩坑记录：img_w参数、tileMatrixSetID、注记图层叠加与token配置。
---

## 一个看似简单的需求

事情开始得很普通。

项目需要在 Cesium 三维地球上显示国内城市的卫星影像底图。默认的 Bing Maps 影像在国内加载慢，而且行政边界和地名标注不符合国内项目的要求。

方案很明确——换成天地图。国家地理信息公共服务平台，数据权威，国内访问快，免费。

然后我花了一天时间，在四个地方卡住。

这篇文章不是什么"三分钟快速接入"教程。是把我踩过的坑、排查的思路、最终能稳定运行的技术方案，一次说清楚。如果你也在做 Cesium + 天地图的集成，应该能帮你省掉大半天的时间。

<!-- more -->

## 场景：为什么非要用天地图

先交代一下项目背景，方便你判断后面的内容是否对你有用。

这是一个智慧城市管理平台，Cesium 作为三维底座，上面叠加了建筑白模、实时传感器数据和规划红线。需求很明确：

- 底图必须是国内权威地图源，满足政务项目数据合规要求
- 影像要清晰，更新不能太旧（Bing Maps 在一些区域是两三年前的影像）
- 要有地名注记，但不喧宾夺主
- 加载速度要快，不能拖慢整个场景的初始化

天地图天然满足前两个条件。但接入过程中，几个技术细节坑了不少人。

## 坑一：img_w 还是 img_c——投影的陷阱

这是第一个坑，也是最容易踩的。

天地图的在线服务分两套投影：

| 后缀 | 投影 | EPSG | Cesium 默认支持 |
|------|------|------|:---:|
| `_w` | Web Mercator | EPSG:3857 | ✅ 直接支持 |
| `_c` | 经纬度 (Lat/Lon) | EPSG:4326 | ⚠️ 需额外配置 |

两种投影天地图都提供，对应不同的瓦片组织方式。

### 踩坑现场

我第一次接入时，在网上随便找了一段代码：

```javascript
const provider = new Cesium.UrlTemplateImageryProvider({
  url: 'https://t0.tianditu.gov.cn/DataServer?T=img_c&x={x}&y={y}&l={z}&tk=' + token,
  tilingScheme: new Cesium.WebMercatorTilingScheme(),
  maximumLevel: 18
});
```

结果——地图能出来，但位置偏了。瓦片偏移，在三维球上明显错位。

原因是 `img_c` 用的是经纬度投影（EPSG:4326），而我却告诉 Cesium 这是 Web Mercator 投影。投影不匹配，瓦片坐标就全错了。

### 解决方案

**方法一：用 `img_w`（推荐）**

```javascript
const provider = new Cesium.UrlTemplateImageryProvider({
  url: 'https://t{s}.tianditu.gov.cn/DataServer?T=img_w&x={x}&y={y}&l={z}&tk=' + token,
  subdomains: ['0', '1', '2', '3', '4', '5', '6', '7'],
  tilingScheme: new Cesium.WebMercatorTilingScheme(),
  maximumLevel: 18
});
```

`img_w` 是 Web Mercator 投影，与 Cesium 默认的 `WebMercatorTilingScheme` 天然匹配。一行不改，直接跑。

**方法二：用 `img_c` + 匹配的 TilingScheme**

如果项目确实需要经纬度投影（比如需要精确的经纬度坐标对齐），把 TilingScheme 换成 `GeographicTilingScheme`：

```javascript
const provider = new Cesium.UrlTemplateImageryProvider({
  url: 'https://t{s}.tianditu.gov.cn/DataServer?T=img_c&x={x}&y={y}&l={z}&tk=' + token,
  subdomains: ['0', '1', '2', '3', '4', '5', '6', '7'],
  tilingScheme: new Cesium.GeographicTilingScheme(),
  maximumLevel: 18
});
```

两种投影都能用，关键是**你的 TilingScheme 必须和瓦片服务保持一致**，不是随便抄代码就能跑通的。

这个坑的根本原因：很多人不知道天地图同时提供两套投影的服务，网上代码混着抄，抄到 `_c` 的 URL 配了 `_w` 的投影，或者反过来。

## 坑二：tileMatrixSetID——WMTS 方式的隐藏参数

如果你用 `UrlTemplateImageryProvider`（上面那种方式），不会碰到这个问题。但如果你用标准 WMTS 协议接入——比如用 `WebMapTileServiceImageryProvider`——`tileMatrixSetID` 就是一个必填且极易配错的参数。

```javascript
// WMTS 方式接入天地图影像
const provider = new Cesium.WebMapTileServiceImageryProvider({
  url: 'https://t0.tianditu.gov.cn/img_w/wmts?tk=' + token,
  layer: 'img',
  style: 'default',
  format: 'tiles',
  tileMatrixSetID: 'w',    // ← 这个值容易配错
  maximumLevel: 18
});
```

### 踩坑现场

tileMatrixSetID 的取值规则其实很简单：

- `_w` 系列 → `tileMatrixSetID: 'w'`
- `_c` 系列 → `tileMatrixSetID: 'c'`

但很多人写成了 `EPSG:3857`、`GoogleMapsCompatible`、`WGS84` 之类的值，结果瓦片加载不出来，控制台报 404。

原因是：**天地图的 WMTS 服务使用的 tileMatrixSet 名称就是单字母 `w` 或 `c`，不是 OGC 标准中常见的完整命名。** 你用标准 OGC 名称去请求，天地图不认识。

另外注意，`url` 后缀和 `tileMatrixSetID` 必须配套：

```javascript
// ✅ 正确配对
// _w 后缀 + tileMatrixSetID: 'w'
url: 'https://t0.tianditu.gov.cn/img_w/wmts?tk=' + token,
tileMatrixSetID: 'w'

// ✅ 正确配对  
// _c 后缀 + tileMatrixSetID: 'c'
url: 'https://t0.tianditu.gov.cn/img_c/wmts?tk=' + token,
tileMatrixSetID: 'c'

// ❌ 错误：_w 的 URL 配了 c
tileMatrixSetID: 'c'
// → 服务返回 404 或空瓦片
```

### 什么场景需要 WMTS 方式

`UrlTemplateImageryProvider` 简单粗暴，能跑。但 WMTS 方式更标准，在某些场景下更有优势：

- 需要对接标准 OGC WMTS 客户端
- 需要精确控制瓦片矩阵参数（如分辨率、比例尺）
- 需要通过 GetCapabilities 元数据自动发现服务信息
- 对 Cesium 内部瓦片请求机制的兼容性要求更高

大多数项目用 URL Template 方式就够了。只有遇到具体的兼容性问题时，才需要考虑切到 WMTS 方式。

## 坑三：注记图层的叠加问题

天地图的影像底图（卫星照片）本身没有地名标注。要显示地名、道路名称，必须叠加一个**注记图层**。

技术上是两个独立的 WMTS 服务，叠加显示：

```
底层：img_w  （卫星影像）
上层：cia_w  （影像注记）
```

### 踩坑现场

**坑 3.1：图层顺序反了**

```javascript
viewer.imageryLayers.addImageryProvider(imgProvider);   // 影像
viewer.imageryLayers.addImageryProvider(ciaProvider);    // 注记
```

Cesium 的图层渲染顺序是从底到顶：先加的在下层，后加的在上层。

如果你先加影像再加注记，注记显示在影像上面——这是对的。但如果你切换了添加顺序，或者中途用 `addImageryProvider` 和 `addImageryLayer` 混用，顺序就可能乱。

注记被影像盖住，什么都看不见。

**坑 3.2：投影不匹配**

影像用 `img_w`（Web Mercator），注记用 `cia_w`（也是 Web Mercator），这没问题。

但有些人影像用了 `img_w`，注记用了 `cia_c`，投影不一致，导致注记位置偏移。

记住一条原则：**影像和注记的投影必须一致。** `img_w` + `cia_w`，或者 `img_c` + `cia_c`，不要混搭。

**坑 3.3：跨域与白图**

有些版本的 Cesium 加载注记图层时，特定缩放级别下会出现白图或空瓦片。原因比较复杂，可能是天地图服务端的切片边界与 Cesium 请求的 tile 坐标存在微小偏差。解决方案是确认 `minimumLevel` 和 `maximumLevel` 设置正确，天地图注记一般从 1 到 18 级都可用。

### 正确的叠层方式

```javascript
// 1. 影像底图
const imgLayer = viewer.imageryLayers.addImageryProvider(
  new Cesium.UrlTemplateImageryProvider({
    url: 'https://t{s}.tianditu.gov.cn/DataServer?T=img_w&x={x}&y={y}&l={z}&tk=' + token,
    subdomains: ['0', '1', '2', '3', '4', '5', '6', '7'],
    tilingScheme: new Cesium.WebMercatorTilingScheme(),
    maximumLevel: 18
  })
);

// 2. 注记图层（在影像之上）
const annoLayer = viewer.imageryLayers.addImageryProvider(
  new Cesium.UrlTemplateImageryProvider({
    url: 'https://t{s}.tianditu.gov.cn/DataServer?T=cia_w&x={x}&y={y}&l={z}&tk=' + token,
    subdomains: ['0', '1', '2', '3', '4', '5', '6', '7'],
    tilingScheme: new Cesium.WebMercatorTilingScheme(),
    maximumLevel: 18
  })
);

// 3. （可选）调整注记透明度
annoLayer.alpha = 0.8; // 让注记不那么生硬地贴在影像上
```

## 坑四：Token 配置——从申请到调用的所有细节

这是最基础但也最容易出问题的一环。

### 4.1 应用类型必须选"浏览器端"

去 [天地图官网](http://www.tianditu.gov.cn/) 注册 → 控制台 → 创建应用。最关键的一步：

**应用类型必须选"浏览器端"。**

天地图现在严格区分应用类型：

| 应用类型 | Referer 校验 | 适用场景 |
|---------|:----------:|---------|
| 浏览器端 | ✅ 校验 Referer | 前端 JS 直接调用（Cesium、Leaflet、OpenLayers） |
| 服务端 | ❌ 不校验 | 后端服务代理请求 |
| Android/iOS | 平台绑定 | 移动端原生应用 |

如果你选了"服务端"的 token 放到 Cesium 前端代码里，请求会返回 403——因为天地图服务端会校验 `Referer` 头，服务端 token 和浏览器端的 Referer 模式不匹配。

### 4.2 IP 白名单和域名白名单

创建应用时可以配置"IP 白名单"和"Referer 白名单"。

- **IP 白名单：** 只有列表里的 IP 能调用。对前端应用不适用（用户端 IP 不固定）
- **Referer 白名单：** 只有指定域名来源的请求能通过。建议开发阶段填 `*`，上线前换成你的具体域名

如果配置了 Referer 白名单但忘填 `localhost`，本地开发直接 403。这是本地调试最常见的翻车点。

### 4.3 HTTP 和 HTTPS

天地图现在支持 HTTPS 访问，URL 统一用 `https://t{s}.tianditu.gov.cn/...`。

如果你的站点是 HTTPS，但加载天地图用了 HTTP 地址，浏览器会报混合内容警告（Mixed Content），瓦片可能被浏览器拦截。直接用 HTTPS 地址就能解决。

### 4.4 Token 泄露风险

Token 直接写在前端代码里，等于公开了。天地图的 token 目前只做调用量限制和来源校验，不涉及敏感权限，风险相对可控。但如果你有调用量限制的担忧，建议：

- 开发环境用自己的 token
- 生产环境通过后端代理转发，不要在前端暴露 token
- 定期更换 token

### 4.5 完整的 token 配置检查清单

如果天地图加载不出来，按这个顺序排查：

```
□ 应用类型是否选了"浏览器端"？
□ Referer 白名单是否包含当前域名？
□ 域名写的是 https 还是 http？
□ 当前浏览器是否限制了 Referer 头（少数隐私模式会）？
□ Token 字符串是否完整复制（注意不要漏掉末尾字符）？
□ MaximumLevel 是否设置正确？
```

## 完整代码：能直接跑的方案

最后贴一个完整的、经过验证的代码片段，Vue 3 + Cesium：

```vue
<template>
  <div id="cesiumContainer" ref="container"></div>
</template>

<script setup>
import * as Cesium from 'cesium';
import { onMounted, ref } from 'vue';

const container = ref(null);
const TDT_TOKEN = '你的天地图浏览器端Key';

onMounted(() => {
  const viewer = new Cesium.Viewer(container.value, {
    baseLayerPicker: false,
    geocoder: false,
    homeButton: true,
    sceneModePicker: true,
    navigationHelpButton: false,
    animation: false,
    timeline: false,
    fullscreenButton: false,
    infoBox: false
  });

  // 移除 Cesium 默认底图
  viewer.imageryLayers.removeAll();

  // 天地图影像底图
  const baseLayer = viewer.imageryLayers.addImageryProvider(
    new Cesium.UrlTemplateImageryProvider({
      url: 'https://t{s}.tianditu.gov.cn/DataServer?T=img_w&x={x}&y={y}&l={z}&tk=' + TDT_TOKEN,
      subdomains: ['0', '1', '2', '3', '4', '5', '6', '7'],
      tilingScheme: new Cesium.WebMercatorTilingScheme(),
      maximumLevel: 18,
      minimumLevel: 1
    })
  );

  // 天地图注记图层
  const annoLayer = viewer.imageryLayers.addImageryProvider(
    new Cesium.UrlTemplateImageryProvider({
      url: 'https://t{s}.tianditu.gov.cn/DataServer?T=cia_w&x={x}&y={y}&l={z}&tk=' + TDT_TOKEN,
      subdomains: ['0', '1', '2', '3', '4', '5', '6', '7'],
      tilingScheme: new Cesium.WebMercatorTilingScheme(),
      maximumLevel: 18,
      minimumLevel: 1
    })
  );
  annoLayer.alpha = 0.85;

  // 定位到广州
  viewer.camera.setView({
    destination: Cesium.Cartesian3.fromDegrees(113.264, 23.129, 50000)
  });
});
</script>

<style>
* { margin: 0; padding: 0; }
#cesiumContainer { width: 100vw; height: 100vh; }
</style>
```

## 总结

天地图作为国内 GIS 项目的标配底图源，接入本身不复杂。但对 Cesium 不熟悉的人，容易在这四个点上卡住：

1. **`img_w` vs `img_c`** ——投影决定一切。Cesium 默认 Web Mercator，用 `img_w` 少填一个坑
2. **`tileMatrixSetID`** ——WMTS 方式接入时，值是单字母 `w` 或 `c`，不是标准命名
3. **注记图层** ——与底图投影一致、图层顺序正确、透明度调好，效果就不差
4. **Token 配置** ——浏览器端、Referer 白名单、HTTPS，十分钟能搞定但查错可能花一小时

这些坑的共性是：**代码不多，但错了一个参数就全盘翻车。** 排查的时候，从参数校验入手往往比从代码逻辑入手更快。

希望这份记录能让你在集成天地图时少走点弯路。
