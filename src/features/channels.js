const { LAYOUT } = require('../config');

/** Dapatkan channel ikut `key` dalam LAYOUT (ID disimpan semasa /setup, fallback cari ikut nama). */
async function getChannel(guild, db, key) {
  const ids = db.get(guild.id, 'channels', {});
  if (ids[key]) {
    const ch = guild.channels.cache.get(ids[key]) || (await guild.channels.fetch(ids[key]).catch(() => null));
    if (ch) return ch;
  }
  for (const group of LAYOUT) {
    if (group.key === key) return guild.channels.cache.find((c) => c.type === 4 && c.name === group.category) || null;
    const def = group.channels.find((c) => c.key === key);
    if (def) return guild.channels.cache.find((c) => c.name === def.name) || null;
  }
  return null;
}

/** Hantar mesej baru atau edit mesej lama yang disimpan di kv (supaya /setup boleh diulang tanpa spam). */
async function upsertMessage(channel, db, kvKey, payload) {
  const msgId = db.get(channel.guild.id, kvKey);
  if (msgId) {
    const old = await channel.messages.fetch(msgId).catch(() => null);
    if (old) return old.edit(payload);
  }
  const msg = await channel.send(payload);
  db.set(channel.guild.id, kvKey, msg.id);
  return msg;
}

module.exports = { getChannel, upsertMessage };
