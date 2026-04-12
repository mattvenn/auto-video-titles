import React from 'react';
import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';

// ─── CONFIG ───────────────────────────────────────────────────────────────────
// All tweakable values live here. Coordinates are in "local space" where the
// circle centre is (0, 0) and the radius is circleR.
const CONFIG = {
  // ── Canvas anchoring ────────────────────────────────────────────────────────
  circleCX: 960,   // canvas X of circle centre
  circleCY: 460,   // canvas Y of circle centre (slightly above 540 for text room)
  circleR:  260,   // circle radius in px

  // ── Colors ──────────────────────────────────────────────────────────────────
  bg:          '#000000',
  circleColor: '#ffffff',
  letterColor: '#000000',
  textColor:   '#ffffff',

  // ── Circle spring (entry / exit) ────────────────────────────────────────────
  circleInDamping:    18,
  circleInStiffness:  120,
  circleOutDamping:   20,
  circleOutStiffness: 300,
  circleBlur:         8,   // max Gaussian blur (px) at scale 0

  // ── Z strokes — local coords, (0,0) = circle centre ─────────────────────────
  zSW: 90,  // stroke width
  // Top bar  — left→right
  zTx1: -258, zTy1: -175,
  zTx2:   88, zTy2: -175,
  zTlen:  346,  // approximate path length for dashoffset
  // Diagonal — top-right→bottom-left
  zDx2: -118, zDy2:  60,
  zDlen:  313,
  // Bottom bar — left→right
  zBx2:   88, zBy2:  60,
  zBlen:  206,

  // ── Arrow (right-pointing triangle at end of Z bottom bar) ──────────────────
  arrowBaseX:  88,   // left edge of triangle (matches zBx2)
  arrowTopY:    8,   // top vertex Y
  arrowBotY:  112,   // bottom vertex Y
  arrowTipX:  210,   // tip X
  arrowTipY:   60,   // tip Y (matches zBy2 centre)

  // ── Notch (white triangle below arrow — visually separates Z from A) ────────
  notchApexX:   70, notchApexY:  112,
  notchLeftX:  -30, notchRightX: 170, notchBotY: 170,

  // ── A strokes — local coords ─────────────────────────────────────────────────
  aSW: 90,  // stroke width
  // Left leg — bottom-left → apex
  aLx1: -85, aLy1: 140,
  aApexX: 88, aApexY: -175,
  aLlen:  355,
  // Right leg — apex → bottom-right (exits circle slightly)
  aRx2: 252, aRy2: 205,
  aRlen:  410,

  // ── URL text ─────────────────────────────────────────────────────────────────
  urlText:       'ZeroToASICcourse.com',
  urlFontSize:   52,
  urlFont:       '"Avenir Next", Avenir, sans-serif',
  urlWeight:     700,
  urlCanvasY:    805,   // top of the text container on the 1080-high canvas

  // ── Timing (frames at 30 fps, total = 120) ───────────────────────────────────
  // Phase 1 — circle in
  circleInEnd:    8,    // spring starts at frame 0

  // Phase 2 — Z draws on
  zTopDraw:   [  8,  20] as [number, number],
  zDiagDraw:  [ 18,  30] as [number, number],
  zBotDraw:   [ 28,  38] as [number, number],

  // Phase 3 — A draws on
  aLeftDraw:  [ 33,  45] as [number, number],
  aRightDraw: [ 43,  55] as [number, number],

  // Phase 4 — URL slides in
  urlIn:      [ 55,  67] as [number, number],

  // Phase 5 — hold (67–80)

  // Phase 6 — Z erases (sequential opacity fade)
  zTopErase:  [ 80,  90] as [number, number],
  zDiagErase: [ 87,  97] as [number, number],
  zBotErase:  [ 94, 101] as [number, number],

  // Phase 7 — A erases
  aRightErase:[ 96, 104] as [number, number],
  aLeftErase: [101, 109] as [number, number],

  // Phase 8 — URL slides out
  urlOut:     [107, 116] as [number, number],

  // Phase 9 — circle shrinks out (spring starts here)
  circleOutStart: 114,
};

// ─── HELPERS ──────────────────────────────────────────────────────────────────
/** 0→1 progress over [start,end], clamped. */
function prog(frame: number, [start, end]: [number, number]): number {
  return interpolate(frame, [start, end], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
}

/** strokeDashoffset so that a stroke of `len` grows from its start as p: 0→1. */
function dashOff(p: number, len: number): number {
  return len * (1 - p);
}

// ─── COMPONENT ────────────────────────────────────────────────────────────────
export const Z2ALogo: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const C = CONFIG;

  // ── Circle scale (entry spring + exit spring) ──────────────────────────────
  const circleScaleIn = spring({
    fps,
    frame,
    config: { damping: C.circleInDamping, stiffness: C.circleInStiffness },
    from: 0,
    to: 1,
  });
  const circleScaleOut = spring({
    fps,
    frame: frame - C.circleOutStart,
    config: { damping: C.circleOutDamping, stiffness: C.circleOutStiffness },
    from: 1,
    to: 0,
  });
  const circleScale =
    frame >= C.circleOutStart ? circleScaleOut : circleScaleIn;

  // Blur is proportional to (1 – scale): glow when tiny, clear when full.
  const circleBlur = interpolate(circleScale, [0, 0.4, 1], [C.circleBlur, 2, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // ── Z draw-on (dashoffset 0→1 means fully drawn) ──────────────────────────
  const zTopDrawP  = prog(frame, C.zTopDraw);
  const zDiagDrawP = prog(frame, C.zDiagDraw);
  const zBotDrawP  = prog(frame, C.zBotDraw);

  // ── Z erase (opacity fade, sequential) ───────────────────────────────────
  const zTopEraseP  = prog(frame, C.zTopErase);
  const zDiagEraseP = prog(frame, C.zDiagErase);
  const zBotEraseP  = prog(frame, C.zBotErase);

  // Arrow & notch follow the bottom bar: appear as bar finishes, fade with bar.
  const arrowOpacity = Math.max(
    0,
    Math.min(1, zBotDrawP * 3 - 2) * (1 - zBotEraseP),
  );

  // ── A draw-on ─────────────────────────────────────────────────────────────
  const aLeftDrawP  = prog(frame, C.aLeftDraw);
  const aRightDrawP = prog(frame, C.aRightDraw);

  // ── A erase ───────────────────────────────────────────────────────────────
  const aRightEraseP = prog(frame, C.aRightErase);
  const aLeftEraseP  = prog(frame, C.aLeftErase);

  // ── URL slot reveal ────────────────────────────────────────────────────────
  // Enter: spring-driven translateY(-100% → 0%)
  const urlEnterSpring = spring({
    fps,
    frame: frame - C.urlIn[0],
    config: { damping: 16, stiffness: 200 },
    from: 0,
    to: 1,
  });
  const urlOutP = prog(frame, C.urlOut);
  const urlTranslateY =
    frame < C.urlOut[0]
      ? interpolate(urlEnterSpring, [0, 1], [-100, 0])
      : interpolate(urlOutP, [0, 1], [0, -100]);

  // ── Shorthand ─────────────────────────────────────────────────────────────
  const cx = C.circleCX;
  const cy = C.circleCY;
  const r  = C.circleR;

  // The scale-transform keeps the centre fixed.
  const scaleTx = `translate(${cx},${cy}) scale(${circleScale}) translate(${-cx},${-cy})`;

  return (
    <AbsoluteFill style={{ backgroundColor: C.bg }}>

      {/* ── Logo mark SVG ─────────────────────────────────────────────────── */}
      <svg
        width={1920}
        height={1080}
        viewBox="0 0 1920 1080"
        style={{ position: 'absolute', top: 0, left: 0 }}
      >
        {/* The whole mark scales together; scale is anchored at circle centre. */}
        <g transform={scaleTx}>

          {/* White circle — blur at edges when tiny (entrance/exit glow). */}
          <circle
            cx={cx} cy={cy} r={r}
            fill={C.circleColor}
            style={{ filter: `blur(${circleBlur}px)` }}
          />

          {/*
            All strokes are black on black outside the circle, making them
            invisible there — no clipPath needed.
          */}

          {/* ── Z: top bar (left → right) ──────────────────────────────── */}
          <line
            x1={cx + C.zTx1} y1={cy + C.zTy1}
            x2={cx + C.zTx2} y2={cy + C.zTy2}
            stroke={C.letterColor}
            strokeWidth={C.zSW}
            strokeLinecap="square"
            strokeDasharray={C.zTlen}
            strokeDashoffset={dashOff(zTopDrawP, C.zTlen)}
            opacity={1 - zTopEraseP}
          />

          {/* ── Z: diagonal (top-right → bottom-left) ─────────────────── */}
          <line
            x1={cx + C.zTx2}  y1={cy + C.zTy2}
            x2={cx + C.zDx2}  y2={cy + C.zDy2}
            stroke={C.letterColor}
            strokeWidth={C.zSW}
            strokeLinecap="square"
            strokeDasharray={C.zDlen}
            strokeDashoffset={dashOff(zDiagDrawP, C.zDlen)}
            opacity={1 - zDiagEraseP}
          />

          {/* ── Z: bottom bar (left → right) ──────────────────────────── */}
          <line
            x1={cx + C.zDx2}  y1={cy + C.zDy2}
            x2={cx + C.zBx2}  y2={cy + C.zBy2}
            stroke={C.letterColor}
            strokeWidth={C.zSW}
            strokeLinecap="square"
            strokeDasharray={C.zBlen}
            strokeDashoffset={dashOff(zBotDrawP, C.zBlen)}
            opacity={1 - zBotEraseP}
          />

          {/* ── Arrow — rightward triangle at tip of Z bottom bar ─────── */}
          <polygon
            points={[
              `${cx + C.arrowBaseX},${cy + C.arrowTopY}`,
              `${cx + C.arrowTipX},${cy + C.arrowTipY}`,
              `${cx + C.arrowBaseX},${cy + C.arrowBotY}`,
            ].join(' ')}
            fill={C.letterColor}
            opacity={arrowOpacity}
          />

          {/* ── Notch — white triangle below arrow, separates Z from A ── */}
          <polygon
            points={[
              `${cx + C.notchApexX},${cy + C.notchApexY}`,
              `${cx + C.notchLeftX},${cy + C.notchBotY}`,
              `${cx + C.notchRightX},${cy + C.notchBotY}`,
            ].join(' ')}
            fill={C.circleColor}
            opacity={arrowOpacity}
          />

          {/* ── A: left leg (bottom-left → apex) ──────────────────────── */}
          <line
            x1={cx + C.aLx1}   y1={cy + C.aLy1}
            x2={cx + C.aApexX} y2={cy + C.aApexY}
            stroke={C.letterColor}
            strokeWidth={C.aSW}
            strokeLinecap="square"
            strokeDasharray={C.aLlen}
            strokeDashoffset={dashOff(aLeftDrawP, C.aLlen)}
            opacity={1 - aLeftEraseP}
          />

          {/* ── A: right leg (apex → bottom-right, exits circle) ──────── */}
          <line
            x1={cx + C.aApexX} y1={cy + C.aApexY}
            x2={cx + C.aRx2}   y2={cy + C.aRy2}
            stroke={C.letterColor}
            strokeWidth={C.aSW}
            strokeLinecap="square"
            strokeDasharray={C.aRlen}
            strokeDashoffset={dashOff(aRightDrawP, C.aRlen)}
            opacity={1 - aRightEraseP}
          />

        </g>{/* end scale group */}
      </svg>

      {/* ── URL text — slot reveal ─────────────────────────────────────────── */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: C.urlCanvasY,
          height: C.urlFontSize * 1.5,
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'flex-start',
          overflow: 'hidden',
        }}
      >
        <span
          style={{
            fontFamily: C.urlFont,
            fontSize: C.urlFontSize,
            fontWeight: C.urlWeight,
            color: C.textColor,
            whiteSpace: 'nowrap',
            transform: `translateY(${urlTranslateY}%)`,
            display: 'block',
          }}
        >
          {C.urlText}
        </span>
      </div>

    </AbsoluteFill>
  );
};
