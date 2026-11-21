# Gözlük YouTube

Meta Ray-Ban Display için YouTube web uygulaması. Düz HTML/CSS/JS ile yazıldı; derleme adımı yok.

## Kumandalar (Neural Band)

| Hareket | Liste ekranı | Oynatıcı |
|---|---|---|
| Sağa/sola kaydır | Düğmeler arasında gezin | ⏮ −10 ⏯ +10 ⏭ arasında gezin |
| Yukarı/aşağı kaydır | Listede gezin | Ses aç/kıs |
| Pinch (sıkıştırma) | Seç | Seçili düğmeyi bas |
| Sistem Geri | Önceki ekran | Listeye dön |

## Ayarlar: `config.js`

- `lists`: ana ekrandaki listeler. Video ID'leri veya oynatma listesi ID'si eklenir.
- `apiKey` (isteğe bağlı): **arama** ve **Trend** için YouTube Data API v3 anahtarı.
  1. https://console.cloud.google.com adresinde bir proje aç.
  2. "YouTube Data API v3"ü etkinleştir.
  3. Credentials → Create credentials → API key.
  4. Anahtarı **Application restrictions → Websites** ile kendi site adresine kısıtla.
  Günlük ücretsiz kota: yaklaşık 100 arama.

Arama kutusu seçilince gözlüğün el yazısı ve sesle yazma ekranı açılır.

## Bilgisayarda deneme

```powershell
python -m http.server 4173 --directory gozluk-youtube
```

Sonra http://localhost:4173 adresini aç. Yön tuşları = kaydırma, Enter = pinch, Escape = Geri.
Gözlük görünümü için Chrome'a "Meta Ray-Ban Display Simulator" eklentisini kur.

## Gözlüğe ekleme

1. Klasörü HTTPS bir adrese yükle (GitHub Pages, Vercel vb.).
2. Meta AI uygulaması → Settings → App Info → sürüm numarasına 5 kez dokun → Developer Mode'u aç.
3. Devices → Display Glasses settings → App connections → Web apps → **Add a web app**.
4. Ad olarak "YouTube" yaz ve HTTPS adresini gir.

## Notlar

- Videolar YouTube'un resmî gömülü oynatıcısıyla (youtube-nocookie) oynatılır. İndirme yapılmaz.
- Bazı videolar sahibi tarafından gömülü oynatmaya kapatılmıştır. Uygulama bunları atlar.
- Gözlük bağlantısı yaklaşık 500 Kbps. YouTube kaliteyi otomatik düşürür.
- Yürürken veya araç kullanırken video izleme.
