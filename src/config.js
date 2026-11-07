require('dotenv').config();

const TIMEZONE = process.env.TIMEZONE || 'Asia/Kuala_Lumpur';

// Rank MLBB (ikut turutan rendah -> tinggi)
const RANKS = [
  { key: 'warrior', name: 'Warrior', emoji: '🥉', color: 0x8d6e63 },
  { key: 'elite', name: 'Elite', emoji: '🥈', color: 0x90a4ae },
  { key: 'master', name: 'Master', emoji: '🥇', color: 0xffca28 },
  { key: 'grandmaster', name: 'Grandmaster', emoji: '💠', color: 0x26c6da },
  { key: 'epic', name: 'Epic', emoji: '💜', color: 0xab47bc },
  { key: 'legend', name: 'Legend', emoji: '🔶', color: 0xff7043 },
  { key: 'mythic', name: 'Mythic', emoji: '🔮', color: 0x7e57c2 },
  { key: 'honor', name: 'Mythical Honor', emoji: '🌟', color: 0x5c6bc0 },
  { key: 'glory', name: 'Mythical Glory', emoji: '👑', color: 0xffd600 },
  { key: 'immortal', name: 'Mythical Immortal', emoji: '🔥', color: 0xd50000 },
];

const LANES = [
  { key: 'gold', name: 'Gold Lane', emoji: '🏹' },
  { key: 'exp', name: 'EXP Lane', emoji: '🛡️' },
  { key: 'mid', name: 'Mid Lane', emoji: '🔮' },
  { key: 'jungle', name: 'Jungler', emoji: '🐺' },
  { key: 'roam', name: 'Roamer', emoji: '🧭' },
];

const MODES = ['Ranked', 'Classic', 'Brawl', 'Custom', 'Mabar Santai'];

const ROLES = {
  topActive: '🏆 Top 10 Aktif',
  eventPing: '📅 Ping Aktiviti',
  partyPing: '🎮 Ping Party',
};

// Struktur server. `key` digunakan oleh bot untuk cari channel, `name` ialah nama sebenar di Discord.
const LAYOUT = [
  {
    category: '📢 MAKLUMAT',
    channels: [
      { key: 'rules', name: '📜・peraturan', readOnly: true },
      { key: 'announcements', name: '📣・pengumuman', readOnly: true },
      { key: 'roles', name: '🎭・pilih-role', readOnly: true },
      { key: 'leaderboard', name: '🏆・top-aktif', readOnly: true },
    ],
  },
  {
    category: '🎮 CARI PARTY',
    channels: [
      { key: 'partyGuide', name: '📋・panduan-party', readOnly: true },
      { key: 'party', name: '🔎・cari-party', topic: 'Guna /party untuk buka lobby. Chat biasa di sini akan dipadam supaya senang baca.' },
      { key: 'partyChat', name: '💬・borak-party', topic: 'Bincang strategi, draft, dan cari kawan tetap.' },
    ],
  },
  {
    category: '💬 BORAK',
    channels: [
      { key: 'general', name: '💬・borak-umum' },
      { key: 'dailyTopic', name: '🗣️・topik-harian', topic: 'Topik baru setiap hari. Jawab dalam thread!' },
      { key: 'mlbb', name: '🎮・borak-mlbb', topic: 'Meta, build, hero, patch notes.' },
      { key: 'savage', name: '🖼️・savage-maniac', topic: 'Kongsi screenshot Savage, Maniac, MVP, win streak.' },
      { key: 'meme', name: '😂・meme' },
      { key: 'otherGames', name: '🕹️・game-lain' },
    ],
  },
  {
    category: '📅 AKTIVITI',
    channels: [
      { key: 'weekly', name: '📅・aktiviti-mingguan', readOnly: true },
      { key: 'eventChat', name: '🏟️・event-chat' },
    ],
  },
  {
    category: '🔊 VOICE',
    channels: [
      { key: 'voiceLobby', name: '🔊 Lobby', voice: true },
      { key: 'voiceRanked1', name: '🎮 Ranked 1', voice: true, userLimit: 5 },
      { key: 'voiceRanked2', name: '🎮 Ranked 2', voice: true, userLimit: 5 },
      { key: 'voiceRanked3', name: '🎮 Ranked 3', voice: true, userLimit: 5 },
      { key: 'voiceCustom', name: '🏟️ Custom 5v5', voice: true, userLimit: 10 },
      { key: 'voiceAfk', name: '💤 AFK', voice: true },
    ],
  },
  {
    category: '🎧 PARTY VOICE',
    key: 'partyVoiceCategory',
    channels: [],
  },
];

module.exports = {
  TOKEN: process.env.DISCORD_TOKEN,
  CLIENT_ID: process.env.CLIENT_ID,
  GUILD_ID: process.env.GUILD_ID,
  TIMEZONE,
  DAILY_TOPIC_CRON: process.env.DAILY_TOPIC_CRON || '0 12 * * *',
  RANKS,
  LANES,
  MODES,
  ROLES,
  LAYOUT,
  // Sistem mata aktif
  ACTIVITY: {
    messageCooldownSec: 30, // mesej dalam tempoh ini tidak dikira (anti-spam)
    minMessageLength: 3,
    voiceTickMinutes: 5, // semakan voice setiap 5 minit
    voiceMinutesPerPoint: 10, // 10 minit voice = 1 mata
  },
  PARTY: {
    expireMinutes: 60, // lobby tutup sendiri selepas 60 minit
  },
  CUSTOM_MATCH_SIZE: 10,
};
