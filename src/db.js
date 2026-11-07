const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');
const { ACTIVITY } = require('./config');

function open(file = process.env.DB_PATH || path.join(__dirname, '..', 'data', 'bot.db')) {
  if (file !== ':memory:') fs.mkdirSync(path.dirname(file), { recursive: true });
  const db = new Database(file);
  db.pragma('journal_mode = WAL');
  db.exec(`
    CREATE TABLE IF NOT EXISTS activity (
      guild_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      month TEXT NOT NULL,             -- 'YYYY-MM'
      messages INTEGER NOT NULL DEFAULT 0,
      voice_minutes INTEGER NOT NULL DEFAULT 0,
      bonus INTEGER NOT NULL DEFAULT 0, -- mata dari aktiviti/event
      PRIMARY KEY (guild_id, user_id, month)
    );
    CREATE TABLE IF NOT EXISTS parties (
      message_id TEXT PRIMARY KEY,
      guild_id TEXT NOT NULL,
      channel_id TEXT NOT NULL,
      host_id TEXT NOT NULL,
      mode TEXT NOT NULL,
      rank TEXT,
      slots INTEGER NOT NULL,          -- jumlah pemain diperlukan termasuk host
      lanes TEXT,
      note TEXT,
      members TEXT NOT NULL,           -- JSON array user id
      voice_id TEXT,
      status TEXT NOT NULL DEFAULT 'open',
      created_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS temp_voice (
      channel_id TEXT PRIMARY KEY,
      guild_id TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS kv (
      guild_id TEXT NOT NULL,
      key TEXT NOT NULL,
      value TEXT,
      PRIMARY KEY (guild_id, key)
    );
  `);
  return wrap(db);
}

function wrap(db) {
  const upsert = (field) =>
    db.prepare(`
      INSERT INTO activity (guild_id, user_id, month, ${field}) VALUES (?, ?, ?, ?)
      ON CONFLICT(guild_id, user_id, month) DO UPDATE SET ${field} = ${field} + excluded.${field}
    `);
  const addMsg = upsert('messages');
  const addVoice = upsert('voice_minutes');
  const addBonus = upsert('bonus');
  const pointsExpr = `(messages + voice_minutes / ${ACTIVITY.voiceMinutesPerPoint} + bonus)`;

  const top = db.prepare(`
    SELECT user_id, messages, voice_minutes, bonus, ${pointsExpr} AS points
    FROM activity WHERE guild_id = ? AND month = ? AND ${pointsExpr} > 0
    ORDER BY points DESC, messages DESC, user_id ASC LIMIT ?
  `);
  const userStats = db.prepare(`
    SELECT user_id, messages, voice_minutes, bonus, ${pointsExpr} AS points
    FROM activity WHERE guild_id = ? AND user_id = ? AND month = ?
  `);
  const rankOf = db.prepare(`
    SELECT COUNT(*) + 1 AS pos FROM activity
    WHERE guild_id = ? AND month = ? AND ${pointsExpr} > ?
  `);

  const kvGet = db.prepare('SELECT value FROM kv WHERE guild_id = ? AND key = ?');
  const kvSet = db.prepare(`
    INSERT INTO kv (guild_id, key, value) VALUES (?, ?, ?)
    ON CONFLICT(guild_id, key) DO UPDATE SET value = excluded.value
  `);

  const partyInsert = db.prepare(`
    INSERT INTO parties (message_id, guild_id, channel_id, host_id, mode, rank, slots, lanes, note, members, created_at)
    VALUES (@message_id, @guild_id, @channel_id, @host_id, @mode, @rank, @slots, @lanes, @note, @members, @created_at)
  `);
  const partyGet = db.prepare('SELECT * FROM parties WHERE message_id = ?');
  const partyUpdate = db.prepare('UPDATE parties SET members = ?, status = ?, voice_id = ? WHERE message_id = ?');
  const partyExpired = db.prepare("SELECT * FROM parties WHERE status IN ('open','full') AND created_at < ?");
  const partyOpenByHost = db.prepare("SELECT * FROM parties WHERE guild_id = ? AND host_id = ? AND status = 'open'");

  const parseParty = (p) => (p ? { ...p, members: JSON.parse(p.members) } : null);

  return {
    raw: db,
    addMessage: (g, u, month, n = 1) => addMsg.run(g, u, month, n),
    addVoice: (g, u, month, mins) => addVoice.run(g, u, month, mins),
    addBonus: (g, u, month, pts) => addBonus.run(g, u, month, pts),
    top: (g, month, limit = 10) => top.all(g, month, limit),
    userStats: (g, u, month) => userStats.get(g, u, month) || null,
    rankOf: (g, month, points) => rankOf.get(g, month, points).pos,

    get: (g, key, fallback = null) => {
      const row = kvGet.get(g, key);
      return row ? JSON.parse(row.value) : fallback;
    },
    set: (g, key, value) => kvSet.run(g, key, JSON.stringify(value)),

    createParty: (p) => partyInsert.run({ ...p, members: JSON.stringify(p.members) }),
    getParty: (id) => parseParty(partyGet.get(id)),
    saveParty: (p) => partyUpdate.run(JSON.stringify(p.members), p.status, p.voice_id || null, p.message_id),
    expiredParties: (before) => partyExpired.all(before).map(parseParty),
    openPartiesByHost: (g, u) => partyOpenByHost.all(g, u).map(parseParty),

    addTempVoice: (id, g) => db.prepare('INSERT OR IGNORE INTO temp_voice VALUES (?, ?, ?)').run(id, g, Date.now()),
    isTempVoice: (id) => !!db.prepare('SELECT 1 FROM temp_voice WHERE channel_id = ?').get(id),
    removeTempVoice: (id) => db.prepare('DELETE FROM temp_voice WHERE channel_id = ?').run(id),
    allTempVoice: () => db.prepare('SELECT * FROM temp_voice').all(),
  };
}

module.exports = { open };
