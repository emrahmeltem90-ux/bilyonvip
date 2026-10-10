/* ============================================================
   SKORLAB v22 PRO · ValueBet + Monte Carlo + Gol Filtresi (İddaa)
   ============================================================ */

/* ============================================================
   1. VALUE BET ENGINE
   ============================================================ */
class ValueBetEngine {
  static faktoriyel(n){ let r=1; for(let i=2;i<=n;i++) r*=i; return r; }
  static poissonPmf(k,lambda){ return (Math.exp(-lambda)*Math.pow(lambda,k))/this.faktoriyel(k); }

  static shinMarjArindir(o1,oX,o2){
    const p1=1/o1, pX=1/oX, p2=1/o2;
    const S = p1+pX+p2;
    if(S<=1 || isNaN(S)) return {p1:0.33,pX:0.33,p2:0.34,marjYuzde:0};
    const f = p => {
      const num = Math.sqrt(S*S + 4*(1-S)*Math.pow(p/S,2)) - S;
      const den = 2*(1-S);
      return num/den;
    };
    const a=f(p1), b=f(pX), c=f(p2);
    const t = a+b+c;
    return { p1:a/t, pX:b/t, p2:c/t, marjYuzde:(S-1)*100 };
  }

  static ikiliMarjArindir(oA,oB){
    if(!oA || !oB || oA<=1 || oB<=1) return null;
    const pA=1/oA, pB=1/oB;
    const S = pA+pB;
    return {
      pA_gercek: pA/S, pB_gercek: pB/S,
      oA_temiz: oA/S, oB_temiz: oB/S,
      marjYuzde: (S-1)*100
    };
  }

  static xgTahminEt(p1,pX,p2){
    const hs = p1/(p1+p2 || 1);
    const tg = 2.4 + (1-pX)*0.8;
    return {
      xgEv: Math.max(0.3, tg*hs*1.15),
      xgDep: Math.max(0.3, tg*(1-hs))
    };
  }

  static dixonColesMatris(xgEv,xgDep,rho=-0.13){
    const MAX=8;
    let p1=0,pX=0,p2=0,kg=0,ust25=0;
    for(let h=0;h<=MAX;h++){
      for(let a=0;a<=MAX;a++){
        let p = this.poissonPmf(h,xgEv)*this.poissonPmf(a,xgDep);
        let tau = 1.0;
        if(h===0&&a===0) tau = 1 - xgEv*xgDep*rho;
        else if(h===1&&a===0) tau = 1 + xgDep*rho;
        else if(h===0&&a===1) tau = 1 + xgEv*rho;
        else if(h===1&&a===1) tau = 1 - rho;
        p *= tau;
        if(h>a) p1+=p; else if(h===a) pX+=p; else p2+=p;
        if(h+a>2.5) ust25+=p;
        if(h>=1&&a>=1) kg+=p;
      }
    }
    const t = p1+pX+p2;
    p1/=t; pX/=t; p2/=t; ust25/=t; kg/=t;
    return {
      p1,pX,p2,
      pUst25: Math.min(0.99, Math.max(0.01, ust25)),
      pAlt25: Math.min(0.99, Math.max(0.01, 1-ust25)),
      pKgVar: Math.min(0.99, Math.max(0.01, kg)),
      pKgYok: Math.min(0.99, Math.max(0.01, 1-kg))
    };
  }

  static kellyHesapla(p,o,kesir=0.25){
    const b = o-1;
    const f = (p*o - 1)/b;
    if(f<=0) return 0;
    return Math.min(f*kesir*100, 5.0);
  }

  /* === YENİ: GOLLÜ MAÇ TESPİTİ === */
  static golluMacAnaliz(poisson, xgEv, xgDep){
    const toplamXg = xgEv + xgDep;
    const pUst25 = poisson.pUst25 * 100;
    const pKgVar = poisson.pKgVar * 100;
    const pBeraberlik = poisson.pX * 100;

    let puan = 0;
    const kriterler = [];

    if(toplamXg > 3.0){ puan++; kriterler.push('xG>3'); }
    if(pUst25 > 55){ puan++; kriterler.push('2.5Ü'); }
    if(pKgVar > 55){ puan++; kriterler.push('KG'); }
    if(pBeraberlik > 20){ puan++; kriterler.push('X'); }

    let seviye = '';
    let etiket = '';
    let sinif = '';

    if(puan >= 3){
      seviye = 'gollu';
      etiket = '🔥 GOLLÜ MAÇ';
      sinif = 'gol-yes';
    } else if(puan >= 2){
      seviye = 'orta';
      etiket = '⚡ ORTA';
      sinif = 'gol-orta';
    } else {
      seviye = 'az';
      etiket = '❄️ AZ GOLLÜ';
      sinif = 'gol-no';
    }

    return {
      seviye, etiket, sinif, puan,
      toplamXg: toplamXg.toFixed(2),
      pUst25: pUst25.toFixed(1),
      pKgVar: pKgVar.toFixed(1),
      kriterler
    };
  }

  static analizEt(veri){
    const {o1,oX,o2} = veri;
    const shin = this.shinMarjArindir(o1,oX,o2);
    const xg = this.xgTahminEt(shin.p1, shin.pX, shin.p2);
    const poi = this.dixonColesMatris(xg.xgEv, xg.xgDep);

    const values = [];
    const kontrol = (market, oran, temiz, modelOlas) => {
      if(!oran || oran<=1) return;
      const ev = modelOlas*oran;
      if(ev>=1.02){
        let guc='Hafif', sinif='light';
        if(ev>=1.15){ guc='⚠️ Şüpheli'; sinif='suspicious'; }
        else if(ev>=1.10){ guc='🔥 Çok Güçlü'; sinif='strong'; }
        else if(ev>=1.05){ guc='⚡ Güçlü'; sinif='medium'; }
        values.push({
          market, oran,
          temizOran: temiz ? temiz.toFixed(2) : '-',
          modelOlas: (modelOlas*100).toFixed(1),
          ev: ev.toFixed(3),
          guc, sinif,
          kelly: this.kellyHesapla(modelOlas, oran).toFixed(2)
        });
      }
    };

    const m25 = this.ikiliMarjArindir(veri.oU25, veri.oA25);
    const mKg = this.ikiliMarjArindir(veri.oKgV, veri.oKgY);

    kontrol('2.5 Üst', veri.oU25, m25?.oA_temiz, poi.pUst25);
    kontrol('2.5 Alt', veri.oA25, m25?.oB_temiz, poi.pAlt25);
    kontrol('KG Var', veri.oKgV, mKg?.oA_temiz, poi.pKgVar);
    kontrol('KG Yok', veri.oKgY, mKg?.oB_temiz, poi.pKgYok);

    values.sort((a,b)=>parseFloat(b.ev)-parseFloat(a.ev));

    return {
      marj1X2: shin.marjYuzde.toFixed(2),
      shin: {
        p1: (shin.p1*100).toFixed(1),
        pX: (shin.pX*100).toFixed(1),
        p2: (shin.p2*100).toFixed(1)
      },
      xgEv: xg.xgEv.toFixed(2),
      xgDep: xg.xgDep.toFixed(2),
      poisson: {
        p1: (poi.p1*100).toFixed(1),
        pX: (poi.pX*100).toFixed(1),
        p2: (poi.p2*100).toFixed(1),
        pUst25: (poi.pUst25*100).toFixed(1),
        pAlt25: (poi.pAlt25*100).toFixed(1),
        pKgVar: (poi.pKgVar*100).toFixed(1),
        pKgYok: (poi.pKgYok*100).toFixed(1)
      },
      values
    };
  }
}

/* ============================================================
   2. MONTE CARLO
   ============================================================ */
class MonteCarloEngine {
  static poissonRandom(lambda){
    const L = Math.exp(-lambda);
    let k=0, p=1;
    do { k++; p *= Math.random(); } while(p > L);
    return k-1;
  }

  static macSimuleEt(xgEv, xgDep, iter=10000){
    let evG=0, ber=0, depG=0, ust25=0, kg=0;
    const skorlar = {};
    for(let i=0;i<iter;i++){
      const h = this.poissonRandom(xgEv);
      const a = this.poissonRandom(xgDep);
      const key = h+'-'+a;
      skorlar[key] = (skorlar[key]||0)+1;
      if(h>a) evG++; else if(h===a) ber++; else depG++;
      if(h+a>2.5) ust25++;
      if(h>=1 && a>=1) kg++;
    }
    const enIyi = Object.entries(skorlar)
      .map(([s,f])=>({ skor:s, yuzde:((f/iter)*100).toFixed(2) }))
      .sort((a,b)=>parseFloat(b.yuzde)-parseFloat(a.yuzde))
      .slice(0,5);

    return {
      iter,
      p1: ((evG/iter)*100).toFixed(2),
      pX: ((ber/iter)*100).toFixed(2),
      p2: ((depG/iter)*100).toFixed(2),
      pUst25: ((ust25/iter)*100).toFixed(2),
      pKgVar: ((kg/iter)*100).toFixed(2),
      enIyiSkorlar: enIyi
    };
  }
}

/* ============================================================
   3. UYGULAMA DURUMU
   ============================================================ */
let maclarToto = [];
let maclarIddaa = JSON.parse(localStorage.getItem('skorlab_iddaa') || '[]');
let oranlarToto = JSON.parse(localStorage.getItem('skorlab_oranlar_toto') || '{}');
let secimlerToto = JSON.parse(localStorage.getItem('skorlab_secimler_toto') || '{}');
let secimlerIddaa = JSON.parse(localStorage.getItem('skorlab_secimler_iddaa') || '{}');
let kayitliKuponlar = JSON.parse(localStorage.getItem('skorlab_kuponlar') || '[]');

/* YENİ: İddaa gol filtresi */
let golFiltre = 'hepsi'; // hepsi | gollu | orta | az

const $ = id => document.getElementById(id);

/* ============================================================
   4. VERİ YÜKLE
   ============================================================ */
async function loadData(){
  try{
    const res = await fetch('matches.json');
    if(!res.ok) throw new Error('HTTP '+res.status);
    const raw = await res.json();
    maclarToto = raw.maclar || [];
    $('weekTitle').innerText = raw.hafta || 'Bu Hafta';
  }catch(e){
    console.error(e);
    $('weekTitle').innerText = 'Veri Yüklenemedi';
  }
  renderToto();
  renderIddaa();
  renderAnaliz();
  renderKayitliKuponlar();
  updateStats();
  updateKuponCubugu();
}

/* ============================================================
   5. ORAN GÜNCELLE
   ============================================================ */
function oranGuncelleToto(mac_id, alan, val){
  if(!oranlarToto[mac_id]) oranlarToto[mac_id] = {};
  const num = parseFloat(val);
  if(!val || isNaN(num)) delete oranlarToto[mac_id][alan];
  else oranlarToto[mac_id][alan] = num;
  localStorage.setItem('skorlab_oranlar_toto', JSON.stringify(oranlarToto));
  renderToto();
  renderAnaliz();
}

/* ============================================================
   6. ÖNERİ ÜRET
   ============================================================ */
function oneriUret(analiz, oranlar){
  const p1 = parseFloat(analiz.shin.p1);
  const pX = parseFloat(analiz.shin.pX);
  const p2 = parseFloat(analiz.shin.p2);

  let favoriKod = '1', favoriOlas = p1;
  if(pX > favoriOlas){ favoriKod = 'X'; favoriOlas = pX; }
  if(p2 > favoriOlas){ favoriKod = '2'; favoriOlas = p2; }

  const sirali = [
    { kod:'1', olas:p1 }, { kod:'X', olas:pX }, { kod:'2', olas:p2 }
  ].sort((a,b)=>b.olas-a.olas);

  let tip = '', renk = '';
  if(favoriOlas >= 65){
    tip = 'BANKO ' + favoriKod;
    renk = 'green';
  } else if(favoriOlas >= 52){
    tip = 'TEK ' + favoriKod;
    renk = 'yellow';
  } else if(pX >= 25 && Math.abs(p1-p2) < 12){
    tip = 'ÇİFT ' + sirali[0].kod + sirali[1].kod;
    renk = 'orange';
  } else {
    tip = 'ÜÇLÜ 1X2';
    renk = 'red';
  }

  const degerVar = analiz.values.length > 0 ? analiz.values[0] : null;

  return {
    favoriKod, favoriOlas: favoriOlas.toFixed(1),
    tip, renk,
    tuzak: (100 - favoriOlas).toFixed(0),
    deger: degerVar
  };
}

/* ============================================================
   7. TOTO RENDER (DEĞİŞMEDİ)
   ============================================================ */
function renderToto(){
  if(!maclarToto.length){
    $('totoListesi').innerHTML = '<div class="card"><div class="muted" style="text-align:center;padding:20px">Maç yok.</div></div>';
    return;
  }

  $('totoListesi').innerHTML = maclarToto.map(m => {
    const sec = secimlerToto[m.mac_id] || [];
    const o = oranlarToto[m.mac_id] || {};
    const hasOdds = o['1'] && o['X'] && o['2'];

    let oneri = null;
    if(hasOdds){
      const a = ValueBetEngine.analizEt({
        o1:o['1'], oX:o['X'], o2:o['2'],
        oU25:o['U25'], oA25:o['A25'],
        oKgV:o['KgV'], oKgY:o['KgY']
      });
      oneri = oneriUret(a, o);
    }

    return `
    <div class="mac-kart">
      <div class="mac-head">
        <span class="mac-no">#${m.mac_id}</span>
        <button type="button" class="mac-analiz-btn" onclick="analizGosterToto(${m.mac_id})">📊 ANALİZ</button>
      </div>
      <div class="mac-teams">${m.ev_sahibi} - ${m.deplasman}</div>

      <div class="oran-giris">
        <div class="oran-item"><label>1</label><input type="number" step="0.01" value="${o['1']||''}" onchange="oranGuncelleToto(${m.mac_id},'1',this.value)"></div>
        <div class="oran-item"><label>X</label><input type="number" step="0.01" value="${o['X']||''}" onchange="oranGuncelleToto(${m.mac_id},'X',this.value)"></div>
        <div class="oran-item"><label>2</label><input type="number" step="0.01" value="${o['2']||''}" onchange="oranGuncelleToto(${m.mac_id},'2',this.value)"></div>
      </div>
      <div class="oran-giris">
        <div class="oran-item"><label>2.5 Alt</label><input type="number" step="0.01" value="${o['A25']||''}" onchange="oranGuncelleToto(${m.mac_id},'A25',this.value)"></div>
        <div class="oran-item"><label>2.5 Üst</label><input type="number" step="0.01" value="${o['U25']||''}" onchange="oranGuncelleToto(${m.mac_id},'U25',this.value)"></div>
        <div class="oran-item"><label>KG Var</label><input type="number" step="0.01" value="${o['KgV']||''}" onchange="oranGuncelleToto(${m.mac_id},'KgV',this.value)"></div>
      </div>

      ${oneri ? `
      <div style="margin:8px 0;padding:8px;background:var(--bg3);border-radius:8px;font-size:.72rem">
        <div style="display:flex;justify-content:space-between;align-items:center">
          <span style="font-weight:900;color:var(--${oneri.renk === 'green' ? 'green' : oneri.renk === 'yellow' ? 'orange' : oneri.renk === 'orange' ? 'orange' : 'red'})">🎯 ${oneri.tip}</span>
          <span class="muted">Favori: %${oneri.favoriOlas} · Tuzak: %${oneri.tuzak}</span>
        </div>
      </div>
      ` : ''}

      <div class="secim-grid">
        <button type="button" class="secim-btn ${sec.includes('1')?'secili':''}" onclick="secimToggleToto(${m.mac_id},'1')">1</button>
        <button type="button" class="secim-btn ${sec.includes('X')?'secili':''}" onclick="secimToggleToto(${m.mac_id},'X')">X</button>
        <button type="button" class="secim-btn ${sec.includes('2')?'secili':''}" onclick="secimToggleToto(${m.mac_id},'2')">2</button>
      </div>
    </div>`;
  }).join('');

  updateKuponCubugu();
}

/* ============================================================
   8. İDDAA RENDER (GOL FİLTRESİ + ETİKET)
   ============================================================ */
function renderIddaa(){
  const c = $('iddaaListesi');
  if(!c) return;

  // Önce gol filtresi bar'ı bas
  let html = `
    <div class="gol-filtre-bar">
      <button type="button" class="gol-filtre-btn ${golFiltre==='hepsi'?'active':''}" onclick="setGolFiltre('hepsi')">Tümü</button>
      <button type="button" class="gol-filtre-btn ${golFiltre==='gollu'?'active':''}" onclick="setGolFiltre('gollu')">🔥 Gollü</button>
      <button type="button" class="gol-filtre-btn ${golFiltre==='orta'?'active':''}" onclick="setGolFiltre('orta')">⚡ Orta</button>
      <button type="button" class="gol-filtre-btn ${golFiltre==='az'?'active':''}" onclick="setGolFiltre('az')">❄️ Az Gollü</button>
    </div>
  `;

  if(!maclarIddaa.length){
    html += '<div class="card"><div class="muted" style="text-align:center;padding:20px">Henüz maç eklemedin. "➕ Maç Ekle" ile başla.</div></div>';
    c.innerHTML = html;
    return;
  }

  // Her maçı analiz et, filtre uygula
  const macAnalizler = maclarIddaa.map(m => {
    const o = m.oranlar;
    if(!o.o1 || !o.oX || !o.o2) return { m, a: null, gol: null, oneri: null };

    const a = ValueBetEngine.analizEt({
      o1:o.o1, oX:o.oX, o2:o.o2,
      oU25:o.oU25, oA25:o.oA25,
      oKgV:o.oKgV, oKgY:o.oKgY
    });

    const gol = ValueBetEngine.golluMacAnaliz(a.poisson, parseFloat(a.xgEv), parseFloat(a.xgDep));
    const oneri = oneriUret(a, o);

    return { m, a, gol, oneri };
  });

  // Filtre uygula
  const filtreli = macAnalizler.filter(item => {
    if(golFiltre === 'hepsi') return true;
    if(!item.gol) return false;
    return item.gol.seviye === golFiltre;
  });

  if(filtreli.length === 0){
    html += '<div class="card"><div class="muted" style="text-align:center;padding:20px">Bu filtreye uyan maç yok.</div></div>';
    c.innerHTML = html;
    return;
  }

  filtreli.forEach(({ m, a, gol, oneri }) => {
    const sec = secimlerIddaa[m.id] || [];
    const o = m.oranlar;

    html += `
    <div class="mac-kart">
      <div class="mac-head">
        <span class="mac-no">İDDAA</span>
        <div>
          <button type="button" class="mac-analiz-btn" onclick="analizGosterIddaa(${m.id})">📊</button>
          <button type="button" class="btn btn-red btn-sm" onclick="iddaaSil(${m.id})" style="margin-left:6px">🗑️</button>
        </div>
      </div>
      <div class="mac-teams">${m.mac}</div>
      <div style="font-size:.7rem;color:var(--muted);display:grid;grid-template-columns:repeat(3,1fr);gap:6px;margin-bottom:8px">
        <span>1: <b style="color:var(--text)">${o.o1||'-'}</b></span>
        <span>X: <b style="color:var(--text)">${o.oX||'-'}</b></span>
        <span>2: <b style="color:var(--text)">${o.o2||'-'}</b></span>
      </div>

      ${gol ? `
      <div style="margin:6px 0">
        <span class="gol-etiket ${gol.sinif}">${gol.etiket} (${gol.puan}/4)</span>
        <div class="gol-info">
          <div>xG: <b>${gol.toplamXg}</b></div>
          <div>2.5Ü: <b>%${gol.pUst25}</b></div>
          <div>KG: <b>%${gol.pKgVar}</b></div>
        </div>
      </div>
      ` : ''}

      ${oneri ? `
      <div style="margin:8px 0;padding:8px;background:var(--bg3);border-radius:8px;font-size:.72rem">
        <div style="display:flex;justify-content:space-between">
          <span style="font-weight:900;color:var(--${oneri.renk === 'green' ? 'green' : oneri.renk === 'yellow' ? 'orange' : oneri.renk === 'orange' ? 'orange' : 'red'})">🎯 ${oneri.tip}</span>
          <span class="muted">Favori: %${oneri.favoriOlas}</span>
        </div>
        ${oneri.deger ? `
          <div style="margin-top:4px;color:var(--purple);font-weight:800">
            💎 ${oneri.deger.market} @ ${oneri.deger.oran}
          </div>
        ` : ''}
      </div>
      ` : ''}

      <div class="secim-grid">
        <button type="button" class="secim-btn ${sec.includes('1')?'secili':''}" onclick="secimToggleIddaa(${m.id},'1')">1</button>
        <button type="button" class="secim-btn ${sec.includes('X')?'secili':''}" onclick="secimToggleIddaa(${m.id},'X')">X</button>
        <button type="button" class="secim-btn ${sec.includes('2')?'secili':''}" onclick="secimToggleIddaa(${m.id},'2')">2</button>
      </div>
    </div>
    `;
  });

  c.innerHTML = html;
}

/* YENİ: Gol filtresi değiştir */
function setGolFiltre(f){
  golFiltre = f;
  renderIddaa();
}

/* ============================================================
   9. ANALİZ SEKMESİ
   ============================================================ */
function renderAnaliz(){
  const c = $('analizListesi');
  if(!c) return;

  const satirlar = [];

  maclarToto.forEach(m => {
    const o = oranlarToto[m.mac_id];
    if(!o || !o['1'] || !o['X'] || !o['2']) return;
    const a = ValueBetEngine.analizEt({
      o1:o['1'], oX:o['X'], o2:o['2'],
      oU25:o['U25'], oA25:o['A25'],
      oKgV:o['KgV'], oKgY:o['KgY']
    });
    const oneri = oneriUret(a, o);
    satirlar.push({ tip:'toto', id:m.mac_id, isim:m.ev_sahibi + ' - ' + m.deplasman, oneri, analiz:a });
  });

  maclarIddaa.forEach(m => {
    const o = m.oranlar;
    if(!o.o1 || !o.oX || !o.o2) return;
    const a = ValueBetEngine.analizEt({
      o1:o.o1, oX:o.oX, o2:o.o2,
      oU25:o.oU25, oA25:o.oA25,
      oKgV:o.oKgV, oKgY:o.oKgY
    });
    const oneri = oneriUret(a, o);
    satirlar.push({ tip:'iddaa', id:m.id, isim:m.mac, oneri, analiz:a });
  });

  if(!satirlar.length){
    c.innerHTML = '<div class="muted" style="text-align:center;padding:20px">Analiz için önce oran girmelisin.</div>';
    return;
  }

  const banko = satirlar.filter(s => s.oneri.tip.includes('BANKO')).length;
  const tek = satirlar.filter(s => s.oneri.tip.startsWith('TEK')).length;
  const cift = satirlar.filter(s => s.oneri.tip.includes('ÇİFT')).length;
  const uclu = satirlar.filter(s => s.oneri.tip.includes('ÜÇLÜ')).length;
  const degerli = satirlar.filter(s => s.oneri.deger).length;

  let html = `
    <div style="display:grid;grid-template-columns:repeat(5,1fr);gap:6px;margin-bottom:14px;font-size:.65rem;text-align:center">
      <div style="padding:6px;background:rgba(0,230,118,.15);border-radius:6px;color:var(--green);font-weight:900">${banko}<br><span style="font-size:.55rem;opacity:.7">BANKO</span></div>
      <div style="padding:6px;background:rgba(255,176,32,.15);border-radius:6px;color:var(--orange);font-weight:900">${tek}<br><span style="font-size:.55rem;opacity:.7">TEK</span></div>
      <div style="padding:6px;background:rgba(255,176,32,.15);border-radius:6px;color:var(--orange);font-weight:900">${cift}<br><span style="font-size:.55rem;opacity:.7">ÇİFT</span></div>
      <div style="padding:6px;background:rgba(255,77,94,.15);border-radius:6px;color:var(--red);font-weight:900">${uclu}<br><span style="font-size:.55rem;opacity:.7">ÜÇLÜ</span></div>
      <div style="padding:6px;background:rgba(168,85,247,.15);border-radius:6px;color:var(--purple);font-weight:900">${degerli}<br><span style="font-size:.55rem;opacity:.7">VALUE</span></div>
    </div>
  `;

  satirlar.forEach(s => {
    const renk = s.oneri.renk === 'green' ? 'green' : s.oneri.renk === 'yellow' ? 'orange' : s.oneri.renk === 'orange' ? 'orange' : 'red';
    html += `
      <div style="padding:10px 0;border-bottom:1px solid var(--border);font-size:.78rem;cursor:pointer" onclick="analizGoster${s.tip === 'toto' ? 'Toto' : 'Iddaa'}(${s.id})">
        <div style="font-weight:900;margin-bottom:4px">${s.tip === 'toto' ? '#'+s.id : 'İ'} ${s.isim}</div>
        <div style="display:flex;justify-content:space-between;align-items:center">
          <span style="font-weight:900;color:var(--${renk})">🎯 ${s.oneri.tip}</span>
          <span class="muted" style="font-size:.7rem">Favori: %${s.oneri.favoriOlas} · Tuzak: %${s.oneri.tuzak}</span>
        </div>
        ${s.oneri.deger ? `
          <div style="margin-top:4px;color:var(--purple);font-weight:800;font-size:.72rem">
            💎 ${s.oneri.deger.market} @ ${s.oneri.deger.oran} (EV: ${s.oneri.deger.ev})
          </div>
        ` : ''}
      </div>
    `;
  });

  c.innerHTML = html;
}

/* ============================================================
   10. SEÇİM
   ============================================================ */
function secimToggleToto(id, secim){
  let sec = secimlerToto[id] || [];
  if(sec.includes(secim)) sec = sec.filter(s => s !== secim);
  else sec.push(secim);
  if(sec.length === 0) delete secimlerToto[id];
  else secimlerToto[id] = sec;
  localStorage.setItem('skorlab_secimler_toto', JSON.stringify(secimlerToto));
  renderToto();
  updateStats();
  updateKuponCubugu();
}

function secimToggleIddaa(id, secim){
  let sec = secimlerIddaa[id] || [];
  if(sec.includes(secim)) sec = sec.filter(s => s !== secim);
  else sec.push(secim);
  if(sec.length === 0) delete secimlerIddaa[id];
  else secimlerIddaa[id] = sec;
  localStorage.setItem('skorlab_secimler_iddaa', JSON.stringify(secimlerIddaa));
  renderIddaa();
  updateStats();
  updateKuponCubugu();
}

function tumSecimleriSil(){
  if(!confirm('Tüm seçimler silinsin mi? (Oranlar kalır)')) return;
  secimlerToto = {};
  secimlerIddaa = {};
  localStorage.setItem('skorlab_secimler_toto', '{}');
  localStorage.setItem('skorlab_secimler_iddaa', '{}');
  renderToto();
  renderIddaa();
  updateStats();
  updateKuponCubugu();
}

function temizleToto(){
  if(!confirm('Tüm Toto oranları ve seçimleri silinsin mi?')) return;
  oranlarToto = {};
  secimlerToto = {};
  localStorage.setItem('skorlab_oranlar_toto', '{}');
  localStorage.setItem('skorlab_secimler_toto', '{}');
  renderToto();
  renderAnaliz();
  updateStats();
  updateKuponCubugu();
  $('totoKuponSonuc').innerHTML = '';
}

function temizleIddaa(){
  if(!confirm('Tüm İddaa maçları silinsin mi?')) return;
  maclarIddaa = [];
  secimlerIddaa = {};
  localStorage.removeItem('skorlab_iddaa');
  localStorage.setItem('skorlab_secimler_iddaa', '{}');
  renderIddaa();
  renderAnaliz();
  updateStats();
  updateKuponCubugu();
  $('kuponSonuc').innerHTML = '';
}

/* ============================================================
   11. İDDAA MAÇ EKLE
   ============================================================ */
function openIddaaModal(){
  ['im-mac','im-o1','im-oX','im-o2','im-u15alt','im-u25alt','im-u25ust','im-u35alt','im-u35ust','im-u45ust','im-kgvar','im-kgyok','im-kg25'].forEach(id => {
    const el = $(id); if(el) el.value = '';
  });
  $('iddaaModal').classList.add('active');
}

function iddaaEkle(){
  const mac = $('im-mac').value.trim();
  const o1 = parseFloat($('im-o1').value);
  const oX = parseFloat($('im-oX').value);
  const o2 = parseFloat($('im-o2').value);

  if(!mac || !o1 || !oX || !o2){
    showToast('error','Eksik','Maç adı ve 1X2 oranları zorunlu.');
    return;
  }

  const yeni = {
    id: Date.now(),
    mac,
    oranlar: {
      o1, oX, o2,
      oA25: parseFloat($('im-u25alt').value) || null,
      oU25: parseFloat($('im-u25ust').value) || null,
      oKgV: parseFloat($('im-kgvar').value) || null,
      oKgY: parseFloat($('im-kgyok').value) || null
    },
    tarih: new Date().toLocaleString('tr-TR')
  };

  maclarIddaa.unshift(yeni);
  localStorage.setItem('skorlab_iddaa', JSON.stringify(maclarIddaa));
  closeModal('iddaaModal');
  renderIddaa();
  renderAnaliz();
  showToast('success','Maç Eklendi!', mac);
}

function iddaaSil(id){
  if(!confirm('Bu maç silinsin mi?')) return;
  maclarIddaa = maclarIddaa.filter(x => x.id !== id);
  delete secimlerIddaa[id];
  localStorage.setItem('skorlab_iddaa', JSON.stringify(maclarIddaa));
  localStorage.setItem('skorlab_secimler_iddaa', JSON.stringify(secimlerIddaa));
  renderIddaa();
  renderAnaliz();
  updateStats();
  updateKuponCubugu();
}

/* ============================================================
   12. KUPON HESAP
   ============================================================ */
function kuponHesapla(){
  let toto = 0, iddaa = 0, kolon = 1;
  Object.keys(secimlerToto).forEach(id => {
    const sec = secimlerToto[id];
    if(!sec || !sec.length) return;
    toto++;
    kolon *= sec.length;
  });
  Object.keys(secimlerIddaa).forEach(id => {
    const sec = secimlerIddaa[id];
    if(!sec || !sec.length) return;
    iddaa++;
    kolon *= sec.length;
  });
  return { toto, iddaa, toplam: toto+iddaa, kolon, tutar: kolon*10 };
}

function updateStats(){
  const h = kuponHesapla();
  const sM = $('statMac'); if(sM) sM.innerText = maclarToto.length + maclarIddaa.length;
  const sS = $('statSecilen'); if(sS) sS.innerText = h.toplam;
  const sK = $('statKolon'); if(sK) sK.innerText = h.kolon;
  const sT = $('statTutar'); if(sT) sT.innerText = h.tutar;
}

function updateKuponCubugu(){
  const h = kuponHesapla();
  const kT = $('kcToto'); if(kT) kT.innerText = h.toto;
  const kI = $('kcIddaa'); if(kI) kI.innerText = h.iddaa;
  const kTp = $('kcToplam'); if(kTp) kTp.innerText = h.tutar + ' TL';
}

/* ============================================================
   13. TOTO KUPONU
   ============================================================ */
function kuponOlusturToto(){
  if(!maclarToto.length){ showToast('error','Maç Yok','Toto boş.'); return; }

  const oneriler = [];
  maclarToto.forEach(m => {
    const o = oranlarToto[m.mac_id];
    if(!o || !o['1'] || !o['X'] || !o['2']) return;
    const a = ValueBetEngine.analizEt({
      o1:o['1'], oX:o['X'], o2:o['2'],
      oU25:o['U25'], oA25:o['A25'],
      oKgV:o['KgV'], oKgY:o['KgY']
    });
    const oneri = oneriUret(a, o);
    oneriler.push({
      mac_id: m.mac_id,
      isim: m.ev_sahibi + ' - ' + m.deplasman,
      tip: oneri.tip,
      favoriKod: oneri.favoriKod,
      favoriOlas: oneri.favoriOlas,
      deger: oneri.deger
    });
  });

  if(!oneriler.length){ showToast('error','Oran Yok','Hiç oran girilmemiş.'); return; }

  let html = `
    <div class="card" style="border:1px solid var(--green)">
      <div class="result-title">⚡ TOTO KUPON ÖNERİSİ (${oneriler.length} maç)</div>
  `;

  oneriler.forEach(o => {
    const renk = o.tip.includes('BANKO') ? 'green' : o.tip.includes('ÇİFT') ? 'orange' : 'red';
    html += `
      <div style="padding:10px 0;border-bottom:1px solid var(--border);font-size:.78rem">
        <div style="font-weight:900;margin-bottom:4px">#${o.mac_id} ${o.isim}</div>
        <div style="display:flex;justify-content:space-between">
          <b style="color:var(--${renk});font-size:.9rem">🎯 ${o.tip}</b>
          <span class="muted">Favori: %${o.favoriOlas}</span>
        </div>
      </div>
    `;
  });

  let kolon = 1;
  oneriler.forEach(o => {
    if(o.tip.includes('BANKO') || o.tip.startsWith('TEK')) kolon *= 1;
    else if(o.tip.includes('ÇİFT')) kolon *= 2;
    else if(o.tip.includes('ÜÇLÜ')) kolon *= 3;
  });

  html += `
      <div style="margin-top:12px;padding:10px;background:var(--bg3);border-radius:8px">
        <div class="analiz-row"><span>Toplam Kolon:</span><b class="green">${kolon}</b></div>
        <div class="analiz-row"><span>Tutar:</span><b class="green">${kolon * 10} TL</b></div>
      </div>
      <button type="button" class="btn btn-green btn-lg" onclick="kuponKaydetToto()" style="margin-top:12px">💾 KUPONU KAYDET</button>
    </div>
  `;

  $('totoKuponSonuc').innerHTML = html;
  window.sonTotoKuponu = oneriler;
}

/* ============================================================
   14. İDDAA KUPONU (GOL FİLTRESİ UYGULANIR)
   ============================================================ */
function kuponOlusturIddaa(){
  if(!maclarIddaa.length){ showToast('error','Maç Yok','İddaa boş.'); return; }

  const oneriler = [];
  maclarIddaa.forEach(m => {
    const o = m.oranlar;
    if(!o.o1 || !o.oX || !o.o2) return;
    const a = ValueBetEngine.analizEt({
      o1:o.o1, oX:o.oX, o2:o.o2,
      oU25:o.oU25, oA25:o.oA25,
      oKgV:o.oKgV, oKgY:o.oKgY
    });
    const gol = ValueBetEngine.golluMacAnaliz(a.poisson, parseFloat(a.xgEv), parseFloat(a.xgDep));

    // Aktif gol filtresi uygulanır
    if(golFiltre !== 'hepsi' && gol.seviye !== golFiltre) return;

    const oneri = oneriUret(a, o);
    oneriler.push({
      mac_id: m.id,
      isim: m.mac,
      tip: oneri.tip,
      favoriKod: oneri.favoriKod,
      favoriOlas: oneri.favoriOlas,
      deger: oneri.deger,
      gol
    });
  });

  if(!oneriler.length){
    showToast('error','Maç Yok','Aktif filtreye uyan maç yok.');
    return;
  }

  let html = `
    <div class="card" style="border:1px solid var(--green)">
      <div class="result-title">⚡ İDDAA KUPON ÖNERİSİ (${oneriler.length} maç)</div>
      ${golFiltre !== 'hepsi' ? `
        <div class="muted" style="font-size:.7rem;margin-bottom:8px">
          Aktif filtre: <b style="color:var(--green)">${
            golFiltre === 'gollu' ? '🔥 Gollü Maçlar' :
            golFiltre === 'orta' ? '⚡ Orta' : '❄️ Az Gollü'
          }</b>
        </div>
      ` : ''}
  `;

  oneriler.forEach(o => {
    const renk = o.tip.includes('BANKO') ? 'green' : o.tip.includes('ÇİFT') ? 'orange' : 'red';
    html += `
      <div style="padding:10px 0;border-bottom:1px solid var(--border);font-size:.78rem">
        <div style="font-weight:900;margin-bottom:4px">${o.isim}</div>
        <div style="display:flex;justify-content:space-between">
          <b style="color:var(--${renk});font-size:.9rem">🎯 ${o.tip}</b>
          <span class="muted">Favori: %${o.favoriOlas}</span>
        </div>
        ${o.gol ? `<span class="gol-etiket ${o.gol.sinif}" style="margin-top:4px">${o.gol.etiket}</span>` : ''}
        ${o.deger ? `
          <div style="margin-top:4px;color:var(--purple);font-weight:800;font-size:.72rem">
            💎 ${o.deger.market} @ ${o.deger.oran} (EV: ${o.deger.ev})
          </div>
        ` : ''}
      </div>
    `;
  });

  let kolon = 1;
  oneriler.forEach(o => {
    if(o.tip.includes('BANKO') || o.tip.startsWith('TEK')) kolon *= 1;
    else if(o.tip.includes('ÇİFT')) kolon *= 2;
    else if(o.tip.includes('ÜÇLÜ')) kolon *= 3;
  });

  html += `
      <div style="margin-top:12px;padding:10px;background:var(--bg3);border-radius:8px">
        <div class="analiz-row"><span>Toplam Kolon:</span><b class="green">${kolon}</b></div>
        <div class="analiz-row"><span>Tutar:</span><b class="green">${kolon * 10} TL</b></div>
      </div>
      <button type="button" class="btn btn-green btn-lg" onclick="kuponKaydetIddaa()" style="margin-top:12px">💾 KUPONU KAYDET</button>
    </div>
  `;

  $('kuponSonuc').innerHTML = html;
  window.sonIddaaKuponu = oneriler;
}

/* ============================================================
   15. KUPON KAYDET
   ============================================================ */
function kuponKaydetToto(){
  const oneriler = window.sonTotoKuponu || [];
  if(!oneriler.length) return;

  kayitliKuponlar.unshift({
    id: Date.now(),
    tip: 'toto',
    tarih: new Date().toLocaleString('tr-TR'),
    macSayisi: oneriler.length,
    kolon: 1,
    tutar: 10,
    detaylar: oneriler.map(o => ({
      mac_id: o.mac_id, isim: o.isim, secim: o.tip
    })),
    durum: 'bekliyor'
  });
  if(kayitliKuponlar.length > 50) kayitliKuponlar = kayitliKuponlar.slice(0, 50);
  localStorage.setItem('skorlab_kuponlar', JSON.stringify(kayitliKuponlar));
  renderKayitliKuponlar();
  showToast('success','Toto Kuponu Kaydedildi!', oneriler.length + ' maç');
  $('totoKuponSonuc').innerHTML = '';
  window.sonTotoKuponu = null;
}

function kuponKaydetIddaa(){
  const oneriler = window.sonIddaaKuponu || [];
  if(!oneriler.length) return;

  kayitliKuponlar.unshift({
    id: Date.now(),
    tip: 'iddaa',
    tarih: new Date().toLocaleString('tr-TR'),
    macSayisi: oneriler.length,
    kolon: 1,
    tutar: 10,
    detaylar: oneriler.map(o => ({
      mac_id: o.mac_id, isim: o.isim, secim: o.tip
    })),
    durum: 'bekliyor'
  });
  if(kayitliKuponlar.length > 50) kayitliKuponlar = kayitliKuponlar.slice(0, 50);
  localStorage.setItem('skorlab_kuponlar', JSON.stringify(kayitliKuponlar));
  renderKayitliKuponlar();
  showToast('success','İddaa Kuponu Kaydedildi!', oneriler.length + ' maç');
  $('kuponSonuc').innerHTML = '';
  window.sonIddaaKuponu = null;
}

function hizliKaydet(){
  showToast('error','Kaydet','Toto veya İddaa sekmesinden "KUPON OLUŞTUR" kullanın.');
}

/* ============================================================
   16. ANALİZ MODAL
   ============================================================ */
function analizGosterToto(id){
  const m = maclarToto.find(x => x.mac_id === id);
  if(!m) return;
  const o = oranlarToto[id];
  if(!o || !o['1'] || !o['X'] || !o['2']){
    showToast('error','Oran Yok','1/X/2 oranlarını gir.');
    return;
  }
  analizGosterOrtak(m.ev_sahibi + ' - ' + m.deplasman, o, 'toto');
}

function analizGosterIddaa(id){
  const m = maclarIddaa.find(x => x.id === id);
  if(!m) return;
  const o = m.oranlar;
  if(!o.o1 || !o.oX || !o.o2){
    showToast('error','Oran Yok','1/X/2 oranları eksik.');
    return;
  }
  analizGosterOrtak(m.mac, {
    '1':o.o1, 'X':o.oX, '2':o.o2,
    'U25':o.oU25, 'A25':o.oA25,
    'KgV':o.oKgV, 'KgY':o.oKgY
  }, 'iddaa');
}

function analizGosterOrtak(isim, o, tip){
  const rapor = ValueBetEngine.analizEt({
    o1: o['1'], oX: o['X'], o2: o['2'],
    oU25: o['U25'], oA25: o['A25'],
    oKgV: o['KgV'], oKgY: o['KgY']
  });

  const mc = MonteCarloEngine.macSimuleEt(
    parseFloat(rapor.xgEv), parseFloat(rapor.xgDep), 10000
  );

  const oneri = oneriUret(rapor, o);
  const renkMap = { green: 'var(--green)', yellow: 'var(--orange)', orange: 'var(--orange)', red: 'var(--red)' };
  const aktifRenk = renkMap[oneri.renk] || 'var(--green)';

  /* Gollü maç analizi (sadece iddaa'da göster) */
  let golHTML = '';
  if(tip === 'iddaa'){
    const gol = ValueBetEngine.golluMacAnaliz(rapor.poisson, parseFloat(rapor.xgEv), parseFloat(rapor.xgDep));
    golHTML = `
      <div class="analiz-box" style="border:1px solid var(--border)">
        <span class="analiz-lbl">⚽ GOL ANALİZİ</span>
        <div style="text-align:center;margin:8px 0">
          <span class="gol-etiket ${gol.sinif}" style="font-size:.8rem;padding:6px 14px">${gol.etiket}</span>
          <div class="muted" style="font-size:.7rem;margin-top:4px">${gol.puan}/4 kriter tuttu</div>
        </div>
        <div class="analiz-row"><span>Toplam xG:</span><b>${gol.toplamXg}</b></div>
        <div class="analiz-row"><span>2.5 Üst:</span><b>%${gol.pUst25}</b></div>
        <div class="analiz-row"><span>KG Var:</span><b>%${gol.pKgVar}</b></div>
        <div class="analiz-row"><span class="muted">Tutulan kriterler:</span><span class="muted">${gol.kriterler.join(', ') || 'Yok'}</span></div>
      </div>
    `;
  }

  $('analizTitle').innerText = '📊 ' + isim;

  $('analizBody').innerHTML = `
    <div style="font-size:.85rem;line-height:1.8">
      <div class="analiz-box" style="border:1px solid ${aktifRenk}">
        <span class="analiz-lbl">🎯 SİSTEM ÖNERİSİ</span>
        <div style="text-align:center;font-weight:900;font-size:1.2rem;color:${aktifRenk};padding:8px 0">
          ${oneri.tip}
        </div>
        <div class="analiz-row"><span>Favori Olasılık:</span><b>%${oneri.favoriOlas}</b></div>
        <div class="analiz-row"><span>Tuzak Riski:</span><b>%${oneri.tuzak}</b></div>
      </div>

      ${golHTML}

      <div class="analiz-box">
        <span class="analiz-lbl">📊 SHIN MARJ ARINDIRMA</span>
        <div class="analiz-row"><span>1:</span><b class="green">%${rapor.shin.p1}</b></div>
        <div class="analiz-row"><span>X:</span><b class="orange">%${rapor.shin.pX}</b></div>
        <div class="analiz-row"><span>2:</span><b>%${rapor.shin.p2}</b></div>
        <div class="analiz-row"><span class="muted">Marj:</span><b style="color:var(--orange)">%${rapor.marj1X2}</b></div>
      </div>

      <div class="analiz-box">
        <span class="analiz-lbl">⚽ POISSON (xG: ${rapor.xgEv} - ${rapor.xgDep})</span>
        <div class="analiz-row"><span>1:</span><b>%${rapor.poisson.p1}</b></div>
        <div class="analiz-row"><span>X:</span><b>%${rapor.poisson.pX}</b></div>
        <div class="analiz-row"><span>2:</span><b>%${rapor.poisson.p2}</b></div>
        <div class="analiz-row"><span>2.5 Üst:</span><b>%${rapor.poisson.pUst25}</b></div>
        <div class="analiz-row"><span>KG Var:</span><b>%${rapor.poisson.pKgVar}</b></div>
      </div>

      <div class="analiz-box">
        <span class="analiz-lbl">🎰 MONTE CARLO (10.000 sim)</span>
        <div class="analiz-row"><span>1:</span><b>%${mc.p1}</b></div>
        <div class="analiz-row"><span>X:</span><b>%${mc.pX}</b></div>
        <div class="analiz-row"><span>2:</span><b>%${mc.p2}</b></div>
        <div style="margin-top:8px;padding-top:6px;border-top:1px solid var(--border)">
          <div class="muted" style="font-size:.7rem;margin-bottom:4px">En Olası Skorlar:</div>
          ${mc.enIyiSkorlar.map(s => `<div class="analiz-row"><span>${s.skor}</span><b>%${s.yuzde}</b></div>`).join('')}
        </div>
      </div>

      ${rapor.values.length > 0 ? `
      <div class="analiz-box" style="border:1px solid var(--green)">
        <span class="analiz-lbl">💎 VALUE BET (Yan Marketler)</span>
        ${rapor.values.slice(0,5).map(v => `
          <div style="padding:6px 0;border-bottom:1px solid var(--border)">
            <div style="display:flex;justify-content:space-between">
              <b style="color:var(--green)">${v.market} @ ${v.oran}</b>
              <b class="green">EV: ${v.ev}</b>
            </div>
            <div class="muted" style="font-size:.68rem">Model: %${v.modelOlas} · Kelly: %${v.kelly} · ${v.guc}</div>
          </div>
        `).join('')}
      </div>
      ` : `
      <div class="analiz-box" style="border:1px solid var(--red)">
        <span class="analiz-lbl">❌ VALUE BET YOK</span>
        <div class="muted" style="font-size:.75rem">
          Yan marketlerde (2.5, KG) değerli bahis bulunamadı.
        </div>
      </div>
      `}
    </div>`;

  $('analizModal').classList.add('active');
}

/* ============================================================
   17. KUPONLARIM
   ============================================================ */
function renderKayitliKuponlar(){
  const c = $('kayitliKuponlar');
  if(!c) return;
  if(!kayitliKuponlar.length){
    c.innerHTML = '<div class="muted" style="text-align:center;padding:20px">Kayıtlı kupon yok.</div>';
    return;
  }
  c.innerHTML = kayitliKuponlar.map(k => {
    const renk = k.durum === 'kazandi' ? 'kazandi' : k.durum === 'kaybetti' ? 'kaybetti' : 'bekliyor';
    const emoji = k.durum === 'kazandi' ? '✅' : k.durum === 'kaybetti' ? '❌' : '⏳';
    const tipIkon = k.tip === 'iddaa' ? '🎯' : '📋';
    return `
      <div class="kupon-gecmis ${renk}" onclick="kuponDetayAc(${k.id})">
        <div style="display:flex;justify-content:space-between;font-size:.8rem;margin-bottom:4px">
          <span>${emoji} ${tipIkon} <b>${k.macSayisi} maç</b></span>
          <span class="muted">${k.tarih}</span>
        </div>
        <div style="font-size:.72rem;color:var(--muted)">Tutar: <b style="color:var(--green)">${k.tutar} TL</b></div>
      </div>`;
  }).join('');
}

function kuponDetayAc(id){
  const k = kayitliKuponlar.find(x => x.id === id);
  if(!k) return;
  const emoji = k.durum === 'kazandi' ? '✅' : k.durum === 'kaybetti' ? '❌' : '⏳';
  $('kuponDetayBody').innerHTML = `
    <div style="font-size:.8rem">
      <div class="muted" style="margin-bottom:10px">${emoji} ${k.tarih} · ${k.macSayisi} maç · ${k.tutar} TL</div>
      <div style="max-height:400px;overflow-y:auto;background:var(--bg3);border-radius:8px;padding:10px">
        ${k.detaylar.map(d => `
          <div style="padding:8px 0;border-bottom:1px solid var(--border)">
            <div style="font-weight:800;margin-bottom:4px">${d.isim}</div>
            <div style="color:var(--green);font-weight:900;text-align:right">${d.secim}</div>
          </div>
        `).join('')}
      </div>
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:6px;margin-top:12px">
        <button type="button" class="btn ${k.durum==='kazandi'?'btn-green':'btn-gray'}" onclick="kuponDurum(${id},'kazandi')">✅ Kazandı</button>
        <button type="button" class="btn ${k.durum==='bekliyor'?'btn-orange':'btn-gray'}" onclick="kuponDurum(${id},'bekliyor')">⏳ Bekliyor</button>
        <button type="button" class="btn ${k.durum==='kaybetti'?'btn-red':'btn-gray'}" onclick="kuponDurum(${id},'kaybetti')">❌ Kaybetti</button>
      </div>
      <button type="button" class="btn btn-red btn-lg" onclick="kuponSil(${id})" style="margin-top:10px">🗑️ Sil</button>
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
}

function kuponSil(id){
  if(!confirm('Kupon silinsin mi?')) return;
  kayitliKuponlar = kayitliKuponlar.filter(x => x.id !== id);
  localStorage.setItem('skorlab_kuponlar', JSON.stringify(kayitliKuponlar));
  closeModal('kuponDetayModal');
  renderKayitliKuponlar();
}

/* ============================================================
   18. NAV / MODAL
   ============================================================ */
function switchTab(i, el){
  document.querySelectorAll('.tab, .page').forEach(e => e.classList.remove('active'));
  if(el) el.classList.add('active');
  $('page-'+i).classList.add('active');
  if(i === 3) renderAnaliz();
  if(i === 4) renderKayitliKuponlar();
}

function closeModal(id){ $(id).classList.remove('active'); }

function showToast(type, title, msg){
  $('toastIcon').innerText = type==='success' ? '✅' : '❌';
  $('toastTitle').innerText = title;
  $('toastMsg').innerText = msg;
  $('toastModal').classList.add('active');
}

window.onload = function(){ loadData(); };
