/* ───────────────────────────────────
 * index.js  (Welcome + Birthday)
 * discord.js v14
 * ─────────────────────────────────── */
require('dotenv').config();
const fs = require('fs');
const {
  Client, GatewayIntentBits, Partials, Collection, Events,
  REST, Routes,
  ActionRowBuilder, StringSelectMenuBuilder,
  ModalBuilder, TextInputBuilder, TextInputStyle,
  EmbedBuilder, ButtonBuilder, ButtonStyle,
} = require('discord.js');

const {
  /* Welcome */
  getWelcomeConfig, saveWelcomeConfig,
  /* Birthday user data */
  saveBirthday, getBirthday, getTodaysBirthdays, deleteBirthday,
  /* Birthday settings */
  saveBirthdaySetting, getBirthdaySetting,
} = require('./db');
const { saveKnownGuild } = require('./db');

/* ─── Client ─── */
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
  partials: [Partials.Channel],
});
client.commands = new Collection();

/* ─── Load Slash Commands ─── */
for (const f of fs.readdirSync('./commands').filter(x => x.endsWith('.js'))) {
  const cmd = require(`./commands/${f}`);
  client.commands.set(cmd.data.name, cmd);
}

/* ─── Register Slash Commands (Global) ─── */
(async () => {
  const rest  = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
  await rest.put(
    Routes.applicationCommands(process.env.CLIENT_ID),
    { body: [...client.commands.values()].map(c => c.data.toJSON()) }
  );
  console.log('✅ Global slash commands registered');
  await client.login(process.env.DISCORD_TOKEN);
})();

/* ─── キャッシュ: set_birthday (時間・場所) ─── */
const timeLocCache = new Map();   // userId → { guildId, channel?, hour?, min? }

/* ─── Interaction Handler ─── */
client.on(Events.InteractionCreate, async i => {
  const gid = i.guildId;

  /* ---------- Slash ---------- */
  if (i.isChatInputCommand()) {
    return client.commands.get(i.commandName)?.execute(i);
  }

  /* ───────── Buttons ───────── */
  if (i.isButton()) {
    switch (i.customId) {

      /* ========== Welcome Buttons (wm_) ========== */

      /* チャンネル設定 */
      case 'wm_setChannel': {
        const opts = i.guild.channels.cache
          .filter(c => c.type === 0)
          .map(c => ({ label: c.name, value: c.id }))
          .slice(0, 25);

        const row = new ActionRowBuilder().addComponents(
          new StringSelectMenuBuilder()
            .setCustomId('wm_selectChannel')
            .setPlaceholder('送信チャンネルを選択')
            .addOptions(opts),
        );

        return i.reply({ content: '📢 送信チャンネルを選択してください', components: [row], flags: 64 });
      }

      /* メッセージ設定 */
      case 'wm_setMessage': {
        const modal = new ModalBuilder()
          .setCustomId('wm_messageModal')
          .setTitle('✏️ Welcome メッセージ')
          .addComponents(
            new ActionRowBuilder().addComponents(
              new TextInputBuilder()
                .setCustomId('wm_msg')
                .setLabel('メッセージ ( {user} 可 )')
                .setPlaceholder('ようこそ {user} さん！ #ルール も確認してね')
                .setStyle(TextInputStyle.Paragraph)
                .setRequired(false),
            ),
          );
        return i.showModal(modal);
      }

      /* プレビュー */
      case 'wm_preview': {
        const conf = getWelcomeConfig(gid);
        if (!conf?.channel_id) {
          return i.reply({ content: '⚠️ まだ設定されていません', flags: 64 });
        }

        let msg = conf.message || '';
        msg = msg.replace(/{user}/g, `<@${i.user.id}>`);
        msg = msg.replace(/#(\S+)/g, (_, name) => {
          const ch = i.guild.channels.cache.find(c => c.name === name && c.isTextBased());
          return ch ? `<#${ch.id}>` : `#${name}`;
        });

        return i.reply({
          embeds: [
            new EmbedBuilder()
              .setTitle('👁️ Welcome メッセージ・プレビュー')
              .addFields(
                { name: '送信チャンネル', value: `<#${conf.channel_id}>`, inline: false },
                { name: 'メッセージ', value: msg || '(空)', inline: false },
              )
              .setColor('#00BFFF'),
          ],
          flags: 64,
        });
      }

      /* リセット */
      case 'wm_reset':
        saveWelcomeConfig(gid, '', '');
        return i.reply({ content: '🧹 Welcome 設定をリセットしました', flags: 64 });

      /* ========== set_birthday Buttons (sb_) ========== */

      case 'sb_openTimeLoc': {                                   // STEP 1
        const chanOpts = i.guild.channels.cache
          .filter(c => c.type === 0)
          .map(c => ({ label: c.name, value: c.id }))
          .slice(0, 25);
        const hrOpts = [...Array(24)].map((_,h)=>({label:`${String(h).padStart(2,'0')} 時`,value:String(h).padStart(2,'0')}));
        const mnOpts = ['00','15','30','45'].map(m=>({label:`${m} 分`,value:m}));

        const rowCh  = new ActionRowBuilder().addComponents(
          new StringSelectMenuBuilder().setCustomId('sb_setChannel').setPlaceholder('チャンネル').addOptions(chanOpts));
        const rowHr  = new ActionRowBuilder().addComponents(
          new StringSelectMenuBuilder().setCustomId('sb_setHour').setPlaceholder('時').addOptions(hrOpts));
        const rowMin = new ActionRowBuilder().addComponents(
          new StringSelectMenuBuilder().setCustomId('sb_setMin').setPlaceholder('分').addOptions(mnOpts));
        const rowOk  = new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId('sb_confirmTimeLoc').setLabel('✅ 決定').setStyle(ButtonStyle.Success));

        return i.reply({ content:'🔧 選択後「✅ 決定」', components:[rowCh,rowHr,rowMin,rowOk], flags: 64 });
      }

      case 'sb_confirmTimeLoc': {                                // STEP 1 確定
        const rec = timeLocCache.get(i.user.id);
        if (!rec || !rec.channel || !rec.hour || !rec.min) {
          return i.reply({ content:'⚠️ まだすべて選択されていません', flags: 64 });
        }
        const cur = getBirthdaySetting(gid) || {};
        saveBirthdaySetting(gid, rec.channel, `${rec.hour}:${rec.min}`, cur.template || '🎉 {user} さん、お誕生日おめでとう！');
        timeLocCache.delete(i.user.id);
        return i.reply({ content:`✅ 保存: <#${rec.channel}>  ${rec.hour}:${rec.min}`, flags: 64 });
      }

      case 'sb_openTemplate': {                                  // STEP 2
        const cur = getBirthdaySetting(gid) || {};
        const modal = new ModalBuilder()
          .setCustomId('sb_templateModal').setTitle('📝 メッセージテンプレート')
          .addComponents(
            new ActionRowBuilder().addComponents(
              new TextInputBuilder()
                .setCustomId('tmpl')
                .setLabel('テンプレ ( {user} , {age} 可 )')
                .setStyle(TextInputStyle.Paragraph)
                .setPlaceholder('🎉 {user} さん {age} 歳おめでとう！')
                .setValue(cur.template || '')
                .setRequired(false),
            ),
          );
        return i.showModal(modal);
      }

      case 'sb_showCurrent': {                                   // STEP 3
        const cur = getBirthdaySetting(gid);
        if (!cur) return i.reply({ content:'⚠️ まだ設定がありません',flags: 64 });
        const embed = new EmbedBuilder()
          .setTitle('📖 現在の誕生日通知設定')
          .addFields(
            { name:'チャンネル', value:`<#${cur.channel_id}>`, inline:false },
            { name:'時刻', value:cur.time, inline:true },
            { name:'テンプレ', value:cur.template.slice(0,1024), inline:false })
          .setColor('#00BFFF');
        return i.reply({ embeds:[embed], flags: 64 });
      }

      /* ===== 誕生日登録/確認/削除 (birthday_) ===== */

      case 'birthday_register': {
        const modal=new ModalBuilder()
          .setCustomId('birthday_register_modal').setTitle('🎂 誕生日登録')
          .addComponents(
            new ActionRowBuilder().addComponents(
              new TextInputBuilder().setCustomId('b_year').setLabel('年 YYYY')
                .setStyle(TextInputStyle.Short).setRequired(true)),
            new ActionRowBuilder().addComponents(
              new TextInputBuilder().setCustomId('b_month').setLabel('月 1-12')
                .setStyle(TextInputStyle.Short).setRequired(true)),
            new ActionRowBuilder().addComponents(
              new TextInputBuilder().setCustomId('b_day').setLabel('日 1-31')
                .setStyle(TextInputStyle.Short).setRequired(true)));
        return i.showModal(modal);
      }

      case 'birthday_check': {
        const r=getBirthday(gid,i.user.id);
        return i.reply({ content:r?`📅 あなたの誕生日: ${r.birthday}`:'❌ 未登録',flags: 64 });
      }

      case 'birthday_delete':
        deleteBirthday(gid,i.user.id);
        return i.reply({ content:'🗑️ 削除しました',flags: 64 });
    }
  }

  /* ───────── SelectMenus ───────── */
  if (i.isStringSelectMenu()) {

    /* Welcome: チャンネル選択 */
    if (i.customId === 'wm_selectChannel') {
      const conf = getWelcomeConfig(gid) || {};
      saveWelcomeConfig(gid, i.values[0], conf.message || '');
      return i.update({ content:`✅ 送信チャンネルを <#${i.values[0]}> に設定しました`, components:[] });
    }

    /* Birthday: 時間 / 場所 */
    if (['sb_setChannel','sb_setHour','sb_setMin'].includes(i.customId)) {
      const rec = timeLocCache.get(i.user.id) || { guildId: gid };
      if (i.customId==='sb_setChannel') rec.channel=i.values[0];
      if (i.customId==='sb_setHour')    rec.hour   =i.values[0];
      if (i.customId==='sb_setMin')     rec.min    =i.values[0];
      timeLocCache.set(i.user.id, rec);
      return i.deferUpdate();
    }
  }

  /* ───────── Modal Submit ───────── */
  if (i.isModalSubmit()) {

    /* Welcome: メッセージ保存 */
    if (i.customId === 'wm_messageModal') {
      let msg = i.fields.getTextInputValue('wm_msg');
      msg = msg.replace(/<#(\d+)>/g, (_,id)=>{
        const ch=i.guild.channels.cache.get(id); return ch?`#${ch.name}`:_; });
      const conf = getWelcomeConfig(gid) || {};
      saveWelcomeConfig(gid, conf.channel_id || '', msg);
      return i.reply({ content:'✅ メッセージを保存しました',flags: 64 });
    }

    /* Birthday: 登録 */
    if (i.customId === 'birthday_register_modal') {
      const y=i.fields.getTextInputValue('b_year').trim();
      const m=i.fields.getTextInputValue('b_month').trim();
      const d=i.fields.getTextInputValue('b_day').trim();
      if(!/^\d{4}$/.test(y)||!/^\d{1,2}$/.test(m)||!/^\d{1,2}$/.test(d))
        return i.reply({ content:'⚠️ 入力形式エラー',flags: 64 });
      const dt=new Date(+y,+m-1,+d);
      if(dt.getFullYear()!=+y||dt.getMonth()!=+m-1||dt.getDate()!=+d)
        return i.reply({ content:'⚠️ 実在しない日付',flags: 64 });
      const ds=`${y}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
      saveBirthday(gid,i.user.id,ds);
      return i.reply({ content:`✅ 誕生日 ${ds} を登録しました`,flags: 64 });
    }

    /* Birthday: テンプレ保存 */
    if (i.customId === 'sb_templateModal') {
      // Only update the template, keep channel_id and time as is.
      const tmpl = i.fields.getTextInputValue('tmpl').slice(0, 1000)
                || '🎉 {user} さん、{age}歳の誕生日おめでとう！';
      const cur = getBirthdaySetting(gid);
      if (!cur?.channel_id || !cur?.time)
        return i.reply({ content:'⚠️ 先に時間と場所を設定してください', flags: 64 });
      // Save only the template, keeping channel_id and time unchanged
      saveBirthdaySetting(
        gid,
        cur.channel_id,
        cur.time,
        tmpl
      );
      return i.reply({ content:'✅ テンプレートを保存しました', flags: 64 });
    }
  }
});

/* ─── Ready ─── */
client.once(Events.ClientReady, () => {
  console.log(`🟢 Logged in as ${client.user.tag}`);

  console.log(`[INTENTS] bitfield = ${client.options.intents.bitfield}`);
  console.log(`[INTENTS] names    =`, client.options.intents.toArray());
  client.guilds.cache.forEach(g => {
    console.log(`[INIT] Saving guild: ${g.name} (${g.id})`);
    saveKnownGuild(g.id, g.name);
  });

  /* 🎂 毎分誕生日チェック */
  setInterval(async () => {
    const now       = new Date();
    const hhmm      = `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;
    const mmdd      = `${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
    const thisYear  = now.getFullYear();

    /* 各サーバーの設定を取得 → 時刻が一致したギルドだけ処理 */
    client.guilds.cache.forEach(async guild => {
      const setting = getBirthdaySetting(guild.id);
      if (!setting || !setting.time || !setting.channel_id) return;
      console.log(`[BDAY] guild=${guild.id} now=${hhmm} set=${setting ? setting.time : 'none'}`);
      if (setting.time !== hhmm) return; // 時刻不一致

      const channel = guild.channels.cache.get(setting.channel_id);
      if (!channel || !channel.isTextBased()) return; // チャンネル取得不可

      /* 今日が誕生日のユーザー一覧 */
      const list = getTodaysBirthdays(guild.id, mmdd); // [{ user_id, birthday }]
      console.log(`[BDAY] guild=${guild.id} todayList=${list.length}`);
      if (!list.length) return; // 0 人なら何もしない

      for (const row of list) {
        // row.birthday should exist and be in YYYY-MM-DD
        if (!row.birthday || row.birthday.length < 10) {
          console.warn(`[Birthday] invalid birthday for user ${row.user_id} in guild ${guild.id}`);
          continue; // skip broken record
        }

        try {
          const age    = thisYear - Number(row.birthday.slice(0, 4));
          const userId = row.user_id;
          let msg = (setting.template || '🎉 {user} さん、{age}歳の誕生日おめでとう！')
            .replace(/{user}/g, `<@${userId}>`)
            .replace(/{age}/g, String(age));
          console.log(`[BDAY] sending to ${userId} (${age}y) in guild ${guild.id}`);
          await channel.send({ content: msg });
        } catch (err) {
          console.error(`Failed to send birthday message in guild ${guild.id} for user ${row.user_id}`, err);
        }
      }
    });
  }, 60 * 1000); // 60秒ごとに実行
});


/* ─── イベントハンドラーの読み込み ─── */
const path = require('path');
const eventsPath = path.join(__dirname, 'events');
for (const file of fs.readdirSync(eventsPath).filter(f => f.endsWith('.js'))) {
  const event = require(`./events/${file}`);
  if (event.name && event.execute) {
    client.on(event.name, (...args) => event.execute(...args));
    console.log(`[EVENT] Loaded handler for ${event.name}`);
  }
} 