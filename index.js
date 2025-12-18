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
const express = require('express');
const {
  getPoints,
  setPoints,
  getAllPoints,
  resetPoints,
  getMarketplaceConfig,
  setMarketplaceConfig,
  getAllMarketplaceConfigs
} = require('./database');
const express = require('express');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.DirectMessages,
    GatewayIntentBits.MessageContent
  ],
  partials: ['CHANNEL'] // Required for DMs
});

client.once('ready', async () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
  console.log(`🤖 Bot is ready and serving ${client.guilds.cache.size} guild(s)`);
  
  // Auto-deploy commands on startup
  await deployCommands();
});

// Function to deploy commands
async function deployCommands() {
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

  const token = process.env.DISCORD_TOKEN;
  const clientId = process.env.DISCORD_CLIENT_ID;

  if (!token || !clientId) {
    console.error('⚠️ Cannot deploy commands: Missing DISCORD_TOKEN or DISCORD_CLIENT_ID');
    return;
  }

  const rest = new REST({ version: '10' }).setToken(token);

  try {
    console.log('🔄 Deploying application commands...');
    console.log(`📊 Bot is in ${client.guilds.cache.size} guild(s)`);

    // Deploy to all guilds the bot is in (instant registration)
    for (const guild of client.guilds.cache.values()) {
      try {
        await rest.put(
          Routes.applicationGuildCommands(clientId, guild.id),
          { body: commands }
        );
        console.log(`✅ Deployed commands to: ${guild.name} (ID: ${guild.id})`);
      } catch (guildError) {
        console.error(`❌ Failed to deploy to ${guild.name}:`, guildError.message);
        if (guildError.code === 50001) {
          console.error(`   → Bot is missing "applications.commands" scope in ${guild.name}`);
          console.error(`   → Please re-invite the bot with the correct permissions`);
        }
      }
    }

    console.log('✅ Command deployment process complete!');
  } catch (error) {
    console.error('❌ Error deploying commands:', error);
  }
}

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
      } else if (interaction.customId.startsWith('marketplace_request_images_')) {
        await handleMarketplaceRequestImages(interaction);
      } else if (interaction.customId.startsWith('marketplace_decline_')) {
        await handleMarketplaceDecline(interaction);
      }
    }
    // Handle modal submissions
    else if (interaction.isModalSubmit()) {
      if (interaction.customId === 'marketplace_modal') {
        await handleMarketplaceModalSubmit(interaction);
      } else if (interaction.customId === 'decline_reason_modal') {
        await handleDeclineReasonSubmit(interaction);
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
  const currentPoints = getPoints(targetUser.id);
  const newPoints = currentPoints + 1;
  setPoints(targetUser.id, newPoints);

  await interaction.reply({
    content: `✅ Awarded +1 point to ${targetUser}! They now have **${newPoints}** point(s).`
  });
}

async function handleBalanceCommand(interaction) {
  const targetUser = interaction.options.getUser('user') || interaction.user;
  
  const userPoints = getPoints(targetUser.id);

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

  if (targetUser) {
    // Reset specific user
    const hadPoints = getPoints(targetUser.id);
    resetPoints(targetUser.id);

    await interaction.reply({
      content: `🔄 Reset ${targetUser}'s points to 0. (Previously: ${hadPoints})`
    });
  } else {
    // Reset all users
    const allPoints = getAllPoints();
    const userCount = allPoints.length;
    resetPoints();

    await interaction.reply({
      content: `🔄 Reset all points! Cleared data for ${userCount} user(s).`
    });
  }
}

async function handleLeaderboardCommand(interaction) {
  const allPoints = getAllPoints();
  
  // Take top 10
  const sortedUsers = allPoints.slice(0, 10);

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
    const { user_id: userId, points: userPoints } = sortedUsers[i];
    
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
  console.log('💾 Saving marketplace config for guild:', interaction.guildId);
  console.log('Marketplace Channel:', marketplaceChannel.id);
  console.log('Submissions Channel:', submissionsChannel.id);
  
  setMarketplaceConfig(interaction.guildId, marketplaceChannel.id, submissionsChannel.id);
  
  console.log('✅ Config saved successfully to database');

  await interaction.reply({
    content: `✅ Marketplace system configured!\n📢 **Marketplace Channel:** ${marketplaceChannel}\n📋 **Submissions Channel:** ${submissionsChannel}\n\n**Debug Info:**\n- Guild ID: \`${interaction.guildId}\`\n- Config saved to persistent database\n\nUse \`/marketplace-post\` to post the submission button.`,
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
  const config = getMarketplaceConfig(interaction.guildId);
  if (!config) {
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
  // Check if marketplace is configured
  const guildConfig = getMarketplaceConfig(interaction.guildId);

  console.log('📋 Marketplace Submit Button Clicked');
  console.log('Guild ID:', interaction.guildId);
  console.log('Config exists:', !!guildConfig);

  if (!guildConfig) {
    return interaction.reply({
      content: '❌ Marketplace system is not configured! An administrator needs to run `/marketplace-setup` first.\n\n**Debug Info:**\n- Guild ID: `' + interaction.guildId + '`',
      ephemeral: true
    });
  }

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

  const guildConfig = getMarketplaceConfig(interaction.guildId);

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
        .setCustomId(`marketplace_request_images_${submissionId}`)
        .setLabel('Request Images')
        .setStyle(ButtonStyle.Primary)
        .setEmoji('📸'),
      new ButtonBuilder()
        .setCustomId(`marketplace_decline_${submissionId}`)
        .setLabel('Decline')
        .setStyle(ButtonStyle.Danger)
        .setEmoji('❌')
    );

  // Send to submissions channel
  try {
    const submissionsChannel = await client.channels.fetch(guildConfig.submissions_channel_id);
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

  const guildConfig = getMarketplaceConfig(interaction.guildId);

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
      .setColor('#233dff')
      .setTitle(submissionData.title)
      .setDescription(submissionData.description)
      .addFields(
        { name: '💰 Price', value: submissionData.price, inline: true },
        { name: '📞 Contact', value: submissionData.contact, inline: true },
        { name: '👤 Seller', value: `<@${submissionData.userId}>`, inline: true }
      )
      .setFooter({ text: `Listed by ${submissionData.username}` })
      .setTimestamp();

    if (submissionData.imageUrl) {
      listingEmbed.setImage(submissionData.imageUrl);
    }

    // Post to marketplace channel with mention
    const marketplaceChannel = await client.channels.fetch(guildConfig.marketplace_channel_id);
    await marketplaceChannel.send({ 
      content: `New listing from <@${submissionData.userId}>!`,
      embeds: [listingEmbed] 
    });

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

async function handleMarketplaceRequestImages(interaction) {
  // Check for Administrator or Manage Server permission
  if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator) && 
      !interaction.member.permissions.has(PermissionFlagsBits.ManageGuild)) {
    return interaction.reply({
      content: '❌ You need **Administrator** or **Manage Server** permission to request images!',
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

    // Send DM to the submitter
    try {
      const submitter = await client.users.fetch(submissionData.userId);
      
      const requestEmbed = new EmbedBuilder()
        .setColor('#FFA500')
        .setTitle('📸 Image Request for Your Marketplace Listing')
        .setDescription(`The moderators would like to request images for your listing **"${submissionData.title}"**.`)
        .addFields(
          { name: '📝 What to do', value: 'Please reply to this DM with image(s) of your product/service. You can attach multiple images in a single message.' },
          { name: '⏰ Timeframe', value: 'Please send the images within 24 hours.' },
          { name: '💡 Tip', value: 'Make sure the images are clear and relevant to your listing!' }
        )
        .setFooter({ text: 'Simply attach your images in your next message here' })
        .setTimestamp();

      await submitter.send({ embeds: [requestEmbed] });

      // Update submission embed to show request was sent
      const updatedEmbed = EmbedBuilder.from(message.embeds[0])
        .addFields({ 
          name: '📸 Image Request', 
          value: `Sent by ${interaction.user} at <t:${Math.floor(Date.now() / 1000)}:f>`, 
          inline: false 
        });

      await message.edit({ embeds: [updatedEmbed] });

      // Set up DM listener for this specific user
      setupImageListener(submissionData.userId, message.id, submissionData.title);

      await interaction.editReply({
        content: `✅ Image request sent to <@${submissionData.userId}>! The bot will monitor their DMs for the next 24 hours.\n\nWhen they send images, you'll be notified here.`
      });
    } catch (e) {
      console.log('Could not DM user:', e.message);
      await interaction.editReply({
        content: '❌ Could not send DM to user. They may have DMs disabled or have blocked the bot.'
      });
    }
  } catch (error) {
    console.error('Error requesting images:', error);
    await interaction.editReply({
      content: '❌ Failed to request images. Please try again.'
    });
  }
}

// Store active image request listeners
const imageRequestListeners = new Map();

function setupImageListener(userId, submissionMessageId, listingTitle) {
  // Store the listener with expiration time (24 hours)
  const expiresAt = Date.now() + 24 * 60 * 60 * 1000; // 24 hours
  
  imageRequestListeners.set(userId, {
    submissionMessageId,
    listingTitle,
    expiresAt
  });

  // Clean up after 24 hours
  setTimeout(() => {
    imageRequestListeners.delete(userId);
  }, 24 * 60 * 60 * 1000);
}

// Add message handler for DMs with images
client.on('messageCreate', async message => {
  // Ignore bot messages
  if (message.author.bot) return;

  // Only handle DMs
  if (message.channel.type !== 1) return; // 1 = DM channel

  // Check if this user has an active image request
  const request = imageRequestListeners.get(message.author.id);
  if (!request) return;

  // Check if request hasn't expired
  if (Date.now() > request.expiresAt) {
    imageRequestListeners.delete(message.author.id);
    return;
  }

  // Check if message has attachments (images)
  const images = message.attachments.filter(att => 
    att.contentType?.startsWith('image/')
  );

  if (images.size === 0) {
    // No images in this message, keep waiting
    return;
  }

  // User sent images! Process them
  try {
    const imageUrls = images.map(img => img.url);

    // Send confirmation to user
    const confirmEmbed = new EmbedBuilder()
      .setColor('#00FF00')
      .setTitle('✅ Images Received!')
      .setDescription(`Thank you! We've received ${images.size} image(s) for your listing **"${request.listingTitle}"**.`)
      .addFields({ 
        name: '📝 Next Steps', 
        value: 'The moderators will review your images and update your listing accordingly.' 
      })
      .setTimestamp();

    await message.reply({ embeds: [confirmEmbed] });

    // Find the submission message and update it
    const allConfigs = getAllMarketplaceConfigs();
    
    for (const config of allConfigs) {
      try {
        const guild = await client.guilds.fetch(config.guild_id);
        const submissionsChannel = await guild.channels.fetch(config.submissions_channel_id);
        const submissionMessage = await submissionsChannel.messages.fetch(request.submissionMessageId);

        // Update the submission message with the images
        const updatedEmbed = EmbedBuilder.from(submissionMessage.embeds[0])
          .setImage(imageUrls[0]) // Set the first image as main image
          .addFields({ 
            name: '📸 Images Received', 
            value: `User submitted ${images.size} image(s) at <t:${Math.floor(Date.now() / 1000)}:f>\n${imageUrls.map((url, i) => `[Image ${i + 1}](${url})`).join(' • ')}`, 
            inline: false 
          });

        await submissionMessage.edit({ embeds: [updatedEmbed] });

        // Update the stored JSON data to include images
        const dataMatch = submissionMessage.content.match(/```json\n([\s\S]+?)\n```/);
        if (dataMatch) {
          const submissionData = JSON.parse(dataMatch[1]);
          submissionData.imageUrl = imageUrls[0]; // Primary image
          submissionData.additionalImages = imageUrls; // All images

          await submissionMessage.edit({
            content: `\`\`\`json
${JSON.stringify(submissionData, null, 2)}
\`\`\``,
            embeds: [updatedEmbed],
            components: submissionMessage.components
          });
        }

        // Notify moderators in the submissions channel
        await submissionsChannel.send({
          content: `📸 <@${message.author.id}> has submitted images for their marketplace listing! Check the updated submission above.`
        });

        break; // Found and updated, exit loop
      } catch (e) {
        console.log('Could not update submission in guild:', config.guild_id, e.message);
      }
    }

    // Clean up listener
    imageRequestListeners.delete(message.author.id);

  } catch (error) {
    console.error('Error processing submitted images:', error);
    await message.reply({
      content: '❌ There was an error processing your images. Please contact a moderator.'
    });
  }
});

async function handleMarketplaceDecline(interaction) {
  // Check for Administrator or Manage Server permission
  if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator) && 
      !interaction.member.permissions.has(PermissionFlagsBits.ManageGuild)) {
    return interaction.reply({
      content: '❌ You need **Administrator** or **Manage Server** permission to decline submissions!',
      ephemeral: true
    });
  }

  // Show modal to get decline reason
  const modal = new ModalBuilder()
    .setCustomId(`decline_reason_modal`)
    .setTitle('Decline Submission');

  const reasonInput = new TextInputBuilder()
    .setCustomId('decline_reason')
    .setLabel('Reason for Decline (sent to user)')
    .setPlaceholder('e.g., Does not meet marketplace guidelines, Inappropriate content, etc.')
    .setStyle(TextInputStyle.Paragraph)
    .setRequired(true)
    .setMaxLength(500);

  const row = new ActionRowBuilder().addComponents(reasonInput);
  modal.addComponents(row);

  await interaction.showModal(modal);
}

async function handleDeclineReasonSubmit(interaction) {
  await interaction.deferReply({ ephemeral: true });

  try {
    // Get the decline reason
    const reason = interaction.fields.getTextInputValue('decline_reason');

    // The message should be accessible from interaction.message
    // But since modal submissions don't have direct access, we need to find it
    // We'll search recent messages in the channel
    const messages = await interaction.channel.messages.fetch({ limit: 50 });
    let submissionMessage = null;
    
    // Find the most recent message with marketplace submission buttons
    for (const msg of messages.values()) {
      if (msg.embeds.length > 0 && 
          msg.embeds[0].title === '📝 New Marketplace Submission' &&
          msg.components.length > 0) {
        submissionMessage = msg;
        break;
      }
    }

    if (!submissionMessage) {
      return interaction.editReply({
        content: '❌ Could not find the submission message. Please try declining again or contact an administrator.'
      });
    }

    // Extract submission data
    const dataMatch = submissionMessage.content.match(/```json\n([\s\S]+?)\n```/);
    
    if (!dataMatch) {
      return interaction.editReply({
        content: '❌ Could not retrieve submission data!'
      });
    }

    const submissionData = JSON.parse(dataMatch[1]);

    // Update the submission message
    const updatedEmbed = EmbedBuilder.from(submissionMessage.embeds[0])
      .setColor('#FF0000')
      .setTitle('❌ Declined - Marketplace Submission')
      .addFields({ name: '📝 Decline Reason', value: reason, inline: false });

    await submissionMessage.edit({
      embeds: [updatedEmbed],
      components: [] // Remove buttons
    });

    // Notify the submitter with reason
    try {
      const submitter = await client.users.fetch(submissionData.userId);
      const declineEmbed = new EmbedBuilder()
        .setColor('#FF0000')
        .setTitle('❌ Marketplace Submission Declined')
        .setDescription(`Your submission **"${submissionData.title}"** has been declined.`)
        .addFields({ name: '📝 Reason', value: reason })
        .setTimestamp();

      await submitter.send({ embeds: [declineEmbed] });
    } catch (e) {
      console.log('Could not DM user about decline:', e.message);
    }

    await interaction.editReply({
      content: `✅ Submission declined. Reason sent to <@${submissionData.userId}>.`
    });
  } catch (error) {
    console.error('Error processing decline reason:', error);
    await interaction.editReply({
      content: '❌ Failed to decline submission. Please try again.'
    });
  }
}

// Create Express server for Render's port requirement
const app = express();
const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => {
  res.json({
    status: 'online',
    bot: client.user?.tag || 'Starting...',
    guilds: client.guilds.cache.size,
    uptime: process.uptime()
  });
});

app.get('/health', (req, res) => {
  res.json({ status: 'healthy' });
});

app.listen(PORT, () => {
  console.log(`🌐 Web server listening on port ${PORT}`);
});

// Login to Discord
if (!process.env.DISCORD_TOKEN) {
  console.error('❌ Error: DISCORD_TOKEN environment variable is not set!');
  process.exit(1);
}

client.login(process.env.DISCORD_TOKEN);
