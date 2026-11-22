(function () {
  'use strict';
  const $ = (s) => document.querySelector(s), A = window.API, X = window.FNXRender, S = window.FNXSkins, app = $('#app');
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const fm = (m) => (m / 100).toLocaleString('tr-TR', { minimumFractionDigits: 0, maximumFractionDigits: 2 }) + ' FN';
  const fmtDate = (t) => new Date(t).toLocaleString('tr-TR', { dateStyle: 'medium', timeStyle: 'short' });
  const RARITY = { common: 'Yaygın', rare: 'Nadir', epic: 'Epik', legendary: 'Efsanevi', mythic: 'Mitik' }, RANK = { common: 0, rare: 1, epic: 2, legendary: 3, mythic: 4 };
  const KIND = { design: 'Tasarım kartı', function: 'Fonksiyonel kart' };
  const reduced = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  let ME = null, PRODUCTS = [], state = { q: '', kind: 'all', rarity: 'all', sort: 'feat', hideOwned: false }, pv = 0;

  const qtyOf = (id) => { const e = ME.entitlements.find((x) => x.product_id === id); return e ? e.qty : 0; };
  const entOf = (id) => ME.entitlements.find((x) => x.product_id === id);
  const maxed = (p) => qtyOf(p.id) >= p.max_qty;
  const wished = (id) => ME.wishlist.includes(id);
  const soldOut = (p) => p.stock_left === 0;

  function perkLines(pk) {
    if (!pk) return [];
    const o = [];
    if (pk.limit_mult > 1) o.push(`Günlük transfer limiti ×${pk.limit_mult}`);
    if (pk.transfer_mult > 1) o.push(`İşlem başına transfer limiti ×${pk.transfer_mult}`);
    if (pk.spread_discount_pct > 0) o.push(`Kristal borsasında alış/satış farkı −%${pk.spread_discount_pct}`);
    if (pk.extra_cards > 0) o.push(`+${pk.extra_cards} sanal kart hakkı`);
    return o;
  }
  const nextSerial = (p) => (p.stock_total ? `${String(p.stock_total - p.stock_left + 1).padStart(3, '0')}/${String(p.stock_total).padStart(3, '0')}` : '');

  // ---- Kart önizlemesi: kullanıcının kendi kartı üzerinde, ürünün kart yüzeyiyle ----
  function baseCard() {
    const c = ME.cards.find((x) => x.is_default) || ME.cards[0];
    if (c) return { design: c.design, name: c.display_name, token: c.card_token };
    const name = (ME.user.username || 'NEXUS').replace(/[^A-Za-z0-9 ]/g, ' ').toUpperCase().slice(0, 18).trim() || 'NEXUS';
    return { token: '', name, design: { designId: 'd', ownerId: 'o', template: 'classic', canvas: { width: 856, height: 540 }, userDisplayName: name, nameStyle: { color: 'auto' }, chipStyle: 'gold', version: 1,
      layers: [{ id: 'bg', type: 'background', name: 'z', locked: true, visible: true, zIndex: 0, properties: { mode: 'gradient', colors: ['#ECEEF5', '#C7CBD8'], angle: 135, finish: 'glossy' } }] } };
  }
  function previewSvg(p, animate) {
    if (!p.skin) { // Skin içermeyen ürün (ör. ek kart hakkı): kart destesi çizimi
      return `<svg class="card-svg" viewBox="0 0 856 540" role="img" aria-label="${esc(p.name)}"><rect width="856" height="540" rx="36" fill="#15171a"/>
        ${[0, 1, 2].map((i) => `<rect x="${170 + i * 30}" y="${120 - i * 26}" width="440" height="276" rx="26" fill="#1d2024" stroke="#c4c8ce" stroke-opacity="${0.35 + i * 0.25}" stroke-width="3"/>`).join('')}
        <text x="428" y="430" text-anchor="middle" font-size="86" font-weight="800" fill="#f4f5f7" font-family="Manrope, Segoe UI, sans-serif">+${p.perks && p.perks.extra_cards ? p.perks.extra_cards : 1}</text></svg>`;
    }
    const b = baseCard();
    return X.cardSvg(b.design, { last4: b.token ? b.token.slice(-4) : '••••', cardToken: b.token, skin: p.skin, skinSerial: nextSerial(p) }, { prefix: 'm' + (pv++), animate: animate && !reduced });
  }
  const fixBlend = (root) => root.querySelectorAll('[data-blend]').forEach((el) => { el.style.mixBlendMode = el.dataset.blend; });

  function toast(m, err) { const t = $('#toast'); t.textContent = m; t.className = 'toast show' + (err ? ' err' : ''); clearTimeout(toast.t); toast.t = setTimeout(() => (t.className = 'toast'), 3600); }
  function confirmBox(html, okLabel) {
    return new Promise((res) => {
      const m = $('#modal'), prev = document.activeElement; m.hidden = false;
      m.innerHTML = `<div class="dlg" role="dialog" aria-modal="true">${html}<div class="acts"><button class="btn ghost" data-x="0">Vazgeç</button><button class="btn" data-x="1">${okLabel}</button></div></div>`;
      const done = (v) => { m.hidden = true; m.innerHTML = ''; m.onkeydown = null; if (prev && prev.focus) prev.focus(); res(v); };
      m.onclick = (e) => { const x = e.target.dataset.x; if (x) done(x === '1'); else if (e.target === m) done(false); };
      m.onkeydown = (e) => { if (e.key === 'Escape') done(false); };
      m.querySelector("[data-x='1']").focus();
    });
  }
  const skeleton = (n = 6) => `<div class="grid">${'<div class="sk"></div>'.repeat(n)}</div>`;

  async function refreshMe() {
    ME = await A.me();
    $('#bal').innerHTML = `${esc(fm(ME.balance))} <small>bakiye</small>`;
  }

  function badges(p) {
    return [p.is_new ? '<span class="tag hl">Yeni</span>' : '', p.stock_total ? '<span class="tag ltd">Sınırlı</span>' : '', p.perks ? '<span class="tag fn">Avantajlı</span>' : ''].join('');
  }
  function action(p, big) {
    const cls = big ? 'btn big' : 'btn';
    if (maxed(p)) return `<span class="tag own">${p.max_qty > 1 ? 'En fazla adede ulaştın' : 'Zaten sende'}</span>`;
    if (soldOut(p)) return `<span class="tag">Tükendi</span>`;
    return `<button class="${cls}" data-buy="${esc(p.id)}">${p.max_qty > 1 && qtyOf(p.id) ? 'Bir tane daha al' : 'Satın al'}</button>`;
  }
  function tile(p) {
    const q = qtyOf(p.id);
    return `<article class="pcard r-${p.rarity}"><a class="pv" href="#/p/${esc(p.id)}" aria-label="${esc(p.name)} detayı">${previewSvg(p, false)}</a>
      <button class="heart" data-wish="${esc(p.id)}" aria-pressed="${wished(p.id)}" aria-label="İstek listesi: ${esc(p.name)}">${wished(p.id) ? '♥' : '♡'}</button>
      <div class="body"><div class="row"><span class="rar">${RARITY[p.rarity]}</span><span class="tags">${badges(p)}</span></div>
      <h3>${esc(p.name)}</h3><p>${esc(p.tagline)}</p>
      ${p.stock_total ? `<div class="stock"><i style="width:${Math.round((p.stock_left / p.stock_total) * 100)}%"></i></div><small class="mut">${p.stock_left === 0 ? 'Tükendi' : `${p.stock_left} / ${p.stock_total} kaldı`}</small>` : ''}
      <div class="row"><span class="price">${esc(fm(p.price))}</span>${q && p.max_qty === 1 ? '<span class="tag own">Sende</span>' : action(p)}</div></div></article>`;
  }

  const pages = {
    async home() {
      const list = PRODUCTS, ltd = list.filter((p) => p.stock_total && !soldOut(p)).sort((a, b) => RANK[b.rarity] - RANK[a.rarity]);
      const feat = ltd[0] || list[0];
      const fn = list.filter((p) => p.kind === 'function'), ds = list.filter((p) => p.kind === 'design');
      if (!feat) return '<div class="empty">Vitrin şu an boş.</div>';
      return `<section class="hero r-${feat.rarity}"><div class="hcopy"><span class="rar">${RARITY[feat.rarity]} · ${KIND[feat.kind]}</span><h1>${esc(feat.name)}</h1>
        <p class="lead">${esc(feat.desc)}</p>${perkLines(feat.perks).length ? `<ul class="perks">${perkLines(feat.perks).map((t) => `<li>${esc(t)}</li>`).join('')}</ul>` : ''}
        ${feat.stock_total ? `<p class="mut">Seri: ${feat.stock_total} adet · <b>${feat.stock_left}</b> kaldı</p>` : ''}
        <div class="row start"><span class="price big">${esc(fm(feat.price))}</span>${action(feat, true)}<a class="btn ghost" href="#/p/${esc(feat.id)}">Ayrıntılar</a></div></div>
        <a class="hprev" href="#/p/${esc(feat.id)}" aria-label="${esc(feat.name)}">${previewSvg(feat, true)}</a></section>
        <h2>Fonksiyonel kartlar <small>Gerçek avantaj sağlar</small></h2><div class="grid">${fn.map(tile).join('')}</div>
        <h2>Tasarım kartları <small>Editörde bulunmayan yüzeyler</small></h2><div class="grid">${ds.map(tile).join('')}</div>
        <p class="note">Market ürünleri oyun içi sanal öğelerdir; yalnızca FN bakiyesiyle alınır, gerçek para içermez. Satın alma sunucuda doğrulanır; stok ve fiyat Market'te sabittir.</p>`;
    },
    async browse() {
      let l = PRODUCTS.filter((p) => (state.kind === 'all' || p.kind === state.kind) && (state.rarity === 'all' || p.rarity === state.rarity) && (!state.hideOwned || !maxed(p)) && (p.name + ' ' + p.tagline).toLowerCase().includes(state.q.toLowerCase()));
      const so = { feat: (a, b) => 0, asc: (a, b) => a.price - b.price, desc: (a, b) => b.price - a.price, rar: (a, b) => RANK[b.rarity] - RANK[a.rarity] || b.price - a.price, name: (a, b) => a.name.localeCompare(b.name, 'tr') }[state.sort];
      l = l.slice().sort(so);
      const opt = (v, t, cur) => `<option value="${v}" ${cur === v ? 'selected' : ''}>${t}</option>`;
      return `<h1>Keşfet</h1><div class="bar"><input id="q" type="search" placeholder="Kart ara" value="${esc(state.q)}" aria-label="Kart ara">
        <select id="sort" aria-label="Sırala">${opt('feat', 'Öne çıkanlar', state.sort)}${opt('rar', 'Nadirlik', state.sort)}${opt('asc', 'Fiyat: düşükten yükseğe', state.sort)}${opt('desc', 'Fiyat: yüksekten düşüğe', state.sort)}${opt('name', 'Ada göre', state.sort)}</select>
        <select id="rar" aria-label="Nadirlik">${opt('all', 'Tüm seviyeler', state.rarity)}${Object.keys(RARITY).map((k) => opt(k, RARITY[k], state.rarity)).join('')}</select></div>
        <div class="chips">${[['all', 'Tümü'], ['design', 'Tasarım kartları'], ['function', 'Fonksiyonel kartlar']].map(([k, t]) => `<button class="chip" data-kind="${k}" aria-pressed="${state.kind === k}">${t}</button>`).join('')}
        <button class="chip" data-hide aria-pressed="${state.hideOwned}">Sahip olduklarımı gizle</button></div>
        ${l.length ? `<div class="grid">${l.map(tile).join('')}</div>` : '<div class="empty">Sonuç yok. Aramayı veya filtreyi değiştir.</div>'}`;
    },
    async product(id) {
      const p = PRODUCTS.find((x) => x.id === id);
      if (!p) return '<div class="empty">Ürün bulunamadı. <a href="#/browse">Keşfet\'e dön</a></div>';
      const pl = perkLines(p.perks), e = entOf(p.id);
      return `<p><a href="#/browse">‹ Keşfet</a></p><div class="detail r-${p.rarity}"><div class="dprev">${previewSvg(p, true)}<p class="mut small">${p.skin ? `Kartın bu yüzeyle böyle görünür${p.stock_total ? ` — sıradaki numara: <b>${esc(nextSerial(p))}</b>` : ''}.` : ''}</p></div>
        <div><div class="tags"><span class="rar">${RARITY[p.rarity]}</span><span class="tag">${KIND[p.kind]}</span>${badges(p)}</div>
        <h1>${esc(p.name)}</h1><p class="lead">${esc(p.desc)}</p>
        ${pl.length ? `<h3>Sağladığı avantajlar</h3><ul class="perks">${pl.map((t) => `<li>${esc(t)}</li>`).join('')}</ul>` : ''}
        <dl>${p.skin ? '<dt>Kart yüzeyi</dt><dd>Kartına uygulanır; kayıtlı tasarımın silinmez</dd>' : ''}<dt>Durum</dt><dd>${e ? (p.max_qty > 1 ? `${e.qty} / ${p.max_qty} adet sende` : 'Zaten sende') + (e.serial ? ` · No. ${esc(e.serial)}` : '') : 'Sahip değilsin'}</dd>
        ${p.stock_total ? `<dt>Stok</dt><dd>${p.stock_left} / ${p.stock_total} kaldı</dd>` : '<dt>Stok</dt><dd>Sınırsız</dd>'}<dt>Fiyat</dt><dd><b>${esc(fm(p.price))}</b></dd></dl>
        ${p.stock_total ? `<div class="stock"><i style="width:${Math.round((p.stock_left / p.stock_total) * 100)}%"></i></div>` : ''}
        <div class="row start">${action(p, true)}<button class="btn ghost" data-wish="${esc(p.id)}" aria-pressed="${wished(p.id)}">${wished(p.id) ? 'Listeden çıkar' : 'İstek listesine ekle'}</button></div>
        ${e && p.skin ? equipBox(p) : ''}</div></div>`;
    },
    async collection() {
      const owned = PRODUCTS.filter((p) => qtyOf(p.id)), lim = ME.limits, pl = perkLines(ME.perks.limit_mult > 1 || ME.perks.transfer_mult > 1 || ME.perks.spread_discount_pct || ME.perks.extra_cards ? ME.perks : null);
      return `<h1>Koleksiyonum</h1><div class="panel"><h3>Etkin avantajların</h3>${pl.length ? `<ul class="perks">${pl.map((t) => `<li>${esc(t)}</li>`).join('')}</ul>` : '<p class="mut">Henüz fonksiyonel kartın yok.</p>'}
        <p class="mut small">İşlem başına ${esc(fm(lim.max_transfer))} · günlük ${esc(fm(lim.daily_limit))} · en fazla ${lim.max_cards} kart</p></div>
        ${owned.length ? `<div class="grid">${owned.map((p) => `<article class="pcard r-${p.rarity}"><a class="pv" href="#/p/${esc(p.id)}">${previewSvg(p, false)}</a><div class="body"><span class="rar">${RARITY[p.rarity]}</span><h3>${esc(p.name)}${qtyOf(p.id) > 1 ? ` ×${qtyOf(p.id)}` : ''}</h3>
          <small class="mut">${entOf(p.id).serial ? `No. ${esc(entOf(p.id).serial)} · ` : ''}${esc(fmtDate(entOf(p.id).acquired_at))}</small>${p.skin ? equipBox(p) : ''}</div></article>`).join('')}</div>`
        : '<div class="empty">Koleksiyonun boş. <a href="#/browse">Kartlara göz at</a></div>'}`;
    },
    async wishlist() {
      const l = PRODUCTS.filter((p) => wished(p.id));
      return `<h1>İstek listesi</h1><p class="lead">Kaydettiklerin sahiplik anlamına gelmez; stok tükenebilir.</p>${l.length ? `<div class="grid">${l.map(tile).join('')}</div>` : '<div class="empty">Listen boş. Kartlardaki kalbe dokunarak ekle.</div>'}`;
    },
    async history() {
      const pg = state.page || 0, r = await A.purchases(pg, 8);
      return `<h1>Satın alma geçmişi</h1>${r.items.length ? `<div class="list">${r.items.map((t) => `<div class="item"><div><h3>${esc(t.name)}</h3><small class="mut">${KIND[t.kind] || ''} · ${esc(fmtDate(t.at))} · ${esc(t.id)}${t.serial ? ' · No. ' + esc(t.serial) : ''}</small></div>
        <div><b>${esc(fm(t.price))}</b>${t.status === 'refunded' ? '<br><small class="mut">İade edildi</small>' : ''}</div></div>`).join('')}</div>` : '<div class="empty">Henüz alışveriş yok.</div>'}
        <div class="row start pager">${pg > 0 ? '<button class="btn ghost" data-page="-1">‹ Yeni</button>' : ''}${r.more ? '<button class="btn ghost" data-page="1">Eski ›</button>' : ''}</div>`;
    }
  };

  function equipBox(p) {
    if (!qtyOf(p.id)) return '';
    if (!ME.cards.length) return '<p class="mut small">Yüzey uygulamak için önce Nexus\'ta bir sanal kart oluştur.</p>';
    const on = ME.cards.filter((c) => c.skin && c.skin.product_id === p.id);
    return `<div class="equip"><label class="mut small" for="eq-${esc(p.id)}">Bu yüzeyi uygula:</label><div class="row start"><select id="eq-${esc(p.id)}" data-eqsel="${esc(p.id)}">${ME.cards.map((c) => `<option value="${esc(c.id)}">${esc(c.label || c.display_name)}${c.skin && c.skin.product_id === p.id ? ' (takılı)' : ''}</option>`).join('')}</select>
      <button class="btn" data-equip="${esc(p.id)}">Uygula</button>${on.length ? `<button class="btn ghost" data-unequip="${esc(p.id)}">Kaldır</button>` : ''}</div></div>`;
  }

  async function buy(id) {
    const p = PRODUCTS.find((x) => x.id === id), after = ME.balance - p.price;
    const ok = await confirmBox(`<h3>Satın alma onayı</h3><div class="row"><span>${esc(p.name)}</span><b>${esc(fm(p.price))}</b></div><div class="row"><span>Kalan bakiye</span><b>${after < 0 ? '—' : esc(fm(after))}</b></div>
      ${after < 0 ? `<p class="mut">Bakiyen yetersiz; ${esc(fm(-after))} daha gerekli.</p>` : ''}${p.stock_total ? `<p class="mut small">Sınırlı seri: ${p.stock_left} adet kaldı. Satın alma geri alınamaz (iade yalnızca yönetici işlemiyle).</p>` : ''}`, 'Satın al');
    if (!ok) return;
    let r;
    try { r = await A.purchase(id); }
    catch (e) { if (e.message === 'AUTH' || e.message === 'RATE') throw e; toast('Bağlantı sorunu. Sonuç doğrulanıyor; yeniden denersen çift ücret alınmaz.', true); await reload(); return; }
    A.purchaseDone(id);
    if (!r.ok) {
      const msg = { insufficient: `Yetersiz bakiye. ${fm(r.missing || 0)} daha gerekli.`, already_owned: 'Bu ürüne zaten sahipsin.', sold_out: 'Üzgünüz, stok tükendi.', unavailable: 'Ürün şu an satışta değil.' }[r.code] || 'Satın alma tamamlanamadı.';
      toast(msg, true); await reload(); return;
    }
    toast(r.purchase.serial ? `Satın alındı. Numaran: ${r.purchase.serial}` : 'Satın alındı ✓'); await reload();
  }

  async function reload() { await refreshMe(); PRODUCTS = await A.products(); await render(); }
  function connectScreen(msg) {
    $('#bal').textContent = '';
    const nx = A.nexusUrl() ? A.nexusUrl() + '/#/shop' : '';
    app.innerHTML = `<section class="connect"><h1>NEXUS MARKET</h1><p class="lead">Premium tasarım kartları ve gerçek avantaj sağlayan fonksiyonel kartlar.</p>${msg ? `<div class="empty err">${esc(msg)}</div>` : ''}
      <div class="panel"><h3>Nexus ile giriş</h3><p class="mut">Market, Nexus hesabınla çalışır ve FN bakiyenle alışveriş yaparsın. Nexus'a girip <b>İşlemler → Nexus Market</b> düğmesine bas; buraya otomatik giriş yapılır.</p>${nx ? `<a class="btn" href="${esc(nx)}">Nexus'u aç</a>` : '<p class="mut">Nexus adresi ayarlı değil (js/config.js → NEXUS_URL).</p>'}</div></section>`;
  }
  async function render() {
    const [r, a] = location.hash.replace(/^#\//, '').split('/');
    document.querySelectorAll('nav a').forEach((n) => n.classList.toggle('on', n.getAttribute('href') === '#/' + (r || '')));
    const key = r === 'p' ? 'product' : r || 'home';
    if (!pages[key]) return (app.innerHTML = '<div class="empty">Sayfa bulunamadı.</div>');
    try { app.innerHTML = await pages[key](a); fixBlend(app); }
    catch (e) { if (e.message === 'AUTH') return connectScreen('Oturum süresi doldu. Nexus’tan Market’i yeniden aç.'); app.innerHTML = `<div class="empty">Yüklenemedi: ${esc(e.message)} <button class="btn ghost" onclick="location.reload()">Yeniden dene</button></div>`; }
  }

  document.addEventListener('click', async (e) => {
    const t = e.target.closest('button'); if (!t) return; const d = t.dataset;
    try {
      if (d.buy) await buy(d.buy);
      else if (d.wish) { const r = await A.wishlist(d.wish); ME.wishlist = r.wishlist; await render(); }
      else if (d.kind) { state.kind = d.kind; await render(); }
      else if (t.hasAttribute('data-hide')) { state.hideOwned = !state.hideOwned; await render(); }
      else if (d.page) { state.page = Math.max(0, (state.page || 0) + Number(d.page)); await render(); }
      else if (d.equip || d.unequip) {
        const pid = d.equip || d.unequip, cardId = $(`[data-eqsel="${pid}"]`).value;
        await A.equip(cardId, d.equip ? pid : null); toast(d.equip ? 'Kart yüzeyi uygulandı' : 'Kart yüzeyi kaldırıldı'); await reload();
      }
    } catch (err) {
      if (err.message === 'AUTH') return connectScreen('Oturum süresi doldu. Nexus’tan Market’i yeniden aç.');
      toast(err.message === 'RATE' ? 'Çok fazla istek; biraz bekle.' : err.message, true); try { await refreshMe(); } catch (e2) { /* oturum bitmiş olabilir */ }
    }
  });
  document.addEventListener('input', (e) => { if (e.target.id === 'q') { state.q = e.target.value; render().then(() => { const q = $('#q'); q.focus(); q.setSelectionRange(99, 99); }); } });
  document.addEventListener('change', async (e) => {
    if (e.target.id === 'sort') { state.sort = e.target.value; await render(); }
    if (e.target.id === 'rar') { state.rarity = e.target.value; await render(); }
  });
  window.addEventListener('hashchange', async () => { if (!ME) return; state.page = 0; app.innerHTML = skeleton(); await render(); app.focus(); scrollTo(0, 0); });
  (async function init() {
    app.innerHTML = skeleton();
    await A.boot;
    if (!A.hasToken()) return connectScreen(A.bootError());
    try { await refreshMe(); PRODUCTS = await A.products(); await render(); }
    catch (e) { if (e.message === 'AUTH') return connectScreen(A.bootError() || 'Oturum bulunamadı. Nexus’tan Market’i aç.'); app.innerHTML = `<div class="empty">Market yüklenemedi: ${esc(e.message)}</div>`; }
  })();
})();
