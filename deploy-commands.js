const { REST, Routes, ApplicationCommandOptionType } = require('discord.js');

const commands = [
  {
    name: 'good',
    description: 'Award +1 point to a user',
    options: [
      {
        name: 'user',
        type: ApplicationCommandOptionType.User,
        description: 'The user to award points to',
        required: true
      }
    ]
  },
  {
    name: 'balance',
    description: 'Check point balance for yourself or another user',
    options: [
      {
        name: 'user',
        type: ApplicationCommandOptionType.User,
        description: 'The user to check (defaults to you)',
        required: false
      }
    ]
  },
  {
    name: 'reset',
    description: 'Reset points for a user or all users (requires Manage Server)',
    options: [
      {
        name: 'user',
        type: ApplicationCommandOptionType.User,
        description: 'The user to reset (leave empty to reset all users)',
        required: false
      }
    ]
  },
  {
    name: 'leaderboard',
    description: 'View the top 10 users with the most points'
  },
  {
    name: 'marketplace-setup',
    description: 'Set up the marketplace system (requires Administrator)',
    options: [
      {
        name: 'marketplace-channel',
        type: ApplicationCommandOptionType.Channel,
        description: 'The channel where approved listings will be posted',
        required: true
      },
      {
        name: 'submissions-channel',
        type: ApplicationCommandOptionType.Channel,
        description: 'The channel where submissions will be reviewed',
        required: true
      }
    ]
  },
  {
    name: 'marketplace-post',
    description: 'Post the marketplace submission button (requires Administrator)',
    options: [
      {
        name: 'channel',
        type: ApplicationCommandOptionType.Channel,
        description: 'The channel to post the button in (defaults to current channel)',
        required: false
      }
    ]
  }
];

async function deployCommands() {
  const token = process.env.DISCORD_TOKEN;
  const clientId = process.env.DISCORD_CLIENT_ID;

  if (!token) {
    console.error('❌ Error: DISCORD_TOKEN environment variable is not set!');
    process.exit(1);
  }

  if (!clientId) {
    console.error('❌ Error: DISCORD_CLIENT_ID environment variable is not set!');
    process.exit(1);
  }

  const rest = new REST({ version: '10' }).setToken(token);

  try {
    console.log('🔄 Started refreshing application (/) commands...');

    await rest.put(
      Routes.applicationCommands(clientId),
      { body: commands }
    );

    console.log('✅ Successfully registered application commands globally!');
    console.log(`📝 Registered ${commands.length} command(s): ${commands.map(c => c.name).join(', ')}`);
    console.log('⏱️  Note: Global commands may take up to 1 hour to appear in all servers.');
  } catch (error) {
    console.error('❌ Error deploying commands:', error);
    process.exit(1);
  }
}

deployCommands();
