# FOREVYE NEXUS · NEXUS MARKET

Premium **tasarım kartları** ve gerçek avantaj sağlayan **fonksiyonel kartlar** satan mağaza arayüzü. Statik HTML/CSS/JS, derleme yok. Arka uç Nexus Worker'dadır (`/api/shop/*`, bkz. `docs/API.md`); mock/localStorage taklidi **yoktur**.

## Ne satılır
- **Tasarım kartları:** kart editöründe bulunmayan yüzeyler (Oniks, Karbon, Aurora, Nebula, Prizma, Altın Gilyoş…). Sınırlı seriler numaralıdır.
- **Fonksiyonel kartlar:** Titanyum (limitler ×2), Platin (borsa farkı −%60, +1 kart), Nexus Black (limitler ×3, fark −%90, +2 kart; 50 adet), Ek Kart Hakkı. Avantajlar Nexus'ta sunucuda uygulanır.
- Ürün önizlemesi **kendi kartının** üzerinde çizilir; satın alınca Market'ten veya Nexus kart ekranından karta uygulanır.

## Kurulum
1. `js/config.js` → `API_BASE` ve `NEXUS_URL`: Nexus Worker'ın gerçek adresi.
2. Nexus `wrangler.toml` → `SHOP_URL`: bu sitenin adresi (CORS yalnızca bu kaynağa açılır), örn. `https://mhaforevye.github.io/nexus-market/`.
3. Nexus'ta `npm run db:migrate:remote` (0007_shop.sql; uygulanmazsa tablolar ilk çağrıda kendiliğinden kurulur).
4. GitHub Pages: Settings → Pages → Branch `main` / root.

## Notlar
- `js/card-rules.js`, `card-skins.js`, `card-render.js`, `qrcode.js` Nexus'taki dosyalarla **birebir aynıdır** (`forevye-nexus/shared` + `public/js`); Nexus'ta değişince buraya kopyalayın.
- Bu depodaki eski `wrangler.toml` (Mikro-Klima Worker ayarı) ve `data/products.json` (mock katalog) artık kullanılmaz; silinmelidir.
