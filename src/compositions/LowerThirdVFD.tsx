import React from 'react';
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from 'remotion';

// ── Bitmap font: 5 cols × 8 rows ──────────────────────────────────────────────
// Each entry: 8 row bitmasks (top → bottom). Bit 4 = leftmost dot, bit 0 = rightmost.
const FONT: Record<string, readonly number[]> = {
  ' ': [0, 0, 0, 0, 0, 0, 0, 0],
  '!': [0b00100, 0b00100, 0b00100, 0b00100, 0b00100, 0, 0b00100, 0],
  '"': [0b01010, 0b01010, 0b01010, 0, 0, 0, 0, 0],
  '#': [0b01010, 0b01010, 0b11111, 0b01010, 0b11111, 0b01010, 0b01010, 0],
  '$': [0b00100, 0b01111, 0b10100, 0b01110, 0b00101, 0b11110, 0b00100, 0],
  '%': [0b11000, 0b11010, 0b00100, 0b00100, 0b01011, 0b00011, 0, 0],
  '&': [0b01100, 0b10010, 0b10100, 0b01000, 0b10101, 0b10010, 0b01101, 0],
  "'": [0b00110, 0b00100, 0b01000, 0, 0, 0, 0, 0],
  '(': [0b00010, 0b00100, 0b01000, 0b01000, 0b01000, 0b00100, 0b00010, 0],
  ')': [0b01000, 0b00100, 0b00010, 0b00010, 0b00010, 0b00100, 0b01000, 0],
  '*': [0b00100, 0b10101, 0b01110, 0b11111, 0b01110, 0b10101, 0b00100, 0],
  '+': [0, 0b00100, 0b00100, 0b11111, 0b00100, 0b00100, 0, 0],
  ',': [0, 0, 0, 0, 0, 0b00110, 0b00100, 0b01000],
  '-': [0, 0, 0, 0b11111, 0, 0, 0, 0],
  '.': [0, 0, 0, 0, 0, 0b00110, 0b00110, 0],
  '/': [0b00001, 0b00010, 0b00100, 0b00100, 0b01000, 0b10000, 0, 0],
  '0': [0b01110, 0b10001, 0b10011, 0b10101, 0b11001, 0b10001, 0b01110, 0],
  '1': [0b00100, 0b01100, 0b00100, 0b00100, 0b00100, 0b00100, 0b01110, 0],
  '2': [0b01110, 0b10001, 0b00001, 0b00110, 0b01000, 0b10000, 0b11111, 0],
  '3': [0b11110, 0b00001, 0b00001, 0b01110, 0b00001, 0b00001, 0b11110, 0],
  '4': [0b00010, 0b00110, 0b01010, 0b10010, 0b11111, 0b00010, 0b00010, 0],
  '5': [0b11111, 0b10000, 0b11110, 0b00001, 0b00001, 0b10001, 0b01110, 0],
  '6': [0b00110, 0b01000, 0b10000, 0b11110, 0b10001, 0b10001, 0b01110, 0],
  '7': [0b11111, 0b00001, 0b00010, 0b00100, 0b01000, 0b01000, 0b01000, 0],
  '8': [0b01110, 0b10001, 0b10001, 0b01110, 0b10001, 0b10001, 0b01110, 0],
  '9': [0b01110, 0b10001, 0b10001, 0b01111, 0b00001, 0b00010, 0b01100, 0],
  ':': [0, 0b00110, 0b00110, 0, 0b00110, 0b00110, 0, 0],
  ';': [0, 0b00110, 0b00110, 0, 0b00110, 0b00100, 0b01000, 0],
  '<': [0b00010, 0b00100, 0b01000, 0b10000, 0b01000, 0b00100, 0b00010, 0],
  '=': [0, 0, 0b11111, 0, 0b11111, 0, 0, 0],
  '>': [0b01000, 0b00100, 0b00010, 0b00001, 0b00010, 0b00100, 0b01000, 0],
  '?': [0b01110, 0b10001, 0b00001, 0b00110, 0b00100, 0, 0b00100, 0],
  '@': [0b01110, 0b10001, 0b10111, 0b10101, 0b10111, 0b10000, 0b01110, 0],
  'A': [0b00100, 0b01010, 0b10001, 0b10001, 0b11111, 0b10001, 0b10001, 0],
  'B': [0b11110, 0b10001, 0b10001, 0b11110, 0b10001, 0b10001, 0b11110, 0],
  'C': [0b01110, 0b10001, 0b10000, 0b10000, 0b10000, 0b10001, 0b01110, 0],
  'D': [0b11100, 0b10010, 0b10001, 0b10001, 0b10001, 0b10010, 0b11100, 0],
  'E': [0b11111, 0b10000, 0b10000, 0b11110, 0b10000, 0b10000, 0b11111, 0],
  'F': [0b11111, 0b10000, 0b10000, 0b11110, 0b10000, 0b10000, 0b10000, 0],
  'G': [0b01110, 0b10001, 0b10000, 0b10111, 0b10001, 0b10001, 0b01111, 0],
  'H': [0b10001, 0b10001, 0b10001, 0b11111, 0b10001, 0b10001, 0b10001, 0],
  'I': [0b01110, 0b00100, 0b00100, 0b00100, 0b00100, 0b00100, 0b01110, 0],
  'J': [0b00111, 0b00010, 0b00010, 0b00010, 0b00010, 0b10010, 0b01100, 0],
  'K': [0b10001, 0b10010, 0b10100, 0b11000, 0b10100, 0b10010, 0b10001, 0],
  'L': [0b10000, 0b10000, 0b10000, 0b10000, 0b10000, 0b10000, 0b11111, 0],
  'M': [0b10001, 0b11011, 0b10101, 0b10101, 0b10001, 0b10001, 0b10001, 0],
  'N': [0b10001, 0b11001, 0b10101, 0b10101, 0b10011, 0b10001, 0b10001, 0],
  'O': [0b01110, 0b10001, 0b10001, 0b10001, 0b10001, 0b10001, 0b01110, 0],
  'P': [0b11110, 0b10001, 0b10001, 0b11110, 0b10000, 0b10000, 0b10000, 0],
  'Q': [0b01110, 0b10001, 0b10001, 0b10001, 0b10101, 0b10010, 0b01101, 0],
  'R': [0b11110, 0b10001, 0b10001, 0b11110, 0b10100, 0b10010, 0b10001, 0],
  'S': [0b01111, 0b10000, 0b10000, 0b01110, 0b00001, 0b00001, 0b11110, 0],
  'T': [0b11111, 0b00100, 0b00100, 0b00100, 0b00100, 0b00100, 0b00100, 0],
  'U': [0b10001, 0b10001, 0b10001, 0b10001, 0b10001, 0b10001, 0b01110, 0],
  'V': [0b10001, 0b10001, 0b10001, 0b10001, 0b10001, 0b01010, 0b00100, 0],
  'W': [0b10001, 0b10001, 0b10001, 0b10101, 0b10101, 0b11011, 0b10001, 0],
  'X': [0b10001, 0b10001, 0b01010, 0b00100, 0b01010, 0b10001, 0b10001, 0],
  'Y': [0b10001, 0b10001, 0b01010, 0b00100, 0b00100, 0b00100, 0b00100, 0],
  'Z': [0b11111, 0b00001, 0b00010, 0b00100, 0b01000, 0b10000, 0b11111, 0],
  '[': [0b01110, 0b01000, 0b01000, 0b01000, 0b01000, 0b01000, 0b01110, 0],
  '\\': [0b10000, 0b01000, 0b00100, 0b00100, 0b00010, 0b00001, 0, 0],
  ']': [0b01110, 0b00010, 0b00010, 0b00010, 0b00010, 0b00010, 0b01110, 0],
  '^': [0b00100, 0b01010, 0b10001, 0, 0, 0, 0, 0],
  '_': [0, 0, 0, 0, 0, 0, 0b11111, 0],
  '`': [0b01000, 0b00100, 0, 0, 0, 0, 0, 0],
  'a': [0, 0, 0b01110, 0b00001, 0b01111, 0b10001, 0b01111, 0],
  'b': [0b10000, 0b10000, 0b11110, 0b10001, 0b10001, 0b10001, 0b11110, 0],
  'c': [0, 0, 0b01110, 0b10000, 0b10000, 0b10000, 0b01110, 0],
  'd': [0b00001, 0b00001, 0b01111, 0b10001, 0b10001, 0b10001, 0b01111, 0],
  'e': [0, 0, 0b01110, 0b10001, 0b11111, 0b10000, 0b01110, 0],
  'f': [0b00110, 0b01001, 0b01000, 0b11110, 0b01000, 0b01000, 0b01000, 0],
  'g': [0, 0, 0b01111, 0b10001, 0b10001, 0b01111, 0b00001, 0b01110],
  'h': [0b10000, 0b10000, 0b10110, 0b11001, 0b10001, 0b10001, 0b10001, 0],
  'i': [0b00100, 0, 0b01100, 0b00100, 0b00100, 0b00100, 0b01110, 0],
  'j': [0b00010, 0, 0b00110, 0b00010, 0b00010, 0b10010, 0b01100, 0],
  'k': [0b10000, 0b10000, 0b10010, 0b10100, 0b11000, 0b10100, 0b10010, 0],
  'l': [0b01100, 0b00100, 0b00100, 0b00100, 0b00100, 0b00100, 0b01110, 0],
  'm': [0, 0, 0b11010, 0b10101, 0b10101, 0b10001, 0b10001, 0],
  'n': [0, 0, 0b10110, 0b11001, 0b10001, 0b10001, 0b10001, 0],
  'o': [0, 0, 0b01110, 0b10001, 0b10001, 0b10001, 0b01110, 0],
  'p': [0, 0, 0b11110, 0b10001, 0b10001, 0b11110, 0b10000, 0b10000],
  'q': [0, 0, 0b01111, 0b10001, 0b10001, 0b01111, 0b00001, 0b00001],
  'r': [0, 0, 0b10110, 0b11001, 0b10000, 0b10000, 0b10000, 0],
  's': [0, 0, 0b01111, 0b10000, 0b01110, 0b00001, 0b11110, 0],
  't': [0b01000, 0b01000, 0b11110, 0b01000, 0b01000, 0b01001, 0b00110, 0],
  'u': [0, 0, 0b10001, 0b10001, 0b10001, 0b10011, 0b01101, 0],
  'v': [0, 0, 0b10001, 0b10001, 0b10001, 0b01010, 0b00100, 0],
  'w': [0, 0, 0b10001, 0b10001, 0b10101, 0b10101, 0b01010, 0],
  'x': [0, 0, 0b10001, 0b01010, 0b00100, 0b01010, 0b10001, 0],
  'y': [0, 0, 0b10001, 0b10001, 0b01111, 0b00001, 0b01110, 0],
  'z': [0, 0, 0b11111, 0b00010, 0b00100, 0b01000, 0b11111, 0],
  '{': [0b00110, 0b01000, 0b01000, 0b11000, 0b01000, 0b01000, 0b00110, 0],
  '|': [0b00100, 0b00100, 0b00100, 0b00100, 0b00100, 0b00100, 0b00100, 0],
  '}': [0b11000, 0b00100, 0b00100, 0b00110, 0b00100, 0b00100, 0b11000, 0],
  '~': [0, 0b01000, 0b10101, 0b00010, 0, 0, 0, 0],
};

const FALLBACK_GLYPH: readonly number[] = [
  0b11111, 0b10001, 0b10001, 0b10001, 0b10001, 0b10001, 0b11111, 0,
];

// ── Config ────────────────────────────────────────────────────────────────────
const CONFIG = {
  dotSize: 2,       // rendered dot width/height in px
  dotGapX: 1,       // gap between dot columns within a character
  dotGapY: 1,       // gap between dot rows within a character
  charGap: 3,       // gap between adjacent characters
  rowGap: 6,        // gap between the two display rows
  padding: 10,      // inner bezel padding

  phosphorOn: '#00FFB2',
  phosphorOffOpacity: 0.05,
  bg: '#001A00',

  entryFrames: 8,
  holdFrames: 90,
  exitFrames: 8,
  typeMs: 40,        // ms per character while typing
  deleteMs: 20,      // ms per character while deleting
  cursorBlinkFrames: 15,
};

// Derived geometry (precomputed)
const DOT_PITCH_X = CONFIG.dotSize + CONFIG.dotGapX;           // 3
const DOT_PITCH_Y = CONFIG.dotSize + CONFIG.dotGapY;           // 3
const CHAR_W      = 5 * DOT_PITCH_X - CONFIG.dotGapX;         // 14
const CHAR_H      = 8 * DOT_PITCH_Y - CONFIG.dotGapY;         // 23
const CHAR_PITCH_X = CHAR_W + CONFIG.charGap;                  // 17
const CHAR_PITCH_Y = CHAR_H + CONFIG.rowGap;                   // 29

// ── Duration helper (used by Root.tsx calculateMetadata) ──────────────────────
export function getDuration(line1: string, line2: string, fps: number): number {
  const typeF   = (CONFIG.typeMs   / 1000) * fps;
  const deleteF = (CONFIG.deleteMs / 1000) * fps;
  const total   = line1.length + line2.length;
  return Math.ceil(
    CONFIG.entryFrames +
    total * typeF +
    CONFIG.holdFrames +
    total * deleteF +
    CONFIG.exitFrames,
  );
}

// ── Component ─────────────────────────────────────────────────────────────────
export type LowerThirdVFDProps = { line1?: string; line2?: string };

export const LowerThirdVFD: React.FC<LowerThirdVFDProps> = ({ line1 = '', line2 = '' }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const typeF   = (CONFIG.typeMs   / 1000) * fps;   // 1.2 @ 30 fps
  const deleteF = (CONFIG.deleteMs / 1000) * fps;   // 0.6 @ 30 fps
  const total   = line1.length + line2.length;

  // Timing milestones (in frames)
  const tType  = CONFIG.entryFrames;
  const tLine2 = tType  + line1.length * typeF;
  const tDone  = tLine2 + line2.length * typeF;
  const tDel   = tDone  + CONFIG.holdFrames;
  const tFade  = tDel   + total * deleteF;
  const tEnd   = tFade  + CONFIG.exitFrames;

  // Visible character counts
  let l1Show = 0;
  let l2Show = 0;

  if (frame < tType) {
    l1Show = 0; l2Show = 0;
  } else if (frame < tLine2) {
    l1Show = Math.min(line1.length, Math.floor((frame - tType)  / typeF));
  } else if (frame < tDone) {
    l1Show = line1.length;
    l2Show = Math.min(line2.length, Math.floor((frame - tLine2) / typeF));
  } else if (frame < tDel) {
    l1Show = line1.length; l2Show = line2.length;          // hold
  } else {
    // Delete line2 first, then line1
    const deleted   = Math.min(total, Math.floor((frame - tDel) / deleteF));
    const remaining = total - deleted;
    l1Show = Math.min(line1.length, remaining);
    l2Show = Math.max(0, remaining - line1.length);
  }

  // Cursor position (-1 = hidden)
  let cursorRow = -1;
  let cursorCol = -1;

  if (frame >= tType && frame < tLine2) {
    cursorRow = 0; cursorCol = l1Show;
  } else if (frame >= tLine2 && frame < tDone) {
    cursorRow = 1; cursorCol = l2Show;
  } else if (frame >= tDone && frame < tDel) {
    cursorRow = 1; cursorCol = line2.length;               // blinking at end during hold
  } else if (frame >= tDel && frame < tFade) {
    if (l2Show > 0) { cursorRow = 1; cursorCol = l2Show; }
    else if (l1Show > 0) { cursorRow = 0; cursorCol = l1Show; }
  }

  const cursorVisible =
    cursorRow >= 0 && Math.floor(frame / CONFIG.cursorBlinkFrames) % 2 === 0;

  // Entry: slide up 20 px + fade in over entryFrames
  const entryT  = interpolate(frame, [0, tType], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const exitT   = interpolate(frame, [tFade, tEnd], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const opacity = Math.min(entryT, exitT);
  const slideY  = interpolate(entryT, [0, 1], [20, 0]);   // 20 px → 0

  // Display geometry (sized to content width + 2 spare columns for cursor)
  const displayCols = Math.max(2, Math.max(line1.length, line2.length) + 2);
  const dispW = CONFIG.padding * 2 + displayCols * CHAR_PITCH_X - CONFIG.charGap;
  const dispH = CONFIG.padding * 2 + 2 * CHAR_PITCH_Y - CONFIG.rowGap;

  // Build dot rects (split into unlit / lit for separate glow pass)
  const unlitRects: React.ReactNode[] = [];
  const litRects:   React.ReactNode[] = [];

  for (let rowIdx = 0; rowIdx < 2; rowIdx++) {
    const line      = rowIdx === 0 ? line1 : line2;
    const charsShown = rowIdx === 0 ? l1Show : l2Show;
    const baseY     = CONFIG.padding + rowIdx * CHAR_PITCH_Y;

    for (let colIdx = 0; colIdx < displayCols; colIdx++) {
      const char  = colIdx < line.length ? line[colIdx] : ' ';
      const lit   = colIdx < charsShown;
      const glyph = FONT[char] ?? FALLBACK_GLYPH;
      const baseX = CONFIG.padding + colIdx * CHAR_PITCH_X;

      for (let dr = 0; dr < 8; dr++) {
        const rowBits = glyph[dr] ?? 0;
        for (let dc = 0; dc < 5; dc++) {
          const dotOn = (rowBits >> (4 - dc)) & 1;
          const x   = baseX + dc * DOT_PITCH_X;
          const y   = baseY + dr * DOT_PITCH_Y;
          const key = `${rowIdx}-${colIdx}-${dr}-${dc}`;
          const rect = (
            <rect
              key={key}
              x={x} y={y}
              width={CONFIG.dotSize} height={CONFIG.dotSize}
              fill={CONFIG.phosphorOn}
            />
          );
          if (lit && dotOn) {
            litRects.push(rect);
          } else {
            unlitRects.push(
              <rect
                key={key}
                x={x} y={y}
                width={CONFIG.dotSize} height={CONFIG.dotSize}
                fill={CONFIG.phosphorOn}
                opacity={CONFIG.phosphorOffOpacity}
              />,
            );
          }
        }
      }
    }
  }

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
        }}
      >
        <svg width={dispW} height={dispH} style={{ display: 'block' }}>
          <defs>
            <filter id="vfd-glow" x="-60%" y="-60%" width="220%" height="220%">
              <feGaussianBlur stdDeviation="1.5" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {/* Bezel */}
          <rect width={dispW} height={dispH} fill={CONFIG.bg} rx={3} />

          {/* Unlit dot grid (near-invisible) */}
          <g>{unlitRects}</g>

          {/* Lit dots with phosphor glow */}
          <g filter="url(#vfd-glow)">{litRects}</g>

          {/* Dot-matrix cursor (all 5×8 dots lit, same grid as font) */}
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
            return <g filter="url(#vfd-glow)">{dots}</g>;
          })()}
        </svg>
      </div>
    </AbsoluteFill>
  );
};
