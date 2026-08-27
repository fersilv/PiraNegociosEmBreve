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
  'backend/src/payments/payments.controller.ts',
  'backend/src/payments/payment-checkout-status.controller.ts',
  'backend/src/payments/payment-checkout-status.service.ts',
  'backend/src/chat/chat.gateway.ts',
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

const tracksCheckoutId = paymentModal.includes('/payments/${checkout.id}/status');
const tracksNormalizedPaymentId =
  paymentModal.includes("const paymentId = String(checkout?.paymentId || checkout?.id || '').trim()")
  && paymentModal.includes('/payments/${paymentId}/status');

if (!tracksCheckoutId && !tracksNormalizedPaymentId) {
  throw new Error('PaymentCheckoutModal precisa acompanhar a mesma cobrança pelo endpoint de status.');
}
if (!paymentModal.includes("socket.on('payment:updated'")) {
  throw new Error('PaymentCheckoutModal precisa receber atualizações de pagamento em tempo real.');
}

const paymentStatusController = fs.readFileSync(
  path.join(root, 'backend/src/payments/payment-checkout-status.controller.ts'),
  'utf8',
);
if (!paymentStatusController.includes("@Get(':paymentId/status')")) {
  throw new Error('Endpoint autenticado de status do checkout não encontrado.');
}

const paymentsController = fs.readFileSync(
  path.join(root, 'backend/src/payments/payments.controller.ts'),
  'utf8',
);
if (!paymentsController.includes('paymentId,') || !paymentsController.includes('checkoutStatus.watchForUser')) {
  throw new Error('Checkout Pix precisa devolver paymentId explícito e iniciar o acompanhamento realtime.');
}

const paymentStatusService = fs.readFileSync(
  path.join(root, 'backend/src/payments/payment-checkout-status.service.ts'),
  'utf8',
);
if (!paymentStatusService.includes("publishPaymentUpdate") || !paymentStatusService.includes('watchForUser')) {
  throw new Error('Serviço de checkout precisa publicar atualizações realtime da cobrança.');
}

const chatGateway = fs.readFileSync(
  path.join(root, 'backend/src/chat/chat.gateway.ts'),
  'utf8',
);
if (!chatGateway.includes("emit('payment:updated'")) {
  throw new Error('Gateway autenticado precisa publicar o evento payment:updated.');
}

console.log('Build inputs verified (read-only).');