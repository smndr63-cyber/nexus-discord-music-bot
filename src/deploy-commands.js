const { REST, Routes } = require("discord.js");
const { token, clientId, guildId } = require("./config");
const commands = require("./commands");

(async () => {
  const rest = new REST({ version: "10" }).setToken(token);
  if (guildId) {
    await rest.put(Routes.applicationGuildCommands(clientId, guildId), { body: commands });
    console.log(`Slash komutları ${guildId} sunucusuna yüklendi.`);
  } else {
    await rest.put(Routes.applicationCommands(clientId), { body: commands });
    console.log("Global slash komutları yüklendi. Yayılması biraz sürebilir.");
  }
})().catch(err => { console.error(err); process.exit(1); });
