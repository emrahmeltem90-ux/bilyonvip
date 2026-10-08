/* ============================================================
   SKORLAB v9 · Poisson + Kelly + Tüm Modüller
   ============================================================ */

let matchesData = [];
let oddsData = {};
let serbestData = JSON.parse(localStorage.getItem('skorlab_serbest') || '[]');
let archiveData = { weeks: [] };
let riskMode = 'dengeli';
let kuponKaynak = 'toto';
let manuelSecimler = {};
let weekKey = 'default';
let kasa = parseFloat(localStorage.getItem('skorlab_kasa') || '1000');
let kellyFraction = parseFloat(localStorage.getItem('skorlab_kelly_frac') || '0.5');

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

/* ============ HİBRİT MODEL: ORAN %60 + POISSON %40 ============ */
function hibritOlasilik(oranP, xgEv, xgDep){
  const MAX = 6;
  let h1 = 0, hX = 0, h2 = 0;
  let hKG = 0, hUst25 = 0;
  const skorlar = {};
  
  for(let h = 0; h < MAX; h++){
    for(let a = 0; a < MAX; a++){
      const p = poissonPmf(h, xgEv) * poissonPmf(a, xgDep);
      const key = h + '-' + a;
      skorlar[key] = (skorlar[key] || 0) + p;
      if(h > a) h1 += p;
      else if(h === a) hX += p;
      else h2 += p;
      if(h >= 1 && a >= 1) hKG += p;
      if(h + a > 2.5) hUst25 += p;
    }
  }
  
  const poisson = {
    p1: h1 * 100, pX: hX * 100, p2: h2 * 100,
    kg: hKG * 100, ust25: hUst25 * 100,
    skorlar: skorlar
  };
  
  // %60 Oran + %40 Poisson
  const hibrit = {
    p1: oranP[0] * 0.6 + poisson.p1 * 0.4,
    pX: oranP[1] * 0.6 + poisson.pX * 0.4,
    p2: oranP[2] * 0.6 + poisson.p2 * 0.4,
    kg: poisson.kg,
    ust25: poisson.ust25,
    skorlar: poisson.skorlar,
    poisson: poisson
  };
  
  const toplam = hibrit.p1 + hibrit.pX + hibrit.p2;
  hibrit.p1 = (hibrit.p1 / toplam) * 100;
  hibrit.pX = (hibrit.pX / toplam) * 100;
  hibrit.p2 = (hibrit.p2 / toplam) * 100;
  
  return hibrit;
}

/* ============ XG TAHMİN (ORANDAN) ============ */
function xGTahmin(p1, pX, p2){
  const totalP = p1 + p2;
  const homeShare = p1 / (totalP || 1);
  const toplamGol = 2.4 + (1 - pX/100) * 0.8;
  const xgEv = Math.max(0.3, toplamGol * homeShare * 1.15);
  const xgDep = Math.max(0.3, toplamGol * (1 - homeShare));
  return { xgEv, xgDep };
}

/* ============ KELLY KRİTERİ ============ */
function kellyHesapla(olasilik, oran, frac){
  const p = olasilik / 100;
  const b = oran - 1;
  if(b <= 0) return { f: 0, ev: 0, degerli: false };
  const ev = p * oran;
  const f = (b * p - (1 - p)) / b;
  const degerli = ev > 1.05 && f > 0;
  return {
    f: Math.max(0, f * frac) * 100,
    ev: ev.toFixed(3),
    degerli: degerli
  };
}

/* ============ MATCH ANALYZER (HİBRİT) ============ */
function macAnalizEt(id, o1, oX, o2){
  if(!o1 || !oX || !o2) return null;
  const o = oranToOlasilik(parseFloat(o1), parseFloat(oX), parseFloat(o2));
  const oranP = o.p;
  
  // xG tahmin
  const xg = xGTahmin(oranP[0], oranP[1], oranP[2]);
  
  // Hibrit
  const hb = hibritOlasilik(oranP, xg.xgEv, xg.xgDep);
  
  const p1 = hb.p1, pX = hb.pX, p2 = hb.p2;
  const sirali = [
    {kod:'1', olas:p1}, {kod:'X', olas:pX}, {kod:'2', olas:p2}
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
  
  return {
    id: id, p1: p1, pX: pX, p2: p2,
    oranP1: oranP[0], oranPX: oranP[1], oranP2: oranP[2],
    marj: parseFloat(o.marj),
    sirali, enYuksek, ikinci, ucuncu, fark,
    favoriTuzagi, kazanamaRiski,
    surprizOlas: ucuncu.olas, rakipOlas: ikinci.olas,
    kg: hb.kg, ust25: hb.ust25,
    xgEv: xg.xgEv, xgDep: xg.xgDep,
    skorlar: hb.skorlar,
    favSinif: favGuvenSinifi(enYuksek.olas),
    beraberlikSinif: beraberlikSinifi(pX),
    tuzakSinif: favoriTuzagiSinifi(enYuksek.olas),
    surprizSinif: surprizSinifi(ikinci.olas),
    macSinif: macSinifi({enYuksek, pX, fark, ucuncu})
  };
}

/* ============ ENTROPY ============ */
function entropyHesapla(analiz){
  if(!analiz) return 0;
  const p1 = analiz.p1/100, pX = analiz.pX/100, p2 = analiz.p2/100;
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
  let fp = Math.max(0, Math.min(50, (fav - 40) * (50 / 45)));
  let kp = Math.max(0, Math.min(30, fark * (30 / 40)));
  let ep = Math.max(0, (1 - ent) * 20);
  return Math.round(fp + kp + ep);
}

/* ============ SINIFLANDIRMA ============ */
function favGuvenSinifi(fav){
  if(fav >= 70) return 'ÇOK GÜÇLÜ FAVORİ';
  if(fav >= 60) return 'GÜÇLÜ FAVORİ';
  if(fav >= 52) return 'ORTA FAVORİ';
  if(fav >= 45) return 'RİSKLİ FAVORİ';
  return 'NET FAVORİ DEĞİL';
}
function beraberlikSinifi(px){
  if(px >= 30) return 'ÇOK YÜKSEK';
  if(px >= 25) return 'YÜKSEK';
  if(px >= 20) return 'ORTA';
  if(px >= 15) return 'DÜŞÜK';
  return 'ÇOK DÜŞÜK';
}
function favoriTuzagiSinifi(fav){
  const r = 100 - fav;
  if(r >= 50) return 'ÇOK YÜKSEK';
  if(r >= 40) return 'YÜKSEK';
  if(r >= 30) return 'ORTA';
  if(r >= 20) return 'DÜŞÜK';
  return 'ÇOK DÜŞÜK';
}
function surprizSinifi(rakip){
  if(rakip >= 25) return 'GÜÇLÜ SÜRPRİZ ADAYI';
  if(rakip >= 20) return 'ORTA SÜRPRİZ ADAYI';
  if(rakip >= 15) return 'DÜŞÜK SÜRPRİZ';
  return 'ZAYIF SÜRPRİZ';
}
function macSinifi(a){
  if(!a) return 'BELİRSİZ';
  const fav = a.enYuksek.olas, tuzak = 100 - fav, px = a.pX;
  if(fav >= 65 && tuzak <= 35 && px <= 25) return 'BANKO ADAYI';
  if(fav >= 52 && fav < 65) return 'RİSKLİ FAVORİ';
  if(tuzak > 35 && fav >= 45) return 'RİSKLİ FAVORİ';
  if(px >= 25 && Math.abs(fav - px) < 10) return 'BERABERLİK ADAYI';
  const rakip = a.ucuncu ? a.ucuncu.olas : 0;
  if(rakip >= 18 && a.fark < 15) return 'SÜRPRİZ ADAYI';
  if(fav < 45) return 'DENGELİ MAÇ';
  return 'NORMAL';
}

/* ============ KAPSAMA ============ */
function kapsamaHesapla(analiz, kolonSayisi){
  if(!analiz) return { '1': 0, 'X': 0, '2': 0 };
  const sinif = macSinifi(analiz);
  const p1 = analiz.p1, pX = analiz.pX, p2 = analiz.p2;
  let d = {};
  if(sinif === 'BANKO ADAYI'){
    d = { [analiz.enYuksek.kod]: kolonSayisi };
  } else if(sinif === 'RİSKLİ FAVORİ'){
    const a = Math.round(kolonSayisi * 0.7);
    d = { [analiz.enYuksek.kod]: a, [analiz.ikinci.kod]: kolonSayisi - a };
  } else if(sinif === 'BERABERLİK ADAYI'){
    const a = Math.round(kolonSayisi * 0.5), x = Math.round(kolonSayisi * 0.35);
    d = { [analiz.enYuksek.kod]: a, 'X': x };
    const k = kolonSayisi - a - x;
    if(k > 0) d[analiz.ucuncu.kod] = k;
  } else if(sinif === 'SÜRPRİZ ADAYI'){
    const a = Math.round(kolonSayisi * 0.45), b = Math.round(kolonSayisi * 0.35);
    d = { [analiz.enYuksek.kod]: a, [analiz.ikinci.kod]: b };
    d[analiz.ucuncu.kod] = kolonSayisi - a - b;
  } else if(sinif === 'DENGELİ MAÇ'){
    const t = p1 + pX + p2;
    const k1 = Math.round(kolonSayisi * (p1/t));
    const kX = Math.round(kolonSayisi * (pX/t));
    d = { '1': k1, 'X': kX, '2': kolonSayisi - k1 - kX };
  } else {
    const kalite = bankoKalite(analiz);
    if(kalite >= 75) d = { [analiz.enYuksek.kod]: kolonSayisi };
    else if(kalite >= 55){
      const a = Math.round(kolonSayisi * 0.8);
      d = { [analiz.enYuksek.kod]: a, [analiz.ikinci.kod]: kolonSayisi - a };
    } else {
      const t = p1 + pX + p2;
      const k1 = Math.round(kolonSayisi * (p1/t));
      const kX = Math.round(kolonSayisi * (pX/t));
      d = { '1': k1, 'X': kX, '2': kolonSayisi - k1 - kX };
    }
  }
  return d;
}

/* ============ ETKİN KAPSAMA ============ */
function etkinKapsama(kolonlar){
  if(!kolonlar || kolonlar.length < 2) return 100;
  let t = 0, s = 0;
  for(let i = 0; i < kolonlar.length; i++){
    for(let j = i+1; j < kolonlar.length; j++){
      let ayni = 0;
      for(let k = 0; k < kolonlar[i].picks.length; k++){
        if(kolonlar[i].picks[k] === kolonlar[j].picks[k]) ayni++;
      }
      t += ayni / kolonlar[i].picks.length;
      s++;
    }
  }
  return Math.round((1 - t/s) * 100);
}

/* ============ DEĞER BAHİS (POISSON) ============ */
function degerVarMi(bahisAdi, gercekOran, beklenenOlas){
  if(!gercekOran || gercekOran <= 1) return { var: false, fark: 0 };
  const bO = 100/gercekOran;
  const fark = beklenenOlas - bO;
  return { var: fark > 5, fark: fark.toFixed(1) };
}

function kgVarBeklenen(a){
  if(!a) return 50;
  return a.kg;
}

function ust25Beklenen(a){
  if(!a) return 50;
  return a.ust25;
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
  } else if(sinif === 'RİSKLİ FAVORİ'){
    karar = 'BANKO ' + enYuksek.kod;
    guven = Math.round(enYuksek.olas);
    risk = 'Orta';
  } else if(sinif === 'BERABERLİK ADAYI'){
    karar = 'ÇİFT ' + siraliAlternatif(enYuksek.kod, 'X');
    guven = Math.round(enYuksek.olas);
    risk = 'Orta-Yüksek';
  } else if(sinif === 'SÜRPRİZ ADAYI'){
    karar = 'ÇİFT ' + siraliAlternatif(enYuksek.kod, ikinci.kod);
    guven = Math.round(enYuksek.olas);
    risk = 'Yüksek';
  } else if(sinif === 'DENGELİ MAÇ'){
    karar = 'ÜÇLÜ 1X2';
    guven = Math.max(30, Math.round(enYuksek.olas - 5));
    risk = 'Çok Yüksek';
  } else {
    if(kalite >= 75 && enYuksek.olas >= 65){
      karar = 'BANKO ' + enYuksek.kod;
      guven = Math.min(100, enYuksek.olas + 6);
      risk = 'Çok Düşük';
    } else if(kalite >= 55 && enYuksek.olas >= 55){
      karar = 'BANKO ' + enYuksek.kod;
      guven = Math.min(100, enYuksek.olas + 3);
      risk = 'Düşük';
    } else if(kalite >= 35 && enYuksek.olas >= 42){
      karar = 'ÇİFT ' + siraliAlternatif(enYuksek.kod, ikinci.kod);
      guven = enYuksek.olas;
      risk = 'Orta';
    } else {
      karar = 'ÇİFT ' + siraliAlternatif(enYuksek.kod, ikinci.kod);
      guven = enYuksek.olas - 3;
      risk = 'Yüksek';
    }
  }
  
  const alternatif = karar.includes('BANKO') ? siraliAlternatif(enYuksek.kod, ikinci.kod) : karar.replace('ÇİFT ', '');
  return {
    ana_tahmin: enYuksek.kod, alternatif, surpriz: ucuncu.kod,
    guven: Math.round(guven), risk, karar,
    favori_farki: Math.round(fark),
    entropy: Math.round(ent * 100),
    kalite: kalite, macSinif: sinif,
    favSinif: analiz.favSinif, beraberlikSinif: analiz.beraberlikSinif,
    tuzakSinif: analiz.tuzakSinif, surprizSinif: analiz.surprizSinif,
    favoriTuzagi: Math.round(analiz.favoriTuzagi),
    kazanamaRiski: Math.round(analiz.kazanamaRiski),
    surprizOlas: analiz.surprizOlas
  };
}

function siraliAlternatif(a, b){
  const s = {'1':1, 'X':2, '2':3};
  return (s[a] < s[b] ? a : b) + (s[a] < s[b] ? b : a);
}

/* ============ VERİ YÜKLE ============ */
async function loadData(){
  try{
    const res = await fetch('matches.json');
    if(!res.ok) throw new Error('HTTP ' + res.status);
    const raw = await res.json();
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
    console.error('loadData:', e);
    const t = $('weekTitle');
    if(t) t.innerText = 'Bülten Yüklenemedi';
    showToast('error', 'Bağlantı Hatası', 'Veri çekilemedi.');
  }
  loadArchive();
}

async function loadArchive(){
  try{
    const res = await fetch('archive.json');
    if(!res.ok) throw new Error('Arşiv');
    archiveData = await res.json();
  }catch(e){ archiveData = { weeks: [] }; }
  renderArsiv();
}

/* ============ BÜLTEN ============ */
function renderBulten(){
  $('matchesList').innerHTML = matchesData.map((m,i) => {
    const od = oddsData[m.id] || {};
    const has = od['1'] && od['X'] && od['2'];
    const a = has ? macAnalizEt(m.id, od['1'], od['X'], od['2']) : null;
    const t = a ? tahminUret(a) : null;
    let badge = '';
    if(t){
      const man = manuelSecimler['toto-'+m.id];
      const k = man ? 'MANUEL ' + man : t.karar;
      const c = k.includes('BANKO') ? 'green' : k.includes('ÇİFT') ? 'yellow' : k.includes('ÜÇLÜ') ? 'red' : 'purple';
      badge = `<span class="badge ${c}">${k}</span>`;
    }
    return `
    <div class="match" onclick="macDetayGoster('toto',${m.id})">
      <div class="match-head"><span>${m.date}</span><span class="mid">MAÇ #${m.id}</span></div>
      <div class="teams">${m.home} - ${m.away}${badge}${m.league ? '<span class="league-tag">'+m.league+'</span>' : ''}</div>
      <div class="oran-input-grid" onclick="event.stopPropagation()">
        <div class="oran-input-item"><label>1</label><input type="number" step="0.01" placeholder="1.00" value="${od['1']||''}" oninput="oranGuncelle(${m.id},'1',this.value)"></div>
        <div class="oran-input-item"><label>X</label><input type="number" step="0.01" placeholder="1.00" value="${od['X']||''}" oninput="oranGuncelle(${m.id},'X',this.value)"></div>
        <div class="oran-input-item"><label>2</label><input type="number" step="0.01" placeholder="1.00" value="${od['2']||''}" oninput="oranGuncelle(${m.id},'2',this.value)"></div>
      </div>
      ${has ? `
      <div class="oran-grid-bulten">
        <div class="oran-box-bulten"><div class="lbl">1</div><div class="val">${parseFloat(od['1']).toFixed(2)}</div><div class="pct">%${a.p1.toFixed(1)}</div></div>
        <div class="oran-box-bulten"><div class="lbl">X</div><div class="val">${parseFloat(od['X']).toFixed(2)}</div><div class="pct">%${a.pX.toFixed(1)}</div></div>
        <div class="oran-box-bulten"><div class="lbl">2</div><div class="val">${parseFloat(od['2']).toFixed(2)}</div><div class="pct">%${a.p2.toFixed(1)}</div></div>
      </div>
      <div style="display:flex;gap:6px;margin-top:8px;flex-wrap:wrap;font-size:.62rem">
        <span style="background:rgba(255,176,32,.1);color:var(--orange);padding:3px 8px;border-radius:6px;font-weight:800">ENT: ${t.entropy}</span>
        <span style="background:rgba(61,139,255,.1);color:var(--blue);padding:3px 8px;border-radius:6px;font-weight:800">KAL: ${t.kalite}</span>
        <span style="background:rgba(255,77,94,.1);color:var(--red);padding:3px 8px;border-radius:6px;font-weight:800">TUZAK: ${t.favoriTuzagi}%</span>
        <span style="background:rgba(168,85,247,.1);color:var(--purple);padding:3px 8px;border-radius:6px;font-weight:800">xG: ${a.xgEv.toFixed(2)}-${a.xgDep.toFixed(2)}</span>
      </div>` : ''}
    </div>`;
  }).join('');
}

function oranGuncelle(id, alan, deger){
  if(!oddsData[id]) oddsData[id] = {};
  if(deger === '' || deger === null) delete oddsData[id][alan];
  else oddsData[id][alan] = parseFloat(deger);
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
    id: Date.now(), mac, o1, oX, o2,
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
  showToast('success', 'Maç Eklendi!', mac);
}

function renderSerbest(){
  const c = $('serbestListesi');
  if(!c) return;
  if(!serbestData.length){
    c.innerHTML = '<div class="card"><div class="muted" style="text-align:center;padding:20px">Henüz serbest maç eklemedin.<br><br>📌 "➕ Maç Ekle" ile istediğin maçı ekle.</div></div>';
    return;
  }
  c.innerHTML = serbestData.map((m, idx) => {
    const a = macAnalizEt(m.id, m.o1, m.oX, m.o2);
    const t = tahminUret(a);
    const man = manuelSecimler['iddaa-'+m.id];
    const k = man ? 'MANUEL ' + man : t.karar;
    const cls = k.includes('BANKO') ? 'banko' : k.includes('ÇİFT') ? 'cift' : k.includes('ÜÇLÜ') ? 'uclu' : 'surpriz';
    const iko = k.includes('BANKO') ? '🔒' : k.includes('ÇİFT') ? '⚠️' : k.includes('ÜÇLÜ') ? '🔥' : '🎲';
    
    let ek = '';
    if(m.kgvar){
      const dv = degerVarMi('KG Var', m.kgvar, a.kg);
      ek += `<div style="display:flex;justify-content:space-between;font-size:.72rem;padding:4px 0;border-bottom:1px solid var(--border)"><span>KG Var (${m.kgvar})</span><span>${dv.var ? '<b class="green">💎 '+dv.fark+'%</b>' : '<span class="muted">Normal</span>'}</span></div>`;
    }
    if(m.u25ust){
      const dv = degerVarMi('2.5 Üst', m.u25ust, a.ust25);
      ek += `<div style="display:flex;justify-content:space-between;font-size:.72rem;padding:4px 0;border-bottom:1px solid var(--border)"><span>2.5 Üst (${m.u25ust})</span><span>${dv.var ? '<b class="green">💎 '+dv.fark+'%</b>' : '<span class="muted">Normal</span>'}</span></div>`;
    }
    
    // Kelly hesabı
    const kelly = kellyHesapla(a.enYuksek.olas, parseFloat(m['o'+a.enYuksek.kod] || m.o1), kellyFraction);
    const kellyBox = kelly.degerli ? `<div class="kelly-box">💼 <b>Kelly:</b> Kasadan %${kelly.f.toFixed(2)} · Öneri: <b>${Math.round(kasa * kelly.f / 100)} TL</b> · EV: ${kelly.ev}</div>` : '';
    
    return `
    <div class="tahmin-kart ${cls}" style="margin-bottom:10px">
      <div class="tk-head">
        <span>${iko} İDDAA #${idx+1} · ${t.macSinif}</span>
        <button onclick="serbestSil(${idx})" style="background:none;border:none;color:var(--red);cursor:pointer;font-size:1rem;width:auto;padding:2px 6px">🗑️</button>
      </div>
      <div class="tk-teams">${m.mac}</div>
      <div class="oran-grid-bulten" style="margin:8px 0">
        <div class="oran-box-bulten"><div class="lbl">1</div><div class="val">${m.o1.toFixed(2)}</div><div class="pct">%${a.p1.toFixed(1)}</div></div>
        <div class="oran-box-bulten"><div class="lbl">X</div><div class="val">${m.oX.toFixed(2)}</div><div class="pct">%${a.pX.toFixed(1)}</div></div>
        <div class="oran-box-bulten"><div class="lbl">2</div><div class="val">${m.o2.toFixed(2)}</div><div class="pct">%${a.p2.toFixed(1)}</div></div>
      </div>
      <div class="tk-ana" style="padding:10px">
        <div class="lbl">${k}</div>
        <div class="val" style="font-size:1.4rem">${man || t.ana_tahmin}</div>
      </div>
      <div class="tk-info">
        <div class="tk-item"><span class="lbl">Güven</span><span class="val">%${t.guven}</span></div>
        <div class="tk-item"><span class="lbl">Tuzak</span><span class="val">%${t.favoriTuzagi}</span></div>
        <div class="tk-item"><span class="lbl">Beraberlik</span><span class="val">${t.beraberlikSinif}</span></div>
        <div class="tk-item"><span class="lbl">xG</span><span class="val">${a.xgEv.toFixed(2)}-${a.xgDep.toFixed(2)}</span></div>
      </div>
      ${ek ? `<div class="analiz-box" style="margin-top:8px"><div class="analiz-lbl" style="font-size:.7rem;margin-bottom:6px">🎯 GİRDİĞİN BAHİSLER</div>${ek}</div>` : ''}
      ${kellyBox}
      <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:6px;margin-top:8px">
        <button onclick="macDetayGoster('iddaa',${m.id})" class="gray" style="padding:8px;font-size:.75rem">🔍</button>
        <button onclick="serbestManuel(${m.id},'1')" class="${man === '1' ? 'blue' : 'gray'}" style="padding:8px;font-size:.8rem">1</button>
        <button onclick="serbestManuel(${m.id},'X')" class="${man === 'X' ? 'blue' : 'gray'}" style="padding:8px;font-size:.8rem">X</button>
        <button onclick="serbestManuel(${m.id},'2')" class="${man === '2' ? 'blue' : 'gray'}" style="padding:8px;font-size:.8rem">2</button>
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
  const c = $('tahminListesi');
  if(!c) return;
  let html = '';
  const totoA = matchesData.map(m => {
    const od = oddsData[m.id];
    if(!od || !od['1'] || !od['X'] || !od['2']) return null;
    const a = macAnalizEt(m.id, od['1'], od['X'], od['2']);
    const t = tahminUret(a);
    return { tip:'toto', m, a, t, man: manuelSecimler['toto-'+m.id], id:m.id, isim:m.home+' - '+m.away, tarih:m.date };
  }).filter(x => x);
  const iddaaA = serbestData.map(m => {
    const a = macAnalizEt(m.id, m.o1, m.oX, m.o2);
    const t = tahminUret(a);
    return { tip:'iddaa', m, a, t, man: manuelSecimler['iddaa-'+m.id], id:m.id, isim:m.mac, tarih:m.tarih };
  });
  if(!totoA.length && !iddaaA.length){
    c.innerHTML = '<div class="card"><div class="muted" style="text-align:center;padding:20px">Maç yok.</div></div>';
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
  c.innerHTML = html;
}

function tahminKartHTML({tip, m, a, t, man, id, isim, tarih}){
  const k = man ? 'MANUEL ' + man : t.karar;
  const ana = man || t.ana_tahmin;
  const cls = k.includes('BANKO') ? 'banko' : k.includes('ÇİFT') ? 'cift' : k.includes('ÜÇLÜ') ? 'uclu' : 'surpriz';
  const iko = k.includes('BANKO') ? '🔒' : k.includes('ÇİFT') ? '⚠️' : k.includes('ÜÇLÜ') ? '🔥' : '🎲';
  return `
    <div class="tahmin-kart ${cls}" onclick="macDetayGoster('${tip}',${id})" style="cursor:pointer">
      <div class="tk-head">
        <span>${tarih} · ${tip === 'toto' ? 'TOTO' : 'İDDAA'} · ${t.macSinif}</span>
        <span>${iko} #${tip === 'toto' ? id : ''}${man ? ' [M]' : ''}</span>
      </div>
      <div class="tk-teams">${isim}</div>
      <div class="tk-ana"><div class="lbl">${k}</div><div class="val">${ana}</div></div>
      <div class="tk-info">
        <div class="tk-item"><span class="lbl">Güven</span><span class="val">%${t.guven}</span></div>
        <div class="tk-item"><span class="lbl">Tuzak</span><span class="val">%${t.favoriTuzagi}</span></div>
        <div class="tk-item"><span class="lbl">Beraberlik</span><span class="val">${t.beraberlikSinif}</span></div>
        <div class="tk-item"><span class="lbl">Kalite</span><span class="val">${t.kalite}</span></div>
      </div>
      <div class="tk-alt"><b>Alt:</b> ${t.alternatif} · <b>Sür:</b> ${t.surpriz} · <b>Sınıf:</b> ${t.favSinif}</div>
    </div>`;
}

/* ============ STATS ============ */
function updateStats(){
  const hepsi = [];
  matchesData.forEach(m => {
    const od = oddsData[m.id];
    if(!od || !od['1']) return;
    const a = macAnalizEt(m.id, od['1'], od['X'], od['2']);
    if(!a) return;
    const t = tahminUret(a);
    const man = manuelSecimler['toto-'+m.id];
    hepsi.push(man ? {...t, karar:'MANUEL '+man} : t);
  });
  serbestData.forEach(m => {
    const a = macAnalizEt(m.id, m.o1, m.oX, m.o2);
    if(!a) return;
    const t = tahminUret(a);
    const man = manuelSecimler['iddaa-'+m.id];
    hepsi.push(man ? {...t, karar:'MANUEL '+man} : t);
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
    if(!od || !od['1'] || !od['X'] || !od['2']){ showToast('error','Oran Yok','Oran gir.'); return; }
    o1 = od['1']; oX = od['X']; o2 = od['2'];
    isim = m.home + ' - ' + m.away; tarih = m.date; league = m.league;
  } else {
    m = serbestData.find(x => x.id === id);
    if(!m) return;
    o1 = m.o1; oX = m.oX; o2 = m.o2;
    isim = m.mac; tarih = m.tarih; league = '';
  }
  const a = macAnalizEt(id, o1, oX, o2);
  const t = tahminUret(a);
  const o = oranToOlasilik(parseFloat(o1), parseFloat(oX), parseFloat(o2));
  const man = manuelSecimler[tip + '-' + id];
  const ent = entropyHesapla(a);
  const kap = kapsamaHesapla(a, 20);
  const kapHTML = Object.keys(kap).sort().map(k => {
    const y = Math.round(kap[k] / 20 * 100);
    return `<div style="display:flex;justify-content:space-between;font-size:.75rem;padding:3px 0"><span>${k}</span><span><b>${kap[k]}</b> kolon (%${y})</span></div>`;
  }).join('');
  
  // Skor matrisi (top 5)
  const skorSirali = Object.entries(a.skorlar).sort((x,y) => y[1]-x[1]).slice(0,5);
  const skorHTML = skorSirali.map(([k,v]) => `<div style="display:flex;justify-content:space-between;font-size:.72rem;padding:2px 0"><span>${k}</span><span class="green">%${(v*100).toFixed(2)}</span></div>`).join('');
  
  // Kelly
  const oranFav = parseFloat(tip === 'toto' ? oddsData[id][t.ana_tahmin] : (t.ana_tahmin === '1' ? o1 : t.ana_tahmin === 'X' ? oX : o2));
  const kelly = kellyHesapla(a.enYuksek.olas, oranFav, kellyFraction);
  
  $('macDetayTitle').innerText = '📊 ' + (tip === 'toto' ? 'MAÇ #' + id : 'İDDAA');
  $('macDetayBody').innerHTML = `
    <div style="font-size:.8rem;line-height:1.8">
      <div style="text-align:center;margin-bottom:14px">
        <div style="font-weight:900;font-size:1rem">${isim}</div>
        <div style="color:var(--muted);font-size:.7rem;margin-top:4px">${tarih}${league ? ' · '+league : ''}</div>
        <div style="margin-top:8px;padding:6px 12px;background:var(--bg2);border-radius:8px;display:inline-block;font-size:.72rem;font-weight:800;color:var(--green)">${t.macSinif}</div>
      </div>
      
      <div class="analiz-box">
        <div class="analiz-row"><span class="analiz-lbl">📊 ORANLAR</span></div>
        <div class="analiz-row"><span>1: <b>${o1}</b></span><span>X: <b>${oX}</b></span><span>2: <b>${o2}</b></span></div>
        <div class="analiz-row"><span class="muted">Marj: %${o.marj}</span></div>
      </div>
      
      <div class="analiz-box">
        <div class="analiz-row"><span class="analiz-lbl">🎯 HİBRİT OLASILIK (%60 Oran + %40 Poisson)</span></div>
        <div class="analiz-row"><span>1: <b class="green">%${a.p1.toFixed(1)}</b></span><span>X: <b class="green">%${a.pX.toFixed(1)}</b></span><span>2: <b class="green">%${a.p2.toFixed(1)}</b></span></div>
        <div class="analiz-row"><span class="muted">Sadece oran: %${o.p[0].toFixed(1)} / %${o.p[1].toFixed(1)} / %${o.p[2].toFixed(1)}</span></div>
      </div>
      
      <div class="analiz-box">
        <div class="analiz-row"><span class="analiz-lbl">⚽ POISSON SKOR MATRİSİ (İlk 5)</span></div>
        <div class="analiz-row"><span class="muted">xG: ${a.xgEv.toFixed(2)} - ${a.xgDep.toFixed(2)}</span></div>
        ${skorHTML}
      </div>
      
      <div class="analiz-box">
        <div class="analiz-row"><span class="analiz-lbl">🎲 POISSON BAHİSLER</span></div>
        <div class="analiz-row"><span>KG Var: <b>%${a.kg.toFixed(1)}</b></span><span>2.5 Üst: <b>%${a.ust25.toFixed(1)}</b></span></div>
      </div>
      
      <div class="analiz-box">
        <div class="analiz-row"><span class="analiz-lbl">🎯 FAVORİ</span></div>
        <div class="analiz-row"><span>Favori: <b class="green">${t.ana_tahmin}</b> (%${a.enYuksek.olas.toFixed(1)})</span></div>
        <div class="analiz-row"><span>Sınıf: <b>${a.favSinif}</b></span></div>
      </div>
      
      <div class="sürpriz-alert">
        <div class="baslik">⚠️ TUZAK: %${t.favoriTuzagi} · ${a.tuzakSinif}</div>
        <div class="neden">Kazanamama: <b>%${t.kazanamaRiski}</b></div>
      </div>
      
      ${kelly.degerli ? `
      <div class="kelly-box">
        💼 <b>KELLY CRITERION</b><br>
        Kasadan: <b>%${kelly.f.toFixed(2)}</b> · Öneri: <b>${Math.round(kasa * kelly.f / 100)} TL</b><br>
        EV: <b>${kelly.ev}</b> · Kasa: ${kasa} TL
      </div>` : ''}
      
      <div class="tahmin-kart ${t.karar.includes('BANKO') ? 'banko' : t.karar.includes('ÇİFT') ? 'cift' : 'uclu'}">
        <div class="tk-head"><span>TAHMİN</span><span>GÜVEN %${t.guven}</span></div>
        <div class="tk-ana"><div class="lbl">${t.karar}</div><div class="val">${t.ana_tahmin}</div></div>
        <div class="tk-info">
          <div class="tk-item"><span class="lbl">Alt</span><span class="val">${t.alternatif}</span></div>
          <div class="tk-item"><span class="lbl">Sür</span><span class="val">${t.surpriz}</span></div>
          <div class="tk-item"><span class="lbl">Risk</span><span class="val">${t.risk}</span></div>
          <div class="tk-item"><span class="lbl">Kalite</span><span class="val">${t.kalite}</span></div>
        </div>
      </div>
      
      <div class="analiz-box">
        <div class="analiz-row"><span class="analiz-lbl">🎯 KAPSAMA (20)</span></div>
        ${kapHTML}
      </div>
      
      <div style="margin-top:12px">
        <div style="font-weight:800;color:var(--orange);font-size:.78rem;margin-bottom:8px">MANUEL</div>
        <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:6px">
          <button onclick="detayManuel('${tip}',${id},'1')" class="${man === '1' ? 'blue' : 'gray'}" style="padding:10px">1</button>
          <button onclick="detayManuel('${tip}',${id},'X')" class="${man === 'X' ? 'blue' : 'gray'}" style="padding:10px">X</button>
          <button onclick="detayManuel('${tip}',${id},'2')" class="${man === '2' ? 'blue' : 'gray'}" style="padding:10px">2</button>
        </div>
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
    const a = macAnalizEt(m.id, od['1'], od['X'], od['2']);
    if(!a) return;
    hepsi.push({ tip:'toto', m, a, t:tahminUret(a), man:manuelSecimler['toto-'+m.id], isim:m.home+' - '+m.away });
  });
  serbestData.forEach(m => {
    const a = macAnalizEt(m.id, m.o1, m.oX, m.o2);
    if(!a) return;
    hepsi.push({ tip:'iddaa', m, a, t:tahminUret(a), man:manuelSecimler['iddaa-'+m.id], isim:m.mac });
  });
  if(!hepsi.length){ showToast('error','Maç Yok','Önce maç gir.'); return; }
  const banko = hepsi.filter(x => (x.man || x.t.karar).includes('BANKO')).length;
  const cift = hepsi.filter(x => (x.man || x.t.karar).includes('ÇİFT')).length;
  const uclu = hepsi.filter(x => (x.man || x.t.karar).includes('ÜÇLÜ')).length;
  const ort = Math.round(hepsi.reduce((t,x) => t + x.t.guven, 0) / hepsi.length);
  const kritik = [...hepsi].sort((x,y) => y.t.entropy - x.t.entropy).slice(0, 3);
  $('tahminModalBody').innerHTML = `
    <div style="font-size:.8rem;line-height:1.8">
      <div style="background:var(--bg2);border-radius:10px;padding:12px;margin-bottom:12px">
        <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;text-align:center">
          <div><div style="color:var(--green);font-weight:900;font-size:1.2rem">${banko}</div><div style="color:var(--muted);font-size:.6rem">BANKO</div></div>
          <div><div style="color:var(--orange);font-weight:900;font-size:1.2rem">${cift}</div><div style="color:var(--muted);font-size:.6rem">ÇİFT</div></div>
          <div><div style="color:var(--red);font-weight:900;font-size:1.2rem">${uclu}</div><div style="color:var(--muted);font-size:.6rem">ÜÇLÜ</div></div>
          <div><div style="color:var(--blue);font-weight:900;font-size:1.2rem">%${ort}</div><div style="color:var(--muted);font-size:.6rem">GÜVEN</div></div>
        </div>
      </div>
      <div style="background:rgba(255,77,94,.1);border:1px solid rgba(255,77,94,.4);border-radius:10px;padding:10px;margin-bottom:12px">
        <div style="color:var(--red);font-weight:900;font-size:.78rem;margin-bottom:6px">🚨 KRİTİK MAÇLAR</div>
        ${kritik.map(x => `<div style="font-size:.72rem;color:var(--muted);padding:3px 0"><b style="color:var(--orange)">${x.tip === 'toto' ? '#'+x.m.id : 'İ'}</b> ${x.isim} · Ent: ${x.t.entropy}</div>`).join('')}
      </div>
      ${hepsi.map(x => {
        const k = x.man ? 'MANUEL ' + x.man : x.t.karar;
        const ana = x.man || x.t.ana_tahmin;
        const ik = k.includes('BANKO') ? '🔒' : k.includes('ÇİFT') ? '⚠️' : k.includes('ÜÇLÜ') ? '🔥' : '🎲';
        const r = k.includes('BANKO') ? 'green' : k.includes('ÇİFT') ? 'orange' : k.includes('ÜÇLÜ') ? 'red' : 'purple';
        return `<div style="background:var(--bg2);border-left:3px solid var(--${r});border-radius:8px;padding:8px 10px;margin-bottom:6px">
          <div style="font-weight:800;font-size:.78rem">${ik} ${x.tip === 'toto' ? '#'+x.m.id : ''} ${x.isim}</div>
          <div style="font-size:.7rem;color:var(--muted);margin-top:4px"><b style="color:var(--${r})">${ana}</b> · ${k} · %${x.t.guven} · Tuzak %${x.t.favoriTuzagi}</div>
        </div>`;
      }).join('')}
    </div>`;
  $('tahminModal').classList.add('active');
}

/* ============ KUPON ============ */
function setKuponKaynak(k, el){
  kuponKaynak = k;
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
  let kaynak = [];
  if(kuponKaynak === 'toto' || kuponKaynak === 'karisik'){
    matchesData.forEach(m => {
      const od = oddsData[m.id];
      if(!od || !od['1'] || !od['X'] || !od['2']) return;
      const a = macAnalizEt(m.id, od['1'], od['X'], od['2']);
      if(!a) return;
      const t = tahminUret(a);
      const man = manuelSecimler['toto-'+m.id];
      kaynak.push({ tip:'toto', id:m.id, isim:m.home+' - '+m.away, odds:od, a, t, karar: man ? 'MANUEL '+man : t.karar, ana: man || t.ana_tahmin, manuel: !!man });
    });
  }
  if(kuponKaynak === 'iddaa' || kuponKaynak === 'karisik'){
    serbestData.forEach(m => {
      const a = macAnalizEt(m.id, m.o1, m.oX, m.o2);
      if(!a) return;
      const t = tahminUret(a);
      const man = manuelSecimler['iddaa-'+m.id];
      kaynak.push({ tip:'iddaa', id:m.id, isim:m.mac, odds:{'1':m.o1,'X':m.oX,'2':m.o2}, a, t, karar: man ? 'MANUEL '+man : t.karar, ana: man || t.ana_tahmin, manuel: !!man });
    });
  }
  if(!kaynak.length){ showToast('error','Maç Yok','Kaynak boş.');
