import json
from datetime import datetime

def oran_to_olasilik(ms1, msX, ms2):
    """Bahis oranlarını normalize edilmiş olasılıklara çevirir."""
    o1, oX, o2 = float(ms1), float(msX), float(ms2)
    t1, tX, t2 = 1/o1, 1/oX, 1/o2
    toplam = t1 + tX + t2
    return [
        round(t1 / toplam * 100, 1),
        round(tX / toplam * 100, 1),
        round(t2 / toplam * 100, 1)
    ]

def poisson_duzeltme(p):
    """Dixon-Coles benzeri düzeltme: beraberlik olasılığını hafif artırır."""
    if p[1] < 25:
        ek = min(3, 25 - p[1])
        p[1] += ek
        p[0] -= ek * 0.6
        p[2] -= ek * 0.4
    return [round(x, 1) for x in p]

def generate_bulten():
    today = datetime.now().strftime("%Y-%m-%d")
    
    maclar = [
        {"id":1,"league":"UEFA Uluslar Ligi","home":"Belçika","away":"Türkiye","date":"02 Eki","time":"21:45","odds":{"ms1":"1.45","msX":"3.80","ms2":"4.20"},"form":"Belçika evinde güçlü. Türkiye deplasmanda zorlanıyor.","series":["W","D","W","L","W"]},
        {"id":2,"league":"UEFA Uluslar Ligi","home":"İtalya","away":"Türkiye","date":"05 Eki","time":"21:45","odds":{"ms1":"2.20","msX":"3.10","ms2":"2.50"},"form":"İtalya evinde hafif favori.","series":["W","W","D","W","L"]},
        {"id":3,"league":"UEFA Uluslar Ligi","home":"Bosna Hersek","away":"İsveç","date":"02 Eki","time":"21:45","odds":{"ms1":"3.80","msX":"3.20","ms2":"1.65"},"form":"İsveç deplasmanda favori.","series":["L","D","W","L","D"]},
        {"id":4,"league":"UEFA Uluslar Ligi","home":"Fransa","away":"İtalya","date":"02 Eki","time":"21:45","odds":{"ms1":"1.30","msX":"4.20","ms2":"6.50"},"form":"Fransa evinde net favori.","series":["W","W","D","W","W"]},
        {"id":5,"league":"UEFA Uluslar Ligi","home":"Macaristan","away":"Gürcistan","date":"02 Eki","time":"21:45","odds":{"ms1":"1.85","msX":"3.20","ms2":"3.40"},"form":"Macaristan evinde favori.","series":["W","D","L","W","D"]},
        {"id":6,"league":"UEFA Uluslar Ligi","home":"Polonya","away":"Romanya","date":"02 Eki","time":"21:45","odds":{"ms1":"1.70","msX":"3.40","ms2":"4.00"},"form":"Polonya evinde güçlü.","series":["W","W","D","L","W"]},
        {"id":7,"league":"UEFA Uluslar Ligi","home":"Hırvatistan","away":"İngiltere","date":"03 Eki","time":"19:00","odds":{"ms1":"2.60","msX":"3.20","ms2":"2.30"},"form":"İngiltere hafif favori. Dengeli maç.","series":["D","W","L","W","D"]},
        {"id":8,"league":"UEFA Uluslar Ligi","home":"Kuzey Makedonya","away":"İskoçya","date":"03 Eki","time":"21:45","odds":{"ms1":"3.10","msX":"3.20","ms2":"2.05"},"form":"İskoçya deplasmanda favori.","series":["L","D","L","W","D"]},
        {"id":9,"league":"UEFA Uluslar Ligi","home":"İspanya","away":"Çekya","date":"03 Eki","time":"21:45","odds":{"ms1":"1.25","msX":"5.00","ms2":"8.00"},"form":"İspanya evinde net favori.","series":["W","W","W","D","W"]},
        {"id":10,"league":"UEFA Uluslar Ligi","home":"İsviçre","away":"Slovenya","date":"03 Eki","time":"21:45","odds":{"ms1":"1.75","msX":"3.40","ms2":"3.80"},"form":"İsviçre evinde favori.","series":["W","D","W","W","L"]},
        {"id":11,"league":"UEFA Uluslar Ligi","home":"Galler","away":"Danimarka","date":"04 Eki","time":"21:45","odds":{"ms1":"2.70","msX":"3.20","ms2":"2.25"},"form":"Danimarka hafif favori.","series":["D","L","W","D","W"]},
        {"id":12,"league":"UEFA Uluslar Ligi","home":"Hollanda","away":"Sırbistan","date":"04 Eki","time":"21:45","odds":{"ms1":"1.60","msX":"3.60","ms2":"4.60"},"form":"Hollanda evinde favori.","series":["W","W","D","W","W"]},
        {"id":13,"league":"UEFA Uluslar Ligi","home":"Portekiz","away":"Norveç","date":"04 Eki","time":"21:45","odds":{"ms1":"1.55","msX":"3.70","ms2":"5.00"},"form":"Portekiz evinde güçlü.","series":["W","D","W","W","D"]},
        {"id":14,"league":"UEFA Uluslar Ligi","home":"Yunanistan","away":"Almanya","date":"04 Eki","time":"21:45","odds":{"ms1":"2.80","msX":"3.20","ms2":"2.20"},"form":"Almanya deplasmanda favori.","series":["D","W","L","D","W"]},
        {"id":15,"league":"UEFA Uluslar Ligi","home":"Fransa","away":"Belçika","date":"05 Eki","time":"21:45","odds":{"ms1":"1.90","msX":"3.30","ms2":"3.30"},"form":"Fransa evinde hafif favori.","series":["W","W","D","W","W"]}
    ]
    
    matches_output = []
    for m in maclar:
        p_ham = oran_to_olasilik(m["odds"]["ms1"], m["odds"]["msX"], m["odds"]["ms2"])
        p_dc = poisson_duzeltme(p_ham)
        
        matches_output.append({
            "id": m["id"],
            "league": m["league"],
            "home_team": m["home"],
            "away_team": m["away"],
            "date": m["date"],
            "time": m["time"],
            "p": p_dc,
            "form": m["form"],
            "series": m["series"],
            "poisson": {
                "prediction": "MS 1" if p_dc[0] > max(p_dc[1], p_dc[2]) else ("MS 2" if p_dc[2] > p_dc[1] else "MS 0"),
                "rate": f"%{max(p_dc):.0f}",
                "confidence": f"%{min(95, 50 + max(p_dc)/2):.0f}"
            }
        })
    
    bulten_data = {
        "last_updated": today,
        "matches": matches_output
    }
    
    with open("matches.json", "w", encoding="utf-8") as f:
        json.dump(bulten_data, f, ensure_ascii=False, indent=2)
    print(f"OK: {len(matches_output)} mac, {today}")

if __name__ == "__main__":
    generate_bulten()
