const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '../..');
process.chdir(root);

const file = 'pages/ClassifiedPublishPage.tsx';
let source = fs.readFileSync(file, 'utf8');
const marker = 'aria-label="Fechar prévia"';

if (source.includes(marker)) {
  console.log('Classifieds mobile preview modal anchor verified.');
  process.exit(0);
}

const modal = `      {previewOpen && <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/45 p-4 sm:hidden"><button className="absolute inset-0" aria-label="Fechar prévia" onClick={() => setPreviewOpen(false)} /><div className="relative w-full max-w-sm"><button onClick={() => setPreviewOpen(false)} className="absolute -right-2 -top-12 z-10 rounded-full bg-white px-4 py-2 text-xs font-black text-stone-700">Fechar</button><ClassifiedListingPreview value={form} /></div></div>}\n`;

const compactTail = `</div></div>\n    </div>\n  );\n}\n\nfunction TypeCategoryStep`;
const expandedTail = `</div>\n      </div>\n${modal}    </div>\n  );\n}\n\nfunction TypeCategoryStep`;

if (source.includes(compactTail)) {
  source = source.replace(compactTail, expandedTail);
} else {
  const anchor = `    </div>\n  );\n}\n\nfunction TypeCategoryStep`;
  if (!source.includes(anchor)) {
    throw new Error('Classifieds mobile preview modal fallback anchor not found.');
  }
  source = source.replace(anchor, `${modal}${anchor}`);
}

fs.writeFileSync(file, source);
console.log(`updated ${file} with resilient mobile preview modal anchor`);
