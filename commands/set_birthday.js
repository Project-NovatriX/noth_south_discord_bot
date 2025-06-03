// commands/set_birthday.js
const {
  SlashCommandBuilder, ActionRowBuilder,
  ButtonBuilder, ButtonStyle, EmbedBuilder,
} = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('set_birthday')
    .setDescription('🎂 誕生日通知の設定メニューを表示'),

  async execute(i) {
    const embed = new EmbedBuilder()
      .setTitle('🎂 誕生日通知設定メニュー')
      .setDescription(
        '* 📅 **時間と場所を設定** — 通知チャンネル & 時刻をプルダウンで選択後「✅ 決定」\n'
      + '* 📝 **メッセージを設定** — お祝いテンプレをモーダルで入力\n'
      + '* 📖 **現在の設定を表示** — 保存済みの内容を確認'
      )
      .setColor('#FFD700');

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('sb_openTimeLoc')
        .setLabel('📅 時間と場所を設定')
        .setStyle(ButtonStyle.Success),

      new ButtonBuilder()
        .setCustomId('sb_openTemplate')
        .setLabel('📝 メッセージを設定')
        .setStyle(ButtonStyle.Primary),

      new ButtonBuilder()
        .setCustomId('sb_showCurrent')
        .setLabel('📖 現在の設定を表示')
        .setStyle(ButtonStyle.Secondary),
    );

    await i.reply({ embeds: [embed], components: [row] });
  },
};