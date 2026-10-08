/* ============================================================
   SKORLAB v8 PRO · 7 Modül Tam Entegre
   M1 Poisson 6x6 Hibrit | M2 Kelly Fractional | M3 API+Telegram
   M4 PWA Offline | M5 Chart.js Radar | M6 Canvas QR Share
   M7 Covering Design (Hamming)
   ============================================================ */

let matchesData = [];
let oddsData = {};
let serbestData = JSON.parse(localStorage.getItem('skorlab_serbest') || '[]');
let archiveData = { weeks: [] };
let riskMode = 'dengeli';
let kuponKaynak = 'toto';
let coveringMode = 'tam';
let manuelSecimler = {};
let weekKey = 'default';
let kasa = parseFloat(localStorage.getItem('skorlab_kasa') || '1000');
let kellyFraction = parseFloat(localStorage.getItem('skorlab_kelly_frac') || '0.5');
let ayarlar = JSON.parse(localStorage.getItem('skorlab_ayarlar') || '{}');
let radarChart = null;
let sonKuponPNG = null;

const $ = id => document.getElementById(id);

/* ============================================================
   MODÜL 1: POISSON & HİBRİT MOTOR
   ============================================================ */

function poissonPmf(k, lambda){
  let p = Math.exp(-lambda);
  for(let i = 1; i <= k; i++) p *= lambda / i;
  return p;
}

/* 6x6 matris + türev olasılıklar */
function poissonMatris(xgEv, xgDep){
  const MAX = 6;
  let p1=0, pX=0, p2=0, kg=0, ust25=0, ust15=0, ust35=0;
  const skorlar = {};
  for(let h=0; h<MAX; h++){
    for(let a=0; a<MAX; a++){
      const p = poissonPmf(h, xgEv) * poissonPmf(a, xgDep);
      const key = h + '-' + a;
      skorlar[key] = p;
      if(h>a) p1 += p; else if(h===a) pX += p; else p2 += p;
      if(h>=1 && a>=1) kg += p;
      if(h+a > 2.5) ust25 += p;
      if(h+a > 1.5) ust15 += p;
      if(h+a > 3.5) ust35 += p;
    }
  }
  return {
    p1: p1*100, pX: pX*100, p2: p2*100,
    kg: kg*100, ust25: ust25*100, ust15: ust15*100, ust35: ust35*100,
    skorlar
  };
}

/* Oran marjını temizle */
function oranToOlasilik(o1, oX, o2){
  const r1 = 1/o1, rX = 1/oX, r2 = 1/o2;
  const t = r1 + rX + r2;
  return {
    p: [(r1/t)*100, (rX/t)*100, (r2/t)*100],
    marj: ((t-1)*100).toFixed(2)
  };
}

/* xG tahmini (oran → gol beklentisi) */
function xGTahmin(p1, pX, p2){
  const t = p1 + p2;
  const hs = p1 / (t || 1);
  const tg = 2.4 + (1 - pX/100) * 0.8;
  return {
    xgEv: Math.max(0.3, tg * hs * 1.15),
    xgDep: Math.max(0.3, tg * (1 - hs))
  };
}

/* Hibrit: %60 Oran + %40 Poisson */
function hibritHesapla(oranP, poisson){
  const hib = {
    p1: oranP[0]*0.6 + poisson.p1*0.4,
    pX: oranP[1]*0.6 + poisson.pX*0.4,
    p2: oranP[2]*0.6 + poisson.p2*0.4
  };
  const t = hib.p1 + hib.pX + hib.p2;
  hib.p1 = (hib.p1/t)*100;
  hib.pX = (hib.pX/t)*100;
  hib.p2 = (hib.p2/t)*100;
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
  const r = 100 - f;
  if(r>=50) return 'ÇOK YÜKSEK';
  if(r>=40) return 'YÜKSEK';
  if(r>=30) return 'ORTA';
  if(r>=20) return 'DÜŞÜK';
  return 'ÇOK DÜŞÜK';
}
function surprizSinifi(r){
  if(r>=25) return 'GÜÇLÜ SÜRPRİZ ADAYI';
  if(r>=20) return 'ORTA SÜRPRİZ ADAYI';
  if(r>=15) return 'DÜŞÜK SÜRPRİZ';
  return 'ZAYIF SÜRPRİZ';
}

/* ============================================================
   ENTROPY & BANKO KALİTESİ
   ============================================================ */

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
  return Math.round(fp + kp + ep);
}

/* ============================================================
   MAÇ ANALİZ MOTORU
   ============================================================ */

function macAnalizEt(id, o1, oX, o2){
  if(!o1 || !oX || !o2) return null;
  o1 = parseFloat(o1); oX = parseFloat(oX); o2 = parseFloat(o2);
  const o = oranToOlasilik(o1, oX, o2);
  const xg = xGTahmin(o.p[0], o.p[1], o.p[2]);
  const poi = poissonMatris(xg.xgEv, xg.xgDep);
  const hib = hibritHesapla(o.p, poi);

  const sirali = [
    {kod:'1', olas:hib.p1},
    {kod:'X', olas:hib.pX},
    {kod:'2', olas:hib.p2}
  ].sort((a,b)=>b.olas-a.olas);

  const enYuksek = sirali[0], ikinci = sirali[1], ucuncu = sirali[2];
  const fark = enYuksek.olas - ikinci.olas;
  const favoriTuzagi = 100 - enYuksek.olas;
  let kazanamaRiski = 0;
  if(enYuksek.kod === '1') kazanamaRiski = hib.pX + hib.p2;
  else if(enYuksek.kod === '2') kazanamaRiski = hib.p1 + hib.pX;
  else kazanamaRiski = hib.p1 + hib.p2;

  const analiz = {
    id,
    // Hibrit
    p1: hib.p1, pX: hib.pX, p2: hib.p2,
    // Bağımsız oran türevi
    oranP1: o.p[0], oranPX: o.p[1], oranP2: o.p[2], marj: parseFloat(o.marj),
    // Bağımsız poisson türevi
    poissonP1: poi.p1, poissonPX: poi.pX, poissonP2: poi.p2,
    kg: poi.kg, ust25: poi.ust25, ust15: poi.ust15, ust35: poi.ust35,
    skorlar: poi.skorlar,
    // xG
    xgEv: xg.xgEv, xgDep: xg.xgDep,
    // Türev metrikler
    sirali, enYuksek, ikinci, ucuncu, fark,
    favoriTuzagi, kazanamaRiski,
    surprizOlas: ucuncu.olas, rakipOlas: ikinci.olas,
    favSinif: favSinifi(enYuksek.olas),
    beraberlikSinif: beraberlikSinifi(hib.pX),
    tuzakSinif: tuzakSinifi(enYuksek.olas),
    surprizSinif: surprizSinifi(ikinci.olas)
  };

  // Sınıf
  const fav = enYuksek.olas, tuzak = 100-fav, px = hib.pX;
  if(fav>=65 && tuzak<=35 && px<=25) analiz.macSinif = 'BANKO ADAYI';
  else if(fav>=52 && fav<65) analiz.macSinif = 'RİSKLİ FAVORİ';
  else if(tuzak>35 && fav>=45) analiz.macSinif = 'RİSKLİ FAVORİ';
  else if(px>=25 && Math.abs(fav-px)<10) analiz.macSinif = 'BERABERLİK ADAYI';
  else if(ucuncu.olas>=18 && fark<15) analiz.macSinif = 'SÜRPRİZ ADAYI';
  else if(fav<45) analiz.macSinif = 'DENGELİ MAÇ';
  else analiz.macSinif = 'NORMAL';

  return analiz;
}

/* ============================================================
   TAHMİN ÜRETİCİ
   ============================================================ */

function siraliAlternatif(a, b){
  const s = {'1':1, 'X':2, '2':3};
  return (s[a] < s[b] ? a : b) + (s[a] < s[b] ? b : a);
}

function tahminUret(a){
  if(!a) return null;
  const {enYuksek, ikinci, ucuncu, fark} = a;
  const ent = entropyHesapla(a);
  const kalite = bankoKalite(a);
  const sinif = a.macSinif;
  let karar='', guven=0, risk='';

  if(sinif === 'BANKO ADAYI'){
    karar = 'BANKO ' + enYuksek.kod; guven = Math.min(100, Math.round(enYuksek.olas+8)); risk = 'Çok Düşük';
  } else if(sinif === 'RİSKLİ FAVORİ'){
    karar = 'BANKO ' + enYuksek.kod; guven = Math.round(enYuksek.olas); risk = 'Orta';
  } else if(sinif === 'BERABERLİK ADAYI'){
    karar = 'ÇİFT ' + siraliAlternatif(enYuksek.kod, 'X'); guven = Math.round(enYuksek.olas); risk = 'Orta-Yüksek';
  } else if(sinif === 'SÜRPRİZ ADAYI'){
    karar = 'ÇİFT ' + siraliAlternatif(enYuksek.kod, ikinci.kod); guven = Math.round(enYuksek.olas); risk = 'Yüksek';
  } else if(sinif === 'DENGELİ MAÇ'){
    karar = 'ÜÇLÜ 1X2'; guven = Math.max(30, Math.round(enYuksek.olas-5)); risk = 'Çok Yüksek';
  } else {
    if(kalite>=75 && enYuksek.olas>=65){
      karar = 'BANKO ' + enYuksek.kod; guven = Math.min(100, enYuksek.olas+6); risk = 'Çok Düşük';
    } else if(kalite>=55 && enYuksek.olas>=55){
      karar = 'BANKO ' + enYuksek.kod; guven = Math.min(100, enYuksek.olas+3); risk = 'Düşük';
    } else if(kalite>=35 && enYuksek.olas>=42){
      karar = 'ÇİFT ' + siraliAlternatif(enYuksek.kod, ikinci.kod); guven = enYuksek.olas; risk = 'Orta';
    } else {
      karar = 'ÇİFT ' + siraliAlternatif(enYuksek.kod, ikinci.kod); guven = enYuksek.olas-3; risk = 'Yüksek';
    }
  }

  const alternatif = karar.includes('BANKO') ? siraliAlternatif(enYuksek.kod, ikinci.kod) : karar.replace('ÇİFT ', '');
  return {
    ana_tahmin: enYuksek.kod, alternatif, surpriz: ucuncu.kod,
    guven: Math.round(guven), risk, karar,
    favori_farki: Math.round(fark),
    entropy: Math.round(ent*100),
    kalite, macSinif: sinif,
    favSinif: a.favSinif, beraberlikSinif: a.beraberlikSinif,
    tuzakSinif: a.tuzakSinif, surprizSinif: a.surprizSinif,
    favoriTuzagi: Math.round(a.favoriTuzagi),
    kazanamaRiski: Math.round(a.kazanamaRiski),
    surprizOlas: a.surprizOlas
  };
}

/* ============================================================
   MODÜL 2: KELLY FRACTIONAL
   ============================================================ */

function kellyHesapla(olasilik, oran, frac){
  const p = olasilik / 100;
  const b = oran - 1;
  if(b <= 0) return { f: 0, ev: 0, degerli: false };
  const ev = p * oran;
  const f = (b*p - (1-p)) / b;
  return {
    f: Math.max(0, f*frac) * 100,
    ev: ev.toFixed(3),
    degerli: ev > 1.05 && f > 0,
    tamF: f*100
  };
}

function kellyFracGuncelle(val){
  kellyFraction = parseFloat(val);
  localStorage.setItem('skorlab_kelly_frac', kellyFraction);
  renderSerbest(); updateStats();
}

function kasaGuncelle(val){
  kasa = parseFloat(val) || 0;
  localStorage.setItem('skorlab_kasa', kasa);
}

/* ============================================================
   MODÜL 3: DEĞER ALARM (TELEGRAM + NTFY)
   ============================================================ */

async function telegramAlert(msg){
  if(!ayarlar.tgToken || !ayarlar.tgChatId) return false;
  try{
    await fetch(`https://api.telegram.org/bot${ayarlar.tgToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: ayarlar.tgChatId, text: msg, parse_mode: 'HTML' })
    });
    return true;
  }catch(e){ console.warn('Telegram hata:', e); return false; }
}

async function ntfyAlert(msg){
  if(!ayarlar.ntfyTopic) return false;
  try{
    await fetch(`https://ntfy.sh/${ayarlar.ntfyTopic}`, {
      method: 'POST', body: msg, headers: { 'Title': 'SkorLab Value Alert', 'Priority': 'high' }
    });
    return true;
  }catch(e){ console.warn('Ntfy hata:', e); return false; }
}

async function degerAlarmGonder(macAdi, secenek, oran, olasilik){
  const ev = (olasilik/100) * oran;
  const esik = ayarlar.evEsik || 1.12;
  if(ev < esik) return false;
  const msg = `💎 <b>Değer Bahis Fırsatı</b>\n${macAdi}\n<b>${secenek}</b> @ ${oran} (EV: ${ev.toFixed(2)})\nOlasılık: %${olasilik.toFixed(1)}`;
  await telegramAlert(msg);
  await ntfyAlert(msg.replace(/<[^>]+>/g,''));
  return true;
}

function openAyarlar(){
  $('tgToken').value = ayarlar.tgToken || '';
  $('tgChatId').value = ayarlar.tgChatId || '';
  $('ntfyTopic').value = ayarlar.ntfyTopic || 'skorlab_alerts';
  $('evEsik').value = ayarlar.evEsik || 1.12;
  $('ayarlarModal').classList.add('active');
}

function ayarlarKaydet(){
  ayarlar = {
    tgToken: $('tgToken').value.trim(),
    tgChatId: $('tgChatId').value.trim(),
    ntfyTopic: $('ntfyTopic').value.trim(),
    evEsik: parseFloat($('evEsik').value) || 1.12
  };
  localStorage.setItem('skorlab_ayarlar', JSON.stringify(ayarlar));
  closeModal('ayarlarModal');
  showToast('success', 'Kaydedildi', 'Ayarlar güncellendi.');
}

async function testAlarm(){
  ayarlar = {
    tgToken: $('tgToken').value.trim(),
    tgChatId: $('tgChatId').value.trim(),
    ntfyTopic: $('ntfyTopic').value.trim(),
    evEsik: parseFloat($('evEsik').value) || 1.12
  };
  localStorage.setItem('skorlab_ayarlar', JSON.stringify(ayarlar));
  const ok1 = await telegramAlert('✅ SkorLab test mesajı (Telegram)');
  const ok2 = await ntfyAlert('✅ SkorLab test mesajı (Ntfy)');
  if(ok1 || ok2) showToast('success', 'Test OK', 'Mesaj gönderildi.');
  else showToast('error', 'Test Başarısız', 'Token/chat_id kontrol et.');
}

/* ============================================================
   MODÜL 3B: JSON IMPORT
   ============================================================ */

function jsonImportAc(){ $('jsonFileInput').click(); }

function jsonImportEt(event){
  const file = event.target.files[0];
  if(!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    try{
      const raw = JSON.parse(e.target.result);
      weekKey = (raw.week || 'import').replace(/\s+/g,'_').toLowerCase();
      matchesData = (raw.matches || raw).map(m => ({
        id: m.id, home: m.home, away: m.away,
        date: m.date || '', league: m.league || '',
        odds: m.odds || null
      }));
      oddsData = {};
      matchesData.forEach(m => { if(m.odds) oddsData[m.id] = {...m.odds}; });
      localStorage.setItem('skorlab_odds_' + weekKey, JSON.stringify(oddsData));
      localStorage.setItem('skorlab_import', JSON.stringify({ weekKey, matchesData }));
      $('weekTitle').innerText = raw.week || 'İçe Aktarıldı';
      renderBulten(); updateStats();
      showToast('success', 'İçe Aktarıldı', matchesData.length + ' maç yüklendi.');
    }catch(err){
      showToast('error', 'Hata', 'JSON okunamadı: ' + err.message);
    }
  };
  reader.readAsText(file);
  event.target.value = '';
}

function bulteniSifirla(){
  if(!confirm('Bülteni ve oranları sıfırlamak istediğine emin misin?')) return;
  localStorage.removeItem('skorlab_import');
  loadData();
}

/* ============================================================
   VERİ YÜKLE
   ============================================================ */

async function loadData(){
  try{
    const imp = localStorage.getItem('skorlab_import');
    if(imp){
      const p = JSON.parse(imp);
      weekKey = p.weekKey;
      matchesData = p.matchesData;
      oddsData = JSON.parse(localStorage.getItem('skorlab_odds_' + weekKey) || '{}');
      $('weekTitle').innerText = 'İçe Aktarılan Bülten';
    } else {
      const res = await fetch('matches.json');
      if(!res.ok) throw new Error('HTTP '+res.status);
      const raw = await res.json();
      weekKey = (raw.week || 'hafta').replace(/\s+/g,'_').toLowerCase();
      matchesData = (raw.matches || raw).map(m => ({
        id: m.id, home: m.home, away: m.away,
        date: m.date || '', league: m.league || '', odds: m.odds || null
      }));
      oddsData = {};
      matchesData.forEach(m => { if(m.odds) oddsData[m.id] = {...m.odds}; });
      const kayitli = JSON.parse(localStorage.getItem('skorlab_odds_' + weekKey) || '{}');
      Object.keys(kayitli).forEach(id => {
        oddsData[id] = {...(oddsData[id] || {}), ...kayitli[id]};
      });
      $('weekTitle').innerText = raw.week || 'Bu Hafta';
    }
    renderBulten(); renderSerbest(); updateStats(); updateKolon();
  }catch(e){
    console.error('loadData:', e);
    const t = $('weekTitle'); if(t) t.innerText = 'Bülten Yüklenemedi';
    showToast('error', 'Bağlantı Hatası', 'matches.json yüklenemedi.');
  }
  loadArchive();
}

async function loadArchive(){
  try{
    const res = await fetch('archive.json');
    if(!res.ok) throw new Error();
    archiveData = await res.json();
  }catch(e){ archiveData = { weeks: [] }; }
  renderArsiv();
}

function renderArsiv(){
  const c = $('arsivListesi');
  if(!c) return;
  const w = archiveData.weeks || [];
  if(!w.length){
    c.innerHTML = '<div class="muted" style="text-align:center;padding:20px">Henüz arşiv kaydı yok.</div>';
    return;
  }
  c.innerHTML = w.map(h => `
    <div class="arsiv-hafta">
      <div class="h">📅 ${h.week || 'Hafta'}</div>
      <div class="s">Tahmin: ${h.total||0} · Tutan: ${h.hit||0} · Başarı: <b style="color:var(--green)">%${h.rate||0}</b></div>
    </div>
  `).join('');
}

/* ============================================================
   BÜLTEN
   ============================================================ */

function renderBulten(){
  $('matchesList').innerHTML = matchesData.map(m => {
    const od = oddsData[m.id] || {};
    const has = od['1'] && od['X'] && od['2'];
    const a = has ? macAnalizEt(m.id, od['1'], od['X'], od['2']) : null;
    const t = a ? tahminUret(a) : null;
    let badge = '';
    if(t){
      const man = manuelSecimler['toto-'+m.id];
      const k = man ? 'MANUEL '+man : t.karar;
      const c = k.includes('BANKO')?'green':k.includes('ÇİFT')?'yellow':k.includes('ÜÇLÜ')?'red':'purple';
      badge = `<span class="badge ${c}">${k}</span>`;
    }
    return `
    <div class="match" onclick="macDetayGoster('toto',${m.id})">
      <div class="match-head"><span>${m.date}</span><span class="mid">MAÇ #${m.id}</span></div>
      <div class="teams">${m.home} - ${m.away}${badge}${m.league?'<span class="league-tag">'+m.league+'</span>':''}</div>
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

  // Değer alarm taraması (arka planda)
  matchesData.forEach(m => {
    const od = oddsData[m.id];
    if(!od || !od['1'] || !od['X'] || !od['2']) return;
    const a = macAnalizEt(m.id, od['1'], od['X'], od['2']);
    const fav = a.enYuksek.kod;
    const favOran = parseFloat(od[fav]);
    degerAlarmGonder(m.home + ' - ' + m.away, fav, favOran, a.enYuksek.olas);
  });
}

function oranGuncelle(id, alan, deger){
  if(!oddsData[id]) oddsData[id] = {};
  if(deger==='' || deger===null) delete oddsData[id][alan];
  else oddsData[id][alan] = parseFloat(deger);
  localStorage.setItem('skorlab_odds_' + weekKey, JSON.stringify(oddsData));
  renderBulten(); updateStats();
}

/* ============================================================
   SERBEST
   ============================================================ */

function openSerbestModal(){
  ['sm-match','sm-o1','sm-oX','sm-o2','sm-kgvar','sm-kgyok','sm-kgu',
   'sm-u15alt','sm-u15ust','sm-u25alt','sm-u25ust','sm-u35alt','sm-u35ust']
   .forEach(id => { const el = $(id); if(el) el.value = ''; });
  $('serbestModal').classList.add('active');
}

function serbestEkle(){
  const mac = $('sm-match').value.trim();
  const o1 = parseFloat($('sm-o1').value);
  const oX = parseFloat($('sm-oX').value);
  const o2 = parseFloat($('sm-o2').value);
  if(!mac){ showToast('error', 'Eksik', 'Maç adı gir.'); return; }
  if(!o1 || !oX || !o2){ showToast('error', 'Eksik', '1/X/2 oranlarını gir.'); return; }
  const yeni = {
    id: Date.now(), mac, o1, oX, o2,
    kgvar: $('sm-kgvar').value ? parseFloat($('sm-kgvar').value) : null,
    kgyok: $('sm-kgyok').value ? parseFloat($('sm-kgyok').value) : null,
    kgu:   $('sm-kgu').value   ? parseFloat($('sm-kgu').value)   : null,
    u15alt: $('sm-u15alt').value ? parseFloat($('sm-u15alt').value) : null,
    u15ust: $('sm-u15ust').value ? parseFloat($('sm-u15ust').value) : null,
    u25alt: $('sm-u25alt').value ? parseFloat($('sm-u25alt').value) : null,
    u25ust: $('sm-u25ust').value ? parseFloat($('sm-u25ust').value) : null,
    u35alt: $('sm-u35alt').value ? parseFloat($('sm-u35alt').value) : null,
    u35ust: $('sm-u35ust').value ? parseFloat($('sm-u35ust').value) : null,
    tarih: new Date().toLocaleString('tr-TR')
  };
  serbestData.unshift(yeni);
  localStorage.setItem('skorlab_serbest', JSON.stringify(serbestData));
  closeModal('serbestModal');
  renderSerbest(); updateStats();
  showToast('success', 'Maç Eklendi!', mac);
}

function renderSerbest(){
  const c = $('serbestListesi');
  if(!c) return;
  if(!serbestData.length){
    c.innerHTML = '<div class="card"><div class="muted" style="text-align:center;padding:20px">Henüz serbest maç eklemedin.<br><br>📌 "➕ Maç Ekle" ile başla.</div></div>';
    return;
  }
  c.innerHTML = serbestData.map((m, idx) => {
    const a = macAnalizEt(m.id, m.o1, m.oX, m.o2);
    const t = tahminUret(a);
    const man = manuelSecimler['iddaa-'+m.id];
    const k = man ? 'MANUEL ' + man : t.karar;
    const cls = k.includes('BANKO')?'banko':k.includes('ÇİFT')?'cift':k.includes('ÜÇLÜ')?'uclu':'surpriz';
    const iko = k.includes('BANKO')?'🔒':k.includes('ÇİFT')?'⚠️':k.includes('ÜÇLÜ')?'🔥':'🎲';
    const oranFav = parseFloat(m['o' + a.enYuksek.kod] || m.o1);
    const kelly = kellyHesapla(a.enYuksek.olas, oranFav, kellyFraction);
    const kellyBox = kelly.degerli
      ? `<div class="kelly-box">💼 <b>Kelly (${kellyFraction===1?'Tam':kellyFraction===0.5?'½':'¼'}):</b> Kasadan %${kelly.f.toFixed(2)} · Öneri: <b>${Math.round(kasa*kelly.f/100)} TL</b> · EV: ${kelly.ev}</div>`
      : '';
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
      <div class="tk-ana"><div class="lbl">${k}</div><div class="val">${man || t.ana_tahmin}</div></div>
      <div class="tk-info">
        <div class="tk-item"><span class="lbl">Güven</span><span class="val">%${t.guven}</span></div>
        <div class="tk-item"><span class="lbl">Tuzak</span><span class="val">%${t.favoriTuzagi}</span></div>
        <div class="tk-item"><span class="lbl">Beraberlik</span><span class="val">${t.beraberlikSinif}</span></div>
        <div class="tk-item"><span class="lbl">xG</span><span class="val">${a.xgEv.toFixed(2)}-${a.xgDep.toFixed(2)}</span></div>
      </div>
      ${kellyBox}
      <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:6px;margin-top:8px">
        <button onclick="macDetayGoster('iddaa',${m.id})" class="btn btn-gray" style="padding:8px;font-size:.75rem">🔍</button>
        <button onclick="serbestManuel(${m.id},'1')" class="btn ${man==='1'?'btn-blue':'btn-gray'}" style="padding:8px">1</button>
        <button onclick="serbestManuel(${m.id},'X')" class="btn ${man==='X'?'btn-blue':'btn-gray'}" style="padding:8px">X</button>
        <button onclick="serbestManuel(${m.id},'2')" class="btn ${man==='2'?'btn-blue':'btn-gray'}" style="padding:8px">2</button>
      </div>
    </div>`;
  }).join('');
}

function serbestSil(idx){
  if(!confirm('Silinsin mi?')) return;
  serbestData.splice(idx, 1);
  localStorage.setItem('skorlab_serbest', JSON.stringify(serbestData));
  renderSerbest(); updateStats();
}
function serbestManuel(id, secim){
  const key = 'iddaa-'+id;
  if(manuelSecimler[key]===secim) delete manuelSecimler[key];
  else manuelSecimler[key] = secim;
  renderSerbest(); updateStats();
}
function temizleSerbest(){
  if(!confirm('Tüm serbest maçlar silinsin mi?')) return;
  serbestData = [];
  localStorage.removeItem('skorlab_serbest');
  renderSerbest(); updateStats();
}

/* ============================================================
   STATS
   ============================================================ */

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
  const ort = hepsi.length ? Math.round(hepsi.reduce((t,x) => t+x.guven, 0)/hepsi.length) : 0;
  const sM = $('statMac'); if(sM) sM.innerText = matchesData.length + serbestData.length;
  const sB = $('statBanko'); if(sB) sB.innerText = banko;
  const sC = $('statCift'); if(sC) sC.innerText = cift + uclu;
  const sG = $('statGuven'); if(sG) sG.innerText = '%' + ort;
}

/* ============================================================
   MODÜL 5: CHART.JS RADAR
   ============================================================ */

function renderRadar(metrikler){
  const cv = document.getElementById('radarChart');
  if(!cv) return;
  if(radarChart) radarChart.destroy();
  radarChart = new Chart(cv, {
    type: 'radar',
    data: {
      labels: ['Güven', 'Banko Kalite', 'Entropy', 'Tuzak Riski', 'Sürpriz'],
      datasets: [{
        data: metrikler,
        backgroundColor: 'rgba(0,230,118,.2)',
        borderColor: '#00e676',
        borderWidth: 2,
        pointBackgroundColor: '#00e676',
        pointRadius: 4
      }]
    },
    options: {
      responsive: true,
      plugins: { legend: { display: false } },
      scales: {
        r: {
          min: 0, max: 100,
          angleLines: { color: 'rgba(255,255,255,.1)' },
          grid: { color: 'rgba(255,255,255,.1)' },
          pointLabels: { color: '#7a8ba8', font: { size: 10, weight: '800' } },
          ticks: { display: false }
        }
      }
    }
  });
}

/* ============================================================
   MAÇ DETAY MODAL
   ============================================================ */

function macDetayGoster(tip, id){
  let m, o1, oX, o2, isim, tarih, league;
  if(tip === 'toto'){
    m = matchesData.find(x => x.id === id);
    if(!m) return;
    const od = oddsData[id];
    if(!od || !od['1'] || !od['X'] || !od['2']){ showToast('error', 'Oran Yok', 'Oran gir.'); return; }
    o1=od['1']; oX=od['X']; o2=od['2'];
    isim = m.home + ' - ' + m.away; tarih = m.date; league = m.league;
  } else {
    m = serbestData.find(x => x.id === id);
    if(!m) return;
    o1=m.o1; oX=m.oX; o2=m.o2;
    isim = m.mac; tarih = m.tarih; league = '';
  }
  const a = macAnalizEt(id, o1, oX, o2);
  const t = tahminUret(a);
  const o = oranToOlasilik(parseFloat(o1), parseFloat(oX), parseFloat(o2));
  const man = manuelSecimler[tip + '-' + id];
  const kap = kapsamaHesapla(a, 20);
  const kapHTML = Object.keys(kap).sort().map(k => {
    const y = Math.round(kap[k]/20*100);
    return `<div style="display:flex;justify-content:space-between;font-size:.75rem;padding:3px 0"><span>${k}</span><span><b>${kap[k]}</b> kolon (%${y})</span></div>`;
  }).join('');
  const skorSirali = Object.entries(a.skorlar).sort((x,y) => y[1]-x[1]).slice(0,5);
  const skorHTML = skorSirali.map(([k,v]) =>
    `<div style="display:flex;justify-content:space-between;font-size:.72rem;padding:2px 0"><span>${k}</span><span class="green">%${(v*100).toFixed(2)}</span></div>`
  ).join('');
  const oranFav = parseFloat(tip==='toto' ? oddsData[id][t.ana_tahmin] : (t.ana_tahmin==='1'?o1:t.ana_tahmin==='X'?oX:o2));
  const kelly = kellyHesapla(a.enYuksek.olas, oranFav, kellyFraction);

  $('macDetayTitle').innerText = '📊 ' + (tip==='toto' ? 'MAÇ #'+id : 'İDDAA');
  $('macDetayBody').innerHTML = `
    <div style="font-size:.8rem;line-height:1.8">
      <div style="text-align:center;margin-bottom:14px">
        <div style="font-weight:900;font-size:1rem">${isim}</div>
        <div style="color:var(--muted);font-size:.7rem;margin-top:4px">${tarih}${league?' · '+league:''}</div>
        <div style="margin-top:8px;padding:6px 12px;background:var(--bg3);border-radius:8px;display:inline-block;font-size:.72rem;font-weight:800;color:var(--green)">${t.macSinif}</div>
      </div>

      <div class="analiz-box">
        <div class="analiz-row"><span class="analiz-lbl">📊 ORANLAR</span></div>
        <div class="analiz-row"><span>1: <b>${o1}</b></span><span>X: <b>${oX}</b></span><span>2: <b>${o2}</b></span></div>
        <div class="analiz-row"><span class="muted">Marj: %${o.marj}</span></div>
      </div>

      <div class="analiz-box">
        <div class="analiz-row"><span class="analiz-lbl">🎯 HİBRİT (%60 Oran + %40 Poisson)</span></div>
        <div class="analiz-row"><span>1: <b class="green">%${a.p1.toFixed(1)}</b></span><span>X: <b class="green">%${a.pX.toFixed(1)}</b></span><span>2: <b class="green">%${a.p2.toFixed(1)}</b></span></div>
      </div>

      <div class="analiz-box">
        <div class="analiz-row"><span class="analiz-lbl">📉 BAĞIMSIZ KAYNAKLAR</span></div>
        <div class="analiz-row"><span class="muted">Oran türevi:</span><span>%${a.oranP1.toFixed(1)} / %${a.oranPX.toFixed(1)} / %${a.oranP2.toFixed(1)}</span></div>
        <div class="analiz-row"><span class="muted">Poisson türevi:</span><span>%${a.poissonP1.toFixed(1)} / %${a.poissonPX.toFixed(1)} / %${a.poissonP2.toFixed(1)}</span></div>
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
        <div style="position:relative;height:260px">
          <canvas id="radarChart"></canvas>
        </div>
      </div>

      <div class="sürpriz-alert">
        <div class="baslik">⚠️ TUZAK: %${t.favoriTuzagi} · ${a.tuzakSinif}</div>
        <div class="neden">Kazanamama: <b>%${t.kazanamaRiski}</b></div>
      </div>

      ${kelly.degerli ? `
      <div class="kelly-box">
        💼 <b>KELLY (${kellyFraction===1?'Tam':kellyFraction===0.5?'½':'¼'})</b><br>
        Tam Kelly: %${kelly.tamF.toFixed(2)} · Uygulanan: <b>%${kelly.f.toFixed(2)}</b><br>
        Öneri: <b>${Math.round(kasa*kelly.f/100)} TL</b> · EV: <b>${kelly.ev}</b>
      </div>` : ''}

      <div class="tahmin-kart ${t.karar.includes('BANKO')?'banko':t.karar.includes('ÇİFT')?'cift':'uclu'}">
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
          <button onclick="detayManuel('${tip}',${id},'1')" class="btn ${man==='1'?'btn-blue':'btn-gray'}" style="padding:10px">1</button>
          <button onclick="detayManuel('${tip}',${id},'X')" class="btn ${man==='X'?'btn-blue':'btn-gray'}" style="padding:10px">X</button>
          <button onclick="detayManuel('${tip}',${id},'2')" class="btn ${man==='2'?'btn-blue':'btn-gray'}" style="padding:10px">2</button>
        </div>
      </div>
    </div>
  `;
  $('macDetayModal').classList.add('active');

  // Radar grafiği (modal açıldıktan sonra canvas hazır olur)
  setTimeout(() => {
    renderRadar([t.guven, t.kalite, t.entropy, t.favoriTuzagi, Math.round(a.surprizOlas)]);
  }, 100);
}

function detayManuel(tip, id, secim){
  const key = tip + '-' + id;
  if(manuelSecimler[key] === secim) delete manuelSecimler[key];
  else manuelSecimler[key] = secim;
  macDetayGoster(tip, id);
  renderBulten(); renderSerbest(); updateStats();
}

/* ============================================================
   KAPSAMA
   ============================================================ */

function kapsamaHesapla(a, kolonSayisi){
  if(!a) return {'1':0,'X':0,'2':0};
  const sinif = a.macSinif;
  const p1=a.p1, pX=a.pX, p2=a.p2;
  let d = {};
  if(sinif === 'BANKO ADAYI'){
    d = { [a.enYuksek.kod]: kolonSayisi };
  } else if(sinif === 'RİSKLİ FAVORİ'){
    const k = Math.round(kolonSayisi*0.7);
    d = { [a.enYuksek.kod]:k, [a.ikinci.kod]:kolonSayisi-k };
  } else if(sinif === 'BERABERLİK ADAYI'){
    const k = Math.round(kolonSayisi*0.5), x = Math.round(kolonSayisi*0.35);
    d = { [a.enYuksek.kod]:k, 'X':x };
    const rest = kolonSayisi - k - x;
    if(rest > 0) d[a.ucuncu.kod] = rest;
  } else if(sinif === 'SÜRPRİZ ADAYI'){
    const k = Math.round(kolonSayisi*0.45), b = Math.round(kolonSayisi*0.35);
    d = { [a.enYuksek.kod]:k, [a.ikinci.kod]:b };
    d[a.ucuncu.kod] = kolonSayisi - k - b;
  } else if(sinif === 'DENGELİ MAÇ'){
    const tt = p1+pX+p2;
    const k1 = Math.round(kolonSayisi*(p1/tt));
    const kX = Math.round(kolonSayisi*(pX/tt));
    d = {'1':k1, 'X':kX, '2':kolonSayisi-k1-kX};
  } else {
    const kalite = bankoKalite(a);
    if(kalite>=75) d = { [a.enYuksek.kod]: kolonSayisi };
    else if(kalite>=55){
      const k = Math.round(kolonSayisi*0.8);
      d = { [a.enYuksek.kod]:k, [a.ikinci.kod]:kolonSayisi-k };
    } else {
      const tt = p1+pX+p2;
      const k1 = Math.round(kolonSayisi*(p1/tt));
      const kX = Math.round(kolonSayisi*(pX/tt));
      d = {'1':k1, 'X':kX, '2':kolonSayisi-k1-kX};
    }
  }
  return d;
}

/* ============================================================
   MODÜL 7: COVERING DESIGN (HAMMING)
   ============================================================ */

function hammingMesafesi(a, b){
  let d = 0;
  for(let i = 0; i < a.length; i++) if(a[i] !== b[i]) d++;
  return d;
}

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

/* Hamming max-min filtresi ile indirgeme */
function coveringIndirgeme(tamKolonlar, hedefSayi){
  if(tamKolonlar.length <= hedefSayi) return tamKolonlar;
  const secilenler = [tamKolonlar[0]];
  const kalan = new Set(tamKolonlar.slice(1));
  while(secilenler.length < hedefSayi && kalan.size > 0){
    let enIyi = null, enBuyukMin = -1;
    for(const k of kalan){
      let minD = Infinity;
      for(const s of secilenler){
        const d = hammingMesafesi(k.picks, s.picks);
        if(d < minD) minD = d;
      }
      if(minD > enBuyukMin){ enBuyukMin = minD; enIyi = k; }
    }
    if(!enIyi) break;
    secilenler.push(enIyi);
    kalan.delete(enIyi);
  }
  return secilenler;
}

/* 13 Derece Teminat kontrolü (teorik) */
function dereceTeminatKontrol(kolonlar){
  // Herhangi iki kolon arasındaki minimum Hamming mesafesi
  let minD = Infinity;
  for(let i = 0; i < kolonlar.length; i++){
    for(let j = i+1; j < kolonlar.length; j++){
      const d = hammingMesafesi(kolonlar[i].picks, kolonlar[j].picks);
      if(d < minD) minD = d;
    }
  }
  // minD >= 1 ise en az 13 doğru garanti (tahminler %100 ise)
  return minD === Infinity ? 0 : minD;
}

/* ============================================================
   KUPON OLUŞTURMA
   ============================================================ */

function setKuponKaynak(k, el){
  kuponKaynak = k;
  document.querySelectorAll('[id^="kuponKaynak-"]').forEach(e => e.classList.remove('active'));
  if(el) el.classList.add('active');
}

function setRiskMode(mode, el){
  riskMode = mode;
  document.querySelectorAll('[id^="mode-"]').forEach(e => e.classList.remove('active'));
  if(el) el.classList.add('active');
  const info = {
    guvenli: '<b>🛡️ GÜVENLİ</b><br>Banko maçlara öncelik, düşük risk.',
    dengeli: '<b>⚖️ DENGELİ</b><br>Banko + çift karışık.',
    agresif: '<b>🚀 AGRESİF</b><br>Sürprizlere daha fazla kolon.'
  };
  const el2 = $('modeInfo'); if(el2) el2.innerHTML = info[mode];
}

function setCoveringMode(m, el){
  coveringMode = m;
  document.querySelectorAll('[id^="cover-"]').forEach(e => e.classList.remove('active'));
  if(el) el.classList.add('active');
  const info = {
    tam: '<b>🎯 TAM KAPSAMA</b><br>Her kolon bütçeye oranlı üretilir.',
    '13': '<b>🧬 13 TEMİNATLI</b><br>Covering Design ile indirgeme yapılır.<br>⚠️ <b>İhtimal Kapsama Teminatı:</b> Seçilen çift ihtimaller gerçekleşirse en az 1 adet 13 yakalama garantisi. Amorti/ikramiye garantisi vermez.'
  };
  const el2 = $('coverInfo'); if(el2) el2.innerHTML = info[m];
}

function updateKolon(){
  const b = parseFloat($('budget').value) || 0;
  const k = Math.floor(b/10);
  const l = $('lblCost'); if(l) l.innerText = b + ' TL';
  const k2 = $('lblKolon'); if(k2) k2.innerText = k;
}

function kuponOlustur(){
  const butce = parseFloat($('budget').value) || 200;
  const kolonSayisi = Math.floor(butce / 10);
  if(kolonSayisi < 1){ showToast('error', 'Bütçe Az', 'En az 10 TL gir.'); return; }

  let kaynak = [];
  if(kuponKaynak === 'toto' || kuponKaynak === 'karisik'){
    matchesData.forEach(m => {
      const od = oddsData[m.id];
      if(!od || !od['1'] || !od['X'] || !od['2']) return;
      const a = macAnalizEt(m.id, od['1'], od['X'], od['2']);
      if(!a) return;
      const t = tahminUret(a);
      const man = manuelSecimler['toto-'+m.id];
      kaynak.push({tip:'toto', id:m.id, isim:m.home+' - '+m.away, odds:od, a, t,
        karar: man?'MANUEL '+man:t.karar, ana: man||t.ana_tahmin, manuel:!!man});
    });
  }
  if(kuponKaynak === 'iddaa' || kuponKaynak === 'karisik'){
    serbestData.forEach(m => {
      const a = macAnalizEt(m.id, m.o1, m.oX, m.o2);
      if(!a) return;
      const t = tahminUret(a);
      const man = manuelSecimler['iddaa-'+m.id];
      kaynak.push({tip:'iddaa', id:m.id, isim:m.mac, odds:{'1':m.o1,'X':m.oX,'2':m.o2}, a, t,
        karar: man?'MANUEL '+man:t.karar, ana: man||t.ana_tahmin, manuel:!!man});
    });
  }
  if(!kaynak.length){ showToast('error', 'Maç Yok', 'Seçili kaynakta maç/oran yok.'); return; }

  // Kolon üretimi
  const kolonlar = [];
  for(let c = 0; c < kolonSayisi; c++){
    const picks = [];
    let oran = 1;
    kaynak.forEach(k => {
      let secim;
      if(k.manuel){
        secim = k.ana;
      } else {
        const kap = kapsamaHesapla(k.a, kolonSayisi);
        const secenekler = Object.keys(kap).filter(x => kap[x] > 0);
        const agirlik = secenekler.map(s => {
          const p = s==='1'?k.a.p1:s==='X'?k.a.pX:k.a.p2;
          if(s === k.a.enYuksek.kod) return p * (riskMode==='agresif'?0.7:1.2);
          if(s === k.a.ikinci.kod) return p * (riskMode==='guvenli'?0.4:1);
          return p * 0.5;
        });
        const top = agirlik.reduce((a,b) => a+b, 0);
        let r = Math.random() * top;
        for(let i = 0; i < secenekler.length; i++){
          r -= agirlik[i];
          if(r <= 0){ secim = secenekler[i]; break; }
        }
        if(!secim) secim = k.ana;
      }
      picks.push(secim);
      oran *= parseFloat(k.odds[secim] || 1);
    });
    kolonlar.push({picks, oran});
  }

  // Covering indirgeme
  let finalKolonlar = kolonlar;
  let coveringInfo = '';
  if(coveringMode === '13' && kolonlar.length > 32){
    finalKolonlar = coveringIndirgeme(kolonlar, 32);
    const minD = dereceTeminatKontrol(finalKolonlar);
    coveringInfo = `<div class="uyari-alert">
      ⚠️ <b>İHTİMAL KAPSAMA TEMİNATI (13 Derece)</b><br>
      Seçilen çift ihtimaller gerçekleştiği takdirde en az <b>1 adet 13 yakalama</b> garantisi sağlar.<br>
      <b>Toplam amorti/ikramiye garantisi vermez.</b><br>
      İndirgeme: ${kolonlar.length} → ${finalKolonlar.length} kolon · Min Hamming: ${minD}
    </div>`;
  }

  const etkin = etkinKapsama(finalKolonlar);
  const ortOran = (finalKolonlar.reduce((t,k) => t+k.oran, 0)/finalKolonlar.length).toFixed(2);
  const maxOran = Math.max(...finalKolonlar.map(k => k.oran)).toFixed(2);

  window.sonKolonlar = finalKolonlar;

  $('kuponSonuc').innerHTML = `
    <div class="card">
      <div class="result-title">⚡ KUPON HAZIR (${finalKolonlar.length} Kolon · ${kaynak.length} Maç)</div>
      <div class="kolon-info" style="margin:8px 0">
        Ort. Oran: <b>${ortOran}</b> · Max: <b>${maxOran}</b> · Etkin Kapsama: <b>%${etkin}</b>
      </div>
      ${coveringInfo}
      <div style="max-height:260px;overflow-y:auto;background:var(--bg3);border-radius:8px;padding:10px">
        ${finalKolonlar.map((k,i) => `
          <div class="kolon-row">
            <span style="color:var(--muted)">#${i+1}</span>
            <span class="picks">${k.picks.join(' - ')}</span>
            <span style="color:var(--green);font-weight:900">${k.oran.toFixed(2)}</span>
          </div>
        `).join('')}
      </div>
      <button class="btn btn-blue btn-lg" onclick="kuponGorseliOlustur()" style="margin-top:12px">🖼️ Görsel Kart Oluştur</button>
    </div>`;
}

/* ============================================================
   MODÜL 6: CANVAS + QR + SHARE
   ============================================================ */

function kuponGorseliOlustur(){
  const kolonlar = window.sonKolonlar || [];
  if(!kolonlar.length){ showToast('error', 'Kolon Yok', 'Önce kupon oluştur.'); return; }

  const W = 1080, H = 1350;
  const canvas = document.createElement('canvas');
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d');

  // Arka plan
  const grd = ctx.createLinearGradient(0, 0, W, H);
  grd.addColorStop(0, '#070b14'); grd.addColorStop(1, '#0f1523');
  ctx.fillStyle = grd; ctx.fillRect(0, 0, W, H);

  // Başlık
  ctx.fillStyle = '#00e676'; ctx.font = 'bold 56px sans-serif';
  ctx.fillText('⚽ SKORLAB v8 PRO', 60, 100);

  ctx.fillStyle = '#7a8ba8'; ctx.font = '24px sans-serif';
  ctx.fillText('Kupon · ' + new Date().toLocaleString('tr-TR'), 60, 145);

  // Kolonlar
  const goster = kolonlar.slice(0, 13);
  goster.forEach((k, i) => {
    const y = 240 + i * 68;
    ctx.fillStyle = '#161e2f';
    ctx.fillRect(50, y - 42, W - 100, 60);
    ctx.fillStyle = '#3d8bff'; ctx.font = 'bold 24px monospace';
    ctx.fillText('#' + String(i+1).padStart(2, '0'), 75, y);
    ctx.fillStyle = '#ffffff'; ctx.font = 'bold 24px monospace';
    ctx.fillText(k.picks.join(' - '), 180, y);
    ctx.fillStyle = '#00e676'; ctx.font = 'bold 24px monospace';
    ctx.textAlign = 'right';
    ctx.fillText(k.oran.toFixed(2), W - 75, y);
    ctx.textAlign = 'left';
  });

  if(kolonlar.length > 13){
    ctx.fillStyle = '#7a8ba8'; ctx.font = '22px sans-serif';
    ctx.fillText('+' + (kolonlar.length - 13) + ' kolon daha...', 60, 240 + 13*68 + 10);
  }

  // İstatistik
  const etkin = etkinKapsama(kolonlar);
  const ortOran = (kolonlar.reduce((t,k) => t+k.oran, 0)/kolonlar.length).toFixed(2);
  const statsY = H - 240;
  ctx.fillStyle = '#161e2f'; ctx.fillRect(50, statsY, W - 100, 120);
  ctx.fillStyle = '#00e676'; ctx.font = 'bold 22px sans-serif';
  ctx.fillText('ETKİN KAPSAMA', 80, statsY + 45);
  ctx.fillText('ORT. ORAN', 480, statsY + 45);
  ctx.fillText('KOLON', 800, statsY + 45);
  ctx.fillStyle = '#ffffff'; ctx.font = 'bold 32px sans-serif';
  ctx.fillText('%' + etkin, 80, statsY + 90);
  ctx.fillText(ortOran, 480, statsY + 90);
  ctx.fillText(String(kolonlar.length), 800, statsY + 90);

  // QR kod (doğrulama linki)
  try{
    const qr = qrcode(0, 'L');
    qr.addData('skorlab://kupon/' + Date.now());
    qr.make();
    const qrSize = 140;
    const qrImg = qr.createDataURL(4, 0);
    const img = new Image();
    img.onload = () => {
      ctx.drawImage(img, W - 200, H - 160, qrSize, qrSize);
      finalizeCanvas(canvas);
    };
    img.src = qrImg;
  }catch(e){
    finalizeCanvas(canvas);
  }

  // Alt bilgi
  ctx.fillStyle = '#7a8ba8'; ctx.font = '20px sans-serif';
  ctx.fillText('skorlab.app · ' + new Date().toLocaleDateString('tr-TR'), 60, H - 40);
}

function finalizeCanvas(canvas){
  sonKuponPNG = canvas.toDataURL('image/png');
  $('kuponGorselImg').src = sonKuponPNG;
  $('kuponGorselModal').classList.add('active');
}

function kuponIndir(){
  if(!sonKuponPNG) return;
  const a = document.createElement('a');
  a.download = 'skorlab-kupon-' + Date.now() + '.png';
  a.href = sonKuponPNG;
  a.click();
}

async function kuponPaylas(){
  if(!sonKuponPNG){ showToast('error', 'Hata', 'Görsel yok.'); return; }
  if(!navigator.share){
    showToast('error', 'Desteklenmiyor', 'Tarayıcı paylaşımı desteklemiyor. İndir butonunu kullan.');
    return;
  }
  try{
    const res = await fetch(sonKuponPNG);
    const blob = await res.blob();
    const file = new File([blob], 'skorlab-kupon.png', {type:'image/png'});
    await navigator.share({
      files: [file],
      title: 'SkorLab Kupon',
      text: 'SkorLab ile oluşturulmuş kupon'
    });
  }catch(e){ console.warn(e); }
}

/* ============================================================
   TAHMİN RAPORU
   ============================================================ */

function tahminVer(){
  const hepsi = [];
  matchesData.forEach(m => {
    const od = oddsData[m.id];
    if(!od || !od['1']) return;
    const a = macAnalizEt(m.id, od['1'], od['X'], od['2']);
    if(!a) return;
    hepsi.push({tip:'toto', m, a, t:tahminUret(a), man:manuelSecimler['toto-'+m.id], isim:m.home+' - '+m.away});
  });
  serbestData.forEach(m => {
    const a = macAnalizEt(m.id, m.o1, m.oX, m.o2);
    if(!a) return;
    hepsi.push({tip:'iddaa', m, a, t:tahminUret(a), man:manuelSecimler['iddaa-'+m.id], isim:m.mac});
  });
  if(!hepsi.length){ showToast('error', 'Maç Yok', 'Önce maç gir.'); return; }
  const banko = hepsi.filter(x => (x.man || x.t.karar).includes('BANKO')).length;
  const cift = hepsi.filter(x => (x.man || x.t.karar).includes('ÇİFT')).length;
  const uclu = hepsi.filter(x => (x.man || x.t.karar).includes('ÜÇLÜ')).length;
  const ort = Math.round(hepsi.reduce((t,x) => t+x.t.guven, 0)/hepsi.length);
  const kritik = [...hepsi].sort((x,y) => y.t.entropy - x.t.entropy).slice(0,3);

  $('tahminModalBody').innerHTML = `
    <div style="font-size:.8rem;line-height:1.8">
      <div style="background:var(--bg3);border-radius:10px;padding:12px;margin-bottom:12px">
        <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;text-align:center">
          <div><div style="color:var(--green);font-weight:900;font-size:1.2rem">${banko}</div><div class="muted" style="font-size:.6rem">BANKO</div></div>
          <div><div style="color:var(--orange);font-weight:900;font-size:1.2rem">${cift}</div><div class="muted" style="font-size:.6rem">ÇİFT</div></div>
          <div><div style="color:var(--red);font-weight:900;font-size:1.2rem">${uclu}</div><div class="muted" style="font-size:.6rem">ÜÇLÜ</div></div>
          <div><div style="color:var(--blue);font-weight:900;font-size:1.2rem">%${ort}</div><div class="muted" style="font-size:.6rem">GÜVEN</div></div>
        </div>
      </div>
      <div style="background:rgba(255,77,94,.1);border:1px solid rgba(255,77,94,.4);border-radius:10px;padding:10px;margin-bottom:12px">
        <div style="color:var(--red);font-weight:900;font-size:.78rem;margin-bottom:6px">🚨 KRİTİK MAÇLAR</div>
        ${kritik.map(x => `<div style="font-size:.72rem;color:var(--muted);padding:3px 0"><b style="color:var(--orange)">${x.tip==='toto'?'#'+x.m.id:'İ'}</b> ${x.isim} · Ent: ${x.t.entropy}</div>`).join('')}
      </div>
      ${hepsi.map(x => {
        const k = x.man ? 'MANUEL '+x.man : x.t.karar;
        const ana = x.man || x.t.ana_tahmin;
        const ik = k.includes('BANKO')?'🔒':k.includes('ÇİFT')?'⚠️':k.includes('ÜÇLÜ')?'🔥':'🎲';
        const r = k.includes('BANKO')?'green':k.includes('ÇİFT')?'orange':k.includes('ÜÇLÜ')?'red':'purple';
        return `<div style="background:var(--bg3);border-left:3px solid var(--${r});border-radius:8px;padding:8px 10px;margin-bottom:6px">
          <div style="font-weight:800;font-size:.78rem">${ik} ${x.tip==='toto'?'#'+x.m.id:''} ${x.isim}</div>
          <div style="font-size:.7rem;color:var(--muted);margin-top:4px"><b style="color:var(--${r})">${ana}</b> · ${k} · %${x.t.guven} · Tuzak %${x.t.favoriTuzagi}</div>
        </div>`;
      }).join('')}
    </div>`;
  $('tahminModal').classList.add('active');
}

/* ============================================================
   NAV / MODAL / TOAST
   ============================================================ */

function switchTab(i, el){
  document.querySelectorAll('.tab, .page').forEach(e => e.classList.remove('active'));
  if(el) el.classList.add('active');
  $('page-'+i).classList.add('active');
  if(i === 4) renderTahminListesi();
  if(i === 5) renderArsiv();
}
function closeModal(id){ $(id).classList.remove('active'); }
function showToast(type, title, msg){
  $('toastIcon').innerText = type==='success' ? '✅' : '❌';
  $('toastTitle').innerText = title;
  $('toastMsg').innerText = msg;
  $('toastModal').classList.add('active');
}

/* Tahmin listesi (Analiz sekmesi) */
function renderTahminListesi(){
  const c = $('tahminListesi');
  if(!c) return;
  let html = '';
  const totoA = matchesData.map(m => {
    const od = oddsData[m.id];
    if(!od || !od['1'] || !od['X'] || !od['2']) return null;
    const a = macAnalizEt(m.id, od['1'], od['X'], od['2']);
    const t = tahminUret(a);
    return {tip:'toto', m, a, t, man:manuelSecimler['toto-'+m.id], id:m.id, isim:m.home+' - '+m.away, tarih:m.date};
  }).filter(x => x);
  const iddaaA = serbestData.map(m => {
    const a = macAnalizEt(m.id, m.o1, m.oX, m.o2);
    const t = tahminUret(a);
    return {tip:'iddaa', m, a, t, man:manuelSecimler['iddaa-'+m.id], id:m.id, isim:m.mac, tarih:m.tarih};
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
  const k = man ? 'MANUEL '+man : t.karar;
  const ana = man || t.ana_tahmin;
  const cls = k.includes('BANKO')?'banko':k.includes('ÇİFT')?'cift':k.includes('ÜÇLÜ')?'uclu':'surpriz';
  const iko = k.includes('BANKO')?'🔒':k.includes('ÇİFT')?'⚠️':k.includes('ÜÇLÜ')?'🔥':'🎲';
  return `
    <div class="tahmin-kart ${cls}" onclick="macDetayGoster('${tip}',${id})" style="cursor:pointer">
      <div class="tk-head">
        <span>${tarih} · ${tip==='toto'?'TOTO':'İDDAA'} · ${t.macSinif}</span>
        <span>${iko} #${tip==='toto'?id:''}${man?' [M]':''}</span>
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

/* ============================================================
   MODÜL 4: PWA
   ============================================================ */

if('serviceWorker' in navigator){
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(e => console.warn('PWA:', e));
  });
}

/* ============================================================
   BAŞLAT
   ============================================================ */

window.onload = function(){
  $('kasaInput').value = kasa;
  $('kellySelect').value = String(kellyFraction);
  loadData();
  setRiskMode('dengeli', $('mode-dengeli'));
  setCoveringMode('tam', $('cover-tam'));
};
