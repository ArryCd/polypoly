import React, { useState } from 'react';
import { X } from 'lucide-react';
import { BOARD } from '../../../shared/board.js';
import { emit } from '../transport.js';
import { ownedIds, money } from '../utils.js';

function PropList({ ids, selected, toggle }) {
  if (!ids.length) return <p className="text-xs text-slate-500">No properties</p>;
  return (
    <div className="flex max-h-32 flex-wrap gap-1 overflow-auto">
      {ids.map((id) => (
        <button key={id} type="button" onClick={() => toggle(id)} className={`rounded border px-1.5 py-0.5 text-xs ${selected.includes(id) ? 'border-emerald-400 bg-emerald-500/20' : 'border-slate-600'}`}>
          {BOARD[id].name}
        </button>
      ))}
    </div>
  );
}

export default function TradeModal({ room, me, onClose, onToast }) {
  const others = room.players.filter((p) => p.id !== me.id && !p.bankrupt);
  const [to, setTo] = useState(others[0]?.id);
  const [offerCash, setOfferCash] = useState(0);
  const [requestCash, setRequestCash] = useState(0);
  const [offerProps, setOfferProps] = useState([]);
  const [requestProps, setRequestProps] = useState([]);
  const tog = (set) => (id) => set((a) => (a.includes(id) ? a.filter((x) => x !== id) : [...a, id]));

  const send = async () => {
    const r = await emit('propose_trade', { to, offerCash, requestCash, offerProps, requestProps });
    if (r.error) return onToast(r.error);
    onToast('Trade proposed!');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div className="w-full max-w-lg space-y-4 rounded-xl border border-slate-600 bg-slate-800 p-5" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold">Propose a trade</h3>
          <button onClick={onClose}><X size={18} /></button>
        </div>
        <select className="input" value={to} onChange={(e) => { setTo(e.target.value); setRequestProps([]); }}>
          {others.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase text-slate-400">You give</p>
            <input type="number" min={0} className="input" value={offerCash} onChange={(e) => setOfferCash(e.target.value)} placeholder="Cash" />
            <PropList ids={ownedIds(room, me.id)} selected={offerProps} toggle={tog(setOfferProps)} />
          </div>
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase text-slate-400">You get</p>
            <input type="number" min={0} className="input" value={requestCash} onChange={(e) => setRequestCash(e.target.value)} placeholder="Cash" />
            <PropList ids={to ? ownedIds(room, to) : []} selected={requestProps} toggle={tog(setRequestProps)} />
          </div>
        </div>
        <p className="text-xs text-slate-400">You give {money(Number(offerCash) || 0)} + {offerProps.length} properties, for {money(Number(requestCash) || 0)} + {requestProps.length} properties.</p>
        <button className="btn btn-primary w-full" disabled={!to} onClick={send}>Send proposal</button>
      </div>
    </div>
  );
}
