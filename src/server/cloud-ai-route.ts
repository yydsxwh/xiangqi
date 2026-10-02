/**
 * 浏览器侧只认同域路径。
 * 真正的会话鉴权和模型调用在主站 POST /api/games/xiangqi/ai-move。
 *
 * TODO before public release: move match authority to server.
 * 开放给普通用户使用云端 AI 之前，服务器必须自己保存局面并生成合法着法。
 */

export const CLOUD_AI_MOVE_ROUTE = '/api/games/xiangqi/ai-move';
export const ENGINE_MOVE_ROUTE = '/api/games/xiangqi/engine-move';
export const HYBRID_MOVE_ROUTE = '/api/games/xiangqi/hybrid-move';
export const EXPLAIN_MOVE_ROUTE = '/api/games/xiangqi/explain-move';
export const ACCESS_ROUTE = '/api/games/xiangqi/access';
