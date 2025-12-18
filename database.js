const { createClient } = require('@libsql/client');

// Turso credentials from environment variables
const tursoUrl = process.env.TURSO_DATABASE_URL;
const tursoToken = process.env.TURSO_AUTH_TOKEN;

if (!tursoUrl || !tursoToken) {
  console.error('❌ Missing TURSO_DATABASE_URL or TURSO_AUTH_TOKEN environment variables!');
  console.error('Please add them in Render dashboard.');
  process.exit(1);
}

console.log('📊 Connecting to Turso database...');
console.log('Database URL:', tursoUrl);

// Create Turso client
const db = createClient({
  url: tursoUrl,
  authToken: tursoToken
});

console.log('✅ Turso client initialized');

// Initialize database tables
async function initDatabase() {
  try {
    // Create points table
    await db.execute(`
      CREATE TABLE IF NOT EXISTS points (
        user_id TEXT PRIMARY KEY,
        points INTEGER DEFAULT 0
      )
    `);

    // Create marketplace_config table
    await db.execute(`
      CREATE TABLE IF NOT EXISTS marketplace_config (
        guild_id TEXT PRIMARY KEY,
        marketplace_channel_id TEXT NOT NULL,
        submissions_channel_id TEXT NOT NULL
      )
    `);

    console.log('✅ Database tables ready');
  } catch (error) {
    console.error('❌ Error initializing database:', error);
    throw error;
  }
}

// Initialize on startup
initDatabase().catch(console.error);

// Points functions
async function getPoints(userId) {
  try {
    const result = await db.execute({
      sql: 'SELECT points FROM points WHERE user_id = ?',
      args: [userId]
    });

    if (result.rows.length === 0) {
      return 0;
    }

    return result.rows[0].points;
  } catch (error) {
    console.error('Error getting points:', error);
    return 0;
  }
}

async function setPoints(userId, points) {
  try {
    await db.execute({
      sql: `INSERT INTO points (user_id, points) VALUES (?, ?)
            ON CONFLICT(user_id) DO UPDATE SET points = excluded.points`,
      args: [userId, points]
    });
  } catch (error) {
    console.error('Error setting points:', error);
    throw error;
  }
}

async function getAllPoints() {
  try {
    const result = await db.execute('SELECT user_id, points FROM points ORDER BY points DESC');
    return result.rows;
  } catch (error) {
    console.error('Error getting all points:', error);
    return [];
  }
}

async function resetPoints(userId = null) {
  try {
    if (userId) {
      await db.execute({
        sql: 'UPDATE points SET points = 0 WHERE user_id = ?',
        args: [userId]
      });
    } else {
      await db.execute('DELETE FROM points');
    }
  } catch (error) {
    console.error('Error resetting points:', error);
    throw error;
  }
}

// Marketplace config functions
async function getMarketplaceConfig(guildId) {
  try {
    const result = await db.execute({
      sql: 'SELECT * FROM marketplace_config WHERE guild_id = ?',
      args: [guildId]
    });

    if (result.rows.length === 0) {
      return null;
    }

    return result.rows[0];
  } catch (error) {
    console.error('Error getting marketplace config:', error);
    return null;
  }
}

async function setMarketplaceConfig(guildId, marketplaceChannelId, submissionsChannelId) {
  try {
    await db.execute({
      sql: `INSERT INTO marketplace_config (guild_id, marketplace_channel_id, submissions_channel_id)
            VALUES (?, ?, ?)
            ON CONFLICT(guild_id) DO UPDATE SET 
              marketplace_channel_id = excluded.marketplace_channel_id,
              submissions_channel_id = excluded.submissions_channel_id`,
      args: [guildId, marketplaceChannelId, submissionsChannelId]
    });
  } catch (error) {
    console.error('Error setting marketplace config:', error);
    throw error;
  }
}

async function getAllMarketplaceConfigs() {
  try {
    const result = await db.execute('SELECT * FROM marketplace_config');
    return result.rows;
  } catch (error) {
    console.error('Error getting all marketplace configs:', error);
    return [];
  }
}

module.exports = {
  db,
  getPoints,
  setPoints,
  getAllPoints,
  resetPoints,
  getMarketplaceConfig,
  setMarketplaceConfig,
  getAllMarketplaceConfigs
};
