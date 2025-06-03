const { Events } = require('discord.js');
const { getWelcomeConfig } = require('../db');

module.exports = {
  name: Events.GuildMemberAdd,
  async execute(member) {
    const config = await getWelcomeConfig(member.guild.id);
    if (!config || !config.channel_id || !config.message) return;

    const targetChannel = member.guild.channels.cache.get(config.channel_id);
    if (!targetChannel?.isTextBased()) return;

    let message = config.message;

    // {user} を <@userId> に置換
    message = message.replace(/{user}/g, `<@${member.id}>`);

    // {channel:チャンネル名} を #チャンネルのメンションに置換
    const channelPattern = /{channel:(.*?)}/g;
    message = message.replace(channelPattern, (match, name) => {
      const found = member.guild.channels.cache.find(
        ch => ch.name === name && ch.isTextBased()
      );
      return found ? `<#${found.id}>` : `[${name}]`;
    });

    // メッセージを送信
    targetChannel.send({ content: message });
  },
};