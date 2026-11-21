// Gözlük YouTube ayarları. Sadece bu dosyayı düzenlemen yeterli.
export const CONFIG = {
  // YouTube Data API v3 anahtarı (isteğe bağlı).
  // Boş bırakırsan arama ve "Trend" kapalı olur; aşağıdaki listeler yine çalışır.
  // Anahtarı Google Cloud Console'da "HTTP referrer" ile kendi sitene kısıtla.
  apiKey: '',

  // Trend videolar için ülke kodu.
  region: 'TR',

  // Ana ekrandaki listeler.
  //   videos: YouTube video ID'leri (youtube.com/watch?v=BURASI)
  //   playlistId: YouTube oynatma listesi ID'si (youtube.com/playlist?list=BURASI)
  lists: [
    { title: 'Gözlük listem', playlistId: 'PLTbMbPPqOe2g' },
    {
      title: 'Örnek videolar',
      videos: ['aqz-KE-bpKQ', 'eRsGyueVLvQ', 'R6MlUcmOul8', 'WhWc3b3KhnY', 'jNQXAC9IVRw'],
    },
    // { title: 'Müzik listem', playlistId: 'PLxxxxxxxxxxxxxxxx' },
  ],
};
