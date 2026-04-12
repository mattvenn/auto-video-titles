import React from 'react';
import {
  AbsoluteFill,
  CalculateMetadataFunction,
  Easing,
  Img,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';
import { z } from 'zod';

// ── Config ────────────────────────────────────────────────────────────────────
const CONFIG = {
  // Screen geometry
  screenW: 1920,
  screenH: 1080,

  // Circle / tablet shape
  circleD: 216,

  // Entry disc
  discScaleEnd:   10,
  discFadeStart:   8,
  discFadeEnd:    26,
  textSlideStart: 24,

  // Text typography
  line1Size:    54,
  line2Size:    34,
  fontFamily:   '"Avenir Next", "Avenir", "Trebuchet MS", Arial, sans-serif',
  textPaddingH: 52,
  lineGap:       8,

  // Character-width factors for tablet sizing
  line1CharW: 0.60,
  line2CharW: 0.54,

  // Colors
  tabletBg:   '#050D1A',
  line1Color: '#FFFFFF',
  line2Color: '#A8C8E8',

  // Entry timing (frames @ 30 fps)
  circleGrowEnd: 8,
  textSlideEnd:  78,   // frame at which text has fully entered

  // Exit timing
  collapseDelay:  3,
  collapseFrames: 7,
  fadeFrames:    15,
  dropFrames:    22,
  dropDistance: 700,

  // Spring parameters
  slideDamping:   18,
  slideStiffness: 150,

  // Sweep highlight
  sweepRotation: -22,  // degrees — tilt to suggest top-right light source
};

// ── Schema & types ────────────────────────────────────────────────────────────
export const z2ATitleBarV2Schema = z.object({
  line1:             z.string(),
  line2:             z.string(),
  // holdFrames is the absolute frame at which hold ends (exit begins).
  // Min 79 keeps it strictly after textSlideEnd (78) so the entry can complete.
  holdFrames:        z.number().int().min(79),
  exitStyle:         z.enum(['fade', 'drop']),
  discStartScale:    z.number().min(1).max(3),
  discRingThickness: z.number().int().min(1).max(40),
  discWhiteRing:     z.number().int().min(0).max(40),
  // Sweep highlight
  highlight:          z.boolean(),
  highlightStart:     z.number().int().min(0),   // frame at which sweep starts
  highlightLength:    z.number().int().min(3),   // duration of sweep in frames (min 3 ensures safe fade ramps)
  highlightIntensity: z.number().int().min(0).max(100),
});

export type Z2ATitleBarV2Props = z.infer<typeof z2ATitleBarV2Schema>;

// ── calculateMetadata ─────────────────────────────────────────────────────────
export const calculateMetadataV2: CalculateMetadataFunction<Z2ATitleBarV2Props> = ({ props }) => {
  const holdEnd    = props.holdFrames;
  const exitFrames = props.exitStyle === 'drop' ? CONFIG.dropFrames : CONFIG.fadeFrames;
  return {
    durationInFrames: holdEnd + CONFIG.collapseDelay + CONFIG.collapseFrames + exitFrames + 5,
  };
};

// ── Component ─────────────────────────────────────────────────────────────────
export const Z2ATitleBarV2: React.FC<Z2ATitleBarV2Props> = ({
  line1,
  line2,
  holdFrames,
  exitStyle,
  discStartScale,
  discRingThickness,
  discWhiteRing,
  highlight,
  highlightStart,
  highlightLength,
  highlightIntensity,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const r       = CONFIG.circleD / 2;
  const holdEnd = holdFrames;
  const isExit  = frame >= holdEnd;

  // ── Exit milestones ───────────────────────────────────────────────────────
  const collapseStart = holdEnd       + CONFIG.collapseDelay;
  const collapseEnd   = collapseStart + CONFIG.collapseFrames;

  // ── Tablet target width ───────────────────────────────────────────────────
  const line1W  = line1.length * CONFIG.line1Size * CONFIG.line1CharW;
  const line2W  = line2.length * CONFIG.line2Size * CONFIG.line2CharW;
  const tabletW = Math.max(line1W, line2W) + CONFIG.textPaddingH * 2;

  // ── Entry: tablet width circleD → tabletW ────────────────────────────────
  const expandFrac = spring({
    frame: frame - CONFIG.circleGrowEnd,
    fps,
    config: { damping: CONFIG.slideDamping, stiffness: CONFIG.slideStiffness },
    from: 0, to: 1,
  });
  const tabletWidthEntry = CONFIG.circleD + expandFrac * (tabletW - CONFIG.circleD);

  // ── Entry: disc eases in large → circleD ─────────────────────────────────
  const discScale = interpolate(
    frame,
    [0, CONFIG.discScaleEnd],
    [discStartScale, 1],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.out(Easing.cubic) },
  );
  const discOpacity = interpolate(
    frame,
    [CONFIG.discFadeStart, CONFIG.discFadeEnd],
    [1, 0],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
  );

  // ── Exit: width tabletW → circleD ────────────────────────────────────────
  const collapseT = interpolate(frame, [collapseStart, collapseEnd], [0, 1], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.out(Easing.cubic),
  });
  const tabletWidthExit = tabletW - collapseT * (tabletW - CONFIG.circleD);
  const currentTabletW  = isExit ? tabletWidthExit : tabletWidthEntry;

  // ── Exit option 1: fade ───────────────────────────────────────────────────
  const fadeOpacity = interpolate(frame, [collapseEnd, collapseEnd + CONFIG.fadeFrames], [1, 0], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
  });

  // ── Exit option 2: drop off screen ───────────────────────────────────────
  const dropY = interpolate(frame, [collapseEnd, collapseEnd + CONFIG.dropFrames], [0, CONFIG.dropDistance], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.in(Easing.quad),
  });
  const dropOpacity = interpolate(
    frame,
    [collapseEnd + CONFIG.dropFrames * 0.6, collapseEnd + CONFIG.dropFrames],
    [1, 0],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
  );

  const exitOpacity    = exitStyle === 'fade' ? fadeOpacity : dropOpacity;
  const exitTranslateY = exitStyle === 'drop' ? dropY : 0;

  // ── Text ──────────────────────────────────────────────────────────────────
  const textEntryFrac = spring({
    frame: frame - CONFIG.textSlideStart,
    fps,
    config: { damping: CONFIG.slideDamping, stiffness: CONFIG.slideStiffness },
    from: 0, to: 1,
  });
  const textEntryY = interpolate(textEntryFrac, [0, 1], [-CONFIG.circleD, 0]);

  const textExitFrac = spring({
    frame: frame - holdEnd,
    fps,
    config: { damping: CONFIG.slideDamping, stiffness: CONFIG.slideStiffness },
    from: 0, to: 1,
  });
  const textExitY = interpolate(textExitFrac, [0, 1], [0, -CONFIG.circleD]);
  const textY = isExit ? textExitY : textEntryY;

  const centerX = CONFIG.screenW / 2;
  const centerY = CONFIG.screenH / 2;
  const discInnerSize = CONFIG.circleD - discRingThickness * 2 - discWhiteRing * 2;

  // ── Sweep highlight ───────────────────────────────────────────────────────
  // sweepFrac 0→1: stripe travels from right-outside the pill to left-outside.
  const sweepFrac = interpolate(
    frame,
    [highlightStart, highlightStart + highlightLength],
    [0, 1],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
  );
  const sweepX = (centerX + currentTabletW / 2 + 120) - sweepFrac * (currentTabletW + 240);

  // Fade the stripe in/out over the first and last 12% of the pass.
  // sweepFrac is always in [0,1] so [0, 0.12, 0.88, 1] is always monotonic.
  const sweepLocalOpacity = interpolate(
    sweepFrac,
    [0, 0.12, 0.88, 1],
    [0, 1, 1, 0],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
  ) * (highlightIntensity / 100) * (isExit ? exitOpacity : 1);

  // Pill geometry in SVG-space (accounts for drop-exit translateY)
  const pillLeft = centerX - currentTabletW / 2;
  const pillTop  = centerY - r + exitTranslateY;

  // Rect is 4× pill height so the rotated band covers top-to-bottom at any angle.
  const sweepRectH     = CONFIG.circleD * 4;
  const sweepRectWidth = 220;

  return (
    <AbsoluteFill style={{ backgroundColor: 'transparent' }}>

      {/* ── Dark tablet (navy pill) ──────────────────────────────────────────── */}
      <div
        style={{
          position:  'absolute',
          top:       centerY - r,
          left:      centerX - currentTabletW / 2,
          transform: `translateY(${exitTranslateY}px)`,
          opacity:   isExit ? exitOpacity : 1,
        }}
      >
        <div
          style={{
            width:           currentTabletW,
            height:          CONFIG.circleD,
            borderRadius:    r,
            backgroundColor: CONFIG.tabletBg,
            position:        'relative',
            overflow:        'hidden',
            boxShadow:       '0 12px 48px rgba(0,0,0,0.6), 0 4px 16px rgba(0,0,0,0.35)',
          }}
        >
          {/* Text slides down on entry, up on exit */}
          <div
            style={{
              position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
              display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center',
              paddingLeft: CONFIG.textPaddingH, paddingRight: CONFIG.textPaddingH,
              transform: `translateY(${textY}px)`,
            }}
          >
            <div style={{
              fontFamily: CONFIG.fontFamily, fontWeight: 700,
              fontSize:   CONFIG.line1Size,  color: CONFIG.line1Color,
              lineHeight: 1.1, whiteSpace: 'nowrap',
            }}>
              {line1}
            </div>
            <div style={{
              fontFamily: CONFIG.fontFamily, fontWeight: 500,
              fontSize:   CONFIG.line2Size,  color: CONFIG.line2Color,
              lineHeight: 1.2, whiteSpace: 'nowrap', marginTop: CONFIG.lineGap,
            }}>
              {line2}
            </div>
          </div>
        </div>
      </div>

      {/* ── Entry disc: white circle + black ring + SVG logo ─────────────────── */}
      {!isExit && (
        <div
          style={{
            position:        'absolute',
            top:             centerY - r,
            left:            centerX - r,
            width:           CONFIG.circleD,
            height:          CONFIG.circleD,
            borderRadius:    '50%',
            backgroundColor: '#FFFFFF',
            border:          `${discRingThickness}px solid #000000`,
            boxSizing:       'border-box' as const,
            overflow:        'hidden',
            display:         'flex',
            alignItems:      'center',
            justifyContent:  'center',
            transform:       `scale(${discScale})`,
            transformOrigin: 'center center',
            opacity:         discOpacity,
          }}
        >
          <Img
            src={staticFile('z2a-logo.svg')}
            style={{ width: discInnerSize, height: discInnerSize, objectFit: 'contain', display: 'block' }}
          />
        </div>
      )}

      {/* ── Sweep highlight SVG overlay ───────────────────────────────────────── */}
      {highlight && (
        <svg
          style={{ position: 'absolute', top: 0, left: 0, pointerEvents: 'none' }}
          width={CONFIG.screenW}
          height={CONFIG.screenH}
          viewBox={`0 0 ${CONFIG.screenW} ${CONFIG.screenH}`}
        >
          <defs>
            {/* Soft-edged bright band along the rect's local x-axis;
                rotation turns it into a diagonal stripe on screen.  */}
            <linearGradient id="hlSweep" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%"   stopColor="#FFFFFF" stopOpacity={0}   />
              <stop offset="35%"  stopColor="#FFFFFF" stopOpacity={0.9} />
              <stop offset="65%"  stopColor="#FFFFFF" stopOpacity={0.9} />
              <stop offset="100%" stopColor="#FFFFFF" stopOpacity={0}   />
            </linearGradient>

            {/* Clip path constrains the stripe to the pill shape */}
            <clipPath id="hlPillClip">
              <rect x={pillLeft} y={pillTop} width={currentTabletW} height={CONFIG.circleD} rx={r} />
            </clipPath>
          </defs>

          {/* Diagonal stripe passes right-to-left across the pill.
              Tall rect ensures full pill coverage at any rotation angle. */}
          <g clipPath="url(#hlPillClip)">
            <rect
              x={sweepX - sweepRectWidth / 2}
              y={centerY + exitTranslateY - sweepRectH / 2}
              width={sweepRectWidth}
              height={sweepRectH}
              fill="url(#hlSweep)"
              transform={`rotate(${CONFIG.sweepRotation}, ${sweepX}, ${centerY + exitTranslateY})`}
              opacity={sweepLocalOpacity}
            />
          </g>
        </svg>
      )}

    </AbsoluteFill>
  );
};
