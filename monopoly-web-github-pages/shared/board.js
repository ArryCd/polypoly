// 40-tile standard board metadata (shared by server and client).
// Note: standard Monopoly has 3 Chance + 3 Community Chest (28 properties + 6 cards + 2 taxes + 4 corners = 40).

export const GROUP_COLORS = {
  brown: '#955436',
  lightblue: '#aae0fa',
  pink: '#d93a96',
  orange: '#f7941d',
  red: '#ed1b24',
  yellow: '#fef200',
  green: '#1fb25a',
  darkblue: '#0072bb',
  railroad: '#374151',
  utility: '#9ca3af',
};

const S = (id, name, price, colorGroup, rentTiers, houseCost) => ({
  id, name, type: 'street', price, colorGroup, rentTiers, houseCost,
});
const R = (id, name) => ({ id, name, type: 'railroad', price: 200, colorGroup: 'railroad', rentTiers: [25, 50, 100, 200] });
const U = (id, name) => ({ id, name, type: 'utility', price: 150, colorGroup: 'utility' });

export const BOARD = [
  { id: 0, name: 'GO', type: 'go' },
  S(1, 'Mediterranean Avenue', 60, 'brown', [2, 10, 30, 90, 160, 250], 50),
  { id: 2, name: 'Community Chest', type: 'chest' },
  S(3, 'Baltic Avenue', 60, 'brown', [4, 20, 60, 180, 320, 450], 50),
  { id: 4, name: 'Income Tax', type: 'tax', amount: 200 },
  R(5, 'Reading Railroad'),
  S(6, 'Oriental Avenue', 100, 'lightblue', [6, 30, 90, 270, 400, 550], 50),
  { id: 7, name: 'Chance', type: 'chance' },
  S(8, 'Vermont Avenue', 100, 'lightblue', [6, 30, 90, 270, 400, 550], 50),
  S(9, 'Connecticut Avenue', 120, 'lightblue', [8, 40, 100, 300, 450, 600], 50),
  { id: 10, name: 'Jail / Just Visiting', type: 'jail' },
  S(11, 'St. Charles Place', 140, 'pink', [10, 50, 150, 450, 625, 750], 100),
  U(12, 'Electric Company'),
  S(13, 'States Avenue', 140, 'pink', [10, 50, 150, 450, 625, 750], 100),
  S(14, 'Virginia Avenue', 160, 'pink', [12, 60, 180, 500, 700, 900], 100),
  R(15, 'Pennsylvania Railroad'),
  S(16, 'St. James Place', 180, 'orange', [14, 70, 200, 550, 750, 950], 100),
  { id: 17, name: 'Community Chest', type: 'chest' },
  S(18, 'Tennessee Avenue', 180, 'orange', [14, 70, 200, 550, 750, 950], 100),
  S(19, 'New York Avenue', 200, 'orange', [16, 80, 220, 600, 800, 1000], 100),
  { id: 20, name: 'Free Parking', type: 'parking' },
  S(21, 'Kentucky Avenue', 220, 'red', [18, 90, 250, 700, 875, 1050], 150),
  { id: 22, name: 'Chance', type: 'chance' },
  S(23, 'Indiana Avenue', 220, 'red', [18, 90, 250, 700, 875, 1050], 150),
  S(24, 'Illinois Avenue', 240, 'red', [20, 100, 300, 750, 925, 1100], 150),
  R(25, 'B&O Railroad'),
  S(26, 'Atlantic Avenue', 260, 'yellow', [22, 110, 330, 800, 975, 1150], 150),
  S(27, 'Ventnor Avenue', 260, 'yellow', [22, 110, 330, 800, 975, 1150], 150),
  U(28, 'Water Works'),
  S(29, 'Marvin Gardens', 280, 'yellow', [24, 120, 360, 850, 1025, 1200], 150),
  { id: 30, name: 'Go To Jail', type: 'gotojail' },
  S(31, 'Pacific Avenue', 300, 'green', [26, 130, 390, 900, 1100, 1275], 200),
  S(32, 'North Carolina Avenue', 300, 'green', [26, 130, 390, 900, 1100, 1275], 200),
  { id: 33, name: 'Community Chest', type: 'chest' },
  S(34, 'Pennsylvania Avenue', 320, 'green', [28, 150, 450, 1000, 1200, 1400], 200),
  R(35, 'Short Line'),
  { id: 36, name: 'Chance', type: 'chance' },
  S(37, 'Park Place', 350, 'darkblue', [35, 175, 500, 1100, 1300, 1500], 200),
  { id: 38, name: 'Luxury Tax', type: 'tax', amount: 100 },
  S(39, 'Boardwalk', 400, 'darkblue', [50, 200, 600, 1400, 1700, 2000], 200),
];

export const groupMembers = (group) => BOARD.filter((t) => t.colorGroup === group).map((t) => t.id);
