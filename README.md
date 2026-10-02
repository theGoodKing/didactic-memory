# GeoGuessr Grand Prix

F1-themed GeoGuessr league. Each week has a Sprint and a Grand Prix challenge; results are scraped while the week is open and frozen at the cutoff (Friday 15:00 Europe/London).

Requires Python 3.11+ (standard library only).

## Configuration

- `config/schedule.toml` – weeks: number, name, slug, start/cutoff, challenge codes
- `config/points.toml` – points per position, perfect-round bonus, podium size, timezone

## Running locally

```sh
export GEOGUESSR_SESSION_TOKEN=...   # value of the _ncfa cookie
python3 -m scraper                   # scrape the active week, then rebuild docs/data.json
python3 -m scraper --no-scrape       # rebuild docs/data.json from stored CSVs only
python3 -m scraper --now 2026-10-05T12:00   # pretend it's a different time (testing)
python3 -m http.server -d docs 8000  # view the site at http://localhost:8000
```

## Data

- Raw results (for Excel): `data/raw/week<N>/sprint-<slug>.csv`, `data/raw/week<N>/gp-<slug>.csv`
- Site data: `docs/data.json`

## GitHub Actions

`.github/workflows/update_scores.yml` runs on a schedule and commits any changes. Add the repository secret `GEOGUESSR_SESSION_TOKEN`.
