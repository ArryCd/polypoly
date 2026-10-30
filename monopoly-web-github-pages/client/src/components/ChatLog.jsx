import React, { useEffect, useRef, useState } from 'react';
import { Send } from 'lucide-react';
import { emit } from '../transport.js';

export default function ChatLog({ room }) {
  const [tab, setTab] = useState('all');
  const [text, setText] = useState('');
  const ref = useRef(null);
  const items = room.log.filter((l) => tab === 'all' || l.kind === tab);

  useEffect(() => { if (ref.current) ref.current.scrollTop = ref.current.scrollHeight; }, [items.length, tab]);

  const send = async (e) => {
    e.preventDefault();
    if (!text.trim()) return;
    const t = text;
    setText('');
    await emit('chat', { text: t });
  };

  return (
    <div className="flex h-full min-h-0 flex-col rounded-xl border border-slate-700 bg-slate-800/70">
      <div className="flex border-b border-slate-700 text-xs">
        {[['all', 'All'], ['log', 'Game log'], ['chat', 'Chat']].map(([k, label]) => (
          <button key={k} onClick={() => setTab(k)} className={`flex-1 py-2 font-semibold ${tab === k ? 'text-emerald-400' : 'text-slate-400'}`}>{label}</button>
        ))}
      </div>
      <div ref={ref} className="min-h-0 flex-1 space-y-1 overflow-auto p-2 text-xs">
        {items.map((l, i) =>
          l.kind === 'chat'
            ? <p key={i}><b style={{ color: l.color }}>{l.name}:</b> {l.text}</p>
            : <p key={i} className="text-slate-400">{l.text}</p>
        )}
      </div>
      <form onSubmit={send} className="flex gap-1 border-t border-slate-700 p-2">
        <input className="input !py-1.5" value={text} onChange={(e) => setText(e.target.value)} placeholder="Say something…" maxLength={300} />
        <button className="btn btn-secondary !px-2.5"><Send size={14} /></button>
      </form>
    </div>
  );
}
