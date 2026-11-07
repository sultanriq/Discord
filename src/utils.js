const { TIMEZONE } = require('./config');

/** 'YYYY-MM' ikut zon masa server. offset = -1 untuk bulan lepas. */
function monthKey(date = new Date(), offset = 0) {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: TIMEZONE, year: 'numeric', month: '2-digit' })
    .formatToParts(date);
  let y = Number(parts.find((p) => p.type === 'year').value);
  let m = Number(parts.find((p) => p.type === 'month').value) + offset;
  while (m < 1) { m += 12; y -= 1; }
  while (m > 12) { m -= 12; y += 1; }
  return `${y}-${String(m).padStart(2, '0')}`;
}

const BULAN = ['Januari', 'Februari', 'Mac', 'April', 'Mei', 'Jun', 'Julai', 'Ogos', 'September', 'Oktober', 'November', 'Disember'];
function monthLabel(key) {
  const [y, m] = key.split('-').map(Number);
  return `${BULAN[m - 1]} ${y}`;
}

/** Hari dalam tahun (0-365) ikut zon masa — untuk putaran kandungan. */
function dayOfYear(date = new Date()) {
  const s = new Intl.DateTimeFormat('en-CA', { timeZone: TIMEZONE, year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
  const [y, m, d] = s.split('-').map(Number);
  return Math.floor((Date.UTC(y, m - 1, d) - Date.UTC(y, 0, 1)) / 86400000);
}

function weekOfYear(date = new Date()) {
  return Math.floor(dayOfYear(date) / 7);
}

function shuffle(arr, rand = Math.random) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const MEDALS = ['🥇', '🥈', '🥉'];
function medal(i) {
  return MEDALS[i] || `**${i + 1}.**`;
}

module.exports = { monthKey, monthLabel, dayOfYear, weekOfYear, shuffle, medal };
