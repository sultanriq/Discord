const { ChannelType, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const { LAYOUT, RANKS, LANES, ROLES, PARTY } = require('../config');
const { upsertMessage } = require('./channels');
const { rolePickerPayload, findRole } = require('./roles');
const { postSchedule } = require('./weekly');
const { updateLiveLeaderboard } = require('./activity');

const RULES = [
  '**1. Hormat semua ahli.** Tiada carutan melampau, perkauman, agama, atau serangan peribadi.',
  '**2. Toxic dalam game = toxic dalam server.** Jangan flame teammate yang anda jumpa melalui server ni.',
  '**3. Guna channel ikut fungsi.** Cari party di #cari-party guna `/party`, borak di #borak-umum.',
  '**4. Jangan AFK / troll / feed sengaja** dalam party yang dibentuk di sini. Laporan berulang = kick.',
  '**5. Tiada jual-beli akaun, joki, cheat, map hack** atau aplikasi pihak ketiga.',
  '**6. Tiada spam / iklan / link server lain** tanpa kebenaran admin.',
  '**7. Spam mesej untuk naik leaderboard** tidak dikira (ada cooldown) dan boleh menyebabkan mata dibatalkan.',
  '**8. Ikut Terma Discord & Moonton.**',
  '',
  'Ada masalah? Tag mana-mana **Admin/Moderator**. Selamat bermain! 🎮',
];

function rulesEmbed() {
  return new EmbedBuilder().setColor(0xe74c3c).setTitle('📜 Peraturan Server').setDescription(RULES.join('\n'));
}

function partyGuideEmbed() {
  return new EmbedBuilder()
    .setColor(0x2ecc71)
    .setTitle('📋 Cara Cari Party Ranked')
    .setDescription([
      '**1.** Set rank & lane anda di #pilih-role.',
      '**2.** Taip `/party` di #cari-party dan pilih:',
      '　• `mode` — Ranked / Classic / Brawl / Custom / Mabar Santai',
      '　• `pemain` — saiz party (2–5, termasuk anda)',
      '　• `rank` — rank party (default: rank role anda)',
      '　• `lane1`, `lane2` — lane yang anda perlukan',
      '　• `nota` — cth. "Nak push Mythic, ada mic"',
      '**3.** Orang tekan **✅ Join**. Bila penuh, bot buat **voice sementara** & ping semua.',
      '**4.** Voice sementara dipadam automatik bila kosong.',
      '',
      `⏱️ Lobby tutup sendiri selepas **${PARTY.expireMinutes} minit**. Satu orang satu lobby.`,
      `🔔 Nak dapat ping bila ada lobby baru? Ambil role \`${ROLES.partyPing}\`.`,
      '',
      '**Etika party:** jangan join kalau tak boleh main sekarang, beritahu kalau nak keluar, dan jangan salahkan teammate 🙏',
    ].join('\n'));
}

async function ensureRole(guild, name, opts = {}) {
  return findRole(guild, name) || guild.roles.create({ name, mentionable: false, ...opts, reason: 'Setup bot MLBB' });
}

async function runSetup(guild, db, log = () => {}) {
  const me = guild.members.me;
  await guild.roles.fetch();
  await guild.channels.fetch();

  // 1. Roles
  for (const r of [...RANKS].reverse()) await ensureRole(guild, r.name, { color: r.color, hoist: false, mentionable: true });
  for (const l of LANES) await ensureRole(guild, l.name);
  await ensureRole(guild, ROLES.topActive, { color: 0xffd700, hoist: true });
  await ensureRole(guild, ROLES.eventPing, { mentionable: true });
  await ensureRole(guild, ROLES.partyPing, { mentionable: true });
  log('✅ Role rank, lane & notifikasi');

  // 2. Kategori & channel
  const ids = db.get(guild.id, 'channels', {});
  const everyone = guild.roles.everyone;
  for (const group of LAYOUT) {
    let cat = guild.channels.cache.find((c) => c.type === ChannelType.GuildCategory && c.name === group.category);
    if (!cat) cat = await guild.channels.create({ name: group.category, type: ChannelType.GuildCategory });
    if (group.key) ids[group.key] = cat.id;

    for (const def of group.channels) {
      const type = def.voice ? ChannelType.GuildVoice : ChannelType.GuildText;
      let ch = guild.channels.cache.find((c) => c.type === type && c.name === def.name);
      const overwrites = def.readOnly || def.key === 'party'
        ? [
          { id: everyone.id, deny: [PermissionFlagsBits.SendMessages, PermissionFlagsBits.CreatePublicThreads], allow: [PermissionFlagsBits.UseApplicationCommands] },
          { id: me.id, allow: [PermissionFlagsBits.SendMessages, PermissionFlagsBits.EmbedLinks, PermissionFlagsBits.ManageMessages, PermissionFlagsBits.CreatePublicThreads, PermissionFlagsBits.SendPolls] },
        ]
        : undefined;
      if (!ch) {
        ch = await guild.channels.create({
          name: def.name, type, parent: cat.id, topic: def.topic, userLimit: def.userLimit, permissionOverwrites: overwrites,
        });
      } else if (overwrites) {
        await ch.permissionOverwrites.set(overwrites).catch(() => {});
      }
      // Topik harian: ahli boleh balas dalam thread tapi tidak post mesej baru
      if (def.key === 'dailyTopic') {
        await ch.permissionOverwrites.edit(everyone, { SendMessages: false, SendMessagesInThreads: true, CreatePublicThreads: false }).catch(() => {});
        await ch.permissionOverwrites.edit(me, { SendMessages: true, CreatePublicThreads: true, ManageThreads: true }).catch(() => {});
      }
      ids[def.key] = ch.id;
    }
  }
  db.set(guild.id, 'channels', ids);
  if (ids.voiceAfk) await guild.setAFKChannel(ids.voiceAfk).catch(() => {});
  log('✅ Kategori & channel');

  // 3. Kandungan tetap
  const ch = (k) => guild.channels.cache.get(ids[k]);
  await upsertMessage(ch('rules'), db, 'msg:rules', { embeds: [rulesEmbed()] });
  await upsertMessage(ch('roles'), db, 'msg:roles', rolePickerPayload());
  await upsertMessage(ch('partyGuide'), db, 'msg:partyGuide', { embeds: [partyGuideEmbed()] });
  await postSchedule(guild, db);
  await updateLiveLeaderboard(guild, db);
  log('✅ Peraturan, pemilih role, panduan party, jadual mingguan, leaderboard');

  return ids;
}

module.exports = { runSetup };
