import React from 'react';

const PIPS = {
  1: [4], 2: [0, 8], 3: [0, 4, 8], 4: [0, 2, 6, 8], 5: [0, 2, 4, 6, 8], 6: [0, 2, 3, 5, 6, 8],
};

function Die({ value, animKey }) {
  return (
    <div key={animKey} className={`${value ? 'dice-roll' : ''} grid h-14 w-14 grid-cols-3 grid-rows-3 gap-0.5 rounded-xl bg-white p-1.5 shadow-lg`}>
      {Array.from({ length: 9 }).map((_, i) => (
        <span key={i} className={`m-auto h-2.5 w-2.5 rounded-full ${PIPS[value]?.includes(i) ? 'bg-slate-900' : ''}`} />
      ))}
    </div>
  );
}

export default function Dice({ dice, seq }) {
  return (
    <div className="flex gap-3">
      <Die value={dice[0]} animKey={`a${seq}`} />
      <Die value={dice[1]} animKey={`b${seq}`} />
    </div>
  );
}
