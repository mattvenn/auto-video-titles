/**
 * render_frames.mjs — Render LowerThirdVFD frames as transparent PNGs.
 *
 * Uses Remotion's renderFrames() Node API (same Chrome screenshot path as
 * `remotion still`, which we know produces correct alpha).
 *
 * Usage:
 *   node render_frames.mjs --out=/path/to/frames/ --props=/path/to/props.json
 *
 * The caller (Makefile) then converts the PNG sequence to ProRes via ffmpeg.
 */

import { bundle } from '@remotion/bundler';
import { getCompositions, renderFrames } from '@remotion/renderer';
import { createRequire } from 'module';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const args = Object.fromEntries(
  process.argv.slice(2)
    .filter(a => a.startsWith('--'))
    .map(a => { const [k, ...v] = a.slice(2).split('='); return [k, v.join('=')]; })
);

if (!args.out || !args.props || !args.composition) {
  console.error('Usage: node render_frames.mjs --out=<dir> --props=<file.json> --composition=<id>');
  process.exit(1);
}

const outDir      = path.resolve(args.out);
const props       = JSON.parse(fs.readFileSync(args.props, 'utf8'));
const composition = args.composition;

fs.mkdirSync(outDir, { recursive: true });

console.log('Bundling…');
const bundleDir = await bundle({
  entryPoint: path.resolve(__dirname, 'src/index.ts'),
});

const compositions = await getCompositions(bundleDir, { inputProps: props });
const comp = compositions.find(c => c.id === composition);
if (!comp) {
  console.error(`Composition '${composition}' not found`);
  process.exit(1);
}

console.log(`Rendering ${comp.durationInFrames} frames → ${outDir}`);
await renderFrames({
  composition:  comp,
  serveUrl:     bundleDir,
  outputDir:    outDir,
  inputProps:   props,
  imageFormat:  'png',
  onFrameUpdate: (rendered) => {
    process.stdout.write(`\r  ${rendered}/${comp.durationInFrames}`);
  },
});

process.stdout.write('\n');

// Rename element-NNN.png → <card-id>-NNN.png
const cardName = path.basename(outDir);
for (const file of fs.readdirSync(outDir)) {
  const match = file.match(/^element-(\d+)\.png$/);
  if (match) {
    fs.renameSync(path.join(outDir, file), path.join(outDir, `${cardName}-${match[1]}.png`));
  }
}

console.log('Done.');
