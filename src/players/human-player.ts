import type { PlayerMove } from '../domain/types.ts';
import type { MoveRequest } from '../game/turn.ts';
import type { Player } from './types.ts';

/** 等人从界面提交一步。不会自己产生着法。 */
export class HumanPlayer implements Player {
  readonly kind = 'human' as const;
  private pending: ((move: PlayerMove | null) => void) | null = null;

  constructor(readonly id: string) {}

  requestMove(_request: MoveRequest): Promise<PlayerMove | null> {
    this.cancel();
    return new Promise((resolve) => {
      this.pending = resolve;
    });
  }

  submit(move: PlayerMove): void {
    this.pending?.(move);
    this.pending = null;
  }

  cancel(): void {
    this.pending?.(null);
    this.pending = null;
  }
}
