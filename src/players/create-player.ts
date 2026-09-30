import { FutureAIPlayer } from './future-ai-player.ts';
import { HumanPlayer } from './human-player.ts';
import { LocalAIPlayer, type LocalDifficulty, type LocalSearchEngine } from './local-ai-player.ts';
import { OpenAIPlayer, type OpenAIMoveTransport } from './openai-player.ts';
import { PikafishPlayer, type UciTransport } from './pikafish-player.ts';
import type { Player } from './types.ts';

export type PlayerSpec =
  | { kind: 'human'; id: string }
  | { kind: 'local-ai'; id: string; difficulty: LocalDifficulty; engine: LocalSearchEngine }
  | { kind: 'openai'; id: string; transport: OpenAIMoveTransport }
  | { kind: 'pikafish'; id: string; transport: UciTransport; depth?: number }
  | { kind: 'future'; id: string; provider: string };

export function createPlayer(spec: PlayerSpec): Player {
  switch (spec.kind) {
    case 'human':
      return new HumanPlayer(spec.id);
    case 'local-ai':
      return new LocalAIPlayer(spec.id, spec.engine, spec.difficulty);
    case 'openai':
      return new OpenAIPlayer(spec.id, spec.transport);
    case 'pikafish':
      return new PikafishPlayer(spec.id, spec.transport, spec.depth);
    case 'future':
      return new FutureAIPlayer(spec.id, spec.provider);
  }
}
