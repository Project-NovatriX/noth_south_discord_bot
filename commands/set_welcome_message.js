const {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle
} = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('set_welcome_message')
    .setDescription('Welcomeメッセージの設定UIを表示します'),
  async execute(interaction) {
    const embed = new EmbedBuilder()
      .setTitle('📬 Welcome メッセージ設定')
      .setDescription('以下のボタンから設定を進めてください')
      .addFields(
        { name: '📢 チャンネル設定', value: 'Welcomeメッセージの送信先を設定します' },
        { name: '✏️ メッセージ設定', value: '{user} を入れるとメンバーをメンションします\n#ルールのような形式でチャンネルも挿入できます' },
        { name: '👁️ プレビュー', value: '現在の設定内容を確認します' },
        { name: '🧹 リセット', value: 'すべての設定を削除します' }
      )
      .setColor('#00BFFF');

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('set_channel')
        .setLabel('チャンネル設定')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId('set_message')
        .setLabel('メッセージ設定')
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId('preview')
        .setLabel('プレビュー')
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId('reset')
        .setLabel('リセット')
        .setStyle(ButtonStyle.Danger)
    );

    await interaction.reply({
      embeds: [embed],
      components: [row],
      ephemeral: true
    });
  }
};