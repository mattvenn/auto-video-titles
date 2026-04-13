import React from 'react';
import { AbsoluteFill, CalculateMetadataFunction, Img, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import { z } from 'zod';
import { TT_SPRINGS, TT_COLORS, TT_FONT } from './tt-shared';

// ── Config ────────────────────────────────────────────────────────────────────
const CONFIG = {
  // Layout — 1.5× scale
  logoH:   144,
  logoW:   144,
  stripH:  112,  // logo pokes ~16px above and below
  // stripW is calculated dynamically from text content — see below

  // Colors (from shared TT brand tokens)
  stripColor:    TT_COLORS.stripColor,
  textColor:     TT_COLORS.textColor,
  subtitleColor: TT_COLORS.subtitleColor,

  // Typography
  nameSize:    48,
  titleSize:   28,
  fontFamily:  TT_FONT,
  textPadding: 24,

  // Position on screen
  bottom: 60,
  left:   60,

  // Timing (frames @ 30 fps)
  popStart:        5,   // logo pops in
  slideStart:      22,  // logo slides right
  holdEnd:         172, // exit begins
  exitSlideFrames: 35,  // enough frames for the spring to settle
  exitPopFrames:   12,  // logo pops out

  // Spring feel (from shared TT brand tokens)
  ...TT_SPRINGS,
};

export const ttLowerThirdSchema = z.object({
  name:    z.string(),
  title:   z.string().optional(),
  holdEnd: z.number().int().min(1),
});

export type TTLowerThirdProps = z.infer<typeof ttLowerThirdSchema>;

export const calculateMetadata: CalculateMetadataFunction<TTLowerThirdProps> = ({ props }) => ({
  durationInFrames: (props.holdEnd ?? CONFIG.holdEnd) + CONFIG.exitSlideFrames + CONFIG.exitPopFrames,
});

export const TTLowerThird: React.FC<TTLowerThirdProps> = ({
  name,
  title,
  holdEnd,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // When no title, scale name up to fill the vertical space both lines would occupy
  const NAME_LINE_HEIGHT = 1.1;
  const TITLE_LINE_HEIGHT = 1.2;
  const combinedTextH = CONFIG.nameSize * NAME_LINE_HEIGHT + 5 + CONFIG.titleSize * TITLE_LINE_HEIGHT;
  const nameFontSize = title ? CONFIG.nameSize : Math.round(combinedTextH / NAME_LINE_HEIGHT);

  // ── Dynamic strip width — sized to the longest line of text ──────────────
  const longestChars = Math.max(name.length * nameFontSize, (title?.length ?? 0) * CONFIG.titleSize);
  const stripW = Math.round(longestChars * 0.62) + CONFIG.textPadding * 2 + 20;

  const exitSlideEnd = holdEnd + CONFIG.exitSlideFrames;

  // ── Logo X position ───────────────────────────────────────────────────────
  const logoXEntry = spring({
    frame: frame - CONFIG.slideStart,
    fps,
    config: { damping: CONFIG.slideDamping, stiffness: CONFIG.slideStiffness },
    from: 0, to: stripW,
  });
  const logoXExit = spring({
    frame: frame - holdEnd,
    fps,
    config: { damping: CONFIG.exitSlideDamping, stiffness: CONFIG.slideStiffness },
    from: stripW, to: 0,
  });
  // Clamp exit to ≥0 so spring overshoot doesn't push logo off-screen
  const logoX = Math.round(frame < holdEnd ? logoXEntry : Math.max(0, logoXExit));

  // ── Logo scale + opacity ──────────────────────────────────────────────────
  // Entry: spring 0 → 1. Exit: bloom (grow to 1.6×) + fade out.
  const logoScaleRaw = spring({
    frame: frame - CONFIG.popStart,
    fps,
    config: { damping: CONFIG.popDamping, stiffness: CONFIG.popStiffness },
    from: 0, to: 1,
  });
  // Allow overshoot above 1, but once the spring has peaked and is settling back,
  // clamp to ≥1 so it never undershoots below the target size.
  const logoScaleEntry = frame >= CONFIG.popStart + 7 ? Math.max(1, logoScaleRaw) : logoScaleRaw;
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
        {/* ── Strip — grows on entry, shrinks on exit as logoX changes ─────── */}
        <div
          style={{
            position:        'absolute',
            top:             stripTop,
            left:            0,
            width:           Math.max(0, logoX),
            height:          CONFIG.stripH,
            backgroundColor: CONFIG.stripColor,
            boxShadow:       '0 4px 16px rgba(0,0,0,0.28), 0 1px 4px rgba(0,0,0,0.18)',
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
            }}
          >
            <div style={{
              fontFamily: CONFIG.fontFamily,
              fontWeight: 700,
              fontSize:   nameFontSize,
              color:      CONFIG.textColor,
              lineHeight: NAME_LINE_HEIGHT,
              whiteSpace: 'nowrap',
            }}>
              {name}
            </div>
            {title && (
              <div style={{
                fontFamily: CONFIG.fontFamily,
                fontWeight: 600,
                fontSize:   CONFIG.titleSize,
                color:      CONFIG.subtitleColor,
                lineHeight: 1.2,
                whiteSpace: 'nowrap',
                marginTop:  5,
              }}>
                {title}
              </div>
            )}
          </div>
        </div>

        {/* ── Logo — slides right on entry, left on exit, blooms out at end ─── */}
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
            filter:          'drop-shadow(0 6px 20px rgba(0,0,0,0.45)) drop-shadow(0 2px 4px rgba(0,0,0,0.25))',
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
