import React from 'react';
import { Dice5, Home, Handshake, Flag, SkipForward, ShoppingCart, Unlock, KeyRound } from 'lucide-react';
import Avatar from './Avatar.jsx';
import { BOARD, GROUP_COLORS } from '../../../shared/board.js';
import { emit } from '../transport.js';
import { money, ownedIds, hasMonopoly } from '../utils.js';

export default function PlayerDashboard({ room, me, onSelectTile, onTrade, onToast }) {
  const cur = room.players[room.turnIdx];
  const myTurn = cur?.id === me?.id && room.status === 'playing';
  const mine = me ? ownedIds(room, me.id) : [];
  const buildable = me ? mine.filter((id) => BOARD[id].type === 'street' && hasMonopoly(room, me.id, BOARD[id].colorGroup)) : [];
  const run = async (ev, payload) => {
    const r = await emit(ev, payload);
    if (r.error) onToast(r.error);
  };
  const canRoll = myTurn && !me.bankrupt && (room.phase === 'roll' || (room.phase === 'action' && room.extraTurn));
  const canEnd = myTurn && room.phase === 'action' && !room.extraTurn;

  return (
    <div className="space-y-3">
      {/* Players */}
      <div className="space-y-2">
        {room.players.map((p) => {
          const props = ownedIds(room, p.id);
          return (
            <div key={p.id} className={`rounded-xl border p-2 ${p.bankrupt ? 'opacity-40' : ''} ${cur?.id === p.id ? 'border-emerald-400 bg-slate-700' : 'border-slate-700 bg-slate-800/70'}`}>
              <div className="flex items-center gap-2">
                <Avatar src={p.avatar} size={36} color={p.color} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold">
                    {p.name}{p.id === me?.id && ' (you)'}{!p.connected && ' 📴'}{p.inJail && ' 🔒'}{p.bankrupt && ' — bankrupt'}
                  </p>
                  <p className="text-xs text-slate-400">Net worth {money(p.netWorth)}{cur?.id === p.id && ' · playing'}</p>
                </div>
                <p className={`text-base font-extrabold ${p.cash < 0 ? 'text-rose-400' : 'text-emerald-400'}`}>{money(p.cash)}</p>
              </div>
              {props.length > 0 && (
                <div className="mt-1.5 flex flex-wrap gap-1">
                  {props.map((id) => (
                    <button key={id} onClick={() => onSelectTile(id)} title={BOARD[id].name}
                      className={`h-3.5 w-5 rounded-sm border border-black/40 ${room.props[id].mortgaged ? 'opacity-30' : ''}`}
                      style={{ background: GROUP_COLORS[BOARD[id].colorGroup] }} />
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Controls */}
      {me && !me.bankrupt && room.status === 'playing' && (
        <div className="space-y-2 rounded-xl border border-slate-700 bg-slate-800/70 p-3">
          <p className="text-xs font-semibold uppercase text-slate-400">{myTurn ? 'Your turn' : `Waiting for ${cur?.name}`}</p>
          <div className="grid grid-cols-2 gap-2">
            <button className="btn btn-primary flex items-center justify-center gap-1" disabled={!canRoll} onClick={() => run('roll_dice')}>
              <Dice5 size={16} /> {room.extraTurn ? 'Roll again' : 'Roll Dice'}
            </button>
            <button className="btn btn-secondary flex items-center justify-center gap-1" disabled={!canEnd} onClick={() => run('end_turn')}>
              <SkipForward size={16} /> End Turn
            </button>
            <button className="btn btn-primary flex items-center justify-center gap-1" disabled={!myTurn || room.pendingBuy == null} onClick={() => run('buy_property')}>
              <ShoppingCart size={16} /> Buy{room.pendingBuy != null && ` ${money(BOARD[room.pendingBuy].price)}`}
            </button>
            <button className="btn btn-secondary" disabled={!myTurn || room.pendingBuy == null} onClick={() => run('decline_buy')}>Pass</button>
            {me.inJail && myTurn && room.phase === 'roll' && (
              <>
                <button className="btn btn-secondary flex items-center justify-center gap-1" onClick={() => run('pay_bail')}><KeyRound size={16} /> Pay $50 bail</button>
                <button className="btn btn-secondary flex items-center justify-center gap-1" disabled={!me.jailCards} onClick={() => run('use_jail_card')}><Unlock size={16} /> Use card ({me.jailCards})</button>
              </>
            )}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <select className="input !py-1.5 text-xs" value="" onChange={(e) => e.target.value && run('build_house', { tileId: Number(e.target.value) })}>
              <option value="">🏠 Build house…</option>
              {buildable.map((id) => <option key={id} value={id}>{BOARD[id].name} ({money(BOARD[id].houseCost)})</option>)}
            </select>
            <button className="btn btn-secondary flex items-center justify-center gap-1" onClick={onTrade}><Handshake size={16} /> Trade</button>
          </div>
          <button className="btn btn-danger flex w-full items-center justify-center gap-1" onClick={() => window.confirm('Declare bankruptcy? You will be eliminated.') && run('declare_bankruptcy')}>
            <Flag size={16} /> Declare Bankruptcy
          </button>
        </div>
      )}
      {me?.jailCards > 0 && <p className="text-xs text-slate-400">🎟️ You hold {me.jailCards} Get Out of Jail Free card(s).</p>}
    </div>
  );
}
