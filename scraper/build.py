import csv
import json
from datetime import datetime
from pathlib import Path

from .config import RAW_DIR, ROOT, SITE_DATA, Points, Week


def read_results(path: Path) -> list[dict]:
    with path.open(newline="", encoding="utf-8") as f:
        return [
            {
                "id": row["Player Id"],
                "name": row["Player Name"],
                "score": int(row["Total Score"]),
                "time": int(row["Total Time"]),
                "perfects": int(row["5000s"]),
            }
            for row in csv.DictReader(f)
        ]


def score_challenge(results: list[dict], positions: list[int], bonus_per_perfect: int) -> list[dict]:
    ordered = sorted(results, key=lambda r: (-r["score"], r["time"]))
    return [
        {
            **r,
            "position": i + 1,
            "points": positions[i] if i < len(positions) else 0,
            "bonus": r["perfects"] * bonus_per_perfect,
        }
        for i, r in enumerate(ordered)
    ]


def build_week(week: Week, points: Points, now: datetime) -> tuple[dict, dict[str, dict]]:
    scored: dict[str, list[dict]] = {}
    for kind in week.challenges:
        path = week.csv_path(kind)
        if path.exists():
            scored[kind] = score_challenge(
                read_results(path), points.positions[kind], points.bonus_per_perfect_round
            )

    players: dict[str, dict] = {}
    for kind, results in scored.items():
        for r in results:
            p = players.setdefault(r["id"], {"id": r["id"], "name": r["name"]})
            p[kind] = {"position": r["position"], "points": r["points"], "bonus": r["bonus"], "score": r["score"]}

    rows = []
    for p in players.values():
        sprint, gp = p.get("sprint", {}), p.get("gp", {})
        rows.append({
            "name": p["name"],
            "sprintPosition": sprint.get("position"),
            "sprintPoints": sprint.get("points", 0),
            "sprintBonus": sprint.get("bonus", 0),
            "gpPosition": gp.get("position"),
            "gpPoints": gp.get("points", 0),
            "gpBonus": gp.get("bonus", 0),
            "total": sum(sprint.get(k, 0) + gp.get(k, 0) for k in ("points", "bonus")),
        })
    rows.sort(key=lambda r: (-r["total"], -r["gpPoints"], r["name"].lower()))

    week_data = {
        "week": week.week,
        "name": week.name,
        "slug": week.slug,
        "start": week.start.isoformat(),
        "cutoff": week.cutoff.isoformat(),
        "status": week.status(now),
        "challenges": {
            kind: {
                "id": cid,
                "url": f"https://www.geoguessr.com/challenge/{cid}",
                "participants": len(scored.get(kind, [])),
            }
            for kind, cid in week.challenges.items()
        },
        "results": rows,
    }
    return week_data, players


def build(weeks: list[Week], points: Points, now: datetime) -> dict:
    standings: dict[str, dict] = {}
    week_list = []
    for week in weeks:
        week_data, players = build_week(week, points, now)
        week_list.append(week_data)
        for pid, p in players.items():
            s = standings.setdefault(pid, {"name": p["name"], "wins": 0, "podiums": 0, "points": 0})
            s["name"] = p["name"]
            for kind in ("sprint", "gp"):
                result = p.get(kind)
                if result:
                    s["points"] += result["points"] + result["bonus"]
            gp_pos = p.get("gp", {}).get("position")
            if gp_pos == 1:
                s["wins"] += 1
            if gp_pos is not None and gp_pos <= points.podium_positions:
                s["podiums"] += 1

    table = sorted(standings.values(), key=lambda s: (-s["points"], -s["wins"], -s["podiums"], s["name"].lower()))
    _warn_unknown_csvs(weeks)
    return {"timezone": str(points.timezone), "standings": table, "weeks": week_list}


def write_site_data(data: dict, now: datetime, path: Path = SITE_DATA) -> bool:
    """Write data.json; skip if only the timestamp would change. Returns True if written."""
    if path.exists():
        try:
            existing = json.loads(path.read_text(encoding="utf-8"))
            existing.pop("generatedAt", None)
            if existing == data:
                print(f"{path.relative_to(ROOT)} unchanged.")
                return False
        except json.JSONDecodeError:
            pass
    output = {"generatedAt": now.isoformat(timespec="seconds"), **data}
    path.write_text(json.dumps(output, indent=2) + "\n", encoding="utf-8")
    print(f"Wrote {path.relative_to(ROOT)} ({len(data['standings'])} players).")
    return True


def _warn_unknown_csvs(weeks: list[Week]) -> None:
    known = {week.csv_path(kind) for week in weeks for kind in week.challenges}
    for path in RAW_DIR.glob("week*/*.csv"):
        if path not in known:
            print(f"WARNING: {path.relative_to(ROOT)} does not match any configured week; ignored.")
