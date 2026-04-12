import React from 'react';
import {
  AbsoluteFill,
  Video,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';
import { Z2ALogoAnim } from './Z2ALogoAnim';

// ── Config ────────────────────────────────────────────────────────────────────
const CONFIG = {
  // Timing (frames @ 30 fps)
  bgFadeIn:   6,    // background fades up from black
  titleStart: 32,   // text starts sliding down
  titleHold:  110,  // text starts sliding back up
  bgFadeOut:  6,    // background fades to black at the end
  total:      150,

  // Logo
  logoSize: 400,
  logoCX:   960,
  logoCY:   490,

  // Text slot — transparent overflow:hidden container, clips the sliding text
  textGap:    20,   // gap between bottom of logo and top of slot
  slotH:      60,   // slot height (text line height)
  fontSize:   44,
  fontFamily: '"Avenir Next", "Avenir", "Trebuchet MS", Arial, sans-serif',
  textColor:  '#FFFFFF',

  text: 'ZeroToASICcourse.com',

  // Spring feel
  slideDamping:   18,
  slideStiffness: 150,
};

// ── Component ─────────────────────────────────────────────────────────────────
export const Z2AIntro: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // ── Background fade in / out ───────────────────────────────────────────────
  const bgOpacity = interpolate(
    frame,
    [0, CONFIG.bgFadeIn, CONFIG.total - CONFIG.bgFadeOut, CONFIG.total],
    [0, 1, 1, 0],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
  );

  // ── Text slot position ─────────────────────────────────────────────────────
  const slotTop = CONFIG.logoCY + CONFIG.logoSize / 2 + CONFIG.textGap;
  const isExit  = frame >= CONFIG.titleHold;

  // Entry: text slides down from above the slot
  const entryFrac = spring({
    frame: frame - CONFIG.titleStart,
    fps,
    config: { damping: CONFIG.slideDamping, stiffness: CONFIG.slideStiffness },
    from: 0, to: 1,
  });
  const textEntryY = interpolate(entryFrac, [0, 1], [-CONFIG.slotH, 0]);

  // Exit: text slides back up out of the slot
  const exitFrac = spring({
    frame: frame - CONFIG.titleHold,
    fps,
    config: { damping: CONFIG.slideDamping, stiffness: CONFIG.slideStiffness },
    from: 0, to: 1,
  });
  const textExitY = interpolate(exitFrac, [0, 1], [0, -CONFIG.slotH]);

  const textY = isExit ? textExitY : textEntryY;

  return (
    <AbsoluteFill style={{ backgroundColor: '#000000' }}>

      {/* ── Background video ─────────────────────────────────────────────── */}
      <div style={{ position: 'absolute', inset: 0, opacity: bgOpacity }}>
        <Video
          src={staticFile('microchip-background.mov')}
          style={{
            width:           '100%',
            height:          '100%',
            objectFit:       'cover',
            transform:       'scale(1.2)',
            transformOrigin: 'center center',
          }}
        />
      </div>

      {/* ── Logo animation ───────────────────────────────────────────────── */}
      <Z2ALogoAnim
        size={CONFIG.logoSize}
        cx={CONFIG.logoCX}
        cy={CONFIG.logoCY}
        blend="normal"
      />

      {/* ── Text slot — clips text as it slides in/out ───────────────────── */}
      <div
        style={{
          position: 'absolute',
          top:      slotTop,
          left:     0,
          right:    0,
          height:   CONFIG.slotH,
          overflow: 'hidden',
          display:  'flex',
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
