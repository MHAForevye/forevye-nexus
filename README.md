# FOREVYE NEXUS (v1.0)

Sanal oyun ekonomisi için mobil öncelikli, bankacılık-benzeri web uygulaması (PWA benzeri SPA).
**Gerçek para, gerçek banka veya ödeme kuruluşu yoktur.** Bakiye, kartlar ve işlemler yalnızca oyun içi sanal öğelerdir.

Yığın: Cloudflare Workers + D1 (SQLite) + R2 (profil fotoğrafı) + statik arayüz (bağımlılıksız, vanilla JS).

## Kurulum
    npm install
    cp .dev.vars.example .dev.vars
    npx wrangler d1 create forevye-nexus        # çıkan database_id'yi wrangler.toml'a yazın
    npx wrangler r2 bucket create forevye-nexus-avatars
    npm run db:migrate:local
    npm run dev                                  # http://localhost:8787
Üretim: `npm run db:migrate:remote`, sırlar için `wrangler secret put RESEND_API_KEY|CODE_PEPPER|INTERNAL_API_KEY|GIFTCARD_API_SECRET`,
`GIFTCARD_API_URL` için de secret/var, ardından `npm run deploy`. `EMAIL_FROM` alan adınızı doğrulatın (Resend).
İlk süper yönetici: kayıt olup `scripts/make-superadmin.sql` çalıştırın. Yönetim paneli: `/admin.html`.
Test için ayrı ortam: `wrangler.toml` içindeki `[env.staging]` (ayrı D1/R2).

## Testler
    npm test        # Node 22+; gerçek şemayı node:sqlite üzerinde çalıştırır (18 test)

## Şartnameden uygulananlar
Kayıt (e-posta kodu doğrulama), giriş, şifre sıfırlama, oturum yönetimi; Ana Sayfa / İşlemler / Kartlarım / Profil;
kullanıcı adı kuralları (3-20 karakter, benzersiz, ilk 48 saatte 2 hak, sonra her değişimden 15 gün, geçmiş kaydı, eski ad 30 gün ayrılır);
kart adı ≠ kullanıcı adı; kullanıcı adıyla transfer (atomik, idempotent, değiştirilemez defter, günlük/işlem limiti, yüksek tutarda şifre yeniden doğrulama);
çoklu sanal kart + SVG kart editörü (korunan alanlar, sürüm geçmişi, şablonlar); bildirim merkezi; duyurular; Nexus Vault (rozet/tema/kayıtlı tasarım);
yönetici paneli (kullanıcı ara, askı, duyuru, şablon, rol, ters kayıt/düzeltme, değiştirilemez denetim kaydı); hediye kartı ve oyun içi alışveriş için entegrasyon uçları.

## Varsayımlar ve bilinen eksikler (dürüst liste)
- Para birimi adı "FN" geçici; limitler `wrangler.toml` [vars] içinde ayarlanabilir (varsayılan: işlem 5.000, günlük 15.000, şifre eşiği 1.000).
- **Hediye kartı ZIP'i incelenmedi**; bağdaştırıcı önerilen sözleşmeyle yazıldı (bkz. docs/INTEGRATION_NOTES.md).
- Resmî logo yok; yer tutucu SVG. Yalnızca Türkçe arayüz.
- Gerçek Cloudflare D1/R2/Resend üzerinde ve gerçek tarayıcıda test edilmedi; testler D1'i node:sqlite ile taklit eder. İlk dağıtımda duman testi yapın.
- Tarayıcı içi çevrimdışı kuyruk yok (yalnızca çevrimdışı uyarısı); push bildirimi yok (uygulama içi bildirim var).
- Profil fotoğrafı: PNG/JPEG/WebP, ≤512 KB, dosya imzası sunucuda doğrulanır; yeniden boyutlandırma yok.
- Rate limit sayaçları D1'de tutulur (basit, tek-bölge uygunluğu); yoğun saldırı için Cloudflare WAF/Turnstile eklenmesi önerilir.
- Parola özeti PBKDF2-SHA256 100k tur (Workers sınırı); ileride Argon2 destekli servise geçilebilir.
- Sunucu tarafı ödül/rozet yalnızca tanımlı 5 rozeti kapsar.
