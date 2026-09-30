import type { PlayerMove } from '../domain/types.ts';
import type { MoveRequest } from '../game/turn.ts';
import type { Player } from './types.ts';

/** 以后的引擎沿用同一接口。当前调用会明确失败，而不是假装会下棋。 */
export class FutureAIPlayer implements Player {
  readonly kind = 'future' as const;

  constructor(
    readonly id: string,
    readonly provider: string,
  ) {}

  requestMove(_request: MoveRequest): Promise<PlayerMove | null> {
    return Promise.reject(new Error(`棋手 ${this.provider} 尚未实现`));
  }
}
