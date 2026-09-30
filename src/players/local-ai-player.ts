import type { PlayerMove, Side } from '../domain/types.ts';
import type { MoveRequest } from '../game/turn.ts';
import type { Player } from './types.ts';

/** 与 hkm-a 三档对应：初学、进阶、大师。具体深度由以后移植的搜索决定。 */
export const LOCAL_DIFFICULTIES = ['beginner', 'intermediate', 'master'] as const;
export type LocalDifficulty = (typeof LOCAL_DIFFICULTIES)[number];

export interface LocalSearchEngine {
  findMove(input: { fen: string; turn: Side; difficulty: LocalDifficulty }): Promise<PlayerMove | null>;
}

/** 本地搜索的棋手。引擎从外面注入，便于以后换成 Worker，也便于测试。 */
export class LocalAIPlayer implements Player {
  readonly kind = 'local-ai' as const;

  constructor(
    readonly id: string,
    private readonly engine: LocalSearchEngine,
    readonly difficulty: LocalDifficulty,
  ) {}

  requestMove(request: MoveRequest): Promise<PlayerMove | null> {
    return this.engine.findMove({
      fen: request.fen,
      turn: request.turn,
      difficulty: this.difficulty,
    });
  }
}
