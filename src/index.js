const {
  Client,
  GatewayIntentBits,
  Events
} = require("discord.js");

const {
  joinVoiceChannel,
  getVoiceConnection
} = require("@discordjs/voice");

const {
  token
} = require("./config");

const {
  init: initYtdlp,
  search,
  resolveVideo,
  resolvePlaylist,
  isYouTubeVideoUrl
} = require("./ytdlp");

const {
  resolve: resolveSpotify,
  isSpotifyUrl
} = require("./spotify");

const {
  getPlayer,
  destroyPlayer
} = require("./player");


const client =
  new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildVoiceStates
    ]
  });


// =====================================================
// URL HELPERS
// =====================================================

function isHttpUrl(value) {
  return /^https?:\/\//i.test(
    String(value || "").trim()
  );
}


function isYouTubeUrl(value) {

  try {

    const url =
      new URL(
        String(value || "").trim()
      );

    return (
      url.hostname === "youtube.com" ||
      url.hostname === "www.youtube.com" ||
      url.hostname === "m.youtube.com" ||
      url.hostname === "youtu.be"
    );

  } catch {
    return false;
  }
}

function isYouTubePlaylist(value) {
  try {
    const url = new URL(
      String(value || "").trim()
    );

    const hostname = url.hostname.toLowerCase();

    const isYouTube =
      hostname === "youtube.com" ||
      hostname === "www.youtube.com" ||
      hostname === "m.youtube.com";

    if (!isYouTube) {
      return false;
    }

    return url.pathname === "/playlist" &&
      url.searchParams.has("list");

  } catch {
    return false;
  }
}


// =====================================================
// TIME
// =====================================================

function fmt(sec) {

  if (!sec) {
    return "canlı/uzun";
  }

  const h =
    Math.floor(
      sec / 3600
    );

  const m =
    Math.floor(
      (sec % 3600) / 60
    );

  const s =
    sec % 60;


  if (h) {

    return `${h}:${String(
      m
    ).padStart(2, "0")}:${String(
      s
    ).padStart(2, "0")}`;

  }


  return `${m}:${String(
    s
  ).padStart(2, "0")}`;
}


// =====================================================
// VOICE
// =====================================================

async function ensureVoice(
  interaction
) {

  const channel =
    interaction.member?.voice?.channel;


  if (!channel) {

    throw new Error(
      "Önce bir ses kanalına girmen gerekiyor."
    );
  }


  const existing =
    getVoiceConnection(
      interaction.guildId
    );


  if (
    existing &&
    existing.joinConfig.channelId !==
      channel.id
  ) {

    throw new Error(
      "Bot şu anda başka bir ses kanalında."
    );
  }


  const connection =
    existing ||
    joinVoiceChannel({
      channelId:
        channel.id,

      guildId:
        interaction.guildId,

      adapterCreator:
        interaction.guild
          .voiceAdapterCreator,

      selfDeaf:
        true
    });


  const player =
    getPlayer(
      interaction.guildId
    );


  player.setConnection(
    connection
  );


  return player;
}


// =====================================================
// SPOTIFY RESOLUTION
// =====================================================

async function resolveSpotifyQuery(
  query
) {

  console.log(
    `[Resolver] Spotify linki algılandı: ${query}`
  );


  const spotifyItems =
    await resolveSpotify(
      query
    );


  if (
    !spotifyItems ||
    spotifyItems.length === 0
  ) {

    throw new Error(
      "Spotify bağlantısından şarkı bilgisi alınamadı."
    );
  }


  const results =
    [];


  for (
    const item of spotifyItems
  ) {

    if (
      !item.search
    ) {
      continue;
    }


    console.log(
      `[Resolver] Spotify → YouTube aranıyor: ${item.search}`
    );


    const found =
      await searchYouTube(
        item.search
      );


    results.push({
      ...found,

      requestedTitle:
        item.title,

      spotifyUrl:
        item.spotifyUrl ||
        query
    });
  }


  if (
    results.length === 0
  ) {

    throw new Error(
      "Spotify şarkısı YouTube'da bulunamadı."
    );
  }


  return results;
}


// =====================================================
// QUERY RESOLUTION
// =====================================================

async function resolveQuery(query) {

  // ===================================================
  // SPOTIFY
  // ===================================================

  if (isSpotifyUrl(query)) {

    console.log(
      `[Resolver] Spotify linki algılandı: ${query}`
    );

    const spotifyItems =
      await resolveSpotifyUrl(query);

    if (
      !spotifyItems ||
      !spotifyItems.length
    ) {

      throw new Error(
        "Spotify bağlantısından parça bulunamadı."
      );
    }

    const results = [];

    for (
      const item of spotifyItems
    ) {

      console.log(
        `[Resolver] Spotify → YouTube aranıyor: ${item.title}`
      );

      const found =
        await search(
          item.search
        );

      results.push({

        ...found,

        requestedTitle:
          item.title
      });
    }

    return results;
  }


  // ===================================================
  // YOUTUBE URL
  // ===================================================

  if (isHttpUrl(query)) {

  console.log(
    `[Resolver] URL algılandı: ${query}`
  );

  // -------------------------------------------------
  // YOUTUBE PLAYLIST
  // -------------------------------------------------

  if (isYouTubePlaylist(query)) {

    console.log(
      `[Resolver] YouTube playlist algılandı.`
    );

    const playlist =
      await resolvePlaylist(
        query
      );

    console.log(
      `[Resolver] Playlist → ${playlist.length} parça bulundu.`
    );

    return playlist;
  }

  // -------------------------------------------------
  // YOUTUBE VIDEO
  // -------------------------------------------------

  if (isYouTubeUrl(query)) {

    if (isYouTubeVideoUrl(query)) {

      return [
        await resolveVideo(
          query
        )
      ];
    }
  }

  throw new Error(
    "Desteklenmeyen URL."
  );
}


  // ===================================================
  // NORMAL ARAMA
  // ===================================================

  console.log(
    `[Resolver] YouTube'da aranıyor: ${query}`
  );

  return [
    await search(query)
  ];
}


// =====================================================
// READY
// =====================================================

client.once(
  Events.ClientReady,
  async c => {

    console.log(
      `✓ ${c.user.tag} hazır.`
    );


    try {

      await initYtdlp();

      console.log(
        "✓ yt-dlp hazır."
      );

    } catch (e) {

      console.error(
        "yt-dlp hazırlanamadı:",
        e
      );

      process.exit(1);
    }
  }
);


// =====================================================
// INTERACTIONS
// =====================================================

client.on(
  Events.InteractionCreate,
  async interaction => {

    if (
      !interaction.isChatInputCommand()
    ) {
      return;
    }


    const guildId =
      interaction.guildId;


    try {

      const cmd =
        interaction.commandName;


      // =================================================
      // PLAY
      // =================================================

      if (
        cmd === "play"
      ) {

        await interaction.deferReply();


        const query =
          interaction.options.getString(
            "query",
            true
          );


        console.log(
          `[${guildId}] Play isteği: ${query}`
        );


        const player =
          await ensureVoice(
            interaction
          );


        const items =
          await resolveQuery(
            query
          );


        if (
          !items.length
        ) {

          throw new Error(
            "Çalınacak parça bulunamadı."
          );
        }


        const wasIdle =
          !player.current &&
          !player.playing;


        player.add(
          items
        );


        if (
          wasIdle
        ) {

          await player.next();
        }


        const first =
          items[0];


        const extra =
          items.length > 1
            ? ` ve ${items.length - 1} parça`
            : "";


        return interaction.editReply(
          `🎵 **${first.title}**${extra} kuyruğa eklendi.`
        );
      }


      // =================================================
      // PLAYER
      // =================================================

      const player =
        getPlayer(
          guildId
        );


      // -------------------------------------------------
      // Voice requirement
      // -------------------------------------------------

      if (
        cmd !== "queue" &&
        cmd !== "nowplaying" &&
        cmd !== "leave"
      ) {

        if (
          !interaction.member?.voice?.channel
        ) {

          throw new Error(
            "Bir ses kanalında olmalısın."
          );
        }
      }


      // =================================================
      // SKIP
      // =================================================

      if (
        cmd === "skip"
      ) {

        if (
          !player.current
        ) {
          return interaction.reply(
            "Şu anda çalan bir şarkı yok."
          );
        }


        player.skip();


        return interaction.reply(
          "⏭️ Şarkı atlandı."
        );
      }


      // =================================================
      // PAUSE
      // =================================================

      if (
        cmd === "pause"
      ) {

        player.pause();


        return interaction.reply(
          "⏸️ Duraklatıldı."
        );
      }


      // =================================================
      // RESUME
      // =================================================

      if (
        cmd === "resume"
      ) {

        player.resume();


        return interaction.reply(
          "▶️ Devam ediyor."
        );
      }


      // =================================================
      // STOP
      // =================================================

      if (
        cmd === "stop"
      ) {

        player.stop();


        return interaction.reply(
          "⏹️ Müzik durduruldu ve kuyruk temizlendi."
        );
      }


      // =================================================
      // SHUFFLE
      // =================================================

      if (
        cmd === "shuffle"
      ) {

        player.shuffle();


        return interaction.reply(
          "🔀 Kuyruk karıştırıldı."
        );
      }


      // =================================================
      // CLEAR
      // =================================================

      if (
        cmd === "clear"
      ) {

        player.queue =
          [];


        return interaction.reply(
          "🧹 Kuyruk temizlendi."
        );
      }


      // =================================================
      // REMOVE
      // =================================================

      if (
        cmd === "remove"
      ) {

        const pos =
          interaction.options.getInteger(
            "position",
            true
          );


        const removed =
          player.remove(
            pos
          );


        return interaction.reply(
          removed
            ? `🗑️ **${removed.title}** kuyruktan çıkarıldı.`
            : "Bu sırada parça yok."
        );
      }


      // =================================================
      // VOLUME
      // =================================================

      if (
        cmd === "volume"
      ) {

        const level =
          interaction.options.getInteger(
            "level",
            true
          );


        player.volume =
          level / 100;


        if (
          player.audioResource?.volume
        ) {

          player.audioResource.volume.setVolume(
            player.volume
          );
        }


        return interaction.reply(
          `🔊 Ses seviyesi **%${level}** olarak ayarlandı.`
        );
      }


      // =================================================
      // LOOP
      // =================================================

      if (
        cmd === "loop"
      ) {

        player.loop =
          interaction.options.getString(
            "mode",
            true
          );


        return interaction.reply(
          `🔁 Tekrar modu: **${player.loop}**`
        );
      }


      // =================================================
      // NOW PLAYING
      // =================================================

      if (
        cmd === "nowplaying"
      ) {

        if (
          !player.current
        ) {

          return interaction.reply(
            "Şu anda çalan bir şarkı yok."
          );
        }


        return interaction.reply(
          `🎶 Şu an: **${player.current.title}**`
        );
      }


      // =================================================
      // QUEUE
      // =================================================

      if (
        cmd === "queue"
      ) {

        const lines =
          [];


        if (
          player.current
        ) {

          lines.push(
            `▶️ **${player.current.title}**`
          );
        }


        player.queue
          .slice(0, 25)
          .forEach(
            (x, i) => {

              lines.push(
                `${i + 1}. ${x.title}`
              );
            }
          );


        return interaction.reply(
          lines.length
            ? lines.join("\n")
            : "Kuyruk boş."
        );
      }


      // =================================================
      // LEAVE
      // =================================================

      if (
        cmd === "leave"
      ) {

        const connection =
          getVoiceConnection(
            guildId
          );


        if (
          connection
        ) {
          connection.destroy();
        }


        destroyPlayer(
          guildId
        );


        return interaction.reply(
          "👋 Ses kanalından ayrıldım."
        );
      }

    } catch (e) {

      console.error(
        `[${guildId}] Hata:`,
        e
      );


      const msg =
        `❌ ${
          e.message ||
          "Bir hata oluştu."
        }`;


      if (
        interaction.deferred ||
        interaction.replied
      ) {

        interaction
          .editReply(msg)
          .catch(() => {});

      } else {

        interaction
          .reply(msg)
          .catch(() => {});
      }
    }
  }
);


// =====================================================
// GLOBAL ERROR
// =====================================================

process.on(
  "unhandledRejection",
  err => {
    console.error(
      "Unhandled rejection:",
      err
    );
  }
);


process.on(
  "uncaughtException",
  err => {
    console.error(
      "Uncaught exception:",
      err
    );
  }
);


// =====================================================
// LOGIN
// =====================================================

if (!token) {

  console.error(
    "DISCORD_TOKEN .env içinde bulunamadı."
  );

  process.exit(1);
}


client.login(
  token
);