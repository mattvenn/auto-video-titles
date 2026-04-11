# Motion Graphics – Remotion Pipeline

Animated lower-third title cards for Zero to ASIC Course videos, rendered as transparent PNG sequences and inserted into DaVinci Resolve.

## Requirements

- Node.js + npm
- Python 3.11+ (or `pip install tomli` for older Python)
- DaVinci Resolve (for timeline insertion)
- `make`

Install Node dependencies once:

```
npm install
```

## Workflow

### 1. Edit card definitions

Open `titles.toml` and set `line1`, `line2`, `timecode`, and `duration_s` for each card. The timecode is the SRT-style timestamp (`HH:MM:SS.mmm`) where the card should appear on the timeline.

### 2. Preview in Remotion Studio

```
make studio
```

Opens the Remotion Studio with hot-reload. Select `LowerThirdVFD` from the composition list.

### 3. Render cards

Render all enabled cards:

```
python render_titles.py
```

Render a single card by id:

```
python render_titles.py --card drc
```

Each card renders to `out/titles/<card-id>/element-NNN.png` — a transparent PNG sequence.

### 4. Insert into DaVinci Resolve

Resolve must be running with a timeline open.

**First run** — renders (if needed), imports into the `remotion` media pool bin, and places on a new track:

```
python render_titles.py --resolve
```

**Re-use existing renders** — skips rendering, imports and places:

```
python render_titles.py --no-render --resolve
```

**Re-place from bin** — clips already imported; just add a new track and place them:

```
python render_titles.py --place-only
```

All three modes add a new video track named `remotion` and place clips at their configured timecodes. `recordFrame` is absolute (from `00:00:00:00`), so clips land at the correct position regardless of timeline start timecode.

## File layout

```
titles.toml          — card definitions and config
render_titles.py     — render + Resolve insertion script
render_frames.mjs    — Remotion Node API: renders PNG frames for one composition
Makefile             — studio / render-all / render-card targets
src/
  index.ts           — Remotion entry point
  Root.tsx           — composition registry
  compositions/
    LowerThirdVFD.tsx — the animated lower-third component
    TitleCard.tsx
    MyComp.tsx
out/titles/          — rendered PNG sequences (git-ignored)
```

## Resolve scripting setup

The DaVinci Resolve scripting module must be on `PYTHONPATH`:

- **macOS**: `/Library/Application Support/Blackmagic Design/DaVinci Resolve/Developer/Scripting/Modules`
- **Windows**: `C:\ProgramData\Blackmagic Design\DaVinci Resolve\Support\Developer\Scripting\Modules`

Or set the `RESOLVE_SCRIPT_API` / `RESOLVE_SCRIPT_LIB` environment variables as described in the Resolve scripting documentation.

## Transparency

Cards are rendered as RGBA PNG sequences. Resolve on Apple Silicon cannot read alpha from any video format (ProRes 4444, VP9, QTRLE all fail), so PNG sequences are the only working approach. Import all frames from a directory and Resolve auto-groups them into a single sequence clip.
