// reset-commands.js
require('dotenv').config();
const { REST, Routes } = require('discord.js');

const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

(async () => {
  try {
    console.log('🧹 全スラッシュコマンドを削除中...');

    await rest.put(
      Routes.applicationCommands(process.env.CLIENT_ID),
      { body: [] } // 空配列を送ることで削除
    );

    console.log('✅ コマンド削除完了！');
  } catch (error) {
    console.error('❌ コマンド削除に失敗:', error);
  }
})();