import React from 'react';
import {
  AbsoluteFill,
  CalculateMetadataFunction,
  Easing,
  interpolate,
  useCurrentFrame,
} from 'remotion';
import { z } from 'zod';

// ── Config (non-prop tunables) ────────────────────────────────────────────────
const HOLD_START = 50;   // frame by which all entry animations are complete

const CONFIG = {
  ringThickness:  18,

  // 0° = 12 o'clock; subtract 90° to convert to SVG/screen coords where 0° = 3 o'clock
  angleOffset: -90,

  // Circle entry: scales from entryScale → 1, fades 0 → 1
  circleEntryScale: 2.5,
  circleScaleStart: 0,
  circleScaleEnd:  10,

  // Extra pixels the line path extends into the ring and pill to hide shadow fringe
  lineOverlap: 4,

  // All entry animations complete by frame ~45 → HOLD_START = 50
  // Line starts only after circle is fully scaled in (circleScaleEnd = 10)
  lineGrowStart:  10,
  lineGrowEnd:    20,
  pillGrowStart:  18,
  pillGrowEnd:    45,
  textSlideAt:     0.70, // pill-progress at which text begins sliding in

  fadeFrames: 15,

  // Defaults
  defaultLineLength:  120,
  defaultAngle:        45,   // 45° = lower-right in clock convention (between 3 and 6)
  defaultHoldFrames:   90,
  defaultCircleSize:  216,
  defaultPillHeight:  216,

  // Pill typography — absolute values for pillHeight=216; scale proportionally for other heights
  pillPaddingH:  52,
  pillFontSize:  54,
  textCharW:     0.60,
  refPillHeight: 216,
  fontFamily:    '"Avenir Next", "Avenir", "Trebuchet MS", Arial, sans-serif',
  fontWeight:    700 as const,

  // Colors (normal)
  pillBg:    '#050D1A',
  lineColor: '#000000',
  textColor: '#FFFFFF',
  ringColor: '#000000',

  // Colors (inverted)
  pillBgInv:    '#FFFFFF',
  lineColorInv: '#FFFFFF',
  textColorInv: '#000000',
  ringColorInv: '#FFFFFF',

  shadow: 'drop-shadow(0px 12px 48px rgba(0,0,0,0.6)) drop-shadow(0px 4px 16px rgba(0,0,0,0.35))',
};

// ── Schema ────────────────────────────────────────────────────────────────────
export const z2ACalloutSchema = z.object({
  text:        z.string(),
  cx:          z.number().int(),
  cy:          z.number().int(),
  angle:       z.number().min(0).max(359),
  lineLength:  z.number().int().min(20).max(500),
  holdFrames:  z.number().int().min(1),
  circleSize:  z.number().int().min(50).max(500),
  pillHeight:  z.number().int().min(50).max(500),
  invert:      z.boolean().default(false),
});

export type Z2ACalloutProps = z.infer<typeof z2ACalloutSchema>;

// ── calculateMetadata ─────────────────────────────────────────────────────────
export const calculateMetadata: CalculateMetadataFunction<Z2ACalloutProps> = ({ props }) => ({
  durationInFrames: HOLD_START + props.holdFrames + CONFIG.fadeFrames + 5,
});

// ── Component ─────────────────────────────────────────────────────────────────
export const Z2ACallout: React.FC<Z2ACalloutProps> = ({
  text,
  cx,
  cy,
  angle      = CONFIG.defaultAngle,
  lineLength = CONFIG.defaultLineLength,
  holdFrames = CONFIG.defaultHoldFrames,
  circleSize = CONFIG.defaultCircleSize,
  pillHeight = CONFIG.defaultPillHeight,
  invert     = false,
}) => {
  const pillBg    = invert ? CONFIG.pillBgInv    : CONFIG.pillBg;
  const lineColor = invert ? CONFIG.lineColorInv : CONFIG.lineColor;
  const textColor = invert ? CONFIG.textColorInv : CONFIG.textColor;
  const ringColor = invert ? CONFIG.ringColorInv : CONFIG.ringColor;
  const frame = useCurrentFrame();

  // ── Derived geometry ───────────────────────────────────────────────────────
  // cx/cy are offsets from screen centre (960, 540)
  const screenCx = 960 + cx;
  const screenCy = 540 + cy;

  const outerR      = circleSize / 2;
  const ringCenterR = outerR - CONFIG.ringThickness / 2;
  const pillRx      = pillHeight / 2;

  // 0° = 12 o'clock (top), clockwise. Convert to SVG coords (0° = 3 o'clock) by subtracting 90°.
  const angleRad = ((angle + CONFIG.angleOffset) * Math.PI) / 180;
  // angle < 180 → right-half of clock face → horizontal line + pill go right
  // angle >= 180 → left-half → no horizontal line, pill goes left
  const isRight  = angle < 180;

  // Font ≈ 70% of pill height; padding scales with font size
  const pillFontSize = Math.round(pillHeight * 0.70);
  const pillPaddingH = Math.round(CONFIG.pillPaddingH * (pillHeight / CONFIG.refPillHeight));

  // Angled line: ring outer edge → lineEnd
  const lineStartX = screenCx + outerR * Math.cos(angleRad);
  const lineStartY = screenCy + outerR * Math.sin(angleRad);
  const lineEndX   = lineStartX + lineLength * Math.cos(angleRad);
  const lineEndY   = lineStartY + lineLength * Math.sin(angleRad);

  // Horizontal extension: right for angle < 180, left for angle >= 180 — always drawn
  const hLineEndX  = lineEndX + (isRight ? lineLength : -lineLength);
  const hLineEndY  = lineEndY;

  // Pill anchor = end of horizontal line (always)
  const pillAnchorX = hLineEndX;
  const pillAnchorY = hLineEndY;

  const pillTextW = text.length * pillFontSize * CONFIG.textCharW;
  const pillW     = pillTextW + pillPaddingH * 2;

  // Path extends overlap pixels into the ring (start) and pill (end) to hide shadow fringe.
  // The ring and pill are redrawn without shadow on top, masking the overlap.
  const ov = CONFIG.lineOverlap;
  const pathStartX = lineStartX - ov * Math.cos(angleRad);
  const pathStartY = lineStartY - ov * Math.sin(angleRad);
  const pathEndX   = hLineEndX + (isRight ? ov : -ov);
  const pathEndY   = hLineEndY;
  const totalPathLen = lineLength * 2 + ov * 2;
  const linePath = `M${pathStartX},${pathStartY} L${lineEndX},${lineEndY} L${pathEndX},${pathEndY}`;

  // ── Circle entry: scales from large → target, fades in ───────────────────
  const circleScale = interpolate(frame, [CONFIG.circleScaleStart, CONFIG.circleScaleEnd], [CONFIG.circleEntryScale, 1], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
    easing: Easing.out(Easing.cubic),
  });
  const circleOpacity = interpolate(frame, [CONFIG.circleScaleStart, CONFIG.circleScaleEnd], [0, 1], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
  });

  // ── Line draws on (no overshoot — interpolate not spring) ─────────────────
  const lineProgress = interpolate(frame, [CONFIG.lineGrowStart, CONFIG.lineGrowEnd], [0, 1], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
    easing: Easing.out(Easing.quad),
  });

  // ── Pill grows (no overshoot) ──────────────────────────────────────────────
  const pillProgress = interpolate(frame, [CONFIG.pillGrowStart, CONFIG.pillGrowEnd], [0, 1], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
    easing: Easing.out(Easing.cubic),
  });
  const currentPillW  = pillW * pillProgress;
  // rx clamped so browser doesn't need to — keeps shape predictable at small widths
  const currentPillRx = Math.min(pillRx, currentPillW / 2);

  // Pill rect: full capsule (both ends rounded), anchored at pillAnchor
  const pillRectX = isRight ? pillAnchorX : pillAnchorX - currentPillW;
  const pillRectY = pillAnchorY - pillHeight / 2;

  // ── Text slides in from below (Z2ATitleBar style) ─────────────────────────
  // Outer div: overflow:hidden clips the inner div as it rises.
  const textSlideY = interpolate(pillProgress, [CONFIG.textSlideAt, 1.0], [pillHeight, 0], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
    easing: Easing.out(Easing.cubic),
  });

  // ── Exit ──────────────────────────────────────────────────────────────────
  const holdEnd = HOLD_START + holdFrames;
  const exitOpacity = interpolate(frame, [holdEnd, holdEnd + CONFIG.fadeFrames], [1, 0], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
  });
  const masterOpacity = frame >= holdEnd ? exitOpacity : 1;

  return (
    <AbsoluteFill style={{ backgroundColor: 'transparent' }}>

      <svg
        width={1920} height={1080} viewBox="0 0 1920 1080"
        overflow="visible"
        style={{ position: 'absolute', top: 0, left: 0, opacity: masterOpacity }}
      >
        {/* Shadow layer — drawn before lines so shadows never paint over them */}
        <circle
          cx={screenCx} cy={screenCy} r={ringCenterR * circleScale}
          fill="none"
          stroke={ringColor}
          strokeWidth={CONFIG.ringThickness * circleScale}
          opacity={circleOpacity}
          style={{ filter: CONFIG.shadow }}
        />
        {currentPillW > 0 && (
          <rect
            x={pillRectX} y={pillRectY}
            width={currentPillW} height={pillHeight}
            rx={currentPillRx} ry={currentPillRx}
            fill={pillBg}
            style={{ filter: CONFIG.shadow }}
          />
        )}

        {/* Continuous line: single path + single dashoffset, no gap at corner */}
        <path
          d={linePath}
          fill="none"
          stroke={lineColor}
          strokeWidth={CONFIG.ringThickness}
          strokeLinejoin="miter"
          strokeMiterlimit={10}
          strokeLinecap="butt"
          strokeDasharray={totalPathLen}
          strokeDashoffset={totalPathLen * (1 - lineProgress)}
        />

        {/* Ring and pill redrawn without shadow — sit above lines, covering shadow fill */}
        <circle
          cx={screenCx} cy={screenCy} r={ringCenterR * circleScale}
          fill="none"
          stroke={ringColor}
          strokeWidth={CONFIG.ringThickness * circleScale}
          opacity={circleOpacity}
        />
        {currentPillW > 0 && (
          <rect
            x={pillRectX} y={pillRectY}
            width={currentPillW} height={pillHeight}
            rx={currentPillRx} ry={currentPillRx}
            fill={pillBg}
          />
        )}
      </svg>

      {/* Text: overflow:hidden container clips the slide-in, matching Z2ATitleBar */}
      <div style={{
        position:      'absolute',
        left:          isRight ? pillAnchorX : pillAnchorX - pillW,
        top:           pillAnchorY - pillHeight / 2,
        width:         pillW,
        height:        pillHeight,
        overflow:      'hidden',
        opacity:       masterOpacity,
        pointerEvents: 'none',
      }}>
        <div style={{
          width:           '100%',
          height:          '100%',
          display:         'flex',
          alignItems:      'center',
          justifyContent:  'center',
          transform:       `translateY(${textSlideY}px)`,
        }}>
          <span style={{
            fontFamily: CONFIG.fontFamily,
            fontWeight: CONFIG.fontWeight,
            fontSize:   pillFontSize,
            color:      textColor,
            whiteSpace: 'nowrap',
          }}>
            {text}
          </span>
        </div>
      </div>

    </AbsoluteFill>
  );
};
