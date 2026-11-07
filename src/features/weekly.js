const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags } = require('discord.js');
const WEEKLY = require('../data/weekly');
const { ROLES, CUSTOM_MATCH_SIZE } = require('../config');
const { weekOfYear, shuffle, monthKey } = require('../utils');
const { getChannel, upsertMessage } = require('./channels');
const { findRole } = require('./roles');

function scheduleEmbed() {
  return new EmbedBuilder()
    .setColor(0xff9800)
    .setTitle('📅 Jadual Aktiviti Mingguan')
    .setDescription(
      WEEKLY.schedule.map((e) => `**${e.day} • ${e.time}**\n${e.title}\n${e.desc}`).join('\n\n') +
      `\n\n🔔 Ambil role \`${ROLES.eventPing}\` di #pilih-role untuk dapat notifikasi.\n🗣️ Topik harian baru setiap hari di #topik-harian.`,
    );
}

async function postSchedule(guild, db) {
  const ch = await getChannel(guild, db, 'weekly');
  if (ch) await upsertMessage(ch, db, 'msg:schedule', { embeds: [scheduleEmbed()] });
}

function pingContent(guild) {
  const role = findRole(guild, ROLES.eventPing);
  return role ? { content: `<@&${role.id}>`, allowedMentions: { roles: [role.id] } } : {};
}

// ---------- Custom match 5v5 ----------
function customEmbed(state) {
  const list = state.signups.length
    ? state.signups.map((u, i) => `\`${String(i + 1).padStart(2, '0')}\` <@${u}>${i >= CUSTOM_MATCH_SIZE ? ' *(simpanan)*' : ''}`).join('\n')
    : '*Belum ada pendaftar — jadilah yang pertama!*';
  const e = new EmbedBuilder()
    .setColor(0x9c27b0)
    .setTitle(`🏟️ Custom Match 5v5 Komuniti — ${Math.min(state.signups.length, CUSTOM_MATCH_SIZE)}/${CUSTOM_MATCH_SIZE}`)
    .setDescription(WEEKLY.schedule.find((s) => s.id === 'custom').desc)
    .addFields({ name: 'Pendaftar', value: list.slice(0, 1024) });
  if (state.teams) {
    e.addFields(
      { name: '🔵 Team A', value: state.teams.A.map((u) => `<@${u}>`).join('\n') || '-', inline: true },
      { name: '🔴 Team B', value: state.teams.B.map((u) => `<@${u}>`).join('\n') || '-', inline: true },
    );
  }
  if (state.winner) e.addFields({ name: '🏆 Pemenang', value: `Team ${state.winner}` });
  return e;
}

function customButtons(state) {
  const locked = !!state.teams;
  return [new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('custom:join').setLabel('Daftar').setEmoji('✋').setStyle(ButtonStyle.Success).setDisabled(locked),
    new ButtonBuilder().setCustomId('custom:leave').setLabel('Tarik diri').setStyle(ButtonStyle.Secondary).setDisabled(locked),
  )];
}

async function refreshCustom(guild, db, state) {
  const ch = await guild.channels.fetch(state.channelId).catch(() => null);
  const msg = ch && (await ch.messages.fetch(state.messageId).catch(() => null));
  if (msg) await msg.edit({ embeds: [customEmbed(state)], components: customButtons(state) });
}

async function handleCustomButton(interaction, db) {
  const state = db.get(interaction.guild.id, 'custom:current');
  const eph = (content) => interaction.reply({ content, flags: MessageFlags.Ephemeral });
  if (!state || state.messageId !== interaction.message.id) return eph('Pendaftaran ini sudah tamat.');
  if (state.teams) return eph('Pasukan sudah dikocok — pendaftaran ditutup.');
  const uid = interaction.user.id;
  if (interaction.customId === 'custom:join') {
    if (state.signups.includes(uid)) return eph('Anda sudah berdaftar ✅');
    state.signups.push(uid);
  } else {
    if (!state.signups.includes(uid)) return eph('Anda belum berdaftar.');
    state.signups = state.signups.filter((u) => u !== uid);
  }
  db.set(interaction.guild.id, 'custom:current', state);
  return interaction.update({ embeds: [customEmbed(state)], components: customButtons(state) });
}

async function drawCustomTeams(guild, db) {
  const state = db.get(guild.id, 'custom:current');
  if (!state || state.teams) return;
  const ch = await guild.channels.fetch(state.channelId).catch(() => null);
  if (state.signups.length < 2) {
    if (ch) await ch.send('😢 Custom match minggu ni dibatalkan — tak cukup pemain. Jumpa minggu depan!');
    return;
  }
  const players = shuffle(state.signups.slice(0, CUSTOM_MATCH_SIZE));
  const half = Math.ceil(players.length / 2);
  state.teams = { A: players.slice(0, half), B: players.slice(half) };
  db.set(guild.id, 'custom:current', state);
  await refreshCustom(guild, db, state);
  if (ch) {
    await ch.send({
      content: `⚔️ Pasukan sudah dikocok! ${players.map((u) => `<@${u}>`).join(' ')}\n` +
        `🔵 **Team A:** ${state.teams.A.map((u) => `<@${u}>`).join(', ')}\n🔴 **Team B:** ${state.teams.B.map((u) => `<@${u}>`).join(', ')}\n` +
        'Masuk voice **🏟️ Custom 5v5**. Host bilik: pemain pertama Team A. Admin guna `/custom-menang` lepas habis.',
      allowedMentions: { users: players },
    });
  }
}

async function awardCustom(guild, db, team) {
  const state = db.get(guild.id, 'custom:current');
  if (!state || !state.teams) return 'Tiada custom match yang aktif / pasukan belum dikocok.';
  if (state.winner) return `Keputusan sudah direkod (Team ${state.winner}).`;
  const month = monthKey();
  for (const u of [...state.teams.A, ...state.teams.B]) db.addBonus(guild.id, u, month, 5);
  for (const u of state.teams[team]) db.addBonus(guild.id, u, month, 10); // jumlah 15 untuk pemenang
  state.winner = team;
  db.set(guild.id, 'custom:current', state);
  await refreshCustom(guild, db, state);
  return `🏆 Team ${team} menang! Pemenang +15 mata, peserta lain +5 mata.`;
}

// ---------- Jalankan aktiviti ----------
async function runEvent(guild, db, id) {
  const ev = WEEKLY.schedule.find((e) => e.id === id);
  if (!ev) return;
  const ch = await getChannel(guild, db, 'weekly');
  if (!ch) return;
  const week = weekOfYear();
  const ping = pingContent(guild);
  const base = new EmbedBuilder().setColor(0xff9800).setTitle(ev.title).setDescription(ev.desc);

  if (ev.type === 'mission') {
    const mission = WEEKLY.missions[week % WEEKLY.missions.length];
    base.addFields({ name: 'Misi minggu ini', value: mission }, { name: 'Tamat', value: 'Ahad 11:59 malam' });
    await ch.send({ ...ping, embeds: [base] });
  } else if (ev.type === 'poll') {
    const poll = WEEKLY.polls[week % WEEKLY.polls.length];
    await ch.send({ ...ping, embeds: [base] });
    await ch.send({
      poll: {
        question: { text: poll.q },
        answers: poll.a.map((text) => ({ text })),
        duration: 48,
        allowMultiselect: false,
      },
    });
  } else if (ev.type === 'mabar') {
    const party = await getChannel(guild, db, 'party');
    const vc = await getChannel(guild, db, 'voiceLobby');
    base.addFields({ name: 'Cara join', value: `1. Buka ${party || '#cari-party'} → \`/party\`\n2. Masuk ${vc || 'voice Lobby'}\n3. Main & dapat mata voice 🔊` });
    await ch.send({ ...ping, embeds: [base] });
  } else if (ev.type === 'custom') {
    const state = { signups: [], teams: null, winner: null, week };
    const msg = await ch.send({ ...ping, embeds: [customEmbed(state)], components: customButtons(state) });
    db.set(guild.id, 'custom:current', { ...state, messageId: msg.id, channelId: ch.id });
  } else if (ev.type === 'showcase') {
    const sv = await getChannel(guild, db, 'savage');
    base.addFields({ name: 'Channel', value: `${sv || '#savage-maniac'}` });
    await ch.send({ ...ping, embeds: [base] });
  }
}

module.exports = { postSchedule, scheduleEmbed, runEvent, handleCustomButton, drawCustomTeams, awardCustom };
