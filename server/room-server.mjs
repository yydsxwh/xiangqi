import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { DatabaseSync } from 'node:sqlite';
import { WebSocketServer } from 'ws';
import { commitMove, replay } from './rules.mjs';

const port = Number(process.env.XIANGQI_ROOM_PORT || 3010);
const roomsPath = process.env.XIANGQI_ROOMS_DB || '/var/www/xiangqi-rooms/rooms.db';
const userDbPath = process.env.XIANGQI_USER_DB || '/var/www/yyds-course-platform/prisma/prod.db';
const envPath = process.env.XIANGQI_ENV_FILE || '/var/www/yyds-course-platform/.env';
const secret = readSecret(envPath);
const rooms = new DatabaseSync(roomsPath);
rooms.exec(`CREATE TABLE IF NOT EXISTS rooms (
  code TEXT PRIMARY KEY,
  redUser TEXT,
  blackUser TEXT,
  moves TEXT NOT NULL,
  status TEXT NOT NULL,
  updatedAt INTEGER NOT NULL
)`);
const sockets = new Map();

const server = createServer((req, res) => {
  const url = new URL(req.url || '/', 'http://127.0.0.1');
  const auth = authenticate(req.headers.cookie || '');
  if (!auth.ok) return json(res, auth.status, { reason: auth.reason });
  if (req.method === 'POST' && url.pathname === '/rooms') {
    return readBody(req).then((body) => json(res, 200, createRoom(auth.user.id, body.side === 'black' ? 'black' : 'red')));
  }
  const join = url.pathname.match(/^\/rooms\/([A-Za-z0-9]{6})\/join$/);
  if (req.method === 'POST' && join) {
    const room = joinRoom(join[1].toUpperCase(), auth.user.id);
    return json(res, room.ok ? 200 : 409, room);
  }
  const read = url.pathname.match(/^\/rooms\/([A-Za-z0-9]{6})$/);
  if (req.method === 'GET' && read) {
    const room = loadRoom(read[1].toUpperCase());
    if (!room) return json(res, 404, { reason: '没有这个房间' });
    return json(res, 200, view(room, auth.user.id));
  }
  return json(res, 404, { reason: '没有这个接口' });
});

const wss = new WebSocketServer({ noServer: true });
server.on('upgrade', (req, socket, head) => {
  const url = new URL(req.url || '/', 'http://127.0.0.1');
  if (url.pathname !== '/ws') return socket.destroy();
  const auth = authenticate(req.headers.cookie || '');
  if (!auth.ok) return socket.destroy();
  wss.handleUpgrade(req, socket, head, (ws) => {
    const code = String(url.searchParams.get('code') || '').toUpperCase();
    const room = loadRoom(code);
    if (!room || (room.redUser !== auth.user.id && room.blackUser !== auth.user.id)) {
      ws.close(1008, '不能进入这个房间');
      return;
    }
    const bag = sockets.get(code) || new Set();
    const client = { ws, userId: auth.user.id };
    bag.add(client);
    sockets.set(code, bag);
    ws.send(JSON.stringify(view(room, auth.user.id)));
    broadcast(code);
    ws.on('message', (raw) => onMessage(code, client, raw.toString()));
    ws.on('close', () => {
      bag.delete(client);
      broadcast(code);
    });
  });
});

server.listen(port, '127.0.0.1', () => {
  console.log(`xiangqi rooms listening on ${port}`);
});

function onMessage(code, client, raw) {
  let body;
  try { body = JSON.parse(raw); } catch { return; }
  if (body?.type !== 'move') return;
  const room = loadRoom(code);
  if (!room) return;
  const seat = room.redUser === client.userId ? 'red' : room.blackUser === client.userId ? 'black' : '';
  const played = commitMove({ moves: JSON.parse(room.moves), status: room.status }, String(body.ucci || ''), seat);
  if (!played.ok) {
    client.ws.send(JSON.stringify({ type: 'error', reason: played.reason }));
    return;
  }
  rooms.prepare('UPDATE rooms SET moves = ?, status = ?, updatedAt = ? WHERE code = ?').run(JSON.stringify(played.moves), played.status, Date.now(), code);
  broadcast(code);
}

function createRoom(userId, side) {
  const code = randomBytes(4).toString('hex').toUpperCase().replace(/[01IO]/g, 'A').slice(0, 6);
  rooms.prepare('INSERT INTO rooms (code, redUser, blackUser, moves, status, updatedAt) VALUES (?, ?, ?, ?, ?, ?)').run(
    code,
    side === 'red' ? userId : '',
    side === 'black' ? userId : '',
    '[]',
    'ongoing',
    Date.now(),
  );
  return { ok: true, code, side, path: `/games/xiangqi/?room=${code}` };
}

function joinRoom(code, userId) {
  const room = loadRoom(code);
  if (!room) return { ok: false, reason: '没有这个房间' };
  if (room.redUser === userId) return { ok: true, code, side: 'red' };
  if (room.blackUser === userId) return { ok: true, code, side: 'black' };
  if (!room.redUser) {
    rooms.prepare('UPDATE rooms SET redUser = ? WHERE code = ?').run(userId, code);
    return { ok: true, code, side: 'red' };
  }
  if (!room.blackUser) {
    rooms.prepare('UPDATE rooms SET blackUser = ? WHERE code = ?').run(userId, code);
    return { ok: true, code, side: 'black' };
  }
  return { ok: false, reason: '房间已经满了' };
}

function broadcast(code) {
  const room = loadRoom(code);
  if (!room) return;
  for (const client of sockets.get(code) || []) {
    if (client.ws.readyState === 1) client.ws.send(JSON.stringify(view(room, client.userId)));
  }
}

function view(room, userId) {
  const moves = JSON.parse(room.moves);
  const played = replay(moves);
  const online = [...(sockets.get(room.code) || [])].map((item) => item.userId);
  return {
    type: 'state',
    code: room.code,
    moves,
    status: played.ok ? played.status : room.status,
    sideToMove: played.ok ? played.side : 'red',
    fen: played.ok ? played.fen : '',
    you: room.redUser === userId ? 'red' : room.blackUser === userId ? 'black' : '',
    redOnline: online.includes(room.redUser),
    blackOnline: online.includes(room.blackUser),
  };
}

function loadRoom(code) {
  return rooms.prepare('SELECT code, redUser, blackUser, moves, status FROM rooms WHERE code = ?').get(code);
}

function authenticate(cookie) {
  const token = readCookie(cookie, 'yyds_session');
  if (!token) return { ok: false, status: 401, reason: '未登录' };
  const payload = verifyJwt(token, secret);
  if (!payload?.id) return { ok: false, status: 401, reason: '登录已失效' };
  const db = new DatabaseSync(userDbPath, { readOnly: true });
  try {
    const access = accessRules(db);
    if (!access.enabled) return { ok: false, status: 403, reason: '象棋已关闭' };
    const user = db.prepare('SELECT id, role, sessionEpoch FROM User WHERE id = ?').get(String(payload.id));
    if (!user || Number(payload.sv ?? 0) !== Number(user.sessionEpoch ?? 0)) {
      return { ok: false, status: 401, reason: '登录已失效' };
    }
    if (access.betaOnly && user.role !== 'ADMIN') return { ok: false, status: 403, reason: '当前账号不能进入联网对局' };
    return { ok: true, user };
  } finally {
    db.close();
  }
}

function accessRules(db) {
  const row = db.prepare("SELECT xiangqiJson FROM SiteSettings WHERE id = 'default'").get();
  try {
    const parsed = JSON.parse(row?.xiangqiJson || '{}');
    return { enabled: parsed.enabled !== false, betaOnly: parsed.betaOnly !== false };
  } catch {
    return { enabled: true, betaOnly: true };
  }
}

function verifyJwt(token, key) {
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const expected = createHmac('sha256', key).update(`${parts[0]}.${parts[1]}`).digest();
  const got = Buffer.from(parts[2].replace(/-/g, '+').replace(/_/g, '/'), 'base64');
  if (got.length !== expected.length || !timingSafeEqual(got, expected)) return null;
  const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString());
  if (payload.exp && payload.exp * 1000 < Date.now()) return null;
  return payload;
}

function readSecret(path) {
  const text = readFileSync(path, 'utf8');
  const value = text.match(/^AUTH_SECRET=(.*)$/m)?.[1]?.trim().replace(/^["']|["']$/g, '');
  if (!value) throw new Error('AUTH_SECRET missing');
  return value;
}

function readCookie(header, name) {
  const found = header.split(';').map((part) => part.trim()).find((part) => part.startsWith(`${name}=`));
  return found ? decodeURIComponent(found.slice(name.length + 1)) : '';
}

function readBody(req) {
  return new Promise((resolve) => {
    const chunks = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => {
      try { resolve(JSON.parse(Buffer.concat(chunks).toString() || '{}')); } catch { resolve({}); }
    });
  });
}

function json(res, status, body) {
  res.writeHead(status, { 'content-type': 'application/json', 'cache-control': 'no-store' });
  res.end(JSON.stringify(body));
}
