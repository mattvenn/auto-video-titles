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
  circleD: 216,   // 1/5 of screen height

  // Entry disc (white circle + black ring + black SVG logo)
  discStartScale:    1.5,   // disc starts this much bigger than circleD
  discRingThickness: 10,    // black ring border — matches visual stroke weight of letters
  discScaleEnd:      10,    // frame where disc scale settles to 1
  discFadeStart:     8,    // disc starts fading
  discFadeEnd:       26,    // frame where disc is fully gone
  textSlideStart:    24,    // text starts sliding in while disc is still just visible

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

  // ── Entry timing (frames @ 30 fps) ───────────────────────────────────────
  circleGrowEnd: 8,    // dark tablet dot spring settles
  textSlideEnd:  78,   // text fully slid into slot

  // ── Exit timing (offsets from holdEnd) ───────────────────────────────────
  collapseDelay:  3,   // overlaps with text exit
  collapseFrames: 7,   // tablet → circle

  // Option 1: fade out
  fadeFrames: 15,

  // Option 3: drop off screen
  dropFrames:   22,
  dropDistance: 700,

  // Default hold duration
  defaultHoldFrames: 30,

  // Spring parameters
  slideDamping:   18,
  slideStiffness: 150,
};

// ── Schema & types ────────────────────────────────────────────────────────────
export const z2ATitleBarSchema = z.object({
  line1:             z.string(),
  line2:             z.string(),
  holdFrames:        z.number().int().min(1),
  exitStyle:         z.enum(['fade', 'drop']),
  discStartScale:    z.number().min(1).max(3),
  discRingThickness: z.number().int().min(1).max(40),
  discWhiteRing:     z.number().int().min(0).max(40),
});

export type Z2ATitleBarProps = z.infer<typeof z2ATitleBarSchema>;

// ── calculateMetadata ─────────────────────────────────────────────────────────
export const calculateMetadata: CalculateMetadataFunction<Z2ATitleBarProps> = ({ props }) => {
  const holdFrames = props.holdFrames ?? CONFIG.defaultHoldFrames;
  const holdEnd    = CONFIG.textSlideEnd + holdFrames;
  const exitFrames = props.exitStyle === 'drop' ? CONFIG.dropFrames : CONFIG.fadeFrames;
  return {
    durationInFrames: holdEnd + CONFIG.collapseDelay + CONFIG.collapseFrames + exitFrames + 5,
  };
};

// ── Component ─────────────────────────────────────────────────────────────────
export const Z2ATitleBar: React.FC<Z2ATitleBarProps> = ({
  line1,
  line2,
  holdFrames,
  exitStyle,
  discStartScale,
  discRingThickness,
  discWhiteRing,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const r       = CONFIG.circleD / 2;
  const holdEnd = CONFIG.textSlideEnd + holdFrames;
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

  // ── Entry: white disc eases in large → circleD (no overshoot) ───────────
  const discScale = interpolate(
    frame,
    [0, CONFIG.discScaleEnd],
    [discStartScale, 1],
    {
      extrapolateLeft:  'clamp',
      extrapolateRight: 'clamp',
      easing: Easing.out(Easing.cubic),
    },
  );

  // Disc fades out as the tablet expands to reveal the dark background
  const discOpacity = interpolate(
    frame,
    [CONFIG.discFadeStart, CONFIG.discFadeEnd],
    [1, 0],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
  );

  // ── Exit: width tabletW → circleD ────────────────────────────────────────
  const collapseT = interpolate(frame, [collapseStart, collapseEnd], [0, 1], {
    extrapolateLeft:  'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.out(Easing.cubic),
  });
  const tabletWidthExit = tabletW - collapseT * (tabletW - CONFIG.circleD);

  const currentTabletW = isExit ? tabletWidthExit : tabletWidthEntry;

  // ── Exit option 1: fade ───────────────────────────────────────────────────
  const fadeOpacity = interpolate(frame, [collapseEnd, collapseEnd + CONFIG.fadeFrames], [1, 0], {
    extrapolateLeft:  'clamp',
    extrapolateRight: 'clamp',
  });

  // ── Exit option 3: drop off screen ───────────────────────────────────────
  const dropY = interpolate(frame, [collapseEnd, collapseEnd + CONFIG.dropFrames], [0, CONFIG.dropDistance], {
    extrapolateLeft:  'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.in(Easing.quad),
  });
  const dropOpacity = interpolate(
    frame,
    [collapseEnd + CONFIG.dropFrames * 0.6, collapseEnd + CONFIG.dropFrames],
    [1, 0],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
  );

  const exitOpacity    = exitStyle === 'fade' ? fadeOpacity : dropOpacity;
  const exitTranslateY = exitStyle === 'drop' ? dropY       : 0;

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

  // Inner logo size — fits inside the ring
  const discInnerSize = CONFIG.circleD - discRingThickness * 2 - discWhiteRing * 2;

  return (
    <AbsoluteFill style={{ backgroundColor: 'transparent' }}>

      {/* ── Dark tablet (navy pill / circle) ──────────────────────────────── */}
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
          {/* ── Text (slides down on entry, up on exit) ─────────────────── */}
          <div
            style={{
              position:       'absolute',
              top:            0,
              left:           0,
              right:          0,
              bottom:         0,
              display:        'flex',
              flexDirection:  'column',
              alignItems:     'center',
              justifyContent: 'center',
              paddingLeft:    CONFIG.textPaddingH,
              paddingRight:   CONFIG.textPaddingH,
              transform:      `translateY(${textY}px)`,
            }}
          >
            <div style={{
              fontFamily: CONFIG.fontFamily,
              fontWeight: 700,
              fontSize:   CONFIG.line1Size,
              color:      CONFIG.line1Color,
              lineHeight: 1.1,
              whiteSpace: 'nowrap',
            }}>
              {line1}
            </div>
            <div style={{
              fontFamily: CONFIG.fontFamily,
              fontWeight: 500,
              fontSize:   CONFIG.line2Size,
              color:      CONFIG.line2Color,
              lineHeight: 1.2,
              whiteSpace: 'nowrap',
              marginTop:  CONFIG.lineGap,
            }}>
              {line2}
            </div>
          </div>
        </div>
      </div>

      {/* ── Entry disc: white circle + black ring + black SVG logo ────────── */}
      {/* Rendered on top of the tablet, fades out as tablet expands.         */}
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
            style={{
              width:     discInnerSize,
              height:    discInnerSize,
              objectFit: 'contain',
              display:   'block',
            }}
          />
        </div>
      )}

    </AbsoluteFill>
  );
};
