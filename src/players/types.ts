import type { PlayerMove } from '../domain/types.ts';
import type { MoveRequest } from '../game/turn.ts';

export const PLAYER_KINDS = ['human', 'local-ai', 'cloud-ai', 'openai', 'pikafish', 'hybrid', 'future'] as const;
export type PlayerKind = (typeof PLAYER_KINDS)[number];

/** 所有棋手的统一入口。棋盘和规则都不知道具体种类。 */
export interface Player {
  readonly id: string;
  readonly kind: PlayerKind;
  requestMove(request: MoveRequest): Promise<PlayerMove | null>;
}
