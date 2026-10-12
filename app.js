/* ============================================================
   SKORLAB v31 PRO · 28 Oranlı Kombine Sistem
   ============================================================ */

/* ============================================================
   1. VALUE BET ENGINE
   ============================================================ */
class ValueBetEngine {
  static faktoriyel(n){ let r=1; for(let i=2;i<=n;i++) r*=i; return r; }
  static poissonPmf(k,lambda){ return (Math.exp(-lambda)*Math.pow(lambda,k))/this.faktoriyel(k); }

  static shinMarjArindir(o1,oX,o2){
    const p1 = 1/o1, pX = 1/oX, p2 = 1/o2;
    const S = p1 + pX + p2;
    if(S <= 1 || isNaN(S)) return { p1:0.33, pX:0.33, p2:0.34, marjYuzde:0 };
    const z = (S - 1) / S;
    const f = (p) => {
      const num = Math.sqrt(z*z + 4*(1 - z) * (p*p / S)) - z;
      const den = 2 * (1 - z);
      return num / den;
    };
    const a = f(p1), b = f(pX), c = f(p2);
    const t = a + b + c;
    return { p1: a/t, pX: b/t, p2: c/t, marjYuzde: (S - 1) * 100 };
  }

  static ikiliMarjArindir(oA,oB){
    if(!oA || !oB || oA<=1 || oB<=1) return null;
    const pA=1/oA, pB=1/oB;
    const S = pA+pB;
    return { pA_gercek: pA/S, pB_gercek: pB/S, oA_temiz: oA/S, oB_temiz: oB/S, marjYuzde: (S-1)*100 };
  }

  static xgTahminEt(p1, pX, p2){
    const hs = p1 / (p1 + p2 || 1);
    const tg = 2.4 + (1 - pX) * 0.8;
    let xgEv = Math.max(0.7, tg * hs * 1.20);
    let xgDep = Math.max(0.7, tg * (1 - hs) * 0.90);
    for(let i = 0; i < 25; i++){
      const poi = this.dixonColesMatris(xgEv, xgDep);
      const hata1 = poi.p1 - p1;
      const hata2 = poi.p2 - p2;
      if(Math.abs(hata1) < 0.005 && Math.abs(hata2) < 0.005) break;
      xgEv += hata1 * 0.5;
      xgDep += hata2 * 0.5;
      xgEv = Math.max(0.7, Math.min(3.5, xgEv));
      xgDep = Math.max(0.7, Math.min(3.5, xgDep));
    }
    return { xgEv, xgDep };
  }

  static dixonColesMatris(xgEv,xgDep,rho=-0.13){
    const MAX=8;
    let p1=0,pX=0,p2=0,kg=0,ust15=0,ust25=0,ust35=0,alt15=0,alt25=0,alt35=0;
    const skorlar = [];
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
        const top = h+a;
        if(top > 1.5) ust15+=p; if(top < 1.5) alt15+=p;
        if(top > 2.5) ust25+=p; if(top < 2.5) alt25+=p;
        if(top > 3.5) ust35+=p; if(top < 3.5) alt35+=p;
        if(h>=1&&a>=1) kg+=p;
        skorlar.push({ h, a, skor: h+'-'+a, p });
      }
    }
    const t = p1+pX+p2;
    p1/=t; pX/=t; p2/=t;
    ust15/=t; ust25/=t; ust35/=t;
    alt15/=t; alt25/=t; alt35/=t; kg/=t;
    skorlar.forEach(s => s.p /= t);
    skorlar.sort((a,b)=>b.p-a.p);
    return {
      p1,pX,p2,
      pUst15: Math.min(0.99, Math.max(0.01, ust15)),
      pAlt15: Math.min(0.99, Math.max(0.01, alt15)),
      pUst25: Math.min(0.99, Math.max(0.01, ust25)),
      pAlt25: Math.min(0.99, Math.max(0.01, alt25)),
      pUst35: Math.min(0.99, Math.max(0.01, ust35)),
      pAlt35: Math.min(0.99, Math.max(0.01, alt35)),
      pKgVar: Math.min(0.99, Math.max(0.01, kg)),
      pKgYok: Math.min(0.99, Math.max(0.01, 1-kg)),
      enOlasıSkorlar: skorlar.slice(0,5).map(s => ({ skor: s.skor, yuzde: (s.p*100).toFixed(2) })),
      tumSkorlar: skorlar
    };
  }

  static kellyHesapla(p,o,kesir=0.25){
    const b = o-1;
    const f = (p*o - 1)/b;
    if(f<=0) return 0;
    return Math.min(f*kesir*100, 5.0);
  }

  static golluMacAnaliz(poisson, xgEv, xgDep){
    const toplamXg = xgEv + xgDep;
    const pUst25 = parseFloat(poisson.pUst25);
    const pKgVar = parseFloat(poisson.pKgVar);
    const pBeraberlik = parseFloat(poisson.pX);
    let puan = 0;
    const kriterler = [];
    if(toplamXg > 3.0){ puan++; kriterler.push('xG>3'); }
    if(pUst25 > 55){ puan++; kriterler.push('2.5Ü'); }
    if(pKgVar > 55){ puan++; kriterler.push('KG'); }
    if(pBeraberlik > 20){ puan++; kriterler.push('X'); }
    let seviye = '', etiket = '', sinif = '';
    if(puan >= 3){ seviye='gollu'; etiket='🔥 GOLLÜ MAÇ'; sinif='gol-yes'; }
    else if(puan >= 2){ seviye='orta'; etiket='⚡ ORTA'; sinif='gol-orta'; }
    else { seviye='az'; etiket='❄️ AZ GOLLÜ'; sinif='gol-no'; }
    return { seviye, etiket, sinif, puan, toplamXg: toplamXg.toFixed(2), pUst25: pUst25.toFixed(1), pKgVar: pKgVar.toFixed(1), kriterler };
  }

  static senaryolariHesapla(poisson, oranlar){
    const senaryolar = [];
    const tumSkorlar = poisson.tumSkorlar || [];
    const o1 = oranlar.o1, oX = oranlar.oX, o2 = oranlar.o2;
    const oA25 = oranlar.oA25, oU25 = oranlar.oU25;
    const oKgV = oranlar.oKgV, oKgY = oranlar.oKgY;
    const oMS1KgV = oranlar.oMS1KgV, oMSXKgV = oranlar.oMSXKgV, oMS2KgV = oranlar.oMS2KgV;
    const oMS1A15 = oranlar.oMS1A15, oMS1U15 = oranlar.oMS1U15, oMSXA15 = oranlar.oMSXA15, oMSXU15 = oranlar.oMSXU15, oMS2A15 = oranlar.oMS2A15, oMS2U15 = oranlar.oMS2U15;
    const oMS1A25 = oranlar.oMS1A25, oMS1U25 = oranlar.oMS1U25, oMSXA25 = oranlar.oMSXA25, oMSXU25 = oranlar.oMSXU25, oMS2A25 = oranlar.oMS2A25, oMS2U25 = oranlar.oMS2U25;
    const oMS1A35 = oranlar.oMS1A35, oMS1U35 = oranlar.oMS1U35, oMSXA35 = oranlar.oMSXA35, oMSXU35 = oranlar.oMSXU35, oMS2A35 = oranlar.oMS2A35, oMS2U35 = oranlar.oMS2U35;

    const tanimlar = [];
    if(o1) tanimlar.push({ isim:'1 (Ev Sahibi)', tip:'1', filtre: s => s.h > s.a, oran: o1, kategori:'tek' });
    if(oX) tanimlar.push({ isim:'X (Beraberlik)', tip:'X', filtre: s => s.h === s.a, oran: oX, kategori:'tek' });
    if(o2) tanimlar.push({ isim:'2 (Deplasman)', tip:'2', filtre: s => s.h < s.a, oran: o2, kategori:'tek' });
    if(oU25) tanimlar.push({ isim:'2.5 Üst', tip:'2.5Ü', filtre: s => s.h + s.a > 2.5, oran: oU25, kategori:'tek' });
    if(oA25) tanimlar.push({ isim:'2.5 Alt', tip:'2.5A', filtre: s => s.h + s.a < 2.5, oran: oA25, kategori:'tek' });
    if(oKgV) tanimlar.push({ isim:'KG Var', tip:'KGV', filtre: s => s.h >= 1 && s.a >= 1, oran: oKgV, kategori:'tek' });
    if(oKgY) tanimlar.push({ isim:'KG Yok', tip:'KGY', filtre: s => !(s.h >= 1 && s.a >= 1), oran: oKgY, kategori:'tek' });
    if(oMS1KgV) tanimlar.push({ isim:'1 + KG Var', tip:'1+KGV', filtre: s => s.h > s.a && s.a >= 1, oran: oMS1KgV, kategori:'kombine' });
    if(oMSXKgV) tanimlar.push({ isim:'X + KG Var', tip:'X+KGV', filtre: s => s.h === s.a && s.h >= 1, oran: oMSXKgV, kategori:'kombine' });
    if(oMS2KgV) tanimlar.push({ isim:'2 + KG Var', tip:'2+KGV', filtre: s => s.h < s.a && s.h >= 1, oran: oMS2KgV, kategori:'kombine' });
    if(oMS1A15) tanimlar.push({ isim:'1 + 1.5 Alt', tip:'1+1.5A', filtre: s => s.h > s.a && s.h+s.a < 1.5, oran: oMS1A15, kategori:'kombine' });
    if(oMS1U15) tanimlar.push({ isim:'1 + 1.5 Üst', tip:'1+1.5Ü', filtre: s => s.h > s.a && s.h+s.a > 1.5, oran: oMS1U15, kategori:'kombine' });
    if(oMSXA15) tanimlar.push({ isim:'X + 1.5 Alt', tip:'X+1.5A', filtre: s => s.h === s.a && s.h+s.a < 1.5, oran: oMSXA15, kategori:'kombine' });
    if(oMSXU15) tanimlar.push({ isim:'X + 1.5 Üst', tip:'X+1.5Ü', filtre: s => s.h === s.a && s.h+s.a > 1.5, oran: oMSXU15, kategori:'kombine' });
    if(oMS2A15) tanimlar.push({ isim:'2 + 1.5 Alt', tip:'2+1.5A', filtre: s => s.h < s.a && s.h+s.a < 1.5, oran: oMS2A15, kategori:'kombine' });
    if(oMS2U15) tanimlar.push({ isim:'2 + 1.5 Üst', tip:'2+1.5Ü', filtre: s => s.h < s.a && s.h+s.a > 1.5, oran: oMS2U15, kategori:'kombine' });
    if(oMS1A25) tanimlar.push({ isim:'1 + 2.5 Alt', tip:'1+2.5A', filtre: s => s.h > s.a && s.h+s.a < 2.5, oran: oMS1A25, kategori:'kombine' });
    if(oMS1U25) tanimlar.push({ isim:'1 + 2.5 Üst', tip:'1+2.5Ü', filtre: s => s.h > s.a && s.h+s.a > 2.5, oran: oMS1U25, kategori:'kombine' });
    if(oMSXA25) tanimlar.push({ isim:'X + 2.5 Alt', tip:'X+2.5A', filtre: s => s.h === s.a && s.h+s.a < 2.5, oran: oMSXA25, kategori:'kombine' });
    if(oMSXU25) tanimlar.push({ isim:'X + 2.5 Üst', tip:'X+2.5Ü', filtre: s => s.h === s.a && s.h+s.a > 2.5, oran: oMSXU25, kategori:'kombine' });
    if(oMS2A25) tanimlar.push({ isim:'2 + 2.5 Alt', tip:'2+2.5A', filtre: s => s.h < s.a && s.h+s.a < 2.5, oran: oMS2A25, kategori:'kombine' });
    if(oMS2U25) tanimlar.push({ isim:'2 + 2.5 Üst', tip:'2+2.5Ü', filtre: s => s.h < s.a && s.h+s.a > 2.5, oran: oMS2U25, kategori:'kombine' });
    if(oMS1A35) tanimlar.push({ isim:'1 + 3.5 Alt', tip:'1+3.5A', filtre: s => s.h > s.a && s.h+s.a < 3.5, oran: oMS1A35, kategori:'kombine' });
    if(oMS1U35) tanimlar.push({ isim:'1 + 3.5 Üst', tip:'1+3.5Ü', filtre: s => s.h > s.a && s.h+s.a > 3.5, oran: oMS1U35, kategori:'kombine' });
    if(oMSXA35) tanimlar.push({ isim:'X + 3.5 Alt', tip:'X+3.5A', filtre: s => s.h === s.a && s.h+s.a < 3.5, oran: oMSXA35, kategori:'kombine' });
    if(oMSXU35) tanimlar.push({ isim:'X + 3.5 Üst', tip:'X+3.5Ü', filtre: s => s.h === s.a && s.h+s.a > 3.5, oran: oMSXU35, kategori:'kombine' });
    if(oMS2A35) tanimlar.push({ isim:'2 + 3.5 Alt', tip:'2+3.5A', filtre: s => s.h < s.a && s.h+s.a < 3.5, oran: oMS2A35, kategori:'kombine' });
    if(oMS2U35) tanimlar.push({ isim:'2 + 3.5 Üst', tip:'2+3.5Ü', filtre: s => s.h < s.a && s.h+s.a > 3.5, oran: oMS2U35, kategori:'kombine' });

    tanimlar.forEach(t => {
      let olasilik = 0;
      tumSkorlar.forEach(sk => { if(t.filtre(sk)) olasilik += sk.p; });
      const ev = olasilik * t.oran;
      if(olasilik > 0.015 && t.oran > 1.01){
        senaryolar.push({
          isim: t.isim, tip: t.tip, kategori: t.kategori,
          oran: t.oran.toFixed(2),
          olasilik: (olasilik*100).toFixed(1),
          olasilikNum: olasilik,
          ev: ev.toFixed(3),
          evNum: ev
        });
      }
    });
    senaryolar.sort((a,b)=>b.evNum - a.evNum);
    return senaryolar;
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
        values.push({ market, oran, temizOran: temiz ? temiz.toFixed(2) : '-', modelOlas: (modelOlas*100).toFixed(1), ev: ev.toFixed(3), guc, sinif, kelly: this.kellyHesapla(modelOlas, oran).toFixed(2) });
      }
    };

    const m25 = this.ikiliMarjArindir(veri.oU25, veri.oA25);
    const mKg = this.ikiliMarjArindir(veri.oKgV, veri.oKgY);
    kontrol('2.5 Üst', veri.oU25, m25?.oA_temiz, poi.pUst25);
    kontrol('2.5 Alt', veri.oA25, m25?.oB_temiz, poi.pAlt25);
    kontrol('KG Var', veri.oKgV, mKg?.oA_temiz, poi.pKgVar);
    kontrol('KG Yok', veri.oKgY, mKg?.oB_temiz, poi.pKgYok);

    const senaryolar = this.senaryolariHesapla(poi, veri);

    return {
      marj1X2: shin.marjYuzde.toFixed(2),
      shin: { p1: (shin.p1*100).toFixed(1), pX: (shin.pX*100).toFixed(1), p2: (shin.p2*100).toFixed(1) },
      xgEv: xg.xgEv.toFixed(2), xgDep: xg.xgDep.toFixed(2),
      poisson: {
        p1: (poi.p1*100).toFixed(1), pX: (poi.pX*100).toFixed(1), p2: (poi.p2*100).toFixed(1),
        pUst15: (poi.pUst15*100).toFixed(1), pAlt15: (poi.pAlt15*100).toFixed(1),
        pUst25: (poi.pUst25*100).toFixed(1), pAlt25: (poi.pAlt25*100).toFixed(1),
        pUst35: (poi.pUst35*100).toFixed(1), pAlt35: (poi.pAlt35*100).toFixed(1),
        pKgVar: (poi.pKgVar*100).toFixed(1), pKgYok: (poi.pKgYok*100).toFixed(1),
        enOlasıSkorlar: poi.enOlasıSkorlar
      },
      values,
      senaryolar
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
    let evG=0, ber=0, depG=0, ust15=0, ust25=0, ust35=0, kg=0;
    const skorlar = {};
    for(let i=0;i<iter;i++){
      const h = this.poissonRandom(xgEv);
      const a = this.poissonRandom(xgDep);
      const key = h+'-'+a;
      skorlar[key] = (skorlar[key]||0)+1;
      if(h>a) evG++; else if(h===a) ber++; else depG++;
      const top = h+a;
      if(top > 1.5) ust15++;
      if(top > 2.5) ust25++;
      if(top > 3.5) ust35++;
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
      pUst15: ((ust15/iter)*100).toFixed(2),
      pUst25: ((ust25/iter)*100).toFixed(2),
      pUst35: ((ust35/iter)*100).toFixed(2),
      pKgVar: ((kg/iter)*100).toFixed(2),
      enIyiSkorlar: enIyi
    };
  }
}

/* ============================================================
   3. TAHMİN MOTORU
   ============================================================ */
class TahminMotoru {
  static birXikiTahmin(analiz){
    const p1 = parseFloat(analiz.shin.p1);
    const pX = parseFloat(analiz.shin.pX);
    const p2 = parseFloat(analiz.shin.p2);
    const sirali = [
      { kod:'1', olas:p1 }, { kod:'X', olas:pX }, { kod:'2', olas:p2 }
    ].sort((a,b)=>b.olas-a.olas);
    return {
      enOlası: sirali[0].kod,
      enOlasıOlas: sirali[0].olas.toFixed(1),
      ikinci: sirali[1].kod,
      ikinciOlas: sirali[1].olas.toFixed(1),
      surprizRisk: (100 - sirali[0].olas).toFixed(1),
      sirali
    };
  }
  static skorTahmin(analiz){
    if(!analiz.poisson.enOlasıSkorlar || !analiz.poisson.enOlasıSkorlar.length){
      return { enOlası: '?-?', top5: [] };
    }
    return {
      enOlası: analiz.poisson.enOlasıSkorlar[0].skor,
      enOlasıYuzde: analiz.poisson.enOlasıSkorlar[0].yuzde,
      top5: analiz.poisson.enOlasıSkorlar.slice(0,5)
    };
  }
  static golTahmin(analiz){
    const ust25 = parseFloat(analiz.poisson.pUst25);
    const kgVar = parseFloat(analiz.poisson.pKgVar);
    let golTahmin = ust25 > 50 ? '2.5 Üst' : '2.5 Alt';
    let golOlas = ust25 > 50 ? ust25 : (100-ust25);
    let kgTahmin = kgVar > 50 ? 'KG Var' : 'KG Yok';
    let kgOlas = kgVar > 50 ? kgVar : (100-kgVar);
    return {
      golTahmin, golOlas: golOlas.toFixed(1),
      kgTahmin, kgOlas: kgOlas.toFixed(1),
      ust15: analiz.poisson.pUst15, ust25: analiz.poisson.pUst25, ust35: analiz.poisson.pUst35,
      alt15: analiz.poisson.pAlt15, alt25: analiz.poisson.pAlt25, alt35: analiz.poisson.pAlt35,
      kgVar: kgVar.toFixed(1), kgYok: (100-kgVar).toFixed(1)
    };
  }
  static karar(analiz, tahmin, mod='toto'){
    const favoriOlas = parseFloat(tahmin.birXiki.enOlasıOlas);
    if(mod === 'toto'){
      if(favoriOlas >= 68) return { tip:'TEK', renk:'green', emoji:'🟢', mesaj:'Tek işaretle', kolon: 1 };
      if(favoriOlas >= 52) return { tip:'ÇİFT', renk:'orange', emoji:'🟡', mesaj:'2 işaretle', kolon: 2 };
      return { tip:'ÜÇLÜ', renk:'red', emoji:'🔴', mesaj:'3 işaretle', kolon: 3 };
    } else {
      if(favoriOlas < 45) return { tip:'ATLA', renk:'gray', emoji:'⚫', mesaj:'Taraf oynama, kombinelere bak', kolon: 0 };
      if(favoriOlas >= 72) return { tip:'TEK', renk:'green', emoji:'🟢', mesaj:'Tek oyna', kolon: 1 };
      if(favoriOlas >= 55) return { tip:'ÇİFT', renk:'orange', emoji:'🟡', mesaj:'2\'li oyna', kolon: 2 };
      return { tip:'ÜÇLÜ', renk:'red', emoji:'🔴', mesaj:'3\'lü oyna', kolon: 3 };
    }
  }
  static tahminEt(analiz, mod='toto'){
    const birXiki = this.birXikiTahmin(analiz);
    const skor = this.skorTahmin(analiz);
    const gol = this.golTahmin(analiz);
    const karar = this.karar(analiz, { birXiki, skor, gol }, mod);
    return { birXiki, skor, gol, karar };
  }
}

/* ============================================================
   4. UYGULAMA DURUMU
   ============================================================ */
let maclarToto = [];
let maclarIddaa = JSON.parse(localStorage.getItem('skorlab_iddaa') || '[]');
let oranlarToto = JSON.parse(localStorage.getItem('skorlab_oranlar_toto') || '{}');
let secimlerToto = JSON.parse(localStorage.getItem('skorlab_secimler_toto') || '{}');
let secimlerIddaa = JSON.parse(localStorage.getItem('skorlab_secimler_iddaa') || '{}');
let kayitliKuponlar = JSON.parse(localStorage.getItem('skorlab_kuponlar') || '[]');
let backtestKayitlari = JSON.parse(localStorage.getItem('skorlab_backtest') || '[]');
let golFiltre = 'hepsi';

const $ = id => document.getElementById(id);

/* ============================================================
   5. VERİ YÜKLE
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
  renderBacktest();
  updateStats();
  updateKuponCubugu();
}

/* ============================================================
   6. ORAN GÜNCELLE
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
   7. TOTO RENDER
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
    let tahmin = null;
    if(hasOdds){
      const a = ValueBetEngine.analizEt({
        o1:o['1'], oX:o['X'], o2:o['2'],
        oU25:o['U25'], oA25:o['A25'],
        oKgV:o['KgV'], oKgY:o['KgY']
      });
      tahmin = TahminMotoru.tahminEt(a, 'toto');
    }
    return `
    <div class="mac-kart">
      <div class="mac-head">
        <span class="mac-no">#${m.mac_id}</span>
        <button type="button" class="mac-analiz-btn" onclick="analizGosterToto(${m.mac_id})">📊 DETAY</button>
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
      ${tahmin ? `
      <div class="tahmin-box">
        <div class="tahmin-satir">
          <span class="lbl">🎯 SONUÇ</span>
          <span class="val ${tahmin.karar.renk}">${tahmin.karar.emoji} ${tahmin.birXiki.enOlası} (%${tahmin.birXiki.enOlasıOlas})</span>
        </div>
        <div class="tahmin-satir">
          <span class="lbl">⚽ SKOR</span>
          <span class="val purple">${tahmin.skor.enOlası} (%${tahmin.skor.enOlasıYuzde})</span>
        </div>
        <div class="tahmin-satir">
          <span class="lbl">📊 GOL</span>
          <span class="val green">${tahmin.gol.golTahmin} (%${tahmin.gol.golOlas})</span>
        </div>
        <div class="tahmin-satir">
          <span class="lbl">🥅 KG</span>
          <span class="val orange">${tahmin.gol.kgTahmin} (%${tahmin.gol.kgOlas})</span>
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
   8. İDDAA RENDER
   ============================================================ */
function renderIddaa(){
  const c = $('iddaaListesi');
  if(!c) return;
  let html = `
    <div class="gol-filtre-bar">
      <button type="button" class="gol-filtre-btn ${golFiltre==='hepsi'?'active':''}" onclick="setGolFiltre('hepsi')">Tümü</button>
      <button type="button" class="gol-filtre-btn ${golFiltre==='gollu'?'active':''}" onclick="setGolFiltre('gollu')">🔥 Gollü</button>
      <button type="button" class="gol-filtre-btn ${golFiltre==='orta'?'active':''}" onclick="setGolFiltre('orta')">⚡ Orta</button>
      <button type="button" class="gol-filtre-btn ${golFiltre==='az'?'active':''}" onclick="setGolFiltre('az')">❄️ Az Gollü</button>
    </div>
  `;
  if(!maclarIddaa.length){
    html += '<div class="card"><div class="muted" style="text-align:center;padding:20px">Henüz maç eklemedin. "➕ Maç Ekle" veya "📋 Metin Yapıştır" ile başla.</div></div>';
    c.innerHTML = html;
    return;
  }
  const macAnalizler = maclarIddaa.map(m => {
    const o = m.oranlar;
    if(!o.o1 || !o.oX || !o.o2) return { m, a: null, gol: null, tahmin: null };
    const a = ValueBetEngine.analizEt({
      o1:o.o1, oX:o.oX, o2:o.o2,
      oU25:o.oU25, oA25:o.oA25,
      oKgV:o.oKgV, oKgY:o.oKgY,
      oMS1KgV:o.oMS1KgV, oMSXKgV:o.oMSXKgV, oMS2KgV:o.oMS2KgV,
      oMS1A15:o.oMS1A15, oMS1U15:o.oMS1U15, oMSXA15:o.oMSXA15, oMSXU15:o.oMSXU15, oMS2A15:o.oMS2A15, oMS2U15:o.oMS2U15,
      oMS1A25:o.oMS1A25, oMS1U25:o.oMS1U25, oMSXA25:o.oMSXA25, oMSXU25:o.oMSXU25, oMS2A25:o.oMS2A25, oMS2U25:o.oMS2U25,
      oMS1A35:o.oMS1A35, oMS1U35:o.oMS1U35, oMSXA35:o.oMSXA35, oMSXU35:o.oMSXU35, oMS2A35:o.oMS2A35, oMS2U35:o.oMS2U35
    });
    const gol = ValueBetEngine.golluMacAnaliz(a.poisson, parseFloat(a.xgEv), parseFloat(a.xgDep));
    const tahmin = TahminMotoru.tahminEt(a, 'iddaa');
    return { m, a, gol, tahmin };
  });
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
  filtreli.forEach(({ m, a, gol, tahmin }) => {
    const sec = secimlerIddaa[m.id] || [];
    const o = m.oranlar;
    const skorlar = a.poisson.enOlasıSkorlar || [];
    let skorHTML = '';
    if(skorlar.length > 0){
      skorHTML = `
        <div class="analiz-box">
          <span class="analiz-lbl">⚽ BEKLENEN SKORLAR</span>
          <div class="skor-grid">
            ${skorlar.map((s) => `
              <div class="skor-item">
                <div class="skor-sayi">${s.skor}</div>
                <div class="skor-yuzde">%${s.yuzde}</div>
              </div>
            `).join('')}
          </div>
        </div>
      `;
    }
    const senaryolar = a.senaryolar || [];
    let senaryoHTML = '';
    if(senaryolar.length > 0){
      const top5 = senaryolar.slice(0, 5);
      senaryoHTML = `
        <div class="analiz-box">
          <span class="analiz-lbl">📋 SENARYOLAR (En iyi 5)</span>
          ${top5.map((s, i) => {
            const isEnIyi = i === 0;
            const guven = s.olasilikNum >= 0.55 ? '⭐⭐⭐⭐⭐' :
                          s.olasilikNum >= 0.45 ? '⭐⭐⭐⭐' :
                          s.olasilikNum >= 0.35 ? '⭐⭐⭐' :
                          s.olasilikNum >= 0.25 ? '⭐⭐' : '⭐';
            const katRenk = s.kategori === 'kombine' ? 'var(--purple)' : 'var(--green)';
            return `
              <div class="senaryo-box ${isEnIyi ? 'en-iyi' : ''}">
                <div class="senaryo-head">
                  <span class="senaryo-isim" style="color:${katRenk}">${isEnIyi ? '⭐ ' : ''}${s.isim}</span>
                  <span class="senaryo-oran">@ ${s.oran}</span>
                </div>
                <div class="senaryo-detay">
                  <span>Olasılık: <b>%${s.olasilik}</b></span>
                  <span>EV: <b>${s.ev}</b></span>
                </div>
                <div class="senaryo-guven">${guven}</div>
              </div>
            `;
          }).join('')}
        </div>
      `;
    }
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
      ${tahmin ? `
      <div class="tahmin-box">
        <div class="tahmin-satir">
          <span class="lbl">🎯 TARAF</span>
          <span class="val ${tahmin.karar.renk}">${tahmin.karar.emoji} ${tahmin.birXiki.enOlası} (%${tahmin.birXiki.enOlasıOlas})</span>
        </div>
        <div class="tahmin-satir">
          <span class="lbl">⚽ GOL</span>
          <span class="val green">${tahmin.gol.golTahmin} (%${tahmin.gol.golOlas})</span>
        </div>
        <div class="tahmin-satir">
          <span class="lbl">🥅 KG</span>
          <span class="val orange">${tahmin.gol.kgTahmin} (%${tahmin.gol.kgOlas})</span>
        </div>
        <div class="tahmin-satir">
          <span class="lbl">📊 xG</span>
          <span class="val purple">${a.xgEv} - ${a.xgDep}</span>
        </div>
      </div>
      ` : ''}
      ${skorHTML}
      ${senaryoHTML}
      ${gol ? `
      <div style="margin-top:8px">
        <span class="gol-etiket ${gol.sinif}">${gol.etiket} (${gol.puan}/4)</span>
        <div class="gol-info">
          <div>xG: <b>${gol.toplamXg}</b></div>
          <div>2.5Ü: <b>%${gol.pUst25}</b></div>
          <div>KG: <b>%${gol.pKgVar}</b></div>
        </div>
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

function setGolFiltre(f){ golFiltre = f; renderIddaa(); }

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
    const t = TahminMotoru.tahminEt(a, 'toto');
    satirlar.push({ tip:'toto', id:m.mac_id, isim:m.ev_sahibi + ' - ' + m.deplasman, tahmin:t, analiz:a });
  });
  maclarIddaa.forEach(m => {
    const o = m.oranlar;
    if(!o.o1 || !o.oX || !o.o2) return;
    const a = ValueBetEngine.analizEt({
      o1:o.o1, oX:o.oX, o2:o.o2,
      oU25:o.oU25, oA25:o.oA25,
      oKgV:o.oKgV, oKgY:o.oKgY,
      oMS1KgV:o.oMS1KgV, oMSXKgV:o.oMSXKgV, oMS2KgV:o.oMS2KgV,
      oMS1A15:o.oMS1A15, oMS1U15:o.oMS1U15, oMSXA15:o.oMSXA15, oMSXU15:o.oMSXU15, oMS2A15:o.oMS2A15, oMS2U15:o.oMS2U15,
      oMS1A25:o.oMS1A25, oMS1U25:o.oMS1U25, oMSXA25:o.oMSXA25, oMSXU25:o.oMSXU25, oMS2A25:o.oMS2A25, oMS2U25:o.oMS2U25,
      oMS1A35:o.oMS1A35, oMS1U35:o.oMS1U35, oMSXA35:o.oMSXA35, oMSXU35:o.oMSXU35, oMS2A35:o.oMS2A35, oMS2U35:o.oMS2U35
    });
    const t = TahminMotoru.tahminEt(a, 'iddaa');
    satirlar.push({ tip:'iddaa', id:m.id, isim:m.mac, tahmin:t, analiz:a });
  });
  if(!satirlar.length){
    c.innerHTML = '<div class="muted" style="text-align:center;padding:20px">Analiz için önce oran girmelisin.</div>';
    return;
  }
  const tek = satirlar.filter(s => s.tahmin.karar.tip === 'TEK').length;
  const cift = satirlar.filter(s => s.tahmin.karar.tip === 'ÇİFT').length;
  const uclu = satirlar.filter(s => s.tahmin.karar.tip === 'ÜÇLÜ').length;
  const atla = satirlar.filter(s => s.tahmin.karar.tip === 'ATLA').length;
  let html = `
    <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:6px;margin-bottom:14px;font-size:.68rem;text-align:center">
      <div style="padding:8px;background:rgba(0,230,118,.15);border-radius:6px;color:var(--green);font-weight:900">🟢 ${tek}<br><span style="font-size:.55rem;opacity:.7">TEK</span></div>
      <div style="padding:8px;background:rgba(255,176,32,.15);border-radius:6px;color:var(--orange);font-weight:900">🟡 ${cift}<br><span style="font-size:.55rem;opacity:.7">ÇİFT</span></div>
      <div style="padding:8px;background:rgba(255,77,94,.15);border-radius:6px;color:var(--red);font-weight:900">🔴 ${uclu}<br><span style="font-size:.55rem;opacity:.7">ÜÇLÜ</span></div>
      <div style="padding:8px;background:rgba(120,130,150,.15);border-radius:6px;color:var(--muted);font-weight:900">⚫ ${atla}<br><span style="font-size:.55rem;opacity:.7">ATLA</span></div>
    </div>
  `;
  satirlar.forEach(s => {
    const t = s.tahmin;
    const enIyi = s.analiz.senaryolar && s.analiz.senaryolar.length > 0 ? s.analiz.senaryolar[0] : null;
    const renk = t.karar.tip === 'TEK' ? 'green' : t.karar.tip === 'ÇİFT' ? 'orange' : t.karar.tip === 'ÜÇLÜ' ? 'red' : 'muted';
    html += `
      <div style="padding:10px 0;border-bottom:1px solid var(--border);font-size:.78rem;cursor:pointer" onclick="analizGoster${s.tip === 'toto' ? 'Toto' : 'Iddaa'}(${s.id})">
        <div style="font-weight:900;margin-bottom:4px">${s.tip === 'toto' ? '#'+s.id : 'İ'} ${s.isim}</div>
        <div style="display:flex;justify-content:space-between;align-items:center">
          <span style="font-weight:900;color:var(--${renk})">${t.karar.emoji} ${t.karar.tip}</span>
          <span class="muted" style="font-size:.7rem">${t.birXiki.enOlası} (%${t.birXiki.enOlasıOlas})</span>
        </div>
        <div class="muted" style="font-size:.68rem;margin-top:2px">
          ⚽ ${t.skor.enOlası} · 📊 ${t.gol.golTahmin} · 🥅 ${t.gol.kgTahmin}
        </div>
        ${enIyi ? `
          <div style="margin-top:4px;color:var(--purple);font-weight:800;font-size:.72rem">
            ⭐ ${enIyi.isim} @ ${enIyi.oran} (%${enIyi.olasilik}) · EV ${enIyi.ev}
          </div>
        ` : ''}
      </div>
    `;
  });
  c.innerHTML = html;
}

/* ============================================================
   10. OTOMATİK KUPON
   ============================================================ */
function otomatikKuponToto(){
  if(!maclarToto.length){ showToast('error','Maç Yok','Toto boş.'); return; }
  const secili = [];
  maclarToto.forEach(m => {
    const o = oranlarToto[m.mac_id];
    if(!o || !o['1'] || !o['X'] || !o['2']) return;
    const a = ValueBetEngine.analizEt({
      o1:o['1'], oX:o['X'], o2:o['2'],
      oU25:o['U25'], oA25:o['A25'], oKgV:o['KgV'], oKgY:o['KgY']
    });
    const t = TahminMotoru.tahminEt(a, 'toto');
    secili.push({ mac_id: m.mac_id, isim: m.ev_sahibi + ' - ' + m.deplasman, tahmin: t });
  });
  kuponKurVeGoster(secili, 'toto');
}

function otomatikKuponIddaa(){
  if(!maclarIddaa.length){ showToast('error','Maç Yok','İddaa boş.'); return; }
  const secili = [];
  maclarIddaa.forEach(m => {
    const o = m.oranlar;
    if(!o.o1 || !o.oX || !o.o2) return;
    const a = ValueBetEngine.analizEt({
      o1:o.o1, oX:o.oX, o2:o.o2,
      oU25:o.oU25, oA25:o.oA25, oKgV:o.oKgV, oKgY:o.oKgY,
      oMS1KgV:o.oMS1KgV, oMSXKgV:o.oMSXKgV, oMS2KgV:o.oMS2KgV,
      oMS1A15:o.oMS1A15, oMS1U15:o.oMS1U15, oMSXA15:o.oMSXA15, oMSXU15:o.oMSXU15, oMS2A15:o.oMS2A15, oMS2U15:o.oMS2U15,
      oMS1A25:o.oMS1A25, oMS1U25:o.oMS1U25, oMSXA25:o.oMSXA25, oMSXU25:o.oMSXU25, oMS2A25:o.oMS2A25, oMS2U25:o.oMS2U25,
      oMS1A35:o.oMS1A35, oMS1U35:o.oMS1U35, oMSXA35:o.oMSXA35, oMSXU35:o.oMSXU35, oMS2A35:o.oMS2A35, oMS2U35:o.oMS2U35
    });
    const t = TahminMotoru.tahminEt(a, 'iddaa');
    secili.push({ mac_id: m.id, isim: m.mac, tahmin: t, senaryolar: a.senaryolar });
  });
  kuponKurVeGoster(secili, 'iddaa');
}

function kuponKurVeGoster(maclar, tip){
  if(!maclar.length){ showToast('error','Maç Yok','Oran girmen gerek.'); return; }
  let kolon = 1;
  const detaylar = maclar.map(m => {
    const t = m.tahmin;
    let secim = '';
    if(tip === 'iddaa' && m.senaryolar && m.senaryolar.length > 0){
      const enIyiEv = m.senaryolar.filter(s => s.evNum >= 1.05)[0];
      if(enIyiEv){ secim = `${enIyiEv.isim} @ ${enIyiEv.oran}`; }
      else { secim = `Taraf: ${t.birXiki.enOlası}`; }
    } else {
      if(t.karar.tip === 'TEK'){ secim = t.birXiki.enOlası; kolon *= 1; }
      else if(t.karar.tip === 'ÇİFT'){ secim = t.birXiki.sirali[0].kod + t.birXiki.sirali[1].kod; kolon *= 2; }
      else if(t.karar.tip === 'ÜÇLÜ'){ secim = '1X2'; kolon *= 3; }
      else { secim = 'ATLA'; kolon *= 0; }
    }
    return { isim: m.isim, secim, tahmin: t };
  });
  let html = `
    <div class="card" style="border:2px solid var(--purple)">
      <div class="result-title" style="color:var(--purple)">🤖 OTOMATİK KUPON (${detaylar.length} maç)</div>
  `;
  detaylar.forEach(d => {
    html += `
      <div style="padding:8px 0;border-bottom:1px solid var(--border);font-size:.75rem">
        <div style="font-weight:900;margin-bottom:3px">${d.isim}</div>
        <div style="display:flex;justify-content:space-between;align-items:center">
          <span style="font-weight:900;color:var(--green);font-size:.85rem">${d.secim}</span>
          <span class="muted" style="font-size:.68rem">${d.tahmin.birXiki.enOlası} (%${d.tahmin.birXiki.enOlasıOlas})</span>
        </div>
      </div>
    `;
  });
  html += `
      <button type="button" class="btn btn-purple btn-lg" onclick="otomatikKuponuKaydet('${tip}')" style="margin-top:12px">💾 BU KUPONU KAYDET</button>
    </div>
  `;
  const hedef = tip === 'toto' ? 'totoKuponSonuc' : 'kuponSonuc';
  $(hedef).innerHTML = html;
  window.sonOtomatikKupon = { tip, detaylar, kolon };
}

function otomatikKuponuKaydet(tip){
  const k = window.sonOtomatikKupon;
  if(!k) return;
  kayitliKuponlar.unshift({
    id: Date.now(), tip: tip, tarih: new Date().toLocaleString('tr-TR'),
    macSayisi: k.detaylar.length, kolon: k.kolon, tutar: k.kolon * 10,
    detaylar: k.detaylar.map(d => ({ isim: d.isim, secim: d.secim })),
    durum: 'bekliyor'
  });
  if(kayitliKuponlar.length > 50) kayitliKuponlar = kayitliKuponlar.slice(0, 50);
  localStorage.setItem('skorlab_kuponlar', JSON.stringify(kayitliKuponlar));
  renderKayitliKuponlar();
  showToast('success','Kupon Kaydedildi!', k.detaylar.length + ' maç');
  const hedef = tip === 'toto' ? 'totoKuponSonuc' : 'kuponSonuc';
  $(hedef).innerHTML = '';
  window.sonOtomatikKupon = null;
}

/* ============================================================
   11. SEÇİM
   ============================================================ */
function secimToggleToto(id, secim){
  let sec = secimlerToto[id] || [];
  if(sec.includes(secim)) sec = sec.filter(s => s !== secim);
  else sec.push(secim);
  if(sec.length === 0) delete secimlerToto[id];
  else secimlerToto[id] = sec;
  localStorage.setItem('skorlab_secimler_toto', JSON.stringify(secimlerToto));
  renderToto(); updateStats(); updateKuponCubugu();
}

function secimToggleIddaa(id, secim){
  let sec = secimlerIddaa[id] || [];
  if(sec.includes(secim)) sec = sec.filter(s => s !== secim);
  else sec.push(secim);
  if(sec.length === 0) delete secimlerIddaa[id];
  else secimlerIddaa[id] = sec;
  localStorage.setItem('skorlab_secimler_iddaa', JSON.stringify(secimlerIddaa));
  renderIddaa(); updateStats(); updateKuponCubugu();
}

function tumSecimleriSil(){
  if(!confirm('Tüm seçimler silinsin mi? (Oranlar kalır)')) return;
  secimlerToto = {}; secimlerIddaa = {};
  localStorage.setItem('skorlab_secimler_toto', '{}');
  localStorage.setItem('skorlab_secimler_iddaa', '{}');
  renderToto(); renderIddaa(); updateStats(); updateKuponCubugu();
}

function temizleToto(){
  if(!confirm('Tüm Toto oranları ve seçimleri silinsin mi?')) return;
  oranlarToto = {}; secimlerToto = {};
  localStorage.setItem('skorlab_oranlar_toto', '{}');
  localStorage.setItem('skorlab_secimler_toto', '{}');
  renderToto(); renderAnaliz(); updateStats(); updateKuponCubugu();
  $('totoKuponSonuc').innerHTML = '';
}

function temizleIddaa(){
  if(!confirm('Tüm İddaa maçları silinsin mi?')) return;
  maclarIddaa = []; secimlerIddaa = {};
  localStorage.removeItem('skorlab_iddaa');
  localStorage.setItem('skorlab_secimler_iddaa', '{}');
  renderIddaa(); renderAnaliz(); updateStats(); updateKuponCubugu();
  $('kuponSonuc').innerHTML = '';
}

/* ============================================================
   12. İDDAA MAÇ EKLE (Modal)
   ============================================================ */
function openIddaaModal(){
  const ids = ['im-mac','im-o1','im-oX','im-o2','im-u25alt','im-u25ust','im-kgvar','im-kgyok',
    'im-ms1kgv','im-msxkgv','im-ms2kgv',
    'im-ms1a15','im-ms1u15','im-msxa15','im-msxu15','im-ms2a15','im-ms2u15',
    'im-ms1a25','im-ms1u25','im-msxa25','im-msxu25','im-ms2a25','im-ms2u25',
    'im-ms1a35','im-ms1u35','im-msxa35','im-msxu35','im-ms2a35','im-ms2u35'];
  ids.forEach(id => { const el = $(id); if(el) el.value = ''; });
  $('iddaaModal').classList.add('active');
}

function sayi(id){ const v = parseFloat($(id)?.value); return isNaN(v) ? null : v; }

function iddaaEkle(){
  const mac = $('im-mac').value.trim();
  const o1 = sayi('im-o1'), oX = sayi('im-oX'), o2 = sayi('im-o2');
  if(!mac || !o1 || !oX || !o2){ showToast('error','Eksik','Maç adı ve 1X2 zorunlu.'); return; }
  const yeni = {
    id: Date.now(), mac,
    oranlar: {
      o1, oX, o2,
      oA25: sayi('im-u25alt'), oU25: sayi('im-u25ust'),
      oKgV: sayi('im-kgvar'), oKgY: sayi('im-kgyok'),
      oMS1KgV: sayi('im-ms1kgv'), oMSXKgV: sayi('im-msxkgv'), oMS2KgV: sayi('im-ms2kgv'),
      oMS1A15: sayi('im-ms1a15'), oMS1U15: sayi('im-ms1u15'), oMSXA15: sayi('im-msxa15'), oMSXU15: sayi('im-msxu15'), oMS2A15: sayi('im-ms2a15'), oMS2U15: sayi('im-ms2u15'),
      oMS1A25: sayi('im-ms1a25'), oMS1U25: sayi('im-ms1u25'), oMSXA25: sayi('im-msxa25'), oMSXU25: sayi('im-msxu25'), oMS2A25: sayi('im-ms2a25'), oMS2U25: sayi('im-ms2u25'),
      oMS1A35: sayi('im-ms1a35'), oMS1U35: sayi('im-ms1u35'), oMSXA35: sayi('im-msxa35'), oMSXU35: sayi('im-msxu35'), oMS2A35: sayi('im-ms2a35'), oMS2U35: sayi('im-ms2u35')
    },
    tarih: new Date().toLocaleString('tr-TR')
  };
  maclarIddaa.unshift(yeni);
  localStorage.setItem('skorlab_iddaa', JSON.stringify(maclarIddaa));
  closeModal('iddaaModal');
  renderIddaa(); renderAnaliz();
  showToast('success','Maç Eklendi!', mac);
}

function iddaaSil(id){
  if(!confirm('Bu maç silinsin mi?')) return;
  maclarIddaa = maclarIddaa.filter(x => x.id !== id);
  delete secimlerIddaa[id];
  localStorage.setItem('skorlab_iddaa', JSON.stringify(maclarIddaa));
  localStorage.setItem('skorlab_secimler_iddaa', JSON.stringify(secimlerIddaa));
  renderIddaa(); renderAnaliz(); updateStats(); updateKuponCubugu();
}

/* ============================================================
   13. KUPON HESAP
   ============================================================ */
function kuponHesapla(){
  let toto = 0, iddaa = 0, kolon = 1;
  Object.keys(secimlerToto).forEach(id => {
    const sec = secimlerToto[id]; if(!sec || !sec.length) return;
    toto++; kolon *= sec.length;
  });
  Object.keys(secimlerIddaa).forEach(id => {
    const sec = secimlerIddaa[id]; if(!sec || !sec.length) return;
    iddaa++; kolon *= sec.length;
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
   14. TOTO KUPONU
   ============================================================ */
function kuponOlusturToto(){
  if(!maclarToto.length){ showToast('error','Maç Yok','Toto boş.'); return; }
  const oneriler = [];
  maclarToto.forEach(m => {
    const o = oranlarToto[m.mac_id];
    if(!o || !o['1'] || !o['X'] || !o['2']) return;
    const a = ValueBetEngine.analizEt({
      o1:o['1'], oX:o['X'], o2:o['2'],
      oU25:o['U25'], oA25:o['A25'], oKgV:o['KgV'], oKgY:o['KgY']
    });
    const t = TahminMotoru.tahminEt(a, 'toto');
    oneriler.push({ mac_id: m.mac_id, isim: m.ev_sahibi + ' - ' + m.deplasman, tahmin: t });
  });
  if(!oneriler.length){ showToast('error','Oran Yok','Hiç oran girilmemiş.'); return; }
  let html = `<div class="card" style="border:1px solid var(--green)"><div class="result-title">⚡ TOTO KUPON ÖNERİSİ (${oneriler.length} maç)</div>`;
  let kolon = 1;
  oneriler.forEach(o => {
    const t = o.tahmin;
    let secim = '';
    if(t.karar.tip === 'TEK'){ secim = t.birXiki.enOlası; kolon *= 1; }
    else if(t.karar.tip === 'ÇİFT'){ secim = t.birXiki.sirali[0].kod + t.birXiki.sirali[1].kod; kolon *= 2; }
    else { secim = '1X2'; kolon *= 3; }
    const renk = t.karar.tip === 'TEK' ? 'green' : t.karar.tip === 'ÇİFT' ? 'orange' : 'red';
    html += `<div style="padding:10px 0;border-bottom:1px solid var(--border);font-size:.78rem">
      <div style="font-weight:900;margin-bottom:4px">#${o.mac_id} ${o.isim}</div>
      <div style="display:flex;justify-content:space-between">
        <b style="color:var(--${renk});font-size:.9rem">🎯 ${secim}</b>
        <span class="muted">${t.karar.emoji} ${t.karar.tip}</span>
      </div>
    </div>`;
  });
  html += `<div style="margin-top:12px;padding:10px;background:var(--bg3);border-radius:8px">
    <div class="analiz-row"><span>Toplam Kolon:</span><b class="green">${kolon}</b></div>
    <div class="analiz-row"><span>Tutar:</span><b class="green">${kolon * 10} TL</b></div>
  </div>
  <button type="button" class="btn btn-green btn-lg" onclick="kuponKaydetToto()" style="margin-top:12px">💾 KUPONU KAYDET</button></div>`;
  $('totoKuponSonuc').innerHTML = html;
  window.sonTotoKuponu = oneriler;
}

function kuponKaydetToto(){
  const oneriler = window.sonTotoKuponu || [];
  if(!oneriler.length) return;
  kayitliKuponlar.unshift({
    id: Date.now(), tip: 'toto', tarih: new Date().toLocaleString('tr-TR'),
    macSayisi: oneriler.length, kolon: 1, tutar: 10,
    detaylar: oneriler.map(o => ({ mac_id: o.mac_id, isim: o.isim, secim: o.tahmin.karar.tip })),
    durum: 'bekliyor'
  });
  if(kayitliKuponlar.length > 50) kayitliKuponlar = kayitliKuponlar.slice(0, 50);
  localStorage.setItem('skorlab_kuponlar', JSON.stringify(kayitliKuponlar));
  renderKayitliKuponlar();
  showToast('success','Toto Kuponu Kaydedildi!', oneriler.length + ' maç');
  $('totoKuponSonuc').innerHTML = '';
  window.sonTotoKuponu = null;
}

/* ============================================================
   15. İDDAA KUPONU
   ============================================================ */
function kuponOlusturIddaa(){
  if(!maclarIddaa.length){ showToast('error','Maç Yok','İddaa boş.'); return; }
  const oneriler = [];
  maclarIddaa.forEach(m => {
    const o = m.oranlar;
    if(!o.o1 || !o.oX || !o.o2) return;
    const a = ValueBetEngine.analizEt({
      o1:o.o1, oX:o.oX, o2:o.o2,
      oU25:o.oU25, oA25:o.oA25, oKgV:o.oKgV, oKgY:o.oKgY,
      oMS1KgV:o.oMS1KgV, oMSXKgV:o.oMSXKgV, oMS2KgV:o.oMS2KgV,
      oMS1A15:o.oMS1A15, oMS1U15:o.oMS1U15, oMSXA15:o.oMSXA15, oMSXU15:o.oMSXU15, oMS2A15:o.oMS2A15, oMS2U15:o.oMS2U15,
      oMS1A25:o.oMS1A25, oMS1U25:o.oMS1U25, oMSXA25:o.oMSXA25, oMSXU25:o.oMSXU25, oMS2A25:o.oMS2A25, oMS2U25:o.oMS2U25,
      oMS1A35:o.oMS1A35, oMS1U35:o.oMS1U35, oMSXA35:o.oMSXA35, oMSXU35:o.oMSXU35, oMS2A35:o.oMS2A35, oMS2U35:o.oMS2U35
    });
    const gol = ValueBetEngine.golluMacAnaliz(a.poisson, parseFloat(a.xgEv), parseFloat(a.xgDep));
    if(golFiltre !== 'hepsi' && gol.seviye !== golFiltre) return;
    const t = TahminMotoru.tahminEt(a, 'iddaa');
    const enIyi = a.senaryolar.filter(s => s.evNum >= 1.05)[0] || a.senaryolar[0];
    oneriler.push({ mac_id: m.id, isim: m.mac, tahmin: t, gol, enIyiSenaryo: enIyi });
  });
  if(!oneriler.length){ showToast('error','Maç Yok','Oynanabilir maç yok.'); return; }
  let html = `<div class="card" style="border:1px solid var(--green)"><div class="result-title">⚡ İDDAA KUPON ÖNERİSİ (${oneriler.length} maç)</div>`;
  oneriler.forEach(o => {
    const s = o.enIyiSenaryo;
    html += `<div style="padding:10px 0;border-bottom:1px solid var(--border);font-size:.78rem">
      <div style="font-weight:900;margin-bottom:4px">${o.isim}</div>
      ${s ? `<div style="display:flex;justify-content:space-between;align-items:center">
        <b style="color:var(--purple);font-size:.9rem">⭐ ${s.isim}</b>
        <span style="font-weight:900;color:var(--green)">@ ${s.oran}</span>
      </div>
      <div class="muted" style="font-size:.68rem;margin-top:2px">Olasılık: %${s.olasilik} · EV: ${s.ev}</div>` : `<div class="muted">Senaryo yok</div>`}
    </div>`;
  });
  html += `<button type="button" class="btn btn-green btn-lg" onclick="kuponKaydetIddaa()" style="margin-top:12px">💾 KUPONU KAYDET</button></div>`;
  $('kuponSonuc').innerHTML = html;
  window.sonIddaaKuponu = oneriler;
}

function kuponKaydetIddaa(){
  const oneriler = window.sonIddaaKuponu || [];
  if(!oneriler.length) return;
  kayitliKuponlar.unshift({
    id: Date.now(), tip: 'iddaa', tarih: new Date().toLocaleString('tr-TR'),
    macSayisi: oneriler.length, kolon: oneriler.length, tutar: oneriler.length * 10,
    detaylar: oneriler.map(o => ({
      isim: o.isim,
      secim: o.enIyiSenaryo ? o.enIyiSenaryo.isim + ' @ ' + o.enIyiSenaryo.oran : o.tahmin.karar.tip
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
  if(!o || !o['1'] || !o['X'] || !o['2']){ showToast('error','Oran Yok','1/X/2 oranlarını gir.'); return; }
  analizGosterOrtak(m.ev_sahibi + ' - ' + m.deplasman, o, 'toto');
}

function analizGosterIddaa(id){
  const m = maclarIddaa.find(x => x.id === id);
  if(!m) return;
  const o = m.oranlar;
  if(!o.o1 || !o.oX || !o.o2){ showToast('error','Oran Yok','1/X/2 oranları eksik.'); return; }
  analizGosterOrtak(m.mac, {
    '1':o.o1, 'X':o.oX, '2':o.o2,
    'U25':o.oU25, 'A25':o.oA25, 'KgV':o.oKgV, 'KgY':o.oKgY,
    'MS1KgV':o.oMS1KgV, 'MSXKgV':o.oMSXKgV, 'MS2KgV':o.oMS2KgV,
    'MS1A15':o.oMS1A15, 'MS1U15':o.oMS1U15, 'MSXA15':o.oMSXA15, 'MSXU15':o.oMSXU15, 'MS2A15':o.oMS2A15, 'MS2U15':o.oMS2U15,
    'MS1A25':o.oMS1A25, 'MS1U25':o.oMS1U25, 'MSXA25':o.oMSXA25, 'MSXU25':o.oMSXU25, 'MS2A25':o.oMS2A25, 'MS2U25':o.oMS2U25,
    'MS1A35':o.oMS1A35, 'MS1U35':o.oMS1U35, 'MSXA35':o.oMSXA35, 'MSXU35':o.oMSXU35, 'MS2A35':o.oMS2A35, 'MS2U35':o.oMS2U35
  }, 'iddaa');
}

function analizGosterOrtak(isim, o, mod){
  const rapor = ValueBetEngine.analizEt({
    o1: o['1'], oX: o['X'], o2: o['2'],
    oU25: o['U25'], oA25: o['A25'], oKgV: o['KgV'], oKgY: o['KgY'],
    oMS1KgV: o['MS1KgV'], oMSXKgV: o['MSXKgV'], oMS2KgV: o['MS2KgV'],
    oMS1A15: o['MS1A15'], oMS1U15: o['MS1U15'], oMSXA15: o['MSXA15'], oMSXU15: o['MSXU15'], oMS2A15: o['MS2A15'], oMS2U15: o['MS2U15'],
    oMS1A25: o['MS1A25'], oMS1U25: o['MS1U25'], oMSXA25: o['MSXA25'], oMSXU25: o['MSXU25'], oMS2A25: o['MS2A25'], oMS2U25: o['MS2U25'],
    oMS1A35: o['MS1A35'], oMS1U35: o['MS1U35'], oMSXA35: o['MSXA35'], oMSXU35: o['MSXU35'], oMS2A35: o['MS2A35'], oMS2U35: o['MS2U35']
  });
  const mc = MonteCarloEngine.macSimuleEt(parseFloat(rapor.xgEv), parseFloat(rapor.xgDep), 10000);
  const t = TahminMotoru.tahminEt(rapor, mod);
  const skorlar = rapor.poisson.enOlasıSkorlar || [];
  let skorHTML = '';
  if(skorlar.length > 0){
    skorHTML = `
      <div class="analiz-box">
        <span class="analiz-lbl">⚽ BEKLENEN SKORLAR</span>
        <div class="skor-grid">
          ${skorlar.map(s => `
            <div class="skor-item">
              <div class="skor-sayi">${s.skor}</div>
              <div class="skor-yuzde">%${s.yuzde}</div>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }
  const senaryolar = rapor.senaryolar || [];
  let senaryoHTML = '';
  if(senaryolar.length > 0){
    const top8 = senaryolar.slice(0, 8);
    senaryoHTML = `
      <div class="analiz-box">
        <span class="analiz-lbl">📋 SENARYOLAR (${top8.length})</span>
        ${top8.map((s, i) => {
          const isEnIyi = i === 0;
          const guven = s.olasilikNum >= 0.55 ? '⭐⭐⭐⭐⭐' :
                        s.olasilikNum >= 0.45 ? '⭐⭐⭐⭐' :
                        s.olasilikNum >= 0.35 ? '⭐⭐⭐' :
                        s.olasilikNum >= 0.25 ? '⭐⭐' : '⭐';
          const katRenk = s.kategori === 'kombine' ? 'var(--purple)' : 'var(--green)';
          return `
            <div class="senaryo-box ${isEnIyi ? 'en-iyi' : ''}">
              <div class="senaryo-head">
                <span class="senaryo-isim" style="color:${katRenk}">${isEnIyi ? '⭐ ' : ''}${s.isim}</span>
                <span class="senaryo-oran">@ ${s.oran}</span>
              </div>
              <div class="senaryo-detay">
                <span>Olasılık: <b>%${s.olasilik}</b></span>
                <span>EV: <b>${s.ev}</b></span>
              </div>
              <div class="senaryo-guven">${guven}</div>
            </div>
          `;
        }).join('')}
      </div>
    `;
  }
  let golHTML = '';
  if(mod === 'iddaa'){
    const gol = ValueBetEngine.golluMacAnaliz(rapor.poisson, parseFloat(rapor.xgEv), parseFloat(rapor.xgDep));
    golHTML = `
      <div class="analiz-box">
        <span class="analiz-lbl">⚽ GOL ANALİZİ</span>
        <div style="text-align:center;margin:8px 0">
          <span class="gol-etiket ${gol.sinif}" style="font-size:.8rem;padding:6px 14px">${gol.etiket}</span>
        </div>
        <div class="analiz-row"><span>Toplam xG:</span><b>${gol.toplamXg}</b></div>
        <div class="analiz-row"><span>2.5 Üst:</span><b>%${gol.pUst25}</b></div>
        <div class="analiz-row"><span>KG Var:</span><b>%${gol.pKgVar}</b></div>
      </div>`;
  }
  $('analizTitle').innerText = '📊 ' + isim;
  $('analizBody').innerHTML = `
    <div style="font-size:.85rem;line-height:1.8">
      <div class="analiz-box" style="border:2px solid var(--${t.karar.renk})">
        <span class="analiz-lbl">${t.karar.emoji} SİSTEM KARARI: ${t.karar.tip}</span>
        <div style="text-align:center;padding:8px 0">
          <div style="font-size:1.3rem;font-weight:900;color:var(--${t.karar.renk})">${t.birXiki.enOlası}</div>
          <div class="muted" style="font-size:.7rem;margin-top:4px">${t.karar.mesaj}</div>
        </div>
        <div class="analiz-row"><span>En Olası:</span><b>${t.birXiki.enOlası} (%${t.birXiki.enOlasıOlas})</b></div>
        <div class="analiz-row"><span>İkinci:</span><b>${t.birXiki.ikinci} (%${t.birXiki.ikinciOlas})</b></div>
        <div class="analiz-row"><span>Sürpriz Riski:</span><b>%${t.birXiki.surprizRisk}</b></div>
      </div>
      <div class="tahmin-box">
        <div class="tahmin-satir"><span class="lbl">📊 xG</span><span class="val purple">${rapor.xgEv} - ${rapor.xgDep}</span></div>
        <div class="tahmin-satir"><span class="lbl">📊 GOL TAHMİNİ</span><span class="val green">${t.gol.golTahmin} (%${t.gol.golOlas})</span></div>
        <div class="tahmin-satir"><span class="lbl">🥅 KG TAHMİNİ</span><span class="val orange">${t.gol.kgTahmin} (%${t.gol.kgOlas})</span></div>
      </div>
      ${skorHTML}
      ${senaryoHTML}
      ${golHTML}
      <div class="analiz-box">
        <span class="analiz-lbl">📊 SHIN MARJ ARINDIRMA</span>
        <div class="analiz-row"><span>1:</span><b style="color:var(--green)">%${rapor.shin.p1}</b></div>
        <div class="analiz-row"><span>X:</span><b style="color:var(--orange)">%${rapor.shin.pX}</b></div>
        <div class="analiz-row"><span>2:</span><b>%${rapor.shin.p2}</b></div>
        <div class="analiz-row"><span class="muted">Marj:</span><b style="color:var(--orange)">%${rapor.marj1X2}</b></div>
      </div>
      <div class="analiz-box">
        <span class="analiz-lbl">⚽ POISSON (Ters Çözüm)</span>
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
      </div>
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
   18. BACKTEST
   ============================================================ */
function renderBacktest(){
  const c = $('backtestListesi');
  if(!c) return;
  if(!backtestKayitlari.length){
    c.innerHTML = '<div class="card"><div class="muted" style="text-align:center;padding:20px">Henüz backtest kaydı yok.</div></div>';
    return;
  }
  const toplam = backtestKayitlari.length;
  const tutan = backtestKayitlari.filter(b => b.tuttu === true).length;
  const tutmayan = backtestKayitlari.filter(b => b.tuttu === false).length;
  const oran = toplam > 0 ? ((tutan/toplam)*100).toFixed(1) : 0;
  let html = `
    <div class="card">
      <div class="result-title">📊 GENEL İSTATİSTİK</div>
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;text-align:center;margin-top:8px">
        <div style="padding:10px;background:var(--bg3);border-radius:8px"><div style="font-size:1.4rem;font-weight:900;color:var(--green)">${tutan}</div><div style="font-size:.65rem;color:var(--muted)">TUTAN</div></div>
        <div style="padding:10px;background:var(--bg3);border-radius:8px"><div style="font-size:1.4rem;font-weight:900;color:var(--red)">${tutmayan}</div><div style="font-size:.65rem;color:var(--muted)">TUTMAYAN</div></div>
        <div style="padding:10px;background:var(--bg3);border-radius:8px"><div style="font-size:1.4rem;font-weight:900;color:var(--orange)">%${oran}</div><div style="font-size:.65rem;color:var(--muted)">BAŞARI</div></div>
      </div>
    </div>
    <div class="card">
      <div class="result-title">📋 KAYITLAR (${toplam})</div>
      ${backtestKayitlari.slice(0, 50).map(b => {
        const emoji = b.tuttu === true ? '✅' : b.tuttu === false ? '❌' : '⏳';
        const renk = b.tuttu === true ? 'green' : b.tuttu === false ? 'red' : 'orange';
        return `
          <div style="padding:10px 0;border-bottom:1px solid var(--border);display:flex;justify-content:space-between;align-items:center;gap:8px">
            <div style="flex:1">
              <div style="font-weight:900;font-size:.8rem">${emoji} ${b.isim}</div>
              <div class="muted" style="font-size:.68rem;margin-top:2px">
                Öneri: <b style="color:var(--${renk})">${b.oneriTip}</b>
                ${b.gercekSkor ? ` · Sonuç: <b>${b.gercekSkor}</b>` : ''}
              </div>
            </div>
            <button type="button" class="btn btn-red btn-sm" onclick="backtestSil(${b.id})">🗑️</button>
          </div>`;
      }).join('')}
    </div>`;
  c.innerHTML = html;
}

function backtestEkle(){
  const isim = $('bt-mac').value.trim();
  const o1 = parseFloat($('bt-o1').value);
  const oX = parseFloat($('bt-oX').value);
  const o2 = parseFloat($('bt-o2').value);
  const skor = $('bt-skor').value.trim();
  if(!isim || !o1 || !oX || !o2){ showToast('error','Eksik','Maç adı ve 1X2 zorunlu.'); return; }
  const a = ValueBetEngine.analizEt({ o1, oX, o2, oU25:null, oA25:null, oKgV:null, oKgY:null });
  const t = TahminMotoru.tahminEt(a, 'toto');
  let tuttu = null;
  if(skor && /^\d+-\d+$/.test(skor)){
    const [h, depl] = skor.split('-').map(Number);
    const gercekKod = h > depl ? '1' : h < depl ? '2' : 'X';
    if(t.karar.tip === 'TEK') tuttu = t.birXiki.enOlası === gercekKod;
    else if(t.karar.tip === 'ÇİFT'){
      const kodlar = [t.birXiki.sirali[0].kod, t.birXiki.sirali[1].kod];
      tuttu = kodlar.includes(gercekKod);
    } else if(t.karar.tip === 'ÜÇLÜ') tuttu = true;
  }
  backtestKayitlari.unshift({
    id: Date.now(), isim, oranlar:{o1,oX,o2},
    oneriTip: t.birXiki.enOlası, favoriOlas: t.birXiki.enOlasıOlas,
    karar: t.karar.tip, gercekSkor: skor || null, tuttu,
    tarih: new Date().toLocaleString('tr-TR')
  });
  if(backtestKayitlari.length > 200) backtestKayitlari = backtestKayitlari.slice(0, 200);
  localStorage.setItem('skorlab_backtest', JSON.stringify(backtestKayitlari));
  ['bt-mac','bt-o1','bt-oX','bt-o2','bt-skor'].forEach(id => { const el = $(id); if(el) el.value = ''; });
  renderBacktest();
  showToast('success','Backtest Eklendi!', tuttu === true ? 'TUTTU ✅' : tuttu === false ? 'TUTMADI ❌' : 'Skor girilmedi');
}

function backtestSil(id){
  if(!confirm('Silinsin mi?')) return;
  backtestKayitlari = backtestKayitlari.filter(x => x.id !== id);
  localStorage.setItem('skorlab_backtest', JSON.stringify(backtestKayitlari));
  renderBacktest();
}

function backtestTemizle(){
  if(!confirm('Tüm kayıtlar silinsin mi?')) return;
  backtestKayitlari = [];
  localStorage.setItem('skorlab_backtest', '[]');
  renderBacktest();
}

/* ============================================================
   19. METİN YAPIŞTIR
   ============================================================ */
function openMetinModal(){
  $('metinInput').value = '';
  $('metinModal').classList.add('active');
}

function metinOku(){
  const metin = $('metinInput').value.trim();
  if(!metin){ showToast('error','Boş','Metin boş.'); return; }
  const maclar = metinParse(metin);
  if(maclar.length === 0){ showToast('error','Hata','Hiç maç okunamadı.'); return; }
  let eklenen = 0;
  maclar.forEach(m => {
    maclarIddaa.unshift({
      id: Date.now() + Math.random(), mac: m.mac,
      oranlar: {
        o1: m.o1, oX: m.oX, o2: m.o2,
        oA25: m.oA25, oU25: m.oU25,
        oKgV: m.oKgV, oKgY: m.oKgY,
        oMS1KgV: m.oMS1KgV, oMSXKgV: m.oMSXKgV, oMS2KgV: m.oMS2KgV,
        oMS1A15: m.oMS1A15, oMS1U15: m.oMS1U15, oMSXA15: m.oMSXA15, oMSXU15: m.oMSXU15, oMS2A15: m.oMS2A15, oMS2U15: m.oMS2U15,
        oMS1A25: m.oMS1A25, oMS1U25: m.oMS1U25, oMSXA25: m.oMSXA25, oMSXU25: m.oMSXU25, oMS2A25: m.oMS2A25, oMS2U25: m.oMS2U25,
        oMS1A35: m.oMS1A35, oMS1U35: m.oMS1U35, oMSXA35: m.oMSXA35, oMSXU35: m.oMSXU35, oMS2A35: m.oMS2A35, oMS2U35: m.oMS2U35
      },
      tarih: new Date().toLocaleString('tr-TR')
    });
    eklenen++;
  });
  localStorage.setItem('skorlab_iddaa', JSON.stringify(maclarIddaa));
  closeModal('metinModal');
  renderIddaa(); renderAnaliz();
  showToast('success','Eklendi!', eklenen + ' maç eklendi.');
}

function metinParse(metin){
  const maclar = [];
  const bloklar = metin.split(/\n\s*\n/);
  bloklar.forEach(blok => {
    const satirlar = blok.split('\n').map(s => s.trim()).filter(s => s);
    if(satirlar.length < 2) return;
    const macIsmi = satirlar[0];
    if(!macIsmi.includes('-') && !macIsmi.includes('–')) return;
    const o1x2 = satirlar[1].split(/[\s,]+/).map(s => parseFloat(s.replace(',','.'))).filter(n => !isNaN(n));
    if(o1x2.length < 3) return;
    let oA25 = null, oU25 = null;
    if(satirlar[2]){
      const o25 = satirlar[2].split(/[\s,]+/).map(s => parseFloat(s.replace(',','.'))).filter(n => !isNaN(n));
      if(o25.length >= 2){ oA25 = o25[0]; oU25 = o25[1]; }
    }
    let oKgV = null, oKgY = null;
    if(satirlar[3]){
      const oKg = satirlar[3].split(/[\s,]+/).map(s => parseFloat(s.replace(',','.'))).filter(n => !isNaN(n));
      if(oKg.length >= 2){ oKgV = oKg[0]; oKgY = oKg[1]; }
    }
    let oMS1KgV = null, oMSXKgV = null, oMS2KgV = null;
    if(satirlar[4]){
      const mskg = satirlar[4].split(/[\s,]+/).map(s => parseFloat(s.replace(',','.'))).filter(n => !isNaN(n));
      if(mskg.length >= 3){ oMS1KgV = mskg[0]; oMSXKgV = mskg[1]; oMS2KgV = mskg[2]; }
    }
    let oMS1A15 = null, oMS1U15 = null, oMSXA15 = null, oMSXU15 = null, oMS2A15 = null, oMS2U15 = null;
    if(satirlar[5]){
      const o15 = satirlar[5].split(/[\s,]+/).map(s => parseFloat(s.replace(',','.'))).filter(n => !isNaN(n));
      if(o15.length >= 6){ oMS1A15=o15[0]; oMS1U15=o15[1]; oMSXA15=o15[2]; oMSXU15=o15[3]; oMS2A15=o15[4]; oMS2U15=o15[5]; }
    }
    let oMS1A25 = null, oMS1U25 = null, oMSXA25 = null, oMSXU25 = null, oMS2A25 = null, oMS2U25 = null;
    if(satirlar[6]){
      const o25 = satirlar[6].split(/[\s,]+/).map(s => parseFloat(s.replace(',','.'))).filter(n => !isNaN(n));
      if(o25.length >= 6){ oMS1A25=o25[0]; oMS1U25=o25[1]; oMSXA25=o25[2]; oMSXU25=o25[3]; oMS2A25=o25[4]; oMS2U25=o25[5]; }
    }
    let oMS1A35 = null, oMS1U35 = null, oMSXA35 = null, oMSXU35 = null, oMS2A35 = null, oMS2U35 = null;
    if(satirlar[7]){
      const o35 = satirlar[7].split(/[\s,]+/).map(s => parseFloat(s.replace(',','.'))).filter(n => !isNaN(n));
      if(o35.length >= 6){ oMS1A35=o35[0]; oMS1U35=o35[1]; oMSXA35=o35[2]; oMSXU35=o35[3]; oMS2A35=o35[4]; oMS2U35=o35[5]; }
    }
    maclar.push({
      mac: macIsmi,
      o1: o1x2[0], oX: o1x2[1], o2: o1x2[2],
      oA25, oU25, oKgV, oKgY,
      oMS1KgV, oMSXKgV, oMS2KgV,
      oMS1A15, oMS1U15, oMSXA15, oMSXU15, oMS2A15, oMS2U15,
      oMS1A25, oMS1U25, oMSXA25, oMSXU25, oMS2A25, oMS2U25,
      oMS1A35, oMS1U35, oMSXA35, oMSXU35, oMS2A35, oMS2U35
    });
  });
  return maclar;
}

/* ============================================================
   20. NAV / MODAL
   ============================================================ */
function switchTab(i, el){
  document.querySelectorAll('.tab, .page').forEach(e => e.classList.remove('active'));
  if(el) el.classList.add('active');
  $('page-'+i).classList.add('active');
  if(i === 3) renderAnaliz();
  if(i === 4) renderKayitliKuponlar();
  if(i === 5) renderBacktest();
}

function closeModal(id){ $(id).classList.remove('active'); }

function showToast(type, title, msg){
  $('toastIcon').innerText = type==='success' ? '✅' : '❌';
  $('toastTitle').innerText = title;
  $('toastMsg').innerText = msg;
  $('toastModal').classList.add('active');
}

window.onload = function(){ loadData(); };
