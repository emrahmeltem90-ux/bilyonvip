/* ============================================================
   SKORLAB v4 · TOTO + İDDAA · TEK DOSYA
   ============================================================ */

let matchesData = [];
let PR = [];
let oddsData = {};
let serbestData = JSON.parse(localStorage.getItem('skorlab_serbest') || '[]');
let archiveData = { weeks: [] };
let riskMode = 'dengeli';
let kuponKaynak = 'toto';
let manuelSecimler = {};

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
  return {
    id: id, p1: p1, pX: pX, p2: p2,
    marj: parseFloat(o.marj),
    sirali: sirali, enYuksek: enYuksek, ikinci: ikinci, ucuncu: ucuncu, fark: fark
  };
}

/* ============ PREDICTION ENGINE ============ */
function tahminUret(analiz){
  if(!analiz) return null;
  const { enYuksek, ikinci, ucuncu, fark } = analiz;
  let karar = '', guven = 0, risk = '';
  
  if(enYuksek.olas >= 70 && fark >= 35){
    karar = 'BANKO ' + enYuksek.kod;
    guven = Math.min(100, enYuksek.olas + 6);
    risk = 'Çok Düşük';
  }
  else if(enYuksek.olas >= 60 && fark >= 20){
    karar = 'BANKO ' + enYuksek.kod;
    guven = Math.min(100, enYuksek.olas + 3);
    risk = 'Düşük';
  }
  else if(enYuksek.olas >= 50 && fark >= 10){
    karar = 'ÇİFT ' + siraliAlternatif(enYuksek.kod, ikinci.kod);
    guven = enYuksek.olas;
    risk = 'Orta';
  }
  else if(enYuksek.olas >= 42 && fark >= 5){
    karar = 'ÇİFT ' + siraliAlternatif(enYuksek.kod, ikinci.kod);
    guven = enYuksek.olas - 3;
    risk = 'Yüksek';
  }
  else if(enYuksek.olas >= 38 && fark >= 3){
    karar = 'ÇİFT ' + siraliAlternatif(enYuksek.kod, ikinci.kod);
    guven = enYuksek.olas - 5;
    risk = 'Yüksek';
  }
  else{
    karar = 'ÜÇLÜ 1X2';
    guven = Math.max(30, enYuksek.olas - 8);
    risk = 'Çok Yüksek';
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
    favori_farki: Math.round(fark)
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
    const raw = await res.json();
    matchesData = (raw.matches || raw).map(m => ({
      id: m.id, home: m.home, away: m.away,
      date: m.date || '', league: m.league || '',
      odds: m.odds || null
    }));
    oddsData = {};
    matchesData.forEach(m => { if(m.odds) oddsData[m.id] = {...m.odds}; });
    const kayitli = JSON.parse(localStorage.getItem('skorlab_odds') || '{}');
    Object.keys(kayitli).forEach(id => {
      oddsData[id] = {...(oddsData[id] || {}), ...kayitli[id]};
    });
    $('weekTitle').innerText = raw.week || 'Bu Hafta';
    hesaplaPR();
    renderBulten();
    renderSerbest();
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

/* ============ BÜLTEN (TOTO) ============ */
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

/* ============ SERBEST (İDDAA) ============ */
function openSerbestModal(){
  ['sm-match','sm-o1','sm-oX','sm-o2'].forEach(id => { const el = $(id); if(el) el.value = ''; });
  $('serbestModal').classList.add('active');
}

function serbestEkle(){
  const mac = $('sm-match').value.trim();
  const o1 = parseFloat($('sm-o1').value);
  const oX = parseFloat($('sm-oX').value);
  const o2 = parseFloat($('sm-o2').value);
  if(!mac){ showToast('error','Eksik','Maç adını gir.'); return; }
  if(!o1 || !oX || !o2){ showToast('error','Eksik','1/X/2 oranlarını gir.'); return; }
  serbestData.unshift({ id: Date.now(), mac: mac, o1: o1, oX: oX, o2: o2, tarih: new Date().toLocaleString('tr-TR') });
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
    return `
    <div class="tahmin-kart ${cls}" style="margin-bottom:10px">
      <div class="tk-head">
        <span>${ikon} İDDAA #${idx+1}</span>
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
        <div class="tk-item"><span class="lbl">Risk</span><span class="val">${tahmin.risk}</span></div>
      </div>
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
        <span>${tarih} · ${tip === 'toto' ? 'TOTO' : 'İDDAA'}</span>
        <span>${ikon} #${tip === 'toto' ? id : ''}${manuel ? ' <span style="color:var(--orange);font-size:.65rem">[M]</span>' : ''}</span>
      </div>
      <div class="tk-teams">${isim}</div>
      <div class="tk-ana"><div class="lbl">${karar}</div><div class="val">${ana}</div></div>
      <div class="tk-info">
        <div class="tk-item"><span class="lbl">Güven</span><span class="val">%${tahmin.guven}</span></div>
        <div class="tk-item"><span class="lbl">Risk</span><span class="val">${tahmin.risk}</span></div>
        <div class="tk-item"><span class="lbl">Olasılık</span><span class="val">%${analiz.enYuksek.olas.toFixed(0)}</span></div>
        <div class="tk-item"><span class="lbl">Fark</span><span class="val">%${tahmin.favori_farki}</span></div>
      </div>
      <div class="tk-alt"><b>Alt:</b> ${tahmin.alternatif} · <b>Sür:</b> ${tahmin.surpriz}</div>
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
    hepsi.push(man ? {...t, karar:'MANUEL '+man} : t);
  });
  serbestData.forEach(m => {
    const analiz = macAnalizEt(m.id, m.o1, m.oX, m.o2);
    if(!analiz) return;
    const t = tahminUret(analiz);
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
  
  $('macDetayTitle').innerText = '📊 ' + (tip === 'toto' ? 'MAÇ #' + id : 'İDDAA');
  $('macDetayBody').innerHTML = `
    <div style="font-size:.8rem;line-height:1.8">
      <div style="text-align:center;margin-bottom:14px">
        <div style="font-weight:900;font-size:1rem">${isim}</div>
        <div style="color:var(--muted);font-size:.7rem;margin-top:4px">${tarih}${league ? ' · '+league : ''}</div>
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
  $('tahminModalBody').innerHTML = `
    <div style="font-size:.8rem;line-height:1.8">
      <div style="background:var(--bg2);border-radius:10px;padding:12px;margin-bottom:12px">
        <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;text-align:center">
          <div><div style="color:var(--green);font-weight:900;font-size:1.2rem">${banko}</div><div style="color:var(--muted);font-size:.6rem">BANKO</div></div>
          <div><div style="color:var(--orange);font-weight:900;font-size:1.2rem">${cift}</div><div style="color:var(--muted);font-size:.6rem">ÇİFT</div></div>
          <div><div style="color:var(--red);font-weight:900;font-size:1.2rem">${uclu}</div><div style="color:var(--muted);font-size:.6rem">ÜÇLÜ</div></div>
          <div><div style="color:var(--blue);font-weight:900;font-size:1.2rem">%${ortG}</div><div style="color:var(--muted);font-size:.6rem">ORT. GÜVEN</div></div>
        </div>
      </div>
      ${hepsi.map(x => {
        const karar = x.manuel ? 'MANUEL ' + x.manuel : x.tahmin.karar;
        const ana = x.manuel || x.tahmin.ana_tahmin;
        const ikon = karar.includes('BANKO') ? '🔒' : karar.includes('ÇİFT') ? '⚠️' : karar.includes('ÜÇLÜ') ? '🔥' : '🎲';
        const renk = karar.includes('BANKO') ? 'green' : karar.includes('ÇİFT') ? 'orange' : karar.includes('ÜÇLÜ') ? 'red' : 'purple';
        return `<div style="background:var(--bg2);border-left:3px solid var(--${renk});border-radius:8px;padding:8px 10px;margin-bottom:6px">
          <div style="font-weight:800;font-size:.78rem">${ikon} ${x.tip === 'toto' ? '#' + x.m.id : ''} ${x.isim}</div>
          <div style="font-size:.7rem;color:var(--muted);margin-top:4px"><b style="color:var(--${renk})">${ana}</b> · ${karar} · Güven %${x.tahmin.guven} · Risk: ${x.tahmin.risk}</div>
        </div>`;
      }).join('')}
    </div>
  `;
  $('tahminModal').classList.add('active');
}

/* ============ KUPON ============ */
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
    const karar = m.karar, ana = m.ana;
    if(karar.includes('BANKO') || m.manuel){
      dagilim[key] = { [ana]: kolonSayisi };
    } else if(karar.includes('ÇİFT')){
      const anaOran = m.tahmin.guven / 100;
      const anaK = Math.max(1, Math.round(kolonSayisi * anaOran));
      const altK = kolonSayisi - anaK;
      let ikinci = '';
      const ks = karar.replace('ÇİFT ', '');
      if(ks === '1X') ikinci = ana === '1' ? 'X' : '1';
      else if(ks === 'X2') ikinci = ana === 'X' ? '2' : 'X';
      else if(ks === '12') ikinci = ana === '1' ? '2' : '1';
      else ikinci = ana === '1' ? 'X' : '2';
      dagilim[key] = { [ana]: anaK, [ikinci]: altK };
    } else {
      const pay = Math.floor(kolonSayisi / 3);
      const kalan = kolonSayisi - (pay * 3);
      dagilim[key] = { '1': pay + (kalan > 0 ? 1 : 0), 'X': pay + (kalan > 1 ? 1 : 0), '2': pay };
    }
  });
  
  const kolonlar = [];
  const gorulen = new Set();
  let deneme = 0;
  while(kolonlar.length < kolonSayisi && deneme < 5000){
    deneme++;
    const kolon = [];
    let oran = 1;
    kaynakMaçlar.forEach(m => {
      const key = m.tip + '-' + m.id;
      const d = dagilim[key];
      const sec = Object.keys(d);
      const top = sec.reduce((t,s) => t + d[s], 0);
      let secim = '';
      const r = Math.random();
      let kum = 0;
      for(const s of sec){ kum += d[s] / top; if(r < kum){ secim = s; break; } }
      if(!secim) secim = sec[0];
      kolon.push(secim);
      if(m.odds && m.odds[secim]) oran *= parseFloat(m.odds[secim]);
    });
    const key = kolon.join('-');
    if(!gorulen.has(key)){ gorulen.add(key); kolonlar.push({ picks: kolon, oran: oran }); }
  }
  
  const kaynakIsmi = { toto:'TOTO', iddaa:'İDDAA', karisik:'KARIŞIK' }[kuponKaynak];
  let html = `
    <div class="kupon-sonuc">
      <div class="baslik">⚡ ${kaynakIsmi} KUPONU (${kolonlar.length} Kolon)</div>
      <div style="background:var(--bg2);border-radius:10px;padding:12px;margin-bottom:14px">
        <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;font-size:.72rem">
          <div><b>Bütçe:</b> ${butce} TL</div>
          <div><b>Kolon:</b> ${kolonlar.length}</div>
          <div><b>Ort. Oran:</b> ${(kolonlar.reduce((t,k)=>t+k.oran,0)/kolonlar.length).toFixed(1)}</div>
        </div>
      </div>
      <div style="background:var(--bg2);border-radius:10px;padding:12px;margin-bottom:14px">
        <div style="font-weight:800;color:var(--green);font-size:.78rem;margin-bottom:8px">📋 MAÇ BAZLI DAĞILIM</div>
        ${kaynakMaçlar.map(m => {
          const key = m.tip + '-' + m.id;
          const d = dagilim[key];
          const str = Object.keys(d).sort().map(k => `<b>${k}</b>: ${d[k]}`).join(' · ');
          return `<div style="font-size:.72rem;padding:4px 0;border-bottom:1px solid var(--border)"><b>${m.tip === 'toto' ? '#'+m.id : 'İ'}</b> ${m.isim.slice(0,18)}: ${str}${m.manuel ? ' <span style="color:var(--orange);font-size:.6rem">[M]</span>' : ''}</div>`;
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
    </div>`;
  $('kuponSonuc').innerHTML = html;
  window.sonKolonlar = kolonlar;
  showToast('success', 'Kupon Hazır!', kolonlar.length + ' kolon oluşturuldu.');
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
