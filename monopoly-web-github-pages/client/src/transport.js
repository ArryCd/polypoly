// Browser-only multiplayer. The HOST's browser runs the rules engine (src/engine/game.js) and is
// the single source of truth; guests connect to it over WebRTC (PeerJS) and send action requests.
// The public PeerJS broker is only used for the initial handshake — game traffic is peer-to-peer.
import Peer from 'peerjs';
import * as G from './engine/game.js';
import { getPlayerId, loadSession, saveSession, clearSession } from './utils.js';

const PREFIX = 'monopoly-v1-';
const ID_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

/* ---------- tiny event emitter (replaces socket.io-client) ---------- */
const listeners = {};
export const socket = {
  on(ev, fn) { (listeners[ev] ||= new Set()).add(fn); return socket; },
  off(ev, fn) { listeners[ev]?.delete(fn); return socket; },
};
const fire = (ev, ...a) => listeners[ev]?.forEach((f) => f(...a));

const peerOpts = () => {
  const e = import.meta.env; // optional self-hosted broker (also used by tests)
  return e.VITE_PEER_HOST
    ? { host: e.VITE_PEER_HOST, port: Number(e.VITE_PEER_PORT || 9000), path: e.VITE_PEER_PATH || '/', secure: e.VITE_PEER_SECURE === 'true' }
    : {};
};

function openPeer(id) {
  return new Promise((resolve, reject) => {
    const p = id ? new Peer(id, peerOpts()) : new Peer(peerOpts());
    p.on('open', () => resolve(p));
    p.on('error', (e) => { if (!p.open) { p.destroy(); reject(e); } });
  });
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let role = null; // 'host' | 'guest' | null
let peer = null;
let myId = null;
let room = null; // host only
const conns = new Map(); // host: conn -> playerId
const lobbyTimers = new Map();
let gconn = null; // guest: connection to host
let leaving = false;
let seq = 0;
const pending = new Map();

const cleanName = (n) => String(n || '').trim().slice(0, 20) || 'Player';
function cleanAvatar(a) {
  if (typeof a !== 'string' || a.length > 250000) return 'emoji:🎩';
  return /^(emoji:|data:image\/|https?:\/\/)/.test(a) ? a : 'emoji:🎩';
}
const genId = () => Array.from({ length: 6 }, () => ID_CHARS[Math.floor(Math.random() * ID_CHARS.length)]).join('');
const hostKey = (id) => `mono_host_room_${id}`;

/* ============================== HOST ============================== */
const ACTIONS = {
  start_game: G.startGame, set_cash: G.setStartingCash, roll_dice: G.roll, buy_property: G.buyProperty,
  decline_buy: G.declineBuy, end_turn: G.endTurn, build_house: G.build, sell_house: G.sellHouse,
  mortgage: G.mortgage, unmortgage: G.unmortgage, pay_bail: G.payBail, use_jail_card: G.useJailCard,
  propose_trade: G.proposeTrade, respond_trade: G.respondTrade, declare_bankruptcy: G.declareBankruptcy, chat: G.chat,
};

function broadcast() {
  const ev = room.status === 'lobby' ? 'room_updated' : 'game_state_sync';
  const state = JSON.parse(JSON.stringify(G.view(room)));
  fire(ev, state);
  for (const c of conns.keys()) if (c.open) c.send({ t: 'state', ev, state });
  try { localStorage.setItem(hostKey(room.id), JSON.stringify(room)); } catch { /* storage full/blocked */ }
}

function hostHandle(pid, ev, payload) {
  if (ev === 'leave_room') {
    if (room.status === 'lobby' && pid !== room.hostId) {
      G.removePlayer(room, pid);
      broadcast();
    }
    return { ok: true };
  }
  const fn = ACTIONS[ev];
  if (!fn) return { error: 'Unknown action.' };
  const err = fn(room, pid, payload || {});
  room.lastActive = Date.now();
  if (err) return { error: err };
  broadcast();
  return { ok: true };
}

function hostJoin(conn, { playerName, playerAvatar, playerId }, rejoin) {
  if (!playerId) return { error: 'Missing player id.' };
  const bind = () => {
    conns.set(conn, playerId);
    const t = lobbyTimers.get(playerId);
    if (t) { clearTimeout(t); lobbyTimers.delete(playerId); }
  };
  const existing = room.players.find((p) => p.id === playerId);
  if (existing) {
    existing.connected = true;
    bind();
    broadcast();
    return { roomId: room.id };
  }
  if (rejoin) return { error: 'Session expired.' };
  if (room.status !== 'lobby') return { error: 'Game already started.' };
  if (room.players.length >= G.MAX_PLAYERS) return { error: 'Room is full (6 players max).' };
  G.addPlayer(room, { id: playerId, name: cleanName(playerName), avatar: cleanAvatar(playerAvatar) });
  room.log.push({ kind: 'log', text: `${cleanName(playerName)} joined the room.`, t: Date.now() });
  bind();
  broadcast();
  return { roomId: room.id };
}

function onGuestClosed(conn) {
  const pid = conns.get(conn);
  conns.delete(conn);
  const p = room?.players.find((x) => x.id === pid);
  if (!p) return;
  // Ignore stale closes if the player already reconnected on another connection.
  if ([...conns.values()].includes(pid)) return;
  p.connected = false;
  broadcast();
  if (room.status === 'lobby') {
    lobbyTimers.set(pid, setTimeout(() => {
      lobbyTimers.delete(pid);
      const still = room.players.find((x) => x.id === pid);
      if (room.status === 'lobby' && still && !still.connected) { G.removePlayer(room, pid); broadcast(); }
    }, 15000));
  }
}

function onGuestConnection(conn) {
  conn.on('data', (msg) => {
    if (!msg || msg.t !== 'req') return;
    let res;
    try {
      if (msg.ev === 'join_room') res = hostJoin(conn, msg.payload || {}, false);
      else if (msg.ev === 'rejoin') res = hostJoin(conn, msg.payload || {}, true);
      else if (!conns.has(conn)) res = { error: 'Not in a room.' };
      else res = hostHandle(conns.get(conn), msg.ev, msg.payload);
    } catch (e) {
      console.error(e);
      res = { error: 'Host error.' };
    }
    if (conn.open) conn.send({ t: 'ack', id: msg.id, res });
  });
  conn.on('close', () => onGuestClosed(conn));
  conn.on('error', () => onGuestClosed(conn));
}

async function startHostPeer(roomId, attempts = 1) {
  for (let i = 0; i < attempts; i++) {
    try {
      peer = await openPeer(PREFIX + roomId);
      break;
    } catch (e) {
      if (i === attempts - 1) throw e;
      await sleep(2000);
    }
  }
  peer.on('connection', onGuestConnection);
  peer.on('disconnected', () => { if (!peer.destroyed) peer.reconnect(); }); // keep broker link for new guests
}

async function createRoom({ hostName, hostAvatar, playerId }) {
  myId = playerId || getPlayerId();
  for (let i = 0; i < 6; i++) {
    const id = genId();
    try {
      await startHostPeer(id);
      room = G.newRoom(id);
      role = 'host';
      G.addPlayer(room, { id: myId, name: cleanName(hostName), avatar: cleanAvatar(hostAvatar) });
      saveSession({ roomId: id, role: 'host' });
      broadcast();
      fire('status', 'connected');
      return { roomId: id };
    } catch (e) {
      if (e?.type !== 'unavailable-id') return { error: 'Could not reach the matchmaking service. Check your connection.' };
    }
  }
  return { error: 'Could not allocate a room code, try again.' };
}

/* ============================== GUEST ============================== */
function connectToHost(roomId) {
  return new Promise((resolve, reject) => {
    const c = peer.connect(PREFIX + roomId, { serialization: 'json', reliable: true });
    const done = (fn, v) => { clearTimeout(to); peer.off('error', onErr); fn(v); };
    const to = setTimeout(() => { try { c.close(); } catch { /* */ } done(reject, new Error('timeout')); }, 12000);
    const onErr = (e) => { if (e?.type === 'peer-unavailable') done(reject, e); };
    peer.on('error', onErr);
    c.on('open', () => done(resolve, c));
    c.on('error', (e) => done(reject, e));
  });
}

function attachGuestConn(c, roomId) {
  gconn = c;
  c.on('data', (msg) => {
    if (msg.t === 'state') fire(msg.ev, msg.state);
    else if (msg.t === 'ack') { const r = pending.get(msg.id); if (r) { pending.delete(msg.id); r(msg.res); } }
    else if (msg.t === 'closed') { leaving = true; clearSession(); teardown(); fire('closed'); }
  });
  c.on('close', () => { if (gconn === c && !leaving) { fire('status', 'reconnecting'); reconnectLoop(roomId); } });
}

function request(ev, payload) {
  return new Promise((resolve) => {
    if (!gconn?.open) return resolve({ error: 'Not connected to host. Reconnecting…' });
    const id = ++seq;
    pending.set(id, resolve);
    gconn.send({ t: 'req', id, ev, payload });
    setTimeout(() => { if (pending.delete(id)) resolve({ error: 'Host is not responding.' }); }, 8000);
  });
}

async function guestConnect(roomId, first) {
  try { peer?.destroy(); } catch { /* */ }
  peer = await openPeer(null);
  const c = await connectToHost(roomId);
  attachGuestConn(c, roomId);
  return first(c);
}

let reconnecting = false;
async function reconnectLoop(roomId) {
  if (reconnecting) return;
  reconnecting = true;
  while (role === 'guest' && !leaving) {
    await sleep(3000);
    try {
      const res = await guestConnect(roomId, () => request('rejoin', { playerId: myId, roomId }));
      if (res.error === 'Session expired.') { clearSession(); teardown(); fire('closed'); break; }
      if (!res.error) { fire('status', 'connected'); break; }
    } catch { /* keep trying */ }
  }
  reconnecting = false;
}

async function joinRoom({ roomId, playerName, playerAvatar, playerId }) {
  roomId = String(roomId || '').toUpperCase();
  myId = playerId || getPlayerId();
  role = 'guest';
  leaving = false;
  try {
    const res = await guestConnect(roomId, () => request('join_room', { playerName, playerAvatar, playerId: myId }));
    if (res.error) { teardown(); return res; }
    saveSession({ roomId, role: 'guest' });
    fire('status', 'connected');
    return res;
  } catch (e) {
    teardown();
    return { error: e?.type === 'peer-unavailable' || e?.message === 'timeout' ? 'Room not found — is the host online with the page open?' : 'Could not connect. Check your connection.' };
  }
}

/* ============================== shared ============================== */
function teardown() {
  role = null; room = null; gconn = null;
  conns.clear();
  try { peer?.destroy(); } catch { /* */ }
  peer = null;
}

/** Restore a previous session after a page reload (host restores saved state; guest reconnects). */
export async function resume() {
  const s = loadSession();
  if (!s?.roomId) return;
  myId = getPlayerId();
  leaving = false;
  if (s.role === 'host') {
    let saved = null;
    try { saved = JSON.parse(localStorage.getItem(hostKey(s.roomId)) || 'null'); } catch { /* */ }
    if (!saved) return clearSession();
    try {
      await startHostPeer(s.roomId, 8);
      role = 'host';
      room = saved;
      room.players.forEach((p) => { p.connected = p.id === myId; });
      broadcast();
      fire('status', 'connected');
    } catch {
      clearSession();
    }
  } else {
    role = 'guest';
    fire('status', 'reconnecting');
    reconnectLoop(s.roomId);
  }
}

export function leaveSession() {
  leaving = true;
  if (role === 'host') {
    for (const c of conns.keys()) if (c.open) c.send({ t: 'closed' });
    try { localStorage.removeItem(hostKey(room.id)); } catch { /* */ }
  } else if (role === 'guest' && gconn?.open) {
    gconn.send({ t: 'req', id: ++seq, ev: 'leave_room', payload: {} });
  }
  clearSession();
  setTimeout(teardown, 150);
}

export async function emit(event, payload = {}) {
  let res;
  if (event === 'create_room') return createRoom(payload);
  if (event === 'join_room') return joinRoom(payload);
  if (event === 'leave_room') { leaveSession(); return { ok: true }; }
  if (role === 'host') res = hostHandle(myId, event, payload);
  else if (role === 'guest') res = await request(event, payload);
  else res = { error: 'Not in a room.' };
  if (res.error) fire('error_msg', res.error);
  return res;
}
