const fs = require('fs');
const path = require('path');

const repoRoot = path.resolve(__dirname, '../..');
process.chdir(repoRoot);

function patchClassifiedsCatalogTypes() {
  const file = 'backend/src/classifieds/classifieds.service.ts';
  let source = fs.readFileSync(file, 'utf8');
  const original = source;

  source = source.replace(
    "      kind: String(group?.kind || 'MODIFIER').toUpperCase() === 'VARIANT' ? 'VARIANT' : 'MODIFIER',",
    "      kind: (String(group?.kind || 'MODIFIER').toUpperCase() === 'VARIANT' ? 'VARIANT' : 'MODIFIER') as 'VARIANT' | 'MODIFIER',",
  );
  source = source.replace(
    "      selectionType: String(group?.selectionType || 'SINGLE').toUpperCase() === 'MULTIPLE' ? 'MULTIPLE' : 'SINGLE',",
    "      selectionType: (String(group?.selectionType || 'SINGLE').toUpperCase() === 'MULTIPLE' ? 'MULTIPLE' : 'SINGLE') as 'SINGLE' | 'MULTIPLE',",
  );

  if (!source.includes("as 'VARIANT' | 'MODIFIER'")) {
    throw new Error('Classifieds build fix could not verify catalog option group kind typing.');
  }
  if (!source.includes("as 'SINGLE' | 'MULTIPLE'")) {
    throw new Error('Classifieds build fix could not verify catalog option group selection typing.');
  }

  if (source !== original) {
    fs.writeFileSync(file, source);
    console.log(`updated ${file}`);
  }
}

function patchWhatsAppDetachListener() {
  const file = 'backend/src/whatsapp/whatsapp-channel-publisher.ts';
  let source = fs.readFileSync(file, 'utf8');
  const original = source;

  source = source.replace("          let detachListener: (() => void) | null = null;\n", '');
  source = source.replace("            detachListener = () => collection.off?.('add', handler);\n", '');
  source = source.replace("          detachListener?.();\n", '');

  if (source.includes('detachListener')) {
    throw new Error('Classifieds build fix could not remove obsolete WhatsApp detachListener flow.');
  }

  if (source !== original) {
    fs.writeFileSync(file, source);
    console.log(`updated ${file}`);
  }
}

patchClassifiedsCatalogTypes();
patchWhatsAppDetachListener();
console.log('Classifieds build compatibility verified.');
