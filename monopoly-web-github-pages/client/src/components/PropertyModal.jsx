import React from 'react';
import { X } from 'lucide-react';
import { BOARD, GROUP_COLORS } from '../../../shared/board.js';
import { emit } from '../transport.js';
import { hasMonopoly, money } from '../utils.js';

export default function PropertyModal({ tileId, room, me, onClose, onToast }) {
  const t = BOARD[tileId];
  const pr = room.props[tileId];
  const owner = pr && room.players.find((p) => p.id === pr.owner);
  const mine = pr && pr.owner === me?.id;
  const act = async (ev) => {
    const r = await emit(ev, { tileId });
    if (r.error) onToast(r.error);
  };

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div className="w-full max-w-xs overflow-hidden rounded-xl bg-white text-slate-900 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="relative p-4 text-center" style={{ background: GROUP_COLORS[t.colorGroup] || '#e5e7eb', color: ['lightblue', 'yellow'].includes(t.colorGroup) ? '#111' : t.type === 'street' ? '#fff' : '#111' }}>
          <button onClick={onClose} className="absolute right-2 top-2"><X size={18} /></button>
          <p className="text-xs uppercase opacity-80">{t.type === 'street' ? 'Title deed' : t.type}</p>
          <h3 className="text-lg font-extrabold">{t.name}</h3>
        </div>
        <div className="space-y-1 p-4 text-sm">
          {t.type === 'street' && (
            <>
              <Row k="Rent" v={money(t.rentTiers[0])} />
              <Row k="With color set" v={money(t.rentTiers[0] * 2)} />
              {[1, 2, 3, 4].map((n) => <Row key={n} k={`With ${n} house${n > 1 ? 's' : ''}`} v={money(t.rentTiers[n])} />)}
              <Row k="With hotel" v={money(t.rentTiers[5])} />
              <Row k="House cost" v={money(t.houseCost)} />
            </>
          )}
          {t.type === 'railroad' && [1, 2, 3, 4].map((n) => <Row key={n} k={`${n} railroad${n > 1 ? 's' : ''} owned`} v={money(t.rentTiers[n - 1])} />)}
          {t.type === 'utility' && (<><Row k="1 utility owned" v="4× dice" /><Row k="2 utilities owned" v="10× dice" /></>)}
          <Row k="Price" v={money(t.price)} />
          <Row k="Mortgage value" v={money(t.price / 2)} />
          <div className="mt-2 rounded bg-slate-100 p-2 text-center">
            {owner ? <>Owned by <b style={{ color: owner.color }}>{owner.name}</b>{pr.mortgaged && ' (mortgaged)'}{pr.houses > 0 && ` — ${pr.houses === 5 ? 'hotel' : pr.houses + ' houses'}`}</> : 'Unowned'}
          </div>
          {mine && (
            <div className="mt-2 grid grid-cols-2 gap-2">
              {t.type === 'street' && <button className="btn btn-primary" disabled={!hasMonopoly(room, me.id, t.colorGroup)} onClick={() => act('build_house')}>Build ({money(t.houseCost)})</button>}
              {t.type === 'street' && <button className="btn btn-secondary" disabled={!pr.houses} onClick={() => act('sell_house')}>Sell house</button>}
              {!pr.mortgaged ? <button className="btn btn-secondary" onClick={() => act('mortgage')}>Mortgage</button>
                : <button className="btn btn-secondary" onClick={() => act('unmortgage')}>Unmortgage</button>}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const Row = ({ k, v }) => (
  <div className="flex justify-between border-b border-slate-100 pb-0.5"><span>{k}</span><span className="font-semibold">{v}</span></div>
);
