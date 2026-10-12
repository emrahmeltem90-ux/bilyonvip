/* ============================================================
   SKORLAB TOTO v18 · TELEGRAM MINI APP
   Toto + Bankobot + Parmak İzi + Performans + Arşiv
   ============================================================ */
'use strict';

let TG = null;
const $ = id => document.getElementById(id);

/* ============================================================
   0. YARDIMCI
   ============================================================ */
function safeReadJSON(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw == null ? fallback : JSON.parse(raw);
  } catch (e) {
    console.warn('Kayıt okunamadı:', key, e);
    return fallback;
  }
}

function safeSaveJSON(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (e) {
    console.error('Kayıt yazılamadı:', key, e);
    showToast('error', 'Kayıt Hatası', 'Depolama kullanılamıyor.');
    return false;
  }
}

function escapeHTML(value) {
  return String(value ?? '').replace(/[&<>"']/g, ch => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;',
    '"': '&quot;', "'": '&#39;'
  }[ch]));
}

function validOdds(...values) {
  return values.every(v =>
    v !== '' && v !== null && v !== undefined &&
    Number.isFinite(Number(v)) && Number(v) > 1
  );
}

/* ============================================================
   1. TELEGRAM
   ============================================================ */
function initTelegram() {
  if (!window.Telegram?.WebApp) return;
  TG = window.Telegram.WebApp;
  try {
    TG.ready();
    TG.expand();
    if (typeof TG.enableClosingConfirmation === 'function') {
      TG.enableClosingConfirmation();
    }
    applyTelegramTheme(TG);
    TG.onEvent?.('themeChanged', () => applyTelegramTheme(TG));
  } catch (e) {
    console.warn('Telegram başlatma uyarısı:', e);
  }
}

function applyTelegramTheme(tg) {
  const p = tg?.themeParams || {};
  const root = document.documentElement;
  if (p.bg_color) root.style.setProperty('--bg', p.bg_color);
  if (p.secondary_bg_color) root.style.setProperty('--bg2', p.secondary_bg_color);
  if (p.text_color) root.style.setProperty('--text', p.text_color);
  if (p.hint_color) root.style.setProperty('--muted', p.hint_color);
  if (p.button_color) root.style.setProperty('--green', p.button_color);
}

/* ============================================================
   2. VERİ
   ============================================================ */
let maclarToto = [];
let oranlarToto = safeReadJSON('skorlab_oranlar_toto', {});
let secimlerToto = safeReadJSON('skorlab_secimler_toto', {});
let kayitliKuponlar = safeReadJSON('skorlab_kuponlar', []);
let backtestKayitlari = safeReadJSON('skorlab_backtest', []);
let arsivKayitlari = safeReadJSON('skorlab_arsiv', []);

if (!oranlarToto || typeof oranlarToto !== 'object' || Array.isArray(oranlarToto)) oranlarToto = {};
if (!secimlerToto || typeof secimlerToto !== 'object' || Array.isArray(secimlerToto)) secimlerToto = {};
if (!Array.isArray(kayitliKuponlar)) kayitliKuponlar = [];
if (!Array.isArray(backtestKayitlari)) backtestKayitlari = [];
if (!Array.isArray(arsivKayitlari)) arsivKayitlari = [];

function persistSelections() { return safeSaveJSON('skorlab_secimler_toto', secimlerToto); }
function persistOdds() { return safeSaveJSON('skorlab_oranlar_toto', oranlarToto); }
function persistCoupons() { return safeSaveJSON('skorlab_kuponlar', kayitliKuponlar); }
function persistBacktest() { return safeSaveJSON('skorlab_backtest', backtestKayitlari); }
function persistArsiv() { return safeSaveJSON('skorlab_arsiv', arsivKayitlari); }

/* ============================================================
   3. TAHMİN MOTORU
   ============================================================ */
class Motor {
  static faktoriyel(n) {
    if (n < 0 || !Number.isInteger(n)) return NaN;
    let r = 1;
    for (let i = 2; i <= n; i++) r *= i;
    return r;
  }

  static poissonPmf(k, lambda) {
    if (!Number.isFinite(lambda) || lambda < 0 || !Number.isInteger(k) || k < 0) return 0;
    if (lambda === 0) return k === 0 ? 1 : 0;
    return Math.exp(-lambda + k * Math.log(lambda) - Math.log(this.faktoriyel(k)));
  }

  static shin(o1, oX, o2) {
    if (!validOdds(o1, oX, o2)) throw new Error('1-X-2 oranları 1’den büyük olmalı.');
    const implied = [o1, oX, o2].map(o => 1 / Number(o));
    const S = implied.reduce((a, b) => a + b, 0);
    const marj = Math.max(0, (S - 1) * 100);

    if (S <= 1) {
      const total = implied.reduce((a, b) => a + b, 0);
      return { p1: implied[0] / total, pX: implied[1] / total, p2: implied[2] / total, marj };
    }

    const probsAt = z => implied.map(p =>
      (Math.sqrt(z * z + 4 * (1 - z) * p * p / S) - z) / (2 * (1 - z))
    );

    let lo = 0, hi = 0.999999;
    for (let i = 0; i < 80; i++) {
      const mid = (lo + hi) / 2;
      const sum = probsAt(mid).reduce((a, b) => a + b, 0);
      if (sum > 1) lo = mid; else hi = mid;
    }

    const raw = probsAt((lo + hi) / 2);
    const total = raw.reduce((a, b) => a + b, 0);
    return { p1: raw[0] / total, pX: raw[1] / total, p2: raw[2] / total, marj };
  }

  static poisson(lambdaHome, lambdaAway, maxGoals = 10) {
    const home = Array.from({ length: maxGoals + 1 }, (_, k) => this.poissonPmf(k, lambdaHome));
    const away = Array.from({ length: maxGoals + 1 }, (_, k) => this.poissonPmf(k, lambdaAway));

    let p1 = 0, pX = 0, p2 = 0, ust25 = 0, alt25 = 0, kg = 0;
    const skorlar = [];

    for (let h = 0; h <= maxGoals; h++) {
      for (let a = 0; a <= maxGoals; a++) {
        const p = home[h] * away[a];
        if (h > a) p1 += p; else if (h === a) pX += p; else p2 += p;
        if (h + a >= 3) ust25 += p; else alt25 += p;
        if (h > 0 && a > 0) kg += p;
        skorlar.push({ h, a, skor: `${h}-${a}`, p });
      }
    }

    const total = p1 + pX + p2;
    if (!total) throw new Error('Poisson hesabı yapılamadı.');

    skorlar.forEach(s => { s.p /= total; });
    skorlar.sort((a, b) => b.p - a.p);

    return {
      p1: p1 / total, pX: pX / total, p2: p2 / total,
      pUst25: ust25 / total, pAlt25: alt25 / total,
      pKgVar: kg / total, pKgYok: Math.max(0, (total - kg) / total),
      enOlası: skorlar.slice(0, 5).map(s => ({ skor: s.skor, yuzde: (s.p * 100).toFixed(1) }))
    };
  }

  static xg(p1, pX, p2) {
    const hedef = [p1, pX, p2];
    const toplam = hedef.reduce((a, b) => a + b, 0);
    if (!hedef.every(Number.isFinite) || toplam <= 0) throw new Error('Olasılıklar geçersiz.');

    const t = hedef.map(v => v / toplam);
    let best = { home: 1.25, away: 1.05, loss: Infinity };

    for (let home = 0.2; home <= 3.5; home += 0.05) {
      for (let away = 0.2; away <= 3.5; away += 0.05) {
        const r = this.poisson(home, away, 9);
        const loss = (r.p1 - t[0]) ** 2 + (r.pX - t[1]) ** 2 + (r.p2 - t[2]) ** 2;
        if (loss < best.loss) best = { home, away, loss };
      }
    }
    return { xgEv: best.home, xgDep: best.away, hata: best.loss };
  }

  static analiz(veri) {
    const { o1, oX, o2 } = veri;
    if (!validOdds(o1, oX, o2)) throw new Error('Geçerli 1-X-2 oranları girilmelidir.');

    const sh = this.shin(o1, oX, o2);
    const xg = this.xg(sh.p1, sh.pX, sh.p2);
    const poi = this.poisson(xg.xgEv, xg.xgDep, 10);

    const ust = poi.pUst25 * 100;
    const kg = poi.pKgVar * 100;

    let gollu;
    if (ust >= 65 && kg >= 65) gollu = '🔥 ÇOK GOLLÜ';
    else if (ust >= 55 || kg >= 55) gollu = '⚡ GOLLÜ';
    else if (ust >= 45 || kg >= 45) gollu = '🟡 ORTA';
    else gollu = '❄️ AZ GOLLÜ';

    return {
      marj: sh.marj.toFixed(1),
      shin: { p1: (sh.p1 * 100).toFixed(1), pX: (sh.pX * 100).toFixed(1), p2: (sh.p2 * 100).toFixed(1) },
      xgEv: xg.xgEv.toFixed(2), xgDep: xg.xgDep.toFixed(2), modelHata: xg.hata,
      poi: {
        p1: (poi.p1 * 100).toFixed(1), pX: (poi.pX * 100).toFixed(1), p2: (poi.p2 * 100).toFixed(1),
        pUst25: ust.toFixed(1), pAlt25: (poi.pAlt25 * 100).toFixed(1),
        pKgVar: kg.toFixed(1), pKgYok: (poi.pKgYok * 100).toFixed(1),
        enOlası: poi.enOlası
      },
      gollu
    };
  }
}

/* ============================================================
   4. VERİ YÜKLE
   ============================================================ */
async function loadData() {
  try {
    const res = await fetch('matches.json');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const raw = await res.json();
    maclarToto = Array.isArray(raw.maclar) ? raw.maclar : [];
    if ($('weekTitle')) $('weekTitle').innerText = raw.hafta || 'Bu Hafta';
  } catch (e) {
    maclarToto = [];
    if ($('weekTitle')) $('weekTitle').innerText = 'Veri Yüklenemedi';
    console.error('Maç verisi yüklenemedi:', e);
  }
  renderToto(); renderAnaliz(); renderKayitliKuponlar(); renderBacktest();
  updateStats(); updateKuponCubugu();
}

/* ============================================================
   5. ORAN GÜNCELLEME
   ============================================================ */
function oranGuncelleToto(mac_id, alan, val) {
  if (!['1', 'X', '2'].includes(alan)) return;
  const num = Number.parseFloat(val);

  if (val === '' || !Number.isFinite(num)) {
    if (oranlarToto[mac_id]) delete oranlarToto[mac_id][alan];
  } else if (num <= 1) {
    showToast('error', 'Geçersiz Oran', 'Oran 1’den büyük olmalı.');
    renderToto(); return;
  } else {
    if (!oranlarToto[mac_id]) oranlarToto[mac_id] = {};
    oranlarToto[mac_id][alan] = num;
  }

  if (oranlarToto[mac_id] && !Object.keys(oranlarToto[mac_id]).length) delete oranlarToto[mac_id];
  persistOdds(); renderToto(); renderAnaliz();
}

function getAnalysisForMatch(id) {
  const o = oranlarToto[id];
  if (!o || !validOdds(o['1'], o.X, o['2'])) return null;
  try {
    return Motor.analiz({ o1: o['1'], oX: o.X, o2: o['2'] });
  } catch (err) {
    console.warn('Analiz yapılamadı:', id, err);
    return null;
  }
}

/* ============================================================
   6. TOTO EKRANI
   ============================================================ */
function renderToto() {
  const c = $('totoListesi');
  if (!c) return;

  if (!maclarToto.length) {
    c.innerHTML = '<div class="card"><div class="muted" style="text-align:center;padding:20px">Maç yok.</div></div>';
    updateKuponCubugu(); return;
  }

  c.innerHTML = maclarToto.map(m => {
    const id = m.mac_id;
    const sec = Array.isArray(secimlerToto[id]) ? secimlerToto[id] : [];
    const o = oranlarToto[id] || {};
    const tahmin = getAnalysisForMatch(id);

    return `
      <div class="mac-kart">
        <div class="mac-head">
          <span class="mac-no">#${escapeHTML(id)}</span>
          <button type="button" class="mac-analiz-btn" onclick="analizGosterToto(${Number(id)})" aria-label="Maç analizi">📊</button>
        </div>
        <div class="mac-teams">${escapeHTML(m.ev_sahibi)} - ${escapeHTML(m.deplasman)}</div>
        <div class="oran-giris">
          <div class="oran-item"><label>1</label><input type="number" min="1.01" step="0.01" inputmode="decimal" value="${escapeHTML(o['1'] ?? '')}" onchange="oranGuncelleToto(${Number(id)},'1',this.value)"></div>
          <div class="oran-item"><label>X</label><input type="number" min="1.01" step="0.01" inputmode="decimal" value="${escapeHTML(o.X ?? '')}" onchange="oranGuncelleToto(${Number(id)},'X',this.value)"></div>
          <div class="oran-item"><label>2</label><input type="number" min="1.01" step="0.01" inputmode="decimal" value="${escapeHTML(o['2'] ?? '')}" onchange="oranGuncelleToto(${Number(id)},'2',this.value)"></div>
        </div>
        ${tahmin ? `
          <div class="tahmin-box">
            <div class="tahmin-satir"><span class="lbl">🎯 FAVORİ</span><span class="val green">${favoriKod(tahmin.shin)} (%${favoriOlas(tahmin.shin)})</span></div>
            <div class="tahmin-satir"><span class="lbl">⚽ EN OLASI SKOR</span><span class="val purple">${tahmin.poi.enOlası[0].skor}</span></div>
            <div class="tahmin-satir"><span class="lbl">📊 GOL DURUMU</span><span class="val orange">${tahmin.gollu}</span></div>
          </div>` : ''}
        <div class="secim-grid">
          <button type="button" class="secim-btn ${sec.includes('1') ? 'secili' : ''}" aria-pressed="${sec.includes('1')}" onclick="secimToggleToto(${Number(id)},'1')">1</button>
          <button type="button" class="secim-btn ${sec.includes('X') ? 'secili' : ''}" aria-pressed="${sec.includes('X')}" onclick="secimToggleToto(${Number(id)},'X')">X</button>
          <button type="button" class="secim-btn ${sec.includes('2') ? 'secili' : ''}" aria-pressed="${sec.includes('2')}" onclick="secimToggleToto(${Number(id)},'2')">2</button>
        </div>
      </div>`;
  }).join('');
  updateKuponCubugu();
}

function favoriKod(shin) {
  const p1 = Number(shin.p1), pX = Number(shin.pX), p2 = Number(shin.p2);
  if (p1 >= pX && p1 >= p2) return '1';
  if (p2 >= p1 && p2 >= pX) return '2';
  return 'X';
}

function favoriOlas(shin) {
  return Math.max(Number(shin.p1), Number(shin.pX), Number(shin.p2)).toFixed(1);
}

/* ============================================================
   7. ANALİZ LİSTESİ
   ============================================================ */
function renderAnaliz() {
  const c = $('analizListesi');
  if (!c) return;
  const rows = maclarToto.map(m => ({ m, a: getAnalysisForMatch(m.mac_id) })).filter(x => x.a);
  if (!rows.length) {
    c.innerHTML = '<div class="muted" style="text-align:center;padding:20px">Analiz için geçerli 1-X-2 oranları gir.</div>';
    return;
  }
  rows.sort((x, y) => Number(y.a.poi.pUst25) - Number(x.a.poi.pUst25));
  c.innerHTML = rows.map(({ m, a }) => `
    <div style="padding:10px 0;border-bottom:1px solid var(--border);font-size:.78rem;cursor:pointer" onclick="analizGosterToto(${Number(m.mac_id)})">
      <div style="font-weight:900;margin-bottom:4px">#${escapeHTML(m.mac_id)} ${escapeHTML(m.ev_sahibi)} - ${escapeHTML(m.deplasman)}</div>
      <div style="display:flex;justify-content:space-between;gap:8px">
        <span style="font-weight:900;color:var(--green)">${favoriKod(a.shin)} (%${favoriOlas(a.shin)})</span>
        <span class="muted">2.5 Ü %${a.poi.pUst25} · KG Var %${a.poi.pKgVar}</span>
      </div>
      <div style="margin-top:3px;color:var(--orange);font-weight:900;font-size:.72rem">${a.gollu}</div>
    </div>`).join('');
}

/* ============================================================
   8. SEÇİMLER
   ============================================================ */
function secimToggleToto(id, s) {
  if (!['1', 'X', '2'].includes(s)) return;
  let arr = Array.isArray(secimlerToto[id]) ? [...secimlerToto[id]] : [];
  arr = arr.includes(s) ? arr.filter(x => x !== s) : [...arr, s];
  if (!arr.length) delete secimlerToto[id];
  else secimlerToto[id] = ['1', 'X', '2'].filter(x => arr.includes(x));
  persistSelections(); renderToto(); updateStats(); updateKuponCubugu();
}

function tumSecimleriSil() {
  if (!confirm('Tüm seçimler silinsin mi?')) return;
  secimlerToto = {}; persistSelections();
  renderToto(); updateStats(); updateKuponCubugu();
}

function temizleToto() {
  if (!confirm('Toto oranları ve seçimleri silinsin mi?')) return;
  oranlarToto = {}; secimlerToto = {};
  persistOdds(); persistSelections();
  renderToto(); renderAnaliz(); updateStats(); updateKuponCubugu();
}

/* ============================================================
   9. KUPON HESAPLARI
   ============================================================ */
function kuponHesapla(secimler = secimlerToto) {
  let mac = 0, kolon = 1;
  Object.values(secimler).forEach(s => {
    if (!Array.isArray(s) || !s.length) return;
    mac++; kolon *= s.length;
  });
  return { toto: mac, toplam: mac, kolon: mac ? kolon : 0, tutar: (mac ? kolon : 0) * 10 };
}

function updateStats() {
  const h = kuponHesapla();
  if ($('statMac')) $('statMac').textContent = maclarToto.length;
  if ($('statSecilen')) $('statSecilen').textContent = h.toplam;
  if ($('statKolon')) $('statKolon').textContent = h.kolon;
  if ($('statTutar')) $('statTutar').textContent = `${h.tutar} TL`;
}

function updateKuponCubugu() {
  const h = kuponHesapla();
  if ($('kcToto')) $('kcToto').textContent = h.toto;
  if ($('kcToplam')) $('kcToplam').textContent = `${h.tutar} TL`;
}

/* ============================================================
   10. KUPON ÖNERİSİ
   ============================================================ */
function secimOnerisi(a) {
  const p = [
    { k: '1', o: Number(a.shin.p1) },
    { k: 'X', o: Number(a.shin.pX) },
    { k: '2', o: Number(a.shin.p2) }
  ].sort((x, y) => y.o - x.o);

  if (p[0].o >= 65) return { secim: p[0].k, renk: 'green' };
  if (p[0].o >= 52) return { secim: p.slice(0, 2).map(x => x.k).join(''), renk: 'orange' };
  return { secim: '1X2', renk: 'red' };
}

function kuponOlusturToto() {
  const oneriler = [];
  maclarToto.forEach(m => {
    const a = getAnalysisForMatch(m.mac_id);
    if (!a) return;
    const secim = secimOnerisi(a);
    oneriler.push({
      mac_id: m.mac_id,
      isim: `${m.ev_sahibi} - ${m.deplasman}`,
      a, fav: favoriKod(a.shin), favO: favoriOlas(a.shin),
      secim: secim.secim, renk: secim.renk
    });
  });

  if (!oneriler.length) { showToast('error', 'Maç Yok', 'Önce geçerli oranları gir.'); return; }

  const secimlerOneri = {};
  oneriler.forEach(o => { secimlerOneri[o.mac_id] = o.secim.split(''); });
  const hesap = kuponHesapla(secimlerOneri);

  let html = `<div class="card" style="border:1px solid var(--green)"><div class="result-title">⚡ TOTO ÖNERİSİ</div>`;
  oneriler.forEach(o => {
    html += `
      <div style="padding:10px 0;border-bottom:1px solid var(--border);font-size:.78rem">
        <div style="font-weight:900;margin-bottom:4px">${escapeHTML(o.isim)}</div>
        <div style="display:flex;justify-content:space-between;gap:8px">
          <b style="color:var(--${o.renk})">🎯 ${o.secim}</b>
          <span class="muted">Favori: ${o.fav} (%${o.favO})</span>
        </div>
        <div class="muted" style="font-size:.68rem;margin-top:2px">${o.a.gollu} · 2.5 Ü %${o.a.poi.pUst25} · KG Var %${o.a.poi.pKgVar}</div>
      </div>`;
  });

  html += `
      <div style="margin-top:12px;padding:10px;background:var(--bg3);border-radius:8px">
        <div class="analiz-row"><span>Kolon:</span><b class="green">${hesap.kolon}</b></div>
        <div class="analiz-row"><span>Tutar:</span><b class="green">${hesap.tutar} TL</b></div>
      </div>
      <button type="button" class="btn btn-green btn-lg" onclick="kuponKaydetToto()" style="margin-top:12px">💾 KAYDET</button>
      <button type="button" class="btn btn-blue btn-lg" onclick="paylasOneriKuponu()" style="margin-top:8px">📤 PAYLAŞ</button>
    </div>`;

  if ($('totoKuponSonuc')) $('totoKuponSonuc').innerHTML = html;
  window.sonTotoKuponu = { oneriler, secimler: secimlerOneri, kolon: hesap.kolon, tutar: hesap.tutar };
}

function kuponKaydetToto() {
  const data = window.sonTotoKuponu;
  if (!data?.oneriler?.length) return;
  kayitliKuponlar.unshift({
    id: Date.now(), tip: 'toto', tarih: new Date().toLocaleString('tr-TR'),
    macSayisi: data.oneriler.length, kolon: data.kolon, tutar: data.tutar,
    detaylar: data.oneriler.map(o => ({ isim: o.isim, secim: o.secim, favori: `${o.fav} (%${o.favO})` })),
    durum: 'bekliyor'
  });
  kayitliKuponlar = kayitliKuponlar.slice(0, 50);
  persistCoupons(); renderKayitliKuponlar();
  showToast('success', 'Kaydedildi!', `${data.oneriler.length} maç · ${data.kolon} kolon`);
}

/* ============================================================
   11. BANKOBOT
   ============================================================ */
function bankobot() {
  if (!maclarToto.length) { showToast('error', 'Maç Yok', 'Toto maçları yüklenmedi.'); return; }
  const analizler = maclarToto.map(m => {
    const a = getAnalysisForMatch(m.mac_id);
    if (!a) return null;
    return {
      mac_id: m.mac_id, mac: `${m.ev_sahibi} - ${m.deplasman}`,
      fav: favoriKod(a.shin), favO: Number(favoriOlas(a.shin)),
      skor: a.poi.enOlası[0].skor, gollu: a.gollu,
      pUst25: a.poi.pUst25, pKgVar: a.poi.pKgVar, analiz: a
    };
  }).filter(Boolean);

  if (!analizler.length) { showToast('error', 'Oran Yok', 'Önce geçerli oranları gir.'); return; }
  analizler.sort((a, b) => b.favO - a.favO);
  const bankolar = analizler.filter(a => a.favO >= 65).slice(0, 5);

  if (!bankolar.length) { showToast('error', 'Banko Yok', '%65 eşiğini geçen aday yok.'); return; }
  const ortGuv = (bankolar.reduce((s, b) => s + b.favO, 0) / bankolar.length).toFixed(1);

  let html = `
    <div class="card" style="border:2px solid var(--purple)">
      <div class="result-title">🤖 BANKOBOT · ${bankolar.length} MAÇ</div>
      <div class="muted" style="font-size:.72rem;margin-bottom:10px">Oran modeline göre sıralanan adaylar · Ortalama %${ortGuv}</div>`;

  bankolar.forEach((b, i) => {
    html += `
      <div style="padding:12px 0;border-bottom:1px solid var(--border)">
        <div style="font-weight:900;font-size:.85rem;margin-bottom:6px">${i + 1}. ${escapeHTML(b.mac)}</div>
        <div style="display:flex;justify-content:space-between;margin-bottom:4px">
          <span>🎯 <b style="color:var(--green)">${b.fav}</b> (%${b.favO.toFixed(1)})</span>
          <span>⚽ <b style="color:var(--purple)">${b.skor}</b></span>
        </div>
        <div class="muted" style="font-size:.68rem">📊 ${b.gollu} · 2.5 Ü %${b.pUst25} · KG Var %${b.pKgVar}</div>
      </div>`;
  });

  html += `
      <div style="margin-top:12px;padding:10px;background:var(--bg3);border-radius:8px;text-align:center">
        <div style="font-size:.8rem;color:var(--muted)">Ortalama model olasılığı</div>
        <div style="font-size:1.4rem;font-weight:900;color:var(--purple)">%${ortGuv}</div>
      </div>
      <div style="margin-top:8px;padding:8px;background:rgba(255,176,32,.1);border-radius:6px;font-size:.68rem;color:var(--orange);text-align:center">⚠️ Sadece öneridir. Kuponunuza eklemek için manuel seçim yapın.</div>
      <button type="button" class="btn btn-purple btn-lg" onclick="paylasBankobot()" style="margin-top:12px">📤 PAYLAŞ</button>
      <button type="button" class="btn btn-green btn-lg" onclick="kaydetBankobot()" style="margin-top:8px">💾 KUPONA KAYDET</button>
    </div>`;

  if ($('totoKuponSonuc')) $('totoKuponSonuc').innerHTML = html;
  window.sonBankobot = bankolar;
}

function kaydetBankobot() {
  const bankolar = window.sonBankobot || [];
  if (!bankolar.length) { showToast('error', 'Boş', 'Önce Bankobot oluştur.'); return; }
  kayitliKuponlar.unshift({
    id: Date.now(), tip: 'bankobot', tarih: new Date().toLocaleString('tr-TR'),
    macSayisi: bankolar.length, kolon: 1, tutar: bankolar.length * 10,
    detaylar: bankolar.map(b => ({ isim: b.mac, secim: `${b.fav} (%${b.favO.toFixed(1)}) · ${b.skor}` })),
    durum: 'bekliyor'
  });
  kayitliKuponlar = kayitliKuponlar.slice(0, 50);
  persistCoupons(); renderKayitliKuponlar();
  showToast('success', 'Kaydedildi!', `${bankolar.length} aday · ${bankolar.length * 10} TL`);
}

/* ============================================================
   12. PAYLAŞIM
   ============================================================ */
function paylasMetni(metin, baslik) {
  if (TG && typeof TG.switchInlineQuery === 'function' && typeof TG.isVersionAtLeast === 'function' && TG.isVersionAtLeast('6.1')) {
    TG.switchInlineQuery(metin, ['users', 'groups']); return;
  }
  if (navigator.share) {
    navigator.share({ title: baslik, text: metin }).catch(() => {}); return;
  }
  if (navigator.clipboard?.writeText) {
    navigator.clipboard.writeText(metin)
      .then(() => showToast('success', 'Kopyalandı!', 'Metin panoya kopyalandı.'))
      .catch(() => showToast('error', 'Paylaşılamadı', 'Metni manuel kopyala.'));
    return;
  }
  showToast('error', 'Paylaşım Yok', 'Bu tarayıcı paylaşımı desteklemiyor.');
}

function paylasBankobot() {
  const bankolar = window.sonBankobot || [];
  if (!bankolar.length) { showToast('error', 'Boş', 'Önce Bankobot oluştur.'); return; }
  const ortGuv = (bankolar.reduce((s, b) => s + b.favO, 0) / bankolar.length).toFixed(1);
  let metin = '🤖 SKORLAB BANKOBOT\n';
  metin += `📅 ${new Date().toLocaleDateString('tr-TR')}\n\n`;
  bankolar.forEach((b, i) => {
    metin += `${i + 1}. ${b.mac}\n🎯 ${b.fav} (%${b.favO.toFixed(1)})\n⚽ ${b.skor} · ${b.gollu}\n\n`;
  });
  metin += `💰 Ortalama model olasılığı: %${ortGuv}\n`;
  metin += '📌 Olasılıklar tahmindir, kesin sonuç değildir.\n📱 @SkorLabBot';
  paylasMetni(metin, 'SkorLab Bankobot');
}

function paylasOneriKuponu() {
  const data = window.sonTotoKuponu;
  if (!data?.oneriler?.length) { showToast('error', 'Boş', 'Önce Toto önerisi oluştur.'); return; }
  let metin = '⚽ SKORLAB TOTO ÖNERİSİ\n\n';
  data.oneriler.forEach(o => {
    metin += `${o.isim}\n🎯 Öneri: ${o.secim}\n📊 Model favorisi: ${o.fav} (%${o.favO})\n\n`;
  });
  metin += `🔢 Kolon: ${data.kolon}\n💰 Hesaplanan tutar: ${data.tutar} TL\n`;
  metin += '📌 Tahminler garanti değildir.\n📱 @SkorLabBot';
  paylasMetni(metin, 'SkorLab Toto Önerisi');
}

function paylasKupon() {
  const secimler = secimlerToto;
  const ids = Object.keys(secimler).filter(id => Array.isArray(secimler[id]) && secimler[id].length);
  if (!ids.length) { showToast('error', 'Boş', 'Önce maç seç.'); return; }
  let metin = '⚽ SKORLAB TOTO KUPONU\n\n', kolon = 1;
  ids.forEach(id => {
    const m = maclarToto.find(x => String(x.mac_id) === String(id));
    if (!m) return;
    const s = secimler[id];
    kolon *= s.length;
    metin += `#${id} ${m.ev_sahibi} - ${m.deplasman}\n🎯 ${s.join(' / ')}\n\n`;
  });
  metin += `🔢 Kolon: ${kolon}\n💰 Tutar: ${kolon * 10} TL\n`;
  metin += '📌 Tahminler garanti değildir.\n📱 @SkorLabBot';
  paylasMetni(metin, 'SkorLab Toto Kuponu');
}

/* ============================================================
   13. PARMAK İZİ
   ============================================================ */
function haftaninParmakIzi() {
  if (!maclarToto.length) { showToast('error', 'Maç Yok', 'Toto maçları yüklenmedi.'); return; }

  const analizler = maclarToto.map(m => {
    const a = getAnalysisForMatch(m.mac_id);
    if (!a) return null;
    const p1 = Number(a.shin.p1), pX = Number(a.shin.pX), p2 = Number(a.shin.p2);
    const fav = favoriKod(a.shin);
    const favO = Math.max(p1, pX, p2);
    const o = oranlarToto[m.mac_id];
    const impliedFav = (() => {
      const i1 = 1 / o['1'], iX = 1 / o.X, i2 = 1 / o['2'];
      const max = Math.max(i1, iX, i2);
      if (max === i1) return '1';
      if (max === i2) return '2';
      return 'X';
    })();
    return {
      mac_id: m.mac_id, isim: `${m.ev_sahibi} - ${m.deplasman}`,
      fav, favO, p1, pX, p2, celiski: fav !== impliedFav,
      onerilen: secimOnerisi(a).secim, gollu: a.gollu
    };
  }).filter(Boolean);

  if (!analizler.length) { showToast('error', 'Veri Yok', 'En az 1 maç için oran gir.'); return; }

  const dengeli = analizler.filter(a => a.favO >= 50 && a.favO < 65);
  const netFavori = analizler.filter(a => a.favO >= 65);
  const celiskili = analizler.filter(a => a.celiski);
  const kapsamaGerek = analizler.filter(a => a.favO >= 52 && a.favO < 65);

  let kapsananMac = 0;
  const toplamMac = analizler.length;
  analizler.forEach(a => {
    const sec = secimlerToto[a.mac_id] || [];
    if (sec.includes(a.fav)) kapsananMac++;
    else if (sec.length >= 2) kapsananMac += 0.5;
  });
  const kapsamaSkoru = toplamMac ? ((kapsananMac / toplamMac) * 100).toFixed(0) : 0;

  let seviye, seviyeRenk, seviyeEmoji;
  if (kapsamaSkoru >= 80) { seviye = 'MÜKEMMEL'; seviyeRenk = 'green'; seviyeEmoji = '🏆'; }
  else if (kapsamaSkoru >= 60) { seviye = 'İYİ'; seviyeRenk = 'green'; seviyeEmoji = '✅'; }
  else if (kapsamaSkoru >= 40) { seviye = 'ORTA'; seviyeRenk = 'orange'; seviyeEmoji = '⚠️'; }
  else { seviye = 'ZAYIF'; seviyeRenk = 'red'; seviyeEmoji = '❌'; }

  let html = `
    <div class="card" style="border:2px solid var(--purple)">
      <div class="result-title">🔍 HAFTANIN PARMAK İZİ</div>
      <div class="muted" style="font-size:.72rem;margin-bottom:12px">${toplamMac} maç · ${new Date().toLocaleDateString('tr-TR')}</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:12px">
        <div style="padding:10px;background:var(--bg3);border-radius:8px;text-align:center">
          <div style="font-size:1.4rem;font-weight:900;color:var(--orange)">${dengeli.length}</div>
          <div style="font-size:.65rem;color:var(--muted)">DENGELİ MAÇ</div>
          <div style="font-size:.6rem;color:var(--muted)">%50-65</div>
        </div>
        <div style="padding:10px;background:var(--bg3);border-radius:8px;text-align:center">
          <div style="font-size:1.4rem;font-weight:900;color:var(--green)">${netFavori.length}</div>
          <div style="font-size:.65rem;color:var(--muted)">NET FAVORİ</div>
          <div style="font-size:.6rem;color:var(--muted)">%65+</div>
        </div>
        <div style="padding:10px;background:var(--bg3);border-radius:8px;text-align:center">
          <div style="font-size:1.4rem;font-weight:900;color:var(--red)">${celiskili.length}</div>
          <div style="font-size:.65rem;color:var(--muted)">ÇELİŞKİLİ</div>
          <div style="font-size:.6rem;color:var(--muted)">model ≠ piyasa</div>
        </div>
        <div style="padding:10px;background:var(--bg3);border-radius:8px;text-align:center">
          <div style="font-size:1.4rem;font-weight:900;color:var(--blue)">${kapsamaGerek.length}</div>
          <div style="font-size:.65rem;color:var(--muted)">KAPSAMA</div>
          <div style="font-size:.6rem;color:var(--muted)">çift şans</div>
        </div>
      </div>
      <div style="padding:14px;background:linear-gradient(135deg,rgba(168,85,247,.15),rgba(0,230,118,.08));border-radius:12px;border:2px solid var(--${seviyeRenk});text-align:center;margin-bottom:12px">
        <div style="font-size:.7rem;color:var(--muted);font-weight:800">KUPON KAPSAMA SKORU</div>
        <div style="font-size:2rem;font-weight:900;color:var(--${seviyeRenk});margin:4px 0">%${kapsamaSkoru}</div>
        <div style="font-size:.85rem;font-weight:900;color:var(--${seviyeRenk})">${seviyeEmoji} ${seviye}</div>
      </div>
      <div class="yorum-box ${celiskili.length >= 5 ? 'tehlike' : celiskili.length >= 2 ? 'riskli' : ''}">
        <div class="baslik">💡 YORUM</div>
        ${dengeli.length >= 5 ? `<p>• Bu hafta <span class="vurgu-riskli">${dengeli.length} dengeli maç</span> var. Çift şans ağırlıklı oyna.</p>` : ''}
        ${netFavori.length >= 5 ? `<p>• <span class="vurgu">${netFavori.length} net favori</span> var. Banko değerlendirilebilir.</p>` : ''}
        ${celiskili.length >= 2 ? `<p>• <span class="vurgu-tehlike">${celiskili.length} maçta</span> model ile piyasa çelişiyor.</p>` : ''}
        ${kapsamaGerek.length >= 3 ? `<p>• <span class="vurgu-riskli">${kapsamaGerek.length} maç</span> kapsama gerektiriyor.</p>` : ''}
        ${kapsamaSkoru < 40 ? `<p>• <span class="vurgu-tehlike">Kuponun zayıf.</span> Daha fazla maç seç.</p>` : ''}
        ${kapsamaSkoru >= 80 ? `<p>• <span class="vurgu">Kuponun çok iyi!</span></p>` : ''}
      </div>
      ${dengeli.length > 0 ? `
        <div style="margin-top:12px">
          <div style="font-size:.75rem;font-weight:900;color:var(--orange);margin-bottom:8px">⚖️ EN DENGELİ 3</div>
          ${dengeli.sort((a,b) => a.favO - b.favO).slice(0, 3).map(d => `
            <div style="padding:8px 0;border-bottom:1px solid var(--border);font-size:.72rem">
              <div style="font-weight:800">${escapeHTML(d.isim)}</div>
              <div class="muted">Favori: ${d.fav} (%${d.favO.toFixed(1)}) · Öneri: ${d.onerilen}</div>
            </div>`).join('')}
        </div>` : ''}
      ${celiskili.length > 0 ? `
        <div style="margin-top:12px">
          <div style="font-size:.75rem;font-weight:900;color:var(--red);margin-bottom:8px">⚠️ EN ÇELİŞKİLİ 3</div>
          ${celiskili.slice(0, 3).map(d => `
            <div style="padding:8px 0;border-bottom:1px solid var(--border);font-size:.72rem">
              <div style="font-weight:800">${escapeHTML(d.isim)}</div>
              <div class="muted">Model: ${d.fav} (%${d.favO.toFixed(1)}) · Piyasa farklı</div>
            </div>`).join('')}
        </div>` : ''}
      <div class="muted" style="font-size:.65rem;margin-top:12px;padding:8px;background:var(--bg3);border-radius:6px;text-align:center">📌 Bu rapor model tahminidir. Kazanç garantisi vermez.</div>
      <button type="button" class="btn btn-purple btn-lg" onclick="paylasParmakIzi()" style="margin-top:12px">📤 TELEGRAM'DA PAYLAŞ</button>
    </div>`;

  if ($('totoKuponSonuc')) $('totoKuponSonuc').innerHTML = html;
  window.sonParmakIzi = {
    toplamMac, dengeli: dengeli.length, netFavori: netFavori.length,
    celiskili: celiskili.length, kapsamaGerek: kapsamaGerek.length,
    kapsamaSkoru, seviye, seviyeEmoji,
    enDengeli: dengeli.slice(0, 3), enCeliskili: celiskili.slice(0, 3)
  };
}

function paylasParmakIzi() {
  const p = window.sonParmakIzi;
  if (!p) { showToast('error', 'Boş', 'Önce Parmak İzi oluştur.'); return; }
  let metin = '🔍 SKORLAB · HAFTANIN PARMAK İZİ\n';
  metin += `📅 ${new Date().toLocaleDateString('tr-TR')}\n\n`;
  metin += `📊 ${p.toplamMac} MAÇLIK BÜLTEN\n\n`;
  metin += `⚖️ Dengeli: ${p.dengeli} maç\n✅ Net Favori: ${p.netFavori} maç\n⚠️ Çelişkili: ${p.celiskili} maç\n🎯 Kapsama: ${p.kapsamaGerek} maç\n\n`;
  metin += `🏆 KAPSAMA SKORU: %${p.kapsamaSkoru}\n${p.seviyeEmoji} ${p.seviye}\n\n`;
  if (p.enDengeli?.length) {
    metin += `⚖️ EN DENGELİ\n`;
    p.enDengeli.forEach((d, i) => { metin += `${i+1}. ${d.isim}\n   Favori: ${d.fav} (%${d.favO.toFixed(1)})\n`; });
    metin += '\n';
  }
  metin += '📌 Tahminler garanti değildir.\n📱 @SkorLabBot';
  paylasMetni(metin, 'SkorLab Haftanın Parmak İzi');
}

/* ============================================================
   14. ANALİZ MODAL
   ============================================================ */
function analizGosterToto(id) {
  const m = maclarToto.find(x => String(x.mac_id) === String(id));
  if (!m) return;
  const a = getAnalysisForMatch(id);
  if (!a) { showToast('error', 'Oran Eksik', 'Geçerli 1, X ve 2 oranlarını gir.'); return; }
  analizOrtak(`${m.ev_sahibi} - ${m.deplasman}`, a);
}

function analizOrtak(isim, a) {
  if ($('analizTitle')) $('analizTitle').textContent = `📊 ${isim}`;
  if (!$('analizBody')) return;
  $('analizBody').innerHTML = `
    <div style="font-size:.85rem;line-height:1.8">
      <div class="analiz-box" style="border:2px solid var(--green)">
        <span class="analiz-lbl">🎯 MODEL FAVORİSİ</span>
        <div style="text-align:center;font-size:1.4rem;font-weight:900;color:var(--green);padding:8px 0">${favoriKod(a.shin)} · %${favoriOlas(a.shin)}</div>
      </div>
      <div class="analiz-box">
        <span class="analiz-lbl">📊 SHIN · MARJ ARINDIRMA</span>
        <div class="analiz-row"><span>1:</span><b>%${a.shin.p1}</b></div>
        <div class="analiz-row"><span>X:</span><b>%${a.shin.pX}</b></div>
        <div class="analiz-row"><span>2:</span><b>%${a.shin.p2}</b></div>
        <div class="analiz-row"><span class="muted">Marj:</span><b style="color:var(--orange)">%${a.marj}</b></div>
      </div>
      <div class="analiz-box">
        <span class="analiz-lbl">⚽ POISSON · xG ${a.xgEv} - ${a.xgDep}</span>
        <div class="analiz-row"><span>1 / Ev sahibi:</span><b>%${a.poi.p1}</b></div>
        <div class="analiz-row"><span>X / Beraberlik:</span><b>%${a.poi.pX}</b></div>
        <div class="analiz-row"><span>2 / Deplasman:</span><b>%${a.poi.p2}</b></div>
        <div class="analiz-row"><span>2.5 Üst:</span><b class="${Number(a.poi.pUst25) >= 55 ? 'green' : 'orange'}">%${a.poi.pUst25}</b></div>
        <div class="analiz-row"><span>2.5 Alt:</span><b>%${a.poi.pAlt25}</b></div>
        <div class="analiz-row"><span>KG Var:</span><b class="${Number(a.poi.pKgVar) >= 55 ? 'green' : 'orange'}">%${a.poi.pKgVar}</b></div>
        <div class="analiz-row"><span>KG Yok:</span><b>%${a.poi.pKgYok}</b></div>
      </div>
      <div class="analiz-box">
        <span class="analiz-lbl">⚽ EN OLASI SKORLAR</span>
        <div class="skor-grid">${a.poi.enOlası.map(s => `<div class="skor-item"><div class="skor-sayi">${s.skor}</div><div class="skor-yuzde">%${s.yuzde}</div></div>`).join('')}</div>
      </div>
      <div class="analiz-box">
        <span class="analiz-lbl">📌 GOL DURUMU</span>
        <div style="text-align:center;padding:8px 0">
          <span class="gol-etiket ${a.gollu.includes('ÇOK') || a.gollu.includes('GOLLÜ') ? 'gol-yes' : a.gollu.includes('ORTA') ? 'gol-orta' : 'gol-no'}" style="font-size:.8rem;padding:6px 14px">${a.gollu}</span>
        </div>
      </div>
      <div class="muted" style="font-size:.7rem">Olasılıklar oranlardan türetilen model tahminleridir; gerçek sonuç garantisi değildir.</div>
    </div>`;
  $('analizModal')?.classList.add('active');
}

/* ============================================================
   15. KAYITLI KUPONLAR
   ============================================================ */
function renderKayitliKuponlar() {
  const c = $('kayitliKuponlar');
  if (!c) return;
  if (!kayitliKuponlar.length) {
    c.innerHTML = '<div class="muted" style="text-align:center;padding:20px">Kayıtlı kupon yok.</div>';
    return;
  }
  c.innerHTML = kayitliKuponlar.map(k => {
    const durum = ['kazandi', 'kaybetti', 'bekliyor'].includes(k.durum) ? k.durum : 'bekliyor';
    const emoji = durum === 'kazandi' ? '✅' : durum === 'kaybetti' ? '❌' : '⏳';
    const ikon = k.tip === 'bankobot' ? '🤖' : '📋';
    return `
      <div class="kupon-gecmis ${durum}" role="button" tabindex="0" onclick="kuponDetayAc(${Number(k.id)})" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();kuponDetayAc(${Number(k.id)})}">
        <div style="display:flex;justify-content:space-between;gap:8px;font-size:.8rem;margin-bottom:4px">
          <span>${emoji} ${ikon} <b>${Number(k.macSayisi) || 0} maç</b></span>
          <span class="muted">${escapeHTML(k.tarih || '')}</span>
        </div>
        <div style="font-size:.72rem;color:var(--muted)">Kolon: <b>${Number(k.kolon) || 1}</b> · Tutar: <b style="color:var(--green)">${Number(k.tutar) || 0} TL</b></div>
      </div>`;
  }).join('');
}

function kuponDetayAc(id) {
  const k = kayitliKuponlar.find(x => Number(x.id) === Number(id));
  if (!k) return;
  const durum = ['kazandi', 'kaybetti', 'bekliyor'].includes(k.durum) ? k.durum : 'bekliyor';
  const emoji = durum === 'kazandi' ? '✅' : durum === 'kaybetti' ? '❌' : '⏳';
  const detaylar = Array.isArray(k.detaylar) ? k.detaylar : [];
  if (!$('kuponDetayBody')) return;
  $('kuponDetayBody').innerHTML = `
    <div style="font-size:.8rem">
      <div class="muted" style="margin-bottom:10px">${emoji} ${escapeHTML(k.tarih || '')} · ${Number(k.macSayisi) || 0} maç · ${Number(k.tutar) || 0} TL</div>
      <div style="max-height:400px;overflow-y:auto;background:var(--bg3);border-radius:8px;padding:10px">
        ${detaylar.map(d => `
          <div style="padding:8px 0;border-bottom:1px solid var(--border)">
            <div style="font-weight:800;margin-bottom:4px">${escapeHTML(d.isim)}</div>
            <div style="color:var(--green);font-weight:900;text-align:right">${escapeHTML(d.secim)}</div>
            ${d.favori ? `<div class="muted" style="text-align:right">Favori: ${escapeHTML(d.favori)}</div>` : ''}
          </div>`).join('')}
      </div>
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:6px;margin-top:12px">
        <button type="button" class="btn ${durum === 'kazandi' ? 'btn-green' : 'btn-gray'}" onclick="kuponDurum(${Number(k.id)},'kazandi')">✅ Kazandı</button>
        <button type="button" class="btn ${durum === 'bekliyor' ? 'btn-orange' : 'btn-gray'}" onclick="kuponDurum(${Number(k.id)},'bekliyor')">⏳ Bekliyor</button>
        <button type="button" class="btn ${durum === 'kaybetti' ? 'btn-red' : 'btn-gray'}" onclick="kuponDurum(${Number(k.id)},'kaybetti')">❌ Kaybetti</button>
      </div>
      <button type="button" class="btn btn-red btn-lg" onclick="kuponSil(${Number(k.id)})" style="margin-top:10px">🗑️ Sil</button>
    </div>`;
  $('kuponDetayModal')?.classList.add('active');
}

function kuponDurum(id, durum) {
  if (!['kazandi', 'kaybetti', 'bekliyor'].includes(durum)) return;
  const k = kayitliKuponlar.find(x => Number(x.id) === Number(id));
  if (!k) return;
  k.durum = durum;
  persistCoupons(); closeModal('kuponDetayModal'); renderKayitliKuponlar();
}

function kuponSil(id) {
  if (!confirm('Kupon silinsin mi?')) return;
  kayitliKuponlar = kayitliKuponlar.filter(x => Number(x.id) !== Number(id));
  persistCoupons(); closeModal('kuponDetayModal'); renderKayitliKuponlar();
}

/* ============================================================
   16. BACKTEST
   ============================================================ */
function renderBacktest() {
  const c = $('backtestListesi');
  if (!c) return;
  if (!backtestKayitlari.length) {
    c.innerHTML = '<div class="card"><div class="muted" style="text-align:center;padding:20px">Kayıt yok.</div></div>';
    return;
  }
  const tutan = backtestKayitlari.filter(b => b.tuttu === true).length;
  const tutmayan = backtestKayitlari.filter(b => b.tuttu === false).length;
  const degerlendirilen = tutan + tutmayan;
  const oran = degerlendirilen ? ((tutan / degerlendirilen) * 100).toFixed(1) : '0.0';

  c.innerHTML = `
    <div class="card">
      <div class="result-title">📊 İSTATİSTİK</div>
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;text-align:center;margin-top:8px">
        <div style="padding:10px;background:var(--bg3);border-radius:8px"><div style="font-size:1.4rem;font-weight:900;color:var(--green)">${tutan}</div><div style="font-size:.65rem;color:var(--muted)">TUTAN</div></div>
        <div style="padding:10px;background:var(--bg3);border-radius:8px"><div style="font-size:1.4rem;font-weight:900;color:var(--red)">${tutmayan}</div><div style="font-size:.65rem;color:var(--muted)">TUTMAYAN</div></div>
        <div style="padding:10px;background:var(--bg3);border-radius:8px"><div style="font-size:1.4rem;font-weight:900;color:var(--orange)">%${oran}</div><div style="font-size:.65rem;color:var(--muted)">BAŞARI</div></div>
      </div>
      <div class="muted" style="font-size:.68rem;margin-top:8px">Sonuç girilmemiş kayıtlar başarı yüzdesine dahil edilmez.</div>
    </div>
    <div class="card">
      <div class="result-title">📋 KAYITLAR (${backtestKayitlari.length})</div>
      ${backtestKayitlari.slice(0, 50).map(b => {
        const emoji = b.tuttu === true ? '✅' : b.tuttu === false ? '❌' : '⏳';
        return `
          <div style="padding:10px 0;border-bottom:1px solid var(--border);display:flex;justify-content:space-between;align-items:center;gap:8px">
            <div style="flex:1">
              <div style="font-weight:900;font-size:.8rem">${emoji} ${escapeHTML(b.isim)}</div>
              <div class="muted" style="font-size:.68rem">Öneri: ${escapeHTML(b.oneriTip)}${b.gercekSkor ? ' · Sonuç: ' + escapeHTML(b.gercekSkor) : ''}</div>
            </div>
            <button type="button" class="btn btn-red btn-sm" onclick="backtestSil(${Number(b.id)})">🗑️</button>
          </div>`;
      }).join('')}
    </div>`;
}

function backtestEkle() {
  const isim = $('bt-mac')?.value.trim() || '';
  const o1 = Number.parseFloat($('bt-o1')?.value);
  const oX = Number.parseFloat($('bt-oX')?.value);
  const o2 = Number.parseFloat($('bt-o2')?.value);
  const skor = $('bt-skor')?.value.trim() || '';

  if (!isim || !validOdds(o1, oX, o2)) { showToast('error', 'Eksik', 'Maç + geçerli 1-X-2 gir.'); return; }
  if (skor && !/^\d{1,2}-\d{1,2}$/.test(skor)) { showToast('error', 'Geçersiz Skor', 'Skoru 2-1 biçiminde gir.'); return; }

  const a = Motor.analiz({ o1, oX, o2 });
  let tuttu = null, gercekSkor = null;

  if (skor) {
    const [ev, dep] = skor.split('-').map(Number);
    if (ev > 20 || dep > 20) { showToast('error', 'Geçersiz', 'Gol sayısını kontrol et.'); return; }
    gercekSkor = `${ev}-${dep}`;
    const gercek = ev > dep ? '1' : ev < dep ? '2' : 'X';
    tuttu = secimOnerisi(a).secim.includes(gercek);
  }

  backtestKayitlari.unshift({
    id: Date.now(), isim,
    oneriTip: `${secimOnerisi(a).secim} · Favori ${favoriKod(a.shin)} (%${favoriOlas(a.shin)})`,
    gercekSkor, tuttu, tarih: new Date().toLocaleString('tr-TR')
  });
  backtestKayitlari = backtestKayitlari.slice(0, 200);
  persistBacktest();
  ['bt-mac', 'bt-o1', 'bt-oX', 'bt-o2', 'bt-skor'].forEach(id => { const el = $(id); if (el) el.value = ''; });
  renderBacktest();
  showToast('success', 'Eklendi!', tuttu === true ? 'TUTTU ✅' : tuttu === false ? 'TUTMADI ❌' : 'Skor yok');
}

function backtestSil(id) {
  if (!confirm('Bu kayıt silinsin mi?')) return;
  backtestKayitlari = backtestKayitlari.filter(x => Number(x.id) !== Number(id));
  persistBacktest(); renderBacktest();
}

function backtestTemizle() {
  if (!confirm('Tüm backtest kayıtları silinsin mi?')) return;
  backtestKayitlari = [];
  persistBacktest(); renderBacktest();
}

/* ============================================================
   17. PERFORMANS
   ============================================================ */
function renderPerformans() {
  const c = $('performansListesi');
  if (!c) return;

  if (!backtestKayitlari.length) {
    c.innerHTML = '<div class="card"><div class="muted" style="text-align:center;padding:20px">Henüz backtest kaydı yok.</div></div>';
    return;
  }

  const toplam = backtestKayitlari.length;
  const tutan = backtestKayitlari.filter(b => b.tuttu === true).length;
  const tutmayan = backtestKayitlari.filter(b => b.tuttu === false).length;
  const degerlendirilen = tutan + tutmayan;
  const oran = degerlendirilen ? ((tutan / degerlendirilen) * 100).toFixed(1) : '0.0';

  c.innerHTML = `
    <div class="card">
      <div class="result-title">📈 MODEL PERFORMANSI</div>
      <div class="muted" style="font-size:.72rem;margin-bottom:12px">Şeffaf başarı kaydı · Geçmiş performans garanti değildir</div>
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;text-align:center">
        <div style="padding:12px;background:var(--bg3);border-radius:8px">
          <div style="font-size:1.6rem;font-weight:900;color:var(--green)">${tutan}</div>
          <div style="font-size:.6rem;color:var(--muted)">TUTAN</div>
        </div>
        <div style="padding:12px;background:var(--bg3);border-radius:8px">
          <div style="font-size:1.6rem;font-weight:900;color:var(--red)">${tutmayan}</div>
          <div style="font-size:.6rem;color:var(--muted)">TUTMAYAN</div>
        </div>
        <div style="padding:12px;background:var(--bg3);border-radius:8px">
          <div style="font-size:1.6rem;font-weight:900;color:var(--orange)">%${oran}</div>
          <div style="font-size:.6rem;color:var(--muted)">BAŞARI</div>
        </div>
      </div>
      <div class="muted" style="font-size:.68rem;margin-top:12px;text-align:center">Toplam ${toplam} tahmin · ${degerlendirilen} değerlendirildi</div>
    </div>
    <div class="card" style="border:2px solid var(--orange)">
      <div class="result-title" style="color:var(--orange)">⚠️ ÖNEMLİ UYARI</div>
      <div style="font-size:.78rem;line-height:1.7">
        <p>• Bu istatistikler <b>geçmiş</b> tahminlere dayanır.</p>
        <p>• <b>Gelecek sonuçları garanti etmez.</b></p>
        <p>• Veri kalitesi, lig farkları ve model hataları sonuçları etkiler.</p>
        <p>• Hiçbir algoritma sürekli kazanç sağlamaz.</p>
      </div>
    </div>`;
}

/* ============================================================
   18. ARŞİV
   ============================================================ */
function bultenArsivle() {
  if (!maclarToto.length) { showToast('error', 'Maç Yok', 'Arşivlenecek maç yok.'); return; }

  const arsiv = {
    tarih: new Date().toISOString().split('T')[0],
    hafta: $('weekTitle')?.textContent || 'bilinmiyor',
    maclar: maclarToto.map(m => {
      const o = oranlarToto[m.mac_id] || {};
      const a = getAnalysisForMatch(m.mac_id);
      return {
        mac_id: m.mac_id, ev: m.ev_sahibi, dep: m.deplasman,
        oran: { '1': o['1'], X: o.X, '2': o['2'] },
        model: a ? { fav: favoriKod(a.shin), favO: favoriOlas(a.shin), skor: a.poi.enOlası[0].skor, gollu: a.gollu } : null
      };
    })
  };

  arsivKayitlari.unshift(arsiv);
  arsivKayitlari = arsivKayitlari.slice(0, 52);
  persistArsiv();
  renderArsiv();
  showToast('success', 'Arşivlendi!', `${maclarToto.length} maç kaydedildi.`);
}

function arsivIndir() {
  if (!arsivKayitlari.length) { showToast('error', 'Boş', 'Arşiv yok. Önce "Arşivle" bas.'); return; }
  const json = JSON.stringify(arsivKayitlari, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `skorlab_arsiv_${new Date().toISOString().split('T')[0]}.json`;
  a.click();
  URL.revokeObjectURL(url);
  showToast('success', 'İndirildi!', 'Arşiv JSON olarak indi.');
}

function renderArsiv() {
  const c = $('arsivListesi');
  if (!c) return;
  if (!arsivKayitlari.length) {
    c.innerHTML = '<div class="muted" style="text-align:center;padding:20px">Arşiv boş. "Arşivle" butonuna bas.</div>';
    return;
  }
  c.innerHTML = `
    <div class="card">
      <div class="result-title">📁 ARŞİV (${arsivKayitlari.length} hafta)</div>
      ${arsivKayitlari.map(a => `
        <div style="padding:10px 0;border-bottom:1px solid var(--border);font-size:.78rem">
          <div style="font-weight:900">${escapeHTML(a.hafta)}</div>
          <div class="muted">${escapeHTML(a.tarih)} · ${a.maclar.length} maç</div>
        </div>`).join('')}
    </div>`;
}

/* ============================================================
   19. SEKME VE MODAL
   ============================================================ */
function switchTab(i, el) {
  document.querySelectorAll('.tab, .page').forEach(node => node.classList.remove('active'));
  if (el) el.classList.add('active');
  const page = $('page-' + i);
  if (page) page.classList.add('active');
  if (i === 3) renderAnaliz();
  if (i === 4) renderKayitliKuponlar();
  if (i === 5) renderBacktest();
  if (i === 6) renderPerformans();
  if (i === 7) renderArsiv();
}

function closeModal(id) {
  const el = $(id);
  if (el) el.classList.remove('active');
}

function showToast(type, title, msg) {
  const icon = $('toastIcon'), titleEl = $('toastTitle'), msgEl = $('toastMsg'), modal = $('toastModal');
  if (icon) icon.textContent = type === 'success' ? '✅' : '❌';
  if (titleEl) titleEl.textContent = title;
  if (msgEl) msgEl.textContent = msg;
  if (modal) modal.classList.add('active');
}

/* ============================================================
   20. BAŞLAT
   ============================================================ */
window.addEventListener('DOMContentLoaded', () => {
  initTelegram();
  loadData();
});
