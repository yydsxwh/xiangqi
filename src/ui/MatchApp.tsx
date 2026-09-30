import { useEffect, useMemo, useState } from 'react';
import { explainPlain } from '../domain/explain.ts';
import {
  createInitialPosition,
  destinationsFrom,
  legalUcciMoves,
  playUcci,
  replay,
  type MoveRecord,
} from '../domain/position.ts';
import type { PlayerMove, Side } from '../domain/types.ts';
import { seatForTurn, sideToMove, type MatchMode, type MatchSnapshot } from '../game/match.ts';
import { moveRequestFor } from '../game/turn.ts';
import { LocalAIPlayer, type LocalDifficulty } from '../players/local-ai-player.ts';
import { searchLocalMove } from '../players/local-search.ts';
import { OpenAIPlayer } from '../players/openai-player.ts';
import { OPENAI_MOVE_ROUTE } from '../server/openai-move.ts';
import { acceptModelMove } from '../openai/validate.ts';
import { XiangqiBoard } from './XiangqiBoard.tsx';

interface Usage {
  calls: number;
  inputTokens: number;
  outputTokens: number;
  reasoningTokens: number;
  model: string;
  lastMs: number;
}

const EMPTY_USAGE: Usage = {
  calls: 0,
  inputTokens: 0,
  outputTokens: 0,
  reasoningTokens: 0,
  model: '',
  lastMs: 0,
};

export function MatchApp() {
  const [setupOpen, setSetupOpen] = useState(true);
  const [mode, setMode] = useState<MatchMode>('human-vs-local');
  const [humanSide, setHumanSide] = useState<Side>('red');
  const [difficulty, setDifficulty] = useState<LocalDifficulty>('intermediate');
  const [manualName, setManualName] = useState('豆包');
  const [match, setMatch] = useState<MatchSnapshot>(() => createMatch('human-vs-local', 'red', 'intermediate', '豆包'));
  const [selected, setSelected] = useState<string | null>(null);
  const [flipped, setFlipped] = useState(false);
  const [observe, setObserve] = useState(false);
  const [drawer, setDrawer] = useState(false);
  const [thinking, setThinking] = useState(false);
  const [notice, setNotice] = useState('');
  const [hoverMove, setHoverMove] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [usage, setUsage] = useState<Usage>(EMPTY_USAGE);
  const [width, setWidth] = useState(520);
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    const node = document.getElementById('board-slot');
    if (!node) return;
    const apply = () => {
      const next = Math.min(node.clientWidth, observe ? 920 : 640);
      setWidth(Math.max(260, next));
    };
    apply();
    const observer = new ResizeObserver(apply);
    observer.observe(node);
    return () => observer.disconnect();
  }, [observe, setupOpen]);

  useEffect(() => {
    const seat = seatForTurn(match);
    if (setupOpen || thinking) return;
    if (match.status === 'checkmate' || match.status === 'stalemate' || match.status === 'draw') return;
    if (seat.kind === 'human') return;
    const request = moveRequestFor(match);
    let cancelled = false;
    setThinking(true);
    setNotice(seat.kind === 'openai' ? 'OpenAI 思考中…' : '本地 AI 思考中…');
    const started = Date.now();
    void runEngine(match, seat.kind, difficulty)
      .then((move) => {
        if (cancelled) return;
        if (!move || !acceptModelMove(move.ucci, request.legalMoves)) {
          setNotice(move ? '这步不在合法着法里，没有落子。' : '这一手没有得到着法。');
          return;
        }
        applyMove(move, seat.kind, started);
      })
      .catch((error: unknown) => {
        if (!cancelled) setNotice(error instanceof Error ? error.message : 'AI 出错了，棋盘仍然可用。');
      })
      .finally(() => {
        if (!cancelled) setThinking(false);
      });
    return () => {
      cancelled = true;
    };
  }, [match, setupOpen, difficulty, attempt]);

  const destinations = selected ? destinationsFrom(match.position, ...squareParts(selected)) : [];
  const last = match.history.at(-1);
  const lastMove = hoverMove
    ? [hoverMove.slice(0, 2), hoverMove.slice(2, 4)] as [string, string]
    : last
      ? [last.ucci.slice(0, 2), last.ucci.slice(2, 4)] as [string, string]
      : null;

  function applyMove(move: PlayerMove, kind: string, startedAt: number) {
    const played = playUcci(match.position, move.ucci, {
      playerKind: kind,
      ply: match.history.length + 1,
      startedAt,
      completedAt: Date.now(),
      thinkingMs: move.thinkingMs ?? Date.now() - startedAt,
      ai: move.model
        ? {
            provider: kind,
            model: move.model,
            inputTokens: move.usage?.inputTokens,
            outputTokens: move.usage?.outputTokens,
            reasoningTokens: move.usage?.reasoningTokens,
            requestId: move.requestId,
          }
        : undefined,
    });
    if (!played.ok) {
      setNotice(played.reason);
      return;
    }
    if (move.usage) {
      setUsage((current) => ({
        calls: current.calls + 1,
        inputTokens: current.inputTokens + move.usage!.inputTokens,
        outputTokens: current.outputTokens + move.usage!.outputTokens,
        reasoningTokens: current.reasoningTokens + (move.usage!.reasoningTokens ?? 0),
        model: move.model || current.model,
        lastMs: move.thinkingMs ?? Date.now() - startedAt,
      }));
    }
    setMatch({
      ...match,
      position: played.position,
      history: [...match.history, played.record],
      status: played.end.status,
      subStatus: played.end.subStatus,
    });
    setSelected(null);
    setNotice(move.reason ? `${played.record.notation} · ${move.reason}` : statusLine(played.end.status, played.end.subStatus, played.position.sideToMove));
  }

  function onPick(square: string) {
    if (thinking || seatForTurn(match).kind !== 'human') return;
    if (selected && destinations.includes(square)) {
      const played = playHuman(`${selected}${square}`);
      if (played) return;
    }
    const [row, col] = squareParts(square);
    const piece = match.position.board[row][col];
    setSelected(piece && piece.color === sideToMove(match) ? square : null);
  }

  function playHuman(ucci: string) {
    if (!legalUcciMoves(match.position).includes(ucci)) {
      setNotice('这步不合法');
      setSelected(null);
      return false;
    }
    applyMove({ ucci }, 'human', Date.now());
    return true;
  }

  function undo() {
    if (thinking || match.history.length === 0) return;
    const other = match.seats[match.position.sideToMove === 'red' ? 'black' : 'red'];
    const plies = other.kind === 'human' ? 1 : Math.min(2, match.history.length);
    const history = match.history.slice(0, -plies);
    const restored = replay(history);
    setMatch({
      ...match,
      position: restored.position,
      history,
      status: restored.end.status,
      subStatus: restored.end.subStatus,
    });
    setSelected(null);
    setNotice('已悔棋');
  }

  function start() {
    const next = createMatch(mode, humanSide, difficulty, manualName.trim() || '手动对手');
    setMatch(next);
    setUsage(EMPTY_USAGE);
    setSelected(null);
    setFlipped(humanSide === 'black');
    setNotice('');
    setSetupOpen(false);
  }

  const status = statusLine(match.status, match.subStatus, sideToMove(match));
  const capturedRed = match.history.filter((record) => record.side === 'black' && record.capturedPiece);
  const capturedBlack = match.history.filter((record) => record.side === 'red' && record.capturedPiece);

  return (
    <div className={observe ? 'app-shell observe' : 'app-shell'}>
      <header className="topbar">
        <a href="/games">游戏中心</a>
        <strong>中国象棋</strong>
        <span>{status}</span>
        {observe ? (
          <button type="button" onClick={() => setObserve(false)}>退出观察模式</button>
        ) : null}
      </header>
      <div className="layout">
        <section className="stage">
          <PlayerBar
            name={match.seats[flipped ? 'red' : 'black'].name}
            active={sideToMove(match) === (flipped ? 'red' : 'black')}
            captured={flipped ? capturedRed : capturedBlack}
          />
          <div id="board-slot">
            <XiangqiBoard
              position={match.position}
              width={width}
              flipped={flipped}
              selected={selected}
              destinations={thinking ? [] : destinations}
              lastMove={lastMove}
              inCheck={match.status === 'check' || match.status === 'checkmate'}
              interactive={!thinking && !setupOpen && seatForTurn(match).kind === 'human' && match.status !== 'checkmate' && match.status !== 'draw' && match.status !== 'stalemate'}
              reducedMotion={reducedMotion}
              onPick={onPick}
              onDrop={(from, to) => playHuman(`${from}${to}`)}
            />
          </div>
          <PlayerBar
            name={match.seats[flipped ? 'black' : 'red'].name}
            active={sideToMove(match) === (flipped ? 'black' : 'red')}
            captured={flipped ? capturedBlack : capturedRed}
          />
          {(match.status === 'checkmate' || match.status === 'stalemate' || match.status === 'draw') && (
            <div className="overlay" role="status">{status}</div>
          )}
        </section>
        <aside className="side">
          <p className="notice" role="status">{thinking ? (seatForTurn(match).kind === 'openai' ? 'OpenAI 思考中…' : '本地 AI 思考中…') : notice || '点击或拖动棋子'}</p>
          <div className="actions">
            <button type="button" onClick={undo} disabled={thinking || match.history.length === 0}>悔棋</button>
            <button type="button" onClick={() => setFlipped((value) => !value)}>翻转</button>
            <button type="button" onClick={() => { setMatch(createMatch(mode, humanSide, difficulty, manualName)); setUsage(EMPTY_USAGE); setNotice('已重新开始'); }}>重新开始</button>
            <button type="button" onClick={() => setSetupOpen(true)}>新对局</button>
            <button type="button" aria-pressed={observe} onClick={() => setObserve((value) => !value)}>
              {observe ? '退出观察模式' : '手机观察模式'}
            </button>
            <button type="button" className="drawer-toggle" onClick={() => setDrawer((value) => !value)}>棋谱</button>
          </div>
          {notice && !thinking ? (
            <div className="recover">
              <button type="button" onClick={() => setNotice('')}>继续手动下</button>
              <button type="button" onClick={() => { setMode('human-vs-local'); setNotice('下一手可在新对局里改用本地 AI。当前局面请继续手动，或点重新开始。'); }}>改用本地 AI 请重新开始</button>
              <button type="button" disabled={thinking || seatForTurn(match).kind === 'human'} onClick={() => setAttempt((value) => value + 1)}>重新思考</button>
            </div>
          ) : null}
          <section className={drawer ? 'history open' : 'history'}>
            <h2>棋谱</h2>
            <ol>
              {match.history.map((record) => (
                <li
                  key={record.ply}
                  onMouseEnter={() => setHoverMove(record.ucci)}
                  onMouseLeave={() => setHoverMove(null)}
                  onFocus={() => setHoverMove(record.ucci)}
                  onBlur={() => setHoverMove(null)}
                  tabIndex={0}
                >
                  <span>{record.ply}. {record.notation}</span>
                  <small>{explainPlain(record.notation, record.side)}</small>
                </li>
              ))}
            </ol>
            <Captured title="红方吃子" records={capturedBlack} />
            <Captured title="黑方吃子" records={capturedRed} />
            {usage.calls > 0 ? (
              <div className="usage">
                <p>模型 {usage.model || '未返回名称'}</p>
                <p>调用 {usage.calls} 次 · 上一步 {usage.lastMs} ms</p>
                <p>Input {usage.inputTokens} · Output {usage.outputTokens} · Reasoning {usage.reasoningTokens}</p>
              </div>
            ) : null}
            <button type="button" className="drawer-toggle" onClick={() => setDrawer(false)}>关闭棋谱</button>
          </section>
        </aside>
      </div>
      {setupOpen ? (
        <form className="setup" onSubmit={(event) => { event.preventDefault(); start(); }}>
          <h2>新对局</h2>
          <label>方式
            <select value={mode} onChange={(event) => setMode(event.target.value as MatchMode)}>
              <option value="human-vs-human">本地双人</option>
              <option value="human-vs-local">人类 vs 本地 AI</option>
              <option value="openai-vs-human">OpenAI vs 手动对手</option>
            </select>
          </label>
          {mode !== 'human-vs-human' ? (
            <label>我执
              <select value={humanSide} onChange={(event) => setHumanSide(event.target.value as Side)}>
                <option value="red">红方先走</option>
                <option value="black">黑方</option>
              </select>
            </label>
          ) : null}
          {mode === 'human-vs-local' ? (
            <label>难度
              <select value={difficulty} onChange={(event) => setDifficulty(event.target.value as LocalDifficulty)}>
                <option value="beginner">入门</option>
                <option value="intermediate">进阶</option>
                <option value="master">大师</option>
              </select>
            </label>
          ) : null}
          {mode === 'openai-vs-human' ? (
            <label>手动对手
              <input value={manualName} maxLength={16} onChange={(event) => setManualName(event.target.value)} />
            </label>
          ) : null}
          <button type="submit">开始</button>
        </form>
      ) : null}
    </div>
  );
}

function PlayerBar({ name, active, captured }: { name: string; active: boolean; captured: MoveRecord[] }) {
  return (
    <div className={active ? 'player active' : 'player'}>
      <strong>{name}</strong>
      <span>{active ? '轮到这方' : '等待'}</span>
      <em>{captured.map((record) => record.capturedPiece).join(' ')}</em>
    </div>
  );
}

function Captured({ title, records }: { title: string; records: MoveRecord[] }) {
  return <p className="captured">{title}：{records.map((record) => record.capturedPiece).join(' ') || '无'}</p>;
}

function createMatch(mode: MatchMode, humanSide: Side, _difficulty: LocalDifficulty, manualName: string): MatchSnapshot {
  const humanName = mode === 'openai-vs-human' ? manualName : '我';
  const human = { playerId: 'human', kind: 'human' as const, name: humanName };
  const rival = mode === 'human-vs-local'
    ? { playerId: 'local', kind: 'local-ai' as const, name: '本地 AI' }
    : mode === 'openai-vs-human'
      ? { playerId: 'openai', kind: 'openai' as const, name: 'OpenAI' }
      : { playerId: 'other', kind: 'human' as const, name: '对方' };
  const red = mode === 'human-vs-human' || humanSide === 'red' ? (mode === 'human-vs-human' ? { ...human, playerId: 'red', name: '红方' } : human) : rival;
  const black = mode === 'human-vs-human'
    ? { playerId: 'black', kind: 'human' as const, name: '黑方' }
    : humanSide === 'black' ? human : rival;
  return {
    id: Math.random().toString(36).slice(2, 10),
    mode,
    position: createInitialPosition(),
    history: [],
    status: 'ongoing',
    subStatus: null,
    seats: { red, black },
  };
}

async function runEngine(match: MatchSnapshot, kind: string, difficulty: LocalDifficulty): Promise<PlayerMove | null> {
  const request = moveRequestFor(match);
  if (kind === 'local-ai') {
    const player = new LocalAIPlayer('local', {
      findMove: async (input) => {
        const ucci = await searchLocalMove(input.fen, input.sideToMove, input.difficulty);
        return ucci ? { ucci } : null;
      },
    }, difficulty);
    return player.requestMove(request);
  }
  const player = new OpenAIPlayer('openai', {
    requestMove: async (input) => {
      const response = await fetch(OPENAI_MOVE_ROUTE, {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(input),
      });
      const payload = await response.json().catch(() => ({})) as PlayerMove & { reason?: string; message?: string };
      if (!response.ok) throw new Error(payload.reason || payload.message || 'OpenAI 请求被拒绝');
      return payload;
    },
  });
  return player.requestMove(request);
}

function squareParts(square: string): [number, number] {
  const col = square.charCodeAt(0) - 97;
  const row = 9 - Number(square[1]);
  return [row, col];
}

function statusLine(status: MatchSnapshot['status'], subStatus: MatchSnapshot['subStatus'], side: Side): string {
  const who = side === 'red' ? '红方' : '黑方';
  if (status === 'checkmate' && subStatus === 'perpetual_check') return '长将，对局结束';
  if (status === 'checkmate') return `${who === '红方' ? '黑方' : '红方'}胜`;
  if (status === 'stalemate') return '困毙，和棋';
  if (status === 'draw') return '三次重复，和棋';
  if (status === 'check') return `${who}被将军`;
  return `轮到${who}`;
}

function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const apply = () => setReduced(media.matches);
    apply();
    media.addEventListener('change', apply);
    return () => media.removeEventListener('change', apply);
  }, []);
  return reduced;
}

