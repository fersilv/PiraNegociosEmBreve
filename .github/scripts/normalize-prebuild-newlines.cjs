const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '../..');
process.chdir(root);

const roots = ['.github/scripts', 'pages', 'components', 'contexts', 'backend/src'];
const extensions = new Set(['.js', '.cjs', '.mjs', '.ts', '.tsx']);
let normalized = 0;

function walk(relativeDir) {
  const absoluteDir = path.join(root, relativeDir);
  if (!fs.existsSync(absoluteDir)) return;
  for (const entry of fs.readdirSync(absoluteDir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === 'dist' || entry.name === '.git') continue;
    const relativePath = path.join(relativeDir, entry.name);
    const absolutePath = path.join(root, relativePath);
    if (entry.isDirectory()) {
      walk(relativePath);
      continue;
    }
    if (!entry.isFile() || !extensions.has(path.extname(entry.name).toLowerCase())) continue;
    const source = fs.readFileSync(absolutePath, 'utf8');
    if (!source.includes('\r\n')) continue;
    fs.writeFileSync(absolutePath, source.replace(/\r\n/g, '\n'));
    normalized += 1;
  }
}

for (const directory of roots) walk(directory);
console.log(`Prebuild newline normalization verified${normalized ? ` (${normalized} file${normalized === 1 ? '' : 's'} normalized)` : ''}.`);
