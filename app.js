/* ============================================================
   SKORLAB v23 · SANAL İDDAA OYUNU
   Coin sistemi + Bahis + Sonuç girişi
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
  } catch (e) { return fallback; }
}
function safeSaveJSON(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); return true; }
  catch (e) { return false; }
}
function escapeHTML(value) {
  return String(value ?? '').replace(/[&<>"']/g, ch => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[ch]));
}
function validOdds(...values) {
  return values.every(v => v !== '' && v !== null && v !== undefined &&
    Number.isFinite(Number(v)) && Number(v) > 1);
}
function bugun() { return new Date().toISOString().split('T')[0]; }
function formatCoin(n) {
  return Number(n || 0).toLocaleString('tr-TR');
}

/* ============================================================
   1. TELEGRAM
   ============================================================ */
function initTelegram() {
  if (!window.Telegram?.WebApp) return;
  TG = window.Telegram.WebApp;
  try {
    TG.ready(); TG.expand();
    if (typeof TG.enableClosingConfirmation === 'function') TG.enableClosingConfirmation();
  } catch (e) {}
}

/* ============================================================
   2. TİTREŞİM + SES
   ============================================================ */
let titreşimAktif = safeReadJSON('skorlab_titreşim', true);
let sesAktif = safeReadJSON('skorlab_ses', true);

function titreşim(ms = 30) {
  if (!titreşimAktif) return;
  try {
    if (navigator.vibrate) navigator.vibrate(ms);
    else if (TG?.HapticFeedback) TG.HapticFeedback.impactOccurred('light');
  } catch (e) {}
}
function sesCal(tur) {
  if (!sesAktif) return;
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain); gain.connect(ctx.destination);
    if (tur === 'tik') { osc.frequency.value = 600; gain.gain.value = 0.05; }
    else if (tur === 'ok') { osc.frequency.value = 880; gain.gain.value = 0.1; }
    else if (tur === 'kazanc') { osc.frequency.value = 1200; gain.gain.value = 0.12; }
    else if (tur === 'hata') { osc.frequency.value = 300; gain.gain.value = 0.1; }
    osc.start();
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.2);
    osc.stop(ctx.currentTime + 0.2);
  } catch (e) {}
}

/* ============================================================
   3. OYUN VERİLERİ
   ============================================================ */
let oyunKasa = safeReadJSON('skorlab_kasa', 1000);
let oyunSeri = safeReadJSON('skorlab_seri', 0);
let oyunSonGiris = safeReadJSON('skorlab_son_giris', '');
let oyunRozetler = safeReadJSON('skorlab_rozetler', []);
let oyunIsim = safeReadJSON('skorlab_isim', '');
let oyunToplamOynanan = safeReadJSON('skorlab_toplam_oynanan', 0);
let oyunToplamKazanc = safeReadJSON('skorlab_toplam_kazanc', 0);
let oyunToplamKayip = safeReadJSON('skorlab_toplam_kayip', 0);

if (typeof oyunKasa !== 'number' || oyunKasa < 0) oyunKasa = 1000;
if (typeof oyunSeri !== 'number') oyunSeri = 0;
if (typeof oyunSonGiris !== 'string') oyunSonGiris = '';
if (!Array.isArray(oyunRozetler)) oyunRozetler = [];
if (typeof oyunIsim !== 'string') oyunIsim = '';
if (typeof oyunToplamOynanan !== 'number') oyunToplamOynanan = 0;
if (typeof oyunToplamKazanc !== 'number') oyunToplamKazanc = 0;
if (typeof oyunToplamKayip !== 'number') oyunToplamKayip = 0;

function persistOyun() {
  safeSaveJSON('skorlab_kasa', oyunKasa);
  safeSaveJSON('skorlab_seri', oyunSeri);
  safeSaveJSON('skorlab_son_giris', oyunSonGiris);
  safeSaveJSON('skorlab_rozetler', oyunRozetler);
  safeSaveJSON('skorlab_isim', oyunIsim);
  safeSaveJSON('skorlab_toplam_oynanan', oyunToplamOynanan);
  safeSaveJSON('skorlab_toplam_kazanc', oyunToplamKazanc);
  safeSaveJSON('skorlab_toplam_kayip', oyunToplamKayip);
}

/* ============================================================
   4. OYUN VERİLERİ — BAHİSLER
   ============================================================ */
let totoBahisleri = safeReadJSON('skorlab_toto_bahisler', {}); // {mac_id: {secim: '1', coin: 100, oran: 2.5}}
let ligBahisleri = safeReadJSON('skorlab_lig_bahisler', {});   // {mac_id: {secim: '1', coin: 100, oran: 2.5}}

if (!totoBahisleri || typeof totoBahisleri !== 'object') totoBahisleri = {};
if (!ligBahisleri || typeof ligBahisleri !== 'object') ligBahisleri = {};

function persistBahisler() {
  safeSaveJSON('skorlab_toto_bahisler', totoBahisleri);
  safeSaveJSON('skorlab_lig_bahisler', ligBahisleri);
}

/* ============================================================
   5. SEVİYE
   ============================================================ */
const SEVIYELER = [
  { ad: 'Çaylak', min: 0, max: 500, ikon: '🥉' },
  { ad: 'Amatör', min: 500, max: 2000, ikon: '🥈' },
  { ad: 'Usta', min: 2000, max: 5000, ikon: '🥇' },
  { ad: 'Efsane', min: 5000, max: 10000, ikon: '💎' },
  { ad: 'Şampiyon', min: 10000, max: Infinity, ikon: '👑' }
];
function seviyeHesapla() {
  for (const s of SEVIYELER) {
    if (oyunKasa >= s.min && oyunKasa < s.max) return s;
  }
  return SEVIYELER[SEVIYELER.length - 1];
}

/* ============================================================
   6. ROZETLER
   ============================================================ */
const ROZETLER = [
  { id: 'ilk', ikon: '🎬', ad: 'İlk Adım', sart: () => oyunToplamOynanan >= 1 },
  { id: 'seri3', ikon: '🔥', ad: 'Ateşli', sart: () => oyunSeri >= 3 },
  { id: 'seri7', ikon: '🔥🔥', ad: 'Alev Aldı', sart: () => oyunSeri >= 7 },
  { id: 'kasa2k', ikon: '💰', ad: 'Zengin', sart: () => oyunKasa >= 2000 },
  { id: 'kasa5k', ikon: '💎', ad: 'Efsane', sart: () => oyunKasa >= 5000 },
  { id: 'kasa10k', ikon: '👑', ad: 'Şampiyon', sart: () => oyunKasa >= 10000 },
  { id: 'kazanc10', ikon: '🎯', ad: 'Keskin Nişancı', sart: () => oyunToplamKazanc >= 1000 },
  { id: 'oynanan50', ikon: '🎰', ad: 'Bağımlı', sart: () => oyunToplamOynanan >= 50 }
];

function rozetKontrol() {
  let yeni = false;
  ROZETLER.forEach(r => {
    if (!oyunRozetler.includes(r.id) && r.sart()) {
      oyunRozetler.push(r.id);
      yeni = true;
      setTimeout(() => {
        showToast('success', '🎖️ YENİ ROZET!', r.ikon + ' ' + r.ad);
        konfetiGoster(30);
        titreşim(100);
        sesCal('ok');
      }, 1500);
    }
  });
  if (yeni) persistOyun();
}

/* ============================================================
   7. ANİMASYONLAR
   ============================================================ */
function konfetiGoster(adet = 30) {
  let katman = $('konfetiKatman');
  if (!katman) return;
  const renkler = ['#00d97e', '#ff9f1c', '#8b5cf6', '#2979ff', '#ff3355', '#ffd700'];
  for (let i = 0; i < adet; i++) {
    const p = document.createElement('div');
    p.className = 'konfeti-parca';
    p.style.left = Math.random() * 100 + '%';
    p.style.background = renkler[Math.floor(Math.random() * renkler.length)];
    p.style.animationDelay = Math.random() * 0.5 + 's';
    p.style.animationDuration = (1.5 + Math.random() * 1.5) + 's';
    p.style.borderRadius = Math.random() > 0.5 ? '50%' : '2px';
    katman.appendChild(p);
    setTimeout(() => p.remove(), 3500);
  }
}

function ucanPuan(metin, renk = 'var(--green)') {
  let katman = $('ucanKatman');
  if (!katman) return;
  const el = document.createElement('div');
  el.className = 'ucan-puan';
  el.textContent = metin;
  el.style.color = renk;
  el.style.left = (30 + Math.random() * 40) + '%';
  el.style.top = '50%';
  katman.appendChild(el);
  setTimeout(() => el.remove(), 1600);
}

/* ============================================================
   8. PROFİL BARI
   ============================================================ */
function renderProfilBar() {
  const seviye = seviyeHesapla();
  if ($('pbIsim')) $('pbIsim').textContent = oyunIsim || 'Oyuncu';
  if ($('pbSeviye')) $('pbSeviye').textContent = seviye.ikon + ' ' + seviye.ad;
  if ($('pbCoin')) $('pbCoin').textContent = '💰 ' + formatCoin(Math.floor(oyunKasa));
  if ($('pbSeri')) $('pbSeri').textContent = '🔥 ' + oyunSeri + ' gün';

  // Kasa kartları (Toto + Lig)
  if ($('totoKasa')) $('totoKasa').textContent = formatCoin(Math.floor(oyunKasa));
  if ($('ligKasa')) $('ligKasa').textContent = formatCoin(Math.floor(oyunKasa));
  if ($('totoOynanan')) $('totoOynanan').textContent = formatCoin(oyunToplamOynanan);
  if ($('totoKazanc')) $('totoKazanc').textContent = formatCoin(Math.floor(oyunToplamKazanc));
  if ($('totoKayip')) $('totoKayip').textContent = formatCoin(Math.floor(oyunToplamKayip));
  if ($('ligOynanan')) $('ligOynanan').textContent = formatCoin(oyunToplamOynanan);
  if ($('ligKazanc')) $('ligKazanc').textContent = formatCoin(Math.floor(oyunToplamKazanc));
  if ($('ligKayip')) $('ligKayip').textContent = formatCoin(Math.floor(oyunToplamKayip));
}

/* ============================================================
   9. GÜNLÜK SERİ + BONUS
   ============================================================ */
function gunlukSeriKontrol() {
  const bugunT = bugun();
  if (oyunSonGiris === bugunT) return;

  const dun = new Date(Date.now() - 86400000).toISOString().split('T')[0];

  if (oyunSonGiris === dun) {
    oyunSeri++;
    oyunKasa += 100;
  } else if (oyunSonGiris === '') {
    oyunSeri = 1;
    oyunKasa += 100;
  } else {
    oyunSeri = 1;
    oyunKasa += 100;
  }

  oyunSonGiris = bugunT;
  persistOyun();
  renderProfilBar();

  setTimeout(() => {
    konfetiGoster(25);
    ucanPuan('+100 💰', 'var(--gold)');
    titreşim(50);
    sesCal('kazanc');
    showToast('success', '🔥 Gün ' + oyunSeri + '!', 'Günlük bonus: +100 SkorCoin');
  }, 800);
  rozetKontrol();
}

/* ============================================================
   10. VERİ
   ============================================================ */
let maclarToto = [];
let liglerData = {};
let kuponlar = safeReadJSON('skorlab_kuponlar', []);
if (!Array.isArray(kuponlar)) kuponlar = [];
function persistKuponlar() { safeSaveJSON('skorlab_kuponlar', kuponlar); }

async function loadData() {
  try {
    const res = await fetch('matches.json?v=23');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const raw = await res.json();
    maclarToto = Array.isArray(raw.maclar) ? raw.maclar : [];
    liglerData = raw.ligler || {};
  } catch (e) {
    maclarToto = [];
  }
  renderToto();
  renderLigler();
  renderAnaliz();
  renderKuponlar();
  renderSiralama();
  renderVip();
  renderProfilBar();
}

/* ============================================================
   11. ANALİZ MOTORU
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
    if (!validOdds(o1, oX, o2)) throw new Error('Geçersiz oran');
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
    if (!validOdds(o1, oX, o2)) throw new Error('Geçerli oran gerekli.');
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
      xgEv: xg.xgEv.toFixed(2), xgDep: xg.xgDep.toFixed(2),
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
   12. ORANLAR (matches.json'dan veya kullanıcı)
   ============================================================ */
// Toto maçları için oranlar (varsayılan tahmini)
const TOTO_ORANLARI = {
  1:{'1':1.15,'X':5.43,'2':8.11},2:{'1':2.40,'X':3.30,'2':2.90},
  3:{'1':2.80,'X':3.20,'2':2.50},4:{'1':6.00,'X':4.20,'2':1.50},
  5:{'1':1.35,'X':5.00,'2':7.50},6:{'1':2.40,'X':3.30,'2':2.90},
  7:{'1':2.30,'X':3.30,'2':3.00},8:{'1':1.90,'X':3.50,'2':4.00},
  9:{'1':2.50,'X':3.30,'2':2.80},10:{'1':2.20,'X':3.40,'2':3.10},
  11:{'1':4.50,'X':3.80,'2':1.75},12:{'1':4.00,'X':3.90,'2':1.80},
  13:{'1':1.40,'X':4.80,'2':6.50},14:{'1':2.30,'X':3.40,'2':3.00},
  15:{'1':2.10,'X':3.30,'2':3.50}
};

/* ============================================================
   13. TOTO EKRANI — BAHİS SİSTEMİ
   ============================================================ */
function renderToto() {
  const c = $('totoListesi');
  if (!c) return;
  if (!maclarToto.length) {
    c.innerHTML = '<div class="card"><div class="muted" style="text-align:center;padding:20px">Maç yok.</div></div>';
    updateKuponCubugu();
    return;
  }

  c.innerHTML = maclarToto.map(m => {
    const id = m.mac_id;
    const o = TOTO_ORANLARI[id] || { '1': 2, 'X': 3, '2': 3 };
    const b = totoBahisleri[id] || {};
    const secili = b.secim || '';
    const coin = b.coin || 0;
    const oran = secili ? (o[secili] || 0) : 0;
    const potansiyel = coin > 0 && oran > 0 ? Math.floor(coin * oran) : 0;

    return `
      <div class="mac-kart">
        <div class="mac-head">
          <span class="mac-no">#${escapeHTML(id)}</span>
          <span class="mac-saat">🕐 20:00</span>
          <button type="button" class="mac-analiz-btn" onclick="analizGosterToto(${Number(id)})">📊</button>
        </div>
        <div class="mac-teams">${escapeHTML(m.ev_sahibi)} <span style="color:var(--muted);font-weight:700">vs</span> ${escapeHTML(m.deplasman)}</div>

        <div class="oran-grid">
          <button type="button" class="oran-btn ${secili === '1' ? 'secili' : ''}" onclick="bahisSecToto(${Number(id)},'1')">
            <span class="oran-lbl">1</span>
            <span class="oran-deger">${o['1'].toFixed(2)}</span>
          </button>
          <button type="button" class="oran-btn ${secili === 'X' ? 'secili' : ''}" onclick="bahisSecToto(${Number(id)},'X')">
            <span class="oran-lbl">X</span>
            <span class="oran-deger">${o.X.toFixed(2)}</span>
          </button>
          <button type="button" class="oran-btn ${secili === '2' ? 'secili' : ''}" onclick="bahisSecToto(${Number(id)},'2')">
            <span class="oran-lbl">2</span>
            <span class="oran-deger">${o['2'].toFixed(2)}</span>
          </button>
        </div>

        ${secili ? `
          <div class="bahis-input-grup">
            <label>💰 BAHİS</label>
            <input type="number" min="1" max="1000" step="10" value="${coin || 10}" onchange="bahisCoinToto(${Number(id)},this.value)" inputmode="numeric">
            <span style="color:var(--muted);font-weight:900;font-size:.7rem">COIN</span>
          </div>
          <div class="bahis-hizli">
            <button type="button" onclick="bahisCoinToto(${Number(id)},10)">10</button>
            <button type="button" onclick="bahisCoinToto(${Number(id)},50)">50</button>
            <button type="button" onclick="bahisCoinToto(${Number(id)},100)">100</button>
            <button type="button" onclick="bahisCoinToto(${Number(id)},250)">250</button>
            <button type="button" onclick="bahisCoinToto(${Number(id)},500)">500</button>
          </div>
          <div class="potansiyel">
            <span>🎯 Kazanırsan:</span>
            <span>+${formatCoin(potansiyel)} 💰</span>
          </div>
        ` : ''}
      </div>
    `;
  }).join('');

  updateKuponCubugu();
}

function bahisSecToto(id, secim) {
  const o = TOTO_ORANLARI[id];
  if (!o || !o[secim]) return;

  if (!totoBahisleri[id]) totoBahisleri[id] = {};
  if (totoBahisleri[id].secim === secim) {
    // Aynı seçime basınca iptal
    delete totoBahisleri[id];
  } else {
    totoBahisleri[id].secim = secim;
    totoBahisleri[id].oran = o[secim];
    if (!totoBahisleri[id].coin) totoBahisleri[id].coin = 10;
  }
  persistBahisler();
  renderToto();
  updateKuponCubugu();
  titreşim(20); sesCal('tik');
}

function bahisCoinToto(id, val) {
  const coin = Math.max(0, Math.min(1000, Number(val) || 0));
  if (!totoBahisleri[id]) totoBahisleri[id] = {};
  totoBahisleri[id].coin = coin;
  persistBahisler();
  renderToto();
  updateKuponCubugu();
}

/* ============================================================
   14. LİG EKRANI — BAHİS SİSTEMİ
   ============================================================ */
function renderLigler() {
  const c = $('ligListesi');
  if (!c) return;

  if (!liglerData || !Object.keys(liglerData).length) {
    c.innerHTML = '<div class="card"><div class="muted" style="text-align:center;padding:20px">Maç yok.</div></div>';
    return;
  }

  let html = '';
  Object.entries(liglerData).forEach(([ligKey, lig]) => {
    html += `<div class="card">
      <div class="result-title">${lig.bayrak || '⚽'} ${escapeHTML(lig.isim)}</div>`;

    (lig.maclar || []).forEach(m => {
      const id = m.mac_id;
      // Varsayılan oranlar (yoksa 2.00)
      const o = m.oran || { '1': 2.00, 'X': 3.30, '2': 3.30 };
      const b = ligBahisleri[id] || {};
      const secili = b.secim || '';
      const coin = b.coin || 0;
      const oran = secili ? (o[secili] || 0) : 0;
      const potansiyel = coin > 0 && oran > 0 ? Math.floor(coin * oran) : 0;
      const sonucVar = m.sonuc !== null && m.sonuc !== undefined;

      html += `
        <div class="mac-kart" style="${sonucVar ? 'opacity:.6' : ''}">
          <div class="mac-head">
            <span class="mac-saat">🕐 ${escapeHTML(m.saat || '')}</span>
            ${sonucVar ? `<span style="color:var(--green);font-weight:900;font-size:.7rem">✅ ${m.sonuc.ev}-${m.sonuc.dep}</span>` : '<span class="canli">● CANLI</span>'}
          </div>
          <div class="mac-teams">${escapeHTML(m.ev)} <span style="color:var(--muted);font-weight:700">vs</span> ${escapeHTML(m.dep)}</div>

          <div class="oran-grid">
            <button type="button" class="oran-btn ${secili === '1' ? 'secili' : ''}" onclick="bahisSecLig(${id},'1')">
              <span class="oran-lbl">1</span>
              <span class="oran-deger">${o['1'].toFixed(2)}</span>
            </button>
            <button type="button" class="oran-btn ${secili === 'X' ? 'secili' : ''}" onclick="bahisSecLig(${id},'X')">
              <span class="oran-lbl">X</span>
              <span class="oran-deger">${o.X.toFixed(2)}</span>
            </button>
            <button type="button" class="oran-btn ${secili === '2' ? 'secili' : ''}" onclick="bahisSecLig(${id},'2')">
              <span class="oran-lbl">2</span>
              <span class="oran-deger">${o['2'].toFixed(2)}</span>
            </button>
          </div>

          ${secili && !sonucVar ? `
            <div class="bahis-input-grup">
              <label>💰 BAHİS</label>
              <input type="number" min="1" max="1000" step="10" value="${coin || 10}" onchange="bahisCoinLig(${id},this.value)" inputmode="numeric">
              <span style="color:var(--muted);font-weight:900;font-size:.7rem">COIN</span>
            </div>
            <div class="bahis-hizli">
              <button type="button" onclick="bahisCoinLig(${id},10)">10</button>
              <button type="button" onclick="bahisCoinLig(${id},50)">50</button>
              <button type="button" onclick="bahisCoinLig(${id},100)">100</button>
              <button type="button" onclick="bahisCoinLig(${id},250)">250</button>
              <button type="button" onclick="bahisCoinLig(${id},500)">500</button>
            </div>
            <div class="potansiyel">
              <span>🎯 Kazanırsan:</span>
              <span>+${formatCoin(potansiyel)} 💰</span>
            </div>
          ` : ''}
        </div>
      `;
    });

    html += `</div>`;
  });

  c.innerHTML = html;
}

function bahisSecLig(id, secim) {
  // Oranı bul
  let oran = null;
  for (const lig of Object.values(liglerData)) {
    const m = (lig.maclar || []).find(x => x.mac_id === id);
    if (m) {
      const o = m.oran || { '1': 2, 'X': 3.3, '2': 3.3 };
      oran = o[secim];
      break;
    }
  }
  if (!oran) return;

  if (!ligBahisleri[id]) ligBahisleri[id] = {};
  if (ligBahisleri[id].secim === secim) {
    delete ligBahisleri[id];
  } else {
    ligBahisleri[id].secim = secim;
    ligBahisleri[id].oran = oran;
    if (!ligBahisleri[id].coin) ligBahisleri[id].coin = 10;
  }
  persistBahisler();
  renderLigler();
  updateKuponCubugu();
  titreşim(20); sesCal('tik');
}

function bahisCoinLig(id, val) {
  const coin = Math.max(0, Math.min(1000, Number(val) || 0));
  if (!ligBahisleri[id]) ligBahisleri[id] = {};
  ligBahisleri[id].coin = coin;
  persistBahisler();
  renderLigler();
  updateKuponCubugu();
}

/* ============================================================
   15. ALT KUPON ÇUBUĞU
   ============================================================ */
function updateKuponCubugu() {
  let toplam = 0;
  let bahisSayisi = 0;
  Object.values(totoBahisleri).forEach(b => {
    if (b.secim && b.coin > 0) { toplam += b.coin; bahisSayisi++; }
  });
  Object.values(ligBahisleri).forEach(b => {
    if (b.secim && b.coin > 0) { toplam += b.coin; bahisSayisi++; }
  });
  if ($('kcToto')) $('kcToto').textContent = bahisSayisi;
  if ($('kcToplam')) $('kcToplam').textContent = formatCoin(toplam) + ' 💰';
}

/* ============================================================
   16. BAHİSLERİ ONAYLA
   ============================================================ */
function tumBahisleriOnayla() {
  let toplam = 0;
  let sayi = 0;
  Object.values(totoBahisleri).forEach(b => {
    if (b.secim && b.coin > 0) { toplam += b.coin; sayi++; }
  });
  Object.values(ligBahisleri).forEach(b => {
    if (b.secim && b.coin > 0) { toplam += b.coin; sayi++; }
  });

  if (sayi === 0) {
    showToast('error', 'Boş', 'Önce bahis seç.');
    return;
  }
  if (toplam > oyunKasa) {
    showToast('error', 'Yetersiz Kasa', 'Kasanda ' + formatCoin(oyunKasa) + ' 💰 var.');
    return;
  }

  if (!confirm(sayi + ' bahis · Toplam ' + formatCoin(toplam) + ' 💰\nOnaylıyor musun?')) return;

  // Kasayı düş
  oyunKasa -= toplam;
  oyunToplamOynanan += sayi;
  persistOyun();
  renderProfilBar();

  // Kuponu kaydet
  kuponlar.unshift({
    id: Date.now(),
    tarih: new Date().toLocaleString('tr-TR'),
    tip: 'bahis',
    toplamCoin: toplam,
    bahisSayisi: sayi,
    toto: JSON.parse(JSON.stringify(totoBahisleri)),
    lig: JSON.parse(JSON.stringify(ligBahisleri)),
    durum: 'bekliyor'
  });
  kuponlar = kuponlar.slice(0, 50);
  persistKuponlar();

  // Bahisleri temizle
  totoBahisleri = {};
  ligBahisleri = {};
  persistBahisler();

  renderToto();
  renderLigler();
  updateKuponCubugu();
  renderKuponlar();

  titreşim(100);
  sesCal('ok');
  ucanPuan('-' + formatCoin(toplam) + ' 💰', 'var(--red)');
  showToast('success', '✅ Bahisler Alındı', sayi + ' bahis · ' + formatCoin(toplam) + ' 💰');
  rozetKontrol();
}

function tumSecimleriSil() {
  if (!confirm('Tüm bahisler silinsin mi?')) return;
  totoBahisleri = {};
  ligBahisleri = {};
  persistBahisler();
  renderToto();
  renderLigler();
  updateKuponCubugu();
}

function ligTemizle() { tumSecimleriSil(); }

/* ============================================================
   17. SONUÇ GİRME EKRANI
   ============================================================ */
function sonuclariGirAc() {
  const body = $('sonucBody');
  if (!body) return;

  // Bekleyen kuponları bul
  const bekleyen = kuponlar.filter(k => k.durum === 'bekliyor');
  if (!bekleyen.length) {
    body.innerHTML = '<div class="muted" style="text-align:center;padding:20px">Bekleyen bahis yok.</div>';
    $('sonucModal').classList.add('active');
    return;
  }

  let html = '';
  bekleyen.forEach(k => {
    html += `<div class="card" style="margin-bottom:12px">
      <div class="result-title">📋 Kupon #${k.id.toString().slice(-6)}</div>
      <div class="muted" style="margin-bottom:10px">${k.tarih} · ${k.bahisSayisi} bahis · ${formatCoin(k.toplamCoin)} 💰</div>`;

    // Toto bahisleri
    Object.entries(k.toto || {}).forEach(([id, b]) => {
      const m = maclarToto.find(x => String(x.mac_id) === String(id));
      if (!m) return;
      html += `
        <div style="padding:8px 0;border-bottom:1px solid var(--border)">
          <div style="font-weight:800;font-size:.8rem;margin-bottom:4px">${escapeHTML(m.ev_sahibi)} - ${escapeHTML(m.deplasman)}</div>
          <div style="font-size:.7rem;color:var(--muted)">Bahis: <b style="color:var(--orange)">${b.secim}</b> × ${b.oran} · ${b.coin} 💰</div>
          <div style="display:flex;gap:6px;margin-top:6px">
            <button type="button" class="btn btn-green btn-sm" onclick="sonucKaydet('${k.id}','toto','${id}','1')">1</button>
            <button type="button" class="btn btn-orange btn-sm" onclick="sonucKaydet('${k.id}','toto','${id}','X')">X</button>
            <button type="button" class="btn btn-green btn-sm" onclick="sonucKaydet('${k.id}','toto','${id}','2')">2</button>
          </div>
        </div>`;
    });

    // Lig bahisleri
    Object.entries(k.lig || {}).forEach(([id, b]) => {
      let m = null;
      for (const lig of Object.values(liglerData)) {
        m = (lig.maclar || []).find(x => String(x.mac_id) === String(id));
        if (m) break;
      }
      if (!m) return;
      html += `
        <div style="padding:8px 0;border-bottom:1px solid var(--border)">
          <div style="font-weight:800;font-size:.8rem;margin-bottom:4px">${escapeHTML(m.ev)} - ${escapeHTML(m.dep)}</div>
          <div style="font-size:.7rem;color:var(--muted)">Bahis: <b style="color:var(--orange)">${b.secim}</b> × ${b.oran} · ${b.coin} 💰</div>
          <div style="display:flex;gap:6px;margin-top:6px">
            <button type="button" class="btn btn-green btn-sm" onclick="sonucKaydet('${k.id}','lig','${id}','1')">1</button>
            <button type="button" class="btn btn-orange btn-sm" onclick="sonucKaydet('${k.id}','lig','${id}','X')">X</button>
            <button type="button" class="btn btn-green btn-sm" onclick="sonucKaydet('${k.id}','lig','${id}','2')">2</button>
          </div>
        </div>`;
    });

    html += `</div>`;
  });

  body.innerHTML = html;
  $('sonucModal').classList.add('active');
}

function sonucKaydet(kuponId, tip, macId, sonuc) {
  const k = kuponlar.find(x => String(x.id) === String(kuponId));
  if (!k) return;
  const bahis = tip === 'toto' ? k.toto[macId] : k.lig[macId];
  if (!bahis) return;

  // Zaten işaretlenmiş mi?
  if (bahis.sonuc) {
    showToast('info', 'Zaten Girildi', 'Bu maç için sonuç zaten girildi.');
    return;
  }

  bahis.sonuc = sonuc;
  bahis.tuttu = bahis.secim === sonuc;

  // Kazanç hesapla
  if (bahis.tuttu) {
    const kazanc = Math.floor(bahis.coin * bahis.oran);
    oyunKasa += kazanc;
    oyunToplamKazanc += kazanc;
    ucanPuan('+' + formatCoin(kazanc) + ' 💰', 'var(--green)');
    konfetiGoster(15);
    titreşim(80);
    sesCal('kazanc');
  } else {
    oyunToplamKayip += bahis.coin;
    titreşim(30);
    sesCal('hata');
  }

  persistOyun();
  persistKuponlar();
  renderProfilBar();

  // Tüm bahisler sonuçlandı mı?
  const tumTotoSonuc = Object.values(k.toto || {}).every(b => b.sonuc);
  const tumLigSonuc = Object.values(k.lig || {}).every(b => b.sonuc);
  if (tumTotoSonuc && tumLigSonuc) {
    k.durum = 'sonuclandi';
    persistKuponlar();
  }

  sonuclariGirAc(); // Yenile
  renderKuponlar();
  rozetKontrol();
}

/* ============================================================
   18. KUPONLAR
   ============================================================ */
function renderKuponlar() {
  const c = $('kayitliKuponlar');
  if (!c) return;
  if (!kuponlar.length) {
    c.innerHTML = '<div class="muted" style="text-align:center;padding:20px">Kupon yok.</div>';
    return;
  }

  c.innerHTML = kuponlar.map(k => {
    const durum = k.durum || 'bekliyor';
    const emoji = durum === 'sonuclandi' ? '✅' : '⏳';
    return `
      <div class="kupon-gecmis ${durum}" onclick="kuponDetayAc(${Number(k.id)})">
        <div style="display:flex;justify-content:space-between;gap:8px;font-size:.8rem;margin-bottom:4px">
          <span>${emoji} <b>${k.bahisSayisi || 0} bahis</b></span>
          <span class="muted">${escapeHTML(k.tarih || '')}</span>
        </div>
        <div style="font-size:.72rem;color:var(--muted)">
          Toplam: <b style="color:var(--gold)">${formatCoin(k.toplamCoin)} 💰</b>
        </div>
      </div>`;
  }).join('');
}

function kuponDetayAc(id) {
  const k = kuponlar.find(x => Number(x.id) === Number(id));
  if (!k) return;
  const body = $('kuponDetayBody');
  if (!body) return;

  let html = `<div style="font-size:.8rem">
    <div class="muted" style="margin-bottom:10px">${escapeHTML(k.tarih || '')} · ${k.bahisSayisi} bahis · ${formatCoin(k.toplamCoin)} 💰</div>`;

  // Toto
  Object.entries(k.toto || {}).forEach(([mid, b]) => {
    const m = maclarToto.find(x => String(x.mac_id) === String(mid));
    if (!m) return;
    const renk = b.tuttu === true ? 'var(--green)' : b.tuttu === false ? 'var(--red)' : 'var(--muted)';
    html += `
      <div style="padding:8px 0;border-bottom:1px solid var(--border)">
        <div style="font-weight:800;margin-bottom:4px">${escapeHTML(m.ev_sahibi)} - ${escapeHTML(m.deplasman)}</div>
        <div style="display:flex;justify-content:space-between">
          <span style="color:var(--orange);font-weight:900">${b.secim}</span>
          <span style="color:${renk};font-weight:900">${b.sonuc ? (b.tuttu ? '✅ ' + b.sonuc : '❌ ' + b.sonuc) : '⏳'}</span>
        </div>
      </div>`;
  });

  // Lig
  Object.entries(k.lig || {}).forEach(([mid, b]) => {
    let m = null;
    for (const lig of Object.values(liglerData)) {
      m = (lig.maclar || []).find(x => String(x.mac_id) === String(mid));
      if (m) break;
    }
    if (!m) return;
    const renk = b.tuttu === true ? 'var(--green)' : b.tuttu === false ? 'var(--red)' : 'var(--muted)';
    html += `
      <div style="padding:8px 0;border-bottom:1px solid var(--border)">
        <div style="font-weight:800;margin-bottom:4px">${escapeHTML(m.ev)} - ${escapeHTML(m.dep)}</div>
        <div style="display:flex;justify-content:space-between">
          <span style="color:var(--orange);font-weight:900">${b.secim}</span>
          <span style="color:${renk};font-weight:900">${b.sonuc ? (b.tuttu ? '✅ ' + b.sonuc : '❌ ' + b.sonuc) : '⏳'}</span>
        </div>
      </div>`;
  });

  html += `<button type="button" class="btn btn-red btn-lg" onclick="kuponSil(${Number(k.id)})" style="margin-top:12px">🗑️ Sil</button></div>`;
  body.innerHTML = html;
  $('kuponDetayModal')?.classList.add('active');
}

function kuponSil(id) {
  if (!confirm('Kupon silinsin mi?')) return;
  kuponlar = kuponlar.filter(x => Number(x.id) !== Number(id));
  persistKuponlar();
  closeModal('kuponDetayModal');
  renderKuponlar();
}

/* ============================================================
   19. ANALİZ
   ============================================================ */
function analizGosterToto(id) {
  const m = maclarToto.find(x => String(x.mac_id) === String(id));
  if (!m) return;
  const o = TOTO_ORANLARI[id];
  if (!o) return;

  const a = Motor.analiz({ o1: o['1'], oX: o.X, o2: o['2'] });
  if ($('analizTitle')) $('analizTitle').textContent = '📊 ' + m.ev_sahibi + ' - ' + m.deplasman;

  const body = $('analizBody');
  if (!body) return;

  body.innerHTML = `
    <div style="font-size:.85rem;line-height:1.8">
      <div class="analiz-box" style="border:2px solid var(--green)">
        <span class="analiz-lbl">🎯 MODEL FAVORİSİ</span>
        <div style="text-align:center;font-size:1.4rem;font-weight:900;color:var(--green);padding:8px 0">${favoriKod(a.shin)} · %${favoriOlas(a.shin)}</div>
      </div>
      <div class="analiz-box">
        <span class="analiz-lbl">📊 SHIN</span>
        <div class="analiz-row"><span>1:</span><b>%${a.shin.p1}</b></div>
        <div class="analiz-row"><span>X:</span><b>%${a.shin.pX}</b></div>
        <div class="analiz-row"><span>2:</span><b>%${a.shin.p2}</b></div>
        <div class="analiz-row"><span class="muted">Marj:</span><b style="color:var(--orange)">%${a.marj}</b></div>
      </div>
      <div class="analiz-box">
        <span class="analiz-lbl">⚽ POISSON · xG ${a.xgEv} - ${a.xgDep}</span>
        <div class="analiz-row"><span>2.5 Üst:</span><b style="color:var(--green)">%${a.poi.pUst25}</b></div>
        <div class="analiz-row"><span>KG Var:</span><b style="color:var(--green)">%${a.poi.pKgVar}</b></div>
      </div>
      <div class="analiz-box">
        <span class="analiz-lbl">⚽ EN OLASI SKORLAR</span>
        <div class="skor-grid">${a.poi.enOlası.map(s => `<div class="skor-item"><div class="skor-sayi">${s.skor}</div><div class="skor-yuzde">%${s.yuzde}</div></div>`).join('')}</div>
      </div>
      <div class="analiz-box">
        <span class="analiz-lbl">📌 GOL DURUMU</span>
        <div style="text-align:center;padding:8px 0;font-size:1rem;font-weight:900;color:var(--orange)">${a.gollu}</div>
      </div>
      <div class="muted" style="font-size:.7rem;text-align:center">Model tahminidir. Garanti değildir.</div>
    </div>`;
  $('analizModal')?.classList.add('active');
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

function renderAnaliz() {
  const c = $('analizListesi');
  if (!c) return;
  c.innerHTML = '<div class="muted" style="text-align:center;padding:20px">Analiz için Toto sekmesinde maç seç.</div>';
}

/* ============================================================
   20. GÜNÜN BANKOSU + BANKOBOT
   ============================================================ */
function gununBankosuAc() {
  if (!maclarToto.length) { showToast('error', 'Maç Yok', 'Maç yüklenmedi.'); return; }
  const analizler = maclarToto.map(m => {
    const o = TOTO_ORANLARI[m.mac_id];
    if (!o) return null;
    try {
      const a = Motor.analiz({ o1: o['1'], oX: o.X, o2: o['2'] });
      return {
        mac: m.ev_sahibi + ' - ' + m.deplasman,
        fav: favoriKod(a.shin), favO: Number(favoriOlas(a.shin)),
        skor: a.poi.enOlası[0].skor, gollu: a.gollu
      };
    } catch (e) { return null; }
  }).filter(Boolean);

  if (!analizler.length) return;
  analizler.sort((a, b) => b.favO - a.favO);
  const b = analizler[0];

  $('gununBankosuBody').innerHTML = `
    <div class="banko-kart">
      <div class="banko-head">
        <div class="banko-title">🔥 GÜNÜN BANKOSU</div>
        <div class="banko-guven">%${b.favO.toFixed(1)}</div>
      </div>
      <div class="banko-mac">${escapeHTML(b.mac)}</div>
      <div class="banko-satir"><span>🎯 FAVORİ</span><span class="fav">${b.fav}</span></div>
      <div class="banko-satir"><span>⚽ TAHMİN</span><span class="skor">${b.skor}</span></div>
      <div class="banko-satir"><span>📊 GOL</span><span style="color:var(--orange);font-weight:900">${b.gollu}</span></div>
      <div class="muted" style="font-size:.68rem;margin-top:12px;padding:8px;background:rgba(255,159,28,.1);border-radius:6px;text-align:center">📌 Model tahminidir.</div>
    </div>`;
  $('gununBankosuModal')?.classList.add('active');
}

function bankobot() {
  if (!maclarToto.length) return;
  showToast('info', '🤖 Bankobot', 'Bu hafta ' + maclarToto.length + ' maç var. Günün Bankosuna bak!');
}

/* ============================================================
   21. SIRALAMA (BOT)
   ============================================================ */
function renderSiralama() {
  const c = $('siralamaListesi');
  if (!c) return;

  const botlar = [
    { isim: 'Ahmet', puan: 2450 },
    { isim: 'Mehmet', puan: 2100 },
    { isim: 'Ayşe', puan: 1850 },
    { isim: 'Can', puan: 1100 },
    { isim: 'Zeynep', puan: 950 }
  ];

  const siralama = [
    ...botlar,
    { isim: oyunIsim || 'Sen', puan: Math.floor(oyunKasa), sen: true }
  ].sort((a, b) => b.puan - a.puan);

  let html = `<div class="card"><div class="result-title">🏆 LİDERLİK TABLOSU</div>`;
  siralama.forEach((k, i) => {
    const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : (i + 1) + '.';
    const vurgu = k.sen ? 'color:var(--green);font-weight:900;background:rgba(0,217,126,.08)' : '';
    html += `
      <div style="padding:12px 10px;border-bottom:1px solid var(--border);display:flex;justify-content:space-between;${vurgu};border-radius:6px">
        <span>${medal} ${escapeHTML(k.isim)}${k.sen ? ' (Sen)' : ''}</span>
        <span>${formatCoin(k.puan)} 💰</span>
      </div>`;
  });
  html += `</div>`;
  c.innerHTML = html;
}

function ligSiralamasi() { switchTab(5, document.querySelectorAll('.tab')[4]); }

function seriGoster() {
  const bonus = oyunSeri >= 30 ? 4 : oyunSeri >= 14 ? 3 : oyunSeri >= 7 ? 2 : oyunSeri >= 3 ? 1.5 : 1;
  showToast('info', '🔥 Seri: ' + oyunSeri + ' gün', 'Bonus çarpanı: ×' + bonus);
}

function rozetleriGoster() {
  let msg = oyunRozetler.length + '/' + ROZETLER.length + ' rozet kazandın!';
  showToast('info', '🎖️ Rozetler', msg);
}

/* ============================================================
   22. VIP
   ============================================================ */
function renderVip() {
  const c = $('vipListesi');
  if (!c) return;

  const vipFiyat = 10000;
  const yeterli = oyunKasa >= vipFiyat;

  c.innerHTML = `
    <div class="vip-kart">
      <div class="vip-icon">👑</div>
      <div class="vip-title">VIP SKORLAB</div>
      <div class="vip-desc">Premium özellikler · Aylık abonelik</div>
      <div class="vip-price">${formatCoin(vipFiyat)} 💰</div>
      <div class="vip-features">
        <div>✅ Günlük 5 banko maç</div>
        <div>✅ Detaylı istatistikler</div>
        <div>✅ Poisson matrisi</div>
        <div>✅ Reklamsız deneyim</div>
        <div>✅ Öncelikli destek</div>
      </div>
      <button type="button" class="btn ${yeterli ? 'btn-gold' : 'btn-gray'} btn-lg" onclick="${yeterli ? 'vipAl()' : ''}" ${yeterli ? '' : 'disabled'}>
        ${yeterli ? '👑 VIP AÇ' : '💰 Yetersiz Bakiye'}
      </button>
      <div class="muted" style="font-size:.68rem;margin-top:10px">Kasanda: ${formatCoin(oyunKasa)} 💰</div>
    </div>
    <div class="card" style="border:2px solid var(--orange)">
      <div class="result-title" style="color:var(--orange)">⚠️ BİLGİ</div>
      <div style="font-size:.75rem;line-height:1.7">
        <p>• Bu oyun <b>sanal para</b> ile oynanır.</p>
        <p>• Gerçek para <b>kazanılmaz, kaybedilmez.</b></p>
        <p>• Sadece eğlence amaçlıdır.</p>
      </div>
    </div>`;
}

function vipAl() {
  const vipFiyat = 10000;
  if (oyunKasa < vipFiyat) { showToast('error', 'Yetersiz', 'Kasanda yeterli coin yok.'); return; }
  if (!confirm('VIP açılsın mı? ' + formatCoin(vipFiyat) + ' 💰 gidecek.')) return;
  oyunKasa -= vipFiyat;
  persistOyun();
  renderProfilBar();
  renderVip();
  konfetiGoster(50);
  titreşim(200);
  sesCal('kazanc');
  showToast('success', '👑 VIP Aktif!', 'Hoş geldin!');
}

/* ============================================================
   23. SEKME + MODAL + TOAST
   ============================================================ */
function switchTab(i, el) {
  document.querySelectorAll('.tab, .page').forEach(n => n.classList.remove('active'));
  if (el) el.classList.add('active');
  const page = $('page-' + i);
  if (page) page.classList.add('active');
  if (i === 3) renderAnaliz();
  if (i === 4) renderKuponlar();
  if (i === 5) renderSiralama();
  if (i === 6) renderVip();
  titreşim(15); sesCal('tik');
}

function closeModal(id) {
  const el = $(id);
  if (el) el.classList.remove('active');
}

function showToast(type, title, msg) {
  const icon = $('toastIcon'), t = $('toastTitle'), m = $('toastMsg'), modal = $('toastModal');
  if (icon) icon.textContent = type === 'success' ? '✅' : type === 'info' ? 'ℹ️' : '❌';
  if (t) t.textContent = title;
  if (m) m.textContent = msg;
  if (modal) modal.classList.add('active');
}

/* ============================================================
   24. PAYLAŞ
   ============================================================ */
function paylasKupon() {
  let toplam = 0, sayi = 0;
  Object.values(totoBahisleri).forEach(b => { if (b.secim) { toplam += b.coin || 0; sayi++; } });
  Object.values(ligBahisleri).forEach(b => { if (b.secim) { toplam += b.coin || 0; sayi++; } });

  if (!sayi) { showToast('error', 'Boş', 'Önce bahis seç.'); return; }

  let metin = '🎰 SKORLAB KUPONUM\n\n';
  metin += '📊 ' + sayi + ' bahis · ' + formatCoin(toplam) + ' 💰\n\n';
  metin += '🎮 @SkorLabBot\n';
  metin += '💰 Sanal para · Oyun';

  if (TG && typeof TG.switchInlineQuery === 'function' && TG.isVersionAtLeast && TG.isVersionAtLeast('6.1')) {
    TG.switchInlineQuery(metin, ['users', 'groups']); return;
  }
  if (navigator.share) { navigator.share({ title: 'SkorLab', text: metin }).catch(() => {}); return; }
  if (navigator.clipboard) {
    navigator.clipboard.writeText(metin).then(() => showToast('success', 'Kopyalandı!', 'Panoya kopyalandı.'));
  }
}

/* ============================================================
   25. BAŞLAT
   ============================================================ */
window.addEventListener('DOMContentLoaded', () => {
  initTelegram();
  loadData();
  gunlukSeriKontrol();
  renderProfilBar();
});
