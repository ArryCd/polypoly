import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { socket, emit, resume, leaveSession } from './transport.js';
import { getPlayerId, clearSession, money, goHome, parseJoinCode } from './utils.js';
import { BOARD } from '../../shared/board.js';
import EntryForm from './components/EntryForm.jsx';
import LobbyScreen from './components/LobbyScreen.jsx';
import Board from './components/Board.jsx';
import PlayerDashboard from './components/PlayerDashboard.jsx';
import PropertyModal from './components/PropertyModal.jsx';
import TradeModal from './components/TradeModal.jsx';
import ChatLog from './components/ChatLog.jsx';
import Dice from './components/Dice.jsx';
import Avatar from './components/Avatar.jsx';

export default function App() {
  const playerId = useMemo(getPlayerId, []);
  const [room, setRoom] = useState(null);
  const [display, setDisplay] = useState(null); // room with animated token positions
  const [toast, setToast] = useState(null);
  const [tile, setTile] = useState(null);
  const [tradeOpen, setTradeOpen] = useState(false);
  const [ready, setReady] = useState(false);
  const [status, setStatus] = useState('connected');
  const lastToast = useRef({ msg: '', at: 0 });
  const lastSeq = useRef(0);
  const timers = useRef([]);

  const notify = useCallback((msg) => {
    const now = Date.now();
    if (lastToast.current.msg === msg && now - lastToast.current.at < 600) return; // dedupe
    lastToast.current = { msg, at: now };
    setToast({ msg, k: Date.now() });
    setTimeout(() => setToast((t) => (t && Date.now() - t.k >= 2400 ? null : t)), 2500);
  }, []);

  const joinCode = parseJoinCode();

  // Apply server state, stepping the moving token tile-by-tile.
  const apply = useCallback((state) => {
    setRoom(state);
    const mv = state.lastMove;
    if (!mv || mv.seq <= lastSeq.current) {
      if (!timers.current.length) setDisplay(state);
      return;
    }
    lastSeq.current = mv.seq;
    timers.current.forEach(clearTimeout);
    timers.current = [];
    const path = [];
    if (mv.teleport) path.push(mv.to);
    else for (let p = mv.from; p !== mv.to;) { p = (p + 1) % 40; path.push(p); }
    const set = (pos) => setDisplay({ ...state, players: state.players.map((pl) => (pl.id === mv.playerId ? { ...pl, pos } : pl)) });
    set(mv.from);
    path.forEach((pos, i) => timers.current.push(setTimeout(() => set(pos), 150 * (i + 1))));
    timers.current.push(setTimeout(() => { timers.current = []; setDisplay((d) => d && state.moveSeq === lastSeq.current ? state : d); }, 150 * path.length + 60));
  }, []);

  useEffect(() => {
    const onClosed = () => { notify('The host closed the room.'); setRoom(null); setDisplay(null); setTimeout(goHome, 1200); };
    socket.on('room_updated', apply);
    socket.on('game_state_sync', apply);
    socket.on('error_msg', notify);
    socket.on('status', setStatus);
    socket.on('closed', onClosed);
    (joinCode ? Promise.resolve() : resume()).finally(() => setReady(true));
    return () => {
      socket.off('room_updated', apply); socket.off('game_state_sync', apply);
      socket.off('error_msg', notify); socket.off('status', setStatus); socket.off('closed', onClosed);
    };
  }, [apply, notify, joinCode]);

  if (!ready) return <div className="p-8 text-center text-slate-400">Connecting…</div>;

  const toastEl = toast && (
    <div className="toast-in fixed bottom-5 left-1/2 z-50 -translate-x-1/2 rounded-lg bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-900 shadow-xl">{toast.msg}</div>
  );

  if (!room && status === 'reconnecting') {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-6 text-center">
        <p className="text-lg font-semibold">Reconnecting to the host…</p>
        <p className="max-w-sm text-sm text-slate-400">The host needs to have the game page open. We'll keep retrying automatically.</p>
        <button className="btn btn-secondary" onClick={() => { leaveSession(); goHome(); }}>Cancel</button>
        {toastEl}
      </div>
    );
  }

  if (!room || joinCode && !room.players.some((p) => p.id === playerId)) {
    return <>{<EntryForm joinCode={joinCode} onToast={notify} />}{toastEl}</>;
  }

  const me = room.players.find((p) => p.id === playerId);
  if (room.status === 'lobby') return <>{<LobbyScreen room={room} me={me} onToast={notify} />}{toastEl}</>;

  const view = display || room;
  const cur = room.players[room.turnIdx];
  const myTrades = room.trades.filter((t) => t.to === playerId);
  const winner = room.winner && room.players.find((p) => p.id === room.winner);

  return (
    <div className="flex min-h-screen flex-col gap-3 p-3 lg:flex-row">
      {status === 'reconnecting' && <div className="fixed inset-x-0 top-0 z-50 bg-amber-500 py-1 text-center text-sm font-semibold text-slate-900">Connection to host lost — reconnecting…</div>}
      <div className="flex flex-1 items-start justify-center">
        <Board room={view} onSelect={setTile}>
          <p className="text-3xl font-black tracking-widest text-slate-800/70" style={{ fontSize: 'clamp(16px,4vmin,40px)' }}>MONOPOLY</p>
          <Dice dice={room.dice} seq={room.log.length} />
          <div className="flex items-center gap-2 rounded-full bg-white/70 px-3 py-1 text-sm font-semibold text-slate-900">
            <Avatar src={cur.avatar} size={24} color={cur.color} /> {cur.name}'s turn
          </div>
          {room.pendingBuy != null && cur.id === playerId && (
            <p className="rounded bg-white/80 px-2 py-1 text-xs font-semibold text-slate-900">Buy {BOARD[room.pendingBuy].name} for {money(BOARD[room.pendingBuy].price)}?</p>
          )}
        </Board>
      </div>

      <div className="flex w-full flex-col gap-3 lg:w-96">
        <PlayerDashboard room={room} me={me} onSelectTile={setTile} onTrade={() => setTradeOpen(true)} onToast={notify} />
        {myTrades.map((t) => {
          const from = room.players.find((p) => p.id === t.from);
          return (
            <div key={t.id} className="space-y-2 rounded-xl border border-amber-400 bg-amber-500/10 p-3 text-sm">
              <p><b>{from.name}</b> offers {money(t.offerCash)}{t.offerProps.length > 0 && ` + ${t.offerProps.map((i) => BOARD[i].name).join(', ')}`}</p>
              <p>for {money(t.requestCash)}{t.requestProps.length > 0 && ` + ${t.requestProps.map((i) => BOARD[i].name).join(', ')}`}</p>
              <div className="flex gap-2">
                <button className="btn btn-primary flex-1" onClick={async () => { const r = await emit('respond_trade', { tradeId: t.id, accept: true }); if (r.error) notify(r.error); }}>Accept</button>
                <button className="btn btn-secondary flex-1" onClick={() => emit('respond_trade', { tradeId: t.id, accept: false })}>Decline</button>
              </div>
            </div>
          );
        })}
        {room.trades.filter((t) => t.from === playerId).map((t) => (
          <div key={t.id} className="flex items-center justify-between rounded-xl border border-slate-600 p-2 text-xs">
            <span>Trade pending with {room.players.find((p) => p.id === t.to)?.name}</span>
            <button className="btn btn-secondary !py-1" onClick={() => emit('respond_trade', { tradeId: t.id, accept: false })}>Cancel</button>
          </div>
        ))}
        <div className="h-72 lg:min-h-0 lg:flex-1"><ChatLog room={room} /></div>
      </div>

      {tile != null && <PropertyModal tileId={tile} room={room} me={me} onClose={() => setTile(null)} onToast={notify} />}
      {tradeOpen && me && <TradeModal room={room} me={me} onClose={() => setTradeOpen(false)} onToast={notify} />}
      {winner && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
          <div className="space-y-4 rounded-2xl bg-slate-800 p-8 text-center shadow-2xl">
            <Avatar src={winner.avatar} size={96} color={winner.color} className="mx-auto" />
            <h2 className="text-3xl font-black text-emerald-400">🏆 {winner.name} wins!</h2>
            <button className="btn btn-primary" onClick={() => { leaveSession(); goHome(); }}>Back to home</button>
          </div>
        </div>
      )}
      {toastEl}
    </div>
  );
}
