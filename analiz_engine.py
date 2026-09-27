import os
import time
import math
import random
import threading
from http.server import HTTPServer, BaseHTTPRequestHandler

class BotUzmanEngine:
    def __init__(self, simulations=10000):
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

def background_bot():
    bot = BotUzmanEngine()
    while True:
        res = bot.monte_carlo_simulation(1.1, 1.2)
        print("⚡ [7/24 Bot] Monte Carlo Taraması Yapıldı:", res)
        time.sleep(300)

class HealthCheckHandler(BaseHTTPRequestHandler):
    def do_GET(self):
        self.send_response(200)
        self.send_header('Content-type', 'text/plain; charset=utf-8')
        self.end_headers()
        self.wfile.write(b"BilyonVIP Bot Engine 7/24 Aktif!")

if __name__ == "__main__":
    t = threading.Thread(target=background_bot, daemon=True)
    t.start()

    port = int(os.environ.get("PORT", 10000))
    server = HTTPServer(('0.0.0.0', port), HealthCheckHandler)
    print(f"Sunucu {port} portunda 7/24 aktif...")
    server.serve_forever()
