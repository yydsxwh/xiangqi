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
import { CloudAIPlayer } from '../players/cloud-ai-player.ts';
import { CLOUD_AI_MOVE_ROUTE, ENGINE_MOVE_ROUTE, EXPLAIN_MOVE_ROUTE, HYBRID_MOVE_ROUTE } from '../server/cloud-ai-route.ts';
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

type AiKind = 'engine' | 'llm' | 'hybrid';
type EngineSpeedId = 'fast' | 'standard' | 'deep';

interface EngineSpeedOption {
  id: EngineSpeedId;
  label: string;
  movetimeMs: number;
}

interface EnginePublic {
  available: boolean;
  providerId: string;
  providerName: string;
  blurb: string;
  speeds: EngineSpeedOption[];
  hybridAvailable: boolean;
  hybridTopK: number;
  hybridPolicy: 'engine-first' | 'collaborate' | 'llm-first';
  hybridSearchMs: number;
  explainMoves: boolean;
  note: string;
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
  const [match, setMatch] = useState<MatchSnapshot>(() => createMatch('human-vs-engine', 'red', 'intermediate', undefined, null));
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
  const [aiKind, setAiKind] = useState<AiKind>('engine');
  const [engineSpeed, setEngineSpeed] = useState<EngineSpeedId>('standard');
  const [engineInfo, setEngineInfo] = useState<EnginePublic | null>(null);
  const [engineDepth, setEngineDepth] = useState(0);
  const [explanation, setExplanation] = useState('');
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
        if (config.engine) setEngineInfo(config.engine as EnginePublic);
        if (config.defaultMode === 'human-vs-human') setFamily('local');
        else if (config.defaultMode === 'online-vs-human') setFamily('online');
        else if (config.defaultMode === 'human-vs-cloud' || config.defaultMode === 'openai-vs-human') {
          setFamily('ai');
          setAiKind(options.length ? 'llm' : 'engine');
          setMode(options.length ? 'human-vs-cloud' : 'human-vs-engine');
        } else if (config.defaultMode === 'human-vs-hybrid') {
          setFamily('ai');
          setAiKind('hybrid');
        } else if (config.defaultMode === 'human-vs-engine') {
          setFamily('ai');
          setAiKind('engine');
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
    setNotice(thinkingLabel(seat.kind, seat.name, engineInfo));
    const started = Date.now();
    void runEngine(match, seat.kind, difficulty, cloudChoice, {
      speed: engineSpeed,
      newGame: match.history.length === 0,
      explain: Boolean(engineInfo?.explainMoves),
    })
      .then((move) => {
        if (cancelled) return;
        if (!move || !acceptModelMove(move.ucci, request.legalMoves)) {
          setNotice(move ? '这步不在合法着法里，没有落子。' : '这一手没有得到着法。');
          return;
        }
        if (move.depth) setEngineDepth(move.depth);
        applyMove(move, seat.kind, started);
        if (engineInfo?.explainMoves && (seat.kind === 'pikafish' || seat.kind === 'hybrid')) {
          void requestExplanation(match, move).then((text) => {
            if (!cancelled && text) setExplanation(text);
          });
        }
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
  }, [match, setupOpen, difficulty, attempt, pending, cloudChoice, engineSpeed, engineInfo]);

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
    const nextMode: MatchMode = family === 'local'
      ? 'human-vs-human'
      : family === 'online'
        ? 'online-vs-human'
        : aiKind === 'llm'
          ? 'human-vs-cloud'
          : aiKind === 'hybrid'
            ? 'human-vs-hybrid'
            : 'human-vs-engine';
    setMode(nextMode);
    setExplanation('');
    setEngineDepth(0);
    const next = createMatch(nextMode, humanSide, difficulty, cloudChoice, engineInfo);
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
                  <select value={aiKind} onChange={(event) => setAiKind(event.target.value as AiKind)}>
                    <option value="engine">电脑 AI（专业象棋引擎）</option>
                    <option value="llm" disabled={!aiAvailable || !cloudOptions.length}>大模型 AI</option>
                    <option value="hybrid" disabled={!engineInfo?.hybridAvailable}>混合 AI</option>
                  </select>
                </label>
              ) : null}
              {family === 'ai' && aiKind === 'engine' ? (
                <label>速度
                  <select value={engineSpeed} onChange={(event) => setEngineSpeed(event.target.value as EngineSpeedId)}>
                    {(engineInfo?.speeds?.length ? engineInfo.speeds : [{ id: 'fast' as const, label: '快速', movetimeMs: 300 }, { id: 'standard' as const, label: '标准', movetimeMs: 800 }, { id: 'deep' as const, label: '深度', movetimeMs: 3000 }]).map((item) => (
                      <option key={item.id} value={item.id}>{item.label} · {formatMovetime(item.movetimeMs)}</option>
                    ))}
                  </select>
                </label>
              ) : null}
              {family === 'ai' && (aiKind === 'llm' || aiKind === 'hybrid') ? (
                <label>大模型
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
          {!setupOpen && (match.mode === 'human-vs-local' || match.mode === 'human-vs-cloud' || match.mode === 'human-vs-engine' || match.mode === 'human-vs-hybrid' || match.mode === 'openai-vs-human') ? (
            <section className="ai-card">
              <strong>{match.mode === 'human-vs-hybrid' ? '混合 AI' : 'AI 对弈'}</strong>
              <p>{aiCardTitle(match.mode, engineInfo, cloudChoice)}</p>
              <p>{aiCardDetail(match.mode, engineInfo, engineSpeed, cloudChoice)}</p>
              {match.mode === 'human-vs-cloud' && aiSource ? <small>{aiSource === 'global' ? '跟随全局' : aiSource === 'env' ? '环境变量兜底' : '象棋独立配置'}</small> : null}
              <p>{humanSide === 'red' ? '你执红 / AI 执黑' : '你执黑 / AI 执红'}</p>
              {thinking ? <p>{thinkingLabel(seatForTurn(match).kind, seatForTurn(match).name, engineInfo)}</p> : null}
              {!thinking && engineDepth > 0 && (match.mode === 'human-vs-engine' || match.mode === 'human-vs-hybrid') ? <p>深度 {engineDepth}</p> : null}
              {explanation ? <p>{explanation}</p> : null}
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
          <p className="notice" role="status">{thinking ? thinkingLabel(seatForTurn(match).kind, seatForTurn(match).name, engineInfo) : notice || '点击棋子，再点击绿色落点'}</p>
          <div className="actions">
            {allowUndo && match.mode !== 'online-vs-human' ? <button type="button" onClick={undo} disabled={thinking || match.history.length === 0}>悔棋</button> : null}
            <button type="button" onClick={() => setFlipped((value) => !value)}>翻转</button>
            {match.mode === 'online-vs-human' ? null : <button type="button" onClick={() => { setExplanation(''); setEngineDepth(0); setMatch(createMatch(mode, humanSide, difficulty, cloudChoice, engineInfo)); setUsage(EMPTY_USAGE); setSelected(null); setPending(null); setNotice('已重新开始'); }}>重新开始</button>}
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

function createMatch(mode: MatchMode, humanSide: Side, _difficulty: LocalDifficulty, cloud: CloudOption | undefined, engine: EnginePublic | null): MatchSnapshot {
  const human = { playerId: 'human', kind: 'human' as const, name: '我' };
  const engineName = engine ? `${engine.providerName} · ${engine.blurb}` : '专业象棋引擎';
  const cloudName = cloud ? `${cloud.providerName} · ${cloud.modelName}` : '大模型 AI';
  const rival = mode === 'human-vs-engine'
    ? { playerId: 'pikafish', kind: 'pikafish' as const, name: engineName }
    : mode === 'human-vs-hybrid'
      ? { playerId: 'hybrid', kind: 'hybrid' as const, name: engine && cloud ? `${engine.providerName} + ${cloud.modelName}` : '混合 AI' }
      : mode === 'human-vs-local'
        ? { playerId: 'local', kind: 'local-ai' as const, name: '本地 AI' }
        : mode === 'human-vs-cloud' || mode === 'openai-vs-human'
          ? { playerId: 'cloud-ai', kind: 'cloud-ai' as const, name: cloudName }
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

async function runEngine(
  match: MatchSnapshot,
  kind: string,
  difficulty: LocalDifficulty,
  cloud: CloudOption | undefined,
  engine: { speed: EngineSpeedId; newGame: boolean; explain: boolean },
): Promise<PlayerMove | null> {
  const request = moveRequestFor(match);
  if (kind === 'pikafish' || kind === 'hybrid') {
    const route = kind === 'hybrid' ? HYBRID_MOVE_ROUTE : ENGINE_MOVE_ROUTE;
    const response = await fetch(route, {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        ...request,
        speed: engine.speed,
        newGame: engine.newGame,
        providerId: cloud?.providerId,
        modelId: cloud?.modelId,
      }),
    });
    const payload = await response.json().catch(() => ({})) as PlayerMove & { reason?: string; fallback?: string };
    if (payload.fallback === 'local') {
      const local = new LocalAIPlayer('local', {
        findMove: async (input) => {
          const ucci = await searchLocalMove(input.fen, input.sideToMove, input.difficulty);
          return ucci ? { ucci } : null;
        },
      }, difficulty);
      return local.requestMove(request);
    }
    if (!response.ok) throw new Error(payload.reason || '引擎没有给出着法');
    return payload;
  }
  if (kind === 'local-ai') {
    const player = new LocalAIPlayer('local', {
      findMove: async (input) => {
        const ucci = await searchLocalMove(input.fen, input.sideToMove, input.difficulty);
        return ucci ? { ucci } : null;
      },
    }, difficulty);
    return player.requestMove(request);
  }
  const label = cloud ? `${cloud.providerName} · ${cloud.modelName}` : '云端 AI';
  const player = new CloudAIPlayer('cloud-ai', {
    requestMove: async (input) => {
      const response = await fetch(CLOUD_AI_MOVE_ROUTE, {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ ...input, providerId: cloud?.providerId, modelId: cloud?.modelId }),
      });
      const payload = await response.json().catch(() => ({})) as PlayerMove & { reason?: string; message?: string; code?: string };
      if (!response.ok) throw new Error(payload.reason || payload.message || (payload.code === 'NO_LEGAL_MOVE' ? `${label} 没有给出合法着法` : `${label} 请求被拒绝`));
      return payload;
    },
  });
  return player.requestMove(request);
}

function isCloudKind(kind: string): boolean {
  return kind === 'cloud-ai' || kind === 'openai';
}

function formatMovetime(ms: number): string {
  const seconds = Math.max(0, ms) / 1000;
  const text = seconds >= 10 ? seconds.toFixed(0) : seconds.toFixed(1).replace(/\.0$/, '');
  return `约 ${text} 秒`;
}

function policyLabel(policy: EnginePublic['hybridPolicy']): string {
  if (policy === 'engine-first') return '引擎优先';
  if (policy === 'llm-first') return '大模型优先';
  return '协同决策';
}

function thinkingLabel(kind: string, name: string, engine: EnginePublic | null): string {
  if (kind === 'pikafish') return `${engine?.providerName || name} 思考中…`;
  if (kind === 'hybrid') return '混合 AI 思考中…';
  if (kind === 'local-ai') return '本地 AI 思考中…';
  return `${name} 思考中…`;
}

function aiCardTitle(mode: MatchMode, engine: EnginePublic | null, cloud: CloudOption | undefined): string {
  if (mode === 'human-vs-engine') return engine ? `${engine.providerName} · ${engine.blurb}` : '专业象棋引擎';
  if (mode === 'human-vs-hybrid') return engine && cloud ? `${engine.providerName} + ${cloud.modelName}` : '混合 AI';
  if (mode === 'human-vs-local') return '本地 AI';
  return cloud ? `${cloud.providerName} · ${cloud.modelName}` : '大模型 AI';
}

function aiCardDetail(mode: MatchMode, engine: EnginePublic | null, speed: EngineSpeedId, cloud: CloudOption | undefined): string {
  if (mode === 'human-vs-engine') {
    const chosen = engine?.speeds.find((item) => item.id === speed);
    return chosen ? `${chosen.label} · ${formatMovetime(chosen.movetimeMs)}` : '';
  }
  if (mode === 'human-vs-hybrid') {
    return `引擎候选：Top ${engine?.hybridTopK ?? 5} · 模式：${policyLabel(engine?.hybridPolicy || 'collaborate')}。${engine?.note || '混合 AI：更强解释/策略，速度慢于专业引擎'}`;
  }
  if (mode === 'human-vs-cloud' || mode === 'openai-vs-human') return cloud?.modelId || '';
  return '';
}

async function requestExplanation(match: MatchSnapshot, move: PlayerMove): Promise<string> {
  const request = moveRequestFor(match);
  const response = await fetch(EXPLAIN_MOVE_ROUTE, {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ ...request, ucci: move.ucci, pv: move.pv ?? [], scoreCp: move.scoreCp ?? null }),
  });
  const payload = await response.json().catch(() => ({})) as { text?: string };
  return payload.text || '';
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

