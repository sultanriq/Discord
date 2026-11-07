const { Client, GatewayIntentBits, Events, MessageFlags, ActivityType } = require('discord.js');
const cron = require('node-cron');
const config = require('./config');
const db = require('./db').open();
const { handlers } = require('./commands');
const activity = require('./features/activity');
const party = require('./features/party');
const daily = require('./features/daily');
const weekly = require('./features/weekly');
const { handleRoleSelect } = require('./features/roles');
const WEEKLY = require('./data/weekly');

if (!config.TOKEN) {
  console.error('❌ DISCORD_TOKEN tiada. Salin .env.example ke .env dan isi.');
  process.exit(1);
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent, // perlu ON di Developer Portal (Privileged Gateway Intents)
    GatewayIntentBits.GuildVoiceStates,
  ],
});

/** Jalankan fungsi untuk server utama (GUILD_ID) atau semua server jika tidak ditetapkan. */
async function forGuilds(fn, label) {
  const guilds = config.GUILD_ID ? [client.guilds.cache.get(config.GUILD_ID)].filter(Boolean) : [...client.guilds.cache.values()];
  for (const g of guilds) {
    try { await fn(g); } catch (e) { console.error(`[${label}] ${g.name}:`, e); }
  }
}

function schedule() {
  const tz = { timezone: config.TIMEZONE };

  // Topik harian
  cron.schedule(config.DAILY_TOPIC_CRON, () => forGuilds((g) => daily.postDailyTopic(g, db), 'topik'), tz);

  // Aktiviti mingguan
  for (const ev of WEEKLY.schedule) {
    cron.schedule(ev.cron, () => forGuilds((g) => weekly.runEvent(g, db, ev.id), ev.id), tz);
    if (ev.drawCron) cron.schedule(ev.drawCron, () => forGuilds((g) => weekly.drawCustomTeams(g, db), 'custom-draw'), tz);
  }

  // Leaderboard live setiap jam, keputusan bulanan 1hb 00:05
  cron.schedule('0 * * * *', () => forGuilds((g) => activity.updateLiveLeaderboard(g, db), 'leaderboard'), tz);
  cron.schedule('5 0 1 * *', () => forGuilds((g) => activity.monthlyAward(g, db), 'monthly'), tz);

  // Mata voice & sapu lobby/voice sementara
  setInterval(() => activity.voiceTick(client, db), config.ACTIVITY.voiceTickMinutes * 60 * 1000);
  setInterval(() => party.sweep(client, db).catch((e) => console.error('[sweep]', e)), 5 * 60 * 1000);
}

client.once(Events.ClientReady, async (c) => {
  console.log(`✅ Online sebagai ${c.user.tag} • zon masa ${config.TIMEZONE}`);
  c.user.setActivity('/party • cari geng ranked', { type: ActivityType.Playing });
  schedule();
  // Jika bot offline semasa 1hb, beri anugerah bulanan bila online semula (dilindungi daripada ulangan).
  await forGuilds((g) => activity.monthlyAward(g, db), 'monthly-catchup');
  await forGuilds((g) => activity.updateLiveLeaderboard(g, db), 'leaderboard');
  party.sweep(client, db).catch(() => {});
});

client.on(Events.MessageCreate, (m) => {
  try { activity.onMessage(m, db); } catch (e) { console.error('[message]', e); }
});

client.on(Events.VoiceStateUpdate, (oldState, newState) => {
  if (oldState.channelId && oldState.channelId !== newState.channelId) party.onVoiceLeave(oldState, db).catch(() => {});
});

client.on(Events.InteractionCreate, async (i) => {
  try {
    if (!i.inGuild()) return;
    if (i.isChatInputCommand()) {
      const h = handlers[i.commandName];
      if (h) await h(i, db);
    } else if (i.isButton()) {
      if (i.customId.startsWith('party:')) await party.handlePartyButton(i, db);
      else if (i.customId.startsWith('custom:')) await weekly.handleCustomButton(i, db);
    } else if (i.isStringSelectMenu() && i.customId.startsWith('roles:')) {
      await handleRoleSelect(i);
    }
  } catch (e) {
    console.error('[interaction]', e);
    const payload = { content: '❌ Ada ralat. Cuba lagi atau beritahu admin.', flags: MessageFlags.Ephemeral };
    if (i.isRepliable()) (i.deferred || i.replied ? i.followUp(payload) : i.reply(payload)).catch(() => {});
  }
});

process.on('unhandledRejection', (e) => console.error('[unhandledRejection]', e));
client.login(config.TOKEN);
