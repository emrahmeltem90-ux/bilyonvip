/* ============================================================
   SKORLAB TOTO v20 · TELEGRAM MINI APP
   Toto + Bankobot + Parmak İzi + Performans + Arşiv + 
   Kupon Oluşturucu + Günün Bankosu + Titreşim + Ses + 
   Form + Sakat + Grafik + VIP + Stars
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
  catch (e) { showToast('error', 'Kayıt Hatası', 'Depolama kullanılamıyor.'); return false; }
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

/* ============================================================
   1. TELEGRAM
   ============================================================ */
function initTelegram() {
  if (!window.Telegram?.WebApp) return;
  TG = window.Telegram.WebApp;
  try {
    TG.ready(); TG.expand();
    if (typeof TG.enableClosingConfirmation === 'function') TG.enableClosingConfirmation();
    applyTelegramTheme(TG);
    TG.onEvent?.('themeChanged', () => applyTelegramTheme(TG));
  } catch (e) { console.warn('Telegram uyarı:', e); }
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
    osc.connect(gain);
    gain.connect(ctx.destination);
    if (tur === 'tik') { osc.frequency.value = 600; gain.gain.value = 0.05; }
    else if (tur === 'ok') { osc.frequency.value = 880; gain.gain.value = 0.1; }
    else if (tur === 'hata') { osc.frequency.value = 300; gain.gain.value = 0.1; }
    osc.start();
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);
    osc.stop(ctx.currentTime + 0.15);
  } catch (e) {}
}

/* ============================================================
   3. VERİ
   ============================================================ */
let maclarToto = [];
let oranlarToto = safeReadJSON('skorlab_oranlar_toto', {});
let secimlerToto = safeReadJSON('skorlab_secimler_toto', {});
let kayitliKuponlar = safeReadJSON('skorlab_kuponlar', []);
let backtestKayitlari = safeReadJSON('skorlab_backtest', []);
let arsivKayitlari = safeReadJSON('skorlab_arsiv', []);
let formVerileri = safeReadJSON('skorlab_form', {});
let sakatVerileri = safeReadJSON('skorlab_sakat', {});

if (!oranlarToto || typeof oranlarToto !== 'object' || Array.isArray(oranlarToto)) oranlarToto = {};
if (!secimlerToto || typeof secimlerToto !== 'object' || Array.isArray(secimlerToto)) secimlerToto = {};
if (!Array.isArray(kayitliKuponlar)) kayitliKuponlar = [];
if (!Array.isArray(backtestKayitlari)) backtestKayitlari = [];
if (!Array.isArray(arsivKayitlari)) arsivKayitlari = [];
if (!formVerileri || typeof formVerileri !== 'object') formVerileri = {};
if (!sakatVerileri || typeof sakatVerileri !== 'object') sakatVerileri = {};

function persistSelections() { return safeSaveJSON('skorlab_secimler_toto', secimlerToto); }
function persistOdds() { return safeSaveJSON('skorlab_oranlar_toto', oranlarToto); }
function persistCoupons() { return safeSaveJSON('skorlab_kuponlar', kayitliKuponlar); }
function persistBacktest() { return safeSaveJSON('skorlab_backtest', backtestKayitlari); }
function persistArsiv() { return safeSaveJSON('skorlab_arsiv', arsivKayitlari); }
function persistForm() { return safeSaveJSON('skorlab_form', formVerileri); }
function persistSakat() { return safeSaveJSON('skorlab_sakat', sakatVerileri); }

/* ============================================================
   4. TAHMİN MOTORU
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

  static poissonMatris(xgEv, xgDep) {
    const matris = [];
    for (let h = 0; h <= 5; h++) {
      const satir = [];
      for (let a = 0; a <= 5; a++) {
        const p = this.poissonPmf(h, xgEv) * this.poissonPmf(a, xgDep);
        satir.push({ h, a, p });
      }
      matris.push(satir);
    }
    return matris;
  }
}

/* ============================================================
   5. VERİ YÜKLE
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
  }
  renderToto(); renderAnaliz(); renderKayitliKuponlar(); renderBacktest();
  updateStats(); updateKuponCubugu();
}

/* ============================================================
   6. ORAN GÜNCELLEME
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
    titreşim(20); sesCal('tik');
  }
  if (oranlarToto[mac_id] && !Object.keys(oranlarToto[mac_id]).length) delete oranlarToto[mac_id];
  persistOdds(); renderToto(); renderAnaliz();
}

function getAnalysisForMatch(id) {
  const o = oranlarToto[id];
  if (!o || !validOdds(o['1'], o.X, o['2'])) return null;
  try { return Motor.analiz({ o1: o['1'], oX: o.X, o2: o['2'] }); }
  catch (err) { return null; }
}

/* ============================================================
   7. TOTO EKRANI
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
    const form = formVerileri[id] || {};
    const sakat = sakatVerileri[id] || '';
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
        <div class="form-giris">
          <div>
            <label>EV FORM (GGMGB)</label>
            <input type="text" maxlength="5" value="${escapeHTML(form.ev || '')}" placeholder="GGMGB" onchange="formGuncelle(${Number(id)},'ev',this.value)">
          </div>
          <div>
            <label>DEP FORM</label>
            <input type="text" maxlength="5" value="${escapeHTML(form.dep || '')}" placeholder="MGGMB" onchange="formGuncelle(${Number(id)},'dep',this.value)">
          </div>
        </div>
        <input type="text" placeholder="Sakat/cezalı (opsiyonel)" value="${escapeHTML(sakat)}" onchange="sakatGuncelle(${Number(id)},this.value)" style="margin-top:6px;font-size:.75rem">
        ${sakat ? `<div class="sakat-uyari">⚠️ ${escapeHTML(sakat)}</div>` : ''}
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
   8. FORM + SAKAT
   ============================================================ */
function formGuncelle(mac_id, tip, val) {
  if (!formVerileri[mac_id]) formVerileri[mac_id] = {};
  formVerileri[mac_id][tip] = val.toUpperCase().slice(0, 5);
  persistForm();
  titreşim(15);
}

function sakatGuncelle(mac_id, val) {
  sakatVerileri[mac_id] = val;
  persistSakat();
  renderToto();
}

function formPuan(form) {
  if (!form) return 0.5;
  let puan = 0;
  for (let i = 0; i < form.length; i++) {
    const c = form[i].toUpperCase();
    if (c === 'G') puan += 3;
    else if (c === 'B') puan += 1;
  }
  return puan / (form.length * 3);
}

/* ============================================================
   9. ANALİZ LİSTESİ
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
   10. SEÇİMLER
   ============================================================ */
function secimToggleToto(id, s) {
  if (!['1', 'X', '2'].includes(s)) return;
  let arr = Array.isArray(secimlerToto[id]) ? [...secimlerToto[id]] : [];
  arr = arr.includes(s) ? arr.filter(x => x !== s) : [...arr, s];
  if (!arr.length) delete secimlerToto[id];
  else secimlerToto[id] = ['1', 'X', '2'].filter(x => arr.includes(x));
  persistSelections(); renderToto(); updateStats(); updateKuponCubugu();
  titreşim(20); sesCal('tik');
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
   11. KUPON HESAPLARI
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
   12. KUPON ÖNERİSİ
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
      mac_id: m.mac_id, isim: `${m.ev_sahibi} - ${m.deplasman}`,
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
  titreşim(30); sesCal('ok');
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
   13. KUPON OLUŞTURUCU
   ============================================================ */
let kuponOlusturucuStrateji = 'dengeli';
let kuponOlusturucuButce = 100;

function kuponOlusturucuAc() {
  const body = $('kuponOlusturucuBody');
  if (!body) return;
  body.innerHTML = `
    <div>
      <label style="font-size:.7rem;color:var(--muted);font-weight:800;display:block;margin:10px 0 4px">BÜTÇE (TL)</label>
      <div style="display:flex;justify-content:space-between;font-size:.8rem;font-weight:900;margin-bottom:6px">
        <span id="butceGoster" style="color:var(--green)">${kuponOlusturucuButce} TL</span>
        <span class="muted">Kolon: 10 TL</span>
      </div>
      <input type="range" class="slider-input" min="10" max="1000" step="10" value="${kuponOlusturucuButce}"
        oninput="kuponOlusturucuButce = Number(this.value); document.getElementById('butceGoster').textContent = this.value + ' TL'">

      <label style="font-size:.7rem;color:var(--muted);font-weight:800;display:block;margin:16px 0 4px">STRATEJİ</label>
      <div class="strateji-grid">
        <button type="button" class="strateji-btn ${kuponOlusturucuStrateji === 'banko' ? 'aktif' : ''}" onclick="stratejiSec('banko')">
          🏆<br>Banko<br><small style="color:var(--muted);font-size:.6rem">Düşük risk</small>
        </button>
        <button type="button" class="strateji-btn ${kuponOlusturucuStrateji === 'dengeli' ? 'aktif' : ''}" onclick="stratejiSec('dengeli')">
          ⚖️<br>Dengeli<br><small style="color:var(--muted);font-size:.6rem">Orta risk</small>
        </button>
        <button type="button" class="strateji-btn ${kuponOlusturucuStrateji === 'riskli' ? 'aktif' : ''}" onclick="stratejiSec('riskli')">
          🎲<br>Riskli<br><small style="color:var(--muted);font-size:.6rem">Yüksek risk</small>
        </button>
      </div>

      <div id="stratejiAciklama" style="margin-top:10px;padding:10px;background:var(--bg3);border-radius:8px;font-size:.72rem;line-height:1.6">
        ${stratejiAciklama(kuponOlusturucuStrateji)}
      </div>

      <button type="button" class="btn btn-orange btn-lg" onclick="otomatikKupon()" style="margin-top:16px">⚡ KUPON OLUŞTUR</button>
    </div>`;
  $('kuponOlusturucuModal')?.classList.add('active');
}

function stratejiAciklama(s) {
  if (s === 'banko') return '<b class="vurgu">🏆 Banko:</b> Sadece %68+ favori. Az maç, düşük risk.';
  if (s === 'riskli') return '<b class="vurgu-riskli">🎲 Riskli:</b> %50+ tüm maçlar. Yüksek risk, yüksek kazanç.';
  return '<b class="vurgu">⚖️ Dengeli:</b> %65+ banko, %52-65 çift şans. Orta risk.';
}

function stratejiSec(s) {
  kuponOlusturucuStrateji = s;
  kuponOlusturucuAc();
}

function otomatikKupon() {
  const analizler = maclarToto.map(m => {
    const a = getAnalysisForMatch(m.mac_id);
    if (!a) return null;
    return {
      mac_id: m.mac_id, isim: `${m.ev_sahibi} - ${m.deplasman}`,
      a, fav: favoriKod(a.shin), favO: Number(favoriOlas(a.shin)),
      p1: Number(a.shin.p1), pX: Number(a.shin.pX), p2: Number(a.shin.p2)
    };
  }).filter(Boolean);

  if (!analizler.length) { showToast('error', 'Oran Yok', 'Önce geçerli oranları gir.'); return; }

  let secilenler = [];
  let maxKolon = Math.floor(kuponOlusturucuButce / 10);

  if (kuponOlusturucuStrateji === 'banko') {
    analizler.sort((x, y) => y.favO - x.favO);
    secilenler = analizler.filter(a => a.favO >= 68).slice(0, Math.min(maxKolon, 5));
  } else if (kuponOlusturucuStrateji === 'dengeli') {
    analizler.sort((x, y) => y.favO - x.favO);
    const bankolar = analizler.filter(a => a.favO >= 65);
    const ciftler = analizler.filter(a => a.favO >= 52 && a.favO < 65);
    secilenler = [...bankolar.slice(0, 4), ...ciftler.slice(0, 4)];
  } else {
    analizler.sort((x, y) => y.favO - x.favO);
    secilenler = analizler.slice(0, Math.min(maxKolon, 8));
  }

  if (!secilenler.length) { showToast('error', 'Uygun Maç Yok', 'Bu strateji için maç bulunamadı.'); return; }

  let toplamKolon = 1;
  const secimler = {};

  secilenler.forEach(s => {
    let secim;
    if (kuponOlusturucuStrateji === 'banko') secim = [s.fav];
    else if (kuponOlusturucuStrateji === 'riskli') secim = [s.fav];
    else {
      if (s.favO >= 65) secim = [s.fav];
      else secim = [s.fav, s.p1 > s.p2 ? '1' : '2'].filter((v, i, arr) => arr.indexOf(v) === i).slice(0, 2);
    }
    secimler[s.mac_id] = secim;
    toplamKolon *= secim.length;
  });

  const hesap = kuponHesapla(secimler);

  let html = `<div class="card" style="border:2px solid var(--orange)">
    <div class="result-title" style="color:var(--orange)">🎯 OTOMATİK KUPON · ${kuponOlusturucuStrateji.toUpperCase()}</div>
    <div class="muted" style="font-size:.72rem;margin-bottom:10px">Bütçe: ${kuponOlusturucuButce} TL · Kolon: ${hesap.kolon}</div>`;

  secilenler.forEach(s => {
    const sec = secimler[s.mac_id];
    html += `
      <div style="padding:10px 0;border-bottom:1px solid var(--border);font-size:.78rem">
        <div style="font-weight:900;margin-bottom:4px">${escapeHTML(s.isim)}</div>
        <div style="display:flex;justify-content:space-between;gap:8px">
          <b style="color:var(--green)">🎯 ${sec.join(' / ')}</b>
          <span class="muted">Favori: ${s.fav} (%${s.favO.toFixed(1)})</span>
        </div>
      </div>`;
  });

  html += `
      <div style="margin-top:12px;padding:10px;background:var(--bg3);border-radius:8px">
        <div class="analiz-row"><span>Maç:</span><b>${secilenler.length}</b></div>
        <div class="analiz-row"><span>Kolon:</span><b class="green">${hesap.kolon}</b></div>
        <div class="analiz-row"><span>Tutar:</span><b class="green">${hesap.tutar} TL</b></div>
        <div class="analiz-row"><span>Bütçe:</span><b>${kuponOlusturucuButce} TL</b></div>
      </div>
      <div style="margin-top:8px;padding:8px;background:rgba(255,176,32,.1);border-radius:6px;font-size:.68rem;color:var(--orange);text-align:center">⚠️ Otomatik öneri. Garanti değildir.</div>
    </div>`;

  $('kuponOlusturucuBody').innerHTML = html;
  titreşim(30); sesCal('ok');
}

/* ============================================================
   14. GÜNÜN BANKOSU
   ============================================================ */
function gununBankosuAc() {
  if (!maclarToto.length) { showToast('error', 'Maç Yok', 'Toto maçları yüklenmedi.'); return; }

  const analizler = maclarToto.map(m => {
    const a = getAnalysisForMatch(m.mac_id);
    if (!a) return null;
    return {
      mac: `${m.ev_sahibi} - ${m.deplasman}`,
      fav: favoriKod(a.shin),
      favO: Number(favoriOlas(a.shin)),
      skor: a.poi.enOlası[0].skor,
      gollu: a.gollu,
      pUst25: a.poi.pUst25,
      pKgVar: a.poi.pKgVar
    };
  }).filter(Boolean);

  if (!analizler.length) { showToast('error', 'Oran Yok', 'Önce geçerli oranları gir.'); return; }

  analizler.sort((a, b) => b.favO - a.favO);
  const banko = analizler[0];

  let html = `
    <div class="banko-kart">
      <div class="banko-head">
        <div class="banko-title">🔥 GÜNÜN BANKOSU</div>
        <div class="banko-guven">%${banko.favO.toFixed(1)}</div>
      </div>
      <div class="banko-mac">${escapeHTML(banko.mac)}</div>
      <div class="banko-satir"><span>🎯 FAVORİ</span><span class="fav">${banko.fav}</span></div>
      <div class="banko-satir"><span>⚽ TAHMİN</span><span class="skor">${banko.skor}</span></div>
      <div class="banko-satir"><span>📊 GOL</span><span style="color:var(--orange);font-weight:900">${banko.gollu}</span></div>
      <div class="banko-satir"><span>2.5 ÜST</span><span style="color:var(--green);font-weight:900">%${banko.pUst25}</span></div>
      <div class="banko-satir"><span>KG VAR</span><span style="color:var(--green);font-weight:900">%${banko.pKgVar}</span></div>
      <div class="muted" style="font-size:.68rem;margin-top:12px;padding:8px;background:rgba(255,176,32,.1);border-radius:6px;text-align:center">📌 Model tahminidir. Garanti değildir.</div>
      <button type="button" class="btn btn-orange btn-lg" onclick="paylasGununBankosu()" style="margin-top:12px">📤 TELEGRAM'DA PAYLAŞ</button>
    </div>
  `;

  $('gununBankosuBody').innerHTML = html;
  window.sonGununBankosu = banko;
  $('gununBankosuModal')?.classList.add('active');
  titreşim(30); sesCal('ok');
}

function paylasGununBankosu() {
  const b = window.sonGununBankosu;
  if (!b) return;
  let metin = '🔥 SKORLAB · GÜNÜN BANKOSU\n';
  metin += `📅 ${new Date().toLocaleDateString('tr-TR')}\n\n`;
  metin += `⚽ ${b.mac}\n`;
  metin += `🎯 Favori: ${b.fav} (%${b.favO.toFixed(1)})\n`;
  metin += `⚽ Tahmin: ${b.skor}\n`;
  metin += `📊 Gol: ${b.gollu}\n`;
  metin += `🎯 2.5 Üst: %${b.pUst25}\n`;
  metin += `🥅 KG Var: %${b.pKgVar}\n\n`;
  metin += '📌 Model tahminidir, garanti değildir.\n📱 @SkorLabBot';
  paylasMetni(metin, 'SkorLab Günün Bankosu');
}

/* ============================================================
   15. BANKOBOT
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
      <div class="muted" style="font-size:.72rem;margin-bottom:10px">Oran modeline göre · Ortalama %${ortGuv}</div>`;
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
        <div style="font-size:.8rem;color:var(--muted)">Ortalama</div>
        <div style="font-size:1.4rem;font-weight:900;color:var(--purple)">%${ortGuv}</div>
      </div>
      <div style="margin-top:8px;padding:8px;background:rgba(255,176,32,.1);border-radius:6px;font-size:.68rem;color:var(--orange);text-align:center">⚠️ Sadece öneridir.</div>
      <button type="button" class="btn btn-purple btn-lg" onclick="paylasBankobot()" style="margin-top:12px">📤 PAYLAŞ</button>
      <button type="button" class="btn btn-green btn-lg" onclick="kaydetBankobot()" style="margin-top:8px">💾 KUPONA KAYDET</button>
    </div>`;
  if ($('totoKuponSonuc')) $('totoKuponSonuc').innerHTML = html;
  window.sonBankobot = bankolar;
  titreşim(30); sesCal('ok');
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
   16. PAYLAŞIM
   ============================================================ */
function paylasMetni(metin, baslik) {
  if (TG && typeof TG.switchInlineQuery === 'function' && typeof TG.isVersionAtLeast === 'function' && TG.isVersionAtLeast('6.1')) {
    TG.switchInlineQuery(metin, ['users', 'groups']); return;
  }
  if (navigator.share) { navigator.share({ title: baslik, text: metin }).catch(() => {}); return; }
  if (navigator.clipboard?.writeText) {
    navigator.clipboard.writeText(metin)
      .then(() => showToast('success', 'Kopyalandı!', 'Metin panoya kopyalandı.'))
      .catch(() => showToast('error', 'Paylaşılamadı', 'Manuel kopyala.'));
    return;
  }
  showToast('error', 'Paylaşım Yok', 'Desteklenmiyor.');
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
  metin += `💰 Ortalama: %${ortGuv}\n📌 Tahmindir.\n📱 @SkorLabBot`;
  paylasMetni(metin, 'SkorLab Bankobot');
}

function paylasOneriKuponu() {
  const data = window.sonTotoKuponu;
  if (!data?.oneriler?.length) { showToast('error', 'Boş', 'Önce Toto önerisi oluştur.'); return; }
  let metin = '⚽ SKORLAB TOTO ÖNERİSİ\n\n';
  data.oneriler.forEach(o => {
    metin += `${o.isim}\n🎯 Öneri: ${o.secim}\n📊 Favori: ${o.fav} (%${o.favO})\n\n`;
  });
  metin += `🔢 Kolon: ${data.kolon}\n💰 Tutar: ${data.tutar} TL\n📌 Tahmindir.\n📱 @SkorLabBot`;
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
  metin += `🔢 Kolon: ${kolon}\n💰 Tutar: ${kolon * 10} TL\n📌 Tahmindir.\n📱 @SkorLabBot`;
  paylasMetni(metin, 'SkorLab Toto Kuponu');
}

/* ============================================================
   17. PARMAK İZİ
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
          <div style="font-size:.65rem;color:var(--muted)">DENGELİ</div>
        </div>
        <div style="padding:10px;background:var(--bg3);border-radius:8px;text-align:center">
          <div style="font-size:1.4rem;font-weight:900;color:var(--green)">${netFavori.length}</div>
          <div style="font-size:.65rem;color:var(--muted)">NET FAVORİ</div>
        </div>
        <div style="padding:10px;background:var(--bg3);border-radius:8px;text-align:center">
          <div style="font-size:1.4rem;font-weight:900;color:var(--red)">${celiskili.length}</div>
          <div style="font-size:.65rem;color:var(--muted)">ÇELİŞKİLİ</div>
        </div>
        <div style="padding:10px;background:var(--bg3);border-radius:8px;text-align:center">
          <div style="font-size:1.4rem;font-weight:900;color:var(--blue)">${kapsamaGerek.length}</div>
          <div style="font-size:.65rem;color:var(--muted)">KAPSAMA</div>
        </div>
      </div>
      <div style="padding:14px;background:linear-gradient(135deg,rgba(168,85,247,.15),rgba(0,230,118,.08));border-radius:12px;border:2px solid var(--${seviyeRenk});text-align:center;margin-bottom:12px">
        <div style="font-size:.7rem;color:var(--muted);font-weight:800">KAPSAMA SKORU</div>
        <div style="font-size:2rem;font-weight:900;color:var(--${seviyeRenk});margin:4px 0">%${kapsamaSkoru}</div>
        <div style="font-size:.85rem;font-weight:900;color:var(--${seviyeRenk})">${seviyeEmoji} ${seviye}</div>
      </div>
      <div class="yorum-box ${celiskili.length >= 5 ? 'tehlike' : celiskili.length >= 2 ? 'riskli' : ''}">
        <div class="baslik">💡 YORUM</div>
        ${dengeli.length >= 5 ? `<p>• ${dengeli.length} dengeli maç var.</p>` : ''}
        ${netFavori.length >= 5 ? `<p>• ${netFavori.length} net favori var.</p>` : ''}
        ${celiskili.length >= 2 ? `<p>• ${celiskili.length} maçta çelişki var.</p>` : ''}
        ${kapsamaSkoru < 40 ? `<p>• Kuponun zayıf.</p>` : ''}
        ${kapsamaSkoru >= 80 ? `<p>• Kuponun çok iyi!</p>` : ''}
      </div>
      <div class="muted" style="font-size:.65rem;margin-top:12px;padding:8px;background:var(--bg3);border-radius:6px;text-align:center">📌 Model tahminidir. Garanti değildir.</div>
      <button type="button" class="btn btn-purple btn-lg" onclick="paylasParmakIzi()" style="margin-top:12px">📤 PAYLAŞ</button>
    </div>`;
  if ($('totoKuponSonuc')) $('totoKuponSonuc').innerHTML = html;
  window.sonParmakIzi = {
    toplamMac, dengeli: dengeli.length, netFavori: netFavori.length,
    celiskili: celiskili.length, kapsamaGerek: kapsamaGerek.length,
    kapsamaSkoru, seviye, seviyeEmoji
  };
  titreşim(30); sesCal('ok');
}

function paylasParmakIzi() {
  const p = window.sonParmakIzi;
  if (!p) { showToast('error', 'Boş', 'Önce Parmak İzi oluştur.'); return; }
  let metin = '🔍 SKORLAB · HAFTANIN PARMAK İZİ\n';
  metin += `📅 ${new Date().toLocaleDateString('tr-TR')}\n\n`;
  metin += `📊 ${p.toplamMac} MAÇLIK BÜLTEN\n\n`;
  metin += `⚖️ Dengeli: ${p.dengeli}\n✅ Net Favori: ${p.netFavori}\n⚠️ Çelişkili: ${p.celiskili}\n🎯 Kapsama: ${p.kapsamaGerek}\n\n`;
  metin += `🏆 KAPSAMA: %${p.kapsamaSkoru} ${p.seviyeEmoji}\n\n`;
  metin += '📌 Tahmindir.\n📱 @SkorLabBot';
  paylasMetni(metin, 'SkorLab Parmak İzi');
}

/* ============================================================
   18. ANALİZ MODAL
   ============================================================ */
function analizGosterToto(id) {
  const m = maclarToto.find(x => String(x.mac_id) === String(id));
  if (!m) return;
  const a = getAnalysisForMatch(id);
  if (!a) { showToast('error', 'Oran Eksik', 'Geçerli 1, X ve 2 oranlarını gir.'); return; }
  analizOrtak(`${m.ev_sahibi} - ${m.deplasman}`, a, id);
}

function analizOrtak(isim, a, mac_id) {
  if ($('analizTitle')) $('analizTitle').textContent = `📊 ${isim}`;
  if (!$('analizBody')) return;

  const xgEv = Number(a.xgEv);
  const xgDep = Number(a.xgDep);
  const matris = Motor.poissonMatris(xgEv, xgDep);

  let matrisHTML = '<div class="poisson-matris">';
  matrisHTML += '<div class="poisson-label"></div>';
  for (let a2 = 0; a2 <= 5; a2++) matrisHTML += `<div class="poisson-label">${a2}</div>`;
  for (let h = 0; h <= 5; h++) {
    matrisHTML += `<div class="poisson-label">${h}</div>`;
    for (let a2 = 0; a2 <= 5; a2++) {
      const p = matris[h][a2].p * 100;
      let bg, color;
      if (p >= 10) { bg = 'rgba(0,230,118,.5)'; color = '#000'; }
      else if (p >= 5) { bg = 'rgba(0,230,118,.3)'; color = '#fff'; }
      else if (p >= 2) { bg = 'rgba(255,176,32,.3)'; color = '#fff'; }
      else if (p >= 0.5) { bg = 'rgba(61,139,255,.2)'; color = '#fff'; }
      else { bg = 'rgba(30,41,64,.5)'; color = 'var(--muted)'; }
      matrisHTML += `<div class="poisson-cell" style="background:${bg};color:${color}">${h}-${a2}<br>%${p.toFixed(1)}</div>`;
    }
  }
  matrisHTML += '</div>';

  const uyarilar = contextualUyarilar(a, mac_id);

  $('analizBody').innerHTML = `
    <div style="font-size:.85rem;line-height:1.8">
      <div class="analiz-box" style="border:2px solid var(--green)">
        <span class="analiz-lbl">🎯 MODEL FAVORİSİ</span>
        <div style="text-align:center;font-size:1.4rem;font-weight:900;color:var(--green);padding:8px 0">${favoriKod(a.shin)} · %${favoriOlas(a.shin)}</div>
      </div>
      ${uyarilar.length ? `
        <div class="analiz-box">
          <span class="analiz-lbl">⚠️ DİKKAT</span>
          <div class="uyari-list">${uyarilar.map(u => `<div class="uyari-item ${u.tip}">${u.metin}</div>`).join('')}</div>
        </div>` : ''}
      <div class="analiz-box">
        <span class="analiz-lbl">📊 SHIN · MARJ ARINDIRMA</span>
        <div class="analiz-row"><span>1:</span><b>%${a.shin.p1}</b></div>
        <div class="analiz-row"><span>X:</span><b>%${a.shin.pX}</b></div>
        <div class="analiz-row"><span>2:</span><b>%${a.shin.p2}</b></div>
        <div class="analiz-row"><span class="muted">Marj:</span><b style="color:var(--orange)">%${a.marj}</b></div>
      </div>
      <div class="analiz-box">
        <span class="analiz-lbl">⚽ POISSON · xG ${a.xgEv} - ${a.xgDep}</span>
        <div class="analiz-row"><span>1:</span><b>%${a.poi.p1}</b></div>
        <div class="analiz-row"><span>X:</span><b>%${a.poi.pX}</b></div>
        <div class="analiz-row"><span>2:</span><b>%${a.poi.p2}</b></div>
        <div class="analiz-row"><span>2.5 Üst:</span><b class="${Number(a.poi.pUst25) >= 55 ? 'green' : 'orange'}">%${a.poi.pUst25}</b></div>
        <div class="analiz-row"><span>2.5 Alt:</span><b>%${a.poi.pAlt25}</b></div>
        <div class="analiz-row"><span>KG Var:</span><b class="${Number(a.poi.pKgVar) >= 55 ? 'green' : 'orange'}">%${a.poi.pKgVar}</b></div>
        <div class="analiz-row"><span>KG Yok:</span><b>%${a.poi.pKgYok}</b></div>
      </div>
      <div class="analiz-box">
        <span class="analiz-lbl">⚽ POISSON MATRİSİ</span>
        ${matrisHTML}
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
      <div class="muted" style="font-size:.7rem">Model tahminidir. Garanti değildir.</div>
    </div>`;
  $('analizModal')?.classList.add('active');
  titreşim(20); sesCal('tik');
}

function contextualUyarilar(a, mac_id) {
  const uyarilar = [];
  const favO = Number(favoriOlas(a.shin));
  const pUst = Number(a.poi.pUst25);
  const pKg = Number(a.poi.pKgVar);

  if (favO < 55) uyarilar.push({ tip: 'tehlike', metin: '⚠️ Favori net değil (%' + favO + '). Çift şans düşün.' });
  else if (favO >= 75) uyarilar.push({ tip: 'iyi', metin: '✅ Çok net favori (%' + favO + ').' });

  if (pUst >= 70 && pKg >= 70) uyarilar.push({ tip: 'iyi', metin: '⚡ Çok gollü maç. 2.5 Üst + KG Var.' });
  else if (pUst < 40 && pKg < 40) uyarilar.push({ tip: 'riskli', metin: '❄️ Az gollü maç. 2.5 Alt düşün.' });

  const o = oranlarToto[mac_id];
  if (o) {
    const i1 = 1 / o['1'], i2 = 1 / o['2'];
    const impliedFav = i1 > i2 ? '1' : '2';
    const modelFav = favoriKod(a.shin);
    if (modelFav !== impliedFav) uyarilar.push({ tip: 'riskli', metin: '⚠️ Model ile piyasa çelişiyor.' });
  }

  const sakat = sakatVerileri[mac_id];
  if (sakat) uyarilar.push({ tip: 'tehlike', metin: '🩹 ' + sakat });

  return uyarilar;
}

/* ============================================================
   19. KAYITLI KUPONLAR
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
  titreşim(20); sesCal('tik');
}

function kuponSil(id) {
  if (!confirm('Kupon silinsin mi?')) return;
  kayitliKuponlar = kayitliKuponlar.filter(x => Number(x.id) !== Number(id));
  persistCoupons(); closeModal('kuponDetayModal'); renderKayitliKuponlar();
}

/* ============================================================
   20. BACKTEST
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
  titreşim(30); sesCal(tuttu === true ? 'ok' : 'tik');
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
   21. PERFORMANS
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
      <div class="muted" style="font-size:.72rem;margin-bottom:12px">Şeffaf kayıt · Geçmiş garanti değildir</div>
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;text-align:center">
        <div style="padding:12px;background:var(--bg3);border-radius:8px"><div style="font-size:1.6rem;font-weight:900;color:var(--green)">${tutan}</div><div style="font-size:.6rem;color:var(--muted)">TUTAN</div></div>
        <div style="padding:12px;background:var(--bg3);border-radius:8px"><div style="font-size:1.6rem;font-weight:900;color:var(--red)">${tutmayan}</div><div style="font-size:.6rem;color:var(--muted)">TUTMAYAN</div></div>
        <div style="padding:12px;background:var(--bg3);border-radius:8px"><div style="font-size:1.6rem;font-weight:900;color:var(--orange)">%${oran}</div><div style="font-size:.6rem;color:var(--muted)">BAŞARI</div></div>
      </div>
      <div class="muted" style="font-size:.68rem;margin-top:12px;text-align:center">Toplam ${toplam} · ${degerlendirilen} değerlendirildi</div>
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
   22. GRAFİK
   ============================================================ */
function renderGrafik() {
  const c = $('grafikListesi');
  if (!c) return;
  if (!backtestKayitlari.length) {
    c.innerHTML = '<div class="card"><div class="muted" style="text-align:center;padding:20px">Grafik için backtest kaydı gerekli.</div></div>';
    return;
  }
  const tutan = backtestKayitlari.filter(b => b.tuttu === true).length;
  const tutmayan = backtestKayitlari.filter(b => b.tuttu === false).length;
  const toplam = tutan + tutmayan;
  const basari = toplam ? (tutan / toplam) * 100 : 0;
  const daireHTML = `
    <div class="grafik-daire">
      <svg width="200" height="200" viewBox="0 0 200 200">
        <circle cx="100" cy="100" r="80" fill="none" stroke="var(--bg3)" stroke-width="20"/>
        <circle cx="100" cy="100" r="80" fill="none" stroke="var(--green)" stroke-width="20"
          stroke-dasharray="${(basari / 100) * 502} 502"
          transform="rotate(-90 100 100)"
          stroke-linecap="round"/>
        <text x="100" y="95" text-anchor="middle" fill="var(--green)" font-size="28" font-weight="900">%${basari.toFixed(0)}</text>
        <text x="100" y="120" text-anchor="middle" fill="var(--muted)" font-size="12" font-weight="700">BAŞARI</text>
      </svg>
    </div>`;
  const son10 = backtestKayitlari.slice(0, 10);
  let barHTML = '<div class="grafik-bar">';
  son10.forEach(b => {
    const h = b.tuttu === true ? 100 : b.tuttu === false ? 30 : 60;
    const renk = b.tuttu === true ? 'var(--green)' : b.tuttu === false ? 'var(--red)' : 'var(--orange)';
    barHTML += `
      <div class="grafik-bar-item" style="height:${h}%;background:${renk}">
        <span class="bar-label">${(b.isim || '').slice(0, 4)}</span>
      </div>`;
  });
  barHTML += '</div>';
  c.innerHTML = `
    <div class="card">
      <div class="result-title">📊 GENEL BAŞARI</div>
      ${daireHTML}
      <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:8px;text-align:center;margin-top:10px">
        <div style="padding:10px;background:var(--bg3);border-radius:8px">
          <div style="font-size:1.2rem;font-weight:900;color:var(--green)">${tutan}</div>
          <div style="font-size:.6rem;color:var(--muted)">TUTAN</div>
        </div>
        <div style="padding:10px;background:var(--bg3);border-radius:8px">
          <div style="font-size:1.2rem;font-weight:900;color:var(--red)">${tutmayan}</div>
          <div style="font-size:.6rem;color:var(--muted)">TUTMAYAN</div>
        </div>
      </div>
    </div>
    <div class="card">
      <div class="result-title">📈 SON 10 TAHMİN</div>
      ${barHTML}
      <div class="muted" style="font-size:.65rem;margin-top:14px;text-align:center">
        🟢 Tutan · 🔴 Tutmayan · 🟠 Bekliyor
      </div>
    </div>
    <div class="card" style="border:2px solid var(--orange)">
      <div class="result-title" style="color:var(--orange)">⚠️ UYARI</div>
      <div style="font-size:.75rem;line-height:1.7">
        <p>• Grafikler geçmiş verilere dayanır.</p>
        <p>• Gelecek performansı garanti etmez.</p>
      </div>
    </div>`;
}

/* ============================================================
   23. VIP
   ============================================================ */
function renderVip() {
  const c = $('vipListesi');
  if (!c) return;
  c.innerHTML = `
    <div class="vip-kart">
      <div class="vip-icon">👑</div>
      <div class="vip-title">VIP SKORLAB</div>
      <div class="vip-desc">Premium analizler ve özel topluluk</div>
      <div class="vip-price">100 ₺<span style="font-size:.8rem;color:var(--muted)">/ay</span></div>
      <div class="vip-features">
        <div>✅ Günlük 5 banko maç</div>
        <div>✅ Detaylı istatistikler</div>
        <div>✅ Poisson matrisi</div>
        <div>✅ Özel VIP Telegram grubu</div>
        <div>✅ Canlı maç bildirimleri</div>
        <div>✅ Reklamsız deneyim</div>
        <div>✅ Öncelikli destek</div>
      </div>
      <button type="button" class="btn btn-orange btn-lg" onclick="vipOdemeAc()">👑 VIP'E KATIL</button>
    </div>
    <div class="vip-kart" style="border-color:var(--purple)">
      <div class="vip-icon">⭐</div>
      <div class="vip-title" style="color:var(--purple)">TELEGRAM STARS</div>
      <div class="vip-desc">Tek seferlik ödeme · Anında erişim</div>
      <div class="vip-price" style="color:var(--purple)">50 ⭐</div>
      <div class="vip-features">
        <div>✅ 1 maç detaylı analiz</div>
        <div>✅ 1 haftalık banko kupon</div>
        <div>✅ Anında erişim</div>
        <div>✅ Tek seferlik ödeme</div>
      </div>
      <button type="button" class="btn btn-purple btn-lg" onclick="starsOdemeAc()">⭐ STARS İLE ÖDE</button>
    </div>
    <div class="card" style="border:2px solid var(--orange)">
      <div class="result-title" style="color:var(--orange)">⚠️ ÖNEMLİ</div>
      <div style="font-size:.75rem;line-height:1.7">
        <p>• Ödemeler <b>Telegram Stars</b> veya <b>harici</b> yöntemlerle alınır.</p>
        <p>• VIP içerikler <b>yasal</b> çerçevede sunulur.</p>
        <p>• Hiçbir içerik <b>kazanç garantisi</b> vermez.</p>
      </div>
    </div>`;
}

function vipOdemeAc() {
  if (TG && TG.openTelegramLink) {
    TG.openTelegramLink('https://t.me/SkorLabBot?start=vip');
  } else {
    showToast('info', 'VIP', 'Telegram üzerinden ödeme yapılır.');
  }
}

function starsOdemeAc() {
  if (TG && TG.openTelegramLink) {
    TG.openTelegramLink('https://t.me/SkorLabBot?start=stars');
  } else {
    showToast('info', 'Stars', 'Telegram Stars ile ödeme yapılır.');
  }
}

/* ============================================================
   24. ARŞİV
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
  persistArsiv(); renderArsiv();
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
  showToast('success', 'İndirildi!', 'JSON indi.');
}

function renderArsiv() {
  const c = $('arsivListesi');
  if (!c) return;
  if (!arsivKayitlari.length) {
    c.innerHTML = '<div class="muted" style="text-align:center;padding:20px">Arşiv boş.</div>';
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
   25. SEKME VE MODAL
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
  if (i === 8) renderGrafik();
  if (i === 9) renderVip();
  titreşim(15); sesCal('tik');
}

function closeModal(id) {
  const el = $(id);
  if (el) el.classList.remove('active');
}

function showToast(type, title, msg) {
  const icon = $('toastIcon'), titleEl = $('toastTitle'), msgEl = $('toastMsg'), modal = $('toastModal');
  if (icon) icon.textContent = type === 'success' ? '✅' : type === 'info' ? 'ℹ️' : '❌';
  if (titleEl) titleEl.textContent = title;
  if (msgEl) msgEl.textContent = msg;
  if (modal) modal.classList.add('active');
}

/* ============================================================
   26. BAŞLAT
   ============================================================ */
window.addEventListener('DOMContentLoaded', () => {
  initTelegram();
  loadData();
});
