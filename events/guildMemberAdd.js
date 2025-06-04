const { Events } = require('discord.js');
const { getWelcomeConfig } = require('../db');

module.exports = {
  name: Events.GuildMemberAdd,
  async execute(member) {
    const config = await getWelcomeConfig(member.guild.id);
    if (!config || !config.channel_id || !config.message) return;

    const channel = member.guild.channels.cache.get(config.channel_id);
    if (channel && channel.isTextBased()) {
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
      // #チャンネル名 → メンション形式に変換
      message = message.replace(/#(\S+)/g, (match, name) => {
        const ch = member.guild.channels.cache.find(c => c.name === name && c.isTextBased());
        return ch ? `<#${ch.id}>` : `#${name}`;
      });
      // <#チャンネルID> を実際のチャンネルリンクに置換
      const parsedMessage = message.replace(/<#(\d+)>/g, (match, id) => {
        const ch = member.guild.channels.cache.get(id);
        return ch ? `<#${ch.id}>` : match;
      });
      await channel.send({ content: parsedMessage });
    }
    console.log(`✅ メンバーが参加しました: ${member.user.tag} (${member.id})`);
  },
};