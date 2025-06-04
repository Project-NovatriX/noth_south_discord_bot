const Database = require('better-sqlite3');
const path = require('path');
const fs   = require('fs');

/* ───── DB ファイル ───── */
const dbPath = path.resolve(__dirname, 'data', 'database.sqlite');
fs.mkdirSync(path.dirname(dbPath), { recursive: true });
const db = new Database(dbPath);

/* ───────────────── Welcome ───────────────── */
db.exec(`
  CREATE TABLE IF NOT EXISTS welcome_config (
    guild_id   TEXT PRIMARY KEY,
    channel_id TEXT NOT NULL,
    message    TEXT NOT NULL
  );
`);

// Ensure welcome_settings table exists for index.js compatibility
db.prepare(`
  CREATE TABLE IF NOT EXISTS welcome_settings (
    guild_id TEXT PRIMARY KEY,
    welcome_channel_id TEXT NOT NULL,
    welcome_message_template TEXT NOT NULL
  )
`).run();

/* ───────────────── Birthdays ───────────────── */
db.exec(`
  CREATE TABLE IF NOT EXISTS birthdays (
    guild_id TEXT NOT NULL,
    user_id  TEXT NOT NULL,
    birthday TEXT NOT NULL,        -- YYYY-MM-DD
    PRIMARY KEY (guild_id, user_id)
  );
`);

/* ───────────────── Birthday Settings ─────────────────
   2024 以前の DB では template 列が無いケースがあるため、
   起動時に存在チェック → なければ ALTER TABLE で追加              */
db.exec(`
  CREATE TABLE IF NOT EXISTS birthday_settings (
    guild_id   TEXT PRIMARY KEY,
    channel_id TEXT NOT NULL,
    time       TEXT NOT NULL       -- HH:MM
    -- template 列は後で確認して追加
  );
`);

/* --- template 列が無ければ追加 --- */
const cols = db.prepare(`PRAGMA table_info(birthday_settings);`).all();
if (!cols.some(col => col.name === 'template')) {
  console.log('📑  birthday_settings に template 列を追加中…');
  db.exec(`
    ALTER TABLE birthday_settings
      ADD COLUMN template TEXT NOT NULL
      DEFAULT '🎉 {user} さん、お誕生日おめでとう！';
  `);
  console.log('✅  template 列を追加しました');
}

/* ───────────────── Known Guilds ───────────────── */
db.exec(`
  CREATE TABLE IF NOT EXISTS known_guilds (
    guild_id TEXT PRIMARY KEY,
    name     TEXT NOT NULL
  );
`);

/* ═══════════  関数  ═══════════ */

/* Welcome */
function saveWelcomeConfig(guildId, channelId, message){
  db.prepare(`
    INSERT INTO welcome_config VALUES (?,?,?)
    ON CONFLICT(guild_id)
      DO UPDATE SET channel_id=excluded.channel_id,
                    message   =excluded.message;
  `).run(guildId, channelId, message);
}
function getWelcomeConfig(guildId){
  return db.prepare(`
    SELECT channel_id, message
      FROM welcome_config
     WHERE guild_id = ?;
  `).get(guildId);
}

/* Birthdays */
function saveBirthday(guildId,userId,birthday){
  db.prepare(`
    INSERT INTO birthdays VALUES (?,?,?)
    ON CONFLICT(guild_id,user_id)
      DO UPDATE SET birthday=excluded.birthday;
  `).run(guildId,userId,birthday);
}
function getBirthday(guildId,userId){
  return db.prepare(`
    SELECT birthday FROM birthdays
     WHERE guild_id=? AND user_id=?;
  `).get(guildId,userId);
}
function deleteBirthday(guildId,userId){
  db.prepare(`DELETE FROM birthdays WHERE guild_id=? AND user_id=?;`)
    .run(guildId,userId);
}
function getTodaysBirthdays(guildId, mmdd){
  return db.prepare(`
    SELECT user_id, birthday FROM birthdays
     WHERE guild_id=? AND substr(birthday,6,5)=?;
  `).all(guildId, mmdd);
}

/* Birthday Settings */
function saveBirthdaySetting(guildId,channelId,timeHHMM,template){
  db.prepare(`
    INSERT INTO birthday_settings VALUES (?,?,?,?)
    ON CONFLICT(guild_id)
      DO UPDATE SET channel_id = excluded.channel_id,
                    time       = excluded.time,
                    template   = excluded.template;
  `).run(guildId,channelId,timeHHMM,template);
}
function getBirthdaySetting(guildId){
  return db.prepare(`
    SELECT channel_id, time, template
      FROM birthday_settings
     WHERE guild_id=?;
  `).get(guildId);
}

/* すべてのギルドの誕生日設定を取得（スケジューラ用） */
function getAllBirthdaySettings() {
  return db.prepare(`
    SELECT guild_id, channel_id, time, template
      FROM birthday_settings;
  `).all();
}

/* Known Guilds */
function saveKnownGuild(guildId, name) {
  db.prepare(`
    INSERT INTO known_guilds (guild_id, name)
    VALUES (?, ?)
    ON CONFLICT(guild_id)
      DO UPDATE SET name = excluded.name;
  `).run(guildId, name);
}

/* ───── exports ───── */
module.exports = {
  saveWelcomeConfig, getWelcomeConfig,
  saveBirthday, getBirthday, deleteBirthday, getTodaysBirthdays,
  saveBirthdaySetting, getBirthdaySetting, getAllBirthdaySettings,
  saveKnownGuild,
};