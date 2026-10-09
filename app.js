/* ============================================================
   SKORLAB · Basit & Kullanışlı
   ============================================================ */

let maclarData = [];
let oranlarData = JSON.parse(localStorage.getItem('skorlab_oranlar') || '{}');
let secimlerim = JSON.parse(localStorage.getItem('skorlab_secimlerim') || '{}');
let kayitliKuponlar = JSON.parse(localStorage.getItem('skorlab_kuponlar') || '[]');

const $ = id => document.getElementById(id);

/* ==================== VERİ YÜKLE ==================== */
async function loadData(){
  try{
    const res = await fetch('matches.json');
    if(!res.ok) throw new Error('HTTP '+res.status);
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

/* ==================== ORAN & OLASILIK ==================== */
function oranGuncelle(mac_id, alan, val){
  if(!oranlarData[mac_id]) oranlarData[mac_id] = {};
  const num = parseFloat(val);
  if(!val || isNaN(num)) delete oranlarData[mac_id][alan];
  else oranlarData[mac_id][alan] = num;
  localStorage.setItem('skorlab_oranlar', JSON.stringify(oranlarData));
  renderBulten();
}

function olasilikHesapla(o1, oX, o2){
  if(!o1 || !oX || !o2) return null;
  const r1 = 1/o1, rX = 1/oX, r2 = 1/o2;
  const toplam = r1 + rX + r2;
  const marj = (toplam - 1) * 100;
  return {
    ham1: (r1/toplam)*100,
    hamX: (rX/toplam)*100,
    ham2: (r2/toplam)*100,
    gercek1: r1*100,
    gercekX: rX*100,
    gercek2: r2*100,
    marj
  };
}

/* ==================== ANALİZ MOTORU ==================== */
function analizUret(m){
  const o = oranlarData[m.mac_id];
  if(!o || !o['1'] || !o['X'] || !o['2']) return null;

  const o1 = o['1'], oX = o['X'], o2 = o['2'];
  const p = olasilikHesapla(o1, oX, o2);

  const secenekler = [
    { kod:'1', oran:o1, olas:p.ham1, ev:p.ham1/100*o1 },
    { kod:'X', oran:oX, olas:p.hamX, ev:p.hamX/100*oX },
    { kod:'2', oran:o2, olas:p.ham2, ev:p.ham2/100*o2 }
  ].sort((a,b) => b.olas - a.olas);

  const fav = secenekler[0];
  const enYuksek = fav.olas;
  const enDusuk = secenekler[2].olas;
  const fark = secenekler[0].olas - secenekler[1].olas;

  // Sınıflandırma
  let tip = '';
  let className = 'yorum-box';
  let satirlar = [];

  if(enYuksek >= 65){
    tip = '🔒 NET FAVORİ';
    satirlar.push(`<b>${fav.kod}</b> %${fav.olas.toFixed(1)} ile net favori.`);
  } else if(enYuksek >= 55){
    tip = '✅ GÜÇLÜ FAVORİ';
    satirlar.push(`<b>${fav.kod}</b> %${fav.olas.toFixed(1)} ile güçlü favori.`);
  } else if(enYuksek >= 45){
    tip = '⚠️ RİSKLİ FAVORİ';
    className = 'yorum-box riskli';
    satirlar.push(`<b>${fav.kod}</b> %${fav.olas.toFixed(1)} ile riskli favori.`);
  } else {
    tip = '⚖️ BELİRSİZ MAÇ';
    className = 'yorum-box tehlike';
    satirlar.push(`En yüksek olasılık <b>${fav.kod}</b> ama sadece %${fav.olas.toFixed(1)}.`);
  }

  // Marj yorumu
  if(p.marj > 8){
    satirlar.push(`📊 Bahisçi marjı <b style="color:var(--red)">%${p.marj.toFixed(2)}</b> → yüksek. Bu maçta oynamak dezavantajlı.`);
  } else if(p.marj > 5){
    satirlar.push(`📊 Bahisçi marjı <b style="color:var(--orange)">%${p.marj.toFixed(2)}</b> → ortalama.`);
  } else {
    satirlar.push(`📊 Bahisçi marjı <b class="green">%${p.marj.toFixed(2)}</b> → düşük. İyi oran.`);
  }

  // Tuzak
  if(enYuksek >= 50 && p.hamX >= 25){
    satirlar.push(`⚠️ Beraberlik %${p.hamX.toFixed(1)} → <b>tuzak riski var.</b> Çift düşün.`);
  }

  // Sürpriz
  if(enDusuk >= 22){
    satirlar.push(`🚨 En düşük ihtimal %${enDusuk.toFixed(1)} → <b>sürpriz potansiyeli var.</b>`);
  }

  // Denge
  if(fark < 8 && secenekler[1].olas >= 25){
    satirlar.push(`⚖️ İki taraf yakın. <b>Üçlü kapatmak</b> mantıklı olabilir.`);
  }

  // Value bet (marj çıkarılmış gerçek olasılık + oran)
  const gercekOlas = { '1': p.ham1, 'X': p.hamX, '2': p.ham2 };
  const oranMap = { '1': o1, 'X': oX, '2': o2 };
  ['1','X','2'].forEach(k => {
    const ev = (gercekOlas[k]/100) * oranMap[k];
    if(ev > 1.08){
      satirlar.push(`💎 <b>Value Bet:</b> ${k} @ ${oranMap[k]} (EV: ${ev.toFixed(2)})`);
    }
  });

  return { tip, className, satirlar, p, secenekler, fav };
}

/* ==================== BÜLTEN ==================== */
function renderBulten(){
  if(!maclarData.length){
    $('matchesList').innerHTML = '<div class="card"><div class="muted" style="text-align:center;padding:20px">Maç yok.</div></div>';
    return;
  }

  $('matchesList').innerHTML = maclarData.map(m => {
    const sec = secimlerim[m.mac_id] || [];
    const o = oranlarData[m.mac_id] || {};
    const p = (o['1'] && o['X'] && o['2']) ? olasilikHesapla(o['1'], o['X'], o['2']) : null;

    let olasGoster = '';
    if(p){
      olasGoster = `
        <div class="olasi-goster">
          <div><b>%${p.ham1.toFixed(1)}</b></div>
          <div><b>%${p.hamX.toFixed(1)}</b></div>
          <div><b>%${p.ham2.toFixed(1)}</b></div>
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
      ${olasGoster}
      <div class="secim-grid">
        <button class="secim-btn ${sec.includes('1')?'secili':''}" onclick="secimToggle(${m.mac_id},'1')">1</button>
        <button class="secim-btn ${sec.includes('X')?'secili':''}" onclick="secimToggle(${m.mac_id},'X')">X</button>
        <button class="secim-btn ${sec.includes('2')?'secili':''}" onclick="secimToggle(${m.mac_id},'2')">2</button>
      </div>
    </div>`;
  }).join('');
}

/* ==================== SEÇİM ==================== */
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

/* ==================== KUPON HESAP ==================== */
function kuponHesapla(){
  let macSayisi = 0, kolon = 1;
  Object.keys(secimlerim).forEach(id => {
    const sec = secimlerim[id];
    if(!sec || !sec.length) return;
    macSayisi++;
    kolon *= sec.length;
  });
  const tutar = kolon * 10;
  return { macSayisi, kolon, tutar };
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

/* ==================== KUPON KAYDET ==================== */
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

  const yeni = {
    id: Date.now(),
    tarih: new Date().toLocaleString('tr-TR'),
    macSayisi: h.macSayisi,
    kolon: h.kolon,
    tutar: h.tutar,
    detaylar: detaylar,
    durum: 'bekliyor'
  };
  kayitliKuponlar.unshift(yeni);
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

/* ==================== KUPONLARIM ==================== */
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

/* ==================== ANALİZ MODAL ==================== */
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

  const analiz = analizUret(m);

  $('analizBody').innerHTML = `
    <div style="font-size:.85rem;line-height:1.8">

      <div class="analiz-box">
        <span class="analiz-lbl">📊 ORANLAR</span>
        <div class="analiz-row"><span>1:</span><b>${o['1']}</b></div>
        <div class="analiz-row"><span>X:</span><b>${o['X']}</b></div>
        <div class="analiz-row"><span>2:</span><b>${o['2']}</b></div>
      </div>

      <div class="analiz-box">
        <span class="analiz-lbl">🎯 HAM OLASILIK (Marj Dahil)</span>
        <div class="analiz-row"><span>1:</span><b class="green">%${analiz.p.ham1.toFixed(1)}</b></div>
        <div class="analiz-row"><span>X:</span><b class="orange">%${analiz.p.hamX.toFixed(1)}</b></div>
        <div class="analiz-row"><span>2:</span><b>%${analiz.p.ham2.toFixed(1)}</b></div>
      </div>

      <div class="analiz-box">
        <span class="analiz-lbl">🧮 GERÇEK OLASILIK (Marj Çıkarıldı)</span>
        <div class="analiz-row"><span>1:</span><b class="green">%${analiz.p.gercek1.toFixed(1)}</b></div>
        <div class="analiz-row"><span>X:</span><b class="orange">%${analiz.p.gercekX.toFixed(1)}</b></div>
        <div class="analiz-row"><span>2:</span><b>%${analiz.p.gercek2.toFixed(1)}</b></div>
        <div class="analiz-row muted" style="margin-top:4px;font-size:.7rem">Toplam: %${(analiz.p.gercek1+analiz.p.gercekX+analiz.p.gercek2).toFixed(1)}</div>
      </div>

      <div class="analiz-box">
        <span class="analiz-lbl">💰 BAHİSÇİ MARJI</span>
        <div class="analiz-row">
          <span>Marj:</span>
          <b class="${analiz.p.marj > 8 ? 'red' : analiz.p.marj > 5 ? 'orange' : 'green'}">%${analiz.p.marj.toFixed(2)}</b>
        </div>
        <div class="analiz-row muted" style="font-size:.72rem">
          ${analiz.p.marj > 8 ? '⚠️ Yüksek marj — dezavantajlı' :
            analiz.p.marj > 5 ? '⚡ Ortalama marj' :
            '✅ Düşük marj — iyi oran'}
        </div>
      </div>

      <div class="${analiz.className}">
        <div class="baslik">${analiz.tip}</div>
        ${analiz.satirlar.map(s => `<p>${s}</p>`).join('')}
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

/* ==================== NAV / MODAL ==================== */
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
