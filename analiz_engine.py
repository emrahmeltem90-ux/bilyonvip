import os
import time
import math
import random
import json
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

    def generate_bulten(self):
        match_fixtures = [
            ("Galatasaray", "Fenerbahçe", 1.85, 1.40),
            ("Beşiktaş", "Trabzonspor", 1.50, 1.25),
            ("Fethiyespor", "Amedspor", 1.35, 1.10),
            ("Real Madrid", "Barcelona", 2.10, 1.85),
            ("Manchester City", "Arsenal", 1.95, 1.50),
            ("Inter", "Milan", 1.45, 1.30),
            ("Bayern München", "Dortmund", 2.20, 1.65)
        ]
        
        matches = []
        for home, away, h_xg, a_xg in match_fixtures:
            sim = self.monte_carlo_simulation(h_xg, a_xg)
            pred = "2.5 ÜST" if sim["p_over25"] >= 52.0 else "2.5 ALT"
            matches.append({
                "home": home,
                "away": away,
                "over25_prob": sim["p_over25"],
                "under25_prob": sim["p_under25"],
                "exact_score": sim["exact_score"],
                "backup_score": sim["backup_score"],
                "prediction": pred
            })
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
            "matches": engine.generate_bulten()
        }
        self.wfile.write(json.dumps(data, ensure_ascii=False).encode('utf-8'))

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 10000))
    server = HTTPServer(('0.0.0.0', port), APIHandler)
    print(f"BilyonVIP API Sunucusu {port} portunda yayında...")
    server.serve_forever()
