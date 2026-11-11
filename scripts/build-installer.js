const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

console.log('=== Building Sun Bakers & Confectionary Offline Release ===');

// 1. Run build:all
console.log('\n[1/3] Building frontend, backend bundle, and electron files...');
execSync('npm run build:all', { stdio: 'inherit' });

// 2. Run electron-builder to generate win-unpacked and portable exe
console.log('\n[2/3] Generating portable executable and unpacked binaries with electron-builder...');
execSync('npx electron-builder --win', { stdio: 'inherit' });

// 3. Compile full NSIS Setup installer
console.log('\n[3/3] Compiling full offline NSIS Setup installer...');
const makensisPath = path.join(
  process.env.LOCALAPPDATA || '',
  'electron-builder/Cache/nsis/nsis-3.0.4.1/Bin/makensis.exe'
);

const nsiScript = path.join(__dirname, 'installer.nsi');
if (fs.existsSync(makensisPath) && fs.existsSync(nsiScript)) {
  execSync(`"${makensisPath}" "${nsiScript}"`, { stdio: 'inherit' });
  console.log('\n✔ Successfully created release/Sun Bakers & Confectionary Setup 1.0.0.exe');
} else {
  console.log('\n✔ Portable executable created. (makensis not found at cached path for setup installer)');
}

console.log('\n🎉 Build Complete! Release binaries available in ./release directory.');

