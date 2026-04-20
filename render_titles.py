#!/usr/bin/env python3
"""
render_titles.py  —  Render VFD lower-third cards and optionally insert into DaVinci Resolve.

Usage:
    python render_titles.py                                   # render all enabled cards
    python render_titles.py --card drc                        # render one card by id
    python render_titles.py --composition TTTopicCard         # render only TTTopicCard cards across all parts
    python render_titles.py --all-configs                     # run across all part*.toml files
    python render_titles.py --resolve                         # render + insert into current Resolve timeline
    python render_titles.py --resolve --card drc
    python render_titles.py --place                           # place clips already in the 'remotion' bin

Requirements:
    Python 3.11+  (uses built-in tomllib)
    — or —
    pip install tomli          # for Python < 3.11

DaVinci Resolve scripting:
    Resolve must be running. The scripting module path varies by OS:
      Linux:   /opt/resolve/Developer/Scripting/Modules
      macOS:   /Library/Application Support/Blackmagic Design/DaVinci Resolve/Developer/Scripting/Modules
      Windows: C:\\ProgramData\\Blackmagic Design\\DaVinci Resolve\\Support\\Developer\\Scripting\\Modules
    Add that path to PYTHONPATH, or set RESOLVE_SCRIPT_API / RESOLVE_SCRIPT_LIB env vars.
"""

import argparse
import json
import os
import subprocess
import sys
import tempfile
from pathlib import Path

# ── TOML import (stdlib in 3.11+, else fall back to tomli) ───────────────────
try:
    import tomllib
except ImportError:
    try:
        import tomli as tomllib  # type: ignore[no-redef]
    except ImportError:
        print("ERROR: install tomli for Python < 3.11:  pip install tomli")
        sys.exit(1)


# ── Helpers ───────────────────────────────────────────────────────────────────

def timecode_to_frames(tc: str, fps: int) -> int:
    """Convert a timecode string to an integer frame number.

    Accepts two formats:
      HH:MM:SS.mmm  — SRT-style milliseconds (3 decimal digits)
      HH:MM:SS.FF   — frame-number suffix    (1–2 decimal digits)
    """
    tc = tc.replace(",", ".")          # accept SRT comma format too
    h, m, rest = tc.split(":", 2)
    whole_seconds = int(h) * 3600 + int(m) * 60
    if "." in rest:
        s, sub = rest.split(".", 1)
        whole_seconds += int(s)
        if len(sub) <= 2:
            # e.g. .06 → frame 6
            return whole_seconds * fps + int(sub)
        else:
            # e.g. .232 → 232 ms
            ms = int(sub.ljust(3, "0")[:3])
            return round((whole_seconds * 1000 + ms) * fps / 1000)
    else:
        whole_seconds += int(rest)
        return whole_seconds * fps


_METADATA_KEYS = {"id", "composition", "timecode", "section", "enabled"}

# Map TOML field names to the prop names each composition actually expects.
_COMP_FIELD_MAP: dict[str, dict[str, str]] = {
    "Z2ATitleBar":   {"title": "line1", "extra_text": "line2"},
    "Z2ATitleBarV2": {"title": "line1", "extra_text": "line2"},
    "Z2ACallToAction": {"extra_text": "line2"},
}

def _snake_to_camel(s: str) -> str:
    parts = s.split("_")
    return parts[0] + "".join(p.capitalize() for p in parts[1:])


def render_card(card: dict, config: dict, out_dir: Path) -> Path:
    """Delegate rendering to the Makefile render-card target. Returns the output path."""
    card_id  = card["id"]
    out_path = out_dir / card_id   # directory of PNG frames

    section = card.get("section", "")
    label   = f"[{section}] " if section else ""
    preview = " / ".join(card[k] for k in ("header", "extra_text", "line1", "title", "line2") if k in card)
    print(f"  → {label}{card_id}  |  {preview}")

    composition = card.get("composition", config["composition"])

    # Legacy explicit mappings (kept for backward compat with older compositions)
    props: dict = {}
    if "hold_frames" in card:
        props["holdEnd"] = card["hold_frames"]

    # Generic pass-through: all non-metadata keys, snake_case → camelCase.
    # Applies per-composition field renames before camelCase conversion.
    # Card values take precedence over config defaults; neither overwrites explicit mappings above.
    field_map = _COMP_FIELD_MAP.get(composition, {})
    sources = [config.get("defaults", {}), card]   # card wins over defaults
    for source in sources:
        for key, val in source.items():
            if key in _METADATA_KEYS:
                continue
            mapped_key = field_map.get(key, key)
            camel = _snake_to_camel(mapped_key)
            if camel not in props:
                props[camel] = val

    # Write props to a temp file so make doesn't have to deal with JSON quoting
    with tempfile.NamedTemporaryFile(mode="w", suffix=".json", delete=False) as f:
        json.dump(props, f)
        props_file = f.name

    try:
        result = subprocess.run(
            ["make", "render-card", f"OUT={out_path}", f"PROPS_FILE={props_file}", f"COMPOSITION={composition}"],
            capture_output=False,
        )
    finally:
        os.unlink(props_file)

    if result.returncode != 0:
        print(f"  ERROR: render failed for '{card_id}' (exit {result.returncode})")
        sys.exit(1)

    return out_path


# ── DaVinci Resolve integration ───────────────────────────────────────────────

def get_resolve():
    """Return the Resolve scripting object, or exit with a clear message."""
    resolve_module_paths = [
        "/opt/resolve/Developer/Scripting/Modules",
        "/Library/Application Support/Blackmagic Design/DaVinci Resolve/Developer/Scripting/Modules",
        r"C:\ProgramData\Blackmagic Design\DaVinci Resolve\Support\Developer\Scripting\Modules",
    ]
    for p in resolve_module_paths:
        if p not in sys.path and Path(p).exists():
            sys.path.insert(0, p)

    try:
        import DaVinciResolveScript as dvr  # type: ignore[import]
    except ModuleNotFoundError:
        print(
            "ERROR: DaVinciResolveScript not found.\n"
            "  • DaVinci Resolve must be running.\n"
            "  • Add the Resolve scripting Modules dir to PYTHONPATH.\n"
            "  • See the top-of-file docstring for paths."
        )
        sys.exit(1)

    resolve = dvr.scriptapp("Resolve")
    if resolve is None:
        print("ERROR: Could not connect to DaVinci Resolve. Is it running?")
        sys.exit(1)
    return resolve


def _find_or_create_bin(media_pool, parent, name):
    """Return the named sub-bin under parent, creating it if absent."""
    existing = next((f for f in parent.GetSubFolderList() if f.GetName() == name), None)
    return existing if existing is not None else media_pool.AddSubFolder(parent, name)


def insert_into_resolve(cards: list[dict], config: dict, out_dir: Path):
    """Import rendered PNG sequences into a 'remotion/<part>' bin and insert into the active timeline."""
    part_name = Path(config["output_dir"]).name   # e.g. "part1"

    resolve    = get_resolve()
    project    = resolve.GetProjectManager().GetCurrentProject()
    media_pool = project.GetMediaPool()
    timeline   = project.GetCurrentTimeline()

    if timeline is None:
        print("ERROR: No timeline is currently open in DaVinci Resolve.")
        sys.exit(1)

    # ── Create / find remotion/<part> bin ────────────────────────────────────
    root         = media_pool.GetRootFolder()
    remotion_bin = _find_or_create_bin(media_pool, root, "remotion")
    part_bin     = _find_or_create_bin(media_pool, remotion_bin, part_name)
    media_pool.SetCurrentFolder(part_bin)
    print(f"\nUsing media pool bin: 'remotion/{part_name}'")

    # ── Import PNG sequences into that bin ───────────────────────────────────
    paths = []
    for card in cards:
        out_path = out_dir / card["id"]   # directory of PNG frames
        if not out_path.is_dir() or not any(out_path.glob("*.png")):
            print(f"  SKIP {card['id']} — frames dir not found: {out_path}")
        else:
            paths.append((card, out_path))

    media_items: dict[str, object] = {}
    frame_counts: dict[str, int] = {}
    for card, out_path in paths:
        png_files = sorted(out_path.glob("*.png"))
        items = media_pool.ImportMedia([str(f.resolve()) for f in png_files])
        if items:
            frame_counts[card["id"]] = len(png_files)
            print(f"  imported  {card['id']}  → {len(items)} item(s) from {len(png_files)} frames")
            media_items[card["id"]] = items[0]
        else:
            print(f"  ERROR: could not import {out_path}")

    # ── Add a new video track named 'remotion' ────────────────────────────────
    timeline.AddTrack("video")
    track_index = timeline.GetTrackCount("video")
    timeline.SetTrackName("video", track_index, "remotion")
    print(f"  Added video track V{track_index} named 'remotion'")

    timeline_fps = round(float(project.GetSetting("timelineFrameRate")))
    print(f"\nTimeline '{timeline.GetName()}'  fps={timeline_fps}  target track=V{track_index}")

    # ── Build all clip infos and insert in ONE call ───────────────────────────
    clip_infos: list[dict] = []
    for card, _ in paths:
        mpi = media_items.get(card["id"])
        if mpi is None:
            continue

        record_frame    = timecode_to_frames(card["timecode"], timeline_fps)
        duration_frames = frame_counts[card["id"]]

        print(f"  {card['id']:<16}  {card['timecode']}  →  recordFrame {record_frame}  dur={duration_frames}f")

        clip_infos.append({
            "mediaPoolItem": mpi,
            "startFrame":    0,
            "endFrame":      duration_frames - 1,
            "trackIndex":    track_index,
            "recordFrame":   record_frame,
        })

    if clip_infos:
        ok = media_pool.AppendToTimeline(clip_infos)
        print(f"\n{'OK' if ok else 'FAILED'} — {len(clip_infos)} clip(s) inserted into '{timeline.GetName()}'")


def place_from_bin(cards: list[dict], config: dict):
    """Place clips already in the 'remotion/<part>' media pool bin onto the active timeline."""
    part_name = Path(config["output_dir"]).name   # e.g. "part1"

    resolve    = get_resolve()
    project    = resolve.GetProjectManager().GetCurrentProject()
    media_pool = project.GetMediaPool()
    timeline   = project.GetCurrentTimeline()

    if timeline is None:
        print("ERROR: No timeline is currently open.")
        sys.exit(1)

    # Find remotion/<part> bin
    root = media_pool.GetRootFolder()
    remotion_bin = next((f for f in root.GetSubFolderList() if f.GetName() == "remotion"), None)
    if remotion_bin is None:
        print("ERROR: No 'remotion' bin found in media pool. Run --resolve first.")
        sys.exit(1)
    part_bin = next((f for f in remotion_bin.GetSubFolderList() if f.GetName() == part_name), None)
    if part_bin is None:
        print(f"ERROR: No 'remotion/{part_name}' bin found. Run --resolve first.")
        sys.exit(1)

    # Index clips in the part bin by card id
    all_clips = part_bin.GetClipList()
    bin_clips: dict[str, object] = {}
    for item in all_clips:
        clip_path = item.GetClipProperty("File Path") or ""
        parent = Path(clip_path).parent.name if clip_path else item.GetName().rsplit(".", 1)[0]
        bin_clips[parent] = item
    print(f"Found {len(bin_clips)} clip(s) in 'remotion/{part_name}': {list(bin_clips.keys())}")

    # Add a new video track named 'remotion'
    project.SetCurrentTimeline(timeline)
    timeline.AddTrack("video")
    track_index = timeline.GetTrackCount("video")
    timeline.SetTrackName("video", track_index, "remotion")

    timeline_fps = round(float(project.GetSetting("timelineFrameRate")))
    print(f"Timeline '{timeline.GetName()}'  fps={timeline_fps}  target=V{track_index}")

    out_dir = Path(config["output_dir"])

    clip_infos: list[dict] = []
    for card in cards:
        mpi = bin_clips.get(card["id"])
        if mpi is None:
            print(f"  SKIP {card['id']} — not found in bin")
            continue

        png_files = sorted((out_dir / card["id"]).glob("*.png"))
        if not png_files:
            print(f"  SKIP {card['id']} — no PNG frames found in {out_dir / card['id']}")
            continue

        record_frame    = timecode_to_frames(card["timecode"], timeline_fps)
        duration_frames = len(png_files)

        print(f"  {card['id']:<16}  {card['timecode']}  →  recordFrame {record_frame}  dur={duration_frames}f")
        clip_infos.append({
            "mediaPoolItem": mpi,
            "startFrame":    0,
            "endFrame":      duration_frames - 1,
            "trackIndex":    track_index,
            "recordFrame":   record_frame,
        })

    if not clip_infos:
        print("No clips to insert.")
        return

    clip_infos.sort(key=lambda c: c["recordFrame"])
    media_pool.SetCurrentFolder(part_bin)

    ok = media_pool.AppendToTimeline(clip_infos)
    print(f"AppendToTimeline: {'OK' if ok else 'FAILED'} — {len(clip_infos)} clip(s)")


# ── Main ──────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description="Render VFD title cards via Remotion")
    parser.add_argument("--config",      default="part1.toml", help="Path to the titles TOML file (e.g. part1.toml, part2.toml)")
    parser.add_argument("--all-configs", action="store_true",   help="Run across all part*.toml files in the current directory")
    parser.add_argument("--card",        default=None,          help="Render only this card id")
    parser.add_argument("--composition", default=None,          help="Render only cards that use this composition (e.g. TTTopicCard)")
    parser.add_argument("--resolve",     action="store_true",   help="Import clips into Resolve media pool and insert into timeline")
    parser.add_argument("--place",       action="store_true",   help="Place clips already in the 'remotion' bin onto the active timeline")
    parser.add_argument("--no-render",   action="store_true",   help="Skip rendering; use existing files in output_dir")
    args = parser.parse_args()

    if args.all_configs:
        configs = sorted(Path(".").glob("part*.toml"))
        if not configs:
            print("ERROR: no part*.toml files found in current directory")
            sys.exit(1)
        print(f"Running across {len(configs)} config(s): {[str(c) for c in configs]}\n")
        for cfg in configs:
            print(f"{'─' * 60}")
            print(f"Config: {cfg}")
            print(f"{'─' * 60}")
            # Re-invoke with this config, forwarding all other flags
            extra = []
            if args.composition: extra += ["--composition", args.composition]
            if args.card:        extra += ["--card", args.card]
            if args.resolve:     extra.append("--resolve")
            if args.place:       extra.append("--place")
            if args.no_render:   extra.append("--no-render")
            result = subprocess.run([sys.executable, __file__, "--config", str(cfg)] + extra)
            if result.returncode != 0:
                sys.exit(result.returncode)
        return

    config_path = Path(args.config)
    if not config_path.exists():
        print(f"ERROR: config file not found: {config_path}")
        sys.exit(1)

    with open(config_path, "rb") as f:
        data = tomllib.load(f)

    config = data["config"]
    all_cards: list[dict] = data.get("cards", [])

    # Filter: enabled + optional single-card / composition selection
    cards = [c for c in all_cards if c.get("enabled", True)]
    if args.card:
        cards = [c for c in cards if c["id"] == args.card]
        if not cards:
            ids = [c["id"] for c in all_cards]
            print(f"ERROR: card '{args.card}' not found. Available: {ids}")
            sys.exit(1)
    if args.composition:
        cards = [c for c in cards if c.get("composition", config["composition"]) == args.composition]
        if not cards:
            print(f"ERROR: no enabled cards found with composition '{args.composition}'")
            sys.exit(1)

    out_dir = Path(config["output_dir"])
    out_dir.mkdir(parents=True, exist_ok=True)

    if args.no_render:
        print(f"\nSkipping render — using existing files in {out_dir}/\n")
    else:
        print(f"\nRendering {len(cards)} card(s) → {out_dir}/\n")
        for card in cards:
            render_card(card, config, out_dir)
        print(f"\nDone. {len(cards)} clip(s) in {out_dir}/")

    if args.place:
        place_from_bin(cards, config)
    elif args.resolve:
        insert_into_resolve(cards, config, out_dir)


if __name__ == "__main__":
    main()
