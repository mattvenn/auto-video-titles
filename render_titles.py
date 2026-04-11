#!/usr/bin/env python3
"""
render_titles.py  —  Render VFD lower-third cards and optionally insert into DaVinci Resolve.

Usage:
    python render_titles.py                    # render all enabled cards
    python render_titles.py --card drc         # render one card by id
    python render_titles.py --resolve          # render + insert into current Resolve timeline
    python render_titles.py --resolve --card drc
    python render_titles.py --place-only       # place clips already in the 'remotion' bin

Requirements:
    Python 3.11+  (uses built-in tomllib)
    — or —
    pip install tomli          # for Python < 3.11

DaVinci Resolve scripting:
    Resolve must be running. The scripting module path varies by OS:
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
    """Convert 'HH:MM:SS.mmm' (SRT-style) to an integer frame number."""
    tc = tc.replace(",", ".")          # accept SRT comma format too
    h, m, rest = tc.split(":", 2)
    if "." in rest:
        s, ms_str = rest.split(".", 1)
        ms = int(ms_str.ljust(3, "0")[:3])
    else:
        s, ms = rest, 0
    total_ms = (int(h) * 3600 + int(m) * 60 + int(s)) * 1000 + ms
    return round(total_ms * fps / 1000)


def render_card(card: dict, config: dict, out_dir: Path) -> Path:
    """Delegate rendering to the Makefile render-card target. Returns the output path."""
    card_id  = card["id"]
    out_path = out_dir / card_id   # directory of PNG frames

    section = card.get("section", "")
    label   = f"[{section}] " if section else ""
    preview = " / ".join(card[k] for k in ("header", "name", "line1", "title", "line2") if k in card)
    print(f"  → {label}{card_id}  |  {preview}")

    composition = card.get("composition", config["composition"])

    # Build props from whichever fields the card defines
    props: dict = {}
    for key in ("name", "title", "header", "line1", "line2"):
        if key in card:
            props[key] = card[key]

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


def insert_into_resolve(cards: list[dict], config: dict, out_dir: Path):
    """Import rendered PNG sequences into a 'remotion' bin and insert into the active timeline."""
    fps = config["fps"]

    resolve    = get_resolve()
    project    = resolve.GetProjectManager().GetCurrentProject()
    media_pool = project.GetMediaPool()
    timeline   = project.GetCurrentTimeline()

    if timeline is None:
        print("ERROR: No timeline is currently open in DaVinci Resolve.")
        sys.exit(1)

    # ── Create / find the 'remotion' bin ─────────────────────────────────────
    root = media_pool.GetRootFolder()
    remotion_bin = next(
        (f for f in root.GetSubFolderList() if f.GetName() == "remotion"),
        None,
    )
    if remotion_bin is None:
        remotion_bin = media_pool.AddSubFolder(root, "remotion")
    media_pool.SetCurrentFolder(remotion_bin)
    print(f"\nUsing media pool bin: 'remotion'")

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
    """Place clips already in the 'remotion' media pool bin onto the active timeline."""
    fps = config["fps"]

    resolve    = get_resolve()
    project    = resolve.GetProjectManager().GetCurrentProject()
    media_pool = project.GetMediaPool()
    timeline   = project.GetCurrentTimeline()

    if timeline is None:
        print("ERROR: No timeline is currently open.")
        sys.exit(1)

    # Find the remotion bin
    root = media_pool.GetRootFolder()
    remotion_bin = next(
        (f for f in root.GetSubFolderList() if f.GetName() == "remotion"),
        None,
    )
    if remotion_bin is None:
        print("ERROR: No 'remotion' bin found in media pool. Run --resolve first.")
        sys.exit(1)

    # Index clips in the bin by card id (parent directory name of the first frame)
    all_clips = remotion_bin.GetClipList()
    bin_clips: dict[str, object] = {}
    for item in all_clips:
        clip_path = item.GetClipProperty("File Path") or ""
        parent = Path(clip_path).parent.name if clip_path else item.GetName().rsplit(".", 1)[0]
        bin_clips[parent] = item
    print(f"Found {len(bin_clips)} clip(s) in 'remotion' bin: {list(bin_clips.keys())}")

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
    media_pool.SetCurrentFolder(remotion_bin)

    ok = media_pool.AppendToTimeline(clip_infos)
    print(f"AppendToTimeline: {'OK' if ok else 'FAILED'} — {len(clip_infos)} clip(s)")


# ── Main ──────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description="Render VFD title cards via Remotion")
    parser.add_argument("--config",     default="part1.toml", help="Path to the titles TOML file (e.g. part1.toml, part2.toml)")
    parser.add_argument("--card",       default=None,          help="Render only this card id")
    parser.add_argument("--resolve",    action="store_true",   help="Import clips into Resolve media pool and insert into timeline")
    parser.add_argument("--place-only", action="store_true",   help="Place clips already in the 'remotion' bin onto the active timeline")
    parser.add_argument("--no-render",  action="store_true",   help="Skip rendering; use existing files in output_dir")
    args = parser.parse_args()

    config_path = Path(args.config)
    if not config_path.exists():
        print(f"ERROR: config file not found: {config_path}")
        sys.exit(1)

    with open(config_path, "rb") as f:
        data = tomllib.load(f)

    config = data["config"]
    all_cards: list[dict] = data.get("cards", [])

    # Filter: enabled + optional single-card selection
    cards = [c for c in all_cards if c.get("enabled", True)]
    if args.card:
        cards = [c for c in cards if c["id"] == args.card]
        if not cards:
            ids = [c["id"] for c in all_cards]
            print(f"ERROR: card '{args.card}' not found. Available: {ids}")
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

    if args.place_only:
        place_from_bin(cards, config)
    elif args.resolve:
        insert_into_resolve(cards, config, out_dir)


if __name__ == "__main__":
    main()
