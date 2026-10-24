import sharp from 'sharp';
import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const args = Object.fromEntries(process.argv.slice(2).reduce((pairs, value, i, values) => { if (i % 2 === 0) pairs.push([value.replace(/^--/, ''), values[i + 1]]); return pairs; }, []));
const output = fileURLToPath(new URL('../public/images/', import.meta.url));
await mkdir(output, { recursive: true });
for (const name of ['hero', 'farmer', 'buyer', 'transport']) {
  if (!args[name]) throw new Error(`Provide --${name} with its generated source image path`);
  for (const width of name === 'hero' ? [960, 1920] : [480, 800]) {
    await sharp(args[name]).rotate().resize(width, name === 'hero' ? Math.round(width * 9 / 16) : Math.round(width * 5 / 4), { fit: 'cover' }).webp({ quality: name === 'hero' ? 82 : 78, effort: 6 }).toFile(path.join(output, `${name}-${width}.webp`));
  }
  if (name === 'hero') await sharp(args[name]).resize(720, 1280, { fit: 'cover', position: 'right' }).webp({ quality: 72, effort: 6 }).toFile(path.join(output, 'hero-mobile.webp'));
}
console.log('Prepared nine responsive WebP files in public/images/.');
