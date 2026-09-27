const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const ROOT_DIR = path.resolve(__dirname, '..');
const SVG_SOURCE = path.join(ROOT_DIR, 'public', 'icon.svg');

async function run() {
  console.log('--- Generating Application Icons & Splash Assets ---');
  if (!fs.existsSync(SVG_SOURCE)) {
    throw new Error('Source icon not found: ' + SVG_SOURCE);
  }

  const svgContent = fs.readFileSync(SVG_SOURCE, 'utf8');

  // Foreground SVG: remove background rects so only the calendar, shield, and checkmark remain
  const foregroundSvg = svgContent
    .replace(/<rect width="512" height="512" rx="120" fill="url\(#v2-bg\)" \/>/, '')
    .replace(/<rect width="512" height="512" rx="120" fill="none" stroke="#3b82f6" stroke-width="2" opacity="0.3" \/>/, '');

  // Maskable SVG with safe margin (inner 80% to avoid being cropped by irregular launchers)
  const maskableSvg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="100%" height="100%">
      <rect width="512" height="512" fill="#0b132b" />
      <g transform="translate(51.2, 51.2) scale(0.8)">
        ${foregroundSvg}
      </g>
    </svg>
  `;

  // Notification monochrome white silhouette SVG with transparent checkmark cutout
  const notifSvg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96" width="96" height="96">
      <mask id="cutout">
        <rect width="96" height="96" fill="#fff" />
        <path d="M 33 47 L 43 57 L 63 35" fill="none" stroke="#000" stroke-width="9" stroke-linecap="round" stroke-linejoin="round" />
      </mask>
      <path d="M 48 10 C 66 10 80 18 80 36 C 80 62 52 82 48 86 C 44 82 16 62 16 36 C 16 18 30 10 48 10 Z" fill="#ffffff" mask="url(#cutout)" />
    </svg>
  `;

  // Helper to ensure parent dir exists
  function ensureDir(filePath) {
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  // 1. Generate Web Assets (/public)
  console.log('Generating Web / PWA Assets...');
  const webAssets = [
    { file: 'public/icon-512.png', size: 512, input: SVG_SOURCE },
    { file: 'public/icon-192.png', size: 192, input: SVG_SOURCE },
    { file: 'public/icon-maskable-512.png', size: 512, input: Buffer.from(maskableSvg) },
    { file: 'public/icon-maskable-192.png', size: 192, input: Buffer.from(maskableSvg) },
    { file: 'public/apple-touch-icon.png', size: 180, input: SVG_SOURCE },
    { file: 'public/favicon-32.png', size: 32, input: SVG_SOURCE },
    { file: 'public/favicon-16.png', size: 16, input: SVG_SOURCE },
  ];

  for (const item of webAssets) {
    const dest = path.join(ROOT_DIR, item.file);
    ensureDir(dest);
    await sharp(item.input).resize(item.size, item.size).png().toFile(dest);
  }

  // 2. Generate Root Assets (/assets for Capacitor Assets Tool)
  console.log('Generating Root Assets (/assets)...');
  const rootAssets = [
    { file: 'assets/icon.png', size: 1024, input: SVG_SOURCE },
    { file: 'assets/icon-foreground.png', size: 1024, input: Buffer.from(foregroundSvg) },
  ];
  for (const item of rootAssets) {
    const dest = path.join(ROOT_DIR, item.file);
    ensureDir(dest);
    await sharp(item.input).resize(item.size, item.size).png().toFile(dest);
  }
  // assets/icon-background.png (solid #0b132b)
  const bgDest = path.join(ROOT_DIR, 'assets', 'icon-background.png');
  ensureDir(bgDest);
  await sharp({
    create: {
      width: 1024,
      height: 1024,
      channels: 4,
      background: { r: 11, g: 19, b: 43, alpha: 1 },
    }
  }).png().toFile(bgDest);

  // 3. Generate Android Mipmap Icons
  console.log('Generating Android Mipmap Icons...');
  const mipmapDensities = [
    { name: 'mipmap-mdpi', iconSize: 48, fgSize: 108 },
    { name: 'mipmap-hdpi', iconSize: 72, fgSize: 162 },
    { name: 'mipmap-xhdpi', iconSize: 96, fgSize: 216 },
    { name: 'mipmap-xxhdpi', iconSize: 144, fgSize: 324 },
    { name: 'mipmap-xxxhdpi', iconSize: 192, fgSize: 432 },
  ];

  for (const density of mipmapDensities) {
    const dir = path.join(ROOT_DIR, 'android/app/src/main/res', density.name);
    ensureDir(path.join(dir, 'ic_launcher.png'));

    // A. ic_launcher.png (standard square/squircle)
    await sharp(SVG_SOURCE)
      .resize(density.iconSize, density.iconSize)
      .png()
      .toFile(path.join(dir, 'ic_launcher.png'));

    // B. ic_launcher_round.png (circular mask)
    const circleMask = Buffer.from(
      `<svg width="${density.iconSize}" height="${density.iconSize}"><circle cx="${density.iconSize/2}" cy="${density.iconSize/2}" r="${density.iconSize/2}" fill="#fff" /></svg>`
    );
    await sharp(SVG_SOURCE)
      .resize(density.iconSize, density.iconSize)
      .composite([{ input: circleMask, blend: 'dest-in' }])
      .png()
      .toFile(path.join(dir, 'ic_launcher_round.png'));

    // C. ic_launcher_foreground.png (adaptive icon foreground with 70% safe zone padding)
    const innerSize = Math.round(density.fgSize * 0.70);
    const padding = Math.floor((density.fgSize - innerSize) / 2);
    const extraPadding = density.fgSize - innerSize - padding;

    await sharp(Buffer.from(foregroundSvg))
      .resize(innerSize, innerSize)
      .extend({
        top: padding,
        bottom: extraPadding,
        left: padding,
        right: extraPadding,
        background: { r: 0, g: 0, b: 0, alpha: 0 }
      })
      .png()
      .toFile(path.join(dir, 'ic_launcher_foreground.png'));
  }

  // 4. Generate Android Notification Icons
  console.log('Generating Android Notification Icons...');
  const notifDensities = [
    { dir: 'drawable', size: 48 },
    { dir: 'drawable-mdpi', size: 24 },
    { dir: 'drawable-hdpi', size: 36 },
    { dir: 'drawable-xhdpi', size: 48 },
    { dir: 'drawable-xxhdpi', size: 72 },
    { dir: 'drawable-xxxhdpi', size: 96 },
  ];

  for (const item of notifDensities) {
    const dest = path.join(ROOT_DIR, 'android/app/src/main/res', item.dir, 'ic_stat_notification.png');
    ensureDir(dest);
    await sharp(Buffer.from(notifSvg))
      .resize(item.size, item.size)
      .png()
      .toFile(dest);
  }

  // 5. Generate Branded Splash Screens
  console.log('Generating Android Splash Screens...');
  const splashScreens = [
    { dir: 'drawable', w: 480, h: 320, logoSize: 160 },
    { dir: 'drawable-port-mdpi', w: 320, h: 480, logoSize: 180 },
    { dir: 'drawable-port-hdpi', w: 480, h: 800, logoSize: 260 },
    { dir: 'drawable-port-xhdpi', w: 720, h: 1280, logoSize: 360 },
    { dir: 'drawable-port-xxhdpi', w: 960, h: 1600, logoSize: 480 },
    { dir: 'drawable-port-xxxhdpi', w: 1280, h: 1920, logoSize: 600 },
    { dir: 'drawable-land-mdpi', w: 480, h: 320, logoSize: 160 },
    { dir: 'drawable-land-hdpi', w: 800, h: 480, logoSize: 240 },
    { dir: 'drawable-land-xhdpi', w: 1280, h: 720, logoSize: 320 },
    { dir: 'drawable-land-xxhdpi', w: 1600, h: 960, logoSize: 420 },
    { dir: 'drawable-land-xxxhdpi', w: 1920, h: 1280, logoSize: 520 },
  ];

  for (const splash of splashScreens) {
    const dest = path.join(ROOT_DIR, 'android/app/src/main/res', splash.dir, 'splash.png');
    ensureDir(dest);

    const logoBuffer = await sharp(SVG_SOURCE)
      .resize(splash.logoSize, splash.logoSize)
      .png()
      .toBuffer();

    await sharp({
      create: {
        width: splash.w,
        height: splash.h,
        channels: 4,
        background: { r: 11, g: 19, b: 43, alpha: 1 }, // #0b132b brand background
      }
    })
      .composite([{
        input: logoBuffer,
        gravity: 'centre'
      }])
      .png()
      .toFile(dest);
  }

  console.log('✓ All application icons, adaptive layers, and splash screens generated successfully!');
}

run().catch(err => {
  console.error('Asset generation failed:', err);
  process.exit(1);
});
