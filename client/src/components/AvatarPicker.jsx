import React, { useRef, useState } from 'react';
import { Upload, Link as LinkIcon } from 'lucide-react';
import Avatar from './Avatar.jsx';
import { fileToAvatar } from '../utils.js';

export const PRESETS = ['🎩', '🚗', '🐕', '🐈', '🚢', '👢', '🦖', '🚀', '👑', '🐧', '🦄', '🤖'];

export default function AvatarPicker({ value, onChange }) {
  const fileRef = useRef(null);
  const [url, setUrl] = useState('');
  const [err, setErr] = useState('');

  const onFile = async (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    try {
      onChange(await fileToAvatar(f));
      setErr('');
    } catch {
      setErr('Could not read that image.');
    }
  };

  const applyUrl = () => {
    if (!/^https?:\/\//i.test(url.trim())) return setErr('Enter a valid http(s) image URL.');
    setErr('');
    onChange(url.trim());
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <Avatar src={value} size={64} color="#34d399" />
        <p className="text-xs text-slate-400">Pick a token, paste an image URL, or upload a photo (auto-cropped to a circle).</p>
      </div>
      <div className="grid grid-cols-6 gap-2">
        {PRESETS.map((e) => (
          <button
            type="button"
            key={e}
            onClick={() => onChange(`emoji:${e}`)}
            className={`rounded-lg border p-1.5 text-2xl transition hover:bg-slate-700 ${value === `emoji:${e}` ? 'border-emerald-400 bg-slate-700' : 'border-slate-600'}`}
          >
            {e}
          </button>
        ))}
      </div>
      <div className="flex gap-2">
        <input className="input" placeholder="https://… image URL" value={url} onChange={(e) => setUrl(e.target.value)} />
        <button type="button" className="btn btn-secondary" onClick={applyUrl} title="Use URL"><LinkIcon size={16} /></button>
        <button type="button" className="btn btn-secondary" onClick={() => fileRef.current?.click()} title="Upload"><Upload size={16} /></button>
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onFile} />
      </div>
      {err && <p className="text-xs text-rose-400">{err}</p>}
    </div>
  );
}
