import json
from datetime import datetime

def generate_matches():
    bugun = datetime.now().strftime("%d.%m.%Y")
    
    matches = [
        {
            "league": "Trendyol Süper Lig",
            "home": "Galatasaray",
            "away": "Alanyaspor",
            "time": "20:00",
            "status": "CANLI",
            "score": "1 - 0",
            "ai": "Poisson: %70 MS 1 (Güven: %88)"
        },
        {
            "league": "Trendyol Süper Lig",
            "home": "Fenerbahçe",
            "away": "Antalyaspor",
            "time": "21:00",
            "status": "BAŞLAYACAK",
            "score": "VS",
            "ai": "Poisson: %74 MS 1 (Güven: %91)"
        },
        {
            "league": "UEFA Uluslar Ligi",
            "home": "İspanya",
            "away": "Sırbistan",
            "time": "21:45",
            "status": "BAŞLAYACAK",
            "score": "VS",
            "ai": "Poisson: %68 MS 1 (Güven: %85)"
        }
    ]
    
    with open("matches.json", "w", encoding="utf-8") as f:
        json.dump(matches, f, ensure_ascii=False, indent=4)
    print(f"[{bugun}] matches.json başarıyla güncellendi.")

if __name__ == "__main__":
    generate_matches()
