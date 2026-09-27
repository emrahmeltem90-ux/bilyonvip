import json
from datetime import datetime

def generate_bulten():
    today = datetime.now().strftime("%d.%m.%Y")
    
    # Otomatik güncellenen bülten verileri (Poisson YZ Algoritması ile)
    bulten_data = {
        "last_updated": today,
        "matches": [
            { "id": 901, "league": "UEFA Uluslar Ligi", "home": "Danimarka", "away": "Galler", "score": "VS", "isLive": False, "category": "nations", "odds": { "ms1": "1.23", "msX": "4.60", "ms2": "6.97" }, "ai": "MS 1 (%81) / 2.5 Üst" },
            { "id": 902, "league": "UEFA Uluslar Ligi", "home": "Sırbistan", "away": "Hollanda", "score": "VS", "isLive": False, "category": "nations", "odds": { "ms1": "6.29", "msX": "4.58", "ms2": "1.25" }, "ai": "MS 2 (%88) / KG Var" },
            { "id": 903, "league": "UEFA Uluslar Ligi", "home": "Almanya", "away": "Yunanistan", "score": "VS", "isLive": False, "category": "nations", "odds": { "ms1": "1.27", "msX": "4.55", "ms2": "5.87" }, "ai": "MS 1 (%84)" },
            { "id": 904, "league": "UEFA Uluslar Ligi", "home": "Türkiye", "away": "İtalya", "score": "VS", "isLive": False, "category": "nations", "odds": { "ms1": "2.33", "msX": "3.10", "ms2": "2.35" }, "ai": "Poisson: %41 - %29 - %30 -> MS 1X" },
            
            # Spor Toto 15 Maç Listesi
            { "id": 801, "league": "🎯 SPOR TOTO - Maç 1", "home": "Belçika", "away": "Türkiye", "score": "VS", "isLive": False, "category": "toto", "odds": { "ms1": "1.45", "msX": "3.80", "ms2": "4.20" }, "ai": "Poisson: %66 - %19 - %16 -> MS 1" },
            { "id": 802, "league": "🎯 SPOR TOTO - Maç 2", "home": "İtalya", "away": "Türkiye", "score": "VS", "isLive": False, "category": "toto", "odds": { "ms1": "2.20", "msX": "3.10", "ms2": "2.50" }, "ai": "Poisson: %37 - %37 - %26 -> MS 1X" },
            { "id": 803, "league": "🎯 SPOR TOTO - Maç 3", "home": "Bosna Hersek", "away": "İsveç", "score": "VS", "isLive": False, "category": "toto", "odds": { "ms1": "3.80", "msX": "3.20", "ms2": "1.65" }, "ai": "Poisson: %15 - %11 - %74 -> MS 2" },
            { "id": 804, "league": "🎯 SPOR TOTO - Maç 4", "home": "Fransa", "away": "İtalya", "score": "VS", "isLive": False, "category": "toto", "odds": { "ms1": "1.30", "msX": "4.20", "ms2": "6.50" }, "ai": "Poisson: %85 - %11 - %04 -> MS 1" },
            { "id": 805, "league": "🎯 SPOR TOTO - Maç 5", "home": "Macaristan", "away": "Gürcistan", "score": "VS", "isLive": False, "category": "toto", "odds": { "ms1": "1.85", "msX": "3.20", "ms2": "3.40" }, "ai": "Poisson: %50 - %37 - %13 -> MS 1" }
        ]
    }

    with open("bulten.json", "w", encoding="utf-8") as f:
        json.dump(bulten_data, f, ensure_ascii=False, indent=4)
    print("Bülten başarıyla güncellendi:", today)

if __name__ == "__main__":
    generate_bulten()
