const { Resvg } = require('@resvg/resvg-js');
const fs = require('fs');
const path = require('path');

const svgPath = path.join(__dirname, '../public/volspike-logo.svg');
const svgContent = fs.readFileSync(svgPath, 'utf-8');

// Convert to PNG - Icon (64x64)
const iconResvg = new Resvg(svgContent, {
  fitTo: {
    mode: 'width',
    value: 64,
  },
  background: 'transparent',
});
const iconPng = iconResvg.render();
const iconPngData = iconPng.asPng();
fs.writeFileSync(path.join(__dirname, '../public/volspike-logo-icon.png'), iconPngData);
console.log('✅ Created volspike-logo-icon.png (64x64)');

// Convert to PNG - Logo (128x128)
const logoResvg = new Resvg(svgContent, {
  fitTo: {
    mode: 'width',
    value: 128,
  },
  background: 'transparent',
});
const logoPng = logoResvg.render();
const logoPngData = logoPng.asPng();
fs.writeFileSync(path.join(__dirname, '../public/volspike-logo-128.png'), logoPngData);
console.log('✅ Created volspike-logo-128.png (128x128)');

// Convert to PNG - Logo (256x256) for high-res
const logo256Resvg = new Resvg(svgContent, {
  fitTo: {
    mode: 'width',
    value: 256,
  },
  background: 'transparent',
});
const logo256Png = logo256Resvg.render();
const logo256PngData = logo256Png.asPng();
fs.writeFileSync(path.join(__dirname, '../public/volspike-logo-256.png'), logo256PngData);
console.log('✅ Created volspike-logo-256.png (256x256)');

console.log('\n🎉 All PNG files created successfully!');
console.log('📁 Files saved to: public/');
console.log('\nFor Stripe:');
console.log('  - Icon: Use volspike-logo-icon.png (64x64)');
console.log('  - Logo: Use volspike-logo-128.png or volspike-logo-256.png');

