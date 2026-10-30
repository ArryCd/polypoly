import React, { useState } from 'react';
import { Copy, Crown, Play } from 'lucide-react';
import Avatar from './Avatar.jsx';
import { emit } from '../transport.js';
import { copyText, inviteLink, money, goHome } from '../utils.js';

export default function LobbyScreen({ room, me, onToast }) {
  const isHost = room.hostId === me?.id;
  const link = inviteLink(room.id);
  const [cash, setCash] = useState(room.startingCash);

  const copy = async () => onToast((await copyText(link)) ? 'Invite link copied!' : 'Copy failed — select the link manually.');
  const start = async () => { await emit('start_game'); };
  const applyCash = async () => { await emit('set_cash', { amount: cash }); };
  const leave = async () => { await emit('leave_room'); goHome(); };

  const slots = Array.from({ length: 6 }, (_, i) => room.players[i] || null);

  return (
    <div className="mx-auto flex min-h-screen max-w-3xl flex-col justify-center gap-5 p-4">
      <div className="rounded-2xl border border-slate-700 bg-slate-800/80 p-6 shadow-2xl">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase text-slate-400">Room code</p>
            <p className="text-4xl font-black tracking-widest text-emerald-400">{room.id}</p>
          </div>
          <button onClick={copy} className="btn btn-primary flex items-center gap-2 px-5 py-3 text-base">
            <Copy size={18} /> Copy Invite Link
          </button>
        </div>
        <input readOnly value={link} onFocus={(e) => e.target.select()} className="input mt-4 text-xs text-slate-300" />
      </div>

      <div className="rounded-2xl border border-slate-700 bg-slate-800/80 p-6">
        <h2 className="mb-3 text-sm font-semibold uppercase text-slate-400">Players ({room.players.length}/6)</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {slots.map((p, i) => (
            <div key={i} className={`flex items-center gap-3 rounded-xl border p-3 ${p ? 'border-slate-600 bg-slate-700/60' : 'border-dashed border-slate-700 text-slate-500'}`}>
              {p ? (
                <>
                  <Avatar src={p.avatar} size={44} color={p.color} />
                  <div className="min-w-0">
                    <p className="flex items-center gap-1 truncate text-sm font-semibold">
                      {p.name} {p.id === room.hostId && <Crown size={14} className="text-yellow-400" />}
                    </p>
                    <p className="text-xs text-slate-400">{p.id === me?.id ? 'You' : p.connected ? 'Ready' : 'Offline'}</p>
                  </div>
                </>
              ) : (
                <span className="text-sm">Waiting for player…</span>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-2xl border border-slate-700 bg-slate-800/80 p-6">
        {isHost ? (
          <div className="space-y-4">
            <div className="flex flex-wrap items-end gap-3">
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase text-slate-400">Starting cash</label>
                <input type="number" min={500} max={20000} step={100} className="input w-40" value={cash} onChange={(e) => setCash(e.target.value)} />
              </div>
              <button className="btn btn-secondary" onClick={applyCash}>Apply ({money(room.startingCash)} now)</button>
            </div>
            <button className="btn btn-primary flex w-full items-center justify-center gap-2 py-3 text-base" disabled={room.players.length < 2} onClick={start}>
              <Play size={18} /> Start Game {room.players.length < 2 && '(need 2+ players)'}
            </button>
          </div>
        ) : (
          <p className="text-center text-sm text-slate-300">Waiting for the host to start the game… Starting cash: <b>{money(room.startingCash)}</b></p>
        )}
        <button className="mt-4 w-full text-center text-xs text-slate-500 underline" onClick={leave}>Leave room</button>
      </div>
    </div>
  );
}
