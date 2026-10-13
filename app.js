/* ============================================================
   SKORLAB v30 · TAHMİN OYUNU
   Splash + Onboarding + Dashboard + Toto + Tahmin
   ============================================================ */
'use strict';

let TG = null;
const $ = id => document.getElementById(id);

/* ============================================================
   YARDIMCI
   ============================================================ */
function safeReadJSON(key, fallback) {
  try { const raw = localStorage.getItem(key); return raw == null ? fallback : JSON.parse(raw); }
  catch (e) { return fallback; }
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
function bugun() { return new Date().toISOString().split('T')[0]; }
function formatCoin(n) { return Number(n || 0).toLocaleString('tr-TR'); }

/* ============================================================
   TELEGRAM
   ============================================================ */
function initTelegram() {
  if (!window.Telegram?.WebApp) return;
  TG = window.Telegram.WebApp;
  try {
    TG.ready(); TG.expand();
    if (typeof TG.enableClosingConfirmation === 'function') TG.enableClosingConfirmation();
    const user = TG.initDataUnsafe?.user;
    if (user && !oyunIsim) {
      oyunIsim = user.first_name || user.username || 'Oyuncu';
      persistOyun();
    }
  } catch (e) {}
}

/* ============================================================
   TİTREŞİM + SES
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
    else if (tur === 'kupa') { osc.frequency.value = 1500; gain.gain.value = 0.15; }
    else if (tur === 'hata') { osc.frequency.value = 300; gain.gain.value = 0.1; }
    else if (tur === 'cark') { osc.frequency.value = 1500; gain.gain.value = 0.08; }
    osc.start();
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);
    osc.stop(ctx.currentTime + 0.25);
  } catch (e) {}
}

/* ============================================================
   OYUN VERİLERİ
   ============================================================ */
let oyunKasa = safeReadJSON('skorlab_kasa', 1000);
let oyunSeri = safeReadJSON('skorlab_seri', 0);
let oyunSonGiris = safeReadJSON('skorlab_son_giris', '');
let oyunRozetler = safeReadJSON('skorlab_rozetler', []);
let oyunIsim = safeReadJSON('skorlab_isim', '');
let oyunTakim = safeReadJSON('skorlab_takim', '');
let oyunLig = safeReadJSON('skorlab_lig', '');
let oyunJokerler = safeReadJSON('skorlab_jokerler', { duzeltme: 0, cift: 0, garanti: 0 });
let oyunSonCark = safeReadJSON('skorlab_son_cark', '');
let oyunToplamTaraf = safeReadJSON('skorlab_toplam_taraf', 0);
let oyunToplamSkor = safeReadJSON('skorlab_toplam_skor', 0);
let oyunLigIstatistik = safeReadJSON('skorlab_lig_istatistik', {});
let oyunSeviye = safeReadJSON('skorlab_seviye', 0);
let oyunOnboarding = safeReadJSON('skorlab_onboarding', false);
let oyunGorev = safeReadJSON('skorlab_gorev', {
  tarih: '',
  gorevler: [
    { id: 'giris', metin: 'Giriş yap', xp: 100, tamam: false },
    { id: 'tahmin3', metin: '3 maç tahmin et', xp: 50, tamam: false },
    { id: 'paylas', metin: 'Tahminini paylaş', xp: 25, tamam: false }
  ],
  bonusAlindi: false
});

if (typeof oyunKasa !== 'number' || oyunKasa < 0) oyunKasa = 1000;
if (typeof oyunSeri !== 'number') oyunSeri = 0;
if (typeof oyunSonGiris !== 'string') oyunSonGiris = '';
if (!Array.isArray(oyunRozetler)) oyunRozetler = [];
if (typeof oyunIsim !== 'string') oyunIsim = '';
if (typeof oyunTakim !== 'string') oyunTakim = '';
if (typeof oyunLig !== 'string') oyunLig = '';
if (!oyunJokerler || typeof oyunJokerler !== 'object') oyunJokerler = { duzeltme: 0, cift: 0, garanti: 0 };
if (typeof oyunSonCark !== 'string') oyunSonCark = '';
if (typeof oyunToplamTaraf !== 'number') oyunToplamTaraf = 0;
if (typeof oyunToplamSkor !== 'number') oyunToplamSkor = 0;
if (!oyunLigIstatistik || typeof oyunLigIstatistik !== 'object') oyunLigIstatistik = {};
if (typeof oyunSeviye !== 'number') oyunSeviye = 0;
if (typeof oyunOnboarding !== 'boolean') oyunOnboarding = false;
if (!oyunGorev || typeof oyunGorev !== 'object') {
  oyunGorev = {
    tarih: '',
    gorevler: [
      { id: 'giris', metin: 'Giriş yap', xp: 100, tamam: false },
      { id: 'tahmin3', metin: '3 maç tahmin et', xp: 50, tamam: false },
      { id: 'paylas', metin: 'Tahminini paylaş', xp: 25, tamam: false }
    ],
    bonusAlindi: false
  };
}

function persistOyun() {
  safeSaveJSON('skorlab_kasa', oyunKasa);
  safeSaveJSON('skorlab_seri', oyunSeri);
  safeSaveJSON('skorlab_son_giris', oyunSonGiris);
  safeSaveJSON('skorlab_rozetler', oyunRozetler);
  safeSaveJSON('skorlab_isim', oyunIsim);
  safeSaveJSON('skorlab_takim', oyunTakim);
  safeSaveJSON('skorlab_lig', oyunLig);
  safeSaveJSON('skorlab_jokerler', oyunJokerler);
  safeSaveJSON('skorlab_son_cark', oyunSonCark);
  safeSaveJSON('skorlab_toplam_taraf', oyunToplamTaraf);
  safeSaveJSON('skorlab_toplam_skor', oyunToplamSkor);
  safeSaveJSON('skorlab_lig_istatistik', oyunLigIstatistik);
  safeSaveJSON('skorlab_seviye', oyunSeviye);
  safeSaveJSON('skorlab_onboarding', oyunOnboarding);
  safeSaveJSON('skorlab_gorev', oyunGorev);
}

/* ============================================================
   KUPONLAR
   ============================================================ */
let kuponlar = safeReadJSON('skorlab_kuponlar', []);
if (!Array.isArray(kuponlar)) kuponlar = [];
function persistKuponlar() { safeSaveJSON('skorlab_kuponlar', kuponlar); }

let totoSecimler = safeReadJSON('skorlab_toto_secimler', {});
let tahminSecimler = safeReadJSON('skorlab_tahmin_secimler', {});
if (!totoSecimler || typeof totoSecimler !== 'object') totoSecimler = {};
if (!tahminSecimler || typeof tahminSecimler !== 'object') tahminSecimler = {};

function persistSecimler() {
  safeSaveJSON('skorlab_toto_secimler', totoSecimler);
  safeSaveJSON('skorlab_tahmin_secimler', tahminSecimler);
}

/* ============================================================
   SEVİYELER
   ============================================================ */
const SEVIYELER = [
  { ad: 'Çaylak', min: 0, max: 500, ikon: '🥉' },
  { ad: 'Amatör', min: 500, max: 2000, ikon: '🥈' },
  { ad: 'Usta', min: 2000, max: 5000, ikon: '🥇' },
  { ad: 'Efsane', min: 5000, max: 10000, ikon: '💎' },
  { ad: 'Şampiyon', min: 10000, max: Infinity, ikon: '👑' }
];
function seviyeHesapla() {
  for (const s of SEVIYELER) if (oyunKasa >= s.min && oyunKasa < s.max) return s;
  return SEVIYELER[SEVIYELER.length - 1];
}
function seviyeIndex() {
  for (let i = 0; i < SEVIYELER.length; i++) {
    if (oyunKasa >= SEVIYELER[i].min && oyunKasa < SEVIYELER[i].max) return i;
  }
  return SEVIYELER.length - 1;
}

/* ============================================================
   ROZETLER
   ============================================================ */
const ROZETLER = [
  { id: 'ilk', ikon: '🎬', ad: 'İlk Adım', sart: () => oyunToplamTaraf + oyunToplamSkor >= 1 },
  { id: 'taraf10', ikon: '🎯', ad: 'Keskin', sart: () => oyunToplamTaraf >= 10 },
  { id: 'taraf50', ikon: '🏆', ad: 'Usta', sart: () => oyunToplamTaraf >= 50 },
  { id: 'skor1', ikon: '💎', ad: 'Kahin', sart: () => oyunToplamSkor >= 1 },
  { id: 'skor5', ikon: '👑', ad: 'Şampiyon', sart: () => oyunToplamSkor >= 5 },
  { id: 'seri3', ikon: '🔥', ad: 'Ateşli', sart: () => oyunSeri >= 3 },
  { id: 'seri7', ikon: '🔥🔥', ad: 'Alev Aldı', sart: () => oyunSeri >= 7 },
  { id: 'kasa5k', ikon: '💰', ad: 'Zengin', sart: () => oyunKasa >= 5000 }
];

function rozetKontrol() {
  let yeni = false;
  ROZETLER.forEach(r => {
    if (!oyunRozetler.includes(r.id) && r.sart()) {
      oyunRozetler.push(r.id); yeni = true;
      setTimeout(() => {
        odulGoster('🎖️', 'YENİ ROZET!', r.ikon + ' ' + r.ad, '+0 💰');
        konfetiGoster(40); titreşim(100); sesCal('kupa');
      }, 1500);
    }
  });
  if (yeni) persistOyun();
}

/* ============================================================
   ANİMASYONLAR
   ============================================================ */
function konfetiGoster(adet = 30) {
  const katman = $('konfetiKatman'); if (!katman) return;
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
  const katman = $('ucanKatman'); if (!katman) return;
  const el = document.createElement('div');
  el.className = 'ucan-puan'; el.textContent = metin; el.style.color = renk;
  el.style.left = (30 + Math.random() * 40) + '%'; el.style.top = '50%';
  katman.appendChild(el);
  setTimeout(() => el.remove(), 1600);
}

function patlamaGoster() {
  const katman = $('patlamaKatman'); if (!katman) return;
  const el = document.createElement('div');
  el.className = 'patlama';
  el.style.left = '50%'; el.style.top = '50%';
  katman.appendChild(el);
  setTimeout(() => el.remove(), 900);
}

function odulGoster(ikon, baslik, ad, puan) {
  const body = $('odulBody'); if (!body) return;
  body.innerHTML = `
    <span class="odul-ikon">${ikon}</span>
    <div class="odul-baslik">${baslik}</div>
    <div class="odul-alt">${ad}</div>
    ${puan !== '+0 💰' ? `<div class="odul-puan">${puan}</div>` : ''}
    <button type="button" class="btn btn-green btn-lg" onclick="closeModal('odulModal')" style="margin-top:12px">TAMAM</button>
  `;
  $('odulModal').classList.add('active');
  patlamaGoster();
}

/* ============================================================
   PROFİL BARI
   ============================================================ */
function renderProfilBar() {
  const seviye = seviyeHesapla();
  if ($('pbIsim')) $('pbIsim').textContent = oyunIsim || 'Oyuncu';
  if ($('pbSeviye')) $('pbSeviye').textContent = seviye.ikon + ' ' + seviye.ad;
  if ($('pbCoin')) $('pbCoin').textContent = '💰 ' + formatCoin(Math.floor(oyunKasa));
  if ($('pbSeri')) $('pbSeri').textContent = '🔥 ' + oyunSeri + ' gün';
  if ($('totoKasa')) $('totoKasa').textContent = formatCoin(Math.floor(oyunKasa));
  if ($('ligKasa')) $('ligKasa').textContent = formatCoin(Math.floor(oyunKasa));
}

/* ============================================================
   GÜNLÜK GÖREV
   ============================================================ */
function gorevSifirla() {
  const bugunT = bugun();
  if (oyunGorev.tarih === bugunT) return;
  oyunGorev = {
    tarih: bugunT,
    gorevler: [
      { id: 'giris', metin: 'Giriş yap', xp: 100, tamam: true },
      { id: 'tahmin3', metin: '3 maç tahmin et', xp: 50, tamam: false },
      { id: 'paylas', metin: 'Tahminini paylaş', xp: 25, tamam: false }
    ],
    bonusAlindi: false
  };
  persistOyun();
}

function gorevTamamla(id) {
  const g = oyunGorev.gorevler.find(x => x.id === id);
  if (!g || g.tamam) return;
  gorevSifirla();
  const g2 = oyunGorev.gorevler.find(x => x.id === id);
  if (!g2 || g2.tamam) return;
  g2.tamam = true;
  oyunKasa += g2.xp;
  persistOyun();
  renderProfilBar();
  renderAnaEkran();
  ucanPuan('+' + g2.xp + ' 💰', 'var(--gold)');
  titreşim(30); sesCal('ok');
  const hepsi = oyunGorev.gorevler.every(x => x.tamam);
  if (hepsi && !oyunGorev.bonusAlindi) {
    oyunGorev.bonusAlindi = true;
    oyunKasa += 150;
    persistOyun();
    renderProfilBar();
    setTimeout(() => {
      odulGoster('🎁', 'GÜNLÜK GÖREV TAMAM!', 'Hepsi bitince', '+150 💰');
      konfetiGoster(60);
      titreşim(150); sesCal('kupa');
    }, 600);
  }
  rozetKontrol();
}

function gorevKontrolToto() {
  const sayi = Object.keys(totoSecimler).filter(id => {
    const s = totoSecimler[id];
    return Array.isArray(s) && s.length;
  }).length;
  if (sayi >= 3) gorevTamamla('tahmin3');
}

/* ============================================================
   VERİ YÜKLE
   ============================================================ */
let maclarToto = [];
let liglerData = {};
let sezonData = {};

async function loadData() {
  try {
    const res = await fetch('matches.json?v=30');
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const raw = await res.json();
    maclarToto = Array.isArray(raw.maclar) ? raw.maclar : [];
    liglerData = raw.ligler || {};
    sezonData = raw.sezon || {};
  } catch (e) { maclarToto = []; }
  renderToto();
  renderLigler();
  renderKuponlar();
  renderSiralama();
  renderRozetler();
  renderProfil();
  renderProfilBar();
  updateKuponCubugu();
}

/* ============================================================
   TOTO
   ============================================================ */
function renderToto() {
  const c = $('totoListesi'); if (!c) return;
  if (!maclarToto.length) {
    c.innerHTML = '<div class="card"><div class="muted" style="text-align:center;padding:20px">Maç yok.</div></div>';
    return;
  }
  c.innerHTML = maclarToto.map(m => {
    const id = m.mac_id;
    const sec = Array.isArray(totoSecimler[id]) ? totoSecimler[id] : [];
    return `
      <div class="mac-kart">
        <div class="mac-head">
          <span class="mac-no">#${escapeHTML(id)}</span>
          <span class="mac-saat">🕐 20:00</span>
        </div>
        <div class="mac-teams">${escapeHTML(m.ev_sahibi)} <span style="color:var(--muted);font-weight:700">vs</span> ${escapeHTML(m.deplasman)}</div>
        <div class="toto-grid">
          <button type="button" class="toto-btn ${sec.includes('1') ? 'secili' : ''}" onclick="totoToggle(${Number(id)},'1')">
            <span class="kod">1</span><span class="aciklama">EV</span>
          </button>
          <button type="button" class="toto-btn ${sec.includes('X') ? 'secili' : ''}" onclick="totoToggle(${Number(id)},'X')">
            <span class="kod">X</span><span class="aciklama">BERABERE</span>
          </button>
          <button type="button" class="toto-btn ${sec.includes('2') ? 'secili' : ''}" onclick="totoToggle(${Number(id)},'2')">
            <span class="kod">2</span><span class="aciklama">DEPLASMAN</span>
          </button>
        </div>
      </div>`;
  }).join('');
  updateTotoStats();
}

function totoToggle(id, secim) {
  let arr = Array.isArray(totoSecimler[id]) ? [...totoSecimler[id]] : [];
  if (arr.includes(secim)) arr = arr.filter(x => x !== secim);
  else { arr.push(secim); arr = ['1', 'X', '2'].filter(x => arr.includes(x)); }
  if (!arr.length) delete totoSecimler[id]; else totoSecimler[id] = arr;
  persistSecimler(); renderToto(); updateKuponCubugu();
  titreşim(15); sesCal('tik');
  gorevKontrolToto();
}

function totoKolonHesapla() {
  let kolon = 1, macSayisi = 0;
  Object.values(totoSecimler).forEach(s => {
    if (Array.isArray(s) && s.length) { kolon *= s.length; macSayisi++; }
  });
  return { kolon: macSayisi ? kolon : 0, macSayisi };
}

function updateTotoStats() {
  const h = totoKolonHesapla();
  const maliyet = h.kolon * 10;
  if ($('totoKolon')) $('totoKolon').textContent = formatCoin(h.kolon);
  if ($('totoMaliyet')) $('totoMaliyet').textContent = formatCoin(maliyet);
}

/* ============================================================
   TAHMİN
   ============================================================ */
function renderLigler() {
  const c = $('ligListesi'); if (!c) return;
  if (!liglerData || !Object.keys(liglerData).length) {
    c.innerHTML = '<div class="card"><div class="muted" style="text-align:center;padding:20px">Maç yok.</div></div>';
    return;
  }
  let html = '';
  Object.entries(liglerData).forEach(([ligKey, lig]) => {
    html += `<div class="card"><div class="result-title">${lig.bayrak || '⚽'} ${escapeHTML(lig.isim)}</div>`;
    (lig.maclar || []).forEach(m => {
      const id = m.mac_id;
      const t = tahminSecimler[id] || {};
      const taraf = t.taraf || '';
      const evSkor = t.ev !== undefined && t.ev !== null ? t.ev : '';
      const depSkor = t.dep !== undefined && t.dep !== null ? t.dep : '';
      const sonucVar = m.sonuc !== null && m.sonuc !== undefined;
      const skorVar = evSkor !== '' && depSkor !== '';
      html += `
        <div class="mac-kart" style="${sonucVar ? 'opacity:.7' : ''}">
          <div class="mac-head">
            <span class="mac-saat">🕐 ${escapeHTML(m.saat || '')}</span>
            ${sonucVar ? `<span style="color:var(--green);font-weight:900;font-size:.7rem">✅ ${m.sonuc.ev}-${m.sonuc.dep}</span>` : '<span class="canli">● CANLI</span>'}
          </div>
          <div class="mac-teams">${escapeHTML(m.ev)} <span style="color:var(--muted);font-weight:700">vs</span> ${escapeHTML(m.dep)}</div>
          <div class="taraf-grid">
            <button type="button" class="taraf-btn ${taraf === '1' ? 'secili' : ''}" onclick="tahminTaraf(${id},'1')">1</button>
            <button type="button" class="taraf-btn ${taraf === 'X' ? 'secili' : ''}" onclick="tahminTaraf(${id},'X')">X</button>
            <button type="button" class="taraf-btn ${taraf === '2' ? 'secili' : ''}" onclick="tahminTaraf(${id},'2')">2</button>
          </div>
          ${taraf && !sonucVar ? `
            <div class="skor-giris">
              <label>⚽ SKOR</label>
              <input type="number" min="0" max="20" placeholder="0" value="${evSkor}" onchange="tahminSkor(${id},'ev',this.value)" inputmode="numeric">
              <span class="skor-orta">-</span>
              <input type="number" min="0" max="20" placeholder="0" value="${depSkor}" onchange="tahminSkor(${id},'dep',this.value)" inputmode="numeric">
            </div>
            <div class="kazanc-gosterge">
              <div class="kazanc-satir"><span>🎯 Taraf doğru</span><b style="color:var(--green)">+50 💰</b></div>
              <div class="kazanc-satir"><span>⚽ Skor tam</span><b style="color:var(--gold)">+500 💰</b></div>
              ${skorVar ? `<div class="kazanc-satir" style="border-top:1px solid var(--border);margin-top:6px;padding-top:6px"><span style="color:var(--orange);font-weight:900">🎁 Toplam potansiyel</span><b style="color:var(--orange);font-size:1rem">+550 💰</b></div>` : ''}
            </div>` : ''}
        </div>`;
    });
    html += `</div>`;
  });
  c.innerHTML = html;
  updateLigStats();
}

function tahminTaraf(id, taraf) {
  if (!tahminSecimler[id]) tahminSecimler[id] = {};
  if (tahminSecimler[id].taraf === taraf) {
    delete tahminSecimler[id].taraf; delete tahminSecimler[id].ev; delete tahminSecimler[id].dep;
    if (!Object.keys(tahminSecimler[id]).length) delete tahminSecimler[id];
  } else { tahminSecimler[id].taraf = taraf; }
  persistSecimler(); renderLigler(); updateKuponCubugu();
  titreşim(15); sesCal('tik');
}

function tahminSkor(id, alan, val) {
  if (!tahminSecimler[id]) tahminSecimler[id] = {};
  const n = Math.max(0, Math.min(20, Number(val) || 0));
  tahminSecimler[id][alan] = n;
  persistSecimler();
}

function updateLigStats() {
  let tarafSayisi = 0, skorSayisi = 0;
  Object.values(tahminSecimler).forEach(t => {
    if (t.taraf) { tarafSayisi++; if (t.ev !== undefined && t.dep !== undefined) skorSayisi++; }
  });
  if ($('ligTaraf')) $('ligTaraf').textContent = tarafSayisi;
  if ($('ligSkor')) $('ligSkor').textContent = skorSayisi;
  if ($('ligToplam')) $('ligToplam').textContent = tarafSayisi + skorSayisi;
}

function updateKuponCubugu() {
  const h = totoKolonHesapla();
  let tahminSayisi = 0;
  Object.values(tahminSecimler).forEach(t => { if (t.taraf) tahminSayisi++; });
  const toplamCoin = h.kolon * 10;
  if ($('kcToto')) $('kcToto').textContent = h.macSayisi + tahminSayisi;
  if ($('kcToplam')) $('kcToplam').textContent = formatCoin(toplamCoin) + ' 💰';
}

/* ============================================================
   KAYDET
   ============================================================ */
function totoKaydet() {
  const h = totoKolonHesapla();
  if (h.kolon === 0) { showToast('error', 'Boş', 'Hiç maç seçmedin.'); return; }
  if (h.kolon > 2500) { showToast('error', 'Limit Aşıldı', 'Maksimum 2.500 kolon.'); return; }
  const maliyet = h.kolon * 10;
  if (maliyet > oyunKasa) {
    showToast('error', 'Yetersiz Kasa', 'Kasanda ' + formatCoin(oyunKasa) + ' 💰 var.');
    return;
  }
  if (!confirm(h.kolon + ' kolon · ' + formatCoin(maliyet) + ' 💰\nOnaylıyor musun?')) return;
  oyunKasa -= maliyet;
  persistOyun();
  kuponlar.unshift({
    id: Date.now(),
    tarih: new Date().toLocaleString('tr-TR'),
    tip: 'toto',
    kolon: h.kolon,
    maliyet: maliyet,
    secimler: JSON.parse(JSON.stringify(totoSecimler)),
    durum: 'bekliyor'
  });
  kuponlar = kuponlar.slice(0, 50);
  persistKuponlar();
  totoSecimler = {};
  persistSecimler();
  renderToto(); renderProfilBar(); renderKuponlar(); updateKuponCubugu();
  titreşim(100); sesCal('ok');
  ucanPuan('-' + formatCoin(maliyet) + ' 💰', 'var(--red)');
  odulGoster('🎰', 'TOTO KAYDEDİLDİ!', h.kolon + ' kolon oynadın', '-' + formatCoin(maliyet) + ' 💰');
  rozetKontrol();
}

function tahminleriKaydet() {
  let tarafSayisi = 0, skorSayisi = 0;
  Object.values(tahminSecimler).forEach(t => {
    if (t.taraf) { tarafSayisi++; if (t.ev !== undefined && t.dep !== undefined) skorSayisi++; }
  });
  if (tarafSayisi === 0) { showToast('error', 'Boş', 'Hiç tahmin yapmadın.'); return; }
  if (!confirm(tarafSayisi + ' tahmin (' + skorSayisi + ' skorlu)\nOnaylıyor musun?')) return;
  kuponlar.unshift({
    id: Date.now(),
    tarih: new Date().toLocaleString('tr-TR'),
    tip: 'tahmin',
    tarafSayisi: tarafSayisi,
    skorSayisi: skorSayisi,
    secimler: JSON.parse(JSON.stringify(tahminSecimler)),
    durum: 'bekliyor'
  });
  kuponlar = kuponlar.slice(0, 50);
  persistKuponlar();
  tahminSecimler = {};
  persistSecimler();
  renderLigler(); renderKuponlar(); updateKuponCubugu();
  titreşim(80); sesCal('ok');
  ucanPuan('+' + tarafSayisi + ' TAHMİN', 'var(--green)');
  odulGoster('⚽', 'TAHMİNLER KAYDEDİLDİ!', tarafSayisi + ' taraf · ' + skorSayisi + ' skor', '+0 💰');
  rozetKontrol();
}

function tumSecimleriSil() {
  if (!confirm('Tüm seçimler silinsin mi?')) return;
  totoSecimler = {}; tahminSecimler = {}; persistSecimler();
  renderToto(); renderLigler(); updateKuponCubugu();
}

/* ============================================================
   ANA EKRAN (DASHBOARD)
   ============================================================ */
function renderAnaEkran() {
  const c = $('anaEkran');
  if (!c) return;

  const seviye = seviyeHesapla();
  const seviyeIdx = seviyeIndex();
  const seviyeMin = seviye.min;
  const seviyeMax = seviye.max === Infinity ? seviye.min + 5000 : seviye.max;
  const ilerleme = Math.min(100, ((oyunKasa - seviyeMin) / (seviyeMax - seviyeMin)) * 100);
  const kalan = seviye.max === Infinity ? 'MAX' : formatCoin(seviyeMax - oyunKasa);

  // Görev sayısı
  const gorevToplam = oyunGorev.gorevler.length;
  const gorevTamam = oyunGorev.gorevler.filter(g => g.tamam).length;

  // Sürpriz (güne göre)
  const gun = new Date().getDay();
  const surprizler = [
    { gun: 1, ikon: '💰', baslik: '2× KAZANÇ', alt: 'Bugün kazançların 2 katı!' },
    { gun: 2, ikon: '🃏', baslik: 'BEDAVA JOKER', alt: 'Çarkıfelekten joker garantili!' },
    { gun: 3, ikon: '🎡', baslik: 'ÇARK ×2', alt: 'Bugün 2 kez çevirebilirsin!' },
    { gun: 4, ikon: '⚡', baslik: 'HIZLI GÜN', alt: 'Tahminler 2× hızlı kaydedilir' },
    { gun: 5, ikon: '🎁', baslik: 'HAFTA SONU BONUSU', alt: 'Yarın ekstra +200 coin!' },
    { gun: 6, ikon: '🔥', baslik: 'DERBİ GÜNÜ', alt: 'Büyük maçlar var!' },
    { gun: 0, ikon: '🏆', baslik: 'HAFTALIK ÖZET', alt: 'Bu haftanın kazananları!' }
  ];
  const surpriz = surprizler.find(s => s.gun === gun) || surprizler[0];

  // Mini sıralama
  const botlar = [
    { isim: 'Ahmet', puan: 2450 }, { isim: 'Mehmet', puan: 2100 },
    { isim: 'Ayşe', puan: 1850 }, { isim: 'Can', puan: 1100 },
    { isim: 'Zeynep', puan: 950 }
  ];
  const siralama = [...botlar, { isim: oyunIsim || 'Sen', puan: Math.floor(oyunKasa), sen: true }]
    .sort((a, b) => b.puan - a.puan).slice(0, 5);

  // Çark hazır mı?
  const carkHazir = oyunSonCark !== bugun();

  c.innerHTML = `
    <!-- Seviye Kartı -->
    <div class="seviye-kart">
      <div class="seviye-ust">
        <div class="seviye-baslik">🏆 SEVİYE ${seviyeIdx + 1}</div>
        <div class="seviye-ad">${seviye.ikon} ${seviye.ad}</div>
      </div>
      <div class="seviye-bar">
        <div class="seviye-dolu" style="width:${ilerleme}%"></div>
      </div>
      <div class="seviye-alt">
        <span>${formatCoin(Math.floor(oyunKasa))} / ${formatCoin(seviyeMax)}</span>
        <span>${kalan === 'MAX' ? 'MAX SEVİYE' : formatCoin(kalan) + ' 💰 kaldı'}</span>
      </div>
    </div>

    <!-- Günlük Bonus Kartı -->
    <div class="bonus-kart-hizli" style="background:linear-gradient(135deg,rgba(255,159,28,.15),rgba(255,77,94,.08));border:2px solid var(--orange);border-radius:14px;padding:14px;margin-bottom:12px;text-align:center">
      <div style="font-size:2rem;margin-bottom:4px">🔥</div>
      <div style="font-size:.85rem;font-weight:900;color:var(--orange);letter-spacing:1px">SERİ ${oyunSeri} GÜN</div>
      <div style="font-size:.7rem;color:var(--muted2);margin-top:4px">Yarın +${formatCoin(100)} 💰 daha kazan!</div>
    </div>

    <!-- Günlük Görev -->
    <div class="gorev-kart">
      <div class="gorev-ust">
        <span>📅 GÜNLÜK GÖREV</span>
        <span class="gorev-sayac">${gorevTamam}/${gorevToplam}</span>
      </div>
      ${oyunGorev.gorevler.map(g => `
        <div class="gorev-satir">
          <div class="gorev-check ${g.tamam ? 'ok' : ''}">${g.tamam ? '✓' : ''}</div>
          <div class="gorev-text">${g.metin}</div>
          <div class="gorev-xp">+${g.xp} 💰</div>
        </div>
      `).join('')}
      <div style="margin-top:10px;padding:8px;background:rgba(255,215,0,.08);border-radius:8px;text-align:center;font-size:.7rem;color:var(--gold);font-weight:900;border:1px dashed rgba(255,215,0,.4)">
        🎁 Hepsi bitince: +150 💰 bonus
      </div>
    </div>

    <!-- Hızlı Başla -->
    <div class="hizli-grid">
      <button type="button" class="hizli-btn toto" onclick="switchTab(1, document.querySelectorAll('.tab')[1])">
        <span class="hizli-ikon">🎰</span>
        <span class="hizli-yazi">TOTO</span>
      </button>
      <button type="button" class="hizli-btn tahmin" onclick="switchTab(2, document.querySelectorAll('.tab')[2])">
        <span class="hizli-ikon">⚽</span>
        <span class="hizli-yazi">TAHMİN</span>
      </button>
      <button type="button" class="hizli-btn cark" onclick="carkifelekAc()">
        <span class="hizli-ikon">🎡</span>
        <span class="hizli-yazi">ÇARK ${carkHazir ? '🔴' : '✅'}</span>
      </button>
      <button type="button" class="hizli-btn siralama" onclick="switchTab(4, document.querySelectorAll('.tab')[4])">
        <span class="hizli-ikon">🏆</span>
        <span class="hizli-yazi">SIRALAMA</span>
      </button>
    </div>

    <!-- Mini Sıralama -->
    <div class="mini-siralama">
      <div class="mini-ust">🏆 HAFTALIK SIRALAMA</div>
      ${siralama.map((k, i) => {
        const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : (i + 1) + '.';
        return `<div class="mini-satir ${k.sen ? 'sen' : ''}">
          <span>${medal} ${escapeHTML(k.isim)}${k.sen ? ' (Sen)' : ''}</span>
          <span>${formatCoin(k.puan)} 💰</span>
        </div>`;
      }).join('')}
    </div>

    <!-- Sürpriz -->
    <div class="surpriz-kart">
      <div class="surpriz-ikon">${surpriz.ikon}</div>
      <div class="surpriz-baslik">${surpriz.baslik}</div>
      <div class="surpriz-alt">${surpriz.alt}</div>
    </div>
  `;
}

/* ============================================================
   SPLASH + ONBOARDING + BONUS
   ============================================================ */
function splashGizle() {
  const s = $('splash');
  if (s) {
    s.classList.add('gizle');
    setTimeout(() => s.remove(), 600);
  }
}

function onboardingGoster() {
  const ob = $('onboarding');
  if (ob) ob.classList.add('aktif');
}

function onboardingBitir() {
  oyunOnboarding = true;
  persistOyun();
  const ob = $('onboarding');
  if (ob) ob.classList.remove('aktif');
  setTimeout(() => gunlukBonusKontrol(), 300);
}

function gunlukBonusKontrol() {
  const bugunT = bugun();
  if (oyunSonGiris === bugunT) {
    renderProfilBar();
    renderAnaEkran();
    return;
  }
  const dun = new Date(Date.now() - 86400000).toISOString().split('T')[0];
  let yeniSeri;
  if (oyunSonGiris === dun) yeniSeri = oyunSeri + 1;
  else if (oyunSonGiris === '') yeniSeri = 1;
  else yeniSeri = 1;

  const bonus = 100;
  const ikon = $('bonusIkon');
  const baslik = $('bonusBaslik');
  const odul = $('bonusOdul');
  const alt = $('bonusAlt');
  if (ikon) ikon.textContent = '🔥';
  if (baslik) baslik.textContent = 'GÜN ' + yeniSeri + '!';
  if (odul) odul.textContent = '+' + bonus + ' 💰';
  if (alt) {
    if (yeniSeri >= 30) alt.textContent = 'EFSANE SERİ! ×4 bonus aktif';
    else if (yeniSeri >= 14) alt.textContent = '×3 bonus aktif';
    else if (yeniSeri >= 7) alt.textContent = '×2 bonus aktif';
    else if (yeniSeri >= 3) alt.textContent = '×1.5 bonus aktif';
    else alt.textContent = 'Hoş geldin bonusu';
  }
  const ekran = $('gunlukBonus');
  if (ekran) ekran.classList.add('aktif');
  sesCal('kazanc');
  titreşim(50);
}

function bonusAl() {
  const bugunT = bugun();
  const dun = new Date(Date.now() - 86400000).toISOString().split('T')[0];
  let yeniSeri;
  if (oyunSonGiris === dun) yeniSeri = oyunSeri + 1;
  else yeniSeri = 1;
  oyunSeri = yeniSeri;
  oyunSonGiris = bugunT;
  oyunKasa += 100;
  gorevSifirla();
  const g = oyunGorev.gorevler.find(x => x.id === 'giris');
  if (g) g.tamam = true;
  persistOyun();
  const ekran = $('gunlukBonus');
  if (ekran) ekran.classList.remove('aktif');
  konfetiGoster(60);
  patlamaGoster();
  titreşim(150); sesCal('kupa');
  ucanPuan('+100 💰', 'var(--gold)');
  renderProfilBar();
  renderAnaEkran();
  rozetKontrol();
  setTimeout(() => {
    odulGoster('🔥', 'GÜN ' + yeniSeri + '!', 'Seri devam ediyor', '+100 💰');
  }, 400);
}

/* ============================================================
   ÇARKIFELEK
   ============================================================ */
const CARK_DILIMLERI = [
  { tip: 'coin', miktar: 50 }, { tip: 'coin', miktar: 100 },
  { tip: 'coin', miktar: 250 }, { tip: 'joker', tipJoker: 'duzeltme' },
  { tip: 'coin', miktar: 500 }, { tip: 'coin', miktar: 1000 },
  { tip: 'joker', tipJoker: 'cift' }, { tip: 'coin', miktar: 100 }
];

function carkifelekAc() {
  const body = $('carkBody'); if (!body) return;
  const cevirebilir = oyunSonCark !== bugun();
  body.innerHTML = `
    <div class="cark-container">
      <div style="position:relative">
        <div class="cark-pointer">▼</div>
        <div class="cark-teker" id="carkTeker"></div>
      </div>
      <div class="cark-odul" id="carkSonuc">${cevirebilir ? 'Çevirmeye hazır mısın?' : 'Bugün çevirdin!'}</div>
      <div class="cark-bilgi" id="carkBilgi">${cevirebilir ? '🎁 Günde 1 kez ücretsiz çevir' : '⏰ Yarın tekrar dene'}</div>
      <button type="button" class="btn btn-gold btn-lg" id="carkBtn" onclick="carkCevir()" ${cevirebilir ? '' : 'disabled style="opacity:.5"'}>
        ${cevirebilir ? '🎰 ÇEVİR' : '✅ YARIN GEL'}
      </button>
    </div>`;
  $('carkModal').classList.add('active');
}

let carkDonuyor = false;
function carkCevir() {
  if (carkDonuyor) return;
  if (oyunSonCark === bugun()) { showToast('info', 'Yarın Gel', 'Bugün zaten çevirdin.'); return; }
  carkDonuyor = true;
  const teker = $('carkTeker');
  const btn = $('carkBtn'); if (btn) btn.disabled = true;
  let index;
  const r = Math.random();
  if (r < 0.20) index = Math.random() < 0.5 ? 3 : 6;
  else { const c = [0, 1, 2, 4, 5, 7]; index = c[Math.floor(Math.random() * c.length)]; }
  const dilim = CARK_DILIMLERI[index];
  const aci = 360 * 6 + (index * 45) + 22.5;
  teker.style.transform = 'rotate(' + aci + 'deg)';
  let sayac = 0;
  const interval = setInterval(() => { sesCal('cark'); titreşim(10); sayac++; if (sayac > 20) clearInterval(interval); }, 150);
  setTimeout(() => {
    clearInterval(interval); carkDonuyor = false;
    oyunSonCark = bugun(); persistOyun();
    let metin = '';
    if (dilim.tip === 'coin') {
      oyunKasa += dilim.miktar;
      metin = '+' + formatCoin(dilim.miktar) + ' 💰';
      ucanPuan(metin, 'var(--gold)');
      konfetiGoster(40);
    } else {
      const j = dilim.tipJoker;
      oyunJokerler[j] = (oyunJokerler[j] || 0) + 1;
      const jAd = j === 'duzeltme' ? '🔄 Düzeltme' : j === 'cift' ? '💰 Çift Kazanç' : '🎯 Garanti';
      metin = '🃏 ' + jAd + ' Joker!';
      ucanPuan('JOKER!', 'var(--purple)');
      konfetiGoster(60);
    }
    persistOyun();
    renderProfilBar();
    renderAnaEkran();
    const s = $('carkSonuc'), b = $('carkBilgi'), bt = $('carkBtn');
    if (s) s.textContent = metin;
    if (b) b.textContent = '⏰ Yarın tekrar dene';
    if (bt) { bt.textContent = '✅ YARIN GEL'; bt.disabled = true; bt.style.opacity = '.5'; }
    sesCal('kupa'); titreşim(150);
    rozetKontrol();
  }, 3200);
}

/* ============================================================
   JOKER
   ============================================================ */
function jokerleriGoster() {
  const body = $('jokerBody'); if (!body) return;
  body.innerHTML = `
    <div class="joker-kart"><h3>🔄 Düzeltme Joker <span class="joker-adet">${oyunJokerler.duzeltme || 0}</span></h3><p>Yanlış tahminini 1 kez düzeltir.</p></div>
    <div class="joker-kart"><h3>💰 Çift Kazanç <span class="joker-adet">${oyunJokerler.cift || 0}</span></h3><p>Bir maçta kazandığın coin 2 katına çıkar.</p></div>
    <div class="joker-kart"><h3>🎯 Garanti Taraf <span class="joker-adet">${oyunJokerler.garanti || 0}</span></h3><p>1 maçın tarafını otomatik doğru işaretler.</p></div>
    <div class="muted" style="text-align:center;margin-top:14px;font-size:.7rem">🎡 Çarkifelek'ten joker kazan!</div>`;
  $('jokerModal').classList.add('active');
}

/* ============================================================
   SONUÇ GİR
   ============================================================ */
function sonuclariGirAc() {
  const body = $('sonucBody'); if (!body) return;
  const bekleyen = kuponlar.filter(k => k.durum === 'bekliyor');
  if (!bekleyen.length) {
    body.innerHTML = '<div class="muted" style="text-align:center;padding:20px">Bekleyen kupon yok.</div>';
    $('sonucModal').classList.add('active');
    return;
  }
  let html = '';
  bekleyen.forEach(k => {
    html += `<div class="card" style="margin-bottom:12px">
      <div class="result-title">${k.tip === 'toto' ? '🎰 Toto' : '⚽ Tahmin'} #${String(k.id).slice(-6)}</div>
      <div class="muted" style="margin-bottom:10px">${k.tarih}</div>`;
    if (k.tip === 'toto') {
      Object.entries(k.secimler || {}).forEach(([id, secimler]) => {
        const m = maclarToto.find(x => String(x.mac_id) === String(id));
        if (!m) return;
        html += `
          <div style="padding:10px 0;border-bottom:1px solid var(--border)">
            <div style="font-weight:800;font-size:.85rem;margin-bottom:6px">#${id} ${escapeHTML(m.ev_sahibi)} - ${escapeHTML(m.deplasman)}</div>
            <div style="font-size:.7rem;color:var(--muted);margin-bottom:6px">Tahmin: <b style="color:var(--orange)">${secimler.join(' / ')}</b></div>
            <div style="display:flex;gap:6px">
              <button type="button" class="btn btn-green btn-sm" onclick="totoSonucKaydet('${k.id}','${id}','1')">1</button>
              <button type="button" class="btn btn-orange btn-sm" onclick="totoSonucKaydet('${k.id}','${id}','X')">X</button>
              <button type="button" class="btn btn-green btn-sm" onclick="totoSonucKaydet('${k.id}','${id}','2')">2</button>
            </div>
            ${secimler.sonuc ? `<div style="margin-top:6px;font-size:.7rem;color:var(--green);font-weight:900">✅ Sonuç: ${secimler.sonuc}</div>` : ''}
          </div>`;
      });
    } else {
      Object.entries(k.secimler || {}).forEach(([id, t]) => {
        let m = null;
        for (const lig of Object.values(liglerData)) { m = (lig.maclar || []).find(x => String(x.mac_id) === String(id)); if (m) break; }
        if (!m) return;
        const skorText = (t.ev !== undefined && t.dep !== undefined) ? t.ev + '-' + t.dep : 'skor yok';
        html += `
          <div style="padding:10px 0;border-bottom:1px solid var(--border)">
            <div style="font-weight:800;font-size:.85rem;margin-bottom:6px">${escapeHTML(m.ev)} - ${escapeHTML(m.dep)}</div>
            <div style="font-size:.7rem;color:var(--muted);margin-bottom:6px">Tahmin: <b style="color:var(--orange)">${t.taraf}</b> · Skor: <b style="color:var(--purple)">${skorText}</b></div>
            <div style="display:flex;gap:6px;align-items:center">
              <span style="font-size:.65rem;color:var(--muted);font-weight:800">SKOR:</span>
              <input type="number" min="0" max="20" placeholder="0" id="sonuc-ev-${k.id}-${id}" style="width:50px;text-align:center;background:var(--bg3);border:1px solid var(--border);color:var(--text);border-radius:6px;padding:6px;font-weight:900">
              <span style="color:var(--muted)">-</span>
              <input type="number" min="0" max="20" placeholder="0" id="sonuc-dep-${k.id}-${id}" style="width:50px;text-align:center;background:var(--bg3);border:1px solid var(--border);color:var(--text);border-radius:6px;padding:6px;font-weight:900">
              <button type="button" class="btn btn-green btn-sm" onclick="tahminSonucKaydet('${k.id}','${id}')">KAYDET</button>
            </div>
            ${t.gercekSonuc ? `<div style="margin-top:6px;font-size:.7rem;color:var(--green);font-weight:900">✅ Sonuç: ${t.gercekSonuc.ev}-${t.gercekSonuc.dep} ${t.tuttu ? '🎯' : ''}</div>` : ''}
          </div>`;
      });
    }
    html += `<button type="button" class="btn btn-blue btn-sm" onclick="kuponuSonuclandir('${k.id}')" style="margin-top:10px;width:100%">✅ KUPONU KAPAT</button></div>`;
  });
  body.innerHTML = html;
  $('sonucModal').classList.add('active');
}

function totoSonucKaydet(kuponId, macId, sonuc) {
  const k = kuponlar.find(x => String(x.id) === String(kuponId)); if (!k) return;
  const secimler = k.secimler[macId]; if (!secimler) return;
  if (secimler.sonuc) { showToast('info', 'Zaten Girildi', 'Girildi.'); return; }
  secimler.sonuc = sonuc;
  secimler.tuttu = secimler.includes(sonuc);
  persistKuponlar(); titreşim(20); sesCal('tik'); sonuclariGirAc();
}

function tahminSonucKaydet(kuponId, macId) {
  const k = kuponlar.find(x => String(x.id) === String(kuponId)); if (!k) return;
  const t = k.secimler[macId]; if (!t) return;
  if (t.gercekSonuc) { showToast('info', 'Zaten Girildi', 'Girildi.'); return; }
  const ev = Number($('sonuc-ev-' + kuponId + '-' + macId)?.value) || 0;
  const dep = Number($('sonuc-dep-' + kuponId + '-' + macId)?.value) || 0;
  const gercekTaraf = ev > dep ? '1' : ev < dep ? '2' : 'X';
  t.gercekSonuc = { ev, dep, taraf: gercekTaraf };
  let kazanc = 0;
  const tarafTuttu = t.taraf === gercekTaraf;
  const skorTuttu = t.ev === ev && t.dep === dep;
  if (skorTuttu) {
    kazanc = 500; oyunToplamSkor++;
    ucanPuan('+500 💰', 'var(--gold)');
    konfetiGoster(50); patlamaGoster();
    titreşim(200); sesCal('kupa');
    setTimeout(() => odulGoster('⚽', 'SKOR TAM!', 'Muhteşem tahmin!', '+500 💰'), 500);
  } else if (tarafTuttu) {
    kazanc = 50; oyunToplamTaraf++;
    ucanPuan('+50 💰', 'var(--green)');
    konfetiGoster(20); titreşim(80); sesCal('kazanc');
  } else {
    titreşim(30); sesCal('hata');
  }
  t.kazanc = kazanc; t.tuttu = tarafTuttu; t.skorTuttu = skorTuttu;
  oyunKasa += kazanc;
  const ligKey = bulLigKey(macId);
  if (ligKey) {
    if (!oyunLigIstatistik[ligKey]) oyunLigIstatistik[ligKey] = { dogru: 0, toplam: 0 };
    oyunLigIstatistik[ligKey].toplam++;
    if (tarafTuttu) oyunLigIstatistik[ligKey].dogru++;
  }
  persistOyun(); persistKuponlar();
  renderProfilBar(); renderAnaEkran();
  sonuclariGirAc(); rozetKontrol();
}

function kuponuSonuclandir(kuponId) {
  const k = kuponlar.find(x => String(x.id) === String(kuponId)); if (!k) return;
  let toplamKazanc = 0, mesaj = '';
  if (k.tip === 'toto') {
    let dogruSayisi = 0;
    Object.values(k.secimler).forEach(s => { if (Array.isArray(s) && s.sonuc && s.includes(s.sonuc)) dogruSayisi++; });
    let ikramiye = 0;
    if (dogruSayisi >= 15) ikramiye = 10000;
    else if (dogruSayisi >= 14) ikramiye = 2000;
    else if (dogruSayisi >= 13) ikramiye = 500;
    else if (dogruSayisi >= 12) ikramiye = 100;
    toplamKazanc = ikramiye;
    mesaj = dogruSayisi + '/15 doğru' + (ikramiye > 0 ? ' · +' + formatCoin(ikramiye) + ' 💰' : '');
  } else {
    let tK = 0, tS = 0, sS = 0;
    Object.values(k.secimler).forEach(t => {
      if (t.kazanc) tK += t.kazanc;
      if (t.tuttu) tS++;
      if (t.skorTuttu) sS++;
    });
    toplamKazanc = tK;
    mesaj = tS + ' taraf · ' + sS + ' skor · +' + formatCoin(tK) + ' 💰';
  }
  k.durum = 'sonuclandi';
  k.toplamKazanc = toplamKazanc;
  persistKuponlar();
  closeModal('sonucModal');
  renderKuponlar(); renderProfilBar(); renderAnaEkran();
  odulGoster('✅', 'KUPON KAPATILDI', mesaj, toplamKazanc > 0 ? '+' + formatCoin(toplamKazanc) + ' 💰' : '+0 💰');
  titreşim(100); sesCal('ok');
}

/* ============================================================
   KUPONLAR
   ============================================================ */
function renderKuponlar() {
  const c = $('kayitliKuponlar'); if (!c) return;
  if (!kuponlar.length) {
    c.innerHTML = '<div class="muted" style="text-align:center;padding:20px">Kupon yok.</div>';
    return;
  }
  c.innerHTML = kuponlar.map(k => {
    const durum = k.durum || 'bekliyor';
    const emoji = durum === 'sonuclandi' ? '✅' : '⏳';
    const ikon = k.tip === 'toto' ? '🎰' : '⚽';
    const baslik = k.tip === 'toto' ? k.kolon + ' kolon' : k.tarafSayisi + ' tahmin';
    const kazanc = k.toplamKazanc || 0;
    const kazancText = kazanc > 0 ? `<b style="color:var(--green)">+${formatCoin(kazanc)} 💰</b>` : `<b style="color:var(--muted)">-</b>`;
    return `
      <div class="kupon-gecmis ${durum}" onclick="kuponDetayAc(${Number(k.id)})">
        <div style="display:flex;justify-content:space-between;gap:8px;font-size:.8rem;margin-bottom:4px">
          <span>${emoji} ${ikon} <b>${baslik}</b></span>
          <span class="muted">${escapeHTML(k.tarih || '')}</span>
        </div>
        <div style="font-size:.72rem;color:var(--muted)">
          ${k.tip === 'toto' ? 'Maliyet: ' + formatCoin(k.maliyet) + ' 💰 · ' + kazancText : 'Kazanç: ' + kazancText}
        </div>
      </div>`;
  }).join('');
}

function kuponDetayAc(id) {
  const k = kuponlar.find(x => Number(x.id) === Number(id)); if (!k) return;
  const body = $('kuponDetayBody'); if (!body) return;
  let html = `<div style="font-size:.8rem">
    <div class="muted" style="margin-bottom:10px">${escapeHTML(k.tarih || '')} · ${k.tip === 'toto' ? k.kolon + ' kolon' : k.tarafSayisi + ' tahmin'}</div>`;
  if (k.tip === 'toto') {
    Object.entries(k.secimler || {}).forEach(([mid, s]) => {
      const m = maclarToto.find(x => String(x.mac_id) === String(mid));
      if (!m || !Array.isArray(s)) return;
      const renk = s.tuttu === true ? 'var(--green)' : s.tuttu === false ? 'var(--red)' : 'var(--muted)';
      html += `<div style="padding:8px 0;border-bottom:1px solid var(--border)">
        <div style="font-weight:800;margin-bottom:4px">#${mid} ${escapeHTML(m.ev_sahibi)} - ${escapeHTML(m.deplasman)}</div>
        <div style="display:flex;justify-content:space-between">
          <span style="color:var(--orange);font-weight:900">${s.join(' / ')}</span>
          <span style="color:${renk};font-weight:900">${s.sonuc ? (s.tuttu ? '✅ ' + s.sonuc : '❌ ' + s.sonuc) : '⏳'}</span>
        </div></div>`;
    });
  } else {
    Object.entries(k.secimler || {}).forEach(([mid, t]) => {
      let m = null;
      for (const lig of Object.values(liglerData)) { m = (lig.maclar || []).find(x => String(x.mac_id) === String(mid)); if (m) break; }
      if (!m) return;
      const renk = t.tuttu === true ? 'var(--green)' : t.tuttu === false ? 'var(--red)' : 'var(--muted)';
      html += `<div style="padding:8px 0;border-bottom:1px solid var(--border)">
        <div style="font-weight:800;margin-bottom:4px">${escapeHTML(m.ev)} - ${escapeHTML(m.dep)}</div>
        <div style="display:flex;justify-content:space-between">
          <span style="color:var(--orange);font-weight:900">${t.taraf}${t.ev !== undefined ? ' · ' + t.ev + '-' + t.dep : ''}</span>
          <span style="color:${renk};font-weight:900">${t.kazanc ? '+' + formatCoin(t.kazanc) + ' 💰' : '⏳'}</span>
        </div></div>`;
    });
  }
  html += `<button type="button" class="btn btn-red btn-lg" onclick="kuponSil(${Number(k.id)})" style="margin-top:12px">🗑️ Sil</button></div>`;
  body.innerHTML = html;
  $('kuponDetayModal')?.classList.add('active');
}

function kuponSil(id) {
  if (!confirm('Kupon silinsin mi?')) return;
  kuponlar = kuponlar.filter(x => Number(x.id) !== Number(id));
  persistKuponlar(); closeModal('kuponDetayModal'); renderKuponlar(); renderAnaEkran();
}

/* ============================================================
   SIRALAMA + ROZET
   ============================================================ */
function renderSiralama() {
  const c = $('siralamaListesi'); if (!c) return;
  const botlar = [
    { isim: 'Ahmet', puan: 2450 }, { isim: 'Mehmet', puan: 2100 },
    { isim: 'Ayşe', puan: 1850 }, { isim: 'Can', puan: 1100 },
    { isim: 'Zeynep', puan: 950 }, { isim: 'Emre', puan: 780 }
  ];
  const siralama = [...botlar, { isim: oyunIsim || 'Sen', puan: Math.floor(oyunKasa), sen: true }]
    .sort((a, b) => b.puan - a.puan);
  c.innerHTML = siralama.map((k, i) => {
    const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : (i + 1) + '.';
    const vurgu = k.sen ? 'color:var(--green);font-weight:900;background:rgba(0,217,126,.08)' : '';
    return `<div style="padding:12px 10px;border-bottom:1px solid var(--border);display:flex;justify-content:space-between;${vurgu};border-radius:6px">
      <span>${medal} ${escapeHTML(k.isim)}${k.sen ? ' (Sen)' : ''}</span>
      <span>${formatCoin(k.puan)} 💰</span>
    </div>`;
  }).join('');
}

function renderRozetler() {
  const c = $('rozetListesi'); if (!c) return;
  c.innerHTML = `<div class="rozet-grid">${ROZETLER.map(r => {
    const kazanildi = oyunRozetler.includes(r.id);
    return `<div class="rozet-item ${kazanildi ? 'kazanildi' : ''}">
      <span class="ikon">${r.ikon}</span><span class="ad">${r.ad}</span>
    </div>`;
  }).join('')}</div>`;
}

/* ============================================================
   PROFİL
   ============================================================ */
function bulLigKey(macId) {
  for (const [key, lig] of Object.entries(liglerData)) {
    if ((lig.maclar || []).some(m => String(m.mac_id) === String(macId))) return key;
  }
  return null;
}

function renderProfil() {
  const c = $('profilListesi'); if (!c) return;
  const seviye = seviyeHesapla();
  const seviyeIdx = seviyeIndex();
  const seviyeMin = seviye.min;
  const seviyeMax = seviye.max === Infinity ? seviye.min + 5000 : seviye.max;
  const ilerleme = Math.min(100, ((oyunKasa - seviyeMin) / (seviyeMax - seviyeMin)) * 100);

  const ligIsimleri = {
    premier: { isim: 'Premier Lig', bayrak: '🇬🇧' },
    laliga: { isim: 'La Liga', bayrak: '🇪🇸' },
    seriea: { isim: 'Serie A', bayrak: '🇮🇹' },
    superlig: { isim: 'Süper Lig', bayrak: '🇹🇷' },
    sampiyonlar: { isim: 'Şampiyonlar Ligi', bayrak: '🏆' },
    avrupa: { isim: 'UEFA Avrupa Ligi', bayrak: '🥈' }
  };

  let ligBasariHTML = '';
  Object.entries(oyunLigIstatistik).forEach(([ligKey, ist]) => {
    if (!ist || !ist.toplam) return;
    const yuzde = ((ist.dogru / ist.toplam) * 100).toFixed(0);
    const ligBilgi = ligIsimleri[ligKey] || { isim: ligKey, bayrak: '⚽' };
    let unvan = '🥉 Acemi';
    if (yuzde >= 80) unvan = '👑 Efsane';
    else if (yuzde >= 70) unvan = '💎 Kral';
    else if (yuzde >= 60) unvan = '🥇 Usta';
    else if (yuzde >= 50) unvan = '🥈 İyi';
    ligBasariHTML += `
      <div class="bilgi-satir">
        <span>${ligBilgi.bayrak} ${ligBilgi.isim}</span>
        <span style="text-align:right">
          <b style="color:var(--green)">%${yuzde}</b>
          <div style="font-size:.6rem;color:var(--muted2)">${unvan}</div>
        </span>
      </div>`;
  });
  if (!ligBasariHTML) ligBasariHTML = '<div class="muted" style="text-align:center;padding:10px">Henüz lig başarın yok.</div>';

  c.innerHTML = `
    <button type="button" class="btn btn-gray" onclick="switchTab(0, document.querySelectorAll('.tab')[0])" style="margin-bottom:12px;width:100%">⬅️ GERİ DÖN</button>

    <div class="profil-kart">
      <div class="profil-avatar-buyuk">👤</div>
      <div class="profil-isim-buyuk">${escapeHTML(oyunIsim || 'Oyuncu')}</div>
      <div class="profil-seviye-buyuk">${seviye.ikon} ${seviye.ad}</div>
      <div class="profil-kasa-buyuk">💰 ${formatCoin(Math.floor(oyunKasa))}</div>
      <div class="seviye-bar" style="margin:16px 0 6px"><div class="seviye-dolu" style="width:${ilerleme}%"></div></div>
      <button type="button" class="btn btn-blue btn-lg" onclick="profilDuzenleAc()" style="margin-top:14px">⚙️ PROFİLİ DÜZENLE</button>
    </div>

    <div class="bilgi-kart">
      <div class="bilgi-baslik">📋 KİMLİK</div>
      <div class="bilgi-satir"><span>Ad</span><b>${escapeHTML(oyunIsim || 'Belirtilmedi')}</b></div>
      <div class="bilgi-satir"><span>Tuttuğum Takım</span><b>${escapeHTML(oyunTakim || 'Belirtilmedi')}</b></div>
      <div class="bilgi-satir"><span>Takip Ettiğim Lig</span><b>${escapeHTML(oyunLig || 'Belirtilmedi')}</b></div>
      <div class="bilgi-satir"><span>Seri</span><b>🔥 ${oyunSeri} gün</b></div>
    </div>

    <div class="bilgi-kart">
      <div class="bilgi-baslik">📊 İSTATİSTİK</div>
      <div class="bilgi-satir"><span>Toplam Taraf Doğru</span><b>${oyunToplamTaraf}</b></div>
      <div class="bilgi-satir"><span>Toplam Skor Tam</span><b>${oyunToplamSkor}</b></div>
      <div class="bilgi-satir"><span>Kazanılan Rozet</span><b>${oyunRozetler.length}/${ROZETLER.length}</b></div>
      <div class="bilgi-satir"><span>Jokerler</span><b>🔄${oyunJokerler.duzeltme || 0} 💰${oyunJokerler.cift || 0} 🎯${oyunJokerler.garanti || 0}</b></div>
    </div>

    <div class="bilgi-kart">
      <div class="bilgi-baslik">🏆 LİG BAŞARILARIM</div>
      ${ligBasariHTML}
    </div>
  `;
}

function profilDuzenleAc() {
  const body = $('profilDuzenleBody'); if (!body) return;
  const takimlar = ['Galatasaray', 'Fenerbahçe', 'Beşiktaş', 'Trabzonspor', 'Başakşehir', 'Real Madrid', 'Barcelona', 'Man. United', 'Liverpool', 'Arsenal', 'Milan', 'Inter', 'Juventus', 'Bayern Münih', 'PSG', 'Diğer'];
  const ligler = ['Süper Lig', 'Premier Lig', 'La Liga', 'Serie A', 'Şampiyonlar Ligi', 'UEFA Avrupa Ligi'];
  body.innerHTML = `
    <label style="font-size:.7rem;color:var(--muted2);font-weight:900;display:block;margin:12px 0 4px">ADIN</label>
    <input type="text" id="profilIsim" value="${escapeHTML(oyunIsim)}" maxlength="20" style="width:100%;background:var(--bg3);border:1px solid var(--border2);color:var(--text);border-radius:8px;padding:10px;font-size:.9rem;font-weight:700">
    <label style="font-size:.7rem;color:var(--muted2);font-weight:900;display:block;margin:12px 0 4px">TUTTUĞUN TAKIM</label>
    <select id="profilTakim" style="width:100%;background:var(--bg3);border:1px solid var(--border2);color:var(--text);border-radius:8px;padding:10px;font-size:.9rem;font-weight:700">
      <option value="">Seç...</option>
      ${takimlar.map(t => `<option value="${t}" ${oyunTakim === t ? 'selected' : ''}>${t}</option>`).join('')}
    </select>
    <label style="font-size:.7rem;color:var(--muted2);font-weight:900;display:block;margin:12px 0 4px">TAKİP ETTİĞİN LİG</label>
    <select id="profilLig" style="width:100%;background:var(--bg3);border:1px solid var(--border2);color:var(--text);border-radius:8px;padding:10px;font-size:.9rem;font-weight:700">
      <option value="">Seç...</option>
      ${ligler.map(l => `<option value="${l}" ${oyunLig === l ? 'selected' : ''}>${l}</option>`).join('')}
    </select>
    <button type="button" class="btn btn-green btn-lg" onclick="profilKaydet()" style="margin-top:20px;width:100%">✅ KAYDET</button>`;
  $('profilDuzenleModal').classList.add('active');
}

function profilKaydet() {
  oyunIsim = $('profilIsim')?.value.trim() || 'Oyuncu';
  oyunTakim = $('profilTakim')?.value || '';
  oyunLig = $('profilLig')?.value || '';
  persistOyun();
  closeModal('profilDuzenleModal');
  renderProfilBar(); renderProfil(); renderAnaEkran();
  titreşim(50); sesCal('ok');
  showToast('success', '✅ Profil Kaydedildi', 'Bilgilerin güncellendi.');
}

/* ============================================================
   SEKME + MODAL + TOAST
   ============================================================ */
function switchTab(i, el) {
  document.querySelectorAll('.tab, .page').forEach(n => n.classList.remove('active'));
  if (el) el.classList.add('active');
  const page = $('page-' + i);
  if (page) page.classList.add('active');
  if (i === 0) renderAnaEkran();
  if (i === 3) renderKuponlar();
  if (i === 4) { renderSiralama(); renderRozetler(); }
  if (i === 5) renderProfil();
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
   BAŞLAT
   ============================================================ */
window.addEventListener('DOMContentLoaded', async () => {
  initTelegram();
  await loadData();

  // Splash 2 saniye sonra gizle
  setTimeout(() => {
    splashGizle();
    setTimeout(() => {
      if (!oyunOnboarding) {
        onboardingGoster();
      } else {
        gunlukBonusKontrol();
        renderAnaEkran();
      }
    }, 400);
  }, 2000);
});
