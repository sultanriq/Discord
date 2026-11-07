// Daftar slash command ke server. Jalankan sekali (dan setiap kali command berubah): npm run deploy
const { REST, Routes } = require('discord.js');
const { TOKEN, CLIENT_ID, GUILD_ID } = require('./config');
const { definitions } = require('./commands');

if (!TOKEN || !CLIENT_ID || !GUILD_ID) {
  console.error('❌ Isi DISCORD_TOKEN, CLIENT_ID dan GUILD_ID dalam fail .env dahulu.');
  process.exit(1);
}

(async () => {
  const rest = new REST().setToken(TOKEN);
  const body = definitions.map((d) => d.toJSON());
  await rest.put(Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID), { body });
  console.log(`✅ ${body.length} slash command didaftarkan ke server ${GUILD_ID}.`);
})().catch((e) => {
  console.error('❌ Gagal daftar command:', e);
  process.exit(1);
});
