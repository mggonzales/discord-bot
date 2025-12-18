const { REST, Routes } = require('discord.js');

// Try to load from .env file if it exists
try {
  require('dotenv').config();
} catch (e) {
  // dotenv not installed, that's okay
}

// INSTRUCTIONS:
// Make sure you have a .env file with:
// DISCORD_TOKEN=your_bot_token
// DISCORD_CLIENT_ID=your_client_id
//
// OR run with environment variables:
// DISCORD_TOKEN=xxx DISCORD_CLIENT_ID=yyy node delete-commands.js

const token = process.env.DISCORD_TOKEN;
const clientId = process.env.DISCORD_CLIENT_ID;

if (!token || !clientId) {
  console.error('❌ Error: Missing DISCORD_TOKEN or DISCORD_CLIENT_ID!');
  console.error('');
  console.error('Please set them in a .env file:');
  console.error('  DISCORD_TOKEN=your_bot_token_here');
  console.error('  DISCORD_CLIENT_ID=your_client_id_here');
  console.error('');
  console.error('Or run with:');
  console.error('  DISCORD_TOKEN=xxx DISCORD_CLIENT_ID=yyy node delete-commands.js');
  process.exit(1);
}

const rest = new REST({ version: '10' }).setToken(token);

async function deleteAllCommands() {
  try {
    console.log('🗑️  Starting command cleanup...\n');

    // Delete all global commands
    console.log('🌐 Deleting global commands...');
    const globalCommands = await rest.get(Routes.applicationCommands(clientId));
    
    if (globalCommands.length === 0) {
      console.log('✅ No global commands to delete');
    } else {
      await rest.put(Routes.applicationCommands(clientId), { body: [] });
      console.log(`✅ Deleted ${globalCommands.length} global command(s)`);
    }

    console.log('\n✅ Command cleanup complete!');
    console.log('📝 Now restart your bot to re-register guild commands (will be instant)');
    
  } catch (error) {
    console.error('❌ Error deleting commands:', error);
    
    if (error.code === 50001) {
      console.error('\n⚠️  Missing Access: Make sure your bot token is correct');
    } else if (error.code === 10002) {
      console.error('\n⚠️  Unknown Application: Make sure your client ID is correct');
    } else if (error.status === 401) {
      console.error('\n⚠️  Unauthorized: Your bot token is incorrect or expired');
      console.error('Get a new token from: https://discord.com/developers/applications');
    }
  }
}

deleteAllCommands();