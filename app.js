/* ============================================================
   SKORLAB v13 · TOTO MODU (Tek/Çift/Üçlü Seçim)
   ============================================================ */

let matchesData = [];
let oddsData = {};
let kayitliKuponlar = JSON.parse(localStorage.getItem('skorlab_kuponlar') || '[]');
let secimlerim = JSON.parse(localStorage.getItem('skorlab_secimlerim') || '{}');
let kasa = parseFloat(localStorage.getItem('skorlab_kasa') || '1000');
let kasaBaslangic = parseFloat(localStorage.getItem('skorlab_kasa_bas') || '1000');
let kasaGecmisi = JSON.parse(localStorage.getItem('skorlab_kasa_gecmisi') || '[]');
let weekKey = 'default';
let kasaChart = null;

const $ = id => document.getElementById(id);

/* ============================================================
   POISSON
   ============================================================ */
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

/* ============================================================
   SINIFLANDIRMA
   ============================================================ */
function favSinifi(f){
  if(f>=70) return 'ÇOK GÜÇLÜ FAVORİ';
  if(f>=60) return 'GÜÇLÜ FAVORİ';
  if(f>=52) return 'ORTA FAVORİ';
  if(f>=45) return 'RİSKLİ FAVORİ';
  return 'NET FAVORİ DEĞİL';
}
function beraberlikSinifi(p){
  if(p>=30) return 'ÇOK YÜKSEK';
  if(p>=25) return 'YÜKSEK';
  if(p>=20) return 'ORTA';
  if(p>=15) return 'DÜŞÜK';
  return 'ÇOK DÜŞÜK';
}
function tuzakSinifi(f){
  const r = 100-f;
  if(r>=50) return 'ÇOK YÜKSEK';
  if(r>=40) return 'YÜKSEK';
  if(r>=30) return 'ORTA';
  if(r>=20) return 'DÜŞÜK';
  return 'ÇOK DÜŞÜK';
}

function entropyHesapla(a){
  if(!a) return 0;
  const p1=a.p1/100, pX=a.pX/100, p2=a.p2/100;
  let H=0;
  if(p1>0) H -= p1*Math.log2(p1);
  if(pX>0) H -= pX*Math.log2(pX);
  if(p2>0) H -= p2*Math.log2(p2);
  return H/1.585;
}

function bankoKalite(a){
  if(!a) return 0;
  const fav=a.enYuksek.olas, fark=a.fark, ent=entropyHesapla(a);
  const fp = Math.max(0, Math.min(50, (fav-40)*(50/45)));
  const kp = Math.max(0, Math.min(30, fark*(30/40)));
  const ep = Math.max(0, (1-ent)*20);
  return Math.round(fp+kp+ep);
}

function oranBandi(oran){
  if(oran <= 1.25) return { kod:'banko', etiket:'🔒 BANKO' };
  if(oran <= 1.45) return { kod:'guvenli', etiket:'✅ GÜVENLİ' };
  if(oran <= 1.60) return { kod:'riskli', etiket:'⚠️ RİSKLİ' };
  if(oran <= 2.10) return { kod:'denge', etiket:'⚡ DENGE' };
  return { kod:'surpriz', etiket:'🚨 SÜRPRİZ' };
}

/* ============================================================
   VALUE BET
   ============================================================ */
function valueBetHesapla(a, oranlar){
  const result = {};
  ['1','X','2'].forEach(s => {
    const oran = parseFloat(oranlar[s]);
    const bahisciOlas = (1/oran) * 100;
    const sistemOlas = s==='1'?a.p1:s==='X'?a.pX:a.p2;
    const ev = (sistemOlas/100) * oran;
    const fark = sistemOlas - bahisciOlas;
    result[s] = { oran, bahisciOlas, sistemOlas, ev, fark, degerli: ev > 1.12 };
  });
  return result;
}

function enIyiValue(vbMap){
  let enIyi = null, enYuksekEv = 0;
  Object.keys(vbMap).forEach(k => {
    if(vbMap[k].ev > enYuksekEv){ enYuksekEv = vbMap[k].ev; enIyi = k; }
  });
  return { kod: enIyi, ev: enYuksekEv, degerli: enYuksekEv > 1.12 };
}

/* ============================================================
   ANALİZ
   ============================================================ */
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
  const fark = enYuksek.olas - ikinci.olas;
  const favoriTuzagi = 100 - enYuksek.olas;
  const oranlar = { '1': o1, 'X': oX, '2': o2 };
  const favOran = oranlar[enYuksek.kod];

  const a = {
    id,
    p1:hib.p1, pX:hib.pX, p2:hib.p2,
    oranP1:o.p[0], oranPX:o.p[1], oranP2:o.p[2], marj:parseFloat(o.marj),
    poissonP1:poi.p1, poissonPX:poi.pX, poissonP2:poi.p2,
    kg:poi.kg, ust25:poi.ust25, skorlar:poi.skorlar,
    xgEv:xg.xgEv, xgDep:xg.xgDep,
    sirali, enYuksek, ikinci, ucuncu, fark,
    favoriTuzagi, surprizOlas:ucuncu.olas,
    favOran, oranlar,
    favSinif:favSinifi(enYuksek.olas),
    beraberlikSinif:beraberlikSinifi(hib.pX),
    tuzakSinif:tuzakSinifi(enYuksek.olas),
    band: oranBandi(favOran)
  };

  a.valueBet = valueBetHesapla(a, oranlar);
  a.enIyiValue = enIyiValue(a.valueBet);

  const fav = enYuksek.olas, tuzak = 100-fav, px = hib.pX;
  if(fav>=65 && tuzak<=35 && px<=25) a.macSinif = 'BANKO ADAYI';
  else if(fav>=52 && fav<65) a.macSinif = 'RİSKLİ FAVORİ';
  else if(tuzak>35 && fav>=45) a.macSinif = 'RİSKLİ FAVORİ';
  else if(px>=25 && Math.abs(fav-px)<10) a.macSinif = 'BERABERLİK ADAYI';
  else if(ucuncu.olas>=18 && fark<15) a.macSinif = 'SÜRPRİZ ADAYI';
  else if(fav<45) a.macSinif = 'DENGELİ MAÇ';
  else a.macSinif = 'NORMAL';

  return a;
}

function siraliAlternatif(a, b){
  const s = {'1':1,'X':2,'2':3};
  return (s[a] < s[b] ? a : b) + (s[a] < s[b] ? b : a);
}

function tahminUret(a){
  if(!a) return null;
  const {enYuksek, ikinci, ucuncu} = a;
  const ent = entropyHesapla(a);
  const kalite = bankoKalite(a);
  const band = a.band;

  let karar='', guven=0, risk='';

  if(band.kod === 'banko'){ karar = 'BANKO ' + enYuksek.kod; guven = Math.min(100, Math.round(enYuksek.olas + 8)); risk = 'Çok Düşük'; }
  else if(band.kod === 'guvenli'){ karar = 'BANKO ' + enYuksek.kod; guven = Math.round(enYuksek.olas); risk = 'Düşük'; }
  else if(band.kod === 'riskli'){ karar = 'ÇİFT ' + siraliAlternatif(enYuksek.kod, ikinci.kod); guven = Math.round(enYuksek.olas); risk = 'Orta-Yüksek'; }
  else if(band.kod === 'denge'){ karar = 'ÇİFT ' + siraliAlternatif(enYuksek.kod, ikinci.kod); guven = Math.round(enYuksek.olas - 3); risk = 'Yüksek'; }
  else { karar = 'ÜÇLÜ 1X2'; guven = Math.max(30, Math.round(enYuksek.olas - 8)); risk = 'Çok Yüksek'; }

  return {
    ana_tahmin:enYuksek.kod, surpriz:ucuncu.kod,
    guven:Math.round(guven), risk, karar,
    entropy:Math.round(ent*100), kalite, macSinif:a.macSinif,
    favSinif:a.favSinif, beraberlikSinif:a.beraberlikSinif,
    favoriTuzagi:Math.round(a.favoriTuzagi),
    band: a.band, enIyiValue: a.enIyiValue
  };
}

/* ============================================================
   VERİ YÜKLE
   ============================================================ */
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
    // Sessiz geç — localStorage'daki veri varsa onu kullan
    const kayitli = localStorage.getItem('skorlab_last_matches');
    if(kayitli){
      try{
        matchesData = JSON.parse(kayitli);
        $('weekTitle').innerText = 'Kaydedilmiş Bülten';
      }catch(err){}
    }
  }

  // matchesData'yı localStorage'a kaydet (offline için)
  if(matchesData.length){
    localStorage.setItem('skorlab_last_matches', JSON.stringify(matchesData));
  }

  renderBulten();
  updateStats();
  updateKuponCubugu();
  renderKayitliKuponlar();
  renderKasa();
  renderKarsilastirma();
}

/* ============================================================
   BÜLTEN
   ============================================================ */
function renderBulten(){
  if(!matchesData.length){
    $('matchesList').innerHTML = '<div class="card"><div class="muted" style="text-align:center;padding:20px">Maç yok.</div></div>';
    return;
  }

  $('matchesList').innerHTML = matchesData.map(m => {
    const od = oddsData[m.id] || {};
    const has = od['1'] && od['X'] && od['2'];
    const a = has ? macAnalizEt(m.id, od['1'], od['X'], od['2']) : null;
    const t = a ? tahminUret(a) : null;

    /* Seçimler: her maçta 1/X/2 ayrı ayrı seçili olabilir */
    const sec = secimlerim['toto-'+m.id] || [];
    const sec1 = sec.includes('1');
    const secX = sec.includes('X');
    const sec2 = sec.includes('2');

    const p1 = a ? a.p1 : 0;
    const pX = a ? a.pX : 0;
    const p2 = a ? a.p2 : 0;

    let sistemTag = '';
    if(t){
      const c = t.karar.includes('BANKO')?'green':t.karar.includes('ÇİFT')?'yellow':t.karar.includes('ÜÇLÜ')?'red':'purple';
      sistemTag = `<span class="badge ${c}">🤖 ${t.karar}</span>`;
    }
    let degerTag = '';
    if(a && a.enIyiValue.degerli){
      degerTag = `<span class="value-tag value-yes">💎 ${a.enIyiValue.kod}</span>`;
    }

    /* Seçim özeti */
    let secimOzet = '';
    if(sec.length === 1) secimOzet = sec[0];
    else if(sec.length === 2) secimOzet = sec.join('');
    else if(sec.length === 3) secimOzet = 'KAPALI';

    return `
    <div class="sade-mac">
      <div class="sade-mac-head">
        <span class="sade-mac-no">#${m.id}</span>
        <span class="sade-mac-tarih">${m.date}${m.league?' · '+m.league:''}${secimOzet?' · <b style="color:var(--green)">'+secimOzet+'</b>':''}</span>
      </div>
      <div class="sade-mac-teams" onclick="macDetayGoster(${m.id})">
        ${m.home} - ${m.away}
        ${sistemTag}
        ${degerTag}
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

/* ============================================================
   SEÇİM TOGGLE (1/X/2 ayrı ayrı)
   ============================================================ */
function secimToggle(id, secim){
  const key = 'toto-' + id;
  let sec = secimlerim[key] || [];
  if(sec.includes(secim)){
    sec = sec.filter(s => s !== secim);
  } else {
    sec.push(secim);
  }
  if(sec.length === 0){
    delete secimlerim[key];
  } else {
    secimlerim[key] = sec;
  }
  localStorage.setItem('skorlab_secimlerim', JSON.stringify(secimlerim));
  renderBulten();
  updateStats();
  updateKuponCubugu();
}

function tumSecimleriSil(){
  if(!confirm('Tüm seçimleri silmek istediğine emin misin?')) return;
  secimlerim = {};
  localStorage.setItem('skorlab_secimlerim', JSON.stringify(secimlerim));
  renderBulten();
  updateStats();
  updateKuponCubugu();
}

/* ============================================================
   KUPON ÇUBUĞU (Kolon hesabı)
   ============================================================ */
function kuponHesapla(){
  let macSayisi = 0;
  let kolon = 1;
  const detaylar = [];

  Object.keys(secimlerim).forEach(key => {
    const sec = secimlerim[key];
    if(!sec || !sec.length) return;
    macSayisi++;
    kolon *= sec.length;
    const [tip, idStr] = key.split('-');
    detaylar.push({ tip, id: parseInt(idStr), secimler: sec });
  });

  const misli = parseInt(($('kcMisli') || {}).value) || 1;
  const tutar = kolon * misli * 10;

  return { macSayisi, kolon, misli, tutar, detaylar };
}

function updateKuponCubugu(){
  const h = kuponHesapla();
  const kcM = $('kcMac'); if(kcM) kcM.innerText = h.macSayisi;
  const kcK = $('kcKolon'); if(kcK) kcK.innerText = h.kolon;
  const kcT = $('kcTutar'); if(kcT) kcT.innerText = h.tutar + ' TL';
  const sS = $('statSecilen'); if(sS) sS.innerText = h.macSayisi;
  const sK = $('statKolon'); if(sK) sK.innerText = h.kolon;
}

/* ============================================================
   İSTATİSTİK
   ============================================================ */
function updateStats(){
  const sM = $('statMac'); if(sM) sM.innerText = matchesData.length;

  let banko = 0, deger = 0;
  matchesData.forEach(m => {
    const od = oddsData[m.id];
    if(!od || !od['1']) return;
    const a = macAnalizEt(m.id, od['1'], od['X'], od['2']);
    if(!a) return;
    if(a.band.kod === 'banko' || a.band.kod === 'guvenli') banko++;
    if(a.enIyiValue && a.enIyiValue.degerli) deger++;
  });

  const sB = $('statBanko'); if(sB) sB.innerText = banko;
  const sD = $('statDeger'); if(sD) sD.innerText = deger;
}

/* ============================================================
   KUPONU KAYDET
   ============================================================ */
function kuponuKaydet(){
  const h = kuponHesapla();
  if(h.macSayisi === 0){
    showToast('error','Seçim Yok','Hiç maç seçmedin. 1-X-2 tıkla.');
    return;
  }

  const detaylar = [];
  h.detaylar.forEach(d => {
    const m = matchesData.find(x => x.id === d.id);
    if(!m) return;
    const od = oddsData[d.id] || {};
    const a = macAnalizEt(d.id, od['1'], od['X'], od['2']);
    const t = tahminUret(a);
    detaylar.push({
      id: d.id,
      isim: m.home + ' - ' + m.away,
      secim: d.secimler.join(''),
      secimler: d.secimler,
      sistemTahmin: t.karar,
      sistemAnaTahmin: t.ana_tahmin
    });
  });

  const yeni = {
    id: Date.now(),
    tarih: new Date().toLocaleString('tr-TR'),
    macSayisi: h.macSayisi,
    kolon: h.kolon,
    misli: h.misli,
    tutar: h.tutar,
    detaylar: detaylar,
    durum: 'bekliyor'
  };

  kayitliKuponlar.unshift(yeni);
  if(kayitliKuponlar.length > 50) kayitliKuponlar = kayitliKuponlar.slice(0, 50);
  localStorage.setItem('skorlab_kuponlar', JSON.stringify(kayitliKuponlar));

  /* Seçimleri temizle */
  secimlerim = {};
  localStorage.setItem('skorlab_secimlerim', JSON.stringify(secimlerim));

  renderBulten();
  updateStats();
  updateKuponCubugu();
  renderKayitliKuponlar();
  renderKarsilastirma();

  showToast('success','Kupon Kaydedildi!', h.macSayisi + ' maç · ' + h.kolon + ' kolon · ' + h.tutar + ' TL');
}

/* ============================================================
   KUPONLARIM
   ============================================================ */
function renderKayitliKuponlar(){
  const c = $('kayitliKuponlar');
  if(!c) return;
  if(!kayitliKuponlar.length){
    c.innerHTML = '<div class="muted" style="text-align:center;padding:20px">Henüz kayıtlı kupon yok.<br>Bülten\'den maç seç, "KAYDET" bas.</div>';
    return;
  }
  c.innerHTML = kayitliKuponlar.map(k => {
    const renk = k.durum === 'kazandi' ? 'kazandi' : k.durum === 'kaybetti' ? 'kaybetti' : 'bekliyor';
    const emoji = k.durum === 'kazandi' ? '✅' : k.durum === 'kaybetti' ? '❌' : '⏳';
    return `
      <div class="kupon-gecmis ${renk}" onclick="kuponDetayAc(${k.id})" style="cursor:pointer">
        <div style="display:flex;justify-content:space-between;font-size:.75rem;margin-bottom:4px">
          <span>${emoji} <b>${k.macSayisi} maç</b> · ${k.kolon} kolon</span>
          <span class="muted">${k.tarih}</span>
        </div>
        <div style="font-size:.68rem;color:var(--muted)">Tutar: <b style="color:var(--green)">${k.tutar} TL</b> · Misli: ${k.misli}</div>
      </div>`;
  }).join('');
}

function kuponDetayAc(id){
  const k = kayitliKuponlar.find(x => x.id === id);
  if(!k) return;
  const emoji = k.durum === 'kazandi' ? '✅' : k.durum === 'kaybetti' ? '❌' : '⏳';

  $('kuponDetayBody').innerHTML = `
    <div style="font-size:.75rem">
      <div class="muted" style="margin-bottom:10px">${emoji} ${k.tarih} · ${k.macSayisi} maç · ${k.kolon} kolon · ${k.tutar} TL</div>

      <div style="max-height:400px;overflow-y:auto;background:var(--bg3);border-radius:8px;padding:10px">
        ${k.detaylar.map((d,i) => `
          <div style="padding:8px 0;border-bottom:1px solid var(--border);font-size:.72rem">
            <div style="font-weight:800;margin-bottom:4px">${d.isim}</div>
            <div style="display:flex;justify-content:space-between;color:var(--muted)">
              <span>🤖 <b style="color:var(--blue)">${d.sistemTahmin}</b></span>
              <span>🖐️ <b style="color:var(--green)">${d.secim}</b></span>
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

/* ============================================================
   KARŞILAŞTIRMA
   ============================================================ */
function renderKarsilastirma(){
  const c = $('karsilastirmaListesi');
  if(!c) return;

  let sistemDogru = 0, sistemYanlis = 0;
  let benimDogru = 0, benimYanlis = 0;

  kayitliKuponlar.forEach(k => {
    if(k.durum === 'bekliyor') return;
    if(k.durum === 'kazandi'){
      sistemDogru += k.macSayisi;
      benimDogru += k.macSayisi;
    } else if(k.durum === 'kaybetti'){
      sistemYanlis += k.macSayisi;
      benimYanlis += k.macSayisi;
    }
  });

  const sistemToplam = sistemDogru + sistemYanlis;
  const benimToplam = benimDogru + benimYanlis;
  const sistemOran = sistemToplam ? Math.round(sistemDogru/sistemToplam*100) : 0;
  const benimOran = benimToplam ? Math.round(benimDogru/benimToplam*100) : 0;

  if(sistemToplam === 0 && benimToplam === 0){
    c.innerHTML = '<div class="muted" style="text-align:center;padding:20px">Henüz sonuç girilmedi.<br>Kuponları "Kazandı" veya "Kaybetti" olarak işaretle.</div>';
    return;
  }

  const kazanan = sistemOran > benimOran ? 'sistem' : benimOran > sistemOran ? 'ben' : 'berabere';
  const mesajClass = kazanan === 'sistem' ? 'sistem-kazandi' : kazanan === 'ben' ? 'sen-kazandin' : 'berabere';
  const mesajText = kazanan === 'sistem' ? '🤖 SİSTEM ÖNDE' : kazanan === 'ben' ? '🖐️ SEN ÖNDESİN' : '🤝 BERABERE';

  c.innerHTML = `
    <div class="karsilastirma-grid">
      <div class="karsilastirma-taraf ${kazanan==='sistem'?'kazanan':''}">
        <div class="lbl">🤖 SİSTEM</div>
        <div class="skor" style="color:var(--blue)">%${sistemOran}</div>
        <div class="alt">${sistemDogru} / ${sistemToplam} tuttu</div>
      </div>
      <div class="karsilastirma-taraf ${kazanan==='ben'?'kazanan':''}">
        <div class="lbl">🖐️ SEN</div>
        <div class="skor" style="color:var(--green)">%${benimOran}</div>
        <div class="alt">${benimDogru} / ${benimToplam} tuttu</div>
      </div>
    </div>
    <div class="karsilastirma-mesaj ${mesajClass}">${mesajText}</div>
    <div class="muted" style="text-align:center;margin-top:12px;font-size:.7rem">
      Toplam ${kayitliKuponlar.length} kayıtlı kupon
    </div>
  `;
}

/* ============================================================
   MAÇ DETAY
   ============================================================ */
function macDetayGoster(id){
  const m = matchesData.find(x => x.id === id);
  if(!m) return;
  const od = oddsData[id];
  if(!od || !od['1'] || !od['X'] || !od['2']){
    showToast('error','Oran Yok','Bu maça oran girilmemiş.');
    return;
  }
  const o1=od['1'], oX=od['X'], o2=od['2'];
  const a = macAnalizEt(id, o1, oX, o2);
  const t = tahminUret(a);
  const sec = secimlerim['toto-'+id] || [];

  const vb = a.valueBet;
  const matrisHTML = `
    <div class="matris-box">
      <div class="matris-satir head">
        <div>Seçim</div><div>Bahisçi</div><div>Sistem</div><div>Fark</div>
      </div>
      ${['1','X','2'].map(k => {
        const v = vb[k];
        const farkClass = v.fark > 0 ? 'poz' : v.fark < 0 ? 'neg' : 'notr';
        return `<div class="matris-satir">
          <div><b>${k}</b> (${v.oran})</div>
          <div class="matris-hucre notr">%${v.bahisciOlas.toFixed(1)}</div>
          <div class="matris-hucre notr">%${v.sistemOlas.toFixed(1)}</div>
          <div class="matris-hucre ${farkClass}">${v.fark>0?'+':''}${v.fark.toFixed(1)}</div>
        </div>`;
      }).join('')}
    </div>`;

  const skorSirali = Object.entries(a.skorlar).sort((x,y) => y[1]-x[1]).slice(0,5);
  const skorHTML = skorSirali.map(([k,v]) =>
    `<div style="display:flex;justify-content:space-between;font-size:.72rem;padding:2px 0"><span>${k}</span><span class="green">%${(v*100).toFixed(2)}</span></div>`
  ).join('');

  $('macDetayTitle').innerText = '📊 MAÇ #' + id;
  $('macDetayBody').innerHTML = `
    <div style="font-size:.8rem;line-height:1.8">
      <div style="text-align:center;margin-bottom:14px">
        <div style="font-weight:900;font-size:1rem">${m.home} - ${m.away}</div>
        <div style="color:var(--muted);font-size:.7rem;margin-top:4px">${m.date}${m.league?' · '+m.league:''}</div>
        <div style="margin-top:8px">
          <span style="padding:6px 12px;background:var(--bg3);border-radius:8px;font-size:.72rem;font-weight:800;color:var(--green)">${a.band.etiket}</span>
        </div>
      </div>

      <div class="analiz-box">
        <div class="analiz-row"><span class="analiz-lbl">🎯 SİSTEM TAHMİNİ</span></div>
        <div style="text-align:center;font-weight:900;font-size:1.3rem;color:var(--green);padding:8px 0">${t.karar}</div>
        <div class="analiz-row"><span>Güven: %${t.guven}</span><span>Risk: ${t.risk}</span></div>
      </div>

      <div class="analiz-box">
        <div class="analiz-row"><span class="analiz-lbl">💎 VALUE BET MATRİSİ</span></div>
        ${matrisHTML}
      </div>

      <div class="analiz-box">
        <div class="analiz-row"><span class="analiz-lbl">⚽ POISSON SKOR (İlk 5)</span></div>
        <div class="analiz-row"><span class="muted">xG: ${a.xgEv.toFixed(2)} - ${a.xgDep.toFixed(2)}</span></div>
        ${skorHTML}
      </div>

      <div style="margin-top:16px;padding:12px;background:var(--bg3);border-radius:10px">
        <div style="font-weight:900;color:var(--green);font-size:.8rem;margin-bottom:10px">🖐️ SENİN SEÇİMİN (Çoklu seçim yapabilirsin)</div>
        <div class="sade-mac-tahminler">
          <button class="sade-btn ${sec.includes('1')?'secili':''}" onclick="secimToggle(${id},'1');macDetayGoster(${id})">1</button>
          <button class="sade-btn ${sec.includes('X')?'secili':''}" onclick="secimToggle(${id},'X');macDetayGoster(${id})">X</button>
          <button class="sade-btn ${sec.includes('2')?'secili':''}" onclick="secimToggle(${id},'2');macDetayGoster(${id})">2</button>
        </div>
        <div class="muted" style="text-align:center;margin-top:10px;font-size:.7rem">
          Seçili: <b style="color:var(--green)">${sec.length ? sec.join('') : '—'}</b>
        </div>
      </div>
    </div>
  `;
  $('macDetayModal').classList.add('active');
}

/* ============================================================
   KASA
   ============================================================ */
function kasaGuncelle(val){
  kasa = parseFloat(val) || 0;
  localStorage.setItem('skorlab_kasa', kasa);
  renderKasa();
}

function renderKasa(){
  const c = $('kasaOzet');
  if(!c) return;
  const kar = kasa - kasaBaslangic;
  const karPct = kasaBaslangic ? (kar/kasaBaslangic*100).toFixed(1) : 0;
  const renk = kar >= 0 ? 'var(--green)' : 'var(--red)';

  c.innerHTML = `
    <div class="kasa-grid">
      <div class="kasa-item"><div class="l">GÜNCEL KASA</div><div class="v" style="color:var(--green)">${Math.round(kasa)} ₺</div></div>
      <div class="kasa-item"><div class="l">BAŞLANGIÇ</div><div class="v">${Math.round(kasaBaslangic)} ₺</div></div>
      <div class="kasa-item"><div class="l">KÂR/ZARAR</div><div class="v" style="color:${renk}">${kar>=0?'+':''}${Math.round(kar)} ₺</div></div>
      <div class="kasa-item"><div class="l">GETİRİ</div><div class="v" style="color:${renk}">${kar>=0?'+':''}${karPct}%</div></div>
    </div>`;

  renderKasaChart();
  renderROIOzet();
}

function renderKasaChart(){
  const cv = $('kasaChart');
  if(!cv) return;
  if(kasaChart) kasaChart.destroy();

  let labels = ['Başlangıç', 'Şimdi'];
  let data = [kasaBaslangic, kasa];

  kasaChart = new Chart(cv, {
    type: 'line',
    data: {
      labels,
      datasets: [{
        label: 'Kasa (₺)', data,
        borderColor: '#00e676', backgroundColor: 'rgba(0,230,118,.15)',
        borderWidth: 2, fill: true, tension: 0.3,
        pointBackgroundColor: '#00e676', pointRadius: 3
      }]
    },
    options: {
      responsive: true,
      plugins: { legend: { display: false } },
      scales: {
        x: { ticks: { color: '#7a8ba8', font: { size: 9 } }, grid: { color: 'rgba(255,255,255,.05)' } },
        y: { ticks: { color: '#7a8ba8', font: { size: 9 } }, grid: { color: 'rgba(255,255,255,.05)' } }
      }
    }
  });
}

function renderROIOzet(){
  const c = $('roiOzet');
  if(!c) return;
  const toplamKupon = kayitliKuponlar.length;
  const kazanan = kayitliKuponlar.filter(k => k.durum === 'kazandi').length;
  const kaybeden = kayitliKuponlar.filter(k => k.durum === 'kaybetti').length;
  const basariOran = (kazanan + kaybeden) ? Math.round(kazanan / (kazanan + kaybeden) * 100) : 0;
  const netKar = kasa - kasaBaslangic;
  const roi = kasaBaslangic ? (netKar/kasaBaslangic*100).toFixed(1) : 0;

  c.innerHTML = `
    <div class="roi-grid">
      <div class="roi-item"><div class="l">TOPLAM KUPON</div><div class="v">${toplamKupon}</div></div>
      <div class="roi-item"><div class="l">KAZANAN / KAYBEDEN</div><div class="v" style="color:var(--green)">${kazanan} / ${kaybeden}</div></div>
      <div class="roi-item"><div class="l">BAŞARI</div><div class="v" style="color:var(--green)">%${basariOran}</div></div>
      <div class="roi-item"><div class="l">ROI</div><div class="v" style="color:${netKar>=0?'var(--green)':'var(--red)'}">${roi}%</div><div class="s">${netKar>=0?'+':''}${Math.round(netKar)} ₺</div></div>
    </div>`;
}

/* ============================================================
   NAV / MODAL
   ============================================================ */
function switchTab(i, el){
  document.querySelectorAll('.tab, .page').forEach(e => e.classList.remove('active'));
  if(el) el.classList.add('active');
  $('page-'+i).classList.add('active');
  if(i === 3) renderKarsilastirma();
  if(i === 4) renderKasa();
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
  $('kasaInput').value = kasa;
  loadData();
};
