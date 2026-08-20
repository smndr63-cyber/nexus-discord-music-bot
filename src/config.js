require("dotenv").config();

function required(name) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} .env içinde tanımlı değil.`);
  return value;
}

module.exports = {
  token: process.env.DISCORD_TOKEN,
  clientId: process.env.DISCORD_CLIENT_ID,
  guildId: process.env.DISCORD_GUILD_ID || "",

  spotifyClientId: process.env.SPOTIFY_CLIENT_ID || "",
  spotifyClientSecret: process.env.SPOTIFY_CLIENT_SECRET || "",

  defaultVolume: Math.max(
    0,
    Math.min(100, Number(process.env.DEFAULT_VOLUME || 80))
  ),

  maxQueueSize: Math.max(
    1,
    Number(process.env.MAX_QUEUE_SIZE || 100)
  )
};