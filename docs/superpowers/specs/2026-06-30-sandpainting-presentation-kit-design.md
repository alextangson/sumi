# 水墨沙画演示组件 (working name: `inkmote`) — 设计文档 v2

> 日期：2026-06-30 · 状态：**设计待评审（P0）· 已并入 codex 跨 AI 评审** · 仓库：独立项目 `~/projects/inkmote/`，不在 `perseonal-website` 内。
> 范围：本文 = **P0（一个垂直切片：引擎 + 薄 DeckRuntime + 两个原语 + 一个真单文件 HTML deck demo，含 PDF 静态 + 无障碍）**。其余进 §11 roadmap。
> v1 → v2 变更摘要见 §13。

---

## 0. 一句话

一套**零依赖、可整段内联的水墨沙画演示组件**：把文字/数字/图像凝聚成墨色粒子、或在两个画面间溢散重组，做成**有名字、AI 一行就能生成**的演示"时刻"。底层是通用粒子 morph 引擎 + 一层管理 deck 的运行时；上层是面向"做 PPT 的人都需要"的组件。

## 1. 产品定框

- **卖的是 deck 工具，不是粒子 demo。** 最大失败模式 = P0 做完只有一个漂亮 hero，证明不了"能稳定塞进别人的演示"。因此 P0 的验收锚点是：**一个真正的单文件 HTML deck（封面 + 章节页 + 正文页），能复制即跑、不破坏排版、导出 PDF 不炸、无障碍可读。**
- **沙画只擅长两类动作** → 两个原语：**凝聚成形**（沙 → 文字/数字/图）= `TextReveal` 类；**溢散重组**（A 散 → B 聚）= `SceneMorph` 类。
- **粒子 = 科技感，水墨沙画 = 东方元素**，融合是可拥有、难抄的美学记忆点。但**胜点不能是"更美"**（见 §8 验收标准）。
- **`tree` / 枯木重生叙事不进库**：它是个人网站的 bespoke composition（用同一引擎搭），品牌专属。

## 2. 范围（P0 = 垂直切片）

**In（P0）：**
- L0 引擎 core（含确定性重采样、模拟/绘制分离、多阶段时间线）。
- L1 **`InkStage` / DeckRuntime**（共享 canvas、scene 状态、slide 区域映射、resize、visibility、导出/打印静态帧、生命周期）。
- L2 两个**原语**：`TextReveal`、`SceneMorph`。
- L3 **声明式 `data-ink-*` 接口**（AI-native，一等公民）。
- 一个**真单文件 HTML deck demo**：封面 / 章节转场 / 正文（关键数字）/ PDF 静态导出 / a11y。

**Out → §11 roadmap：**
- **P0.5**：preset（`TitleReveal` / `CoverReveal` / `StatReveal`）+ 个人网站 hero 迁移（验证复用，不作 P0 门槛）。
- **P1**：框架适配器（Slidev/reveal/React…）、playground、demo 画廊、README/gif。
- **P2**：Claude skill（把组件当词汇让 AI 生成带风格的 deck）。
- **P3**：更多 formation 源、命名/license、开源 launch。

## 3. 架构（四层 + 一层运行时）

```
L0  engine core         只碰粒子与 canvas 绘制；不懂 DOM/slide/语义
L1  InkStage / Runtime   ← 新增：管共享 canvas / scene / slide 区域 / resize / visibility / 导出静态帧 / lifecycle
L2  components           primitives(TextReveal, SceneMorph) + presets(Title/Cover/Stat)；只向 Stage 注册 formation+choreography
L3  adapters + skill      vanilla data-ink-* / Slidev / reveal / 框架 wrapper / Claude skill —— 只转发生命周期，不拥有核心逻辑
---
个人网站 `tree` 重生叙事 = 用 L0/L1 搭的 website-only composition，不属于本库
```

单向依赖 L3→L2→L1→L0。**新增 L1 是 codex 评审的核心修正**：deck 里最难的是宿主细节（canvas 放哪、当前页、坐标映射、导出多页各自静态帧），不属于 L0、也不该塞进每个组件，否则抽象泄漏。

## 4. L0 引擎 core

### 4.1 模块

| 模块 | 职责 |
|---|---|
| `formations/` | 纯函数：源 → 归一化点集 `{x,y,lvl}`（`[-0.5,0.5]`）。P0：`fromText`、`fromImage`；留 `fromSVGPath`/`fromShape` 接口。**关键：每个 formation 重采样到全局同一个 N**（见 4.3） |
| `Field` | 粒子核心 + **模拟状态更新**（位置插值、抖动）。持有每粒多个具名 target |
| `Choreography` | **多阶段**时间线（见 4.4），驱动 morph 因子 + per-particle stagger |
| `Renderer` | **只负责绘制**：色桶批 `fillRect`、视差、摆动。与 Field 的模拟更新**分离**（便于静态帧/测试/离屏） |
| `Ambient` | 规律点阵氛围层（可关） |
| `degrade` | reduced-motion / mobile / 显式 static → 单帧；供 Stage 调用 |

**模拟 / 绘制分离**（codex #7）：`Field.step(dt)` 更新状态，`Renderer.draw(field)` 画一帧。静态帧 = `step` 到终态后 `draw` 一次。

### 4.2 公开 API（草图）
```js
const field = createInkField({ palette, budget:'auto', rng: seededRng })
field.formation('title', fromText('年度策略', { font, weight }))
field.formation('scene', fromImage(img))
// 时间线/命令式由 L1 Stage 驱动，见 §5
```

### 4.3 数量对账（codex #5，重写）
**不再用"循环/截断"**（会脏边、破坏笔画末端、密度不均）。改为：
- 全局固定粒子预算 `N`（按性能档，见 §8）。
- **每个 formation 都重采样到恰好 `N` 个点**：按 luminance/alpha 加权 + Poisson-ish 抖动 + 按 bounding box 分层抽样。
- `rng` 注入种子 → **确定性**（同输入同画面，可测、deck 可复现）。
- morph 时按稳定排序做点对点对应，避免跨场景闪烁。

### 4.4 时间线（codex #6）
`SceneMorph` 不是线性 `to(name,{duration})`，而是**多阶段**：`disperse → drift → regroup → settle → handoff`，支持 per-particle `delay/stagger`、noise field、opacity/size 曲线。L0 提供这套时间线原语，L1/L2 才不会硬编码动画细节、preset 才可复用。

### 4.5 性能内核
色桶批渲染（量化 ~24 级、按级排序、每级一次 `fillStyle`）、`fillRect`、rAF（Stage 控制暂停）、DPR 封顶 2。WebGL 留作天花板，不预先重写。

## 5. L1 `InkStage` / DeckRuntime（新增层）

一层薄运行时，**只管宿主细节，不长成框架**（回推 codex：保持薄）：
- 持有**一个共享 canvas** + 当前 scene 状态。
- **slide 区域映射**：把归一化 formation 映射到"当前 slide 在视口里的实际矩形"，处理 deck 的 `transform: scale()`（reveal/Slidev 会缩放，canvas 坐标须跟随）。
- resize / Page Visibility 暂停恢复。
- **导出/打印**（codex #15）：监听 `beforeprint`/`afterprint`、检测 `?print-pdf`；打印时**每页渲染各自的静态帧**（不是共享 canvas 的当前帧——多页同时存在时共享 canvas 只能显示一个状态）。
- 生命周期事件：`enterScene / leaveScene / settle`，供组件与适配器挂钩。
- 静态/降级模式开关（reduced-motion / mobile / export 共用此路径，但**三者判定独立**：reduced-motion ≠ print）。

API（草图）：
```js
const stage = createInkStage(canvasEl, { mode:'auto' })   // auto|static
stage.scene('cover', { formation:'title', choreography:'reveal' })
stage.goto('cover'); stage.next()
stage.snapshotFor(slideEl)   // 导出：为某页生成静态帧
```

## 6. L2 组件（原语 + preset）

**原语（P0）：**
- **`TextReveal`** — 沙 → 文字/数字凝聚。覆盖标题、关键词、数字（StatReveal 即其 preset）。**a11y 见 §8**。
- **`SceneMorph`** — 两个 **formation** 间溢散重组。**明确收窄定义（codex #10）：输入是两个 formation（名称/文字/图），不是 DOM 截图**——不做 DOM 光栅化（复杂度黑洞）。

**preset（P0.5）：** `TitleReveal`（TextReveal 标题布局）、`CoverReveal`（wordmark+tagline 布局）、`StatReveal`（TextReveal + 数字格式/count-up）。都只是配置，不是核心组件。

组件**只向 Stage 注册 formation + choreography**，不碰宿主细节。

## 7. 声明式 `data-ink-*` 接口（P0 一等，codex #17）

AI 生成 HTML deck 时，写属性远比写 JS 初始化稳定。这是"AI-native"的落地，不是 P1 seam：
```html
<h1 data-ink="title">年度策略</h1>
<div data-ink="stat" data-value="95%">…</div>
<section data-ink-transition="chapter"> … </section>
```
`autoInit(root)` 扫描 `data-ink-*` → 建 Stage + scene。skill 只需教 AI 这套属性词汇。

## 8. 关键设计决策 & 硬性验收标准

**把差异点变成验收标准（codex #18），不是营销话术。P0 必须全部满足：**

1. **确定性渲染**：seeded RNG，同输入逐像素可复现。
2. **原生文本可读可选中**（codex #14）：真 `<h1>` **一开始就在 DOM**（视觉透明/隐藏），粒子 canvas `aria-hidden="true"`；**不在 settle 后才插文本**；handoff 时文字位置/字重/letter-spacing 与粒子目标对齐，避免"落定跳一下"。
3. **导出安全**：print/PDF 模式**每页各自静态帧**；`beforeprint`/`?print-pdf` 检测到位。
4. **复制即跑 + 不破排版**：单文件 HTML 复制进任意 deck 能跑；canvas `pointer-events:none`、置于 slide 之下、不影响布局/点击。
5. **字体就绪**（codex #12，呼应"字体才是瓶颈"记忆）：canvas 采样前 `await document.fonts.ready` + fallback；**CJK 字体不内联**（体积），文档说明跨机一致性前提。
6. **bundle 预算**（codex #11）：core+stage+两原语 **gzip < 25KB**，否则"可内联"是空话。
7. **性能分档 + 最差用例**（codex #13）：desktop high 12–15k / normal 6–8k / mobile-static 0–2k / print 静态；最差用例必测：中文长标题、全屏图 formation、resize、快速翻页。

其余设计决策：转场只默认用在章节边界；引擎不懂语义；降级是默认非脚注。

## 9. 仓库结构 & 打包

```
inkmote/
  src/
    index.ts
    engine/{field.ts, choreography.ts, renderer.ts, ambient.ts, degrade.ts}
    engine/formations/{text.ts, image.ts, svg.ts, shape.ts}
    stage/ink-stage.ts            # L1 runtime
    components/{text-reveal.ts, scene-morph.ts}   # P0 原语
    components/presets/{title.ts, cover.ts, stat.ts}  # P0.5
    auto-init.ts                  # data-ink-* 扫描
  dist/   esm + umd + iife.min（iife 用于整段内联）
  demo/   single-file-deck.html（P0 验收物）+ hero
  test/
  docs/superpowers/specs/   （本文件）
  README.md  package.json  LICENSE  tsconfig.json
```
TypeScript → 干净 ESM/UMD/IIFE，零依赖、可整段内联，附 `.d.ts`。受 §8.6 bundle 预算约束。

## 10. 测试策略

- **确定性单测**：给定输入+种子，formation 点数=N、bounding box、点序可断言。
- **数量对账**：两个不同密度 formation 重采样后均为 N，morph 无重叠/截断伪影。
- **a11y**：`<h1>` 原生可读可选中、canvas `aria-hidden`、settle 不插入新文本（DOM 快照断言）。
- **导出**：模拟 `beforeprint` → 每页有独立静态帧。
- **最差用例矩阵**（§8.7）：中文长标题 / 全屏图 / resize / 快速翻页下不崩、降到对应性能档。
- 渲染走 demo 页 + 截图比对（headless）。

## 11. 实现分期

- **P0（本 spec，垂直切片）** — L0 引擎（确定性重采样 + 模拟/绘制分离 + 多阶段时间线）+ L1 InkStage（含导出静态帧）+ `TextReveal` + `SceneMorph` + `data-ink-*` + **单文件 HTML deck demo（封面/章节/正文数字 + PDF + a11y）**。验收 = §8 七条全过。
- **P0.5** — presets（Title/Cover/Stat）+ 个人网站 hero 迁移（复用验证）。
- **P1** — 框架适配器（Slidev/reveal 插件、React/Vue wrapper，只转发生命周期）+ playground + demo 画廊 + README/30s gif。
- **P2** — Claude skill：薄 SKILL.md 教 AI 用 `data-ink-*` + bundle 库 + 三种安装；自用跑真 deck 打磨。
- **P3** — 更多 formation 源（svg/shape/lottie…社区插件）、命名、license、开源 launch。

## 12. 开放项

1. **正式名**（`inkmote` 工作代号；避开 `*particles`，候选 `inkmote`/`sumi`/`sandscript`/`mote`）—— launch 前定。
2. **License**：倾向 MIT（抢采用），P3 前定。
3. **`SceneMorph` 与各 deck 框架的接入点**（vanilla vs Slidev/reveal 的 transform/scale 与导航事件差异）—— P1 适配器阶段验证；P0 先把 vanilla 单文件 deck 跑通。
4. **CJK 字体的跨机一致性兜底**（采样依赖目标机字体）—— 文档约定 + 可选预渲染快照。

## 13. v1 → v2 变更（codex 跨 AI 评审并入）

- **架构**：新增 L1 `InkStage`/DeckRuntime 层（原 L0/L1/L2 漏了宿主运行时，会导致抽象泄漏）。
- **范围**：P0 由"引擎+3 组件+网站迁移"收成**垂直切片**（引擎+薄 runtime+2 原语+1 真 deck demo，含 PDF/a11y）；CoverReveal、网站迁移降到 P0.5。
- **组件**：改为**原语（TextReveal/SceneMorph）+ preset（Title/Cover/Stat）**；新增高频的 `StatReveal`（数字）。
- **数量对账**：循环/截断 → **每 formation 重采样到固定 N + seeded 确定性**。
- **时间线**：线性 → **多阶段**（disperse/drift/regroup/settle/handoff + per-particle stagger）。
- **引擎**：**模拟更新与绘制分离**。
- **新增 P0 硬指标**：原生文本 a11y handoff 细化、导出多页各自静态帧、字体就绪、bundle 预算 gzip<25KB、性能分档 + 最差用例、`data-ink-*` 提为一等接口、差异点写成验收标准。
- **回推 codex 两点**：保留"先抽库 + 网站复用"意图（迁移挪 P0.5 当验证）；DeckRuntime 保持薄、不长成框架。
