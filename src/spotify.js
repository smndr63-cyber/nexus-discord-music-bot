const https = require("https");


// =====================================================
// URL HELPERS
// =====================================================

function cleanUrl(input) {
  return String(input || "")
    .trim();
}


function parseSpotifyUrl(input) {
  const value =
    cleanUrl(input);

  if (!value) {
    return null;
  }

  try {
    const url =
      new URL(value);

    if (
      url.hostname !==
        "open.spotify.com" &&
      url.hostname !==
        "www.open.spotify.com"
    ) {
      return null;
    }

    const parts =
      url.pathname
        .split("/")
        .filter(Boolean);

    /*
     * Örnek:
     *
     * /intl-tr/track/XXXXXXXX
     *
     * /track/XXXXXXXX
     *
     * /intl-tr/playlist/XXXXXXXX
     */

    const typeIndex =
      parts.findIndex(
        part =>
          part === "track" ||
          part === "playlist" ||
          part === "album"
      );

    if (typeIndex === -1) {
      return null;
    }

    const type =
      parts[typeIndex];

    const id =
      parts[typeIndex + 1];

    if (!id) {
      return null;
    }

    return {
      type,
      id
    };
  } catch {
    return null;
  }
}


// =====================================================
// SPOTIFY URL CHECK
// =====================================================

function isSpotifyUrl(input) {
  return !!parseSpotifyUrl(input);
}


// =====================================================
// HTTPS GET
// =====================================================

function requestJson(url) {
  return new Promise(
    (resolve, reject) => {

      const req =
        https.get(
          url,
          {
            headers: {
              "User-Agent":
                "Mozilla/5.0"
            }
          },

          res => {

            let body = "";

            res.setEncoding(
              "utf8"
            );

            res.on(
              "data",
              chunk => {
                body += chunk;
              }
            );

            res.on(
              "end",
              () => {

                if (
                  res.statusCode < 200 ||
                  res.statusCode >= 300
                ) {
                  reject(
                    new Error(
                      `HTTP ${res.statusCode}`
                    )
                  );

                  return;
                }

                try {
                  resolve(
                    JSON.parse(body)
                  );
                } catch {
                  reject(
                    new Error(
                      "Spotify oEmbed JSON okunamadı."
                    )
                  );
                }
              }
            );
          }
        );

      req.on(
        "error",
        reject
      );

      req.setTimeout(
        15000,
        () => {
          req.destroy(
            new Error(
              "Spotify isteği zaman aşımına uğradı."
            )
          );
        }
      );
    }
  );
}


// =====================================================
// SPOTIFY OEMBED
// =====================================================

async function getOEmbed(input) {
  const encoded =
    encodeURIComponent(
      cleanUrl(input)
    );

  const endpoint =
    `https://open.spotify.com/oembed?url=${encoded}`;

  return requestJson(
    endpoint
  );
}


// =====================================================
// TITLE PARSING
// =====================================================

function parseTrackTitle(title) {
  const value =
    String(title || "")
      .trim();

  if (!value) {
    return {
      title: "Spotify parçası",
      search: ""
    };
  }

  /*
   * Spotify oEmbed çoğunlukla:
   *
   * "Şarkı Adı - Sanatçı"
   *
   * şeklinde title döndürür.
   *
   * Burada hem "-" hem "—" destekleniyor.
   */

  let name =
    value;

  let artist =
    "";

  const dash =
    value.indexOf(" - ");

  const longDash =
    value.indexOf(" — ");

  if (dash !== -1) {
    name =
      value
        .slice(0, dash)
        .trim();

    artist =
      value
        .slice(dash + 3)
        .trim();
  } else if (longDash !== -1) {
    name =
      value
        .slice(0, longDash)
        .trim();

    artist =
      value
        .slice(longDash + 3)
        .trim();
  }

  const search =
    artist
      ? `${name} ${artist}`
      : name;

  return {
    title:
      artist
        ? `${name} — ${artist}`
        : name,

    search
  };
}


// =====================================================
// TRACK
// =====================================================

async function resolveTrack(
  input,
  parsed
) {

  console.log(
    `[Spotify] track algılandı: ${parsed.id}`
  );

  let data;

  try {
    data =
      await getOEmbed(input);
  } catch (e) {
    console.error(
      `[Spotify] oEmbed hatası: ${e.message}`
    );

    /*
     * Spotify Web API'nin 2026 Development Mode
     * kısıtlamaları nedeniyle API 403 verebilir.
     *
     * Burada kullanıcıya ham WebapiError vermiyoruz.
     */
    throw new Error(
      "Spotify parça bilgisi alınamadı. Spotify bağlantısının herkese açık olduğundan emin ol."
    );
  }

  const parsedTitle =
    parseTrackTitle(
      data.title
    );

  if (!parsedTitle.search) {
    throw new Error(
      "Spotify parçasının adı alınamadı."
    );
  }

  console.log(
    `[Spotify] Bulundu: ${parsedTitle.title}`
  );

  return [
    {
      title:
        parsedTitle.title,

      requestedTitle:
        parsedTitle.title,

      search:
        parsedTitle.search,

      spotifyUrl:
        input,

      thumbnail:
        data.thumbnail_url ||
        null
    }
  ];
}


// =====================================================
// PLAYLIST
// =====================================================

async function resolvePlaylist(
  input,
  parsed
) {

  console.log(
    `[Spotify] playlist algılandı: ${parsed.id}`
  );

  /*
   * Spotify'ın güncel API değişiklikleri nedeniyle
   * playlist içeriği her public playlist için
   * güvenilir şekilde anonim alınamıyor.
   *
   * Bu nedenle burada playlist adını alıp
   * yanlışlıkla tek bir YouTube videosuna
   * çevirmiyoruz.
   */

  throw new Error(
    "Spotify playlist bağlantıları şu aşamada desteklenmiyor. Spotify tekli şarkı bağlantısı kullanabilirsin."
  );
}


// =====================================================
// ALBUM
// =====================================================

async function resolveAlbum(
  input,
  parsed
) {
  throw new Error(
    "Spotify albüm bağlantıları şu aşamada desteklenmiyor. Spotify tekli şarkı bağlantısı kullanabilirsin."
  );
}


// =====================================================
// MAIN RESOLVER
// =====================================================

async function resolve(input) {

  const parsed =
    parseSpotifyUrl(input);

  if (!parsed) {
    return null;
  }

  if (
    parsed.type === "track"
  ) {
    return resolveTrack(
      input,
      parsed
    );
  }

  if (
    parsed.type === "playlist"
  ) {
    return resolvePlaylist(
      input,
      parsed
    );
  }

  if (
    parsed.type === "album"
  ) {
    return resolveAlbum(
      input,
      parsed
    );
  }

  return null;
}


// =====================================================
// EXPORT
// =====================================================

module.exports = {
  resolve,
  isSpotifyUrl,
  parseSpotifyUrl
};