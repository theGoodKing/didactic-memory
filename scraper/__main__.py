import argparse
import sys
from datetime import datetime

from .build import build, write_site_data
from .config import ConfigError, load_points, load_schedule
from .scrape import scrape


def main() -> int:
    parser = argparse.ArgumentParser(prog="python3 -m scraper", description="GeoGuessr F1 league scraper")
    parser.add_argument("--no-scrape", action="store_true", help="only rebuild docs/data.json from stored CSVs")
    parser.add_argument("--now", help="pretend the current time is this ISO datetime (league timezone if no offset)")
    args = parser.parse_args()

    try:
        points = load_points()
        weeks = load_schedule(points.timezone)
    except ConfigError as e:
        print(f"Config error: {e}", file=sys.stderr)
        return 2

    if args.now:
        fixed = datetime.fromisoformat(args.now)
        fixed = fixed.replace(tzinfo=points.timezone) if fixed.tzinfo is None else fixed.astimezone(points.timezone)
        clock = lambda: fixed
    else:
        clock = lambda: datetime.now(points.timezone)

    failures = 0 if args.no_scrape else scrape(weeks, points, clock)
    write_site_data(build(weeks, points, clock()), clock())

    if failures:
        print(f"{failures} challenge(s) failed to scrape.", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
