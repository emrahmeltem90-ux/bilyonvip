import os
import math
import random
import json
import ssl
import urllib.request
from http.server import HTTPServer, BaseHTTPRequestHandler

class BotUzmanEngine:
    def __init__(self, simulations=5000):
        self.simulations = simulations

    def _poisson_sample(self, lmbda):
        L = math.exp(-lmbda)
        k = 0
        p = 1.0
        while p > L:
            k += 1
            p *= random.random()
        return k - 1

    def monte_carlo_simulation(self, home_xg, away_xg):
        score_counts = {}
        over_25_count = 0
        for _ in range(self.simulations):
            h_goals = self._poisson_sample(home_xg)
            a_goals = self._poisson_sample(away_xg)
            score = (h_goals, a_goals)
            score_counts[score] = score_counts.get(score, 0) + 1
            if (h_goals + a_goals) > 2.5:
                over_25_count += 1

        sorted_scores = sorted(score_counts.items(), key=lambda x: x[1], reverse=True)
        top_1 = sorted_scores[0][0]
        top_2 = sorted_scores[1][0] if len(sorted_scores) > 1 else top_1

        return {
            "p_over25": round((over_25_count / self.simulations) * 100, 1),
            "p_under25": round(100 - (over_25_count / self.simulations) * 100, 1),
            "exact_score": f"{top_1[0]} - {top_1[1]}",
            "backup_score": f"{top_2[0]} - {top_2[1]}"
        }

    def fetch_live_fixtures(self):
        matches = []
        # SSL sertifika kontrolünü devreden çıkarıyoruz (Render SSL hatasını çözer)
        ssl_context = ssl._create_unverified_context()
        
        urls = [
            "https://site.api.espn.com/apis/site/v2/sports/soccer/all/scoreboard",
            "https://site.api.espn.com/apis/site/v2/sports/soccer/tur.1/scoreboard",
            "https://site.api.espn.com/apis/site/v2/sports/soccer/eng.1/scoreboard",
            "https://site.api.espn.com/apis/site/v2/sports/soccer/esp.1/scoreboard"
        ]
        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        }

        for url in urls:
            try:
                req = urllib.request.Request(url, headers=headers)
                with urllib.request.urlopen(req, timeout=5, context=ssl_context) as response:
                    data = json.loads(response.read().decode('utf-8'))
                    events = data.get('events', [])
                    for event in events:
                        competitors = event['competitions'][0]['competitors']
                        home_team = next(c['team'].get('displayName', c['team'].get('name')) for c in competitors if c['homeAway'] == 'home')
                        away_team = next(c['team'].get('displayName', c['team'].get('name')) for c in competitors if c['homeAway'] == 'away')
                        
                        # Aynı maçı tekrar ekleme
                        if any(m['home'] == home_team and m['away'] == away_team for m in matches):
                            continue

                        h_xg = round(random.uniform(1.2, 2.3), 2)
                        a_xg = round(random.uniform(0.8, 1.7), 2)

                        sim = self.monte_carlo_simulation(h_xg, a_xg)
                        pred = "2.5 ÜST" if sim["p_over25"] >= 52.0 else "2.5 ALT"

                        matches.append({
                            "home": home_team,
                            "away": away_team,
                            "over25_prob": sim["p_over25"],
                            "under25_prob": sim["p_under25"],
                            "exact_score": sim["exact_score"],
                            "backup_score": sim["backup_score"],
                            "prediction": pred
                        })
            except Exception:
                pass

        return matches

engine = BotUzmanEngine()

class APIHandler(BaseHTTPRequestHandler):
    def do_GET(self):
        self.send_response(200)
        self.send_header('Content-type', 'application/json; charset=utf-8')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.end_headers()
        
        data = {
            "status": "success",
            "matches": engine.fetch_live_fixtures()
        }
        self.wfile.write(json.dumps(data, ensure_ascii=False).encode('utf-8'))

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 10000))
    server = HTTPServer(('0.0.0.0', port), APIHandler)
    print(f"BilyonVIP Canlı Bülten Sunucusu {port} portunda çalışıyor...")
    server.serve_forever()
