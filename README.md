# 🎮 Bot Komuniti MLBB

Bot Discord untuk server komuniti **Mobile Legends: Bang Bang**: cari party ranked, borak gaming, aktiviti mingguan, topik harian, dan **Top 10 ahli aktif bulanan**. Semuanya automatik.

## ✨ Ciri-ciri

| Ciri | Apa yang bot buat |
|---|---|
| 🏗️ **`/setup`** | Satu command bina seluruh server: kategori, channel, role rank/lane, peraturan, pemilih role, panduan party, jadual mingguan, leaderboard. Boleh diulang tanpa menduplikasi. |
| 🔎 **Cari party** | `/party`: lobby dengan butang **Join / Keluar / Buat Voice / Tutup**. Ping role rank & `🎮 Ping Party`. Bila party penuh, bot buat **voice sementara** dan ping semua ahli. Voice dipadam bila kosong. Lobby tutup sendiri selepas 60 minit. |
| 🎭 **Pilih role** | Menu dropdown: rank (Warrior hingga Mythical Immortal), lane (Gold/EXP/Mid/Jungle/Roam), notifikasi. |
| 🗣️ **Topik harian** | Setiap hari 12:00 tengah hari bot hantar topik baru (60+ topik MLBB, gaming dan santai) dan buka **thread** untuk balasan. Topik tak berulang sehingga semua habis. |
| 📅 **Aktiviti mingguan** | Isnin: Misi Mingguan · Rabu: Undian (Discord poll) · Jumaat: Mabar Malam Jumaat · Sabtu: **Custom Match 5v5** (daftar guna butang, bot kocok Team A/B) · Ahad: Showcase Savage/Maniac |
| 🏆 **Top 10 aktif bulanan** | Mata dikira dari mesej (ada anti-spam), masa dalam voice bersama orang lain, dan bonus aktiviti. Leaderboard live dikemas kini setiap jam di #top-aktif. Pada **1hb setiap bulan** bot umumkan Top 10 dan beri role **🏆 Top 10 Aktif**. |

### Struktur server yang dibina oleh `/setup`

```
📢 MAKLUMAT       📜 peraturan · 📣 pengumuman · 🎭 pilih-role · 🏆 top-aktif
🎮 CARI PARTY     📋 panduan-party · 🔎 cari-party · 💬 borak-party
💬 BORAK          💬 borak-umum · 🗣️ topik-harian · 🎮 borak-mlbb · 🖼️ savage-maniac · 😂 meme · 🕹️ game-lain
📅 AKTIVITI       📅 aktiviti-mingguan · 🏟️ event-chat
🔊 VOICE          Lobby · Ranked 1-3 (5 orang) · Custom 5v5 (10 orang) · AFK
🎧 PARTY VOICE    (voice sementara dibuat automatik oleh /party)
```

### Sistem mata

- 💬 **1 mesej = 1 mata**, maksimum sekali setiap 30 saat (spam tak dikira, mesej < 3 huruf tak dikira)
- 🔊 **10 minit voice = 1 mata**: kena ada sekurang-kurangnya 2 orang dalam voice, tak deafen, bukan dalam AFK
- 🎁 **Bonus**: Misi mingguan +20, pemenang custom match +15 (peserta +5), showcase +15 (admin beri guna `/bonus`)

## 📜 Senarai command

| Command | Siapa | Fungsi |
|---|---|---|
| `/party mode pemain rank lane1 lane2 nota` | Semua | Buka lobby cari party |
| `/top [bulan]` | Semua | Top 10 aktif (bulan ini atau `2026-10`) |
| `/profil [ahli]` | Semua | Mata, kedudukan, berapa lagi untuk masuk Top 10 |
| `/aktiviti` | Semua | Jadual aktiviti mingguan |
| `/setup` | Admin | Bina/kemas kini struktur server |
| `/topik` | Admin | Hantar topik harian sekarang |
| `/jalan-aktiviti` | Admin | Jalankan mana-mana aktiviti sekarang (juga kocok pasukan & umum Top 10) |
| `/bonus ahli mata sebab` | Admin | Beri atau tolak mata |
| `/custom-menang pasukan` | Admin | Rekod pemenang custom match (mata diberi automatik) |

## 🚀 Cara pasang (lebih kurang 10 minit)

### 1. Buat bot di Discord Developer Portal
1. Pergi ke <https://discord.com/developers/applications>, tekan **New Application**, dan beri nama (cth. "MLBB Bot").
2. Salin **Application ID** dari *General Information*: ini `CLIENT_ID`.
3. Pergi ke tab **Bot**:
   - Tekan **Reset Token** dan salin: ini `DISCORD_TOKEN` (**jangan kongsi dengan sesiapa!**)
   - Di **Privileged Gateway Intents**, hidupkan **MESSAGE CONTENT INTENT**.
4. Pergi ke tab **OAuth2 → URL Generator**:
   - Scopes: `bot`, `applications.commands`
   - Bot Permissions: **Administrator** (paling mudah), atau sekurang-kurangnya Manage Roles, Manage Channels, Manage Messages, Send Messages, Embed Links, Create Public Threads, Send Polls, Move Members
   - Buka URL yang dijana dan jemput bot ke server anda.
5. Dalam Discord, hidupkan *User Settings → Advanced → Developer Mode*, kemudian klik kanan nama server dan pilih **Copy Server ID**: ini `GUILD_ID`.

### 2. Jalankan bot
Perlukan **Node.js 18.17+** (disyorkan versi 22).

```bash
git clone <repo ini>
cd Discord
npm install
cp .env.example .env      # kemudian isi DISCORD_TOKEN, CLIENT_ID, GUILD_ID
npm run deploy            # daftar slash command (sekali sahaja / bila command berubah)
npm start
```

### 3. Setup server
1. Dalam **Server Settings → Roles**, seret role bot ke **paling atas** (supaya bot boleh beri role).
2. Taip `/setup` dalam mana-mana channel. Siap! 🎉
3. (Pilihan) Padam channel lama yang tak diperlukan, dan set #peraturan sebagai *Rules Channel* dalam Server Settings → Community.

### Hosting 24/7
Bot perlu sentiasa online untuk jadual automatik. Pilihan:
- **VPS** (cth. DigitalOcean, Contabo, Oracle Cloud Free): guna `pm2 start src/index.js --name mlbb-bot`, kemudian `pm2 save`
- **Railway / Render**: set environment variables yang sama seperti `.env`, dengan start command `npm start`. Gunakan *persistent volume* untuk folder `data/` supaya mata tidak hilang.

Data (mata, lobby, tetapan) disimpan dalam `data/bot.db` (SQLite). **Backup fail ini** sekali-sekala.

## 🛠️ Ubah suai

| Nak ubah | Fail |
|---|---|
| Senarai topik harian | `src/data/topics.js` |
| Jadual & jenis aktiviti, misi, soalan undian | `src/data/weekly.js` |
| Nama channel, rank, lane, nama role, sistem mata | `src/config.js` |
| Peraturan & panduan party | `src/features/setup.js` |
| Masa topik harian / zon masa | `.env` (`DAILY_TOPIC_CRON`, `TIMEZONE`) |

Selepas ubah, restart bot. Jika ubah nama channel atau peraturan, jalankan `/setup` semula. Jika ubah command, jalankan `npm run deploy`.

## 💡 Tips urus komuniti

- **Lantik 2–3 moderator** yang aktif pada waktu berbeza. Mereka boleh tutup lobby, guna `/bonus`, dan rekod keputusan custom match.
- **Semak misi setiap Ahad malam** dan beri `/bonus 20` kepada yang siap. Ini galakkan orang kembali setiap minggu.
- **Shoutout Top 10** di story/TikTok/IG komuniti: pengiktirafan buat orang terus aktif.
- **Ajak ahli baru main** dalam Mabar Malam Jumaat supaya mereka cepat rasa diterima.
- Pertimbangkan hadiah kecil untuk #1 bulanan (cth. Weekly Diamond Pass) jika bajet mengizinkan.

## Ujian

```bash
npm test
```
