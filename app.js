/* ============================================================
   SKORLAB v17 PRO · Toto + İddaa + Pro Analiz
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

/* ==================== POISSON ==================== */
function poissonPmf(k, lambda){
  let p = Math.exp(-lambda);
  for(let i = 1; i <= k; i++) p *= lambda / i;
  return p;
}

function poissonMatris(xgEv, xgDep){
  const MAX = 6;
  let p1=0, pX=0, p2=0;
  const skorlar = {};
  for(let h=0; h<MAX; h++){
    for(let a=0; a<MAX; a++){
      const p = poissonPmf(h, xgEv) * poissonPmf(a, xgDep);
      skorlar[h+'-'+a] = p;
      if(h>a) p1 += p; else if(h===a) pX += p; else p2 += p;
    }
  }
  return { p1:p1*100, pX:pX*100, p2:p2*100, skorlar };
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
    sirali, enYuksek:sirali[0], ikinci:sirali[1], ucuncu:sirali[2],
    oranlar, favOran,
    band: oranBandi(favOran)
  };
}

function butceGuncelle(val){
  butce = parseFloat(val) || 100;
  localStorage.setItem('skorlab_butce', butce);
  updateKuponCubugu();
  if($('kcMacS')) updateKuponCubuguSerbest();
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

/* ==================== SEÇİM TOGGLE ==================== */
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

function serbestSecimToggle(id, secim){
  let sec = serbestSecimlerim[id] || [];
  if(sec.includes(secim)) sec = sec.filter(s => s !== secim);
  else sec.push(secim);
  if(sec.length === 0) delete serbestSecimlerim[id];
  else serbestSecimlerim[id] = sec;
  localStorage.setItem('skorlab_serbest_secimlerim', JSON.stringify(serbestSecimlerim));
  renderSerbest();
  updateKuponCubuguSerbest();
}

function tumSecimleriSil(){
  if(!confirm('Tüm seçimler silinsin mi?')) return;
  secimlerim = {};
  otomatikKolonlar = null;
  localStorage.setItem('skorlab_secimlerim', '{}');
  localStorage.removeItem('skorlab_otomatik_kolonlar');
  renderBulten();
  updateKuponCubugu();
}

function serbestSecimleriSil(){
  if(!confirm('Tüm serbest seçimler silinsin mi?')) return;
  serbestSecimlerim = {};
  localStorage.setItem('skorlab_serbest_secimlerim', '{}');
  renderSerbest();
  updateKuponCubuguSerbest();
}

/* ==================== SERBEST ==================== */
function renderSerbest(){
  const c = $('serbestListesi');
  if(!c) return;

  if(!serbestData.length){
    c.innerHTML = '<div class="card"><div class="muted" style="text-align:center;padding:20px">Henüz serbest maç eklemedin.<br><br>"➕ Maç Ekle" ile başla.</div></div>';
    const cc = $('kuponCubuguSerbest');
    if(cc) cc.style.display = 'none';
    return;
  }

  c.innerHTML = serbestData.map((m, idx) => {
    const a = macAnalizEt(m.id, m.o1, m.oX, m.o2);
    const sec = serbestSecimlerim[m.id] || [];
    const p1 = a ? a.p1 : 0, pX = a ? a.pX : 0, p2 = a ? a.p2 : 0;
    let secimOzet = sec.length === 1 ? sec[0] : (sec.length === 2 ? sec.join('') : (sec.length === 3 ? 'KAPALI' : ''));
    let bandTag = a ? `<span class="badge ${a.band.seviye<=2?'green':a.band.seviye===3?'yellow':a.band.seviye===4?'orange':'red'}">${a.band.etiket}</span>` : '';

    return `
    <div class="sade-mac">
      <div class="sade-mac-head">
        <span class="sade-mac-no">İDDAA ${idx+1}</span>
        <div style="display:flex;gap:4px;align-items:center">
          <span class="sade-mac-tarih">${secimOzet?'<b style="color:var(--green)">'+secimOzet+'</b>':''}</span>
          <button class="sm-duzenle-btn" onclick="openSerbestDuzenle(${idx})" title="Düzenle">✏️</button>
          <button onclick="serbestSil(${idx})" style="background:none;border:none;color:var(--red);cursor:pointer;font-size:1rem;padding:4px 8px">🗑️</button>
        </div>
      </div>
      <div class="sade-mac-teams" onclick="macDetayGosterSerbest(${m.id})">${m.mac} ${bandTag}</div>
      <div class="sade-mac-tahminler">
        <button class="sade-btn ${sec.includes('1')?'secili':''}" onclick="serbestSecimToggle(${m.id},'1')"><span class="kod">1</span><span class="yuzde">%${p1.toFixed(1)}</span></button>
        <button class="sade-btn ${sec.includes('X')?'secili':''}" onclick="serbestSecimToggle(${m.id},'X')"><span class="kod">X</span><span class="yuzde">%${pX.toFixed(1)}</span></button>
        <button class="sade-btn ${sec.includes('2')?'secili':''}" onclick="serbestSecimToggle(${m.id},'2')"><span class="kod">2</span><span class="yuzde">%${p2.toFixed(1)}</span></button>
      </div>
    </div>`;
  }).join('');

  const cc = $('kuponCubuguSerbest');
  if(cc) cc.style.display = 'flex';
  updateKuponCubuguSerbest();
}

function serbestSil(idx){
  const m = serbestData[idx];
  if(!m) return;
  if(!confirm(`"${m.mac}" silinsin mi?`)) return;

  delete serbestSecimlerim[m.id];
  localStorage.setItem('skorlab_serbest_secimlerim', JSON.stringify(serbestSecimlerim));

  serbestData.splice(idx, 1);
  localStorage.setItem('skorlab_serbest', JSON.stringify(serbestData));

  renderSerbest();
  showToast('success','Silindi', m.mac);
}

function temizleSerbest(){
  if(!confirm('Tümü silinsin mi?')) return;
  serbestData = []; serbestSecimlerim = {};
  localStorage.removeItem('skorlab_serbest');
  localStorage.removeItem('skorlab_serbest_secimlerim');
  renderSerbest();
}

/* ==================== PRO ANALİZ MODAL ==================== */
function openSerbestModal(){
  duzenlenenSerbestId = null;
  ['sm-match','sm-o1','sm-oX','sm-o2'].forEach(id => {
    const el = $(id);
    if(el){ el.value = ''; el.classList.remove('hata'); }
  });
  const t = $('serbestModalTitle'); if(t) t.innerText = '➕ SERBEST MAÇ EKLE';
  const b = $('sm-kaydet-btn'); if(b) b.innerText = '✅ EKLE';
  const m = $('serbestModal'); if(m) m.classList.remove('duzenleme');
  const k = $('sm-canli-analiz'); if(k) k.style.display = 'none';
  if(m) m.classList.add('active');
}

function openSerbestDuzenle(idx){
  const m = serbestData[idx];
  if(!m) return;
  duzenlenenSerbestId = m.id;
  $('sm-match').value = m.mac || '';
  $('sm-o1').value = m.o1 || '';
  $('sm-oX').value = m.oX || '';
  $('sm-o2').value = m.o2 || '';
  const t = $('serbestModalTitle'); if(t) t.innerText = '✏️ SERBEST MAÇ DÜZENLE';
  const b = $('sm-kaydet-btn'); if(b) b.innerText = '💾 GÜNCELLE';
  const mo = $('serbestModal'); if(mo){ mo.classList.add('duzenleme'); mo.classList.add('active'); }
  serbestCanliAnaliz();
}

function serbestKaydet(){
  ['sm-match','sm-o1','sm-oX','sm-o2'].forEach(id => {
    const el = $(id); if(el) el.classList.remove('hata');
  });

  const mac = $('sm-match').value.trim();
  const o1 = parseFloat($('sm-o1').value);
  const oX = parseFloat($('sm-oX').value);
  const o2 = parseFloat($('sm-o2').value);

  let hata = false;
  if(!mac || mac.length < 3){ $('sm-match').classList.add('hata'); hata = true; }
  const ok = (o) => !isNaN(o) && o >= 1.01 && o <= 100;
  if(!ok(o1)){ $('sm-o1').classList.add('hata'); hata = true; }
  if(!ok(oX)){ $('sm-oX').classList.add('hata'); hata = true; }
  if(!ok(o2)){ $('sm-o2').classList.add('hata'); hata = true; }

  if(hata){
    showToast('error','Geçersiz Veri','Maç adı min 3 karakter, oranlar 1.01 - 100 arası.');
    return;
  }

  if(duzenlenenSerbestId){
    const idx = serbestData.findIndex(x => x.id === duzenlenenSerbestId);
    if(idx === -1){ showToast('error','Hata','Maç bulunamadı.'); return; }
    serbestData[idx].mac = mac;
    serbestData[idx].o1 = o1;
    serbestData[idx].oX = oX;
    serbestData[idx].o2 = o2;
    localStorage.setItem('skorlab_serbest', JSON.stringify(serbestData));
    duzenlenenSerbestId = null;
    closeModal('serbestModal');
    renderSerbest();
    showToast('success','Güncellendi', mac);
  } else {
    const yeni = { id: Date.now(), mac, o1, oX, o2, tarih: new Date().toLocaleString('tr-TR') };
    serbestData.unshift(yeni);
    localStorage.setItem('skorlab_serbest', JSON.stringify(serbestData));
    closeModal('serbestModal');
    renderSerbest();
    showToast('success','Maç Eklendi!', mac);
  }
}

/* ============================================================
   CANLI PRO ANALİZ (7 Katman)
   ============================================================ */
function serbestCanliAnaliz(){
  const o1 = parseFloat($('sm-o1').value);
  const oX = parseFloat($('sm-oX').value);
  const o2 = parseFloat($('sm-o2').value);

  const kutu = $('sm-canli-analiz');
  if(!kutu) return;

  const ok = (o) => !isNaN(o) && o >= 1.01 && o <= 100;
  if(!ok(o1) || !ok(oX) || !ok(o2)){
    kutu.style.display = 'none';
    return;
  }

  kutu.style.display = 'block';

  /* 1. HAM */
  const r1 = 1/o1, rX = 1/oX, r2 = 1/o2;
  const toplam = r1 + rX + r2;
  const ham1 = (r1/toplam)*100;
  const hamX = (rX/toplam)*100;
  const ham2 = (r2/toplam)*100;
  const marj = (toplam - 1) * 100;

  $('sm-ham-1').innerText = '%' + ham1.toFixed(1);
  $('sm-ham-X').innerText = '%' + hamX.toFixed(1);
  $('sm-ham-2').innerText = '%' + ham2.toFixed(1);
  $('sm-marj').innerText = '%' + marj.toFixed(2);

  /* 2. SHIN */
  const shinSonuc = shinMarjArindir(o1, oX, o2);
  $('sm-shin-1').innerText = '%' + (shinSonuc.p1*100).toFixed(1);
  $('sm-shin-X').innerText = '%' + (shinSonuc.pX*100).toFixed(1);
  $('sm-shin-2').innerText = '%' + (shinSonuc.p2*100).toFixed(1);
  $('sm-shin-toplam').innerText = '%' + ((shinSonuc.p1+shinSonuc.pX+shinSonuc.p2)*100).toFixed(1);

  /* 3. POISSON */
  const xg = xgOranlardan(shinSonuc.p1, shinSonuc.pX, shinSonuc.p2);
  const poi = poissonTamMatris(xg.xgEv, xg.xgDep);

  $('sm-xg').innerText = xg.xgEv.toFixed(2) + ' - ' + xg.xgDep.toFixed(2);
  $('sm-poi-1').innerText = '%' + poi.p1.toFixed(1);
  $('sm-poi-X').innerText = '%' + poi.pX.toFixed(1);
  $('sm-poi-2').innerText = '%' + poi.p2.toFixed(1);
  $('sm-poi-ust25').innerText = '%' + poi.ust25.toFixed(1);
  $('sm-poi-kg').innerText = '%' + poi.kg.toFixed(1);

  /* 4. DIXON-COLES */
  const dc = dixonColes(xg.xgEv, xg.xgDep);
  const dcSirali = Object.entries(dc.skorlar).sort((a,b) => b[1]-a[1]).slice(0,5);
  $('sm-dc-skorlar').innerHTML = dcSirali.map(([k,v]) =>
    `<div class="dc-satir"><span>${k.replace('-',' - ')}</span><b>%${(v*100).toFixed(2)}</b></div>`
  ).join('');

  /* 5. MONTE CARLO */
  const mc = monteCarlo(xg.xgEv, xg.xgDep, 10000);
  $('sm-mc-1').innerText = '\%' + (mc.p1*100).toFixed(1);$('sm-mc-X').innerText = '%' + (mc.pX*100).toFixed(1);
  $('sm-mc-2').innerText = '\%' + (mc.p2*100).toFixed(1);$('sm-mc-ci').innerText = '±%' + mc.margin.toFixed(2);

  /* 6. KELLY */
  const secenekler = [
    { kod:'1', olas:shinSonuc.p1, oran:o1 },
    { kod:'X', olas:shinSonuc.pX, oran:oX },
    { kod:'2', olas:shinSonuc.p2, oran:o2 }
  ].sort((a,b) => b.olas - a.olas);

  const fav = secenekler[0];
  const ev = fav.olas * fav.oran;
  const kellyF = (fav.olas * fav.oran - 1) / (fav.oran - 1);
  const kellyOneri = Math.max(0, kellyF * 0.5) * 100;

  $('sm-kelly-fav').innerText = `${fav.kod} (%${(fav.olas*100).toFixed(1)}) @ ${fav.oran.toFixed(2)}`;
  $('sm-kelly-ev').innerText = ev.toFixed(3);$('sm-kelly-ev').style.color = ev > 1.05 ? 'var(--green)' : ev > 1.0 ? 'var(--orange)' : 'var(--red)';

  if(ev > 1.05){
    $('sm-kelly-oneri').innerText = `💎 DEĞERLİ (Kelly: %${kellyOneri.toFixed(1)})`;
    $('sm-kelly-oneri').style.color = 'var(--green)';
  } else if(kellyOneri > 0){
    $('sm-kelly-oneri').innerText = `Normal (Kelly: %${kellyOneri.toFixed(1)})`;
    $('sm-kelly-oneri').style.color = 'var(--muted)';
  } else {
    $('sm-kelly-oneri').innerText = '❌ Değer Yok';
    $('sm-kelly-oneri').style.color = 'var(--red)';
  }

  const hedgeToplam = (1/o1) + (1/oX) + (1/o2);
  if(hedgeToplam < 0.98){
    $('sm-hedge').innerText = '💎 ARBITRAJ VAR!';
    $('sm-hedge').style.color = 'var(--green)';
  } else {
    $('sm-hedge').innerText = 'Yok (Marj var)';$('sm-hedge').style.color = 'var(--muted)';
  }

  /* 7. RİSK */
  const ent = -(shinSonuc.p1*Math.log2(shinSonuc.p1) + shinSonuc.pX*Math.log2(shinSonuc.pX) + shinSonuc.p2*Math.log2(shinSonuc.p2)) / Math.log2(3);
  const upset = secenekler[2].olas;
  const vol = 1 - secenekler[0].olas;

  $('sm-entropy').innerText = ent.toFixed(3) + (ent > 0.9 ? ' (Yüksek)' : ent > 0.7 ? ' (Orta)' : ' (Düşük)');
  $('sm-upset').innerText = '\%' + (upset*100).toFixed(1);$('sm-vol').innerText = '%' + (vol*100).toFixed(1);

  let riskKategori = '';
  if(ent > 0.85) riskKategori = '🔴 YÜKSEK';
  else if(ent > 0.6) riskKategori = '🟡 ORTA';
  else riskKategori = '🟢 DÜŞÜK';
  $('sm-risk').innerText = riskKategori;

  /* 8. KONSENSÜS */
  const oy1 = [shinSonuc.p1, poi.p1/100, mc.p1, fav.olas].filter(x => x > 0.45).length;
  const oyX = [shinSonuc.pX, poi.pX/100, mc.pX].filter(x => x > 0.3).length;
  const oy2 = [shinSonuc.p2, poi.p2/100, mc.p2].filter(x => x > 0.35).length;
  const maxOy = Math.max(oy1, oyX, oy2);

  let konsensusYon = '';
  if(maxOy === oy1 && oy1 >= 3) konsensusYon = `${fav.kod} (Favori)`;
  else if(maxOy === oyX && oyX >= 2) konsensusYon = 'X (Beraberlik)';
  else if(maxOy === oy2 && oy2 >= 2) konsensusYon = '2 (Deplasman)';
  else konsensusYon = 'Belirsiz';

  $('sm-konsensus').innerText = konsensusYon;
  $('sm-konsensus-skor').innerText = `${maxOy}/4 katman aynı yönde`;
}

/* ============================================================
   MATEMATİKSEL MODELLER
   ============================================================ */
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

function poissonTamMatris(xgEv, xgDep){
  const MAX = 8;
  let p1=0, pX=0, p2=0, kg=0, ust25=0, ust15=0, ust35=0;
  const skorlar = {};

  function pmf(k, l){
    let p = Math.exp(-l);
    for(let i = 1; i <= k; i++) p *= l / i;
    return p;
  }

  for(let h = 0; h < MAX; h++){
    for(let a = 0; a < MAX; a++){
      const p = pmf(h, xgEv) * pmf(a, xgDep);
      skorlar[h+'-'+a] = p;
      if(h > a) p1 += p;
      else if(h === a) pX += p;
      else p2 += p;
      if(h >= 1 && a >= 1) kg += p;
      if(h + a > 2.5) ust25 += p;
      if(h + a > 1.5) ust15 += p;
      if(h + a > 3.5) ust35 += p;
    }
  }

  return {
    p1: p1*100, pX: pX*100, p2: p2*100,
    kg: kg*100, ust25: ust25*100, ust15: ust15*100, ust35: ust35*100,
    skorlar
  };
}

function dixonColes(xgEv, xgDep, rho){
  rho = rho || -0.13;
  const MAX = 6;
  const skorlar = {};
  let toplam = 0;

  function pmf(k, l){
    let p = Math.exp(-l);
    for(let i = 1; i <= k; i++) p *= l / i;
    return p;
  }

  function tau(h, a){
    if(h === 0 && a === 0) return 1 - xgEv * xgDep * rho;
    if(h === 0 && a === 1) return 1 + xgEv * rho;
    if(h === 1 && a === 0) return 1 + xgDep * rho;
    if(h === 1 && a === 1) return 1 - rho;
    return 1;
  }

  for(let h = 0; h < MAX; h++){
    for(let a = 0; a < MAX; a++){
      const p = pmf(h, xgEv) * pmf(a, xgDep) * tau(h, a);
      skorlar[h+'-'+a] = p;
      toplam += p;
    }
  }

  Object.keys(skorlar).forEach(k => { skorlar[k] /= toplam; });
  return { skorlar };
}

function monteCarlo(xgEv, xgDep, n){
  n = n || 10000;
  function poissonRnd(lambda){
    let L = Math.exp(-lambda), k = 0, p = 1;
    do { k++; p *= Math.random(); } while(p > L);
    return k - 1;
  }

  let s1 = 0, sX = 0, s2 = 0;
  for(let i = 0; i < n; i++){
    const h = poissonRnd(xgEv);
    const a = poissonRnd(xgDep);
    if(h > a) s1++;
    else if(h === a) sX++;
    else s2++;
  }

  const p1 = s1 / n, pX = sX / n, p2 = s2 / n;
  const margin = 1.96 * Math.sqrt(p1 * (1 - p1) / n);
  return { p1, pX, p2, margin: margin * 100 };
}

/* ==================== KUPON ÇUBUĞU ==================== */
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

function kuponHesaplaSerbest(){
  let macSayisi = 0, kolon = 1;
  Object.keys(serbestSecimlerim).forEach(id => {
    const sec = serbestSecimlerim[id];
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
  const sS = $('statSecilen'); if(sS) sS.innerText = h.macSayisi;
  const sK = $('statKolon'); if(sK) sK.innerText = h.kolon;
}

function updateKuponCubuguSerbest(){
  const h = kuponHesaplaSerbest();
  const kcM = $('kcMacS'); if(kcM) kcM.innerText = h.macSayisi;
  const kcK = $('kcKolonS'); if(kcK) kcK.innerText = h.kolon;
  const kcT = $('kcTutarS'); if(kcT) kcT.innerText = h.tutar + ' TL';
}

function updateStats(){
  const sM = $('statMac'); if(sM) sM.innerText = matchesData.length;
  let deger = 0;
  matchesData.forEach(m => {
    const od = oddsData[m.id];
    if(!od || !od['1']) return;
    const a = macAnalizEt(m.id, od['1'], od['X'], od['2']);
    if(!a) return;
    ['1','X','2'].forEach(s => {
      const oran = parseFloat(a.oranlar[s]);
      const olas = s==='1'?a.p1:s==='X'?a.pX:a.p2;
      if((olas/100)*oran > 1.12) deger++;
    });
  });
  const sD = $('statDeger'); if(sD) sD.innerText = deger;
}

/* ==================== OTOMATİK KUPON ==================== */
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

/* --- DÜZELTİLEN TEKLİ KUPON İNDİRGEME --- */
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

  if(!maclar.length){ showToast('error','Hata','Maç bulunamadı.'); return; }

  // Kartezyen kombinasyon havuzu üret
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

  // Max kolon kadar homojen/örneklem seç
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
      } else {
        for(let j = 0; j < kombinasyonlar.length; j++){
          if(!kullanilanlar.has(j)){
            kullanilanlar.add(j);
            secilenKolonlar.push(kombinasyonlar[j]);
            break;
          }
        }
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

/* --- DÜZELTİLEN SİSTEM KUPONU SIKIŞTIRMA/HESAPLAMA --- */
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

    const guvenlikSkoru = a ? a.band.seviye : 3;

    maclar.push({
      m, a,
      secimler: mevcutSecim,
      guvenlikSkoru: guvenlikSkoru
    });
  });

  if(!maclar.length){ showToast('error','Hata','Maç bulunamadı.'); return; }

  // 1. Seçimlerin toplam kolon adedi
  let toplamKolon = maclar.reduce((t, mc) => t * mc.secimler.length, 1);

  // 2. Bütçe aşıldıysa bankolardan başlayarak çifte/üçlü seçimleri düşür
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

  // 3. Bütçe artıyorsa riski yüksek maçlara bütçeyi dolduracak şekilde opsiyon ekle
  if(toplamKolon < maxKolon){
    const riskliIndeksler = [...maclar.keys()].sort((i, j) => maclar[j].guvenlikSkoru - maclar[i].guvenlikSkoru);

    for(const idx of riskliIndeksler){
      const mc = maclar[idx];
      const tumAdaylar = mc.a ? mc.a.sirali.map(s => s.kod) : ['1', 'X', '2'];

      for(const opt of tumAdaylar){
        if(!mc.secimler.includes(opt)){
          const yeniSecim = [...mc.secimler, opt];
          const yeniToplam = (toplamKolon / mc.secimler.length) * yeniSecim.length;
          if(yeniToplam <= maxKolon){
            mc.secimler = yeniSecim;
            toplamKolon = yeniToplam;
          }
        }
      }
      if(toplamKolon === maxKolon) break;
    }
  }

  // 4. Kartezyen Sistem Kolonları Oluştur
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

/* ==================== KUPON KAYDET ==================== */
function kuponuKaydet(tip){
  if(tip === 'toto' && otomatikKolonlar){
    const h = kuponHesapla();
    const detaylar = otomatikKolonlar.macIdler.map((mid, idx) => {
      const m = matchesData.find(x => x.id === mid);
      const secimler = [...new Set(otomatikKolonlar.kolonlar.map(k => k[idx]))];
      return {
        id: mid,
        isim: m ? (m.home + ' - ' + m.away) : 'Maç #' + mid,
        secim: secimler.join(''), secimler: secimler
      };
    });

    kayitliKuponlar.unshift({
      id: Date.now(), tip: 'toto', mod: otomatikKolonlar.mod,
      tarih: new Date().toLocaleString('tr-TR'),
      macSayisi: h.macSayisi, kolon: h.kolon, tutar: h.tutar,
      detaylar: detaylar, durum: 'bekliyor'
    });
    if(kayitliKuponlar.length > 50) kayitliKuponlar = kayitliKuponlar.slice(0, 50);
    localStorage.setItem('skorlab_kuponlar', JSON.stringify(kayitliKuponlar));

    otomatikKolonlar = null;
    localStorage.removeItem('skorlab_otomatik_kolonlar');
    renderBulten();
    updateKuponCubugu();
    renderKayitliKuponlar();
    showToast('success','Kaydedildi', h.kolon + ' kolon · ' + h.tutar + ' TL');
    return;
  }

  const h = tip === 'iddaa' ? kuponHesaplaSerbest() : kuponHesapla();
  const kaynak = tip === 'iddaa' ? serbestSecimlerim : secimlerim;

  if(h.macSayisi === 0){ showToast('error','Seçim Yok','Maç seç.'); return; }

  const detaylar = [];
  Object.keys(kaynak).forEach(id => {
    const sec = kaynak[id];
    if(!sec || !sec.length) return;
    let m, isim;
    if(tip === 'iddaa'){
      m = serbestData.find(x => x.id == id);
      isim = m ? m.mac : '';
    } else {
      m = matchesData.find(x => x.id == id);
      isim = m ? (m.home + ' - ' + m.away) : '';
    }
    if(!isim) return;
    detaylar.push({ id: parseInt(id), isim, secim: sec.join(''), secimler: sec });
  });

  kayitliKuponlar.unshift({
    id: Date.now(), tip: tip, mod: 'MANUEL',
    tarih: new Date().toLocaleString('tr-TR'),
    macSayisi: h.macSayisi, kolon: h.kolon, tutar: h.tutar,
    detaylar: detaylar, durum: 'bekliyor'
  });
  if(kayitliKuponlar.length > 50) kayitliKuponlar = kayitliKuponlar.slice(0, 50);
  localStorage.setItem('skorlab_kuponlar', JSON.stringify(kayitliKuponlar));

  if(tip === 'iddaa'){
    serbestSecimlerim = {};
    localStorage.setItem('skorlab_serbest_secimlerim', '{}');
    renderSerbest();
    updateKuponCubuguSerbest();
  } else {
    secimlerim = {};
    localStorage.setItem('skorlab_secimlerim', '{}');
    renderBulten();
    updateKuponCubugu();
  }

  renderKayitliKuponlar();
  showToast('success','Kaydedildi', h.kolon + ' kolon · ' + h.tutar + ' TL');
}

/* ==================== KUPONLARIM ==================== */
function renderKayitliKuponlar(){
  const c = $('kayitliKuponlar');
  if(!c) return;
  if(!kayitliKuponlar.length){ c.innerHTML = '<div class="muted" style="text-align:center;padding:20px">Kayıtlı kupon yok.</div>'; return; }
  c.innerHTML = kayitliKuponlar.map(k => {
    const renk = k.durum === 'kazandi' ? 'kazandi' : k.durum === 'kaybetti' ? 'kaybetti' : 'bekliyor';
    const emoji = k.durum === 'kazandi' ? '✅' : k.durum === 'kaybetti' ? '❌' : '⏳';
    const tipIkon = k.tip === 'iddaa' ? '🎯' : '📋';
    return `
      <div class="kupon-gecmis ${renk}" onclick="kuponDetayAc(${k.id})" style="cursor:pointer">
        <div style="display:flex;justify-content:space-between;font-size:.75rem;margin-bottom:4px">
          <span>${emoji} ${tipIkon} <b>${k.kolon} kolon</b></span>
          <span class="muted">${k.tarih}</span>
        </div>
        <div style="font-size:.68rem;color:var(--muted)">${k.mod || ''} · ${k.macSayisi} maç · <b style="color:var(--green)">${k.tutar} TL</b></div>
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
        ${k.detaylar.map(d => `
          <div style="padding:8px 0;border-bottom:1px solid var(--border)">
            <div style="font-weight:800;margin-bottom:4px">${d.isim}</div>
            <div style="color:var(--green);font-weight:900;text-align:right">${d.secim}</div>
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
  detayOrtak(id, m.home+' - '+m.away, m.date, m.league, od['1'], od['X'], od['2'], 'toto');
}

function macDetayGosterSerbest(id){
  const m = serbestData.find(x => x.id === id);
  if(!m) return;
  detayOrtak(id, m.mac, '', '', m.o1, m.oX, m.o2, 'iddaa');
}

function detayOrtak(id, isim, tarih, league, o1, oX, o2, tip){
  const a = macAnalizEt(id, o1, oX, o2);
  const sec = tip === 'iddaa' ? (serbestSecimlerim[id] || []) : (secimlerim[id] || []);
  const skorSirali = Object.entries(a.skorlar).sort((x,y) => y[1]-x[1]).slice(0,5);
  const skorHTML = skorSirali.map(([k,v]) => `<div style="display:flex;justify-content:space-between;font-size:.72rem;padding:2px 0"><span>${k}</span><span class="green">%${(v*100).toFixed(2)}</span></div>`).join('');

  $('macDetayTitle').innerText = '📊 ' + (tip==='iddaa'?'İDDAA':'MAÇ #'+id);
  $('macDetayBody').innerHTML = `
    <div style="font-size:.8rem;line-height:1.8">
      <div style="text-align:center;margin-bottom:14px">
        <div style="font-weight:900">${isim}</div>
        <div style="color:var(--muted);font-size:.7rem;margin-top:4px">${tarih}${league?' · '+league:''}</div>
        <div style="margin-top:8px"><span class="badge ${a.band.seviye<=2?'green':a.band.seviye===3?'yellow':a.band.seviye===4?'orange':'red'}">${a.band.etiket}</span></div>
      </div>
      <div class="analiz-box">
        <div class="analiz-row"><span class="analiz-lbl">📊 ORANLAR</span></div>
        <div class="analiz-row"><span>1: <b>${o1}</b></span><span>X: <b>${oX}</b></span><span>2: <b>${o2}</b></span></div>
      </div>
      <div class="analiz-box">
        <div class="analiz-row"><span class="analiz-lbl">🎯 HİBRİT</span></div>
        <div class="analiz-row"><span>1: <b class="green">%${a.p1.toFixed(1)}</b></span><span>X: <b class="green">%${a.pX.toFixed(1)}</b></span><span>2: <b class="green">%${a.p2.toFixed(1)}</b></span></div>
      </div>
      <div class="analiz-box">
        <div class="analiz-row"><span class="analiz-lbl">⚽ POISSON SKOR</span></div>
        <div class="analiz-row"><span class="muted">xG: ${a.xgEv.toFixed(2)} - ${a.xgDep.toFixed(2)}</span></div>
        ${skorHTML}
      </div>
      <div style="margin-top:16px;padding:12px;background:var(--bg3);border-radius:10px">
        <div style="font-weight:900;color:var(--green);font-size:.8rem;margin-bottom:10px">🖐️ SENİN SEÇİMİN</div>
        <div class="sade-mac-tahminler">
          <button class="sade-btn ${sec.includes('1')?'secili':''}" onclick="detayToggle('${tip}',${id},'1')">1</button>
          <button class="sade-btn ${sec.includes('X')?'secili':''}" onclick="detayToggle('${tip}',${id},'X')">X</button>
          <button class="sade-btn ${sec.includes('2')?'secili':''}" onclick="detayToggle('${tip}',${id},'2')">2</button>
        </div>
      </div>
    </div>`;
  $('macDetayModal').classList.add('active');
}

function detayToggle(tip, id, secim){
  if(tip === 'iddaa'){ serbestSecimToggle(id, secim); macDetayGosterSerbest(id); }
  else { secimToggle(id, secim); macDetayGoster(id); }
}

/* ==================== NAV ==================== */
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
