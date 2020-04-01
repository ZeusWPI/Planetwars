import requests, json, subprocess, os

host = os.getenv("HOST") or "localhost:8000"

headers = {'content-type': 'application/json'}

try:
    r = requests.post(f"https://{host}/lobby", data=open('game_start.json').read(), headers=headers)
    data = r.json()
except Exception:
    r = requests.post(f"http://{host}/lobby", data=open('game_start.json').read(), headers=headers)
    data = r.json()

processes = []

for player in data["players"]:
    processes.append(
        subprocess.Popen(["./run.sh", str(player)])
    )

for p in processes:
    p.wait()
