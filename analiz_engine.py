import os
import math
import random
import json
import ssl
import urllib.request
from datetime import datetime
from http.server import HTTPServer, BaseHTTPRequestHandler

class MonteCarloEngine:
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

    def run_simulation(self, home_xg, away_xg):
        score_counts = {}
        over_25 = 0
        home_wins = 0
        draws = 0
        away_wins = 0

        for _ in range(self.simulations):
            h_g = self._poisson_sample(home_xg)
            a_g = self._poisson_sample(away_xg)
            
            score = f"{h_g} - {a_g}"
            score_counts[score] = score_counts.get(score, 0) + 1

            if (h_g + a_g) > 2.5:
                over_25 += 1
            if h_g > a_g:
                home_wins += 1
            elif h_g == a_g:
                draws += 1
            else:
                away_wins += 1

        sorted_scores = sorted(score_counts.items(), key=lambda x: x[1], reverse=True)
        top1 = sorted_scores[0][0] if sorted_scores else "1 - 0"
        top2 = sorted_scores[1][0] if len(sorted_scores) > 1 else "1 - 1"

        p_over = round((over_25 / self.simulations) * 100, 1)
        p_home = round((home_wins / self.simulations) * 100, 1)
        p_draw = round((draws / self.simulations) * 100, 1)
        p_away = round((away_wins / self.simulations) * 100, 1)

        return {
            "p_over25": p_over,
            "p_under25": round(100 - p_over, 1),
            "p_home": p_home,
            "p_draw": p_draw,
            "p_away": p_away,
            "exact_score": top1,
            "backup_score": top2,
            "prediction_25": "2.5 ÜST" if p_over >= 52.0 else "2.5 ALT",
            "prediction_1x2": "1" if p_home >= max(p_draw, p_away) else ("X" if p_draw >= p_away else "2")
        }

    def fetch_live_fixtures(self):
        matches = []
        ssl_ctx = ssl._create_unverified_context()
        today_str = datetime.now().strftime("%Y%m%d")
        
        # Günlük tüm ligleri ve maçları çeken 1000 limitli endpoint
        urls = [
            f"https://site.api.espn.com/apis/site/v2/sports/soccer/all/scoreboard?dates={today_str}&limit=1000",
            "https://site.api.espn.com/apis/site/v2/sports/soccer/tur.1/scoreboard",
            "https://site.api.espn.com/apis/site/v2/sports/soccer/eng.1/scoreboard",
            "https://site.api.espn.com/apis/site/v2/sports/soccer/esp.1/scoreboard",
            "https://site.api.espn.com/apis/site/v2/sports/soccer/ita.1/scoreboard",
            "https://site.api.espn.com/apis/site/v2/sports/soccer/ger.1/scoreboard"
        ]
        headers = {'User-Agent': 'Mozilla/5.0'}

        for url in urls:
            try:
                req = urllib.request.Request(url, headers=headers)
                with urllib.request.urlopen(req, timeout=5, context=ssl_ctx) as resp:
                    data = json.loads(resp.read().decode('utf-8'))
                    for event in data.get('events', []):
                        comp = event['competitions'][0]['competitors']
                        home_t = next((c['team'].get('displayName', c['team'].get('name')) for c in comp if c['homeAway'] == 'home'), None)
                        away_t = next((c['team'].get('displayName', c['team'].get('name')) for c in comp if c['homeAway'] == 'away'), None)

                        if not home_t or not away_t:
                            continue

                        # Çift kayıt oluşmasını engelle
                        if any(m['home'] == home_t and m['away'] == away_t for m in matches):
                            continue

                        h_xg = round(random.uniform(1.10, 2.45), 2)
                        a_xg = round(random.uniform(0.75, 1.95), 2)
                        sim = self.run_simulation(h_xg, a_xg)

                        matches.append({
                            "home": home_t,
                            "away": away_t,
                            "h_xg": h_xg,
                            "a_xg": a_xg,
                            **sim
                        })
            except Exception:
                pass

        return matches

engine = MonteCarloEngine()

class APIHandler(BaseHTTPRequestHandler):
    def do_GET(self):
        self.send_response(200)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Cache-Control', 'no-cache, no-store, must-revalidate')
        self.end_headers()

        matches = engine.fetch_live_fixtures()
        response = {
            "status": "success",
            "count": len(matches),
            "matches": matches
        }
        self.wfile.write(json.dumps(response, ensure_ascii=False).encode('utf-8'))

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 10000))
    server = HTTPServer(('0.0.0.0', port), APIHandler)
    server.serve_forever()
