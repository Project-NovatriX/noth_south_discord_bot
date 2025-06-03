// commands/send_birthday.js
const {
  SlashCommandBuilder, EmbedBuilder,
  ActionRowBuilder, ButtonBuilder, ButtonStyle,
} = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('send_birthday')
    .setDescription('🎉 誕生日登録・確認・削除メニューを表示'),

  async execute(interaction) {
    /* Embed */
    const embed = new EmbedBuilder()
      .setTitle('🎂 誕生日管理')
      .setDescription('ボタンを押して年・月・日を入力／確認／削除できます。')
      .setColor('#FFB6C1');

    /* Buttons */
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('birthday_register')
        .setLabel('🎂 登録する')
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId('birthday_check')
        .setLabel('📅 登録を確認')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId('birthday_delete')
        .setLabel('❌ 削除する')
        .setStyle(ButtonStyle.Danger),
    );

    await interaction.reply({ embeds: [embed], components: [row], ephemeral: false });
  },
};