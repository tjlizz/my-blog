---
title: 从响应式到编译：Vue 2 和 Vue 3 的实现原理漫谈
date: 2026-06-09 12:00:00
categories:
  - 前端
tags:
  - Vue
  - Vue3
  - 响应式
  - 源码分析
  - JavaScript
cover:
description: 深入对比 Vue 2 和 Vue 3 的实现原理：从 Object.defineProperty 到 Proxy 的响应式进化，从全量 diff 到 PatchFlag 的编译优化，带你理解两代框架的设计哲学差异。
---

## 写在前面

如果你用过 Vue，大概记得那种感觉——在 data 里定义个变量，模板里绑上去，改了就变了。像变魔术。

但魔术师不会告诉你，Vue 2 和 Vue 3 的「魔术」根本不是同一套手法。

Vue 2 用的是一套老派但优雅的方案：`Object.defineProperty`。Vue 3 换了一套更底层、更暴力的方案：`Proxy`。

这不是简单的 API 升级。这是从「劫持属性」到「代理对象」的范式切换。

这篇文章不讲怎么用，讲的是**它们怎么做到的**。我带你把引擎盖打开。

---

## 故事的起点：什么是「响应式」？

先说结论：响应式的本质是 **「当数据变了，自动通知用到它的地方」**。

用代码表达就是：

```js
let price = 5
let quantity = 2
let total = price * quantity // 10

price = 20
// total 还是 10，不会自动变
```

我们希望什么？希望 `total` 自己知道：「哦，price 变了，我得重新算一下」。

这个朴素的需求，就是 Vue 响应式的起点。Vue 2 和 Vue 3 的回答完全不同。

---

## Vue 2：Object.defineProperty 的精细活

### 核心思路

Vue 2 的想法很直接：**你数据对象里的每个属性，我都给它装一个「监听器」**。

怎么装？靠 `Object.defineProperty`。

```js
function defineReactive(obj, key, val) {
  Object.defineProperty(obj, key, {
    get() {
      console.log(`读取了 ${key}，值是 ${val}`)
      return val
    },
    set(newVal) {
      if (newVal !== val) {
        console.log(`设置了 ${key}，新值是 ${newVal}`)
        val = newVal
        dep.notify()
      }
    }
  })
}
```

每当你写：

```js
data() {
  return {
    name: '张三',
    age: 25
  }
}
```

Vue 2 在初始化时会遍历这个对象，对 `name` 和 `age` 分别调用 `defineReactive`。**有多少属性，就调多少次。**

### 依赖收集：谁用了我？

光知道数据变了还不够，Vue 还得知道「谁用了这个数据」。这叫**依赖收集**。

Vue 2 里有一个全局的 `Dep` 类（Dependency），每个响应式属性都有一个 `dep` 实例。还有一个 `Watcher` 类——每个组件、每个 computed、每个 watch，都是一个 watcher。

流程是这样的：

1. 组件渲染时，创建一个 `Watcher`
2. 这个 `Watcher` 把自己赋值给一个全局变量 `Dep.target`
3. 组件开始读取 data 中的数据，触发 `get`
4. `get` 里发现 `Dep.target` 不为空，就把这个 watcher 加到自己的 dep 里
5. 数据变了，触发 `set`，`dep.notify()` 遍历所有 watcher，让它们重新执行

画成一条线就是：

```
data.name 被读取 → getter 触发 → dep.addSub(当前watcher) → watcher 被收集
data.name 被修改 → setter 触发 → dep.notify() → watcher 重新渲染
```

### Vue 2 的痛

这套机制在 2016 年是非常先进的。但它有**三个硬伤**：

**第一：新增/删除属性检测不到。**

因为 `Object.defineProperty` 是在初始化时就把属性写死了的。你后来加一个 `this.newProp = 123`，Vue 2 完全不知道。这就是为什么 Vue 2 提供了 `Vue.set()` 和 `Vue.delete()`——手动告诉它：「嘿，我加了个新属性，你监听一下。」

**第二：数组的坑。**

JavaScript 数组有 `.push()`、`.splice()` 这些变异方法。Vue 2 通过「拦截这些方法」来进行特殊处理。但如果你直接通过下标改数组 `arr[0] = xxx`，检测不到。又是一个需要 `Vue.set()` 的场景。

**第三：递归初始化开销大。**

Vue 2 初始化 data 的时候，会递归地遍历所有嵌套对象，对每一层的每个属性都调用 `defineReactive`。如果 data 层级很深、字段很多，初始化本身就会有性能开销。而且**不管这个属性会不会被用到**，都先装上监听器。

```js
data: {
  user: {
    profile: {
      name: '...',
      address: {
        city: '...',
        street: '...'
      }
    }
  }
}
```

Vue 2 会在初始化时挨个把 `user`、`profile`、`name`、`address`、`city`、`street` 全都走一遍 `defineReactive`。**哪怕模板里只用了一个 `city`。**

---

## Vue 3：Proxy 带来的一场革命

### 从「劫持属性」到「代理对象」

Vue 3 的核心改变就一句话：**不再代理每一个属性，而是直接代理整个对象。**

`Object.defineProperty` 是在属性层面做手脚——你得一个个来。

`Proxy` 是在对象层面做手脚——你只要代理了对象，不管读什么属性、写什么属性、删什么属性，都逃不过 Proxy 的拦截。

```js
function reactive(target) {
  return new Proxy(target, {
    get(target, key, receiver) {
      track(target, key) // 依赖收集
      return Reflect.get(target, key, receiver)
    },
    set(target, key, value, receiver) {
      Reflect.set(target, key, value, receiver)
      trigger(target, key) // 触发更新
      return true
    },
    deleteProperty(target, key) {
      const result = Reflect.deleteProperty(target, key)
      trigger(target, key) // 删除也能触发！
      return result
    }
  })
}
```

注意看——**没有遍历，没有递归**。你写了一个属性叫 `name`，你读了它，get 被拦截；你写了一个新属性叫 `email`，set 被拦截——完全不需要初始化时提前声明。

Vue 2 里 `Vue.set()` 和 `Vue.delete()` 的存在意义，到这里直接消失了。

### 懒响应式

Vue 3 还有一个很重要的设计：**懒响应式**。

所谓懒响应式，就是**等你真正用到某个深层属性的时候，才把它变成响应式的**。

```js
const state = reactive({
  user: {
    profile: {
      name: '张三'
    }
  }
})
```

Vue 3 在初始化时，只在 `state` 上层放了一个 Proxy。**它不会递归到 `user.profile` 去**。

那么 `state.user.profile.name` 什么时候变成响应式的？

答：**当你读取 `state.user` 的时候。**

当你访问 `state.user`，Proxy 的 `get` 被触发，发现返回值 `target.user` 是一个对象，**这时候再对它递归调用 `reactive()`**。也就是：

```
读取 state.user → 触发 get → 发现 user 是对象 → 调用 reactive(user) → 返回 Proxy(user)
```

这样就把「响应化」这件事从初始化时一次性做完，变成了**按需执行**。如果一个深层属性从来没人读过，它就永远不会被包装成 Proxy。

这就叫**懒**——不做无用功。

### 依赖收集的新架构

Vue 3 的依赖收集也重写了。核心是三个数据结构：`targetMap`、`depsMap`、`dep`。

- `targetMap`：WeakMap，以响应式对象为 key
- `depsMap`：Map，以属性名为 key
- `dep`：Set，存放 effect 函数

```js
const targetMap = new WeakMap()

function track(target, key) {
  let depsMap = targetMap.get(target)
  if (!depsMap) {
    depsMap = new Map()
    targetMap.set(target, depsMap)
  }
  let dep = depsMap.get(key)
  if (!dep) {
    dep = new Set()
    depsMap.set(key, dep)
  }
  dep.add(activeEffect)
}

function trigger(target, key) {
  const depsMap = targetMap.get(target)
  if (!depsMap) return
  const dep = depsMap.get(key)
  if (dep) {
    dep.forEach(effect => effect())
  }
}
```

这一套比 Vue 2 的 `Dep` + `Watcher` 更轻量。Vue 3 的 `effect` 函数本质上就是 Vue 2 的 `Watcher`，但是更纯粹——就是一个会重新执行的函数，没有类的负担。

而且，因为用了 WeakMap，**响应式对象如果被垃圾回收了，它的依赖映射也会自动被回收**。Vue 2 做不到这一点。

---

## 虚拟 DOM 的进化

响应式只是 Vue 的一半。另一半是渲染。

### Vue 2 的虚拟 DOM

Vue 2 的虚拟 DOM 用的是**常规 diff 算法**——逐层比较新旧两棵虚拟节点树，找出差异，然后打补丁。

核心流程：

```
渲染函数 → 生成 VNode → 和旧的 VNode diff → 找出差异 → patch 到真实 DOM
```

Vue 2 的 diff 做的是**全量比较**。每次更新，它会重新执行整个渲染函数，生成一棵完整的 VNode 树，然后和旧的整棵树做 diff。

如果组件树很大，这个过程就会比较重。即使只有一个子组件变了，父组件还是要跑一遍渲染函数，产生一整棵新的 VNode 树。

### Vue 3 的编译优化

Vue 3 没有停留在「全量 diff」的层面。它做了两件大事：**静态提升**和**动态标记**。

#### 静态提升

看这段模板：

```html
<div>
  <span>固定文本</span>
  <span>{{ msg }}</span>
</div>
```

在 Vue 2 里，每次渲染 `固定文本` 这个 span 都要新创建一个 VNode。

在 Vue 3 里，编译器会把它**提升到渲染函数之外**，创建一次，之后复用。

```js
const _hoisted_1 = _createVNode("span", null, "固定文本", 1)

function render() {
  return _createVNode("div", null, [
    _hoisted_1,
    _createVNode("span", null, _toDisplayString(msg), 1)
  ])
}
```

#### 动态标记（PatchFlags）

更有意思的是 PatchFlag。

Vue 3 的编译器能在编译阶段就分析出**哪些部分是动态的**，然后给 VNode 打上标记：

```js
_createVNode("span", null, _toDisplayString(msg), 1 /* TEXT */)
```

最后一个参数 `1` 就是 PatchFlag，表示「这个节点的文本内容是动态的」。

diff 的时候看到这个 flag，就知道**只比较文本内容**，不用去比较 props、children、class 这些。

```
// 1  → 动态文本
// 2  → 动态 class
// 4  → 动态 style
// 8  → 动态 props
// 16 → 动态 props + 有 key
// 32 → 有事件监听
// 64 → 是 vnode 自身的 children
// 128 → 被标记为动态的 slot
```

打个比方：Vue 2 的 diff 像是对着两张照片逐像素比较找出不一样的地方；Vue 3 的 diff 则是在拍照的时候就标注了「这个人待会儿可能会眨眼」，然后更新时只看那个区域。

#### Block Tree

还有一种情况：带有 `v-if` 或 `v-for` 的模板，节点结构会变化。Vue 3 引入了 Block Tree 来处理。

每个动态节点都会被收集到它所在的「块」（block）里。diff 时直接遍历块的动态节点数组，跳过静态节点。

```html
<div>
  <p>静态</p>
  <p v-if="show">动态</p>
</div>
```

编译器会创建一个 block，把 `v-if` 的那个 `<p>` 标记为动态节点并收集到 block 的动态节点数组中。diff 时直接操作这个数组——**复杂度从 O(n) 变成了 O(动态节点数)**。

---

## Composition API 与 setup

Vue 2 用的是 Options API：

```js
export default {
  data() { ... },
  computed: { ... },
  methods: { ... },
  watch: { ... }
}
```

每个功能都被分散在不同的 option 里。一个功能涉及多段逻辑的时候，你不得不在 data、computed、methods、watch 之间来回跳转。这就是 Vue 2 的**碎片化问题**。

Vue 3 的 Composition API 则：

```js
export default {
  setup() {
    const count = ref(0)
    const doubled = computed(() => count.value * 2)

    function increment() {
      count.value++
    }

    return { count, doubled, increment }
  }
}
```

同一段逻辑聚在一起。更关键的是，`ref` 和 `reactive` 这些响应式 API 是**独立的、可组合的**。你可以把它们提取到单独的文件里，跨组件复用：

```js
// useCounter.js
export function useCounter() {
  const count = ref(0)
  function increment() { count.value++ }
  return { count, increment }
}

// 任何组件都可以用
setup() {
  const { count, increment } = useCounter()
  return { count, increment }
}
```

这不仅解决了碎片化问题，也让逻辑复用从 Vue 2 的 mixin（命名冲突、来源不明）进化到了更干净的**组合函数**模式。

---

## 编译与运行时深度结合

把 Vue 2 和 Vue 3 放在一起比较，你会发现一个趋势：**Vue 3 把更多工作从运行时挪到了编译时**。

| 维度 | Vue 2 | Vue 3 |
| --- | --- | --- |
| 响应式 | 运行时，Object.defineProperty | 运行时，Proxy |
| 模板编译 | 生成渲染函数 | 生成渲染函数 + PatchFlag + 静态提升 |
| Diff 策略 | 全量比较 | 带标记的靶向更新 |
| 类型支持 | 不友好 | 用 TypeScript 重写，天然支持 |
| 包体积 | monolith | tree-shakable，按需引入 |

Vue 2 是个优秀的运行时框架。Vue 3 则更像一个**编译框架 + 轻量运行时**的组合体。编译器替运行时做了大量预分析，运行时只做编译器告诉它必须做的事。

这也是为什么 Vue 3 在体积更小的同时（tree-shaking 后核心约 10KB），性能反而更好的原因。

---

## 写在最后

Vue 2 到 Vue 3，不是补丁式的升级。它是把「对象劫持」彻底换成「对象代理」，把「全量 diff」换成「定向更新」，把「运行时兜底」换成「编译期预判」。

Vue 2 在它那个时代是大师级的设计——用纯 JavaScript 在一个几乎没有原生 Proxy 支持的环境里，硬是做了一套可用的响应式系统。而 Vue 3 则是尤雨溪在 ES6 Proxy 成熟之后的重新思考：**如果从头设计，我会怎么做？**

答案是一个更简洁、更高效、更彻底的框架。

如果你是 Vue 2 用户，读一读 Vue 3 的实现，你会理解那些「为什么 Vue 3 有这个 API」、「为什么那样写会报错」、「为什么这个性能更好」背后的根本原因。如果你还没用过 Vue，直接上 Vue 3。它的设计比 2 更接近 JavaScript 本身——`reactive` 就是 `new Proxy`，`ref` 就是一个包装了 getter/setter 的对象。没有黑魔法。

这是框架的进化，也是 JavaScript 语言自身进化的一个注脚。
