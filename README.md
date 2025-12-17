# Discord Bot - Points System & Marketplace

A comprehensive Discord bot with a points/kudos system and a marketplace feature for community trading.

## Features

### 🎯 Points System
- **Award Points**: Staff can award points to helpful members
- **Check Balance**: View your or someone else's points
- **Leaderboard**: See top 10 users with the most points
- **Reset Points**: Admins can reset individual or all user points

### 🛍️ Marketplace System
- **Submit Listings**: Users can submit items/services via a form
- **Approval System**: Staff review submissions before posting
- **Auto-Post**: Approved listings automatically post to marketplace
- **DM Notifications**: Users get notified of approval/decline status

## Setup Instructions

### 1. Prerequisites
- Node.js (v16.9.0 or higher)
- A Discord Bot Token
- Discord Application ID

### 2. Installation

```bash
npm install discord.js
```

### 3. Environment Variables

Create a `.env` file or set these environment variables:

```env
DISCORD_TOKEN=your_bot_token_here
DISCORD_CLIENT_ID=your_application_id_here
```

### 4. Deploy Commands

Run this once to register all slash commands:

```bash
node deploy-commands.js
```

### 5. Start the Bot

```bash
node index.js
```

## Commands

### Points Commands

- `/good @user` - Award +1 point to a user (Requires: Coaches/Moderators role or Administrator)
- `/balance [@user]` - Check point balance (defaults to yourself)
- `/leaderboard` - View top 10 users with most points
- `/reset [@user]` - Reset points for a user or all users (Requires: Manage Server)

### Marketplace Commands

- `/marketplace-setup #marketplace-channel #submissions-channel` - Configure the marketplace system (Requires: Administrator)
- `/marketplace-post [#channel]` - Post the marketplace submission button (Requires: Administrator)

## Marketplace Workflow

### For Users:
1. Click the "Submit to Marketplace" button
2. Fill out the form with:
   - Title (e.g., "Gaming PC For Sale")
   - Description (detailed info)
   - Price (e.g., "$500" or "100 points")
   - Contact info (how to reach you)
   - Image URL (optional)
3. Submit and wait for approval

### For Staff:
1. Check the submissions channel for new submissions
2. Review the listing details
3. Click "✅ Approve" to post it to marketplace
4. Or click "❌ Decline" to reject it
5. User gets a DM notification either way

## Configuration

### Points System Roles
Edit these roles in `index.js` at line 112:
```javascript
const ALLOWED_ROLES = ['Coaches', 'Moderators'];
```

### Permissions
- **Award Points**: Coaches, Moderators, or Administrator
- **Reset Points**: Manage Server permission
- **Marketplace Setup**: Administrator permission
- **Approve/Decline Submissions**: Administrator or Manage Server

## File Structure

```
├── index.js                    # Main bot code
├── deploy-commands.js          # Command registration
├── points.json                 # Points data (auto-created)
├── marketplace-config.json     # Marketplace settings (auto-created)
└── README.md                   # This file
```

## Form Fields

The marketplace submission form includes:
1. **Title** (max 100 chars) - Short, catchy title
2. **Description** (max 1000 chars) - Detailed information
3. **Price** (max 50 chars) - Price or payment method
4. **Contact** (max 200 chars) - How buyers can reach you
5. **Image URL** (max 500 chars, optional) - Product/service image

## Features in Detail

### Marketplace Listings
When approved, listings are posted with:
- ✅ Title and description
- 💰 Price clearly displayed
- 📞 Contact information
- 🖼️ Image (if provided)
- 👤 Seller's username
- ⏰ Timestamp

### Approval System
- Submissions appear in the review channel
- Staff can approve or decline with one click
- Original submitter gets a DM notification
- Approved posts go live immediately
- Declined submissions are marked but kept for reference

### Data Persistence
- Points are saved to `points.json`
- Marketplace config saved to `marketplace-config.json`
- Atomic file writes prevent data corruption
- Survives bot restarts

## Troubleshooting

### Commands not appearing
- Wait up to 1 hour for global commands to sync
- Or use guild-specific commands (modify deploy script)

### Bot can't send messages
- Check bot has "Send Messages" permission in target channels
- Verify bot role is above target channels in server settings

### Marketplace not working
- Run `/marketplace-setup` first
- Ensure bot can read/write to both channels
- Check bot has "Embed Links" permission

### Users not receiving DMs
- User might have DMs disabled
- This is normal - check the logs for "Could not DM user"

## Support

For issues or questions:
1. Check bot console logs for errors
2. Verify all permissions are set correctly
3. Ensure environment variables are configured
4. Review channel settings in `/marketplace-setup`

## License

MIT License - Feel free to modify and use for your server!
