import React from 'react';
import { AbsoluteFill, Img, staticFile, useCurrentFrame } from 'remotion';
import { z } from 'zod';

// ── Config ────────────────────────────────────────────────────────────────────
const CONFIG = {
  totalFrames: 88,   // 0000–0087 (last 8 frames are blank)
  srcFps:      30,   // original render fps

  // Calibrated footage alignment — dialled in to match the circle boundary.
  // Change these if the source footage ever changes.
  zoomPct:  172,     // 100 = 1×
  offsetX:  0,       // tenths-of-% of size, horizontal
  offsetY:  112,     // tenths-of-% of size, vertical
};

// ── Schema ────────────────────────────────────────────────────────────────────
export const z2ALogoAnimSchema = z.object({
  size:  z.number().int().min(50).max(1920),
  cx:    z.number().int(),
  cy:    z.number().int(),
  blend: z.enum(['normal', 'multiply', 'cutout']),
  // normal  — opaque, black letters on white circle
  // multiply — white drops out (compositing over light backgrounds)
  // cutout  — black opaque circle, letter shapes are transparent holes
});

// Programmatic props (not in schema — won't appear in Studio UI)
export type Z2ALogoAnimProps = z.infer<typeof z2ALogoAnimSchema> & {
  overrideFrame?:   number;
  containerStyle?:  React.CSSProperties; // applied to the SVG / div container for scale, opacity, etc.
};

// ── Frame filename ────────────────────────────────────────────────────────────
function frameSrc(n: number): string {
  const idx = Math.min(Math.max(0, n), CONFIG.totalFrames - 1);
  return staticFile(`z2a-logo-frames/z2a logo0009${String(idx).padStart(4, '0')}.png`);
}

// ── Component ─────────────────────────────────────────────────────────────────
export const Z2ALogoAnim: React.FC<Z2ALogoAnimProps> = ({
  size,
  cx,
  cy,
  blend,
  overrideFrame,
  containerStyle,
}) => {
  const frame = useCurrentFrame();
  const zoom = CONFIG.zoomPct / 100;
  const oxPx = (CONFIG.offsetX / 1000) * size;
  const oyPx = (CONFIG.offsetY / 1000) * size;

  // Use overrideFrame (pre-computed by parent) when provided, otherwise use composition frame
  const effectiveFrame = overrideFrame !== undefined ? overrideFrame : frame;
  const srcFrame = Math.floor(effectiveFrame * (CONFIG.srcFps / 30));
  const src = frameSrc(srcFrame);

  // ── Cutout mode: SVG luminance mask ───────────────────────────────────────
  // The PNG frames are black letters on white. As an SVG luminance mask:
  //   white (circle bg) → opaque → black fill shows
  //   black (letters)   → transparent → background shows through
  if (blend === 'cutout') {
    const half = size / 2;
    return (
      <AbsoluteFill style={{ backgroundColor: 'transparent' }}>
        <svg
          width={size}
          height={size}
          style={{
            position:        'absolute',
            top:             cy - half,
            left:            cx - half,
            overflow:        'visible',
            transformOrigin: 'center center',
            ...containerStyle,
          }}
        >
          <defs>
            <mask id="z2aLogoMask" maskUnits="userSpaceOnUse"
              x={0} y={0} width={size} height={size}
            >
              <image
                href={src}
                x={0} y={0}
                width={size} height={size}
                preserveAspectRatio="xMidYMid slice"
                style={{
                  transform:       `translate(${oxPx}px, ${oyPx}px) scale(${zoom})`,
                  transformOrigin: `${half}px ${half}px`,
                }}
              />
            </mask>
          </defs>

          {/* Black circle — letter shapes become transparent via the mask */}
          <circle
            cx={half} cy={half} r={half}
            fill="black"
            mask="url(#z2aLogoMask)"
          />
        </svg>
      </AbsoluteFill>
    );
  }

  // ── Normal / multiply mode: direct PNG render ─────────────────────────────
  return (
    <AbsoluteFill style={{ backgroundColor: 'transparent' }}>
      <div
        style={{
          position:        'absolute',
          top:             cy - size / 2,
          left:            cx - size / 2,
          width:           size,
          height:          size,
          borderRadius:    '50%',
          overflow:        'hidden',
          mixBlendMode:    blend as 'normal' | 'multiply',
          transformOrigin: 'center center',
          ...containerStyle,
        }}
      >
        <Img
          src={src}
          style={{
            width:           '100%',
            height:          '100%',
            objectFit:       'cover',
            display:         'block',
            transform:       `translate(${oxPx}px, ${oyPx}px) scale(${zoom})`,
            transformOrigin: 'center center',
          }}
        />
      </div>
    </AbsoluteFill>
  );
};
