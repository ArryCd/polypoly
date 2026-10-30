import React from 'react';
import Avatar from './Avatar.jsx';

// Small circular avatar badge rendered on a board tile.
export default function TileToken({ player, active }) {
  const size = 'clamp(14px, 2.7vmin, 30px)';
  return (
    <div
      title={player.name}
      className={`pointer-events-none transition-transform duration-100 ${active ? 'scale-125 drop-shadow-[0_0_4px_rgba(255,255,255,0.9)]' : ''}`}
      style={{ width: size, height: size }}
    >
      <Avatar src={player.avatar} size={undefined} color={player.inJail ? '#ef4444' : player.color} className="!h-full !w-full" />
    </div>
  );
}
