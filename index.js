const { 
  Client, 
  GatewayIntentBits, 
  PermissionFlagsBits, 
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle
} = require('discord.js');
const fs = require('fs').promises;
const path = require('path');

const client = new Client({
  intents: [GatewayIntentBits.Guilds]
});

const POINTS_FILE = path.join(__dirname, 'points.json');
const MARKETPLACE_CONFIG_FILE = path.join(__dirname, 'marketplace-config.json');

// Load points from JSON file
async function loadPoints() {
  try {
    const data = await fs.readFile(POINTS_FILE, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    if (error.code === 'ENOENT') {
      return {};
    }
    throw error;
  }
}

// Save points to JSON file atomically
async function savePoints(points) {
  const tempFile = `${POINTS_FILE}.tmp`;
  try {
    await fs.writeFile(tempFile, JSON.stringify(points, null, 2), 'utf8');
    await fs.rename(tempFile, POINTS_FILE);
  } catch (error) {
    // Clean up temp file if something went wrong
    try {
      await fs.unlink(tempFile);
    } catch {}
    throw error;
  }
}

// Get user's points
function getPoints(points, userId) {
  return points[userId] || 0;
}

// Load marketplace configuration
async function loadMarketplaceConfig() {
  try {
    const data = await fs.readFile(MARKETPLACE_CONFIG_FILE, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    if (error.code === 'ENOENT') {
      return {};
    }
    throw error;
  }
}

// Save marketplace configuration
async function saveMarketplaceConfig(config) {
  const tempFile = `${MARKETPLACE_CONFIG_FILE}.tmp`;
  try {
    await fs.writeFile(tempFile, JSON.stringify(config, null, 2), 'utf8');
    await fs.rename(tempFile, MARKETPLACE_CONFIG_FILE);
  } catch (error) {
    try {
      await fs.unlink(tempFile);
    } catch {}
    throw error;
  }
}

client.once('ready', () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
  console.log(`🤖 Bot is ready and serving ${client.guilds.cache.size} guild(s)`);
});

client.on('interactionCreate', async interaction => {
  try {
    // Handle slash commands
    if (interaction.isChatInputCommand()) {
      const { commandName } = interaction;

      if (commandName === 'good') {
        await handleGoodCommand(interaction);
      } else if (commandName === 'balance') {
        await handleBalanceCommand(interaction);
      } else if (commandName === 'reset') {
        await handleResetCommand(interaction);
      } else if (commandName === 'leaderboard') {
        await handleLeaderboardCommand(interaction);
      } else if (commandName === 'marketplace-setup') {
        await handleMarketplaceSetup(interaction);
      } else if (commandName === 'marketplace-post') {
        await handleMarketplacePost(interaction);
      }
    }
    // Handle button clicks
    else if (interaction.isButton()) {
      if (interaction.customId === 'marketplace_submit') {
        await handleMarketplaceSubmitButton(interaction);
      } else if (interaction.customId.startsWith('marketplace_approve_')) {
        await handleMarketplaceApprove(interaction);
      } else if (interaction.customId.startsWith('marketplace_decline_')) {
        await handleMarketplaceDecline(interaction);
      }
    }
    // Handle modal submissions
    else if (interaction.isModalSubmit()) {
      if (interaction.customId === 'marketplace_modal') {
        await handleMarketplaceModalSubmit(interaction);
      }
    }
  } catch (error) {
    console.error(`Error handling interaction:`, error);
    const errorMessage = '❌ An error occurred while processing your request. Please try again.';
    
    try {
      if (interaction.replied || interaction.deferred) {
        await interaction.followUp({ content: errorMessage, ephemeral: true });
      } else {
        await interaction.reply({ content: errorMessage, ephemeral: true });
      }
    } catch (e) {
      console.error('Failed to send error message:', e);
    }
  }
});

async function handleGoodCommand(interaction) {
  // CONFIGURATION: Allowed roles for /good command
  const ALLOWED_ROLES = ['Coaches', 'Moderators'];
  
  // Check if user is admin (has Administrator permission)
  const isAdmin = interaction.member.permissions.has(PermissionFlagsBits.Administrator);
  
  // Check if user has any of the allowed roles
  const hasAllowedRole = interaction.member.roles.cache.some(role => 
    ALLOWED_ROLES.includes(role.name)
  );
  
  if (!isAdmin && !hasAllowedRole) {
    return interaction.reply({
      content: `❌ You need one of these roles to award points: **${ALLOWED_ROLES.join(', ')}** (or Administrator permission)`,
      ephemeral: true
    });
  }

  const targetUser = interaction.options.getUser('user');

  // Validate: cannot award to bots
  if (targetUser.bot) {
    return interaction.reply({
      content: '❌ You cannot award points to bots!',
      ephemeral: true
    });
  }

  // Validate: cannot award to self
  if (targetUser.id === interaction.user.id) {
    return interaction.reply({
      content: '❌ You cannot award points to yourself!',
      ephemeral: true
    });
  }

  // Load points, update, and save
  const points = await loadPoints();
  const currentPoints = getPoints(points, targetUser.id);
  points[targetUser.id] = currentPoints + 1;
  await savePoints(points);

  await interaction.reply({
    content: `✅ Awarded +1 point to ${targetUser}! They now have **${points[targetUser.id]}** point(s).`
  });
}

async function handleBalanceCommand(interaction) {
  const targetUser = interaction.options.getUser('user') || interaction.user;
  
  const points = await loadPoints();
  const userPoints = getPoints(points, targetUser.id);

  const isOwnBalance = targetUser.id === interaction.user.id;
  const message = isOwnBalance
    ? `💰 You have **${userPoints}** point(s).`
    : `💰 ${targetUser} has **${userPoints}** point(s).`;

  await interaction.reply({ content: message });
}

async function handleResetCommand(interaction) {
  // Check for Manage Server permission
  if (!interaction.member.permissions.has(PermissionFlagsBits.ManageGuild)) {
    return interaction.reply({
      content: '❌ You need the **Manage Server** permission to use this command!',
      ephemeral: true
    });
  }

  const targetUser = interaction.options.getUser('user');
  const points = await loadPoints();

  if (targetUser) {
    // Reset specific user
    const hadPoints = points[targetUser.id] || 0;
    points[targetUser.id] = 0;
    await savePoints(points);

    await interaction.reply({
      content: `🔄 Reset ${targetUser}'s points to 0. (Previously: ${hadPoints})`
    });
  } else {
    // Reset all users
    const userCount = Object.keys(points).length;
    await savePoints({});

    await interaction.reply({
      content: `🔄 Reset all points! Cleared data for ${userCount} user(s).`
    });
  }
}

async function handleLeaderboardCommand(interaction) {
  const points = await loadPoints();
  
  // Sort users by points (descending) and take top 10
  const sortedUsers = Object.entries(points)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 10);

  if (sortedUsers.length === 0) {
    return interaction.reply({
      content: '📊 No one has any points yet! Use `/good @user` to award points.',
      ephemeral: true
    });
  }

  // Create embed
  const embed = new EmbedBuilder()
    .setColor('#FFD700')
    .setTitle('🏆 Points Leaderboard')
    .setDescription('Top 10 users with the most points')
    .setTimestamp()
    .setFooter({ text: `Requested by ${interaction.user.username}` });

  // Add fields for each user
  for (let i = 0; i < sortedUsers.length; i++) {
    const [userId, userPoints] = sortedUsers[i];
    
    try {
      const user = await client.users.fetch(userId);
      const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}.`;
      
      embed.addFields({
        name: `${medal} ${user.username}`,
        value: `**${userPoints}** point${userPoints === 1 ? '' : 's'}`,
        inline: true
      });

      // Set thumbnail to #1 user's avatar
      if (i === 0) {
        embed.setThumbnail(user.displayAvatarURL({ dynamic: true, size: 256 }));
      }
    } catch (error) {
      // User not found, skip or show as Unknown
      embed.addFields({
        name: `${i + 1}. Unknown User`,
        value: `**${userPoints}** point${userPoints === 1 ? '' : 's'}`,
        inline: true
      });
    }
  }

  await interaction.reply({ embeds: [embed] });
}

// ==================== MARKETPLACE COMMANDS ====================

async function handleMarketplaceSetup(interaction) {
  // Check for Administrator permission
  if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
    return interaction.reply({
      content: '❌ You need **Administrator** permission to use this command!',
      ephemeral: true
    });
  }

  const marketplaceChannel = interaction.options.getChannel('marketplace-channel');
  const submissionsChannel = interaction.options.getChannel('submissions-channel');

  // Validate channels are text channels
  if (!marketplaceChannel.isTextBased() || !submissionsChannel.isTextBased()) {
    return interaction.reply({
      content: '❌ Both channels must be text channels!',
      ephemeral: true
    });
  }

  // Save configuration
  const config = await loadMarketplaceConfig();
  config[interaction.guildId] = {
    marketplaceChannelId: marketplaceChannel.id,
    submissionsChannelId: submissionsChannel.id
  };
  await saveMarketplaceConfig(config);

  await interaction.reply({
    content: `✅ Marketplace system configured!\n📢 **Marketplace Channel:** ${marketplaceChannel}\n📋 **Submissions Channel:** ${submissionsChannel}\n\nUse \`/marketplace-post\` to post the submission button.`,
    ephemeral: true
  });
}

async function handleMarketplacePost(interaction) {
  // Check for Administrator permission
  if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
    return interaction.reply({
      content: '❌ You need **Administrator** permission to use this command!',
      ephemeral: true
    });
  }

  // Check if marketplace is configured
  const config = await loadMarketplaceConfig();
  if (!config[interaction.guildId]) {
    return interaction.reply({
      content: '❌ Marketplace system is not configured! Use `/marketplace-setup` first.',
      ephemeral: true
    });
  }

  const targetChannel = interaction.options.getChannel('channel') || interaction.channel;

  const embed = new EmbedBuilder()
    .setColor('#5865F2')
    .setTitle('🛍️ Marketplace Submissions')
    .setDescription('Click the button below to submit your item/service to the marketplace!\n\n**What you can list:**\n• Items for sale\n• Services offered\n• Trade requests\n• And more!\n\nYour submission will be reviewed by our team before being posted.')
    .setFooter({ text: 'All submissions are subject to approval' });

  const button = new ActionRowBuilder()
    .addComponents(
      new ButtonBuilder()
        .setCustomId('marketplace_submit')
        .setLabel('Submit to Marketplace')
        .setStyle(ButtonStyle.Primary)
        .setEmoji('📝')
    );

  await targetChannel.send({
    embeds: [embed],
    components: [button]
  });

  await interaction.reply({
    content: `✅ Marketplace submission button posted in ${targetChannel}!`,
    ephemeral: true
  });
}

async function handleMarketplaceSubmitButton(interaction) {
  // Create the modal form
  const modal = new ModalBuilder()
    .setCustomId('marketplace_modal')
    .setTitle('Marketplace Submission');

  // Title input
  const titleInput = new TextInputBuilder()
    .setCustomId('listing_title')
    .setLabel('Title')
    .setPlaceholder('e.g., Gaming PC For Sale, Web Design Services')
    .setStyle(TextInputStyle.Short)
    .setRequired(true)
    .setMaxLength(100);

  // Description input
  const descriptionInput = new TextInputBuilder()
    .setCustomId('listing_description')
    .setLabel('Description')
    .setPlaceholder('Provide detailed information about your listing...')
    .setStyle(TextInputStyle.Paragraph)
    .setRequired(true)
    .setMaxLength(1000);

  // Price input
  const priceInput = new TextInputBuilder()
    .setCustomId('listing_price')
    .setLabel('Price')
    .setPlaceholder('e.g., $500, Free, Negotiable, 100 points')
    .setStyle(TextInputStyle.Short)
    .setRequired(true)
    .setMaxLength(50);

  // Contact input
  const contactInput = new TextInputBuilder()
    .setCustomId('listing_contact')
    .setLabel('Contact Information')
    .setPlaceholder('How should people contact you? (DM, email, etc.)')
    .setStyle(TextInputStyle.Short)
    .setRequired(true)
    .setMaxLength(200);

  // Image URL input (optional)
  const imageInput = new TextInputBuilder()
    .setCustomId('listing_image')
    .setLabel('Image URL (Optional)')
    .setPlaceholder('https://example.com/image.png')
    .setStyle(TextInputStyle.Short)
    .setRequired(false)
    .setMaxLength(500);

  // Add inputs to action rows
  const firstRow = new ActionRowBuilder().addComponents(titleInput);
  const secondRow = new ActionRowBuilder().addComponents(descriptionInput);
  const thirdRow = new ActionRowBuilder().addComponents(priceInput);
  const fourthRow = new ActionRowBuilder().addComponents(contactInput);
  const fifthRow = new ActionRowBuilder().addComponents(imageInput);

  modal.addComponents(firstRow, secondRow, thirdRow, fourthRow, fifthRow);

  await interaction.showModal(modal);
}

async function handleMarketplaceModalSubmit(interaction) {
  await interaction.deferReply({ ephemeral: true });

  const config = await loadMarketplaceConfig();
  const guildConfig = config[interaction.guildId];

  if (!guildConfig) {
    return interaction.editReply({
      content: '❌ Marketplace system is not configured!'
    });
  }

  // Get form data
  const title = interaction.fields.getTextInputValue('listing_title');
  const description = interaction.fields.getTextInputValue('listing_description');
  const price = interaction.fields.getTextInputValue('listing_price');
  const contact = interaction.fields.getTextInputValue('listing_contact');
  const imageUrl = interaction.fields.getTextInputValue('listing_image') || null;

  // Validate image URL if provided
  let validImageUrl = null;
  if (imageUrl) {
    try {
      new URL(imageUrl);
      validImageUrl = imageUrl;
    } catch (e) {
      // Invalid URL, ignore it
    }
  }

  // Create submission embed
  const submissionEmbed = new EmbedBuilder()
    .setColor('#FFA500')
    .setTitle('📝 New Marketplace Submission')
    .addFields(
      { name: '📌 Title', value: title, inline: false },
      { name: '📄 Description', value: description, inline: false },
      { name: '💰 Price', value: price, inline: true },
      { name: '📞 Contact', value: contact, inline: true },
      { name: '👤 Submitted By', value: `${interaction.user}`, inline: true }
    )
    .setTimestamp()
    .setFooter({ text: `User ID: ${interaction.user.id}` });

  if (validImageUrl) {
    submissionEmbed.setImage(validImageUrl);
  }

  // Create approve/decline buttons
  const submissionId = `${Date.now()}_${interaction.user.id}`;
  const buttons = new ActionRowBuilder()
    .addComponents(
      new ButtonBuilder()
        .setCustomId(`marketplace_approve_${submissionId}`)
        .setLabel('Approve')
        .setStyle(ButtonStyle.Success)
        .setEmoji('✅'),
      new ButtonBuilder()
        .setCustomId(`marketplace_decline_${submissionId}`)
        .setLabel('Decline')
        .setStyle(ButtonStyle.Danger)
        .setEmoji('❌')
    );

  // Send to submissions channel
  try {
    const submissionsChannel = await client.channels.fetch(guildConfig.submissionsChannelId);
    const submissionMessage = await submissionsChannel.send({
      embeds: [submissionEmbed],
      components: [buttons]
    });

    // Store submission data as JSON in the message content (hidden via embed)
    const submissionData = {
      messageId: submissionMessage.id,
      title,
      description,
      price,
      contact,
      imageUrl: validImageUrl,
      userId: interaction.user.id,
      username: interaction.user.username,
      userTag: interaction.user.tag
    };

    // Edit message to include data in a way we can retrieve it
    await submissionMessage.edit({
      content: `\`\`\`json
${JSON.stringify(submissionData, null, 2)}
\`\`\``,
      embeds: [submissionEmbed],
      components: [buttons]
    });

    await interaction.editReply({
      content: '✅ Your submission has been sent for review! You will be notified once it is processed.'
    });
  } catch (error) {
    console.error('Error sending submission:', error);
    await interaction.editReply({
      content: '❌ Failed to submit your listing. Please contact an administrator.'
    });
  }
}

async function handleMarketplaceApprove(interaction) {
  // Check for Administrator or Manage Server permission
  if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator) && 
      !interaction.member.permissions.has(PermissionFlagsBits.ManageGuild)) {
    return interaction.reply({
      content: '❌ You need **Administrator** or **Manage Server** permission to approve submissions!',
      ephemeral: true
    });
  }

  await interaction.deferReply({ ephemeral: true });

  const config = await loadMarketplaceConfig();
  const guildConfig = config[interaction.guildId];

  if (!guildConfig) {
    return interaction.editReply({
      content: '❌ Marketplace system is not configured!'
    });
  }

  try {
    // Extract submission data from message
    const message = interaction.message;
    const dataMatch = message.content.match(/```json\n([\s\S]+?)\n```/);
    
    if (!dataMatch) {
      return interaction.editReply({
        content: '❌ Could not retrieve submission data!'
      });
    }

    const submissionData = JSON.parse(dataMatch[1]);

    // Create marketplace listing embed
    const listingEmbed = new EmbedBuilder()
      .setColor('#00FF00')
      .setTitle(submissionData.title)
      .setDescription(submissionData.description)
      .addFields(
        { name: '💰 Price', value: submissionData.price, inline: true },
        { name: '📞 Contact', value: submissionData.contact, inline: true }
      )
      .setFooter({ text: `Listed by ${submissionData.username}` })
      .setTimestamp();

    if (submissionData.imageUrl) {
      listingEmbed.setImage(submissionData.imageUrl);
    }

    // Post to marketplace channel
    const marketplaceChannel = await client.channels.fetch(guildConfig.marketplaceChannelId);
    await marketplaceChannel.send({ embeds: [listingEmbed] });

    // Update the submission message
    const updatedEmbed = EmbedBuilder.from(message.embeds[0])
      .setColor('#00FF00')
      .setTitle('✅ Approved - Marketplace Submission');

    await message.edit({
      embeds: [updatedEmbed],
      components: [] // Remove buttons
    });

    // Notify the submitter
    try {
      const submitter = await client.users.fetch(submissionData.userId);
      await submitter.send({
        content: `✅ Your marketplace submission **"${submissionData.title}"** has been approved and posted!`
      });
    } catch (e) {
      console.log('Could not DM user about approval');
    }

    await interaction.editReply({
      content: `✅ Submission approved and posted to ${marketplaceChannel}!`
    });
  } catch (error) {
    console.error('Error approving submission:', error);
    await interaction.editReply({
      content: '❌ Failed to approve submission. Please try again.'
    });
  }
}

async function handleMarketplaceDecline(interaction) {
  // Check for Administrator or Manage Server permission
  if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator) && 
      !interaction.member.permissions.has(PermissionFlagsBits.ManageGuild)) {
    return interaction.reply({
      content: '❌ You need **Administrator** or **Manage Server** permission to decline submissions!',
      ephemeral: true
    });
  }

  await interaction.deferReply({ ephemeral: true });

  try {
    // Extract submission data from message
    const message = interaction.message;
    const dataMatch = message.content.match(/```json\n([\s\S]+?)\n```/);
    
    if (!dataMatch) {
      return interaction.editReply({
        content: '❌ Could not retrieve submission data!'
      });
    }

    const submissionData = JSON.parse(dataMatch[1]);

    // Update the submission message
    const updatedEmbed = EmbedBuilder.from(message.embeds[0])
      .setColor('#FF0000')
      .setTitle('❌ Declined - Marketplace Submission');

    await message.edit({
      embeds: [updatedEmbed],
      components: [] // Remove buttons
    });

    // Notify the submitter
    try {
      const submitter = await client.users.fetch(submissionData.userId);
      await submitter.send({
        content: `❌ Your marketplace submission **"${submissionData.title}"** has been declined.`
      });
    } catch (e) {
      console.log('Could not DM user about decline');
    }

    await interaction.editReply({
      content: '✅ Submission declined.'
    });
  } catch (error) {
    console.error('Error declining submission:', error);
    await interaction.editReply({
      content: '❌ Failed to decline submission. Please try again.'
    });
  }
}

// Login to Discord
if (!process.env.DISCORD_TOKEN) {
  console.error('❌ Error: DISCORD_TOKEN environment variable is not set!');
  process.exit(1);
}

client.login(process.env.DISCORD_TOKEN);
