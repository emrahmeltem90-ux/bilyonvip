/* ============================================================
   SKORLAB v17 PRO · Toto + İddaa + Pro Analiz + Sihirbaz
   ============================================================ */

let matchesData = [];
let oddsData = {};
let serbestData = JSON.parse(localStorage.getItem('skorlab_serbest') || '[]');
let kayitliKuponlar = JSON.parse(localStorage.getItem('skorlab_kuponlar') || '[]');
let secimlerim = JSON.parse(localStorage.getItem('skorlab_secimlerim') || '{}');
let serbestSecimlerim = JSON.parse(localStorage.getItem('skorlab_serbest_secimlerim') || '{}');
let otomatikKolonlar = JSON.parse(localStorage.getItem('skorlab_otomatik_kolonlar') || 'null');
let butce = parseFloat(localStorage.getItem('skorlab_butce') || '100');
let weekKey = 'default';
let duzenlenenSerbestId = null;

const $ = id => document.getElementById(id);

/* ==================== POISSON & MATEMATİKSEL MODELLER ==================== */
function poissonPmf(k, lambda){
  let p = Math.exp(-lambda);
  for(let i = 1; i <= k; i++) p *= lambda / i;
  return p;
}

function poissonMatris(xgEv, xgDep){
  const MAX = 8;
  let p1=0, pX=0, p2=0, kg=0, ust25=0, ust35=0;
  const skorlar = {};
  for(let h=0; h<MAX; h++){
    for(let a=0; a<MAX; a++){
      const p = poissonPmf(h, xgEv) * poissonPmf(a, xgDep);
      skorlar[h+'-'+a] = p;
      if(h>a) p1 += p; else if(h===a) pX += p; else p2 += p;
      if(h >= 1 && a >= 1) kg += p;
      if(h + a > 2.5) ust25 += p;
      if(h + a > 3.5) ust35 += p;
    }
  }
  return { p1:p1*100, pX:pX*100, p2:p2*100, kg:kg*100, ust25:ust25*100, ust35:ust35*100, skorlar };
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

function oranBandi(oran){
  if(oran <= 1.25) return { kod:'banko', etiket:'🔒 BANKO', seviye:1 };
  if(oran <= 1.45) return { kod:'guvenli', etiket:'✅ GÜVENLİ', seviye:2 };
  if(oran <= 1.60) return { kod:'riskli', etiket:'⚠️ RİSKLİ', seviye:3 };
  if(oran <= 2.10) return { kod:'denge', etiket:'⚡ DENGE', seviye:4 };
  return { kod:'surpriz', etiket:'🚨 SÜRPRİZ', seviye:5 };
}

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

  const oranlar = { '1': o1, 'X': oX, '2': o2 };
  const favOran = oranlar[sirali[0].kod];

  return {
    id, p1:hib.p1, pX:hib.pX, p2:hib.p2, marj:parseFloat(o.marj),
    skorlar:poi.skorlar, xgEv:xg.xgEv, xgDep:xg.xgDep,
    ust25:poi.ust25, ust35:poi.ust35, kg:poi.kg,
    sirali, enYuksek:sirali[0], ikinci:sirali[1], ucuncu:sirali[2],
    oranlar, favOran,
    band: oranBandi(favOran)
  };
}

function shinMarjArindir(o1, oX, o2){
  const p1_raw = 1/o1, pX_raw = 1/oX, p2_raw = 1/o2;
  const z = p1_raw + pX_raw + p2_raw;
  if(z <= 1) return { p1: p1_raw, pX: pX_raw, p2: p2_raw };

  function shinFormul(p){
    const num = Math.sqrt(z*z + 4*(1-z)*(p/z)*(p/z)) - z;
    const den = 2*(1-z);
    return num / den;
  }

  const p1 = shinFormul(p1_raw);
  const pX = shinFormul(pX_raw);
  const p2 = shinFormul(p2_raw);
  const top = p1 + pX + p2;
  return { p1: p1/top, pX: pX/top, p2: p2/top };
}

function xgOranlardan(p1, pX, p2){
  const hs = p1 / (p1 + p2 || 1);
  const tg = 2.4 + (1 - pX) * 0.8;
  const xgEv = Math.max(0.3, tg * hs * 1.15);
  const xgDep = Math.max(0.3, tg * (1 - hs));
  return { xgEv, xgDep };
}

function butceGuncelle(val){
  butce = parseFloat(val) || 100;
  localStorage.setItem('skorlab_butce', butce);
  updateKuponCubugu();
  if($('kcMacS')) updateKuponCubuguSerbest();
}

/* ==================== SERBEST MAÇ DEĞER ANALİZ MOTORU ==================== */
function serbestOneriEngine(o1, oX, o2, oA25, oU25, oA35, oU35, oKgV, oKgY){
  const shin = shinMarjArindir(o1, oX, o2);
  const xg = xgOranlardan(shin.p1, shin.pX, shin.p2);
  const poi = poissonMatris(xg.xgEv, xg.xgDep);

  const adaylar = [];

  // Taraf Bahisleri
  if(o1) adaylar.push({ etiket: 'Maç Sonucu 1', kod: '1', olaslik: poi.p1, oran: o1 });
  if(oX) adaylar.push({ etiket: 'Maç Sonucu X', kod: 'X', olaslik: poi.pX, oran: oX });
  if(o2) adaylar.push({ etiket: 'Maç Sonucu 2', kod: '2', olaslik: poi.p2, oran: o2 });

  // 2.5 Gol Bahisleri
  if(oU25) adaylar.push({ etiket: '2.5 Üst', kod: '2.5 ÜST', olaslik: poi.ust25, oran: oU25 });
  if(oA25) adaylar.push({ etiket: '2.5 Alt', kod: '2.5 ALT', olaslik: 100 - poi.ust25, oran: oA25 });

  // 3.5 Gol Bahisleri
  if(oU35) adaylar.push({ etiket: '3.5 Üst', kod: '3.5 ÜST', olaslik: poi.ust35, oran: oU35 });
  if(oA35) adaylar.push({ etiket: '3.5 Alt', kod: '3.5 ALT', olaslik: 100 - poi.ust35, oran: oA35 });

  // KG Bahisleri
  if(oKgV) adaylar.push({ etiket: 'KG Var', kod: 'KG VAR', olaslik: poi.kg, oran: oKgV });
  if(oKgY) adaylar.push({ etiket: 'KG Yok', kod: 'KG YOK', olaslik: 100 - poi.kg, oran: oKgY });

  // Beklenen Değer (Expected Value = EV) Hesabı
  adaylar.forEach(a => {
    a.ev = (a.olaslik / 100) * a.oran;
  });

  adaylar.sort((a, b) => b.ev - a.ev);
  const enIyi = adaylar[0];

  return { enIyi, tumAdaylar: adaylar, xgEv: xg.xgEv, xgDep: xg.xgDep };
}

/* ==================== VERİ YÜKLE ==================== */
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
  }catch(e){
    console.error('matches.json:', e);
    const cached = localStorage.getItem('skorlab_last_matches');
    if(cached){ try{ matchesData = JSON.parse(cached); }catch(err){} }
  }
  if(matchesData.length) localStorage.setItem('skorlab_last_matches', JSON.stringify(matchesData));
  $('weekTitle').innerText = 'Bu Hafta';
  renderBulten(); renderSerbest(); updateStats();
  updateKuponCubugu(); updateKuponCubuguSerbest();
  renderKayitliKuponlar(); renderKarsilastirma();
}

/* ==================== BÜLTEN ==================== */
function renderBulten(){
  if(otomatikKolonlar && otomatikKolonlar.tip === 'toto' && otomatikKolonlar.kolonlar.length){
    renderOtomatikBulten();
    return;
  }

  if(!matchesData.length){
    $('matchesList').innerHTML = '<div class="card"><div class="muted" style="text-align:center;padding:20px">Maç yok.</div></div>';
    return;
  }

  $('matchesList').innerHTML = matchesData.map(m => {
    const od = oddsData[m.id] || {};
    const has = od['1'] && od['X'] && od['2'];
    const a = has ? macAnalizEt(m.id, od['1'], od['X'], od['2']) : null;
    const sec = secimlerim[m.id] || [];
    const sec1 = sec.includes('1'), secX = sec.includes('X'), sec2 = sec.includes('2');
    const p1 = a ? a.p1 : 0, pX = a ? a.pX : 0, p2 = a ? a.p2 : 0;

    let secimOzet = sec.length === 1 ? sec[0] : (sec.length === 2 ? sec.join('') : (sec.length === 3 ? 'KAPALI' : ''));
    let bandTag = a ? `<span class="badge ${a.band.seviye<=2?'green':a.band.seviye===3?'yellow':a.band.seviye===4?'orange':'red'}">${a.band.etiket}</span>` : '';

    return `
    <div class="sade-mac">
      <div class="sade-mac-head">
        <span class="sade-mac-no">#${m.id}</span>
        <span class="sade-mac-tarih">${m.date}${m.league?' · '+m.league:''}${secimOzet?' · <b style="color:var(--green)">'+secimOzet+'</b>':''}</span>
      </div>
      <div class="sade-mac-teams" onclick="macDetayGoster(${m.id})">${m.home} - ${m.away} ${bandTag}</div>
      <div class="sade-mac-tahminler">
        <button class="sade-btn ${sec1?'secili':''}" onclick="secimToggle(${m.id},'1')"><span class="kod">1</span><span class="yuzde">%${p1.toFixed(1)}</span></button>
        <button class="sade-btn ${secX?'secili':''}" onclick="secimToggle(${m.id},'X')"><span class="kod">X</span><span class="yuzde">%${pX.toFixed(1)}</span></button>
        <button class="sade-btn ${sec2?'secili':''}" onclick="secimToggle(${m.id},'2')"><span class="kod">2</span><span class="yuzde">%${p2.toFixed(1)}</span></button>
      </div>
    </div>`;
  }).join('');
  updateKuponCubugu();
}

function renderOtomatikBulten(){
  const o = otomatikKolonlar;
  let html = '<div class="card" style="margin-bottom:10px;background:linear-gradient(135deg,rgba(0,230,118,.1),var(--bg2));border:1px solid var(--green)">';
  html += `<div style="font-weight:900;color:var(--green);margin-bottom:8px">🤖 OTOMATİK KUPON (${o.kolonlar.length} kolon · ${o.tutar} TL)</div>`;
  html += `<div style="font-size:.7rem;color:var(--muted);margin-bottom:10px">${o.macIdler.length} maç · Mod: ${o.mod}</div>`;
  html += `<button class="btn btn-red btn-sm" onclick="otomatikIptal()">🗑️ İptal Et</button>`;
  html += '</div>';

  o.macIdler.forEach((mid, idx) => {
    const m = matchesData.find(x => x.id === mid);
    if(!m) return;
    const od = oddsData[mid] || {};
    const a = macAnalizEt(mid, od['1'], od['X'], od['2']);
    if(!a) return;

    const buMacSecimler = o.kolonlar.map(k => k[idx]);
    const benzersizSecimler = [...new Set(buMacSecimler)];
    const secimStr = benzersizSecimler.join('');

    html += `
    <div class="sade-mac">
      <div class="sade-mac-head">
        <span class="sade-mac-no">#${mid}</span>
        <span class="sade-mac-tarih">${m.date} · <b style="color:var(--green)">${secimStr}</b></span>
      </div>
      <div class="sade-mac-teams">${m.home} - ${m.away}</div>
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-top:8px">
        <div class="sade-btn ${benzersizSecimler.includes('1')?'secili':''}" style="cursor:default"><span class="kod">1</span><span class="yuzde">%${a.p1.toFixed(1)}</span></div>
        <div class="sade-btn ${benzersizSecimler.includes('X')?'secili':''}" style="cursor:default"><span class="kod">X</span><span class="yuzde">%${a.pX.toFixed(1)}</span></div>
        <div class="sade-btn ${benzersizSecimler.includes('2')?'secili':''}" style="cursor:default"><span class="kod">2</span><span class="yuzde">%${a.p2.toFixed(1)}</span></div>
      </div>
    </div>`;
  });

  $('matchesList').innerHTML = html;
  updateKuponCubugu();
}

function otomatikIptal(){
  otomatikKolonlar = null;
  localStorage.removeItem('skorlab_otomatik_kolonlar');
  renderBulten();
  updateKuponCubugu();
}

function secimToggle(id, secim){
  let sec = secimlerim[id] || [];
  if(sec.includes(secim)) sec = sec.filter(s => s !== secim);
  else sec.push(secim);
  if(sec.length === 0) delete secimlerim[id];
  else secimlerim[id] = sec;
  localStorage.setItem('skorlab_secimlerim', JSON.stringify(secimlerim));
  renderBulten();
  updateKuponCubugu();
}

/* ==================== SERBEST MÜKEMMEL SEKMESİ ==================== */
function renderSerbest(){
  const c = $('serbestListesi');
  if(!c) return;

  if(!serbestData.length){
    c.innerHTML = `
      <div class="card" style="text-align:center;padding:30px">
        <div class="muted">Henüz serbest maç eklemedin.<br><br><b>"➕ Maç Ekle"</b> butonuna basarak oranları gir.</div>
      </div>`;
    return;
  }

  let html = `
    <div style="margin-bottom:12px">
      <button class="btn btn-green btn-lg" style="width:100%;font-weight:900;padding:12px;font-size:1rem" onclick="serbestOtomatikKuponOlustur()">🔥 MÜKEMMEL KUPON OLUŞTUR</button>
    </div>`;

  html += serbestData.map((m, idx) => {
    const oneri = m.oneri;
    const evYuzde = ((oneri.ev - 1) * 100).toFixed(1);
    const durumRenk = oneri.ev > 1.05 ? 'var(--green)' : 'var(--orange)';

    return `
    <div class="sade-mac" style="margin-bottom:10px">
      <div class="sade-mac-head">
        <span class="sade-mac-no">İDDAA #${idx+1}</span>
        <div style="display:flex;gap:6px;align-items:center">
          <button class="sm-duzenle-btn" onclick="openSerbestDuzenle(${idx})" title="Düzenle">✏️</button>
          <button onclick="serbestSil(${idx})" style="background:none;border:none;color:var(--red);cursor:pointer;font-size:1rem">🗑️</button>
        </div>
      </div>
      <div class="sade-mac-teams" style="font-weight:800;font-size:.95rem;margin:4px 0">${m.mac}</div>
      
      <!-- SİSTEM ÖNERİ BARI -->
      <div style="background:var(--bg3);border-left:4px solid ${durumRenk};padding:8px 10px;margin-top:8px;border-radius:6px;display:flex;justify-content:space-between;align-items:center">
        <div>
          <span style="font-size:.65rem;color:var(--muted);display:block">🎯 SİSTEM ÖNERİSİ</span>
          <b style="color:${durumRenk};font-size:.85rem">${oneri.etiket} (${oneri.kod})</b>
        </div>
        <div style="text-align:right">
          <b style="font-size:1rem;color:#fff">@ ${oneri.oran}</b>
          <span style="font-size:.65rem;color:var(--muted);display:block">%${oneri.olaslik.toFixed(1)} Şans · Değer: %${evYuzde}</span>
        </div>
      </div>
    </div>`;
  }).join('');

  c.innerHTML = html;
}

function serbestCanliAnaliz(){
  const o1 = parseFloat($('sm-o1').value);
  const oX = parseFloat($('sm-oX').value);
  const o2 = parseFloat($('sm-o2').value);
  const oA25 = parseFloat($('sm-oA25').value) || null;
  const oU25 = parseFloat($('sm-oU25').value) || null;
  const oA35 = parseFloat($('sm-oA35').value) || null;
  const oU35 = parseFloat($('sm-oU35').value) || null;
  const oKgV = parseFloat($('sm-oKgV').value) || null;
  const oKgY = parseFloat($('sm-oKgY').value) || null;

  const kutu = $('sm-canli-analiz');
  if(!kutu) return;

  if(!o1 || !oX || !o2){
    kutu.style.display = 'none';
    return;
  }

  kutu.style.display = 'block';
  const analiz = serbestOneriEngine(o1, oX, o2, oA25, oU25, oA35, oU35, oKgV, oKgY);
  const b = analiz.enIyi;

  const evYuzde = ((b.ev - 1) * 100).toFixed(1);
  const durumRenk = b.ev > 1.05 ? 'var(--green)' : 'var(--orange)';

  $('sm-en-degerli-tercih').innerHTML = `
    🎯 EN YÜKSEK DEĞER: <span style="color:${durumRenk}">${b.etiket} @ ${b.oran}</span> 
    <br><span style="font-size:.7rem;color:var(--muted)">Olasılık: %${b.olaslik.toFixed(1)} · Beklenen Değer Kazancı: %${evYuzde}</span>
  `;
}

function openSerbestModal(){
  duzenlenenSerbestId = null;
  ['sm-match','sm-o1','sm-oX','sm-o2','sm-oA25','sm-oU25','sm-oA35','sm-oU35','sm-oKgV','sm-oKgY'].forEach(id => {
    const el = $(id);
    if(el){ el.value = ''; el.classList.remove('hata'); }
  });
  const t = $('serbestModalTitle'); if(t) t.innerText = '➕ SERBEST MAÇ EKLE';
  const b = $('sm-kaydet-btn'); if(b) b.innerText = '✅ EKLE';
  const k = $('sm-canli-analiz'); if(k) k.style.display = 'none';
  const m = $('serbestModal'); if(m) m.classList.add('active');
}

function openSerbestDuzenle(idx){
  const m = serbestData[idx];
  if(!m) return;
  duzenlenenSerbestId = m.id;
  $('sm-match').value = m.mac \vert{}\vert{} '';$('sm-o1').value = m.o1 || '';
  $('sm-oX').value = m.oX \vert{}\vert{} '';$('sm-o2').value = m.o2 || '';
  $('sm-oA25').value = m.oA25 \vert{}\vert{} '';$('sm-oU25').value = m.oU25 || '';
  $('sm-oA35').value = m.oA35 \vert{}\vert{} '';$('sm-oU35').value = m.oU35 || '';
  $('sm-oKgV').value = m.oKgV \vert{}\vert{} '';$('sm-oKgY').value = m.oKgY || '';

  const t = $('serbestModalTitle'); if(t) t.innerText = '✏️ SERBEST MAÇ DÜZENLE';
  const b = $('sm-kaydet-btn'); if(b) b.innerText = '💾 GÜNCELLE';
  const mo = $('serbestModal'); if(mo) mo.classList.add('active');
  serbestCanliAnaliz();
}

function serbestKaydet(){
  const mac = $('sm-match').value.trim();
  const o1 = parseFloat($('sm-o1').value);
  const oX = parseFloat($('sm-oX').value);
  const o2 = parseFloat($('sm-o2').value);
  const oA25 = parseFloat($('sm-oA25').value) || null;
  const oU25 = parseFloat($('sm-oU25').value) || null;
  const oA35 = parseFloat($('sm-oA35').value) || null;
  const oU35 = parseFloat($('sm-oU35').value) || null;
  const oKgV = parseFloat($('sm-oKgV').value) || null;
  const oKgY = parseFloat($('sm-oKgY').value) || null;

  if(!mac || !o1 || !oX || !o2){
    showToast('error','Eksik Bilgi','Maç adı ve 1-X-2 taraf oranları zorunludur.');
    return;
  }

  const analiz = serbestOneriEngine(o1, oX, o2, oA25, oU25, oA35, oU35, oKgV, oKgY);

  const veri = {
    id: duzenlenenSerbestId || Date.now(),
    mac, o1, oX, o2, oA25, oU25, oA35, oU35, oKgV, oKgY,
    oneri: analiz.enIyi,
    tarih: new Date().toLocaleString('tr-TR')
  };

  if(duzenlenenSerbestId){
    const idx = serbestData.findIndex(x => x.id === duzenlenenSerbestId);
    if(idx !== -1) serbestData[idx] = veri;
    duzenlenenSerbestId = null;
  } else {
    serbestData.unshift(veri);
  }

  localStorage.setItem('skorlab_serbest', JSON.stringify(serbestData));
  closeModal('serbestModal');
  renderSerbest();
  showToast('success','Maç Eklendi', `${mac} → Öneri: ${analiz.enIyi.kod}`);
}

function serbestSil(idx){
  const m = serbestData[idx];
  if(!m) return;
  if(!confirm(`"${m.mac}" silinsin mi?`)) return;
  serbestData.splice(idx, 1);
  localStorage.setItem('skorlab_serbest', JSON.stringify(serbestData));
  renderSerbest();
  showToast('success','Silindi', m.mac);
}

function temizleSerbest(){
  if(!confirm('Tüm serbest maçlar silinsin mi?')) return;
  serbestData = [];
  localStorage.removeItem('skorlab_serbest');
  renderSerbest();
}

function serbestOtomatikKuponOlustur(){
  if(!serbestData.length){
    showToast('error','Maç Yok','En az 1 maç eklemelisin.');
    return;
  }

  let toplamOran = 1;
  const secilenler = [];

  serbestData.forEach(m => {
    secilenler.push({
      isim: m.mac,
      secim: `${m.oneri.kod} (@${m.oneri.oran})`
    });
    toplamOran *= m.oneri.oran;
  });

  const kupon = {
    id: Date.now(),
    tip: 'iddaa',
    mod: 'SİSTEM ÖNERİSİ',
    tarih: new Date().toLocaleString('tr-TR'),
    macSayisi: secilenler.length,
    kolon: 1,
    tutar: Math.min(butce, 100),
    toplamOran: toplamOran.toFixed(2),
    detaylar: secilenler,
    durum: 'bekliyor'
  };

  kayitliKuponlar.unshift(kupon);
  localStorage.setItem('skorlab_kuponlar', JSON.stringify(kayitliKuponlar));
  renderKayitliKuponlar();
  
  showToast('success','Kupon Oluşturuldu!', `${secilenler.length} Maç · Toplam Oran: ${toplamOran.toFixed(2)}`);
  switchTab(3, document.querySelectorAll('.tab')[2]);
}

/* ==================== KUPON ÇUBUĞU & HESAPLAMA ==================== */
function kuponHesapla(){
  if(otomatikKolonlar && otomatikKolonlar.tip === 'toto'){
    return {
      macSayisi: otomatikKolonlar.macIdler.length,
      kolon: otomatikKolonlar.kolonlar.length,
      tutar: otomatikKolonlar.tutar,
      kalan: butce - otomatikKolonlar.tutar
    };
  }
  let macSayisi = 0, kolon = 1;
  Object.keys(secimlerim).forEach(id => {
    const sec = secimlerim[id];
    if(!sec || !sec.length) return;
    macSayisi++;
    kolon *= sec.length;
  });
  const tutar = kolon * 10;
  return { macSayisi, kolon, tutar, kalan: butce - tutar };
}

function updateKuponCubugu(){
  const h = kuponHesapla();
  const kcM = $('kcMac'); if(kcM) kcM.innerText = h.macSayisi;
  const kcK = $('kcKolon'); if(kcK) kcK.innerText = h.kolon;
  const kcT = $('kcTutar'); if(kcT) kcT.innerText = h.tutar + ' TL';
  const kcKalan = $('kcKalan');
  if(kcKalan){ kcKalan.innerText = h.kalan + ' TL'; kcKalan.style.color = h.kalan < 0 ? 'var(--red)' : 'var(--green)'; }
}

function updateStats(){
  const sM = $('statMac'); if(sM) sM.innerText = matchesData.length;
}

/* ==================== SPOR TOTO OTOMATİK KUPON ==================== */
function otomatikKuponAc(){
  if(!matchesData.length){ showToast('error','Maç Yok','Bülten boş.'); return; }
  const maxKolon = Math.floor(butce / 10);
  if(maxKolon < 1){ showToast('error','Bütçe Az','En az 10 TL.'); return; }

  $('secimModalBody').innerHTML = `
    <div style="font-size:.85rem">
      <div style="background:var(--bg3);border-radius:10px;padding:12px;margin-bottom:14px;text-align:center">
        <div style="color:var(--muted);font-size:.7rem">BÜTÇE</div>
        <div style="font-weight:900;font-size:1.5rem;color:var(--green);margin:4px 0">${butce} TL</div>
        <div style="color:var(--muted);font-size:.7rem">${maxKolon} kolona kadar</div>
      </div>

      <div style="font-weight:800;color:var(--orange);font-size:.78rem;margin-bottom:10px">NASIL KUPON İSTİYORSUN?</div>

      <button class="secim-btn teklı" onclick="kuponTekliUret()">
        <div class="baslik" style="color:var(--blue)">🖐️ ${maxKolon} KOLON TEKLİ</div>
        <div class="aciklama">Geniş kuponundan ${maxKolon} farklı tekli kolon üretir · ${maxKolon * 10} TL</div>
      </button>

      <button class="secim-btn sistem" onclick="kuponSistemUret()">
        <div class="baslik" style="color:var(--green)">🤖 SİSTEM KOLONU</div>
        <div class="aciklama">Seçimlerini bütçene tam sığdırır (Bankolar tek, riskliler çift/üçlü)</div>
      </button>
    </div>
  `;
  $('secimModal').classList.add('active');
}

function kuponTekliUret(){
  if(!matchesData.length){ showToast('error','Maç Yok','Bülten boş.'); return; }
  const maxKolon = Math.floor(butce / 10);
  if(maxKolon < 1){ showToast('error','Bütçe Az','En az 10 TL gerekli.'); return; }

  const secimVar = Object.keys(secimlerim).some(k => secimlerim[k] && secimlerim[k].length > 0);

  const maclar = [];
  matchesData.forEach(m => {
    const od = oddsData[m.id];
    const a = (od && od['1']) ? macAnalizEt(m.id, od['1'], od['X'], od['2']) : null;
    
    let adaylar = [];
    if(secimVar && secimlerim[m.id] && secimlerim[m.id].length > 0){
      adaylar = [...secimlerim[m.id]];
    } else if(a){
      adaylar = a.sirali.map(s => s.kod);
    } else {
      adaylar = ['1', 'X', '2'];
    }

    maclar.push({ m, a, adaylar });
  });

  let kombinasyonlar = [[]];
  for(let i = 0; i < maclar.length; i++){
    const yeni = [];
    const secenekler = maclar[i].adaylar;
    for(const k of kombinasyonlar){
      for(const s of secenekler){
        yeni.push([...k, s]);
        if(yeni.length >= 30000) break;
      }
      if(yeni.length >= 30000) break;
    }
    kombinasyonlar = yeni;
  }

  let secilenKolonlar = [];
  if(kombinasyonlar.length <= maxKolon){
    secilenKolonlar = kombinasyonlar;
  } else {
    const step = kombinasyonlar.length / maxKolon;
    const kullanilanlar = new Set();
    for(let i = 0; i < maxKolon; i++){
      let idx = Math.floor(i * step + Math.random() * step);
      idx = Math.min(Math.max(0, idx), kombinasyonlar.length - 1);
      if(!kullanilanlar.has(idx)){
        kullanilanlar.add(idx);
        secilenKolonlar.push(kombinasyonlar[idx]);
      }
    }
  }

  const macIdler = maclar.map(mc => mc.m.id);

  otomatikKolonlar = {
    tip: 'toto', mod: 'TEKLİ',
    macIdler: macIdler, kolonlar: secilenKolonlar,
    tutar: secilenKolonlar.length * 10
  };
  localStorage.setItem('skorlab_otomatik_kolonlar', JSON.stringify(otomatikKolonlar));
  closeModal('secimModal');
  renderBulten();
  updateKuponCubugu();
  showToast('success','Tekli Kupon', secilenKolonlar.length + ' kolon · ' + otomatikKolonlar.tutar + ' TL');
}

function kuponSistemUret(){
  if(!matchesData.length){ showToast('error','Maç Yok','Bülten boş.'); return; }
  const maxKolon = Math.floor(butce / 10);
  if(maxKolon < 1){ showToast('error','Bütçe Az','En az 10 TL gerekli.'); return; }

  const secimVar = Object.keys(secimlerim).some(k => secimlerim[k] && secimlerim[k].length > 0);

  const maclar = [];
  matchesData.forEach(m => {
    const od = oddsData[m.id];
    const a = (od && od['1']) ? macAnalizEt(m.id, od['1'], od['X'], od['2']) : null;
    
    let mevcutSecim = [];
    if(secimVar && secimlerim[m.id] && secimlerim[m.id].length > 0){
      mevcutSecim = [...secimlerim[m.id]];
    } else if(a){
      if(a.band.seviye <= 2) mevcutSecim = [a.sirali[0].kod];
      else if(a.band.seviye <= 4) mevcutSecim = [a.sirali[0].kod, a.sirali[1].kod];
      else mevcutSecim = [a.sirali[0].kod, a.sirali[1].kod, a.sirali[2].kod];
    } else {
      mevcutSecim = ['1'];
    }

    maclar.push({ m, a, secimler: mevcutSecim, guvenlikSkoru: a ? a.band.seviye : 3 });
  });

  let toplamKolon = maclar.reduce((t, mc) => t * mc.secimler.length, 1);

  if(toplamKolon > maxKolon){
    const siraliIndeksler = [...maclar.keys()].sort((i, j) => maclar[i].guvenlikSkoru - maclar[j].guvenlikSkoru);
    for(const idx of siraliIndeksler){
      while(toplamKolon > maxKolon && maclar[idx].secimler.length > 1){
        maclar[idx].secimler.pop();
        toplamKolon = maclar.reduce((t, mc) => t * mc.secimler.length, 1);
      }
      if(toplamKolon <= maxKolon) break;
    }
  }

  function kartezyenUret(list){
    let sonuc = [[]];
    for(let i = 0; i < list.length; i++){
      const yeni = [];
      const secenekler = list[i].secimler;
      for(const k of sonuc){
        for(const s of secenekler) yeni.push([...k, s]);
      }
      sonuc = yeni;
    }
    return sonuc;
  }

  const kolonlar = kartezyenUret(maclar);
  const macIdler = maclar.map(mc => mc.m.id);

  otomatikKolonlar = {
    tip: 'toto', mod: 'SİSTEM',
    macIdler: macIdler, kolonlar: kolonlar,
    tutar: kolonlar.length * 10
  };
  localStorage.setItem('skorlab_otomatik_kolonlar', JSON.stringify(otomatikKolonlar));
  closeModal('secimModal');
  renderBulten();
  updateKuponCubugu();
  showToast('success','Sistem Kuponu', kolonlar.length + ' kolon · ' + otomatikKolonlar.tutar + ' TL');
}

/* ==================== KUPON KAYDET VE DETAY ==================== */
function kuponuKaydet(tip){
  if(tip === 'toto' && otomatikKolonlar){
    const h = kuponHesapla();
    const isSistem = otomatikKolonlar.mod === 'SİSTEM';

    let detaylar = [];
    if(isSistem){
      otomatikKolonlar.macIdler.forEach((mid, idx) => {
        const m = matchesData.find(x => x.id === mid);
        const isim = m ? `${m.home} - ${m.away}` : `#${mid}`;
        const buMacSecimler = [...new Set(otomatikKolonlar.kolonlar.map(k => k[idx]))].join('');
        detaylar.push({ id: mid, isim, secim: buMacSecimler });
      });
    }

    kayitliKuponlar.unshift({
      id: Date.now(), tip: 'toto', mod: otomatikKolonlar.mod,
      tarih: new Date().toLocaleString('tr-TR'), macSayisi: h.macSayisi,
      kolon: h.kolon, tutar: h.tutar, macIdler: otomatikKolonlar.macIdler,
      kolonlar: isSistem ? null : otomatikKolonlar.kolonlar,
      detaylar: isSistem ? detaylar : null, durum: 'bekliyor'
    });

    localStorage.setItem('skorlab_kuponlar', JSON.stringify(kayitliKuponlar));
    otomatikKolonlar = null;
    localStorage.removeItem('skorlab_otomatik_kolonlar');
    renderBulten(); updateKuponCubugu(); renderKayitliKuponlar();
    showToast('success','Kaydedildi', h.kolon + ' kolon · ' + h.tutar + ' TL');
    return;
  }

  const h = kuponHesapla();
  if(h.macSayisi === 0){ showToast('error','Seçim Yok','Maç seç.'); return; }

  const detaylar = [];
  Object.keys(secimlerim).forEach(id => {
    const sec = secimlerim[id];
    if(!sec || !sec.length) return;
    const m = matchesData.find(x => x.id == id);
    if(!m) return;
    detaylar.push({ id: parseInt(id), isim: `${m.home} - ${m.away}`, secim: sec.join('') });
  });

  kayitliKuponlar.unshift({
    id: Date.now(), tip: 'toto', mod: 'MANUEL',
    tarih: new Date().toLocaleString('tr-TR'),
    macSayisi: h.macSayisi, kolon: h.kolon, tutar: h.tutar,
    detaylar: detaylar, durum: 'bekliyor'
  });

  localStorage.setItem('skorlab_kuponlar', JSON.stringify(kayitliKuponlar));
  secimlerim = {};
  localStorage.setItem('skorlab_secimlerim', '{}');
  renderBulten(); updateKuponCubugu(); renderKayitliKuponlar();
  showToast('success','Kaydedildi', h.kolon + ' kolon · ' + h.tutar + ' TL');
}

function renderKayitliKuponlar(){
  const c = $('kayitliKuponlar');
  if(!c) return;
  if(!kayitliKuponlar.length){ c.innerHTML = '<div class="muted" style="text-align:center;padding:20px">Kayıtlı kupon yok.</div>'; return; }
  c.innerHTML = kayitliKuponlar.map(k => {
    const renk = k.durum === 'kazandi' ? 'kazandi' : k.durum === 'kaybetti' ? 'kaybetti' : 'bekliyor';
    const emoji = k.durum === 'kazandi' ? '✅' : k.durum === 'kaybetti' ? '❌' : '⏳';
    const tipIkon = k.tip === 'iddaa' ? '🔥' : '📋';
    return `
      <div class="kupon-gecmis ${renk}" onclick="kuponDetayAc(${k.id})" style="cursor:pointer;margin-bottom:8px">
        <div style="display:flex;justify-content:space-between;font-size:.75rem;margin-bottom:4px">
          <span>${emoji} ${tipIkon} <b>${k.kolon} kolon</b></span>
          <span class="muted">${k.tarih}</span>
        </div>
        <div style="font-size:.68rem;color:var(--muted)">${k.mod || ''} · ${k.macSayisi} maç ${k.toplamOran ? '· Oran: '+k.toplamOran : ''} · <b style="color:var(--green)">${k.tutar} TL</b></div>
      </div>`;
  }).join('');
}

function kuponDetayAc(id){
  const k = kayitliKuponlar.find(x => x.id === id);
  if(!k) return;
  const emoji = k.durum === 'kazandi' ? '✅' : k.durum === 'kaybetti' ? '❌' : '⏳';
  
  let icerikHTML = '';

  if(k.kolonlar && k.kolonlar.length > 0){
    icerikHTML = `<div style="font-weight:800;color:var(--blue);margin-bottom:8px">🖐️ TEKLİ İNDİRGEME (${k.kolon} Bağımsız Kolon)</div>`;
    icerikHTML += k.kolonlar.map((kolon, kIdx) => {
      const kolonOzet = kolon.map((s, mIdx) => {
        const mid = k.macIdler ? k.macIdler[mIdx] : (mIdx + 1);
        const m = matchesData.find(x => x.id === mid);
        const macEtiket = m ? `${m.home.substring(0,3)}-${m.away.substring(0,3)}` : `#${mid}`;
        return `<div style="display:inline-block;background:var(--bg3);padding:3px 6px;margin:2px;border-radius:4px;font-size:.65rem"><span style="color:var(--muted)">${macEtiket}:</span> <b style="color:var(--green)">${s}</b></div>`;
      }).join('');

      return `<div style="background:var(--bg2);border:1px solid var(--border);border-radius:8px;padding:8px;margin-bottom:8px"><div style="font-weight:900;color:var(--green);font-size:.78rem;margin-bottom:6px">📋 KOLON ${kIdx + 1}</div><div style="display:flex;flex-wrap:wrap;gap:2px">${kolonOzet}</div></div>`;
    }).join('');
  } else if(k.detaylar) {
    const baslik = k.mod === 'SİSTEM ÖNERİSİ' ? '🔥 İDDAA SİSTEM ÖNERİ KUPONU' : (k.mod === 'SİSTEM' ? '🤖 SİSTEM KUPONU' : '📝 MANUEL KUPON');
    icerikHTML = `<div style="font-weight:800;color:var(--green);margin-bottom:8px">${baslik}</div>`;
    icerikHTML += k.detaylar.map(d => `
      <div style="padding:8px 0;border-bottom:1px solid var(--border);display:flex;justify-content:space-between;align-items:center">
        <div style="font-weight:800;font-size:.75rem">${d.isim}</div>
        <div style="color:var(--green);font-weight:900;font-size:.85rem;background:var(--bg2);padding:2px 8px;border-radius:4px">${d.secim}</div>
      </div>
    `).join('');
  }

  $('kuponDetayBody').innerHTML = `
    <div style="font-size:.75rem">
      <div class="muted" style="margin-bottom:10px">${emoji} ${k.tarih} · ${k.macSayisi} maç · ${k.tutar} TL ${k.toplamOran ? '· Oran: '+k.toplamOran : ''}</div>
      <div style="max-height:400px;overflow-y:auto;background:var(--bg3);border-radius:8px;padding:10px">${icerikHTML}</div>
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
  renderKayitliKuponlar(); renderKarsilastirma();
}

function kuponSil(id){
  kayitliKuponlar = kayitliKuponlar.filter(x => x.id !== id);
  localStorage.setItem('skorlab_kuponlar', JSON.stringify(kayitliKuponlar));
  closeModal('kuponDetayModal');
  renderKayitliKuponlar(); renderKarsilastirma();
}

/* ==================== KARŞILAŞTIRMA ==================== */
function renderKarsilastirma(){
  const c = $('karsilastirmaListesi');
  if(!c) return;
  let kazanan = 0, kaybeden = 0;
  kayitliKuponlar.forEach(k => {
    if(k.durum === 'kazandi') kazanan++;
    else if(k.durum === 'kaybetti') kaybeden++;
  });
  const toplam = kazanan + kaybeden;
  if(toplam === 0){ c.innerHTML = '<div class="muted" style="text-align:center;padding:20px">Henüz sonuç girilmedi.</div>'; return; }
  const basari = Math.round(kazanan / toplam * 100);
  c.innerHTML = `
    <div class="karsilastirma-grid">
      <div class="karsilastirma-taraf kazanan"><div class="lbl">✅ KAZANAN</div><div class="skor" style="color:var(--green)">${kazanan}</div></div>
      <div class="karsilastirma-taraf"><div class="lbl">❌ KAYBEDEN</div><div class="skor" style="color:var(--red)">${kaybeden}</div></div>
    </div>
    <div class="karsilastirma-mesaj ${basari>=50?'sen-kazandin':'sistem-kazandi'}" style="margin-top:12px">Başarı: %${basari}</div>`;
}

/* ==================== MAÇ DETAY ==================== */
function macDetayGoster(id){
  const m = matchesData.find(x => x.id === id);
  if(!m) return;
  const od = oddsData[id];
  if(!od || !od['1']){ showToast('error','Oran Yok','Oran gir.'); return; }
  const a = macAnalizEt(id, od['1'], od['X'], od['2']);
  const sec = secimlerim[id] || [];

  $('macDetayTitle').innerText = '📊 MAÇ #' + id;
  $('macDetayBody').innerHTML = `
    <div style="font-size:.8rem;line-height:1.8">
      <div style="text-align:center;margin-bottom:14px">
        <div style="font-weight:900">${m.home} - ${m.away}</div>
        <div style="color:var(--muted);font-size:.7rem;margin-top:4px">${m.date}${m.league?' · '+m.league:''}</div>
        <div style="margin-top:8px"><span class="badge ${a.band.seviye<=2?'green':a.band.seviye===3?'yellow':a.band.seviye===4?'orange':'red'}">${a.band.etiket}</span></div>
      </div>
      <div class="analiz-box">
        <div class="analiz-row"><span class="analiz-lbl">🎯 HİBRİT</span></div>
        <div class="analiz-row"><span>1: <b class="green">%${a.p1.toFixed(1)}</b></span><span>X: <b class="green">%${a.pX.toFixed(1)}</b></span><span>2: <b class="green">%${a.p2.toFixed(1)}</b></span></div>
      </div>
      <div class="analiz-box">
        <div class="analiz-row"><span class="analiz-lbl">⚽ GOL TAHMİNLERİ</span></div>
        <div class="analiz-row"><span>2.5 Üst: <b class="green">%${a.ust25.toFixed(1)}</b></span><span>KG Var: <b class="green">%${a.kg.toFixed(1)}</b></span></div>
      </div>
    </div>`;
  $('macDetayModal').classList.add('active');
}

/* ==================== NAVİGASYON & BİLDİRİM ==================== */
function switchTab(i, el){
  document.querySelectorAll('.tab, .page').forEach(e => e.classList.remove('active'));
  if(el) el.classList.add('active');
  $('page-'+i).classList.add('active');
  if(i === 4) renderKarsilastirma();
}

function closeModal(id){ $(id).classList.remove('active'); }
function showToast(type, title, msg){
  $('toastIcon').innerText = type==='success' ? '✅' : '❌';$('toastTitle').innerText = title;
  $('toastMsg').innerText = msg;
  $('toastModal').classList.add('active');
}

if('serviceWorker' in navigator){
  window.addEventListener('load', () => { navigator.serviceWorker.register('sw.js').catch(() => {}); });
}

window.onload = function(){
  const bi = $('butceInput'); if(bi) bi.value = butce;
  loadData();
};
