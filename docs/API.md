# Nexus Market API (Nexus Worker · `/api/shop/*`)

Market arayüzü (bu depo) statiktir; arka uç **forevye-nexus** Worker'ındadır. Fiyat, stok, sahiplik, bakiye ve perk yalnızca sunucuda doğrulanır.
Giriş: Nexus → **İşlemler → Nexus Market** tek kullanımlık bilet üretir (`POST /api/shop/ticket`, Nexus oturumu); bu site `#t=<bilet>` ile açılır, `POST /api/shop/exchange` ile jeton alır
(30 dk kayan, en çok 8 saat). Jeton yalnızca `/api/shop/*` uçlarında geçerlidir. CORS yalnızca Nexus `SHOP_URL` kaynağına açıktır.

| Metot | Yol | Açıklama |
|---|---|---|
| POST | /exchange | `{ticket}` → `{token, user}` |
| GET | /me | `{balance, entitlements[], wishlist[], cards[], perks, limits}` (kartlar tasarım + takılı yüzeyle) |
| GET | /products | Satıştaki ürünler: `id, kind(design/function), rarity, name, tagline, desc, price(minor), stock_total, stock_left, max_qty, skin, perks, is_new` |
| GET | /product?id= | Tek ürün |
| POST | /purchase | `{pid, idem}`. Bakiye düşümü + defter + stok + seri no + sahiplik **tek atomik işlem**. Aynı `idem` çift ücret oluşturmaz |
| POST | /wishlist | `{pid}` aç/kapat (sahip olunan ürün için 409) |
| POST | /equip | `{card_id, product_id}` kart yüzeyi tak; `product_id: null` çıkar |
| GET | /purchases?page&size | Satın alma geçmişi |

Satın alma sonuçları (HTTP 200, `ok:false`): `insufficient (missing), already_owned, sold_out, unavailable`.

## Ürün türleri
- **Tasarım kartı (`design`)**: editörde bulunmayan premium kart yüzeyi (skin). Sınırlı seriler numaralanır (`No. 007/100`).
- **Fonksiyonel kart (`function`)**: gerçek banka avantajı verir (en iyisi geçerli; kart hakları adetle toplanır): günlük/işlem başına transfer limiti çarpanı, kristal borsası alış-satış farkı indirimi, ek kart hakkı. İsteğe bağlı kart yüzeyi de içerebilir.

## Yönetim (Nexus)
`GET/POST /api/admin/shop/products` (yazma: süper yönetici, denetim kaydı). İade (`/api/internal/refund` veya yönetici ters kaydı) hakkı ve perk'i geri alır, yüzeyi kartlardan çıkarır.
