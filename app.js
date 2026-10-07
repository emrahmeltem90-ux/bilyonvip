/* ============================================================
   SKORLAB v3 · 2 AŞAMALI MOTOR
   AŞAMA 1: Maç Tahmin Motoru
   AŞAMA 2: Kupon Optimizasyon Motoru
   ============================================================ */

let matchesData = [];
let PR = [];
let oddsData = {};
let analizler = {};
let archiveData = { weeks: [] };
let riskMode = 'dengeli';
let manuelSecimler = {};

const $ = id => document.getElementById(id);

/* ============================================================
   MODÜL 1: oddsCalculator
   ============================================================ */
function oranToOlasilik(o1, oX, o2){
  const r1 = 1/o1, rX = 1/oX, r2 = 1/o2;
  const toplam = r1 + rX + r2;
  return {
    p: [(r1/toplam)*100, (rX/toplam)*100, (r2/toplam)*100],
    marj: ((toplam-1)*100).toFixed(2)
  };
}

/* ============================================================
   MODÜL 2: matchAnalyzer
   ============================================================ */
function macAnalizEt(matchId){
  const od = oddsData[matchId];
  if(!od || !od['1'] || !od['X'] || !od['2']) return null;
  const o = oranToOlasilik(parseFloat(od['1']), parseFloat(od['X']), parseFloat(od['2']));
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
  return {
    matchId: matchId,
    p1: p1, pX: pX, p2: p2,
    marj: parseFloat(o.marj),
    sirali: sirali,
    enYuksek: enYuksek,
    ikinci: ikinci,
    ucuncu: ucuncu,
    fark: fark
  };
}

/* ============================================================
   MODÜL 3: predictionEngine
   ============================================================ */
function tahminUret(analiz){
  if(!analiz) return null;
  const { enYuksek, ikinci, ucuncu, fark } = analiz;
  let karar = '', guven = 0, risk = '', alternatif = '', surpriz = '';
  
  if(enYuksek.olas >= 70 && fark >= 35){
    karar = 'BANKO ' + enYuksek.kod;
    guven = Math.min(100, enYuksek.olas + 6);
    risk = 'Çok Düşük';
    alternatif = siraliAlternatif(enYuksek.kod, ikinci.kod);
    surpriz = ucuncu.kod;
  }
  else if(enYuksek.olas >= 60 && fark >= 20){
    karar = 'BANKO ' + enYuksek.kod;
    guven = Math.min(100, enYuksek.olas + 3);
    risk = 'Düşük';
    alternatif = siraliAlternatif(enYuksek.kod, ikinci.kod);
    surpriz = ucuncu.kod;
  }
  else if(enYuksek.olas >= 50 && fark >= 10){
    karar = 'ÇİFT ' + siraliAlternatif(enYuksek.kod, ikinci.kod);
    guven = enYuksek.olas;
    risk = 'Orta';
    alternatif = siraliAlternatif(enYuksek.kod, ikinci.kod);
    surpriz = ucuncu.kod;
  }
  else if(enYuksek.olas >= 42 && fark >= 5){
    karar = 'ÇİFT ' + siraliAlternatif(enYuksek.kod, ikinci.kod);
    guven = enYuksek.olas - 3;
    risk = 'Yüksek';
    alternatif = siraliAlternatif(enYuksek.kod, ikinci.kod);
    surpriz = ucuncu.kod;
  }
  else if(enYuksek.olas >= 38 && fark >= 3){
    karar = 'ÇİFT ' + siraliAlternatif(enYuksek.kod, ikinci.kod);
    guven = enYuksek.olas - 5;
    risk = 'Yüksek';
    alternatif = siraliAlternatif(enYuksek.kod, ikinci.kod);
    surpriz = ucuncu.kod;
  }
  else{
    karar = 'ÜÇLÜ 1X2';
    guven = Math.max(30, enYuksek.olas - 8);
    risk = 'Çok Yüksek';
    alternatif = '1X2';
    surpriz = ucuncu.kod;
  }
  
  return {
    ana_tahmin: enYuksek.kod,
    alternatif: alternatif,
    surpriz: surpriz,
    guven: Math.round(guven),
    risk: risk,
    karar: karar,
    favori_farki: Math.round(fark)
  };
}

function siraliAlternatif(a, b){
  const sıra = {'1':1, 'X':2, '2':3};
  return (sıra[a] < sıra[b] ? a : b) + (sıra[a] < sıra[b] ? b : a);
}

/* ============================================================
   VERİ YÜKLE
   ============================================================ */
async function loadData(){
  try{
    const res = await fetch('matches.json');
    const raw = await res.json();
    matchesData = (raw.matches || raw).map(m => ({
      id: m.id,
      home: m.home,
      away: m.away,
      date: m.date || '',
      league: m.league || '',
      odds: m.odds || null
    }));
    
    oddsData = {};
    matchesData.forEach(m => {
      if(m.odds) oddsData[m.id] = {...m.odds};
    });
    
    const kayitli = JSON.parse(localStorage.getItem('skorlab_odds') || '{}');
    Object.keys(kayitli).forEach(id => {
      oddsData[id] = {...(oddsData[id] || {}), ...kayitli[id]};
    });
    
    $('weekTitle').innerText = raw.week || 'Bu Hafta';
    hesaplaPR();
    renderBulten();
    updateStats();
    updateKolon();
  }catch(e){
    console.error('loadData hatası:', e);
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

/* ============================================================
   RENDER: BÜLTEN
   ============================================================ */
function renderBulten(){
  $('matchesList').innerHTML = matchesData.map((m,i) => {
    const od = oddsData[m.id] || {};
    const hasOdds = od['1'] && od['X'] && od['2'];
    const analiz = hasOdds ? macAnalizEt(m.id) : null;
    const tahmin = analiz ? tahminUret(analiz) : null;
    
    let badgeHTML = '';
    if(tahmin){
      const manuel = manuelSecimler[m.id];
      const karar = manuel ? 'MANUEL ' + manuel : tahmin.karar;
      const kararClass = karar.includes('BANKO') ? 'green' : karar.includes('ÇİFT') ? 'yellow' : karar.includes('ÜÇLÜ') ? 'red' : 'purple';
      badgeHTML = `<span class="badge ${kararClass}">${karar}</span>`;
    }
    
    return `
    <div class="match" onclick="macDetayGoster(${m.id})">
      <div class="match-head">
        <span>${m.date}</span>
        <span class="mid">MAÇ #${m.id}</span>
      </div>
      <div class="teams">${m.home} - ${m.away}${badgeHTML}
        ${m.league ? '<span class="league-tag">' + m.league + '</span>' : ''}
      </div>
      <div class="oran-input-grid" onclick="event.stopPropagation()">
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
  renderTahminListesi();
  updateStats();
}

/* ============================================================
   RENDER: TAHMİN LİSTESİ
   ============================================================ */
function renderTahminListesi(){
  const container = $('tahminListesi');
  if(!container) return;
  const analizli = matchesData.map(m => {
    const analiz = macAnalizEt(m.id);
    if(!analiz) return null;
    const tahmin = tahminUret(analiz);
    const manuel = manuelSecimler[m.id];
    return { m, analiz, tahmin, manuel };
  }).filter(x => x !== null);
  
  if(!analizli.length){
    container.innerHTML = '<div class="card"><div class="muted" style="text-align:center;padding:20px">Oran gir → tahmin gelsin</div></div>';
    return;
  }
  
  container.innerHTML = analizli.map(({m, analiz, tahmin, manuel}) => {
    const karar = manuel ? 'MANUEL ' + manuel : tahmin.karar;
    const ana = manuel || tahmin.ana_tahmin;
    const kararClass = karar.includes('BANKO') ? 'banko' : karar.includes('ÇİFT') ? 'cift' : karar.includes('ÜÇLÜ') ? 'uclu' : 'surpriz';
    const ikon = karar.includes('BANKO') ? '🔒' : karar.includes('ÇİFT') ? '⚠️' : karar.includes('ÜÇLÜ') ? '🔥' : '🎲';
    
    return `
    <div class="tahmin-kart ${kararClass}" onclick="macDetayGoster(${m.id})" style="cursor:pointer">
      <div class="tk-head">
        <span>${m.date} · ${m.league}</span>
        <span>${ikon} MAÇ #${m.id}${manuel ? ' <span style="color:var(--orange);font-size:.65rem">[M]</span>' : ''}</span>
      </div>
      <div class="tk-teams">${m.home} - ${m.away}</div>
      <div class="tk-ana">
        <div class="lbl">${karar}</div>
        <div class="val">${ana}</div>
      </div>
      <div class="tk-info">
        <div class="tk-item"><span class="lbl">Güven</span><span class="val">%${tahmin.guven}</span></div>
        <div class="tk-item"><span class="lbl">Risk</span><span class="val">${tahmin.risk}</span></div>
        <div class="tk-item"><span class="lbl">Olasılık</span><span class="val">%${analiz.enYuksek.olas.toFixed(0)}</span></div>
        <div class="tk-item"><span class="lbl">Fark</span><span class="val">%${tahmin.favori_farki}</span></div>
      </div>
      <div class="tk-alt">
        <b>Alternatif:</b> ${tahmin.alternatif} · <b>Sürpriz:</b> ${tahmin.surpriz}
      </div>
    </div>`;
  }).join('');
}

/* ============================================================
   STATS
   ============================================================ */
function updateStats(){
  const analizli = matchesData.map(m => {
    const analiz = macAnalizEt(m.id);
    if(!analiz) return null;
    const tahmin = tahminUret(analiz);
    const manuel = manuelSecimler[m.id];
    return manuel ? {...tahmin, karar: 'MANUEL ' + manuel} : tahmin;
  }).filter(x => x !== null);
  
  const banko = analizli.filter(t => t.karar.includes('BANKO')).length;
  const cift = analizli.filter(t => t.karar.includes('ÇİFT')).length;
  const uclu = analizli.filter(t => t.karar.includes('ÜÇLÜ')).length;
  const ortalamaGuven = analizli.length ? Math.round(analizli.reduce((t,x) => t + x.guven, 0) / analizli.length) : 0;
  
  const sM = $('statMac'); if(sM) sM.innerText = matchesData.length;
  const sB = $('statBanko'); if(sB) sB.innerText = banko;
  const sC = $('statCift'); if(sC) sC.innerText = cift + uclu;
  const sG = $('statGuven'); if(sG) sG.innerText = '%' + ortalamaGuven;
}

/* ============================================================
   TOPLU YAPIŞTIR
   ============================================================ */
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
  renderTahminListesi();
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
  renderTahminListesi();
  updateStats();
  showToast('success', 'Temizlendi', 'Tüm oranlar silindi.');
}

/* ============================================================
   TAHMİN VER
   ============================================================ */
function tahminVer(){
  const analizli = matchesData.map(m => {
    const analiz = macAnalizEt(m.id);
    if(!analiz) return null;
    const tahmin = tahminUret(analiz);
    const manuel = manuelSecimler[m.id];
    return { m, analiz, tahmin, manuel };
  }).filter(x => x !== null);
  
  if(analizli.length === 0){
    showToast('error', 'Oran Yok', 'Önce oranları gir.');
    return;
  }
  
  const banko = analizli.filter(x => (x.manuel ? x.manuel : x.tahmin.karar).includes('BANKO')).length;
  const cift = analizli.filter(x => (x.manuel ? x.manuel : x.tahmin.karar).includes('ÇİFT')).length;
  const uclu = analizli.filter(x => (x.manuel ? x.manuel : x.tahmin.karar).includes('ÜÇLÜ')).length;
  const ortalamaGuven = Math.round(analizli.reduce((t,x) => t + x.tahmin.guven, 0) / analizli.length);
  
  $('tahminModalBody').innerHTML = `
    <div style="font-size:.8rem;line-height:1.8">
      <div style="background:var(--bg2);border-radius:10px;padding:12px;margin-bottom:12px">
        <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;text-align:center">
          <div><div style="color:var(--green);font-weight:900;font-size:1.2rem">${banko}</div><div style="color:var(--muted);font-size:.6rem">BANKO</div></div>
          <div><div style="color:var(--orange);font-weight:900;font-size:1.2rem">${cift}</div><div style="color:var(--muted);font-size:.6rem">ÇİFT</div></div>
          <div><div style="color:var(--red);font-weight:900;font-size:1.2rem">${uclu}</div><div style="color:var(--muted);font-size:.6rem">ÜÇLÜ</div></div>
          <div><div style="color:var(--blue);font-weight:900;font-size:1.2rem">%${ortalamaGuven}</div><div style="color:var(--muted);font-size:.6rem">ORT. GÜVEN</div></div>
        </div>
      </div>
      ${analizli.map(({m, tahmin, manuel}) => {
        const karar = manuel ? 'MANUEL ' + manuel : tahmin.karar;
        const ana = manuel || tahmin.ana_tahmin;
        const ikon = karar.includes('BANKO') ? '🔒' : karar.includes('ÇİFT') ? '⚠️' : karar.includes('ÜÇLÜ') ? '🔥' : '🎲';
        const renk = karar.includes('BANKO') ? 'green' : karar.includes('ÇİFT') ? 'orange' : karar.includes('ÜÇLÜ') ? 'red' : 'purple';
        return `
          <div style="background:var(--bg2);border-left:3px solid var(--${renk});border-radius:8px;padding:8px 10px;margin-bottom:6px">
            <div style="font-weight:800;font-size:.78rem">${ikon} #${m.id} ${m.home} - ${m.away}</div>
            <div style="font-size:.7rem;color:var(--muted);margin-top:4px">
              <b style="color:var(--${renk})">${ana}</b> · ${karar} · Güven %${tahmin.guven} · Risk: ${tahmin.risk}
            </div>
          </div>`;
      }).join('')}
    </div>
  `;
  $('tahminModal').classList.add('active');
}

/* ============================================================
   MAÇ DETAY + MANUEL
   ============================================================ */
function macDetayGoster(matchId){
  const m = matchesData.find(x => x.id === matchId);
  if(!m) return;
  const od = oddsData[matchId];
  if(!od || !od['1'] || !od['X'] || !od['2']){
    showToast('error', 'Oran Yok', 'Bu maçın oranları girilmemiş.');
    return;
  }
  
  const analiz = macAnalizEt(matchId);
  const tahmin = tahminUret(analiz);
  const o = oranToOlasilik(parseFloat(od['1']), parseFloat(od['X']), parseFloat(od['2']));
  const manuel = manuelSecimler[matchId];
  
  $('macDetayTitle').innerText = '📊 MAÇ #' + matchId;
  $('macDetayBody').innerHTML = `
    <div style="font-size:.8rem;line-height:1.8">
      <div style="text-align:center;margin-bottom:14px">
        <div style="font-weight:900;font-size:1rem">${m.home} - ${m.away}</div>
        <div style="color:var(--muted);font-size:.7rem;margin-top:4px">${m.date} · ${m.league}</div>
      </div>
      
      <div class="analiz-box">
        <div class="analiz-row"><span class="analiz-lbl">📊 ORANLAR</span></div>
        <div class="analiz-row"><span>1: <b>${od['1']}</b></span><span>X: <b>${od['X']}</b></span><span>2: <b>${od['2']}</b></span></div>
      </div>
      
      <div class="analiz-box">
        <div class="analiz-row"><span class="analiz-lbl">📈 OLASILIKLAR</span></div>
        <div class="analiz-row"><span>1: <b class="green">%${o.p[0].toFixed(1)}</b></span><span>X: <b class="green">%${o.p[1].toFixed(1)}</b></span><span>2: <b class="green">%${o.p[2].toFixed(1)}</b></span></div>
      </div>
      
      <div class="tahmin-kart ${tahmin.karar.includes('BANKO') ? 'banko' : tahmin.karar.includes('ÇİFT') ? 'cift' : 'uclu'}">
        <div class="tk-head"><span>SİSTEM TAHMİNİ</span><span>GÜVEN %${tahmin.guven}</span></div>
        <div class="tk-ana">
          <div class="lbl">${tahmin.karar}</div>
          <div class="val">${tahmin.ana_tahmin}</div>
        </div>
        <div class="tk-info">
          <div class="tk-item"><span class="lbl">Alternatif</span><span class="val">${tahmin.alternatif}</span></div>
          <div class="tk-item"><span class="lbl">Sürpriz</span><span class="val">${tahmin.surpriz}</span></div>
          <div class="tk-item"><span class="lbl">Risk</span><span class="val">${tahmin.risk}</span></div>
          <div class="tk-item"><span class="lbl">Fark</span><span class="val">%${tahmin.favori_farki}</span></div>
        </div>
      </div>
      
      <div style="margin-top:12px">
        <div style="font-weight:800;color:var(--orange);font-size:.78rem;margin-bottom:8px">🎯 MANUEL MÜDAHALE</div>
        <div style="font-size:.7rem;color:var(--muted);margin-bottom:8px">Sistem kararını beğenmediysen kendi seçimini yap:</div>
        <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:6px">
          <button onclick="manuelSecim(${matchId},'1')" class="${manuel === '1' ? 'blue' : 'gray'}" style="padding:10px;font-size:.85rem">1</button>
          <button onclick="manuelSecim(${matchId},'X')" class="${manuel === 'X' ? 'blue' : 'gray'}" style="padding:10px;font-size:.85rem">X</button>
          <button onclick="manuelSecim(${matchId},'2')" class="${manuel === '2' ? 'blue' : 'gray'}" style="padding:10px;font-size:.85rem">2</button>
        </div>
        ${manuel ? `<div style="margin-top:8px;padding:8px;background:rgba(255,176,32,.1);border-left:3px solid var(--orange);border-radius:6px;font-size:.72rem;color:var(--orange)"><b>Manuel seçim: ${manuel}</b> · Sistem: ${tahmin.ana_tahmin}</div>` : ''}
      </div>
    </div>
  `;
  $('macDetayModal').classList.add('active');
}

function manuelSecim(matchId, secim){
  if(manuelSecimler[matchId] === secim){
    delete manuelSecimler[matchId];
  } else {
    manuelSecimler[matchId] = secim;
  }
  macDetayGoster(matchId);
  renderBulten();
  renderTahminListesi();
  updateStats();
  showToast('success', 'Manuel Seçim', secim + ' olarak ayarlandı.');
}

/* ============================================================
   KUPON OLUŞTUR
   ============================================================ */
function kuponOlustur(){
  let eksik = [];
  matchesData.forEach(m => {
    const od = oddsData[m.id];
    if(!od || !od['1'] || !od['X'] || !od['2']) eksik.push('#' + m.id);
  });
  if(eksik.length > 0){
    showToast('error', 'Eksik Oran', 'Şu maçların oranları eksik: ' + eksik.join(', '));
    return;
  }
  
  const butce = parseFloat($('budget').value) || 200;
  const kolonSayisi = Math.floor(butce / 10);
  
  const analizli = matchesData.map(m => {
    const analiz = macAnalizEt(m.id);
    if(!analiz) return null;
    const tahmin = tahminUret(analiz);
    const manuel = manuelSecimler[m.id];
    return {
      matchId: m.id,
      m: m,
      analiz: analiz,
      tahmin: tahmin,
      karar: manuel ? 'MANUEL ' + manuel : tahmin.karar,
      ana: manuel || tahmin.ana_tahmin,
      manuel: manuel ? true : false
    };
  }).filter(x => x !== null);
  
  const dagilim = {};
  analizli.forEach(({matchId, karar, ana, tahmin, manuel}) => {
    if(karar.includes('BANKO') || manuel){
      dagilim[matchId] = { [ana]: kolonSayisi };
    }
    else if(karar.includes('ÇİFT')){
      const guven = tahmin.guven;
      const anaOran = guven / 100;
      const anaKolon = Math.max(1, Math.round(kolonSayisi * anaOran));
      const altKolon = kolonSayisi - anaKolon;
      
      let ikinci = '';
      const kararStr = karar.replace('ÇİFT ', '');
      if(kararStr === '1X'){ ikinci = ana === '1' ? 'X' : '1'; }
      else if(kararStr === 'X2'){ ikinci = ana === 'X' ? '2' : 'X'; }
      else if(kararStr === '12'){ ikinci = ana === '1' ? '2' : '1'; }
      else { ikinci = ana === '1' ? 'X' : '2'; }
      
      dagilim[matchId] = { [ana]: anaKolon, [ikinci]: altKolon };
    }
    else if(karar.includes('ÜÇLÜ')){
      const pay = Math.floor(kolonSayisi / 3);
      const kalan = kolonSayisi - (pay * 3);
      dagilim[matchId] = {
        '1': pay + (kalan > 0 ? 1 : 0),
        'X': pay + (kalan > 1 ? 1 : 0),
        '2': pay
      };
    }
    else{
      dagilim[matchId] = { [ana]: kolonSayisi };
    }
  });
  
  const kolonlar = [];
  const gorulen = new Set();
  let deneme = 0;
  const maxDeneme = 5000;
  
  while(kolonlar.length < kolonSayisi && deneme < maxDeneme){
    deneme++;
    const kolon = [];
    let oran = 1;
    let bankoSayisi = 0;
    let ciftSayisi = 0;
    
    analizli.forEach(({matchId, karar, m}) => {
      const d = dagilim[matchId];
      const secenekler = Object.keys(d);
      const toplam = secenekler.reduce((t,s) => t + d[s], 0);
      let secim = '';
      const r = Math.random();
      let kumulatif = 0;
      
      for(const s of secenekler){
        kumulatif += d[s] / toplam;
        if(r < kumulatif){ secim = s; break; }
      }
      if(!secim) secim = secenekler[0];
      
      kolon.push(secim);
      
      const od = oddsData[matchId];
      if(od && od[secim]) oran *= parseFloat(od[secim]);
      
      if(karar.includes('BANKO')) bankoSayisi++;
      if(karar.includes('ÇİFT')) ciftSayisi++;
    });
    
    const key = kolon.join('-');
    if(!gorulen.has(key)){
      gorulen.add(key);
      kolonlar.push({ picks: kolon, oran: oran, banko: bankoSayisi, cift: ciftSayisi });
    }
  }
  
  let html = `
    <div class="kupon-sonuc">
      <div class="baslik">⚡ KUPON (${kolonlar.length} Kolon)</div>
      
      <div style="background:var(--bg2);border-radius:10px;padding:12px;margin-bottom:14px">
        <div style="font-weight:800;color:var(--green);font-size:.78rem;margin-bottom:8px">📊 GENEL BİLGİ</div>
        <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;font-size:.72rem">
          <div><b>Bütçe:</b> ${butce} TL</div>
          <div><b>Kolon:</b> ${kolonlar.length}</div>
          <div><b>Ort. Oran:</b> ${(kolonlar.reduce((t,k)=>t+k.oran,0)/kolonlar.length).toFixed(1)}</div>
        </div>
      </div>
      
      <div style="background:var(--bg2);border-radius:10px;padding:12px;margin-bottom:14px">
        <div style="font-weight:800;color:var(--green);font-size:.78rem;margin-bottom:8px">📋 MAÇ BAZLI DAĞILIM</div>
        ${analizli.map(({matchId, m, karar, ana, manuel}) => {
          const d = dagilim[matchId];
          const secenekStr = Object.keys(d).sort().map(k => `<b>${k}</b>: ${d[k]}`).join(' · ');
          const manuelTag = manuel ? ' <span style="color:var(--orange);font-size:.6rem">[M]</span>' : '';
          return `<div style="font-size:.72rem;padding:4px 0;border-bottom:1px solid var(--border)">
            <b>#${matchId}</b> ${m.home.slice(0,10)}: ${secenekStr}${manuelTag}
          </div>`;
        }).join('')}
      </div>
      
      <div style="max-height:350px;overflow-y:auto;margin-bottom:14px">
        ${kolonlar.map((k, idx) => `
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
    </div>
  `;
  
  $('kuponSonuc').innerHTML = html;
  window.sonKolonlar = kolonlar;
  showToast('success', 'Kupon Hazır!', kolonlar.length + ' kolon oluşturuldu.');
}

function kuponKopyala(){
  if(!window.sonKolonlar || !window.sonKolonlar.length){
    showToast('error', 'Kupon Yok', 'Önce kupon oluştur.');
    return;
  }
  let text = '🎯 SKORLAB KUPONU\n━━━━━━━━━━━━━━━\n\n';
  window.sonKolonlar.forEach((k, idx) => {
    text += 'KOLON #' + String(idx+1).padStart(2,'0') + ': ' + k.picks.join('-') + '\n';
  });
  navigator.clipboard.writeText(text).then(() => {
    showToast('success', 'Kopyalandı!', 'Kupon panoya kopyalandı.');
  }).catch(() => {
    showToast('error', 'Hata', 'Kopyalanamadı.');
  });
}

function kuponIndir(){
  if(!window.sonKolonlar || !window.sonKolonlar.length){
    showToast('error', 'Kupon Yok', 'Önce kupon oluştur.');
    return;
  }
  let text = '🎯 SKORLAB KUPONU\n━━━━━━━━━━━━━━━\n\n';
  window.sonKolonlar.forEach((k, idx) => {
    text += 'KOLON #' + String(idx+1).padStart(2,'0') + ': ' + k.picks.join('-') + ' (Oran: ' + k.oran.toFixed(2) + ')\n';
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

/* ============================================================
   BÜTÇE & MOD
   ============================================================ */
function updateKolon(){
  const b = parseFloat($('budget').value) || 0;
  const k = Math.floor(b / 10);
  const lbl = $('lblCost'); if(lbl) lbl.innerText = b + ' TL';
  const klbl = $('lblKolon'); if(klbl) klbl.innerText = k;
}

function setRiskMode(mode, el){
  riskMode = mode;
  document.querySelectorAll('.mode').forEach(e => e.classList.remove('active'));
  if(el) el.classList.add('active');
  const info = {
    guvenli: '<b>🛡️ GÜVENLİ</b><br>Banko maçlara öncelik, çift şans ağırlıklı.',
    dengeli: '<b>⚖️ DENGELİ</b><br>Banko + çift şans karışık, sürprizlere kontrollü yer.',
    agresif: '<b>🚀 AGRESİF</b><br>Sürprizlere daha fazla kolon.'
  };
  const el2 = $('modeInfo'); if(el2) el2.innerHTML = info[mode];
}

/* ============================================================
   ARŞİV
   ============================================================ */
function renderArsiv(){
  const container = $('arsivListesi');
  if(!container) return;
  if(!archiveData.weeks || !archiveData.weeks.length){
    container.innerHTML = '<div class="card"><div class="muted" style="text-align:center;padding:20px">Henüz arşiv verisi yok.</div></div>';
    ['gToplamHafta','gOrtalama','gEnIyi','gEnKotu'].forEach(id => { const el = $(id); if(el) el.innerText = '-'; });
    return;
  }
  let toplamDogru = 0, toplamMac = 0, enIyi = 0, enKotu = 100;
  container.innerHTML = archiveData.weeks.map(w => {
    const sonuclar = w.results || [];
    let dogru = 0;
    sonuclar.forEach((r, idx) => {
      const m = matchesData[idx];
      if(!m) return;
      const analiz = macAnalizEt(m.id);
      if(!analiz) return;
      if(analiz.enYuksek.kod === r) dogru++;
    });
    const yuzde = sonuclar.length ? (dogru / sonuclar.length * 100) : 0;
    toplamDogru += dogru; toplamMac += sonuclar.length;
    if(yuzde > enIyi) enIyi = yuzde;
    if(yuzde < enKotu) enKotu = yuzde;
    const renk = yuzde >= 70 ? 'green' : yuzde >= 50 ? 'orange' : 'red';
    return `
      <div class="arsiv-hafta">
        <div class="hafta-baslik">📅 ${w.week}</div>
        <div class="hafta-info">
          Toplam: <b>${sonuclar.length}</b> maç<br>
          Model Tutma: <b style="color:var(--${renk})">${dogru}/${sonuclar.length} (%${yuzde.toFixed(0)})</b><br>
          Sonuçlar: <span style="font-family:monospace">${sonuclar.join('-')}</span>
        </div>
      </div>`;
  }).join('');
  const genelYuzde = toplamMac ? (toplamDogru / toplamMac * 100) : 0;
  const g1 = $('gToplamHafta'); if(g1) g1.innerText = archiveData.weeks.length;
  const g2 = $('gOrtalama'); if(g2) g2.innerText = '%' + genelYuzde.toFixed(0);
  const g3 = $('gEnIyi'); if(g3) g3.innerText = '%' + enIyi.toFixed(0);
  const g4 = $('gEnKotu'); if(g4) g4.innerText = '%' + enKotu.toFixed(0);
}

/* ============================================================
   TAB
   ============================================================ */
function switchTab(i, el){
  document.querySelectorAll('.tab,.page').forEach(e => e.classList.remove('active'));
  el.classList.add('active');
  $('page-' + i).classList.add('active');
  if(i === 1) renderTahminListesi();
  if(i === 3) renderArsiv();
  window.scrollTo({top:0,behavior:'smooth'});
}

/* ============================================================
   MODAL & TOAST
   ============================================================ */
function openModal(id){ $(id).classList.add('active'); }
function closeModal(id){ $(id).classList.remove('active'); }

function showToast(type, title, msg){
  $('toastIcon').innerText = type === 'success' ? '✅' : '❌';
  $('toastTitle').innerText = title;
  $('toastMsg').innerHTML = msg;
  openModal('toastModal');
}

/* ============================================================
   BAŞLAT
   ============================================================ */
window.onload = function(){
  try { loadData(); } catch(e) { console.error(e); }
  try { updateKolon(); } catch(e) { console.error(e); }
  setTimeout(() => openModal('legalModal'), 800);
};
