import React from 'react';
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from 'remotion';
import { z } from 'zod';
import { FONT, FALLBACK_GLYPH } from '../vfd-font';

// ── Config ────────────────────────────────────────────────────────────────────
const CONFIG = {
  dotSize: 4,
  dotGapX: 2,
  dotGapY: 2,
  charGap: 8,
  rowGap: 10,
  padding: 12,

  phosphorOn: '#A78DC7',
  phosphorOffOpacity: 0.05,
  glowRadius: 4.5,
  bg: '#000818',

  // Header row rendered at full brightness; separator drawn between header and body rows
  separatorColor: 'rgba(167,141,199,0.25)',

  entryFrames: 8,
  holdFrames: 120,   // 4 s at 30 fps — longer hold for a call to action
  exitFrames: 8,
  typeMs: 40,
  deleteMs: 20,
  cursorBlinkFrames: 15,
};

// Derived geometry
const DOT_PITCH_X  = CONFIG.dotSize + CONFIG.dotGapX;
const DOT_PITCH_Y  = CONFIG.dotSize + CONFIG.dotGapY;
const CHAR_W       = 5 * DOT_PITCH_X - CONFIG.dotGapX;
const CHAR_H       = 8 * DOT_PITCH_Y - CONFIG.dotGapY;
const CHAR_PITCH_X = CHAR_W + CONFIG.charGap;
const CHAR_PITCH_Y = CHAR_H + CONFIG.rowGap;

// ── Duration helper ───────────────────────────────────────────────────────────
export function getDuration(header: string, line1: string, line2: string, fps: number): number {
  const typeF   = (CONFIG.typeMs   / 1000) * fps;
  const deleteF = (CONFIG.deleteMs / 1000) * fps;
  const total   = header.length + line1.length + line2.length;
  return Math.ceil(
    CONFIG.entryFrames +
    total * typeF +
    CONFIG.holdFrames +
    total * deleteF +
    CONFIG.exitFrames,
  );
}

// ── Schema & types ────────────────────────────────────────────────────────────
export const lowerThirdCallToActionSchema = z.object({
  header: z.string(),
  line1:  z.string(),
  line2:  z.string(),
});

export type LowerThirdCallToActionProps = z.infer<typeof lowerThirdCallToActionSchema>;

export const LowerThirdCallToAction: React.FC<LowerThirdCallToActionProps> = ({
  header,
  line1,
  line2,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const typeF   = (CONFIG.typeMs   / 1000) * fps;
  const deleteF = (CONFIG.deleteMs / 1000) * fps;
  const total   = header.length + line1.length + line2.length;

  // Timing milestones
  const tHeader = CONFIG.entryFrames;
  const tLine1  = tHeader + header.length * typeF;
  const tLine2  = tLine1  + line1.length  * typeF;
  const tDone   = tLine2  + line2.length  * typeF;
  const tDel    = tDone   + CONFIG.holdFrames;
  const tFade   = tDel    + total * deleteF;
  const tEnd    = tFade   + CONFIG.exitFrames;

  // Visible character counts per row
  let hShow = 0;
  let l1Show = 0;
  let l2Show = 0;

  if (frame < tHeader) {
    // pre-roll
  } else if (frame < tLine1) {
    hShow = Math.min(header.length, Math.floor((frame - tHeader) / typeF));
  } else if (frame < tLine2) {
    hShow = header.length;
    l1Show = Math.min(line1.length, Math.floor((frame - tLine1) / typeF));
  } else if (frame < tDone) {
    hShow = header.length;
    l1Show = line1.length;
    l2Show = Math.min(line2.length, Math.floor((frame - tLine2) / typeF));
  } else if (frame < tDel) {
    hShow = header.length; l1Show = line1.length; l2Show = line2.length;
  } else {
    // Delete from the end: line2 → line1 → header
    const deleted   = Math.min(total, Math.floor((frame - tDel) / deleteF));
    const remaining = total - deleted;
    hShow  = Math.min(header.length, remaining);
    l1Show = Math.min(line1.length, Math.max(0, remaining - header.length));
    l2Show = Math.max(0, remaining - header.length - line1.length);
  }

  // Cursor
  let cursorRow = -1;
  let cursorCol = -1;
  if (frame >= tHeader && frame < tLine1) {
    cursorRow = 0; cursorCol = hShow;
  } else if (frame >= tLine1 && frame < tLine2) {
    cursorRow = 1; cursorCol = l1Show;
  } else if (frame >= tLine2 && frame < tDone) {
    cursorRow = 2; cursorCol = l2Show;
  } else if (frame >= tDone && frame < tDel) {
    cursorRow = 2; cursorCol = line2.length;
  } else if (frame >= tDel && frame < tFade) {
    if (l2Show > 0)       { cursorRow = 2; cursorCol = l2Show; }
    else if (l1Show > 0)  { cursorRow = 1; cursorCol = l1Show; }
    else if (hShow > 0)   { cursorRow = 0; cursorCol = hShow; }
  }

  const cursorVisible =
    cursorRow >= 0 && Math.floor(frame / CONFIG.cursorBlinkFrames) % 2 === 0;

  // Entry / exit
  const entryT  = interpolate(frame, [0, tHeader], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const exitT   = interpolate(frame, [tFade, tEnd],  [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const opacity = Math.min(entryT, exitT);
  const slideY  = interpolate(entryT, [0, 1], [20, 0]);

  // Display geometry — fixed 28-col width so it doesn't resize as text types
  const displayCols = Math.max(28, Math.max(header.length, line1.length, line2.length) + 2);
  const dispW = CONFIG.padding * 2 + displayCols * CHAR_PITCH_X - CONFIG.charGap;
  const dispH = CONFIG.padding * 2 + 3 * CHAR_PITCH_Y - CONFIG.rowGap;

  // Build dots for all three rows
  const lines      = [header, line1, line2];
  const charsShown = [hShow,  l1Show, l2Show];

  const unlitRects: React.ReactNode[] = [];
  const litRects:   React.ReactNode[] = [];

  for (let rowIdx = 0; rowIdx < 3; rowIdx++) {
    const line  = lines[rowIdx];
    const shown = charsShown[rowIdx];
    const baseY = CONFIG.padding + rowIdx * CHAR_PITCH_Y;

    for (let colIdx = 0; colIdx < displayCols; colIdx++) {
      const char  = colIdx < line.length ? line[colIdx] : ' ';
      const lit   = colIdx < shown;
      const glyph = FONT[char] ?? FALLBACK_GLYPH;
      const baseX = CONFIG.padding + colIdx * CHAR_PITCH_X;

      for (let dr = 0; dr < 8; dr++) {
        const rowBits = glyph[dr] ?? 0;
        for (let dc = 0; dc < 5; dc++) {
          const dotOn = (rowBits >> (4 - dc)) & 1;
          const x   = baseX + dc * DOT_PITCH_X;
          const y   = baseY + dr * DOT_PITCH_Y;
          const key = `${rowIdx}-${colIdx}-${dr}-${dc}`;
          if (lit && dotOn) {
            litRects.push(
              <rect key={key} x={x} y={y} width={CONFIG.dotSize} height={CONFIG.dotSize} fill={CONFIG.phosphorOn} />,
            );
          } else {
            unlitRects.push(
              <rect key={key} x={x} y={y} width={CONFIG.dotSize} height={CONFIG.dotSize} fill={CONFIG.phosphorOn} opacity={CONFIG.phosphorOffOpacity} />,
            );
          }
        }
      }
    }
  }

  // Separator line between header row and body rows
  const separatorY = CONFIG.padding + CHAR_PITCH_Y - CONFIG.rowGap / 2;

  // Bezel
  const BZ   = 10;
  const svgW = dispW + BZ * 2;
  const svgH = dispH + BZ * 2;

  return (
    <AbsoluteFill style={{ backgroundColor: 'transparent' }}>
      <div
        style={{
          position: 'absolute',
          bottom: 40,
          left: 40,
          opacity,
          transform: `translateY(${slideY}px) perspective(600px) rotateX(8deg)`,
          transformOrigin: 'bottom left',
          filter: 'drop-shadow(0px 10px 24px rgba(0,0,0,0.85))',
        }}
      >
        <svg width={svgW} height={svgH} style={{ display: 'block' }}>
          <defs>
            <filter id="cta-glow" x="-60%" y="-60%" width="220%" height="220%">
              <feGaussianBlur stdDeviation={CONFIG.glowRadius} result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {/* Bezel body */}
          <rect width={svgW} height={svgH} fill="#060A12" rx={5} />
          <rect x={0}          y={0}          width={svgW} height={1.5} fill="rgba(255,255,255,0.13)" rx={5} />
          <rect x={0}          y={0}          width={1.5}  height={svgH} fill="rgba(255,255,255,0.08)" />
          <rect x={0}          y={svgH - 1.5} width={svgW} height={1.5} fill="rgba(0,0,0,0.55)" />
          <rect x={svgW - 1.5} y={0}          width={1.5}  height={svgH} fill="rgba(0,0,0,0.45)" />

          {/* Inner groove */}
          <rect x={BZ - 2} y={BZ - 2} width={dispW + 4} height={dispH + 4} fill="none" stroke="rgba(0,0,0,0.65)" strokeWidth={2} rx={4} />

          {/* VFD panel */}
          <g transform={`translate(${BZ}, ${BZ})`}>
            <rect width={dispW} height={dispH} fill={CONFIG.bg} rx={3} />

            {/* Separator between header and body */}
            <line
              x1={CONFIG.padding} y1={separatorY}
              x2={dispW - CONFIG.padding} y2={separatorY}
              stroke={CONFIG.separatorColor}
              strokeWidth={1}
            />

            <g>{unlitRects}</g>
            <g filter="url(#cta-glow)">{litRects}</g>

            {/* Cursor */}
            {cursorVisible && cursorCol < displayCols && (() => {
              const baseX = CONFIG.padding + cursorCol * CHAR_PITCH_X;
              const baseY = CONFIG.padding + cursorRow * CHAR_PITCH_Y;
              const dots: React.ReactNode[] = [];
              for (let dr = 0; dr < 8; dr++) {
                for (let dc = 0; dc < 5; dc++) {
                  dots.push(
                    <rect
                      key={`cur-${dr}-${dc}`}
                      x={baseX + dc * DOT_PITCH_X}
                      y={baseY + dr * DOT_PITCH_Y}
                      width={CONFIG.dotSize}
                      height={CONFIG.dotSize}
                      fill={CONFIG.phosphorOn}
                      opacity={0.85}
                    />,
                  );
                }
              }
              return <g filter="url(#cta-glow)">{dots}</g>;
            })()}
          </g>
        </svg>
      </div>
    </AbsoluteFill>
  );
};
