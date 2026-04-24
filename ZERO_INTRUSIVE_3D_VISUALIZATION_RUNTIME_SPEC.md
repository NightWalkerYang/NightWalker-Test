# 零侵入 3D 可视化大屏运行规范

本文档用于约束“成员侧 `可视化展示` 菜单加载的 3D / 粒子 / 高级可视化大屏”应如何交付，目标不是提示词，而是保证 AI 生成出来后能够在当前零侵入桥接链路中稳定运行。

适用范围：

- 成员侧边栏 `可视化展示` 菜单
- 工作区下 `Echarts/*_index.html` 与 `Echarts/*_index.dashboard.json` 入口页
- 公开路由 `./echarts-view/?token=...`
- 零侵入桥接层对 HTML、脚本、资源路径的重写链路

## 一、当前实现的真实运行方式

当前成员可视化不是直接打开工作区文件，而是走这条链路：

1. 成员菜单扫描当前已分配 Agent 工作区下的 `Echarts/*_index.html` 与 `Echarts/*_index.dashboard.json`
2. 点击后进入公开路由 `./echarts-view/?token=...`
3. sidecar 根据入口类型走两条不同链路
4. `*_index.html` 会继续走 HTML 重写、资源改写、内联脚本外提
5. `*_index.dashboard.json` 会被转换成固定 wrapper HTML，并加载零侵入 `dashboard-manifest` runtime
6. 最终页面都以字符串形式塞进全屏 iframe 的 `srcdoc`
7. 页面在同源公开环境中运行

因此，“能不能跑”主要由下面几个因素决定：

- 入口文件命名是否符合扫描规则
- 资源是否是同源静态资源
- 生成物是否适合被 `srcdoc + 路径重写 + 内联脚本外提` 这条链路承载
- 是否依赖当前桥接层不会自动处理的运行时能力

## 二、硬性入口规则

### 1. 入口文件必须在 `Echarts` 根目录

成员菜单当前只扫描：

- `Echarts/*_index.html`
- `Echarts/*_index.dashboard.json`

不扫描：

- `Echarts/pages/*.html`
- `Echarts/app/index.html`
- 其它非 `_index.html` 或 `_index.dashboard.json` 结尾的页面

推荐做法：

```text
Echarts/
  finance_overview_index.html
  risk_command_index.html
  assets/
    images/
    textures/
    models/
  bundles/
    finance_overview.bundle.js
    risk_command.bundle.js
```

### 2. 入口页必须是可独立打开的静态 HTML

入口页不能依赖：

- dev server
- 本地构建进程
- npm install 后即时运行
- CDN 才能加载的外链资源

入口页必须在工作区中以静态文件形式完整存在。

### 3. 只能使用同源资源

允许：

- `/assets/vendor/...`
- `/assets/runtime/...`
- `./bundles/...`
- `./assets/...`
- 当前工作区下其它相对静态资源

不允许作为默认交付方式：

- `https://cdn...`
- `https://unpkg...`
- `https://esm.sh...`
- 其它公网脚本依赖

### 4. 当前已经内置的 vendor 资源

当前零侵入层已经预装这些本地公开资源，可以直接让 AI 生成时引用：

- `/assets/vendor/echarts.min.js`
- `/assets/vendor/echarts-gl.min.js`
- `/assets/vendor/gsap.min.js`
- `/assets/vendor/pixi.min.js`
- `/assets/vendor/babylon.js`
- `/assets/vendor/tsparticles.bundle.min.js`
- `/assets/vendor/three.module.min.js`
- `/assets/vendor/three/examples/jsm/**`

其中 `three/examples/jsm/**` 已经做过浏览器直连修补，常见 addon 不再依赖裸 `three` 包名。

## 三、桥接层当前稳定支持的能力

### 1. 稳定支持

- 普通 HTML 页面
- 普通 `<script src="...">`
- 普通内联 `<script>`
- 普通 `onclick` / `onchange` 等内联事件
- 普通相对 `img/src`、`a/href`、`video/poster`、`object/data`
- 同目录或子目录静态资源
- 多个 `*_index.html` 之间的跳转
- 带中文、空格、括号等不安全文件名的脚本和部分资源别名复制

### 2. 桥接层会自动处理的事情

- 把内联脚本外提到 `Echarts/__openclaw_echarts_view__.../`
- 把相对资源路径改成同源公开路径
- 把 `fetch/open/location/href/src` 这类脚本中出现的相对 URL 做重写
- 把大屏内部跳到另一个 `*_index.html` 的动作改成顶层公开路由跳转

### 3. 不要误判为“自动支持”的能力

当前桥接层不是完整 bundler，不会自动理解整个前端工程生态。

它默认不帮你处理下面这些模式：

- `import ... from "./x.js"` 的 ESM 依赖图
- `dynamic import("./x.js")`
- `new Worker("./worker.js")`
- `new SharedWorker("./worker.js")`
- `new URL("./x", import.meta.url)`
- import map
- service worker
- wasm 额外装载链路
- 需要运行时自动解析 bare specifier 的模块系统

这些模式不是绝对不能做，而是不能指望当前桥接层帮你兜底。

## 四、推荐交付形态

### A. 第一推荐：dashboard manifest

从当前实现开始，最稳的交付方式已经不是让 AI 自由输出整页 HTML，而是让 AI 产出：

- `Echarts/xxx_index.dashboard.json`
- 可选本地数据文件，例如 `data.json`

然后由零侵入 `dashboard-manifest` runtime 统一负责：

- 固定全屏布局
- HUD 风格面板
- 中央 3D 主场景
- ECharts 图表区
- GSAP / tsParticles 动效层

这条链路的意义是把“高级感”和“可运行性”收回到平台零侵入层，而不是寄希望于 AI 每次都手写出稳定 HTML。

当前 `dashboard-manifest` runtime 已经支持的主字段如下：

- `version`
- `template`
  当前默认模板：`financial-command-center-v1`
- `title`
- `subtitle`
- `theme`
- `backgroundImage`
- `logoText`
- `logoImage`
- `scene`
  目前内置场景：`capital-reactor`、`asset-ring`、`radar-core`
  如需完全自定义，也允许直接提供 `scene.option` 原始 ECharts-GL option
  但要注意：如果自定义 `scene.option` 在当前 `echarts-gl` 运行时里报错，零侵入 runtime 会自动降级到内置兼容 3D 场景；如果兼容 3D 仍失败，再降级到 2D 兼容图，目标优先级始终是“页面可渲染成功”
- `metrics`
- `charts.leftTop`
- `charts.leftBottom`
- `charts.rightTop`
- `charts.rightBottom`
  每个 panel 当前支持：
  `line`、`bar`、`pie`、`radar`、`ranking`、`table`、`stat`
  如需完全自定义，也允许直接提供 `chart.option` 原始 ECharts option
- `timeline`
- `alerts`
- `navigation`
  可通过 `targetFileName` 指向同 Agent 下其它可视化入口
- `dataSource`
  可以是同工作区下的本地 JSON 路径，由 runtime 在浏览器侧同源加载并合并到 manifest
  也可以是对象型内嵌元数据，此时 runtime 不会发起额外 fetch，而是直接按当前 manifest 继续渲染

### B. 第二推荐：单 HTML + 单 JS Bundle

这是在旧 HTML 入口链路里当前最稳的交付方式。

```text
Echarts/
  finance_3d_index.html
  finance_3d.bundle.js
  finance_3d.data.js
  assets/
    textures/
    images/
```

特征：

- HTML 只负责挂载容器和引入 bundle
- 所有业务代码和第三方依赖尽量打进一个 bundle
- 不依赖浏览器再去递归加载模块图

适合：

- Three.js 预打包
- Babylon.js 预打包
- PixiJS 预打包
- GSAP
- ECharts / ECharts-GL

### C. 第三推荐：单 HTML + 少量同源脚本

```html
<script type="module" src="./risk_scene.js"></script>
<script src="/assets/vendor/echarts.min.js"></script>
<script src="/assets/vendor/echarts-gl.min.js"></script>
<script src="/assets/vendor/gsap.min.js"></script>
```

适合：

- 已经准备好稳定的 vendor 静态资源
- 脚本数量少
- 不需要模块解析

### D. 第四推荐：预构建 SPA 静态产物，但必须收敛成单入口静态包

允许 AI 先写 React/Vue/Svelte，再由你们自己打包后落进 `Echarts/`。

但交付时必须满足：

- 不再依赖开发服务器
- 不再有裸模块导入
- 最好关闭代码分割，或把所有 chunk 明确落到同目录可静态访问
- 不使用 service worker

## 五、库选择建议

### 第一梯队：最值得投入

- `Three.js`
  适合做主场景、粒子、镜头飞行、空间透视、全息 HUD
  要求：预打包，避免直接输出复杂 `jsm` 模块图

- `Babylon.js`
  适合做更重的科幻场景、粒子、后处理、体积光、材质表现
  要求：优先单 bundle 或稳定脚本引入

- `PixiJS`
  适合做 2.5D 粒子、雷达、流光、HUD、能量流特效
  要求：优先单 bundle

- `GSAP`
  适合做镜头、面板、数字、粒子节奏动画

- `ECharts`
  继续作为图表层和钻取层

### 第二梯队：有条件可用

- `ECharts-GL`
  可以做 3D 图表增强，但不建议单独承担整页视觉引擎角色

- `React / Vue / Svelte`
  可以用，但最终产物必须是静态可部署包，而不是源码工程

- `MapLibre GL JS`
  做地图 / 园区 / 楼宇可视化可行，但要注意额外样式、字体、精灵图等静态资源一并落地

### 第三梯队：当前默认高风险

- `deck.gl`
  本身适合大数据地图可视化，但经常伴随额外依赖和更复杂工程化产物

- `Cesium`
  资源体积、静态目录、worker、asset base url 约束都更重，不建议作为第一批 AI 自动生成目标

## 六、当前明确不推荐的生成模式

### 1. 不推荐：让 AI 直接输出未打包的 ESM 工程

例如：

```html
<script type="module">
  import * as THREE from "./node_modules/three/build/three.module.js";
</script>
```

问题：

- 内联模块脚本会被桥接层外提
- 外提后相对 `import` 基准路径变了
- 后续模块图不会被桥接层统一改写

### 2. 不推荐：依赖动态分包

例如：

- `import("./charts.js")`
- React/Vite 默认多 chunk 输出但没控制路径

问题：

- 公开页桥接层不会替你接管动态模块解析
- 运行时 chunk 漏一个就白屏

### 3. 不推荐：依赖 Worker 的方案作为第一批默认方案

例如：

- 地图 worker
- 3D 引擎附带 worker
- 数据计算 worker

问题：

- `new Worker("./x.js")` 当前不在默认重写名单里
- 很容易在 `srcdoc` 里路径失效

### 4. 不推荐：依赖公网资源

问题：

- 内网环境不稳定
- 部署环境可能限网
- 分享页的外部依赖不可控

## 七、推荐的运行契约

以后让 AI 生成大屏时，默认要求它满足下面这份契约。

### 页面结构契约

- 入口文件名必须为 `*_index.html`
- 入口文件位于 `Echarts/` 根目录
- 页面尺寸默认 `1920x1080`
- 页面必须能在单文件静态环境中启动

### 脚本契约

- 优先普通 `<script src="...">`
- 优先单 bundle
- 不使用 CDN
- 不依赖 import map
- 不依赖 worker
- 不依赖 service worker
- 不使用裸模块导入

### 资源契约

- 图片、纹理、模型、音频统一放本地
- 文件名优先 ASCII
- CSS 中的 `url(...)` 也必须是稳定的同源静态路径

### 数据契约

优先级从高到低：

1. 本地 `data.js`
2. 本地 `data.json`
3. 公开同源签名接口

不推荐默认使用：

- 需要成员私有登录态的额外接口
- 跨域数据接口

### 导航契约

- 同一个工作区内的多张大屏可以互相跳转
- 跳转目标仍然使用 `*_index.html`
- 不要求手工拼公开 token 链接，桥接层会转换

## 八、推荐的技术路线

### 路线 1：Three.js + ECharts + GSAP

适合：

- 集团总览
- 财务驾驶舱
- 风险中枢
- 黑金高管舱

运行建议：

- Three.js 预打包成单 bundle
- ECharts 单独通过同源脚本引入或一起打包
- 所有纹理、本地图片落在 `Echarts/assets/`

### 路线 2：Babylon.js + ECharts

适合：

- 科幻舱
- 数字孪生中枢
- 能量核心场景
- 体积光和粒子偏重的大屏

运行建议：

- 引擎脚本和业务代码一起打包
- 尽量避免把运行时依赖拆成很多模块文件

### 路线 3：PixiJS + ECharts

适合：

- 粒子流
- 雷达扫描
- HUD
- 2.5D 科技面板

运行建议：

- 单 bundle 最稳

## 九、验收清单

AI 生成并落盘后，至少核对下面这些项：

1. `Echarts/` 根目录是否存在 `*_index.html`
2. 页面是否完全脱离 CDN
3. 是否存在裸 `import`、`dynamic import()`、`new Worker()`、service worker
4. 静态资源是否都能在工作区找到
5. 页面是否能通过成员菜单进入
6. 页面是否能在 `/echarts-view/?token=...` 下正常展示
7. 页面核心业务动作是否成功
   - 主场景是否渲染
   - 关键动画是否启动
   - 图表是否出数
   - 面板切换或钻取是否可用
8. 多张大屏之间跳转是否正常
9. 分享链接在无登录态下是否仍能打开

## 十、当前默认标准

如果没有额外说明，后续 AI 生成 3D 大屏默认按下面标准执行：

- 入口优先级：
  `Echarts/*_index.dashboard.json` 优先
  `Echarts/*_index.html` 作为兼容旧链路保留
- 资源：全部同源静态资源
- 引擎：优先使用已内置的 `Three.js` / `Babylon.js` / `PixiJS` / `tsParticles`
- 图表：`ECharts`
- 动画：允许直接使用已内置的 `GSAP`
- 构建：
  manifest 链路优先直接交给零侵入 runtime
  HTML 链路继续保持单 bundle 优先
- 数据：本地 `data.js`、`data.json` 或同源公开接口
- 禁止：CDN、裸模块导入、动态分包、worker、service worker

这样做的目的不是限制创新，而是把创新收敛到“当前零侵入桥接层稳定能跑”的边界内。
