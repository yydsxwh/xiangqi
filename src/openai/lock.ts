/**
 * 同一局同一局面只允许一个进行中的 OpenAI 请求。
 * 主站进程内使用。多实例部署前要换成共享存储。
 */

export interface TurnLock {
  tryBegin(key: string, turnId: string): boolean;
  finish(key: string, turnId: string): void;
}

export function createTurnLock(): TurnLock {
  const inflight = new Map<string, string>();
  return {
    tryBegin(key, turnId) {
      const current = inflight.get(key);
      if (current && current !== turnId) return false;
      if (current === turnId) return false;
      inflight.set(key, turnId);
      return true;
    },
    finish(key, turnId) {
      if (inflight.get(key) === turnId) inflight.delete(key);
    },
  };
}

export function turnKey(matchId: string, fen: string): string {
  return `${matchId}\n${fen}`;
}
