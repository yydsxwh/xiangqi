import type { PlayerMove, Side } from '../domain/types.ts';
import type { MoveRequest } from '../game/turn.ts';
import type { Player } from './types.ts';

/**
 * 浏览器侧的 OpenAI 棋手。
 * 这里没有模型 SDK，也没有密钥。transport 必须请求我们自己的服务端。
 */
export interface OpenAIMoveTransport {
  requestMove(input: {
    matchId: string;
    fen: string;
    sideToMove: Side;
    legalMoves: readonly string[];
    recentNotation: readonly string[];
    turnId: string;
  }): Promise<PlayerMove | null>;
}

export class OpenAIPlayer implements Player {
  readonly kind = 'openai' as const;

  constructor(
    readonly id: string,
    private readonly transport: OpenAIMoveTransport,
  ) {}

  requestMove(request: MoveRequest): Promise<PlayerMove | null> {
    return this.transport.requestMove({
      matchId: request.matchId,
      fen: request.fen,
      sideToMove: request.sideToMove,
      legalMoves: request.legalMoves,
      recentNotation: request.recentNotation,
      turnId: request.turnId,
    });
  }
}
