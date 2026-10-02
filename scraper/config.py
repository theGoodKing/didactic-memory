import re
import tomllib
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from zoneinfo import ZoneInfo

ROOT = Path(__file__).resolve().parent.parent
CONFIG_DIR = ROOT / "config"
RAW_DIR = ROOT / "data" / "raw"
SITE_DATA = ROOT / "docs" / "data.json"

CHALLENGE_KINDS = ("sprint", "gp")

_SLUG_RE = re.compile(r"^[a-z0-9]+(?:-[a-z0-9]+)*$")
_CHALLENGE_RE = re.compile(r"^[A-Za-z0-9]+$")


class ConfigError(Exception):
    pass


@dataclass
class Points:
    timezone: ZoneInfo
    min_rounds: int
    perfect_round_score: int
    bonus_per_perfect_round: int
    podium_positions: int
    positions: dict[str, list[int]]


@dataclass
class Week:
    week: int
    name: str
    slug: str
    start: datetime
    cutoff: datetime
    challenges: dict[str, str]

    def csv_path(self, kind: str) -> Path:
        return RAW_DIR / f"week{self.week}" / f"{kind}-{self.slug}.csv"

    def status(self, now: datetime) -> str:
        if now < self.start:
            return "upcoming"
        if now < self.cutoff:
            return "active"
        return "final"


def load_points(path: Path = CONFIG_DIR / "points.toml") -> Points:
    with path.open("rb") as f:
        raw = tomllib.load(f)
    try:
        positions = {kind: [int(p) for p in raw["positions"][kind]] for kind in CHALLENGE_KINDS}
        return Points(
            timezone=ZoneInfo(raw["timezone"]),
            min_rounds=int(raw["min_rounds"]),
            perfect_round_score=int(raw["perfect_round_score"]),
            bonus_per_perfect_round=int(raw["bonus_per_perfect_round"]),
            podium_positions=int(raw["podium_positions"]),
            positions=positions,
        )
    except KeyError as e:
        raise ConfigError(f"{path.name}: missing key {e}") from e


def load_schedule(tz: ZoneInfo, path: Path = CONFIG_DIR / "schedule.toml") -> list[Week]:
    with path.open("rb") as f:
        raw = tomllib.load(f)

    weeks: list[Week] = []
    for entry in raw.get("weeks", []):
        try:
            challenges = {
                kind: entry[f"{kind}_challenge"]
                for kind in CHALLENGE_KINDS
                if entry.get(f"{kind}_challenge")
            }
            week = Week(
                week=int(entry["week"]),
                name=entry["name"],
                slug=entry["slug"],
                start=_localise(entry["start"], tz),
                cutoff=_localise(entry["cutoff"], tz),
                challenges=challenges,
            )
        except KeyError as e:
            raise ConfigError(f"{path.name}: week entry missing key {e}") from e
        _validate_week(week)
        weeks.append(week)

    weeks.sort(key=lambda w: w.week)
    _validate_schedule(weeks)
    return weeks


def _localise(value, tz: ZoneInfo) -> datetime:
    if not isinstance(value, datetime):
        raise ConfigError(f"Expected a datetime, got {value!r}")
    return value.replace(tzinfo=tz) if value.tzinfo is None else value.astimezone(tz)


def _validate_week(week: Week) -> None:
    label = f"week {week.week} ({week.name})"
    if week.week < 1:
        raise ConfigError(f"{label}: week number must be positive")
    if not _SLUG_RE.match(week.slug):
        raise ConfigError(f"{label}: slug must be lowercase letters, digits and hyphens")
    if week.start >= week.cutoff:
        raise ConfigError(f"{label}: start must be before cutoff")
    if not week.challenges:
        raise ConfigError(f"{label}: needs at least one challenge")
    for kind, challenge_id in week.challenges.items():
        if not _CHALLENGE_RE.match(challenge_id):
            raise ConfigError(f"{label}: invalid {kind} challenge id {challenge_id!r}")


def _validate_schedule(weeks: list[Week]) -> None:
    numbers = [w.week for w in weeks]
    if len(numbers) != len(set(numbers)):
        raise ConfigError("Duplicate week numbers in schedule")
    slugs = [w.slug for w in weeks]
    if len(slugs) != len(set(slugs)):
        raise ConfigError("Duplicate slugs in schedule")
    for prev, nxt in zip(weeks, weeks[1:]):
        if nxt.start < prev.cutoff:
            raise ConfigError(f"Week {nxt.week} starts before week {prev.week} cutoff")
