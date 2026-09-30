import { useEffect, useMemo, useRef, useState } from 'react';
import { ucciToSquare } from '../domain/coordinates.ts';
import { pieceLabel, type Piece, type Position } from '../domain/position.ts';
import { metricsForWidth, nearestSquare, squareCenter, type BoardMetrics } from './geometry.ts';
import './board.css';

interface Props {
  position: Position;
  width: number;
  flipped: boolean;
  selected: string | null;
  destinations: readonly string[];
  lastMove: readonly [string, string] | null;
  inCheck: boolean;
  interactive: boolean;
  reducedMotion: boolean;
  onPick: (square: string) => void;
  onDrop: (from: string, to: string) => void;
}

const RED_FILES = ['九', '八', '七', '六', '五', '四', '三', '二', '一'];
const BLACK_FILES = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];
const STARS: Array<[number, number]> = [
  [3, 0], [3, 2], [3, 4], [3, 6], [3, 8],
  [6, 0], [6, 2], [6, 4], [6, 6], [6, 8],
  [2, 1], [2, 7], [7, 1], [7, 7],
];

export function XiangqiBoard({
  position,
  width,
  flipped,
  selected,
  destinations,
  lastMove,
  inCheck,
  interactive,
  reducedMotion,
  onPick,
  onDrop,
}: Props) {
  const metrics = metricsForWidth(width);
  const frameRef = useRef<HTMLDivElement>(null);
  const suppressClick = useRef(false);
  const drag = useRef<{ from: string; x: number; y: number; moved: boolean; piece: Piece } | null>(null);
  const [ghost, setGhost] = useState<{ from: string; x: number; y: number; piece: Piece } | null>(null);
  const [arrived, setArrived] = useState(false);
  const lastKey = lastMove ? lastMove.join('') : '';

  useEffect(() => {
    if (!lastMove || reducedMotion) {
      setArrived(true);
      return;
    }
    setArrived(false);
    const frame = requestAnimationFrame(() => setArrived(true));
    return () => cancelAnimationFrame(frame);
  }, [lastKey, reducedMotion, lastMove]);

  const king = useMemo(() => {
    if (!inCheck) return null;
    for (let row = 0; row < 10; row += 1) {
      for (let col = 0; col < 9; col += 1) {
        const piece = position.board[row][col];
        if (piece?.type === 'king' && piece.color === position.sideToMove) {
          return squareKey(row, col);
        }
      }
    }
    return null;
  }, [inCheck, position]);

  function pointerDown(event: React.PointerEvent, square: string, piece: Piece) {
    if (!interactive || piece.color !== position.sideToMove) return;
    frameRef.current?.setPointerCapture(event.pointerId);
    const rect = (event.currentTarget.parentElement as HTMLElement).getBoundingClientRect();
    drag.current = {
      from: square,
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
      moved: false,
      piece,
    };
    setGhost(null);
  }

  function pointerMove(event: React.PointerEvent) {
    if (!drag.current) return;
    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    const start = squareCenter(ucciToSquare(drag.current.from), metrics, flipped);
    if (Math.hypot(x - start.x, y - start.y) > 8) drag.current.moved = true;
    if (drag.current.moved) {
      setGhost({ from: drag.current.from, x, y, piece: drag.current.piece });
    }
  }

  function pointerUp(event: React.PointerEvent) {
    const current = drag.current;
    drag.current = null;
    setGhost(null);
    if (!current) return;
    if (!current.moved) return;
    suppressClick.current = true;
    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
    const hit = nearestSquare(event.clientX - rect.left, event.clientY - rect.top, metrics, flipped);
    if (!hit) return;
    const target = squareKey(hit.row, hit.col);
    const fromPoint = ucciToSquare(current.from);
    const dest = squareKey(fromPoint.row, fromPoint.col) === current.from
      ? target
      : target;
    if (destinations.includes(dest) || (selected === current.from && destinations.includes(dest))) {
      onDrop(current.from, dest);
    }
  }

  const topLabels = flipped ? [...RED_FILES].reverse() : BLACK_FILES;
  const bottomLabels = flipped ? [...BLACK_FILES].reverse() : RED_FILES;
  const movingTo = lastMove?.[1];

  return (
    <div
      ref={frameRef}
      className="board-frame"
      style={{ width: metrics.width, height: metrics.height }}
      onPointerMove={pointerMove}
      onPointerUp={pointerUp}
      onPointerCancel={() => {
        drag.current = null;
        setGhost(null);
      }}
    >
      <BoardLines metrics={metrics} />
      <FileLabels labels={topLabels} metrics={metrics} edge="top" />
      <FileLabels labels={bottomLabels} metrics={metrics} edge="bottom" />
      {lastMove?.map((square) => {
        const center = squareCenter(ucciToSquare(square), metrics, flipped);
        return <span key={square} className="last-mark" style={markStyle(center, metrics.cell * 0.92)} />;
      })}
      {destinations.map((square) => {
        const point = ucciToSquare(square);
        const center = squareCenter(point, metrics, flipped);
        const occupied = Boolean(position.board[point.row][point.col]);
        return (
          <button
            key={square}
            type="button"
            className={occupied ? 'dest-dot dest-capture' : 'dest-dot'}
            style={markStyle(center, occupied ? metrics.cell * 0.86 : metrics.cell * 0.22)}
            aria-label={`走到 ${square}`}
            onClick={() => selected && onDrop(selected, square)}
          />
        );
      })}
      {king ? (
        <span
          className="check-mark"
          style={markStyle(squareCenter(ucciToSquare(king), metrics, flipped), metrics.cell * 0.92)}
        />
      ) : null}
      {position.board.flatMap((row, rowIndex) => row.map((piece, col) => {
        if (!piece) return null;
        const square = squareKey(rowIndex, col);
        if (ghost?.from === square) return null;
        if (!reducedMotion && movingTo === square && !arrived) return null;
        const center = squareCenter({ row: rowIndex, col }, metrics, flipped);
        const visual = !reducedMotion && lastMove?.[0] === square && movingTo && !arrived
          ? squareCenter(ucciToSquare(lastMove[0]), metrics, flipped)
          : center;
        const shown = !reducedMotion && lastMove?.[1] === square && !arrived
          ? squareCenter(ucciToSquare(lastMove[0]), metrics, flipped)
          : visual;
        return (
          <button
            key={square}
            type="button"
            className={`board-piece ${piece.color} ${selected === square ? 'selected' : ''} ${reducedMotion ? '' : 'piece-move'}`}
            style={pieceStyle(shown, metrics)}
            disabled={!interactive}
            aria-label={`${piece.color === 'red' ? '红' : '黑'}${pieceLabel(piece)} ${square}`}
            onPointerDown={(event) => pointerDown(event, square, piece)}
            onClick={() => {
              if (suppressClick.current) {
                suppressClick.current = false;
                return;
              }
              if (interactive) onPick(square);
            }}
          >
            {pieceLabel(piece)}
          </button>
        );
      }))}
      {ghost ? (
        <span className={`board-piece ghost ${ghost.piece.color}`} style={pieceStyle({ x: ghost.x, y: ghost.y }, metrics)}>
          {pieceLabel(ghost.piece)}
        </span>
      ) : null}
    </div>
  );
}

function squareKey(row: number, col: number): string {
  return String.fromCharCode(97 + col) + String(9 - row);
}

function pieceStyle(center: { x: number; y: number }, metrics: BoardMetrics): React.CSSProperties {
  const size = metrics.cell * 0.86;
  return {
    left: center.x,
    top: center.y,
    width: size,
    height: size,
    fontSize: size * 0.52,
  };
}

function markStyle(center: { x: number; y: number }, size: number): React.CSSProperties {
  return { left: center.x, top: center.y, width: size, height: size };
}

function BoardLines({ metrics }: { metrics: BoardMetrics }) {
  const { pad, cell, width, height } = metrics;
  const x = (col: number) => pad + col * cell;
  const y = (row: number) => pad + row * cell;
  const lines = [];
  for (let col = 0; col < 9; col += 1) {
    if (col === 0 || col === 8) {
      lines.push(<line key={`v${col}`} x1={x(col)} y1={y(0)} x2={x(col)} y2={y(9)} />);
    } else {
      lines.push(<line key={`v${col}a`} x1={x(col)} y1={y(0)} x2={x(col)} y2={y(4)} />);
      lines.push(<line key={`v${col}b`} x1={x(col)} y1={y(5)} x2={x(col)} y2={y(9)} />);
    }
  }
  for (let row = 0; row < 10; row += 1) {
    lines.push(<line key={`h${row}`} x1={x(0)} y1={y(row)} x2={x(8)} y2={y(row)} />);
  }
  return (
    <svg className="board-svg" viewBox={`0 0 ${width} ${height}`} aria-hidden="true">
      <g stroke="#5c4632" strokeWidth="1.4" fill="none">
        {lines}
        <line x1={x(3)} y1={y(0)} x2={x(5)} y2={y(2)} />
        <line x1={x(5)} y1={y(0)} x2={x(3)} y2={y(2)} />
        <line x1={x(3)} y1={y(7)} x2={x(5)} y2={y(9)} />
        <line x1={x(5)} y1={y(7)} x2={x(3)} y2={y(9)} />
      </g>
      <text x={width / 2 - cell * 1.15} y={y(4) + cell * 0.62} fill="#6a5338" fontSize={cell * 0.42}>
        楚河
      </text>
      <text x={width / 2 + cell * 0.2} y={y(4) + cell * 0.62} fill="#6a5338" fontSize={cell * 0.42}>
        汉界
      </text>
      {STARS.map(([row, col]) => (
        <circle key={`${row}${col}`} cx={x(col)} cy={y(row)} r="2.2" fill="#5c4632" />
      ))}
    </svg>
  );
}

function FileLabels({
  labels,
  metrics,
  edge,
}: {
  labels: string[];
  metrics: BoardMetrics;
  edge: 'top' | 'bottom';
}) {
  return (
    <>
      {labels.map((label, index) => (
        <span
          key={`${edge}${label}${index}`}
          style={{
            position: 'absolute',
            left: metrics.pad + index * metrics.cell,
            top: edge === 'top' ? 2 : metrics.height - metrics.pad + 2,
            transform: 'translate(-50%, 0)',
            fontSize: Math.max(11, metrics.cell * 0.28),
            color: '#6d5840',
            pointerEvents: 'none',
          }}
        >
          {label}
        </span>
      ))}
    </>
  );
}
