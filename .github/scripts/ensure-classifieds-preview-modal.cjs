const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '../..');
process.chdir(root);

const file = 'pages/ClassifiedPublishPage.tsx';
let source = fs.readFileSync(file, 'utf8');
const original = source;

// The legacy prebuild scripts use exact string anchors. Normalize CRLF checkouts
// so Windows and Linux run the same transformations.
source = source.replace(/\r\n/g, '\n');

const marker = 'aria-label="Fechar prévia"';
if (source.includes(marker)) {
  if (source !== original) fs.writeFileSync(file, source);
  console.log('Classifieds mobile preview modal anchor verified.');
  process.exit(0);
}

// The full v2 script owns the import/state/button/modal transformation. When
// this script runs before v2 on a clean checkout, there is intentionally
// nothing to patch yet. Do not fail just because the source is still pre-v2.
const hasPreviewInfrastructure =
  source.includes("const [previewOpen, setPreviewOpen] = useState(false);") &&
  source.includes('ClassifiedListingPreview');

if (!hasPreviewInfrastructure) {
  if (source !== original) fs.writeFileSync(file, source);
  console.log('Classifieds mobile preview modal deferred to experience v2.');
  process.exit(0);
}

const modal = `      {previewOpen && <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/45 p-4 sm:hidden"><button className="absolute inset-0" aria-label="Fechar prévia" onClick={() => setPreviewOpen(false)} /><div className="relative w-full max-w-sm"><button onClick={() => setPreviewOpen(false)} className="absolute -right-2 -top-12 z-10 rounded-full bg-white px-4 py-2 text-xs font-black text-stone-700">Fechar</button><ClassifiedListingPreview value={form} /></div></div>}\n`;

const functionAnchor = '\nfunction TypeCategoryStep';
const functionIndex = source.indexOf(functionAnchor);
if (functionIndex < 0) {
  throw new Error('Classifieds mobile preview modal could not locate TypeCategoryStep.');
}

const beforeFunction = source.slice(0, functionIndex);
const afterFunction = source.slice(functionIndex);
const componentClose = '\n    </div>\n  );\n}';
const closeIndex = beforeFunction.lastIndexOf(componentClose);
if (closeIndex < 0) {
  throw new Error('Classifieds mobile preview modal could not locate the publish component closing block.');
}

source = `${beforeFunction.slice(0, closeIndex)}\n${modal}${beforeFunction.slice(closeIndex)}${afterFunction}`;
fs.writeFileSync(file, source);
console.log(`updated ${file} with resilient mobile preview modal anchor`);
