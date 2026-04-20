---
name: kingdee-cosmic-sdk
description: 编写或审查金蝶苍穹 Cosmic V7.0.1 (Kingdee Cosmic) Java 代码时使用。提供 133 个模块 / 805 个包 / 2911 个类的离线 Javadoc 渐进式查询，含 @param、@return、继承关系、注解、过时标记。严禁对 javadoc/ 全局 grep，必须按 INDEX.md → modules/<name>.md → class HTML 的顺序逐层检索。
---

# 金蝶苍穹 Cosmic V7.0.1 SDK Skill

本 skill 打包了金蝶苍穹 V7.0.1 Java SDK 的离线 Javadoc，并指导 AI **不使用全局搜索** 地完成 API 查询。

## 一、定位 SDK 根目录

SDK 文件夹可能被放在用户磁盘的任意位置，**禁止硬编码路径**。按以下步骤发现：

1. 优先使用环境变量 `SDK_ROOT` 或用户明确提供的路径。
2. 否则使用 `Glob` 查找 `**/javadoc_meta.js`，其所在目录即为 `$SDK_ROOT`。
3. 校验：`$SDK_ROOT` 下必须同时存在 `INDEX.md`、`modules/`、`javadoc/`。

下文所有路径均 **相对于 `$SDK_ROOT`**。

## 二、渐进式披露查询流程

> **铁律**：禁止对 `javadoc/` 目录使用 `Grep` 或递归读取。索引文件很小，类 HTML 很大且数量多（2911 个），必须先缩小范围。

```
第 1 步 ──▶ 读 INDEX.md              （按云分组的模块目录 + 一句话描述）
第 2 步 ──▶ 读 modules/<模块名>.md    （该模块下的包与类清单）
第 3 步 ──▶ 读 javadoc/<包路径>/<类名>.html   （单个类的完整 Javadoc）
```

### 第 1 步 — `INDEX.md`

列出 133 个模块，含：描述、包数 (`p`) / 类数 (`c`)、app/isv 标签。可按云名（`bos`、`fi`、`scm`、`hr`…）浏览，或通过描述中的关键词定位（如"工作流"、"基础数据"、"审批流"、"报表"）。

### 第 2 步 — `modules/<模块名>.md`

展示该模块的所有包，每个包给出类表格：`类名 | 类型（class/interface/enum/annotation） | 继承 | 实现 | 方法数 | 字段数 | 是否过时`。用它判断候选类。

### 第 3 步 — 类详情

路径规则（确定性，不需要查找）：

```
javadoc/<包名把点换成斜杠>/<类名>.html
```

示例：
- 包 `kd.bos.algo`，类 `Algo` → `javadoc/kd/bos/algo/Algo.html`
- 内部类 `CachedDataSet.Builder`（位于 `kd.bos.algo`） → `javadoc/kd/bos/algo/CachedDataSet.Builder.html`（类名里的点保留为字面字符）

### 解析类 HTML

HTML 的 `<body>` 是空的，内容以 JS 对象形式嵌在 **第 2 行**：

```html
<script><!--
    const cm={"allInterfaces":[...],"annotations":[...],"comment":"...","declare":"...","fields":[...],"interfaces":[...],"isDeprecated":false,"isPlugin":false,"isService":false,"methods":[...],"name":"Algo","type":"CLASS"};
--></script>
```

提取方式：读入文件后，截取从 `const cm=` 到结尾 `};` 之间的 JSON 文本，`JSON.parse` 即可；或用 `Grep` 匹配 `const cm=` 所在行。

**`cm` 对象的关键字段：**

| 字段 | 含义 |
|------|------|
| `name` | 类名 |
| `type` | `CLASS` / `INTERFACE` / `ENUM` / `ANNOTATION` |
| `declare` | 完整 Java 签名，如 `public abstract class Algo` |
| `comment` | 类级 Javadoc（中文） |
| `annotations[]` | `{name, attrs}`，如 `kd.sdk.annotation.SdkPublic` |
| `interfaces[]` / `allInterfaces[]` | 实现的接口 |
| `methods[]` | 每项：`name`、`modifiers`、`returnType`、`paramNames[]`、`paramTypes[]`、`comment`、`tags[]`（@param/@return/@throws）、`throwExceptions[]`、`annotations[]`、`constructor`、`sdkInternal`、`scriptDeprecated` |
| `fields[]` | 每项：`name`、`type`、`modifiers`、`comment`、`annotations[]` |
| `isDeprecated` / `isPlugin` / `isService` | 标志位 |

注释中可能嵌入 `<a href="?nav=class&package=X&name=Y">` 形式的跳转，需要跟进时转换成 `javadoc/X改斜杠/Y.html` 即可。

## 三、关键词搜索（当无法通过描述定位模块时）

`javadoc_meta.js` 是一个 748 KB 的 JS 常量，包含 **完整目录**（模块 → 包 → 类名 → 方法名列表）。当 `INDEX.md` 浏览无法命中时：

- 只对 `javadoc_meta.js` 这一个文件使用 `Grep`（不要 grep `javadoc/` 目录）。类名、方法名、模块描述都能搜到。
- 命中后回到 INDEX → 模块 → 类 的正常流程。

## 四、禁止事项

- ❌ 不要对 `javadoc/` 递归 `Grep` —— 2911 个文件会爆 token。
- ❌ 不要尝试在浏览器打开类 HTML —— `<body>` 为空，离线模板脚本已缺失。直接解析 `cm` 对象即可。
- ❌ 不要凭记忆猜测类路径 —— 始终用 `javadoc/<包斜杠形式>/<类名>.html` 规则计算。

## 五、速查表

| 需求 | 去哪里找 |
|------|---------|
| 有哪些模块 | `INDEX.md` |
| 某模块下有哪些包/类 | `modules/<模块名>.md` |
| 某个类的完整细节 | `javadoc/<包路径>/<类名>.html` → 解析 `cm={...}` |
| 关键词兜底搜索 | `javadoc_meta.js` |

## 六、典型会话流程示例

用户请求："帮我写一段金蝶的 DataSet 过滤代码"

1. `Glob **/javadoc_meta.js` → 确定 `$SDK_ROOT`
2. 读 `$SDK_ROOT/INDEX.md` → 发现 `kd.bos.algo` 描述为"内存计算"
3. 读 `$SDK_ROOT/modules/kd.bos.algo.md` → 定位 `DataSet` 接口，有 61 个方法
4. 读 `$SDK_ROOT/javadoc/kd/bos/algo/DataSet.html` → 解析 `cm`，从 `methods[]` 中找到 `filter` 的签名、参数、中文注释
5. 依据真实签名生成代码，不臆造 API
