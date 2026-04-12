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
  slideDamping:   18,
  slideStiffness: 150,
  // Frames before logo ends when text starts exiting
  textExitLeadFrames: 6,
};

// Logo animation has 96 source frames (indices 0–95)
const LOGO_TOTAL_FRAMES = 96;

// ── Schema ────────────────────────────────────────────────────────────────────
export const z2AIntroSchema = z.object({
  holdFrames:            z.number().int().min(0).max(300),  // hold duration after logo freezes
  logoFreezeAt:          z.number().int().min(0).max(95),   // source frame at which logo pauses
  titleSlideInLogoFrame: z.number().int().min(0).max(95),   // logo source frame when text starts sliding in
  bgFadeIn:              z.number().int().min(0).max(30),   // background fade-in frames
  bgFadeOut:             z.number().int().min(0).max(30),   // background fade-out frames after logo ends
  videoStartFrom:        z.number().int().min(0).max(3000), // bg video start frame
});

export type Z2AIntroProps = z.infer<typeof z2AIntroSchema>;

// ── calculateMetadata ─────────────────────────────────────────────────────────
// Total = bgFadeIn + logoFreezeAt + holdFrames + (LOGO_TOTAL_FRAMES - logoFreezeAt) + bgFadeOut
//       = bgFadeIn + holdFrames + LOGO_TOTAL_FRAMES + bgFadeOut
export const calculateMetadata: CalculateMetadataFunction<Z2AIntroProps> = ({ props }) => ({
  durationInFrames: props.bgFadeIn + props.holdFrames + LOGO_TOTAL_FRAMES + props.bgFadeOut,
});

// ── Component ─────────────────────────────────────────────────────────────────
export const Z2AIntro: React.FC<Z2AIntroProps> = ({
  holdFrames,
  logoFreezeAt,
  titleSlideInLogoFrame,
  bgFadeIn,
  bgFadeOut,
  videoStartFrom,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // ── Timeline milestones (composition frames) ───────────────────────────────
  const logoStartComp  = bgFadeIn;
  const logoFreezeComp = bgFadeIn + logoFreezeAt;
  const holdEndComp    = logoFreezeComp + holdFrames;
  const logoEndComp    = holdEndComp + (LOGO_TOTAL_FRAMES - logoFreezeAt); // = bgFadeIn + holdFrames + 96
  const bgFadeOutStart = logoEndComp;

  // ── Effective logo source frame ────────────────────────────────────────────
  let effectiveLogoFrame: number;
  if (frame < logoStartComp) {
    effectiveLogoFrame = 0;
  } else if (frame < logoFreezeComp) {
    effectiveLogoFrame = frame - logoStartComp;
  } else if (frame < holdEndComp) {
    effectiveLogoFrame = logoFreezeAt;
  } else {
    effectiveLogoFrame = logoFreezeAt + (frame - holdEndComp);
  }
  effectiveLogoFrame = Math.min(effectiveLogoFrame, LOGO_TOTAL_FRAMES - 1);

  // ── Background opacity ─────────────────────────────────────────────────────
  const bgOpacity = interpolate(
    frame,
    [0, bgFadeIn, bgFadeOutStart, bgFadeOutStart + bgFadeOut],
    [0, 1, 1, 0],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
  );

  // ── Text timing ───────────────────────────────────────────────────────────
  const titleStart     = bgFadeIn + titleSlideInLogoFrame;
  const titleExitComp  = logoEndComp - CONFIG.textExitLeadFrames;
  const isTextExit     = frame >= titleExitComp;

  const slotTop = CONFIG.logoCY + CONFIG.logoSize / 2 + CONFIG.textGap;

  const entryFrac = spring({
    frame: frame - titleStart,
    fps,
    config: { damping: CONFIG.slideDamping, stiffness: CONFIG.slideStiffness },
    from: 0, to: 1,
  });
  const textEntryY = interpolate(entryFrac, [0, 1], [-CONFIG.slotH, 0]);

  const exitFrac = spring({
    frame: frame - titleExitComp,
    fps,
    config: { damping: CONFIG.slideDamping, stiffness: CONFIG.slideStiffness },
    from: 0, to: 1,
  });
  const textExitY = interpolate(exitFrac, [0, 1], [0, -CONFIG.slotH]);

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
          overflow:       'hidden',
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
