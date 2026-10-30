import React from 'react';
import { BOARD, GROUP_COLORS } from '../../../shared/board.js';
import TileToken from './TileToken.jsx';
import { money } from '../utils.js';

// Map tile id -> [row, col] on an 11x11 grid (1-indexed). GO is bottom-right.
export function gridPos(id) {
  if (id <= 10) return [11, 11 - id];
  if (id <= 20) return [11 - (id - 10), 1];
  if (id <= 30) return [1, 1 + (id - 20)];
  return [1 + (id - 30), 11];
}

// Which side of the board a tile is on, so we can put the color bar on the inner edge.
function side(id) {
  if (id % 10 === 0) return 'corner';
  if (id < 10) return 'bottom';
  if (id < 20) return 'left';
  if (id < 30) return 'top';
  return 'right';
}

const ICON = { chance: '❓', chest: '📦', tax: '💰', go: '➡️', jail: '🔒', parking: '🅿️', gotojail: '👮', railroad: '🚂', utility: '💡' };

function Tile({ tile, room, players, currentId, onSelect }) {
  const [row, col] = gridPos(tile.id);
  const pr = room.props[tile.id];
  const owner = pr && room.players.find((p) => p.id === pr.owner);
  const s = side(tile.id);
  const barClass = { bottom: 'top-0 left-0 right-0 h-[20%]', top: 'bottom-0 left-0 right-0 h-[20%]', left: 'top-0 bottom-0 right-0 w-[20%]', right: 'top-0 bottom-0 left-0 w-[20%]' }[s];
  const here = players.filter((p) => p.pos === tile.id && !p.bankrupt);
  const clickable = ['street', 'railroad', 'utility'].includes(tile.type);

  return (
    <div
      onClick={() => clickable && onSelect(tile.id)}
      className={`relative flex flex-col items-center justify-center overflow-hidden border border-slate-900 bg-emerald-100 text-center text-slate-900 ${clickable ? 'cursor-pointer hover:brightness-110' : ''}`}
      style={{ gridRow: row, gridColumn: col, fontSize: 'clamp(5px, 1.05vmin, 11px)', lineHeight: 1.1 }}
    >
      {tile.colorGroup && tile.type === 'street' && (
        <div className={`absolute ${barClass}`} style={{ background: GROUP_COLORS[tile.colorGroup] }} />
      )}
      <div className={`z-[1] flex flex-col items-center px-0.5 ${tile.type === 'street' ? (s === 'bottom' ? 'pt-[22%]' : s === 'top' ? 'pb-[22%]' : '') : ''}`}>
        {ICON[tile.type] && <span style={{ fontSize: 'clamp(8px, 1.8vmin, 20px)' }}>{ICON[tile.type]}</span>}
        <span className="font-bold">{tile.name}</span>
        {tile.price && <span>{money(tile.price)}</span>}
        {tile.amount && <span>{money(tile.amount)}</span>}
      </div>
      {pr && (
        <div className="absolute bottom-0 left-0 right-0 h-[7%] min-h-[3px]" style={{ background: owner?.color, opacity: pr.mortgaged ? 0.35 : 1 }} />
      )}
      {pr?.houses > 0 && (
        <div className="absolute left-0 right-0 top-[1px] z-[2] flex justify-center">
          {pr.houses === 5 ? <span className="rounded-sm bg-red-600 px-1 text-[0.8em] font-bold text-white">H</span>
            : Array.from({ length: pr.houses }).map((_, i) => <span key={i} className="mx-px inline-block h-[0.9em] w-[0.9em] rounded-sm bg-green-700" />)}
        </div>
      )}
      {pr?.mortgaged && <span className="absolute right-0.5 top-0.5 z-[2] rounded bg-slate-800 px-0.5 text-[0.8em] text-white">M</span>}
      <div className="absolute inset-0 z-[3] flex flex-wrap content-center items-center justify-center gap-px p-px">
        {here.map((p) => <TileToken key={p.id} player={p} active={p.id === currentId} />)}
      </div>
    </div>
  );
}

export default function Board({ room, onSelect, children }) {
  const currentId = room.players[room.turnIdx]?.id;
  return (
    <div
      className="relative grid aspect-square bg-emerald-200 shadow-2xl"
      style={{ width: 'min(100%, calc(100vh - 24px))', gridTemplateColumns: '1.5fr repeat(9, 1fr) 1.5fr', gridTemplateRows: '1.5fr repeat(9, 1fr) 1.5fr' }}
    >
      {BOARD.map((t) => (
        <Tile key={t.id} tile={t} room={room} players={room.players} currentId={currentId} onSelect={onSelect} />
      ))}
      <div className="flex flex-col items-center justify-center gap-3 p-2" style={{ gridRow: '2 / 11', gridColumn: '2 / 11' }}>
        {children}
      </div>
    </div>
  );
}
