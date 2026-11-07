const { ActionRowBuilder, StringSelectMenuBuilder, EmbedBuilder, MessageFlags } = require('discord.js');
const { RANKS, LANES, ROLES } = require('../config');

const findRole = (guild, name) => guild.roles.cache.find((r) => r.name === name);

function rolePickerPayload() {
  const embed = new EmbedBuilder()
    .setColor(0x5865f2)
    .setTitle('🎭 Pilih Role Anda')
    .setDescription(
      [
        'Pilih **rank semasa** dan **lane** anda supaya orang senang ajak main sekali.',
        '',
        '• **Rank** — pilih satu (tukar bila naik rank 📈)',
        '• **Lane** — boleh pilih lebih dari satu',
        `• **Notifikasi** — \`${ROLES.partyPing}\` untuk ping bila ada lobby baru, \`${ROLES.eventPing}\` untuk aktiviti mingguan`,
      ].join('\n'),
    );

  const rank = new StringSelectMenuBuilder()
    .setCustomId('roles:rank')
    .setPlaceholder('🏅 Pilih rank semasa')
    .setMinValues(0)
    .setMaxValues(1)
    .addOptions(RANKS.map((r) => ({ label: r.name, value: r.key, emoji: r.emoji })));

  const lane = new StringSelectMenuBuilder()
    .setCustomId('roles:lane')
    .setPlaceholder('🗺️ Pilih lane (boleh lebih dari satu)')
    .setMinValues(0)
    .setMaxValues(LANES.length)
    .addOptions(LANES.map((l) => ({ label: l.name, value: l.key, emoji: l.emoji })));

  const ping = new StringSelectMenuBuilder()
    .setCustomId('roles:ping')
    .setPlaceholder('🔔 Notifikasi')
    .setMinValues(0)
    .setMaxValues(2)
    .addOptions([
      { label: 'Ping bila ada lobby party baru', value: 'party', emoji: '🎮' },
      { label: 'Ping aktiviti mingguan', value: 'event', emoji: '📅' },
    ]);

  return {
    embeds: [embed],
    components: [rank, lane, ping].map((m) => new ActionRowBuilder().addComponents(m)),
  };
}

async function handleRoleSelect(interaction) {
  const { guild, member, values } = interaction;
  const kind = interaction.customId.split(':')[1];
  let pool;
  if (kind === 'rank') pool = RANKS.map((r) => ({ key: r.key, name: r.name }));
  else if (kind === 'lane') pool = LANES.map((l) => ({ key: l.key, name: l.name }));
  else pool = [{ key: 'party', name: ROLES.partyPing }, { key: 'event', name: ROLES.eventPing }];

  const add = [];
  const remove = [];
  for (const item of pool) {
    const role = findRole(guild, item.name);
    if (!role) continue;
    const want = values.includes(item.key);
    const has = member.roles.cache.has(role.id);
    if (want && !has) add.push(role);
    if (!want && has) remove.push(role);
  }
  try {
    if (remove.length) await member.roles.remove(remove);
    if (add.length) await member.roles.add(add);
  } catch (e) {
    return interaction.reply({
      content: '❌ Bot tak dapat tukar role. Admin: pastikan role bot berada **di atas** role rank/lane dalam Server Settings → Roles.',
      flags: MessageFlags.Ephemeral,
    });
  }
  const chosen = pool.filter((p) => values.includes(p.key)).map((p) => p.name);
  return interaction.reply({
    content: chosen.length ? `✅ Role dikemas kini: **${chosen.join(', ')}**` : '✅ Role dibuang.',
    flags: MessageFlags.Ephemeral,
  });
}

/** Rank role semasa ahli (untuk default /party). */
function memberRank(member) {
  for (let i = RANKS.length - 1; i >= 0; i--) {
    if (member.roles.cache.some((r) => r.name === RANKS[i].name)) return RANKS[i];
  }
  return null;
}

module.exports = { rolePickerPayload, handleRoleSelect, memberRank, findRole };
