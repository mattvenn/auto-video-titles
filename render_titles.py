#!/usr/bin/env python3
"""
render_titles.py  —  Render VFD lower-third cards and optionally insert into DaVinci Resolve.

Usage:
    python render_titles.py                    # render all enabled cards
    python render_titles.py --card drc         # render one card by id
    python render_titles.py --resolve          # render + insert into current Resolve timeline
    python render_titles.py --resolve --card drc

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
import re
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


def frames_to_resolve_tc(frames: int, fps: int) -> str:
    """Convert a frame number to Resolve-style 'HH:MM:SS:FF' timecode."""
    h  = frames // (fps * 3600); frames %= fps * 3600
    m  = frames // (fps * 60);   frames %= fps * 60
    s  = frames // fps
    f  = frames % fps
    return f"{h:02d}:{m:02d}:{s:02d}:{f:02d}"


def render_card(card: dict, config: dict, out_dir: Path) -> Path:
    """Delegate rendering to the Makefile render-card target. Returns the output path."""
    card_id  = card["id"]
    out_path = out_dir / card_id   # directory of PNG frames

    section = card.get("section", "")
    label   = f"[{section}] " if section else ""
    print(f"  → {label}{card_id}  |  {card['line1']} / {card['line2']}")

    # Write props to a temp file so make doesn't have to deal with JSON quoting
    props = {"line1": card["line1"], "line2": card["line2"]}
    with tempfile.NamedTemporaryFile(mode="w", suffix=".json", delete=False) as f:
        json.dump(props, f)
        props_file = f.name

    try:
        result = subprocess.run(
            ["make", "render-card", f"OUT={out_path}", f"PROPS_FILE={props_file}"],
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
    # Resolve ships its scripting module in a non-standard location.
    # Try the common macOS path; adjust for your OS if needed.
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


def generate_edl(cards: list[dict], config: dict, out_dir: Path) -> Path:
    """
    Write a CMX 3600 EDL file. Import it in Resolve via:
      File > Import Timeline > Import AAF, EDL, XML…
    Resolve will create a new timeline with all clips pre-positioned.
    """
    fps  = config["fps"]
    lines = [
        f"TITLE: VFD Lower Thirds",
        "FCM: NON-DROP FRAME",
        "",
    ]

    for i, card in enumerate(cards, 1):
        clip_name       = f"{card['id']}.mov"
        duration_frames = round(card["duration_s"] * fps)

        # Source in/out — clip starts at 00:00:00:00
        src_in  = frames_to_resolve_tc(0, fps)
        src_out = frames_to_resolve_tc(duration_frames, fps)

        # Record in/out — where the clip sits on the timeline
        rec_in_frames  = timecode_to_frames(card["timecode"], fps)
        rec_out_frames = rec_in_frames + duration_frames
        rec_in  = frames_to_resolve_tc(rec_in_frames,  fps)
        rec_out = frames_to_resolve_tc(rec_out_frames, fps)

        lines += [
            f"{i:03d}  AX       V     C        {src_in} {src_out} {rec_in} {rec_out}",
            f"* FROM CLIP NAME: {clip_name}",
            f"* COMMENT: {card['line1']} / {card['line2']}",
            "",
        ]

    edl_path = out_dir / "lower_thirds.edl"
    edl_path.write_text("\n".join(lines))
    print(f"\nEDL written to {edl_path}")
    print("Import in Resolve: File > Import Timeline > Import AAF, EDL, XML…")
    return edl_path


def insert_into_resolve(cards: list[dict], config: dict, out_dir: Path):
    """Import rendered clips into a 'remotion' bin and insert into the active timeline."""
    fps         = config["fps"]
    track_index = config["video_track"]

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
    for card, out_path in paths:
        png_files = sorted(out_path.glob("*.png"))
        n = len(png_files)
        # Extract numeric indices from filenames (e.g. element-000.png → 0)
        indices = [int(re.search(r'\d+', f.stem).group()) for f in png_files]
        all_paths = [str(f.resolve()) for f in png_files]
        items = media_pool.ImportMedia(all_paths)
        if items:
            # Resolve may group sequential images into one sequence clip
            print(f"  imported  {card['id']}  → {len(items)} item(s) from {n} frames")
            media_items[card["id"]] = items[0]
        else:
            print(f"  ERROR: could not import {out_path}")

    # ── Add a new video track named 'remotion' ────────────────────────────────
    timeline.AddTrack("video")
    track_index = timeline.GetTrackCount("video")
    timeline.SetTrackName("video", track_index, "remotion")
    print(f"  Added video track V{track_index} named 'remotion'")

    # ── Calibrate frame offset from the timeline itself ───────────────────────
    # GetStartFrame() returns the absolute frame number (from 00:00:00:00) that
    # corresponds to the timeline's start timecode.  recordFrame must be relative
    # to this value (i.e. 0 = start of timeline).
    timeline_start = timeline.GetStartFrame()
    timeline_fps   = round(float(project.GetSetting("timelineFrameRate")))  # nominal: 23.976→24, 29.97→30
    print(f"\nTimeline '{timeline.GetName()}'  start_frame={timeline_start}  fps={timeline_fps}  target track=V{track_index}")

    # ── Build all clip infos and insert in ONE call ───────────────────────────
    clip_infos: list[dict] = []
    for card, _ in paths:
        mpi = media_items.get(card["id"])
        if mpi is None:
            continue

        abs_frame    = timecode_to_frames(card["timecode"], timeline_fps)
        record_frame = abs_frame   # absolute frame from 00:00:00:00
        duration_frames = round(card["duration_s"] * fps)

        print(f"  {card['id']:<16}  {card['timecode']}  →  recordFrame {record_frame}")

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
    fps         = config["fps"]
    track_index = config["video_track"]

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

    # Index clips in the bin — PNG sequences appear with their first frame name;
    # match by stripping digits/extension to recover the card id from folder name.
    all_clips = remotion_bin.GetClipList()
    bin_clips: dict[str, object] = {}
    for item in all_clips:
        name = item.GetName()
        # Try exact match (card id) or strip leading zeros from frame filename
        clip_path = item.GetClipProperty("File Path") or ""
        # The card id is the parent directory name of the first frame
        parent = Path(clip_path).parent.name if clip_path else name.rsplit(".", 1)[0]
        bin_clips[parent] = item
    print(f"Found {len(bin_clips)} clip(s) in 'remotion' bin: {list(bin_clips.keys())}")

    # Explicitly set this timeline as current
    ok = project.SetCurrentTimeline(timeline)
    print(f"SetCurrentTimeline: {ok}")

    # Add a new video track named 'remotion'
    ok = timeline.AddTrack("video")
    print(f"AddTrack:           {ok}")
    track_index = timeline.GetTrackCount("video")
    print(f"GetTrackCount:      {track_index}")
    ok = timeline.SetTrackName("video", track_index, "remotion")
    print(f"SetTrackName:       {ok}")

    timeline_start = timeline.GetStartFrame()  # kept for diagnostics only
    timeline_fps   = round(float(project.GetSetting("timelineFrameRate")))  # nominal: 23.976→24, 29.97→30
    print(f"Timeline '{timeline.GetName()}'  start_frame={timeline_start}  fps={timeline_fps}  target=V{track_index}")
    print(f"(recordFrame will use absolute frame numbers — no start_frame subtraction)\n")

    clip_infos: list[dict] = []
    for card in cards:
        mpi = bin_clips.get(card["id"])
        if mpi is None:
            print(f"  SKIP {card['id']} — not found in bin")
            continue

        abs_frame    = timecode_to_frames(card["timecode"], timeline_fps)
        record_frame = abs_frame   # absolute frame from 00:00:00:00
        duration_frames = round(card["duration_s"] * fps)

        print(f"  {card['id']:<16}  {card['timecode']}  →  abs={abs_frame}  rec={record_frame}  dur={duration_frames}f")
        clip_infos.append({
            "mediaPoolItem": mpi,
            "startFrame":    0,
            "endFrame":      duration_frames - 1,
            "mediaType":     1,   # 1=video+audio, 2=video only, 3=audio only
            "trackIndex":    track_index,
            "recordFrame":   record_frame,
        })

    if not clip_infos:
        print("No clips to insert.")
        return

    # Sort by position so Resolve receives clips in timeline order
    clip_infos.sort(key=lambda c: c["recordFrame"])

    # Show first clip's details for verification
    c0 = clip_infos[0]
    print(f"\nFirst clip: trackIndex={c0['trackIndex']}  recordFrame={c0['recordFrame']}  "
          f"startFrame={c0['startFrame']}  endFrame={c0['endFrame']}")

    # Set the bin as current folder before inserting
    media_pool.SetCurrentFolder(remotion_bin)

    ok = media_pool.AppendToTimeline(clip_infos)
    print(f"AppendToTimeline: {'OK' if ok else 'FAILED'} — {len(clip_infos)} clip(s)")

    # Verify clips actually landed on the track
    items_after = timeline.GetItemListInTrack("video", track_index)
    count = len(items_after) if items_after else 0
    print(f"Items now on V{track_index}: {count}")
    if count == 0:
        # Fallback: try inserting without a specific trackIndex so Resolve auto-places
        print("\nFallback: retrying without trackIndex (clips will land on V1)…")
        for ci in clip_infos:
            ci.pop("trackIndex", None)
            ci.pop("recordFrame", None)
        ok2 = media_pool.AppendToTimeline(clip_infos)
        print(f"Fallback AppendToTimeline: {'OK' if ok2 else 'FAILED'}")


# ── Main ──────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description="Render VFD title cards via Remotion")
    parser.add_argument("--config",    default="titles.toml", help="Path to titles.toml")
    parser.add_argument("--card",      default=None,           help="Render only this card id")
    parser.add_argument("--resolve",    action="store_true",    help="Import clips into Resolve media pool and insert into timeline")
    parser.add_argument("--place-only",action="store_true",    help="Place clips already in the 'remotion' bin onto the active timeline")
    parser.add_argument("--edl",        action="store_true",   help="Write EDL file only (no Resolve needed)")
    parser.add_argument("--no-render",  action="store_true",   help="Skip rendering; use existing files in output_dir")
    args = parser.parse_args()

    # Load config
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
    elif args.edl:
        generate_edl(cards, config, out_dir)


if __name__ == "__main__":
    main()
