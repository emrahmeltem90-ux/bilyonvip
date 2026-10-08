/* ============================================================
   SKORLAB v8 · ANALİZ MOTORU + DETERMINISTIK KUPON
   Hamming mesafesi + Poisson value bet + week-key storage
   ============================================================ */

let matchesData = [];
let oddsData = {};
let serbestData = JSON.parse(localStorage.getItem('skorlab_serbest') || '[]');
let archiveData = { weeks: [] };
let riskMode = 'dengeli';
let kuponKaynak = 'toto';
let manuelSecimler = {};
let weekKey = 'default';

const $ = id => document.getElementById(id);

/* ============ ODDS CALCULATOR ============ */
function oranToOlasilik(o1, oX, o2){
  const r1 = 1/o1, rX = 1/oX, r2 = 1/o2;
  const toplam = r1 + rX + r2;
  return {
    p: [(r1/toplam)*100, (rX/toplam)*100, (r2/toplam)*100],
    marj: ((toplam-1)*100).toFixed(2)
  };
}

/* ============ POISSON PMF ============ */
function poissonPmf(k, lambda){
  let p = Math.exp(-lambda);
  for(let i = 1; i <= k; i++) p *= lambda / i;
  return p;
}

/* ============ MAÇIN TOPLAM GOL BEKLENTİSİ ============ */
function toplamGolBeklentisi(analiz){
  if(!analiz) return 2.5;
  const pX = analiz.pX / 100;
  const toplamGol = 2.4 + (1 - pX) * 0.8;
  return Math.max(1.5, Math.min(4.5, toplamGol));
}

/* ============ KG VAR BEKLENEN OLASILIK ============ */
function kgVarBeklenen(analiz){
  if(!analiz) return 50;
  const toplamGol = toplamGolBeklentisi(analiz);
  const xgEv = toplamGol * 0.55;
  const xgDep = toplamGol * 0.45;
  let pKG = 0;
  for(let h = 0; h <= 8; h++){
    for(let a = 0; a <= 8; a++){
      const ph = poissonPmf(h, xgEv);
      const pa = poissonPmf(a, xgDep);
      if(h >= 1 && a >= 1) pKG += ph * pa;
    }
  }
  return pKG * 100;
}

/* ============ 2.5 ÜST BEKLENEN OLASILIK ============ */
function ust25Beklenen(analiz){
  if(!analiz) return 50;
  const toplamGol = toplamGolBeklentisi(analiz);
  const xgEv = toplamGol * 0.55;
  const xgDep = toplamGol * 0.45;
  let pUst = 0;
  for(let h = 0; h <= 8; h++){
    for(let a = 0; a <= 8; a++){
      const ph = poissonPmf(h, xgEv);
      const pa = poissonPmf(a, xgDep);
      if(h + a > 2.5) pUst += ph * pa;
    }
  }
  return pUst * 100;
}

/* ============ DEĞER BAHİS ============ */
function degerVarMi(bahisAdi, gercekOran, beklenenOlas){
  if(!gercekOran || gercekOran <= 1) return { var: false, fark: 0 };
  const bahisciOlas = 100 / gercekOran;
  const fark = beklenenOlas - bahisciOlas;
  return { var: fark > 5, fark: fark.toFixed(1) };
}

/* ============ MATCH ANALYZER ============ */
function macAnalizEt(id, o1, oX, o2){
  if(!o1 || !oX || !o2) return null;
  const o = oranToOlasilik(parseFloat(o1), parseFloat(oX), parseFloat(o2));
  const p1 = o.p[0], pX = o.p[1], p2 = o.p[2];
  const sirali = [
    {kod:'1', olas:p1},
    {kod:'X', olas:pX},
    {kod:'2', olas:p2}
  ].sort((a,b) => b.olas - a.olas);
  const enYuksek = sirali[0];
  const ikinci = sirali[1];
  const ucuncu = sirali[2];
  const fark = enYuksek.olas - ikinci.olas;
  
  const favoriTuzagi = 100 - enYuksek.olas;
  let kazanamaRiski = 0;
  if(enYuksek.kod === '1') kazanamaRiski = pX + p2;
  else if(enYuksek.kod === '2') kazanamaRiski = p1 + pX;
  else kazanamaRiski = p1 + p2;
  const surprizOlas = ucuncu.olas;
  const rakipOlas = ikinci.olas;
  
  return {
    id: id, p1: p1, pX: pX, p2: p2,
    marj: parseFloat(o.marj),
    sirali: sirali, enYuksek: enYuksek, ikinci: ikinci, ucuncu: ucuncu, fark: fark,
    favoriTuzagi: favoriTuzagi,
    kazanamaRiski: kazanamaRiski,
    surprizOlas: surprizOlas,
    rakipOlas: rakipOlas,
    favSinif: favGuvenSinifi(enYuksek.olas),
    beraberlikSinif: beraberlikSinifi(pX),
    tuzakSinif: favoriTuzagiSinifi(enYuksek.olas),
    surprizSinif: surprizSinifi(rakipOlas),
    macSinif: macSinifi({enYuksek, pX, fark, ucuncu})
  };
}

/* ============ ENTROPY ============ */
function entropyHesapla(analiz){
  if(!analiz) return 0;
  const p1 = analiz.p1 / 100, pX = analiz.pX / 100, p2 = analiz.p2 / 100;
  let H = 0;
  if(p1 > 0) H -= p1 * Math.log2(p1);
  if(pX > 0) H -= pX * Math.log2(pX);
  if(p2 > 0) H -= p2 * Math.log2(p2);
  return H / 1.585;
}

/* ============ BANKO KALİTE ============ */
function bankoKalite(analiz){
  if(!analiz) return 0;
  const fav = analiz.enYuksek.olas, fark = analiz.fark, ent = entropyHesapla(analiz);
  let favPuan = Math.max(0, Math.min(50, (fav - 40) * (50 / 45)));
  let farkPuan = Math.max(0, Math.min(30, fark * (30 / 40)));
  let entPuan = Math.max(0, (1 - ent) * 20);
  return Math.round(favPuan + farkPuan + entPuan);
}

/* ============ SINIFLANDIRMA ============ */
function favGuvenSinifi(favOlas){
  if(favOlas >= 70) return 'ÇOK GÜÇLÜ FAVORİ';
  if(favOlas >= 60) return 'GÜÇLÜ FAVORİ';
  if(favOlas >= 52) return 'ORTA FAVORİ';
  if(favOlas >= 45) return 'RİSKLİ FAVORİ';
  return 'NET FAVORİ DEĞİL';
}

function beraberlikSinifi(px){
  if(px >= 30) return 'ÇOK YÜKSEK';
  if(px >= 25) return 'YÜKSEK';
  if(px >= 20) return 'ORTA';
  if(px >= 15) return 'DÜŞÜK';
  return 'ÇOK DÜŞÜK';
}

function favoriTuzagiSinifi(favOlas){
  const risk = 100 - favOlas;
  if(risk >= 50) return 'ÇOK YÜKSEK';
  if(risk >= 40) return 'YÜKSEK';
  if(risk >= 30) return 'ORTA';
  if(risk >= 20) return 'DÜŞÜK';
  return 'ÇOK DÜŞÜK';
}

function surprizSinifi(rakipOlas){
  if(rakipOlas >= 25) return 'GÜÇLÜ SÜRPRİZ ADAYI';
  if(rakipOlas >= 20) return 'ORTA SÜRPRİZ ADAYI';
  if(rakipOlas >= 15) return 'DÜŞÜK SÜRPRİZ';
  return 'ZAYIF SÜRPRİZ';
}

function macSinifi(analiz){
  if(!analiz) return 'BELİRSİZ';
  const fav = analiz.enYuksek.olas;
  const tuzak = 100 - fav;
  const px = analiz.pX;
  
  if(fav >= 65 && tuzak <= 35 && px <= 25) return 'BANKO ADAYI';
  if(fav >= 52 && fav < 65) return 'RİSKLİ FAVORİ';
  if(tuzak > 35 && fav >= 45) return 'RİSKLİ FAVORİ';
  if(px >= 25 && Math.abs(analiz.enYuksek.olas - px) < 10) return 'BERABERLİK ADAYI';
  const rakip = analiz.ucuncu ? analiz.ucuncu.olas : 0;
  if(rakip >= 18 && analiz.fark < 15) return 'SÜRPRİZ ADAYI';
  if(fav < 45) return 'DENGELİ MAÇ';
  return 'NORMAL';
}

/* ============ KAPSAMA ============ */
function kapsamaHesapla(analiz, kolonSayisi){
  if(!analiz) return { '1': 0, 'X': 0, '2': 0 };
  const sinif = macSinifi(analiz);
  const p1 = analiz.p1, pX = analiz.pX, p2 = analiz.p2;
  let dagilim = {};
  
  if(sinif === 'BANKO ADAYI'){
    dagilim = { [analiz.enYuksek.kod]: kolonSayisi };
  }
  else if(sinif === 'RİSKLİ FAVORİ'){
    const ana = Math.round(kolonSayisi * 0.7);
    dagilim = { [analiz.enYuksek.kod]: ana, [analiz.ikinci.kod]: kolonSayisi - ana };
  }
  else if(sinif === 'BERABERLİK ADAYI'){
    const ana = Math.round(kolonSayisi * 0.5);
    const xK = Math.round(kolonSayisi * 0.35);
    dagilim = { [analiz.enYuksek.kod]: ana, 'X': xK };
    const kalan = kolonSayisi - ana - xK;
    if(kalan > 0) dagilim[analiz.ucuncu.kod] = kalan;
  }
  else if(sinif === 'SÜRPRİZ ADAYI'){
    const ana = Math.round(kolonSayisi * 0.45);
    const ik = Math.round(kolonSayisi * 0.35);
    dagilim = { [analiz.enYuksek.kod]: ana, [analiz.ikinci.kod]: ik };
    dagilim[analiz.ucuncu.kod] = kolonSayisi - ana - ik;
  }
  else if(sinif === 'DENGELİ MAÇ'){
    const toplam = p1 + pX + p2;
    const k1 = Math.round(kolonSayisi * (p1 / toplam));
    const kX = Math.round(kolonSayisi * (pX / toplam));
    dagilim = { '1': k1, 'X': kX, '2': kolonSayisi - k1 - kX };
  }
  else {
    const kalite = bankoKalite(analiz);
    if(kalite >= 75){
      dagilim = { [analiz.enYuksek.kod]: kolonSayisi };
    }
    else if(kalite >= 55){
      const ana = Math.round(kolonSayisi * 0.8);
      dagilim = { [analiz.enYuksek.kod]: ana, [analiz.ikinci.kod]: kolonSayisi - ana };
    }
    else if(kalite >= 35){
      const oran1 = p1 / 100, oranX = pX / 100, oran2 = p2 / 100;
      const s = [{kod:'1', w:oran1}, {kod:'X', w:oranX}, {kod:'2', w:oran2}].sort((a,b) => b.w - a.w);
      const ilkIki = s[0].w + s[1].w;
      const k1 = Math.round(kolonSayisi * (s[0].w / ilkIki));
      dagilim = { [s[0].kod]: k1, [s[1].kod]: kolonSayisi - k1 };
    }
    else {
      const toplam = p1 + pX + p2;
      const k1 = Math.round(kolonSayisi * (p1 / toplam));
      const kX = Math.round(kolonSayisi * (pX / toplam));
      dagilim = { '1': k1, 'X': kX, '2': kolonSayisi - k1 - kX };
    }
  }
  return dagilim;
}

/* ============ ETKİN KAPSAMA ============ */
function etkinKapsama(kolonlar){
  if(!kolonlar || kolonlar.length < 2) return 100;
  let toplam = 0, say = 0;
  for(let i = 0; i < kolonlar.length; i++){
    for(let j = i + 1; j < kolonlar.length; j++){
      let ayni = 0;
      for(let k = 0; k < kolonlar[i].picks.length; k++){
        if(kolonlar[i].picks[k] === kolonlar[j].picks[k]) ayni++;
      }
      toplam += ayni / kolonlar[i].picks.length;
      say++;
    }
  }
  return Math.round((1 - toplam / say) * 100);
}

/* ============ PREDICTION ENGINE ============ */
function tahminUret(analiz){
  if(!analiz) return null;
  const { enYuksek, ikinci, ucuncu, fark } = analiz;
  const ent = entropyHesapla(analiz);
  const kalite = bankoKalite(analiz);
  const sinif = macSinifi(analiz);
  
  let karar = '', guven = 0, risk = '';
  
  if(sinif === 'BANKO ADAYI'){
    karar = 'BANKO ' + enYuksek.kod;
    guven = Math.min(100, Math.round(enYuksek.olas + 8));
    risk = 'Çok Düşük';
  }
  else if(sinif === 'RİSKLİ FAVORİ'){
    karar = 'BANKO ' + enYuksek.kod;
    guven = Math.round(enYuksek.olas);
    risk = 'Orta';
  }
  else if(sinif === 'BERABERLİK ADAYI'){
    karar = 'ÇİFT ' + siraliAlternatif(enYuksek.kod, 'X');
    guven = Math.round(enYuksek.olas);
    risk = 'Orta-Yüksek';
  }
  else if(sinif === 'SÜRPRİZ ADAYI'){
    karar = 'ÇİFT ' + siraliAlternatif(enYuksek.kod, ikinci.kod);
    guven = Math.round(enYuksek.olas);
    risk = 'Yüksek';
  }
  else if(sinif === 'DENGELİ MAÇ'){
    karar = 'ÜÇLÜ 1X2';
    guven = Math.max(30, Math.round(enYuksek.olas - 5));
    risk = 'Çok Yüksek';
  }
  else {
    if(kalite >= 75 && enYuksek.olas >= 65){
      karar = 'BANKO ' + enYuksek.kod;
      guven = Math.min(100, enYuksek.olas + 6);
      risk = 'Çok Düşük';
    }
    else if(kalite >= 55 && enYuksek.olas >= 55){
      karar = 'BANKO ' + enYuksek.kod;
      guven = Math.min(100, enYuksek.olas + 3);
      risk = 'Düşük';
    }
    else if(kalite >= 35 && enYuksek.olas >= 42){
      karar = 'ÇİFT ' + siraliAlternatif(enYuksek.kod, ikinci.kod);
      guven = enYuksek.olas;
      risk = 'Orta';
    }
    else{
      karar = 'ÇİFT ' + siraliAlternatif(enYuksek.kod, ikinci.kod);
      guven = enYuksek.olas - 3;
      risk = 'Yüksek';
    }
  }
  
  const alternatif = karar.includes('BANKO') ? siraliAlternatif(enYuksek.kod, ikinci.kod) : karar.replace('ÇİFT ', '');
  const surpriz = ucuncu.kod;
  
  return {
    ana_tahmin: enYuksek.kod,
    alternatif: alternatif,
    surpriz: surpriz,
    guven: Math.round(guven),
    risk: risk,
    karar: karar,
    favori_farki: Math.round(fark),
    entropy: Math.round(ent * 100),
    kalite: kalite,
    macSinif: sinif,
    favSinif: analiz.favSinif,
    beraberlikSinif: analiz.beraberlikSinif,
    tuzakSinif: analiz.tuzakSinif,
    surprizSinif: analiz.surprizSinif,
    favoriTuzagi: Math.round(analiz.favoriTuzagi),
    kazanamaRiski: Math.round(analiz.kazanamaRiski),
    surprizOlas: analiz.surprizOlas
  };
}

function siraliAlternatif(a, b){
  const sıra = {'1':1, 'X':2, '2':3};
  return (sıra[a] < sıra[b] ? a : b) + (sıra[a] < sıra[b] ? b : a);
}

/* ============ VERİ YÜKLE ============ */
async function loadData(){
  try{
    const res = await fetch('matches.json');
    if(!res.ok) throw new Error('Bülten HTTP ' + res.status);
    const raw = await res.json();
    
    // Week key oluştur
    weekKey = (raw.week || 'hafta').replace(/\s+/g, '_').toLowerCase();
    window.weekKey = weekKey;
    
    matchesData = (raw.matches || raw).map(m => ({
      id: m.id, home: m.home, away: m.away,
      date: m.date || '', league: m.league || '',
      odds: m.odds || null
    }));
    
    oddsData = {};
    matchesData.forEach(m => { if(m.odds) oddsData[m.id] = {...m.odds}; });
    
    const kayitli = JSON.parse(localStorage.getItem('skorlab_odds_' + weekKey) || '{}');
    Object.keys(kayitli).forEach(id => {
      oddsData[id] = {...(oddsData[id] || {}), ...kayitli[id]};
    });
    
    $('weekTitle').innerText = raw.week || 'Bu Hafta';
    renderBulten();
    renderSerbest();
    updateStats();
    updateKolon();
  }catch(e){
    console.error('loadData hatası:', e);
    const titleEl = $('weekTitle');
    if(titleEl) titleEl.innerText = 'Bülten Yüklenemedi';
    showToast('error', 'Bağlantı Hatası', 'Bülten verisi çekilemedi. Lütfen sayfayı yenileyin.');
  }
  loadArchive();
}

async function loadArchive(){
  try{
    const res = await fetch('archive.json');
    if(!res.ok) throw new Error('Arşiv yüklenemedi');
    archiveData = await res.json();
  }catch(e){ archiveData = { weeks: [] }; }
  renderArsiv();
}

/* ============ BÜLTEN ============ */
function renderBulten(){
  $('matchesList').innerHTML = matchesData.map((m,i) => {
    const od = oddsData[m.id] || {};
    const hasOdds = od['1'] && od['X'] && od['2'];
    const analiz = hasOdds ? macAnalizEt(m.id, od['1'], od['X'], od['2']) : null;
    const tahmin = analiz ? tahminUret(analiz) : null;
    let badgeHTML = '';
    if(tahmin){
      const manuel = manuelSecimler['toto-'+m.id];
      const karar = manuel ? 'MANUEL ' + manuel : tahmin.karar;
      const cls = karar.includes('BANKO') ? 'green' : karar.includes('ÇİFT') ? 'yellow' : karar.includes('ÜÇLÜ') ? 'red' : 'purple';
      badgeHTML = `<span class="badge ${cls}">${karar}</span>`;
    }
    return `
    <div class="match" onclick="macDetayGoster('toto',${m.id})">
      <div class="match-head"><span>${m.date}</span><span class="mid">MAÇ #${m.id}</span></div>
      <div class="teams">${m.home} - ${m.away}${badgeHTML}${m.league ? '<span class="league-tag">'+m.league+'</span>' : ''}</div>
      <div class="oran-input-grid" onclick="event.stopPropagation()">
        <div class="oran-input-item"><label>1</label><input type="number" step="0.01" placeholder="1.00" value="${od['1']||''}" oninput="oranGuncelle(${m.id},'1',this.value)"></div>
        <div class="oran-input-item"><label>X</label><input type="number" step="0.01" placeholder="1.00" value="${od['X']||''}" oninput="oranGuncelle(${m.id},'X',this.value)"></div>
        <div class="oran-input-item"><label>2</label><input type="number" step="0.01" placeholder="1.00" value="${od['2']||''}" oninput="oranGuncelle(${m.id},'2',this.value)"></div>
      </div>
      ${hasOdds ? `
      <div class="oran-grid-bulten">
        <div class="oran-box-bulten"><div class="lbl">1</div><div class="val">${parseFloat(od['1']).toFixed(2)}</div><div class="pct">%${analiz.p1.toFixed(1)}</div></div>
        <div class="oran-box-bulten"><div class="lbl">X</div><div class="val">${parseFloat(od['X']).toFixed(2)}</div><div class="pct">%${analiz.pX.toFixed(1)}</div></div>
        <div class="oran-box-bulten"><div class="lbl">2</div><div class="val">${parseFloat(od['2']).toFixed(2)}</div><div class="pct">%${analiz.p2.toFixed(1)}</div></div>
      </div>
      <div style="display:flex;gap:6px;margin-top:8px;flex-wrap:wrap;font-size:.62rem">
        <span style="background:rgba(255,176,32,.1);color:var(--orange);padding:3px 8px;border-radius:6px;font-weight:800">ENT: ${tahmin.entropy}/100</span>
        <span style="background:rgba(61,139,255,.1);color:var(--blue);padding:3px 8px;border-radius:6px;font-weight:800">KAL: ${tahmin.kalite}/100</span>
        <span style="background:rgba(255,77,94,.1);color:var(--red);padding:3px 8px;border-radius:6px;font-weight:800">TUZAK: ${tahmin.favoriTuzagi}%</span>
      </div>` : ''}
    </div>`;
  }).join('');
}

function oranGuncelle(matchId, alan, deger){
  if(!oddsData[matchId]) oddsData[matchId] = {};
  if(deger === '' || deger === null) delete oddsData[matchId][alan];
  else oddsData[matchId][alan] = parseFloat(deger);
  localStorage.setItem('skorlab_odds_' + weekKey, JSON.stringify(oddsData));
  renderBulten();
  renderTahminListesi();
  updateStats();
}

/* ============ SERBEST ============ */
function openSerbestModal(){
  ['sm-match','sm-o1','sm-oX','sm-o2','sm-kgvar','sm-kgyok',
   'sm-u15alt','sm-u15ust','sm-u25alt','sm-u25ust',
   'sm-u35alt','sm-u35ust','sm-kgu'].forEach(id => {
    const el = $(id); if(el) el.value = '';
  });
  $('serbestModal').classList.add('active');
}

function serbestEkle(){
  const mac = $('sm-match').value.trim();
  const o1 = parseFloat($('sm-o1').value);
  const oX = parseFloat($('sm-oX').value);
  const o2 = parseFloat($('sm-o2').value);
  if(!mac){ showToast('error','Eksik','Maç adını gir.'); return; }
  if(!o1 || !oX || !o2){ showToast('error','Eksik','1/X/2 oranlarını gir.'); return; }
  const yeni = {
    id: Date.now(),
    mac: mac, o1: o1, oX: oX, o2: o2,
    kgvar: $('sm-kgvar').value ? parseFloat($('sm-kgvar').value) : null,
    kgyok: $('sm-kgyok').value ? parseFloat($('sm-kgyok').value) : null,
    u15alt: $('sm-u15alt').value ? parseFloat($('sm-u15alt').value) : null,
    u15ust: $('sm-u15ust').value ? parseFloat($('sm-u15ust').value) : null,
    u25alt: $('sm-u25alt').value ? parseFloat($('sm-u25alt').value) : null,
    u25ust: $('sm-u25ust').value ? parseFloat($('sm-u25ust').value) : null,
    u35alt: $('sm-u35alt').value ? parseFloat($('sm-u35alt').value) : null,
    u35ust: $('sm-u35ust').value ? parseFloat($('sm-u35ust').value) : null,
    kgu: $('sm-kgu').value ? parseFloat($('sm-kgu').value) : null,
    tarih: new Date().toLocaleString('tr-TR')
  };
  serbestData.unshift(yeni);
  localStorage.setItem('skorlab_serbest', JSON.stringify(serbestData));
  closeModal('serbestModal');
  renderSerbest();
  updateStats();
  showToast('success', 'Maç Eklendi!', mac + ' eklendi.');
}

function renderSerbest(){
  const container = $('serbestListesi');
  if(!container) return;
  if(!serbestData.length){
    container.innerHTML = '<div class="card"><div class="muted" style="text-align:center;padding:20px">Henüz serbest maç eklemedin.<br><br>📌 "➕ Maç Ekle" ile istediğin maçı ekle.</div></div>';
    return;
  }
  container.innerHTML = serbestData.map((m, idx) => {
    const analiz = macAnalizEt(m.id, m.o1, m.oX, m.o2);
    const tahmin = tahminUret(analiz);
    const manuel = manuelSecimler['iddaa-'+m.id];
    const karar = manuel ? 'MANUEL ' + manuel : tahmin.karar;
    const cls = karar.includes('BANKO') ? 'banko' : karar.includes('ÇİFT') ? 'cift' : karar.includes('ÜÇLÜ') ? 'uclu' : 'surpriz';
    const ikon = karar.includes('BANKO') ? '🔒' : karar.includes('ÇİFT') ? '⚠️' : karar.includes('ÜÇLÜ') ? '🔥' : '🎲';
    
    let ekBahisHTML = '';
    if(m.kgvar){
      const kgBeklenen = kgVarBeklenen(analiz);
      const dv = degerVarMi('KG Var', m.kgvar, kgBeklenen);
      ekBahisHTML += `<div style="display:flex;justify-content:space-between;font-size:.72rem;padding:4px 0;border-bottom:1px solid var(--border)"><span>KG Var (${m.kgvar})</span><span>${dv.var ? '<b class="green">💎 Değerli</b>' : '<span class="muted">Normal</span>'}</span></div>`;
    }
    if(m.u25ust){
      const u25Beklenen = ust25Beklenen(analiz);
      const dv = degerVarMi('2.5 Üst', m.u25ust, u25Beklenen);
      ekBahisHTML += `<div style="display:flex;justify-content:space-between;font-size:.72rem;padding:4px 0;border-bottom:1px solid var(--border)"><span>2.5 Üst (${m.u25ust})</span><span>${dv.var ? '<b class="green">💎 Değerli</b>' : '<span class="muted">Normal</span>'}</span></div>`;
    }
    if(m.u15ust){
      ekBahisHTML += `<div style="display:flex;justify-content:space-between;font-size:.72rem;padding:4px 0;border-bottom:1px solid var(--border)"><span>1.5 Üst (${m.u15ust})</span><span>${parseFloat(m.u15ust) < 1.40 ? '<b class="green">✅ Güçlü</b>' : '<span class="muted">Normal</span>'}</span></div>`;
    }
    if(m.u35ust){
      ekBahisHTML += `<div style="display:flex;justify-content:space-between;font-size:.72rem;padding:4px 0;border-bottom:1px solid var(--border)"><span>3.5 Üst (${m.u35ust})</span><span>${parseFloat(m.u35ust) < 2.00 ? '<b class="orange">🔥 Riskli</b>' : '<span class="muted">Normal</span>'}</span></div>`;
    }
    if(m.kgu){
      ekBahisHTML += `<div style="display:flex;justify-content:space-between;font-size:.72rem;padding:4px 0;border-bottom:1px solid var(--border)"><span>KG+2.5Ü (${m.kgu})</span><span>${parseFloat(m.kgu) < 2.00 ? '<b class="green">💎 Değerli</b>' : '<span class="muted">Normal</span>'}</span></div>`;
    }
    
    return `
    <div class="tahmin-kart ${cls}" style="margin-bottom:10px">
      <div class="tk-head">
        <span>${ikon} İDDAA #${idx+1} · ${tahmin.macSinif}</span>
        <button onclick="serbestSil(${idx})" style="background:none;border:none;color:var(--red);cursor:pointer;font-size:1rem;width:auto;padding:2px 6px">🗑️</button>
      </div>
      <div class="tk-teams">${m.mac}</div>
      <div class="oran-grid-bulten" style="margin:8px 0">
        <div class="oran-box-bulten"><div class="lbl">1</div><div class="val">${m.o1.toFixed(2)}</div><div class="pct">%${analiz.p1.toFixed(1)}</div></div>
        <div class="oran-box-bulten"><div class="lbl">X</div><div class="val">${m.oX.toFixed(2)}</div><div class="pct">%${analiz.pX.toFixed(1)}</div></div>
        <div class="oran-box-bulten"><div class="lbl">2</div><div class="val">${m.o2.toFixed(2)}</div><div class="pct">%${analiz.p2.toFixed(1)}</div></div>
      </div>
      <div class="tk-ana" style="padding:10px">
        <div class="lbl">${karar}</div>
        <div class="val" style="font-size:1.4rem">${manuel || tahmin.ana_tahmin}</div>
      </div>
      <div class="tk-info">
        <div class="tk-item"><span class="lbl">Güven</span><span class="val">%${tahmin.guven}</span></div>
        <div class="tk-item"><span class="lbl">Tuzak</span><span class="val">%${tahmin.favoriTuzagi}</span></div>
        <div class="tk-item"><span class="lbl">Beraberlik</span><span class="val">${tahmin.beraberlikSinif}</span></div>
        <div class="tk-item"><span class="lbl">Marj</span><span class="val">%${analiz.marj.toFixed(1)}</span></div>
      </div>
      ${ekBahisHTML ? `<div class="analiz-box" style="margin-top:8px"><div class="analiz-lbl" style="font-size:.7rem;margin-bottom:6px">🎯 GİRDİĞİN BAHİSLER</div>${ekBahisHTML}</div>` : ''}
      <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:6px;margin-top:8px">
        <button onclick="macDetayGoster('iddaa',${m.id})" class="gray" style="padding:8px;font-size:.75rem">🔍</button>
        <button onclick="serbestManuel(${m.id},'1')" class="${manuel === '1' ? 'blue' : 'gray'}" style="padding:8px;font-size:.8rem">1</button>
        <button onclick="serbestManuel(${m.id},'X')" class="${manuel === 'X' ? 'blue' : 'gray'}" style="padding:8px;font-size:.8rem">X</button>
        <button onclick="serbestManuel(${m.id},'2')" class="${manuel === '2' ? 'blue' : 'gray'}" style="padding:8px;font-size:.8rem">2</button>
      </div>
    </div>`;
  }).join('');
}

function serbestSil(idx){
  if(!confirm('Bu maçı silmek istediğine emin misin?')) return;
  serbestData.splice(idx, 1);
  localStorage.setItem('skorlab_serbest', JSON.stringify(serbestData));
  renderSerbest();
  updateStats();
}

function serbestManuel(id, secim){
  const key = 'iddaa-' + id;
  if(manuelSecimler[key] === secim) delete manuelSecimler[key];
  else manuelSecimler[key] = secim;
  renderSerbest();
  updateStats();
}

function temizleSerbest(){
  if(!confirm('Tüm serbest maçları silmek istediğine emin misin?')) return;
  serbestData = [];
  localStorage.removeItem('skorlab_serbest');
  renderSerbest();
  updateStats();
}

/* ============ TAHMİN LİSTESİ ============ */
function renderTahminListesi(){
  const container = $('tahminListesi');
  if(!container) return;
  let html = '';
  
  const totoA = matchesData.map(m => {
    const od = oddsData[m.id];
    if(!od || !od['1'] || !od['X'] || !od['2']) return null;
    const analiz = macAnalizEt(m.id, od['1'], od['X'], od['2']);
    const tahmin = tahminUret(analiz);
    const manuel = manuelSecimler['toto-'+m.id];
    return { tip:'toto', m, analiz, tahmin, manuel, id:m.id, isim:m.home+' - '+m.away, tarih:m.date };
  }).filter(x => x !== null);
  
  const iddaaA = serbestData.map(m => {
    const analiz = macAnalizEt(m.id, m.o1, m.oX, m.o2);
    const tahmin = tahminUret(analiz);
    const manuel = manuelSecimler['iddaa-'+m.id];
    return { tip:'iddaa', m, analiz, tahmin, manuel, id:m.id, isim:m.mac, tarih:m.tarih };
  });
  
  if(!totoA.length && !iddaaA.length){
    container.innerHTML = '<div class="card"><div class="muted" style="text-align:center;padding:20px">Maç yok.</div></div>';
    return;
  }
  
  if(totoA.length){
    html += '<div class="card"><div class="result-title">📋 SPOR TOTO (' + totoA.length + ' Maç)</div>';
    html += totoA.map(x => tahminKartHTML(x)).join('');
    html += '</div>';
  }
  
  if(iddaaA.length){
    html += '<div class="card"><div class="result-title">🎯 İDDAA (' + iddaaA.length + ' Maç)</div>';
    html += iddaaA.map(x => tahminKartHTML(x)).join('');
    html += '</div>';
  }
  
  container.innerHTML = html;
}

function tahminKartHTML({tip, m, analiz, tahmin, manuel, id, isim, tarih}){
  const karar = manuel ? 'MANUEL ' + manuel : tahmin.karar;
  const ana = manuel || tahmin.ana_tahmin;
  const cls = karar.includes('BANKO') ? 'banko' : karar.includes('ÇİFT') ? 'cift' : karar.includes('ÜÇLÜ') ? 'uclu' : 'surpriz';
  const ikon = karar.includes('BANKO') ? '🔒' : karar.includes('ÇİFT') ? '⚠️' : karar.includes('ÜÇLÜ') ? '🔥' : '🎲';
  return `
    <div class="tahmin-kart ${cls}" onclick="macDetayGoster('${tip}',${id})" style="cursor:pointer">
      <div class="tk-head">
        <span>${tarih} · ${tip === 'toto' ? 'TOTO' : 'İDDAA'} · ${tahmin.macSinif}</span>
        <span>${ikon} #${tip === 'toto' ? id : ''}${manuel ? ' <span style="color:var(--orange);font-size:.65rem">[M]</span>' : ''}</span>
      </div>
      <div class="tk-teams">${isim}</div>
      <div class="tk-ana"><div class="lbl">${karar}</div><div class="val">${ana}</div></div>
      <div class="tk-info">
        <div class="tk-item"><span class="lbl">Güven</span><span class="val">%${tahmin.guven}</span></div>
        <div class="tk-item"><span class="lbl">Tuzak</span><span class="val">%${tahmin.favoriTuzagi}</span></div>
        <div class="tk-item"><span class="lbl">Beraberlik</span><span class="val">${tahmin.beraberlikSinif}</span></div>
        <div class="tk-item"><span class="lbl">Rakip</span><span class="val">%${tahmin.surprizOlas.toFixed(0)}</span></div>
      </div>
      <div class="tk-alt"><b>Alt:</b> ${tahmin.alternatif} · <b>Sür:</b> ${tahmin.surpriz} · <b>Sınıf:</b> ${tahmin.favSinif}</div>
    </div>`;
}

/* ============ STATS ============ */
function updateStats(){
  const hepsi = [];
  matchesData.forEach(m => {
    const od = oddsData[m.id];
    if(!od || !od['1']) return;
    const analiz = macAnalizEt(m.id, od['1'], od['X'], od['2']);
    if(!analiz) return;
    const t = tahminUret(analiz);
    const man = manuelSecimler['toto-'+m.id];
    hepsi.push(man ? {...t, karar:'MANUEL '+man, manuel:true} : t);
  });
  serbestData.forEach(m => {
    const analiz = macAnalizEt(m.id, m.o1, m.oX, m.o2);
    if(!analiz) return;
    const t = tahminUret(analiz);
    const man = manuelSecimler['iddaa-'+m.id];
    hepsi.push(man ? {...t, karar:'MANUEL '+man, manuel:true} : t);
  });
  
  const banko = hepsi.filter(t => t.karar.includes('BANKO')).length;
  const cift = hepsi.filter(t => t.karar.includes('ÇİFT')).length;
  const uclu = hepsi.filter(t => t.karar.includes('ÜÇLÜ')).length;
  const ort = hepsi.length ? Math.round(hepsi.reduce((t,x) => t + x.guven, 0) / hepsi.length) : 0;
  
  const sM = $('statMac'); if(sM) sM.innerText = matchesData.length + serbestData.length;
  const sB = $('statBanko'); if(sB) sB.innerText = banko;
  const sC = $('statCift'); if(sC) sC.innerText = cift + uclu;
  const sG = $('statGuven'); if(sG) sG.innerText = '%' + ort;
}

/* ============ MAÇ DETAY ============ */
function macDetayGoster(tip, id){
  let m, o1, oX, o2, isim, tarih, league;
  if(tip === 'toto'){
    m = matchesData.find(x => x.id === id);
    if(!m) return;
    const od = oddsData[id];
    if(!od || !od['1'] || !od['X'] || !od['2']){ showToast('error','Oran Yok','Bu maçın oranları girilmemiş.'); return; }
    o1 = od['1']; oX = od['X']; o2 = od['2'];
    isim = m.home + ' - ' + m.away; tarih = m.date; league = m.league;
  } else {
    m = serbestData.find(x => x.id === id);
    if(!m) return;
    o1 = m.o1; oX = m.oX; o2 = m.o2;
    isim = m.mac; tarih = m.tarih; league = '';
  }
  
  const analiz = macAnalizEt(id, o1, oX, o2);
  const tahmin = tahminUret(analiz);
  const o = oranToOlasilik(parseFloat(o1), parseFloat(oX), parseFloat(o2));
  const manuel = manuelSecimler[tip + '-' + id];
  const ent = entropyHesapla(analiz);
  const kapsama = kapsamaHesapla(analiz, 20);
  const kapsamaHTML = Object.keys(kapsama).sort().map(k => {
    const yuzde = Math.round(kapsama[k] / 20 * 100);
    return `<div style="display:flex;justify-content:space-between;font-size:.75rem;padding:3px 0">
      <span>${k}</span><span><b>${kapsama[k]}</b> kolon (%${yuzde})</span>
    </div>`;
  }).join('');
  const entSeviye = ent < 0.4 ? 'Düşük' : ent < 0.7 ? 'Orta' : ent < 0.9 ? 'Yüksek' : 'Çok Yüksek';
  const kgBek = kgVarBeklenen(analiz);
  const u25Bek = ust25Beklenen(analiz);
  const toplamGolBek = toplamGolBeklentisi(analiz);
  
  $('macDetayTitle').innerText = '📊 ' + (tip === 'toto' ? 'MAÇ #' + id : 'İDDAA');
  $('macDetayBody').innerHTML = `
    <div style="font-size:.8rem;line-height:1.8">
      <div style="text-align:center;margin-bottom:14px">
        <div style="font-weight:900;font-size:1rem">${isim}</div>
        <div style="color:var(--muted);font-size:.7rem;margin-top:4px">${tarih}${league ? ' · '+league : ''}</div>
        <div style="margin-top:8px;padding:6px 12px;background:var(--bg2);border-radius:8px;display:inline-block;font-size:.72rem;font-weight:800;color:var(--green)">${tahmin.macSinif}</div>
      </div>
      
      <div class="analiz-box">
        <div class="analiz-row"><span class="analiz-lbl">📊 ORANLAR</span></div>
        <div class="analiz-row"><span>1: <b>${o1}</b></span><span>X: <b>${oX}</b></span><span>2: <b>${o2}</b></span></div>
      </div>
      
      <div class="analiz-box">
        <div class="analiz-row"><span class="analiz-lbl">📈 OLASILIKLAR</span></div>
        <div class="analiz-row"><span>1: <b class="green">%${o.p[0].toFixed(1)}</b></span><span>X: <b class="green">%${o.p[1].toFixed(1)}</b></span><span>2: <b class="green">%${o.p[2].toFixed(1)}</b></span></div>
        <div class="analiz-row"><span class="muted">Marj: %${o.marj}</span></div>
      </div>
      
      <div class="analiz-box">
        <div class="analiz-row"><span class="analiz-lbl">🎯 FAVORİ</span></div>
        <div class="analiz-row"><span>Favori: <b class="green">${tahmin.ana_tahmin}</b> (%${analiz.enYuksek.olas.toFixed(1)})</span></div>
        <div class="analiz-row"><span>Sınıf: <b>${analiz.favSinif}</b></span></div>
      </div>
      
      <div class="sürpriz-alert">
        <div class="baslik">⚠️ FAVORİ TUZAĞI: %${tahmin.favoriTuzagi} · ${analiz.tuzakSinif}</div>
        <div class="neden">Kazanamama riski: <b>%${tahmin.kazanamaRiski}</b></div>
      </div>
      
      <div class="analiz-box">
        <div class="analiz-row"><span class="analiz-lbl">⚖️ BERABERLİK</span></div>
        <div class="analiz-row"><span>X: <b>%${analiz.pX.toFixed(1)}</b></span><span>Risk: <b>${analiz.beraberlikSinif}</b></span></div>
      </div>
      
      <div class="analiz-box">
        <div class="analiz-row"><span class="analiz-lbl">🎲 SÜRPRİZ</span></div>
        <div class="analiz-row"><span>Rakip: <b>%${tahmin.surprizOlas.toFixed(1)}</b></span><span>Sınıf: <b>${analiz.surprizSinif}</b></span></div>
      </div>
      
      <div class="analiz-box">
        <div class="analiz-row"><span class="analiz-lbl">🎯 POISSON TAHMİNİ (Dinamik)</span></div>
        <div class="analiz-row"><span>Toplam Gol: <b>${toplamGolBek.toFixed(2)}</b></span></div>
        <div class="analiz-row"><span>KG Var Beklenen: <b>%${kgBek.toFixed(1)}</b></span></div>
        <div class="analiz-row"><span>2.5 Üst Beklenen: <b>%${u25Bek.toFixed(1)}</b></span></div>
      </div>
      
      <div class="analiz-box">
        <div class="analiz-row"><span class="analiz-lbl">📉 ENTROPY</span></div>
        <div class="analiz-row"><span>${Math.round(ent*100)}/100 · ${entSeviye}</span></div>
      </div>
      
      <div class="tahmin-kart ${tahmin.karar.includes('BANKO') ? 'banko' : tahmin.karar.includes('ÇİFT') ? 'cift' : 'uclu'}">
        <div class="tk-head"><span>SİSTEM TAHMİNİ</span><span>GÜVEN %${tahmin.guven}</span></div>
        <div class="tk-ana"><div class="lbl">${tahmin.karar}</div><div class="val">${tahmin.ana_tahmin}</div></div>
        <div class="tk-info">
          <div class="tk-item"><span class="lbl">Alt</span><span class="val">${tahmin.alternatif}</span></div>
          <div class="tk-item"><span class="lbl">Sür</span><span class="val">${tahmin.surpriz}</span></div>
          <div class="tk-item"><span class="lbl">Risk</span><span class="val">${tahmin.risk}</span></div>
          <div class="tk-item"><span class="lbl">Fark</span><span class="val">%${tahmin.favori_farki}</span></div>
        </div>
      </div>
      
      <div class="analiz-box">
        <div class="analiz-row"><span class="analiz-lbl">⭐ BANKO KALİTE</span></div>
        <div class="analiz-row"><span><b style="font-size:1.3rem;color:var(--green)">${tahmin.kalite}</b> / 100</span></div>
      </div>
      
      <div class="analiz-box">
        <div class="analiz-row"><span class="analiz-lbl">🎯 KUPON KAPSAMASI (20)</span></div>
        ${kapsamaHTML}
      </div>
      
      <div style="margin-top:12px">
        <div style="font-weight:800;color:var(--orange);font-size:.78rem;margin-bottom:8px">🎯 MANUEL MÜDAHALE</div>
        <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:6px">
          <button onclick="detayManuel('${tip}',${id},'1')" class="${manuel === '1' ? 'blue' : 'gray'}" style="padding:10px;font-size:.85rem">1</button>
          <button onclick="detayManuel('${tip}',${id},'X')" class="${manuel === 'X' ? 'blue' : 'gray'}" style="padding:10px;font-size:.85rem">X</button>
          <button onclick="detayManuel('${tip}',${id},'2')" class="${manuel === '2' ? 'blue' : 'gray'}" style="padding:10px;font-size:.85rem">2</button>
        </div>
        ${manuel ? `<div style="margin-top:8px;padding:8px;background:rgba(255,176,32,.1);border-left:3px solid var(--orange);border-radius:6px;font-size:.72rem;color:var(--orange)"><b>Manuel: ${manuel}</b> · Sistem: ${tahmin.ana_tahmin}</div>` : ''}
      </div>
    </div>
  `;
  $('macDetayModal').classList.add('active');
}

function detayManuel(tip, id, secim){
  const key = tip + '-' + id;
  if(manuelSecimler[key] === secim) delete manuelSecimler[key];
  else manuelSecimler[key] = secim;
  macDetayGoster(tip, id);
  renderBulten();
  renderSerbest();
  renderTahminListesi();
  updateStats();
}

/* ============ TAHMİN VER ============ */
function tahminVer(){
  const hepsi = [];
  matchesData.forEach(m => {
    const od = oddsData[m.id];
    if(!od || !od['1']) return;
    const analiz = macAnalizEt(m.id, od['1'], od['X'], od['2']);
    if(!analiz) return;
    hepsi.push({ tip:'toto', m, analiz, tahmin:tahminUret(analiz), manuel:manuelSecimler['toto-'+m.id], isim:m.home+' - '+m.away });
  });
  serbestData.forEach(m => {
    const analiz = macAnalizEt(m.id, m.o1, m.oX, m.o2);
    if(!analiz) return;
    hepsi.push({ tip:'iddaa', m, analiz, tahmin:tahminUret(analiz), manuel:manuelSecimler['iddaa-'+m.id], isim:m.mac });
  });
  if(!hepsi.length){ showToast('error','Maç Yok','Önce maç gir.'); return; }
  
  const banko = hepsi.filter(x => (x.manuel || x.tahmin.karar).includes('BANKO')).length;
  const cift = hepsi.filter(x => (x.manuel || x.tahmin.karar).includes('ÇİFT')).length;
  const uclu = hepsi.filter(x => (x.manuel || x.tahmin.karar).includes('ÜÇLÜ')).length;
  const ortG = Math.round(hepsi.reduce((t,x) => t + x.tahmin.guven, 0) / hepsi.length);
  const kritik = [...hepsi].sort((a,b) => b.tahmin.entropy - a.tahmin.entropy).slice(0, 3);
  
  $('tahminModalBody').innerHTML = `
    <div style="font-size:.8rem;line-height:1.8">
      <div style="background:var(--bg2);border-radius:10px;padding:12px;margin-bottom:12px">
        <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;text-align:center">
          <div><div style="color:var(--green);font-weight:900;font-size:1.2rem">${banko}</div><div style="color:var(--muted);font-size:.6rem">BANKO</div></div>
          <div><div style="color:var(--orange);font-weight:900;font-size:1.2rem">${cift}</div><div style="color:var(--muted);font-size:.6rem">ÇİFT</div></div>
          <div><div style="color:var(--red);font-weight:900;font-size:1.2rem">${uclu}</div><div style="color:var(--muted);font-size:.6rem">ÜÇLÜ</div></div>
          <div><div style="color:var(--blue);font-weight:900;font-size:1.2rem">%${ortG}</div><div style="color:var(--muted);font-size:.6rem">GÜVEN</div></div>
        </div>
      </div>
      <div style="background:linear-gradient(135deg,rgba(255,77,94,.15),rgba(255,77,94,.05));border:1px solid rgba(255,77,94,.4);border-radius:10px;padding:10px 12px;margin-bottom:12px">
        <div style="color:var(--red);font-weight:900;font-size:.78rem;margin-bottom:6px">🚨 KRİTİK MAÇLAR</div>
        ${kritik.map(x => `<div style="font-size:.72rem;color:var(--muted);padding:3px 0"><b style="color:var(--orange)">${x.tip === 'toto' ? '#' + x.m.id : 'İ'}</b> ${x.isim} · Ent: ${x.tahmin.entropy}/100</div>`).join('')}
      </div>
      ${hepsi.map(x => {
        const karar = x.manuel ? 'MANUEL ' + x.manuel : x.tahmin.karar;
        const ana = x.manuel || x.tahmin.ana_tahmin;
        const ikon = karar.includes('BANKO') ? '🔒' : karar.includes('ÇİFT') ? '⚠️' : karar.includes('ÜÇLÜ') ? '🔥' : '🎲';
        const renk = karar.includes('BANKO') ? 'green' : karar.includes('ÇİFT') ? 'orange' : karar.includes('ÜÇLÜ') ? 'red' : 'purple';
        return `<div style="background:var(--bg2);border-left:3px solid var(--${renk});border-radius:8px;padding:8px 10px;margin-bottom:6px">
          <div style="font-weight:800;font-size:.78rem">${ikon} ${x.tip === 'toto' ? '#' + x.m.id : ''} ${x.isim}</div>
          <div style="font-size:.7rem;color:var(--muted);margin-top:4px"><b style="color:var(--${renk})">${ana}</b> · ${karar} · %${x.tahmin.guven} · Tuzak %${x.tahmin.favoriTuzagi}</div>
        </div>`;
      }).join('')}
    </div>
  `;
  $('tahminModal').classList.add('active');
}

/* ============ KUPON (DETERMINISTIK) ============ */
function setKuponKaynak(kaynak, el){
  kuponKaynak = kaynak;
  document.querySelectorAll('.mode').forEach(e => { if(e.id && e.id.startsWith('kuponKaynak-')) e.classList.remove('active'); });
  if(el) el.classList.add('active');
}

function setRiskMode(mode, el){
  riskMode = mode;
  document.querySelectorAll('.mode').forEach(e => { if(e.id && e.id.startsWith('mode-')) e.classList.remove('active'); });
  if(el) el.classList.add('active');
  const info = {
    guvenli: '<b>🛡️ GÜVENLİ</b><br>Banko maçlara öncelik.',
    dengeli: '<b>⚖️ DENGELİ</b><br>Banko + çift karışık.',
    agresif: '<b>🚀 AGRESİF</b><br>Sürprizlere daha fazla kolon.'
  };
  const el2 = $('modeInfo'); if(el2) el2.innerHTML = info[mode];
}

function updateKolon(){
  const b = parseFloat($('budget').value) || 0;
  const k = Math.floor(b / 10);
  const l = $('lblCost'); if(l) l.innerText = b + ' TL';
  const k2 = $('lblKolon'); if(k2) k2.innerText = k;
}

function kuponOlustur(){
  const butce = parseFloat($('budget').value) || 200;
  const kolonSayisi = Math.floor(butce / 10);
  let kaynakMaçlar = [];
  
  if(kuponKaynak === 'toto' || kuponKaynak === 'karisik'){
    matchesData.forEach(m => {
      const od = oddsData[m.id];
      if(!od || !od['1'] || !od['X'] || !od['2']) return;
      const analiz = macAnalizEt(m.id, od['1'], od['X'], od['2']);
      if(!analiz) return;
      const t = tahminUret(analiz);
      const man = manuelSecimler['toto-'+m.id];
      kaynakMaçlar.push({ tip:'toto', id:m.id, isim:m.home+' - '+m.away, odds:od, analiz, tahmin:t, karar: man ? 'MANUEL '+man : t.karar, ana: man || t.ana_tahmin, manuel: !!man });
    });
  }
  if(kuponKaynak === 'iddaa' || kuponKaynak === 'karisik'){
    serbestData.forEach(m => {
      const analiz = macAnalizEt(m.id, m.o1, m.oX, m.o2);
      if(!analiz) return;
      const t = tahminUret(analiz);
      const man = manuelSecimler['iddaa-'+m.id];
      kaynakMaçlar.push({ tip:'iddaa', id:m.id, isim:m.mac, odds:{'1':m.o1,'X':m.oX,'2':m.o2}, analiz, tahmin:t, karar: man ? 'MANUEL '+man : t.karar, ana: man || t.ana_tahmin, manuel: !!man });
    });
  }
  if(!kaynakMaçlar.length){ showToast('error','Maç Yok','Seçilen kaynakta maç yok.'); return; }
  
  const dagilim = {};
  kaynakMaçlar.forEach(m => {
    const key = m.tip + '-' + m.id;
    if(m.manuel){
      dagilim[key] = { [m.ana]: kolonSayisi };
    } else {
      const kap = kapsamaHesapla(m.analiz, kolonSayisi);
      let finalKap = {};
      Object.keys(kap).forEach(k => {
        let v = kap[k];
        if(riskMode === 'agresif' && !m.karar.includes('BANKO')) v = Math.round(v * 0.8);
        if(riskMode === 'guvenli' && m.ana === k) v = Math.round(v * 1.2);
        finalKap[k] = Math.max(0, v);
      });
      let toplam = Object.values(finalKap).reduce((t,v) => t+v, 0);
      if(toplam !== kolonSayisi && toplam > 0){
        const fark = kolonSayisi - toplam;
        const enBuyuk = Object.keys(finalKap).sort((a,b) => finalKap[b]-finalKap[a])[0];
        finalKap[enBuyuk] += fark;
      }
      dagilim[key] = finalKap;
    }
  });
  
  // Deterministik kolon üretimi (kümülatif dağıtım)
  const hamKolonlar = [];
  for(let i = 0; i < kolonSayisi; i++){
    const kolon = [];
    let oran = 1;
    kaynakMaçlar.forEach(m => {
      const key = m.tip + '-' + m.id;
      const d = dagilim[key];
      const sec = Object.keys(d).filter(k => d[k] > 0).sort();
      const pozisyon = (i + 0.5) / kolonSayisi;
      let kumulatif = 0;
      let secim = sec[0];
      for(const s of sec){
        kumulatif += d[s] / kolonSayisi;
        if(pozisyon <= kumulatif + 0.001){ secim = s; break; }
      }
      kolon.push(secim);
      if(m.odds && m.odds[secim]) oran *= parseFloat(m.odds[secim]);
    });
    hamKolonlar.push({ picks: kolon, oran: oran });
  }
  
  // Hamming mesafesi filtresi
  const finalKolonlar = [];
  const kullanilan = new Set();
  for(let i = 0; i < hamKolonlar.length; i++){
    if(kullanilan.has(i)) continue;
    const k1 = hamKolonlar[i];
    finalKolonlar.push(k1);
    kullanilan.add(i);
    for(let j = i + 1; j < hamKolonlar.length; j++){
      if(kullanilan.has(j)) continue;
      const k2 = hamKolonlar[j];
      let ayni = 0;
      for(let x = 0; x < k1.picks.length; x++){
        if(k1.picks[x] === k2.picks[x]) ayni++;
      }
      if(ayni / k1.picks.length >= 0.90){ kullanilan.add(j); }
    }
  }
  // Eksik varsa tamamla
  if(finalKolonlar.length < kolonSayisi){
    for(let i = 0; i < hamKolonlar.length && finalKolonlar.length < kolonSayisi; i++){
      if(!kullanilan.has(i)){ finalKolonlar.push(hamKolonlar[i]); kullanilan.add(i); }
    }
  }
  
  const kaynakIsmi = { toto:'TOTO', iddaa:'İDDAA', karisik:'KARIŞIK' }[kuponKaynak];
  const etkin = etkinKapsama(finalKolonlar);
  const ortOran = finalKolonlar.reduce((t,k)=>t+k.oran,0) / finalKolonlar.length;
  const kritik = [...kaynakMaçlar].sort((a,b) => {
    const entA = a.manuel ? 0 : a.tahmin.entropy;
    const entB = b.manuel ? 0 : b.tahmin.entropy;
    return entB - entA;
  }).slice(0, 3);
  
  let html = `
    <div class="kupon-sonuc">
      <div class="baslik">⚡ ${kaynakIsmi} KUPONU (${finalKolonlar.length} Kolon)</div>
      <div style="background:var(--bg2);border-radius:10px;padding:12px;margin-bottom:14px">
        <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;font-size:.72rem;margin-bottom:10px">
          <div><b>Bütçe:</b> ${butce} TL</div>
          <div><b>Kolon:</b> ${finalKolonlar.length}</div>
          <div><b>Ort. Oran:</b> ${ortOran.toFixed(1)}</div>
        </div>
        <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:8px;font-size:.72rem;border-top:1px solid var(--border);padding-top:10px">
          <div><b>Etkin Kapsama:</b> <span style="color:var(--green)">%${etkin}</span></div>
          <div><b>Strateji:</b> <span style="color:var(--blue)">${riskMode.toUpperCase()}</span></div>
        </div>
      </div>
      <div style="background:linear-gradient(135deg,rgba(255,77,94,.15),rgba(255,77,94,.05));border:1px solid rgba(255,77,94,.4);border-radius:10px;padding:10px 12px;margin-bottom:14px">
        <div style="color:var(--red);font-weight:900;font-size:.78rem;margin-bottom:6px">🚨 KRİTİK MAÇLAR</div>
        ${kritik.map(m => `<div style="font-size:.7rem;color:var(--muted);padding:2px 0"><b style="color:var(--orange)">${m.tip === 'toto' ? '#'+m.id : 'İ'}</b> ${m.isim} · Ent: ${m.manuel ? 0 : m.tahmin.entropy}/100</div>`).join('')}
      </div>
      <div style="background:var(--bg2);border-radius:10px;padding:12px;margin-bottom:14px">
        <div style="font-weight:800;color:var(--green);font-size:.78rem;margin-bottom:8px">📋 MAÇ BAZLI DAĞILIM</div>
        ${kaynakMaçlar.map(m => {
          const key = m.tip + '-' + m.id;
          const d = dagilim[key];
          const str = Object.keys(d).sort().filter(k => d[k] > 0).map(k => `<b>${k}</b>: ${d[k]}`).join(' · ');
          const sinifTag = m.manuel ? ' <span style="color:var(--orange);font-size:.6rem">[M]</span>' : ` <span style="color:var(--muted);font-size:.6rem">[${m.tahmin.macSinif}]</span>`;
          return `<div style="font-size:.72rem;padding:4px 0;border-bottom:1px solid var(--border)"><b>${m.tip === 'toto' ? '#'+m.id : 'İ'}</b> ${m.isim.slice(0,16)}: ${str}${sinifTag}</div>`;
        }).join('')}
      </div>
      <div style="max-height:350px;overflow-y:auto;margin-bottom:14px">
        ${finalKolonlar.map((k, idx) => `
          <div class="kolon">
            <div class="kolon-baslik">KOLON #${String(idx+1).padStart(2,'0')}</div>
            <div class="kolon-picks">${k.picks.join('-')}</div>
            <div class="kolon-info">Oran: ${k.oran.toFixed(2)}</div>
          </div>
        `).join('')}
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
        <button onclick="kuponKopyala()" class="blue">📋 Kopyala</button>
        <button onclick="kuponIndir()" class="gray">💾 İndir (.txt)</button>
      </div>
    </div>`;
  $('kuponSonuc').innerHTML = html;
  window.sonKolonlar = finalKolonlar;
  showToast('success', 'Kupon Hazır!', finalKolonlar.length + ' kolon · Kapsama %' + etkin);
}

function kuponKopyala(){
  if(!window.sonKolonlar || !window.sonKolonlar.length){ showToast('error','Kupon Yok','Önce kupon oluştur.'); return; }
  let text = '🎯 SKORLAB KUPONU\n━━━━━━━━━━━━━━━\n\n';
  window.sonKolonlar.forEach((k, idx) => { text += 'KOLON #' + String(idx+1).padStart(2,'0') + ': ' + k.picks.join('-') + '\n'; });
  navigator.clipboard.writeText(text).then(() => showToast('success','Kopyalandı!','Kupon panoya kopyalandı.')).catch(() => showToast('error','Hata','Kopyalanamadı.'));
}

function kuponIndir(){
  if(!window.sonKolonlar || !window.sonKolonlar.length){ showToast('error','Kupon Yok','Önce kupon oluştur.'); return; }
  let text = '🎯 SKORLAB KUPONU\n━━━━━━━━━━━━━━━\n\n';
  window.sonKolonlar.forEach((k, idx) => { text += 'KOLON #' + String(idx+1).padStart(2,'0') + ': ' + k.picks.join('-') + ' (Oran: ' + k.oran.toFixed(2) + ')\n'; });
  const blob = new Blob([text], {type:'text/plain'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'skorlab-kupon.txt';
  a.click();
  URL.revokeObjectURL(url);
  showToast('success','İndirildi!','Kupon .txt olarak indirildi.');
}

/* ============ ARŞİV ============ */
function renderArsiv(){
  const container = $('arsivListesi');
  if(!container) return;
  if(!archiveData.weeks || !archiveData.weeks.length){
    container.innerHTML = '<div class="card"><div class="muted" style="text-align:center;padding:20px">Henüz arşiv verisi yok.</div></div>';
    ['gToplamHafta','gOrtalama','gEnIyi','gEnKotu'].forEach(id => { const el = $(id); if(el) el.innerText = '-'; });
    return;
  }
  let tD = 0, tM = 0, eI = 0, eK = 100;
  container.innerHTML = archiveData.weeks.map(w => {
    const s = w.results || [];
    let d = 0;
    s.forEach((r, idx) => {
      const m = matchesData[idx];
      if(!m) return;
      const od = oddsData[m.id];
      if(!od) return;
      const a = macAnalizEt(m.id, od['1'], od['X'], od['2']);
      if(!a) return;
      if(a.enYuksek.kod === r) d++;
    });
    const y = s.length ? (d / s.length * 100) : 0;
    tD += d; tM += s.length;
    if(y > eI) eI = y;
    if(y < eK) eK = y;
    const r = y >= 70 ? 'green' : y >= 50 ? 'orange' : 'red';
    return `<div class="arsiv-hafta"><div class="hafta-baslik">📅 ${w.week}</div><div class="hafta-info">Toplam: <b>${s.length}</b> maç<br>Model Tutma: <b style="color:var(--${r})">${d}/${s.length} (%${y.toFixed(0)})</b><br>Sonuçlar: <span style="font-family:monospace">${s.join('-')}</span></div></div>`;
  }).join('');
  const g = tM ? (tD / tM * 100) : 0;
  const g1 = $('gToplamHafta'); if(g1) g1.innerText = archiveData.weeks.length;
  const g2 = $('gOrtalama'); if(g2) g2.innerText = '%' + g.toFixed(0);
  const g3 = $('gEnIyi'); if(g3) g3.innerText = '%' + eI.toFixed(0);
  const g4 = $('gEnKotu'); if(g4) g4.innerText = '%' + eK.toFixed(0);
}

/* ============ TAB ============ */
function switchTab(i, el){
  document.querySelectorAll('.tab,.page').forEach(e => e.classList.remove('active'));
  el.classList.add('active');
  $('page-' + i).classList.add('active');
  if(i === 2) renderTahminListesi();
  if(i === 4) renderArsiv();
  window.scrollTo({top:0,behavior:'smooth'});
}

/* ============ MODAL & TOAST ============ */
function openModal(id){ $(id).classList.add('active'); }
function closeModal(id){ $(id).classList.remove('active'); }

function showToast(type, title, msg){
  $('toastIcon').innerText = type === 'success' ? '✅' : '❌';
  $('toastTitle').innerText = title;
  $('toastMsg').innerHTML = msg;
  openModal('toastModal');
}

/* ============ BAŞLAT ============ */
window.onload = function(){
  try { loadData(); } catch(e) { console.error(e); }
  try { updateKolon(); setRiskMode('dengeli', $('mode-dengeli')); setKuponKaynak('toto', $('kuponKaynak-toto')); } catch(e) { console.error(e); }
  setTimeout(() => openModal('legalModal'), 800);
};
