import React from 'react';

// Renders an avatar string: "emoji:🎩", a data: URL, or an http(s) image URL — always as a circle.
// Omit `size` to fill the parent box.
export default function Avatar({ src, size, color = '#94a3b8', ring = true, className = '' }) {
  const isEmoji = typeof src === 'string' && src.startsWith('emoji:');
  const style = size
    ? { width: size, height: size, minWidth: size, borderWidth: ring ? Math.max(2, size / 14) : 0 }
    : { width: '100%', height: '100%', borderWidth: ring ? 2 : 0 };
  style.borderColor = color;
  return (
    <div
      className={`flex items-center justify-center overflow-hidden rounded-full border-solid bg-white ${className}`}
      style={style}
    >
      {isEmoji ? (
        <span style={size ? { fontSize: size * 0.58, lineHeight: 1 } : { fontSize: 'clamp(8px, 1.7vmin, 18px)', lineHeight: 1 }}>{src.slice(6)}</span>
      ) : (
        <img
          src={src}
          alt=""
          className="h-full w-full object-cover"
          draggable={false}
          onError={(e) => { e.currentTarget.style.display = 'none'; }}
        />
      )}
    </div>
  );
}
