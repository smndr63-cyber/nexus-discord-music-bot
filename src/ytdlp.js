const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");
const https = require("https");

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
  return new Promise((resolve, reject) => {
    const encoded =
      encodeURIComponent(query);

    const url =
      `https://www.youtube.com/results?search_query=${encoded}`;

    console.log(
      `[YouTube] Aranıyor: ${query}`
    );

    const request =
      https.get(
        url,
        {
          headers: {
            "User-Agent":
              "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131.0.0.0 Safari/537.36"
          }
        },
        response => {
          let body = "";

          response.setEncoding(
            "utf8"
          );

          response.on(
            "data",
            chunk => {
              body += chunk;
            }
          );

          response.on(
            "end",
            () => {
              try {
                const match =
                  body.match(
                    /"videoId":"([^"]+)"/
                  );

                if (!match) {
                  return reject(
                    new Error(
                      `YouTube'da sonuç bulunamadı: ${query}`
                    )
                  );
                }

                const videoId =
                  match[1];

                const videoUrl =
                  `https://www.youtube.com/watch?v=${videoId}`;

                console.log(
                  `[YouTube] Bulundu: ${videoUrl}`
                );

                resolve({
                  title: query,
                  url: videoUrl,
                  duration: 0,
                  thumbnail:
                    `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`
                });
              } catch (error) {
                reject(error);
              }
            }
          );
        }
      );

    request.on(
      "error",
      error => {
        reject(error);
      }
    );

    request.setTimeout(
      10000,
      () => {
        request.destroy();

        reject(
          new Error(
            "YouTube araması zaman aşımına uğradı."
          )
        );
      }
    );
  });
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