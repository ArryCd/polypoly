import React, { useState } from 'react';
import AvatarPicker from './AvatarPicker.jsx';
import { emit } from '../transport.js';
import { getPlayerId } from '../utils.js';

// Home screen (create a room) and join modal (when opened via /join/ROOMID).
export default function EntryForm({ joinCode, onToast }) {
  const [name, setName] = useState(localStorage.getItem('mono_name') || '');
  const [avatar, setAvatar] = useState(localStorage.getItem('mono_avatar') || 'emoji:🎩');
  const [busy, setBusy] = useState(false);
  const [code, setCode] = useState(joinCode || '');
  const joining = !!joinCode;

  const submit = async (e) => {
    e.preventDefault();
    if (!name.trim()) return onToast('Please enter a player name.');
    setBusy(true);
    const playerId = getPlayerId();
    try { localStorage.setItem('mono_name', name.trim()); localStorage.setItem('mono_avatar', avatar); } catch { /* quota */ }
    const res = joining
      ? await emit('join_room', { roomId: joinCode, playerName: name.trim(), playerAvatar: avatar, playerId })
      : await emit('create_room', { hostName: name.trim(), hostAvatar: avatar, playerId });
    setBusy(false);
    if (res.error) return onToast(res.error);
    window.history.replaceState(null, '', window.location.pathname);
  };

  const goJoin = () => {
    const c = code.trim().toUpperCase();
    if (c.length >= 4) { window.location.hash = `#/join/${c}`; window.location.reload(); }
  };

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <form onSubmit={submit} className="w-full max-w-md space-y-5 rounded-2xl border border-slate-700 bg-slate-800/80 p-6 shadow-2xl">
        <div className="text-center">
          <h1 className="text-3xl font-extrabold tracking-tight text-emerald-400">MONOPOLY</h1>
          <p className="mt-1 text-sm text-slate-400">
            {joining ? <>You were invited to room <b className="text-white">{joinCode}</b></> : 'Create a room and share the invite link with friends.'}
          </p>
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold uppercase text-slate-400">Player name</label>
          <input className="input" maxLength={20} value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" autoFocus />
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold uppercase text-slate-400">Character</label>
          <AvatarPicker value={avatar} onChange={setAvatar} />
        </div>
        <button disabled={busy} className="btn btn-primary w-full py-3 text-base">
          {joining ? 'Join Game' : 'Create Room'}
        </button>
        {joining ? (
          <p className="text-center text-xs text-slate-400">
            <a className="underline" href={window.location.pathname}>Create your own room instead</a>
          </p>
        ) : (
          <div className="flex gap-2 border-t border-slate-700 pt-4">
            <input className="input uppercase" placeholder="Have a room code?" value={code} maxLength={6} onChange={(e) => setCode(e.target.value)} />
            <button type="button" className="btn btn-secondary" onClick={goJoin}>Join</button>
          </div>
        )}
      </form>
    </div>
  );
}
