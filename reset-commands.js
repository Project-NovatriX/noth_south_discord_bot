// clear-commands.js
require('dotenv').config();
const { REST, Routes } = require('discord.js');

const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

(async () => {
  try {
    console.log('🧹 全グローバルコマンドを削除中...');
    // Delete all global application commands
    await rest.put(
      Routes.applicationCommands(process.env.CLIENT_ID),
      { body: [] }
    );
    console.log('✅ グローバルコマンドを削除完了！');

    if (process.env.GUILD_ID) {
      console.log(`🧹 ギルド(${process.env.GUILD_ID}) のコマンドを削除中...`);
      // Delete all guild application commands
      await rest.put(
        Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID),
        { body: [] }
      );
      console.log('✅ ギルドコマンドを削除完了！');
    } else {
      console.warn('⚠️ GUILD_ID が設定されていません。ギルドコマンドは削除されません。');
    }
  } catch (error) {
    console.error('❌ コマンド削除に失敗:', error);
  }
})();