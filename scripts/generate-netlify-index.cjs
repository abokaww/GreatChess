const fs = require('fs');
const path = require('path');

const distDir = path.join(__dirname, '..', 'dist');
const clientAssetsDir = path.join(distDir, 'client', 'assets');

if (!fs.existsSync(clientAssetsDir)) {
  console.warn('No client assets found in', clientAssetsDir);
  process.exit(0);
}

const files = fs.readdirSync(clientAssetsDir);
const css = files.find((f) => f.startsWith('styles-'));
const indexFiles = files.filter((f) => f.startsWith('index-') && f.endsWith('.js'));

const lines = [];
lines.push('<!doctype html>');
lines.push('<html lang="en">');
lines.push('  <head>');
lines.push('    <meta charset="utf-8" />');
lines.push('    <meta name="viewport" content="width=device-width,initial-scale=1" />');
lines.push('    <title>Great Chess</title>');
if (css) lines.push(`    <link rel="stylesheet" href="/client/assets/${css}" />`);
lines.push('  </head>');
lines.push('  <body>');
lines.push('    <div id="root"></div>');
indexFiles.forEach((f) => lines.push(`    <script type="module" src="/client/assets/${f}"></script>`));
lines.push('  </body>');
lines.push('</html>');

fs.writeFileSync(path.join(distDir, 'index.html'), lines.join('\n'));
fs.writeFileSync(path.join(distDir, '_redirects'), '/* /index.html 200\n');

console.log('Generated dist/index.html and dist/_redirects');
