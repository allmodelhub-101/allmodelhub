import sharp from 'sharp';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const out = path.join(root, 'public/pwa');
const store = path.join(root, 'docs/android/store/assets');
await fs.mkdir(out, { recursive: true });
await fs.mkdir(store, { recursive: true });
const logo = path.join(root, 'public/brand/models-suite-logo.png');
// Preserve the official mark; trim transparent source padding and give it a
// dark full-bleed canvas. Maskable artwork fits entirely inside the safe circle.
const mark = await sharp(logo).trim().png().toBuffer();
for (const [name, size, ratio] of [['icon-192.png',192,.78], ['icon-512.png',512,.78], ['maskable-512.png',512,.56], ['apple-180.png',180,.78]]) {
  const pixels = Math.round(size * ratio);
  const image = await sharp(mark).resize(pixels, pixels, { fit: 'contain' }).toBuffer();
  await sharp({ create: { width: size, height: size, channels: 3, background: '#05070a' } })
    .composite([{ input: image, gravity: 'centre' }]).png().toFile(path.join(out, name));
}
await fs.copyFile(path.join(out, 'icon-512.png'), path.join(store, 'app-icon-512.png'));
const feature = Buffer.from(`<svg width="1024" height="500" xmlns="http://www.w3.org/2000/svg"><defs><radialGradient id="g"><stop stop-color="#114e70"/><stop offset="1" stop-color="#05070a"/></radialGradient></defs><rect width="1024" height="500" fill="#05070a"/><ellipse cx="800" cy="230" rx="400" ry="400" fill="url(#g)"/><path d="M70 390H950" stroke="#24425a"/><g font-family="Arial, sans-serif"><text x="72" y="140" fill="#66ddff" font-size="15" letter-spacing="4">YOUR AI WORKSPACE</text><text x="68" y="220" fill="#f1f8ff" font-size="62" font-weight="700">Models Suite</text><text x="72" y="275" fill="#b5cddd" font-size="25">Chat. Create. Explore.</text><text x="72" y="345" fill="#819eb6" font-size="18">Every Leading AI. One PKR Wallet.</text></g></svg>`);
await sharp(feature).composite([{ input: await sharp(mark).resize(240,240,{fit:'contain',background:{r:0,g:0,b:0,alpha:0}}).toBuffer(), left: 718, top: 115 }]).flatten({background:'#05070a'}).removeAlpha().png().toFile(path.join(store, 'feature-graphic-1024x500.png'));
console.log('Official-brand PWA, launcher and store assets generated.');
