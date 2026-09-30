import type { PlayerMove } from '../domain/types.ts';
import type { MoveRequest } from '../game/turn.ts';
import type { Player } from './types.ts';

/**
 * Pikafish 通过外部 UCI 进程对话。
 * GPL-3.0 引擎不放进本仓库，也不由这个类加载 WASM。
 */
export interface UciTransport {
  bestMove(input: { fen: string; depth: number }): Promise<string | null>;
}

export class PikafishPlayer implements Player {
  readonly kind = 'pikafish' as const;
  readonly distribution = 'external-process' as const;

  constructor(
    readonly id: string,
    private readonly transport: UciTransport,
    readonly depth = 8,
  ) {}

  async requestMove(request: MoveRequest): Promise<PlayerMove | null> {
    const ucci = await this.transport.bestMove({ fen: request.fen, depth: this.depth });
    if (!ucci) return null;
    return { ucci };
  }
}
