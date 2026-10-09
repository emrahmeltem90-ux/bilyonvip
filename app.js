/* ============================================================
   SKORLAB v18 PRO · ValueBetEngine + Toto + Kupon
   ============================================================ */

/* ============================================================
   1. MATEMATİKSEL ANALİZ MOTORU
   ============================================================ */
class ValueBetEngine {

  static faktoriyel(n) {
    let res = 1;
    for (let i = 2; i <= n; i++) res *= i;
    return res;
  }

  static poissonPmf(k, lambda) {
    return (Math.exp(-lambda) * Math.pow(lambda, k)) / this.faktoriyel(k);
  }

  /* Shin Marj Arındırma (1X2) */
  static shinMarjArindir(o1, oX, o2) {
    const p1_raw = 1 / o1;
    const pX_raw = 1 / oX;
    const p2_raw = 1 / o2;
    const S = p1_raw + pX_raw + p2_raw;

    if (S <= 1 || isNaN(S)) {
      return { p1: 0.33, pX: 0.33, p2: 0.34, marjYuzde: 0 };
    }

    const shinFormul = (p) => {
      const num = Math.sqrt(S * S + 4 * (1 - S) * Math.pow(p / S, 2)) - S;
      const den = 2 * (1 - S);
      return num / den;
    };

    const p1_shin = shinFormul(p1_raw);
    const pX_shin = shinFormul(pX_raw);
    const p2_shin = shinFormul(p2_raw);
    const totalShin = p1_shin + pX_shin + p2_shin;

    return {
      p1: p1_shin / totalShin,
      pX: pX_shin / totalShin,
      p2: p2_shin / totalShin,
      marjYuzde: (S - 1) * 100
    };
  }

  /* İkili Marj Arındırma (2.5, KG) */
  static ikiliMarjArindir(oA, oB) {
    if (!oA || !oB || oA <= 1 || oB <= 1) return null;

    const pA_raw = 1 / oA;
    const pB_raw = 1 / oB;
    const S = pA_raw + pB_raw;

    return {
      pA_gercek: pA_raw / S,
      pB_gercek: pB_raw / S,
      oA_temiz: oA / S,
      oB_temiz: oB / S,
      marjYuzde: (S - 1) * 100
    };
  }

  /* xG Tahmini */
  static xgTahminEt(p1, pX, p2) {
    const hs = p1 / (p1 + p2 || 1);
    const tg = 2.4 + (1 - pX) * 0.8;
    const xgEv = Math.max(0.3, tg * hs * 1.15);
    const xgDep = Math.max(0.3, tg * (1 - hs));
    return { xgEv, xgDep };
  }

  /* Dixon-Coles Poisson (Normalize Edilmiş) */
  static dixonColesMatris(xgEv, xgDep, rho = -0.13) {
    const MAX = 8;
    let pUst25 = 0;
    let pKg = 0;
    let p1 = 0, pX = 0, p2 = 0;

    for (let h = 0; h <= MAX; h++) {
      for (let a = 0; a <= MAX; a++) {
        let pBase = this.poissonPmf(h, xgEv) * this.poissonPmf(a, xgDep);

        let tau = 1.0;
        if (h === 0 && a === 0) tau = 1.0 - xgEv * xgDep * rho;
        else if (h === 1 && a === 0) tau = 1.0 + xgDep * rho;
        else if (h === 0 && a === 1) tau = 1.0 + xgEv * rho;
        else if (h === 1 && a === 1) tau = 1.0 - rho;

        const pFinal = pBase * tau;

        if (h > a) p1 += pFinal;
        else if (h === a) pX += pFinal;
        else p2 += pFinal;

        if (h + a > 2.5) pUst25 += pFinal;
        if (h >= 1 && a >= 1) pKg += pFinal;
      }
    }

    /* Normalize — toplam %100'e çek */
    const toplam = p1 + pX + p2;
    p1 /= toplam; pX /= toplam; p2 /= toplam;
    pUst25 /= toplam;
    pKg /= toplam;

    return {
      p1, pX, p2,
      pUst25: Math.min(0.99, Math.max(0.01, pUst25)),
      pAlt25: Math.min(0.99, Math.max(0.01, 1 - pUst25)),
      pKgVar: Math.min(0.99, Math.max(0.01, pKg)),
      pKgYok: Math.min(0.99, Math.max(0.01, 1 - pKg))
    };
  }

  /* Kelly (Çeyrek) */
  static kellyHesapla(p, o, kesir = 0.25) {
    const b = o - 1;
    const fStar = (p * o - 1) / b;
    if (fStar <= 0) return 0;
    return Math.min(fStar * kesir * 100, 5.0);
  }

  /* Ana Analiz */
  static analizEt(veri) {
    const { o1, oX, o2, oU25, oA25, oKgV, oKgY } = veri;

    const shin = this.shinMarjArindir(o1, oX, o2);
    const marj25 = this.ikiliMarjArindir(oU25, oA25);
    const marjKg = this.ikiliMarjArindir(oKgV, oKgY);

    const xg = this.xgTahminEt(shin.p1, shin.pX, shin.p2);
    const poi = this.dixonColesMatris(xg.xgEv, xg.xgDep);

    const valueFirsatlari = [];

    const degerlendir = (etiket, oran, temizOran, modelOlasilik) => {
      if (!oran || oran <= 1) return;

      const ev = modelOlasilik * oran;

      if (ev >= 1.02) {
        let guc = 'Hafif Değer';
        let sinif = 'light';
        if (ev >= 1.15) { guc = '⚠️ Şüpheli'; sinif = 'suspicious'; }
        else if (ev >= 1.10) { guc = '🔥 Çok Güçlü'; sinif = 'strong'; }
        else if (ev >= 1.05) { guc = '⚡ Güçlü'; sinif = 'medium'; }

        valueFirsatlari.push({
          market: etiket,
          oran: oran,
          temizOran: temizOran ? temizOran.toFixed(2) : '-',
          modelOlasilikYuzde: (modelOlasilik * 100).toFixed(1),
          ev: ev.toFixed(3),
          guc: guc,
          sinif: sinif,
          kellyYuzde: this.kellyHesapla(modelOlasilik, oran).toFixed(2)
        });
      }
    };

    degerlendir('2.5 Üst', oU25, marj25?.oA_temiz, poi.pUst25);
    degerlendir('2.5 Alt', oA25, marj25?.oB_temiz, poi.pAlt25);
    degerlendir('KG Var', oKgV, marjKg?.oA_temiz, poi.pKgVar);
    degerlendir('KG Yok', oKgY, marjKg?.oB_temiz, poi.pKgYok);

    valueFirsatlari.sort((a, b) => parseFloat(b.ev) - parseFloat(a.ev));

    return {
      marj1X2: shin.marjYuzde.toFixed(2),
      marj25: marj25 ? marj25.marjYuzde.toFixed(2) : null,
      marjKg: marjKg ? marjKg.marjYuzde.toFixed(2) : null,
      shin: {
        p1: (shin.p1 * 100).toFixed(1),
        pX: (shin.pX * 100).toFixed(1),
        p2: (shin.p2 * 100).toFixed(1)
      },
      xgEv: xg.xgEv.toFixed(2),
      xgDep: xg.xgDep.toFixed(2),
      poisson: {
        p1: (poi.p1 * 100).toFixed(1),
        pX: (poi.pX * 100).toFixed(1),
        p2: (poi.p2 * 100).toFixed(1),
        pUst25: (poi.pUst25 * 100).toFixed(1),
        pAlt25: (poi.pAlt25 * 100).toFixed(1),
        pKgVar: (poi.pKgVar * 100).toFixed(1),
        pKgYok: (poi.pKgYok * 100).toFixed(1)
      },
      valueFirsatlari
    };
  }
}

/* ============================================================
   2. UYGULAMA DURUMU
   ============================================================ */
let maclarData = [];
let oranlarData = JSON.parse(localStorage.getItem('skorlab_oranlar') || '{}');
let secimlerim = JSON.parse(localStorage.getItem('skorlab_secimlerim') || '{}');
let kayitliKuponlar = JSON.parse(localStorage.getItem('skorlab_kuponlar') || '[]');

const $ = id => document.getElementById(id);

/* ============================================================
   3. VERİ YÜKLE
   ============================================================ */
async function loadData(){
  try{
    const res = await fetch('matches.json');
    if(!res.ok) throw new Error('HTTP ' + res.status);
    const raw = await res.json();
    maclarData = raw.maclar || [];
    $('weekTitle').innerText = raw.hafta || 'Bu Hafta';
  }catch(e){
    console.error(e);
    $('weekTitle').innerText = 'Veri Yüklenemedi';
  }
  renderBulten();
  renderKayitliKuponlar();
  updateStats();
  updateKuponCubugu();
}

/* ============================================================
   4. ORAN GÜNCELLE
   ============================================================ */
function oranGuncelle(mac_id, alan, val){
  if(!oranlarData[mac_id]) oranlarData[mac_id] = {};
  const num = parseFloat(val);
  if(!val || isNaN(num)) delete oranlarData[mac_id][alan];
  else oranlarData[mac_id][alan] = num;
  localStorage.setItem('skorlab_oranlar', JSON.stringify(oranlarData));
  renderBulten();
}

/* ============================================================
   5. BÜLTEN RENDER
   ============================================================ */
function renderBulten(){
  if(!maclarData.length){
    $('matchesList').innerHTML = '<div class="card"><div class="muted" style="text-align:center;padding:20px">Maç yok.</div></div>';
    return;
  }

  $('matchesList').innerHTML = maclarData.map(m => {
    const sec = secimlerim[m.mac_id] || [];
    const o = oranlarData[m.mac_id] || {};
    const hasOdds = o['1'] && o['X'] && o['2'];

    let olasGoster = '';
    if(hasOdds){
      const shin = ValueBetEngine.shinMarjArindir(o['1'], o['X'], o['2']);
      olasGoster = `
        <div class="olasi-goster">
          <div><b>%${(shin.p1*100).toFixed(1)}</b></div>
          <div><b>%${(shin.pX*100).toFixed(1)}</b></div>
          <div><b>%${(shin.p2*100).toFixed(1)}</b></div>
        </div>
      `;
    }

    return `
    <div class="mac-kart">
      <div class="mac-head">
        <span class="mac-no">#${m.mac_id}</span>
        <button class="mac-analiz-btn" onclick="analizGoster(${m.mac_id})">📊 ANALİZ</button>
      </div>
      <div class="mac-teams">${m.ev_sahibi} - ${m.deplasman}</div>

      <div class="oran-giris">
        <div class="oran-item"><label>1</label><input type="number" step="0.01" value="${o['1']||''}" oninput="oranGuncelle(${m.mac_id},'1',this.value)"></div>
        <div class="oran-item"><label>X</label><input type="number" step="0.01" value="${o['X']||''}" oninput="oranGuncelle(${m.mac_id},'X',this.value)"></div>
        <div class="oran-item"><label>2</label><input type="number" step="0.01" value="${o['2']||''}" oninput="oranGuncelle(${m.mac_id},'2',this.value)"></div>
      </div>

      <div class="oran-giris" style="margin-top:6px">
        <div class="oran-item"><label>2.5 Üst</label><input type="number" step="0.01" value="${o['U25']||''}" oninput="oranGuncelle(${m.mac_id},'U25',this.value)"></div>
        <div class="oran-item"><label>2.5 Alt</label><input type="number" step="0.01" value="${o['A25']||''}" oninput="oranGuncelle(${m.mac_id},'A25',this.value)"></div>
        <div class="oran-item"><label>KG Var</label><input type="number" step="0.01" value="${o['KgV']||''}" oninput="oranGuncelle(${m.mac_id},'KgV',this.value)"></div>
      </div>

      ${olasGoster}

      <div class="secim-grid">
        <button class="secim-btn ${sec.includes('1')?'secili':''}" onclick="secimToggle(${m.mac_id},'1')">1</button>
        <button class="secim-btn ${sec.includes('X')?'secili':''}" onclick="secimToggle(${m.mac_id},'X')">X</button>
        <button class="secim-btn ${sec.includes('2')?'secili':''}" onclick="secimToggle(${m.mac_id},'2')">2</button>
      </div>
    </div>`;
  }).join('');
}

/* ============================================================
   6. SEÇİM
   ============================================================ */
function secimToggle(id, secim){
  let sec = secimlerim[id] || [];
  if(sec.includes(secim)) sec = sec.filter(s => s !== secim);
  else sec.push(secim);
  if(sec.length === 0) delete secimlerim[id];
  else secimlerim[id] = sec;
  localStorage.setItem('skorlab_secimlerim', JSON.stringify(secimlerim));
  renderBulten();
  updateStats();
  updateKuponCubugu();
}

function tumSecimleriSil(){
  if(!confirm('Tüm seçimler silinsin mi?')) return;
  secimlerim = {};
  localStorage.setItem('skorlab_secimlerim', '{}');
  renderBulten();
  updateStats();
  updateKuponCubugu();
}

/* ============================================================
   7. KUPON HESAP
   ============================================================ */
function kuponHesapla(){
  let macSayisi = 0, kolon = 1;
  Object.keys(secimlerim).forEach(id => {
    const sec = secimlerim[id];
    if(!sec || !sec.length) return;
    macSayisi++;
    kolon *= sec.length;
  });
  return { macSayisi, kolon, tutar: kolon * 10 };
}

function updateStats(){
  const h = kuponHesapla();
  const sM = $('statMac'); if(sM) sM.innerText = maclarData.length;
  const sS = $('statSecilen'); if(sS) sS.innerText = h.macSayisi;
  const sK = $('statKolon'); if(sK) sK.innerText = h.kolon;
  const sT = $('statTutar'); if(sT) sT.innerText = h.tutar;
}

function updateKuponCubugu(){
  const h = kuponHesapla();
  const kcM = $('kcMac'); if(kcM) kcM.innerText = h.macSayisi;
  const kcK = $('kcKolon'); if(kcK) kcK.innerText = h.kolon;
  const kcT = $('kcTutar'); if(kcT) kcT.innerText = h.tutar + ' TL';
}

/* ============================================================
   8. KUPON KAYDET
   ============================================================ */
function kuponuKaydet(){
  const h = kuponHesapla();
  if(h.macSayisi === 0){ showToast('error','Seçim Yok','Hiç maç seçmedin.'); return; }

  const detaylar = [];
  Object.keys(secimlerim).forEach(id => {
    const sec = secimlerim[id];
    if(!sec || !sec.length) return;
    const m = maclarData.find(x => x.mac_id == id);
    if(!m) return;
    detaylar.push({
      mac_id: m.mac_id,
      isim: m.ev_sahibi + ' - ' + m.deplasman,
      secim: sec.join(''),
      secimler: sec
    });
  });

  kayitliKuponlar.unshift({
    id: Date.now(),
    tarih: new Date().toLocaleString('tr-TR'),
    macSayisi: h.macSayisi,
    kolon: h.kolon,
    tutar: h.tutar,
    detaylar,
    durum: 'bekliyor'
  });
  if(kayitliKuponlar.length > 50) kayitliKuponlar = kayitliKuponlar.slice(0, 50);
  localStorage.setItem('skorlab_kuponlar', JSON.stringify(kayitliKuponlar));

  secimlerim = {};
  localStorage.setItem('skorlab_secimlerim', '{}');

  renderBulten();
  renderKayitliKuponlar();
  updateStats();
  updateKuponCubugu();
  showToast('success','Kupon Kaydedildi!', h.kolon + ' kolon · ' + h.tutar + ' TL');
}

/* ============================================================
   9. KUPONLARIM
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
    return `
      <div class="kupon-gecmis ${renk}" onclick="kuponDetayAc(${k.id})">
        <div style="display:flex;justify-content:space-between;font-size:.8rem;margin-bottom:4px">
          <span>${emoji} <b>${k.macSayisi} maç</b> · ${k.kolon} kolon</span>
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
      <div class="muted" style="margin-bottom:10px">${emoji} ${k.tarih} · ${k.macSayisi} maç · ${k.kolon} kolon · ${k.tutar} TL</div>
      <div style="max-height:400px;overflow-y:auto;background:var(--bg3);border-radius:8px;padding:10px">
        ${k.detaylar.map(d => `
          <div style="padding:8px 0;border-bottom:1px solid var(--border)">
            <div style="font-weight:800;margin-bottom:4px">#${d.mac_id} ${d.isim}</div>
            <div style="color:var(--green);font-weight:900;text-align:right">${d.secim}</div>
          </div>
        `).join('')}
      </div>
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:6px;margin-top:12px">
        <button class="btn ${k.durum==='kazandi'?'btn-green':'btn-gray'}" onclick="kuponDurum(${id},'kazandi')">✅</button>
        <button class="btn ${k.durum==='bekliyor'?'btn-orange':'btn-gray'}" onclick="kuponDurum(${id},'bekliyor')">⏳</button>
        <button class="btn ${k.durum==='kaybetti'?'btn-red':'btn-gray'}" onclick="kuponDurum(${id},'kaybetti')">❌</button>
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
}

function kuponSil(id){
  if(!confirm('Kupon silinsin mi?')) return;
  kayitliKuponlar = kayitliKuponlar.filter(x => x.id !== id);
  localStorage.setItem('skorlab_kuponlar', JSON.stringify(kayitliKuponlar));
  closeModal('kuponDetayModal');
  renderKayitliKuponlar();
}

/* ============================================================
   10. ANALİZ MODAL (ValueBetEngine Kullanır)
   ============================================================ */
function analizGoster(id){
  const m = maclarData.find(x => x.mac_id === id);
  if(!m) return;
  const o = oranlarData[m.mac_id];
  const sec = secimlerim[id] || [];

  $('analizTitle').innerText = '📊 ' + m.ev_sahibi + ' - ' + m.deplasman;

  if(!o || !o['1'] || !o['X'] || !o['2']){
    $('analizBody').innerHTML = `
      <div style="text-align:center;padding:20px">
        <div class="muted">Oran girilmedi.</div>
        <div class="muted" style="margin-top:8px;font-size:.75rem">Bültenden 1/X/2 oranlarını gir, analiz otomatik çıkar.</div>
      </div>`;
    $('analizModal').classList.add('active');
    return;
  }

  /* ValueBetEngine çalıştır */
  const rapor = ValueBetEngine.analizEt({
    o1: o['1'],
    oX: o['X'],
    o2: o['2'],
    oU25: o['U25'],
    oA25: o['A25'],
    oKgV: o['KgV'],
    oKgY: o['KgY']
  });

  /* Yorum üret */
  let yorum = `Bahisçi bu maçta <b>%${rapor.marj1X2}</b> marj kullanıyor. `;
  if(parseFloat(rapor.xgEv) > parseFloat(rapor.xgDep) + 0.5){
    yorum += `${m.ev_sahibi} ev sahibi avantajıyla xG'de önde (${rapor.xgEv}). `;
  } else if(parseFloat(rapor.xgDep) > parseFloat(rapor.xgEv) + 0.5){
    yorum += `${m.deplasman} xG'de daha üstün (${rapor.xgDep}). `;
  } else {
    yorum += `Dengeli gol beklentisi (${rapor.xgEv} - ${rapor.xgDep}). `;
  }
  if(rapor.valueFirsatlari.length > 0){
    yorum += `En iyi value: <b>${rapor.valueFirsatlari[0].market} @ ${rapor.valueFirsatlari[0].oran}</b> (EV: ${rapor.valueFirsatlari[0].ev}).`;
  } else {
    yorum += `Yan marketlerde value bulunamadı, riskli maç.`;
  }

  $('analizBody').innerHTML = `
    <div style="font-size:.85rem;line-height:1.8">

      <div class="analiz-box">
        <span class="analiz-lbl">📊 1X2 ORANLARI</span>
        <div class="analiz-row"><span>1:</span><b>${o['1']}</b></div>
        <div class="analiz-row"><span>X:</span><b>${o['X']}</b></div>
        <div class="analiz-row"><span>2:</span><b>${o['2']}</b></div>
        <div class="analiz-row"><span class="muted">Marj:</span><b style="color:var(--orange)">%${rapor.marj1X2}</b></div>
      </div>

      <div class="analiz-box">
        <span class="analiz-lbl">🧮 SHIN GERÇEK OLASILIK</span>
        <div class="analiz-row"><span>1:</span><b class="green">%${rapor.shin.p1}</b></div>
        <div class="analiz-row"><span>X:</span><b style="color:var(--orange)">%${rapor.shin.pX}</b></div>
        <div class="analiz-row"><span>2:</span><b>%${rapor.shin.p2}</b></div>
      </div>

      <div class="analiz-box">
        <span class="analiz-lbl">⚽ POISSON MODELİ (xG: ${rapor.xgEv} - ${rapor.xgDep})</span>
        <div class="analiz-row"><span>1:</span><b>%${rapor.poisson.p1}</b></div>
        <div class="analiz-row"><span>X:</span><b>%${rapor.poisson.pX}</b></div>
        <div class="analiz-row"><span>2:</span><b>%${rapor.poisson.p2}</b></div>
        <div class="analiz-row" style="margin-top:6px;border-top:1px solid var(--border);padding-top:6px">
          <span>2.5 Üst:</span><b>%${rapor.poisson.pUst25}</b>
        </div>
        <div class="analiz-row"><span>2.5 Alt:</span><b>%${rapor.poisson.pAlt25}</b></div>
        <div class="analiz-row"><span>KG Var:</span><b>%${rapor.poisson.pKgVar}</b></div>
        <div class="analiz-row"><span>KG Yok:</span><b>%${rapor.poisson.pKgYok}</b></div>
      </div>

      ${rapor.valueFirsatlari.length > 0 ? `
      <div class="analiz-box" style="border:1px solid var(--green)">
        <span class="analiz-lbl">💎 VALUE BET FIRSATLARI</span>
        ${rapor.valueFirsatlari.map(v => `
          <div class="analiz-row" style="padding:6px 0;border-bottom:1px solid var(--border)">
            <div>
              <b style="color:var(--green)">${v.market} @ ${v.oran}</b><br>
              <span class="muted" style="font-size:.7rem">Model: %${v.modelOlasilikYuzde} · EV: ${v.ev}</span>
            </div>
            <div style="text-align:right">
              <div style="font-size:.7rem;color:var(--orange)">${v.guc}</div>
              <div style="font-size:.65rem;color:var(--muted)">Kelly: %${v.kellyYuzde}</div>
            </div>
          </div>
        `).join('')}
      </div>
      ` : `
      <div class="analiz-box" style="border:1px solid var(--red)">
        <span class="analiz-lbl">❌ VALUE BET YOK</span>
        <div class="muted" style="font-size:.75rem">Bu maçta yan marketlerde değerli bahis bulunamadı.</div>
      </div>
      `}

      <div class="yorum-box">
        <div class="baslik">💡 YORUM</div>
        <p>${yorum}</p>
      </div>

      <div style="margin-top:16px;padding:12px;background:var(--bg3);border-radius:10px">
        <div style="font-weight:900;color:var(--green);font-size:.85rem;margin-bottom:10px">🖐️ SENİN SEÇİMİN</div>
        <div class="secim-grid">
          <button class="secim-btn ${sec.includes('1')?'secili':''}" onclick="secimToggle(${id},'1');analizGoster(${id})">1</button>
          <button class="secim-btn ${sec.includes('X')?'secili':''}" onclick="secimToggle(${id},'X');analizGoster(${id})">X</button>
          <button class="secim-btn ${sec.includes('2')?'secili':''}" onclick="secimToggle(${id},'2');analizGoster(${id})">2</button>
        </div>
      </div>

    </div>`;

  $('analizModal').classList.add('active');
}

/* ============================================================
   11. NAV / MODAL
   ============================================================ */
function switchTab(i, el){
  document.querySelectorAll('.tab, .page').forEach(e => e.classList.remove('active'));
  if(el) el.classList.add('active');
  $('page-'+i).classList.add('active');
  if(i === 2) renderKayitliKuponlar();
}

function closeModal(id){ $(id).classList.remove('active'); }
function showToast(type, title, msg){
  $('toastIcon').innerText = type==='success' ? '✅' : '❌';
  $('toastTitle').innerText = title;
  $('toastMsg').innerText = msg;
  $('toastModal').classList.add('active');
}

window.onload = function(){ loadData(); };
