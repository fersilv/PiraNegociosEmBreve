const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '../..');
const requiredFiles = [
  'App.tsx',
  'components/WorkspaceLayout.tsx',
  'components/payments/PaymentCheckoutModal.tsx',
  'pages/ClassifiedsWorkspacePage.tsx',
  'backend/src/classifieds/classifieds-auction.service.ts',
  'backend/src/classifieds/classifieds-checkout.service.ts',
  'backend/src/payments/payment-checkout-status.controller.ts',
  'backend/src/payments/payment-checkout-status.service.ts',
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

const paymentModal = fs.readFileSync(
  path.join(root, 'components/payments/PaymentCheckoutModal.tsx'),
  'utf8',
);
if (!paymentModal.includes("createPortal(modal, document.body)")) {
  throw new Error('PaymentCheckoutModal precisa renderizar por Portal no document.body.');
}
if (!paymentModal.includes('/payments/${checkout.id}/status')) {
  throw new Error('PaymentCheckoutModal precisa acompanhar a mesma cobrança pelo endpoint de status.');
}

const paymentStatusController = fs.readFileSync(
  path.join(root, 'backend/src/payments/payment-checkout-status.controller.ts'),
  'utf8',
);
if (!paymentStatusController.includes("@Get(':paymentId/status')")) {
  throw new Error('Endpoint autenticado de status do checkout não encontrado.');
}

console.log('Build inputs verified (read-only).');
