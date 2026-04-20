#!/usr/bin/env python3
"""Convert a DaVinci Resolve EDL (markers) to a cards TOML file."""

import re
import sys
from pathlib import Path


def frames_to_ms(ff: int, fps: int = 30) -> int:
    return round(ff * 1000 / fps)


def timecode_to_toml(tc: str, fps: int = 30) -> str:
    """Convert HH:MM:SS:FF to HH:MM:SS.mmm"""
    h, m, s, f = map(int, tc.split(":"))
    ms = frames_to_ms(f, fps)
    return f"{h:02d}:{m:02d}:{s:02d}.{ms:03d}"


def slugify(name: str) -> str:
    s = name.lower().strip()
    s = re.sub(r"[^a-z0-9]+", "_", s)
    return s.strip("_")


def parse_edl(path: Path):
    text = path.read_text()
    title_match = re.search(r"TITLE:\s*(.+)", text)
    title = title_match.group(1).strip() if title_match else path.stem

    # Each event block: event number, then a timecode line, then a marker comment line
    # Pattern: event line with source IN timecode, then |M:<marker> comment
    events = []
    event_blocks = re.findall(
        r"(\d{3})\s+\S+\s+V\s+C\s+(\S+)\s+\S+\s+\S+\s+\S+\s*\n"
        r"\s*\|C:\S+\s+\|M:(.+?)\s+\|D:\d+",
        text,
    )
    for _num, tc_in, marker in event_blocks:
        events.append({"timecode": timecode_to_toml(tc_in), "marker": marker.strip()})

    return title, events


def render_toml(edl_title: str, events: list, output_stem: str) -> str:
    lines = [
        f"# {edl_title}",
        f"",
        f"[config]",
        f'output_dir      = "out/{output_stem}"',
        f'composition     = "TTLowerThird"',
        f'timeline_offset = "00:00:00.000"',
        f"",
    ]

    for ev in events:
        slug = slugify(ev["marker"])
        marker = ev["marker"]
        tc = ev["timecode"]
        lines += [
            f"[[cards]]",
            f'id          = "{slug}"',
            f'composition = "TTLowerThird"',
            f'title       = "{marker}"',
            f'extra_text  = ""',
            f'timecode    = "{tc}"',
            f"",
        ]

    return "\n".join(lines)


def main():
    edl_path = Path(sys.argv[1]) if len(sys.argv) > 1 else Path("fib edit.edl")
    output_stem = sys.argv[2] if len(sys.argv) > 2 else edl_path.stem.replace(" ", "_")
    out_path = Path(f"{output_stem}.toml")

    title, events = parse_edl(edl_path)
    print(f"Parsed {len(events)} markers from '{edl_path}'")

    toml_text = render_toml(title, events, output_stem)
    out_path.write_text(toml_text)
    print(f"Written → {out_path}")


if __name__ == "__main__":
    main()
