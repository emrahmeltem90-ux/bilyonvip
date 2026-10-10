/* ============================================================
   SKORLAB v29 PRO · Senaryo Analizi + Beklenen Skor
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

  /* Dixon-Coles - Skor matrisi ve tüm senaryo olasılıkları */
  static dixonColesMatris(xgEv,xgDep,rho=-0.13){
    const MAX=8;
    let p1=0,pX=0,p2=0,kg=0,ust25=0,alt25=0,kgyok=0;
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
        if(h+a>2.5) ust25+=p;
        if(h+a<2.5) alt25+=p;
        if(h>=1&&a>=1) kg+=p;
        skorlar.push({ h, a, skor: h+'-'+a, p });
      }
    }
    const t = p1+pX+p2;
    p1/=t; pX/=t; p2/=t; ust25/=t; alt25/=t; kg/=t;
    skorlar.forEach(s => s.p /= t);
    skorlar.sort((a,b)=>b.p-a.p);

    return {
      p1,pX,p2,
      pUst25: Math.min(0.99, Math.max(0.01, ust25)),
      pAlt25: Math.min(0.99, Math.max(0.01, alt25)),
      pKgVar: Math.min(0.99, Math.max(0.01, kg)),
      pKgYok: Math.min(0.99, Math.max(0.01, 1-kg)),
      enOlasıSkorlar: skorlar.slice(0,5).map(s => ({
        skor: s.skor,
        yuzde: (s.p*100).toFixed(2)
      })),
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
    return {
      seviye, etiket, sinif, puan,
      toplamXg: toplamXg.toFixed(2),
      pUst25: pUst25.toFixed(1),
      pKgVar: pKgVar.toFixed(1),
      kriterler
    };
  }

  /* === SENARYO HESAPLA (YENİ) === */
  static senaryolariHesapla(poisson, oranlar){
    const senaryolar = [];
    const tumSkorlar = poisson.tumSkorlar || [];

    const o1 = oranlar.o1, oX = oranlar.oX, o2 = oranlar.o2;
    const oU25 = oranlar.oU25, oA25 = oranlar.oA25;
    const oKgV = oranlar.oKgV, oKgY = oranlar.oKgY;

    // Senaryo tanımları: [isim, filtre, oran]
    const tanimlar = [];

    // TEK/ÇİFT/ÜÇLÜ (taraf)
    if(o1) tanimlar.push({ isim:'1 (Ev Sahibi)', tip:'1', filtre: s => s.h > s.a, oran: o1 });
    if(oX) tanimlar.push({ isim:'X (Beraberlik)', tip:'X', filtre: s => s.h === s.a, oran: oX });
    if(o2) tanimlar.push({ isim:'2 (Deplasman)', tip:'2', filtre: s => s.h < s.a, oran: o2 });
    if(o1 && oX) tanimlar.push({ isim:'1X (Çift Şans)', tip:'1X', filtre: s => s.h >= s.a, oran: 1/((1/o1)+(1/oX)) });
    if(oX && o2) tanimlar.push({ isim:'X2 (Çift Şans)', tip:'X2', filtre: s => s.h <= s.a, oran: 1/((1/oX)+(1/o2)) });
    if(o1 && o2) tanimlar.push({ isim:'12 (Çift Şans)', tip:'12', filtre: s => s.h !== s.a, oran: 1/((1/o1)+(1/o2)) });

    // 2.5 Alt/Üst
    if(oU25) tanimlar.push({ isim:'2.5 Üst', tip:'2.5Ü', filtre: s => s.h + s.a > 2.5, oran: oU25 });
    if(oA25) tanimlar.push({ isim:'2.5 Alt', tip:'2.5A', filtre: s => s.h + s.a < 2.5, oran: oA25 });

    // KG
    if(oKgV) tanimlar.push({ isim:'KG Var', tip:'KGV', filtre: s => s.h >= 1 && s.a >= 1, oran: oKgV });
    if(oKgY) tanimlar.push({ isim:'KG Yok', tip:'KGY', filtre: s => !(s.h >= 1 && s.a >= 1), oran: oKgY });

    // Taraf + Gol komboları (senin tarzın)
    if(o1 && oKgV) tanimlar.push({ isim:'1 + KG Var', tip:'1+KGV', filtre: s => s.h > s.a && s.a >= 1, oran: o1*oKgV });
    if(o1 && oU25) tanimlar.push({ isim:'1 + 2.5 Üst', tip:'1+2.5Ü', filtre: s => s.h > s.a && s.h+s.a > 2.5, oran: o1*oU25 });
    if(o2 && oKgV) tanimlar.push({ isim:'2 + KG Var', tip:'2+KGV', filtre: s => s.h < s.a && s.h >= 1, oran: o2*oKgV });
    if(o2 && oU25) tanimlar.push({ isim:'2 + 2.5 Üst', tip:'2+2.5Ü', filtre: s => s.h < s.a && s.h+s.a > 2.5, oran: o2*oU25 });
    if(oX && oKgV) tanimlar.push({ isim:'X + KG Var', tip:'X+KGV', filtre: s => s.h === s.a && s.h >= 1, oran: oX*oKgV });
    if(oX && oU25) tanimlar.push({ isim:'X + 2.5 Üst', tip:'X+2.5Ü', filtre: s => s.h === s.a && s.h+s.a > 2.5, oran: oX*oU25 });

    // Gol komboları
    if(oKgV && oU25) tanimlar.push({ isim:'KG Var + 2.5 Üst', tip:'KGV+2.5Ü', filtre: s => s.h >= 1 && s.a >= 1 && s.h+s.a > 2.5, oran: oKgV*oU25 });
    if(oKgV && oA25) tanimlar.push({ isim:'KG Var + 2.5 Alt', tip:'KGV+2.5A', filtre: s => s.h >= 1 && s.a >= 1 && s.h+s.a < 2.5, oran: oKgV*oA25 });

    // Üçlü kombolar
    if(o1 && oKgV && oU25) tanimlar.push({ isim:'1 + KG Var + 2.5 Üst', tip:'ÜÇLÜ-1', filtre: s => s.h > s.a && s.a >= 1 && s.h+s.a > 2.5, oran: o1*oKgV*oU25 });
    if(o2 && oKgV && oU25) tanimlar.push({ isim:'2 + KG Var + 2.5 Üst', tip:'ÜÇLÜ-2', filtre: s => s.h < s.a && s.h >= 1 && s.h+s.a > 2.5, oran: o2*oKgV*oU25 });

    // Her senaryo için olasılık + EV hesapla
    tanimlar.forEach(t => {
      let olasilik = 0;
      tumSkorlar.forEach(sk => {
        if(t.filtre(sk)) olasilik += sk.p;
      });
      const ev = olasilik * t.oran;
      if(olasilik > 0.02 && t.oran > 1.01){
        senaryolar.push({
          isim: t.isim,
          tip: t.tip,
          oran: t.oran.toFixed(2),
          olasilik: (olasilik*100).toFixed(1),
          olasilikNum: olasilik,
          ev: ev.toFixed(3),
          evNum: ev
        });
      }
    });

    // EV'ye göre sırala
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
    values.sort((a,b)=>parseFloat(b.ev)-parseFloat(a.ev));

    // Senaryoları hesapla
    const senaryolar = this.senaryolariHesapla(poi, veri);

    return {
      marj1X2: shin.marjYuzde.toFixed(2),
      shin: { p1: (shin.p1*100).toFixed(1), pX: (shin.pX*100).toFixed(1), p2: (shin.p2*100).toFixed(1) },
      xgEv: xg.xgEv.toFixed(2), xgDep: xg.xgDep.toFixed(2),
      poisson: {
        p1: (poi.p1*100).toFixed(1), pX: (poi.pX*100).toFixed(1), p2: (poi.p2*100).toFixed(1),
        pUst25: (poi.pUst25*100).toFixed(1), pAlt25: (poi.pAlt25*100).toFixed(1),
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
   3. TAHMİN MOTORU
   ============================================================ */
class TahminMotoru {
  static birXikiTahmin(analiz){
    const p1 = parseFloat(analiz.shin.p1);
    const pX = parseFloat(analiz.shin.pX);
    const p2 = parseFloat(analiz.shin.p2);
    const pp1 = parseFloat(analiz.poisson.p1);
    const ppX = parseFloat(analiz.poisson.pX);
    const pp2 = parseFloat(analiz.poisson.p2);

    const ort1 = (p1 + pp1) / 2;
    const ortX = (pX + ppX) / 2;
    const ort2 = (p2 + pp2) / 2;

    const sirali = [
      { kod:'1', olas: ort1 },
      { kod:'X', olas: ortX },
      { kod:'2', olas: ort2 }
    ].sort((a,b)=>b.olas-a.olas);

    const enOlası = sirali[0];
    const ikinci = sirali[1];
    const surprizRisk = (100 - enOlası.olas).toFixed(1);

    return {
      enOlası: enOlası.kod,
      enOlasıOlas: enOlası.olas.toFixed(1),
      ikinci: ikinci.kod,
      ikinciOlas: ikinci.olas.toFixed(1),
      surprizRisk,
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
    const alt = parseFloat(analiz.poisson.pAlt25);
    const ust = parseFloat(analiz.poisson.pUst25);
    const kgVar = parseFloat(analiz.poisson.pKgVar);
    const kgYok = parseFloat(analiz.poisson.pKgYok);

    let golTahmin = alt > ust ? '2.5 Alt' : '2.5 Üst';
    let golOlas = Math.max(alt, ust);
    let kgTahmin = kgVar > kgYok ? 'KG Var' : 'KG Yok';
    let kgOlas = Math.max(kgVar, kgYok);

    return {
      golTahmin, golOlas: golOlas.toFixed(1),
      kgTahmin, kgOlas: kgOlas.toFixed(1),
      alt: alt.toFixed(1), ust: ust.toFixed(1),
      kgVar: kgVar.toFixed(1), kgYok: kgYok.toFixed(1)
    };
  }

  static yorum(analiz, tahmin){
    const favori = tahmin.birXiki.enOlası;
    const favoriOlas = parseFloat(tahmin.birXiki.enOlasıOlas);
    const ikinci = tahmin.birXiki.ikinci;
    const ikinciOlas = parseFloat(tahmin.birXiki.ikinciOlas);
    const skor = tahmin.skor.enOlası;
    const alt = parseFloat(tahmin.gol.alt);
    const ust = parseFloat(tahmin.gol.ust);
    const kgVar = parseFloat(tahmin.gol.kgVar);
    const marj = parseFloat(analiz.marj1X2);

    const satirlar = [];

    if(favoriOlas >= 75){
      satirlar.push(`<span class="vurgu">${favori} çok güçlü favori (%${favoriOlas})</span>. Bu maç net kazanır gibi.`);
    } else if(favoriOlas >= 60){
      satirlar.push(`<b>${favori}</b> favori ama kesin değil (%${favoriOlas}). <span class="vurgu">Tek işaretlenebilir</span>.`);
    } else if(favoriOlas >= 50){
      satirlar.push(`<b>${favori}</b> hafif favori (%${favoriOlas}) ama <span class="vurgu-riskli">${ikinci} de yakın (%${ikinciOlas})</span>. Tek işaretlemek riskli.`);
    } else {
      satirlar.push(`<span class="vurgu-tehlike">Hiçbir sonuç net değil</span>. ${favori} (%${favoriOlas}) · ${ikinci} (%${ikinciOlas}). <b>ÇİFT veya ÜÇLÜ yap</b>.`);
    }

    const surpriz = parseFloat(tahmin.birXiki.surprizRisk);
    if(surpriz >= 55){
      satirlar.push(`<span class="vurgu-tehlike">Sürpriz riski çok yüksek (%${surpriz})</span>. Favoriye güvenme.`);
    } else if(surpriz >= 40){
      satirlar.push(`<span class="vurgu-riskli">Sürpriz gelebilir (%${surpriz})</span>. ÇİFT düşün.`);
    } else {
      satirlar.push(`Sürpriz riski düşük (%${surpriz}).`);
    }

    if(alt > 65){
      satirlar.push(`⚽ <span class="vurgu">Az gollü maç beklentisi</span> (2.5 Alt %${alt}). En olası skor: <b>${skor}</b>.`);
    } else if(ust > 65){
      satirlar.push(`⚽ <span class="vurgu">Gollü maç beklentisi</span> (2.5 Üst %${ust}). En olası skor: <b>${skor}</b>.`);
    } else {
      satirlar.push(`⚽ Gol dengesiz (Alt %${alt} · Üst %${ust}). Skor: <b>${skor}</b>.`);
    }

    if(kgVar > 60){
      satirlar.push(`🥅 <span class="vurgu">KG Var cazip (%${kgVar})</span>. İki takım da atabilir.`);
    } else if(kgVar < 40){
      satirlar.push(`🥅 <span class="vurgu">KG Yok muhtemel (%${(100-kgVar).toFixed(1)})</span>. Tek takım atar.`);
    }

    if(marj > 20){
      satirlar.push(`<span class="vurgu-tehlike">⚠️ Marj çok yüksek (%${marj})</span>. Bu maça para yatırma.`);
    } else if(marj > 15){
      satirlar.push(`<span class="vurgu-riskli">Marj yüksek (%${marj})</span>. Küçük bahis oyna.`);
    }

    return satirlar;
  }

  static karar(analiz, tahmin, mod='toto'){
    const favoriOlas = parseFloat(tahmin.birXiki.enOlasıOlas);
    const marj = parseFloat(analiz.marj1X2);

    if(mod === 'toto'){
      if(favoriOlas >= 68){
        return { tip:'TEK', renk:'green', emoji:'🟢', mesaj:'Tek işaretle', kolon: 1 };
      }
      if(favoriOlas >= 52){
        return { tip:'ÇİFT', renk:'orange', emoji:'🟡', mesaj:'2 işaretle', kolon: 2 };
      }
      return { tip:'ÜÇLÜ', renk:'red', emoji:'🔴', mesaj:'3 işaretle', kolon: 3 };
    } else {
      if(favoriOlas < 45){
        return { tip:'ATLA', renk:'gray', emoji:'⚫', mesaj:'Taraf oynama, senaryolara bak', kolon: 0 };
      }
      if(marj >= 20 && favoriOlas < 60){
        return { tip:'ATLA', renk:'gray', emoji:'⚫', mesaj:'Marj çok yüksek, değer yok', kolon: 0 };
      }
      if(favoriOlas >= 72){
        return { tip:'TEK', renk:'green', emoji:'🟢', mesaj:'Tek oyna', kolon: 1 };
      }
      if(favoriOlas >= 55){
        return { tip:'ÇİFT', renk:'orange', emoji:'🟡', mesaj:'2\'li oyna', kolon: 2 };
      }
      return { tip:'ÜÇLÜ', renk:'red', emoji:'🔴', mesaj:'3\'lü oyna', kolon: 3 };
    }
  }

  static tahminEt(analiz, mod='toto'){
    const birXiki = this.birXikiTahmin(analiz);
    const skor = this.skorTahmin(analiz);
    const gol = this.golTahmin(analiz);
    const yorum = this.yorum(analiz, { birXiki, skor, gol });
    const karar = this.karar(analiz, { birXiki, skor, gol }, mod);
    return { birXiki, skor, gol, yorum, karar };
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
      <div class="yorum-box ${tahmin.karar.tip === 'ÜÇLÜ' ? 'tehlike' : tahmin.karar.tip === 'ÇİFT' ? 'riskli' : ''}">
        <div class="baslik">${tahmin.karar.emoji} ${tahmin.karar.tip} — ${tahmin.karar.mesaj}</div>
        ${tahmin.yorum.map(y => `<p>▸ ${y}</p>`).join('')}
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
   8. İDDAA RENDER (Senaryolar + Beklenen Skor)
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
      oKgV:o.oKgV, oKgY:o.oKgY
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

    // Beklenen skorlar (top 5)
    const skorlar = a.poisson.enOlasıSkorlar || [];
    let skorHTML = '';
    if(skorlar.length > 0){
      skorHTML = `
        <div class="analiz-box">
          <span class="analiz-lbl">⚽ BEKLENEN SKORLAR</span>
          <div class="skor-grid">
            ${skorlar.map((s, i) => `
              <div class="skor-item">
                <div class="skor-sayi">${s.skor}</div>
                <div class="skor-yuzde">%${s.yuzde}</div>
              </div>
            `).join('')}
          </div>
        </div>
      `;
    }

    // Senaryolar (en iyi 5)
    const senaryolar = a.senaryolar || [];
    let senaryoHTML = '';
    if(senaryolar.length > 0){
      const top5 = senaryolar.slice(0, 5);
      const enIyiEv = top5[0].evNum;

      senaryoHTML = `
        <div class="analiz-box">
          <span class="analiz-lbl">📋 SENARYOLAR (En iyi 5)</span>
          ${top5.map((s, i) => {
            const isEnIyi = i === 0;
            const guven = s.olasilikNum >= 0.55 ? '⭐⭐⭐⭐⭐' :
                          s.olasilikNum >= 0.45 ? '⭐⭐⭐⭐' :
                          s.olasilikNum >= 0.35 ? '⭐⭐⭐' :
                          s.olasilikNum >= 0.25 ? '⭐⭐' : '⭐';
            return `
              <div class="senaryo-box ${isEnIyi ? 'en-iyi' : ''}">
                <div class="senaryo-head">
                  <span class="senaryo-isim">${isEnIyi ? '⭐ ' : ''}${s.isim}</span>
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
      oKgV:o.oKgV, oKgY:o.oKgY
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
    const enIyiSenaryo = s.analiz.senaryolar && s.analiz.senaryolar.length > 0 ? s.analiz.senaryolar[0] : null;
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
        ${enIyiSenaryo ? `
          <div style="margin-top:4px;color:var(--purple);font-weight:800;font-size:.72rem">
            ⭐ ${enIyiSenaryo.isim} @ ${enIyiSenaryo.oran} (%${enIyiSenaryo.olasilik})
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
      oU25:o.oU25, oA25:o.oA25, oKgV:o.oKgV, oKgY:o.oKgY
    });
    const t = TahminMotoru.tahminEt(a, 'iddaa');
    secili.push({ mac_id: m.id, isim: m.mac, tahmin: t });
  });
  kuponKurVeGoster(secili, 'iddaa');
}

function kuponKurVeGoster(maclar, tip){
  if(!maclar.length){ showToast('error','Maç Yok','Oran girmen gerek.'); return; }

  let kolon = 1;
  const detaylar = maclar.map(m => {
    const t = m.tahmin;
    let secim = '';
    let k = 1;

    if(t.karar.tip === 'TEK'){
      secim = t.birXiki.enOlası;
      k = 1;
    } else if(t.karar.tip === 'ÇİFT'){
      secim = t.birXiki.sirali[0].kod + t.birXiki.sirali[1].kod;
      k = 2;
    } else if(t.karar.tip === 'ÜÇLÜ'){
      secim = '1X2';
      k = 3;
    } else {
      secim = 'ATLA';
      k = 0;
    }

    if(k > 0) kolon *= k;
    return { isim: m.isim, secim, tahmin: t, kolonCarpani: k };
  });

  const oynanabilir = detaylar.filter(d => d.secim !== 'ATLA');
  const atlanan = detaylar.filter(d => d.secim === 'ATLA');

  const tekSay = detaylar.filter(d => d.secim.length === 1).length;
  const ciftSay = detaylar.filter(d => d.secim.length === 2).length;
  const ucluSay = detaylar.filter(d => d.secim === '1X2').length;

  let html = `
    <div class="card" style="border:2px solid var(--purple)">
      <div class="result-title" style="color:var(--purple)">🤖 OTOMATİK KUPON (${oynanabilir.length} maç)</div>
      ${atlanan.length ? `<div class="muted" style="font-size:.72rem;margin-bottom:8px">⚫ ${atlanan.length} maç ATLA (oynanmadı)</div>` : ''}
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:6px;margin-bottom:12px;font-size:.65rem;text-align:center">
        <div style="padding:6px;background:rgba(0,230,118,.15);border-radius:6px"><b style="color:var(--green)">${tekSay}</b><br><span class="muted">TEK</span></div>
        <div style="padding:6px;background:rgba(255,176,32,.15);border-radius:6px"><b style="color:var(--orange)">${ciftSay}</b><br><span class="muted">ÇİFT</span></div>
        <div style="padding:6px;background:rgba(255,77,94,.15);border-radius:6px"><b style="color:var(--red)">${ucluSay}</b><br><span class="muted">ÜÇLÜ</span></div>
      </div>
  `;

  detaylar.forEach(d => {
    const t = d.tahmin;
    const renk = d.secim === 'ATLA' ? 'muted' :
                 d.secim.length === 1 ? 'green' :
                 d.secim.length === 2 ? 'orange' : 'red';
    html += `
      <div style="padding:8px 0;border-bottom:1px solid var(--border);font-size:.75rem;${d.secim === 'ATLA' ? 'opacity:.5' : ''}">
        <div style="font-weight:900;margin-bottom:3px">${d.isim}</div>
        <div style="display:flex;justify-content:space-between;align-items:center">
          <span style="font-weight:900;color:var(--${renk});font-size:.9rem">${d.secim}</span>
          <span class="muted" style="font-size:.68rem">Sonuç: ${t.birXiki.enOlası} (%${t.birXiki.enOlasıOlas})</span>
        </div>
      </div>
    `;
  });

  html += `
      <div style="margin-top:12px;padding:10px;background:var(--bg3);border-radius:8px">
        <div class="analiz-row"><span>Toplam Kolon:</span><b class="green">${kolon}</b></div>
        <div class="analiz-row"><span>Tutar (10 TL/kolon):</span><b class="green">${kolon * 10} TL</b></div>
      </div>
      <button type="button" class="btn btn-purple btn-lg" onclick="otomatikKuponuKaydet('${tip}')" style="margin-top:12px">💾 BU KUPONU KAYDET</button>
    </div>
  `;

  const hedef = tip === 'toto' ? 'totoKuponSonuc' : 'kuponSonuc';
  $(hedef).innerHTML = html;
  window.sonOtomatikKupon = { tip, detaylar: oynanabilir, kolon };
}

function otomatikKuponuKaydet(tip){
  const k = window.sonOtomatikKupon;
  if(!k) return;
  kayitliKuponlar.unshift({
    id: Date.now(),
    tip: tip,
    tarih: new Date().toLocaleString('tr-TR'),
    macSayisi: k.detaylar.length,
    kolon: k.kolon,
    tutar: k.kolon * 10,
    detaylar: k.detaylar.map(d => ({ isim: d.isim, secim: d.secim })),
    durum: 'bekliyor'
  });
  if(kayitliKuponlar.length > 50) kayitliKuponlar = kayitliKuponlar.slice(0, 50);
  localStorage.setItem('skorlab_kuponlar', JSON.stringify(kayitliKuponlar));
  renderKayitliKuponlar();
  showToast('success','Kupon Kaydedildi!', k.detaylar.length + ' maç · ' + k.kolon + ' kolon');
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
   12. İDDAA MAÇ EKLE
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
   13. KUPON HESAP
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
    html += `
      <div style="padding:10px 0;border-bottom:1px solid var(--border);font-size:.78rem">
        <div style="font-weight:900;margin-bottom:4px">#${o.mac_id} ${o.isim}</div>
        <div style="display:flex;justify-content:space-between">
          <b style="color:var(--${renk});font-size:.9rem">🎯 ${secim}</b>
          <span class="muted">${t.karar.emoji} ${t.karar.tip}</span>
        </div>
        <div class="muted" style="font-size:.68rem;margin-top:2px">⚽ ${t.skor.enOlası} · 📊 ${t.gol.golTahmin} (%${t.gol.golOlas})</div>
      </div>`;
  });
  html += `
      <div style="margin-top:12px;padding:10px;background:var(--bg3);border-radius:8px">
        <div class="analiz-row"><span>Toplam Kolon:</span><b class="green">${kolon}</b></div>
        <div class="analiz-row"><span>Tutar:</span><b class="green">${kolon * 10} TL</b></div>
      </div>
      <button type="button" class="btn btn-green btn-lg" onclick="kuponKaydetToto()" style="margin-top:12px">💾 KUPONU KAYDET</button>
    </div>`;
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
      oU25:o.oU25, oA25:o.oA25, oKgV:o.oKgV, oKgY:o.oKgY
    });
    const gol = ValueBetEngine.golluMacAnaliz(a.poisson, parseFloat(a.xgEv), parseFloat(a.xgDep));
    if(golFiltre !== 'hepsi' && gol.seviye !== golFiltre) return;
    const t = TahminMotoru.tahminEt(a, 'iddaa');
    oneriler.push({ mac_id: m.id, isim: m.mac, tahmin: t, gol, enIyiSenaryo: a.senaryolar && a.senaryolar[0] });
  });
  if(!oneriler.length){ showToast('error','Maç Yok','Oynanabilir maç yok.'); return; }

  let html = `<div class="card" style="border:1px solid var(--green)"><div class="result-title">⚡ İDDAA KUPON ÖNERİSİ (${oneriler.length} maç)</div>`;
  oneriler.forEach(o => {
    const t = o.tahmin;
    const senaryo = o.enIyiSenaryo;
    html += `
      <div style="padding:10px 0;border-bottom:1px solid var(--border);font-size:.78rem">
        <div style="font-weight:900;margin-bottom:4px">${o.isim}</div>
        ${senaryo ? `
          <div style="display:flex;justify-content:space-between;align-items:center">
            <b style="color:var(--purple);font-size:.9rem">⭐ ${senaryo.isim}</b>
            <span style="font-weight:900;color:var(--green)">@ ${senaryo.oran}</span>
          </div>
          <div class="muted" style="font-size:.68rem;margin-top:2px">Olasılık: %${senaryo.olasilik} · EV: ${senaryo.ev}</div>
        ` : `
          <div class="muted">Senaryo hesaplanamadı</div>
        `}
      </div>`;
  });
  html += `
      <button type="button" class="btn btn-green btn-lg" onclick="kuponKaydetIddaaSenaryo()" style="margin-top:12px">💾 KUPONU KAYDET</button>
    </div>`;
  $('kuponSonuc').innerHTML = html;
  window.sonIddaaKuponu = oneriler;
}

function kuponKaydetIddaaSenaryo(){
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

function kuponKaydetIddaa(){
  kuponKaydetIddaaSenaryo();
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
    'U25':o.oU25, 'A25':o.oA25, 'KgV':o.oKgV, 'KgY':o.oKgY
  }, 'iddaa');
}

function analizGosterOrtak(isim, o, mod){
  const rapor = ValueBetEngine.analizEt({
    o1: o['1'], oX: o['X'], o2: o['2'],
    oU25: o['U25'], oA25: o['A25'], oKgV: o['KgV'], oKgY: o['KgY']
  });
  const mc = MonteCarloEngine.macSimuleEt(parseFloat(rapor.xgEv), parseFloat(rapor.xgDep), 10000);
  const t = TahminMotoru.tahminEt(rapor, mod);

  // Beklenen skorlar
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

  // Senaryolar
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
          return `
            <div class="senaryo-box ${isEnIyi ? 'en-iyi' : ''}">
              <div class="senaryo-head">
                <span class="senaryo-isim">${isEnIyi ? '⭐ ' : ''}${s.isim}</span>
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
        <div class="tahmin-satir"><span class="lbl">📊 GOL TAHMİNİ</span><span class="val green">${t.gol.golTahmin} (%${t.gol.golOlas})</span></div>
        <div class="tahmin-satir"><span class="lbl">🥅 KG TAHMİNİ</span><span class="val orange">${t.gol.kgTahmin} (%${t.gol.kgOlas})</span></div>
      </div>

      ${skorHTML}
      ${senaryoHTML}

      <div class="yorum-box ${t.karar.tip === 'ATLA' || t.karar.tip === 'ÜÇLÜ' ? 'tehlike' : t.karar.tip === 'ÇİFT' ? 'riskli' : ''}">
        <div class="baslik">${t.karar.emoji} SİSTEM YORUMU</div>
        ${t.yorum.map(y => `<p>▸ ${y}</p>`).join('')}
      </div>

      ${golHTML}

      <div class="analiz-box">
        <span class="analiz-lbl">📊 SHIN MARJ ARINDIRMA</span>
        <div class="analiz-row"><span>1:</span><b style="color:var(--green)">%${rapor.shin.p1}</b></div>
        <div class="analiz-row"><span>X:</span><b style="color:var(--orange)">%${rapor.shin.pX}</b></div>
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
      </div>

      ${rapor.values.length > 0 ? `
      <div class="analiz-box" style="border:1px solid var(--green)">
        <span class="analiz-lbl">💎 VALUE BET</span>
        ${rapor.values.slice(0,5).map(v => `
          <div style="padding:6px 0;border-bottom:1px solid var(--border)">
            <div style="display:flex;justify-content:space-between">
              <b style="color:var(--green)">${v.market} @ ${v.oran}</b>
              <b style="color:var(--green)">EV: ${v.ev}</b>
            </div>
          </div>
        `).join('')}
      </div>` : ''}
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
  if(!metin){
    showToast('error','Boş','Metin boş. Bir şeyler yapıştır.');
    return;
  }
  const maclar = metinParse(metin);
  if(maclar.length === 0){
    showToast('error','Hata','Hiç maç okunamadı. Format doğru mu?');
    return;
  }
  let eklenen = 0;
  maclar.forEach(m => {
    maclarIddaa.unshift({
      id: Date.now() + Math.random(),
      mac: m.mac,
      oranlar: {
        o1: m.o1, oX: m.oX, o2: m.o2,
        oA25: m.oA25, oU25: m.oU25,
        oKgV: m.oKgV, oKgY: m.oKgY
      },
      tarih: new Date().toLocaleString('tr-TR')
    });
    eklenen++;
  });
  localStorage.setItem('skorlab_iddaa', JSON.stringify(maclarIddaa));
  closeModal('metinModal');
  renderIddaa();
  renderAnaliz();
  showToast('success','Eklendi!', eklenen + ' maç listeye eklendi.');
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
    maclar.push({ mac: macIsmi, o1: o1x2[0], oX: o1x2[1], o2: o1x2[2], oA25, oU25, oKgV, oKgY });
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
