import React from 'react';
import {
  AbsoluteFill,
  CalculateMetadataFunction,
  interpolate,
  useCurrentFrame,
} from 'remotion';
import { loadFont, fontFamily } from '@remotion/google-fonts/IBMPlexMono';
import { z } from 'zod';

loadFont('normal', { weights: ['700'], subsets: ['latin'] });

// ── Schema ────────────────────────────────────────────────────────────────────

export const z2AScaleBarSchema = z.object({
  barThickness: z.number().default(4),
});

export type Z2AScaleBarProps = z.infer<typeof z2AScaleBarSchema>;

// ── All level data in one place ───────────────────────────────────────────────
// Video timecodes are [seconds, frames] at VIDEO_FPS.
// value : numeric scale in a consistent unit — zoom ratio = value[n] / value[n+1]
// label : text shown on the bar
// zoomStart / zoomEnd : when the zoom to the NEXT level begins / ends in the source video
//                       omit on the last entry (no zoom out from the final level)
// holdFrames : extra hold on the last level (comp frames, not video frames)

const VIDEO_FPS = 24;
const COMP_FPS  = 24;
const START_TC  = [0, 0] as const;  // timecode when the scale bar first appears

const LEVELS = [
  { value: 100,  label: '100 mm',  zoomStart: [0, 18] as const, zoomEnd: [2, 13] as const  },
  { value: 5,   label: '5 mm',   zoomStart: [2, 23] as const, zoomEnd: [4, 21] as const  },  
  { value: 1,    label: '500 μm', zoomStart: [6, 2] as const, zoomEnd: [8, 4] as const },
  { value: 0.2,  label: '100 μm',  zoomStart: [8, 12] as const, zoomEnd: [10, 7] as const  },
  { value: 0.1,  label: '10 μm',  holdFrames: 120 },
];

// ── Phase durations derived from LEVELS ───────────────────────────────────────

const tcvf    = (tc: readonly [number, number]) => tc[0] * VIDEO_FPS + tc[1];
const startVF = tcvf(START_TC);
const relCF   = (tc: readonly [number, number]) =>
  Math.round((tcvf(tc) - startVF) * COMP_FPS / VIDEO_FPS);

const phaseDurations: number[] = [];
for (let i = 0; i < LEVELS.length; i++) {
  const cur  = LEVELS[i];
  const prev = LEVELS[i - 1];
  // pause at this level
  if (i === 0) {
    phaseDurations.push(relCF(cur.zoomStart!));
  } else if (prev.zoomEnd) {
    const zs = cur.zoomStart;
    phaseDurations.push(zs ? relCF(zs) - relCF(prev.zoomEnd) : (cur.holdFrames ?? 60));
  }
  // zoom to next level
  if (cur.zoomStart && cur.zoomEnd) {
    phaseDurations.push(relCF(cur.zoomEnd) - relCF(cur.zoomStart));
  }
}

const totalDuration = phaseDurations.reduce((a, b) => a + b, 0);

// ── Zoom stage derivation ─────────────────────────────────────────────────────
// For a zoom of `ratio` centred on the bar:
//   span        = how many tick-spacings fit in the new range = 10 / ratio
//   bottomTick  = first tick that lands at position 0 after zoom
//   topTick     = last tick that lands at position 1 after zoom
//   anchor      = fixed point of the zoom = bottomTick * ratio / (10 * (ratio − 1))
//
// nPos(i, zP) = anchor + (i/10 − anchor) × ratio^zP
// At zP=0: nPos = i/10  (original positions)
// At zP=1: nPos = ratio × (i − bottomTick) / 10  → bottomTick→0, topTick→1

function computeZoomStage(ratio: number) {
  const span        = Math.max(1, Math.round(10 / ratio));
  const bottomTick  = Math.max(0, Math.floor((10 - span) / 2));
  const topTick     = Math.min(10, bottomTick + span);
  const anchor      = bottomTick * ratio / (10 * (ratio - 1));
  return { ratio, anchor, bottomTick, topTick };
}

const zoomStages = LEVELS.slice(0, -1).map((l, i) =>
  computeZoomStage(l.value / LEVELS[i + 1].value)
);

// ── Static display config ─────────────────────────────────────────────────────

const CONFIG = {
  barX:         150,
  barTop:        80,
  barBottom:    1000,
  bigTickWidth:  80,
  fontSize:     102,
  labelOffsetX:  20,
  fontFamily,
  ink:          '#000000',
};

// ── calculateMetadata ─────────────────────────────────────────────────────────

export const calculateMetadata: CalculateMetadataFunction<Z2AScaleBarProps> = (_) => ({
  durationInFrames: totalDuration,
});

// ── Component ─────────────────────────────────────────────────────────────────

export const Z2AScaleBar: React.FC<Z2AScaleBarProps> = ({
  barThickness = 4,
}) => {
  const frame = useCurrentFrame();
  const barHeight      = CONFIG.barBottom - CONFIG.barTop;
  const smallTickWidth = Math.round(CONFIG.bigTickWidth / 2);

  // ── Phase lookup ──────────────────────────────────────────────────────────
  const cf = Math.min(frame, totalDuration - 1);

  let phaseIdx     = phaseDurations.length - 1;
  let frameInPhase = phaseDurations[phaseDurations.length - 1] - 1;
  let acc = 0;
  for (let i = 0; i < phaseDurations.length; i++) {
    if (cf < acc + phaseDurations[i]) {
      phaseIdx     = i;
      frameInPhase = cf - acc;
      break;
    }
    acc += phaseDurations[i];
  }

  const isPause      = phaseIdx % 2 === 0;
  const levelIdx     = Math.floor(phaseIdx / 2);
  const zoomStageIdx = isPause ? 0 : (phaseIdx - 1) / 2;
  const zoomStage    = zoomStages[zoomStageIdx] ?? zoomStages[0];
  const phaseDur     = phaseDurations[phaseIdx];

  // Eased zoom progress 0→1
  const rawP = isPause ? 0 : frameInPhase / Math.max(1, phaseDur - 1);
  const zP   = rawP;

  // ── Label opacities ───────────────────────────────────────────────────────

  const currentLabel = LEVELS[Math.min(levelIdx, LEVELS.length - 1)].label;

  // Labels follow their corresponding ticks: top label tracks tick 10, zero label tracks tick 0.
  // During pause both sit at their bar endpoints; during zoom they ride off-screen with the ticks.
  const topLabelY = isPause
    ? CONFIG.barTop
    : CONFIG.barBottom - (zoomStage.anchor + (1 - zoomStage.anchor) * Math.pow(zoomStage.ratio, zP)) * barHeight;
  const zeroLabelY = isPause
    ? CONFIG.barBottom
    : CONFIG.barBottom - zoomStage.anchor * (1 - Math.pow(zoomStage.ratio, zP)) * barHeight;

  // ── Tick geometry ─────────────────────────────────────────────────────────

  interface Tick { key: string; y: number; width: number; opacity: number }
  const ticks: Tick[] = [];

  if (isPause) {
    for (let i = 0; i <= 10; i++) {
      const y = CONFIG.barBottom - (i / 10) * barHeight;
      ticks.push({
        key:     `p${i}`,
        y,
        width:   (i === 0 || i === 10) ? CONFIG.bigTickWidth : smallTickWidth,
        opacity: 1,
      });
    }
  } else {
    const growStart = Math.round(phaseDur * 0.80);

    for (let i = 0; i <= 10; i++) {
      const nPos = zoomStage.anchor + (i / 10 - zoomStage.anchor) * Math.pow(zoomStage.ratio, zP);
      if (nPos < -0.001 || nPos > 1.001) continue;
      const y = CONFIG.barBottom - nPos * barHeight;

      let width = smallTickWidth;
      if (i === 0 || i === 10) {
        width = CONFIG.bigTickWidth;
      } else if (i === zoomStage.bottomTick || i === zoomStage.topTick) {
        width = interpolate(frameInPhase, [growStart, phaseDur - 1],
          [smallTickWidth, CONFIG.bigTickWidth],
          { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
      }

      ticks.push({ key: `z${i}`, y, width, opacity: 1 });
    }

    // Sub-ticks for next level fade in during last 30 % of zoom
    const subAlpha = interpolate(
      frameInPhase,
      [Math.round(phaseDur * 0.7), phaseDur - 1],
      [0, 1],
      { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
    );
    if (subAlpha > 0) {
      for (let i = 1; i <= 9; i++) {
        const y = CONFIG.barBottom - (i / 10) * barHeight;
        ticks.push({ key: `s${i}`, y, width: smallTickWidth, opacity: subAlpha });
      }
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────

  const labelX  = CONFIG.barX + CONFIG.labelOffsetX;
  const clipPad = Math.ceil(barThickness / 2);

  return (
    <AbsoluteFill style={{ backgroundColor: 'transparent' }}>
      <svg
        width={1920}
        height={1080}
        style={{ position: 'absolute', top: 0, left: 0, overflow: 'visible' }}
      >
        <defs>
          <clipPath id="z2a-scale-ticks">
            <rect
              x={CONFIG.barX - CONFIG.bigTickWidth - 4}
              y={CONFIG.barTop - clipPad}
              width={CONFIG.bigTickWidth + 8}
              height={barHeight + clipPad * 2}
            />
          </clipPath>
        </defs>

        <line
          x1={CONFIG.barX} y1={CONFIG.barTop}
          x2={CONFIG.barX} y2={CONFIG.barBottom}
          stroke={CONFIG.ink} strokeWidth={barThickness} strokeLinecap="square"
        />

        <g clipPath="url(#z2a-scale-ticks)">
          {ticks.map(t => (
            <line
              key={t.key}
              x1={CONFIG.barX} y1={t.y}
              x2={CONFIG.barX - t.width} y2={t.y}
              stroke={CONFIG.ink} strokeWidth={barThickness} strokeLinecap="square"
              opacity={t.opacity}
            />
          ))}
        </g>

        <text x={labelX} y={topLabelY}
          fill={CONFIG.ink} fontSize={CONFIG.fontSize}
          fontFamily={CONFIG.fontFamily} fontWeight="bold"
          dominantBaseline="middle"
        >{currentLabel}</text>

        <text x={labelX} y={zeroLabelY}
          fill={CONFIG.ink} fontSize={CONFIG.fontSize}
          fontFamily={CONFIG.fontFamily} fontWeight="bold"
          dominantBaseline="middle"
        >0</text>

      </svg>
    </AbsoluteFill>
  );
};
