const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '../..');
process.chdir(root);

const publicService = fs.readFileSync('backend/src/classifieds/classifieds-auction-public.service.ts', 'utf8');
if (!publicService.includes("a.status IN ('SCHEDULED','OPEN')")) {
  throw new Error('Public scheduled auctions are missing from ClassifiedsAuctionPublicService.');
}
if (!publicService.includes("row.status==='SCHEDULED'") && !publicService.includes("row.status === 'SCHEDULED'")) {
  throw new Error('Public scheduled auction state is not exposed.');
}
if (!publicService.includes("row.status==='OPEN'") && !publicService.includes("row.status === 'OPEN'")) {
  throw new Error('Public live auction state is not exposed.');
}

const client = fs.readFileSync('lib/classifiedsAuctions.ts', 'utf8');
if (!client.includes('scheduled?: boolean;')) {
  const next = client.replace('  live: boolean;', '  live: boolean;\n  scheduled?: boolean;');
  if (next === client) throw new Error('Could not add scheduled auction type to client.');
  fs.writeFileSync('lib/classifiedsAuctions.ts', next);
  console.log('updated lib/classifiedsAuctions.ts');
}

console.log('Scheduled auctions are public and distinct from live auctions.');
