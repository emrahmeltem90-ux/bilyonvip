/* ============================================================
   SKORLAB v15 · Toto + Serbest (İddaa) + Otomatik Kupon
   ============================================================ */

let matchesData = [];
let oddsData = {};
let serbestData = JSON.parse(localStorage.getItem('skorlab_serbest') || '[]');
let kayitliKuponlar = JSON.parse(localStorage.getItem('skorlab_kuponlar') || '[]');
let secimlerim = JSON.parse(localStorage.getItem('skorlab_secimlerim') || '{}');
let serbestSecimlerim = JSON.parse(localStorage.getItem('skorlab_serbest_secimlerim') || '{}');
let butce = parseFloat(localStorage.getItem('skorlab_butce') || '100');
let weekKey = 'default';

const $ = id => document.getElementById(id);

/* ==================== POISSON ==================== */
function poissonPmf(k, lambda){
  let p = Math.exp(-lambda);
  for(let i = 1; i <= k; i++) p *= lambda / i;
  return p;
}

function poissonMatris(xgEv, xgDep){
  const MAX = 6;
  let p1=0, pX=0, p2=0, kg=0, ust25=0;
  const skorlar = {};
  for(let h=0; h<MAX; h++){
    for(let a=0; a<MAX; a++){
      const p = poissonPmf(h, xgEv) * poissonPmf(a, xgDep);
      skorlar[h+'-'+a] = p;
      if(h>a) p1 += p; else if(h===a) pX += p; else p2 += p;
      if(h>=1 && a>=1) kg += p;
      if(h+a > 2.5) ust25 += p;
    }
  }
  return { p1:p1*100, pX:pX*100, p2:p2*100, kg:kg*100, ust25:ust25*100, skorlar };
}

function oranToOlasilik(o1, oX, o2){
  const r1 = 1/o1, rX = 1/oX, r2 = 1/o2;
  const t = r1 + rX + r2;
  return { p:[(r1/t)*100, (rX/t)*100, (r2/t)*100], marj: ((t-1)*100).toFixed(2) };
}

function xGTahmin(p1, pX, p2){
  const t = p1 + p2;
  const hs = p1 / (t || 1);
  const tg = 2.4 + (1 - pX/100) * 0.8;
  return { xgEv: Math.max(0.3, tg*hs*1.15), xgDep: Math.max(0.3, tg*(1-hs)) };
}

function hibritHesapla(oranP, poisson){
  const hib = {
    p1: oranP[0]*0.6 + poisson.p1*0.4,
    pX: oranP[1]*0.6 + poisson.pX*0.4,
    p2: oranP[2]*0.6 + poisson.p2*0.4
  };
  const t = hib.p1 + hib.pX + hib.p2;
  hib.p1 = (hib.p1/t)*100; hib.pX = (hib.pX/t)*100; hib.p2 = (hib.p2/t)*100;
  return hib;
}

/* ==================== ORAN BANDI ==================== */
function oranBandi(oran){
  if(oran <= 1.25) return { kod:'banko', etiket:'🔒 BANKO', seviye:1 };
  if(oran <= 1.45) return { kod:'guvenli', etiket:'✅ GÜVENLİ', seviye:2 };
  if(oran <= 1.60) return { kod:'riskli', etiket:'⚠️ RİSKLİ', seviye:3 };
  if(oran <= 2.10) return { kod:'denge', etiket:'⚡ DENGE', seviye:4 };
  return { kod:'surpriz', etiket:'🚨 SÜRPRİZ', seviye:5 };
}

/* ==================== ANALİZ ==================== */
function macAnalizEt(id, o1, oX, o2){
  if(!o1 || !oX || !o2) return null;
  o1 = parseFloat(o1); oX = parseFloat(oX); o2 = parseFloat(o2);
  const o = oranToOlasilik(o1, oX, o2);
  const xg = xGTahmin(o.p[0], o.p[1], o.p[2]);
  const poi = poissonMatris(xg.xgEv, xg.xgDep);
  const hib = hibritHesapla(o.p, poi);

  const sirali = [
    {kod:'1', olas:hib.p1}, {kod:'X', olas:hib.pX}, {kod:'2', olas:hib.p2}
  ].sort((a,b) => b.olas-a.olas);

  const enYuksek = sirali[0], ikinci = sirali[1], ucuncu = sirali[2];
  const oranlar = { '1': o1, 'X': oX, '2': o2 };
  const favOran = oranlar[enYuksek.kod];

  return {
    id,
    p1:hib.p1, pX:hib.pX, p2:hib.p2,
    oranP1:o.p[0], oranPX:o.p[1], oranP2:o.p[2], marj:parseFloat(o.marj),
    kg:poi.kg, ust25:poi.ust25, skorlar:poi.skorlar,
    xgEv:xg.xgEv, xgDep:xg.xgDep,
    sirali, enYuksek, ikinci, ucuncu,
    oranlar, favOran,
    band: oranBandi(favOran)
  };
}

/* ==================== BÜTÇE ==================== */
function butceGuncelle(val){
  butce = parseFloat(val) || 100;
  localStorage.setItem('skorlab_butce', butce);
  updateKuponCubugu();
}

/* ==================== VERİ YÜKLE ==================== */
async function loadData(){
  try{
    const res = await fetch('matches.json');
    if(!res.ok) throw new Error('HTTP '+res.status);
    const raw = await res.json();
    weekKey = (raw.week||'hafta').replace(/\s+/g,'_').toLowerCase();
    matchesData = (raw.matches||raw).map(m => ({
      id:m.id, home:m.home, away:m.away, date:m.date||'', league:m.league||'', odds:m.odds||null
    }));
    oddsData = {};
    matchesData.forEach(m => { if(m.odds) oddsData[m.id] = {...m.odds}; });
    const kayitli = JSON.parse(localStorage.getItem('skorlab_odds_'+weekKey)||'{}');
    Object.keys(kayitli).forEach(id => { oddsData[id] = {...(oddsData[id]||{}), ...kayitli[id]}; });
    $('weekTitle').innerText = raw.week || 'Bu Hafta';
  }catch(e){
    console.error('matches.json yüklenemedi:', e);
    const cached = localStorage.getItem('skorlab_last_matches');
    if(cached){
      try{ matchesData = JSON.parse(cached); $('weekTitle').innerText = 'Kaydedilmiş Bülten'; }catch(err){}
    }
  }
  if(matchesData.length){
    localStorage.setItem('skorlab_last_matches', JSON.stringify(matchesData));
  }
  renderBulten();
  renderSerbest();
  updateStats();
  updateKuponCubugu();
  updateKuponCubuguSerbest();
  renderKayitliKuponlar();
  renderKarsilastirma();
}

/* ==================== BÜLTEN ==================== */
function renderBulten(){
  if(!matchesData.length){
    $('matchesList').innerHTML = '<div class="card"><div class="muted" style="text-align:center;padding:20px">Maç yok.</div></div>';
    return;
  }

  $('matchesList').innerHTML = matchesData.map(m => {
    const od = oddsData[m.id] || {};
    const has = od['1'] && od['X'] && od['2'];
    const a = has ? macAnalizEt(m.id, od['1'], od['X'], od['2']) : null;

    const sec = secimlerim[m.id] || [];
    const sec1 = sec.includes('1');
    const secX = sec.includes('X');
    const sec2 = sec.includes('2');

    const p1 = a ? a.p1 : 0;
    const pX = a ? a.pX : 0;
    const p2 = a ? a.p2 : 0;

    let secimOzet = '';
    if(sec.length === 1) secimOzet = sec[0];
    else if(sec.length === 2) secimOzet = sec.join('');
    else if(sec.length === 3) secimOzet = 'KAPALI';

    let bandTag = '';
    if(a){
      bandTag = `<span class="badge ${a.band.seviye<=2?'green':a.band.seviye===3?'yellow':a.band.seviye===4?'orange':'red'}">${a.band.etiket}</span>`;
    }

    return `
    <div class="sade-mac">
      <div class="sade-mac-head">
        <span class="sade-mac-no">#${m.id}</span>
        <span class="sade-mac-tarih">${m.date}${m.league?' · '+m.league:''}${secimOzet?' · <b style="color:var(--green)">'+secimOzet+'</b>':''}</span>
      </div>
      <div class="sade-mac-teams" onclick="macDetayGoster(${m.id})">
        ${m.home} - ${m.away}
        ${bandTag}
      </div>
      <div class="sade-mac-tahminler">
        <button class="sade-btn ${sec1?'secili':''}" onclick="secimToggle(${m.id},'1')">
          <span class="kod">1</span>
          <span class="yuzde">%${p1.toFixed(1)}</span>
        </button>
        <button class="sade-btn ${secX?'secili':''}" onclick="secimToggle(${m.id},'X')">
          <span class="kod">X</span>
          <span class="yuzde">%${pX.toFixed(1)}</span>
        </button>
        <button class="sade-btn ${sec2?'secili':''}" onclick="secimToggle(${m.id},'2')">
          <span class="kod">2</span>
          <span class="yuzde">%${p2.toFixed(1)}</span>
        </button>
      </div>
    </div>`;
  }).join('');

  updateKuponCubugu();
}

/* ==================== SERBEST ==================== */
function renderSerbest(){
  const c = $('serbestListesi');
  if(!c) return;
  if(!serbestData.length){
    c.innerHTML = '<div class="card"><div class="muted" style="text-align:center;padding:20px">Henüz serbest maç eklemedin.<br>"➕ Maç Ekle" ile başla.</div></div>';
    $('kuponCubuguSerbest').style.display = 'none';
    return;
  }

  c.innerHTML = serbestData.map((m, idx) => {
    const a = macAnalizEt(m.id, m.o1, m.oX, m.o2);
    const sec = serbestSecimlerim[m.id] || [];
    const sec1 = sec.includes('1');
    const secX = sec.includes('X');
    const sec2 = sec.includes('2');

    const p1 = a ? a.p1 : 0;
    const pX = a ? a.pX : 0;
    const p2 = a ? a.p2 : 0;

    let secimOzet = '';
    if(sec.length === 1) secimOzet = sec[0];
    else if(sec.length === 2) secimOzet = sec.join('');
    else if(sec.length === 3) secimOzet = 'KAPALI';

    let bandTag = '';
    if(a){
      bandTag = `<span class="badge ${a.band.seviye<=2?'green':a.band.seviye===3?'yellow':a.band.seviye===4?'orange':'red'}">${a.band.etiket}</span>`;
    }

    return `
    <div class="sade-mac">
      <div class="sade-mac-head">
        <span class="sade-mac-no">İDDAA ${idx+1}</span>
        <div>
          <span class="sade-mac-tarih">${secimOzet?'<b style="color:var(--green)">'+secimOzet+'</b> · ':''}${m.tarih || ''}</span>
          <button onclick="serbestSil(${idx})" style="background:none;border:none;color:var(--red);cursor:pointer;font-size:1rem;padding:4px 8px">🗑️</button>
        </div>
      </div>
      <div class="sade-mac-teams" onclick="macDetayGosterSerbest(${m.id})">
        ${m.mac}
        ${bandTag}
      </div>
      <div class="sade-mac-tahminler">
        <button class="sade-btn ${sec1?'secili':''}" onclick="serbestSecimToggle(${m.id},'1')">
          <span class="kod">1</span>
          <span class="yuzde">%${p1.toFixed(1)}</span>
        </button>
        <button class="sade-btn ${secX?'secili':''}" onclick="serbestSecimToggle(${m.id},'X')">
          <span class="kod">X</span>
          <span class="yuzde">%${pX.toFixed(1)}</span>
        </button>
        <button class="sade-btn ${sec2?'secili':''}" onclick="serbestSecimToggle(${m.id},'2')">
          <span class="kod">2</span>
          <span class="yuzde">%${p2.toFixed(1)}</span>
        </button>
      </div>
    </div>`;
  }).join('');

  $('kuponCubuguSerbest').style.display = 'flex';
  updateKuponCubuguSerbest();
}

function openSerbestModal(){
  ['sm-match','sm-o1','sm-oX','sm-o2'].forEach(id => { const el = $(id); if(el) el.value=''; });
  $('serbestModal').classList.add('active');
}

function serbestEkle(){
  const mac = $('sm-match').value.trim();
  const o1 = parseFloat($('sm-o1').value);
  const oX = parseFloat($('sm-oX').value);
  const o2 = parseFloat($('sm-o2').value);
  if(!mac){ showToast('error','Eksik','Maç adı gir.'); return; }
  if(!o1 || !oX || !o2){ showToast('error','Eksik','1/X/2 oranlarını gir.'); return; }
  const yeni = { id: Date.now(), mac, o1, oX, o2, tarih: new Date().toLocaleString('tr-TR') };
  serbestData.unshift(yeni);
  localStorage.setItem('skorlab_serbest', JSON.stringify(serbestData));
  closeModal('serbestModal');
  renderSerbest();
  showToast('success','Maç Eklendi!',mac);
}

function serbestSil(idx){
  if(!confirm('Silinsin mi?')) return;
  const silinen = serbestData[idx];
  delete serbestSecimlerim[silinen.id];
  localStorage.setItem('skorlab_serbest_secimlerim', JSON.stringify(serbestSecimlerim));
  serbestData.splice(idx,1);
  localStorage.setItem('skorlab_serbest', JSON.stringify(serbestData));
  renderSerbest();
}

function temizleSerbest(){
  if(!confirm('Tüm serbest maçlar silinsin mi?')) return;
  serbestData = [];
  serbestSecimlerim = {};
  localStorage.removeItem('skorlab_serbest');
  localStorage.removeItem('skorlab_serbest_secimlerim');
  renderSerbest();
}

/* ==================== SEÇİM TOGGLE ==================== */
function secimToggle(id, secim){
  let sec = secimlerim[id] || [];
  if(sec.includes(secim)) sec = sec.filter(s => s !== secim);
  else sec.push(secim);
  if(sec.length === 0) delete secimlerim[id];
  else secimlerim[id] = sec;
  localStorage.setItem('skorlab_secimlerim', JSON.stringify(secimlerim));
  renderBulten();
  updateStats();
  updateKuponCubugu();
}

function serbestSecimToggle(id, secim){
  let sec = serbestSecimlerim[id] || [];
  if(sec.includes(secim)) sec = sec.filter(s => s !== secim);
  else sec.push(secim);
  if(sec.length === 0) delete serbestSecimlerim[id];
  else serbestSecimlerim[id] = sec;
  localStorage.setItem('skorlab_serbest_secimlerim', JSON.stringify(serbestSecimlerim));
  renderSerbest();
  updateKuponCubuguSerbest();
}

function tumSecimleriSil(){
  if(!confirm('Tüm seçimleri silmek istediğine emin misin?')) return;
  secimlerim = {};
  localStorage.setItem('skorlab_secimlerim', JSON.stringify(secimlerim));
  renderBulten();
  updateStats();
  updateKuponCubugu();
}

function serbestSecimleriSil(){
  if(!confirm('Tüm serbest seçimleri silinsin mi?')) return;
  serbestSecimlerim = {};
  localStorage.setItem('skorlab_serbest_secimlerim', JSON.stringify(serbestSecimlerim));
  renderSerbest();
  updateKuponCubuguSerbest();
}

/* ==================== KUPON ÇUBUĞU ==================== */
function kuponHesapla(){
  let macSayisi = 0, kolon = 1;
  Object.keys(secimlerim).forEach(id => {
    const sec = secimlerim[id];
    if(!sec || !sec.length) return;
    macSayisi++;
    kolon *= sec.length;
  });
  const tutar = kolon * 10;
  return { macSayisi, kolon, tutar, kalan: butce - tutar };
}

function kuponHesaplaSerbest(){
  let macSayisi = 0, kolon = 1;
  Object.keys(serbestSecimlerim).forEach(id => {
    const sec = serbestSecimlerim[id];
    if(!sec || !sec.length) return;
    macSayisi++;
    kolon *= sec.length;
  });
  const tutar = kolon * 10;
  return { macSayisi, kolon, tutar, kalan: butce - tutar };
}

function updateKuponCubugu(){
  const h = kuponHesapla();
  const kcM = $('kcMac'); if(kcM) kcM.innerText = h.macSayisi;
  const kcK = $('kcKolon'); if(kcK) kcK.innerText = h.kolon;
  const kcT = $('kcTutar'); if(kcT) kcT.innerText = h.tutar + ' TL';
  const kcKalan = $('kcKalan');
  if(kcKalan){
    kcKalan.innerText = h.kalan + ' TL';
    kcKalan.style.color = h.kalan < 0 ? 'var(--red)' : 'var(--green)';
  }
  const sS = $('statSecilen'); if(sS) sS.innerText = h.macSayisi;
  const sK = $('statKolon'); if(sK) sK.innerText = h.kolon;
}

function updateKuponCubuguSerbest(){
  const h = kuponHesaplaSerbest();
  const kcM = $('kcMacS'); if(kcM) kcM.innerText = h.macSayisi;
  const kcK = $('kcKolonS'); if(kcK) kcK.innerText = h.kolon;
  const kcT = $('kcTutarS'); if(kcT) kcT.innerText = h.tutar + ' TL';
}

/* ==================== İSTATİSTİK ==================== */
function updateStats(){
  const sM = $('statMac'); if(sM) sM.innerText = matchesData.length;
  let deger = 0;
  matchesData.forEach(m => {
    const od = oddsData[m.id];
    if(!od || !od['1']) return;
    const a = macAnalizEt(m.id, od['1'], od['X'], od['2']);
    if(!a) return;
    ['1','X','2'].forEach(s => {
      const oran = parseFloat(a.oranlar[s]);
      const olas = s==='1'?a.p1:s==='X'?a.pX:a.p2;
      if((olas/100)*oran > 1.12) deger++;
    });
  });
  const sD = $('statDeger'); if(sD) sD.innerText = deger;
}

/* ==================== OTOMATİK KUPON MODAL ==================== */
function otomatikKuponAc(){
  if(!matchesData.length){
    showToast('error','Maç Yok','Bülten boş.');
    return;
  }
  const maxKolon = Math.floor(butce / 10);
  if(maxKolon < 1){
    showToast('error','Bütçe Az','Bütçe en az 10 TL olmalı.');
    return;
  }

  $('secimModalBody').innerHTML = `
    <div style="font-size:.85rem">
      <div style="background:var(--bg3);border-radius:10px;padding:12px;margin-bottom:14px;text-align:center">
        <div style="color:var(--muted);font-size:.7rem">BÜTÇE</div>
        <div style="font-weight:900;font-size:1.5rem;color:var(--green);margin:4px 0">${butce} TL</div>
        <div style="color:var(--muted);font-size:.7rem">Maks. ${maxKolon} kolon</div>
      </div>

      <div style="font-weight:800;color:var(--orange);font-size:.78rem;margin-bottom:10px">NASIL KUPON İSTİYORSUN?</div>

      <button class="secim-btn teklı" onclick="kuponTekliUret(${maxKolon})">
        <div class="baslik" style="color:var(--blue)">🖐️ ${maxKolon} KOLON TEKLİ</div>
        <div class="aciklama">Her kolon farklı kombinasyon · ${maxKolon} kolon × 10 TL = ${maxKolon * 10} TL</div>
      </button>

      <button class="secim-btn sistem" onclick="kuponSistemUret(${maxKolon})">
        <div class="baslik" style="color:var(--green)">🤖 SİSTEM KOLONU</div>
        <div class="aciklama">Bankolar tek, riskliler çift · Bütçeye göre ayarlanır</div>
      </button>
    </div>
  `;
  $('secimModal').classList.add('active');
}

/* ==================== TEKLİ KOLON ÜRET ==================== */
function kuponTekliUret(maxKolon){
  const maclar = [];
  matchesData.forEach(m => {
    const od = oddsData[m.id];
    if(!od || !od['1'] || !od['X'] || !od['2']) return;
    const a = macAnalizEt(m.id, od['1'], od['X'], od['2']);
    if(!a) return;
    maclar.push({ m, a });
  });
  if(!maclar.length){
    showToast('error','Oran Yok','Hiçbir maçta oran yok.');
    return;
  }

  // Her maçta favori ile başla
  secimlerim = {};
  maclar.forEach(mc => {
    secimlerim[mc.m.id] = [mc.a.enYuksek.kod];
  });

  // Riskli maçlardan sırayla 2. seçeneği ekle
  const riskliler = maclar.filter(mc => mc.a.band.seviye >= 3).sort((x,y) => x.a.band.seviye - y.a.band.seviye);
  let kolon = 1;
  for(const mc of riskliler){
    if(kolon * 2 > maxKolon) break;
    const ikinci = mc.a.sirali[1].kod;
    secimlerim[mc.m.id] = [mc.a.enYuksek.kod, ikinci];
    kolon *= 2;
  }

  localStorage.setItem('skorlab_secimlerim', JSON.stringify(secimlerim));
  closeModal('secimModal');
  renderBulten();
  updateStats();
  updateKuponCubugu();

  const h = kuponHesapla();
  showToast('success','Tekli Kupon Oluşturuldu', `${h.macSayisi} maç · ${h.kolon} kolon · ${h.tutar} TL`);
}

/* ==================== SİSTEM KOLONU ÜRET ==================== */
function kuponSistemUret(maxKolon){
  const maclar = [];
  matchesData.forEach(m => {
    const od = oddsData[m.id];
    if(!od || !od['1'] || !od['X'] || !od['2']) return;
    const a = macAnalizEt(m.id, od['1'], od['X'], od['2']);
    if(!a) return;
    maclar.push({ m, a });
  });
  if(!maclar.length){
    showToast('error','Oran Yok','Hiçbir maçta oran yok.');
    return;
  }

  maclar.sort((x,y) => x.a.band.seviye - y.a.band.seviye);

  const secimler = maclar.map(mc => ({
    id: mc.m.id,
    band: mc.a.band,
    a: mc.a,
    secimler: [mc.a.enYuksek.kod]
  }));

  let kolon = 1;
  for(const s of secimler) kolon *= s.secimler.length;

  const eklenecekler = secimler.filter(s => s.band.seviye >= 3);
  let eklenebilir = true;
  let tur = 0;

  while(eklenebilir && tur < 5){
    eklenebilir = false;
    tur++;
    for(const s of eklenecekler){
      const mevcut = s.secimler.length;
      if(mevcut >= 3) continue;
      const aday = s.a.sirali[mevcut].kod;
      const yeniSecimler = [...s.secimler, aday];
      const yeniKolon = kolon / s.secimler.length * yeniSecimler.length;
      if(yeniKolon <= maxKolon){
        s.secimler = yeniSecimler;
        kolon = yeniKolon;
        eklenebilir = true;
      }
    }
    if(!eklenebilir){
      for(const s of secimler){
        if(s.secimler.length >= 2) continue;
        if(s.band.seviye < 2) continue;
        const aday = s.a.sirali[1].kod;
        const yeniSecimler = [...s.secimler, aday];
        const yeniKolon = kolon / s.secimler.length * yeniSecimler.length;
        if(yeniKolon <= maxKolon){
          s.secimler = yeniSecimler;
          kolon = yeniKolon;
          eklenebilir = true;
          break;
        }
      }
    }
  }

  secimlerim = {};
  secimler.forEach(s => {
    if(s.secimler.length > 0) secimlerim[s.id] = s.secimler;
  });

  localStorage.setItem('skorlab_secimlerim', JSON.stringify(secimlerim));
  closeModal('secimModal');
  renderBulten();
  updateStats();
  updateKuponCubugu();

  const h = kuponHesapla();
  showToast('success','Sistem Kuponu Oluşturuldu', `${h.macSayisi} maç · ${h.kolon} kolon · ${h.tutar} TL`);
}

/* ==================== KUPONU KAYDET ==================== */
function kuponuKaydet(tip){
  const h = tip === 'iddaa' ? kuponHesaplaSerbest() : kuponHesapla();
  const kaynak = tip === 'iddaa' ? serbestSecimlerim : secimlerim;

  if(h.macSayisi === 0){
    showToast('error','Seçim Yok','Hiç maç seçmedin.');
    return;
  }

  const detaylar = [];
  Object.keys(kaynak).forEach(id => {
    const sec = kaynak[id];
    if(!sec || !sec.length) return;

    let m, a, isim;
    if(tip === 'iddaa'){
      m = serbestData.find(x => x.id == id);
      if(!m) return;
      isim = m.mac;
      a = macAnalizEt(id, m.o1, m.oX, m.o2);
    } else {
      m = matchesData.find(x => x.id == id);
      if(!m) return;
      isim = m.home + ' - ' + m.away;
      const od = oddsData[id] || {};
      a = macAnalizEt(id, od['1'], od['X'], od['2']);
    }

    detaylar.push({
      id: parseInt(id),
      isim: isim,
      secim: sec.join(''),
      secimler: sec,
      band: a ? a.band.etiket : ''
    });
  });

  const yeni = {
    id: Date.now(),
    tip: tip,
    tarih: new Date().toLocaleString('tr-TR'),
    macSayisi: h.macSayisi,
    kolon: h.kolon,
    tutar: h.tutar,
    detaylar: detaylar,
    durum: 'bekliyor'
  };

  kayitliKuponlar.unshift(yeni);
  if(kayitliKuponlar.length > 50) kayitliKuponlar = kayitliKuponlar.slice(0, 50);
  localStorage.setItem('skorlab_kuponlar', JSON.stringify(kayitliKuponlar));

  if(tip === 'iddaa'){
    serbestSecimlerim = {};
    localStorage.setItem('skorlab_serbest_secimlerim', JSON.stringify(serbestSecimlerim));
    renderSerbest();
    updateKuponCubuguSerbest();
  } else {
    secimlerim = {};
    localStorage.setItem('skorlab_secimlerim', JSON.stringify(secimlerim));
    renderBulten();
    updateStats();
    updateKuponCubugu();
  }

  renderKayitliKuponlar();
  renderKarsilastirma();

  showToast('success','Kupon Kaydedildi!', h.macSayisi + ' maç · ' + h.kolon + ' kolon · ' + h.tutar + ' TL');
}

/* ==================== KUPONLARIM ==================== */
function renderKayitliKuponlar(){
  const c = $('kayitliKuponlar');
  if(!c) return;
  if(!kayitliKuponlar.length){
    c.innerHTML = '<div class="muted" style="text-align:center;padding:20px">Henüz kayıtlı kupon yok.</div>';
    return;
  }
  c.innerHTML = kayitliKuponlar.map(k => {
    const renk = k.durum === 'kazandi' ? 'kazandi' : k.durum === 'kaybetti' ? 'kaybetti' : 'bekliyor';
    const emoji = k.durum === 'kazandi' ? '✅' : k.durum === 'kaybetti' ? '❌' : '⏳';
    const tipIkon = k.tip === 'iddaa' ? '🎯' : '📋';
    return `
      <div class="kupon-gecmis ${renk}" onclick="kuponDetayAc(${k.id})" style="cursor:pointer">
        <div style="display:flex;justify-content:space-between;font-size:.75rem;margin-bottom:4px">
          <span>${emoji} ${tipIkon} <b>${k.macSayisi} maç</b> · ${k.kolon} kolon</span>
          <span class="muted">${k.tarih}</span>
        </div>
        <div style="font-size:.68rem;color:var(--muted)">Tutar: <b style="color:var(--green)">${k.tutar} TL</b></div>
      </div>`;
  }).join('');
}

function kuponDetayAc(id){
  const k = kayitliKuponlar.find(x => x.id === id);
  if(!k) return;
  const emoji = k.durum === 'kazandi' ? '✅' : k.durum === 'kaybetti' ? '❌' : '⏳';
  const tipIkon = k.tip === 'iddaa' ? '🎯 İddaa' : '📋 Toto';

  $('kuponDetayBody').innerHTML = `
    <div style="font-size:.75rem">
      <div class="muted" style="margin-bottom:10px">${emoji} ${tipIkon} · ${k.tarih} · ${k.macSayisi} maç · ${k.kolon} kolon · ${k.tutar} TL</div>

      <div style="max-height:400px;overflow-y:auto;background:var(--bg3);border-radius:8px;padding:10px">
        ${k.detaylar.map((d,i) => `
          <div style="padding:8px 0;border-bottom:1px solid var(--border);font-size:.72rem">
            <div style="font-weight:800;margin-bottom:4px">${d.isim}</div>
            <div style="display:flex;justify-content:space-between;color:var(--muted)">
              <span>${d.band}</span>
              <span style="color:var(--green);font-weight:900">${d.secim}</span>
            </div>
          </div>
        `).join('')}
      </div>

      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:6px;margin-top:12px">
        <button class="btn ${k.durum==='kazandi'?'btn-green':'btn-gray'}" onclick="kuponDurum(${id},'kazandi')">✅ Kazandı</button>
        <button class="btn ${k.durum==='bekliyor'?'btn-orange':'btn-gray'}" onclick="kuponDurum(${id},'bekliyor')">⏳ Bekliyor</button>
        <button class="btn ${k.durum==='kaybetti'?'btn-red':'btn-gray'}" onclick="kuponDurum(${id},'kaybetti')">❌ Kaybetti</button>
      </div>
      <button class="btn btn-red btn-lg" onclick="kuponSil(${id})" style="margin-top:10px">🗑️ Sil</button>
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
  renderKarsilastirma();
}

function kuponSil(id){
  kayitliKuponlar = kayitliKuponlar.filter(x => x.id !== id);
  localStorage.setItem('skorlab_kuponlar', JSON.stringify(kayitliKuponlar));
  closeModal('kuponDetayModal');
  renderKayitliKuponlar();
  renderKarsilastirma();
}

/* ==================== KARŞILAŞTIRMA ==================== */
function renderKarsilastirma(){
  const c = $('karsilastirmaListesi');
  if(!c) return;

  let kazanan = 0, kaybeden = 0;
  kayitliKuponlar.forEach(k => {
    if(k.durum === 'kazandi') kazanan++;
    else if(k.durum === 'kaybetti') kaybeden++;
  });

  const toplam = kazanan + kaybeden;
  if(toplam === 0){
    c.innerHTML = '<div class="muted" style="text-align:center;padding:20px">Henüz sonuç girilmedi.</div>';
    return;
  }

  const basari = Math.round(kazanan / toplam * 100);
  c.innerHTML = `
    <div class="karsilastirma-grid">
      <div class="karsilastirma-taraf kazanan">
        <div class="lbl">✅ KAZANAN</div>
        <div class="skor" style="color:var(--green)">${kazanan}</div>
      </div>
      <div class="karsilastirma-taraf">
        <div class="lbl">❌ KAYBEDEN</div>
        <div class="skor" style="color:var(--red)">${kaybeden}</div>
      </div>
    </div>
    <div class="karsilastirma-mesaj ${basari>=50?'sen-kazandin':'sistem-kazandi'}" style="margin-top:12px">
      Başarı oranı: %${basari}
    </div>
    <div class="muted" style="text-align:center;margin-top:12px;font-size:.7rem">
      Toplam ${kayitliKuponlar.length} kayıtlı kupon
    </div>
  `;
}

/* ==================== MAÇ DETAY ==================== */
function macDetayGoster(id){
  const m = matchesData.find(x => x.id === id);
  if(!m) return;
  const od = oddsData[id];
  if(!od || !od['1'] || !od['X'] || !od['2']){
    showToast('error','Oran Yok','Bu maça oran girilmemiş.');
    return;
  }
  macDetayGosterOrtak(id, m.home+' - '+m.away, m.date, m.league, od['1'], od['X'], od['2'], 'toto');
}

function macDetayGosterSerbest(id){
  const m = serbestData.find(x => x.id === id);
  if(!m) return;
  macDetayGosterOrtak(id, m.mac, m.tarih, '', m.o1, m.oX, m.o2, 'iddaa');
}

function macDetayGosterOrtak(id, isim, tarih, league, o1, oX, o2, tip){
  const a = macAnalizEt(id, o1, oX, o2);
  const sec = tip === 'iddaa' ? (serbestSecimlerim[id] || []) : (secimlerim[id] || []);

  const skorSirali = Object.entries(a.skorlar).sort((x,y) => y[1]-x[1]).slice(0,5);
  const skorHTML = skorSirali.map(([k,v]) =>
    `<div style="display:flex;justify-content:space-between;font-size:.72rem;padding:2px 0"><span>${k}</span><span class="green">%${(v*100).toFixed(2)}</span></div>`
  ).join('');

  $('macDetayTitle').innerText = '📊 ' + (tip === 'iddaa' ? 'İDDAA' : 'MAÇ #' + id);
  $('macDetayBody').innerHTML = `
    <div style="font-size:.8rem;line-height:1.8">
      <div style="text-align:center;margin-bottom:14px">
        <div style="font-weight:900;font-size:1rem">${isim}</div>
        <div style="color:var(--muted);font-size:.7rem;margin-top:4px">${tarih}${league?' · '+league:''}</div>
        <div style="margin-top:8px">
          <span class="badge ${a.band.seviye<=2?'green':a.band.seviye===3?'yellow':a.band.seviye===4?'orange':'red'}">${a.band.etiket}</span>
        </div>
      </div>

      <div class="analiz-box">
        <div class="analiz-row"><span class="analiz-lbl">📊 ORANLAR</span></div>
        <div class="analiz-row"><span>1: <b>${o1}</b></span><span>X: <b>${oX}</b></span><span>2: <b>${o2}</b></span></div>
        <div class="analiz-row"><span class="muted">Marj: %${a.marj}</span></div>
      </div>

      <div class="analiz-box">
        <div class="analiz-row"><span class="analiz-lbl">🎯 HİBRİT OLASILIK</span></div>
        <div class="analiz-row"><span>1: <b class="green">%${a.p1.toFixed(1)}</b></span><span>X: <b class="green">%${a.pX.toFixed(1)}</b></span><span>2: <b class="green">%${a.p2.toFixed(1)}</b></span></div>
      </div>

      <div class="analiz-box">
        <div class="analiz-row"><span class="analiz-lbl">⚽ POISSON SKOR (İlk 5)</span></div>
        <div class="analiz-row"><span class="muted">xG: ${a.xgEv.toFixed(2)} - ${a.xgDep.toFixed(2)}</span></div>
        ${skorHTML}
      </div>

      <div style="margin-top:16px;padding:12px;background:var(--bg3);border-radius:10px">
        <div style="font-weight:900;color:var(--green);font-size:.8rem;margin-bottom:10px">🖐️ SENİN SEÇİMİN</div>
        <div class="sade-mac-tahminler">
          <button class="sade-btn ${sec.includes('1')?'secili':''}" onclick="detaySecimToggle('${tip}',${id},'1')">1</button>
          <button class="sade-btn ${sec.includes('X')?'secili':''}" onclick="detaySecimToggle('${tip}',${id},'X')">X</button>
          <button class="sade-btn ${sec.includes('2')?'secili':''}" onclick="detaySecimToggle('${tip}',${id},'2')">2</button>
        </div>
      </div>
    </div>
  `;
  $('macDetayModal').classList.add('active');
}

function detaySecimToggle(tip, id, secim){
  if(tip === 'iddaa'){
    serbestSecimToggle(id, secim);
    macDetayGosterSerbest(id);
  } else {
    secimToggle(id, secim);
    macDetayGoster(id);
  }
}

/* ==================== NAV / MODAL ==================== */
function switchTab(i, el){
  document.querySelectorAll('.tab, .page').forEach(e => e.classList.remove('active'));
  if(el) el.classList.add('active');
  $('page-'+i).classList.add('active');
  if(i === 4) renderKarsilastirma();
}

function closeModal(id){ $(id).classList.remove('active'); }
function showToast(type, title, msg){
  $('toastIcon').innerText = type==='success' ? '✅' : '❌';
  $('toastTitle').innerText = title;
  $('toastMsg').innerText = msg;
  $('toastModal').classList.add('active');
}

/* PWA */
if('serviceWorker' in navigator){
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(e => console.warn('PWA:', e));
  });
}

/* BAŞLAT */
window.onload = function(){
  $('butceInput').value = butce;
  loadData();
};
