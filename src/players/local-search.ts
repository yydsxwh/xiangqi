import type { Side } from '../domain/types.ts';
import { fenToBoard } from '../engine/fen.js';
import { findBestMove } from '../engine/ai.js';
import { squareToUcci } from '../domain/coordinates.ts';
import type { LocalDifficulty } from './local-ai-player.ts';

export function difficultyLevel(difficulty: LocalDifficulty): number {
  if (difficulty === 'beginner') return 1;
  if (difficulty === 'intermediate') return 2;
  return 3;
}

export function searchLocalMoveSync(fen: string, sideToMove: Side, difficulty: LocalDifficulty): string | null {
  const board = fenToBoard(fen);
  if (!board) return null;
  const result = findBestMove(board, sideToMove, difficultyLevel(difficulty)) as {
    fromRow: number;
    fromCol: number;
    toRow: number;
    toCol: number;
  } | null;
  if (!result) return null;
  return squareToUcci({ row: result.fromRow, col: result.fromCol })
    + squareToUcci({ row: result.toRow, col: result.toCol });
}

let worker: Worker | null = null;
let sequence = 0;

/** 搜索放在 Worker。失败时退回主线程，避免界面直接崩溃。 */
export function searchLocalMove(fen: string, sideToMove: Side, difficulty: LocalDifficulty): Promise<string | null> {
  if (typeof Worker === 'undefined' || typeof window === 'undefined') {
    return Promise.resolve(searchLocalMoveSync(fen, sideToMove, difficulty));
  }
  if (!worker) {
    worker = new Worker(new URL('../engine/search-worker.ts', import.meta.url), { type: 'module' });
  }
  const requestId = ++sequence;
  const current = worker;
  return new Promise((resolve, reject) => {
    const timer = window.setTimeout(() => {
      current.removeEventListener('message', onMessage);
      current.terminate();
      if (worker === current) worker = null;
      reject(new Error('本地 AI 超时'));
    }, 20000);
    function onMessage(event: MessageEvent<{ requestId: number; ucci: string | null }>) {
      if (event.data.requestId !== requestId) return;
      window.clearTimeout(timer);
      current.removeEventListener('message', onMessage);
      resolve(event.data.ucci);
    }
    current.addEventListener('message', onMessage);
    current.postMessage({
      fen,
      sideToMove,
      difficulty: difficultyLevel(difficulty),
      requestId,
    });
  });
}
