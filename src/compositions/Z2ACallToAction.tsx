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
  OffthreadVideo,
} from 'remotion';
import { z } from 'zod';
import { BACKGROUND_VIDEOS } from './video-list';

// ── Config ────────────────────────────────────────────────────────────────────
const CONFIG = {
  screenW: 1920,
  screenH: 1080,

  // Pill is 50% taller than Z2ATitleBarV2 (216 → 324)
  circleD: 324,

  // Fixed 90% screen width
  tabletW: Math.round(1920 * 0.9),   // 1728

  // Bottom anchor: pill sits 80px above bottom edge
  bottomMargin: 80,

  // Entry disc
  discScaleEnd:   8,
  discFadeStart:  8,
  discFadeEnd:   26,
  textSlideStart: 24,

  // Text typography
  headerSize: 56,
  line1Size:  40,
  line2Size:  30,
  fontFamily: '"Avenir Next", "Avenir", "Trebuchet MS", Arial, sans-serif',
  textPaddingH: 72,
  lineGap: 10,

  // Colors
  tabletBg:     '#050D1A',
  headerColor:  '#FFFFFF',
  line1Color:   '#A8C8E8',
  line2Color:   '#6EA4C8',

  // Entry timing
  circleGrowEnd: 8,
  textSlideEnd:  78,

  // Exit timing
  collapseDelay:  3,
  collapseFrames: 9,
  fadeFrames:    15,
  dropFrames:    14,
  dropDistance: 700,

  // Spring parameters
  slideDamping:   18,
  slideStiffness: 150,

  // Sweep highlight
  sweepRotation: -22,
};

// ── Schema & types ────────────────────────────────────────────────────────────
export const z2ACallToActionSchema = z.object({
  header:  z.string(),
  line1:   z.string(),
  line2:   z.string(),
  holdFrames:        z.number().int().min(79),
  exitStyle:         z.enum(['fade', 'drop']),
  discStartScale:    z.number().min(1).max(3),
  discRingThickness: z.number().int().min(1).max(40),
  discWhiteRing:     z.number().int().min(0).max(40),
  highlight:          z.boolean(),
  highlightStart:     z.number().int().min(0),
  highlightLength:    z.number().int().min(3),
  highlightIntensity: z.number().int().min(0).max(100),
  showBackground:       z.boolean(),
  backgroundVideo:      z.enum(BACKGROUND_VIDEOS).default('microchip-background-h264.mp4'),
  backgroundZoom:       z.number().min(100).max(400).default(120),
  videoStartFrom:       z.number().int().min(0).max(3000),
  videoSpeed:           z.number().int().min(-100).max(100).default(0),
});

export type Z2ACallToActionProps = z.infer<typeof z2ACallToActionSchema>;

// ── calculateMetadata ─────────────────────────────────────────────────────────
const INTRO_ANIM_DELAY = 10;

export const calculateMetadata: CalculateMetadataFunction<Z2ACallToActionProps> = ({ props }) => {
  const exitFrames = props.exitStyle === 'drop' ? CONFIG.dropFrames : CONFIG.fadeFrames;
  const delay      = props.showBackground ? INTRO_ANIM_DELAY : 0;
  return {
    durationInFrames: props.holdFrames + CONFIG.collapseDelay + CONFIG.collapseFrames + exitFrames + 5 + delay,
  };
};

// ── Component ─────────────────────────────────────────────────────────────────
export const Z2ACallToAction: React.FC<Z2ACallToActionProps> = ({
  header,
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
  showBackground,
  backgroundVideo,
  backgroundZoom,
  videoStartFrom,
  videoSpeed,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const animFrame = frame - (showBackground ? INTRO_ANIM_DELAY : 0);

  const r       = CONFIG.circleD / 2;
  const holdEnd = holdFrames;
  const isExit  = animFrame >= holdEnd;

  // ── Vertical position ─────────────────────────────────────────────────────
  // Center the pill: bottom edge sits CONFIG.bottomMargin above screen bottom
  const centerX = CONFIG.screenW / 2;
  const centerY = CONFIG.screenH - CONFIG.bottomMargin - r;

  // ── Exit milestones ───────────────────────────────────────────────────────
  const collapseStart = holdEnd       + CONFIG.collapseDelay;
  const collapseEnd   = collapseStart + CONFIG.collapseFrames;

  // ── Entry: tablet width circleD → tabletW ────────────────────────────────
  const expandFrac = spring({
    frame: animFrame - CONFIG.circleGrowEnd,
    fps,
    config: { damping: CONFIG.slideDamping, stiffness: CONFIG.slideStiffness },
    from: 0, to: 1,
  });
  const tabletWidthEntry = CONFIG.circleD + expandFrac * (CONFIG.tabletW - CONFIG.circleD);

  // ── Entry: disc eases in large → circleD ─────────────────────────────────
  const discScale = interpolate(
    animFrame,
    [0, CONFIG.discScaleEnd],
    [discStartScale, 1],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.out(Easing.cubic) },
  );
  const discOpacity = interpolate(
    animFrame,
    [CONFIG.discFadeStart, CONFIG.discFadeEnd],
    [1, 0],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
  );

  // ── Exit: width tabletW → circleD ────────────────────────────────────────
  const collapseT = interpolate(animFrame, [collapseStart, collapseEnd], [0, 1], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.out(Easing.cubic),
  });
  const tabletWidthExit = CONFIG.tabletW - collapseT * (CONFIG.tabletW - CONFIG.circleD);
  const currentTabletW  = isExit ? tabletWidthExit : tabletWidthEntry;

  // ── Exit option 1: fade ───────────────────────────────────────────────────
  const fadeOpacity = interpolate(animFrame, [collapseEnd, collapseEnd + CONFIG.fadeFrames], [1, 0], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
  });

  // ── Exit option 2: drop off screen ───────────────────────────────────────
  const dropY = interpolate(animFrame, [collapseEnd, collapseEnd + CONFIG.dropFrames], [0, CONFIG.dropDistance], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.in(Easing.quad),
  });
  const dropOpacity = interpolate(
    animFrame,
    [collapseEnd + CONFIG.dropFrames * 0.6, collapseEnd + CONFIG.dropFrames],
    [1, 0],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
  );

  const exitOpacity    = exitStyle === 'fade' ? fadeOpacity : dropOpacity;
  const exitTranslateY = exitStyle === 'drop' ? dropY : 0;

  // ── Text slide in/out ─────────────────────────────────────────────────────
  const textEntryFrac = spring({
    frame: animFrame - CONFIG.textSlideStart,
    fps,
    config: { damping: CONFIG.slideDamping, stiffness: CONFIG.slideStiffness },
    from: 0, to: 1,
  });
  const textEntryY = interpolate(textEntryFrac, [0, 1], [-CONFIG.circleD, 0]);

  const textExitFrac = spring({
    frame: animFrame - holdEnd,
    fps,
    config: { damping: CONFIG.slideDamping, stiffness: CONFIG.slideStiffness },
    from: 0, to: 1,
  });
  const textExitY = interpolate(textExitFrac, [0, 1], [0, -CONFIG.circleD]);
  const textY = isExit ? textExitY : textEntryY;

  const discInnerSize = CONFIG.circleD - discRingThickness * 2 - discWhiteRing * 2;

  // ── Sweep highlight ───────────────────────────────────────────────────────
  const sweepFrac = interpolate(
    animFrame,
    [highlightStart, highlightStart + highlightLength],
    [0, 1],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
  );
  const sweepX = (centerX + currentTabletW / 2 + 120) - sweepFrac * (currentTabletW + 240);

  const sweepLocalOpacity = interpolate(
    sweepFrac,
    [0, 0.12, 0.88, 1],
    [0, 1, 1, 0],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
  ) * (highlightIntensity / 100) * (isExit ? exitOpacity : 1);

  const pillLeft = centerX - currentTabletW / 2;
  const pillTop  = centerY - r + exitTranslateY;
  const sweepRectH     = CONFIG.circleD * 4;
  const sweepRectWidth = 220;

  return (
    <AbsoluteFill style={{ backgroundColor: 'transparent' }}>

      {/* ── Optional background video ─────────────────────────────────────── */}
      {showBackground && (
        <div style={{ position: 'absolute', inset: 0 }}>
          <OffthreadVideo
            src={staticFile(backgroundVideo)}
            startFrom={videoStartFrom}
            playbackRate={1 + (videoSpeed / 100) * 0.2}
            delayRenderTimeoutInMilliseconds={60000}
            style={{
              width:           '100%',
              height:          '100%',
              objectFit:       'cover',
              transform:       `scale(${backgroundZoom / 100})`,
              transformOrigin: 'center center',
            }}
          />
        </div>
      )}

      {animFrame >= 0 && <>

      {/* ── Dark tablet (navy pill) ───────────────────────────────────────── */}
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
              fontFamily: CONFIG.fontFamily, fontWeight: 800,
              fontSize:   CONFIG.headerSize, color: CONFIG.headerColor,
              lineHeight: 1.1, whiteSpace: 'nowrap',
            }}>
              {header}
            </div>
            <div style={{
              fontFamily: CONFIG.fontFamily, fontWeight: 600,
              fontSize:   CONFIG.line1Size,  color: CONFIG.line1Color,
              lineHeight: 1.2, whiteSpace: 'nowrap', marginTop: CONFIG.lineGap,
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

      {/* ── Entry disc: white circle + black ring + SVG logo ─────────────── */}
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

      {/* ── Sweep highlight SVG overlay ───────────────────────────────────── */}
      {highlight && (
        <svg
          style={{ position: 'absolute', top: 0, left: 0, pointerEvents: 'none' }}
          width={CONFIG.screenW}
          height={CONFIG.screenH}
          viewBox={`0 0 ${CONFIG.screenW} ${CONFIG.screenH}`}
        >
          <defs>
            <linearGradient id="ctaSweep" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%"   stopColor="#FFFFFF" stopOpacity={0}   />
              <stop offset="35%"  stopColor="#FFFFFF" stopOpacity={0.9} />
              <stop offset="65%"  stopColor="#FFFFFF" stopOpacity={0.9} />
              <stop offset="100%" stopColor="#FFFFFF" stopOpacity={0}   />
            </linearGradient>
            <clipPath id="ctaPillClip">
              <rect x={pillLeft} y={pillTop} width={currentTabletW} height={CONFIG.circleD} rx={r} />
            </clipPath>
          </defs>
          <g clipPath="url(#ctaPillClip)">
            <rect
              x={sweepX - sweepRectWidth / 2}
              y={centerY + exitTranslateY - sweepRectH / 2}
              width={sweepRectWidth}
              height={sweepRectH}
              fill="url(#ctaSweep)"
              transform={`rotate(${CONFIG.sweepRotation}, ${sweepX}, ${centerY + exitTranslateY})`}
              opacity={sweepLocalOpacity}
            />
          </g>
        </svg>
      )}

      </> /* end animFrame >= 0 gate */}

    </AbsoluteFill>
  );
};
