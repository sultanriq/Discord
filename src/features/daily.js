const { EmbedBuilder, ThreadAutoArchiveDuration } = require('discord.js');
const TOPICS = require('../data/topics');
const { shuffle, dayOfYear } = require('../utils');
const { getChannel } = require('./channels');

/** Ambil topik seterusnya — pusing tanpa ulang sehingga semua topik habis. */
function nextTopic(db, guildId) {
  let order = db.get(guildId, 'topic:order', []);
  let pos = db.get(guildId, 'topic:pos', 0);
  if (order.length !== TOPICS.length || pos >= order.length) {
    order = shuffle(TOPICS.map((_, i) => i));
    pos = 0;
  }
  const topic = TOPICS[order[pos]];
  db.set(guildId, 'topic:order', order);
  db.set(guildId, 'topic:pos', pos + 1);
  return { topic, number: db.get(guildId, 'topic:count', 0) + 1 };
}

async function postDailyTopic(guild, db) {
  const ch = await getChannel(guild, db, 'dailyTopic');
  if (!ch) return null;
  const { topic, number } = nextTopic(db, guild.id);
  db.set(guild.id, 'topic:count', number);

  const date = new Intl.DateTimeFormat('ms-MY', {
    timeZone: require('../config').TIMEZONE, weekday: 'long', day: 'numeric', month: 'long',
  }).format(new Date());

  const embed = new EmbedBuilder()
    .setColor([0xe91e63, 0x3498db, 0x2ecc71, 0xf39c12, 0x9b59b6][dayOfYear() % 5])
    .setAuthor({ name: `🗣️ Topik Harian #${number} • ${date}` })
    .setTitle(topic)
    .setDescription('Jawab dalam **thread** di bawah 👇\nSetiap balasan dikira untuk **Top 10 Aktif Bulanan** 🏆');

  const msg = await ch.send({ embeds: [embed] });
  await msg.startThread({
    name: `💬 Topik #${number}`,
    autoArchiveDuration: ThreadAutoArchiveDuration.OneDay,
  }).catch(() => {});
  return msg;
}

module.exports = { postDailyTopic, nextTopic };
