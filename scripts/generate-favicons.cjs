/**
 * Generate favicon.ico and apple-touch-icon.png from src/assets/favicons/favicon.svg
 * (Local 34 logo). Run: npm run generate:favicons
 */
const path = require('path');
const fs = require('fs');
const sharp = require('sharp');

const projectRoot = path.resolve(__dirname, '..');
const srcSvg = path.join(projectRoot, 'src/assets/favicons/favicon.svg');
const destDir = path.join(projectRoot, 'src/assets/favicons');

const icoSizes = [16, 32, 48];
const appleTouchSize = 180;

async function generate() {
  const { default: pngToIco } = await import('png-to-ico');

  const svgBuffer = fs.readFileSync(srcSvg);

  const pngBuffers = await Promise.all(icoSizes.map((size) => sharp(svgBuffer).resize(size, size).png().toBuffer()));

  const icoBuffer = await pngToIco(pngBuffers);
  fs.writeFileSync(path.join(destDir, 'favicon.ico'), icoBuffer);
  console.log('Created favicon.ico (16, 32, 48)');

  const appleTouchBuffer = await sharp(svgBuffer).resize(appleTouchSize, appleTouchSize).png().toBuffer();
  fs.writeFileSync(path.join(destDir, 'apple-touch-icon.png'), appleTouchBuffer);
  console.log('Created apple-touch-icon.png (180x180)');

  console.log('Favicon files generated in src/assets/favicons');
}

generate().catch((err) => {
  console.error(err);
  process.exit(1);
});
