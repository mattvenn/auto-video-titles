import React from 'react';
import { AbsoluteFill, CalculateMetadataFunction, Img, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import { z } from 'zod';
import { TT_SPRINGS, TT_COLORS, TT_FONT } from './tt-shared';

// ── Config ────────────────────────────────────────────────────────────────────
const CONFIG = {
  // Layout — fills full screen width, 2× scale
  logoH:   260,
  logoW:   260,
  stripH:  220,  // logo pokes ~20px above and below
  // 1920 - left(60) - logo(260) - right margin(40) = 1560
  stripW:  1560,

  // Colors (from shared TT brand tokens)
  stripColor: TT_COLORS.stripColor,
  textColor:  TT_COLORS.textColor,
  line1Color: TT_COLORS.line1Color,
  line2Color: TT_COLORS.line2Color,

  // Typography
  headerSize:  68,
  line1Size:   40,
  line2Size:   32,
  fontFamily:  TT_FONT,
  textPadding: 40,
  lineGap:     10,

  // Position on screen
  bottom: 60,
  left:   60,

  // Timing (frames @ 30 fps)
  popStart:        5,
  slideStart:      22,
  holdEnd:         172,
  exitSlideFrames: 40,  // enough frames for the spring to settle
  exitPopFrames:   8,

  // Spring feel (from shared TT brand tokens)
  ...TT_SPRINGS,
};

export const ttCallToActionSchema = z.object({
  header:  z.string(),
  line1:   z.string(),
  line2:   z.string(),
  holdEnd: z.number().int().min(1),
});

export type TTCallToActionProps = z.infer<typeof ttCallToActionSchema>;

export const calculateMetadata: CalculateMetadataFunction<TTCallToActionProps> = ({ props }) => ({
  durationInFrames: (props.holdEnd ?? CONFIG.holdEnd) + CONFIG.exitSlideFrames + CONFIG.exitPopFrames,
});

export const TTCallToAction: React.FC<TTCallToActionProps> = ({
  header,
  line1,
  line2,
  holdEnd,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const exitSlideEnd = holdEnd + CONFIG.exitSlideFrames;

  // ── Logo X position ───────────────────────────────────────────────────────
  const logoXEntry = spring({
    frame: frame - CONFIG.slideStart,
    fps,
    config: { damping: CONFIG.slideDamping, stiffness: CONFIG.slideStiffness },
    from: 0, to: CONFIG.stripW,
  });
  const logoXExit = spring({
    frame: frame - holdEnd,
    fps,
    config: { damping: CONFIG.exitSlideDamping, stiffness: CONFIG.slideStiffness },
    from: CONFIG.stripW, to: 0,
  });
  const logoX = frame < holdEnd ? logoXEntry : Math.max(0, logoXExit);

  // ── Logo scale + opacity ──────────────────────────────────────────────────
  const logoScaleEntry = spring({
    frame: frame - CONFIG.popStart,
    fps,
    config: { damping: CONFIG.popDamping, stiffness: CONFIG.popStiffness },
    from: 0, to: 1,
  });
  const logoScaleExit = interpolate(
    frame,
    [exitSlideEnd, exitSlideEnd + CONFIG.exitPopFrames],
    [1, 1.6],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
  );
  const logoOpacity = interpolate(
    frame,
    [exitSlideEnd, exitSlideEnd + CONFIG.exitPopFrames],
    [1, 0],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
  );
  const logoScale = frame < exitSlideEnd ? logoScaleEntry : logoScaleExit;

  const stripTop = (CONFIG.logoH - CONFIG.stripH) / 2;

  return (
    <AbsoluteFill style={{ backgroundColor: 'transparent' }}>
      <div
        style={{
          position: 'absolute',
          bottom:   CONFIG.bottom,
          left:     CONFIG.left,
          height:   CONFIG.logoH,
        }}
      >
        {/* ── Strip ──────────────────────────────────────────────────────── */}
        <div
          style={{
            position:        'absolute',
            top:             stripTop,
            left:            0,
            width:           Math.max(0, logoX),
            height:          CONFIG.stripH,
            backgroundColor: CONFIG.stripColor,
            boxShadow:       '0 6px 24px rgba(0,0,0,0.28), 0 2px 6px rgba(0,0,0,0.18)',
            overflow:        'hidden',
          }}
        >
          <div
            style={{
              paddingLeft:    CONFIG.textPadding,
              paddingRight:   CONFIG.textPadding,
              height:         '100%',
              display:        'flex',
              flexDirection:  'column',
              justifyContent: 'center',
              gap:            CONFIG.lineGap,
            }}
          >
            <div style={{
              fontFamily: CONFIG.fontFamily,
              fontWeight: 800,
              fontSize:   CONFIG.headerSize,
              color:      CONFIG.textColor,
              lineHeight: 1.0,
              whiteSpace: 'nowrap',
            }}>
              {header}
            </div>
            <div style={{
              fontFamily: CONFIG.fontFamily,
              fontWeight: 600,
              fontSize:   CONFIG.line1Size,
              color:      CONFIG.line1Color,
              lineHeight: 1.1,
              whiteSpace: 'nowrap',
            }}>
              {line1}
            </div>
            <div style={{
              fontFamily: CONFIG.fontFamily,
              fontWeight: 600,
              fontSize:   CONFIG.line2Size,
              color:      CONFIG.line2Color,
              lineHeight: 1.1,
              whiteSpace: 'nowrap',
            }}>
              {line2}
            </div>
          </div>
        </div>

        {/* ── Logo ───────────────────────────────────────────────────────── */}
        <div
          style={{
            position:        'absolute',
            top:             0,
            left:            logoX,
            width:           CONFIG.logoW,
            height:          CONFIG.logoH,
            opacity:         logoOpacity,
            transform:       `scale(${logoScale})`,
            transformOrigin: 'center center',
            filter:          'drop-shadow(0 8px 24px rgba(0,0,0,0.45)) drop-shadow(0 2px 6px rgba(0,0,0,0.25))',
          }}
        >
          <Img
            src={staticFile('tt_logo.png')}
            style={{ width: CONFIG.logoW, height: CONFIG.logoH, display: 'block' }}
          />
        </div>
      </div>
    </AbsoluteFill>
  );
};
