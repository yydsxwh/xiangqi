# xiangqi

yydsxwh 的中国象棋。人机对弈是起点，棋手、规则和棋盘分开，后面可以换成本地搜索、OpenAI、Pikafish 或其他引擎。

这一版只建立了架构边界和开源审计，还不能在浏览器里下棋。结论写在 [docs/opensource-research.md](docs/opensource-research.md)。

## 本地参考代码

`.reference/` 是给阅读用的浅克隆，已在 `.gitignore` 中排除，不会进入本仓库。四个上游的许可证不同：hkm-a 与 yingwang 是 MIT，xiangqi-analysis 的应用代码是 MIT 但携带 GPL-3.0 的 Pikafish，xiangqiground 整体是 GPL-3.0-or-later。GPL 代码只研究交互，不复制进产品。

## 布局

```text
src/domain        坐标与局面常量
src/game          对局快照、回合导演
src/players       Human / LocalAI / OpenAI / Pikafish / Future
src/permissions   OpenAI 仅站长可用
src/server        服务端鉴权闸门，尚未调用模型
src/ui            棋盘视图模型
```

OpenAI 以后只从 `POST /api/matches/:matchId/ai/openai` 出去。未登录返回 401，普通用户返回 403，站长在模型接上之前返回 501。隐藏按钮不算鉴权。

## 检查

```bash
npm test
npm run typecheck
```
