const {
  createAudioPlayer,
  createAudioResource,
  AudioPlayerStatus,
  NoSubscriberBehavior,
  StreamType
} = require("@discordjs/voice");

const {
  spawn
} = require("child_process");

const {
  ffmpegPath
} = require("./ytdlp");

const {
  defaultVolume,
  maxQueueSize
} = require("./config");


class GuildPlayer {

  constructor(guildId) {

    this.guildId =
      guildId;

    this.connection =
      null;

    this.queue =
      [];

    this.current =
      null;

    this.loop =
      "off";

    this.volume =
      defaultVolume / 100;

    this.playing =
      false;

    this.transitioning =
      false;

    this.generation =
      0;

    this.ytdlpProcess =
      null;

    this.ffmpegProcess =
      null;

    this.audioResource =
      null;


    this.player =
      createAudioPlayer({
        behaviors: {
          noSubscriber:
            NoSubscriberBehavior.Pause
        }
      });


    // =================================================
    // IDLE
    // =================================================

    this.player.on(
      AudioPlayerStatus.Idle,
      () => {

        if (
          this.transitioning
        ) {
          return;
        }

        if (
          !this.playing
        ) {
          return;
        }

        this.playing =
          false;

        this.next();
      }
    );


    // =================================================
    // PLAYER ERROR
    // =================================================

    this.player.on(
      "error",
      err => {

        console.error(
          `[${this.guildId}] Player error:`,
          err.message
        );

        this.playing =
          false;

        this.cleanupProcesses();

        if (
          !this.transitioning
        ) {
          this.next();
        }
      }
    );
  }


  // ===================================================
  // CONNECTION
  // ===================================================

  setConnection(
    connection
  ) {

    this.connection =
      connection;

    connection.subscribe(
      this.player
    );
  }


  // ===================================================
  // QUEUE
  // ===================================================

  add(items) {

    if (
      !Array.isArray(items) ||
      items.length === 0
    ) {
      return;
    }

    if (
      this.queue.length +
      items.length >
      maxQueueSize
    ) {
      throw new Error(
        `Kuyruk limiti ${maxQueueSize} parça.`
      );
    }

    this.queue.push(
      ...items
    );
  }


  // ===================================================
  // PROCESS CLEANUP
  // ===================================================

  cleanupProcesses() {

    const ffmpeg =
      this.ffmpegProcess;

    const ytdlp =
      this.ytdlpProcess;

    this.ffmpegProcess =
      null;

    this.ytdlpProcess =
      null;

    this.audioResource =
      null;


    // -------------------------------------------------
    // FFmpeg
    // -------------------------------------------------

    if (ffmpeg) {

      try {
        ffmpeg.stdin?.destroy();
      } catch {}

      try {
        ffmpeg.stdout?.destroy();
      } catch {}

      try {
        ffmpeg.stderr?.destroy();
      } catch {}

      try {

        if (
          !ffmpeg.killed
        ) {
          ffmpeg.kill();
        }

      } catch {}
    }


    // -------------------------------------------------
    // yt-dlp
    // -------------------------------------------------

    if (ytdlp) {

      try {
        ytdlp.stdout?.destroy();
      } catch {}

      try {
        ytdlp.stderr?.destroy();
      } catch {}

      try {

        if (
          !ytdlp.killed
        ) {
          ytdlp.kill();
        }

      } catch {}
    }
  }


  // ===================================================
  // PLAY ITEM
  // ===================================================

  async playItem(item) {

    this.transitioning =
      true;

    const generation =
      ++this.generation;


    /*
     * Eski process kesinlikle kapanmadan
     * yeni process'e geçiyoruz.
     */
    this.cleanupProcesses();


    this.current =
      item;


    console.log(
      `[${this.guildId}] Çalınıyor: ${item.title}`
    );


    const ytdlp =
      require("./ytdlp");


    const result =
      ytdlp.stream(
        item.url
      );


    if (
      !result ||
      !result.stream ||
      !result.process
    ) {
      throw new Error(
        "yt-dlp stream başlatılamadı."
      );
    }


    const inputStream =
      result.stream;

    const ytdlpProcess =
      result.process;


    this.ytdlpProcess =
      ytdlpProcess;


    // =================================================
    // YT-DLP STREAM ERROR
    // =================================================

    inputStream.on(
      "error",
      err => {

        if (
          generation !==
          this.generation
        ) {
          return;
        }

        /*
         * Process geçişlerinde oluşabilecek
         * normal kapanış hatalarını bastır.
         */

        if (
          err.code ===
            "ERR_STREAM_PREMATURE_CLOSE" ||
          err.code ===
            "ERR_STREAM_DESTROYED" ||
          err.code ===
            "EPIPE"
        ) {
          return;
        }

        console.error(
          `[${this.guildId}] yt-dlp stream hatası:`,
          err.message
        );
      }
    );


    // =================================================
    // FFMPEG
    // =================================================

    const ffmpeg =
      spawn(
        ffmpegPath,
        [
          "-hide_banner",

          "-loglevel",
          "error",

          "-i",
          "pipe:0",

          "-vn",

          "-f",
          "s16le",

          "-ar",
          "48000",

          "-ac",
          "2",

          "pipe:1"
        ],
        {
          stdio: [
            "pipe",
            "pipe",
            "pipe"
          ],

          windowsHide:
            true
        }
      );


    this.ffmpegProcess =
      ffmpeg;


    // =================================================
    // FFMPEG STDERR
    // =================================================

    ffmpeg.stderr.on(
      "data",
      data => {

        if (
          generation !==
          this.generation
        ) {
          return;
        }

        const text =
          data.toString().trim();

        if (!text) {
          return;
        }

        /*
         * FFmpeg'in "pipe closed" tarzı
         * geçiş hatalarını kullanıcıya hata
         * gibi göstermiyoruz.
         */

        if (
          text.includes(
            "Invalid data found"
          )
        ) {
          console.error(
            `[${this.guildId}] FFmpeg: ${text}`
          );

          return;
        }

        console.error(
          `[${this.guildId}] FFmpeg: ${text}`
        );
      }
    );


    // =================================================
    // FFMPEG ERROR
    // =================================================

    ffmpeg.on(
      "error",
      err => {

        if (
          generation !==
          this.generation
        ) {
          return;
        }

        console.error(
          `[${this.guildId}] FFmpeg process hatası:`,
          err.message
        );
      }
    );


    // =================================================
    // FFMPEG CLOSE
    // =================================================

    ffmpeg.on(
      "close",
      code => {

        if (
          generation !==
          this.generation
        ) {
          return;
        }

        console.log(
          `[${this.guildId}] FFmpeg kapandı. Kod: ${code}`
        );
      }
    );


    // =================================================
    // YT-DLP CLOSE
    // =================================================

    ytdlpProcess.on(
      "close",
      code => {

        if (
          generation !==
          this.generation
        ) {
          return;
        }

        /*
         * FFmpeg hâlâ okuyorsa yt-dlp'nin
         * kapanması her zaman hata değildir.
         */

        if (
          code !== 0 &&
          code !== null
        ) {
          console.error(
            `[${this.guildId}] yt-dlp beklenmeyen kodla kapandı: ${code}`
          );
        }
      }
    );


    // =================================================
    // PIPE
    // =================================================

    inputStream.pipe(
      ffmpeg.stdin
    );


    ffmpeg.stdin.on(
      "error",
      err => {

        if (
          err.code === "EPIPE" ||
          err.code ===
            "ERR_STREAM_DESTROYED"
        ) {
          return;
        }

        if (
          generation !==
          this.generation
        ) {
          return;
        }

        console.error(
          `[${this.guildId}] FFmpeg stdin hatası:`,
          err.message
        );
      }
    );


    // =================================================
    // AUDIO RESOURCE
    // =================================================

    const resource =
      createAudioResource(
        ffmpeg.stdout,
        {
          inputType:
            StreamType.Raw,

          inlineVolume:
            true
        }
      );


    this.audioResource =
      resource;


    resource.volume.setVolume(
      this.volume
    );


    this.playing =
      true;


    this.transitioning =
      false;


    this.player.play(
      resource
    );


    console.log(
      `[${this.guildId}] Discord audio player başlatıldı.`
    );
  }


  // ===================================================
  // NEXT
  // ===================================================

  async next() {

    if (
      this.transitioning
    ) {
      return;
    }


    this.transitioning =
      true;


    try {

      // ------------------------------------------------
      // İlk parça
      // ------------------------------------------------

      if (
        !this.current
      ) {

        const item =
          this.queue.shift();

        if (!item) {

          this.transitioning =
            false;

          return;
        }

        await this.playItem(
          item
        );

        return;
      }


      const finished =
        this.current;


      // ------------------------------------------------
      // Tek şarkı loop
      // ------------------------------------------------

      if (
        this.loop === "track"
      ) {

        await this.playItem(
          finished
        );

        return;
      }


      // ------------------------------------------------
      // Kuyruk loop
      // ------------------------------------------------

      if (
        this.loop === "queue"
      ) {
        this.queue.push(
          finished
        );
      }


      // ------------------------------------------------
      // Sonraki parça
      // ------------------------------------------------

      const item =
        this.queue.shift();


      if (!item) {

        this.current =
          null;

        this.playing =
          false;

        this.cleanupProcesses();

        this.transitioning =
          false;

        return;
      }


      await this.playItem(
        item
      );

    } catch (e) {

      console.error(
        `[${this.guildId}] Next error:`,
        e.message
      );

      this.cleanupProcesses();

      this.current =
        null;

      this.playing =
        false;

      this.transitioning =
        false;

      /*
       * Kuyrukta başka parça varsa devam etmeyi
       * dene.
       */

      if (
        this.queue.length > 0
      ) {
        setTimeout(
          () => this.next(),
          500
        );
      }
    }
  }


  // ===================================================
  // PAUSE
  // ===================================================

  pause() {
    return this.player.pause();
  }


  // ===================================================
  // RESUME
  // ===================================================

  resume() {
    return this.player.unpause();
  }


  // ===================================================
  // STOP
  // ===================================================

  stop() {

    this.transitioning =
      true;

    ++this.generation;

    this.playing =
      false;

    this.queue =
      [];

    this.current =
      null;


    this.player.stop(
      true
    );


    this.cleanupProcesses();

    this.transitioning =
      false;
  }


  // ===================================================
  // SKIP
  // ===================================================

  skip() {

    if (
      !this.current
    ) {
      return;
    }

    /*
     * Idle eventinin eski parçayı tekrar
     * başlatmasını engelliyoruz.
     */

    this.transitioning =
      true;

    ++this.generation;

    this.playing =
      false;


    this.player.stop(
      true
    );


    this.cleanupProcesses();


    this.transitioning =
      false;


    /*
     * Yeni parçayı doğrudan başlat.
     */

    setImmediate(
      () => this.next()
    );
  }


  // ===================================================
  // SHUFFLE
  // ===================================================

  shuffle() {

    for (
      let i =
        this.queue.length - 1;

      i > 0;

      i--
    ) {

      const j =
        Math.floor(
          Math.random() *
          (i + 1)
        );


      [
        this.queue[i],
        this.queue[j]
      ] = [
        this.queue[j],
        this.queue[i]
      ];
    }
  }


  // ===================================================
  // REMOVE
  // ===================================================

  remove(pos) {

    if (
      pos < 1 ||
      pos > this.queue.length
    ) {
      return null;
    }

    return this.queue.splice(
      pos - 1,
      1
    )[0];
  }
}


// =====================================================
// PLAYERS
// =====================================================

const players =
  new Map();


function getPlayer(id) {

  if (
    !players.has(id)
  ) {
    players.set(
      id,
      new GuildPlayer(id)
    );
  }

  return players.get(id);
}


function destroyPlayer(id) {

  const player =
    players.get(id);

  if (player) {
    player.stop();
  }

  players.delete(id);
}


module.exports = {
  getPlayer,
  destroyPlayer
};