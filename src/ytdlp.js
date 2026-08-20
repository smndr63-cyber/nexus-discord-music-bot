const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");

const YTDlpWrap =
  require("yt-dlp-wrap").default || require("yt-dlp-wrap");

const ffmpegPath = require("ffmpeg-static");

const binDir = path.join(__dirname, "..", "data");

const ytDlpPath = path.join(
  binDir,
  process.platform === "win32"
    ? "yt-dlp.exe"
    : "yt-dlp"
);

let yt = null;


// =====================================================
// INIT
// =====================================================

async function init() {

  fs.mkdirSync(
    binDir,
    { recursive: true }
  );

  if (!fs.existsSync(ytDlpPath)) {

    console.log(
      "yt-dlp indiriliyor..."
    );

    await YTDlpWrap.downloadFromGithub(
      ytDlpPath
    );
  }

  yt =
    new YTDlpWrap(
      ytDlpPath
    );

  return yt;
}


// =====================================================
// ENSURE
// =====================================================

function ensure() {

  if (!yt) {

    throw new Error(
      "yt-dlp henüz hazır değil."
    );
  }

  return yt;
}


// =====================================================
// YOUTUBE ARAMA
// =====================================================

async function search(query) {
  const y = ensure();

  console.log(`[yt-dlp] YouTube aranıyor: ${query}`);

  const out = await y.execPromise([
    `ytsearch1:${query}`,
    "--dump-single-json",
    "--flat-playlist",
    "--no-warnings",
    "--skip-download",
    "--extractor-args",
    "youtube:player_client=android"
  ]);

  const data = JSON.parse(out);
  const v = data.entries?.[0];

  if (!v) {
    throw new Error(
      `YouTube'da sonuç bulunamadı: ${query}`
    );
  }

  const url =
    v.webpage_url ||
    v.original_url ||
    (v.id
      ? `https://www.youtube.com/watch?v=${v.id}`
      : null);

  if (!url) {
    throw new Error(
      `YouTube sonucu için URL alınamadı: ${query}`
    );
  }

  console.log(
    `[yt-dlp] Bulundu: ${v.title || query}`
  );

  return {
    title: v.title || query,
    url,
    duration: Number(v.duration || 0),
    thumbnail: v.thumbnail || null
  };
}


// =====================================================
// YOUTUBE VIDEO URL
// =====================================================

async function resolveVideo(url) {

  const y =
    ensure();

  console.log(
    `[yt-dlp] YouTube linki analiz ediliyor: ${url}`
  );

  const out =
    await y.execPromise([

      url,

      "--dump-single-json",

      "--no-playlist",
      "--no-warnings",
      "--skip-download"
    ]);

  const data =
    JSON.parse(out);

  if (!data.id) {

    throw new Error(
      "YouTube videosu çözümlenemedi."
    );
  }

  return {

    title:
      data.title ||
      "YouTube",

    url:
      data.webpage_url ||
      `https://www.youtube.com/watch?v=${data.id}`,

    duration:
      Number(
        data.duration || 0
      ),

    thumbnail:
      data.thumbnail ||
      null
  };
}


// =====================================================
// YOUTUBE PLAYLIST
// =====================================================

async function resolvePlaylist(url) {

  const y =
    ensure();

  console.log(
    `[yt-dlp] YouTube playlist analiz ediliyor: ${url}`
  );

  const out =
    await y.execPromise([

      url,

      "--flat-playlist",

      "--dump-single-json",

      "--no-warnings",
      "--skip-download"
    ]);

  const data =
    JSON.parse(out);

  if (
    !data.entries ||
    !data.entries.length
  ) {

    throw new Error(
      "YouTube playlist boş veya çözümlenemedi."
    );
  }

  const results = [];

  for (
    const item of data.entries
  ) {

    if (!item) {
      continue;
    }

    const id =
      item.id;

    if (!id) {
      continue;
    }

    const videoUrl =
      item.webpage_url ||
      `https://www.youtube.com/watch?v=${id}`;

    results.push({

      title:
        item.title ||
        `YouTube Video ${id}`,

      url:
        videoUrl,

      duration:
        Number(
          item.duration || 0
        ),

      thumbnail:
        item.thumbnail ||
        null
    });
  }

  if (!results.length) {

    throw new Error(
      "YouTube playlist içerisinde oynatılabilir parça bulunamadı."
    );
  }

  console.log(
    `[yt-dlp] Playlist bulundu: ${results.length} parça`
  );

  return results;
}


// =====================================================
// URL TİPİ
// =====================================================

function isYouTubePlaylistUrl(url) {

  try {

    const parsed =
      new URL(url);

    const hostname =
      parsed.hostname
        .toLowerCase()
        .replace(
          /^www\./,
          ""
        );

    return (
      (
        hostname ===
          "youtube.com" ||
        hostname ===
          "m.youtube.com"
      ) &&
      parsed.pathname ===
        "/playlist" &&
      parsed.searchParams.has(
        "list"
      )
    );

  } catch {

    return false;
  }
}


function isYouTubeVideoUrl(url) {

  try {

    const parsed =
      new URL(url);

    const hostname =
      parsed.hostname
        .toLowerCase()
        .replace(
          /^www\./,
          ""
        );

    return (
      hostname ===
        "youtube.com" ||
      hostname ===
        "m.youtube.com" ||
      hostname ===
        "youtu.be"
    );

  } catch {

    return false;
  }
}


// =====================================================
// STREAM
// =====================================================

function stream(url) {

  const args = [

    url,

    "--no-playlist",
    "--no-warnings",
    "--quiet",

    "--js-runtimes",
    "node",

    "--remote-components",
    "ejs:npm",

    "--extractor-args",
    "youtube:player_client=android",

    "-f",
    "18",

    "-o",
    "-"
  ];

  console.log(
    `[yt-dlp] Stream başlatılıyor: ${url}`
  );

  console.log(
    `[yt-dlp] Format seçimi: 18`
  );

  const process =
    spawn(
      ytDlpPath,
      args,
      {
        stdio: [
          "ignore",
          "pipe",
          "pipe"
        ],

        windowsHide:
          true
      }
    );

  process.stderr.on(
    "data",
    data => {

      const text =
        data
          .toString()
          .trim();

      if (text) {

        console.error(
          `[yt-dlp] ${text}`
        );
      }
    }
  );

  process.on(
    "error",
    err => {

      console.error(
        "[yt-dlp] Process hatası:",
        err.message
      );
    }
  );

  process.on(
    "close",
    code => {

      console.log(
        `[yt-dlp] Process kapandı. Kod: ${code}`
      );
    }
  );

  return {

    stream:
      process.stdout,

    process
  };
}


// =====================================================
// EXPORT
// =====================================================

module.exports = {

  init,

  search,

  resolveVideo,

  resolvePlaylist,

  isYouTubePlaylistUrl,

  isYouTubeVideoUrl,

  stream,

  ffmpegPath
};