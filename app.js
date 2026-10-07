/* ============================================================
   SKORLAB v2 · 4 SEKMELİ · 2026
   ============================================================ */

let matchesData = [];
let PR = [];
let oddsData = {};
let userPicks = {};
let archiveData = { weeks: [] };

const $ = id => document.getElementById(id);
const pc = x => (x * 100).toFixed(1);
const ordr = i => [0,1,2].sort((a,b) => PR[i][b] - PR[i][a]);
const topP = i => Math.max(...PR[i]);

/* ============ ORAN → OLASILIK ============ */
function oranToOlasilik(o1, oX, o2){
  const r1 = 1/o1, rX = 1/oX, r2 = 1/o2;
  const toplam = r1 + rX + r2;
  return {
    p: [(r1/toplam)*100, (rX/toplam)*100, (r2/toplam)*100],
    marj: ((toplam-1)*100).toFixed(2)
  };
}

/* ============ SÜRPRİZ ============ */
function sürprizHesapla(o1, oX, o2){
  const o = oranToOlasilik(parseFloat(o1), parseFloat(oX), parseFloat(o2));
  const p1 = o.p[0], pX = o.p[1], p2 = o.p[2];
  const favori = Math.max(p1, pX, p2);
  const ikinci = [p1, pX, p2].sort((a,b) => b-a)[1];
  const fark = favori - ikinci;
  const marj = parseFloat(o.marj);
  const xOran = parseFloat(oX);
  let puan = 0, nedenler = [];
  if(marj > 10){ puan += 30; nedenler.push(`Marj yüksek (%${marj.toFixed(1)})`); }
  else if(marj > 6){ puan += 15; nedenler.push(`Marj orta (%${marj.toFixed(1)})`); }
  if(favori < 45){ puan += 30; nedenler.push(`Favori zayıf (%${favori.toFixed(1)})`); }
  else if(favori < 55){ puan += 20; nedenler.push(`Favori orta (%${favori.toFixed(1)})`); }
  else if(favori < 65){ puan += 10; nedenler.push(`Favori güçlü ama garanti değil`); }
  if(xOran > 5.0){ puan += 10; nedenler.push(`Beraberlik oranı çok yüksek (${xOran})`); }
  else if(xOran > 4.0){ puan += 20; nedenler.push(`Beraberlik riski yüksek (${xOran})`); }
  else if(xOran > 3.5){ puan += 15; nedenler.push(`Beraberlik riski var (${xOran})`); }
  if(fark < 10){ puan += 20; nedenler.push(`Dengeli maç (fark %${fark.toFixed(1)})`); }
  else if(fark < 20){ puan += 10; nedenler.push(`Hafif dengeli (fark %${fark.toFixed(1)})`); }
  puan = Math.min(100, puan);
  let etiket, renk;
  if(puan <= 25){ etiket = '✅ GÜVENLİ'; renk = 'green'; }
  else if(puan <= 50){ etiket = '⚡ ORTA RİSK'; renk = 'yellow'; }
  else if(puan <= 75){ etiket = '⚠️ YÜKSEK RİSK'; renk = 'orange'; }
  else { etiket = '🚨 ÇOK YÜKSEK'; renk = 'red'; }
  return { puan, etiket, renk, nedenler, favori, marj, xOran, p: o.p };
}

/* ============ POISSON ============ */
function poissonPmf(k, lambda){
  let p = Math.exp(-lambda);
  for(let i = 1; i <= k; i++) p *= lambda / i;
  return p;
}

function xGTahmin(p1, pX, p2){
  const totalP = p1 + p2;
  const homeShare = p1 / (totalP || 1);
  const toplamGol = 2.4 + (1 - pX) * 0.8;
  const evXg = toplamGol * homeShare * 1.15;
  const depXg = toplamGol * (1 - homeShare);
  return { evXg: Math.max(0.3, evXg), depXg: Math.max(0.3, depXg) };
}

function poissonBahisler(evXg, depXg){
  const MAX = 10;
  let p_kg = 0, p_u25 = 0;
  const skorlar = {};
  for(let h = 0; h <= MAX; h++){
    for(let a = 0; a <= MAX; a++){
      const ph = poissonPmf(h, evXg);
      const pa = poissonPmf(a, depXg);
      const p = ph * pa;
      if(h >= 1 && a >= 1) p_kg += p;
      if(h + a > 2.5) p_u25 += p;
      const key = h + '-' + a;
      skorlar[key] = (skorlar[key] || 0) + p;
    }
  }
  const enOlasi = Object.entries(skorlar).sort((a,b) => b[1] - a[1]).slice(0,3);
  return {
    kg: p_kg * 100,
    kgYok: (1 - p_kg) * 100,
    ust25: p_u25 * 100,
    alt25: (1 - p_u25) * 100,
    enOlasiSkor: enOlasi[0] ? enOlasi[0][0] : '1-1'
  };
}

/* ============ VERİ YÜKLE ============ */
async function loadData(){
  try{
    const res = await fetch('matches.json');
    const raw = await res.json();
    matchesData = (raw.matches || raw).map(m => ({
      id: m.id, home: m.home, away: m.away,
      date: m.date || '', league: m.league || '',
      odds: m.odds || null
    }));
    oddsData = {};
    matchesData.forEach(m => {
      if(m.odds) oddsData[m.id] = {...m.odds};
    });
    // localStorage'dan kayıtlı oranları al
    const kayitli = JSON.parse(localStorage.getItem('skorlab_odds') || '{}');
    Object.keys(kayitli).forEach(id => {
      oddsData[id] = {...(oddsData[id] || {}), ...kayitli[id]};
    });
    $('weekTitle').innerText = raw.week || 'Bu Hafta';
    hesaplaPR();
    renderBulten();
    renderAnaliz();
    renderFiltreOzeti();
    renderArsiv();
    updateStats();
  }catch(e){
    document.body.innerHTML = '<div style="padding:20px;color:#ff4d5e">⚠️ matches.json yüklenemedi: ' + e.message + '</div>';
  }
  loadArchive();
}

async function loadArchive(){
  try{
    const res = await fetch('archive.json');
    archiveData = await res.json();
  }catch(e){ archiveData = { weeks: [] }; }
  renderArsiv();
}

function hesaplaPR(){
  PR = matchesData.map(m => {
    const od = oddsData[m.id];
    if(od && od['1'] && od['X'] && od['2']){
      const o = oranToOlasilik(parseFloat(od['1']), parseFloat(od['X']), parseFloat(od['2']));
      return o.p.map(x => x/100);
    }
    return [0.33, 0.33, 0.34];
  });
}

/* ============ STATS ============ */
function updateStats(){
  const banko = matchesData.filter((_,i) => topP(i) >= 0.65).length;
  const dengeli = matchesData.filter((_,i) => {
    const o = ordr(i);
    return PR[i][o[0]] - PR[i][o[1]] < 0.10;
  }).length;
  let value = 0;
  matchesData.forEach((m,i) => {
    const od = oddsData[m.id];
    if(!od) return;
    const o = oranToOlasilik(od['1'], od['X'], od['2']);
    ['1','X','2'].forEach((s,idx) => {
      const bahisciOlas = 100 / od[s];
      if(o.p[idx] - bahisciOlas > 5) value++;
    });
  });
  const bütçe = parseFloat($('budget')?.value) || 200;
  const kolon = Math.floor(bütçe / 10);
  
  ['statBanko','statBanko2'].forEach(id => { const el = $(id); if(el) el.innerText = banko; });
  ['statDengeli','statDengeli2'].forEach(id => { const el = $(id); if(el) el.innerText = dengeli; });
  ['statValue','statValue2'].forEach(id => { const el = $(id); if(el) el.innerText = value; });
  const sK = $('statKolon'); if(sK) sK.innerText = kolon;
  
  const ortRisk = matchesData.length ? (matchesData.reduce((t,_,i) => t + sürprizHesapla(oddsData[matchesData[i].id]?.['1'] || 2, oddsData[matchesData[i].id]?.['X'] || 3, oddsData[matchesData[i].id]?.['2'] || 4).puan, 0) / matchesData.length / 10).toFixed(1) : '0';
  const sR = $('statRisk'); if(sR) sR.innerText = ortRisk;
}

/* ============ RENDER: BÜLTEN ============ */
function renderBulten(){
  $('matchesList').innerHTML = matchesData.map((m,i) => {
    const od = oddsData[m.id] || {};
    const hasOdds = od['1'] && od['X'] && od['2'];
    const s = hasOdds ? sürprizHesapla(od['1'], od['X'], od['2']) : null;
    const renk = s ? (s.renk === 'yellow' ? 'orange' : s.renk) : 'muted';
    return `
    <div class="match">
      <div class="match-head">
        <span>${m.date}</span>
        <span class="mid">MAÇ #${m.id}</span>
      </div>
      <div class="teams">${m.home} - ${m.away}
        ${s ? `<span class="badge ${renk}">${s.etiket}</span>` : ''}
        ${m.league ? '<span class="league-tag">' + m.league + '</span>' : ''}
      </div>
      <div class="oran-input-grid">
        <div class="oran-input-item"><label>1</label><input type="number" step="0.01" placeholder="1.00" value="${od['1']||''}" oninput="oranGuncelle(${m.id},'1',this.value)"></div>
        <div class="oran-input-item"><label>X</label><input type="number" step="0.01" placeholder="1.00" value="${od['X']||''}" oninput="oranGuncelle(${m.id},'X',this.value)"></div>
        <div class="oran-input-item"><label>2</label><input type="number" step="0.01" placeholder="1.00" value="${od['2']||''}" oninput="oranGuncelle(${m.id},'2',this.value)"></div>
      </div>
      ${hasOdds ? `
      <div class="oran-grid-bulten">
        <div class="oran-box-bulten"><div class="lbl">1</div><div class="val">${parseFloat(od['1']).toFixed(2)}</div><div class="pct">%${(PR[i][0]*100).toFixed(1)}</div></div>
        <div class="oran-box-bulten"><div class="lbl">X</div><div class="val">${parseFloat(od['X']).toFixed(2)}</div><div class="pct">%${(PR[i][1]*100).toFixed(1)}</div></div>
        <div class="oran-box-bulten"><div class="lbl">2</div><div class="val">${parseFloat(od['2']).toFixed(2)}</div><div class="pct">%${(PR[i][2]*100).toFixed(1)}</div></div>
      </div>` : ''}
    </div>`;
  }).join('');
}

function oranGuncelle(matchId, alan, deger){
  if(!oddsData[matchId]) oddsData[matchId] = {};
  if(deger === '' || deger === null) delete oddsData[matchId][alan];
  else oddsData[matchId][alan] = parseFloat(deger);
  localStorage.setItem('skorlab_odds', JSON.stringify(oddsData));
  hesaplaPR();
  renderBulten();
  renderAnaliz();
  renderFiltreOzeti();
  updateStats();
}

/* ============ RENDER: ANALİZ ============ */
function renderAnaliz(){
  $('analizListesi').innerHTML = matchesData.map((m,i) => {
    const od = oddsData[m.id] || {};
    const hasOdds = od['1'] && od['X'] && od['2'];
    if(!hasOdds){
      return `<div class="match"><div class="match-head"><span>${m.date}</span><span class="mid">#${m.id}</span></div><div class="teams">${m.home} - ${m.away}</div><div class="analiz-row muted" style="padding:8px;text-align:center;font-size:.72rem">Oran gir → analiz gelsin</div></div>`;
    }
    const o = oranToOlasilik(parseFloat(od['1']), parseFloat(od['X']), parseFloat(od['2']));
    const s = sürprizHesapla(od['1'], od['X'], od['2']);
    const o1 = o.p[0], oX = o.p[1], o2 = o.p[2];
    const favori = o1 === Math.max(o1,oX,o2) ? '1' : oX === Math.max(o1,oX,o2) ? 'X' : '2';
    const favoriOlas = Math.max(o1, oX, o2);
    const renk = s.renk === 'yellow' ? 'orange' : s.renk;
    
    // Sistem seçimi
    const bankoMu = favoriOlas >= 65;
    let sistemSecim = '';
    if(bankoMu) sistemSecim = favori;
    else if(favoriOlas >= 50) sistemSecim = favori === '1' ? '1X' : favori === '2' ? 'X2' : '12';
    else if(s.xOran < 3.5) sistemSecim = '12';
    else sistemSecim = favori === '1' ? '1X' : favori === '2' ? 'X2' : '12';
    
    return `
    <div class="match">
      <div class="match-head"><span>${m.date}</span><span class="mid">#${m.id}</span></div>
      <div class="teams">${m.home} - ${m.away}</div>
      
      <div class="analiz-box">
        <div class="analiz-row"><span class="analiz-lbl">📊 OLASILIK</span></div>
        <div class="analiz-row">
          <span>1: <b class="green">%${o1.toFixed(1)}</b></span>
          <span>X: <b class="green">%${oX.toFixed(1)}</b></span>
          <span>2: <b class="green">%${o2.toFixed(1)}</b></span>
        </div>
        <div class="analiz-row"><span class="muted">Favori: <b>${favori}</b> · Marj: %${o.marj}</span></div>
      </div>
      
      <div class="sürpriz-alert" style="border-color:var(--${renk})">
        <div class="baslik" style="color:var(--${renk})">🚨 Sürpriz: ${s.puan}/100 · ${s.etiket}</div>
        ${s.nedenler.length ? `<div class="neden">${s.nedenler.join(' · ')}</div>` : ''}
      </div>
      
      <div class="toto-oneri ${bankoMu ? 'banko' : ''}">
        <div class="baslik">${bankoMu ? '✅ BANKO' : '⭐ ÇİFT ŞANS ÖNERİSİ'}</div>
        <div class="secim">${sistemSecim}</div>
        <div class="alt">${bankoMu ? 'Favori %' + favoriOlas.toFixed(0) : 'Alternatif: ' + (sistemSecim === '12' ? '1X veya X2' : '12')}</div>
      </div>
    </div>`;
  }).join('');
}

/* ============ FİLTRE ÖZETİ ============ */
function renderFiltreOzeti(){
  const bMin = $('bankoMin')?.value || 0;
  const bMax = $('bankoMax')?.value || 15;
  const xMin = $('beraberlikMin')?.value || 0;
  const xMax = $('beraberlikMax')?.value || 15;
  const aMax = $('ardisikMax')?.value || 3;
  const el = $('filtreOzeti');
  if(el){
    el.innerHTML = `
      🏦 Banko: <b>${bMin} - ${bMax}</b><br>
      ⚖️ Beraberlik: <b>${xMin} - ${xMax}</b><br>
      🔗 Ardışık Max: <b>${aMax}</b>
    `;
  }
}

function updateKolon(){
  const b = parseFloat($('budget').value) || 0;
  const k = Math.floor(b / 10);
  $('lblCost').innerText = b + ' TL';
  $('lblKolon').innerText = k;
  updateStats();
}

/* ============ TOPLU YAPIŞTIR ============ */
function openTopluYapistir(){
  $('topluTextarea').value = '';
  $('topluModal').classList.add('active');
}

function topluAyrıştır(){
  const text = $('topluTextarea').value.trim();
  if(!text){
    showToast('error', 'Boş', 'Hiçbir şey yapıştırmadın.');
    return;
  }
  const satirlar = text.split('\n').filter(s => s.trim());
  let basarili = 0;
  satirlar.forEach((satir, idx) => {
    if(idx >= matchesData.length) return;
    const nums = satir.trim().split(/\s+/).map(Number);
    if(nums.length < 3) return;
    const m = matchesData[idx];
    oddsData[m.id] = { '1': nums[0], 'X': nums[1], '2': nums[2] };
    basarili++;
  });
  localStorage.setItem('skorlab_odds', JSON.stringify(oddsData));
  hesaplaPR();
  renderBulten();
  renderAnaliz();
  renderFiltreOzeti();
  updateStats();
  closeModal('topluModal');
  showToast('success', 'Ayrıştırıldı!', basarili + ' maçın oranı girildi.');
}

function temizleOranlar(){
  if(!confirm('Tüm oranları silmek istediğine emin misin?')) return;
  oddsData = {};
  localStorage.removeItem('skorlab_odds');
  hesaplaPR();
  renderBulten();
  renderAnaliz();
  renderFiltreOzeti();
  updateStats();
  showToast('success', 'Temizlendi', 'Tüm oranlar silindi.');
}

/* ============ KUPON OLUŞTUR ============ */
function kuponOlustur(){
  // Önce tüm oranlar girilmiş mi kontrol et
  let eksik = [];
  matchesData.forEach(m => {
    const od = oddsData[m.id];
    if(!od || !od['1'] || !od['X'] || !od['2']) eksik.push('#' + m.id);
  });
  if(eksik.length > 0){
    showToast('error', 'Eksik Oran', 'Şu maçların oranları eksik: ' + eksik.join(', '));
    return;
  }
  
  const bütçe = parseFloat($('budget').value) || 200;
  const kolonSayısı = Math.floor(bütçe / 10);
  const bMin = parseInt($('bankoMin').value) || 0;
  const bMax = parseInt($('bankoMax').value) || 15;
  const xMin = parseInt($('beraberlikMin').value) || 0;
  const xMax = parseInt($('beraberlikMax').value) || 15;
  const aMax = parseInt($('ardisikMax').value) || 3;
  
  // Her maç için sistem seçimi
  const secimler = matchesData.map((m,i) => {
    const od = oddsData[m.id];
    const o = oranToOlasilik(parseFloat(od['1']), parseFloat(od['X']), parseFloat(od['2']));
    const o1 = o.p[0], oX = o.p[1], o2 = o.p[2];
    const favori = o1 === Math.max(o1,oX,o2) ? '1' : oX === Math.max(o1,oX,o2) ? 'X' : '2';
    const favoriOlas = Math.max(o1, oX, o2);
    const s = sürprizHesapla(od['1'], od['X'], od['2']);
    const bankoMu = favoriOlas >= 65;
    
    let sistem = '';
    if(bankoMu) sistem = favori;
    else if(favoriOlas >= 50) sistem = favori === '1' ? '1X' : favori === '2' ? 'X2' : '12';
    else if(s.xOran < 3.5) sistem = '12';
    else sistem = favori === '1' ? '1X' : favori === '2' ? 'X2' : '12';
    
    return {
      idx: i,
      id: m.id,
      home: m.home,
      away: m.away,
      sistem: sistem,
      banko: bankoMu,
      sürpriz: s.puan,
      olasilik: favoriOlas
    };
  });
  
  // Kolonları üret
  const kolonlar = [];
  const denemeSayısı = kolonSayısı * 50;
  
  for(let d = 0; d < denemeSayısı && kolonlar.length < kolonSayısı; d++){
    const kolon = [];
    let bankoSayısı = 0;
    let beraberlikSayısı = 0;
    
    secimler.forEach((sec, i) => {
      let seçim = sec.sistem;
      // Banko ise direkt kullan
      if(sec.banko){
        kolon.push(seçim);
        bankoSayısı++;
        if(seçim === 'X') beraberlikSayısı++;
      } else {
        // Çift şansları tek seçime çevirme (rastgele)
        const r = Math.random();
        if(seçim === '1X'){
          seçim = r < 0.65 ? '1' : 'X';
        } else if(seçim === 'X2'){
          seçim = r < 0.5 ? 'X' : '2';
        } else if(seçim === '12'){
          seçim = r < 0.5 ? '1' : '2';
        }
        kolon.push(seçim);
        if(seçim === 'X') beraberlikSayısı++;
      }
    });
    
    // Ardışık kontrolü
    if(ardisikKontrol(kolon, aMax)){
      continue;
    }
    
    // Filtre kontrolü
    if(bankoSayısı < bMin || bankoSayısı > bMax) continue;
    if(beraberlikSayısı < xMin || beraberlikSayısı > xMax) continue;
    
    kolonlar.push({
      picks: kolon,
      banko: bankoSayısı,
      beraberlik: beraberlikSayısı,
      oran: kolon.reduce((t, s, i) => {
        const od = oddsData[matchesData[i].id];
        return t * parseFloat(od[s]);
      }, 1)
    });
  }
  
  // Sonuç
  const sonuc = $('kuponSonuc');
  if(kolonlar.length === 0){
    sonuc.innerHTML = '<div class="card"><div class="muted" style="text-align:center;padding:20px">❌ Filtrelere uygun kolon bulunamadı.<br>Filtreleri gevşet ve tekrar dene.</div></div>';
    showToast('error', 'Kolon Yok', 'Filtrelere uygun kolon bulunamadı.');
    return;
  }
  
  // Toplam oran
  const toplamOran = kolonlar.reduce((t, k) => t * k.oran, 1) / kolonlar.length;
  
  let html = `
    <div class="kupon-sonuc">
      <div class="baslik">📋 OLUŞTURULAN KUPON (${kolonlar.length} Kolon)</div>
      <div class="analiz-row" style="margin-bottom:10px">
        <span class="muted">Ortalama Oran: <b class="green">${toplamOran.toFixed(2)}</b></span>
        <span class="muted">Bütçe: <b>${bütçe} TL</b></span>
      </div>
      <div style="max-height:400px;overflow-y:auto">`;
  
  kolonlar.forEach((k, idx) => {
    html += `
      <div class="kolon">
        <div class="kolon-baslik">KOLON #${String(idx+1).padStart(2,'0')}</div>
        <div class="kolon-picks">${k.picks.join('-')}</div>
        <div class="kolon-info">Oran: ${k.oran.toFixed(2)} · Banko: ${k.banko} · Beraberlik: ${k.beraberlik}</div>
      </div>`;
  });
  
  html += `
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:12px">
        <button onclick="kuponKopyala()" class="blue">📋 Kopyala</button>
        <button onclick="kuponIndir()" class="gray">💾 İndir (.txt)</button>
      </div>
    </div>`;
  
  sonuc.innerHTML = html;
  window.kolonlar = kolonlar;
  
  showToast('success', 'Kupon Hazır!', kolonlar.length + ' kolon oluşturuldu.');
}

function ardisikKontrol(kolon, maxArdisik){
  let sayı = 1;
  for(let i = 1; i < kolon.length; i++){
    if(kolon[i] === kolon[i-1]){
      sayı++;
      if(sayı > maxArdisik) return true;
    } else {
      sayı = 1;
    }
  }
  return false;
}

function kuponKopyala(){
  if(!window.kolonlar || !window.kolonlar.length){
    showToast('error', 'Kupon Yok', 'Önce kupon oluştur.');
    return;
  }
  let text = '🎯 SKORLAB KUPONU\n━━━━━━━━━━━━━━━\n\n';
  window.kolonlar.forEach((k, idx) => {
    text += 'KOLON #' + String(idx+1).padStart(2,'0') + '\n';
    text += k.picks.join('-') + '\n';
    text += 'Oran: ' + k.oran.toFixed(2) + ' · Banko: ' + k.banko + ' · Beraberlik: ' + k.beraberlik + '\n\n';
  });
  navigator.clipboard.writeText(text).then(() => {
    showToast('success', 'Kopyalandı!', 'Kupon panoya kopyalandı.');
  }).catch(() => {
    showToast('error', 'Hata', 'Kopyalanamadı.');
  });
}

function kuponIndir(){
  if(!window.kolonlar || !window.kolonlar.length){
    showToast('error', 'Kupon Yok', 'Önce kupon oluştur.');
    return;
  }
  let text = '🎯 SKORLAB KUPONU\n━━━━━━━━━━━━━━━\n\n';
  window.kolonlar.forEach((k, idx) => {
    text += 'KOLON #' + String(idx+1).padStart(2,'0') + '\n';
    text += k.picks.join('-') + '\n';
    text += 'Oran: ' + k.oran.toFixed(2) + '\n\n';
  });
  const blob = new Blob([text], {type:'text/plain'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'skorlab-kupon.txt';
  a.click();
  URL.revokeObjectURL(url);
  showToast('success', 'İndirildi!', 'Kupon .txt olarak indirildi.');
}

/* ============ BACKTEST ============ */
function renderArsiv(){
  const container = $('arsivListesi');
  if(!container) return;
  
  if(!archiveData.weeks || !archiveData.weeks.length){
    container.innerHTML = '<div class="card"><div class="muted" style="text-align:center;padding:20px">Henüz arşiv verisi yok.<br><br>archive.json dosyasına geçmiş sonuçları ekle.</div></div>';
    // Genel istatistik sıfırla
    ['gToplamHafta','gOrtalama','gEnIyi','gEnKotu'].forEach(id => { const el = $(id); if(el) el.innerText = '-'; });
    return;
  }
  
  let toplamDoğru = 0, toplamMaç = 0;
  let enIyi = 0, enKotu = 100;
  
  container.innerHTML = archiveData.weeks.map(w => {
    const sonuçlar = w.results || [];
    let doğru = 0;
    sonuçlar.forEach((r, idx) => {
      const m = matchesData[idx];
      if(!m) return;
      const od = oddsData[m.id];
      if(!od) return;
      const o = oranToOlasilik(od['1'], od['X'], od['2']);
      const favori = o.p[0] === Math.max(o.p[0],o.p[1],o.p[2]) ? '1' : o.p[1] === Math.max(o.p[0],o.p[1],o.p[2]) ? 'X' : '2';
      if(favori === r) doğru++;
    });
    const yüzde = sonuçlar.length ? (doğru / sonuçlar.length * 100) : 0;
    toplamDoğru += doğru;
    toplamMaç += sonuçlar.length;
    if(yüzde > enIyi) enIyi = yüzde;
    if(yüzde < enKotu) enKotu = yüzde;
    
    const renk = yüzde >= 70 ? 'green' : yüzde >= 50 ? 'orange' : 'red';
    
    return `
      <div class="arsiv-hafta">
        <div class="hafta-baslik">📅 ${w.week}</div>
        <div class="hafta-info">
          Toplam: <b>${sonuçlar.length}</b> maç<br>
          Model Tutma: <b style="color:var(--${renk})">${doğru}/${sonuçlar.length} (%${yüzde.toFixed(0)})</b><br>
          Sonuçlar: <span style="font-family:monospace;color:var(--text)">${sonuçlar.join('-')}</span>
        </div>
      </div>`;
  }).join('');
  
  // Genel
  const genelYüzde = toplamMaç ? (toplamDoğru / toplamMaç * 100) : 0;
  const g1 = $('gToplamHafta'); if(g1) g1.innerText = archiveData.weeks.length;
  const g2 = $('gOrtalama'); if(g2) g2.innerText = '%' + genelYüzde.toFixed(0);
  const g3 = $('gEnIyi'); if(g3) g3.innerText = '%' + enIyi.toFixed(0);
  const g4 = $('gEnKotu'); if(g4) g4.innerText = '%' + enKotu.toFixed(0);
}

/* ============ TAB ============ */
function switchTab(i, el){
  document.querySelectorAll('.tab,.page').forEach(e => e.classList.remove('active'));
  el.classList.add('active');
  $('page-' + i).classList.add('active');
  if(i === 1) renderAnaliz();
  if(i === 2) renderFiltreOzeti();
  if(i === 3) renderArsiv();
  window.scrollTo({top:0,behavior:'smooth'});
}

/* ============ MODAL ============ */
function openModal(id){ $(id).classList.add('active'); }
function closeModal(id){ $(id).classList.remove('active'); }
function closeResultModal(){ $('resultModal').classList.remove('active'); }

function showToast(type, title, msg){
  $('toastIcon').innerText = type === 'success' ? '✅' : '❌';
  $('toastTitle').innerText = title;
  $('toastMsg').innerHTML = msg;
  openModal('toastModal');
}

/* ============ BAŞLAT ============ */
window.onload = function(){
  loadData();
  // Filtre input değişince özeti güncelle
  ['bankoMin','bankoMax','beraberlikMin','beraberlikMax','ardisikMax'].forEach(id => {
    const el = $(id);
    if(el) el.addEventListener('input', renderFiltreOzeti);
  });
  setTimeout(() => openModal('legalModal'), 800);
};
