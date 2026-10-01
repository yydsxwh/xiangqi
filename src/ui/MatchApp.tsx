import { useEffect, useMemo, useRef, useState } from 'react';
import { THEME_IDS, THEME_LABEL, THEMES, isThemeId, themeStyle, type ThemeId } from './themes.ts';
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
import { XiangqiBoard, type PendingPreview } from './XiangqiBoard.tsx';

interface Usage {
  calls: number;
  inputTokens: number;
  outputTokens: number;
  reasoningTokens: number;
  model: string;
  lastMs: number;
}

interface CloudOption {
  providerId: string;
  providerName: string;
  modelId: string;
  modelName: string;
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
  const [match, setMatch] = useState<MatchSnapshot>(() => createMatch('human-vs-local', 'red', 'intermediate', undefined));
  const [selected, setSelected] = useState<string | null>(null);
  const [pending, setPending] = useState<PendingPreview | null>(null);
  const [flipped, setFlipped] = useState(false);
  const [observe, setObserve] = useState(false);
  const [drawer, setDrawer] = useState(false);
  const [thinking, setThinking] = useState(false);
  const [notice, setNotice] = useState('');
  const [hoverMove, setHoverMove] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [usage, setUsage] = useState<Usage>(EMPTY_USAGE);
  const [width, setWidth] = useState(760);
  const [theme, setTheme] = useState<ThemeId>('walnut');
  const [canChooseTheme, setCanChooseTheme] = useState(false);
  const [canOpenAdmin, setCanOpenAdmin] = useState(false);
  const [family, setFamily] = useState<'local' | 'online' | 'ai'>('ai');
  const [aiEngine, setAiEngine] = useState<'local' | 'cloud'>('local');
  const [cloudOptions, setCloudOptions] = useState<CloudOption[]>([]);
  const [aiSource, setAiSource] = useState("");
  const [cloudId, setCloudId] = useState('');
  const [roomCode, setRoomCode] = useState('');
  const [mySeat, setMySeat] = useState<Side | ''>('');
  const [joinInput, setJoinInput] = useState('');
  const [peerOnline, setPeerOnline] = useState(false);
  const socketRef = useRef<WebSocket | null>(null);
  const [confirmMoves, setConfirmMoves] = useState(true);
  const [allowUndo, setAllowUndo] = useState(true);
  const [showNotation, setShowNotation] = useState(true);
  const [showPlain, setShowPlain] = useState(true);
  const [allowObserve, setAllowObserve] = useState(true);
  const [aiAvailable, setAiAvailable] = useState(false);
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    const node = document.getElementById('board-slot');
    if (!node) return;
    const apply = () => {
      const next = Math.min(node.clientWidth, observe ? 960 : 900);
      setWidth(Math.max(260, next));
    };
    apply();
    const observer = new ResizeObserver(apply);
    observer.observe(node);
    return () => observer.disconnect();
  }, [observe, setupOpen]);

  useEffect(() => {
    const stored = localStorage.getItem('xiangqi-theme');
    if (stored && isThemeId(stored)) setTheme(stored);
    void fetch('/api/games/xiangqi/config', { credentials: 'same-origin' })
      .then((response) => response.ok ? response.json() : null)
      .then((config) => {
        if (!config) return;
        if (!stored && isThemeId(config.defaultTheme)) setTheme(config.defaultTheme);
        if (config.defaultMode) setMode(config.defaultMode);
        if (config.defaultDifficulty) setDifficulty(config.defaultDifficulty);
        setCanChooseTheme(Boolean(config.canChooseTheme));
        setCanOpenAdmin(Boolean(config.canOpenAdmin));
        const options = Array.isArray(config.cloudOptions) ? config.cloudOptions as CloudOption[] : [];
        setCloudOptions(options);
        if (options[0]) setCloudId(`${options[0].providerId}:${options[0].modelId}`);
        if (typeof config.aiSource === "string") setAiSource(config.aiSource);
        if (config.defaultMode === 'human-vs-human') setFamily('local');
        else if (config.defaultMode === 'online-vs-human') setFamily('online');
        else if (config.defaultMode === 'human-vs-cloud' || config.defaultMode === 'openai-vs-human') {
          setFamily('ai');
          setAiEngine(options.length ? 'cloud' : 'local');
          setMode(options.length ? 'human-vs-cloud' : 'human-vs-local');
        } else setFamily('ai');
        setConfirmMoves(config.confirmMoves !== false);
        setAllowUndo(config.allowUndo !== false);
        setShowNotation(config.showNotation !== false);
        setShowPlain(config.showPlainExplanation !== false);
        setAllowObserve(config.observeMode !== false);
        setAiAvailable(Boolean(config.aiAvailable));
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    const code = new URLSearchParams(location.search).get('room');
    if (!code) return;
    void joinOnlineRoom(code);
    // 只在打开邀请链接时加入一次。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const cloudChoice = cloudOptions.find((item) => `${item.providerId}:${item.modelId}` === cloudId) ?? cloudOptions[0];

  useEffect(() => {
    const seat = seatForTurn(match);
    if (setupOpen || thinking || pending) return;
    if (match.status === 'checkmate' || match.status === 'stalemate' || match.status === 'draw') return;
    if (seat.kind === 'human' || match.mode === 'online-vs-human') return;
    const request = moveRequestFor(match);
    let cancelled = false;
    setThinking(true);
    setNotice(seat.kind === 'openai' ? `${seat.name} 思考中…` : '本地 AI 思考中…');
    const started = Date.now();
    void runEngine(match, seat.kind, difficulty, cloudChoice)
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
  }, [match, setupOpen, difficulty, attempt, pending, cloudChoice]);

  const destinations = selected && !pending ? destinationsFrom(match.position, ...squareParts(selected)) : [];
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
    setPending(null);
    setNotice(move.reason ? `${played.record.notation} · ${move.reason}` : statusLine(played.end.status, played.end.subStatus, played.position.sideToMove));
  }

  function onPick(square: string) {
    if (pending || thinking || seatForTurn(match).kind !== 'human') return;
    if (match.mode === 'online-vs-human' && mySeat && sideToMove(match) !== mySeat) return;
    if (selected && destinations.includes(square)) {
      if (!confirmMoves) {
        playHuman(`${selected}${square}`);
        return;
      }
      setPending({ from: selected, to: square });
      setSelected(null);
      const [row, col] = squareParts(square);
      setNotice(match.position.board[row][col] ? '即将吃子，确认后才会落子' : '请确认落子');
      return;
    }
    const [row, col] = squareParts(square);
    const piece = match.position.board[row][col];
    setSelected(piece && piece.color === sideToMove(match) ? square : null);
  }

  function confirmPending() {
    if (!pending) return;
    const ucci = `${pending.from}${pending.to}`;
    if (match.mode === 'online-vs-human') {
      socketRef.current?.send(JSON.stringify({ type: 'move', ucci }));
      setPending(null);
      setNotice('正在同步到对方…');
      return;
    }
    setPending(null);
    playHuman(ucci);
  }

  function cancelPending() {
    if (!pending) return;
    setSelected(pending.from);
    setPending(null);
    setNotice('已取消，棋局没有变化');
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
    setPending(null);
    setNotice('已悔棋');
  }

  function connectRoom(code: string, seat: Side) {
    socketRef.current?.close();
    const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
    const socket = new WebSocket(`${proto}//${location.host}/games/xiangqi/ws?code=${code}`);
    socketRef.current = socket;
    setRoomCode(code);
    setMySeat(seat);
    history.replaceState(null, '', `/games/xiangqi/?room=${code}`);
    setMode('online-vs-human');
    setFamily('online');
    setSetupOpen(false);
    setNotice('正在连接房间…');
    socket.onmessage = (event) => {
      const state = JSON.parse(String(event.data)) as {
        type: string;
        reason?: string;
        moves?: string[];
        you?: Side;
        redOnline?: boolean;
        blackOnline?: boolean;
      };
      if (state.type === 'error') {
        setNotice(state.reason || '这步没有被接受');
        return;
      }
      if (state.type !== 'state' || !state.moves || !state.you) return;
      setMySeat(state.you);
      setPeerOnline(state.you === 'red' ? Boolean(state.blackOnline) : Boolean(state.redOnline));
      setMatch(matchFromMoves(state.moves, state.you));
      setPending(null);
      setSelected(null);
      setNotice('');
    };
    socket.onclose = () => setNotice('连接中断，可以重新打开邀请链接。');
  }

  async function createOnlineRoom() {
    const response = await fetch('/api/games/xiangqi/rooms', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ side: humanSide }),
    });
    const payload = await response.json() as { code?: string; side?: Side; reason?: string };
    if (!response.ok || !payload.code || !payload.side) {
      setNotice(payload.reason || '创建房间失败');
      return;
    }
    connectRoom(payload.code, payload.side);
  }

  async function joinOnlineRoom(code: string) {
    const clean = code.trim().toUpperCase();
    const response = await fetch(`/api/games/xiangqi/rooms/${clean}/join`, { method: 'POST', credentials: 'same-origin' });
    const payload = await response.json() as { side?: Side; reason?: string };
    if (!response.ok || !payload.side) {
      setNotice(payload.reason || '加入失败');
      return;
    }
    connectRoom(clean, payload.side);
  }

  function start() {
    const nextMode: MatchMode = family === 'local' ? 'human-vs-human' : aiEngine === 'cloud' ? 'human-vs-cloud' : 'human-vs-local';
    setMode(nextMode);
    const next = createMatch(nextMode, humanSide, difficulty, cloudChoice);
    setMatch(next);
    setUsage(EMPTY_USAGE);
    setSelected(null);
    setPending(null);
    setFlipped(humanSide === 'black');
    setNotice('');
    setSetupOpen(false);
  }

  function chooseTheme(value: string) {
    if (!isThemeId(value)) return;
    setTheme(value);
    localStorage.setItem('xiangqi-theme', value);
  }

  const status = statusLine(match.status, match.subStatus, sideToMove(match));
  const capturedRed = match.history.filter((record) => record.side === 'black' && record.capturedPiece);
  const capturedBlack = match.history.filter((record) => record.side === 'red' && record.capturedPiece);

  return (
    <div className={observe ? 'app-shell observe' : 'app-shell'} style={themeStyle(THEMES[theme]) as React.CSSProperties}>
      <header className="topbar">
        <a href="/games">游戏中心</a>
        <strong>中国象棋</strong>
        {canOpenAdmin ? <a href="/games/xiangqi/admin">后台设置</a> : null}
        <span>{status}</span>
        {observe ? (
          <button type="button" onClick={() => setObserve(false)}>退出观察模式</button>
        ) : null}
      </header>
      <div className="layout">
        <section className="stage">
          {setupOpen ? <p className="player">棋盘预览</p> : null}
          {!setupOpen ? <PlayerBar
            name={match.seats[flipped ? 'red' : 'black'].name}
            active={sideToMove(match) === (flipped ? 'red' : 'black')}
            captured={flipped ? capturedRed : capturedBlack}
          /> : null}
          <div id="board-slot">
            <XiangqiBoard
              position={match.position}
              width={width}
              flipped={flipped}
              selected={selected}
              destinations={thinking || pending ? [] : destinations}
              pending={pending}
              lastMove={lastMove}
              inCheck={match.status === 'check' || match.status === 'checkmate'}
              interactive={!thinking && !pending && !setupOpen && seatForTurn(match).kind === 'human' && match.status !== 'checkmate' && match.status !== 'draw' && match.status !== 'stalemate'}
              reducedMotion={reducedMotion}
              onPick={onPick}
            />
          </div>
          {pending ? (
            <div className="confirm-bar">
              <button type="button" onClick={confirmPending}>确认落子</button>
              <button type="button" onClick={cancelPending}>取消</button>
            </div>
          ) : null}
          {!setupOpen ? <PlayerBar
            name={match.seats[flipped ? 'black' : 'red'].name}
            active={sideToMove(match) === (flipped ? 'black' : 'red')}
            captured={flipped ? capturedBlack : capturedRed}
          /> : null}
          {(match.status === 'checkmate' || match.status === 'stalemate' || match.status === 'draw') && (
            <div className="overlay" role="status">{status}</div>
          )}
        </section>
        <aside className="side">
          {setupOpen ? (
            <form className="setup-form" onSubmit={(event) => { event.preventDefault(); start(); }}>
              <h2>新对局</h2>
              <label>方式
                <select value={family} onChange={(event) => setFamily(event.target.value as 'local' | 'online' | 'ai')}>
                  <option value="local">本地双人</option>
                  <option value="online">联网双人</option>
                  <option value="ai">人类 vs AI</option>
                </select>
              </label>
              {family !== 'local' ? (
                <label>我执
                  <select value={humanSide} onChange={(event) => setHumanSide(event.target.value as Side)}>
                    <option value="red">红方</option>
                    <option value="black">黑方</option>
                  </select>
                </label>
              ) : null}
              {family === 'ai' ? (
                <label>对手
                  <select value={aiEngine} onChange={(event) => setAiEngine(event.target.value as 'local' | 'cloud')}>
                    <option value="local">本地 AI</option>
                    {aiAvailable && cloudOptions.length ? <option value="cloud">云端 AI</option> : null}
                  </select>
                </label>
              ) : null}
              {family === 'ai' && aiEngine === 'local' ? (
                <label>难度
                  <select value={difficulty} onChange={(event) => setDifficulty(event.target.value as LocalDifficulty)}>
                    <option value="beginner">入门</option>
                    <option value="intermediate">进阶</option>
                    <option value="master">大师</option>
                  </select>
                </label>
              ) : null}
              {family === 'ai' && aiEngine === 'cloud' ? (
                <label>云端模型
                  <select value={cloudId} onChange={(event) => setCloudId(event.target.value)}>
                    {cloudOptions.map((item) => (
                      <option key={`${item.providerId}:${item.modelId}`} value={`${item.providerId}:${item.modelId}`}>
                        {item.providerName} · {item.modelName}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}
              {family === 'online' ? (
                <div className="actions">
                  <button type="button" onClick={() => void createOnlineRoom()}>创建房间</button>
                  <input value={joinInput} maxLength={6} placeholder="房间码" onChange={(event) => setJoinInput(event.target.value.toUpperCase())} />
                  <button type="button" onClick={() => void joinOnlineRoom(joinInput)}>加入</button>
                </div>
              ) : null}
              {canChooseTheme ? (
                <label>主题
                  <select value={theme} onChange={(event) => chooseTheme(event.target.value)}>
                    {THEME_IDS.map((id) => <option key={id} value={id}>{THEME_LABEL[id]}</option>)}
                  </select>
                </label>
              ) : null}
              {family === 'online' ? null : <button type="submit">开始</button>}
            </form>
          ) : null}
          {!setupOpen && (match.mode === 'human-vs-local' || match.mode === 'human-vs-cloud' || match.mode === 'openai-vs-human') ? (
            <section className="ai-card">
              <strong>AI 对弈</strong>
              <p>{match.mode === 'human-vs-local' ? '本地 AI' : `${cloudChoice?.providerName || '云端 AI'} · ${cloudChoice?.modelName || ''}`}</p>
              {match.mode !== 'human-vs-local' && aiSource ? <small>{aiSource === 'global' ? '跟随全局' : aiSource === 'env' ? '环境变量兜底' : '象棋独立配置'}</small> : null}
              {match.mode !== 'human-vs-local' && cloudChoice ? <small>{cloudChoice.modelId}</small> : null}
              <p>{humanSide === 'red' ? '你执红 / AI 执黑' : '你执黑 / AI 执红'}</p>
              {thinking ? <p>AI 思考中…</p> : null}
            </section>
          ) : null}
          {!setupOpen && match.mode === 'online-vs-human' ? (
            <section className="ai-card">
              <strong>联网双人</strong>
              <p>房间码 {roomCode}</p>
              <p>{mySeat === 'red' ? '你执红' : '你执黑'} · {peerOnline ? '对方在线' : '等待对方'}</p>
              <p>邀请链接已放在地址栏的 room 参数里，发给对方即可。</p>
            </section>
          ) : null}
          {!setupOpen ? <>
          <p className="notice" role="status">{thinking ? (seatForTurn(match).kind === 'openai' ? `${seatForTurn(match).name} 思考中…` : '本地 AI 思考中…') : notice || '点击棋子，再点击绿色落点'}</p>
          <div className="actions">
            {allowUndo && match.mode !== 'online-vs-human' ? <button type="button" onClick={undo} disabled={thinking || match.history.length === 0}>悔棋</button> : null}
            <button type="button" onClick={() => setFlipped((value) => !value)}>翻转</button>
            {match.mode === 'online-vs-human' ? null : <button type="button" onClick={() => { setMatch(createMatch(mode, humanSide, difficulty, cloudChoice)); setUsage(EMPTY_USAGE); setSelected(null); setPending(null); setNotice('已重新开始'); }}>重新开始</button>}
            <button type="button" onClick={() => setSetupOpen(true)}>新对局</button>
            {allowObserve ? (
              <button type="button" aria-pressed={observe} onClick={() => setObserve((value) => !value)}>
                {observe ? '退出观察模式' : '手机观察模式'}
              </button>
            ) : null}
            {canChooseTheme ? (
              <label className="theme-select-label">主题
                <select className="theme-select" value={theme} onChange={(event) => chooseTheme(event.target.value)}>
                  {THEME_IDS.map((id) => <option key={id} value={id}>{THEME_LABEL[id]}</option>)}
                </select>
              </label>
            ) : null}
            <button type="button" className="drawer-toggle" onClick={() => setDrawer((value) => !value)}>棋谱</button>
          </div>
          {notice && !thinking ? (
            <div className="recover">
              <button type="button" onClick={() => setNotice('')}>继续手动下</button>
              <button type="button" onClick={() => { setMode('human-vs-local'); setNotice('下一手可在新对局里改用本地 AI。当前局面请继续手动，或点重新开始。'); }}>改用本地 AI 请重新开始</button>
              <button type="button" disabled={thinking || seatForTurn(match).kind === 'human'} onClick={() => setAttempt((value) => value + 1)}>重新思考</button>
            </div>
          ) : null}
          <section className={drawer ? 'history open' : 'history'} hidden={!showNotation}>
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
                  {showPlain ? <small>{explainPlain(record.notation, record.side)}</small> : null}
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
          </> : null}
        </aside>
      </div>
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

function matchFromMoves(moves: string[], seat: Side): MatchSnapshot {
  let position = createInitialPosition();
  const history: MoveRecord[] = [];
  let end: { status: MatchSnapshot['status']; subStatus: MatchSnapshot['subStatus'] } = { status: 'ongoing', subStatus: null };
  for (const ucci of moves) {
    const played = playUcci(position, ucci, { playerKind: 'human', ply: history.length + 1 });
    if (!played.ok) break;
    position = played.position;
    history.push(played.record);
    end = played.end;
  }
  return {
    id: 'online',
    mode: 'online-vs-human',
    position,
    history,
    status: end.status,
    subStatus: end.subStatus,
    seats: {
      red: { playerId: 'red', kind: 'human', name: seat === 'red' ? '我' : '对方' },
      black: { playerId: 'black', kind: 'human', name: seat === 'black' ? '我' : '对方' },
    },
  };
}

function createMatch(mode: MatchMode, humanSide: Side, _difficulty: LocalDifficulty, cloud: CloudOption | undefined): MatchSnapshot {
  const human = { playerId: 'human', kind: 'human' as const, name: '我' };
  const rival = mode === 'human-vs-local'
    ? { playerId: 'local', kind: 'local-ai' as const, name: '本地 AI' }
    : mode === 'human-vs-cloud' || mode === 'openai-vs-human'
      ? { playerId: 'openai', kind: 'openai' as const, name: cloud ? `${cloud.providerName} · ${cloud.modelName}` : '云端 AI' }
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

async function runEngine(match: MatchSnapshot, kind: string, difficulty: LocalDifficulty, cloud: CloudOption | undefined): Promise<PlayerMove | null> {
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
        body: JSON.stringify({ ...input, providerId: cloud?.providerId, modelId: cloud?.modelId }),
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

