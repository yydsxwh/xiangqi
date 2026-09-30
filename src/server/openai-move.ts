import { canUseOpenAI, type Role } from '../permissions/access.ts';

/** 浏览器只能打到我们自己的这个路径。角色由会话决定，不来自请求体。 */
export const OPENAI_MOVE_ROUTE = '/api/matches/:matchId/ai/openai';

export interface Actor {
  userId: string;
  role: Role;
}

export type OpenAIMoveResponse =
  | { ok: false; status: 401 | 403 | 501; reason: string };

/**
 * 本轮的 OpenAI 入口。
 * 鉴权在服务端完成。即便站长通过鉴权，也返回 501，因为模型调用还没有接上。
 */
export function handleOpenAIMoveRequest(actor: Actor | null): OpenAIMoveResponse {
  if (!actor || actor.role === 'ANONYMOUS') {
    return { ok: false, status: 401, reason: '未登录用户不能调用 OpenAI' };
  }
  if (!canUseOpenAI(actor.role)) {
    return { ok: false, status: 403, reason: '当前账号不能调用 OpenAI' };
  }
  return { ok: false, status: 501, reason: 'OpenAI 接入尚未启用' };
}
