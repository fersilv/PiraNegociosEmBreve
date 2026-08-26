const fs = require('fs');
const path = require('path');

const repoRoot = path.resolve(__dirname, '../..');
process.chdir(repoRoot);

function readNormalized(file) {
  return fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n');
}

function writeIfChanged(file, original, source) {
  if (source !== original) {
    fs.writeFileSync(file, source);
    console.log(`updated ${file}`);
  }
}

function patchClassifiedsCatalogTypes() {
  const file = 'backend/src/classifieds/classifieds.service.ts';
  let source = readNormalized(file);
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

  writeIfChanged(file, original, source);
}

function patchClassifiedsCommerceMapTypes() {
  const file = 'backend/src/classifieds/classifieds-commerce.service.ts';
  let source = readNormalized(file);
  const original = source;

  source = source.replace(
    '    const conversations = new Map(conversationRows.map((row: any) => [row.listingId, Number(row.count)]));',
    '    const conversations = new Map<string, number>(conversationRows.map((row: any) => [row.listingId, Number(row.count)]));',
  );
  source = source.replace(
    '    const offers = new Map(offerRows.map((row: any) => [row.listingId, { offers: Number(row.offers), accepted: Number(row.accepted) }]));',
    '    const offers = new Map<string, { offers: number; accepted: number }>(offerRows.map((row: any) => [row.listingId, { offers: Number(row.offers), accepted: Number(row.accepted) }]));',
  );
  source = source.replace(
    '    const contacts = new Map(eventRows.map((row: any) => [row.listingId, Number(row.contacts)]));',
    '    const contacts = new Map<string, number>(eventRows.map((row: any) => [row.listingId, Number(row.contacts)]));',
  );
  source = source.replace(
    '    const prefMap = new Map(prefs.map((row: any) => [row.conversationId, row]));',
    '    const prefMap = new Map<string, { labels?: string[]; customName?: string | null }>(prefs.map((row: any) => [row.conversationId, row]));',
  );

  if (!source.includes('new Map<string, { offers: number; accepted: number }>')) {
    throw new Error('Classifieds build fix could not verify offer analytics map typing.');
  }
  if (!source.includes('new Map<string, { labels?: string[]; customName?: string | null }>')) {
    throw new Error('Classifieds build fix could not verify conversation preference map typing.');
  }

  writeIfChanged(file, original, source);
}

function patchClassifiedsSalesFulfillmentTypes() {
  const file = 'backend/src/classifieds/classifieds-sales.service.ts';
  let source = readNormalized(file);
  const original = source;

  source = source.replace(
    '    const fulfillmentModes = Array.isArray(checkoutSource.fulfillmentModes)',
    "    const fulfillmentModes: Array<'PICKUP' | 'DELIVERY'> = Array.isArray(checkoutSource.fulfillmentModes)",
  );
  source = source.replace(
    "      : ['PICKUP'];\n    const onlineEnabled = listingType === 'PRODUCT' && checkoutSource.enabled === true;",
    "      : (['PICKUP'] as Array<'PICKUP' | 'DELIVERY'>);\n    const onlineEnabled = listingType === 'PRODUCT' && checkoutSource.enabled === true;",
  );
  source = source.replace(
    "        fulfillmentModes: fulfillmentModes.length ? fulfillmentModes : ['PICKUP'],",
    "        fulfillmentModes: fulfillmentModes.length ? fulfillmentModes : (['PICKUP'] as Array<'PICKUP' | 'DELIVERY'>),",
  );

  if (!source.includes("const fulfillmentModes: Array<'PICKUP' | 'DELIVERY'>")) {
    throw new Error('Classifieds build fix could not verify fulfillment mode typing.');
  }

  writeIfChanged(file, original, source);
}

function patchWhatsAppDetachListener() {
  const file = 'backend/src/whatsapp/whatsapp-channel-publisher.ts';
  let source = readNormalized(file);
  const original = source;

  // Older WPP typings made the extra detach callback troublesome. The handler
  // already unregisters itself both on match and on timeout, so this callback
  // is redundant. Remove all historical formatting variants idempotently.
  source = source.replace(/^\s*let detachListener:\s*\(\(\) => void\)\s*\|\s*null\s*=\s*null;\s*\n/gm, '');
  source = source.replace(/^\s*detachListener\s*=\s*\(\)\s*=>\s*collection\.off\?\.\('add',\s*handler\);\s*\n/gm, '');
  source = source.replace(/^\s*detachListener\?\.\(\);\s*\n/gm, '');

  if (/\bdetachListener\b/.test(source)) {
    throw new Error('Classifieds build fix found an unsupported WhatsApp detachListener variant.');
  }

  writeIfChanged(file, original, source);
}

patchClassifiedsCatalogTypes();
patchClassifiedsCommerceMapTypes();
patchClassifiedsSalesFulfillmentTypes();
patchWhatsAppDetachListener();
console.log('Classifieds build compatibility verified.');
