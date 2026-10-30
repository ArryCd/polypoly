# Monopoly Online (browser-only, GitHub Pages)

Real-time multiplayer Monopoly for 2–6 players. **No backend**: it's static files.
The *host's browser* runs the rules engine and friends connect to it peer-to-peer (WebRTC via PeerJS).
The free public PeerJS broker is used only for the initial handshake.

## Play locally
```bash
npm install
npm run dev        # http://localhost:5173
```
Create a room → **Copy Invite Link** → open the link in another browser/device → enter name + avatar → Join.

## Deploy to GitHub Pages
1. Create a GitHub repo and push this folder to the `main` branch.
2. Repo → **Settings → Pages → Build and deployment → Source: GitHub Actions**.
3. The included workflow (`.github/workflows/deploy.yml`) builds and publishes on every push.
4. Your game is live at `https://<user>.github.io/<repo>/`. Invite links look like
   `https://<user>.github.io/<repo>/#/join/ABC123` (hash routing, so no server rewrites needed).

## How it works
- `client/src/engine/game.js` – rules engine (dice, doubles, jail, rent, houses, mortgage, trades, bankruptcy, cards)
- `client/src/transport.js` – PeerJS host/guest networking; the host validates every action and broadcasts state
- `shared/board.js` – 40-tile board JSON
- `client/src/components/` – `LobbyScreen`, `Board`, `TileToken`, `PlayerDashboard`, `TradeModal`, `PropertyModal`, `ChatLog`…

## Things to know
- **The host must keep the game tab open.** If the host reloads, the game is restored from their browser's
  localStorage and guests auto-reconnect within a few seconds. If the host closes the tab for good, the game ends.
- Guests who refresh also rejoin automatically.
- Some strict networks (corporate / certain mobile carriers) block direct WebRTC and would need a TURN server;
  add one in `peerOpts()` in `transport.js` (`config: { iceServers: [...] }`) if friends can't connect.
- The host is trusted (friends game) — a modified client could cheat if it hosts.
- No auctions; 3 Chance + 3 Community Chest tiles (the standard 40-tile layout).
- To self-host the broker, build with `VITE_PEER_HOST`, `VITE_PEER_PORT`, `VITE_PEER_PATH`, `VITE_PEER_SECURE`.
