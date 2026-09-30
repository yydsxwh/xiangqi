# 中国象棋开源参考：反馈报告

日期：2026-09-30

仓库：https://github.com/yydsxwh/xiangqi

分支：`cursor/opensource-research-887a`

草稿 PR：https://github.com/yydsxwh/xiangqi/pull/1

本轮完成了参考代码获取、阅读、技术审计、许可证审计、架构设计和自有项目骨架。产品还没有重写，OpenAI 还没有接入。

技术细节见同目录的 [opensource-research.md](./opensource-research.md)。

## 做了什么

四个上游仓库用 `git clone --depth 1` 放在项目根目录的 `.reference/`：

| 本地目录 | 上游 | 审计时的提交 | 许可证 |
| --- | --- | --- | --- |
| `.reference/hkm-a-xiangqi` | https://github.com/hkm-a/xiangqi | `3333aaa`（2026-07-25） | MIT |
| `.reference/yingwang-chinese-chess` | https://github.com/yingwang/chinese_chess | `927e617`（2026-09-28） | MIT |
| `.reference/xiangqi-analysis` | https://github.com/iFwu/xiangqi-analysis | `bf2677c`（2024-12-02） | 应用代码 MIT，Pikafish 为 GPL-3.0 |
| `.reference/xiangqiground` | https://github.com/west-shell/xiangqiground | `ce2a855`（2026-09-03，v1.1.1） | GPL-3.0-or-later |

`.reference/` 已写入 `.gitignore`。这些完整外部仓库不会提交进 GitHub。

## 主底座

主底座是 **hkm-a/xiangqi（MIT）**。

它有测过的规则、FEN、中文记谱、三次重复与长将、Canvas 棋盘、点击和拖拽、Worker 里的三档搜索，以及 PWA 和 Windows / Tauri。

下一阶段把这些改写进我们自己的目录，并保留 Copyright (c) 2024 hkm-a 的 MIT 声明：

- 规则、FEN、中文记谱、重复局面
- 本地搜索与对应测试

这些部分会重构后再留下，不整文件改名：

- `Game` 里的 AI 字段。难度和思考状态属于座位，不属于规则。
- `main.js` 里混在一起的指针、动画、语音、PWA 和 AI。
- 整页暗金视觉。布局结论可以吸收，界面要自己做。

## 另外三个项目怎么用

**yingwang/chinese_chess（MIT）** 提供对局形状：本地双人、人机、AI 对 AI、房间号在线、计时、吃子、更强的搜索，以及模型加载失败时退回搜索引擎。规则不拿它当底座，因为它没有测试。Firebase 配置、ONNX 权重、背景音乐和图片先不拷贝。

**iFwu/xiangqi-analysis** 的应用代码是 MIT。值得留下的是 FEN、四字符 UCCI（例如 `h2e2`），以及「强引擎和云端模型都站在棋盘外面」。`pikafish.js`、WASM 和 `xiangqiai.com` 上的引擎地址按 GPL-3.0 处理，不进仓库，也不打进安装包。

**xiangqiground 是 GPL-3.0-or-later。** 只记录这些产品行为，供我们自己写棋盘时对照：

- 拖拽手感与点击走子
- 合法落点高亮
- 最后一步高亮
- 将军提示
- SVG 箭头
- 棋子动画
- 棋盘翻转
- 手机触摸
- 随容器缩放的响应式棋盘

它的源码、样式和 npm 包都不复制，也不安装。在我们明确决定让对应代码遵循兼容 GPL 的许可证之前，棋盘保持独立实现。

## 可以复用、只能参考

可以在下一阶段移植的 MIT 代码：

| 来源 | 内容 | 条件 |
| --- | --- | --- |
| hkm-a 的规则、FEN、记谱、重复局面、本地搜索和测试 | 第一阶段工程底稿 | 保留版权与 MIT 声明 |
| yingwang 的模式、计时、吃子和搜索增强 | 有选择地吸收 | 不覆盖 hkm-a 的已测试规则；成段复制时保留其 MIT 声明 |
| analysis 的 UCCI 与 `position` / `go` / `bestmove` 调用形状 | 引擎接入方式 | 不连带 WASM |

先不复用：

- xiangqiground 的全部源码、样式和依赖
- Pikafish 源码、胶水脚本、WASM，以及第三方引擎网址
- hkm-a 用微软语音合成的 mp3
- 上游的 Tauri 更新公钥、产品标识和 Release 地址
- yingwang 的 Firebase 项目配置
- ONNX 权重、背景图、背景音乐、隶书字体文件
- 四个仓库的图标和截图

## 我们自己的架构

产品属于 `yydsxwh/xiangqi`。棋盘、规则、对局、棋手、权限和 HTTP 分开。

```text
界面
  BoardView     只画局面、落点、上一步、将军、箭头、动画
  MatchPanel    模式、计时、吃子、棋谱
        │  用户意图
        ▼
对局
  Match           座位、模式、FEN、历史、终局
  TurnDirector    按行棋方找到座位上的 Player
  Rules           合法着、将军、将杀、困毙、重复
        │
        ▼
棋手（同一个接口）
  HumanPlayer
  LocalAIPlayer      本地搜索，跑在 Worker
  OpenAIPlayer       只调用我们的服务端
  PikafishPlayer     只对话外部进程，不内置 GPL 引擎
  FutureAIPlayer
        │
        ▼
服务端
  会话与角色
  POST /api/matches/:matchId/ai/openai
```

坐标约定：

- 内部棋盘沿用 hkm-a：10 行 9 列，第 0 行是黑方底线。
- 棋手之间用 UCCI：文件 `a`–`i`，等级 `0` 在红方底线。
- 中文记谱只用于显示和导出。

对局模式先留出：`human-vs-human`、`human-vs-ai`、`ai-vs-ai`、`online`。模式只决定两个座位分别坐哪种棋手。

## OpenAI 以后接在哪里

OpenAI 不进棋盘，也不进浏览器可以绕过的按钮。

1. 行棋座位是 `OpenAIPlayer` 时，棋手把局面交给 transport。
2. transport 请求我们自己的 `POST /api/matches/:matchId/ai/openai`，并带上会话。
3. 请求体里没有角色，也没有 API Key。
4. 服务端从会话认人，再从用户库读取角色。
5. 未登录返回 401。普通用户返回 403。站长 `SUPER_ADMIN` 目前返回 501，因为模型还没有接上。
6. 以后在同一个服务端函数里把 501 换成真实调用。模型返回的 UCCI 必须再用我们的规则引擎检查。

当前权限：

- 站长：允许使用 OpenAI 最先进模型下棋。本轮只留出鉴权，还没有调用。
- 普通用户：禁止调用 OpenAI。
- 未登录用户：禁止调用 OpenAI。

鉴权在服务端。只隐藏前端按钮不算完成。

## 本轮仓库里有什么

```text
docs/feedback-report.md         本报告
docs/opensource-research.md     完整技术审计
NOTICE.md                       第三方声明
src/domain                      坐标与局面常量
src/game                        对局快照与回合导演
src/players                     五种棋手
src/permissions                 谁可以使用 OpenAI
src/server                      OpenAI 路由的鉴权结果
src/ui                          棋盘视图模型
tests                           上述边界的单元测试
```

`npm test` 通过 17 项。`npm run typecheck` 通过。

## 下一轮再做

- 把 hkm-a 的规则和测试移植进 `src/domain`
- 把本地搜索接到 `LocalAIPlayer`
- 自己实现棋盘交互和视觉
- 服务端房间、对局同步和真正的 OpenAI 调用
- PWA 与 Windows 壳用我们自己的名字和更新地址新建

在对应代码改为兼容 GPL 之前，不复制 xiangqiground，也不把 Pikafish 打进产品。
