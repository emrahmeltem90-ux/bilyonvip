/* ============================================================
   SKORLAB v10 · ORAN=TOTO, SERBEST=İDDAA
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
  let p_kg = 0, p_u15 = 0, p_u25 = 0, p_u35 = 0, p_u45 = 0, p_kgu = 0;
  const skorlar = {};
  for(let h = 0; h <= MAX; h++){
    for(let a = 0; a <= MAX; a++){
      const ph = poissonPmf(h, evXg);
      const pa = poissonPmf(a, depXg);
      const p = ph * pa;
      const toplam = h + a;
      if(h >= 1 && a >= 1) p_kg += p;
      if(toplam > 1.5) p_u15 += p;
      if(toplam > 2.5) p_u25 += p;
      if(toplam > 3.5) p_u35 += p;
      if(toplam > 4.5) p_u45 += p;
      if(h >= 1 && a >= 1 && toplam > 2.5) p_kgu += p;
      const key = h + '-' + a;
      skorlar[key] = (skorlar[key] || 0) + p;
    }
  }
  const enOlasi = Object.entries(skorlar).sort((a,b) => b[1] - a[1]).slice(0,3);
  return {
    kg: p_kg * 100, kgYok: (1 - p_kg) * 100,
    ust15: p_u15 * 100, alt15: (1 - p_u15) * 100,
    ust25: p_u25 * 100, alt25: (1 - p_u25) * 100,
    ust35: p_u35 * 100, alt35: (1 - p_u35) * 100,
    ust45: p_u45 * 100, alt45: (1 - p_u45) * 100,
    kgUst25: p_kgu * 100,
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

/* ============ EN İYİ BAHİS MOTORU ============ */
function enIyiBahisBul(m, poi, o, s){
  const o1 = o.p[0], oX = o.p[1], o2 = o.p[2];
  const favori = o1 === Math.max(o1,oX,o2) ? '1' : oX === Math.max(o1,oX,o2) ? 'X' : '2';
  const favoriOlas = Math.max(o1, oX, o2);
  let adaylar = [];
  if(m.o1 && favoriOlas >= 50 && s.puan <= 60){
    adaylar.push({bahis: favori, oran: favori === '1' ? m.o1 : favori === '2' ? m.o2 : m.oX, olas: favoriOlas, tip: 'taraf', neden: `Favori %${favoriOlas.toFixed(0)} · Sürpriz: ${s.puan}`});
  }
  if(m.kg && poi.kg >= 55){
    const dv = degerVarMi('KG Var', m.kg, poi.kg);
    adaylar.push({bahis: 'KG Var', oran: m.kg, olas: poi.kg, tip: 'kg', neden: `KG Var %${poi.kg.toFixed(0)}${dv.var ? ' · 💎 Değerli (+%' + dv.fark + ')' : ''}`});
  }
  if(m.u25 && poi.ust25 >= 55){
    const dv = degerVarMi('2.5 Üst', m.u25, poi.ust25);
    adaylar.push({bahis: '2.5 Üst', oran: m.u25, olas: poi.ust25, tip: 'ust25', neden: `2.5 Üst %${poi.ust25.toFixed(0)}${dv.var ? ' · 💎 Değerli (+%' + dv.fark + ')' : ''}`});
  }
  if(m.u15 && poi.ust15 >= 60){
    const dv = degerVarMi('1.5 Üst', m.u15, poi.ust15);
    adaylar.push({bahis: '1.5 Üst', oran: m.u15, olas: poi.ust15, tip: 'ust15', neden: `1.5 Üst %${poi.ust15.toFixed(0)}${dv.var ? ' · 💎 Değerli (+%' + dv.fark + ')' : ''}`});
  }
  if(m.u35 && poi.ust35 >= 45){
    const dv = degerVarMi('3.5 Üst', m.u35, poi.ust35);
    adaylar.push({bahis: '3.5 Üst', oran: m.u35, olas: poi.ust35, tip: 'ust35', neden: `3.5 Üst %${poi.ust35.toFixed(0)}${dv.var ? ' · 💎 Değerli (+%' + dv.fark + ')' : ''}`});
  }
  if(m.u45 && poi.ust45 >= 30){
    const dv = degerVarMi('4.5 Üst', m.u45, poi.ust45);
    adaylar.push({bahis: '4.5 Üst', oran: m.u45, olas: poi.ust45, tip: 'ust45', neden: `4.5 Üst %${poi.ust45.toFixed(0)}${dv.var ? ' · 💎 Değerli (+%' + dv.fark + ')' : ''}`});
  }
  if(m.kgu && poi.kgUst25 >= 50){
    const dv = degerVarMi('KG+2.5Ü', m.kgu, poi.kgUst25);
    adaylar.push({bahis: 'KG+2.5Ü', oran: m.kgu, olas: poi.kgUst25, tip: 'kgu', neden: `KG+2.5Ü %${poi.kgUst25.toFixed(0)}${dv.var ? ' · 💎 Değerli (+%' + dv.fark + ')' : ''}`});
  }
  if(!adaylar.length) return null;
  adaylar.forEach(a => { a.skor = (a.olas / 100) * parseFloat(a.oran || 1); });
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
        <div class="oran">Oran: ${parseFloat(en.oran).toFixed(2)} · İhtimal: %${en.olas.toFixed(0)}</div>
      </div>
      <div class="neden">💡 ${en.neden}</div>
    </div>`;
}

function tumBahislerHTML(poi, o){
  const o1 = o.p[0], oX = o.p[1], o2 = o.p[2];
  let satirlar = [];
  function ekle(ad, olas){
    const cls = olas >= 60 ? 'iyi' : olas >= 45 ? 'orta' : 'kotu';
    satirlar.push(`<div class="satir"><span>${ad}</span><span class="${cls}">%${olas.toFixed(0)}</span></div>`);
  }
  ekle('1 (Ev)', o1);
  ekle('X (Beraberlik)', oX);
  ekle('2 (Dep)', o2);
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

function golAnalizHTML(ev05, ev15, dep05, dep15){
  let evGol = '', depGol = '', ev2Gol = '', dep2Gol = '';
  let evOlas = 0, depOlas = 0, ev2Olas = 0, dep2Olas = 0;
  if(ev05){ evOlas = 100 / parseFloat(ev05); evGol = evOlas >= 75 ? 'yesil' : evOlas >= 60 ? 'sari' : 'kirmizi'; }
  if(ev15){ ev2Olas = 100 / parseFloat(ev15); ev2Gol = ev2Olas >= 50 ? 'yesil' : ev2Olas >= 35 ? 'sari' : 'kirmizi'; }
  if(dep05){ depOlas = 100 / parseFloat(dep05); depGol = depOlas >= 75 ? 'yesil' : depOlas >= 60 ? 'sari' : 'kirmizi'; }
  if(dep15){ dep2Olas = 100 / parseFloat(dep15); dep2Gol = dep2Olas >= 50 ? 'yesil' : dep2Olas >= 35 ? 'sari' : 'kirmizi'; }
  if(!ev05 && !ev15 && !dep05 && !dep15) return '';
  let cikarimlar = [];
  if(ev05 && parseFloat(ev05) < 1.30) cikarimlar.push('Ev sahibi <b>gol atar</b>');
  if(ev05 && parseFloat(ev05) > 1.60) cikarimlar.push('Ev sahibi <b>gol atamayabilir</b>');
  if(dep05 && parseFloat(dep05) < 1.40) cikarimlar.push('Deplasman <b>gol atar</b>');
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

function neYapmaliyimHTML(m, poi, o, s){
  const o1 = o.p[0], oX = o.p[1], o2 = o.p[2];
  const enYuksek = Math.max(o1, oX, o2);
  const favori = o1 === enYuksek ? '1' : oX === enYuksek ? 'X' : '2';
  let oyna = [], oynama = [];
  if(m.o1){
    const dv1 = degerVarMi('1', m.o1, o1);
    const dvX = degerVarMi('X', m.oX, oX);
    const dv2 = degerVarMi('2', m.o2, o2);
    if(dv1.var) oyna.push('1');
    if(dvX.var) oyna.push('X');
    if(dv2.var) oyna.push('2');
  }
  if(m.kg){
    const dv = degerVarMi('KG Var', m.kg, poi.kg);
    if(dv.var) oyna.push(`KG Var (${m.kg})`); else oynama.push(`KG Var (${m.kg})`);
  }
  if(m.u15){
    const dv = degerVarMi('1.5 Üst', m.u15, poi.ust15);
    if(dv.var) oyna.push(`1.5 Üst (${m.u15})`); else oynama.push(`1.5 Üst (${m.u15})`);
  }
  if(m.u25){
    const dv = degerVarMi('2.5 Üst', m.u25, poi.ust25);
    if(dv.var) oyna.push(`2.5 Üst (${m.u25})`); else oynama.push(`2.5 Üst (${m.u25})`);
  }
  if(m.u35){
    const dv = degerVarMi('3.5 Üst', m.u35, poi.ust35);
    if(dv.var) oyna.push(`3.5 Üst (${m.u35})`); else oynama.push(`3.5 Üst (${m.u35})`);
  }
  if(m.u45){
    const dv = degerVarMi('4.5 Üst', m.u45, poi.ust45);
    if(dv.var) oyna.push(`4.5 Üst (${m.u45})`); else oynama.push(`4.5 Üst (${m.u45})`);
  }
  if(m.kgu){
    const dv = degerVarMi('KG+2.5Ü', m.kgu, poi.kgUst25);
    if(dv.var) oyna.push(`KG+2.5Ü (${m.kgu})`); else oynama.push(`KG+2.5Ü (${m.kgu})`);
  }
  let oneriCumle = '';
  if(s.puan > 75) oneriCumle = '🚨 Çok riskli! Banko yazma.';
  else if(s.puan > 50) oneriCumle = '⚠️ Yüksek risk. Banko yazma, çift şans yap.';
  else if(s.puan > 25) oneriCumle = '⚡ Orta risk. Tek oyna ama dikkatli ol.';
  else oneriCumle = '✅ Güvenli. Banko yazabilirsin.';
  if(enYuksek >= 70 && s.puan <= 25) oneriCumle = `✅ Banko! Tek ${favori} oyna.`;
  return `
    <div class="ne-yapmaliyim">
      <div class="baslik">🎯 NE YAPMALIYIM?</div>
      ${oyna.length ? `<div class="satir"><span class="oyna">✅ OYNA:</span> ${oyna.join(' · ')}</div>` : ''}
      ${oynama.length ? `<div class="satir"><span class="oynama">❌ OYNANMAZ:</span> ${oynama.join(' · ')}</div>` : ''}
      <div class="oneri">💡 ${oneriCumle}</div>
    </div>`;
}

/* ============ ORAN SEKME ANALİZ (TOTO) ============ */
function totoAnalizHTML(o, s, i){
  const o1 = o.p[0], oX = o.p[1], o2 = o.p[2];
  const enYuksek = Math.max(o1, oX, o2);
  const favori = o1 === enYuksek ? '1' : oX === enYuksek ? 'X' : '2';
  const renk = s.renk === 'yellow' ? 'orange' : s.renk;
  let yorum = '';
  if(s.puan > 75) yorum = '🚨 Sürpriz riski çok yüksek! Banko yazma.';
  else if(s.puan > 50) yorum = '⚠️ Sürpriz olabilir. Dikkatli ol.';
  else if(s.puan > 25) yorum = '⚡ Orta risk.';
  else yorum = '✅ Güvenli maç.';
  
  let oneri = '';
  if(enYuksek >= 70 && s.puan <= 25) oneri = `Banko: <b>${favori}</b>`;
  else if(enYuksek >= 55) oneri = `Favori: <b>${favori}</b> ama dikkatli`;
  else oneri = `Çok dengeli. Banko yazma.`;
  
  return `
    <div class="analiz-box">
      <div class="analiz-row"><span class="analiz-lbl">📊 TOTO TAHLİLİ</span></div>
      <div class="analiz-row">
        <span>1: <b class="green">%${o1.toFixed(1)}</b></span>
        <span>X: <b class="green">%${oX.toFixed(1)}</b></span>
        <span>2: <b class="green">%${o2.toFixed(1)}</b></span>
      </div>
      <div class="analiz-row"><span class="muted">Marj: %${o.marj}</span></div>
    </div>
    <div class="sürpriz-alert" style="border-color:var(--${renk})">
      <div class="baslik" style="color:var(--${renk})">🚨 SÜRPRİZ SKORU: ${s.puan}/100 · ${s.etiket}</div>
      ${s.nedenler.length ? `<div class="neden">${s.nedenler.join(' · ')}</div>` : ''}
      <div class="oneri">💡 ${yorum}</div>
    </div>
    <div class="analiz-box">
      <div class="analiz-row"><span class="analiz-lbl">💡 TAHMİN</span></div>
      <div class="analiz-row"><span>${oneri}</span></div>
      <div class="analiz-row"><span class="muted">${enYuksek >= 70 ? 'Banko maç' : enYuksek >= 55 ? 'Tek + çift şans' : 'Çift şans öner'}</span></div>
    </div>`;
}

/* ============ KELLY ============ */
function kelly(olasilik, oran, frac = 0.5){
  const p = olasilik / 100;
  const b = oran - 1;
  if(b <= 0) return 0;
  const k = (b * p - (1 - p)) / b;
  return Math.max(0, k * frac);
}

/* ============ VERİ YÜKLE ============ */
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
    renderSürprizRadar();
    renderSerbest();
    say('🤖 <b>SkorLab v10 hazır!</b><br><br>Oran=Toto, Serbest=İddaa.', 'bot');
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
        <div class="odds-box"><div class="lbl">1</div><div class="val">${parseFloat(od['1']).toFixed(2)}</div><div class="pct">%${(PR[i][0]*100).toFixed(1)}</div></div>
        <div class="odds-box"><div class="lbl">X</div><div class="val">${parseFloat(od['X']).toFixed(2)}</div><div class="pct">%${(PR[i][1]*100).toFixed(1)}</div></div>
        <div class="odds-box"><div class="lbl">2</div><div class="val">${parseFloat(od['2']).toFixed(2)}</div><div class="pct">%${(PR[i][2]*100).toFixed(1)}</div></div>
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

/* ============ ORAN SEKMESİ (TOTO) ============ */
function renderOranlar(){
  const container = $('oranListesi');
  if(!container) return;
  container.innerHTML = matchesData.map((m,i) => {
    const od = oddsData[m.id] || {};
    const hasAnaliz = od['1'] && od['X'] && od['2'];
    let analizCikti = '';
    if(hasAnaliz){
      const o = oranToOlasilik(parseFloat(od['1']), parseFloat(od['X']), parseFloat(od['2']));
      const s = sürprizHesapla(od['1'], od['X'], od['2']);
      analizCikti = totoAnalizHTML(o, s, i);
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
      </div>
      <button type="button" class="analiz-btn" onclick="analizEt(${m.id})">🔍 Analiz Et</button>
      <div id="analiz-cikti-${m.id}">${analizCikti}</div>
    </div>`;
  }).join('');
}

function analizEt(matchId){
  const idx = matchesData.findIndex(m => m.id === matchId);
  const od = oddsData[matchId];
  if(!od || !od['1'] || !od['X'] || !od['2']){
    showToast('error', 'Eksik Oran', 'En az 1, X, 2 oranlarını gir.');
    return;
  }
  const o = oranToOlasilik(parseFloat(od['1']), parseFloat(od['X']), parseFloat(od['2']));
  PR[idx] = o.p.map(x => x/100);
  const s = sürprizHesapla(od['1'], od['X'], od['2']);
  const cikti = $('analiz-cikti-' + matchId);
  if(cikti) cikti.innerHTML = totoAnalizHTML(o, s, idx);
  initApp();
  renderStats();
  renderSürprizRadar();
  showToast('success', 'Toto Analizi Hazır!', '#' + matchId + ' analiz edildi.');
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
  showToast('success', 'İndirildi!', 'matches-guncel.json indirildi.');
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

/* ============ SERBEST SEKMESİ (İDDAA) ============ */
function openSerbestModal(){
  ['sm-match','sm-o1','sm-oX','sm-o2','sm-kg','sm-u15','sm-u25','sm-u35','sm-u45','sm-kgu','sm-ev05','sm-ev15','sm-dep05','sm-dep15','sm-iy1','sm-iyX','sm-iy2'].forEach(id => {
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
    u15: $('sm-u15').value ? parseFloat($('sm-u15').value) : null,
    u25: $('sm-u25').value ? parseFloat($('sm-u25').value) : null,
    u35: $('sm-u35').value ? parseFloat($('sm-u35').value) : null,
    u45: $('sm-u45').value ? parseFloat($('sm-u45').value) : null,
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
  showToast('success', 'Maç Eklendi!', mac + ' eklendi.');
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
    const s = sürprizHesapla(m.o1, m.oX, m.o2);
    const renk = s.renk === 'yellow' ? 'orange' : s.renk;
    const xg = xGTahmin(o.p[0]/100, o.p[1]/100, o.p[2]/100);
    const poi = poissonBahisler(xg.evXg, xg.depXg);
    
    let html = `
    <div class="serbest-card">
      <div class="head">
        <div class="title">⚽ ${m.mac}</div>
        <button class="delete-btn" onclick="deleteSerbest(${idx})">🗑️</button>
      </div>
      <div class="odds-bar">
        <div class="odds-box"><div class="lbl">1</div><div class="val">${m.o1.toFixed(2)}</div><div class="pct">%${o.p[0].toFixed(1)}</div></div>
        <div class="odds-box"><div class="lbl">X</div><div class="val">${m.oX.toFixed(2)}</div><div class="pct">%${o.p[1].toFixed(1)}</div></div>
        <div class="odds-box"><div class="lbl">2</div><div class="val">${m.o2.toFixed(2)}</div><div class="pct">%${o.p[2].toFixed(1)}</div></div>
      </div>`;
    
    html += enIyiBahisHTML(m, poi, o, s);
    html += tumBahislerHTML(poi, o);
    html += golAnalizHTML(m.ev05, m.ev15, m.dep05, m.dep15);
    html += neYapmaliyimHTML(m, poi, o, s);
    html += `
      <div class="sürpriz-alert" style="border-color:var(--${renk})">
        <div class="baslik" style="color:var(--${renk})">🚨 Sürpriz Skoru: ${s.puan}/100 · ${s.etiket}</div>
        ${s.nedenler.length ? `<div class="neden">${s.nedenler.join(' · ')}</div>` : ''}
        <div class="oneri">💡 ${sürprizOneri(s.puan)}</div>
      </div>
      <div class="analiz-row muted" style="font-size:.65rem;margin-top:8px">📅 ${m.tarih}</div>
    </div>`;
    return html;
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
  const analizli = serbestData.map((m, idx) => {
    const o = oranToOlasilik(m.o1, m.oX, m.o2);
    const s = sürprizHesapla(m.o1, m.oX, m.o2);
    const xg = xGTahmin(o.p[0]/100, o.p[1]/100, o.p[2]/100);
    const poi = poissonBahisler(xg.evXg, xg.depXg);
    const en = enIyiBahisBul(m, poi, o, s);
    return { m, en, s };
  }).filter(x => x.en !== null);
  if(analizli.length < n){
    showToast('error', 'Yetersiz', 'Yeterli maç yok.');
    return;
  }
  analizli.sort((a, b) => a.s.puan - b.s.puan);
  const secilenler = analizli.slice(0, n);
  const kupon = {
    date: new Date().toLocaleDateString('tr-TR'),
    week: 'AKILLI KUPON',
    picks: {},
    totalMatches: n,
    serbest: true,
    maclar: secilenler.map(x => ({
      mac: x.m.mac,
      favori: x.en.bahis,
      oran: parseFloat(x.en.oran),
      neden: x.en.neden
    }))
  };
  savedCoupons.unshift(kupon);
  localStorage.setItem('skorlab_coupons', JSON.stringify(savedCoupons));
  renderCoupons();
  switchTab(5, document.querySelectorAll('.tab')[5]);
  showToast('success', 'Akıllı Kupon Hazır!', n + ' maçlık kupon oluşturuldu.');
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

/* ============ KUPON (BÜLTEN) ============ */
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
  $('outputCard').style.display = 'block';
  $('outputSummary').innerHTML = '<b>' + (n*10) + ' TL · ' + n + ' KOLON</b><br><br>15/15: <b class="green">%' + (cov*100).toFixed(3) + '</b>';
  $('outputContainer').innerHTML = r.slice(0,10).map((x,i) => `<div class="coupon"><b>KOLON #${String(i+1).padStart(2,'0')}</b><br>${x.pick.map((o,k) => codeToSym(o)).join(' ')}</div>`).join('');
  $('outputCard').scrollIntoView({behavior:'smooth'});
}

function openSuggestModal(){
  suggestMode = 'guvenli';
  $('suggestModal').classList.add('active');
}

function selectSuggestMode(mode, el){
  suggestMode = mode;
  document.querySelectorAll('#suggestModal .mode').forEach(e => e.classList.remove('active'));
  el.classList.add('active');
}

function updateSuggestEstimate(){}

function applySuggest(){
  closeModal('suggestModal');
  showToast('success', 'Tamam', 'Kupon oluşturuldu.');
}

function saveCoupon(){
  const keys = Object.keys(userPicks);
  if(keys.length === 0){ showToast('error', 'Maç Seçilmedi', 'En az bir maça tahmin yap.'); return; }
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

function kuponOlusturModal(){
  let eksik = [];
  matchesData.forEach(m => {
    const od = oddsData[m.id];
    if(!od || !od['1'] || !od['X'] || !od['2']) eksik.push('#' + m.id);
  });
  if(eksik.length > 0){
    showToast('error', 'Eksik Oran', 'Şu maçların oranları eksik: ' + eksik.join(', '));
    return;
  }
  openSuggestModal();
}

function renderCoupons(){
  const c = $('couponContent');
  if(!c) return;
  if(!savedCoupons.length){
    c.innerHTML = '<div class="coupon-empty">Henüz kupon yok.</div>';
    return;
  }
  c.innerHTML = '<div class="coupon-list">' + savedCoupons.map((coupon, idx) => {
    let html = '';
    let prob = 1;
    if(coupon.serbest){
      coupon.maclar.forEach(m => {
        html += '<div><b>' + m.mac + '</b>: ' + m.favori + ' (' + m.oran.toFixed(2) + ')</div>';
        prob *= (100 / m.oran) / 100;
      });
    } else {
      for(let mIdx in coupon.picks){
        const m = matchesData[parseInt(mIdx)] || {home:'?',away:'?'};
        html += '<div><b>#' + (parseInt(mIdx)+1) + ' ' + m.home + ' - ' + m.away + '</b>: ' + coupon.picks[mIdx].map(x => codeToSym(x)).join(', ') + '</div>';
      }
    }
    return `<div class="coupon-card">
      <div class="head">
        <span class="week">KUPON #${savedCoupons.length - idx} · ${coupon.date} ${coupon.serbest ? '⭐ AKILLI' : ''}</span>
        <button onclick="deleteCoupon(${idx})" style="background:none;border:none;color:var(--red);cursor:pointer;font-size:.8rem;width:auto;padding:2px 6px">🗑️</button>
      </div>
      <div class="picks">${html}</div>
      <div style="margin-top:10px;font-size:.75rem;color:var(--green);font-weight:700">Tahmini: %${(prob*100).toFixed(2)}</div>
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
    html += '<tr><td>#' + m.id + ' ' + m.home.slice(0,8) + '</td><td><b>' + sym + '</b></td><td>' + parseFloat(oran).toFixed(2) + '</td><td class="' + cls + '">%' + (k*100).toFixed(1) + '</td><td class="' + cls + '">' + yatir + ' TL</td></tr>';
  });
  html += '</tbody></table>';
  $('kellyOutput').innerHTML = html;
}

/* ============ BACKTEST ============ */
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
    html += '<div class="backtest-row"><span class="week">' + w.week + '</span><span class="acc ' + cls + '">' + correct + '/' + w.results.length + ' (%' + acc + ')</span></div>';
  });
  const genel = totalMatches ? (totalCorrect/totalMatches*100).toFixed(1) : 0;
  html += '<div class="backtest-row" style="border-top:2px solid var(--border);margin-top:10px;padding-top:14px"><span class="week"><b>GENEL</b></span><span class="acc good">%' + genel + '</span></div>';
  c.innerHTML = html;
}

function renderHeatmap(){
  const hm = $('heatmap');
  if(!hm) return;
  hm.innerHTML = matchesData.map((m,i) => {
    const mx = topP(i), cls = mx >= 0.65 ? 'green' : mx >= 0.5 ? 'yellow' : 'red';
    return '<div class="hm ' + cls + '" onclick="ask(\'maç ' + m.id + '\')">' + m.id + '</div>';
  }).join('');
}

function setMode(mode, el){
  currentMode = mode;
  document.querySelectorAll('.mode').forEach(e => e.classList.remove('active'));
  if(el) el.classList.add('active');
  const info = {
    guvenli: '<b>🛡️ GÜVENLİ</b><br>%70+ bankolar ve %55+ favoriler.',
    dengeli: '<b>⚖️ DENGELİ</b><br>Favoriler + hafif sürprizler.',
    agresif: '<b>🚀 AGRESİF</b><br>Sürprizlere ağırlık.'
  };
  const el2 = $('modeInfo');
  if(el2) el2.innerHTML = info[mode];
}

function renderStats(){
  const statBanko = $('statBanko');
  if(!statBanko) return;
  const banko = matchesData.filter((_,i) => topP(i) >= 0.7).length;
  const dengeli = matchesData.filter((_,i) => topP(i) < 0.5).length;
  const zorluk = banko >= 5 ? 'Kolay' : dengeli >= 6 ? 'Zor' : 'Orta';
  statBanko.innerText = banko;
  const sD = $('statDengeli'); if(sD) sD.innerText = dengeli;
  const sV = $('statValue'); if(sV) sV.innerText = '-';
  const sZ = $('statZorluk'); if(sZ) sZ.innerText = zorluk;
}

/* ============ BANKOBOT ============ */
function say(html, who){
  const chat = $('chat');
  if(!chat) return;
  const d = document.createElement('div');
  d.className = 'b ' + who;
  d.innerHTML = html;
  chat.appendChild(d);
  d.scrollIntoView({block:'end',behavior:'smooth'});
}

function summary(){
  const L = matchesData.length;
  const banko = matchesData.filter((_,i) => topP(i) >= 0.7).length;
  const dengeli = matchesData.filter((_,i) => topP(i) < 0.5).length;
  return '<b>📊 BÜLTEN ÖZETİ</b><br><br>🏦 Banko: <b>' + banko + '</b><br>⚠️ Dengeli: <b>' + dengeli + '</b>';
}

function listBanko(){
  const b = matchesData.map((m,i) => [m,i]).filter(x => topP(x[1]) >= 0.7);
  if(!b.length) return 'Banko yok.';
  return '<b>🏦 BANKOLAR:</b><br>' + b.map(([m,i]) => '#' + m.id + ' ' + m.home + ' - ' + m.away + ': %' + pc(topP(i))).join('<br>');
}

function listSürpriz(){
  const s = matchesData.map((m,i) => [m,i,sürprizSkoru(i)]).filter(x => x[2].etiket !== 'Bilinmiyor').sort((a,b) => b[2].puan - a[2].puan);
  if(!s.length) return 'Sürpriz analizi yok.';
  return '<b>🚨 SÜRPRİZ:</b><br>' + s.slice(0,5).map(([m,i,sk]) => '#' + m.id + ' ' + m.home + ' - ' + m.away + '<br>Skor: ' + sk.puan + '/100').join('<br>');
}

function difficulty(){
  const dengeli = matchesData.filter((_,i) => topP(i) < 0.5).length;
  const banko = matchesData.filter((_,i) => topP(i) >= 0.7).length;
  return '<b>📅 ZORLUK</b><br>Banko: ' + banko + ' · Dengeli: ' + dengeli;
}

function reply(t){
  const q = t.toLocaleLowerCase('tr');
  if(/sürpriz|riskli/.test(q)) return listSürpriz();
  if(/banko/.test(q)) return listBanko();
  if(/zor|kolay|zorluk/.test(q)) return difficulty();
  if(/özet|bülten/.test(q)) return summary();
  return '🤖 Sor: Bülten özeti, Bankolar, Sürpriz radarı, Zorluk';
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
  const text = '🎯 SkorLab - Akıllı Spor Toto Analiz\n\n👉 https://emrahmeltem90-ux.github.io/bilyonvip';
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
