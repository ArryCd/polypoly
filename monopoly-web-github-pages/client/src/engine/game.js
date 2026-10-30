// Server-authoritative Monopoly rules engine. Every action returns an error string or null.
import { BOARD, groupMembers } from '../../../shared/board.js';

export const PLAYER_COLORS = ['#ef4444', '#3b82f6', '#22c55e', '#eab308', '#a855f7', '#ec4899'];
export const MAX_PLAYERS = 6;

const rnd = (n) => Math.floor(Math.random() * n);
const shuffle = (arr) => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = rnd(i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

const CHANCE = [
  { text: 'Advance to GO. Collect $200.', type: 'moveTo', pos: 0 },
  { text: 'Advance to Illinois Avenue.', type: 'moveTo', pos: 24 },
  { text: 'Advance to St. Charles Place.', type: 'moveTo', pos: 11 },
  { text: 'Advance to Boardwalk.', type: 'moveTo', pos: 39 },
  { text: 'Take a trip to Reading Railroad.', type: 'moveTo', pos: 5 },
  { text: 'Advance to the nearest Railroad. Pay owner double rent.', type: 'nearest', kind: 'railroad' },
  { text: 'Advance to the nearest Utility. Pay owner 10x the dice.', type: 'nearest', kind: 'utility' },
  { text: 'Bank pays you a dividend of $50.', type: 'money', amount: 50 },
  { text: 'Get Out of Jail Free.', type: 'jailCard' },
  { text: 'Go back 3 spaces.', type: 'back', n: 3 },
  { text: 'Go directly to Jail.', type: 'jail' },
  { text: 'General repairs: $25 per house, $100 per hotel.', type: 'repairs', house: 25, hotel: 100 },
  { text: 'Pay poor tax of $15.', type: 'money', amount: -15 },
  { text: 'Elected Chairman of the Board. Pay each player $50.', type: 'eachPay', amount: 50 },
  { text: 'Your building loan matures. Collect $150.', type: 'money', amount: 150 },
];

const CHEST = [
  { text: 'Advance to GO. Collect $200.', type: 'moveTo', pos: 0 },
  { text: 'Bank error in your favor. Collect $200.', type: 'money', amount: 200 },
  { text: "Doctor's fee. Pay $50.", type: 'money', amount: -50 },
  { text: 'From sale of stock you get $50.', type: 'money', amount: 50 },
  { text: 'Get Out of Jail Free.', type: 'jailCard' },
  { text: 'Go directly to Jail.', type: 'jail' },
  { text: 'Holiday fund matures. Receive $100.', type: 'money', amount: 100 },
  { text: 'Income tax refund. Collect $20.', type: 'money', amount: 20 },
  { text: 'It is your birthday. Collect $10 from every player.', type: 'eachCollect', amount: 10 },
  { text: 'Life insurance matures. Collect $100.', type: 'money', amount: 100 },
  { text: 'Hospital fees. Pay $100.', type: 'money', amount: -100 },
  { text: 'School fees. Pay $50.', type: 'money', amount: -50 },
  { text: 'Receive $25 consultancy fee.', type: 'money', amount: 25 },
  { text: 'Street repairs: $40 per house, $115 per hotel.', type: 'repairs', house: 40, hotel: 115 },
  { text: 'You won second prize in a beauty contest. Collect $10.', type: 'money', amount: 10 },
  { text: 'You inherit $100.', type: 'money', amount: 100 },
];

/* ---------- helpers ---------- */
const cur = (room) => room.players[room.turnIdx];
const P = (room, id) => room.players.find((p) => p.id === id);
const active = (room) => room.players.filter((p) => !p.bankrupt);

function log(room, text) {
  room.log.push({ kind: 'log', text, t: Date.now() });
  if (room.log.length > 300) room.log.shift();
}

function ownedIds(room, pid) {
  return Object.entries(room.props)
    .filter(([, v]) => v.owner === pid)
    .map(([k]) => Number(k))
    .sort((a, b) => a - b);
}

function hasMonopoly(room, pid, group) {
  return groupMembers(group).every((id) => room.props[id]?.owner === pid);
}

function groupHouses(room, group) {
  return groupMembers(group).map((id) => room.props[id]?.houses || 0);
}

function netWorth(room, p) {
  let n = p.cash;
  for (const id of ownedIds(room, p.id)) {
    const t = BOARD[id];
    const pr = room.props[id];
    n += pr.mortgaged ? t.price / 2 : t.price;
    n += (pr.houses || 0) * (t.houseCost || 0);
  }
  return Math.round(n);
}

export function view(room) {
  const { chance, chest, ...rest } = room;
  return { ...rest, players: room.players.map((p) => ({ ...p, netWorth: netWorth(room, p) })) };
}

function requireTurn(room, pid) {
  if (room.status !== 'playing') return 'The game is not running.';
  if (cur(room).id !== pid) return "It's not your turn.";
  return null;
}

function pay(room, from, to, amount) {
  if (from) {
    from.cash -= amount;
    from.creditor = to ? to.id : null;
  }
  if (to) to.cash += amount;
}

function rentFor(room, tileId, diceTotal, opts = {}) {
  const t = BOARD[tileId];
  const pr = room.props[tileId];
  if (!pr || pr.mortgaged) return 0;
  if (t.type === 'street') {
    if (pr.houses > 0) return t.rentTiers[pr.houses];
    const base = t.rentTiers[0];
    return hasMonopoly(room, pr.owner, t.colorGroup) ? base * 2 : base;
  }
  const n = groupMembers(t.colorGroup).filter((i) => room.props[i]?.owner === pr.owner).length;
  if (t.type === 'railroad') {
    let r = 25 * 2 ** (n - 1);
    if (opts.doubleRail) r *= 2;
    return r;
  }
  if (t.type === 'utility') {
    const mult = opts.tenX ? 10 : n === 2 ? 10 : 4;
    return mult * diceTotal;
  }
  return 0;
}

function setMove(room, p, from, teleport) {
  room.moveSeq += 1;
  room.lastMove = { playerId: p.id, from, to: p.pos, seq: room.moveSeq, teleport: !!teleport };
}

function step(room, p, steps) {
  const from = p.pos;
  const raw = from + steps;
  if (raw >= 40) {
    p.cash += 200;
    log(room, `${p.name} passed GO and collected $200.`);
  }
  p.pos = raw % 40;
  setMove(room, p, from, false);
}

function moveTo(room, p, pos, { collect = true, teleport = false } = {}) {
  const from = p.pos;
  if (collect && pos < from) {
    p.cash += 200;
    log(room, `${p.name} passed GO and collected $200.`);
  }
  p.pos = pos;
  setMove(room, p, from, teleport);
}

function sendToJail(room, p) {
  const from = p.pos;
  p.pos = 10;
  p.inJail = true;
  p.jailTurns = 0;
  room.extraTurn = false;
  room.doublesCount = 0;
  setMove(room, p, from, true);
  log(room, `${p.name} goes to Jail.`);
}

function landOn(room, p, total, opts = {}) {
  const t = BOARD[p.pos];
  room.pendingBuy = null;
  switch (t.type) {
    case 'street':
    case 'railroad':
    case 'utility': {
      const pr = room.props[t.id];
      if (!pr) {
        room.pendingBuy = t.id;
        log(room, `${p.name} landed on ${t.name} (unowned, $${t.price}).`);
      } else if (pr.owner !== p.id) {
        const owner = P(room, pr.owner);
        const rent = rentFor(room, t.id, total, opts);
        if (rent > 0 && owner && !owner.bankrupt) {
          pay(room, p, owner, rent);
          log(room, `${p.name} paid $${rent} rent to ${owner.name} for ${t.name}.`);
        } else {
          log(room, `${p.name} landed on ${t.name} (mortgaged, no rent).`);
        }
      }
      break;
    }
    case 'tax':
      pay(room, p, null, t.amount);
      log(room, `${p.name} paid $${t.amount} for ${t.name}.`);
      break;
    case 'chance':
      drawCard(room, p, 'chance', total);
      break;
    case 'chest':
      drawCard(room, p, 'chest', total);
      break;
    case 'gotojail':
      sendToJail(room, p);
      break;
    default:
      break;
  }
}

function drawCard(room, p, deckName, total) {
  const deck = room[deckName];
  if (!deck.length) room[deckName] = shuffle(deckName === 'chance' ? CHANCE : CHEST);
  const card = room[deckName].shift();
  log(room, `${p.name} drew ${deckName === 'chance' ? 'Chance' : 'Community Chest'}: ${card.text}`);
  if (card.type !== 'jailCard') room[deckName].push(card);
  const others = () => active(room).filter((o) => o.id !== p.id);
  switch (card.type) {
    case 'money':
      if (card.amount >= 0) p.cash += card.amount;
      else pay(room, p, null, -card.amount);
      break;
    case 'moveTo':
      moveTo(room, p, card.pos);
      landOn(room, p, total);
      break;
    case 'nearest': {
      let pos = p.pos;
      do pos = (pos + 1) % 40;
      while (BOARD[pos].type !== card.kind);
      moveTo(room, p, pos);
      landOn(room, p, total, card.kind === 'railroad' ? { doubleRail: true } : { tenX: true });
      break;
    }
    case 'back':
      moveTo(room, p, (p.pos - card.n + 40) % 40, { collect: false, teleport: true });
      landOn(room, p, total);
      break;
    case 'jail':
      sendToJail(room, p);
      break;
    case 'jailCard':
      p.jailCards += 1;
      break;
    case 'repairs': {
      let cost = 0;
      for (const id of ownedIds(room, p.id)) {
        const h = room.props[id].houses || 0;
        cost += h === 5 ? card.hotel : h * card.house;
      }
      if (cost) pay(room, p, null, cost);
      break;
    }
    case 'eachPay':
      for (const o of others()) pay(room, p, o, card.amount);
      break;
    case 'eachCollect':
      for (const o of others()) pay(room, o, p, card.amount);
      break;
    default:
      break;
  }
}

function nextTurn(room) {
  let i = room.turnIdx;
  do i = (i + 1) % room.players.length;
  while (room.players[i].bankrupt);
  room.turnIdx = i;
  room.phase = 'roll';
  room.extraTurn = false;
  room.doublesCount = 0;
  room.pendingBuy = null;
  log(room, `It's ${room.players[i].name}'s turn.`);
}

function checkWinner(room) {
  const alive = active(room);
  if (room.status === 'playing' && alive.length === 1) {
    room.status = 'ended';
    room.winner = alive[0].id;
    log(room, `🏆 ${alive[0].name} wins the game!`);
  }
}

/* ---------- lobby ---------- */
export function newRoom(id) {
  return {
    id, status: 'lobby', hostId: null, startingCash: 1500, players: [], turnIdx: 0, phase: 'roll',
    props: {}, dice: [0, 0], extraTurn: false, doublesCount: 0, pendingBuy: null, trades: [], tradeSeq: 0,
    log: [], winner: null, lastMove: null, moveSeq: 0, chance: [], chest: [],
    createdAt: Date.now(), lastActive: Date.now(),
  };
}

export function addPlayer(room, { id, name, avatar }) {
  const used = new Set(room.players.map((p) => p.color));
  const color = PLAYER_COLORS.find((c) => !used.has(c)) || PLAYER_COLORS[0];
  const p = {
    id, name, avatar, color, cash: room.startingCash, pos: 0, inJail: false, jailTurns: 0,
    jailCards: 0, bankrupt: false, connected: true, creditor: null,
  };
  room.players.push(p);
  if (!room.hostId) room.hostId = id;
  return p;
}

export function removePlayer(room, pid) {
  room.players = room.players.filter((p) => p.id !== pid);
  if (room.hostId === pid) room.hostId = room.players[0]?.id || null;
}

export function setStartingCash(room, pid, { amount }) {
  if (room.status !== 'lobby') return 'Game already started.';
  if (room.hostId !== pid) return 'Only the host can change starting cash.';
  const n = Math.round(Number(amount));
  if (!Number.isFinite(n)) return 'Invalid amount.';
  room.startingCash = Math.min(20000, Math.max(500, n));
  room.players.forEach((p) => (p.cash = room.startingCash));
  return null;
}

export function startGame(room, pid) {
  if (room.status !== 'lobby') return 'Game already started.';
  if (room.hostId !== pid) return 'Only the host can start the game.';
  if (room.players.length < 2) return 'You need at least 2 players.';
  room.players.forEach((p) => {
    p.cash = room.startingCash;
    p.pos = 0;
  });
  room.chance = shuffle(CHANCE);
  room.chest = shuffle(CHEST);
  room.status = 'playing';
  room.turnIdx = rnd(room.players.length);
  room.phase = 'roll';
  log(room, `Game started with $${room.startingCash} each. ${cur(room).name} goes first.`);
  return null;
}

/* ---------- turn actions ---------- */
export function roll(room, pid) {
  const e = requireTurn(room, pid);
  if (e) return e;
  const p = cur(room);
  if (p.cash < 0) return 'You are in debt: raise cash (mortgage/sell houses) or declare bankruptcy.';
  if (!(room.phase === 'roll' || (room.phase === 'action' && room.extraTurn))) return 'You cannot roll now.';
  room.pendingBuy = null;
  const d1 = 1 + rnd(6);
  const d2 = 1 + rnd(6);
  const total = d1 + d2;
  const dbl = d1 === d2;
  room.dice = [d1, d2];
  room.extraTurn = false;
  log(room, `${p.name} rolled ${d1}-${d2}${dbl ? ' (doubles!)' : ''}.`);

  if (p.inJail) {
    if (dbl) {
      p.inJail = false;
      p.jailTurns = 0;
      log(room, `${p.name} rolled doubles and leaves Jail.`);
      step(room, p, total);
      landOn(room, p, total);
    } else {
      p.jailTurns += 1;
      if (p.jailTurns >= 3) {
        pay(room, p, null, 50);
        p.inJail = false;
        p.jailTurns = 0;
        log(room, `${p.name} paid $50 after 3 turns and leaves Jail.`);
        step(room, p, total);
        landOn(room, p, total);
      } else {
        log(room, `${p.name} stays in Jail (attempt ${p.jailTurns}/3).`);
      }
    }
    room.phase = 'action';
    return null;
  }

  room.doublesCount = dbl ? room.doublesCount + 1 : 0;
  if (room.doublesCount >= 3) {
    log(room, `${p.name} rolled 3 doubles in a row — speeding!`);
    sendToJail(room, p);
    room.phase = 'action';
    return null;
  }
  step(room, p, total);
  landOn(room, p, total);
  room.extraTurn = dbl && !p.inJail && !p.bankrupt;
  room.phase = 'action';
  return null;
}

export function buyProperty(room, pid) {
  const e = requireTurn(room, pid);
  if (e) return e;
  if (room.pendingBuy == null) return 'Nothing to buy.';
  const p = cur(room);
  const t = BOARD[room.pendingBuy];
  if (p.cash < t.price) return `You need $${t.price} to buy ${t.name}.`;
  p.cash -= t.price;
  room.props[t.id] = { owner: pid, houses: 0, mortgaged: false };
  room.pendingBuy = null;
  log(room, `${p.name} bought ${t.name} for $${t.price}.`);
  return null;
}

export function declineBuy(room, pid) {
  const e = requireTurn(room, pid);
  if (e) return e;
  if (room.pendingBuy == null) return 'Nothing to decline.';
  log(room, `${cur(room).name} passed on ${BOARD[room.pendingBuy].name}.`);
  room.pendingBuy = null;
  return null;
}

export function endTurn(room, pid) {
  const e = requireTurn(room, pid);
  if (e) return e;
  const p = cur(room);
  if (room.phase !== 'action') return 'Roll the dice first.';
  if (room.extraTurn) return 'You rolled doubles — roll again!';
  if (p.cash < 0) return 'You are in debt: raise cash or declare bankruptcy.';
  nextTurn(room);
  return null;
}

export function payBail(room, pid) {
  const e = requireTurn(room, pid);
  if (e) return e;
  const p = cur(room);
  if (!p.inJail) return 'You are not in Jail.';
  if (room.phase !== 'roll') return 'You can only pay bail before rolling.';
  if (p.cash < 50) return 'You need $50.';
  pay(room, p, null, 50);
  p.inJail = false;
  p.jailTurns = 0;
  log(room, `${p.name} paid $50 bail.`);
  return null;
}

export function useJailCard(room, pid) {
  const e = requireTurn(room, pid);
  if (e) return e;
  const p = cur(room);
  if (!p.inJail) return 'You are not in Jail.';
  if (room.phase !== 'roll') return 'You can only do this before rolling.';
  if (p.jailCards < 1) return 'You have no Get Out of Jail Free card.';
  p.jailCards -= 1;
  p.inJail = false;
  p.jailTurns = 0;
  room.chance.push({ text: 'Get Out of Jail Free.', type: 'jailCard' });
  log(room, `${p.name} used a Get Out of Jail Free card.`);
  return null;
}

/* ---------- properties ---------- */
function ownedStreet(room, pid, tileId) {
  const t = BOARD[tileId];
  const pr = room.props[tileId];
  if (!t || !pr || pr.owner !== pid) return { err: 'You do not own that property.' };
  return { t, pr };
}

export function build(room, pid, { tileId }) {
  if (room.status !== 'playing') return 'The game is not running.';
  const { t, pr, err } = ownedStreet(room, pid, tileId);
  if (err) return err;
  if (t.type !== 'street') return 'You can only build on streets.';
  const me = P(room, pid);
  if (!hasMonopoly(room, pid, t.colorGroup)) return 'You need the full color set to build.';
  if (groupMembers(t.colorGroup).some((id) => room.props[id].mortgaged)) return 'Unmortgage the whole color set first.';
  if (pr.houses >= 5) return 'Already has a hotel.';
  if (pr.houses > Math.min(...groupHouses(room, t.colorGroup))) return 'Build evenly across the color set.';
  if (me.cash < t.houseCost) return `You need $${t.houseCost}.`;
  me.cash -= t.houseCost;
  pr.houses += 1;
  log(room, `${me.name} built a ${pr.houses === 5 ? 'hotel' : 'house'} on ${t.name}.`);
  return null;
}

export function sellHouse(room, pid, { tileId }) {
  if (room.status !== 'playing') return 'The game is not running.';
  const { t, pr, err } = ownedStreet(room, pid, tileId);
  if (err) return err;
  if (t.type !== 'street' || pr.houses < 1) return 'No houses to sell.';
  if (pr.houses < Math.max(...groupHouses(room, t.colorGroup))) return 'Sell evenly across the color set.';
  const me = P(room, pid);
  me.cash += t.houseCost / 2;
  pr.houses -= 1;
  log(room, `${me.name} sold a building on ${t.name} for $${t.houseCost / 2}.`);
  return null;
}

export function mortgage(room, pid, { tileId }) {
  if (room.status !== 'playing') return 'The game is not running.';
  const { t, pr, err } = ownedStreet(room, pid, tileId);
  if (err) return err;
  if (pr.mortgaged) return 'Already mortgaged.';
  if (t.type === 'street' && groupHouses(room, t.colorGroup).some((h) => h > 0)) return 'Sell all buildings in this color set first.';
  const me = P(room, pid);
  pr.mortgaged = true;
  me.cash += t.price / 2;
  log(room, `${me.name} mortgaged ${t.name} for $${t.price / 2}.`);
  return null;
}

export function unmortgage(room, pid, { tileId }) {
  if (room.status !== 'playing') return 'The game is not running.';
  const { t, pr, err } = ownedStreet(room, pid, tileId);
  if (err) return err;
  if (!pr.mortgaged) return 'Not mortgaged.';
  const cost = Math.ceil((t.price / 2) * 1.1);
  const me = P(room, pid);
  if (me.cash < cost) return `You need $${cost}.`;
  me.cash -= cost;
  pr.mortgaged = false;
  log(room, `${me.name} paid $${cost} to unmortgage ${t.name}.`);
  return null;
}

/* ---------- trading ---------- */
function tradable(room, pid, ids) {
  return ids.every((id) => {
    const pr = room.props[id];
    if (!pr || pr.owner !== pid) return false;
    const t = BOARD[id];
    return t.type !== 'street' || groupHouses(room, t.colorGroup).every((h) => h === 0);
  });
}

function cleanTrade(room, raw) {
  const ints = (a) => (Array.isArray(a) ? [...new Set(a.map(Number).filter((n) => Number.isInteger(n) && n >= 0 && n < 40))] : []);
  const cash = (v) => Math.max(0, Math.round(Number(v) || 0));
  return {
    to: raw.to, offerCash: cash(raw.offerCash), requestCash: cash(raw.requestCash),
    offerProps: ints(raw.offerProps), requestProps: ints(raw.requestProps),
  };
}

function validateTrade(room, tr) {
  const a = P(room, tr.from);
  const b = P(room, tr.to);
  if (!a || !b || a.bankrupt || b.bankrupt) return 'Invalid trade partners.';
  if (a.cash < tr.offerCash) return `${a.name} does not have enough cash.`;
  if (b.cash < tr.requestCash) return `${b.name} does not have enough cash.`;
  if (!tradable(room, a.id, tr.offerProps)) return `${a.name} cannot trade those properties (buildings on the set?).`;
  if (!tradable(room, b.id, tr.requestProps)) return `${b.name} cannot trade those properties (buildings on the set?).`;
  return null;
}

export function proposeTrade(room, pid, raw) {
  if (room.status !== 'playing') return 'The game is not running.';
  const t = cleanTrade(room, raw);
  if (t.to === pid) return 'Pick another player.';
  const tr = { id: ++room.tradeSeq, from: pid, ...t };
  if (!tr.offerCash && !tr.requestCash && !tr.offerProps.length && !tr.requestProps.length) return 'Trade is empty.';
  const err = validateTrade(room, tr);
  if (err) return err;
  room.trades.push(tr);
  log(room, `${P(room, pid).name} proposed a trade to ${P(room, tr.to).name}.`);
  return null;
}

export function respondTrade(room, pid, { tradeId, accept }) {
  const tr = room.trades.find((x) => x.id === tradeId);
  if (!tr) return 'Trade no longer exists.';
  if (pid !== tr.to && pid !== tr.from) return 'Not your trade.';
  room.trades = room.trades.filter((x) => x.id !== tradeId);
  const a = P(room, tr.from);
  const b = P(room, tr.to);
  if (pid === tr.from) {
    log(room, `${a.name} cancelled the trade.`);
    return null;
  }
  if (!accept) {
    log(room, `${b.name} declined ${a.name}'s trade.`);
    return null;
  }
  const err = validateTrade(room, tr);
  if (err) return err;
  a.cash += tr.requestCash - tr.offerCash;
  b.cash += tr.offerCash - tr.requestCash;
  tr.offerProps.forEach((id) => (room.props[id].owner = b.id));
  tr.requestProps.forEach((id) => (room.props[id].owner = a.id));
  log(room, `${a.name} and ${b.name} completed a trade.`);
  return null;
}

/* ---------- bankruptcy & chat ---------- */
export function declareBankruptcy(room, pid) {
  if (room.status !== 'playing') return 'The game is not running.';
  const p = P(room, pid);
  if (!p || p.bankrupt) return 'Not allowed.';
  const creditor = p.creditor ? P(room, p.creditor) : null;
  const ids = ownedIds(room, pid);
  if (creditor && !creditor.bankrupt) {
    creditor.cash += Math.max(0, p.cash);
    creditor.jailCards += p.jailCards;
    ids.forEach((id) => {
      room.props[id].owner = creditor.id;
      room.props[id].houses = 0;
    });
  } else {
    ids.forEach((id) => delete room.props[id]);
  }
  p.cash = 0;
  p.jailCards = 0;
  p.bankrupt = true;
  p.inJail = false;
  room.trades = room.trades.filter((t) => t.from !== pid && t.to !== pid);
  log(room, `💥 ${p.name} went bankrupt${creditor ? ` to ${creditor.name}` : ''}.`);
  const wasTurn = cur(room).id === pid;
  checkWinner(room);
  if (room.status === 'playing' && wasTurn) nextTurn(room);
  return null;
}

export function chat(room, pid, { text }) {
  const p = P(room, pid);
  const msg = String(text || '').trim().slice(0, 300);
  if (!p || !msg) return 'Empty message.';
  room.log.push({ kind: 'chat', playerId: pid, name: p.name, color: p.color, text: msg, t: Date.now() });
  if (room.log.length > 300) room.log.shift();
  return null;
}
