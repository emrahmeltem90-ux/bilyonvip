/* ============================================================
   SKORLAB v19 PRO · Form + Yüzde + Oran + Value Bet
   ============================================================ */

let maclarData = [];
let oranlarData = JSON.parse(localStorage.getItem('skorlab_oranlar') || '{}');
let secimlerim = JSON.parse(localStorage.getItem('skorlab_secimlerim') || '{}');
let kayitliKuponlar = JSON.parse(localStorage.getItem('skorlab_kuponlar') || '[]');
let haftaAdi = '';

const $ = id => document.getElementById(id);

/* ==================== VERİ YÜKLE ==================== */
async function loadData(){
  try{
    const res = await fetch('matches.json');
    if(!res.ok) throw new Error('HTTP '+res.status);
    const raw = await res.json();
    haftaAdi = raw.hafta || 'Bu Hafta';
    maclarData = raw.maclar || [];
    $('weekTitle').innerText = haftaAdi;
  }catch(e){
    console.error(e);
    $('weekTitle').innerText = 'Veri Yüklenemedi';
  }
  renderBulten(); renderKupon(); renderKayitliKuponlar();
  updateStats(); updateKuponCubugu();
}

/* ==================== FORM ==================== */
function formHTML(form){
  return (form||[]).map(f => `<span class="form-dot form-${f}">${f}</span>`).join('');
}
function formSayim(form){
  const s = { G:0, B:0, M:0 };
  (form||[]).forEach(f => { if(s[f]!==undefined) s[f]++; });
  return s;
}

/* ==================== ORAN & VALUE BET ==================== */
function oranGuncelle(mac_id, alan, val){
  if(!oranlarData[mac_id]) oranlarData[mac_id] = {};
  const num = parseFloat(val);
  if(!val || isNaN(num)) delete oranlarData[mac_id][alan];
  else oranlarData[mac_id][alan] = num;
  localStorage.setItem('skorlab_oranlar', JSON.stringify(oranlarData));
  updateStats();
}

function marjHesapla(o1, oX, o2){
  if(!o1 || !oX || !o2) return null;
  const r1 = 1/o1, rX = 1/oX, r2 = 1/o2;
  const t = r1 + rX + r2;
  return {
    marj: ((t-1)*100),
    hamP1: (r1/t)*100,
    hamPX: (rX/t)*100,
    hamP2: (r2/t)*100,
    gercekP1: r1*100,
    gercekPX: rX*100,
    gercekP2: r2*100
  };
}

function valueBet(m){
  const o = oranlarData[m.mac_id];
  if(!o || !o['1'] || !o['X'] || !o['2']) return null;
  const y = m.tahmini_yuzdeler;
  const ev1 = (y.ev_galibiyet/100) * o['1'];
  const evX = (y.beraberlik/100) * o['X'];
  const ev2 = (y.deplasman_galibiyet/100) * o['2'];
  const enIyi = [
    { kod:'1', ev:ev1, oran:o['1'], olas:y.ev_galibiyet },
    { kod:'X', ev:evX, oran:o['X'], olas:y.beraberlik },
    { kod:'2', ev:ev2, oran:o['2'], olas:y.deplasman_galibiyet }
  ].sort((a,b) => b.ev - a.ev)[0];
  return {
    ...enIyi,
    degerli: enIyi.ev > 1.05
  };
}

/* ==================== ANALİZ YORUM ==================== */
function yorumUret(m){
  const y = m.tahmini_yuzdeler;
  const ev = y.ev_galibiyet, x = y.beraberlik, dep = y.deplasman_galibiyet;
  const evForm = formSayim(m.ev_form);
  const depForm = formSayim(m.deplasman_form);
  const o = oranlarData[m.mac_id];
  const vb = valueBet(m);

  let baslik = '';
  let className = 'yorum-box';
  let satirlar = [];

  const enYuksek = Math.max(ev, x, dep);

  if(enYuksek === ev){
    if(ev >= 60){ baslik = '🔒 NET FAVORİ'; satirlar.push(`Ev sahibi <b>%${ev}</b> ile net favori.`); }
    else if(ev >= 50){ baslik = '✅ GÜÇLÜ FAVORİ'; satirlar.push(`Ev sahibi <b>%${ev}</b> ile favori.`); }
    else { baslik = '⚠️ RİSKLİ FAVORİ'; className = 'yorum-box riskli'; satirlar.push(`Ev sahibi <b>%${ev}</b> ile hafif favori.`); }
  } else if(enYuksek === x){
    baslik = '⚡ BERABERLİK ADAYI';
    className = 'yorum-box riskli';
    satirlar.push(`Beraberlik <b>%${x}</b> ile en yüksek ihtimal.`);
  } else {
    if(dep >= 60){ baslik = '🔒 DEPLASMAN NET FAVORİ'; satirlar.push(`Deplasman <b>%${dep}</b> ile net favori.`); }
    else if(dep >= 50){ baslik = '✅ DEPLASMAN FAVORİ'; satirlar.push(`Deplasman <b>%${dep}</b> ile favori.`); }
    else { baslik = '⚠️ DEPLASMAN RİSKLİ'; className = 'yorum-box riskli'; satirlar.push(`Deplasman <b>%${dep}</b> ile hafif favori.`); }
  }

  if(evForm.G >= 3) satirlar.push(`🔥 Ev sahibi <b>formda</b> (${evForm.G}G ${evForm.B}B ${evForm.M}M)`);
  else if(evForm.M >= 3) satirlar.push(`❄️ Ev sahibi <b>formsuz</b> (${evForm.G}G ${evForm.B}B ${evForm.M}M)`);
  if(depForm.G >= 3) satirlar.push(`🔥 Deplasman <b>formda</b> (${depForm.G}G ${depForm.B}B ${depForm.M}M)`);
  else if(depForm.M >= 3) satirlar.push(`❄️ Deplasman <b>formsuz</b> (${depForm.G}G ${depForm.B}B ${depForm.M}M)`);

  if(enYuksek >= 60 && x >= 25) satirlar.push(`⚠️ <b>Tuzak riski:</b> Beraberlik %${x}. Çift düşün.`);

  const enDusuk = Math.min(ev, x, dep);
  if(enDusuk >= 25) satirlar.push(`🚨 <b>Sürpriz potansiyeli:</b> En düşük %${enDusuk}. Dikkat.`);

  if(Math.abs(ev - dep) <= 8 && x >= 25) satirlar.push(`⚖️ <b>Dengeli maç:</b> Üçlü düşün.`);

  if(o && o['1'] && o['X'] && o['2']){
    const marj = marjHesapla(o['1'], o['X'], o['2']);
    satirlar.push(`📊 Bahisçi marjı: <b>%${marj.marj.toFixed(2)}</b>`);
    if(vb && vb.degerli){
      satirlar.push(`💎 <b>VALUE BET:</b> ${vb.kod} @ ${vb.oran} (EV: ${vb.ev.toFixed(2)})`);
    }
  }

  return { baslik, className, satirlar };
}

/* ==================== BÜLTEN ==================== */
function renderBulten(){
  if(!maclarData.length){
    $('matchesList').innerHTML = '<div class="card"><div class="muted" style="text-align:center;padding:20px">Maç yok.</div></div>';
    return;
  }

  $('matchesList').innerHTML = maclarData.map(m => {
    const sec = secimlerim[m.mac_id] || [];
    const y = m.tahmini_yuzdeler;
    const o = oranlarData[m.mac_id] || {};
    const vb = valueBet(m);
    const valueTag = (vb && vb.degerli) ? `<div><span class="value-tag value-yes">💎 DEĞER: ${vb.kod} (EV ${vb.ev.toFixed(2)})</span></div>` : '';

    return `
    <div class="mac-kart">
      <div class="mac-head">
        <span class="mac-no">#${m.mac_id}</span>
        <span>${formHTML(m.ev_form)}<span style="margin:0 4px;color:var(--muted)">vs</span>${formHTML(m.deplasman_form)}</span>
      </div>
      <div class="mac-teams" onclick="macDetayGoster(${m.mac_id})">
        ${m.ev_sahibi} - ${m.deplasman}
      </div>
      <div class="mac-yuzde">
        <div class="yuzde-box"><div class="lbl">1</div><div class="val" style="color:var(--green)">%${y.ev_galibiyet}</div></div>
        <div class="yuzde-box"><div class="lbl">X</div><div class="val" style="color:var(--orange)">%${y.beraberlik}</div></div>
        <div class="yuzde-box"><div class="lbl">2</div><div class="val" style="color:var(--blue)">%${y.deplasman_galibiyet}</div></div>
      </div>
      <div class="oran-giris">
        <div class="oran-item"><label>1 Oran</label><input type="number" step="0.01" value="${o['1']||''}" oninput="oranGuncelle(${m.mac_id},'1',this.value)"></div>
        <div class="oran-item"><label>X Oran</label><input type="number" step="0.01" value="${o['X']||''}" oninput="oranGuncelle(${m.mac_id},'X',this.value)"></div>
        <div class="oran-item"><label>2 Oran</label><input type="number" step="0.01" value="${o['2']||''}" oninput="oranGuncelle(${m.mac_id},'2',this.value)"></div>
      </div>
      ${valueTag}
      <div class="secim-grid" style="margin-top:10px">
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
  renderBulten(); renderKupon(); updateStats(); updateKuponCubugu();
}

function tumSecimleriSil(){
  if(!confirm('Tüm seçimler silinsin mi?')) return;
  secimlerim = {};
  localStorage.setItem('skorlab_secimlerim', '{}');
  renderBulten(); renderKupon(); updateStats(); updateKuponCubugu();
}

/* ==================== KUPON ==================== */
function kuponHesapla(){
  let macSayisi = 0, kolon = 1;
  const detaylar = [];
  Object.keys(secimlerim).forEach(id => {
    const sec = secimlerim[id];
    if(!sec || !sec.length) return;
    macSayisi++;
    kolon *= sec.length;
    const m = maclarData.find(x => x.mac_id == id);
    if(m) detaylar.push({ mac: m, secimler: sec });
  });
  const tutar = kolon * 10;
  return { macSayisi, kolon, tutar, detaylar };
}

function updateStats(){
  const h = kuponHesapla();
  const sM = $('statMac'); if(sM) sM.innerText = maclarData.length;
  const sS = $('statSecilen'); if(sS) sS.innerText = h.macSayisi;
  const sK = $('statKolon'); if(sK) sK.innerText = h.kolon;
  let deger = 0;
  maclarData.forEach(m => {
    const vb = valueBet(m);
    if(vb && vb.degerli) deger++;
  });
  const sD = $('statDeger'); if(sD) sD.innerText = deger;
}

function updateKuponCubugu(){
  const h = kuponHesapla();
  const kcM = $('kcMac'); if(kcM) kcM.innerText = h.macSayisi;
  const kcK = $('kcKolon'); if(kcK) kcK.innerText = h.kolon;
  const kcT = $('kcTutar'); if(kcT) kcT.innerText = h.tutar + ' TL';
}

function renderKupon(){
  const h = kuponHesapla();
  const o = $('kuponOzet');
  if(o){
    if(h.macSayisi === 0){
      o.innerHTML = '<div class="muted" style="text-align:center;padding:20px">Henüz maç seçmedin.<br>Bülten sekmesinden 1-X-2 tıkla.</div>';
    } else {
      o.innerHTML = `
        <div class="analiz-box">
          <div class="analiz-row"><span>Seçilen Maç:</span><b>${h.macSayisi}</b></div>
          <div class="analiz-row"><span>Toplam Kolon:</span><b class="green">${h.kolon}</b></div>
          <div class="analiz-row"><span>Toplam Tutar:</span><b class="green">${h.tutar} TL</b></div>
        </div>
        <button class="btn btn-green btn-lg" onclick="kuponuKaydet()" style="margin-top:12px">💾 KUPONU KAYDET</button>
      `;
    }
  }
  const c = $('kuponMaclar');
  if(c){
    if(h.detaylar.length === 0){
      c.innerHTML = '<div class="muted" style="text-align:center;padding:14px">Seçim yok.</div>';
    } else {
      c.innerHTML = h.detaylar.map(d => `
        <div style="background:var(--bg3);border-radius:8px;padding:10px;margin-bottom:8px">
          <div style="font-weight:800;font-size:.82rem;margin-bottom:4px">#${d.mac.mac_id} ${d.mac.ev_sahibi} - ${d.mac.deplasman}</div>
          <div style="color:var(--green);font-weight:900;font-size:.9rem">${d.secimler.join('')}</div>
        </div>
      `).join('');
    }
  }
}

function kuponuKaydet(){
  const h = kuponHesapla();
  if(h.macSayisi === 0){ showToast('error','Seçim Yok','Hiç maç seçmedin.'); return; }
  const detaylar = h.detaylar.map(d => ({
    mac_id: d.mac.mac_id,
    isim: d.mac.ev_sahibi + ' - ' + d.mac.deplasman,
    secim: d.secimler.join(''),
    secimler: d.secimler
  }));
  const yeni = {
    id: Date.now(),
    tarih: new Date().toLocaleString('tr-TR'),
    macSayisi: h.macSayisi, kolon: h.kolon, tutar: h.tutar,
    detaylar: detaylar, durum: 'bekliyor'
  };
  kayitliKuponlar.unshift(yeni);
  if(kayitliKuponlar.length > 50) kayitliKuponlar = kayitliKuponlar.slice(0, 50);
  localStorage.setItem('skorlab_kuponlar', JSON.stringify(kayitliKuponlar));
  secimlerim = {};
  localStorage.setItem('skorlab_secimlerim', '{}');
  renderBulten(); renderKupon(); renderKayitliKuponlar();
  updateStats(); updateKuponCubugu();
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
        <div style="display:flex;justify-content:space-between;font-size:.78rem;margin-bottom:4px">
          <span>${emoji} <b>${k.macSayisi} maç</b> · ${k.kolon} kolon</span>
          <span class="muted">${k.tarih}</span>
        </div>
        <div style="font-size:.7rem;color:var(--muted)">Tutar: <b style="color:var(--green)">${k.tutar} TL</b></div>
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
}

function kuponSil(id){
  if(!confirm('Kupon silinsin mi?')) return;
  kayitliKuponlar = kayitliKuponlar.filter(x => x.id !== id);
  localStorage.setItem('skorlab_kuponlar', JSON.stringify(kayitliKuponlar));
  closeModal('kuponDetayModal');
  renderKayitliKuponlar();
}

/* ==================== MAÇ DETAY / ANALİZ ==================== */
function macDetayGoster(id){
  const m = maclarData.find(x => x.mac_id === id);
  if(!m) return;
  const y = m.tahmini_yuzdeler;
  const o = oranlarData[m.mac_id] || {};
  const sec = secimlerim[id] || [];
  const yorum = yorumUret(m);
  const evForm = formSayim(m.ev_form);
  const depForm = formSayim(m.deplasman_form);
  const vb = valueBet(m);
  const marj = (o['1'] && o['X'] && o['2']) ? marjHesapla(o['1'], o['X'], o['2']) : null;

  $('macDetayTitle').innerText = '📊 Maç #' + id + ' Analizi';

  $('macDetayBody').innerHTML = `
    <div style="font-size:.85rem;line-height:1.8">

      <div style="text-align:center;margin-bottom:14px">
        <div style="font-weight:900;font-size:1rem">${m.ev_sahibi}</div>
        <div style="color:var(--muted);font-size:.75rem;margin:4px 0">vs</div>
        <div style="font-weight:900;font-size:1rem">${m.deplasman}</div>
      </div>

      <div class="analiz-box">
        <span class="analiz-lbl">📈 FORM DURUMU</span>
        <div class="analiz-row"><span>${m.ev_sahibi}:</span><span>${formHTML(m.ev_form)}</span></div>
        <div class="analiz-row"><span class="muted">${evForm.G}G · ${evForm.B}B · ${evForm.M}M</span></div>
        <div class="analiz-row" style="margin-top:8px"><span>${m.deplasman}:</span><span>${formHTML(m.deplasman_form)}</span></div>
        <div class="analiz-row"><span class="muted">${depForm.G}G · ${depForm.B}B · ${depForm.M}M</span></div>
      </div>

      <div class="analiz-box">
        <span class="analiz-lbl">🎯 TAHMİN YÜZDELERİ</span>
        <div class="analiz-row"><span>Ev Sahibi (1):</span><b class="green">%${y.ev_galibiyet}</b></div>
        <div class="analiz-row"><span>Beraberlik (X):</span><b style="color:var(--orange)">%${y.beraberlik}</b></div>
        <div class="analiz-row"><span>Deplasman (2):</span><b style="color:var(--blue)">%${y.deplasman_galibiyet}</b></div>
      </div>

      ${marj ? `
      <div class="analiz-box">
        <span class="analiz-lbl">📊 BAHİSÇİ ANALİZİ</span>
        <div class="analiz-row"><span>Oranlar:</span><b>${o['1']} / ${o['X']} / ${o['2']}</b></div>
        <div class="analiz-row"><span>Bahisçi Ham %:</span><span>${marj.hamP1.toFixed(1)} / ${marj.hamPX.toFixed(1)} / ${marj.hamP2.toFixed(1)}</span></div>
        <div class="analiz-row"><span>Marj:</span><b style="color:var(--orange)">%${marj.marj.toFixed(2)}</b></div>
        ${vb ? `<div class="analiz-row"><span>En İyi EV:</span><b class="${vb.degerli?'green':'red'}">${vb.kod} → ${vb.ev.toFixed(3)}</b></div>` : ''}
      </div>
      ` : `
      <div class="analiz-box">
        <span class="analiz-lbl">📊 BAHİSÇİ ANALİZİ</span>
        <div class="analiz-row"><span class="muted">Oran girilmedi. Bültenden 1/X/2 oranlarını gir.</span></div>
      </div>
      `}

      <div class="${yorum.className}">
        <div class="baslik">${yorum.baslik}</div>
        ${yorum.satirlar.map(s => `<p>${s}</p>`).join('')}
      </div>

      <div style="margin-top:16px;padding:12px;background:var(--bg3);border-radius:10px">
        <div style="font-weight:900;color:var(--green);font-size:.82rem;margin-bottom:10px">🖐️ SENİN SEÇİMİN</div>
        <div class="secim-grid">
          <button class="secim-btn ${sec.includes('1')?'secili':''}" onclick="detayToggle(${id},'1')">1</button>
          <button class="secim-btn ${sec.includes('X')?'secili':''}" onclick="detayToggle(${id},'X')">X</button>
          <button class="secim-btn ${sec.includes('2')?'secili':''}" onclick="detayToggle(${id},'2')">2</button>
        </div>
      </div>

    </div>`;

  $('macDetayModal').classList.add('active');
}

function detayToggle(id, secim){
  secimToggle(id, secim);
  macDetayGoster(id);
}

/* ==================== NAV / MODAL ==================== */
function switchTab(i, el){
  document.querySelectorAll('.tab, .page').forEach(e => e.classList.remove('active'));
  if(el) el.classList.add('active');
  $('page-'+i).classList.add('active');
  if(i === 2) renderKupon();
  if(i === 3) renderKayitliKuponlar();
}

function closeModal(id){ $(id).classList.remove('active'); }
function showToast(type, title, msg){
  $('toastIcon').innerText = type==='success' ? '✅' : '❌';
  $('toastTitle').innerText = title;
  $('toastMsg').innerText = msg;
  $('toastModal').classList.add('active');
}

if('serviceWorker' in navigator){
  window.addEventListener('load', () => { navigator.serviceWorker.register('sw.js').catch(() => {}); });
}

window.onload = function(){ loadData(); };
