# pack — 概念 → 自包含 morph 沙画 HTML

把一个"变"（before → after）打包成**单个自包含 HTML**：内联 sumi + 内联两张墨图，双击即开、零外部依赖，能直接塞进 PPT / 网页。

配方（`lab/concept-brain/EVAL.md` 里验证的）：文生图两张**纯黑白实心墨图** → sumi 粒子化 → 尘埃入场 + A⇄B 持续 morph。粒子友好的**风格**（纯黑白 / 大块实心 / 无细节）已内建在脚本里，你只描述**每态画什么** + 标注词。

## 用法

全自动（gpt-image-1 生图，需 `OPENAI_API_KEY`）：

```bash
OPENAI_API_KEY=... python3 pack.py \
  --a-label 混乱 --a-desc "a chaotic tangle of overlapping ink scribbles and knots" \
  --b-label 秩序 --b-desc "five thick evenly-spaced aligned horizontal bars" \
  --out chaos.html
```

复用已有图（不花钱）：

```bash
python3 pack.py --a-label 各自为战 --b-label 协同 \
  --a-img refs/silo-A.png --b-img refs/silo-B.png --out silo.html
```

## 参数

- `--a-label` / `--b-label`：两态标注词（必填）。
- `--a-desc` / `--b-desc`：每态**画什么**（只描述主体，风格自动包）。
- `--a-img` / `--b-img`：改用现成 PNG，跳过生图。
- `--out`：输出 HTML（必填）。
- `--n`：粒子数（默认 14000）。`--seed`：随机种子（默认 7）。
- `--keep-size`：不缩图（默认缩到 720px 以减小体积，需 macOS `sips`）。

## 出好图的手感（写 `--*-desc` 时）

- 纯黑白、**大块实心**、无细节无灰阶——细线会散成噪点。
- A 和 B 的**构图 / 墨量尽量相当**，morph 才顺（小→大例外，像"种子→大树"反而很抓人）。
- 一态一个清楚的形，别塞多个意象。

生图凭据说明见项目记忆 `image-generation-setup`。
