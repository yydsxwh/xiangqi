# 开源参考审计与产品架构

日期：2026-09-30

仓库：`yydsxwh/xiangqi`

本轮只做参考代码获取、阅读、技术审计、许可证审计、架构设计和自有项目骨架。没有把四个外部仓库提交进 Git，没有把它们的源码拼进产品，也没有接入 OpenAI。

本地阅读副本（`--depth 1`，已写入 `.gitignore`）：

| 目录 | 上游 | 审计时的提交 | 许可证 |
| --- | --- | --- | --- |
| `.reference/hkm-a-xiangqi` | https://github.com/hkm-a/xiangqi | `3333aaa`（2026-07-25） | MIT，Copyright (c) 2024 hkm-a |
| `.reference/yingwang-chinese-chess` | https://github.com/yingwang/chinese_chess | `927e617`（2026-09-28） | MIT，Copyright (c) 2026 Ying Wang |
| `.reference/xiangqi-analysis` | https://github.com/iFwu/xiangqi-analysis | `bf2677c`（2024-12-02） | 应用代码 MIT，Copyright (c) 2024 iFwu。随仓库分发的 Pikafish 为 GPL-3.0 |
| `.reference/xiangqiground` | https://github.com/west-shell/xiangqiground | `ce2a855`（2026-09-03，v1.1.1） | GPL-3.0-or-later，Copyright (C) 2025 weshell。源自同样 GPL 的 `@lichess-org/chessground` |

## 1. 四个项目分别有哪些值得采用的能力

### hkm-a/xiangqi：主底座

这是一个 Vite + 原生 ES Module 的本地人机应用，版本 1.4.0。没有账号、没有服务端对局。规则、记谱、FEN、终局和搜索都有 Vitest。

值得采用的能力：

- 完整规则：帅仕相马马车炮兵、九宫、塞象眼、蹩马腿、炮架、过河兵、将帅对面。合法走法会排除送将。`js/pieces.js` 与 `tests/pieces.test.js` 覆盖这些路径。
- 终局：将军、将杀、困毙。`js/perpetual.js` 用固定种子 Zobrist 记录局面，支持三次重复作和，以及最近六个半回合连续将军时的长将判负。没有实现「长捉」。
- FEN：标准 10 行字符串，红方大写、黑方小写，`w`/`b` 表示行棋方。`js/fen.js` 有往返测试。初始局面是 `rnbakabnr/9/1c5c1/p1p1p1p1p/9/9/P1P1P1P1P/1C5C1/9/RNBAKABNR w - - 0 1`。
- 中文记谱：红方路数从右到左，黑方从左到右；直进直退写步数，马仕相斜行写落点路数。`js/notation.js` 同时产出界面文本和语音 token。同路有两枚相同棋子时，没有「前/后/中」消歧。
- 对局状态：`js/game.js` 的 `Game` 持有棋盘、行棋方、历史、吃子、选中格、悔棋和 FEN 导入导出。悔棋一次只撤一手，人机双撤放在 UI。
- 本地 AI：`js/ai.js` 是 Alpha-Beta、迭代加深、置换表、Zobrist、MVV-LVA 和静默搜索。三档深度为 2 / 4 / 6，单层超过 2 秒会提前停。`js/ai-worker.js` 把搜索放进 Worker，主线程只收 `findBestMove` 的进度和结果。提示与对弈共用搜索，提示默认不自动跑。
- 棋盘表现：`js/renderer.js` 用 Canvas 画木纹棋盘、楚河汉界、九宫、星位、棋子、合法落点、最后一步、提示箭头、吃子闪光和落子动画。`js/main.js` 同时支持点击和拖拽，拖拽阈值 8 像素，并处理指针事件。
- 体验：暗色界面、将军朱印、终局印、吃子列表、着法复制、翻转、快捷键、`prefers-reduced-motion`。`css/style.css` 在 780px 和 420px 改为上下布局。
- 安装形态：`public/manifest.webmanifest` 与 `public/sw.js` 构成 PWA，导航请求网络优先、失败再读缓存。`src-tauri/` 是 Tauri 2 的 Windows NSIS 壳，更新检查指向作者自己的 GitHub Release。

明确不采用的产品边界：该项目拒绝账号、联网对战和开局库。这些正好是我们后面要自己做的，所以只借工程底座，不借产品范围。

### yingwang/chinese_chess：对局模式参考

无构建工具的原生 JS。`js/model.js` 用不可变 `Board` 与 `Map` 存子，`js/controller.js` 管流程，`js/view.js` 管 Canvas。没有测试，没有 `package.json`。

值得采用的产品能力，而不是整份代码：

- 四种模式：本地双人、人机、AI 对 AI、在线对战。模式决定「现在该谁走」，AI 不是写死在棋盘里。
- 在线对战的产品形状：4 位房间号、等待对手、走子同步、连接状态、终局。实现绑在作者自己的 Firebase 项目上，见第 9 节，不能搬配置。
- 对局信息：累计计时、中文着法、吃子画在棋盘上下两侧、悔棋。在线模式禁止悔棋。人机悔棋一次撤回两步，这是 UI 策略，不是规则。
- 搜索引擎比 hkm-a 更完整：空着裁剪、晚期着法缩减、杀手着法、历史启发、开局库、时间上限，以及重复局面回避。难度从深度 2 / 1 秒到深度 7 / 10 秒。
- 神经网络 AI：`js/ml-ai.js` 用 ONNX Runtime Web 跑策略头，模型加载失败时退回搜索引擎。这个「引擎可替换、失败可降级」的形状值得留在 `LocalAIPlayer` 后面，权重文件本身先不采用。
- 响应式：`BoardView.resize()` 按容器重算格子；页面禁止误缩放。交互是点击和 `touchend`，没有拖拽。
- 中英界面和明暗主题。对我们不是第一优先，但说明文案应离开渲染层。

规则实现与 hkm-a 重叠。两边都有 FEN、将军、将杀、困毙和重复检测。yingwang 的重复检测是局面字符串哈希，三次出现且当前被将军则判长将负，否则和棋。它没有 hkm-a 那套测试，所以不作为规则底座。

### iFwu/xiangqi-analysis：分析与引擎接入参考

Vue 3 + Pinia + Vite 的看图分析工具，不是对弈产品。`package.json` 的 `test` 脚本直接成功退出，没有测试。

值得采用的思路：

- 局面的交换格式用 FEN，引擎着法用四字符 UCCI，例如 `h2e2`。`src/utils/notationUtils.ts` 负责 FEN 更新和中文记谱。它不校验规则，只按坐标搬子。
- 引擎边界：`src/chessEngine.ts` 的 `ChessEngine` 初始化 WASM，发送 `uci`、`position fen`、`go depth`，从 stdout 解析 `bestmove`。`src/composables/useChessEngine.ts` 再把结果写进 store。棋盘组件不直接摸 WASM。
- 分析状态：当前 FEN、历史 FEN、着法、最佳着、深度、计算中、错误。深度存在 `localStorage`。这是复盘状态，不是对局状态。
- 图像识别：OpenCV.js 找棋盘、切格、模板匹配，低置信度格子再送给服务端视觉模型。Cloudflare Worker `workers/worker.ts` 把密钥留在 `env.STEP_API_KEY`，浏览器只打自己的 Worker。这个「模型调用在服务端」的位置，就是后面 OpenAI 应在的位置。识别功能本身不是第一阶段对弈范围。
- 中文记谱能从 UCCI 反推进、退、平。同样没有双车同路的前后消歧，黑方数字格式还夹着空格，不能直接当成品记谱。

不要采用的部分：`third_party/pikafish.js`、`public/wasm/pikafish.wasm`、`public/wasm/data/pikafish.data`，以及生产环境从 `xiangqiai.com` 拉取 WASM 的地址。见第 9 节。

### west-shell/xiangqiground：只研究交互行为

GPL-3.0-or-later 的棋盘 UI 库，零依赖，TypeScript。作者写明库内不含完整棋规：调用方传入 `movable.dests`，库只负责呈现和手势。

只记录这些产品行为，供我们自己写棋盘时对照。不记录、不移植其实现：

- 点击选子再点击落点，以及拖拽走子。拖拽有最小距离、幽灵子和落子取消。
- 合法落点、上一步、将军格由外部状态点亮，棋盘不自己裁判。
- SVG 层可画箭头、圆圈和标注，用于提示着法。
- 棋子移动与吃子淡出可配置时长。
- 棋盘可翻转，坐标可用中文数字或阿拉伯数字。
- 指针事件同时覆盖鼠标和 `touchstart` / `touchmove` / `touchend`，棋盘尺寸来自 DOM，可随容器变化。
- 预走棋（对方还没走时先选下一步）适合以后的在线对战，第一阶段不必做。
- 配置可整包替换：FEN、行棋方、朝向、是否只读、动画开关。

它把「棋盘是哑视图、规则在外面」分得很干净。hkm-a 的 `Game` 却同时装着选中格和 AI 难度。我们采用这个分层思想，用自己的类型和组件实现，不依赖、不复制该库。

## 2. 哪些代码可以合法复用

可以复用的前提：文件属于 MIT 授权，我们保留版权与许可声明，并且文件里没有另有许可的二进制、字体、密钥或生成语音。

| 来源 | 可以在后续阶段移植的部分 | 条件 |
| --- | --- | --- |
| hkm-a `js/pieces.js`、`js/fen.js`、`js/notation.js`、`js/perpetual.js` | 规则、FEN、中文记谱、重复局面 | 保留 Copyright (c) 2024 hkm-a 与 MIT 声明。移植时改写成我们的 TypeScript 模块，不整仓改名 |
| hkm-a `tests/*.js` | 规则、FEN、记谱、悔棋、重复、评估的验收用例 | 同上。这是我们最应该先搬的安全网 |
| hkm-a `js/ai.js`、`js/ai-worker.js` | 第一版本地搜索 | 同上。搜索必须落在 `LocalAIPlayer` 后面的引擎里，不进棋盘 |
| hkm-a `js/game.js` 中与棋盘、历史、吃子、悔棋、终局相关的状态转移 | 对局状态的行为规格 | 去掉其中的 `aiMode`、`aiColor`、`aiDifficulty`、`aiThinking` 后再吸收 |
| yingwang `js/model.js`、`js/ai.js`、`js/controller.js` 里与模式、计时、吃子、开局库和搜索增强相关的算法 | 有选择地吸收思想；若复制成段代码，保留 Copyright (c) 2026 Ying Wang 与 MIT 声明 | 不作为主底座。没有测试的代码不能整文件覆盖 hkm-a |
| iFwu 应用层 `src/utils/notationUtils.ts`、`src/chessEngine.ts` 的 UCI 命令序列 | UCCI 与「position / go / bestmove」的调用形状 | 保留 Copyright (c) 2024 iFwu 与 MIT 声明。不连带 WASM |

标准初始 FEN、棋子字母（KABNRCP）和 UCCI 四字符坐标是公开规格，不是某个仓库的专有表达。本仓库骨架里的坐标转换是按该规格自行编写的。

## 3. 哪些只能参考不能复制

| 材料 | 原因 |
| --- | --- |
| xiangqiground 的全部 `src/`、`assets/`、测试页、打包脚本和 npm 包 | GPL-3.0-or-later。在我们对应代码改为兼容 GPL 之前，禁止复制源码、样式、SVG 生成和实现文件，也不把它装成依赖 |
| Pikafish 源码、`pikafish.js`、`pikafish.wasm`、`pikafish.data`，以及 `xiangqiai.com` 上的 WASM 地址 | GPL-3.0。未做许可证决定前不进入本仓库，不打进商业安装包 |
| hkm-a 的 `public/tts/*.mp3` | 由 `node-edge-tts` 调用微软语音生成。脚本所在仓库是 MIT，合成语音的再分发权不一定是。商业产品先不拷贝这些音频 |
| hkm-a 的 Tauri 更新公钥、`latest.json` 地址、产品名和标识 `app.xiangqi.local` | 那是上游的发布身份。桌面壳可以以后按同样技术自己做 |
| hkm-a 的品牌文案、暗金视觉和印鉴布局 | 可作 VD 参考。我们的界面要自己形成，不整页搬家 |
| yingwang `js/firebase-config.js` 与 `js/online.js` 里的数据库路径 | 配置指向作者的 Firebase 项目。MIT 也不允许我们把用户带进别人的后端 |
| yingwang `chess_model.onnx`、`bgm.wav`、`bg.png` | 仓库根许可证是 MIT，但权重训练自大量棋谱，音乐和背景图的权利来源没有单独说明。未核清前不拷贝 |
| iFwu `assets/LiSu.woff2` | 字体文件常常另有商业许可，文件名指向隶书字体。不拷贝 |
| 四个仓库的图标、截图和 README 配图 | 不作为我们的品牌资产 |

「参考」在这里的意思是：记录行为、数据流和我们自己的接口，然后独立实现。它不包括改名、格式化或翻译后提交。

## 4. 哪个项目作为主底座

主底座是 **hkm-a/xiangqi**。

原因：

- MIT，和商业二次开发兼容，只要保留声明。
- 规则、FEN、记谱、终局、悔棋和本地搜索已经拆成模块，并有测试。
- Worker、PWA 和 Tauri 说明同一套前端可以同时是网页和 Windows 壳。
- 点击、拖拽、合法点、提示箭头和中文记谱已经是一个能下的产品，而不是只有引擎或只有画板。

另外三个项目的角色：

- yingwang：对局模式、计时、吃子、在线房间和更强搜索的功能清单。
- xiangqi-analysis：FEN / UCCI、分析历史，以及「强引擎和云端模型都站在棋盘外面」。
- xiangqiground：交互品质清单。实现必须是我们自己的。

不把 hkm-a 原样 fork 后改名。下一阶段按本文第 6、7 节，把选中的 MIT 模块改写进我们的目录。

## 5. 我们最终自己的产品架构

产品属于 `yydsxwh/xiangqi`。棋盘、规则、对局、棋手、权限和 HTTP 分开。任何棋手都实现同一个接口，棋盘只发出「人想走这里」。

```text
浏览器 / 以后的 PWA / 以后的 Tauri 壳
        │
        ▼
界面层  BoardView          只画局面、落点、上一步、将军、箭头、动画
        MatchPanel         模式、计时、吃子、棋谱、按钮
        │  用户意图 { from, to }
        ▼
对局层  Match              座位、模式、FEN、历史、终局
        TurnDirector       按行棋方找到座位上的 Player
        │
        ├── Rules          合法着、将军、将杀、困毙、重复
        ├── Notation       中文记谱、UCCI、FEN
        └── Player
              ├── HumanPlayer       等待界面提交
              ├── LocalAIPlayer     本地搜索，跑在 Worker
              ├── OpenAIPlayer      只调用我们的服务端
              ├── PikafishPlayer    只对话外部 UCI 进程，不内置 GPL 引擎
              └── FutureAIPlayer    同一接口上的后续引擎
                        │
                        ▼
服务端  会话与角色
        POST /api/matches/:matchId/ai/openai
        以后的房间、同步和复盘
```

坐标约定，避免四个项目混用：

- 内部棋盘沿用 hkm-a：10 行 9 列，第 0 行是黑方底线，第 0 列是左侧，红方在下方。这与 FEN 从上到下的行序一致。
- 棋手边界一律用 UCCI：文件 `a`–`i` 从左到右，等级 `0`–`9` 从红方底线向上。`h2e2` 这种四字符是 OpenAI、Pikafish 和本地引擎的共同输出。
- 中文记谱只用于显示和导出，不作为引擎输入。

对局模式先留出枚举：`human-vs-human`、`human-vs-ai`、`ai-vs-ai`、`online`。模式只决定两个座位分别坐哪种棋手。AI 对 AI 就是两个非人类棋手轮流 `requestMove`。在线对战以后由服务端转发对方着法，客户端仍把对方看成一个棋手，而不是在棋盘里写分支。

本轮已经落到仓库里的是上述边界的类型、导演和鉴权闸门。规则引擎、Canvas/DOM 棋盘、Worker 和 HTTP 服务都还没有从参考项目搬进来。

## 6. 哪些代码直接继承

「直接继承」指下一阶段以 hkm-a 的 MIT 实现为底稿，改写进我们的模块并保留版权声明。本提交还没有复制这些文件。

| 上游文件 | 落到 | 继承时保持的行为 |
| --- | --- | --- |
| `js/pieces.js` | `src/domain/rules` | 各子走法、送将过滤、将军、将杀、困毙、初始局面 |
| `js/fen.js` | `src/domain/fen` | 解析、生成、校验、与棋盘往返 |
| `js/notation.js` | `src/domain/notation` | 路数方向、进退平、斜行写落点 |
| `js/perpetual.js` | `src/domain/repetition` | Zobrist、三次重复、长将、悔棋时撤销记录 |
| `js/ai.js` 与 `js/ai-worker.js` | `src/players/local-search`，由 `LocalAIPlayer` 调用 | 迭代加深、置换表、静默搜索、难度档、不阻塞界面 |
| `tests/pieces.test.js`、`fen.test.js`、`notation.test.js`、`game.test.js`、`perpetual.test.js`、`undo-repetition.test.js`、`ai.test.js` | `tests/domain`、`tests/players` | 先让移植后的模块通过这些用例，再改内部结构 |

PWA 清单、Service Worker 和 Tauri 工程是安装形态，等网页对局成立后再按我们自己的名字、图标和更新地址新建。不复制上游的签名公钥和 Release 地址。

## 7. 哪些代码重构

这些部分即使来自 MIT，也不要按原文件结构留下。

- `Game` 里的 AI 字段。难度、思考中和 AI 颜色属于座位配置，不属于规则状态。悔棋、终局和 FEN 留下，AI 开关删除。
- `js/main.js`。它同时做指针、动画、语音、PWA、偏好和 AI 超时。拆成棋盘意图、对局面板和 `TurnDirector`。
- `js/renderer.js`。绘制技术和反馈清单（落点、上一步、将军、箭头、减少动效）值得保留，视觉规格重新设计。不把 900 行 Canvas 原样改名为我们的组件。
- 中文记谱补上同路多子的「前/后/中」。这是 hkm-a 和 analysis 都缺的规则，放在我们的记谱模块里做，并用新测试锁住。
- 长捉。两个 MIT 项目都只处理了长将和重复，没有完整的长捉。先继承现有判定，再单独立项，不在移植时悄悄改规则。
- yingwang 的搜索增强（时间上限、开局库、空着、杀手着法、重复回避）在本地引擎有测试之后再加。不加进第一份移植，避免两个未对齐的搜索实现叠在一起。
- 吃子列表和计时器放在 `Match` 与面板，不放进规则函数。yingwang 的累计秒表只是起点；正式对局时钟应区分红黑剩余时间。
- analysis 的 Pinia store 不引入。对局状态用我们自己的 `Match`，分析历史可以以后作为 `Match` 的只读投影。

## 8. 哪些功能自行实现

- 本文件描述的 `Player` 接口，以及 `HumanPlayer`、`LocalAIPlayer`、`OpenAIPlayer`、`PikafishPlayer`、`FutureAIPlayer`。参考项目都没有这层。
- 棋盘交互组件。行为对照 xiangqiground 和 hkm-a，代码全新写：拖拽手感、点击走子、合法落点、上一步、将军、箭头、动画、翻转、触摸和随容器缩放。合法落点由规则引擎算好后传入。
- 视觉和组件体系：布局、字体、颜色、印鉴、空状态和窄屏。可以吸收「棋盘是画面中心、窄屏改为上下排列」的布局结论，不复制 CSS。
- 权限和账号。参考项目里不存在站长与普通用户的区别。
- 服务端 API：会话、角色、OpenAI 代理、以后的房间和对局同步。不用 Firebase，不读取任何上游配置。
- 在线对战的权威规则。客户端可以预演，落子以服务端用我们的规则引擎复算为准。
- 测试体系：现在已有棋手、鉴权和棋盘边界测试。规则移植后把上游用例改写成我们的测试，并补上权限、非法着法和棋手替换。
- Pikafish 的进程桥。只实现 UCI 文本协议的客户端；引擎二进制由后续许可证决定是否、以及如何单独提供。
- 语音。若要做，走我们有权使用的合成方案，不拷贝现成 mp3。
- 看图识别。analysis 证明了管道可行，但它是另一项产品，不放进第一阶段对弈。

## 9. 第三方许可证处理方案

本产品当前 `package.json` 的许可证是 `UNLICENSED`，表示还没有把仓库整体设为 MIT，也没有把别人的仓库当成我们的许可证。引入 MIT 代码时只给那些文件加上游声明，不自动把整个商业仓库改成 MIT。

执行规则：

1. `.reference/` 永不提交。其中还包含上游的 `.git`、WASM、ONNX、音频和字体。
2. 移植 MIT 文件时，在文件头保留原版权人、年份和 MIT 许可全文的位置（或指向 `NOTICE.md` 中的全文），并在 `NOTICE.md` 增加条目。
3. 不安装 `@weshell/xiangqiground`，不复制其文件。若将来希望直接使用该库，必须先决定我们的对应作品使用 GPL-3.0-or-later，并接受 GPL 对衍生作品的义务。在那之前，棋盘保持独立实现。
4. Pikafish 单独处理。GPL-3.0 的引擎一旦和应用程序放在同一个分发物里，商业闭源分发就会站不住。analysis 上游写的是「只调用、不修改、不随应用分发则调用方不必改成 GPL；若重新分发带引擎的完整应用则必须遵守 GPL」。我们的商业产品按更严的内部标准执行：仓库不包含引擎，安装包不包含引擎，前端不从第三方网址加载引擎。`PikafishPlayer` 只保留接口。是否改为「用户自行安装、进程隔离」或「单独的 GPL 组件」，留到明确决定之后。
5. 不提交密钥、Firebase 配置、Umami 站点号、StepFun 地址或任何上游 `.env`。OpenAI 密钥将来只放在服务端环境变量。
6. 字体、语音、ONNX 权重、背景图和背景音乐，在权利来源写清楚之前视为不可复用。
7. OpenCV.js 是 Apache-2.0，只在我们真的做识别时再依赖，并保留其声明。这不在当前骨架里。

## 10. 后续 OpenAI API 接入位置

OpenAI 不进棋盘，不进规则，也不进浏览器可以绕过的按钮。

接入点只有一条服务端路由：

```text
POST /api/matches/:matchId/ai/openai
```

调用链：

1. `TurnDirector` 看到行棋座位是 `OpenAIPlayer`。
2. `OpenAIPlayer.requestMove` 把 `matchId`、FEN 和行棋方交给注入的 transport。
3. transport 请求我们的域名，并带上会话。请求体里没有角色字段，没有 API Key。
4. 服务端从会话解析用户，再从我们的用户库读取角色。忽略客户端自称的身份。
5. 角色闸门：
   - 未登录，以及 `ANONYMOUS`：拒绝，401。
   - 普通 `USER`：拒绝，403。
   - `SUPER_ADMIN`（站长）：本轮仍返回 501，因为还没有调用模型。
6. 以后在同一个函数里，501 换成真正的调用：用服务端环境变量里的密钥请求 OpenAI，只把当前 FEN、合法着法列表和必要的对局记录发给模型，要求返回一步 UCCI。再用我们的规则引擎检查这步确实合法，不合法就重试或判该手失败。模型名称只在这里选择，站长使用当时允许的最强模型。

前端可以不渲染站长以外的「OpenAI」选项。那只是界面，不是权限。普通用户即使自己构造 `OpenAIPlayer` 或直接请求该路由，也必须在第 5 步被拒绝。

`src/server/openai-move.ts` 现在就是这个闸门。`src/players/openai-player.ts` 没有 OpenAI SDK，也没有 `api.openai.com`。本地搜索、Pikafish 和以后的引擎走各自的棋手，不共用这条路由。

## 本轮仓库里有什么

```text
docs/opensource-research.md    本文
NOTICE.md                      第三方声明
src/domain                     棋盘坐标与 FEN 常量
src/game                       对局快照与回合导演
src/players                    五种棋手
src/permissions                谁可以使用 OpenAI
src/server                     OpenAI 路由的鉴权结果
src/ui                         棋盘视图模型，不引用任何棋手
tests                          上述边界的单元测试
```

下一轮再开始二次开发：把 hkm-a 的规则与测试移植进 `src/domain`，并接上 `LocalAIPlayer` 的真实搜索。在那之前不接 OpenAI，不复制 GPL 代码。
