import React from 'react';
import { AbsoluteFill, Img, staticFile, useCurrentFrame } from 'remotion';
import { z } from 'zod';

// ── Config ────────────────────────────────────────────────────────────────────
const CONFIG = {
  totalFrames: 96,   // 0000–0095
  srcFps:      30,   // original render fps

  // Calibrated footage alignment — dialled in to match the circle boundary.
  // Change these if the source footage ever changes.
  zoomPct:  172,     // 100 = 1×
  offsetX:  0,       // tenths-of-% of size, horizontal
  offsetY:  112,     // tenths-of-% of size, vertical
};

// ── Schema ────────────────────────────────────────────────────────────────────
export const z2ALogoAnimSchema = z.object({
  size:  z.number().int().min(50).max(1920), // circle diameter in px
  cx:    z.number().int(),                   // centre X on canvas
  cy:    z.number().int(),                   // centre Y on canvas
  blend: z.enum(['normal', 'multiply']),     // multiply drops white for compositing
});

export type Z2ALogoAnimProps = z.infer<typeof z2ALogoAnimSchema>;

// ── Frame filename ─────────────────────────────────────────────────────────────
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
}) => {
  const frame = useCurrentFrame();
  const zoom = CONFIG.zoomPct / 100;
  const oxPx = (CONFIG.offsetX / 1000) * size;
  const oyPx = (CONFIG.offsetY / 1000) * size;

  // Map Remotion frame → source frame index
  const srcFrame = Math.floor(frame * (CONFIG.srcFps / 30));

  return (
    <AbsoluteFill style={{ backgroundColor: 'transparent' }}>
      {/* Clipping circle — overflow:hidden keeps footage inside */}
      <div
        style={{
          position:     'absolute',
          top:          cy - size / 2,
          left:         cx - size / 2,
          width:        size,
          height:       size,
          borderRadius: '50%',
          overflow:     'hidden',
          mixBlendMode: blend,
        }}
      >
        {/* Footage — zoom + offset applied here, transformOrigin keeps centre fixed */}
        <Img
          src={frameSrc(srcFrame)}
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
