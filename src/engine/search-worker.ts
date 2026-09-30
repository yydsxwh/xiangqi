import { squareToUcci } from '../domain/coordinates.ts';
import { findBestMove } from './ai.js';
import { fenToBoard } from './fen.js';

interface SearchJob {
  fen: string;
  sideToMove: 'red' | 'black';
  difficulty: number;
  requestId: number;
}

self.onmessage = (event: MessageEvent<SearchJob>) => {
  const { fen, sideToMove, difficulty, requestId } = event.data;
  const board = fenToBoard(fen);
  if (!board) {
    self.postMessage({ requestId, ucci: null });
    return;
  }
  const result = findBestMove(board, sideToMove, difficulty) as {
    fromRow: number;
    fromCol: number;
    toRow: number;
    toCol: number;
  } | null;
  if (!result) {
    self.postMessage({ requestId, ucci: null });
    return;
  }
  const ucci = squareToUcci({ row: result.fromRow, col: result.fromCol })
    + squareToUcci({ row: result.toRow, col: result.toCol });
  self.postMessage({ requestId, ucci });
};
