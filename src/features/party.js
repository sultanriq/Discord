const {
  ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, ChannelType, PermissionFlagsBits, MessageFlags,
} = require('discord.js');
const { RANKS, LANES, ROLES, PARTY } = require('../config');
const { getChannel } = require('./channels');
const { findRole, memberRank } = require('./roles');

const STATUS = {
  open: { color: 0x2ecc71, label: '🟢 Buka' },
  full: { color: 0xf1c40f, label: '🟡 Penuh — selamat bertempur!' },
  closed: { color: 0x95a5a6, label: '⚫ Ditutup' },
};

function partyEmbed(p) {
  const rank = RANKS.find((r) => r.key === p.rank);
  const lanes = p.lanes ? p.lanes.split(',').map((k) => LANES.find((l) => l.key === k)).filter(Boolean) : [];
  const slotsLine = Array.from({ length: p.slots }, (_, i) =>
    p.members[i] ? `\`${i + 1}\` <@${p.members[i]}>${i === 0 ? ' 👑' : ''}` : `\`${i + 1}\` ➖ *kosong*`,
  ).join('\n');

  const e = new EmbedBuilder()
    .setColor(STATUS[p.status].color)
    .setTitle(`🎮 ${p.mode}${rank ? ` • ${rank.emoji} ${rank.name}` : ''} — ${p.members.length}/${p.slots}`)
    .addFields(
      { name: 'Pemain', value: slotsLine, inline: true },
      { name: 'Lane diperlukan', value: lanes.length ? lanes.map((l) => `${l.emoji} ${l.name}`).join('\n') : 'Mana-mana', inline: true },
    )
    .setFooter({ text: `${STATUS[p.status].label} • Tutup automatik selepas ${PARTY.expireMinutes} minit` })
    .setTimestamp(p.created_at);
  if (p.note) e.setDescription(`📝 ${p.note}`);
  if (p.voice_id) e.addFields({ name: 'Voice', value: `<#${p.voice_id}>` });
  return e;
}

function partyButtons(p) {
  const done = p.status === 'closed';
  return [
    new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('party:join').setLabel('Join').setEmoji('✅').setStyle(ButtonStyle.Success)
        .setDisabled(done || p.status === 'full'),
      new ButtonBuilder().setCustomId('party:leave').setLabel('Keluar').setEmoji('🚪').setStyle(ButtonStyle.Secondary).setDisabled(done),
      new ButtonBuilder().setCustomId('party:voice').setLabel('Buat Voice').setEmoji('🔊').setStyle(ButtonStyle.Primary)
        .setDisabled(done || !!p.voice_id),
      new ButtonBuilder().setCustomId('party:close').setLabel('Tutup').setEmoji('🔒').setStyle(ButtonStyle.Danger).setDisabled(done),
    ),
  ];
}

const render = (p) => ({ embeds: [partyEmbed(p)], components: partyButtons(p) });

async function createPartyVoice(guild, db, p) {
  const category = await getChannel(guild, db, 'partyVoiceCategory');
  const host = await guild.members.fetch(p.host_id).catch(() => null);
  const ch = await guild.channels.create({
    name: `🎮 ${p.mode} • ${host ? host.displayName : 'Party'}`.slice(0, 95),
    type: ChannelType.GuildVoice,
    parent: category?.id,
    userLimit: Math.max(p.slots, 2),
  });
  db.addTempVoice(ch.id, guild.id);
  return ch;
}

/** /party */
async function handlePartyCommand(interaction, db) {
  const { guild, member } = interaction;
  const partyChannel = await getChannel(guild, db, 'party');
  const target = partyChannel || interaction.channel;

  // Tutup lobby lama host ini (seorang satu lobby)
  for (const old of db.openPartiesByHost(guild.id, member.id)) await closeParty(interaction.client, db, old);

  const rankKey = interaction.options.getString('rank') || memberRank(member)?.key || null;
  const lanes = ['lane1', 'lane2']
    .map((n) => interaction.options.getString(n))
    .filter((v, i, a) => v && a.indexOf(v) === i);

  const p = {
    guild_id: guild.id,
    channel_id: target.id,
    host_id: member.id,
    mode: interaction.options.getString('mode'),
    rank: rankKey,
    slots: interaction.options.getInteger('pemain') || 5,
    lanes: lanes.join(',') || null,
    note: interaction.options.getString('nota')?.slice(0, 200) || null,
    members: [member.id],
    status: 'open',
    voice_id: null,
    created_at: Date.now(),
  };

  const pingRole = findRole(guild, ROLES.partyPing);
  const rank = RANKS.find((r) => r.key === rankKey);
  const rankRole = rank ? findRole(guild, rank.name) : null;
  const mentions = [pingRole, rankRole].filter(Boolean);

  const msg = await target.send({
    content: `${mentions.map((r) => `<@&${r.id}>`).join(' ')} **${member.displayName}** cari ${p.slots - 1} lagi untuk **${p.mode}**!`.trim(),
    allowedMentions: { roles: mentions.map((r) => r.id) },
    ...render(p),
  });
  p.message_id = msg.id;
  db.createParty(p);

  return interaction.reply({
    content: `✅ Lobby dibuka di ${target}! ${msg.url}`,
    flags: MessageFlags.Ephemeral,
  });
}

async function handlePartyButton(interaction, db) {
  const action = interaction.customId.split(':')[1];
  const p = db.getParty(interaction.message.id);
  const eph = (content) => interaction.reply({ content, flags: MessageFlags.Ephemeral });
  if (!p || p.status === 'closed') return eph('Lobby ini sudah ditutup.');

  const uid = interaction.user.id;
  const isHost = uid === p.host_id;
  const isMod = interaction.member.permissions.has(PermissionFlagsBits.ManageMessages);

  if (action === 'join') {
    if (p.members.includes(uid)) return eph('Anda sudah dalam lobby ini.');
    if (p.members.length >= p.slots) return eph('Lobby sudah penuh 😢');
    p.members.push(uid);
    if (p.members.length >= p.slots) p.status = 'full';
  } else if (action === 'leave') {
    if (!p.members.includes(uid)) return eph('Anda bukan ahli lobby ini.');
    if (isHost) return closeParty(interaction.client, db, p, interaction);
    p.members = p.members.filter((m) => m !== uid);
    p.status = 'open';
  } else if (action === 'voice') {
    if (!p.members.includes(uid)) return eph('Hanya ahli lobby boleh buat voice.');
    if (!p.voice_id) {
      const ch = await createPartyVoice(interaction.guild, db, p);
      p.voice_id = ch.id;
    }
  } else if (action === 'close') {
    if (!isHost && !isMod) return eph('Hanya host atau moderator boleh tutup lobby.');
    return closeParty(interaction.client, db, p, interaction);
  }

  // Bila penuh: buat voice automatik & ping semua ahli
  let justFilled = false;
  if (p.status === 'full' && action === 'join') {
    justFilled = true;
    if (!p.voice_id) {
      const ch = await createPartyVoice(interaction.guild, db, p).catch(() => null);
      if (ch) p.voice_id = ch.id;
    }
  }

  db.saveParty(p);
  await interaction.update(render(p));
  if (justFilled) {
    await interaction.message.reply({
      content: `🔥 Party penuh! ${p.members.map((m) => `<@${m}>`).join(' ')}${p.voice_id ? ` — masuk <#${p.voice_id}>` : ''}. GLHF!`,
      allowedMentions: { users: p.members },
    }).catch(() => {});
  }
}

async function closeParty(client, db, p, interaction = null) {
  p.status = 'closed';
  db.saveParty(p);
  if (interaction) return interaction.update(render(p));
  const ch = await client.channels.fetch(p.channel_id).catch(() => null);
  const msg = ch && (await ch.messages.fetch(p.message_id).catch(() => null));
  if (msg) await msg.edit(render(p)).catch(() => {});
}

/** Tutup lobby yang tamat tempoh & padam voice sementara yang kosong. */
async function sweep(client, db) {
  const cutoff = Date.now() - PARTY.expireMinutes * 60 * 1000;
  for (const p of db.expiredParties(cutoff)) await closeParty(client, db, p);

  for (const t of db.allTempVoice()) {
    const ch = await client.channels.fetch(t.channel_id).catch(() => null);
    if (!ch) { db.removeTempVoice(t.channel_id); continue; }
    // beri 10 minit selepas dicipta untuk orang masuk
    if (ch.members.size === 0 && Date.now() - t.created_at > 10 * 60 * 1000) {
      await ch.delete('Voice party kosong').catch(() => {});
      db.removeTempVoice(t.channel_id);
    }
  }
}

/** Padam voice sementara sebaik sahaja orang terakhir keluar. */
async function onVoiceLeave(oldState, db) {
  const ch = oldState.channel;
  if (ch && ch.members.size === 0 && db.isTempVoice(ch.id)) {
    await ch.delete('Voice party kosong').catch(() => {});
    db.removeTempVoice(ch.id);
  }
}

module.exports = { handlePartyCommand, handlePartyButton, sweep, onVoiceLeave, partyEmbed };
