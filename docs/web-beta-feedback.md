# 中国象棋网页内测：上线反馈

日期：2026-09-30

## 1. 最终访问地址

- 软件产品：https://www.yydsxwh.com/products
- 游戏中心：https://www.yydsxwh.com/games
- 对局（仅站长）：https://www.yydsxwh.com/games/xiangqi/
- 进入鉴权：`GET /api/games/xiangqi/access`
- OpenAI 着法：`POST /api/games/xiangqi/openai-move`

## 2. xiangqi 仓库改了什么

分支 `cursor/opensource-research-887a`，提交 `04683f9` 以及本反馈所在的后续提交。

主要新增：

- `src/engine/`：从 hkm-a/xiangqi 迁入的 MIT 规则、FEN、记谱、重复局面、本地搜索
- `src/domain/position.ts`：唯一局面真相
- `src/ui/XiangqiBoard.tsx`、`src/ui/MatchApp.tsx`：自己的棋盘和对局界面
- `src/players/local-search.ts`、`src/engine/search-worker.ts`：Worker 搜索
- `src/openai/validate.ts`、`src/openai/lock.ts`：请求校验和重复提交锁
- `deploy/nginx-games-xiangqi.conf`：实际上线的 Nginx 片段

第一阶段文档 `docs/opensource-research.md`、`docs/feedback-report.md` 都还在。

## 3. 主站仓库改了什么

分支 `cursor/xiangqi-game-center-887a`，提交 `ff47d2b`。该提交已快进到 `Andyyyds20260901independentpackage`。

- `src/app/products/page.tsx`：游戏中心改为「已开始内测」
- `src/app/games/page.tsx`：中国象棋卡片
- `packages/shared/src/portal.ts`：默认导航不再把游戏中心标成即将开放
- `src/app/api/games/xiangqi/access/route.ts`
- `src/app/api/games/xiangqi/openai-move/route.ts`
- `src/app/api/games/xiangqi/guard.ts`

生产机器上的主站 Git 比 GitHub 少 6 个提交、多 1 个本地提交（导航文案「辅导」）。为了不把那 6 个未在这台机器上运行的提交一起带上，这次是把上述文件直接拷到 `/var/www/yyds-course-platform` 和 `/var/www/yydsxwh.com` 后构建，没有在服务器上 `git pull`。

## 4. 主底座迁了哪些 MIT 能力

来自 hkm-a/xiangqi，Copyright (c) 2024 hkm-a，MIT。清单在 `THIRD_PARTY_NOTICES.md`。

已迁入：规则、FEN、中文记谱、三次重复、长将检测、将军、将杀、困毙、悔棋回放、本地 Alpha-Beta 搜索，以及对应测试。

没有迁入界面、语音、PWA 和 Tauri。

## 5. 哪些是我们自己实现的

- 棋盘绘制、点击、拖拽、落点、上一步、将军圈、翻转、手机布局
- 对局模式、吃子、棋谱和白话解释
- 手机观察模式
- `HumanPlayer` / `LocalAIPlayer` / `OpenAIPlayer` 的对局循环
- 主站站长内测卡片和两道 API
- Nginx `auth_request`

没有复制 xiangqiground，也没有放入 Pikafish。

## 6. 当前界面

棋盘是暖色木盘，外围是白底、细边框。红黑棋子用宋体字形和颜色区分，没有金龙和满屏红。

桌面是棋盘在左、棋谱和操作在右。窄屏操作条留在棋盘下方，棋谱收进抽屉。手机观察模式放大棋盘、藏起侧栏，顶栏保留「退出观察模式」。

## 7. 规则测试

`npm test`：146 项通过，其中引擎测试 123 项，覆盖车马炮、九宫、过河、照面、送将、将军、将死、困毙、FEN、记谱、悔棋和重复。

同路「前 / 中 / 后」记谱这次没有加。

长将检测沿用上游：能认出连续将军的一方，终局状态与上游 `Game` 相同。

## 8. 本地 AI 测试

`tests/engine/ai.test.js` 通过。浏览器里用入门档下了「炮二平五」，Worker 回了「砲二平五」，界面没有卡住。搜索深度仍是上游的 2 / 4 / 6 档，对应入门、进阶、大师。

## 9. OpenAI 是否已经连通

没有。服务器上没有 `OPENAI_API_KEY`。

站长调用时返回 503：`服务器还没有配置 OPENAI_API_KEY 或 OPENAI_XIANGQI_MODEL`。因为密钥缺失，请求在发出前就结束，没有打到 `api.openai.com`。

模型名已按当前官方 Responses API 示例写成环境变量，见下一节。密钥需要站长自己写入服务器环境，不要发到仓库。

## 10. 环境变量名

只写名字：

- `OPENAI_API_KEY`：未配置
- `OPENAI_XIANGQI_MODEL`：已设为官方示例里的当前 Responses 模型 `gpt-5.4`
- `OPENAI_XIANGQI_FALLBACK_MODEL`：未设。只有主模型明确报模型不可用时才会使用

没有 `NEXT_PUBLIC_OPENAI_API_KEY`，也没有 `VITE_OPENAI_API_KEY`。

## 11. 权限测试

未登录：

- `/products` 200，页面有「已开始内测」
- `/games` 200，有中国象棋卡片和禁用的「站长内测中」，没有「进入内测」
- `/games/xiangqi/` 403，响应里没有游戏脚本
- 游戏静态资源 403
- `POST /api/games/xiangqi/openai-move` 401，正文是「未登录不能调用 OpenAI」

普通用户（站内学生账号，短时会话，只用于这次探测）：

- `/api/games/xiangqi/access` 403
- `/games/xiangqi/` 403
- OpenAI 接口 403
- 游戏中心不显示「进入内测」

站长：

- `/api/games/xiangqi/access` 204
- `/games/xiangqi/` 返回游戏页面，静态资源 200
- 游戏中心显示「进入内测」
- OpenAI 接口越过登录检查后因未配置密钥返回 503，没有落子

页面包内没有 API Key，也没有 `api.openai.com`。`sk-` 的扫描命中是 CSS 属性 `mask-type` 的压缩片段，不是密钥。

## 12. Nginx

文件：`/etc/nginx/sites-available/yyds-course`

在 `location /` 之前加入：

`include /etc/nginx/snippets/xiangqi-beta.conf;`

静态目录：`/var/www/xiangqi-web/`

备份：`/etc/nginx/backups/yyds-course.bak.xiangqi-20260930233857`

`nginx -t` 通过后 `systemctl reload nginx`。没有 restart。

## 13. 部署命令

主站在服务器上：

```bash
cd /var/www/yyds-course-platform
npm run build
pm2 restart yyds-course
```

没有执行 `prisma db push`。

静态文件解到 `/var/www/xiangqi-web/`。然后 `nginx -t` 和 `systemctl reload nginx`。

## 14. 回滚

Nginx：

```bash
sudo cp /etc/nginx/backups/yyds-course.bak.xiangqi-20260930233857 /etc/nginx/sites-available/yyds-course
sudo nginx -t && sudo systemctl reload nginx
sudo rm -rf /var/www/xiangqi-web
```

主站源码：在 `/var/www/yydsxwh.com` 用 git 还原这次拷上去的文件，再同步到 `/var/www/yyds-course-platform`，重新 `npm run build`，然后 `pm2 restart yyds-course`。不要用 `git reset --hard`，那会丢掉机器上多出来的「辅导」提交。

## 15. 已知问题

- OpenAI 还不能下棋，因为没有 `OPENAI_API_KEY`。
- 第一版局面仍由浏览器计算合法着法。代码里留有 `TODO before public release: move match authority to server`。普通用户开放 OpenAI 之前必须先做成服务器权威棋局。
- 同路多子的「前 / 中 / 后」记谱还没有。
- 长将终局沿用上游行为，没有在这一轮改规则。
- 服务器磁盘大约 96%。这次构建放下了，下次发布前要先清空间。
- 官方部署脚本如果直接 `git pull` 生产分支，会带上服务器目前还没有的另外 5 个提交，并和本地「辅导」提交相遇。这次没有那样做。

## 16. 下一阶段

1. 在服务器写入 `OPENAI_API_KEY` 后，用站长账号打一局 OpenAI vs 手动对手，确认非法着法不会落下。
2. 把对局状态放到主站，服务器自己生成合法着法。
3. 补「前 / 中 / 后」记谱测试后再实现。
4. 清理磁盘，再考虑把生产分支和这台机器的差异收干净。

## 冒烟

2026-09-30 线上：

- 首页、健康检查、日事、论坛、账号中心健康检查均为 200
- 未登录不能打开棋盘，也不能调用 OpenAI
- 学生账号同样被拒绝
- 站长能打开棋盘并下载脚本
- 走棋改为点击绿色落点后，再点「确认落子」才写入棋局。取消会回到落子前。拖拽不能直接落子。AI 走棋不需要确认。本地预览里确认「炮二平五」后，入门 AI 会回应。
- 1280、390×844、412×915 没有横向溢出，悔棋按钮高度 44px
- 手机观察模式可以退出，窄屏棋盘不超出视口

## 链接与提交

- 象棋 PR：https://github.com/yydsxwh/xiangqi/pull/1
- 主站 PR：https://github.com/yydsxwh/Andyyyds/pull/45
- 象棋提交：`04683f9`，以及写入本文件的提交
- 主站提交：`ff47d2b`
