/**
 * 浏览器侧只认这条同域路径。
 * 真正的会话鉴权和 OpenAI 调用在主站
 * POST /api/games/xiangqi/openai-move。
 *
 * TODO before public release: move match authority to server.
 * 开放给普通用户使用 OpenAI 之前，服务器必须自己保存局面并生成合法着法。
 */

export const OPENAI_MOVE_ROUTE = '/api/games/xiangqi/openai-move';
export const ACCESS_ROUTE = '/api/games/xiangqi/access';
