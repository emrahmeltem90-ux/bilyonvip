/* ============================================================
   SKORLAB v3 · JAVASCRIPT MOTORU
   ============================================================ */

let matchesData = [];
let PR = [];
let oddsData = {};
let cols = [];
let currentMode = 'guvenli';
let userPicks = {};
let savedCoupons = JSON.parse(localStorage.getItem('skorlab_coupons') || '[]');
let suggestMode = 'guvenli';
let archiveData = { weeks: [] };

const $ = id => document.getElementById(id);
const pc = x => (x * 100).toFixed(1);
const ordr = i => [0,1,2].sort((a,b) => PR[i][b] - PR[i][a]);
const topP = i => Math.max(...PR[i]);

function oranToOlasilik(o1, oX, o2){
  const r1 = 1/o1, rX = 1/oX, r2 = 1/o2;
  const toplam = r1 + rX + r2;
  return {
    p: [(r1/toplam)*100, (rX/toplam)*100, (r2/toplam)*100],
    marj: ((toplam-1)*100).toFixed(2)
  };
}

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
  let p_kg = 0, p_ust25 = 0, p_kg_ust25 = 0;
  let p_ust15 = 0, p_ust35 = 0, p_ust45 = 0;
  let p_alt05 = 0, p_ust05 = 0;
  const skorlar = {};
  for(let h = 0; h <= MAX; h++){
    for(let a = 0; a <= MAX; a++){
      const ph = poissonPmf(h, evXg);
      const pa = poissonPmf(a, depXg);
      const p = ph * pa;
      const toplam = h + a;
      if(h >= 1 && a >= 1) p_kg += p;
      if(toplam > 2.5) p_ust25 += p;
      if(h >= 1 && a >= 1 && toplam > 2.5) p_kg_ust25 += p;
      if(toplam > 1.5) p_ust15 += p;
      if(toplam > 3.5) p_ust35 += p;
      if(toplam > 4.5) p_ust45 += p;
      if(toplam < 0.5) p_alt05 += p;
      if(toplam > 0.5) p_ust05 += p;
      const key = h + '-' + a;
      skorlar[key] = (skorlar[key] || 0) + p;
    }
  }
  const enOlasi = Object.entries(skorlar).sort((a,b) => b[1] - a[1]).slice(0,3);
  return {
    kg: p_kg * 100, kgYok: (1 - p_kg) * 100,
    ust25: p_ust25 * 100, alt25: (1 - p_ust25) * 100,
    kgUst25: p_kg_ust25 * 100,
    ust15: p_ust15 * 100, alt15: (1 - p_ust15) * 100,
    ust35: p_ust35 * 100, alt35: (1 - p_ust35) * 100,
    ust45: p_ust45 * 100, alt45: (1 - p_ust45) * 100,
    alt05: p_alt05 * 100, ust05: p_ust05 * 100,
    enOlasiSkor: enOlasi[0] ? enOlasi[0][0] : '1-1',
    enOlasiSkorP: enOlasi[0] ? (enOlasi[0][1]*100).toFixed(1) : '0'
  };
}

function degerVarMi(matchIdx, bahis, gercekOran, bizimOlas){
  if(!gercekOran || gercekOran <= 1) return { var: false, fark: 0 };
  const bahisciOlas = 100 / gercekOran;
  const fark = bizimOlas - bahisciOlas;
  return { var: fark > 5, fark: fark.toFixed(1), bahisciOlas: bahisciOlas.toFixed(1), bizimOlas: bizimOlas.toFixed(1) };
}

function kelly(olasilik, oran, frac = 0.5){
  const p = olasilik / 100;
  const b = oran - 1;
  if(b <= 0) return 0;
  const k = (b * p - (1 - p)) / b;
  return Math.max(0, k * frac);
}

async function loadMatches(){
  try{
    const res = await fetch('matches.json');
    const raw = await res.json();
    matchesData = (raw.matches || raw).map(m => ({
      id: m.id, home: m.home_team, away: m.away_team,
      date: (m.date || '') + ' ' + (m.time || ''),
      league: m.league || ''
    }));
    oddsData = JSON.parse(localStorage.getItem('skorlab_odds') || '{}');
    PR = matchesData.map((m,i) => {
      const od = oddsData[m.id];
      if(od && od['1'] && od['X'] && od['2']){
        const o = oranToOlasilik(parseFloat(od['1']), parseFloat(od['X']), parseFloat(od['2']));
        return o.p.map(x => x/100);
      }
      return [0.33, 0.33, 0.34];
    });
    $('weekTitle').innerText = raw.week || 'Bu Hafta';
    initApp();
    updateBar();
    renderStats();
    setMode('guvenli');
    renderOranlar();
    say('🤖 <b>SkorLab v3 hazır!</b><br><br>Oran sekmesinden oranları gir, "Analiz Et" butonuna bas. Sonra "Kupon Oluştur" ile kupon üret.', 'bot');
  }catch(e){
    document.body.innerHTML = '<div style="padding:20px;color:#ff4d5e">⚠️ matches.json yüklenemedi: ' + e.message + '</div>';
  }
  loadArchive();
  renderCoupons();
}

async function loadArchive(){
  try{
    const res = await fetch('archive.json');
    archiveData = await res.json();
  }catch(e){ archiveData = { weeks: [] }; }
  renderBacktest();
}

function level(i){
  const o = ordr(i), mx = PR[i][o[0]], gap = mx - PR[i][o[1]];
  return mx >= 0.7 ? 'Banko' : mx >= 0.55 ? 'Güçlü favori' : gap < 0.12 ? 'Çok dengeli' : 'Hafif favori';
}
function levelClass(i){
  const mx = topP(i);
  return mx >= 0.65 ? '' : mx >= 0.5 ? 'orange' : 'red';
}
function nCols(){
  const b = parseFloat($('budget').value) || 0;
  return Math.max(0, Math.min(500, Math.floor(b/10)));
}
function updateBar(){
  const n = nCols();
  $('lblCount').innerText = n;
  $('lblCost').innerText = (n*10) + ' TL';
}

function initApp(){
  $('matchesList').innerHTML = matchesData.map((m,i) => {
    const sel = userPicks[i] || [];
    const od = oddsData[m.id] || {};
    const mx = topP(i);
    const hasOdds = od['1'] && od['X'] && od['2'];
    let surpriseHTML = '';
    if(hasOdds){
      if(mx < 0.45) surpriseHTML = '<span class="badge red" style="margin-left:6px">⚠️ Sürpriz riski</span>';
      else if(mx < 0.55) surpriseHTML = '<span class="badge orange" style="margin-left:6px">⚠️ Dengeli</span>';
    }
    let valueHTML = '';
    if(hasOdds && od['KG_Var']){
      const xg = xGTahmin(PR[i][0], PR[i][1], PR[i][2]);
      const poi = poissonBahisler(xg.evXg, xg.depXg);
      const dv = degerVarMi(i, 'KG_Var', parseFloat(od['KG_Var']), poi.kg);
      if(dv.var) valueHTML = `<div class="value-bet-box" style="margin-top:8px">💎 KG Var değerli! Fark: +%${dv.fark}</div>`;
    }
    return `
    <div class="match">
      <div class="match-head"><span>${m.date}</span><span class="mid">MAÇ #${m.id}</span></div>
      <div class="teams">${m.home} <span class="muted" style="font-weight:400">-</span> ${m.away}
        <span class="badge ${levelClass(i)}">${level(i)}</span>
        ${m.league ? '<span class="league-tag">' + m.league + '</span>' : ''}
        ${surpriseHTML}
      </div>
      ${hasOdds ? `
      <div class="odds-bar">
        <div class="odds-box ${degerVarMi(i,'1',parseFloat(od['1']),PR[i][0]*100).var ? 'value' : ''}">
          <div class="lbl">1</div><div class="val">${parseFloat(od['1']).toFixed(2)}</div><div class="pct">%${(PR[i][0]*100).toFixed(1)}</div>
        </div>
        <div class="odds-box ${degerVarMi(i,'X',parseFloat(od['X']),PR[i][1]*100).var ? 'value' : ''}">
          <div class="lbl">X</div><div class="val">${parseFloat(od['X']).toFixed(2)}</div><div class="pct">%${(PR[i][1]*100).toFixed(1)}</div>
        </div>
        <div class="odds-box ${degerVarMi(i,'2',parseFloat(od['2']),PR[i][2]*100).var ? 'value' : ''}">
          <div class="lbl">2</div><div class="val">${parseFloat(od['2']).toFixed(2)}</div><div class="pct">%${(PR[i][2]*100).toFixed(1)}</div>
        </div>
      </div>` : '<div class="muted" style="font-size:.72rem;text-align:center;padding:8px">Oran gir → analiz gelsin</div>'}
      ${valueHTML}
      <div class="pick-grid">
        <div class="pick-btn ${sel.includes(0)?'active':''}" onclick="togglePick(${i},0)">1<span class="pick-pct">${hasOdds ? '%'+Math.round(PR[i][0]*100) : ''}</span></div>
        <div class="pick-btn ${sel.includes(1)?'active':''}" onclick="togglePick(${i},1)">X<span class="pick-pct">${hasOdds ? '%'+Math.round(PR[i][1]*100) : ''}</span></div>
        <div class="pick-btn ${sel.includes(2)?'active':''}" onclick="togglePick(${i},2)">2<span class="pick-pct">${hasOdds ? '%'+Math.round(PR[i][2]*100) : ''}</span></div>
        <div class="pick-btn ${sel.includes(10)?'active':''}" onclick="togglePick(${i},10)" style="font-size:.7rem">1X</div>
        <div class="pick-btn ${sel.includes(12)?'active':''}" onclick="togglePick(${i},12)" style="font-size:.7rem">12</div>
        <div class="pick-btn ${sel.includes(20)?'active':''}" onclick="togglePick(${i},20)" style="font-size:.7rem">X2</div>
      </div>
    </div>`;
  }).join('');
  updateSaveBar();
}

function togglePick(matchIdx, pickVal){
  if(!userPicks[matchIdx]) userPicks[matchIdx] = [];
  const idx = userPicks[matchIdx].indexOf(pickVal);
  if(idx > -1){ userPicks[matchIdx].splice(idx,1); }
  else {
    if(pickVal >= 10){ userPicks[matchIdx] = [pickVal]; }
    else {
      userPicks[matchIdx] = userPicks[matchIdx].filter(c => c >= 10);
      userPicks[matchIdx].push(pickVal);
    }
  }
  if(userPicks[matchIdx].length === 0) delete userPicks[matchIdx];
  initApp();
}

function clearPicks(){ userPicks = {}; initApp(); }

function updateSaveBar(){
  const count = Object.keys(userPicks).length;
  $('pickCount').innerText = count;
  let kolon = 1;
  Object.keys(userPicks).forEach(idx => {
    let choices = 0;
    userPicks[idx].forEach(c => {
      if(c === 0 || c === 1 || c === 2) choices += 1;
      else choices += 2;
    });
    kolon *= choices;
  });
  $('colCount').innerText = kolon.toLocaleString('tr');
  $('colPrice').innerText = (kolon*10).toLocaleString('tr') + ' TL';
  $('saveBar').style.display = count > 0 ? 'flex' : 'none';
}

function codeToSym(code){
  if(code === 0) return '1';
  if(code === 1) return 'X';
  if(code === 2) return '2';
  if(code === 10) return '1X';
  if(code === 12) return '12';
  if(code === 20) return 'X2';
  return code;
}

function codeToProb(matchIdx, code){
  const p = PR[matchIdx];
  if(code === 0) return p[0]*100;
  if(code === 1) return p[1]*100;
  if(code === 2) return p[2]*100;
  if(code === 10) return (p[0]+p[1])*100;
  if(code === 12) return (p[0]+p[2])*100;
  if(code === 20) return (p[1]+p[2])*100;
  return 0;
}

/* ============ ORAN SEKMESİ ============ */
function renderOranlar(){
  const container = $('oranListesi');
  if(!container) return;
  container.innerHTML = matchesData.map((m,i) => {
    const od = oddsData[m.id] || {};
    const hasAnaliz = od['1'] && od['X'] && od['2'];
    let analizCikti = '';
    if(hasAnaliz){
      const xg = xGTahmin(PR[i][0], PR[i][1], PR[i][2]);
      const poisson = poissonBahisler(xg.evXg, xg.depXg);
      analizCikti = analizHTML(i, od, poisson);
    } else {
      analizCikti = '<div class="analiz-info muted" style="font-size:.72rem;text-align:center;padding:10px">Oranları gir → Analiz Et butonuna bas</div>';
    }
    return `
    <div class="match" id="oran-${m.id}">
      <div class="match-head"><span>${m.date} · ${m.league}</span><span class="mid">#${m.id}</span></div>
      <div class="teams" style="margin-bottom:12px">${m.home} - ${m.away}</div>
      <div class="oran-grid">
        <div class="oran-item"><label>1</label><input type="number" step="0.01" placeholder="1.00" value="${od['1']||''}" oninput="oranGuncelle(${m.id},'1',this.value)"></div>
        <div class="oran-item"><label>X</label><input type="number" step="0.01" placeholder="1.00" value="${od['X']||''}" oninput="oranGuncelle(${m.id},'X',this.value)"></div>
        <div class="oran-item"><label>2</label><input type="number" step="0.01" placeholder="1.00" value="${od['2']||''}" oninput="oranGuncelle(${m.id},'2',this.value)"></div>
        <div class="oran-item"><label>KG Var</label><input type="number" step="0.01" placeholder="1.00" value="${od['KG_Var']||''}" oninput="oranGuncelle(${m.id},'KG_Var',this.value)"></div>
        <div class="oran-item"><label>2.5 Üst</label><input type="number" step="0.01" placeholder="1.00" value="${od['Ust_25']||''}" oninput="oranGuncelle(${m.id},'Ust_25',this.value)"></div>
        <div class="oran-item"><label>KG+2.5Ü</label><input type="number" step="0.01" placeholder="1.00" value="${od['KG_Ust25']||''}" oninput="oranGuncelle(${m.id},'KG_Ust25',this.value)"></div>
      </div>
      <button class="analiz-btn" onclick="analizEt(${m.id})" style="margin-top:10px;padding:10px;font-size:.82rem">🔍 Analiz Et</button>
      <div id="analiz-cikti-${m.id}">${analizCikti}</div>
    </div>`;
  }).join('');
}

function analizHTML(i, od, poisson){
  if(!od || !od['1'] || !od['X'] || !od['2']){
    return '<div class="analiz-info muted" style="font-size:.72rem;text-align:center;padding:10px">Oranları gir → analiz gelsin</div>';
  }
  const o = oranToOlasilik(parseFloat(od['1']), parseFloat(od['X']), parseFloat(od['2']));
  const o1 = o.p[0], oX = o.p[1], o2 = o.p[2];
  const xg = xGTahmin(o1/100, oX/100, o2/100);
  const poi = poissonBahisler(xg.evXg, xg.depXg);
  const enYuksek = Math.max(o1, oX, o2);
  const favori = o1 === enYuksek ? '1' : oX === enYuksek ? 'X' : '2';

  let valueHTML = '';
  if(od['KG_Var']){
    const dv = degerVarMi(i, 'KG_Var', parseFloat(od['KG_Var']), poi.kg);
    if(dv.var) valueHTML += `<div class="value-bet-box">💎 <b>KG Var</b> değerli! Bizim: %${dv.bizimOlas} · Bahisçi: %${dv.bahisciOlas} · Fark: <b>+%${dv.fark}</b></div>`;
  }
  if(od['Ust_25']){
    const dv = degerVarMi(i, 'Ust_25', parseFloat(od['Ust_25']), poi.ust25);
    if(dv.var) valueHTML += `<div class="value-bet-box">💎 <b>2.5 Üst</b> değerli! Bizim: %${dv.bizimOlas} · Bahisçi: %${dv.bahisciOlas} · Fark: <b>+%${dv.fark}</b></div>`;
  }
  if(od['KG_Ust25']){
    const dv = degerVarMi(i, 'KG_Ust25', parseFloat(od['KG_Ust25']), poi.kgUst25);
    if(dv.var) valueHTML += `<div class="value-bet-box">💎 <b>KG+2.5Ü</b> değerli! Bizim: %${dv.bizimOlas} · Bahisçi: %${dv.bahisciOlas} · Fark: <b>+%${dv.fark}</b></div>`;
  }

  let surpriseHTML = '';
  if(enYuksek < 0.45) surpriseHTML = '<div class="analiz-row"><span class="red">⚠️ Yüksek sürpriz riski! Banko yok.</span></div>';
  else if(enYuksek < 0.55) surpriseHTML = '<div class="analiz-row"><span class="orange">⚠️ Dengeli maç, sürprize açık</span></div>';

  return `
    <div class="analiz-box">
      <div class="analiz-row"><span class="analiz-lbl">📊 Olasılık (marj temizlenmiş)</span></div>
      <div class="analiz-row">
        <span>1: <b class="green">%${o1.toFixed(1)}</b></span>
        <span>X: <b class="green">%${oX.toFixed(1)}</b></span>
        <span>2: <b class="green">%${o2.toFixed(1)}</b></span>
      </div>
      <div class="analiz-row"><span class="muted">Marj: %${o.marj}</span></div>
    </div>
    <div class="analiz-box">
      <div class="analiz-row"><span class="analiz-lbl">🎲 Poisson Tahmini</span></div>
      <div class="analiz-row">
        <span>2.5 Üst: <b>%${poi.ust25.toFixed(1)}</b></span>
        <span>2.5 Alt: <b>%${poi.alt25.toFixed(1)}</b></span>
      </div>
      <div class="analiz-row">
        <span>KG Var: <b>%${poi.kg.toFixed(1)}</b></span>
        <span>KG Yok: <b>%${poi.kgYok.toFixed(1)}</b></span>
      </div>
      <div class="analiz-row"><span>KG+2.5Ü: <b>%${poi.kgUst25.toFixed(1)}</b></span></div>
      <div class="analiz-row"><span class="muted">En olası skor: ${poi.enOlasiSkor} (%${poi.enOlasiSkorP})</span></div>
    </div>
    <div class="analiz-box">
      <div class="analiz-row"><span class="analiz-lbl">💡 Öneri</span></div>
      <div class="analiz-row"><span>Favori: <b class="orange">${favori}</b> (%${enYuksek.toFixed(1)})</span></div>
      <div class="analiz-row"><span class="muted">${enYuksek >= 70 ? 'Tek oyna (Banko)' : enYuksek >= 55 ? 'Tek + çift şans' : 'Çift şans öner'}</span></div>
      ${surpriseHTML}
    </div>
    ${valueHTML}
  `;
}

function oranGuncelle(matchId, alan, deger){
  if(!oddsData[matchId]) oddsData[matchId] = {};
  if(deger === '' || deger === null) delete oddsData[matchId][alan];
  else oddsData[matchId][alan] = parseFloat(deger);
  localStorage.setItem('skorlab_odds', JSON.stringify(oddsData));
  const idx = matchesData.findIndex(m => m.id === matchId);
  const od = oddsData[matchId];
  if(od && od['1'] && od['X'] && od['2']){
    const o = oranToOlasilik(od['1'], od['X'], od['2']);
    PR[idx] = o.p.map(x => x/100);
  } else {
    PR[idx] = [0.33, 0.33, 0.34];
  }
}

function analizEt(matchId){
  const idx = matchesData.findIndex(m => m.id === matchId);
  const od = oddsData[matchId];
  if(!od || !od['1'] || !od['X'] || !od['2']){
    showToast('error', 'Eksik Oran', 'Lütfen en az 1, X, 2 oranlarını gir.');
    return;
  }
  const o = oranToOlasilik(parseFloat(od['1']), parseFloat(od['X']), parseFloat(od['2']));
  PR[idx] = o.p.map(x => x/100);
  const xg = xGTahmin(PR[idx][0], PR[idx][1], PR[idx][2]);
  const poisson = poissonBahisler(xg.evXg, xg.depXg);
  const cikti = $('analiz-cikti-' + matchId);
  if(cikti) cikti.innerHTML = analizHTML(idx, od, poisson);
  initApp();
  updateBar();
  renderStats();
  showToast('success', 'Analiz Hazır!', `#${matchId} ${matchesData[idx].home} - ${matchesData[idx].away} analiz edildi.`);
}

function indirJSON(){
  const cikti = {
    week: $('weekTitle').innerText,
    matches: matchesData.map(m => ({
      id: m.id, home_team: m.home, away_team: m.away,
      date: m.date.split(' ')[0], time: m.date.split(' ')[1] || '',
      league: m.league, odds: oddsData[m.id] || null
    }))
  };
  const blob = new Blob([JSON.stringify(cikti, null, 2)], {type:'application/json'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = 'matches-guncel.json'; a.click();
  URL.revokeObjectURL(url);
  showToast('success', 'İndirildi!', 'matches-guncel.json olarak indirildi.');
}

function temizleOranlar(){
  if(!confirm('Tüm oranları silmek istediğine emin misin?')) return;
  oddsData = {};
  localStorage.removeItem('skorlab_odds');
  PR = matchesData.map(() => [0.33, 0.33, 0.34]);
  renderOranlar();
  initApp();
  renderStats();
  showToast('success', 'Temizlendi!', 'Tüm oranlar silindi.');
}

function topColumns(n){
  const ord = matchesData.map((_,i) => ordr(i));
  const lp = s => s.reduce((t,r,i) => t + Math.log(Math.max(PR[i][ord[i][r]], 0.01)), 0);
  const st = ord.map(() => 0), seen = new Set([st.join('')]);
  const q = [[lp(st), st]], out = [];
  while(out.length < n && q.length){
    let b = 0;
    for(let i = 1; i < q.length; i++) if(q[i][0] > q[b][0]) b = i;
    const [sc, s] = q.splice(b,1)[0];
    out.push({ pick: s.map((r,i) => ord[i][r]), p: Math.exp(sc) });
    for(let i = 0; i < s.length; i++){
      if(s[i] < 2){
        const t = s.slice(); t[i]++;
        const k = t.join('');
        if(!seen.has(k)){ seen.add(k); q.push([lp(t), t]); }
      }
    }
  }
  return out;
}

function closedList(cl){
  const u = matchesData.map((_,i) => [...new Set(cl.map(c => c[i]))].sort());
  return { u, list: u.map((x,i) => [x,i]).filter(x => x[0].length > 1) };
}

function generate(){
  const n = nCols();
  if(n < 1){ alert('En az 10 TL gir.'); return; }
  const r = topColumns(n);
  cols = r.map(x => x.pick);
  const cov = r.reduce((t,x) => t + x.p, 0), single = r[0].p;
  const c = closedList(cols);
  $('outputCard').style.display = 'block';
  $('outputSummary').innerHTML = `<b style="color:var(--text);font-weight:900">${n*10} TL · ${n} KOLON</b><br><br>
    15/15 tutma: <b class="green">%${(cov*100).toFixed(3)}</b><br>
    Tek kolonla: %${(single*100).toFixed(3)}<br>
    Redüksiyon: <b class="green">${(cov/single).toFixed(1)}×</b> artış<br><br>
    <b style="color:var(--text);font-weight:900">KAPANAN MAÇLAR:</b><br>
    ${c.list.length ? c.list.map(([u,i]) => `#${i+1} ${matchesData[i].home} - ${matchesData[i].away}: <b style="color:var(--orange)">${u.map(o => codeToSym(o)).join('-')}</b>`).join('<br>') : 'Yok.'}
    <br><br><div id="mcOut">Simülasyon çalışıyor...<div class="progress"><div id="bar-a"></div></div></div>`;
  $('outputContainer').innerHTML = r.map((x,i) => `<div class="coupon"><b>KOLON #${String(i+1).padStart(2,'0')}</b> &nbsp;<span class="muted">%${(x.p*100).toFixed(3)}</span><br>
    <span style="letter-spacing:2px;font-size:.85rem">${x.pick.map((o,k) => `<span class="muted">${k+1}:</span><b>${codeToSym(o)}</b>`).join(' ')}</span></div>`).join('');
  $('outputCard').scrollIntoView({behavior:'smooth'});
  runMC('mcOut','bar-a');
}

function draw(p){ let r = Math.random(); for(let o = 0; o < 3; o++){ r -= p[o]; if(r < 0) return o; } return 2; }

function runMC(out, bar){
  const N = 10000, STEP = 1000, L = matchesData.length, hist = new Array(L+1).fill(0);
  let done = 0, sum = 0;
  $(bar).style.width = '0';
  (function chunk(){
    for(let s = 0; s < STEP; s++){
      const res = PR.map(draw);
      let best = 0;
      for(const c of cols){
        let k = 0;
        for(let i = 0; i < L; i++) if(c[i] === res[i]) k++;
        if(k > best) best = k;
      }
      hist[best]++; sum += best;
    }
    done += STEP;
    $(bar).style.width = (done/N*100) + '%';
    if(done < N) return setTimeout(chunk, 0);
    const mx = Math.max(...hist), tail = k => (hist.slice(k).reduce((a,b) => a+b, 0)/N*100).toFixed(2);
    $(out).innerHTML = `<b style="color:var(--text);font-weight:900">${N.toLocaleString('tr')} SİMÜLASYON</b><br><br>
      En iyi kolon ortalaması: <b class="green">${(sum/N).toFixed(2)} / ${L}</b><br><br>
      <b class="green">15/15: %${tail(L)}</b> | 14+: %${tail(L-1)}<br>
      13+: %${tail(L-2)} | 12+: %${tail(L-3)}<br><br>
      ${hist.map((_,k) => k).reverse().filter(k => hist[k] > 0).map(k => `<div class="hrow"><span>${k}/${L}</span><div><div class="hbar" style="width:${hist[k]/mx*100}%"></div></div><span>%${(hist[k]/N*100).toFixed(1)}</span></div>`).join('')}`;
    if($('runBtn')) $('runBtn').disabled = false;
  })();
}

function runLab(){
  if(!cols.length){ const n = Math.max(1, nCols()); cols = topColumns(n).map(x => x.pick); }
  $('runBtn').disabled = true;
  $('res-full').style.display = 'block';
  $('res-full').innerHTML = '';
  runMC('res-full','bar-full');
}

function openSuggestModal(){
  suggestMode = 'guvenli';
  document.querySelectorAll('#suggestModal .mode').forEach(e => e.classList.remove('active'));
  $('sm-guvenli').classList.add('active');
  $('suggestModeInfo').innerHTML = '🛡️ <b>Güvenli:</b> Sadece bankolar ve güçlü favoriler.';
  $('suggestBudget').value = 200;
  updateSuggestEstimate();
  $('suggestModal').classList.add('active');
}

function kuponOlusturModal(){
  let eksik = [];
  matchesData.forEach(m => {
    const od = oddsData[m.id];
    if(!od || !od['1'] || !od['X'] || !od['2']) eksik.push('#' + m.id);
  });
  if(eksik.length > 0){
    showToast('error', 'Eksik Oran', `Şu maçların 1/X/2 oranları eksik:<br><b>${eksik.join(', ')}</b><br><br>Lütfen tüm maçların oranlarını gir.`);
    return;
  }
  openSuggestModal();
}

function selectSuggestMode(mode, el){
  suggestMode = mode;
  document.querySelectorAll('#suggestModal .mode').forEach(e => e.classList.remove('active'));
  el.classList.add('active');
  const infos = {
    guvenli: '🛡️ <b>Güvenli:</b> Sadece bankolar ve güçlü favoriler. Hedef: 12/15.',
    dengeli: '⚖️ <b>Dengeli:</b> Favoriler + orta maçlarda çift şans. Hedef: 12-13/15.',
    agresif: '🚀 <b>Agresif:</b> Sürprizlere ağırlık verilir. Hedef: 14-15/15.'
  };
  $('suggestModeInfo').innerHTML = infos[mode];
  updateSuggestEstimate();
}

function updateSuggestEstimate(){
  const b = parseInt($('suggestBudget').value) || 0;
  $('suggestEstimate').innerText = `≈ ${b} TL · ${Math.floor(b/10)} kolon`;
}

function buildPicksForMode(mode){
  const tempPicks = {};
  matchesData.forEach((m,i) => {
    const p = PR[i], o = ordr(i), top = p[o[0]];
    let pickCode;
    if(mode === 'guvenli'){
      if(top >= 0.55) pickCode = o[0];
      else {
        const s = [o[0], o[1]].sort((a,b) => a-b);
        pickCode = s[0] === 0 && s[1] === 1 ? 10 : s[0] === 0 && s[1] === 2 ? 12 : 20;
      }
    } else if(mode === 'dengeli'){
      if(top >= 0.6) pickCode = o[0];
      else if(top >= 0.45){
        const s = [o[0], o[1]].sort((a,b) => a-b);
        pickCode = s[0] === 0 && s[1] === 1 ? 10 : s[0] === 0 && s[1] === 2 ? 12 : 20;
      } else pickCode = o[0];
    } else {
      if(top >= 0.65) pickCode = o[0];
      else {
        const s = [o[0], o[1]].sort((a,b) => a-b);
        pickCode = s[0] === 0 && s[1] === 1 ? 10 : s[0] === 0 && s[1] === 2 ? 12 : 20;
      }
    }
    tempPicks[i] = [pickCode];
  });
  return tempPicks;
}

function calculateKolon(picks){
  let k = 1;
  Object.keys(picks).forEach(idx => {
    let c = 0;
    picks[idx].forEach(x => { c += (x === 0 || x === 1 || x === 2) ? 1 : 2; });
    k *= c;
  });
  return k;
}

function optimizeForBudget(picks, maxKolon){
  const o = JSON.parse(JSON.stringify(picks));
  let cur = calculateKolon(o);
  const idxs = Object.keys(o).map(Number).sort((a,b) => topP(a) - topP(b));
  for(const mIdx of idxs){
    if(cur <= maxKolon) break;
    const p = o[mIdx];
    if(p.length === 1 && p[0] >= 10){
      let tek = 0;
      if(p[0] === 10) tek = PR[mIdx][0] > PR[mIdx][1] ? 0 : 1;
      else if(p[0] === 12) tek = PR[mIdx][0] > PR[mIdx][2] ? 0 : 2;
      else if(p[0] === 20) tek = PR[mIdx][1] > PR[mIdx][2] ? 1 : 2;
      o[mIdx] = [tek];
      cur = Math.floor(cur/2);
    }
  }
  return o;
}

function applySuggest(){
  const b = parseInt($('suggestBudget').value) || 0;
  if(!b || b < 10){ showToast('error','Geçersiz','En az 10 TL girin.'); return; }
  const maxK = Math.floor(b/10);
  let picks = buildPicksForMode(suggestMode);
  let k = calculateKolon(picks);
  if(k > maxK){ picks = optimizeForBudget(picks, maxK); k = calculateKolon(picks); }
  userPicks = picks;
  closeModal('suggestModal');
  initApp();
  const tutar = k * 10;
  showToast('success','Kupon Üretildi!', `
    <div class="row"><span>Mod:</span><span>${suggestMode}</span></div>
    <div class="row"><span>Kolon:</span><span>${k}</span></div>
    <div class="row"><span>Tutar:</span><span class="green">${tutar} TL</span></div>
    <div class="row"><span>Kalan:</span><span class="orange">${b - tutar} TL</span></div>
  `);
  switchTab(0, document.querySelectorAll('.tab')[0]);
  window.scrollTo({top:0,behavior:'smooth'});
}

function saveCoupon(){
  const keys = Object.keys(userPicks);
  if(keys.length === 0){ showToast('error','Maç Seçilmedi','En az bir maça tahmin yapın.'); return; }
  const coupon = {
    date: new Date().toLocaleDateString('tr-TR'),
    week: $('weekTitle').innerText,
    picks: {...userPicks},
    totalMatches: keys.length
  };
  savedCoupons.unshift(coupon);
  localStorage.setItem('skorlab_coupons', JSON.stringify(savedCoupons));
  userPicks = {};
  initApp();
  renderCoupons();
  switchTab(4, document.querySelectorAll('.tab')[4]);
}

function analyzeCoupon(coupon){
  let p = 1, count = 0;
  for(let mIdx in coupon.picks){
    let s = 0;
    coupon.picks[mIdx].forEach(c => { s += codeToProb(parseInt(mIdx), c)/100; });
    p *= Math.min(1, s);
    count++;
  }
  return { prob: p*100, count };
}

function renderCoupons(){
  const c = $('couponContent');
  if(!c) return;
  if(!savedCoupons.length){
    c.innerHTML = `<div class="coupon-empty">Henüz kupon yok.<br><br>📌 Oran sekmesinden kupon oluştur.</div>`;
    return;
  }
  c.innerHTML = '<div class="coupon-list">' + savedCoupons.map((coupon, idx) => {
    const a = analyzeCoupon(coupon);
    let html = '';
    for(let mIdx in coupon.picks){
      const m = matchesData[parseInt(mIdx)] || {home:'?',away:'?'};
      html += `<div><b>#${parseInt(mIdx)+1} ${m.home} - ${m.away}</b>: ${coupon.picks[mIdx].map(x => codeToSym(x)).join(', ')}</div>`;
    }
    return `<div class="coupon-card">
      <div class="head">
        <span class="week">KUPON #${savedCoupons.length - idx} · ${coupon.date}</span>
        <button onclick="deleteCoupon(${idx})" style="background:none;border:none;color:var(--red);cursor:pointer;font-size:.8rem;width:auto;padding:2px 6px">🗑️</button>
      </div>
      <div class="picks">${html}</div>
      <div style="margin-top:10px;font-size:.75rem;color:var(--green);font-weight:700">
        Tahmini Kazanma: %${a.prob.toFixed(2)} (${a.count} Maç)
      </div>
    </div>`;
  }).join('') + '</div>';
}

function deleteCoupon(idx){
  savedCoupons.splice(idx,1);
  localStorage.setItem('skorlab_coupons', JSON.stringify(savedCoupons));
  renderCoupons();
}

function renderKelly(){
  const bank = parseFloat($('kellyBank')?.value) || 0;
  const frac = parseFloat($('kellyFrac')?.value) || 0.5;
  if(!bank) return;
  let html = '<table class="kelly-table"><thead><tr><th>Maç</th><th>Seçim</th><th>Oran</th><th>Kelly %</th><th>Yatır</th></tr></thead><tbody>';
  matchesData.forEach((m,i) => {
    const o = ordr(i)[0];
    const od = oddsData[m.id];
    if(!od) return;
    const sym = codeToSym(o);
    const oran = od[sym];
    if(!oran) return;
    const olas = PR[i][o] * 100;
    const k = kelly(olas, parseFloat(oran), frac);
    const yatir = (bank * k).toFixed(0);
    const cls = k > 0.03 ? 'green' : 'muted';
    html += `<tr><td>#${m.id} ${m.home.slice(0,8)}</td><td><b>${sym}</b></td><td>${parseFloat(oran).toFixed(2)}</td><td class="${cls}">%${(k*100).toFixed(1)}</td><td class="${cls}">${yatir} TL</td></tr>`;
  });
  html += '</tbody></table>';
  $('kellyOutput').innerHTML = html;
}

function renderBacktest(){
  const c = $('backtestOutput');
  if(!c) return;
  if(!archiveData.weeks || !archiveData.weeks.length){
    c.innerHTML = '<div class="coupon-empty">Henüz geçmiş sonuç yok.</div>';
    return;
  }
  let html = '', totalCorrect = 0, totalMatches = 0;
  archiveData.weeks.forEach(w => {
    let correct = 0;
    w.results.forEach(r => {
      const idx = matchesData.findIndex(x => x.id === r.id);
      if(idx < 0) return;
      const o = ordr(idx)[0];
      if(codeToSym(o) === r.result) correct++;
      totalMatches++;
    });
    totalCorrect += correct;
    const acc = (correct / w.results.length * 100).toFixed(0);
    const cls = acc >= 70 ? 'good' : acc >= 50 ? 'mid' : 'bad';
    html += `<div class="backtest-row"><span class="week">${w.week}</span><span class="acc ${cls}">${correct}/${w.results.length} (%${acc})</span></div>`;
  });
  const genel = totalMatches ? (totalCorrect/totalMatches*100).toFixed(1) : 0;
  html += `<div class="backtest-row" style="border-top:2px solid var(--border);margin-top:10px;padding-top:14px"><span class="week"><b>GENEL</b></span><span class="acc good">%${genel}</span></div>`;
  c.innerHTML = html;
}

function renderHeatmap(){
  const hm = $('heatmap');
  if(!hm) return;
  hm.innerHTML = matchesData.map((m,i) => {
    const mx = topP(i), cls = mx >= 0.65 ? 'green' : mx >= 0.5 ? 'yellow' : 'red';
    return `<div class="hm ${cls}" onclick="ask('maç ${m.id}')">${m.id}</div>`;
  }).join('');
}

function setMode(mode, el){
  currentMode = mode;
  document.querySelectorAll('.mode').forEach(e => e.classList.remove('active'));
  if(el) el.classList.add('active');
  const info = {
    guvenli: '<b>🛡️ GÜVENLİ</b><br>%70+ bankolar ve %55+ favoriler. Hedef: 12/15.',
    dengeli: '<b>⚖️ DENGELİ</b><br>Favoriler + hafif sürprizler. Hedef: 12-13/15.',
    agresif: '<b>🚀 AGRESİF</b><br>Sürprizlere ağırlık. Hedef: 14-15/15.'
  };
  const el2 = $('modeInfo');
  if(el2) el2.innerHTML = info[mode];
}

function renderStats(){
  const statBanko = $('statBanko');
  if(!statBanko) return;
  const banko = matchesData.filter((_,i) => topP(i) >= 0.7).length;
  const dengeli = matchesData.filter((_,i) => topP(i) < 0.5).length;
  let valueCount = 0;
  matchesData.forEach((m,i) => {
    const od = oddsData[m.id];
    if(!od) return;
    const xg = xGTahmin(PR[i][0], PR[i][1], PR[i][2]);
    const poi = poissonBahisler(xg.evXg, xg.depXg);
    if(od['KG_Var'] && degerVarMi(i,'KG_Var',parseFloat(od['KG_Var']),poi.kg).var) valueCount++;
    if(od['Ust_25'] && degerVarMi(i,'Ust_25',parseFloat(od['Ust_25']),poi.ust25).var) valueCount++;
  });
  const zorluk = banko >= 5 ? 'Kolay' : dengeli >= 6 ? 'Zor' : 'Orta';
  statBanko.innerText = banko;
  const sD = $('statDengeli'); if(sD) sD.innerText = dengeli;
  const sV = $('statValue'); if(sV) sV.innerText = valueCount;
  const sZ = $('statZorluk'); if(sZ) sZ.innerText = zorluk;
}

function say(html, who){
  const chat = $('chat');
  if(!chat) return;
  const d = document.createElement('div');
  d.className = 'b ' + who;
  d.innerHTML = html;
  chat.appendChild(d);
  d.scrollIntoView({block:'end',behavior:'smooth'});
}
function outName(m,o){ return o === 0 ? m.home + ' (1)' : o === 1 ? 'Beraberlik (X)' : m.away + ' (2)'; }

function summary(){
  const L = matchesData.length;
  const banko = matchesData.filter((_,i) => topP(i) >= 0.7).length;
  const dengeli = matchesData.filter((_,i) => topP(i) < 0.5).length;
  const exp = PR.reduce((t,_,i) => t + topP(i), 0);
  return `<b>📊 BÜLTEN ÖZETİ (${L} MAÇ)</b><br><br>
    🏦 Banko: <b>${banko}</b><br>
    ⚠️ Dengeli: <b>${dengeli}</b><br>
    🎯 Beklenen doğru: <b>${exp.toFixed(1)}/${L}</b><br><br>
    💡 ${dengeli >= 6 ? '<b style="color:#ff4d5e">Zor bülten.</b>' : dengeli >= 3 ? '<b style="color:#ffb020">Orta zorluk.</b>' : '<b style="color:#00e07a">Kolay bülten.</b>'}`;
}

function listBanko(){
  const b = matchesData.map((m,i) => [m,i]).filter(x => topP(x[1]) >= 0.7);
  if(!b.length) return 'Banko yok (oranları girmemiş olabilirsin).';
  return `<b style="color:#00e07a">🏦 BANKOLAR:</b><br>` + b.map(([m,i]) => `#${m.id} ${m.home} - ${m.away}: <b>${outName(m,ordr(i)[0])}</b> %${pc(topP(i))}`).join('<br>');
}

function listRisk(){
  const r = matchesData.map((m,i) => [m,i]).filter(x => topP(x[1]) < 0.5);
  if(!r.length) return 'Riskli maç yok.';
  return `<b style="color:#ff4d5e">⚠️ RİSKLİ MAÇLAR:</b><br>` + r.map(([m,i]) => `#${m.id} ${m.home} - ${m.away}: %${pc(topP(i))}`).join('<br>');
}

function difficulty(){
  const dengeli = matchesData.filter((_,i) => topP(i) < 0.5).length;
  const banko = matchesData.filter((_,i) => topP(i) >= 0.7).length;
  let s, r;
  if(banko >= 5){ s = 'KOLAY'; r = '#00e07a'; }
  else if(banko >= 2 && dengeli <= 5){ s = 'ORTA'; r = '#ffb020'; }
  else { s = 'ZOR'; r = '#ff4d5e'; }
  return `<b>📅 HAFTA ZORLUK</b><br><br>Seviye: <b style="color:${r};font-size:1.3rem">${s}</b><br>Banko: <b>${banko}</b> · Dengeli: <b>${dengeli}</b>`;
}

function analyze(i){
  const m = matchesData[i], p = PR[i], o = ordr(i);
  const od = oddsData[m.id] || {};
  const xg = xGTahmin(p[0], p[1], p[2]);
  const poi = poissonBahisler(xg.evXg, xg.depXg);
  return `<b>📊 MAÇ #${m.id}: ${m.home} - ${m.away}</b><br>
    ${od['1'] ? `Oranlar: <b>${od['1']}</b> / <b>${od['X']}</b> / <b>${od['2']}</b><br>` : ''}
    Olasılık: 1: %${pc(p[0])} · X: %${pc(p[1])} · 2: %${pc(p[2])}<br>
    🎯 En olası: <b>${outName(m,o[0])}</b><br>
    ⚽ Poisson: 2.5Ü %${poi.ust25.toFixed(1)} · KG %${poi.kg.toFixed(1)} · KG+2.5Ü %${poi.kgUst25.toFixed(1)}<br>
    💡 Öneri: ${topP(i) >= 0.7 ? 'Tek oyna.' : topP(i) >= 0.55 ? 'Tek + çift şans.' : 'Çift şans.'}`;
}

function reply(t){
  const q = t.toLocaleLowerCase('tr');
  if(/banko/.test(q)) return listBanko();
  if(/risk/.test(q)) return listRisk();
  if(/zor|kolay|zorluk/.test(q)) return difficulty();
  if(/özet|bülten/.test(q)) return summary();
  const nm = q.match(/(?:maç\s*#?|#)\s*(\d+)/);
  if(nm){ const i = parseInt(nm[1]) - 1; if(matchesData[i]) return analyze(i); }
  const hits = matchesData.map((m,i) => i).filter(i => q.includes(matchesData[i].home.toLocaleLowerCase('tr')) || q.includes(matchesData[i].away.toLocaleLowerCase('tr')));
  if(hits.length) return hits.map(analyze).join('<br><br>');
  return '🤖 Sor:<br>• Bülten özeti<br>• Bankolar<br>• Riskli maçlar<br>• Zorluk<br>• Maç 5';
}

function ask(t){ say(t,'usr'); setTimeout(() => say(reply(t),'bot'), 250); }
function send(){ const v = $('q').value.trim(); if(!v) return; $('q').value = ''; ask(v); }

function switchTab(i, el){
  document.querySelectorAll('.tab,.page').forEach(e => e.classList.remove('active'));
  el.classList.add('active');
  $('page-' + i).classList.add('active');
  if(i === 3) renderOranlar();
  if(i === 5) renderKelly();
  if(i === 1) renderHeatmap();
  if(i === 6) renderBacktest();
  window.scrollTo({top:0,behavior:'smooth'});
}

function openModal(id){ $(id).classList.add('active'); }
function closeModal(id){ $(id).classList.remove('active'); }
function openLegal(){ openModal('legalModal'); localStorage.setItem('skorlab_legal', 'true'); }

function showToast(type, title, msg){
  $('toastIcon').innerText = type === 'success' ? '✅' : '❌';
  $('toastTitle').innerText = title;
  $('toastTitle').className = 'toast-title' + (type === 'error' ? ' error' : '');
  $('toastMsg').innerHTML = msg;
  openModal('toastModal');
}

function shareApp(){
  const text = '🎯 SkorLab - Akıllı Spor Toto Analiz\n\nOran okuma, Poisson, Değer Bahis, Kelly\n\n👉 https://emrahmeltem90-ux.github.io/bilyonvip';
  if(navigator.share){
    navigator.share({title:'SkorLab', text: text}).catch(() => {});
  } else {
    navigator.clipboard.writeText(text).then(() => showToast('success','Kopyalandı','Link kopyalandı.'));
  }
}

window.onload = function(){
  loadMatches();
  renderCoupons();
  if(localStorage.getItem('skorlab_legal') !== 'true'){
    setTimeout(() => openLegal(), 800);
  }
};
