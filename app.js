/* ============================================================
   SKORLAB TOTO · TELEGRAM MINI APP
   Sadece Toto + Bankobot
   ============================================================ */

/* ============================================================
   TELEGRAM MINI APP
   ============================================================ */
let TG = null;

function initTelegram() {
  if (window.Telegram && window.Telegram.WebApp) {
    TG = window.Telegram.WebApp;
    TG.ready();
    TG.expand();
    TG.enableClosingConfirmation();
    applyTelegramTheme(TG);
    TG.onEvent('themeChanged', () => applyTelegramTheme(TG));

    const user = TG.initDataUnsafe?.user;
    if (user && user.first_name) {
      console.log(`👋 Merhaba, ${user.first_name}!`);
    }
  }
}

function applyTelegramTheme(tg) {
  const params = tg.themeParams || {};
  const root = document.documentElement;
  if (params.bg_color) root.style.setProperty('--bg', params.bg_color);
  if (params.secondary_bg_color) root.style.setProperty('--bg2', params.secondary_bg_color);
  if (params.text_color) root.style.setProperty('--text', params.text_color);
  if (params.hint_color) root.style.setProperty('--muted', params.hint_color);
  if (params.button_color) root.style.setProperty('--green', params.button_color);
}

/* ============================================================
   1. MOTOR
   ============================================================ */
class Motor {
  static faktoriyel(n){ let r=1; for(let i=2;i<=n;i++) r*=i; return r; }
  static poissonPmf(k,l){ return (Math.exp(-l)*Math.pow(l,k))/this.faktoriyel(k); }

  static shin(o1,oX,o2){
    const p1=1/o1, pX=1/oX, p2=1/o2;
    const S = p1+pX+p2;
    if(S<=1) return {p1:0.33,pX:0.33,p2:0.34,marj:0};
    const z = (S-1)/S;
    const f = p => (Math.sqrt(z*z + 4*(1-z)*(p*p/S)) - z) / (2*(1-z));
    const a=f(p1), b=f(pX), c=f(p2);
    const t = a+b+c;
    return { p1:a/t, pX:b/t, p2:c/t, marj:(S-1)*100 };
  }

  static xg(p1,pX,p2){
    const hs = p1/(p1+p2 || 1);
    const tg = 2.4 + (1-pX)*0.8;
    let xgEv = Math.max(0.5, tg*hs*1.15);
    let xgDep = Math.max(0.5, tg*(1-hs)*0.95);
    for(let i=0;i<15;i++){
      const poi = this.poisson(xgEv, xgDep);
      const h1 = poi.p1 - p1, h2 = poi.p2 - p2;
      if(Math.abs(h1)<0.01 && Math.abs(h2)<0.01) break;
      xgEv = Math.max(0.5, Math.min(3.5, xgEv + h1*0.5));
      xgDep = Math.max(0.5, Math.min(3.5, xgDep + h2*0.5));
    }
    return { xgEv, xgDep };
  }

  static poisson(xgEv, xgDep){
    let p1=0,pX=0,p2=0,kg=0,ust25=0,alt25=0;
    const skorlar = [];
    for(let h=0;h<=8;h++){
      for(let a=0;a<=8;a++){
        const p = this.poissonPmf(h,xgEv)*this.poissonPmf(a,xgDep);
        if(h>a) p1+=p; else if(h===a) pX+=p; else p2+=p;
        if(h+a>2.5) ust25+=p; else alt25+=p;
        if(h>=1&&a>=1) kg+=p;
        skorlar.push({ h, a, skor:`${h}-${a}`, p });
      }
    }
    const t = p1+pX+p2;
    skorlar.forEach(s => s.p /= t);
    skorlar.sort((a,b)=>b.p-a.p);
    return {
      p1:p1/t, pX:pX/t, p2:p2/t,
      pUst25: Math.min(0.99, Math.max(0.01, ust25/t)),
      pAlt25: Math.min(0.99, Math.max(0.01, alt25/t)),
      pKgVar: Math.min(0.99, Math.max(0.01, kg/t)),
      pKgYok: Math.min(0.99, Math.max(0.01, 1-kg/t)),
      enOlası: skorlar.slice(0,5).map(s => ({ skor:s.skor, yuzde:(s.p*100).toFixed(1) }))
    };
  }

  static analiz(veri){
    const {o1,oX,o2} = veri;
    const sh = this.shin(o1,oX,o2);
    const xg = this.xg(sh.p1, sh.pX, sh.p2);
    const poi = this.poisson(xg.xgEv, xg.xgDep);

    const ust25 = poi.pUst25 * 100;
    const kgv = poi.pKgVar * 100;
    let gollu = '';
    if(ust25 >= 65 && kgv >= 65) gollu = '🔥 ÇOK GOLLÜ';
    else if(ust25 >= 55 || kgv >= 55) gollu = '⚡ GOLLÜ';
    else if(ust25 >= 45 || kgv >= 45) gollu = '🟡 ORTA';
    else gollu = '❄️ AZ GOLLÜ';

    return {
      marj: sh.marj.toFixed(1),
      shin: { p1:(sh.p1*100).toFixed(1), pX:(sh.pX*100).toFixed(1), p2:(sh.p2*100).toFixed(1) },
      xgEv: xg.xgEv.toFixed(2), xgDep: xg.xgDep.toFixed(2),
      poi: {
        p1:(poi.p1*100).toFixed(1), pX:(poi.pX*100).toFixed(1), p2:(poi.p2*100).toFixed(1),
        pUst25: ust25.toFixed(1),
        pAlt25: (poi.pAlt25*100).toFixed(1),
        pKgVar: kgv.toFixed(1),
        pKgYok: (poi.pKgYok*100).toFixed(1),
        enOlası: poi.enOlası
      },
      gollu
    };
  }
}

/* ============================================================
   2. UYGULAMA DURUMU
   ============================================================ */
let maclarToto = [];
let oranlarToto = JSON.parse(localStorage.getItem('skorlab_oranlar_toto') || '{}');
let secimlerToto = JSON.parse(localStorage.getItem('skorlab_secimler_toto') || '{}');
let kayitliKuponlar = JSON.parse(localStorage.getItem('skorlab_kuponlar') || '[]');
let backtestKayitlari = JSON.parse(localStorage.getItem('skorlab_backtest') || '[]');

const $ = id => document.getElementById(id);

/* ============================================================
   3. VERİ YÜKLE
   ============================================================ */
async function loadData(){
  try{
    const res = await fetch('matches.json');
    const raw = await res.json();
    maclarToto = raw.maclar || [];
    $('weekTitle').innerText = raw.hafta || 'Bu Hafta';
  }catch(e){
    $('weekTitle').innerText = 'Veri Yüklenemedi';
    console.error(e);
  }
  renderToto(); renderAnaliz();
  renderKayitliKuponlar(); renderBacktest();
  updateStats(); updateKuponCubugu();
}

/* ============================================================
   4. ORAN GÜNCELLE
   ============================================================ */
function oranGuncelleToto(mac_id, alan, val){
  if(!oranlarToto[mac_id]) oranlarToto[mac_id] = {};
  const num = parseFloat(val);
  if(!val || isNaN(num)) delete oranlarToto[mac_id][alan];
  else oranlarToto[mac_id][alan] = num;
  localStorage.setItem('skorlab_oranlar_toto', JSON.stringify(oranlarToto));
  renderToto(); renderAnaliz();
}

/* ============================================================
   5. TOTO RENDER
   ============================================================ */
function renderToto(){
  const c = $('totoListesi');
  if(!c) return;
  if(!maclarToto.length){
    c.innerHTML = '<div class="card"><div class="muted" style="text-align:center;padding:20px">Maç yok.</div></div>';
    return;
  }
  c.innerHTML = maclarToto.map(m => {
    const sec = secimlerToto[m.mac_id] || [];
    const o = oranlarToto[m.mac_id] || {};
    let tahmin = null;
    if(o['1'] && o['X'] && o['2']){
      tahmin = Motor.analiz({ o1:o['1'], oX:o['X'], o2:o['2'] });
    }
    return `
    <div class="mac-kart">
      <div class="mac-head">
        <span class="mac-no">#${m.mac_id}</span>
        <button type="button" class="mac-analiz-btn" onclick="analizGosterToto(${m.mac_id})">📊</button>
      </div>
      <div class="mac-teams">${m.ev_sahibi} - ${m.deplasman}</div>
      <div class="oran-giris">
        <div class="oran-item"><label>1</label><input type="number" step="0.01" value="${o['1']||''}" onchange="oranGuncelleToto(${m.mac_id},'1',this.value)"></div>
        <div class="oran-item"><label>X</label><input type="number" step="0.01" value="${o['X']||''}" onchange="oranGuncelleToto(${m.mac_id},'X',this.value)"></div>
        <div class="oran-item"><label>2</label><input type="number" step="0.01" value="${o['2']||''}" onchange="oranGuncelleToto(${m.mac_id},'2',this.value)"></div>
      </div>
      ${tahmin ? `
      <div class="tahmin-box">
        <div class="tahmin-satir"><span class="lbl">🎯 FAVORİ</span><span class="val green">${favoriKod(tahmin.shin)} (%${favoriOlas(tahmin.shin)})</span></div>
        <div class="tahmin-satir"><span class="lbl">⚽ SKOR</span><span class="val purple">${tahmin.poi.enOlası[0].skor}</span></div>
        <div class="tahmin-satir"><span class="lbl">📊 DURUM</span><span class="val orange">${tahmin.gollu}</span></div>
      </div>
      ` : ''}
      <div class="secim-grid">
        <button type="button" class="secim-btn ${sec.includes('1')?'secili':''}" onclick="secimToggleToto(${m.mac_id},'1')">1</button>
        <button type="button" class="secim-btn ${sec.includes('X')?'secili':''}" onclick="secimToggleToto(${m.mac_id},'X')">X</button>
        <button type="button" class="secim-btn ${sec.includes('2')?'secili':''}" onclick="secimToggleToto(${m.mac_id},'2')">2</button>
      </div>
    </div>`;
  }).join('');
  updateKuponCubugu();
}

function favoriKod(shin){
  const p1=parseFloat(shin.p1), pX=parseFloat(shin.pX), p2=parseFloat(shin.p2);
  if(p1>=pX && p1>=p2) return '1';
  if(p2>=p1 && p2>=pX) return '2';
  return 'X';
}
function favoriOlas(shin){
  const p1=parseFloat(shin.p1), pX=parseFloat(shin.pX), p2=parseFloat(shin.p2);
  return Math.max(p1,pX,p2).toFixed(1);
}

/* ============================================================
   6. ANALİZ SEKMESİ
   ============================================================ */
function renderAnaliz(){
  const c = $('analizListesi');
  if(!c) return;
  const satirlar = [];
  maclarToto.forEach(m => {
    const o = oranlarToto[m.mac_id];
    if(!o || !o['1'] || !o['X'] || !o['2']) return;
    const a = Motor.analiz({ o1:o['1'], oX:o['X'], o2:o['2'] });
    satirlar.push({ id:m.mac_id, isim:m.ev_sahibi + ' - ' + m.deplasman, a });
  });
  if(!satirlar.length){
    c.innerHTML = '<div class="muted" style="text-align:center;padding:20px">Analiz için oran gir.</div>';
    return;
  }
  satirlar.sort((x,y)=> parseFloat(y.a.poi.pUst25) - parseFloat(x.a.poi.pUst25));
  c.innerHTML = satirlar.map(s => `
    <div style="padding:10px 0;border-bottom:1px solid var(--border);font-size:.78rem;cursor:pointer" onclick="analizGosterToto(${s.id})">
      <div style="font-weight:900;margin-bottom:4px">#${s.id} ${s.isim}</div>
      <div style="display:flex;justify-content:space-between">
        <span style="font-weight:900;color:var(--green)">${favoriKod(s.a.shin)} (%${favoriOlas(s.a.shin)})</span>
        <span class="muted">2.5Ü %${s.a.poi.pUst25} · KG %${s.a.poi.pKgVar}</span>
      </div>
      <div style="margin-top:3px;color:var(--orange);font-weight:900;font-size:.72rem">${s.a.gollu}</div>
    </div>
  `).join('');
}

/* ============================================================
   7. SEÇİM
   ============================================================ */
function secimToggleToto(id, s){
  let arr = secimlerToto[id] || [];
  if(arr.includes(s)) arr = arr.filter(x => x !== s); else arr.push(s);
  if(!arr.length) delete secimlerToto[id]; else secimlerToto[id] = arr;
  localStorage.setItem('skorlab_secimler_toto', JSON.stringify(secimlerToto));
  renderToto(); updateStats(); updateKuponCubugu();
}

function tumSecimleriSil(){
  if(!confirm('Tüm seçimler silinsin mi?')) return;
  secimlerToto = {};
  localStorage.setItem('skorlab_secimler_toto', '{}');
  renderToto(); updateStats(); updateKuponCubugu();
}

function temizleToto(){
  if(!confirm('Toto oranları silinsin mi?')) return;
  oranlarToto = {}; secimlerToto = {};
  localStorage.setItem('skorlab_oranlar_toto', '{}');
  localStorage.setItem('skorlab_secimler_toto', '{}');
  renderToto(); renderAnaliz(); updateStats(); updateKuponCubugu();
}

/* ============================================================
   8. KUPON HESAP
   ============================================================ */
function kuponHesapla(){
  let toto=0, kolon=1;
  Object.keys(secimlerToto).forEach(id => {
    const s = secimlerToto[id]; if(!s||!s.length) return;
    toto++; kolon *= s.length;
  });
  return { toto, toplam: toto, kolon, tutar: kolon*10 };
}

function updateStats(){
  const h = kuponHesapla();
  const sM=$('statMac'); if(sM) sM.innerText = maclarToto.length;
  const sS=$('statSecilen'); if(sS) sS.innerText = h.toplam;
  const sK=$('statKolon'); if(sK) sK.innerText = h.kolon;
  const sT=$('statTutar'); if(sT) sT.innerText = h.tutar;
}

function updateKuponCubugu(){
  const h = kuponHesapla();
  const kT=$('kcToto'); if(kT) kT.innerText = h.toto;
  const kP=$('kcToplam'); if(kP) kP.innerText = h.tutar + ' TL';
}

/* ============================================================
   9. KUPON OLUŞTUR (TOTO)
   ============================================================ */
function kuponOlusturToto(){
  const oneriler = [];
  maclarToto.forEach(m => {
    const o = oranlarToto[m.mac_id];
    if(!o || !o['1'] || !o['X'] || !o['2']) return;
    const a = Motor.analiz({ o1:o['1'], oX:o['X'], o2:o['2'] });
    oneriler.push({ isim:m.ev_sahibi + ' - ' + m.deplasman, a, fav:favoriKod(a.shin), favO:favoriOlas(a.shin) });
  });
  if(!oneriler.length){ showToast('error','Maç Yok','Oran gir.'); return; }

  let html = `<div class="card" style="border:1px solid var(--green)"><div class="result-title">⚡ TOTO ÖNERİSİ</div>`;
  let kolon = 1;
  oneriler.forEach(o => {
    const favO = parseFloat(o.favO);
    let secim, renk, carpan;
    if(favO >= 68){ secim = o.fav; renk='green'; carpan=1; }
    else if(favO >= 52){
      const s = o.a.shin;
      const sirali = [{k:'1',o:parseFloat(s.p1)},{k:'X',o:parseFloat(s.pX)},{k:'2',o:parseFloat(s.p2)}].sort((a,b)=>b.o-a.o);
      secim = sirali[0].k + sirali[1].k;
      renk='orange'; carpan=2;
    }
    else { secim = '1X2'; renk='red'; carpan=3; }
    kolon *= carpan;
    html += `<div style="padding:10px 0;border-bottom:1px solid var(--border);font-size:.78rem">
      <div style="font-weight:900;margin-bottom:4px">${o.isim}</div>
      <div style="display:flex;justify-content:space-between">
        <b style="color:var(--${renk})">🎯 ${secim}</b>
        <span class="muted">Fav: ${o.fav} (%${o.favO})</span>
      </div>
      <div class="muted" style="font-size:.68rem;margin-top:2px">${o.a.gollu} · 2.5Ü %${o.a.poi.pUst25} · KG %${o.a.poi.pKgVar}</div>
    </div>`;
  });
  html += `<div style="margin-top:12px;padding:10px;background:var(--bg3);border-radius:8px">
    <div class="analiz-row"><span>Kolon:</span><b class="green">${kolon}</b></div>
    <div class="analiz-row"><span>Tutar:</span><b class="green">${kolon*10} TL</b></div>
  </div>
  <button type="button" class="btn btn-green btn-lg" onclick="kuponKaydetToto()" style="margin-top:12px">💾 KAYDET</button>
  <button type="button" class="btn btn-blue btn-lg" onclick="paylasKupon()" style="margin-top:8px">📤 PAYLAŞ</button></div>`;
  $('totoKuponSonuc').innerHTML = html;
  window.sonTotoKuponu = oneriler;
}

function kuponKaydetToto(){
  const oneriler = window.sonTotoKuponu || [];
  if(!oneriler.length) return;
  kayitliKuponlar.unshift({
    id: Date.now(), tip:'toto', tarih: new Date().toLocaleString('tr-TR'),
    macSayisi: oneriler.length, kolon:1, tutar:10,
    detaylar: oneriler.map(o => ({ isim:o.isim, secim:o.fav + ' (%' + o.favO + ')' })),
    durum:'bekliyor'
  });
  if(kayitliKuponlar.length > 50) kayitliKuponlar = kayitliKuponlar.slice(0, 50);
  localStorage.setItem('skorlab_kuponlar', JSON.stringify(kayitliKuponlar));
  renderKayitliKuponlar();
  showToast('success','Kaydedildi!', oneriler.length + ' maç');
}

/* ============================================================
   10. BANKOBOT · En güvenli 5 maç
   ============================================================ */
function bankobot(){
  if(!maclarToto.length){ showToast('error','Maç Yok','Toto maçları yüklenmedi.'); return; }

  const analizler = maclarToto.map(m => {
    const o = oranlarToto[m.mac_id];
    if(!o || !o['1'] || !o['X'] || !o['2']) return null;
    const a = Motor.analiz({ o1:o['1'], oX:o['X'], o2:o['2'] });
    return {
      mac_id: m.mac_id,
      mac: `${m.ev_sahibi} - ${m.deplasman}`,
      fav: favoriKod(a.shin),
      favO: parseFloat(favoriOlas(a.shin)),
      skor: a.poi.enOlası[0].skor,
      gollu: a.gollu,
      pUst25: a.poi.pUst25,
      pKgVar: a.poi.pKgVar,
      analiz: a
    };
  }).filter(Boolean);

  if(!analizler.length){ showToast('error','Oran Yok','Önce oranları gir.'); return; }

  analizler.sort((a, b) => b.favO - a.favO);
  const bankolar = analizler.filter(a => a.favO >= 62).slice(0, 5);

  if(!bankolar.length){ showToast('error','Banko Yok','Yeterli güvenli maç yok.'); return; }

  const ortGuv = (bankolar.reduce((s, b) => s + b.favO, 0) / bankolar.length).toFixed(1);

  let html = `<div class="card" style="border:2px solid var(--purple)">
    <div class="result-title">🤖 BANKOBOT · ${bankolar.length} MAÇ</div>
    <div class="muted" style="font-size:.72rem;margin-bottom:10px">En güvenli maçlar · Ortalama %${ortGuv}</div>`;

  bankolar.forEach((b, i) => {
    html += `
      <div style="padding:12px 0;border-bottom:1px solid var(--border)">
        <div style="font-weight:900;font-size:.85rem;margin-bottom:6px">${i+1}. ${b.mac}</div>
        <div style="display:flex;justify-content:space-between;margin-bottom:4px">
          <span>🎯 <b style="color:var(--green)">${b.fav}</b> (%${b.favO})</span>
          <span>⚽ <b style="color:var(--purple)">${b.skor}</b></span>
        </div>
        <div class="muted" style="font-size:.68rem">📊 ${b.gollu} · 2.5Ü %${b.pUst25} · KG %${b.pKgVar}</div>
      </div>
    `;
  });

  html += `
    <div style="margin-top:12px;padding:10px;background:var(--bg3);border-radius:8px;text-align:center">
      <div style="font-size:.8rem;color:var(--muted)">Ortalama Güven</div>
      <div style="font-size:1.4rem;font-weight:900;color:var(--purple)">%${ortGuv}</div>
    </div>
    <button type="button" class="btn btn-purple btn-lg" onclick="paylasBankobot()" style="margin-top:12px">📤 TELEGRAM'DA PAYLAŞ</button>
    <button type="button" class="btn btn-green btn-lg" onclick="kaydetBankobot()" style="margin-top:8px">💾 KUPONA KAYDET</button>
  </div>`;

  $('totoKuponSonuc').innerHTML = html;
  window.sonBankobot = bankolar;
}

function paylasBankobot(){
  const bankolar = window.sonBankobot || [];
  if(!bankolar.length){ showToast('error','Boş','Önce bankobot oluştur.'); return; }

  let metin = '🤖 SKORLAB BANKOBOT\n';
  metin += `📅 ${new Date().toLocaleDateString('tr-TR')}\n\n`;
  bankolar.forEach((b, i) => {
    metin += `${i+1}. ${b.mac}\n`;
    metin += `   🎯 ${b.fav} (%${b.favO})\n`;
    metin += `   ⚽ ${b.skor} · ${b.gollu}\n\n`;
  });
  const ortGuv = (bankolar.reduce((s, b) => s + b.favO, 0) / bankolar.length).toFixed(1);
  metin += `💰 Ortalama güven: %${ortGuv}\n`;
  metin += `📱 @SkorLabBot`;

  if(TG && TG.isVersionAtLeast && TG.isVersionAtLeast('6.1')){
    TG.switchInlineQuery(metin, ['users', 'groups']);
  } else if(navigator.share){
    navigator.share({ title: 'SkorLab Bankobot', text: metin }).catch(() => {});
  } else {
    navigator.clipboard.writeText(metin).then(() => {
      showToast('success', 'Kopyalandı!', 'Kupon panoya kopyalandı.');
    });
  }
}

function kaydetBankobot(){
  const bankolar = window.sonBankobot || [];
  if(!bankolar.length) return;

  kayitliKuponlar.unshift({
    id: Date.now(),
    tip: 'bankobot',
    tarih: new Date().toLocaleString('tr-TR'),
    macSayisi: bankolar.length,
    kolon: bankolar.length,
    tutar: bankolar.length * 10,
    detaylar: bankolar.map(b => ({
      isim: b.mac,
      secim: `${b.fav} (%${b.favO}) · ${b.skor}`
    })),
    durum: 'bekliyor'
  });

  if(kayitliKuponlar.length > 50) kayitliKuponlar = kayitliKuponlar.slice(0, 50);
  localStorage.setItem('skorlab_kuponlar', JSON.stringify(kayitliKuponlar));
  renderKayitliKuponlar();
  showToast('success', 'Kaydedildi!', `${bankolar.length} maç`);
}

/* ============================================================
   11. PAYLAŞ KUPON
   ============================================================ */
function paylasKupon(){
  const secimler = secimlerToto;
  if(!Object.keys(secimler).length){ showToast('error','Boş','Önce maç seç.'); return; }

  let metin = '⚽ SKORLAB TOTO KUPONU\n\n';
  let kolon = 1;
  Object.keys(secimler).forEach(id => {
    const m = maclarToto.find(x => x.mac_id == id);
    if(!m) return;
    const s = secimler[id];
    kolon *= s.length;
    metin += `#${id} ${m.ev_sahibi} - ${m.deplasman}\n`;
    metin += `🎯 ${s.join(' / ')}\n\n`;
  });
  metin += `💰 Kolon: ${kolon}\n`;
  metin += `💵 Tutar: ${kolon * 10} TL\n\n`;
  metin += `📱 @SkorLabBot`;

  if(TG && TG.isVersionAtLeast && TG.isVersionAtLeast('6.1')){
    TG.switchInlineQuery(metin, ['users', 'groups']);
  } else if(navigator.share){
    navigator.share({ title: 'SkorLab Kuponu', text: metin }).catch(() => {});
  } else {
    navigator.clipboard.writeText(metin).then(() => {
      showToast('success', 'Kopyalandı!', 'Kupon panoya kopyalandı.');
    });
  }
}

/* ============================================================
   12. ANALİZ MODAL
   ============================================================ */
function analizGosterToto(id){
  const m = maclarToto.find(x => x.mac_id === id);
  if(!m) return;
  const o = oranlarToto[id];
  if(!o || !o['1']) { showToast('error','Oran Yok','1/X/2 gir'); return; }
  analizOrtak(m.ev_sahibi + ' - ' + m.deplasman, { o1:o['1'], oX:o['X'], o2:o['2'] });
}

function analizOrtak(isim, o){
  const a = Motor.analiz(o);
  $('analizTitle').innerText = '📊 ' + isim;
  $('analizBody').innerHTML = `
    <div style="font-size:.85rem;line-height:1.8">
      <div class="analiz-box" style="border:2px solid var(--green)">
        <span class="analiz-lbl">🎯 FAVORİ</span>
        <div style="text-align:center;font-size:1.4rem;font-weight:900;color:var(--green);padding:8px 0">
          ${favoriKod(a.shin)} · %${favoriOlas(a.shin)}
        </div>
      </div>
      <div class="analiz-box">
        <span class="analiz-lbl">📊 SHIN (Marj Arındırma)</span>
        <div class="analiz-row"><span>1:</span><b>%${a.shin.p1}</b></div>
        <div class="analiz-row"><span>X:</span><b>%${a.shin.pX}</b></div>
        <div class="analiz-row"><span>2:</span><b>%${a.shin.p2}</b></div>
        <div class="analiz-row"><span class="muted">Marj:</span><b style="color:var(--orange)">%${a.marj}</b></div>
      </div>
      <div class="analiz-box">
        <span class="analiz-lbl">⚽ POISSON · xG: ${a.xgEv} - ${a.xgDep}</span>
        <div class="analiz-row"><span>2.5 Üst:</span><b class="${parseFloat(a.poi.pUst25)>=55?'green':'orange'}">%${a.poi.pUst25}</b></div>
        <div class="analiz-row"><span>2.5 Alt:</span><b>%${a.poi.pAlt25}</b></div>
        <div class="analiz-row"><span>KG Var:</span><b class="${parseFloat(a.poi.pKgVar)>=55?'green':'orange'}">%${a.poi.pKgVar}</b></div>
        <div class="analiz-row"><span>KG Yok:</span><b>%${a.poi.pKgYok}</b></div>
      </div>
      <div class="analiz-box">
        <span class="analiz-lbl">⚽ BEKLENEN SKORLAR</span>
        <div class="skor-grid">
          ${a.poi.enOlası.map(s => `<div class="skor-item"><div class="skor-sayi">${s.skor}</div><div class="skor-yuzde">%${s.yuzde}</div></div>`).join('')}
        </div>
      </div>
      <div class="analiz-box">
        <span class="analiz-lbl">📌 DURUM</span>
        <div style="text-align:center;padding:8px 0">
          <span class="gol-etiket ${a.gollu.includes('ÇOK')||a.gollu.includes('GOLLÜ')?'gol-yes':a.gollu.includes('ORTA')?'gol-orta':'gol-no'}" style="font-size:.8rem;padding:6px 14px">${a.gollu}</span>
        </div>
      </div>
    </div>`;
  $('analizModal').classList.add('active');
}

/* ============================================================
   13. KUPONLARIM
   ============================================================ */
function renderKayitliKuponlar(){
  const c = $('kayitliKuponlar');
  if(!c) return;
  if(!kayitliKuponlar.length){
    c.innerHTML = '<div class="muted" style="text-align:center;padding:20px">Kayıtlı kupon yok.</div>';
    return;
  }
  c.innerHTML = kayitliKuponlar.map(k => {
    const renk = k.durum === 'kazandi' ? 'kazandi' : k.durum === 'kaybetti' ? 'kaybetti' : 'bekliyor';
    const emoji = k.durum === 'kazandi' ? '✅' : k.durum === 'kaybetti' ? '❌' : '⏳';
    const ikon = k.tip === 'bankobot' ? '🤖' : '📋';
    return `
      <div class="kupon-gecmis ${renk}" onclick="kuponDetayAc(${k.id})">
        <div style="display:flex;justify-content:space-between;font-size:.8rem;margin-bottom:4px">
          <span>${emoji} ${ikon} <b>${k.macSayisi} maç</b></span>
          <span class="muted">${k.tarih}</span>
        </div>
        <div style="font-size:.72rem;color:var(--muted)">Tutar: <b style="color:var(--green)">${k.tutar} TL</b></div>
      </div>`;
  }).join('');
}

function kuponDetayAc(id){
  const k = kayitliKuponlar.find(x => x.id === id);
  if(!k) return;
  const emoji = k.durum === 'kazandi' ? '✅' : k.durum === 'kaybetti' ? '❌' : '⏳';
  $('kuponDetayBody').innerHTML = `
    <div style="font-size:.8rem">
      <div class="muted" style="margin-bottom:10px">${emoji} ${k.tarih} · ${k.macSayisi} maç · ${k.tutar} TL</div>
      <div style="max-height:400px;overflow-y:auto;background:var(--bg3);border-radius:8px;padding:10px">
        ${k.detaylar.map(d => `
          <div style="padding:8px 0;border-bottom:1px solid var(--border)">
            <div style="font-weight:800;margin-bottom:4px">${d.isim}</div>
            <div style="color:var(--green);font-weight:900;text-align:right">${d.secim}</div>
          </div>
        `).join('')}
      </div>
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:6px;margin-top:12px">
        <button type="button" class="btn ${k.durum==='kazandi'?'btn-green':'btn-gray'}" onclick="kuponDurum(${id},'kazandi')">✅ Kazandı</button>
        <button type="button" class="btn ${k.durum==='bekliyor'?'btn-orange':'btn-gray'}" onclick="kuponDurum(${id},'bekliyor')">⏳ Bekliyor</button>
        <button type="button" class="btn ${k.durum==='kaybetti'?'btn-red':'btn-gray'}" onclick="kuponDurum(${id},'kaybetti')">❌ Kaybetti</button>
      </div>
      <button type="button" class="btn btn-red btn-lg" onclick="kuponSil(${id})" style="margin-top:10px">🗑️ Sil</button>
    </div>`;
  $('kuponDetayModal').classList.add('active');
}

function kuponDurum(id, durum){
  const k = kayitliKuponlar.find(x => x.id === id);
  if(!k) return;
  k.durum = durum;
  localStorage.setItem('skorlab_kuponlar', JSON.stringify(kayitliKuponlar));
  closeModal('kuponDetayModal');
  renderKayitliKuponlar();
}

function kuponSil(id){
  if(!confirm('Kupon silinsin mi?')) return;
  kayitliKuponlar = kayitliKuponlar.filter(x => x.id !== id);
  localStorage.setItem('skorlab_kuponlar', JSON.stringify(kayitliKuponlar));
  closeModal('kuponDetayModal');
  renderKayitliKuponlar();
}

/* ============================================================
   14. BACKTEST
   ============================================================ */
function renderBacktest(){
  const c = $('backtestListesi');
  if(!c) return;
  if(!backtestKayitlari.length){
    c.innerHTML = '<div class="card"><div class="muted" style="text-align:center;padding:20px">Kayıt yok.</div></div>';
    return;
  }
  const toplam = backtestKayitlari.length;
  const tutan = backtestKayitlari.filter(b => b.tuttu === true).length;
  const tutmayan = backtestKayitlari.filter(b => b.tuttu === false).length;
  const oran = toplam > 0 ? ((tutan/toplam)*100).toFixed(1) : 0;
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
      <div class="result-title">📋 KAYITLAR (${toplam})</div>
      ${backtestKayitlari.slice(0, 50).map(b => {
        const emoji = b.tuttu === true ? '✅' : b.tuttu === false ? '❌' : '⏳';
        return `<div style="padding:10px 0;border-bottom:1px solid var(--border);display:flex;justify-content:space-between;align-items:center">
          <div style="flex:1">
            <div style="font-weight:900;font-size:.8rem">${emoji} ${b.isim}</div>
            <div class="muted" style="font-size:.68rem">Öneri: ${b.oneriTip}${b.gercekSkor ? ' · Sonuç: ' + b.gercekSkor : ''}</div>
          </div>
          <button type="button" class="btn btn-red btn-sm" onclick="backtestSil(${b.id})">🗑️</button>
        </div>`;
      }).join('')}
    </div>`;
}

function backtestEkle(){
  const isim = $('bt-mac').value.trim();
  const o1 = parseFloat($('bt-o1').value);
  const oX = parseFloat($('bt-oX').value);
  const o2 = parseFloat($('bt-o2').value);
  const skor = $('bt-skor').value.trim();
  if(!isim || !o1 || !oX || !o2){ showToast('error','Eksik','Maç + 1X2'); return; }
  const a = Motor.analiz({ o1, oX, o2 });
  let tuttu = null;
  if(skor && /^\d+-\d+$/.test(skor)){
    const [h, d] = skor.split('-').map(Number);
    const gercek = h > d ? '1' : h < d ? '2' : 'X';
    const fav = favoriKod(a.shin);
    const favO = parseFloat(favoriOlas(a.shin));
    if(favO >= 68) tuttu = fav === gercek;
    else if(favO >= 52){
      const s = a.shin;
      const sirali = [{k:'1',o:parseFloat(s.p1)},{k:'X',o:parseFloat(s.pX)},{k:'2',o:parseFloat(s.p2)}].sort((x,y)=>y.o-x.o);
      tuttu = [sirali[0].k, sirali[1].k].includes(gercek);
    } else tuttu = true;
  }
  backtestKayitlari.unshift({
    id: Date.now(), isim, oneriTip: favoriKod(a.shin) + ' (%' + favoriOlas(a.shin) + ')',
    gercekSkor: skor || null, tuttu, tarih: new Date().toLocaleString('tr-TR')
  });
  if(backtestKayitlari.length > 200) backtestKayitlari = backtestKayitlari.slice(0, 200);
  localStorage.setItem('skorlab_backtest', JSON.stringify(backtestKayitlari));
  ['bt-mac','bt-o1','bt-oX','bt-o2','bt-skor'].forEach(id => { const el = $(id); if(el) el.value=''; });
  renderBacktest();
  showToast('success','Eklendi!', tuttu === true ? 'TUTTU ✅' : tuttu === false ? 'TUTMADI ❌' : 'Skor yok');
}

function backtestSil(id){
  if(!confirm('Silinsin mi?')) return;
  backtestKayitlari = backtestKayitlari.filter(x => x.id !== id);
  localStorage.setItem('skorlab_backtest', JSON.stringify(backtestKayitlari));
  renderBacktest();
}

function backtestTemizle(){
  if(!confirm('Tüm kayıtlar silinsin mi?')) return;
  backtestKayitlari = [];
  localStorage.setItem('skorlab_backtest', '[]');
  renderBacktest();
}

/* ============================================================
   15. NAV / MODAL
   ============================================================ */
function switchTab(i, el){
  document.querySelectorAll('.tab, .page').forEach(e => e.classList.remove('active'));
  if(el) el.classList.add('active');
  const page = $('page-'+i);
  if(page) page.classList.add('active');
  if(i === 3) renderAnaliz();
  if(i === 4) renderKayitliKuponlar();
  if(i === 5) renderBacktest();
}

function closeModal(id){ const el = $(id); if(el) el.classList.remove('active'); }

function showToast(type, title, msg){
  $('toastIcon').innerText = type === 'success' ? '✅' : '❌';
  $('toastTitle').innerText = title;
  $('toastMsg').innerText = msg;
  $('toastModal').classList.add('active');
}

/* ============================================================
   16. BAŞLAT
   ============================================================ */
window.onload = function(){
  initTelegram();
  loadData();
};
