import React from 'react';
import {
  AbsoluteFill,
  CalculateMetadataFunction,
  Video,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';
import { z } from 'zod';
import { Z2ALogoAnim } from './Z2ALogoAnim';

// ── Fixed config (not exposed as props) ───────────────────────────────────────
const CONFIG = {
  logoSize:   700,
  logoCX:     960,
  logoCY:     460,
  textGap:     44,
  slotH:      120,
  fontSize:    80,
  fontFamily: '"Avenir Next", "Avenir", "Trebuchet MS", Arial, sans-serif',
  textColor:  '#000000',
  text:       'ZeroToASICcourse.com',
  slideDamping:   46,
  slideStiffness: 500,
  bgFadeIn:       6,
  bgFadeOut:      6,
};

// Logo animation constants — tied to the source PNG sequence, not user-configurable
const LOGO_TOTAL_FRAMES   = 88;  // usable source frames (indices 0–87; last 8 are blank)
const LOGO_FULLY_DRAWN_AT = 40;  // source frame where all letters are fully revealed
const LOGO_TEXT_SLIDE_AT  = 30;  // logo source frame when text starts sliding in

// Text exit timing — frames after hold ends when text starts exiting
const TEXT_EXIT_DELAY  = 38;
// Approximate frames for the text exit spring to fully settle off screen
// (exit spring: damping 40, stiffness 400 — critically damped, ~12 f to clear)
const TEXT_EXIT_FRAMES = 12;

// ── Schema ────────────────────────────────────────────────────────────────────
export const z2AIntroSchema = z.object({
  holdFrames:         z.number().int().min(0).max(300),  // hold duration after logo freezes
  bgHoldFrames:       z.number().int().min(0).max(300),  // extra hold after text is off screen before bg fades (0 = fade immediately)
  videoStartFrom:     z.number().int().min(0).max(3000), // bg video start frame
});

export type Z2AIntroProps = z.infer<typeof z2AIntroSchema>;

// ── calculateMetadata ─────────────────────────────────────────────────────────
export const calculateMetadata: CalculateMetadataFunction<Z2AIntroProps> = ({ props }) => {
  const holdEndComp    = CONFIG.bgFadeIn + LOGO_FULLY_DRAWN_AT + props.holdFrames;
  const titleExitComp  = holdEndComp + TEXT_EXIT_DELAY;
  const bgFadeOutStart = titleExitComp + TEXT_EXIT_FRAMES + props.bgHoldFrames;
  return { durationInFrames: bgFadeOutStart + CONFIG.bgFadeOut };
};

// ── Component ─────────────────────────────────────────────────────────────────
export const Z2AIntro: React.FC<Z2AIntroProps> = ({
  holdFrames,
  bgHoldFrames,
  videoStartFrom,
}) => {
  const frame = useCurrentFrame();
  const { fps, height } = useVideoConfig();

  // ── Timeline milestones (composition frames) ───────────────────────────────
  const logoStartComp  = CONFIG.bgFadeIn;
  const logoFreezeComp = CONFIG.bgFadeIn + LOGO_FULLY_DRAWN_AT;
  const holdEndComp    = logoFreezeComp + holdFrames;
  const titleExitComp  = holdEndComp + TEXT_EXIT_DELAY;
  const bgFadeOutStart = titleExitComp + TEXT_EXIT_FRAMES + bgHoldFrames;

  // ── Effective logo source frame ────────────────────────────────────────────
  let effectiveLogoFrame: number;
  if (frame < logoStartComp) {
    effectiveLogoFrame = 0;
  } else if (frame < logoFreezeComp) {
    effectiveLogoFrame = frame - logoStartComp;
  } else if (frame < holdEndComp) {
    effectiveLogoFrame = LOGO_FULLY_DRAWN_AT;
  } else {
    effectiveLogoFrame = LOGO_FULLY_DRAWN_AT + (frame - holdEndComp);
  }
  effectiveLogoFrame = Math.min(effectiveLogoFrame, LOGO_TOTAL_FRAMES - 1);

  // ── Background opacity ─────────────────────────────────────────────────────
  const bgOpacity = interpolate(
    frame,
    [0, CONFIG.bgFadeIn, bgFadeOutStart, bgFadeOutStart + CONFIG.bgFadeOut],
    [0, 1, 1, 0],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
  );

  // ── Text timing ───────────────────────────────────────────────────────────
  const titleStart  = CONFIG.bgFadeIn + LOGO_TEXT_SLIDE_AT;
  const isTextExit  = frame >= titleExitComp;

  const slotTop = CONFIG.logoCY + CONFIG.logoSize / 2 + CONFIG.textGap;

  // Distance to push text fully off the bottom of the screen
  const offscreenY = height - slotTop;

  // Entry: slides up from off screen, eases into place
  const entryFrac = spring({
    frame: frame - titleStart,
    fps,
    config: { damping: CONFIG.slideDamping, stiffness: CONFIG.slideStiffness },
    from: 0, to: 1,
  });
  const textEntryY = interpolate(entryFrac, [0, 1], [offscreenY, 0]);

  // Exit: accelerates back down off screen
  const exitFrac = spring({
    frame: frame - titleExitComp,
    fps,
    config: { damping: 40, stiffness: 400 },
    from: 0, to: 1,
  });
  const textExitY = interpolate(exitFrac, [0, 1], [0, offscreenY]);

  const textY = isTextExit ? textExitY : textEntryY;

  return (
    <AbsoluteFill style={{ backgroundColor: '#000000' }}>

      {/* ── Background video ─────────────────────────────────────────────── */}
      <div style={{ position: 'absolute', inset: 0, opacity: bgOpacity }}>
        <Video
          src={staticFile('microchip-background-h264.mp4')}
          startFrom={videoStartFrom}
          style={{
            width:           '100%',
            height:          '100%',
            objectFit:       'cover',
            transform:       'scale(1.2)',
            transformOrigin: 'center center',
          }}
        />
      </div>

      {/* ── Logo animation — freeze/resume controlled via overrideFrame ──── */}
      <Z2ALogoAnim
        size={CONFIG.logoSize}
        cx={CONFIG.logoCX}
        cy={CONFIG.logoCY}
        blend="cutout"
        overrideFrame={effectiveLogoFrame}
      />

      {/* ── Text slot ────────────────────────────────────────────────────── */}
      <div
        style={{
          position:       'absolute',
          top:            slotTop,
          left:           0,
          right:          0,
          height:         CONFIG.slotH,
          display:        'flex',
          justifyContent: 'center',
          alignItems:     'flex-start',
        }}
      >
        <span
          style={{
            fontFamily:    CONFIG.fontFamily,
            fontWeight:    700,
            fontSize:      CONFIG.fontSize,
            color:         CONFIG.textColor,
            whiteSpace:    'nowrap',
            letterSpacing: 1,
            transform:     `translateY(${textY}px)`,
            display:       'block',
          }}
        >
          {CONFIG.text}
        </span>
      </div>

    </AbsoluteFill>
  );
};
