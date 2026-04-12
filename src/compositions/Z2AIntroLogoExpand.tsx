import React from 'react';
import {
  AbsoluteFill,
  CalculateMetadataFunction,
  Easing,
  Video,
  interpolate,
  staticFile,
  useCurrentFrame,
} from 'remotion';
import { z } from 'zod';
import { Z2ALogoAnim } from './Z2ALogoAnim';

// ── Fixed config ──────────────────────────────────────────────────────────────
const CONFIG = {
  logoSize: 700,
  logoCX:   960,
  logoCY:   540,
  bgFadeIn:  6,
  // 1920×1080 centre→corner ≈ 1101 px → radius 1200 clears every corner
  expandToRadius: 1200,
  popFrames: 8,  // frames to reach full size (fast pop)
};

const LOGO_FULLY_DRAWN_AT = 40;

// ── Schema ────────────────────────────────────────────────────────────────────
export const z2AIntroLogoExpandSchema = z.object({
  holdFrames:          z.number().int().min(0).max(300),
  logoFadeDuration: z.number().int().min(1).max(120),   // how long the logo takes to fade out
  bgFadeDuration:   z.number().int().min(1).max(120),   // how long the background takes to fade out
  bgFadeDelay:      z.number().int().min(-60).max(120), // frames after logo fade starts that bg fade starts (0=together, negative=bg starts earlier)
  videoStartFrom:      z.number().int().min(0).max(3000),
});

export type Z2AIntroLogoExpandProps = z.infer<typeof z2AIntroLogoExpandSchema>;

// ── calculateMetadata ─────────────────────────────────────────────────────────
export const calculateMetadata: CalculateMetadataFunction<Z2AIntroLogoExpandProps> = ({ props }) => {
  const expandStart  = CONFIG.bgFadeIn + LOGO_FULLY_DRAWN_AT + props.holdFrames;
  const logoFadeEnd = expandStart + props.logoFadeDuration;
  const bgFadeEnd   = expandStart + props.bgFadeDelay + props.bgFadeDuration;
  return { durationInFrames: Math.max(logoFadeEnd, bgFadeEnd) + 10 + 1 };
};

// ── Component ─────────────────────────────────────────────────────────────────
export const Z2AIntroLogoExpand: React.FC<Z2AIntroLogoExpandProps> = ({
  holdFrames,
  logoFadeDuration,
  bgFadeDuration,
  bgFadeDelay,
  videoStartFrom,
}) => {
  const frame = useCurrentFrame();

  // ── Timeline milestones ───────────────────────────────────────────────────
  const logoStartComp  = CONFIG.bgFadeIn;
  const logoFreezeComp = logoStartComp + LOGO_FULLY_DRAWN_AT;
  const expandStart = logoFreezeComp + holdFrames;
  const popEnd      = expandStart + CONFIG.popFrames;

  // ── Effective logo source frame ───────────────────────────────────────────
  let effectiveLogoFrame: number;
  if (frame < logoStartComp) {
    effectiveLogoFrame = 0;
  } else if (frame < logoFreezeComp) {
    effectiveLogoFrame = frame - logoStartComp;
  } else {
    effectiveLogoFrame = LOGO_FULLY_DRAWN_AT;
  }

  // ── Size: pops fast to expandToRadius, stays there ───────────────────────
  const circleRadius = interpolate(
    frame,
    [expandStart, popEnd],
    [CONFIG.logoSize / 2, CONFIG.expandToRadius],
    {
      extrapolateLeft:  'clamp',
      extrapolateRight: 'clamp',
      easing:           Easing.out(Easing.cubic),
    },
  );

  // ── Logo opacity ─────────────────────────────────────────────────────────
  const logoFadeStart = expandStart;
  const logoOpacity = interpolate(
    frame,
    [logoFadeStart, logoFadeStart + logoFadeDuration],
    [1, 0],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
  );

  // ── Background opacity ────────────────────────────────────────────────────
  const bgFadeOutStart = expandStart + bgFadeDelay;
  const bgOpacity = interpolate(
    frame,
    [0, CONFIG.bgFadeIn, bgFadeOutStart, bgFadeOutStart + bgFadeDuration],
    [0, 1, 1, 0],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
  );

  return (
    <AbsoluteFill style={{ backgroundColor: '#000000' }}>

      {/* ── Background video ───────────────────────────────────────────────── */}
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

      {/* ── Logo — draws, freezes, pops to fill screen, fades out ─────────── */}
      <Z2ALogoAnim
        size={circleRadius * 2}
        cx={CONFIG.logoCX}
        cy={CONFIG.logoCY}
        blend="cutout"
        overrideFrame={effectiveLogoFrame}
        containerStyle={{ opacity: logoOpacity }}
      />

    </AbsoluteFill>
  );
};
