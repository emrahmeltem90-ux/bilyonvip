/* ============================================================
   ARKA PLAN MÜZİĞİ (muzik.mp3)
   ============================================================ */
let muzikObj = null;
let muzikCalıyor = false;

function muzikBaslat() {
  if (muzikCalıyor || !user.muzik) return;
  try {
    if (!muzikObj) {
      muzikObj = new Audio('muzik.mp3');
      muzikObj.loop = true;
      muzikObj.volume = 0.35;
    }
    muzikObj.play().then(() => { muzikCalıyor = true; }).catch(() => {});
  } catch (e) {}
}

function muzikDurdur() {
  if (!muzikObj) return;
  try {
    muzikObj.pause();
    muzikObj.currentTime = 0;
    muzikCalıyor = false;
  } catch (e) {}
}

function muzikToggle() {
  user.muzik = !user.muzik;
  persistUser();
  if (user.muzik) {
    muzikBaslat();
    toast('🎵 Müzik açık');
  } else {
    muzikDurdur();
    toast('🔇 Müzik kapalı');
  }
}

/* ============================================================
   SKORLAB QUIZ · app.js (TAM SÜRÜM)
   ============================================================ */
'use strict';

let TG = null;
const $ = id => document.getElementById(id);

function safeReadJSON(key, fallback) {
  try { const raw = localStorage.getItem(key); return raw == null ? fallback : JSON.parse(raw); }
  catch (e) { return fallback; }
}
function safeSaveJSON(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); return true; }
  catch (e) { return false; }
}
function bugun() { return new Date().toISOString().split('T')[0]; }
function formatSayi(n) { return Number(n || 0).toLocaleString('tr-TR'); }

function initTelegram() {
  if (!window.Telegram?.WebApp) return;
  TG = window.Telegram.WebApp;
  try {
    TG.ready(); TG.expand();
    if (typeof TG.enableClosingConfirmation === 'function') TG.enableClosingConfirmation();
  } catch (e) {}
}

let titreşimAktif = safeReadJSON('skorlab_titresim', true);
let sesAktif = safeReadJSON('skorlab_ses', true);

function titreşim(ms = 30) {
  if (!titreşimAktif) return;
  try {
    if (navigator.vibrate) navigator.vibrate(ms);
    else if (TG?.HapticFeedback) TG.HapticFeedback.impactOccurred('light');
  } catch (e) {}
}

let audioCtx = null;
function getCtx() {
  if (!audioCtx) {
    try { audioCtx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) {}
  }
  return audioCtx;
}
function sesCal(tur) {
  if (!sesAktif) return;
  try {
    const ctx = getCtx();
    if (!ctx) return;
    if (ctx.state === 'suspended') ctx.resume();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain); gain.connect(ctx.destination);
    let freq = 600, dur = 0.15, type = 'sine';
    if (tur === 'tik') { freq = 600; dur = 0.08; }
    else if (tur === 'ok') { freq = 880; dur = 0.15; }
    else if (tur === 'kazanc') { freq = 1200; dur = 0.2; }
    else if (tur === 'kupa') { freq = 1500; dur = 0.3; }
    else if (tur === 'hata') { freq = 300; dur = 0.25; type = 'square'; }
    else if (tur === 'cark') { freq = 1500; dur = 0.06; }
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.value = 0.08;
    osc.start();
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
    osc.stop(ctx.currentTime + dur);
  } catch (e) {}
}

let user = safeReadJSON('skorlab_user', {
  isim: 'Oyuncu', coin: 500, yildiz: 0,
  toplamDogru: 0, toplamYanlis: 0, toplamPuan: 0,
  enYuksekPuan: 0, tamPuanLevel: 0,
  seri: 0, sonGiris: '', gunlukSonAlim: 0, gunlukSeri: 0,
  sonCark: 0, toplamCark: 0, toplamJoker: 0,
  basarimlar: [], kategoriler: {},
  ozelTema: 'default', avatar: '👤',
  vip: false, vipBitis: 0,
  muzik: false, ses: true, titresim: true, aciklama: true,
  toplamOynanan: 0,
  gununSonOynanan: '', gununSeri: 0,
  tarihSonOynanan: ''
});
if (typeof user.coin !== 'number') user.coin = 500;
if (typeof user.yildiz !== 'number') user.yildiz = 0;
if (!user.kategoriler || typeof user.kategoriler !== 'object') user.kategoriler = {};
if (!Array.isArray(user.basarimlar)) user.basarimlar = [];
if (typeof user.isim !== 'string') user.isim = 'Oyuncu';

function persistUser() { safeSaveJSON('skorlab_user', user); }

let sorularData = { NORMAL: [], SAMPİYONLAR: [], EFSANELER: [] };
let sorularYuklendi = false;

async function sorulariYukle() {
  if (sorularYuklendi) return true;
  try {
    const normalDosyalar = ['sorular_1.json', 'sorular_2.json', 'sorular_3.json', 'sorular_4.json'];
    for (const dosya of normalDosyalar) {
      try {
        const res = await fetch(dosya);
        if (!res.ok) throw new Error('HTTP ' + res.status);
        const data = await res.json();
        const kategoriler = data.kategoriler || [];
        kategoriler.forEach(k => { k.bolum = 'NORMAL'; sorularData.NORMAL.push(k); });
      } catch (e) { console.error('❌ ' + dosya + ':', e.message); }
    }
    try {
      const res = await fetch('sorular_5.json');
      if (res.ok) {
        const data = await res.json();
        const kategoriler = data.kategoriler || [];
        kategoriler.forEach(k => { k.bolum = 'SAMPİYONLAR'; sorularData.SAMPİYONLAR.push(k); });
      }
    } catch (e) {}
    try {
      const res = await fetch('sorular_6.json');
      if (res.ok) {
        const data = await res.json();
        const kategoriler = data.kategoriler || [];
        kategoriler.forEach(k => { k.bolum = 'EFSANELER'; sorularData.EFSANELER.push(k); });
      }
    } catch (e) {}
    sorularYuklendi = true;
    return true;
  } catch (e) {
    return false;
  }
}

function aktifSorular() { return sorularData[aktifBolum] || []; }
function kategoriBul(id) {
  for (const bolum of Object.keys(sorularData)) {
    const k = sorularData[bolum].find(x => x.kategori_id == id);
    if (k) return k;
  }
  return null;
}

let aktifBolum = 'NORMAL';
let aktifKategori = null;
let quizSorular = [];
let quizIndex = 0;
let quizSkor = 0;
let quizDogru = 0;
let quizYanlis = 0;
let quizCombo = 0;
let quizEnIyiCombo = 0;
let quizTimer = null;
let quizTimerKalan = 15;
let quizCevaplandi = false;
let quizJoker = { cut: false, answer: false, heart: false };
let quizCiftHak = false;
let quizPauseAktif = false;
let gununModu = false;

function ekranGoster(id) {
  const tumEkranlar = document.querySelectorAll('.ekran');
  tumEkranlar.forEach(e => e.classList.remove('aktif'));
  const el = document.getElementById(id);
  if (!el) return;
  el.classList.add('aktif');
  const ustBar = document.getElementById('ustBar');
  if (ustBar) {
    if (id === 'quizEkran') ustBar.style.display = 'none';
    else ustBar.style.display = 'flex';
  }
  window.scrollTo(0, 0);
}

function ustBarGuncelle() {
  if ($('ubYildiz')) $('ubYildiz').textContent = formatSayi(user.yildiz);
  if ($('ubCoin')) $('ubCoin').textContent = formatSayi(user.coin);
  if ($('katYildiz')) $('katYildiz').textContent = formatSayi(user.yildiz);
  if ($('magazaCoin')) $('magazaCoin').textContent = formatSayi(user.coin);
}

function toast(mesaj) {
  const t = $('toast');
  if (!t) return;
  t.textContent = mesaj;
  t.classList.add('aktif');
  clearTimeout(t._timeout);
  t._timeout = setTimeout(() => t.classList.remove('aktif'), 2000);
}

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

window.addEventListener('DOMContentLoaded', async () => {
  initTelegram();
  await sorulariYukle();
  await splashBitir();
});

async function splashBitir() {
  await new Promise(r => setTimeout(r, 1500));
  const splash = $('splash');
  if (splash) splash.classList.add('gizle');
  setTimeout(() => {
    const ub = $('ustBar');
    if (ub) ub.style.display = 'flex';
    if (!user || !user.gunlukSonAlim) {
      $('onboarding')?.classList.add('aktif');
    } else {
      anaEkranaDon();
    }
  }, 500);
}

function onboardingBitir() {
  $('onboarding')?.classList.remove('aktif');
  user.sonGiris = bugun();
  persistUser();
  anaEkranaDon();
}

function anaEkranaDon() {
  ekranGoster('menuEkran');
  const ub = $('ustBar');
  if (ub) ub.style.display = 'flex';
  ustBarGuncelle();
  menuGuncelle();
}

function menuGuncelle() {
  if ($('menuIsim')) $('menuIsim').textContent = user.isim || 'Oyuncu';
  if ($('menuYildiz')) $('menuYildiz').textContent = formatSayi(user.yildiz);
  if ($('menuDogru')) $('menuDogru').textContent = formatSayi(user.toplamDogru);
  if ($('menuBasarim')) $('menuBasarim').textContent = formatSayi(user.basarimlar.length);
  const gunlukBadge = $('gunlukBadge');
  if (gunlukBadge) {
    const gecen = Date.now() - (user.gunlukSonAlim || 0);
    if (gecen >= 24 * 60 * 60 * 1000 || !user.gunlukSonAlim) gunlukBadge.classList.add('aktif');
    else gunlukBadge.classList.remove('aktif');
  }
  const carkBadge = $('carkBadge');
  if (carkBadge) {
    const gecen = Date.now() - (user.sonCark || 0);
    if (gecen >= 4 * 60 * 60 * 1000 || !user.sonCark) carkBadge.classList.add('aktif');
    else carkBadge.classList.remove('aktif');
  }
  const gununBadge = $('gununBadge');
  if (gununBadge) {
    if (user.gununSonOynanan !== bugun()) gununBadge.classList.add('aktif');
    else gununBadge.classList.remove('aktif');
  }
}

/* KATEGORİ */
function oyunaBasla() {
  gununModu = false;
  aktifBolum = 'NORMAL';
  document.querySelectorAll('.bolum-tab').forEach(t => t.classList.remove('aktif'));
  document.querySelector('.bolum-tab')?.classList.add('aktif');
  ekranGoster('kategoriEkran');
  kategoriListesiniGuncelle();
}

function bolumSec(bolum, el) {
  aktifBolum = bolum;
  document.querySelectorAll('.bolum-tab').forEach(t => t.classList.remove('aktif'));
  if (el) el.classList.add('aktif');
  kategoriListesiniGuncelle();
  titreşim(20); sesCal('tik');
}

function kategoriListesiniGuncelle() {
  const liste = $('kategoriListesi');
  if (!liste) return;
  const kategoriler = aktifSorular();
  if (!kategoriler.length) {
    liste.innerHTML = '<div style="text-align:center;color:var(--muted);padding:30px">Bu bölümde kategori yok.</div>';
    return;
  }
  let html = '';
  kategoriler.forEach((kat, index) => {
    const ilerleme = user.kategoriler[kat.kategori_id] || { yildiz: 0, enYuksekPuan: 0, tamamlandi: false };
    const yildizStr = ilerleme.yildiz === 1 ? '⭐☆☆' : ilerleme.yildiz === 2 ? '⭐⭐☆' : ilerleme.yildiz === 3 ? '⭐⭐⭐' : '☆☆☆';
    const toplamSoru = kat.sorular?.length || 10;
    const ilerlemeYuzde = Math.min(100, (ilerleme.enYuksekPuan / (toplamSoru * 100)) * 100) || 0;

    let kilitli = false;
    let kilitTipi = '';
    let kilitMiktar = 0;

    if (aktifBolum !== 'NORMAL') {
      if (kat.gereken_yildiz > 0 && !ilerleme.tamamlandi) {
        kilitli = true;
        kilitTipi = 'yildiz';
        kilitMiktar = kat.gereken_yildiz;
      }
    } else {
      const oncekiKategori = index > 0 ? kategoriler[index - 1] : null;
      const oncekiTamam = oncekiKategori ? (user.kategoriler[oncekiKategori.kategori_id]?.tamamlandi || false) : true;
      if (!oncekiTamam && !ilerleme.tamamlandi) {
        kilitli = true;
        kilitTipi = 'coin';
        kilitMiktar = 100;
      }
    }

    let kilitInfo = '';
    if (kilitli) {
      kilitInfo = `<div class="kat-kilit" style="cursor:pointer" onclick="kilitAcModal(${kat.kategori_id}, '${kilitTipi}', ${kilitMiktar})">
          <div class="kat-kilit-info"><span>${kilitTipi === 'yildiz' ? '⭐' : '💰'} ${kilitMiktar}</span></div>
        </div>`;
    } else {
      kilitInfo = `<div class="kat-kilit">${ilerleme.yildiz === 3 ? '🏆' : '▶️'}</div>`;
    }

    html += `
      <div class="kat-kart ${kilitli ? 'kilitli' : ''}" onclick="kategoriSec(${kat.kategori_id})">
        <div class="kat-ikon">${kat.kategori_ikon || '⚽'}</div>
        <div class="kat-bilgi">
          <div class="kat-isim">${kat.kategori_adi}</div>
          <div class="kat-progress">
            <div class="kat-progress-dolu" style="width:${ilerlemeYuzde}%"></div>
            <div class="kat-progress-text">${ilerleme.enYuksekPuan || 0}/${toplamSoru * 100}</div>
          </div>
          <div class="kat-yildizlar">${yildizStr}</div>
        </div>
        ${kilitInfo}
      </div>`;
  });
  liste.innerHTML = html;
  ustBarGuncelle();
}

let kilitliKategoriId = null;
let kilitliKategoriTip = null;
let kilitliKategoriMiktar = 0;

function kilitAcModal(id, tip, miktar) {
  const kat = kategoriBul(id);
  if (!kat) return;
  kilitliKategoriId = id;
  kilitliKategoriTip = tip;
  kilitliKategoriMiktar = miktar;
  const modal = $('kilitModal');
  if (!modal) return;

  $('kilitModalBaslik').textContent = kat.kategori_adi;

  const yildizBtn = $('kilitYildizBtn');
  const coinBtn = $('kilitCoinBtn');

  if (tip === 'yildiz') {
    yildizBtn.style.display = 'flex';
    coinBtn.style.display = 'none';
    $('kilitModalYildiz').textContent = `⭐ ${miktar}`;
    if (user.yildiz >= miktar) {
      yildizBtn.disabled = false;
      yildizBtn.classList.remove('pasif');
    } else {
      yildizBtn.disabled = true;
      yildizBtn.classList.add('pasif');
    }
  } else {
    yildizBtn.style.display = 'none';
    coinBtn.style.display = 'flex';
    $('kilitModalCoin').textContent = `💰 ${miktar}`;
    if (user.coin >= miktar) {
      coinBtn.disabled = false;
      coinBtn.classList.remove('pasif');
    } else {
      coinBtn.disabled = true;
      coinBtn.classList.add('pasif');
    }
  }

  modal.classList.add('aktif');
  titreşim(20); sesCal('tik');
}

function kilitKapat() {
  $('kilitModal')?.classList.remove('aktif');
}

function kilitYildizlaAc() {
  const kat = kategoriBul(kilitliKategoriId);
  if (!kat) return;
  const gereken = kilitliKategoriMiktar;
  if (user.yildiz < gereken) { toast('❌ Yetersiz yıldız!'); sesCal('hata'); return; }

  user.yildiz -= gereken;
  user.kategoriler[kat.kategori_id] = { yildiz: 0, enYuksekPuan: 0, tamamlandi: true };
  persistUser(); ustBarGuncelle();
  konfetiGoster(30); sesCal('kupa'); titreşim(100);
  toast(`✅ ${kat.kategori_adi} yıldızla açıldı!`);
  kilitKapat();
  kategoriListesiniGuncelle();
}

function kilitCoinleAc() {
  const kat = kategoriBul(kilitliKategoriId);
  if (!kat) return;
  const gereken = kilitliKategoriMiktar;
  if (user.coin < gereken) { toast('❌ Yetersiz coin!'); sesCal('hata'); return; }

  user.coin -= gereken;
  user.kategoriler[kat.kategori_id] = { yildiz: 0, enYuksekPuan: 0, tamamlandi: true };
  persistUser(); ustBarGuncelle();
  konfetiGoster(30); sesCal('kupa'); titreşim(100);
  toast(`✅ ${kat.kategori_adi} coinle açıldı!`);
  kilitKapat();
  kategoriListesiniGuncelle();
}

function kategoriSec(id) {
  const kat = kategoriBul(id);
  if (!kat) { toast('Kategori bulunamadı'); return; }

  const ilerleme = user.kategoriler[kat.kategori_id] || { tamamlandi: false };
  const kategoriler = aktifSorular();
  const index = kategoriler.findIndex(k => k.kategori_id == id);
  const oncekiKategori = index > 0 ? kategoriler[index - 1] : null;
  const oncekiTamam = oncekiKategori ? (user.kategoriler[oncekiKategori.kategori_id]?.tamamlandi || false) : true;

  if (aktifBolum !== 'NORMAL') {
    if (kat.gereken_yildiz > 0 && !ilerleme.tamamlandi) {
      kilitAcModal(id, 'yildiz', kat.gereken_yildiz);
      return;
    }
  } else {
    if (!oncekiTamam && !ilerleme.tamamlandi) {
      kilitAcModal(id, 'coin', 100);
      return;
    }
  }

  aktifKategori = kat;
  gununModu = false;
  quizBaslat();
}

/* QUIZ */
function quizBaslat() {
  if (!aktifKategori || !aktifKategori.sorular) { toast('Soru yok'); return; }
  quizSorular = [...aktifKategori.sorular].sort(() => Math.random() - 0.5).slice(0, 10);
  quizIndex = 0; quizSkor = 0; quizDogru = 0; quizYanlis = 0;
  quizCombo = 0; quizEnIyiCombo = 0;
  quizJoker = { cut: false, answer: false, heart: false };
  quizCiftHak = false;
  user.toplamOynanan = (user.toplamOynanan || 0) + 1;
  persistUser();
  ekranGoster('quizEkran');
  soruGoster();
}

function soruGoster() {
  if (quizIndex >= quizSorular.length) { quizBitir(); return; }
  const soru = quizSorular[quizIndex];
  quizCevaplandi = false;
  quizCiftHak = false;
  if ($('quizSayac')) $('quizSayac').textContent = `${quizIndex + 1}/${quizSorular.length}`;
  if ($('quizProgress')) $('quizProgress').style.width = ((quizIndex / quizSorular.length) * 100) + '%';
  const comboEl = $('quizCombo');
  if (comboEl) {
    if (quizCombo >= 2) {
      comboEl.style.display = 'block';
      if ($('comboText')) $('comboText').textContent = quizCombo + 'x';
    } else comboEl.style.display = 'none';
  }
  if ($('quizSoru')) $('quizSoru').textContent = soru.soru;
  const secEl = $('quizSecenekler');
  if (secEl) {
    secEl.innerHTML = '';
    const secenekler = soru.secenekler;
    const siralama = ['A', 'B', 'C', 'D'].filter(h => secenekler[h] !== undefined);
    siralama.forEach(h => {
      const btn = document.createElement('button');
      btn.className = 'quiz-secenek';
      btn.dataset.harf = h;
      btn.innerHTML = `<span class="harf">${h}</span><span>${secenekler[h]}</span>`;
      btn.onclick = () => cevapVer(h, btn);
      secEl.appendChild(btn);
    });
  }
  if ($('quizAciklama')) $('quizAciklama').style.display = 'none';
  document.querySelectorAll('.joker-btn').forEach(b => {
    b.disabled = false;
    b.classList.remove('kullanildi');
  });
  timerBaslat();
}

function timerBaslat() {
  clearInterval(quizTimer);
  quizTimerKalan = 15;
  timerGuncelle();
  quizTimer = setInterval(() => {
    if (quizPauseAktif) return;
    quizTimerKalan--;
    timerGuncelle();
    if (quizTimerKalan <= 5) $('quizTimer')?.classList.add('uyari');
    if (quizTimerKalan <= 0) {
      clearInterval(quizTimer);
      if (!quizCevaplandi) {
        quizCevaplandi = true; quizYanlis++; quizCombo = 0;
        sesCal('hata'); titreşim(150);
        dogruCevabiGoster();
        setTimeout(sonrakiSoru, 2000);
      }
    }
  }, 1000);
}
function timerGuncelle() {
  const el = $('quizTimer');
  if (el) {
    el.textContent = quizTimerKalan + 's';
    if (quizTimerKalan > 5) el.classList.remove('uyari');
  }
}

function cevapVer(harf, btn) {
  if (quizCevaplandi) return;
  const soru = quizSorular[quizIndex];
  const dogru = soru.dogru_cevap;
  if (harf === dogru) {
    quizCevaplandi = true;
    clearInterval(quizTimer);
    btn.classList.add('dogru');
    quizDogru++;
    quizCombo++;
    if (quizCombo > quizEnIyiCombo) quizEnIyiCombo = quizCombo;
    const comboBonus = Math.max(0, (quizCombo - 1) * 10);
    const puan = 100 + comboBonus;
    quizSkor += puan;
    user.toplamDogru++;
    user.toplamPuan += puan;
    const coin = 5 + (quizCombo > 1 ? quizCombo : 0);
    user.coin += coin;
    persistUser(); ustBarGuncelle();
    sesCal('kazanc'); titreşim(50);
    ucanPuan('+' + puan, 'var(--green)');
    if (quizCombo >= 2) ucanPuan('🔥 ' + quizCombo + 'x COMBO', 'var(--orange)');
    aciklamaGoster(soru.aciklama);
    tumSeceneklerKapat();
    setTimeout(sonrakiSoru, 1800);
  } else {
    if (quizCiftHak) {
      quizCiftHak = false;
      btn.classList.add('yanlis');
      btn.disabled = true;
      sesCal('hata'); titreşim(100);
      toast('❤️ Çift hak kullanıldı, tekrar dene');
      return;
    }
    quizCevaplandi = true;
    clearInterval(quizTimer);
    btn.classList.add('yanlis');
    quizYanlis++;
    quizCombo = 0;
    user.toplamYanlis++;
    persistUser();
    sesCal('hata'); titreşim(150);
    dogruCevabiGoster();
    aciklamaGoster(soru.aciklama);
    setTimeout(sonrakiSoru, 2800);
  }
}

function tumSeceneklerKapat() {
  document.querySelectorAll('.quiz-secenek').forEach(b => b.disabled = true);
}
function dogruCevabiGoster() {
  const soru = quizSorular[quizIndex];
  document.querySelectorAll('.quiz-secenek').forEach(b => {
    b.disabled = true;
    if (b.dataset.harf === soru.dogru_cevap) b.classList.add('dogru');
  });
}
function aciklamaGoster(metin) {
  if (!metin) return;
  const box = $('quizAciklama');
  const txt = $('qaText');
  if (box && txt) { txt.textContent = metin; box.style.display = 'block'; }
}
function sonrakiSoru() {
  quizIndex++;
  if (quizIndex >= quizSorular.length) quizBitir();
  else soruGoster();
}

const JOKER_FIYAT = { cut: 30, answer: 70, heart: 50 };
function jokerKullan(tip) {
  if (quizCevaplandi) return;
  if (quizJoker[tip]) { toast('Bu joker kullanıldı'); return; }
  if (!user.vip) {
    if (user.coin < JOKER_FIYAT[tip]) {
      toast('❌ Yetersiz coin!'); sesCal('hata'); titreşim(100);
      return;
    }
    user.coin -= JOKER_FIYAT[tip];
  }
  quizJoker[tip] = true;
  user.toplamJoker = (user.toplamJoker || 0) + 1;
  persistUser(); ustBarGuncelle();
  sesCal('tik'); titreşim(20);
  const btn = document.querySelector(`.joker-btn[onclick*="${tip}"]`);
  if (btn) { btn.disabled = true; btn.classList.add('kullanildi'); }
  if (tip === 'cut') {
    const soru = quizSorular[quizIndex];
    const yanlislar = ['A', 'B', 'C', 'D'].filter(h => h !== soru.dogru_cevap && soru.secenekler[h] !== undefined);
    yanlislar.sort(() => Math.random() - 0.5);
    yanlislar.slice(0, 2).forEach(h => {
      const b = document.querySelector(`.quiz-secenek[data-harf="${h}"]`);
      if (b) b.classList.add('gizli');
    });
  } else if (tip === 'answer') {
    const soru = quizSorular[quizIndex];
    const b = document.querySelector(`.quiz-secenek[data-harf="${soru.dogru_cevap}"]`);
    if (b) b.classList.add('dogru');
  } else if (tip === 'heart') {
    quizCiftHak = true;
    toast('❤️ Çift hak aktif!');
  }
}

function quizBitir() {
  clearInterval(quizTimer);
  const toplamSoru = quizSorular.length;
  const yuzde = (quizDogru / toplamSoru) * 100;
  let yildiz = 0;
  if (yuzde >= 100) yildiz = 3;
  else if (yuzde >= 70) yildiz = 2;
  else if (yuzde >= 30) yildiz = 1;
  const coinOdul = quizDogru * 5 + (yildiz === 3 ? 50 : yildiz === 2 ? 30 : yildiz === 1 ? 15 : 0);
  user.coin += coinOdul;
  if (yildiz > 0) user.yildiz += yildiz;
  if (!gununModu) {
    const katId = aktifKategori.kategori_id;
    const mevcut = user.kategoriler[katId] || { yildiz: 0, enYuksekPuan: 0, tamamlandi: false };
    if (quizSkor > mevcut.enYuksekPuan) mevcut.enYuksekPuan = quizSkor;
    if (yildiz > mevcut.yildiz) mevcut.yildiz = yildiz;
    mevcut.tamamlandi = true;
    user.kategoriler[katId] = mevcut;
    if (quizSkor > user.enYuksekPuan) user.enYuksekPuan = quizSkor;
    if (yildiz === 3) user.tamPuanLevel = (user.tamPuanLevel || 0) + 1;
  } else {
    gununBitir();
  }
  persistUser(); ustBarGuncelle();
  const yildizStr = yildiz === 1 ? '⭐☆☆' : yildiz === 2 ? '⭐⭐☆' : yildiz === 3 ? '⭐⭐⭐' : '☆☆☆';
  if ($('sonucYildizlar')) $('sonucYildizlar').textContent = yildizStr;
  if ($('sonucSkor')) $('sonucSkor').textContent = quizSkor + ' PUAN';
  if ($('sonucDetay')) $('sonucDetay').textContent = `${quizDogru}/${toplamSoru} doğru · En iyi combo: ${quizEnIyiCombo}x`;
  if ($('sonucKazanc')) $('sonucKazanc').textContent = `+${coinOdul} 💰  +${yildiz} ⭐`;
  ekranGoster('sonucEkran');
  if (yildiz === 3) { konfetiGoster(60); sesCal('kupa'); titreşim(200); }
  else if (yildiz > 0) { konfetiGoster(30); sesCal('kazanc'); titreşim(100); }
  basarimKontrol();
}

function quizIptal() {
  if (!confirm('Quizi iptal etmek istiyor musun?')) return;
  clearInterval(quizTimer);
  if (gununModu) anaEkranaDon();
  else oyunaBasla();
}
function tekrarOyna() {
  if (!aktifKategori) { anaEkranaDon(); return; }
  if (gununModu) { gununAc(); return; }
  quizBaslat();
}
function kategoriyeDon() {
  clearInterval(quizTimer);
  ekranGoster('kategoriEkran');
  kategoriListesiniGuncelle();
}

/* PAUSE */
function quizPauseAc() {
  if (quizCevaplandi) { toast('Bu soru cevaplandı'); return; }
  quizPauseAktif = true;
  clearInterval(quizTimer);
  $('pauseModal')?.classList.add('aktif');
  sesCal('tik'); titreşim(20);
}
function quizPauseKapat() {
  quizPauseAktif = false;
  $('pauseModal')?.classList.remove('aktif');
  if (!quizCevaplandi && quizTimerKalan > 0) {
    quizTimer = setInterval(() => {
      if (quizPauseAktif) return;
      quizTimerKalan--;
      timerGuncelle();
      if (quizTimerKalan <= 5) $('quizTimer')?.classList.add('uyari');
      if (quizTimerKalan <= 0) {
        clearInterval(quizTimer);
        if (!quizCevaplandi) {
          quizCevaplandi = true; quizYanlis++; quizCombo = 0;
          sesCal('hata'); titreşim(150);
          dogruCevabiGoster();
          setTimeout(sonrakiSoru, 2000);
        }
      }
    }, 1000);
  }
  sesCal('tik'); titreşim(20);
}
function quizPauseYeniden() {
  quizPauseAktif = false;
  $('pauseModal')?.classList.remove('aktif');
  clearInterval(quizTimer);
  if (gununModu) gununBasla();
  else quizBaslat();
}
function quizPauseCik() {
  quizPauseAktif = false;
  $('pauseModal')?.classList.remove('aktif');
  clearInterval(quizTimer);
  anaEkranaDon();
}

/* GÜNLÜK ÖDÜL */
const GUNLUK_ODULLER = [
  { gun: 1, coin: 50, yildiz: 0 }, { gun: 2, coin: 100, yildiz: 0 },
  { gun: 3, coin: 150, yildiz: 1 }, { gun: 4, coin: 200, yildiz: 0 },
  { gun: 5, coin: 250, yildiz: 1 }, { gun: 6, coin: 300, yildiz: 1 },
  { gun: 7, coin: 500, yildiz: 3 }
];
const GUN_MS = 24 * 60 * 60 * 1000;

function gunlukAlinabilirMi() {
  const gecen = Date.now() - (user.gunlukSonAlim || 0);
  return gecen >= GUN_MS || !user.gunlukSonAlim;
}
function gunlukSeriHesapla() {
  const gecen = Date.now() - (user.gunlukSonAlim || 0);
  if (gecen > 2 * GUN_MS) { user.gunlukSeri = 0; persistUser(); }
  return user.gunlukSeri || 0;
}

function gunlukOdulAc() {
  ekranGoster('gunlukEkran');
  gunlukGridGuncelle();
}

function gunlukGridGuncelle() {
  const grid = $('gunlukGrid'); if (!grid) return;
  const seri = gunlukSeriHesapla();
  const alinabilir = gunlukAlinabilirMi();
  let html = '';
  GUNLUK_ODULLER.forEach((o, i) => {
    let cls = 'gunluk-kart';
    if (i < seri) cls += ' alinan';
    else if (i === seri && alinabilir) cls += ' bugun';
    const odulText = `${o.coin}💰${o.yildiz > 0 ? ' +' + o.yildiz + '⭐' : ''}`;
    html += `<div class="${cls}"><div class="gunluk-gun">${o.gun}. Gün</div><div class="gunluk-odul">${odulText}</div></div>`;
  });
  grid.innerHTML = html;
  const btn = $('gunlukAlBtn');
  if (btn) {
    if (alinabilir) { btn.disabled = false; btn.textContent = 'ÖDÜLÜ AL 🎁'; }
    else {
      btn.disabled = true;
      const kalan = GUN_MS - (Date.now() - user.gunlukSonAlim);
      const saat = Math.floor(kalan / 3600000);
      const dk = Math.floor((kalan % 3600000) / 60000);
      btn.textContent = `⏰ ${saat}s ${dk}dk sonra`;
    }
  }
}

function gunlukAl() {
  if (!gunlukAlinabilirMi()) { toast('⏰ Bugün aldın'); return; }
  let seri = gunlukSeriHesapla();
  if (seri >= 7) seri = 0;
  const odul = GUNLUK_ODULLER[seri];
  user.coin += odul.coin;
  user.yildiz += odul.yildiz;
  user.gunlukSeri = seri + 1;
  user.gunlukSonAlim = Date.now();
  user.sonGiris = bugun();
  persistUser(); ustBarGuncelle();
  konfetiGoster(40); sesCal('kupa'); titreşim(150);
  ucanPuan(`+${odul.coin} 💰`, 'var(--gold)');
  if (odul.yildiz > 0) ucanPuan(`+${odul.yildiz} ⭐`, 'var(--gold)');
  toast(`🎁 +${odul.coin} coin${odul.yildiz > 0 ? ' +' + odul.yildiz + ' yıldız' : ''}`);
  gunlukGridGuncelle();
  menuGuncelle();
}

/* ÇARK */
const CARK_DILIMLER = [
  { yazi: '50💰', tip: 'coin', deger: 50, renk: '#00d97e' },
  { yazi: '100💰', tip: 'coin', deger: 100, renk: '#ff9f1c' },
  { yazi: '250💰', tip: 'coin', deger: 250, renk: '#2979ff' },
  { yazi: '5⭐', tip: 'yildiz', deger: 5, renk: '#8b5cf6' },
  { yazi: '500💰', tip: 'coin', deger: 500, renk: '#ff3355' },
  { yazi: '10⭐', tip: 'yildiz', deger: 10, renk: '#ffd700' },
  { yazi: 'JOKER', tip: 'joker', deger: 1, renk: '#a855f7' },
  { yazi: '1000💰', tip: 'coin', deger: 1000, renk: '#00b894' }
];
let carkDonuyor = false;
let carkAci = 0;

function carkifelekAc() {
  ekranGoster('carkEkran');
  const canvas = $('carkCanvas');
  if (canvas) {
    canvas.width = 320;
    canvas.height = 320;
  }
  setTimeout(() => carkCiz(), 100);
  carkDurumGuncelle();
}

function carkCiz() {
  const canvas = $('carkCanvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const cx = canvas.width / 2;
  const cy = canvas.height / 2;
  const r = canvas.width / 2 - 10;
  const aci = (2 * Math.PI) / CARK_DILIMLER.length;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  CARK_DILIMLER.forEach((d, i) => {
    const bas = i * aci - Math.PI / 2;
    const bit = bas + aci;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, r, bas, bit);
    ctx.closePath();
    ctx.fillStyle = d.renk;
    ctx.fill();
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(bas + aci / 2);
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 18px Arial, sans-serif';
    ctx.shadowColor = '#000';
    ctx.shadowBlur = 4;
    ctx.fillText(d.yazi, r - 20, 0);
    ctx.restore();
  });
  ctx.beginPath();
  ctx.arc(cx, cy, 30, 0, 2 * Math.PI);
  ctx.fillStyle = '#0b111c';
  ctx.fill();
  ctx.strokeStyle = '#ffd700';
  ctx.lineWidth = 4;
  ctx.stroke();
  ctx.fillStyle = '#ffd700';
  ctx.font = 'bold 24px Arial';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('🎡', cx, cy);
}

function carkDurumGuncelle() {
  const btn = $('carkBtn');
  const bilgi = $('carkBilgi');
  const gecen = Date.now() - (user.sonCark || 0);
  const bekleme = 4 * 60 * 60 * 1000;
  if (gecen >= bekleme || !user.sonCark) {
    if (btn) { btn.disabled = false; btn.textContent = 'ÇEVİR 🎡'; }
    if (bilgi) bilgi.textContent = 'Ücretsiz çevirme hakkın hazır!';
  } else {
    const kalan = bekleme - gecen;
    const saat = Math.floor(kalan / 3600000);
    const dk = Math.floor((kalan % 3600000) / 60000);
    if (btn) { btn.disabled = true; btn.textContent = '⏰ BEKLE'; }
    if (bilgi) bilgi.textContent = `Yeni hak: ${saat}s ${dk}dk sonra`;
  }
}

function carkCevir() {
  if (carkDonuyor) return;
  const gecen = Date.now() - (user.sonCark || 0);
  if (gecen < 4 * 60 * 60 * 1000 && user.sonCark) { toast('⏰ Henüz hazır değil'); return; }
  carkDonuyor = true;
  const btn = $('carkBtn'); if (btn) btn.disabled = true;
  const canvas = $('carkCanvas');
  const index = Math.floor(Math.random() * CARK_DILIMLER.length);
  const aciPerSlice = 360 / CARK_DILIMLER.length;
  const hedef = 360 * 5 + (360 - (index * aciPerSlice + aciPerSlice / 2));
  carkAci += hedef;
  if (canvas) canvas.style.transform = `rotate(${carkAci}deg)`;
  sesCal('cark'); titreşim(30);
  let sayac = 0;
  const sesInterval = setInterval(() => {
    sesCal('cark'); titreşim(5); sayac++;
    if (sayac > 20) clearInterval(sesInterval);
  }, 150);
  setTimeout(() => {
    clearInterval(sesInterval);
    carkDonuyor = false;
    user.sonCark = Date.now();
    user.toplamCark = (user.toplamCark || 0) + 1;
    const d = CARK_DILIMLER[index];
    if (d.tip === 'coin') { user.coin += d.deger; ucanPuan(`+${d.deger} 💰`, 'var(--gold)'); toast(`🎡 +${d.deger} coin!`); }
    else if (d.tip === 'yildiz') { user.yildiz += d.deger; ucanPuan(`+${d.deger} ⭐`, 'var(--gold)'); toast(`🎡 +${d.deger} yıldız!`); }
    else if (d.tip === 'joker') { toast('🎡 1 joker kazandın!'); }
    persistUser(); ustBarGuncelle();
    konfetiGoster(50); sesCal('kupa'); titreşim(150);
    carkDurumGuncelle(); menuGuncelle();
  }, 4000);
}

/* BAŞARIM */
const BASARIMLAR = [
  { id: 'ilk_dogru', ikon: '🩸', isim: 'İlk Kan', desc: 'İlk doğru cevabını ver', kontrol: () => user.toplamDogru >= 1 },
  { id: 'on_dogru', ikon: '🥉', isim: 'Çaylak', desc: '10 doğru cevap', kontrol: () => user.toplamDogru >= 10 },
  { id: 'elli_dogru', ikon: '🥈', isim: 'Usta', desc: '50 doğru cevap', kontrol: () => user.toplamDogru >= 50 },
  { id: 'yuz_dogru', ikon: '🥇', isim: 'Efsane', desc: '100 doğru cevap', kontrol: () => user.toplamDogru >= 100 },
  { id: 'tam_puan', ikon: '💎', isim: 'Mükemmeliyetçi', desc: 'Bir leveli tam puanla bitir', kontrol: () => user.tamPuanLevel >= 1 },
  { id: 'bes_kategori', ikon: '📚', isim: 'Koleksiyoner', desc: '5 kategori tamamla', kontrol: () => Object.keys(user.kategoriler).length >= 5 },
  { id: 'on_kategori', ikon: '🏰', isim: 'Fatih', desc: '10 kategori tamamla', kontrol: () => Object.keys(user.kategoriler).length >= 10 },
  { id: 'yirmi_kategori', ikon: '👑', isim: 'İmparator', desc: '20 kategori tamamla', kontrol: () => Object.keys(user.kategoriler).length >= 20 },
  { id: 'ilk_yildiz', ikon: '⭐', isim: 'İlk Yıldız', desc: 'İlk yıldızını kazan', kontrol: () => user.yildiz >= 1 },
  { id: 'yuz_yildiz', ikon: '🌟', isim: 'Yıldız Avcısı', desc: '100 yıldız topla', kontrol: () => user.yildiz >= 100 },
  { id: 'gunluk_7', ikon: '📅', isim: 'Sadık Oyuncu', desc: '7 gün üst üste giriş', kontrol: () => (user.gunlukSeri || 0) >= 7 },
  { id: 'cark_10', ikon: '🎡', isim: 'Şanslı', desc: '10 kez çark çevir', kontrol: () => (user.toplamCark || 0) >= 10 },
  { id: 'joker_5', ikon: '🃏', isim: 'Jokerci', desc: '5 joker kullan', kontrol: () => (user.toplamJoker || 0) >= 5 },
  { id: 'bin_puan', ikon: '💯', isim: 'Binlik', desc: 'Toplam 1000 puan', kontrol: () => (user.toplamPuan || 0) >= 1000 },
  { id: 'bes_bin', ikon: '🔥', isim: 'Ateşli', desc: 'Toplam 5000 puan', kontrol: () => (user.toplamPuan || 0) >= 5000 },
  { id: 'bin_coin', ikon: '💰', isim: 'Zengin', desc: '1000 coin topla', kontrol: () => user.coin >= 1000 }
];

function basarimlarAc() {
  ekranGoster('basarimEkran');
  basarimListeGuncelle();
}
function basarimListeGuncelle() {
  const liste = $('basarimListe'); if (!liste) return;
  let html = '';
  BASARIMLAR.forEach(b => {
    const alindi = user.basarimlar.includes(b.id);
    html += `
      <div class="basarim-kart ${alindi ? 'alinan' : ''}">
        <div class="basarim-ikon">${b.ikon}</div>
        <div class="basarim-bilgi">
          <div class="basarim-isim">${b.isim}</div>
          <div class="basarim-desc">${b.desc}</div>
        </div>
        <div class="basarim-durum">${alindi ? '✅' : '🔒'}</div>
      </div>`;
  });
  liste.innerHTML = html;
}
function basarimKontrol() {
  let yeni = [];
  BASARIMLAR.forEach(b => {
    if (!user.basarimlar.includes(b.id) && b.kontrol()) {
      user.basarimlar.push(b.id);
      yeni.push(b);
    }
  });
  if (yeni.length) {
    persistUser();
    yeni.forEach((b, i) => {
      setTimeout(() => {
        toast(`🏆 Başarım: ${b.isim}`);
        sesCal('kupa'); titreşim(50);
      }, i * 1200);
    });
  }
}

/* MAĞAZA */
const MAGAZA_URUNLERI = [
  { id: 'tema_altin', ikon: '🟡', isim: 'Altın Tema', desc: 'Altın renk teması', fiyat: 500, tip: 'tema' },
  { id: 'tema_mor', ikon: '🟣', isim: 'Mor Tema', desc: 'Mor renk teması', fiyat: 400, tip: 'tema' },
  { id: 'tema_mavi', ikon: '🔵', isim: 'Mavi Tema', desc: 'Mavi renk teması', fiyat: 300, tip: 'tema' },
  { id: 'avatar_futbol', ikon: '⚽', isim: 'Futbol Topu', desc: 'Profil avatarı', fiyat: 200, tip: 'avatar' },
  { id: 'avatar_kupa', ikon: '🏆', isim: 'Kupa', desc: 'Profil avatarı', fiyat: 300, tip: 'avatar' },
  { id: 'avatar_aslan', ikon: '🦁', isim: 'Aslan', desc: 'Profil avatarı', fiyat: 400, tip: 'avatar' },
  { id: 'avatar_tac', ikon: '👑', isim: 'Taç', desc: 'Profil avatarı (VIP)', fiyat: 800, tip: 'avatar' }
];

function magazaAc() {
  ekranGoster('magazaEkran');
  magazaListeGuncelle();
}
function magazaListeGuncelle() {
  const liste = $('magazaListe'); if (!liste) return;
  let html = '';
  MAGAZA_URUNLERI.forEach(u => {
    const sahip = user.ozelTema === u.id || user.avatar === u.ikon;
    html += `
      <div class="magaza-kart">
        <div class="magaza-ikon">${u.ikon}</div>
        <div class="magaza-bilgi">
          <div class="magaza-isim">${u.isim}</div>
          <div class="magaza-desc">${u.desc}</div>
        </div>
        <div class="magaza-fiyat ${sahip ? 'alinan' : ''}" onclick="magazaSatinAl('${u.id}')">${sahip ? 'AKTİF ✅' : '🪙 ' + u.fiyat}</div>
      </div>`;
  });
  liste.innerHTML = html;
}
function magazaSatinAl(id) {
  const u = MAGAZA_URUNLERI.find(x => x.id === id);
  if (!u) return;
  if (user.ozelTema === id || user.avatar === u.ikon) {
    if (u.tip === 'tema') user.ozelTema = id;
    else user.avatar = u.ikon;
    persistUser();
    toast(`✅ ${u.isim} aktif`);
    magazaListeGuncelle();
    return;
  }
  if (user.coin < u.fiyat) { toast('❌ Yetersiz coin!'); sesCal('hata'); return; }
  user.coin -= u.fiyat;
  if (u.tip === 'tema') user.ozelTema = id;
  else user.avatar = u.ikon;
  persistUser(); ustBarGuncelle();
  konfetiGoster(30); sesCal('kupa'); titreşim(100);
  toast(`✅ ${u.isim} satın alındı!`);
  magazaListeGuncelle();
}

/* PROFİL */
function profilAc() {
  ekranGoster('profilEkran');
  if ($('profilIsim')) $('profilIsim').value = user.isim || 'Oyuncu';
  profilIstatistikGuncelle();
}
function profilIstatistikGuncelle() {
  const el = $('profilIstatistik'); if (!el) return;
  const toplam = (user.toplamDogru || 0) + (user.toplamYanlis || 0);
  const yuzde = toplam > 0 ? Math.round((user.toplamDogru / toplam) * 100) : 0;
  const katSayi = Object.keys(user.kategoriler).length;
  el.innerHTML = `
    <div class="ist-kart"><div class="ist-ikon">🎯</div><div class="ist-deger">${yuzde}%</div><div class="ist-lbl">Doğruluk</div></div>
    <div class="ist-kart"><div class="ist-ikon">✅</div><div class="ist-deger">${user.toplamDogru}</div><div class="ist-lbl">Doğru</div></div>
    <div class="ist-kart"><div class="ist-ikon">❌</div><div class="ist-deger">${user.toplamYanlis}</div><div class="ist-lbl">Yanlış</div></div>
    <div class="ist-kart"><div class="ist-ikon">💯</div><div class="ist-deger">${user.enYuksekPuan}</div><div class="ist-lbl">En Yüksek</div></div>
    <div class="ist-kart"><div class="ist-ikon">📚</div><div class="ist-deger">${katSayi}</div><div class="ist-lbl">Kategori</div></div>
    <div class="ist-kart"><div class="ist-ikon">🏆</div><div class="ist-deger">${user.basarimlar.length}</div><div class="ist-lbl">Başarım</div></div>
  `;
}
function profilKaydet() {
  const val = $('profilIsim')?.value.trim() || 'Oyuncu';
  user.isim = val;
  persistUser();
  toast('✅ İsim kaydedildi');
  sesCal('ok'); titreşim(50);
  menuGuncelle();
}

/* VIP */
function vipAc() { ekranGoster('vipEkran'); }
function vipSatinAl() {
  if (user.vip) { toast('👑 Zaten VIP\'sin'); return; }
  toast('👑 Telegram Stars ile ödeme yakında!');
  sesCal('tik');
}

/* AYARLAR */
function ayarlarAc() {
  ekranGoster('ayarlarEkran');
  if ($('ayarMuzik')) $('ayarMuzik').checked = !!user.muzik;
  if ($('ayarSes')) $('ayarSes').checked = !!user.ses;
  if ($('ayarTitresim')) $('ayarTitresim').checked = !!user.titresim;
}
function muzikToggle() {
  user.muzik = !user.muzik;
  persistUser();
  toast(user.muzik ? '🎵 Müzik açık' : '🔇 Müzik kapalı');
}
function sesToggle() {
  user.ses = !user.ses;
  sesAktif = user.ses;
  persistUser();
  toast(user.ses ? '🔊 Ses açık' : '🔇 Ses kapalı');
}
function titresimToggle() {
  user.titresim = !user.titresim;
  titreşimAktif = user.titresim;
  persistUser();
  toast(user.titresim ? '📳 Titreşim açık' : '📴 Titreşim kapalı');
}
function verileriSifirla() {
  if (!confirm('Tüm veriler silinsin mi?')) return;
  localStorage.removeItem('skorlab_user');
  location.reload();
}

/* ============================================================
   GÜNÜN 10 SORUSU
   ============================================================ */
let gununSorular = [];

function gununTarihKey() {
  return bugun();
}

function gununAc() {
  ekranGoster('gununEkran');
  gununDurumGuncelle();
}

function gununDurumGuncelle() {
  const tarihKey = gununTarihKey();
  const bugunOynandi = user.gununSonOynanan === tarihKey;
  const seri = user.gununSeri || 0;
  if ($('gununSeri')) $('gununSeri').textContent = seri;
  if ($('gununSeriBuyuk')) $('gununSeriBuyuk').textContent = seri + ' gün';
  if ($('gununTarih')) $('gununTarih').textContent = new Date().toLocaleDateString('tr-TR', { weekday: 'long', day: 'numeric', month: 'long' });
  if (bugunOynandi) {
    if ($('gununBtn')) {
      $('gununBtn').disabled = true;
      $('gununBtn').style.opacity = '.5';
      $('gununBtn').querySelector('.mbb-ust').textContent = 'BUGÜN ÇÖZDÜN ✅';
      $('gununBtn').querySelector('.mbb-alt').textContent = 'Yarın yeni sorular geliyor';
    }
    if ($('gununBilgi')) $('gununBilgi').textContent = '✅ Bugün tamamladın! Yarın tekrar gel.';
  } else {
    if ($('gununBtn')) {
      $('gununBtn').disabled = false;
      $('gununBtn').style.opacity = '1';
      $('gununBtn').querySelector('.mbb-ust').textContent = 'GÜNÜN SORULARINI ÇÖZ';
      $('gununBtn').querySelector('.mbb-alt').textContent = '10 soru · +100 coin · +1 yıldız';
    }
    if ($('gununBilgi')) $('gununBilgi').textContent = 'Bugün henüz çözmedin';
  }
}

async function gununSorulariYukle() {
  if (gununSorular.length) return gununSorular;
  try {
    const tumSorular = [];
    for (const dosya of ['sorular_1.json', 'sorular_2.json', 'sorular_3.json', 'sorular_4.json']) {
      try {
        const res = await fetch(dosya);
        if (!res.ok) continue;
        const data = await res.json();
        (data.kategoriler || []).forEach(kat => {
          (kat.sorular || []).forEach(s => {
            tumSorular.push({ ...s, kategori: kat.kategori_adi });
          });
        });
      } catch (e) {}
    }
    if (!tumSorular.length) return [];
    const tarihKey = gununTarihKey();
    const seed = tarihKey.split('-').join('');
    let seedNum = 0;
    for (let i = 0; i < seed.length; i++) seedNum += seed.charCodeAt(i);
    const secilenler = [];
    const kopya = [...tumSorular];
    for (let i = 0; i < 10 && kopya.length > 0; i++) {
      const idx = (seedNum * (i + 1) * 7) % kopya.length;
      secilenler.push(kopya.splice(idx, 1)[0]);
    }
    gununSorular = secilenler;
    return gununSorular;
  } catch (e) {
    return [];
  }
}

async function gununBasla() {
  const sorular = await gununSorulariYukle();
  if (!sorular.length) { toast('Sorular yüklenemedi'); return; }
  gununModu = true;
  aktifKategori = { kategori_id: 0, kategori_adi: 'Günün 10 Sorusu' };
  quizSorular = sorular;
  quizIndex = 0;
  quizSkor = 0;
  quizDogru = 0;
  quizYanlis = 0;
  quizCombo = 0;
  quizEnIyiCombo = 0;
  quizJoker = { cut: false, answer: false, heart: false };
  quizCiftHak = false;
  ekranGoster('quizEkran');
  soruGoster();
}

function gununBitir() {
  const tarihKey = gununTarihKey();
  user.gununSonOynanan = tarihKey;
  user.gununSeri = (user.gununSeri || 0) + 1;
  user.coin += 100;
  user.yildiz += 1;
  persistUser();
  ustBarGuncelle();
  menuGuncelle();
  konfetiGoster(60);
  sesCal('kupa');
  titreşim(200);
  setTimeout(() => kutuAc(), 800);
}

/* ============================================================
   GİZEMLİ KUTU
   ============================================================ */
function kutuAc() {
  $('kutuModal')?.classList.add('aktif');
  if ($('kutuIkon')) $('kutuIkon').textContent = '📦';
  if ($('kutuBaslik')) $('kutuBaslik').textContent = 'GİZEMLİ KUTU!';
  if ($('kutuAciklama')) $('kutuAciklama').textContent = 'Kutuyu açmak için dokun';
  if ($('kutuOdul')) $('kutuOdul').style.display = 'none';
  if ($('kutuBtn')) {
    $('kutuBtn').textContent = '📦 AÇ';
    $('kutuBtn').onclick = kutuAcKontrol;
  }
}

function kutuAcKontrol() {
  const rastgele = Math.random();
  let metin = '';
  if (rastgele < 0.4) {
    const m = Math.floor(Math.random() * 81) + 20;
    user.coin += m;
    metin = '+' + m + ' 💰';
  } else if (rastgele < 0.7) {
    const m = Math.floor(Math.random() * 6) + 5;
    user.yildiz += m;
    metin = '+' + m + ' ⭐';
  } else if (rastgele < 0.9) {
    user.toplamJoker = (user.toplamJoker || 0) + 1;
    metin = '+1 🃏 Joker';
  } else {
    user.coin += 50;
    metin = '+50 💰 BONUS';
  }
  persistUser();
  ustBarGuncelle();
  if ($('kutuIkon')) $('kutuIkon').textContent = '🎉';
  if ($('kutuBaslik')) $('kutuBaslik').textContent = 'TEBRİKLER!';
  if ($('kutuAciklama')) $('kutuAciklama').textContent = 'Kazandın!';
  if ($('kutuOdul')) {
    $('kutuOdul').textContent = metin;
    $('kutuOdul').style.display = 'block';
  }
  if ($('kutuBtn')) {
    $('kutuBtn').textContent = '✅ TAMAM';
    $('kutuBtn').onclick = () => closeModal('kutuModal');
  }
  konfetiGoster(30);
  sesCal('kazanc');
  titreşim(100);
  ucanPuan(metin, 'var(--gold)');
}

/* ============================================================
   SONUÇ KARTI PAYLAŞ
   ============================================================ */
function paylasKartGoster() {
  if ($('pkSkor')) $('pkSkor').textContent = quizSkor + ' PUAN';
  if ($('pkDetay')) $('pkDetay').textContent = `${quizDogru}/${quizSorular.length} doğru`;
  const yuzde = (quizDogru / quizSorular.length) * 100;
  let yildiz = 0;
  if (yuzde >= 100) yildiz = 3;
  else if (yuzde >= 70) yildiz = 2;
  else if (yuzde >= 30) yildiz = 1;
  const yildizStr = yildiz === 3 ? '⭐⭐⭐' : yildiz === 2 ? '⭐⭐☆' : yildiz === 1 ? '⭐☆☆' : '☆☆☆';
  if ($('pkYildiz')) $('pkYildiz').textContent = yildizStr;
  $('paylasModal')?.classList.add('aktif');
}

function telegramPaylas() {
  const metin = `⚽ SKORLAB QUIZ\n\n` +
    `📊 Skor: ${quizSkor} PUAN\n` +
    `✅ Doğru: ${quizDogru}/${quizSorular.length}\n` +
    `🎯 Kategori: ${aktifKategori?.kategori_adi || 'Quiz'}\n\n` +
    `Sen de beni geçebilir misin?\n` +
    `👉 https://t.me/SkorLabBot`;
  if (TG && TG.switchInlineQuery && TG.isVersionAtLeast && TG.isVersionAtLeast('6.1')) {
    TG.switchInlineQuery(metin, ['users', 'groups']);
    return;
  }
  if (navigator.share) {
    navigator.share({ title: 'SkorLab Quiz', text: metin }).catch(() => {});
    return;
  }
  if (navigator.clipboard) {
    navigator.clipboard.writeText(metin).then(() => {
      toast('📋 Kopyalandı!');
      sesCal('ok');
    });
  }
}

function kopyalaPaylas() {
  const metin = `⚽ SKORLAB QUIZ\n\n` +
    `📊 Skor: ${quizSkor} PUAN\n` +
    `✅ Doğru: ${quizDogru}/${quizSorular.length}\n\n` +
    `👉 https://t.me/SkorLabBot`;
  if (navigator.clipboard) {
    navigator.clipboard.writeText(metin).then(() => {
      toast('📋 Panoya kopyalandı!');
      sesCal('ok');
    });
  }
}

/* ============================================================
   BUNU BİLİYOR MUYDUN? (Her gün yeni bilgi)
   ============================================================ */
let bilgilerData = null;

async function tarihAc() {
  ekranGoster('tarihEkran');
  await bilgiGoster();
}

async function bilgiGoster() {
  const el = $('tarihIcerik');
  if (!el) return;
  el.innerHTML = '<div class="tarih-yukleniyor">Yükleniyor...</div>';
  try {
    if (!bilgilerData) {
      const res = await fetch('bilgiler.json');
      if (!res.ok) throw new Error('HTTP ' + res.status);
      bilgilerData = await res.json();
    }
    const liste = bilgilerData.bilgiler || [];
    if (!liste.length) {
      el.innerHTML = '<div class="tarih-yukleniyor">Bilgi bulunamadı</div>';
      return;
    }
    const bugunT = new Date();
    const yil = bugunT.getFullYear();
    const yilBasi = new Date(yil, 0, 0);
    const gunSayisi = Math.floor((bugunT - yilBasi) / (1000 * 60 * 60 * 24));
    const index = gunSayisi % liste.length;
    const bilgi = liste[index];

    el.innerHTML = `
      <div class="tarih-kart">
        <div class="tk-tarih">💡 BUNU BİLİYOR MUYDUN?</div>
        <div class="tk-ikon">🧠</div>
        <div class="tk-baslik">Günün Futbol Bilgisi</div>
        <div class="tk-aciklama">${bilgi.bilgi}</div>
        <div class="tk-sonuc" style="margin-top:20px;color:var(--green);font-weight:700;">
          ✅ Yarın yeni bir bilgi geliyor!
        </div>
      </div>`;
  } catch (e) {
    console.error('Bilgi yüklenemedi:', e);
    el.innerHTML = '<div class="tarih-yukleniyor">Bilgi verisi yüklenemedi</div>';
  }
}

// Modal kapatma yardımcısı
function closeModal(id) {
  document.getElementById(id)?.classList.remove('aktif');
         }
