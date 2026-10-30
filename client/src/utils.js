import { groupMembers } from '../../shared/board.js';

export const money = (n) => `$${Number(n).toLocaleString()}`;

export function getPlayerId() {
  let id = localStorage.getItem('mono_player_id');
  if (!id) {
    id = (crypto.randomUUID?.() || Math.random().toString(36).slice(2) + Date.now().toString(36));
    localStorage.setItem('mono_player_id', id);
  }
  return id;
}

export const loadSession = () => {
  try { return JSON.parse(localStorage.getItem('mono_session') || 'null'); } catch { return null; }
};
export const saveSession = (s) => localStorage.setItem('mono_session', JSON.stringify(s));
export const clearSession = () => localStorage.removeItem('mono_session');

export const ownedIds = (room, pid) =>
  Object.entries(room.props).filter(([, v]) => v.owner === pid).map(([k]) => Number(k)).sort((a, b) => a - b);

export const hasMonopoly = (room, pid, group) =>
  groupMembers(group).every((id) => room.props[id]?.owner === pid);

export function inviteLink(roomId) {
  // Hash routing works on static hosts (GitHub Pages) with no server rewrites.
  return `${window.location.origin}${window.location.pathname}#/join/${roomId}`;
}

export async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const ta = document.createElement('textarea');
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    ta.remove();
    return ok;
  }
}

// Resize an uploaded image to a small square data URL so tokens stay light.
export function fileToAvatar(file, size = 128) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = () => {
      const img = new Image();
      img.onerror = reject;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = canvas.height = size;
        const ctx = canvas.getContext('2d');
        const s = Math.min(img.width, img.height);
        ctx.drawImage(img, (img.width - s) / 2, (img.height - s) / 2, s, s, 0, 0, size, size);
        resolve(canvas.toDataURL('image/jpeg', 0.85));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

export const goHome = () => { window.location.href = window.location.pathname; };
export const parseJoinCode = () => {
  const m = window.location.hash.match(/^#\/join\/([A-Za-z0-9]{4,8})/i);
  return m ? m[1].toUpperCase() : null;
};
