import React from 'react';
import {
  AbsoluteFill,
  Easing,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';

// ── Config ────────────────────────────────────────────────────────────────────
const CONFIG = {
  // Layout
  logoSize: 700,   // rendered px (square)
  logoCY:   430,   // canvas Y of logo centre

  // SVG viewBox is 3401.468 × 3401.5813
  // Circle centre derived from the transform chain
  vcx: 1700.734,
  vcy: 1700.79,
  vr:  1600,       // circle radius in viewBox units

  // Colors
  bg:   '#000000',
  fill: '#231f20',

  // ── Timing (frames @ 30 fps) ─────────────────────────────────────────────
  // Circle springs in immediately
  circleDamping:   18,
  circleStiffness: 160,

  // Wipe starts once circle is mostly visible
  wipeStart:    8,
  wipeEnd:      28,   // frame when letters are fully revealed
  wipeEasing:   Easing.out(Easing.cubic),

  // URL text
  textFadeStart: 32,
  textFadeEnd:   48,
  text:          'ZeroToASICcourse.com',
  textSize:      52,
  textY:         780,
};

// ── SVG path data (verbatim from z2a.svg) ─────────────────────────────────────
// Both paths sit inside the same nested transform group.
// They are both filled shapes — the wipe clip reveals them left-to-right.

const PATH_Z =
  'm 0,0 66.389,-22.676 -214.282,-56.036 15.083,29.348 h -110.97' +
  ' l 131.522,261.79 H -274.566' +
  ' C -296.924,174.5 -309.75,130.285 -309.75,83.061' +
  ' c 0,-111.623 71.706,-206.523 171.573,-241.105' +
  ' l 36.387,72.291 73.68,29.884 -57.325,-114.332' +
  ' c 10.101,-1.237 20.385,-1.857 30.803,-1.857' +
  ' 61.288,0 117.509,21.622 161.506,57.626 L 57.358,113.964 Z';

const PATH_A =
  'M 0,0 C -66.422,0 -126.907,-25.385 -172.292,-66.974' +
  ' H 35.485 l -131.84,-261.941 h 47.291 l 11.221,22.308' +
  ' 42.174,-14.398 127.86,254.031 73.127,-339.567' +
  ' c 31.288,42.342 49.784,94.716 49.784,151.423' +
  ' C 255.102,-114.231 140.887,0 0,0';

// ── Component ─────────────────────────────────────────────────────────────────
export const Z2ALogoAnim: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Circle pops in
  const circleScale = spring({
    frame,
    fps,
    config: { damping: CONFIG.circleDamping, stiffness: CONFIG.circleStiffness },
    from: 0, to: 1,
  });

  // Wipe: rect grows left-to-right in viewBox space (0 → full width)
  const wipeFrac = interpolate(
    frame,
    [CONFIG.wipeStart, CONFIG.wipeEnd],
    [0, 1],
    {
      extrapolateLeft:  'clamp',
      extrapolateRight: 'clamp',
      easing: CONFIG.wipeEasing,
    },
  );
  // Add a small overshoot so the leading edge clears the rightmost pixel
  const wipeWidth = wipeFrac * 3600;

  // URL text fades in
  const textOpacity = interpolate(
    frame,
    [CONFIG.textFadeStart, CONFIG.textFadeEnd],
    [0, 1],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
  );

  const { vcx, vcy, vr } = CONFIG;

  return (
    <AbsoluteFill style={{ backgroundColor: CONFIG.bg }}>

      {/* ── Logo ──────────────────────────────────────────────────────────── */}
      <div
        style={{
          position:        'absolute',
          top:             CONFIG.logoCY - CONFIG.logoSize / 2,
          left:            960 - CONFIG.logoSize / 2,
          width:           CONFIG.logoSize,
          height:          CONFIG.logoSize,
          transform:       `scale(${circleScale})`,
          transformOrigin: 'center center',
        }}
      >
        <svg
          viewBox="0 0 3401.468 3401.5813"
          width={CONFIG.logoSize}
          height={CONFIG.logoSize}
          style={{ display: 'block' }}
        >
          <defs>
            {/* Permanent circle clip — keeps letters inside the disc */}
            <clipPath id="z2aCircle">
              <circle cx={vcx} cy={vcy} r={vr} />
            </clipPath>

            {/* Animated wipe clip — rect grows left-to-right */}
            <clipPath id="z2aWipe">
              <rect x={0} y={0} width={wipeWidth} height={3401.5813} />
            </clipPath>
          </defs>

          {/* White circle background */}
          <circle cx={vcx} cy={vcy} r={vr} fill="white" />

          {/* Letter paths — circle clip outer, wipe clip inner */}
          <g clipPath="url(#z2aCircle)">
            <g clipPath="url(#z2aWipe)">
              <g transform="matrix(1.3333333,0,0,-1.3333333,1322.7806,2078.743)">
                <g transform="matrix(5,0,0,5,-1133.86,-1133.8572)">
                  <g transform="translate(338.1049,200.4037)">
                    <path d={PATH_Z} fill={CONFIG.fill} />
                  </g>
                  <g transform="translate(283.4731,538.5829)">
                    <path d={PATH_A} fill={CONFIG.fill} />
                  </g>
                </g>
              </g>
            </g>
          </g>
        </svg>
      </div>

      {/* ── URL text ──────────────────────────────────────────────────────── */}
      <div
        style={{
          position:      'absolute',
          top:           CONFIG.textY,
          left:          0,
          right:         0,
          textAlign:     'center',
          opacity:       textOpacity,
          fontFamily:    '"Avenir Next", Avenir, "Trebuchet MS", Arial, sans-serif',
          fontWeight:    700,
          fontSize:      CONFIG.textSize,
          color:         'white',
          letterSpacing: 2,
          whiteSpace:    'nowrap',
        }}
      >
        {CONFIG.text}
      </div>

    </AbsoluteFill>
  );
};
