# Nexus Discord Music Bot

Discord.js 14 tabanlı müzik botu. Şunları destekler:

- `/play <arama veya URL>` — YouTube araması, YouTube URL'si, Spotify parça/playlist URL'si
- YouTube playlist
- Spotify playlist (parçaları Spotify'dan alır, YouTube'da otomatik eşleştirir)
- `/skip`
- `/pause`
- `/resume`
- `/stop`
- `/queue`
- `/nowplaying`
- `/volume`
- `/loop`
- `/shuffle`
- `/remove`
- `/clear`
- `/leave`

## Gereksinimler

- Node.js 20+
- Discord bot uygulaması
- Spotify Developer uygulaması
- İnternete erişim
- Botun bağlanacağı sunucuda Connect / Speak izinleri

`yt-dlp` ve FFmpeg çalışma sırasında otomatik hazırlanır; sistem PATH'ine ayrıca kurmanız gerekmez.

## Kurulum

1. Bu klasörde terminal açın.
2. `npm install`
3. `.env.example` dosyasını `.env` olarak kopyalayın.
4. `.env` içindeki Discord ve Spotify bilgilerini doldurun.
5. `npm run deploy`
6. `npm start`

### Test sunucusu

`GUILD_ID` doldurursanız slash komutları yalnızca o sunucuya hızlı şekilde deploy edilir. Boş bırakırsanız global deploy yapılır; global komutların görünmesi zaman alabilir.

## Discord Developer Portal

Bot uygulamasında en az:
- bot token
- application client ID
- Guild Install / bot + applications.commands kapsamları

Bot izinlerinde ses kanalında:
- View Channel
- Connect
- Speak

## Spotify

Spotify Developer Dashboard'dan bir uygulama oluşturup Client ID ve Client Secret değerlerini `.env` içine koyun.

Spotify linkleri doğrudan Spotify ses akışı olarak kullanılmaz. Bot, Spotify'daki parça bilgisini alır ve YouTube'da aynı parçayı arayıp Discord'da bulunan ses kaynağını oynatır.

## Örnekler

`/play Blinding Lights The Weeknd`

`/play https://www.youtube.com/watch?v=...`

`/play https://open.spotify.com/track/...`

`/play https://open.spotify.com/playlist/...`

## Notlar

Bu proje eğitim/kişisel sunucu kullanımı için hazırlanmıştır. Üçüncü taraf servislerin kullanım şartlarına ve telif kurallarına uymanız gerekir.
