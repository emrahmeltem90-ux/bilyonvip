/* ============================================================
   SKORLAB v8 · TEMİZ SÜRÜM
   ============================================================ */

let matchesData = [];
let PR = [];
let oddsData = {};
let serbestData = JSON.parse(localStorage.getItem('skorlab_serbest') || '[]');
let cols = [];
let currentMode = 'guvenli';
let userPicks = {};
let savedCoupons = JSON.parse(localStorage.getItem('skorlab_coupons') || '[]');
let suggestMode = 'guvenli';
let archiveData = { weeks: [] };
let aktifMod = localStorage.getItem('skorlab_mod') || 'iddaa';

const $ = id => document.getElementById(id);
const pc = x => (x * 100).toFixed(1);
const ordr = i => [0,1,2].sort((a,b) => PR[i][b] - PR[i][a]);
const topP = i => Math.max(...PR[i]);

function setMod(mod){
  aktifMod = mod;
  localStorage.setItem('skorlab_mod', mod);
  const aciklama = $('modAciklama');
  if(aciklama){
    aciklama.innerHTML = mod === 'iddaa'
      ? '🎲 <b>İddaa Modu:</b> Sürpriz galibiyet arar.'
      : '⚽ <b>Toto Modu:</b> Banko ve çift şans ağırlıklı.';
  }
}

function sürprizHesapla(o1, oX, o2){
  const o = oranToOlasilik(parseFloat(o1), parseFloat(oX), parseFloat(o2));
  const p1 = o.p[0], pX = o.p[1], p2 = o.p[2];
  const favori = Math.max(p1, pX, p2);
  const ikinci = [p1, pX, p2].sort((a,b) => b-a)[1];
  const fark = favori - ikinci;
  const marj = parseFloat(o.marj);
  const xOran = parseFloat(oX);
  let puan = 0;
  let nedenler = [];
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

function sürprizSkoru(i){
  const od = oddsData[matchesData[i].id];
  if(!od || !od['1'] || !od['X'] || !od['2']) return { puan: 0, etiket: 'Bilinmiyor', renk: 'muted', nedenler: [] };
  return sürprizHesapla(od['1'], od['X'], od['2']);
}

function sürprizOneri(puan){
  if(puan <= 25) return 'Banko yazabilirsin.';
  if(puan <= 50) return 'Tek oyna ama dikkatli ol.';
  if(puan <= 75) return 'Çift şans yap (banko yazma).';
  return '🚨 Kaçın veya çift şans yap!';
}

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
  let p_tg01 = 0, p_tg23 = 0, p_tg45 = 0, p_tg6p = 0;
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
      if(toplam <= 1) p_tg01 += p;
      else if(toplam <= 3) p_tg23 += p;
      else if(toplam <= 5) p_tg45 += p;
      else p_tg6p += p;
      const key = h + '-' + a;
      skorlar[key] = (skorlar[key] || 0) + p;
    }
  }
  const enOlasi = Object.entries(skorlar).sort((a,b) => b[1] - a[1]).slice(0,3);
  return {
    kg: p_kg * 100, kgYok: (1 - p_kg) * 100,
    ust25: p_ust25 * 100, alt25: (1 - p_ust25) * 100,
    kgUst25: p_kg_ust25 * 100,
    tg01: p_tg01 * 100, tg23: p_tg23 * 100, tg45: p_tg45 * 100, tg6p: p_tg6p * 100,
    enOlasiSkor: enOlasi[0] ? enOlasi[0][0] : '1-1',
    enOlasiSkorP: enOlasi[0] ? (enOlasi[0][1]*100).toFixed(1) : '0'
  };
}

function degerVarMi(bahisAdi, gercekOran, bizimOlas){
  if(!gercekOran || gercekOran <= 1) return { var: false, fark: 0 };
  const bahisciOlas = 100 / gercekOran;
  const fark = bizimOlas - bahisciOlas;
  return { var: fark > 5, fark: fark.toFixed(1), bahisciOlas: bahisciOlas.toFixed(1), bizimOlas: bizimOlas.toFixed(1) };
}

function golAnalizHTML(ev05, ev15, dep05, dep15, kgVarOran, ust25Oran){
  let evGol = '', depGol = '', ev2Gol = '', dep2Gol = '';
  let evOlas = 0, depOlas = 0, ev2Olas = 0, dep2Olas = 0;
  if(ev05){ evOlas = 100 / parseFloat(ev05); evGol = evOlas >= 75 ? 'yesil' : evOlas >= 60 ? 'sari' : 'kirmizi'; }
  if(ev15){ ev2Olas = 100 / parseFloat(ev15); ev2Gol = ev2Olas >= 50 ? 'yesil' : ev2Olas >= 35 ? 'sari' : 'kirmizi'; }
  if(dep05){ depOlas = 100 / parseFloat(dep05); depGol = depOlas >= 75 ? 'yesil' : depOlas >= 60 ? 'sari' : 'kirmizi'; }
  if(dep15){ dep2Olas = 100 / parseFloat(dep15); dep2Gol = dep2Olas >= 50 ? 'yesil' : dep2Olas >= 35 ? 'sari' : 'kirmizi'; }
  if(!ev05 && !ev15 && !dep05 && !dep15) return '';
  let cikarimlar = [];
  if(ev05 && parseFloat(ev05) < 1.30) cikarimlar.push('Ev sahibi <b>gol atar</b> (büyük ihtimal)');
  if(ev05 && parseFloat(ev05) > 1.60) cikarimlar.push('Ev sahibi <b>gol atamayabilir</b>');
  if(dep05 && parseFloat(dep05) < 1.40) cikarimlar.push('Deplasman <b>gol atar</b> (büyük ihtimal)');
  if(dep05 && parseFloat(dep05) > 1.60) cikarimlar.push('Deplasman <b>gol atamayabilir</b>');
  if(ev15 && parseFloat(ev15) < 1.60) cikarimlar.push('Ev sahibi <b>2+ gol atar</b> muhtemel');
  if(dep15 && parseFloat(dep15) < 1.90) cikarimlar.push('Deplasman <b>2+ gol atar</b> muhtemel');
  if(ev05 && dep05){
    const evAtar = parseFloat(ev05) < 1.40;
    const depAtar = parseFloat(dep05) < 1.50;
    if(evAtar && depAtar) cikarimlar.push('🎯 <b>KG Var</b> güçlü muhtemel!');
    else if(!evAtar && !depAtar) cikarimlar.push('⚠️ <b>KG Yok</b> muhtemel');
  }
  if(ev15 && dep15){
    const ev2 = parseFloat(ev15) < 1.70;
    const dep2 = parseFloat(dep15) < 2.00;
    if(ev2 || dep2) cikarimlar.push('🎯 <b>2.5 Üst</b> muhtemel!');
    if(!ev2 && !dep2) cikarimlar.push('⚠️ <b>2.5 Alt</b> muhtemel');
  }
  return `
    <div class="gol-analiz">
      <div class="baslik">⚽ GOL ANALİZİ</div>
      ${ev05 ? `<div class="gol-row"><span>Ev 0.5 Üst (${ev05})</span><span class="${evGol}">%${evOlas.toFixed(0)} atar</span></div>` : ''}
      ${ev15 ? `<div class="gol-row"><span>Ev 1.5 Üst (${ev15})</span><span class="${ev2Gol}">%${ev2Olas.toFixed(0)} 2+ atar</span></div>` : ''}
      ${dep05 ? `<div class="gol-row"><span>Dep 0.5 Üst (${dep05})</span><span class="${depGol}">%${depOlas.toFixed(0)} atar</span></div>` : ''}
      ${dep15 ? `<div class="gol-row"><span>Dep 1.5 Üst (${dep15})</span><span class="${dep2Gol}">%${dep2Olas.toFixed(0)} 2+ atar</span></div>` : ''}
      ${cikarimlar.length ? `<div class="cikarim">💡 <b>ÇIKARIM:</b><br>${cikarimlar.join('<br>')}</div>` : ''}
    </div>`;
}

function ciftSansOnerisi(p1, pX, p2, mod){
  const o = oranToOlasilik(parseFloat(p1), parseFloat(pX), parseFloat(p2));
  const o1 = o.p[0], oX = o.p[1], o2 = o.p[2];
  const xOran = parseFloat(pX);
  const favori = o1 === Math.max(o1,oX,o2) ? '1' : oX === Math.max(o1,oX,o2) ? 'X' : '2';
  const favoriOlas = Math.max(o1, oX, o2);
  let onerilen = '', neden = '';
  if(mod === 'iddaa'){
    if(favoriOlas >= 65){
      onerilen = favori === '1' ? '1X' : favori === '2' ? 'X2' : '1X';
      neden = 'Favori güçlü, ' + onerilen + ' ile güvenli.';
    } else if(favoriOlas >= 50){
      onerilen = xOran < 3.5 ? '12' : (favori === '1' ? '1X' : 'X2');
      neden = xOran < 3.5 ? 'Beraberlik düşük, 12 mantıklı.' : 'Favori orta, beraberlik dahil et.';
    } else {
      onerilen = xOran < 3.5 ? '12' : 'X2';
      neden = 'Favori zayıf. Sürpriz galibiyet bekleniyor → ' + onerilen;
    }
  } else {
    if(favoriOlas >= 55){
      onerilen = favori === '1' ? '1X' : favori === '2' ? 'X2' : '1X';
      neden = 'Favori güçlü, banko + beraberlik.';
    } else if(favoriOlas >= 45){
      onerilen = favori === '1' ? '1X' : favori === '2' ? 'X2' : '1X';
      neden = 'Favori hafif, çift şans güvenli.';
    } else {
      onerilen = '1X';
      neden = 'Dengeli maç, beraberlik dahil et.';
    }
  }
  return `
    <div class="cift-sans">
      <div class="baslik">🎯 ÇİFT ŞANS ÖNERİSİ (${mod === 'iddaa' ? 'İddaa' : 'Toto'})</div>
      <div class="secenek"><span>1X (Ev veya beraberlik)</span><b>${onerilen === '1X' ? '⭐ ÖNERİLEN' : ''}</b></div>
      <div class="secenek"><span>12 (Beraberlik olmaz)</span><b>${onerilen === '12' ? '⭐ ÖNERİLEN' : ''}</b></div>
      <div class="secenek"><span>X2 (Beraberlik veya deplasman)</span><b>${onerilen === 'X2' ? '⭐ ÖNERİLEN' : ''}</b></div>
      <div class="onerilen">→ ${onerilen} ←</div>
      <div class="cikarim" style="margin-top:8px">💡 ${neden}</div>
    </div>`;
}

function surprizGalibiyetHTML(p1, pX, p2, mod){
  const o = oranToOlasilik(parseFloat(p1), parseFloat(pX), parseFloat(p2));
  const o1 = o.p[0], oX = o.p[1], o2 = o.p[2];
  const favori = o1 === Math.max(o1,oX,o2) ? '1' : oX === Math.max(o1,oX,o2) ? 'X' : '2';
  const favoriOlas = Math.max(o1, oX, o2);
  if(favoriOlas >= 55) return '';
  let mesaj = '';
  if(mod === 'iddaa'){
    if(favori === '1' && o2 > 30) mesaj = '⚠️ Deplasman sürprizi olabilir. Favori zayıf, <b>2</b> ihtimali yüksek.';
    else if(favori === '2' && o1 > 30) mesaj = '⚠️ Ev sahibi sürprizi olabilir. Favori zayıf, <b>1</b> ihtimali yüksek.';
    else if(favori === 'X') mesaj = '⚠️ Beraberlik favori. Taraf bahsi riskli.';
    else mesaj = '⚠️ Favori zayıf. Sürpriz galibiyet beklenebilir.';
  } else {
    mesaj = '⚠️ Toto modunda bu maça dikkat! Banko yazma, çift şans kullan.';
  }
  return `
    <div class="surpriz-gol">
      <div class="baslik">🚨 SÜRPRİZ GALİBİYET UYARISI</div>
      <div class="aciklama">${mesaj}</div>
    </div>`;
}

function neYapmaliyimHTML(p1, pX, p2, kg, u25, kgu){
  const o = oranToOlasilik(parseFloat(p1), parseFloat(pX), parseFloat(p2));
  const o1 = o.p[0], oX = o.p[1], o2 = o.p[2];
  const enYuksek = Math.max(o1, oX, o2);
  const favori = o1 === enYuksek ? '1' : oX === enYuksek ? 'X' : '2';
  const xg = xGTahmin(o1/100, oX/100, o2/100);
  const poi = poissonBahisler(xg.evXg, xg.depXg);
  const s = sürprizHesapla(p1, pX, p2);
  let oyna = [], oynama = [];
  const dv1 = degerVarMi('1', parseFloat(p1), o1);
  const dvX = degerVarMi('X', parseFloat(pX), oX);
  const dv2 = degerVarMi('2', parseFloat(p2), o2);
  if(dv1.var) oyna.push('1 (Ev Sahibi)');
  if(dvX.var) oyna.push('X (Beraberlik)');
  if(dv2.var) oyna.push('2 (Deplasman)');
  if(kg){
    const dv = degerVarMi('KG Var', parseFloat(kg), poi.kg);
    if(dv.var) oyna.push(`KG Var (${kg})`); else oynama.push(`KG Var (${kg})`);
  }
  if(u25){
    const dv = degerVarMi('2.5 Üst', parseFloat(u25), poi.ust25);
    if(dv.var) oyna.push(`2.5 Üst (${u25})`); else oynama.push(`2.5 Üst (${u25})`);
  }
  if(kgu){
    const dv = degerVarMi('KG+2.5Ü', parseFloat(kgu), poi.kgUst25);
    if(dv.var) oyna.push(`KG+2.5Ü (${kgu})`); else oynama.push(`KG+2.5Ü (${kgu})`);
  }
  let oneriCumle = '';
  if(s.puan > 75) oneriCumle = '🚨 Çok riskli! Banko yazma, çift şans yap.';
  else if(s.puan > 50) oneriCumle = '⚠️ Yüksek risk. Banko yazma, çift şans yap.';
  else if(s.puan > 25) oneriCumle = '⚡ Orta risk. Tek oyna ama dikkatli ol.';
  else oneriCumle = '✅ Güvenli. Banko yazabilirsin.';
  if(enYuksek >= 70 && s.puan <= 25) oneriCumle = `✅ Banko! Tek ${favori} oyna.`;
  else if(enYuksek >= 55 && enYuksek < 70 && s.puan <= 50) oneriCumle = `👍 Tek ${favori} + çift şans öner.`;
  else if(enYuksek < 45) oneriCumle = `⚠️ Çok dengeli. Çift şans yap, banko yazma.`;
  return `
    <div class="ne-yapmaliyim">
      <div class="baslik">🎯 NE YAPMALIYIM?</div>
      ${oyna.length ? `<div class="satir"><span class="oyna">✅ OYNA:</span> ${oyna.join(' · ')}</div>` : ''}
      ${oynama.length ? `<div class="satir"><span class="oynama">❌ OYNANMAZ:</span> ${oynama.join(' · ')}</div>` : ''}
      ${!oyna.length && !oynama.length ? '<div class="satir muted">Sadece 1/X/2 oynanabilir, değerli bahis yok.</div>' : ''}
      <div class="oneri">💡 ${oneriCumle}</div>
    </div>`;
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
    setMod(aktifMod);
    initApp();
    updateBar();
    renderStats();
    setMode('guvenli');
    renderOranlar();
    renderSürprizRadar();
    renderSerbest();
    say('🤖 <b>SkorLab v8 hazır!</b><br><br>Serbest analiz + sürpriz radarı + değer bahis. İyi şanslar!', 'bot');
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
    const hasOdds = od['1'] && od['X'] && od['2'];
    let surpriseHTML = '';
    if(hasOdds){
      const s = sürprizSkoru(i);
      if(s.puan > 75) surpriseHTML = '<span class="badge red" style="margin-left:6px">🚨 Çok Riskli</span>';
      else if(s.puan > 50) surpriseHTML = '<span class="badge orange" style="margin-left:6px">⚠️ Yüksek Risk</span>';
      else if(s.puan > 25) surpriseHTML = '<span class="badge yellow" style="margin-left:6px">⚡ Orta Risk</span>';
      else surpriseHTML = '<span class="badge green" style="margin-left:6px">✅ Güvenli</span>';
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
        <div class="odds-box ${degerVarMi('1',parseFloat(od['1']),PR[i][0]*100).var ? 'value' : ''}">
          <div class="lbl">1</div><div class="val">${parseFloat(od['1']).toFixed(2)}</div><div class="pct">%${(PR[i][0]*100).toFixed(1)}</div>
        </div>
        <div class="odds-box ${degerVarMi('X',parseFloat(od['X']),PR[i][1]*100).var ? 'value' : ''}">
          <div class="lbl">X</div><div class="val">${parseFloat(od['X']).toFixed(2)}</div><div class="pct">%${(PR[i][1]*100).toFixed(1)}</div>
        </div>
        <div class="odds-box ${degerVarMi('2',parseFloat(od['2']),PR[i][2]*100).var ? 'value' : ''}">
          <div class="lbl">2</div><div class="val">${parseFloat(od['2']).toFixed(2)}</div><div class="pct">%${(PR[i][2]*100).toFixed(1)}</div>
        </div>
      </div>` : '<div class="muted" style="font-size:.72rem;text-align:center;padding:8px">Oran gir → analiz gelsin</div>'}
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
      <button type="button" class="analiz-btn" onclick="analizEt(${m.id})">🔍 Analiz Et</button>
      <div id="analiz-cikti-${m.id}">${analizCikti}</div>
    </div>`;
  }).join('');
}

function analizHTML(i, od, poisson){
  if(!od || !od['1'] || !od['X'] || !od['2']) return '';
  const o = oranToOlasilik(parseFloat(od['1']), parseFloat(od['X']), parseFloat(od['2']));
  const o1 = o.p[0], oX = o.p[1], o2 = o.p[2];
  const xg = xGTahmin(o1/100, oX/100, o2/100);
  const poi = poissonBahisler(xg.evXg, xg.depXg);
  const enYuksek = Math.max(o1, oX, o2);
  const favori = o1 === enYuksek ? '1' : oX === enYuksek ? 'X' : '2';
  const sDetay = sürprizHesapla(od['1'], od['X'], od['2']);
  let sürprizDetayHTML = '';
  if(sDetay.puan > 0){
    sürprizDetayHTML = `
      <div class="sürpriz-alert">
        <div class="baslik">🚨 SÜRPRİZ SKORU: ${sDetay.puan}/100</div>
        <div style="color:var(--${sDetay.renk === 'yellow' ? 'orange' : sDetay.renk});font-weight:800;font-size:.8rem">${sDetay.etiket}</div>
        ${sDetay.nedenler.length ? `<div class="neden">${sDetay.nedenler.join(' · ')}</div>` : ''}
        <div class="oneri">💡 ${sürprizOneri(sDetay.puan)}</div>
      </div>`;
  }
  let valueHTML = '';
  if(od['KG_Var']){
    const dv = degerVarMi('KG Var', parseFloat(od['KG_Var']), poi.kg);
    if(dv.var) valueHTML += `<div class="value-bet-box">💎 <b>KG Var</b> değerli! Bizim: %${dv.bizimOlas} · Bahisçi: %${dv.bahisciOlas} · Fark: <b>+%${dv.fark}</b></div>`;
  }
  if(od['Ust_25']){
    const dv = degerVarMi('2.5 Üst', parseFloat(od['Ust_25']), poi.ust25);
    if(dv.var) valueHTML += `<div class="value-bet-box">💎 <b>2.5 Üst</b> değerli! Bizim: %${dv.bizimOlas} · Bahisçi: %${dv.bahisciOlas} · Fark: <b>+%${dv.fark}</b></div>`;
  }
  if(od['KG_Ust25']){
    const dv = degerVarMi('KG+2.5Ü', parseFloat(od['KG_Ust25']), poi.kgUst25);
    if(dv.var) valueHTML += `<div class="value-bet-box">💎 <b>KG+2.5Ü</b> değerli! Bizim: %${dv.bizimOlas} · Bahisçi: %${dv.bahisciOlas} · Fark: <b>+%${dv.fark}</b></div>`;
  }
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
    </div>
    ${sürprizDetayHTML}
    ${valueHTML}
    ${neYapmaliyimHTML(od['1'], od['X'], od['2'], od['KG_Var'], od['Ust_25'], od['KG_Ust25'])}
    ${ciftSansOnerisi(od['1'], od['X'], od['2'], aktifMod)}
    ${surprizGalibiyetHTML(od['1'], od['X'], od['2'], aktifMod)}
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
  renderSürprizRadar();
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
  renderSürprizRadar();
  showToast('success', 'Temizlendi!', 'Tüm oranlar silindi.');
}

function openSerbestModal(){
  ['sm-match','sm-o1','sm-oX','sm-o2','sm-kg','sm-u25','sm-kgu','sm-iy1','sm-iyX','sm-iy2','sm-ev05','sm-ev15','sm-dep05','sm-dep15'].forEach(id => {
    const el = $(id); if(el) el.value = '';
  });
  $('serbestModal').classList.add('active');
}

function toggleDetail(id){
  const el = $(id);
  if(el) el.classList.toggle('active');
}

function addSerbest(){
  const mac = $('sm-match').value.trim();
  const o1 = parseFloat($('sm-o1').value);
  const oX = parseFloat($('sm-oX').value);
  const o2 = parseFloat($('sm-o2').value);
  if(!mac){ showToast('error','Eksik','Maç adını gir.'); return; }
  if(!o1 || !oX || !o2){ showToast('error','Eksik','1/X/2 oranlarını gir.'); return; }
  const yeni = {
    id: Date.now(),
    mac: mac,
    o1: o1, oX: oX, o2: o2,
    kg: $('sm-kg').value ? parseFloat($('sm-kg').value) : null,
    u25: $('sm-u25').value ? parseFloat($('sm-u25').value) : null,
    kgu: $('sm-kgu').value ? parseFloat($('sm-kgu').value) : null,
    ev05: $('sm-ev05').value ? parseFloat($('sm-ev05').value) : null,
    ev15: $('sm-ev15').value ? parseFloat($('sm-ev15').value) : null,
    dep05: $('sm-dep05').value ? parseFloat($('sm-dep05').value) : null,
    dep15: $('sm-dep15').value ? parseFloat($('sm-dep15').value) : null,
    iy1: $('sm-iy1').value ? parseFloat($('sm-iy1').value) : null,
    iyX: $('sm-iyX').value ? parseFloat($('sm-iyX').value) : null,
    iy2: $('sm-iy2').value ? parseFloat($('sm-iy2').value) : null,
    tarih: new Date().toLocaleString('tr-TR')
  };
  serbestData.unshift(yeni);
  localStorage.setItem('skorlab_serbest', JSON.stringify(serbestData));
  closeModal('serbestModal');
  renderSerbest();
  showToast('success', 'Maç Eklendi!', `"${mac}" eklendi.`);
}

function renderSerbest(){
  const container = $('serbestListesi');
  if(!container) return;
  if(!serbestData.length){
    container.innerHTML = '<div class="serbest-empty">Henüz maç eklemedin.<br><br>📌 "➕ Maç Ekle" ile istediğin maçı ekle.</div>';
    return;
  }
  container.innerHTML = serbestData.map((m, idx) => {
    const o = oranToOlasilik(m.o1, m.oX, m.o2);
    const o1 = o.p[0], oX = o.p[1], o2 = o.p[2];
    const enYuksek = Math.max(o1, oX, o2);
    const favori = o1 === enYuksek ? '1' : oX === enYuksek ? 'X' : '2';
    const s = sürprizHesapla(m.o1, m.oX, m.o2);
    const renk = s.renk === 'yellow' ? 'orange' : s.renk;
    const xg = xGTahmin(o1/100, oX/100, o2/100);
    const poi = poissonBahisler(xg.evXg, xg.depXg);
    let ekBahislerHTML = '';
    if(m.kg){
      const dv = degerVarMi('KG Var', m.kg, poi.kg);
      ekBahislerHTML += `<div class="analiz-row"><span>KG Var (${m.kg})</span><span>Bizim: %${poi.kg.toFixed(1)} ${dv.var ? '<b class="green">💎 DEĞERLİ</b>' : (dv.fark > 0 ? '<b class="orange">+%'+dv.fark+'</b>' : '<span class="muted">-%'+Math.abs(dv.fark)+'</span>')}</span></div>`;
    }
    if(m.u25){
      const dv = degerVarMi('2.5 Üst', m.u25, poi.ust25);
      ekBahislerHTML += `<div class="analiz-row"><span>2.5 Üst (${m.u25})</span><span>Bizim: %${poi.ust25.toFixed(1)} ${dv.var ? '<b class="green">💎 DEĞERLİ</b>' : (dv.fark > 0 ? '<b class="orange">+%'+dv.fark+'</b>' : '<span class="muted">-%'+Math.abs(dv.fark)+'</span>')}</span></div>`;
    }
    if(m.kgu){
      const dv = degerVarMi('KG+2.5Ü', m.kgu, poi.kgUst25);
      ekBahislerHTML += `<div class="analiz-row"><span>KG+2.5Ü (${m.kgu})</span><span>Bizim: %${poi.kgUst25.toFixed(1)} ${dv.var ? '<b class="green">💎 DEĞERLİ</b>' : (dv.fark > 0 ? '<b class="orange">+%'+dv.fark+'</b>' : '<span class="muted">-%'+Math.abs(dv.fark)+'</span>')}</span></div>`;
    }
    return `
    <div class="serbest-card">
      <div class="head">
        <div class="title">⚽ ${m.mac}</div>
        <button class="delete-btn" onclick="deleteSerbest(${idx})">🗑️</button>
      </div>
      <div class="odds-bar">
        <div class="odds-box"><div class="lbl">1</div><div class="val">${m.o1.toFixed(2)}</div><div class="pct">%${o1.toFixed(1)}</div></div>
        <div class="odds-box"><div class="lbl">X</div><div class="val">${m.oX.toFixed(2)}</div><div class="pct">%${oX.toFixed(1)}</div></div>
        <div class="odds-box"><div class="lbl">2</div><div class="val">${m.o2.toFixed(2)}</div><div class="pct">%${o2.toFixed(1)}</div></div>
      </div>
      <div class="analiz-box">
        <div class="analiz-row"><span class="analiz-lbl">💡 Öneri</span></div>
        <div class="analiz-row"><span>Favori: <b class="orange">${favori}</b> (%${enYuksek.toFixed(1)})</span></div>
        <div class="analiz-row"><span class="muted">${enYuksek >= 70 ? 'Tek oyna (Banko)' : enYuksek >= 55 ? 'Tek + çift şans' : 'Çift şans öner'}</span></div>
      </div>
      <div class="sürpriz-alert" style="border-color:var(--${renk})">
        <div class="baslik" style="color:var(--${renk})">🚨 Sürpriz Skoru: ${s.puan}/100 · ${s.etiket}</div>
        ${s.nedenler.length ? `<div class="neden">${s.nedenler.join(' · ')}</div>` : ''}
        <div class="oneri">💡 ${sürprizOneri(s.puan)}</div>
      </div>
      ${ekBahislerHTML ? `<div class="analiz-box"><div class="analiz-row"><span class="analiz-lbl">🎯 Girdiğin Bahisler</span></div>${ekBahislerHTML}</div>` : ''}
      <div class="analiz-box">
        <div class="analiz-row"><span class="analiz-lbl">🎲 Poisson Tahmini</span></div>
        <div class="analiz-row"><span>2.5 Üst: <b>%${poi.ust25.toFixed(1)}</b></span><span>KG Var: <b>%${poi.kg.toFixed(1)}</b></span></div>
        <div class="analiz-row"><span>KG+2.5Ü: <b>%${poi.kgUst25.toFixed(1)}</b></span></div>
        <div class="analiz-row"><span class="muted">En olası skor: ${poi.enOlasiSkor} (%${poi.enOlasiSkorP})</span></div>
      </div>
      ${golAnalizHTML(m.ev05, m.ev15, m.dep05, m.dep15, m.kg, m.u25)}
      ${neYapmaliyimHTML(m.o1, m.oX, m.o2, m.kg, m.u25, m.kgu)}
      ${ciftSansOnerisi(m.o1, m.oX, m.o2, aktifMod)}
      ${surprizGalibiyetHTML(m.o1, m.oX, m.o2, aktifMod)}
      <div class="analiz-row muted" style="font-size:.65rem;margin-top:8px">📅 ${m.tarih}</div>
    </div>`;
  }).join('');
}

function deleteSerbest(idx){
  if(!confirm('Bu maçı silmek istediğine emin misin?')) return;
  serbestData.splice(idx, 1);
  localStorage.setItem('skorlab_serbest', JSON.stringify(serbestData));
  renderSerbest();
  showToast('success', 'Silindi', 'Maç silindi.');
}

function temizleSerbest(){
  if(!confirm('Tüm serbest maçları silmek istediğine emin misin?')) return;
  serbestData = [];
  localStorage.removeItem('skorlab_serbest');
  renderSerbest();
  showToast('success', 'Temizlendi', 'Tüm serbest maçlar silindi.');
}

function kuponSerbestModal(){
  if(!serbestData.length){
    showToast('error', 'Maç Yok', 'Önce maç ekle.');
    return;
  }
  const secim = prompt('Kaç maçlık kupon olsun? (2-' + Math.min(15, serbestData.length) + ' arası)', Math.min(5, serbestData.length));
  const n = parseInt(secim);
  if(!n || n < 2 || n > serbestData.length){
    showToast('error', 'Geçersiz', 'Geçerli bir sayı gir.');
    return;
  }
  const siralanmis = serbestData.map((m,idx) => ({
    ...m,
    s: sürprizHesapla(m.o1, m.oX, m.o2)
  })).sort((a,b) => a.s.puan - b.s.puan).slice(0, n);
  const kupon = {
    date: new Date().toLocaleDateString('tr-TR'),
    week: 'SERBEST KUPON',
    picks: {},
    totalMatches: n,
    serbest: true,
    maclar: siralanmis.map(m => {
      const maxOran = Math.max(m.o1, m.oX, m.o2);
      const fav = maxOran === m.o1 ? '1' : maxOran === m.oX ? 'X' : '2';
      return { mac: m.mac, favori: fav, oran: maxOran };
    })
  };
  savedCoupons.unshift(kupon);
  localStorage.setItem('skorlab_coupons', JSON.stringify(savedCoupons));
  renderCoupons();
  switchTab(5, document.querySelectorAll('.tab')[5]);
  showToast('success', 'Kupon Oluşturuldu!', `${n} maçlık serbest kupon oluşturuldu.`);
   }
/* ============ SÜRPRİZ RADARI ============ */
function renderSürprizRadar(){
  const container = $('sürprizRadar');
  if(!container) return;
  const siralanmis = matchesData.map((m,i) => ({
    idx: i, m,
    skor: sürprizSkoru(i)
  })).filter(x => x.skor.etiket !== 'Bilinmiyor')
    .sort((a,b) => b.skor.puan - a.skor.puan);
  if(!siralanmis.length){
    container.innerHTML = '<div class="coupon-empty">Oran gir → sürpriz radarı dolsun.</div>';
    return;
  }
  container.innerHTML = siralanmis.map(({idx, m, skor}) => {
    const bgRenk = skor.puan > 75 ? 'rgba(255,77,94,.1)' : skor.puan > 50 ? 'rgba(255,176,32,.1)' : skor.puan > 25 ? 'rgba(255,176,32,.05)' : 'rgba(0,224,122,.08)';
    const renk = skor.renk === 'yellow' ? 'orange' : skor.renk;
    return `
    <div class="match" style="background:${bgRenk}">
      <div class="match-head"><span>${m.date} · ${m.league}</span><span class="mid">#${m.id}</span></div>
      <div class="teams">${m.home} - ${m.away}</div>
      <div class="sürpriz-alert" style="border-color:var(--${renk})">
        <div class="baslik" style="color:var(--${renk})">${skor.etiket} · ${skor.puan}/100</div>
        ${skor.nedenler.length ? `<div class="neden">${skor.nedenler.join(' · ')}</div>` : ''}
        <div class="oneri">💡 ${sürprizOneri(skor.puan)}</div>
      </div>
    </div>`;
  }).join('');
}

/* ============ KUPON OLUŞTURMA (BÜLTEN) ============ */
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
    showToast('error', 'Eksik Oran', `Şu maçların 1/X/2 oranları eksik:<br><b>${eksik.join(', ')}</b>`);
    return;
  }
  openSuggestModal();
}

function selectSuggestMode(mode, el){
  suggestMode = mode;
  document.querySelectorAll('#suggestModal .mode').forEach(e => e.classList.remove('active'));
  el.classList.add('active');
  const infos = {
    guvenli: '🛡️ <b>Güvenli:</b> Sadece bankolar ve güçlü favoriler.',
    dengeli: '⚖️ <b>Dengeli:</b> Favoriler + orta maçlarda çift şans.',
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
  switchTab(5, document.querySelectorAll('.tab')[5]);
}

function analyzeCoupon(coupon){
  if(coupon.serbest){
    let p = 1;
    coupon.maclar.forEach(m => { p *= (100 / m.oran) / 100; });
    return { prob: p*100, count: coupon.maclar.length };
  }
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
    c.innerHTML = `<div class="coupon-empty">Henüz kupon yok.<br><br>📌 Oran veya Serbest sekmesinden kupon oluştur.</div>`;
    return;
  }
  c.innerHTML = '<div class="coupon-list">' + savedCoupons.map((coupon, idx) => {
    const a = analyzeCoupon(coupon);
    let html = '';
    if(coupon.serbest){
      coupon.maclar.forEach(m => {
        html += `<div><b>${m.mac}</b>: ${m.favori} (${m.oran.toFixed(2)})</div>`;
      });
    } else {
      for(let mIdx in coupon.picks){
        const m = matchesData[parseInt(mIdx)] || {home:'?',away:'?'};
        html += `<div><b>#${parseInt(mIdx)+1} ${m.home} - ${m.away}</b>: ${coupon.picks[mIdx].map(x => codeToSym(x)).join(', ')}</div>`;
      }
    }
    return `<div class="coupon-card">
      <div class="head">
        <span class="week">KUPON #${savedCoupons.length - idx} · ${coupon.date} ${coupon.serbest ? '⭐ SERBEST' : ''}</span>
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
    if(od['KG_Var'] && degerVarMi('KG Var',parseFloat(od['KG_Var']),poi.kg).var) valueCount++;
    if(od['Ust_25'] && degerVarMi('2.5 Üst',parseFloat(od['Ust_25']),poi.ust25).var) valueCount++;
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

function listSürpriz(){
  const s = matchesData.map((m,i) => [m,i,sürprizSkoru(i)]).filter(x => x[2].etiket !== 'Bilinmiyor').sort((a,b) => b[2].puan - a[2].puan);
  if(!s.length) return 'Sürpriz analizi yok (oran gir).';
  return `<b style="color:#ff4d5e">🚨 SÜRPRİZ RADARI:</b><br><br>` + s.slice(0,5).map(([m,i,sk]) => `#${m.id} ${m.home} - ${m.away}<br><b>Skor: ${sk.puan}/100</b> · ${sk.etiket}<br>💡 ${sürprizOneri(sk.puan)}`).join('<br><br>');
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
  const sk = sürprizSkoru(i);
  return `<b>📊 MAÇ #${m.id}: ${m.home} - ${m.away}</b><br>
    ${od['1'] ? `Oranlar: <b>${od['1']}</b> / <b>${od['X']}</b> / <b>${od['2']}</b><br>` : ''}
    Olasılık: 1: %${pc(p[0])} · X: %${pc(p[1])} · 2: %${pc(p[2])}<br>
    🎯 En olası: <b>${outName(m,o[0])}</b><br>
    ⚽ Poisson: 2.5Ü %${poi.ust25.toFixed(1)} · KG %${poi.kg.toFixed(1)}<br>
    ${sk.puan > 0 ? `🚨 Sürpriz Skoru: <b>${sk.puan}/100</b> · ${sk.etiket}<br>` : ''}
    💡 Öneri: ${topP(i) >= 0.7 ? 'Tek oyna.' : topP(i) >= 0.55 ? 'Tek + çift şans.' : 'Çift şans.'}`;
}

function reply(t){
  const q = t.toLocaleLowerCase('tr');
  if(/sürpriz|riskli/.test(q)) return listSürpriz();
  if(/banko/.test(q)) return listBanko();
  if(/zor|kolay|zorluk/.test(q)) return difficulty();
  if(/özet|bülten/.test(q)) return summary();
  const nm = q.match(/(?:maç\s*#?|#)\s*(\d+)/);
  if(nm){ const i = parseInt(nm[1]) - 1; if(matchesData[i]) return analyze(i); }
  const hits = matchesData.map((m,i) => i).filter(i => q.includes(matchesData[i].home.toLocaleLowerCase('tr')) || q.includes(matchesData[i].away.toLocaleLowerCase('tr')));
  if(hits.length) return hits.map(analyze).join('<br><br>');
  return '🤖 Sor:<br>• Bülten özeti<br>• Bankolar<br>• Sürpriz radarı<br>• Zorluk<br>• Maç 5';
}

function ask(t){ say(t,'usr'); setTimeout(() => say(reply(t),'bot'), 250); }
function send(){ const v = $('q').value.trim(); if(!v) return; $('q').value = ''; ask(v); }

function switchTab(i, el){
  document.querySelectorAll('.tab,.page').forEach(e => e.classList.remove('active'));
  el.classList.add('active');
  $('page-' + i).classList.add('active');
  if(i === 1) renderHeatmap();
  if(i === 3) renderOranlar();
  if(i === 4) renderSerbest();
  if(i === 6) renderKelly();
  if(i === 7) renderBacktest();
  if(i === 8) renderSürprizRadar();
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
  const text = '🎯 SkorLab - Akıllı Spor Toto Analiz\n\nOran okuma, Poisson, Değer Bahis, Kelly, Sürpriz Radarı, Serbest Analiz\n\n👉 https://emrahmeltem90-ux.github.io/bilyonvip';
  if(navigator.share){
    navigator.share({title:'SkorLab', text: text}).catch(() => {});
  } else {
    navigator.clipboard.writeText(text).then(() => showToast('success','Kopyalandı','Link kopyalandı.'));
  }
/* ============ EN İYİ BAHİS MOTORU ============ */
function enIyiBahisBul(m, poi, o, s){
  const o1 = o.p[0], oX = o.p[1], o2 = o.p[2];
  const favori = o1 === Math.max(o1,oX,o2) ? '1' : oX === Math.max(o1,oX,o2) ? 'X' : '2';
  const favoriOlas = Math.max(o1, oX, o2);
  
  let adaylar = [];
  
  // 1. Taraf bahisleri (1/X/2)
  if(m.o1 && favoriOlas >= 50 && s.puan <= 60){
    adaylar.push({
      bahis: favori,
      oran: favori === '1' ? m.o1 : favori === '2' ? m.o2 : m.oX,
      olas: favoriOlas,
      tip: 'taraf',
      neden: `Favori %${favoriOlas.toFixed(0)} · Sürpriz: ${s.puan}`
    });
  }
  
  // 2. KG Var
  if(m.kg){
    const dv = degerVarMi('KG Var', m.kg, poi.kg);
    if(poi.kg >= 55){
      adaylar.push({
        bahis: 'KG Var',
        oran: m.kg,
        olas: poi.kg,
        tip: 'kg',
        neden: `KG Var %${poi.kg.toFixed(0)}${dv.var ? ' · 💎 Değerli (+%' + dv.fark + ')' : ''}`
      });
    }
  }
  
  // 3. KG Yok
  if(m.kg){
    const dv = degerVarMi('KG Yok', m.kg, poi.kgYok);
    if(poi.kgYok >= 55){
      adaylar.push({
        bahis: 'KG Yok',
        oran: 1 / (100 / m.kg - 1) || null,
        olas: poi.kgYok,
        tip: 'kgyok',
        neden: `KG Yok %${poi.kgYok.toFixed(0)}`
      });
    }
  }
  
  // 4. 2.5 Üst
  if(m.u25){
    const dv = degerVarMi('2.5 Üst', m.u25, poi.ust25);
    if(poi.ust25 >= 55){
      adaylar.push({
        bahis: '2.5 Üst',
        oran: m.u25,
        olas: poi.ust25,
        tip: 'ust25',
        neden: `2.5 Üst %${poi.ust25.toFixed(0)}${dv.var ? ' · 💎 Değerli (+%' + dv.fark + ')' : ''}`
      });
    }
  }
  
  // 5. 1.5 Üst
  if(m.u15){
    const dv = degerVarMi('1.5 Üst', m.u15, poi.ust15);
    if(poi.ust15 >= 60){
      adaylar.push({
        bahis: '1.5 Üst',
        oran: m.u15,
        olas: poi.ust15,
        tip: 'ust15',
        neden: `1.5 Üst %${poi.ust15.toFixed(0)}${dv.var ? ' · 💎 Değerli (+%' + dv.fark + ')' : ''}`
      });
    }
  }
  
  // 6. 3.5 Üst
  if(m.u35){
    const dv = degerVarMi('3.5 Üst', m.u35, poi.ust35);
    if(poi.ust35 >= 45){
      adaylar.push({
        bahis: '3.5 Üst',
        oran: m.u35,
        olas: poi.ust35,
        tip: 'ust35',
        neden: `3.5 Üst %${poi.ust35.toFixed(0)}${dv.var ? ' · 💎 Değerli (+%' + dv.fark + ')' : ''}`
      });
    }
  }
  
  // 7. 4.5 Üst
  if(m.u45){
    const dv = degerVarMi('4.5 Üst', m.u45, poi.ust45);
    if(poi.ust45 >= 30){
      adaylar.push({
        bahis: '4.5 Üst',
        oran: m.u45,
        olas: poi.ust45,
        tip: 'ust45',
        neden: `4.5 Üst %${poi.ust45.toFixed(0)}${dv.var ? ' · 💎 Değerli (+%' + dv.fark + ')' : ''}`
      });
    }
  }
  
  // 8. KG+2.5Ü
  if(m.kgu){
    const dv = degerVarMi('KG+2.5Ü', m.kgu, poi.kgUst25);
    if(poi.kgUst25 >= 50){
      adaylar.push({
        bahis: 'KG+2.5Ü',
        oran: m.kgu,
        olas: poi.kgUst25,
        tip: 'kgu',
        neden: `KG+2.5Ü %${poi.kgUst25.toFixed(0)}${dv.var ? ' · 💎 Değerli (+%' + dv.fark + ')' : ''}`
      });
    }
  }
  
  // En iyi adayı seç (olasılık × oran — beklenen değer)
  if(!adaylar.length) return null;
  
  adaylar.forEach(a => {
    a.skor = (a.olas / 100) * a.oran;
  });
  adaylar.sort((a, b) => b.skor - a.skor);
  
  return adaylar[0];
}

function enIyiBahisHTML(m, poi, o, s){
  const en = enIyiBahisBul(m, poi, o, s);
  if(!en) return '';
  
  return `
    <div class="en-iyi-bahis">
      <div class="baslik">🎯 BU MAÇTA EN İYİ BAHİS</div>
      <div class="secim">
        <div class="bahis-adi">${en.bahis}</div>
        <div class="oran">Oran: ${en.oran ? parseFloat(en.oran).toFixed(2) : '—'} · İhtimal: %${en.olas.toFixed(0)}</div>
      </div>
      <div class="neden">💡 ${en.neden}</div>
    </div>`;
}

function tumBahislerHTML(m, poi, o){
  const o1 = o.p[0], oX = o.p[1], o2 = o.p[2];
  let satirlar = [];
  
  function ekle(ad, olas){
    const cls = olas >= 60 ? 'iyi' : olas >= 45 ? 'orta' : 'kotu';
    satirlar.push(`<div class="satir"><span>${ad}</span><span class="${cls}">%${olas.toFixed(0)}</span></div>`);
  }
  
  ekle('1 (Ev Sahibi)', o1);
  ekle('X (Beraberlik)', oX);
  ekle('2 (Deplasman)', o2);
  ekle('KG Var', poi.kg);
  ekle('KG Yok', poi.kgYok);
  ekle('1.5 Üst', poi.ust15);
  ekle('2.5 Üst', poi.ust25);
  ekle('3.5 Üst', poi.ust35);
  ekle('4.5 Üst', poi.ust45);
  ekle('KG+2.5Ü', poi.kgUst25);
  
  return `
    <div class="en-iyi-bahis">
      <div class="baslik">📊 TÜM BAHİSLERİN İHTİMALLERİ</div>
      <div class="alt-bahisler">${satirlar.join('')}</div>
    </div>`;
}


window.onload = function(){
  loadMatches();
  renderCoupons();
  if(localStorage.getItem('skorlab_legal') !== 'true'){
    setTimeout(() => openLegal(), 800);
  }
};
