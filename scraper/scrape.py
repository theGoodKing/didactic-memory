import csv
import json
import os
from collections.abc import Callable
from datetime import datetime
from pathlib import Path
from urllib.parse import urlencode
from urllib.request import Request, urlopen

from .config import ROOT, Points, Week

API_URL = "https://www.geoguessr.com/api/v3/results/highscores/{challenge_id}"
PAGE_SIZE = 50
TOKEN_ENV = "GEOGUESSR_SESSION_TOKEN"


def read_token() -> str:
    token = os.environ.get(TOKEN_ENV, "").strip()
    if not token:
        raise SystemExit(f"Environment variable {TOKEN_ENV} is not set")
    return token.removeprefix("_ncfa=")


def fetch_highscores(challenge_id: str, token: str, min_rounds: int) -> list[dict]:
    params: dict[str, str | int] = {"friends": "false", "limit": PAGE_SIZE, "minRounds": min_rounds}
    headers = {
        "Cookie": f"_ncfa={token}",
        "Accept": "application/json",
        "User-Agent": "Mozilla/5.0 (geoguessr-f1-league)",
    }
    items: list[dict] = []
    seen_pages: set[str] = set()
    while True:
        url = f"{API_URL.format(challenge_id=challenge_id)}?{urlencode(params)}"
        with urlopen(Request(url, headers=headers), timeout=30) as res:
            data = json.load(res)
        page = data.get("items") or []
        items.extend(page)
        next_page = data.get("paginationToken")
        if not page or not next_page or next_page in seen_pages:
            return items
        seen_pages.add(next_page)
        params["paginationToken"] = next_page


def to_rows(items: list[dict], perfect_round_score: int) -> tuple[list[str], list[dict]]:
    players = [item["game"]["player"] for item in items if item.get("game", {}).get("player")]
    num_rounds = max((len(p.get("guesses", [])) for p in players), default=0)

    rows = []
    for player in players:
        guesses = player.get("guesses", [])
        round_scores = [_round_score(g) for g in guesses]
        distances = [_num(g.get("distanceInMeters")) for g in guesses]
        times = [_num(g.get("time")) for g in guesses]
        steps = [_num(g.get("stepsCount")) for g in guesses]

        row = {
            "Player Id": player.get("id", ""),
            "Player Name": player.get("nick") or player.get("name") or "Unknown",
            "Total Score": _num(player.get("totalScore", {}).get("amount")),
            "Total Time": sum(times),
            "Total Distance": sum(distances),
            "Total Steps": sum(steps),
            "5000s": sum(1 for s in round_scores if s == perfect_round_score),
            "Timeouts": sum(1 for g in guesses if g.get("timedOut")),
            "Zero Meter Guesses": sum(1 for d in distances if d == 0),
            "Rounds": len(guesses),
        }
        for label, values in (("Score", round_scores), ("Distance", distances), ("Time", times), ("Steps", steps)):
            for i in range(num_rounds):
                row[f"Round {i + 1} {label}"] = values[i] if i < len(values) else ""
        rows.append(row)

    fields = list(rows[0].keys()) if rows else ["Player Id", "Player Name", "Total Score", "Total Time", "5000s"]
    return fields, rows


def write_csv(path: Path, fields: list[str], rows: list[dict]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(".csv.tmp")
    with tmp.open("w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fields)
        writer.writeheader()
        writer.writerows(rows)
    tmp.replace(path)


def scrape(weeks: list[Week], points: Points, clock: Callable[[], datetime]) -> int:
    """Scrape active weeks; returns the number of failed challenges."""
    now = clock()
    active = [w for w in weeks if w.status(now) == "active"]
    if not active:
        print(f"No active week at {now:%Y-%m-%d %H:%M %Z}; nothing to scrape.")
        return 0

    token = read_token()
    failures = 0
    for week in active:
        for kind, challenge_id in week.challenges.items():
            path = week.csv_path(kind)
            print(f"Week {week.week} {week.name} [{kind}] {challenge_id}")
            try:
                items = fetch_highscores(challenge_id, token, points.min_rounds)
            except Exception as e:
                print(f"  ERROR fetching {challenge_id}: {e}")
                failures += 1
                continue
            # The fetch may straddle the cutoff; never write once it has passed.
            if clock() >= week.cutoff:
                print("  Cutoff passed during fetch; leaving stored data frozen.")
                continue
            fields, rows = to_rows(items, points.perfect_round_score)
            write_csv(path, fields, rows)
            print(f"  {len(rows)} players -> {path.relative_to(ROOT)}")
    return failures


def _round_score(guess: dict) -> int:
    if "roundScoreInPoints" in guess:
        return _num(guess["roundScoreInPoints"])
    return _num(guess.get("roundScore", {}).get("amount"))


def _num(value) -> int:
    try:
        return int(float(value))
    except (TypeError, ValueError):
        return 0
