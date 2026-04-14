import React from 'react';
import { AbsoluteFill, CalculateMetadataFunction, Img, OffthreadVideo, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import { z } from 'zod';
import { TT_SPRINGS, TT_COLORS, TT_FONT } from './tt-shared';

// ── Config ────────────────────────────────────────────────────────────────────
const CONFIG = {
  // Layout — logo + strip centered, all 1.5× the TTCallToAction scale
  logoH:  300,
  logoW:  300,
  stripH: 240,  // logo pokes 30px above and below
  stripW: 1400,

  // Colors (from shared TT brand tokens)
  stripColor: TT_COLORS.stripColor,
  textColor:  TT_COLORS.textColor,

  // Typography — maxFontSize caps the size; actual size is computed per-text
  maxFontSize: 108,
  fontFamily:  TT_FONT,
  textPadding: 60,

  // Timing (frames @ 30 fps)
  popStart:        5,
  slideStart:      22,
  exitSlideFrames: 35,
  exitPopFrames:   12,
  fadeDuration:    6,   // fade from/to black at start and end

  // Spring feel (from shared TT brand tokens)
  ...TT_SPRINGS,
};

export const ttTopicCardSchema = z.object({
  text:             z.string(),
  holdEnd:          z.number().int().min(1),
  vignetteStrength: z.number().int().min(0).max(100),
});

export type TTTopicCardProps = z.infer<typeof ttTopicCardSchema>;

export const calculateMetadata: CalculateMetadataFunction<TTTopicCardProps> = ({ props }) => ({
  // Total = holdEnd + exitSlideFrames + exitPopFrames
  // Default holdEnd=115 → 115 + 35 + 12 = 162 frames = 5s 12f @ 30fps
  durationInFrames: props.holdEnd + CONFIG.exitSlideFrames + CONFIG.exitPopFrames,
});

export const TTTopicCard: React.FC<TTTopicCardProps> = ({ text, holdEnd, vignetteStrength }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const totalDuration = holdEnd + CONFIG.exitSlideFrames + CONFIG.exitPopFrames;
  const exitSlideEnd  = holdEnd + CONFIG.exitSlideFrames;

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
  const logoX = Math.round(frame < holdEnd ? logoXEntry : Math.max(0, logoXExit));

  // ── Logo scale + opacity ──────────────────────────────────────────────────
  const logoScaleRaw = spring({
    frame: frame - CONFIG.popStart,
    fps,
    config: { damping: CONFIG.popDamping, stiffness: CONFIG.popStiffness },
    from: 0, to: 1,
  });
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

  // ── Black fade in / out ───────────────────────────────────────────────────
  const fadeIn  = interpolate(frame, [0, CONFIG.fadeDuration], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const fadeOut = interpolate(frame, [totalDuration - CONFIG.fadeDuration, totalDuration], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const blackOpacity = Math.max(fadeIn, fadeOut);

  // Font size: scale down if text would overflow the strip
  const availableWidth = CONFIG.stripW - CONFIG.textPadding * 2;
  const fontSize = Math.min(CONFIG.maxFontSize, Math.floor(availableWidth / ((text.length + 1) * 0.58)));

  const stripTop      = (CONFIG.logoH - CONFIG.stripH) / 2;
  const containerLeft = (1920 - CONFIG.stripW - CONFIG.logoW) / 2;
  const containerTop  = (1080 - CONFIG.logoH) / 2;

  return (
    <AbsoluteFill style={{ backgroundColor: 'transparent', overflow: 'hidden' }}>

      {/* ── Animated background ─────────────────────────────────────────── */}
      <OffthreadVideo
        src={staticFile('tt_card_background.mp4')}
        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
      />

      {/* ── Vignette overlay ────────────────────────────────────────────── */}
      <div
        style={{
          position:      'absolute',
          inset:         0,
          background:    `radial-gradient(ellipse at center, transparent 20%, rgba(0,0,0,${vignetteStrength / 100}) 100%)`,
          pointerEvents: 'none',
        }}
      />

      {/* ── Centered logo + strip group ─────────────────────────────────── */}
      <div
        style={{
          position: 'absolute',
          top:      containerTop,
          left:     containerLeft,
          height:   CONFIG.logoH,
        }}
      >
        {/* ── Strip — grows as logoX moves right ──────────────────────── */}
        <div
          style={{
            position:        'absolute',
            top:             stripTop,
            left:            0,
            width:           Math.max(0, logoX),
            height:          CONFIG.stripH,
            backgroundColor: CONFIG.stripColor,
            boxShadow:       '0 6px 24px rgba(0,0,0,0.32), 0 2px 6px rgba(0,0,0,0.18)',
            overflow:        'hidden',
          }}
        >
          <div
            style={{
              paddingLeft:    CONFIG.textPadding,
              paddingRight:   CONFIG.textPadding,
              height:         '100%',
              display:        'flex',
              alignItems:     'center',
            }}
          >
            <div style={{
              fontFamily: CONFIG.fontFamily,
              fontWeight: 800,
              fontSize:   fontSize,
              color:      CONFIG.textColor,
              whiteSpace: 'nowrap',
            }}>
              {text}
            </div>
          </div>
        </div>

        {/* ── Logo — pops in, slides right, blooms out at end ─────────── */}
        {/* Outer div handles position/scale/opacity; inner div scopes the
            drop-shadow filter so it cannot bleed to the canvas edges.       */}
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
          }}
        >
          <div style={{ filter: 'drop-shadow(0 8px 24px rgba(0,0,0,0.45)) drop-shadow(0 2px 6px rgba(0,0,0,0.25))' }}>
            <Img
              src={staticFile('tt_logo.png')}
              style={{ width: CONFIG.logoW, height: CONFIG.logoH, display: 'block' }}
            />
          </div>
        </div>
      </div>

      {/* ── Fade from/to black ──────────────────────────────────────────── */}
      <div
        style={{
          position:      'absolute',
          inset:         0,
          backgroundColor: 'black',
          opacity:       blackOpacity,
          pointerEvents: 'none',
        }}
      />

    </AbsoluteFill>
  );
};
