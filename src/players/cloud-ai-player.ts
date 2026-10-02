import type { PlayerMove, Side } from '../domain/types.ts';
import type { MoveRequest } from '../game/turn.ts';
import type { Player } from './types.ts';

/**
 * 浏览器侧的云端棋手。
 * 这里没有模型 SDK，也没有密钥。transport 必须请求我们自己的服务端，
 * 由主站按当前配置选择厂商和协议。
 */
export interface CloudAiMoveTransport {
  requestMove(input: {
    matchId: string;
    fen: string;
    sideToMove: Side;
    legalMoves: readonly string[];
    recentNotation: readonly string[];
    turnId: string;
  }): Promise<PlayerMove | null>;
}

export class CloudAIPlayer implements Player {
  readonly kind = 'cloud-ai' as const;

  constructor(
    readonly id: string,
    private readonly transport: CloudAiMoveTransport,
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
