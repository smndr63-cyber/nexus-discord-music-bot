const { SlashCommandBuilder } = require("discord.js");

module.exports = [
  new SlashCommandBuilder()
    .setName("play").setDescription("Şarkı adı veya YouTube/Spotify linki çalar.")
    .addStringOption(o => o.setName("query").setDescription("Şarkı adı veya URL").setRequired(true)),
  new SlashCommandBuilder().setName("skip").setDescription("Çalan şarkıyı atlar."),
  new SlashCommandBuilder().setName("pause").setDescription("Müziği duraklatır."),
  new SlashCommandBuilder().setName("resume").setDescription("Müziği devam ettirir."),
  new SlashCommandBuilder().setName("stop").setDescription("Müziği durdurur ve kuyruğu temizler."),
  new SlashCommandBuilder().setName("queue").setDescription("Müzik kuyruğunu gösterir."),
  new SlashCommandBuilder().setName("nowplaying").setDescription("Çalan şarkıyı gösterir."),
  new SlashCommandBuilder().setName("volume").setDescription("Ses seviyesini ayarlar.")
    .addIntegerOption(o => o.setName("level").setDescription("0-100").setMinValue(0).setMaxValue(100).setRequired(true)),
  new SlashCommandBuilder().setName("loop").setDescription("Tekrar modunu değiştirir.")
    .addStringOption(o => o.setName("mode").setDescription("Tekrar modu").setRequired(true)
      .addChoices({name:"Kapalı",value:"off"},{name:"Şarkı",value:"track"},{name:"Kuyruk",value:"queue"})),
  new SlashCommandBuilder().setName("shuffle").setDescription("Kuyruğu karıştırır."),
  new SlashCommandBuilder().setName("remove").setDescription("Kuyruktan bir parçayı siler.")
    .addIntegerOption(o => o.setName("position").setDescription("Kuyruktaki sıra numarası").setMinValue(1).setRequired(true)),
  new SlashCommandBuilder().setName("clear").setDescription("Kuyruğu temizler."),
  new SlashCommandBuilder().setName("leave").setDescription("Botu ses kanalından çıkarır.")
].map(c => c.toJSON());
