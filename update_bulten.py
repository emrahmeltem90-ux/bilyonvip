import json
from datetime import datetime

def oran_to_olasilik(ms1, msX, ms2):
    o1, oX, o2 = float(ms1), float(msX), float(ms2)
    t1, tX, t2 = 1/o1, 1/oX, 1/o2
    toplam = t1 + tX + t2
    return [
        round(t1 / toplam * 100, 1),
        round(tX / toplam * 100, 1),
        round(t2 / toplam * 100, 1)
    ]

def poisson_duzeltme(p):
    if p[1] < 25:
        ek = min(3, 25 - p[1])
        p[1] += ek
        p[0] -= ek * 0.6
        p[2] -= ek * 0.4
    return [round(x, 1) for x in p]

def generate_bulten():
    today = datetime.now().strftime("%Y-%m-%d")
    
    maclar = [
        {"id":1,"league":"Trendyol Süper Lig","home":"Galatasaray A.Ş.","away":"Kasımpaşa A.Ş.","date":"09 Eki","time":"20:00","odds":{"ms1":"1.32","msX":"4.80","ms2":"6.80"},"form":"Galatasaray evinde net favori.","series":["W","W","W","D","W"]},
        {"id":2,"league":"Trendyol 1. Lig","home":"Gençlerbirliği","away":"Amed Sportif Faaliyetler","date":"10 Eki","time":"13:30","odds":{"ms1":"2.15","msX":"3.00","ms2":"3.20"},"form":"Gençlerbirliği saha avantajıyla hafif önde.","series":["D","W","L","W","D"]},
        {"id":3,"league":"Trendyol Süper Lig","home":"Alanyaspor","away":"Erzurumspor FK","date":"10 Eki","time":"16:00","odds":{"ms1":"1.65","msX":"3.40","ms2":"4.70"},"form":"Alanyaspor evinde favori.","series":["W","L","D","W","W"]},
        {"id":4,"league":"Trendyol Süper Lig","home":"Samsunspor A.Ş.","away":"Trabzonspor A.Ş.","date":"10 Eki","time":"16:00","odds":{"ms1":"2.90","msX":"3.10","ms2":"2.25"},"form":"Trabzonspor deplasmanda hafif favori.","series":["D","W","L","D","W"]},
        {"id":5,"league":"Trendyol Süper Lig","home":"Çaykur Rizespor A.Ş.","away":"Fenerbahçe A.Ş.","date":"10 Eki","time":"19:00","odds":{"ms1":"5.50","msX":"4.00","ms2":"1.48"},"form":"Fenerbahçe deplasmanda güçlü.","series":["W","W","W","L","W"]},
        {"id":6,"league":"Trendyol Süper Lig","home":"Konyaspor","away":"Başakşehir FK","date":"11 Eki","time":"13:30","odds":{"ms1":"2.70","msX":"2.90","ms2":"2.55"},"form":"Dengeli ve sürprize açık maç.","series":["L","D","W","D","L"]},
        {"id":7,"league":"Trendyol Süper Lig","home":"Gaziantep FK A.Ş.","away":"Çorum FK","date":"11 Eki","time":"16:00","odds":{"ms1":"1.55","msX":"3.60","ms2":"5.30"},"form":"Gaziantep FK evinde favori.","series":["W","D","W","L","D"]},
        {"id":8,"league":"Trendyol Süper Lig","home":"Beşiktaş A.Ş.","away":"Kocaelispor","date":"11 Eki","time":"19:00","odds":{"ms1":"1.38","msX":"4.30","ms2":"6.40"},"form":"Beşiktaş evinde güçlü favori.","series":["W","W","D","W","W"]},
        {"id":9,"league":"Trendyol Süper Lig","home":"Eyüpspor","away":"Göztepe A.Ş.","date":"12 Eki","time":"20:00","odds":{"ms1":"2.30","msX":"2.90","ms2":"3.00"},"form":"Eyüpspor evinde hafif önde.","series":["D","W","W","L","D"]},
        {"id":10,"league":"Bundesliga","home":"Augsburg","away":"Bayern Münih","date":"10 Eki","time":"16:30","odds":{"ms1":"8.00","msX":"5.00","ms2":"1.25"},"form":"Bayern Münih net favori.","series":["W","W","W","W","D"]},
        {"id":11,"league":"Bundesliga","home":"Leipzig","away":"Eintracht Frankfurt","date":"10 Eki","time":"19:30","odds":{"ms1":"1.70","msX":"3.40","ms2":"4.00"},"form":"Leipzig evinde favori.","series":["W","L","W","W","D"]},
        {"id":12,"league":"Premier League","home":"Manchester United","away":"Tottenham","date":"10 Eki","time":"19:30","odds":{"ms1":"2.15","msX":"3.25","ms2":"2.90"},"form":"Manchester United hafif favori.","series":["L","W","D","W","L"]},
        {"id":13,"league":"Premier League","home":"Liverpool","away":"Manchester City","date":"11 Eki","time":"18:30","odds":{"ms1":"2.50","msX":"3.20","ms2":"2.50"},"form":"Oranlar eşit, haftanın dev maçı.","series":["W","W","D","W","W"]},
        {"id":14,"league":"La Liga","home":"Real Madrid","away":"Villarreal","date":"10 Eki","time":"22:00","odds":{"ms1":"1.35","msX":"4.70","ms2":"6.50"},"form":"Real Madrid evinde net favori.","series":["W","W","W","D","W"]},
        {"id":15,"league":"Serie A","home":"Como 1907","away":"AS Roma","date":"11 Eki","time":"13:30","odds":{"ms1":"4.10","msX":"3.20","ms2":"1.80"},"form":"Roma deplasmanda favori.","series":["D","L","W","D","W"]}
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
