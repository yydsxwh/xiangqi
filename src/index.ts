export { BOARD_COLS, BOARD_ROWS, START_FEN } from './domain/types.ts';
export type { PlayerMove, Side, Square } from './domain/types.ts';
export { isUcciMove, parseUcciMove, squareToUcci, ucciToSquare } from './domain/coordinates.ts';
export { explainPlain } from './domain/explain.ts';
export {
  createInitialPosition,
  fenOf,
  legalUcciMoves,
  playUcci,
  replay,
} from './domain/position.ts';
export type { EndKind, MoveRecord, Position } from './domain/position.ts';
export { matchFen, seatForTurn, sideToMove } from './game/match.ts';
export type { MatchMode, MatchSnapshot } from './game/match.ts';
export { moveRequestFor, requestTurnMove } from './game/turn.ts';
export type { MoveRequest } from './game/turn.ts';
export { acceptModelMove, parseOpenAIMoveBody } from './openai/validate.ts';
export { createTurnLock, turnKey } from './openai/lock.ts';
export { createPlayer } from './players/create-player.ts';
export type { PlayerSpec } from './players/create-player.ts';
export { FutureAIPlayer } from './players/future-ai-player.ts';
export { HumanPlayer } from './players/human-player.ts';
export { LocalAIPlayer } from './players/local-ai-player.ts';
export type { LocalDifficulty, LocalSearchEngine } from './players/local-ai-player.ts';
export { CloudAIPlayer } from './players/cloud-ai-player.ts';
export type { CloudAiMoveTransport } from './players/cloud-ai-player.ts';
export { OpenAIPlayer } from './players/openai-player.ts';
export type { OpenAIMoveTransport } from './players/openai-player.ts';
export { PikafishPlayer } from './players/pikafish-player.ts';
export type { UciTransport } from './players/pikafish-player.ts';
export type { Player, PlayerKind } from './players/types.ts';
export type { GameCapabilities } from './permissions/access.ts';
export { ACCESS_ROUTE, CLOUD_AI_MOVE_ROUTE } from './server/cloud-ai-route.ts';
export { OPENAI_MOVE_ROUTE } from './server/openai-move.ts';
export { createBoardViewModel } from './ui/board-view.ts';
export type { BoardIntent, BoardViewModel } from './ui/board-view.ts';
export { metricsForWidth, nearestSquare, squareCenter } from './ui/geometry.ts';
