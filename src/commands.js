const { SlashCommandBuilder, PermissionFlagsBits, MessageFlags, EmbedBuilder } = require('discord.js');
const { RANKS, LANES, MODES } = require('./config');
const WEEKLY = require('./data/weekly');
const { monthKey, monthLabel } = require('./utils');
const { handlePartyCommand } = require('./features/party');
const { leaderboardEmbed, updateLiveLeaderboard, monthlyAward } = require('./features/activity');
const { postDailyTopic } = require('./features/daily');
const { scheduleEmbed, runEvent, drawCustomTeams, awardCustom } = require('./features/weekly');
const { runSetup } = require('./features/setup');

const laneChoices = LANES.map((l) => ({ name: `${l.emoji} ${l.name}`, value: l.key }));
const admin = PermissionFlagsBits.ManageGuild;

const definitions = [
  new SlashCommandBuilder()
    .setName('party')
    .setDescription('Buka lobby cari party MLBB')
    .addStringOption((o) => o.setName('mode').setDescription('Mode permainan').setRequired(true)
      .addChoices(...MODES.map((m) => ({ name: m, value: m }))))
    .addIntegerOption((o) => o.setName('pemain').setDescription('Saiz party termasuk anda (default 5)').setMinValue(2).setMaxValue(5))
    .addStringOption((o) => o.setName('rank').setDescription('Rank party (default: rank role anda)')
      .addChoices(...RANKS.map((r) => ({ name: `${r.emoji} ${r.name}`, value: r.key }))))
    .addStringOption((o) => o.setName('lane1').setDescription('Lane yang diperlukan').addChoices(...laneChoices))
    .addStringOption((o) => o.setName('lane2').setDescription('Lane kedua yang diperlukan').addChoices(...laneChoices))
    .addStringOption((o) => o.setName('nota').setDescription('Cth: "Push Mythic, ada mic"').setMaxLength(200)),

  new SlashCommandBuilder()
    .setName('top')
    .setDescription('Top 10 ahli paling aktif bulan ini')
    .addStringOption((o) => o.setName('bulan').setDescription('Format YYYY-MM, cth 2026-10 (default bulan ini)')),

  new SlashCommandBuilder()
    .setName('profil')
    .setDescription('Statistik aktif & kedudukan anda bulan ini')
    .addUserOption((o) => o.setName('ahli').setDescription('Tengok profil ahli lain')),

  new SlashCommandBuilder()
    .setName('aktiviti')
    .setDescription('Tengok jadual aktiviti mingguan'),

  // ---- Admin ----
  new SlashCommandBuilder()
    .setName('setup')
    .setDescription('[Admin] Bina struktur server: role, channel, peraturan, pemilih role, jadual')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  new SlashCommandBuilder()
    .setName('topik')
    .setDescription('[Admin] Hantar topik harian sekarang')
    .setDefaultMemberPermissions(admin),

  new SlashCommandBuilder()
    .setName('jalan-aktiviti')
    .setDescription('[Admin] Jalankan aktiviti mingguan sekarang')
    .setDefaultMemberPermissions(admin)
    .addStringOption((o) => o.setName('aktiviti').setDescription('Aktiviti').setRequired(true)
      .addChoices(
        ...WEEKLY.schedule.map((e) => ({ name: `${e.day} — ${e.title}`, value: e.id })),
        { name: 'Kocok pasukan custom match sekarang', value: 'custom-draw' },
        { name: 'Umum Top 10 bulan lepas & beri role', value: 'monthly-award' },
      )),

  new SlashCommandBuilder()
    .setName('bonus')
    .setDescription('[Admin] Beri / tolak mata aktif (misi, showcase, dll)')
    .setDefaultMemberPermissions(admin)
    .addUserOption((o) => o.setName('ahli').setDescription('Ahli').setRequired(true))
    .addIntegerOption((o) => o.setName('mata').setDescription('Jumlah mata (negatif untuk tolak)').setRequired(true).setMinValue(-1000).setMaxValue(1000))
    .addStringOption((o) => o.setName('sebab').setDescription('Sebab, cth "Siap misi mingguan"')),

  new SlashCommandBuilder()
    .setName('custom-menang')
    .setDescription('[Admin] Rekod pasukan pemenang custom match minggu ini')
    .setDefaultMemberPermissions(admin)
    .addStringOption((o) => o.setName('pasukan').setDescription('Pasukan menang').setRequired(true)
      .addChoices({ name: '🔵 Team A', value: 'A' }, { name: '🔴 Team B', value: 'B' })),
];

const handlers = {
  party: (i, db) => handlePartyCommand(i, db),

  top: async (i, db) => {
    const m = i.options.getString('bulan') || monthKey();
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(m)) return i.reply({ content: 'Format bulan salah. Guna YYYY-MM, cth `2026-10`.', flags: MessageFlags.Ephemeral });
    return i.reply({ embeds: [leaderboardEmbed(i.guild, db, m)], allowedMentions: { users: [] } });
  },

  profil: async (i, db) => {
    const user = i.options.getUser('ahli') || i.user;
    const month = monthKey();
    const s = db.userStats(i.guild.id, user.id, month);
    const points = s ? s.points : 0;
    const pos = s && points > 0 ? db.rankOf(i.guild.id, month, points) : null;
    const tenth = db.top(i.guild.id, month, 10)[9];
    const embed = new EmbedBuilder()
      .setColor(0x5865f2)
      .setAuthor({ name: user.username, iconURL: user.displayAvatarURL() })
      .setTitle(`📈 Profil Aktif — ${monthLabel(month)}`)
      .addFields(
        { name: 'Kedudukan', value: pos ? `#${pos}` : '-', inline: true },
        { name: 'Mata', value: String(points), inline: true },
        { name: '​', value: '​', inline: true },
        { name: '💬 Mesej dikira', value: String(s?.messages || 0), inline: true },
        { name: '🔊 Voice', value: `${Math.floor((s?.voice_minutes || 0) / 60)}j ${(s?.voice_minutes || 0) % 60}m`, inline: true },
        { name: '🎁 Bonus', value: String(s?.bonus || 0), inline: true },
      )
      .setFooter({
        text: pos && pos <= 10 ? 'Anda dalam Top 10! Kekalkan 🔥'
          : tenth ? `Perlu ${Math.max(tenth.points - points + 1, 1)} mata lagi untuk masuk Top 10`
            : 'Top 10 masih terbuka — jom aktif!',
      });
    return i.reply({ embeds: [embed], flags: user.id === i.user.id ? MessageFlags.Ephemeral : undefined });
  },

  aktiviti: (i) => i.reply({ embeds: [scheduleEmbed()], flags: MessageFlags.Ephemeral }),

  setup: async (i, db) => {
    await i.deferReply({ flags: MessageFlags.Ephemeral });
    const steps = [];
    try {
      await runSetup(i.guild, db, (s) => { steps.push(s); i.editReply(`⏳ Sedang setup...\n${steps.join('\n')}`).catch(() => {}); });
      return i.editReply(`🎉 **Setup siap!**\n${steps.join('\n')}\n\n` +
        '⚠️ Pastikan role bot berada **paling atas** dalam Server Settings → Roles supaya bot boleh beri role.');
    } catch (e) {
      console.error(e);
      return i.editReply(`❌ Setup gagal: \`${e.message}\`\nPastikan bot ada permission **Administrator** (atau Manage Roles + Manage Channels).\n${steps.join('\n')}`);
    }
  },

  topik: async (i, db) => {
    const msg = await postDailyTopic(i.guild, db);
    return i.reply({ content: msg ? `✅ Topik dihantar: ${msg.url}` : '❌ Channel topik harian tak jumpa. Jalankan `/setup` dulu.', flags: MessageFlags.Ephemeral });
  },

  'jalan-aktiviti': async (i, db) => {
    const id = i.options.getString('aktiviti');
    await i.deferReply({ flags: MessageFlags.Ephemeral });
    if (id === 'custom-draw') await drawCustomTeams(i.guild, db);
    else if (id === 'monthly-award') { db.set(i.guild.id, 'lastAwardedMonth', null); await monthlyAward(i.guild, db); }
    else await runEvent(i.guild, db, id);
    return i.editReply('✅ Selesai.');
  },

  bonus: async (i, db) => {
    const user = i.options.getUser('ahli');
    const pts = i.options.getInteger('mata');
    const reason = i.options.getString('sebab') || 'Aktiviti komuniti';
    db.addBonus(i.guild.id, user.id, monthKey(), pts);
    await updateLiveLeaderboard(i.guild, db).catch(() => {});
    return i.reply({ content: `🎁 ${user} ${pts >= 0 ? 'dapat' : 'ditolak'} **${Math.abs(pts)} mata** — ${reason}`, allowedMentions: { users: [user.id] } });
  },

  'custom-menang': async (i, db) => {
    const msg = await awardCustom(i.guild, db, i.options.getString('pasukan'));
    return i.reply({ content: msg });
  },
};

module.exports = { definitions, handlers };
