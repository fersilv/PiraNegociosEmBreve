const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '../..');
const requiredFiles = [
  'App.tsx',
  'components/WorkspaceLayout.tsx',
  'pages/ClassifiedsWorkspacePage.tsx',
  'backend/src/classifieds/classifieds-auction.service.ts',
  'backend/src/classifieds/classifieds-checkout.service.ts',
];

for (const relativePath of requiredFiles) {
  if (!fs.existsSync(path.join(root, relativePath))) {
    throw new Error(`Build input ausente: ${relativePath}`);
  }
}

const auctionService = fs.readFileSync(
  path.join(root, 'backend/src/classifieds/classifieds-auction.service.ts'),
  'utf8',
);
const softCloseDeclarations = auctionService.match(
  /const\s+SOFT_CLOSE_SECONDS\s*=/g,
)?.length;
if (softCloseDeclarations !== 1) {
  throw new Error(
    `SOFT_CLOSE_SECONDS deve possuir uma declaração; encontradas ${softCloseDeclarations || 0}.`,
  );
}

console.log('Build inputs verified (read-only).');
