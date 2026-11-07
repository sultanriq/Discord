const { EmbedBuilder, ChannelType } = require('discord.js');
const { ACTIVITY, ROLES } = require('../config');
const { monthKey, monthLabel, medal } = require('../utils');
const { getChannel, upsertMessage } = require('./channels');
const { findRole } = require('./roles');

const lastCounted = new Map(); // `${guild}:${user}` -> timestamp

function onMessage(message, db) {
  if (message.author.bot || !message.guild) return;
  const text = message.content.trim();
  if (text.length < ACTIVITY.minMessageLength && message.attachments.size === 0) return;
  const k = `${message.guild.id}:${message.author.id}`;
  const now = Date.now();
  if (now - (lastCounted.get(k) || 0) < ACTIVITY.messageCooldownSec * 1000) return;
  lastCounted.set(k, now);
  db.addMessage(message.guild.id, message.author.id, monthKey());
}

/** Setiap tick: ahli dalam voice (bukan AFK, bukan seorang diri, tak deafen) dapat minit voice. */
function voiceTick(client, db) {
  const month = monthKey();
  for (const guild of client.guilds.cache.values()) {
    for (const ch of guild.channels.cache.values()) {
      if (ch.type !== ChannelType.GuildVoice && ch.type !== ChannelType.GuildStageVoice) continue;
      if (ch.id === guild.afkChannelId) continue;
      const humans = ch.members.filter((m) => !m.user.bot);
      if (humans.size < 2) continue;
      for (const m of humans.values()) {
        if (m.voice.selfDeaf || m.voice.serverDeaf) continue;
        db.addVoice(guild.id, m.id, month, ACTIVITY.voiceTickMinutes);
      }
    }
  }
}

function leaderboardEmbed(guild, db, month = monthKey(), { final = false } = {}) {
  const rows = db.top(guild.id, month, 10);
  const lines = rows.length
    ? rows.map((r, i) =>
      `${medal(i)} <@${r.user_id}> — **${r.points} mata**\n` +
      `　💬 ${r.messages} · 🔊 ${Math.floor(r.voice_minutes / 60)}j ${r.voice_minutes % 60}m${r.bonus ? ` · 🎁 ${r.bonus}` : ''}`,
    )
    : ['Belum ada aktiviti bulan ini. Jom borak! 💬'];

  return new EmbedBuilder()
    .setColor(final ? 0xffd700 : 0x5865f2)
    .setTitle(`${final ? '🏆 KEPUTUSAN AKHIR' : '📊'} Top 10 Ahli Aktif — ${monthLabel(month)}`)
    .setDescription(lines.join('\n'))
    .addFields({
      name: 'Cara kira mata',
      value: `💬 1 mesej = 1 mata (sekali setiap ${ACTIVITY.messageCooldownSec}s) · 🔊 ${ACTIVITY.voiceMinutesPerPoint} minit voice bersama = 1 mata · 🎁 bonus aktiviti mingguan`,
    })
    .setFooter({ text: final ? `Top 10 dapat role "${ROLES.topActive}" sebulan!` : 'Dikemas kini setiap jam · /profil untuk tengok kedudukan anda' })
    .setTimestamp();
}

async function updateLiveLeaderboard(guild, db) {
  const ch = await getChannel(guild, db, 'leaderboard');
  if (!ch) return;
  await upsertMessage(ch, db, 'msg:leaderboard', { embeds: [leaderboardEmbed(guild, db)] });
}

/** Dijalankan 1hb setiap bulan: umum pemenang bulan lepas & beri role. */
async function monthlyAward(guild, db) {
  const prev = monthKey(new Date(), -1);
  if (db.get(guild.id, 'lastAwardedMonth') === prev) return;
  const rows = db.top(guild.id, prev, 10);
  if (!rows.length) { db.set(guild.id, 'lastAwardedMonth', prev); return; } // tiada data (cth. bot baru dipasang)
  const embed = leaderboardEmbed(guild, db, prev, { final: true });

  const role = findRole(guild, ROLES.topActive);
  if (role) {
    // buang role daripada pemenang bulan sebelumnya, beri kepada Top 10 baru
    for (const uid of db.get(guild.id, 'topActive:holders', [])) {
      const m = await guild.members.fetch(uid).catch(() => null);
      if (m) await m.roles.remove(role).catch(() => {});
    }
    for (const r of rows) {
      const m = await guild.members.fetch(r.user_id).catch(() => null);
      if (m) await m.roles.add(role).catch(() => {});
    }
    db.set(guild.id, 'topActive:holders', rows.map((r) => r.user_id));
  }

  const lb = await getChannel(guild, db, 'leaderboard');
  const ann = await getChannel(guild, db, 'announcements');
  if (lb) await lb.send({ embeds: [embed] });
  if (ann) {
    await ann.send({
      content: `🎉 Tahniah kepada **Top 10 Ahli Aktif ${monthLabel(prev)}**! ${rows.map((r) => `<@${r.user_id}>`).join(' ')}\nMata bulan baru bermula dari kosong — jom rebut tempat! 💪`,
      embeds: [embed],
      allowedMentions: { users: rows.map((r) => r.user_id) },
    });
  }
  db.set(guild.id, 'lastAwardedMonth', prev);
  db.set(guild.id, 'msg:leaderboard', null); // mula mesej live baru untuk bulan baru
  await updateLiveLeaderboard(guild, db);
}

module.exports = { onMessage, voiceTick, leaderboardEmbed, updateLiveLeaderboard, monthlyAward };
