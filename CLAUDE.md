# Motion Graphics – Remotion Project

Remotion 4.x, React 19, TypeScript strict mode. 1920×1080 @ 30 fps.

## Adding a new animation (always follow these three steps)

1. Create `src/compositions/<Name>.tsx` — root `AbsoluteFill` must use `backgroundColor: 'transparent'`
2. Register in `src/Root.tsx` with `<Composition id="<Name>" component={<Name>} ... />`
3. Add `<Name>` to `COMPOSITIONS` in `Makefile`

### Minimal composition template

```tsx
import React from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate, spring } from 'remotion';

export const MyAnim: React.FC<{ title?: string }> = ({ title = 'Default' }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // spring() for snappy entry — offset frame so animation starts at a chosen frame
  const scale = spring({ frame: frame - 10, fps, config: { damping: 14, stiffness: 300 }, from: 0, to: 1 });

  // interpolate() for anything linear/eased — always clamp both ends
  const opacity = interpolate(frame, [0, 15], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <AbsoluteFill style={{ backgroundColor: 'transparent' }}>
      {/* your layers here */}
    </AbsoluteFill>
  );
};
```

### Root.tsx registration

```tsx
import { MyAnim } from './compositions/MyAnim';

<Composition
  id="MyAnim"
  component={MyAnim}
  durationInFrames={180}   // 6 s at 30 fps
  fps={30}
  width={1920}
  height={1080}
  defaultProps={{ title: 'Hello' }}
/>
```

### Makefile entry

```makefile
COMPOSITIONS := MyComp LowerThirdVFD MyAnim
```

### Config object pattern

The key move is pulling all tweakable values into a single config object at the top of the component. This makes tuning fast — one place to touch, no hunting through JSX for magic numbers.

```tsx
const CONFIG = {
  // timing (frames)
  entryFrame: 10,
  textFrame: 30,
  exitFrame: 165,
  // spring feel
  damping: 14,
  stiffness: 300,
  // layout
  panelWidth: 480,
  panelY: 820,
  fontSize: 28,
  // colors
  bg: '#050D1A',
  accent: '#00E5FF',
};

export const MyAnim: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const scale = spring({
    frame: frame - CONFIG.entryFrame,
    fps,
    config: { damping: CONFIG.damping, stiffness: CONFIG.stiffness },
    from: 0, to: 1,
  });
  // ...
};
```

Put colors, font sizes, panel dimensions, spring parameters, and all frame offsets in `CONFIG`. Never inline a number that you might want to change.

### Key animation primitives

| Need | Tool | Notes |
|------|------|-------|
| Snappy pop / elastic entry | `spring()` | Use `damping 14, stiffness 300` (house style). Offset via `frame - startFrame`. |
| Linear or eased fade/move | `interpolate()` | Always pass `extrapolateLeft/Right: 'clamp'`. |
| Typewriter / timed reveal | `interpolate` + `Math.floor` | Map frame → character count. |
| Clip-path wipe | SVG `<clipPath>` + interpolated width | See TitleCard trace reveal pattern. |
| Staggered children | `frame - (i * stagger)` per child | Pass into `spring()` or `interpolate()`. |

### Timing conventions

- **0–10 f**: brief pre-roll / background appears  
- **10–30 f**: primary element enters (spring)  
- **30–80 f**: secondary elements stagger in  
- **last 15 f**: optional fade-out via `interpolate`  
- Keep exit logic in the same component — no separate outro comp.

## Studio & render

```
make studio      # open Remotion Studio (hot-reload preview)
make render-all  # render every composition to out/<Name>.mov (ProRes 4444)
```

## Existing compositions

| id | file | duration | purpose |
|----|------|----------|---------|
| `MyComp` | `MyComp.tsx` | 150 f | placeholder / hello world |
| `LowerThirdVFD` | `LowerThirdVFD.tsx` | dynamic | Zero to ASIC: lower-left VFD dot-matrix bug, 2 lines, types in then deletes |
| `LowerThirdCallToAction` | `LowerThirdCallToAction.tsx` | dynamic | Zero to ASIC: VFD 3-line CTA panel |
| `TTLowerThird` | `TTLowerThird.tsx` | ~212 f | Tiny Tapeout: logo pops in, slides right revealing strip + 2-line text (name, title) |
| `TTCallToAction` | `TTCallToAction.tsx` | ~254 f | Tiny Tapeout: full-width CTA, 3-line text (header, line1, line2) |

## Design conventions

- **Color palette** (shared aesthetic): deep navy `#050D1A`, electric cyan `#00E5FF`, hot orange `#FF6B00`
- **PCB / GDS style**: Manhattan (90°) routing only, copper traces `#C8880C`, PCB green `#19381C`
- **VFD green**: phosphor on `#2DFF68`, off-dot `#0C180C`, dot-mask 5×7 px
- **Fonts**: bold sans-serif for impact text; `"Courier New", monospace` for technical/VFD text
- **3D feel**: `perspective(700px) rotateX(5deg) rotateY(-2deg)` on panels
- **Entry/exit**: `spring()` with `damping 14, stiffness 300` for snappy pops

## TypeScript notes

- `noUnusedLocals: true` — don't leave unused variables
- Run `npx tsc --noEmit` to check before considering anything done
