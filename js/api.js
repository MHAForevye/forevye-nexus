// Nexus Market istemcisi: Nexus Worker'ın /api/shop/* uçları. MOCK YOKTUR: bakiye, stok, sahiplik ve fiyat yalnızca sunucudadır.
// Giriş: Nexus'ta "Nexus Market" düğmesi tek kullanımlık bilet üretir ve bu sayfayı #t=<bilet> ile açar. Bilet bir kez jetona çevrilir,
// adres çubuğundan silinir; jeton yalnızca bu sekmede (sessionStorage) durur ve yalnızca /api/shop/* uçlarında geçerlidir.
(function () {
  'use strict';
  const C = Object.assign({ API_BASE: '', NEXUS_URL: '' }, window.NEXUS_MARKET_CONFIG || {});
  const TK = 'nexusmarket.tok', mem = {};
  const store = {
    get: (k) => { try { return sessionStorage.getItem(k); } catch (e) { return mem[k] || null; } },
    set: (k, v) => { try { sessionStorage.setItem(k, v); } catch (e) { mem[k] = v; } },
    del: (k) => { try { sessionStorage.removeItem(k); } catch (e) { delete mem[k]; } }
  };
  const base = () => C.API_BASE.replace(/\/+$/, '');
  let tok = store.get(TK) || null, bootErr = '';

  const boot = (async function takeTicket() {
    const m = /(?:^#|&)t=([A-Za-z0-9_-]{20,80})/.exec(location.hash);
    if (!m) return;
    history.replaceState(null, '', location.pathname + location.search + '#/');
    if (!base()) { bootErr = 'Market yapılandırılmamış (js/config.js → API_BASE).'; return; }
    try {
      const r = await fetch(base() + '/api/shop/exchange', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ticket: m[1] }) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok || !j.token) throw new Error((j.error && j.error.message) || 'Giriş tamamlanamadı.');
      tok = j.token; store.set(TK, tok);
    } catch (e) { bootErr = e.message || 'Giriş tamamlanamadı.'; }
  })();

  async function call(method, path, body) {
    if (!tok) throw new Error('AUTH');
    if (!base()) throw new Error('Market yapılandırılmamış (js/config.js → API_BASE).');
    const r = await fetch(base() + path, { method, headers: Object.assign({ Authorization: 'Bearer ' + tok }, body ? { 'Content-Type': 'application/json' } : {}), body: body ? JSON.stringify(body) : undefined });
    const j = await r.json().catch(() => ({}));
    if (r.status === 401) { tok = null; store.del(TK); throw new Error('AUTH'); }
    if (r.status === 429) throw new Error('RATE');
    if (!r.ok) { const e = new Error((j.error && j.error.message) || 'İşlem tamamlanamadı.'); e.code = j.error && j.error.code; throw e; }
    return j;
  }
  // Satın alma anahtarı: ağ hatasında aynı anahtarla yeniden denenir (çift ücret oluşmaz); kesin sonuçta silinir.
  const idemKey = (pid) => { const k = 'nexusmarket.idem.' + pid; let v = store.get(k); if (!v) { v = 'i' + Array.from(crypto.getRandomValues(new Uint8Array(12)), (x) => x.toString(36).padStart(2, '0')).join('').slice(0, 24); store.set(k, v); } return v; };

  window.API = {
    boot, bootError: () => bootErr, hasToken: () => !!tok, nexusUrl: () => C.NEXUS_URL.replace(/\/+$/, ''),
    me: () => call('GET', '/api/shop/me'),
    products: async () => (await call('GET', '/api/shop/products')).products,
    purchases: (page, size) => call('GET', '/api/shop/purchases?page=' + (page || 0) + '&size=' + (size || 8)),
    purchase: (pid) => call('POST', '/api/shop/purchase', { pid, idem: idemKey(pid) }),
    purchaseDone: (pid) => store.del('nexusmarket.idem.' + pid),
    wishlist: (pid) => call('POST', '/api/shop/wishlist', { pid }),
    equip: (cardId, pid) => call('POST', '/api/shop/equip', { card_id: cardId, product_id: pid }),
    logout() { tok = null; store.del(TK); }
  };
})();
