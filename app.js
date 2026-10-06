/* ============================================================
   SKORLAB v2 · JAVASCRIPT MOTORU
   Oran okuma · Marj temizleme · Değer bahis · Monte Carlo · Kelly · Backtest
   ============================================================ */

let matchesData = [];
let PR = [];
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

/* ============ ORAN → OLASILIK (MARJ TEMİZLEME) ============ */
function oranToOlasilik(o1, oX, o2){
  const r1 = 1/o1, rX = 1/oX, r2 = 1/o2;
  const toplam = r1 + rX + r2;
  return {
    p: [(r1/toplam)*100, (rX/toplam)*100, (r2/toplam)*100],
    marj: ((toplam-1)*100).toFixed(2)
  };
}

/* ============ DEĞER BAHİS KONTROLÜ ============ */
function degerVarMi(matchIdx, sonuc){
  const m = matchesData[matchIdx];
  if(!m.odds) return { var: false, fark: 0 };
  const oran = m.odds[sonuc];
  const bahisciOlas = 100 / oran;
  const bizimOlas = PR[matchIdx][sonuc === '1' ? 0 : sonuc === 'X' ? 1 : 2] * 100;
  const fark = bizimOlas - bahisciOlas;
  return { var: fark > 5, fark: fark.toFixed(1) };
}

/* ============ MAÇ VERİSİ YÜKLE ============ */
async function loadMatches(){
  try{
    const res = await fetch('matches.json');
    const raw = await res.json();
    const list = raw.matches || raw;
    matchesData = list.map(m => {
      let olas;
      if(m.odds){
        olas = oranToOlasilik(m.odds['1'], m.odds['X'], m.odds['2']);
      } else {
        olas = { p: [33.3, 33.3, 33.3], marj: '0' };
      }
      return {
        id: m.id,
        home: m.home_team,
        away: m.away_team,
        date: (m.date || '') + ' ' + (m.time || ''),
        odds: m.odds || null,
        p: olas.p,
        marj: olas.marj,
        league: m.league || '',
        form: m.form || ''
      };
    });
    PR = matchesData.map(m => m.p.map(x => x/100));
    $('weekTitle').innerText = raw.week || 'Bu Hafta';
    initApp();
    updateBar();
    renderHeatmap();
    setMode('guvenli');
    renderStats();
    renderKelly();
    say('🤖 <b>Merhaba, ben Bankobot.</b><br><br>Oranları gerçek olasılığa çeviriyorum, bahisçi marjını temizliyorum, değer bahis arıyorum.<br><br>' + summary(), 'bot');
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
  }catch(e){
    archiveData = { weeks: [] };
  }
  renderBacktest();
}

/* ============ SEVİYE / İSTATİSTİK ============ */
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

function renderStats(){
  const banko = matchesData.filter((_,i) => topP(i) >= 0.7).length;
  const dengeli = matchesData.filter((_,i) => topP(i) < 0.5).length;
  let valueCount = 0;
  matchesData.forEach((m,i) => {
    ['1','X','2'].forEach(s => {
      if(degerVarMi(i,s).var) valueCount++;
    });
  });
  const zorluk = banko >= 5 ? 'Kolay' : dengeli >= 6 ? 'Zor' : 'Orta';
  $('statBanko').innerText = banko;
  $('statDengeli').innerText = dengeli;
  $('statValue').innerText = valueCount;
  $('statZorluk').innerText = zorluk;
}

/* ============ MAÇ KARTLARI ============ */
function initApp(){
  $('matchesList').innerHTML = matchesData.map((m,i) => {
    const sel = userPicks[i] || [];
    const o = ordr(i);
    let valueInfo = '';
    ['1','X','2'].forEach(s => {
      const v = degerVarMi(i, s);
      if(v.var){
        valueInfo += `<div class="value-bet-box">💎 <b>${s}</b> değerli bahis! Fark: <b>+%${v.fark}</b> (oran ${m.odds[s]})</div>`;
      }
    });
    return `
    <div class="match">
      <div class="match-head">
        <span>${m.date}</span>
        <span class="mid">MAÇ #${m.id}</span>
      </div>
      <div class="teams">
        ${m.home} <span class="muted" style="font-weight:400">-</span> ${m.away}
        <span class="badge ${levelClass(i)}">${level(i)}</span>
        ${m.league ? '<span class="league-tag">' + m.league + '</span>' : ''}
      </div>
      <div class="odds-bar">
        <div class="odds-box ${degerVarMi(i,'1').var ? 'value' : ''}">
          <div class="lbl">1</div>
          <div class="val">${m.odds ? m.odds['1'].toFixed(2) : '-'}</div>
          <div class="pct">%${m.p[0].toFixed(1)}</div>
        </div>
        <div class="odds-box ${degerVarMi(i,'X').var ? 'value' : ''}">
          <div class="lbl">X</div>
          <div class="val">${m.odds ? m.odds['X'].toFixed(2) : '-'}</div>
          <div class="pct">%${m.p[1].toFixed(1)}</div>
        </div>
        <div class="odds-box ${degerVarMi(i,'2').var ? 'value' : ''}">
          <div class="lbl">2</div>
          <div class="val">${m.odds ? m.odds['2'].toFixed(2) : '-'}</div>
          <div class="pct">%${m.p[2].toFixed(1)}</div>
        </div>
      </div>
      ${valueInfo}
      <div class="pick-grid">
        <div class="pick-btn ${sel.includes(0)?'active':''}" onclick="togglePick(${i},0)">1<span class="pick-pct">%${m.p[0].toFixed(0)}</span><span class="pick-odd">${m.odds ? m.odds['1'].toFixed(2) : ''}</span></div>
        <div class="pick-btn ${sel.includes(1)?'active':''}" onclick="togglePick(${i},1)">X<span class="pick-pct">%${m.p[1].toFixed(0)}</span><span class="pick-odd">${m.odds ? m.odds['X'].toFixed(2) : ''}</span></div>
        <div class="pick-btn ${sel.includes(2)?'active':''}" onclick="togglePick(${i},2)">2<span class="pick-pct">%${m.p[2].toFixed(0)}</span><span class="pick-odd">${m.odds ? m.odds['2'].toFixed(2) : ''}</span></div>
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
  if(idx > -1){
    userPicks[matchIdx].splice(idx,1);
  } else {
    if(pickVal >= 10){
      userPicks[matchIdx] = [pickVal];
    } else {
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
  const m = matchesData[matchIdx];
  if(code === 0) return m.p[0];
  if(code === 1) return m.p[1];
  if(code === 2) return m.p[2];
  if(code === 10) return m.p[0] + m.p[1];
  if(code === 12) return m.p[0] + m.p[2];
  if(code === 20) return m.p[1] + m.p[2];
  return 0;
}

/* ============ KUPON OLUŞTURMA ============ */
function topColumns(n){
  const ord = matchesData.map((_,i) => ordr(i));
  const lp = s => s.reduce((t,r,i) => t + Math.log(PR[i][ord[i][r]]), 0);
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

/* ============ MONTE CARLO ============ */
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

/* ============ BANA KUPON ÖNER ============ */
function openSuggestModal(){
  suggestMode = 'guvenli';
  document.querySelectorAll('#suggestModal .mode').forEach(e => e.classList.remove('active'));
  $('sm-guvenli').classList.add('active');
  $('suggestModeInfo').innerHTML = '🛡️ <b>Güvenli:</b> En yüksek olasılıklı seçenekler.';
  $('suggestBudget').value = 200;
  updateSuggestEstimate();
  $('suggestModal').classList.add('active');
}

function selectSuggestMode(mode, el){
  suggestMode = mode;
  document.querySelectorAll('#suggestModal .mode').forEach(e => e.classList.remove('active'));
  el.classList.add('active');
  const infos = {
    guvenli: '🛡️ <b>Güvenli:</b> En yüksek olasılıklı seçenekler.',
    dengeli: '⚖️ <b>Dengeli:</b> Favoriler tek, orta maçlar çift şans.',
    agresif: '🚀 <b>Agresif:</b> Sürprizlere ağırlık verilir.'
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
  window.scrollTo({top:0,behavior:'smooth'});
}

/* ============ KUPON KAYDET ============ */
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
  switchTab(3, document.querySelectorAll('.tab')[3]);
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
  if(!savedCoupons.length){
    c.innerHTML = `<div class="coupon-empty">Henüz kupon yok.<br><br>📌 Bülten sekmesinden seçim yap.</div>`;
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

/* ============ KELLY ============ */
function renderKelly(){
  const bank = parseFloat($('kellyBank').value) || 0;
  const frac = parseFloat($('kellyFrac').value) || 0.5;
  let html = '<table class="kelly-table"><thead><tr><th>Maç</th><th>Seçim</th><th>Oran</th><th>Kelly %</th><th>Öneri</th></tr></thead><tbody>';
  matchesData.forEach((m,i) => {
    const o = ordr(i)[0];
    const oran = m.odds ? m.odds[codeToSym(o) === 'X' ? 'X' : codeToSym(o)] : 0;
    const p = PR[i][o];
    if(!oran) return;
    const b = oran - 1;
    const kelly = (b * p - (1-p)) / b;
    const kellyFinal = Math.max(0, kelly * frac);
    const yatir = (bank * kellyFinal).toFixed(0);
    const cls = kellyFinal > 0.05 ? 'green' : 'muted';
    html += `<tr>
      <td>#${m.id} ${m.home.slice(0,8)}</td>
      <td><b>${codeToSym(o)}</b></td>
      <td>${oran.toFixed(2)}</td>
      <td class="${cls}">%${(kellyFinal*100).toFixed(1)}</td>
      <td class="${cls}">${yatir} TL</td>
    </tr>`;
  });
  html += '</tbody></table>';
  $('kellyOutput').innerHTML = html;
}

/* ============ BACKTEST ============ */
function renderBacktest(){
  const c = $('backtestOutput');
  if(!archiveData.weeks || !archiveData.weeks.length){
    c.innerHTML = '<div class="coupon-empty">Henüz geçmiş sonuç yok.<br><br>archive.json dosyasına sonuçları ekleyin.</div>';
    return;
  }
  let html = '';
  let totalCorrect = 0, totalMatches = 0;
  archiveData.weeks.forEach(w => {
    let correct = 0;
    w.results.forEach(r => {
      const m = matchesData.find(x => x.id === r.id);
      if(!m) return;
      const o = ordr(matchesData.indexOf(m))[0];
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

/* ============ ISI HARİTASI ============ */
function renderHeatmap(){
  $('heatmap').innerHTML = matchesData.map((m,i) => {
    const mx = topP(i), cls = mx >= 0.65 ? 'green' : mx >= 0.5 ? 'yellow' : 'red';
    return `<div class="hm ${cls}" onclick="ask('maç ${m.id}')">${m.id}</div>`;
  }).join('');
}

/* ============ MOD ============ */
function setMode(mode, el){
  currentMode = mode;
  document.querySelectorAll('.mode').forEach(e => e.classList.remove('active'));
  if(el) el.classList.add('active');
  const info = {
    guvenli: '<b>🛡️ GÜVENLİ</b><br>%70+ bankolar ve %55+ favoriler. Hedef: 12/15.',
    dengeli: '<b>⚖️ DENGELİ</b><br>Favoriler + hafif sürprizler. Hedef: 12-13/15.',
    agresif: '<b>🚀 AGRESİF</b><br>Sürprizlere ağırlık. Hedef: 14-15/15.'
  };
  $('modeInfo').innerHTML = info[mode];
}

/* ============ BANKOBOT ============ */
function say(html, who){
  const d = document.createElement('div');
  d.className = 'b ' + who;
  d.innerHTML = html;
  $('chat').appendChild(d);
  d.scrollIntoView({block:'end',behavior:'smooth'});
}
function outName(m,o){ return o === 0 ? m.home + ' (1)' : o === 1 ? 'Beraberlik (X)' : m.away + ' (2)'; }

function summary(){
  const L = matchesData.length;
  const banko = matchesData.filter((_,i) => topP(i) >= 0.7).length;
  const guclu = matchesData.filter((_,i) => topP(i) >= 0.55 && topP(i) < 0.7).length;
  const dengeli = matchesData.filter((_,i) => topP(i) < 0.45).length;
  const exp = PR.reduce((t,_,i) => t + topP(i), 0);
  return `<b>📊 BÜLTEN ÖZETİ (${L} MAÇ)</b><br><br>
    🏦 Banko: <b>${banko}</b><br>
    ⭐ Güçlü: <b>${guclu}</b><br>
    ⚠️ Dengeli: <b>${dengeli}</b><br>
    🎯 Beklenen doğru: <b>${exp.toFixed(1)}/${L}</b><br><br>
    💡 ${dengeli >= 6 ? '<b style="color:#ff4d5e">Zor bülten.</b>' : dengeli >= 3 ? '<b style="color:#ffb020">Orta zorluk.</b>' : '<b style="color:#00e07a">Kolay bülten.</b>'}`;
}

function listBanko(){
  const b = matchesData.map((m,i) => [m,i]).filter(x => topP(x[1]) >= 0.7);
  if(!b.length) return 'Banko yok.';
  return `<b style="color:#00e07a">🏦 BANKOLAR:</b><br>` + b.map(([m,i]) => `#${m.id} ${m.home} - ${m.away}: <b>${outName(m,ordr(i)[0])}</b> %${pc(topP(i))}`).join('<br>');
}

function listValue(){
  let html = '<b style="color:#a855f7">💎 DEĞERLİ BAHİSLER:</b><br><br>';
  let found = false;
  matchesData.forEach((m,i) => {
    ['1','X','2'].forEach(s => {
      const v = degerVarMi(i,s);
      if(v.var){
        found = true;
        html += `#${m.id} ${m.home}-${m.away}: <b>${s}</b> (oran ${m.odds[s]}, fark +%${v.fark})<br>`;
      }
    });
  });
  return found ? html : 'Değerli bahis bulunamadı.';
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
  return `<b>📊 MAÇ #${m.id}: ${m.home} - ${m.away}</b><br>
    ${m.odds ? `Oranlar: <b>${m.odds['1']}</b> / <b>${m.odds['X']}</b> / <b>${m.odds['2']}</b> (marj %${m.marj})<br>` : ''}
    Olasılık: 1: %${pc(p[0])} · X: %${pc(p[1])} · 2: %${pc(p[2])}<br>
    🎯 En olası: <b>${outName(m,o[0])}</b><br>
    💡 Öneri: ${topP(i) >= 0.7 ? 'Tek oyna.' : topP(i) >= 0.55 ? 'Tek + çift şans.' : 'Çift şans.'}`;
}

function reply(t){
  const q = t.toLocaleLowerCase('tr');
  if(/değerli|value|💎/.test(q)) return listValue();
  if(/banko/.test(q)) return listBanko();
  if(/risk/.test(q)) return listRisk();
  if(/zor|kolay|zorluk/.test(q)) return difficulty();
  if(/özet|bülten/.test(q)) return summary();
  const nm = q.match(/(?:maç\s*#?|#)\s*(\d+)/);
  if(nm){ const i = parseInt(nm[1]) - 1; if(matchesData[i]) return analyze(i); }
  const hits = matchesData.map((m,i) => i).filter(i => q.includes(matchesData[i].home.toLocaleLowerCase('tr')) || q.includes(matchesData[i].away.toLocaleLowerCase('tr')));
  if(hits.length) return hits.map(analyze).join('<br><br>');
  return '🤖 Sor:<br>• Bülten özeti<br>• Değerli bahisler<br>• Bankolar<br>• Riskli maçlar<br>• Zorluk<br>• Maç 5';
}

function ask(t){ say(t,'usr'); setTimeout(() => say(reply(t),'bot'), 250); }
function send(){ const v = $('q').value.trim(); if(!v) return; $('q').value = ''; ask(v); }

/* ============ YARDIMCI ============ */
function switchTab(i, el){
  document.querySelectorAll('.tab,.page').forEach(e => e.classList.remove('active'));
  el.classList.add('active');
  $('page-' + i).classList.add('active');
  window.scrollTo({top:0,behavior:'smooth'});
}

function openModal(id){ $(id).classList.add('active'); }
function closeModal(id){ $(id).classList.remove('active'); }
function openLegal(){ openModal('legalModal'); }

function showToast(type, title, msg){
  $('toastIcon').innerText = type === 'success' ? '✅' : '❌';
  $('toastTitle').innerText = title;
  $('toastTitle').className = 'toast-title' + (type === 'error' ? ' error' : '');
  $('toastMsg').innerHTML = msg;
  openModal('toastModal');
}

function shareApp(){
  const text = '🎯 SkorLab - Akıllı Spor Toto Analiz\n\nOran okuma, Monte Carlo, Değer Bahis, Kelly\n\n👉 https://emrahmeltem90-ux.github.io/bilyonvip';
  if(navigator.share){
    navigator.share({title:'SkorLab', text: text}).catch(() => {});
  } else {
    navigator.clipboard.writeText(text).then(() => showToast('success','Kopyalandı','Link kopyalandı.'));
  }
}

/* ============ BAŞLAT ============ */
window.onload = function(){
  loadMatches();
  renderCoupons();
  if(localStorage.getItem('skorlab_legal') !== 'true'){
    setTimeout(() => openLegal(), 800);
  }
};
